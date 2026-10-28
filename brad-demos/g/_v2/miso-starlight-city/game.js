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
const SHORT = new URLSearchParams(location.search).get('short') === '1';
window.__events = [];
function ev(name, data) { window.__events.push(Object.assign({ t: performance.now() | 0, name }, data || {})); }

// ---------- assets ----------
const IMG = {};
Object.keys(window.MS_ASSETS || {}).forEach(k => { const im = new Image(); im.src = window.MS_ASSETS[k]; IMG[k] = im; });

// ---------- audio: NES-style synth ----------
let AC = null, recDest = null;
function audio() {
  // iOS: WebAudio is silenced by the mute switch unless the session is 'playback'
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      // classic iOS unlock: play a 1-sample silent buffer inside the gesture
      const b = AC.createBuffer(1, 1, AC.sampleRate), s = AC.createBufferSource();
      s.buffer = b; s.connect(AC.destination); s.start(0);
      try { recDest = AC.createMediaStreamDestination(); } catch (err) {}
      AC.onstatechange = () => { if (AC && AC.state !== 'running') AC.resume(); };
    } catch (e) {}
  }
  if (AC && AC.state !== 'running') AC.resume();
}
function tone(freq, dur, type, vol, slideTo, delay) {
  if (!AC) return; const t0 = AC.currentTime + (delay || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol || 0.12, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(AC.destination);
  if (recDest) { try { g.connect(recDest); } catch(e){} }
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noiseBurst(dur, vol, delay) {
  if (!AC) return; const t0 = AC.currentTime + (delay || 0);
  const len = Math.max(1, (AC.sampleRate * dur) | 0), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = AC.createBufferSource(); s.buffer = buf;
  const g = AC.createGain(); g.gain.value = vol || 0.15;
  const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
  s.connect(f); f.connect(g); g.connect(AC.destination);
  if (recDest) { try { g.connect(recDest); } catch(e){} }
  s.start(t0);
}
const SFX = {
  // the classics, built from NES APU envelopes (gamepress gpfeel archetypes)
  jump() { tone(270, 0.19, 'square', 0.115, 990); },
  star() { tone(988, 0.07, 'square', 0.105); tone(1319, 0.34, 'square', 0.105, null, 0.07); }, // the two-tone chime
  starBlock() { tone(988, 0.07, 'square', 0.10); tone(1319, 0.10, 'square', 0.10, null, 0.07); tone(1568, 0.22, 'square', 0.09, null, 0.14); },
  stomp() { noiseBurst(0.10, 0.17); tone(340, 0.13, 'sine', 0.22, 52); tone(170, 0.15, 'triangle', 0.09, 660, 0.02); }, // crunch + thump + sproing
  bump() { tone(140, 0.07, 'square', 0.10, 90); },
  hurt() { tone(320, 0.28, 'sawtooth', 0.10, 70); noiseBurst(0.08, 0.06); },
  pop() { tone(520, 0.06, 'square', 0.08, 900); },
  check() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.11, 'triangle', 0.15, null, i * 0.07)); },
  oneUp() { [659, 784, 1319, 1046, 1175, 1319].forEach((f, i) => tone(f, 0.11, 'square', 0.09, null, i * 0.085)); },
  levelStart() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.10, null, i * 0.09)); tone(1319, 0.3, 'square', 0.08, null, 0.38); },
  timeWarn() { [880, 880, 880].forEach((f, i) => tone(f, 0.09, 'square', 0.11, null, i * 0.13)); },
  pause() { tone(880, 0.07, 'square', 0.09); tone(880, 0.12, 'square', 0.09, null, 0.09); },
  bell() { [1568, 1568, 2093].forEach((f, i) => tone(f, 0.30, 'sine', 0.16, null, i * 0.16)); tone(784, 0.5, 'triangle', 0.08, null, 0); },
  fanfare() { [523, 523, 523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.11, null, i * 0.13)); [131, 165, 196, 262].forEach((f, i) => tone(f, 0.2, 'triangle', 0.12, null, i * 0.26)); tone(1319, 0.4, 'square', 0.09, null, 1.1); },
  die() { tone(620, 0.55, 'square', 0.10, 58); },
  yarn() { noiseBurst(0.07, 0.10); tone(760, 0.13, 'square', 0.07, 300); },
  yarnHit() { noiseBurst(0.06, 0.13); tone(420, 0.10, 'triangle', 0.11, 940); },
};
// Original soundtrack: 16-bar sunny loop — pulse lead (+2-step echo), bouncy
// triangle bass off chord roots, and a 3-piece noise/sine drum kit. 8th = 0.15s.
const LEAD = [
  659,784,1046,784, 880,784,659,0,   587,659,784,0, 659,587,523,0,     // C  C
  698,880,1046,880, 784,698,659,0,   587,784,988,784, 880,988,1175,0,   // F  G
  1046,784,659,784, 880,784,659,0,   880,659,880,1046, 988,880,784,0,   // C  Am
  698,880,698,880, 784,988,784,988,  1046,0,0,0, 784,659,587,0,        // F-G C
  659,880,1046,880, 1319,1046,880,0, 784,880,784,659, 587,659,0,0,      // Am Am
  698,880,1046,1397, 1319,1046,880,0, 988,1175,988,784, 880,784,698,0,  // F  G
  659,784,1046,784, 880,1046,1319,0, 1175,1046,880,698, 880,1046,0,0,   // C  F
  784,659,587,659, 784,880,988,0,   1046,0,1319,0, 1046,0,0,0,         // C-G C
];
const BAR_ROOTS = [131,131,175,196, 131,110,175,165, 110,110,175,196, 131,175,131,131];
let musicOn = false, musicStep = 0, musicNext = 0;
function musicUpdate() {
  if (!AC || !musicOn) return;
  const spb = 0.15;
  while (musicNext < AC.currentTime + 0.2) {
    const i = musicStep % LEAD.length, dl = Math.max(0, musicNext - AC.currentTime);
    const s = i % 8, bar = (i / 8) | 0;
    if (LEAD[i]) {
      tone(LEAD[i], 0.13, 'square', 0.052, null, dl);
      tone(LEAD[i], 0.10, 'square', 0.020, null, dl + spb * 2); // echo, 2 steps later
    }
    const R = BAR_ROOTS[bar];
    const bassNote = s === 0 ? R : s === 2 ? R * 2 : s === 4 ? R : s === 6 ? R * 1.5 : 0;
    if (bassNote) tone(bassNote, 0.13, 'triangle', 0.115, null, dl);
    if (s === 0 || s === 4) tone(115, 0.09, 'sine', 0.20, 38, dl);            // kick
    if (s === 2 || s === 6) { noiseBurst(0.055, 0.085, dl); tone(190, 0.04, 'square', 0.045, null, dl); } // snare
    if (s % 2 === 1) noiseBurst(0.014, 0.011, dl);                             // hat
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
  return { x, y: 6 * TILE, w: 20, h: 26, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, jbuf: 0, ifr: 0, animT: 0, animDist: 0, dead: false, deadT: 0, squashT: 0, throwT: 0, dustT: 0 };
}
function spawnEnemies() {
  enemies = spawns.map(s => ({ k: s.k, x: s.x, y: s.y, w: s.k === 'bat' ? 30 : 24, h: s.k === 'bat' ? 20 : 22, vx: s.k === 'beetle' ? -22 : 0, vy: 0, dir: -1, t: Math.random() * 2, dead: false, dying: -1, gone: false, dx: 0, dy: 0, dvy: 0, spin: 1, ax: s.x, ay: s.y, active: false }));
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
function pop(x, y, text, color, big) { pops.push({ x, y, text, color: color || '#fff', big: !!big, t: big ? 1.6 : 1.0 }); }
function addScore(n, x, y) { score += n; if (x !== undefined) pop(x, y, '' + n, '#ffd94a'); }

// ---------- input ----------
const keys = {};
let jumpBufKey = false;
addEventListener('keydown', e => { keys[e.code] = true; audio(); if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault(); if (e.code === 'Space' || e.code === 'KeyK' || e.code === 'KeyJ') jumpBufKey = true; });
addEventListener('keyup', e => { keys[e.code] = false; });
let TC = null;
try { if (isTouchDevice()) TC = new TouchController({ buttons: [{ id: 'a', label: 'JUMP', size: 86 }, { id: 'b', label: 'YARN', size: 66 }], maxRadius: 56, deadzone: 0.18 }); } catch (e) {}
let tiPrevA = false, yarnBufKey = false;
addEventListener('keydown', e => { if (e.code === 'KeyX' || e.code === 'KeyL') yarnBufKey = true; });
function readInput() {
  const it = { x: 0, jumpH: false, jumpP: false, yarnP: false };
  if (keys.ArrowLeft || keys.KeyA) it.x -= 1;
  if (keys.ArrowRight || keys.KeyD) it.x += 1;
  it.jumpH = !!(keys.Space || keys.KeyK || keys.KeyJ);
  if (TC) {
    const t = TC.getInput();
    if (Math.abs(t.x) > 0.3) it.x = Math.sign(t.x);
    it.jumpH = it.jumpH || !!t.a;
    it.yarnP = !!t.bPressed;
    if (t.a && !tiPrevA) it.jumpP = true;
    tiPrevA = !!t.a;
  }
  if (jumpBufKey) { it.jumpP = true; jumpBufKey = false; }
  if (yarnBufKey) { it.yarnP = true; yarnBufKey = false; }
  return it;
}
function botInput() {
  const it = { x: 1, jumpH: false, jumpP: false, yarnP: false };
  const p = player;
  if (!p) return it;

  // 1. HOP ON KILL (First beetle at 13 * TILE = 390)
  const b1 = enemies.find(e => e.k === 'beetle' && Math.abs(e.x - 390) < 140);
  if (b1 && !b1.dead) {
    if (p.x >= 285 && p.x <= 315 && p.ground) {
      it.jumpP = true;
      it.jumpH = true;
    }
    if (!p.ground && p.vy < 0) it.jumpH = true;
  }

  // 2. PIT 1 (570..720)
  if (p.x >= 510 && p.x <= 545 && p.ground) {
    it.jumpP = true;
    it.jumpH = true;
  }

  // 3. COOL YARN KILL ON GROUND WHILE JUMPING (Slime at 27*TILE = 810)
  const sl1 = enemies.find(e => e.k === 'slime' && Math.abs(e.x - 810) < 120);
  if (sl1 && !sl1.dead) {
    if (p.x >= 735 && p.x <= 765 && p.ground) {
      it.jumpP = true;
      it.jumpH = true;
    }
    // Mid-air throw
    if (!p.ground && p.x >= 755 && p.x <= 810 && !yarn) {
      it.yarnP = true;
    }
  }

  // Platform at 29..31 (870..930):
  if (p.x >= 840 && p.x <= 865 && p.ground) { it.jumpP = true; it.jumpH = true; }
  // Beetle at 990:
  if (p.x >= 950 && p.x <= 975 && p.ground) { it.jumpP = true; it.jumpH = true; }

  // Step climbs at 1110..1230:
  if (p.x >= 1085 && p.x <= 1110 && p.ground) { it.jumpP = true; it.jumpH = true; }
  if (p.x >= 1120 && p.x <= 1140 && p.ground) { it.jumpP = true; it.jumpH = true; }
  if (p.x >= 1150 && p.x <= 1170 && p.ground) { it.jumpP = true; it.jumpH = true; }

  // High shelf leap over Pit 2 and Bat (1230..1380):
  if (p.x >= 1200 && p.x <= 1225 && p.ground) { it.jumpP = true; it.jumpH = true; }

  // 4. DOUBLE YARN KILL (Checkpoint 1 at 1500; Beetles at 1590 & 1680)
  const bPair = enemies.filter(e => e.k === 'beetle' && e.x > 1540 && e.x < 1720);
  if (bPair.length > 0 && bPair.some(e => !e.dead)) {
    if (p.x >= 1505 && p.x <= 1530 && !yarn) {
      it.yarnP = true;
    }
    if (yarn && yarn.mode === 'out' && (yarn.x > 1700 || bPair.every(e => e.dead))) {
      it.yarnP = true;
    }
  }

  // 5. Long Pit platforms (tiles 58..63 = 1740..1920)
  if (p.x >= 1690 && p.x <= 1715 && p.ground) { it.jumpP = true; it.jumpH = true; }
  if (p.x >= 1760 && p.x <= 1785 && p.ground) { it.jumpP = true; it.jumpH = true; }
  if (p.x >= 1825 && p.x <= 1850 && p.ground) { it.jumpP = true; it.jumpH = true; }
  if (p.x >= 1885 && p.x <= 1910 && p.ground) { it.jumpP = true; it.jumpH = true; }

  // Slime flats & Star block (2010..2130)
  if (p.x >= 1990 && p.x <= 2015 && p.ground) { it.jumpP = true; it.jumpH = true; }
  if (p.x >= 2100 && p.x <= 2125 && p.ground) { it.jumpP = true; it.jumpH = true; }

  // Staircase at 2220..2280
  if (p.x >= 2200 && p.x <= 2220 && p.ground) { it.jumpP = true; it.jumpH = true; }
  if (p.x >= 2230 && p.x <= 2250 && p.ground) { it.jumpP = true; it.jumpH = true; }
  if (p.x >= 2260 && p.x <= 2280 && p.ground) { it.jumpP = true; it.jumpH = true; }

  // High shelf leap over Pit 3 (2460)
  if (p.x >= 2435 && p.x <= 2465 && p.ground) { it.jumpP = true; it.jumpH = true; }

  // Bridge at 3060..3270
  if (p.x >= 3020 && p.x <= 3045 && p.ground) { it.jumpP = true; it.jumpH = true; }

  // Pit at 3300: jump to mid-platform at 3360
  if (p.x >= 3270 && p.x <= 3295 && p.ground) { it.jumpP = true; it.jumpH = true; }
  // Mid-platform (3360) to 3480
  if (p.x >= 3385 && p.x <= 3415 && p.ground) { it.jumpP = true; it.jumpH = true; }

  // Home stretch enemies
  if (p.x >= 3540 && p.x <= 3570 && p.ground) { it.jumpP = true; it.jumpH = true; }
  if (p.x >= 3710 && p.x <= 3740 && p.ground) { it.jumpP = true; it.jumpH = true; }

  // Victory stairs at 4140..4170
  if (p.x >= 4120 && p.x <= 4140 && p.ground) { it.jumpP = true; it.jumpH = true; }
  if (p.x >= 4150 && p.x <= 4170 && p.ground) { it.jumpP = true; it.jumpH = true; }

  // Victory Bell leap (4180 -> Bell at 4320)
  if (p.x >= 4180 && p.x <= 4210 && p.ground) {
    it.jumpP = true;
    it.jumpH = true;
  }

  // Dynamic fallback for walls and gaps
  const aheadX = p.x + p.w + 6;
  const feetY = p.y + p.h;
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

// ---------- particles ----------
let parts = [];
function burst(x, y, color, n, big) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 190, vy: -Math.random() * 200 - 26, g: 640, t: 0, life: 0.4 + Math.random() * 0.3, color, s: (big ? 3 : 2) + Math.random() * 2.4 });
}
function puff(x, y, color) { parts.push({ x, y, vx: (Math.random() - 0.5) * 26, vy: -12 - Math.random() * 16, g: -30, t: 0, life: 0.32, color: color || '#e8dcc0', s: 2.4 + Math.random() * 2 }); }
function updateParts(dt) {
  parts.forEach(o => { o.t += dt; o.vy += o.g * dt; o.x += o.vx * dt; o.y += o.vy * dt; });
  parts = parts.filter(o => o.t < o.life);
}

