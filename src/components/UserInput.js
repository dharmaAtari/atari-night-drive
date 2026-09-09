/**
 * UserInput — the player's intent, with the device it came from stripped off.
 *
 * This is the seam the ECS split exists for. `KeyboardInputSystem` and
 * `TouchInputSystem` both write to this same component, and no gameplay system
 * ever learns which one did. Adding a gamepad or tilt controller means adding a
 * system that writes these three buttons, not touching gameplay code.
 *
 * The whole input surface:
 *
 *   up, down — menu navigation only; gameplay ignores them
 *   action   — the only button the game itself reads
 *
 * Each is tracked as three flags rather than a bare boolean, because held and
 * pressed mean different things here: menus step one row per press and so read
 * `justDown`, while gameplay may want `down` for as long as the button is held.
 *
 *   down      true for every frame the button is held
 *   justDown  true only on the frame it went down
 *   justUp    true only on the frame it came back up
 *
 * The edge flags are true for exactly one frame, so an input system must clear
 * them at the start of each frame before writing the new ones.
 */

/** Key this component is stored under on an entity. */
export const USER_INPUT = 'userInput';

/**
 * The button names, for systems that want to walk all three rather than name
 * each one — clearing edge flags, remapping keys, drawing a debug overlay.
 */
export const InputButton = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  ACTION: 'action',
});

/** @returns {{down: boolean, justDown: boolean, justUp: boolean}} */
function buttonState() {
  return { down: false, justDown: false, justUp: false };
}

/**
 * Takes no arguments: every button starts released, and only input systems have
 * any business setting them.
 */
export function UserInput() {
  return {
    type: USER_INPUT,

    /** menu navigation — move the selection up */
    up: buttonState(),
    /** menu navigation — move the selection down */
    down: buttonState(),
    /** the one button gameplay reads */
    action: buttonState(),
  };
}

export default UserInput;
