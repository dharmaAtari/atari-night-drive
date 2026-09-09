import type { AnchorId, AnchorLane } from '../types/lanes';
import type { AnchorKind, AnchorState } from '../types/states';

export interface Anchor {
  id: AnchorId;
  s: number;
  lane: AnchorLane;
  kind: AnchorKind;
  windowOpenS: number;
  windowCloseS: number;
  state: AnchorState;
}

export function createAnchor(
  id: AnchorId,
  s: number,
  lane: AnchorLane,
  kind: AnchorKind,
  windowOpenS: number,
  windowCloseS: number,
): Anchor {
  return { id, s, lane, kind, windowOpenS, windowCloseS, state: 'dormant' };
}
