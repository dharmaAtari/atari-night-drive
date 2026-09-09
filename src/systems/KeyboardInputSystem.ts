import Phaser from 'phaser';
import type { World } from '../world';

export interface KeyboardBindings {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  altLeft: Phaser.Input.Keyboard.Key;
  altRight: Phaser.Input.Keyboard.Key;
  confirm: Phaser.Input.Keyboard.Key;
}

export function createKeyboardBindings(scene: Phaser.Scene): KeyboardBindings | null {
  const keyboard = scene.input.keyboard;
  if (!keyboard) {
    return null;
  }

  return {
    left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
    right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    altLeft: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    altRight: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    confirm: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
  };
}

export function keyboardInputSystem(world: World, bindings: KeyboardBindings | null): void {
  if (!bindings) {
    return;
  }

  const left = bindings.left.isDown || bindings.altLeft.isDown;
  const right = bindings.right.isDown || bindings.altRight.isDown;

  if (left !== right) {
    world.input.steer = left ? -1 : 1;
  }

  if (bindings.confirm.isDown) {
    world.input.confirmHeld = true;
  }
}
