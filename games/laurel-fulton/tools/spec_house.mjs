// spec_house.mjs — houses are SOLID (owner, Nov 17 2026: "houses have to drive
// around. You bounce off them"). Drives the player's car straight at Brad's
// house and proves: (1) a house contact event fires, (2) the car never ends a
// step inside the footprint, (3) the bounce turns the car and scrubs speed.
//   node tools/spec_house.mjs     exit 0 = green
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/graph.json'))), ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/roster.json')));
const FLEET = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/fleet.json')));
const AREAS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/areas.json')));
const BUMPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/bumps.json'))).bumps;
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js');
const W = new GraphWorld(G), DT = 1 / 60;

const hero = AREAS.heroes.find(h => h.who === 'Brad');
const f = AREAS.buildings[hero.b];
let cx = 0, cy = 0; for (let k = 0; k < f.length; k += 2) { cx += f[k]; cy += f[k + 1]; } cx /= f.length / 2; cy /= f.length / 2;

function insideAndDist(x, y) {           // [inside, distance to boundary]
  let best = 1e18, inside = false;
  for (let k = 0; k < f.length; k += 2) {
    const ax = f[k], ay = f[k + 1], ex = f[(k + 2) % f.length], ey = f[(k + 3) % f.length];
    const vx = ex - ax, vy = ey - ay, L2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L2)), px = ax + vx * t, py = ay + vy * t;
    best = Math.min(best, Math.hypot(px - x, py - y));
    if ((ay > y) !== (ey > y) && x < (ex - ax) * (y - ay) / (ey - ay) + ax) inside = !inside;
  }
  return [inside, best];
}

const S = new LFSim(W, ROSTER, FLEET, { spawn: { x: 0, y: 0 }, bumps: BUMPS, buildings: AREAS.buildings });
const c = S.player, r = W.roadInfo(cx, cy, 0), rp = S.nearPt(cx, cy, r);
c.x = rp.x; c.y = rp.y; c.v = 0;
c.h = Math.atan2(cy - c.y, cx - c.x); c.dirx = Math.cos(c.h); c.diry = Math.sin(c.h);
const R = (c.len + c.wid) / 4;
let endedInside = 0, minClear = 1e9, vBefore = 0, turned = 0, hPrev = c.h;
for (let i = 0; i < 900; i++) {
  S.step(DT, { keys: { up: true } });
  const [inside, d] = insideAndDist(c.x, c.y);
  if (inside) endedInside++;
  minClear = Math.min(minClear, inside ? -d : d);
  const ev = S.events.filter(e => e.kind === 'house');
  if (ev.length && !vBefore) vBefore = ev[ev.length - 1].v;
  turned = Math.max(turned, Math.abs(Math.atan2(Math.sin(c.h - hPrev), Math.cos(c.h - hPrev)))); hPrev = c.h;
  if (ev.length && i > 60) break;
}
const hits = S.events.filter(e => e.kind === 'house');
check(hits.length >= 1, 'driving at a house produces a bounce (house event)', `${hits.length} hits, impact v=${vBefore && vBefore.toFixed(0)} u/s`);
check(endedInside === 0, 'the car never ends a step inside the footprint', `min clearance ${minClear.toFixed(1)} u (car R ${R.toFixed(1)})`);
check(turned > 0.3 || (hits.length && Math.abs(c.v) < vBefore * 0.8), 'the bounce turns the car / scrubs its speed', `max heading change ${turned.toFixed(2)} rad, v now ${Math.abs(c.v).toFixed(0)}`);
console.log(fails ? `SPEC HOUSE FAILED (${fails})` : 'SPEC HOUSE OK');
process.exit(fails ? 1 : 0);
