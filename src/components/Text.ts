/**
 * Text — a string drawn at the entity's `Transform`.
 *
 * Score, speed readout, menu labels. Style fields mirror Phaser's text style
 * object, so colours here are CSS strings ('#ffffff') rather than the numeric
 * colours `Shape` uses — each matches what its renderer actually consumes.
 *
 * Set `dirty` when `content` changes so the render system knows to push the new
 * string through instead of diffing every entity every frame.
 */

/** Key this component is stored under on an entity. */
export const TEXT = 'text';

/** Horizontal alignment for multi-line strings. */
export const TextAlign = {
  LEFT: 'left',
  CENTER: 'center',
  RIGHT: 'right',
} as const;

export type TextAlignValue = (typeof TextAlign)[keyof typeof TextAlign];

export interface TextComponent {
  readonly type: typeof TEXT;
  content: string;
  fontFamily: string;
  /** pixels */
  fontSize: number;
  /** '', 'bold', 'italic', ... */
  fontStyle: string;
  /** CSS colour */
  color: string;
  /** CSS colour, or null for no outline */
  strokeColor: string | null;
  strokeWidth: number;
  align: TextAlignValue;
  originX: number;
  originY: number;
  alpha: number;
  visible: boolean;
  /** content changed since the last render */
  dirty: boolean;
}

export type TextInit = Partial<Omit<TextComponent, 'type'>>;

export function Text({
  content = '',
  fontFamily = 'monospace',
  fontSize = 16,
  fontStyle = '',
  color = '#ffffff',
  strokeColor = null,
  strokeWidth = 0,
  align = TextAlign.LEFT,
  originX = 0.5,
  originY = 0.5,
  alpha = 1,
  visible = true,
  dirty = true,
}: TextInit = {}): TextComponent {
  return {
    type: TEXT,
    content,
    fontFamily,
    fontSize,
    fontStyle,
    color,
    strokeColor,
    strokeWidth,
    align,
    originX,
    originY,
    alpha,
    visible,
    dirty,
  };
}

export default Text;
