export function parseSeed(search: string): number | null {
  const match = /[?&]seed=([0-9]+)/.exec(search);
  if (!match) {
    return null;
  }
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value >>> 0 : null;
}

export function resolveSeed(search: string, now: number): number {
  return parseSeed(search) ?? now >>> 0;
}
