'use strict';
/* ============================================================================
   PITBALL VERITY v2 — the real game assembly.
   Engine: v1 core (BALL x PIT loop — hero at the pit floor moves LEFT/RIGHT,
   arm-cannon orbs ricochet at constant speed, CAUGHT at the floor for an
   instant reload; kills drop XP shards -> 3-choice level-ups; contact damage
   with a 0.9 s invulnerability window; kill-chain multiplier). v2 replaces
   v1's demo level with the real LEVELS data (levels.js — wall-inset pit
   geometry, angled deflectors, divider fin, timed spawn tables), adds
   FORMATION spawning (grid blocks of statue-heads, the way the real game
   plays), fusion cards, orb trails, damage numbers, the real-game-style HUD,
   and renders everything through window.PV_ART when the art lane's art.js
   is present (shape stubs with identical signatures otherwise).
   No building, no meta. In-run picks only.
   ============================================================================ */
import { TouchController, isTouchDevice } from './gptouch.js';
import { LEVELS } from './levels-all.js';

/* ---------------- view / canvas ---------------- */
const LH = 960;                       // logical height (fixed) — levels.js space is 540 x 960
let W = 540;                          // logical width (adapts to aspect)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let view = { s: 1, ox: 0, oy: 0 };
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  canvas.width = vw; canvas.height = vh;
  view.s = vh / LH;
  W = vw / view.s;
  if (W < 400) { view.s = vw / 400; W = 400; }
  if (W > 720) { W = 720; view.s = vh / LH; }
  view.ox = (vw - W * view.s) / 2;
  view.oy = (vh - LH * view.s) / 2;
}
window.addEventListener('resize', resize); resize();

const K = () => W / 540;              // horizontal scale from levels.js space
const FLOOR = 884;                    // floor line in v2 (logical y); pit floor of levels.js (960) maps here
const YMAP = y => y * (FLOOR / 960);  // levels.js y -> v2 y
const CEIL = 16;                      // orb ceiling bounce line
const DEMO = new URLSearchParams(location.search).get('demo') === '1';

/* ---------------- audio (tiny WebAudio blips) ---------------- */
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function blip(freq, dur, type = 'square', vol = 0.045, slideTo = 0, delay = 0) {
  const ac = audio(); if (!ac || ac.state !== 'running') return;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
const sfx = {
  bounce(chain) { blip(230 + Math.min(chain, 24) * 22, 0.05, 'square', 0.03); },
  catch() { blip(880, 0.08, 'sine', 0.06); blip(1320, 0.06, 'sine', 0.04, 0, 0.04); },
  hit() { blip(170, 0.05, 'triangle', 0.05); },
  kill() { blip(540, 0.09, 'square', 0.05, 140); },
  hurt() { blip(95, 0.22, 'sawtooth', 0.07, 55); },
  shoot() { blip(660, 0.05, 'square', 0.025, 990); },
  levelup() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.11, 'square', 0.05, 0, i * 0.08)); },
  chainZap() { blip(1150, 0.06, 'sawtooth', 0.03, 300); },
  fuse() { [392, 523, 659, 1046].forEach((f, i) => blip(f, 0.14, 'triangle', 0.06, 0, i * 0.07)); },
};

/* ---------------- art interface (art.js drops in at merge) -----------------
   window.PV_ART = {
     drawBackdrop(ctx, scene, W, H, t),          // scene = level.scene object
     drawHero(ctx, x, y, s, t, firing),          // (x,y) = hero centre, s = size px
     drawEnemy(ctx, kind, x, y, s, t, hpFrac),   // s = diameter px
     orbColor(type) -> css color,
     drawShard(ctx, x, y, s, t),
   }
   Until art.js lands, stubs with the same signatures keep the game running. */
const ART = () => window.PV_ART || null;

/* ---------------- input ---------------- */
const keys = {};
let dragX = null;
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (G.state === 'levelup') {
    if (e.code === 'Digit1') pickCard(0);
    if (e.code === 'Digit2') pickCard(1);
    if (e.code === 'Digit3') pickCard(2);
  } else if (G.state === 'title') {
    if (e.code === 'Digit1') selectLevel(0, true);
    if (e.code === 'Digit2') selectLevel(1, true);
    if (e.code === 'Digit3') selectLevel(2, true);
    else if (e.code === 'Space' || e.code === 'Enter') startRun();
  } else if (e.code === 'Space' || e.code === 'Enter') advance();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
function toLogical(cx) { const r = canvas.getBoundingClientRect(); return (cx - r.left - view.ox) / view.s; }
function toLogicalY(cy) { const r = canvas.getBoundingClientRect(); return (cy - r.top - view.oy) / view.s; }
canvas.addEventListener('pointerdown', e => {
  audio();
  const lx = toLogical(e.clientX), ly = toLogicalY(e.clientY);
  if (G.state === 'levelup') { if (!clickCard(lx, ly)) return; }
  else if (G.state === 'title') { if (!clickLevel(lx, ly)) startRun(); return; }
  else if (G.state !== 'play') { advance(); return; }
  dragX = lx;
});
canvas.addEventListener('pointermove', e => { if (dragX !== null) dragX = toLogical(e.clientX); });
window.addEventListener('pointerup', () => { dragX = null; });
window.addEventListener('pointercancel', () => { dragX = null; });
/* Touch fix: on touch devices the gptouch overlay (fixed, z-index 1000) sits
   over the canvas and takes every tap, so the canvas pointerdown above never
   fires — title Play, level select and level-up card picks were all dead on
   phones. Route menu-state taps through window (overlay taps bubble up to
   it). Play state is left to the stick; desktop (no TC) keeps the canvas path.
   State guards make a hypothetical double delivery harmless: whichever
   handler runs first changes the state, the second then no-ops. */
window.addEventListener('pointerdown', e => {
  if (!TC) return;
  if (G.state === 'play') return;
  audio();
  const lx = toLogical(e.clientX), ly = toLogicalY(e.clientY);
  if (G.state === 'levelup') { clickCard(lx, ly); }
  else if (G.state === 'title') { if (!clickLevel(lx, ly)) startRun(); }
  else { advance(); }
});

let TC = null;
try { if (isTouchDevice()) TC = new TouchController({ buttons: [] }); } catch (e) { TC = null; }

/* ============================================================================
   LEVEL GEOMETRY — built once per level from levels.js data.
   Insets are defined in levels.js space (540 wide, y 0..960); v2 scales x by
   K = W/540 and maps y 0..960 -> 0..FLOOR.
   ============================================================================ */
function insetAt(level, side, y960) {
  const segs = level.pit.wallSegments;
  for (const s of segs) {
    if (s.side !== side) continue;
    if (y960 >= s.y0 && y960 <= s.y1) {
      const t = s.y1 === s.y0 ? 0 : (y960 - s.y0) / (s.y1 - s.y0);
      return s.inset0 + (s.inset1 - s.inset0) * t;
    }
  }
  const mine = segs.filter(s => s.side === side);
  if (!mine.length) return 0;
  return y960 < mine[0].y0 ? mine[0].inset0 : mine[mine.length - 1].inset1;
}
function pitLeft(y) {  // y in v2 space
  const y960 = Math.max(0, Math.min(960, y / (FLOOR / 960)));
  return insetAt(G.level, 'L', y960) * K();
}
function pitRight(y) {
  const y960 = Math.max(0, Math.min(960, y / (FLOOR / 960)));
  return W - insetAt(G.level, 'R', y960) * K();
}
function deflectorSegs() {   // collision segments in v2 space, with surface radius
  return G.level.pit.deflectors.map(d => {
    const a = d.angleDeg * Math.PI / 180, hl = d.len * K() / 2;
    const cx = d.x * K(), cy = YMAP(d.y);
    return { x1: cx - Math.cos(a) * hl, y1: cy - Math.sin(a) * hl, x2: cx + Math.cos(a) * hl, y2: cy + Math.sin(a) * hl, r: d.r * K() * 0.6 + 3 };
  });
}
/* Divider fins: scene prop 'divider-fin' marks presence; exact geometry per
   level id from the FINS tables in LEVELS.md (L3) + LEVELS-MORE.md (L4–L18).
   Specs in levels.js space: { x = centre, y0..y1 = span, th = thickness px }. */
