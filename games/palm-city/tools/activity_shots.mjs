// activity_shots.mjs — 7F captures at phone size (420x860 @2x): driving past the things you can do,
// with their painted markers readable from the car. Keyboard-driven in the real page.
//   motel  : north up the cross street past the motel door (golden hour and dusk)
//   garage : east along the Garage kerb past TOW and BUS and the JOBS sign
//   events : past the WRECK IT! ring by the plaza
// Usage: CHROME=/path/to/chrome node tools/activity_shots.mjs [scene ...] -> shots/activity-<scene>.png
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
async function scene(name, tod, x, y, h, key, until) {
  if (want.length && !want.includes(name)) return;
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(name + ': ' + e));
  await page.goto(`http://localhost:${server.address().port}/index.html?t=${tod}&dpr=2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(5000);
  await page.evaluate(([x, y, h]) => { const s = window.__palm.sim, P = s.player, c = s.cars.find(k => k.model === 'conv_mint');
    s.addStars = () => {}; s.spawnTraffic = () => null; s.cars = s.cars.filter(k => k === c || k.parked);
    P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true; c.x = x; c.y = y; c.h = h; c.v = 0; }, [x, y, h]);
  await page.waitForTimeout(500);
  // freeze the sim on the exact step the car reaches the spot (a slow machine overshoots otherwise)
  await page.evaluate((src) => { const s = window.__palm.sim, step = s.step.bind(s), hit = new Function('c', 'return ' + src);
    s.step = (dt, inp) => { step(dt, inp); if (hit(s.player.car)) { s.step = () => {}; window.__frozen = true; } }; }, until);
  await page.keyboard.down(key);
  await page.waitForFunction(() => window.__frozen, null, { timeout: 40000 });
  await page.waitForTimeout(1500);                       // let the camera settle on the frozen moment
  const file = path.join(ROOT, 'shots', `activity-${name}.png`);
  await page.screenshot({ path: file });
  console.log('wrote', file, JSON.stringify(await page.evaluate(() => { const s = window.__palm.sim, c = s.player.car; return { x: Math.round(c.x), y: Math.round(c.y), v: Math.round(c.v) }; })));
  await page.close();
}
await scene('motel', 0.2, 757, 1415, -Math.PI / 2, 'ArrowUp', 'c.y < 1335');
await scene('motel-dusk', 0.9, 757, 1415, -Math.PI / 2, 'ArrowUp', 'c.y < 1335');
await scene('garage', 0.2, 700, 1420, 0, 'ArrowUp', 'c.x > 900');
await scene('events', 0.2, 1223, 760, -Math.PI / 2, 'ArrowUp', 'c.y < 560');
await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
