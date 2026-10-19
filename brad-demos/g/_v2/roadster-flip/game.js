// ROADSTER FLIP v2 — flip-timing on the gp2x juice engine
// McGregor, Oct 2026: hold FAN to charge the upside-down ramp climb,
// tap THRUST at the apex ring for the 180° kickflip over the Tesla lineup.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, R, TAU, rr, heartPath } from '../_vendor/gp2x.js';

const W = 540, H = 960, GROUND = 800;
const g = makeGame({
  id: 'roadster-flip-v2', title: 'ROADSTER FLIP',
  sub: 'v2 · HOLD TO CHARGE · TAP TO FLIP · 3 LIVES',
  hook: 'nail the flip · clear the lineup',
  w: W, h: H, bg: '#070a18', style: 'toon',
  bloom: .7, ca: .4, vig: 1, scan: .22,
});

/* ================= tuning ================= */
const CFG = {
  grav: 1450,
  climbTarget: r => 250 + r * 14,   // px/s along the track
  climbAccel: 950,
  chargeTime: 1.1,                   // hold seconds for full boost
  launchV: 640, launchAng: -72 * Math.PI / 180,
  boostMin: .72,                     // launch factor at zero charge
  perfectBase: .150, perfectRound: .009, perfectMin: .055, // seconds
  crashX: 465,                       // touchdown left of this = into the lineup
  lineupX: [338, 370, 402, 434, 458],
  lineupNames: ['SEMI', 'CYBERTRUCK', 'CYBERCAB', 'MODEL Y', 'MODEL 3'],
};
const isAuto = new URLSearchParams(location.search).has('auto');

/* ================= track: catmull-rom through control points ================= */
const CTRL = [
  [20, 800], [120, 794], [205, 770], [275, 725], [325, 660], [350, 575], [348, 490],
  [330, 415], [300, 360], [262, 330], [217, 310], [200, 280], [210, 240], [225, 190],
];
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [
    0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}
const TRACK = (() => {
  const pts = [];
  const ext = [CTRL[0], ...CTRL, CTRL[CTRL.length - 1]];
  for (let i = 1; i < ext.length - 2; i++)
    for (let j = 0; j < 16; j++) {
      const [x, y] = catmull(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], j / 16);
      pts.push({ x, y });
    }
  pts.push({ x: CTRL[CTRL.length - 1][0], y: CTRL[CTRL.length - 1][1] });
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    pts[i].s = s;
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)];
    pts[i].ang = Math.atan2(b.y - a.y, b.x - a.x);
  }
  return pts;
})();
const TRACK_LEN = TRACK[TRACK.length - 1].s;
function trackAt(s) {
  s = clamp(s, 0, TRACK_LEN);
  let lo = 0, hi = TRACK.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (TRACK[mid].s < s) lo = mid + 1; else hi = mid; }
  const i = Math.max(1, lo), a = TRACK[i - 1], b = TRACK[i];
  const t = (s - a.s) / Math.max(1e-6, b.s - a.s);
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), ang: lerp(a.ang, b.ang, t) };
}

/* ================= scenery (built once, seeded) ================= */
const stars = Array.from({ length: 80 }, () => ({ x: R() * W, y: R() * H * .62, r: rnd(.8, 2.2), ph: R() * 6, sp: rnd(.4, 1.6) }));

/* ================= state ================= */
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const easeIO = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
const perfectWin = () => Math.max(CFG.perfectMin, (CFG.perfectBase - S.round * CFG.perfectRound) * (0.7 + 0.6 * S.boost));

let S;
function resetWorld() {
  S = {
    phase: 'climb', phaseT: 0, s: 0, speed: 0, boost: 0, botHold: false,
    x: 0, y: 0, ang: 0, vx: 0, vy: 0, tAir: 0, suction: false,
    tapped: false, tumble: false, flipT0: 0, flipA: .3, flipB: .3, flipC: .5,
    quality: null, wobAmp: 0, apexT: 0, apexX: 0, apexY: 0, tLand: 1,
    round: 0, lives: 3, chain: 0, fever: 0,
  };
  g.score = 0; g.combo.reset(); g.fx.clear(); g.hud.hint = '';
  g.state = { score: 0, lives: 3, round: 1, phase: 'climb' };
  // park the car at the ramp start so the title screen shows it
  const tr = trackAt(0);
  S.x = tr.x + Math.sin(tr.ang) * 16; S.y = tr.y - Math.cos(tr.ang) * 16; S.ang = tr.ang;
}
g.onReset = resetWorld;
g.onStart = () => { music('chase'); };
resetWorld();

