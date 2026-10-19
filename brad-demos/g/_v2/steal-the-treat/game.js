// STEAL THE TREAT v1 — cat-burglar steal/defend/chase on the gp2x juice engine
// Sneak into rival houses, grab treats, outrun the homeowner, bank treats at home.
// Spend banked score on traps (slow the chaser) and locked doors (shrink sight radius).
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, R, TAU, rr, heartPath } from '../_vendor/gp2x.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'steal-the-treat', title: 'STEAL THE TREAT',
  sub: 'v1 · SNEAK · GRAB · DASH HOME · 3 LIVES',
  hook: 'steal their treats. don\'t get caught.',
  w: W, h: H, bg: '#0a0e22', style: 'toon',
  bloom: .6, ca: .35, vig: 1, scan: .2,
});

/* ================= tuning ================= */
const CFG = {
  playerSpeed: 265, dashSpeed: 580, dashTime: .18, dashCD: 1.2,
  patrolSpeed: 115, chaseSpeed: 305, trappedChase: 195,
  sightR: 175, doorSightR: 115, catchR: 28, grazeR: 88,
  grabCD: .32, giveUpR: 430, giveUpT: 2.0,
  trapCost: 50, doorCost: 80, trapTime: 8,
  bankPts: 10, grazePts: 15,
};
const P = new URLSearchParams(location.search);
const isAuto = P.has('auto');
const spectate = P.has('spectate') || P.has('autostart');
const BOT = isAuto || spectate;
if (spectate && !isAuto) setTimeout(() => { if (g.mode === 'title') g.start(); }, 700);

/* ================= suburb ================= */
const HOME = { x: W / 2, y: 872, w: 150, h: 110, color: '#3d5a99', roof: '#26355e' };
const HOUSES = [
  { x: 96,  y: 300, w: 132, h: 100, color: '#8a5a3d', roof: '#5e3a26', treats: 5, maxTreats: 5, owner: { color: '#e08a3c', ang: 0 }, name: 'MAPLE ST' },
  { x: 270, y: 218, w: 132, h: 100, color: '#5a7d4a', roof: '#3a522e', treats: 5, maxTreats: 5, owner: { color: '#b9c2cc', ang: 2.1 }, name: 'OAK AVE' },
  { x: 444, y: 300, w: 132, h: 100, color: '#7d4a6e', roof: '#522e48', treats: 5, maxTreats: 5, owner: { color: '#f2e3c9', ang: 4.2 }, name: 'ELM DR' },
];
const stars = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H * .55, r: rnd(.8, 2), ph: R() * 6, sp: rnd(.5, 1.8) }));

/* ================= state ================= */
let S;
function resetWorld() {
  for (const h of HOUSES) { h.treats = h.maxTreats; h.owner.ang = R() * TAU; h.owner.x = h.x; h.owner.y = h.y; }
  S = {
    px: HOME.x, py: HOME.y - 70, pvx: 0, pvy: 0, dir: 1,
    carried: 0, lives: 3, grabT: 0, dashT: 0, dashCDT: 0, dashVX: 0, dashVY: 0,
    alarm: false, alarmT: 0, chaser: -1, giveUpT: 0, grazeT: 0,
    invuln: 0, trapT: 0, doors: 0, lastTapT: -9,
    botTarget: 0, botPhase: 'raid',
  };
  g.score = 0; g.combo.reset(); g.fx.clear(); g.hud.hint = '';
  g.state = { score: 0, lives: 3, carried: 0 };
}
g.onReset = resetWorld;
g.onStart = () => { music('chase'); };
resetWorld();

/* ================= actions ================= */
function grabTreat(h, hi) {
  if (S.grabT > 0 || h.treats <= 0) return;
  S.grabT = CFG.grabCD;
  h.treats--; S.carried++;
  const tx = h.x + rnd(-24, 24), ty = h.y + h.h / 2 + 26;
  g.combo.hit(tx, ty - 30, `+1 TREAT`);
  sfx('coin', { pitch: comboPitch(g.combo.n % 12) });
  g.fx.burst(tx, ty, 8, { kind: 'spark', colors: ['#ffd34d', '#fff2b0'] });
  g.state.carried = S.carried;
}

