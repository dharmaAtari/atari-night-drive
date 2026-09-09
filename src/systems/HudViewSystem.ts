/**
 * HudViewSystem — score, two meters, the 3-2-1, and the prompt between runs.
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
  CAPTION_FONT_PX,
  COUNT_FONT_PX,
  HINT_FONT_PX,
  HINT_LANDSCAPE,
  HINT_PORTRAIT,
  HudColor,
  countdownBand,
  countdownCaption,
  countdownHint,
  countdownLabel,
  crashOverlay,
  goLabel,
  messageLabel,
  meterFill,
  meterFrame,
  scoreFrame,
  scoreLabel,
} from '../entities/hud.js';
import { GameEvent, RunState, type World } from '../world.js';
import { currentScore } from './ScoreSystem.js';
import { countdownDigit } from './CountdownSystem.js';
import type { TextureSize } from './ActorViewSystem.js';

/** Smallest gap from any screen edge, before device safe-areas are considered. */
const EDGE_INSET = 18;

const METER_WIDTH_RATIO = 0.2;

const LOW_POWER_THRESHOLD = 0.25;
const LOW_POWER_PULSE_HZ = 2.5;

/** Digit height as a fraction of the short side of the viewport. */
const COUNT_SIZE_RATIO = 0.26;
/** How far above rest size a digit lands, and how long it takes to settle. */
const COUNT_POP = 0.45;
const COUNT_POP_SECONDS = 0.28;
/** The digit dims through the back of its second, so the next one reads as new. */
const COUNT_DIM_FROM = 0.55;
const COUNT_DIM_TO = 0.35;
/** GO swells and burns off over this long once the car is moving. */
const GO_SECONDS = 0.7;
const GO_SWELL = 0.6;

/** Ease-out cubic: fast in, settles gently. */
function easeOut(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

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
  private readonly count = countdownLabel();
  private readonly go = goLabel();
  private readonly caption = countdownCaption();
  private readonly band = countdownBand();
  private readonly hint = countdownHint();

  /** Seconds of GO left to show. Presentation state, so it lives here. */
  private goTimer = 0;

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
      this.count,
      this.go,
      this.caption,
      this.band,
      this.hint,
    ];
  }

  update(world: World, dt: number): void {
    const { viewport, run } = world;
    const short = Math.min(viewport.width, viewport.height);

    this.layoutScore(world, short);
    this.layoutMeters(world, short);
    this.layoutMessage(world, short);
    this.layoutCountdown(world, short, dt);

    // The car and the road keep drawing under the overlay during the impact
    // beat, so the crash reads as something that happened rather than a cut.
    const showOverlay = run.state === RunState.CRASHING || run.state === RunState.OVER;
    this.setOverlay(world, showOverlay);
  }

  /**
   * 3, 2, 1, GO. Each digit lands big and bright, settles, and dims through the
   * back of its second; GO swells and burns off as the car starts to move.
   * Everything is driven from `run.countdown` and the frame's events, so the
   * count and its picture cannot drift apart.
   */
  private layoutCountdown(world: World, short: number, dt: number): void {
    const { viewport, run } = world;
    const countText = this.count.get(TEXT)!;
    const goText = this.go.get(TEXT)!;
    const captionText = this.caption.get(TEXT)!;
    const hintText = this.hint.get(TEXT)!;
    const bandShape = this.band.get(SHAPE)!;

    for (const event of world.events) {
      if (event.type === GameEvent.RUN_STARTED) this.goTimer = GO_SECONDS;
    }

    const counting = run.state === RunState.COUNTDOWN;
    countText.visible = counting;
    captionText.visible = counting;
    hintText.visible = counting;
    bandShape.visible = counting;

    // The digit sits in the sky just above the horizon, where the eye is
    // already looking for the road to resolve, with its caption above it so
    // neither touches the lit road. The hint sits on a strip of night between
    // the horizon and the car.
    const centreX = viewport.width / 2;
    const digitY = viewport.horizonY - short * 0.08;
    const digitPx = short * COUNT_SIZE_RATIO;
    const restScale = digitPx / COUNT_FONT_PX;

    if (counting) {
      const digit = countdownDigit(run.countdown);
      const label = String(digit);
      if (countText.content !== label) {
        countText.content = label;
        countText.dirty = true;
      }

      // Time since this digit appeared, 0..1 across its second.
      const age = 1 - (run.countdown - Math.floor(run.countdown));
      const pop = COUNT_POP * (1 - easeOut(age / COUNT_POP_SECONDS));
      const dim = clamp01((age - COUNT_DIM_FROM) / (1 - COUNT_DIM_FROM));
      countText.alpha = 1 - (1 - COUNT_DIM_TO) * dim;
      this.place(this.count, centreX, digitY, restScale * (1 + pop));

      const captionPx = Math.max(12, short * 0.03);
      this.place(this.caption, centreX, digitY - digitPx * 0.62, captionPx / CAPTION_FONT_PX);
      captionText.alpha = 0.85;

      // Three lines on a phone, one where there is width for it.
      const hintContent = viewport.portrait ? HINT_PORTRAIT : HINT_LANDSCAPE;
      if (hintText.content !== hintContent) {
        hintText.content = hintContent;
        hintText.dirty = true;
      }
      const hintPx = Math.max(11, short * 0.024);
      const hintLines = viewport.portrait ? 3 : 1;
      const hintY = viewport.horizonY + (viewport.height - viewport.horizonY) * 0.3;
      this.place(this.hint, centreX, hintY, hintPx / HINT_FONT_PX);
      hintText.alpha = 0.95;

      bandShape.width = viewport.width;
      bandShape.height = hintPx * (hintLines * 1.3 + 1.6);
      this.place(this.band, centreX, hintY, 1);
    }

    if (this.goTimer > 0) {
      this.goTimer = Math.max(0, this.goTimer - dt);
      const t = 1 - this.goTimer / GO_SECONDS;
      this.place(this.go, centreX, digitY, restScale * (1 + GO_SWELL * easeOut(t)));
      goText.alpha = 1 - t * t;
      goText.visible = true;
    } else {
      goText.visible = false;
    }
  }

  private place(entity: Entity, x: number, y: number, scale: number): void {
    const transform = entity.get(TRANSFORM)!;
    transform.x = x;
    transform.y = y;
    transform.scaleX = scale;
    transform.scaleY = scale;
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
