/**
 * KeyboardInputSystem — turns key state into the scene's `UserInput`.
 *
 * One of the two device systems (the other being `TouchInputSystem`). It is the
 * only place in the codebase that knows a keyboard exists; everything
 * downstream reads `up`/`down`/`action` and stays device-agnostic.
 *
 * Physical key state is tracked once for the whole game, in the module-level
 * `pressed` set, rather than per scene. That matters at a scene change: Phaser
 * builds fresh `Key` objects for each scene, and a fresh Key has no idea a key
 * was already held, so a button held across the transition would read as a new
 * press in the new scene. Since PLAY is activated with the same button gameplay
 * uses, that would fire the first game action the instant the menu handed over.
 * A listener that outlives the scenes sees the hold continuously.
 *
 * The other half of that fix is `prime()` — see below.
 *
 * Edges are derived from the previous frame's `down` rather than Phaser's
 * `JustDown`, which consumes the flag when read and so can only be asked once.
 * Deriving them here means `justDown` stays true for the whole frame no matter
 * how many entities look at it.
 */
import { InputButton } from '../components/index.js';

/**
 * Which physical keys drive each button, as KeyboardEvent `code` values. Any
 * one of them counts as pressed.
 */
export const KEY_BINDINGS = Object.freeze({
  [InputButton.UP]: ['ArrowUp', 'KeyW'],
  [InputButton.DOWN]: ['ArrowDown', 'KeyS'],
  [InputButton.ACTION]: ['Space', 'Enter'],
});

const BOUND_CODES = new Set(Object.values(KEY_BINDINGS).flat());

/** Codes currently held, shared by every scene for the life of the page. */
const pressed = new Set();
let listening = false;

function startListening() {
  if (listening || typeof window === 'undefined') return;
  listening = true;

  window.addEventListener('keydown', (event) => {
    if (!BOUND_CODES.has(event.code)) return;
    // Arrows and space scroll the page otherwise.
    event.preventDefault();
    pressed.add(event.code);
  });

  window.addEventListener('keyup', (event) => {
    pressed.delete(event.code);
  });

  // A key released while the tab is unfocused never reports its keyup, so it
  // would stay stuck down forever.
  window.addEventListener('blur', () => pressed.clear());
}

export default class KeyboardInputSystem {
  constructor() {
    startListening();
  }

  /**
   * Samples the keyboard into `userInput`, in place.
   * @param {object} userInput the scene's UserInput component
   */
  update(userInput) {
    for (const button of Object.values(InputButton)) {
      const state = userInput[button];
      const wasDown = state.down;
      const isDown = KEY_BINDINGS[button].some((code) => pressed.has(code));

      state.down = isDown;
      state.justDown = isDown && !wasDown;
      state.justUp = !isDown && wasDown;
    }
  }

  /**
   * Adopts the current key state without reporting any edges, so a scene starts
   * knowing what is already held rather than treating it as freshly pressed.
   * Call once when a scene is created.
   */
  prime(userInput) {
    this.update(userInput);
    for (const button of Object.values(InputButton)) {
      userInput[button].justDown = false;
      userInput[button].justUp = false;
    }
  }
}