/* ================= actions ================= */
function fireThrusters() {
  const err = S.tAir - S.apexT;
  const win = perfectWin();
  const a = Math.abs(err);
  S.quality = a <= win ? 'PERFECT' : a <= win * 2.2 ? 'GOOD' : 'SLOPPY';
  S.tapped = true; S.flipT0 = S.tAir;
  const remain = Math.max(0.3, S.tLand - S.tAir);
  S.flipA = clamp(S.apexT - S.tAir, 0.15, 0.6);
  S.flipB = 0.3;
  S.flipC = Math.max(0.25, remain - S.flipA - S.flipB);
  S.wobAmp = S.quality === 'PERFECT' ? 0 : S.quality === 'GOOD' ? 0.05 : 0.2;
  const q = S.quality;
  const col = q === 'PERFECT' ? '#ffd34d' : q === 'GOOD' ? '#7df9ff' : '#ff9a3c';
  const base = q === 'PERFECT' ? 100 : q === 'GOOD' ? 50 : 20;
  let pts = Math.round(base * g.combo.mult);
  if (q === 'PERFECT') { S.chain++; pts += (S.chain - 1) * 25; } else S.chain = 0;
  g.score += pts;
  if (q === 'SLOPPY') g.combo.miss(); else g.combo.hit(S.x, S.y - 60, `${q} +${pts}`);
  if (q === 'PERFECT') {
    g.hitstop(0.12); g.slowmo(0.35, 0.35); g.flash('#ffd34d', 0.25);
    g.showBanner('PERFECT', 0.7);
    sfx('perfect', { pitch: 1 });
  } else {
    sfx('jump', { pitch: q === 'GOOD' ? 1.1 : 0.8 });
    g.showBanner(q, 0.5);
  }
  g.impact(S.x, S.y, { punch: .06, shake: 8, rip: 1.2, flash: col, flashA: .18 });
  for (let i = 0; i < 14; i++)
    g.fx.emit('bolt', S.x - 22, S.y + rnd(-8, 8), { vx: rnd(-340, -90), vy: rnd(-70, 70), life: rnd(.2, .45), size: rnd(4, 9), color: '#8ef6ff', add: true });
  navigator.vibrate?.(q === 'PERFECT' ? [15, 30, 15] : 12);
  feverCheck();
}

function feverCheck() {
  if (g.combo.n >= 8 && S.fever <= 0) {
    S.fever = 4.5;
    g.showBanner('OVERDRIVE', 1);
    sfx('powerup', { pitch: 1.25 });
    g.fx.burst(S.x, S.y - 40, 30, { kind: 'confetti', colors: ['#ffd34d', '#ff3b8d', '#7df9ff', '#b6ff7d'] });
  }
}

function flipAngle() {
  const t = S.tAir - S.flipT0, A = S.flipA, B = S.flipB, C = S.flipC;
  let a;
  if (t < A) a = Math.PI * easeIO(clamp(t / A, 0, 1));
  else if (t < A + B) a = Math.PI;
  else a = Math.PI + Math.PI * easeIO(clamp((t - A - B) / C, 0, 1));
  return a + S.wobAmp * Math.sin(t * 16) * Math.exp(-t * 2);
}

