/**
 * Draw order, in one place.
 *
 * Depth is the only thing keeping the road under the car and the HUD over
 * everything, and it is the kind of constant that rots fast when each factory
 * picks its own number. Gaps are left between layers so a new one can be slotted
 * in without renumbering.
 *
 * The headlight cone sits *below* the objects it lights rather than above them:
 * it is a wash of warm light on the road surface, and painting it over the
 * obstacles would grey out the one thing the player is trying to read.
 */
export const Depth = {
  NIGHT_BAND: -10,
  ROAD_SHOULDER: 0,
  ROAD_SURFACE: 10,
  LANE_DASH: 20,
  HEADLIGHT_CONE: 30,
  REFLECTOR_POST: 40,
  OBSTACLE: 50,
  ANCHOR: 60,
  ROPE: 70,
  CAR: 80,
  HUD: 100,
  OVERLAY: 110,
} as const;
