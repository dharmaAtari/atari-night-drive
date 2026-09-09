/**
 * HazardGenerator — emits the next hazard and the anchors that make it fair.
 *
 * This file is where the game promises not to cheat. Five authoring rules, all
 * enforced structurally rather than checked afterwards, because a rule that can
 * be violated and then detected is a rule that ships broken once:
 *
 *  1. Every hazard has at least one anchor placed so roping it is survivable.
 *     The safe anchor is emitted with the hazard, never separately.
 *  2. Anchors only spawn on the safe side. Two-lane obstacles are restricted to
 *     {-1,0} or {0,1} — never {-1,1} — so an anchor lane is always free.
 *  3. The anchor is visible before the hazard is actionable, across every light
 *     state, not just the current one (`anchorLeadRequirement`).
 *  4. The reaction window never falls below `rope.floorSeconds` in real time.
 *     At high speed anchors move further out rather than arriving sooner.
 *  5. Never two hazards demanding opposite swings inside one rope cycle — an
 *     opposite swing pays an extra return-duration of spacing.
 *
 * Spacing is the maximum of every floor those rules imply, so tightening
 * difficulty can compress the gap only until the first rule would break, and no
 * further.
 */
import type { GameConfig } from '../config.js';
import type { Rng } from '../rng.js';
import {
  CurveKind,
  ObstacleKind,
  createAnchor,
  AnchorKind,
  type Anchor,
  type AnchorId,
  type AnchorLane,
  type CurveKindValue,
  type Hazard,
  type Lane,
  type ObstacleKindValue,
} from '../world.js';
import { anchorWindow, isWindowViable } from './AnchorSystem.js';
import { anchorLeadRequirement } from './LightSystem.js';

/** One emission: the hazard, plus every anchor that exists because of it. */
export interface Emission {
  hazard: Hazard;
  anchors: Anchor[];
}

/** How many metres of road each obstacle occupies. */
const OBSTACLE_LENGTHS: Record<ObstacleKindValue, number> = {
  [ObstacleKind.POTHOLE]: 4,
  [ObstacleKind.DEBRIS]: 4,
  [ObstacleKind.STALLED]: 8,
  [ObstacleKind.PEDESTRIAN]: 10,
  [ObstacleKind.BARRIER]: 12,
};

/** Only these are wide enough to justify blocking two lanes. */
const TWO_LANE_ELIGIBLE: ObstacleKindValue[] = [ObstacleKind.BARRIER, ObstacleKind.PEDESTRIAN];

/** Cushion against floating-point equality biting exactly at a rule boundary. */
const ANCHOR_SPACING_MARGIN = 1;

/** A pickup sits at least this far nearer than the safe anchor, so "nearest" is unambiguous. */
const PICKUP_MIN_OFFSET = 10;

/**
 * Base spacing between emissions, before the per-emission floors are applied.
 * Tightens from the max interval toward the min as difficulty rises, but never
 * below one full rope cycle — pull, hold, return.
 */
export function emissionSpacing(config: GameConfig, speed: number, difficulty: number): number {
  const cap = config.hazards.densityCapDifficulty;
  const t = cap > 0 ? Math.min(Math.max(difficulty, 0), cap) / cap : 1;
  const intervalSeconds =
    config.hazards.maxIntervalSeconds -
    (config.hazards.maxIntervalSeconds - config.hazards.minIntervalSeconds) * t;
  const cycleFloor =
    speed * (config.rope.pullDuration + config.rope.holdMin + config.rope.returnDuration);
  return Math.max(intervalSeconds * speed, cycleFloor);
}

/** Rule 5: one rope cycle, plus the previous hazard's length, plus any reversal cost. */
function ruleFiveMinSpacing(
  config: GameConfig,
  speed: number,
  prevLength: number,
  prevSwing: AnchorLane | null,
  currSwing: AnchorLane,
): number {
  let spacing =
    speed * (config.rope.pullDuration + config.rope.holdMin + config.rope.returnDuration) + prevLength;
  if (prevSwing !== null && prevSwing !== currSwing) {
    spacing += speed * config.rope.returnDuration;
  }
  return spacing;
}

/**
 * How far ahead of the hazard its anchor must stand to satisfy rules 3 and 4 at
 * once. Independent of what the hazard is — both rules are stated purely in
 * terms of `s` and speed.
 */
function requiredAnchorGap(config: GameConfig, speed: number): number {
  return Math.max(anchorLeadRequirement(config, speed), speed * config.rope.floorSeconds, 1);
}

function pickObstacleLanes(rng: Rng, kind: ObstacleKindValue): Lane[] {
  if (TWO_LANE_ELIGIBLE.includes(kind) && rng.chance(0.5)) {
    // Rule 2 by construction: never {-1,1}, so one anchor lane always stays free.
    return rng.chance(0.5) ? [-1, 0] : [0, 1];
  }
  return [rng.pick([-1, 0, 1] as const)];
}

/** What a hazard is, before it knows where it will sit. */
interface HazardShape {
  isCurve: boolean;
  length: number;
  /** the lane the player must be roped into to survive it */
  swingLane: AnchorLane;
  build: (s: number) => Hazard;
}