// ---------- enemy deaths: flip, launch, fall (no more flat pancakes) ----------
let lastYarnKillT = -999;
function killEnemy(e, how) {
  if (e.dying >= 0 || e.gone) return;
  e.dead = true; e.dying = 0; e.dx = e.x; e.dy = e.y; e.dvy = -335; e.spin = (Math.random() < 0.5 ? -1 : 1) * 2.4;
  const col = e.k === 'slime' ? '#2fd4c4' : e.k === 'bat' ? '#4a6fc4' : '#8b5cf6';
  burst(e.x + e.w / 2, e.y + e.h / 2, col, e.k === 'slime' ? 12 : 8, e.k === 'slime');
  addScore(200, e.x + e.w / 2, e.y - 6);
  if (how === 'stomp') {
    hitstop = 0.055;
    SFX.stomp();
    pop(player.x, player.y - 28, '💥 HOP-ON STOMP!', '#ffd94a', true);
    ev('stomp', { k: e.k });
  } else {
    SFX.yarnHit();
    const now = performance.now() / 1000;
    if (now - lastYarnKillT < 1.3) {
      pop(player.x, player.y - 34, '🧶 DOUBLE YARN KILL! 🔥', '#7CFC9A', true);
      ev('double_yarn_kill', { k: e.k });
    } else if (player && !player.ground) {
      pop(player.x, player.y - 30, '🎯 MID-AIR YARN SNIPE!', '#ff5a76', true);
      ev('air_yarn_kill', { k: e.k });
    }
    lastYarnKillT = now;
    ev('yarn_kill', { k: e.k });
  }
}

