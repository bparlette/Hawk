// Sticker Jam — big-head arcade hoops, 3v3. Clean-room arcade build.
import { TouchController, isTouchDevice } from './gptouch.js';

const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const W = 960, H = 640, FLOOR = 554;
const RIM = { L: { x: 158, y: 302 }, R: { x: 815, y: 302 } };
const AUTO = new URLSearchParams(location.search).has('auto');
window.__events = [];
function ev(name, data) { window.__events.push(Object.assign({ t: performance.now() | 0, name }, data || {})); }

// ---------- roster ----------
const ROSTER = [
  { id: 'curly',    name: 'CURLY',    spd: 62, sht: 78, def: 55 },
  { id: 'ponytail', name: 'VIOLET',   spd: 74, sht: 70, def: 60 },
  { id: 'mohawk',   name: 'MOHAWK',   spd: 68, sht: 66, def: 72 },
  { id: 'coolcat',  name: 'COOL CAT', spd: 58, sht: 82, def: 64 },
  { id: 'robot',    name: 'BOLT',     spd: 52, sht: 74, def: 80 },
  { id: 'grandma',  name: 'GRAN',     spd: 44, sht: 88, def: 50 },
  { id: 'spikes',   name: 'SPIKE',    spd: 84, sht: 62, def: 58 },
  { id: 'braids',   name: 'PINKY',    spd: 70, sht: 72, def: 66 },
  { id: 'bear',     name: 'BEAR',     spd: 48, sht: 68, def: 84 },
  { id: 'capkid',   name: 'CAP',      spd: 78, sht: 64, def: 62 },
];
const IMG = {};
function loadImg(key) { const i = new Image(); i.src = window.SJ_ASSETS[key]; IMG[key] = i; }
ROSTER.forEach(r => loadImg(r.id)); loadImg('court');

