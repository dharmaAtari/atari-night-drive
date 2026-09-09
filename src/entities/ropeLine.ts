/**
 * The rope itself — a line from the car to whatever it has hold of.
 *
 * A `Shape` rather than a sprite because both endpoints move every frame and its
 * colour carries information: it warms toward the warning colour as tension
 * climbs, so the snap is telegraphed rather than sprung. The GDD's tileable rope
 * segment would buy nothing here — there is no texture detail to see on a line
 * two pixels wide at speed.
 */
import Entity from './Entity.js';
import { Shape, ShapeKind, Sprite, Transform } from '../components/index.js';
import { Depth } from './depths.js';

export function ropeLine(): Entity {
  return new Entity('rope.line')
    .add(Transform({ depth: Depth.ROPE }))
    .add(
      Shape({
        kind: ShapeKind.LINE,
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        fillColor: null,
        strokeColor: 0xa8ecff,
        strokeWidth: 2,
        originX: 0,
        originY: 0,
        visible: false,
      }),
    );
}

/** A one-shot burst at the anchor on attach, and again if the rope snaps. */
export function ropeFlash(): Entity {
  return new Entity('rope.flash')
    .add(Transform({ depth: Depth.ROPE + 1 }))
    .add(Sprite({ texture: 'rope.attachFlash', originX: 0.5, originY: 0.5, visible: false }));
}
