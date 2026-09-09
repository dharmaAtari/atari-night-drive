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
export const ColliderKind = {
  RECTANGLE: 'rectangle',   // uses width, height
  CIRCLE: 'circle',         // uses radius
} as const;

export type ColliderKindValue = (typeof ColliderKind)[keyof typeof ColliderKind];

/** Layer bit flags. Extend with further powers of two as the game grows. */
export const CollisionLayer = {
  NONE: 0,
  PLAYER: 1 << 0,
  TRAFFIC: 1 << 1,
  ROADSIDE: 1 << 2,   // barriers, kerbs, scenery you can hit
  PICKUP: 1 << 3,
  TRIGGER: 1 << 4,    // checkpoints, section boundaries
  ALL: 0xffffffff,
} as const;

export interface CollisionComponent {
  readonly type: typeof COLLISION;
  kind: ColliderKindValue;
  width: number;
  height: number;
  radius: number;
  /** collider centre relative to the transform */
  offsetX: number;
  offsetY: number;
  /** CollisionLayer bits this entity is */
  layer: number;
  /** CollisionLayer bits it tests against */
  mask: number;
  /** report overlaps but skip any response */
  isTrigger: boolean;
  enabled: boolean;
  /** entity ids overlapping this frame; written by CollisionSystem */
  contacts: number[];
}

export type CollisionInit = Partial<Omit<CollisionComponent, 'type' | 'contacts'>>;

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
}: CollisionInit = {}): CollisionComponent {
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
    contacts: [],
  };
}

export default Collision;
