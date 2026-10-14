
// ================= GAME =================
const RUN_LEN = 360;              // survive 6:00 (extraction opens), or kill GRAVEMAW to open it early
const STEP = 1 / 60;
const UPG = {
  mg: { name: 'ROOF MG', kind: 'weapon', max: 5, icon: 'mg', d: ['Roof turret. Auto-aims at the nearest dead.', '+25% fire rate', '+damage, +range', '+25% fire rate', '+damage, tighter spread'] },
  flame: { name: 'FLAMETHROWER', kind: 'weapon', max: 5, icon: 'flame', d: ['Twin nozzles torch everything ahead.', '+range', '+damage', '+range, wider cone', '+damage, longer burn'] },
  saw: { name: 'SIDE SAWS', kind: 'weapon', max: 5, icon: 'saw', d: ['Spinning blades shred anything you sideswipe.', '+blade size', '+damage', '+blade size', '+damage'] },
  harpoon: { name: 'HARPOON', kind: 'weapon', max: 5, icon: 'harpoon', d: ['Skewers a line of dead and reels them in. Loves big targets.', '+pierce', '-cooldown', '+damage, +pierce', '-cooldown'] },
  spikes: { name: 'SPIKE RAM', kind: 'weapon', max: 5, icon: 'spikes', d: ['', '+35% ram damage, wider ram', '+35% ram damage', '+35% ram damage, less ram wear', '+40% ram damage'] },
  armor: { name: 'ARMOR PLATING', kind: 'passive', max: 5, icon: 'armor', d: ['+20 max hull, -7% damage, patch +20'] },
  nitro: { name: 'NITRO TANK', kind: 'passive', max: 5, icon: 'nitro', d: ['+25% nitro, faster refill'] },
  magnet: { name: 'MAGNET COIL', kind: 'passive', max: 5, icon: 'magnet', d: ['+3.5 m pickup reach'] },
  engine: { name: 'BIG-BLOCK ENGINE', kind: 'passive', max: 5, icon: 'engine', d: ['+top speed, +torque, +grip'] },
};
const EVOS = [
  { id: 'minigun', w: 'mg', p: 'magnet', name: 'TWIN MINIGUN', icon: 'mg', d: 'MG max + Magnet: twin spinning barrels, explosive tracers.' },
  { id: 'dragon', w: 'flame', p: 'nitro', name: 'DRAGON BREATH', icon: 'flame', d: 'Flame max + Nitro Tank: double reach; boosting wraps the rig in fire.' },
  { id: 'halo', w: 'saw', p: 'armor', name: 'BUZZ HALO', icon: 'saw', d: 'Saws max + Armor: four giant blades orbit the rig.' },
  { id: 'whaler', w: 'harpoon', p: 'engine', name: 'WHALER', icon: 'harpoon', d: 'Harpoon max + Engine: three spears per volley, huge pierce.' },
];
const G = {
  state: 'attract', t: 0, real: 0, timeScale: 1, slowT: 0, hitstop: 0, acc: 0, frames: 0, steps: 0,
  kills: 0, combo: 0, comboT: 0, bestCombo: 0, multi: 0, multiT: 0, xp: 0, level: 1, need: 6, pendingLv: 0, scrap: 0, forge: 0, forgeNeed: 22, pendingForge: 0,
  hp: 120, maxHp: 120, inv: 0, nitro: 60, nitroMax: 100, lv: {}, evo: {}, bigKills: 0, dmgTaken: 0,
  spawnAcc: 0, events: [], banner: null, banners: [], callout: null, shake: 0, flashR: 0, bloodMoon: 0, extract: false, bossSpawned: false, bossDead: false, boss: null,
  airT: 0, airPitch: 0, airRoll: 0, driftT: 0, groanT: 0, sparkT: 0, botOn: false, demo: true, best: null, result: null, lastHurt: 0, attractT: 0,
};
function later(dt, fn) { G.events.push({ t: G.t + dt, fn }); }
function runEvents() { for (let i = G.events.length - 1; i >= 0; i--) if (G.events[i].t <= G.t) { const e = G.events[i]; G.events.splice(i, 1); e.fn(); } }
try { G.best = JSON.parse(localStorage.getItem('rr_best') || 'null'); } catch (_) { G.best = null; }
function mods() { return { engine: G.lv.engine || 0, grip: G.lv.engine || 0 }; }
const MODS = { engine: 0, grip: 0 };
function banner(txt, sub, col = '#ffcf2e', dur = 2.6) { G.banners.push({ txt, sub, col, t: 0, dur }); if (G.banners.length > 3) G.banners.shift(); }
function callout(txt, col = '#fff') { G.callout = { txt, col, t: 0 }; }

// ---------------- reset / start ----------------
function resetRun(demo) {
  G.t = 0; G.timeScale = 1; G.slowT = 0; G.hitstop = 0; G.acc = 0; G.kills = 0; G.combo = 0; G.comboT = 0; G.bestCombo = 0; G.multi = 0; G.multiT = 0;
  G.xp = 0; G.level = 1; G.need = 6; G.pendingLv = 0; G.scrap = 0; G.forge = 0; G.pendingForge = 0; G.maxHp = 120; G.hp = 120; G.inv = 0; G.nitroMax = 100; G.nitro = 60;
  G.lv = { mg: 1, spikes: 1 }; G.evo = {}; G.bigKills = 0; G.dmgTaken = 0; G.spawnAcc = 0; G.events = []; G.banners = []; G.callout = null; G.shake = 0; G.flashR = 0; G.bloodMoon = 0;
  G.extract = false; G.bossSpawned = false; G.bossDead = false; G.boss = null; G.airT = 0; G.driftT = 0; G.groanT = 1; G.sparkT = 0; G.demo = demo; G.result = null; G.attractT = 0;
  hordeReset(); pickupsReset(); psReset(PS_A); psReset(PS_X); teleReset(); bigReset();
  for (const b of BARRELS) { b.alive = true; b.t = 0; syncBarrel(b); }
  BU.life.fill(0); for (const f of FT) f.on = false; for (const R of RINGS) R.m.visible = false;
  harpoonReset(); EXT.open = false; EXT.t = 0;
  vanReset(START.x, START.z, START.yaw); vanMat.userData.char.value = 0;
  // first frames: a pack ahead on the road so the threat is on screen immediately
  for (let k = 0; k < 70; k++) { const a = rnd(-0.9, 0.9), r = rnd(28, 70); zSpawn(Math.random() < 0.06 ? 2 : 0, START.x + Math.sin(a) * r, START.z + Math.cos(a) * r, 1); }
  for (let k = 0; k < 30; k++) { const a = Math.random() * TAU, r = rnd(40, 70); zSpawn(0, START.x + Math.sin(a) * r, START.z + Math.cos(a) * r, 1); }
  schedule();
  updateWeaponRigs(); camSnap = true;
  AU.intensity = 0;
}
function schedule() {
  later(0.3, () => banner('SURVIVE 6:00', 'OR KILL THE BOSS · REACH EXTRACTION', '#ffcf2e', 3.2));
  later(45, () => surge(150, 0, 'HORDE SURGE'));
  later(90, () => surge(200, 0.25, 'HORDE SURGE'));
  later(130, () => bruiser());
  later(170, () => surge(260, 0.3, 'STAMPEDE'));
  later(180, () => { G.bloodMoon = 1; banner('BLOOD MOON', 'THE DEAD ARE FRENZIED', '#ff4a3a', 3); SFX.alarm(); });
  later(220, () => { bruiser(); bruiser(); });
  later(250, () => surge(320, 0.35, 'STAMPEDE'));
  later(270, () => spawnBoss());
  later(RUN_LEN, () => openExtraction(false));
}
function surge(n, runners, label) {
  banner(label, 'THEY COME FROM EVERY SIDE', '#ff8a1e', 2.2); SFX.alarm();
  const hpMul = 1 + G.t / 200;
  for (let k = 0; k < n; k++) { const a = Math.random() * TAU, r = rnd(42, 62); const x = VS.pos.x + Math.sin(a) * r, z = VS.pos.z + Math.cos(a) * r; if (Math.hypot(x, z) > ARENA_R - 6) continue; zSpawn(Math.random() < runners ? 1 : 0, x, z, hpMul); }
}
function spawnRing(minR, maxR) {
  for (let k = 0; k < 8; k++) {
    const a = Math.random() * TAU, r = rnd(minR, maxR);
    // bias spawns toward where the rig is heading so it plows into them
    const hx = VS.vel.x * 1.2, hz = VS.vel.z * 1.2;
    const x = VS.pos.x + Math.sin(a) * r + hx, z = VS.pos.z + Math.cos(a) * r + hz;
    if (Math.hypot(x, z) < ARENA_R - 8) return [x, z];
  }
  return null;
}
function bruiser() {
  const p = spawnRing(55, 70); if (!p) return;
  const B = bigSpawn(false, p[0], p[1], 1 + G.t / 240); if (!B) return;
  banner('BRUISER INBOUND', 'RAM IT AT SPEED · WATCH THE RED', '#ff4a3a', 2.6); SFX.roar(false); SFX.alarm();
}
function spawnBoss() {
  if (G.bossSpawned) return; G.bossSpawned = true;
  const p = spawnRing(60, 70) || [0, 0]; const B = bigSpawn(true, p[0], p[1], 1); G.boss = B;
  banner('GRAVEMAW', 'KILL IT TO OPEN EXTRACTION', '#ff4a3a', 3.4); SFX.roar(true); G.shake = Math.max(G.shake, 0.6);
}
function openExtraction(byBoss) {
  if (G.extract) return; G.extract = true; EXT.open = true; EXT.t = 0;
  banner('EXTRACTION OPEN', 'DRIVE INTO THE GREEN BEAM', '#7dffb0', 3.2); SFX.alarm();
  for (let t = 22; t < 400; t += 24) later(t, () => { if (G.state === 'play' || G.state === 'attract') surge(180, 0.4, 'THEY WANT YOU'); });
}

