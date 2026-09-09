/**
 * The player's car, as three entities that move together.
 *
 * Split by layer rather than drawn as one sprite, because each part answers to
 * something different: the body leans with the rope, the rear lights pulse on
 * their own clock, and the cone grows and shrinks with headlight power. Keeping
 * them separate means none of those needs a redrawn asset — every state is a
 * transform on art that already exists.
 *
 * The car is the only entity carrying `UserInput`, which is what makes it the
 * thing the player *is* rather than a thing they watch. Its `Collision` width is
 * the real one: `CollisionSystem` reads it to decide what kills you.
 */
import Entity from './Entity.js';
import {
  Collision,
  ColliderKind,
  CollisionLayer,
  Sprite,
  Transform,
  UserInput,
} from '../components/index.js';
import { Depth } from './depths.js';

/**
 * The car's footprint as a fraction of one lane. Narrower than the lane it sits
 * in, so a swing that clips the edge of a blocked lane survives — the collider
 * being generous here is what keeps a well-timed rope from feeling cheated.
 */
export const CAR_LANE_FRACTION = 0.7;

export function car(): Entity {
  return new Entity('car')
    .add(Transform({ depth: Depth.CAR }))
    .add(Sprite({ texture: 'car.body', originX: 0.5, originY: 0.5 }))
    .add(UserInput())
    .add(
      Collision({
        kind: ColliderKind.RECTANGLE,
        // Lane units, not pixels — this is compared against hazard lanes in
        // world space, so it must not depend on how big the window is.
        width: CAR_LANE_FRACTION,
        height: 1,
        layer: CollisionLayer.PLAYER,
        mask: CollisionLayer.ROADSIDE | CollisionLayer.TRAFFIC | CollisionLayer.PICKUP,
      }),
    );
}

/** Drawn over the body so it can pulse without the body being redrawn. */
export function carRearLights(): Entity {
  return new Entity('car.rearLights')
    .add(Transform({ depth: Depth.CAR + 1 }))
    .add(Sprite({ texture: 'car.rearLights', originX: 0.5, originY: 0.5 }));
}

/**
 * The headlight cone. Its apex is the car's nose, so the origin sits at the
 * bottom-centre of the art and the whole cone scales from that point — one
 * asset covering low beam, normal and high beam.
 */
export function headlightCone(): Entity {
  return new Entity('car.headlightCone')
    .add(Transform({ depth: Depth.HEADLIGHT_CONE }))
    .add(Sprite({ texture: 'car.headlightCone', originX: 0.5, originY: 1, alpha: 0.5 }));
}
