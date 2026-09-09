import type { World } from '../world';
import type { LayoutMode } from '../types/platform';

export interface ViewportMeasurement {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  safeTop: number;
  safeRight: number;
  safeBottom: number;
  safeLeft: number;
}

export function viewportSystem(world: World, measure: ViewportMeasurement): void {
  const { viewport, config } = world;

  const dpr = Math.min(measure.dpr, config.display.maxDevicePixelRatio);
  const layout: LayoutMode =
    measure.cssWidth / measure.cssHeight < config.display.portraitBreakpoint ? 'portrait' : 'landscape';

  viewport.cssWidth = measure.cssWidth;
  viewport.cssHeight = measure.cssHeight;
  viewport.dpr = dpr;
  viewport.renderWidth = Math.round(measure.cssWidth * dpr);
  viewport.renderHeight = Math.round(measure.cssHeight * dpr);
  viewport.layout = layout;
  viewport.horizonY = viewport.renderHeight * (layout === 'portrait' ? 0.4 : 0.45);
  viewport.safeTop = measure.safeTop * dpr;
  viewport.safeRight = measure.safeRight * dpr;
  viewport.safeBottom = measure.safeBottom * dpr;
  viewport.safeLeft = measure.safeLeft * dpr;
}
