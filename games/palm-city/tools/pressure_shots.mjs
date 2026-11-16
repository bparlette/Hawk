// pressure_shots.mjs — phone-size captures of Sky + Street Pressure in the real page.
// Usage: CHROME=/path/to/chrome node tools/pressure_shots.mjs <before|after> [scene ...]
//   -> shots/pressure-<before|after>-<scene>.png
//   scenes: chopper-golden, chopper-dusk (on foot, wanted, waiting for the searchlight to find you)
// 'before' is meant to be run from a checkout of main before the pressure pass (same staging).
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT || path.join(ROOT, 'shots');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const prefix = process.argv[2] || 'after', want = process.argv.slice(3);
const errors = [];
async function scene(name, tod, x, y, drive) {
  if (want.length && !want.includes(name)) return;
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(name + ': ' + e));
  await page.goto(`http://localhost:${server.address().port}/index.html?t=${tod}&dpr=2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(5000);
  // staging: wanted at 3 stars on foot here; squad cars held off so the shot is the sky pressure
  await page.evaluate(([x, y]) => { const s = window.__palm.sim, p = s.player.ped; p.x = x; p.y = y; s.stars = 3; s.addStars = () => {}; s.lostT = -1e9;
    const add = s.addCar.bind(s); s.addCar = (...a) => a[4] === 'police' ? { v: 0 } : add(...a); }, [x, y]);
  await drive(page);
  const file = path.join(OUT, `pressure-${prefix}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('wrote', file, JSON.stringify(await page.evaluate(() => { const s = window.__palm.sim, c = s.chopper; return { stars: s.stars, chopper: !!c, lock: c ? c.lock : null }; })));
  await page.close();
}
const waitLock = async (page) => {
  try { await page.waitForFunction(() => { const c = window.__palm.sim.chopper; return c && c.lock && c.lockT > 0.6; }, null, { timeout: 40000, polling: 'raf' }); }
  catch (e) { await page.waitForTimeout(8000); }     // (before the pass there is no chopper: same wait)
};
await scene('chopper-golden', 0.25, 1035, 1275, waitLock);
await scene('chopper-dusk', 0.9, 1035, 1275, waitLock);
await browser.close(); server.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