// ---------------- damage / kills / pickups ----------------
function vanDamage(d, big) {
  if (G.state === 'win' || G.state === 'dead') return;
  if (big && G.inv > 0) { callout('BOOST DODGE!', '#4fc9ff'); return; }
  d *= 1 - 0.07 * (G.lv.armor || 0);
  if (G.demo) d *= 0.35;
  G.hp -= d; G.dmgTaken += d; G.flashR = Math.min(1, G.flashR + d / 18); vanMat.userData.flash.value = Math.min(0.7, vanMat.userData.flash.value + 0.25); vanMat.userData.flashC.value.set('#ff5040');
  if (d > 6) { SFX.hurt(); G.shake = Math.min(1, G.shake + d / 30); sparkBurst(VS.pos.x, VS.pos.y + 0.5, VS.pos.z, 14, 9); }
  else if (thr('bite', 260)) SFX.hurt();
  if (big) G.inv = 0.6;
  if (G.hp <= 0) { G.hp = 0; if (G.demo) { G.hp = G.maxHp; } else gameOver(false); }
}
function addKill(x, y, z, xp, big) {
  G.kills++; G.combo++; G.comboT = 2.6; if (G.combo > G.bestCombo) G.bestCombo = G.combo;
  G.multi++; G.multiT = 0.45;
  gemDrop(x, z, xp);
  G.nitro = Math.min(G.nitroMax, G.nitro + 0.35);
}
function zKill(i, vx, vy, vz, gib, cause) {
  const T = ZTYPES[ZT[i]], x = ZX[i], y = ZY[i], z = ZZ[i];
  addKill(x, y, z, T.xp, false);
  if (Math.random() < T.scrap) scrapDrop(x + rnd(-1, 1), z + rnd(-1, 1));
  const bloat = ZT[i] === 2;
  if (bloat) { gib = true; bloodBurst(x, y, z, vx, vz, 16, true); decalAt(x, z, rnd(3.5, 4.5), true); if (Math.hypot(VS.pos.x - x, VS.pos.z - z) < 4.5) vanDamage(6, false); SFX.splat(true); }
  if (gib) {
    gibBurst(x, y, z, vx, vy, vz, bloat ? 9 : 5, 5 + Math.hypot(vx, vz) * 0.15);
    bloodBurst(x, y, z, vx, vz, 7, false); decalAt(x + vx * 0.06, z + vz * 0.06, rnd(2.0, 3.2)); zFree(i); SFX.splat(true); return;
  }
  // ragdoll: tumble away
  ZS[i] = 2; ZMODE[i] = 2; ZVX[i] = vx; ZVY[i] = vy; ZVZ[i] = vz; ZY[i] = y + 1.0; ZLIFE[i] = zFreeN < 250 ? 1.6 : 4.5; ZFL[i] = 1;
  _q.setFromAxisAngle(_v3.set(0, 1, 0), ZYAW[i]); _q.toArray(ZQ, i * 4);
  const s = 4 + Math.hypot(vx, vz) * 0.35; ZW[i * 3] = rnd(-s, s); ZW[i * 3 + 1] = rnd(-s, s) * 0.5; ZW[i * 3 + 2] = rnd(-s, s);
  if (cause !== 'flame') { bloodBurst(x, y, z, vx, vz, 4, false); if (Math.random() < 0.6) decalAt(x, z, rnd(1.2, 2.2)); }
  SFX.splat(false);
}
function zHurt(i, d, kx, kz, cause) {
  if (ZS[i] !== 1) return false;
  ZHP[i] -= d; ZFL[i] = 0.6;
  if (ZHP[i] <= 0) { zKill(i, kx * 0.6, 3 + Math.random() * 3, kz * 0.6, cause === 'boom' || (cause === 'saw' && Math.random() < 0.35), cause); return true; }
  if (kx || kz) { ZVX[i] = kx * 0.25; ZVZ[i] = kz * 0.25; ZSTUN[i] = 0.25; }
  return false;
}
function bigHurt(B, d, cause) {
  if (B.dead) return;
  if (B.st === 'recover' || B.st === 'stun') d *= 1.6;
  if (B.boss && B.phase === 1 && B.hp - d < B.max * 0.5) { d = B.hp - B.max * 0.5; bossPhase2(B); }
  B.hp -= d; B.flash = 0.5;
  if (d >= 25) floatText(B.x, B.y + 4.5 * B.sc, B.z, String(Math.round(d)), cause === 'ram' ? '#ffcf2e' : '#fff', d > 80 ? 1.5 : 1);
  if (B.hp <= 0) bigDie(B);
}
function bossPhase2(B) {
  B.phase = 2; B.speed *= 1.25; banner('GRAVEMAW ENRAGED', 'IT CALLS THE HORDE', '#ff4a3a', 2.6); SFX.roar(true); G.shake = 0.7;
  for (let k = 0; k < 110; k++) { const a = Math.random() * TAU, r = rnd(14, 30); zSpawn(1, B.x + Math.sin(a) * r, B.z + Math.cos(a) * r, 1 + G.t / 200); }
}
function bigDie(B) {
  B.dead = true; B.deathT = 0; B.hp = 0; teleCancel(B);
  G.bigKills++; addKill(B.x, B.y, B.z, B.boss ? 60 : 30, true);
  for (let k = 0; k < (B.boss ? 18 : 8); k++) scrapDrop(B.x + rnd(-3, 3), B.z + rnd(-3, 3));
  for (let k = 0; k < (B.boss ? 8 : 3); k++) gemDrop(B.x + rnd(-3, 3), B.z + rnd(-3, 3), 20);
  if (B.boss) {
    G.bossDead = true; G.slowT = 1.9; G.hitstop = 0.12; G.shake = 1; SFX.roar(true); SFX.boom();
    banner('GRAVEMAW DOWN!', 'EXTRACTION IS OPEN', '#7dffb0', 3.4);
    later(0.9, () => { explosionFx(B.x, B.y + 2, B.z, 12); gibBurst(B.x, B.y + 3, B.z, 0, 8, 0, 40, 14); bloodBurst(B.x, B.y + 3, B.z, 0, 0, 30, false); decalAt(B.x, B.z, 9); SFX.boom(); });
    later(1.4, () => openExtraction(true));
  } else {
    G.hitstop = Math.max(G.hitstop, 0.09); G.shake = Math.max(G.shake, 0.6); callout('BRUISER FLATTENED!', '#ffcf2e');
    later(0.7, () => { explosionFx(B.x, B.y + 1, B.z, 6); gibBurst(B.x, B.y + 2, B.z, 0, 6, 0, 20, 9); decalAt(B.x, B.z, 6); SFX.splat(true); });
  }
}
function gainXP(v) {
  G.xp += v;
  while (G.xp >= G.need) { G.xp -= G.need; G.level++; G.need = Math.round(8 + G.level * 6 + G.level * G.level * 1.0); G.pendingLv++; }
}
function explode(x, z, r, dmg, src) {
  explosionFx(x, hm(x, z), z, r); SFX.boom(); G.shake = Math.min(1, G.shake + 0.5); G.hitstop = Math.max(G.hitstop, 0.06);
  const n = hQuery(x, z, r);
  for (let k = 0; k < n; k++) { const i = QBUF[k], dx = ZX[i] - x, dz = ZZ[i] - z, d = Math.hypot(dx, dz) + 0.1; zHurt(i, dmg * (1 - d / r * 0.5), dx / d * 18, dz / d * 18, 'boom'); }
  for (const B of BIGS) if (!B.dead && Math.hypot(B.x - x, B.z - z) < r + B.rad) bigHurt(B, dmg * 1.2, 'boom');
  if (src !== 'van' && Math.hypot(VS.pos.x - x, VS.pos.z - z) < r * 0.6) vanDamage(8, false);
  for (const b of BARRELS) if (b.alive && Math.hypot(b.x - x, b.z - z) < r * 0.8 && Math.hypot(b.x - x, b.z - z) > 0.5) { b.alive = false; b.t = 45; syncBarrel(b); later(0.12, () => explode(b.x, b.z, 9, 110, 'barrel')); }
}