const FIN_SPECS = {
  'crown-spire': [{ x: 270, y0: 40, y1: 320, th: 14 }],
  'level-7':  [{ x: 180, y0: 30, y1: 280, th: 14 }, { x: 360, y0: 30, y1: 280, th: 14 }],
  'level-13': [{ x: 270, y0: 30, y1: 380, th: 14 }],
  'level-16': [{ x: 205, y0: 30, y1: 300, th: 14 }, { x: 335, y0: 380, y1: 650, th: 14 }],
  'level-18': [{ x: 270, y0: 30, y1: 340, th: 16 }],
};
function finGeoms() {   // ALL divider fins for the current level, in v2 space (possibly empty)
  if (!G.level || !G.level.scene.props.includes('divider-fin')) return [];
  return (FIN_SPECS[G.level.id] || []).map(f => ({ x: f.x * K(), y0: YMAP(f.y0), y1: YMAP(f.y1), half: (f.th / 2) * K() }));
}
function finGeom() {   // first fin or null — for single-fin call sites (bot merge-point)
  const fins = finGeoms();
  return fins.length ? fins[0] : null;
}
function xpNeed(lvl) { return 4 + (lvl - 1) * 3; }

/* Enemy archetypes — distinct silhouettes (zombie-game lesson). Base descent
   speeds from LEVELS.md conventions (walker 56, runner 118, brute 38,
   splitter 66 px/s in levels.js space); a level's table scales them. */
const ETYPES = {
  walker:   { r: 17, hp: 20,  speed: 56,  dmg: 1, score: 50,  color: '#7ed957', dark: '#3f7d2c' },
  runner:   { r: 13, hp: 12,  speed: 118, dmg: 1, score: 70,  color: '#ffb03a', dark: '#9c6414' },
  splitter: { r: 21, hp: 24,  speed: 66,  dmg: 1, score: 90,  color: '#39d0d8', dark: '#177e84' },
  brute:    { r: 31, hp: 130, speed: 38,  dmg: 2, score: 300, color: '#b06ee8', dark: '#5f2f8c' },
  mini:     { r: 10, hp: 6,   speed: 80,  dmg: 1, score: 30,  color: '#39d0d8', dark: '#177e84' },
};

/* Orb types: the shots ARE the balls. Magazine rotates through owned types.
   Fusion recipes are the REAL game's pairs (BALL x PIT GAMEDATA):
   Burn+Freeze -> Frozen Flame, Freeze+Lightning -> Blizzard,
   Freeze+Ghost -> Wraith. Mapped onto our four: fire/ice/lightning/ghost. */
const OTYPES = {
  iron:        { color: '#aef3ff', glow: '#37c8ff', name: 'IRON' },
  primary:     { color: '#ffe27a', glow: '#ffd94d', name: 'PRIMARY' },
  fire:        { color: '#ffd23e', glow: '#ff7a2e', name: 'BURN' },
  ice:         { color: '#c8f4ff', glow: '#6ec9ff', name: 'FREEZE' },
  lightning:   { color: '#fdfd96', glow: '#ffe93e', name: 'LIGHTNING' },
  ghost:       { color: '#e6ccff', glow: '#b98cff', name: 'GHOST' },
  frostflame:  { color: '#ffe3f1', glow: '#ff9ecf', name: 'FROZEN FLAME' },
  bomb:        { color: '#fff3b0', glow: '#ff9f2e', name: 'BOMB' },
  blizzard:    { color: '#eafcff', glow: '#9be8ff', name: 'BLIZZARD' },
  wraith:      { color: '#d9f2e2', glow: '#8fe6b0', name: 'WRAITH' },
  assassin:    { color: '#f2e9ff', glow: '#c9a7ff', name: 'ASSASSIN' },
  lightningrod:{ color: '#fffbe0', glow: '#fff176', name: 'LIGHTNING ROD' },
};
/* The SIX real fusions among our five launch balls (GAMEDATA recipes via
   fsiceangel, normalized in ballxpit-ref/best-data.js):
   Burn+Freeze, Burn+Iron, Freeze+Lightning, Freeze+Ghost, Iron+Ghost,
   Iron+Lightning. Effect texts below paraphrase the real GAMEDATA effects. */
const FUSIONS = [
  { a: 'fire', b: 'ice',       result: 'frostflame',  name: 'FROZEN FLAME',  desc: 'BURN + FREEZE fused: frostburn stacks — burn + slow, foes take +25% damage' },
  { a: 'fire', b: 'iron',      result: 'bomb',        name: 'BOMB',          desc: 'BURN + IRON fused: explodes on hit, heavy damage to nearby foes; 3 s reload' },
  { a: 'ice',  b: 'lightning', result: 'blizzard',    name: 'BLIZZARD',      desc: 'FREEZE + LIGHTNING fused: hits burst a freezing nova and arc to neighbours' },
  { a: 'ice',  b: 'ghost',     result: 'wraith',      name: 'WRAITH',        desc: 'FREEZE + GHOST fused: pierces everything, freezing each foe it passes through' },
  { a: 'iron', b: 'ghost',     result: 'assassin',    name: 'ASSASSIN',      desc: 'IRON + GHOST fused: passes through fronts; backstabs deal +30% damage' },
  { a: 'iron', b: 'lightning', result: 'lightningrod', name: 'LIGHTNING ROD', desc: 'IRON + LIGHTNING fused: plants rods — struck foes zap up to 8 neighbours every 3 s' },
];
const BASE_ORBS = ['fire', 'ice', 'lightning', 'ghost'];

/* ---------------- unlock / progression (localStorage) -------------------- */
let unlocked = 1;
try { unlocked = Math.max(1, Math.min(LEVELS.length, parseInt(localStorage.getItem('pv-unlocked') || '1', 10) || 1)); } catch (e) {}
if (DEMO) unlocked = LEVELS.length;
function saveUnlock() { try { localStorage.setItem('pv-unlocked', String(unlocked)); } catch (e) {} }

/* ---------------- game state ---------------- */
let G;
function newGame(levelIdx = 0) {
  const L = LEVELS[levelIdx];
  G = {
    state: DEMO ? 'play' : 'title',   // title | play | levelup | over | win
    level: L, levelIdx, t: 0, elapsed: 0,
    hero: { x: W / 2, vx: 0, face: 1, lastShot: -9, hitAt: -9, invulnT: 0 },
    hp: 6, maxHp: 6,
    stats: { orbDamage: 10, orbSpeed: 640, fireInterval: 0.26, magnetR: 95, catchMastery: false },
    magPool: ['iron', 'iron', 'iron', 'iron'],
    mag: ['iron', 'iron', 'iron', 'iron'],
    cooling: [],
    orbs: [], enemies: [], shards: [], pops: [], dmgPops: [], arcs: [],
    fireCd: 0.2, spawnT: 1.2, formT: 14, rushT: 18, formations: 0, finHits: 0,
    catchStacks: 0, primaryPending: true,
    kills: 0, score: 0, chain: 0, lastKillT: -9,
    xp: 0, xpLevel: 1, levelUps: 0, cards: [], cardRects: [], levelRects: [], levelupAt: 0,
    floorBreaches: 0, shake: 0, selLevel: levelIdx,
  };
  G.fin = finGeom();   // bot merge-point reference: first divider fin (or null)
}
newGame(0);

function selectLevel(i, start = false) {
  if (i < 0 || i >= LEVELS.length || i >= unlocked) return;
  newGame(i);
  if (start) startRun();
}
function startRun() { if (G.state === 'title') G.state = 'play'; }
function advance() {  // tap / space on over & win screens
  if (G.state === 'over') { newGame(G.levelIdx); G.state = 'play'; }
  else if (G.state === 'win') {
    const nx = Math.min(G.levelIdx + 1, LEVELS.length - 1);
    newGame(nx); G.state = 'play';
  }
}

