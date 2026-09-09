/**
 * HazardSpawnSystem — keeps the road ahead populated, and swept behind.
 *
 * Holds a frontier: the `s` of the last hazard emitted. Each frame it emits
 * until the frontier is far enough ahead of the car, then retires anything that
 * has fallen behind the tail. The generator decides *what* and *how far apart*;
 * this decides *when*, and owns the seed so a run is reproducible.
 *
 * Spawn lead has to clear the anchor's throw window with room to spare, not just
 * the hazard — an anchor that pops into existence inside its own window would
 * never get to pulse, and the pulse is the tutorial. Hence the headroom term.
 */
import type { GameConfig } from '../config.js';
import { createRng } from '../rng.js';
import { RunState, type Hazard, type World } from '../world.js';
import { createHazardGenerator, type HazardGenerator } from './HazardGenerator.js';
import { ropeRange } from './AnchorSystem.js';

/** Extra metres beyond rope range, so an anchor exists well before it opens. */
const ANCHOR_HEADROOM_METRES = 60;

/**
 * Emissions per frame are capped. A pathological config (tiny spacing, huge
 * lead) could otherwise spin here forever on the first frame of a run; the cap
 * lets the road fill over a few frames instead of hanging the tab.
 */
const MAX_EMISSIONS_PER_FRAME = 32;

export interface HazardSpawnSystem {
  run(world: World, difficulty: number): void;
  reset(seed: number): void;
  readonly seed: number;
}

export function spawnLead(config: GameConfig, speed: number): number {
  return Math.max(
    config.hazards.spawnLeadSeconds * speed,
    ropeRange(config, speed) + ANCHOR_HEADROOM_METRES,
  );
}

/**
 * Curvature sampled from the live hazard list, so the road bends exactly where
 * a curve hazard says it does. Passing this to `TrackSystem` is what stops the
 * road and the hazard that owns it from ever drifting apart.
 */
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
  let generator: HazardGenerator = createHazardGenerator(createRng(currentSeed));
  let frontierS = 0;

  return {
    get seed() {
      return currentSeed;
    },

    reset(nextSeed: number): void {
      currentSeed = nextSeed;
      generator = createHazardGenerator(createRng(currentSeed));
      frontierS = 0;
    },

    run(world: World, difficulty: number): void {
      const { config, car } = world;
      if (world.run.state !== RunState.RUNNING) return;

      const target = car.s + spawnLead(config, car.speed);
      let emitted = 0;

      while (frontierS < target && emitted < MAX_EMISSIONS_PER_FRAME) {
        const { emission, nextId } = generator.next(
          config,
          frontierS,
          car.speed,
          difficulty,
          world.nextAnchorId,
        );
        world.nextAnchorId = nextId;
        world.hazards.push(emission.hazard);
        for (const anchor of emission.anchors) world.anchors.push(anchor);
        frontierS = emission.hazard.s;
        emitted++;
      }

      retire(world.hazards, car.s - config.road.tailMetres);
    },
  };
}

function retire(hazards: Hazard[], tailEdge: number): void {
  while (hazards.length > 0 && hazards[0]!.s + hazards[0]!.length < tailEdge) {
    hazards.shift();
  }
}
