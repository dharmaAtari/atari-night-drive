export interface Rng {
  next(): number;
  int(maxExclusive: number): number;
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  weighted<T extends string>(weights: Record<T, number>): T;
  chance(probability: number): boolean;
  readonly seed: number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  if (state === 0) {
    state = 0x9e3779b9;
  }

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
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted<T extends string>(weights: Record<T, number>): T {
      const keys = Object.keys(weights) as T[];
      let total = 0;
      for (const key of keys) {
        total += weights[key];
      }
      let roll = next() * total;
      for (const key of keys) {
        roll -= weights[key];
        if (roll <= 0) {
          return key;
        }
      }
      return keys[keys.length - 1];
    },
    chance: (probability) => next() < probability,
    get seed() {
      return seed;
    },
  };
}
