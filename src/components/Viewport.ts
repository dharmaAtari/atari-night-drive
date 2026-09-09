export interface Viewport {
  width: number;
  height: number;
  halfWidth: number;
}

export function createViewport(): Viewport {
  return { width: 0, height: 0, halfWidth: 0 };
}
