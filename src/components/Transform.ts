/**
 * Transform — where an entity is, how it is turned, and how big it is.
 *
 * The one component almost everything else is positioned by: `Shape`, `Text`
 * and `Collision` are all resolved relative to it. Pure data; `MovementSystem`
 * writes `x`/`y`, `RenderSystem` reads them.
 */

/** Key this component is stored under on an entity. */
export const TRANSFORM = 'transform';

export interface TransformComponent {
  readonly type: typeof TRANSFORM;
  /** world x in pixels */
  x: number;
  /** world y in pixels */
  y: number;
  /** radians, clockwise, 0 = facing right */
  rotation: number;
  scaleX: number;
  scaleY: number;
  /** render sort order; higher draws on top */
  depth: number;
}

export interface TransformInit {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  depth?: number;
}

export function Transform({
  x = 0,
  y = 0,
  rotation = 0,
  scaleX = 1,
  scaleY = 1,
  depth = 0,
}: TransformInit = {}): TransformComponent {
  return { type: TRANSFORM, x, y, rotation, scaleX, scaleY, depth };
}

export default Transform;