// ---------- audio (tiny synth) ----------
let AC = null;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); }
function beep(f, d, type, g) { if (!AC) return; const o = AC.createOscillator(), gn = AC.createGain(); o.type = type || 'square'; o.frequency.value = f; gn.gain.setValueAtTime(g || 0.06, AC.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + d); o.connect(gn); gn.connect(AC.destination); o.start(); o.stop(AC.currentTime + d); }
function noise(d, g) { if (!AC) return; const n = AC.createBufferSource(), buf = AC.createBuffer(1, AC.sampleRate * d, AC.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; n.buffer = buf; const gn = AC.createGain(); gn.gain.setValueAtTime(g || 0.12, AC.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + d); const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; n.connect(f); f.connect(gn); gn.connect(AC.destination); n.start(); n.stop(AC.currentTime + d); }
const SFX = { bounce: () => beep(140, 0.07, 'sine', 0.10), swish: () => noise(0.22, 0.16), clang: () => beep(620, 0.16, 'triangle', 0.10), buzzer: () => beep(160, 0.8, 'sawtooth', 0.12), cheer: () => noise(0.7, 0.10), pop: () => beep(880, 0.06, 'square', 0.05) };

// ---------- input ----------
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; audio(); if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
let TC = null;
try { if (isTouchDevice()) TC = new TouchController({ buttons: [ { id: 'a', label: 'SHOOT', size: 84 }, { id: 'b', label: 'PASS', size: 64 } ], maxRadius: 56, deadzone: 0.18 }); } catch (e) {}
let ti = null;

// ---------- game state ----------
let phase = 'pick', pickIdx = 0, pickPtr = null;
let players = [], ball = null, score = [0, 0], clock = 180, golden = false, over = false;
let pops = [], banner = null, shake = 0, lastTs = 0, charge = null, prevA = false;

function mkPlayer(r, team, x) {
  return { r, team, x, z: 0, vz: 0, vx: 0, face: team === 0 ? 1 : -1, has: false, fire: 0, streak: 0,
           aiT: Math.random() * 0.5, think: { tx: x, shootAt: 0, passAt: 0 }, lunge: 0, stun: 0 };
}
function atkRim(p) { return p.team === 0 ? RIM.R : RIM.L; }
function defRim(p) { return p.team === 0 ? RIM.L : RIM.R; }
function speed(p) { return 150 + p.r.spd * 3.1; }

function startGame(youIdx) {
  const pool = ROSTER.map((r, i) => i).filter(i => i !== youIdx);
  for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const mine = [youIdx, pool[0], pool[1]], theirs = [pool[2], pool[3], pool[4]];
  players = [];
  mine.forEach((ri, k) => players.push(mkPlayer(ROSTER[ri], 0, 300 + k * 90)));
  theirs.forEach((ri, k) => players.push(mkPlayer(ROSTER[ri], 1, 660 - k * 90)));
  players[0].you = true;
  ball = { mode: 'held', owner: players[5], x: 660, y: 470, z: 60, vx: 0, vy: 0, vz: 0 };
  players[5].has = true;
  score = [0, 0]; clock = 180; golden = false; over = false; phase = 'play';
  banner = { text: 'TIP OFF!', t: 1.4, color: '#ffc400' };
  ev('tipoff', {});
}
function giveBall(p) {
  players.forEach(q => q.has = false);
  ball.mode = 'held'; ball.owner = p; p.has = true; p.charge = 0;
  if (p.ai) { p.think.shootAt = performance.now() / 1000 + 1.2 + Math.random() * 2.6; p.think.passAt = performance.now() / 1000 + 0.8 + Math.random() * 2; }
}
function inbound(team) {
  const rim = team === 0 ? RIM.L : RIM.R;
  const p = players.filter(q => q.team === team)[0];
  players.forEach(q => { q.x = team === 0 ? (q === p ? 130 : 260 + Math.random() * 120) : (q === p ? 830 : 600 + Math.random() * 120); q.z = 0; q.vz = 0; });
  p.x = rim.x + (team === 0 ? 30 : -30);
  giveBall(p);
}
function pop(x, y, text, color, big) { pops.push({ x, y, text, color: color || '#fff', t: 1.1, big: !!big }); }

// ---------- shooting ----------
function shotQuality(p, meter) {
  const rim = atkRim(p), d = Math.abs(p.x - rim.x);
  const pts = d > 255 ? 3 : 2;
  const ideal = 0.80, w = 0.055 + p.r.sht * 0.0009 + (p.fire > 0 ? 0.035 : 0);
  const err = Math.abs(meter - ideal);
  let grade = err <= w ? 'perfect' : err <= 2.3 * w ? 'good' : 'off';
  let base = d < 95 ? 0.78 : pts === 2 ? 0.55 : 0.40;
  let prob;
  if (grade === 'perfect') prob = pts === 2 ? 0.94 : 0.86;
  else if (grade === 'good') prob = base * (0.72 + p.r.sht / 250);
  else prob = base * 0.42;
  let contest = 0;
  players.forEach(q => { if (q.team !== p.team) { const dd = Math.abs(q.x - p.x); if (dd < 62) contest = Math.max(contest, (1 - dd / 62) * (0.35 + q.r.def * 0.004) * (q.z > 26 ? 1.4 : 1)); } });
  prob *= (1 - contest * 0.55);
  if (p.fire > 0) prob = Math.min(0.97, prob * 1.12);
  return { pts, grade, make: Math.random() < prob, prob };
}
function releaseShot(p, meter) {
  const q = shotQuality(p, meter), rim = atkRim(p);
  p.has = false; ball.mode = 'fly'; ball.owner = null;
  const tx = q.make ? rim.x + (Math.random() * 6 - 3) : rim.x + (Math.random() < 0.5 ? -1 : 1) * (13 + Math.random() * 10);
  ball.fly = { x0: p.x + p.face * 16, y0: FLOOR - 118 - p.z, x1: tx, y1: rim.y, t: 0, dur: 0.55 + Math.abs(tx - p.x) / 1400, apex: 130 + Math.abs(tx - p.x) * 0.22, q, shooter: p };
  ball.x = ball.fly.x0; ball.y = ball.fly.y0;
  ev('shot', { by: p.r.name, grade: q.grade, pts: q.pts });
}
function scoreShot(q, shooter) {
  score[shooter.team] += q.pts;
  shooter.streak++; shooter.fire = shooter.streak >= 3 ? 1 : shooter.fire;
  players.forEach(o => { if (o.team !== shooter.team) { o.streak = 0; o.fire = 0; } });
  pop(ball.x, ball.y - 40, '+' + q.pts, '#ffc400', true);
  if (q.grade === 'perfect') { pop(ball.x, ball.y - 78, 'SWISH!', '#7CFC9A', true); SFX.swish(); }
  if (shooter.fire) { pop(shooter.x, FLOOR - 190, 'ON FIRE!', '#ff7a2f', true); }
  SFX.cheer(); shake = Math.max(shake, 3);
  ev('score', { team: shooter.team, pts: q.pts, score: score.join('-') });
  if (golden || clock <= 0) { endGame(); return; }
  setTimeout(() => { if (phase === 'play') inbound(1 - shooter.team); }, 650);
  ball.mode = 'dead'; ball.deadT = 0.65;
}
function endGame() {
  over = true; phase = 'over'; SFX.buzzer();
  banner = { text: score[0] === score[1] ? 'TIE GAME!' : (score[0] > score[1] ? 'YOU WIN!' : 'CPU WINS'), t: 999, color: '#ffc400' };
  ev('gameover', { score: score.join('-') });
}

// ---------- ball helpers ----------
function looseBall(vx, vz) { ball.mode = 'loose'; ball.owner = null; ball.vx = vx; ball.vz = vz; ball.z = 40; }
function updateBall(dt) {
  if (ball.mode === 'held' && ball.owner) { ball.x = ball.owner.x + ball.owner.face * 20; ball.y = FLOOR - 66 - ball.owner.z + Math.abs(Math.sin(performance.now() / 130)) * 8; }
  else if (ball.mode === 'fly') {
    const f = ball.fly; f.t += dt / f.dur;
    if (f.t >= 1) {
      ball.x = f.x1; ball.y = f.y1;
      if (f.q.make) { SFX.swish(); ball.mode = 'drop'; ball.vz = 40; ball.dropT = 0; scoreShot(f.q, f.shooter); }
      else { SFX.clang(); looseBall((Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 120), 190 + Math.random() * 120); if (f.q.grade === 'off' && Math.random() < 0.35) pop(ball.x, ball.y - 30, 'AIRBALL!', '#ff6b6b'); }
    } else {
      ball.x = f.x0 + (f.x1 - f.x0) * f.t;
      ball.y = f.y0 + (f.y1 - f.y0) * f.t - Math.sin(f.t * Math.PI) * f.apex;
    }
  }
  else if (ball.mode === 'drop') { ball.y += 260 * dt; ball.dropT += dt; if (ball.dropT > 0.62) { ball.mode = 'loose'; ball.owner = null; ball.vx = 0; ball.vz = 0; ball.z = 10; ball.y = FLOOR - 10; } }
  else if (ball.mode === 'loose') {
    ball.x += ball.vx * dt; ball.vx *= (1 - 2.4 * dt);
    ball.vz -= 900 * dt; ball.z += ball.vz * dt;
    if (ball.z <= 10) { ball.z = 10; ball.vz = Math.abs(ball.vz) > 90 ? -ball.vz * 0.55 : 0; if (Math.abs(ball.vz) > 90) SFX.bounce(); ball.y = FLOOR - 10; }
    else ball.y = FLOOR - 10 - ball.z;
    ball.x = Math.max(24, Math.min(W - 24, ball.x));
    let best = null, bd = 30;
    players.forEach(p => { const d = Math.abs(p.x - ball.x); if (d < bd && ball.z < 60) { bd = d; best = p; } });
    if (best) { giveBall(best); SFX.pop(); ev('pickup', { by: best.r.name }); }
  }
  else if (ball.mode === 'pass') {
    const f = ball.passF; f.t += dt / f.dur;
    if (f.t >= 1) { giveBall(f.to); }
    else { ball.x = f.x0 + (f.x1 - f.x0) * f.t; ball.y = f.y0 + (f.y1 - f.y0) * f.t - Math.sin(f.t * Math.PI) * 40; }
  }
}
function doPass(p) {
  const mates = players.filter(q => q.team === p.team && q !== p);
  mates.sort((a, b) => Math.abs(a.x - atkRim(p).x) - Math.abs(b.x - atkRim(p).x));
  const to = mates[0]; if (!to) return;
  p.has = false; ball.mode = 'pass';
  ball.passF = { x0: p.x, y0: FLOOR - 80 - p.z, x1: to.x, y1: FLOOR - 80, t: 0, dur: Math.max(0.18, Math.abs(to.x - p.x) / 900), to };
  SFX.pop(); ev('pass', { from: p.r.name, to: to.r.name });
}

// ---------- AI ----------
function aiControl(p, dt, now) {
  p.aiT -= dt;
  const rim = atkRim(p), myDef = defRim(p);
  const carrier = players.find(q => q.has);
  let tx = p.x;
  if (ball.mode === 'loose') { tx = ball.x; if (Math.abs(p.x - ball.x) < 26 && ball.z < 60) { /* pickup in updateBall */ } }
  else if (p.has) {
    tx = rim.x + (rim === RIM.R ? -52 : 52);
    const d = Math.abs(p.x - rim.x);
    if (p.aiT <= 0) {
      p.aiT = 0.25;
      if (d < 300 && now > (p.think.shootAt || 0) && Math.random() < 0.75) { releaseShot(p, 0.8 + (Math.random() * 0.24 - 0.12)); return; }
      if (now > (p.think.passAt || 0) && Math.random() < 0.5) { doPass(p); p.think.passAt = now + 1.6 + Math.random() * 2.4; return; }
    }
    if (Math.abs(p.x - tx) < 8 && d >= 300) tx = p.x + (rim === RIM.R ? -60 : 60);
  }
  else if (carrier && carrier.team === p.team) { // off-ball offense: space toward rim side
    const slot = [0.30, 0.52, 0.74][players.filter(q => q.team === p.team).indexOf(p)] || 0.5;
    tx = (p.team === 0 ? 480 + slot * 380 : 480 - slot * 380);
  }
  else if (carrier && carrier.team !== p.team) { // defense: nearest guards carrier, others shade their rim
    const mates = players.filter(q => q.team === p.team);
    const sorted = mates.slice().sort((a, b) => Math.abs(a.x - carrier.x) - Math.abs(b.x - carrier.x));
    if (sorted[0] === p) { tx = carrier.x - carrier.face * 34; if (Math.abs(p.x - carrier.x) < 46 && p.z === 0 && Math.random() < dt * 0.55) { p.vz = 430; } }
    else tx = myDef.x + (p.team === 0 ? 120 : -120) + (mates.indexOf(p) - 1) * 70;
  }
  const dx = tx - p.x, sp = speed(p) * (p.has ? 0.92 : 1);
  p.vx = Math.abs(dx) < 4 ? 0 : Math.sign(dx) * Math.min(sp, Math.abs(dx) * 6);
  if (p.vx) p.face = Math.sign(p.vx);
}
function humanControl(p, dt) {
  let mx = 0;
  if (keys.ArrowLeft || keys.KeyA) mx -= 1;
  if (keys.ArrowRight || keys.KeyD) mx += 1;
  if (ti) { if (ti.x < -0.3) mx = -1; else if (ti.x > 0.3) mx = 1; }
  if (AUTO) { aiControl(p, dt, performance.now() / 1000); return; }
  p.vx = mx * speed(p); if (mx) p.face = mx;
  const jump = keys.ArrowUp || keys.KeyW || (ti && ti.y < -0.55);
  if (jump && p.z === 0) p.vz = 470;
  const shootHeld = keys.Space || (ti && ti.a);
  const shootPressed = shootHeld && !prevA; prevA = shootHeld;
  if (p.has) {
    if (shootPressed) charge = { t: 0 };
    if (charge) {
      charge.t += dt / 0.62;
      if (!shootHeld) { releaseShot(p, Math.min(charge.t, 1)); charge = null; }
      else if (charge.t >= 1.15) { releaseShot(p, 1); charge = null; }
    }
    if ((keys.KeyP || (ti && ti.bPressed)) && !charge) { doPass(p); }
  } else {
    if ((keys.KeyP || (ti && ti.bPressed)) && p.lunge <= 0) { // steal lunge
      const c = players.find(q => q.has && q.team !== p.team);
      if (c && Math.abs(c.x - p.x) < 52 && Math.random() < 0.38 + p.r.def * 0.003) { giveBall(p); pop(p.x, FLOOR - 180, 'STEAL!', '#7CFC9A', true); SFX.pop(); ev('steal', { by: p.r.name }); }
      else { p.lunge = 0.5; p.stun = 0.35; }
    }
  }
}

// ---------- update ----------
function update(dt) {
  const now = performance.now() / 1000;
  ti = TC ? TC.getInput() : null;
  if (phase !== 'play') return;
  if (!golden) { clock -= dt; if (clock <= 0) { clock = 0; if (score[0] !== score[1]) { endGame(); } else { golden = true; banner = { text: 'GOLDEN BASKET!', t: 2, color: '#ffc400' }; } } }
  players.forEach(p => {
    if (p.lunge > 0) p.lunge -= dt;
    if (p.stun > 0) { p.stun -= dt; p.vx = 0; }
    else if (p.you) humanControl(p, dt); else { p.ai = true; aiControl(p, dt, now); }
    p.x += p.vx * dt;
    p.x = Math.max(36, Math.min(W - 36, p.x));
    if (p.vz !== 0 || p.z > 0) { p.z += p.vz * dt; p.vz -= 1500 * dt; if (p.z <= 0) { p.z = 0; p.vz = 0; } }
  });
  if (ball.mode !== 'dead') updateBall(dt);
  pops = pops.filter(o => (o.t -= dt) > 0);
  if (banner && banner.t < 900) banner.t -= dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 9);
  window.__dbg = { phase, score: score.slice(), clock: Math.ceil(clock), ball: ball.mode, players: players.map(p => ({ n: p.r.name, x: p.x | 0, has: p.has })) };
}

