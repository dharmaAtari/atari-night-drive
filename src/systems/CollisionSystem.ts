import type { World } from '../world';
import { hazardLanes } from '../components/Hazard';
import { GAME_EVENTS } from '../types/game-events';
import type { GameEvent } from '../types/game-events';

type CrashCause = Extract<GameEvent, { type: typeof GAME_EVENTS.Crashed }>['cause'];

/** Car half-width as a fraction of lane width, used for the lateral overlap test. */
export const CAR_HALF_WIDTH_FRACTION = 0.35;

/**
 * True if the car's lateral footprint `[carX - carHalfWidth, carX + carHalfWidth]` overlaps
 * the given lane's footprint `[lane*laneWidth - laneWidth/2, lane*laneWidth + laneWidth/2]`.
 */
export function laneOverlapsCar(carX: number, lane: number, laneWidth: number): boolean {
  const carHalfWidth = laneWidth * CAR_HALF_WIDTH_FRACTION;
  const carMin = carX - carHalfWidth;
  const carMax = carX + carHalfWidth;
  const laneMin = lane * laneWidth - laneWidth / 2;
  const laneMax = lane * laneWidth + laneWidth / 2;
  return carMax > laneMin && carMin < laneMax;
}

function hitsObstacle(world: World): boolean {
  const { car, hazards, config } = world;
  for (const hazard of hazards) {
    if (hazard.kind !== 'obstacle') continue;
    if (car.s < hazard.s || car.s >= hazard.s + hazard.length) continue;
    for (const lane of hazardLanes(hazard)) {
      if (laneOverlapsCar(car.x, lane, config.lanes.width)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Detects the frame a crash begins. Returns true exactly once per crash, on the frame the
 * cause is first detected. Idempotent: once `world.runState` leaves 'running', this does
 * nothing and returns false.
 */
export function collisionSystem(world: World): boolean {
  if (world.runState !== 'running') {
    return false;
  }

  let cause: CrashCause | null = null;
  if (world.rope.state === 'snapped') {
    cause = 'snap';
  } else if (Math.abs(world.car.x) > world.config.road.halfWidth) {
    cause = 'offRoad';
  } else if (hitsObstacle(world)) {
    cause = 'obstacle';
  }

  if (!cause) {
    return false;
  }

  world.runState = 'crashing';
  world.events.push({ type: GAME_EVENTS.Crashed, cause });
  return true;
}

export function isCrashCause(world: World, cause: CrashCause): boolean {
  return world.events.some((event) => event.type === GAME_EVENTS.Crashed && event.cause === cause);
}
