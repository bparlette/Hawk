// spec_l5.mjs — TEST-FIRST spec for task L5, CLIMB THE ATHOLTON ROOF (written before src/lf_climb.js; red until built).
//   node tools/spec_l5.mjs [player]      (from games/laurel-fulton/)  exit 0 = green.  default player: brad
// Every move on foot goes through the STICK ({jx, jy, jm}: what the touch joystick / arrow keys produce) into Palm City's
// stepFoot via lf_climb.stepOnFoot — the same call main.js makes each frame. It proves:
//  1 the building is REAL: data/roof.json is Atholton's OSM multipolygon (2 storeys, 3 courtyards), and the hero tier
//    now draws that outline instead of the 172 m2 shed it had
//  2 the way up is a CHAIN, in order: ground -> dumpster -> HVAC box -> ledge grab -> roof. Skipping a hold fails: the
//    wall can't be climbed from the ground, the HVAC can't be reached from the ground, the roof can't from the dumpster
//  3 on top the whole footprint is walkable: from 400 random roof points, a push in any of 16 directions always moves
//    you unless a VISIBLE solid (an AC unit) is right there — no invisible walls; AC units themselves can be climbed
//  4 the way down: run off any edge -> airborne on the speed-bump vocabulary (lf_sim BUMP vz0/g), land, roll, keep going:
//    control back in <= 0.4 s, no damage
//  5 courtyards are never traps: drop into each one, climb back out by its own chain
//  6 the closing shot: run the real rally (lf_pilot, stick only) to THE CREW IS ASSEMBLED, get out, walk to the chain,
//    climb, and the lookout camera frames you + Lamar's burning Mustang + the whole parked convoy
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = process.env.LF_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f)));
const G = J('data/graph.json'), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json'), AREAS = J('data/areas.json'), BUMPS = J('data/bumps.json').bumps;
const RJ = fs.existsSync(path.join(ROOT, 'data/roof.json')) ? J('data/roof.json') : null;
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim, BUMP } = await import('../src/lf_sim.js');
const MI = await import('../src/lf_mission.js'); const { Pilot } = await import('../src/lf_pilot.js'); const FT = await import('../src/lf_foot.js');
let CL = null; try { CL = await import('../src/lf_climb.js'); } catch (e) { check(false, 'src/lf_climb.js loads', String(e).slice(0, 160)); }
const area = (f) => { let s = 0; for (let i = 0; i < f.length; i += 2) { const j = (i + 2) % f.length; s += f[i] * f[j + 1] - f[j] * f[i + 1]; } return Math.abs(s) / 2 / 100; };
// 1 the real building
check(!!RJ && RJ.osm === 'relation/1988823' && RJ.levels === 2 && RJ.inner.length === 3, 'roof.json = Atholton HS, OSM relation 1988823, 2 storeys, 3 courtyards', RJ ? `${RJ.osm} ${RJ.levels} lv, ${RJ.inner.length} courtyards, roof ${RJ.h / 10} m, ${RJ.area_m2} m2` : 'missing');
const hero = AREAS.heroes.find(h => h.who === ROSTER.meetup.name);
check(hero && area(AREAS.buildings[hero.b]) > 15000, 'the hero tier draws the REAL Atholton outline (not the shed)', hero ? `${Math.round(area(AREAS.buildings[hero.b]))} m2` : '');
if (CL && RJ) {
  const DT = 1 / 60, RF = new CL.Roof(RJ), H = RJ.h;
  const F = FT.createFoot(ROSTER.people.find(p => p.id === 'brad') || ROSTER.people[0]); F.active = true;
  const place = (x, y, z = 0) => { F.x = x; F.y = y; F.z = z; F.vz = 0; F.air = false; F.climb = null; F.land = 0; F.punchT = 0; };
  const stick = (dx, dy) => { const L = Math.hypot(dx, dy) || 1; return { jx: dx / L, jy: dy / L, jm: 1, keys: {} }; };
  const run = (inp, secs, until) => { for (let t = 0; t < secs; t += DT) { CL.stepOnFoot(F, DT, typeof inp === 'function' ? inp() : inp, RF); if (until && until()) return true; } return false; };
  const C = RJ.chains[0], [h1, h2] = C.holds, W0 = C.wall;
  // 2 the chain
  place(RJ.path[0][0], RJ.path[0][1]);
  const along = { x: -W0.ny, y: W0.nx };                          // a wall point 30 m from the chain, approached head-on
  const far = { x: W0.x + along.x * 300 + W0.nx * 60, y: W0.y + along.y * 300 + W0.ny * 60 };
  place(far.x, far.y); run(stick(-W0.nx, -W0.ny), 3);
  check(F.z === 0 && !RF.inRoof(F.x, F.y), 'the bare wall cannot be climbed from the ground (blocked, you stay outside)', `z ${F.z}`);
  place(h2.x + W0.nx * 60 + along.x * 6 * Math.sign((h2.x - h1.x) * along.x + (h2.y - h1.y) * along.y), h2.y + W0.ny * 60);
  run(() => stick(h2.x - F.x, h2.y - F.y), 3);
  check(F.z < h2.top, 'the HVAC box cannot be reached from the ground', `z ${F.z}`);
  place(RJ.path[0][0], RJ.path[0][1]);
  let pi = 1; const walkPath = () => { const p = RJ.path[Math.min(pi, RJ.path.length - 1)]; if (Math.hypot(p[0] - F.x, p[1] - F.y) < 8 && pi < RJ.path.length - 1) pi++; return stick(p[0] - F.x, p[1] - F.y); };
  const t1 = run(() => F.climb ? stick(0, 0) : walkPath(), 12, () => !F.climb && F.z === h1.top);
  check(t1, 'the worn path leads to the dumpster; pushing into it MANTLES you up', `z ${F.z} (${h1.top / 10} m)`);
  // the dumpster -> wall: too high
  const fz = F.z; run(stick(-W0.nx, -W0.ny), 2);
  check(F.z <= h2.top && !RF.inRoof(F.x, F.y), 'the roof cannot be grabbed from the dumpster', `z ${F.z}`);
  place(h1.x, h1.y, fz);
  const t2 = run(() => F.climb ? stick(0, 0) : stick(h2.x - F.x, h2.y - F.y), 6, () => !F.climb && F.z === h2.top);
  check(t2, 'dumpster -> HVAC box (mantle)', `z ${F.z} (${h2.top / 10} m)`);
  let grabbed = false; const t3 = run(() => { if (F.climb && F.climb.kind === 'grab') grabbed = true; return F.climb ? stick(0, 0) : stick(-W0.nx, -W0.ny); }, 6, () => !F.climb && F.z === H);
  check(t3 && grabbed && RF.inRoof(F.x, F.y), 'HVAC box -> ledge grab at the parapet -> ON THE ROOF', `z ${F.z / 10} m`);
  // 3 walkable, no invisible walls
  let n = 0, blocked = 0, acBlocked = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const O = RJ.outer;
  for (let i = 0; i < O.length; i += 2) { x0 = Math.min(x0, O[i]); x1 = Math.max(x1, O[i]); y0 = Math.min(y0, O[i + 1]); y1 = Math.max(y1, O[i + 1]); }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  while (n < 400) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    if (!RF.inRoof(x, y) || RF.support(x, y).top !== H) continue; n++;
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2; place(x, y, H); run(stick(Math.cos(a), Math.sin(a)), 0.3);
      if (Math.hypot(F.x - x, F.y - y) < 5 && !F.climb) { const ahead = RF.support(x + Math.cos(a) * 25, y + Math.sin(a) * 25); if (ahead.kind === 'ac') acBlocked++; else blocked++; }
    }
  }
  check(blocked === 0, 'the whole roof is walkable: 400 points x 16 directions, never stopped by anything you cannot see', `${blocked} invisible stops, ${acBlocked} stops at a visible AC unit`);
  const u = RJ.ac[0]; place(u.x + Math.cos(u.a) * 40, u.y + Math.sin(u.a) * 40, H);
  const tac = run(() => F.climb ? stick(0, 0) : stick(u.x - F.x, u.y - F.y), 4, () => !F.climb && F.z === u.top);
  check(tac, 'an AC unit is a solid you can climb onto', `z ${(F.z / 10).toFixed(1)} m`);
  // 4 off the edge
  place(W0.x - W0.nx * 60, W0.y - W0.ny * 60, H);
  let air = 0, peak = H, landT = -1, moved = 0, events = []; F.events = events;
  for (let t = 0; t < 4; t += DT) {
    const wasAir = F.air; CL.stepOnFoot(F, DT, stick(W0.nx, W0.ny), RF);
    if (F.air) { air += DT; peak = Math.max(peak, F.z); }
    if (wasAir && !F.air) landT = t;
    if (landT >= 0 && t - landT <= 0.4 + 1e-9) { const sp = Math.hypot(F.x - (F._lx ?? F.x), F.y - (F._ly ?? F.y)) / DT; if (t - landT > 0.38) moved = sp; }
    F._lx = F.x; F._ly = F.y;
    if (landT >= 0 && t - landT > 0.45) break;
  }
  check(air > 0.3 && peak > H && F.z === 0 && landT > 0, 'run off the edge: a hop (the bump launch vz0) then a fall under the bump gravity, land on the ground', `air ${air.toFixed(2)} s, hop ${((peak - H) / 10).toFixed(2)} m above the parapet, fell ${(peak / 10).toFixed(1)} m`);
  check(CL.CLIMB.hop === BUMP.vz0 && CL.CLIMB.g === BUMP.g, 'airtime uses the speed-bump numbers (lf_sim BUMP vz0 + g)', `vz0 ${CL.CLIMB.hop} g ${CL.CLIMB.g}`);
  check(moved > 30 && !F.hurt && events.some(e => e.kind === 'land_roll'), 'landing is fun: a roll, running again within 0.4 s, no damage', `speed ${moved.toFixed(0)} u/s at +0.4 s, events ${events.map(e => e.kind).join(',')}`);
  // 5 courtyards
  RJ.inner.forEach((ring, ci) => {
    const ch = RJ.chains[ci + 1]; let cx = 0, cy = 0; for (let i = 0; i < ring.length; i += 2) { cx += ring[i]; cy += ring[i + 1]; } cx /= ring.length / 2; cy /= ring.length / 2;
    place(ch.wall.x - ch.wall.nx * 40, ch.wall.y - ch.wall.ny * 40, H);
    run(stick(ch.wall.nx, ch.wall.ny), 2.5, () => !F.air && F.z === 0);
    const down = F.z === 0 && !RF.inRoof(F.x, F.y);
    const [a, b] = ch.holds; let stage = 0;
    const out = run(() => { if (F.climb) return stick(0, 0); if (F.z === a.top) stage = Math.max(stage, 1); if (F.z === b.top) stage = 2; const tg = stage === 0 ? a : stage === 1 ? b : null; return tg ? stick(tg.x - F.x, tg.y - F.y) : stick(-ch.wall.nx, -ch.wall.ny); }, 15, () => !F.climb && F.z === H);
    check(down && out, `courtyard ${ci + 1}: jump in, climb back out by its own chain (${a.kind} -> ${b.kind} -> ledge)`, `z ${F.z / 10} m`);
  });
  // 6 the closing shot — the REAL rally first (stick-only autopilot), then out of the car and up
  const WHO = process.argv[2] || 'brad';
  const Wd = new GraphWorld(G), S = new LFSim(Wd, ROSTER, FLEET, { spawn: { x: 0, y: 0 }, bumps: BUMPS }), M = MI.startRally(S, ROSTER, WHO), pilot = new Pilot(S, Wd, M);
  let t = 0; while (!M.complete && t < 1500) { S.step(DT, pilot.input(DT)); MI.stepRally(S, M, DT); t += DT; }
  check(M.complete, `the rally (${WHO}, autopilot on the stick) ends: THE CREW IS ASSEMBLED`, `${(t / 60).toFixed(1)} game-min, convoy ${M.convoy.length}`);
  const P2 = FT.createFoot(M.me); FT.exitCar(P2, S.player); Object.assign(F, P2, { z: 0, vz: 0, air: false, climb: null, land: 0 });
  const route = [[F.x, F.y], ...RJ.path, [h1.x, h1.y], [h2.x, h2.y]]; let ri = 1, stage = 0, tt = 0;
  while (tt < 60 && !(F.z === H && !F.climb)) {
    let inp;
    if (F.climb) inp = stick(0, 0);
    else if (F.z === h2.top) inp = stick(-W0.nx, -W0.ny);
    else { const p = route[Math.min(ri, route.length - 1)]; if (Math.hypot(p[0] - F.x, p[1] - F.y) < 10 && ri < route.length - 1) ri++; inp = stick(p[0] - F.x, p[1] - F.y); }
    S.step(DT, { jx: 0, jy: 0, jm: 0, keys: {} }); CL.stepOnFoot(F, DT, inp, RF); tt += DT;
  }
  check(F.z === H, 'after the rally: out of the car, along the worn path, up the chain, on the roof', `${tt.toFixed(1)} s on foot`);
  check(FT.nearCar(F, S.player) === false, 'up on the roof you cannot "GET IN" the car parked below');
  const lamar = S.cars.find(c => ROSTER.people.find(p => p.id === c.owner && p.car && (p.car.fx || []).includes('on_fire')));
  const cam = CL.lookout(F, RF, S, M), VW = 420, VH = 860, inView = (x, y) => Math.abs(x - cam.x) * cam.zoom < VW / 2 - 20 && Math.abs(y - cam.y) * cam.zoom < VH / 2 - 60;
  const ps = CL.project(F.x, F.y, F.z, cam);
  check(!!lamar && inView(lamar.x, lamar.y), "the lookout frames Lamar's burning Mustang", lamar ? `cam ${Math.round(cam.x)},${Math.round(cam.y)} zoom ${cam.zoom.toFixed(2)}` : 'no burning car');
  check(M.convoy.every(f => inView(f.car.x, f.car.y)) && inView(S.player.x, S.player.y), 'the lookout frames the whole parked convoy + your own car', `${M.convoy.length + 1} cars`);
  check(inView(ps.x, ps.y), 'and you, on the roof edge', '');
}
console.log(fails ? `SPEC L5 FAIL (${fails})` : 'SPEC L5 OK'); process.exit(fails ? 1 : 0);
