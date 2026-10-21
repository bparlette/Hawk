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
const WALK_SPD = 170;
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
  f.atkT = type === 'hadouken' ? 0.45 : type === 'kick' ? 0.32 : 0.24;
  if (type === 'hadouken') { f.charging = 0.25; sfx('charge', { pitch: .9, vol: .5 }); }
  else sfx(type === 'kick' ? 'whoosh' : 'swish', { pitch: 1.1 + R() * .2, vol: .45 });
}

function spawnHadouken(f) {
  projectiles.push({
    x: f.x + f.facing * 40, y: f.y - 95, vx: f.facing * 420,
    t: 0, life: 2.2, owner: f, dmg: HADOUKEN_DMG,
  });
  sfx('hadouken', { pitch: 1.1, vol: .6 });
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
  victim.vx = (victim.x < hx ? -1 : 1) * 180;
  sfx('hit', { pitch: .85 + R() * .25, vol: .65 });
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
    if (r < 0.055) doAttack(me, 'punch');
    else if (r < 0.095) doAttack(me, 'kick');
    else if (r < 0.11 && dist > 110) doAttack(me, 'hadouken');
    else if (r < 0.13) { me.blockT = 0.5; }
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
  // ── DOJO (left side, where Ryu trained) ──
  c.fillStyle = '#2e1f16';
  c.fillRect(8, SY + 168, 96, 62);                    // dojo building
  c.fillStyle = '#1e1410';
  c.beginPath();                                       // tiled roof
  c.moveTo(0, SY + 168); c.lineTo(56, SY + 142); c.lineTo(112, SY + 168);
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,190,120,.5)';                // warm windows
  c.fillRect(20, SY + 188, 18, 22); c.fillRect(66, SY + 188, 18, 22);
  c.fillStyle = '#3a2a1e';
  c.fillRect(46, SY + 196, 12, 34);                    // door
  // noren curtain
  c.fillStyle = '#2a4a7a';
  c.fillRect(40, SY + 190, 24, 8);

  // ── FŪRINKAZAN SIGNS (breakable, "Wind Forest Fire Mountain") ──
  for (const sx of [SW * 0.32, SW * 0.68]) {
    // post
    c.fillStyle = '#4a3826';
    c.fillRect(sx - 4, SY + 196, 8, 40);
    // sign board
    c.fillStyle = '#e8dcc0';
    c.fillRect(sx - 34, SY + 168, 68, 34);
    c.strokeStyle = '#4a3826'; c.lineWidth = 3;
    c.strokeRect(sx - 34, SY + 168, 68, 34);
    // kanji (stylized strokes)
    c.strokeStyle = '#2a2018'; c.lineWidth = 2.4; c.lineCap = 'round';
    const kx = sx - 20;
    // 風 (wind) - simplified
    c.beginPath(); c.moveTo(kx, SY + 176); c.lineTo(kx + 12, SY + 176); c.stroke();
    c.beginPath(); c.moveTo(kx + 6, SY + 176); c.lineTo(kx + 6, SY + 192); c.stroke();
    c.beginPath(); c.moveTo(kx + 2, SY + 184); c.lineTo(kx + 10, SY + 184); c.stroke();
    // 林 (forest)
    c.beginPath(); c.moveTo(kx + 18, SY + 176); c.lineTo(kx + 18, SY + 194); c.stroke();
    c.beginPath(); c.moveTo(kx + 14, SY + 182); c.lineTo(kx + 22, SY + 182); c.stroke();
    c.beginPath(); c.moveTo(kx + 26, SY + 176); c.lineTo(kx + 26, SY + 194); c.stroke();
    c.beginPath(); c.moveTo(kx + 22, SY + 188); c.lineTo(kx + 30, SY + 188); c.stroke();
  }

  // ── BATS (right side, twilight) ──
  c.fillStyle = 'rgba(20,12,28,.9)';
  for (let bi = 0; bi < 5; bi++) {
    const bx = SW * 0.78 + Math.sin(t * 1.4 + bi * 2.2) * 40 + bi * 18;
    const by = SY + 60 + Math.cos(t * 1.8 + bi * 1.7) * 18 + bi * 12;
    const flap = Math.sin(t * 14 + bi * 3) * 0.7;
    c.save(); c.translate(bx, by); c.scale(1.4, 1.4);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(-8, -4 - flap * 5, -14, 0);
    c.quadraticCurveTo(-8, 2, 0, 0);
    c.quadraticCurveTo(8, 2, 14, 0);
    c.quadraticCurveTo(8, -4 - flap * 5, 0, 0);
    c.fill();
    c.restore();
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

/* ── fighter sprite: HIGH-DETAIL gi fighter ──
   SF2-accurate: muscular build, detailed gi folds, proper stance.
   Frames: idle (breathing), walk (2-step), punch, kick, block, hit, ko, hadouken. */
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
  if (ko) { c.translate(-kof * 30 * dir, 0); c.rotate(-kof * 1.45); c.translate(0, -kof * 18); }

  const atk = f.state === 'attack';
  const atkR = atk ? Math.sin(Math.min(1, f.stateT / Math.max(0.01, f.atkT)) * Math.PI) : 0;
  const blk = f.state === 'block';
  const hit = f.state === 'hit';

  // breathing / idle animation
  const breathe = f.state === 'idle' ? Math.sin(t * 4.2 + f.walkPhase) : 0;
  const bobY = breathe * 3;
  // walk cycle
  const walking = f.state === 'walk';
  const step = walking ? Math.sin(f.walkPhase * 3.2) : 0;
  const step2 = walking ? Math.cos(f.walkPhase * 3.2) : 0;

  const skin = flash ? '#ffffff' : col.skin;
  const skinD = flash ? '#ffffff' : '#c99a72';   // skin shadow
  const gi = flash ? '#ffffff' : col.gi;
  const giS = flash ? '#eeeeee' : col.giShade;
  const giD = flash ? '#dddddd' : '#b8b0a0';     // deep fold shadow

  // proportions (SF2 Ryu ~185px tall in our scale)
  const hipY = -84 + bobY * 0.5;
  const shY = -138 + bobY;
  const neckY = shY - 6;

  // ── shadow ──
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.beginPath(); c.ellipse(0, 5, 38, 10, 0, 0, TAU); c.fill();

  // ═══ LEGS ═══
  // back leg (darker)
  const backKneeBend = walking ? step * 10 : (atk && f.atkType === 'kick' ? -8 : 4);
  c.fillStyle = giS;
  // thigh
  c.save();
  c.translate(-16, hipY);
  c.rotate(0.12 + backKneeBend * 0.012);
  rr(c, -11, 0, 22, 40, 9); c.fill();
  // gi fold lines on thigh
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(-6, 8); c.quadraticCurveTo(-2, 20, -7, 32); c.stroke();
  c.restore();
  // shin
  c.save();
  c.translate(-18 + backKneeBend * 0.3, hipY + 38);
  rr(c, -9, 0, 18, 34, 7); c.fill();
  c.restore();
  // back foot (bare)
  c.fillStyle = skin;
  c.save(); c.translate(-20, hipY + 70);
  rr(c, -14, 0, 30, 11, 5); c.fill();
  // toes
  c.fillStyle = skinD;
  for (let ti = 0; ti < 4; ti++) { c.fillRect(-10 + ti * 6, 8, 4, 3); }
  c.restore();

  // front leg
  const frontLift = atk && f.atkType === 'kick' ? atkR : 0;
  const frontKickX = frontLift * 64;
  const frontKickY = -frontLift * 52;
  const fwdStep = walking ? step2 * 12 : 0;
  c.fillStyle = gi;
  c.save();
  c.translate(14 + fwdStep + frontKickX * 0.4, hipY);
  if (frontLift > 0) c.rotate(-frontLift * 1.15);
  // thigh with muscle curve
  c.beginPath();
  c.moveTo(-12, 0); c.quadraticCurveTo(-14, 22, -8, 38);
  c.lineTo(10, 38); c.quadraticCurveTo(14, 20, 11, 0);
  c.closePath(); c.fill();
  // thigh highlight
  c.fillStyle = 'rgba(255,255,255,.14)';
  c.beginPath(); c.ellipse(-2, 16, 5, 14, 0.15, 0, TAU); c.fill();
  c.fillStyle = gi;
  // knee
  c.beginPath(); c.arc(1, 40, 10, 0, TAU); c.fill();
  // shin
  rr(c, -8, 44, 17, 30 + frontKickY * 0.3, 7); c.fill();
  // shin shading
  c.fillStyle = giS; c.fillRect(-8, 44, 5, 30);
  c.fillStyle = gi;
  c.restore();
  // front foot
  c.fillStyle = skin;
  c.save();
  c.translate(15 + fwdStep + frontKickX, hipY + 72 + frontKickY);
  if (frontLift > 0) c.rotate(-0.3);
  // foot shape (detailed)
  c.beginPath();
  c.moveTo(-12, 0); c.lineTo(16, 0); c.lineTo(20, 7); c.lineTo(18, 11);
  c.lineTo(-10, 11); c.lineTo(-14, 6); c.closePath(); c.fill();
  // ankle + toes
  c.fillStyle = skinD;
  c.fillRect(12, 2, 6, 8);
  for (let ti = 0; ti < 3; ti++) { c.fillRect(-8 + ti * 6, 8, 4, 3); }
  c.restore();

  // ═══ TORSO ═══
  const leanF = atk ? atkR * 14 : blk ? -8 : hit ? -10 : walking ? 4 : 2;
  const torsoTwist = atk && f.atkType === 'punch' ? atkR * 0.12 : 0;
  c.save();
  c.translate(leanF, 0);
  c.rotate(torsoTwist);

  // gi jacket - main body with proper drape
  c.fillStyle = gi;
  c.beginPath();
  c.moveTo(-25, shY);
  c.quadraticCurveTo(-28, shY + 28, -22, hipY + 10);  // left side drape
  c.quadraticCurveTo(0, hipY + 16, 22, hipY + 10);    // bottom hem
  c.quadraticCurveTo(27, shY + 28, 24, shY);          // right side
  c.quadraticCurveTo(0, shY - 8, -25, shY);           // shoulders
  c.closePath(); c.fill();

  // chest muscle definition under gi
  c.fillStyle = 'rgba(0,0,0,.08)';
  c.beginPath(); c.ellipse(-9, shY + 22, 8, 12, 0.2, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(11, shY + 22, 8, 12, -0.2, 0, TAU); c.fill();

  // gi lapels (V-neck)
  c.fillStyle = giS;
  c.beginPath();
  c.moveTo(-10, shY + 2); c.lineTo(2, shY + 40); c.lineTo(-4, shY + 44); c.lineTo(-14, shY + 6);
  c.closePath(); c.fill();
  c.beginPath();
  c.moveTo(10, shY + 2); c.lineTo(0, shY + 40); c.lineTo(6, shY + 44); c.lineTo(14, shY + 6);
  c.closePath(); c.fill();
  // lapel edges
  c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-10, shY + 2); c.lineTo(2, shY + 40); c.stroke();
  c.beginPath(); c.moveTo(10, shY + 2); c.lineTo(0, shY + 40); c.stroke();

  // gi fold wrinkles (dynamic)
  c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 1.8;
  const wr = Math.sin(t * 3 + f.walkPhase) * 2;
  c.beginPath(); c.moveTo(-18, shY + 34 + wr); c.quadraticCurveTo(-10, shY + 44, -16, shY + 54); c.stroke();
  c.beginPath(); c.moveTo(16, shY + 38 - wr); c.quadraticCurveTo(10, shY + 48, 15, shY + 58); c.stroke();
  c.beginPath(); c.moveTo(-6, hipY - 6); c.quadraticCurveTo(0, hipY + 2, 8, hipY - 4); c.stroke();

  // black belt
  c.fillStyle = flash ? '#fff' : col.belt;
  rr(c, -24, hipY - 4, 48, 13, 4); c.fill();
  // belt highlight
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-24, hipY - 4, 48, 3.5);
  // belt knot
  c.fillStyle = flash ? '#fff' : col.belt;
  rr(c, -5, hipY + 7, 12, 9, 3); c.fill();
  // belt tails (animated sway)
  const sway1 = Math.sin(t * 4.4) * 5, sway2 = Math.cos(t * 3.8) * 7;
  c.save(); c.translate(3, hipY + 14); c.rotate(0.3 + sway1 * 0.02);
  rr(c, -3.5, 0, 7, 30, 3); c.fill();
  c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-3.5, 0, 2.5, 30);
  c.restore();
  c.save(); c.translate(-4, hipY + 14); c.rotate(-0.22 + sway2 * 0.02);
  c.fillStyle = flash ? '#fff' : col.belt;
  rr(c, -3, 0, 6, 24, 3); c.fill();
  c.restore();

  // ── chest (bare, gi open at top) ──
  c.fillStyle = skin;
  c.beginPath();
  c.moveTo(-9, shY + 2); c.lineTo(9, shY + 2); c.lineTo(5, shY + 26); c.lineTo(-5, shY + 26);
  c.closePath(); c.fill();
  // pec lines
  c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(-7, shY + 14); c.quadraticCurveTo(0, shY + 17, 7, shY + 14); c.stroke();

  c.restore(); // torso

  // ═══ ARMS ═══
  const guardBob = Math.sin(t * 4.2 + f.walkPhase + 1) * 3;
  const shX = leanF;

  if (blk) {
    // ── BLOCK: forearms crossed ──
    for (const [ax, ay, len, ang] of [[shX + 2, shY + 30, 46, -0.5], [shX - 4, shY + 34, 44, 0.45]]) {
      c.save(); c.translate(ax, ay); c.rotate(ang);
      // forearm (gi sleeve)
      c.fillStyle = gi; rr(c, -8, -len, 16, len, 7); c.fill();
      c.fillStyle = giS; c.fillRect(-8, -len, 5, len);
      // fist (glove)
      c.fillStyle = flash ? '#fff' : col.glove;
      c.beginPath(); c.arc(0, -len - 4, 12, 0, TAU); c.fill();
      // knuckle lines
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5;
      for (let ki = -1; ki <= 1; ki++) {
        c.beginPath(); c.moveTo(ki * 5 - 2, -len - 10); c.lineTo(ki * 5 - 2, -len + 2); c.stroke();
      }
      c.restore();
    }
    // block flash
    if (f.blockT > 0.3) {
      c.fillStyle = 'rgba(140,190,255,.4)';
      c.beginPath(); c.arc(shX + 10, shY + 28, 26, 0, TAU); c.fill();
    }
  } else if (atk && f.atkType === 'punch') {
    // ── PUNCH: lead arm extended, rear chambered ──
    const ext = atkR * 58;
    // punching arm
    c.save();
    c.translate(shX + 10, shY + 28);
    // shoulder muscle
    c.fillStyle = gi;
    c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.fill();
    // upper arm (sleeve)
    c.rotate(-0.08);
    rr(c, 0, -9, 30 + ext * 0.5, 18, 8); c.fill();
    // forearm (skin, gi sleeve rolled)
    c.fillStyle = skin;
    rr(c, 26 + ext * 0.5, -8, 26 + ext * 0.5, 16, 7); c.fill();
    // forearm muscle line
    c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(30 + ext * 0.5, -4); c.lineTo(46 + ext, -4); c.stroke();
    // fist
    const fx = 54 + ext;
    c.fillStyle = flash ? '#fff' : col.glove;
    c.beginPath(); c.arc(fx, 0, 14, 0, TAU); c.fill();
    // knuckles
    c.fillStyle = 'rgba(255,255,255,.3)';
    c.beginPath(); c.arc(fx + 4, -4, 5, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.6;
    for (let ki = -1; ki <= 1; ki++) {
      c.beginPath(); c.moveTo(fx + ki * 6 - 2, -11); c.lineTo(fx + ki * 6 - 2, 8); c.stroke();
    }
    c.restore();
    // rear arm (guard)
    c.fillStyle = gi;
    c.save(); c.translate(shX - 18, shY + 32); c.rotate(0.5);
    rr(c, -8, -26, 16, 30, 7); c.fill();
    c.fillStyle = flash ? '#fff' : col.glove;
    c.beginPath(); c.arc(0, -30, 11, 0, TAU); c.fill();
    c.restore();
    // motion blur
    if (atkR > 0.3) {
      c.fillStyle = `rgba(255,255,255,${(atkR - 0.3) * 0.35})`;
      rr(c, shX + 20, shY + 22, ext * 0.9, 12, 6); c.fill();
    }
  } else if (atk && f.atkType === 'hadouken') {
    // ── HADOUKEN: both palms thrust forward ──
    const thrust = atkR;
    const px = shX + 26 + thrust * 22;
    const py = shY + 34;
    for (const dy of [-10, 12]) {
      c.fillStyle = gi;
      c.save(); c.translate(shX + 4, py + dy); c.rotate(thrust * 0.15);
      rr(c, 0, -8, 30 + thrust * 14, 16, 7); c.fill();
      // sleeve cuff
      c.fillStyle = giS; c.fillRect(24 + thrust * 14, -8, 6, 16);
      c.restore();
      // open palm
      c.fillStyle = skin;
      c.save(); c.translate(px + 6, py + dy);
      c.beginPath(); c.ellipse(0, 0, 11, 8, 0, 0, TAU); c.fill();
      // fingers
      c.fillStyle = skinD;
      for (let fi = 0; fi < 4; fi++) { c.fillRect(6, -6 + fi * 4, 6, 2.6); }
      c.restore();
    }
    // charge energy
    if (f.charging > 0) {
      const ch = 1 - f.charging / 0.25;
      for (let gi2 = 2; gi2 >= 0; gi2--) {
        const gr2 = (22 - gi2 * 6) * ch + 6;
        c.fillStyle = `rgba(${gi2 === 0 ? '255,255,255' : gi2 === 1 ? '140,200,255' : '80,140,255'},${0.5 - gi2 * 0.13})`;
        c.beginPath(); c.arc(px + 14, py + 1, gr2, 0, TAU); c.fill();
      }
      // sparks
      for (let si = 0; si < 3; si++) {
        const sa = R() * TAU, sr2 = rnd(10, 26);
        c.fillStyle = 'rgba(160,210,255,.8)';
        c.fillRect(px + 14 + Math.cos(sa) * sr2, py + 1 + Math.sin(sa) * sr2, 3, 3);
      }
    }
  } else {
    // ── GUARD STANCE ──
    // lead arm
    c.save();
    c.translate(shX + 12, shY + 30 + guardBob);
    c.rotate(-0.35);
    // shoulder
    c.fillStyle = gi; c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill();
    // upper arm
    rr(c, -7, 0, 15, 26, 7); c.fill();
    // elbow
    c.beginPath(); c.arc(0, 27, 8, 0, TAU); c.fill();
    // forearm up (guard)
    c.save(); c.translate(0, 27); c.rotate(-1.9);
    rr(c, -7, 0, 14, 28, 6); c.fill();
    // fist
    c.fillStyle = flash ? '#fff' : col.glove;
    c.beginPath(); c.arc(0, 32, 11, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.28)';
    c.beginPath(); c.arc(-3, 29, 4, 0, TAU); c.fill();
    c.restore(); c.restore();
    // rear arm
    c.save();
    c.translate(shX - 16, shY + 34 - guardBob);
    c.rotate(0.4);
    c.fillStyle = gi; c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill();
    rr(c, -6, 0, 13, 24, 6); c.fill();
    c.save(); c.translate(0, 24); c.rotate(-2.1);
    c.fillStyle = gi; rr(c, -6, 0, 12, 26, 6); c.fill();
    c.fillStyle = flash ? '#fff' : col.glove;
    c.beginPath(); c.arc(0, 30, 10.5, 0, TAU); c.fill();
    c.restore(); c.restore();
  }

  // ═══ HEAD ═══
  const hy = neckY - 20 + bobY * 0.7 + (ko ? 12 : hit ? -4 : 0);
  const hx = shX + leanF * 0.3 + (hit ? -6 : 0);

  // neck (trapezius)
  c.fillStyle = skin;
  c.beginPath();
  c.moveTo(hx - 12, neckY + 4); c.lineTo(hx + 12, neckY + 4);
  c.lineTo(hx + 9, hy + 14); c.lineTo(hx - 9, hy + 14);
  c.closePath(); c.fill();
  // trap shading
  c.fillStyle = 'rgba(0,0,0,.1)';
  c.beginPath(); c.moveTo(hx - 12, neckY + 4); c.lineTo(hx - 4, neckY + 4); c.lineTo(hx - 6, hy + 12); c.lineTo(hx - 10, hy + 12); c.closePath(); c.fill();

  // head base
  c.fillStyle = skin;
  c.beginPath();
  c.moveTo(hx - 16, hy - 6);
  c.quadraticCurveTo(hx - 17, hy - 20, hx - 8, hy - 24);  // back of head
  c.quadraticCurveTo(hx + 6, hy - 28, hx + 14, hy - 20);  // top
  c.quadraticCurveTo(hx + 18, hy - 8, hx + 14, hy + 2);   // face front
  c.quadraticCurveTo(hx + 10, hy + 12, hx, hy + 13);      // jaw
  c.quadraticCurveTo(hx - 10, hy + 12, hx - 14, hy + 4);  // chin to ear
  c.closePath(); c.fill();

  // jaw/cheek shading
  c.fillStyle = 'rgba(0,0,0,.09)';
  c.beginPath(); c.ellipse(hx + 4, hy + 6, 9, 6, 0.3, 0, TAU); c.fill();

  // ── face details ──
  // brow (angry, determined)
  c.fillStyle = '#1c1410';
  c.save(); c.translate(hx + 7, hy - 8); c.rotate(-0.14);
  c.fillRect(-1, 0, 11, 3.2); c.restore();
  // eye (white + pupil, looking forward)
  c.fillStyle = '#fff';
  c.beginPath(); c.ellipse(hx + 9, hy - 2, 5.2, 3.6, 0, 0, TAU); c.fill();
  c.fillStyle = '#1a1a1a';
  c.beginPath(); c.arc(hx + 10.5, hy - 2, 2.4, 0, TAU); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(hx + 11.5, hy - 3, 1, 0, TAU); c.fill();
  // nose
  c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.8;
  c.beginPath(); c.moveTo(hx + 13, hy + 1); c.lineTo(hx + 15, hy + 5); c.lineTo(hx + 12, hy + 6); c.stroke();
  // mouth (grim)
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(hx + 6, hy + 9); c.lineTo(hx + 13, hy + 9.5); c.stroke();
  // ear
  c.fillStyle = skinD;
  c.beginPath(); c.ellipse(hx - 13, hy - 1, 4, 6, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1.2;
  c.beginPath(); c.arc(hx - 13, hy - 1, 2.2, 0, TAU); c.stroke();

  // ── hair ──
  c.fillStyle = flash ? '#fff' : col.hair;
  if (f.name === 'KEN') {
    // Ken: blonde, longer, swept
    c.beginPath();
    c.moveTo(hx - 17, hy - 10);
    c.quadraticCurveTo(hx - 20, hy - 28, hx - 2, hy - 30);
    c.quadraticCurveTo(hx + 14, hy - 30, hx + 16, hy - 18);
    c.quadraticCurveTo(hx + 17, hy - 10, hx + 12, hy - 8);
    c.quadraticCurveTo(hx + 8, hy - 16, hx - 2, hy - 15);
    c.quadraticCurveTo(hx - 12, hy - 14, hx - 17, hy - 10);
    c.closePath(); c.fill();
    // spikes
    for (const [sx, sy2, ex, ey] of [[-14, -22, -20, -30], [-6, -27, -8, -36], [2, -28, 4, -37], [10, -25, 15, -32]]) {
      c.beginPath(); c.moveTo(hx + sx, hy + sy2); c.lineTo(hx + ex, hy + ey); c.lineTo(hx + sx + 5, hy + sy2 + 2);
      c.closePath(); c.fill();
    }
    // back hair flowing
    const hw = Math.sin(t * 5) * 4;
    c.beginPath();
    c.moveTo(hx - 15, hy - 18); c.quadraticCurveTo(hx - 26, hy - 10 + hw, hx - 22, hy + 2);
    c.lineTo(hx - 14, hy + 0); c.closePath(); c.fill();
  } else {
    // Ryu: black, short, headband
    c.beginPath();
    c.moveTo(hx - 16, hy - 8);
    c.quadraticCurveTo(hx - 18, hy - 26, hx - 2, hy - 28);
    c.quadraticCurveTo(hx + 12, hy - 28, hx + 15, hy - 16);
    c.lineTo(hx + 13, hy - 10);
    c.quadraticCurveTo(hx + 4, hy - 18, hx - 6, hy - 16);
    c.quadraticCurveTo(hx - 13, hy - 14, hx - 16, hy - 8);
    c.closePath(); c.fill();
    // ── RED HEADBAND ──
    c.fillStyle = flash ? '#fff' : col.headband;
    c.save();
    c.beginPath();
    c.moveTo(hx - 16, hy - 16); c.lineTo(hx + 15, hy - 16);
    c.lineTo(hx + 15, hy - 8); c.lineTo(hx - 16, hy - 8);
    c.closePath(); c.fill();
    // knot
    c.beginPath(); c.arc(hx - 15, hy - 12, 5, 0, TAU); c.fill();
    // flowing tails (two ribbons)
    const w1 = Math.sin(t * 7.2) * 7, w2 = Math.cos(t * 6.1) * 9, w3 = Math.sin(t * 5.3 + 2) * 6;
    c.beginPath();
    c.moveTo(hx - 17, hy - 14);
    c.quadraticCurveTo(hx - 34, hy - 16 + w1, hx - 48, hy - 6 + w2);
    c.lineTo(hx - 44, hy - 1 + w2); c.quadraticCurveTo(hx - 30, hy - 8 + w1, hx - 16, hy - 9);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(hx - 17, hy - 10);
    c.quadraticCurveTo(hx - 32, hy - 8 + w3, hx - 42, hy + 2 + w1);
    c.lineTo(hx - 38, hy + 6 + w1); c.quadraticCurveTo(hx - 28, hy - 2 + w3, hx - 16, hy - 5);
    c.closePath(); c.fill();
    c.restore();
  }

  // hit flash overlay
  if (flash) {
    c.globalAlpha = 0.45; c.fillStyle = '#fff';
    c.beginPath(); c.arc(hx, hy - 6, 20, 0, TAU); c.fill();
    c.globalAlpha = 1;
  }

  c.restore();

  // KO stars
  if (ko && f.koT < 1.5) {
    for (let si = 0; si < 3; si++) {
      const sa = t * 4 + si * 2.1;
      const sx = x + Math.cos(sa) * 34, sy2 = y - 170 + Math.sin(sa * 1.3) * 10;
      c.fillStyle = '#ffe95c';
      c.save(); c.translate(sx, sy2); c.rotate(sa);
      c.beginPath();
      for (let pi = 0; pi < 10; pi++) {
        const rr3 = pi % 2 === 0 ? 8 : 3.5;
        const pa = (pi / 10) * TAU;
        c.lineTo(Math.cos(pa) * rr3, Math.sin(pa) * rr3);
      }
      c.closePath(); c.fill(); c.restore();
    }
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
