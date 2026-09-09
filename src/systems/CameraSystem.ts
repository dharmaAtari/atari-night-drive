import type { World } from '../world';
import type { ProjectedSegment } from '../components/Projected';
import { segmentAt } from './TrackQuery';

/** Metres represented by one lane-unit of lateral/depth distance in the perspective math. */
export const METRES_PER_LANE_UNIT = 4;

// K: screen-x gain applied per metre of accumulated curvature while walking the track;
// chosen empirically so a `curves.sharp` bend reads as a multi-lane sweep by its far end.
const CURVE_SCREEN_GAIN = 0.2;

// Camera sits behind the car, so the car itself projects at a finite depth and the road
// continues under it to the bottom edge. Depths are clamped away from zero for safety.
const CAMERA_BEHIND_METRES = 5;
const MIN_DZ_METRES = 0.2;
const CAR_LANE_FRACTION = 0.7;

function poolSegment(pool: ProjectedSegment[], index: number): ProjectedSegment {
  if (index < pool.length) {
    return pool[index];
  }
  const segment: ProjectedSegment = {
    s: 0,
    curvature: 0,
    nearY: 0,
    farY: 0,
    nearCentreX: 0,
    farCentreX: 0,
    nearHalfWidth: 0,
    farHalfWidth: 0,
  };
  pool.push(segment);
  return segment;
}

export function cameraSystem(world: World): void {
  const { car, track, viewport, projection, config } = world;
  const pool = projection.segments;
  const halfRenderW = viewport.renderWidth / 2;
  const halfRenderH = viewport.renderHeight / 2;

  let count = 0;
  const cameraS = car.s - CAMERA_BEHIND_METRES;
  const startSegment = segmentAt(track, cameraS) ?? segmentAt(track, car.s);

  if (startSegment) {
    const segments = track.segments;
    const startIndex = segments.indexOf(startSegment);
    const horizonS = car.s + config.road.horizonMetres;

    let dxRate = 0;
    let curveOffset = 0;
    let prevNearY = Number.POSITIVE_INFINITY;

    for (let i = startIndex; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.s >= horizonS) {
        break;
      }

      const nearS = Math.max(seg.s, cameraS);
      const farS = seg.s + seg.length;

      const nearOffset = curveOffset;
      dxRate += seg.curvature * seg.length * CURVE_SCREEN_GAIN;
      curveOffset += dxRate;
      const farOffset = curveOffset;

      const nearDz = Math.max(nearS - cameraS, MIN_DZ_METRES) / METRES_PER_LANE_UNIT;
      const farDz = Math.max(farS - cameraS, MIN_DZ_METRES) / METRES_PER_LANE_UNIT;
      const nearScale = config.camera.depth / nearDz;
      const farScale = config.camera.depth / farDz;

      const nearY = viewport.horizonY + nearScale * config.camera.height * halfRenderH;
      const farY = viewport.horizonY + farScale * config.camera.height * halfRenderH;

      if (farY >= prevNearY) {
        break;
      }

      const target = poolSegment(pool, count);
      target.s = seg.s;
      target.curvature = seg.curvature;
      target.nearY = nearY;
      target.farY = farY;
      target.nearCentreX = halfRenderW + (nearOffset - car.x) * nearScale * halfRenderW;
      target.farCentreX = halfRenderW + (farOffset - car.x) * farScale * halfRenderW;
      target.nearHalfWidth = config.road.halfWidth * nearScale * halfRenderW;
      target.farHalfWidth = config.road.halfWidth * farScale * halfRenderW;

      prevNearY = nearY;
      count++;
    }
  }

  pool.length = count;

  const carScale = config.camera.depth / (CAMERA_BEHIND_METRES / METRES_PER_LANE_UNIT);
  projection.carScreenX = halfRenderW;
  projection.carScreenY = viewport.horizonY + carScale * config.camera.height * halfRenderH;
  projection.carScreenWidth = config.lanes.width * carScale * halfRenderW * CAR_LANE_FRACTION;
  projection.carScreenHeight = projection.carScreenWidth * 0.6;
}
