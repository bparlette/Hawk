// RETRO PICKLEBALL SMASH — 8-bit NES-style pickleball
// Vanilla canvas 2D, WebAudio chiptune, zero external deps.
// P1 "SPIKE" (bottom/near) vs P2 "ACE" (top/far, AI or P2).
// ?auto=1 → both sides bot-controlled (for recording).

'use strict';
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = 480, H = 270;
const AUTO = new URLSearchParams(location.search).get('auto') === '1';

// ── Court geometry (court units 0..100 x, 0..100 y) ──
// P1 side: y in [50,100] (near/bottom). P2 side: y in [0,50] (far/top). Net at y=50.
// Kitchen (non-volley zone): y in [42,50] and [50,58].
const NET_Y = 50;
const KITCHEN_D = 8; // kitchen depth in court units
// Pseudo-perspective: screen mapping
function courtToScreen(cx, cy, cz) {
  // cz = height above court (0 = ground)
  const t = cy / 100; // 0 far → 1 near
  // perspective: far side compressed
  const sx = 240 + (cx - 50) * (2.2 + 2.0 * t);
  const sy = 40 + t * 190 - (cz || 0) * (1.1 + 0.9 * t);
  const s = 0.55 + 0.75 * t; // scale
  return { x: sx, y: sy, s };
}

/* ═══════════════ AUDIO — chiptune ═══════════════ */
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function beep(freq, dur, type, vol, slideTo) {
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square'; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.12, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(); o.stop(ac.currentTime + dur);
}
const sfx = {
  hit()   { beep(520, 0.07, 'square', 0.14, 180); },
  smash() { beep(300, 0.18, 'sawtooth', 0.18, 60); beep(900, 0.08, 'square', 0.1, 200); },
  serve() { beep(200, 0.3, 'square', 0.12, 800); },
  bounce(){ beep(340, 0.05, 'square', 0.08, 220); },
  whistle(){ beep(2200, 0.25, 'square', 0.12); setTimeout(()=>beep(2200,0.35,'square',0.12), 120); },
  point() { [523,659,784].forEach((f,i)=>setTimeout(()=>beep(f,0.12,'square',0.12), i*90)); },
  fault() { [400,300,200].forEach((f,i)=>setTimeout(()=>beep(f,0.15,'sawtooth',0.12), i*110)); },
  ui()    { beep(660, 0.06, 'square', 0.1); },
};
// Looping NES music: square bass + triangle-ish lead
let musicTimer = null;
function startMusic() {
  if (musicTimer || !audio()) return;
  const bass = [110,110,130.8,110, 146.8,110,130.8,98]; // A A C A D A C G
  const lead = [440,523,659,523, 587,659,784,659];
  let step = 0;
  const stepDur = 0.21;
  musicTimer = setInterval(() => {
    if (!AC || AC.state !== 'running') return;
    const b = bass[step % bass.length], l = lead[step % lead.length];
    beep(b, stepDur*0.9, 'square', 0.045);
    if (step % 2 === 0) beep(l, stepDur*0.8, 'square', 0.03);
    // hat
    beep(6000, 0.03, 'square', 0.015);
    step++;
  }, stepDur * 1000);
}

/* ═══════════════ 8-BIT CHARACTER RENDERING ═══════════════ */
// Procedural chunky sprites in the sheet's style. Drawn at low-res then scaled.
// Palette
const PAL = {
  K:'#101018', // black outline
  skin:'#f0b088', skinD:'#d89068',
  spikeHair:'#e07818', spikeHairD:'#b05810',
  aceHair:'#282838',
  red:'#e02020', redD:'#a01010', white:'#f8f8f8',
  blue:'#2040e0', blueD:'#1020a0',
  green:'#20a020', greenD:'#107010',
  yellow:'#f0e020', yellowD:'#b0a010',
  paddleR:'#c01818', paddleG:'#a0c020',
};
// Draw a filled rect in "pixel" units (we work at 2x and scale)
function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