// ---------------- weapons ----------------
const W = { mgCd: 0, mgYaw: 0, mgTgt: -1, mgBig: null, mgScan: 0, shots: 0, flameOn: false, sawHit: false, haloA: 0, harpCd: 1.5, spin: 0 };
const _mz = new THREE.Vector3(), _dir = new THREE.Vector3(), _sp = new THREE.Vector3();
function vanYaw() { return Math.atan2(_az.x, _az.z); }
function mgStep(dt) {
  const L = G.lv.mg || 0; if (!L) return;
  const evo = G.evo.minigun, range = 34 + L * 2.5;
  W.mgScan -= dt;
  if (W.mgScan <= 0) {
    W.mgScan = 0.12; W.mgTgt = -1; W.mgBig = null; let best = range * range;
    for (const B of BIGS) { if (B.dead) continue; const d2 = (B.x - VS.pos.x) ** 2 + (B.z - VS.pos.z) ** 2; if (d2 < best) { best = d2; W.mgBig = B; } }
    if (!W.mgBig) { const n = hQuery(VS.pos.x, VS.pos.z, Math.min(range, 22)); best = 1e9; for (let k = 0; k < n; k++) { const i = QBUF[k], d2 = (ZX[i] - VS.pos.x) ** 2 + (ZZ[i] - VS.pos.z) ** 2; if (d2 < best && d2 > 9) { best = d2; W.mgTgt = i; } }
      if (W.mgTgt < 0) { for (let i = 0; i < zHigh; i += 3) { if (ZS[i] !== 1) continue; const d2 = (ZX[i] - VS.pos.x) ** 2 + (ZZ[i] - VS.pos.z) ** 2; if (d2 < best && d2 < range * range) { best = d2; W.mgTgt = i; } } } }
  }
  let tx, ty, tz;
  if (W.mgBig && !W.mgBig.dead) { tx = W.mgBig.x; ty = W.mgBig.y + 2.2 * W.mgBig.sc; tz = W.mgBig.z; }
  else if (W.mgTgt >= 0 && ZS[W.mgTgt] === 1) { tx = ZX[W.mgTgt] + ZVX[W.mgTgt] * 0.1; ty = ZY[W.mgTgt] + 1.2; tz = ZZ[W.mgTgt] + ZVZ[W.mgTgt] * 0.1; }
  else { W.mgYaw = damp(W.mgYaw, 0, 4, dt); return; }
  _mz.set(0, 1.85, -0.25).applyQuaternion(VS.q).add(VS.pos);
  const want = wrapA(Math.atan2(tx - _mz.x, tz - _mz.z) - vanYaw());
  W.mgYaw += wrapA(want - W.mgYaw) * (1 - Math.exp(-16 * dt));
  W.mgCd -= dt;
  const rate = evo ? 24 : [0, 5, 6.3, 7.6, 9, 10.5][L], dmg = evo ? 10 : [0, 7, 8, 9.5, 11, 13][L];
  if (Math.abs(wrapA(want - W.mgYaw)) < 0.25 && W.mgCd <= 0) {
    W.mgCd += 1 / rate; if (W.mgCd < -0.05) W.mgCd = 0;
    const yaw = W.mgYaw + vanYaw(), dist = Math.hypot(tx - _mz.x, tz - _mz.z) + 0.01;
    const spread = L >= 5 ? 0.025 : 0.045;
    _dir.set(Math.sin(yaw), (ty - _mz.y) / dist, Math.cos(yaw)).normalize();
    _dir.x += rnd(-spread, spread); _dir.y += rnd(-spread, spread) * 0.5; _dir.z += rnd(-spread, spread); _dir.normalize();
    const side = evo ? ((W.shots & 1) ? 0.13 : -0.13) : 0;
    fireBullet(_mz.x + _dir.z * side + _dir.x * 1.6, _mz.y, _mz.z - _dir.x * side + _dir.z * 1.6, _dir, dmg, evo && (W.shots % 5 === 0));
    W.shots++; SFX.gun();
    pEmit(PS_X, _mz.x + _dir.x * 1.9, _mz.y, _mz.z + _dir.z * 1.9, VS.vel.x, VS.vel.y, VS.vel.z, 0.06, 0.9, 0.3, C_FIRE2, 1, 0, 0);
  }
}
function fireBullet(x, y, z, d, dmg, boom) {
  const i = BU.n; BU.n = (BU.n + 1) % BN;
  BU.x[i] = x; BU.y[i] = y; BU.z[i] = z; BU.vx[i] = d.x * 150 + VS.vel.x; BU.vy[i] = d.y * 150; BU.vz[i] = d.z * 150 + VS.vel.z; BU.life[i] = 0.32; BU.dmg[i] = dmg; BU.boom[i] = boom ? 1 : 0;
}
function bulletStep(dt) {
  for (let i = 0; i < BN; i++) {
    if (BU.life[i] <= 0) continue;
    BU.life[i] -= dt;
    const ox = BU.x[i], oy = BU.y[i], oz = BU.z[i];
    BU.x[i] += BU.vx[i] * dt; BU.y[i] += BU.vy[i] * dt; BU.z[i] += BU.vz[i] * dt;
    const mx = (ox + BU.x[i]) / 2, mz = (oz + BU.z[i]) / 2;
    const sx = BU.x[i] - ox, sy = BU.y[i] - oy, sz = BU.z[i] - oz, sl2 = sx * sx + sy * sy + sz * sz;
    let hit = false;
    for (const B of BIGS) { if (B.dead) continue; const dx = B.x - mx, dz = B.z - mz; if (dx * dx + dz * dz < (B.rad + 1.5) ** 2 && BU.y[i] < B.y + 4.5 * B.sc) { bigHurt(B, BU.dmg[i], 'mg'); sparkBurst(mx, BU.y[i], mz, 3, 5); hit = true; break; } }
    if (!hit) {
      const n = hQuery(mx, mz, 1.9);
      for (let k = 0; k < n; k++) {
        const j = QBUF[k], px = ZX[j] - ox, py = ZY[j] + 1.1 - oy, pz = ZZ[j] - oz;
        let t = (px * sx + py * sy + pz * sz) / sl2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - sx * t, ey = py - sy * t, ez = pz - sz * t;
        if (ex * ex + ey * ey * 0.25 + ez * ez < 0.36 * ZSC[j] * (ZT[j] === 2 ? 2.2 : 1)) {
          const kx = BU.vx[i] * 0.06, kz = BU.vz[i] * 0.06;
          zHurt(j, BU.dmg[i], kx, kz, 'mg'); bloodBurst(ZX[j], ZY[j], ZZ[j], kx, kz, 2, ZT[j] === 2); hit = true; break;
        }
      }
    }
    if (!hit) for (const b of BARRELS) if (b.alive && Math.abs(b.x - mx) < 1.6 && Math.abs(b.z - mz) < 1.6 && BU.y[i] < hm(b.x, b.z) + 1.5) { b.alive = false; b.t = 45; syncBarrel(b); explode(b.x, b.z, 9, 110, 'barrel'); hit = true; break; }
    if (!hit && BU.y[i] < hm(BU.x[i], BU.z[i])) { hit = true; pEmit(PS_A, BU.x[i], BU.y[i] + 0.2, BU.z[i], 0, 2, 0, 0.4, 0.4, 0.9, C_DUST, 0.8, 2, 2); }
    if (hit) { if (BU.boom[i]) explode(BU.x[i], BU.z[i], 3.6, 20, 'van'); BU.life[i] = 0; }
  }
}
function flameStep(dt) {
  const L = G.lv.flame || 0; W.flameOn = false; if (!L) return;
  const evo = G.evo.dragon, range = evo ? 15 : 6.5 + L * 1.1, half = (L >= 4 ? 0.5 : 0.42) + (evo ? 0.1 : 0), dps = evo ? 75 : [0, 24, 30, 36, 44, 52][L];
  _mz.set(0, 0.05, 3.2).applyQuaternion(VS.q).add(VS.pos);
  const fx = _az.x, fz = _az.z, fl = Math.hypot(fx, fz) || 1;
  const n = hQuery(_mz.x + fx / fl * range * 0.5, _mz.z + fz / fl * range * 0.5, range * 0.62);
  let any = false;
  for (let k = 0; k < n; k++) {
    const i = QBUF[k], dx = ZX[i] - _mz.x, dz = ZZ[i] - _mz.z, d = Math.hypot(dx, dz) + 0.01;
    if (d > range) continue; const c = (dx * fx + dz * fz) / (d * fl); if (c < Math.cos(half)) continue;
    any = true; ZBURN[i] = L >= 5 || evo ? 3.5 : 2.5; zHurt(i, dps * dt, dx / d * 2, dz / d * 2, 'flame');
  }
  for (const B of BIGS) { if (B.dead) continue; const dx = B.x - _mz.x, dz = B.z - _mz.z, d = Math.hypot(dx, dz); if (d < range + B.rad && (dx * fx + dz * fz) / (d * fl + 0.01) > 0.5) { any = true; bigHurt(B, dps * dt * 0.9, 'flame'); } }
  // dragon breath ring while boosting
  if (evo && VS.boosting) {
    any = true; const m = hQuery(VS.pos.x, VS.pos.z, 7);
    for (let k = 0; k < m; k++) { const i = QBUF[k]; ZBURN[i] = 3.5; zHurt(i, 55 * dt, 0, 0, 'flame'); }
    for (let k = 0; k < 4; k++) { const a = Math.random() * TAU; pEmit(PS_X, VS.pos.x + Math.sin(a) * 5.5, VS.pos.y - 0.8, VS.pos.z + Math.cos(a) * 5.5, VS.vel.x * 0.8, rnd(1, 3), VS.vel.z * 0.8, 0.45, 1.6, 2.6, k & 1 ? C_FIRE : C_HOT, 0.9, -3, 1); }
  }
  if (any || INP.drift) {
    W.flameOn = true;
    for (const s of [-0.55, 0.55]) {
      _sp.set(s, 0.05, 3.2).applyQuaternion(VS.q).add(VS.pos);
      for (let k = 0; k < 3; k++) { const sp = rnd(range * 1.4, range * 2.1); pEmit(PS_X, _sp.x, _sp.y, _sp.z, VS.vel.x + (fx / fl + rnd(-half, half) * 0.8) * sp, rnd(0.5, 2.5), VS.vel.z + (fz / fl + rnd(-half, half) * 0.8) * sp, rnd(0.35, 0.5), 0.5, 2.2 + range * 0.05, Math.random() < 0.5 ? C_FIRE : C_FIRE2, 0.95, -4, 1.5); }
    }
  }
}
function sawStep(dt) {
  const L = G.lv.saw || 0; W.sawHit = false; if (!L) return;
  W.spin += dt * 30;
  if (G.evo.halo) {
    W.haloA += dt * 3.3;
    for (let s = 0; s < 4; s++) {
      const a = W.haloA + s * TAU / 4, x = VS.pos.x + Math.sin(a) * 4.8, z = VS.pos.z + Math.cos(a) * 4.8;
      const n = hQuery(x, z, 2.1);
      for (let k = 0; k < n; k++) { const i = QBUF[k]; if (ZSAW[i] > 0) continue; ZSAW[i] = 0.18; W.sawHit = true; zHurt(i, 42, Math.cos(a) * 14, -Math.sin(a) * 14, 'saw'); }
      for (const B of BIGS) if (!B.dead && Math.hypot(B.x - x, B.z - z) < B.rad + 2) { bigHurt(B, 90 * dt, 'saw'); W.sawHit = true; if (Math.random() < 0.3) sparkBurst(x, VS.pos.y - 0.5, z, 2, 6); }
    }
    return;
  }
  const rad = [0, 1.2, 1.35, 1.5, 1.65, 1.85][L], dmg = [0, 14, 18, 23, 28, 34][L];
  for (const s of [-1, 1]) {
    _sp.set(s * (2.15 + (rad - 1.2) * 0.6), -0.1, 0.35).applyQuaternion(VS.q).add(VS.pos);
    const n = hQuery(_sp.x, _sp.z, rad + 0.45);
    for (let k = 0; k < n; k++) { const i = QBUF[k]; if (ZSAW[i] > 0 || Math.abs(ZY[i] + 1 - _sp.y) > 2.2) continue; ZSAW[i] = 0.2; W.sawHit = true; zHurt(i, dmg, _ax.x * s * 10, _ax.z * s * 10, 'saw'); bloodBurst(ZX[i], ZY[i], ZZ[i], _ax.x * s * 8, _ax.z * s * 8, 3, ZT[i] === 2); }
    for (const B of BIGS) if (!B.dead && Math.hypot(B.x - _sp.x, B.z - _sp.z) < B.rad + rad) { bigHurt(B, dmg * 3 * dt, 'saw'); W.sawHit = true; if (Math.random() < 0.3) sparkBurst(_sp.x, _sp.y, _sp.z, 2, 6); }
  }
}
// harpoon: spears pooled with their own rope
const HARP = [];
const spearGeo = merge([P(GEO.cyl(0.07, 0.07, 1.8, 6), '#5b3a2c', [0, 0, -0.5], [1.57, 0, 0]), P(GEO.cone(0.2, 0.6, 5), '#d5dde3', [0, 0, 0.6], [1.57, 0, 0]), P(GEO.cone(0.12, 0.4, 3), '#d5dde3', [0.14, 0, 0.25], [1.57, 0, -0.6]), P(GEO.cone(0.12, 0.4, 3), '#d5dde3', [-0.14, 0, 0.25], [1.57, 0, 0.6])]);
const ropeMat = new THREE.MeshBasicMaterial({ color: '#2a1d1a' });
for (let i = 0; i < 3; i++) {
  const m = withOutline(spearGeo, vanMat, OUT_VAN, scene); m.visible = false;
  const rope = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1).translate(0, 0, 0.5), ropeMat); rope.visible = false; scene.add(rope);
  HARP.push({ m, rope, on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, dist: 0, back: false, sk: [], big: null, pierce: 4, dmg: 50 });
}
function harpoonReset() { for (const h of HARP) { h.on = false; h.m.visible = h.rope.visible = false; h.sk.length = 0; h.big = null; } W.harpCd = 1.5; }
function harpoonStep(dt) {
  const L = G.lv.harpoon || 0; if (!L) return;
  const evo = G.evo.whaler;
  W.harpCd -= dt;
  if (W.harpCd <= 0 && !HARP.some((h) => h.on)) {
    // target: a big if in range, else a far zombie in front of the rig
    let tx = 0, tz = 0, found = false; const R = 38;
    for (const B of BIGS) if (!B.dead && Math.hypot(B.x - VS.pos.x, B.z - VS.pos.z) < R) { tx = B.x; tz = B.z; found = true; break; }
    if (!found) { const n = hQuery(VS.pos.x + _az.x * 18, VS.pos.z + _az.z * 18, 16); if (n) { const i = QBUF[(Math.random() * n) | 0]; tx = ZX[i]; tz = ZZ[i]; found = true; } }
    if (found) {
      W.harpCd = evo ? 1.4 : [0, 3.2, 2.8, 2.4, 2.0, 1.7][L];
      _mz.set(0, 1.75, -1.6).applyQuaternion(VS.q).add(VS.pos);
      const base = Math.atan2(tx - _mz.x, tz - _mz.z);
      for (let k = 0; k < (evo ? 3 : 1); k++) {
        const h = HARP[k], yaw = base + (k - (evo ? 1 : 0)) * 0.22;
        h.on = true; h.back = false; h.dist = 0; h.sk.length = 0; h.big = null; h.pierce = evo ? 14 : [0, 4, 5, 6, 8, 10][L]; h.dmg = evo ? 80 : 45 + L * 10;
        h.x = _mz.x; h.y = _mz.y; h.z = _mz.z; h.vx = Math.sin(yaw) * 75 + VS.vel.x * 0.5; h.vz = Math.cos(yaw) * 75 + VS.vel.z * 0.5; h.vy = 0.6;
        h.m.visible = h.rope.visible = true;
      }
      RIG.harp.rotation.y = wrapA(base - vanYaw()); SFX.harpoon();
    }
  }
  for (const h of HARP) {
    if (!h.on) continue;
    _mz.set(0, 1.75, -1.6).applyQuaternion(VS.q).add(VS.pos);
    if (!h.back) {
      h.x += h.vx * dt; h.y = Math.max(hm(h.x, h.z) + 0.9, h.y + h.vy * dt); h.z += h.vz * dt; h.dist += 75 * dt;
      const n = hQuery(h.x, h.z, 1.4);
      for (let k = 0; k < n && h.sk.length < h.pierce; k++) { const i = QBUF[k]; if (zHurt(i, h.dmg, 0, 0, 'harpoon') && ZS[i] === 2) { h.sk.push(i); ZLIFE[i] = 6; } }
      for (const B of BIGS) if (!B.dead && Math.hypot(B.x - h.x, B.z - h.z) < B.rad + 0.8) { bigHurt(B, h.dmg * 1.8, 'harpoon'); B.stun = Math.max(B.stun, 0.6); if (B.st === 'walk') { B.st = 'stun'; B.t = 0; } h.big = B; h.back = true; SFX.clank(); G.hitstop = Math.max(G.hitstop, 0.05); break; }
      if (h.dist > 40 || h.sk.length >= h.pierce) h.back = true;
    } else {
      const dx = _mz.x - h.x, dy = _mz.y - h.y, dz = _mz.z - h.z, d = Math.hypot(dx, dy, dz);
      const sp = 60 * dt; if (d < 2 || h.dist > 120) { // reeled in: drop the catch
        for (const i of h.sk) if (ZS[i] === 2) { ZVX[i] = VS.vel.x * 0.5 + rnd(-4, 4); ZVY[i] = 4; ZVZ[i] = VS.vel.z * 0.5 + rnd(-4, 4); ZLIFE[i] = 3; }
        h.on = false; h.m.visible = h.rope.visible = false; h.sk.length = 0; continue;
      }
      h.x += dx / d * sp; h.y += dy / d * sp; h.z += dz / d * sp; h.dist += sp;
      if (h.big && !h.big.dead && !h.big.boss) { h.big.x += dx / d * sp * 0.25; h.big.z += dz / d * sp * 0.25; }
    }
    for (let k = 0; k < h.sk.length; k++) { const i = h.sk[k]; if (ZS[i] !== 2) continue; ZX[i] = h.x - h.vx * 0.012 * (k + 1); ZY[i] = h.y; ZZ[i] = h.z - h.vz * 0.012 * (k + 1); ZVX[i] = ZVY[i] = ZVZ[i] = 0; }
  }
}
function harpoonVisual() {
  for (const h of HARP) {
    if (!h.on) continue;
    _mz.set(0, 1.75, -1.6).applyQuaternion(VAN.root.quaternion).add(VAN.root.position);
    h.m.position.set(h.x, h.y, h.z); h.m.rotation.set(0, Math.atan2(h.x - _mz.x, h.z - _mz.z), 0);
    h.rope.position.copy(_mz); const d = Math.hypot(h.x - _mz.x, h.y - _mz.y, h.z - _mz.z); h.rope.scale.set(1, 1, Math.max(0.01, d)); h.rope.lookAt(h.x, h.y, h.z);
  }
}
function updateWeaponRigs() {
  RIG.barrels[1].visible = !!G.evo.minigun;
  RIG.flame.visible = !!G.lv.flame;
  for (const s of RIG.saws) { s.arm.visible = !!G.lv.saw && !G.evo.halo; const L = G.lv.saw || 1; s.disc.scale.setScalar(1 + (L - 1) * 0.12); }
  for (const d of RIG.halo) d.visible = !!G.evo.halo;
  RIG.harp.visible = !!G.lv.harpoon;
  G.maxHp = 120 + (G.lv.armor || 0) * 20; G.nitroMax = 100 * (1 + (G.lv.nitro || 0) * 0.25);
  MODS.engine = G.lv.engine || 0; MODS.grip = G.lv.engine || 0;
}

