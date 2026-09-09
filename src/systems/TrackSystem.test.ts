import { describe, it, expect } from 'vitest';
import { makeConfig } from '../testing/makeWorld';
import { createWorld } from '../world';
import { createTrackSystem, debugPresetCurvature } from './TrackSystem';

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
