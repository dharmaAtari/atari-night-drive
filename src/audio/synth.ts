/**
 * Pure mappings from game state to sound parameters.
 *
 * Separated from `AudioSystem` because these are the parts worth reasoning about
 * and testing — everything else in that file is WebAudio plumbing that needs a
 * browser. Nothing here touches an AudioContext or a Phaser sound.
 */
import type { GameConfig } from '../config.js';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 0 at the starting speed, 1 at the 3x cap — the ramp every engine cue reads. */
function speedRamp(config: GameConfig, speed: number): number {
  const start = config.speed.start;
  const range = 3 * start - start;
  return range > 0 ? clamp01((speed - start) / range) : 0;
}

/**
 * Playback rate for the engine loop sample, the speed cue this game uses
 * instead of a speedometer.
 *
 * One octave across the whole ramp, and geometric rather than linear because
 * pitch perception is logarithmic: a linear rise in speed has to be a geometric
 * rise in rate to *sound* linear. Speed is clamped to the documented start..3x
 * range first, so the result is finite and monotone even if a config edit puts
 * speed outside it.
 */
export function engineRate(config: GameConfig, speed: number): number {
  return Math.pow(2, speedRamp(config, speed));
}

const ENGINE_GAIN_MIN = 0.35;
const ENGINE_GAIN_MAX = 0.6;

/** Rises gently with speed. Stays under the cues rather than competing. */
export function engineGain(config: GameConfig, speed: number): number {
  return ENGINE_GAIN_MIN + (ENGINE_GAIN_MAX - ENGINE_GAIN_MIN) * speedRamp(config, speed);
}

const WIND_GAIN_MIN = 0.08;
const WIND_GAIN_MAX = 0.45;

/**
 * Wind is the other half of the speed cue: it climbs faster than the engine so
 * the top of the ramp reads as rushing, not just revving.
 */
export function windGain(config: GameConfig, speed: number): number {
  const t = speedRamp(config, speed);
  return WIND_GAIN_MIN + (WIND_GAIN_MAX - WIND_GAIN_MIN) * t * t;
}

/**
 * Lateral drift rate at which the tyre squeal is at full volume, in lane units
 * per second. A sharp curve at the speed cap pushes about 1.1; a slight curve
 * at the start about 0.12, so slight bends whisper and sharp ones shout.
 */
const DRIFT_FULL_RATE = 0.8;

/**
 * How loud the drift squeal is for a given lateral drift rate — the push a
 * curve applies to an unroped car, as `DriftSystem` computes it. Zero when the
 * road is straight, so the cue is only ever heard when a curve is going
 * untaken, which is exactly when the player needs telling.
 */
export function driftGain(driftRate: number): number {
  return clamp01(Math.abs(driftRate) / DRIFT_FULL_RATE);
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
