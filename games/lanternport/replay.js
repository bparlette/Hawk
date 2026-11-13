// Lanternport Film Mode — deterministic input/tick recorder, localStorage take store, and bit-exact replay player.
// Zero DOM dependencies so it runs identically headless (Node tests) and in the browser.
import { Game } from './sim.js';
import { SimClock, simDigest } from './capture.js';

export const REPLAY_STORAGE_KEY = 'lanternport:film:takes:v1';
export const REPLAY_SPEEDS = [0.5, 1, 2];
export const TAKE_VERSION = 1;

const cleanNum = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return 0;
  return n;
};

/** Normalize a live or scripted input object to the canonical fields read by Game.tick. */
export function normalizeInput(raw = {}) {
  return {
    stickX: cleanNum(raw.stickX),
    stickY: cleanNum(raw.stickY),
    camYaw: cleanNum(raw.camYaw),
    a: !!raw.a,
    b: !!raw.b,
    z: !!raw.z,
    use: !!raw.use,
    swap: !!raw.swap,
  };
}

function packInput(raw) {
  const i = normalizeInput(raw);
  const bits = (i.a ? 1 : 0) | (i.b ? 2 : 0) | (i.z ? 4 : 0) | (i.use ? 8 : 0) | (i.swap ? 16 : 0);
  return [i.stickX, i.stickY, i.camYaw, bits];
}

function unpackTuple(sx, sy, cy, bits) {
  return {
    stickX: sx,
    stickY: sy,
    camYaw: cy,
    a: !!(bits & 1),
    b: !!(bits & 2),
    z: !!(bits & 4),
    use: !!(bits & 8),
    swap: !!(bits & 16),
  };
}