/* ---------------- level-up pool + fusions --------------------------------- */
const POOL = [
  { id: 'fire',      name: 'FIRE ORB',      desc: 'Add a fire orb: hits burn over time', ok: () => true, apply() { addOrb('fire'); } },
  { id: 'ice',       name: 'ICE ORB',       desc: 'Add an ice orb: hits slow the horde', ok: () => true, apply() { addOrb('ice'); } },
  { id: 'lightning', name: 'VOLT ORB',      desc: 'Add a volt orb: hits chain lightning', ok: () => true, apply() { addOrb('lightning'); } },
  { id: 'ghost',     name: 'GHOST ORB',     desc: 'Add a ghost orb: pierces, never bounces off foes', ok: () => true, apply() { addOrb('ghost'); } },
  { id: 'orb',       name: '+1 IRON ORB',   desc: 'One more orb in your magazine', ok: () => true, apply() { addOrb('iron'); } },
  { id: 'catchmastery', name: 'CATCH MASTERY', desc: 'Caught orbs return stronger: +8% damage per catch, stacks x3', ok: () => !G.stats.catchMastery, apply() { G.stats.catchMastery = true; } },
  { id: 'dmg',       name: 'CHARGE +',      desc: 'Orb damage +25%', ok: () => true, apply() { G.stats.orbDamage *= 1.25; } },
  { id: 'spd',       name: 'VELOCITY +',    desc: 'Orb speed +12% (faster returns, faster fire)', ok: () => true, apply() { G.stats.orbSpeed *= 1.12; } },
  { id: 'rate',      name: 'RAPID RELOAD',  desc: 'Fire interval -12%', ok: () => true, apply() { G.stats.fireInterval *= 0.88; } },
  { id: 'magnet',    name: 'TRACTOR +',     desc: 'XP magnet radius +45%', ok: () => true, apply() { G.stats.magnetR *= 1.45; } },
  { id: 'hp',        name: 'ARMOR +',       desc: 'Max hearts +1 and heal 1', ok: () => true, apply() { G.maxHp += 1; G.hp = Math.min(G.maxHp, G.hp + 1); } },
  { id: 'heal',      name: 'REPAIR KIT',    desc: 'Restore 2 hearts', ok: () => G.hp < G.maxHp, apply() { G.hp = Math.min(G.maxHp, G.hp + 2); } },
];
function addOrb(type) { G.magPool.push(type); G.mag.push(type); }
function ownedCount(type) {
  return G.magPool.filter(t => t === type).length +
    G.orbs.filter(o => o.type === type).length +
    G.cooling.filter(c => c.type === type).length;
}
function availableFusions() {
  return FUSIONS.filter(f => !G.magPool.includes(f.result) && ownedCount(f.a) >= 1 && ownedCount(f.b) >= 1);
}
function fusionCard(f) {
  return { id: 'fusion-' + f.result, name: 'FUSE: ' + f.name, desc: f.desc, fusion: f,
    apply() {
      for (const src of [f.a, f.b]) {
        let i = G.mag.indexOf(src); if (i >= 0) { G.mag.splice(i, 1); }
        i = G.magPool.indexOf(src); if (i >= 0) G.magPool.splice(i, 1);
      }
      addOrb(f.result);
      sfx.fuse();
    } };
}
function rollCards() {
  // Offer rule (Bounce_Fit D-024, via the harvest): 3 random picks from ALL
  // currently valid cards — fusions compete in the same pool, no category
  // guarantee.
  const avail = POOL.filter(p => p.ok());
  for (const f of availableFusions()) avail.push(fusionCard(f));
  const picks = [];
  while (picks.length < 3 && avail.length) {
    const i = Math.floor(Math.random() * avail.length);
    picks.push(avail.splice(i, 1)[0]);
  }
  G.cards = picks;
}
function pickCard(i) {
  if (G.state !== 'levelup' || !G.cards[i]) return;
  G.cards[i].apply();
  G.cards = []; G.cardRects = [];
  G.state = 'play';
  blip(740, 0.09, 'square', 0.05);
}
function gainXp(v) {
  G.xp += v;
  if (G.xp >= xpNeed(G.xpLevel) && G.state === 'play') {
    G.xp -= xpNeed(G.xpLevel);
    G.xpLevel += 1; G.levelUps += 1; G.levelupAt = G.t;
    rollCards();
    G.state = 'levelup';
    sfx.levelup();
  }
}

/* ---------------- spawning: timed table director + formations ------------- */
let enemySeq = 1;
function pickSpawnEntry() {
  const open = G.level.spawns.table.filter(s => G.elapsed >= s.fromSec);
  if (!open.length) return null;
  const tot = open.reduce((a, s) => a + s.weight, 0);
  let roll = Math.random() * tot;
  for (const s of open) { roll -= s.weight; if (roll <= 0) return s; }
  return open[0];
}
function makeEnemy(type, x, y, entry, formation) {
  const d = ETYPES[type];
  const hp = d.hp * (entry ? entry.hpMul : 1);
  const sp = d.speed * (entry ? entry.speedMul : 1);
  return { id: enemySeq++, type, x, y, r: d.r * K(), hp, maxHp: hp, speed: sp,
    phase: Math.random() * Math.PI * 2, slowT: 0, burnT: 0, burnPow: 7,
    freezeT: 0, curse: 0, flash: 0, form: !!formation,
    x0: x, beh: null, rodded: false, rodT: 0,
    lane: finGeom() ? (x < finGeom().x ? -1 : 1) : 0 };
}
function spawnEnemy() {
  const entry = pickSpawnEntry(); if (!entry) return;
  const d = ETYPES[entry.type];
  const y = -d.r - 6;
  const lo = pitLeft(0) + d.r * K() + 4, hi = pitRight(0) - d.r * K() - 4;
  if (hi <= lo) return;
  const x = lo + Math.random() * (hi - lo);
  G.enemies.push(makeEnemy(entry.type, x, y, entry, false));
}
/* Formation director: a GRID BLOCK of statue-heads descends in formation at
   walker pace (the real game's signature). Block width fits the pit at spawn
   height; on fin levels the block splits into per-channel blocks. */
function spawnFormation() {
  const entry = pickSpawnEntry(); if (!entry) return;
  const baseSpeed = ETYPES.walker.speed * (entry.speedMul || 1);
  const cell = 46 * K(), rowH = 44 * (FLOOR / 960);
  // channels at spawn height: intervals between the fins ACTIVE at the top of
  // the pit (span starts within the top 80 levels-px), walls at the pit edges.
  // Deeper fins (e.g. the Gauntlet's staggered second fin) contain enemies
  // later via clampEnemyX as they descend into its span.
  const topFins = finGeoms().filter(f => f.y0 <= YMAP(80)).sort((a, b) => a.x - b.x);
  const lanes = [];
  {
    let edge = pitLeft(0) + 6;
    for (const f of topFins) { lanes.push([edge, f.x - f.half - 6]); edge = f.x + f.half + 6; }
    lanes.push([edge, pitRight(0) - 6]);
  }
  let spawned = 0;
  for (const [lo, hi] of lanes) {
    if (hi - lo < cell) continue;   // channel too narrow for a block
    const cols = Math.max(2, Math.min(7, Math.floor((hi - lo) / cell)));
    // blocks grow over the run: 2–3 rows in the first minute, up to 6 late
    const rows = Math.min(6, 2 + Math.floor(G.elapsed / 75) + (Math.random() < 0.5 ? 1 : 0));
    const blockW = cols * cell, x0 = lo + (hi - lo - blockW) / 2 + cell / 2;
    for (let rI = 0; rI < rows; rI++) {
      for (let cI = 0; cI < cols; cI++) {
        // mostly the walker's statue-head; spice the front row with actives
        let type = 'walker', ent = G.level.spawns.table.find(s => s.type === 'walker') || entry;
        if (rI === 0 && cI % 3 === 2 && entry.type !== 'walker') { type = entry.type; ent = entry; }
        const e = makeEnemy(type, x0 + cI * cell, -30 - rI * rowH, ent, true);
        e.speed = baseSpeed;               // the block marches at walker pace
        if (rI === 1 && cI % 2 === 0) { e.beh = 'zigzag'; e.x0 = e.x; }   // behaviour flag (bxpit MON table): the middle row weaves
        G.enemies.push(e); spawned++;
      }
    }
  }
  if (spawned) G.formations += 1;
}

/* ---------------- firing: the shots are the balls ------------------------- */
function fireOrb() {
  const type = G.mag.shift();
  const hx = G.hero.x + G.hero.face * 8, hy = FLOOR - 92;
  let ang = 0, best = 1e9;
  let cands = G.enemies;
  if (DEMO && G.fin) {   // bot won't waste shots across the divider fin
    const side = Math.sign(hx - G.fin.x) || 1;
    const same = G.enemies.filter(e => !e.dead && (Math.sign(e.x - G.fin.x) === side || e.y > G.fin.y1));
    if (same.length) cands = same;
  }
  if (DEMO) {
    // trickshot autopilot aim: rotate among the THREE lowest enemies
    // (floor(t*1.3) % 3) instead of fixating on one — spreads damage
    // across the front line like a casual human player.
    const sorted = cands.filter(e => !e.dead).sort((a, b) => b.y - a.y);
    if (sorted.length) {
      const t = sorted[Math.floor(G.t * 1.3) % Math.min(3, sorted.length)];
      ang = Math.max(-0.38, Math.min(0.38, Math.atan2(t.x - hx, Math.max(60, hy - t.y))));
    }
  } else {
    for (const e of cands) {
      if (e.dead) continue;
      // human assist: nearest enemy, weighted toward low ones
      const dd = Math.abs(e.x - hx) + Math.max(0, hy - e.y);
      if (dd < best) { best = dd; ang = Math.max(-0.38, Math.min(0.38, Math.atan2(e.x - hx, Math.max(60, hy - e.y)))); }
    }
  }
  // the golden PRIMARY ball (bxpit single-file clone): the run's first iron
  // orb is bigger, slower, 2x damage — and comes back golden when caught
  let sp = G.stats.orbSpeed, orad = 10, odmg = 1, primary = false;
  if (type === 'iron' && G.primaryPending) { primary = true; G.primaryPending = false; sp *= 0.85; orad = 13; odmg = 2; }
  G.orbs.push({ type, x: hx, y: hy, vx: Math.sin(ang) * sp, vy: -Math.cos(ang) * sp,
    r: orad, speed: sp, dmgMul: odmg, primary, chain: 0, hitCool: new Map(), pierced: new Set(), defCool: 0, trail: [] });
  G.hero.lastShot = G.t;
  sfx.shoot();
}

