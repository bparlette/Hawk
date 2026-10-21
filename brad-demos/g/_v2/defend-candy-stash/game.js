// MICRO TOWER DEFENSE — Cat Arcade v2
// One lane, five waves, six hearts. Tap a tower type, tap a glowing plot, watch it fire.
// 3-second rule: the gold road = where the bad guys walk · dotted plots = where you build · the wave bar = the goal.
import {
  makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, ease, R, TAU, rr, circle, hexA, heartPath, fmt, panel,
} from '../_vendor/gp2x.js';

const W = 540, H = 960;
const AUTO = new URLSearchParams(location.search).has('auto');

const g = makeGame({
  id: 'defend-candy-stash', title: 'DEFEND THE CANDY STASH', sub: 'TAP TOWER · TAP PLOT · SAVE HALLOWEEN',
  hook: 'the trick-or-treaters are coming for your candy',
  w: W, h: H, bg: '#080512', style: 'toon', bloom: .95, ca: 0, vig: 1, scan: .14, grain: .05,  /* ca:0 — Cherie vetoed chromatic aberration */
});
/* one-call particle spray: g.burst(x, y, { n, color, colors, speed, size, life, add, kind }) */
g.burst = (x, y, o = {}) => g.fx.burst(x, y, o.n ?? 12, o);
/* wave-banner punch: element-level pop at the banner (no screen shake/ripple) */
const _showBanner = g.showBanner.bind(g);
g.showBanner = (txt, dur = 1.2) => {
  _showBanner(txt, dur);
  g.hitstop(.05);
  g.burst(W / 2, H * .36, { n: 26, color: '#ffd34d', colors: ['#ffd34d', '#fff', '#ff9a3c'], speed: 320, size: 5, life: .6, add: true });
  g.fx.emit('ring', W / 2, H * .36, { size: 220, life: .5, color: '#ffd34d', add: true, wide: 6 });
};
g.state = { wave: 1, lives: 6, gold: 0, left: 0, kills: 0 };

/* ================================================================ geometry */
const GX = 45, GY = 166, CW = 90, CH = 70, COLS = 5, ROWS = 9;
const cellX = c => GX + c * CW + CW / 2;
const cellY = r => GY + r * CH + CH / 2;
const GOLDI = { x: 468, y: 44 };

const PATH = [
  [0, 0], [0, 1], [0, 2],
  [1, 2], [2, 2], [3, 2], [4, 2],
  [4, 3], [4, 4],
  [3, 4], [2, 4], [1, 4], [0, 4],
  [0, 5], [0, 6],
  [1, 6], [2, 6], [3, 6], [4, 6],
  [4, 7], [4, 8],
];
const PKEY = new Set(PATH.map(([c, r]) => c * 100 + r));
const isPath = (c, r) => PKEY.has(c * 100 + r);
const inGrid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
const isPlot = (c, r) => inGrid(c, r) && !isPath(c, r) &&
  (isPath(c + 1, r) || isPath(c - 1, r) || isPath(c, r + 1) || isPath(c, r - 1));

/* waypoints: spawn above the lane, every path cell centre, then off the bottom */
const WPT = [{ x: cellX(0), y: GY - 66 }];
for (const [c, r] of PATH) WPT.push({ x: cellX(c), y: cellY(r) });
WPT.push({ x: cellX(4), y: GY + ROWS * CH + 58 });
const SEG = []; let TLEN = 0;
for (let i = 0; i < WPT.length - 1; i++) {
  const a = WPT[i], b = WPT[i + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  SEG.push({ a, b, len, at: TLEN, ang: Math.atan2(b.y - a.y, b.x - a.x) });
  TLEN += len;
}
const P = { x: 0, y: 0, ang: 0 };
function pathAt(d, out) {
  d = clamp(d, 0, TLEN - .01);
  let s = SEG[SEG.length - 1];
  for (let i = 0; i < SEG.length; i++) if (d < SEG[i].at + SEG[i].len) { s = SEG[i]; break; }
  const k = clamp((d - s.at) / s.len, 0, 1);
  out.x = lerp(s.a.x, s.b.x, k);
  out.y = lerp(s.a.y, s.b.y, k);
  out.ang = s.ang;
  return out;
}

const PLOTS = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isPlot(c, r)) {
  let early = 0;
  PATH.forEach(([pc, pr], i) => {
    if (Math.abs(pc - c) + Math.abs(pr - r) <= 2) early += 1 - i / PATH.length;
  });
  PLOTS.push({ c, r, x: cellX(c), y: cellY(r), tw: null, early, pulse: R() * TAU });
}
const plotAt = (c, r) => { for (const p of PLOTS) if (p.c === c && p.r === r) return p; return null; };

/* ================================================================ data */
const TDEF = [
  { id: 'arrow', name: 'PUMPKIN', cost: 50, col: '#ff9a3c', dmg: 9, rate: .42, range: 136, spd: 1000, kind: 'bolt', up: 45, tag: 'FAST' },
  { id: 'bomb', name: 'GARGOYLE', cost: 70, col: '#b0b0c8', dmg: 16, rate: 1.02, range: 130, spd: 560, kind: 'lob', splash: 64, up: 60, tag: 'SPLASH' },
  { id: 'frost', name: 'SCARECROW', cost: 60, col: '#ffd34d', dmg: 5, rate: .70, range: 128, spd: 680, kind: 'orb', slow: .5, slowT: 1.8, up: 50, tag: 'SLOW' },
];
const TUP = [0, 45, 80];
const ET = {
  grunt: { hp: 26, spd: 1.05, gold: 9, s: 1.00, col: '#f2f2f8', col2: '#8a8aa2' },
  runner: { hp: 18, spd: 1.95, gold: 10, s: .84, col: '#e8e0c8', col2: '#8a7a5a' },
  brute: { hp: 76, spd: .68, gold: 18, s: 1.26, col: '#7a4dff', col2: '#2a1a5e' },
  boss: { hp: 520, spd: .80, gold: 120, s: 1.76, col: '#ff8c2a', col2: '#8e3a0f' },
};
/* a round must resolve inside ~35s for the gate and for a real player's patience:
   ~34 enemies at ~0.22s spawn cadence + one boss = fast, loud, over. */
const WAVES = [
  { gap: .24, list: ['grunt', 'grunt', 'grunt', 'grunt'] },
  { gap: .22, list: ['grunt', 'runner', 'grunt', 'runner', 'grunt'] },
  { gap: .20, list: ['runner', 'grunt', 'brute', 'runner', 'grunt', 'runner'] },
  { gap: .22, list: ['grunt', 'runner', 'brute', 'boss', 'runner', 'brute'] },
];
const SPEED = 380;

/* ================================================================ runtime */
let towers, enemies, shots, coins, spawnQ, wave, waveT, waveIdx, lives, gold, kills,
  t, sel, arm, score, phase, phaseT, boss, hurtT, gpop, cleared, botT, started,
  deadEnded, rsT, shakeLives, hudGold, stashDanger;

function resetWorld() {
  towers = []; enemies = []; shots = []; coins = []; spawnQ = [];
  wave = 0; waveT = 0; waveIdx = 0; lives = 6; gold = 175; hudGold = { v: 175 }; kills = 0; t = 0;
  sel = null; arm = null; score = 0; phase = 'ready'; phaseT = 0; boss = null;
  hurtT = 0; gpop = 0; cleared = 0; botT = 0; deadEnded = false; rsT = 0; shakeLives = 0; stashDanger = 0;
  botTaps.length = 0;
  syncState();
}

