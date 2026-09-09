/**
 * The world — every piece of gameplay state that is not a visible object.
 *
 * Components describe things you can see: where they are, what texture they
 * wear, what they collide as. None of that fits the road's curvature, the
 * headlight meter or the rope's state machine, so those live here instead, in
 * one plain object the scene owns and hands to systems.
 *
 * The rule that keeps this honest: **nothing in this file imports Phaser.** The
 * world is metres and seconds, never pixels or textures. `CameraSystem` is the
 * single place the two meet, and it writes its output into `Projection` for the
 * view systems to read. That is what lets the whole rule set — rope timing,
 * fairness invariants, light drain, collision — be reasoned about without a
 * canvas.
 *
 * Entities are the *views* of what is described here. An anchor is a record in
 * `anchors` plus a pooled entity carrying `Transform` + `Sprite` + `Animation`;
 * the record is the truth and the entity is how it gets drawn.
 *
 * Coordinates, used consistently throughout:
 *
 *   s   metres travelled down the road. Only ever increases within a run.
 *   x   lateral offset from the centre line, in lane units (1 lane = 1.0).
 */
import type { GameConfig } from './config.js';

// --- shared vocabulary ----------------------------------------------------

/** Which of the three lanes. The car rests in 0 and is roped to -1 or 1. */
export type Lane = -1 | 0 | 1;

/** The two lanes an anchor may stand in. The centre lane never holds one. */
export type AnchorLane = -1 | 1;

/** Unique per anchor, for the lifetime of a run. */
export type AnchorId = number;

// --- the road -------------------------------------------------------------

/** `segmentLength` metres of constant curvature. */
export interface TrackSegment {
  s: number;
  length: number;
  /** signed bend per metre; negative is left */
  curvature: number;
}

/**
 * A rolling window of segments around the car — generated ahead, retired
 * behind, so an endless road never grows an endless array.
 */
export interface Track {
  segments: TrackSegment[];
}

/** Unlit scenery post streaming past, so lit anchors read as "one of these, but special". */
export interface ReflectorPost {
  s: number;
  x: number;
}

// --- the car --------------------------------------------------------------

export interface Car {
  /** metres travelled */
  s: number;
  /** lateral offset from centre, in lane units */
  x: number;
  /** metres per second */
  speed: number;
  /** body tilt while roped; presentation only, never read by collision */
  lean: Lane;
}

// --- the rope, the one verb -----------------------------------------------

/**
 *   idle       nothing thrown. A press throws, or misses into cooldown.
 *   throwing   the brief travel before it bites. Auto-advances to attached.
 *   attached   the car is pulled to the anchor's lane for as long as it is held.
 *   returning  released; easing back to centre. A press can re-throw from here.
 *   cooldown   a miss. Nothing throwable until the timer runs out.
 *   snapped    held past maxExtent. Terminal — CollisionSystem ends the run.
 */
export const RopeState = {
  IDLE: 'idle',
  THROWING: 'throwing',
  ATTACHED: 'attached',
  RETURNING: 'returning',
  COOLDOWN: 'cooldown',
  SNAPPED: 'snapped',
} as const;

export type RopeStateValue = (typeof RopeState)[keyof typeof RopeState];

export interface Rope {
  state: RopeStateValue;
  /**
   * Referenced by id rather than by object, so an anchor recycled out from
   * under the rope leaves no dangling pointer — the system resolves the id each
   * frame and treats "gone" as a detach.
   */
  anchorId: AnchorId | null;
  /** seconds left in whichever state is counting down */
  timer: number;
  /** current rope length, in lane units */
  extent: number;
  /** extent / maxExtent, clamped — the snap warning the renderer and audio read */
  tension: number;
}

// --- anchors --------------------------------------------------------------

export const AnchorState = {
  /** in the world, not yet throwable */
  DORMANT: 'dormant',
  /** throw window open — pulsing, the brightest thing after the headlight cone */
  OPEN: 'open',
  /** the rope is on it */
  ATTACHED: 'attached',
  /** window closed or released; no longer a candidate */
  PASSED: 'passed',
} as const;

export type AnchorStateValue = (typeof AnchorState)[keyof typeof AnchorState];

/**
 * Pickups are anchors because space is the only input: a pickup that had to be
 * steered into would need a second button. Roping one both swings the car and
 * collects it, which is the game's whole strategic layer at zero button cost.
 */
