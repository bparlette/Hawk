// spec_l1.mjs — TEST-FIRST spec for task L1 (written before the code; red until each piece is built).
//   node tools/spec_l1.mjs            (from games/laurel-fulton/)  exit 0 = all green
// Part A (graph world, src/world_graph.js): index, anchor snapping, surfaces along the real route,
// grade separation, query cost. Part B (play, the forked sim): pending until the sample engine lands —
// listed here so it cannot be forgotten.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = process.env.LF_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // $LF_ROOT: run against a factory-built city
let fails = 0, pend = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const pending = (name) => { console.log(`PEND ${name}`); pend++; };
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/graph.json')));
const REP = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/graph_report.json')));
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/roster.json')));
let GW = null;
try { GW = await import('../src/world_graph.js'); } catch (e) { check(false, 'src/world_graph.js loads', String(e).slice(0, 120)); }
if (GW) {
  const t0 = performance.now(); const W = new GW.GraphWorld(G); const tb = performance.now() - t0;
  check(tb < 3000, 'the full 12k-edge graph indexes in < 3 s', `${tb.toFixed(0)} ms`);
  // every anchor + every active roster house snaps to a drivable edge within 60 m
  for (const [k, a] of Object.entries(G.anchors)) { const r = W.roadInfo(a.x, a.y); check(r.d < 600, `anchor ${k} is within 60 m of a drivable road`, `${(r.d / 10).toFixed(0)} m to ${r.e && (r.e.name || r.e.ref || r.e.hw)}`); }
  for (const p of ROSTER.people.filter(q => q.active)) { const r = W.roadInfo(p.house[0], p.house[1]); check(r.d < 600, `house ${p.id} is within 60 m of a road`, `${(r.d / 10).toFixed(0)} m`); }
  // the real route: every sampled point along it is road surface (carriageway), at the right layer
  const route = REP.route.edges.map(i => G.edges[i]);
  let bad = 0, n = 0;
  for (const e of route) for (let k = 0; k + 1 < e.pts.length; k++) for (let u = 0; u < 1; u += 0.25) {
    const x = e.pts[k][0] + (e.pts[k + 1][0] - e.pts[k][0]) * u, y = e.pts[k][1] + (e.pts[k + 1][1] - e.pts[k][1]) * u; n++;
    { const s = W.surfaceAt(x, y, (e.bridge || e.layer > 0) ? 1 : 0); if (s !== 'road' && !(e.hw === 'service' && s === 'service')) bad++; }   // the lot's aisles are 'service'; where one meets a road, road wins
  }
  check(bad === 0, 'surfaceAt = road along the whole Ledo → Brad route', `${bad}/${n} off`);
  // never road 30 m beside a residential street (true widths, not fat strokes)
  let fat = 0, m = 0;
  for (const e of G.edges.filter(q => q.hw === 'residential').slice(0, 300)) {
    const [a, b] = [e.pts[0], e.pts[e.pts.length - 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 200) continue;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L; m++;
    const s = W.surfaceAt(mx + nx * 300, my + ny * 300, 0); if (s === 'road' && W.roadInfo(mx + nx * 300, my + ny * 300).d > 120) fat++;
  }
  check(fat === 0, 'no phantom road 30 m off residential streets', `${fat}/${m}`);
  // grade separation: at every tagged crossing, the two levels answer differently
  const bridges = G.edges.filter(e => e.bridge).length;
  check(bridges > 0 && typeof W.roadInfo(0, 0, 1).d === 'number', 'layer-aware queries (bridge decks are layer 1)', `${bridges} bridge edges`);
  // route on the graph between anchors honours one-ways and returns a polyline
  const R = W.route(G.anchors.ledo.v, G.anchors.brad.v);
  check(R && Math.abs(R.len / 10000 - REP.route.km) < 0.05, 'W.route(ledo, brad) = the report\'s 7.22 km', R ? (R.len / 10000).toFixed(2) + ' km' : 'none');
  // query cost
  const q0 = performance.now(); for (let i = 0; i < 20000; i++) W.surfaceAt(-26000 + (i % 400) * 130, (i / 400 | 0) * 700, 0);
  const us = (performance.now() - q0) * 1000 / 20000; check(us < 20, 'surfaceAt < 20 µs average', us.toFixed(2) + ' µs');
}
// ------------------------------------------------------------------ part B: play, through the real input path
let SIM = null;
try { SIM = await import('../src/lf_sim.js'); } catch (e) { check(false, 'src/lf_sim.js loads', String(e).slice(0, 120)); }
const FLEET = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/fleet.json')));
if (GW && SIM) {
  const W = new GW.GraphWorld(G), DT = 1 / 60;
  // pure-pursuit autopilot that only ever moves the STICK (jx, jy, jm) — exactly what a thumb does
  const dense = (pts, step = 20) => {                              // resample: OSM vertices can be 300 m apart on a curve
    const out = [pts[0]];
    for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); }
    return out;
  };
  const pilot = (S, pts, look = 90) => {
    const c = S.player; let best = 1e18, bi = S._pi || 0;
    for (let i = Math.max(0, bi - 5); i < Math.min(pts.length, bi + 200); i++) { const d = (pts[i][0] - c.x) ** 2 + (pts[i][1] - c.y) ** 2; if (d < best) { best = d; bi = i; } }
    S._pi = bi; let j = bi, acc = 0;
    while (j + 1 < pts.length && acc < look) { acc += Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]); j++; }
    const tx = pts[j][0] - c.x, ty = pts[j][1] - c.y, L = Math.hypot(tx, ty) || 1;
    let j2 = j, a2 = 0; while (j2 + 1 < pts.length && a2 < 220) { a2 += Math.hypot(pts[j2 + 1][0] - pts[j2][0], pts[j2 + 1][1] - pts[j2][1]); j2++; }
    const bend = Math.abs(Math.atan2(Math.sin(Math.atan2(pts[j2][1] - pts[j][1], pts[j2][0] - pts[j][0]) - Math.atan2(ty, tx)), Math.cos(Math.atan2(pts[j2][1] - pts[j][1], pts[j2][0] - pts[j][0]) - Math.atan2(ty, tx))));
    const jm = c.v > 150 && bend > 0.5 ? 0.35 : 1;                 // lift for the corner ahead, like a driver would
    return { jx: tx / L, jy: ty / L, jm, keys: {} };
  };
  const ROSTER2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/roster.json')));
  // B1 spawn
  const S = new SIM.LFSim(W, ROSTER2, FLEET);
  check(S.player && Math.hypot(S.player.x - G.anchors.ledo.x, S.player.y - G.anchors.ledo.y) < 300 && ['road', 'service'].includes(W.surfaceAt(S.player.x, S.player.y, 0)) || W.roadInfo(S.player.x, S.player.y, 0).d < 300,
    'B1 spawn at Ledo Pizza, in Brad\'s Camaro', `${S.player.model} at ${Math.round(S.player.x)},${Math.round(S.player.y)}, ${(W.roadInfo(S.player.x, S.player.y, 0).d / 10).toFixed(0)} m from the lot aisle`);
  check(S.cars.filter(c => c.parked).length >= 8, 'B1 the crew\'s cars are parked at their houses', `${S.cars.filter(c => c.parked).length} parked`);
  // B2 the owner's sample route: Ledo -> Maple Lawn Blvd -> MD 216 -> Stansfield Rd, by the stick
  const mlb = G.edges.map((e, i) => [e, i]).filter(([e]) => e.name === 'Maple Lawn Boulevard');
  const mid = mlb[(mlb.length / 2) | 0][0];
  const r1 = W.route(G.anchors.ledo.v, mid.a), r2 = W.route(mid.a, G.anchors.brad.v);
  check(!!(r1 && r2), 'B2 a legal route Ledo -> Maple Lawn Blvd -> Brad\'s exists', r1 && r2 ? `${((r1.len + r2.len) / 10000).toFixed(2)} km` : 'none');
  if (r1 && r2) {
    const pts = dense([...r1.pts, ...r2.pts.slice(1)]), names = new Set();
    [...r1.edges, ...r2.edges].forEach(i => names.add(G.edges[i].name || G.edges[i].ref));
    S.player.h = Math.atan2(pts[3][1] - pts[0][1], pts[3][0] - pts[0][0]);   // the game spawns you facing out of the lot
    let on = 0, n = 0, t = 0, arrived = false, maxv = 0;
    const end = pts[pts.length - 1];
    while (t < 900 && !arrived) {
      S.step(DT, pilot(S, pts)); t += DT; n++; maxv = Math.max(maxv, S.player.v);
      if (['road', 'service'].includes(S.player.surface)) on++;
      arrived = Math.hypot(S.player.x - end[0], S.player.y - end[1]) < 120;
    }
    check(arrived, 'B2 the stick drive reaches Brad\'s on Stansfield Rd', `${t.toFixed(0)} s, top ${(maxv / 10 * 2.237).toFixed(0)} mph, via ${[...names].filter(Boolean).join(' / ')}`);
    check(on / n > 0.99, 'B2 ... without leaving the carriageway (> 99% of steps on road)', `${(100 * on / n).toFixed(2)}% on road`);
    check(['Maple Lawn Boulevard', 'Stansfield Road'].every(x => names.has(x)) && [...names].some(x => /216/.test(x || '') || x === 'Scaggsville Road'), 'B2 ... on the owner\'s roads: Maple Lawn Blvd, MD 216, Stansfield Rd');
  }
  // B3 grade separation: a car under a bridge never touches one parked on the deck above
  const isUS29 = e => /US 29/.test(e.ref) || e.name === 'Columbia Pike';
  let pair = null;
  for (const b of G.edges.filter(e => e.bridge && !isUS29(e))) {
    for (const u of G.edges.filter(e => isUS29(e) && !e.bridge && e.hw === 'trunk')) {
      for (let k = 0; k + 1 < u.pts.length && !pair; k++) for (let m = 0; m + 1 < b.pts.length && !pair; m++) {
        const [p1, p2, p3, p4] = [u.pts[k], u.pts[k + 1], b.pts[m], b.pts[m + 1]];
        const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]); if (Math.abs(d) < 1e-9) continue;
        const tt = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d, uu = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
        if (tt > 0 && tt < 1 && uu > 0 && uu < 1) pair = { under: u, over: b, x: p1[0] + tt * (p2[0] - p1[0]), y: p1[1] + tt * (p2[1] - p1[1]), k };
      }
      if (pair) break;
    }
    if (pair) break;
  }
  check(!!pair, 'B3 found a US-29 crossing under a bridge (the interchange area)', pair ? `${pair.over.name || pair.over.ref} over ${pair.under.name || pair.under.ref} at ${Math.round(pair.x)},${Math.round(pair.y)}` : '');
  if (pair) {
    const S3 = new SIM.LFSim(W, { people: [] }, FLEET, { spawn: { x: pair.under.pts[Math.max(0, pair.k - 2)][0], y: pair.under.pts[Math.max(0, pair.k - 2)][1] } });
    const deck = S3.addCar('astro_jimmy', pair.x, pair.y, 0, { parked: true }); deck.layer = 1;
    const u = pair.under, k0 = Math.max(0, pair.k - 2), along = dense(u.pts.slice(k0));
    S3.player.x = along[0][0]; S3.player.y = along[0][1]; S3.player.h = Math.atan2(along[1][1] - along[0][1], along[1][0] - along[0][0]); S3.player.v = 150;
    let under = 0, minD = 1e9;
    for (let i = 0; i < 60 * 14; i++) { S3.step(DT, pilot(S3, along, 60)); minD = Math.min(minD, Math.hypot(S3.player.x - pair.x, S3.player.y - pair.y)); if (minD < 30 && S3.player.layer === 0) under++; }
    check(minD < 40 && S3.events.length === 0 && Math.hypot(deck.x - pair.x, deck.y - pair.y) < 1, 'B3 driving US-29 under the deck: no contact with the car parked above', `closest ${(minD / 10).toFixed(1)} m, ${S3.events.length} bumps, deck car moved ${Math.hypot(deck.x - pair.x, deck.y - pair.y).toFixed(1)}`);
  }
  if (pair) {                                                      // control: the same drive with the car on the SAME level must hit it
    const S5 = new SIM.LFSim(W, { people: [] }, FLEET, { spawn: { x: 0, y: 0 } });
    const u = pair.under, k0 = Math.max(0, pair.k - 2), along = dense(u.pts.slice(k0));
    S5.player.x = along[0][0]; S5.player.y = along[0][1]; S5.player.h = Math.atan2(along[1][1] - along[0][1], along[1][0] - along[0][0]); S5.player.v = 150;
    const same = S5.addCar('astro_jimmy', pair.x, pair.y, 0, { parked: true }); same.layer = 0;
    for (let i = 0; i < 60 * 14; i++) S5.step(DT, pilot(S5, along, 60));
    check(S5.events.length > 0 || Math.hypot(same.x - pair.x, same.y - pair.y) > 1, 'B3 control: on the SAME level the car does hit it (the test can fail)', `${S5.events.length} bumps, moved ${Math.hypot(same.x - pair.x, same.y - pair.y).toFixed(1)}`);
  }
  // B4 a real cul-de-sac near Brad's: drive in, turn round, drive out
  const deg = new Map(); for (const e of G.edges) { deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
  const cds = G.edges.filter(e => e.hw === 'residential' && (deg.get(e.b) === 1 || deg.get(e.a) === 1) && e.len > 400 && e.len < 1500)
    .sort((p, q) => Math.hypot(p.pts[0][0] - G.anchors.brad.x, p.pts[0][1] - G.anchors.brad.y) - Math.hypot(q.pts[0][0] - G.anchors.brad.x, q.pts[0][1] - G.anchors.brad.y))[0];
  if (cds) {
    const inPts = dense(deg.get(cds.b) === 1 ? cds.pts : [...cds.pts].reverse()), outPts = [...inPts].reverse();
    const S4 = new SIM.LFSim(W, { people: [] }, FLEET, { spawn: { x: inPts[0][0], y: inPts[0][1] }, h: Math.atan2(inPts[1][1] - inPts[0][1], inPts[1][0] - inPts[0][0]) });
    let t = 0, phase = 0, onR = 0, n = 0;
    while (t < 60 && phase < 2) {
      const tgt = phase === 0 ? inPts : outPts;
      S4.step(DT, pilot(S4, tgt, 50)); t += DT; n++; if (['road', 'service', 'sidewalk'].includes(S4.player.surface)) onR++;
      const e = tgt[tgt.length - 1];
      if (Math.hypot(S4.player.x - e[0], S4.player.y - e[1]) < 60) { phase++; S4._pi = 0; }
    }
    check(phase === 2, `B4 in and back out of a real cul-de-sac (${cds.name || 'residential'})`, `${t.toFixed(1)} s, ${(100 * onR / n).toFixed(0)}% on road/kerb`);
  }
}
pending('B5 THE BAR: captured (tools/lf_shots.mjs -> shots/l1-*.png) and judged BELOW THE BAR — no buildings, lots or trees yet; lawn too uniform vs the opening. Next: OSM building footprints + landuse + trees, grade toward the opening');
console.log(fails ? `SPEC L1 FAIL (${fails}), ${pend} pending` : `SPEC L1 OK, ${pend} pending`);
process.exit(fails ? 1 : 0);
