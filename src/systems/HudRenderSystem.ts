import type Phaser from 'phaser';
import type { World } from '../world';

const METER_COLOR = 0x6a6a6a;
const METER_WIDTH_RATIO = 0.22;
const SAFE_INSET_FLOOR_PX = 16;

export function hudRenderSystem(
  world: World,
  graphics: Phaser.GameObjects.Graphics,
  scoreText: Phaser.GameObjects.Text,
): void {
  graphics.clear();

  const { renderWidth, renderHeight, dpr, layout, safeTop, safeRight, safeLeft, safeBottom } = world.viewport;
  const insetFloor = SAFE_INSET_FLOOR_PX * dpr;

  scoreText.setFontSize(0.03 * Math.min(renderWidth, renderHeight));
  scoreText.setColor('#d8d8d8');
  scoreText.setText('0');

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

  graphics.lineStyle(2, METER_COLOR, 1);
  graphics.strokeRect(insetLeft, powerY, meterWidth, meterHeight);
  graphics.strokeRect(insetLeft, highBeamY, meterWidth, meterHeight);
}
