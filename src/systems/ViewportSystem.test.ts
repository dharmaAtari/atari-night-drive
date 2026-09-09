import { describe, expect, it } from 'vitest';
import { makeConfig } from '../testing/makeWorld';
import { createWorld } from '../world';
import { viewportSystem } from './ViewportSystem';

describe('viewportSystem', () => {
  it('computes render size from cssWidth/cssHeight and dpr, landscape layout', () => {
    const world = createWorld(makeConfig());

    viewportSystem(world, {
      cssWidth: 1280,
      cssHeight: 720,
      dpr: 1,
      safeTop: 0,
      safeRight: 0,
      safeBottom: 0,
      safeLeft: 0,
    });

    expect(world.viewport.cssWidth).toBe(1280);
    expect(world.viewport.cssHeight).toBe(720);
    expect(world.viewport.renderWidth).toBe(1280);
    expect(world.viewport.renderHeight).toBe(720);
    expect(world.viewport.layout).toBe('landscape');
    expect(world.viewport.horizonY).toBeCloseTo(720 * 0.45);
  });

  it('caps dpr at config.display.maxDevicePixelRatio and scales render size', () => {
    const world = createWorld(makeConfig({ display: { maxDevicePixelRatio: 2 } }));

    viewportSystem(world, {
      cssWidth: 400,
      cssHeight: 800,
      dpr: 3,
      safeTop: 0,
      safeRight: 0,
      safeBottom: 0,
      safeLeft: 0,
    });

    expect(world.viewport.dpr).toBe(2);
    expect(world.viewport.renderWidth).toBe(800);
    expect(world.viewport.renderHeight).toBe(1600);
  });

  it('picks portrait layout below the breakpoint and scales horizonY at 0.40', () => {
    const world = createWorld(makeConfig({ display: { portraitBreakpoint: 1.0 } }));

    viewportSystem(world, {
      cssWidth: 400,
      cssHeight: 800,
      dpr: 1,
      safeTop: 0,
      safeRight: 0,
      safeBottom: 0,
      safeLeft: 0,
    });

    expect(world.viewport.layout).toBe('portrait');
    expect(world.viewport.horizonY).toBeCloseTo(800 * 0.4);
  });

  it('scales safe-area insets by the capped dpr', () => {
    const world = createWorld(makeConfig({ display: { maxDevicePixelRatio: 2 } }));

    viewportSystem(world, {
      cssWidth: 400,
      cssHeight: 800,
      dpr: 2,
      safeTop: 20,
      safeRight: 5,
      safeBottom: 15,
      safeLeft: 5,
    });

    expect(world.viewport.safeTop).toBe(40);
    expect(world.viewport.safeRight).toBe(10);
    expect(world.viewport.safeBottom).toBe(30);
    expect(world.viewport.safeLeft).toBe(10);
  });
});
