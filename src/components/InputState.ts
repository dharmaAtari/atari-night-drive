import type { InputMethod } from '../types/platform';

export interface InputState {
  held: boolean;
  pressedThisFrame: boolean;
  method: InputMethod;
}

export function createInputState(): InputState {
  return { held: false, pressedThisFrame: false, method: null };
}
