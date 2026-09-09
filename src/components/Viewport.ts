import type { LayoutMode } from '../types/platform';

export interface Viewport {
  cssWidth: number;
  cssHeight: number;
  renderWidth: number;
  renderHeight: number;
  dpr: number;
  layout: LayoutMode;
  safeTop: number;
  safeRight: number;
  safeBottom: number;
  safeLeft: number;
  horizonY: number;
}

export function createViewport(): Viewport {
  return {
    cssWidth: 0,
    cssHeight: 0,
    renderWidth: 0,
    renderHeight: 0,
    dpr: 1,
    layout: 'landscape',
    safeTop: 0,
    safeRight: 0,
    safeBottom: 0,
    safeLeft: 0,
    horizonY: 0,
  };
}
