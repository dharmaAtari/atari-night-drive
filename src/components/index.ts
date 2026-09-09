/**
 * Barrel for the component library, so entity factories can pull what they need
 * from one place:
 *
 *   import { Transform, Shape, SHAPE } from '../components/index.js';
 */

export { Transform, TRANSFORM } from './Transform.js';
export type { TransformComponent, TransformInit } from './Transform.js';

export { Shape, SHAPE, ShapeKind } from './Shape.js';
export type { ShapeComponent, ShapeInit, ShapeKindValue, Point } from './Shape.js';

export { Text, TEXT, TextAlign } from './Text.js';
export type { TextComponent, TextInit, TextAlignValue } from './Text.js';

export { Collision, COLLISION, ColliderKind, CollisionLayer } from './Collision.js';
export type { CollisionComponent, CollisionInit, ColliderKindValue } from './Collision.js';

export { UserInput, USER_INPUT, InputButton } from './UserInput.js';
export type { UserInputComponent, InputButtonValue, ButtonState } from './UserInput.js';

export { Animation, ANIMATION } from './Animation.js';
export type { AnimationComponent, AnimationInit } from './Animation.js';

import { TRANSFORM, type TransformComponent } from './Transform.js';
import { SHAPE, type ShapeComponent } from './Shape.js';
import { TEXT, type TextComponent } from './Text.js';
import { COLLISION, type CollisionComponent } from './Collision.js';
import { USER_INPUT, type UserInputComponent } from './UserInput.js';
import { ANIMATION, type AnimationComponent } from './Animation.js';

/**
 * Every component key in one map — the set systems query against, and the
 * single place to look when checking a key hasn't drifted.
 */
export const ComponentType = {
  TRANSFORM,
  SHAPE,
  TEXT,
  COLLISION,
  USER_INPUT,
  ANIMATION,
} as const;

/**
 * Component key -> the component stored under it. This is what lets
 * `entity.get(TRANSFORM)` come back typed as a `TransformComponent` rather than
 * as some union the caller has to narrow by hand.
 */
export interface ComponentMap {
  [TRANSFORM]: TransformComponent;
  [SHAPE]: ShapeComponent;
  [TEXT]: TextComponent;
  [COLLISION]: CollisionComponent;
  [USER_INPUT]: UserInputComponent;
  [ANIMATION]: AnimationComponent;
}

export type ComponentKey = keyof ComponentMap;

/** Any component, as a discriminated union on `type`. */
export type AnyComponent = ComponentMap[ComponentKey];
