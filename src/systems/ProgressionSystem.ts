import type { GameConfigFile } from '../config';
import type { World } from '../world';

export function smoothstep(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

export function rampAt(config: GameConfigFile, elapsedSeconds: number): number {
  return smoothstep(elapsedSeconds / config.speed.rampSeconds);
}

export function speedCap(config: GameConfigFile): number {
  return 3 * config.speed.start;
}

export function speedAt(config: GameConfigFile, elapsedSeconds: number): number {
  return config.speed.start + (speedCap(config) - config.speed.start) * rampAt(config, elapsedSeconds);
}

export function difficultyAt(config: GameConfigFile, elapsedSeconds: number): number {
  const ramp = rampAt(config, elapsedSeconds);
  return ramp >= config.hazards.densityCapDifficulty ? 1 : ramp;
}

export function progressionSystem(world: World, dt: number): void {
  if (world.runState !== 'running') {
    return;
  }
  world.elapsed += dt;
  world.car.speed = speedAt(world.config, world.elapsed);
}
