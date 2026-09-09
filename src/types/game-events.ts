export const GAME_EVENTS = {
  RopeAttached: 'rope-attached',
  RopeMissed: 'rope-missed',
  RopeSnapped: 'rope-snapped',
  Crashed: 'crashed',
} as const;

export type GameEvent =
  | { type: typeof GAME_EVENTS.RopeAttached; anchorId: number }
  | { type: typeof GAME_EVENTS.RopeMissed }
  | { type: typeof GAME_EVENTS.RopeSnapped }
  | { type: typeof GAME_EVENTS.Crashed; cause: 'obstacle' | 'offRoad' | 'snap' };
