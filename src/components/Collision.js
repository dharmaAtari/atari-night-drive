/**
 * Collision — the bounds an entity is tested against, plus what it hit.
 *
 * Deliberately coarser than `Shape`: colliders stay rectangles and circles even
 * when the drawn shape is a polygon, because that is all the broad phase needs.
 * The collider is centred on the entity's `Transform` and shifted by
 * `offsetX`/`offsetY`.
 *
 * `layer` says what this entity *is*; `mask` says what it *tests against*. Two
 * entities are only considered when each one's mask includes the other's layer,
 * which is what keeps traffic from colliding with itself.
 */

/** Key this component is stored under on an entity. */
export const COLLISION = 'collision';

/** Collider bounds. Rectangles and circles only. */
export const ColliderKind = Object.freeze({
  RECTANGLE: 'rectangle',   // uses width, height
  CIRCLE: 'circle',         // uses radius
});

/**
 * Layer bit flags. Extend with further powers of two as the game grows.
 */
export const CollisionLayer = Object.freeze({
  NONE: 0,
  PLAYER: 1 << 0,
  TRAFFIC: 1 << 1,
  ROADSIDE: 1 << 2,   // barriers, kerbs, scenery you can hit
  PICKUP: 1 << 3,
  TRIGGER: 1 << 4,    // checkpoints, section boundaries
  ALL: 0xffffffff,
});

/**
 * @param {object}  [values]
 * @param {string}  [values.kind]       one of {@link ColliderKind}
 * @param {number}  [values.width]      rectangle
 * @param {number}  [values.height]     rectangle
 * @param {number}  [values.radius]     circle
 * @param {number}  [values.offsetX]    collider centre relative to the transform
 * @param {number}  [values.offsetY]    collider centre relative to the transform
 * @param {number}  [values.layer]      {@link CollisionLayer} bits this entity is
 * @param {number}  [values.mask]       {@link CollisionLayer} bits it tests against
 * @param {boolean} [values.isTrigger]  report overlaps but skip any response
 * @param {boolean} [values.enabled]    skipped entirely when false
 */
export function Collision({
  kind = ColliderKind.RECTANGLE,
  width = 0,
  height = 0,
  radius = 0,
  offsetX = 0,
  offsetY = 0,
  layer = CollisionLayer.NONE,
  mask = CollisionLayer.ALL,
  isTrigger = false,
  enabled = true,
} = {}) {
  return {
    type: COLLISION,
    kind,
    width,
    height,
    radius,
    offsetX,
    offsetY,
    layer,
    mask,
    isTrigger,
    enabled,

    // Written by CollisionSystem each frame; cleared before it runs.
    /** @type {Array<string|number>} entity ids overlapping this frame */
    contacts: [],
  };
}

export default Collision;
