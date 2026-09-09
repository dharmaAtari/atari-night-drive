/**
 * An unlit roadside post — the 1976 lineage, kept as scenery.
 *
 * In Night Driver these were the entire road: sixteen white rectangles marking
 * the edges, with no surface drawn between them. Here they are decoration and a
 * speed cue, streaming past at a rate that reads as velocity. They carry no
 * anchor of their own, and that is exactly what makes a lit anchor legible —
 * it reads as one of these, but special.
 */
import Entity from './Entity.js';
import { Sprite, Transform } from '../components/index.js';
import { Depth } from './depths.js';

export function reflectorPost(index: number): Entity {
  return new Entity(`post.${index}`)
    .add(Transform({ depth: Depth.REFLECTOR_POST }))
    .add(
      Sprite({
        texture: 'road.reflectorPost',
        // Anchored at the base so it stands on the road rather than floating
        // over it as it scales with distance.
        originX: 0.5,
        originY: 1,
        visible: false,
      }),
    );
}
