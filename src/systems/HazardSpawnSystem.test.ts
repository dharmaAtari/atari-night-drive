import { describe, it, expect } from 'vitest';
import { makeWorld } from '../testing/makeWorld';
import { createHazardSpawnSystem, spawnLead, curvatureFromHazards } from './HazardSpawnSystem';
import { ropeRange } from './AnchorSystem';

describe('spawnLead', () => {
  it('always leaves room for an anchor window to open before the hazard', () => {
    const world = makeWorld();
    for (const speed of [30, 60, 90]) {
      expect(spawnLead(world.config, speed)).toBeGreaterThan(ropeRange(world.config, speed));
    }
  });
});

describe('createHazardSpawnSystem', () => {
  it('fills the road ahead and keeps hazards sorted', () => {
    const world = makeWorld();
    const spawner = createHazardSpawnSystem(1);
    spawner.run(world, 0);

    expect(world.hazards.length).toBeGreaterThan(0);
    expect(world.anchors.length).toBeGreaterThan(0);
    for (let i = 1; i < world.hazards.length; i++) {
      expect(world.hazards[i].s).toBeGreaterThan(world.hazards[i - 1].s);
    }
  });

  it('keeps spawning as the car advances and culls what is behind', () => {
    const world = makeWorld();
    const spawner = createHazardSpawnSystem(2);
    spawner.run(world, 0);
    const firstBatch = world.hazards.length;

    world.car.s = 2000;
    spawner.run(world, 0.5);

    expect(world.hazards.some((h) => h.s > 2000)).toBe(true);
    expect(world.hazards.every((h) => h.s + h.length >= world.car.s - world.config.road.tailMetres)).toBe(true);
    expect(firstBatch).toBeGreaterThan(0);
  });

  it('does not spawn once the run is no longer running', () => {
    const world = makeWorld();
    world.runState = 'over';
    createHazardSpawnSystem(3).run(world, 0);
    expect(world.hazards).toHaveLength(0);
  });

  it('is deterministic for a seed and re-seedable', () => {
    const signature = (seed: number): string => {
      const world = makeWorld();
      const spawner = createHazardSpawnSystem(seed);
      for (let step = 0; step < 20; step++) {
        world.car.s = step * 150;
        spawner.run(world, 0.4);
      }
      return world.hazards
        .map((h) => (h.kind === 'obstacle' ? `o:${h.s}:${h.obstacle}:${h.lanes.join('')}` : `c:${h.s}:${h.curve}`))
        .join('|');
    };

    expect(signature(99)).toBe(signature(99));
    expect(signature(99)).not.toBe(signature(1234));
  });

  it('reports curvature only inside a curve hazard', () => {
    const world = makeWorld();
    world.hazards.push({ kind: 'curve', s: 100, length: 60, curve: 'slightL', curvature: -0.004 });
    const curvature = curvatureFromHazards(world);
    expect(curvature(99)).toBe(0);
    expect(curvature(130)).toBeCloseTo(-0.004);
    expect(curvature(160)).toBe(0);
  });
});
