// STREET FIGHTER II — Ryu vs Ken, Suzaku Castle stage replica
// Perfect-replica demo: authentic HUD, ROUND 1/FIGHT!/K.O., Hadoukens, hit sparks.
import { makeGame, sfx, music, clamp, lerp, rnd, ri, pick, R, TAU, damp,
         panel, pill, rr, fmt } from '../_vendor/gp2x.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'sf2-replica', title: 'STREET FIGHTER II', sub: 'RYU vs KEN  ·  SUZAKU CASTLE',
  hook: 'the 1991 arcade classic, frame-perfect', w: W, h: H, bg: '#1a0f2e',
  bloom: 1, ca: 0, vig: 1.02, scan: .14,
});
const ctx = g.ctx;
const isAuto = new URLSearchParams(location.search).has('auto') || true; // always demo

/* ── layout: 16:9 fight stage letterboxed in vertical frame ── */
const SW = 540, SH = 304;          // stage viewport (16:9)
const SY = 330;                    // stage top Y in frame
const FLOOR = SY + SH - 42;        // ground line

/* ── tuning ── */
const WALK_SPD = 130;
const PUNCH_DMG = 7, KICK_DMG = 11, HADOUKEN_DMG = 14;
const ROUND_TIME = 99;

/* ── state ── */
let t, frame, phase, phaseT;        // phase: 'intro'|'round'|'fight'|'ko'|'roundEnd'
let roundNum, timer, timerT;
let ryu, ken, projectiles, sparks, hits;
let announce, announceT, announceScale;
let koT, slowmo;
let introT;
let ryuWins = 0, kenWins = 0;

function newFighter(name, x, facing, colors) {
  return {
    name, x, y: FLOOR, vx: 0, facing, colors,
    hp: 100, maxhp: 100,
    state: 'idle', stateT: 0, atkT: 0,
    hitT: 0, blockT: 0, koT: 0,
    crouch: false, charging: 0,
    walkPhase: R() * TAU,
  };
}

function resetRound() {
  ryu = newFighter('RYU', SW * 0.3, 1, {
    gi: '#f4f1ea', giShade: '#d8d2c2', skin: '#e8b88a', hair: '#2a2018',
    headband: '#d42a2a', belt: '#1a1a1a', glove: '#c44a2a',
  });
  ken = newFighter('KEN', SW * 0.7, -1, {
    gi: '#f4f1ea', giShade: '#d8d2c2', skin: '#e8b88a', hair: '#e8a83a',
    headband: null, belt: '#1a1a1a', glove: '#c44a2a',
  });
  projectiles = []; sparks = []; hits = [];
  timer = ROUND_TIME; timerT = 0;
  phase = 'intro'; phaseT = 0; introT = 0;
  announce = 'ROUND ' + roundNum; announceT = 0; announceScale = 0;
  koT = 0; slowmo = 1;
}

function resetMatch() {
  t = 0; frame = 0; roundNum = 1;
  resetRound();
}

function startFight() {
  phase = 'fight'; phaseT = 0;
  announce = 'FIGHT!'; announceT = 0; announceScale = 0;
  sfx('fight', { pitch: 1, vol: .5 });
  music('action');
}

/* ── combat ── */
function doAttack(f, type) {
  if (f.state !== 'idle' && f.state !== 'walk') return;
  f.state = 'attack'; f.stateT = 0; f.atkType = type;
  f.atkT = type === 'hadouken' ? 0.55 : type === 'kick' ? 0.38 : 0.28;
  if (type === 'hadouken') { f.charging = 0.3; sfx('charge', { pitch: .8, vol: .4 }); }
  else sfx(type === 'kick' ? 'whoosh' : 'swish', { pitch: 1 + R() * .2, vol: .35 });
}

function spawnHadouken(f) {
  projectiles.push({
    x: f.x + f.facing * 40, y: f.y - 95, vx: f.facing * 380,
    t: 0, life: 2.2, owner: f, dmg: HADOUKEN_DMG,
  });
  sfx('hadouken', { pitch: 1, vol: .5 });
}

function spawnSpark(x, y, big) {
  const n = big ? 14 : 8;
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, sp = 120 + R() * (big ? 320 : 180);
    sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
                  t: 0, life: .3 + R() * .25, col: pick(['#fff', '#ffe95c', '#ffb52e', '#fff']) });
  }
  // impact star
  hits.push({ x, y, t: 0, life: .18, big });
}

