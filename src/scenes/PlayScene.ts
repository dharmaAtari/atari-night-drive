import Phaser from 'phaser';
import type { GameConfigFile } from '../config';
import type { World } from '../world';
import { createWorld } from '../world';
import { viewportSystem } from '../systems/ViewportSystem';
import { renderSystem } from '../systems/RenderSystem';
import { touchInputSystem } from '../systems/TouchInputSystem';
import type { KeyboardBindings } from '../systems/KeyboardInputSystem';
import { createKeyboardBindings, keyboardInputSystem } from '../systems/KeyboardInputSystem';

export class PlayScene extends Phaser.Scene {
  private world!: World;
  private graphics!: Phaser.GameObjects.Graphics;
  private bindings: KeyboardBindings | null = null;

  constructor(private readonly gameConfig: GameConfigFile) {
    super('play');
  }

  create(): void {
    this.world = createWorld(this.gameConfig);

    this.cameras.main.setBackgroundColor('#000000');
    this.graphics = this.add.graphics();
    this.bindings = createKeyboardBindings(this);

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__NIGHT_LINE__ = {
        world: this.world,
      };
    }

    viewportSystem(this.world, this.cameras.main.width, this.cameras.main.height);
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
  }

  update(): void {
    this.world.input.steer = 0;
    this.world.input.confirmHeld = false;
    keyboardInputSystem(this.world, this.bindings);
    touchInputSystem(this.world, this);

    renderSystem(this.world, this.graphics);
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    viewportSystem(this.world, gameSize.width, gameSize.height);
  }
}
