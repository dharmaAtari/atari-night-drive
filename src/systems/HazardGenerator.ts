import type { Rng } from '../rng';
import type { GameConfigFile } from '../config';
import type { Hazard, ObstacleKind, CurveKind } from '../components/Hazard';
import type { Anchor } from '../components/Anchor';
import { createAnchor } from '../components/Anchor';
import type { AnchorLane, AnchorId, Lane } from '../types/lanes';
import { anchorWindow, isWindowViable } from './AnchorSystem';
import { rule3GapRequirement } from './LightSystem';

export interface Emission {
  hazard: Hazard;
  anchors: Anchor[];
}

const OBSTACLE_LENGTHS: Record<ObstacleKind, number> = {
  pothole: 4,
  debris: 4,
  stalled: 8,
  pedestrian: 10,
  barrier: 12,
};

const TWO_LANE_ELIGIBLE: ObstacleKind[] = ['barrier', 'pedestrian'];

// Minimum longitudinal cushion (metres) kept between a placed anchor and the point it is
// bounded by, purely to guard against floating point equality at the rule boundary.
const ANCHOR_SPACING_MARGIN = 1;

// A pickup anchor sits nearer than the safe anchor by at least this many metres, so the two
// are never coincident and "nearer" (G0.4) is unambiguous.
const PICKUP_MIN_OFFSET = 10;

// Baseline probability a given emission is a curve rather than an obstacle, and the
// probability that difficulty-gated combo (obstacle immediately after a curve) actually
// fires once eligible. Not specified in the plan/config; chosen as reasonable authoring
// defaults and documented in the report.

/**
 * Rule 4.3.5 structural floor for the *base* spacing between consecutive emissions, ignoring
 * the previous hazard's length and any opposite-swing penalty (those are only knowable inside
 * the generator, which tracks state across calls). Callers/tests should treat this as a lower
 * bound only; `createHazardGenerator(...).next(...)` applies the full rule 4.3.5 inequality
 * (including hazard length and opposite-swing penalty) on top of this.
 */
export function emissionSpacing(config: GameConfigFile, speed: number, difficulty: number): number {
  const cap = config.hazards.densityCapDifficulty;
  const t = cap > 0 ? Math.min(Math.max(difficulty, 0), cap) / cap : 1;
  const intervalSeconds =
    config.hazards.maxIntervalSeconds - (config.hazards.maxIntervalSeconds - config.hazards.minIntervalSeconds) * t;
  const baseFloor = speed * (config.rope.pullDuration + config.rope.holdMin + config.rope.returnDuration);
  return Math.max(intervalSeconds * speed, baseFloor);
}

/** Rule 4.3.5 full minimum spacing, given the previous emission's swing and length. */
function ruleFiveMinSpacing(
  config: GameConfigFile,
  speed: number,
  prevLength: number,
  prevSwing: AnchorLane | null,
  currSwing: AnchorLane,
): number {
  let spacing = speed * (config.rope.pullDuration + config.rope.holdMin + config.rope.returnDuration) + prevLength;
  if (prevSwing !== null && prevSwing !== currSwing) {
    spacing += speed * config.rope.returnDuration;
  }
  return spacing;
}

/**
 * The longitudinal gap (hazard.s - anchor.s) that simultaneously satisfies rule 4.3.3
 * (anchor visible before the hazard is actionable) and rule 4.3.4 (reaction floor), for the
 * given config/speed. Independent of hazard kind/lane — both rules are formulated purely in
 * terms of `s` and speed.
 */
function requiredAnchorGap(config: GameConfigFile, speed: number): number {
  const rule3Gap = rule3GapRequirement(config, speed);
  const rule4Gap = speed * config.rope.floorSeconds;
  return Math.max(rule3Gap, rule4Gap, 1);
}

function pickObstacleLanes(rng: Rng, kind: ObstacleKind): Lane[] {
  if (TWO_LANE_ELIGIBLE.includes(kind) && rng.chance(0.5)) {
    // Only {-1,0} or {0,1}: never {-1,1}, so at least one of the anchor-eligible lanes
    // (-1 or 1) always stays free (rule 4.3.1/4.3.2 by construction).
    return rng.chance(0.5) ? [-1, 0] : [0, 1];
  }
  return [rng.pick([-1, 0, 1] as const)];
}

interface HazardShape {
  isCurve: boolean;
  length: number;
  swingLane: AnchorLane;
  build: (s: number) => Hazard;
}

