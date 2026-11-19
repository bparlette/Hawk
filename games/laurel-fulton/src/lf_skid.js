// lf_skid.js — tyre marks, STOLEN from Palm City (games/palm-city/src/skid.js, Fable's module) and
// adapted to Laurel's world (Moth, Nov 17, at the owner's direction: "GTA remake already did a lot
// of the donuts and skid marks — steal it"). Adaptations: the world here is CENTRED (negative
// coordinates), so the coverage grid is offset by the world bounds and tile keys are biased;
// surfaces are GraphWorld's ('ground' is the soft one — grass tears brown; there is no sand or
// water); surfaceAt takes a layer. Everything else — slip model, ring buffer, tile renderer —
// is Palm City's, verbatim where it fits.
//
// The sim decides WHEN tyres are slipping and writes short mark segments into a fixed ring
// buffer; the renderer (TrackLayer) stamps each segment once onto a capped set of ground tiles
// drawn under the cars, and fades those tiles slowly.
//
// Slipping means one of: cornering hard at speed (lateral load), braking hard, a hard launch,
// a burnout / donut (full lock + throttle at low speed), or churning through grass.
// Calm, straight driving lays nothing.

export const SEGS = 2048;            // ring buffer of mark segments (x0,y0,x1,y1,width,alpha,soft)
export const CELL = 8;               // coverage grid cell, world units (headless proof + cheap queries)
export const TILE = 256;             // track tile size in world units, 1 px per unit
export const TILE_CAP = 24;          // at most 24 tiles alive (24 x 256x256 px = 6.3 MB), oldest reused
const N = 7;

export function initSkid(sim) {
  const B = sim.W.bounds;
  sim.skid = { buf: new Float32Array(SEGS * N), w: 0, ox: B.x0, oy: B.y0, gw: Math.ceil((B.x1 - B.x0) / CELL), gh: Math.ceil((B.y1 - B.y0) / CELL), grid: null, cover: 0 };
  sim.skid.grid = new Uint8Array(sim.skid.gw * sim.skid.gh);
}

// How hard the tyres are slipping (0..1) and whether the fronts are marking too. (Palm City's
// slipOf, unchanged — gm (sim.gripMul, default 1) scales the cornering thresholds.)
export function slipOf(c, throttle, steer, grip, soft, gm = 1) {
  const v = Math.abs(c.v), lat = v * Math.abs(steer) * 2.7 * grip;      // lateral load: speed x yaw rate
  let s = 0, front = false;
  if (lat > 430 * gm) { s = Math.min(1, 0.35 + (lat - 430 * gm) / 300); front = lat > 600 * gm; }     // cornering at speed; a real drift marks all four
  if (throttle * c.v < 0 && v > 90) { s = Math.max(s, 0.85); front = true; }          // hard braking
  if (throttle > 0.7 && c.v >= 0 && v < 70) s = Math.max(s, 0.75 * (1 - v / 70) + 0.15);   // hard launch
  if (Math.abs(steer) > 0.9 && throttle > 0.45 && v > 12 && v < 130) c.spinT = 0.35;   // burnout / donut: full lock under power
  if (c.spinT > 0 && Math.abs(steer) > 0.9 && v > 12 && v < 130) s = Math.max(s, 0.9);
  if (soft && v > 60) s = Math.max(s, 0.55);                                          // grass always carves
  return front ? -s : s;                                                              // sign carries the "fronts too" flag
}

function put(sim, x0, y0, x1, y1, width, alpha, soft) {
  const K = sim.skid, i = (K.w % SEGS) * N, b = K.buf;
  b[i] = x0; b[i + 1] = y0; b[i + 2] = x1; b[i + 3] = y1; b[i + 4] = width; b[i + 5] = alpha; b[i + 6] = soft;
  K.w++;
  const gx = ((x1 - K.ox) / CELL) | 0, gy = ((y1 - K.oy) / CELL) | 0;
  if (gx >= 0 && gy >= 0 && gx < K.gw && gy < K.gh) { const k = gy * K.gw + gx; if (!K.grid[k]) { K.grid[k] = 1; K.cover++; } }
}

// Called once per step for a car that may mark. Wheel positions are remembered on the car so each
// segment joins the last: the marks follow the car's real path.
// Returns the step's slip magnitude (0..1) — lf_drift.js banks the player's drifts off this
// exact number, so there is only ever one slip detector.
export function layMarks(sim, c, throttle, steer, grip, dt, gm) {
  if (c.spinT > 0) c.spinT -= dt;
  const W = sim.W, surf = W.surfaceAt(c.x, c.y, c.layer), soft = surf === 'ground';
  let s = slipOf(c, throttle, steer, grip, soft, gm !== undefined ? gm : (sim.gripMul || 1));
  const front = s < 0; s = Math.abs(s);
  const wp = c.wheels || (c.wheels = new Float32Array(8));
  const ca = Math.cos(c.h), sa = Math.sin(c.h), ax = c.len * 0.3, ay = c.wid * 0.36, tw = Math.max(2.2, c.wid * 0.15);
  for (let k = 0; k < 4; k++) {
    const u = k < 2 ? -ax : ax, v = k % 2 ? ay : -ay;
    const x = c.x + ca * u - sa * v, y = c.y + sa * u + ca * v, bit = 1 << k;
    const on = s > 0.12 && (k < 2 || front);
    if (on && (c.skidOn & bit)) {
      const dx = x - wp[k * 2], dy = y - wp[k * 2 + 1], d2 = dx * dx + dy * dy;
      if (d2 > 0.04 && d2 < 400) put(sim, wp[k * 2], wp[k * 2 + 1], x, y, tw, s, soft ? 2 : 0);
    }
    wp[k * 2] = x; wp[k * 2 + 1] = y;
    c.skidOn = on ? (c.skidOn | bit) : (c.skidOn & ~bit);
  }
  return s;
}