function launch() {
  const sp = CFG.launchV * (CFG.boostMin + (1 - CFG.boostMin) * S.boost);
  S.phase = 'air'; S.phaseT = 0;
  S.vx = Math.cos(CFG.launchAng) * sp;
  S.vy = Math.sin(CFG.launchAng) * sp;
  S.tAir = 0; S.tapped = false; S.tumble = false;
  S.apexT = -S.vy / CFG.grav;
  S.apexX = S.x + S.vx * S.apexT;
  S.apexY = S.y + S.vy * S.apexT + 0.5 * CFG.grav * S.apexT * S.apexT;
  const dy = GROUND - S.y;
  S.tLand = (-S.vy + Math.sqrt(S.vy * S.vy + 2 * CFG.grav * dy)) / CFG.grav;
  g.hud.hint = '';
  sfx('whoosh', { pitch: 0.9 + S.boost * 0.3 });
  g.impact(S.x, S.y, { punch: .08, shake: 12, rip: 1.6, flash: '#8ef6ff', flashA: .22 });
  g.fx.burst(S.x, S.y, 20, { kind: 'smoke', color: 'rgba(180,220,255,.5)' });
  for (let i = 0; i < 10; i++)
    g.fx.emit('glow', S.x - 10, S.y + rnd(-6, 10), { vx: -S.vx * rnd(.2, .6), vy: rnd(-40, 40), life: rnd(.3, .6), size: rnd(5, 11), color: '#8ef6ff', add: true });
  navigator.vibrate?.(20);
}

function crash(reason) {
  S.phase = 'crashed'; S.phaseT = 0;
  S.lives--; g.state.lives = S.lives;
  g.combo.miss(); S.chain = 0;
  g.impact(S.x, S.y, { punch: .12, shake: 26, stop: .14, flash: '#ff3b5c', flashA: .4, rip: 2, sfx: 'boom' });
  g.fx.blast(S.x, S.y, { r: 110, color: '#ff6b3d' });
  g.fx.burst(S.x, S.y, 24, { kind: 'debris', colors: ['#ffffff', '#ffb3c1', '#5a6b8c', '#ff3b5c'] });
  g.fx.burst(S.x, S.y, 18, { kind: 'smoke', color: 'rgba(200,200,210,.55)' });
  g.showBanner(reason, 1.1);
  navigator.vibrate?.([30, 50, 40]);
}

function touchdown() {
  const angErr = Math.abs(wrapA(S.ang)) * 180 / Math.PI;
  const inLineup = S.x < CFG.crashX;
  if (S.tumble || inLineup || angErr > 55) {
    crash(S.tumble ? 'LOST IT MID-AIR' : inLineup ? 'CLIPPED THE LINEUP' : 'BAD LANDING');
    return;
  }
  // graze: barely cleared the last Tesla
  if (S.x < CFG.crashX + 45) {
    const v = S.fever > 0 ? 50 : 25;
    g.score += v;
    g.combo.hit(S.x, S.y - 50, `CLOSE! +${v}`);
    sfx('coin', { pitch: comboPitch(g.combo.n % 12) });
    g.impact(S.x, S.y - 30, { punch: .04, shake: 5, stop: .05, flash: '#7df9ff', flashA: .15 });
    feverCheck();
  }
  const rough = angErr > 20;
  const landPts = rough ? 10 : Math.round(50 * (1 - angErr / 20));
  g.score += landPts;
  g.state.score = Math.round(g.score);
  S.phase = 'scored'; S.phaseT = 0;
  if (!rough) {
    g.combo.hit(S.x, S.y - 60, `STUCK +${landPts}`);
    sfx('win', { pitch: 1.2, vol: .5 });
    g.fx.burst(S.x, S.y - 20, 22, { kind: 'confetti', colors: ['#ffd34d', '#7df9ff', '#ffffff'] });
    g.fx.emit('ring', S.x, S.y - 10, { life: .5, size: 60, color: '#ffd34d', add: true });
    g.punch(.05);
    feverCheck();
  } else {
    g.showBanner('ROUGH', 0.6);
    sfx('thud');
  }
}

function nextRound() {
  S.round++;
  S.phase = 'climb'; S.phaseT = 0;
  S.s = 0; S.speed = 0; S.boost = 0; S.botHold = false;
  S.tapped = false; S.tumble = false; S.quality = null; S.suction = false;
  g.state.round = S.round + 1; g.state.phase = 'climb';
}

