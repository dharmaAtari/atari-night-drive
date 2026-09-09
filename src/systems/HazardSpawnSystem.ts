import type { GameConfigFile } from '../config';
import type { World } from '../world';
import type { Hazard } from '../components/Hazard';
import { createRng } from '../rng';
import { createHazardGenerator } from './HazardGenerator';
import { ropeRange } from './AnchorSystem';

const ANCHOR_HEADROOM_METRES = 60;

export interface HazardSpawnSystem {
  run(world: World, difficulty: number): void;
  reset(seed: number): void;
  readonly seed: number;
}

export function spawnLead(config: GameConfigFile, speed: number): number {
  return Math.max(
    config.hazards.spawnLeadSeconds * speed,
    ropeRange(config, speed) + ANCHOR_HEADROOM_METRES,
  );
}

export function curvatureFromHazards(world: World): (s: number) => number {
  return (s: number) => {
    for (const hazard of world.hazards) {
      if (hazard.kind === 'curve' && s >= hazard.s && s < hazard.s + hazard.length) {
        return hazard.curvature;
      }
    }
    return 0;
  };
}

export function createHazardSpawnSystem(seed: number): HazardSpawnSystem {
  let currentSeed = seed;
  let generator = createHazardGenerator(createRng(currentSeed));
  let frontierS = 0;

  const insertHazard = (hazards: Hazard[], hazard: Hazard): void => {
    hazards.push(hazard);
  };

  return {
    get seed() {
      return currentSeed;
    },

    reset(nextSeed: number): void {
      currentSeed = nextSeed;
      generator = createHazardGenerator(createRng(currentSeed));
      frontierS = 0;
    },

    run(world, difficulty): void {
      const { config, car } = world;
      if (world.runState !== 'running') {
        return;
      }

      const target = car.s + spawnLead(config, car.speed);
      let guard = 0;
      while (frontierS < target && guard < 32) {
        const result = generator.next(config, frontierS, car.speed, difficulty, world.nextAnchorId);
        world.nextAnchorId = result.nextId;
        insertHazard(world.hazards, result.emission.hazard);
        for (const anchor of result.emission.anchors) {
          world.anchors.push(anchor);
        }
        frontierS = result.emission.hazard.s;
        guard++;
      }

      const tail = car.s - config.road.tailMetres;
      while (world.hazards.length > 0 && world.hazards[0].s + world.hazards[0].length < tail) {
        world.hazards.shift();
      }
    },
  };
}
