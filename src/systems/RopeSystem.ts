/**
 * RopeSystem — the whole game, in one state machine.
 *
 * Press in a window, hold long enough, release before the boundary. Three
 * timing skills out of one key, and three ways to die:
 *
 *   press too early or late   the rope finds nothing, or the hazard arrives first
 *   release too early         the car returns to centre while the hazard is alongside
 *   hold too long             the anchor falls behind, the rope reaches maxExtent and snaps
 *
 * The third is the one players discover last and respect most, so it is
 * deliberately telegraphed: `tension` climbs continuously toward 1 and the
 * renderer and audio read it, which means the snap is never the first warning.
 *
 * Lateral movement is an exponential ease rather than a constant slide. That
 * gives the pull its snap — fastest at the moment of attachment, settling as it
 * arrives — and it needs no stored start position, because the ease is defined
 * purely by where the car is now and where it is going.
 */
import {
  AnchorState,
  RopeState,
  GameEvent,
  type Anchor,
  type AnchorId,
  type Lane,
  type World,
} from '../world.js';
import { METRES_PER_LANE_UNIT } from './CameraSystem.js';

/**
 * Fraction of the distance still left after `duration` seconds of easing.
 * Chosen so the car reads as settled by the end of the configured pull, without
 * the rope having to remember where the pull started.
 */
const EASE_EPSILON = 0.02;

/** True while the rope is out and the car is under its control, not drift's. */
export function isRopeAttached(state: World['rope']['state']): boolean {
  return state === RopeState.THROWING || state === RopeState.ATTACHED;
}

/** Lane centre as a lateral world position, in lane units. */
export function laneX(lane: number, laneWidth: number): number {
  return lane * laneWidth;
}

/** Exponential ease-out: fastest at the start, ~98% of the way there by `duration`. */
export function easeToward(current: number, target: number, duration: number, dt: number): number {
  if (duration <= 0) return target;
  const rate = -Math.log(EASE_EPSILON) / duration;
  return target + (current - target) * Math.exp(-rate * dt);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Null rather than throwing when the id names no live anchor. The anchor list is
 * a rolling window, so a stale id is a normal outcome of a long hold, not a bug
 * — the caller treats it as a detach.
 */
function findAnchor(anchors: Anchor[], id: AnchorId | null): Anchor | null {
  if (id === null) return null;
  return anchors.find((anchor) => anchor.id === id) ?? null;
}

/** Nearest open anchor at or ahead of the car. */
function selectOpenAnchor(anchors: Anchor[], carS: number): Anchor | null {
  let best: Anchor | null = null;
  let bestDist = Infinity;

  for (const anchor of anchors) {
    if (anchor.state !== AnchorState.OPEN) continue;
    const dist = anchor.s - carS;
    if (dist < 0 || dist >= bestDist) continue;
    bestDist = dist;
    best = anchor;
  }
  return best;
}

function throwAt(world: World, anchor: Anchor): void {
  const { rope, config } = world;
  rope.state = RopeState.THROWING;
  rope.anchorId = anchor.id;
  rope.timer = config.rope.throwDuration;
  anchor.state = AnchorState.ATTACHED;
  world.events.push({ type: GameEvent.ROPE_THROWN });
  world.events.push({ type: GameEvent.ROPE_ATTACHED, anchorId: anchor.id });
}

function detach(world: World, anchor: Anchor | null): void {
  const { rope, config } = world;
  rope.state = RopeState.RETURNING;
  rope.timer = config.rope.returnDuration;
  rope.anchorId = null;
  if (anchor) anchor.state = AnchorState.PASSED;
}

export function ropeSystem(world: World, held: boolean, pressed: boolean, dt: number): void {
  const { rope, car, anchors, config } = world;

  switch (rope.state) {
    case RopeState.IDLE: {
      if (!pressed) break;
      const anchor = selectOpenAnchor(anchors, car.s);
      if (anchor) {
        throwAt(world, anchor);
      } else {
        // A miss costs a cooldown, which is what stops panic-mashing from being
        // a viable substitute for timing.
        rope.state = RopeState.COOLDOWN;
        rope.timer = config.rope.missCooldown;
        world.events.push({ type: GameEvent.ROPE_MISSED });
      }
      break;
    }

    case RopeState.THROWING: {
      rope.timer -= dt;
      if (rope.timer <= 0) rope.state = RopeState.ATTACHED;
      break;
    }

    case RopeState.ATTACHED: {
      const anchor = findAnchor(anchors, rope.anchorId);
      if (!anchor) {
        detach(world, null);
        break;
      }
      if (held) {
        car.x = easeToward(car.x, laneX(anchor.lane, config.lanes.width), config.rope.pullDuration, dt);
      } else {
        detach(world, anchor);
      }
      break;
    }

    case RopeState.RETURNING: {
      rope.timer -= dt;
      car.x = easeToward(car.x, 0, config.rope.returnDuration, dt);

      // Re-throwing mid-return is allowed and costs no cooldown when it finds
      // nothing: the player is already committed to recovering, and punishing
      // that would make consecutive hazards unrecoverable.
      if (pressed) {
        const anchor = selectOpenAnchor(anchors, car.s);
        if (anchor) throwAt(world, anchor);
      }

      if (rope.state === RopeState.RETURNING && rope.timer <= 0) {
        rope.state = RopeState.IDLE;
      }
      break;
    }

    case RopeState.COOLDOWN: {
      rope.timer -= dt;
      if (rope.timer <= 0) rope.state = RopeState.IDLE;
      break;
    }

    case RopeState.SNAPPED:
      // Terminal. CollisionSystem reads it and ends the run.
      break;
  }

  updateExtentAndLean(world);
}

/**
 * Recomputes rope length, tension and body lean, and snaps the rope if it has
 * been stretched past its limit. Runs after the state machine so it sees the
 * position the machine just wrote.
 */
function updateExtentAndLean(world: World): void {
  const { rope, car, anchors, config } = world;

  if (!isRopeAttached(rope.state)) {
    rope.extent = 0;
    rope.tension = 0;
    car.lean = 0;
    return;
  }

  const anchor = findAnchor(anchors, rope.anchorId);
  if (!anchor) {
    rope.extent = 0;
    rope.tension = 0;
    car.lean = 0;
    return;
  }

  // Only distance *past* the anchor counts. While the anchor is still ahead the
  // rope is being reeled in, not stretched — measuring that as extent would make
  // every throw snap on the frame it attached, since an anchor may legitimately
  // be a full rope-range ahead when the window opens.
  //
  // Longitudinal distance is converted into lane units so the two axes are
  // commensurate; without it, metres behind would dominate lanes across and the
  // rope would snap on depth alone.
  const ds = Math.max(0, car.s - anchor.s) / METRES_PER_LANE_UNIT;
  const dx = car.x - laneX(anchor.lane, config.lanes.width);
  rope.extent = Math.hypot(ds, dx);
  rope.tension = clamp01(rope.extent / config.rope.maxExtent);
  car.lean = Math.sign(anchor.lane) as Lane;

  if (rope.state === RopeState.ATTACHED && rope.extent > config.rope.maxExtent) {
    rope.state = RopeState.SNAPPED;
    anchor.state = AnchorState.PASSED;
    world.events.push({ type: GameEvent.ROPE_SNAPPED });
    rope.extent = 0;
    rope.tension = 0;
    car.lean = 0;
  }
}
