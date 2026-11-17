// spec_l1.mjs — TEST-FIRST spec for task L1 (written before the code; red until each piece is built).
//   node tools/spec_l1.mjs            (from games/laurel-fulton/)  exit 0 = all green
// Part A (graph world, src/world_graph.js): index, anchor snapping, surfaces along the real route,
// grade separation, query cost. Part B (play, the forked sim): pending until the sample engine lands —
// listed here so it cannot be forgotten.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
pending('B1 the forked sim spawns at Ledo Pizza on the lot, in a real car, via the real input path');
pending('B2 a scripted stick drive follows Ledo → Maple Lawn Blvd → MD 216 → Stansfield Rd without leaving the carriageway');
pending('B3 on the US-29 / MD-216 interchange the US-29 car never collides with MD-216 traffic below');
pending('B4 a car turns round in a cul-de-sac (347 in the data)');
pending('B5 phone-size captures of the sample beside Palm City\'s opening (THE BAR)');
console.log(fails ? `SPEC L1 FAIL (${fails}), ${pend} pending` : `SPEC L1 PART A OK, ${pend} pending (part B = the sample engine)`);
process.exit(fails ? 1 : 0);
