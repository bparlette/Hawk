// BIG DINKIN'! — carnival pickleball in Big Bumpin' FAIRGROUND style.
// Singles vs CPU, real pickleball rules: underhand diagonal serve, two-bounce
// rule, no volleys in the kitchen, rally scoring, first to 5.
// Sim is fixed-step (120 Hz substeps of a 60 Hz tick) and fully deterministic
// per rally seed-free physics; rendering is canvas 2D pseudo-3D.
import { TouchController, isTouchDevice } from './gptouch.js';

/* ============================== constants ============================== */
const COURT = { W: 20, L: 44, NET_Z: 2.83, KITCHEN: 7, BALL_R: 0.24 };
const GRAV = 32;                 // ft/s^2
const DRAG = 0.5;                // 1/s linear drag — a pickleball bleeds speed fast
const WIN_SCORE = 5;
const PAL = {                    // Big Bumpin' FAIRGROUND pack (styles.js)
  bg: '#170a26', wall: '#d81b74', wallDark: '#6e0d3c', trim: '#ffc93c',
  team: ['#ff3d5a', '#22c3e6'], teamDark: ['#8f1028', '#0b6a86'], teamLite: ['#ffb0bb', '#b5f0ff'],
  ball: '#ffc93c', ballDark: '#c47a0a', ink: '#3a1408', text: '#fff6dd', bulb: '#fff2a8',
  floorA: '#3a1f55', floorB: '#432460',
  court: '#1a7a4a', courtFar: '#146139', kitchen: '#e8762d', line: '#fff6dd',
};

/* ============================== audio ============================== */
let AC = null;
function audio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
      const b = AC.createBuffer(1, 1, AC.sampleRate), s = AC.createBufferSource();
      s.buffer = b; s.connect(AC.destination); s.start();
    } catch (e) { /* no audio */ }
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function blip(freq, dur, type = 'square', vol = 0.12, slide = 0) {
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
}
// A pickleball paddle pop: short noise burst through a bandpass + a low thump.
function popSound(hard) {
  const ac = audio(); if (!ac) return;
  const t = ac.currentTime;
  const nb = ac.createBuffer(1, ac.sampleRate * 0.06, ac.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource(); src.buffer = nb;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hard ? 1150 : 880; bp.Q.value = 1.1;
  const g = ac.createGain();
  g.gain.setValueAtTime(hard ? 0.5 : 0.36, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  src.connect(bp); bp.connect(g); g.connect(ac.destination); src.start(t);
  const o = ac.createOscillator(), og = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(hard ? 210 : 175, t);
  o.frequency.exponentialRampToValueAtTime(80, t + 0.06);
  og.gain.setValueAtTime(0.28, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o.connect(og); og.connect(ac.destination); o.start(t); o.stop(t + 0.08);
}
function cheer() {
  const ac = audio(); if (!ac) return;
  const t = ac.currentTime, dur = 0.55;
  const nb = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length);
  const src = ac.createBufferSource(); src.buffer = nb;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.6;
  const g = ac.createGain(); g.gain.value = 0.12;
  src.connect(bp); bp.connect(g); g.connect(ac.destination); src.start(t);
}
const sfx = {
  pop: popSound,
  bounce: () => blip(150, 0.05, 'triangle', 0.09, -40),
  net: () => blip(90, 0.16, 'sawtooth', 0.10, -30),
  point: () => { cheer(); blip(523, 0.1, 'square', 0.10); setTimeout(() => blip(784, 0.16, 'square', 0.10), 90); },
  fault: () => blip(140, 0.22, 'sawtooth', 0.11, -60),
  perfect: () => { blip(880, 0.08, 'square', 0.12); setTimeout(() => blip(1318, 0.14, 'square', 0.12), 70); },
};

/* ============================== music (calliope waltz) ============================== */
const MUS = { on: true, timer: null, step: 0 };
const MEL = [ // original carnival waltz loop, C major, 3/4 — [midi, beats]
  [72, 1], [76, 1], [79, 1], [81, 1], [79, 1], [76, 1], [77, 1], [81, 1], [84, 1], [81, 2], [77, 1],
  [76, 1], [79, 1], [83, 1], [79, 2], [76, 1], [74, 1], [77, 1], [81, 1], [79, 1], [76, 1], [74, 1],
  [72, 1], [76, 1], [79, 1], [81, 1], [79, 1], [76, 1], [77, 1], [76, 1], [74, 1], [72, 3],
];
const BASS = [48, 43, 41, 43, 48, 43, 41, 43, 48, 43, 41, 43]; // C G F G per bar
const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
function musNote(midi, t, dur, vol, type = 'triangle') {
  const ac = AC; if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain(), v = ac.createOscillator(), vg = ac.createGain();
  o.type = type; o.frequency.value = mf(midi);
  v.type = 'sine'; v.frequency.value = 5.4; vg.gain.value = mf(midi) * 0.006; // calliope wobble
  v.connect(vg); vg.connect(o.frequency);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.03);
  g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.05); v.start(t); v.stop(t + dur + 0.05);
}
function musTick() {
  if (!MUS.on || !AC || AC.state !== 'running') return;
  const beat = 0.34, t = AC.currentTime + 0.06;
  // schedule one bar (3 beats) at a time
  const bar = Math.floor(MUS.step / 3), beatInBar = MUS.step % 3;
  if (beatInBar === 0) musNote(BASS[bar % BASS.length], t, beat * 0.95, 0.16, 'sine');
  else musNote(BASS[bar % BASS.length] + 19, t, beat * 0.5, 0.05, 'sine'); // oom-pah-pah
  let idx = 0, acc = 0, target = MUS.step;
  for (const [m, b] of MEL) { if (acc === target) { musNote(m, t, beat * b * 0.92, 0.075); break; } acc += b; idx++; }
  MUS.step = (MUS.step + 1) % 36;
}
function musicStart() {
  if (MUS.timer) return;
  audio();
  MUS.timer = setInterval(musTick, 340);
}
function musicToggle() {
  MUS.on = !MUS.on;
  const b = document.getElementById('muteBtn');
  if (b) b.textContent = MUS.on ? '🔊' : '🔇';
}