// ---------- the yarn ball: rolls out on the ground, string pulls it back ----------
let yarn = null;
const handPt = () => ({ x: player.x + player.w / 2 + player.face * 9, y: player.y + 13 });
function throwYarn() {
  if (yarn || player.dead || phase !== 'play') return;
  const h = handPt();
  yarn = { x: h.x, y: h.y, vx: player.face * 238, vy: -30, mode: 'out', t: 0, rot: 0 };
  player.throwT = 0.3; SFX.yarn(); ev('yarn_throw', {});
}
function recallYarn() { if (yarn && yarn.mode === 'out') yarn.mode = 'back'; }
function updateYarn(dt) {
  if (!yarn) return;
  const h = handPt();
  yarn.t += dt;
  if (yarn.mode === 'out') {
    yarn.vy = Math.min(520, yarn.vy + 1500 * dt);
    let nx = yarn.x + yarn.vx * dt;
    if (solidAt(nx + Math.sign(yarn.vx) * 7, yarn.y)) { yarn.mode = 'back'; }
    else yarn.x = nx;
    yarn.y += yarn.vy * dt;
    if (solidAt(yarn.x, yarn.y + 7) && yarn.vy > 0) { // ground contact: roll
      while (solidAt(yarn.x, yarn.y + 7)) yarn.y -= 1;
      yarn.vy = yarn.vy > 170 ? -yarn.vy * 0.32 : 0;
      yarn.vx *= (1 - 0.35 * dt);
      yarn.rot += yarn.vx * dt / 7;
      if (Math.random() < 0.3) puff(yarn.x, yarn.y + 6, '#f3c6cf');
    }
    if (Math.hypot(yarn.x - h.x, yarn.y - h.y) > 168 || yarn.y > VH + 70 || yarn.t > 2.6) yarn.mode = 'back';
  } else {
    // string reels it home: steer straight at the hand, terrain be damned
    const dx = h.x - yarn.x, dy = h.y - yarn.y, d = Math.hypot(dx, dy) || 1;
    const sp = 470;
    yarn.x += dx / d * sp * dt; yarn.y += dy / d * sp * dt;
    yarn.rot += 14 * dt;
    if (d < 15) { yarn = null; SFX.pop(); burst(h.x, h.y, '#ffb3c2', 4); return; }
  }
  // it kills in both directions
  enemies.forEach(e => {
    if (e.dying >= 0 || e.gone || !e.active) return;
    if (Math.abs(yarn.x - (e.x + e.w / 2)) < 17 && Math.abs(yarn.y - (e.y + e.h / 2)) < 17) killEnemy(e, 'yarn');
  });
}
function updatePlay(dt) {
  playT += dt; timeAcc += dt;
  if (timeAcc >= 1) { timeAcc -= 1; timeLeft--; if (timeLeft === 30) SFX.timeWarn(); if (timeLeft <= 0) { timeLeft = 0; killPlayer(); } }
  const it = (AUTO || SHORT) ? botInput() : readInput();
  const p = player;
  if (it.yarnP) { if (yarn) recallYarn(); else throwYarn(); }
  if (p.dead) {
    p.deadT += dt; p.vy += 1500 * dt; p.y += p.vy * dt;
    if (p.deadT > 1.15) { lives--; if (lives < 0) { phase = 'over'; ev('gameover', { score }); } else respawn(); }
    return;
  }
  // --- movement: diminishing-returns accel (gpfeel) ---
  const maxSp = 192;
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
  const fallV = p.vy, wasG = p.ground;
  moveBox(p, dt);
  if (!wasG && p.ground && fallV > 300) { p.squashT = 0.13; for (let i = 0; i < 4; i++) puff(p.x + p.w / 2 + (Math.random() - 0.5) * 16, p.y + p.h - 2); }
  if (p.ground && Math.abs(p.vx) > 150) { p.dustT -= dt; if (p.dustT <= 0) { p.dustT = 0.15; puff(p.x + p.w / 2 - p.face * 8, p.y + p.h - 2); } }
  // star block bump
  if (p.bumpTy >= 0) {
    const t = G(p.bumpTx, p.bumpTy);
    if (t === 4) {
      SET(p.bumpTx, p.bumpTy, 6); SFX.starBlock(); starsGot++; addScore(100, p.bumpTx * TILE + 15, p.bumpTy * TILE - 6);
      pop(p.bumpTx * TILE + 15, p.bumpTy * TILE - 18, '★', '#ffd94a'); ev('star_block', { stars: starsGot });
      if (starsGot % 30 === 0) { lives++; SFX.oneUp(); pop(p.x + 10, p.y - 14, '1UP!', '#7CFC9A'); }
    } else if (t === 3 || t === 1) SFX.bump();
  }
  if (p.x < 0) p.x = 0;
  if (p.y > VH + 80) { hearts = 0; killPlayer(); p.deadT = 0.6; }
  p.animT += Math.abs(p.vx) * dt * 0.06;
  p.animDist += Math.abs(p.vx) * dt;
  if (p.ifr > 0) p.ifr -= dt;
  if (p.squashT > 0) p.squashT -= dt;
  if (p.throwT > 0) p.throwT -= dt;
  // checkpoints
  CHECKPOINTS.forEach(cx0 => { if (respawnX < cx0 && p.x >= cx0) { respawnX = cx0; addScore(500); SFX.check(); pop(cx0, 6 * TILE, 'CHECKPOINT!', '#7CFC9A'); ev('checkpoint', { x: cx0 }); } });
  // goal
  if (p.x + p.w >= goalX) {
    phase = 'clear'; clearT = 0; musicOn = false; SFX.bell(); setTimeout(() => SFX.fanfare(), 480);
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
      s.got = true; starsGot++; addScore(100, s.x, s.y - 8); SFX.star(); ev('star', { stars: starsGot });
      if (starsGot % 30 === 0) { lives++; SFX.oneUp(); pop(p.x + 10, p.y - 14, '1UP!', '#7CFC9A'); }
    }
  });
  // enemies
  enemies.forEach(e => {
    if (e.gone) return;
    if (e.dying >= 0) { e.dying += dt; e.dy += e.dvy * dt; e.dvy += 1350 * dt; if (e.dying > 0.6) e.gone = true; return; }
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
      if (stomp) { killEnemy(e, 'stomp'); p.vy = readInputHold() ? -540 : -310; p.y = e.y - p.h - 1; }
      else hurtPlayer(e.x + e.w / 2);
    }
  });
  updateYarn(dt);
  updateParts(dt);
  // camera: follow with lookahead
  const target = clamp(p.x + p.w / 2 - VW / 2 + p.face * 26, 0, COLS * TILE - VW);
  camX += (target - camX) * Math.min(1, dt * 7);
  pops.forEach(o => o.t -= dt); pops = pops.filter(o => o.t > 0);
}
function readInputHold() { return (AUTO || SHORT) ? true : readInput().jumpH; }

