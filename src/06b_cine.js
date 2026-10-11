
// ---------------- Cinema City: letterbox, contextual one-button prompts (ladder / rooftop leap / car vault / door kick),
// dizzy-thug QTE finisher with camera cuts + slow-mo, and the intro camera sweep ----------------
const CINE_ST = new Set(['climb', 'leap', 'vault', 'kick', 'fin', 'boost']);
const DIZZY_T = 2.8;
const ROOF = { x0: 11.75, x1: 23.25, z0: 11.75, z1: 23.25, y: LADDER.roofY, ac: { x0: 13.85, x1: 15.95, z0: 18.7, z1: 20.2 } };
const CINE = { lb: 0, intro: null, fin: null, cutT: 0, stats: { climbs: 0, leaps: 0, vaults: 0, kicks: 0, finishers: 0, qteOpened: 0, qteMissed: 0, pizza: 0, introDone: false, introSkipped: false, introSec: 0, boosts: 0, tags: 0, revivesByPlayer: 0, revivesByPartner: 0, gameOvers: 0 } };
let QTE = null;

// ---- extra poses ----
HERO_POSES.climb = (ph) => {
  const p = blank(), s = Math.sin(ph);
  p.shL = [-2.7 - 0.4 * s, 0, 0.2]; p.shR = [-2.7 + 0.4 * s, 0, -0.2]; p.elL = [-0.45 + 0.45 * s, 0, 0]; p.elR = [-0.45 - 0.45 * s, 0, 0];
  p.swL = [Math.PI / 2 + 2.2, 0, 0.4]; p.swR = [Math.PI / 2 + 2.2, 0, -0.4];
  p.lgL = [-0.95 + 0.55 * s, 0, 0.12]; p.knL = [1.3 - 0.55 * s, 0, 0]; p.lgR = [-0.95 - 0.55 * s, 0, -0.12]; p.knR = [1.3 + 0.55 * s, 0, 0];
  p.torso = [-0.05, 0, 0]; p.neck = [-0.45, 0, 0]; p.y = 0.02; return p;
};
HERO_POSES.kick = (u) => {
  const p = HERO_POSES.idle(0), a = ease(clamp((u - 0.15) / 0.28, 0, 1)), b = ease(clamp((u - 0.65) / 0.35, 0, 1)), k = a * (1 - b);
  p.lgR = [lerp(0.25, -1.65, k), 0, -0.1]; p.knR = [lerp(1.1, 0.05, k), 0, 0]; p.ftR = [lerp(0, 0.6, k), 0, 0];
  p.lgL = [-0.2, 0, 0.12]; p.knL = [0.35, 0, 0]; p.torso = [lerp(0.25, -0.4, k), 0.1, 0]; p.hips = [0, 0.2, 0];
  p.shL = [-0.6, 0, 1.0]; p.shR = [-0.3, 0, -1.1]; return p;
};
HERO_POSES.vault = (u, side) => {
  const p = HERO_POSES.jump(1), s = Math.sin(u * Math.PI);
  p.tilt = [0, 0, s * 0.9 * side]; p.shL = [-1.2 * s, 0, 0.6]; p.shR = [-1.2 * s, 0, -0.6]; p.lgL = p.lgR = [-1.1 * s, 0, 0]; p.knL = p.knR = [1.2 * s + 0.3, 0, 0];
  return p;
};
THUG_POSES.dizzy = (t, J) => {
  const p = THUG_POSES.hurt(0.35, J); legsStance(p, 0.2, 0.55 + Math.sin(t * 2.3) * 0.15);
  p.tilt = [Math.sin(t * 2.6) * 0.08, 0, Math.sin(t * 3.1) * 0.2]; p.neck = [0.3, Math.sin(t * 2.0) * 0.5, 0];
  p.shL = [0.15, 0, 0.35 + Math.sin(t * 4) * 0.2]; p.shR = [0.15, 0, -0.35 - Math.sin(t * 4) * 0.2]; p.elL = p.elR = [-0.35, 0, 0]; p.torso = [0.25, Math.sin(t * 1.7) * 0.3, 0];
  return p;
};

