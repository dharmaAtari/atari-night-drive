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

export interface World {
  config: GameConfigFile;
  input: InputState;
  viewport: Viewport;
  car: Car;
  track: Track;
  posts: ReflectorPost[];
  projection: Projection;
  events: GameEvent[];
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
  };
}
