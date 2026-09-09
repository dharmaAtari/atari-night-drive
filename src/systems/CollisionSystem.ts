/**
 * CollisionSystem — the only thing that ends a run.
 *
 * Three causes, checked in the order they can occur within a frame:
 *
 *   snap      the rope was held past its limit — already decided by RopeSystem
 *   offRoad   a curve went untaken and drift carried the car off the surface
 *   obstacle  something was still in the car's lane when it arrived
 *
 * The car's footprint comes from its `Collision` component rather than a
 * constant here, so widening the collider is a change to the car entity and not
 * an edit to this file. Everything is tested in lane units against the world,
 * never in pixels against the projection: what kills you must not depend on the
 * window size.
 *
 * Idempotent by construction — once the run leaves `running` this does nothing,
 * so the crash beat cannot re-trigger itself while it plays out.
 */
import type { CollisionComponent } from '../components/index.js';
import { CrashCause, GameEvent, RunState, hazardLanes, type CrashCauseValue, type World } from '../world.js';
import { RopeState } from '../world.js';

/**
 * True when the car's lateral footprint overlaps the given lane's footprint.
 * Half-open on neither side: touching edges do not count as a hit, which keeps
 * a perfectly-executed swing that grazes the lane boundary survivable.
 */
export function laneOverlapsCar(
  carX: number,
  carHalfWidth: number,
  lane: number,
  laneWidth: number,
): boolean {
  const carMin = carX - carHalfWidth;
  const carMax = carX + carHalfWidth;
  const laneMin = lane * laneWidth - laneWidth / 2;
  const laneMax = lane * laneWidth + laneWidth / 2;
  return carMax > laneMin && carMin < laneMax;
}

function hitsObstacle(world: World, carHalfWidth: number): boolean {
  const { car, hazards, config } = world;

  for (const hazard of hazards) {
    // Longitudinal overlap first: it rejects almost every hazard in one compare,
    // and only survivors pay for the per-lane test.
    if (car.s < hazard.s || car.s >= hazard.s + hazard.length) continue;

    for (const lane of hazardLanes(hazard)) {
      if (laneOverlapsCar(car.x, carHalfWidth, lane, config.lanes.width)) return true;
    }
  }
  return false;
}

/**
 * Returns true on the single frame a crash begins, so the caller can fire the
 * shake, the sound and the score write exactly once.
 */
export function collisionSystem(world: World, collider: CollisionComponent): boolean {
  if (world.run.state !== RunState.RUNNING) return false;

  const carHalfWidth = collider.width / 2;

  let cause: CrashCauseValue | null = null;
  if (world.rope.state === RopeState.SNAPPED) {
    cause = CrashCause.SNAP;
  } else if (Math.abs(world.car.x) > world.config.road.halfWidth) {
    cause = CrashCause.OFF_ROAD;
  } else if (hitsObstacle(world, carHalfWidth)) {
    cause = CrashCause.OBSTACLE;
  }

  if (!cause) return false;

  world.run.state = RunState.CRASHING;
  world.run.crashTimer = world.config.fail.impactSeconds;
  world.events.push({ type: GameEvent.CRASHED, cause });
  return true;
}