// ---- the alley door (kick open: hides a pizza box) ----
const DOOR = { x: DOOR_AT.x, z: DOOR_AT.z, open: false, ang: 0 };
const PROPM = toonMat();
const doorG = new THREE.Group(); doorG.userData.mat = PROPM; scene.add(doorG);
part(doorG, G.box(0.05, 2.75, 1.7), '#14101f', DOOR.x - 0.03, CURB + 1.37, DOOR.z, { outline: false, shadow: false });
part(doorG, G.box(0.22, 0.24, 1.95), '#8a7a5a', DOOR.x + 0.02, CURB + 2.86, DOOR.z);
part(doorG, G.box(0.16, 0.5, 0.9), '#a02a2a', DOOR.x + 0.04, CURB + 3.35, DOOR.z);
const hinge = new THREE.Group(); hinge.userData.mat = PROPM; hinge.position.set(DOOR.x + 0.1, CURB, DOOR.z - 0.72); doorG.add(hinge);
part(hinge, G.box(0.1, 2.6, 1.44), '#3a5a58', 0, 1.3, 0.72);
part(hinge, G.box(0.04, 0.5, 1.1), '#2a403e', 0.06, 0.4, 0.72, { outline: false });
part(hinge, G.box(0.08, 0.1, 0.2), '#ffd23c', 0.08, 1.25, 1.25, { outline: false });
// "NO ENTRY" style stencil, drawn on the sign
{ const t = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#a02a2a'; c.fillRect(0, 0, w, h); comicText(c, 'STAFF', w / 2, h / 2 + 4, 70, '#fff', null, { shadow: false }); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.44), basicSnap({ map: t })); m.position.set(DOOR.x + 0.13, CURB + 3.35, DOOR.z); m.rotation.y = Math.PI / 2; scene.add(m); }
const pizza = new THREE.Group(); pizza.userData.mat = PROPM; pizza.visible = false; scene.add(pizza);
part(pizza, G.box(0.62, 0.14, 0.62), '#fff0d6'); part(pizza, G.box(0.42, 0.02, 0.2), '#ff3d6e', 0, 0.08, 0, { outline: false });
const PIZZA = { on: false, t: 0, x: 0, z: 0 };
const PIZZA_W = canvasTex(512, 192, (c) => { comicText(c, 'PIZZA! +50', 256, 100, 84, '#ffd23c', null, { sx: 1 }); });

// ---- the action list: one button, contextual ----
const ACTIONS = [];
// with the partner close and free, the ladder spot offers a two-turtle BOOST instead of the solo CLIMB
// (K: no fire-escape CLIMB / BOOST / rooftop LEAP on this one street: the door kick, car vaults and the QTE finisher remain)
ACTIONS.push({ kind: 'door', label: 'KICK OPEN', x: DOOR.x + 0.85, z: DOOR.z, r: 1.5, y: 2.1, ok: () => !DOOR.open && !hero.roof, go: startKick });
for (const [cx, cz, alongX] of CARS) {
  for (const s of [-1, 1]) {
    const ax = alongX ? cx : cx + s * 1.78, az = alongX ? cz + s * 1.78 : cz, bx = alongX ? cx : cx - s * 1.85, bz = alongX ? cz - s * 1.85 : cz;
    ACTIONS.push({ kind: 'vault', label: 'VAULT', x: ax, z: az, r: 1.35, y: 1.9, bx, bz, cx, cz, ok: () => !hero.roof, go: (A) => startVault(A) });
  }
}
function actionInRange() {
  const h = hero; if (h.state !== 'move' || h.y > 0.05 || CINE.intro) return null;
  let best = null, bd = 1e9;
  for (const A of ACTIONS) { if (!A.ok()) continue; const d = Math.hypot(A.x - h.pos.x, A.z - h.pos.z); if (d < A.r && d < bd) { bd = d; best = A; } }
  return best;
}
function qteTarget() { // nearest dizzy thug within reach
  if (!(hero.state === 'move' || hero.state === 'atk') || hero.roof) return null; let best = null, bd = 4.6;
  for (const e of enemies) { if (e.state !== 'dizzy' || e.fin) continue; const d = Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z); if (d < bd) { bd = d; best = e; } }
  return best;
}
function qteInRange() { return !!qteTarget(); }
function tryAction() {
  if (CINE.intro) return false;
  const qt = qteTarget(); if (qt) { startFinisher(qt); return true; }
  const A = actionInRange(); if (A) { A.go(A); return true; }
  return false;
}
function qteOpen(e) { QTE = { e, t0: S.time }; CINE.stats.qteOpened++; }