/* ================================================================ baked world */
const BACK = document.createElement('canvas'); BACK.width = W; BACK.height = H;
const GROUND = document.createElement('canvas'); GROUND.width = W; GROUND.height = H;
(function bakeSky() {
  const c = BACK.getContext('2d');
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#070413'); sky.addColorStop(.32, '#150b33'); sky.addColorStop(.6, '#251045'); sky.addColorStop(1, '#0c0620');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  const gl = c.createRadialGradient(270, 430, 10, 270, 430, 470);
  gl.addColorStop(0, 'rgba(120,80,255,.26)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gl; c.fillRect(0, 0, W, H);
  c.save(); c.globalCompositeOperation = 'lighter';
  const mg = c.createRadialGradient(430, 132, 2, 430, 132, 110);
  mg.addColorStop(0, 'rgba(255,170,60,.55)'); mg.addColorStop(1, 'rgba(255,140,40,0)');
  c.fillStyle = mg; c.beginPath(); c.arc(430, 132, 110, 0, TAU); c.fill();
  c.restore();
  c.save(); c.shadowBlur = 26; c.shadowColor = 'rgba(255,170,70,.85)'; /* bloom: moon halo */
  c.fillStyle = 'rgba(255,190,90,.95)'; c.beginPath(); c.arc(452, 128, 34, 0, TAU); c.fill(); c.restore();
  c.fillStyle = 'rgba(230,150,60,.9)'; c.beginPath(); c.arc(442, 120, 30, 0, TAU); c.fill();
  // haunted house silhouette on the hill
  c.fillStyle = 'rgba(30,16,50,.9)';
  c.beginPath(); c.moveTo(60, 166); c.lineTo(60, 110); c.lineTo(110, 80); c.lineTo(160, 110); c.lineTo(160, 166); c.closePath(); c.fill();
  c.fillRect(96, 40, 28, 50); // crooked tower
  c.beginPath(); c.moveTo(90, 42); c.lineTo(110, 18); c.lineTo(130, 42); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,190,80,.75)'; // lit windows
  c.fillRect(78, 120, 12, 16); c.fillRect(130, 120, 12, 16); c.fillRect(103, 52, 10, 14);
  c.fillStyle = 'rgba(30,16,50,.9)';
  for (let i = 0; i < 12; i++) {
    const bx = 200 + i * 30 + (i % 3) * 8, bh = 30 + ((i * 37) % 5) * 20, bw = 18 + (i % 2) * 12;
    c.fillRect(bx, 166 - bh, bw, bh);
    if (i % 4 === 0) { c.fillStyle = 'rgba(255,170,80,.4)'; c.fillRect(bx + 5, 166 - bh + 10, 4, 4); c.fillStyle = 'rgba(30,16,50,.9)'; }
  }
  // bats
  c.strokeStyle = 'rgba(10,6,20,.85)'; c.lineWidth = 2.4; c.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const bx = 60 + (i * 67) % 420, by = 40 + (i * 53) % 90, s = 5 + (i % 3) * 2;
    c.beginPath(); c.moveTo(bx - s, by); c.quadraticCurveTo(bx - s / 2, by - s, bx, by);
    c.quadraticCurveTo(bx + s / 2, by - s, bx + s, by); c.stroke();
  }
  for (let i = 0; i < 70; i++) {
    c.fillStyle = `rgba(255,255,255,${.15 + R() * .6})`;
    c.beginPath(); c.arc(R() * W, R() * 300, R() * 1.5 + .4, 0, TAU); c.fill();
  }
})();
(function bakeGround() {
  const c = GROUND.getContext('2d');
  rr(c, 30, 152, 480, 660, 26); c.fillStyle = 'rgba(9,7,24,.78)'; c.fill();
  c.strokeStyle = 'rgba(150,120,255,.22)'; c.lineWidth = 2; c.stroke();
  for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) {
    if (isPath(cc, r)) continue;
    rr(c, GX + cc * CW + 3, GY + r * CH + 3, CW - 6, CH - 6, 9);
    c.fillStyle = ((cc + r) % 2) ? 'rgba(30,44,72,.55)' : 'rgba(24,36,62,.55)'; c.fill();
    c.strokeStyle = 'rgba(120,170,255,.08)'; c.lineWidth = 1; c.stroke();
  }
  const road = (x, y, w, h) => { rr(c, x, y, w, h, 12); c.fillStyle = '#2a2140'; c.fill(); };
  for (const [cc, r] of PATH) road(cellX(cc) - 40, cellY(r) - 27, 80, 54);
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    const ax = cellX(a[0]), ay = cellY(a[1]), bx = cellX(b[0]), by = cellY(b[1]);
    road(Math.min(ax, bx) - 27, Math.min(ay, by) - 27, Math.abs(bx - ax) + 54, Math.abs(by - ay) + 54);
  }
  for (const [cc, r] of PATH) {
    const x = cellX(cc) - 27, y = cellY(r) - 20;
    rr(c, x, y, 54, 40, 9); c.fillStyle = '#3a2f56'; c.fill();
    rr(c, x + 3, y + 3, 48, 34, 8); c.fillStyle = '#463a68'; c.fill();
  }
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    const ax = cellX(a[0]), ay = cellY(a[1]), bx = cellX(b[0]), by = cellY(b[1]);
    c.fillStyle = '#463a68';
    c.fillRect(Math.min(ax, bx) - 15, Math.min(ay, by) - 15, Math.abs(bx - ax) + 30, Math.abs(by - ay) + 30);
  }
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [cc, r] of PATH) {
    const x = cellX(cc), y = cellY(r);
    const rg = c.createRadialGradient(x, y, 4, x, y, 52);
    rg.addColorStop(0, 'rgba(255,180,80,.15)'); rg.addColorStop(1, 'rgba(255,150,60,0)');
    c.fillStyle = rg; c.fillRect(x - 52, y - 52, 104, 104);
  }
  c.restore();
})();

/* ================================================================ scenery */
const DUST = [];
for (let i = 0; i < 40; i++) DUST.push({ x: R() * W, y: 150 + R() * 800, s: .8 + R() * 2.2, p: R() * TAU, v: 6 + R() * 20, a: .08 + R() * .3 });
const ROCKS = [];
for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) if (!isPath(cc, r) && !isPlot(cc, r)) ROCKS.push({ x: cellX(cc) + rnd(-10, 10), y: cellY(r) + rnd(-6, 6), s: .6 + R() * .8, k: (cc + r) % 3 });