// ---------- rendering ----------
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function drawTile(tx, ty, t) {
  const x = tx * TILE - camX, y = ty * TILE;
  if (t === 1 || t === 2) {
    // wet stone pavement — the street itself, not a platform
    ctx.fillStyle = t === 1 ? '#2f3145' : '#262838'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    if (hash2(tx, ty) > 0.4) ctx.fillRect(x + 5 + hash2(tx + 9, ty) * 18, y + 12 + hash2(tx, ty + 7) * 12, 4, 3);
    if (hash2(tx + 3, ty + 1) > 0.5) ctx.fillRect(x + 16, y + 20, 5, 3);
    ctx.fillStyle = 'rgba(0,0,0,.20)'; ctx.fillRect(x + ((tx * 37) % 23), y + 4, 1.5, TILE - 6);
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x, y + TILE - 4, TILE, 4);
    if (t === 1) {
      ctx.fillStyle = '#4d5871'; ctx.fillRect(x, y, TILE, 9);
      ctx.fillStyle = 'rgba(190,214,245,.85)'; ctx.fillRect(x, y, TILE, 3);
      ctx.fillStyle = 'rgba(140,170,220,.20)'; ctx.fillRect(x, y + 3, TILE, 3);
    }
  } else if (t === 3) {
    // wooden market crate
    ctx.fillStyle = '#5a4026'; ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = '#3a2712'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = 'rgba(255,226,170,.15)'; ctx.fillRect(x + 3, y + 3, TILE - 6, 3);
    ctx.strokeStyle = 'rgba(46,29,12,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 15); ctx.lineTo(x + TILE, y + 15); ctx.moveTo(x + 15, y); ctx.lineTo(x + 15, y + 15); ctx.moveTo(x + 8, y + 15); ctx.lineTo(x + 8, y + TILE); ctx.moveTo(x + 22, y + 15); ctx.lineTo(x + 22, y + TILE); ctx.stroke();
  } else if (t === 4 || t === 6) {
    if (t === 4) {
      // glowing paper-lantern block with a star emblem
      const s = 1 + Math.sin(playT * 5 + tx) * 0.08;
      const g = ctx.createRadialGradient(x + 15, y + 15, 2, x + 15, y + 15, 26);
      g.addColorStop(0, 'rgba(255,176,84,.34)'); g.addColorStop(1, 'rgba(255,176,84,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 11, y - 11, TILE + 22, TILE + 22);
      ctx.fillStyle = '#c97a24'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#e09a3a'; ctx.fillRect(x + 3, y + 2, TILE - 6, TILE - 4);
      ctx.strokeStyle = 'rgba(122,62,10,.65)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 10, y + 1); ctx.lineTo(x + 10, y + TILE - 1); ctx.moveTo(x + 20, y + 1); ctx.lineTo(x + 20, y + TILE - 1); ctx.stroke();
      ctx.strokeStyle = '#8a4d10'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.save(); ctx.translate(x + 15, y + 15); ctx.scale(s, s); ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * (Math.PI * 4 / 5); ctx.lineTo(Math.cos(a) * 7.4, Math.sin(a) * 7.4); } ctx.closePath(); ctx.fill(); ctx.restore();
    } else {
      ctx.fillStyle = '#4a3826'; ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = '#33241a'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      [[4, 4], [24, 4], [4, 24], [24, 24]].forEach(([dx, dy]) => ctx.fillRect(x + dx, y + dy, 3, 3));
    }
  } else if (t === 5) {
    // stall awning you can stand on: canvas top, plank underside
    ctx.fillStyle = '#46311d'; ctx.fillRect(x, y + 7, TILE, TILE - 7);
    ctx.fillStyle = '#38260f'; ctx.fillRect(x, y + 16, TILE, 2); ctx.fillRect(x, y + 24, TILE, 2);
    const ac = ((tx % 2) + 2) % 2 === 0 ? '#8a3436' : '#2b5a60';
    ctx.fillStyle = ac; ctx.fillRect(x, y, TILE, 8);
    ctx.fillStyle = 'rgba(255,235,200,.22)'; ctx.fillRect(x, y, TILE, 2);
    ctx.fillStyle = ac;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + 4 + i * 8, y + 8, 3.6, 0, Math.PI); ctx.fill(); }
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
// — ALIVE WORLD: the painted backdrop breathes — drifting painted clouds, a low
// mist band, cloud shadows sweeping the ground, floating pollen, a butterfly,
// and swaying foreground grass. All timed off playT; pure decoration, no physics.
// — SEGMENT BACKDROP: the street is a sequence of painted segments (frontal
// streets, a painted CORNER TURN, a cross-street alley) crossfaded at the
// seams, so a pure side-scroller reads as navigating a real city — the same
// trick as the reference video, where the turns live in the backdrop geometry.
// Parallax 0.45 (the street is close). Segment A is IMG.bg (the v2 plate).
const CITY_SEGS = [];
function citySegList() {
  if (CITY_SEGS.length) return CITY_SEGS;
  const A = IMG.bg, C = IMG.segC, B = IMG.segB, L = IMG.segAl;
  for (const im of [A, C, B, L]) if (!im || !im.complete || !im.naturalWidth) return CITY_SEGS;
  CITY_SEGS.push([A, 0], [C, 0], [B, 0], [L, 0], [B, 0], [C, 1], [A, 0]);
  return CITY_SEGS;
}
const segMaskCache = {};
function segMasked(img, flip) {
  const key = img.src.slice(-28) + (flip ? 'f' : '');
  if (segMaskCache[key]) return segMaskCache[key];
  const c = document.createElement('canvas'); c.width = 1080; c.height = 540;
  const g = c.getContext('2d');
  if (flip) { g.translate(1080, 0); g.scale(-1, 1); }
  g.drawImage(img, 0, 0, 1080, 540);
  g.globalCompositeOperation = 'destination-out';
  const gr = g.createLinearGradient(0, 0, 90, 0);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 90, 540);
  segMaskCache[key] = c; return c;
}
function drawCityStrip(camXv) {
  const segs = citySegList();
  if (!segs.length) { drawBgStrip(camXv * 0.18); return; }
  const STRIDE = 1000, W2 = 1080, total = segs.length * STRIDE;
  let s = (camXv * 0.45) % total; if (s < 0) s += total;
  const i0 = Math.floor(s / STRIDE), off = s - i0 * STRIDE;
  for (let k = 0; k < 3; k++) {
    const seg = segs[(i0 + k) % segs.length];
    const x = k * STRIDE - off;
    if (x > VW) break;
    if (k === 0) {
      ctx.save();
      if (seg[1]) { ctx.translate(x + W2 / 2, 0); ctx.scale(-1, 1); ctx.drawImage(seg[0], -W2 / 2, 0, W2, VH); }
      else ctx.drawImage(seg[0], x, 0, W2, VH);
      ctx.restore();
    } else {
      ctx.drawImage(segMasked(seg[0], seg[1]), x, 0, W2, VH);
    }
  }
}

