import { describe, it, expect } from 'vitest';
import { parseSeed, resolveSeed } from './seed';

describe('parseSeed', () => {
  it('reads a seed from a query string', () => {
    expect(parseSeed('?seed=42')).toBe(42);
    expect(parseSeed('?debug=1&seed=7')).toBe(7);
  });

  it('returns null when absent or malformed', () => {
    expect(parseSeed('')).toBeNull();
    expect(parseSeed('?seed=')).toBeNull();
    expect(parseSeed('?seed=abc')).toBeNull();
    expect(parseSeed('?seedling=5')).toBeNull();
  });
});

describe('resolveSeed', () => {
  it('prefers the query seed and falls back to the clock', () => {
    expect(resolveSeed('?seed=99', 12345)).toBe(99);
    expect(resolveSeed('', 12345)).toBe(12345);
  });

  it('always returns an unsigned 32-bit value', () => {
    expect(resolveSeed('', -1)).toBeGreaterThanOrEqual(0);
    expect(resolveSeed('', 2 ** 40 + 5)).toBeGreaterThanOrEqual(0);
  });
});
