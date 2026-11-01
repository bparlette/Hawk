'use strict';
/* ============================================================
   RUN THE ATLAS — 5-map spike
   One runner auto-runs through real level-map images on ground
   paths extracted offline (tools/extract_paths.py).

   LEVEL LOADING IS A SLIDING WINDOW (design rule, 2026-11-01):
   the catalog may one day hold ~700 levels, so levels are loaded
   in blocks of WINDOW=10 virtual indices. The window manager
   materializes {decoded image + graded canvas + path data} only
   for the current block; when the player completes world 5 of
   the block, the NEXT block is fetched and, once the player has
   crossed into it, the block behind is DROPPED (canvases/images
   released -> memory stays flat). Virtual indices advance
   forever (chain loops); content index = vi mod catalog.length.
   With only 5 maps in this spike the window covers everything,
   but every load/drop decision runs through WindowMgr.
   ============================================================ */

const VH = 720;                 // virtual field height (all physics in this space)
const WINDOW = 10;              // sliding-window block size (worlds)
const PREFETCH_AT = 5;          // entering world #5 (0-based 4->5 boundary: vi-bs>=5) prefetches next block

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const el = id => document.getElementById(id);
const hudWorld = el('hudWorld'), hudPlat = el('hudPlat'), hudRelics = el('hudRelics'), hudChain = el('hudChain');
const cardEl = el('card'), cardT = el('cardT'), cardS = el('cardS');
const flashEl = el('flash'), fadeEl = el('fade'), startEl = el('start'), loadMsg = el('loadMsg');

/* ---------------- catalog + window manager ---------------- */

let catalog = [];               // metadata only (worlds.json)
const N = () => catalog.length;

const WindowMgr = {
  loaded: new Map(),            // ci -> {img, graded, path, ready, promise}
  needed: new Set(),            // cis referenced by the current virtual window

  blockStart(vi) { return Math.floor(vi / WINDOW) * WINDOW; },

  // Which virtual indices must be materialized for a player at virtual index vi.
  virtualRange(vi) {
    const bs = this.blockStart(vi);
    const end = (vi - bs >= PREFETCH_AT) ? bs + 2 * WINDOW : bs + WINDOW;
    const out = [];
    for (let v = bs; v < end; v++) out.push(v);
    return out;
  },

  ci(vi) { const n = N(); return ((vi % n) + n) % n; },

  // Load one content world: path JSON + live image in parallel, then bake the
  // graded offscreen canvas. Nothing outside the window is ever decoded.
  load(ci) {
    if (this.loaded.has(ci)) return this.loaded.get(ci).promise;
    const meta = catalog[ci];
    const entry = { img: null, graded: null, path: null, ready: false, promise: null };
    const imgP = new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = meta.image_url;             // live URL, draw-only (never read back)
    });
    const pathP = fetch(meta.path_file).then(r => r.json());
    entry.promise = Promise.all([imgP, pathP]).then(([img, path]) => {
      entry.img = img;
      entry.path = path;
      entry.graded = gradeImage(img, meta);
      entry.ready = true;
      return entry;
    });
    this.loaded.set(ci, entry);
    return entry.promise;
  },

  // Recompute the window for virtual index vi: fetch what's missing, drop
  // (release) anything no longer referenced by the virtual window.
  sync(vi) {
    const vis = this.virtualRange(vi);
    this.needed = new Set(vis.map(v => this.ci(v)));
    for (const ci of this.needed) this.load(ci);
    for (const ci of [...this.loaded.keys()]) {
      if (!this.needed.has(ci)) {
        const e = this.loaded.get(ci);
        if (e) { e.graded = null; e.img = null; e.path = null; }  // release decode+canvas
        this.loaded.delete(ci);
      }
    }
  },

  entry(vi) { return this.loaded.get(this.ci(vi)); },
};

/* One unifying grade for every map: fixed contrast/saturation/brightness,
   baked into an offscreen canvas at load (vignette is drawn per-frame).
   ROUND 2: only the world's CONTENT BAND is drawn — meta.crop is the
   source-pixel rect the extractor derived (the level band of the sheet,
   without its black margins / credit blocks / printed sub-areas), scaled
   to fill the field. Path geometry lives in the same cropped space. */
