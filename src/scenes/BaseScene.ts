/**
 * BaseScene — the ECS frame loop every scene inherits.
 *
 * Gives each scene an entity list, one authoritative `UserInput`, and the two
 * functions the game is driven by:
 *
 *   update()  device input -> entity input -> animation -> scene logic
 *   render()  entity components -> Phaser game objects
 *
 * The order in `update()` is the important part. Device state is read once per
 * frame, fanned out to every entity that carries a `UserInput`, and only then
 * does scene logic run — so by the time a scene looks at an entity's input, it
 * is already up to date. Animations step in between, so a scene watching for
 * `animationEnded` sees it on the frame it happens. Rendering happens last, on
 * the transforms that logic just wrote, which is what keeps the highlight from
 * lagging a frame behind.
 *
 * Subclasses fill in three hooks rather than overriding `update()`, so they
 * cannot accidentally run logic before input has been read or after the frame
 * has been drawn:
 *
 *   build()           create entities
 *   layout(w, h)      position them for the current canvas size
 *   updateEntities()  per-frame logic
 *
 * `layout` is separate from `build` because the canvas size is not fixed. It
 * runs on create and again on every resize, and it is the reason no scene
 * stores a width or height of its own — a module-level GAME_WIDTH freezes at
 * import time and breaks on rotation or a collapsing mobile toolbar.
 *
 * On create the input is primed: whatever is held at that moment is adopted as
 * already-down rather than reported as a press, so the button that started this
 * scene does not immediately trigger something inside it.
 *
 * Note: the scene's input component is `this.userInput`, never `this.input` —
 * that name belongs to Phaser's own input plugin.
 */
import Phaser from 'phaser';
import Entity from '../entities/Entity.js';
import { UserInput, type UserInputComponent } from '../components/index.js';
import RenderSystem from '../systems/RenderSystem.js';
import KeyboardInputSystem from '../systems/KeyboardInputSystem.js';
import UserInputSystem from '../systems/UserInputSystem.js';
import AnimationSystem from '../systems/AnimationSystem.js';

export default abstract class BaseScene extends Phaser.Scene {
  entities: Entity[] = [];

  /**
   * The scene's own input state — the single thing device systems write and
   * `UserInputSystem` reads. Entities get copies of it, not this object.
   */
  readonly userInput: UserInputComponent = UserInput();

  protected renderSystem!: RenderSystem;
  protected keyboardInputSystem!: KeyboardInputSystem;
  protected userInputSystem!: UserInputSystem;
  protected animationSystem!: AnimationSystem;

  create(): void {
    this.entities = [];

    this.renderSystem = new RenderSystem(this);
    this.keyboardInputSystem = new KeyboardInputSystem();
    this.userInputSystem = new UserInputSystem();
    this.animationSystem = new AnimationSystem();

    this.build();
    this.relayout();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.relayout, this);

    // Adopt whatever is already held (the button that started this scene, most
    // likely) so the first frame does not read it as a fresh press.
    this.keyboardInputSystem.prime(this.userInput);

    this.render();

    // Scenes get restarted; game objects and listeners must not leak.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.relayout, this);
      this.renderSystem.destroy();
    });
  }

  /** Subclass hook: create this scene's entities. */
  protected build(): void {}

  /**
   * Subclass hook: position entities for the given canvas size. Runs on create
   * and on every resize, so it must be safe to call repeatedly.
   */
  protected layout(_width: number, _height: number): void {}

  /**
   * Subclass hook: scene logic for the frame. Entity `UserInput` components are
   * already current when this runs, and anything written to a `Transform` here
   * is picked up by the render that follows.
   */
  protected updateEntities(_time: number, _delta: number): void {}

  /** Registers an entity with the scene and returns it. */
  protected addEntity<T extends Entity>(entity: T): T {
    this.entities.push(entity);
    return entity;
  }

  /** Re-runs layout against the live camera size. */
  private relayout(): void {
    const camera = this.cameras.main;
    this.layout(camera.width, camera.height);
  }

  /** Called by Phaser once per frame. */
  override update(time: number, delta: number): void {
    this.keyboardInputSystem.update(this.userInput);
    this.userInputSystem.update(this.entities, this.userInput);
    this.animationSystem.update(this.entities, delta);
    this.updateEntities(time, delta);

    // updateEntities may have started another scene, in which case this one is
    // on its way out and has nothing left worth drawing.
    if (this.scene.isActive()) {
      this.render();
    }
  }

  /** Draws the current state of every entity. */
  render(): void {
    this.renderSystem.render(this.entities);
  }
}