// Character draw: p = player object {x,y,z,pose,poseT,facing,kit}
// Poses: idle, swing0, swing1, serve0, serve1, serve2, dink, jump0, jump1, hit
function drawPlayer(p) {
  const s = courtToScreen(p.x, p.y, p.z);
  const u = 2 * s.s; // pixel unit
  const fx = p.facing; // 1 = facing right-ish, -1 = left
  const kit = p.kit; // 'spike' or 'ace'
  const pose = p.pose;

  ctx.save();
  ctx.translate(Math.round(s.x), Math.round(s.y));

  const K = PAL.K;
  const skin = PAL.skin, skinD = PAL.skinD;
  const shirt = kit === 'spike' ? PAL.red : PAL.green;
  const shirtD = kit === 'spike' ? PAL.redD : PAL.greenD;
  const shorts = kit === 'spike' ? PAL.blue : PAL.white;
  const shortsD = kit === 'spike' ? PAL.blueD : '#c8c8c8';
  const shoeC = kit === 'spike' ? PAL.red : PAL.green;
  const paddleC = kit === 'spike' ? PAL.paddleR : PAL.paddleG;

  // pose params
  let crouch = 0, jumpK = 0, armUp = 0, swingA = 0, lean = 0;
  if (pose === 'dink') crouch = 4;
  if (pose === 'jump0' || pose === 'jump1') { armUp = 1; }
  if (pose === 'swing0') swingA = -0.6;
  if (pose === 'swing1') swingA = 0.8;
  if (pose === 'serve0') { swingA = -1.0; }
  if (pose === 'serve1') { swingA = -0.3; armUp = 0.5; }
  if (pose === 'serve2') { swingA = 0.9; }

  const bob = (pose === 'idle') ? Math.sin(p.animT * 6) * 0.8 : 0;
  const baseY = -crouch + bob;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  const shW = 16 * u;
  ctx.fillRect(-shW/2, -1*u, shW, 2*u);

  // LEGS (back to front)
  const legH = (10 - crouch*0.8) * u;
  // back leg
  px(-5*u, baseY - legH, 4*u, legH, K);
  px(-4.5*u, baseY - legH + u, 3*u, legH - u, skinD);
  // shoe back
  px(-6*u, baseY - 2.5*u, 5*u, 2.5*u, K);
  px(-5.5*u, baseY - 2*u, 4*u, 1.5*u, shoeC);
  // front leg
  px(1*u, baseY - legH, 4*u, legH, K);
  px(1.5*u, baseY - legH + u, 3*u, legH - u, skin);
  px(0*u, baseY - 2.5*u, 5*u, 2.5*u, K);
  px(0.5*u, baseY - 2*u, 4*u, 1.5*u, shoeC);

  // SHORTS
  const hipY = baseY - legH;
  px(-6*u, hipY - 5*u, 12*u, 5*u, K);
  px(-5*u, hipY - 4*u, 10*u, 4*u, shorts);

  // TORSO
  const torsoH = 10 * u, torsoY = hipY - 5*u - torsoH;
  px(-6*u, torsoY, 12*u, torsoH, K);
  px(-5*u, torsoY + u, 10*u, torsoH - u, shirt);
  // shirt detail: spike white stripe / ace collar
  if (kit === 'spike') {
    px(-5*u, torsoY + 4*u, 10*u, 2*u, PAL.white);
  } else {
    px(-5*u, torsoY + u, 10*u, 1.5*u, shirtD);
  }
  // torso shading
  px(2*u, torsoY + u, 3*u, torsoH - u, shirtD);

  // HEAD
  const headY = torsoY - 7*u;
  const headW = 9*u, headH = 7*u, headX = -4.5*u + lean;
  px(headX - u, headY - u, headW + 2*u, headH + 2*u, K);
  px(headX, headY, headW, headH, skin);
  // eyes (angry)
  px(headX + (fx>0?5:1)*u, headY + 2.5*u, 1.5*u, 1.5*u, K);
  px(headX + (fx>0?5:1)*u, headY + 2*u, 2.5*u, 0.8*u, K);
  // hair / headband
  if (kit === 'spike') {
    // spiky orange hair
    px(headX - u, headY - 3*u, headW + 2*u, 3*u, K);
    for (let i = 0; i < 5; i++) {
      const sxp = headX - u + i * 2.2*u;
      px(sxp, headY - (4 + (i%2)*1.5)*u, 1.8*u, 3*u, PAL.spikeHair);
    }
    px(headX - u, headY - u, headW + 2*u, 1.5*u, PAL.spikeHairD);
  } else {
    // blue headband + dark hair
    px(headX - u, headY - 2*u, headW + 2*u, 2.5*u, PAL.blue);
    px(headX - u, headY - 2*u, headW + 2*u, 0.8*u, PAL.blueD);
    px(headX - u, headY - 3.5*u, headW + 2*u, 2*u, K);
    px(headX, headY - 3*u, headW, 1.5*u, PAL.aceHair);
    // headband tails
    px(headX - 3*u, headY - u, 2*u, 3*u, PAL.blue);
  }

  // ARMS + PADDLE
  const shY = torsoY + 2*u;
  // back arm (non-paddle)
  const bArmA = pose === 'swing1' ? 0.5 : -0.2;
  const bAx = -5*u, bAy = shY + 2*u;
  const bHx = bAx - 2*u + bArmA*3*u, bHy = bAy + 4*u;
  px(Math.min(bAx,bHx)-u, Math.min(bAy,bHy)-u, Math.abs(bHx-bAx)+2*u, Math.abs(bHy-bAy)+2*u, K);
  px(Math.min(bAx,bHx)-0.5*u, Math.min(bAy,bHy)-0.5*u, Math.abs(bHx-bAx)+u, Math.abs(bHy-bAy)+u, skinD);
  // wristband
  px(bHx-1.5*u, bHy-1*u, 3*u, 2*u, PAL.blue);

  // paddle arm
  const pAx = 5*u * fx, pAy = shY + 2*u;
  let pHx, pHy; // hand pos
  if (armUp) { pHx = pAx + 2*u*fx; pHy = pAy - 9*u; }
  else if (swingA !== 0) { pHx = pAx + (4 + swingA*6)*u*fx; pHy = pAy + (2 - Math.abs(swingA)*3)*u; }
  else { pHx = pAx + 4*u*fx; pHy = pAy + 3*u; }
  px(Math.min(pAx,pHx)-u, Math.min(pAy,pHy)-u, Math.abs(pHx-pAx)+2*u, Math.abs(pHy-pAy)+2*u, K);
  px(Math.min(pAx,pHx)-0.5*u, Math.min(pAy,pHy)-0.5*u, Math.abs(pHx-pAx)+u, Math.abs(pHy-pAy)+u, skin);
  px(pHx-1.5*u, pHy-1*u, 3*u, 2*u, PAL.blue); // wristband
  // hand
  px(pHx-1.5*u, pHy-1.5*u, 3*u, 3*u, K);
  px(pHx-u, pHy-u, 2*u, 2*u, skin);
  // PADDLE
  const padW = 5*u, padH = 7*u;
  const padX = pHx + 1*u*fx - padW/2, padY = pHy - padH/2 + (armUp ? -3*u : 0);
  const padTilt = swingA * 0.4;
  ctx.save();
  ctx.translate(padX + padW/2, padY + padH/2);
  ctx.rotate(padTilt * fx);
  px(-padW/2, -padH/2, padW, padH, K);
  px(-padW/2+u, -padH/2+u, padW-2*u, padH-2*u, paddleC);
  if (kit === 'ace') { // yellow-green paddle stripes
    px(-padW/2+u, -1*u, padW-2*u, 2*u, PAL.yellow);
  }
  ctx.restore();
  // paddle handle
  px(pHx - 0.75*u, pHy + 1*u, 1.5*u, 3*u, '#803810');

  ctx.restore();
}

