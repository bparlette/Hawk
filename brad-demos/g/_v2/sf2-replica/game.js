// STREET FIGHTER II — Ryu vs Guile, Suzaku Castle stage replica
// Real sprite frames sliced from the reference sheet. Authentic HUD,
// ROUND 1/FIGHT!/K.O., Hadouken vs Sonic Boom, hit sparks, KO slow-mo.
import { makeGame, sfx, music, clamp, lerp, rnd, ri, pick, R, TAU, damp,
         panel, pill, rr, fmt } from '../_vendor/gp2x.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'sf2-replica', title: 'STREET FIGHTER II', sub: 'RYU vs GUILE  ·  SAUVAGE vs DAN',
  hook: 'the 1991 arcade classic, real sprite frames', w: W, h: H, bg: '#1a0f2e',
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
const PUNCH_DMG = 7, KICK_DMG = 11, SPECIAL_DMG = 14;
const ROUND_TIME = 99;

/* ── sprites ── */
const SPRITE_FILES = [
  // round 1: Ryu vs Guile
  'ryu_idle_0','ryu_idle_1','ryu_idle_2',
  'ryu_walk_0','ryu_walk_1','ryu_walk_2',
  'ryu_punch_0','ryu_punch_1','ryu_punch_2',
  'ryu_kick_0','ryu_kick_1','ryu_kick_2',
  'ryu_hadouken_0','ryu_hadouken_1','ryu_hadouken_2',
  'hadouken_proj',
  'guile_idle_0','guile_idle_1','guile_idle_2',
  'guile_walk_0','guile_walk_1','guile_walk_2',
  'guile_punch_0','guile_punch_1','guile_punch_2',
  'guile_kick_0','guile_kick_1',
  'guile_sonic_0','guile_sonic_1','guile_sonic_2','guile_sonic_3',
  'sonicboom_proj',
  // round 2: Sauvage vs Dan
  'sauvage_idle_0','sauvage_idle_1',
  'sauvage_walk_0','sauvage_walk_1','sauvage_walk_2',
  'sauvage_punch_0','sauvage_punch_1',
  'sauvage_kick_0','sauvage_kick_1',
  'sauvage_megaphone_0','sauvage_megaphone_1','sauvage_megaphone_2',
  'megaphone_rings',
  'dan_idle_0','dan_idle_1',
  'dan_walk_0','dan_walk_1','dan_walk_2',
  'dan_punch_0','dan_punch_1',
  'dan_kick_0','dan_kick_1',
  'dan_special_0','dan_special_1',
  'dan_gadoken_0','dan_gadoken_1',
  'gadoken_proj',
];
// frame counts per fighter prefix (for variable-length animations)
const FRAMES = {
  ryu:     { idle: 3, walk: 3, punch: 3, kick: 3, special: 3 },
  guile:   { idle: 3, walk: 3, punch: 3, kick: 2, special: 4 },
  sauvage: { idle: 2, walk: 3, punch: 2, kick: 2, special: 3 },
  dan:     { idle: 2, walk: 3, punch: 2, kick: 2, special: 2 },
};
const sprites = {};
let spritesLoaded = 0, spritesReady = false;

// Load sprites from embedded base64 chunks (deployed as text via git),
// falling back to PNG files if base64 chunks aren't available.
async function loadSprites() {
  try {
    const countResp = await fetch('sprite-b64/chunk_count.txt');
    if (!countResp.ok) throw new Error('no b64 chunks');
    const count = parseInt(await countResp.text(), 10);
    let manifest = '';
    for (let i = 0; i < count; i++) {
      const r = await fetch('sprite-b64/sprites_b64_' + String(i).padStart(2, '0') + '.txt');
      manifest += await r.text();
    }
    const data = JSON.parse(manifest);
    for (const name of SPRITE_FILES) {
      const img = new Image();
      img.onload = () => { if (++spritesLoaded === SPRITE_FILES.length) spritesReady = true; };
      img.onerror = () => { if (++spritesLoaded === SPRITE_FILES.length) spritesReady = true; };
      img.src = 'data:image/png;base64,' + data[name + '.png'];
      sprites[name] = img;
    }
  } catch (e) {
    // Fallback: load PNG files directly
    for (const name of SPRITE_FILES) {
      const img = new Image();
      img.onload = () => { if (++spritesLoaded === SPRITE_FILES.length) spritesReady = true; };
      img.onerror = () => { if (++spritesLoaded === SPRITE_FILES.length) spritesReady = true; };
      img.src = 'sprites/' + name + '.png';
      sprites[name] = img;
    }
  }
}
loadSprites();

