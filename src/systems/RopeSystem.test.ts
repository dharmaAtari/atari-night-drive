import { describe, it, expect } from 'vitest';
import { makeWorld } from '../testing/makeWorld';
import { createAnchor } from '../components/Anchor';
import type { Anchor } from '../components/Anchor';
import { GAME_EVENTS } from '../types/game-events';
import { ropeSystem, isRopeAttached, easeToward, laneX } from './RopeSystem';

const DT = 1 / 60;

function press(world: ReturnType<typeof makeWorld>): void {
  world.input.pressedThisFrame = true;
  world.input.held = true;
}

function clearPress(world: ReturnType<typeof makeWorld>): void {
  world.input.pressedThisFrame = false;
}

function addAnchor(
  world: ReturnType<typeof makeWorld>,
  overrides: Partial<Anchor> & { s: number; lane: -1 | 1 },
): Anchor {
  const anchor = createAnchor(
    world.nextAnchorId++,
    overrides.s,
    overrides.lane,
    overrides.kind ?? 'safe',
    overrides.windowOpenS ?? overrides.s - 20,
    overrides.windowCloseS ?? overrides.s + 20,
  );
  anchor.state = overrides.state ?? 'open';
  world.anchors.push(anchor);
  return anchor;
}

describe('easeToward', () => {
  it('returns target immediately when duration <= 0', () => {
    expect(easeToward(0, 5, 0, DT)).toBe(5);
  });

  it('moves current toward target and never overshoots', () => {
    const next = easeToward(0, 1, 0.3, DT);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
  });
});

describe('laneX', () => {
  it('scales lane index by lane width', () => {
    expect(laneX(1, 1)).toBe(1);
    expect(laneX(-1, 2)).toBe(-2);
    expect(laneX(0, 1)).toBe(0);
  });
});

describe('isRopeAttached', () => {
  it('is true for throwing and attached, false for everything else', () => {
    const states = ['idle', 'throwing', 'attached', 'returning', 'cooldown', 'snapped'] as const;
    const expected = [false, true, true, false, false, false];
    states.forEach((state, i) => {
      expect(isRopeAttached({ state, anchorId: null, timer: 0, extent: 0, tension: 0 })).toBe(
        expected[i],
      );
    });
  });
});