function triggerAlarm(hi) {
  if (S.alarm) return;
  S.alarm = true; S.alarmT = 0; S.chaser = hi; S.giveUpT = 0; S.grazeT = 0;
  g.showBanner('SPOTTED!', .9);
  g.flash('#ff3b5c', .3); g.shake(10);
  sfx('meow', { pitch: 1.3 }); sfx('charge', { pitch: .7 });
  music('chase');
  navigator.vibrate?.([40, 40, 40]);
}

function bankTreats() {
  if (S.carried <= 0) return;
  const pts = Math.round(S.carried * CFG.bankPts * g.combo.mult);
  g.score += pts;
  g.combo.hit(HOME.x, HOME.y - 90, `BANKED +${pts}`);
  sfx('win', { pitch: 1.15, vol: .6 });
  g.fx.burst(HOME.x, HOME.y - 60, 22, { kind: 'confetti', colors: ['#ffd34d', '#7df9ff', '#ffffff'] });
  g.fx.emit('ring', HOME.x, HOME.y - 40, { life: .5, size: 70, color: '#ffd34d', add: true });
  g.punch(.05);
  S.carried = 0; g.state.carried = 0; g.state.score = Math.round(g.score);
  if (S.alarm) { S.alarm = false; S.chaser = -1; music('action'); }
}

function caught() {
  S.lives--; S.carried = 0; S.invuln = 2;
  g.combo.miss();
  g.state.lives = S.lives; g.state.carried = 0;
  S.px = HOME.x; S.py = HOME.y - 70; S.pvx = S.pvy = 0;
  S.alarm = false; S.chaser = -1;
  g.impact(S.px, S.py, { punch: .12, shake: 24, stop: .14, flash: '#ff3b5c', flashA: .4, rip: 2, sfx: 'boom' });
  g.fx.burst(S.px, S.py, 20, { kind: 'debris', colors: ['#3a3f5c', '#ff3b5c', '#ffffff'] });
  g.showBanner(S.lives > 0 ? 'CAUGHT!' : 'BUSTED!', 1.1);
  sfx('thud'); sfx('lose', { vol: .5 });
  navigator.vibrate?.([30, 50, 40]);
  music('action');
  if (S.lives <= 0) g.end({ win: false, score: Math.round(g.score), label: 'TREATS BANKED' });
}

function buyTrap() {
  if (g.score < CFG.trapCost || S.trapT > 0) { sfx('click', { pitch: .7 }); return; }
  g.score -= CFG.trapCost; S.trapT = CFG.trapTime;
  g.showBanner('TRAP SET!', .7); sfx('powerup', { pitch: 1.2 });
  g.fx.burst(S.px, S.py - 30, 14, { kind: 'spark', colors: ['#7df9ff', '#ffffff'] });
}
function buyDoor() {
  if (g.score < CFG.doorCost) { sfx('click', { pitch: .7 }); return; }
  g.score -= CFG.doorCost; S.doors++;
  g.showBanner('LOCKED DOORS!', .7); sfx('unlock', { pitch: 1.1 });
}

function dash(dx, dy) {
  if (S.dashCDT > 0) return;
  const m = Math.hypot(dx, dy) || 1;
  S.dashT = CFG.dashTime; S.dashCDT = CFG.dashCD;
  S.dashVX = dx / m * CFG.dashSpeed; S.dashVY = dy / m * CFG.dashSpeed;
  sfx('whoosh', { pitch: 1.2 });
  g.fx.burst(S.px, S.py - 20, 8, { kind: 'smoke', color: 'rgba(200,220,255,.5)' });
}

/* ================= bot (filmable auto-play) ================= */
function botThink() {
  // pick target house with treats
  let tgt = null, bd = 1e9;
  for (const h of HOUSES) {
    if (h.treats <= 0) continue;
    const d = Math.hypot(h.x - S.px, (h.y + 40) - S.py);
    if (d < bd) { bd = d; tgt = h; }
  }
  S.botMove = null; S.botDash = false;
  if (S.alarm) {
    // run home, dash when chaser close
    S.botMove = { x: HOME.x, y: HOME.y - 70 };
    const o = HOUSES[S.chaser].owner;
    if (Math.hypot(o.x - S.px, o.y - S.py) < 150) S.botDash = true;
    return;
  }
  if (S.carried >= 5 || !tgt) {
    S.botMove = { x: HOME.x, y: HOME.y - 70 };
    return;
  }
  S.botMove = { x: tgt.x + rnd(-8, 8), y: tgt.y + 44 };
  if (g.score >= CFG.trapCost && S.trapT <= 0 && chance(.02)) buyTrap();
}

