/**
 * RoadViewSystem — turns the projection into the road's geometry.
 *
 * Owns a fixed set of entities created once and rewritten every frame: one
 * ribbon polygon for the surface, one for each shoulder, a pool of lane dashes,
 * and a stack of night bands. Nothing is created or destroyed while the game
 * runs, so a ten-minute run allocates no more than the first frame did.
 *
 * The ribbon trick: consecutive projected segments share an edge, so the entire
 * road is one closed path — down the left edge from the car to the horizon, back
 * up the right. Sixty trapezia become one polygon that cannot seam, because
 * there are no internal edges left to disagree about.
 *
 * The night bands are where headlight power becomes visible. Each band covers a
 * slice of road at a known distance and is filled with darkness in proportion to
 * how far outside the lit cone that distance is. Drain the power and the wall of
 * black walks toward the car, which is the entire difficulty curve expressed as
 * a picture.
 */
import type Entity from '../entities/Entity.js';
import { SHAPE, TRANSFORM, type Point } from '../components/index.js';
import { laneDash, nightBand, roadShoulder, roadSurface } from '../entities/roadPiece.js';
import { coneLength } from './LightSystem.js';
import { projectAtS } from './CameraSystem.js';
import type { World } from '../world.js';

/** Shoulder width, as a fraction of the road's half-width. */
const SHOULDER_RATIO = 0.2;

/** Half-width of a lane dash, as a fraction of the road's half-width. */
const DASH_HALF_RATIO = 0.012;

/** Dashes are drawn on every other segment, which is what makes them dashes. */
const DASH_STRIDE = 2;

const MAX_DASHES = 64;

/**
 * Slices the road is darkened in. More bands is a smoother falloff and more
 * rectangles; fourteen is enough that the gradient reads as light rather than as
 * steps at any window size we target.
 */
const NIGHT_BANDS = 14;

export default class RoadViewSystem {
  private readonly surface = roadSurface();
  private readonly shoulderLeft = roadShoulder('left');
  private readonly shoulderRight = roadShoulder('right');
  private readonly dashes: Entity[] = [];
  private readonly bands: Entity[] = [];

  constructor() {
    for (let i = 0; i < MAX_DASHES; i++) this.dashes.push(laneDash(i));
    for (let i = 0; i < NIGHT_BANDS; i++) this.bands.push(nightBand(i));
  }

  /** Every entity this system owns, for the scene to register once. */
  entities(): Entity[] {
    return [this.surface, this.shoulderLeft, this.shoulderRight, ...this.dashes, ...this.bands];
  }

  update(world: World): void {
    const { projection } = world;

    // Fewer than two segments is not a road — during the first frame of a run,
    // or a restart, there is nothing to draw yet.
    if (projection.count < 2) {
      this.hideAll();
      return;
    }

    this.buildRibbon(world);
    this.buildDashes(world);
    this.buildNightBands(world);
  }

  private hideAll(): void {
    for (const entity of this.entities()) {
      const shape = entity.get(SHAPE);
      if (shape) shape.visible = false;
    }
  }

  /** The surface and both shoulders, as three closed paths. */
  private buildRibbon(world: World): void {
    const { segments, count } = world.projection;

    const surface: Point[] = [];
    const leftOuter: Point[] = [];
    const leftInner: Point[] = [];
    const rightInner: Point[] = [];
    const rightOuter: Point[] = [];

    // Walk near to far collecting one point per shared edge, starting with the
    // nearest segment's near edge and then taking every far edge.
    for (let i = 0; i <= count; i++) {
      const seg = segments[Math.min(i, count - 1)]!;
      const near = i === 0;
      const centre = near ? seg.nearCentreX : seg.farCentreX;
      const half = near ? seg.nearHalfWidth : seg.farHalfWidth;
      const y = near ? seg.nearY : seg.farY;
      const shoulder = half * SHOULDER_RATIO;

      surface.push({ x: centre - half, y });
      leftOuter.push({ x: centre - half - shoulder, y });
      leftInner.push({ x: centre - half, y });
      rightInner.push({ x: centre + half, y });
      rightOuter.push({ x: centre + half + shoulder, y });
    }

    // Close each path by coming back along its other edge.
    for (let i = count; i >= 0; i--) {
      const seg = segments[Math.min(i, count - 1)]!;
      const near = i === 0;
      const centre = near ? seg.nearCentreX : seg.farCentreX;
      const half = near ? seg.nearHalfWidth : seg.farHalfWidth;
      const y = near ? seg.nearY : seg.farY;
      surface.push({ x: centre + half, y });
    }

    this.setPolygon(this.surface, surface);
    this.setPolygon(this.shoulderLeft, [...leftOuter, ...leftInner.reverse()]);
    this.setPolygon(this.shoulderRight, [...rightInner, ...rightOuter.reverse()]);
  }

