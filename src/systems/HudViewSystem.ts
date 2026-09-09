/**
 * HudViewSystem — score, two meters, and the prompt between runs.
 *
 * Everything here is positioned from the live viewport rather than from stored
 * constants, so rotating a phone or dragging a window re-lays it out without a
 * reload. Nothing caches a width.
 *
 * The low-power pulse is the one place the HUD is allowed to shout. It shares
 * the warning colour with obstacles and nothing else uses it, so when the power
 * bar starts flashing it reads as the same category of thing as the object that
 * kills you — which is exactly what running out of light means.
 */
import type Entity from '../entities/Entity.js';
import { SHAPE, SPRITE, TEXT, TRANSFORM } from '../components/index.js';
import {
  HudColor,
  crashOverlay,
  messageLabel,
  meterFill,
  meterFrame,
  scoreFrame,
  scoreLabel,
} from '../entities/hud.js';
import { RunState, type World } from '../world.js';
import { currentScore } from './ScoreSystem.js';
import type { TextureSize } from './ActorViewSystem.js';

/** Smallest gap from any screen edge, before device safe-areas are considered. */
const EDGE_INSET = 18;

const METER_WIDTH_RATIO = 0.2;

const LOW_POWER_THRESHOLD = 0.25;
const LOW_POWER_PULSE_HZ = 2.5;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: number, b: number, t: number): number {
  const r = Math.round(lerp((a >> 16) & 0xff, (b >> 16) & 0xff, t));
  const g = Math.round(lerp((a >> 8) & 0xff, (b >> 8) & 0xff, t));
  const bl = Math.round(lerp(a & 0xff, b & 0xff, t));
  return (r << 16) | (g << 8) | bl;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export default class HudViewSystem {
  private readonly scoreBox = scoreFrame();
  private readonly score = scoreLabel();
  private readonly powerFrame = meterFrame('power');
  private readonly powerFill = meterFill('power', HudColor.POWER_FILL);
  private readonly beamFrame = meterFrame('highBeam');
  private readonly beamFill = meterFill('highBeam', HudColor.HIGH_BEAM_FILL);
  private readonly overlay = crashOverlay();
  private readonly message = messageLabel();

  constructor(private readonly textureSize: TextureSize) {}

  entities(): Entity[] {
    return [
      this.scoreBox,
      this.score,
      this.powerFrame,
      this.powerFill,
      this.beamFrame,
      this.beamFill,
      this.overlay,
      this.message,
    ];
  }

  update(world: World): void {
    const { viewport, run } = world;
    const short = Math.min(viewport.width, viewport.height);

    this.layoutScore(world, short);
    this.layoutMeters(world, short);
    this.layoutMessage(world, short);

    // The car and the road keep drawing under the overlay during the impact
    // beat, so the crash reads as something that happened rather than a cut.
    const showOverlay = run.state !== RunState.RUNNING;
    this.setOverlay(world, showOverlay);
  }

  private layoutScore(world: World, short: number): void {
    const { viewport } = world;
    const size = Math.max(14, Math.round(short * 0.038));

    const text = this.score.get(TEXT)!;
    const label = String(currentScore(world));
    if (text.content !== label) {
      text.content = label;
      text.dirty = true;
    }
    text.fontSize = size;

    // Portrait puts the score top-centre; landscape tucks it into the corner,
    // where it competes with nothing.
    const x = viewport.portrait ? viewport.width / 2 : viewport.width - EDGE_INSET - size * 1.6;
    const y = EDGE_INSET + size * 0.8;

    this.at(this.score, x, y);

    const frameSprite = this.scoreBox.get(SPRITE)!;
    const frameSize = this.textureSize(frameSprite.texture);
    const scale = frameSize.width > 0 ? (size * 4) / frameSize.width : 1;
    this.at(this.scoreBox, x, y);
    const frameTransform = this.scoreBox.get(TRANSFORM)!;
    frameTransform.scaleX = scale;
    frameTransform.scaleY = scale;
  }

  private layoutMeters(world: World, short: number): void {
    const { viewport, light } = world;
    const width = METER_WIDTH_RATIO * viewport.width;
    const height = Math.max(8, Math.round(short * 0.022));
    const gap = height * 0.7;

    const beamY = viewport.height - EDGE_INSET - height;
    const powerY = beamY - gap - height;
    const left = EDGE_INSET;

    for (const [frame, y] of [
      [this.powerFrame, powerY],
      [this.beamFrame, beamY],
    ] as const) {
      this.at(frame, left, y);
      const sprite = frame.get(SPRITE)!;
      const size = this.textureSize(sprite.texture);
      const transform = frame.get(TRANSFORM)!;
      transform.scaleX = size.width > 0 ? width / size.width : 1;
      transform.scaleY = size.height > 0 ? height / size.height : 1;
    }

    const powerShape = this.powerFill.get(SHAPE)!;
    powerShape.width = width * clamp01(light.power);
    powerShape.height = height * 0.66;
    powerShape.fillColor =
      light.power < LOW_POWER_THRESHOLD
        ? lerpColor(
            HudColor.POWER_FILL,
            HudColor.WARNING,
            0.4 + 0.6 * (0.5 + 0.5 * Math.sin(world.run.elapsed * LOW_POWER_PULSE_HZ * Math.PI * 2)),
          )
        : HudColor.POWER_FILL;
    powerShape.visible = light.power > 0.001;
    this.at(this.powerFill, left + 2, powerY);

    const beamShape = this.beamFill.get(SHAPE)!;
    beamShape.width = width * clamp01(light.highBeam);
    beamShape.height = height * 0.66;
    beamShape.visible = light.highBeam > 0.001;
    this.at(this.beamFill, left + 2, beamY);
  }

  private layoutMessage(world: World, short: number): void {
    const { viewport, run, config } = world;
    const text = this.message.get(TEXT)!;

    if (run.state !== RunState.OVER) {
      text.visible = false;
      return;
    }

    const seedLine = config.debug.showSeed ? `\nSEED ${run.seed}` : '';
    const content = `${currentScore(world)}\nBEST ${run.best}${seedLine}\n\nPRESS TO RETRY`;
    if (text.content !== content) {
      text.content = content;
      text.dirty = true;
    }
    text.fontSize = Math.max(12, Math.round(short * 0.034));
    text.visible = true;
    this.at(this.message, viewport.width / 2, viewport.height * 0.42);
  }

  private setOverlay(world: World, visible: boolean): void {
    const sprite = this.overlay.get(SPRITE)!;
    sprite.visible = visible;
    if (!visible) return;

    const { viewport } = world;
    const size = this.textureSize(sprite.texture);
    this.at(this.overlay, viewport.width / 2, viewport.height / 2);
    const transform = this.overlay.get(TRANSFORM)!;
    transform.scaleX = size.width > 0 ? viewport.width / size.width : 1;
    transform.scaleY = size.height > 0 ? viewport.height / size.height : 1;
  }

  private at(entity: Entity, x: number, y: number): void {
    const transform = entity.get(TRANSFORM)!;
    transform.x = x;
    transform.y = y;
  }
}
