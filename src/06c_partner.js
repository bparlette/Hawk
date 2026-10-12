
// ---------------- the AI partner MAVIS (Harold's wife: grey afro, floral dress, pearls, handbag swings): always computer-controlled ----------------
// Follows at ~2-4 m on the hero's left (away from the right-shoulder camera), fights thugs engaging either turtle,
// teleports to catch up when stuck / far behind / on the wrong level, revives the hero, boosts it up the fire escape,
// and cuts into the QTE finisher (tag team). One cinematic camera: the partner never drives the camera.
const PART = { kos: 0, heroKos: 0, downs: 0, teleports: 0, hops: 0, climbs: 0, over: false, overT: 0, stuckT: 0, chkT: 0, chkD: 0, tgt: null, combo: 0, rest: 0, mismatchT: 0, fightT: 0, followSamples: 0, followIn: 0, tpLog: [] };
const PART_FIGHT = new Set(['move', 'atk', 'hurt', 'revive']); // states in which thugs may target the partner
const REVIVE_T = 1.2, PARTNER_REVIVE_T = 1.5, REVIVE_R = 2.2;
const BOOST_P = { x: LADDER.x - 1.0, z: LADDER.z - 0.6 }; // where the partner braces for the boost (beside the ladder, clear of the fire escape)
const INTRO_LAND = { x: -46, z: -34.6 }, INTRO_LAND_P = { x: -45.2, z: -34.2 }; // portrait: closer + ahead so it stays in the narrow frame
const PORTRAIT = () => VH() > VW() * 1.15;
const BOOST_W = canvasTex(512, 192, (c) => { comicText(c, 'HUP!', 256, 100, 96, '#2fd3ff', null, { sx: 1 }); });
const TAG_W = canvasTex(512, 192, (c) => { comicText(c, 'TEAMWORK!', 256, 100, 78, '#ff5fd0', null, { sx: 1 }); });
const UP_W = canvasTex(512, 192, (c) => { comicText(c, 'UP, DEAR!', 256, 100, 84, '#9dff6b', null, { sx: 1 }); });

HERO_POSES.revive = (t) => { // kneeling, both hands on the downed turtle's shell, shaking it
  const p = blank(); legsStance(p, 0.22, 0.85); p.y = -0.2; p.lgL = [-1.3, 0, 0.18]; p.knL = [2.1, 0, 0]; p.lgR = [0.1, 0, -0.2]; p.knR = [1.5, 0, 0];
  p.torso = [0.75, 0, 0]; p.neck = [-0.5, 0, 0]; const s = Math.sin(t * 10) * 0.18;
  p.shL = [-1.05 + s, 0, 0.3]; p.shR = [-1.05 - s, 0, -0.3]; p.elL = p.elR = [-0.35, 0, 0]; p.swL = [Math.PI / 2 + 1.3, 0, 0.4]; p.swR = [Math.PI / 2 + 1.3, 0, -0.4];
  return p;
};
HERO_POSES.cup = (k) => { // braced at the wall, hands cupped low (k=0) -> arms thrown overhead (k=1)
  const p = blank(); legsStance(p, 0.28, lerp(1.25, 0.15, k)); p.torso = [lerp(0.55, -0.2, k), 0, 0]; p.neck = [lerp(-0.45, -0.7, k), 0, 0];
  p.shL = [lerp(-0.7, -3.0, k), 0, 0.12]; p.shR = [lerp(-0.7, -3.0, k), 0, -0.12]; p.elL = p.elR = [lerp(-0.7, -0.1, k), 0, 0]; p.haL = p.haR = [0.5, 0, 0];
  p.swR = [Math.PI / 2 + 1.4, 0, -0.2]; return p;
};

