import type { GameConfigFile } from './config';
import type { InputState } from './components/InputState';
import { createInputState } from './components/InputState';
import type { Viewport } from './components/Viewport';
import { createViewport } from './components/Viewport';
import type { Car } from './components/Car';
import { createCar } from './components/Car';
import type { Track } from './components/Track';
import { createTrack } from './components/Track';
import type { ReflectorPost } from './components/Scenery';
import type { Projection } from './components/Projected';
import { createProjection } from './components/Projected';
import type { GameEvent } from './types/game-events';
import type { Rope } from './components/Rope';
import { createRope } from './components/Rope';
import type { Anchor } from './components/Anchor';
import type { Hazard } from './components/Hazard';
import type { RunState } from './types/states';
import type { Light } from './components/Light';
import { createLight } from './components/Light';

export interface World {
  config: GameConfigFile;
  input: InputState;
  viewport: Viewport;
  car: Car;
  track: Track;
  posts: ReflectorPost[];
  projection: Projection;
  events: GameEvent[];
  rope: Rope;
  anchors: Anchor[];
  hazards: Hazard[];
  light: Light;
  runState: RunState;
  nextAnchorId: number;
  elapsed: number;
}

export function createWorld(config: GameConfigFile): World {
  return {
    config,
    input: createInputState(),
    viewport: createViewport(),
    car: createCar(config.speed.start),
    track: createTrack(),
    posts: [],
    projection: createProjection(),
    events: [],
    rope: createRope(),
    anchors: [],
    hazards: [],
    light: createLight(config.light.startPower),
    runState: 'running',
    nextAnchorId: 1,
    elapsed: 0,
  };
}

export function resetRun(world: World): void {
  const { config } = world;
  world.car.s = 0;
  world.car.x = 0;
  world.car.speed = config.speed.start;
  world.car.lean = 0;
  world.track.segments.length = 0;
  world.posts.length = 0;
  world.anchors.length = 0;
  world.hazards.length = 0;
  world.projection.segments.length = 0;
  world.events.length = 0;
  world.rope.state = 'idle';
  world.rope.anchorId = null;
  world.rope.timer = 0;
  world.rope.extent = 0;
  world.rope.tension = 0;
  world.light.power = config.light.startPower;
  world.light.highBeam = 0;
  world.light.highBeamActive = false;
  world.input.held = false;
  world.input.pressedThisFrame = false;
  world.runState = 'running';
  world.nextAnchorId = 1;
  world.elapsed = 0;
}