function buildObstacleShape(rng: Rng, config: GameConfigFile): HazardShape {
  const obstacleKind = rng.weighted(config.hazards.weights) as ObstacleKind;
  const lanes = pickObstacleLanes(rng, obstacleKind);
  const freeAnchorLanes = ([-1, 1] as AnchorLane[]).filter((lane) => !lanes.includes(lane));
  const swingLane = rng.pick(freeAnchorLanes);
  const length = OBSTACLE_LENGTHS[obstacleKind];
  return {
    isCurve: false,
    length,
    swingLane,
    build: (s) => ({ kind: 'obstacle', s, length, lanes, obstacle: obstacleKind }),
  };
}

function buildCurveShape(rng: Rng, config: GameConfigFile): HazardShape {
  const severity = rng.pick(['slight', 'sharp'] as const);
  const dir = rng.pick(['L', 'R'] as const);
  const curveKind = `${severity}${dir}` as CurveKind;
  const magnitude = severity === 'slight' ? config.curves.slight : config.curves.sharp;
  const length = severity === 'slight' ? config.curves.slightLength : config.curves.sharpLength;
  const curvature = dir === 'L' ? -magnitude : magnitude;
  const swingLane: AnchorLane = dir === 'L' ? -1 : 1;
  return {
    isCurve: true,
    length,
    swingLane,
    build: (s) => ({ kind: 'curve', s, length, curve: curveKind, curvature }),
  };
}

export function createHazardGenerator(rng: Rng) {
  let prevSwing: AnchorLane | null = null;
  let prevLength = 0;
  let prevWasCurve = false;

  function next(
    config: GameConfigFile,
    fromS: number,
    speed: number,
    difficulty: number,
    nextId: AnchorId,
  ): { emission: Emission; nextId: AnchorId } {
    const comboEligible = prevWasCurve && difficulty >= config.hazards.comboThreshold;
    const forceCombo = comboEligible && rng.chance(config.hazards.comboChance);

    const shape = forceCombo
      ? buildObstacleShape(rng, config)
      : rng.chance(config.hazards.curveChance)
        ? buildCurveShape(rng, config)
        : buildObstacleShape(rng, config);

    const gap = requiredAnchorGap(config, speed);
    const ruleFiveFloor = ruleFiveMinSpacing(config, speed, prevLength, prevSwing, shape.swingLane);
    const spawnLeadFloor = config.hazards.spawnLeadSeconds * speed;
    const anchorFloor = gap + ANCHOR_SPACING_MARGIN;
    const hardFloor = Math.max(ruleFiveFloor, spawnLeadFloor, anchorFloor);
    const spacing = forceCombo ? hardFloor : Math.max(emissionSpacing(config, speed, difficulty), hardFloor);

    const hazardS = fromS + spacing;
    const hazard = shape.build(hazardS);

    let id = nextId;
    const safeAnchorS = hazardS - gap;
    const safeWindow = anchorWindow(config, speed, safeAnchorS, hazardS);
    const safeAnchor = createAnchor(id++, safeAnchorS, shape.swingLane, 'safe', safeWindow.windowOpenS, safeWindow.windowCloseS);
    const anchors: Anchor[] = [safeAnchor];

    const roll = rng.next();
    let pickupKind: 'power' | 'highBeam' | null = null;
    if (roll < config.hazards.pickupChance.power) {
      pickupKind = 'power';
    } else if (roll < config.hazards.pickupChance.power + config.hazards.pickupChance.highBeam) {
      pickupKind = 'highBeam';
    }

    if (pickupKind !== null) {
      const desiredOffset = Math.max(gap * 0.5, PICKUP_MIN_OFFSET);
      const maxOffset = safeAnchorS - fromS - ANCHOR_SPACING_MARGIN;
      const offset = Math.min(desiredOffset, maxOffset);
      if (offset > 0) {
        const pickupS = safeAnchorS - offset;
        const rule3Ok = hazardS - pickupS >= rule3GapRequirement(config, speed);
        const window = anchorWindow(config, speed, pickupS, hazardS);
        const floorOk = (window.windowCloseS - window.windowOpenS) / speed >= config.rope.floorSeconds;
        if (rule3Ok && floorOk && isWindowViable(window)) {
          anchors.push(createAnchor(id++, pickupS, shape.swingLane, pickupKind, window.windowOpenS, window.windowCloseS));
        }
      }
    }

    prevSwing = shape.swingLane;
    prevLength = shape.length;
    prevWasCurve = shape.isCurve;

    return { emission: { hazard, anchors }, nextId: id };
  }

  return { next };
}