export const AnchorKind = {
  SAFE: 'safe',
  POWER: 'power',
  HIGH_BEAM: 'highBeam',
} as const;

export type AnchorKindValue = (typeof AnchorKind)[keyof typeof AnchorKind];

export interface Anchor {
  id: AnchorId;
  s: number;
  lane: AnchorLane;
  kind: AnchorKindValue;
  /** car.s at which the throw window opens and the post starts pulsing */
  windowOpenS: number;
  /** car.s after which throwing would land too late to clear the hazard */
  windowCloseS: number;
  state: AnchorStateValue;
}

export function createAnchor(
  id: AnchorId,
  s: number,
  lane: AnchorLane,
  kind: AnchorKindValue,
  windowOpenS: number,
  windowCloseS: number,
): Anchor {
  return { id, s, lane, kind, windowOpenS, windowCloseS, state: AnchorState.DORMANT };
}

// --- hazards --------------------------------------------------------------

export const ObstacleKind = {
  STALLED: 'stalled',
  BARRIER: 'barrier',
  POTHOLE: 'pothole',
  PEDESTRIAN: 'pedestrian',
  DEBRIS: 'debris',
} as const;

export type ObstacleKindValue = (typeof ObstacleKind)[keyof typeof ObstacleKind];

/** No 180-degree switchbacks, by design. */
export const CurveKind = {
  SLIGHT_LEFT: 'slightL',
  SLIGHT_RIGHT: 'slightR',
  SHARP_LEFT: 'sharpL',
  SHARP_RIGHT: 'sharpR',
} as const;

export type CurveKindValue = (typeof CurveKind)[keyof typeof CurveKind];

/** Occupies one or two lanes. Never all three — an unavoidable hazard is a bug. */
export interface Obstacle {
  kind: 'obstacle';
  s: number;
  length: number;
  lanes: Lane[];
  obstacle: ObstacleKindValue;
}

/** A curve is a hazard, not scenery: the rope is how you take a corner. */
export interface CurveHazard {
  kind: 'curve';
  s: number;
  length: number;
  curve: CurveKindValue;
  curvature: number;
}

export type Hazard = Obstacle | CurveHazard;

/** The lanes a hazard blocks — empty for curves, so callers can always iterate. */
export function hazardLanes(hazard: Hazard): Lane[] {
  return hazard.kind === 'obstacle' ? hazard.lanes : [];
}

// --- light ----------------------------------------------------------------

/**
 * How far ahead the player can see, which is also how hard the game is.
 *
 * Because visibility decides how early a hazard resolves out of the dark, this
 * is simultaneously the atmosphere system and the difficulty system. Draining
 * power makes the game *later*, never impossible — the reaction window has a
 * floor that low power cannot push below. Protect that floor.
 */
export interface Light {
  /** headlight power, 0..1. Drains with time and distance; never self-refills. */
  power: number;
  /** high beam charge, 0..1 */
  highBeam: number;
  highBeamActive: boolean;
}

// --- the run --------------------------------------------------------------

export const RunState = {
  RUNNING: 'running',
  /** the impact beat — shake, engine cut, no input accepted */
  CRASHING: 'crashing',
  /** score on screen, waiting for a press to restart */
  OVER: 'over',
} as const;

export type RunStateValue = (typeof RunState)[keyof typeof RunState];

/** What ended the run. Each is a different lesson and a different sound. */
export const CrashCause = {
  /** rope thrown too late, released too early, or never thrown */
  OBSTACLE: 'obstacle',
  /** a curve taken without roping it */
  OFF_ROAD: 'offRoad',
  /** held past the rope's maximum extent */
  SNAP: 'snap',
} as const;

export type CrashCauseValue = (typeof CrashCause)[keyof typeof CrashCause];

export const GameEvent = {
  ROPE_THROWN: 'ropeThrown',
  ROPE_ATTACHED: 'ropeAttached',
  ROPE_MISSED: 'ropeMissed',
  ROPE_SNAPPED: 'ropeSnapped',
  PICKUP_POWER: 'pickupPower',
  PICKUP_HIGH_BEAM: 'pickupHighBeam',
  CRASHED: 'crashed',
} as const;

export type GameEventValue = (typeof GameEvent)[keyof typeof GameEvent];

/**
 * One thing that happened this frame. Optional fields rather than a union, so
 * the queue stays a plain array a system can filter without narrowing at every
 * call site.
 */