// Ball draw (yellow perforated)
function drawBall(b) {
  const s = courtToScreen(b.x, b.y, b.z);
  const r = Math.max(2, 3.2 * s.s);
  // shadow
  const g = courtToScreen(b.x, b.y, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(g.x, g.y, r*1.1, r*0.45, 0, 0, 7); ctx.fill();
  // ball
  ctx.fillStyle = PAL.K;
  ctx.beginPath(); ctx.arc(s.x, s.y, r+1, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.yellow;
  ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 7); ctx.fill();
  // holes
  ctx.fillStyle = PAL.yellowD;
  ctx.fillRect(s.x - r*0.5, s.y - r*0.2, 1.5, 1.5);
  ctx.fillRect(s.x + r*0.1, s.y + r*0.3, 1.5, 1.5);
  ctx.fillRect(s.x - r*0.1, s.y - r*0.6, 1.5, 1.5);
  // motion streak
  if (Math.abs(b.vx) + Math.abs(b.vy) > 60) {
    ctx.strokeStyle = 'rgba(240,224,32,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s.x - b.vx*0.08*s.s, s.y - b.vy*0.05*s.s);
    ctx.lineTo(s.x, s.y); ctx.stroke();
  }
}

// Starburst impact effect
const bursts = [];
function addBurst(x, y, big) {
  const s = courtToScreen(x, y, 8);
  bursts.push({ x: s.x, y: s.y, t: 0, big: !!big });
}
function drawBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.t += dt;
    if (b.t > 0.25) { bursts.splice(i, 1); continue; }
    const r = (b.big ? 14 : 9) * (b.t / 0.25);
    const a = 1 - b.t / 0.25;
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = '#ffff40'; ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const an = k * Math.PI / 4 + b.t * 6;
      ctx.beginPath();
      ctx.moveTo(b.x + Math.cos(an)*r*0.4, b.y + Math.sin(an)*r*0.4);
      ctx.lineTo(b.x + Math.cos(an)*r, b.y + Math.sin(an)*r);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.x, b.y, 3*(1-b.t/0.25)+1, 0, 7); ctx.fill();
    ctx.restore();
  }
}

/* ═══════════════ COURT ═══════════════ */
function drawCourt() {
  // sky / arena background
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#181830'); grd.addColorStop(0.35, '#202048'); grd.addColorStop(1, '#101020');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

  // crowd: rows of pixel heads
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 40; i++) {
      const cx = i * 12 + (r * 7) % 12, cy = 8 + r * 10;
      const cols = ['#e08080', '#80c080', '#8080e0', '#e0e080', '#c080e0'];
      ctx.fillStyle = cols[(i * 7 + r * 3) % cols.length];
      ctx.fillRect(cx, cy, 5, 5);
      ctx.fillStyle = '#f0b088';
      ctx.fillRect(cx + 1, cy + 1, 3, 3);
    }
  }
  // crowd bounce
  const bt = Math.sin(performance.now() / 300) * 1.5;

  // arena wall
  ctx.fillStyle = '#2a2a4a'; ctx.fillRect(0, 34 + bt, W, 8);
  ctx.fillStyle = '#3a3a5a'; ctx.fillRect(0, 34 + bt, W, 2);

  // court surface: trapezoid (far narrow, near wide)
  const c = (cx, cy) => courtToScreen(cx, cy, 0);
  const p00 = c(8, 2), p10 = c(92, 2), p01 = c(2, 98), p11 = c(98, 98);
  ctx.fillStyle = '#2a7a3a';
  ctx.beginPath();
  ctx.moveTo(p00.x, p00.y); ctx.lineTo(p10.x, p10.y);
  ctx.lineTo(p11.x, p11.y); ctx.lineTo(p01.x, p01.y); ctx.closePath(); ctx.fill();
  // court inner (blue playing area)
  const q00 = c(12, 6), q10 = c(88, 6), q01 = c(6, 94), q11 = c(94, 94);
  ctx.fillStyle = '#2a4a9a';
  ctx.beginPath();
  ctx.moveTo(q00.x, q00.y); ctx.lineTo(q10.x, q10.y);
  ctx.lineTo(q11.x, q11.y); ctx.lineTo(q01.x, q01.y); ctx.closePath(); ctx.fill();

  // kitchen zones (non-volley), hatched orange-ish
  function kitchen(y0, y1) {
    const a = c(12, y0), b = c(88, y0), d = c(88, y1), e = c(12, y1);
    ctx.fillStyle = 'rgba(220,120,30,0.55)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(d.x, d.y); ctx.lineTo(e.x, e.y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f0a030'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(d.x, d.y); ctx.lineTo(e.x, e.y);
    ctx.closePath(); ctx.stroke();
  }
  kitchen(50 - KITCHEN_D, 50); // P2 kitchen (far)
  kitchen(50, 50 + KITCHEN_D); // P1 kitchen (near)

  // court lines
  ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 2;
  // baselines & sidelines
  ctx.beginPath();
  ctx.moveTo(q00.x, q00.y); ctx.lineTo(q10.x, q10.y);
  ctx.lineTo(q11.x, q11.y); ctx.lineTo(q01.x, q01.y); ctx.closePath(); ctx.stroke();
  // center line
  const m0 = c(50, 6), m1 = c(50, 94);
  ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.stroke();
  // service boxes are split by center line already; kitchen lines drawn above

  // "KITCHEN" labels
  ctx.fillStyle = '#f0a030'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
  const k1 = c(50, 50 - KITCHEN_D / 2), k2 = c(50, 50 + KITCHEN_D / 2);
  ctx.fillText('KITCHEN', k1.x, k1.y + 2);
  ctx.fillText('KITCHEN', k2.x, k2.y + 2);

  // NET across middle (7 court units high ≈ 11px at center)
  const n0 = c(6, 50), n1 = c(94, 50);
  const netTop = 11;
  // posts
  ctx.fillStyle = '#888';
  ctx.fillRect(n0.x - 2, n0.y - netTop, 4, netTop);
  ctx.fillRect(n1.x - 2, n1.y - netTop, 4, netTop);
  // net mesh
  ctx.fillStyle = 'rgba(20,20,30,0.85)';
  ctx.fillRect(n0.x, n0.y - netTop, n1.x - n0.x, netTop);
  ctx.strokeStyle = 'rgba(200,200,220,0.35)'; ctx.lineWidth = 1;
  for (let x = n0.x; x < n1.x; x += 6) {
    ctx.beginPath(); ctx.moveTo(x, n0.y - netTop); ctx.lineTo(x, n0.y); ctx.stroke();
  }
  for (let y = 0; y < netTop; y += 5) {
    ctx.beginPath(); ctx.moveTo(n0.x, n0.y - netTop + y); ctx.lineTo(n1.x, n0.y - netTop + y); ctx.stroke();
  }
  // net tape
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(n0.x, n0.y - netTop, n1.x - n0.x, 3);
}

