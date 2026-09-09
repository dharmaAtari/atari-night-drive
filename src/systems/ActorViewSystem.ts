/**
 * ActorViewSystem — places everything that stands on the road.
 *
 * Reads world records, writes `Transform` and `Sprite` on pooled entities. Every
 * pool is allocated once and reused; an entity that has nothing to show this
 * frame is deactivated rather than destroyed, so the display list never churns.
 *
 * It does not import Phaser. Sprite sizes are needed to scale art to a
 * world-derived size, so the scene hands in a lookup instead — which keeps the
 * one thing that genuinely needs the texture manager at the scene boundary.
 *
 * Two visibility rules do most of the atmospheric work:
 *
 *   obstacles fade in as they cross into the lit cone, so low power means they
 *   resolve late rather than not at all
 *
 *   anchors use the wider glow radius, so the thing the player is required to
 *   react to is always visible before the thing that would kill them
 *
 * That ordering is the fairness rule the whole design rests on, and it is
 * enforced here by giving anchors a different radius, not by hoping.
 */
import type Entity from '../entities/Entity.js';
import { ANIMATION, SHAPE, SPRITE, TRANSFORM } from '../components/index.js';
import { anchorPost } from '../entities/anchorPost.js';
import { obstacle as obstacleEntity } from '../entities/obstacle.js';
import { reflectorPost } from '../entities/reflectorPost.js';
import { car as carEntity, carRearLights, headlightCone } from '../entities/car.js';
import { ropeFlash, ropeLine } from '../entities/ropeLine.js';
import {
  AnchorKind,
  AnchorState,
  ObstacleKind,
  RunState,
  type Anchor,
  type Hazard,
  type World,
} from '../world.js';
import { coneLength, glowRadius, obstacleAlpha } from './LightSystem.js';
import { anchorX } from './AnchorSystem.js';
import { projectAtS, screenXAt } from './CameraSystem.js';
import { isRopeAttached, laneX } from './RopeSystem.js';

export type TextureSize = (key: string) => { width: number; height: number };

const MAX_POSTS = 72;
const MAX_OBSTACLES = 24;
const MAX_ANCHORS = 24;

/** On-screen heights, as a fraction of the road's projected half-width. */
const POST_HEIGHT_RATIO = 0.1;
const ANCHOR_HEIGHT_RATIO = 0.34;

/** How fast an open anchor pulses, in cycles per second. The tutorial. */
const ANCHOR_PULSE_HZ = 3;

/** Attach/snap burst width, as a fraction of the road's half-width where it lands. */
const FLASH_WIDTH_RATIO = 0.5;

const ROPE_COLOR = 0xd8d8d8;
const ROPE_WARNING_COLOR = 0xff5a1f;
/** Tension below this draws a calm rope; above it the warning ramps in. */
const ROPE_TENSION_WARN = 0.6;

