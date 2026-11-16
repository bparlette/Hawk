// map_check.mjs — the city map's rules. Part 1 (Node, the map's own functions on the real sim):
// every POI is present and lands inside the map frame on a 420x860 phone; the player marker tracks a
// scripted move (walked through the real input object). Part 2 (real page, needs CHROME): a real
// TOUCH on the MAP button opens it, the game keeps running under it (LIVE), the marker follows a
// keyboard walk, a second touch closes it; captures at spawn and at the motel door.
// Usage: CHROME=/path/to/chrome node tools/map_check.mjs   -> shots/map-{spawn,motel}.png
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { Sim } from '../src/sim.js';
import { mapFrame, mapPOIs, playerMarker, toMap } from '../src/map.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const sim = new Sim(world, M, 7, () => {});
const F = mapFrame(420, 860, world);
check(F.x >= 8 && F.y >= 90 && F.y + F.h <= 860 - 140 && F.x + F.w <= 412, 'the map fits the phone between the HUD and the controls', `${Math.round(F.w)}x${Math.round(F.h)} at ${Math.round(F.x)},${Math.round(F.y)}`);
const pois = mapPOIs(world, sim), names = pois.map(p => p.name);
for (const n of ['MOTEL', 'NOVA', 'GARAGE', 'DINER', 'TACOS', 'SOLANA', 'PIER', 'BEACH', 'TAXI', 'TOW', 'BUS', 'GETAWAY']) check(names.includes(n), `POI ${n} is on the map`);
const motel = pois.find(p => p.name === 'MOTEL');
check(motel.p[0] === layout.motelDoor[0] && motel.p[1] === layout.motelDoor[1] && motel.kind === 'door', 'MOTEL marks the door (the siege entrance)', motel.p.join(','));
check(pois.every(p => { const [x, y] = toMap(F, p.p[0], p.p[1]); return x >= F.x && x <= F.x + F.w && y >= F.y && y <= F.y + F.h; }), 'every POI lands inside the map');
{ // labels don't sit on top of each other (centres at least 12 px apart)
  let worst = 1e9, pair = '';
  const pl = pois.filter(p => p.kind !== 'job');
  for (let i = 0; i < pl.length; i++) for (let j = i + 1; j < pl.length; j++) { const a = toMap(F, ...pl[i].p), b = toMap(F, ...pl[j].p), d = Math.hypot(a[0] - b[0], (a[1] - b[1]) * 2.2); if (d < worst) { worst = d; pair = pl[i].name + '/' + pl[j].name; } }
  check(worst > 24, 'place labels are spaced to be readable', `closest ${pair} ${worst.toFixed(0)}`);
}
const m0 = playerMarker(F, sim), p0 = { x: sim.player.ped.x, y: sim.player.ped.y };
for (let i = 0; i < 180; i++) sim.step(1 / 60, { jx: -1, jy: 0, jm: 1, keys: {} });          // walk west 3 s
const m1 = playerMarker(F, sim), moved = sim.player.ped.x - p0.x;
check(moved < -100 && Math.abs((m1.x - m0.x) - moved * F.k) < 0.01 && Math.abs(Math.abs(m1.h) - Math.PI) < 0.01, 'the player marker tracks a scripted walk (position and facing)', `world ${moved.toFixed(0)} → map ${(m1.x - m0.x).toFixed(1)} px`);

// ---- part 2: the real page
const CHROME = process.env.CHROME;
if (!CHROME || !fs.existsSync(CHROME)) { console.log('SKIP page checks (set CHROME)'); }
else {
  const { chromium } = await import('playwright-core');
  const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
  const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://localhost:${server.address().port}/index.html?t=0.25&dpr=2`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim);
  await page.waitForTimeout(5000);
  const cdp = await page.context().newCDPSession(page);
  const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 5 }] }); await page.waitForTimeout(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(250); };
  const btn = await page.evaluate(() => { const m = window.__palm.input.mapBtn(), r = document.querySelector('canvas').getBoundingClientRect(), k = r.width / 420; return { x: r.left + (m.x + m.w / 2) * k, y: r.top + (m.y + m.h / 2) * k }; });
  await tap(btn.x, btn.y);
  check(await page.evaluate(() => window.__palm.input.mapOpen), 'a touch on the MAP button opens the map');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ROOT, 'shots', 'map-spawn.png') });
  const a = await page.evaluate(() => ({ t: window.__palm.sim.time, x: window.__palm.sim.player.ped.x }));
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowLeft');
  const b = await page.evaluate(() => ({ t: window.__palm.sim.time, x: window.__palm.sim.player.ped.x, open: window.__palm.input.mapOpen }));
  check(b.open && b.t > a.t + 0.5 && b.x < a.x - 20, 'the map is LIVE: the game runs and you can walk with it open', `x ${a.x.toFixed(0)} → ${b.x.toFixed(0)}`);
  await tap(btn.x, btn.y);
  check(!(await page.evaluate(() => window.__palm.input.mapOpen)), 'a second touch closes it');
  await page.evaluate(() => { const s = window.__palm.sim, d = s.W.L.motelDoor; s.player.ped.x = d[0]; s.player.ped.y = d[1] - 4; s.player.ped.h = Math.PI / 2; });
  await tap(btn.x, btn.y); await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ROOT, 'shots', 'map-motel.png') });
  check(errors.length === 0, 'no page errors', errors.join(' | '));
  await browser.close(); server.close();
}
console.log(fails ? `MAP FAIL (${fails})` : 'MAP OK');
process.exit(fails ? 1 : 0);
