import type Phaser from 'phaser';
import type { World } from '../world';
import type { InputState } from '../components/InputState';

// DOM keyCode values for Space and Enter (Phaser.Input.Keyboard.KeyCodes.SPACE / .ENTER).
// Hardcoded rather than importing the Phaser runtime, so this module stays import-type-only
// and pulling in the pure reducer for tests never touches Phaser's `window`-dependent boot code.
const KEY_CODE_SPACE = 32;
const KEY_CODE_ENTER = 13;

export interface InputSources {
  pointerDown: boolean;
  pointerWasTouch: boolean;
  keyDown: boolean;
  keyJustDown: boolean;
  gamepadDown: boolean;
  gamepadJustDown: boolean;
}

export interface OneButtonBindings {
  space: Phaser.Input.Keyboard.Key;
  enter: Phaser.Input.Keyboard.Key;
}

// Default edge-guard width in px, mirroring config.input.edgeGuardPx's tuning default.
// The live guard always reads world.config.input.edgeGuardPx; this constant is exported
// for callers that need the default without a World in hand.
export const EDGE_GUARD_PX = 24;

/**
 * Pure reducer. `state.held` is read at entry as `prevHeld` (last frame's value) before
 * being overwritten, so no separate prevHeld argument or field is needed.
 */
export function reduceInput(state: InputState, sources: InputSources): void {
  const prevHeld = state.held;
  const held = sources.pointerDown || sources.keyDown || sources.gamepadDown;
  const pressedThisFrame = held && !prevHeld;

  state.held = held;
  state.pressedThisFrame = pressedThisFrame;

  if (pressedThisFrame) {
    if (sources.pointerDown) {
      state.method = sources.pointerWasTouch ? 'touch' : 'mouse';
    } else if (sources.keyDown) {
      state.method = 'keyboard';
    } else if (sources.gamepadDown) {
      state.method = 'gamepad';
    }
  }
}

export function releaseHold(state: InputState): void {
  state.held = false;
  state.pressedThisFrame = false;
}

export function createOneButtonBindings(scene: Phaser.Scene): OneButtonBindings | null {
  const keyboard = scene.input.keyboard;
  if (!keyboard) {
    return null;
  }
  return {
    space: keyboard.addKey(KEY_CODE_SPACE, true, false),
    enter: keyboard.addKey(KEY_CODE_ENTER, true, false),
  };
}

function findHoldingPointer(scene: Phaser.Scene): Phaser.Input.Pointer | null {
  const pointers = scene.input.manager.pointers;
  for (const pointer of pointers) {
    if (pointer.active && pointer.isDown) {
      return pointer;
    }
  }
  return null;
}

function isEdgeGuarded(pointer: Phaser.Input.Pointer, world: World): boolean {
  if (!pointer.wasTouch) {
    return false;
  }
  const { edgeGuardPx } = world.config.input;
  const { renderWidth } = world.viewport;
  return renderWidth > 0 && pointer.x < edgeGuardPx;
}

export function oneButtonInputSystem(
  world: World,
  scene: Phaser.Scene,
  bindings: OneButtonBindings | null,
): void {
  const pointer = findHoldingPointer(scene);
  const pointerDown = pointer !== null && !isEdgeGuarded(pointer, world);
  const pointerWasTouch = pointer?.wasTouch ?? false;

  const keyDown = !!bindings && (bindings.space.isDown || bindings.enter.isDown);

  const pads = scene.input.gamepad?.getAll() ?? [];
  const gamepadDown = pads.some((pad) => pad.buttons.some((button) => button.pressed));

  // Auto-repeat is already suppressed by addKey(code, capture, emitOnRepeat=false), and the
  // edge itself is computed by reduceInput from held/prevHeld, so keyJustDown/gamepadJustDown
  // are reported as their current-frame down state.
  reduceInput(world.input, {
    pointerDown,
    pointerWasTouch,
    keyDown,
    keyJustDown: keyDown,
    gamepadDown,
    gamepadJustDown: gamepadDown,
  });
}