/* ── state ── */
let t, frame, phase, phaseT;        // phase: 'intro'|'round'|'fight'|'ko'|'roundEnd'
let roundNum, timer, timerT;
let p1, p2, projectiles, sparks, hits;
let announce, announceT, announceScale;
let koT, slowmo;
let introT;
let p1Wins = 0, p2Wins = 0;
// round matchups: [p1name, p1prefix, p1special, p2name, p2prefix, p2special]
const MATCHUPS = [
  ['RYU', 'ryu', 'hadouken', 'GUILE', 'guile', 'sonicboom'],
  ['SAUVAGE', 'sauvage', 'megaphone', 'DAN', 'dan', 'gadoken'],
];

function newFighter(name, prefix, special, x, facing) {
  return {
    name, prefix, special, x, y: FLOOR, vx: 0, facing,
    hp: 100, maxhp: 100,
    state: 'idle', stateT: 0, atkT: 0, atkType: null, didHit: false,
    hitT: 0, blockT: 0, koT: 0,
    charging: 0,
    walkPhase: R() * TAU,
  };
}

function resetRound() {
  const m = MATCHUPS[roundNum - 1];
  p1 = newFighter(m[0], m[1], m[2], SW * 0.3, 1);
  p2 = newFighter(m[3], m[4], m[5], SW * 0.7, -1);
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
const SPECIAL_TYPES = ['hadouken', 'sonicboom', 'megaphone', 'gadoken'];
function doAttack(f, type) {
  if (f.state !== 'idle' && f.state !== 'walk') return;
  if (type === 'special') type = f.special;
  f.state = 'attack'; f.stateT = 0; f.atkType = type; f.didHit = false;
  f.atkT = SPECIAL_TYPES.includes(type) ? 0.45 : type === 'kick' ? 0.32 : type === 'taunt' ? 0.6 : 0.24;
  if (SPECIAL_TYPES.includes(type)) {
    f.charging = 0.28;
    const pitches = { hadouken: 0.9, sonicboom: 0.75, megaphone: 0.6, gadoken: 1.3 };
    sfx('charge', { pitch: pitches[type] || 1, vol: .5 });
  }
  else if (type === 'taunt') {
    sfx('taunt', { pitch: 1.2, vol: .4 });
  }
  else sfx(type === 'kick' ? 'whoosh' : 'swish', { pitch: 1.1 + R() * .2, vol: .45 });
}

function spawnSpecial(f) {
  // megaphone: slow wide rings; gadoken: fast but weak (Dan is a joke character)
  const cfg = {
    hadouken:  { vx: 420, dmg: SPECIAL_DMG, img: 'hadouken_proj', sfx: 'hadouken', pitch: 1.1 },
    sonicboom: { vx: 380, dmg: SPECIAL_DMG, img: 'sonicboom_proj', sfx: 'sonicboom', pitch: 0.8 },
    megaphone: { vx: 300, dmg: SPECIAL_DMG + 2, img: 'megaphone_rings', sfx: 'megaphone', pitch: 0.7, wide: true },
    gadoken:   { vx: 460, dmg: Math.ceil(SPECIAL_DMG / 2), img: 'gadoken_proj', sfx: 'gadoken', pitch: 1.4 },
  }[f.special];
  if (!cfg) return;
  projectiles.push({
    x: f.x + f.facing * 46, y: f.y - 92, vx: f.facing * cfg.vx,
    t: 0, life: 2.2, owner: f, dmg: cfg.dmg,
    img: cfg.img, wide: !!cfg.wide,
  });
  sfx(cfg.sfx, { pitch: cfg.pitch, vol: .6 });
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
    spawnSpark(hx, victim.y - 92, false);
    return;
  }
  victim.hp = Math.max(0, victim.hp - dmg);
  victim.state = 'hit'; victim.stateT = 0; victim.hitT = 0.32;
  victim.vx = (victim.x < hx ? -1 : 1) * 180;
  sfx('hit', { pitch: .85 + R() * .25, vol: .65 });
  spawnSpark(hx, victim.y - 92, dmg >= 12);
  g.combo.n++; g.combo.t = 1.2;
  if (victim.hp <= 0) {
    victim.state = 'ko'; victim.koT = 0;
    phase = 'ko'; phaseT = 0; koT = 0; slowmo = 0.25;
    announce = 'K.O.!'; announceT = 0; announceScale = 0;
    if (victim === p1) p2Wins++; else p1Wins++;
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
    // occasional dash-in special
    if (dist > 220 && dist < 380 && R() < 0.012) { me.state = 'idle'; me.vx = 0; doAttack(me, 'special'); }
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
    else if (r < 0.11 && dist > 110) doAttack(me, 'special');
    else if (r < 0.13) { me.blockT = 0.5; }
    // Dan taunts when he's feeling himself (joke character flavor)
    else if (r < 0.145 && me.prefix === 'dan') doAttack(me, 'taunt');
  }
  me.x = clamp(me.x + me.vx * (1/60), 50, SW - 50);
  if (me.state === 'walk' && (dist <= 130 || R() < 0.05)) { me.state = 'idle'; me.vx = 0; }
}

