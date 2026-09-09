import Phaser from 'phaser';
import type { GameConfigFile } from '../config';
import type { World } from '../world';
import { createWorld } from '../world';
import { SCENE_KEYS } from '../types/scene-keys';
import { viewportSystem } from '../systems/ViewportSystem';
import { touchInputSystem } from '../systems/TouchInputSystem';
import type { KeyboardBindings } from '../systems/KeyboardInputSystem';
import { createKeyboardBindings, keyboardInputSystem } from '../systems/KeyboardInputSystem';
import { createTrackSystem, debugPresetCurvature, trackSystem as defaultTrackSystem } from '../systems/TrackSystem';
import { driftSystem } from '../systems/DriftSystem';
import { cameraSystem } from '../systems/CameraSystem';
import { roadRenderSystem } from '../systems/RoadRenderSystem';
import { hudRenderSystem } from '../systems/HudRenderSystem';

const MAX_DELTA_MS = 50;
const HUD_DEPTH = 10;

function readSafeInset(name: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return parseFloat(value) || 0;
}

export class GameScene extends Phaser.Scene {
  private world!: World;
  private graphics!: Phaser.GameObjects.Graphics;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private bindings: KeyboardBindings | null = null;
  private runTrackSystem!: (world: World, dt: number) => void;

  constructor(private readonly gameConfig: GameConfigFile) {
    super(SCENE_KEYS.Game);
  }

  create(): void {
    this.world = createWorld(this.gameConfig);
    this.runTrackSystem = this.world.config.debug.autoCentre
      ? createTrackSystem((s) => debugPresetCurvature(s, this.world.config))
      : defaultTrackSystem;

    this.cameras.main.setBackgroundColor('#000000');
    this.graphics = this.add.graphics();
    this.hudGraphics = this.add.graphics().setDepth(HUD_DEPTH);
    this.scoreText = this.add.text(0, 0, '0').setDepth(HUD_DEPTH);
    this.bindings = createKeyboardBindings(this);

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__NIGHT_LINE__ = {
        world: this.world,
      };
    }

    this.applyViewport();

    window.addEventListener('resize', this.handleResize);
    window.visualViewport?.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    this.events.once('shutdown', this.handleShutdown, this);
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, MAX_DELTA_MS) / 1000;

    this.world.input.steer = 0;
    this.world.input.confirmHeld = false;
    keyboardInputSystem(this.world, this.bindings);
    touchInputSystem(this.world, this);

    this.runTrackSystem(this.world, dt);
    driftSystem(this.world, dt);
    cameraSystem(this.world);

    roadRenderSystem(this.world, this.graphics);
    hudRenderSystem(this.world, this.hudGraphics, this.scoreText);
  }

  private applyViewport(): void {
    const cssWidth = window.visualViewport?.width ?? window.innerWidth;
    const cssHeight = window.visualViewport?.height ?? window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    viewportSystem(this.world, {
      cssWidth,
      cssHeight,
      dpr,
      safeTop: readSafeInset('--sat'),
      safeRight: readSafeInset('--sar'),
      safeBottom: readSafeInset('--sab'),
      safeLeft: readSafeInset('--sal'),
    });

    const { viewport } = this.world;
    this.scale.resize(viewport.renderWidth, viewport.renderHeight);

    const canvasStyle = this.game.canvas.style;
    canvasStyle.width = `${viewport.cssWidth}px`;
    canvasStyle.height = `${viewport.cssHeight}px`;
  }

  private readonly handleResize = (): void => {
    this.applyViewport();
  };

  private readonly handleShutdown = (): void => {
    window.removeEventListener('resize', this.handleResize);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
  };
}
