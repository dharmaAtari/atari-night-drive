import type { GameConfigFile } from '../config';
import type { GameEvent } from '../types/game-events';
import { GAME_EVENTS } from '../types/game-events';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// Engine tone range: two octaves, A1 to A3. Chosen so idle-to-flat-out reads as a rev, not a
// chirp, and so it sits under the taut hum and cues rather than competing with them.
const ENGINE_MIN_HZ = 55;
const ENGINE_MAX_HZ = 220;

/**
 * Continuous engine pitch. Speed is clamped to `[config.speed.start, 3 * config.speed.start]`
 * (the documented cap) before mapping, so the result is always finite and monotone
 * non-decreasing in speed, both below the start speed and beyond the cap.
 *
 * Mapped in log space (frequency perception is logarithmic) so a linear rise in speed reads
 * as a linear rise in pitch.
 */
export function enginePitch(config: GameConfigFile, speed: number): number {
  const start = config.speed.start;
  const cap = 3 * start;
  const range = cap - start;
  const t = range > 0 ? clamp01((speed - start) / range) : 0;
  return ENGINE_MIN_HZ * Math.pow(ENGINE_MAX_HZ / ENGINE_MIN_HZ, t);
}

const ENGINE_GAIN_MIN = 0.12;
const ENGINE_GAIN_MAX = 0.22;

/** Subtle engine volume, rising gently with speed relative to the start speed. Clamped 0..1. */
export function engineGain(speed: number, speedStart: number): number {
  if (speedStart <= 0) {
    return 0;
  }
  const ratio = speed / speedStart; // 1 at the start speed, 3 at the cap
  const t = clamp01((ratio - 1) / 2);
  return clamp01(ENGINE_GAIN_MIN + (ENGINE_GAIN_MAX - ENGINE_GAIN_MIN) * t);
}

// Taut-hum range: a low murmur when the rope is slack, straining toward a taut whine as
// tension approaches the snap. Cubed so the rise is gentle below 0.7 tension and steep above
// it, reinforcing the Skill-3 telegraph the renderer already gives via colour (GDD 4.2/4.4).
const TAUT_MIN_HZ = 200;
const TAUT_MAX_HZ = 900;

export function tautPitch(tension: number): number {
  const t = Math.max(0, tension);
  return TAUT_MIN_HZ + (TAUT_MAX_HZ - TAUT_MIN_HZ) * Math.pow(t, 3);
}

// GDD 8.1: power at or above this is not "low" and the pulse is silent.
const LOW_POWER_THRESHOLD = 0.25;

/**
 * Quiet recurring pulse (GDD 8.1) that gets harder to ignore as power runs out: both its rate
 * and its depth increase as power falls below the threshold. Zero at/above the threshold.
 * Clamped 0..1.
 */
export function lowPowerPulseGain(power: number, elapsed: number): number {
  if (power >= LOW_POWER_THRESHOLD) {
    return 0;
  }
  const severity = clamp01((LOW_POWER_THRESHOLD - power) / LOW_POWER_THRESHOLD);
  const rateHz = 0.6 + severity * 2.4; // 0.6 Hz (easy to ignore) up to 3 Hz (insistent)
  const depth = 0.12 + severity * 0.48; // quiet up to hard-to-ignore
  const phase = (elapsed * rateHz) % 1;
  const envelope = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase); // smooth 0..1 pulse, one per period
  return clamp01(envelope * depth);
}

export type CueName =
  | 'ropeThrow'
  | 'ropeAttach'
  | 'ropeSnap'
  | 'ropeMiss'
  | 'pickupPower'
  | 'pickupHighBeam'
  | 'crash';

/**
 * Maps each event to its cue, in order. Only `RopeAttached`/`RopeMissed`/`RopeSnapped`/
 * `Crashed` originate from `GameEvent` today; `ropeThrow` and the two pickup chimes are
 * derived by the audio system from rope-state transitions and anchor kind, since neither has
 * a dedicated event in the `GameEvent` union.
 */
export function cuesForEvents(events: readonly GameEvent[]): CueName[] {
  const cues: CueName[] = [];
  for (const event of events) {
    switch (event.type) {
      case GAME_EVENTS.RopeAttached:
        cues.push('ropeAttach');
        break;
      case GAME_EVENTS.RopeMissed:
        cues.push('ropeMiss');
        break;
      case GAME_EVENTS.RopeSnapped:
        cues.push('ropeSnap');
        break;
      case GAME_EVENTS.Crashed:
        cues.push('crash');
        break;
    }
  }
  return cues;
}
