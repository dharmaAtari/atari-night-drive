export interface Light {
  power: number;
  highBeam: number;
  highBeamActive: boolean;
}

export function createLight(startPower: number): Light {
  return { power: startPower, highBeam: 0, highBeamActive: false };
}
