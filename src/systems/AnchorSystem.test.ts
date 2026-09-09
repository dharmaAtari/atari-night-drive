import { describe, it, expect } from 'vitest';
import { makeWorld, makeConfig } from '../testing/makeWorld';
import { createAnchor } from '../components/Anchor';
import { ropeRange, anchorSystem, openAnchors } from './AnchorSystem';

describe('ropeRange', () => {
  it('returns baseRange at low speed and the floor-derived value at high speed (crossover)', () => {
    const config = makeConfig();
    const { baseRange, floorSeconds, closeMargin } = config.rope;

    // Crossover speed: baseRange === speed * floorSeconds + closeMargin
    const crossoverSpeed = (baseRange - closeMargin) / floorSeconds;

    const lowSpeed = crossoverSpeed - 20;
    const highSpeed = crossoverSpeed + 20;

    expect(ropeRange(config, lowSpeed)).toBe(baseRange);
    expect(ropeRange(config, highSpeed)).toBeCloseTo(highSpeed * floorSeconds + closeMargin, 9);
    expect(ropeRange(config, highSpeed)).toBeGreaterThan(baseRange);
  });
});

describe('anchorSystem', () => {
  it('advances an anchor dormant -> open -> passed as car.s crosses the window bounds', () => {
    const world = makeWorld({ carS: 0 });
    const anchor = createAnchor(world.nextAnchorId++, 1000, 1, 'safe', 20, 40);
    world.anchors.push(anchor);

    expect(anchor.state).toBe('dormant');

    world.car.s = 10;
    anchorSystem(world);
    expect(anchor.state).toBe('dormant');

    world.car.s = 25;
    anchorSystem(world);
    expect(anchor.state).toBe('open');

    world.car.s = 35;
    anchorSystem(world);
    expect(anchor.state).toBe('open');

    world.car.s = 45;
    anchorSystem(world);
    expect(anchor.state).toBe('passed');
  });

  it('does not touch anchors already attached or passed', () => {
    const world = makeWorld({ carS: 0 });
    const attached = createAnchor(world.nextAnchorId++, 1000, 1, 'safe', 20, 40);
    attached.state = 'attached';
    const passed = createAnchor(world.nextAnchorId++, 1001, -1, 'safe', 20, 40);
    passed.state = 'passed';
    world.anchors.push(attached, passed);

    world.car.s = 5000;
    anchorSystem(world);

    expect(attached.state).toBe('attached');
    expect(passed.state).toBe('passed');
  });

  it('culls anchors behind the tail while preserving sort order by s', () => {
    const world = makeWorld({ carS: 0 });
    const config = world.config;
    for (const s of [5, 15, 25, 35]) {
      world.anchors.push(createAnchor(world.nextAnchorId++, s, 1, 'safe', -100, 1000));
    }

    world.car.s = 30; // tailEdge = 30 - config.road.tailMetres (10) = 20
    anchorSystem(world);

    expect(world.anchors.map((a) => a.s)).toEqual([25, 35]);
    for (let i = 1; i < world.anchors.length; i++) {
      expect(world.anchors[i].s).toBeGreaterThanOrEqual(world.anchors[i - 1].s);
    }
    expect(config.road.tailMetres).toBe(10);
  });
});

describe('openAnchors', () => {
  it('returns only anchors in the open state, sorted ascending by s', () => {
    const world = makeWorld({ carS: 0 });
    const far = createAnchor(world.nextAnchorId++, 200, 1, 'safe', -10, 1000);
    far.state = 'open';
    const near = createAnchor(world.nextAnchorId++, 100, -1, 'safe', -10, 1000);
    near.state = 'open';
    const dormant = createAnchor(world.nextAnchorId++, 50, 1, 'safe', 500, 1000);
    world.anchors.push(far, near, dormant);

    const result = openAnchors(world);

    expect(result.map((a) => a.id)).toEqual([near.id, far.id]);
  });
});
