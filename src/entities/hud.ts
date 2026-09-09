/**
 * The HUD: a score, two meters, a prompt, and nothing else.
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

export const HudColor = {
  POWER_FILL: 0xffcc66,
  HIGH_BEAM_FILL: 0x8f7bff,
  /** Reserved for obstacles and the low-power warning. Nothing else. */
  WARNING: 0xff5a1f,
  TEXT: '#d8d8d8',
} as const;

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
