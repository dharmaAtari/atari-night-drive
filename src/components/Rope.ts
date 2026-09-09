import type { AnchorId } from '../types/lanes';
import type { RopeState } from '../types/states';

export interface Rope {
  state: RopeState;
  anchorId: AnchorId | null;
  timer: number;
  extent: number;
  tension: number;
}

export function createRope(): Rope {
  return { state: 'idle', anchorId: null, timer: 0, extent: 0, tension: 0 };
}
