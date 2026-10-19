// STEAL THE TREAT — HALLOWEEN NIGHT EDITION (gamepress youtube visual showcase)
// Same steal/defend/chase mechanics as the original; this file is a VISUAL pass only:
// haunted neighborhood reskin, moonlight shadows, jack-o'-lantern glow, fog, bats,
// falling leaves, volumetric chase spotlight, alarm chromatic pulse. 540x960.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, R, TAU, rr, heartPath } from '../_vendor/gp2x.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'steal-the-treat-halloween', title: 'STEAL THE TREAT',
  sub: 'HALLOWEEN NIGHT · SNEAK · GRAB · DASH HOME · 3 LIVES',
  hook: 'steal their candy. don\'t get caught.',
  w: W, h: H, bg: '#04050d', style: 'toon',
  bloom: .85, ca: .45, vig: 1.1, scan: .15,
});
if (g.post) g.post.grain = .06; // film grain for the haunted vibe

/* ================= tuning (IDENTICAL to original — do not touch) ================= */
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

/* ================= haunted suburb (positions/sizes identical to original) ================= */
const HOME = { x: W / 2, y: 872, w: 150, h: 110, color: '#2b2340', roof: '#191225' };
const HOUSES = [
  { x: 96,  y: 300, w: 132, h: 100, color: '#4a2f2e', roof: '#2a1a16', treats: 5, maxTreats: 5, owner: { kind: 'zombie', color: '#7fae4f', ang: 0 }, name: 'HAUNTED HOLLOW' },
  { x: 270, y: 218, w: 132, h: 100, color: '#33304a', roof: '#1c1a2e', treats: 5, maxTreats: 5, owner: { kind: 'vampire', color: '#e9e6f0', ang: 2.1 }, name: 'WITCH WAY' },
  { x: 444, y: 300, w: 132, h: 100, color: '#3d2a45', roof: '#241a2e', treats: 5, maxTreats: 5, owner: { kind: 'reaper', color: '#161320', ang: 4.2 }, name: 'GHOUL RD' },
];
const stars = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H * .55, r: rnd(.8, 2), ph: R() * 6, sp: rnd(.5, 1.8) }));

/* --- twisted-tree branch skeletons (precomputed once, swayed at draw time) --- */
function makeTreeSegs(s) {
  const segs = [];
  const grow = (x, y, a, len, w, depth) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    segs.push([x, y, x2, y2, w]);
    if (depth <= 0) return;
    const n = 2 + (rnd() < .5 ? 1 : 0);
    for (let i = 0; i < n; i++) grow(x2, y2, a + rnd(-.7, .7) + (i - (n - 1) / 2) * .5, len * rnd(.55, .75), w * .65, depth - 1);
  };
  grow(0, 0, -Math.PI / 2, 46 * s, 9 * s, 3);
  return segs;
}
const TREES = [
  { x: 40, y: 470, s: 1.1, segs: null, ph: 0 },
  { x: 500, y: 480, s: .9, segs: null, ph: 2 },
  { x: 270, y: 130, s: 1.25, segs: null, ph: 4 },
  { x: 150, y: 700, s: .8, segs: null, ph: 1 },
  { x: 420, y: 730, s: .85, segs: null, ph: 3 },
];
for (const t of TREES) t.segs = makeTreeSegs(t.s);
const clouds = Array.from({ length: 5 }, () => ({ x: R() * W, y: rnd(30, 200), s: rnd(50, 110), v: rnd(6, 14), a: rnd(.5, .85) }));
const bats = []; // {x,y,vx,ph,s} spawned by ambient
const tombstones = [
  { x: 60, y: 745, r: -.06 }, { x: 120, y: 762, r: .08 }, { x: 480, y: 748, r: -.1 }, { x: 410, y: 770, r: .05 },
];

/* ================= state (IDENTICAL to original) ================= */
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
  bats.length = 0;
}
g.onReset = resetWorld;
g.onStart = () => { music('chase'); };
resetWorld();

