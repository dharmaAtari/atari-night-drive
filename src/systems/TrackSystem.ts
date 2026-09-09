/**
 * TrackSystem — advances the car and keeps the road built around it.
 *
 * Segments are generated out to the horizon and retired once they fall behind
 * the tail, with both the segments and the scenery posts drawn from pools. That
 * is what lets the run be endless without the arrays being: at any moment the
 * road is a fixed-size window sliding forward.
 *
 * Curvature is not stored authoritatively here. It is sampled from a source
 * function — in play, the live hazard list — so a curve hazard and the road that
 * bends under it can never disagree about where the bend is.
 */
import type { ReflectorPost, TrackSegment, World } from '../world.js';

/** Where a segment's bend comes from, given its position. */
export type CurvatureSource = (s: number) => number;

const flatCurvature: CurvatureSource = () => 0;

export function createTrackSystem(source: CurvatureSource = flatCurvature) {
  const segmentPool: TrackSegment[] = [];
  const postPool: ReflectorPost[] = [];

  return function trackSystem(world: World, dt: number): void {
    const { car, track, config } = world;
    const { road } = config;

    car.s += car.speed * dt;

    extendTrack(track.segments, segmentPool, source, car.s, road.tailMetres, road.horizonMetres, road.segmentLength);
    world.posts = rebuildPosts(world.posts, postPool, car.s, road.tailMetres, road.horizonMetres, road.postSpacing, road.halfWidth);
  };
}

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
    // Snap the first segment to a multiple of its length, so segment boundaries
    // stay on the same grid across a restart and the lane dashes do not crawl.
    const startS = Math.floor(tailEdge / segmentLength) * segmentLength;
    segments.push(takeSegment(pool, startS, segmentLength, source));
  }

  let last = segments[segments.length - 1]!;
  while (last.s + last.length < horizonEdge) {
    segments.push(takeSegment(pool, last.s + last.length, segmentLength, source));
    last = segments[segments.length - 1]!;
  }

  while (segments.length > 1 && segments[0]!.s + segments[0]!.length < tailEdge) {
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

/**
 * Posts sit on a fixed world grid (every `postSpacing` metres, both sides)
 * rather than being spawned, so they stream past at a rate that reads as speed
 * and never bunch up after a restart.
 */
function rebuildPosts(
  current: ReflectorPost[],
  pool: ReflectorPost[],
  carS: number,
  tailMetres: number,
  horizonMetres: number,
  postSpacing: number,
  halfWidth: number,
): ReflectorPost[] {
  const offset = halfWidth + 0.2;
  const firstK = Math.ceil((carS - tailMetres) / postSpacing);
  const lastK = Math.floor((carS + horizonMetres) / postSpacing);

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
  for (; idx < current.length; idx++) pool.push(current[idx]!);
  return result;
}
