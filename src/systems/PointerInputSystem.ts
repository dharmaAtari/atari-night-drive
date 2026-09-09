/**
 * PointerInputSystem — touch and mouse, written into the same `UserInput`.
 *
 * The second device system alongside `KeyboardInputSystem`, and the whole point
 * of the ECS split: it writes `action` and nothing downstream learns a finger
 * was involved. Adding it required touching no gameplay code at all.
 *
 * Anywhere on the canvas is the button. There is only one verb, so there is
 * nothing to aim at — except the left edge, which is masked off because on
 * Android and iOS a swipe from there is the system back gesture, and a player
 * who accidentally throws the rope on their way out of the app has been robbed.
 *
 * Edges are derived from the previous frame's state rather than Phaser's
 * `JustDown`, matching `KeyboardInputSystem`, so `justDown` stays true for the
 * whole frame however many readers ask.
 */
import type Phaser from 'phaser';
import { InputButton, type UserInputComponent } from '../components/index.js';

export default class PointerInputSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly edgeGuardPx: number,
  ) {}

  /** The combined key-or-pointer state as of last frame, for edge detection. */
  private prevDown = false;

  /**
   * ORs pointer state into `userInput`. Runs *after* the keyboard system so a
   * held key and a held finger both keep the button down, and neither cancels
   * the other on a device that has both.
   *
   * Because it runs last it also owns the `action` edges outright: the keyboard
   * system's edges were computed before the pointer was known, so recomputing
   * them here against this system's own previous combined state is the only way
   * a finger press reports as a press. Reading `state.down` for "was it down"
   * would read *this* frame's keyboard value, not last frame's.
   */
  update(userInput: UserInputComponent): void {
    const state = userInput[InputButton.ACTION];
    const down = state.down || this.pointerDown();

    state.down = down;
    state.justDown = down && !this.prevDown;
    state.justUp = !down && this.prevDown;
    this.prevDown = down;
  }

  /** Adopts what is already held without reporting an edge. See the keyboard twin. */
  prime(userInput: UserInputComponent): void {
    this.update(userInput);
    const state = userInput[InputButton.ACTION];
    state.justDown = false;
    state.justUp = false;
  }

  private pointerDown(): boolean {
    for (const pointer of this.scene.input.manager.pointers) {
      if (!pointer.active || !pointer.isDown) continue;
      // Touches only: a mouse near the left edge is not a back gesture.
      if (pointer.wasTouch && pointer.x < this.edgeGuardPx) continue;
      return true;
    }
    return false;
  }
}