function gradeImage(img, meta) {
  const c = document.createElement('canvas');
  c.width = meta.width; c.height = VH;
  const g = c.getContext('2d');
  g.filter = 'contrast(1.07) saturate(1.18) brightness(1.03)';
  const cr = meta.crop;
  if (cr) g.drawImage(img, cr.x, cr.y, cr.w, cr.h, 0, 0, meta.width, VH);
  else g.drawImage(img, 0, 0, meta.width, VH);
  g.filter = 'none';
  return c;
}

/* ---------------- audio (tiny WebAudio blips) ---------------- */

let AC = null;
function audioInit() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(f0, f1, dur, type, vol, delay = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol || 0.04, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(t); o.stop(t + dur + 0.03);
}
const sfx = {
  jump()  { tone(280, 660, 0.09, 'square', 0.035); },
  hop()   { tone(220, 520, 0.08, 'square', 0.025); },
  relic() { tone(880, 880, 0.07, 'sine', 0.06); tone(1318, 1318, 0.11, 'sine', 0.06, 0.075); },
  warp()  { tone(180, 1250, 0.26, 'sawtooth', 0.028); },
  death() { tone(320, 60, 0.18, 'square', 0.03); },
};

/* ---------------- game state ---------------- */

const P = {
  SPEED: 260, GRAV: 2600, GRAV_HOLD: 1150, HOLD_T: 0.26, JUMP_V: 770,
  COYOTE: 0.08, STEP_UP: 30, DROP_SNAP: 46, LAND_TOL: 46,
};

let state = 'loading';          // loading | ready | playing | warping
let vi = 0;                     // virtual world index (advances forever)
let chain = 1;                  // current chain (loop) number, starts at 1
let relicsGot = new Set();      // cis collected on this chain
let deaths = 0, warps = 0;
let camX = 0;
let warpT = 0, fadeT = 0, cardUntil = 0;

const p = {
  x: 0, y: 0, vy: 0, grounded: false, coyote: 0, holdT: 0, jumpBuf: 0,
  runPhase: 0, squash: 0, blockT: 0, hopMul: 0.8, safeX: 0, safeY: 0, dead: false,
};
const input = { held: false };

const cur = () => WindowMgr.entry(vi);
const meta = () => catalog[WindowMgr.ci(vi)];
const speedNow = () => P.SPEED * Math.pow(1.05, chain - 1);

function groundAt(path, x) {
  if (!path || x < 0 || x >= path.width) return null;
  const v = path.ground[Math.floor(x)];
  return (v === null || v === undefined) ? null : v;
}

/* ROUND 2: each world is magnified by `mag` (sheet height / crop height)
   so its level band fills the field. Every spatial physics constant is
   scaled by the current world's mag, which keeps the jump-height /
   feature-height and jump-distance / gap-width ratios exactly where
   round 1 tuned them, in every world. */
const K = () => { const e = cur(); return (e && e.path && e.path.mag) || 1; };

function placeAtSpawn() {
  const e = cur(); if (!e || !e.ready) return;
  const s = e.path.spawn;
  p.x = s.x; p.y = s.y; p.vy = 0; p.grounded = true;
  p.safeX = s.x; p.safeY = s.y; p.blockT = 0; p.hopMul = 0.8; p.dead = false;
  camX = Math.max(0, Math.min(p.x - 200, Math.max(0, e.path.width - viewW())));
}

function showCard(main, sub, ms) {
  cardT.textContent = main; cardS.textContent = sub || '';
  cardEl.classList.add('on');
  cardUntil = performance.now() + ms;
}

