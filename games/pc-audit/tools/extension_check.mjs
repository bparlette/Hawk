// extension_check.mjs — WORLD EXTENSION wiring proofs.
// Node (real sim, real physics):
//   * surfaceAt spot checks: mid-bay is water, causeway midpoints are road, the Venetian midpoint
//     between islands is road via its apron, port island / downtown are land, the seam connector
//     reads road inside the core's grass strip;
//   * isDrivable: bay water refuses cars, shell roads/land accept them, core behaviour unchanged;
//   * scripted drives: (1) core -> seam -> the full MacArthur Causeway -> downtown,
//     (2) Port Boulevard end to end, (3) the Venetian Causeway end to end — the car must arrive
//     and its surface must never be water on the way.
// Browser (real page):
//   * the page boots with the shell loaded, in-page surfaces agree, a teleport sweep that paints
//     every chunk in the combined map leaves the ground cache at or under its LRU cap (with
//     evictions recorded), and no console/page errors occur.
// Usage: node tools/extension_check.mjs   (CHROME=/path/to/chrome optional)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { Sim } from '../src/sim.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const sj = JSON.parse(fs.readFileSync(path.join(ROOT, 'shell.json')));
const sl = JSON.parse(fs.readFileSync(path.join(ROOT, 'shell_layout.json')));
const shell = { ...sj, buildings: sl.buildings, palms: sl.palms, extraRoads: sl.roads };
const world = new World(layout, shell);

let fails = 0;
const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
const DT = 1 / 60;
const inp = (o = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, ...o });

// ---------------------------------------------------------------- surfaces
{
  const S = (x, y) => world.surfaceAt(x, y);
  check(S(-1000, 600) === 'water' && S(-1600, 400) === 'water' && S(-1200, 1900) === 'water', 'mid-bay points are water');
  check(S(-1900, 902) === 'road' && S(-2400, 430) === 'road', 'MacArthur Causeway midpoints are road');
  check(S(-1900, 166) === 'road', 'Venetian midpoint between islands is road (painted from the polyline + apron)');
  check(S(-2050, 1180) === 'road', 'Port Boulevard midpoint is road');
  check(S(100, 1275) === 'road' && S(-10, 1275) === 'road' && S(-245, 1275) === 'road', 'the seam connector reads road from the core grass strip to the landfall');
  const port = S(-2000, 1250), dt = S(-3600, 700);
  check(port !== 'water' && port !== 'road' && dt !== 'water' && dt !== 'road', 'port island and downtown are land surfaces', `port=${port} downtown=${dt}`);
  check(!world.isDrivable(-1000, 600) && !world.isDrivable(-1600, 400), 'cars cannot drive on the bay');
  check(world.isDrivable(-1900, 902) && world.isDrivable(-1900, 166) && world.isDrivable(-3600, 700), 'cars can drive the causeways and downtown land');
  check(world.isDrivable(780, 800) && !world.isDrivable(1500, 1000) && world.surfaceAt(1240, 1240) === 'road', 'core surfaces and drivability unchanged');
  check(world.bounds.x0 === -4400 && world.bounds.x1 === 1800, 'world bounds are the union rect', JSON.stringify(world.bounds));
  const bare = new World(layout);
  check(bare.bounds.x0 === 0 && bare.surfaceAt(-100, 1275) !== 'road', 'without the shell the world is exactly the core');
}

