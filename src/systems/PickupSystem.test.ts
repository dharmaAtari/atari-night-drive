import { describe, it, expect } from 'vitest';
import { makeWorld } from '../testing/makeWorld';
import { createAnchor } from '../components/Anchor';
import { GAME_EVENTS } from '../types/game-events';
import { createPickupSystem, isPickup } from './PickupSystem';

describe('isPickup', () => {
  it('is false for safe anchors and true for power/highBeam anchors', () => {
    expect(isPickup(createAnchor(1, 100, 1, 'safe', 0, 200))).toBe(false);
    expect(isPickup(createAnchor(2, 100, 1, 'power', 0, 200))).toBe(true);
    expect(isPickup(createAnchor(3, 100, 1, 'highBeam', 0, 200))).toBe(true);
  });
});

describe('pickupSystem', () => {
  it('raises light.power by config.light.powerPickup on attach to a power anchor', () => {
    const world = makeWorld();
    world.light.power = 0.2;
    const anchor = createAnchor(1, 100, 1, 'power', 0, 200);
    world.anchors.push(anchor);
    world.events.push({ type: GAME_EVENTS.RopeAttached, anchorId: 1 });

    const system = createPickupSystem();
    system.run(world);

    expect(world.light.power).toBeCloseTo(0.2 + world.config.light.powerPickup, 9);
  });

  it('clamps light.power at 1', () => {
    const world = makeWorld();
    world.light.power = 0.9;
    const anchor = createAnchor(1, 100, 1, 'power', 0, 200);
    world.anchors.push(anchor);
    world.events.push({ type: GAME_EVENTS.RopeAttached, anchorId: 1 });

    const system = createPickupSystem();
    system.run(world);

    expect(world.light.power).toBe(1);
  });

  it('attaching to a highBeam anchor sets highBeamActive true and highBeam to 1, leaving power unchanged', () => {
    const world = makeWorld();
    world.light.power = 0.5;
    const anchor = createAnchor(1, 100, 1, 'highBeam', 0, 200);
    world.anchors.push(anchor);
    world.events.push({ type: GAME_EVENTS.RopeAttached, anchorId: 1 });

    const system = createPickupSystem();
    system.run(world);

    expect(world.light.highBeamActive).toBe(true);
    expect(world.light.highBeam).toBe(1);
    expect(world.light.power).toBe(0.5);
  });

  it('attaching to a safe anchor changes nothing', () => {
    const world = makeWorld();
    world.light.power = 0.5;
    const anchor = createAnchor(1, 100, 1, 'safe', 0, 200);
    world.anchors.push(anchor);
    world.events.push({ type: GAME_EVENTS.RopeAttached, anchorId: 1 });

    const system = createPickupSystem();
    system.run(world);

    expect(world.light.power).toBe(0.5);
    expect(world.light.highBeamActive).toBe(false);
    expect(world.light.highBeam).toBe(0);
  });

  it('processes the same RopeAttached event twice within one frame array but collects only once', () => {
    const world = makeWorld();
    world.light.power = 0.2;
    const anchor = createAnchor(1, 100, 1, 'power', 0, 200);
    world.anchors.push(anchor);
    // Same event object duplicated in the frame's event list.
    world.events.push(
      { type: GAME_EVENTS.RopeAttached, anchorId: 1 },
      { type: GAME_EVENTS.RopeAttached, anchorId: 1 },
    );

    const system = createPickupSystem();
    system.run(world);

    expect(world.light.power).toBeCloseTo(0.2 + world.config.light.powerPickup, 9);
  });

  it('calling run() twice on the same frame array (e.g. re-drain) does not double-collect', () => {
    const world = makeWorld();
    world.light.power = 0.2;
    const anchor = createAnchor(1, 100, 1, 'power', 0, 200);
    world.anchors.push(anchor);
    world.events.push({ type: GAME_EVENTS.RopeAttached, anchorId: 1 });

    const system = createPickupSystem();
    system.run(world);
    system.run(world);

    expect(world.light.power).toBeCloseTo(0.2 + world.config.light.powerPickup, 9);
  });

  it('two different pickups in one frame both collect', () => {
    const world = makeWorld();
    world.light.power = 0.2;
    const powerAnchor = createAnchor(1, 100, 1, 'power', 0, 200);
    const highBeamAnchor = createAnchor(2, 150, -1, 'highBeam', 0, 200);
    world.anchors.push(powerAnchor, highBeamAnchor);
    world.events.push(
      { type: GAME_EVENTS.RopeAttached, anchorId: 1 },
      { type: GAME_EVENTS.RopeAttached, anchorId: 2 },
    );

    const system = createPickupSystem();
    system.run(world);

    expect(world.light.power).toBeCloseTo(0.2 + world.config.light.powerPickup, 9);
    expect(world.light.highBeamActive).toBe(true);
    expect(world.light.highBeam).toBe(1);
  });

  it('reset() allows the same anchor id to collect again for a new run', () => {
    const world = makeWorld();
    world.light.power = 0.2;
    const anchor = createAnchor(1, 100, 1, 'power', 0, 200);
    world.anchors.push(anchor);
    world.events.push({ type: GAME_EVENTS.RopeAttached, anchorId: 1 });

    const system = createPickupSystem();
    system.run(world);
    expect(world.light.power).toBeCloseTo(0.2 + world.config.light.powerPickup, 9);

    system.reset();
    world.light.power = 0.2;
    // New run reuses the same events array with the same anchor id.
    world.events.push({ type: GAME_EVENTS.RopeAttached, anchorId: 1 });
    system.run(world);

    expect(world.light.power).toBeCloseTo(0.2 + world.config.light.powerPickup, 9);
  });

  it('ignores a RopeAttached event referencing an unknown anchor id without throwing', () => {
    const world = makeWorld();
    world.light.power = 0.2;
    world.events.push({ type: GAME_EVENTS.RopeAttached, anchorId: 999 });

    const system = createPickupSystem();
    expect(() => system.run(world)).not.toThrow();
    expect(world.light.power).toBe(0.2);
  });

  it('does not remove events from world.events', () => {
    const world = makeWorld();
    const anchor = createAnchor(1, 100, 1, 'power', 0, 200);
    world.anchors.push(anchor);
    world.events.push({ type: GAME_EVENTS.RopeAttached, anchorId: 1 });

    const system = createPickupSystem();
    system.run(world);

    expect(world.events).toHaveLength(1);
  });
});
