/**
 * Loads and parses `public/config.json` into a typed object.
 *
 * Everything tunable at run time lives in that file. It ships as a static file
 * under `public/`, so it can be edited in a deployed build without a rebuild —
 * which is also why every field is defaulted here rather than trusted. A
 * hand-edited config with a missing key or a string where a number belongs
 * falls back to a playable value instead of crashing the boot.
 *
 * The defaults in this file are the contract: `config.json` may override any of
 * them, but deleting the file entirely would still produce a running game.
 *
 * Asset paths are the one thing that cannot be defaulted usefully — a sprite key
 * with no file is a missing texture — so `assets` starts empty and only what the
 * file lists gets loaded.
 */
import Phaser from 'phaser';

/** Scale mode names allowed in config.json -> Phaser.Scale constants. */
const SCALE_MODES = {
  fit: Phaser.Scale.FIT,
  envelop: Phaser.Scale.ENVELOP,
  resize: Phaser.Scale.RESIZE,
  none: Phaser.Scale.NONE,
} as const;

export type ScaleModeName = keyof typeof SCALE_MODES;

export interface DisplayConfig {
  width: number;
  height: number;
  scaleMode: Phaser.Scale.ScaleModeType;
  autoCenter: boolean;
  fullscreen: boolean;
  backgroundColor: string;
  pixelArt: boolean;
  /** cap on devicePixelRatio, so a 3x phone does not render 9x the pixels */
  maxDevicePixelRatio: number;
  /** width/height below this counts as portrait and moves the HUD */
  portraitBreakpoint: number;
}

export interface PerformanceConfig {
  targetFps: number;
}

export interface InputConfig {
  /** dead strip on the left edge, so a back-swipe is not read as a rope throw */
  edgeGuardPx: number;
  gamepad: boolean;
}

/** One SVG loaded into one texture. `scale` picks the rasterisation size. */
export interface SpriteAsset {
  file: string;
  scale: number;
}

/**
 * One SVG strip sliced into frames after load. The strip is authored as N cells
 * side by side in a single file, so frame width is the rasterised width divided
 * by `frameCount` — see `BootScene`.
 */
export interface AnimationAsset {
  file: string;
  scale: number;
  frameCount: number;
  frameRate: number;
  loop: boolean;
}

export interface AssetsConfig {
  /** logical key -> the SVG behind it */
  sprites: Record<string, SpriteAsset>;
  /** logical key -> the strip behind it, plus its playback defaults */
  animations: Record<string, AnimationAsset>;
}

export interface AudioConfig {
  volume: number;
  /**
   * logical sound key ('rope.throw') -> file path under public/, like sprites.
   * Systems ask for sounds by key only, so a re-voice is a config edit.
   */
  sounds: Record<string, string>;
}

export interface LanesConfig {
  count: number;
  /** one lane, in lane units. 1 by definition; here so the maths can be read. */
  width: number;
}

export interface RoadConfig {
  /**
   * Half the drivable surface, in lane units. Deliberately wider than the lanes
   * it carries (`lanes.count * lanes.width / 2` = 1.5): the surplus is shoulder,
   * and it is what stops a car roped out to an outer lane from looking like it
   * is riding the edge. Every view that reads this divides by it, so widening
   * the road widens the ribbon without touching lane width.
   *
   * It is also the off-road kill line — see `carIsOffRoad` — so the shoulder is
   * the margin a roped swing has before the run ends. Do not shrink it to 1.5.
   */
  halfWidth: number;
  /** How far past the road edge an anchor post stands, in lane units. */
  anchorOffset: number;
  horizonMetres: number;
  tailMetres: number;
  segmentLength: number;
  postSpacing: number;
}

export interface CameraConfig {
  height: number;
  depth: number;
}

export interface SpeedConfig {
  start: number;
  /** seconds to reach the cap, which is always 3x start */
  rampSeconds: number;
}

export interface RopeConfig {
  baseRange: number;
  /** the reaction-window floor, in seconds. Never let speed push below this. */
  floorSeconds: number;
  closeMargin: number;
  maxExtent: number;
  throwDuration: number;
  pullDuration: number;
  returnDuration: number;
  missCooldown: number;
  holdMin: number;
}

export interface CurvesConfig {
  slight: number;
  sharp: number;
  slightLength: number;
  sharpLength: number;
}

