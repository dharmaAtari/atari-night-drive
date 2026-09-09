import type { World } from '../world';
import type { Rope } from '../components/Rope';
import type { Anchor } from '../components/Anchor';
import type { AnchorId, AnchorLane, Lane } from '../types/lanes';
import { GAME_EVENTS } from '../types/game-events';
import { METRES_PER_LANE_UNIT } from './CameraSystem';

// Fraction of the initial distance-to-target still remaining after `duration` seconds of
// exponential easing. Chosen so the car reads as "settled" by the end of the configured
// pull/return duration without needing a stored start position on the Rope component.
const EASE_EPSILON = 0.02;

/** True while the rope is out (thrown or attached) and the car is under its control. */
export function isRopeAttached(rope: Rope): boolean {
  return rope.state === 'throwing' || rope.state === 'attached';
}

export function laneX(lane: Lane | AnchorLane, laneWidth: number): number {
  return lane * laneWidth;
}

/** Exponential ease-out: fastest at the start, ~98% of the way to target by `duration`. */
export function easeToward(current: number, target: number, duration: number, dt: number): number {
  if (duration <= 0) {
    return target;
  }
  const rate = -Math.log(EASE_EPSILON) / duration;
  return target + (current - target) * Math.exp(-rate * dt);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function getAnchor(anchors: Anchor[], id: AnchorId): Anchor {
  const anchor = anchors.find((a) => a.id === id);
  if (!anchor) {
    throw new Error(`RopeSystem: anchorId ${id} does not reference a live anchor`);
  }
  return anchor;
}

/** Nearest open anchor at or ahead of the car, per G0.4 (smallest non-negative s - car.s). */
function selectOpenAnchor(anchors: Anchor[], carS: number): Anchor | undefined {
  let best: Anchor | undefined;
  let bestDist = Infinity;
  for (const anchor of anchors) {
    if (anchor.state !== 'open') {
      continue;
    }
    const dist = anchor.s - carS;
    if (dist < 0) {
      continue;
    }
    if (dist < bestDist) {
      bestDist = dist;
      best = anchor;
    }
  }
  return best;
}

function throwAt(world: World, anchor: Anchor): void {
  const { rope, config } = world;
  rope.state = 'throwing';
  rope.anchorId = anchor.id;
  rope.timer = config.rope.throwDuration;
  anchor.state = 'attached';
  world.events.push({ type: GAME_EVENTS.RopeAttached, anchorId: anchor.id });
}

export function ropeSystem(world: World, dt: number): void {
  const { rope, input, car, anchors, config } = world;

  switch (rope.state) {
    case 'idle': {
      if (input.pressedThisFrame) {
        const anchor = selectOpenAnchor(anchors, car.s);
        if (anchor) {
          throwAt(world, anchor);
        } else {
          rope.state = 'cooldown';
          rope.timer = config.rope.missCooldown;
          world.events.push({ type: GAME_EVENTS.RopeMissed });
        }
      }
      break;
    }

    case 'throwing': {
      rope.timer -= dt;
      if (rope.timer <= 0) {
        rope.state = 'attached';
      }
      break;
    }

    case 'attached': {
      const anchor = getAnchor(anchors, rope.anchorId as AnchorId);
      if (input.held) {
        const target = laneX(anchor.lane, config.lanes.width);
        car.x = easeToward(car.x, target, config.rope.pullDuration, dt);
      } else {
        rope.state = 'returning';
        rope.timer = config.rope.returnDuration;
        anchor.state = 'passed';
        rope.anchorId = null;
      }
      break;
    }

    case 'returning': {
      rope.timer -= dt;
      car.x = easeToward(car.x, 0, config.rope.returnDuration, dt);

      if (input.pressedThisFrame) {
        const anchor = selectOpenAnchor(anchors, car.s);
        if (anchor) {
          throwAt(world, anchor);
        }
        // No open anchor: the press is ignored, no cooldown penalty (per the plan).
      }

      if (rope.state === 'returning' && rope.timer <= 0) {
        rope.state = 'idle';
      }
      break;
    }

    case 'cooldown': {
      rope.timer -= dt;
      if (rope.timer <= 0) {
        rope.state = 'idle';
      }
      break;
    }

    case 'snapped': {
      // Terminal for this system; Phase 3's CollisionSystem consumes it.
      break;
    }
  }

  updateExtentTensionAndLean(world);
}

function updateExtentTensionAndLean(world: World): void {
  const { rope, car, anchors, config } = world;

  if (!isRopeAttached(rope)) {
    rope.extent = 0;
    rope.tension = 0;
    car.lean = 0;
    return;
  }

  const anchor = getAnchor(anchors, rope.anchorId as AnchorId);
  const ds = (car.s - anchor.s) / METRES_PER_LANE_UNIT;
  const dx = car.x - laneX(anchor.lane, config.lanes.width);
  rope.extent = Math.hypot(ds, dx);
  rope.tension = clamp01(rope.extent / config.rope.maxExtent);
  car.lean = Math.sign(anchor.lane) as Lane;

  if (rope.state === 'attached' && rope.extent > config.rope.maxExtent) {
    rope.state = 'snapped';
    anchor.state = 'passed';
    world.events.push({ type: GAME_EVENTS.RopeSnapped });
    rope.extent = 0;
    rope.tension = 0;
    car.lean = 0;
  }
}
