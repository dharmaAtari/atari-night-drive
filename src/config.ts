/**
 * Loads and parses `public/config.json` into a typed object.
 *
 * Everything tunable at run time lives in that file. It ships as a static file
 * under `public/`, so it can be edited in a deployed build without a rebuild —
 * which is also why every field is defaulted here rather than trusted.
 */
import Phaser from 'phaser';

/** Scale mode names allowed in config.json -> Phaser.Scale constants. */
const SCALE_MODES = {
  fit: Phaser.Scale.FIT,
  envelop: Phaser.Scale.ENVELOP,
  resize: Phaser.Scale.RESIZE,
  none: Phaser.Scale.NONE,
} as const;

export type ScaleModeName = keyof typeof SCALE_MODES;

export interface DisplayConfig {
  width: number;
  height: number;
  scaleMode: Phaser.Scale.ScaleModeType;
  autoCenter: boolean;
  fullscreen: boolean;
  backgroundColor: string;
  pixelArt: boolean;
}

export interface PerformanceConfig {
  targetFps: number;
}

export interface AudioConfig {
  volume: number;
  /** logical sound name -> filename under public/assets/sounds/ */
  sounds: Record<string, string>;
}

export interface GameConfig {
  display: DisplayConfig;
  performance: PerformanceConfig;
  audio: AudioConfig;
}

/** Shape of the raw file, where anything may be missing or null. */
interface RawConfig {
  display?: Partial<Record<keyof DisplayConfig, unknown>>;
  performance?: Partial<Record<keyof PerformanceConfig, unknown>>;
  audio?: { volume?: unknown; sounds?: unknown };
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value : fallback;
}

function scaleMode(value: unknown): Phaser.Scale.ScaleModeType {
  const name = typeof value === 'string' ? (value.toLowerCase() as ScaleModeName) : 'fit';
  return SCALE_MODES[name] ?? SCALE_MODES.fit;
}

function soundMap(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

export async function loadConfig(
  path = `${import.meta.env.BASE_URL}config.json`,
): Promise<GameConfig> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path} (HTTP ${response.status})`);
  }

  const raw = (await response.json()) as RawConfig;
  const display = raw.display ?? {};
  const performance = raw.performance ?? {};
  const audio = raw.audio ?? {};

  return {
    display: {
      width: num(display.width, 640),
      height: num(display.height, 480),
      scaleMode: scaleMode(display.scaleMode),
      autoCenter: bool(display.autoCenter, true),
      fullscreen: bool(display.fullscreen, false),
      backgroundColor: str(display.backgroundColor, '#1a3aa8'),
      pixelArt: bool(display.pixelArt, true),
    },
    performance: {
      targetFps: num(performance.targetFps, 60),
    },
    audio: {
      volume: num(audio.volume, 1),
      sounds: soundMap(audio.sounds),
    },
  };
}
