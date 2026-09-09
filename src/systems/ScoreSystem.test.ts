import { describe, it, expect, afterEach } from 'vitest';
import { makeWorld, makeConfig } from '../testing/makeWorld';
import { scoreAt, createRunRecord, loadBest, saveBest, scoreSystem } from './ScoreSystem';

describe('scoreAt', () => {
  const config = makeConfig();

  it('is 1 point per second', () => {
    expect(scoreAt(config, 5)).toBe(5);
  });

  it('floors partial seconds', () => {
    expect(scoreAt(config, 0.9)).toBe(0);
    expect(scoreAt(config, 1.0)).toBe(1);
  });
});

describe('createRunRecord', () => {
  it('starts best at 0', () => {
    expect(createRunRecord()).toEqual({ best: 0 });
  });
});

describe('scoreSystem', () => {
  it('returns the current score', () => {
    const world = makeWorld();
    world.elapsed = 5;
    const record = createRunRecord();
    expect(scoreSystem(world, record)).toBe(5);
  });

  it('updates record.best when the current score beats it', () => {
    const world = makeWorld();
    const record = createRunRecord();
    world.elapsed = 5;
    scoreSystem(world, record);
    expect(record.best).toBe(5);
  });

  it('never lowers record.best', () => {
    const world = makeWorld();
    const record = createRunRecord();
    world.elapsed = 10;
    scoreSystem(world, record);
    expect(record.best).toBe(10);

    world.elapsed = 3;
    scoreSystem(world, record);
    expect(record.best).toBe(10);
  });
});

describe('loadBest / saveBest', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
    } else {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it('does not throw and keeps record.best when localStorage is undefined', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    const record = createRunRecord();
    record.best = 42;

    expect(() => saveBest(record)).not.toThrow();
    expect(() => loadBest(record)).not.toThrow();
    expect(record.best).toBe(42);
  });

  it('does not throw and keeps record.best when localStorage getters/setters throw', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get(): Storage {
        throw new Error('storage blocked');
      },
    });
    const record = createRunRecord();
    record.best = 7;

    expect(() => saveBest(record)).not.toThrow();
    expect(() => loadBest(record)).not.toThrow();
    expect(record.best).toBe(7);
  });

  it('round-trips best through a real localStorage', () => {
    const store = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    } as unknown as Storage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: fakeStorage,
    });

    const writer = createRunRecord();
    writer.best = 99;
    saveBest(writer);

    const reader = createRunRecord();
    loadBest(reader);
    expect(reader.best).toBe(99);
  });
});