/* ═══════════════ GAME STATE ═══════════════ */
const G = {
  phase: 'title', // title | serve | rally | point | over
  phaseT: 0,
  p1Score: 0, p2Score: 0,
  server: 1, // 1 = P1 serves, 2 = P2 serves
  serveNum: 1,
  bounces: { serve: 0, ret: 0 }, // two-bounce tracking
  lastHitter: 0,
  announce: '', announceT: 0, announceSub: '',
  rallyHits: 0,
  winner: 0,
};

function mkPlayer(kit, side) {
  return {
    kit, side, // side: 1 = near (P1), -1 = far (P2)
    x: 50, y: side === 1 ? 78 : 22, z: 0, vz: 0,
    vx: 0, vy: 0,
    facing: side === 1 ? -1 : 1, // face the net
    pose: 'idle', poseT: 0, animT: Math.random() * 10,
    swingCD: 0, jumpCD: 0, dashCD: 0, dashT: 0, dashDX: 0, dashDY: 0,
    isBot: false, aiT: 0, aiTX: 50, aiSwingT: 0,
    lastTap: { dir: '', t: 0 },
    inKitchen: false,
  };
}
const P1 = mkPlayer('spike', 1);
const P2 = mkPlayer('ace', -1);
P2.isBot = true;
if (AUTO) P1.isBot = true;

const ball = { x: 50, y: 78, z: 20, vx: 0, vy: 0, vz: 0, live: false, bounced: 0, lastBounceSide: 0 };

function resetPositions() {
  P1.x = 50; P1.y = 78; P1.z = 0; P1.vx = P1.vy = 0; P1.pose = 'idle';
  P2.x = 50; P2.y = 22; P2.z = 0; P2.vx = P2.vy = 0; P2.pose = 'idle';
  ball.live = false; ball.bounced = 0;
  G.bounces = { serve: 0, ret: 0 };
  G.lastHitter = 0; G.rallyHits = 0;
}

function startServe() {
  resetPositions();
  G.phase = 'serve'; G.phaseT = 0;
  const s = G.server === 1 ? P1 : P2;
  ball.x = s.x; ball.y = s.y - (s.side === 1 ? 6 : -6); ball.z = 12;
  ball.vx = ball.vy = ball.vz = 0; ball.live = false;
  G.announce = G.server === 1 ? 'P1 SERVE' : 'P2 SERVE';
  G.announceSub = 'Z = swing to serve';
  G.announceT = 2.2;
}

function announceMain(t, sub, dur) {
  G.announce = t; G.announceSub = sub || ''; G.announceT = dur || 2;
}

