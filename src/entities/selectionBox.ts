/**
 * The menu highlight — the box that moves between options.
 *
 * It carries the `UserInput` component because it is the thing the player is
 * actually steering: the menu reads up/down off this entity to decide which
 * option is selected, and then writes the result to its own `Transform`.
 */
import Entity from './Entity.js';
import { Transform, Shape, UserInput, ShapeKind } from '../components/index.js';

/** Drawn behind the labels, which sit at depth 1. */
const BOX_DEPTH = 0;

export interface SelectionBoxInit {
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** 0xRRGGBB */
  strokeColor?: number;
  strokeWidth?: number;
}

export default function selectionBox({
  x,
  y,
  width = 200,
  height = 36,
  strokeColor = 0xffffff,
  strokeWidth = 2,
}: SelectionBoxInit): Entity {
  return new Entity('menu.selectionBox')
    .add(Transform({ x, y, depth: BOX_DEPTH }))
    .add(
      Shape({
        kind: ShapeKind.RECTANGLE,
        width,
        height,
        fillColor: null, // outline only, so the label stays readable through it
        strokeColor,
        strokeWidth,
        originX: 0.5,
        originY: 0.5,
      }),
    )
    .add(UserInput());
}
