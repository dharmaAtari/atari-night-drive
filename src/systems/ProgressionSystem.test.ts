import { describe, it, expect } from 'vitest';
import { makeWorld, makeConfig } from '../testing/makeWorld';
import { smoothstep, rampAt, speedAt, speedCap, difficultyAt, progressionSystem } from './ProgressionSystem';

describe('smoothstep', () => {
  it('is clamped to [0, 1]', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(2)).toBe(1);
  });

  it('is monotone non-decreasing between 0 and 1', () => {
    let previous = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const value = smoothstep(i / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('speedAt', () => {
  const config = makeConfig();

  it('equals speed.start at t = 0', () => {
    expect(speedAt(config, 0)).toBe(config.speed.start);
  });

  it('equals the speed cap at t = rampSeconds', () => {
    expect(speedAt(config, config.speed.rampSeconds)).toBeCloseTo(speedCap(config), 9);
  });

  it('holds exactly at the cap well past rampSeconds', () => {
    expect(speedAt(config, config.speed.rampSeconds + 600)).toBe(speedCap(config));
  });

  it('is monotone non-decreasing across 400 samples', () => {
    let previous = -Infinity;
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * (config.speed.rampSeconds + 600);
      const value = speedAt(config, t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('speedCap', () => {
  it('is derived as 3x speed.start', () => {
    const config = makeConfig({ speed: { start: 40 } });
    expect(speedCap(config)).toBe(120);
  });
});

describe('difficultyAt', () => {
  const config = makeConfig();

  it('is 0 at t = 0', () => {
    expect(difficultyAt(config, 0)).toBe(0);
  });

  it('reaches 1 and stays 1 well past the ramp', () => {
    expect(difficultyAt(config, config.speed.rampSeconds)).toBe(1);
    expect(difficultyAt(config, config.speed.rampSeconds + 600)).toBe(1);
  });

  it('is monotone non-decreasing across 400 samples', () => {
    let previous = -Infinity;
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * (config.speed.rampSeconds + 600);
      const value = difficultyAt(config, t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('rampAt', () => {
  it('reaches exactly 1 at rampSeconds', () => {
    const config = makeConfig();
    expect(rampAt(config, config.speed.rampSeconds)).toBe(1);
  });
});

describe('progressionSystem', () => {
  it('advances elapsed and speed while running', () => {
    const world = makeWorld();
    world.runState = 'running';
    const beforeElapsed = world.elapsed;
    const beforeSpeed = world.car.speed;

    progressionSystem(world, 1);

    expect(world.elapsed).toBeGreaterThan(beforeElapsed);
    expect(world.car.speed).toBeGreaterThan(beforeSpeed);
    expect(world.car.speed).toBe(speedAt(world.config, world.elapsed));
  });

  it('freezes elapsed and speed while crashing', () => {
    const world = makeWorld();
    world.runState = 'crashing';
    const beforeElapsed = world.elapsed;
    const beforeSpeed = world.car.speed;

    progressionSystem(world, 1);

    expect(world.elapsed).toBe(beforeElapsed);
    expect(world.car.speed).toBe(beforeSpeed);
  });

  it('freezes elapsed and speed while over', () => {
    const world = makeWorld();
    world.runState = 'over';
    const beforeElapsed = world.elapsed;
    const beforeSpeed = world.car.speed;

    progressionSystem(world, 1);

    expect(world.elapsed).toBe(beforeElapsed);
    expect(world.car.speed).toBe(beforeSpeed);
  });
});
