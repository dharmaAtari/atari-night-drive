import Phaser from 'phaser';
import { loadConfig } from './config';
import { PlayScene } from './scenes/PlayScene';

async function bootstrap(): Promise<void> {
  const config = await loadConfig();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#000000',
    fps: { target: config.performance.targetFps, forceSetTimeOut: false },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scene: [new PlayScene(config)],
  });

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__PHASER_GAME__ = game;
  }
}

void bootstrap();
