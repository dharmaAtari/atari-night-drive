import type Phaser from 'phaser';
import type { World } from '../world';

export function renderSystem(_world: World, graphics: Phaser.GameObjects.Graphics): void {
  graphics.clear();
}
