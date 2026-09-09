import type { GameConfigFile } from './config';
import type { InputState } from './components/InputState';
import { createInputState } from './components/InputState';
import type { Viewport } from './components/Viewport';
import { createViewport } from './components/Viewport';

export interface World {
  config: GameConfigFile;
  input: InputState;
  viewport: Viewport;
}

export function createWorld(config: GameConfigFile): World {
  return {
    config,
    input: createInputState(),
    viewport: createViewport(),
  };
}
