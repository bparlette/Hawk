// HOOP JAM — 2-on-2 arcade basketball, NBA Jam rules: turbo meter, shoves,
// turbo dunks & alley-oops, 3-pointers, On Fire (3 straight makes).
// Clean-room engine: real-court feet, fake-perspective side camera, hold-release
// shot meter, turbo dunks & alley-oops, man-to-man AI, On Fire, special meter.
import { TouchController, isTouchDevice } from './gptouch.js';

const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = 960, H = 640;
const AUTO = new URLSearchParams(location.search).has('auto');
window.__events = [];
function ev(name, data) { window.__events.push(Object.assign({ t: performance.now() | 0, name }, data || {})); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => Math.hypot(a.wx - b.wx, a.wy - b.wy);
function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

// ---------- world / projection ----------
const COURT = { x0: 0, x1: 94, y0: 0, y1: 50 };        // feet
const RIMH = 10;                                          // rim height, ft
const RIMS = [{ wx: 5.25, wy: 25 }, { wx: 88.75, wy: 25 }]; // index = team DEFENDING it
const Y_FAR = 148, Y_NEAR = 606;                          // screen y of far/near sideline
const S_FAR = 13.0, S_NEAR = 18.5;                        // px per foot
let camX = 47;                                            // court-feet at screen center
function scaleAt(wy) { return S_FAR + (S_NEAR - S_FAR) * (wy / 50); }
function proj(wx, wy, wz) {
  const s = scaleAt(wy);
  return { x: W / 2 + (wx - camX) * s, y: Y_FAR + (wy / 50) * (Y_NEAR - Y_FAR) - (wz || 0) * s, s };
}

// ---------- roster ----------
// sht spd def blk reb size(0..1) — two per position, one per team after the pick
const ROSTER = [
  { id: 'rex',   name: 'REX',   pos: 'PG', sht: 78, spd: 88, def: 62, blk: 30, reb: 35, size: 0.25, spec: 'Surge' },
  { id: 'sky',   name: 'SKY',   pos: 'SG', sht: 86, spd: 76, def: 58, blk: 35, reb: 40, size: 0.35, spec: 'Lock-In' },
  { id: 'jolt',  name: 'JOLT',  pos: 'SF', sht: 74, spd: 82, def: 66, blk: 48, reb: 55, size: 0.50, spec: 'Blaze' },
  { id: 'bruno', name: 'BRUNO', pos: 'PF', sht: 68, spd: 58, def: 74, blk: 72, reb: 80, size: 0.80, spec: 'Quake' },
  { id: 'marco', name: 'MARCO', pos: 'C',  sht: 64, spd: 46, def: 78, blk: 88, reb: 92, size: 1.00, spec: 'Quake' },
  { id: 'dre',   name: 'DRE',   pos: 'PG', sht: 82, spd: 84, def: 60, blk: 32, reb: 38, size: 0.30, spec: 'Phase' },
  { id: 'ivan',  name: 'IVAN',  pos: 'SG', sht: 80, spd: 70, def: 70, blk: 40, reb: 45, size: 0.45, spec: 'Freeze' },
  { id: 'kofi',  name: 'KOFI',  pos: 'SF', sht: 76, spd: 74, def: 72, blk: 55, reb: 62, size: 0.55, spec: 'Surge' },
  { id: 'kenji', name: 'KENJI', pos: 'PF', sht: 72, spd: 64, def: 68, blk: 66, reb: 74, size: 0.70, spec: 'Lock-In' },
  { id: 'roxy',  name: 'ROXY',  pos: 'C',  sht: 70, spd: 52, def: 76, blk: 82, reb: 88, size: 0.95, spec: 'Blaze' },
  // ---- legends: extreme builds, same five positions ----
  { id: 'pip',     name: 'PIP',     pos: 'PG', sht: 82, spd: 92, def: 60, blk: 22, reb: 30, size: 0.10, hFt: 5.1, spec: 'Phase' },
  { id: 'dash',    name: 'DASH',    pos: 'SG', sht: 76, spd: 99, def: 58, blk: 28, reb: 34, size: 0.35, hFt: 5.9, spec: 'Surge' },
  { id: 'reach',   name: 'REACH',   pos: 'PF', sht: 72, spd: 62, def: 84, blk: 88, reb: 80, size: 0.75, hFt: 7.0, spec: 'Lock-In' },
  { id: 'goliath', name: 'GOLIATH', pos: 'C',  sht: 62, spd: 40, def: 82, blk: 94, reb: 96, size: 1.00, hFt: 7.6, spec: 'Quake' },
];
const IMG = {};
ROSTER.forEach(r => { const i = new Image(); i.src = window.HJ_ASSETS[r.id]; IMG[r.id] = i; });
const POS_SPOTS = { PG: [0.62, 0.50], SG: [0.78, 0.16], SF: [0.78, 0.84], PF: [0.86, 0.30], C: [0.90, 0.55] }; // fraction toward rim / across

// ---------- audio ----------
let AC = null;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); }
function beep(f, d, type, g) { if (!AC) return; const o = AC.createOscillator(), gn = AC.createGain(); o.type = type || 'square'; o.frequency.value = f; gn.gain.setValueAtTime(g || 0.05, AC.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + d); o.connect(gn); gn.connect(AC.destination); o.start(); o.stop(AC.currentTime + d); }
function noiseS(d, g, f) { if (!AC) return; const n = AC.createBufferSource(), buf = AC.createBuffer(1, AC.sampleRate * d, AC.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; n.buffer = buf; const gn = AC.createGain(); gn.gain.setValueAtTime(g || 0.1, AC.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + d); const fl = AC.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f || 900; n.connect(fl); fl.connect(gn); gn.connect(AC.destination); n.start(); n.stop(AC.currentTime + d); }
const SFX = { bounce: () => beep(120, 0.06, 'sine', 0.08), swish: () => noiseS(0.2, 0.14), clang: () => beep(590, 0.14, 'triangle', 0.09), buzzer: () => beep(150, 0.7, 'sawtooth', 0.1), cheer: () => noiseS(0.6, 0.08, 500), whistle: () => beep(2200, 0.16, 'square', 0.05), dunk: () => { beep(90, 0.2, 'sine', 0.16); noiseS(0.15, 0.1, 300); } };

// ---------- input ----------
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; audio(); if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
let TC = null;
try { if (isTouchDevice()) TC = new TouchController({ buttons: [ { id: 'a', label: 'SHOOT', size: 86 }, { id: 'b', label: 'PASS', size: 66 }, { id: 'c', label: 'TURBO', size: 66 }, { id: 'd', label: 'SPEC', size: 66 } ], maxRadius: 56, deadzone: 0.18 }); } catch (e) {}
let ti = null;
function intent(p) {
  // unified per-frame intent for the human-controlled player
  const it = { x: 0, y: 0, turbo: false, shootH: false, passP: false, stealP: false, specP: false };
  if (keys.ArrowLeft || keys.KeyA) it.x -= 1;
  if (keys.ArrowRight || keys.KeyD) it.x += 1;
  if (keys.ArrowUp || keys.KeyW) it.y -= 1;
  if (keys.ArrowDown || keys.KeyS) it.y += 1;
  it.turbo = !!(keys.ShiftLeft || keys.ShiftRight);
  it.shootH = !!(keys.Space || keys.KeyJ);
  if (ti) {
    if (Math.abs(ti.x) > 0.25 || Math.abs(ti.y) > 0.25) { it.x = ti.x; it.y = ti.y; }
    it.shootH = it.shootH || !!ti.a;
    it.passP = !!ti.bPressed; it.stealP = !!ti.bPressed;
    it.turbo = it.turbo || !!ti.c;
    it.specP = !!ti.dPressed;
  }
  it.passP = it.passP || (keys.KeyK && !intent._pk); if (keys.KeyK) intent._pk = true; else if (!ti) intent._pk = false;
  it.stealP = it.stealP || (keys.KeyL && !intent._pl); if (keys.KeyL) intent._pl = true; else intent._pl = false;
  it.specP = it.specP || ((keys.KeyI || keys.KeyE) && !intent._ps); if (keys.KeyI || keys.KeyE) intent._ps = true; else intent._ps = false;
  const m = Math.hypot(it.x, it.y); if (m > 1) { it.x /= m; it.y /= m; }
  return it;
}

// ---------- state ----------
let phase = 'pick', pickIdx = 0, pickStep = 0, pickA = -1; // 2-on-2: pick a starter, then a partner
function confirmPick(i) {
  if (pickStep === 0) { pickA = i; pickStep = 1; pickIdx = (i + 1) % ROSTER.length; }
  else if (i !== pickA) startGame(pickA, i);
}
let players = [], ball = null, score = [0, 0], quarter = 1, qClock = 75, shotClock = 24, lastTouchTeam = 1;
let pops = [], banner = null, feed = [], camShake = 0, lastTs = 0, charge = null, prevShoot = false, overtime = false;
let ctrl = null; // human-controlled player
const DIFF = { cpuBoost: 0, greenMult: 1.1, catchUp: 0.5 };

function feedSay(text) { feed.unshift({ text, t: 3.4 }); feed = feed.slice(0, 3); }
function pop(wx, wy, text, color, big) { pops.push({ wx, wy, text, color: color || '#fff', t: 1.15, big: !!big }); }
function mkPlayer(r, team) {
  return { r, team, wx: 47, wy: 25, z: 0, vz: 0, vx: 0, vy: 0, face: 1, has: false, fire: 0, streak: 0,
           meter: 0, lockIn: false, phaseT: 0, surgeT: 0, frozenT: 0, downT: 0, stunT: 0, lungeT: 0,
           aiT: 0, plan: null, planT: 0, spot: null, turbo: 1, you: false, jumpCD: 0 };
}
function heightFt(p) { return p.r.hFt || (5.5 + p.r.size * 1.3); }
function atkRim(team) { return RIMS[1 - team]; }        // rim a team attacks
function ownRim(team) { return RIMS[team]; }
function teamOf(p) { return players.filter(q => q.team === p.team); }
function carrier() { return players.find(q => q.has); }
function spd(p) { let s = 10.5 + p.r.spd * 0.105; if (p.frozenT > 0) s *= 0.6; if (p.surgeT > 0) s *= 1.4; return s; }

const roleOf = r => (r.pos === 'PF' || r.pos === 'C') ? 'B' : 'G'; // B = big, G = guard/wing
function buildTeams(youIdx, partnerIdx) {
  // 2-on-2: your two picks vs the best remaining big + best remaining guard
  const mine = [youIdx, partnerIdx], used = new Set(mine), theirs = [];
  const best = role => ROSTER.map((r, i) => i).filter(i => !used.has(i) && roleOf(ROSTER[i]) === role).sort((a, b) => ovr(ROSTER[b]) - ovr(ROSTER[a]))[0];
  const b = best('B'), g = best('G');
  if (b !== undefined) { theirs.push(b); used.add(b); }
  if (g !== undefined) { theirs.push(g); used.add(g); }
  while (theirs.length < 2) { const rest = ROSTER.map((r, i) => i).filter(i => !used.has(i)).sort((a, b2) => ovr(ROSTER[b2]) - ovr(ROSTER[a])); theirs.push(rest[0]); used.add(rest[0]); }
  players = [];
  mine.forEach(i => players.push(mkPlayer(ROSTER[i], 0)));
  theirs.forEach(i => players.push(mkPlayer(ROSTER[i], 1)));
  players.forEach(p => { if (p.r === ROSTER[youIdx]) { p.you = true; } });
}
function ovr(r) { return (r.sht + r.spd + r.def + r.blk + r.reb) / 5; }
function resetPositions(possTeam, tip) {
  players.forEach(p => {
    const rim = atkRim(p.team), spotF = POS_SPOTS[p.r.pos];
    const dir = p.team === 0 ? 1 : -1;
    if (tip) { p.wx = 47 + dir * (p.r.pos === 'C' ? 2 : 8 + Math.random() * 14); p.wy = 8 + Math.random() * 34; }
    else if (p.team === possTeam) { p.wx = rim.wx - dir * (8 + (1 - spotF[0]) * 30); p.wy = 6 + spotF[1] * 38; }
    else { const or2 = ownRim(p.team); p.wx = or2.wx + dir * (10 + (1 - spotF[0]) * 26); p.wy = 6 + spotF[1] * 38; }
    p.z = 0; p.vz = 0; p.has = false; p.downT = 0; p.stunT = 0;
  });
}
function giveBall(p, quiet) {
  players.forEach(q => q.has = false);
  ball.mode = 'held'; ball.owner = p; p.has = true; charge = null;
  lastTouchTeam = p.team;
  if (p.team === 0 || AUTO) ctrl = (p.team === 0 ? (players.find(q => q.you && q.team === 0 && q.has) || p) : p);
  if (p.team === 0 && !AUTO) ctrl = p;
  if (!quiet) ev('possession', { team: p.team, by: p.r.name });
}
function startGame(youIdx, partnerIdx) {
  buildTeams(youIdx, partnerIdx);
  pickStep = 0; pickA = -1;
  score = [0, 0]; quarter = 1; qClock = 75; shotClock = 24; feed = [];
  ball = { wx: 47, wy: 25, z: 6, vx: 0, vy: 0, vz: 0, mode: 'tip', owner: null };
  resetPositions(0, true);
  phase = 'play';
  banner = { text: 'TIP OFF!', t: 1.3, color: '#ffc400' };
  // jump ball: the tallest on each team jumps; leaping (blk/reb/size) + noise decides
  const tallest = t => players.filter(p => p.team === t).sort((a, b) => heightFt(b) - heightFt(a))[0];
  const c0 = tallest(0), c1 = tallest(1);
  const leap = p => (p.r.blk + p.r.reb) * 0.35 + p.r.size * 30 + Math.random() * 22;
  setTimeout(() => { if (phase === 'play' && ball.mode === 'tip') { giveBall(leap(c0) >= leap(c1) ? c0 : c1); feedSay('Tip won — play ball!'); } }, 700);
  ev('tipoff', {});
}
function inbound(team) {
  resetPositions(team);
  const rim = ownRim(team);
  const pg = players.find(p => p.team === team && roleOf(p.r) === 'G') || players.find(p => p.team === team);
  pg.wx = rim.wx + (team === 0 ? 4 : -4); pg.wy = 25;
  giveBall(pg, true);
  shotClock = 24;
  banner = { text: team === 0 ? 'YOUR BALL' : 'CPU BALL', t: 0.9, color: '#cfe2ff' };
}
function endQuarter() {
  SFX.whistle();
  if (quarter >= 4) {
    if (score[0] !== score[1]) { phase = 'over'; banner = { text: score[0] > score[1] ? 'YOU WIN!' : 'CPU WINS', t: 999, color: '#ffc400' }; ev('gameover', { score: score.join('-') }); return; }
    overtime = true; banner = { text: 'OVERTIME — NEXT BUCKET WINS', t: 2.2, color: '#ffc400' }; qClock = 45; inbound(lastTouchTeam); return;
  }
  quarter++; qClock = 75; shotClock = 24;
  banner = { text: 'QUARTER ' + quarter, t: 1.8, color: '#ffc400' };
  inbound(quarter % 2 === 0 ? 1 : 0);
}

// ---------- actions ----------
function addMeter(p, pts) { p.meter = clamp(p.meter + pts, 0, 100); }
function contestOn(shooter) {
  let c = 0, who = null;
  players.forEach(q => {
    if (q.team === shooter.team) return;
    const d = dist2(q, shooter);
    if (d < 7) { const v = (1 - d / 7) * (0.25 + q.r.def * 0.0025 + q.r.size * 0.06) * (q.z > 0.8 ? 1.4 : 1); if (v > c) { c = v; who = q; } }
  });
  return { c, who };
}
function shotCalc(p, meterVal) {
  const rim = atkRim(p.team), d = Math.hypot(p.wx - rim.wx, p.wy - rim.wy);
  const pts = d > 21 ? 3 : 2;
  let w = (0.05 + p.r.sht * 0.0009) * DIFF.greenMult * (p.fire ? 1.5 : 1);
  if (p.lockIn) { w = 1; }
  const err = Math.abs(meterVal - 0.80);
  const grade = p.lockIn || err <= w ? 'perfect' : err <= 2.3 * w ? 'good' : err <= 4.5 * w ? 'off' : 'very';
  const { c: contest } = contestOn(p);
  let prob;
  if (grade === 'perfect') prob = pts === 2 ? 0.94 : 0.86;
  else if (grade === 'good') prob = (pts === 2 ? 0.38 + p.r.sht * 0.0035 : 0.30 + p.r.sht * 0.0028) + 0.06;
  else if (grade === 'off') prob = (pts === 2 ? 0.40 : 0.31) * 0.45;
  else prob = 0.10;
  if (grade !== 'perfect') prob *= (1 - contest * 0.5); else prob *= (1 - contest * 0.35);
  if (d > 35) prob = Math.min(prob, grade === 'perfect' ? 0.25 : 0.04);
  if (p.phaseT > 0) prob = Math.min(0.97, prob + 0.10);
  if (p.fire) prob = Math.min(0.97, prob * 1.08);
  return { pts, grade, make: Math.random() < prob, prob, d, airball: grade === 'very' && Math.random() < 0.4, rim };
}
function flyBallTo(p, tx, ty, tz, dur, onArrive) {
  ball.mode = 'fly'; ball.owner = null; p.has = false;
  ball.fly = { x0: ball.wx, y0: ball.wy, z0: ball.z, x1: tx, y1: ty, z1: tz, t: 0, dur, apex: 5 + Math.hypot(tx - ball.wx, ty - ball.wy) * 0.16, onArrive };
}
function releaseShot(p, meterVal) {
  const q = shotCalc(p, meterVal);
  p.lockIn = false;
  const jumped = p.z > 0.4;
  // block check: airborne defender right on top at release
  const { who } = contestOn(p);
  if (who && who.z > 1.2 && dist2(who, p) < 2.6 && Math.random() < 0.24 + who.r.blk * 0.003) {
    pop(p.wx, p.wy, 'BLOCKED!', '#ff6b6b', true); SFX.clang();
    addMeter(who, 18); ev('block', { by: who.r.name, on: p.r.name });
    looseFrom(p.wx + (Math.random() * 4 - 2), p.wy + (Math.random() * 4 - 2), 3);
    feedSay(who.r.name + ' swats ' + p.r.name + '!');
    return;
  }
  const targetMiss = q.make ? 0 : (q.airball ? 3.2 : 0.9);
  const ang = Math.random() * Math.PI * 2;
  flyBallTo(p, q.rim.wx + Math.cos(ang) * targetMiss * 0.4, q.rim.wy + Math.sin(ang) * targetMiss * 0.4, RIMH, 0.62 + q.d / 55, () => resolveShot(q, p));
  ev('shot', { by: p.r.name, grade: q.grade, pts: q.pts, d: Math.round(q.d) });
}
function resolveShot(q, p) {
  if (q.make) {
    SFX.swish();
    ball.mode = 'drop'; ball.dropT = 0;
    score[p.team] += q.pts;
    p.streak++;
    addMeter(p, 20);
    const mates = teamOf(p); mates.forEach(m => { if (m !== p && ball.lastPasser === m) addMeter(m, 12); });
    if (p.streak === 2) pop(p.wx, p.wy - 4, 'HEATING UP', '#ffb03a', true);
    if (p.streak >= 3 && !p.fire) { p.fire = 1; pop(p.wx, p.wy - 4, 'ON FIRE!', '#ff7a2f', true); feedSay(p.r.name + ' is ON FIRE!'); banner = { text: "HE'S ON FIRE!", t: 1.6, color: '#ff7a2f' }; }
    else if (q.pts === 3) banner = { text: 'FROM DOWNTOWN!', t: 1.2, color: '#ffd94a' };
    players.forEach(o => { if (o.team !== p.team) { o.streak = 0; o.fire = 0; } });
    pop(q.rim.wx, q.rim.wy, '+' + q.pts, '#ffc400', true);
    feedSay(p.r.name + (q.pts === 3 ? ' from downtown! +' : ' scores! +') + q.pts);
    ev('score', { team: p.team, pts: q.pts, by: p.r.name, score: score.join('-') });
    camShake = Math.max(camShake, 2);
    if (phase === 'play' && qClock <= 0 && quarter >= 4) { /* handled by clock */ }
    setTimeout(() => { if (phase === 'play') inbound(1 - p.team); }, 750);
    ball.mode = 'dead'; ball.deadT = 0.75;
  } else {
    SFX.clang();
    if (q.airball) pop(ball.wx, ball.wy, 'AIRBALL', '#ff6b6b');
    feedSay(p.r.name + ' misses.');
    looseFrom(q.rim.wx + (Math.random() * 3 - 1.5), q.rim.wy + (Math.random() * 3 - 1.5), 2.2);
    ev('miss', { by: p.r.name });
  }
}
function tryDunk(p) {
  const rim = atkRim(p.team);
  const { c, who } = contestOn(p);
  const prob = clamp(0.92 - c * 0.55 - (who && who.r.blk > 75 ? 0.12 : 0), 0.45, 0.95);
  const make = Math.random() < prob;
  p.vz = 11.5; // leap with the ball
  p.has = false;
  setTimeout(() => {
    if (phase !== 'play') return;
    ball.wx = rim.wx; ball.wy = rim.wy; ball.z = RIMH;
    if (make) {
      SFX.dunk(); SFX.cheer(); camShake = 6;
      score[p.team] += 2; p.streak++; addMeter(p, 22);
      if (p.streak >= 3 && !p.fire) { p.fire = 1; pop(p.wx, p.wy - 4, 'ON FIRE!', '#ff7a2f', true); }
      players.forEach(o => { if (o.team !== p.team) { o.streak = 0; o.fire = 0; } });
      pop(rim.wx, rim.wy, 'DUNK! +2', '#ffc400', true);
      banner = { text: 'BOOMSHAKALAKA!', t: 1.4, color: '#ffc400' };
      feedSay(p.r.name + ' throws it DOWN!');
      ev('dunk', { by: p.r.name });
      ball.mode = 'dead'; ball.deadT = 0.75;
      setTimeout(() => { if (phase === 'play') inbound(1 - p.team); }, 750);
    } else {
      SFX.clang(); pop(rim.wx, rim.wy, 'OFF THE RIM!', '#ff6b6b', true);
      looseFrom(rim.wx + (Math.random() * 5 - 2.5), rim.wy + (Math.random() * 5 - 2.5), 3);
    }
  }, 210);
  ball.mode = 'dunk'; ball.owner = p;
  ev('dunktry', { by: p.r.name });
}
function looseFrom(wx, wy, vz) {
  ball.mode = 'loose'; ball.owner = null; ball.wx = wx; ball.wy = wy; ball.z = RIMH - 1;
  ball.vx = (Math.random() * 6 - 3); ball.vy = (Math.random() * 4 - 2); ball.vz = vz;
  players.forEach(q => q.has = false);
}
function doPass(p, alley) {
  const rim = atkRim(p.team);
  const mates = teamOf(p).filter(q => q !== p);
  mates.sort((a, b) => (Math.hypot(a.wx - rim.wx, a.wy - rim.wy) + (alley ? 0 : Math.random() * 6)) - Math.hypot(b.wx - rim.wx, b.wy - rim.wy));
  const to = mates[0]; if (!to) return;
  ball.lastPasser = p;
  const dur = clamp(Math.hypot(to.wx - p.wx, to.wy - p.wy) / 38, 0.16, 0.7);
  flyBallTo(p, to.wx, to.wy, 5.5, dur, () => {
    if (alley && Math.hypot(to.wx - rim.wx, to.wy - rim.wy) < 8) { to.z = 4; pop(to.wx, to.wy - 4, 'ALLEY-OOP!', '#7CFC9A', true); giveBall(to, true); tryDunk(to); }
    else giveBall(to);
  });
  SFX.bounce(); ev('pass', { from: p.r.name, to: to.r.name, alley: !!alley });
}
function trySteal(p) {
  const c = carrier(); if (!c || c.team === p.team || p.lungeT > 0) return;
  p.lungeT = 0.55;
  const d = dist2(p, c);
  if (d < 3.4 && c.phaseT <= 0) {
    const prob = 0.16 + p.r.def * 0.0035 - c.r.spd * 0.0012;
    if (Math.random() < prob) {
      addMeter(p, 18); pop(c.wx, c.wy, 'STEAL!', '#7CFC9A', true); SFX.bounce();
      feedSay(p.r.name + ' picks the pocket!');
      ev('steal', { by: p.r.name });
      giveBall(p);
      return;
    }
  }
  p.stunT = 0.3;
}
function tryShove(p) {
  // NBA Jam shove: turbo + steal up close — carrier hits the floor, ball pops loose. No fouls here.
  const c = carrier(); if (!c || c.team === p.team || p.lungeT > 0) return;
  p.lungeT = 0.55;
  if (dist2(p, c) < 4.1 && c.phaseT <= 0) {
    c.downT = 1.3; addMeter(p, 10);
    pop(c.wx, c.wy - 3, 'SHOVED DOWN!', '#ff6b6b', true); SFX.dunk();
    feedSay(p.r.name + ' shoves ' + c.r.name + ' to the floor!');
    ev('shove', { by: p.r.name, on: c.r.name });
    looseFrom(c.wx + (Math.random() * 3 - 1.5), c.wy + (Math.random() * 3 - 1.5), 2.5);
    return;
  }
  trySteal(p);
}
function fireSpecial(p) {
  if (p.meter < 100) return;
  p.meter = 0;
  const s = p.r.spec;
  if (s === 'Surge') { p.surgeT = 5; pop(p.wx, p.wy - 3, 'SURGE!', '#7CFC9A', true); }
  else if (s === 'Lock-In') { p.lockIn = true; pop(p.wx, p.wy - 3, 'LOCK-IN!', '#7CFC9A', true); }
  else if (s === 'Blaze') { p.fire = 1; p.streak = 3; pop(p.wx, p.wy - 3, 'BLAZE!', '#ff7a2f', true); }
  else if (s === 'Phase') { p.phaseT = 5; pop(p.wx, p.wy - 3, 'PHASE!', '#b78cff', true); }
  else if (s === 'Freeze') { players.forEach(q => { if (q.team !== p.team) q.frozenT = 4; }); pop(p.wx, p.wy - 3, 'FREEZE!', '#8fd8ff', true); }
  else if (s === 'Quake') { players.forEach(q => { if (q.team !== p.team && dist2(q, p) < 14) { q.downT = 0.9; if (q.has) { looseFrom(q.wx, q.wy, 2); } } }); pop(p.wx, p.wy - 3, 'QUAKE!', '#ffb03a', true); camShake = 7; SFX.dunk(); }
  feedSay(p.r.name + ' unleashes ' + s + '!');
  ev('special', { by: p.r.name, spec: s });
}

// ---------- ball update ----------
function updateBall(dt) {
  if (ball.mode === 'held' && ball.owner) { ball.wx = ball.owner.wx + ball.owner.face * 0.9; ball.wy = ball.owner.wy + 0.4; ball.z = 3.4 - Math.abs(Math.sin(performance.now() / 140)) * 1.6; }
  else if (ball.mode === 'dunk' && ball.owner) { ball.wx = ball.owner.wx; ball.wy = ball.owner.wy; ball.z = ball.owner.z + 5.5; }
  else if (ball.mode === 'fly') {
    const f = ball.fly; f.t += dt / f.dur;
    if (f.t >= 1) { ball.wx = f.x1; ball.wy = f.y1; ball.z = f.z1; const cb = f.onArrive; ball.fly = null; ball.mode = 'held'; ball.owner = null; if (cb) cb(); }
    else { ball.wx = f.x0 + (f.x1 - f.x0) * f.t; ball.wy = f.y0 + (f.y1 - f.y0) * f.t; ball.z = f.z0 + (f.z1 - f.z0) * f.t + Math.sin(f.t * Math.PI) * f.apex; }
  }
  else if (ball.mode === 'loose') {
    ball.vz -= 32 * dt; ball.z += ball.vz * dt;
    ball.wx += ball.vx * dt; ball.wy += ball.vy * dt;
    ball.vx *= (1 - 0.7 * dt); ball.vy *= (1 - 0.7 * dt);
    if (ball.z <= 0.6) { ball.z = 0.6; ball.vz = Math.abs(ball.vz) > 4 ? -ball.vz * 0.5 : 0; if (Math.abs(ball.vz) > 4) SFX.bounce(); }
    ball.wx = clamp(ball.wx, 1, 93); ball.wy = clamp(ball.wy, 1, 49);
    // pickup: nearest player, rebound rating breaks close calls
    let best = null, bs = -1;
    players.forEach(p => { if (p.downT > 0) return; const d = Math.hypot(p.wx - ball.wx, p.wy - ball.wy); if (d < 1.7 && ball.z < 6) { const sc = (1.7 - d) * 10 + p.r.reb * 0.05; if (sc > bs) { bs = sc; best = p; } } });
    if (best) { giveBall(best); addMeter(best, 8); ev('rebound', { by: best.r.name }); }
  }
  else if (ball.mode === 'dead') { ball.z = Math.max(0.6, ball.z - 14 * dt); }
}

// ---------- AI ----------
function aiIntent(p, dt, now) {
  const it = { x: 0, y: 0, turbo: false, shoot: false, shootRel: false, pass: false, steal: false, spec: false, jump: false };
  p.aiT -= dt; p.planT -= dt;
  const rim = atkRim(p.team), orim = ownRim(p.team), c = carrier();
  const boost = (p.team === 1 ? DIFF.cpuBoost : 0) + (p.team === 1 ? (score[1] - score[0]) * -DIFF.catchUp * 0.4 : 0);
  const moveTo = (tx, ty, full) => { const dx = tx - p.wx, dy = ty - p.wy, d = Math.hypot(dx, dy); if (d > 0.6) { it.x = dx / d; it.y = dy / d; it.turbo = full && d > 9; } };
  if (ball.mode === 'loose') { // everyone converges on loose balls, bigs win ties
    if (p.r.reb > 55 || Math.hypot(p.wx - ball.wx, p.wy - ball.wy) < 16) moveTo(ball.wx, ball.wy, true);
    return it;
  }
  if (!c) return it;
  if (p.has) {
    const d = Math.hypot(p.wx - rim.wx, p.wy - rim.wy);
    if (p.planT <= 0) {
      p.planT = 0.4 + Math.random() * 0.5;
      const r = Math.random();
      p.plan = shotClock < 5 ? 'shoot' : d < 6.5 ? (r < 0.55 ? 'dunk' : 'shoot') : d < 15 ? (r < 0.5 ? 'drive' : r < 0.75 ? 'shoot' : 'pass') : d < 21 ? (r < 0.66 ? 'drive' : r < 0.86 ? 'pass' : 'shoot') : (r < 0.7 ? 'drive' : 'pass');
    }
    if (p.meter >= 100 && Math.random() < 0.3) it.spec = true;
    if (p.plan === 'dunk') { moveTo(rim.wx, rim.wy, true); if (d < 5.2) { it.shoot = true; it.dunk = true; } }
    else if (p.plan === 'drive') { moveTo(rim.wx + (rim.wx < 47 ? 3 : -3), rim.wy + (Math.random() * 6 - 3), true); if (d < 9 && Math.random() < 0.02) p.plan = 'shoot'; if (d < 5.2 && Math.random() < 0.55) { it.shoot = true; it.dunk = true; } }
    else if (p.plan === 'shoot') { if (p.z === 0) { it.shoot = true; } }
    else if (p.plan === 'pass') { it.pass = Math.random() < 0.5; if (!it.pass) moveTo(rim.wx, rim.wy, false); else { p.plan = 'drive'; const mate = teamOf(p).find(q => q !== p); if (mate && Math.hypot(mate.wx - rim.wx, mate.wy - rim.wy) < 11) it.turbo = true; } }
    else moveTo(rim.wx, rim.wy, false);
    return it;
  }
  if (c.team === p.team) { // off-ball offense: floor spot, occasional cut
    const f = POS_SPOTS[p.r.pos], dir = p.team === 0 ? 1 : -1;
    let tx = rim.wx - dir * (1 - f[0]) * 88 * 0.5 - dir * 4, ty = 4 + f[1] * 42;
    if (Math.random() < 0.002) { tx = rim.wx - dir * 5; ty = rim.wy; }
    moveTo(tx, ty, false);
    return it;
  }
  // defense: man-to-man by team slot (2v2 — your opposite number)
  const mySlot = teamOf(p).indexOf(p);
  const opps = players.filter(q => q.team !== p.team);
  const man = opps[Math.min(mySlot, opps.length - 1)] || c;
  const target = (man === c) ? c : man;
  const gx = target.wx + (orim.wx - target.wx) * 0.16, gy = target.wy + (orim.wy - target.wy) * 0.16;
  moveTo(gx, gy, Math.hypot(gx - p.wx, gy - p.wy) > 10);
  if (target === c && Math.hypot(p.wx - c.wx, p.wy - c.wy) < 3.6 && p.aiT <= 0) { it.steal = true; if (p.turbo > 0.45 && Math.random() < 0.5) it.turbo = true; p.aiT = 1.1 + Math.random() * 1.4; }
  if (target === c && c.z > 1 && Math.hypot(p.wx - c.wx, p.wy - c.wy) < 3 && p.z === 0 && Math.random() < 0.5) it.jump = true;
  return it;
}
function applyIntent(p, it, dt, human) {
  if (p.downT > 0 || p.stunT > 0) { p.vx = 0; p.vy = 0; return; }
  let sp = spd(p) * (p.has ? 0.94 : 1);
  const turboOn = it.turbo && (p.fire || p.turbo > 0.05);
  if (turboOn && !p.fire) p.turbo = Math.max(0, p.turbo - dt * 0.45); else p.turbo = Math.min(1, p.turbo + dt * 0.16);
  if (it.turbo && turboOn) sp *= 1.34;
  p.vx = it.x * sp; p.vy = it.y * sp * 0.92;
  if (it.x) p.face = Math.sign(it.x);
  p.wx = clamp(p.wx + p.vx * dt, 1.2, 92.8);
  p.wy = clamp(p.wy + p.vy * dt, 1.2, 48.8);
  if (p.jumpCD > 0) p.jumpCD -= dt;
  // jump: explicit jump intent, or the shoot button while defending (context label JUMP)
  const c0 = carrier();
  const wantJump = it.jump || (!p.has && it.shootH && c0 && c0.team !== p.team);
  if (wantJump && p.z === 0 && p.jumpCD <= 0) { p.vz = 10.5; p.jumpCD = 0.7; }
  if (p.z > 0 || p.vz !== 0) { p.z += p.vz * dt; p.vz -= 32 * dt; if (p.z <= 0) { p.z = 0; p.vz = 0; } }
  if (p.has) {
    const rim = atkRim(p.team), d = Math.hypot(p.wx - rim.wx, p.wy - rim.wy);
    const dunkRange = p.fire ? 9.5 : 6.5;
    if (it.shootH && !prevShootOf(p)) {
      if ((d < dunkRange && it.turbo) || it.dunk) { tryDunk(p); return; }
      const sigma = Math.max(0.05, 0.09 + (100 - p.r.sht) * 0.0018);
      charge = { p, t: 0, rel: human ? 9 : clamp(0.80 + gauss() * sigma * 2, 0.02, 1) };
    }
    if (charge && charge.p === p) {
      charge.t += dt / 0.62;
      if (!human && charge.t >= charge.rel) { releaseShot(p, charge.rel); charge = null; }
      else if (charge.t >= 1.2) { releaseShot(p, 1); charge = null; }
      else if (!it.shootH && human) { releaseShot(p, clamp(charge.t, 0, 1)); charge = null; }
    }
    if (it.pass) doPass(p, it.turbo);
    if (it.spec) fireSpecial(p);
  } else {
    if (it.steal) { if (it.turbo) tryShove(p); else trySteal(p); }
    if (it.pass && human) switchCtrl();
    if (it.spec && human) { /* specials fire from the carrier only */ }
  }
  p._prevShoot = it.shootH;
}
function prevShootOf(p) { return !!p._prevShoot; }
function switchCtrl() {
  if (!ctrl) return;
  const c = carrier();
  const mates = teamOf(ctrl).filter(q => q !== ctrl && q.downT <= 0);
  if (!mates.length) return;
  mates.sort((a, b) => Math.hypot(a.wx - (c ? c.wx : 47), a.wy - (c ? c.wy : 25)) - Math.hypot(b.wx - (c ? c.wx : 47), b.wy - (c ? c.wy : 25)));
  ctrl = mates[0];
}

// ---------- main update ----------
function update(dt) {
  ti = TC ? TC.getInput() : null;
  if (phase !== 'play') { window.__dbg = { phase }; return; }
  const now = performance.now() / 1000;
  qClock -= dt; shotClock -= dt;
  if (shotClock <= 0) { SFX.whistle(); feedSay('Shot clock violation!'); const c = carrier(); inbound(c ? 1 - c.team : lastTouchTeam); }
  if (overtime && score[0] !== score[1]) { phase = 'over'; banner = { text: score[0] > score[1] ? 'YOU WIN!' : 'CPU WINS', t: 999, color: '#ffc400' }; SFX.buzzer(); ev('gameover', { score: score.join('-') }); }
  if (qClock <= 0) { if (quarter < 4 || !overtime) endQuarter(); else qClock = 45; }
  // control assignment: offense → carrier; defense → ctrl stays (switchable)
  const c = carrier();
  if (c && c.team === 0 && !AUTO) ctrl = c;
  if (!ctrl || ctrl.team !== 0) ctrl = players.find(p => p.you) || ctrl;
  players.forEach(p => {
    ['fire', 'phaseT', 'surgeT', 'frozenT', 'downT', 'stunT', 'lungeT'].forEach(k => { if (p[k] > 0 && k !== 'fire') p[k] = Math.max(0, p[k] - dt); });
    if (p.you && !AUTO && ctrl === p) {
      const it = intent(p);
      applyIntent(p, { x: it.x, y: it.y, turbo: it.turbo, shootH: it.shootH, pass: it.passP, steal: it.stealP, spec: it.specP, jump: false }, dt, true);
    } else if (p === ctrl && !AUTO && c && c.team !== 0) {
      const it = intent(p);
      applyIntent(p, { x: it.x, y: it.y, turbo: it.turbo, shootH: it.shootH, pass: it.passP, steal: it.stealP, spec: it.specP, jump: false }, dt, true);
    } else {
      const ai = aiIntent(p, dt, now);
      applyIntent(p, { x: ai.x, y: ai.y, turbo: ai.turbo, shootH: ai.shoot, pass: ai.pass, steal: ai.steal, spec: ai.spec, jump: ai.jump, dunk: ai.dunk }, dt, false);
    }
    if (p.has && charge && charge.p !== p) charge = null;
  });
  if (ball.mode !== 'tip') updateBall(dt);
  // camera follows the ball
  const target = clamp(ball.wx, 30, 64);
  camX += (target - camX) * Math.min(1, dt * 3.2);
  pops = pops.filter(o => (o.t -= dt) > 0);
  feed.forEach(f => f.t -= dt); feed = feed.filter(f => f.t > 0);
  if (banner && banner.t < 900) banner.t -= dt;
  if (camShake > 0) camShake = Math.max(0, camShake - dt * 10);
  window.__dbg = { phase, score: score.slice(), quarter, qClock: Math.ceil(qClock), shot: Math.ceil(shotClock), ball: ball.mode, ctrl: ctrl ? ctrl.r.name : null, players: players.map(p => ({ n: p.r.name, t: p.team, x: Math.round(p.wx), y: Math.round(p.wy), has: p.has, fire: p.fire, meter: Math.round(p.meter) })) };
}

// ---------- rendering ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function drawCourt() {
  // arena backdrop + crowd
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d1430'); g.addColorStop(0.24, '#16224d'); g.addColorStop(0.26, '#7a4a21'); g.addColorStop(1, '#8a5a28');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // crowd: pre-rendered dot rows
  if (!drawCourt._crowd) {
    const c = document.createElement('canvas'); c.width = W; c.height = 76; const x2 = c.getContext('2d');
    const cols = ['#e8b4b8', '#a8c8ec', '#f5d76e', '#98d8a8', '#d8a8ec', '#f0f0f0', '#e88a6a', '#7ab8d8'];
    for (let row = 0; row < 4; row++) for (let i = 0; i < 96; i++) {
      x2.fillStyle = cols[(Math.random() * cols.length) | 0];
      x2.beginPath(); x2.arc(6 + i * 10 + (row % 2) * 5, 12 + row * 17, 4.4, 0, 7); x2.fill();
      x2.fillStyle = 'rgba(0,0,0,.18)'; x2.fillRect(2 + i * 10 + (row % 2) * 5, 17 + row * 17, 8, 5);
    }
    drawCourt._crowd = c;
  }
  ctx.drawImage(drawCourt._crowd, 0, 26);
  ctx.fillStyle = '#101a3d'; ctx.fillRect(0, 0, W, 24);
  ctx.font = '900 15px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd94a';
  ctx.fillText('H O O P   J A M', W / 2, 17);
  // LED strip
  ctx.fillStyle = '#1d3a17'; ctx.fillRect(0, 134, W, 12);
  ctx.fillStyle = '#9fe870'; ctx.font = '700 10px monospace'; ctx.fillText('★ 2 ON 2 ★ TURBO DUNKS ★ ALLEY-OOPS ★ ON FIRE ★ NO FOULS ★', W / 2, 143);
  // floor trapezoid
  const p00 = proj(0, 0), p10 = proj(94, 0), p11 = proj(94, 50), p01 = proj(0, 50);
  ctx.beginPath(); ctx.moveTo(p00.x, p00.y); ctx.lineTo(p10.x, p10.y); ctx.lineTo(p11.x, p11.y); ctx.lineTo(p01.x, p01.y); ctx.closePath();
  const fg = ctx.createLinearGradient(0, Y_FAR, 0, Y_NEAR); fg.addColorStop(0, '#a06a2e'); fg.addColorStop(1, '#c98d43');
  ctx.fillStyle = fg; ctx.fill();
  ctx.save(); ctx.clip();
  // planks
  ctx.strokeStyle = 'rgba(90,50,15,.35)'; ctx.lineWidth = 1.4;
  for (let wy = 5; wy < 50; wy += 5) { const a = proj(0, wy), b = proj(94, wy); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  for (let wx = 8; wx < 94; wx += 8) { const a = proj(wx, 0), b = proj(wx, 50); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  // painted keys + center
  const key = (rimWx, dir) => { const x0 = dir > 0 ? 0 : 94 - 19; const a = proj(x0, 19), b = proj(x0 + 19, 31); ctx.fillRect(Math.min(a.x, b.x), a.y, Math.abs(b.x - a.x), b.y - a.y); };
  ctx.fillStyle = 'rgba(40,95,205,.30)'; key(5.25, 1); ctx.fillStyle = 'rgba(205,45,45,.26)'; key(88.75, -1);
  const cc = proj(47, 25); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.ellipse(cc.x, cc.y, 6.1 * cc.s * 0.62, 6.1 * cc.s * 0.30, 0, 0, 7); ctx.stroke();
  // 3pt arcs + key outlines + boundary
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  [[5.25, 1], [88.75, -1]].forEach(([rx, dir]) => {
    const rp = proj(rx, 25);
    ctx.beginPath(); ctx.ellipse(rp.x, rp.y, 21 * rp.s * 0.62, 21 * rp.s * 0.30, 0, dir > 0 ? -1.15 : Math.PI - 1.15 + 0, dir > 0 ? 1.15 : Math.PI + 1.15); ctx.stroke();
    const a = proj(dir > 0 ? 0 : 75, 19), b = proj(dir > 0 ? 19 : 94, 31);
    ctx.strokeRect(Math.min(a.x, b.x), a.y, Math.abs(b.x - a.x), b.y - a.y);
  });
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.moveTo(p00.x, p00.y); ctx.lineTo(p10.x, p10.y); ctx.lineTo(p11.x, p11.y); ctx.lineTo(p01.x, p01.y); ctx.closePath(); ctx.stroke();
  ctx.restore();
  // hoops
  RIMS.forEach((rim, i) => {
    const rp = proj(rim.wx, rim.wy, RIMH), base = proj(rim.wx + (i === 0 ? -2.4 : 2.4), rim.wy, 0);
    ctx.strokeStyle = '#2b3a5e'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(rp.x + (i === 0 ? -8 : 8), rp.y + 6); ctx.stroke();
    ctx.fillStyle = 'rgba(230,240,255,.92)'; const bw = 3.4 * rp.s * 0.62, bh = 2.2 * rp.s * 0.30;
    ctx.fillRect(rp.x - bw / 2 + (i === 0 ? -4 : 4), rp.y - bh - 4, bw, bh);
    ctx.strokeStyle = '#e8490f'; ctx.lineWidth = 2; ctx.strokeRect(rp.x - bw / 2 + (i === 0 ? -4 : 4), rp.y - bh - 4, bw, bh);
    ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.ellipse(rp.x, rp.y, 0.75 * rp.s * 0.62, 0.75 * rp.s * 0.30, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(rp.x - 7, rp.y + 2); ctx.lineTo(rp.x - 3, rp.y + 13); ctx.moveTo(rp.x + 7, rp.y + 2); ctx.lineTo(rp.x + 3, rp.y + 13); ctx.moveTo(rp.x - 3, rp.y + 13); ctx.lineTo(rp.x + 3, rp.y + 13); ctx.stroke();
  });
}
function drawPlayer(p) {
  const img = IMG[p.r.id];
  const hFt = heightFt(p), pr = proj(p.wx, p.wy, 0);
  const ph = hFt * pr.s * 0.74, pw = img && img.naturalHeight ? ph * img.naturalWidth / img.naturalHeight : ph * 0.6;
  const lift = p.z * pr.s;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 3, pw * 0.42, 5.5, 0, 0, 7); ctx.fill();
  if (p.fire) { ctx.save(); ctx.globalAlpha = 0.55 + Math.sin(performance.now() / 80) * 0.18; ctx.fillStyle = '#ff7a2f'; ctx.beginPath(); ctx.ellipse(pr.x, pr.y - lift - ph * 0.55, pw * 0.52, ph * 0.58, 0, 0, 7); ctx.fill(); ctx.restore(); }
  if (p.phaseT > 0) ctx.globalAlpha = 0.55;
  if (img && img.complete && img.naturalWidth) {
    ctx.save();
    if (p.face < 0) { ctx.translate(pr.x, 0); ctx.scale(-1, 1); ctx.drawImage(img, -pw / 2, pr.y - lift - ph, pw, ph); }
    else ctx.drawImage(img, pr.x - pw / 2, pr.y - lift - ph, pw, ph);
    ctx.restore();
  } else { ctx.fillStyle = p.team ? '#c33' : '#28c'; rr(pr.x - pw / 2, pr.y - lift - ph, pw, ph, 8); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (p.downT > 0) { ctx.font = '13px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillText('💫', pr.x, pr.y - lift - ph - 6); }
  if (ctrl === p && !AUTO) { ctx.fillStyle = '#ffc400'; const bob = Math.sin(performance.now() / 200) * 3; ctx.beginPath(); ctx.moveTo(pr.x - 8, pr.y - lift - ph - 18 + bob); ctx.lineTo(pr.x + 8, pr.y - lift - ph - 18 + bob); ctx.lineTo(pr.x, pr.y - lift - ph - 7 + bob); ctx.fill(); }
  if (p.has || ctrl === p) { ctx.font = '900 10px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillStyle = p.team ? '#ffb3ab' : '#bfe0ff'; ctx.fillText(p.r.name, pr.x, pr.y + 16); }
  // special meter mini-bar for the human's controlled player / carrier
  if (p === ctrl || p.has) { const w2 = 34; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(pr.x - w2 / 2, pr.y + 20, w2, 4); ctx.fillStyle = p.meter >= 100 ? '#7CFC9A' : '#ffc400'; ctx.fillRect(pr.x - w2 / 2, pr.y + 20, w2 * p.meter / 100, 4); }
}
function drawBall() {
  if (!ball || ball.mode === 'tip' || ball.mode === 'dead') return;
  const pr = proj(ball.wx, ball.wy, 0), r = Math.max(4.5, 0.42 * pr.s);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 3, r * 0.9, 3.4, 0, 0, 7); ctx.fill();
  const bp = proj(ball.wx, ball.wy, ball.z);
  ctx.fillStyle = '#f07818'; ctx.beginPath(); ctx.arc(bp.x, bp.y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#7a3405'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(bp.x, bp.y, r, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bp.x - r, bp.y); ctx.lineTo(bp.x + r, bp.y); ctx.stroke();
}
function fmtClock(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function drawHUD() {
  // broadcast scorebug, bottom-left
  rr(14, H - 64, 356, 50, 10); ctx.fillStyle = 'rgba(8,12,28,.86)'; ctx.fill();
  ctx.font = '900 21px Trebuchet MS'; ctx.textAlign = 'left';
  ctx.fillStyle = '#7db9ff'; ctx.fillText('YOU ' + score[0], 26, H - 32);
  ctx.fillStyle = '#ff9d94'; ctx.fillText(score[1] + ' CPU', 128, H - 32);
  ctx.fillStyle = '#fff'; ctx.font = '900 18px Trebuchet MS';
  ctx.fillText((overtime ? 'OT' : 'Q' + quarter) + ' ' + fmtClock(qClock), 232, H - 32);
  ctx.fillStyle = shotClock <= 5 ? '#ff6b6b' : '#ffd94a'; ctx.fillText('⏱ ' + Math.max(0, Math.ceil(shotClock)), 316, H - 32);
  // turbo meter for your controlled player (Jam rules: drains sprinting, free while on fire)
  if (ctrl && ctrl.team === 0) {
    rr(14, H - 108, 212, 30, 8); ctx.fillStyle = 'rgba(8,12,28,.86)'; ctx.fill();
    ctx.font = '900 11px Trebuchet MS'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffb03a'; ctx.fillText(ctrl.fire ? '🔥 TURBO — ON FIRE' : 'TURBO', 24, H - 88);
    rr(96, H - 100, 118, 9, 4); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill();
    rr(96, H - 100, Math.max(6, 118 * (ctrl.fire ? 1 : ctrl.turbo)), 9, 4); ctx.fillStyle = ctrl.fire ? '#ff7a2f' : '#ffb03a'; ctx.fill();
  }
  // event feed (battle-text box), bottom-right
  if (feed.length) {
    rr(W - 330, H - 64, 316, 50, 10); ctx.fillStyle = 'rgba(8,12,28,.78)'; ctx.fill();
    ctx.font = '700 15px Trebuchet MS'; ctx.fillStyle = '#eaf2ff'; ctx.textAlign = 'left';
    ctx.fillText(feed[0].text.slice(0, 34), W - 316, H - 32);
  }
  // shot meter above the charging player
  if (charge) {
    const p = charge.p, pr = proj(p.wx, p.wy, 0), m = clamp(charge.t, 0, 1);
    const bx = pr.x - 44, by = pr.y - heightFt(p) * pr.s * 0.66 - p.z * pr.s - 34, bw = 88;
    rr(bx, by, bw, 12, 6); ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fill();
    const w = (0.05 + p.r.sht * 0.0009) * DIFF.greenMult * (p.fire ? 1.5 : 1);
    ctx.fillStyle = '#39d353'; ctx.fillRect(bx + (0.80 - w) * bw, by, w * 2 * bw, 12);
    ctx.fillStyle = '#ffc400'; ctx.fillRect(bx, by, m * bw, 12);
    ctx.fillStyle = '#fff'; ctx.font = '900 10px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillText('RELEASE!', pr.x, by - 4);
  }
  pops.forEach(o => {
    const pr = proj(o.wx, o.wy, 6);
    ctx.globalAlpha = Math.min(1, o.t * 1.7); ctx.font = '900 ' + (o.big ? 27 : 17) + 'px Trebuchet MS'; ctx.textAlign = 'center';
    ctx.fillStyle = o.color; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4;
    const yy = pr.y - (1.15 - o.t) * 40; ctx.strokeText(o.text, pr.x, yy); ctx.fillText(o.text, pr.x, yy); ctx.globalAlpha = 1;
  });
  if (banner && banner.t > 0) {
    ctx.font = '900 46px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillStyle = banner.color;
    ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 8; ctx.strokeText(banner.text, W / 2, 108); ctx.fillText(banner.text, W / 2, 108);
  }
  if (phase === 'over') { ctx.font = '700 18px Trebuchet MS'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('Tap or press Enter to play again', W / 2, 140); }
}
function drawPick() {
  ctx.fillStyle = '#0d1430'; ctx.fillRect(0, 0, W, H);
  ctx.font = '900 46px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd94a'; ctx.fillText('HOOP JAM', W / 2, 72);
  ctx.font = '700 18px Trebuchet MS'; ctx.fillStyle = '#cfe2ff'; ctx.fillText(pickStep === 0 ? '2 ON 2 — pick your STARTER' : 'Now pick your PARTNER', W / 2, 102);
  ROSTER.forEach((r, i) => {
    const col = i % 7, row = (i / 7) | 0, cx = 66 + col * 138, cy = 124 + row * 252, w = 126, h = 234;
    rr(cx - w / 2, cy, w, h, 14); ctx.fillStyle = i === pickIdx ? 'rgba(255,196,0,.22)' : 'rgba(255,255,255,.06)'; ctx.fill();
    ctx.lineWidth = i === pickIdx ? 4 : 2; ctx.strokeStyle = i === pickIdx ? '#ffc400' : 'rgba(255,255,255,.22)'; ctx.stroke();
    const img = IMG[r.id];
    if (img && img.complete && img.naturalWidth) { const ih = 124, iw = ih * img.naturalWidth / img.naturalHeight; ctx.save(); rr(cx - w / 2 + 3, cy + 3, w - 6, 140, 12); ctx.clip(); ctx.drawImage(img, cx - iw / 2, cy + 6, iw, ih); ctx.restore(); }
    ctx.font = '900 14.5px Trebuchet MS'; ctx.fillStyle = '#fff'; ctx.fillText(r.name + ' · ' + r.pos, cx, cy + 156);
    ctx.font = '700 11px Trebuchet MS'; ctx.fillStyle = '#9fb8dd';
    ctx.fillText('SHT ' + r.sht + ' SPD ' + r.spd + ' DEF ' + r.def, cx, cy + 178);
    ctx.fillText('BLK ' + r.blk + ' REB ' + r.reb + ' · ' + r.spec, cx, cy + 196);
    if (pickStep === 1 && i === pickA) { ctx.fillStyle = '#7CFC9A'; ctx.fillText('★ YOUR STARTER', cx, cy + 216); }
    else if (r.hFt) { ctx.fillStyle = '#ffd94a'; ctx.fillText('★ LEGEND', cx, cy + 216); }
  });
  ctx.font = '700 15px Trebuchet MS'; ctx.fillStyle = '#8fa8cc';
  ctx.fillText('SHOOT hold Space · PASS K (turbo = alley-oop) · STEAL L (turbo = SHOVE) · TURBO Shift · SPECIAL E', W / 2, 622);
}
function draw() {
  ctx.save();
  if (camShake) ctx.translate((Math.random() - 0.5) * camShake, (Math.random() - 0.5) * camShake);
  if (phase === 'pick') { drawPick(); ctx.restore(); return; }
  drawCourt();
  players.slice().sort((a, b) => a.wy - b.wy).forEach(drawPlayer);
  drawBall();
  drawHUD();
  ctx.restore();
}
function loop(ts) {
  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
  update(dt); draw();
  requestAnimationFrame(loop);
}
addEventListener('keydown', e => {
  if (phase === 'pick') {
    if (e.code === 'ArrowRight' || e.code === 'KeyD') pickIdx = Math.min(ROSTER.length - 1, pickIdx + 1);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') pickIdx = Math.max(0, pickIdx - 1);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') pickIdx = Math.min(ROSTER.length - 1, pickIdx + 7);
    if (e.code === 'ArrowUp' || e.code === 'KeyW') pickIdx = Math.max(0, pickIdx - 7);
    if (e.code === 'Enter' || e.code === 'Space') { audio(); confirmPick(pickIdx); }
  } else if (phase === 'over' && (e.code === 'Enter' || e.code === 'Space')) { phase = 'pick'; pickStep = 0; pickA = -1; }
});
addEventListener('pointerdown', e => {
  audio();
  if (phase !== 'pick' && phase !== 'over') return;
  const rect = cv.getBoundingClientRect(), sx = (e.clientX - rect.left) * W / rect.width, sy = (e.clientY - rect.top) * H / rect.height;
  if (phase === 'pick') {
    ROSTER.forEach((r, i) => { const col = i % 7, row = (i / 7) | 0, cx = 66 + col * 138, cy = 124 + row * 252; if (Math.abs(sx - cx) < 66 && sy > cy && sy < cy + 238) { pickIdx = i; confirmPick(i); } });
  } else { phase = 'pick'; pickStep = 0; pickA = -1; }
}, true);
if (AUTO) { const iv = setInterval(() => { if (IMG.rex && IMG.rex.complete) { startGame(0, 4); clearInterval(iv); } }, 150); }
window.__dbg = { phase };
requestAnimationFrame(loop);