/* ================= update ================= */
function update(dt) {
  if (g.mode !== 'play') return;
  S.phaseT += dt;
  if (S.fever > 0) { S.fever -= dt; if (S.fever <= 0) g.showBanner('OVERDRIVE END', .8); }

  const tap = g.taps.length > 0 || g.pressed['Space'];
  if (isAuto) botThink();
  const holding = g.ptr.down || g.keys['Space'] || S.botHold;

  if (S.phase === 'climb') {
    if (holding) {
      S.boost = Math.min(1, S.boost + dt / CFG.chargeTime);
      if (chance(dt * 22))
        g.fx.emit('glow', S.x - 26, S.y + rnd(-4, 8), { vx: rnd(-160, -60), vy: rnd(-30, 30), life: rnd(.2, .4), size: rnd(4, 8), color: '#7df9ff', add: true });
    } else S.boost = Math.max(0, S.boost - dt * 0.12);
    if (tap && !isAuto) { // tap during climb: fan blip, small charge bump — every input answers
      S.boost = Math.min(1, S.boost + 0.12);
      sfx('charge', { pitch: 0.9 + S.boost * 0.4, vol: .5 });
      g.punch(.02);
    }
    const target = CFG.climbTarget(S.round);
    S.speed = approach(S.speed, target, CFG.climbAccel * dt);
    S.s += S.speed * dt;
    const tr = trackAt(S.s);
    const nx = Math.sin(tr.ang), ny = -Math.cos(tr.ang); // left normal = track "up"
    S.x = tr.x + nx * 16; S.y = tr.y + ny * 16; S.ang = tr.ang;
    S.suction = Math.abs(wrapA(tr.ang)) > 100 * Math.PI / 180;
    if (S.suction && chance(dt * 30))
      g.fx.emit('glow', S.x + rnd(-20, 20), S.y + 14, { vx: rnd(-40, 40), vy: rnd(60, 160), life: rnd(.25, .5), size: rnd(3, 7), color: '#7df9ff', add: true });
    if (chance(dt * 5))
      g.fx.emit('dust', S.x - 20, S.y + 12, { vx: rnd(-80, -20), vy: rnd(-30, 10), life: rnd(.3, .6), size: rnd(4, 8), color: 'rgba(160,170,200,.4)' });
    g.hud.hint = S.boost < 0.98 ? 'HOLD to charge fan' : '';
    g.state.phase = 'climb';
    if (S.s >= TRACK_LEN - 2) launch();
  }
  else if (S.phase === 'air') {
    S.tAir += dt;
    if (tap && !S.tapped) fireThrusters();
    if (!S.tapped && S.tAir > S.apexT + 0.3) S.tumble = true;
    if (S.tumble) S.ang += 8 * dt;
    else if (S.tapped) S.ang = flipAngle();
    else S.ang = lerp(S.ang, -0.15, Math.min(1, dt * 3));
    S.vy = Math.min(1100, S.vy + CFG.grav * dt);
    S.x += S.vx * dt; S.y += S.vy * dt;
    if (S.tapped && chance(dt * 30))
      g.fx.emit('glow', S.x - 26, S.y + rnd(-6, 6), { vx: -70, vy: 30, life: .3, size: rnd(4, 8), color: '#ffd34d', add: true });
    g.state.phase = 'air';
    if (S.y >= GROUND && S.vy > 0) { S.y = GROUND; touchdown(); }
  }
  else if (S.phase === 'scored' || S.phase === 'crashed') {
    if (S.phaseT > (S.phase === 'scored' ? 1.2 : 1.6)) {
      if (S.lives <= 0) g.end({ win: false, score: Math.round(g.score), label: 'SCORE' });
      else nextRound();
    }
  }

  g.state.score = Math.round(g.score);
  if (isAuto && (g.score >= 900 || g.t > 55))
    g.end({ win: g.score >= 900, score: Math.round(g.score), label: 'SCORE' });
}

function botThink() {
  S.botHold = S.phase === 'climb';
  if (S.phase === 'air' && !S.tapped && S.tAir >= S.apexT - 0.02) fireThrusters();
}

