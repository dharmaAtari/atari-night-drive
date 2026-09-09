/**
 * ScoreSystem — one point per second survived, and nothing else.
 *
 * No combo, no style bonus for a late swing. Survival is the only currency,
 * which keeps the HUD quiet and stops the game arguing with itself about what
 * it wants the player to do.
 *
 * `best` is persisted, but every storage call is wrapped: private browsing and
 * sandboxed iframes both throw on access, and a score board is never worth
 * taking the game down for.
 */
import type { GameConfig } from '../config.js';
import { RunState, type World } from '../world.js';

const BEST_KEY = 'nightdrive.best';

export function scoreAt(config: GameConfig, elapsedSeconds: number): number {
  return Math.floor(elapsedSeconds * config.score.pointsPerSecond);
}

/** The score right now, whether or not the run has ended. */
export function currentScore(world: World): number {
  return scoreAt(world.config, world.run.elapsed);
}

export function loadBest(world: World): void {
  try {
    const raw = globalThis.localStorage?.getItem(BEST_KEY);
    if (raw === null || raw === undefined) return;
    const value = Number(raw);
    if (Number.isFinite(value) && value > world.run.best) world.run.best = value;
  } catch {
    // Storage unavailable; best stays at whatever this session has seen.
  }
}

export function saveBest(world: World): void {
  try {
    globalThis.localStorage?.setItem(BEST_KEY, String(world.run.best));
  } catch {
    // Nothing to do — the run still scored, it just will not be remembered.
  }
}

/** Folds the finished run into `best`. Call once, on the frame the run ends. */
export function scoreSystem(world: World): number {
  if (world.run.state === RunState.RUNNING) return currentScore(world);

  const score = currentScore(world);
  if (score > world.run.best) world.run.best = score;
  return score;
}
