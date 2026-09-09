/**
 * The title screen's mark — a road running to a lit anchor.
 *
 * Says what the game is before a word is read: darkness, a road converging, and
 * one bright post beside it. The wordmark is left to `Text`, so the title reads
 * in any locale without new art.
 */
import Entity from './Entity.js';
import { Sprite, Transform } from '../components/index.js';
import { Depth } from './depths.js';

export default function titleMark(): Entity {
  return new Entity('menu.titleMark')
    .add(Transform({ depth: Depth.ROAD_SURFACE }))
    .add(Sprite({ texture: 'ui.titleMark', originX: 0.5, originY: 0.5, alpha: 0.9 }));
}
