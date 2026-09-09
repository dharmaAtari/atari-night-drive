import { describe, it, expect } from 'vitest';
import { makeWorld, makeConfig } from '../testing/makeWorld';
import { createLight } from '../components/Light';
import {
  coneLength,
  glowRadius,
  obstacleAlpha,
  lightSystem,
  activateHighBeam,
  addPower,
} from './LightSystem';

describe('glowRadius — the reaction-window floor (rule 4.3.4 / GDD §8.4)', () => {
  const config = makeConfig();
  const powers = [0, 0.25, 0.5, 1];
  const speeds = [30, 60, 90, 120];

  it('never drops below the hard reaction floor, for any power x speed combination', () => {
    for (const power of powers) {
      for (const speed of speeds) {
        const light = createLight(power);
        const floor = speed * config.rope.floorSeconds + config.rope.closeMargin;
        expect(glowRadius(config, light, speed)).toBeGreaterThanOrEqual(floor);
      }
    }
  });

  it('binds exactly to the floor at the hard case (power = 0, speed = 120), proving the cone term is smaller', () => {
    const light = createLight(0);
    const speed = 120;
    const floor = speed * config.rope.floorSeconds + config.rope.closeMargin;
    const coneTerm = coneLength(config, light) * config.light.anchorGlowFactor;

    expect(coneTerm).toBeLessThan(floor);
    expect(glowRadius(config, light, speed)).toBe(floor);
  });
});

describe('coneLength', () => {
  const config = makeConfig();

  it('is monotone non-decreasing in power', () => {
    const powers = [0, 0.1, 0.25, 0.5, 0.75, 1];
    let previous = -Infinity;
    for (const power of powers) {
      const value = coneLength(config, createLight(power));
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('equals minCone at power 0 and maxCone at power 1', () => {
    expect(coneLength(config, createLight(0))).toBe(config.light.minCone);
    expect(coneLength(config, createLight(1))).toBe(config.light.maxCone);
  });

  it('returns highBeamCone when highBeamActive is true, regardless of power', () => {
    for (const power of [0, 0.5, 1]) {
      const light = createLight(power);
      activateHighBeam(light);
      expect(coneLength(config, light)).toBe(config.light.highBeamCone);
    }
  });
});

describe('lightSystem — drain', () => {
  it('drains power over time and distance', () => {
    const world = makeWorld();
    const before = world.light.power;
    lightSystem(world, 1, 10);
    expect(world.light.power).toBeLessThan(before);
  });

  it('never drains power below 0', () => {
    const world = makeWorld();
    lightSystem(world, 10000, 100000);
    expect(world.light.power).toBe(0);
  });

  it('high-beam drain never touches power (bit-identical across a high-beam run with power drain zeroed)', () => {
    const config = makeConfig({ light: { drainPerSecond: 0, drainPerMetre: 0 } });
    const world = makeWorld({ config });
    activateHighBeam(world.light);
    const before = world.light.power;

    for (let i = 0; i < 10; i++) {
      lightSystem(world, 0.1, 5);
    }

    expect(world.light.power).toBe(before);
    expect(world.light.highBeam).toBeLessThan(1);
  });

  it('auto-deactivates high beam at empty', () => {
    const world = makeWorld();
    activateHighBeam(world.light);
    lightSystem(world, 10000, 0);
    expect(world.light.highBeam).toBe(0);
    expect(world.light.highBeamActive).toBe(false);
  });
});

describe('obstacleAlpha', () => {
  const config = makeConfig();

  it('is 0 beyond the cone', () => {
    const light = createLight(1);
    const cone = coneLength(config, light);
    expect(obstacleAlpha(config, light, cone + config.light.fadeMetres)).toBe(0);
    expect(obstacleAlpha(config, light, cone + config.light.fadeMetres * 10)).toBe(0);
  });

  it('is 1 well inside the cone', () => {
    const light = createLight(1);
    expect(obstacleAlpha(config, light, 0)).toBe(1);
  });

  it('is strictly between 0 and 1 within the fade band', () => {
    const light = createLight(1);
    const cone = coneLength(config, light);
    const alpha = obstacleAlpha(config, light, cone - config.light.fadeMetres / 2);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
  });

  it('is clamped to [0, 1]', () => {
    const light = createLight(1);
    const cone = coneLength(config, light);
    expect(obstacleAlpha(config, light, -1000)).toBe(1);
    expect(obstacleAlpha(config, light, cone + 1000)).toBe(0);
  });
});

describe('addPower', () => {
  it('adds power and clamps at 1', () => {
    const config = makeConfig();
    const light = createLight(0.5);
    addPower(config, light);
    expect(light.power).toBeCloseTo(0.85, 9);

    addPower(config, light, 1);
    expect(light.power).toBe(1);
  });
});

describe('activateHighBeam', () => {
  it('sets highBeam to 1 and highBeamActive to true', () => {
    const light = createLight(0.5);
    activateHighBeam(light);
    expect(light.highBeam).toBe(1);
    expect(light.highBeamActive).toBe(true);
  });
});