function doWarp() {
  if (state !== 'playing') return;
  state = 'warping'; warpT = 0.95;
  warps++; sfx.warp();
  flashEl.style.transition = 'none'; flashEl.style.opacity = '0.85';
  requestAnimationFrame(() => { flashEl.style.transition = 'opacity .5s'; flashEl.style.opacity = '0'; });
  const prevCi = WindowMgr.ci(vi);
  vi++;
  const ci = WindowMgr.ci(vi);
  if (ci === 0 && prevCi !== 0) {           // wrapped the catalog: chain complete
    chain++;
    relicsGot.clear();
  }
  WindowMgr.sync(vi);                        // slide the window (prefetch/drop)
  const e = cur();
  const begin = () => {
    placeAtSpawn();
    showCard(meta().label, meta().platform, 900);
    state = 'playing';
    updateHUD();
  };
  if (e && e.ready) begin();
  else if (e) e.promise.then(begin);
  else begin();
}

function die() {
  if (p.dead) return;
  p.dead = true; deaths++; sfx.death();
  fadeT = 0.34;
  setTimeout(() => {
    p.x = p.safeX; p.y = p.safeY; p.vy = 0; p.grounded = true; p.dead = false;
    camX = Math.max(0, Math.min(p.x - 200, Math.max(0, (cur() ? cur().path.width : 0) - viewW())));
  }, 170);
}

function doJump(mul) {
  p.vy = -P.JUMP_V * K() * (mul || 1);
  p.grounded = false; p.coyote = 0; p.holdT = P.HOLD_T; p.jumpBuf = 0;
  if (mul) sfx.hop(); else sfx.jump();
}

function pressJump() {
  if (state === 'ready') { startGame(); return; }
  if (state !== 'playing' || p.dead) return;
  p.jumpBuf = 0.1;
}
function releaseJump() { p.holdT = 0; }

function startGame() {
  if (state !== 'ready') return;
  audioInit();
  startEl.style.display = 'none';
  state = 'playing';
  showCard(meta().label, meta().platform, 900);
}

/* ---------------- physics ---------------- */

function step(dt) {
  const e = cur(); if (!e || !e.ready || p.dead) return;
  const path = e.path, W = path.width;
  const k = K();
  const spd = speedNow() * k;

  if (p.jumpBuf > 0) p.jumpBuf -= dt;
  if (p.coyote > 0) p.coyote -= dt;
  if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 6);

  if (p.jumpBuf > 0 && (p.grounded || p.coyote > 0)) doJump(0);

  const nx = p.x + spd * dt;

  if (p.grounded) {
    const gy = groundAt(path, nx);
    if (gy === null) {                        // walked off an edge -> over a pit
      p.x = nx; p.grounded = false; p.vy = 0; p.coyote = P.COYOTE;
    } else if (p.y - gy > P.STEP_UP * k) {    // wall too tall to step up
      p.blockT += dt;
      if (p.blockT > 0.35) {                  // stumble-hop so flow never soft-locks
        doJump(p.hopMul);
        p.hopMul = Math.min(1.2, p.hopMul + 0.18);
        p.blockT = 0;
      }
    } else if (gy - p.y > P.DROP_SNAP * k) {  // ledge falls away beneath
      p.x = nx; p.grounded = false; p.vy = 0; p.coyote = P.COYOTE;
    } else {                                  // follow the contour
      p.x = nx; p.y = gy; p.blockT = 0; p.hopMul = 0.8;
    }
    if (p.grounded) {
      p.runPhase += spd * dt * 0.055;
      // remember a safe respawn spot: solid ground under and around
      if (groundAt(path, p.x - 18) !== null && groundAt(path, p.x + 18) !== null) {
        p.safeX = p.x; p.safeY = p.y;
      }
    }
  } else {
    p.x = nx;                                 // airborne: always advance
    const holding = input.held && p.vy < 0 && p.holdT > 0;
    if (holding) p.holdT -= dt;
    p.vy += (holding ? P.GRAV_HOLD : P.GRAV) * k * dt;
    p.y += p.vy * dt;
    const gy = groundAt(path, p.x);
    if (p.vy >= 0 && gy !== null && p.y >= gy - 6 && p.y - gy <= P.LAND_TOL * k) {
      p.y = gy; p.vy = 0; p.grounded = true; p.squash = 1; p.blockT = 0; p.hopMul = 0.8;
    }
    if (p.y > VH + 60) die();
  }

  // relic pickup (one per world per chain)
  const ci = WindowMgr.ci(vi);
  const r = path.relic;
  if (!relicsGot.has(ci) && Math.abs(p.x - r.x) < 30 * k && Math.abs((p.y - 24) - (r.y - 30)) < 40 * k) {
    relicsGot.add(ci); sfx.relic(); updateHUD();
  }

  // warp at the right edge
  if (p.x >= W - 26 * k) doWarp();
}

