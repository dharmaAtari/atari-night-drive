/**
 * BootScene — loads every asset the config names, then hands over to the menu.
 *
 * Nothing else in the game loads anything. Systems ask for textures and sounds
 * by logical key ('car.body', 'rope.throw'), and the only places a key is tied
 * to a file are `config.assets` and `config.audio.sounds`, which means
 * re-skinning or re-voicing is a config edit and no code change.
 *
 * Art ships as SVG and is rasterised once here, at a size chosen per asset. That
 * is a deliberate trade: the animation model is transform-only — states are
 * produced by scaling, rotating and fading art, never by morphing paths — so
 * there are no per-frame pixel differences a sprite atlas could store. An atlas
 * would add download size, memory and blur at non-native scale and buy nothing.
 *
 * The one real sheet is the pedestrian walk cycle, authored as four cells side
 * by side in a single SVG. Phaser's loader has no notion of a spritesheet inside
 * an SVG, so after it rasterises the strip this scene slices the texture into
 * frames by hand. That is what lets `AnimationSystem` drive it like any sheet.
 *
 * A failed asset is reported and skipped rather than fatal. One missing file
 * should cost you one sprite, not the whole game.
 */
import Phaser from 'phaser';
import { SceneKey } from './keys.js';
import type { GameConfig } from '../config.js';

export default class BootScene extends Phaser.Scene {
  private readonly config: GameConfig;

  constructor(config: GameConfig) {
    super({ key: SceneKey.BOOT });
    this.config = config;
  }

  preload(): void {
    const base = import.meta.env.BASE_URL;

    for (const [key, asset] of Object.entries(this.config.assets.sprites)) {
      this.load.svg(key, `${base}${asset.file}`, { scale: asset.scale });
    }

    for (const [key, asset] of Object.entries(this.config.assets.animations)) {
      this.load.svg(key, `${base}${asset.file}`, { scale: asset.scale });
    }

    // Sounds follow the same rule as sprites: the only place a key meets a
    // file is `config.audio.sounds`. `AudioSystem` checks the cache before
    // playing, so a missing sound costs one cue, not the soundtrack.
    for (const [key, file] of Object.entries(this.config.audio.sounds)) {
      this.load.audio(key, `${base}${file}`);
    }

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`BootScene: could not load '${file.key}' from ${file.url}`);
    });
  }

  create(): void {
    this.sliceAnimationSheets();
    this.scene.start(SceneKey.MENU);
  }

  /**
   * Cuts each loaded strip into uniform frames named 0..n-1.
   *
   * Frame width comes from the rasterised texture rather than the authored
   * viewBox, so the `scale` in config can change without the slicing drifting.
   * The cells are uniform and share a registration point by construction — they
   * are laid out in one SVG — which is what stops the walk cycle jittering.
   */
  private sliceAnimationSheets(): void {
    for (const [key, asset] of Object.entries(this.config.assets.animations)) {
      const texture = this.textures.exists(key) ? this.textures.get(key) : null;
      if (!texture) {
        console.warn(`BootScene: animation '${key}' did not load; it will not be sliced`);
        continue;
      }

      const source = texture.getSourceImage();
      const width = source.width;
      const height = source.height;
      const frameWidth = Math.floor(width / asset.frameCount);

      if (frameWidth <= 0) {
        console.warn(`BootScene: animation '${key}' is ${width}px wide, too narrow for ${asset.frameCount} frames`);
        continue;
      }

      for (let i = 0; i < asset.frameCount; i++) {
        texture.add(i, 0, i * frameWidth, 0, frameWidth, height);
      }
    }
  }
}
