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
export const ShapeKind = {
  RECTANGLE: 'rectangle',   // uses width, height
  CIRCLE: 'circle',         // uses radius
  ELLIPSE: 'ellipse',       // uses width, height
  LINE: 'line',             // uses points (2 entries)
  TRIANGLE: 'triangle',     // uses points (3 entries)
  POLYGON: 'polygon',       // uses points (3+ entries)
} as const;

export type ShapeKindValue = (typeof ShapeKind)[keyof typeof ShapeKind];

export interface Point {
  x: number;
  y: number;
}

export interface ShapeComponent {
  readonly type: typeof SHAPE;
  kind: ShapeKindValue;
  width: number;
  height: number;
  radius: number;
  /** line / triangle / polygon vertices, relative to the transform */
  points: Point[];
  /** 0xRRGGBB, or null for no fill */
  fillColor: number | null;
  fillAlpha: number;
  /** 0xRRGGBB, or null for no stroke */
  strokeColor: number | null;
  strokeWidth: number;
  strokeAlpha: number;
  /** 0 = left, 0.5 = centred, 1 = right */
  originX: number;
  /** 0 = top, 0.5 = centred, 1 = bottom */
  originY: number;
  visible: boolean;
}

export type ShapeInit = Partial<Omit<ShapeComponent, 'type'>>;

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
}: ShapeInit = {}): ShapeComponent {
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
