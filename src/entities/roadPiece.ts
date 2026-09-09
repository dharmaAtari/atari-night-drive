/**
 * The road, as the handful of entities that draw it.
 *
 * The ribbon is one polygon, not one per segment. Consecutive projected segments
 * share an edge, so the whole road from the car to the horizon is a single
 * closed path: down the left edge, back up the right. That turns what would be
 * sixty polygons rebuilt every frame into one, and it cannot seam because there
 * are no internal edges to disagree.
 *
 * Lane dashes are separate because they are genuinely discontinuous, and the
 * night bands are separate because they are horizontal rather than following the
 * road. `RoadViewSystem` writes every one of their point lists each frame.
 */
import Entity from './Entity.js';
import { Shape, ShapeKind, Transform } from '../components/index.js';
import { Depth } from './depths.js';

/** Palette, from public/assets/tokens.json. */
export const RoadColor = {
  SURFACE: 0x14171c,
  SHOULDER: 0x24282f,
  LANE_MARKING: 0x9aa4b2,
  NIGHT: 0x06080c,
} as const;

function ribbon(name: string, color: number, depth: number): Entity {
  return new Entity(name)
    .add(Transform({ depth }))
    .add(
      Shape({
        kind: ShapeKind.POLYGON,
        points: [],
        fillColor: color,
        // Points are absolute screen coordinates, so the entity sits at the
        // origin with no origin offset of its own. Any other origin would shift
        // the whole ribbon by half its bounding box.
        originX: 0,
        originY: 0,
        visible: false,
      }),
    );
}

export function roadSurface(): Entity {
  return ribbon('road.surface', RoadColor.SURFACE, Depth.ROAD_SURFACE);
}

export function roadShoulder(side: 'left' | 'right'): Entity {
  return ribbon(`road.shoulder.${side}`, RoadColor.SHOULDER, Depth.ROAD_SHOULDER);
}

export function laneDash(index: number): Entity {
  return ribbon(`road.dash.${index}`, RoadColor.LANE_MARKING, Depth.LANE_DASH);
}

/**
 * One horizontal slab of darkness. Stacked from the horizon down with alpha
 * falling off as the road gets nearer, these are how headlight power becomes
 * something you can see: less power, and the wall of black starts closer.
 */
export function nightBand(index: number): Entity {
  return new Entity(`night.band.${index}`)
    .add(Transform({ depth: Depth.NIGHT_BAND }))
    .add(
      Shape({
        kind: ShapeKind.RECTANGLE,
        fillColor: RoadColor.NIGHT,
        fillAlpha: 0,
        originX: 0,
        originY: 0,
        visible: false,
      }),
    );
}
