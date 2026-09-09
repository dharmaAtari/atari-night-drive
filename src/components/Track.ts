export interface TrackSegment {
  s: number;
  length: number;
  curvature: number;
}

export interface Track {
  segments: TrackSegment[];
}

export function createTrack(): Track {
  return { segments: [] };
}
