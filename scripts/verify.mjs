import { chromium, webkit, firefox, devices } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 5178;
const BASE_URL = `http://localhost:${PORT}`;
const VERIFICATION_DIR = path.join(ROOT, 'docs', 'verification');

const ENGINES = { chromium, webkit, firefox };

const args = process.argv.slice(2);
const onlyFlagIndex = args.indexOf('--only');
const ONLY = onlyFlagIndex !== -1 ? args[onlyFlagIndex + 1] : null;
const SKIP_ENGINES = args.includes('--skip-engines');

if (onlyFlagIndex !== -1 && !ONLY) {
  console.error('--only requires a project name');
  process.exit(1);
}

const ALL_PROJECTS = [
  { name: 'desktop-chromium', engine: 'chromium', viewport: { width: 1280, height: 720 } },
  { name: 'desktop-webkit', engine: 'webkit', viewport: { width: 1280, height: 720 }, engineExtra: true },
  { name: 'desktop-firefox', engine: 'firefox', viewport: { width: 1280, height: 720 }, engineExtra: true },
  { name: 'phone-portrait', engine: 'webkit', device: devices['iPhone 13'], phone: true, engineExtra: true },
  { name: 'phone-landscape', engine: 'chromium', device: devices['Pixel 7 landscape'], phone: true },
  { name: 'throttled', engine: 'chromium', viewport: { width: 390, height: 844 }, throttle: true },
  { name: 'embed', engine: 'chromium', viewport: { width: 1280, height: 720 }, embed: true },
];