function partnerFree() { return !PART.over && partner.hp > 0 && (partner.state === 'move' || partner.state === 'atk') && !CINE.intro; }
function boostReady() { return partnerFree() && !partner.roof && !hero.roof && Math.hypot(partner.pos.x - hero.pos.x, partner.pos.z - hero.pos.z) < 7.5; }
function boostDone() { partner.set('pclimb'); partner.pc = { phase: 0, t: 0 }; }
function startTag(F) { partner.set('tag'); F.tag = { x0: partner.pos.x, z0: partner.pos.z }; F.tagHit = 0; partner.vel.set(0, 0); }
function actHeld() { return KEYS.has('e') || KEYS.has('f') || TOUCHS.btn.c || IN.padAct || !!(IN.bot && IN.bot.actHold); }
function reviveTarget() {
  const P = partner; if (P.state !== 'ko' || PART.over || !!P.roof !== !!hero.roof) return null;
  return Math.hypot(P.pos.x - hero.pos.x, P.pos.z - hero.pos.z) < REVIVE_R ? P : null;
}
function reviveTurtle(f, by) {
  f.hp = Math.round(f.maxHp * 0.5); f.y = 0; f.vy = 0; f.kb.set(0, 0); f.set('getup'); f.inv = 2.2; f.flash = 1; f.J.mat.userData.flashC.value.set('#9dff6b');
  if (by === hero) CINE.stats.revivesByPlayer++; else CINE.stats.revivesByPartner++;
  sfx('ko'); if (f === hero) banner('BACK ON YOUR FEET!'); else spawnSprite(UP_W, _v.set(f.pos.x, f.pos.y + 2.3, f.pos.z), 1.0, 0.9, { kind: 'word', aspect: 512 / 192 });
}
function revivePrompt() {
  if (PART.over) return null;
  if (hero.state === 'ko') return { kind: 'revive', label: 'REVIVE', x: hero.pos.x, y: hero.pos.y + 1.7, z: hero.pos.z, near: false, nokey: true, qte: partner.state === 'revive' ? clamp(partner.rv / PARTNER_REVIVE_T, 0, 1) : 0 };
  if (partner.state === 'ko' && hero.hp > 0) {
    const d = Math.hypot(partner.pos.x - hero.pos.x, partner.pos.z - hero.pos.z); if (d > 30) return null;
    const near = d < REVIVE_R && !!partner.roof === !!hero.roof;
    return { kind: 'revive', label: near ? 'HOLD · REVIVE' : 'REVIVE', x: partner.pos.x, y: partner.pos.y + 1.5, z: partner.pos.z, near, qte: hero.state === 'revive' ? clamp(hero.rv / REVIVE_T, 0, 1) : near ? 0 : undefined };
  }
  return null;
}
function partnerSlot() { // ~2.5 m off the hero's LEFT (the camera rides the right shoulder), a touch ahead
  const f = camFwd(CAM.yaw), r = [-f[1], f[0]], side = PORTRAIT() ? 1.55 : 2.5, ahead = PORTRAIT() ? 1.3 : 0.35;
  return { x: hero.pos.x - r[0] * side + f[0] * ahead, z: hero.pos.z - r[1] * side + f[1] * ahead };
}
const _tmpF = { pos: new THREE.Vector3(), r: 0.45, roof: false };
function settle(x, z, roof) { _tmpF.pos.set(x, roof ? ROOF.y : 0, z); _tmpF.roof = roof; for (let i = 0; i < 3; i++) collide(_tmpF); return { x: _tmpF.pos.x, z: _tmpF.pos.z, y: roof ? ROOF.y : groundY(_tmpF.pos.x, _tmpF.pos.z) }; }
function puffAt(x, y, z, n = 5) { for (let k = 0; k < n; k++) spawnSprite(FXT.puff, _v.set(x + rnd(-0.5, 0.5), y + 0.3 + rnd(0, 0.9), z + rnd(-0.5, 0.5)), rnd(0.8, 1.2), 0.45, { kind: 'grow', depth: true, vel: new THREE.Vector3(rnd(-1.5, 1.5), 1.2, rnd(-1.5, 1.5)) }); }
function partnerTeleport(x, z, roof, why) { // a smoke-puff catch-up
  const P = partner; puffAt(P.pos.x, P.pos.y + P.y, P.pos.z);
  const s = settle(x, z, roof); P.roof = roof; P.pos.set(s.x, s.y, s.z); P.y = 0; P.vy = 0; P.vel.set(0, 0); P.kb.set(0, 0);
  P.yaw = Math.atan2(hero.pos.x - s.x, hero.pos.z - s.z); puffAt(s.x, s.y, s.z, 6); P.flash = 1; P.J.mat.userData.flashC.value.set('#fff');
  P.set('tp'); PART.teleports++; PART.stuckT = 0; PART.chkT = 0; PART.lastTp = why; PART.tpLog.push(why + '@' + S.time.toFixed(1)); if (PART.tpLog.length > 20) PART.tpLog.shift(); sfx('jump');
}
function partnerHop(x, z) { // a flip down off the roof to the hero's side
  const P = partner, s = settle(x, z, false);
  P.hop = { x0: P.pos.x, z0: P.pos.z, wy0: P.pos.y + P.y, x1: s.x, z1: s.z, gy: s.y }; P.set('hop'); P.vel.set(0, 0); PART.hops++; sfx('jump');
}
function engagedThugs() {
  const out = [];
  for (const e of enemies) {
    if (!e.alive || e.fin || e.state === 'dying' || e.state === 'idle' || e.state === 'return' || e.state === 'dizzy') continue;
    const dH = Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z), dP = Math.hypot(e.pos.x - partner.pos.x, e.pos.z - partner.pos.z);
    if ((e.tgt === hero || e.tgt === partner || dH < 3) && dH < 10 && dP < 13) out.push(e);
  }
  return out;
}