// ---------------- horde step ----------------
function hordeStep(dt) {
  hashBuild();
  const vx = VS.pos.x, vz = VS.pos.z, frenzy = 1 + G.bloodMoon * 0.22;
  let biteDps = 0;
  for (let i = 0; i < zHigh; i++) {
    const st = ZS[i]; if (!st) continue;
    if (ZFL[i] > 0) ZFL[i] -= dt * 4;
    if (ZSAW[i] > 0) ZSAW[i] -= dt;
    if (st === 2) { // ragdoll corpse
      ZVY[i] -= 22 * dt; ZX[i] += ZVX[i] * dt; ZY[i] += ZVY[i] * dt; ZZ[i] += ZVZ[i] * dt;
      const g = hm(ZX[i], ZZ[i]) + 0.35;
      if (ZY[i] < g) { ZY[i] = g; if (ZVY[i] < -4) { ZVY[i] *= -0.35; bloodBurst(ZX[i], g - 1, ZZ[i], 0, 0, 1, false); } else ZVY[i] = 0; ZVX[i] *= 0.82; ZVZ[i] *= 0.82; ZW[i * 3] *= 0.8; ZW[i * 3 + 1] *= 0.8; ZW[i * 3 + 2] *= 0.8; }
      const wx = ZW[i * 3], wy = ZW[i * 3 + 1], wz = ZW[i * 3 + 2], wl = Math.hypot(wx, wy, wz);
      if (wl > 0.05) { _gq.setFromAxisAngle(_gw.set(wx / wl, wy / wl, wz / wl), wl * dt); _q.fromArray(ZQ, i * 4).premultiply(_gq).normalize().toArray(ZQ, i * 4); }
      ZPH[i] += dt * (2 + wl); ZLIFE[i] -= dt;
      if (ZBURN[i] > 0) ZBURN[i] = Math.min(1, ZBURN[i]);
      if (ZLIFE[i] <= 0) zFree(i);
      continue;
    }
    // burning
    if (ZBURN[i] > 0) { ZBURN[i] -= dt; ZHP[i] -= 9 * dt; if (Math.random() < dt * 6) pEmit(PS_X, ZX[i], ZY[i] + rnd(0.6, 1.8), ZZ[i], 0, rnd(1, 3), 0, 0.4, 0.5, 1.0, C_FIRE, 0.9, -2, 1); if (ZHP[i] <= 0) { zKill(i, 0, 2, 0, false, 'flame'); continue; } }
    let dx = vx - ZX[i], dz = vz - ZZ[i]; const d = Math.hypot(dx, dz) + 1e-4;
    if (d > 175) { const p = spawnRing(60, 85); if (p) { ZX[i] = p[0]; ZZ[i] = p[1]; } continue; }
    dx /= d; dz /= d;
    if (ZSTUN[i] > 0) { ZSTUN[i] -= dt; ZX[i] += ZVX[i] * dt; ZZ[i] += ZVZ[i] * dt; ZVX[i] *= 0.9; ZVZ[i] *= 0.9; }
    else {
      const sp = ZSPD[i] * frenzy * (ZBURN[i] > 0 ? 1.25 : 1);
      let mx = dx * sp, mz = dz * sp;
      // separation (own + neighbour cells, capped)
      const c = ZCELL[i], cx = c % HW, cz = (c / HW) | 0; let sx = 0, sz = 0, chk = 0;
      for (let oz = -1; oz <= 1 && chk < 10; oz++) for (let ox = -1; ox <= 1 && chk < 10; ox++) {
        const cc = (cz + oz) * HW + cx + ox; if (cc < 0 || cc >= HW * HW) continue;
        const e = HSTART[cc] + HCOUNT[cc];
        for (let k = HSTART[cc]; k < e && chk < 10; k++) { const j = HITEMS[k]; if (j === i) continue; chk++; const ex = ZX[i] - ZX[j], ez = ZZ[i] - ZZ[j], e2 = ex * ex + ez * ez; if (e2 < 0.9 && e2 > 1e-6) { const ed = Math.sqrt(e2); sx += ex / ed * (0.95 - ed); sz += ez / ed * (0.95 - ed); } }
      }
      mx += sx * 5; mz += sz * 5;
      ZX[i] += mx * dt; ZZ[i] += mz * dt;
      ZYAW[i] += wrapA(Math.atan2(dx, dz) - ZYAW[i]) * (1 - Math.exp(-6 * dt));
    }
    // static colliders
    const cl = colCell(ZX[i], ZZ[i]);
    for (let k = 0; k < cl.length; k++) { const o = COLS[cl[k]], ex = ZX[i] - o.x, ez = ZZ[i] - o.z, rr = o.r + 0.4, e2 = ex * ex + ez * ez; if (e2 < rr * rr && e2 > 1e-6) { const ed = Math.sqrt(e2); ZX[i] = o.x + ex / ed * rr; ZZ[i] = o.z + ez / ed * rr; } }
    ZY[i] = hm(ZX[i], ZZ[i]);
    ZPH[i] += dt * ZSPD[i] * (ZMODE[i] === 3 ? 1.6 : 2.3);
    if (ZBITE[i]) { ZMODE[i] = 3; ZCD[i] -= dt; if (ZCD[i] <= 0) { ZCD[i] = 0.9; biteDps += ZTYPES[ZT[i]].dmg; } ZBITE[i] = 0; }
    else ZMODE[i] = ZT[i] === 1 ? 1 : 0;
  }
  if (biteDps > 0) vanDamage(Math.min(biteDps, 12 * dt), false);
}
// rig vs horde: speed-based ram damage from the spiked bumper, slow contact = pushing + bites
const _fx2 = { x: 0, z: 0 }, _rx2 = { x: 0, z: 0 };
function ramStep(dt) {
  const fl = Math.hypot(_az.x, _az.z) || 1, fx = _az.x / fl, fz = _az.z / fl, rx = fz, rz = -fx;
  const n = hQuery(VS.pos.x, VS.pos.z, 6.5);
  const spk = G.lv.spikes || 1, ramMul = [1, 1, 1.35, 1.7, 2.1, 2.5][spk], wide = spk >= 2 ? 0.25 : 0;
  let kills = 0, slow = 0;
  for (let k = 0; k < n; k++) {
    const i = QBUF[k]; if (ZS[i] !== 1) continue;
    const dx = ZX[i] - VS.pos.x, dz = ZZ[i] - VS.pos.z, lx = dx * rx + dz * rz, lz = dx * fx + dz * fz, ly = ZY[i] - (VS.pos.y - 1.6);
    if (ly < -2.5 || ly > 1.2) continue; // flying over them
    const zr = ZT[i] === 2 ? 0.7 : 0.38;
    const hw = 1.25 + zr + (lz > 2.0 ? wide : 0);
    if (Math.abs(lx) > hw || lz < -2.7 - zr || lz > 3.35 + zr) continue;
    let nx, nz, pen, front = false;
    if (lz > 2.1) { nx = fx; nz = fz; pen = 3.35 + zr - lz; front = true; }
    else if (lz < -2.4) { nx = -fx; nz = -fz; pen = lz + 2.7 + zr; }
    else { const s = lx > 0 ? -1 : 1; nx = -rx * s; nz = -rz * s; pen = hw - Math.abs(lx); }
    const imp = (VS.vel.x - ZVX[i] * 0.2) * nx + (VS.vel.z - ZVZ[i] * 0.2) * nz;
    if (imp > 6.5) {
      const dmg = imp * (front ? 1.7 * ramMul : 0.95 + spk * 0.15);
      ZHP[i] -= dmg; ZFL[i] = 1;
      if (ZHP[i] <= 0) {
        const up = 3 + imp * 0.32, gib = imp > 27 || (front && spk >= 3 && Math.random() < 0.3);
        zKill(i, VS.vel.x * 0.95 + nx * imp * 0.35 + rnd(-3, 3), up, VS.vel.z * 0.95 + nz * imp * 0.35 + rnd(-3, 3), gib, 'ram');
        kills++; slow += imp * (ZT[i] === 2 ? 0.05 : 0.01);
        if (ZT[i] === 2) G.hitstop = Math.max(G.hitstop, 0.07);
      } else { ZX[i] += nx * pen; ZZ[i] += nz * pen; ZVX[i] = nx * imp * 0.8; ZVZ[i] = nz * imp * 0.8; ZSTUN[i] = 0.5; slow += imp * 0.02; }
    } else {
      ZX[i] += nx * pen; ZZ[i] += nz * pen; ZSTUN[i] = Math.max(ZSTUN[i], 0.05); ZVX[i] = nx * 2; ZVZ[i] = nz * 2;
      if (VS.speed < 9) ZBITE[i] = 1;
    }
  }
  if (slow > 0 && VS.speed > 1) { const dv = Math.min(2.2, slow * (1 - (spk - 1) * 0.12)); const k = Math.max(0, 1 - dv / VS.speed); VS.vel.x *= k; VS.vel.z *= k; }
  if (kills >= 6) { G.hitstop = Math.max(G.hitstop, 0.045 + Math.min(0.06, kills * 0.005)); G.shake = Math.min(1, G.shake + 0.15 + kills * 0.02); }
  else if (kills) G.shake = Math.min(1, G.shake + 0.04 * kills);
  // barrels
  for (const b of BARRELS) if (b.alive && Math.hypot(b.x - VS.pos.x - fx * 2, b.z - VS.pos.z - fz * 2) < 2.6) { b.alive = false; b.t = 45; syncBarrel(b); explode(b.x, b.z, 9, 110, 'van'); vanDamage(4, false); callout('KABOOM!', '#ff8a1e'); }
  // bigs
  for (const B of BIGS) {
    if (B.dead) continue;
    const dx = B.x - VS.pos.x, dz = B.z - VS.pos.z, d = Math.hypot(dx, dz), rr = B.rad + 2.0;
    if (d > rr || Math.abs(B.y - (VS.pos.y - 1.6)) > 3.5 * B.sc) continue;
    const nx = dx / d, nz = dz / d, imp = VS.vel.x * nx + VS.vel.z * nz;
    B.ramCd -= dt;
    if (imp > 13 && B.ramCd <= 0) {
      const front = (nx * fx + nz * fz) > 0.6;
      bigHurt(B, imp * (front ? 9 * ramMul : 5), 'ram'); B.ramCd = 0.6;
      if (B.st === 'walk' || B.st === 'slamWind') { B.st = 'stun'; B.t = 0; teleCancel(B); }
      VS.vel.x -= nx * imp * 1.25; VS.vel.z -= nz * imp * 1.25; VS.vel.y += 3;
      if (!B.boss) { B.x += nx * 2.5; B.z += nz * 2.5; }
      G.hitstop = Math.max(G.hitstop, 0.1); G.shake = 1; SFX.crash(imp); SFX.splat(true); sparkBurst(VS.pos.x + fx * 3, VS.pos.y, VS.pos.z + fz * 3, 20, 10); bloodBurst(B.x, B.y + 1, B.z, -nx * 6, -nz * 6, 10, false);
      callout(B.boss ? 'BIG HIT!' : 'SLAMMED!', '#ffcf2e');
      vanDamage(front ? 2 : 6, false);
    }
    // push apart
    const pen = rr - d; VS.pos.x -= nx * pen * 0.8; VS.pos.z -= nz * pen * 0.8; if (imp > 0) { VS.vel.x -= nx * imp; VS.vel.z -= nz * imp; }
  }
}
// ---------------- big enemy AI ----------------
function teleCancel(B) { if (B.tele) { const T = TELE.find((t) => t.on && t.id === B.tele); if (T) { T.on = false; T.m.visible = false; T.cb = null; } B.tele = null; } }
function bigStep(B, dt) {
  B.flash -= dt * 3; B.t += dt;
  if (B.dead) { B.deathT += dt; if (B.deathT > 2.2) { B.R.root.visible = false; BIGS.splice(BIGS.indexOf(B), 1); } return; }
  const dx = VS.pos.x - B.x, dz = VS.pos.z - B.z, d = Math.hypot(dx, dz) + 1e-3;
  const fast = (B.phase === 2 ? 0.72 : 1) * (G.bloodMoon ? 0.92 : 1);
  B.cd -= dt;
  switch (B.st) {
    case 'walk': {
      B.yaw += wrapA(Math.atan2(dx, dz) - B.yaw) * (1 - Math.exp(-3 * dt));
      B.x += Math.sin(B.yaw) * B.speed * dt; B.z += Math.cos(B.yaw) * B.speed * dt;
      if (B.cd <= 0) {
        const slamR = B.boss ? 11 : 6.5;
        if (d < slamR * 0.9) { B.st = 'slamWind'; B.t = 0; const T = teleSpawn(0, B.x, B.z, slamR, 1.0 * fast, () => bigSlam(B, slamR)); B.tele = T && T.id; SFX.roar(B.boss); }
        else if (B.boss && d > 18 && Math.random() < 0.5) { B.st = 'throwWind'; B.t = 0; bossThrow(B, fast); }
        else if (d > 12 && d < 48) { B.st = 'chargeWind'; B.t = 0; B.dirX = dx / d; B.dirZ = dz / d; B.yaw = Math.atan2(dx, dz); const len = B.boss ? 54 : 36; B.chargeLeft = len; const T = teleSpawn(1, B.x, B.z, B.boss ? 6 : 3.6, 0.95 * fast, () => { B.st = 'charge'; B.t = 0; B.hitVan = false; B.tele = null; SFX.roar(B.boss); }, B.yaw, len); B.tele = T && T.id; }
        else B.cd = 0.6;
      }
      break;
    }
    case 'charge': {
      const sp = (B.boss ? 27 : 23) * dt; B.x += B.dirX * sp; B.z += B.dirZ * sp; B.chargeLeft -= sp;
      // trample the horde in the lane
      const n = hQuery(B.x, B.z, B.rad + 0.6); for (let k = 0; k < n; k++) zHurt(QBUF[k], 999, B.dirX * 16, B.dirZ * 16, 'ram');
      if (!B.hitVan && d < B.rad + 2.2) { B.hitVan = true; vanDamage(B.boss ? 28 : 20, true); if (G.inv < 0.5 || G.hp > 0) { VS.vel.x += B.dirX * 22; VS.vel.z += B.dirZ * 22; VS.vel.y += 6; VS.w.y += 2; } SFX.crash(20); G.shake = 1; G.hitstop = Math.max(G.hitstop, 0.08); }
      if (B.chargeLeft <= 0 || Math.hypot(B.x, B.z) > ARENA_R - 4) { B.st = 'recover'; B.t = 0; }
      break;
    }
    case 'recover': case 'stun': if (B.t > (B.st === 'stun' ? 0.9 : 1.3) * fast) { B.st = 'walk'; B.t = 0; B.cd = (B.boss ? 1.6 : 2.4) * fast; } break;
    case 'slam': if (B.t > 0.7) { B.st = 'recover'; B.t = 0.5; } break;
    case 'throwWind': if (B.t > 1.1 * fast) { B.st = 'walk'; B.t = 0; B.cd = 1.2 * fast; } break;
    case 'slamWind': case 'chargeWind': B.yaw += wrapA(Math.atan2(dx, dz) - B.yaw) * (B.st === 'slamWind' ? 1 - Math.exp(-2 * dt) : 0); break;
  }
  // static colliders + arena
  for (const o of COLS) { const ex = B.x - o.x, ez = B.z - o.z, rr = o.r + B.rad * 0.6, e2 = ex * ex + ez * ez; if (e2 < rr * rr && e2 > 1e-6) { const ed = Math.sqrt(e2); B.x = o.x + ex / ed * rr; B.z = o.z + ez / ed * rr; } }
  const r = Math.hypot(B.x, B.z); if (r > ARENA_R - 3) { B.x *= (ARENA_R - 3) / r; B.z *= (ARENA_R - 3) / r; }
  B.y = hm(B.x, B.z);
}
function bigSlam(B, r) {
  B.tele = null; if (B.dead) return; B.st = 'slam'; B.t = 0; SFX.slam(); G.shake = Math.max(G.shake, 0.75); shockRing(B.x, B.z, r, '#ff8a1e');
  for (let k = 0; k < 26; k++) { const a = Math.random() * TAU; pEmit(PS_A, B.x + Math.sin(a) * r * 0.5, B.y + 0.4, B.z + Math.cos(a) * r * 0.5, Math.sin(a) * rnd(6, 14), rnd(2, 5), Math.cos(a) * rnd(6, 14), rnd(0.6, 1.1), 1.4, 3.2, C_DUST, 0.9, 3, 2); }
  const n = hQuery(B.x, B.z, r); for (let k = 0; k < n; k++) { const i = QBUF[k], ex = ZX[i] - B.x, ez = ZZ[i] - B.z, ed = Math.hypot(ex, ez) + 0.1; zHurt(i, 40, ex / ed * 14, ez / ed * 14, 'boom'); }
  if (Math.hypot(VS.pos.x - B.x, VS.pos.z - B.z) < r + 1.2 && VS.pos.y - groundH(VS.pos.x, VS.pos.z) < 3.5) { vanDamage(B.boss ? 24 : 15, true); VS.vel.y += 7; const ex = VS.pos.x - B.x, ez = VS.pos.z - B.z, ed = Math.hypot(ex, ez) + 0.1; VS.vel.x += ex / ed * 10; VS.vel.z += ez / ed * 10; }
}
function bossThrow(B, fast) {
  SFX.roar(true);
  for (let k = 0; k < 3; k++) {
    const R = ROCKS.find((r) => !r.on); if (!R) break;
    const lead = 0.9 + k * 0.35;
    const tx = VS.pos.x + VS.vel.x * lead + rnd(-5, 5), tz = VS.pos.z + VS.vel.z * lead + rnd(-5, 5);
    R.on = true; R.t = -k * 0.18; R.dur = 1.35 * fast; R.sx = B.x; R.sy = B.y + 5 * B.sc; R.sz = B.z; R.tx = tx; R.tz = tz; R.m.visible = false;
    teleSpawn(0, tx, tz, 4.4, R.dur - R.t, null);
  }
}
function rockStep(dt) {
  for (const R of ROCKS) {
    if (!R.on) continue; R.t += dt; if (R.t < 0) continue; R.m.visible = true;
    const k = Math.min(1, R.t / R.dur), y0 = hm(R.tx, R.tz);
    R.m.position.set(lerp(R.sx, R.tx, k), lerp(R.sy, y0 + 1, k) + Math.sin(k * Math.PI) * 18, lerp(R.sz, R.tz, k)); R.m.rotation.set(R.t * 5, R.t * 3, 0);
    if (k >= 1) {
      R.on = false; R.m.visible = false; SFX.slam(); shockRing(R.tx, R.tz, 4.4, '#ff8a1e'); G.shake = Math.max(G.shake, 0.4);
      for (let j = 0; j < 14; j++) pEmit(PS_A, R.tx, y0 + 0.5, R.tz, rnd(-8, 8), rnd(3, 8), rnd(-8, 8), rnd(0.6, 1.0), 1.0, 2.6, C_DUST, 0.9, 6, 2);
      const n = hQuery(R.tx, R.tz, 4.4); for (let j = 0; j < n; j++) zHurt(QBUF[j], 60, 0, 0, 'boom');
      if (Math.hypot(VS.pos.x - R.tx, VS.pos.z - R.tz) < 4.6) { vanDamage(17, true); VS.vel.y += 5; }
    }
  }
}