/* ================================================================ towers */
function towerStats(tw) {
  const d = TDEF.find(q => q.id === tw.kind) || TDEF[0], lv = tw.lvl;
  return {
    dmg: d.dmg * (1 + .62 * (lv - 1)),
    rate: d.rate * (1 - .12 * (lv - 1)),
    range: d.range + 11 * (lv - 1),
    splash: d.splash ? d.splash + 8 * (lv - 1) : 0,
    slow: d.slow, slowT: d.slowT, col: d.col, kind: d.kind, spd: d.spd,
  };
}
function placeTower(plot, kind) {
  if (typeof kind === 'number') kind = (TDEF[kind] || TDEF[0]).id;   // cards pass an index, the bot passes an id
  const d = TDEF.find(q => q.id === kind) || TDEF[0]; kind = d.id;
  if (!plot || plot.tw || gold < d.cost) { sfx('click'); return; }
  gold -= d.cost;
  const tw = {
    c: plot.c, r: plot.r, x: plot.x, y: plot.y, kind, lvl: 1, cd: rnd(0, .18),
    ang: -Math.PI / 2, recoil: 0, invested: d.cost, kills: 0, pop: 1, spin: R() * TAU,
  };
  plot.tw = tw; towers.push(tw);
  score += 5;
  sfx('powerup', { pitch: kind === 'bomb' ? .9 : kind === 'frost' ? 1.18 : 1 });
  tw.pop = 1.6; /* placement spring-in (element-level, no screen shake) */
  g.burst(plot.x, plot.y, { n: 16, color: d.col, speed: 210, size: 4, life: .5, add: true });
  g.fx.emit('ring', plot.x, plot.y, { size: 96, life: .36, color: d.col, add: true, wide: 5 });
  arm = null; sel = tw;
  syncState();
}
function upgradeTower(tw) {
  if (!tw || tw.lvl >= 3) return;
  const cost = TUP[tw.lvl];
  if (gold < cost) { sfx('click'); return; }
  gold -= cost; tw.invested += cost; tw.lvl++; tw.pop = 1.4; score += 15;
  sfx('ding', { pitch: 1 + .1 * tw.lvl }); sfx('powerup', { pitch: 1.2 });
  g.hitstop(.04);
  g.burst(tw.x, tw.y, { n: 22, color: '#ffd34d', colors: ['#ffd34d', '#fff', TDEF.find(q => q.id === tw.kind).col], speed: 260, size: 5, life: .6, add: true });
  g.fx.emit('ring', tw.x, tw.y, { size: 120, life: .45, color: '#ffd34d', add: true, wide: 7 });
  g.popup('LV' + tw.lvl, tw.x, tw.y - 46, '#ffd34d', 30);
  syncState();
}
function sellTower(tw) {
  if (!tw) return;
  const back = Math.round(tw.invested * .6);
  gold += back; plotAt(tw.c, tw.r).tw = null;
  towers = towers.filter(o => o !== tw);
  sfx('coin', { pitch: .8 }); sfx('thud');
  for (let i = 0; i < 6; i++) coins.push({ x: tw.x, y: tw.y, t: -i * .03, d: .42 + i * .03, jx: rnd(-18, 18), jy: rnd(-20, 4) });
  g.burst(tw.x, tw.y, { n: 18, color: '#8a8fa8', speed: 180, size: 4, life: .5 });
  g.popup('+' + back, tw.x, tw.y - 30, '#ffd34d', 28);
  if (sel === tw) sel = null;
  syncState();
}

/* ================================================================ enemies */
function spawnEnemy(type) {
  const def = ET[type];
  const e = {
    // NB: `d` is the path progress in px — never shadow it with the enemy definition
    type, d: 0, hp: def.hp, max: def.hp, spd: def.spd, x: 0, y: 0, ang: 0,
    slow: 0, slowT: 0, fl: 0, wob: R() * TAU, dead: 0, hit: 0, sc: def.s,
  };
  pathAt(0, e);
  e.x = WPT[0].x; e.y = WPT[0].y - 30;
  enemies.push(e);
  if (type === 'boss') {
    boss = e; g.showBanner('BOSS!', 1.1); music('boss');
    sfx('boom', { pitch: .6 });
    g.fx.emit('ring', e.x, e.y, { size: 260, life: .6, color: '#ff5a4d', add: true, wide: 12 });
  }
  return e;
}
function damage(e, amt, o = {}) {
  if (e.dead) return;
  e.hp -= amt;
  e.fl = 1; e.hit = 1;
  if (o.slow) { e.slowT = Math.max(e.slowT, o.slowT); e.slow = Math.max(e.slow, o.slow); }
  g.fx.emit('spark', e.x, e.y - 14, { n: o.n || 5, color: o.col || '#fff', speed: 210, size: 3, life: .3, add: true });
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  e.dead = .001; e.fl = 1; /* death pop: sprite flashes white as it bursts */
  const dx = e.x, dy = e.y - 10, def = ET[e.type];
  const gain = def.gold;                     // NB: e.d is path progress, the payout lives in ET[type]
  gold += gain; kills++;
  score += Math.round(gain * 4 + (e.type === 'boss' ? 400 : 0));
  g.combo.hit(dx, dy - 20, '+' + gain);
  g.hitstop(e.type === 'boss' ? .14 : .06); /* hit-stop only — no punch/shake/ripple (Cherie veto) */
  g.burst(dx, dy, { n: e.type === 'boss' ? 60 : 22, color: def.col, colors: [def.col, def.col2, '#fff'], speed: 330, size: 5, life: .7, add: true });
  g.fx.emit('shard', dx, dy, { n: e.type === 'boss' ? 18 : 8, color: def.col2, speed: 260, size: 7, life: .7, g: 700 });
  g.fx.emit('ring', dx, dy, { size: e.type === 'boss' ? 220 : 90, life: .4, color: def.col, add: true, wide: e.type === 'boss' ? 12 : 6 });
  if (e.type === 'boss') { g.slowmo(.5, .35); music('action'); }
  sfx('boom', { pitch: e.type === 'boss' ? .5 : 1.3 - def.hp / 400, vol: .8 });
  for (let i = 0; i < 3; i++) coins.push({ x: dx, y: dy, t: -i * .05, d: .42 + i * .04, jx: rnd(-22, 22), jy: rnd(-26, 2) });
  syncState();
}
function leak(e) {
  lives--; shakeLives = 1; hurtT = 1;
  e.dead = -1; e.gone = true;
  g.hitstop(.07);
  g.burst(e.x, e.y - 14, { n: 26, color: '#ff2b5e', speed: 300, size: 5, life: .6, add: true });
  g.popup('-1', e.x, e.y - 40, '#ff2b5e', 40);
  sfx('lose', { pitch: 1.4, vol: .5 }); sfx('thud');
  if (e === boss) boss = null;
  syncState();
}

/* ================================================================ firing */
function fire(tw, target, st) {
  const barrelX = tw.x + Math.cos(tw.ang) * 18, barrelY = tw.y - 2 + Math.sin(tw.ang) * 14;
  tw.recoil = 1;
  const s = {
    kind: st.kind, x: barrelX, y: barrelY, ox: barrelX, oy: barrelY,
    px: barrelX, py: barrelY, tx: target.x, ty: target.y - 12,
    t: 0, target, dmg: st.dmg, splash: st.splash, slow: st.slow, slowT: st.slowT,
    col: st.col, spd: st.spd, trail: 0,
  };
  const dd = Math.hypot(s.tx - s.x, s.ty - s.y);
  s.dur = st.kind === 'lob' ? clamp(dd / st.spd, .3, .85) : clamp(dd / st.spd, .04, .5);
  s.arc = st.kind === 'lob' ? 54 + dd * .3 : 0;
  s.drawY = barrelY;
  shots.push(s);
  if (st.kind === 'bolt') sfx('shoot', { pitch: 1.25, vol: .32 });
  else if (st.kind === 'lob') sfx('whoosh', { pitch: .75, vol: .4 });
  else sfx('laser', { pitch: 1.5, vol: .26 });
  g.burst(barrelX, barrelY, { n: 6, color: st.col, colors: [st.col, '#fff'], speed: 170, size: 4, life: .18, add: true });
  tw.kills++;
}
function impact(s) {
  if (s.splash) {
    for (const e of enemies) {
      if (e.dead || e.gone) continue;
      const dd = Math.hypot(e.x - s.tx, e.y - 12 - s.ty);
      if (dd < s.splash) damage(e, s.dmg * (1 - dd / s.splash * .45), { col: s.col, n: 6 });
    }
    g.burst(s.tx, s.ty, { n: 20, color: s.col, colors: [s.col, '#ffd34d', '#fff'], speed: s.splash * 5, size: 7, life: .5, kind: 'spark' });
    for (let i = 0; i < 6; i++) g.fx.emit('smoke', s.tx + (R() - .5) * s.splash * .5, s.ty + (R() - .5) * s.splash * .5, { vx: (R() - .5) * 90, vy: -30 - R() * 70, g: -20, life: .9 + R() * .5, size: s.splash * (.35 + R() * .4), color: '#2a2f3a', drag: .6 });
    g.fx.emit('ring', s.tx, s.ty, { size: s.splash * 1.7, life: .38, color: '#ffd34d', add: true, wide: 8 });
    sfx('boom', { pitch: 1.1, vol: .7 });
    g.hitstop(.035);
  } else {
    const e = s.target;
    if (e && !e.dead && !e.gone) damage(e, s.dmg, { col: s.col, slow: s.slow, slowT: s.slowT, n: 7 });
    g.burst(s.tx, s.ty, { n: 7, color: s.col, colors: [s.col, '#fff'], speed: 220, size: 3.4, life: .3, add: true });
    g.fx.emit('ring', s.tx, s.ty, { size: 44, life: .2, color: s.col, add: true, wide: 4 });
    sfx('hit', { pitch: 1.5 + R() * .3, vol: .38 });
    if (s.slow) sfx('laser', { pitch: 1.8, vol: .2 });
  }
}

