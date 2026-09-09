import type { World } from '../world';
import type { TrackSegment } from '../components/Track';
import type { ReflectorPost } from '../components/Scenery';
import type { GameConfigFile } from '../config';

export type CurvatureSource = (s: number) => number;

const flatCurvature: CurvatureSource = () => 0;

const DEBUG_PRESET_PERIOD = 200 + 60 + 100 + 120 + 200;

export function createTrackSystem(source: CurvatureSource = flatCurvature) {
  const segmentPool: TrackSegment[] = [];
  const postPool: ReflectorPost[] = [];

  return function trackSystem(world: World, dt: number): void {
    const { car, track } = world;
    const { road } = world.config;

    car.s += car.speed * dt;

    extendTrack(
      track.segments,
      segmentPool,
      source,
      car.s,
      road.tailMetres,
      road.horizonMetres,
      road.segmentLength,
    );

    world.posts = rebuildPosts(
      world.posts,
      postPool,
      car.s,
      road.tailMetres,
      road.horizonMetres,
      road.postSpacing,
      road.halfWidth,
    );
  };
}

export const trackSystem = createTrackSystem();

function extendTrack(
  segments: TrackSegment[],
  pool: TrackSegment[],
  source: CurvatureSource,
  carS: number,
  tailMetres: number,
  horizonMetres: number,
  segmentLength: number,
): void {
  const tailEdge = carS - tailMetres;
  const horizonEdge = carS + horizonMetres;

  if (segments.length === 0) {
    const startS = Math.floor(tailEdge / segmentLength) * segmentLength;
    segments.push(takeSegment(pool, startS, segmentLength, source));
  }

  let last = segments[segments.length - 1];
  while (last.s + last.length < horizonEdge) {
    const nextS = last.s + last.length;
    segments.push(takeSegment(pool, nextS, segmentLength, source));
    last = segments[segments.length - 1];
  }

  while (segments.length > 1 && segments[0].s + segments[0].length < tailEdge) {
    pool.push(segments.shift()!);
  }
}

function takeSegment(
  pool: TrackSegment[],
  s: number,
  length: number,
  source: CurvatureSource,
): TrackSegment {
  const curvature = source(s);
  const reused = pool.pop();
  if (reused) {
    reused.s = s;
    reused.length = length;
    reused.curvature = curvature;
    return reused;
  }
  return { s, length, curvature };
}

function rebuildPosts(
  current: ReflectorPost[],
  pool: ReflectorPost[],
  carS: number,
  tailMetres: number,
  horizonMetres: number,
  postSpacing: number,
  halfWidth: number,
): ReflectorPost[] {
  const tailEdge = carS - tailMetres;
  const horizonEdge = carS + horizonMetres;
  const offset = halfWidth + 0.2;
  const firstK = Math.ceil(tailEdge / postSpacing);
  const lastK = Math.floor(horizonEdge / postSpacing);

  const result: ReflectorPost[] = [];
  let idx = 0;
  for (let k = firstK; k <= lastK; k++) {
    const s = k * postSpacing;
    for (const x of [-offset, offset]) {
      const post = current[idx] ?? pool.pop() ?? { s: 0, x: 0 };
      post.s = s;
      post.x = x;
      result.push(post);
      idx++;
    }
  }
  for (; idx < current.length; idx++) {
    pool.push(current[idx]);
  }
  return result;
}

export function debugPresetCurvature(s: number, config: GameConfigFile): number {
  const { slight, sharp } = config.curves;
  let pos = s % DEBUG_PRESET_PERIOD;
  if (pos < 0) {
    pos += DEBUG_PRESET_PERIOD;
  }

  if (pos < 200) {
    return 0;
  }
  pos -= 200;
  if (pos < 60) {
    return -slight;
  }
  pos -= 60;
  if (pos < 100) {
    return 0;
  }
  pos -= 100;
  if (pos < 120) {
    return sharp;
  }
  return 0;
}
