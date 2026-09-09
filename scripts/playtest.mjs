/**
 * Headless playtest: boots the game in Chromium, plays it, and asserts it works.
 *
 * Compiling is not working. This drives the real game through the real renderer,
 * presses the real key, and checks the world actually advanced — which is the
 * only claim worth making before saying a change is done.
 *
 * Usage: node scripts/playtest.mjs [url]
 */
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:8000/';
const errors = [];
let failures = 0;

const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });

page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: 'load' });

// --- boot ----------------------------------------------------------------
await page.waitForFunction(() => window.__PHASER_GAME__?.isRunning === true, { timeout: 20000 });
check('game boots and is running', true);

// The loader is still working when the game first reports running, so wait for
// BootScene to hand over before asking what arrived.
await page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('MenuScene'), { timeout: 20000 });
check('BootScene hands over to the menu', true);

const textures = await page.evaluate(() => {
  const g = window.__PHASER_GAME__;
  return g.textures.getTextureKeys().filter((k) => !k.startsWith('__'));
});
check('sprite textures loaded', textures.length >= 20, `${textures.length} keys`);

const missing = ['car.body', 'anchor.open', 'obstacle.pedestrianWalk', 'ui.meterFrame']
  .filter((k) => !textures.includes(k));
check('key textures present', missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : '');

// The walk strip must have been sliced into frames, or the Animation component
// has nothing to address.
const walkFrames = await page.evaluate(() =>
  window.__PHASER_GAME__.textures.get('obstacle.pedestrianWalk').getFrameNames().length);
check('pedestrian strip sliced into frames', walkFrames === 4, `${walkFrames} frames`);

await page.screenshot({ path: 'docs/verification/menu.png' });

// --- menu -> game --------------------------------------------------------
await page.keyboard.press('Space');
await page.waitForFunction(() => window.__NIGHT_DRIVE__?.world !== undefined, { timeout: 10000 });
check('PLAY starts the game scene', true);

// --- play ----------------------------------------------------------------
// An autopilot running the same policy the headless simulation verified: throw
// at the nearest open anchor once the hazard is within rope range, hold until
// the hazard is behind, let go before the rope reaches its limit. It drives the
// game through real key events, so the whole input path is exercised.
await page.evaluate(() => {
  window.__SAMPLES__ = [];
  let holding = false;

  const key = (type, down) => window.dispatchEvent(
    new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true, cancelable: true }));

  const want = (w) => {
    const hazard = w.hazards.find((h) => h.s + h.length > w.car.s - 1);
    const rope = w.rope.state;
    if (rope === 'attached' || rope === 'throwing') {
      const cleared = !hazard || w.car.s > hazard.s + hazard.length + 1;
      return !cleared && w.rope.tension < 0.8;
    }
    if (rope === 'idle' || rope === 'returning') {
      const open = w.anchors.some((a) => a.state === 'open' && a.s >= w.car.s);
      // Rope range floors at baseRange; close enough for the autopilot.
      const near = hazard ? hazard.s - w.car.s < Math.max(60, w.car.speed * 0.45 + 8) : false;
      return open && near;
    }
    return false;
  };

  const tick = () => {
    const w = window.__NIGHT_DRIVE__?.world;
    if (w) {
      window.__SAMPLES__.push({
        s: w.car.s, x: w.car.x, speed: w.car.speed, rope: w.rope.state,
        tension: w.rope.tension, power: w.light.power, elapsed: w.run.elapsed,
        state: w.run.state, hazards: w.hazards.length, anchors: w.anchors.length,
        segments: w.projection.count, best: w.run.best,
      });

      // Restarting is itself a press, so the autopilot exercises that path too.
      const desired = w.run.state === 'over' ? true : want(w);
      if (desired !== holding) {
        key(desired ? 'keydown' : 'keyup');
        holding = desired;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

await page.waitForTimeout(20000);

// A frame with the things the game is actually about in it: an open anchor
// pulsing, and a hazard resolving out of the dark ahead of it.
await page.waitForFunction(() => {
  const w = window.__NIGHT_DRIVE__?.world;
  if (!w || w.run.state !== 'running') return false;
  const anchorOpen = w.anchors.some((a) => a.state === 'open' && a.s - w.car.s < 120);
  const hazardNear = w.hazards.some((h) => h.kind === 'obstacle' && h.s - w.car.s > 0 && h.s - w.car.s < 140);
  return anchorOpen && hazardNear;
}, { timeout: 25000 }).catch(() => console.log('note: no anchor+hazard frame captured'));
await page.screenshot({ path: 'docs/verification/anchor-and-hazard.png' });

await page.screenshot({ path: 'docs/verification/gameplay.png' });

const samples = await page.evaluate(() => window.__SAMPLES__);
check('frames were sampled', samples.length > 60, `${samples.length} frames`);

const first = samples[0];
const last = samples[samples.length - 1];
const maxS = Math.max(...samples.map((s) => s.s));
check('the car travels down the road', maxS > 400, `reached ${maxS.toFixed(0)} m`);

const bestElapsed = Math.max(...samples.map((s) => s.elapsed));
check('a run lasts more than a few seconds', bestElapsed > 8, `survived ${bestElapsed.toFixed(1)} s`);
check('road is projected every frame', samples.every((s) => s.segments >= 2),
  `min ${Math.min(...samples.map((s) => s.segments))} segments`);
check('hazards and anchors exist', samples.some((s) => s.hazards > 0 && s.anchors > 0));
check('headlight power drains', last.power < first.power,
  `${first.power.toFixed(3)} -> ${last.power.toFixed(3)}`);

const ropeStates = [...new Set(samples.map((s) => s.rope))];
check('rope attaches, not just misses', ropeStates.includes('attached'),
  `states: ${ropeStates.join(', ')}`);

const lanes = samples.map((s) => s.x);
check('the car changes lane', Math.max(...lanes) - Math.min(...lanes) > 0.3,
  `x range ${(Math.max(...lanes) - Math.min(...lanes)).toFixed(2)} lanes`);

check('no non-finite world values',
  samples.every((s) => Number.isFinite(s.s) && Number.isFinite(s.x) && Number.isFinite(s.speed)));

// --- frame rate ----------------------------------------------------------
const fps = await page.evaluate(async () => {
  let frames = 0;
  const start = performance.now();
  await new Promise((resolve) => {
    const tick = () => { frames++; performance.now() - start < 2000 ? requestAnimationFrame(tick) : resolve(); };
    requestAnimationFrame(tick);
  });
  return (frames * 1000) / (performance.now() - start);
});
check('holds a playable frame rate', fps >= 30, `${fps.toFixed(0)} fps (headless)`);

// --- console -------------------------------------------------------------
const realErrors = errors.filter((e) => !/favicon|WebGL|SwiftShader|GroupMarker/i.test(e));
check('no console errors', realErrors.length === 0,
  realErrors.length ? realErrors.slice(0, 4).join(' | ') : '');

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nplaytest passed');
process.exit(failures ? 1 : 0);
