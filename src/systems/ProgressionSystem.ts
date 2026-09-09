/**
 * ProgressionSystem — the clock, the speed ramp, and the difficulty curve.
 *
 * Speed rises continuously, never in steps, and caps at 3x the starting speed
 * after `rampSeconds`. Past the cap it holds constant forever: difficulty keeps
 * climbing through hazard density and variety instead, because a game that just
 * kept accelerating would eventually cross the reaction-window floor and stop
 * being fair.
 *
 * The ramp is smoothstepped rather than linear so the first thirty seconds do
 * not feel like the game is already rushing.
 */
import type { GameConfig } from '../config.js';
import { RunState, type World } from '../world.js';

export function smoothstep(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/** 0 at the start of a run, 1 once the speed cap is reached. */
export function rampAt(config: GameConfig, elapsedSeconds: number): number {
  return smoothstep(elapsedSeconds / config.speed.rampSeconds);
}

/** Always 3x the start speed — the one number the design fixes rather than tunes. */
export function speedCap(config: GameConfig): number {
  return 3 * config.speed.start;
}

export function speedAt(config: GameConfig, elapsedSeconds: number): number {
  const { start } = config.speed;
  return start + (speedCap(config) - start) * rampAt(config, elapsedSeconds);
}

/**
 * 0..1, driving hazard spacing and combo eligibility. Saturates at
 * `densityCapDifficulty` so density stops tightening before it can violate the
 * one-rope-cycle-between-hazards rule.
 */
export function difficultyAt(config: GameConfig, elapsedSeconds: number): number {
  const ramp = rampAt(config, elapsedSeconds);
  return ramp >= config.hazards.densityCapDifficulty ? 1 : ramp;
}

export function progressionSystem(world: World, dt: number): void {
  if (world.run.state !== RunState.RUNNING) return;
  world.run.elapsed += dt;
  world.car.speed = speedAt(world.config, world.run.elapsed);
}