/* ================= update ================= */
function update(dt) {
  if (g.mode !== 'play') return;
  if (BOT) botThink();
  if (S.invuln > 0) S.invuln -= dt;
  if (S.grabT > 0) S.grabT -= dt;
  if (S.dashCDT > 0) S.dashCDT -= dt;
  if (S.trapT > 0) S.trapT -= dt;

  /* --- player movement --- */
  let mx = 0, my = 0;
  if (g.keys['ArrowLeft'] || g.keys['KeyA']) mx -= 1;
  if (g.keys['ArrowRight'] || g.keys['KeyD']) mx += 1;
  if (g.keys['ArrowUp'] || g.keys['KeyW']) my -= 1;
  if (g.keys['ArrowDown'] || g.keys['KeyS']) my += 1;
  if (BOT && S.botMove) {
    const dx = S.botMove.x - S.px, dy = S.botMove.y - S.py, d = Math.hypot(dx, dy);
    if (d > 12) { mx = dx / d; my = dy / d; }
  } else if (g.ptr.down && !BOT) {
    const dx = g.ptr.x - S.px, dy = g.ptr.y - S.py, d = Math.hypot(dx, dy);
    if (d > 18) { mx = dx / d; my = dy / d; }
  }
  // taps: shop buttons + double-tap dash
  for (const t of g.taps) {
    if (t.x > W - 116 && t.y < 116) { // trap/door buttons zone
      if (t.y < 58) buyTrap(); else buyDoor();
      continue;
    }
    if (!BOT) {
      const now = g.t;
      if (now - S.lastTapT < .35) dash(mx || S.dir, my || -.2);
      S.lastTapT = now;
    }
  }
  if ((g.pressed['Space'] || (BOT && S.botDash)) && (mx || my)) dash(mx, my);
  else if (g.pressed['Space'] && !BOT) dash(S.dir, 0);
  if (g.pressed['Digit1']) buyTrap();
  if (g.pressed['Digit2']) buyDoor();

  const sp = CFG.playerSpeed;
  if (S.dashT > 0) {
    S.dashT -= dt;
    S.px += S.dashVX * dt; S.py += S.dashVY * dt;
    if (chance(dt * 30)) g.fx.emit('glow', S.px, S.py - 20, { vx: rnd(-40, 40), vy: rnd(-20, 20), life: .25, size: rnd(4, 8), color: '#8ef6ff', add: true });
  } else {
    const m = Math.hypot(mx, my) || 1;
    S.px += mx / m * sp * dt * (mx || my ? 1 : 0);
    S.py += my / m * sp * dt * (mx || my ? 1 : 0);
  }
  S.px = clamp(S.px, 24, W - 24); S.py = clamp(S.py, 120, H - 30);
  if (mx) S.dir = mx > 0 ? 1 : -1;

  /* --- grab treats --- */
  for (let hi = 0; hi < HOUSES.length; hi++) {
    const h = HOUSES[hi];
    if (h.treats > 0 && Math.hypot(h.x - S.px, (h.y + 44) - S.py) < 52) grabTreat(h, hi);
  }

  /* --- homeowners --- */
  const sightR = CFG.sightR - S.doors * 22 > CFG.doorSightR ? CFG.sightR - S.doors * 22 : CFG.doorSightR;
  for (let hi = 0; hi < HOUSES.length; hi++) {
    const h = HOUSES[hi], o = h.owner;
    const isChaser = S.alarm && S.chaser === hi;
    if (isChaser) {
      const dx = S.px - o.x, dy = S.py - o.y, d = Math.hypot(dx, dy) || 1;
      const cs = S.trapT > 0 ? CFG.trappedChase : CFG.chaseSpeed;
      o.x += dx / d * cs * dt; o.y += dy / d * cs * dt;
      o.dir = dx > 0 ? 1 : -1;
      // caught?
      if (d < CFG.catchR && S.invuln <= 0) { caught(); break; }
      // graze: close escape bonus
      if (d < CFG.grazeR && S.invuln <= 0) {
        S.grazeT += dt;
        if (S.grazeT > .6) {
          S.grazeT = 0;
          g.score += CFG.grazePts;
          g.combo.hit(S.px, S.py - 50, `CLOSE! +${CFG.grazePts}`);
          sfx('pop', { pitch: 1.3 });
          g.impact(S.px, S.py - 20, { punch: .04, shake: 5, stop: .05, flash: '#7df9ff', flashA: .15 });
        }
      }
      // give up?
      if (d > CFG.giveUpR) { S.giveUpT += dt; if (S.giveUpT > CFG.giveUpT) { S.alarm = false; S.chaser = -1; music('action'); } }
      else S.giveUpT = 0;
    } else {
      // patrol around the house
      o.ang += dt * .55;
      const tx = h.x + Math.cos(o.ang) * 95, ty = h.y + 30 + Math.sin(o.ang) * 55;
      const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy) || 1;
      o.x += dx / d * Math.min(d, CFG.patrolSpeed * dt);
      o.y += dy / d * Math.min(d, CFG.patrolSpeed * dt);
      o.dir = dx > 0 ? 1 : -1;
      // spot the player?
      if (S.invuln <= 0 && Math.hypot(S.px - o.x, S.py - o.y) < sightR) triggerAlarm(hi);
    }
  }
  if (S.alarm) {
    S.alarmT += dt;
    if (chance(dt * 6)) sfx('blip', { pitch: .5, vol: .4 });
  }

  /* --- bank at home --- */
  if (Math.hypot(HOME.x - S.px, (HOME.y - 40) - S.py) < 70) bankTreats();

  /* --- respawn treats slowly so the demo never stalls --- */
  for (const h of HOUSES) if (h.treats < h.maxTreats && chance(dt * .05)) h.treats++;

  g.state.score = Math.round(g.score);
  g.hud.hint = S.carried > 0 ? 'dash home to bank!' : '';

  if (isAuto && (g.score >= 600 || g.t > 60))
    g.end({ win: g.score >= 600, score: Math.round(g.score), label: 'TREATS BANKED' });
}