// — CITY WEATHER: neon pools glowing on the mirror street, low fog, character
// reflections on the wet ground, and two depths of rain. Decoration only.
function drawCityBack() {
  const t = playT, scroll = camX * 0.45;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const pools = [[70, '34,211,238', 0.10], [300, '236,72,153', 0.09], [560, '74,222,128', 0.07], [830, '255,170,60', 0.08], [1000, '192,132,252', 0.06]];
  for (const [o, c, a0] of pools) {
    const x = ((o - scroll) % 1080 + 1080) % 1080; if (x > VW + 190) continue;
    const a = a0 * (0.9 + 0.1 * Math.sin(t * 7 + o * 1.7));
    const g = ctx.createRadialGradient(x, VH * 0.88, 4, x, VH * 0.88, 150);
    g.addColorStop(0, 'rgba(' + c + ',' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + c + ',0)');
    ctx.fillStyle = g;
    ctx.save(); ctx.translate(x, VH * 0.88); ctx.scale(1, 0.18); ctx.translate(-x, -VH * 0.88);
    ctx.beginPath(); ctx.arc(x, VH * 0.88, 150, 0, 7); ctx.fill(); ctx.restore();
  }
  const fog = IMG.cloud1;
  if (fog && fog.complete && fog.naturalWidth) {
    for (let i = 0; i < 2; i++) {
      const span = VW + 1000, sp = i === 0 ? 4 : -2.6;
      const x = (((i * 700 + t * sp - camX * 0.05) % span) + span) % span - 500;
      ctx.globalAlpha = 0.05;
      ctx.drawImage(fog, x, VH * 0.52, 1000, 110);
    }
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
function reflectSprite(img, cx, feet, w, h, flip) {
  if (!img || !img.complete || !img.naturalWidth || h <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.translate(cx + Math.sin(playT * 2.6 + feet * 0.05) * 1.5, feet); ctx.scale(flip ? -1 : 1, -0.48);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  const g = ctx.createLinearGradient(0, feet, 0, feet + h * 0.48);
  g.addColorStop(0, 'rgba(10,12,26,0.06)'); g.addColorStop(1, 'rgba(10,12,26,0.92)');
  ctx.fillStyle = g; ctx.fillRect(cx - w / 2 - 2, feet, w + 4, h * 0.48);
}
function drawCityReflections() {
  enemies.forEach(e => {
    if (e.gone || e.dying >= 0) return;
    if (e.x < camX - 60 || e.x > camX + VW + 60) return;
    const x = e.x - camX;
    if (e.k === 'beetle') {
      const img = ((e.t * 6) | 0) % 2 === 0 ? IMG.beetle : IMG.beetle2;
      if (img && img.naturalHeight) { const h = 27, w = h * img.naturalWidth / img.naturalHeight; reflectSprite(img, x + e.w / 2, e.y + e.h + 2, w, h, e.vx > 0); }
    } else if (e.k === 'slime' && e.ground) {
      reflectSprite(IMG.slime, x + e.w / 2, e.y + e.h + 6, 32, 30, false);
    }
  });
  const p = player;
  if (p && p.ground && !p.dead) {
    let img = IMG.miso_stand, th = 34;
    if (p.throwT > 0) { img = IMG.miso_throw; th = 32; }
    else if (Math.abs(p.vx) > 12) { img = [IMG.miso_run, IMG.miso_tuck, IMG.miso_run2, IMG.miso_tuck][((p.animDist / 34) | 0) % 4]; th = 31; }
    if (img && img.naturalHeight) { const tw = th * img.naturalWidth / img.naturalHeight; reflectSprite(img, p.x - camX + p.w / 2, p.y + p.h + 2, tw, th, p.face < 0); }
  }
}
function drawCityFront() {
  const t = playT;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const sx = (((t * 22) % (VW + 520)) + VW + 520) % (VW + 520) - 260;
  const g = ctx.createRadialGradient(sx, VH * 0.92, 4, sx, VH * 0.92, 260);
  g.addColorStop(0, 'rgba(150,200,255,0.055)'); g.addColorStop(1, 'rgba(150,200,255,0)');
  ctx.fillStyle = g;
  ctx.save(); ctx.translate(sx, VH * 0.92); ctx.scale(1, 0.16); ctx.translate(-sx, -VH * 0.92);
  ctx.beginPath(); ctx.arc(sx, VH * 0.92, 260, 0, 7); ctx.fill(); ctx.restore();
  ctx.restore();
  ctx.save(); ctx.lineWidth = 1;
  const layers = [[55, 540, 9, 0.13], [40, 780, 14, 0.26]];
  for (const [n, sp, len, al] of layers) {
    ctx.strokeStyle = 'rgba(190,212,255,' + al + ')';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const bx = (i * 173.3 + (sp === 780 ? 61 : 0)) % (VW + 80);
      const by = (i * 97.7) % (VH + 60);
      const x = (((bx - t * 55) % (VW + 80)) + VW + 80) % (VW + 80) - 40;
      const y = (((by + t * sp) % (VH + 60)) + VH + 60) % (VH + 60) - 30;
      ctx.moveTo(x, y); ctx.lineTo(x - 2.5, y + len);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawAliveBack() {
  const t = playT;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const img = IMG['cloud' + (i % 5)]; if (!img || !img.complete || !img.naturalWidth) continue;
    const depth = i % 2 === 0 ? 0.05 : 0.11, sp = 3 + (i % 3) * 2.4;
    const w = 180 + (i * 53) % 140, h = w * img.naturalHeight / img.naturalWidth;
    const span = VW + 380;
    const x = (((i * 331 + t * sp - camX * depth) % span) + span) % span - 190;
    const y = 8 + (i * 43) % 92 + Math.sin(t * 0.23 + i * 1.7) * 3;
    ctx.globalAlpha = 0.42 + (i % 3) * 0.15;
    ctx.drawImage(img, x, y, w, h);
  }
  const mist = IMG.cloud1;
  if (mist && mist.complete && mist.naturalWidth) {
    for (let i = 0; i < 2; i++) {
      const span = VW + 1000, sp = i === 0 ? 5 : -3.4;
      const x = (((i * 700 + t * sp - camX * 0.07) % span) + span) % span - 500;
      ctx.globalAlpha = 0.10;
      ctx.drawImage(mist, x, VH * 0.50, 1000, 120);
    }
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawAliveFront() {
  const t = playT;
  // cloud shadows sweeping the meadow
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 3; i++) {
    const span = VW + 560, sp = 12 + i * 5;
    const x = (((i * 431 + t * sp - camX * 0.92) % span) + span) % span - 280;
    const y = VH * 0.68 + (i * 57) % 100, rx = 200 + i * 46, ry = 36 + i * 8;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(88,100,128,0.42)'); g.addColorStop(1, 'rgba(88,100,128,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  // drifting pollen motes in the light
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const px = (((i * 173 + t * (6 + (i % 4) * 2) - camX * 0.55) % (VW + 40)) + VW + 40) % (VW + 40) - 20;
    const py = 84 + ((i * 97) % 310) + Math.sin(t * 0.9 + i * 2.1) * 12;
    const r = 1.2 + (i % 3) * 0.7, a = Math.max(0, 0.15 + 0.13 * Math.sin(t * 1.7 + i * 1.3));
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
    g.addColorStop(0, 'rgba(255,240,190,' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r * 3, 0, 7); ctx.fill();
  }
  ctx.restore();
  // a butterfly keeping the cat company
  const p = player;
  if (p) {
    const img = ((t * 9) | 0) % 2 === 0 ? IMG.bf0 : IMG.bf1;
    if (img && img.complete && img.naturalWidth) {
      const bx = p.x + 128 + Math.sin(t * 0.33) * 84 - camX;
      const by = p.y - 44 + Math.sin(t * 1.25) * 15 + Math.sin(t * 7) * 2;
      if (bx > -30 && bx < VW + 30) {
        const w = 24, h = w * img.naturalHeight / img.naturalWidth;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(t * 0.9) * 0.18);
        ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
      }
    }
  }
  // swaying foreground grass (front parallax fringe)
  ctx.save(); ctx.lineCap = 'round';
  for (let sx = -12; sx < VW + 12; sx += 13) {
    const wx = sx + camX * 1.3;
    const seed = ((wx * 7919) % 100 + 100) % 100;
    const hgt = 16 + seed * 0.22, sway = Math.sin(t * 1.8 + wx * 0.11) * 4.5;
    ctx.strokeStyle = 'rgba(22,70,32,0.50)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx, VH + 3); ctx.quadraticCurveTo(sx + sway * 0.4, VH - hgt * 0.6, sx + sway, VH - hgt); ctx.stroke();
    ctx.strokeStyle = 'rgba(38,102,44,0.42)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx + 6, VH + 3); ctx.quadraticCurveTo(sx + 6 - sway * 0.3, VH - hgt * 0.45, sx + 6 - sway * 0.7, VH - hgt * 0.72); ctx.stroke();
  }
  ctx.restore();
}
function drawWorld() {
  drawCityStrip(camX);
  drawCityBack();
  // night deepening toward the wet street
  { const g = ctx.createLinearGradient(0, VH * 0.62, 0, VH); g.addColorStop(0, 'rgba(8,10,24,0)'); g.addColorStop(1, 'rgba(8,10,24,.38)'); ctx.fillStyle = g; ctx.fillRect(0, VH * 0.62, VW, VH * 0.38); }
  // tiles
  const x0 = Math.max(0, Math.floor(camX / TILE)), x1 = Math.min(COLS - 1, x0 + 17);
  for (let ty = 0; ty < ROWS; ty++) for (let tx = x0; tx <= x1; tx++) { const t = G(tx, ty); if (t) drawTile(tx, ty, t); }
  drawCityReflections();
  // checkpoint flags
  CHECKPOINTS.forEach(cx0 => {
    const x = cx0 - camX; if (x < -20 || x > VW + 20) return;
    const on = respawnX >= cx0;
    ctx.fillStyle = '#cfd8dc'; ctx.fillRect(x, 6 * TILE - 34, 3, 64);
    ctx.fillStyle = on ? '#ffb347' : '#5a6474';
    ctx.beginPath(); ctx.moveTo(x + 3, 6 * TILE - 34); ctx.lineTo(x + 19, 6 * TILE - 27); ctx.lineTo(x + 3, 6 * TILE - 20); ctx.closePath(); ctx.fill();
  });
  // goal bell
  {
    const x = goalX - camX;
    if (x > -60 && x < VW + 60) {
      ctx.fillStyle = '#4a3220'; ctx.fillRect(x + 12, 4 * TILE, 6, 3 * TILE);
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
    const yy = s.y + Math.sin(playT * 3 + s.ph) * 3;
    const g = ctx.createRadialGradient(x, yy, 1, x, yy, 15);
    g.addColorStop(0, 'rgba(255,214,110,.5)'); g.addColorStop(1, 'rgba(255,214,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, yy, 15, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, yy); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(-1.6, -6.4, 3.2, 12.8); ctx.fillRect(-6.4, -1.6, 12.8, 3.2); ctx.restore();
    ctx.fillStyle = '#fff7dd'; ctx.beginPath(); ctx.arc(x, yy, 1.9, 0, 7); ctx.fill();
  });
  // enemies
  ctx.filter = 'brightness(0.94) saturate(0.92)';
  enemies.forEach(e => {
    if (e.gone) return;
    if (e.dying >= 0) { // flipped, launched, falling through the world
      const img = IMG[e.k]; if (!img || !img.complete) return;
      const h = 28, w = h * img.naturalWidth / img.naturalHeight;
      ctx.save();
      ctx.globalAlpha = e.dying > 0.38 ? Math.max(0, 1 - (e.dying - 0.38) * 4) : 1;
      ctx.translate(e.dx + e.w / 2 - camX, e.dy + e.h / 2);
      ctx.rotate(e.spin * e.dying);
      ctx.scale(1, -1); // belly-up
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }
    if (e.x < camX - 60 || e.x > camX + VW + 60) return;
    const x = e.x - camX;
    if (e.k === 'bat') { const img = Math.sin(e.t * 11) > 0 ? IMG.bat : IMG.bat2; drawSprite(img, x - 5, e.y - 4, 40, 26, false); }
    else if (e.k === 'slime') {
      if (!e.ground && IMG.slime2) drawSprite(IMG.slime2, x - 1, e.y + e.h - 38, 22, 38, false); // stretched mid-hop
      else { const sq = 1 + Math.sin(e.t * 10) * 0.05; drawSprite(IMG.slime, x - 4, e.y + e.h - 30 * sq + 6, 32, 30 * sq, false); }
    }
    else { const img = ((e.t * 6) | 0) % 2 === 0 ? IMG.beetle : IMG.beetle2; const h = 27, w = img && img.naturalHeight ? h * img.naturalWidth / img.naturalHeight : 30; drawSprite(img, x + e.w / 2 - w / 2, e.y + e.h - h + 2, w, h, e.vx > 0); }
  });
  ctx.filter = 'none';
  // yarn ball + string (behind the cat, over the world)
  if (yarn && player) {
    const h = handPt(), hx = h.x - camX, hy = h.y, bx = yarn.x - camX, by = yarn.y;
    const d = Math.hypot(bx - hx, by - hy), sag = Math.min(24, d * 0.16) * (yarn.mode === 'out' ? 1 : 0.3);
    ctx.strokeStyle = '#f2e7d5'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + bx) / 2, Math.max(hy, by) + sag, bx, by); ctx.stroke();
    ctx.save(); ctx.translate(bx, by); ctx.rotate(yarn.rot);
    ctx.fillStyle = '#ff5a76'; ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c22e4a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 5.4, 0.4, 2.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 5.4, 3.4, 5.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, 2); ctx.lineTo(7, -2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(bx - 2.4, by - 2.6, 1.7, 0, 7); ctx.fill();
  }
  // particles
  parts.forEach(o => { ctx.globalAlpha = Math.max(0, 1 - o.t / o.life); ctx.fillStyle = o.color; ctx.fillRect(o.x - camX - o.s / 2, o.y - o.s / 2, o.s, o.s); });
  ctx.globalAlpha = 1;
  // player
  const p = player; if (p) {
    const x = p.x - camX, blink = p.ifr > 0 && ((playT * 14) | 0) % 2 === 0;
    const alpha = blink ? 0.35 : 1;
    let img = IMG.miso_stand, th = 34;
    if (p.dead) img = IMG.miso_jump;
    else if (!p.ground) { img = IMG.miso_jump; th = 36; }
    else if (p.throwT > 0) { img = IMG.miso_throw; th = 32; }
    else if (Math.abs(p.vx) > 12) { img = [IMG.miso_run, IMG.miso_tuck, IMG.miso_run2, IMG.miso_tuck][((p.animDist / 34) | 0) % 4]; th = 31; }
    const tw = img && img.naturalHeight ? th * img.naturalWidth / img.naturalHeight : th;
    // squash & stretch: stretch in the air by speed, squash on landing
    let sx = 1, sy = 1;
    if (!p.ground && !p.dead) { const st = clamp(Math.abs(p.vy) / 950, 0, 0.20); sy = 1 + st; sx = 1 - st * 0.55; }
    else if (p.squashT > 0) { const q = p.squashT / 0.13; sy = 1 - 0.20 * q; sx = 1 + 0.16 * q; }
    ctx.save();
    ctx.filter = 'brightness(0.95) saturate(0.94)';
    if (p.dead) { ctx.translate(x + p.w / 2, p.y + p.h / 2); ctx.rotate(Math.min(1.4, p.deadT * 2)); ctx.translate(0, p.h / 2 + 2); }
    else ctx.translate(x + p.w / 2, p.y + p.h + 2);
    ctx.scale(p.face * sx, sy);
    ctx.globalAlpha = alpha;
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -tw / 2, -th, tw, th);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  // pops
  ctx.textAlign = 'center'; ctx.font = '900 9px Trebuchet MS';
  pops.forEach(o => { ctx.globalAlpha = Math.min(1, o.t * 1.6); ctx.fillStyle = o.color; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3; const yy = o.y - (1 - o.t) * 22; ctx.strokeText(o.text, o.x - camX, yy); ctx.fillText(o.text, o.x - camX, yy); ctx.globalAlpha = 1; });
  drawCityFront();
}
function drawHUD() {
  { const g = ctx.createLinearGradient(0, 0, 0, 30); g.addColorStop(0, 'rgba(8,10,22,.80)'); g.addColorStop(1, 'rgba(8,10,22,.18)'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, 30); }
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
    drawCityStrip(performance.now() / 55);
    ctx.fillStyle = 'rgba(8,10,28,.34)'; ctx.fillRect(0, 0, VW, VH);
    bigText('MISO', 96, 64, '#ffd94a');
    bigText('★ STARLIGHT ADVENTURE ★', 122, 15, '#fff');
    drawSprite(IMG.miso_stand, VW / 2 - 26, 138, 52, 60, false);
    if (((performance.now() / 480) | 0) % 2 === 0) bigText('PRESS START', 232, 14, '#7CFC9A');
    ctx.font = '700 10px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillStyle = '#cfe2ff';
    ctx.fillText('© 2026 HOMEBREW WORKS  ·  HI-SCORE ' + String(hiScore).padStart(6, '0'), VW / 2, 256);
    ctx.fillText('ARROWS MOVE · SPACE JUMP · X = YARN BALL — STOMP THE GRUMPS, RING THE BELL!', VW / 2, 244);
    return;
  }
  drawWorld();
  if (phase === 'play' || phase === 'clear' || phase === 'card' || phase === 'pause') drawHUD();
  if (phase === 'pause') { ctx.fillStyle = 'rgba(5,6,16,.55)'; ctx.fillRect(0, 0, VW, VH); bigText('PAUSED', 140, 26, '#fff'); }
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
addEventListener('keydown', e => {
  if (e.code !== 'KeyP' && e.code !== 'Escape') return;
  if (phase === 'play') { phase = 'pause'; musicOn = false; SFX.pause(); }
  else if (phase === 'pause') { phase = 'play'; musicOn = true; if (AC) musicNext = AC.currentTime + 0.06; SFX.pause(); }
});
addEventListener('pointerdown', () => { audio(); if (phase !== 'play' && phase !== 'card') advance(); }, true);
addEventListener('touchend', () => audio(), true);
document.addEventListener('visibilitychange', () => { if (!document.hidden) audio(); });
function setupShortRecorder() {
  audio();
  try {
    const stream = cv.captureStream(60);
    if (recDest && recDest.stream) {
      const audioTrack = recDest.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);
    }
    const mime = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('video/webm;codecs=vp9,opus')) ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10000000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: mime });
      const buf = await blob.arrayBuffer();
      try {
        await fetch('/api/save_clip', { method: 'POST', body: buf });
        console.log('__SHORT_RECORDING_DONE__');
        window.__RECORDING_DONE = true;
      } catch (err) {
        console.error('Error posting recorded clip:', err);
      }
    };
    rec.start();
    window.__RECORDER = rec;
  } catch (err) {
    console.error('Recorder setup error:', err);
  }
}

