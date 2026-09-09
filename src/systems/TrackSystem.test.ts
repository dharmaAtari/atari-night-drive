import { describe, it, expect } from 'vitest';
import { createWorld } from '../world';
import type { GameConfigFile } from '../config';
import { createTrackSystem, debugPresetCurvature } from './TrackSystem';

function makeConfig(): GameConfigFile {
  return {
    display: { scaleMode: 'RESIZE', fullscreen: false, maxDevicePixelRatio: 2, portraitBreakpoint: 1 },
    input: { edgeGuardPx: 24, gamepad: true },
    performance: { targetFps: 60 },
    lanes: { count: 3, width: 1 },
    road: { halfWidth: 1.5, horizonMetres: 300, tailMetres: 10, segmentLength: 5, postSpacing: 12 },
    camera: { height: 1, depth: 1 },
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
      weights: { stalled: 4, barrier: 2, pothole: 2, pedestrian: 1, debris: 3 },
      pickupChance: { power: 0.18, highBeam: 0.08 },
    },
    light: {
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
    audio: {},
    debug: { autoCentre: false, showSeed: false },
  };
}

describe('trackSystem', () => {
  it('keeps a sorted, gap-free, non-overlapping ring covering [s - tail, s + horizon]', () => {
    const world = createWorld(makeConfig());
    world.car.speed = 30;
    const system = createTrackSystem();
    const dt = 1 / 60;

    for (let i = 0; i < 600; i++) {
      system(world, dt);
    }

    const { segments } = world.track;
    const { road } = world.config;
    const { car } = world;

    expect(segments.length).toBeGreaterThan(0);

    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].s).toBe(segments[i - 1].s + segments[i - 1].length);
    }

    expect(segments[0].s).toBeLessThanOrEqual(car.s - road.tailMetres);
    const last = segments[segments.length - 1];
    expect(last.s + last.length).toBeGreaterThanOrEqual(car.s + road.horizonMetres);

    const bound = (road.tailMetres + road.horizonMetres) / road.segmentLength + 3;
    expect(segments.length).toBeLessThanOrEqual(bound);
  });

  it('maintains posts sorted by s, spaced by postSpacing, both sides, none behind the tail', () => {
    const world = createWorld(makeConfig());
    world.car.speed = 30;
    const system = createTrackSystem();
    const dt = 1 / 60;

    for (let i = 0; i < 600; i++) {
      system(world, dt);
    }

    const { posts } = world;
    const { road } = world.config;
    const { car } = world;
    const tailEdge = car.s - road.tailMetres;

    expect(posts.length).toBeGreaterThan(0);

    for (let i = 1; i < posts.length; i++) {
      expect(posts[i].s).toBeGreaterThanOrEqual(posts[i - 1].s);
    }

    for (const post of posts) {
      expect(post.s).toBeGreaterThanOrEqual(tailEdge);
    }

    const distinctS = Array.from(new Set(posts.map((p) => p.s))).sort((a, b) => a - b);
    for (let i = 1; i < distinctS.length; i++) {
      expect(distinctS[i] - distinctS[i - 1]).toBeCloseTo(road.postSpacing, 9);
    }

    const offset = road.halfWidth + 0.2;
    for (const s of distinctS) {
      const atS = posts.filter((p) => p.s === s);
      expect(atS.some((p) => p.x === offset)).toBe(true);
      expect(atS.some((p) => p.x === -offset)).toBe(true);
    }
  });
});

describe('debugPresetCurvature', () => {
  it('returns 0 at s=100, -slight at s=230, +sharp at s=420, and repeats with the loop period', () => {
    const config = makeConfig();
    const period = 200 + 60 + 100 + 120 + 200;

    expect(debugPresetCurvature(100, config)).toBe(0);
    expect(debugPresetCurvature(230, config)).toBe(-config.curves.slight);
    expect(debugPresetCurvature(420, config)).toBe(config.curves.sharp);

    expect(debugPresetCurvature(100 + period, config)).toBe(0);
    expect(debugPresetCurvature(230 + period, config)).toBe(-config.curves.slight);
    expect(debugPresetCurvature(420 + period, config)).toBe(config.curves.sharp);
  });
});
