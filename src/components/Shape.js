/**
 * Shape — a primitive the renderer draws at the entity's `Transform`.
 *
 * Enough to build the whole game out of vector primitives (road edges, cars,
 * horizon) before any art exists. Colours are numeric `0xRRGGBB` because that
 * is what Phaser's Graphics API takes.
 */

/** Key this component is stored under on an entity. */
export const SHAPE = 'shape';

/** Which primitive to draw, and therefore which size fields matter. */
export const ShapeKind = Object.freeze({
  RECTANGLE: 'rectangle',   // uses width, height
  CIRCLE: 'circle',         // uses radius
  ELLIPSE: 'ellipse',       // uses width, height
  LINE: 'line',             // uses points (2 entries)
  TRIANGLE: 'triangle',     // uses points (3 entries)
  POLYGON: 'polygon',       // uses points (3+ entries)
});

/**
 * @param {object}   [values]
 * @param {string}   [values.kind]         one of {@link ShapeKind}
 * @param {number}   [values.width]        rectangle / ellipse
 * @param {number}   [values.height]       rectangle / ellipse
 * @param {number}   [values.radius]       circle
 * @param {Array<{x:number,y:number}>} [values.points]  line / triangle / polygon,
 *                                                      relative to the transform
 * @param {?number}  [values.fillColor]    0xRRGGBB, or null for no fill
 * @param {number}   [values.fillAlpha]    0..1
 * @param {?number}  [values.strokeColor]  0xRRGGBB, or null for no stroke
 * @param {number}   [values.strokeWidth]  pixels
 * @param {number}   [values.strokeAlpha]  0..1
 * @param {number}   [values.originX]      0 = left, 0.5 = centred, 1 = right
 * @param {number}   [values.originY]      0 = top,  0.5 = centred, 1 = bottom
 * @param {boolean}  [values.visible]      skipped by the renderer when false
 */
export function Shape({
  kind = ShapeKind.RECTANGLE,
  width = 0,
  height = 0,
  radius = 0,
  points = [],
  fillColor = 0xffffff,
  fillAlpha = 1,
  strokeColor = null,
  strokeWidth = 0,
  strokeAlpha = 1,
  originX = 0.5,
  originY = 0.5,
  visible = true,
} = {}) {
  return {
    type: SHAPE,
    kind,
    width,
    height,
    radius,
    points,
    fillColor,
    fillAlpha,
    strokeColor,
    strokeWidth,
    strokeAlpha,
    originX,
    originY,
    visible,
  };
}

export default Shape;