describe('ropeSystem transitions', () => {
  it('idle + press with an open anchor ahead -> throwing, attaches the anchor, emits RopeAttached', () => {
    const world = makeWorld({ carS: 0 });
    const anchor = addAnchor(world, { s: 10, lane: 1 });
    press(world);

    ropeSystem(world, DT);

    expect(world.rope.state).toBe('throwing');
    expect(world.rope.anchorId).toBe(anchor.id);
    expect(world.rope.timer).toBeCloseTo(world.config.rope.throwDuration, 9);
    expect(anchor.state).toBe('attached');
    expect(world.events).toContainEqual({ type: GAME_EVENTS.RopeAttached, anchorId: anchor.id });
  });

  it('idle + press with no open anchor -> cooldown, emits RopeMissed', () => {
    const world = makeWorld({ carS: 0 });
    press(world);

    ropeSystem(world, DT);

    expect(world.rope.state).toBe('cooldown');
    expect(world.rope.timer).toBeCloseTo(world.config.rope.missCooldown, 9);
    expect(world.events).toContainEqual({ type: GAME_EVENTS.RopeMissed });
  });

  it('idle + press ignores an anchor behind the car (s - car.s < 0)', () => {
    const world = makeWorld({ carS: 20 });
    addAnchor(world, { s: 5, lane: 1 });
    press(world);

    ropeSystem(world, DT);

    expect(world.rope.state).toBe('cooldown');
  });

  it('idle + press picks the nearest of two open anchors ahead', () => {
    const world = makeWorld({ carS: 0 });
    addAnchor(world, { s: 30, lane: -1 });
    const near = addAnchor(world, { s: 10, lane: 1 });
    press(world);

    ropeSystem(world, DT);

    expect(world.rope.anchorId).toBe(near.id);
  });

  it('throwing ticks the timer down and stays throwing until it expires', () => {
    const world = makeWorld({ carS: 0 });
    addAnchor(world, { s: 10, lane: 1 });
    world.rope.state = 'throwing';
    world.rope.anchorId = world.anchors[0].id;
    world.rope.timer = 1;

    ropeSystem(world, DT);

    expect(world.rope.state).toBe('throwing');
    expect(world.rope.timer).toBeCloseTo(1 - DT, 9);
  });

  it('throwing -> attached once the timer reaches zero', () => {
    const world = makeWorld({ carS: 0 });
    addAnchor(world, { s: 10, lane: 1 });
    world.rope.state = 'throwing';
    world.rope.anchorId = world.anchors[0].id;
    world.rope.timer = DT / 2;

    ropeSystem(world, DT);

    expect(world.rope.state).toBe('attached');
  });

  it('attached + held eases car.x toward laneX(anchor.lane)', () => {
    const world = makeWorld({ carS: 0, carX: 0 });
    const anchor = addAnchor(world, { s: 10, lane: 1 });
    world.rope.state = 'attached';
    world.rope.anchorId = anchor.id;
    world.input.held = true;

    ropeSystem(world, DT);

    expect(world.car.x).toBeGreaterThan(0);
    expect(world.car.x).toBeLessThan(1);
  });

  it('attached + released -> returning, marks anchor passed, clears anchorId', () => {
    const world = makeWorld({ carS: 0, carX: 0.5 });
    const anchor = addAnchor(world, { s: 10, lane: 1 });
    world.rope.state = 'attached';
    world.rope.anchorId = anchor.id;
    world.input.held = false;

    ropeSystem(world, DT);

    expect(world.rope.state).toBe('returning');
    expect(world.rope.timer).toBeCloseTo(world.config.rope.returnDuration, 9);
    expect(anchor.state).toBe('passed');
    expect(world.rope.anchorId).toBeNull();
  });

  it('attached + extent > maxExtent -> snapped, emits RopeSnapped, marks anchor passed', () => {
    const world = makeWorld({ carS: 100, carX: 0 });
    const anchor = addAnchor(world, { s: 0, lane: 1 });
    world.rope.state = 'attached';
    world.rope.anchorId = anchor.id;
    world.input.held = true;

    ropeSystem(world, DT);

    expect(world.rope.state).toBe('snapped');
    expect(anchor.state).toBe('passed');
    expect(world.events).toContainEqual({ type: GAME_EVENTS.RopeSnapped });
  });

  it('returning eases car.x toward 0 and moves to idle once the timer expires', () => {
    const world = makeWorld({ carS: 0, carX: 1 });
    world.rope.state = 'returning';
    world.rope.timer = world.config.rope.returnDuration;

    let frames = 0;
    while (world.rope.state === 'returning' && frames < 1000) {
      ropeSystem(world, DT);
      frames++;
    }

    expect(world.rope.state).toBe('idle');
    expect(Math.abs(world.car.x)).toBeLessThan(0.05);
  });

  it('returning + press with an open anchor re-throws directly (no cooldown)', () => {
    const world = makeWorld({ carS: 0 });
    const anchor = addAnchor(world, { s: 10, lane: 1 });
    world.rope.state = 'returning';
    world.rope.timer = world.config.rope.returnDuration;
    press(world);

    ropeSystem(world, DT);

    expect(world.rope.state).toBe('throwing');
    expect(world.rope.anchorId).toBe(anchor.id);
  });

  it('returning + press with no open anchor is ignored (stays returning, no cooldown)', () => {
    const world = makeWorld({ carS: 0 });
    world.rope.state = 'returning';
    world.rope.timer = world.config.rope.returnDuration;
    press(world);

    ropeSystem(world, DT);

    expect(world.rope.state).toBe('returning');
  });

  it('cooldown ticks down and returns to idle', () => {
    const world = makeWorld({ carS: 0 });
    world.rope.state = 'cooldown';
    world.rope.timer = DT / 2;

    ropeSystem(world, DT);

    expect(world.rope.state).toBe('idle');
  });

  it('snapped is terminal and does not self-clear', () => {
    const world = makeWorld({ carS: 0 });
    world.rope.state = 'snapped';

    ropeSystem(world, DT);
    ropeSystem(world, DT);
    ropeSystem(world, DT);

    expect(world.rope.state).toBe('snapped');
  });

  it('resets extent and tension to 0 whenever not attached/throwing', () => {
    const world = makeWorld({ carS: 0 });
    world.rope.state = 'cooldown';
    world.rope.timer = 1;
    world.rope.extent = 2;
    world.rope.tension = 0.5;

    ropeSystem(world, DT);

    expect(world.rope.extent).toBe(0);
    expect(world.rope.tension).toBe(0);
  });
});