function damage(victim, dmg, hx) {
  if (victim.state === 'ko') return;
  // block chance
  if (victim.blockT > 0 || R() < 0.18) {
    victim.state = 'block'; victim.stateT = 0;
    sfx('block', { pitch: 1.2, vol: .3 });
    spawnSpark(hx, victim.y - 95, false);
    return;
  }
  victim.hp = Math.max(0, victim.hp - dmg);
  victim.state = 'hit'; victim.stateT = 0; victim.hitT = 0.32;
  victim.vx = (victim.x < hx ? -1 : 1) * 160;
  sfx('hit', { pitch: .9 + R() * .3, vol: .5 });
  spawnSpark(hx, victim.y - 95, dmg >= 12);
  g.combo.n++; g.combo.t = 1.2;
  if (victim.hp <= 0) {
    victim.state = 'ko'; victim.koT = 0;
    phase = 'ko'; phaseT = 0; koT = 0; slowmo = 0.25;
    announce = 'K.O.!'; announceT = 0; announceScale = 0;
    if (victim === ryu) kenWins++; else ryuWins++;
    sfx('ko', { pitch: .7, vol: .6 });
    music('stop');
  }
}

/* ── bot AI ── */
function botAI(me, op) {
  if (phase !== 'fight' || me.state === 'ko' || op.state === 'ko') return;
  if (me.state !== 'idle' && me.state !== 'walk') return;

  const dist = Math.abs(op.x - me.x);
  const dir = Math.sign(op.x - me.x) || 1;
  me.facing = dir;

  // spacing
  if (dist > 130) {
    me.state = 'walk'; me.vx = dir * WALK_SPD;
    me.walkPhase += 0.09;
    // occasional dash-in hadouken
    if (dist > 220 && dist < 380 && R() < 0.012) { me.state = 'idle'; me.vx = 0; doAttack(me, 'hadouken'); }
  } else if (dist < 70) {
    // too close: back off or throw
    if (R() < 0.03) { me.state = 'walk'; me.vx = -dir * WALK_SPD * 0.8; }
    else if (R() < 0.06) doAttack(me, R() < 0.5 ? 'punch' : 'kick');
    else { me.state = 'idle'; me.vx = 0; }
  } else {
    me.state = 'idle'; me.vx = 0;
    const r = R();
    if (r < 0.035) doAttack(me, 'punch');
    else if (r < 0.06) doAttack(me, 'kick');
    else if (r < 0.068 && dist > 110) doAttack(me, 'hadouken');
    else if (r < 0.09) { me.blockT = 0.5; }
  }
  me.x = clamp(me.x + me.vx * (1/60), 50, SW - 50);
  if (me.state === 'walk' && (dist <= 130 || R() < 0.05)) { me.state = 'idle'; me.vx = 0; }
}

