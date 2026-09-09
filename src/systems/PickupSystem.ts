import type { World } from '../world';
import type { Anchor } from '../components/Anchor';
import type { AnchorId } from '../types/lanes';
import { GAME_EVENTS } from '../types/game-events';
import { activateHighBeam, addPower } from './LightSystem';

export function isPickup(anchor: Anchor): boolean {
  return anchor.kind !== 'safe';
}

export interface PickupSystem {
  run(world: World): void;
  reset(): void;
}

export function createPickupSystem(): PickupSystem {
  const collected = new Set<AnchorId>();

  function run(world: World): void {
    const { events, anchors, config, light } = world;

    for (const event of events) {
      if (event.type !== GAME_EVENTS.RopeAttached) continue;
      if (collected.has(event.anchorId)) continue;

      const anchor = anchors.find((a) => a.id === event.anchorId);
      if (!anchor) continue;

      collected.add(event.anchorId);

      if (anchor.kind === 'power') {
        addPower(config, light);
      } else if (anchor.kind === 'highBeam') {
        activateHighBeam(light);
      }
    }
  }

  function reset(): void {
    collected.clear();
  }

  return { run, reset };
}