function buildObstacleShape(rng: Rng, config: GameConfig): HazardShape {
  const kind = rng.weighted(config.hazards.weights) as ObstacleKindValue;
  const lanes = pickObstacleLanes(rng, kind);
  const free = ([-1, 1] as AnchorLane[]).filter((lane) => !lanes.includes(lane));
  const swingLane = rng.pick(free);
  const length = OBSTACLE_LENGTHS[kind] ?? 8;

  return {
    isCurve: false,
    length,
    swingLane,
    build: (s) => ({ kind: 'obstacle', s, length, lanes, obstacle: kind }),
  };
}

function buildCurveShape(rng: Rng, config: GameConfig): HazardShape {
  const severity = rng.pick(['slight', 'sharp'] as const);
  const dir = rng.pick(['L', 'R'] as const);
  const magnitude = severity === 'slight' ? config.curves.slight : config.curves.sharp;
  const length = severity === 'slight' ? config.curves.slightLength : config.curves.sharpLength;

  // Drift pushes to the outside of the bend, so the survivable lane is the
  // inside one — which is also the direction the curve turns.
  const swingLane: AnchorLane = dir === 'L' ? -1 : 1;
  const curve = (severity === 'slight'
    ? dir === 'L'
      ? CurveKind.SLIGHT_LEFT
      : CurveKind.SLIGHT_RIGHT
    : dir === 'L'
      ? CurveKind.SHARP_LEFT
      : CurveKind.SHARP_RIGHT) as CurveKindValue;

  return {
    isCurve: true,
    length,
    swingLane,
    build: (s) => ({
      kind: 'curve',
      s,
      length,
      curve,
      curvature: dir === 'L' ? -magnitude : magnitude,
    }),
  };
}

export interface HazardGenerator {
  next(
    config: GameConfig,
    fromS: number,
    speed: number,
    difficulty: number,
    nextId: AnchorId,
  ): { emission: Emission; nextId: AnchorId };
}

export function createHazardGenerator(rng: Rng): HazardGenerator {
  // Carried across calls, because rule 5 is about consecutive emissions.
  let prevSwing: AnchorLane | null = null;
  let prevLength = 0;
  let prevWasCurve = false;

  return {
    next(config, fromS, speed, difficulty, nextId) {
      // Obstacle-inside-a-curve is the hardest combination, so it is gated on
      // difficulty and always placed at the hard floor rather than the eased one.
      const comboEligible = prevWasCurve && difficulty >= config.hazards.comboThreshold;
      const forceCombo = comboEligible && rng.chance(config.hazards.comboChance);

      const shape = forceCombo
        ? buildObstacleShape(rng, config)
        : rng.chance(config.hazards.curveChance)
          ? buildCurveShape(rng, config)
          : buildObstacleShape(rng, config);

      const gap = requiredAnchorGap(config, speed);
      // Deliberately *not* floored by `spawnLeadSeconds * speed`: that is how far
      // ahead the spawner generates, not how far apart hazards stand. Folding it
      // in here would hold every hazard at least that far from the last one and
      // make min/maxIntervalSeconds unreachable — the density curve would then
      // do nothing at any difficulty.
      const hardFloor = Math.max(
        ruleFiveMinSpacing(config, speed, prevLength, prevSwing, shape.swingLane),
        gap + ANCHOR_SPACING_MARGIN,
      );
      const spacing = forceCombo
        ? hardFloor
        : Math.max(emissionSpacing(config, speed, difficulty), hardFloor);

      const hazardS = fromS + spacing;
      const hazard = shape.build(hazardS);

      let id = nextId;
      const safeAnchorS = hazardS - gap;
      const safeWindow = anchorWindow(config, speed, safeAnchorS, hazardS);
      const anchors: Anchor[] = [
        createAnchor(id++, safeAnchorS, shape.swingLane, AnchorKind.SAFE, safeWindow.windowOpenS, safeWindow.windowCloseS),
      ];

      const pickupKind = rollPickup(rng, config);
      if (pickupKind) {
        // A pickup sits nearer than the safe anchor and on the same side, so
        // taking it never pulls the car into the hazard — rule 2 still holds.
        const desired = Math.max(gap * 0.5, PICKUP_MIN_OFFSET);
        const maxOffset = safeAnchorS - fromS - ANCHOR_SPACING_MARGIN;
        const offset = Math.min(desired, maxOffset);

        if (offset > 0) {
          const pickupS = safeAnchorS - offset;
          const window = anchorWindow(config, speed, pickupS, hazardS);
          const leadOk = hazardS - pickupS >= anchorLeadRequirement(config, speed);
          const floorOk = (window.windowCloseS - window.windowOpenS) / speed >= config.rope.floorSeconds;

          // Dropped silently when it cannot be placed fairly. A pickup is a
          // bonus; bending a rule to fit one in is never worth it.
          if (leadOk && floorOk && isWindowViable(window)) {
            anchors.push(
              createAnchor(id++, pickupS, shape.swingLane, pickupKind, window.windowOpenS, window.windowCloseS),
            );
          }
        }
      }

      prevSwing = shape.swingLane;
      prevLength = shape.length;
      prevWasCurve = shape.isCurve;

      return { emission: { hazard, anchors }, nextId: id };
    },
  };
}

/** One roll for both pickup types, so their chances share a single budget. */
function rollPickup(rng: Rng, config: GameConfig) {
  const roll = rng.next();
  const { power, highBeam } = config.hazards.pickupChance;
  if (roll < power) return AnchorKind.POWER;
  if (roll < power + highBeam) return AnchorKind.HIGH_BEAM;
  return null;
}
