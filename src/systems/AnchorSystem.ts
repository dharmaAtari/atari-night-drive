import type { World } from '../world';
import type { GameConfigFile } from '../config';
import type { Anchor } from '../components/Anchor';

export function ropeRange(config: GameConfigFile, speed: number): number {
  return Math.max(config.rope.baseRange, speed * config.rope.floorSeconds + config.rope.closeMargin);
}

export interface AnchorWindow {
  windowOpenS: number;
  windowCloseS: number;
}

export function anchorWindow(
  config: GameConfigFile,
  speed: number,
  anchorS: number,
  hazardS: number,
): AnchorWindow {
  return {
    windowOpenS: anchorS - ropeRange(config, speed),
    windowCloseS: hazardS - config.rope.closeMargin,
  };
}

export function isWindowViable(window: AnchorWindow): boolean {
  return window.windowCloseS > window.windowOpenS;
}

export function anchorSystem(world: World): void {
  const { car, anchors } = world;
  const tailEdge = car.s - world.config.road.tailMetres;

  for (const anchor of anchors) {
    if (anchor.state === 'dormant' && car.s >= anchor.windowOpenS) {
      anchor.state = 'open';
    } else if (anchor.state === 'open' && car.s > anchor.windowCloseS) {
      anchor.state = 'passed';
    }
  }

  while (anchors.length > 0 && anchors[0].s < tailEdge) {
    anchors.shift();
  }
}

export function openAnchors(world: World): Anchor[] {
  return world.anchors
    .filter((anchor) => anchor.state === 'open')
    .sort((a, b) => a.s - b.s);
}