describe('scripted scenarios', () => {
  function advance(world: ReturnType<typeof makeWorld>, dt: number): void {
    world.car.s += world.car.speed * dt;
  }

  it('1. clean swing: press in window, hold through the anchor, release -> idle at x ~ 0', () => {
    const world = makeWorld({ carS: 0, carX: 0 });
    world.car.speed = 20;
    const anchor = addAnchor(world, { s: 5, lane: 1 });

    press(world);
    advance(world, DT);
    ropeSystem(world, DT);
    clearPress(world);

    // Hold through throwing, the pull, and well past the anchor.
    while (world.car.s < anchor.s + 3) {
      advance(world, DT);
      ropeSystem(world, DT);
      expect(world.rope.state).not.toBe('snapped');
    }
    expect(world.rope.state).toBe('attached');

    // Release once the anchor is behind the car.
    world.input.held = false;
    let frames = 0;
    while (world.rope.state !== 'idle' && frames < 1000) {
      advance(world, DT);
      ropeSystem(world, DT);
      frames++;
    }

    expect(world.rope.state).toBe('idle');
    expect(Math.abs(world.car.x)).toBeLessThan(0.05);
  });

  it('2. Skill 1 early press: press before the window opens -> cooldown; a later press attaches once open', () => {
    const world = makeWorld({ carS: 0 });
    world.car.speed = 20;
    const anchor = addAnchor(world, { s: 15, lane: 1, state: 'dormant' });

    // Early press: window not open yet (anchor.state stays 'dormant' until AnchorSystem opens it).
    press(world);
    advance(world, DT);
    ropeSystem(world, DT);
    clearPress(world);

    expect(world.rope.state).toBe('cooldown');

    // Ride out the cooldown.
    let frames = 0;
    while (world.rope.state === 'cooldown' && frames < 1000) {
      advance(world, DT);
      ropeSystem(world, DT);
      frames++;
    }
    expect(world.rope.state).toBe('idle');
    expect(world.car.s).toBeLessThan(anchor.s);

    // Window is now open; second press attaches.
    anchor.state = 'open';
    press(world);
    advance(world, DT);
    ropeSystem(world, DT);

    expect(world.rope.state).toBe('throwing');
    expect(world.rope.anchorId).toBe(anchor.id);
  });

  it('3. Skill 2 early release: releasing alongside the anchor returns car.x toward 0 before the anchor is passed', () => {
    const world = makeWorld({ carS: 0, carX: 0 });
    world.car.speed = 5;
    const anchor = addAnchor(world, { s: 5, lane: 1 });

    press(world);
    advance(world, DT);
    ropeSystem(world, DT);
    clearPress(world);

    // Hold briefly, well before reaching the anchor.
    for (let i = 0; i < 10; i++) {
      advance(world, DT);
      ropeSystem(world, DT);
    }
    expect(world.rope.state).toBe('attached');
    expect(world.car.s).toBeLessThan(anchor.s);
    const xAtRelease = world.car.x;
    expect(xAtRelease).toBeGreaterThan(0);

    world.input.held = false;
    for (let i = 0; i < 15; i++) {
      advance(world, DT);
      ropeSystem(world, DT);
    }

    expect(world.rope.state).toBe('returning');
    expect(world.car.s).toBeLessThan(anchor.s);
    expect(world.car.x).toBeLessThan(xAtRelease);
  });

  it('4. Skill 3 overhold: holding past maxExtent snaps, with tension >= 0.7 at least one frame before the snap', () => {
    const world = makeWorld({ carS: 0, carX: 0 });
    world.car.speed = 30;
    addAnchor(world, { s: 5, lane: 1 });

    press(world);
    advance(world, DT);
    ropeSystem(world, DT);
    clearPress(world);

    let sawHighTensionBeforeSnap = false;
    let frames = 0;
    while (world.rope.state !== 'snapped' && frames < 1000) {
      advance(world, DT);
      ropeSystem(world, DT);
      // rope.tension is forced back to 0 on the snap frame itself, so a reading >= 0.7
      // here can only have happened on an earlier, pre-snap frame.
      if (world.rope.tension >= 0.7) {
        sawHighTensionBeforeSnap = true;
      }
      frames++;
    }

    expect(world.rope.state).toBe('snapped');
    expect(sawHighTensionBeforeSnap).toBe(true);
    expect(world.events).toContainEqual({ type: GAME_EVENTS.RopeSnapped });
  });
});
