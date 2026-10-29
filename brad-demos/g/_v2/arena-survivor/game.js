'use strict';
/*
 * NEON SWARM — 90s arcade arena brawler / survivor.
 *
 * Vampire Survivors mechanics on an arcade-brawler feel layer:
 *   - flocking horde (seek + separation) on a SPATIAL HASH, plain circle
 *     math — no per-enemy physics areas
 *   - object POOLS for enemies, projectiles, XP gems, particles, texts
 *   - WaveDirector: 60s waves, point budgets (100 pts wave 1, x1.6/wave)
 *   - auto-firing WeaponSlots: MeleeAura pulse + nearest-target AutoBlaster
 *   - XP gems -> level-up DRAFT of 3 upgrade cards
 *   - juice: hit-stop on kills, shake on tank kills only, damage numbers,
 *     hit-flash, knockback, particles — and the game's real synth audio
 *
 * ?auto=1 runs a kiting bot (spectate / filming mode). window.__dbg
 * exposes live state for verification.
 *
 * Mobile controls follow the gamepress touch standard (docs/TOUCH.md):
 * kit gptouch.js — floating stick on the left half, A/B buttons
 * bottom-right, merged with the keyboard below.
 */
import { TouchController, isTouchDevice } from './gptouch.js';

// ---------------------------------------------------------------- utils
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const AUTO = new URLSearchParams(location.search).get('auto') === '1';

// ---------------------------------------------------------------- config
const WORLD = 3200;              // square arena, world units
const STEP = 1 / 60;             // fixed timestep
const ENEMY_CAP = 230;

const ENEMY_TYPES = {
  drone:   { r: 14, hp: 10,  speed: 100, dmg: 7,  xp: 1, cost: 2,  color: '#ff3d7f', dark: '#8f1440' },
  flanker: { r: 11, hp: 6,   speed: 160, dmg: 6,  xp: 1, cost: 5,  color: '#2ee6ff', dark: '#0f6d80' },
  tank:    { r: 27, hp: 120, speed: 47,  dmg: 16, xp: 5, cost: 20, color: '#ff9f2e', dark: '#8a5312' },
};

// ---------------------------------------------------------------- canvas
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = window.innerWidth; VH = window.innerHeight;
  canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener('resize', resize); resize();

// ---------------------------------------------------------------- pools
class Pool {
  constructor(n, make) {
    this.items = []; this.free = [];
    for (let i = 0; i < n; i++) { const o = make(); o.active = false; this.items.push(o); this.free.push(o); }
  }
  obtain() { const o = this.free.pop(); if (!o) return null; o.active = true; return o; }
  release(o) { if (o && o.active) { o.active = false; this.free.push(o); } }
  each(fn) { for (const o of this.items) if (o.active) fn(o); }
  count() { return this.items.length - this.free.length; }
  reset() { this.free.length = 0; for (const o of this.items) { o.active = false; this.free.push(o); } }
}

const enemies = new Pool(260, () => ({
  type: 'drone', x: 0, y: 0, vx: 0, vy: 0, kvx: 0, kvy: 0, r: 14,
  hp: 10, maxHp: 10, speed: 100, dmg: 7, xpVal: 1, flashT: 0, touchCd: 0, wob: Math.random() * TAU,
}));
const projectiles = new Pool(300, () => ({ x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 5, dmg: 8, life: 0 }));
const gems = new Pool(340, () => ({ x: 0, y: 0, vx: 0, vy: 0, val: 1, wob: Math.random() * TAU }));
const particles = new Pool(260, () => ({ x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.4, size: 3, color: '#fff', rot: 0, vr: 0 }));
const texts = new Pool(64, () => ({ x: 0, y: 0, t: 0, life: 0.7, txt: '', color: '#fff', big: false }));
const rings = new Pool(16, () => ({ x: 0, y: 0, r: 0, maxR: 90, t: 0, life: 0.28, color: '#2ee6ff' }));

// ---------------------------------------------------------------- spatial hash
const HCELL = 64;
const hash = new Map();
const hkey = (cx, cy) => (cx + 64) * 4096 + (cy + 64);
function hashRebuild() {
  hash.clear();
  enemies.each(e => {
    const k = hkey(Math.floor(e.x / HCELL), Math.floor(e.y / HCELL));
    let arr = hash.get(k); if (!arr) { arr = []; hash.set(k, arr); }
    arr.push(e);
  });
}
function hashQuery(x, y, r, fn) {
  const x0 = Math.floor((x - r) / HCELL), x1 = Math.floor((x + r) / HCELL);
  const y0 = Math.floor((y - r) / HCELL), y1 = Math.floor((y + r) / HCELL);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const arr = hash.get(hkey(cx, cy)); if (!arr) continue;
    for (const e of arr) fn(e);
  }
}