// ---- action starters ----
function startClimb() { const h = hero; h.set('climb'); h.cl = { phase: 0, x0: h.pos.x, z0: h.pos.z }; h.vel.set(0, 0); h.yaw = 0; sfx('jump'); cut(); }
function startLeap() { const h = hero; h.set('leap'); h.lp = { x0: h.pos.x, z0: h.pos.z, x1: 9.3, z1: 23.6, y0: ROOF.y }; h.vel.set(0, 0); h.yaw = -Math.PI / 2; sfx('jump'); cut(); }
function startVault(A) { const h = hero; h.set('vault'); h.vt = { x0: h.pos.x, z0: h.pos.z, x1: A.bx, z1: A.bz, side: Math.random() < 0.5 ? 1 : -1 }; h.yaw = Math.atan2(A.bx - h.pos.x, A.bz - h.pos.z); h.vel.set(0, 0); sfx('jump'); }
function startBoost() { // the partner cups its hands at the ladder and launches the hero up the wall
  const h = hero; h.set('boost'); h.vel.set(0, 0); h.bs = { x0: h.pos.x, z0: h.pos.z, launched: false, yTop: 0 };
  CINE.boost = { t: 0, shot: -1, px0: partner.pos.x, pz0: partner.pos.z }; partner.set('boost'); partner.vel.set(0, 0);
  if (Math.hypot(partner.pos.x - BOOST_P.x, partner.pos.z - BOOST_P.z) > 7) { CINE.boost.px0 = BOOST_P.x - 1.2; CINE.boost.pz0 = BOOST_P.z - 1.2; }
  CINE.stats.boosts++; sfx('jump'); cut();
}
function startKick() { const h = hero; h.set('kick'); h.kk = { done: false }; h.vel.set(0, 0); sfx('swing'); }
function startFinisher(e) {
  const h = hero, dx = h.pos.x - e.pos.x, dz = h.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
  CINE.lastFin = e.id; CINE.fin = { e, t: 0, ux: dx / d, uz: dz / d, sx: h.pos.x, sz: h.pos.z, ex: e.pos.x, ez: e.pos.z, hit: 0, side: Math.random() < 0.5 ? 1 : -1, shot: -1 };
  // tag team: the partner (free and within ~8 m) cuts in with a staff hit just before the flip strike
  if (partnerFree() && !partner.roof && Math.hypot(partner.pos.x - e.pos.x, partner.pos.z - e.pos.z) < 8.5) startTag(CINE.fin);
  e.fin = true; e.dz.visible = false; e.hpS.visible = false; e.yaw = Math.atan2(dx, dz); h.set('fin'); h.vel.set(0, 0); h.y = 0; h.vy = 0; QTE = null; lockT = null; sfx('swing');
}
function cut() { CINE.cutT = 1; }
function word(tex, x, y, z, big = 1) { spawnSprite(tex, _v.set(x + rnd(-0.3, 0.3), y, z), 1.05 * big, 0.7, { kind: 'word', aspect: 512 / 192, rot: rnd(-0.18, 0.18) }); }

