import type Phaser from 'phaser';
import type { World } from '../world';
import type { Projection, ProjectedSegment } from '../components/Projected';
import type { Anchor } from '../components/Anchor';
import type { ObstacleKind } from '../components/Hazard';
import type { Lane } from '../types/lanes';
import type { AnchorKind } from '../types/states';
import { isRopeAttached, laneX } from './RopeSystem';

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
const CAR_LEAN_SKEW_RATIO = 0.35;

// Five distinguishable warm/red tones (GDD §14 reserves saturated warning colour for
// obstacles and the low-power warning; anchors deliberately never draw from this palette).
const OBSTACLE_COLORS: Record<ObstacleKind, number> = {
  stalled: 0xd94436,
  barrier: 0xe8802b,
  pothole: 0x8a5230,
  pedestrian: 0xf2b705,
  debris: 0xb33d1f,
};
const OBSTACLE_WIDTH_RATIO = 1; // one lane wide, in lane units
const OBSTACLE_HEIGHT_RATIO = 1.4; // relative to obstacle width

// Cool/neutral hues per anchor kind (GDD §14: anchors must never read as hazards).
const ANCHOR_KIND_COLOR: Record<AnchorKind, number> = {
  safe: 0x6be8ff,
  power: 0xffd23f,
  highBeam: 0x8f7bff,
};
const ANCHOR_DORMANT_ALPHA = 0.35;
const ANCHOR_WIDTH_RATIO = 0.05;
const ANCHOR_HEIGHT_RATIO = 0.18;
const ANCHOR_PULSE_HZ = 3;

const ROPE_COLOR = 0xd8d8d8;
const ROPE_WARNING_COLOR = 0xff3b30;
const ROPE_TENSION_START = 0.7;
const ROPE_BASE_THICKNESS_DPR = 2;
const ROPE_TAUT_EXTRA_THICKNESS_DPR = 2;

export function roadRenderSystem(world: World, graphics: Phaser.GameObjects.Graphics, time: number): void {
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
  drawObstacles(graphics, world);
  drawAnchors(graphics, world, time);
  drawRope(graphics, world);
  drawCar(graphics, world.projection, world.car.lean);
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

/** A screen-space point/scale interpolated at longitudinal position `s`, or null if `s` falls
 * outside the currently projected segment range. Shared by posts, obstacles, anchors and rope. */
interface ProjectedPoint {
  y: number;
  centreX: number;
  halfWidth: number;
}

function projectAtS(segments: ProjectedSegment[], s: number): ProjectedPoint | null {
  if (segments.length < 2) {
    return null;
  }
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const next = segments[i + 1];
    if (s >= seg.s && s < next.s) {
      const t = (s - seg.s) / (next.s - seg.s);
      return {
        y: lerp(seg.nearY, seg.farY, t),
        centreX: lerp(seg.nearCentreX, seg.farCentreX, t),
        halfWidth: lerp(seg.nearHalfWidth, seg.farHalfWidth, t),
      };
    }
  }
  return null;
}

/** Screen x for a lateral world position `x` (lane units) at a projected point. */
function screenX(point: ProjectedPoint, x: number, roadHalfWidth: number): number {
  return point.centreX + (x / roadHalfWidth) * point.halfWidth;
}

function drawPosts(graphics: Phaser.GameObjects.Graphics, world: World): void {
  const { segments } = world.projection;
  const { posts, config } = world;

  graphics.fillStyle(POST_COLOR, 1);

  for (const post of posts) {
    const point = projectAtS(segments, post.s);
    if (!point) {
      continue;
    }

    const x = screenX(point, post.x, config.road.halfWidth);
    const w = point.halfWidth * 0.03;
    const h = point.halfWidth * 0.08;

    graphics.fillRect(x - w / 2, point.y - h, w, h);
  }
}

function drawObstacles(graphics: Phaser.GameObjects.Graphics, world: World): void {
  const { segments } = world.projection;
  const { hazards, config } = world;

  for (const hazard of hazards) {
    if (hazard.kind !== 'obstacle') {
      continue;
    }

    const point = projectAtS(segments, hazard.s);
    if (!point) {
      continue;
    }

    const color = OBSTACLE_COLORS[hazard.obstacle];
    graphics.fillStyle(color, 1);

    for (const lane of hazard.lanes) {
      const laneCentre = laneX(lane, config.lanes.width);
      const x = screenX(point, laneCentre, config.road.halfWidth);
      const w = (OBSTACLE_WIDTH_RATIO * config.lanes.width / config.road.halfWidth) * point.halfWidth;
      const h = w * OBSTACLE_HEIGHT_RATIO;

      graphics.fillRect(x - w / 2, point.y - h, w, h);
    }
  }
}

