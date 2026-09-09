import type { GameConfigFile } from '../config';
import type { World } from '../world';

const BEST_KEY = 'nightline.best';

export function scoreAt(config: GameConfigFile, elapsedSeconds: number): number {
  return Math.floor(elapsedSeconds * config.score.pointsPerSecond);
}

export interface RunRecord {
  best: number;
}

export function createRunRecord(): RunRecord {
  return { best: 0 };
}

export function loadBest(record: RunRecord): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return;
    }
    const raw = storage.getItem(BEST_KEY);
    if (raw === null) {
      return;
    }
    const value = Number(raw);
    if (Number.isFinite(value) && value > record.best) {
      record.best = value;
    }
  } catch {
    return;
  }
}

export function saveBest(record: RunRecord): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return;
    }
    storage.setItem(BEST_KEY, String(record.best));
  } catch {
    return;
  }
}

export function scoreSystem(world: World, record: RunRecord): number {
  const current = scoreAt(world.config, world.elapsed);
  if (current > record.best) {
    record.best = current;
  }
  return current;
}
