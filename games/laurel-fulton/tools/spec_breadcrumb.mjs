// spec_breadcrumb.mjs — SPEC: College Park GPS breadcrumb (src/lf_breadcrumb.js, owner Nov 18).
//   node tools/spec_breadcrumb.mjs        (from games/laurel-fulton/)   exit 0 = green
// The dotted line must run along the REAL College Park road network (lf_pilot's roadPath —
// the autopilot/cop router, not a second one), from the player's car to the target, fading
// with distance, and it must be cached (recomputed only when the target changes or the car
// has driven on). The city gate is the page title: 'College Park' draws, 'Scaggsville' never.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CP = path.join(ROOT, '..', 'college-park');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (base, f) => JSON.parse(fs.readFileSync(path.join(base, f), 'utf8'));
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js');
const BC = await import('../src/lf_breadcrumb.js');

check(BC.isCollegePark('College Park') && BC.isCollegePark('COLLEGE PARK — Route 1'), 'gate: College Park titles draw the breadcrumb');
check(!BC.isCollegePark('Scaggsville') && !BC.isCollegePark('') && !BC.isCollegePark(null), 'gate: Laurel (and anything else) never draws it');

const AREAS = J(CP, 'data/areas.json'), G = J(CP, 'data/graph.json'), ROSTER = J(CP, 'data/roster.json'), FLEET = J(CP, 'assets/fleet.json'), BUMPS = J(CP, 'data/bumps.json').bumps;
const W = new GraphWorld(G);
const S = new LFSim(W, ROSTER, FLEET, { bumps: BUMPS, buildings: AREAS.buildings, greens: AREAS.green });
const P = S.player;
const meet = ROSTER.meetup.pos, target = { x: meet[0], y: meet[1] };
// the default spawn sits near the meetup — start the test from the farthest hero's house
let far = null, fd = -1;
for (const p of ROSTER.people) { if (!p.house) continue; const d = Math.hypot(p.house[0] - meet[0], p.house[1] - meet[1]); if (d > fd) { fd = d; far = p; } }
P.x = far.house[0]; P.y = far.house[1];
const dStart = Math.hypot(target.x - P.x, target.y - P.y);
check(dStart > 1500, 'test setup: the meetup is across the map from the start house', `${far.id} at ${Math.round(dStart)} u`);

const B = new BC.Breadcrumb(W, S);
const dots = B.dots(P, target);
check(dots.length >= 15, 'a cross-map route draws a real dotted line', `${dots.length} dots over ${Math.round(B.routeLen)} u`);
const offNet = dots.filter(d => !['road', 'service'].includes(W.surfaceAt(d.x, d.y)));
check(offNet.length === 0, 'every dot lies on the drivable network (road/service — the router\u2019s own path)', `${dots.length - offNet.length}/${dots.length} on-network`);
check(dots.every(d => W.surfaceAt(d.x, d.y) !== 'ground'), 'no dot sits on grass/ground');
const dFirst = Math.hypot(dots[0].x - P.x, dots[0].y - P.y);
check(dFirst >= 60 && dFirst <= 200, 'the line starts just ahead of the car (not under it)', `${Math.round(dFirst)} u`);
const dLast = Math.hypot(dots[dots.length - 1].x - target.x, dots[dots.length - 1].y - target.y);
check(dLast < 260, 'the line ends at the target', `${Math.round(dLast)} u short`);
let mono = true; for (let i = 1; i < dots.length; i++) if (dots[i].f > dots[i - 1].f + 1e-9) mono = false;
check(mono && dots[0].f > 0.9 && dots[dots.length - 1].f < 0.65, 'the fade deepens along the route', `f ${dots[0].f.toFixed(2)} -> ${dots[dots.length - 1].f.toFixed(2)}`);

const again = B.dots(P, target);
check(again === dots, 'cached: same target + unmoved car returns the same dots (no re-route per frame)');
P.x += 500; P.y += 500;
const moved = B.dots(P, target);
check(moved !== dots && moved.length >= 10, 'driving on re-routes from the new position', `${moved.length} dots`);
check(B.dots(P, null).length === 0 && B.dots(null, target).length === 0, 'no target / no car: no dots');

console.log(fails ? `FAIL (${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