/* ================= draw ================= */
function drawSky(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#070b24'); sky.addColorStop(.45, '#1c1445');
  sky.addColorStop(.72, '#4a2450'); sky.addColorStop(.88, '#8a3a52'); sky.addColorStop(1, '#c96a4a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    const tw = .3 + .7 * Math.abs(Math.sin(g.t * s.sp + s.ph));
    ctx.globalAlpha = tw; ctx.fillStyle = '#dff2ff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // moon
  const mx = 428, my = 128;
  const halo = ctx.createRadialGradient(mx, my, 8, mx, my, 110);
  halo.addColorStop(0, 'rgba(255,240,200,.45)'); halo.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(mx, my, 110, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff3d2'; ctx.beginPath(); ctx.arc(mx, my, 38, 0, TAU); ctx.fill();
  // distant starship on the pad
  ctx.fillStyle = '#0d1226';
  rr(ctx, 470, 560, 34, 150, 14); ctx.fill();
  ctx.beginPath(); ctx.moveTo(470, 560); ctx.lineTo(487, 516); ctx.lineTo(504, 560); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,80,80,.9)';
  const bl = .4 + .6 * Math.abs(Math.sin(g.t * 2.4));
  ctx.globalAlpha = bl; ctx.beginPath(); ctx.arc(487, 540, 4, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawGround(ctx) {
  ctx.fillStyle = '#0b0e1d'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = 'rgba(125,249,255,.5)'; ctx.fillRect(0, GROUND, W, 3);
  // pad lights
  for (let x = 30; x < W; x += 60) {
    ctx.fillStyle = 'rgba(255,200,90,.5)';
    ctx.beginPath(); ctx.arc(x, GROUND + 26, 3, 0, TAU); ctx.fill();
  }
  // landing pad: checkered strip
  const px0 = CFG.crashX, px1 = 535;
  for (let x = px0, i = 0; x < px1; x += 10, i++) {
    ctx.fillStyle = i % 2 ? '#e8f2ff' : '#1a2340';
    ctx.fillRect(x, GROUND - 8, 10, 8);
  }
  g.text('LAND', (px0 + px1) / 2, GROUND + 44, { size: 16, color: 'rgba(160,200,255,.6)', align: 'center' });
}

function drawLineup(ctx) {
  const drawTesla = (x, kind) => {
    const y = GROUND;
    ctx.fillStyle = '#131a30';
    if (kind === 0) { // semi: cab + trailer
      rr(ctx, x - 16, y - 34, 20, 34, 4); ctx.fill();
      rr(ctx, x + 6, y - 30, 34, 30, 3); ctx.fill();
    } else if (kind === 1) { // cybertruck: angular wedge
      ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x - 14, y - 16); ctx.lineTo(x + 2, y - 24); ctx.lineTo(x + 18, y - 10); ctx.lineTo(x + 18, y); ctx.closePath(); ctx.fill();
    } else if (kind === 2) { // cybercab: low sleek
      ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.quadraticCurveTo(x - 12, y - 12, x, y - 13); ctx.quadraticCurveTo(x + 12, y - 12, x + 16, y); ctx.closePath(); ctx.fill();
    } else if (kind === 3) { // model y: crossover
      rr(ctx, x - 16, y - 14, 32, 14, 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 10, y - 14); ctx.quadraticCurveTo(x, y - 26, x + 10, y - 14); ctx.closePath(); ctx.fill();
    } else { // model 3: sedan
      rr(ctx, x - 16, y - 11, 32, 11, 5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 8, y - 11); ctx.quadraticCurveTo(x, y - 20, x + 9, y - 11); ctx.closePath(); ctx.fill();
    }
    // window glint
    ctx.fillStyle = 'rgba(125,249,255,.35)'; ctx.fillRect(x - 8, y - 20, 14, 3);
    // wheels
    ctx.fillStyle = '#05070d';
    ctx.beginPath(); ctx.arc(x - 10, y - 3, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 10, y - 3, 4, 0, TAU); ctx.fill();
  };
  CFG.lineupX.forEach((x, i) => {
    drawTesla(x, i);
    g.text(CFG.lineupNames[i], x, GROUND + (i % 2 ? 34 : 20), { size: 11, color: 'rgba(150,180,220,.5)', align: 'center' });
  });
}

function drawRamp(ctx) {
  // struts
  ctx.strokeStyle = '#182242'; ctx.lineWidth = 8;
  for (let s = 60; s < TRACK_LEN; s += 110) {
    const p = trackAt(s);
    ctx.beginPath(); ctx.moveTo(p.x, p.y + 12); ctx.lineTo(p.x, GROUND); ctx.stroke();
  }
  // band
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); TRACK.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); };
  path(); ctx.strokeStyle = '#10182e'; ctx.lineWidth = 36; ctx.stroke();
  path(); ctx.strokeStyle = '#2c3a5e'; ctx.lineWidth = 26; ctx.stroke();
  // suction-zone highlight (inverted section)
  ctx.save();
  ctx.setLineDash([10, 14]);
  ctx.strokeStyle = 'rgba(125,249,255,.55)'; ctx.lineWidth = 28;
  ctx.beginPath();
  let pen = false;
  for (const p of TRACK) {
    if (Math.abs(wrapA(p.ang)) > 100 * Math.PI / 180) { if (!pen) { ctx.moveTo(p.x, p.y); pen = true; } else ctx.lineTo(p.x, p.y); }
    else pen = false;
  }
  ctx.stroke(); ctx.restore();
  // neon edge
  ctx.save();
  ctx.shadowColor = '#7df9ff'; ctx.shadowBlur = 14;
  path(); ctx.strokeStyle = 'rgba(125,249,255,.85)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}

