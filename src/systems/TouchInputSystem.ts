import type Phaser from 'phaser';
import type { World } from '../world';

export function touchInputSystem(world: World, scene: Phaser.Scene): void {
  const midpoint = world.viewport.cssWidth / 2;

  for (const pointer of scene.input.manager.pointers) {
    if (!pointer.isDown) {
      continue;
    }

    world.input.steer = pointer.x < midpoint ? -1 : 1;
    world.input.confirmHeld = true;
    return;
  }
}
