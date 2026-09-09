import { describe, it, expect } from 'vitest';
import { makeConfig } from '../testing/makeWorld';
import { createWorld } from '../world';
import { driftSystem } from './DriftSystem';

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

  it('skips drift while the rope is attached, applies it while idle', () => {
    const attached = createWorld(makeConfig());
    attached.car.speed = 30;
    attached.car.x = 0;
    attached.track.segments = [{ s: 0, length: 1000, curvature: 0.01 }];
    attached.rope.state = 'attached';

    driftSystem(attached, 1);
    expect(attached.car.x).toBe(0);

    const idle = createWorld(makeConfig());
    idle.car.speed = 30;
    idle.car.x = 0;
    idle.track.segments = [{ s: 0, length: 1000, curvature: 0.01 }];
    idle.rope.state = 'idle';

    driftSystem(idle, 1);
    expect(idle.car.x).not.toBe(0);
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
