import type { Lane } from '../types/lanes';

export interface Car {
  s: number;
  x: number;
  speed: number;
  lean: Lane;
}

export function createCar(speed: number): Car {
  return { s: 0, x: 0, speed, lean: 0 };
}