/* ============================== state ============================== */
const S = {
  mode: 'menu',            // menu | play | over
  phase: 'pres',           // pres | flight
  server: 'you',
  stage: 'serve',          // serve | returnPending | returnFlight | rally
  score: { you: 0, cpu: 0 },
  mustBounce: false,       // serve/return two-bounce rule pending
  serveFlight: false,      // current flight is the serve
  bounces: 0,              // bounces since last hit
  lastHit: null,
  msgT: 0, pointT: 0, serveT: 0, shakeT: 0, time: 0,
  winner: null,
  flightId: 0, autoUsed: -1,   // auto-hit may fire once per flight
};
const ball = { x: 0, y: 23, z: 1.2, vx: 0, vy: 0, vz: 0, live: false, bounceT: 0 };
const you = { x: 4.6, y: 15, vx: 0, vy: 0, swingT: 0, runPh: 0, side: 'you' };
const cpu = { x: -4.6, y: -15, vx: 0, vy: 0, swingT: 0, runPh: 0, side: 'cpu', thinkT: 0, tx: 0, ty: -15 };
const popups = [], confetti = [];
const keys = {};
let touch = null;

/* ============================== physics helpers ============================== */
// One integrator for everything: the live ball, shot solving, and landing
// prediction all fly the same physics, so what a shot aims at is what happens.
function simFlight(x, y, z, vx, vy, vz, maxT = 4) {
  const dt = 1 / 120;
  let t = 0, zNet = null, prevY = y, prevZ = z;
  while (t < maxT) {
    vz -= GRAV * dt;
    const dr = 1 - DRAG * dt;
    vx *= dr; vy *= dr; vz *= dr;
    x += vx * dt; y += vy * dt; z += vz * dt; t += dt;
    if (zNet === null && prevY !== 0 && Math.sign(prevY) !== Math.sign(y)) {
      const f = Math.abs(prevY) / (Math.abs(prevY) + Math.abs(y));
      zNet = prevZ + (z - prevZ) * f;
    }
    prevY = y; prevZ = z;
    if (z <= 0) return { x, y, t, zNet };
  }
  return { x, y, t, zNet };
}
function computeShot(from, to, T, clearZ) {
  // Numeric solve under the real (draggy) physics: seed with the closed-form
  // ballistic answer, then iterate until the simulated flight lands on target
  // and clears the net by clearZ.
  let vx = (to.x - from.x) / T, vy = (to.y - from.y) / T, vz = (16 * T * T - from.z) / T;
  const crosses = Math.sign(from.y) !== Math.sign(to.y) && to.y !== from.y;
  for (let i = 0; i < 6; i++) {
    const r = simFlight(from.x, from.y, from.z, vx, vy, vz);
    const ex = to.x - r.x, ey = to.y - r.y;
    if (Math.abs(ex) < 0.15 && Math.abs(ey) < 0.15 && (!crosses || (r.zNet !== null && r.zNet >= clearZ))) {
      return { vx, vy, vz, T: r.t };
    }
    vx += ex / T * 0.92; vy += ey / T * 0.92;
    vz += (T - r.t) * 9;
    if (crosses && r.zNet !== null && r.zNet < clearZ) vz += (clearZ - r.zNet) * 1.5;
  }
  return { vx, vy, vz, T };
}
function predictLanding() {
  const r = simFlight(ball.x, ball.y, ball.z, ball.vx, ball.vy, ball.vz);
  return r.t < 4 ? { x: r.x, y: r.y } : null;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);

