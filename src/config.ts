export interface GameConfigFile {
  display: {
    scaleMode: string;
    fullscreen: boolean;
    maxDevicePixelRatio: number;
    portraitBreakpoint: number;
  };
  input: {
    edgeGuardPx: number;
    gamepad: boolean;
  };
  performance: { targetFps: number };
  lanes: {
    count: number;
    width: number;
  };
  road: {
    halfWidth: number;
    horizonMetres: number;
    tailMetres: number;
    segmentLength: number;
    postSpacing: number;
  };
  camera: {
    height: number;
    depth: number;
  };
  drift: {
    gain: number;
  };
  speed: {
    start: number;
    rampSeconds: number;
  };
  rope: {
    baseRange: number;
    floorSeconds: number;
    closeMargin: number;
    maxExtent: number;
    throwDuration: number;
    pullDuration: number;
    returnDuration: number;
    missCooldown: number;
    holdMin: number;
  };
  curves: {
    slight: number;
    sharp: number;
    slightLength: number;
    sharpLength: number;
  };
  hazards: {
    spawnLeadSeconds: number;
    minIntervalSeconds: number;
    maxIntervalSeconds: number;
    comboThreshold: number;
    weights: {
      stalled: number;
      barrier: number;
      pothole: number;
      pedestrian: number;
      debris: number;
    };
    pickupChance: {
      power: number;
      highBeam: number;
    };
  };
  light: {
    minCone: number;
    maxCone: number;
    highBeamCone: number;
    fadeMetres: number;
    anchorGlowFactor: number;
    drainPerSecond: number;
    drainPerMetre: number;
    powerPickup: number;
    highBeamDrainPerSecond: number;
  };
  score: {
    pointsPerSecond: number;
  };
  fail: {
    impactSeconds: number;
  };
  audio: Record<string, string>;
  debug: {
    autoCentre: boolean;
    showSeed: boolean;
  };
}

export async function loadConfig(): Promise<GameConfigFile> {
  const response = await fetch(`${import.meta.env.BASE_URL}config.json`);
  if (!response.ok) {
    throw new Error(`config.json failed to load: ${response.status}`);
  }
  return (await response.json()) as GameConfigFile;
}
