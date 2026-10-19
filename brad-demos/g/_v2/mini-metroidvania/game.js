// CAT CAVE — a mini-metroidvania in three chambers.
// Dash the chasm, climb for the relic (double jump), then outrun the collapse.
import { makeGame, sfx, music, clamp, rnd, R, TAU, damp, rr, starPath, squish } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const AUTO = new URLSearchParams(location.search).has('auto');

const g = makeGame({
  id: 'mini-metroidvania', title: 'CAT CAVE', sub: 'DASH · DOUBLE JUMP · ESCAPE',
  hook: 'three chambers, one relic, zero seconds',
  w: W, h: H, bg: '#08040f', style: 'toon', bloom: .85, ca: .34, vig: 1, scan: .14, grain: .05,
});
g.state = { x: 0, room: 0, relic: 0, door: 0, prog: 0 };

/* ------------------------------------------------------------------ tuning */
const FLOOR = 760, BW = 26, BH = 46, CH = 62;
const RUN = 258, GRAV = 2000, JUMPV = 720, DASHV = 700, DASHT = .2, DASHCD = .48;
const RMW = 540;

/* ------------------------------------------------------------------ level */
const PORTAL = { x: 1504, y: 240 };
const DOORX = 1054, DOORW = 26, DOORTOP = 620;
const ROOFY = 140;

const SOL = [
  { x: -80, y: FLOOR, w: 280, h: 240, t: 'rock' },      // start shelf   -80..200
  { x: 400, y: FLOOR, w: 1240, h: 240, t: 'rock' },     // main floor    400..1640
  { x: -80, y: ROOFY, w: 1780, h: 62, t: 'roof' },      // cave roof
  { x: 600, y: 670, w: 110, h: 40, t: 'plat' },
  { x: 700, y: 580, w: 110, h: 40, t: 'plat' },
  { x: 800, y: 490, w: 110, h: 40, t: 'plat' },
  { x: 900, y: 400, w: 100, h: 40, t: 'plat' },          // relic ledge 900..1000, drop shaft to its right
  { x: DOORX, y: 202, w: 26, h: DOORTOP - 202, t: 'wall' },   // vault lintel
  { x: 1130, y: 610, w: 114, h: 40, t: 'plat' },
  { x: 1230, y: 460, w: 114, h: 40, t: 'plat' },
  { x: 1330, y: 310, w: 300, h: 40, t: 'plat' },         // exit ledge
];
const DOOR_SOL = { x: DOORX, y: DOORTOP, w: DOORW, h: FLOOR - DOORTOP, t: 'door' };

const EMB = [{ x: 300, y: 640 }, { x: 512, y: 690 }, { x: 655, y: 616 }, { x: 815, y: 436 }, { x: 1184, y: 556 }, { x: 1360, y: 406 }];
const RELIC = { x: 950, y: 352 };
const roomMax = [8.0, 9.0, 9.5];

/* ------------------------------------------------------------------ scenery (deterministic) */
const FAR = [], MID = [], MOTES = [];
for (let i = 0; i < 32; i++) FAR.push({ x: -420 + i * 94, w: 44 + R() * 76, h: 110 + R() * 250 });
for (let i = 0; i < 18; i++) MID.push({ x: -320 + i * 158, w: 54 + R() * 92, h: 150 + R() * 330, d: R() });
for (let i = 0; i < 36; i++) MOTES.push({ x: R() * 1720, y: 230 + R() * 600, s: 1.3 + R() * 2.6, p: R() * TAU });

/* ------------------------------------------------------------------ runtime state */
let p, camX, t, playT, roomT, roomPrev, relic, doorOpen, doorY, score, prog, embers;
let dustT, warn, banner;

const roomOf = x => clamp(Math.floor(x / RMW), 0, 2);
const progOf = () => clamp((p.x - 120) / (PORTAL.x - 120), 0, 1);

function resetWorld() {
  p = { x: 110, y: FLOOR, vx: 0, vy: 0, dir: 1, onGround: true, coy: 0, jbuf: 0, jumps: 0, dashT: 0, dashCd: 0, sq: 1, anim: 'idle', dead: false };
  camX = 0; t = 0; playT = 0; relic = 0; doorOpen = 0; doorY = DOORTOP;
  score = 0; prog = 0; warn = 0; dustT = 0; banner = 1.8;
  roomPrev = 0; roomT = roomMax[0];
  AI.phase = 'leap'; AI.air = 0; AI.dbl = false;
  embers = EMB.map(e => ({ x: e.x, y: e.y, got: false, ph: R() * TAU }));
  g.score = 0; g.combo.reset(); g.fx.clear();
  g.state = { x: 110, room: 0, relic: 0, door: 0, prog: 0 };
}

