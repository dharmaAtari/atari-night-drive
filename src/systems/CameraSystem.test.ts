import { describe, expect, it } from 'vitest';
import { cameraSystem } from './CameraSystem';
import type { World } from '../world';
import type { GameConfigFile } from '../config';
import type { Track, TrackSegment } from '../components/Track';
import type { Viewport } from '../components/Viewport';
import { createCar } from '../components/Car';
import { createProjection } from '../components/Projected';
import { createInputState } from '../components/InputState';

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

function makeStraightTrack(count: number, length: number, curvature = 0): Track {
  const segments: TrackSegment[] = [];
  for (let i = 0; i < count; i++) {
    segments.push({ s: i * length, length, curvature });
  }
  return { segments };
}

function makeViewport(): Viewport {
  return {
    cssWidth: 1280,
    cssHeight: 720,
    renderWidth: 1280,
    renderHeight: 720,
    dpr: 1,
    layout: 'landscape',
    safeTop: 0,
    safeRight: 0,
    safeBottom: 0,
    safeLeft: 0,
    horizonY: 300,
  };
}

function makeWorld(opts: { carX?: number; curvature?: number } = {}): World {
  const config = makeConfig();
  const car = createCar(config.speed.start);
  car.x = opts.carX ?? 0;
  return {
    config,
    input: createInputState(),
    viewport: makeViewport(),
    car,
    track: makeStraightTrack(100, 5, opts.curvature ?? 0),
    posts: [],
    projection: createProjection(),
    events: [],
  };
}

describe('cameraSystem', () => {
  it('projects a straight track centred on screen when the car is at lane centre', () => {
    const world = makeWorld({ carX: 0 });
    cameraSystem(world);

    const { segments } = world.projection;
    expect(segments.length).toBeGreaterThan(0);

    for (const seg of segments) {
      expect(seg.nearCentreX).toBeCloseTo(world.viewport.renderWidth / 2, 6);
      expect(seg.farCentreX).toBeCloseTo(world.viewport.renderWidth / 2, 6);
    }

    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].nearY).toBeLessThan(segments[i - 1].nearY);
      expect(segments[i].nearY).toBeGreaterThan(world.viewport.horizonY);
      expect(segments[i].nearHalfWidth).toBeLessThan(segments[i - 1].nearHalfWidth);
    }

    expect(segments[0].nearHalfWidth).toBeGreaterThan(segments[segments.length - 1].farHalfWidth);
  });

  it('bends the far road toward positive screen-x (right) when curvature is positive', () => {
    const world = makeWorld({ curvature: 0.01 });
    cameraSystem(world);

    const { segments } = world.projection;
    expect(segments.length).toBeGreaterThan(0);

    const last = segments[segments.length - 1];
    expect(last.farCentreX).toBeGreaterThan(world.viewport.renderWidth / 2);
  });

  it('shifts a straight track uniformly negative when the car sits right of centre, more for near segments than far', () => {
    const centred = makeWorld({ carX: 0 });
    cameraSystem(centred);

    const shifted = makeWorld({ carX: 1 });
    cameraSystem(shifted);

    const half = shifted.viewport.renderWidth / 2;
    const shifts = shifted.projection.segments.map((seg, i) => seg.nearCentreX - centred.projection.segments[i].nearCentreX);

    for (const shift of shifts) {
      expect(shift).toBeLessThan(0);
    }
    expect(Math.abs(shifts[0])).toBeGreaterThan(Math.abs(shifts[shifts.length - 1]));
    expect(shifted.projection.segments[0].nearCentreX).toBeLessThan(half);
  });

  it('is stable across repeated frames and reuses the pooled segments array', () => {
    const world = makeWorld({ carX: 0 });
    cameraSystem(world);

    const firstCount = world.projection.segments.length;
    const firstRefs = [...world.projection.segments];
    const firstSnapshot = world.projection.segments.map((seg) => ({ ...seg }));

    cameraSystem(world);

    expect(world.projection.segments.length).toBe(firstCount);
    world.projection.segments.forEach((seg, i) => {
      expect(seg).toBe(firstRefs[i]);
      expect(seg).toEqual(firstSnapshot[i]);
    });
  });
});
