// events_shots.mjs — phone-size (420x860 @2x) captures of both city events in the real page. The player is
// seated in a convertible, put on the event's beacon, and the event is started with a real TOUCH on the
// fight/job button; the moment is then staged (positions placed, breaks fired through the real destruct
// system) and frozen for the capture.
// Usage: CHROME=/path/to/chrome node tools/events_shots.mjs [scene ...] -> shots/events-<scene>.png
//   scenes: wreck-anchors, wreck-chain, valet-bay, valet-jturn
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const want = process.argv.slice(2), errors = [];
async function scene(name, tod, kind, stage) {
  if (want.length && !want.includes(name)) return;
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(name + ': ' + e));
  await page.goto(`http://localhost:${server.address().port}/index.html?t=${tod}&dpr=2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(5000);
  const cdp = await page.context().newCDPSession(page);
  const fist = await page.evaluate(() => ({ x: 420 - 164, y: innerHeight - 82 }));
  const btn = async () => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fist.x, y: fist.y, id: 4 }] }); await page.waitForTimeout(70); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(120); };
  await page.evaluate((kind) => { const s = window.__palm.sim, P = s.player, c = s.cars.find(k => k.model === 'conv_mint');
    s.addStars = () => {}; P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true;
    const E = s.eventSites.find(e => e.kind === kind); c.x = E.p[0]; c.y = E.p[1]; c.h = 0; c.v = 0; }, kind);
  await page.waitForTimeout(900);
  await btn();                                              // START <EVENT>
  await page.waitForFunction(() => !!window.__palm.sim.event, null, { timeout: 5000 });
  await stage(page);
  const file = path.join(ROOT, 'shots', `events-${name}.png`);
  await page.screenshot({ path: file });
  console.log('wrote', file, JSON.stringify(await page.evaluate(() => { const s = window.__palm.sim, e = s.event || s.eventResult; return e && { kind: e.kind, pts: e.pts, chain: e.chain, idx: e.idx, score: s.score || 0 }; })));
  await page.close();
}
const freeze = (page) => page.evaluate(() => { window.__palm.sim.step = () => {}; });
// wreck: the countdown is over, the player rolling up on the first drum cluster with every anchor ringed
await scene('wreck-anchors', 0.3, 'wreck', async (page) => {
  await page.waitForFunction(() => window.__palm.sim.event.count === 0, null, { timeout: 8000, polling: 'raf' });
  await page.evaluate(() => { const s = window.__palm.sim, c = s.event.car; c.x = 1100; c.y = 540; c.h = -Math.PI / 2 + 0.25; c.v = 0; });
  await page.waitForTimeout(1200); await freeze(page); await page.waitForTimeout(300);
});
// wreck: a drum goes up and the line falls — chain pill hot, decay bar draining
await scene('wreck-chain', 0.3, 'wreck', async (page) => {
  await page.waitForFunction(() => window.__palm.sim.event.count === 0, null, { timeout: 8000, polling: 'raf' });
  await page.evaluate(() => { const s = window.__palm.sim, c = s.event.car; c.x = 1075; c.y = 520; c.h = -Math.PI / 2; c.v = 0;
    const d = s.things.find(t => t.kind === 'drum' && t.x === 1118); s.fx.push({ kind: 'pow', x: d.x, y: d.y, t: 0 });
    d.state = 'fuse'; d.fuse = 0.01; });
  await page.waitForFunction(() => window.__palm.sim.event.chain >= 3, null, { timeout: 8000, polling: 'raf' });
  await page.waitForTimeout(250); await freeze(page); await page.waitForTimeout(300);
});
// valet: threading into the glowing stall with the alignment arrow reading CLEAN
await scene('valet-bay', 0.25, 'valet', async (page) => {
  await page.waitForFunction(() => window.__palm.sim.event.count === 0, null, { timeout: 8000, polling: 'raf' });
  await page.evaluate(() => { const s = window.__palm.sim, ev = s.event, c = ev.car, b = ev.bays[0]; c.x = b.x + 3; c.y = b.y + 44; c.h = -Math.PI / 2 + 0.1; c.v = 40; });
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => { const ev = window.__palm.sim.event, c = ev.car, b = ev.bays[0]; return c.y < b.y + 8; }, null, { timeout: 8000, polling: 'raf' });
  await page.keyboard.up('ArrowUp'); await freeze(page); await page.waitForTimeout(300);
});
// valet: the J-TURN PARK 5x banner after a locked bay
await scene('valet-jturn', 0.9, 'valet', async (page) => {
  await page.waitForFunction(() => window.__palm.sim.event.count === 0, null, { timeout: 8000, polling: 'raf' });
  await page.evaluate(() => { const s = window.__palm.sim, ev = s.event, c = ev.car, b = ev.bays[0]; ev.jt = s.time; ev.bayT = 4; c.x = b.x; c.y = b.y; c.h = b.ax + 0.04; c.v = 0; });
  await page.waitForFunction(() => window.__palm.sim.event.idx >= 1, null, { timeout: 8000, polling: 'raf' });
  await page.waitForTimeout(500); await freeze(page); await page.waitForTimeout(300);
});
await browser.close(); server.close();
if (errors.length) { console.log('PAGE ERRORS', errors); process.exit(1); }
