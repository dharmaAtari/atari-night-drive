/**
 * Phaser bootstrap.
 *
 * Reads public/config.json first, then starts the game with those settings so
 * the display size, frame rate and palette are all data-driven.
 */
import Phaser from 'phaser';
import { loadConfig } from './config.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';

async function boot(): Promise<Phaser.Game> {
  const config = await loadConfig();
  const { display, performance } = config;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: display.width,
    height: display.height,
    backgroundColor: display.backgroundColor,
    pixelArt: display.pixelArt,
    scale: {
      mode: display.scaleMode,
      autoCenter: display.autoCenter ? Phaser.Scale.CENTER_BOTH : Phaser.Scale.NO_CENTER,
    },
    fps: {
      target: performance.targetFps,
      forceSetTimeOut: true,
    },
    scene: [MenuScene, GameScene],
  });

  // Reachable from any scene as `this.game.registry.get('config')`.
  game.registry.set('config', config);

  if (display.fullscreen) {
    game.events.once(Phaser.Core.Events.READY, () => game.scale.startFullscreen());
  }

  // The headless playtest harness drives the game through this handle.
  if (import.meta.env.DEV) {
    (window as unknown as { __PHASER_GAME__: Phaser.Game }).__PHASER_GAME__ = game;
  }

  return game;
}

boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[night-drive] boot failed:', error);
  document.body.innerHTML =
    `<pre style="color:#f66;font:14px monospace;padding:16px">Boot failed: ${message}</pre>`;
});