/* ================= actions (mechanics IDENTICAL — only candy theming on text/colors) ================= */
function grabTreat(h, hi) {
  if (S.grabT > 0 || h.treats <= 0) return;
  S.grabT = CFG.grabCD;
  h.treats--; S.carried++;
  const tx = h.x + rnd(-24, 24), ty = h.y + h.h / 2 + 26;
  g.combo.hit(tx, ty - 30, `+1 CANDY`);
  sfx('coin', { pitch: comboPitch(g.combo.n % 12) });
  g.fx.burst(tx, ty, 10, { kind: 'spark', colors: ['#ff9a3c', '#fff2b0', '#7b2ff7'] });
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
  g.combo.hit(HOME.x, HOME.y - 90, `STASHED +${pts}`);
  sfx('win', { pitch: 1.15, vol: .6 });
  g.fx.burst(HOME.x, HOME.y - 60, 24, { kind: 'confetti', colors: ['#ff9a3c', '#7b2ff7', '#fff2b0'] });
  g.fx.emit('ring', HOME.x, HOME.y - 40, { life: .5, size: 70, color: '#ff9a3c', add: true });
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
  g.fx.burst(S.px, S.py, 20, { kind: 'debris', colors: ['#2b2340', '#ff3b5c', '#ff9a3c'] });
  g.showBanner(S.lives > 0 ? 'CAUGHT!' : 'BUSTED!', 1.1);
  sfx('thud'); sfx('lose', { vol: .5 });
  navigator.vibrate?.([30, 50, 40]);
  music('action');
  if (S.lives <= 0) g.end({ win: false, score: Math.round(g.score), label: 'CANDY STASHED' });
}

function buyTrap() {
  if (g.score < CFG.trapCost || S.trapT > 0) { sfx('click', { pitch: .7 }); return; }
  g.score -= CFG.trapCost; S.trapT = CFG.trapTime;
  g.showBanner('TRAP SET!', .7); sfx('powerup', { pitch: 1.2 });
  g.fx.burst(S.px, S.py - 30, 14, { kind: 'spark', colors: ['#b45cff', '#ffffff'] });
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
  g.fx.burst(S.px, S.py - 20, 8, { kind: 'smoke', color: 'rgba(178,120,255,.45)' });
}

/* ================= bot (IDENTICAL to original) ================= */
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

/* ================= halloween ambience (VISUAL ONLY — no gameplay effect) ================= */
function ambient(dt) {
  // drifting clouds
  for (const c of clouds) { c.x += c.v * dt; if (c.x - c.s > W) { c.x = -c.s; c.y = rnd(30, 200); } }
  // bat flocks
  if (chance(dt * .5) && bats.length < 14) {
    const n = 3 + Math.floor(rnd() * 4), bx = -40, by = rnd(60, 300), vx = rnd(120, 200);
    for (let i = 0; i < n; i++) bats.push({ x: bx - rnd(0, 90), y: by + rnd(-30, 30), vx: vx * rnd(.9, 1.1), ph: rnd(0, 6), s: rnd(.7, 1.2) });
  }
  for (let i = bats.length - 1; i >= 0; i--) {
    const b = bats[i]; b.x += b.vx * dt; b.ph += dt * 14;
    if (b.x > W + 60) bats.splice(i, 1);
  }
  // falling leaves
  if (chance(dt * 4)) g.fx.emit('feather', rnd(0, W), -10, {
    vx: rnd(-40, 10), vy: rnd(50, 110), g: 12, life: rnd(3, 5.5), size: rnd(4, 8),
    color: ['#b3541e', '#d98e2b', '#8a3b1d', '#c96a26'][Math.floor(rnd() * 4)], rot: rnd(0, 6), vr: rnd(-3, 3),
  });
  // ground fog wisps
  if (chance(dt * 2.2)) g.fx.emit('smoke', rnd(-40, W), rnd(620, 900), {
    vx: rnd(8, 26), vy: rnd(-6, 2), g: 0, life: rnd(4, 7), size: rnd(30, 60),
    color: 'rgba(140,140,190,.10)', drag: .2,
  });
  // pumpkin ember sparks (one emitter per house porch)
  for (const h of HOUSES) {
    if (chance(dt * 1.4)) g.fx.emit('spark', h.x + h.w / 2 - 24 + rnd(-6, 6), h.y + h.h / 2 + 40, {
      vx: rnd(-16, 16), vy: rnd(-46, -18), g: -8, life: rnd(.5, 1.1), size: rnd(2, 4.5),
      color: ['#ff9a3c', '#ffc46b', '#ff6b1a'][Math.floor(rnd() * 3)],
    });
  }
  // alarm: push chromatic aberration for drama (restored when calm)
  if (g.post) g.post.ca = S.alarm ? .45 + .55 * Math.abs(Math.sin(g.t * 9)) : .45;
}