// ── Ball hit ──
// type: 'serve' | 'drive' | 'dink' | 'slam'
function hitBall(p, type) {
  const targetSide = p.side === 1 ? -1 : 1; // hit toward opponent
  // aim: toward opposite court, with some placement based on player x
  const tx = 50 + (p.x - 50) * 0.3 + (Math.random() * 30 - 15);
  const ty = targetSide === 1 ? 78 + Math.random() * 10 : 22 - Math.random() * 10;
  // clamp to court
  const cx = Math.max(14, Math.min(86, tx));
  const cy = targetSide === 1 ? Math.max(56, Math.min(92, ty)) : Math.max(8, Math.min(44, ty));

  let power, arc;
  if (type === 'serve') {
    // serve: high arc, must land diagonally opposite
    const diagX = p.x < 50 ? 68 : 32; // diagonal target
    const diagY = targetSide === 1 ? 75 : 25;
    const dist = Math.hypot(diagX - ball.x, diagY - ball.y);
    power = dist * 2.2; arc = 46;
    ball.vx = (diagX - ball.x) / dist * power;
    ball.vy = (diagY - ball.y) / dist * power;
    ball.vz = arc;
    sfx.serve();
  } else if (type === 'dink') {
    // soft drop just over net
    const ny = targetSide === 1 ? 50 + KITCHEN_D + 3 : 50 - KITCHEN_D - 3;
    const nx = Math.max(20, Math.min(80, p.x + (Math.random() * 20 - 10)));
    const dist = Math.max(1, Math.hypot(nx - ball.x, ny - ball.y));
    power = dist * 1.6; arc = 16;
    ball.vx = (nx - ball.x) / dist * power;
    ball.vy = (ny - ball.y) / dist * power;
    ball.vz = arc;
    sfx.hit();
  } else if (type === 'slam') {
    // downward spike, fast and steep
    const dist = Math.max(1, Math.hypot(cx - ball.x, cy - ball.y));
    power = dist * 3.4; arc = 8;
    ball.vx = (cx - ball.x) / dist * power;
    ball.vy = (cy - ball.y) / dist * power;
    ball.vz = arc;
    sfx.smash();
  } else {
    // drive
    const dist = Math.max(1, Math.hypot(cx - ball.x, cy - ball.y));
    power = dist * 2.4; arc = 30;
    ball.vx = (cx - ball.x) / dist * power;
    ball.vy = (cy - ball.y) / dist * power;
    ball.vz = arc;
    sfx.hit();
  }
  ball.live = true;
  G.lastHitter = p.side;
  G.rallyHits++;
  addBurst(ball.x, ball.y, type === 'slam');
  p.pose = type === 'slam' ? 'jump1' : (type === 'dink' ? 'dink' : 'swing1');
  p.poseT = 0;
  if (G.phase === 'serve') { G.phase = 'rally'; G.phaseT = 0; }
}

// ── Faults & scoring ──
function fault(msg, winnerSide) {
  sfx.whistle();
  setTimeout(() => sfx.fault(), 300);
  scorePoint(winnerSide, msg);
}
function scorePoint(winnerSide, faultMsg) {
  sfx.point();
  // only serving side scores
  if (winnerSide === G.server) {
    if (winnerSide === 1) G.p1Score++; else G.p2Score++;
    announceMain(faultMsg || (winnerSide === 1 ? 'P1 SCORES!' : 'P2 SCORES!'), scoreStr(), 2.2);
  } else {
    // side out: serve passes, no point
    G.server = winnerSide;
    announceMain(faultMsg || 'SIDE OUT', (winnerSide === 1 ? 'P1' : 'P2') + ' serves', 2.2);
  }
  G.phase = 'point'; G.phaseT = 0; G.winner = winnerSide;
  checkGameOver();
}
function scoreStr() { return G.p1Score + ' - ' + G.p2Score; }
function checkGameOver() {
  const win = (a, b) => a >= 11 && a - b >= 2;
  if (win(G.p1Score, G.p2Score) || win(G.p2Score, G.p1Score)) {
    setTimeout(() => {
      G.phase = 'over'; G.phaseT = 0;
      G.winner = G.p1Score > G.p2Score ? 1 : 2;
      sfx.point(); setTimeout(() => sfx.point(), 200); setTimeout(() => sfx.point(), 400);
    }, 2300);
  }
}
function inKitchen(p) {
  if (p.side === 1) return p.y > NET_Y - KITCHEN_D && p.y < NET_Y;
  return p.y > NET_Y && p.y < NET_Y + KITCHEN_D;
}