// ---------------------------------------------------------------- player & game state
const player = {
  x: WORLD / 2, y: WORLD / 2, r: 14, face: 0, moving: false,
  hp: 100, maxHp: 100, ifr: 0,
  speedMul: 1, dmgMul: 1, projCount: 1, magnetR: 78, auraR: 96, auraDmgMul: 1, cdMul: 1,
  blasterCd: 0, auraCd: 1.2,
};
const BASE = { speed: 232, blasterDmg: 8, blasterRate: 0.42, auraDmg: 15, auraRate: 2.4 };

let state = 'splash';           // splash | play | draft | over
let cam = { x: 0, y: 0 };
let level = 1, xp = 0, pendingDrafts = 0;
let kills = 0, totalTime = 0, gemsGot = 0, pickupCombo = 0, comboT = 0;
let hitstop = 0, shake = 0, hurtFx = 0;
let fpsEMA = 60;

const xpNeed = lvl => Math.round(6 + (lvl - 1) * 5 + (lvl - 1) * (lvl - 1) * 2.2);

// ---------------------------------------------------------------- wave director
const director = {
  wave: 1, waveT: 0, budget: 100, bank: 0, vault: 0, spent: 0, spawnClock: 0,
  budgetFor(w) { return Math.round(100 * Math.pow(1.6, w - 1)); },
  reset() {
    this.wave = 1; this.waveT = 0; this.budget = this.budgetFor(1);
    this.spent = 10; this.bank = 10; this.vault = 0; this.spawnClock = 0; // opening pack, counted in the budget
  },
  update(dt) {
    this.waveT += dt;
    if (this.waveT >= 60) {
      this.waveT = 0; this.wave++; this.budget = this.budgetFor(this.wave);
      this.spent = 0;
      const seed = Math.max(0, 12 - this.bank); // opening pack, counted in the new budget
      this.bank += seed; this.spent += seed;
    }
    // Points accrue across the whole wave (no dead tail). 75% flow into the
    // general bank (buys drones); 25% are RESERVED in a vault that saves up
    // for flankers and tanks — if one pool bought everything the moment it
    // could afford a drone, the pricey types would never spawn at all.
    const room = this.budget - this.spent - this.bank - this.vault;
    if (room > 0) {
      // rising spend curve: gentle open, ~1.5x pressure by wave end, and the
      // budget lasts the full 60s — no dead tail before the next wave
      const rate = (this.budget / 60) * (0.55 + 0.95 * (this.waveT / 60));
      const gain = Math.min(rate * dt, room);
      this.bank += gain * 0.75; this.vault += gain * 0.25;
    }
    this.spawnClock -= dt;
    if (this.spawnClock <= 0) { this.spawnClock = 0.3; this.spend(); }
  },
  spend() {
    // special purchases from the vault
    if (enemies.count() < ENEMY_CAP) {
      if (this.vault >= ENEMY_TYPES.tank.cost && this.wave >= 2) {
        this.spawnOne('tank'); this.vault -= ENEMY_TYPES.tank.cost; this.spent += ENEMY_TYPES.tank.cost;
      } else if (this.vault >= ENEMY_TYPES.flanker.cost &&
                 (this.wave < 2 || this.vault < 12)) {
        // wave 2+: once the vault holds 12+, it stops buying flankers and
        // saves the rest of the way to a tank (20) — a probabilistic leak
        // drained it as fast as it filled and the tank never came
        this.spawnOne('flanker'); this.vault -= ENEMY_TYPES.flanker.cost; this.spent += ENEMY_TYPES.flanker.cost;
      }
    }
    // general purchases: drones
    let bought = 0;
    while (this.bank >= ENEMY_TYPES.drone.cost && bought < 5 && enemies.count() < ENEMY_CAP) {
      this.spawnOne('drone'); this.bank -= ENEMY_TYPES.drone.cost; this.spent += ENEMY_TYPES.drone.cost; bought++;
    }
  },
  spawnOne(type) {
    const e = enemies.obtain(); if (!e) return;
    const t = ENEMY_TYPES[type];
    const p = spawnPos();
    const hpMul = 1 + (this.wave - 1) * 0.30;
    e.type = type; e.x = p.x; e.y = p.y; e.vx = 0; e.vy = 0; e.kvx = 0; e.kvy = 0;
    e.r = t.r; e.maxHp = e.hp = Math.round(t.hp * hpMul);
    e.speed = t.speed * Math.min(1.25, 1 + (this.wave - 1) * 0.02);
    e.dmg = t.dmg; e.xpVal = t.xp; e.flashT = 0; e.touchCd = 0; e.wob = Math.random() * TAU;
  },
};
function spawnPos() {
  const R = Math.hypot(VW, VH) / 2 + 70;
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * TAU;
    const x = clamp(player.x + Math.cos(a) * R, 26, WORLD - 26);
    const y = clamp(player.y + Math.sin(a) * R, 26, WORLD - 26);
    if (x < cam.x - 34 || x > cam.x + VW + 34 || y < cam.y - 34 || y > cam.y + VH + 34) return { x, y };
  }
  return { x: player.x < WORLD / 2 ? WORLD - 30 : 30, y: clamp(player.y, 30, WORLD - 30) };
}

