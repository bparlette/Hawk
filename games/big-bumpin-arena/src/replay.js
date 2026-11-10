// Goal replay. The match is a pure function of (seed, inputs), so a replay needs no stored snapshots: record each
// tick's human input as it is played, then rebuild a second Game from the same options and feed it the same stream.
// The replay Game never touches the live one, so the real match resumes exactly where it paused.
import { HZ } from './config.js';

// Speed eases from slowStart (a brisk run-up) down to slowEnd (slow motion as the shot lands). A clip lasts about 8 s of wall-clock.
export const REPLAY = { preSec: 3, postTicks: Math.round(0.6 * HZ), slowStart: 0.9, slowEnd: 0.3 };

/** Records the human input stream of one match, indexed by the tick it was fed to. */
export class Recorder {
  constructor() { this.reset(); }
  reset() { this.inputs = []; this.lastGo = 0; }
  /** Call with game.ticks BEFORE game.tick(humans). */
  record(tick, humans) { const c = {}; for (const k in humans) c[k] = { ...humans[k] }; this.inputs[tick] = c; }
  /** The tick play last (re)started: a replay never starts inside a countdown. */
  markGo(tick) { this.lastGo = tick; }
}

export class Replay {
  /** Game and M (Matter) are passed in so this runs in node and the browser alike; opts are the live match's Game options. */
  constructor(Game, M, opts, rec, goalTick) {
    this.rec = rec; this.goalTick = goalTick;
    this.start = Math.max(rec.lastGo > goalTick ? 0 : rec.lastGo, goalTick - REPLAY.preSec * HZ, 0);
    this.end = goalTick + REPLAY.postTicks;
    this.game = new Game(M, opts); this.acc = 0; this.skipped = false; this.events = [];
  }
  get ready() { return this.game.ticks >= this.start; }
  /** Fast-forward toward the start of the clip, at most `budget` ticks per call. Spread over the celebration so no frame stalls. */
  seek(budget = Infinity) { while (this.game.ticks < this.start && budget-- > 0) this.game.tick(this.rec.inputs[this.game.ticks] || {}); return this.ready; }
  /** Play slow-motion: advance by wall-clock dt. Returns this frame's sim events. */
  update(dt) {
    this.events.length = 0; if (!this.ready) this.seek(); if (this.done) return this.events;
    this.acc += dt * this.speed; let n = 0;
    while (this.acc >= 1 / HZ && n++ < 2 && !this.done) { this.acc -= 1 / HZ; this.game.tick(this.rec.inputs[this.game.ticks] || {}); for (const e of this.game.events) this.events.push(e); }
    return this.events;
  }
  /** Playback speed now (1 = real time): eases into slow motion toward the goal. */
  get speed() { const q = 1 - this.progress; return REPLAY.slowEnd + (REPLAY.slowStart - REPLAY.slowEnd) * q * q; }
  skip() { this.skipped = true; }
  get done() { return this.skipped || this.game.ticks >= this.end; }
  /** 0..1 through the clip: drives the broadcast camera's push-in. */
  get progress() { return Math.max(0, Math.min(1, (this.game.ticks - this.start) / Math.max(1, this.end - this.start))); }
}
