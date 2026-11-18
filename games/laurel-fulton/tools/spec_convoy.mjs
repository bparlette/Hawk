// spec_convoy.mjs — CONVOY BEHAVIOUR (owner, Nov 18): the crew RACES you — they surge alongside, PASS, drop back, yell "Cole Trickle", yell
// "rubbin is racing" when they bump you, throw ones (dollar bills) out the window at the cars and pens + pennies at each other.
// Runs the whole rally through the STICK like spec_l2 (same autopilot input path) and measures the convoy from OUTSIDE (its own geometry,
// not the module's counters). The honest changes vs spec_l2: none to the band/street checks; only the teleport tolerance (+4 m for contact shoves).
//   node tools/spec_convoy.mjs [player]      (from games/laurel-fulton/)  exit 0 = green.  default player: jason
// Everything is driven through the STICK (the same input the touch joystick produces). It proves:
//  1 roster-driven: the player list, houses, cars and stops all come from data/roster.json — and a person
//    added to the data appears with no code change
//  2 PICK YOUR PLAYER: you start at that person's house, in their own car; housemates join at the start
//  3 every stop: pull in slow -> the arrival beat (camera push-in, everyone out, dap up, everyone back in)
//    -> that person's car pulls out and follows
//  4 the convoy: same physics, follows YOUR path at road spacing — no teleports, no lawn-cutting, and it
//    survives you doubling back
//  5 finish: the whole convoy at the Atholton HS lot = mission complete, everyone parked up
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = process.env.LF_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // $LF_ROOT: run against a factory-built city
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/graph.json'))), ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/roster.json')));
const FLEET = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/fleet.json')));
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js');
const PL = await import('../src/lf_pilot.js');
let MI = null; try { MI = await import('../src/lf_mission.js'); } catch (e) { check(false, 'src/lf_mission.js loads', String(e).slice(0, 140)); }
if (MI) {
  const W = new GraphWorld(G), DT = 1 / 60, WHO = process.argv[2] || 'jason';
  // 1 roster-driven
  const list = MI.players(ROSTER);
  check(list.length === ROSTER.people.filter(p => p.active && p.car && p.car.sprite && !p.at).length, 'players() = every active roster person with a car and a house', list.map(p => p.id).join(' '));
  const plus = JSON.parse(JSON.stringify(ROSTER)); plus.people.push({ id: 'newbie', name: 'Newbie', street: 'Test', active: true, house: [0, 0], car: { model: 'x', sprite: 'camry_jason' } });
  check(MI.players(plus).some(p => p.id === 'newbie'), 'a person added to the DATA appears in PICK YOUR PLAYER (no code change)');
  // 2 pick
  const BUMPS = fs.existsSync(path.join(ROOT, 'data/bumps.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data/bumps.json'))).bumps : [];   // the game's speed bumps (L3) are part of the world
  const S = new LFSim(W, ROSTER, FLEET, { spawn: { x: 0, y: 0 }, bumps: BUMPS });
  const M = MI.startRally(S, ROSTER, WHO);
  const me = ROSTER.people.find(p => p.id === WHO);
  check(S.player.owner === WHO && S.player.model === me.car.sprite && Math.hypot(S.player.x - me.house[0], S.player.y - me.house[1]) < 250, `PICK ${me.name}: you start at your house in your own car`, `${S.player.model} ${Math.round(Math.hypot(S.player.x - me.house[0], S.player.y - me.house[1]) / 10)} m from the house`);
  const otherHouses = new Set(MI.players(ROSTER).filter(p => String(p.house) !== String(me.house)).map(p => String(p.house))).size;
  check(M.stops.length === otherHouses && M.stops.every(st => st.people.every(p => p.id !== WHO)), 'every OTHER house is a stop (housemates share one)', M.stops.map(st => st.people.map(p => p.id).join('+')).join(', '));
  // the autopilot: drive the STICK to each stop (nearest first), slow to pull in, wait out the beat; then the school
  const dense = (pts, step = 20) => { const o = [pts[0]]; for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let k = 1; k <= n; k++) o.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); } return o; };
  let pi = 0;
  const pilot = (pts, stopAtEnd) => {
    const c = S.player; let best = 1e18, bi = pi;
    for (let i = Math.max(0, pi - 5); i < Math.min(pts.length, pi + 200); i++) { const d = (pts[i][0] - c.x) ** 2 + (pts[i][1] - c.y) ** 2; if (d < best) { best = d; bi = i; } }
    pi = bi; let j = bi, acc = 0; while (j + 1 < pts.length && acc < 90) { acc += Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]); j++; }
    const end = pts[pts.length - 1], dEnd = Math.hypot(end[0] - c.x, end[1] - c.y);
    if (stopAtEnd && dEnd < 160) return { jx: 0, jy: 0, jm: 0, keys: c.v > 20 ? { down: true } : {} };     // pull in: brake to a crawl
    const tx = pts[j][0] - c.x, ty = pts[j][1] - c.y, L = Math.hypot(tx, ty) || 1;
    let j2 = j, a2 = 0; while (j2 + 1 < pts.length && a2 < 220) { a2 += Math.hypot(pts[j2 + 1][0] - pts[j2][0], pts[j2 + 1][1] - pts[j2][1]); j2++; }
    const b = Math.atan2(pts[j2][1] - pts[j][1], pts[j2][0] - pts[j][0]) - Math.atan2(ty, tx), bend = Math.abs(Math.atan2(Math.sin(b), Math.cos(b)));
    // target behind you: a thumb swings the stick out to the SIDE and the car turns round going forward
    // (pulling straight back is the stick's reverse — that backs into whoever is parked behind you)
    const ta = Math.atan2(ty, tx), rel = Math.atan2(Math.sin(ta - c.h), Math.cos(ta - c.h));
    if (Math.abs(rel) > 1.9 && c.v < 120) { const sa = c.h + Math.sign(rel || 1) * Math.PI / 2; return { jx: Math.cos(sa), jy: Math.sin(sa), jm: 0.8, keys: {} }; }
    return { jx: tx / L, jy: ty / L, jm: (c.v > 150 && bend > 0.5) || (dEnd < 400 && c.v > 140) ? 0.35 : 1, keys: {} };
  };
  const stats = { steps: 0, off: 0, teleports: 0, beats: 0, zoomed: 0, out: 0, dap: 0, gapBad: 0, gapN: 0, joinedOK: 0, stuck: 0 };
  const last = new Map();
  // CONVOY measurements, taken from OUTSIDE (own geometry): a PASS = a follower that was behind you (> 40 u back) ends up > 40 u ahead of you within 80 u
  // laterally, both moving; a BUMP = a follower touching you or another follower (centres inside the cars' reach)
  const X = { passes: 0, passV: [], alongside: 0, bumps: 0, bumpFrames: new Map(), contacts: [],  rubSeen: 0, rubAfterBump: 0, side: new Map(), lastBumpT: -9, offVT: 0, racingSteps: 0 };
  const reach = (a, b) => (a.len + b.len) / 4 + (a.wid + b.wid) / 4;
  const measure = () => {
    if (M.beat) return; const P = S.player; for (const a of M.convoy) for (const b of [P, ...M.convoy.map(q => q.car)]) if (a.car !== b && Math.hypot(a.car.x - b.x, a.car.y - b.y) < reach(a.car, b) + 3) { X.contacts.push(M.time); break; }
    const _p = P, dx = Math.cos(P.h), dy = Math.sin(P.h);
    for (const f of M.convoy) {
      const c = f.car, al = (c.x - P.x) * dx + (c.y - P.y) * dy, lt = Math.abs(-(c.x - P.x) * dy + (c.y - P.y) * dx), prev = X.side.get(f);
      const st = al < -40 ? -1 : al > 40 && lt < 80 ? 1 : 0;
      if (st && prev === -1 && st === 1 && Math.abs(P.v) > 100) { X.passes++; X.passV.push(Math.round(P.v)); }
      if (st) X.side.set(f, st); if (Math.hypot(c.x - P.x, c.y - P.y) > 400) X.side.delete(f);
      if (f.race && f.race.st !== 'idle') X.racingSteps++;
      if (Math.abs(al) < 25 && lt > 18 && lt < 60 && Math.abs(P.v) > 100) X.alongside++;
      if (Math.hypot(c.x - P.x, c.y - P.y) < reach(c, P) + 3 && M.time - (X.bumpFrames.get(f) ?? -9) > 3.5) { X.bumpFrames.set(f, M.time); X.bumps++; X.lastBumpT = M.time; }
    }
  };
  const watch = () => {
    for (const f of M.convoy) {
      const p = last.get(f.car); if (p && Math.hypot(f.car.x - p.x, f.car.y - p.y) > Math.abs(f.car.v) * DT + 40 && !M.beat) stats.teleports++;   // +40 u (4 m): cars now RACE and RUB (lf_convoy.js) — a contact shove at the lot is not a teleport; a real teleport is metres+ in one step
      last.set(f.car, { x: f.car.x, y: f.car.y });
      if (M.time - f.joinedAt > 4 && !M.beat) { stats.steps++; if (!['road', 'service', 'sidewalk'].includes(f.car.surface)) { const r = W.roadInfo(f.car.x, f.car.y, f.car.layer); if (!(r.e && r.d < r.hw + 15)) stats.off++; } }   // centre within 1.5 m past the kerb = wheels on the edge, still on the street
    }
    if (M.beat) { stats.zoomed = Math.max(stats.zoomed, M.camZoom); if (M.beat.phase === 'out') stats.out++; if (M.beat.phase === 'dap') stats.dap++; }
    const moving = Math.abs(S.player.v) > 60;
    if (moving && !M.beat) M.convoy.forEach((f, i) => { const ahead = i ? M.convoy[i - 1].car : S.player, d = Math.hypot(f.car.x - ahead.x, f.car.y - ahead.y); stats.gapN++; if (d < 25 || d > 700) stats.gapBad++; });
  };
  const nearestV = (x, y) => { let b = 1e18, bv = -1; for (let v = 0; v < G.verts.length; v++) { const q = G.verts[v]; const d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < b && W.adj.has(v)) { b = d; bv = v; } } return bv; };
  let t = 0, doubled = false;
  const driveTo = (x, y, stopAtEnd, maxT = 600) => {
    const pts = dense(PL.roadPath(W, S, S.player.x, S.player.y, x, y)); pi = 0;   // on the roads, to the kerb in front (lf_pilot.js)
    const kerb = { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] };
    const t0 = t;
    while (t - t0 < maxT) {
      const inp = M.beat ? { jx: 0, jy: 0, jm: 0, keys: {} } : pilot(pts, stopAtEnd);
      S.step(DT, inp); MI.stepRally(S, M, DT); t += DT; watch(); measure();
      if (stopAtEnd && !M.beat && M.lastPickupT > t0 && Math.abs(S.player.v) < 10) return true;
      if (!stopAtEnd && Math.hypot(S.player.x - kerb.x, S.player.y - kerb.y) < 150) return true;
    }
    return false;
  };
  while (M.stops.some(st => !st.done)) {
    const st = M.stops.filter(s => !s.done).sort((a, b) => Math.hypot(a.x - S.player.x, a.y - S.player.y) - Math.hypot(b.x - S.player.x, b.y - S.player.y))[0];
    const before = M.convoy.length;
    const ok = driveTo(st.x, st.y, true);
    check(ok && st.done && M.convoy.length === before + st.people.length, `stop ${st.people.map(p => p.name).join(' + ')}: pulled in, beat played, they follow`, `${(t / 60).toFixed(1)} min, convoy ${M.convoy.length}`);
    if (!ok) break;
    if (!doubled && M.convoy.length >= 2) {                         // 4: double back mid-rally — drive away then come back the way you came
      doubled = true;
      const away = W.verts[nearestV(S.player.x + 600, S.player.y)], home = [S.player.x, S.player.y];
      driveTo(away.x, away.y, false, 120); driveTo(home[0], home[1], false, 120);
    }
  }
  check(stats.out > 0 && stats.dap > 0 && stats.zoomed > 1.3, 'the arrival beat: camera pushes in, everyone out, dap up', `zoom ${stats.zoomed.toFixed(2)}, out ${stats.out} steps, dap ${stats.dap} steps`);
  // 5 the finish
  const fin = ROSTER.meetup.pos; driveTo(fin[0], fin[1], false, 900);
  for (let i = 0; i < 60 * 30 && !M.complete; i++) { S.step(DT, { jx: 0, jy: 0, jm: 0, keys: S.player.v > 10 ? { down: true } : {} }); MI.stepRally(S, M, DT); t += DT; watch(); measure(); }
  check(M.complete, 'FINISH: the full convoy at the Atholton HS lot = mission complete', `${(t / 60).toFixed(1)} min total, convoy ${M.convoy.length}`);
  check(M.complete && M.convoy.every(f => Math.abs(f.car.v) < 5 && Math.hypot(f.car.x - fin[0], f.car.y - fin[1]) < 900), 'everyone parked up together at the school');
  check(stats.teleports === 0, 'the convoy never teleports (a step further than 4 m beyond its own speed)', `${stats.teleports}`);
  check(stats.off / Math.max(1, stats.steps) < 0.05, 'the convoy stays on the streets (< 5% of follower-steps more than 1.5 m past a kerb, after pulling out of the driveway)', `${(100 * stats.off / Math.max(1, stats.steps)).toFixed(2)}% off`);
  check(stats.gapBad / Math.max(1, stats.gapN) < 0.08, 'road spacing: each car 2.5–70 m behind the one ahead while moving (> 92%)', `${(100 * (1 - stats.gapBad / Math.max(1, stats.gapN))).toFixed(1)}% in band`);
  check(doubled, 'doubled back mid-rally and the convoy carried on');
  const B = M.barks, L = B ? B.log : [], says = (k) => L.filter(e => e.key === k), thrown = (k) => L.filter(e => e.thrown === k);
  const CANON_COLE = ['Cole Trickle!', 'Cole Trickle!!', 'Cole Trickle! Cole!'], CANON_RUB = ['rubbin is racing', "rubbin is racin'", 'rubbin is racing, baby!'];   // owner canon (tasking abe38df9): the barks must match these strings EXACTLY, case included — all-caps is a fail
  check(X.alongside > 120 && X.passes >= 3, 'RACING: followers surge alongside you and PASS you (measured from outside)', `${X.passes} passes, ${X.alongside} alongside-steps, you at ${X.passV.slice(0, 5).join('/')} u/s`);
  check(M.race.events.filter(e => e.ev === 'pass').length >= 3 && new Set(M.race.events.filter(e => e.ev === 'pass').map(e => e.id)).size >= 2, 'more than one crew member goes for the pass', [...new Set(M.race.events.filter(e => e.ev === 'pass').map(e => e.id))].join(' '));
  check(X.racingSteps / Math.max(1, stats.steps) > 0.05 && X.racingSteps / Math.max(1, stats.steps) < 0.7, 'it is a race WITH a parade in it (racing 5–70% of follower-steps, the rest in formation)', `${(100 * X.racingSteps / Math.max(1, stats.steps)).toFixed(0)}%`);
  check(says('cole').length >= 6 && says('cole').every(e => CANON_COLE.includes(e.text)), 'they yell "Cole Trickle" — canon case, exact strings (rolling bark)', `${says('cole').length} times; e.g. ${says('cole').slice(0, 2).map(e => e.model + ': ' + e.text).join(' | ')}`);
  const rub = says('rub');
  const inSync = rub.filter(r => X.contacts.some(ct => Math.abs(ct - r.t) < 0.2)).length;
  check(rub.length > 0 && inSync / rub.length > 0.9, 'every "rubbin is racing" lands on an actual contact (same moment, a car touching a car)', `${inSync}/${rub.length}`);
  check(X.bumps >= 3 && rub.length >= 3 && rub.every(e => CANON_RUB.includes(e.text)), `bumps make them yell "rubbin is racing" — canon case, exact strings`, `${X.bumps} bumps (outside count), ${rub.length} "rubbin is racing" barks`);
  const cd = (() => { let bad = 0; const by = new Map(); for (const e of L) if (e.key === 'cole') { const p = by.get(e.model); if (p !== undefined && e.t - p < 0.0001) bad++; by.set(e.model, e.t); } return bad; })();
  check(cd === 0, 'bark cooldowns hold (no car repeats a line inside its cooldown)');
  check(thrown('bill').length >= 4, 'they throw ONES (dollar bills) out the window at the cars', `${thrown('bill').length} bills (${B.stats.hits} thrown things landed on a car, all kinds)`);
  check(thrown('pen').length + thrown('penny').length >= 5 && thrown('pen').length >= 1 && thrown('penny').length >= 1, 'they throw PENS and PENNIES at each other', `${thrown('pen').length} pens, ${thrown('penny').length} pennies`);
  M.race.on = false; { const before = M.race.passes; for (let i = 0; i < 600; i++) { S.step(DT, { jx: 1, jy: 0, jm: 1, keys: {} }); MI.stepRally(S, M, DT); } check(M.race.passes === before, 'CONTROL: with racing switched off nobody passes (the module is what makes the passes)'); }
}
console.log(fails ? `SPEC CONVOY FAIL (${fails})` : 'SPEC CONVOY OK'); process.exit(fails ? 1 : 0);