// ---------------- pickups step ----------------
let pickN = 0;
function pickupStep(dt) {
  const mag = 6 + (G.lv.magnet || 0) * 3.5, m2 = mag * mag;
  for (let i = 0; i < GEMN; i++) {
    if (!GM.st[i]) continue;
    GM.t[i] += dt;
    const dx = VS.pos.x - GM.x[i], dz = VS.pos.z - GM.z[i], dy = VS.pos.y - GM.y[i], d2 = dx * dx + dz * dz;
    if (GM.st[i] === 1) {
      if (GM.vy[i] !== 0) { GM.vy[i] -= 18 * dt; GM.x[i] += GM.vx[i] * dt; GM.z[i] += GM.vz[i] * dt; GM.y[i] += GM.vy[i] * dt; const g = hm(GM.x[i], GM.z[i]) + 0.55; if (GM.y[i] < g) { GM.y[i] = g; GM.vy[i] = 0; } }
      if (d2 < m2) GM.st[i] = 2;
      if (GM.t[i] > 50) GM.st[i] = 0;
    } else {
      const d = Math.sqrt(d2 + dy * dy) + 1e-3, sp = 14 + GM.t[i] * 6 + VS.speed;
      GM.x[i] += dx / d * sp * dt; GM.y[i] += dy / d * sp * dt; GM.z[i] += dz / d * sp * dt;
      if (d < 2.4) { GM.st[i] = 0; gainXP(GM.v[i]); SFX.pick(pickN++); }
    }
  }
  for (let i = 0; i < SCRN; i++) {
    if (!SC.st[i]) continue; SC.t[i] += dt;
    const dx = VS.pos.x - SC.x[i], dz = VS.pos.z - SC.z[i], dy = VS.pos.y - SC.y[i], d2 = dx * dx + dz * dz;
    if (SC.st[i] === 1) {
      if (SC.vy[i] !== 0) { SC.vy[i] -= 18 * dt; SC.y[i] += SC.vy[i] * dt; const g = hm(SC.x[i], SC.z[i]) + 0.55; if (SC.y[i] < g) { SC.y[i] = g; SC.vy[i] = 0; } }
      if (d2 < m2 * 0.7) SC.st[i] = 2; if (SC.t[i] > 60) SC.st[i] = 0;
    } else {
      const d = Math.sqrt(d2 + dy * dy) + 1e-3, sp = 12 + SC.t[i] * 5 + VS.speed;
      SC.x[i] += dx / d * sp * dt; SC.y[i] += dy / d * sp * dt; SC.z[i] += dz / d * sp * dt;
      if (d < 2.6) { SC.st[i] = 0; G.scrap++; G.forge++; G.hp = Math.min(G.maxHp, G.hp + 1.5); SFX.scrap(); if (G.forge >= G.forgeNeed) { G.forge -= G.forgeNeed; G.forgeNeed = Math.round(G.forgeNeed * 1.25); G.pendingForge++; } }
    }
  }
}