/* ── update ── */
function update(dt) {
  const sdt = dt * slowmo;
  t += sdt; frame++;
  if (announceT < 3) announceT += dt;
  if (announceScale < 1) announceScale = Math.min(1, announceScale + dt * 3);

  // phases
  phaseT += dt;
  if (phase === 'intro') {
    introT += dt;
    if (introT > 1.6) { announce = 'ROUND ' + roundNum; announceT = 0; announceScale = 0; }
    if (introT > 2.6) startFight();
  } else if (phase === 'fight') {
    timerT += sdt;
    if (timerT >= 1) { timerT -= 1; timer = Math.max(0, timer - 1); }
    if (timer <= 0) {
      // time over: higher HP wins
      const winner = ryu.hp >= ken.hp ? ryu : ken;
      const loser = winner === ryu ? ken : ryu;
      damage(loser, 999, loser.x);
    }
  } else if (phase === 'ko') {
    koT += dt;
    if (koT > 0.9) slowmo = lerp(slowmo, 1, dt * 2);
    if (koT > 3.2) {
      roundNum++;
      if (roundNum > 2) { resetMatch(); }
      else resetRound();
    }
  }

  // fighters
  for (const f of [ryu, ken]) {
    f.stateT += sdt;
    if (f.hitT > 0) f.hitT -= sdt;
    if (f.blockT > 0) f.blockT -= sdt;
    if (f.charging > 0) {
      f.charging -= sdt;
      if (f.charging <= 0 && f.atkType === 'hadouken') spawnHadouken(f);
    }
    if (f.state === 'attack') {
      f.atkT -= sdt;
      // hit check at strike moment
      if (!f.didHit && f.stateT > (f.atkType === 'hadouken' ? 0.3 : f.atkType === 'kick' ? 0.18 : 0.12)) {
        f.didHit = true;
        const op = f === ryu ? ken : ryu;
        if (f.atkType !== 'hadouken') {
          const range = f.atkType === 'kick' ? 95 : 75;
          if (Math.abs(op.x - f.x) < range && Math.abs(op.y - f.y) < 40) {
            const hx = (f.x + op.x) / 2;
            damage(op, f.atkType === 'kick' ? KICK_DMG : PUNCH_DMG, hx);
          }
        }
      }
      if (f.atkT <= 0) { f.state = 'idle'; f.didHit = false; }
    } else if (f.state === 'hit') {
      f.x += f.vx * sdt; f.vx = damp(f.vx, 0, 8, sdt);
      f.x = clamp(f.x, 50, SW - 50);
      if (f.stateT > 0.34 && f.hp > 0) f.state = 'idle';
    } else if (f.state === 'block') {
      if (f.stateT > 0.3) f.state = 'idle';
    } else if (f.state === 'ko') {
      f.koT += sdt;
      f.x += f.vx * sdt; f.vx = damp(f.vx, 0, 6, sdt);
    }
    f.didHit = f.state === 'attack' ? f.didHit : false;
  }

  botAI(ryu, ken);
  botAI(ken, ryu);

  // projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.t += sdt;
    pr.x += pr.vx * sdt;
    // trail
    if (frame % 2 === 0) sparks.push({ x: pr.x, y: pr.y + rnd(-8, 8), vx: -pr.vx * .15, vy: rnd(-30, 30),
      t: 0, life: .3, col: pick(['#4da6ff', '#9fd0ff', '#fff']) });
    const victim = pr.owner === ryu ? ken : ryu;
    if (Math.abs(victim.x - pr.x) < 34 && Math.abs((victim.y - 95) - pr.y) < 50) {
      damage(victim, pr.dmg, pr.x);
      projectiles.splice(i, 1);
      continue;
    }
    if (pr.t > pr.life || pr.x < -40 || pr.x > SW + 40) projectiles.splice(i, 1);
  }

  // particles
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.t += sdt;
    s.x += s.vx * sdt; s.y += s.vy * sdt; s.vy += 500 * sdt;
    if (s.t > s.life) sparks.splice(i, 1);
  }
  for (let i = hits.length - 1; i >= 0; i--) {
    hits[i].t += dt;
    if (hits[i].t > hits[i].life) hits.splice(i, 1);
  }
  if (g.combo.t > 0) g.combo.t -= dt; else g.combo.n = 0;
}

/* ═══════════════ DRAW ═══════════════ */

