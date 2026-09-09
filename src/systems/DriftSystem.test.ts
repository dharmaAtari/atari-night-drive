import { describe, it, expect } from 'vitest';
import { createWorld } from '../world';
import type { GameConfigFile } from '../config';
import { driftSystem } from './DriftSystem';

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

describe('driftSystem', () => {
  it('drifts x by -curvature * speed * gain * dt', () => {
    const world = createWorld(makeConfig());
    world.car.speed = 30;
    world.car.x = 0;
    world.track.segments = [{ s: 0, length: 1000, curvature: 0.01 }];

    driftSystem(world, 1);

    expect(world.car.x).toBeCloseTo(-0.3, 9);
  });

  it('leaves x unchanged on a straight (curvature 0)', () => {
    const world = createWorld(makeConfig());
    world.car.speed = 30;
    world.car.x = 0.5;
    world.track.segments = [{ s: 0, length: 1000, curvature: 0 }];

    driftSystem(world, 1);

    expect(world.car.x).toBe(0.5);
  });

  it('autoCentre pulls x from 0.8 toward 0 monotonically', () => {
    const config = makeConfig();
    config.debug.autoCentre = true;
    const world = createWorld(config);
    world.car.x = 0.8;
    world.track.segments = [{ s: 0, length: 1000, curvature: 0.01 }];

    let previous = world.car.x;
    for (let i = 0; i < 60; i++) {
      driftSystem(world, 1 / 60);
      expect(world.car.x).toBeLessThan(previous);
      expect(world.car.x).toBeGreaterThanOrEqual(0);
      previous = world.car.x;
    }
  });
});