/* ---------------- rendering ---------------- */

let VW = 0, VHpx = 0, DPR = 1, vignette = null;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = window.innerWidth; VHpx = window.innerHeight;
  canvas.width = VW * DPR; canvas.height = VHpx * DPR;
  canvas.style.width = VW + 'px'; canvas.style.height = VHpx + 'px';
  vignette = document.createElement('canvas');
  vignette.width = VW; vignette.height = VHpx;
  const v = vignette.getContext('2d');
  const rad = v.createRadialGradient(VW / 2, VHpx / 2, Math.min(VW, VHpx) * 0.42, VW / 2, VHpx / 2, Math.max(VW, VHpx) * 0.78);
  rad.addColorStop(0, 'rgba(8,6,20,0)');
  rad.addColorStop(1, 'rgba(8,6,20,0.32)');
  v.fillStyle = rad; v.fillRect(0, 0, VW, VHpx);
  const lin = v.createLinearGradient(0, 0, 0, VHpx);
  lin.addColorStop(0, 'rgba(8,6,20,0.12)'); lin.addColorStop(0.18, 'rgba(8,6,20,0)');
  lin.addColorStop(0.85, 'rgba(8,6,20,0)'); lin.addColorStop(1, 'rgba(8,6,20,0.14)');
  v.fillStyle = lin; v.fillRect(0, 0, VW, VHpx);
}
window.addEventListener('resize', resize);
function viewW() { return VW / (VHpx / VH); }   // visible world width in 720-space

