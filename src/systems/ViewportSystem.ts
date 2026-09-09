import type { World } from '../world';

export function viewportSystem(world: World, width: number, height: number): void {
  const { viewport } = world;
  viewport.width = width;
  viewport.height = height;
  viewport.halfWidth = width / 2;
}