/* ═══════════════ INPUT ═══════════════ */
const keys = {};
addEventListener('keydown', e => {
  audio(); // unlock
  const k = e.key.toLowerCase();
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  if (keys[k]) return;
  keys[k] = true;
  handleTap(k);
  if (G.phase === 'title' && (k === 'z' || k === 'j' || k === 'enter' || k === ' ')) {
    sfx.ui(); startMusic(); startServe();
  } else if (G.phase === 'over' && (k === 'z' || k === 'j' || k === 'enter' || k === ' ')) {
    G.p1Score = G.p2Score = 0; G.server = 1; sfx.ui(); startServe();
  }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function handleTap(k) {
  const p = P1;
  if (p.isBot || G.phase === 'title' || G.phase === 'over') return;
  const dirMap = { arrowleft: 'L', a: 'L', arrowright: 'R', d: 'R', arrowup: 'U', w: 'U', arrowdown: 'D', s: 'D' };
  const dir = dirMap[k];
  if (dir) {
    const now = performance.now() / 1000;
    if (p.lastTap.dir === dir && now - p.lastTap.t < 0.28 && p.dashCD <= 0) {
      // DASH: double-tap
      p.dashT = 0.16; p.dashCD = 0.7;
      p.dashDX = dir === 'L' ? -1 : dir === 'R' ? 1 : 0;
      p.dashDY = dir === 'U' ? -1 : dir === 'D' ? 1 : 0;
      beep(300, 0.1, 'square', 0.08, 900);
    }
    p.lastTap = { dir, t: now };
  }
  if (k === 'z' || k === 'j') doSwing(p, keys['arrowdown'] || keys['s']);
  if (k === 'x' || k === 'k') doJump(p);
}

function doSwing(p, wantDink) {
  if (p.swingCD > 0 || G.phase === 'title' || G.phase === 'over') return;
  if (G.phase === 'point') return;
  p.swingCD = 0.45;
  p.poseT = 0;
  const jumping = p.z > 4;
  const dink = !!wantDink && !jumping;

  // can we reach the ball?
  const reach = 13;
  const d = Math.hypot(ball.x - p.x, ball.y - p.y);
  const ballNear = d < reach && ball.z < 34;
  const serving = G.phase === 'serve' && !ball.live &&
    ((G.server === 1 && p.side === 1) || (G.server === 2 && p.side === -1));

  if (serving) {
    p.pose = 'serve0';
    setTimeout(() => { if (p.pose === 'serve0') p.pose = 'serve1'; }, 160);
    setTimeout(() => {
      if (G.phase !== 'serve' || ball.live) return;
      p.pose = 'serve2'; p.poseT = 0;
      hitBall(p, 'serve');
    }, 320);
    return;
  }
  if (!ball.live || G.phase !== 'rally') { p.pose = 'swing0'; return; }

  // Kitchen rule: no volley (hit ball out of air) from kitchen
  const volley = ball.z > 6 && ball.bounced % 2 === 0; // hasn't bounced on this side yet... simplified
  const twoBounceOK = G.bounces.serve >= 1 && G.bounces.ret >= 1;
  if (ballNear) {
    if (inKitchen(p) && ball.z > 5) {
      fault('KITCHEN FAULT!', -p.side);
      return;
    }
    if (!twoBounceOK && ball.z > 5) {
      fault('TWO-BOUNCE FAULT!', -p.side);
      return;
    }
    if (jumping) { hitBall(p, 'slam'); }
    else if (dink) { p.pose = 'dink'; hitBall(p, 'dink'); }
    else {
      // forehand or backhand by relative position
      const toBall = (ball.x - p.x) * p.facing;
      p.pose = toBall >= 0 ? 'swing1' : 'swing0';
      hitBall(p, 'drive');
    }
  } else {
    p.pose = 'swing0'; // whiff
    beep(500, 0.06, 'square', 0.05, 900); // whoosh
  }
}

function doJump(p) {
  if (p.jumpCD > 0 || p.z > 0.5) return;
  if (inKitchen(p)) { fault('KITCHEN FAULT!', -p.side); return; }
  p.vz = 95; p.jumpCD = 0.9;
  p.pose = 'jump0'; p.poseT = 0;
  beep(250, 0.12, 'square', 0.07, 600);
}

/* ═══════════════ AI ═══════════════ */
function aiControl(p, dt) {
  p.aiT -= dt;
  // target: intercept ball when it's coming to our side
  const myHalf = p.side === 1 ? ball.y > NET_Y : ball.y < NET_Y;
  const comingToMe = (p.side === 1 && ball.vy > 5) || (p.side === -1 && ball.vy < -5);
  let tx = 50, ty = p.side === 1 ? 78 : 22;

  if (ball.live && (myHalf || comingToMe)) {
    // predict landing
    let px = ball.x, py = ball.y, pvx = ball.vx, pvy = ball.vy, pvz = ball.vz, pz = ball.z;
    for (let i = 0; i < 120; i++) {
      pvz -= 320 * 0.016; pz += pvz * 0.016;
      px += pvx * 0.016; py += pvy * 0.016;
      if (pz <= 0) break;
      if (py < 0 || py > 100) break;
    }
    const onMySide = p.side === 1 ? py > NET_Y - 4 : py < NET_Y + 4;
    if (onMySide) { tx = px; ty = py + (p.side === 1 ? 5 : -5); }
  } else if (G.phase === 'serve' && !ball.live) {
    // serving bot: wait then serve
    if (p.aiT <= 0 && ((G.server === 1 && p.side === 1) || (G.server === 2 && p.side === -1))) {
      doSwing(p, false);
      p.aiT = 2;
    }
  }

  // stay out of kitchen unless dinking
  if (p.side === 1 && ty > NET_Y - KITCHEN_D - 2 && ty < NET_Y) ty = NET_Y - KITCHEN_D - 4;
  if (p.side === -1 && ty < NET_Y + KITCHEN_D + 2 && ty > NET_Y) ty = NET_Y + KITCHEN_D + 4;
  // clamp to own half
  if (p.side === 1) ty = Math.max(NET_Y + 2, Math.min(96, ty));
  else ty = Math.max(4, Math.min(NET_Y - 2, ty));
  tx = Math.max(10, Math.min(90, tx));

  const sp = 42;
  const dx = tx - p.x, dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 2) {
    p.vx = dx / dist * sp; p.vy = dy / dist * sp;
  } else { p.vx *= 0.8; p.vy *= 0.8; }

  // swing when ball close
  p.aiSwingT -= dt;
  const bd = Math.hypot(ball.x - p.x, ball.y - p.y);
  if (ball.live && G.phase === 'rally' && bd < 11 && ball.z < 32 && p.aiSwingT <= 0) {
    const r = Math.random();
    const wantDink = r < 0.18 && Math.abs(ball.y - NET_Y) < 22;
    // occasionally jump-slam when ball is high
    if (ball.z > 18 && r < 0.3 && p.z < 1 && p.jumpCD <= 0 && !inKitchen(p)) {
      doJump(p);
      setTimeout(() => { if (G.phase === 'rally') doSwing(p, false); }, 220);
    } else {
      doSwing(p, wantDink);
    }
    p.aiSwingT = 0.6;
  }
  // face ball
  p.facing = ball.x >= p.x ? 1 : -1;
}

/* ═══════════════ UPDATE ═══════════════ */
function update(dt) {
  G.phaseT += dt;
  if (G.announceT > 0) G.announceT -= dt;

  // point pause then next serve
  if (G.phase === 'point' && G.phaseT > 2.3 && G.phase !== 'over') {
    if (G.p1Score >= 11 || G.p2Score >= 11) { /* handled by checkGameOver */ }
    else startServe();
    return;
  }
  if (G.phase === 'title' || G.phase === 'over') {
    P1.animT += dt; P2.animT += dt;
    drawBursts(dt);
    return;
  }

  for (const p of [P1, P2]) {
    p.animT += dt;
    p.poseT += dt;
    if (p.swingCD > 0) p.swingCD -= dt;
    if (p.jumpCD > 0) p.jumpCD -= dt;
    if (p.dashCD > 0) p.dashCD -= dt;
    // pose decay
    if (p.poseT > 0.5 && (p.pose === 'swing0' || p.pose === 'swing1' || p.pose === 'serve2')) p.pose = 'idle';
    if (p.pose === 'jump1' && p.z < 1 && p.poseT > 0.4) p.pose = 'idle';

    if (p.isBot) {
      aiControl(p, dt);
    } else if (p === P1) {
      // human movement
      let mx = 0, my = 0;
      if (keys['arrowleft'] || keys['a']) mx -= 1;
      if (keys['arrowright'] || keys['d']) mx += 1;
      if (keys['arrowup'] || keys['w']) my -= 1;
      if (keys['arrowdown'] || keys['s']) my += 1;
      const sp = 55;
      if (p.dashT > 0) {
        p.dashT -= dt;
        p.vx = p.dashDX * 150; p.vy = p.dashDY * 150;
      } else {
        p.vx += (mx * sp - p.vx) * Math.min(1, dt * 10);
        p.vy += (my * sp - p.vy) * Math.min(1, dt * 10);
      }
      if (mx !== 0) p.facing = mx;
    }

    // integrate
    p.x += p.vx * dt; p.y += p.vy * dt;
    // clamp to own half
    if (p.side === 1) { p.x = Math.max(8, Math.min(92, p.x)); p.y = Math.max(NET_Y + 1, Math.min(97, p.y)); }
    else { p.x = Math.max(8, Math.min(92, p.x)); p.y = Math.max(3, Math.min(NET_Y - 1, p.y)); }
    // jump physics
    if (p.z > 0 || p.vz > 0) {
      p.vz -= 320 * dt; p.z += p.vz * dt;
      if (p.z <= 0) { p.z = 0; p.vz = 0; if (p.pose === 'jump0') p.pose = 'idle'; }
    }
    p.inKitchen = inKitchen(p);
    if (!p.isBot && p === P1 && Math.abs(p.vx) + Math.abs(p.vy) > 5 && ball.live) {
      p.facing = ball.x >= p.x ? 1 : -1;
    }
  }

  // ── ball physics ──
  if (ball.live) {
    ball.vz -= 300 * dt;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;

    // net collision (net is ~7 units high in court scale)
    const netTopZ = 7;
    if (Math.abs(ball.y - NET_Y) < 1.5 && ball.z < netTopZ && ball.z > 0) {
      // hit the net: kill forward momentum, drop
      ball.vy *= -0.15; ball.vx *= 0.3; ball.vz = Math.min(ball.vz, 0);
      addBurst(ball.x, NET_Y, false);
      beep(150, 0.1, 'square', 0.1, 80);
    }

    // ground bounce
    if (ball.z <= 0) {
      ball.z = 0;
      if (ball.vz < -40) {
        sfx.bounce();
        ball.vz = -ball.vz * 0.62;
        ball.vx *= 0.88; ball.vy *= 0.88;
        ball.bounced++;
        const side = ball.y > NET_Y ? 1 : -1;
        // two-bounce tracking
        if (G.rallyHits === 1) G.bounces.serve++;
        else if (G.rallyHits === 2) G.bounces.ret++;
        ball.lastBounceSide = side;
      } else {
        // ball dead: decide point
        ball.live = false;
        const side = ball.y > NET_Y ? 1 : -1; // which side it landed/died on
        const inCourt = ball.x > 10 && ball.x < 90 && ball.y > 4 && ball.y < 96;
        if (!inCourt) {
          // OUT: point to the other side of the hitter
          const winner = G.lastHitter === 1 ? 2 : 1;
          fault('OUT!', winner);
        } else {
          // landed in: point to the side that did NOT let it land
          // if ball died on P1's side, P2 wins the rally
          const winner = side === 1 ? 2 : 1;
          // serve must land in diagonally opposite box — simplified: must cross net
          if (G.rallyHits === 1) {
            const serverSide = G.server;
            const landedOpp = (serverSide === 1 && side === 2) || (serverSide === 2 && side === 1);
            if (!landedOpp) { fault('FAULT!', serverSide === 1 ? 2 : 1); return; }
          }
          scorePoint(winner);
        }
        return;
      }
    }
    // out of bounds walls (side lines): let it fly, OUT decided on death
    if (ball.z > 120) { ball.live = false; fault('OUT!', G.lastHitter === 1 ? 2 : 1); return; }
  } else if (G.phase === 'serve') {
    // ball held by server: bob
    const s = G.server === 1 ? P1 : P2;
    ball.x = s.x; ball.y = s.y + (s.side === 1 ? -7 : 7);
    ball.z = 12 + Math.sin(performance.now() / 300) * 2;
  }

  drawBursts(dt);
}

/* ═══════════════ HUD ═══════════════ */
function drawHUD() {
  // scoreboard bar
  ctx.fillStyle = '#0c0c1c'; ctx.fillRect(0, H - 30, W, 30);
  ctx.fillStyle = '#2a2a4a'; ctx.fillRect(0, H - 30, W, 2);
  ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = '#e02020';
  ctx.fillText('P1 SPIKE ' + G.p1Score, 12, H - 11);
  ctx.fillStyle = '#20a020';
  ctx.textAlign = 'right';
  ctx.fillText(G.p2Score + ' ACE P2', W - 12, H - 11);
  // server indicator
  ctx.textAlign = 'center'; ctx.fillStyle = '#f0e020'; ctx.font = '10px monospace';
  ctx.fillText(G.server === 1 ? '◀ SERVE P1' : 'SERVE P2 ▶', W / 2, H - 11);
  // rally hits
  ctx.fillStyle = '#666'; ctx.font = '9px monospace';
  if (G.phase === 'rally') ctx.fillText('RALLY ' + G.rallyHits, W / 2, H - 22);

  // announcements
  if (G.announceT > 0) {
    const a = Math.min(1, G.announceT * 2);
    ctx.save(); ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    // banner
    ctx.fillStyle = 'rgba(8,8,20,0.85)';
    const bw = 300;
    ctx.fillRect(W/2 - bw/2, 96, bw, 44);
    ctx.strokeStyle = '#f0e020'; ctx.lineWidth = 2;
    ctx.strokeRect(W/2 - bw/2, 96, bw, 44);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px monospace';
    ctx.fillText(G.announce, W/2, 118);
    if (G.announceSub) {
      ctx.fillStyle = '#f0e020'; ctx.font = '11px monospace';
      ctx.fillText(G.announceSub, W/2, 133);
    }
    ctx.restore();
  }

  // kitchen warning for P1
  if (P1.inKitchen && G.phase === 'rally' && !P1.isBot) {
    ctx.fillStyle = '#ff6020'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    if (Math.floor(performance.now() / 300) % 2 === 0)
      ctx.fillText('! KITCHEN — NO VOLLEY !', W/2, H - 36);
  }
}

function drawTitle() {
  ctx.fillStyle = 'rgba(5,5,15,0.88)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0e020'; ctx.font = 'bold 30px monospace';
  ctx.fillText('RETRO', W/2, 70);
  ctx.fillStyle = '#e02020'; ctx.font = 'bold 34px monospace';
  ctx.fillText('PICKLEBALL', W/2, 104);
  ctx.fillStyle = '#20a020'; ctx.font = 'bold 34px monospace';
  ctx.fillText('SMASH', W/2, 138);
  ctx.fillStyle = '#8888aa'; ctx.font = '11px monospace';
  ctx.fillText('8-BIT ARCADE EDITION', W/2, 158);
  // bouncing ball demo
  const bt = performance.now() / 500;
  const bx = W/2 + Math.sin(bt) * 120, by = 190 + Math.abs(Math.sin(bt * 2)) * -30;
  ctx.fillStyle = '#101018'; ctx.beginPath(); ctx.arc(bx, by, 9, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.yellow; ctx.beginPath(); ctx.arc(bx, by, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#888'; ctx.font = '12px monospace'; ctx.fillStyle = '#ffffff';
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (blink) ctx.fillText(AUTO ? 'AUTO DEMO — sit back!' : 'PRESS Z TO START', W/2, 230);
  ctx.fillStyle = '#666'; ctx.font = '10px monospace';
  ctx.fillText('1P vs CPU  •  first to 11, win by 2', W/2, 250);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(5,5,15,0.85)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0e020'; ctx.font = 'bold 28px monospace';
  ctx.fillText(G.winner === 1 ? 'SPIKE WINS!' : 'ACE WINS!', W/2, 110);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px monospace';
  ctx.fillText(G.p1Score + '  -  ' + G.p2Score, W/2, 145);
  ctx.fillStyle = '#8888aa'; ctx.font = '12px monospace';
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (blink) ctx.fillText('PRESS Z TO REMATCH', W/2, 190);
}

/* ═══════════════ MAIN LOOP ═══════════════ */
let lastT = 0;
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  update(dt);
  drawCourt();
  // draw far player first (painter's order)
  drawPlayer(P2);
  drawPlayer(P1);
  if (ball.live || G.phase === 'serve') drawBall(ball);
  drawHUD();
  if (G.phase === 'title') drawTitle();
  if (G.phase === 'over') drawGameOver();
  requestAnimationFrame(loop);
}

// touch controls: left/right halves = move, tap = swing
let touchMove = null;
cv.addEventListener('touchstart', e => {
  audio();
  for (const t of e.changedTouches) {
    const r = cv.getBoundingClientRect();
    const x = (t.clientX - r.left) / r.width;
    if (x < 0.25) keys['arrowleft'] = true;
    else if (x < 0.5) keys['arrowright'] = true;
    else if (x < 0.75) { keys['arrowup'] = true; }
    else { handleTap('z'); }
  }
  e.preventDefault();
}, { passive: false });
cv.addEventListener('touchend', e => {
  keys['arrowleft'] = keys['arrowright'] = keys['arrowup'] = false;
  e.preventDefault();
}, { passive: false });

if (AUTO) {
  // auto demo: skip title, start immediately
  setTimeout(() => { startMusic(); startServe(); }, 800);
  // hide hint
  document.getElementById('hint').style.display = 'none';
}
requestAnimationFrame(loop);
