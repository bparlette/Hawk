// spec_skid.mjs — Palm City's skid module, stolen: slipping tyres lay marks, calm driving doesn't.
//   node tools/spec_skid.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { GraphWorld } = await import(path.join(ROOT, 'src/world_graph.js'));
const { LFSim } = await import(path.join(ROOT, 'src/lf_sim.js'));
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const W = new GraphWorld(J('data/graph.json')), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json'), BUMPS = J('data/bumps.json').bumps;
let fails = 0; const check = (ok, label, extra = '') => { console.log((ok ? 'PASS' : 'FAIL'), label, extra); if (!ok) fails++; };
const IN = (keys) => ({ jx: 0, jy: 0, jm: 0, keys, action: false, punch: false, turbo: false });
// spawn ON a real road (a long one): a point a third along its polyline, aimed along it
const RE = W.edges.find(e => ['primary', 'secondary', 'tertiary'].includes(e.hw) && e.len > 2000) || W.edges[0];
const RP = RE.pts[Math.floor(RE.pts.length / 3)], RQ = RE.pts[Math.floor(RE.pts.length / 3) + 1];
const S = new LFSim(W, ROSTER, FLEET, { spawn: { x: RP[0], y: RP[1] }, bumps: BUMPS });
const P = S.player; P.h = Math.atan2(RQ[1] - RP[1], RQ[0] - RP[0]); P.dirx = Math.cos(P.h); P.diry = Math.sin(P.h);
check(!!S.skid && S.skid.buf.length === 2048 * 7, 'skid ring buffer live (Palm City SEGS x 7)');
// get up to speed, then cruise straight: no lateral load, no marks
for (let i = 0; i < 120; i++) S.step(1 / 30, IN({ up: true }));
check(P.v > 150, 'up to speed', P.v.toFixed(0));
let calm = 0;   // count only segments laid while actually on tarmac — grass SHOULD carve (checked below)
for (let i = 0; i < 60; i++) { const before = S.skid.w; S.step(1 / 30, IN({ up: true })); if (W.surfaceAt(P.x, P.y, 0) !== 'ground') calm += S.skid.w - before; }
check(calm <= 2, 'calm straight cruising on tarmac lays (almost) nothing', `+${calm} segs`);
const w0 = S.skid.w;
// full lock under power: the donut — heading sweeps, marks pour, coverage grows
const h0 = P.h, cov0 = S.skid.cover; let sweep = 0, hp = P.h;
for (let i = 0; i < 150; i++) { S.step(1 / 30, IN({ up: true, left: true })); let d = P.h - hp; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; sweep += Math.abs(d); hp = P.h; }
check(S.skid.w - w0 > 60, 'full-lock donut lays marks', `+${S.skid.w - w0} segs`);
check(S.skid.cover > cov0 + 10, 'coverage grid grows across the circle', `${cov0} -> ${S.skid.cover} cells`);
check(sweep > 4.5, 'the car really circles (heading sweep)', sweep.toFixed(1) + ' rad in 5 s');
// grass carves brown: find ground near the road, drive on it at speed
let gx = 0, gy = 0; outer: for (let r = 60; r < 900; r += 30) for (let a = 0; a < 6.28; a += 0.4) { const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r; if (W.surfaceAt(x, y, 0) === 'ground') { gx = x; gy = y; break outer; } }
check(gx !== 0, 'found grass to carve');
P.x = gx; P.y = gy; P.v = 190; P.h = 0; P.dirx = 1; P.diry = 0;
const w1 = S.skid.w;
for (let i = 0; i < 45; i++) S.step(1 / 30, IN({ up: true }));
let soft = 0; for (let i = w1; i < S.skid.w; i++) if (S.skid.buf[(i % 2048) * 7 + 6] === 2) soft++;
check(soft > 10, 'grass marks are the soft (brown) kind', soft + ' soft segs');
console.log(fails ? `SPEC SKID FAIL (${fails})` : 'SPEC SKID OK'); process.exit(fails ? 1 : 0);
