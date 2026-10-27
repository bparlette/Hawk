// MISO: STARLIGHT ADVENTURE — a one-level 16-bit homebrew platformer.
// Feel per gamepress NINTENDO-FEEL: variable jump (release cut), speed-scaled
// jump height, diminishing-returns acceleration, coyote time + jump buffer,
// stomp bounce, hit-stop freeze on stomps. Tile world built from segments.
'use strict';
import { TouchController, isTouchDevice } from './gptouch.js';
const VW = 480, VH = 270, TILE = 30;
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const AUTO = new URLSearchParams(location.search).get('auto') === '1';
window.__events = [];
function ev(name, data) { window.__events.push(Object.assign({ t: performance.now() | 0, name }, data || {})); }

// ---------- assets ----------
const IMG = {};
Object.keys(window.MS_ASSETS || {}).forEach(k => { const im = new Image(); im.src = window.MS_ASSETS[k]; IMG[k] = im; });

// ---------- audio: NES-style synth ----------
let AC = null;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); }
function tone(freq, dur, type, vol, slideTo, delay) {
  if (!AC) return; const t0 = AC.currentTime + (delay || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol || 0.12, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noiseBurst(dur, vol, delay) {
  if (!AC) return; const t0 = AC.currentTime + (delay || 0);
  const len = Math.max(1, (AC.sampleRate * dur) | 0), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = AC.createBufferSource(); s.buffer = buf;
  const g = AC.createGain(); g.gain.value = vol || 0.15;
  const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
  s.connect(f); f.connect(g); g.connect(AC.destination); s.start(t0);
}
const SFX = {
  jump() { tone(280, 0.16, 'square', 0.10, 660); },
  stomp() { noiseBurst(0.09, 0.20); tone(220, 0.10, 'square', 0.12, 55); },
  star() { [880, 1174, 1568].forEach((f, i) => tone(f, 0.09, 'square', 0.09, null, i * 0.055)); },
  bump() { tone(140, 0.07, 'square', 0.10, 90); },
  hurt() { tone(320, 0.28, 'sawtooth', 0.10, 70); },
  pop() { tone(520, 0.06, 'square', 0.08, 900); },
  check() { [523, 659, 784].forEach((f, i) => tone(f, 0.10, 'triangle', 0.14, null, i * 0.07)); },
  bell() { [1568, 1568, 2093].forEach((f, i) => tone(f, 0.30, 'sine', 0.16, null, i * 0.16)); tone(784, 0.5, 'triangle', 0.08, null, 0); },
  fanfare() { [523, 523, 523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.11, null, i * 0.13)); },
  die() { tone(520, 0.6, 'square', 0.10, 60); },
};
// cheerful original chiptune loop: 8 bars, square lead + triangle bass
const LEAD = [523,0,659,0, 784,0,659,0, 880,0,784,659, 784,0,0,0, 523,0,659,0, 784,0,880,0, 1046,0,880,784, 880,0,0,0,
              659,0,784,0, 880,0,784,0, 988,0,880,784, 880,0,0,0, 784,0,659,0, 587,0,659,0, 784,0,0,0, 0,0,0,0];
const BASS = [131,0,196,0, 165,0,196,0, 175,0,196,0, 196,0,262,0, 131,0,196,0, 165,0,196,0, 175,0,220,0, 262,0,196,0,
              165,0,196,0, 175,0,196,0, 220,0,196,0, 247,0,196,0, 196,0,175,0, 147,0,175,0, 196,0,0,0, 0,0,0,0];
let musicOn = false, musicStep = 0, musicNext = 0;
function musicUpdate() {
  if (!AC || !musicOn) return;
  const spb = 0.135; // seconds per 8th note
  while (musicNext < AC.currentTime + 0.18) {
    const i = musicStep % LEAD.length, dl = Math.max(0, musicNext - AC.currentTime);
    if (LEAD[i]) tone(LEAD[i], 0.12, 'square', 0.055, null, dl);
    if (BASS[i]) tone(BASS[i], 0.13, 'triangle', 0.10, null, dl);
    if (i % 2 === 0) noiseBurst(0.02, 0.018, dl);
    musicStep++; musicNext += spb;
  }
}

// ---------- world ----------
const ROWS = 9, COLS = 156;
const grid = new Uint8Array(ROWS * COLS); // 0 empty, 1 ground, 2 dirt, 3 brick, 4 starblock, 5 platform, 6 starblock-used
const G = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS) ? 1 : grid[y * COLS + x];
const SET = (x, y, v) => { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) grid[y * COLS + x] = v; };
const pickups = [], spawns = [];
let pops = [];
let checkpointX = 2 * TILE, goalX = 0;
function buildLevel() {
  grid.fill(0); pickups.length = 0; spawns.length = 0;
  const ground = (x0, x1) => { for (let x = x0; x <= x1; x++) { SET(x, 7, 1); SET(x, 8, 2); } };
  const star = (x, y) => pickups.push({ x: x * TILE + 15, y: y * TILE + 15, got: false, ph: Math.random() * 6 });
  const starRow = (x0, x1, y) => { for (let x = x0; x <= x1; x++) star(x, y); };
  ground(0, 19); ground(24, 41); ground(46, 57); ground(64, 83); ground(88, 110); ground(116, 155);
  // intro: stars + first beetle
  starRow(6, 8, 6); spawns.push({ k: 'beetle', x: 13 * TILE, y: 6 * TILE });
  // star blocks row
  [16, 17, 18].forEach(x => SET(x, 4, 4)); star(17, 3);
  // after pit 1: slime + platform stars
  spawns.push({ k: 'slime', x: 27 * TILE, y: 6 * TILE });
  [29, 30, 31].forEach(x => SET(x, 4, 5)); starRow(29, 31, 3);
  spawns.push({ k: 'beetle', x: 33 * TILE, y: 6 * TILE });
  starRow(36, 38, 6);
  // steps up to a high shelf (drop onto segment 3)
  SET(37, 6, 3); SET(38, 5, 3); SET(39, 4, 3); [40, 41].forEach(x => SET(x, 4, 5)); starRow(39, 41, 3);
  // pit 2 with a bat
  spawns.push({ k: 'bat', x: 44 * TILE, y: 2 * TILE });
  // checkpoint meadow: beetle pair
  spawns.push({ k: 'beetle', x: 53 * TILE, y: 6 * TILE }); spawns.push({ k: 'beetle', x: 56 * TILE, y: 6 * TILE });
  starRow(51, 53, 5);
  // platform hop chain over the long pit (58..63)
  [58, 59].forEach(x => SET(x, 5, 5)); [60, 61].forEach(x => SET(x, 4, 5)); [62, 63].forEach(x => SET(x, 5, 5));
  star(59, 4); star(61, 3); star(63, 4);
  // slime flats + star block
  spawns.push({ k: 'slime', x: 67 * TILE, y: 6 * TILE }); spawns.push({ k: 'slime', x: 71 * TILE, y: 6 * TILE });
  SET(68, 4, 4);
  [74, 75, 76].forEach((x, i) => { for (let y = 6; y >= 6 - i; y--) SET(x, y, 3); }); // staircase up
  [77, 78, 79, 80, 81, 82].forEach(x => SET(x, 3, 5)); starRow(78, 81, 2);
  // pit 3 with bat
  spawns.push({ k: 'bat', x: 86 * TILE, y: 2 * TILE });
  // second checkpoint stretch
  spawns.push({ k: 'beetle', x: 93 * TILE, y: 6 * TILE }); spawns.push({ k: 'beetle', x: 96 * TILE, y: 6 * TILE });
  spawns.push({ k: 'slime', x: 100 * TILE, y: 6 * TILE });
  // block bridge with stars above, beetle below
  for (let x = 102; x <= 109; x++) SET(x, 4, 3); starRow(103, 108, 3);
  spawns.push({ k: 'beetle', x: 105 * TILE, y: 6 * TILE });
  // final pit: mid platform + bat
  SET(112, 5, 5); SET(113, 5, 5); star(112, 4); star(113, 4);
  spawns.push({ k: 'bat', x: 114 * TILE, y: 2 * TILE });
  // home stretch
  spawns.push({ k: 'slime', x: 121 * TILE, y: 6 * TILE }); spawns.push({ k: 'beetle', x: 126 * TILE, y: 6 * TILE });
  starRow(128, 132, 5);
  SET(138, 6, 3); SET(139, 5, 3);
  goalX = 144 * TILE;
  checkpointX = 2 * TILE;
}
const CHECKPOINTS = [50 * TILE, 90 * TILE];

