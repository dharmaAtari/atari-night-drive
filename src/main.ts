import Phaser from 'phaser';
import { loadConfig } from './config';
import { GameScene } from './scenes/GameScene';

async function bootstrap(): Promise<void> {
  const config = await loadConfig();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#000000',
    fps: { target: config.performance.targetFps, forceSetTimeOut: false },
    scale: {
      mode: Phaser.Scale.NONE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    input: { activePointers: 1 },
    scene: [new GameScene(config)],
  });

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__PHASER_GAME__ = game;
  }
}

void bootstrap();