// ---------- draw ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function drawPlayer(p) {
  const img = IMG[p.r.id], hgt = 118, wid = img && img.naturalHeight ? hgt * img.naturalWidth / img.naturalHeight : 90;
  const x = p.x - wid / 2, y = FLOOR - hgt - p.z;
  ctx.fillStyle = 'rgba(0,0,0,.30)'; ctx.beginPath(); ctx.ellipse(p.x, FLOOR + 6, wid * 0.42, 9, 0, 0, 7); ctx.fill();
  if (p.fire) { ctx.save(); ctx.globalAlpha = 0.75 + Math.sin(performance.now() / 90) * 0.2; ctx.fillStyle = '#ff7a2f'; ctx.beginPath(); ctx.ellipse(p.x, y + 26, wid * 0.44, 30, 0, 0, 7); ctx.fill(); ctx.restore(); }
  if (img && img.complete && img.naturalWidth) { ctx.save(); if (p.face < 0) { ctx.translate(p.x, 0); ctx.scale(-1, 1); ctx.drawImage(img, -wid / 2, y, wid, hgt); } else ctx.drawImage(img, x, y, wid, hgt); ctx.restore(); }
  else { ctx.fillStyle = p.team ? '#e14' : '#28c'; rr(x, y, wid, hgt, 18); ctx.fill(); }
  if (p.you) { ctx.fillStyle = '#ffc400'; ctx.beginPath(); ctx.moveTo(p.x - 9, y - 20 + Math.sin(performance.now() / 200) * 3); ctx.lineTo(p.x + 9, y - 20 + Math.sin(performance.now() / 200) * 3); ctx.lineTo(p.x, y - 8 + Math.sin(performance.now() / 200) * 3); ctx.fill(); }
  ctx.font = '900 11px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillStyle = p.team ? '#ffb3ab' : '#bfe0ff'; ctx.fillText(p.r.name, p.x, FLOOR + 24);
}
function drawBall() {
  if (ball.mode === 'dead') return;
  ctx.fillStyle = '#f07818'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 11, 0, 7); ctx.fill();
  ctx.strokeStyle = '#7a3405'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ball.x, ball.y, 11, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ball.x - 11, ball.y); ctx.lineTo(ball.x + 11, ball.y); ctx.stroke();
}
function drawHUD() {
  rr(W / 2 - 168, 12, 336, 52, 12); ctx.fillStyle = 'rgba(10,16,34,.82)'; ctx.fill();
  ctx.font = '900 26px Trebuchet MS'; ctx.textAlign = 'center';
  ctx.fillStyle = '#7db9ff'; ctx.fillText('YOU ' + score[0], W / 2 - 92, 48);
  ctx.fillStyle = '#ff9d94'; ctx.fillText(score[1] + ' CPU', W / 2 + 92, 48);
  ctx.fillStyle = golden ? '#ffc400' : '#fff'; ctx.font = '900 24px Trebuchet MS';
  ctx.fillText(golden ? 'GOLDEN' : (Math.floor(clock / 60) + ':' + String(Math.floor(clock % 60)).padStart(2, '0')), W / 2, 48);
  const me = players[0];
  if (charge && me) {
    const m = Math.min(charge.t, 1), bx = me.x - 46, by = FLOOR - 216 - me.z;
    rr(bx, by, 92, 13, 6); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill();
    const gx = 0.80, gw = 0.055 + me.r.sht * 0.0009;
    ctx.fillStyle = '#39d353'; ctx.fillRect(bx + (gx - gw) * 92, by, gw * 2 * 92, 13);
    ctx.fillStyle = '#ffc400'; ctx.fillRect(bx, by, m * 92, 13);
  }
  ctx.textAlign = 'center';
  pops.forEach(o => { ctx.globalAlpha = Math.min(1, o.t * 1.6); ctx.font = '900 ' + (o.big ? 30 : 19) + 'px Trebuchet MS'; ctx.fillStyle = o.color; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 4; const yy = o.y - (1.1 - o.t) * 44; ctx.strokeText(o.text, o.x, yy); ctx.fillText(o.text, o.x, yy); ctx.globalAlpha = 1; });
  if (banner && banner.t > 0) { ctx.font = '900 52px Trebuchet MS'; ctx.fillStyle = banner.color; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 8; ctx.strokeText(banner.text, W / 2, 130); ctx.fillText(banner.text, W / 2, 130); }
  if (phase === 'over') { ctx.font = '700 19px Trebuchet MS'; ctx.fillStyle = '#fff'; ctx.fillText('Tap or press Enter to play again', W / 2, 176); }
}
function drawPick() {
  ctx.fillStyle = '#10182e'; ctx.fillRect(0, 0, W, H);
  ctx.font = '900 44px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffc400'; ctx.fillText('STICKER JAM', W / 2, 74);
  ctx.font = '700 19px Trebuchet MS'; ctx.fillStyle = '#cfe2ff'; ctx.fillText('Pick your baller — 3v3, 3 minutes, most buckets wins', W / 2, 104);
  ROSTER.forEach((r, i) => {
    const col = i % 5, row = (i / 5) | 0, cx = 108 + col * 186, cy = 150 + row * 218, w = 158, h = 196;
    rr(cx - w / 2, cy, w, h, 16); ctx.fillStyle = i === pickIdx ? 'rgba(255,196,0,.24)' : 'rgba(255,255,255,.07)'; ctx.fill();
    ctx.lineWidth = i === pickIdx ? 4 : 2; ctx.strokeStyle = i === pickIdx ? '#ffc400' : 'rgba(255,255,255,.25)'; ctx.stroke();
    const img = IMG[r.id];
    if (img && img.complete && img.naturalWidth) { const ih = 118, iw = ih * img.naturalWidth / img.naturalHeight; ctx.drawImage(img, cx - iw / 2, cy + 8, iw, ih); }
    ctx.font = '900 16px Trebuchet MS'; ctx.fillStyle = '#fff'; ctx.fillText(r.name, cx, cy + 148);
    ctx.font = '700 12px Trebuchet MS'; ctx.fillStyle = '#9fb8dd'; ctx.fillText('SPD ' + r.spd + '  SHT ' + r.sht + '  DEF ' + r.def, cx, cy + 170);
  });
  ctx.font = '700 16px Trebuchet MS'; ctx.fillStyle = '#8fa8cc'; ctx.fillText('Arrows + Enter, or tap a player', W / 2, 616);
}
function draw() {
  ctx.save();
  if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  if (phase === 'pick') { drawPick(); ctx.restore(); return; }
  const cimg = IMG.court;
  if (cimg && cimg.complete && cimg.naturalWidth) ctx.drawImage(cimg, 0, 0, W, H); else { ctx.fillStyle = '#28418c'; ctx.fillRect(0, 0, W, H); }
  players.slice().sort((a, b) => a.x - b.x).forEach(drawPlayer);
  drawBall(); drawHUD();
  ctx.restore();
}
function loop(ts) {
  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
  update(dt); draw();
  requestAnimationFrame(loop);
}
// pick-screen input
addEventListener('keydown', e => {
  if (phase === 'pick') {
    if (e.code === 'ArrowRight') pickIdx = Math.min(9, pickIdx + 1);
    if (e.code === 'ArrowLeft') pickIdx = Math.max(0, pickIdx - 1);
    if (e.code === 'ArrowDown') pickIdx = Math.min(9, pickIdx + 5);
    if (e.code === 'ArrowUp') pickIdx = Math.max(0, pickIdx - 5);
    if (e.code === 'Enter' || e.code === 'Space') { audio(); startGame(pickIdx); }
  } else if (phase === 'over' && (e.code === 'Enter' || e.code === 'Space')) { phase = 'pick'; }
});
cv.addEventListener('pointerdown', e => {
  audio();
  const rect = cv.getBoundingClientRect(), sx = (e.clientX - rect.left) * W / rect.width, sy = (e.clientY - rect.top) * H / rect.height;
  if (phase === 'pick') {
    ROSTER.forEach((r, i) => { const col = i % 5, row = (i / 5) | 0, cx = 108 + col * 186, cy = 150 + row * 218; if (Math.abs(sx - cx) < 82 && sy > cy && sy < cy + 200) { pickIdx = i; startGame(i); } });
  } else if (phase === 'over') phase = 'pick';
});
if (AUTO) { const iv = setInterval(() => { if (IMG.court && IMG.court.complete) { startGame(3); clearInterval(iv); } }, 120); }
window.__dbg = { phase };
requestAnimationFrame(loop);
