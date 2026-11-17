// openroad2_shots.mjs — phone-size (420x860) captures of OPEN ROAD v2's chase camera:
//   1. the causeway straight — water both sides, sky band + horizon, car low-centre
//   2. a crest — the road falling away beyond it (elevation profile staged at its steepest drop)
//   3. a sweeping downtown turn — palms streaming past, tire smoke at the rear wheels
//   4. the finish — crowd celebration + the result card
// Each shot boots the real page, starts the event the real way (the debug jump arms the
// site, the A button starts it), then stages the car on the route (coordinates computed
// here from src/openroad.js) and lets the chase cam blend/settle before capturing.
// Fails (exit 1) on any page error.
// Usage: node tools/openroad2_shots.mjs   (CHROME=/path/to/chrome optional)
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { route, routeAt } from '../src/openroad.js';
import { elevAt } from '../src/chasecam.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(b); } });
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'] });

const R = route();
// the crest: the route s whose road 320 units ahead sits lowest relative to here
let crestS = 600, crestDrop = 1e9;
for (let s = 400; s < R.len - 520; s += 10) { const d = elevAt(s + 320) - elevAt(s); if (d < crestDrop) { crestDrop = d; crestS = s; } }
// the turn: the downtown s with the sharpest heading change over the next 120 units
let turnS = 3400, turnBend = 0;
for (let s = 3200; s < R.len - 300; s += 10) {
  const a = routeAt(R, s, 0), b = routeAt(R, s + 120, 0);
  const d = Math.abs(Math.atan2(b.ty, b.tx) - Math.atan2(a.ty, a.tx));
  if (d > turnBend) { turnBend = d; turnS = s; }
}
console.log(`staging: crest at s=${crestS} (drop ${crestDrop.toFixed(1)}), turn at s=${turnS} (bend ${(turnBend * 57.3).toFixed(0)} deg)`);

const errors = [];
async function startRun() {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/index.html?nostart&t=0.3`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 60000 });
  await page.evaluate(() => { const s = window.__palm.sim; s.step(1 / 60, { jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, jump: 'openroad' }); });
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__palm.sim.event && window.__palm.sim.event.kind === 'openroad', null, { timeout: 30000 });
  await page.waitForFunction(() => window.__palm.sim.event.count === 0, null, { timeout: 90000 });   // the 3-count runs on sim time; a loaded VM ticks slowly
  return page;
}
// place the player car on the route at s with speed v, the chase rotation pre-settled,
// the clock topped up so staging never times out, then let the blend finish
async function stage(page, s, v, extra = {}) {
  const q = routeAt(R, s, 0), h = Math.atan2(q.ty, q.tx);
  await page.evaluate(([x, y, hh, vv, ss, ex]) => {
    const sim = window.__palm.sim, c = sim.player.car, ev = sim.event;
    c.x = x; c.y = y; c.h = hh; c.v = vv; c.dmg = 0; c.wreck = false;
    ev.routeS = ss; ev.timer = 99;
    if (ex.idx !== undefined) ev.idx = ex.idx;
    if (sim.chase) sim.chase.rot = -Math.PI / 2 - hh;
  }, [q.x, q.y, h, v, s, extra]);
  await page.waitForFunction(() => window.__palm.sim.chase && window.__palm.sim.chase.blend > 0.9, null, { timeout: 20000 });
  await page.waitForTimeout(350);
}
fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
async function shot(name, page) {
  await page.screenshot({ path: path.join(ROOT, 'shots', name) });
  console.log('wrote shots/' + name);
  await page.close();
}

// 1 — the causeway straight, mid-bay
{
  const page = await startRun();
  await stage(page, 1500, 245);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(700);
  await shot('openroad2-causeway.png', page);
  await page.keyboard.up('ArrowUp').catch(() => {});
}
// 2 — the crest, road falling away
{
  const page = await startRun();
  await stage(page, crestS, 245);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(500);
  await shot('openroad2-crest.png', page);
  await page.keyboard.up('ArrowUp').catch(() => {});
}
// 3 — the downtown turn, hard steer for the screech smoke
{
  const page = await startRun();
  await stage(page, turnS - 60, 250);
  const a = routeAt(R, turnS, 0), b = routeAt(R, turnS + 120, 0);
  const left = (Math.atan2(b.ty, b.tx) - Math.atan2(a.ty, a.tx)) < 0;
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down(left ? 'ArrowLeft' : 'ArrowRight');
  await page.waitForTimeout(1150);
  await shot('openroad2-turn.png', page);
  await page.keyboard.up('ArrowUp').catch(() => {});
  await page.keyboard.up(left ? 'ArrowLeft' : 'ArrowRight').catch(() => {});
}
// 4 — the finish: staged one checkpoint short, driven over the line into the crowd
{
  const page = await startRun();
  await stage(page, R.len - 210, 250, { idx: 5 });
  await page.keyboard.down('ArrowUp');
  try { await page.waitForFunction(() => !!window.__palm.sim.eventResult, null, { timeout: 15000 }); } catch (_) {}
  await page.waitForTimeout(500);
  await shot('openroad2-finish.png', page);
  await page.keyboard.up('ArrowUp').catch(() => {});
}
await browser.close();
server.close();
if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 4).join(' | ')); process.exit(1); }
console.log('OPENROAD2 SHOTS OK');