/* ============================== rules ============================== */
const $ = (id) => document.getElementById(id);
function setMsg(main, sub = '', hold = 1.1) {
  const m = $('centerMsg'), s = $('subMsg');
  m.textContent = main; s.textContent = sub;
  m.style.opacity = 1; s.style.opacity = sub ? 1 : 0;
  S.msgT = hold;
}
function popup(x, y, text, color = PAL.trim, big = false) {
  popups.push({ x, y, text, color, t: 0, big });
}
function updateScoreboard() {
  $('scoreYou').textContent = S.score.you;
  $('scoreCpu').textContent = S.score.cpu;
  for (const [id, n] of [['pipsYou', S.score.you], ['pipsCpu', S.score.cpu]]) {
    const el = $(id); el.innerHTML = '';
    for (let i = 0; i < WIN_SCORE; i++) {
      const d = document.createElement('div');
      d.className = 'pip' + (i < Math.min(n, WIN_SCORE) ? ' on' : '');
      el.appendChild(d);
    }
  }
}
function burst(x, y) {
  for (let i = 0; i < 42; i++) confetti.push({
    x, y, z: rnd(2, 6), vx: rnd(-7, 7), vy: rnd(-5, 5), vz: rnd(2, 9),
    rot: rnd(0, 6.3), vr: rnd(-9, 9), t: 0,
    color: [PAL.trim, '#ff6ab0', PAL.team[1], PAL.text, PAL.wall][i % 5],
  });
}
function point(winner, why, wx, wy) {
  S.lastWhy = `${why} | lastHit=${S.lastHit} ball=${ball.x.toFixed(1)},${ball.y.toFixed(1)} z=${ball.z.toFixed(1)} bounces=${S.bounces} stage=${S.stage}`;
  S.score[winner]++;
  S.server = winner;
  S.phase = 'pres'; S.pointT = 1.35; ball.live = false;
  updateScoreboard();
  burst(wx ?? 0, wy ?? 0);
  if (S.score[winner] >= WIN_SCORE && Math.abs(S.score.you - S.score.cpu) >= 2) {
    S.mode = 'over'; S.winner = winner;
    setMsg(winner === 'you' ? '🏆 YOU WIN!' : 'ZORP WINS', winner === 'you' ? 'Champion of the midway!' : 'Zorp keeps the carnival crown…', 3.2);
    sfx.point();
    $('playBtn').textContent = '↻ REMATCH';
    $('menu').style.display = 'flex';
    document.querySelector('#menu .tag').textContent = winner === 'you' ? 'You took the match!' : 'The CPU took that one.';
  } else {
    setMsg(winner === 'you' ? 'POINT!' : 'ZORP POINT', why, 1.15);
    if (winner === 'you') sfx.point(); else sfx.fault();
  }
  resetPositions();
}
function fault(loser, why) { point(loser === 'you' ? 'cpu' : 'you', why, ball.x, ball.y); }
function resetPositions() {
  const ss = S.server === 'you' ? S.score.you : S.score.cpu;
  const sx = ss % 2 === 0 ? 4.6 : -4.6;                 // even score: right court
  if (S.server === 'you') { you.x = sx; you.y = 23.4; cpu.x = -sx * 0.8; cpu.y = -16; }
  else { cpu.x = sx; cpu.y = -23.4; you.x = -sx * 0.8; you.y = 16; }
  const srv = S.server === 'you' ? you : cpu;
  ball.x = srv.x; ball.y = srv.y; ball.z = 1.2; ball.vx = ball.vy = ball.vz = 0;
  S.stage = 'serve'; S.serveFlight = true; S.bounces = 0; S.lastHit = null;
  S.serveT = S.server === 'cpu' ? rnd(0.9, 1.3) : 0;
  $('serveTag').textContent = S.server === 'you' ? 'YOUR SERVE — Z / X / C' : 'ZORP SERVE';
  $('serveTag').style.display = S.mode === 'play' ? 'block' : 'none';
}
function serveBoxFor(serverSide) {
  const srv = serverSide === 'you' ? you : cpu;
  const dir = serverSide === 'you' ? -1 : 1;            // toward the other side
  return {
    x: (srv.x > 0 ? -1 : 1) * 5,                        // diagonal box center
    y: dir * 14.5,
    xMin: srv.x > 0 ? -10 : 0, xMax: srv.x > 0 ? 0 : 10,
    yMin: dir > 0 ? COURT.KITCHEN : -COURT.L, yMax: dir > 0 ? COURT.L : -COURT.KITCHEN,
  };
}
function doServe(who, quality = 1) {
  const srv = who === 'you' ? you : cpu;
  const box = serveBoxFor(who);
  const jx = (1 - quality) * rnd(-4.5, 4.5), jy = (1 - quality) * rnd(-3, 3);
  const shot = computeShot(
    { x: srv.x, y: srv.y, z: 1.2 },
    { x: clamp(box.x + jx, -10.5, 10.5), y: clamp(box.y + jy, -22.5, 22.5) },
    1.02, COURT.NET_Z + 0.55);
  ball.vx = shot.vx; ball.vy = shot.vy; ball.vz = shot.vz;
  S.lastWhy = `serve ${who} from ${srv.x.toFixed(1)},${srv.y.toFixed(1)} v=${shot.vx.toFixed(1)},${shot.vy.toFixed(1)},${shot.vz.toFixed(1)}`;
  S.serveBox = serveBoxFor(who);
  ball.live = true; S.phase = 'flight'; S.lastHit = who; S.bounces = 0; S.flightId++;
  srv.swingT = 0.28; sfx.pop(false);
  $('serveTag').style.display = 'none';
}
function hitBall(who, kind) {
  if (S.phase === 'flight' && S.lastHit === who) return false;  // singles: hits alternate — never re-hit your own shot
  const me = who === 'you' ? you : cpu, foe = who === 'you' ? cpu : you;
  const dir = who === 'you' ? -1 : 1;
  // ---- legality ----
  const volley = S.bounces === 0;
  if (S.stage === 'serve' && who !== S.server && volley) {
    return fault(who, 'The serve must bounce first!');
  }
  if (S.stage === 'returnFlight' && who !== S.lastHit && volley) {
    return fault(who, 'The return must bounce first!');
  }
  if (volley && Math.abs(me.y) < COURT.KITCHEN && S.stage !== 'serve') {
    return fault(who, 'No volleys in the kitchen!');
  }
  if (S.stage === 'returnPending' && who !== S.server) S.stage = 'returnFlight';
  // ---- quality from contact (forgiving: the paddle stretches to meet it) ----
  const d = Math.max(0, Math.hypot(ball.x - me.x, ball.y - me.y) - 0.9);
  const q = who === 'cpu' ? me.aiQ : clamp(1.18 - Math.abs(d - 1.5) * 0.17 - Math.max(0, ball.z - 5) * 0.04, 0.45, 1);
  // ---- target by shot kind ----
  let tx, ty, T, clear = COURT.NET_Z + 0.3 + q * 0.5;
  const away = clamp(-foe.x * 0.72 + (who === 'you' ? input.x * 3.4 : rnd(-2, 2)), -9.2, 9.2);
  if (kind === 'drive') { tx = away; ty = dir * rnd(15, 20.5); T = rnd(0.52, 0.62); }
  else if (kind === 'dink') { tx = clamp(ball.x * 0.45 - foe.x * 0.25, -8.6, 8.6); ty = dir * rnd(1.8, 4.4); T = rnd(0.85, 1.0); clear = COURT.NET_Z + 0.55; }
  else { tx = away * 0.7; ty = dir * rnd(18, 21.5); T = rnd(1.35, 1.55); clear = COURT.NET_Z + 4.5; }
  const j = (1 - q) * 3.6;
  tx = clamp(tx + rnd(-j, j) * 0.8, -10.9, 10.9);
  ty = clamp(ty + rnd(-j, j) * 0.45 * dir, -22.9, 22.9);
  if (who === 'cpu') T *= kind === 'drive' ? 1.3 : 1.12;   // incoming pace eased: volleys need time
  const shot = computeShot({ x: ball.x, y: ball.y, z: ball.z }, { x: tx, y: ty }, T, clear);
  ball.vx = shot.vx; ball.vy = shot.vy; ball.vz = shot.vz;
  S.lastHit = who; S.bounces = 0; S.serveFlight = false; S.flightId++;
  me.swingT = 0.26;
  const ps = proj(ball.x, ball.y, ball.z);
  if (who === 'you' && q > 0.86) { popup(ps.x, ps.y - 46, 'PERFECT!', PAL.trim, true); sfx.perfect(); S.shakeT = 0.09; }
  else sfx.pop(kind === 'drive');
  return true;
}

/* ============================== ball adjudication ============================== */
function stepBall(dt) {
  if (!ball.live) return;
  const prevY = ball.y, prevZ = ball.z;
  ball.vz -= GRAV * dt;
  const drag = 1 - DRAG * dt;
  ball.vx *= drag; ball.vy *= drag; ball.vz *= drag;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
  ball.bounceT = Math.max(0, ball.bounceT - dt);
  // net crossing (interpolate z at the net plane)
  if (prevY !== 0 && Math.sign(prevY) !== Math.sign(ball.y)) {
    const f = Math.abs(prevY) / (Math.abs(prevY) + Math.abs(ball.y));
    const zNet = prevZ + (ball.z - prevZ) * f;
    if (zNet < COURT.NET_Z + 0.05) {
      // Net cord on a serve: real rules play it live if it lands in the box —
      // kill the pace and let the landing decide.
      if (S.serveFlight && zNet >= COURT.NET_Z - 0.45) {
        ball.vx *= 0.32; ball.vy *= 0.32; ball.vz = Math.min(ball.vz, 1.5);
        popup(W / 2, H * 0.42, 'NET CORD!', '#7df9ff');
        sfx.net();
      } else {
        sfx.net(); popup(W / 2, H * 0.42, 'INTO THE NET!', '#ff6ab0');
        return fault(S.lastHit, 'Into the net');
      }
    }
  }
  if (ball.z <= 0) {
    ball.z = 0;
    const side = ball.y > 0 ? 'you' : 'cpu';
    S.bounces++;
    ball.bounceT = 0.18; sfx.bounce();
    ball.vz = Math.abs(ball.vz) * 0.72;
    ball.vx *= 0.82; ball.vy *= 0.82;
    const inCourt = Math.abs(ball.x) <= COURT.W / 2 && Math.abs(ball.y) <= COURT.L;
    if (S.serveFlight) {
      const box = S.serveBox || serveBoxFor(S.server);
      const inBox = ball.x >= box.xMin && ball.x <= box.xMax && ball.y >= Math.min(box.yMin, box.yMax) && ball.y <= Math.max(box.yMin, box.yMax);
      if (side === S.server || !inBox) return fault(S.server, side === S.server ? 'Serve fell short' : 'Serve missed the box');
      S.serveFlight = false; S.stage = 'returnPending';  // receiver returns; the return must bounce too
      return;
    }
    if (side === S.lastHit) return fault(S.lastHit, 'Hit it into the ground');
    if (S.bounces >= 2) return point(S.lastHit, 'It bounced twice');
    if (!inCourt) return fault(S.lastHit, 'Out!');
    if (S.stage === 'returnFlight') S.stage = 'rally';   // two-bounce rule satisfied
  }
  if (S.bounces === 0 && (Math.abs(ball.y) > 34 || Math.abs(ball.x) > 26)) {
    // sailed away without ever bouncing: an out. (A ball that already bounced
    // in resolves at its second bounce instead.)
    return fault(S.lastHit, 'Out!');
  }
}

