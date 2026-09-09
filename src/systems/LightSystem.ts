/**
 * LightSystem — drains the two light meters and reports how far they reach.
 *
 * This is the difficulty system wearing the atmosphere system's clothes. Cone
 * length decides how early a hazard resolves out of the dark, so power draining
 * makes the game *later* — hazards appear with less warning, reaction windows
 * compress toward their floor, and the run tightens without any tuning value
 * changing.
 *
 * The floor is what keeps that fair. `glowRadius` never returns less than the
 * rope's reaction floor, so at zero power the anchors are still visible in time
 * to be roped: hard, not blind. Break that and running dry becomes a death
 * sentence rather than a squeeze.
 *
 * Power drains with both time and distance, so standing still is not a strategy
 * and going fast costs more light — speed and darkness push the same direction.
 */
import type { GameConfig } from '../config.js';
import type { Light, World } from '../world.js';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** How many metres ahead are lit. High beam overrides power entirely. */
export function coneLength(config: GameConfig, light: Light): number {
  if (light.highBeamActive) return config.light.highBeamCone;
  return lerp(config.light.minCone, config.light.maxCone, clamp01(light.power));
}

/**
 * How far out anchors stay visible. Deliberately larger than the cone — an
 * anchor is self-lit and must read before the road it stands beside does — and
 * floored at the rope's reaction distance so darkness can never hide the thing
 * the player is required to react to.
 */
export function glowRadius(config: GameConfig, light: Light, speed: number): number {
  const coneTerm = coneLength(config, light) * config.light.anchorGlowFactor;
  const floorTerm = speed * config.rope.floorSeconds + config.rope.closeMargin;
  return Math.max(coneTerm, floorTerm);
}

/**
 * How visible an obstacle is at `distanceAhead`: fully lit inside the cone,
 * fading over `fadeMetres` beyond it. This is what makes low power feel like
 * fog rather than a wall.
 */
export function obstacleAlpha(config: GameConfig, light: Light, distanceAhead: number): number {
  return clamp01((coneLength(config, light) - distanceAhead) / config.light.fadeMetres);
}

export function lightSystem(world: World, dt: number, distanceTravelled: number): void {
  const { light, config } = world;

  light.power = Math.max(
    0,
    light.power - (config.light.drainPerSecond * dt + config.light.drainPerMetre * distanceTravelled),
  );

  if (light.highBeamActive) {
    light.highBeam -= config.light.highBeamDrainPerSecond * dt;
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

export function addPower(config: GameConfig, light: Light, amount = config.light.powerPickup): void {
  light.power = Math.min(1, light.power + amount);
}

/**
 * The worst-case gap a hazard must sit behind its anchor for the anchor to be
 * visible first (authoring rule: the anchor is the warning system; if the
 * hazard resolves out of the dark first, the player has been cheated).
 *
 * Evaluated across every extreme of the light state rather than the current one,
 * because a pickup can change visibility between generation and arrival. Taking
 * the worst case means a hazard generated in the dark is still fair if the
 * player picks up power on the way to it.
 */
export function anchorLeadRequirement(config: GameConfig, speed: number): number {
  const extremes: Light[] = [
    { power: 0, highBeam: 0, highBeamActive: false },
    { power: 1, highBeam: 0, highBeamActive: false },
    { power: 0, highBeam: 1, highBeamActive: true },
    { power: 1, highBeam: 1, highBeamActive: true },
  ];

  let worst = Number.NEGATIVE_INFINITY;
  for (const state of extremes) {
    const gap = coneLength(config, state) + config.hazards.leadMargin - glowRadius(config, state, speed);
    if (gap > worst) worst = gap;
  }
  return worst;
}