/* ================================================================ waves */
function startWave() {
  wave++;
  spawnQ = WAVES[Math.min(wave - 1, WAVES.length - 1)].list.slice();
  waveT = 0; waveIdx = 0;
  phase = 'wave'; phaseT = 0;
  g.showBanner('WAVE ' + wave, .95);
  sfx('powerup', { pitch: .9 + wave * .05 });
  if (wave === 5) { music('boss'); }
  syncState();
}
function waveClear() {
  cleared = wave;
  gold += 30; score += 220; gpop = 1;
  g.fx.emit('ring', 270, 480, { size: 420, life: .7, color: '#7dff7a', add: true, wide: 10 });
  if (wave >= WAVES.length) {
    phase = 'win'; phaseT = 0;
    g.showBanner('LANE HELD!', 1.6);
    g.slowmo(.8, .5); sfx('win'); music('epic');
    g.burst(W / 2, 330, { n: 90, color: '#ffd34d', colors: ['#ffd34d', '#7dff7a', '#7df9ff', '#fff'], speed: 480, size: 7, life: 1.7, kind: 'confetti', g: 380 });
    g.burst(W / 2, 420, { n: 60, color: '#ffd34d', colors: ['#ffd34d', '#7df9ff', '#fff'], speed: 420, size: 6, life: 1.4, add: true });
    syncState();
    return;
  }
  phase = 'breather'; phaseT = 0;
  g.showBanner('WAVE CLEAR', .8);
  sfx('ding', { pitch: 1.1 });
  g.burst(270, 470, { n: 30, color: '#7dff7a', speed: 300, size: 5, life: .8, add: true });
  syncState();
}

/* ================================================================ input */
const botTaps = [];
const TAPBUF = [];
const CARD = i => ({ x: 24 + i * 168, y: 806, w: 156, h: 92 });
const INSP = { up: { x: 24, y: 806, w: 240, h: 92 }, sell: { x: 276, y: 806, w: 240, h: 92 } };
const inRect = (p, r) => !!p && !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

function readInput() {
  TAPBUF.length = 0;
  for (const p of g.taps) TAPBUF.push(p);
  for (const p of botTaps) TAPBUF.push(p);
  botTaps.length = 0;

  if (g.pressed.Digit1 || g.pressed.KeyA) arm = arm === 'arrow' ? null : 'arrow';
  if (g.pressed.Digit2 || g.pressed.KeyS) arm = arm === 'bomb' ? null : 'bomb';
  if (g.pressed.Digit3 || g.pressed.KeyD) arm = arm === 'frost' ? null : 'frost';
  if (g.pressed.KeyU || g.pressed.Enter) { if (sel) upgradeTower(sel); }
  if (g.pressed.KeyX || g.pressed.Backspace) { if (sel) sellTower(sel); }
  if (g.pressed.Escape) { sel = null; arm = null; }

  for (const p of TAPBUF) {
    if (sel) {
      if (inRect(p, INSP.up)) { upgradeTower(sel); continue; }
      if (inRect(p, INSP.sell)) { sellTower(sel); continue; }
    } else {
      let hit = false;
      for (let i = 0; i < 3; i++) if (inRect(p, CARD(i))) {
        arm = arm === TDEF[i].id ? null : TDEF[i].id;
        sfx('click', { pitch: 1 + i * .1 });
        hit = true; break;
      }
      if (hit) continue;
    }
    const c = Math.floor((p.x - GX) / CW), r = Math.floor((p.y - GY) / CH);
    if (inGrid(c, r)) {
      const pl = plotAt(c, r);
      if (pl) {
        if (pl.tw) { sel = pl.tw; arm = null; sfx('click', { pitch: .9 }); syncState(); }
        else if (arm) placeTower(pl, arm);
        else { sfx('click'); g.popup('PICK A TOWER', cellX(c), cellY(r) - 6, '#9aa4c8', 20); sel = null; }
      } else if (isPath(c, r)) {
        g.burst(p.x, p.y, { n: 4, color: '#8a8fa8', speed: 80, size: 2, life: .25 });
        sfx('click', { pitch: .7 });
      } else sel = null;
      continue;
    }
    if (p.y < 160 || p.y > 900) sel = null;
  }
}

/* ================================================================ bot */
function plotScore(p, range) {
  let v = 0;
  PATH.forEach(([c, r], i) => {
    const dd = Math.hypot(cellX(c) - p.x, cellY(r) - p.y);
    if (dd <= range) v += (1.5 - i / PATH.length) * (1 - dd / range * .4);
  });
  return v;
}
function bestPlot(kind) {
  const range = TDEF.find(d => d.id === kind).range;
  let best = null, bv = -1e9;
  for (const p of PLOTS) {
    if (p.tw) continue;
    const v = plotScore(p, range);
    if (v > bv) { bv = v; best = p; }
  }
  return best;
}
const PLAN = ['arrow', 'bomb', 'frost', 'arrow', 'arrow', 'bomb', 'frost', 'arrow'];
function botThink(dt) {
  botT = Math.max(0, botT - dt);
  if (phase === 'win' || phase === 'dead') return;
  if (g.dumb()) {
    if (!g.dumbSet) {
      g.dumbSet = true;
      const exitPlot = PLOTS.filter(p => !p.tw).sort((a, b) => (b.c + b.r) - (a.c + a.r))[0];
      if (exitPlot) botTaps.push({ x: CARD(0).x + 40, y: CARD(0).y + 40 }, { x: exitPlot.x, y: exitPlot.y });
    }
    return;
  }
  if (botT > 0) return;
  if (sel) {
    const cost = sel.lvl >= 3 ? 1e9 : TUP[sel.lvl];
    if (gold >= cost && towers.length >= 4) { botTaps.push({ x: INSP.up.x + 40, y: INSP.up.y + 40 }); botT = .14; return; }
    botTaps.push({ x: 270, y: 934 }); botT = .1; return;
  }
  if (towers.length < PLAN.length) {
    const kind = PLAN[towers.length];
    const cost = TDEF.find(d => d.id === kind).cost;
    if (gold >= cost) {
      const p = bestPlot(kind);
      if (p) {
        const ci = TDEF.findIndex(d => d.id === kind);
        botTaps.push({ x: CARD(ci).x + 40, y: CARD(ci).y + 40 }, { x: p.x, y: p.y });
        botT = .1;
      }
    }
    return;
  }
  if (gold >= 110) {
    const tw = towers.slice().sort((a, b) => (a.lvl - b.lvl) || (b.kills - a.kills))[0];
    if (tw && tw.lvl < 3) { botTaps.push({ x: tw.x, y: tw.y }, { x: INSP.up.x + 40, y: INSP.up.y + 40 }); botT = .14; }
  }
}