/* ================= draw ================= */
function drawHouse(ctx, h, isHome, label) {
  const { x, y, w, hh } = { x: h.x, y: h.y, w: h.w, hh: h.h };
  // body
  ctx.fillStyle = h.color; rr(ctx, x - w / 2, y - hh / 2, w, hh, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3; ctx.stroke();
  // roof
  ctx.fillStyle = h.roof;
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 12, y - hh / 2); ctx.lineTo(x, y - hh / 2 - 44); ctx.lineTo(x + w / 2 + 12, y - hh / 2); ctx.closePath(); ctx.fill();
  // lit window
  const tw = .5 + .5 * Math.sin(g.t * 2 + x);
  ctx.fillStyle = `rgba(255,214,120,${.75 + .25 * tw})`;
  rr(ctx, x - w / 2 + 14, y - hh / 2 + 16, 30, 26, 4); ctx.fill();
  rr(ctx, x + w / 2 - 44, y - hh / 2 + 16, 30, 26, 4); ctx.fill();
  // door
  ctx.fillStyle = '#2a2138'; rr(ctx, x - 14, y + hh / 2 - 44, 28, 44, 6); ctx.fill();
  if (label) g.text(label, x, y + hh / 2 + 22, { size: 13, color: 'rgba(200,215,240,.55)', align: 'center' });
}

function drawTreatPile(ctx, h) {
  if (h.treats <= 0) return;
  const bx = h.x, by = h.y + h.h / 2 + 30;
  for (let i = 0; i < h.treats; i++) {
    const a = (i / h.treats) * TAU + g.t * .6;
    const fx = bx + Math.cos(a) * 20, fy = by + Math.sin(a) * 8 - 6;
    const bob = Math.sin(g.t * 3 + i) * 2;
    ctx.save(); ctx.translate(fx, fy + bob);
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 5.5, -.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-14, -6); ctx.lineTo(-14, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(2, -1.5, 1.8, 0, TAU); ctx.fill();
    ctx.restore();
  }
  g.text(String(h.treats), bx, by + 26, { size: 16, color: '#ffd34d', align: 'center', stroke: 3 });
}