export interface HazardsConfig {
  spawnLeadSeconds: number;
  minIntervalSeconds: number;
  maxIntervalSeconds: number;
  comboThreshold: number;
  curveChance: number;
  comboChance: number;
  leadMargin: number;
  densityCapDifficulty: number;
  weights: Record<string, number>;
  pickupChance: { power: number; highBeam: number };
}

export interface LightConfig {
  startPower: number;
  minCone: number;
  maxCone: number;
  highBeamCone: number;
  fadeMetres: number;
  anchorGlowFactor: number;
  drainPerSecond: number;
  drainPerMetre: number;
  powerPickup: number;
  highBeamDrainPerSecond: number;
}

export interface StartConfig {
  /** the 3-2-1 before a run, in seconds. 0 skips it. */
  countdownSeconds: number;
}

export interface GameConfig {
  display: DisplayConfig;
  performance: PerformanceConfig;
  input: InputConfig;
  assets: AssetsConfig;
  audio: AudioConfig;
  lanes: LanesConfig;
  road: RoadConfig;
  camera: CameraConfig;
  drift: { gain: number };
  speed: SpeedConfig;
  rope: RopeConfig;
  curves: CurvesConfig;
  hazards: HazardsConfig;
  light: LightConfig;
  start: StartConfig;
  score: { pointsPerSecond: number };
  fail: { impactSeconds: number };
  debug: { autoCentre: boolean; showSeed: boolean };
}

/** Shape of the raw file, where anything may be missing or the wrong type. */
type Raw = Record<string, unknown>;

function obj(value: unknown): Raw {
  return typeof value === 'object' && value !== null ? (value as Raw) : {};
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value : fallback;
}

function scaleMode(value: unknown): Phaser.Scale.ScaleModeType {
  const name = typeof value === 'string' ? (value.toLowerCase() as ScaleModeName) : 'resize';
  return SCALE_MODES[name] ?? SCALE_MODES.resize;
}

/** Numeric map with unknown keys, e.g. the obstacle spawn weights. */
function numberMap(value: unknown, fallback: Record<string, number>): Record<string, number> {
  const raw = obj(value);
  const entries = Object.entries(raw).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
  );
  return entries.length > 0 ? Object.fromEntries(entries) : fallback;
}

function stringMap(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj(value)).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

/**
 * A sprite entry may be written as a bare path string or as `{ file, scale }`.
 * The string form is the common case and stays readable in the config; the
 * object form exists because the cone and the car want a bigger rasterisation
 * than a lane dash does.
 */
function spriteMap(value: unknown): Record<string, SpriteAsset> {
  const out: Record<string, SpriteAsset> = {};
  for (const [key, entry] of Object.entries(obj(value))) {
    if (typeof entry === 'string') {
      out[key] = { file: entry, scale: 1 };
      continue;
    }
    const record = obj(entry);
    const file = str(record.file, '');
    if (file !== '') out[key] = { file, scale: Math.max(0.01, num(record.scale, 1)) };
  }
  return out;
}

function animationMap(value: unknown): Record<string, AnimationAsset> {
  const out: Record<string, AnimationAsset> = {};
  for (const [key, entry] of Object.entries(obj(value))) {
    const record = obj(entry);
    const file = str(record.file, '');
    if (file === '') continue;
    out[key] = {
      file,
      scale: Math.max(0.01, num(record.scale, 1)),
      // A zero-frame sheet would divide by zero when slicing; one frame is a
      // legal still image and the safest floor.
      frameCount: Math.max(1, Math.floor(num(record.frameCount, 1))),
      frameRate: Math.max(0, num(record.frameRate, 12)),
      loop: bool(record.loop, true),
    };
  }
  return out;
}

