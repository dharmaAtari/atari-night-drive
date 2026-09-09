/**
 * Phaser bootstrap.
 *
 * Reads `public/config.json` before the game exists, so display size, frame rate
 * and the whole asset manifest are data rather than code. The parsed config goes
 * into the registry immediately, which is where every scene reads it from —
 * nothing imports the loader a second time.
 *
 * Scene order is boot, menu, play: `BootScene` loads what the config names and
 * then starts the menu, so no other scene ever has to check whether its textures
 * arrived.
 */
import Phaser from 'phaser';
import { loadConfig } from './config.js';
import BootScene from './scenes/BootScene.js';
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
    // One pointer is all a one-button game can use, and asking for more costs
    // real work per frame on touch devices.
    input: { activePointers: 1, gamepad: config.input.gamepad },
    fps: {
      target: performance.targetFps,
      forceSetTimeOut: true,
    },
    scene: [new BootScene(config), MenuScene, GameScene],
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
