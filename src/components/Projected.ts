export interface ProjectedSegment {
  s: number;
  curvature: number;
  nearY: number;
  farY: number;
  nearCentreX: number;
  farCentreX: number;
  nearHalfWidth: number;
  farHalfWidth: number;
}

export interface Projection {
  segments: ProjectedSegment[];
  carScreenX: number;
  carScreenY: number;
  carScreenWidth: number;
  carScreenHeight: number;
}

export function createProjection(): Projection {
  return { segments: [], carScreenX: 0, carScreenY: 0, carScreenWidth: 0, carScreenHeight: 0 };
}
