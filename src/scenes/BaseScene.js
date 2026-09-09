/**
 * BaseScene — the ECS frame loop every scene inherits.
 *
 * Gives each scene an entity list, one authoritative `UserInput`, and the two
 * functions the game is driven by:
 *
 *   update()  device input -> entity input -> scene logic
 *   render()  entity components -> Phaser game objects
 *
 * The order in `update()` is the important part. Device state is read once per
 * frame, fanned out to every entity that carries a `UserInput`, and only then
 * does scene logic run — so by the time a scene looks at an entity's input, it
 * is already up to date. Rendering happens last, on the transforms that logic
 * just wrote, which is what keeps the highlight from lagging a frame behind.
 *
 * Subclasses fill in `build()` and `updateEntities()` rather than overriding
 * `update()` itself, so they cannot accidentally run their logic before input
 * has been read or after the frame has been drawn.
 *
 * On create the input is primed: whatever is held at that moment is adopted as
 * already-down rather than reported as a press, so the button that started this
 * scene does not immediately trigger something inside it.
 *
 * Note: the scene's input component is `this.userInput`, never `this.input` —
 * that name belongs to Phaser's own input plugin.
 */
import Phaser from '../../bin/lib/phaser.esm.js';
import { UserInput } from '../components/index.js';
import RenderSystem from '../systems/RenderSystem.js';
import KeyboardInputSystem from '../systems/KeyboardInputSystem.js';
import UserInputSystem from '../systems/UserInputSystem.js';

export default class BaseScene extends Phaser.Scene {
  constructor(config) {
    super(config);

    /** @type {import('../entities/Entity.js').default[]} */
    this.entities = [];

    /**
     * The scene's own input state — the single thing device systems write and
     * `UserInputSystem` reads. Entities get copies of it, not this object.
     */
    this.userInput = UserInput();
  }

  create() {
    this.entities = [];

    this.renderSystem = new RenderSystem(this);
    this.keyboardInputSystem = new KeyboardInputSystem();
    this.userInputSystem = new UserInputSystem();

    this.build();

    // Adopt whatever is already held (the button that started this scene, most
    // likely) so the first frame does not read it as a fresh press.
    this.keyboardInputSystem.prime(this.userInput);

    this.render();

    // Scenes get restarted; game objects from the last run must not leak.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.renderSystem.destroy());
  }

  /** Subclass hook: create this scene's entities. */
  build() {}

  /**
   * Subclass hook: scene logic for the frame. Entity `UserInput` components are
   * already current when this runs, and anything written to a `Transform` here
   * is picked up by the render that follows.
   *
   * @param {number} time   ms since the game started
   * @param {number} delta  ms since the previous frame
   */
  updateEntities(time, delta) {} // eslint-disable-line no-unused-vars

  /** Registers an entity with the scene and returns it. */
  addEntity(entity) {
    this.entities.push(entity);
    return entity;
  }

  /** Called by Phaser once per frame. */
  update(time, delta) {
    this.keyboardInputSystem.update(this.userInput);
    this.userInputSystem.update(this.entities, this.userInput);
    this.updateEntities(time, delta);

    // updateEntities may have started another scene, in which case this one is
    // on its way out and has nothing left worth drawing.
    if (this.scene.isActive()) {
      this.render();
    }
  }

  /** Draws the current state of every entity. */
  render() {
    this.renderSystem.render(this.entities);
  }
}