function draw(ctx) {
  // night sky
  g.sky(ctx, ['#060818', '#10143a', '#1c1a4e', '#2a1f5e'], { glow: 'rgba(90,110,220,.25)', gx: .8, gy: .18, gr: .5 });
  for (const s of stars) {
    const tw = .3 + .7 * Math.abs(Math.sin(g.t * s.sp + s.ph));
    ctx.fillStyle = `rgba(220,230,255,${tw})`;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  // moon
  ctx.fillStyle = '#f4ead0'; ctx.beginPath(); ctx.arc(452, 96, 34, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(200,190,160,.5)'; ctx.beginPath(); ctx.arc(442, 88, 8, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(460, 104, 5, 0, TAU); ctx.fill();

  // street
  ctx.fillStyle = '#1a1e33'; ctx.fillRect(0, 560, W, 120);
  ctx.fillStyle = 'rgba(255,214,120,.35)';
  for (let x = 20; x < W; x += 60) ctx.fillRect(x, 616, 30, 6);

  // lawns
  ctx.fillStyle = '#14241c'; ctx.fillRect(0, 680, W, 120);

  // houses
  for (const h of HOUSES) { drawHouse(ctx, h); drawTreatPile(ctx, h); }
  drawHouse(ctx, { ...HOME, x: HOME.x, y: HOME.y }, true);
  g.text('HOME', HOME.x, HOME.y + HOME.h / 2 + 24, { size: 15, color: '#8ef6ff', align: 'center', stroke: 3 });
  // home doormat glow
  const hg = .4 + .3 * Math.sin(g.t * 3);
  ctx.fillStyle = `rgba(142,246,255,${hg * (S.carried > 0 ? 1 : .4)})`;
  rr(ctx, HOME.x - 34, HOME.y + 18, 68, 22, 6); ctx.fill();

  // homeowners
  for (let hi = 0; hi < HOUSES.length; hi++) {
    const h = HOUSES[hi], o = h.owner;
    const isChaser = S.alarm && S.chaser === hi;
    // spotlight cone when chasing
    if (isChaser) {
      const a = Math.atan2(S.py - o.y, S.px - o.x);
      ctx.save(); ctx.translate(o.x, o.y - 30); ctx.rotate(a);
      const grd = ctx.createLinearGradient(0, 0, 260, 0);
      grd.addColorStop(0, 'rgba(255,230,140,.5)'); grd.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(260, -70); ctx.lineTo(260, 70); ctx.closePath(); ctx.fill();
      ctx.restore();
      // alarm ring
      ctx.strokeStyle = `rgba(255,59,92,${.5 + .4 * Math.sin(g.t * 10)})`;
      ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(o.x, o.y - 30, 34 + 4 * Math.sin(g.t * 10), 0, TAU); ctx.stroke();
    }
    if (S.trapT > 0 && isChaser) { // slowed tint
      ctx.fillStyle = 'rgba(125,249,255,.35)';
      ctx.beginPath(); ctx.arc(o.x, o.y - 30, 30, 0, TAU); ctx.fill();
    }
    g.hero(ctx, 'cat', o.x, o.y, 62, { dir: o.dir || 1, color: o.color, anim: isChaser ? 'run' : 'idle' });
    if (isChaser) g.text('!', o.x, o.y - 78, { size: 34, color: '#ff3b5c', align: 'center', stroke: 5 });
  }

  // player (blink while invulnerable)
  if (S.invuln <= 0 || Math.sin(g.t * 20) > 0) {
    if (S.carried > 0) { // treat sack glow
      ctx.fillStyle = 'rgba(255,211,77,.3)';
      ctx.beginPath(); ctx.arc(S.px, S.py - 34, 26, 0, TAU); ctx.fill();
    }
    g.hero(ctx, 'cat', S.px, S.py, 64, { dir: S.dir, color: '#3a3f5c', anim: 'run' });
    // carried treats above head
    for (let i = 0; i < Math.min(S.carried, 8); i++) {
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.ellipse(S.px - 20 + i * 6, S.py - 74, 5, 3.2, -.4, 0, TAU); ctx.fill();
    }
  }

  // dash cooldown pip
  if (S.dashCDT > 0) {
    ctx.fillStyle = 'rgba(140,160,200,.5)';
    rr(ctx, S.px - 20, S.py + 6, 40 * (1 - S.dashCDT / CFG.dashCD), 5, 2); ctx.fill();
  }

  // alarm edge flash
  if (S.alarm) {
    const a = .18 + .12 * Math.sin(g.t * 9);
    const eg = ctx.createLinearGradient(0, 0, 0, 90);
    eg.addColorStop(0, `rgba(255,59,92,${a})`); eg.addColorStop(1, 'rgba(255,59,92,0)');
    ctx.fillStyle = eg; ctx.fillRect(0, 0, W, 90);
    const eg2 = ctx.createLinearGradient(0, H, 0, H - 90);
    eg2.addColorStop(0, `rgba(255,59,92,${a})`); eg2.addColorStop(1, 'rgba(255,59,92,0)');
    ctx.fillStyle = eg2; ctx.fillRect(0, H - 90, W, 90);
  }

  // title-screen art behind the engine overlay
  if (g.mode === 'title') {
    g.hero(ctx, 'cat', W / 2 - 60, H * .72, 84, { dir: 1, color: '#3a3f5c', anim: 'idle' });
    g.hero(ctx, 'cat', W / 2 + 60, H * .72, 84, { dir: -1, color: '#e08a3c', anim: 'idle' });
  }
}

function hud(ctx) {
  // score
  g.text('TREATS', 24, 44, { size: 18, color: '#8ef6ff', stroke: 3 });
  g.text(String(Math.round(g.score)), 24, 92, { size: 52, color: '#fff' });
  // carried
  if (S.carried > 0) g.text(`+${S.carried} carrying`, 24, 126, { size: 20, color: '#ffd34d', stroke: 3 });
  // lives
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.translate(W - 40 - i * 44, 52);
    if (i < S.lives) { ctx.fillStyle = '#ff5c7a'; } else { ctx.fillStyle = 'rgba(120,130,160,.3)'; }
    heartPath(ctx, 0, 0, 30); ctx.fill();
    ctx.restore();
  }
  // shop buttons (top-right, below hearts)
  const by1 = 84, by2 = 140;
  const canTrap = g.score >= CFG.trapCost && S.trapT <= 0;
  const canDoor = g.score >= CFG.doorCost;
  ctx.fillStyle = canTrap ? 'rgba(125,249,255,.25)' : 'rgba(120,130,160,.15)';
  rr(ctx, W - 116, by1, 104, 46, 10); ctx.fill();
  ctx.strokeStyle = canTrap ? '#7df9ff' : 'rgba(140,150,170,.4)'; ctx.lineWidth = 2; ctx.stroke();
  g.text(`TRAP ${CFG.trapCost}`, W - 64, by1 + 30, { size: 17, color: canTrap ? '#7df9ff' : '#8a93a8', align: 'center' });
  ctx.fillStyle = canDoor ? 'rgba(255,211,77,.22)' : 'rgba(120,130,160,.15)';
  rr(ctx, W - 116, by2, 104, 46, 10); ctx.fill();
  ctx.strokeStyle = canDoor ? '#ffd34d' : 'rgba(140,150,170,.4)'; ctx.lineWidth = 2; ctx.stroke();
  g.text(`DOOR ${CFG.doorCost}`, W - 64, by2 + 30, { size: 17, color: canDoor ? '#ffd34d' : '#8a93a8', align: 'center' });
  if (S.trapT > 0) g.text(`trap ${S.trapT.toFixed(0)}s`, W - 64, by1 + 62, { size: 14, color: '#7df9ff', align: 'center' });
  if (S.doors > 0) g.text(`doors x${S.doors}`, W - 64, by2 + 62, { size: 14, color: '#ffd34d', align: 'center' });
  // combo
  g.combo.draw(ctx);
  // fever border handled by engine shell
}

window.__g = g;
window.__dbg = () => ({ score: Math.round(g.score), lives: S.lives, carried: S.carried, alarm: S.alarm, px: Math.round(S.px), py: Math.round(S.py) });
g.run(update, draw, hud);
