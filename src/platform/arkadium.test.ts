import { describe, it, expect } from 'vitest';
import { notifyArkadiumReady } from './arkadium';

describe('notifyArkadiumReady', () => {
  it('is a no-op resolving false when the flag is off', async () => {
    await expect(notifyArkadiumReady(false)).resolves.toBe(false);
  });

  it('resolves false rather than throwing when there is no DOM or SDK', async () => {
    await expect(notifyArkadiumReady(true)).resolves.toBe(false);
  });
});
