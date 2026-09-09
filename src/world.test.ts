import { describe, it, expect } from 'vitest';
import { makeWorld, makeConfig } from './testing/makeWorld';
import { resetRun } from './world';
import { createAnchor } from './components/Anchor';

describe('resetRun', () => {
  it('returns a dirtied world to a fresh run', () => {
    const world = makeWorld();
    world.car.s = 900;
    world.car.x = 1.4;
    world.car.speed = 88;
    world.car.lean = 1;
    world.elapsed = 123;
    world.runState = 'over';
    world.rope.state = 'snapped';
    world.rope.tension = 1;
    world.light.power = 0.1;
    world.light.highBeamActive = true;
    world.light.highBeam = 0.4;
    world.anchors.push(createAnchor(5, 100, 1, 'safe', 40, 90));
    world.hazards.push({ kind: 'obstacle', s: 120, length: 8, lanes: [1], obstacle: 'stalled' });
    world.posts.push({ s: 10, x: 1.7 });
    world.events.push({ type: 'crashed', cause: 'snap' });
    world.nextAnchorId = 12;

    resetRun(world);

    const config = makeConfig();
    expect(world.car).toEqual({ s: 0, x: 0, speed: config.speed.start, lean: 0 });
    expect(world.elapsed).toBe(0);
    expect(world.runState).toBe('running');
    expect(world.rope.state).toBe('idle');
    expect(world.rope.anchorId).toBeNull();
    expect(world.rope.tension).toBe(0);
    expect(world.light).toEqual({ power: config.light.startPower, highBeam: 0, highBeamActive: false });
    expect(world.anchors).toHaveLength(0);
    expect(world.hazards).toHaveLength(0);
    expect(world.posts).toHaveLength(0);
    expect(world.events).toHaveLength(0);
    expect(world.track.segments).toHaveLength(0);
    expect(world.nextAnchorId).toBe(1);
    expect(world.input.held).toBe(false);
  });

  it('leaves no stale references — arrays are emptied in place, not replaced', () => {
    const world = makeWorld();
    const anchors = world.anchors;
    const segments = world.track.segments;
    world.anchors.push(createAnchor(1, 10, -1, 'power', 1, 5));
    resetRun(world);
    expect(world.anchors).toBe(anchors);
    expect(world.track.segments).toBe(segments);
  });
});
