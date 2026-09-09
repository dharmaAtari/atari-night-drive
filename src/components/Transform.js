/**
 * Transform — where an entity is, how it is turned, and how big it is.
 *
 * The one component almost everything else is positioned by: `Shape`, `Text`
 * and `Collision` are all resolved relative to it. Pure data; `MovementSystem`
 * writes `x`/`y`, `RenderSystem` reads them.
 */

/** Key this component is stored under on an entity. */
export const TRANSFORM = 'transform';

/**
 * @param {object}  [values]
 * @param {number}  [values.x]         world x in pixels
 * @param {number}  [values.y]         world y in pixels
 * @param {number}  [values.rotation]  radians, clockwise, 0 = facing right
 * @param {number}  [values.scaleX]    1 = native size
 * @param {number}  [values.scaleY]    1 = native size
 * @param {number}  [values.depth]     render sort order; higher draws on top
 */
export function Transform({
  x = 0,
  y = 0,
  rotation = 0,
  scaleX = 1,
  scaleY = 1,
  depth = 0,
} = {}) {
  return { type: TRANSFORM, x, y, rotation, scaleX, scaleY, depth };
}

export default Transform;
