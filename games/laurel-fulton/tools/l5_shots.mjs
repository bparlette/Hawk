// l5_shots.mjs — task L5 evidence on the REAL page, phone size (420x860 @2x): the rally is flown by the stick-only
// autopilot (play.html?pilot) to THE CREW IS ASSEMBLED, then the autopilot hands back and EVERYTHING after that is the
// real keyboard (arrows = the stick's 8 directions, Space = ACTION): get out, walk the worn path, mantle the dumpster,
// the HVAC box, grab the parapet, the lookout, and a leap off the edge.
//   CHROME=<chromium> node tools/l5_shots.mjs [player]      (from games/laurel-fulton/)   -> shots/l5-*.png
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), GAMES = path.resolve(ROOT, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((q, r) => { const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
await new Promise(r => server.listen(0, r));
const WHO = process.argv[2] || 'brad', RJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/roof.json')));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(`http://localhost:${server.address().port}/laurel-fulton/play.html?pilot&player=${WHO}&speed=16`);
await p.waitForFunction(() => window.__lf && window.__lf.mission(), null, { timeout: 120000 });
await p.waitForFunction(() => window.__lf.mission().complete, null, { timeout: 1200000, polling: 250 });
await p.evaluate(() => window.__lf.setSpeed(1)); await p.waitForTimeout(1500);
const st = () => p.evaluate(() => { const F = window.__lf.foot(); return { x: F.x, y: F.y, z: F.z || 0, active: F.active, climb: F.climb ? F.climb.kind : null, air: !!F.air, pilot: !!window.__lf.pilot(), zoom: +window.__lf.cam.zoom.toFixed(2) }; });
const shot = async (n, note) => { await p.screenshot({ path: path.join(ROOT, `shots/l5-${n}.png`) }); console.log(n, note, JSON.stringify(await st())); };
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
const press = async (dx, dy) => {                           // the stick, as arrow keys (8 directions)
  const a = Math.atan2(dy, dx), want = { ArrowRight: Math.cos(a) > 0.38, ArrowLeft: Math.cos(a) < -0.38, ArrowDown: Math.sin(a) > 0.38, ArrowUp: Math.sin(a) < -0.38 };
  if (!dx && !dy) for (const k in want) want[k] = false;
  for (const k in keys) if (keys[k] !== want[k]) { keys[k] = want[k]; await (want[k] ? p.keyboard.down(k) : p.keyboard.up(k)); }
};
await p.keyboard.press('Space'); await p.waitForTimeout(400);       // ACTION: GET OUT
console.log('out of the car:', JSON.stringify(await st()), 'autopilot handed back:', !(await st()).pilot);
const C = RJ.chains[0], [h1, h2] = C.holds, W0 = C.wall, H = RJ.h;
const route = [...RJ.path, [h1.x, h1.y]];
let s = await st(), ri = 0, shots = new Set();
const t0 = Date.now();
while (Date.now() - t0 < 60000) {
  s = await st();
  if (s.climb) { await press(0, 0); if (s.climb === 'grab' && s.z > 45 && !shots.has(2)) { shots.add(2); await shot('2-mid-chain-grab', 'hanging off the parapet, pulling over'); } continue; }
  if (s.z >= H && !s.air) break;
  if (s.z === h2.top) { if (!shots.has('hv')) { shots.add('hv'); await press(0, 0); await shot('2a-on-the-hvac', 'on the HVAC box, the wall above'); } await press(-W0.nx, -W0.ny); continue; }
  if (s.z === h1.top) { await press(h2.x - s.x, h2.y - s.y); continue; }
  const [tx, ty] = route[Math.min(ri, route.length - 1)];
  if (Math.hypot(tx - s.x, ty - s.y) < 12 && ri < route.length - 1) ri++;
  if (ri === route.length - 1 && Math.hypot(h1.x - s.x, h1.y - s.y) < 26 && !shots.has(1)) { shots.add(1); await press(0, 0); await p.waitForTimeout(300); await shot('1-bottom', 'at the dumpster, the CLIMB plaque, the worn path'); }
  await press(tx - s.x, ty - s.y);
}
await press(0, 0); await p.waitForTimeout(300);
await shot('3-roof', 'just over the parapet');
await p.waitForTimeout(2600);
await shot('4-lookout', 'the closing shot: the lookout over the lot');
console.log('lookout:', JSON.stringify(await p.evaluate(() => ({ cam: { x: Math.round(window.__lf.cam.x), y: Math.round(window.__lf.cam.y), zoom: +window.__lf.cam.zoom.toFixed(2) }, msg: window.__lf.mission().msg, convoy: window.__lf.mission().convoy.length }))));
await p.evaluate(() => window.__lf.setSpeed(0.15));              // slow-mo for the 0.6 s of air, so the capture lands mid-leap
await press(W0.nx, W0.ny);                                   // run off the edge
await p.waitForFunction((h) => { const F = window.__lf.foot(); return F.air && F.z < h - 25; }, H, { timeout: 15000, polling: 8 });
await shot('5-leap', 'off the edge, mid-air');
await p.waitForFunction(() => { const F = window.__lf.foot(); return !F.air && F.z === 0; }, null, { timeout: 15000, polling: 8 });
await press(0, 0); await p.evaluate(() => window.__lf.setSpeed(1)); await p.waitForTimeout(150);
await shot('6-landed', 'rolled out, on the lot');
console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close(); server.close();
