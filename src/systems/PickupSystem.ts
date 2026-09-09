/**
 * PickupSystem — turns roping a pickup anchor into light.
 *
 * Pickups are anchors, so collection needs no proximity test of its own: it
 * happens exactly when the rope attaches, which `RopeSystem` already announced.
 * This system just reads that event.
 *
 * The `collected` set exists because the attach event fires on every throw and a
 * player can re-throw at the same anchor while it is still open. Without it, one
 * pickup could be milked for unlimited power.
 */
import { AnchorKind, GameEvent, type AnchorId, type World } from '../world.js';
import { activateHighBeam, addPower } from './LightSystem.js';

export interface PickupSystem {
  run(world: World): void;
  reset(): void;
}

export function createPickupSystem(): PickupSystem {
  const collected = new Set<AnchorId>();

  return {
    run(world: World): void {
      const { events, anchors, config, light } = world;

      for (const event of events) {
        if (event.type !== GameEvent.ROPE_ATTACHED) continue;
        const id = event.anchorId;
        if (id === undefined || collected.has(id)) continue;

        const anchor = anchors.find((candidate) => candidate.id === id);
        if (!anchor || anchor.kind === AnchorKind.SAFE) continue;

        collected.add(id);

        if (anchor.kind === AnchorKind.POWER) {
          addPower(config, light);
          events.push({ type: GameEvent.PICKUP_POWER, anchorId: id });
        } else {
          activateHighBeam(light);
          events.push({ type: GameEvent.PICKUP_HIGH_BEAM, anchorId: id });
        }
      }
    },

    reset(): void {
      collected.clear();
    },
  };
}
