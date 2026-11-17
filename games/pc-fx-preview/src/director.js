// director.js — the AUTO-DIRECTOR (v2 step 4). The sim is deterministic (fixed 60 Hz step, seeded
// randomness), so a run is fully described by its seed and its input log. The director records
// both, plus a mark for every exciting event; when a run ends (BUSTED) it picks the best 20-second
// window by total excitement, re-simulates the run up to that window from the log, and plays the
// window back with its own camera: a cut every few seconds between a follow shot, a wide and a
// tight lead, and 0.35x slow motion around the single biggest moment.
import { Sim } from './sim.js';

const WINDOW = 20 * 60;                 // steps
const WEIGHT = {                         // excitement per event (crash scales with speed)
  wreck: 6, timber: 5, hood: 5, glass: 1.5, star: 3, jack: 2, snap: 2, crack: 1.5, trick: 0.6, grind: 1, ollie: 0.8,
  busted: 2, lock: 1.5, chopper: 2, siren: 0.5, bail: 3, dent: 0.3,
};
const SHOTS = [                          // { zoom, lead (seconds of velocity), hold (seconds) }
  { zoom: 1.0, lead: 0.42, hold: 5 }, { zoom: 0.8, lead: 0.15, hold: 4 }, { zoom: 1.22, lead: 0.6, hold: 3.5 }, { zoom: 0.9, lead: 0.3, hold: 4 },
];

export class Director {
  constructor(seed) { this.reset(seed); }
  reset(seed) { this.seed = seed; this.log = []; this.marks = []; this.play = null; }

  record(inp) {
    const k = inp.keys || {};
    this.log.push({ jx: inp.jx, jy: inp.jy, jm: inp.jm, action: !!inp.action, punch: !!inp.punch, turbo: !!inp.turbo, jump: inp.jump || null, keys: { up: !!k.up, down: !!k.down, left: !!k.left, right: !!k.right } });
  }

  mark(name, v) {
    let w = WEIGHT[name] || 0;
    if (name === 'crash') w = Math.min(5, (v || 0) / 60);
    if (w > 0) this.marks.push({ i: this.log.length, w, name });
  }

  // Best 20 s window: [i0, i1), its score and the step of its biggest moment. null if the run was dull.
  pick(minScore = 12) {
    const n = this.log.length, M = this.marks;
    if (!M.length || n < 6 * 60) return null;
    let best = null, lo = 0, sum = 0;
    for (let hi = 0; hi < M.length; hi++) {             // sliding window over the marks
      sum += M[hi].w;
      while (M[hi].i - M[lo].i >= WINDOW - 3 * 60) sum -= M[lo++].w;
      if (!best || sum > best.score) best = { score: sum, lo, hi };
    }
    if (!best || best.score < minScore) return null;
    let i0 = Math.max(0, M[best.lo].i - 2 * 60);         // two seconds of run-up before the first beat
    const i1 = Math.min(n, i0 + WINDOW);
    i0 = Math.max(0, i1 - WINDOW);
    let peak = M[best.lo];
    for (let k = best.lo; k <= best.hi; k++) if (M[k].w > peak.w) peak = M[k];
    return { i0, i1, score: best.score, peak: peak.i, peakName: peak.name };
  }

  // Begin a playback: a fresh sim from the same seed, to be fast-forwarded to the window.
  // The world object carries per-run state (felled palms, the loop cursor): saved here, restored by end().
  begin(world, M, events, win) {
    const saved = { felled: world.felled, fast: world.loopNearestFast };
    const sim = new Sim(world, M, this.seed, () => {});
    this.play = { sim, i: 0, win, saved, world, events, t: 0, shot: 0, shotT: 0, ready: false };
    return this.play;
  }

  // Advance the playback by `dt` real seconds; returns steps simulated. Fast-forwards (no events,
  // many steps per frame) until the window starts, then runs at 1x, 0.35x around the peak.
  step(dt, STEP) {
    const p = this.play;
    if (!p.ready) {
      const end = Math.min(p.win.i0, p.i + 2400);
      while (p.i < end) p.sim.step(STEP, this.log[p.i++]);
      if (p.i >= p.win.i0) { p.ready = true; p.sim.ev = p.events; p.acc = 0; }
      return 0;
    }
    const near = p.i - p.win.peak;
    p.slow = near > -24 && near < 30;                    // ~0.4 s before to 0.5 s after the peak
    p.acc += dt * (p.slow ? 0.35 : 1);
    p.t += dt; p.shotT += dt;
    if (p.shotT > SHOTS[p.shot].hold && !p.slow) { p.shot = (p.shot + 1) % SHOTS.length; p.shotT = 0; p.cut = true; }
    let n = 0;
    while (p.acc >= STEP && n < 6 && p.i < p.win.i1) { p.sim.step(STEP, this.log[p.i++]); p.acc -= STEP; n++; }
    return n;
  }

  get done() { const p = this.play; return !!p && p.ready && p.i >= p.win.i1; }
  get shot() { return SHOTS[this.play.shot]; }

  end() {
    const p = this.play;
    if (!p) return;
    p.world.felled = p.saved.felled; p.world.loopNearestFast = p.saved.fast;
    this.play = null;
  }
}