// ---------------------------------------------------------------- scripted drives
function freshSim() {
  const s = new Sim(world, M, 7, () => {});
  s.spawnTraffic = () => null; s.spawnPed = () => null;
  s.cars = s.cars.filter(c => c.parked); s.peds = [s.player.ped];
  s.addStars = () => {}; s.stars = 0;
  return s;
}
function putInCar(s, x, y, h) {
  const c = s.cars.find(k => k.parked) || s.cars[0];
  c.x = x; c.y = y; c.h = h; c.v = 0; c.dmg = 0; c.wreck = false;
  c.driver = 'player'; c.parked = false; c.fixed = false;
  s.player.mode = 'car'; s.player.car = c; s.player.ped.hidden = true;
  s.player.ped.x = x; s.player.ped.y = y;
  return c;
}
function driveLeg(name, start, waypoints, budgetS) {
  const s = freshSim();
  const c = putInCar(s, start[0], start[1], start[2]);
  let wi = 0, t = 0, sawWater = false, stuckT = 0, reversing = 0;
  const maxSteps = Math.round(budgetS / DT);
  for (let i = 0; i < maxSteps && wi < waypoints.length; i++) {
    const [tx, ty] = waypoints[wi];
    const d = Math.hypot(tx - c.x, ty - c.y);
    if (d < 75) { wi++; continue; }
    let input;
    if (reversing > 0) { reversing--; input = inp({ jx: -Math.cos(c.h), jy: -Math.sin(c.h), jm: 0.8 }); }
    else {
      const ta = Math.atan2(ty - c.y, tx - c.x);
      input = inp({ jx: Math.cos(ta), jy: Math.sin(ta), jm: 1 });
      if (Math.abs(c.v) < 6) { stuckT += DT; if (stuckT > 2.5) { reversing = 45; stuckT = 0; } } else stuckT = 0;
    }
    s.step(DT, input);
    t += DT;
    if (i % 10 === 0 && world.surfaceAt(c.x, c.y) === 'water') sawWater = true;
  }
  check(wi >= waypoints.length, `${name}: arrived`, `t=${t.toFixed(1)}s end=${Math.round(c.x)},${Math.round(c.y)}`);
  check(!sawWater, `${name}: never on water`);
}
const MAC = sj.roads.find(r => r.name === 'macarthur_causeway').points;
const PORT = sj.roads.find(r => r.name === 'port_boulevard').points;
const VEN = sj.roads.find(r => r.name === 'venetian_causeway').points;
driveLeg('drive core -> seam -> MacArthur -> downtown', [360, 1275, Math.PI],
  [[100, 1275], ...MAC.slice(0, -1).reverse().map(p => [p[0], p[1]])], 90);
driveLeg('drive Port Boulevard end to end', [PORT[PORT.length - 1][0], PORT[PORT.length - 1][1], Math.PI],
  PORT.slice(0, -1).reverse().map(p => [p[0], p[1]]), 75);
driveLeg('drive the Venetian Causeway end to end', [VEN[VEN.length - 1][0], VEN[VEN.length - 1][1], Math.PI],
  VEN.slice(0, -1).reverse().map(p => [p[0], p[1]]), 75);

// ---------------------------------------------------------------- browser: cache bound + no errors
{
  const { chromium } = await import('playwright-core');
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(b); } });
  });
  await new Promise(r => server.listen(0, r));
  const PORTN = server.address().port;
  const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
  await page.goto(`http://localhost:${PORTN}/index.html?nostart`);
  await page.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 60000 });
  const inPage = await page.evaluate(() => {
    const W = window.__palm.world;
    return { x0: W.bounds.x0, bay: W.surfaceAt(-1000, 600), mac: W.surfaceAt(-1900, 902), ven: W.surfaceAt(-1900, 166), seam: W.surfaceAt(100, 1275) };
  });
  check(inPage.x0 === -4400 && inPage.bay === 'water' && inPage.mac === 'road' && inPage.ven === 'road' && inPage.seam === 'road',
    'in-page: shell loaded, surfaces agree', JSON.stringify(inPage));
  const sweep = await page.evaluate(() => {
    const G = window.__palm.ground;
    let painted = 0;
    for (let cy = G.cy0; cy < G.cy1; cy++) for (let cx = G.cx0; cx < G.cx1; cx++) { G.get(cx, cy); painted++; }
    return { painted, size: G.cache.size, evicted: G.stats.evicted, chunks: G.cols * G.rows };
  });
  check(sweep.painted === sweep.chunks, 'teleport sweep painted every chunk in the combined map', `${sweep.painted}/${sweep.chunks}`);
  check(sweep.size <= 64 && sweep.evicted > 0, 'ground cache stays bounded under the sweep (LRU eviction works)', `size=${sweep.size} evicted=${sweep.evicted}`);
  check(errors.length === 0, 'no console or page errors', errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
}

console.log(fails ? `EXTENSION FAIL (${fails})` : 'EXTENSION OK');
process.exit(fails ? 1 : 0);