/** Which texture draws which obstacle. */
const OBSTACLE_TEXTURE: Record<string, string> = {
  [ObstacleKind.STALLED]: 'obstacle.stalled',
  [ObstacleKind.BARRIER]: 'obstacle.barrier',
  [ObstacleKind.POTHOLE]: 'obstacle.pothole',
  [ObstacleKind.DEBRIS]: 'obstacle.debris',
  [ObstacleKind.PEDESTRIAN]: 'obstacle.pedestrianWalk',
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: number, b: number, t: number): number {
  const r = Math.round(lerp((a >> 16) & 0xff, (b >> 16) & 0xff, t));
  const g = Math.round(lerp((a >> 8) & 0xff, (b >> 8) & 0xff, t));
  const bl = Math.round(lerp(a & 0xff, b & 0xff, t));
  return (r << 16) | (g << 8) | bl;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export default class ActorViewSystem {
  private readonly posts: Entity[] = [];
  private readonly obstacles: Entity[] = [];
  private readonly anchors: Entity[] = [];
  readonly car = carEntity();
  private readonly rearLights = carRearLights();
  private readonly cone = headlightCone();
  private readonly rope = ropeLine();
  private readonly flash = ropeFlash();

  private flashTimer = 0;

  constructor(private readonly textureSize: TextureSize) {
    for (let i = 0; i < MAX_POSTS; i++) this.posts.push(reflectorPost(i));
    for (let i = 0; i < MAX_OBSTACLES; i++) this.obstacles.push(obstacleEntity(i));
    for (let i = 0; i < MAX_ANCHORS; i++) this.anchors.push(anchorPost(i));
  }

  entities(): Entity[] {
    return [
      ...this.posts,
      ...this.obstacles,
      ...this.anchors,
      this.cone,
      this.rope,
      this.flash,
      this.car,
      this.rearLights,
    ];
  }

  update(world: World, dt: number): void {
    this.placePosts(world);
    this.placeObstacles(world);
    this.placeAnchors(world);
    this.placeCar(world);
    this.placeRope(world);
    this.placeFlash(world, dt);
  }

  // --- scenery ------------------------------------------------------------

  private placePosts(world: World): void {
    const { posts, config } = world;
    let used = 0;

    for (const post of posts) {
      if (used >= this.posts.length) break;
      const point = projectAtS(world, post.s);
      if (!point) continue;

      const entity = this.posts[used]!;
      const height = point.halfWidth * POST_HEIGHT_RATIO;
      this.place(entity, screenXAt(point, post.x, config.road.halfWidth), point.y, height, 'road.reflectorPost');

      const sprite = entity.get(SPRITE)!;
      // Posts are unlit, so they fade with the road rather than staying legible
      // the way an anchor does. They are a speed cue, not information.
      sprite.alpha = clamp01(obstacleAlpha(config, world.light, post.s - world.car.s)) * 0.8;
      sprite.visible = sprite.alpha > 0.02;
      entity.active = true;
      used++;
    }

    this.deactivate(this.posts, used);
  }

  // --- hazards ------------------------------------------------------------

  private placeObstacles(world: World): void {
    const { hazards, config, light, car } = world;
    let used = 0;

    for (const hazard of hazards) {
      if (hazard.kind !== 'obstacle') continue;
      const point = projectAtS(world, hazard.s + hazard.length / 2);
      if (!point) continue;

      const alpha = obstacleAlpha(config, light, hazard.s - car.s);
      if (alpha <= 0.02) continue;

      for (const lane of hazard.lanes) {
        if (used >= this.obstacles.length) break;
        const entity = this.obstacles[used]!;
        const texture = OBSTACLE_TEXTURE[hazard.obstacle] ?? 'obstacle.stalled';

        // One lane wide on screen, whatever the distance.
        const width = (config.lanes.width / config.road.halfWidth) * point.halfWidth;
        this.placeByWidth(entity, screenXAt(point, laneX(lane, config.lanes.width), config.road.halfWidth), point.y, width, texture);

        const sprite = entity.get(SPRITE)!;
        sprite.alpha = alpha;
        sprite.visible = true;
        entity.active = true;

        this.syncObstacleAnimation(entity, hazard);
        used++;
      }
    }

    this.deactivate(this.obstacles, used);
  }

  /**
   * Only the pedestrian actually animates. The rest park on frame 0 with the
   * component stopped, which costs nothing — `AnimationSystem` steps only what
   * is playing — and means the walk cycle needs no special-casing elsewhere.
   */
  private syncObstacleAnimation(entity: Entity, hazard: Hazard): void {
    const animation = entity.get(ANIMATION);
    const sprite = entity.get(SPRITE);
    if (!animation || !sprite) return;

    const walking = hazard.kind === 'obstacle' && hazard.obstacle === ObstacleKind.PEDESTRIAN;

    if (!walking) {
      animation.playing = false;
      animation.currentFrame = 0;
      sprite.frame = 0;
      return;
    }

    if (animation.frameCount !== 4) {
      animation.frameCount = 4;
      animation.frameRate = 8;
      animation.loop = true;
      animation.currentFrame = 0;
      animation.elapsed = 0;
      animation.animationEnded = false;
    }
    animation.playing = true;
    sprite.frame = animation.currentFrame;
  }

  // --- anchors ------------------------------------------------------------

  private placeAnchors(world: World): void {
    const { anchors, config, light, car } = world;
    const glow = glowRadius(config, light, car.speed);
    let used = 0;

    for (const anchor of anchors) {
      if (used >= this.anchors.length) break;
      if (anchor.state === AnchorState.PASSED) continue;

      const point = projectAtS(world, anchor.s);
      if (!point) continue;

      const distance = anchor.s - car.s;
      // Anchors read out to the glow radius, which is deliberately wider than
      // the obstacle cone: the warning must arrive before the thing it warns of.
      if (distance > glow) continue;

      const entity = this.anchors[used]!;
      const pulse = 0.5 + 0.5 * Math.sin(world.run.elapsed * ANCHOR_PULSE_HZ * Math.PI * 2);
      const open = anchor.state === AnchorState.OPEN;
      const grow = open ? 1 + 0.18 * pulse : 1;

      const height = point.halfWidth * ANCHOR_HEIGHT_RATIO * grow;
      const texture = anchorTexture(anchor);
      this.place(entity, screenXAt(point, anchorX(anchor.lane, config), config.road.halfWidth), point.y, height, texture);

      const sprite = entity.get(SPRITE)!;
      sprite.texture = texture;
      // Dormant posts sit back; an open one is the brightest thing in the frame
      // after the cone, and it pulses for exactly as long as the window is open.
      sprite.alpha = open ? 0.75 + 0.25 * pulse : 0.45;
      sprite.visible = true;
      entity.active = true;
      used++;
    }

    this.deactivate(this.anchors, used);
  }

  // --- the car ------------------------------------------------------------

  private placeCar(world: World): void {
    const { projection, car, light, config, run } = world;
    const width = projection.carScreenWidth;

    for (const entity of [this.car, this.rearLights]) {
      const transform = entity.get(TRANSFORM)!;
      const sprite = entity.get(SPRITE)!;
      const size = this.textureSize(sprite.texture);
      const scale = size.width > 0 ? width / size.width : 1;

      transform.x = projection.carScreenX;
      transform.y = projection.carScreenY;
      transform.scaleX = scale;
      transform.scaleY = scale;
      // Lean is a rotation of the existing art, not a second asset — the whole
      // animation budget here is transform-only, by design.
      transform.rotation = car.lean * 0.16;
      sprite.visible = run.state !== RunState.OVER;
      entity.active = true;
    }

    // The cone hangs off the car's nose and stretches with how far it reaches.
    const coneTransform = this.cone.get(TRANSFORM)!;
    const coneSprite = this.cone.get(SPRITE)!;
    const coneSize = this.textureSize(coneSprite.texture);
    const reach = coneLength(config, light);
    const reachT = clamp01(reach / config.light.highBeamCone);

    coneTransform.x = projection.carScreenX;
    coneTransform.y = projection.carScreenY - projection.carScreenHeight * 0.4;
    coneTransform.rotation = car.lean * 0.08;
    coneTransform.scaleX = coneSize.width > 0 ? (width * 2.6) / coneSize.width : 1;
    coneTransform.scaleY = coneSize.height > 0
      ? ((projection.carScreenY - world.viewport.horizonY) * (0.35 + 0.65 * reachT)) / coneSize.height
      : 1;
    coneSprite.alpha = light.highBeamActive ? 0.62 : 0.28 + 0.24 * clamp01(light.power);
    coneSprite.visible = run.state !== RunState.OVER;
    this.cone.active = true;
  }

  // --- the rope -----------------------------------------------------------

  private placeRope(world: World): void {
    const { rope, anchors, projection, config } = world;
    const shape = this.rope.get(SHAPE)!;

    const anchor = isRopeAttached(rope.state)
      ? anchors.find((candidate) => candidate.id === rope.anchorId)
      : undefined;
    const point = anchor ? projectAtS(world, anchor.s) : null;

    if (!anchor || !point) {
      shape.visible = false;
      return;
    }

    // Colour and thickness ramp with tension, so the snap is telegraphed. It
    // must never be the player's first warning that they held too long.
    const warn = clamp01((rope.tension - ROPE_TENSION_WARN) / (1 - ROPE_TENSION_WARN));

    shape.points = [
      { x: projection.carScreenX, y: projection.carScreenY - projection.carScreenHeight / 2 },
      { x: screenXAt(point, anchorX(anchor.lane, config), config.road.halfWidth), y: point.y },
    ];
    shape.dirty = true;
    shape.strokeColor = lerpColor(ROPE_COLOR, ROPE_WARNING_COLOR, warn);
    shape.strokeWidth = 2 + warn * 3;
    shape.visible = true;
    this.rope.active = true;
  }

  /** A one-shot burst: cyan when the rope bites, warning-coloured when it snaps. */
  private placeFlash(world: World, dt: number): void {
    const sprite = this.flash.get(SPRITE)!;
    const transform = this.flash.get(TRANSFORM)!;

    for (const event of world.events) {
      if (event.type === 'ropeAttached') {
        sprite.texture = 'rope.attachFlash';
        this.flashTimer = 0.22;
      } else if (event.type === 'ropeSnapped') {
        sprite.texture = 'rope.snap';
        this.flashTimer = 0.35;
      }
    }

    if (this.flashTimer <= 0) {
      sprite.visible = false;
      return;
    }
    this.flashTimer -= dt;

    const anchor = world.anchors.find((candidate) => candidate.id === world.rope.anchorId);
    const point = anchor ? projectAtS(world, anchor.s) : null;
    const size = this.textureSize(sprite.texture);
    // Sized from the road at the anchor's distance, not from the car. Scaling it
    // to the car made a burst that stayed the same size however far away it went
    // and buried the very post it was meant to draw the eye to.
    const target = (point ? point.halfWidth : world.projection.carScreenWidth) * FLASH_WIDTH_RATIO;
    const scale = size.width > 0 ? target / size.width : 1;

    transform.x = point
      ? screenXAt(point, anchorX(anchor!.lane, world.config), world.config.road.halfWidth)
      : world.projection.carScreenX;
    transform.y = point ? point.y : world.projection.carScreenY;
    transform.scaleX = scale;
    transform.scaleY = scale;
    sprite.alpha = clamp01(this.flashTimer * 4);
    sprite.visible = true;
    this.flash.active = true;
  }

  // --- helpers ------------------------------------------------------------

  /** Positions an entity and scales its texture to a target on-screen height. */
  private place(entity: Entity, x: number, y: number, height: number, texture: string): void {
    const transform = entity.get(TRANSFORM)!;
    const sprite = entity.get(SPRITE)!;
    sprite.texture = texture;

    const size = this.textureSize(texture);
    const scale = size.height > 0 ? height / size.height : 1;
    transform.x = x;
    transform.y = y;
    transform.scaleX = scale;
    transform.scaleY = scale;
  }

  /** As `place`, but sized by width — used where lane width sets the scale. */
  private placeByWidth(entity: Entity, x: number, y: number, width: number, texture: string): void {
    const transform = entity.get(TRANSFORM)!;
    const sprite = entity.get(SPRITE)!;
    sprite.texture = texture;

    const size = this.textureSize(texture);
    const scale = size.width > 0 ? width / size.width : 1;
    transform.x = x;
    transform.y = y;
    transform.scaleX = scale;
    transform.scaleY = scale;
  }

  private deactivate(pool: Entity[], from: number): void {
    for (let i = from; i < pool.length; i++) {
      const entity = pool[i]!;
      entity.active = false;
      const sprite = entity.get(SPRITE);
      if (sprite) sprite.visible = false;
    }
  }
}

function anchorTexture(anchor: Anchor): string {
  if (anchor.kind === AnchorKind.POWER) return 'anchor.pickupPower';
  if (anchor.kind === AnchorKind.HIGH_BEAM) return 'anchor.pickupHighBeam';
  if (anchor.state === AnchorState.ATTACHED) return 'anchor.attached';
  return anchor.state === AnchorState.OPEN ? 'anchor.open' : 'anchor.dormant';
}
