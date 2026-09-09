import { describe, it, expect } from 'vitest';
import { makeWorld } from '../testing/makeWorld';
import { reduceInput, releaseHold } from './OneButtonInputSystem';
import type { InputSources } from './OneButtonInputSystem';

function sources(overrides: Partial<InputSources> = {}): InputSources {
  return {
    pointerDown: false,
    pointerWasTouch: false,
    keyDown: false,
    keyJustDown: false,
    gamepadDown: false,
    gamepadJustDown: false,
    ...overrides,
  };
}

describe('reduceInput', () => {
  it('held is true when the pointer is down', () => {
    const world = makeWorld();
    reduceInput(world.input, sources({ pointerDown: true }));
    expect(world.input.held).toBe(true);
  });

  it('held is true when a key is down', () => {
    const world = makeWorld();
    reduceInput(world.input, sources({ keyDown: true }));
    expect(world.input.held).toBe(true);
  });

  it('held is true when a gamepad button is down', () => {
    const world = makeWorld();
    reduceInput(world.input, sources({ gamepadDown: true }));
    expect(world.input.held).toBe(true);
  });

  it('held is false when nothing is down', () => {
    const world = makeWorld();
    reduceInput(world.input, sources());
    expect(world.input.held).toBe(false);
  });

  it('pressedThisFrame is true exactly once across a held press, then false while still held', () => {
    const world = makeWorld();

    reduceInput(world.input, sources({ keyDown: true }));
    expect(world.input.pressedThisFrame).toBe(true);

    for (let i = 0; i < 10; i++) {
      reduceInput(world.input, sources({ keyDown: true }));
      expect(world.input.pressedThisFrame).toBe(false);
      expect(world.input.held).toBe(true);
    }
  });

  it('a held key that stays down does not re-fire on later frames', () => {
    const world = makeWorld();
    reduceInput(world.input, sources({ keyDown: true }));
    reduceInput(world.input, sources({ keyDown: true }));
    reduceInput(world.input, sources({ keyDown: true }));
    expect(world.input.pressedThisFrame).toBe(false);
  });

  it('pressedThisFrame fires again after a release and a new press', () => {
    const world = makeWorld();
    reduceInput(world.input, sources({ keyDown: true }));
    expect(world.input.pressedThisFrame).toBe(true);

    reduceInput(world.input, sources());
    expect(world.input.held).toBe(false);
    expect(world.input.pressedThisFrame).toBe(false);

    reduceInput(world.input, sources({ keyDown: true }));
    expect(world.input.pressedThisFrame).toBe(true);
    expect(world.input.held).toBe(true);
  });

  it('method is touch when the fresh press comes from a touch pointer', () => {
    const world = makeWorld();
    reduceInput(world.input, sources({ pointerDown: true, pointerWasTouch: true }));
    expect(world.input.method).toBe('touch');
  });

  it('method is mouse when the fresh press comes from a non-touch pointer', () => {
    const world = makeWorld();
    reduceInput(world.input, sources({ pointerDown: true, pointerWasTouch: false }));
    expect(world.input.method).toBe('mouse');
  });

  it('method is keyboard when the fresh press comes from a key', () => {
    const world = makeWorld();
    reduceInput(world.input, sources({ keyDown: true }));
    expect(world.input.method).toBe('keyboard');
  });

  it('method is gamepad when the fresh press comes from a gamepad', () => {
    const world = makeWorld();
    reduceInput(world.input, sources({ gamepadDown: true }));
    expect(world.input.method).toBe('gamepad');
  });

  it('method priority is pointer over keyboard over gamepad on a simultaneous fresh press', () => {
    const world = makeWorld();
    reduceInput(
      world.input,
      sources({ pointerDown: true, pointerWasTouch: false, keyDown: true, gamepadDown: true }),
    );
    expect(world.input.method).toBe('mouse');
  });

  it('method is not cleared when the hold releases', () => {
    const world = makeWorld();
    reduceInput(world.input, sources({ keyDown: true }));
    expect(world.input.method).toBe('keyboard');

    reduceInput(world.input, sources());
    expect(world.input.method).toBe('keyboard');
    expect(world.input.held).toBe(false);
  });

  it('method is not overwritten while a press continues to be held', () => {
    const world = makeWorld();
    reduceInput(world.input, sources({ keyDown: true }));
    expect(world.input.method).toBe('keyboard');

    // gamepadDown also true this frame, but the key press is not fresh anymore, so
    // method must not switch mid-hold.
    reduceInput(world.input, sources({ keyDown: true, gamepadDown: true }));
    expect(world.input.method).toBe('keyboard');
  });
});

describe('releaseHold', () => {
  it('clears held and the edge, and leaves method untouched', () => {
    const world = makeWorld();
    reduceInput(world.input, sources({ keyDown: true }));
    expect(world.input.held).toBe(true);
    expect(world.input.method).toBe('keyboard');

    releaseHold(world.input);

    expect(world.input.held).toBe(false);
    expect(world.input.pressedThisFrame).toBe(false);
    expect(world.input.method).toBe('keyboard');
  });
});