// ------------------------------------------------------------------------------- render side
// A capped pool of 256 px tiles. Segments are stamped once as soft painted strokes; nothing is
// redrawn per frame except blitting the tiles in view. One tile is faded every FADE_EVERY seconds
// in rotation, so marks thin out over a couple of minutes. (Palm City's TrackLayer; the tile key
// is biased so negative tile coordinates — Laurel's centred world — stay unique.)
const FADE_EVERY = 0.12, FADE = 0.035;
export class TrackLayer {
  constructor(makeCanvas) {
    this.tiles = [];                                  // { cv, g, key, used }
    for (let i = 0; i < TILE_CAP; i++) { const cv = makeCanvas(TILE, TILE); this.tiles.push({ cv, g: cv.getContext('2d'), key: -1, used: 0 }); }
    this.byKey = new Map();
    this.r = 0; this.tick = 0; this.fadeT = 0; this.fadeI = 0; this.sim = null;
  }

  tile(tx, ty, make) {
    const key = (ty + 4096) * 8192 + (tx + 4096);
    let t = this.byKey.get(key);
    if (t) { t.used = ++this.tick; return t; }
    if (!make) return null;
    t = this.tiles[0];
    for (const o of this.tiles) { if (o.key < 0) { t = o; break; } if (o.used < t.used) t = o; }   // free tile, else the least recently touched
    if (t.key >= 0) this.byKey.delete(t.key);
    t.g.setTransform(1, 0, 0, 1, 0, 0); t.g.globalCompositeOperation = 'source-over'; t.g.globalAlpha = 1;
    t.g.clearRect(0, 0, TILE, TILE);
    t.key = key; t.used = ++this.tick; this.byKey.set(key, t);
    return t;
  }

  stroke(t, tx, ty, b, i) {
    const g = t.g, ox = tx * TILE, oy = ty * TILE, soft = b[i + 6], a = b[i + 5], w = b[i + 4];
    g.lineCap = 'round';
    // a wide soft pass under a darker core: reads as a dragged brush, not a vector line
    g.strokeStyle = soft === 2 ? '#5a4326' : '#241a2c';
    g.globalAlpha = a * (soft ? 0.2 : 0.16); g.lineWidth = w * 2.1;
    g.beginPath(); g.moveTo(b[i] - ox, b[i + 1] - oy); g.lineTo(b[i + 2] - ox, b[i + 3] - oy); g.stroke();
    g.globalAlpha = a * (soft ? 0.42 : 0.5); g.lineWidth = w;
    g.beginPath(); g.moveTo(b[i] - ox, b[i + 1] - oy); g.lineTo(b[i + 2] - ox, b[i + 3] - oy); g.stroke();
  }

  // stamp every segment written since last frame
  drain(sim) {
    const K = sim.skid;
    if (this.sim !== sim) { this.sim = sim; this.r = K.w; for (const t of this.tiles) { t.key = -1; } this.byKey.clear(); }   // new run: clean ground
    if (K.w - this.r > SEGS) this.r = K.w - SEGS;
    const b = K.buf;
    for (; this.r < K.w; this.r++) {
      const i = (this.r % SEGS) * N, pad = b[i + 4] * 1.2 + 1;
      const x0 = Math.min(b[i], b[i + 2]) - pad, x1 = Math.max(b[i], b[i + 2]) + pad, y0 = Math.min(b[i + 1], b[i + 3]) - pad, y1 = Math.max(b[i + 1], b[i + 3]) + pad;
      for (let ty = Math.floor(y0 / TILE); ty <= Math.floor(y1 / TILE); ty++)
        for (let tx = Math.floor(x0 / TILE); tx <= Math.floor(x1 / TILE); tx++)
          this.stroke(this.tile(tx, ty, true), tx, ty, b, i);
    }
  }

  draw(g, sim, dt, vx0, vy0, vx1, vy1) {
    if (!sim.skid) return;
    this.drain(sim);
    this.fadeT += dt;
    if (this.fadeT > FADE_EVERY) {                       // one tile per tick, round-robin
      this.fadeT = 0;
      const t = this.tiles[this.fadeI++ % TILE_CAP];
      if (t.key >= 0) { t.g.globalCompositeOperation = 'destination-out'; t.g.globalAlpha = FADE; t.g.fillStyle = '#000'; t.g.fillRect(0, 0, TILE, TILE); t.g.globalCompositeOperation = 'source-over'; }
    }
    for (let ty = Math.floor(vy0 / TILE); ty <= Math.floor(vy1 / TILE); ty++)
      for (let tx = Math.floor(vx0 / TILE); tx <= Math.floor(vx1 / TILE); tx++) {
        const t = this.tile(tx, ty, false);
        if (t) g.drawImage(t.cv, tx * TILE, ty * TILE, TILE, TILE);
      }
  }
}
