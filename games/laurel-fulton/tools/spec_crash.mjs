// spec_crash.mjs — Nov 18 friend-review fixes, spec-style:
//   1. ANTI-STUCK: hold the stick into a house wall -> the car is recovered to the road.
//   2. GET IN ANY CAR: take Jimmy's parked Astro on foot; it becomes your car.
//   3. GUARDRAILS: a motorway run-off is caught by the rail and slides, never crosses.
//   4. BUSHES: driving through one squashes it, drags the car, never wedges it.
//   5. GET IN at the nose/tail of your own car (body distance, not centre distance).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { GraphWorld } = await import(path.join(ROOT, 'src/world_graph.js'));
const { LFSim } = await import(path.join(ROOT, 'src/lf_sim.js'));
const { startRally, swapPlayerCar } = await import(path.join(ROOT, 'src/lf_mission.js'));
const { createFoot, exitCar, nearCar, nearAnyCar } = await import(path.join(ROOT, 'src/lf_foot.js'));
const { bushesNear } = await import(path.join(ROOT, 'src/lf_veg.js'));
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const AREAS = J('data/areas.json');
const W = new GraphWorld(J('data/graph.json')), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json'), BUMPS = J('data/bumps.json').bumps;
const DT = 1 / 60;
let fails = 0; const check = (ok, label, extra = '') => { console.log((ok ? 'PASS' : 'FAIL'), label, extra); if (!ok) fails++; };
const run = (S, inp, secs) => { for (let i = 0; i < secs * 60; i++) S.step(DT, inp); };
const riggSim = () => { const S = new LFSim(W, ROSTER, FLEET, { spawn: { x: 3463, y: 2666 }, bumps: BUMPS, buildings: AREAS.buildings, greens: AREAS.green }); const M = startRally(S, ROSTER, 'rigg'); return { S, M }; };
const centroid = (f) => { let cx = 0, cy = 0; for (let k = 0; k < f.length; k += 2) { cx += f[k]; cy += f[k + 1]; } return [cx / (f.length / 2), cy / (f.length / 2)]; };

