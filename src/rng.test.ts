import { describe, it, expect } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = Array.from({ length: 50 }, () => createRng(42).next());
    const b = createRng(42);
    expect(a[0]).toBe(b.next());
    const first = Array.from({ length: 20 }, () => createRng(7).next());
    expect(new Set(first).size).toBe(1);
  });

  it('produces different streams for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('stays within [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 5000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int and range respect bounds', () => {
    const rng = createRng(5);
    for (let i = 0; i < 1000; i++) {
      expect(rng.int(3)).toBeLessThan(3);
      const r = rng.range(2, 5);
      expect(r).toBeGreaterThanOrEqual(2);
      expect(r).toBeLessThan(5);
    }
  });

  it('weighted only returns declared keys and honours zero weight', () => {
    const rng = createRng(11);
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      seen.add(rng.weighted({ a: 3, b: 1, never: 0 }));
    }
    expect(seen.has('never')).toBe(false);
    expect(seen).toContain('a');
    expect(seen).toContain('b');
  });

  it('survives a zero seed', () => {
    expect(() => createRng(0).next()).not.toThrow();
    expect(createRng(0).next()).toBeGreaterThanOrEqual(0);
  });
});
