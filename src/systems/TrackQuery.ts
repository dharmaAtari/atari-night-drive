import type { Track, TrackSegment } from '../components/Track';

export function segmentAt(track: Track, s: number): TrackSegment | null {
  const { segments } = track;
  if (segments.length === 0) {
    return null;
  }
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    if (s < seg.s) {
      hi = mid - 1;
    } else if (s >= seg.s + seg.length) {
      lo = mid + 1;
    } else {
      return seg;
    }
  }
  return null;
}

export function curvatureAt(track: Track, s: number): number {
  return segmentAt(track, s)?.curvature ?? 0;
}