function drawCar(ctx) {
  const { x, y, ang } = S;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  // underglow
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gg = ctx.createRadialGradient(0, 12, 4, 0, 12, 46);
  const ga = S.suction && S.phase === 'climb' ? .9 : .35;
  gg.addColorStop(0, `rgba(125,249,255,${ga})`); gg.addColorStop(1, 'rgba(125,249,255,0)');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(0, 13, 46, 17, 0, 0, TAU); ctx.fill();
  ctx.restore();
  // body: white roadster wedge, nose right
  const bg = ctx.createLinearGradient(0, -12, 0, 10);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(.6, '#dfe8f5'); bg.addColorStop(1, '#9fb2cc');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-30, 6);
  ctx.quadraticCurveTo(-28, -4, -12, -7);
  ctx.lineTo(2, -11);
  ctx.quadraticCurveTo(10, -12, 16, -6);
  ctx.lineTo(28, 0);
  ctx.quadraticCurveTo(30, 4, 22, 6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(20,30,60,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  // canopy
  ctx.fillStyle = 'rgba(18,28,54,.94)';
  ctx.beginPath(); ctx.moveTo(-2, -9); ctx.quadraticCurveTo(9, -10, 14, -5); ctx.lineTo(4, -4); ctx.closePath(); ctx.fill();
  // wheels
  for (const wx of [-17, 15]) {
    ctx.fillStyle = '#10141f'; ctx.beginPath(); ctx.arc(wx, 7, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#33436b'; ctx.beginPath(); ctx.arc(wx, 7, 2.5, 0, TAU); ctx.fill();
  }
  // headlight
  ctx.fillStyle = '#cff6ff'; ctx.beginPath(); ctx.arc(27, -1, 2.4, 0, TAU); ctx.fill();
  ctx.restore();
  // suction lock label
  if (S.suction && S.phase === 'climb')
    g.text('SUCTION LOCK', x, y - 44, { size: 18, color: '#7df9ff', align: 'center', stroke: 4 });
}

function draw(ctx) {
  drawSky(ctx);
  drawGround(ctx);
  drawLineup(ctx);
  drawRamp(ctx);
  // apex ring: the tap target
  if (S.phase === 'air' && !S.tapped) {
    const r = 24 + 6 * Math.sin(g.t * 10);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .9; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(S.apexX, S.apexY, r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = .3;
    ctx.beginPath(); ctx.arc(S.apexX, S.apexY, r + 11, 0, TAU); ctx.stroke();
    ctx.restore();
    if (Math.hypot(S.x - S.apexX, S.y - S.apexY) < 150)
      g.text('TAP!', S.apexX, S.apexY - 48, { size: 32, color: '#ffd34d', align: 'center', stroke: 5 });
  }
  drawCar(ctx);
}

function hud(ctx) {
  // score panel
  rr(ctx, 22, 22, 208, 100, 18);
  ctx.fillStyle = 'rgba(8,10,24,.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(160,240,255,.28)'; ctx.lineWidth = 2; ctx.stroke();
  g.text('SCORE', 40, 50, { size: 20, color: '#8ef6ff', stroke: 3 });
  g.text(String(Math.round(g.score)).padStart(4, '0'), 40, 104, { size: 58, color: '#fff' });
  // lives
  for (let i = 0; i < 3; i++) {
    const x = 46 + i * 44, y = 156;
    heartPath(ctx, x, y, 30);
    if (i < S.lives) {
      const hg = ctx.createLinearGradient(x, y - 16, x, y + 16);
      hg.addColorStop(0, '#ff8fa3'); hg.addColorStop(1, '#e01b3c');
      ctx.fillStyle = hg;
    } else ctx.fillStyle = 'rgba(255,255,255,.13)';
    ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = i < S.lives ? '#5c0416' : 'rgba(255,255,255,.2)'; ctx.stroke();
  }
  // round
  g.text('ROUND ' + (S.round + 1), W - 24, 50, { size: 22, color: '#8fa3c8', align: 'right', stroke: 3 });
  // fan charge meter during climb
  if (S.phase === 'climb' && g.mode === 'play') {
    const bx = W - 56, by = 220, bw = 22, bh = 280;
    rr(ctx, bx, by, bw, bh, 11); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
    const fh = Math.max(0, bh * S.boost - 4);
    if (fh > 0) {
      const fg = ctx.createLinearGradient(0, by + bh, 0, by);
      fg.addColorStop(0, '#7df9ff'); fg.addColorStop(1, '#ffd34d');
      rr(ctx, bx + 2, by + bh - fh, bw - 4, fh, 8); ctx.fillStyle = fg; ctx.fill();
    }
    ctx.strokeStyle = 'rgba(160,240,255,.3)'; ctx.lineWidth = 2;
    rr(ctx, bx, by, bw, bh, 11); ctx.stroke();
    g.text('FAN', bx + bw / 2, by - 18, { size: 18, color: '#8ef6ff', align: 'center' });
    if (S.boost < 0.05 && S.phaseT > 0.4)
      g.text('HOLD!', W / 2, H * .62, { size: 42, color: '#fff', align: 'center', stroke: 6 });
  }
  // fever border
  if (S.fever > 0) {
    ctx.save();
    ctx.strokeStyle = `hsl(${(g.t * 240) % 360} 100% 65%)`;
    ctx.lineWidth = 10; ctx.globalAlpha = .8;
    ctx.strokeRect(5, 5, W - 10, H - 10);
    ctx.restore();
  }
  // SO CLOSE! overlay (shell draws its own result panel below this)
  if (g.mode === 'over' && g.result && g.result.best > 0 && g.result.score < g.result.best && g.result.score >= g.result.best * 0.7) {
    const bw = 420, bx = (W - bw) / 2, by = H * 0.28;
    rr(ctx, bx, by, bw, 122, 18);
    ctx.fillStyle = 'rgba(42,28,4,.92)'; ctx.fill();
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.stroke();
    g.text('SO CLOSE!', W / 2, by + 42, { size: 44, color: '#ffd34d', align: 'center' });
    rr(ctx, bx + 30, by + 68, bw - 60, 14, 7);
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fill();
    rr(ctx, bx + 30, by + 68, (bw - 60) * clamp(g.result.score / g.result.best, 0, 1), 14, 7);
    ctx.fillStyle = '#ffd34d'; ctx.fill();
    g.text('tap for one more run', W / 2, by + 106, { size: 20, color: '#fff', align: 'center' });
  }
  if (g.mode === 'title') g.text('TAP TO START', W / 2, H * .7, { size: 34, align: 'center', color: '#fff', stroke: 5 });
}

window.__g = g;
window.__dbg = () => ({ phase: S.phase, score: Math.round(g.score), lives: S.lives, round: S.round, boost: +S.boost.toFixed(2), x: Math.round(S.x), y: Math.round(S.y) });
g.run(update, draw, hud);
