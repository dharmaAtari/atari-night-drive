import { describe, expect, it } from 'vitest';
import { makeWorld } from '../testing/makeWorld';
import { cameraSystem } from './CameraSystem';

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