// ---------- entities ----------
let phase = 'title'; // title -> card -> play -> clear / over
let player, enemies, camX = 0, score, lives, hearts, starsGot, timeLeft, cardT = 0, clearT = 0, hitstop = 0, clearInfo = null;
let respawnX = 2 * TILE, timeAcc = 0, hiScore = 0, playT = 0;
function newPlayer(x) {
  return { x, y: 6 * TILE, w: 20, h: 26, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, jbuf: 0, ifr: 0, animT: 0, dead: false, deadT: 0, squash: 0 };
}
function spawnEnemies() {
  enemies = spawns.map(s => ({ k: s.k, x: s.x, y: s.y, w: s.k === 'bat' ? 30 : 24, h: s.k === 'bat' ? 20 : 22, vx: s.k === 'beetle' ? -22 : 0, vy: 0, dir: -1, t: Math.random() * 2, dead: false, squash: 0, ax: s.x, ay: s.y, active: false }));
}
function startRun() {
  buildLevel(); spawnEnemies();
  score = 0; lives = 3; hearts = 3; starsGot = 0; timeLeft = 300; respawnX = checkpointX;
  player = newPlayer(respawnX); camX = 0; phase = 'card'; cardT = 1.8; playT = 0;
  musicOn = false; ev('run_start', {});
}
function respawn() {
  buildLevel(); spawnEnemies();
  hearts = 3; timeLeft = Math.max(timeLeft, 120);
  player = newPlayer(respawnX); camX = clamp(respawnX - 120, 0, COLS * TILE - VW);
  phase = 'card'; cardT = 1.4; musicOn = false;
}
function solidAt(px, py) { return G(Math.floor(px / TILE), Math.floor(py / TILE)) > 0; }
function moveBox(e, dt) {
  // X axis
  e.x += e.vx * dt;
  if (e.vx > 0) { const tx = Math.floor((e.x + e.w) / TILE); for (let ty = Math.floor(e.y / TILE); ty <= Math.floor((e.y + e.h - 1) / TILE); ty++) if (G(tx, ty) > 0) { e.x = tx * TILE - e.w - 0.01; e.hitWall = true; break; } }
  else if (e.vx < 0) { const tx = Math.floor(e.x / TILE); for (let ty = Math.floor(e.y / TILE); ty <= Math.floor((e.y + e.h - 1) / TILE); ty++) if (G(tx, ty) > 0) { e.x = (tx + 1) * TILE + 0.01; e.hitWall = true; break; } }
  // Y axis
  e.y += e.vy * dt; e.ground = false;
  if (e.vy > 0) { const ty = Math.floor((e.y + e.h) / TILE); for (let tx = Math.floor(e.x / TILE); tx <= Math.floor((e.x + e.w - 1) / TILE); tx++) if (G(tx, ty) > 0) { e.y = ty * TILE - e.h - 0.01; e.vy = 0; e.ground = true; e.landTy = ty; break; } }
  else if (e.vy < 0) { const ty = Math.floor(e.y / TILE); for (let tx = Math.floor(e.x / TILE); tx <= Math.floor((e.x + e.w - 1) / TILE); tx++) { const t = G(tx, ty); if (t > 0) { e.y = (ty + 1) * TILE + 0.01; e.vy = 0; e.bumpTy = ty; e.bumpTx = tx; break; } } }
}
function pop(x, y, text, color) { pops.push({ x, y, text, color: color || '#fff', t: 1.0 }); }
function addScore(n, x, y) { score += n; if (x !== undefined) pop(x, y, '' + n, '#ffd94a'); }

