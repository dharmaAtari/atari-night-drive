/**
 * AnchorSystem — opens and closes each anchor's throw window.
 *
 * The window is the entire difficulty contract. It opens when the anchor comes
 * into rope range and closes shortly before the hazard arrives; the post pulses
 * for exactly that span, and that pulse is the only tutorial the game has.
 *
 * `ropeRange` is where the fairness floor lives. Range is never allowed to fall
 * below `speed * floorSeconds + closeMargin`, so however fast the car is going
 * the player always gets the same minimum real time to react. At high speed
 * this means anchors appear *further out*, not sooner in — which is the whole
 * reason low headlight power can make the game tenser without making it
 * impossible.
 */
import type { GameConfig } from '../config.js';
import { AnchorState, type Anchor, type World } from '../world.js';

/** How far ahead an anchor becomes throwable. Never below the reaction floor. */
export function ropeRange(config: GameConfig, speed: number): number {
  return Math.max(config.rope.baseRange, speed * config.rope.floorSeconds + config.rope.closeMargin);
}

/**
 * Where an anchor post physically stands, as a lateral world position in lane
 * units. Posts are roadside furniture, not lane markers: they sit just past the
 * edge line on the side of their lane, offset by enough that the post's inner
 * face touches the road rather than overlapping it. The lane the rope pulls the
 * car into is still `laneX(anchor.lane)` — this is only where the post is.
 */
export function anchorX(lane: number, config: GameConfig): number {
  return Math.sign(lane) * (config.road.halfWidth + config.road.anchorOffset);
}

export interface AnchorWindow {
  windowOpenS: number;
  windowCloseS: number;
}

export function anchorWindow(
  config: GameConfig,
  speed: number,
  anchorS: number,
  hazardS: number,
): AnchorWindow {
  return {
    windowOpenS: anchorS - ropeRange(config, speed),
    windowCloseS: hazardS - config.rope.closeMargin,
  };
}

/** A window that closes before it opens is unusable and must never be emitted. */
export function isWindowViable(window: AnchorWindow): boolean {
  return window.windowCloseS > window.windowOpenS;
}

export function anchorSystem(world: World): void {
  const { car, anchors, rope } = world;
  const tailEdge = car.s - world.config.road.tailMetres;

  for (const anchor of anchors) {
    if (anchor.state === AnchorState.DORMANT && car.s >= anchor.windowOpenS) {
      anchor.state = AnchorState.OPEN;
    } else if (anchor.state === AnchorState.OPEN && car.s > anchor.windowCloseS) {
      anchor.state = AnchorState.PASSED;
    }
  }

  // Retire anchors behind the tail — except the one the rope is currently on.
  // Dropping that one would strand the rope holding an id nothing answers to,
  // and the car can legitimately be further past an anchor than the tail depth
  // before the rope reaches its snapping extent.
  while (anchors.length > 0 && anchors[0]!.s < tailEdge && anchors[0]!.id !== rope.anchorId) {
    anchors.shift();
  }
}

/** Open anchors, nearest first. */
export function openAnchors(world: World): Anchor[] {
  return world.anchors
    .filter((anchor) => anchor.state === AnchorState.OPEN)
    .sort((a, b) => a.s - b.s);
}