// 1 — anti-stuck against Rigg's own house, stick held into the wall the whole time
{
  const { S } = riggSim(), car = S.player;
  const H = S.houses.map(f => centroid(f)).sort((a, b) => Math.hypot(a[0] - 3463, a[1] - 2666) - Math.hypot(b[0] - 3463, b[1] - 2666))[0];
  const a = Math.atan2(H[1] - car.y, H[0] - car.x);
  const toward = { jx: Math.cos(a), jy: Math.sin(a), jm: 1, keys: {}, action: false, punch: false, turbo: false };
  let recoveredAt = null;
  for (let i = 0; i < 6 * 60 && !recoveredAt; i++) { S.step(DT, toward); if (S.events.some(e => e.kind === 'unstuck')) recoveredAt = { x: car.x, y: car.y, surf: S.W.surfaceAt(car.x, car.y, 0), d: S.W.roadInfo(car.x, car.y, 0).d }; }
  check(!!recoveredAt, 'anti-stuck fired while grinding the wall');
  check(recoveredAt && (recoveredAt.surf === 'road' || recoveredAt.d < 40), 'the recovery puts the car back at the road', recoveredAt ? `surf=${recoveredAt.surf} roadDist=${recoveredAt.d.toFixed(0)}` : 'none');
}
// 2 — GET IN any car: Jimmy's Astro, parked at his house
{
  const { S, M } = riggSim();
  const astro = S.cars.find(c => c.owner === 'jimmy');
  const F = createFoot(ROSTER.people.find(p => p.id === 'rigg'));
  F.x = astro.x + 14; F.y = astro.y; F.z = 0;
  const nc = nearAnyCar(F, S.cars);
  check(nc === astro, 'nearAnyCar finds the Astro beside it', nc ? nc.owner : 'none');
  swapPlayerCar(S, M, astro);
  check(S.player === astro && astro.parked === false, 'the Astro is your car now');
  const celica = S.cars.find(c => c.owner === 'rigg');
  check(celica.parked === true, 'your Celica parks where you left it');
}
// 3 — guardrail catches a motorway run-off
{
  const e = W.edges.find(e => e.hw === 'motorway' && e.pts.length > 4);
  const { S } = riggSim(), car = S.player;
  const mid = e.pts[Math.floor(e.pts.length / 2)], nxt = e.pts[Math.floor(e.pts.length / 2) + 1];
  const dx = nxt[0] - mid[0], dy = nxt[1] - mid[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;   // left normal
  car.x = mid[0]; car.y = mid[1]; car.h = Math.atan2(ny, nx); car.dirx = nx; car.diry = ny; car.v = 0; car.parked = false;
  const off = { jx: nx, jy: ny, jm: 1, keys: {}, action: false, punch: false, turbo: true };
  let maxOut = 0;
  for (let i = 0; i < 5 * 60; i++) { S.step(DT, off); maxOut = Math.max(maxOut, (car.x - mid[0]) * nx + (car.y - mid[1]) * ny); }
  const railLine = e.w / 2 + 7, R = (car.len + car.wid) / 4;
  check(maxOut < railLine + R + 26, 'the rail caught the run-off (car never crossed the line)', `maxOut=${maxOut.toFixed(0)} rail at ${railLine.toFixed(0)}+R${R.toFixed(0)}`);
  check(S.events.some(ev => ev.kind === 'rail'), 'a rail scrape event fired');
}
// 4 — bushes: find one near Rigg's, drive through it
{
  const { S } = riggSim(), car = S.player;
  const near = (x, y) => S.nearBuilding(x, y);
  let bush = null;
  for (let r = 200; r < 1600 && !bush; r += 200) { const found = bushesNear(3463, 2666, r, W, near, AREAS.green, []); if (found.length) bush = found[0]; }
  check(!!bush, 'a bush exists near Rigg\'s house', bush ? `${bush.x.toFixed(0)},${bush.y.toFixed(0)} r=${bush.r.toFixed(0)}` : 'none');
  if (bush) {
    // approach along a lane that stays clear of houses (a lane clipping a house
    // footprint gets shoved sideways by houseCollide before it ever reaches the bush)
    let lane = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const probe = { x: bush.x + dx * 170, y: bush.y + dy * 170, len: 44, wid: 18 };
      const mid = { x: bush.x + dx * 85, y: bush.y + dy * 85, len: 44, wid: 18 };
      if (!S.touchingHouse(probe) && !S.touchingHouse(mid)) { lane = [dx, dy]; break; }
    }
    check(!!lane, 'found a house-clear approach lane to the bush');
    if (lane) {
      const [dx, dy] = lane;
      car.x = bush.x + dx * 170; car.y = bush.y + dy * 170; car.h = Math.atan2(-dy, -dx); car.dirx = -dx; car.diry = -dy; car.v = 0;
      run(S, { jx: -dx, jy: -dy, jm: 1, keys: {}, action: false, punch: false, turbo: false }, 4);
      check(S.squashed.has(bush.id), 'the bush squashed as the car went through');
      const past = (bush.x - car.x) * dx + (bush.y - car.y) * dy;
      check(past > 20, 'the car came out the other side (never wedged)', `past=${past.toFixed(0)}`);
    }
  }
}
// 5 — GET IN at the nose of your own car
{
  const { S } = riggSim(), car = S.player;
  const F = createFoot(ROSTER.people.find(p => p.id === 'rigg'));
  F.x = car.x + Math.cos(car.h) * (car.len / 2 + 8); F.y = car.y + Math.sin(car.h) * (car.len / 2 + 8); F.z = 0;
  check(nearCar(F, car), 'GET IN works standing at the nose', `centre dist=${Math.hypot(F.x - car.x, F.y - car.y).toFixed(0)} len=${car.len.toFixed(0)}`);
}
console.log(fails ? `SPEC-CRASH FAIL (${fails})` : 'SPEC-CRASH OK');
process.exit(fails ? 1 : 0);