/* ================================================================ update */
function syncState() {
  g.state = { wave: Math.max(1, wave), lives: Math.max(0, lives), gold, left: enemies.length, kills };
}

function update(dt) {
  if (g.mode !== 'play') return;
  if (!started) { started = true; music('action'); }
  const live = dt > 0;
  if (AUTO || g.dumb()) botThink(dt);
  readInput();
  if (!live) return;

  t += dt;
  g.combo.update(dt);
  hurtT = Math.max(0, hurtT - dt * 1.6);
  gpop = Math.max(0, gpop - dt * 4);
  /* SAVE THE CANDY danger pulse: nearest live enemy's distance to the stash */
  let nearest = 1e9;
  for (const e of enemies) if (!e.dead && !e.gone) nearest = Math.min(nearest, TLEN - e.d);
  const wantDanger = nearest < 340 ? 1 - nearest / 340 : 0;
  stashDanger = Math.max(wantDanger, stashDanger - dt * 1.4);
  rsT = Math.max(0, rsT - dt * 1.8);
  shakeLives = Math.max(0, shakeLives - dt * 2.2);
  hudGold.v = gold;

  if (phase === 'ready' || phase === 'breather') {
    phaseT += dt;
    if (phaseT >= (phase === 'ready' ? .5 : .4)) startWave();
  }
  if (phase === 'wave') {
    waveT += dt;
    const w = WAVES[Math.min(wave - 1, WAVES.length - 1)];
    while (waveIdx < spawnQ.length && waveT >= waveIdx * w.gap) {
      spawnEnemy(spawnQ[waveIdx]);
      waveIdx++;
    }
    if (waveIdx >= spawnQ.length && enemies.length === 0) waveClear();
  }
  if (phase === 'win') {
    phaseT += dt;
    if (phaseT > 1.5) { g.end({ win: true, score, label: 'SCORE', progress: 1 }); return; }
  }
  if (phase === 'dead') {
    phaseT += dt;
    if (phaseT > .9 && !deadEnded) {
      deadEnded = true;
      g.end({ win: false, score, label: 'SCORE', progress: clamp((cleared + (waveIdx / 12)) / WAVES.length, .05, .95) });
      return;
    }
  }

  /* enemies */
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead > 0) { e.dead += dt; if (e.dead > .5) enemies.splice(i, 1); continue; }
    if (e.gone) { enemies.splice(i, 1); continue; }
    e.fl = Math.max(0, e.fl - dt * 5);
    e.hit = Math.max(0, e.hit - dt * 4);
    e.wob += dt * (e.type === 'runner' ? 18 : 7);
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
    e.d += SPEED * e.spd * (1 - e.slow) * dt;
    pathAt(e.d, e);
    if (e.d >= TLEN - 2) {
      if (e === boss) lives -= 3;
      leak(e);
      if (lives <= 0) { lives = 0; if (phase !== 'dead') { phase = 'dead'; phaseT = 0; g.slowmo(.4, .6); } }
    }
  }

  syncState();

  /* towers */
  for (const tw of towers) {
    tw.pop = Math.max(0, tw.pop - dt * 3.4);
    tw.recoil = Math.max(0, tw.recoil - dt * 7);
    tw.spin += dt * (tw.kind === 'frost' ? 1.6 : .6);
    const st = towerStats(tw);
    tw.cd -= dt;
    let target = null, bestD = -1;
    for (const e of enemies) {
      if (e.dead || e.gone) continue;
      if (Math.hypot(e.x - tw.x, e.y - 12 - tw.y) > st.range) continue;
      if (e.d > bestD) { bestD = e.d; target = e; }
    }
    if (target) {
      const want = Math.atan2(target.y - 12 - tw.y, target.x - tw.x);
      const diff = ((want - tw.ang + Math.PI * 3) % TAU) - Math.PI;
      tw.ang += diff * Math.min(1, dt * 16);
      if (tw.cd <= 0) { fire(tw, target, st); tw.cd = st.rate; }
    }
  }

  /* shots */
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    const e = s.target && !s.target.dead && !s.target.gone ? s.target : null;
    const tx = e ? e.x : s.tx, ty = e ? e.y - 12 : s.ty;
    if (s.kind === 'lob') {
      s.t += dt;
      const k = clamp(s.t / s.dur, 0, 1);
      s.x = lerp(s.ox, tx, k); s.y = lerp(s.oy, ty, k);
      s.drawY = s.y - Math.sin(k * Math.PI) * s.arc;
      if (k >= 1) { s.tx = tx; s.ty = ty; impact(s); shots.splice(i, 1); }
    } else {
      const dx = tx - s.x, dy = ty - s.y, dd = Math.hypot(dx, dy) || 1;
      const step = s.spd * dt;
      if (dd <= step + 5) { s.x = tx; s.y = ty; impact(s); shots.splice(i, 1); continue; }
      s.px = s.x; s.py = s.y;
      s.x += dx / dd * step; s.y += dy / dd * step;
      if (s.kind === 'orb') {
        s.trail += dt;
        if (s.trail > .025) { s.trail = 0; g.burst(s.x, s.y, { n: 2, color: s.col, speed: 26, size: 6, life: .28, add: true, g: 0 }); }
      }
    }
  }

  /* coins */
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.t += dt;
    if (c.t > c.d && !c.paid) { c.paid = true; gpop = 1; sfx('coin', { pitch: 1.4 + R() * .5, vol: .35 }); }
    if (c.t > c.d + .1) coins.splice(i, 1);
  }

  for (const d of DUST) { d.y -= d.v * dt; d.p += dt; if (d.y < 120) { d.y = 980; d.x = R() * W; } }
  syncState();
}
g.onReset = () => { g.dumbSet = false; resetWorld(); };

