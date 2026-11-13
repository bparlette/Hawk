/**
 * Reusable deterministic seeded RNG, input event recorder, and replay player.
 * Zero game-specific dependencies so any HTML5/Canvas/Physics game can import it.
 */

export class SeededRNG {
  constructor(seed = 19860221) {
    this.initialSeed = (seed >>> 0) || 1;
    this.state = this.initialSeed;
  }

  reset(seed = this.initialSeed) {
    this.initialSeed = (seed >>> 0) || 1;
    this.state = this.initialSeed;
    return this;
  }

  /** Mulberry32 PRNG returning float in [0, 1). */
  next() {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(this.next() * arr.length)];
  }

  /**
   * Installs this RNG onto global Math.random and resets Matter.js internal counters
   * when Matter.Common is passed or present on globalThis.
   */
  installGlobal(matterCommon = (typeof globalThis !== 'undefined' && globalThis.Matter ? globalThis.Matter.Common : null)) {
    Math.random = () => this.next();
    if (matterCommon) {
      matterCommon._nextId = 0;
      matterCommon._seed = this.initialSeed;
    }
    return this;
  }
}

function normalizePayload(data) {
  if (data === null || data === undefined) return {};
  if (typeof data !== 'object') return data;
  const out = {};
  for (const key of Object.keys(data)) {
    const v = data[key];
    if (typeof v === 'number') {
      out[key] = Number.isFinite(v) ? Math.round(v * 10000) / 10000 : 0;
    } else if (typeof v === 'boolean' || typeof v === 'string') {
      out[key] = v;
    } else if (Array.isArray(v)) {
      out[key] = v.map((item) => normalizePayload(item));
    } else if (v && typeof v === 'object') {
      out[key] = normalizePayload(v);
    }
  }
  return out;
}

export class ReplayRecorder {
  constructor() {
    this.seed = 0;
    this.events = [];
    this.active = false;
    this.startTime = 0;
    this.lastLog = null;
  }

  start(seed) {
    this.seed = (seed >>> 0) || 1;
    this.events = [];
    this.active = true;
    this.startTime = Date.now();
    this.lastLog = null;
    return this;
  }

  record(tick, type, data = {}) {
    if (!this.active) return;
    this.events.push({
      tick: tick | 0,
      type: String(type),
      data: normalizePayload(data),
    });
  }

  finish({ totalTicks = 0, finalScore = 0, digest = '', stats = {} } = {}) {
    this.active = false;
    this.lastLog = {
      version: 1,
      seed: this.seed,
      totalTicks: totalTicks | 0,
      finalScore,
      digest,
      stats: normalizePayload(stats),
      events: this.events.map((e) => ({ tick: e.tick, type: e.type, data: normalizePayload(e.data) })),
      recordedAt: this.startTime,
      durationMs: Date.now() - this.startTime,
    };
    return this.lastLog;
  }

  exportJSON() {
    return JSON.stringify(this.lastLog);
  }
}

export class ReplayPlayer {
  constructor(replayLog = null) {
    this.log = replayLog ? JSON.parse(JSON.stringify(replayLog)) : null;
    this.cursor = 0;
    this.playing = false;
    this.finished = false;
  }

  load(replayLog) {
    this.log = JSON.parse(JSON.stringify(replayLog));
    this.cursor = 0;
    this.playing = false;
    this.finished = false;
    return this;
  }

  start(game) {
    if (!this.log) throw new Error('ReplayPlayer: no replay log loaded');
    this.cursor = 0;
    this.playing = true;
    this.finished = false;
    game.reset(this.log.seed);
    return this;
  }

  /**
   * Dispatches all recorded events for game.tick, then advances one simulation tick.
   * Returns false once totalTicks is reached.
   */
  stepTick(game) {
    if (!this.playing || !this.log) return false;
    if (game.tick >= this.log.totalTicks) {
      this.playing = false;
      this.finished = true;
      return false;
    }

    const events = this.log.events;
    while (this.cursor < events.length && events[this.cursor].tick <= game.tick) {
      const ev = events[this.cursor++];
      if (ev.tick === game.tick) {
        game.applyInput(ev.type, ev.data);
      }
    }

    game.stepTick();

    if (game.tick >= this.log.totalTicks) {
      this.playing = false;
      this.finished = true;
    }
    return true;
  }
}