/* ---------------- damage / death ------------------------------------------ */
function dmgPop(e, dmg) { G.dmgPops.push({ x: e.x + (Math.random() - 0.5) * 14, y: e.y - e.r - 4, txt: `${Math.round(dmg)}`, t: 0.55 }); }
function chainLightning(e, dmg, depth) {
  const near = G.enemies.filter(o => o !== e && !o.dead && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 135 * 135)
    .sort((a, b) => ((a.x - e.x) ** 2 + (a.y - e.y) ** 2) - ((b.x - e.x) ** 2 + (b.y - e.y) ** 2)).slice(0, 2);
  for (const o of near) { G.arcs.push({ x1: e.x, y1: e.y, x2: o.x, y2: o.y, t: 0.12 }); o.flash = 0.09; damageEnemy(o, dmg * 0.5, null, depth + 1); }
  if (near.length) sfx.chainZap();
}
/* Damage an orb deals right now: base x per-orb multiplier (the golden
   primary is 2x) x Catch Mastery stacks (chinxpit's catch variant, adopted
   as a passive card: x1.08 per catch, max 3 stacks = x1.26). */
function orbDmg(o) {
  let m = (o && o.dmgMul) || 1;
  if (G.stats.catchMastery) m *= Math.pow(1.08, G.catchStacks);
  return G.stats.orbDamage * m;
}
function damageEnemy(e, dmg, srcOrb, depth = 0) {
  if (e.dead) return;
  if (e.frostburn) dmg *= 1.25;   // Frozen Flame: frostburnt foes take +25% from other sources
  e.hp -= dmg; e.flash = 0.09; dmgPop(e, dmg);
  if (srcOrb) {
    const ty = srcOrb.type;
    if (ty === 'fire') { e.burnT = 2.5; e.burnPow = 7; }
    if (ty === 'ice') e.slowT = 1.6;
    if (ty === 'lightning' && depth === 0) chainLightning(e, dmg, depth);
    if (ty === 'frostflame') { e.burnT = 3.0; e.burnPow = 13; e.slowT = 1.6; e.frostburn = true; }
    if (ty === 'blizzard') {
      e.slowT = 1.6;
      for (const o of G.enemies) {   // freezing nova around the hit
        if (o === e || o.dead) continue;
        if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 85 * 85) { o.freezeT = Math.max(o.freezeT, 0.8); o.flash = 0.09; }
      }
      if (depth === 0) chainLightning(e, dmg * 0.7, depth);
    }
    if (ty === 'wraith') {
      e.freezeT = Math.max(e.freezeT || 0, 0.8);   // real Wraith: freezes any enemy it passes through
    }
    if (ty === 'bomb' && depth === 0) {
      // real Bomb: explodes on hit (150-300 in game scale -> 55 AoE here),
      // then a 3 s cooldown before it can be shot again (orb is consumed)
      for (const o2 of G.enemies) {
        if (o2 === e || o2.dead) continue;
        if ((o2.x - e.x) ** 2 + (o2.y - e.y) ** 2 < 78 * 78) damageEnemy(o2, 55, null, 1);
      }
      G.pops.push({ x: e.x, y: e.y, txt: 'BOOM!', t: 0.6, color: '#ffb03a', small: true });
      srcOrb.dead = true; srcOrb.coolT = 3;
    }
    if (ty === 'lightningrod') {
      e.rodded = true; if (!e.rodT) e.rodT = 3;   // rod planted: strikes every 3 s (in updateEnemies)
      if (depth === 0) chainLightning(e, dmg * 0.5, depth);
    }
  }
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return; e.dead = true;
  G.kills += 1;
  if (G.t - G.lastKillT < 2.5) G.chain += 1; else G.chain = 1;
  G.lastKillT = G.t;
  const mult = 1 + Math.min(G.chain, 20) * 0.1;
  const pts = Math.round(ETYPES[e.type].score * mult);
  G.score += pts;
  G.pops.push({ x: e.x, y: e.y - 6, txt: `+${pts}`, t: 0.8, color: '#ffe95e' });
  if (G.chain >= 3) G.pops.push({ x: e.x, y: e.y + 16, txt: `CHAIN ×${G.chain}`, t: 0.7, color: '#5ee7ff', small: true });
  const n = e.type === 'brute' ? 6 : e.type === 'splitter' ? 2 : 1;
  for (let i = 0; i < n; i++)
    G.shards.push({ x: e.x + (Math.random() - 0.5) * 26, y: e.y + (Math.random() - 0.5) * 14, vx: (Math.random() - 0.5) * 30, vy: 40, v: 1, mag: false });
  if (e.type === 'splitter')
    for (const s of [-1, 1]) { const d = ETYPES.mini; G.enemies.push({ id: enemySeq++, type: 'mini', x: e.x + s * 16, y: e.y, r: d.r * K(), hp: d.hp, maxHp: d.hp, speed: d.speed, phase: Math.random() * 6, slowT: 0, burnT: 0, burnPow: 7, freezeT: 0, curse: 0, flash: 0, form: false, lane: e.lane || 0 }); }
  sfx.kill();
}
function hurtHero(dmg) {
  if (G.hero.invulnT > 0 || G.state !== 'play') return;
  G.hp -= dmg; G.hero.invulnT = 0.9; G.hero.hitAt = G.t; G.shake = 0.35;   // 0.9s invuln window + hit flash
  sfx.hurt();
  if (G.hp <= 0) { G.hp = 0; G.state = 'over'; }
}

/* ---------------- update --------------------------------------------------- */
function update(dt) {
  G.t += dt;
  if (G.state === 'levelup') {
    if (DEMO && G.t - G.levelupAt > 4) {   // demo AI drafts like a player: fusions, orbs, damage first
      let bi = 0, bs = -1;
      G.cards.forEach((c, i) => { const s = c.fusion ? 5 : (c.id === 'orb' || BASE_ORBS.includes(c.id)) ? 4 : c.id === 'dmg' ? 3 : c.id === 'hp' && G.hp <= 2 ? 2 : 1; if (s > bs) { bs = s; bi = i; } });
      pickCard(bi);
    }
    return;
  }
  if (G.state !== 'play') return;
  G.elapsed += dt;
  const H = G.hero, L = G.level;

  /* --- movement: left/right ONLY along the floor --- */
  let move = 0;
  if (keys.ArrowLeft || keys.KeyA) move -= 1;
  if (keys.ArrowRight || keys.KeyD) move += 1;
  if (TC) { const ti = TC.getInput(); if (ti && Math.abs(ti.x) > 0.3) move = Math.sign(ti.x); }
  let targetX = null;
  if (DEMO) targetX = botTarget();
  else if (dragX !== null) targetX = dragX;
  if (targetX !== null) {
    const dx = targetX - H.x;
    H.vx = Math.max(-640, Math.min(640, dx * 10));
    if (Math.abs(dx) > 4) move = Math.sign(dx);
  } else if (move !== 0) H.vx = move * 350;
  else H.vx *= Math.pow(0.0001, dt);
  H.x += H.vx * dt;
  H.x = Math.max(pitLeft(FLOOR) + 24, Math.min(pitRight(FLOOR) - 24, H.x));
  if (Math.abs(H.vx) > 30) H.face = Math.sign(H.vx);
  if (H.invulnT > 0) H.invulnT -= dt;

  /* --- directors: trickle (table + pressure ramp + escalation steps) --- */
  const sp = L.spawns;
  const escSteps = Math.floor(G.elapsed / sp.escalateEverySec);
  const interval = (1.1 / sp.pressureMul) * Math.pow(0.95, escSteps);
  G.spawnT -= dt;
  if (G.spawnT <= 0 && G.enemies.length < 46) { spawnEnemy(); G.spawnT = interval * (0.7 + Math.random() * 0.6); }
  // formation director: a grid block every ~13–19 s (the pulse; no extra rush
  // clusters — the reference game's early waves are small, 4–7 per wave)
  G.formT -= dt;
  if (G.formT <= 0 && G.enemies.length < 40) { spawnFormation(); G.formT = 13 + Math.random() * 6; }

  /* --- auto-fire, governed by the magazine / catches --- */
  G.fireCd -= dt;
  if (G.mag.length && G.fireCd <= 0) { fireOrb(); G.fireCd = G.stats.fireInterval; }
  for (let i = G.cooling.length - 1; i >= 0; i--) { G.cooling[i].t -= dt; if (G.cooling[i].t <= 0) { G.mag.push(G.cooling[i].type); G.cooling.splice(i, 1); } }

  updateOrbs(dt);
  updateEnemies(dt);
  updateShards(dt);

  for (let i = G.pops.length - 1; i >= 0; i--) { G.pops[i].t -= dt; G.pops[i].y -= 34 * dt; if (G.pops[i].t <= 0) G.pops.splice(i, 1); }
  for (let i = G.dmgPops.length - 1; i >= 0; i--) { G.dmgPops[i].t -= dt; G.dmgPops[i].y -= 46 * dt; if (G.dmgPops[i].t <= 0) G.dmgPops.splice(i, 1); }
  for (let i = G.arcs.length - 1; i >= 0; i--) { G.arcs[i].t -= dt; if (G.arcs[i].t <= 0) G.arcs.splice(i, 1); }
  if (G.shake > 0) G.shake -= dt;

  /* --- level end (goal from levels.js) --- */
  const goal = L.goal;
  const cleared = goal.type === 'kills' ? G.kills >= goal.target : G.elapsed >= goal.target;
  if (cleared && G.state === 'play') {
    G.state = 'win';
    unlocked = Math.max(unlocked, Math.min(LEVELS.length, G.levelIdx + 2));   // clearing pit n unlocks pit n+1
    saveUnlock();
  }
}

