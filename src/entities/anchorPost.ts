/**
 * A lit anchor post — the brightest thing in the frame after the headlight cone.
 *
 * The most important object on screen. Its pulse while the throw window is open
 * is the entire tutorial: no text explains when to press, the light does. Which
 * is why the texture is swapped per state rather than merely tinted — dormant,
 * open and attached are three different pieces of art, and the pickup variants
 * are two more.
 *
 * Anchored at the base, like the scenery posts it is descended from, so it
 * stands on the road at every distance.
 */
import Entity from './Entity.js';
import { Sprite, Transform } from '../components/index.js';
import { Depth } from './depths.js';

export function anchorPost(index: number): Entity {
  return new Entity(`anchor.${index}`)
    .add(Transform({ depth: Depth.ANCHOR }))
    .add(Sprite({ texture: 'anchor.dormant', originX: 0.5, originY: 1, visible: false }));
}