let lastTs = 0;
function loop(ts) {
  const rdt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
  if (hitstop > 0) { hitstop -= rdt; draw(); requestAnimationFrame(loop); return; }
  const dt = rdt;
  if (phase === 'card') { cardT -= dt; if (cardT <= 0) { phase = 'play'; SFX.levelStart(); musicOn = true; if (AC) musicNext = AC.currentTime + 0.5; musicStep = 0; ev('play_start', {}); } }
  else if (phase === 'play') updatePlay(dt);
  else if (phase === 'clear') {
    clearT += dt;
    if (clearT > 3.8 && window.__RECORDER && window.__RECORDER.state === 'recording') {
      window.__RECORDER.stop();
    }
  }
  musicUpdate();
  window.__dbg = { phase, x: player ? Math.round(player.x) : 0, hearts, lives, stars: starsGot, score, time: timeLeft, camX: Math.round(camX), yarn: yarn ? yarn.mode : null, ac: AC ? AC.state : 'none', mus: musicOn };
  draw();
  requestAnimationFrame(loop);
}
buildLevel(); spawnEnemies(); player = newPlayer(2 * TILE); hearts = 3; lives = 3; starsGot = 0; score = 0; timeLeft = 300;
if (AUTO || SHORT) {
  audio();
  startRun();
  if (SHORT) setupShortRecorder();
}
requestAnimationFrame(loop);
