// feel_shots.mjs — staged phone-size captures of the feel-pass items, in the real page.
// Each scene is set up through window.__palm (the live sim), then driven by the real input path.
// Usage: CHROME=/path/to/chrome node tools/feel_shots.mjs [scene ...]     -> shots/feel-after-<scene>.png
//   scenes: pier, bump, punch
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const want = process.argv.slice(2);
const errors = [];
async function scene(name, setup, drive) {
  if (want.length && !want.includes(name)) return;
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(name + ': ' + e));
  await page.goto(`http://localhost:${server.address().port}/index.html?t=0.2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(6000);                       // let the title card fade
  await page.evaluate(setup);
  await page.waitForTimeout(1200);                       // camera settles
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });
  await drive(page, touch);
  const file = path.join(ROOT, 'shots', `feel-after-${name}.png`);
  await page.screenshot({ path: file });
  console.log('wrote', file, JSON.stringify(await page.evaluate(() => { const s = window.__palm.sim, p = s.player.ped; return { mode: s.player.mode, x: Math.round(p.x), y: Math.round(p.y), stars: s.stars }; })));
  await page.close();
}
const stickHold = async (page, touch, dx, dy, ms) => { await touch('touchStart', [[100, 640, 1]]); await touch('touchMove', [[100 + dx, 640 + dy, 1]]); await page.waitForTimeout(ms); };

// the pier: thumb right, walk out to the very end
await scene('pier', () => { const s = window.__palm.sim, P = window.__palm.world.L.pier; s.player.ped.x = P.x + P.w - 150; s.player.ped.y = P.y + P.h / 2; },
  async (page, touch) => { await stickHold(page, touch, 50, 0, 4500); await touch('touchEnd', []); await page.waitForTimeout(600); });
// bump: run into a palm, with a pedestrian in the way just before it
await scene('bump', () => { const s = window.__palm.sim; s.player.ped.x = 1290; s.player.ped.y = 925;
    const o = s.makePed(1282, 904, 'ped_rose', { type: 'line', x: 1282, y: 904, dir: 1 }, 0); s.peds.push(o); },
  async (page, touch) => { await stickHold(page, touch, 0, -50, 780); });
// punch: tap the fight button next to a pedestrian
await scene('punch', () => { const s = window.__palm.sim; s.player.ped.x = 1250; s.player.ped.y = 1240; s.player.ped.h = 0;
    const o = s.makePed(1264, 1240, 'ped_blue', { type: 'line', x: 1264, y: 1240, dir: 1 }, 0); s.peds.push(o); },
  async (page, touch) => { const b = await page.evaluate(() => ({ x: 420 - 158, y: innerHeight - 74 })); await touch('touchStart', [[b.x, b.y, 2]]); await page.waitForFunction(() => window.__palm.sim.fx.length > 0, null, { timeout: 5000 }); });
await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
