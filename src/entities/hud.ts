/**
 * The HUD: a score, two meters, a prompt, the 3-2-1, and nothing else.
 *
 * Minimal by design — the dark is the game, and a bright HUD would light it up.
 * There is deliberately no speedometer, distance, lap or combo readout: speed is
 * felt through the engine tone and the streaming road, not read.
 *
 * The meters are a sprite frame with a `Shape` rectangle filling it, rather than
 * two art states, because the fill has to be continuous — a bar that could only
 * be empty or full would not show power draining, which is the one thing it
 * exists to show.
 */
import Entity from './Entity.js';
import { Shape, ShapeKind, Sprite, Text, TextAlign, Transform } from '../components/index.js';
import { Depth } from './depths.js';

/** Palette, from public/assets/tokens.json. */
export const HudColor = {
  /** The warm of the headlight itself: the bar reads as the light it measures. */
  POWER_FILL: 0xffce8c,
  HIGH_BEAM_FILL: 0xc08cff,
  /** Reserved for obstacles and the low-power warning. Nothing else. */
  WARNING: 0xff4a35,
  TEXT: '#e8f1ff',
  /**
   * The countdown digits borrow the open anchor's white and cyan: the same
   * "this is the thing to look at" the game teaches a moment later.
   */
  COUNT: '#eafcff',
  COUNT_EDGE: '#4fb8c9',
  /** Go is the power pickup's green, the one unambiguously good colour. */
  GO: '#6bffb0',
  GO_EDGE: '#1d5a3c',
  CAPTION: '#9aa4b2',
  HINT: '#9aa4b2',
  /** The night itself, laid over the road so the hint reads against it. */
  BAND: 0x06080c,
} as const;

/**
 * Authored at this size and scaled by transform to fit the viewport. Text
 * style is baked at creation, so the digit is rasterised once, large, and
 * shrunk rather than blown up.
 */
export const COUNT_FONT_PX = 160;
export const CAPTION_FONT_PX = 28;
export const HINT_FONT_PX = 20;

/** One line where there is width for it, three where there is not. */
export const HINT_LANDSCAPE = 'PRESS  throw the rope      HOLD  swing past      RELEASE  come back';
export const HINT_PORTRAIT = 'PRESS    throw the rope\nHOLD     swing past\nRELEASE  come back';

export function meterFrame(name: string): Entity {
  return new Entity(`hud.meterFrame.${name}`)
    .add(Transform({ depth: Depth.HUD }))
    .add(Sprite({ texture: 'ui.meterFrame', originX: 0, originY: 0.5, alpha: 0.9 }));
}

export function meterFill(name: string, color: number): Entity {
  return new Entity(`hud.meterFill.${name}`)
    .add(Transform({ depth: Depth.HUD + 1 }))
    .add(
      Shape({
        kind: ShapeKind.RECTANGLE,
        fillColor: color,
        // Grows rightward from a fixed left edge, so a draining meter shortens
        // instead of sliding.
        originX: 0,
        originY: 0.5,
      }),
    );
}

export function scoreFrame(): Entity {
  return new Entity('hud.scoreFrame')
    .add(Transform({ depth: Depth.HUD }))
    .add(Sprite({ texture: 'ui.scoreFrame', originX: 0.5, originY: 0.5, alpha: 0.75 }));
}

export function scoreLabel(): Entity {
  return new Entity('hud.score')
    .add(Transform({ depth: Depth.HUD + 1 }))
    .add(
      Text({
        content: '0',
        fontFamily: 'monospace',
        fontSize: 20,
        color: HudColor.TEXT,
        align: TextAlign.CENTER,
        originX: 0.5,
        originY: 0.5,
      }),
    );
}

export function crashOverlay(): Entity {
  return new Entity('hud.crashOverlay')
    .add(Transform({ depth: Depth.OVERLAY }))
    .add(Sprite({ texture: 'ui.crashOverlay', originX: 0.5, originY: 0.5, visible: false }));
}

/** The big digit. Stroke is part of the style, so it is set here and never changes. */
export function countdownLabel(): Entity {
  return new Entity('hud.countdown')
    .add(Transform({ depth: Depth.OVERLAY + 1 }))
    .add(
      Text({
        content: '3',
        fontFamily: 'monospace',
        fontSize: COUNT_FONT_PX,
        fontStyle: 'bold',
        color: HudColor.COUNT,
        strokeColor: HudColor.COUNT_EDGE,
        strokeWidth: 10,
        align: TextAlign.CENTER,
        originX: 0.5,
        originY: 0.5,
        visible: false,
      }),
    );
}

/** GO is a second entity rather than a recolour, because colour is baked at creation. */
export function goLabel(): Entity {
  return new Entity('hud.go')
    .add(Transform({ depth: Depth.OVERLAY + 1 }))
    .add(
      Text({
        content: 'GO',
        fontFamily: 'monospace',
        fontSize: COUNT_FONT_PX,
        fontStyle: 'bold',
        color: HudColor.GO,
        strokeColor: HudColor.GO_EDGE,
        strokeWidth: 10,
        align: TextAlign.CENTER,
        originX: 0.5,
        originY: 0.5,
        visible: false,
      }),
    );
}

export function countdownCaption(): Entity {
  return new Entity('hud.countdownCaption')
    .add(Transform({ depth: Depth.OVERLAY + 1 }))
    .add(
      Text({
        content: 'G E T   R E A D Y',
        fontFamily: 'monospace',
        fontSize: CAPTION_FONT_PX,
        color: HudColor.CAPTION,
        align: TextAlign.CENTER,
        originX: 0.5,
        originY: 0.5,
        visible: false,
      }),
    );
}

/** A translucent strip of night behind the hint, so it reads over the lit road. */
export function countdownBand(): Entity {
  return new Entity('hud.countdownBand')
    .add(Transform({ depth: Depth.OVERLAY }))
    .add(
      Shape({
        kind: ShapeKind.RECTANGLE,
        fillColor: HudColor.BAND,
        fillAlpha: 0.72,
        originX: 0.5,
        originY: 0.5,
        visible: false,
      }),
    );
}

/** The one-button tutorial, shown while there is nothing else to do but read it. */
export function countdownHint(): Entity {
  return new Entity('hud.countdownHint')
    .add(Transform({ depth: Depth.OVERLAY + 1 }))
    .add(
      Text({
        content: HINT_LANDSCAPE,
        fontFamily: 'monospace',
        fontSize: HINT_FONT_PX,
        color: HudColor.HINT,
        align: TextAlign.CENTER,
        originX: 0.5,
        originY: 0.5,
        visible: false,
      }),
    );
}

export function messageLabel(): Entity {
  return new Entity('hud.message')
    .add(Transform({ depth: Depth.OVERLAY + 1 }))
    .add(
      Text({
        content: '',
        fontFamily: 'monospace',
        fontSize: 18,
        color: HudColor.TEXT,
        align: TextAlign.CENTER,
        originX: 0.5,
        originY: 0.5,
        visible: false,
      }),
    );
}