/* ================= update (mechanics IDENTICAL — ambience appended only) ================= */
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
    if (chance(dt * 30)) g.fx.emit('glow', S.px, S.py - 20, { vx: rnd(-40, 40), vy: rnd(-20, 20), life: .25, size: rnd(4, 8), color: '#b45cff', add: true });
  } else {
    const m = Math.hypot(mx, my) || 1;
    S.px += mx / m * sp * dt * (mx || my ? 1 : 0);
    S.py += my / m * sp * dt * (mx || my ? 1 : 0);
  }
  S.px = clamp(S.px, 24, W - 24); S.py = clamp(S.py, 120, H - 30);
  if (mx) S.dir = mx > 0 ? 1 : -1;

  /* --- grab candy --- */
  for (let hi = 0; hi < HOUSES.length; hi++) {
    const h = HOUSES[hi];
    if (h.treats > 0 && Math.hypot(h.x - S.px, (h.y + 44) - S.py) < 52) grabTreat(h, hi);
  }

  /* --- haunted dwellers --- */
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
          g.impact(S.px, S.py - 20, { punch: .04, shake: 5, stop: .05, flash: '#b45cff', flashA: .15 });
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

  /* --- respawn candy slowly so the demo never stalls --- */
  for (const h of HOUSES) if (h.treats < h.maxTreats && chance(dt * .05)) h.treats++;

  g.state.score = Math.round(g.score);
  g.hud.hint = S.carried > 0 ? 'dash home to stash!' : '';

  /* --- halloween ambience (visual only) --- */
  ambient(dt);

  if (isAuto && (g.score >= 600 || g.t > 60))
    g.end({ win: g.score >= 600, score: Math.round(g.score), label: 'CANDY STASHED' });
}