function anchorPulse(time: number): number {
  return 0.5 + 0.5 * Math.sin(time * ANCHOR_PULSE_HZ * Math.PI * 2);
}

function anchorScreenPoint(world: World, anchor: Anchor): { point: ProjectedPoint; x: number } | null {
  const point = projectAtS(world.projection.segments, anchor.s);
  if (!point) {
    return null;
  }
  const laneCentre = laneX(anchor.lane, world.config.lanes.width);
  const x = screenX(point, laneCentre, world.config.road.halfWidth);
  return { point, x };
}

function drawAnchors(graphics: Phaser.GameObjects.Graphics, world: World, time: number): void {
  for (const anchor of world.anchors) {
    if (anchor.state === 'passed') {
      continue;
    }

    const projected = anchorScreenPoint(world, anchor);
    if (!projected) {
      continue;
    }
    const { point, x } = projected;

    const color = ANCHOR_KIND_COLOR[anchor.kind];
    const baseW = ANCHOR_WIDTH_RATIO * point.halfWidth;
    const baseH = ANCHOR_HEIGHT_RATIO * point.halfWidth;

    let alpha = 1;
    let w = baseW;
    let h = baseH;

    if (anchor.state === 'dormant') {
      alpha = ANCHOR_DORMANT_ALPHA;
    } else if (anchor.state === 'open') {
      const pulse = anchorPulse(time);
      alpha = 0.7 + 0.3 * pulse;
      const grow = 1 + 0.2 * pulse;
      w = baseW * grow;
      h = baseH * grow;

      // Glow halo behind the post while the throw window is open: the anchor must read as
      // the brightest thing after the headlight cone (GDD §4.4) since the pulse is the tutorial.
      graphics.fillStyle(color, 0.25 * pulse);
      graphics.fillRect(x - w, point.y - h * 1.3, w * 2, h * 1.3);
    } else if (anchor.state === 'attached') {
      alpha = 1;
      w = baseW * 1.15;
      h = baseH * 1.15;
    }

    graphics.fillStyle(color, alpha);
    graphics.fillRect(x - w / 2, point.y - h, w, h);
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;

  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return (r << 16) | (g << 8) | bl;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function drawRope(graphics: Phaser.GameObjects.Graphics, world: World): void {
  const { rope, anchors, projection, viewport } = world;
  if (!isRopeAttached(rope)) {
    return;
  }

  const anchor = anchors.find((a) => a.id === rope.anchorId);
  if (!anchor) {
    return;
  }

  const projected = anchorScreenPoint(world, anchor);
  if (!projected) {
    return;
  }

  // Tension telegraph (required): the rope colour and thickness ramp up before it snaps, so
  // the snap itself is never the player's first signal (implementation-plan Phase 2).
  const tensionT = clamp01((rope.tension - ROPE_TENSION_START) / (1 - ROPE_TENSION_START));
  const color = lerpColor(ROPE_COLOR, ROPE_WARNING_COLOR, tensionT);
  const thickness = (ROPE_BASE_THICKNESS_DPR + tensionT * ROPE_TAUT_EXTRA_THICKNESS_DPR) * viewport.dpr;

  const carX = projection.carScreenX;
  const carY = projection.carScreenY - projection.carScreenHeight / 2;

  graphics.lineStyle(thickness, color, 1);
  graphics.lineBetween(carX, carY, projected.x, projected.point.y);
}

function drawCar(graphics: Phaser.GameObjects.Graphics, projection: Projection, lean: Lane): void {
  const { carScreenX, carScreenY, carScreenWidth, carScreenHeight } = projection;
  const halfW = carScreenWidth / 2;
  const halfH = carScreenHeight / 2;
  const skew = lean * carScreenWidth * CAR_LEAN_SKEW_RATIO;

  const topLeftX = carScreenX - halfW + skew;
  const topRightX = carScreenX + halfW + skew;
  const topY = carScreenY - halfH;
  const bottomLeftX = carScreenX - halfW;
  const bottomRightX = carScreenX + halfW;
  const bottomY = carScreenY + halfH;

  graphics.fillStyle(CAR_FILL_COLOR, 1);
  graphics.fillTriangle(topLeftX, topY, topRightX, topY, bottomRightX, bottomY);
  graphics.fillTriangle(topLeftX, topY, bottomRightX, bottomY, bottomLeftX, bottomY);

  graphics.lineStyle(2, CAR_OUTLINE_COLOR, 1);
  graphics.beginPath();
  graphics.moveTo(topLeftX, topY);
  graphics.lineTo(topRightX, topY);
  graphics.lineTo(bottomRightX, bottomY);
  graphics.lineTo(bottomLeftX, bottomY);
  graphics.closePath();
  graphics.strokePath();
}