if (ONLY && !ALL_PROJECTS.some((p) => p.name === ONLY)) {
  console.error(`Unknown project "${ONLY}". Known: ${ALL_PROJECTS.map((p) => p.name).join(', ')}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function line(status, name, check, detail) {
  console.log(`${status}  ${name}: ${check} — ${detail}`);
  return { status, name, check, detail };
}

const pass = (name, check, detail) => line('PASS', name, check, detail);
const fail = (name, check, detail) => line('FAIL', name, check, detail);
const skip = (name, check, detail) => line('SKIP', name, check, detail);

async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.status === 200) return;
    } catch {
      // server not up yet
    }
    await sleep(300);
  }
  throw new Error('vite dev server did not respond with 200 in time');
}

async function startVite() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  proc.stdout.on('data', () => {});
  proc.stderr.on('data', () => {});
  await waitForServer();
  return proc;
}

function stopVite(proc) {
  if (!proc) return;
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    try {
      proc.kill('SIGTERM');
    } catch {
      // already dead
    }
  }
}

async function sampleFps(target, durationMs = 3000) {
  return target.evaluate((duration) => {
    return new Promise((resolve) => {
      let count = 0;
      const start = performance.now();
      function tick(now) {
        count += 1;
        if (now - start >= duration) {
          resolve((count / (now - start)) * 1000);
        } else {
          requestAnimationFrame(tick);
        }
      }
      requestAnimationFrame(tick);
    });
  }, durationMs);
}

async function getEmbedFrame(page, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frames = page.frames();
    if (frames.length > 1) return frames[1];
    await sleep(100);
  }
  throw new Error('iframe frame did not attach in time');
}

async function runProject(project) {
  const results = [];
  const browserType = ENGINES[project.engine];
  let browser;
  try {
    browser = await browserType.launch();
  } catch (err) {
    results.push(fail(project.name, 'launch', err && err.message ? err.message : String(err)));
    return results;
  }

  const contextOptions = project.device ? { ...project.device } : { viewport: project.viewport };
  let context;
  let page;
  try {
    context = await browser.newContext(contextOptions);
    page = await context.newPage();
  } catch (err) {
    results.push(fail(project.name, 'context', String(err)));
    await browser.close();
    return results;
  }

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err && err.message ? err.message : String(err));
  });

  try {
    if (project.throttle) {
      const client = await context.newCDPSession(page);
      await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }

    const url = project.embed ? `${BASE_URL}/test/embed.html` : `${BASE_URL}/`;
    await page.goto(url, { waitUntil: 'load' });

    let target = page;
    if (project.embed) {
      try {
        target = await getEmbedFrame(page);
      } catch (err) {
        results.push(fail(project.name, 'boot', `iframe did not attach: ${err.message}`));
        return results;
      }
    }

    try {
      await target.waitForFunction(() => window.__NIGHT_LINE__ !== undefined, { timeout: 20000 });
      results.push(pass(project.name, 'boot', '__NIGHT_LINE__ present'));
    } catch (err) {
      results.push(fail(project.name, 'boot', `__NIGHT_LINE__ not found within 20s: ${err.message}`));
      return results;
    }

    const fps = await sampleFps(target, 3000);
    const fpsThreshold = project.throttle ? 30 : 55;
    if (fps >= fpsThreshold) {
      results.push(pass(project.name, 'fps', `${fps.toFixed(1)} fps (>= ${fpsThreshold})`));
    } else {
      results.push(fail(project.name, 'fps', `${fps.toFixed(1)} fps (< ${fpsThreshold})`));
    }

    const state = await target.evaluate(() => {
      const nl = window.__NIGHT_LINE__;
      return {
        viewport: nl && nl.world ? nl.world.viewport : null,
        projection: nl && nl.world ? nl.world.projection : null,
      };
    });

    const vp = state.viewport;
    if (vp && vp.renderWidth > 0 && vp.renderHeight > 0) {
      results.push(pass(project.name, 'viewport-size', `renderWidth=${vp.renderWidth} renderHeight=${vp.renderHeight}`));
    } else {
      results.push(fail(project.name, 'viewport-size', `viewport=${JSON.stringify(vp)}`));
    }

    if (vp) {
      const expectedLayout = vp.cssHeight > vp.cssWidth ? 'portrait' : 'landscape';
      if (vp.layout === expectedLayout) {
        results.push(pass(project.name, 'layout', `${vp.layout} matches css ${vp.cssWidth}x${vp.cssHeight}`));
      } else {
        results.push(fail(project.name, 'layout', `layout=${vp.layout} expected=${expectedLayout} css=${vp.cssWidth}x${vp.cssHeight}`));
      }
    } else {
      results.push(fail(project.name, 'layout', 'viewport missing'));
    }

    const segments = state.projection && state.projection.segments ? state.projection.segments : [];
    if (segments.length === 0) {
      results.push(skip(project.name, 'car-in-road', 'projection.segments is empty — road not yet built'));
    } else {
      const carX = state.projection.carScreenX;
      const carY = state.projection.carScreenY;
      let best = null;
      let bestDist = Infinity;
      for (const seg of segments) {
        const dist = carY >= seg.farY && carY <= seg.nearY ? 0 : Math.min(Math.abs(seg.nearY - carY), Math.abs(seg.farY - carY));
        if (dist < bestDist) { bestDist = dist; best = seg; }
      }
      const span = best.nearY - best.farY || 1;
      const t = Math.min(1, Math.max(0, (best.nearY - carY) / span));
      const centre = best.nearCentreX + (best.farCentreX - best.nearCentreX) * t;
      const half = best.nearHalfWidth + (best.farHalfWidth - best.nearHalfWidth) * t;
      const lo = centre - half;
      const hi = centre + half;
      if (carX >= lo && carX <= hi) {
        results.push(pass(project.name, 'car-in-road', `carScreenX=${carX} within [${lo.toFixed(1)}, ${hi.toFixed(1)}] at carScreenY=${carY.toFixed(1)}`));
      } else {
        results.push(fail(project.name, 'car-in-road', `carScreenX=${carX} outside [${lo.toFixed(1)}, ${hi.toFixed(1)}] at carScreenY=${carY.toFixed(1)}`));
      }
    }

    if (project.phone && vp) {
      const okTop = Number.isFinite(vp.safeTop) && vp.safeTop >= 0;
      const okBottom = Number.isFinite(vp.safeBottom) && vp.safeBottom >= 0;
      if (okTop && okBottom) {
        results.push(pass(project.name, 'safe-area', `safeTop=${vp.safeTop} safeBottom=${vp.safeBottom}`));
      } else {
        results.push(fail(project.name, 'safe-area', `safeTop=${vp.safeTop} safeBottom=${vp.safeBottom}`));
      }
    }

    if (consoleErrors.length === 0 && pageErrors.length === 0) {
      results.push(pass(project.name, 'console-clean', 'no console or page errors'));
    } else {
      results.push(fail(project.name, 'console-clean', [...pageErrors, ...consoleErrors].slice(0, 3).join(' | ')));
    }

    const screenshotPath = path.join(VERIFICATION_DIR, `phase1-${project.name}.png`);
    await page.screenshot({ path: screenshotPath });
    results.push(pass(project.name, 'screenshot', screenshotPath));

    if (project.phone) {
      const errCountBefore = consoleErrors.length + pageErrors.length;
      const size = page.viewportSize();
      await page.setViewportSize({ width: size.height, height: size.width });
      await sleep(300);

      let rotatedLayout = null;
      try {
        rotatedLayout = await target.evaluate(() => window.__NIGHT_LINE__.world.viewport.layout);
      } catch (err) {
        results.push(fail(project.name, 'rotate-eval', String(err)));
      }

      const errCountAfter = consoleErrors.length + pageErrors.length;
      if (errCountAfter === errCountBefore) {
        results.push(pass(project.name, 'rotate-no-error', 'no new errors after rotation'));
      } else {
        results.push(fail(project.name, 'rotate-no-error', `${errCountAfter - errCountBefore} new error(s) after rotation`));
      }

      if (rotatedLayout && rotatedLayout !== vp.layout) {
        results.push(pass(project.name, 'rotate-layout', `layout flipped ${vp.layout} -> ${rotatedLayout}`));
      } else {
        results.push(fail(project.name, 'rotate-layout', `layout did not flip (was ${vp ? vp.layout : '?'}, now ${rotatedLayout})`));
      }

      const rotatedScreenshotPath = path.join(VERIFICATION_DIR, `phase1-${project.name}-rotated.png`);
      await page.screenshot({ path: rotatedScreenshotPath });
      results.push(pass(project.name, 'screenshot-rotated', rotatedScreenshotPath));
    }
  } catch (err) {
    results.push(fail(project.name, 'unexpected', String(err && err.stack ? err.stack : err)));
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  return results;
}

async function main() {
  fs.mkdirSync(VERIFICATION_DIR, { recursive: true });

  const projectsToRun = ONLY ? ALL_PROJECTS.filter((p) => p.name === ONLY) : ALL_PROJECTS;
  const allResults = [];
  let viteProc;

  try {
    viteProc = await startVite();

    for (const project of projectsToRun) {
      if (SKIP_ENGINES && project.engineExtra) {
        allResults.push(skip(project.name, 'run', 'skipped via --skip-engines'));
        continue;
      }
      const results = await runProject(project);
      allResults.push(...results);
    }
  } finally {
    stopVite(viteProc);
  }

  const passed = allResults.filter((r) => r.status === 'PASS').length;
  console.log(`${passed}/${allResults.length} checks passed`);

  const anyFail = allResults.some((r) => r.status === 'FAIL');
  process.exit(anyFail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