function drawStage(c) {
  // clip to stage viewport
  c.save();
  c.beginPath(); c.rect(0, SY, SW, SH); c.clip();

  // sunset sky
  const sky = c.createLinearGradient(0, SY, 0, SY + SH);
  sky.addColorStop(0, '#2b1a4e');
  sky.addColorStop(0.35, '#7a2e5e');
  sky.addColorStop(0.6, '#d45a3c');
  sky.addColorStop(0.78, '#f2a24a');
  sky.addColorStop(1, '#3a2040');
  c.fillStyle = sky; c.fillRect(0, SY, SW, SH);

  // sun
  c.fillStyle = '#ffdf8a';
  c.beginPath(); c.arc(SW * 0.72, SY + 118, 34, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,223,138,.25)';
  c.beginPath(); c.arc(SW * 0.72, SY + 118, 52, 0, TAU); c.fill();

  // clouds
  c.fillStyle = 'rgba(255,180,140,.28)';
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 173 + t * 6) % (SW + 200)) - 100;
    c.beginPath(); c.ellipse(cx, SY + 40 + i * 22, 70, 14, 0, 0, TAU); c.fill();
  }

  // Suzaku castle silhouette
  c.fillStyle = '#241a38';
  const cx0 = SW * 0.16;
  // main keep: tiered roofs
  for (let tier = 0; tier < 4; tier++) {
    const tw = 110 - tier * 20, th = 26;
    const ty = SY + 150 - tier * 26;
    c.fillRect(cx0 - tw/2, ty, tw, th);
    // roof
    c.beginPath();
    c.moveTo(cx0 - tw/2 - 14, ty); c.lineTo(cx0, ty - 18); c.lineTo(cx0 + tw/2 + 14, ty);
    c.closePath(); c.fill();
  }
  c.fillRect(cx0 - 8, SY + 150 - 4*26 - 20, 16, 24); // spire
  // secondary tower
  c.fillRect(SW*0.86 - 30, SY + 120, 60, 60);
  c.beginPath();
  c.moveTo(SW*0.86 - 42, SY + 120); c.lineTo(SW*0.86, SY + 102); c.lineTo(SW*0.86 + 42, SY + 120);
  c.closePath(); c.fill();
  // lit windows
  c.fillStyle = 'rgba(255,200,120,.75)';
  for (let i = 0; i < 6; i++) c.fillRect(cx0 - 34 + (i%3)*26, SY + 96 + Math.floor(i/3)*24, 8, 10);

  // cherry blossom trees
  for (const tx of [SW*0.06, SW*0.94]) {
    c.strokeStyle = '#3a2a28'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(tx, SY + 220); c.lineTo(tx + (tx < SW/2 ? 12 : -12), SY + 150); c.stroke();
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(tx + (tx < SW/2 ? 12 : -12), SY + 150);
    c.lineTo(tx + (tx < SW/2 ? 34 : -34), SY + 128); c.stroke();
    // blossom clusters
    for (let i = 0; i < 26; i++) {
      const bx = tx + rnd(-46, 46), by = SY + rnd(108, 165);
      c.fillStyle = `rgba(255,${ri(170,200)},${ri(200,225)},${rnd(.5,.95)})`;
      c.beginPath(); c.arc(bx, by, rnd(4, 9), 0, TAU); c.fill();
    }
  }
  // falling petals
  c.fillStyle = 'rgba(255,190,215,.8)';
  for (let i = 0; i < 14; i++) {
    const px = (i * 97 + t * 24) % SW;
    const py = SY + ((i * 61 + t * 40) % (SH - 60));
    c.save(); c.translate(px, py); c.rotate(t * 2 + i);
    c.beginPath(); c.ellipse(0, 0, 5, 3, 0, 0, TAU); c.fill(); c.restore();
  }

  // distant hills
  c.fillStyle = '#31204a';
  c.beginPath(); c.moveTo(0, SY + 225);
  c.quadraticCurveTo(SW*0.3, SY + 190, SW*0.55, SY + 222);
  c.quadraticCurveTo(SW*0.8, SY + 248, SW, SY + 215);
  c.lineTo(SW, SY + 260); c.lineTo(0, SY + 260); c.closePath(); c.fill();

  // stone floor
  const fl = c.createLinearGradient(0, FLOOR - 30, 0, SY + SH);
  fl.addColorStop(0, '#6a5a48'); fl.addColorStop(0.25, '#57493a'); fl.addColorStop(1, '#2e2620');
  c.fillStyle = fl; c.fillRect(0, FLOOR - 30, SW, SY + SH - FLOOR + 30);
  // floor planks / stones
  c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const fy = FLOOR - 22 + i * 14;
    c.beginPath(); c.moveTo(0, fy); c.lineTo(SW, fy); c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const fx = (i * 89) % SW;
    c.beginPath(); c.moveTo(fx, FLOOR - 30); c.lineTo(fx - 14, SY + SH); c.stroke();
  }
  // floor sheen
  c.fillStyle = 'rgba(255,170,110,.07)'; c.fillRect(0, FLOOR - 30, SW, 26);

  c.restore();

  // stage border
  c.strokeStyle = '#0a0a12'; c.lineWidth = 6; c.strokeRect(0, SY, SW, SH);
}

