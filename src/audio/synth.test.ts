import { describe, it, expect } from 'vitest';
import { makeConfig } from '../testing/makeWorld';
import { GAME_EVENTS } from '../types/game-events';
import type { GameEvent } from '../types/game-events';
import { enginePitch, engineGain, tautPitch, lowPowerPulseGain, cuesForEvents } from './synth';

describe('enginePitch', () => {
  it('is finite and monotone non-decreasing across and beyond the speed range', () => {
    const config = makeConfig();
    const cap = 3 * config.speed.start;
    const samples = [
      -100,
      0,
      config.speed.start / 2,
      config.speed.start,
      config.speed.start * 1.5,
      cap / 2 + config.speed.start / 2,
      cap,
      cap * 10,
    ];
    let previous = -Infinity;
    for (const speed of samples) {
      const hz = enginePitch(config, speed);
      expect(Number.isFinite(hz)).toBe(true);
      expect(hz).toBeGreaterThanOrEqual(previous);
      previous = hz;
    }
  });

  it('sits at the low end at the start speed and the high end at the cap', () => {
    const config = makeConfig();
    const cap = 3 * config.speed.start;
    expect(enginePitch(config, config.speed.start)).toBeCloseTo(55, 5);
    expect(enginePitch(config, cap)).toBeCloseTo(220, 5);
  });

  it('clamps below the start speed and beyond the cap rather than extrapolating', () => {
    const config = makeConfig();
    const cap = 3 * config.speed.start;
    expect(enginePitch(config, -1000)).toBeCloseTo(enginePitch(config, config.speed.start), 9);
    expect(enginePitch(config, cap * 100)).toBeCloseTo(enginePitch(config, cap), 9);
  });
});

describe('engineGain', () => {
  it('is subtle and clamped 0..1 across the speed range', () => {
    const config = makeConfig();
    const cap = 3 * config.speed.start;
    for (const speed of [0, config.speed.start, config.speed.start * 2, cap, cap * 5]) {
      const gain = engineGain(speed, config.speed.start);
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(1);
      expect(gain).toBeLessThan(0.3);
    }
  });

  it('rises as speed increases relative to the start speed', () => {
    const config = makeConfig();
    const low = engineGain(config.speed.start, config.speed.start);
    const mid = engineGain(config.speed.start * 2, config.speed.start);
    const high = engineGain(3 * config.speed.start, config.speed.start);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  it('returns 0 for a non-positive start speed instead of dividing by zero', () => {
    expect(engineGain(50, 0)).toBe(0);
    expect(Number.isFinite(engineGain(50, 0))).toBe(true);
  });
});

describe('tautPitch', () => {
  it('rises monotonically with tension', () => {
    let previous = -Infinity;
    for (let tension = 0; tension <= 1; tension += 0.1) {
      const hz = tautPitch(tension);
      expect(hz).toBeGreaterThanOrEqual(previous);
      previous = hz;
    }
  });

  it('rises noticeably above 0.7 tension, telegraphing the Skill-3 snap (GDD 4.2/4.4)', () => {
    const highDelta = tautPitch(0.9) - tautPitch(0.7);
    const lowDelta = tautPitch(0.3) - tautPitch(0.1);
    expect(highDelta).toBeGreaterThan(lowDelta);
    // Not just "greater than" by a hair: the telegraph must be unmistakable.
    expect(highDelta).toBeGreaterThan(lowDelta * 5);
  });

  it('is finite at both ends', () => {
    expect(Number.isFinite(tautPitch(0))).toBe(true);
    expect(Number.isFinite(tautPitch(1))).toBe(true);
    expect(tautPitch(-1)).toBe(tautPitch(0)); // negative tension never occurs, but must not blow up
  });
});

describe('lowPowerPulseGain', () => {
  it('is silent at and above the low-power threshold', () => {
    expect(lowPowerPulseGain(0.25, 0)).toBe(0);
    expect(lowPowerPulseGain(0.25, 3.7)).toBe(0);
    expect(lowPowerPulseGain(0.6, 1)).toBe(0);
    expect(lowPowerPulseGain(1, 1)).toBe(0);
  });

  it('stays within 0..1 below the threshold', () => {
    for (let t = 0; t < 10; t += 0.1) {
      const gain = lowPowerPulseGain(0.05, t);
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(1);
    }
  });

  function peakOver(power: number, windowSeconds: number): number {
    let max = 0;
    for (let t = 0; t < windowSeconds; t += 0.005) {
      max = Math.max(max, lowPowerPulseGain(power, t));
    }
    return max;
  }

  function countPeaks(power: number, windowSeconds: number): number {
    const samples: number[] = [];
    for (let t = 0; t < windowSeconds; t += 0.005) {
      samples.push(lowPowerPulseGain(power, t));
    }
    let peaks = 0;
    for (let i = 1; i < samples.length - 1; i++) {
      if (samples[i] > samples[i - 1] && samples[i] >= samples[i + 1] && samples[i] > 0) {
        peaks++;
      }
    }
    return peaks;
  }

  it('gets deeper (louder) as power falls further below the threshold', () => {
    expect(peakOver(0.05, 5)).toBeGreaterThan(peakOver(0.2, 5));
  });

  it('pulses faster as power falls further below the threshold (harder to ignore)', () => {
    expect(countPeaks(0.02, 10)).toBeGreaterThan(countPeaks(0.2, 10));
  });
});

describe('cuesForEvents', () => {
  it('maps each event type to its cue, preserving order', () => {
    const events: GameEvent[] = [
      { type: GAME_EVENTS.RopeAttached, anchorId: 1 },
      { type: GAME_EVENTS.RopeMissed },
      { type: GAME_EVENTS.RopeSnapped },
      { type: GAME_EVENTS.Crashed, cause: 'obstacle' },
    ];
    expect(cuesForEvents(events)).toEqual(['ropeAttach', 'ropeMiss', 'ropeSnap', 'crash']);
  });

  it('returns an empty array for no events', () => {
    expect(cuesForEvents([])).toEqual([]);
  });

  it('preserves duplicates and order for repeated event types', () => {
    const events: GameEvent[] = [
      { type: GAME_EVENTS.RopeMissed },
      { type: GAME_EVENTS.RopeMissed },
      { type: GAME_EVENTS.RopeAttached, anchorId: 2 },
    ];
    expect(cuesForEvents(events)).toEqual(['ropeMiss', 'ropeMiss', 'ropeAttach']);
  });
});
