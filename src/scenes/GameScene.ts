import Phaser from 'phaser';
import type { GameConfigFile } from '../config';
import type { World } from '../world';
import { createWorld, resetRun } from '../world';
import { SCENE_KEYS } from '../types/scene-keys';
import { viewportSystem } from '../systems/ViewportSystem';
import { createTrackSystem, debugPresetCurvature } from '../systems/TrackSystem';
import { createHazardSpawnSystem, curvatureFromHazards } from '../systems/HazardSpawnSystem';
import type { HazardSpawnSystem } from '../systems/HazardSpawnSystem';
import { progressionSystem, difficultyAt } from '../systems/ProgressionSystem';
import { createRunRecord, loadBest, saveBest, scoreSystem } from '../systems/ScoreSystem';
import type { RunRecord } from '../systems/ScoreSystem';
import { createAudioSystem } from '../systems/AudioSystem';
import type { AudioSystem } from '../systems/AudioSystem';
import { notifyArkadiumReady } from '../platform/arkadium';
import { resolveSeed } from '../seed';
import {
  oneButtonInputSystem,
  createOneButtonBindings,
  releaseHold,
} from '../systems/OneButtonInputSystem';
import type { OneButtonBindings } from '../systems/OneButtonInputSystem';
import { anchorSystem } from '../systems/AnchorSystem';
import { ropeSystem } from '../systems/RopeSystem';
import { driftSystem } from '../systems/DriftSystem';
import { lightSystem } from '../systems/LightSystem';
import { createPickupSystem } from '../systems/PickupSystem';
import type { PickupSystem } from '../systems/PickupSystem';
import { collisionSystem } from '../systems/CollisionSystem';
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
  private runTrackSystem!: (world: World, dt: number) => void;
  private inputBindings: OneButtonBindings | null = null;
  private pickupSystem!: PickupSystem;
  private spawnSystem!: HazardSpawnSystem;
  private audio!: AudioSystem;
  private record!: RunRecord;
  private messageText!: Phaser.GameObjects.Text;
  private crashTimer = 0;
  private announcedReady = false;

  constructor(private readonly gameConfig: GameConfigFile) {
    super(SCENE_KEYS.Game);
  }

  create(): void {
    this.world = createWorld(this.gameConfig);
    this.runTrackSystem = this.world.config.debug.autoCentre
      ? createTrackSystem((s) => debugPresetCurvature(s, this.world.config))
      : createTrackSystem(curvatureFromHazards(this.world));

    this.inputBindings = createOneButtonBindings(this);
    this.pickupSystem = createPickupSystem();
    this.spawnSystem = createHazardSpawnSystem(resolveSeed(window.location.search, Date.now()));
    this.audio = createAudioSystem();
    this.record = createRunRecord();
    loadBest(this.record);

    this.cameras.main.setBackgroundColor('#000000');
    this.graphics = this.add.graphics();
    this.hudGraphics = this.add.graphics().setDepth(HUD_DEPTH);
    this.scoreText = this.add.text(0, 0, '0').setDepth(HUD_DEPTH);
    this.messageText = this.add.text(0, 0, '', { align: 'center' }).setOrigin(0.5).setDepth(HUD_DEPTH);

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__NIGHT_LINE__ = {
        world: this.world,
      };
    }

    this.applyViewport();

    window.addEventListener('resize', this.handleResize);
    window.visualViewport?.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    this.game.events.on(Phaser.Core.Events.BLUR, this.handleBlur, this);
    this.events.once('shutdown', this.handleShutdown, this);
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, MAX_DELTA_MS) / 1000;
    const { world } = this;

    oneButtonInputSystem(world, this, this.inputBindings);

    if (world.input.pressedThisFrame) {
      this.audio.unlock();
      if (world.runState === 'over') {
        this.restartRun();
      }
    }

    if (world.runState === 'running') {
      progressionSystem(world, dt);
      this.spawnSystem.run(world, difficultyAt(world.config, world.elapsed));
      this.runTrackSystem(world, dt);
      anchorSystem(world);
      ropeSystem(world, dt);
      driftSystem(world, dt);
      lightSystem(world, dt, world.car.speed * dt);
      this.pickupSystem.run(world);

      if (collisionSystem(world)) {
        this.crashTimer = world.config.fail.impactSeconds;
        scoreSystem(world, this.record);
        saveBest(this.record);
        this.cameras.main.shake(220, 0.012);
      }
    } else if (world.runState === 'crashing') {
      this.crashTimer -= dt;
      if (this.crashTimer <= 0) {
        world.runState = 'over';
      }
    }

    cameraSystem(world);
    this.audio.update(world, dt);

    roadRenderSystem(world, this.graphics, world.elapsed);
    hudRenderSystem(world, this.hudGraphics, this.scoreText, world.elapsed);
    this.renderMessage();

    world.events.length = 0;

    if (!this.announcedReady) {
      this.announcedReady = true;
      void notifyArkadiumReady(world.config.platform.arkadium);
    }
  }

  private renderMessage(): void {
    const { world } = this;
    const { viewport } = world;
    const size = Math.max(12, Math.round(Math.min(viewport.renderWidth, viewport.renderHeight) * 0.032));
    this.messageText.setFontSize(size);
    this.messageText.setPosition(viewport.renderWidth / 2, viewport.renderHeight * 0.3);

    if (world.runState === 'over') {
      const seedLine = world.config.debug.showSeed ? `\nSEED ${this.spawnSystem.seed}` : '';
      const prompt = world.input.method === 'touch' ? 'TAP TO RETRY' : 'PRESS TO RETRY';
      this.messageText.setText(
        `${Math.floor(world.elapsed)}\nBEST ${this.record.best}${seedLine}\n\n${prompt}`,
      );
    } else {
      this.messageText.setText('');
    }
  }

  private restartRun(): void {
    resetRun(this.world);
    this.pickupSystem.reset();
    this.spawnSystem.reset(Date.now() >>> 0);
    this.crashTimer = 0;
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

  private readonly handleBlur = (): void => {
    releaseHold(this.world.input);
  };

  private readonly handleShutdown = (): void => {
    window.removeEventListener('resize', this.handleResize);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    this.game.events.off(Phaser.Core.Events.BLUR, this.handleBlur, this);
  };
}