/* ------------------------------------------------------------------ collision */
const solids = () => (doorOpen ? SOL : SOL.concat([DOOR_SOL]));
const ov = (x, y, w, h, s) => x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y;
/** Blocking geometry. Ledge platforms are one-way (see topOf), so you can jump up through them. */
function hit(x, y, w, h) {
  for (const s of solids()) { if (s.t === 'plat') continue; if (ov(x, y, w, h, s)) return s; }
  return null;
}
/** One-way ledges only catch you when you are falling onto their top edge. */
function topOf(x, y, w, h) {
  for (const s of SOL) if (s.t === 'plat' && ov(x, y, w, h, s)) return s;
  return null;
}

/* ------------------------------------------------------------------ input */
const IN = { l: 0, r: 0, j: 0, jp: 0, d: 0, dp: 0 };
function readInput(dt) {
  const bl = g.btn('l', 18, 840, 106, 86, '◀', { key: 'ArrowLeft' });
  const br = g.btn('r', 132, 840, 106, 86, '▶', { key: 'ArrowRight' });
  const bd = g.btn('d', 258, 840, 112, 86, 'DASH', { key: 'ShiftLeft' });
  const bj = g.btn('j', 388, 840, 134, 86, 'JUMP', { key: 'Space' });
  if (g.dumb()) { IN.l = IN.r = IN.j = IN.jp = IN.d = IN.dp = 0; return; }
  if (AUTO) { bot(dt); return; }
  IN.l = bl.held || !!g.keys.KeyA;
  IN.r = br.held || !!g.keys.KeyD;
  IN.j = bj.held || !!g.keys.ArrowUp || !!g.keys.KeyW;
  IN.jp = bj.pressed || !!g.pressed.ArrowUp || !!g.pressed.KeyW;
  IN.d = bd.held || !!g.keys.KeyX;
  IN.dp = bd.pressed || !!g.pressed.KeyX;
}

/* ------------------------------------------------------------------ bot */
// ?auto=1 autopilot. Plays the real route: dash-jump the chasm, climb the relic
// stairs, drop down the vault shaft, then climb the exit shelves. Every stair hop
// is a straight-up jump, so it always lands on the rung directly above it.
const STAIRS_A = [
  { y: FLOOR, x: 650 }, { y: 670, x: 705 }, { y: 580, x: 805 }, { y: 490, x: 905 }, { y: 400, x: null },
];
const STAIRS_B = [
  { y: FLOOR, x: 1180 }, { y: 610, x: 1237 }, { y: 460, x: 1337 }, { y: 310, x: null },
];
const AI = { phase: 'leap', air: 0, dbl: false };