function sameTuple(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function pushOp(ops, op) {
  ops.push(op);
}

function pushInputOp(ops, tuple) {
  const isZero = tuple[0] === 0 && tuple[1] === 0 && tuple[2] === 0 && tuple[3] === 0;
  const last = ops[ops.length - 1];
  if (isZero) {
    if (Array.isArray(last) && last.length === 1 && typeof last[0] === 'number') {
      last[0]++;
      return;
    }
    ops.push([1]);
    return;
  }
  if (
    Array.isArray(last) &&
    last.length === 5 &&
    typeof last[0] === 'number' &&
    last[1] === tuple[0] &&
    last[2] === tuple[1] &&
    last[3] === tuple[2] &&
    last[4] === tuple[3]
  ) {
    last[0]++;
    return;
  }
  ops.push([1, tuple[0], tuple[1], tuple[2], tuple[3]]);
}

function cloneOps(ops) {
  return ops.map((op) => (Array.isArray(op) ? [...op] : op));
}

function countInputTicks(ops) {
  let n = 0;
  for (const op of ops) {
    if (Array.isArray(op) && typeof op[0] === 'number') n += op[0];
  }
  return n;
}

/** Expand compact ops stream step-by-step. */
function runOpStream(game, ops, onSceneOp) {
  for (const op of ops) {
    if (!Array.isArray(op)) continue;
    if (typeof op[0] === 'number') {
      const inp = op.length === 1 ? unpackTuple(0, 0, 0, 0) : unpackTuple(op[1], op[2], op[3], op[4]);
      for (let k = 0; k < op[0]; k++) {
        game.tick(inp);
      }
    } else if (op[0] === 'p') {
      game.place(op[1], op[2], op[3], op[4]);
    } else if (op[0] === 'h') {
      game.active = op[1];
    } else if (op[0] === 's' && onSceneOp) {
      onSceneOp({ sceneId: op[1], mode: op[2], sceneTick: op[3] });
    }
  }
}

/**
 * Tracks a live Game(seed) session from tick 0 so recordings can begin either at t=0
 * or mid-session while still supporting bit-exact replay from tick 0.
 */
export class SessionRecorder {
  constructor(seed = 7, { idGen } = {}) {
    this.seed = seed;
    this._idGen = idGen || (() => `take-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
    this.reset(seed);
  }

  reset(seed = this.seed) {
    this.seed = seed;
    this.preludeOps = [];
    this.ticks = 0;
    this.recording = null;
    this._lastSceneKey = '';
  }

  /** Record an out-of-tick game.place(...) call so replay mirrors scene spawn / park jumps. */
  recordPlace(heroIdx, x, y, z) {
    const op = ['p', heroIdx, cleanNum(x), cleanNum(y), cleanNum(z)];
    if (this.recording) pushOp(this.recording.ops, op);
    else pushOp(this.preludeOps, op);
  }

  /** Record current staged scene state (visual sync only; never touches sim randomness). */
  recordSceneState(sceneId, mode, sceneTick = 0) {
    const id = sceneId || null;
    const m = mode || 'play';
    const key = `${id || ''}|${m}|${m === 'watch' ? 'w' : sceneTick}`;
    if (this.recording) {
      const sameWatchTick = m === 'watch' && (this.recording._lastSceneTick === sceneTick || this.recording._lastSceneTick === sceneTick - 1);
      if (this.recording._lastSceneKey !== key || (m === 'watch' && !sameWatchTick)) {
        this.recording._lastSceneKey = key;
        pushOp(this.recording.ops, ['s', id, m, cleanNum(sceneTick)]);
      }
      this.recording._lastSceneTick = sceneTick;
    } else if (this._lastSceneKey !== key) {
      this._lastSceneKey = key;
      pushOp(this.preludeOps, ['s', id, m, cleanNum(sceneTick)]);
    }
  }

  /** Start capturing a named take from the current game state. Returns the live handle. */
  startRecording(game, { name = '', sceneId = null, sceneMode = 'play', sceneTick = 0 } = {}) {
    if (this.recording) return this.recording;
    const digest = simDigest(game);
    const takeId = this._idGen();
    this.recording = {
      id: takeId,
      name: name || '',
      seed: this.seed,
      sceneId: sceneId || null,
      startTick: game.ticks,
      startDigest: digest,
      prelude: cloneOps(this.preludeOps),
      ops: [],
      endTick: game.ticks,
      endDigest: digest,
      createdAt: Date.now(),
      _lastSceneKey: '',
      _lastSceneTick: null,
    };
    if (sceneId) this.recordSceneState(sceneId, sceneMode, sceneTick);
    return this.recording;
  }

  /** Record one simulation tick using the exact normalized input passed to game.tick. */
  recordTick(rawInput) {
    const tuple = packInput(rawInput);
    this.ticks++;
    if (this.recording) {
      pushInputOp(this.recording.ops, tuple);
    } else {
      pushInputOp(this.preludeOps, tuple);
    }
    return unpackTuple(tuple[0], tuple[1], tuple[2], tuple[3]);
  }

  /** Finish recording and return a portable, JSON-serializable take object. */
  stopRecording(game, { name, sceneId } = {}) {
    if (!this.recording) return null;
    const r = this.recording;
    const durationTicks = countInputTicks(r.ops);
    const take = {
      version: TAKE_VERSION,
      id: r.id,
      name: (name || r.name || '').trim() || `Take ${new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
      seed: r.seed,
      sceneId: sceneId !== undefined ? (sceneId || null) : r.sceneId,
      startTick: r.startTick,
      startDigest: r.startDigest,
      endTick: game.ticks,
      endDigest: simDigest(game),
      durationTicks,
      prelude: r.prelude,
      ops: r.ops,
      createdAt: r.createdAt,
    };
    // Merge the recorded segment into preludeOps so further mid-session recordings remain bit-exact.
    for (const op of r.ops) pushOp(this.preludeOps, Array.isArray(op) ? [...op] : op);
    this.recording = null;
    return take;
  }

  get isRecording() { return !!this.recording; }
  get recordedTicks() { return this.recording ? countInputTicks(this.recording.ops) : 0; }
}

/** Persistent store for named takes backed by localStorage (with safe in-memory fallback). */
export class TakeStore {
  constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null, key = REPLAY_STORAGE_KEY) {
    this.storage = storage;
    this.key = key;
    this._mem = null;
  }

  _readAll() {
    if (this._mem) return this._mem;
    let parsed = [];
    if (this.storage) {
      try {
        const raw = this.storage.getItem(this.key);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) parsed = arr.filter((t) => t && t.version === TAKE_VERSION && Array.isArray(t.ops));
        }
      } catch {
        parsed = [];
      }
    }
    this._mem = parsed;
    return this._mem;
  }

  _writeAll(list) {
    this._mem = list;
    if (!this.storage) return { ok: true, pruned: 0 };
    const copy = [...list];
    let pruned = 0;
    while (copy.length >= 0) {
      try {
        this.storage.setItem(this.key, JSON.stringify(copy));
        this._mem = copy;
        return { ok: true, pruned };
      } catch (err) {
        if (copy.length <= 1) {
          return { ok: false, error: String(err && err.message ? err.message : err), pruned };
        }
        copy.pop();
        pruned++;
      }
    }
    return { ok: false, error: 'Quota exceeded', pruned };
  }

  list() {
    return [...this._readAll()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  get(id) {
    return this._readAll().find((t) => t.id === id) || null;
  }

  save(take) {
    const clean = JSON.parse(JSON.stringify(take));
    const list = this._readAll().filter((t) => t.id !== clean.id);
    list.unshift(clean);
    return { take: clean, ...this._writeAll(list) };
  }

  rename(id, name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return false;
    const list = this._readAll();
    const item = list.find((t) => t.id === id);
    if (!item) return false;
    item.name = trimmed;
    this._writeAll(list);
    return true;
  }

  remove(id) {
    const next = this._readAll().filter((t) => t.id !== id);
    if (next.length === this._readAll().length) return false;
    this._writeAll(next);
    return true;
  }

  nextName(prefix = 'Take') {
    const existing = new Set(this._readAll().map((t) => t.name));
    let i = this._readAll().length + 1;
    while (existing.has(`${prefix} ${i}`)) i++;
    return `${prefix} ${i}`;
  }
}

/**
 * Deterministic player that reconstructs Game(take.seed), fast-forwards any prelude,
 * and steps the recorded take ops one sim tick at a time.
 */
export class ReplayPlayer {
  constructor(take, { GameClass = Game } = {}) {
    this.take = take;
    this.GameClass = GameClass;
    this.totalTicks = countInputTicks(take.ops);
    this.game = null;
    this.paused = false;
    this.cursor = 0; // input ticks executed within take.ops
    this._opIdx = 0;
    this._runLeft = 0;
    this._curInp = null;
    this.preludeMatch = null;
    this.digestMatch = null;
    this.actualStartDigest = null;
    this.actualEndDigest = null;
    this.sceneState = { sceneId: take.sceneId || null, mode: take.sceneId ? 'ready' : 'play', sceneTick: 0 };
    this.reset();
  }

  reset() {
    this.game = new this.GameClass(this.take.seed);
    this.sceneState = { sceneId: this.take.sceneId || null, mode: this.take.sceneId ? 'ready' : 'play', sceneTick: 0 };
    if (Array.isArray(this.take.prelude) && this.take.prelude.length) {
      runOpStream(this.game, this.take.prelude, (s) => { this.sceneState = s; });
    }
    this.actualStartDigest = simDigest(this.game);
    this.preludeMatch = this.take.startDigest ? this.actualStartDigest === this.take.startDigest : true;
    this.cursor = 0;
    this._opIdx = 0;
    this._runLeft = 0;
    this._curInp = null;
    this.digestMatch = null;
    this.actualEndDigest = null;
    this._consumeLeadingSideOps();
    if (this.totalTicks === 0) this._finish();
  }

  _consumeLeadingSideOps() {
    const ops = this.take.ops;
    while (this._opIdx < ops.length) {
      const op = ops[this._opIdx];
      if (!Array.isArray(op)) { this._opIdx++; continue; }
      if (typeof op[0] === 'number') break;
      if (op[0] === 'p') this.game.place(op[1], op[2], op[3], op[4]);
      else if (op[0] === 'h') this.game.active = op[1];
      else if (op[0] === 's') this.sceneState = { sceneId: op[1], mode: op[2], sceneTick: op[3] };
      this._opIdx++;
    }
  }

  _finish() {
    this.actualEndDigest = simDigest(this.game);
    this.digestMatch = this.take.endDigest ? this.actualEndDigest === this.take.endDigest : true;
  }

  get done() { return this.cursor >= this.totalTicks; }

  /** Execute one sim tick from the recorded take. Returns true if a tick ran. */
  step() {
    if (this.done) return false;
    while (this._runLeft <= 0) {
      this._consumeLeadingSideOps();
      if (this._opIdx >= this.take.ops.length) { this._finish(); return false; }
      const op = this.take.ops[this._opIdx++];
      if (typeof op[0] === 'number' && op[0] > 0) {
        this._runLeft = op[0];
        this._curInp = op.length === 1 ? unpackTuple(0, 0, 0, 0) : unpackTuple(op[1], op[2], op[3], op[4]);
      }
    }
    this.game.tick(this._curInp);
    this._runLeft--;
    this.cursor++;
    if (this.sceneState && this.sceneState.mode === 'watch') this.sceneState.sceneTick++;
    if (this.done) this._finish();
    return true;
  }

  /** Step playback through SimClock at speed scale (0.5x, 1x, 2x) for dtReal seconds. */
  advanceClock(clock, dtReal, onTick) {
    if (this.paused || this.done) return 0;
    return clock.advance(dtReal, () => {
      if (this.step() && onTick) onTick(this);
    });
  }
}

/**
 * Automated verifier: replays a take via SimClock at requested speed/fps and compares
 * the resulting SimClock digest (plus optional per-tick digests) against the recorded run.
 */
export function verifyTakeDeterminism(take, { scale = 1, fps = 60, perTickExpectedDigests = null } = {}) {
  const player = new ReplayPlayer(take);
  const clock = new SimClock(30);
  clock.setScale(scale);
  const digests = [];
  let firstDiverge = null;
  let guard = 0;
  const maxFrames = Math.max(1000, Math.ceil((take.durationTicks + 10) * (fps / (30 * scale)) * 4));
  while (!player.done && guard++ < maxFrames) {
    clock.advance(1 / fps, () => {
      if (player.step()) {
        const d = simDigest(player.game);
        digests.push(d);
        if (perTickExpectedDigests && firstDiverge === null) {
          const idx = digests.length - 1;
          if (d !== perTickExpectedDigests[idx]) {
            firstDiverge = { tickOffset: idx, liveTick: take.startTick + idx + 1, expected: perTickExpectedDigests[idx], actual: d };
          }
        }
      }
    });
  }
  return {
    done: player.done,
    preludeMatch: player.preludeMatch,
    digestMatch: player.digestMatch,
    expectedStartDigest: take.startDigest,
    actualStartDigest: player.actualStartDigest,
    expectedEndDigest: take.endDigest,
    actualEndDigest: player.actualEndDigest,
    ticksReplayed: digests.length,
    firstDiverge,
    digests,
  };
}
