import { describe, it, expect } from 'vitest';
import { makeWorld } from '../testing/makeWorld';
import { createAudioSystem } from './AudioSystem';

// This suite runs under Vitest's `node` environment, which has no AudioContext. It therefore
// only exercises the "audio unavailable" path: creation, unlock, update and dispose must all
// be silent no-ops that never throw. The Web Audio graph itself is not mockable here and is
// left to manual/browser verification.
describe('AudioSystem (no AudioContext)', () => {
  it('starts not ready, and update() is a silent no-op before unlock()', () => {
    const system = createAudioSystem();
    expect(system.ready).toBe(false);
    expect(() => system.update(makeWorld(), 1 / 60)).not.toThrow();
    expect(system.ready).toBe(false);
  });

  it('unlock() leaves ready false without throwing when AudioContext is unavailable', () => {
    const system = createAudioSystem();
    expect(() => system.unlock()).not.toThrow();
    expect(system.ready).toBe(false);
  });

  it('update() after a failed unlock() is still a silent no-op', () => {
    const system = createAudioSystem();
    system.unlock();
    const world = makeWorld();
    world.rope.tension = 0.9;
    world.light.power = 0;
    expect(() => system.update(world, 1 / 60)).not.toThrow();
    expect(system.ready).toBe(false);
  });

  it('dispose() never throws, before or after unlock()', () => {
    const system = createAudioSystem();
    expect(() => system.dispose()).not.toThrow();

    const system2 = createAudioSystem();
    system2.unlock();
    expect(() => system2.dispose()).not.toThrow();
    expect(system2.ready).toBe(false);
  });

  it('is silent across repeated updates carrying every kind of GameEvent', () => {
    const system = createAudioSystem();
    system.unlock();
    const world = makeWorld();
    world.events = [
      { type: 'rope-attached', anchorId: 1 },
      { type: 'rope-missed' },
      { type: 'rope-snapped' },
      { type: 'crashed', cause: 'obstacle' },
    ];
    expect(() => system.update(world, 1 / 60)).not.toThrow();
    expect(system.ready).toBe(false);
  });
});
