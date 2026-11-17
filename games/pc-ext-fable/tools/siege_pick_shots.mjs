// siege_pick_shots.mjs — the Motel Siege cutaway at phone size (420x860 @2x), golden hour and dusk,
// with whatever sheets are live in assets/siege/. Entered the way a player does: at the motel door
// (the JUMP row's own action), a real TOUCH on the action button (ENTER), then held for the capture.
// Usage: CHROME=/path/to/chrome node tools/siege_pick_shots.mjs <label>
//   -> shots/siege-pick-<label>-golden.png, shots/siege-pick-<label>-dusk.png
// Run it once before `node tools/siege_pick.mjs after` (label before) and once after (label after).
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const label = process.argv[2];
if (!label) { console.error('usage: node tools/siege_pick_shots.mjs <label>'); process.exit(2); }
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const errors = [];
for (const [name, tod] of [['golden', 0.25], ['dusk', 0.68]]) {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(name + ': ' + e));
  await page.goto(`http://localhost:${server.address().port}/index.html?t=${tod}&dpr=2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(4000);
  await page.evaluate(() => { const s = window.__palm.sim; s.stars = 2; s.addStars = () => {}; window.__ui.jump = 'motel'; });
  await page.waitForFunction(() => window.__palm.sim.nearMotelDoor(), null, { timeout: 8000 });
  const cdp = await page.context().newCDPSession(page), b = await page.evaluate(() => ({ x: 420 - 72, y: innerHeight - 120 }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y, id: 3 }] });
  await page.waitForTimeout(70);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => !!window.__palm.sim.siege, null, { timeout: 8000 });
  await page.waitForTimeout(2200);                          // the cut to the cutaway settles
  await page.evaluate(() => { window.__palm.sim.step = () => {}; });
  await page.waitForTimeout(300);
  const file = path.join(ROOT, 'shots', `siege-pick-${label}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('wrote', file);
  await page.close();
}
await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