  private buildDashes(world: World): void {
    const { segments, count } = world.projection;
    const { lanes } = world.config;

    let used = 0;

    if (lanes.count === 3) {
      // Lane boundaries sit half a lane either side of centre.
      for (const lateral of [-0.5, 0.5]) {
        for (let i = 0; i < count; i += DASH_STRIDE) {
          if (used >= this.dashes.length) break;
          const seg = segments[i]!;

          const nearHalf = seg.nearHalfWidth * DASH_HALF_RATIO;
          const farHalf = seg.farHalfWidth * DASH_HALF_RATIO;
          const nearX = seg.nearCentreX + (lateral / world.config.road.halfWidth) * seg.nearHalfWidth;
          const farX = seg.farCentreX + (lateral / world.config.road.halfWidth) * seg.farHalfWidth;

          this.setPolygon(this.dashes[used]!, [
            { x: nearX - nearHalf, y: seg.nearY },
            { x: nearX + nearHalf, y: seg.nearY },
            { x: farX + farHalf, y: seg.farY },
            { x: farX - farHalf, y: seg.farY },
          ]);
          used++;
        }
      }
    }

    for (let i = used; i < this.dashes.length; i++) {
      const shape = this.dashes[i]!.get(SHAPE);
      if (shape) shape.visible = false;
    }
  }

  /**
   * Darkness as a function of distance. Each band spans a slice of road between
   * two `s` values and is filled in proportion to how far past the lit cone it
   * sits — fully transparent inside the cone, fully black beyond the fade.
   */
  private buildNightBands(world: World): void {
    const { car, light, config, viewport } = world;
    const cone = coneLength(config, light);
    // Cover the lit range plus the fade, so the gradient always ends in black
    // rather than stopping mid-way and revealing un-darkened road behind it.
    const range = Math.min(config.road.horizonMetres, cone + config.light.fadeMetres * 4);
    const step = range / NIGHT_BANDS;

    for (let i = 0; i < NIGHT_BANDS; i++) {
      const entity = this.bands[i]!;
      const shape = entity.get(SHAPE)!;
      const transform = entity.get(TRANSFORM)!;

      const sNear = car.s + i * step;
      const sFar = car.s + (i + 1) * step;
      const near = projectAtS(world, sNear);
      const far = projectAtS(world, sFar);

      if (!near || !far || far.y >= near.y) {
        shape.visible = false;
        continue;
      }

      const distance = (i + 0.5) * step;
      const lit = Math.min(1, Math.max(0, (cone - distance) / config.light.fadeMetres));

      transform.x = 0;
      transform.y = far.y;
      shape.width = viewport.width;
      shape.height = near.y - far.y + 1;
      shape.fillAlpha = 1 - lit;
      shape.visible = shape.fillAlpha > 0.01;
    }

    // Everything beyond the banded range is past the fade and simply black; the
    // camera's own background colour already provides that, so nothing to draw.
  }

  private setPolygon(entity: Entity, points: Point[]): void {
    const shape = entity.get(SHAPE);
    if (!shape) return;

    if (points.length < 3) {
      shape.visible = false;
      return;
    }
    shape.points = points;
    shape.dirty = true;
    shape.visible = true;
  }
}
