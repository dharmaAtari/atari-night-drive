import type { GameConfigFile } from '../config';
import type { World } from '../world';
import type { Light } from '../components/Light';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function coneLength(config: GameConfigFile, light: Light): number {
  if (light.highBeamActive) {
    return config.light.highBeamCone;
  }
  return lerp(config.light.minCone, config.light.maxCone, light.power);
}

export function glowRadius(config: GameConfigFile, light: Light, speed: number): number {
  const coneTerm = coneLength(config, light) * config.light.anchorGlowFactor;
  const floorTerm = speed * config.rope.floorSeconds + config.rope.closeMargin;
  return Math.max(coneTerm, floorTerm);
}

export function obstacleAlpha(config: GameConfigFile, light: Light, distanceAhead: number): number {
  const cone = coneLength(config, light);
  return clamp01((cone - distanceAhead) / config.light.fadeMetres);
}

export function lightSystem(world: World, dt: number, distanceTravelled: number): void {
  const { light } = world;
  const { config } = world;

  light.power = Math.max(
    0,
    light.power - (config.light.drainPerSecond * dt + config.light.drainPerMetre * distanceTravelled),
  );

  if (light.highBeamActive) {
    light.highBeam = light.highBeam - config.light.highBeamDrainPerSecond * dt;
    if (light.highBeam <= 0) {
      light.highBeam = 0;
      light.highBeamActive = false;
    }
  }
}

export function activateHighBeam(light: Light): void {
  light.highBeam = 1;
  light.highBeamActive = true;
}

export function addPower(config: GameConfigFile, light: Light, amount: number = config.light.powerPickup): void {
  light.power = Math.min(1, light.power + amount);
}

const EXTREME_STATES: Light[] = [
  { power: 0, highBeam: 0, highBeamActive: false },
  { power: 1, highBeam: 0, highBeamActive: false },
  { power: 0, highBeam: 1, highBeamActive: true },
  { power: 1, highBeam: 1, highBeamActive: true },
];

export function rule3GapRequirement(config: GameConfigFile, speed: number): number {
  let worst = Number.NEGATIVE_INFINITY;
  for (const state of EXTREME_STATES) {
    const gap = coneLength(config, state) + config.hazards.leadMargin - glowRadius(config, state, speed);
    if (gap > worst) {
      worst = gap;
    }
  }
  return worst;
}