function botWalk(x, to, dead = 6) {
  if (Math.abs(to - x) <= dead) return true;
  if (to > x) IN.r = 1; else IN.l = 1;
  return false;
}
function botClimb(stairs, goalX) {
  if (!p.onGround) {
    if (AI.dbl && p.jumps === 1 && p.vy > -40) IN.jp = 1;    // apex boost for the tall steps
    return;
  }
  let i = stairs.findIndex(s => Math.abs(s.y - p.y) < 4);
  if (i < 0) i = 0;                        // unexpected ledge: restart the climb from the floor
  if (i === stairs.length - 1) { botWalk(p.x, goalX, 4); return; }
  if (botWalk(p.x, stairs[i].x) && Math.abs(p.vx) < 50) {
    AI.dbl = stairs[i].y - stairs[i + 1].y > 124;
    IN.jp = 1;
  }
}
function bot(dt) {
  IN.l = 0; IN.r = 0; IN.j = 0; IN.jp = 0; IN.d = 0; IN.dp = 0;
  if (p.dead) return;
  if (AI.phase === 'leap') {
    if (p.onGround) {
      if (p.x > 395) { AI.phase = 'relic'; return bot(dt); }
      IN.r = 1;
      if (p.x >= 186) { IN.jp = 1; AI.air = .0001; }
    } else if (AI.air) {
      AI.air += dt; IN.r = 1;
      if (AI.air > .1 && p.dashCd <= 0) IN.dp = 1;           // air dash carries the chasm
      if (p.jumps === 1 && p.vy > 0) IN.jp = 1;
    }
    return;
  }
  if (AI.phase === 'relic') {
    if (relic) AI.phase = 'door';
    else { botClimb(STAIRS_A, RELIC.x); return; }
  }
  if (AI.phase === 'door') {
    if (p.onGround && p.x > 1100) { AI.phase = 'exit'; return bot(dt); }
    IN.r = 1; return;                      // vault open: walk off the ledge, drop, run right
  }
  botClimb(STAIRS_B, PORTAL.x);
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  if (g.mode !== 'play' || p.dead) return;
  playT += dt; t += dt;
  if (banner > 0) banner -= dt;
  readInput(dt);

  if (doorOpen && doorY > DOORTOP - 112) doorY = Math.max(DOORTOP - 112, doorY - 460 * dt);

  /* chamber collapse clock */
  roomT -= dt;
  warn = roomT < 2 ? 1 - clamp(roomT / 2, 0, 1) : 0;
  if (roomT < 2.4) {
    dustT -= dt;
    if (dustT <= 0) {
      dustT = .08 - warn * .055;
      g.fx.emit('debris', camX + rnd(10, 530), 210 + rnd(0, 70), { vy: rnd(140, 280), vx: rnd(-40, 40), g: 900, life: 1, size: rnd(2, 5), color: '#5d4a63' });
    }
    if (warn > .6) g.shake(1.5 * warn);
  }
  if (roomT <= 0) return collapse();

  /* horizontal */
  const mv = (IN.r ? 1 : 0) - (IN.l ? 1 : 0);
  p.dashCd -= dt;
  if (IN.dp && p.dashCd <= 0) {
    p.dashT = DASHT; p.dashCd = DASHCD; p.dir = mv || p.dir;
    sfx('whoosh', { pitch: 1.2, vol: .8 });
    g.fx.burst(p.x - p.dir * 10, p.y - 22, 10, { color: ['#8de9ff', '#fff'], speed: 170, size: 5, life: .34, ang: p.dir > 0 ? Math.PI : 0, spread: .9, g: 100 });
    g.punch(.035); g.shake(3);
  }
  if (p.dashT > 0) {
    p.dashT -= dt; p.vx = p.dir * DASHV; p.vy *= .84;
    if (R() < .7) g.fx.trailDot(p.x - p.dir * 10, p.y - CH * .5 + rnd(-12, 12), { color: '#7fe3ff', size: 22, life: .2 });
  } else if (mv) { p.dir = mv; p.vx = damp(p.vx, mv * RUN, 22, dt); }
  else p.vx = damp(p.vx, 0, 17, dt);

  /* jump + double jump */
  p.jbuf -= dt; p.coy -= dt;
  if (IN.jp) p.jbuf = .13;
  if (p.jbuf > 0) {
    if (p.onGround || p.coy > 0) {
      p.vy = -JUMPV; p.jumps = 1; p.jbuf = 0; p.coy = 0; p.onGround = false; p.sq = .78;
      sfx('jump', { pitch: 1.02 }); g.fx.dust(p.x, p.y, 5, { spread: 18, size: 12 });
    } else if (p.jumps === 1) {
      p.vy = -JUMPV * .92; p.jumps = 2; p.jbuf = 0; p.sq = .74;
      sfx('jump', { pitch: 1.5 }); g.fx.burst(p.x, p.y - 8, 9, { color: ['#8de9ff', '#fff'], speed: 190, size: 6, life: .38, g: 40 });
      g.fx.emit('ring', p.x, p.y - 10, { size: 40, life: .32, color: '#7fe3ff', add: true, wide: 5 });
    }
  }

  /* integrate */
  p.vy = Math.min(p.vy + GRAV * dt, 1180);
  const px = p.x;
  p.x += p.vx * dt;
  let s = hit(p.x - BW / 2, p.y - BH, BW, BH);
  if (s) {
    if (p.x > px) p.x = s.x - BW / 2 - .02; else if (p.x < px) p.x = s.x + s.w + BW / 2 + .02;
    if (p.dashT > 0) { p.dashT = 0; g.shake(5); g.punch(.03); g.fx.burst(p.x + p.dir * 12, p.y - 24, 8, { color: '#8de9ff', speed: 150, size: 5, life: .3 }); }
    p.vx = 0;
  }
  p.onGround = false;
  const prevY = p.y;
  p.y += p.vy * dt;
  s = hit(p.x - BW / 2, p.y - BH, BW, BH);
  let ledge = null;
  if (s) {
    if (p.vy >= 0) ledge = s;
    else { p.y = s.y + s.h + BH; p.vy = 30; }
  } else if (p.vy >= 0) {
    const q = topOf(p.x - BW / 2, p.y - BH, BW, BH);
    if (q && prevY <= q.y + .5) ledge = q;
  }
  if (ledge) {
    p.y = ledge.y; p.onGround = true;
    if (p.vy > 560) { p.sq = 1.2; sfx('step', { pitch: .92, vol: .55 }); g.fx.dust(p.x, p.y, 6, { spread: 22, size: 13 }); }
    p.vy = 0; p.jumps = 0;
  }
  if (p.onGround) p.coy = .1;
  p.sq = damp(p.sq, 1, 13, dt);
  p.anim = Math.abs(p.vx) > 40 && p.onGround ? 'walk' : 'idle';
  p.x = clamp(p.x, 22, 1600);
  if (p.y > 900) return die('CHASM');

  /* chamber transition */
  const room = roomOf(p.x);
  if (room !== roomPrev) {
    roomPrev = room;
    roomT = Math.max(roomT, roomMax[room] - .5);
    sfx('unlock', { pitch: 1.3, vol: .45 }); g.flash('#7fe3ff', .14); g.punch(.05); g.shake(4);
    g.fx.burst(p.x, p.y - 26, 16, { color: ['#7fe3ff', '#fff'], speed: 280, size: 6, life: .5 });
    g.showBanner(`CHAMBER ${room + 1}`, .8);
  }
  camX = damp(camX, room * RMW, 8, dt);
  g.cam.x = (p.x - room * RMW - W / 2) * .05;

  /* pickups */
  for (const e of embers) {
    if (e.got) continue;
    e.ph += dt * 3;
    if (Math.abs(e.x - p.x) < 32 && Math.abs(e.y - (p.y - 26)) < 34) {
      e.got = true; score += 50; g.score = score;
      g.combo.hit(e.x, e.y, '+50');
      g.fx.blast(e.x, e.y, { r: 44, color: '#7fe3ff', n: 11, smoke: false, punch: .035, shake: 4, flashA: .08 });
    }
  }
  if (!relic && Math.abs(RELIC.x - p.x) < 55 && Math.abs(p.y - 400) < 8) takeRelic();
  if (relic && Math.abs(PORTAL.x - p.x) < 40 && Math.abs(PORTAL.y + 60 - (p.y - 26)) < 78) return winRun();

  prog = progOf();
  g.state = { x: Math.round(p.x), room, relic: relic ? 1 : 0, door: doorOpen ? 1 : 0, prog: Math.round(prog * 100) / 100 };
}

