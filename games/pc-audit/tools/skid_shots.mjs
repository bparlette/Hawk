// skid_shots.mjs — 7E captures at phone size (420x860 @2x), driven with the keyboard in the real page.
//   donut : full lock + feathered throttle at the street crossing -> rings on the asphalt
//   drift : flat out along the top road, then thrown into the plaza turn -> curved marks
//   sand  : a run along the beach -> carved ruts
// Usage: CHROME=/path/to/chrome node tools/skid_shots.mjs [scene ...] -> shots/skid-<scene>.png
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
async function scene(name, x, y, h, drive) {
  if (want.length && !want.includes(name)) return;
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(name + ': ' + e));
  await page.goto(`http://localhost:${server.address().port}/index.html?t=0.2&dpr=2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(5000);
  await page.evaluate(([x, y, h]) => { const s = window.__palm.sim, P = s.player, c = s.cars.find(k => k.model === 'conv_mint');
    s.addStars = () => {}; s.spawnTraffic = () => null; s.cars = s.cars.filter(k => k === c || k.parked); s.peds = [P.ped];
    P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true; c.x = x; c.y = y; c.h = h; c.v = 0; }, [x, y, h]);
  await page.waitForTimeout(600);
  await drive(page);
  const file = path.join(ROOT, 'shots', `skid-${name}.png`);
  await page.screenshot({ path: file });
  console.log('wrote', file, JSON.stringify(await page.evaluate(() => { const s = window.__palm.sim; return { segments: s.skid.w, cells: s.skid.cover }; })));
  await page.close();
}
const car = (page, f) => page.waitForFunction(f, null, { timeout: 40000, polling: 'raf' });
await scene('donut', 780, 800, 0, async (page) => {
  // feather the throttle from inside the page each frame, as a thumb would, while the left key holds full lock
  await page.keyboard.down('ArrowLeft');
  await page.evaluate(() => { const I = window.__palm.input; window.__feather = setInterval(() => { I.keys.up = window.__palm.sim.player.car.v < 70; }, 16); });
  await car(page, () => window.__palm.sim.skid.w > 1500);
  await page.evaluate(() => { clearInterval(window.__feather); window.__palm.input.keys.up = false; });
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(900);
});
await scene('drift', 420, 203, 0, async (page) => {
  await page.keyboard.down('ArrowUp');
  await car(page, () => window.__palm.sim.player.car.x > 1088);
  await page.keyboard.down('ArrowRight');
  await car(page, () => { const c = window.__palm.sim.player.car; return Math.abs(c.h) > 1.35; });
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(350);
});
await scene('sand', 1352, 420, Math.PI / 2, async (page) => {
  await page.keyboard.down('ArrowUp');
  await car(page, () => window.__palm.sim.player.car.y > 640);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250); await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(350); await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(200);
});
await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
