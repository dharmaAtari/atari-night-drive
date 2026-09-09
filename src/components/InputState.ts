export interface InputState {
  steer: number;
  confirmHeld: boolean;
}

export function createInputState(): InputState {
  return { steer: 0, confirmHeld: false };
}