/* Orb physics: constant speed; specular bounce off walls / ceiling /
   deflectors / divider fin / enemies. Floor = catch zone, NOT a bounce. */
function segCollide(o, sg, surfR) {
  const dx = sg.x2 - sg.x1, dy = sg.y2 - sg.y1, len2 = dx * dx + dy * dy || 1;
  let tt = ((o.x - sg.x1) * dx + (o.y - sg.y1) * dy) / len2; tt = Math.max(0, Math.min(1, tt));
  const cx = sg.x1 + tt * dx, cy = sg.y1 + tt * dy;
  const nx = o.x - cx, ny = o.y - cy, dist = Math.hypot(nx, ny);
  if (dist < o.r + surfR && dist > 0.001) {
    const ux = nx / dist, uy = ny / dist, dot = o.vx * ux + o.vy * uy;
    if (dot < 0) {
      o.vx -= 2 * dot * ux; o.vy -= 2 * dot * uy;
      o.x = cx + ux * (o.r + surfR + 0.5); o.y = cy + uy * (o.r + surfR + 0.5);
      return true;
    }
  }
  return false;
}
function updateOrbs(dt) {
  const segs = deflectorSegs();
  const finSegs = finGeoms().map(f => ({ x1: f.x, y1: f.y0, x2: f.x, y2: f.y1, half: f.half }));
  for (let oi = G.orbs.length - 1; oi >= 0; oi--) {
    const o = G.orbs[oi];
    // trail: remember recent positions for the fading streak
    o.trail.push({ x: o.x, y: o.y });
    if (o.trail.length > 9) o.trail.shift();
    const steps = 2, sdt = dt / steps;
    let gone = false;
    for (let s = 0; s < steps && !gone; s++) {
      const sp = Math.hypot(o.vx, o.vy) || o.speed; o.vx *= o.speed / sp; o.vy *= o.speed / sp;
      o.x += o.vx * sdt; o.y += o.vy * sdt;

      // pit walls (inset profile at this height) + ceiling
      const pl = pitLeft(o.y) + 6, pr = pitRight(o.y) - 6;
      if (o.x - o.r < pl) { o.x = pl + o.r; o.vx = Math.abs(o.vx); o.chain = 0; sfx.bounce(0); }
      if (o.x + o.r > pr) { o.x = pr - o.r; o.vx = -Math.abs(o.vx); o.chain = 0; sfx.bounce(0); }
      if (o.y - o.r < CEIL) { o.y = CEIL + o.r; o.vy = Math.abs(o.vy); sfx.bounce(o.chain); }

      // angled deflectors
      if (o.defCool > 0) o.defCool -= sdt;
      if (o.defCool <= 0) for (const sg of segs) {
        if (segCollide(o, sg, sg.r)) { o.defCool = 0.09; o.chain += 1; sfx.bounce(o.chain); break; }
      }
      // divider fins — real collidables; scripted shots register finHits
      for (const fs of finSegs) {
        if (segCollide(o, fs, fs.half)) { G.finHits += 1; o.chain += 1; sfx.bounce(o.chain); break; }
      }

      // enemies
      const piercing = o.type === 'ghost' || o.type === 'wraith' || (o.type === 'assassin' && o.vy < 0);   // Assassin passes through FRONTS (orb moving up)
      for (const e of G.enemies) {
        if (e.dead) continue;
        const dx = o.x - e.x, dy = o.y - e.y, rr = o.r + e.r;
        if (dx * dx + dy * dy >= rr * rr) continue;
        if (piercing) {
          if (o.pierced.has(e.id)) continue;
          o.pierced.add(e.id); damageEnemy(e, orbDmg(o), o); sfx.hit();
        } else {
          const cool = o.hitCool.get(e.id) || 0;
          if (G.t < cool) continue;
          const dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist;
          const dot = o.vx * ux + o.vy * uy;
          if (dot < 0) { o.vx -= 2 * dot * ux; o.vy -= 2 * dot * uy; }
          o.x = e.x + ux * (rr + 1); o.y = e.y + uy * (rr + 1);
          o.hitCool.set(e.id, G.t + 0.14);
          o.chain += 1;
          damageEnemy(e, orbDmg(o) * (o.type === 'assassin' ? 1.3 : 1), o);   // Assassin backstab (orb moving down onto a back): +30%
          sfx.bounce(o.chain);
        }
        break;
      }
      if (o.dead) {   // consumed (Bomb): long cooldown instead of a return
        G.cooling.push({ type: o.type, t: o.coolT || 3 }); G.orbs.splice(oi, 1); gone = true; break;
      }

      // floor: catch zone, NOT a bounce
      if (o.vy > 0 && o.y >= FLOOR - 64) {
        if (Math.abs(o.x - G.hero.x) < 62) {   // catch = physical interception (MECHANICS_SPEC: proximity catch)
          G.mag.push(o.type); G.orbs.splice(oi, 1); gone = true; sfx.catch();
          if (o.primary) G.primaryPending = true;   // the golden ball comes back golden
          if (G.stats.catchMastery && G.catchStacks < 3) {
            G.catchStacks += 1;
            G.pops.push({ x: G.hero.x, y: FLOOR - 142, txt: 'POWER x' + Math.pow(1.08, G.catchStacks).toFixed(2), t: 0.5, color: '#ffd94d', small: true });
          }
          G.pops.push({ x: G.hero.x, y: FLOOR - 118, txt: 'CATCH!', t: 0.45, color: '#aef3ff', small: true });
        } else if (o.y > FLOOR + 14) {
          G.cooling.push({ type: o.type, t: 1.2 }); G.orbs.splice(oi, 1); gone = true;
        }
      }
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}

function clampEnemyX(e) {
  let lo = pitLeft(e.y) + e.r, hi = pitRight(e.y) - e.r;
  // lane-commit by physical containment: every fin whose y-span (extended by
  // e.r) covers the enemy's y contains it on whichever side its centre sits —
  // correct for 1–3 fins, including staggered pairs (the Gauntlet flip).
  for (const fin of finGeoms()) {
    if (e.y > fin.y0 - e.r && e.y < fin.y1 + e.r) {
      if (e.x < fin.x) hi = Math.min(hi, fin.x - fin.half - e.r);
      else lo = Math.max(lo, fin.x + fin.half + e.r);
    }
  }
  e.x = Math.max(lo, Math.min(hi, e.x));
}
function updateEnemies(dt) {
  for (const e of G.enemies) {
    if (e.freezeT > 0) { e.freezeT -= dt; if (e.flash > 0) e.flash -= dt; continue; }
    if (e.burnT > 0) { e.burnT -= dt; e.hp -= e.burnPow * dt * (e.frostburn ? 1.35 : 1); if (e.hp <= 0) { killEnemy(e); continue; } }
    if (e.slowT > 0) e.slowT -= dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.rodded) {   // Lightning Rod: every 3 s the planted foe zaps up to 8 neighbours
      e.rodT -= dt;
      if (e.rodT <= 0) {
        e.rodT = 3; let n = 0;
        for (const o of G.enemies) {
          if (o === e || o.dead || n >= 8) continue;
          if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 115 * 115) { G.arcs.push({ x1: e.x, y1: e.y, x2: o.x, y2: o.y, t: 0.12 }); damageEnemy(o, 18, null, 1); n++; }
        }
        if (n) sfx.hit();
      }
    }
    const sf = e.slowT > 0 ? 0.5 : 1;
    const dive = e.type === 'runner' && !e.form ? 1 + (e.y / LH) * 0.55 : 1;
    e.y += e.speed * sf * dive * dt;
    if (e.beh === 'zigzag') e.x = e.x0 + Math.sin(G.t * 2.3 + e.phase) * 16;   // bxpit MON 'zz' flag
    if (!e.form) {   // formation members march straight; trickle enemies drift
      if (e.type === 'walker' || e.type === 'splitter') e.x += Math.sin(G.t * 1.7 + e.phase) * 14 * dt;
      if (e.type === 'brute') e.x += Math.max(-13, Math.min(13, (G.hero.x - e.x) * 0.25)) * dt;
    }
    clampEnemyX(e);
    if (e.y + e.r >= FLOOR - 2) {
      e.dead = true; G.floorBreaches += 1;
      G.pops.push({ x: e.x, y: FLOOR - 30, txt: '-♥', t: 0.9, color: '#ff5a6e' });
      hurtHero(ETYPES[e.type].dmg);
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}

function updateShards(dt) {
  const H = G.hero, hx = H.x, hy = FLOOR - 46;
  for (let i = G.shards.length - 1; i >= 0; i--) {
    const s = G.shards[i];
    const dx = hx - s.x, dy = hy - s.y, dist = Math.hypot(dx, dy);
    if (dist < G.stats.magnetR) s.mag = true;
    if (s.mag) { const pull = 560; s.vx = dx / (dist || 1) * pull; s.vy = dy / (dist || 1) * pull; }
    else { s.vy = Math.min(s.vy + 30 * dt, 62); s.vx *= 0.98; }
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (dist < 30) { gainXp(s.v); G.shards.splice(i, 1); blip(1180, 0.04, 'sine', 0.03); }
    else if (s.y > FLOOR + 20) G.shards.splice(i, 1);
  }
}

/* Demo bot: never miss an imminent catch; otherwise park under the LOWEST
   enemy (the one closest to breaching) so the aim assist deletes it first;
   then any catch, then shards. */
function botTarget() {
  let bestT = 1e9, bx = null;
  for (const o of G.orbs) {
    if (o.vy <= 0 || o.y < LH * 0.25) continue;
    const t = (FLOOR - 64 - o.y) / o.vy; if (t < 0) continue;
    if (t < bestT) { bestT = t; bx = o.x + o.vx * t * 0.8; }
  }
  if (bx !== null && bestT < 0.55) return bx;                    // catch is imminent: be there
  // threat = smallest TIME-TO-FLOOR (a fast runner high up beats a slow
  // walker lower down) — position under it
  let threat = null, bttf = 1e9;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const ttf = (FLOOR - e.y) / Math.max(25, e.speed * (e.slowT > 0 ? 0.5 : 1));
    if (ttf < bttf) { bttf = ttf; threat = e; }
  }
  if (threat && threat.y > LH * 0.30) {
    // fin level: once the fight is at/past the fin tip, hold the MERGE point
    // (centre) instead of chasing into a lane — both lanes feed there.
    if (G.fin && threat.y > G.fin.y1 - 40) return G.fin.x;
    return threat.x;
  }
  if (bx !== null) return bx;                                    // otherwise keep the catch
  if (threat) return threat.x;
  // shards only when SAFE (trickshot autopilot rule: never chase a drop
  // through the enemy front at that x)
  let bd = 1e9, sx = null;
  for (const s of G.shards) {
    let safe = true;
    for (const e of G.enemies) { if (!e.dead && Math.abs(e.x - s.x) < 70 && e.y > s.y - 30) { safe = false; break; } }
    if (!safe) continue;
    const d = Math.abs(s.x - G.hero.x); if (d < bd) { bd = d; sx = s.x; }
  }
  if (sx !== null) return sx;
  return W / 2 + Math.sin(G.t * 0.4) * W * 0.18;
}

/* ---------------- render ---------------------------------------------------- */
function orbColor(type) { const a = ART(); return (a && a.orbColor && a.orbColor(type)) || OTYPES[type].glow; }

function stubBackdrop(scene) {
  const grad = ctx.createLinearGradient(0, 0, 0, LH);
  grad.addColorStop(0, scene.palette.bg); grad.addColorStop(1, '#05070f');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, LH);
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for (let y = 60; y < FLOOR; y += 80) ctx.fillRect(pitLeft(y) + 8, y, pitRight(y) - pitLeft(y) - 16, 2);
}
function stubHero(x, y, s, firing) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#274b8f'; ctx.fillRect(-s * 0.30, -s * 0.10, s * 0.60, s * 0.46);       // torso
  ctx.fillStyle = '#37c8ff'; ctx.beginPath(); ctx.arc(0, -s * 0.28, s * 0.26, 0, 7); ctx.fill(); // helmet
  ctx.fillStyle = '#0b1020'; ctx.fillRect(-s * 0.20, -s * 0.32, s * 0.40, s * 0.10);       // visor
  ctx.fillStyle = firing ? '#ffd23e' : '#5ee7ff';
  ctx.fillRect(s * 0.18, -s * 0.42, s * 0.13, s * 0.34);                                  // cannon up
  ctx.fillStyle = '#1b2c55'; ctx.fillRect(-s * 0.28, s * 0.36, s * 0.20, s * 0.16); ctx.fillRect(s * 0.08, s * 0.36, s * 0.20, s * 0.16);
  ctx.restore();
}
function stubEnemy(kind, x, y, s, t, hpFrac) {
  const d = ETYPES[kind] || ETYPES.walker, r = s / 2;
  ctx.save(); ctx.translate(x, y);
  // statue-head: blocky carved head on a plinth (the real game's read)
  ctx.fillStyle = d.dark; ctx.fillRect(-r * 0.92, r * 0.62, r * 1.84, r * 0.30);
  ctx.fillStyle = d.color; ctx.fillRect(-r * 0.80, -r * 0.86, r * 1.60, r * 1.50);
  ctx.fillStyle = d.dark; ctx.fillRect(-r * 0.80, -r * 0.86, r * 1.60, r * 0.22);
  ctx.fillStyle = '#10131f';
  ctx.fillRect(-r * 0.46, -r * 0.34, r * 0.24, r * 0.20); ctx.fillRect(r * 0.22, -r * 0.34, r * 0.24, r * 0.20);
  ctx.fillRect(-r * 0.18, r * 0.28, r * 0.36, r * 0.12);
  if (kind === 'brute') { ctx.fillStyle = '#ff5a6e'; ctx.fillRect(-r * 0.5, -r * 1.02, r, r * 0.16); }
  if (kind === 'splitter') { ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 0.6); ctx.stroke(); }
  ctx.restore();
  if (hpFrac < 1) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - r, y - r - 10, r * 2, 4);
    ctx.fillStyle = '#7dff6a'; ctx.fillRect(x - r, y - r - 10, r * 2 * Math.max(0, hpFrac), 4);
  }
}
function stubShard(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#54ffb0'; ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.fillStyle = '#d8ffe9'; ctx.fillRect(-s / 5, -s / 5, s / 2.5, s / 2.5);
  ctx.restore();
}

