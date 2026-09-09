import type Phaser from 'phaser';
import type { World } from '../world';
import type { Projection, ProjectedSegment } from '../components/Projected';

const ROAD_COLOR = 0x1e1e1e;
const SHOULDER_COLOR = 0x3a3a3a;
const LANE_COLOR = 0x6a6a6a;
const POST_COLOR = 0x9a9a9a;
const CAR_FILL_COLOR = 0xd8d8d8;
const CAR_OUTLINE_COLOR = 0x3a3a3a;

// Rendering constants, not gameplay tuning: no config key exists for these.
const SHOULDER_WIDTH_RATIO = 0.2;
const LANE_DASH_WIDTH_RATIO = 0.04;
const FAR_EDGE_EXTEND_PX = 1;

export function roadRenderSystem(world: World, graphics: Phaser.GameObjects.Graphics): void {
  graphics.clear();

  const { segments } = world.projection;
  const { lanes } = world.config;

  // Far to near so nearer segments (larger, drawn last) overpaint any seam.
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    drawRoadSegment(graphics, seg);
    if (lanes.count === 3) {
      drawLaneDashes(graphics, seg, i);
    }
  }

  drawPosts(graphics, world);
  drawCar(graphics, world.projection);
}

function drawRoadSegment(graphics: Phaser.GameObjects.Graphics, seg: ProjectedSegment): void {
  const farY = seg.farY - FAR_EDGE_EXTEND_PX;

  const nearLeft = seg.nearCentreX - seg.nearHalfWidth;
  const nearRight = seg.nearCentreX + seg.nearHalfWidth;
  const farLeft = seg.farCentreX - seg.farHalfWidth;
  const farRight = seg.farCentreX + seg.farHalfWidth;

  graphics.fillStyle(ROAD_COLOR, 1);
  graphics.fillTriangle(nearLeft, seg.nearY, nearRight, seg.nearY, farLeft, farY);
  graphics.fillTriangle(nearRight, seg.nearY, farRight, farY, farLeft, farY);

  const nearShoulder = seg.nearHalfWidth * SHOULDER_WIDTH_RATIO;
  const farShoulder = seg.farHalfWidth * SHOULDER_WIDTH_RATIO;

  graphics.fillStyle(SHOULDER_COLOR, 1);
  graphics.fillTriangle(nearLeft - nearShoulder, seg.nearY, nearLeft, seg.nearY, farLeft - farShoulder, farY);
  graphics.fillTriangle(nearLeft, seg.nearY, farLeft, farY, farLeft - farShoulder, farY);
  graphics.fillTriangle(nearRight, seg.nearY, nearRight + nearShoulder, seg.nearY, farRight, farY);
  graphics.fillTriangle(nearRight + nearShoulder, seg.nearY, farRight + farShoulder, farY, farRight, farY);
}

function drawLaneDashes(graphics: Phaser.GameObjects.Graphics, seg: ProjectedSegment, index: number): void {
  if (index % 2 !== 0) {
    return;
  }

  const nearDashHalf = seg.nearHalfWidth * LANE_DASH_WIDTH_RATIO;
  const farDashHalf = seg.farHalfWidth * LANE_DASH_WIDTH_RATIO;

  graphics.fillStyle(LANE_COLOR, 1);
  for (const sign of [-1, 1]) {
    const nearCentre = seg.nearCentreX + sign * (seg.nearHalfWidth / 3);
    const farCentre = seg.farCentreX + sign * (seg.farHalfWidth / 3);
    const nl = nearCentre - nearDashHalf;
    const nr = nearCentre + nearDashHalf;
    const fl = farCentre - farDashHalf;
    const fr = farCentre + farDashHalf;

    graphics.fillTriangle(nl, seg.nearY, nr, seg.nearY, fl, seg.farY);
    graphics.fillTriangle(nr, seg.nearY, fr, seg.farY, fl, seg.farY);
  }
}

function drawPosts(graphics: Phaser.GameObjects.Graphics, world: World): void {
  const { segments } = world.projection;
  const { posts, config } = world;

  if (segments.length < 2) {
    return;
  }

  graphics.fillStyle(POST_COLOR, 1);

  for (const post of posts) {
    let found = -1;
    for (let i = 0; i < segments.length - 1; i++) {
      if (post.s >= segments[i].s && post.s < segments[i + 1].s) {
        found = i;
        break;
      }
    }
    if (found === -1) {
      continue;
    }

    const seg = segments[found];
    const next = segments[found + 1];
    const t = (post.s - seg.s) / (next.s - seg.s);

    const y = lerp(seg.nearY, seg.farY, t);
    const centreX = lerp(seg.nearCentreX, seg.farCentreX, t);
    const halfWidth = lerp(seg.nearHalfWidth, seg.farHalfWidth, t);

    const screenX = centreX + (post.x / config.road.halfWidth) * halfWidth;
    const w = halfWidth * 0.03;
    const h = halfWidth * 0.08;

    graphics.fillRect(screenX - w / 2, y - h, w, h);
  }
}

function drawCar(graphics: Phaser.GameObjects.Graphics, projection: Projection): void {
  const { carScreenX, carScreenY, carScreenWidth, carScreenHeight } = projection;
  const x = carScreenX - carScreenWidth / 2;
  const y = carScreenY - carScreenHeight / 2;

  graphics.fillStyle(CAR_FILL_COLOR, 1);
  graphics.fillRect(x, y, carScreenWidth, carScreenHeight);

  graphics.lineStyle(2, CAR_OUTLINE_COLOR, 1);
  graphics.strokeRect(x, y, carScreenWidth, carScreenHeight);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
