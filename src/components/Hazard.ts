import type { Lane } from '../types/lanes';

export type ObstacleKind = 'stalled' | 'barrier' | 'pothole' | 'pedestrian' | 'debris';
export type CurveKind = 'slightL' | 'slightR' | 'sharpL' | 'sharpR';

export interface Obstacle {
  kind: 'obstacle';
  s: number;
  length: number;
  lanes: Lane[];
  obstacle: ObstacleKind;
}

export interface CurveHazard {
  kind: 'curve';
  s: number;
  length: number;
  curve: CurveKind;
  curvature: number;
}

export type Hazard = Obstacle | CurveHazard;

export function hazardLanes(hazard: Hazard): Lane[] {
  return hazard.kind === 'obstacle' ? hazard.lanes : [];
}