/* ── fighter sprite: detailed gi fighter ── */
function drawFighter(c, f) {
  const col = f.colors;
  const x = f.x, y = f.y;
  const dir = f.facing;
  const flash = f.hitT > 0 && Math.floor(t * 24) % 2 === 0;

  c.save();
  c.translate(x, y);
  c.scale(dir, 1);

  const ko = f.state === 'ko';
  const kof = ko ? Math.min(1, f.koT * 2.2) : 0;
  if (ko) { c.translate(-kof * 26 * dir, 0); c.rotate(-kof * 1.35); c.translate(0, -kof * 14); }

  const bob = f.state === 'idle' ? Math.sin(t * 5 + f.walkPhase) * 2.5 : 0;
  const atk = f.state === 'attack';
  const atkP = atk ? Math.min(1, f.stateT / 0.14) : 0;         // punch-out 0..1
  const atkR = atk ? Math.sin(Math.min(1, f.stateT / f.atkT) * Math.PI) : 0;
  const blk = f.state === 'block';
  const cro = f.crouch;

  const skin = flash ? '#ffffff' : col.skin;
  const gi = flash ? '#ffffff' : col.gi;
  const giS = flash ? '#ffffff' : col.giShade;

  const hipY = -78 + bob * 0.4;
  const shY = -128 + bob;

  // shadow
  c.fillStyle = 'rgba(0,0,0,.32)';
  c.beginPath(); c.ellipse(0, 4, 34, 9, 0, 0, TAU); c.fill();

  // ── legs ──
  const stanceW = f.state === 'walk' ? 30 + Math.sin(f.walkPhase * 2) * 8 : 30;
  // back leg
  c.fillStyle = giS;
  rr(c, -26, hipY, 20, 66, 8); c.fill();
  // front leg
  c.fillStyle = gi;
  const fwd = atk && f.atkType === 'kick' ? atkR * 52 : 0;
  const lift = atk && f.atkType === 'kick' ? -atkR * 46 : 0;
  c.save();
  c.translate(8, hipY + 6); c.rotate(atk && f.atkType === 'kick' ? -atkR * 1.1 : 0);
  rr(c, -10, 0, 20, 60 + lift * 0.4, 8); c.fill();
  // foot
  c.fillStyle = skin;
  rr(c, -10, 56 + lift * 0.4, 26, 10, 4); c.fill();
  c.restore();
  // back foot
  c.fillStyle = skin;
  rr(c, -30, hipY + 58, 24, 10, 4); c.fill();

  // ── torso (gi) ──
  const lean = atk ? atkR * 10 : blk ? -6 : 0;
  c.save();
  c.translate(lean, 0);
  // gi jacket
  c.fillStyle = gi;
  c.beginPath();
  c.moveTo(-22, shY); c.lineTo(22, shY); c.lineTo(18, hipY + 8); c.lineTo(-18, hipY + 8);
  c.closePath(); c.fill();
  // gi shading + lapels
  c.fillStyle = giS;
  c.beginPath(); c.moveTo(4, shY); c.lineTo(22, shY); c.lineTo(18, hipY + 8); c.lineTo(4, hipY + 8); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-8, shY + 4); c.lineTo(0, shY + 34); c.lineTo(-6, shY + 52); c.stroke();
  c.beginPath(); c.moveTo(8, shY + 4); c.lineTo(2, shY + 34); c.lineTo(8, shY + 52); c.stroke();
  // black belt
  c.fillStyle = col.belt;
  rr(c, -21, hipY - 2, 42, 12, 3); c.fill();
  c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(-21, hipY - 2, 42, 3);
  // belt knot + tails
  rr(c, -4, hipY + 8, 10, 8, 2); c.fill();
  const sway = Math.sin(t * 4) * 4;
  c.save(); c.translate(2, hipY + 14); c.rotate(0.25 + sway * 0.02);
  rr(c, -3, 0, 7, 26, 3); c.fill(); c.restore();

  // ── arms ──
  const guardY = shY + 26;
  if (blk) {
    // crossed block
    c.fillStyle = gi;
    rr(c, -6, guardY - 34, 15, 52, 7); c.fill();
    rr(c, -9, guardY - 30, 15, 48, 7); c.fill();
    c.fillStyle = col.glove;
    c.beginPath(); c.arc(2, guardY - 36, 11, 0, TAU); c.fill();
    c.beginPath(); c.arc(-1, guardY - 32, 11, 0, TAU); c.fill();
  } else if (atk && f.atkType === 'punch') {
    // punching arm extended
    c.fillStyle = gi;
    rr(c, 8, guardY - 6, 34 + atkP * 26, 17, 8); c.fill();
    c.fillStyle = col.glove;
    c.beginPath(); c.arc(44 + atkP * 26, guardY + 2, 13, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)';
    c.beginPath(); c.arc(40 + atkP * 26, guardY - 2, 5, 0, TAU); c.fill();
    // rear guard arm
    c.fillStyle = gi;
    rr(c, -24, guardY - 22, 16, 34, 7); c.fill();
    c.fillStyle = col.glove;
    c.beginPath(); c.arc(-16, guardY - 26, 10, 0, TAU); c.fill();
  } else if (atk && f.atkType === 'hadouken') {
    // both palms forward, charging
    const ch = f.charging > 0 ? 1 - f.charging / 0.3 : 1;
    const px = 20 + atkR * 30;
    c.fillStyle = gi;
    rr(c, -2, guardY - 8, 26, 16, 7); c.fill();
    rr(c, -2, guardY + 10, 26, 16, 7); c.fill();
    c.fillStyle = skin;
    c.beginPath(); c.arc(px, guardY, 10, 0, TAU); c.fill();
    c.beginPath(); c.arc(px, guardY + 18, 10, 0, TAU); c.fill();
    // charge glow
    if (f.charging > 0) {
      const ga = 0.35 + 0.3 * Math.sin(t * 30);
      c.fillStyle = `rgba(120,180,255,${ga})`;
      c.beginPath(); c.arc(px + 8, guardY + 9, 22 * ch + 8, 0, TAU); c.fill();
    }
  } else {
    // guard stance
    const g1 = Math.sin(t * 5 + f.walkPhase) * 3;
    c.fillStyle = gi;
    rr(c, 6, guardY - 20 + g1, 16, 32, 7); c.fill();
    rr(c, -22, guardY - 14 - g1, 16, 30, 7); c.fill();
    c.fillStyle = col.glove;
    c.beginPath(); c.arc(15, guardY - 24 + g1, 10.5, 0, TAU); c.fill();
    c.beginPath(); c.arc(-13, guardY - 18 - g1, 10.5, 0, TAU); c.fill();
  }
  c.restore(); // torso

  // ── head ──
  const hy = shY - 26 + bob * 0.6 + (ko ? 10 : 0);
  // neck
  c.fillStyle = skin; c.fillRect(-7, shY - 8, 14, 12);
  // face
  c.fillStyle = skin;
  c.beginPath(); c.arc(2, hy, 17, 0, TAU); c.fill();
  // jaw shading
  c.fillStyle = 'rgba(0,0,0,.12)';
  c.beginPath(); c.arc(2, hy + 4, 15, 0.3, Math.PI - 0.3); c.fill();
  // eyes (determined)
  c.fillStyle = '#1a1a1a';
  c.fillRect(6, hy - 5, 7, 3.4);
  // brow
  c.fillRect(4, hy - 10, 10, 2.6);
  // hair
  c.fillStyle = col.hair;
  c.beginPath(); c.arc(0, hy - 6, 17, Math.PI * 0.95, Math.PI * 2.02); c.fill();
  c.fillRect(-17, hy - 12, 10, 16); // back hair
  // headband (Ryu) / forehead band
  if (col.headband) {
    c.fillStyle = flash ? '#fff' : col.headband;
    c.fillRect(-16, hy - 12, 35, 7);
    // tails flowing
    const w1 = Math.sin(t * 7) * 6, w2 = Math.cos(t * 6) * 8;
    c.beginPath();
    c.moveTo(-15, hy - 9); c.quadraticCurveTo(-32, hy - 12 + w1, -44, hy - 4 + w2);
    c.lineTo(-40, hy + 2 + w2); c.quadraticCurveTo(-28, hy - 4 + w1, -14, hy - 3);
    c.closePath(); c.fill();
  }
  // hit flash overlay already via flash colors

  c.restore();

  // block spark
  if (blk && f.blockT > 0.35) {
    c.fillStyle = 'rgba(150,200,255,.5)';
    c.beginPath(); c.arc(x + dir * 30, y - 105, 20, 0, TAU); c.fill();
  }
}