// ---------------------------------------------------------------- fx helpers
function burst(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const p = particles.obtain(); if (!p) return;
    const a = Math.random() * TAU, s = rand(speed * 0.25, speed);
    p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
    p.t = 0; p.life = rand(0.25, 0.55); p.size = rand(2, 4.6); p.color = color;
    p.rot = Math.random() * TAU; p.vr = rand(-9, 9);
  }
}
function floatText(x, y, txt, color, big) {
  const t = texts.obtain(); if (!t) return;
  t.x = x + rand(-6, 6); t.y = y - 8; t.t = 0; t.life = big ? 0.95 : 0.7; t.txt = txt; t.color = color; t.big = !!big;
}

// ---------------------------------------------------------------- combat
function hitEnemy(e, dmg, kx, ky) {
  if (!e.active) return; // already killed this step (stale spatial-hash entry)
  e.hp -= dmg; e.flashT = 0.09;
  e.kvx += kx; e.kvy += ky;
  floatText(e.x, e.y - e.r, String(Math.round(dmg)), e.type === 'tank' ? '#ffd94a' : '#e8f4ff', e.type === 'tank');
  burst(e.x, e.y, ENEMY_TYPES[e.type].color, 3, 130);
  Snd.hit();
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  kills++;
  hitstop = Math.max(hitstop, 0.04);                    // ~40ms freeze on every kill
  if (e.type === 'tank') { shake = Math.max(shake, 7); Snd.kill(true); }
  else Snd.kill(false);
  burst(e.x, e.y, ENEMY_TYPES[e.type].color, e.type === 'tank' ? 18 : 10, e.type === 'tank' ? 240 : 190);
  burst(e.x, e.y, '#ffffff', 4, 120);
  const g = gems.obtain();
  if (g) { g.x = e.x; g.y = e.y; g.vx = rand(-30, 30); g.vy = rand(-30, 30); g.val = e.xpVal; g.wob = Math.random() * TAU; }
  enemies.release(e);
}
function hurtPlayer(dmg, sx, sy) {
  if (state !== 'play' || player.ifr > 0) return;
  player.hp -= dmg; player.ifr = 0.35; hurtFx = 0.4;
  const d = Math.hypot(player.x - sx, player.y - sy) || 1;
  player.x += (player.x - sx) / d * 10; player.y += (player.y - sy) / d * 10;
  Snd.hurt();
  if (player.hp <= 0) { player.hp = 0; gameOver(); }
}
function gameOver() {
  state = 'over';
  Snd.gameover();
  burst(player.x, player.y, '#2ee6ff', 30, 280); burst(player.x, player.y, '#ffffff', 12, 160);
  const mm = String(Math.floor(totalTime / 60)).padStart(2, '0'), ss = String(Math.floor(totalTime % 60)).padStart(2, '0');
  document.getElementById('overStats').innerHTML =
    `<span>Survived</span><b>${mm}:${ss}</b>` +
    `<span>Wave reached</span><b>${director.wave}</b>` +
    `<span>Level</span><b>${level}</b>` +
    `<span>Kills</span><b>${kills}</b>` +
    `<span>Gems collected</span><b>${gemsGot}</b>`;
  document.getElementById('over').classList.add('show');
  if (AUTO) setTimeout(() => { if (state === 'over') startGame(); }, 5000);
}

// weapons ---------------------------------------------------------------
function fireBlaster(dt) {
  player.blasterCd -= dt;
  if (player.blasterCd > 0) return;
  // nearest N enemies by distance-squared (no sqrt in the scan)
  const range2 = 560 * 560, cands = [];
  enemies.each(e => { const d2 = dist2(player.x, player.y, e.x, e.y); if (d2 < range2) cands.push([d2, e]); });
  if (!cands.length) { player.blasterCd = Math.min(player.blasterCd + 0.08, 0.08); return; }
  cands.sort((a, b) => a[0] - b[0]);
  player.blasterCd = BASE.blasterRate * player.cdMul;
  for (let i = 0; i < player.projCount; i++) {
    const target = cands[Math.min(i, cands.length - 1)][1];
    const spread = (i - (player.projCount - 1) / 2) * 0.085;
    const a = Math.atan2(target.y - player.y, target.x - player.x) + spread;
    const p = projectiles.obtain(); if (!p) break;
    p.x = player.x; p.y = player.y; p.px = p.x; p.py = p.y;
    p.vx = Math.cos(a) * 540; p.vy = Math.sin(a) * 540;
    p.dmg = BASE.blasterDmg * player.dmgMul; p.life = 1.1;
  }
  Snd.shoot();
}
function fireAura(dt) {
  player.auraCd -= dt;
  if (player.auraCd > 0) return;
  player.auraCd = BASE.auraRate * player.cdMul;
  const ring = rings.obtain();
  if (ring) { ring.x = player.x; ring.y = player.y; ring.r = 12; ring.maxR = player.auraR; ring.t = 0; }
  const R = player.auraR;
  enemies.each(e => {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < R + e.r) {
      const s = 320 / Math.max(d, 24);
      hitEnemy(e, BASE.auraDmg * player.dmgMul * player.auraDmgMul, (e.x - player.x) * s, (e.y - player.y) * s);
    }
  });
  Snd.aura();
}