// ---- per-state hero choreography (runs in sim time from updateHero) ----
function cineHero(h, dt) {
  if (h.state === 'climb') {
    const C = h.cl; let pose;
    if (C.phase === 0) { // jump up to grab the ladder
      const u = clamp(h.st / 0.3, 0, 1); h.pos.x = lerp(C.x0, LADDER.x, ease(u)); h.pos.z = lerp(C.z0, LADDER.z, ease(u)); h.y = Math.sin(u * Math.PI / 2) * 0.9;
      pose = HERO_POSES.jump(1); if (u >= 1) { C.phase = 1; h.st = 0; }
    } else if (C.phase === 1) { // climb
      h.y += 10.5 * dt; pose = HERO_POSES.climb(h.y * 3.3);
      if (h.pos.y + h.y >= ROOF.y + 0.75) { C.phase = 2; h.st = 0; C.yTop = h.pos.y + h.y; }
    } else { // vault over the parapet onto the roof
      const u = clamp(h.st / 0.45, 0, 1); h.pos.z = lerp(LADDER.z, 12.7, ease(u)); const wy = lerp(C.yTop, ROOF.y, u) + Math.sin(u * Math.PI) * 0.7; h.y = wy - h.pos.y;
      pose = HERO_POSES.vault(u, 1);
      if (u >= 1) { h.roof = true; h.pos.y = ROOF.y; h.y = 0; h.set('move'); CAM.yaw = Math.PI; snapCam(); cut(); CINE.stats.climbs++; dust(h.pos.x, h.pos.y, h.pos.z, 3); }
    }
    return pose;
  }
  if (h.state === 'leap') {
    const L = h.lp, u = clamp(h.st / 1.3, 0, 1);
    h.pos.x = lerp(L.x0, L.x1, ease(u)); h.pos.z = lerp(L.z0, L.z1, u);
    const gy = groundY(L.x1, L.z1), wy = lerp(L.y0, gy, u * u) + 3.2 * u * (1 - u); h.pos.y = gy; h.y = Math.max(0, wy - gy);
    let pose;
    if (u < 0.12) pose = HERO_POSES.jump(1);
    else if (u < 0.85) { pose = HERO_POSES.jump(-1); pose.tilt = [ease(clamp((u - 0.12) / 0.6, 0, 1)) * TAU, 0, 0]; pose.lgL = pose.lgR = [-1.4, 0, 0]; pose.knL = pose.knR = [2.0, 0, 0]; }
    else { pose = HERO_POSES.jump(-1); }
    if (u >= 1) { h.roof = false; h.y = 0; h.set('getup'); h.st = 0.1; dust(h.pos.x, h.pos.y, h.pos.z, 6); S.shake = 1; sfx('heavy'); CAM.yaw = Math.PI / 2; snapCam(); cut(); CINE.stats.leaps++; }
    return pose;
  }
  if (h.state === 'vault') {
    const V = h.vt, u = clamp(h.st / 0.6, 0, 1);
    h.pos.x = lerp(V.x0, V.x1, ease(u)); h.pos.z = lerp(V.z0, V.z1, ease(u)); h.y = Math.sin(u * Math.PI) * 1.75;
    if (u >= 1) { h.y = 0; h.set('move'); collide(h); dust(h.pos.x, h.pos.y, h.pos.z, 2); CINE.stats.vaults++; }
    return HERO_POSES.vault(u, V.side);
  }
  if (h.state === 'boost') { // 0-0.45 run in, 0.45-0.7 step into the cupped hands, 0.7 LAUNCH, 0.7-1.45 flip up the wall, 1.45-1.9 vault the parapet
    const B = CINE.boost, Bh = h.bs; B.t += dt; const t = B.t; let pose;
    const ax = BOOST_P.x, az = BOOST_P.z - 1.35;
    if (t < 0.45) { const u = ease(t / 0.45); h.pos.x = lerp(Bh.x0, ax, u); h.pos.z = lerp(Bh.z0, az, u); h.yaw = Math.atan2(BOOST_P.x - h.pos.x, BOOST_P.z - h.pos.z + 0.01); pose = HERO_POSES.run(S.time, 7); }
    else if (t < 0.7) { const u = (t - 0.45) / 0.25; h.pos.z = lerp(az, BOOST_P.z - 0.35, ease(u)); h.pos.x = ax; h.y = Math.sin(u * Math.PI / 2) * 0.55; h.yaw = 0; pose = HERO_POSES.jump(1); pose.knL = pose.knR = [1.6, 0, 0]; }
    else if (t < 1.45) {
      if (!Bh.launched) { Bh.launched = true; sfx('heavy'); S.shake = Math.max(S.shake, 0.6); dust(BOOST_P.x, h.pos.y, BOOST_P.z, 4); word(BOOST_W, BOOST_P.x, h.pos.y + 2.2, BOOST_P.z - 0.4, 1.1); }
      const u = (t - 0.7) / 0.75, k = 1 - (1 - u) * (1 - u); h.pos.z = lerp(BOOST_P.z - 0.35, LADDER.z, k); h.pos.x = ax;
      const wy = lerp(h.pos.y + 0.55, ROOF.y + 1.05, k); h.y = wy - h.pos.y; Bh.yTop = wy; h.yaw = 0;
      pose = HERO_POSES.jump(1); pose.tilt = [ease(clamp(u / 0.85, 0, 1)) * TAU, 0, 0]; pose.lgL = pose.lgR = [-1.3, 0, 0]; pose.knL = pose.knR = [1.9, 0, 0];
    } else {
      const u = clamp((t - 1.45) / 0.45, 0, 1); h.pos.z = lerp(LADDER.z, 12.7, ease(u)); const wy = lerp(Bh.yTop, ROOF.y, u) + Math.sin(u * Math.PI) * 0.45; h.y = wy - h.pos.y;
      pose = HERO_POSES.vault(u, 1); pose.tilt = [0, 0, Math.sin(u * Math.PI) * 0.6];
      if (u >= 1) { h.roof = true; h.pos.y = ROOF.y; h.y = 0; h.set('move'); CAM.yaw = Math.PI; snapCam(); cut(); CINE.stats.climbs++; CINE.boost = null; dust(h.pos.x, h.pos.y, h.pos.z, 3); boostDone(); }
    }
    return pose;
  }
  if (h.state === 'kick') {
    const u = clamp(h.st / 0.6, 0, 1); h.yaw += angTo(h.yaw, -Math.PI / 2) * (1 - Math.exp(-dt * 16));
    if (!h.kk.done && u > 0.38) {
      h.kk.done = true; DOOR.open = true; sfx('heavy'); S.shake = Math.max(S.shake, 0.7); S.hitstop = 0.08;
      spawnSprite(FXT.star, _v.set(DOOR.x + 0.2, 1.1, DOOR.z), 1.4, 0.25); word(FXT.words[4], DOOR.x + 0.6, 2.4, DOOR.z, 1.1);
      for (let k = 0; k < 4; k++) dust(DOOR.x + 0.4, 0.4, DOOR.z + rnd(-0.6, 0.6), 1);
      PIZZA.on = true; PIZZA.t = 0; PIZZA.x = DOOR.x + 0.3; PIZZA.z = DOOR.z; pizza.visible = true; CINE.stats.kicks++;
    }
    if (u >= 1) h.set('move');
    return HERO_POSES.kick(u);
  }
  // 'fin': the QTE finisher. Timeline (finisher seconds; 1.02-1.62 plays at 0.35x = slow-mo):
  //  0-0.22 dash in, 0.22-0.62 slash, 0.62-1.02 backhand, 1.02-1.62 flip cut (slow-mo), 1.62 launch, 2.1 back to play
  const F = CINE.fin, e = F.e; F.t += dt * (F.t > 1.02 && F.t < 1.62 ? 0.35 : 1);
  const t = F.t, tx = F.ex + F.ux * 1.25, tz = F.ez + F.uz * 1.25; let pose;
  h.yaw = Math.atan2(F.ex - h.pos.x, F.ez - h.pos.z);
  if (t < 0.22) { const u = ease(t / 0.22); h.pos.x = lerp(F.sx, tx, u); h.pos.z = lerp(F.sz, tz, u); pose = HERO_POSES.run(S.time, 8); }
  else if (t < 0.62) { h.pos.x = tx; h.pos.z = tz; pose = HERO_POSES.atk1((t - 0.22) / 0.4); }
  else if (t < 1.02) pose = HERO_POSES.atk2((t - 0.62) / 0.4);
  else if (t < 1.62) { const u = (t - 1.02) / 0.6; pose = HERO_POSES.airatk(u); h.y = Math.sin(u * Math.PI) * 1.9; }
  else { h.y = 0; pose = HERO_POSES.idle(S.time); }
  const at = (y) => _v.set(F.ex, y, F.ez);
  if (F.hit === 0 && t >= 0.4) { F.hit = 1; e.flash = 1; sfx('hit'); spawnSprite(FXT.star, at(e.pos.y + 1.2), 1.3, 0.22, { rot: rnd(0, TAU) }); spawnSlash(_v.set(h.pos.x, h.pos.y + 0.95, h.pos.z), h.yaw + 0.25, 'side', 0.18, 1); word(FXT.words[1], F.ex, e.pos.y + 2.2, F.ez); S.shake = 0.4; }
  if (F.hit === 1 && t >= 0.8) { F.hit = 2; e.flash = 1; sfx('hit'); spawnSprite(FXT.star, at(e.pos.y + 1.3), 1.3, 0.22, { rot: rnd(0, TAU) }); spawnSlash(_v.set(h.pos.x, h.pos.y + 0.95, h.pos.z), h.yaw - 0.25, 'side', -0.18, -1); S.shake = 0.4; }
  if (F.hit === 2 && t >= 1.62) {
    F.hit = 3; e.fin = false; e.hp = 0; e.dead = true; e.lastBy = hero; e.set('down'); e.kb.set(-F.ux * 9, -F.uz * 9); e.vy = 7.5; e.y = 0.01; e.yaw = Math.atan2(F.ux, F.uz);
    e.flash = 1; S.hits += 3; S.combo += 3; S.comboT = 1.5; S.maxCombo = Math.max(S.maxCombo, S.combo); S.shake = 1.1; sfx('heavy');
    spawnSlash(_v.set(F.ex, e.pos.y + 0.6, F.ez), h.yaw, 'spin', 0); word(FXT.words[3], F.ex, e.pos.y + 2.4, F.ez, 1.3); spawnSprite(FXT.star, at(e.pos.y + 1.0), 1.8, 0.3);
    CINE.stats.finishers++;
  }
  if (e.fin && t > 0.22) { // the dizzy thug reels under the hits
    const k = t < 0.62 ? (t - 0.4) : t < 1.02 ? (F.tagHit ? t - F.tagHit : t - 0.8) : (t - 1.02) * 0.4; applyPose(e.J, THUG_POSES.hurt(clamp(k > 0 ? k / 0.3 : 0.8, 0, 1), e.J), 22, dt, false);
    if (t > 1.02) { e.J.tilt.rotation.x = damp(e.J.tilt.rotation.x, F.tagHit ? -0.8 : -0.5, F.tagHit ? 10 : 6, dt); }
  }
  if (t >= 2.1) { h.set('move'); h.y = 0; CINE.fin = null; snapCam(); cut(); }
  return pose;
}
function snapCam() { CAM.pivot.set(hero.pos.x, hero.pos.y + 1.55, hero.pos.z); CAM.cur = CAM.dist = 4.4; IN.lastLook = -9; }

