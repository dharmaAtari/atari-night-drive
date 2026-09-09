import type { World } from '../world';
import { curvatureAt } from './TrackQuery';
import { isRopeAttached } from './RopeSystem';

// Exponential ease back to lane centre. Not config-driven: this is a Phase 1
// verification aid only (config.debug.autoCentre), not a tuned gameplay value.
const AUTO_CENTRE_RATE = 5;

export function driftSystem(world: World, dt: number): void {
  const { car, track, config, rope } = world;

  if (config.debug.autoCentre) {
    car.x *= Math.exp(-AUTO_CENTRE_RATE * dt);
    return;
  }

  // The rope holds the car against curvature while it is out (G0.1): RopeSystem drives
  // car.x directly during throwing/attached, so drift must not fight it.
  if (isRopeAttached(rope)) {
    return;
  }

  const curvature = curvatureAt(track, car.s);
  car.x -= curvature * car.speed * config.drift.gain * dt;
}