/* ============================== actors ============================== */
const input = { x: 0, y: 0, run: false };
function stepYou(dt) {
  const sp = input.run || Math.hypot(input.x, input.y) > 0.94 ? 16.5 : 11.5;
  you.vx = input.x * sp; you.vy = input.y * sp;
  you.x = clamp(you.x + you.vx * dt, -11.6, 11.6);
  you.y = clamp(you.y + you.vy * dt, 0.4, 24.2);
  you.runPh += Math.hypot(you.vx, you.vy) * dt * 1.6;
  you.swingT = Math.max(0, you.swingT - dt);
  if (S.phase === 'pres' && S.server === 'you') { you.y = clamp(you.y, 22.6, 24.2); ball.x = you.x; ball.y = you.y; }
  autoHitYou();
}
function ballReachable(me) {
  const sideOk = me.side === 'you' ? ball.y > -1.3 : ball.y < 1.3;
  return ball.live && sideOk && ball.z < 8.2 && Math.hypot(ball.x - me.x, ball.y - me.y) < 4.3;
}
function mustWaitForBounce(who) {
  return S.bounces === 0 && ((S.stage === 'serve' && S.server !== who) || (S.stage === 'returnFlight' && S.lastHit !== who));
}
// The paddle meets the ball on its own: if an incoming ball gets close and the
// player hasn't swung, it connects automatically with a sensible shot —
// unless hitting it would be a fault (kitchen volley / two-bounce pending).
function autoHitYou() {
  if (S.mode !== 'play' || S.phase !== 'flight' || !ball.live) return;
  if (S.lastHit !== 'cpu' || S.autoUsed === S.flightId) return;
  if (mustWaitForBounce('you')) return;
  if (S.bounces === 0 && Math.abs(you.y) < COURT.KITCHEN) return;   // kitchen volley: your call, not the paddle's
  const d = Math.hypot(ball.x - you.x, ball.y - you.y);
  if (d > 3.3 || ball.z > 6.8 || ball.y < 0.2) return;
  if (!(S.bounces >= 1 || ball.z < 4.6)) return;                    // volleys connect up to chest height
  S.autoUsed = S.flightId;
  const kind = ball.z < 1.7 || Math.abs(ball.y) < 9 ? 'dink' : (you.y > 19 && Math.random() < 0.3 ? 'lob' : 'drive');
  hitBall('you', kind);
}
function stepCpu(dt) {
  cpu.swingT = Math.max(0, cpu.swingT - dt);
  cpu.thinkT -= dt;
  let tx = cpu.tx, ty = cpu.ty;
  if (S.phase === 'pres') { tx = cpu.x; ty = cpu.y; }
  else if (ball.live && S.lastHit === 'you') {
    if (cpu.thinkT <= 0) {
      cpu.thinkT = 0.12;
      const land = predictLanding();
      if (land && land.y < 0 && Math.abs(land.x) <= 11 && land.y > -23.5) { cpu.tx = clamp(land.x, -10.6, 10.6); cpu.ty = clamp(land.y - 0.6, -23.6, -0.6); }
      else { cpu.tx = 0; cpu.ty = -14.5; }
    }
    tx = cpu.tx; ty = cpu.ty;
  } else { tx = clamp(ball.x * 0.35, -6, 6); ty = -14.5; if (ball.live && S.lastHit === 'cpu') { /* drift home */ } }
  const dx = tx - cpu.x, dy = ty - cpu.y, dist = Math.hypot(dx, dy);
  const sp = 12.6;
  if (dist > 0.05) {
    const v = Math.min(sp, dist / dt * 0.9);
    cpu.vx = dx / dist * v; cpu.vy = dy / dist * v;
    cpu.x += cpu.vx * dt; cpu.y += cpu.vy * dt;
    cpu.runPh += v * dt * 1.6;
  }
  cpu.y = clamp(cpu.y, -24.2, -0.4); cpu.x = clamp(cpu.x, -11.6, 11.6);
  if (S.phase === 'pres' && S.server === 'cpu') cpu.y = clamp(cpu.y, -24.2, -22.6);
  // hit decision
  if (ballReachable(cpu)) {
    const land = predictLanding();
    const landingShort = land && Math.abs(land.y) < 9.5;
    const stretched = clamp((dist - 1.2) / 5, 0, 1);
    cpu.aiQ = clamp(0.82 - stretched * 0.42 + rnd(-0.05, 0.05), 0.32, 0.88);
    if (mustWaitForBounce('cpu')) return;                 // respect two-bounce
    let kind = 'drive';
    const r = Math.random();
    if (landingShort) kind = r < 0.6 ? 'dink' : 'drive';
    else if (Math.abs(you.y) < 9.5 && r < 0.3) kind = 'lob';
    else kind = r < 0.48 ? 'drive' : (r < 0.78 ? 'dink' : 'lob');
    hitBall('cpu', kind);
  }
  if (S.phase === 'pres' && S.server === 'cpu') { ball.x = cpu.x; ball.y = cpu.y; }
}
function tryYouHit(kind) {
  if (S.mode !== 'play') return;
  if (S.phase === 'pres') { if (S.server === 'you') doServe('you', rnd(0.9, 1)); return; }
  if (ballReachable(you)) hitBall('you', kind);
  else you.swingT = 0.22; // whiff swing
}

