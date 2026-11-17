// director_check.mjs — the auto-director's rules, on the real sim in Node: a run (the ?demo pilot's:
// jack, chase, busted) is recorded as seed + input log; the re-simulation from that log must land on
// EXACTLY the live sim's state (determinism is what makes the replay honest), and the picked window
// must be 20 s, hold the peak moment, and beat any other 20 s by score.
// Usage: node tools/director_check.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { Sim } from '../src/sim.js';
import { DemoPilot } from '../src/demo.js';
import { Director } from '../src/director.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const STEP = 1 / 60, SEED = 7;
const d = new Director(SEED);
const live = new Sim(world, M, SEED, (n, v) => d.mark(n, v));
const pilot = new DemoPilot(live, world);
let bustedAt = -1;
for (let i = 0; i < 40 * 60 && !pilot.done; i++) { const inp = pilot.input(STEP); d.record(inp); live.step(STEP, inp); if (live.busted && bustedAt < 0) bustedAt = i; }
const snap = (s) => { const f = s.focus(); return `${s.player.mode} ${f.x.toFixed(3)},${f.y.toFixed(3)} stars ${s.stars} score ${s.score || 0} cars ${s.cars.length} t ${s.time.toFixed(3)}`; };
const liveSnap = snap(live), liveFelled = world.felled;
check(bustedAt > 0, 'the recorded run ends in a bust', `${(bustedAt / 60).toFixed(1)} s, ${d.log.length} steps, ${d.marks.length} marks`);
const win = d.pick();
check(!!win && win.i1 - win.i0 === 20 * 60, 'the director picks a 20 s window', win ? `${(win.i0 / 60).toFixed(1)}–${(win.i1 / 60).toFixed(1)} s, score ${win.score.toFixed(1)}` : '');
check(win.peak >= win.i0 && win.peak < win.i1, 'the peak moment is inside it', `${win.peakName} @ ${(win.peak / 60).toFixed(1)} s`);
{ // brute force: no other 20 s span of marks scores higher
  let best = 0;
  for (let a = 0; a < d.marks.length; a++) { let s = 0; for (let b = a; b < d.marks.length && d.marks[b].i - d.marks[a].i < 17 * 60; b++) s += d.marks[b].w; best = Math.max(best, s); }
  check(Math.abs(best - win.score) < 1e-6, 'no other window scores higher', `${best.toFixed(1)}`);
}
// replay: fast-forward to the window, then play to its end — and on to the end of the log
const p = d.begin(world, M, () => {}, win);
let guard = 0;
while (!p.ready && guard++ < 1000) d.step(1 / 60, STEP);
check(p.i === win.i0, 'the replay fast-forwards to the window start', `step ${p.i}`);
let slowSteps = 0, frames = 0;
while (!d.done && frames < 20000) { const before = p.i; d.step(1 / 60, STEP); frames++; if (p.slow && p.i > before) slowSteps += p.i - before; }
check(d.done && p.i === win.i1, 'it plays the window to its end');
check(frames > 20 * 60 + 60, 'slow motion stretches it past 20 s of wall time', `${(frames / 60).toFixed(1)} s, ${slowSteps} steps in slow-mo`);
while (p.i < d.log.length) p.sim.step(STEP, d.log[p.i++]);
check(snap(p.sim) === liveSnap, 're-simulated from seed + input log, the run ends in exactly the live state', snap(p.sim));
d.end();
check(world.felled === liveFelled, "ending the replay hands the world's per-run state back to the live run");
// a dull run gets no highlight
{ const q = new Director(SEED); for (let i = 0; i < 30 * 60; i++) q.record({ jx: 0, jy: 0, jm: 0, keys: {} }); q.mark('dent', 0); check(q.pick() === null, 'a run where nothing happened gets no highlight'); }
console.log(fails ? `DIRECTOR FAIL (${fails})` : 'DIRECTOR OK');
process.exit(fails ? 1 : 0);