// ---------- input ----------
const keys = {};
let jumpBufKey = false;
addEventListener('keydown', e => { keys[e.code] = true; audio(); if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault(); if (e.code === 'Space' || e.code === 'KeyK' || e.code === 'KeyJ') jumpBufKey = true; });
addEventListener('keyup', e => { keys[e.code] = false; });
let TC = null;
try { if (isTouchDevice()) TC = new TouchController({ buttons: [{ id: 'a', label: 'JUMP', size: 86 }, { id: 'b', label: 'RUN', size: 66 }], maxRadius: 56, deadzone: 0.18 }); } catch (e) {}
let tiPrevA = false;
function readInput() {
  const it = { x: 0, jumpH: false, jumpP: false, run: false };
  if (keys.ArrowLeft || keys.KeyA) it.x -= 1;
  if (keys.ArrowRight || keys.KeyD) it.x += 1;
  it.jumpH = !!(keys.Space || keys.KeyK || keys.KeyJ);
  it.run = !!(keys.ShiftLeft || keys.ShiftRight || keys.KeyX);
  if (TC) {
    const t = TC.getInput();
    if (Math.abs(t.x) > 0.3) it.x = Math.sign(t.x);
    it.jumpH = it.jumpH || !!t.a; it.run = it.run || !!t.b;
    if (t.a && !tiPrevA) it.jumpP = true;
    tiPrevA = !!t.a;
  }
  if (jumpBufKey) { it.jumpP = true; jumpBufKey = false; }
  return it;
}
function botInput() {
  // autoplay: run right, jump walls/gaps/enemies — for capture + testing
  const it = { x: 1, jumpH: false, jumpP: false, run: true };
  const p = player, feetY = p.y + p.h;
  const aheadX = p.x + p.w + 6;
  const wallAhead = solidAt(aheadX, p.y + 6) || solidAt(aheadX, feetY - 6);
  const groundAhead = solidAt(p.x + p.w + 14, feetY + 10) || solidAt(p.x + p.w / 2, feetY + 10);
  let enemyAhead = false;
  enemies.forEach(e => { if (!e.dead && e.x > p.x && e.x - p.x < 44 && Math.abs(e.y - p.y) < 30) enemyAhead = true; });
  if (p.ground && (wallAhead || !groundAhead || enemyAhead)) { it.jumpP = true; it.jumpH = true; }
  if (!p.ground && p.vy < 0) it.jumpH = true;
  return it;
}