function drawEnemy(e) {
  const a = ART();
  const flash = e.flash > 0;
  if (flash) { ctx.save(); ctx.globalAlpha = 0.85; }
  if (a && a.drawEnemy) a.drawEnemy(ctx, e.type, e.x, e.y, e.r * 2, G.t, Math.max(0, e.hp / e.maxHp));
  else stubEnemy(e.type, e.x, e.y, e.r * 2, G.t, Math.max(0, e.hp / e.maxHp));
  if (flash) ctx.restore();
  if (e.burnT > 0) { ctx.fillStyle = 'rgba(255,122,46,.85)'; ctx.beginPath(); ctx.arc(e.x - e.r * 0.4, e.y - e.r - 4 + Math.sin(G.t * 19 + e.id) * 2, 4, 0, 7); ctx.arc(e.x + e.r * 0.3, e.y - e.r - 2, 3, 0, 7); ctx.fill(); }
  if (e.freezeT > 0) { ctx.strokeStyle = 'rgba(190,240,255,.95)'; ctx.lineWidth = 2.5; ctx.strokeRect(e.x - e.r - 2, e.y - e.r - 2, e.r * 2 + 4, e.r * 2 + 4); }
  else if (e.slowT > 0) { ctx.strokeStyle = 'rgba(160,225,255,.9)'; ctx.lineWidth = 2; ctx.strokeRect(e.x - e.r - 2, e.y - e.r - 2, e.r * 2 + 4, e.r * 2 + 4); }
  if (e.curse > 0) { ctx.fillStyle = '#8fe6b0'; ctx.font = '900 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✦'.repeat(Math.min(5, e.curse)), e.x, e.y - e.r - 14); }
}

