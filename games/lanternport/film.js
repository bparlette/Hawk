// FILM-IT mode: the player is the camera operator of a fake livestream. Pure logic (no DOM, no three.js) so it is
// testable headless, like capture.js. The page projects the staged hero into the 9:16 viewfinder each sim tick and
// feeds the numbers here; nothing in this file touches the sim, the scene runner or the digest — filming is read-only.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * One tick of framing quality, 0..1, from viewfinder coordinates.
 *   fx, fy   hero centre in viewfinder space: (0, 0) is the middle of the 9:16 frame, ±1 is its edge.
 *   visible  the hero is on stage and in front of the camera (false while she is underwater / off stage).
 *   fracH    the hero's height as a fraction of the viewfinder height. Sweet range 0.28..0.62: big enough to
 *            read her face and kit, small enough that she is not cropped by the frame.
 *   camMove  how much the camera moved this tick (radians of yaw+pitch change + relative dolly), for smoothness.
 * Returns the combined quality plus the three sub-scores, so the page can tell the operator what to fix.
 */
export function frameQuality({ fx, fy, visible, fracH, camMove }) {
  if (!visible) return { q: 0, center: 0, size: 0, smooth: 1 };
  // Centre: she wants to sit mid-frame, a touch above the middle (headroom for the dive). Elliptical falloff,
  // a little stricter vertically; full marks inside the middle zone, zero a full frame-width past the edge.
  const d = Math.hypot(fx, (fy - 0.08) * 1.15);
  const center = clamp(1 - Math.max(0, d - 0.3) / 0.85, 0, 1);
  // Size: ramp up from a speck, flat across the sweet range, then a gentler fall as she overflows the frame.
  const size = fracH <= 0.28 ? clamp((fracH - 0.07) / 0.21, 0, 1) : fracH <= 0.62 ? 1 : clamp(1 - (fracH - 0.62) / 0.9, 0.25, 1);
  // Smoothness: a locked-off or gently drifting phone is full marks; a whip pan is worthless footage.
  const smooth = clamp(1 - (camMove || 0) / 0.055, 0, 1);
  const q = Math.pow(center, 1.4) * (0.3 + 0.7 * size) * (0.5 + 0.5 * smooth);
  return { q: clamp(q, 0, 1), center, size, smooth };
}

/** Running score for one take of a scene: accumulates per-tick quality, remembers the best single frame. */
export class FilmRun {
  constructor() { this.reset(); }
  reset() { this.sum = 0; this.n = 0; this.last = 0; this.best = 0; this.bestTick = -1; this.goodStreak = 0; this.lostStreak = 0; }
  /** Feed one sim tick of quality (0..1) at scene tick t. */
  add(q, t) {
    this.sum += q; this.n++; this.last = q;
    if (q >= this.best) { this.best = q; this.bestTick = t; } // ties refresh: the freshest best frame is the thumbnail
    if (q >= 0.6) { this.goodStreak++; this.lostStreak = 0; } else if (q <= 0.2) { this.lostStreak++; this.goodStreak = 0; } else { this.goodStreak = 0; this.lostStreak = 0; }
  }
  /** The headline number, 0..100: the take's average framing, as a grade. */
  get score() { return this.n ? Math.round((this.sum / this.n) * 100) : 0; }
  get framing() { return this.last; }
}

/**
 * The fake audience. Viewers drift toward a target set by how good the footage is (cubed, so only genuinely
 * good framing pulls a crowd), and scene events can spike the count. hype is a smoothed quality the page can
 * use for badge colour / chat rate. Deterministic: same quality sequence, same crowd.
 */
export class Audience {
  constructor() { this.viewers = 12; this.hype = 0; }
  update(q, ticks = 1) {
    const target = 14 + Math.pow(q, 3) * 900;
    const k = Math.min(1, 0.025 * ticks);
    this.viewers += (target - this.viewers) * k;
    this.hype += (q - this.hype) * Math.min(1, 0.06 * ticks);
    return this.viewers;
  }
  /** A big moment (the splash) pulls a surge of new viewers in. */
  boost(mult = 1.3, add = 25) { this.viewers = this.viewers * mult + add; return this.viewers; }
}

/** Chat lines by situation. Original and generic; selection is a counter walk, never Math.random. */
export const CHAT = {
  good: ['W camera work', "she's perfectly framed rn", 'this is the shot!!', 'steady hands, respect', 'cinematic honestly', 'framing is ELITE', 'you are hired as cameraman', 'the composition?? immaculate'],
  lost: ['where did she go??', 'camera?? hello?', 'bro lost her', 'aim the phone at the POOL', 'this stream is just sky now', 'my grandma frames better than this', 'she left the stream 😭'],
  idle: ['this rooftop is so pretty', 'festival day best day', 'first time catching the dive live', 'that pool is on a ROOF?', 'hi from the plaza', 'the gulls are paid actors', 'best seat in lanternport'],
  events: {
    hold: ['she is UP there', 'places everyone…'],
    strut: ['THE STRUT', 'she owns that board'],
    'bounce-1': ['first bounce…', 'board is FLEXING'],
    'bounce-2': ['BIGGER', 'one more bounce and she flies'],
    leap: ['SHE SENT IT', 'AIRBORNE'],
    splash: ['THE SPLASHHH', 'CANNONBALL OF THE CENTURY', 'clip it. CLIP IT.', 'the sunbathers got SOAKED lol', 'instant replay please', '💦💦💦'],
    surface: ['she lives!!', 'that laugh, she loves it'],
    'rim-sit': ['cap wringing, iconic', 'and she sticks the landing'],
    grin: ['THE GRIN', 'he cracked, everybody saw'],
    'flash-storm': ['so many flashes', 'paparazzi going feral'],
    end: ['gg', 'same time tomorrow?', 'W stream'],
  },
};
export class ChatFeed {
  constructor() { this.counters = {}; }
  _pick(pool, key) { const i = this.counters[key] || 0; this.counters[key] = i + 1; return pool[(i * 7 + pool.length) % pool.length]; }
  /** A line for a scene event name, or null if this event has none. */
  event(name) { const p = CHAT.events[name]; return p ? this._pick(p, 'ev:' + name) : null; }
  /** A line for the current framing streak: good >= 0 is praise, lost is a roast. */
  streak(kind) { return kind === 'good' ? this._pick(CHAT.good, 'good') : this._pick(CHAT.lost, 'lost'); }
  idle() { return this._pick(CHAT.idle, 'idle'); }
}