// ---------- gameplay ----------
function hurtPlayer(fromX) {
  if (player.ifr > 0 || player.dead) return;
  hearts--; SFX.hurt(); ev('hurt', { hearts });
  if (hearts <= 0) { killPlayer(); return; }
  player.ifr = 1.6; player.vx = (player.x < fromX ? -130 : 130); player.vy = -260;
}
function killPlayer() {
  if (player.dead) return;
  player.dead = true; player.deadT = 0; player.vy = -420; SFX.die(); musicOn = false; ev('death', { lives });
}
function updatePlay(dt) {
  playT += dt; timeAcc += dt;
  if (timeAcc >= 1) { timeAcc -= 1; timeLeft--; if (timeLeft <= 0) { timeLeft = 0; killPlayer(); } }
  const it = AUTO ? botInput() : readInput();
  const p = player;
  if (p.dead) {
    p.deadT += dt; p.vy += 1500 * dt; p.y += p.vy * dt;
    if (p.deadT > 1.15) { lives--; if (lives < 0) { phase = 'over'; ev('gameover', { score }); } else respawn(); }
    return;
  }
  // --- movement: diminishing-returns accel (gpfeel) ---
  const maxSp = it.run ? 215 : 168;
  if (it.x !== 0) {
    p.vx += it.x * (1.9 - Math.abs(p.vx) / 120) * 640 * dt * 0.16;
    if (Math.abs(p.vx) > maxSp) p.vx = Math.sign(p.vx) * Math.max(maxSp, Math.abs(p.vx) - 900 * dt);
    p.face = Math.sign(it.x);
  } else {
    const dec = p.ground ? 1500 : 300;
    p.vx = Math.abs(p.vx) <= dec * dt ? 0 : p.vx - Math.sign(p.vx) * dec * dt;
  }
  if (p.ground) p.coyote = 0.09; else p.coyote -= dt;
  if (it.jumpP) p.jbuf = 0.12; else p.jbuf -= dt;
  if (p.jbuf > 0 && (p.ground || p.coyote > 0)) {
    // speed-scaled jump: running jumps go higher (gpfeel jumpSpeedBonus)
    p.vy = -(520 + Math.abs(p.vx) * 0.32);
    p.jbuf = 0; p.coyote = 0; p.ground = false; SFX.jump(); ev('jump', {});
  }
  if (!it.jumpH && p.vy < -180) p.vy = -180; // variable jump: release cut
  p.vy = Math.min(760, p.vy + 1500 * dt);
  p.hitWall = false; p.bumpTy = -1;
  moveBox(p, dt);
  // star block bump
  if (p.bumpTy >= 0) {
    const t = G(p.bumpTx, p.bumpTy);
    if (t === 4) {
      SET(p.bumpTx, p.bumpTy, 6); SFX.star(); starsGot++; addScore(100, p.bumpTx * TILE + 15, p.bumpTy * TILE - 6);
      pop(p.bumpTx * TILE + 15, p.bumpTy * TILE - 18, '★', '#ffd94a'); ev('star_block', { stars: starsGot });
      if (starsGot % 30 === 0) { lives++; pop(p.x + 10, p.y - 14, '1UP!', '#7CFC9A'); }
    } else if (t === 3 || t === 1) SFX.bump();
  }
  if (p.x < 0) p.x = 0;
  if (p.y > VH + 80) { hearts = 0; killPlayer(); p.deadT = 0.6; }
  p.animT += Math.abs(p.vx) * dt * 0.06;
  if (p.ifr > 0) p.ifr -= dt;
  if (p.squash > 0) p.squash -= dt;
  // checkpoints
  CHECKPOINTS.forEach(cx0 => { if (respawnX < cx0 && p.x >= cx0) { respawnX = cx0; addScore(500); SFX.check(); pop(cx0, 6 * TILE, 'CHECKPOINT!', '#7CFC9A'); ev('checkpoint', { x: cx0 }); } });
  // goal
  if (p.x + p.w >= goalX) {
    phase = 'clear'; clearT = 0; musicOn = false; SFX.bell();
    const timeBonus = timeLeft * 10, starBonus = starsGot * 50;
    clearInfo = { timeBonus, starBonus, total: score + timeBonus + starBonus };
    score = clearInfo.total; hiScore = Math.max(hiScore, score);
    ev('clear', { score, stars: starsGot, time: timeLeft });
    return;
  }
  // pickups
  pickups.forEach(s => {
    if (s.got) return;
    const bobY = s.y + Math.sin(playT * 3 + s.ph) * 3;
    if (Math.abs(p.x + p.w / 2 - s.x) < 22 && Math.abs(p.y + p.h / 2 - bobY) < 26) {
      s.got = true; starsGot++; addScore(100, s.x, s.y - 8); SFX.pop(); ev('star', { stars: starsGot });
      if (starsGot % 30 === 0) { lives++; pop(p.x + 10, p.y - 14, '1UP!', '#7CFC9A'); }
    }
  });
  // enemies
  enemies.forEach(e => {
    if (e.dead) { if (e.squash < 0.5) e.squash += dt; return; }
    if (!e.active) { if (e.x < camX + VW + 60) e.active = true; else return; }
    e.t += dt;
    if (e.k === 'beetle') {
      e.vy = Math.min(700, e.vy + 1500 * dt); e.hitWall = false;
      const oldVx = e.vx; moveBox(e, dt);
      if (e.hitWall) e.vx = -oldVx;
      // turn at ledges
      if (e.ground) { const aheadX = e.vx > 0 ? e.x + e.w + 4 : e.x - 4; if (!solidAt(aheadX, e.y + e.h + 8)) e.vx = -e.vx; }
    } else if (e.k === 'slime') {
      e.vy = Math.min(700, e.vy + 1500 * dt); e.hitWall = false;
      if (e.ground && e.t > 1.05) { e.t = 0; const dir = p.x > e.x ? 1 : -1; e.vx = Math.abs(p.x - e.x) < 170 ? dir * 52 : (Math.random() < 0.5 ? -30 : 30); e.vy = -395; }
      moveBox(e, dt); if (e.hitWall) e.vx = -e.vx; if (e.ground) e.vx *= 0.6;
    } else if (e.k === 'bat') {
      const drift = Math.abs(p.x - e.x) < 190 ? Math.sign(p.x - e.x) * 26 : 0;
      e.x += (drift + Math.sin(e.t * 1.7) * 14) * dt;
      e.y = e.ay + Math.sin(e.t * 2.6) * 16;
    }
    // player contact
    if (Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)) < (p.w + e.w) / 2 - 3 && Math.abs(p.y + p.h / 2 - (e.y + e.h / 2)) < (p.h + e.h) / 2 - 2) {
      const stomp = p.vy > 70 && (p.y + p.h) - e.y < 15;
      if (stomp) {
        e.dead = true; e.squash = 0; hitstop = 0.055; SFX.stomp();
        addScore(200, e.x + e.w / 2, e.y - 6); ev('stomp', { k: e.k });
        p.vy = readInputHold() ? -540 : -310; p.y = e.y - p.h - 1;
      } else hurtPlayer(e.x + e.w / 2);
    }
  });
  // camera: follow with lookahead
  const target = clamp(p.x + p.w / 2 - VW / 2 + p.face * 26, 0, COLS * TILE - VW);
  camX += (target - camX) * Math.min(1, dt * 7);
  pops.forEach(o => o.t -= dt); pops = pops.filter(o => o.t > 0);
}
function readInputHold() { return AUTO ? true : readInput().jumpH; }