// ---------------------------------------------------------------- upgrades & draft
const tiers = {};
const UPGRADES = [
  { id: 'proj',   icon: '🔫', name: 'Split Cannon',   can: () => player.projCount < 5,
    desc: () => '+1 blaster projectile, auto-aimed', apply: () => { player.projCount++; } },
  { id: 'dmg',    icon: '💥', name: 'Power Core',     can: () => true,
    desc: () => '+20% damage on every weapon', apply: () => { player.dmgMul *= 1.20; } },
  { id: 'rapid',  icon: '⚡', name: 'Rapid Cycler',   can: () => true,
    desc: () => 'Weapons cycle 12% faster', apply: () => { player.cdMul *= 0.88; } },
  { id: 'aura',   icon: '◎', name: 'Aura Amplifier', can: () => true,
    desc: () => '+30% aura radius, +20% aura damage', apply: () => { player.auraR *= 1.30; player.auraDmgMul *= 1.20; } },
  { id: 'speed',  icon: '👟', name: 'Swift Boots',    can: () => true,
    desc: () => '+12% move speed', apply: () => { player.speedMul *= 1.12; } },
  { id: 'magnet', icon: '🧲', name: 'Magnet Coil',    can: () => true,
    desc: () => '+35% XP pickup radius', apply: () => { player.magnetR *= 1.35; } },
  { id: 'hp',     icon: '❤️', name: 'Vital Plating',  can: () => true,
    desc: () => '+25 max HP and heal 25 now', apply: () => { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); } },
];
let draftChoices = [], draftTimer = null;