function drawProjectiles(c) {
  for (const pr of projectiles) {
    const pul = 1 + Math.sin(pr.t * 30) * 0.12;
    // glow
    const gr = c.createRadialGradient(pr.x, pr.y, 4, pr.x, pr.y, 34 * pul);
    gr.addColorStop(0, 'rgba(255,255,255,.95)');
    gr.addColorStop(0.4, 'rgba(140,200,255,.8)');
    gr.addColorStop(1, 'rgba(80,140,255,0)');
    c.fillStyle = gr;
    c.beginPath(); c.arc(pr.x, pr.y, 34 * pul, 0, TAU); c.fill();
    // core
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(pr.x, pr.y, 20 * pul, 13 * pul, 0, 0, TAU); c.fill();
    c.fillStyle = '#9fd0ff';
    c.beginPath(); c.ellipse(pr.x, pr.y, 12 * pul, 8 * pul, 0, 0, TAU); c.fill();
  }
}

function drawSparks(c) {
  for (const s of sparks) {
    const a = 1 - s.t / s.life;
    c.globalAlpha = a;
    c.fillStyle = s.col;
    c.fillRect(s.x - 2, s.y - 2, 4, 4);
  }
  c.globalAlpha = 1;
  for (const h of hits) {
    const p = h.t / h.life;
    const r = (h.big ? 46 : 28) * (0.6 + p * 0.7);
    c.save(); c.translate(h.x, h.y); c.rotate(p * 0.6);
    c.globalAlpha = 1 - p;
    c.fillStyle = '#fff';
    const spikes = 8;
    c.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const rr2 = i % 2 === 0 ? r : r * 0.45;
      const a = (i / (spikes * 2)) * TAU;
      c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
    }
    c.closePath(); c.fill();
    c.fillStyle = '#ffe95c'; c.globalAlpha = (1 - p) * 0.8;
    c.beginPath(); c.arc(0, 0, r * 0.4, 0, TAU); c.fill();
    c.restore();
  }
  c.globalAlpha = 1;
}

