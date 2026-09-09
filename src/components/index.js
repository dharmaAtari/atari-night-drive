/**
 * Barrel for the component library, so entity factories can pull what they need
 * from one place:
 *
 *   import { Transform, Shape, SHAPE } from '../components/index.js';
 */

export { Transform, TRANSFORM } from './Transform.js';
export { Shape, SHAPE, ShapeKind } from './Shape.js';
export { Text, TEXT, TextAlign } from './Text.js';
export { Collision, COLLISION, ColliderKind, CollisionLayer } from './Collision.js';
export { UserInput, USER_INPUT, InputButton } from './UserInput.js';

import { TRANSFORM } from './Transform.js';
import { SHAPE } from './Shape.js';
import { TEXT } from './Text.js';
import { COLLISION } from './Collision.js';
import { USER_INPUT } from './UserInput.js';

/**
 * Every component key in one map — the set systems query against, and the
 * single place to look when checking a key hasn't drifted.
 */
export const ComponentType = Object.freeze({
  TRANSFORM,
  SHAPE,
  TEXT,
  COLLISION,
  USER_INPUT,
});
