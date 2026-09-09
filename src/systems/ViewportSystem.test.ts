import { describe, expect, it } from 'vitest';
import type { GameConfigFile } from '../config';
import { createWorld } from '../world';
import { viewportSystem } from './ViewportSystem';

function makeConfig(overrides?: Partial<GameConfigFile['display']>): GameConfigFile {
  return {
    display: {
      scaleMode: 'none',
      fullscreen: false,
      maxDevicePixelRatio: 2,
      portraitBreakpoint: 1.0,
      ...overrides,
    },
    input: { edgeGuardPx: 24, gamepad: true },
    performance: { targetFps: 60 },
    lanes: { count: 3, width: 1 },
    road: { halfWidth: 1.5, horizonMetres: 300, tailMetres: 10, segmentLength: 5, postSpacing: 12 },
    camera: { height: 1.2, depth: 0.84 },
    drift: { gain: 1.0 },
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
      spawnLeadSeconds: 4.0,
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
    debug: { autoCentre: false, showSeed: true },
  };
}

describe('viewportSystem', () => {
  it('computes render size from cssWidth/cssHeight and dpr, landscape layout', () => {
    const world = createWorld(makeConfig());

    viewportSystem(world, {
      cssWidth: 1280,
      cssHeight: 720,
      dpr: 1,
      safeTop: 0,
      safeRight: 0,
      safeBottom: 0,
      safeLeft: 0,
    });

    expect(world.viewport.cssWidth).toBe(1280);
    expect(world.viewport.cssHeight).toBe(720);
    expect(world.viewport.renderWidth).toBe(1280);
    expect(world.viewport.renderHeight).toBe(720);
    expect(world.viewport.layout).toBe('landscape');
    expect(world.viewport.horizonY).toBeCloseTo(720 * 0.45);
  });

  it('caps dpr at config.display.maxDevicePixelRatio and scales render size', () => {
    const world = createWorld(makeConfig({ maxDevicePixelRatio: 2 }));

    viewportSystem(world, {
      cssWidth: 400,
      cssHeight: 800,
      dpr: 3,
      safeTop: 0,
      safeRight: 0,
      safeBottom: 0,
      safeLeft: 0,
    });

    expect(world.viewport.dpr).toBe(2);
    expect(world.viewport.renderWidth).toBe(800);
    expect(world.viewport.renderHeight).toBe(1600);
  });

  it('picks portrait layout below the breakpoint and scales horizonY at 0.40', () => {
    const world = createWorld(makeConfig({ portraitBreakpoint: 1.0 }));

    viewportSystem(world, {
      cssWidth: 400,
      cssHeight: 800,
      dpr: 1,
      safeTop: 0,
      safeRight: 0,
      safeBottom: 0,
      safeLeft: 0,
    });

    expect(world.viewport.layout).toBe('portrait');
    expect(world.viewport.horizonY).toBeCloseTo(800 * 0.4);
  });

  it('scales safe-area insets by the capped dpr', () => {
    const world = createWorld(makeConfig({ maxDevicePixelRatio: 2 }));

    viewportSystem(world, {
      cssWidth: 400,
      cssHeight: 800,
      dpr: 2,
      safeTop: 20,
      safeRight: 5,
      safeBottom: 15,
      safeLeft: 5,
    });

    expect(world.viewport.safeTop).toBe(40);
    expect(world.viewport.safeRight).toBe(10);
    expect(world.viewport.safeBottom).toBe(30);
    expect(world.viewport.safeLeft).toBe(10);
  });
});
