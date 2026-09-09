/**
 * A selectable menu row — the label only. The highlight behind it is a separate
 * entity (`selectionBox`) so the two can move independently.
 */
import Entity from './Entity.js';
import { Transform, Text, TextAlign } from '../components/index.js';

/** Drawn above the selection box, which sits at depth 0. */
const LABEL_DEPTH = 1;

export interface MenuOptionInit {
  /** the text shown, e.g. 'PLAY' */
  label: string;
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
}

export default function menuOption({
  label,
  x,
  y,
  fontSize = 24,
  color = '#ffffff',
}: MenuOptionInit): Entity {
  return new Entity(`menu.${label.toLowerCase()}`)
    .add(Transform({ x, y, depth: LABEL_DEPTH }))
    .add(
      Text({
        content: label,
        fontFamily: 'monospace',
        fontSize,
        color,
        align: TextAlign.CENTER,
        originX: 0.5,
        originY: 0.5,
      }),
    );
}
