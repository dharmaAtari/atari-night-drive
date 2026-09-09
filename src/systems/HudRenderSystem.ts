import type Phaser from 'phaser';
import type { World } from '../world';

const METER_COLOR = 0x6a6a6a;
const METER_WIDTH_RATIO = 0.22;
const SAFE_INSET_FLOOR_PX = 16;

// Warm headlight tone (GDD §14: light sources are the palette). Matches the high-beam
// anchor's hue so its meter reads as "the bar for that pickup".
const POWER_FILL_COLOR = 0xffcc66;
const HIGH_BEAM_FILL_COLOR = 0x8f7bff;
// Saturated warning colour, reserved for obstacles and the low-power warning (GDD §14).
const WARNING_COLOR = 0xff3b30;
const LOW_POWER_THRESHOLD = 0.25;
const LOW_POWER_PULSE_HZ = 2.5;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;

  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function hudRenderSystem(
  world: World,
  graphics: Phaser.GameObjects.Graphics,
  scoreText: Phaser.GameObjects.Text,
  time: number,
): void {
  graphics.clear();

  const { renderWidth, renderHeight, dpr, layout, safeTop, safeRight, safeLeft, safeBottom } = world.viewport;
  const insetFloor = SAFE_INSET_FLOOR_PX * dpr;

  scoreText.setFontSize(0.03 * Math.min(renderWidth, renderHeight));
  scoreText.setColor('#d8d8d8');
  scoreText.setText(String(Math.floor(world.elapsed)));

  if (layout === 'portrait') {
    const insetTop = Math.max(safeTop, insetFloor);
    scoreText.setOrigin(0.5, 0);
    scoreText.setPosition(renderWidth / 2, insetTop);
  } else {
    const insetTop = Math.max(safeTop, insetFloor);
    const insetRight = Math.max(safeRight, insetFloor);
    scoreText.setOrigin(1, 0);
    scoreText.setPosition(renderWidth - insetRight, insetTop);
  }

  const meterWidth = METER_WIDTH_RATIO * renderWidth;
  const meterHeight = 12 * dpr;
  const meterGap = meterHeight * 0.5;
  const insetLeft = Math.max(safeLeft, insetFloor);
  const insetBottom = Math.max(safeBottom, insetFloor);

  const highBeamY = renderHeight - insetBottom - meterHeight;
  const powerY = highBeamY - meterGap - meterHeight;

  const powerFraction = clamp01(world.light.power);
  let powerColor = POWER_FILL_COLOR;
  if (world.light.power < LOW_POWER_THRESHOLD) {
    const pulse = 0.5 + 0.5 * Math.sin(time * LOW_POWER_PULSE_HZ * Math.PI * 2);
    powerColor = lerpColor(POWER_FILL_COLOR, WARNING_COLOR, 0.4 + 0.6 * pulse);
  }
  graphics.fillStyle(powerColor, 1);
  graphics.fillRect(insetLeft, powerY, meterWidth * powerFraction, meterHeight);

  const highBeamFraction = clamp01(world.light.highBeam);
  if (highBeamFraction > 0) {
    graphics.fillStyle(HIGH_BEAM_FILL_COLOR, 1);
    graphics.fillRect(insetLeft, highBeamY, meterWidth * highBeamFraction, meterHeight);
  }

  graphics.lineStyle(2, METER_COLOR, 1);
  graphics.strokeRect(insetLeft, powerY, meterWidth, meterHeight);
  graphics.strokeRect(insetLeft, highBeamY, meterWidth, meterHeight);
}