/* ── authentic SF2 HUD ── */
function drawHUD(c) {
  const hy = SY - 66;
  // top black bar bg
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, SY - 84, SW, 84);

  // health bars
  const bw = 200, bh = 16;
  for (const [f, left] of [[ryu, true], [ken, false]]) {
    const bx = left ? 18 : SW - 18 - bw;
    const by = hy;
    // frame
    c.fillStyle = '#000'; c.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    c.fillStyle = '#7a1a1a'; c.fillRect(bx, by, bw, bh); // damage (red)
    const hpw = bw * (f.hp / f.maxhp);
    // yellow health with gradient
    const hg = c.createLinearGradient(0, by, 0, by + bh);
    hg.addColorStop(0, '#ffe95c'); hg.addColorStop(0.5, '#f7c948'); hg.addColorStop(1, '#d48806');
    c.fillStyle = hg;
    if (left) c.fillRect(bx, by, hpw, bh);
    else c.fillRect(bx + bw - hpw, by, hpw, bh);
    // shine
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(bx, by, bw, 4);
    // name
    c.fillStyle = '#fff'; c.font = '900 17px Impact, "Arial Black", sans-serif';
    c.textAlign = left ? 'left' : 'right';
    c.fillText(f.name, left ? bx : bx + bw, by - 8);
    // round pips
    for (let i = 0; i < 2; i++) {
      c.fillStyle = i < (f === ryu ? ryuWins : kenWins) ? '#ffe95c' : 'rgba(255,255,255,.18)';
      c.beginPath(); c.arc((left ? bx + 8 : bx + bw - 8) + (left ? i * 18 : -i * 18), by + bh + 12, 6, 0, TAU); c.fill();
    }
  }

  // timer box
  c.fillStyle = '#000'; c.fillRect(SW/2 - 30, hy - 12, 60, 44);
  c.strokeStyle = '#ffe95c'; c.lineWidth = 3; c.strokeRect(SW/2 - 30, hy - 12, 60, 44);
  c.fillStyle = timer <= 10 ? '#ff5c5c' : '#ffe95c';
  c.font = '900 30px Impact, "Arial Black", sans-serif'; c.textAlign = 'center';
  c.fillText(String(timer), SW/2, hy + 20);

  // score
  c.fillStyle = '#fff'; c.font = '700 13px Impact, sans-serif';
  c.textAlign = 'left'; c.fillText('SCORE ' + fmt(g.score), 18, SY - 92 + 84 - 4);
}

