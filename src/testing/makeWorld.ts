import type { GameConfigFile } from '../config';
import type { World } from '../world';
import { createWorld } from '../world';
import type { TrackSegment } from '../components/Track';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

export function makeConfig(overrides: DeepPartial<GameConfigFile> = {}): GameConfigFile {
  const base: GameConfigFile = {
    display: { scaleMode: 'resize', fullscreen: false, maxDevicePixelRatio: 2, portraitBreakpoint: 1 },
    input: { edgeGuardPx: 24, gamepad: true },
    performance: { targetFps: 60 },
    lanes: { count: 3, width: 1 },
    road: { halfWidth: 1.5, horizonMetres: 300, tailMetres: 10, segmentLength: 5, postSpacing: 12 },
    camera: { height: 1.2, depth: 0.84 },
    drift: { gain: 1 },
    speed: { start: 30, rampSeconds: 330 },
    rope: {
      baseRange: 60,
      floorSeconds: 0.45,
      closeMargin: 8,
      maxExtent: 3.2,
      throwDuration: 0.08,
      pullDuration: 0.3,
      returnDuration: 0.45,
      missCooldown: 0.5,
      holdMin: 0.25,
    },
    curves: { slight: 0.004, sharp: 0.012, slightLength: 60, sharpLength: 120 },
    hazards: {
      spawnLeadSeconds: 4,
      minIntervalSeconds: 1.6,
      maxIntervalSeconds: 3.2,
      comboThreshold: 0.6,
      curveChance: 0.35,
      comboChance: 0.6,
      leadMargin: 10,
      densityCapDifficulty: 1,
      weights: { stalled: 4, barrier: 2, pothole: 2, pedestrian: 1, debris: 3 },
      pickupChance: { power: 0.18, highBeam: 0.08 },
    },
    light: {
      startPower: 1,
      minCone: 40,
      maxCone: 160,
      highBeamCone: 260,
      fadeMetres: 15,
      anchorGlowFactor: 1.3,
      drainPerSecond: 0.012,
      drainPerMetre: 0.0004,
      powerPickup: 0.35,
      highBeamDrainPerSecond: 0.25,
    },
    score: { pointsPerSecond: 1 },
    fail: { impactSeconds: 0.6 },
    platform: { arkadium: false },
    audio: {},
    debug: { autoCentre: false, showSeed: true },
  };
  const merged = { ...base } as GameConfigFile;
  for (const key of Object.keys(overrides) as (keyof GameConfigFile)[]) {
    const value = overrides[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(merged[key] as object, value);
    }
  }
  return merged;
}

export function makeStraightTrack(count: number, length: number, curvature = 0): TrackSegment[] {
  const segments: TrackSegment[] = [];
  for (let i = 0; i < count; i++) {
    segments.push({ s: i * length, length, curvature });
  }
  return segments;
}

export function makeWorld(
  opts: {
    config?: GameConfigFile;
    carX?: number;
    carS?: number;
    curvature?: number;
    segmentCount?: number;
    segmentLength?: number;
    viewport?: Partial<World['viewport']>;
  } = {},
): World {
  const config = opts.config ?? makeConfig();
  const world = createWorld(config);
  world.car.x = opts.carX ?? 0;
  world.car.s = opts.carS ?? 0;
  world.track.segments = makeStraightTrack(
    opts.segmentCount ?? 100,
    opts.segmentLength ?? config.road.segmentLength,
    opts.curvature ?? 0,
  );
  Object.assign(world.viewport, {
    cssWidth: 1280,
    cssHeight: 720,
    renderWidth: 1280,
    renderHeight: 720,
    dpr: 1,
    layout: 'landscape' as const,
    horizonY: 300,
  }, opts.viewport ?? {});
  return world;
}
