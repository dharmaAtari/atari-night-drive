/**
 * DriftSystem — what a curve does to you when you do not rope it.
 *
 * A bend pushes the car toward the outside of the turn at a rate proportional to
 * curvature and speed. Left alone, that carries the car off the road, which is
 * precisely why curves count as hazards: the rope is how you take a corner.
 *
 * It deliberately does nothing while the rope is out. `RopeSystem` drives `car.x`
 * directly during a pull, and a drift term fighting it would make the swing feel
 * mushy and, on a sharp curve, unwinnable.
 */
import { RunState, curvatureAt, type World } from '../world.js';
import { isRopeAttached } from './RopeSystem.js';

/** Verification-only ease back to centre, for `debug.autoCentre`. Not tuning. */
const AUTO_CENTRE_RATE = 5;

export function driftSystem(world: World, dt: number): void {
  const { car, track, config, rope } = world;

  if (world.run.state !== RunState.RUNNING) return;

  if (config.debug.autoCentre) {
    car.x *= Math.exp(-AUTO_CENTRE_RATE * dt);
    return;
  }

  if (isRopeAttached(rope.state)) return;

  car.x -= curvatureAt(track, car.s) * car.speed * config.drift.gain * dt;
}
