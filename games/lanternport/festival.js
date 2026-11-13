// Festival Day connective layer: Scene Journal state, in-world trigger positions,
// Festival Day ordered progression, and Play-All Tour order. Pure logic (no DOM/Three.js).

export const FESTIVAL_DAY_ORDER = [
  'rooftop-dive',
  'photo-call',
  'cartop-dance',
  'club-stage',
  'pool-surface',
  'pool-rimsit',
  'pot-rampage',
  'chest-fanfare',
  'dock-fishing',
  'fairy-orbit',
  'cucco-swarm',
];

export const JOURNAL_KEY = 'lanternport.festival.journal.v1';

/** Ordered list of built film/stage scenes for the Play-All Tour. */
export function tourSceneIds(scenes) {
  return scenes.filter((s) => s.id !== 'stage-test').map((s) => s.id);
}

/**
 * Compute world marker positions in metres [x, y, z] from each scene's bookmark.
 * Keeps stage-test's sim-unit pivot scaled to metres and fans out overlapping markers
 * slightly so every registered scene has a distinct, walkable trigger.
 */
export function buildSceneMarkers(scenes, game) {
  const raw = scenes.map((def) => {
    const b = typeof def.bookmark === 'function' ? def.bookmark(game) : def.bookmark;
    const p = b ? b.pivot : [0, 0, 0];
    const isSimUnits = def.id === 'stage-test';
    const x = isSimUnits ? p[0] * 0.01 : p[0];
    const z = isSimUnits ? p[2] * 0.01 : p[2];
    const y = isSimUnits ? 0.05 : p[1] > 4 ? Math.max(0.05, p[1] - 1.25) : 0.05;
    return { id: def.id, title: def.title, x, y, z };
  });

  // Separate markers that land within 1.4m of an earlier marker on the same elevation
  for (let i = 0; i < raw.length; i++) {
    let clashes = 0;
    for (let j = 0; j < i; j++) {
      if (Math.abs(raw[i].y - raw[j].y) < 3 && Math.hypot(raw[i].x - raw[j].x, raw[i].z - raw[j].z) < 1.4) {
        clashes++;
      }
    }
    if (clashes > 0) {
      const ang = clashes * 1.35;
      raw[i].x += Math.cos(ang) * 1.9;
      raw[i].z += Math.sin(ang) * 1.9;
    }
  }
  return raw;
}

/** Persistent Scene Journal state: 'not found' | 'watched' | 'played'. */
export class SceneJournal {
  constructor(storage = null) {
    this.storage = storage;
    this.map = {};
    this.load();
  }

  load() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(JOURNAL_KEY);
      if (raw) this.map = JSON.parse(raw) || {};
    } catch {
      this.map = {};
    }
  }

  save() {
    if (!this.storage) return;
    try {
      this.storage.setItem(JOURNAL_KEY, JSON.stringify(this.map));
    } catch {
      // ignore storage quota errors
    }
  }

  status(id) {
    const s = this.map[id];
    return s === 'played' || s === 'watched' ? s : 'not found';
  }

  markWatched(id) {
    if (!id) return;
    if (this.status(id) === 'not found') {
      this.map[id] = 'watched';
      this.save();
    }
  }

  markPlayed(id) {
    if (!id) return;
    if (this.map[id] !== 'played') {
      this.map[id] = 'played';
      this.save();
    }
  }
}

/** Ordered Festival Day progression across FESTIVAL_DAY_ORDER. */
export class FestivalDayState {
  constructor(order = FESTIVAL_DAY_ORDER) {
    this.order = [...order];
    this.active = false;
    this.index = 0;
    this.watched = new Set();
    this.played = new Set();
    this.complete = false;
  }

  start() {
    this.active = true;
    this.index = 0;
    this.watched.clear();
    this.played.clear();
    this.complete = false;
  }

  stop() {
    this.active = false;
    this.complete = false;
  }

  currentId() {
    return this.active && !this.complete ? this.order[this.index] || null : null;
  }

  recordStop(id, wasPlayed = false) {
    if (!this.active || !id) return;
    this.watched.add(id);
    if (wasPlayed) this.played.add(id);
  }

  advance() {
    if (!this.active) return null;
    if (this.index + 1 < this.order.length) {
      this.index++;
      return this.order[this.index];
    }
    this.active = false;
    this.complete = true;
    return null;
  }

  summary() {
    return {
      total: this.order.length,
      watched: this.watched.size,
      played: this.played.size,
    };
  }
}