function drawHero() {
  const H = G.hero, a = ART();
  ctx.save();
  if (H.invulnT > 0 && Math.floor(G.t * 14) % 2) ctx.globalAlpha = 0.45;
  const firing = G.t - H.lastShot < 0.22;
  if (a && a.drawHero) a.drawHero(ctx, H.x, FLOOR - 42, 64, G.t, firing);
  else stubHero(H.x, FLOOR - 42, 64, firing);
  ctx.restore();
  if (G.t - H.hitAt < 0.28) { ctx.fillStyle = 'rgba(255,60,80,.20)'; ctx.beginPath(); ctx.arc(H.x, FLOOR - 42, 46, 0, 7); ctx.fill(); }
  // magazine pips under the hero
  const all = [...G.mag];
  all.forEach((tp, i) => {
    ctx.fillStyle = orbColor(tp);
    ctx.beginPath(); ctx.arc(H.x - (all.length - 1) * 11 + i * 22, FLOOR + 22, 6, 0, 7); ctx.fill();
  });
  for (let i = 0; i < G.cooling.length; i++) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(H.x + 44 + i * 14, FLOOR + 22, 5, 0, 7); ctx.fill(); }
}

function draw() {
  const L = G.level, P = L.scene.palette, a = ART();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * 10 * G.shake, (Math.random() - 0.5) * 8 * G.shake);

  if (a && a.drawBackdrop) a.drawBackdrop(ctx, L.scene, W, LH, G.t); else stubBackdrop(L.scene);

  // pit walls from the inset profile
  ctx.fillStyle = P.wall;
  ctx.beginPath(); ctx.moveTo(0, 0);
  for (let y = 0; y <= LH; y += 24) ctx.lineTo(pitLeft(y), y);
  ctx.lineTo(0, LH); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W, 0);
  for (let y = 0; y <= LH; y += 24) ctx.lineTo(pitRight(y), y);
  ctx.lineTo(W, LH); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = P.glow; ctx.lineWidth = 3;
  ctx.beginPath(); for (let y = 0; y <= LH; y += 24) { const x = pitLeft(y); y === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
  ctx.beginPath(); for (let y = 0; y <= LH; y += 24) { const x = pitRight(y); y === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();

  // deflectors
  for (const sg of deflectorSegs()) {
    ctx.strokeStyle = '#8fa3d9'; ctx.lineWidth = sg.r * 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sg.x1, sg.y1); ctx.lineTo(sg.x2, sg.y2); ctx.stroke();
    ctx.strokeStyle = P.accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sg.x1, sg.y1); ctx.lineTo(sg.x2, sg.y2); ctx.stroke();
  }
  // divider fins
  for (const fin of finGeoms()) {
    ctx.fillStyle = '#0d0d18'; ctx.strokeStyle = P.glow; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(fin.x - fin.half, fin.y0, fin.half * 2, fin.y1 - fin.y0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.glow; ctx.beginPath(); ctx.arc(fin.x, fin.y1, fin.half, 0, 7); ctx.fill();
  }

  // floor + catch zone
  ctx.fillStyle = 'rgba(10,12,28,.85)'; ctx.fillRect(0, FLOOR + 4, W, LH - FLOOR);
  ctx.strokeStyle = P.accent; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(pitLeft(FLOOR), FLOOR + 4); ctx.lineTo(pitRight(FLOOR), FLOOR + 4); ctx.stroke();
  ctx.fillStyle = 'rgba(94,231,255,.13)';
  ctx.fillRect(G.hero.x - 54, FLOOR - 64, 108, 68);

  for (const s of G.shards) { if (a && a.drawShard) a.drawShard(ctx, s.x, s.y, 11, G.t); else stubShard(s.x, s.y, 10); }
  for (const e of G.enemies) drawEnemy(e);

  ctx.strokeStyle = 'rgba(253,253,150,.9)'; ctx.lineWidth = 2;
  for (const ar of G.arcs) {
    ctx.beginPath(); ctx.moveTo(ar.x1, ar.y1);
    ctx.lineTo((ar.x1 + ar.x2) / 2 + (Math.random() - 0.5) * 18, (ar.y1 + ar.y2) / 2 + (Math.random() - 0.5) * 18);
    ctx.lineTo(ar.x2, ar.y2); ctx.stroke();
  }

  // orbs with fading trails
  for (const o of G.orbs) {
    const col = orbColor(o.primary ? 'primary' : o.type);
    for (let i = 0; i < o.trail.length; i++) {
      const tp = o.trail[i], f = (i + 1) / o.trail.length;
      ctx.globalAlpha = f * 0.30;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, o.r * (0.35 + f * 0.55), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 16;
    ctx.fillStyle = OTYPES[o.type].color; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.beginPath(); ctx.arc(o.x - 3, o.y - 3, 3.6, 0, 7); ctx.fill();
    if (o.type === 'ghost' || o.type === 'wraith') { ctx.strokeStyle = 'rgba(230,204,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 4 + Math.sin(G.t * 10) * 1.5, 0, 7); ctx.stroke(); }
    ctx.restore();
  }

  drawHero();

  // damage numbers (small, white) + score popups (bigger, coloured)
  ctx.textAlign = 'center';
  for (const p of G.dmgPops) {
    ctx.globalAlpha = Math.min(1, p.t * 2.4);
    ctx.fillStyle = '#ffffff'; ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(p.txt, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  for (const p of G.pops) {
    ctx.globalAlpha = Math.min(1, p.t * 2);
    ctx.fillStyle = p.color; ctx.font = `800 ${p.small ? 15 : 19}px system-ui, sans-serif`;
    ctx.fillText(p.txt, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  drawHUD();
  if (G.state === 'title') drawTitle();
  if (G.state === 'over') screenMsg('THE PIT WINS', [`Score ${G.score}`, `Kills ${G.kills} · Survived ${fmtTime(G.elapsed)}`, '', 'TAP TO RETRY']);
  if (G.state === 'win') screenMsg('PIT CLEARED!', [G.level.name, `Score ${G.score}`, `Kills ${G.kills} · Level ${G.xpLevel}`, G.levelIdx + 1 < LEVELS.length ? '' : '', G.levelIdx + 1 < LEVELS.length ? 'TAP FOR NEXT PIT' : 'TAP TO PLAY AGAIN']);
  if (G.state === 'levelup') drawCards();
  if (G.state === 'play' && G.elapsed < 4.5) {   // level intro card
    ctx.globalAlpha = Math.min(1, (4.5 - G.elapsed) / 1.2, G.elapsed / 0.4 + 0.2);
    ctx.textAlign = 'center'; ctx.fillStyle = P.accent; ctx.font = '900 30px system-ui, sans-serif';
    ctx.fillText(L.name, W / 2, LH * 0.22);
    ctx.fillStyle = '#e8eeff'; ctx.font = '500 15.5px system-ui, sans-serif';
    wrapText(L.intro, W / 2, LH * 0.22 + 30, W - 90, 21);
    ctx.globalAlpha = 1;
  }
}

function fmtTime(s) { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return `${m}:${String(ss).padStart(2, '0')}`; }
function goalProgress() {
  const g = G.level.goal;
  return Math.max(0, Math.min(1, g.type === 'kills' ? G.kills / g.target : G.elapsed / g.target));
}

function drawHUD() {
  // XP bar across the very top
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(0, 0, W, 8);
  ctx.fillStyle = '#54ffb0'; ctx.fillRect(0, 0, W * Math.min(1, G.xp / xpNeed(G.xpLevel)), 8);
  // top row: score centre, timer right, XP level left
  ctx.font = '800 21px system-ui, sans-serif';
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`${G.score}`, W / 2, 36);
  ctx.textAlign = 'right'; ctx.fillStyle = '#aef3ff'; ctx.fillText(fmtTime(G.elapsed), W - 16, 36);
  ctx.textAlign = 'left'; ctx.fillStyle = '#9fb4ff'; ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillText(`LV ${G.xpLevel}`, 52, 33);
  // bottom-left: HP hearts
  ctx.font = '800 20px system-ui, sans-serif'; ctx.fillStyle = '#ff5a6e'; ctx.textAlign = 'left';
  let hearts = '';
  for (let i = 0; i < G.maxHp; i++) hearts += i < G.hp ? '♥' : '♡';
  ctx.fillText(hearts, 12, LH - 14);
  // left rail: owned orb icons + counts (the real game's inventory rail)
  const counts = {};
  for (const t of G.magPool) counts[t] = (counts[t] || 0) + 1;
  let ry = 128;
  ctx.font = '800 13px system-ui, sans-serif';
  for (const t of Object.keys(counts)) {
    ctx.fillStyle = 'rgba(5,8,20,.55)'; ctx.beginPath(); ctx.roundRect(6, ry - 15, 40, 30, 8); ctx.fill();
    ctx.fillStyle = orbColor(t); ctx.beginPath(); ctx.arc(20, ry, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(`×${counts[t]}`, 30, ry + 5);
    ry += 38;
  }
  // right side: level progress / depth bar
  const bx = W - 16, by0 = 84, by1 = FLOOR - 60;
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(bx - 3, by0, 6, by1 - by0);
  ctx.fillStyle = G.level.scene.palette.glow;
  const ph = (by1 - by0) * goalProgress();
  ctx.fillRect(bx - 3, by1 - ph, 6, ph);
  ctx.fillStyle = '#fff'; ctx.font = '900 13px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('▼', bx, by0 - 8);
  ctx.fillText(`${Math.round(goalProgress() * 100)}%`, bx, by1 + 20);
  ctx.textAlign = 'right'; ctx.fillStyle = '#9fb4ff'; ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(G.level.name, W - 30, 60);
}

/* Title screen with level select (locked levels greyed). Fully data-driven:
   row pitch compresses so ANY number of levels fits (3 today, 18 after the
   LEVELS_MORE merge) — identical layout while the list is short. */
function titlePitch() {
  const y0 = LH * 0.40, avail = LH - y0 - 56;
  return Math.min(78, avail / LEVELS.length);
}
function levelRectsCalc() {
  const w = Math.min(400, W - 64), gap = 10, y0 = LH * 0.40;
  const pitch = titlePitch(), h = Math.min(64, pitch - gap);
  return LEVELS.map((_, i) => ({ x: (W - w) / 2, y: y0 + i * pitch, w, h }));
}
function drawTitle() {
  ctx.fillStyle = 'rgba(4,6,16,.78)'; ctx.fillRect(0, 0, W, LH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5ee7ff'; ctx.font = '900 46px system-ui, sans-serif';
  ctx.fillText('PITBALL', W / 2, LH * 0.26);
  ctx.fillStyle = '#ff9ecf'; ctx.fillText('VERITY', W / 2, LH * 0.26 + 52);
  ctx.fillStyle = '#e8eeff'; ctx.font = '600 16.5px system-ui, sans-serif';
  ctx.fillText('Move ◀ ▶ — she fires on her own.', W / 2, LH * 0.26 + 92);
  ctx.fillText('Catch the falling orbs to reload instantly.', W / 2, LH * 0.26 + 116);
  ctx.fillText('Nothing reaches the floor.', W / 2, LH * 0.26 + 140);
  const rects = levelRectsCalc(); G.levelRects = rects;
  LEVELS.forEach((L, i) => {
    const r = rects[i], locked = i >= unlocked, sel = i === G.selLevel;
    ctx.fillStyle = locked ? '#10142a' : sel ? '#1b2a5e' : '#141c42';
    ctx.strokeStyle = locked ? '#3a4066' : '#5ee7ff'; ctx.lineWidth = sel && !locked ? 3 : 1.5;
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = locked ? '#5a628a' : '#fff'; ctx.textAlign = 'left';
    if (r.h >= 60) {
      ctx.font = '800 19px system-ui, sans-serif';
      ctx.fillText(locked ? `🔒 ${L.name}` : `${i + 1}. ${L.name}`, r.x + 18, r.y + 30);
      ctx.fillStyle = locked ? '#454b70' : '#9fb4ff'; ctx.font = '600 13.5px system-ui, sans-serif';
      const goal = L.goal.type === 'kills' ? `${L.goal.target} kills` : `survive ${fmtTime(L.goal.target)}`;
      ctx.fillText(locked ? 'Clear the pit before this one' : goal, r.x + 18, r.y + 52);
    } else {   // compressed rows (long level list): name only, centred
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.fillText(locked ? `🔒 ${L.name}` : `${i + 1}. ${L.name}`, r.x + 14, r.y + r.h / 2 + 5);
    }
  });
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe95e'; ctx.font = '800 18px system-ui, sans-serif';
  ctx.fillText('TAP A PIT, OR TAP ANYWHERE TO DROP IN', W / 2, LH * 0.40 + LEVELS.length * titlePitch() + 34);
}
function clickLevel(lx, ly) {
  const rects = G.levelRects && G.levelRects.length ? G.levelRects : levelRectsCalc();
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h) {
      if (i < unlocked) { selectLevel(i, true); return true; }
      return true;   // tapped a locked pit: swallow, don't start
    }
  }
  return false;
}

function screenMsg(title, lines) {
  ctx.fillStyle = 'rgba(4,6,16,.72)'; ctx.fillRect(0, 0, W, LH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5ee7ff'; ctx.font = '900 44px system-ui, sans-serif';
  ctx.fillText(title, W / 2, LH * 0.34);
  ctx.fillStyle = '#e8eeff'; ctx.font = '600 19px system-ui, sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, LH * 0.34 + 52 + i * 30));
}

/* Level-up cards: canvas-drawn; CSS-pixel rects exported for taps/tests. */
function cardRectsCalc() {
  const cw = Math.min(168, (W - 56) / 3), ch = 216, gap = 14;
  const x0 = (W - (cw * 3 + gap * 2)) / 2, y0 = LH * 0.36;
  return [0, 1, 2].map(i => ({ x: x0 + i * (cw + gap), y: y0, w: cw, h: ch }));
}
function drawCards() {
  ctx.fillStyle = 'rgba(4,6,16,.78)'; ctx.fillRect(0, 0, W, LH);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe95e';
  ctx.font = '900 32px system-ui, sans-serif';
  ctx.fillText('LEVEL UP!', W / 2, LH * 0.30);
  ctx.fillStyle = '#9fb4ff'; ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('Pick one — tap or press 1 · 2 · 3', W / 2, LH * 0.30 + 30);
  const rects = cardRectsCalc(); G.cardRects = rects;
  G.cards.forEach((c, i) => {
    const r = rects[i];
    ctx.fillStyle = c.fusion ? '#2a1440' : '#141c42';
    ctx.strokeStyle = c.fusion ? '#ff9ecf' : '#5ee7ff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.fusion ? OTYPES[c.fusion.result].glow : (OTYPES[c.id] ? OTYPES[c.id].glow : '#ffe95e');
    ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + 44, 17, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 16px system-ui, sans-serif';
    wrapText(c.name, r.x + r.w / 2, r.y + 88, r.w - 16, 20);
    ctx.fillStyle = '#b9c6ff'; ctx.font = '500 13px system-ui, sans-serif';
    wrapText(c.desc, r.x + r.w / 2, r.y + 136, r.w - 18, 17);
    ctx.fillStyle = '#5ee7ff'; ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillText(`${i + 1}`, r.x + r.w / 2, r.y + r.h - 14);
  });
}
function wrapText(txt, cx, y, maxW, lh) {
  const words = txt.split(' '); let line = '', yy = y;
  ctx.save(); const prev = ctx.textAlign; ctx.textAlign = 'center';
  for (const w of words) {
    if (ctx.measureText(line + ' ' + w).width > maxW && line) { ctx.fillText(line, cx, yy); line = w; yy += lh; }
    else line = line ? line + ' ' + w : w;
  }
  if (line) ctx.fillText(line, cx, yy);
  ctx.textAlign = prev; ctx.restore();
}
function clickCard(lx, ly) {
  const rects = G.cardRects.length ? G.cardRects : cardRectsCalc();
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h) { pickCard(i); return true; }
  }
  return false;
}

/* ---------------- main loop + debug ---------------- */
let lastTs = 0;
function frame(ts) {
  const dt = Math.min(0.033, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function cssRects(rects) {
  const r = canvas.getBoundingClientRect();
  return rects.map(c => ({ x: r.left + view.ox + c.x * view.s, y: r.top + view.oy + c.y * view.s, w: c.w * view.s, h: c.h * view.s }));
}
window.__dbg = {
  get heroX() { return Math.round(G.hero.x); },
  get orbs() { return G.orbs.length; },
  get magReady() { return G.mag.length; },
  get enemies() { return G.enemies.length; },
  get kills() { return G.kills; },
  get level() { return G.xpLevel; },
  get xp() { return G.xp; },
  get hp() { return G.hp; },
  get maxHp() { return G.maxHp; },
  get state() { return G.state; },
  get score() { return G.score; },
  get elapsed() { return Math.round(G.elapsed); },
  get floorBreaches() { return G.floorBreaches; },
  get levelUps() { return G.levelUps; },
  get levelIdx() { return G.levelIdx; },
  get levelId() { return G.level.id; },
  get levelCount() { return LEVELS.length; },
  get finLevels() { return LEVELS.map((L, i) => ((L.scene && L.scene.props) || []).includes('divider-fin') ? i : -1).filter(i => i >= 0); },
  get formations() { return G.formations; },
  get finHits() { return G.finHits; },
  get goalProgress() { return Math.round(goalProgress() * 1000) / 1000; },
  get magPool() { return [...G.magPool]; },
  get cards() { return cssRects(G.cardRects); },
  get cardIds() { return G.cards.map(c => c.id); },
  get levelRects() { return cssRects(G.levelRects || levelRectsCalc()); },
  start() { newGame(G.levelIdx); G.state = 'play'; },
  selectLevel(i) { newGame(i); G.state = 'play'; },
  pick(i) { pickCard(i); },
};