/* ── announcements ── */
function drawAnnounce(c) {
  if (announceT > 1.6) return;
  const p = Math.min(1, announceT / 0.25);
  const a = announceT > 1.2 ? 1 - (announceT - 1.2) / 0.4 : 1;
  const sc = 0.5 + 0.5 * (1 - Math.pow(1 - announceScale, 3));
  c.save();
  c.globalAlpha = clamp(a, 0, 1);
  c.translate(SW / 2, SY + SH / 2 - 20);
  c.scale(sc, sc);
  c.textAlign = 'center';
  const isKO = announce === 'K.O.!', isFight = announce === 'FIGHT!';
  const col = isKO ? '#ff2c2c' : isFight ? '#ffe95c' : '#fff';
  c.font = `900 ${isKO || isFight ? 84 : 64}px Impact, "Arial Black", sans-serif`;
  c.lineWidth = 10; c.strokeStyle = '#000';
  c.strokeText(announce, 0, 0);
  c.fillStyle = col; c.fillText(announce, 0, 0);
  // glow
  c.shadowColor = col; c.shadowBlur = 30;
  c.fillText(announce, 0, 0);
  c.restore();
}

/* ── frame chrome (vertical Short framing) ── */
function drawChrome(c) {
  // top: title card
  const tg = c.createLinearGradient(0, 0, 0, SY);
  tg.addColorStop(0, '#0d0618'); tg.addColorStop(1, '#1a0f2e');
  c.fillStyle = tg; c.fillRect(0, 0, W, SY);
  // SF2 logo text
  c.textAlign = 'center';
  c.fillStyle = '#ffe95c';
  c.font = '900 44px Impact, "Arial Black", sans-serif';
  c.lineWidth = 8; c.strokeStyle = '#7a1a00';
  c.strokeText('STREET FIGHTER', W/2, 66);
  c.fillText('STREET FIGHTER', W/2, 66);
  c.fillStyle = '#ff5c2c'; c.font = '900 30px Impact, "Arial Black", sans-serif';
  c.lineWidth = 6; c.strokeStyle = '#4a0d00';
  c.strokeText('I I', W/2, 104); c.fillText('I I', W/2, 104);
  c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '700 15px Impact, sans-serif';
  c.fillText('RYU  vs  KEN  ·  JAPAN STAGE', W/2, 140);
  c.fillStyle = '#ff2c5c'; c.font = '900 20px Impact, sans-serif';
  c.fillText('★ PERFECT REPLICA ★', W/2, 172);
  // decorative: versus portraits (mini)
  // bottom: caption bar
  const by = SY + SH;
  const bg2 = c.createLinearGradient(0, by, 0, H);
  bg2.addColorStop(0, '#1a0f2e'); bg2.addColorStop(1, '#0d0618');
  c.fillStyle = bg2; c.fillRect(0, by, W, H - by);
  c.fillStyle = '#fff'; c.font = '900 26px Impact, "Arial Black", sans-serif';
  c.fillText('1991 ENERGY. 2026 PIXELS.', W/2, by + 52);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '700 16px Impact, sans-serif';
  c.fillText('HADOUKEN!  ·  SHORYUKEN!  ·  TATSUMAKI!', W/2, by + 86);
  // combo counter
  if (g.combo.n > 1) {
    pill(ctx, W/2 - 70, by + 110, `${g.combo.n}x COMBO`, { size: 24, color: '#00f0ff' });
  }
  // round indicator
  c.fillStyle = '#ffe95c'; c.font = '900 20px Impact, sans-serif';
  c.fillText(`ROUND ${Math.min(roundNum, 2)}`, W/2, by + 150);
}

/* ── main draw ── */
function draw() {
  ctx.clearRect(0, 0, W, H);
  drawChrome(ctx);
  drawStage(ctx);
  drawHUD(ctx);
  // fighters (loser drawn first if KO'd)
  const order = (ken.state === 'ko') ? [ken, ryu] : (ryu.state === 'ko') ? [ryu, ken] : [ryu, ken];
  // simpler: draw both, KO'd one slightly behind
  drawFighter(ctx, ryu);
  drawFighter(ctx, ken);
  drawProjectiles(ctx);
  drawSparks(ctx);
  drawAnnounce(ctx);
  // KO slow-mo vignette
  if (phase === 'ko' && koT < 1.2) {
    ctx.fillStyle = `rgba(255,44,44,${0.12 * (1 - koT / 1.2)})`;
    ctx.fillRect(0, SY, SW, SH);
  }
}

/* ── input: tap = random special ── */
g.onTap = (x, y) => {
  if (phase !== 'fight') return;
  const f = R() < 0.5 ? ryu : ken;
  doAttack(f, pick(['punch', 'kick', 'hadouken']));
};

resetMatch();
g.run(update, draw);