/* ------------------------------------------------------------------ beats */
function takeRelic() {
  relic = 1; doorOpen = 1;
  score += 250; g.score = score;
  g.combo.hit(RELIC.x, RELIC.y, '+250');
  sfx('powerup', { pitch: 1.1 }); sfx('unlock', { pitch: 1.1, vol: .8 });
  g.hitstop(.1); g.flash('#ffd34d', .34); g.shake(13); g.punch(.13);
  g.fx.blast(RELIC.x, RELIC.y, { r: 110, color: '#ffd34d', n: 26 });
  g.showBanner('RELIC!', 1.1);
  for (let i = 0; i < 14; i++) g.fx.emit('star', RELIC.x + rnd(-30, 30), RELIC.y + rnd(-24, 24), { vx: rnd(-160, 160), vy: rnd(-260, -60), g: 500, life: 1, size: rnd(5, 11), color: '#fff3b0', rot: rnd(0, 3) });
}

function collapse() {
  if (g.mode !== 'play') return;
  sfx('explode', { vol: 1 }); g.shake(28); g.flash('#ff3b5c', .5); g.hitstop(.14);
  g.fx.blast(p.x, p.y - 22, { r: 140, color: '#ff5b5c', n: 30, punch: .2, shake: 24 });
  for (let i = 0; i < 18; i++) g.fx.emit('debris', camX + rnd(0, 540), 215, { vy: rnd(200, 520), vx: rnd(-70, 70), g: 1400, life: 1.3, size: rnd(3, 8), color: '#6b5570' });
  p.dead = true;
  g.end({ win: false, score: Math.round(score), label: 'SCORE' });
  g.showBanner('CAVED IN', 1.2);
}

