/**
 * CameraSystem — the one place metres become pixels.
 *
 * Walks the live track from just behind the car out to the horizon and projects
 * each segment into a screen-space trapezium, writing the result into
 * `world.projection`. Everything upstream is metres and seconds; everything
 * downstream is pixels. Nothing else in the codebase does both.
 *
 * The projection is the classic 1/z pseudo-3D road, not a matrix: scale falls
 * off with depth, and lateral curvature is accumulated as a screen-space drift
 * that compounds along the road. That is why a bend reads as the road sweeping
 * sideways rather than the camera turning — which is exactly the 1976 look, and
 * it costs nothing.
 *
 * Two things keep it cheap. Segments are pooled and `count` moves instead of the
 * array being rebuilt. And the walk stops as soon as a segment's far edge stops
 * being above its near edge — by then segments are sub-pixel and there is no
 * point projecting the rest of the 300-metre horizon.
 */
import { segmentAt, type ProjectedSegment, type World } from '../world.js';

/** Metres represented by one lane-unit of depth in the perspective maths. */
export const METRES_PER_LANE_UNIT = 4;

/**
 * Screen-x gain per metre of accumulated curvature. Tuned by eye so a `sharp`
 * bend reads as a multi-lane sweep by its far end rather than a kink.
 */
const CURVE_SCREEN_GAIN = 0.2;

/**
 * The camera sits behind the car, so the car projects at a finite depth and the
 * road continues under it to the bottom edge instead of stopping at its bumper.
 */
const CAMERA_BEHIND_METRES = 5;
const MIN_DZ_METRES = 0.2;

/**
 * The car is drawn at a fixed size and screen position rather than projected.
 *
 * Projecting it looked correct and read terribly: five metres from the camera
 * the road is wider than the window, so a car a legitimate 0.7 lanes across came
 * out 240px wide and ran off the bottom edge. The camera is rigidly attached to
 * the car, so its apparent size never actually changes — deriving it from depth
 * bought nothing and cost the whole bottom of the frame.
 *
 * Sized against the smaller viewport axis so it stays proportionate in portrait,
 * and parked low, because that strip of frame belongs to the car and the road
 * rushing under it.
 */
const CAR_WIDTH_RATIO = 0.16;
const CAR_ASPECT = 1.5;
const CAR_SCREEN_Y_RATIO = 0.8;

function poolSegment(pool: ProjectedSegment[], index: number): ProjectedSegment {
  const existing = pool[index];
  if (existing) return existing;

  const segment: ProjectedSegment = {
    s: 0,
    curvature: 0,
    nearY: 0,
    farY: 0,
    nearCentreX: 0,
    farCentreX: 0,
    nearHalfWidth: 0,
    farHalfWidth: 0,
  };
  pool.push(segment);
  return segment;
}

export function cameraSystem(world: World): void {
  const { car, track, viewport, projection, config } = world;
  const halfW = viewport.width / 2;
  const halfH = viewport.height / 2;

  projection.horizonY = viewport.horizonY;

  let count = 0;
  const cameraS = car.s - CAMERA_BEHIND_METRES;
  const startSegment = segmentAt(track, cameraS) ?? segmentAt(track, car.s);

  if (startSegment) {
    const segments = track.segments;
    const startIndex = segments.indexOf(startSegment);
    const horizonS = car.s + config.road.horizonMetres;

    // Curvature integrates twice: once into a rate, once into an offset. That
    // second integration is what makes a constant-curvature run of segments
    // bend rather than shear.
    let dxRate = 0;
    let curveOffset = 0;
    let prevNearY = Number.POSITIVE_INFINITY;

    for (let i = startIndex; i < segments.length; i++) {
      const seg = segments[i]!;
      if (seg.s >= horizonS) break;

      const nearS = Math.max(seg.s, cameraS);
      const farS = seg.s + seg.length;

      const nearOffset = curveOffset;
      dxRate += seg.curvature * seg.length * CURVE_SCREEN_GAIN;
      curveOffset += dxRate;
      const farOffset = curveOffset;

      const nearDz = Math.max(nearS - cameraS, MIN_DZ_METRES) / METRES_PER_LANE_UNIT;
      const farDz = Math.max(farS - cameraS, MIN_DZ_METRES) / METRES_PER_LANE_UNIT;
      const nearScale = config.camera.depth / nearDz;
      const farScale = config.camera.depth / farDz;

      const nearY = viewport.horizonY + nearScale * config.camera.height * halfH;
      const farY = viewport.horizonY + farScale * config.camera.height * halfH;

      // Segments have collapsed into sub-pixel slivers; the rest of the horizon
      // would cost work and draw nothing.
      if (farY >= prevNearY) break;

      const target = poolSegment(projection.segments, count);
      target.s = seg.s;
      target.curvature = seg.curvature;
      target.nearY = nearY;
      target.farY = farY;
      target.nearCentreX = halfW + (nearOffset - car.x) * nearScale * halfW;
      target.farCentreX = halfW + (farOffset - car.x) * farScale * halfW;
      target.nearHalfWidth = config.road.halfWidth * nearScale * halfW;
      target.farHalfWidth = config.road.halfWidth * farScale * halfW;

      prevNearY = nearY;
      count++;
    }
  }

  projection.count = count;

  // The car is always at screen centre: the world slides under it, the camera
  // never chases it. Lateral movement is expressed by the road sliding beneath,
  // which is what makes the swing readable — a car that moved across a static
  // road would read as the camera turning instead.
  const shortAxis = Math.min(viewport.width, viewport.height);
  projection.carScreenX = halfW;
  projection.carScreenY = viewport.height * CAR_SCREEN_Y_RATIO;
  projection.carScreenWidth = shortAxis * CAR_WIDTH_RATIO;
  projection.carScreenHeight = projection.carScreenWidth * CAR_ASPECT;
}

/**
 * Screen position and scale at an arbitrary `s`, interpolated between the two
 * projected segments that straddle it. Null when `s` is outside the projected
 * range — anything that far off is not on screen and should not be drawn.
 *
 * Shared by every object that lives at a point on the road: posts, obstacles,
 * anchors, and the rope's far end.
 */
export interface ProjectedPoint {
  y: number;
  centreX: number;
  halfWidth: number;
}

export function projectAtS(world: World, s: number): ProjectedPoint | null {
  const { segments, count } = world.projection;
  if (count < 2) return null;

  for (let i = 0; i < count - 1; i++) {
    const seg = segments[i]!;
    const next = segments[i + 1]!;
    if (s >= seg.s && s < next.s) {
      const span = next.s - seg.s;
      const t = span > 0 ? (s - seg.s) / span : 0;
      return {
        y: seg.nearY + (seg.farY - seg.nearY) * t,
        centreX: seg.nearCentreX + (seg.farCentreX - seg.nearCentreX) * t,
        halfWidth: seg.nearHalfWidth + (seg.farHalfWidth - seg.nearHalfWidth) * t,
      };
    }
  }
  return null;
}

/** Screen x for a lateral world position, in lane units, at a projected point. */
export function screenXAt(point: ProjectedPoint, x: number, roadHalfWidth: number): number {
  return point.centreX + (x / roadHalfWidth) * point.halfWidth;
}
