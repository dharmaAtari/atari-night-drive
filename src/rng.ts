/**
 * Seeded random, so a run can be reproduced from its seed.
 *
 * Hazard generation is the only consumer that matters: given the same seed, the
 * same road comes out, which is what makes a bad-feeling run reportable ("seed
 * 418, about forty seconds in") instead of a story. `Math.random` cannot do
 * that, and it is deliberately not used anywhere in generation.
 *
 * The generator is mulberry32 — one 32-bit state word, no dependencies, and a
 * period far beyond what a single run consumes.
 */
export interface Rng {
  /** uniform in [0, 1) */
  next(): number;
  int(maxExclusive: number): number;
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** picks a key with probability proportional to its weight */
  weighted<T extends string>(weights: Record<T, number>): T;
  chance(probability: number): boolean;
  readonly seed: number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  // A zero state is a fixed point for this generator: it would return the same
  // number forever. Any non-zero constant breaks it; the golden-ratio word is
  // the conventional choice.
  if (state === 0) state = 0x9e3779b9;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    range: (min, max) => min + next() * (max - min),
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    weighted<T extends string>(weights: Record<T, number>): T {
      const keys = Object.keys(weights) as T[];
      let total = 0;
      for (const key of keys) total += weights[key];

      let roll = next() * total;
      for (const key of keys) {
        roll -= weights[key];
        if (roll <= 0) return key;
      }
      // Only reachable through floating-point slop on the final key.
      return keys[keys.length - 1]!;
    },
    chance: (probability) => next() < probability,
    get seed() {
      return seed;
    },
  };
}

/** `?seed=123` from a query string, or null when absent or unparseable. */
export function parseSeed(search: string): number | null {
  const match = /[?&]seed=(\d+)/.exec(search);
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 10);
  return Number.isFinite(value) ? value >>> 0 : null;
}

/** The seed for a run: whatever the URL asked for, else the clock. */
export function resolveSeed(search: string, now: number): number {
  return parseSeed(search) ?? now >>> 0;
}