/* ================= draw ================= */
// long moonlight shadow stretching down-left (moon sits upper-right)
function moonShadow(ctx, x, y, w) {
  ctx.save();
  ctx.globalAlpha = .32; ctx.fillStyle = '#000';
  ctx.translate(x - w * .55, y + 4); ctx.rotate(.32); ctx.scale(1.9, .5);
  ctx.beginPath(); ctx.arc(0, 0, w, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawTree(ctx, t) {
  const sway = Math.sin(g.t * .8 + t.ph) * .035;
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(sway);
  ctx.strokeStyle = '#0d0916'; ctx.lineCap = 'round';
  for (const [x1, y1, x2, y2, w] of t.segs) {
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  // hanging silhouettes
  ctx.fillStyle = '#0d0916';
  for (let i = 0; i < 3; i++) {
    const bx = Math.cos(i * 2.4 + t.ph) * 22 * t.s, by = -60 * t.s - i * 22;
    ctx.beginPath(); ctx.ellipse(bx, by, 5 * t.s, 3 * t.s, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  moonShadow(ctx, t.x, t.y, 26 * t.s);
}

function drawJackOLantern(ctx, x, y, s, seed) {
  const flick = .72 + .28 * Math.abs(Math.sin(g.t * 7 + seed) * Math.sin(g.t * 3.1 + seed * 2));
  // glow halo (blooms hard)
  const gr = ctx.createRadialGradient(x, y, 0, x, y, 46 * s);
  gr.addColorStop(0, `rgba(255,150,40,${.55 * flick})`); gr.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 46 * s, 0, TAU); ctx.fill();
  // pumpkin body
  ctx.fillStyle = '#c96a1e';
  ctx.beginPath(); ctx.ellipse(x, y, 22 * s, 18 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#a85416';
  ctx.beginPath(); ctx.ellipse(x - 8 * s, y, 6 * s, 16 * s, .2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 8 * s, y, 6 * s, 16 * s, -.2, 0, TAU); ctx.fill();
  // stem
  ctx.fillStyle = '#4a5d23'; rr(ctx, x - 3 * s, y - 24 * s, 6 * s, 10 * s, 2); ctx.fill();
  // glowing face
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255,220,120,${.95 * flick})`;
  const ey = y - 5 * s;
  ctx.beginPath(); ctx.moveTo(x - 12 * s, ey); ctx.lineTo(x - 4 * s, ey - 8 * s); ctx.lineTo(x - 4 * s, ey); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 12 * s, ey); ctx.lineTo(x + 4 * s, ey - 8 * s); ctx.lineTo(x + 4 * s, ey); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 2.5 * s, ey + 6 * s); ctx.lineTo(x + 2.5 * s, ey + 6 * s); ctx.lineTo(x, ey + 10 * s); ctx.closePath(); ctx.fill();
  // jagged grin
  ctx.beginPath();
  ctx.moveTo(x - 13 * s, ey + 12 * s);
  for (let i = 0; i < 6; i++) ctx.lineTo(x - 13 * s + (i + 1) * (26 * s / 6), ey + 12 * s + (i % 2 ? 5 * s : 0));
  ctx.lineTo(x - 13 * s, ey + 12 * s); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawCandyBowl(ctx, h) {
  if (h.treats <= 0) return;
  const bx = h.x, by = h.y + h.h / 2 + 34;
  // bowl
  ctx.fillStyle = '#1c1430';
  ctx.beginPath(); ctx.ellipse(bx, by + 8, 30, 13, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(178,120,255,.5)'; ctx.lineWidth = 2; ctx.stroke();
  // candy corn pieces
  for (let i = 0; i < h.treats; i++) {
    const a = (i / h.treats) * TAU + g.t * .5;
    const fx = bx + Math.cos(a) * 17, fy = by + Math.sin(a) * 6 - 8 + Math.sin(g.t * 3 + i) * 2;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff2b0'; ctx.fillRect(-5, 1, 10, 4);
    ctx.restore();
  }
  g.text(String(h.treats), bx, by + 32, { size: 16, color: '#ff9a3c', align: 'center', stroke: 3 });
}

function drawHauntedHouse(ctx, h, isHome) {
  const { x, y, w, hh } = { x: h.x, y: h.y, w: h.w, hh: h.h };
  moonShadow(ctx, x, y + hh / 2, w * .5);
  // body
  ctx.fillStyle = h.color; rr(ctx, x - w / 2, y - hh / 2, w, hh, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3; ctx.stroke();
  // crooked roof (tilted, with a bent chimney)
  ctx.fillStyle = h.roof;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 14, y - hh / 2);
  ctx.lineTo(x + 6, y - hh / 2 - 52);
  ctx.lineTo(x + w / 2 + 14, y - hh / 2 - 6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2; ctx.stroke();
  // chimney + smoke
  ctx.fillStyle = '#241a2e'; rr(ctx, x + w / 2 - 34, y - hh / 2 - 62, 16, 30, 3); ctx.fill();
  if (chance(.12)) g.fx.emit('smoke', x + w / 2 - 26, y - hh / 2 - 64, {
    vx: rnd(-12, 12), vy: rnd(-40, -22), g: -6, life: rnd(1.2, 2), size: rnd(8, 14), color: 'rgba(120,110,150,.25)',
  });
  // glowing windows (flickering orange)
  const tw = .5 + .5 * Math.sin(g.t * 9 + x * 1.7);
  const wg = .6 + .4 * tw;
  for (const wx of [x - w / 2 + 14, x + w / 2 - 44]) {
    const wgr = ctx.createRadialGradient(wx + 15, y - hh / 2 + 29, 2, wx + 15, y - hh / 2 + 29, 26);
    wgr.addColorStop(0, `rgba(255,170,60,${.85 * wg})`); wgr.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = wgr; rr(ctx, wx - 6, y - hh / 2 + 10, 42, 38, 4); ctx.fill();
    ctx.fillStyle = `rgba(60,25,10,${.85})`; // mullions
    ctx.fillRect(wx + 13, y - hh / 2 + 16, 4, 26); ctx.fillRect(wx, y - hh / 2 + 27, 30, 4);
  }
  // door
  ctx.fillStyle = '#120c1e'; rr(ctx, x - 14, y + hh / 2 - 44, 28, 44, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(178,120,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
  if (!isHome) {
    g.text(h.name, x, y + hh / 2 + 22, { size: 13, color: 'rgba(216,170,255,.6)', align: 'center' });
    // jack-o'-lantern on the porch
    drawJackOLantern(ctx, x + w / 2 - 24, y + h.h / 2 + 44, 1, x);
    drawCandyBowl(ctx, h);
  } else {
    g.text('HOME', x, y + hh / 2 + 24, { size: 15, color: '#ff9a3c', align: 'center', stroke: 3 });
  }
}

// witch hat for the player cat
function drawWitchHat(ctx, x, y, h, dir) {
  const hx = x + dir * 4, hy = y - h * .92;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(dir * .12);
  // brim
  ctx.fillStyle = '#17122b';
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 8, 0, 0, TAU); ctx.fill();
  // cone
  const cg = ctx.createLinearGradient(0, -44, 0, 0);
  cg.addColorStop(0, '#241a40'); cg.addColorStop(1, '#120d22');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-4, -30, 10, -44); ctx.quadraticCurveTo(2, -26, 14, 0); ctx.closePath(); ctx.fill();
  // band + buckle
  ctx.fillStyle = '#ff9a3c'; ctx.fillRect(-14, -10, 28, 6);
  ctx.fillStyle = '#ffd34d'; ctx.fillRect(-4, -12, 8, 10);
  ctx.restore();
}

function drawBat(ctx, b) {
  const flap = Math.sin(b.ph) * .9;
  ctx.save(); ctx.translate(b.x, b.y + Math.sin(b.ph * .5) * 6); ctx.scale(b.s, b.s);
  ctx.fillStyle = 'rgba(10,8,18,.9)';
  ctx.beginPath(); ctx.ellipse(0, 0, 7, 5, 0, 0, TAU); ctx.fill(); // body
  for (const s of [-1, 1]) { // wings
    ctx.save(); ctx.rotate(s * flap * .8);
    ctx.beginPath();
    ctx.moveTo(s * 5, 0);
    ctx.quadraticCurveTo(s * 22, -14 - flap * 8, s * 34, -2);
    ctx.quadraticCurveTo(s * 24, 2, s * 18, 8);
    ctx.quadraticCurveTo(s * 12, 4, s * 5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function draw(ctx) {
  // haunted night sky
  g.sky(ctx, ['#03040a', '#0b0a24', '#1a1040', '#2a1445'], { glow: 'rgba(150,90,220,.28)', gx: .82, gy: .12, gr: .55 });
  for (const s of stars) {
    const tw = .3 + .7 * Math.abs(Math.sin(g.t * s.sp + s.ph));
    ctx.fillStyle = `rgba(220,210,255,${tw})`;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  // drifting clouds (parallax, cross the moon)
  for (const c of clouds) {
    ctx.fillStyle = `rgba(16,12,34,${c.a})`;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, c.s, c.s * .38, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x + c.s * .5, c.y + 6, c.s * .6, c.s * .3, 0, 0, TAU); ctx.fill();
  }
  // big full moon + halo (blooms)
  const mx = 452, my = 96;
  const mhalo = ctx.createRadialGradient(mx, my, 30, mx, my, 120);
  mhalo.addColorStop(0, 'rgba(235,225,200,.5)'); mhalo.addColorStop(1, 'rgba(235,225,200,0)');
  ctx.fillStyle = mhalo; ctx.beginPath(); ctx.arc(mx, my, 120, 0, TAU); ctx.fill();
  ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.arc(mx, my, 42, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(190,175,150,.55)';
  ctx.beginPath(); ctx.arc(mx - 12, my - 10, 9, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 10, my + 12, 6, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 16, my - 16, 5, 0, TAU); ctx.fill();
  // bats
  for (const b of bats) drawBat(ctx, b);

  // far silhouette treeline
  ctx.fillStyle = '#0a0714';
  ctx.beginPath(); ctx.moveTo(0, 470);
  for (let x = 0; x <= W; x += 30) ctx.lineTo(x, 470 - Math.abs(Math.sin(x * .7)) * 26 - Math.abs(Math.cos(x * .23)) * 18);
  ctx.lineTo(W, 560); ctx.lineTo(0, 560); ctx.closePath(); ctx.fill();
  for (const t of TREES) if (t.y < 600) drawTree(ctx, t);

  // cracked street
  ctx.fillStyle = '#141126'; ctx.fillRect(0, 560, W, 120);
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const cx = 60 + i * 110;
    ctx.beginPath(); ctx.moveTo(cx, 560); ctx.lineTo(cx + 18, 620); ctx.lineTo(cx - 8, 680); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,170,60,.28)';
  for (let x = 20; x < W; x += 60) ctx.fillRect(x, 616, 30, 6); // broken dashes

  // dead lawns + tombstones
  ctx.fillStyle = '#171226'; ctx.fillRect(0, 680, W, 120);
  ctx.fillStyle = 'rgba(90,70,110,.25)';
  for (let i = 0; i < 24; i++) { // dead grass tufts
    const gx = (i * 47) % W, gy = 700 + (i * 31) % 90;
    ctx.fillRect(gx, gy, 3, 7);
  }
  for (const ts of tombstones) {
    ctx.save(); ctx.translate(ts.x, ts.y); ctx.rotate(ts.r);
    ctx.fillStyle = '#2e2a40'; rr(ctx, -14, -34, 28, 36, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(160,150,190,.5)'; ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.fillText('RIP', 0, -12);
    ctx.restore();
    moonShadow(ctx, ts.x, ts.y + 2, 14);
  }
  for (const t of TREES) if (t.y >= 600) drawTree(ctx, t);

  // haunted houses
  for (const h of HOUSES) drawHauntedHouse(ctx, h, false);
  drawHauntedHouse(ctx, { ...HOME, x: HOME.x, y: HOME.y }, true);
  // home jack-o'-lantern + stash glow
  drawJackOLantern(ctx, HOME.x - HOME.w / 2 + 22, HOME.y + HOME.h / 2 + 46, 1.1, 99);
  const hg = .4 + .3 * Math.sin(g.t * 3);
  ctx.fillStyle = `rgba(255,154,60,${hg * (S.carried > 0 ? 1 : .4)})`;
  rr(ctx, HOME.x - 34, HOME.y + 18, 68, 22, 6); ctx.fill();

  // haunted dwellers
  for (let hi = 0; hi < HOUSES.length; hi++) {
    const h = HOUSES[hi], o = h.owner;
    const isChaser = S.alarm && S.chaser === hi;
    // volumetric spotlight: 3 layered cones
    if (isChaser) {
      const a = Math.atan2(S.py - o.y, S.px - o.x);
      ctx.save(); ctx.translate(o.x, o.y - 30); ctx.rotate(a);
      for (const [spread, alpha] of [[110, .16], [80, .28], [48, .45]]) {
        const grd = ctx.createLinearGradient(0, 0, 300, 0);
        grd.addColorStop(0, `rgba(255,190,110,${alpha})`); grd.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(300, -spread); ctx.lineTo(300, spread); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // alarm ring + rotating light rays
      ctx.strokeStyle = `rgba(255,59,92,${.5 + .4 * Math.sin(g.t * 10)})`;
      ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(o.x, o.y - 30, 34 + 4 * Math.sin(g.t * 10), 0, TAU); ctx.stroke();
      ctx.save(); ctx.translate(o.x, o.y - 30); ctx.globalAlpha = .14; ctx.rotate(g.t * 2);
      ctx.fillStyle = '#ff5c7a';
      for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(120, -8); ctx.lineTo(120, 8); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    if (S.trapT > 0 && isChaser) { // slowed tint
      ctx.fillStyle = 'rgba(180,92,255,.35)';
      ctx.beginPath(); ctx.arc(o.x, o.y - 30, 30, 0, TAU); ctx.fill();
    }
    moonShadow(ctx, o.x, o.y, 22);
    g.hero(ctx, o.kind, o.x, o.y, 64, { dir: o.dir || 1, color: o.color, anim: isChaser ? 'run' : 'idle', shadow: false, glow: isChaser ? .35 : 0, glowColor: '#ff5c7a' });
    if (isChaser) g.text('!', o.x, o.y - 80, { size: 36, color: '#ff3b5c', align: 'center', stroke: 5 });
  }

  // player cat in witch hat (blink while invulnerable)
  if (S.invuln <= 0 || Math.sin(g.t * 20) > 0) {
    if (S.carried > 0) { // candy sack glow
      ctx.fillStyle = 'rgba(255,154,60,.3)';
      ctx.beginPath(); ctx.arc(S.px, S.py - 34, 26, 0, TAU); ctx.fill();
    }
    moonShadow(ctx, S.px, S.py, 20);
    g.hero(ctx, 'cat', S.px, S.py, 64, { dir: S.dir, color: '#3a3f5c', anim: 'run', shadow: false });
    drawWitchHat(ctx, S.px, S.py, 64, S.dir);
    // carried candy corn above head
    for (let i = 0; i < Math.min(S.carried, 8); i++) {
      ctx.save(); ctx.translate(S.px - 20 + i * 6, S.py - 76); ctx.rotate(-.3);
      ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff2b0'; ctx.fillRect(-4, 1, 8, 3);
      ctx.restore();
    }
  }

  // dash cooldown pip
  if (S.dashCDT > 0) {
    ctx.fillStyle = 'rgba(255,154,60,.6)';
    rr(ctx, S.px - 20, S.py + 6, 40 * (1 - S.dashCDT / CFG.dashCD), 5, 2); ctx.fill();
  }

  // alarm edge pulse (kept readable — edges only)
  if (S.alarm) {
    const a = .22 + .14 * Math.sin(g.t * 9);
    const eg = ctx.createLinearGradient(0, 0, 0, 90);
    eg.addColorStop(0, `rgba(255,59,92,${a})`); eg.addColorStop(1, 'rgba(255,59,92,0)');
    ctx.fillStyle = eg; ctx.fillRect(0, 0, W, 90);
    const eg2 = ctx.createLinearGradient(0, H, 0, H - 90);
    eg2.addColorStop(0, `rgba(255,59,92,${a})`); eg2.addColorStop(1, 'rgba(255,59,92,0)');
    ctx.fillStyle = eg2; ctx.fillRect(0, H - 90, W, 90);
  }

  // title-screen art behind the engine overlay
  if (g.mode === 'title') {
    drawJackOLantern(ctx, W / 2, H * .62, 2.2, 7);
    g.hero(ctx, 'cat', W / 2 - 110, H * .78, 84, { dir: 1, color: '#3a3f5c', anim: 'idle', shadow: false });
    drawWitchHat(ctx, W / 2 - 110, H * .78, 84, 1);
    g.hero(ctx, 'vampire', W / 2 + 110, H * .78, 84, { dir: -1, color: '#e9e6f0', anim: 'idle', shadow: false });
    g.text('HALLOWEEN NIGHT', W / 2, H * .52, { size: 30, color: '#ff9a3c', align: 'center', stroke: 5 });
  }
}

function hud(ctx) {
  // score
  g.text('CANDY', 24, 44, { size: 18, color: '#ff9a3c', stroke: 3 });
  g.text(String(Math.round(g.score)), 24, 92, { size: 52, color: '#fff' });
  // carried
  if (S.carried > 0) g.text(`+${S.carried} carrying`, 24, 126, { size: 20, color: '#ff9a3c', stroke: 3 });
  // lives (pumpkin-orange hearts)
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.translate(W - 40 - i * 44, 52);
    if (i < S.lives) { ctx.fillStyle = '#ff7a1a'; } else { ctx.fillStyle = 'rgba(120,130,160,.3)'; }
    heartPath(ctx, 0, 0, 30); ctx.fill();
    ctx.restore();
  }
  // shop buttons (top-right, below hearts) — geometry identical to original
  const by1 = 84, by2 = 140;
  const canTrap = g.score >= CFG.trapCost && S.trapT <= 0;
  const canDoor = g.score >= CFG.doorCost;
  ctx.fillStyle = canTrap ? 'rgba(180,92,255,.28)' : 'rgba(120,130,160,.15)';
  rr(ctx, W - 116, by1, 104, 46, 10); ctx.fill();
  ctx.strokeStyle = canTrap ? '#b45cff' : 'rgba(140,150,170,.4)'; ctx.lineWidth = 2; ctx.stroke();
  g.text(`TRAP ${CFG.trapCost}`, W - 64, by1 + 30, { size: 17, color: canTrap ? '#c98aff' : '#8a93a8', align: 'center' });
  ctx.fillStyle = canDoor ? 'rgba(255,154,60,.25)' : 'rgba(120,130,160,.15)';
  rr(ctx, W - 116, by2, 104, 46, 10); ctx.fill();
  ctx.strokeStyle = canDoor ? '#ff9a3c' : 'rgba(140,150,170,.4)'; ctx.lineWidth = 2; ctx.stroke();
  g.text(`DOOR ${CFG.doorCost}`, W - 64, by2 + 30, { size: 17, color: canDoor ? '#ff9a3c' : '#8a93a8', align: 'center' });
  if (S.trapT > 0) g.text(`trap ${S.trapT.toFixed(0)}s`, W - 64, by1 + 62, { size: 14, color: '#c98aff', align: 'center' });
  if (S.doors > 0) g.text(`doors x${S.doors}`, W - 64, by2 + 62, { size: 14, color: '#ff9a3c', align: 'center' });
  // combo
  g.combo.draw(ctx);
  // fever border handled by engine shell
}

window.__g = g;
window.__dbg = () => ({ score: Math.round(g.score), lives: S.lives, carried: S.carried, alarm: S.alarm, px: Math.round(S.px), py: Math.round(S.py) });
g.run(update, draw, hud);