/* ── update ── */
function update(dt) {
  if (!spritesReady) return;
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
      const winner = p1.hp >= p2.hp ? p1 : p2;
      const loser = winner === p1 ? p2 : p1;
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
  for (const f of [p1, p2]) {
    f.stateT += sdt;
    if (f.hitT > 0) f.hitT -= sdt;
    if (f.blockT > 0) f.blockT -= sdt;
    if (f.charging > 0) {
      f.charging -= sdt;
      if (f.charging <= 0 && SPECIAL_TYPES.includes(f.atkType)) spawnSpecial(f);
    }
    if (f.state === 'attack') {
      f.atkT -= sdt;
      // hit check at strike moment
      const strikeAt = SPECIAL_TYPES.includes(f.atkType) ? 0.3
                     : f.atkType === 'kick' ? 0.18 : 0.12;
      if (!f.didHit && f.stateT > strikeAt) {
        f.didHit = true;
        const op = f === p1 ? p2 : p1;
        if (!SPECIAL_TYPES.includes(f.atkType) && f.atkType !== 'taunt') {
          const range = f.atkType === 'kick' ? 95 : 75;
          if (Math.abs(op.x - f.x) < range && Math.abs(op.y - f.y) < 40) {
            const hx = (f.x + op.x) / 2;
            damage(op, f.atkType === 'kick' ? KICK_DMG : PUNCH_DMG, hx);
          }
        }
      }
      if (f.atkT <= 0) { f.state = 'idle'; f.didHit = false; f.atkType = null; }
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
    if (f.state !== 'attack') f.didHit = false;
  }

  botAI(p1, p2);
  botAI(p2, p1);

  // projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.t += sdt;
    pr.x += pr.vx * sdt;
    // trail
    if (frame % 2 === 0) sparks.push({ x: pr.x, y: pr.y + rnd(-8, 8), vx: -pr.vx * .15, vy: rnd(-30, 30),
      t: 0, life: .3, col: pick(['#4da6ff', '#9fd0ff', '#fff']) });
    const victim = pr.owner === p1 ? p2 : p1;
    const hitR = pr.wide ? 52 : 34;
    if (Math.abs(victim.x - pr.x) < hitR && Math.abs((victim.y - 92) - pr.y) < (pr.wide ? 70 : 50)) {
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
  // sky: sunset gradient
  const sky = c.createLinearGradient(0, SY, 0, SY + SH);
  sky.addColorStop(0, '#2b1a4d'); sky.addColorStop(0.45, '#a03c5c');
  sky.addColorStop(0.72, '#e8794a'); sky.addColorStop(1, '#f7b95c');
  c.fillStyle = sky; c.fillRect(0, SY, SW, SH);
  // sun
  c.fillStyle = '#ffe9b0';
  c.beginPath(); c.arc(SW * 0.62, SY + SH * 0.52, 26, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,233,176,.35)';
  c.beginPath(); c.arc(SW * 0.62, SY + SH * 0.52, 40, 0, TAU); c.fill();
  // distant castle silhouette
  c.fillStyle = '#3a2140';
  c.fillRect(SW * 0.66, SY + SH * 0.28, 90, SH * 0.3);
  c.beginPath();
  c.moveTo(SW * 0.66, SY + SH * 0.28); c.lineTo(SW * 0.66 + 45, SY + SH * 0.16);
  c.lineTo(SW * 0.66 + 90, SY + SH * 0.28); c.closePath(); c.fill();
  c.fillRect(SW * 0.66 + 38, SY + SH * 0.1, 14, SH * 0.1);
  // dojo building (left)
  c.fillStyle = '#2c1830';
  c.fillRect(SW * 0.02, SY + SH * 0.34, 120, SH * 0.24);
  c.fillStyle = '#1e0f22';
  c.beginPath();
  c.moveTo(SW * 0.02 - 8, SY + SH * 0.34); c.lineTo(SW * 0.02 + 68, SY + SH * 0.24);
  c.lineTo(SW * 0.02 + 128, SY + SH * 0.34); c.closePath(); c.fill();
  // Fūrinkazan signs (stylized kanji banners)
  c.fillStyle = '#f4ead0';
  for (const bx of [SW * 0.30, SW * 0.36]) {
    c.fillRect(bx, SY + SH * 0.30, 26, 60);
    c.fillStyle = '#202020';
    c.font = '900 20px serif'; c.textAlign = 'center';
    c.fillText('風', bx + 13, SY + SH * 0.30 + 24);
    c.fillText('林', bx + 13, SY + SH * 0.30 + 48);
    c.fillStyle = '#f4ead0';
  }
  // cherry blossom trees
  for (const tx of [SW * 0.12, SW * 0.88]) {
    c.fillStyle = '#3a2030';
    c.fillRect(tx - 5, SY + SH * 0.42, 10, SH * 0.2);
    c.fillStyle = '#c46a8a';
    for (let i = 0; i < 14; i++) {
      const px2 = tx + rnd(-42, 42), py2 = SY + SH * 0.42 + rnd(-34, 10);
      c.beginPath(); c.arc(px2, py2, rnd(6, 13), 0, TAU); c.fill();
    }
  }
  // falling petals
  c.fillStyle = 'rgba(240,150,180,.85)';
  for (let i = 0; i < 12; i++) {
    const px2 = (i * 97 + t * 22) % SW, py2 = SY + ((i * 61 + t * 34) % (SH * 0.7));
    c.beginPath(); c.arc(px2, py2, 2.4, 0, TAU); c.fill();
  }
  // bats (right side)
  c.fillStyle = '#1a0f1e';
  for (let i = 0; i < 3; i++) {
    const bx = SW * 0.8 + Math.sin(t * 1.3 + i * 2.1) * 26 + i * 22;
    const by = SY + 40 + Math.cos(t * 1.7 + i) * 12;
    const w2 = 7 + Math.sin(t * 9 + i * 2) * 3;
    c.beginPath();
    c.moveTo(bx - w2, by); c.quadraticCurveTo(bx, by - 6, bx, by);
    c.quadraticCurveTo(bx, by - 6, bx + w2, by);
    c.quadraticCurveTo(bx, by + 4, bx, by); c.quadraticCurveTo(bx, by + 4, bx - w2, by);
    c.fill();
  }
  // stone floor
  const fl = c.createLinearGradient(0, FLOOR, 0, SY + SH);
  fl.addColorStop(0, '#6a6a72'); fl.addColorStop(1, '#3c3c44');
  c.fillStyle = fl; c.fillRect(0, FLOOR, SW, SY + SH - FLOOR);
  // floor tiles
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2;
  for (let i = 0; i <= 9; i++) {
    const tx = (i / 9) * SW;
    c.beginPath(); c.moveTo(tx, FLOOR); c.lineTo(tx - 24, SY + SH); c.stroke();
  }
  for (let j = 0; j < 3; j++) {
    const ty = FLOOR + (j / 3) * (SY + SH - FLOOR);
    c.beginPath(); c.moveTo(0, ty); c.lineTo(SW, ty); c.stroke();
  }
  // floor highlight
  c.fillStyle = 'rgba(255,200,150,.12)'; c.fillRect(0, FLOOR, SW, 6);
  c.restore();
}

/* ── sprite fighter rendering ── */
function fighterSprite(f) {
  const p = f.prefix;
  const fr = FRAMES[p] || FRAMES.ryu;
  const at = f.stateT;
  const idx = (n, prog) => Math.min(n - 1, Math.floor(prog * n));
  switch (f.state) {
    case 'walk': {
      const i = Math.floor(f.walkPhase / 0.55) % fr.walk;
      return sprites[p + '_walk_' + i];
    }
    case 'attack': {
      const dur = SPECIAL_TYPES.includes(f.atkType) ? 0.45
                : f.atkType === 'kick' ? 0.32
                : f.atkType === 'taunt' ? 0.6 : 0.24;
      const prog = clamp(at / dur, 0, 1);
      if (f.atkType === 'punch') return sprites[p + '_punch_' + idx(fr.punch, prog)];
      if (f.atkType === 'kick') return sprites[p + '_kick_' + idx(fr.kick, prog)];
      if (f.atkType === 'taunt') return sprites[p + '_special_' + idx(2, prog)];
      // specials: hadouken / sonicboom / megaphone / gadoken
      const skey = { hadouken: 'hadouken', sonicboom: 'sonic', megaphone: 'megaphone', gadoken: 'gadoken' }[f.atkType];
      // guile sonic starts at frame 1 (frame 0 is the charge crouch, brief)
      const off = (p === 'guile' && f.atkType === 'sonicboom') ? 1 : 0;
      return sprites[p + '_' + skey + '_' + Math.min(fr.special - 1, off + Math.floor(prog * (fr.special - off)))];
    }
    case 'hit':
      return sprites[p + '_idle_0'];
    case 'block':
      return sprites[p + '_idle_' + Math.min(1, fr.idle - 1)];
    case 'ko':
      return sprites[p + '_idle_' + (fr.idle - 1)];
    default: {
      const i = Math.floor(at / 0.38) % fr.idle;
      return sprites[p + '_idle_' + i];
    }
  }
}

function drawFighter(c, f) {
  const img = fighterSprite(f);
  if (!img || !img.complete || !img.naturalWidth) return;
  const w = img.naturalWidth, h = img.naturalHeight;

  c.save();
  // floor shadow
  c.fillStyle = 'rgba(0,0,0,.32)';
  c.beginPath(); c.ellipse(f.x, FLOOR + 6, w * 0.32, 8, 0, 0, TAU); c.fill();

  if (f.state === 'ko') {
    // knocked flat: rotate to lying down
    const k = Math.min(1, f.koT * 5);
    c.translate(f.x, FLOOR - 6);
    c.rotate(-f.facing * k * Math.PI / 2 * 0.92);
    c.scale(f.facing, 1);
    c.drawImage(img, -w / 2, -h);
  } else {
    // hit flash: bright white-hot
    if (f.state === 'hit' && f.hitT > 0 && Math.floor(f.hitT * 20) % 2 === 0) {
      c.filter = 'brightness(2.6) saturate(.4)';
    }
    // block lean
    const lean = f.state === 'block' ? -f.facing * 0.08 : 0;
    c.translate(f.x, FLOOR);
    c.rotate(lean);
    c.scale(f.facing, 1);
    c.drawImage(img, -w / 2, -h);
    c.filter = 'none';
  }
  c.restore();
}

function drawProjectiles(c) {
  for (const pr of projectiles) {
    const img = sprites[pr.img];
    if (!img || !img.complete || !img.naturalWidth) continue;
    const w = img.naturalWidth, h = img.naturalHeight;
    const dir = Math.sign(pr.vx) || 1;
    c.save();
    c.translate(pr.x, pr.y + Math.sin(pr.t * 18) * 3);
    c.scale(dir, 1);
    // megaphone rings expand as they travel
    if (pr.wide) {
      const grow = 1 + pr.t * 1.2;
      c.scale(grow, grow);
    }
    // energy glow
    c.shadowColor = pr.wide ? '#ff4d4d' : '#4da6ff'; c.shadowBlur = 18;
    c.drawImage(img, -w / 2, -h / 2);
    c.restore();
  }
  c.shadowBlur = 0;
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
  for (const [f, left] of [[p1, true], [p2, false]]) {
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
      c.fillStyle = i < (f === p1 ? p1Wins : p2Wins) ? '#ffe95c' : 'rgba(255,255,255,.18)';
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
  const matchup = roundNum === 1 ? 'RYU  vs  GUILE' : 'SAUVAGE  vs  DAN';
  c.fillText(matchup + '  ·  JAPAN STAGE', W/2, 140);
  c.fillStyle = '#ff2c5c'; c.font = '900 20px Impact, sans-serif';
  c.fillText('★ REAL SPRITE FRAMES ★', W/2, 172);
  // bottom: caption bar
  const by = SY + SH;
  const bg2 = c.createLinearGradient(0, by, 0, H);
  bg2.addColorStop(0, '#1a0f2e'); bg2.addColorStop(1, '#0d0618');
  c.fillStyle = bg2; c.fillRect(0, by, W, H - by);
  c.fillStyle = '#fff'; c.font = '900 26px Impact, "Arial Black", sans-serif';
  c.fillText('1991 ENERGY. REAL FRAMES.', W/2, by + 52);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '700 16px Impact, sans-serif';
  const specials = roundNum === 1 ? 'HADOUKEN!  ·  SONIC BOOM!' : 'MEGAPHONE BLAST!  ·  GADOKEN!';
  c.fillText(specials, W/2, by + 86);
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
  if (!spritesReady) {
    ctx.fillStyle = '#0d0618'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe95c'; ctx.font = '900 30px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOADING...', W/2, H/2);
    return;
  }
  drawChrome(ctx);
  drawStage(ctx);
  drawHUD(ctx);
  drawFighter(ctx, p1);
  drawFighter(ctx, p2);
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
  const f = R() < 0.5 ? p1 : p2;
  doAttack(f, pick(['punch', 'kick', 'special']));
};

resetMatch();
g.run(update, draw);
