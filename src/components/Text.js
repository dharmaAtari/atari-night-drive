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
export const TextAlign = Object.freeze({
  LEFT: 'left',
  CENTER: 'center',
  RIGHT: 'right',
});

/**
 * @param {object}  [values]
 * @param {string}  [values.content]         the string to draw
 * @param {string}  [values.fontFamily]      CSS font family
 * @param {number}  [values.fontSize]        pixels
 * @param {string}  [values.fontStyle]       '', 'bold', 'italic', ...
 * @param {string}  [values.color]           CSS colour
 * @param {?string} [values.strokeColor]     CSS colour, or null for no outline
 * @param {number}  [values.strokeWidth]     pixels
 * @param {string}  [values.align]           one of {@link TextAlign}
 * @param {number}  [values.originX]         0 = left, 0.5 = centred, 1 = right
 * @param {number}  [values.originY]         0 = top,  0.5 = centred, 1 = bottom
 * @param {number}  [values.alpha]           0..1
 * @param {boolean} [values.visible]         skipped by the renderer when false
 * @param {boolean} [values.dirty]           content changed since last render
 */
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
} = {}) {
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