// ---------- rendering ----------
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function drawTile(tx, ty, t) {
  const x = tx * TILE - camX, y = ty * TILE;
  if (t === 1 || t === 2) {
    ctx.fillStyle = '#8a5a28'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#74491f';
    if (hash2(tx, ty) > 0.4) ctx.fillRect(x + 5 + hash2(tx + 9, ty) * 18, y + 12 + hash2(tx, ty + 7) * 12, 4, 3);
    if (hash2(tx + 3, ty + 1) > 0.5) ctx.fillRect(x + 16, y + 20, 5, 3);
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x, y + TILE - 4, TILE, 4);
    if (t === 1) {
      ctx.fillStyle = '#2f9e44'; ctx.fillRect(x, y, TILE, 10);
      ctx.fillStyle = '#46c25e'; ctx.fillRect(x, y, TILE, 5);
      ctx.fillStyle = '#2f9e44';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 3 + i * 11 + hash2(tx, i) * 4, y + 9, 3, 4);
    }
  } else if (t === 3) {
    ctx.fillStyle = '#c96f35'; ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = '#7a3c14'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x + 3, y + 3, TILE - 6, 4);
    ctx.strokeStyle = 'rgba(122,60,20,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 15); ctx.lineTo(x + TILE, y + 15); ctx.moveTo(x + 15, y); ctx.lineTo(x + 15, y + 15); ctx.moveTo(x + 8, y + 15); ctx.lineTo(x + 8, y + TILE); ctx.moveTo(x + 22, y + 15); ctx.lineTo(x + 22, y + TILE); ctx.stroke();
  } else if (t === 4 || t === 6) {
    ctx.fillStyle = t === 4 ? '#e8930c' : '#8a6a42'; ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = t === 4 ? '#ffd94a' : '#5e4626'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    [[4, 4], [24, 4], [4, 24], [24, 24]].forEach(([dx, dy]) => ctx.fillRect(x + dx, y + dy, 3, 3));
    if (t === 4) {
      const s = 1 + Math.sin(playT * 5 + tx) * 0.08;
      ctx.save(); ctx.translate(x + 15, y + 15); ctx.scale(s, s); ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * (Math.PI * 4 / 5); ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); } ctx.closePath(); ctx.fill(); ctx.restore();
    }
  } else if (t === 5) {
    ctx.fillStyle = '#a9743f'; ctx.fillRect(x, y + 6, TILE, TILE - 6);
    ctx.fillStyle = '#8a5a28'; ctx.fillRect(x, y + 15, TILE, 3); ctx.fillRect(x, y + 24, TILE, 3);
    ctx.fillStyle = '#3fae4a'; ctx.fillRect(x, y, TILE, 7);
    ctx.fillStyle = '#46c25e'; ctx.fillRect(x, y, TILE, 3);
  }
}
function drawStarShape(x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * (Math.PI * 4 / 5); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
}
function drawSprite(img, x, y, w, h, flip, alpha) {
  if (!img || !img.complete || !img.naturalWidth) return;
  ctx.save(); if (alpha !== undefined) ctx.globalAlpha = alpha;
  if (flip) { ctx.translate(x + w / 2, 0); ctx.scale(-1, 1); ctx.drawImage(img, -w / 2, y, w, h); }
  else ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}