function updatePartner(dt) {
  const P = partner; P.st += dt; P.at += dt; P.inv = Math.max(0, P.inv - dt); P.ghost = !(P.state === 'move' || P.state === 'atk' || P.state === 'hurt');
  let pose = null, rate = 16, snapTilt = false;
  const dH = Math.hypot(P.pos.x - hero.pos.x, P.pos.z - hero.pos.z);
  const steer = (x, z, sp, acc = 10) => { // run toward (x,z)
    const dx = x - P.pos.x, dz = z - P.pos.z, d = Math.hypot(dx, dz); if (d < 0.05) { P.vel.x = damp(P.vel.x, 0, acc, dt); P.vel.y = damp(P.vel.y, 0, acc, dt); return d; }
    const s = Math.min(sp, d * 3.2); P.vel.x = damp(P.vel.x, dx / d * s, acc, dt); P.vel.y = damp(P.vel.y, dz / d * s, acc, dt); return d;
  };
  const faceTo = (x, z, k = 12) => { P.yaw += angTo(P.yaw, Math.atan2(x - P.pos.x, z - P.pos.z)) * (1 - Math.exp(-dt * k)); };
  // ---- intro: drops in off the awning line and settles beside the hero ----
  if (CINE.intro && P.state !== 'intro' && !P.introDone) { P.set('intro'); P.root.visible = false; }
  if (P.state === 'intro') {
    const I = CINE.intro, t = I ? I.t : 99, t0 = 2.2, t1 = 3.3;
    const L = PORTRAIT() ? INTRO_LAND_P : INTRO_LAND, gy = groundY(L.x, L.z);
    if (t < t0) { P.root.visible = false; P.pos.set(L.x, gy, L.z); }
    else if (t < t1) {
      P.root.visible = true; const u = (t - t0) / (t1 - t0); P.pos.x = lerp(L.x - 6, L.x, ease(u)); P.pos.z = lerp(L.z - 4.5, L.z, u); P.pos.y = gy;
      const wy = lerp(gy + 6.2, gy, u * u) + 2.0 * u * (1 - u); P.y = Math.max(0, wy - gy); P.yaw = Math.atan2(6, 4.5);
      pose = HERO_POSES.jump(-1); pose.tilt = [ease(clamp((u - 0.1) / 0.75, 0, 1)) * TAU, 0, 0]; pose.lgL = pose.lgR = [-1.3, 0, 0]; pose.knL = pose.knR = [2.0, 0, 0]; snapTilt = true;
    } else {
      if (!P.landed) { P.landed = true; P.y = 0; dust(P.pos.x, P.pos.y, P.pos.z, 5); S.shake = Math.max(S.shake, 0.35); sfx('heavy'); }
      P.root.visible = true; P.pos.set(L.x, gy, L.z); P.y = 0; P.yaw += angTo(P.yaw, HERO_START.yaw) * (1 - Math.exp(-dt * 5));
      pose = t - t1 < 0.45 ? HERO_POSES.getup(clamp((t - t1) / 0.45, 0, 1)) : HERO_POSES.idle(P.at);
    }
    if (!I) { P.introDone = true; P.root.visible = true; P.pos.set(L.x, gy, L.z); P.y = 0; P.set('move'); }
    finishPartner(P, pose || HERO_POSES.idle(P.at), rate, dt, snapTilt, false); return;
  }
  P.introDone = true;
  switch (P.state) {
    case 'tp': { P.vel.set(0, 0); pose = HERO_POSES.getup(clamp(P.st / 0.3, 0, 1)); if (P.st > 0.3) P.set('move'); break; }
    case 'hop': {
      const H = P.hop, u = clamp(P.st / 1.0, 0, 1); P.pos.x = lerp(H.x0, H.x1, ease(u)); P.pos.z = lerp(H.z0, H.z1, ease(u)); P.pos.y = H.gy;
      const wy = lerp(H.wy0, H.gy, u * u) + 2.4 * u * (1 - u); P.y = Math.max(0, wy - H.gy); P.yaw = Math.atan2(H.x1 - H.x0, H.z1 - H.z0);
      pose = HERO_POSES.jump(-1); pose.tilt = [ease(clamp((u - 0.15) / 0.65, 0, 1)) * TAU, 0, 0]; pose.lgL = pose.lgR = [-1.3, 0, 0]; pose.knL = pose.knR = [2.0, 0, 0]; snapTilt = true;
      if (u >= 1) { P.roof = false; P.y = 0; dust(P.pos.x, P.pos.y, P.pos.z, 4); P.set('getup'); P.st = 0.1; }
      finishPartner(P, pose, 18, dt, true, false); return;
    }
    case 'boost': { // braced at the wall beside the ladder; hands cupped, then the launch
      const B = CINE.boost; if (!B) { boostDone(); break; } const t = B.t;
      const u = clamp(t / 0.4, 0, 1); P.pos.x = lerp(B.px0, BOOST_P.x, ease(u)); P.pos.z = lerp(B.pz0, BOOST_P.z, ease(u)); P.pos.y = groundY(P.pos.x, P.pos.z); P.y = 0;
      P.yaw = u < 1 ? Math.atan2(BOOST_P.x - B.px0, BOOST_P.z - B.pz0 + 1e-3) : P.yaw + angTo(P.yaw, Math.PI) * (1 - Math.exp(-dt * 20));
      pose = u < 1 ? HERO_POSES.run(S.time, 7) : HERO_POSES.cup(clamp((t - 0.62) / 0.16, 0, 1)); rate = t > 0.6 ? 26 : 16;
      finishPartner(P, pose, rate, dt, false, false); return;
    }
    case 'pclimb': { // follows the hero up the ladder after a boost (or a solo climb)
      const C = P.pc; C.t += dt;
      if (C.phase === 0) {
        const d = steer(LADDER.x, LADDER.z - 0.45, 6.5); faceTo(LADDER.x, LADDER.z, 10); pose = HERO_POSES.run(P.at, Math.hypot(P.vel.x, P.vel.y));
        P.pos.x += P.vel.x * dt; P.pos.z += P.vel.y * dt; collide(P);
        if (d < 0.35) { C.phase = 1; P.st = 0; P.pos.x = LADDER.x; P.pos.z = LADDER.z; P.yaw = 0; P.vel.set(0, 0); }
        else if (C.t > 6) { partnerTeleport(hero.pos.x, hero.pos.z + 1.5, true, 'climb-stuck'); }
      } else if (C.phase === 1) { P.y += 8.5 * dt; P.yaw = 0; pose = HERO_POSES.climb(P.y * 3.3); if (P.pos.y + P.y >= ROOF.y + 0.75) { C.phase = 2; P.st = 0; C.yTop = P.pos.y + P.y; } }
      else {
        const u = clamp(P.st / 0.45, 0, 1); P.pos.z = lerp(LADDER.z, 12.7, ease(u)); P.y = lerp(C.yTop, ROOF.y, u) + Math.sin(u * Math.PI) * 0.6 - P.pos.y; pose = HERO_POSES.vault(u, -1);
        if (u >= 1) { P.roof = true; P.pos.y = ROOF.y; P.y = 0; P.set('move'); PART.climbs++; dust(P.pos.x, P.pos.y, P.pos.z, 3); }
      }
      if (P.state === 'pclimb' || P.state === 'move') { finishPartner(P, pose || HERO_POSES.idle(P.at), 18, dt, false, false); return; }
      break;
    }
    case 'tag': { // the tag-team hit inside the finisher's slow-mo cut
      const F = CINE.fin; if (!F || !F.tag) { P.set('move'); break; }
      const t = F.t, px = -F.uz * F.side, pz = F.ux * F.side;
      const sx = F.ex - F.ux * 1.45 + px * 0.6, sz = F.ez - F.uz * 1.45 + pz * 0.6; // far side of the thug from the reverse-angle camera, so both turtles read in the slow-mo shot
      if (t < 0.62) { pose = HERO_POSES.idle(P.at); faceTo(F.ex, F.ez, 8); }
      else if (t < 1.0) { const u = ease((t - 0.62) / 0.38); P.pos.x = lerp(F.tag.x0, sx, u); P.pos.z = lerp(F.tag.z0, sz, u); P.pos.y = groundY(P.pos.x, P.pos.z); faceTo(F.ex, F.ez, 20); pose = HERO_POSES.run(S.time, 8); }
      else { P.pos.x = sx; P.pos.z = sz; P.yaw = Math.atan2(F.ex - sx, F.ez - sz); pose = HERO_POSES.atk1(clamp((t - 1.0) / 0.32, 0, 1)); rate = 30; }
      if (!F.tagHit && t >= 1.1) {
        F.tagHit = t; const e = F.e; e.flash = 1; sfx('hit'); S.hits++; S.combo++; S.comboT = 1.5; S.maxCombo = Math.max(S.maxCombo, S.combo); S.shake = Math.max(S.shake, 0.5);
        spawnSprite(FXT.star, _v.set(F.ex, e.pos.y + 1.15, F.ez), 1.4, 0.25, { rot: rnd(0, TAU) }); spawnSlash(_v.set(P.pos.x, P.pos.y + 0.95, P.pos.z), P.yaw + 0.25, 'side', 0.18, 1);
        spawnSprite(TAG_W, _v.set(F.ex - F.ux * 0.4, e.pos.y + 2.3, F.ez - F.uz * 0.4), 0.9, 0.9, { kind: 'word', aspect: 512 / 192, rot: -0.1 }); CINE.stats.tags++;
      }
      if (t >= 1.62) { P.set('move'); P.at = 0; }
      finishPartner(P, pose, rate, dt, false, false); return;
    }
    case 'revive': { // the AI kneels over the downed hero
      P.vel.set(0, 0); P.inv = Math.max(P.inv, 0.2); faceTo(hero.pos.x, hero.pos.z); pose = HERO_POSES.revive(P.st); rate = 14;
      if (hero.state !== 'ko') { P.set('move'); break; }
      P.rv += dt; if (P.rv >= PARTNER_REVIVE_T) { reviveTurtle(hero, P); P.set('move'); }
      break;
    }
    case 'hurt': { P.vel.set(P.kb.x, P.kb.y); P.kb.multiplyScalar(Math.exp(-dt * 7)); pose = HERO_POSES.hurt(clamp(P.st / 0.35, 0, 1)); rate = 22; if (P.st > 0.35) P.set('move'); break; }
    case 'down': {
      P.vel.set(P.kb.x, P.kb.y); P.kb.multiplyScalar(Math.exp(-dt * 3.5)); P.vy -= 22 * dt; P.y = Math.max(0, P.y + P.vy * dt);
      pose = HERO_POSES.down(P.st, P.y <= 0 && P.st > 0.2); rate = 14;
      if (P.hp <= 0 && P.st > 0.9 && P.y <= 0) { P.set('ko'); P.kb.set(0, 0); }
      else if (P.hp > 0 && P.st > 1.0) { P.set('getup'); P.inv = 1.0; }
      break;
    }
    case 'ko': { P.vel.set(0, 0); pose = HERO_POSES.down(1, true); rate = 14; break; }
    case 'getup': { P.vel.set(0, 0); pose = HERO_POSES.getup(clamp(P.st / 0.45, 0, 1)); rate = 14; if (P.st > 0.45) P.set('move'); break; }
    case 'atk': {
      const A = ATK[P.atkN], dur = A.dur * 1.08, u = P.st / dur, T = P.atkT; rate = 30;
      let lsp = 0; if (T && T.alive && T.state !== 'dying') { const dx = T.pos.x - P.pos.x, dz = T.pos.z - P.pos.z, d = Math.hypot(dx, dz); P.yaw += angTo(P.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 18)); lsp = u < 0.45 ? clamp((d - 1.3) * 6, 0, 8) : 0; }
      P.vel.set(Math.sin(P.yaw) * lsp, Math.cos(P.yaw) * lsp);
      const skip = (e) => e.state === 'dizzy' || e.fin; // dizzy thugs are left for the hero's QTE
      if (!P.hitDone && P.st >= A.hit * dur) { P.hitDone = true; spawnSlash(_v.set(P.pos.x, P.pos.y + 0.95 + (P.atkN === 3 ? 0.25 : 0), P.pos.z), P.yaw + (P.atkN === 1 ? 0.25 : P.atkN === 2 ? -0.25 : 0), A.slash, A.roll, P.atkN === 2 ? -1 : 1); resolveSwing(A, P.atkN === 3, P, skip); }
      if (P.atkN === 3 && !P.hit2 && P.st >= 0.62 * dur) { P.hit2 = true; resolveSwing(Object.assign({}, A, { dmg: 1, heavy: true }), true, P, skip); }
      pose = HERO_POSES[A.pose](Math.min(u, 1)); snapTilt = P.atkN === 3;
      if (u >= 1) { PART.combo++; const n = PART.combo; P.set('move'); P.at = 0; if (n >= PART.comboLen || !(T && T.alive)) { PART.combo = 0; PART.rest = rnd(0.35, 0.7); } else PART.next = n + 1; }
      break;
    }
    case 'idle': case 'move': default: {
      P.state = 'move'; PART.rest = Math.max(0, PART.rest - dt);
      if (PART.over) { P.vel.set(0, 0); pose = HERO_POSES.idle(P.at); break; }
      const busyHero = hero.state === 'climb' || hero.state === 'leap' || hero.state === 'boost';
      // 1. the hero is down: get there (teleport if far / other level) and revive
      if (hero.state === 'ko') {
        if (!!P.roof !== !!hero.roof || dH > 12) { partnerTeleport(hero.pos.x - 1.1, hero.pos.z + 0.4, !!hero.roof, 'revive'); break; }
        const d = steer(hero.pos.x, hero.pos.z, 8.6, 14); faceTo(hero.pos.x, hero.pos.z);
        pose = HERO_POSES.run(P.at, Math.hypot(P.vel.x, P.vel.y));
        if (d < 1.15) { P.set('revive'); P.rv = 0; P.vel.set(0, 0); }
        else { PART.chkT += dt; if (PART.chkT > 1.2) { if (PART.chkD - d < 0.5) partnerTeleport(hero.pos.x - 1.1, hero.pos.z + 0.4, !!hero.roof, 'revive-stuck'); PART.chkT = 0; PART.chkD = d; } }
        break;
      }
      // 2. on a different level from the hero: climb after / hop down / teleport
      if (!!P.roof !== !!hero.roof && !busyHero) {
        PART.mismatchT += dt;
        if (hero.roof) { if (Math.hypot(P.pos.x - LADDER.x, P.pos.z - LADDER.z) < 14) { P.set('pclimb'); P.pc = { phase: 0, t: 0 }; } else partnerTeleport(hero.pos.x - 1.5, hero.pos.z + 1.5, true, 'roof'); }
        else if (PART.mismatchT > 0.35) { const sl = partnerSlot(); if (Math.hypot(sl.x - P.pos.x, sl.z - P.pos.z) < 16) partnerHop(sl.x, sl.z); else partnerTeleport(sl.x, sl.z, false, 'street'); }
        if (P.state !== 'move') break;
      } else PART.mismatchT = 0;
      if (busyHero && !!P.roof !== !!hero.roof) { P.vel.set(0, 0); pose = HERO_POSES.idle(P.at); break; }
      // 3. far behind (or lost): smoke-puff catch-up
      if (dH > 16) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!hero.roof, 'far'); break; }
      // 4. fight: thugs engaging either turtle (the ones winding up on the hero first)
      let T = PART.tgt; const eng = engagedThugs();
      if (!T || !eng.includes(T)) { T = null; let bs = 1e9; for (const e of eng) { const s = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) - ((e.state === 'windup' || e.state === 'attack') && e.tgt === hero ? 2.5 : 0) + (e.state === 'down' ? 3 : 0); if (s < bs) { bs = s; T = e; } } PART.tgt = T; }
      let gx, gz, sp, d;
      if (T && !P.roof) {
        PART.fightT += dt; const dx = T.pos.x - P.pos.x, dz = T.pos.z - P.pos.z, dT = Math.hypot(dx, dz);
        if (dT < 1.75 && PART.rest <= 0 && T.state !== 'down') { // swing
          const n = PART.combo > 0 ? PART.next || 1 : 1; if (PART.combo === 0) PART.comboLen = Math.random() < 0.55 ? 3 : 2;
          P.set('atk'); P.atkN = Math.min(3, n); P.atkT = T; P.hitDone = false; P.hit2 = false; P.yaw = Math.atan2(dx, dz); sfx('swing');
          pose = HERO_POSES.idle(P.at); break;
        }
        gx = T.pos.x - dx / (dT || 1) * 1.35; gz = T.pos.z - dz / (dT || 1) * 1.35; sp = 7.4;
        d = steer(gx, gz, sp, 12); faceTo(T.pos.x, T.pos.z, 10);
      } else { // follow: hold the slot on the hero's left, 2-4 m away
        PART.combo = 0; const sl = partnerSlot(); gx = sl.x; gz = sl.z;
        const dS = Math.hypot(gx - P.pos.x, gz - P.pos.z);
        if (dS < 0.9 && dH > 1.6 && dH < 4.3) { P.vel.x = damp(P.vel.x, 0, 10, dt); P.vel.y = damp(P.vel.y, 0, 10, dt); d = dS; const ff = camFwd(CAM.yaw); if (hero.speed < 0.5) faceTo(P.pos.x + ff[0], P.pos.z + ff[1], 3); }
        else { sp = dS > 4 ? 8.6 : clamp(dS * 2.6, 2.2, 7.0); d = steer(gx, gz, sp, 9); if (Math.hypot(P.vel.x, P.vel.y) > 0.5) faceTo(P.pos.x + P.vel.x, P.pos.z + P.vel.y, 12); }
        // stay out of the camera's line to the hero (it rides the right shoulder; never stand between it and the hero)
        const cx = CAM.pos.x, cz = CAM.pos.z, hx = hero.pos.x - cx, hz = hero.pos.z - cz, L2 = hx * hx + hz * hz;
        if (L2 > 0.5) { const u = ((P.pos.x - cx) * hx + (P.pos.z - cz) * hz) / L2; if (u > 0 && u < 1.05) { const qx = cx + hx * u, qz = cz + hz * u, ox = P.pos.x - qx, oz = P.pos.z - qz, od = Math.hypot(ox, oz);
          if (od < 1.1) { const nx = od > 1e-3 ? ox / od : -hz / Math.sqrt(L2), nz = od > 1e-3 ? oz / od : hx / Math.sqrt(L2); P.vel.x += nx * 5 * (1.1 - od); P.vel.y += nz * 5 * (1.1 - od); PART.camDodge = (PART.camDodge || 0) + dt; } } }
        if (dH < 1.5 && dH > 1e-3) { const k = (1.5 - dH) * 6; P.vel.x += (P.pos.x - hero.pos.x) / dH * k; P.vel.y += (P.pos.z - hero.pos.z) / dH * k; } // give the hero room
        PART.followSamples++; if (dH >= 1.6 && dH <= 4.6) PART.followIn++;
      }
      // stuck check against the current goal
      // (stuck = wants to cover >3 m but has barely moved for a second: blocked by a car / wall / crowd)
      PART.chkT += dt; if (PART.chkT > 1.0) { const dg = Math.hypot(gx - P.pos.x, gz - P.pos.z), mv = Math.hypot(P.pos.x - (PART.chkX ?? P.pos.x), P.pos.z - (PART.chkZ ?? P.pos.z)); if (dg > 3 && mv < 0.9) PART.stuckT += PART.chkT; else PART.stuckT = 0; PART.chkT = 0; PART.chkX = P.pos.x; PART.chkZ = P.pos.z; }
      if (PART.stuckT >= 2.0) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!hero.roof, 'stuck'); break; }
      const spd = Math.hypot(P.vel.x, P.vel.y); P.speed = spd; pose = spd > 0.6 ? HERO_POSES.run(P.at, spd) : HERO_POSES.idle(P.at);
      if (spd > 4 && Math.random() < dt * 4) dust(P.pos.x, P.pos.y, P.pos.z, 1);
      break;
    }
  }
  if (P.state !== 'tp' || P.st > 0) { P.pos.x += P.vel.x * dt; P.pos.z += P.vel.y * dt; }
  if (P.state !== 'pclimb') collide(P);
  finishPartner(P, pose || HERO_POSES.idle(P.at), rate, dt, snapTilt, true);
}
function finishPartner(P, pose, rate, dt, snapTilt, tails) {
  applyPose(P.J, pose, rate, dt, snapTilt);
  for (const [i, t] of P.J.tails.entries()) t.rotation.x = damp(t.rotation.x, 0.5 + clamp(Math.hypot(P.vel.x, P.vel.y) / 6, 0, 1) * 0.9 + Math.sin(S.time * 11 + i + 2) * 0.12, 10, dt);
  P.sync(dt);
  // both turtles down = game over: a beat, then both back on their feet at the south end of the street
  if (!PART.over && hero.state === 'ko' && P.state === 'ko') { PART.over = true; PART.overT = 0; banner('GAME OVER', 3.4); CINE.stats.gameOvers++; }
  if (PART.over) { PART.overT += dt; if (PART.overT > 3.2) resetTurtles(); }
}
function resetTurtles() {
  PART.over = false; QTE = null;
  for (const [f, x, z] of [[hero, HERO_START.x, HERO_START.z], [partner, INTRO_LAND.x, INTRO_LAND.z]]) { f.roof = false; f.pos.set(x, groundY(x, z), z); f.y = 0; f.vy = 0; f.vel.set(0, 0); f.kb.set(0, 0); f.hp = f.maxHp; f.yaw = HERO_START.yaw; f.set('getup'); f.inv = 3; f.root.visible = true; }
  for (const e of enemies) if (e.alive && e.state !== 'dying') { e.hp = e.maxHp; e.dizzied = false; e.fin = false; e.y = 0; e.set('return'); }
  CAM.yaw = HERO_START.camYaw; snapCam(); cut(); banner('TRY AGAIN!', 1.4);
}