/* ================================================================ draw */
function draw(ctx) {
  ctx.drawImage(BACK, 0, 0);
  // dust motes = depth layer drifting over the baked parallax horizon
  ctx.save();
  for (const d of DUST) {
    ctx.globalAlpha = d.a * (.5 + .5 * Math.sin(d.p * 2));
    ctx.fillStyle = '#bcd0ff';
    ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = .3;
  ctx.drawImage(BACK, 0, 0, W, 170, 0, Math.sin(t * .5) * 3, W, 170);
  ctx.restore();

  ctx.drawImage(GROUND, 0, 0);

  for (const r of ROCKS) {
    ctx.save(); ctx.translate(r.x, r.y); ctx.globalAlpha = .5;
    ctx.fillStyle = r.k === 0 ? '#2c3c58' : r.k === 1 ? '#26344c' : '#31425e';
    ctx.beginPath(); ctx.ellipse(0, 0, 13 * r.s, 8 * r.s, .3, 0, TAU); ctx.fill();
    ctx.globalAlpha = .3; ctx.fillStyle = '#7fa0d0';
    ctx.beginPath(); ctx.ellipse(-3, -3, 6 * r.s, 3 * r.s, .3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawChevrons(ctx);

  for (const p of PLOTS) {
    if (p.tw) continue;
    const pulse = .5 + .5 * Math.sin(t * 2.4 + p.pulse);
    ctx.save();
    ctx.translate(p.x, p.y);
    rr(ctx, -28, -22, 56, 44, 10);
    ctx.setLineDash(arm ? [7, 6] : [4, 7]);
    ctx.lineDashOffset = -t * (arm ? 26 : 10);
    ctx.lineWidth = arm ? 2.6 : 1.6;
    const col = arm ? TDEF.find(d => d.id === arm).col : '#7fb0ff';
    ctx.strokeStyle = hexA(col, arm ? .35 + pulse * .55 : .14 + pulse * .16);
    ctx.stroke();
    ctx.setLineDash([]);
    if (arm) { ctx.globalAlpha = .1 + pulse * .18; ctx.fillStyle = col; ctx.fill(); }
    ctx.globalAlpha = arm ? .6 : .22;
    ctx.strokeStyle = arm ? col : '#9fb8e8';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
    ctx.restore();
  }

  if (sel) {
    const st = towerStats(sel);
    ctx.save();
    ctx.globalAlpha = .5;
    ctx.strokeStyle = hexA(st.col, .55);
    ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.arc(sel.x, sel.y, st.range, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = .07; ctx.fillStyle = st.col;
    ctx.beginPath(); ctx.arc(sel.x, sel.y, st.range, 0, TAU); ctx.fill();
    ctx.restore();
  }

  for (const tw of towers) drawTower(ctx, tw);
  for (const e of enemies) drawEnemy(ctx, e);
  for (const s of shots) drawShot(ctx, s);
  for (const c of coins) drawCoin(ctx, c);

  drawHud(ctx);
  g.combo.draw(ctx);
}

function drawChevrons(ctx) {
  ctx.save();
  ctx.globalAlpha = .5;
  const off = (t * 70) % 46;
  ctx.strokeStyle = 'rgba(255,196,90,.5)';
  ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    const ax = cellX(a[0]), ay = cellY(a[1]), bx = cellX(b[0]), by = cellY(b[1]);
    const len = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    for (let s = -off; s < len; s += 46) {
      if (s < 6) continue;
      const x = ax + ux * s, y = ay + uy * s;
      const nx = -uy, ny = ux;
      ctx.beginPath();
      ctx.moveTo(x - ux * 5 + nx * 7, y - uy * 5 + ny * 7);
      ctx.lineTo(x + ux * 5, y + uy * 5);
      ctx.lineTo(x - ux * 5 - nx * 7, y - uy * 5 - ny * 7);
      ctx.stroke();
    }
  }
  const sp = WPT[0], ex = WPT[WPT.length - 1];
  ctx.globalAlpha = .85;
  ctx.fillStyle = '#ff5a4d';
  ctx.beginPath(); ctx.moveTo(sp.x, sp.y - 4); ctx.lineTo(sp.x + 22, sp.y - 24); ctx.lineTo(sp.x - 22, sp.y - 24); ctx.closePath(); ctx.fill();
  // the CANDY STASH: a pile of candy to defend
  ctx.globalAlpha = 1;
  const bob = Math.sin(t * 3) * 2;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(ex.x, 950, 30, 9, 0, 0, TAU); ctx.fill();
  const candies = [['#ff5a4d', -14, 0], ['#ffd34d', 0, -4], ['#7df9ff', 14, 0], ['#ff9f1c', -7, -10], ['#c26bff', 7, -10], ['#fff', 0, -16]];
  for (const [cc2, ox, oy] of candies) {
    ctx.fillStyle = cc2;
    ctx.beginPath(); ctx.arc(ex.x + ox, 942 + oy + bob, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.arc(ex.x + ox - 2, 940 + oy + bob, 2.4, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = .35 + .45 * (.5 + .5 * Math.sin(t * 4));
  ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(ex.x, 944, 34, 0, TAU); ctx.stroke();
  ctx.restore();
}

function drawTower(ctx, tw) {
  const d = TDEF.find(q => q.id === tw.kind), st = towerStats(tw);
  const pop = 1 + tw.pop * .35;
  ctx.save();
  ctx.translate(tw.x, tw.y + 6);
  ctx.scale(pop, pop);
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  ctx.beginPath(); ctx.ellipse(0, 16, 30, 11, 0, 0, TAU); ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + Math.PI / 6;
    const px = Math.cos(a) * 27, py = Math.sin(a) * 15 - 2;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, -18, 0, 14);
  bg.addColorStop(0, '#4a5578'); bg.addColorStop(1, '#232a44');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = hexA(st.col, .75); ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(-9 + i * 9, 12, 2.6, 0, TAU);
    ctx.fillStyle = i < tw.lvl ? '#ffd34d' : 'rgba(255,255,255,.15)'; ctx.fill();
  }
  ctx.restore();

  const rec = tw.recoil;
  ctx.save();
  ctx.translate(tw.x - Math.cos(tw.ang) * rec * 5, tw.y - 2 - Math.sin(tw.ang) * rec * 5);
  ctx.rotate(tw.ang);
  ctx.scale(1 + rec * .12, 1 - rec * .18);
  if (tw.kind === 'arrow') {
    // JACK-O'-LANTERN: pumpkin head cannon
    ctx.fillStyle = '#c2571a';
    ctx.beginPath(); ctx.ellipse(2, 0, 16, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff9a3c';
    ctx.beginPath(); ctx.ellipse(2, -2, 12, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a6a2a'; ctx.fillRect(0, -17, 5, 7); // stem
    const glow = .6 + .4 * Math.sin(t * 6 + tw.x);
    ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(255,200,90,.9)'; /* bloom: pumpkin face */
    ctx.fillStyle = `rgba(255,230,120,${glow})`; // glowing face
    ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(17, -1); ctx.lineTo(12, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(12, 3); ctx.lineTo(20, 3); ctx.lineTo(16, 8); ctx.lineTo(12, 5); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; /* reset bloom */
  } else if (tw.kind === 'bomb') {
    // GARGOYLE: stone head mortar
    ctx.fillStyle = '#6a6a80';
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a8aa2';
    ctx.beginPath(); ctx.arc(-3, -3, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a3a4c'; // horns
    ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(-14, -20); ctx.lineTo(-5, -13); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(14, -20); ctx.lineTo(5, -13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5a2a'; // glowing eyes
    ctx.beginPath(); ctx.arc(-4, -2, 2.6, 0, TAU); ctx.arc(4, -2, 2.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a3a4c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 6, 6, .2, Math.PI - .2); ctx.stroke();
  } else {
    // SCARECROW: straw hat spinner
    ctx.fillStyle = '#8a6a3a';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
    ctx.save(); ctx.rotate(tw.spin);
    ctx.fillStyle = d.col;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rad = i % 2 ? 5 : 16; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#c9a44a'; // straw hat
    ctx.beginPath(); ctx.ellipse(0, -4, 15, 5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -8, 8, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath(); ctx.arc(-4, 0, 1.8, 0, TAU); ctx.arc(4, 0, 1.8, 0, TAU); ctx.fill();
  }
  ctx.restore();

  if (rec > .05) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 18 * rec; ctx.shadowColor = d.col; /* bloom: muzzle halo */
    const mx = tw.x + Math.cos(tw.ang) * 24, my = tw.y - 2 + Math.sin(tw.ang) * 24;
    const R2 = 26 * rec + 6;
    const gr = ctx.createRadialGradient(mx, my, 1, mx, my, R2);
    gr.addColorStop(0, hexA(d.col, .8 * rec)); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(mx, my, R2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (tw === sel) {
    ctx.save(); ctx.globalAlpha = .5 + .5 * Math.sin(t * 8);
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(tw.x, tw.y, 34, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(ctx, e) {
  const d = e.d;
  const dying = e.dead > 0;
  const k = dying ? Math.max(0, 1 - e.dead / .5) : 1;
  const wob = Math.sin(e.wob) * (e.type === 'runner' ? 2 : 3.4);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.globalAlpha = dying ? k : 1;
  if (dying) { ctx.rotate((1 - k) * 1.6); ctx.scale(1 + (1 - k) * .5, k); }
  ctx.scale(d.s, d.s);
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.ellipse(0, 2, 17, 6.5, 0, 0, TAU); ctx.fill();

  const body = e.fl > 0 ? '#fff' : d.col;
  const dark = e.slowT > 0 ? '#9fe9ff' : d.col2;

  if (e.type === 'grunt') {
    // GHOST KID: white sheet costume
    ctx.save(); ctx.translate(0, -14 + wob);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, -2, 17, 16, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); // wavy sheet bottom
    ctx.moveTo(-17, 4);
    for (let i = 0; i < 5; i++) ctx.quadraticCurveTo(-13 + i * 7, 14 + (i % 2) * 4, -9 + i * 7, 6);
    ctx.lineTo(17, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0c1420'; // eye holes
    ctx.beginPath(); ctx.ellipse(-6, -3, 4, 5.4, 0, 0, TAU); ctx.ellipse(6, -3, 4, 5.4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 6, 3, 4, 0, 0, TAU); ctx.fill(); // mouth hole
    ctx.restore();
  } else if (e.type === 'runner') {
    ctx.save(); ctx.translate(0, -13 + wob * .5);
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-5, 0); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-8, -7); ctx.lineTo(-4, 0); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(3, -1, 2.4, 0, TAU); ctx.fill();
    ctx.globalAlpha *= .5;
    ctx.strokeStyle = d.col; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const yy = -6 + i * 6, l = 10 + ((e.wob * 7 + i * 3) % 12);
      ctx.beginPath(); ctx.moveTo(-12, yy); ctx.lineTo(-12 - l, yy); ctx.stroke();
    }
    ctx.restore();
  } else if (e.type === 'brute') {
    ctx.save(); ctx.translate(0, -17 + wob * .6);
    ctx.fillStyle = dark; rr(ctx, -22, -20, 44, 40, 11); ctx.fill();
    ctx.fillStyle = body; rr(ctx, -17, -15, 34, 30, 9); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, -13, 6, 26, 5, 2); ctx.fill();
    ctx.fillStyle = '#ffe14d'; rr(ctx, -13, -8, 26, 7, 3); ctx.fill();
    ctx.fillStyle = '#1a0f22';
    ctx.fillRect(-3, -8, 3, 7); ctx.fillRect(4, -8, 3, 7);
    ctx.fillStyle = dark;
    rr(ctx, -26, -12, 8, 16, 4); ctx.fill();
    rr(ctx, 18, -12, 8, 16, 4); ctx.fill();
    ctx.restore();
  } else {
    ctx.save(); ctx.translate(0, -22 + wob * .5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .25 + .15 * Math.sin(t * 4);
    const ag = ctx.createRadialGradient(0, 0, 6, 0, 0, 58);
    ag.addColorStop(0, 'rgba(255,80,60,.9)'); ag.addColorStop(1, 'rgba(255,40,20,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(0, 0, 58, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = dark; rr(ctx, -28, -26, 56, 52, 13); ctx.fill();
    ctx.fillStyle = body; rr(ctx, -22, -20, 44, 40, 11); ctx.fill();
    ctx.fillStyle = '#1a0a12'; rr(ctx, -16, -8, 32, 10, 4); ctx.fill();
    ctx.fillStyle = '#ffe14d'; rr(ctx, -12, -5, 9, 4, 2); ctx.fill(); rr(ctx, 3, -5, 9, 4, 2); ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(-18, -24); ctx.lineTo(-12, -36); ctx.lineTo(-6, -27); ctx.lineTo(0, -38);
    ctx.lineTo(6, -27); ctx.lineTo(12, -36); ctx.lineTo(18, -24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(0, -31, 2.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  if (dying) return;
  const w = e.type === 'boss' ? 62 : 30;
  const bx = e.x - w / 2, by = e.y - (e.type === 'boss' ? 108 : e.type === 'brute' ? 72 : 60);
  if (e.hp < e.max) {
    ctx.fillStyle = 'rgba(0,0,0,.62)';
    rr(ctx, bx - 1, by - 1, w + 2, 6, 3); ctx.fill();
    ctx.fillStyle = e.type === 'boss' ? '#ff5a4d' : '#ff9a3c';
    rr(ctx, bx, by, w * clamp(e.hp / e.max, 0, 1), 4, 2); ctx.fill();
  }
  if (e.slowT > 0) {
    ctx.save(); ctx.globalAlpha = .6;
    ctx.strokeStyle = '#9fe9ff'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(e.x, e.y - 16, e.type === 'boss' ? 40 : 22, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

function drawShot(ctx, s) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (s.kind === 'bolt') {
    const ang = Math.atan2(s.y - s.py, s.x - s.px) || 0;
    ctx.strokeStyle = s.col; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(ang) * 28, s.y - Math.sin(ang) * 28);
    ctx.lineTo(s.x, s.y); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(s.x - Math.cos(ang) * 15, s.y - Math.sin(ang) * 15); ctx.lineTo(s.x, s.y); ctx.stroke();
  } else if (s.kind === 'lob') {
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .3; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 7, 3, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = s.col;
    ctx.beginPath(); ctx.arc(s.x, s.drawY, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.arc(s.x - 2, s.drawY - 2, 3.4, 0, TAU); ctx.fill();
    ctx.globalAlpha = .35; ctx.strokeStyle = s.col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.drawY, 12, 0, TAU); ctx.stroke();
  } else {
    const gr = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 16);
    gr.addColorStop(0, '#fff'); gr.addColorStop(.4, s.col); gr.addColorStop(1, 'rgba(80,220,255,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, s.y, 16, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawCoin(ctx, c) {
  const k = clamp(c.t / c.d, 0, 1);
  if (k < 0) return;
  const ez = k * k * (3 - 2 * k);
  const x = lerp(c.x, GOLDI.x, ez) + Math.sin(k * Math.PI) * c.jx;
  const y = lerp(c.y, GOLDI.y, ez) + Math.sin(k * Math.PI) * c.jy - Math.sin(k * Math.PI) * 40;
  const s = 1 - ez * .45;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
  ctx.fillStyle = '#b47b00'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(-2.4, -2.4, 2, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawHud(ctx) {
  ctx.save();
  const gd = ctx.createLinearGradient(0, 0, 0, 118);
  gd.addColorStop(0, 'rgba(10,6,26,.92)'); gd.addColorStop(1, 'rgba(10,6,26,0)');
  ctx.fillStyle = gd; ctx.fillRect(0, 0, W, 118);
  ctx.restore();

  ctx.save();
  rr(ctx, 18, 14, 156, 38, 12);
  ctx.fillStyle = 'rgba(40,24,80,.9)'; ctx.fill();
  ctx.strokeStyle = 'rgba(170,130,255,.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  g.text('WAVE', 30, 41, { size: 19, color: '#b9a6ee' });
  g.text(Math.min(Math.max(wave, 1), WAVES.length) + '/' + WAVES.length, 100, 42, { size: 24, color: '#fff' });

  const shake = shakeLives * 6;
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.translate(32 + i * 30 + (i >= lives ? Math.sin(t * 40) * shake : 0), 78);
    if (i < lives) {
      const beat = 1 + Math.sin(t * 5 + i) * .06;
      ctx.scale(beat, beat);
      heartPath(ctx, 0, 0, 24);
      const hg = ctx.createLinearGradient(0, -12, 0, 8);
      hg.addColorStop(0, '#ff6b8a'); hg.addColorStop(1, '#d21d3c');
      ctx.fillStyle = hg; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    } else {
      heartPath(ctx, 0, 0, 24);
      ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fill();
    }
    ctx.restore();
  }

  const bx = 210, by = 64, bw = 216, bh = 12;
  rr(ctx, bx, by, bw, bh, 6); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
  const prog = phase === 'wave' ? clamp(waveIdx / Math.max(1, spawnQ.length), 0, 1) : (phase === 'breather' || phase === 'win' ? 1 : 0);
  if (prog > 0) {
    rr(ctx, bx + 1, by + 1, (bw - 2) * prog, bh - 2, 5);
    const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    pg.addColorStop(0, '#7dff7a'); pg.addColorStop(1, '#ffd34d');
    ctx.fillStyle = pg; ctx.fill();
  }
  g.text(phase === 'wave' ? (spawnQ.length - waveIdx) + ' LEFT' : 'NEXT WAVE', bx + bw / 2, by + 11, { size: 15, color: '#cfd8f5', align: 'center' });
  { /* danger pulse: the meter throbs as trick-or-treaters close in (element-level) */
    const dz = stashDanger, zp = 1 + dz * .22 * (0.6 + 0.4 * Math.sin(t * 14));
    ctx.save(); ctx.translate(bx + bw / 2, by + 34); ctx.scale(zp, zp);
    if (dz > .1) { ctx.shadowBlur = 12 * dz; ctx.shadowColor = dz > .45 ? 'rgba(255,80,80,.9)' : 'rgba(255,170,90,.8)'; } /* bloom */
    g.text('SAVE THE CANDY', 0, 0, { size: 13, color: dz > .45 ? '#ff6b6b' : dz > .15 ? '#ffb36b' : '#8f9ac0', align: 'center' });
    ctx.restore();
  }

  const gp = 1 + gpop;
  ctx.save(); ctx.translate(GOLDI.x - 48, GOLDI.y); ctx.scale(gp, gp);
  ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(255,200,70,.8)'; /* bloom: gold coin */
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
  ctx.fillStyle = '#c98a00'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(-4, -4, 3.4, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(GOLDI.x + 8, GOLDI.y + 2); ctx.scale(gp, gp);
  g.text('' + Math.round(hudGold.v), 0, 12, { size: 32, color: '#ffd34d', align: 'right' });
  ctx.restore();

  if (sel) {
    inspectorBtn(ctx, INSP.up, 'UPGRADE', sel.lvl >= 3 ? 'MAX' : TUP[sel.lvl] + 'g', sel.lvl < 3 && gold >= TUP[sel.lvl], '#ffd34d');
    inspectorBtn(ctx, INSP.sell, 'SELL', '+' + Math.round(sel.invested * .6) + 'g', true, '#ff8fc8');
    g.text(TDEF.find(q => q.id === sel.kind).name + '  LV' + sel.lvl, 270, 930, { size: 16, color: '#9fb8e8', align: 'center' });
  } else {
    for (let i = 0; i < 3; i++) {
      const d = TDEF[i], r = CARD(i);
      const armed = arm === d.id, afford = gold >= d.cost;
      ctx.save();
      rr(ctx, r.x, r.y, r.w, r.h, 16);
      const cg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      if (armed) { cg.addColorStop(0, hexA(d.col, .42)); cg.addColorStop(1, hexA(d.col, .14)); }
      else { cg.addColorStop(0, 'rgba(30,22,60,.92)'); cg.addColorStop(1, 'rgba(16,12,34,.92)'); }
      ctx.fillStyle = cg; ctx.fill();
      ctx.strokeStyle = armed ? d.col : 'rgba(150,130,255,.35)';
      ctx.lineWidth = armed ? 3 : 2; ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.translate(r.x + 30, r.y + 44); ctx.scale(.72, .72);
      ctx.fillStyle = d.col;
      if (d.id === 'arrow') {
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, TAU); ctx.fill(); // mini pumpkin
        ctx.fillStyle = '#2a1a0a';
        ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(8, 0); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();
      } else if (d.id === 'bomb') {
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); // mini gargoyle
        ctx.fillStyle = '#ff5a2a';
        ctx.beginPath(); ctx.arc(-4, -2, 2.4, 0, TAU); ctx.arc(4, -2, 2.4, 0, TAU); ctx.fill();
      } else {
        ctx.beginPath(); ctx.ellipse(0, -2, 13, 4, 0, 0, TAU); ctx.fill(); // mini straw hat
        ctx.beginPath(); ctx.ellipse(0, -6, 7, 6, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
      g.text(d.name, r.x + 54, r.y + 36, { size: 19, color: armed ? '#fff' : '#dbe4ff' });
      g.text(d.cost + 'g', r.x + 54, r.y + 64, { size: 19, color: afford ? '#ffd34d' : '#ff6b6b' });
      g.text(d.tag, r.x + 54, r.y + 84, { size: 12, color: '#8f9ac0' });
      if (!afford) { ctx.save(); ctx.globalAlpha = .35; rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore(); }
      g.text('' + (i + 1), r.x + r.w - 12, r.y + 20, { size: 12, color: '#6f7aa8', align: 'right' });
    }
    g.text(arm ? 'TAP A GLOWING PLOT TO BUILD' : 'STOP THE TRICK-OR-TREATERS', 270, 928, { size: 15, color: arm ? TDEF.find(d => d.id === arm).col : '#7c88b4', align: 'center' });
  }

  if (boss && !boss.dead) {
    const k = clamp(boss.hp / boss.max, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(ctx, 96, 132, 348, 16, 8); ctx.fill();
    rr(ctx, 98, 134, 344 * k, 12, 6);
    const bg2 = ctx.createLinearGradient(98, 0, 442, 0);
    bg2.addColorStop(0, '#ff2b5e'); bg2.addColorStop(1, '#ffd34d');
    ctx.fillStyle = bg2; ctx.fill();
    ctx.restore();
    g.text('THE WARDEN', 270, 130, { size: 13, color: '#fff', align: 'center' });
  }

  if (hurtT > 0) {
    ctx.save();
    ctx.globalAlpha = hurtT * .55;
    const rg = ctx.createRadialGradient(270, 480, 160, 270, 480, 560);
    rg.addColorStop(0, 'rgba(255,0,60,0)'); rg.addColorStop(1, 'rgba(255,20,60,.85)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (wave === 0 && g.mode === 'play') {
    ctx.save(); ctx.globalAlpha = .45 + .25 * Math.sin(t * 5);
    g.text('BUILD BESIDE THE ROAD', 270, 856, { size: 20, color: '#fff', align: 'center' });
    ctx.restore();
  }
}
function inspectorBtn(ctx, r, label, sub, on, col) {
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, 16);
  const cg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  cg.addColorStop(0, on ? hexA(col, .32) : 'rgba(40,20,30,.7)');
  cg.addColorStop(1, on ? hexA(col, .1) : 'rgba(20,12,24,.7)');
  ctx.fillStyle = cg; ctx.fill();
  ctx.strokeStyle = on ? col : 'rgba(120,90,120,.4)'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
  g.text(label, r.x + r.w / 2, r.y + 40, { size: 24, color: on ? '#fff' : '#7a6a80', align: 'center' });
  g.text(sub, r.x + r.w / 2, r.y + 70, { size: 20, color: on ? col : '#7a6a80', align: 'center' });
}

/* ================================================================ boot */
resetWorld();
g.run(update, draw);
window.__g = g;
window.__dbg = () => ({ ...g.state, towers: towers.length, phase, attempt: g.attempt, mode: g.mode, t: Math.round(t*100)/100, waveT: Math.round(waveT*100)/100, waveIdx, sq: spawnQ.length, e0: enemies[0] ? [Math.round(enemies[0].d), enemies[0].spd, Math.round(enemies[0].x), Math.round(enemies[0].y)] : null, botT: Math.round(botT*100)/100, btaps: botTaps.length });