function die(reason) {
  p.dead = true;
  sfx('boom', { pitch: .75 }); g.flash('#ff3b5c', .42); g.shake(18);
  g.fx.blast(p.x, p.y - 18, { r: 90, color: '#ff5b5c', n: 22 });
  g.end({ win: false, score: Math.round(score), label: 'SCORE' });
  g.showBanner(reason, 1.2);
}

function winRun() {
  if (g.mode !== 'play') return;
  p.dead = true;
  const bonus = Math.round(Math.max(0, roomT) * 140);
  score += 600 + bonus;
  sfx('fanfare', { vol: 1 }); g.flash('#fff', .55); g.shake(12); g.hitstop(.1);
  g.fx.burst(PORTAL.x, 280, 44, { color: ['#7fe3ff', '#ffd34d', '#fff', '#ff5fd0'], speed: 430, size: 8, life: 1.1, g: 380, kind: 'confetti' });
  g.fx.blast(PORTAL.x, 280, { r: 160, color: '#7fe3ff', n: 32, punch: .18, shake: 14 });
  g.popup('+' + (600 + bonus), PORTAL.x, 250, '#ffd34d', 42);
  g.end({ win: true, score: Math.round(score), label: 'SCORE' });
}

/* ------------------------------------------------------------------ draw */
function draw(ctx) {
  g.sky(ctx, ['#160c28', '#2b1049', '#0a0714'], { glow: 'rgba(130,64,230,.55)', gx: .5, gy: .28, gr: 1.25 });

  /* far pillars (parallax .18) */
  ctx.fillStyle = '#1a1030';
  for (const f of FAR) {
    const x = f.x - camX * .18;
    if (x < -160 || x > W + 160) continue;
    ctx.beginPath(); ctx.moveTo(x - f.w / 2, 300); ctx.lineTo(x + f.w / 2, 300);
    ctx.lineTo(x + f.w * .32, 300 - f.h); ctx.lineTo(x - f.w * .3, 300 - f.h * .7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - f.w * .5, 640); ctx.lineTo(x + f.w * .5, 640);
    ctx.lineTo(x + f.w * .36, 640 + f.h * .85); ctx.lineTo(x - f.w * .34, 640 + f.h * .65); ctx.closePath(); ctx.fill();
  }
  /* mid crystals (parallax .45) */
  for (const m of MID) {
    const x = m.x - camX * .45;
    if (x < -170 || x > W + 170) continue;
    ctx.fillStyle = '#261740';
    ctx.beginPath(); ctx.moveTo(x - m.w * .5, 770); ctx.lineTo(x + m.w * .5, 770); ctx.lineTo(x + m.w * .22, 770 - m.h * .82); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = .45 + m.d * .45;
    ctx.strokeStyle = '#6b3fd0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - m.w * .5, 770); ctx.lineTo(x + m.w * .22, 770 - m.h * .82); ctx.stroke();
    const gl = ctx.createRadialGradient(x + m.w * .16, 770 - m.h * .34, 0, x + m.w * .16, 770 - m.h * .34, 64);
    gl.addColorStop(0, 'rgba(140,80,255,.34)'); gl.addColorStop(1, 'rgba(140,80,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(x - 74, 770 - m.h * .34 - 74, 148, 148);
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(-camX, 0);
  chamberSeams(ctx);
  drawSolids(ctx);
  drawPortal(ctx);
  drawDoor(ctx);
  if (!relic) drawRelic(ctx);
  drawEmbers(ctx);
  drawMotes(ctx);
  drawHero(ctx);
  ctx.restore();

  drawHud(ctx);
}

function chamberSeams(ctx) {
  for (const bx of [540, 1080]) {
    const gd = ctx.createLinearGradient(bx - 34, 0, bx + 34, 0);
    gd.addColorStop(0, 'rgba(127,227,255,0)'); gd.addColorStop(.5, 'rgba(127,227,255,.13)'); gd.addColorStop(1, 'rgba(127,227,255,0)');
    ctx.fillStyle = gd; ctx.fillRect(bx - 34, 202, 68, 558);
  }
}

function drawSolids(ctx) {
  for (const s of SOL) {
    if (s.t === 'roof') {
      const gd = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
      gd.addColorStop(0, '#100a1b'); gd.addColorStop(1, '#2f1c44');
      ctx.fillStyle = gd; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = '#5a3f7a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(s.x, s.y + s.h); ctx.lineTo(s.x + s.w, s.y + s.h); ctx.stroke();
      ctx.fillStyle = '#1c1230';
      for (let x = s.x + 30; x < s.x + s.w; x += 118) { ctx.beginPath(); ctx.moveTo(x, s.y + s.h); ctx.lineTo(x + 16, s.y + s.h + 26); ctx.lineTo(x + 32, s.y + s.h); ctx.closePath(); ctx.fill(); }
      continue;
    }
    if (s.t === 'wall') {
      ctx.fillStyle = '#1b1029'; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = '#3d2a55'; ctx.lineWidth = 2; ctx.strokeRect(s.x + 1, s.y, s.w - 2, s.h);
      continue;
    }
    const hh = Math.min(s.h, 120);
    const gd = ctx.createLinearGradient(0, s.y, 0, s.y + hh);
    gd.addColorStop(0, '#3d2849'); gd.addColorStop(.4, '#26172f'); gd.addColorStop(1, '#150d1e');
    ctx.fillStyle = gd; rr(ctx, s.x, s.y, s.w, s.h, 7); ctx.fill();
    const top = ctx.createLinearGradient(0, s.y - 7, 0, s.y + 12);
    top.addColorStop(0, '#8b5ce0'); top.addColorStop(1, 'rgba(139,92,224,0)');
    ctx.fillStyle = top; ctx.fillRect(s.x + 5, s.y - 6, s.w - 10, 14);
    ctx.strokeStyle = '#0b0614'; ctx.lineWidth = 3; rr(ctx, s.x, s.y, s.w, s.h, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(127,227,255,.45)';
    for (let i = 0; i < s.w - 28; i += 44) ctx.fillRect(s.x + 14 + i, s.y + 3, 4, 3);
  }
  // chasm spikes + glow
  ctx.fillStyle = '#2a1830';
  for (let x = 206; x < 396; x += 26) {
    ctx.beginPath(); ctx.moveTo(x, 900); ctx.lineTo(x + 13, 800); ctx.lineTo(x + 26, 900); ctx.closePath(); ctx.fill();
  }
  const gl = ctx.createLinearGradient(0, 740, 0, 900);
  gl.addColorStop(0, 'rgba(140,20,60,0)'); gl.addColorStop(1, 'rgba(210,20,84,.5)');
  ctx.fillStyle = gl; ctx.fillRect(200, 740, 200, 160);
}

function drawRelic(ctx) {
  const y = RELIC.y + Math.sin(t * 3.2) * 6;
  const gl = ctx.createRadialGradient(RELIC.x, y, 0, RELIC.x, y, 74);
  gl.addColorStop(0, 'rgba(255,211,77,.5)'); gl.addColorStop(1, 'rgba(255,211,77,0)');
  ctx.fillStyle = gl; ctx.fillRect(RELIC.x - 74, y - 74, 148, 148);
  ctx.save(); ctx.translate(RELIC.x, y); ctx.rotate(t * 1.5);
  starPath(ctx, 0, 0, 23, 0); ctx.fillStyle = '#ffd34d'; ctx.fill();
  ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(RELIC.x, y, 34 + Math.sin(t * 4) * 4, 0, TAU); ctx.stroke();
  g.text('RELIC', RELIC.x, y - 48, { size: 22, align: 'center', color: '#ffd34d' });
}

function drawEmbers(ctx) {
  for (const e of embers) {
    if (e.got) continue;
    const y = e.y + Math.sin(e.ph) * 5;
    const gl = ctx.createRadialGradient(e.x, y, 0, e.x, y, 28);
    gl.addColorStop(0, 'rgba(127,227,255,.8)'); gl.addColorStop(1, 'rgba(127,227,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(e.x - 28, y - 28, 56, 56);
    starPath(ctx, e.x, y, 9, e.ph * .6); ctx.fillStyle = '#cbf6ff'; ctx.fill();
  }
}

function drawMotes(ctx) {
  ctx.fillStyle = 'rgba(184,152,255,.6)';
  for (const m of MOTES) {
    const x = m.x - camX * .6 + Math.sin(t * .6 + m.p) * 16;
    if (x < camX - 30 || x > camX + W + 30) continue;
    const y = m.y + Math.sin(t * .9 + m.p) * 10;
    ctx.globalAlpha = .2 + .35 * Math.abs(Math.sin(t + m.p));
    ctx.beginPath(); ctx.arc(x, y, m.s, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHero(ctx) {
  if (p.dead) return;
  if (p.dashT > 0) {
    ctx.fillStyle = 'rgba(127,227,255,.30)';
    for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(p.x - p.dir * i * 17, p.y - 24, 14 - i * 3, 21 - i * 4, 0, 0, TAU); ctx.fill(); }
  }
  squish(ctx, p.x, p.y, 1 / p.sq, p.sq, 0, () => {
    drawChar('cat', ctx, 0, 0, CH, { dir: p.dir, t, anim: p.anim, color: '#ff9a3c' });
  });
  if (p.dashT > 0) {
    ctx.strokeStyle = 'rgba(191,244,255,.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 26, 26, 34, 0, 0, TAU); ctx.stroke();
  }
}

function drawDoor(ctx) {
  const x = DOORX;
  ctx.fillStyle = '#140c1d'; ctx.fillRect(x - 9, DOORTOP - 18, DOORW + 18, FLOOR - DOORTOP + 20);
  const sy = doorOpen ? doorY : DOORTOP;
  const gd = ctx.createLinearGradient(x, sy, x + DOORW, sy);
  gd.addColorStop(0, doorOpen ? '#2a3a48' : '#5a2532');
  gd.addColorStop(.5, doorOpen ? '#7d9cb6' : '#b23a4e');
  gd.addColorStop(1, doorOpen ? '#22303c' : '#3d1a24');
  ctx.fillStyle = gd; ctx.fillRect(x, sy, DOORW, FLOOR - DOORTOP);
  ctx.strokeStyle = '#0b0614'; ctx.lineWidth = 3; ctx.strokeRect(x, sy, DOORW, FLOOR - DOORTOP);
  if (!doorOpen) {
    const pulse = .5 + .5 * Math.sin(t * 5);
    ctx.strokeStyle = `rgba(255,110,140,${.45 + pulse * .5})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x + DOORW / 2, sy + 50, 11, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + DOORW / 2, sy + 50); ctx.lineTo(x + DOORW / 2, sy + 72); ctx.stroke();
    g.text('LOCKED', x + DOORW / 2, DOORTOP - 32, { size: 23, align: 'center', color: '#ff8098' });
  } else {
    const gl = ctx.createLinearGradient(x, 0, x + DOORW, 0);
    gl.addColorStop(0, 'rgba(127,227,255,.5)'); gl.addColorStop(.5, 'rgba(255,255,255,.2)'); gl.addColorStop(1, 'rgba(127,227,255,.5)');
    ctx.fillStyle = gl; ctx.fillRect(x, DOORTOP, DOORW, FLOOR - DOORTOP);
  }
}

function drawPortal(ctx) {
  const pulse = 1 + Math.sin(t * 4) * .06;
  const gl = ctx.createRadialGradient(PORTAL.x, PORTAL.y + 60, 0, PORTAL.x, PORTAL.y + 60, 155);
  gl.addColorStop(0, 'rgba(127,227,255,.5)'); gl.addColorStop(1, 'rgba(127,227,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(PORTAL.x - 155, PORTAL.y - 95, 310, 310);
  ctx.save(); ctx.translate(PORTAL.x, PORTAL.y + 60); ctx.scale(pulse, pulse);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = ['#7fe3ff', '#cbf6ff', '#4aa8ff'][i]; ctx.lineWidth = 6 - i * 1.6;
    ctx.beginPath(); ctx.ellipse(0, 0, 52 - i * 12, 70 - i * 14, t * (.6 + i * .4), 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(210,248,255,.55)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 42, 0, 0, TAU); ctx.fill();
  ctx.restore();
  const arrowY = PORTAL.y + 150 + Math.sin(t * 5) * 5;
  ctx.fillStyle = relic ? '#ffd34d' : 'rgba(255,211,77,.4)';
  ctx.beginPath(); ctx.moveTo(PORTAL.x - 14, arrowY - 12); ctx.lineTo(PORTAL.x + 14, arrowY - 12); ctx.lineTo(PORTAL.x, arrowY + 10); ctx.closePath(); ctx.fill();
  g.text('EXIT', PORTAL.x, PORTAL.y - 34, { size: 26, align: 'center', color: '#cbf6ff' });
}

function drawHud(ctx) {
  g.text('SCORE', 26, 62, { size: 22, color: '#8ea0d0' });
  g.text(Math.round(score).toLocaleString(), 26, 106, { size: 56, color: '#fff' });

  const rx = W - 46;
  ctx.globalAlpha = relic ? 1 : .28;
  starPath(ctx, rx, 62, 18, 0); ctx.fillStyle = relic ? '#ffd34d' : '#6b6b86'; ctx.fill();
  ctx.strokeStyle = '#0b0614'; ctx.lineWidth = 3; ctx.stroke();
  ctx.globalAlpha = 1;
  g.text(relic ? 'RELIC' : 'LOCKED', W - 26, 108, { size: 20, align: 'right', color: relic ? '#ffd34d' : '#6f7390' });

  const barW = W - 52, frac = clamp(roomT / roomMax[roomPrev], 0, 1);
  ctx.fillStyle = 'rgba(8,6,18,.62)'; rr(ctx, 26, 124, barW, 16, 8); ctx.fill();
  const bc = frac > .45 ? '#7fe3ff' : frac > .22 ? '#ffb300' : '#ff3b5c';
  ctx.fillStyle = bc; rr(ctx, 26, 124, Math.max(5, barW * frac), 16, 8); ctx.fill();
  g.text('COLLAPSE', 26, 120, { size: 18, color: '#a9b6e0' });
  g.text(roomT.toFixed(1), 26 + barW, 120, { size: 18, align: 'right', color: frac < .22 ? '#ff3b5c' : '#c9d3f0' });

  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < roomPrev ? '#7fe3ff' : i === roomPrev ? '#ffd34d' : 'rgba(255,255,255,.16)';
    rr(ctx, 26 + i * 52, 174, 42, 10, 5); ctx.fill();
  }
  g.text(`CHAMBER ${roomPrev + 1}/3`, 26 + 3 * 52 + 12, 184, { size: 18, color: '#c9d3f0' });

  const py = 206, pw = W - 52;
  ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, 26, py, pw, 8, 4); ctx.fill();
  ctx.fillStyle = '#7fe3ff'; rr(ctx, 26, py, Math.max(6, pw * prog), 8, 4); ctx.fill();
  ctx.save(); ctx.translate(26 + pw - 4, py + 4); ctx.rotate(.78); starPath(ctx, 0, 0, 11, 0); ctx.fillStyle = '#ffd34d'; ctx.fill(); ctx.restore();
  rr(ctx, 20 + pw * prog, py - 5, 12, 18, 4); ctx.fillStyle = '#ff9a3c'; ctx.fill();
  ctx.strokeStyle = '#0b0614'; ctx.lineWidth = 2; ctx.stroke();

  const msg = relic ? 'THE VAULT IS OPEN — REACH THE EXIT →' : 'CLIMB THE STAIRS FOR THE RELIC';
  ctx.fillStyle = relic ? 'rgba(127,227,255,.16)' : 'rgba(255,211,77,.14)';
  rr(ctx, W / 2 - 158, 224, 316, 30, 15); ctx.fill();
  g.text(msg, W / 2, 246, { size: 19, align: 'center', color: relic ? '#cbf6ff' : '#ffd34d' });

  if (warn > 0) {
    const a = warn * .42;
    const vg = ctx.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, `rgba(255,40,70,${a})`); vg.addColorStop(.32, 'rgba(255,40,70,0)'); vg.addColorStop(1, `rgba(255,40,70,${a * .85})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (warn > .5) g.text('THE CAVE IS FALLING', W / 2, 318, { size: 30, align: 'center', color: '#ff96a6' });
  }
  if (banner > 0) {
    ctx.globalAlpha = Math.min(1, banner);
    g.text('RUN RIGHT · BEAT THE COLLAPSE', W / 2, 340, { size: 26, align: 'center', color: '#ffd34d' });
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ boot */
resetWorld();
g.onReset = () => resetWorld();
g.onStart = () => { music('chase'); };
music('chase');

g.run(dt => { update(dt); }, draw);