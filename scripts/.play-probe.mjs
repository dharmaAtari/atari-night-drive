import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 640 } });
await p.goto('http://localhost:8000/', { waitUntil: 'load' });
await p.waitForFunction(() => window.__PHASER_GAME__?.isRunning === true);
await p.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('MenuScene'));
await p.keyboard.press('Space');
await p.waitForFunction(() => window.__NIGHT_DRIVE__?.world !== undefined);

await p.evaluate(() => {
  const w = window.__NIGHT_DRIVE__.world;
  window.__LOG__ = { crashes: [], maxAbsX: 0, overEdgeFrames: 0, maxWhileRunning: 0 };
  const push = w.events.push.bind(w.events);
  w.events.push = (...e) => {
    for (const ev of e) if (ev.type === 'crashed') window.__LOG__.crashes.push(ev.cause);
    return push(...e);
  };
  const tick = () => {
    const ax = Math.abs(w.car.x);
    window.__LOG__.maxAbsX = Math.max(window.__LOG__.maxAbsX, ax);
    if (w.run.state === 'running') {
      window.__LOG__.maxWhileRunning = Math.max(window.__LOG__.maxWhileRunning, ax);
      if (ax > 1.15) window.__LOG__.overEdgeFrames++;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// A human-ish player: rope whenever an anchor window is open, hold ~0.6s.
const end = Date.now() + 60000;
while (Date.now() < end) {
  const shouldThrow = await p.evaluate(() => {
    const w = window.__NIGHT_DRIVE__.world;
    if (w.run.state === 'over') return 'restart';
    if (w.run.state !== 'running' || w.rope.state !== 'idle') return false;
    return w.anchors.some((a) => a.state === 'open');
  });
  if (shouldThrow === 'restart') { await p.keyboard.press('Space'); await p.waitForTimeout(400); continue; }
  if (shouldThrow) { await p.keyboard.down('Space'); await p.waitForTimeout(600); await p.keyboard.up('Space'); }
  else await p.waitForTimeout(50);
}
console.log(JSON.stringify(await p.evaluate(() => window.__LOG__), null, 1));
await b.close();