function drawBgStrip(scroll) {
  // mirrored tiling: alternate copies flip horizontally so edges always meet
  const bg = IMG.bg;
  if (!bg || !bg.complete || !bg.naturalWidth) { ctx.fillStyle = '#3a9bd8'; ctx.fillRect(0, 0, VW, VH); return; }
  const bw = 540, n = Math.floor(scroll / bw);
  for (let k = -1; k <= 2; k++) {
    const ti = n + k, x = ti * bw - scroll;
    if (((ti % 2) + 2) % 2 === 0) ctx.drawImage(bg, x, 0, bw, VH);
    else { ctx.save(); ctx.translate(x + bw / 2, 0); ctx.scale(-1, 1); ctx.drawImage(bg, -bw / 2, 0, bw, VH); ctx.restore(); }
  }
}
function drawWorld() {
  drawBgStrip(camX * 0.18);
  // mid hills silhouette
  ctx.fillStyle = 'rgba(38,120,52,.55)';
  ctx.beginPath(); ctx.moveTo(0, VH);
  for (let sx = 0; sx <= VW; sx += 8) { const wx = sx + camX * 0.45; const y = 216 - Math.sin(wx * 0.011) * 16 - Math.sin(wx * 0.004 + 2) * 10; ctx.lineTo(sx, y); }
  ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
  // tiles
  const x0 = Math.max(0, Math.floor(camX / TILE)), x1 = Math.min(COLS - 1, x0 + 17);
  for (let ty = 0; ty < ROWS; ty++) for (let tx = x0; tx <= x1; tx++) { const t = G(tx, ty); if (t) drawTile(tx, ty, t); }
  // checkpoint flags
  CHECKPOINTS.forEach(cx0 => {
    const x = cx0 - camX; if (x < -20 || x > VW + 20) return;
    const on = respawnX >= cx0;
    ctx.fillStyle = '#cfd8dc'; ctx.fillRect(x, 6 * TILE - 34, 3, 64);
    ctx.fillStyle = on ? '#37d67a' : '#90a4ae';
    ctx.beginPath(); ctx.moveTo(x + 3, 6 * TILE - 34); ctx.lineTo(x + 19, 6 * TILE - 27); ctx.lineTo(x + 3, 6 * TILE - 20); ctx.closePath(); ctx.fill();
  });
  // goal bell
  {
    const x = goalX - camX;
    if (x > -60 && x < VW + 60) {
      ctx.fillStyle = '#7a4a21'; ctx.fillRect(x + 12, 4 * TILE, 6, 3 * TILE);
      ctx.fillStyle = '#5e3a17'; ctx.fillRect(x - 6, 4 * TILE - 8, 42, 7);
      const sw = phase === 'clear' ? Math.sin(clearT * 9) * 6 : Math.sin(playT * 1.6) * 2;
      ctx.save(); ctx.translate(x + 15, 4 * TILE); ctx.rotate(sw * Math.PI / 180);
      ctx.fillStyle = '#ffcf3f'; ctx.beginPath(); ctx.arc(0, 12, 11, Math.PI, 0); ctx.fill(); ctx.fillRect(-11, 12, 22, 4);
      ctx.fillStyle = '#e8930c'; ctx.beginPath(); ctx.arc(0, 19, 3.4, 0, 7); ctx.fill(); ctx.restore();
      if (phase !== 'clear') drawStarShape(x + 15, 3 * TILE - 4 + Math.sin(playT * 3) * 2, 5, 'rgba(255,233,150,.9)');
    }
  }
  // pickups
  pickups.forEach(s => {
    if (s.got) return; const x = s.x - camX; if (x < -20 || x > VW + 20) return;
    drawStarShape(x, s.y + Math.sin(playT * 3 + s.ph) * 3, 8, '#ffd94a');
    drawStarShape(x, s.y + Math.sin(playT * 3 + s.ph) * 3, 4.6, '#fff3c4');
  });
  // enemies
  enemies.forEach(e => {
    if (e.x < camX - 60 || e.x > camX + VW + 60) return;
    const x = e.x - camX;
    if (e.dead) { // squashed flat
      const img = IMG[e.k]; if (img) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - e.squash * 1.4); ctx.drawImage(img, x - 3, e.y + e.h - 7, e.w + 6, 7); ctx.restore(); }
      return;
    }
    const img = IMG[e.k];
    if (e.k === 'bat') drawSprite(img, x - 5, e.y - 4, 40, 26, false);
    else if (e.k === 'slime') { const sq = 1 + Math.sin(e.t * 10) * 0.05; drawSprite(img, x - 4, e.y + e.h - 30 * sq + 6, 32, 30 * sq, false); }
    else drawSprite(img, x - 4, e.y - 6, 32, 30, e.vx > 0);
  });
  // player
  const p = player; if (p) {
    const x = p.x - camX, blink = p.ifr > 0 && ((playT * 14) | 0) % 2 === 0;
    const alpha = blink ? 0.35 : 1;
    let img = IMG.miso_stand, w = 30, h = 34;
    if (!p.ground && !p.dead) { img = IMG.miso_jump; w = 30; h = 36; }
    else if (Math.abs(p.vx) > 12) { img = ((p.animT | 0) % 2 === 0) ? IMG.miso_run : IMG.miso_stand; w = 32; h = 32; }
    if (p.dead) { ctx.save(); ctx.translate(x + p.w / 2, p.y + p.h / 2); ctx.rotate(Math.min(1.4, p.deadT * 2)); drawSprite(img, -15, -17, 30, 34, p.face < 0, alpha); ctx.restore(); }
    else drawSprite(img, x + p.w / 2 - w / 2, p.y + p.h - h + 2, w, h, p.face < 0, alpha);
  }
  // pops
  ctx.textAlign = 'center'; ctx.font = '900 9px Trebuchet MS';
  pops.forEach(o => { ctx.globalAlpha = Math.min(1, o.t * 1.6); ctx.fillStyle = o.color; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3; const yy = o.y - (1 - o.t) * 22; ctx.strokeText(o.text, o.x - camX, yy); ctx.fillText(o.text, o.x - camX, yy); ctx.globalAlpha = 1; });
}
function drawHUD() {
  ctx.fillStyle = 'rgba(10,14,30,.72)'; ctx.fillRect(0, 0, VW, 22);
  ctx.font = '900 11px Trebuchet MS'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  ctx.fillText('SCORE ' + String(score).padStart(6, '0'), 8, 15);
  ctx.fillStyle = '#ffd94a'; drawStarShape(150, 11, 6, '#ffd94a');
  ctx.fillStyle = '#fff'; ctx.fillText('× ' + starsGot, 160, 15);
  ctx.fillText('WORLD 1-1', 226, 15);
  ctx.fillStyle = timeLeft <= 30 ? '#ff6b6b' : '#fff'; ctx.fillText('TIME ' + timeLeft, 316, 15);
  // hearts + lives
  for (let i = 0; i < 3; i++) { ctx.font = '13px Trebuchet MS'; ctx.fillStyle = i < hearts ? '#ff5a76' : 'rgba(255,255,255,.25)'; ctx.fillText('♥', 396 + i * 16, 16); }
  ctx.font = '900 11px Trebuchet MS'; ctx.fillStyle = '#bfe0ff'; ctx.fillText('×' + Math.max(0, lives), 452, 15);
}
function bigText(text, y, size, color, sub) {
  ctx.font = '900 ' + size + 'px Trebuchet MS'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillText(text, VW / 2 + 3, y + 3);
  ctx.fillStyle = color; ctx.fillText(text, VW / 2, y);
  if (sub) { ctx.font = '700 13px Trebuchet MS'; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(sub, VW / 2 + 2, y + 24); ctx.fillStyle = '#eaf2ff'; ctx.fillText(sub, VW / 2, y + 22); }
}
function draw() {
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  if (phase === 'title') {
    drawBgStrip(performance.now() / 90);
    ctx.fillStyle = 'rgba(8,10,28,.34)'; ctx.fillRect(0, 0, VW, VH);
    bigText('MISO', 96, 64, '#ffd94a');
    bigText('★ STARLIGHT ADVENTURE ★', 122, 15, '#fff');
    drawSprite(IMG.miso_stand, VW / 2 - 26, 138, 52, 60, false);
    if (((performance.now() / 480) | 0) % 2 === 0) bigText('PRESS START', 232, 14, '#7CFC9A');
    ctx.font = '700 10px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillStyle = '#cfe2ff';
    ctx.fillText('© 2026 HOMEBREW WORKS  ·  HI-SCORE ' + String(hiScore).padStart(6, '0'), VW / 2, 256);
    ctx.fillText('ARROWS MOVE · SPACE JUMP · SHIFT RUN — STOMP THE GRUMPS, RING THE BELL!', VW / 2, 244);
    return;
  }
  drawWorld();
  if (phase === 'play' || phase === 'clear' || phase === 'card') drawHUD();
  if (phase === 'card') {
    ctx.fillStyle = 'rgba(5,6,16,.82)'; ctx.fillRect(0, 0, VW, VH);
    bigText('WORLD 1-1', 118, 30, '#ffd94a', 'SUNHILL MEADOW');
    drawSprite(IMG.miso_stand, VW / 2 - 42, 150, 26, 30, false);
    ctx.font = '900 14px Trebuchet MS'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText('× ' + Math.max(0, lives), VW / 2 - 6, 172);
  }
  if (phase === 'clear') {
    ctx.fillStyle = 'rgba(5,6,16,.45)'; ctx.fillRect(0, 0, VW, VH);
    bigText('COURSE CLEAR!', 92, 34, '#7CFC9A');
    ctx.font = '700 14px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText('TIME BONUS  ' + clearInfo.timeBonus, VW / 2, 138);
    ctx.fillText('STAR BONUS  ' + clearInfo.starBonus, VW / 2, 160);
    ctx.font = '900 17px Trebuchet MS'; ctx.fillStyle = '#ffd94a';
    ctx.fillText('SCORE  ' + String(score).padStart(6, '0'), VW / 2, 190);
    if (clearT > 2.2 && ((performance.now() / 480) | 0) % 2 === 0) bigText('THANK YOU FOR PLAYING!', 226, 13, '#bfe0ff');
  }
  if (phase === 'over') {
    ctx.fillStyle = 'rgba(20,4,8,.78)'; ctx.fillRect(0, 0, VW, VH);
    bigText('GAME OVER', 128, 36, '#ff6b6b', 'SCORE ' + String(score).padStart(6, '0'));
    if (((performance.now() / 480) | 0) % 2 === 0) bigText('PRESS START', 200, 13, '#7CFC9A');
  }
}