// ---------------- upgrades / cards ----------------
let CARDS = null, cardSel = 0, cardOpenT = 0;
function offerCards(forge) {
  const opts = [];
  for (const e of EVOS) if (!G.evo[e.id] && (G.lv[e.w] || 0) >= 5 && (G.lv[e.p] || 0) >= 1) opts.push({ evo: e, w: 9 });
  const pool = [];
  for (const k in UPG) { const u = UPG[k], l = G.lv[k] || 0; if (l >= u.max) continue; if (EVOS.some((e) => e.w === k && G.evo[e.id])) continue; pool.push({ key: k, w: u.kind === 'weapon' ? (l ? 1.6 : 1.3) : 1 }); }
  const pick = [];
  for (const o of opts) if (pick.length < 2) pick.push(o);
  while (pick.length < 3 && pool.length) { let s = 0; for (const p of pool) s += p.w; let r = Math.random() * s; let j = 0; for (; j < pool.length - 1; j++) { r -= pool[j].w; if (r <= 0) break; } pick.push(pool[j]); pool.splice(j, 1); }
  if (forge || pick.length < 3) pick.push({ repair: true });
  while (pick.length > 3) { const j = pick.findIndex((p) => p.repair); if (j >= 0 && pick.length > 3 && !forge) pick.splice(j, 1); else pick.splice(2, 1); }
  return pick.slice(0, 3);
}
function openCards(forge) {
  CARDS = offerCards(forge); cardSel = 0; cardOpenT = performance.now();
  if (G.demo || G.botOn) { // the attract bot picks for itself
    let best = 0; CARDS.forEach((c, i) => { if (c.evo) best = i; else if (!CARDS[best].evo && c.key && UPG[c.key].kind === 'weapon' && !(CARDS[best].key && UPG[CARDS[best].key].kind === 'weapon')) best = i; });
    applyCard(CARDS[best]); CARDS = null; return;
  }
  G.state = 'levelup'; auSilence(); SFX.level();
  const el = $('cards'); el.innerHTML = '';
  const h = document.createElement('div'); h.className = 'ch'; h.textContent = forge ? 'SCRAP FORGE' : 'LEVEL ' + G.level + '!'; el.appendChild(h);
  const row = document.createElement('div'); row.className = 'crow'; el.appendChild(row);
  CARDS.forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'card' + (c.evo ? ' evo' : '') + (c.repair ? ' rep' : '');
    let title, desc, lvl = '', icon;
    if (c.evo) { title = c.evo.name; desc = c.evo.d; lvl = 'EVOLUTION'; icon = c.evo.icon; }
    else if (c.repair) { title = 'FIELD REPAIR'; desc = 'Patch the hull +45 and refill nitro.'; lvl = 'REPAIR'; icon = 'repair'; }
    else { const u = UPG[c.key], l = G.lv[c.key] || 0; title = u.name; desc = u.d[Math.min(l, u.d.length - 1)] || u.d[0]; lvl = l ? 'LV ' + l + ' → ' + (l + 1) : 'NEW'; icon = u.icon; if (u.kind === 'passive' && l) desc = u.d[0]; }
    b.innerHTML = `<span class="ck">${i + 1}</span>${ICON(icon)}<b>${title}</b><i>${lvl}</i><p>${desc}</p>`;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (performance.now() - cardOpenT > 220) chooseCard(i); });
    row.appendChild(b);
  });
  el.classList.add('on'); highlightCard();
}
function highlightCard() { [...$('cards').querySelectorAll('.card')].forEach((b, i) => b.classList.toggle('sel', i === cardSel)); }
function chooseCard(i) { if (!CARDS || !CARDS[i]) return; applyCard(CARDS[i]); CARDS = null; $('cards').classList.remove('on'); SFX.card(); G.state = 'play'; }
function applyCard(c) {
  if (c.evo) { G.evo[c.evo.id] = true; banner(c.evo.name, 'EVOLVED!', '#ff4fd8', 2.6); }
  else if (c.repair) { G.hp = Math.min(G.maxHp, G.hp + 45); G.nitro = G.nitroMax; }
  else { G.lv[c.key] = Math.min(UPG[c.key].max, (G.lv[c.key] || 0) + 1); if (c.key === 'armor') G.hp += 40; }
  updateWeaponRigs(); G.hp = Math.min(G.hp, G.maxHp);
}
function ICON(k) {
  const S = (b) => `<svg viewBox="0 0 64 64" class="ic">${b}</svg>`;
  const st = 'stroke="#1a0f12" stroke-width="4" stroke-linejoin="round"';
  switch (k) {
    case 'mg': return S(`<rect x="8" y="28" width="30" height="14" rx="3" fill="#8a9096" ${st}/><rect x="36" y="31" width="22" height="7" fill="#3b3f46" ${st}/><rect x="16" y="40" width="10" height="14" fill="#4e6b3a" ${st}/>`);
    case 'flame': return S(`<path d="M32 6 C44 20 52 28 46 44 C42 56 22 58 18 44 C14 32 26 26 24 14 C30 20 30 24 32 6Z" fill="#ff8a1e" ${st}/><path d="M32 30 C38 36 40 42 36 48 C32 52 26 50 26 44 C26 38 32 36 32 30Z" fill="#ffd23c"/>`);
    case 'saw': return S(`<circle cx="32" cy="32" r="20" fill="#c9d1d8" ${st}/>${[...Array(10)].map((_, i) => { const a = i / 10 * 6.283, x = 32 + Math.cos(a) * 24, y = 32 + Math.sin(a) * 24; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#eef3f6" ${st}/>`; }).join('')}<circle cx="32" cy="32" r="7" fill="#c0392b" ${st}/>`);
    case 'harpoon': return S(`<path d="M8 56 L44 20" stroke="#5b3a2c" stroke-width="7"/><path d="M40 10 L56 8 L54 24 Z" fill="#d5dde3" ${st}/><path d="M8 56 C16 40 4 34 14 26" stroke="#2a1d1a" stroke-width="3" fill="none"/>`);
    case 'spikes': return S(`<rect x="6" y="36" width="52" height="12" fill="#3b3f46" ${st}/>${[10, 22, 34, 46].map((x) => `<path d="M${x} 36 L${x + 6} 10 L${x + 12} 36Z" fill="#e9eef2" ${st}/>`).join('')}`);
    case 'armor': return S(`<path d="M32 6 L54 14 L50 40 C46 50 38 56 32 58 C26 56 18 50 14 40 L10 14Z" fill="#8f4e36" ${st}/><circle cx="22" cy="22" r="3" fill="#ffcf2e"/><circle cx="42" cy="22" r="3" fill="#ffcf2e"/><circle cx="32" cy="44" r="3" fill="#ffcf2e"/>`);
    case 'nitro': return S(`<rect x="18" y="14" width="28" height="44" rx="10" fill="#4fc9ff" ${st}/><rect x="26" y="6" width="12" height="10" fill="#d5dde3" ${st}/><path d="M34 22 L26 38 L34 38 L30 52 L42 32 L34 32Z" fill="#fff"/>`);
    case 'magnet': return S(`<path d="M14 8 L14 34 C14 46 22 54 32 54 C42 54 50 46 50 34 L50 8 L38 8 L38 34 C38 38 36 42 32 42 C28 42 26 38 26 34 L26 8Z" fill="#e8312a" ${st}/><rect x="14" y="8" width="12" height="9" fill="#d5dde3"/><rect x="38" y="8" width="12" height="9" fill="#d5dde3"/>`);
    case 'engine': return S(`<rect x="10" y="22" width="44" height="28" rx="4" fill="#8a9096" ${st}/><rect x="20" y="10" width="24" height="14" fill="#d5dde3" ${st}/><rect x="24" y="4" width="16" height="7" fill="#ffcf2e" ${st}/><rect x="16" y="30" width="32" height="5" fill="#3b3f46"/><rect x="16" y="39" width="32" height="5" fill="#3b3f46"/>`);
    default: return S(`<path d="M20 10 L44 10 L40 30 L52 30 L26 58 L30 36 L16 36Z" fill="#7dffb0" ${st}/>`);
  }
}

// ---------------- stunts ----------------
function stuntStep(dt) {
  if (VS.contacts === 0) {
    G.airT += dt; G.airPitch += VS.w.dot(_ax) * dt; G.airRoll += VS.w.dot(_az) * dt;
  } else if (G.airT > 0) {
    const t = G.airT; G.airT = 0;
    const flips = Math.round(Math.abs(G.airPitch) / TAU), rolls = Math.round(Math.abs(G.airRoll) / TAU);
    G.airPitch = 0; G.airRoll = 0;
    if (t > 0.5) { G.shake = Math.min(1, G.shake + Math.min(0.6, t * 0.25)); pEmitDust(14); SFX.crash(t * 6); }
    if (VS.upY < 0.4) return;
    if (flips || rolls) { const name = (flips ? (flips > 1 ? flips + 'x ' : '') + 'FLIP' : '') + (flips && rolls ? ' + ' : '') + (rolls ? (rolls > 1 ? rolls + 'x ' : '') + 'ROLL' : ''); callout(name + '!', '#ff4fd8'); G.nitro = Math.min(G.nitroMax, G.nitro + 35 * (flips + rolls)); gainXP(6 * (flips + rolls)); }
    else if (t > 1.0) { callout((t > 2 ? 'HUGE AIR ' : 'AIR ') + t.toFixed(1) + 's', '#4fc9ff'); G.nitro = Math.min(G.nitroMax, G.nitro + t * 12); gainXP(Math.round(t * 2)); }
  }
  if (VS.drift > 0.6 && VS.speed > 12) { G.driftT += dt; G.nitro = Math.min(G.nitroMax, G.nitro + dt * 8); } else if (G.driftT > 0) { if (G.driftT > 1.5) callout('DRIFT ' + G.driftT.toFixed(1) + 's', '#4fc9ff'); G.driftT = 0; }
}
function pEmitDust(n) { for (let k = 0; k < n; k++) { const a = Math.random() * TAU; pEmit(PS_A, VS.pos.x + Math.sin(a) * 2, VS.pos.y - 1.3, VS.pos.z + Math.cos(a) * 2, Math.sin(a) * rnd(3, 8), rnd(1, 3), Math.cos(a) * rnd(3, 8), rnd(0.6, 1.1), 1.0, 2.8, C_DUST, 0.85, 2, 2); } }

// ---------------- one fixed simulation step ----------------
const _ip = { gas: 0, brake: 0, steer: 0, nitro: false, drift: false, reset: false };
function simStep(dt) {
  G.t += dt; G.steps++;
  runEvents();
  // input source: the bot drives the attract mode (and ?bot); the player's input otherwise
  const I = (G.demo || G.botOn) ? botInput(dt) : readInput();
  // nitro
  const wantBoost = I.nitro && G.nitro > 1;
  if (wantBoost && !VS.boosting) { if (G.nitro > 12) { VS.boosting = true; G.inv = Math.max(G.inv, 0.35); SFX.nitro(); } }
  if (!wantBoost) VS.boosting = false;
  if (VS.boosting) { G.nitro -= 30 * dt; if (G.nitro <= 0) { G.nitro = 0; VS.boosting = false; } }
  else G.nitro = Math.min(G.nitroMax, G.nitro + (5 + (G.lv.nitro || 0) * 2) * dt);
  G.inv -= dt;
  // physics (2 substeps)
  VS.ppos.copy(VS.pos); VS.pq.copy(VS.q);
  const sub = dt / 2;
  for (let s = 0; s < 2; s++) { vanStep(sub, I, MODS); }
  vanCollide((v) => { if (v > 9) { const d = (v - 9) * 0.9 * (1 - 0.08 * ((G.lv.spikes || 1) - 1)); vanDamage(d, false); SFX.crash(v); G.shake = Math.min(1, G.shake + v / 40); sparkBurst(VS.pos.x + _az.x * 2.5, VS.pos.y, VS.pos.z + _az.z * 2.5, 10, 8); } });
  if (VS.hullHit > 7 && VS.upY < 0.5) { vanDamage(VS.hullHit * 0.6, false); SFX.crash(VS.hullHit); }
  // self-righting: stuck on the side/roof, or R
  if ((VS.upY < 0.55 && VS.speed < 4) || (VS.contacts === 0 && VS.speed < 1.5 && VS.pos.y - groundH(VS.pos.x, VS.pos.z) < 2.5)) VS.stuck += dt; else VS.stuck = 0;
  if (I.reset || VS.stuck > 1.3) { const yaw = vanYaw(); VS.pos.y = groundH(VS.pos.x, VS.pos.z) + 2.6; VS.q.setFromAxisAngle(_v3.set(0, 1, 0), yaw); VS.w.set(0, 0, 0); VS.vel.multiplyScalar(0.3); VS.stuck = 0; I.reset = false; INP.reset = false; callout('BACK ON THE WHEELS', '#fff'); }
  if (VS.pos.y < -40) vanReset(START.x, START.z, 0);
  vanAxes();
  // weapons, horde, enemies
  mgStep(dt); flameStep(dt); sawStep(dt); harpoonStep(dt);
  hordeStep(dt);
  ramStep(dt);
  bulletStep(dt);
  for (let k = BIGS.length - 1; k >= 0; k--) bigStep(BIGS[k], dt);
  rockStep(dt);
  pickupStep(dt);
  gibStep(dt);
  teleStep(dt);
  stuntStep(dt);
  for (const b of BARRELS) if (!b.alive) { b.t -= dt; if (b.t <= 0 && Math.hypot(b.x - VS.pos.x, b.z - VS.pos.z) > 25) { b.alive = true; syncBarrel(b); } }
  // director: keep the horde near its target size
  const tgt = targetAlive(G.t) * (G.demo ? 0.85 : 1);
  if (HORDE.alive < tgt) {
    G.spawnAcc += dt * Math.min(80, 8 + (tgt - HORDE.alive) * 0.6);
    const hpMul = 1 + G.t / 200, runP = G.t < 40 ? 0 : Math.min(0.3, 0.06 + G.t / 1200) + G.bloodMoon * 0.08, bloatP = G.t < 60 ? 0.02 : 0.06;
    while (G.spawnAcc >= 1) { G.spawnAcc -= 1; const p = spawnRing(55, 92); if (p) { const r = Math.random(); zSpawn(r < bloatP ? 2 : r < bloatP + runP ? 1 : 0, p[0], p[1], hpMul); } }
  }
  // combo & multi-kill callouts
  G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
  G.multiT -= dt; if (G.multiT <= 0 && G.multi) { const m = G.multi; G.multi = 0; if (m >= 25) callout('ROADKILL RAMPAGE! x' + m, '#ff4a3a'); else if (m >= 15) callout('MEAT GRINDER! x' + m, '#ff8a1e'); else if (m >= 8) callout('MOWED DOWN! x' + m, '#ffcf2e'); }
  // damage states
  const hpk = G.hp / G.maxHp; vanMat.userData.char.value = damp(vanMat.userData.char.value, (1 - hpk) * 0.55, 2, dt);
  G.sparkT -= dt;
  if (hpk < 0.6 && G.sparkT <= 0) { G.sparkT = hpk < 0.35 ? 0.05 : 0.18; _sp.set(rnd(-0.8, 0.8), 0.6, 2.0).applyQuaternion(VS.q).add(VS.pos); if (Math.random() < 0.5) sparkBurst(_sp.x, _sp.y, _sp.z, 2, 4); if (hpk < 0.35) pEmit(PS_A, _sp.x, _sp.y + 0.3, _sp.z, VS.vel.x * 0.3, 2.5, VS.vel.z * 0.3, 1.4, 0.8, 3.2, C_SMOKE, 0.85, -1, 0.8); if (hpk < 0.15) pEmit(PS_X, _sp.x, _sp.y + 0.2, _sp.z, VS.vel.x * 0.6, 3, VS.vel.z * 0.6, 0.5, 0.9, 1.6, C_FIRE, 1, -3, 1); }
  // drift smoke, dust trail, nitro flames
  for (const w of VAN.wheels) if (w.contact && (w.slip > 4 || (VS.drift > 0.5 && !w.front)) && Math.random() < 0.6) { _sp.set(w.x, w.y - w.t - 0.6, w.z).applyQuaternion(VS.q).add(VS.pos); pEmit(PS_A, _sp.x, _sp.y, _sp.z, rnd(-1, 1), rnd(0.5, 1.5), rnd(-1, 1), rnd(0.8, 1.3), 0.7, 2.6, C_SMOKEL, 0.7, -0.5, 1.2); }
  if (VS.contacts && VS.speed > 10 && Math.random() < 0.5) { _sp.set(rnd(-1, 1), -1.4, -2.4).applyQuaternion(VS.q).add(VS.pos); pEmit(PS_A, _sp.x, _sp.y, _sp.z, -VS.vel.x * 0.1, rnd(0.5, 1.5), -VS.vel.z * 0.1, rnd(0.8, 1.2), 0.8, 2.2, C_DUST, 0.6, 0, 1); }
  if (VS.boosting) for (const s of [-1, 1]) { _sp.set(s * 1.16, 2.2, -0.35).applyQuaternion(VS.q).add(VS.pos); pEmit(PS_X, _sp.x, _sp.y, _sp.z, VS.vel.x * 0.7 + _ay.x * 6 - _az.x * 4, 6, VS.vel.z * 0.7 + _ay.z * 6 - _az.z * 4, 0.22, 0.7, 0.2, Math.random() < 0.5 ? C_NITRO : C_WHITE, 1, 0, 3); }
  else if (I.gas > 0 && Math.random() < 0.25) { _sp.set(Math.random() < 0.5 ? -1.16 : 1.16, 2.2, -0.35).applyQuaternion(VS.q).add(VS.pos); pEmit(PS_A, _sp.x, _sp.y, _sp.z, VS.vel.x * 0.8, 3, VS.vel.z * 0.8, 0.6, 0.35, 1.2, C_SMOKE, 0.5, -1, 1); }
  // extraction
  if (EXT.open) { EXT.t += dt; if (Math.hypot(VS.pos.x - EXTRACT.x, VS.pos.z - EXTRACT.z) < EXTRACT.r && !G.demo) gameOver(true); else if (G.demo && Math.hypot(VS.pos.x - EXTRACT.x, VS.pos.z - EXTRACT.z) < EXTRACT.r) { resetRun(true); return; } }
  if (G.demo && G.t > 150) { resetRun(true); return; }
  // level-ups (paused card pick)
  if (G.state === 'play' || G.state === 'attract') { if (G.pendingLv > 0) { G.pendingLv--; openCards(false); } else if (G.pendingForge > 0) { G.pendingForge--; openCards(true); } }
  // groans
  G.groanT -= dt; if (G.groanT <= 0) { const n = hQuery(VS.pos.x, VS.pos.z, 20); G.groanT = n > 30 ? rnd(0.35, 0.8) : rnd(0.9, 2.2); if (n) SFX.groan(n); }
  AU.intensity = G.demo ? 2 : (G.boss && !G.boss.dead) || G.extract ? 3 : G.bloodMoon ? 3 : G.t > 90 ? 2 : G.t > 15 ? 1 : 0;
}
function targetAlive(t) {
  const P = [[0, 110], [30, 230], [60, 380], [90, 520], [120, 650], [150, 760], [180, 880], [210, 980], [240, 1100], [270, 1220], [300, 1320], [330, 1420], [360, 1520], [420, 1600]];
  for (let i = 1; i < P.length; i++) if (t < P[i][0]) return lerp(P[i - 1][1], P[i][1], (t - P[i - 1][0]) / (P[i][0] - P[i - 1][0]));
  return 1600;
}
function gameOver(won) {
  if (G.state === 'dead' || G.state === 'win') return;
  G.state = won ? 'win' : 'dead'; auSilence();
  const score = Math.round(G.kills * 10 + G.t * 20 + (won ? 5000 : 0) + G.bigKills * 500);
  const rank = won ? (G.dmgTaken < G.maxHp * 0.6 ? 'S' : G.t < 390 ? 'A' : 'B') : (G.t > 270 ? 'B' : G.t > 150 ? 'C' : 'D');
  const prev = G.best; const best = !prev || score > prev.score;
  if (best) { G.best = { score, kills: G.kills, t: G.t, won }; try { localStorage.setItem('rr_best', JSON.stringify(G.best)); } catch (_) {} }
  G.result = { won, score, rank, best };
  if (won) { SFX.win(); G.slowT = 1.2; } else { SFX.lose(); explosionFx(VS.pos.x, VS.pos.y, VS.pos.z, 8); G.slowT = 1.5; VS.vel.y += 6; VS.w.set(rnd(-2, 2), rnd(-1, 1), rnd(-2, 2)); }
  later(0.01, () => {});
  showResult();
}
function fmtT(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
function showResult() {
  const R = G.result, el = $('result');
  el.querySelector('.rt').textContent = R.won ? 'EXTRACTED!' : 'WRECKED';
  el.querySelector('.rt').className = 'rt ' + (R.won ? 'won' : 'lost');
  el.querySelector('.rs').innerHTML = `<div><b>${fmtT(G.t)}</b><i>TIME</i></div><div><b>${G.kills}</b><i>KILLS</i></div><div><b>${G.bestCombo}</b><i>BEST COMBO</i></div><div><b class="rk">${R.rank}</b><i>RANK</i></div>`;
  const b = G.best; el.querySelector('.rb').textContent = (R.best ? 'NEW BEST RUN! ' : 'BEST RUN: ') + b.score.toLocaleString() + ' pts · ' + b.kills + ' kills · ' + fmtT(b.t) + (b.won ? ' · extracted' : '');
  el.classList.add('on'); document.body.classList.add('res'); bestLine();
}