/* ============================== main loop ============================== */
let W = 0, H = 0, DPR = 1;
const canvas = $('game'), ctx = canvas.getContext('2d');
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

let last = 0, acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!last) last = ts;
  let dt = Math.min(0.1, (ts - last) / 1000); last = ts;
  acc += dt;
  const step = 1 / 120;
  while (acc > step) { tick(step); acc -= step; }
  render();
}
function tick(dt) {
  S.time += dt;
  S.msgT -= dt; if (S.msgT <= 0) { $('centerMsg').style.opacity = 0; $('subMsg').style.opacity = 0; }
  S.shakeT = Math.max(0, S.shakeT - dt);
  if (S.mode !== 'play') { idleActors(dt); return; }
  if (S.phase === 'pres') {
    S.pointT -= dt;
    if (S.server === 'cpu' && S.pointT <= 0) { S.serveT -= dt; if (S.serveT <= 0) doServe('cpu', rnd(0.82, 0.97)); }
  }
  // read input at tick rate from current sources
  readInput();
  stepYou(dt);
  stepCpu(dt);
  if (ball.live) stepBall(dt);
  for (const p of popups) p.t += dt;
  for (let i = popups.length - 1; i >= 0; i--) if (popups[i].t > 1.05) popups.splice(i, 1);
  for (const c of confetti) { c.t += dt; c.vz -= GRAV * 0.55 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z = Math.max(0.1, c.z + c.vz * dt); c.rot += c.vr * dt; }
  for (let i = confetti.length - 1; i >= 0; i--) if (confetti[i].t > 1.6) confetti.splice(i, 1);
}
function idleActors(dt) {
  you.x = Math.sin(S.time * 0.6) * 3.2; you.y = 15;
  cpu.x = Math.cos(S.time * 0.5) * 3.2; cpu.y = -15;
  you.runPh += dt * 2; cpu.runPh += dt * 2;
  for (const c of confetti) { c.t += dt; c.vz -= GRAV * 0.55 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z = Math.max(0.1, c.z + c.vz * dt); c.rot += c.vr * dt; }
  for (let i = confetti.length - 1; i >= 0; i--) if (confetti[i].t > 1.6) confetti.splice(i, 1);
}
function readInput() {
  let x = 0, y = 0, run = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  if (keys['KeyA'] || keys['ArrowLeft']) x -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) x += 1;
  if (keys['KeyW'] || keys['ArrowUp']) y -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) y += 1;
  if (touch) {
    const ti = touch.getInput();
    if (Math.abs(ti.x) > 0.12 || Math.abs(ti.y) > 0.12) { x = ti.x; y = ti.y; }
    if (ti.drivePressed) tryYouHit('drive');
    if (ti.dinkPressed) tryYouHit('dink');
    if (ti.lobPressed) tryYouHit('lob');
  }
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  input.x = x; input.y = y; input.run = run;
}
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true; audio();
  if (e.repeat) return;
  if (e.code === 'KeyM') { audio(); musicStart(); musicToggle(); return; }
  if (S.mode === 'play') {
    if (e.code === 'KeyZ') tryYouHit('drive');
    if (e.code === 'KeyX') tryYouHit('dink');
    if (e.code === 'KeyC') tryYouHit('lob');
  } else if (e.code === 'Enter' || e.code === 'Space') startMatch();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
for (const ev of ['pointerdown', 'touchend', 'visibilitychange']) {
  document.addEventListener(ev, () => { if (ev !== 'visibilitychange' || !document.hidden) audio(); }, { passive: true });
}
if (isTouchDevice()) {
  touch = new TouchController({ buttons: [
    { id: 'lob', label: 'LOB' }, { id: 'dink', label: 'DINK' }, { id: 'drive', label: 'DRIVE' },
  ] });
}

function startMatch() {
  audio(); musicStart();
  S.mode = 'play'; S.score.you = 0; S.score.cpu = 0; S.server = 'you'; S.phase = 'pres'; S.pointT = 0.4;
  updateScoreboard();
  $('menu').style.display = 'none';
  resetPositions();
  setMsg('FIRST TO 5', 'Your serve — Z drive · X dink · C lob', 1.5);
}
$('playBtn').addEventListener('click', startMatch);
$('muteBtn').addEventListener('click', () => { audio(); musicStart(); musicToggle(); });

/* ====================== first-person projection ====================== */
// GoPro-on-the-head view: the camera rides high on YOUR head just behind your
// baseline, tilted down at the court — more top-down than a flat eye-level
// view, so you see your own side of the court below and the alien across the
// net. Your paddle floats at the bottom; your body is never drawn. A slight
// bob follows your stride, like a head-mounted camera. proj returns
// s = pixels per foot at that depth.
const CAM = { y: 31.5, z: 7.6 };
function camX() { return you.x * 0.45; }
function horizonY() {
  const spd = Math.hypot(you.vx, you.vy);
  const bob = spd > 0.5 ? Math.sin(you.runPh * 2.4) * H * 0.006 : Math.sin(S.time * 1.4) * H * 0.002;
  return H * 0.30 + bob;
}
function focal() { return H * 1.0; }
function proj(x, y, z = 0) {
  const F = focal();
  const d = Math.max(2.2, CAM.y - y);
  return {
    x: W / 2 + (x - camX()) * F / d,
    y: horizonY() + (CAM.z - z) * F / d,
    s: F / d,
    d,
  };
}

