/**
 * A hazard standing in a lane.
 *
 * Carries an `Animation` because one obstacle — the pedestrian — is a walk
 * cycle rather than a still. `ObstacleViewSystem` leaves the component parked on
 * frame 0 for every other kind, which costs nothing: `AnimationSystem` steps
 * only what is playing.
 *
 * The `Collision` component describes the footprint in lane units. It is not
 * read by `CollisionSystem` — that works in world space off the hazard record —
 * but it is what the debug overlay draws, and it keeps the collider a property
 * of the entity rather than a number buried in a system.
 */
import Entity from './Entity.js';
import {
  Animation,
  Collision,
  ColliderKind,
  CollisionLayer,
  Sprite,
  Transform,
} from '../components/index.js';
import { Depth } from './depths.js';

export function obstacle(index: number): Entity {
  return new Entity(`obstacle.${index}`)
    .add(Transform({ depth: Depth.OBSTACLE }))
    .add(Sprite({ texture: 'obstacle.stalled', originX: 0.5, originY: 1, visible: false }))
    .add(Animation({ frameCount: 1, playing: false }))
    .add(
      Collision({
        kind: ColliderKind.RECTANGLE,
        width: 1,
        height: 1,
        layer: CollisionLayer.ROADSIDE,
        mask: CollisionLayer.PLAYER,
      }),
    );
}
