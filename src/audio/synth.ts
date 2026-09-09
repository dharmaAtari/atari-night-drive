/**
 * Pure mappings from game state to sound parameters.
 *
 * Separated from `AudioSystem` because these are the parts worth reasoning about
 * and testing — everything else in that file is WebAudio plumbing that needs a
 * browser. Nothing here touches an AudioContext.
 */
import type { GameConfig } from '../config.js';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Two octaves, A1 to A3 — wide enough to read as a rev, not a chirp. */
const ENGINE_MIN_HZ = 55;
const ENGINE_MAX_HZ = 220;

/**
 * Engine pitch, the speed cue this game uses instead of a speedometer.
 *
 * Mapped in log space because pitch perception is logarithmic: a linear rise in
 * speed has to be a geometric rise in frequency to *sound* linear. Speed is
 * clamped to the documented start..3x range first, so the result is finite and
 * monotone even if a config edit puts speed outside it.
 */
export function enginePitch(config: GameConfig, speed: number): number {
  const start = config.speed.start;
  const range = 3 * start - start;
  const t = range > 0 ? clamp01((speed - start) / range) : 0;
  return ENGINE_MIN_HZ * Math.pow(ENGINE_MAX_HZ / ENGINE_MIN_HZ, t);
}

const ENGINE_GAIN_MIN = 0.1;
const ENGINE_GAIN_MAX = 0.2;

/** Rises gently with speed. Stays under the cues rather than competing. */
export function engineGain(speed: number, speedStart: number): number {
  if (speedStart <= 0) return 0;
  const t = clamp01((speed / speedStart - 1) / 2);
  return ENGINE_GAIN_MIN + (ENGINE_GAIN_MAX - ENGINE_GAIN_MIN) * t;
}

const TAUT_MIN_HZ = 110;
const TAUT_MAX_HZ = 440;

/**
 * The rope's hum, bound to tension so the snap is telegraphed in sound as well
 * as colour. A player looking at the road rather than the rope still gets the
 * warning.
 */
export function tautPitch(tension: number): number {
  return TAUT_MIN_HZ + (TAUT_MAX_HZ - TAUT_MIN_HZ) * clamp01(tension);
}