// ---- cinematic cameras (finisher cuts, climb, leap, intro) ----
const _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3();
function cineCamActive() { return !!CINE.fin || hero.state === 'climb' || hero.state === 'leap' || hero.state === 'boost'; }
function cineCamera(rdt) {
  const h = hero; let fov = 50; camera.up.set(0, 1, 0);
  if (CINE.fin) {
    const F = CINE.fin, t = F.t, px = -F.uz * F.side, pz = F.ux * F.side, mx = (h.pos.x + F.ex) / 2, mz = (h.pos.z + F.ez) / 2, gy = h.pos.y;
    const pk = VW() < VH() ? 1.55 : 1; // portrait: pull the cut cameras back so both fighters fit
    const shot = t < 0.62 ? 0 : t < 1.62 ? 1 : 2; if (shot !== F.shot) { F.shot = shot; cut(); }
    if (shot === 0) { // low, long-lens side angle with a slow dolly in
      const d = (4.6 - t * 1.2) * pk; _c1.set(mx + px * d, gy + 0.55, mz + pz * d); _c2.set(mx, gy + 1.15, mz); fov = 42;
    } else if (shot === 1) { // reverse angle over the thug's shoulder, looking up at the flip (slow-mo), dutch tilt
      const u = clamp((t - 0.62) / 1.0, 0, 1); _c1.set(mx - px * (4.8 - u * 0.7) * pk - F.ux * 1.4, gy + 1.2 + u * 0.8, mz - pz * (4.8 - u * 0.7) * pk - F.uz * 1.4); _c2.set(mx + F.ux * 0.2, gy + 1.2 + h.y * 0.5, mz + F.uz * 0.2); fov = 52;
      camera.up.set(px * 0.18, 1, pz * 0.18).normalize();
    } else { // wide follow of the launched thug
      _c1.set(F.ex - px * 6.5 * pk + F.ux * 1.5, gy + 2.6, F.ez - pz * 6.5 * pk + F.uz * 1.5); _c2.set(F.e.pos.x, F.e.pos.y + 0.8 + F.e.y * 0.5, F.e.pos.z); fov = 52;
    }
    // keep the cut cameras out of walls
    let tt = 1; for (const b of BLD) { const k = segBox(_c2.x, _c2.y, _c2.z, _c1.x, _c1.y, _c1.z, b, 0.3); if (k < tt) tt = k; }
    if (tt < 1) _c1.lerpVectors(_c2, _c1, Math.max(0.25, tt - 0.05));
  } else if (h.state === 'boost' && CINE.boost) {
    const B = CINE.boost, shot = B.t < 0.7 ? 0 : 1; if (shot !== B.shot) { if (B.shot >= 0) cut(); B.shot = shot; }
    const pk = VW() < VH() ? 1.45 : 1;
    if (shot === 0) { // low street-side two-shot: the partner braced at the wall, the hero running in
      _c1.set(BOOST_P.x - 5.6 * pk, 0.95, BOOST_P.z - 1.3); _c2.set(BOOST_P.x, 1.2, BOOST_P.z - 0.75); fov = 50; // side-on, so the run-in and the cupped hands read
    } else { // cut: high over the street, looking along the wall as the hero is flung up to the parapet
      const wy = h.pos.y + h.y; _c1.set(BOOST_P.x - 3.6 * pk, ROOF.y + 2.2, BOOST_P.z - 6.0 * pk); _c2.set(h.pos.x, lerp(wy + 0.6, ROOF.y + 0.6, 0.35), h.pos.z); fov = 56;
    }
  } else if (h.state === 'climb') { // street-level camera tilting up the fire escape
    const wy = h.pos.y + h.y; _c1.set(LADDER.x - 3.4, 1.1 + wy * 0.42, LADDER.z - 9.5); _c2.set(h.pos.x, wy + 1.0, h.pos.z); fov = 54;
  } else { // leap: low camera at the landing spot looking up at the fall
    const wy = h.pos.y + h.y; _c1.set(6.6, 0.9, 30.5); _c2.set(h.pos.x, wy + 0.9, h.pos.z); fov = 55;
  }
  camera.position.copy(_c1);
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - rdt * 3); const k = S.shake * S.shake * 0.2; camera.position.x += rnd(-k, k); camera.position.y += rnd(-k, k); }
  camera.lookAt(_c2); setFov(fov);
}
function introCamera(rdt) {
  const I = CINE.intro; I.t += rdt; if (I.skip) I.t = Math.max(I.t, I.dur);
  const u = clamp(I.t / I.dur, 0, 1), e = ease(u);
  // crane: high over the north barricade looking down the block, travelling south and down to settle behind Harold
  _c1.set(lerp(40, hero.pos.x - 6, e), lerp(58, 5, e), lerp(32, hero.pos.z + 2, e)); _c2.set(lerp(-10, hero.pos.x + 6, e), lerp(0, 1.5, e), lerp(-30, hero.pos.z, e)); // crane: high over the harbour, sweeping in to settle behind Harold at Harborplace
  const k = ease(clamp((I.t - I.dur * 0.55) / (I.dur * 0.45), 0, 1));
  camera.position.lerpVectors(_c1, CAM.pos, k); camera.up.set(0, 1, 0); camera.lookAt(_c2.lerp(CAM.look, k)); setFov(lerp(64, 58, k));
  if (I.t >= I.dur) { CINE.intro = null; CINE.stats.introDone = true; CINE.stats.introSkipped = !!I.skip; CINE.stats.introSec = +I.t.toFixed(2); $('title').classList.remove('on'); $('hint').style.opacity = '1'; setTimeout(() => { $('hint').style.opacity = '0'; }, 8000); }
}

