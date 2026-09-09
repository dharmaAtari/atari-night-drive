import type { World } from '../world';
import { curvatureAt } from './TrackQuery';

// Exponential ease back to lane centre. Not config-driven: this is a Phase 1
// verification aid only (config.debug.autoCentre), not a tuned gameplay value.
const AUTO_CENTRE_RATE = 5;

export function driftSystem(world: World, dt: number): void {
  const { car, track, config } = world;

  if (config.debug.autoCentre) {
    car.x *= Math.exp(-AUTO_CENTRE_RATE * dt);
    return;
  }

  const curvature = curvatureAt(track, car.s);
  car.x -= curvature * car.speed * config.drift.gain * dt;
}