/* ============================== rendering ============================== */
function poly(pts, fill) {
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function line2(x1, y1, x2, y2, w, color) {
  const a = proj(x1, y1), b = proj(x2, y2);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
}
function renderBackdrop() {
  const hz = horizonY();
  const sky = ctx.createLinearGradient(0, 0, 0, hz * 1.05);
  sky.addColorStop(0, '#2a1150'); sky.addColorStop(0.7, '#3a1a5e'); sky.addColorStop(1, PAL.bg);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + H * 0.045);
  // ferris wheel silhouette
  const wx = W * 0.80, wy = H * 0.155, wr = H * 0.115;
  ctx.save(); ctx.strokeStyle = '#241038'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(wx, wy, wr, 0, 6.29); ctx.stroke();
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) {
    const a = S.time * 0.12 + i * Math.PI / 4;
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr); ctx.stroke();
    ctx.fillStyle = (i % 2 ? PAL.trim : '#ff6ab0');
    ctx.beginPath(); ctx.arc(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr, 3.4, 0, 6.29); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(wx - wr * 0.5, hz + 2); ctx.lineTo(wx, wy); ctx.lineTo(wx + wr * 0.5, hz + 2); ctx.stroke();
  ctx.restore();
  // midway tents silhouette
  ctx.fillStyle = '#1d0b33';
  for (const [tx, tw] of [[0.06, 0.16], [0.30, 0.11], [0.52, 0.13]]) {
    const bx = W * tx, bw = W * tw, by = hz + 2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw / 2, by - H * 0.075); ctx.lineTo(bx + bw, by); ctx.closePath(); ctx.fill();
    ctx.fillRect(bx + bw * 0.12, by - H * 0.028, bw * 0.76, H * 0.028);
  }
  ctx.fillRect(0, hz - H * 0.004, W, H * 0.032);
  // bulb strings (chase lights)
  for (let sIdx = 0; sIdx < 3; sIdx++) {
    const y0 = H * (0.045 + sIdx * 0.052), sag = H * 0.045, off = sIdx * 0.33;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, x = t * W, y = y0 + Math.sin(t * Math.PI) * sag;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = 'rgba(20,8,30,.8)'; ctx.lineWidth = 1.6; ctx.stroke();
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = t * W, y = y0 + Math.sin(t * Math.PI) * sag;
      const on = (Math.floor(S.time * 3) + i + sIdx) % 3 !== 0;
      ctx.fillStyle = on ? ['#ffc93c', '#ff6ab0', '#7df9ff'][i % 3] : 'rgba(120,90,40,.5)';
      ctx.beginPath(); ctx.arc(x, y + 4, on ? 3.4 : 2.4, 0, 6.29); ctx.fill();
      if (on) { ctx.fillStyle = 'rgba(255,220,130,.16)'; ctx.beginPath(); ctx.arc(x, y + 4, 8, 0, 6.29); ctx.fill(); }
    }
    void off;
  }
}
function renderCourt() {
  // apron (fairground floor) with candy-stripe border
  const A = [[-13.5, -25.5], [13.5, -25.5], [13.5, 25.5], [-13.5, 25.5]].map(([x, y]) => proj(x, y));
  poly(A, PAL.floorA);
  const A2 = [[-12.6, -24.4], [12.6, -24.4], [12.6, 24.4], [-12.6, 24.4]].map(([x, y]) => proj(x, y));
  poly(A2, PAL.floorB);
  // candy stripes along apron edge
  for (let i = 0; i < 26; i++) {
    const t0 = i / 26, t1 = (i + 0.5) / 26;
    const seg = (p, q) => {
      const a = { x: p.x + (q.x - p.x) * t0, y: p.y + (q.y - p.y) * t0 };
      const b = { x: p.x + (q.x - p.x) * t1, y: p.y + (q.y - p.y) * t1 };
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 5; ctx.strokeStyle = i % 2 ? PAL.wall : PAL.text; ctx.stroke();
    };
    seg(A[3], A[2]); seg(A[1], A[0]);
  }
  // court surface: far half, near half, kitchens
  poly([[-10, -22], [10, -22], [10, 0], [-10, 0]].map(([x, y]) => proj(x, y)), PAL.courtFar);
  poly([[-10, 0], [10, 0], [10, 22], [-10, 22]].map(([x, y]) => proj(x, y)), PAL.court);
  poly([[-10, -7], [10, -7], [10, 0], [-10, 0]].map(([x, y]) => proj(x, y)), PAL.kitchen);
  poly([[-10, 0], [10, 0], [10, 7], [-10, 7]].map(([x, y]) => proj(x, y)), PAL.kitchen);
  // lines
  const lw = Math.max(1.6, H / 340);
  line2(-10, -22, 10, -22, lw, PAL.line); line2(-10, 22, 10, 22, lw, PAL.line);
  line2(-10, -22, -10, 22, lw, PAL.line); line2(10, -22, 10, 22, lw, PAL.line);
  line2(-10, -7, 10, -7, lw, PAL.line); line2(-10, 7, 10, 7, lw, PAL.line);
  line2(0, -22, 0, -7, lw * 0.8, PAL.line); line2(0, 7, 0, 22, lw * 0.8, PAL.line);
  // net
  const nL = proj(-10.7, 0, COURT.NET_Z), nR = proj(10.7, 0, COURT.NET_Z);
  const nLb = proj(-10.7, 0), nRb = proj(10.7, 0);
  ctx.fillStyle = 'rgba(16,8,26,.30)';
  ctx.beginPath(); ctx.moveTo(nL.x, nL.y);
  ctx.quadraticCurveTo(W / 2, nL.y + 7, nR.x, nR.y);
  ctx.lineTo(nRb.x, nRb.y); ctx.lineTo(nLb.x, nLb.y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,246,221,.34)'; ctx.lineWidth = 1;
  for (let i = 1; i < 16; i++) {
    const t = i / 9, x = nL.x + (nR.x - nL.x) * t;
    ctx.beginPath(); ctx.moveTo(x, nL.y + Math.sin(t * Math.PI) * 5); ctx.lineTo(x, nLb.y); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(nL.x, nL.y); ctx.quadraticCurveTo(W / 2, nL.y + 7, nR.x, nR.y);
  ctx.lineWidth = 5; ctx.strokeStyle = PAL.text; ctx.stroke();
  for (const p of [nLb, nRb]) { ctx.fillStyle = PAL.ink; ctx.fillRect(p.x - 3, p.y - (nLb.y - nL.y) - 4, 6, (nLb.y - nL.y) + 6); }
}
function drawAlien(a) {
  // ZORP — the visiting alien champion, drawn to match the character art:
  // big green head, huge black eyes, gold-ball antennae, red carnival vest.
  const p = proj(a.x, a.y);
  const u = p.s;                                   // px per foot
  const hgt = 5.1 * u;
  const bob = Math.sin(a.runPh * 2.4) * (Math.hypot(a.vx, a.vy) > 0.5 ? 0.09 : 0.03) * u;
  const groundY = p.y, headCY = groundY - hgt * 0.68 + bob, headR = hgt * 0.30;
  const lean = clamp(a.vx * 0.012, -0.14, 0.14);
  ctx.save(); ctx.translate(p.x, 0); ctx.rotate(0); ctx.translate(0, 0);
  // shadow
  ctx.fillStyle = 'rgba(10,4,20,.38)';
  ctx.beginPath(); ctx.ellipse(0, groundY + 2, headR * 1.05, headR * 0.26, 0, 0, 6.29); ctx.fill();
  ctx.translate(0, bob); ctx.rotate(lean);
  // feet
  ctx.fillStyle = '#57a047';
  for (const s of [-1, 1]) {
    const fOff = Math.sin(a.runPh * 2.4 + (s > 0 ? 3.14 : 0)) * u * 0.16 * (Math.hypot(a.vx, a.vy) > 0.5 ? 1 : 0.2);
    ctx.beginPath(); ctx.ellipse(s * headR * 0.42, groundY - headR * 0.05 + fOff * 0.3 - bob, headR * 0.30, headR * 0.13, 0, 0, 6.29); ctx.fill();
  }
  // body: red carnival vest
  const bodyTop = headCY + headR * 0.72, bodyBot = groundY - headR * 0.18 - bob;
  const bg2 = ctx.createLinearGradient(0, bodyTop, 0, bodyBot);
  bg2.addColorStop(0, '#e3323f'); bg2.addColorStop(1, '#8f1028');
  ctx.beginPath();
  ctx.moveTo(-headR * 0.52, bodyTop); ctx.lineTo(headR * 0.52, bodyTop);
  ctx.lineTo(headR * 0.62, bodyBot); ctx.lineTo(-headR * 0.62, bodyBot); ctx.closePath();
  ctx.fillStyle = bg2; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = PAL.ink; ctx.stroke();
  ctx.strokeStyle = PAL.trim; ctx.lineWidth = Math.max(1.6, u * 0.05);
  ctx.beginPath(); ctx.moveTo(0, bodyTop + 2); ctx.lineTo(0, bodyBot - 2); ctx.stroke();
  ctx.fillStyle = PAL.trim;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(headR * 0.22, bodyTop + (bodyBot - bodyTop) * (0.25 + i * 0.25), Math.max(1.6, u * 0.055), 0, 6.29); ctx.fill(); }
  // free arm (left)
  ctx.strokeStyle = '#6fbf3f'; ctx.lineWidth = Math.max(2.4, u * 0.11); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-headR * 0.5, bodyTop + headR * 0.15); ctx.quadraticCurveTo(-headR * 0.85, bodyTop + headR * 0.5, -headR * 0.78, bodyTop + headR * 0.85); ctx.stroke();
  // head
  const hg = ctx.createRadialGradient(-headR * 0.3, headCY - headR * 0.35, headR * 0.2, 0, headCY, headR * 1.1);
  hg.addColorStop(0, '#c8f09a'); hg.addColorStop(0.55, '#9ede6e'); hg.addColorStop(1, '#63b437');
  ctx.beginPath(); ctx.ellipse(0, headCY, headR, headR * 0.92, 0, 0, 6.29); ctx.fillStyle = hg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(58,20,8,.5)'; ctx.stroke();
  // antennae (sway)
  ctx.strokeStyle = '#7cc24a'; ctx.lineWidth = Math.max(2, u * 0.07);
  for (const s of [-1, 1]) {
    const sway = Math.sin(S.time * 2.2 + s) * headR * 0.08;
    const tx = s * headR * 0.42 + sway, ty = headCY - headR * 1.28;
    ctx.beginPath(); ctx.moveTo(s * headR * 0.3, headCY - headR * 0.78);
    ctx.quadraticCurveTo(s * headR * 0.38, headCY - headR * 1.1, tx, ty); ctx.stroke();
    ctx.fillStyle = PAL.trim; ctx.beginPath(); ctx.arc(tx, ty, headR * 0.13, 0, 6.29); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(tx - headR * 0.04, ty - headR * 0.05, headR * 0.045, 0, 6.29); ctx.fill();
  }
  // huge black eyes, tracking the ball
  const look = clamp((ball.x - a.x) * 0.05, -0.16, 0.16) * headR;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * headR * 0.38 + look, headCY + headR * 0.02); ctx.rotate(s * -0.18);
    const eg = ctx.createRadialGradient(-headR * 0.06, -headR * 0.12, headR * 0.03, 0, 0, headR * 0.30);
    eg.addColorStop(0, '#3a3f4a'); eg.addColorStop(0.4, '#0a0a12'); eg.addColorStop(1, '#000');
    ctx.beginPath(); ctx.ellipse(0, 0, headR * 0.235, headR * 0.315, 0, 0, 6.29); ctx.fillStyle = eg; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.ellipse(-headR * 0.07, -headR * 0.13, headR * 0.055, headR * 0.085, -0.3, 0, 6.29); ctx.fill();
    ctx.restore();
  }
  // smile
  ctx.strokeStyle = 'rgba(30,60,20,.75)'; ctx.lineWidth = Math.max(1.6, u * 0.045);
  ctx.beginPath(); ctx.arc(look * 0.5, headCY + headR * 0.38, headR * 0.16, 0.25, Math.PI - 0.25); ctx.stroke();
  ctx.restore();
  // paddle arm + paddle (auto-side, auto-meet like the player's)
  const want = ball.x >= a.x ? 1 : -1;
  a.padSide = a.padSide === undefined ? -1 : a.padSide + (want - a.padSide) * 0.22;
  const side = a.padSide;
  const sw = a.swingT > 0 ? Math.sin((0.26 - a.swingT) / 0.26 * Math.PI) : 0;
  const shX = p.x + side * headR * 0.55, shY = bodyTop + headR * 0.2 + bob;
  let px = shX + side * headR * (0.55 + sw * 0.3), py = shY + headR * 0.35 - sw * headR * 0.45;
  const bd = Math.hypot(ball.x - a.x, ball.y - a.y);
  if (ball.live && bd < 5.2) {
    const bp = proj(ball.x, ball.y, ball.z), k = (1 - bd / 5.2) * 0.72;
    px += (bp.x - px) * k; py += (bp.y - py) * k;
  }
  ctx.strokeStyle = '#6fbf3f'; ctx.lineWidth = Math.max(2.4, u * 0.11); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(px, py); ctx.stroke();
  drawPaddleFace(px, py, headR * 0.62, side * (-0.4 + sw * 1.0));
}
function drawPaddleFace(cx, cy, r, rot) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, '#ffe98a'); g.addColorStop(0.55, PAL.trim); g.addColorStop(1, PAL.ballDark);
  ctx.beginPath(); ctx.ellipse(0, -r * 0.22, r * 0.78, r * 1.02, 0, 0, 6.29);
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(2, r * 0.07); ctx.strokeStyle = PAL.ink; ctx.stroke();
  ctx.fillStyle = 'rgba(58,20,8,.30)';
  for (const [hx, hy] of [[-0.32, -0.62], [0, -0.78], [0.32, -0.62], [-0.42, -0.28], [-0.14, -0.38], [0.14, -0.38], [0.42, -0.28], [-0.28, 0.02], [0, -0.08], [0.28, 0.02]]) {
    ctx.beginPath(); ctx.arc(hx * r, hy * r, r * 0.075, 0, 6.29); ctx.fill();
  }
  ctx.fillStyle = '#7a4a21'; ctx.fillRect(-r * 0.13, r * 0.72, r * 0.26, r * 0.5);
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = Math.max(1.4, r * 0.045); ctx.strokeRect(-r * 0.13, r * 0.72, r * 0.26, r * 0.5);
  ctx.restore();
}
function drawPaddleFP() {
  // Your paddle, Wii-style: it floats where your court position says, flips
  // forehand/backhand by ball side, stretches to meet a close ball, and
  // swings through on contact.
  const base = proj(you.x, you.y - 0.6, 2.5);
  const rNom = Math.min(H * 0.115, W * 0.17);
  let px = clamp(base.x, rNom * 0.9, W - rNom * 0.9);
  let py = clamp(base.y, H * 0.58, H * 0.94);
  const want = ball.x >= you.x ? 1 : -1;
  you.padSide = you.padSide === undefined ? 1 : you.padSide + (want - you.padSide) * 0.25;
  const bd = Math.hypot(ball.x - you.x, ball.y - you.y);
  if (ball.live && ball.y > 1 && bd < 6.5) {
    const bp = proj(ball.x, ball.y, ball.z), k = (1 - bd / 6.5) * 0.6;
    px += (bp.x - px) * k; py += (bp.y - py) * k;
  }
  const sw = you.swingT > 0 ? Math.sin((0.26 - you.swingT) / 0.26 * Math.PI) : 0;
  py -= sw * H * 0.05; px += you.padSide * sw * W * 0.02;
  const r = rNom * (1 + sw * 0.12);
  // mitt at the grip
  ctx.fillStyle = PAL.team[0];
  ctx.beginPath(); ctx.arc(px - you.padSide * r * 0.1, py + r * 1.28, r * 0.34, 0, 6.29); ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = PAL.ink; ctx.stroke();
  drawPaddleFace(px, py, r, you.padSide * (-0.16 + sw * 0.85));
}
const ballTrail = [];
function drawBall() {
  const g = proj(ball.x, ball.y, 0);
  ctx.fillStyle = `rgba(10,4,20,${clamp(0.42 - ball.z * 0.028, 0.1, 0.42)})`;
  ctx.beginPath(); ctx.ellipse(g.x, g.y + 2, Math.max(3, 0.30 * g.s), Math.max(1.2, 0.11 * g.s), 0, 0, 6.29); ctx.fill();
  const p = proj(ball.x, ball.y, ball.z);
  const r = clamp(0.34 * p.s, 2.6, H * 0.085) * (ball.bounceT > 0 ? 0.82 : 1);
  // motion trail
  if (ball.live) { ballTrail.push({ x: p.x, y: p.y, r }); if (ballTrail.length > 9) ballTrail.shift(); }
  else ballTrail.length = 0;
  ballTrail.forEach((tp, i) => {
    ctx.fillStyle = `rgba(255,201,60,${(i / ballTrail.length) * 0.20})`;
    ctx.beginPath(); ctx.arc(tp.x, tp.y, Math.min(tp.r, H * 0.04) * (0.4 + 0.6 * i / ballTrail.length), 0, 6.29); ctx.fill();
  });
  const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.2, p.x, p.y, r);
  grad.addColorStop(0, '#ffe98a'); grad.addColorStop(0.6, PAL.ball); grad.addColorStop(1, PAL.ballDark);
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.29); ctx.fillStyle = grad; ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(58,20,8,.55)'; ctx.stroke();
  ctx.fillStyle = 'rgba(58,20,8,.4)';
  for (let i = 0; i < 5; i++) {
    const a = S.time * 3 + i * 2.4;
    ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * r * 0.45, p.y + Math.sin(a * 1.3) * r * 0.4, r * 0.13, 0, 6.29); ctx.fill();
  }
}
function render() {
  ctx.save();
  if (S.shakeT > 0) ctx.translate(rnd(-2.4, 2.4), rnd(-2.4, 2.4));
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, PAL.bg); bg.addColorStop(1, '#241038');
  ctx.fillStyle = bg; ctx.fillRect(-6, -6, W + 12, H + 12);
  renderBackdrop();
  renderCourt();
  // depth order: cpu (far) -> ball shadow/ball handled inside drawBall -> you (near); ball drawn between by z vs actors approx: draw cpu, ball if ball.y<0 else after you
  drawAlien(cpu);
  drawBall();
  drawPaddleFP();
  // confetti
  for (const c of confetti) {
    const p = proj(c.x, c.y, c.z), cs = clamp(p.s / 30, 0.35, 2.6);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(c.rot);
    ctx.fillStyle = c.color; ctx.fillRect(-3.4 * cs, -2 * cs, 6.8 * cs, 4 * cs);
    ctx.restore();
  }
  // popups
  for (const p of popups) {
    const a = 1 - p.t / 1.05;
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = `900 ${p.big ? 40 : 26}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = PAL.ink;
    const y = p.y - p.t * 44;
    ctx.strokeText(p.text, p.x, y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, y);
    ctx.restore();
  }
  ctx.restore();
}

/* ============================== boot ============================== */
updateScoreboard();
resetPositions();
S.mode = 'menu';
$('serveTag').style.display = 'none';
if (new URLSearchParams(location.search).has('demo')) {
  S.mode = 'play'; $('menu').style.display = 'none'; S.server = 'cpu'; resetPositions();
  // demo: hand the player side to a simple AI so the game spectates itself
  setInterval(() => {
    if (S.mode !== 'play') return;
    const land = ball.live && S.lastHit === 'cpu' ? predictLanding() : null;
    if (land && land.y > 0) { input.x = clamp((land.x - you.x) * 0.9, -1, 1); input.y = clamp((land.y - 1 - you.y) * 0.9, -1, 1); }
    else { input.x = clamp((0 - you.x) * 0.5, -1, 1); input.y = clamp((15 - you.y) * 0.5, -1, 1); }
    if (S.phase === 'pres' && S.server === 'you') doServe('you', rnd(0.88, 0.98));
    else if (ballReachable(you)) {
      if (!mustWaitForBounce('you')) hitBall('you', ['drive', 'dink', 'lob'][Math.floor(Math.random() * 3)]);
    }
  }, 30);
}
window.__dbg = {
  get state() { return { mode: S.mode, phase: S.phase, stage: S.stage, server: S.server, score: { ...S.score }, ball: { ...ball }, you: { x: you.x, y: you.y }, cpu: { x: cpu.x, y: cpu.y }, lastWhy: S.lastWhy || '' }; },
  start: startMatch,
  setScore(y, c) { S.score.you = y; S.score.cpu = c; updateScoreboard(); },
};
requestAnimationFrame(frame);
