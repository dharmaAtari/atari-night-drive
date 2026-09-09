import { describe, it, expect } from 'vitest';
import { makeWorld } from '../testing/makeWorld';
import type { Obstacle } from '../components/Hazard';
import { GAME_EVENTS } from '../types/game-events';
import { collisionSystem, laneOverlapsCar, isCrashCause, CAR_HALF_WIDTH_FRACTION } from './CollisionSystem';

function makeObstacle(overrides: Partial<Obstacle> = {}): Obstacle {
  return {
    kind: 'obstacle',
    s: 0,
    length: 10,
    lanes: [0],
    obstacle: 'stalled',
    ...overrides,
  };
}

describe('laneOverlapsCar', () => {
  it('reflects the configured car half-width fraction', () => {
    expect(CAR_HALF_WIDTH_FRACTION).toBe(0.35);
  });

  it('overlaps when the car is centred in the lane', () => {
    expect(laneOverlapsCar(0, 0, 1)).toBe(true);
  });

  it('does not overlap an adjacent lane when centred', () => {
    expect(laneOverlapsCar(0, 1, 1)).toBe(false);
  });

  it('overlaps mid-transit when the car clips the lane boundary', () => {
    expect(laneOverlapsCar(0.5, 1, 1)).toBe(true);
  });
});

describe('collisionSystem', () => {
  it('reports cause "snap" when the rope has snapped', () => {
    const world = makeWorld();
    world.rope.state = 'snapped';

    const crashed = collisionSystem(world);

    expect(crashed).toBe(true);
    expect(world.runState).toBe('crashing');
    expect(world.events).toHaveLength(1);
    expect(world.events[0]).toEqual({ type: GAME_EVENTS.Crashed, cause: 'snap' });
  });

  it('reports cause "offRoad" when the car is beyond the road half-width', () => {
    const world = makeWorld({ carX: 2 });

    const crashed = collisionSystem(world);

    expect(crashed).toBe(true);
    expect(world.runState).toBe('crashing');
    expect(isCrashCause(world, 'offRoad')).toBe(true);
  });

  it('reports cause "obstacle" when the car overlaps an obstacle in its lane and s-range', () => {
    const world = makeWorld({ carS: 10, carX: 0 });
    world.hazards.push(makeObstacle({ s: 5, length: 10, lanes: [0] }));

    const crashed = collisionSystem(world);

    expect(crashed).toBe(true);
    expect(isCrashCause(world, 'obstacle')).toBe(true);
  });

  it('precedence: a snapped rope while also off-road reports "snap"', () => {
    const world = makeWorld({ carX: 3 });
    world.rope.state = 'snapped';

    collisionSystem(world);

    expect(isCrashCause(world, 'snap')).toBe(true);
    expect(isCrashCause(world, 'offRoad')).toBe(false);
  });

  it('does not crash when the car sits in a free lane while an obstacle passes in another lane', () => {
    const world = makeWorld({ carS: 10, carX: 0 });
    world.hazards.push(makeObstacle({ s: 5, length: 10, lanes: [1] }));

    const crashed = collisionSystem(world);

    expect(crashed).toBe(false);
    expect(world.runState).toBe('running');
    expect(world.events).toHaveLength(0);
  });

  it('crashes when the car is mid-transit between a free and an occupied lane and clips the boundary', () => {
    const world = makeWorld({ carS: 10, carX: 0.5 });
    world.hazards.push(makeObstacle({ s: 5, length: 10, lanes: [1] }));

    const crashed = collisionSystem(world);

    expect(crashed).toBe(true);
    expect(isCrashCause(world, 'obstacle')).toBe(true);
  });

  it('is not off-road exactly at |car.x| === halfWidth (boundary is inclusive of the road)', () => {
    const world = makeWorld({ carX: 1.5 });

    const crashed = collisionSystem(world);

    expect(crashed).toBe(false);
    expect(world.runState).toBe('running');
    expect(world.events).toHaveLength(0);
  });

  it('is idempotent: after a crash, subsequent frames push no further events and return false', () => {
    const world = makeWorld({ carX: 2 });

    const first = collisionSystem(world);
    expect(first).toBe(true);
    expect(world.events).toHaveLength(1);

    for (let frame = 0; frame < 5; frame++) {
      const crashed = collisionSystem(world);
      expect(crashed).toBe(false);
    }

    expect(world.events).toHaveLength(1);
  });

  it('no longer collides with an obstacle once car.s passes s + length', () => {
    const world = makeWorld({ carS: 20, carX: 0 });
    world.hazards.push(makeObstacle({ s: 0, length: 10, lanes: [0] }));

    const crashed = collisionSystem(world);

    expect(crashed).toBe(false);
    expect(world.runState).toBe('running');
  });
});