// ---------- flow ----------
function advance() {
  audio();
  if (phase === 'title') startRun();
  else if (phase === 'over') phase = 'title';
  else if (phase === 'clear' && clearT > 2.2) phase = 'title';
}
addEventListener('keydown', e => { if (phase !== 'play' && phase !== 'card' && (e.code === 'Enter' || e.code === 'Space')) advance(); });
addEventListener('pointerdown', () => { if (phase !== 'play' && phase !== 'card') advance(); }, true);
let lastTs = 0;
function loop(ts) {
  const rdt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
  if (hitstop > 0) { hitstop -= rdt; draw(); requestAnimationFrame(loop); return; }
  const dt = rdt;
  if (phase === 'card') { cardT -= dt; if (cardT <= 0) { phase = 'play'; musicOn = true; if (AC) musicNext = AC.currentTime + 0.05; ev('play_start', {}); } }
  else if (phase === 'play') updatePlay(dt);
  else if (phase === 'clear') clearT += dt;
  musicUpdate();
  window.__dbg = { phase, x: player ? Math.round(player.x) : 0, hearts, lives, stars: starsGot, score, time: timeLeft, camX: Math.round(camX) };
  draw();
  requestAnimationFrame(loop);
}
buildLevel(); spawnEnemies(); player = newPlayer(2 * TILE); hearts = 3; lives = 3; starsGot = 0; score = 0; timeLeft = 300;
if (AUTO) startRun();
requestAnimationFrame(loop);