function drawRunner(sx, sy) {
  const t = performance.now() / 1000;
  ctx.save();
  ctx.translate(sx, sy);
  const sq = p.squash;
  ctx.scale(1 + 0.10 * sq, 1 - 0.16 * sq);
  if (p.grounded) ctx.rotate(0.05); else ctx.rotate(0.13);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const ph = p.runPhase;
  // gold backpack (drawn first, behind body)
  ctx.beginPath();
  ctx.fillStyle = '#ffc400'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.roundRect(-17, -39, 8, 15, 3); ctx.fill(); ctx.stroke();
  // legs
  ctx.strokeStyle = '#26306e'; ctx.lineWidth = 6;
  if (p.grounded) {
    const a = Math.sin(ph), b = Math.sin(ph + Math.PI);
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(a * 11, -2 - Math.max(0, b) * 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(b * 11, -2 - Math.max(0, a) * 5); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-8, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(7, -11); ctx.stroke();
  }
  // body — bold orange, white outline
  ctx.beginPath();
  ctx.fillStyle = '#ff8c1a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.roundRect(-10, -41, 21, 22, 7); ctx.fill(); ctx.stroke();
  // arm swing
  ctx.strokeStyle = '#ff8c1a'; ctx.lineWidth = 5;
  const arm = p.grounded ? Math.sin(ph + Math.PI) * 7 : -8;
  ctx.beginPath(); ctx.moveTo(4, -36); ctx.lineTo(4 + arm, -24); ctx.stroke();
  // head + cap
  ctx.beginPath();
  ctx.fillStyle = '#ffd9b3'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.arc(2, -49, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = '#ff8c1a';
  ctx.arc(2, -50.5, 9.5, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  ctx.fillRect(2, -53.5, 13, 3.6);
  // eye
  ctx.beginPath(); ctx.fillStyle = '#1c2340';
  ctx.arc(6.5, -48.5, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  void t;
}

function draw() {
  const s = VHpx / VH;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#0b0e1a'; ctx.fillRect(0, 0, VW, VHpx);
  const e = cur();
  if (e && e.ready) {
    const W = e.path.width, vw = viewW();
    let target = p.x - vw * 0.35;
    target = Math.max(0, Math.min(target, Math.max(0, W - vw)));
    if (W <= vw) target = -(vw - W) / 2;
    camX += (target - camX) * 0.18;
    if (Math.abs(target - camX) < 0.05) camX = target;
    ctx.save();
    ctx.scale(s, s);
    ctx.translate(-camX, 0);
    ctx.drawImage(e.graded, 0, 0);
    // relic — small golden diamond hovering on the path
    const ci = WindowMgr.ci(vi), r = e.path.relic;
    if (!relicsGot.has(ci)) {
      const bob = Math.sin(performance.now() / 280) * 4;
      const rx = r.x, ry = r.y - 30 + bob;
      ctx.save();
      ctx.translate(rx, ry); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffc400'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      const R = 9 + Math.sin(performance.now() / 200) * 1.2;
      ctx.beginPath(); ctx.rect(-R / 1.4, -R / 1.4, R * 1.43, R * 1.43); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    drawRunner(p.x, p.y);
    ctx.restore();
  }
  if (vignette) ctx.drawImage(vignette, 0, 0);
}

let lastT = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, lastT ? (t - lastT) / 1000 : 0.016);
  lastT = t;
  if (state === 'playing') step(dt);
  else if (state === 'warping') { /* frozen behind the flash/card */ }
  if (fadeT > 0) {
    fadeT -= dt;
    const a = fadeT > 0.17 ? (0.34 - fadeT) / 0.17 : fadeT / 0.17;
    fadeEl.style.opacity = String(Math.max(0, Math.min(1, a)));
    if (fadeT <= 0) fadeEl.style.opacity = '0';
  }
  if (cardUntil && performance.now() > cardUntil) { cardEl.classList.remove('on'); cardUntil = 0; }
  draw();
  syncAtlas();
}

/* ---------------- HUD + test hooks ---------------- */

function updateHUD() {
  const m = meta(); if (!m) return;
  hudWorld.textContent = m.label;
  hudPlat.textContent = m.platform;
  hudRelics.textContent = relicsGot.size + '/' + N();
  hudChain.textContent = chain;
}
const atlas = { world: 1, x: 0, relics: 0, chain: 1, deaths: 0, warps: 0, state: 'loading', mag: 1,
                next() { if (state === 'playing') doWarp(); } };
window.__atlas = atlas;
function syncAtlas() {
  atlas.world = WindowMgr.ci(vi) + 1;
  atlas.mag = K();
  atlas.x = Math.round(p.x);
  atlas.relics = relicsGot.size;
  atlas.chain = chain;
  atlas.deaths = deaths;
  atlas.warps = warps;
  atlas.state = state;
  atlas.windowLoaded = [...WindowMgr.loaded.keys()].map(ci => ci + 1);  // debug: which worlds are materialized
}

/* ---------------- input ---------------- */

window.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    audioInit();
    if (!e.repeat) { input.held = true; pressJump(); }
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    input.held = false; releaseJump();
  }
});
window.addEventListener('pointerdown', () => { audioInit(); input.held = true; pressJump(); });
window.addEventListener('pointerup', () => { input.held = false; releaseJump(); });
window.addEventListener('blur', () => { input.held = false; });

/* ---------------- boot ---------------- */

resize();
fetch('worlds.json').then(r => r.json()).then(data => {
  catalog = data.worlds;
  WindowMgr.sync(0);                       // load ONLY the first window block
  const e0 = WindowMgr.entry(0);
  const ready = () => {
    placeAtSpawn();
    updateHUD();
    state = 'ready'; syncAtlas();
    loadMsg.textContent = 'worlds loaded — the window holds ' + WindowMgr.loaded.size + ' of them';
  };
  if (e0 && e0.ready) ready(); else if (e0) e0.promise.then(ready);
}).catch(err => { loadMsg.textContent = 'load failed: ' + err; });

requestAnimationFrame(frame);