export async function loadConfig(
  path = `${import.meta.env.BASE_URL}config.json`,
): Promise<GameConfig> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path} (HTTP ${response.status})`);
  }

  const raw = obj(await response.json());
  const display = obj(raw.display);
  const performance = obj(raw.performance);
  const input = obj(raw.input);
  const assets = obj(raw.assets);
  const audio = obj(raw.audio);
  const lanes = obj(raw.lanes);
  const road = obj(raw.road);
  const camera = obj(raw.camera);
  const drift = obj(raw.drift);
  const speed = obj(raw.speed);
  const rope = obj(raw.rope);
  const curves = obj(raw.curves);
  const hazards = obj(raw.hazards);
  const pickupChance = obj(hazards.pickupChance);
  const light = obj(raw.light);
  const start = obj(raw.start);
  const score = obj(raw.score);
  const fail = obj(raw.fail);
  const debug = obj(raw.debug);

  return {
    display: {
      width: num(display.width, 960),
      height: num(display.height, 540),
      scaleMode: scaleMode(display.scaleMode),
      autoCenter: bool(display.autoCenter, true),
      fullscreen: bool(display.fullscreen, false),
      backgroundColor: str(display.backgroundColor, '#04050a'),
      pixelArt: bool(display.pixelArt, false),
      maxDevicePixelRatio: num(display.maxDevicePixelRatio, 2),
      portraitBreakpoint: num(display.portraitBreakpoint, 1),
    },
    performance: { targetFps: num(performance.targetFps, 60) },
    input: {
      edgeGuardPx: num(input.edgeGuardPx, 24),
      gamepad: bool(input.gamepad, true),
    },
    assets: {
      sprites: spriteMap(assets.sprites),
      animations: animationMap(assets.animations),
    },
    audio: {
      volume: num(audio.volume, 1),
      sounds: stringMap(audio.sounds),
    },
    lanes: {
      count: num(lanes.count, 3),
      width: num(lanes.width, 1),
    },
    road: {
      halfWidth: num(road.halfWidth, 1.8),
      anchorOffset: num(road.anchorOffset, 0.06),
      horizonMetres: num(road.horizonMetres, 300),
      tailMetres: num(road.tailMetres, 10),
      segmentLength: num(road.segmentLength, 5),
      postSpacing: num(road.postSpacing, 12),
    },
    camera: {
      height: num(camera.height, 1.2),
      depth: num(camera.depth, 0.84),
    },
    drift: { gain: num(drift.gain, 1) },
    speed: {
      start: num(speed.start, 30),
      rampSeconds: num(speed.rampSeconds, 330),
    },
    rope: {
      baseRange: num(rope.baseRange, 60),
      floorSeconds: num(rope.floorSeconds, 0.45),
      closeMargin: num(rope.closeMargin, 8),
      maxExtent: num(rope.maxExtent, 3.2),
      throwDuration: num(rope.throwDuration, 0.08),
      pullDuration: num(rope.pullDuration, 0.3),
      returnDuration: num(rope.returnDuration, 0.45),
      missCooldown: num(rope.missCooldown, 0.5),
      holdMin: num(rope.holdMin, 0.25),
    },
    curves: {
      slight: num(curves.slight, 0.004),
      sharp: num(curves.sharp, 0.012),
      slightLength: num(curves.slightLength, 60),
      sharpLength: num(curves.sharpLength, 120),
    },
    hazards: {
      spawnLeadSeconds: num(hazards.spawnLeadSeconds, 4),
      minIntervalSeconds: num(hazards.minIntervalSeconds, 1.6),
      maxIntervalSeconds: num(hazards.maxIntervalSeconds, 3.2),
      comboThreshold: num(hazards.comboThreshold, 0.6),
      curveChance: num(hazards.curveChance, 0.35),
      comboChance: num(hazards.comboChance, 0.6),
      leadMargin: num(hazards.leadMargin, 10),
      densityCapDifficulty: num(hazards.densityCapDifficulty, 1),
      weights: numberMap(hazards.weights, {
        stalled: 4,
        barrier: 2,
        pothole: 2,
        pedestrian: 1,
        debris: 3,
      }),
      pickupChance: {
        power: num(pickupChance.power, 0.18),
        highBeam: num(pickupChance.highBeam, 0.08),
      },
    },
    light: {
      startPower: num(light.startPower, 1),
      minCone: num(light.minCone, 40),
      maxCone: num(light.maxCone, 160),
      highBeamCone: num(light.highBeamCone, 260),
      fadeMetres: num(light.fadeMetres, 15),
      anchorGlowFactor: num(light.anchorGlowFactor, 1.3),
      drainPerSecond: num(light.drainPerSecond, 0.012),
      drainPerMetre: num(light.drainPerMetre, 0.0004),
      powerPickup: num(light.powerPickup, 0.35),
      highBeamDrainPerSecond: num(light.highBeamDrainPerSecond, 0.25),
    },
    start: { countdownSeconds: Math.max(0, num(start.countdownSeconds, 3)) },
    score: { pointsPerSecond: num(score.pointsPerSecond, 1) },
    fail: { impactSeconds: num(fail.impactSeconds, 0.6) },
    debug: {
      autoCentre: bool(debug.autoCentre, false),
      showSeed: bool(debug.showSeed, false),
    },
  };
}