export interface RunEvent {
  type: GameEventValue;
  anchorId?: AnchorId;
  cause?: CrashCauseValue;
}

export interface Run {
  state: RunStateValue;
  /** seconds survived — also the score, at 1 point per second */
  elapsed: number;
  /** best this session, persisted to localStorage */
  best: number;
  /** seconds left in the impact beat before the run reads as over */
  crashTimer: number;
  /** the seed this run's hazards were generated from */
  seed: number;
}

// --- projection: the one place metres become pixels -----------------------

/** One road segment as a trapezium, already in pixels. */
export interface ProjectedSegment {
  s: number;
  curvature: number;
  /** screen y of the near edge; larger is further down the screen */
  nearY: number;
  farY: number;
  nearCentreX: number;
  farCentreX: number;
  nearHalfWidth: number;
  farHalfWidth: number;
}

/**
 * Pooled: `CameraSystem` reuses the segment objects and moves `count` rather
 * than reallocating every frame. Read `count`, never `segments.length`.
 */
export interface Projection {
  segments: ProjectedSegment[];
  count: number;
  horizonY: number;
  carScreenX: number;
  carScreenY: number;
  carScreenWidth: number;
  carScreenHeight: number;
}

/** Canvas measurements, refreshed on resize. Pixels, not metres. */
export interface Viewport {
  width: number;
  height: number;
  /** portrait moves the score to top-centre and lifts the horizon */
  portrait: boolean;
  horizonY: number;
}

// --- the world ------------------------------------------------------------

export interface World {
  config: GameConfig;
  viewport: Viewport;
  car: Car;
  track: Track;
  posts: ReflectorPost[];
  anchors: Anchor[];
  hazards: Hazard[];
  rope: Rope;
  light: Light;
  run: Run;
  projection: Projection;
  /** raised this frame, cleared at the end of it — a queue, not a log */
  events: RunEvent[];
  nextAnchorId: AnchorId;
}

export function createWorld(config: GameConfig): World {
  return {
    config,
    viewport: { width: 0, height: 0, portrait: false, horizonY: 0 },
    car: { s: 0, x: 0, speed: config.speed.start, lean: 0 },
    track: { segments: [] },
    posts: [],
    anchors: [],
    hazards: [],
    rope: { state: RopeState.IDLE, anchorId: null, timer: 0, extent: 0, tension: 0 },
    light: { power: config.light.startPower, highBeam: 0, highBeamActive: false },
    run: { state: RunState.RUNNING, elapsed: 0, best: 0, crashTimer: 0, seed: 0 },
    projection: {
      segments: [],
      count: 0,
      horizonY: 0,
      carScreenX: 0,
      carScreenY: 0,
      carScreenWidth: 0,
      carScreenHeight: 0,
    },
    events: [],
    nextAnchorId: 1,
  };
}

/**
 * Returns the world to the start of a run in place, keeping `best`, the
 * viewport and the pooled arrays. Restart is immediate and from the beginning —
 * no lives, no checkpoints — so this is the whole of it.
 */
export function resetRun(world: World, seed: number): void {
  const { config } = world;

  world.car.s = 0;
  world.car.x = 0;
  world.car.speed = config.speed.start;
  world.car.lean = 0;

  world.track.segments.length = 0;
  world.posts.length = 0;
  world.anchors.length = 0;
  world.hazards.length = 0;
  world.projection.count = 0;
  world.events.length = 0;

  world.rope.state = RopeState.IDLE;
  world.rope.anchorId = null;
  world.rope.timer = 0;
  world.rope.extent = 0;
  world.rope.tension = 0;

  world.light.power = config.light.startPower;
  world.light.highBeam = 0;
  world.light.highBeamActive = false;

  world.run.state = RunState.RUNNING;
  world.run.elapsed = 0;
  world.run.crashTimer = 0;
  world.run.seed = seed;

  world.nextAnchorId = 1;
}

/** The segment containing `s`, or null if it falls outside the live window. */
export function segmentAt(track: Track, s: number): TrackSegment | null {
  const { segments } = track;
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid]!;
    if (s < seg.s) hi = mid - 1;
    else if (s >= seg.s + seg.length) lo = mid + 1;
    else return seg;
  }
  return null;
}

/** Curvature at `s`, treating anything off the live window as straight. */
export function curvatureAt(track: Track, s: number): number {
  return segmentAt(track, s)?.curvature ?? 0;
}