// ---- per rendered frame: letterbox, cut flash, prompts, door, pizza, QTE bookkeeping ----
const PRM = { el: $('prompt'), key: $('pkey'), lab: $('plab'), ico: $('pico'), ring: $('pring'), cur: null };
const ICONS = {
  climb: '<path d="M7 2v20M17 2v20M7 6h10M7 11h10M7 16h10"/>',
  drop: '<path d="M12 3v14M6 11l6 6 6-6M4 21h16"/>',
  door: '<path d="M5 21V3h11v18M16 5l4 2v14M12 12h1"/>',
  vault: '<path d="M3 18h18M6 18v-4h12v4M4 9c4-6 12-6 16 0M17 6l3 3-4 1"/>',
  fin: '<path d="M12 2l2.6 6.2L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.8z"/>',
  boost: '<path d="M12 3v11M7 8l5-5 5 5M4 17c3 3 13 3 16 0M7 21h10"/>',
  revive: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM12 9v6M9 12h6"/>',
};
function cineUpdate(rdt) {
  const h = hero;
  // QTE bookkeeping
  if (QTE && QTE.e.state !== 'dizzy' && !QTE.e.fin) { if (QTE.e.state === 'chase' || QTE.e.state === 'return') CINE.stats.qteMissed++; QTE = null; }
  // letterbox: full in cinematics, half in fights, off when exploring
  const fighting = lockT && lockT.alive && h.state !== 'down';
  const tgt = CINE.intro || CINE.fin || h.state === 'climb' || h.state === 'leap' || h.state === 'boost' || PART.over ? 1 : h.state === 'vault' || h.state === 'kick' || QTE ? 0.75 : fighting ? 0.5 : 0;
  CINE.lb = damp(CINE.lb, tgt, CINE.intro ? 20 : 3.5, rdt);
  const portrait = VH() > VW() * 1.15, H = Math.round(CINE.lb * Math.min(VH() * (portrait ? 0.075 : 0.11), 88));
  if (H !== CINE.lbH) { CINE.lbH = H; $('lbT').style.height = H + 'px'; $('lbB').style.height = H + 'px'; }
  if (CINE.cutT > 0) { CINE.cutT = Math.max(0, CINE.cutT - rdt * 7); $('cut').style.opacity = (CINE.cutT * 0.5).toFixed(2); }
  // door swing + pizza
  if (DOOR.open) { DOOR.ang = damp(DOOR.ang, -1.55, 9, rdt); hinge.rotation.y = DOOR.ang; }
  if (PIZZA.on) {
    PIZZA.t += rdt; const u = clamp(PIZZA.t / 0.5, 0, 1); pizza.position.set(lerp(DOOR.x + 0.3, DOOR.x + 1.7, ease(u)), CURB + 0.35 + Math.sin(PIZZA.t * 3) * 0.08 + (1 - u) * Math.sin(u * Math.PI) * 0.8, DOOR.z + 0.3); pizza.rotation.y += rdt * 1.6;
    PIZZA.x = pizza.position.x; PIZZA.z = pizza.position.z;
    if (u >= 1 && !h.roof && Math.hypot(h.pos.x - PIZZA.x, h.pos.z - PIZZA.z) < 1.1) {
      PIZZA.on = false; pizza.visible = false; h.hp = Math.min(h.maxHp, h.hp + 50); CINE.stats.pizza++; sfx('ko');
      spawnSprite(PIZZA_W, _v.set(PIZZA.x, 2.2, PIZZA.z), 1.0, 0.9, { kind: 'word', aspect: 512 / 192 });
    }
  }
  // prompt: QTE first, then the nearest contextual action
  let P = null;
  const qe = qteTarget() || (QTE && QTE.e.state === 'dizzy' ? QTE.e : null);
  if (qe && !CINE.fin && h.state !== 'down' && h.state !== 'ko' && !h.roof && Math.hypot(qe.pos.x - h.pos.x, qe.pos.z - h.pos.z) < 10) {
    const e = qe, near = Math.hypot(e.pos.x - h.pos.x, e.pos.z - h.pos.z) < 4.6; P = { kind: 'fin', label: near ? 'FINISH!' : 'GET CLOSE', x: e.pos.x, y: e.pos.y + 2.75 * e.scale, z: e.pos.z, qte: clamp(1 - e.st / DIZZY_T, 0, 1), near };
  } else if (!CINE.fin && (P = revivePrompt())) { /* REVIVE: over whichever turtle is down */ }
  else if (!CINE.fin) { const A = actionInRange(); if (A) P = { kind: A.kind, label: A.label, x: A.x, y: (h.roof ? ROOF.y : 0) + A.y, z: A.z, near: true }; }
  const el = PRM.el;
  if (P) {
    _v.set(P.x, P.y, P.z).project(camera);
    const vis = _v.z < 1 && _v.z > -1;
    let sx = (_v.x * 0.5 + 0.5) * VW(), sy = (-_v.y * 0.5 + 0.5) * VH();
    const hw = Math.min(VW() / 2 - 4, (el.offsetWidth || 140) / 2 + 6); sx = clamp(sx, hw, VW() - hw); sy = clamp(sy, 70 + (CINE.lbH || 0), VH() - 90 - (CINE.lbH || 0));
    el.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%, -50%)`;
    if (PRM.cur !== P.kind + P.label + DEV) { PRM.cur = P.kind + P.label + DEV; PRM.lab.textContent = P.label; PRM.ico.innerHTML = ICONS[P.kind]; PRM.key.textContent = P.nokey ? '' : DEV === 'touch' ? 'ACT' : DEV === 'pad' ? 'Y' : 'E'; el.className = 'on ' + P.kind + (DEV === 'touch' ? ' tch' : '') + (P.nokey ? ' nokey' : ''); }
    el.classList.toggle('far', !P.near); el.style.visibility = vis ? 'visible' : 'hidden';
    PRM.ring.style.strokeDashoffset = P.qte !== undefined ? (113 * (1 - P.qte)).toFixed(1) : '0';
    $('bC').classList.toggle('hot', !!P.near);
  } else if (PRM.cur) { PRM.cur = null; el.className = ''; $('bC').classList.remove('hot'); }
  const cin = !!(CINE.intro || CINE.fin || h.state === 'climb' || h.state === 'leap' || h.state === 'boost'); if (cin !== CINE.cinCls) { CINE.cinCls = cin; document.body.classList.toggle('cine', cin); }
  CINE.prompt = P ? P.kind + ':' + P.label : null;
}
