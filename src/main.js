/**
 * Phaser bootstrap.
 *
 * Reads bin/config.xml first, then starts the game with those settings so the
 * display size, frame rate and palette are all data-driven.
 */
import Phaser from '../bin/lib/phaser.esm.js';
import { loadConfig } from './config.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';

async function boot() {
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
      mode: Phaser.Scale[display.scaleMode],
      autoCenter: display.autoCenter ? Phaser.Scale.CENTER_BOTH : Phaser.Scale.NO_CENTER,
    },
    fps: {
      target: performance.targetFps,
      forceSetTimeOut: true,
    },
    scene: [MenuScene, GameScene],
  });

  // Make the parsed config reachable from any scene via `this.game.config.runtime`.
  game.config.runtime = config;

  if (display.fullscreen) {
    game.events.once(Phaser.Core.Events.READY, () => game.scale.startFullscreen());
  }

  return game;
}

boot().catch((error) => {
  console.error('[night-drive] boot failed:', error);
  document.body.innerHTML =
    `<pre style="color:#f66;font:14px monospace;padding:16px">Boot failed: ${error.message}</pre>`;
});