function openDraft() {
  state = 'draft';
  Snd.levelup();
  const pool = UPGRADES.filter(u => u.can());
  draftChoices = [];
  while (draftChoices.length < 3 && pool.length) {
    draftChoices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  const box = document.getElementById('cards');
  box.innerHTML = '';
  draftChoices.forEach((u, i) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<div class="key">${i + 1}</div><div class="icon">${u.icon}</div>` +
      `<div class="name">${u.name}</div><div class="desc">${u.desc()}</div>` +
      `<div class="tier">${tiers[u.id] ? 'Tier ' + (tiers[u.id] + 1) : 'New!'}</div>`;
    el.addEventListener('click', () => chooseDraft(i));
    box.appendChild(el);
  });
  document.getElementById('draft').classList.add('show');
  if (AUTO) {
    // filming bot drafts with a small delay so the cards are visible on camera
    const prio = ['proj', 'dmg', 'rapid', 'aura', 'speed', 'magnet', 'hp'];
    let best = 0;
    draftChoices.forEach((u, i) => { if (prio.indexOf(u.id) < prio.indexOf(draftChoices[best].id)) best = i; });
    draftTimer = setTimeout(() => { if (state === 'draft') chooseDraft(best); }, 2500);
  }
}
function chooseDraft(i) {
  const u = draftChoices[i]; if (!u || state !== 'draft') return;
  if (draftTimer) { clearTimeout(draftTimer); draftTimer = null; }
  u.apply(); tiers[u.id] = (tiers[u.id] || 0) + 1;
  Snd.draftPick();
  document.getElementById('draft').classList.remove('show');
  pendingDrafts--;
  if (pendingDrafts > 0) openDraft(); else state = 'play';
}
function gainXp(v) {
  xp += v;
  while (xp >= xpNeed(level)) { xp -= xpNeed(level); level++; pendingDrafts++; }
}

// ---------------------------------------------------------------- touch (gamepress standard)
// Floating stick anchors under the thumb anywhere on the LEFT half;
// circular A/B buttons bottom-right; PointerEvent pointerId isolation;
// getInput() merged with the keyboard in readInput() (keyboard OR touch).
// Weapons auto-fire and this game has no dash/pause action, so the A/B
// buttons are present per the standard but intentionally unwired.
// The touch overlay exists only while state==='play': splash, draft and
// game-over are DOM overlays whose own taps (INSERT COIN, upgrade cards,
// RUN IT BACK) the full-screen touch layer would otherwise swallow.
let TC = null;
function syncTouch() {
  const want = state === 'play' && !AUTO && isTouchDevice();
  if (want && !TC) {
    TC = new TouchController({
      buttons: [ { id: 'a', label: '⚔' }, { id: 'b', label: '🛡' } ],
      maxRadius: 56,   // stick throw, px
      deadzone: 0.18,  // stick deadzone 0..1
    });
  } else if (!want && TC) { TC.destroy(); TC = null; }
}

// ---------------------------------------------------------------- input & bot
const keys = {};
addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  Snd.resume();
  if (state === 'splash') startGame();
  else if (state === 'draft' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) chooseDraft(Number(e.code.slice(-1)) - 1);
  else if (state === 'over' && e.code === 'KeyR') startGame();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('pointerdown', () => Snd.resume());

function readInput() {
  if (AUTO) return botInput();
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) y -= 1;
  if (keys.KeyS || keys.ArrowDown) y += 1;
  // touch stick merged with the keyboard: whichever is active drives.
  // Keyboard keeps its exact unit-vector behavior; the stick stays
  // analog; combined input is clamped to unit length.
  const ti = TC ? TC.getInput() : null;
  if (ti) { x += ti.x; y += ti.y; }
  const l = Math.hypot(x, y);
  return l > 1 ? { x: x / l, y: y / l } : { x, y };
}
function botInput() {
  // kite: weighted push away from every nearby enemy; drift to gems when safe;
  // close to standoff range when nothing threatens, so the action never stalls
  let mx = 0, my = 0, threat = 0, nearest = null, nd2 = Infinity;
  enemies.each(e => {
    const d2 = dist2(player.x, player.y, e.x, e.y);
    if (d2 < nd2) { nd2 = d2; nearest = e; }
    const d = Math.sqrt(d2);
    if (d < 215 && d > 1) { const w = 1 - d / 215; mx += (player.x - e.x) / d * w * 2.3; my += (player.y - e.y) / d * w * 2.3; threat += w; }
  });
  let bg = null, bgd2 = 420 * 420;
  gems.each(g => { const d2 = dist2(player.x, player.y, g.x, g.y); if (d2 < bgd2) { bgd2 = d2; bg = g; } });
  if (bg && threat < 0.85) { const d = Math.sqrt(bgd2) || 1; mx += (bg.x - player.x) / d * 0.95; my += (bg.y - player.y) / d * 0.95; }
  else if (nearest && threat < 0.12) {
    const d = Math.sqrt(nd2) || 1;
    if (d > 235) { mx += (nearest.x - player.x) / d * 0.8; my += (nearest.y - player.y) / d * 0.8; }
  }
  const M = 180;
  if (player.x < M) mx += 1.3; if (player.x > WORLD - M) mx -= 1.3;
  if (player.y < M) my += 1.3; if (player.y > WORLD - M) my -= 1.3;
  const l = Math.hypot(mx, my);
  return l > 1 ? { x: mx / l, y: my / l } : { x: mx, y: my };
}

// ---------------------------------------------------------------- simulation step
function step(dt) {
  totalTime += dt;
  director.update(dt);
  if (player.ifr > 0) player.ifr -= dt;
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) pickupCombo = 0; }

  // player movement
  const it = readInput();
  const spd = BASE.speed * player.speedMul;
  player.x = clamp(player.x + it.x * spd * dt, player.r, WORLD - player.r);
  player.y = clamp(player.y + it.y * spd * dt, player.r, WORLD - player.r);
  player.moving = it.x !== 0 || it.y !== 0;
  if (player.moving) player.face = Math.atan2(it.y, it.x);

  // camera follows (kept in the step so spawns use the same view)
  cam.x = clamp(player.x - VW / 2, 0, Math.max(0, WORLD - VW));
  cam.y = clamp(player.y - VH / 2, 0, Math.max(0, WORLD - VH));

  fireBlaster(dt);
  fireAura(dt);

  // ---- horde: flocking via spatial hash (seek + separation, circle math)
  hashRebuild();
  enemies.each(e => {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    let vx = dx / d * e.speed, vy = dy / d * e.speed;
    // separation: push out of neighbours inside (r + or + 6)
    let sx = 0, sy = 0;
    hashQuery(e.x, e.y, e.r + 34, o => {
      if (o === e) return;
      const ox = e.x - o.x, oy = e.y - o.y;
      const od = Math.hypot(ox, oy), minD = e.r + o.r + 6;
      if (od > 0.01 && od < minD) { const w = (minD - od) / minD; sx += ox / od * w; sy += oy / od * w; }
    });
    vx += sx * 155; vy += sy * 155;
    if (e.type === 'flanker') { // flankers weave as they close in
      const w = Math.sin(totalTime * 3.1 + e.wob) * 46;
      vx += -dy / d * w; vy += dx / d * w;
    }
    e.vx = vx + e.kvx; e.vy = vy + e.kvy;
    e.kvx *= 0.86; e.kvy *= 0.86;
    e.x = clamp(e.x + e.vx * dt, e.r, WORLD - e.r);
    e.y = clamp(e.y + e.vy * dt, e.r, WORLD - e.r);
    if (e.flashT > 0) e.flashT -= dt;
    if (e.touchCd > 0) e.touchCd -= dt;
    // contact damage
    if (e.touchCd <= 0 && dist2(e.x, e.y, player.x, player.y) < (e.r + player.r - 2) * (e.r + player.r - 2)) {
      e.touchCd = 0.7;
      hurtPlayer(e.dmg, e.x, e.y);
    }
  });

  // ---- projectiles (hash collision)
  projectiles.each(p => {
    p.px = p.x; p.py = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0 || p.x < 0 || p.y < 0 || p.x > WORLD || p.y > WORLD) { projectiles.release(p); return; }
    let consumed = false;
    hashQuery(p.x, p.y, 34, e => {
      if (consumed) return;
      if (dist2(p.x, p.y, e.x, e.y) < (e.r + p.r) * (e.r + p.r)) {
        const s = 150 / (Math.hypot(e.x - p.x, e.y - p.y) || 1);
        hitEnemy(e, p.dmg, (e.x - p.x) * s, (e.y - p.y) * s);
        consumed = true;
      }
    });
    if (consumed) projectiles.release(p);
  });

  // ---- gems: drift, magnet, collect
  gems.each(g => {
    const d2 = dist2(g.x, g.y, player.x, player.y);
    if (d2 < player.magnetR * player.magnetR) {
      const d = Math.sqrt(d2) || 1, s = 150 + 620 * (1 - d / player.magnetR);
      g.vx = (player.x - g.x) / d * s; g.vy = (player.y - g.y) / d * s;
    } else { g.vx *= 0.86; g.vy *= 0.86; }
    g.x += g.vx * dt; g.y += g.vy * dt;
    if (d2 < (player.r + 11) * (player.r + 11)) {
      gemsGot++; pickupCombo++; comboT = 1.2;
      Snd.pickup(pickupCombo);
      burst(g.x, g.y, g.val >= 5 ? '#ffd94a' : '#57ffd9', 3, 80);
      gems.release(g);
      gainXp(g.val);
    }
  });

  updateFx(dt);
  if (pendingDrafts > 0 && state === 'play') openDraft();
}
function updateFx(dt) {
  particles.each(p => { p.t += dt; if (p.t >= p.life) { particles.release(p); return; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.90; p.vy *= 0.90; p.rot += p.vr * dt; });
  texts.each(t => { t.t += dt; if (t.t >= t.life) { texts.release(t); return; } t.y -= 44 * dt; });
  rings.each(r => { r.t += dt; if (r.t >= r.life) { rings.release(r); return; } r.r = 12 + (r.maxR - 12) * (r.t / r.life); });
  if (shake > 0) shake = Math.max(0, shake - 26 * dt);
  if (hurtFx > 0) hurtFx = Math.max(0, hurtFx - 1.4 * dt);
}

// ---------------------------------------------------------------- rendering
const stars = [];
for (let i = 0; i < 520; i++) stars.push({ x: Math.random() * WORLD, y: Math.random() * WORLD, r: rand(0.7, 1.9), tw: Math.random() * TAU });

function draw() {
  ctx.fillStyle = '#070812';
  ctx.fillRect(0, 0, VW, VH);
  const shx = shake ? rand(-shake, shake) * 0.5 : 0, shy = shake ? rand(-shake, shake) * 0.5 : 0;
  const ox = -cam.x + shx, oy = -cam.y + shy;

  // starfield + grid
  ctx.fillStyle = '#aFC4ff';
  for (const s of stars) {
    const x = s.x + ox, y = s.y + oy;
    if (x < -4 || y < -4 || x > VW + 4 || y > VH + 4) continue;
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(totalTime * 1.7 + s.tw);
    ctx.fillRect(x, y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(80,110,200,0.10)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = Math.floor(cam.x / 80) * 80; gx <= cam.x + VW; gx += 80) { ctx.moveTo(gx + ox, 0); ctx.lineTo(gx + ox, VH); }
  for (let gy = Math.floor(cam.y / 80) * 80; gy <= cam.y + VH; gy += 80) { ctx.moveTo(0, gy + oy); ctx.lineTo(VW, gy + oy); }
  ctx.stroke();
  // arena border
  ctx.strokeStyle = 'rgba(46,230,255,0.55)'; ctx.lineWidth = 3;
  ctx.strokeRect(ox, oy, WORLD, WORLD);
  ctx.strokeStyle = 'rgba(46,230,255,0.16)'; ctx.lineWidth = 9;
  ctx.strokeRect(ox, oy, WORLD, WORLD);

  const inView = (x, y, m) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m;

  // gems
  gems.each(g => {
    if (!inView(g.x, g.y, 30)) return;
    const bob = Math.sin(totalTime * 4 + g.wob) * 2.2, big = g.val >= 5, s = big ? 9 : 6;
    ctx.save(); ctx.translate(g.x + ox, g.y + oy + bob); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = big ? '#ffd94a' : '#57ffd9';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 9;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  });
  ctx.shadowBlur = 0;

  // aura rings
  rings.each(r => {
    ctx.beginPath(); ctx.arc(r.x + ox, r.y + oy, r.r, 0, TAU);
    ctx.strokeStyle = `rgba(46,230,255,${0.5 * (1 - r.t / r.life)})`; ctx.lineWidth = 3; ctx.stroke();
  });

  // enemies
  enemies.each(e => { if (inView(e.x, e.y, 60)) drawEnemy(e, ox, oy); });

  // projectiles
  ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  projectiles.each(p => {
    ctx.beginPath(); ctx.moveTo(p.px + ox, p.py + oy); ctx.lineTo(p.x + ox, p.y + oy); ctx.stroke();
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(p.x + ox, p.y + oy, 3, 0, TAU); ctx.fill();
  });

  // particles
  particles.each(p => {
    ctx.save(); ctx.translate(p.x + ox, p.y + oy); ctx.rotate(p.rot);
    ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  });
  ctx.globalAlpha = 1;

  // player (hidden under the game-over burst)
  if (state !== 'over') drawPlayer(ox, oy);

  // floating damage numbers
  ctx.textAlign = 'center';
  texts.each(t => {
    ctx.globalAlpha = 1 - (t.t / t.life) * (t.t / t.life);
    ctx.font = t.big ? '800 17px "Trebuchet MS",sans-serif' : '700 13px "Trebuchet MS",sans-serif';
    ctx.fillStyle = t.color;
    ctx.fillText(t.txt, t.x + ox, t.y + oy);
  });
  ctx.globalAlpha = 1;

  drawHUD();
  if (hurtFx > 0) {
    const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.32, VW / 2, VH / 2, VH * 0.78);
    g.addColorStop(0, 'rgba(255,30,60,0)'); g.addColorStop(1, `rgba(255,30,60,${0.42 * hurtFx / 0.4})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
}
function drawEnemy(e, ox, oy) {
  const t = ENEMY_TYPES[e.type], x = e.x + ox, y = e.y + oy;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = t.color; ctx.strokeStyle = t.dark; ctx.lineWidth = 2.5;
  if (e.type === 'drone') {
    ctx.rotate(totalTime * 1.6 + e.wob);
    ctx.beginPath(); ctx.moveTo(0, -e.r); ctx.lineTo(e.r, 0); ctx.lineTo(0, e.r); ctx.lineTo(-e.r, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b0416'; ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, TAU); ctx.fill();
  } else if (e.type === 'flanker') {
    ctx.rotate(Math.atan2(e.vy, e.vx));
    ctx.beginPath(); ctx.moveTo(e.r + 3, 0); ctx.lineTo(-e.r, e.r * 0.78); ctx.lineTo(-e.r * 0.45, 0); ctx.lineTo(-e.r, -e.r * 0.78); ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else { // tank: heavy hexagon with a rotating core
    ctx.rotate(totalTime * 0.5 + e.wob);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; i ? ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r) : ctx.moveTo(Math.cos(a) * e.r, Math.sin(a) * e.r); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.rotate(-totalTime * 1.3);
    ctx.strokeStyle = '#5e3405'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; i ? ctx.lineTo(Math.cos(a) * e.r * 0.55, Math.sin(a) * e.r * 0.55) : ctx.moveTo(Math.cos(a) * e.r * 0.55, Math.sin(a) * e.r * 0.55); }
    ctx.closePath(); ctx.stroke();
  }
  if (e.flashT > 0) { // hit-flash
    ctx.globalAlpha = Math.min(1, e.flashT / 0.09) * 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (e.type === 'tank' && e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - e.r, y - e.r - 12, e.r * 2, 5);
    ctx.fillStyle = '#ff9f2e'; ctx.fillRect(x - e.r, y - e.r - 12, e.r * 2 * Math.max(0, e.hp / e.maxHp), 5);
  }
}
function drawPlayer(ox, oy) {
  const x = player.x + ox, y = player.y + oy;
  // magnet radius, barely-there
  ctx.beginPath(); ctx.arc(x, y, player.magnetR, 0, TAU);
  ctx.strokeStyle = 'rgba(87,255,217,0.10)'; ctx.lineWidth = 1.5; ctx.stroke();
  if (player.ifr > 0 && Math.floor(totalTime * 18) % 2 === 0) ctx.globalAlpha = 0.35;
  ctx.save(); ctx.translate(x, y); ctx.rotate(player.face);
  // engine flame
  if (player.moving) {
    ctx.fillStyle = '#ff9f2e';
    ctx.beginPath(); ctx.moveTo(-player.r - 2, 4); ctx.lineTo(-player.r - 9 - Math.random() * 5, 0); ctx.lineTo(-player.r - 2, -4); ctx.closePath(); ctx.fill();
  }
  // hull
  const g = ctx.createLinearGradient(0, -player.r, 0, player.r);
  g.addColorStop(0, '#eafcff'); g.addColorStop(1, '#7fb8cc');
  ctx.fillStyle = g; ctx.strokeStyle = '#123a4a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(player.r + 5, 0); ctx.lineTo(-player.r * 0.7, player.r * 0.82); ctx.lineTo(-player.r * 0.35, 0); ctx.lineTo(-player.r * 0.7, -player.r * 0.82); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // visor
  ctx.fillStyle = '#0b2b3a'; ctx.beginPath(); ctx.arc(3, 0, 5.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2ee6ff'; ctx.beginPath(); ctx.arc(4.4, -1.2, 2.4, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}
function drawHUD() {
  // XP bar (top, full width)
  const need = xpNeed(level);
  ctx.fillStyle = 'rgba(10,14,30,0.85)'; ctx.fillRect(0, 0, VW, 10);
  ctx.fillStyle = '#57ffd9'; ctx.fillRect(0, 0, VW * clamp(xp / need, 0, 1), 10);
  ctx.fillStyle = '#0b2b3a'; ctx.font = '800 10px "Trebuchet MS",sans-serif'; ctx.textAlign = 'left';
  // HP bar
  const hw = 218;
  ctx.fillStyle = 'rgba(10,14,30,0.72)'; ctx.fillRect(12, 18, hw + 8, 24);
  ctx.fillStyle = '#3a0d1c'; ctx.fillRect(16, 22, hw, 16);
  ctx.fillStyle = player.hp / player.maxHp > 0.3 ? '#ff3d7f' : '#ff2222';
  ctx.fillRect(16, 22, hw * clamp(player.hp / player.maxHp, 0, 1), 16);
  ctx.strokeStyle = '#5a6da3'; ctx.lineWidth = 1.5; ctx.strokeRect(16, 22, hw, 16);
  ctx.fillStyle = '#fff'; ctx.font = '800 12px "Trebuchet MS",sans-serif';
  ctx.fillText(`HP ${Math.ceil(player.hp)} / ${player.maxHp}`, 22, 34.5);
  ctx.font = '800 15px "Trebuchet MS",sans-serif'; ctx.fillStyle = '#ffd94a';
  ctx.fillText('LV ' + level, 16, 60);
  // wave / timer / kills (top right)
  const wt = Math.max(0, 60 - director.waveT);
  const mm = String(Math.floor(totalTime / 60)).padStart(2, '0'), ss = String(Math.floor(totalTime % 60)).padStart(2, '0');
  ctx.textAlign = 'right';
  ctx.fillStyle = '#2ee6ff'; ctx.font = '800 16px "Trebuchet MS",sans-serif';
  ctx.fillText('WAVE ' + director.wave, VW - 16, 32);
  ctx.fillStyle = '#dfe9ff'; ctx.font = '700 13px "Trebuchet MS",sans-serif';
  ctx.fillText(`⏱ ${mm}:${ss}  ·  next wave ${Math.ceil(wt)}s`, VW - 16, 52);
  ctx.fillStyle = '#ff3d7f';
  ctx.fillText('KILLS ' + kills, VW - 16, 70);
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------- main loop
let lastTs = 0, acc = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  syncTouch();
  const frameDt = Math.min(0.1, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
  if (frameDt > 0) fpsEMA += ((1 / frameDt) - fpsEMA) * 0.05;
  if (hitstop > 0) { hitstop -= frameDt; draw(); return; }   // kill freeze-frame
  if (state === 'play') {
    acc += frameDt;
    let n = 0;
    while (acc >= STEP && n < 4) { step(STEP); acc -= STEP; n++; if (state !== 'play') { acc = 0; break; } }
  } else if (state === 'over') {
    updateFx(frameDt);
  }
  const typeTally = { drone: 0, flanker: 0, tank: 0 };
  enemies.each(e => { typeTally[e.type]++; });
  window.__dbg = {
    x: Math.round(player.x), y: Math.round(player.y),
    hp: Math.ceil(player.hp), maxHp: player.maxHp, level, wave: director.wave,
    kills, enemies: enemies.count(), types: typeTally, xp, state, fps: Math.round(fpsEMA),
    time: Math.round(totalTime), gems: gems.count(), audio: Snd.state(),
  };
  draw();
}

// ---------------------------------------------------------------- boot / reset
function startGame() {
  enemies.reset(); projectiles.reset(); gems.reset(); particles.reset(); texts.reset(); rings.reset();
  hash.clear();
  Object.assign(player, {
    x: WORLD / 2, y: WORLD / 2, hp: 100, maxHp: 100, ifr: 0, face: 0,
    speedMul: 1, dmgMul: 1, projCount: 1, magnetR: 78, auraR: 96, auraDmgMul: 1, cdMul: 1,
    blasterCd: 0.3, auraCd: 1.2,
  });
  for (const k in tiers) delete tiers[k];
  level = 1; xp = 0; pendingDrafts = 0; kills = 0; totalTime = 0; gemsGot = 0;
  pickupCombo = 0; comboT = 0; hitstop = 0; shake = 0; hurtFx = 0; acc = 0;
  director.reset();
  cam.x = clamp(player.x - VW / 2, 0, Math.max(0, WORLD - VW));
  cam.y = clamp(player.y - VH / 2, 0, Math.max(0, WORLD - VH));
  document.getElementById('draft').classList.remove('show');
  document.getElementById('over').classList.remove('show');
  document.getElementById('splash').classList.remove('show');
  state = 'play';
}
document.getElementById('startBtn').addEventListener('click', () => { Snd.resume(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', () => { Snd.resume(); startGame(); });

if (AUTO) { Snd.init(); startGame(); }
else document.getElementById('splash').classList.add('show');
requestAnimationFrame(loop);
