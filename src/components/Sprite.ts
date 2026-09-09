/**
 * Sprite — a loaded texture drawn at the entity's `Transform`.
 *
 * The counterpart to `Shape`: `Shape` is a primitive the renderer builds from
 * numbers, `Sprite` is a bitmap the loader already put in the texture manager.
 * `texture` is a logical key from `config.assets.sprites`, never a file path —
 * the path is resolved once at load time, so nothing downstream knows where the
 * art lives.
 *
 * `frame` addresses one cell of a sliced sheet (see `BootScene`); it stays 0 for
 * a single-image texture. An entity that also carries `Animation` has this field
 * written for it every frame by `AnimationSystem`'s output — see `ActorSystem`.
 *
 * Tint is `0xRRGGBB` like `Shape`, and null means "draw the texture's own
 * colours". Tint mode is deliberately not exposed: Phaser 4 replaced `tintFill`
 * with a separate mode enum, and every use here wants the default multiply.
 */

/** Key this component is stored under on an entity. */
export const SPRITE = 'sprite';

export interface SpriteComponent {
  readonly type: typeof SPRITE;
  /** logical key from config.assets.sprites, e.g. 'car.body' */
  texture: string;
  /** frame index within a sliced sheet; 0 for a plain image */
  frame: number;
  /** 0xRRGGBB, or null to draw the texture unmodified */
  tint: number | null;
  alpha: number;
  /** 0 = left, 0.5 = centred, 1 = right */
  originX: number;
  /** 0 = top, 0.5 = centred, 1 = bottom */
  originY: number;
  visible: boolean;
}

export type SpriteInit = Partial<Omit<SpriteComponent, 'type'>>;

export function Sprite({
  texture = '',
  frame = 0,
  tint = null,
  alpha = 1,
  originX = 0.5,
  originY = 0.5,
  visible = true,
}: SpriteInit = {}): SpriteComponent {
  return { type: SPRITE, texture, frame, tint, alpha, originX, originY, visible };
}

export default Sprite;
