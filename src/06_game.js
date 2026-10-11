
// ---------------- fighters ----------------
const S = { time: 0, kills: 0, hits: 0, combo: 0, comboT: 0, hitstop: 0, shake: 0, playerDowns: 0, maxCombo: 0 };
class Fighter {
  constructor(J, o) {
    this.J = J; this.root = J.root; scene.add(this.root);
    this.pos = new THREE.Vector3(o.x, 0, o.z); this.vel = new THREE.Vector2(); this.kb = new THREE.Vector2();
    this.y = 0; this.vy = 0; this.yaw = o.yaw || 0; this.hp = this.maxHp = o.hp; this.r = o.r || 0.42;
    this.state = 'idle'; this.st = 0; this.at = Math.random() * 10; this.flash = 0; this.inv = 0; this.scale = o.scale || 1;
    this.root.scale.setScalar(this.scale); this.speed = 0;
  }
  set(st) { this.state = st; this.st = 0; }
  get alive() { return this.state !== 'dead'; }
  sync(dt) {
    this.root.position.set(this.pos.x, this.pos.y + this.y, this.pos.z); this.root.rotation.y = this.yaw;
    this.flash = Math.max(0, this.flash - dt * 6); this.J.mat.userData.flash.value = this.flash > 0 ? Math.min(1, this.flash) * 0.85 : 0;
  }
}
const HERO_START = { x: -45, z: -32.6, yaw: Math.PI / 2, camYaw: -Math.PI / 2 }; // Harborplace, on the promenade, looking east along the harbour
const hero = new Fighter(buildHero(), { x: HERO_START.x, z: HERO_START.z, yaw: HERO_START.yaw, hp: 100, r: 0.45 });
hero.J.mat.userData.flashC.value.set('#fff'); hero.roof = false; hero.name = 'HAROLD';
// the AI partner: MAVIS, Harold's wife (grey afro, floral dress, pearls, handbag), always computer-controlled (see 06c_partner.js)
const partner = new Fighter(buildHero({ wife: true }), { x: -46, z: -34.6, yaw: HERO_START.yaw, hp: 100, r: 0.45 });
partner.J.mat.userData.flashC.value.set('#fff'); partner.roof = false; partner.name = 'MAVIS'; partner.isPartner = true;
const POSTS = [ // thugs spread over the districts: a pair (or trio) near every landmark; look 4 is the bruiser
  { x: -24, z: -33.5, look: 0 }, { x: -20, z: -32, look: 1 },                         // Constellation / WTC promenade (first fight)
  { x: 17, z: -33.5, look: 2 }, { x: 21, z: -32.2, look: 3 },                          // Aquarium
  { x: 54, z: -33.6, look: 1 }, { x: 58, z: -32, look: 4 },                            // Power Plant
  { x: 80, z: -41, look: 0 }, { x: 85, z: -40, look: 2 },                              // Four Seasons (Pratt St)
  { x: 123, z: -33, look: 3 }, { x: 129, z: -33.5, look: 1 },                          // Pendry
  { x: 166, z: -56, look: 0 }, { x: 167, z: -50, look: 2 }, { x: 165, z: -63, look: 4 }, // Fells Point square
  { x: -24, z: -85, look: 3 }, { x: -16, z: -85, look: 1 },                            // Washington Monument
  { x: -71, z: -6, look: 0 }, { x: -70, z: 2, look: 2 },                               // Oriole Park (Light St)
  { x: -92, z: -4, look: 3 },                                                          // Oriole Park (warehouse alley)
  { x: -71, z: 52, look: 1 }, { x: -84, z: 76, look: 4 },                              // M&T Bank Stadium
  { x: -54, z: 33.5, look: 2 }, { x: -48, z: 33.2, look: 0 },                          // Science Center promenade
  { x: -6, z: 50, look: 3 }, { x: -1, z: 57, look: 1 },                                // Federal Hill
  { x: 80, z: 40, look: 0 }, { x: 85, z: 41, look: 2 },                                // Domino Sugar (Key Hwy)
  { x: 114, z: 41, look: 3 }, { x: 119, z: 40.5, look: 1 },                            // Under Armour
  { x: 172, z: 52, look: 0 }, { x: 178, z: 77, look: 4 },                              // Fort McHenry
].map((p) => Object.assign({ yaw: 0 }, p));
const enemies = POSTS.map((p, i) => {
  const look = THUG_LOOKS[p.look], big = !!look.big;
  const e = new Fighter(buildThug(look), { x: p.x, z: p.z, yaw: p.yaw, hp: big ? 16 : 8, scale: big ? 1.2 : 1, r: big ? 0.55 : 0.42 });
  e.J.mat.userData.flashC.value.set('#fff'); e.post = p; e.big = big; e.armed = !!look.weapon; e.cool = 0; e.slot = (i / POSTS.length) * TAU; e.respawn = 0; e.id = i;
  // hp pip above the head
  const c = document.createElement('canvas'); c.width = 128; c.height = 20; e.hpC = c; e.hpT = new THREE.CanvasTexture(c); e.hpT.colorSpace = THREE.SRGBColorSpace;
  e.hpS = new THREE.Sprite(new THREE.SpriteMaterial({ map: e.hpT, depthTest: false, transparent: true, fog: false })); e.hpS.scale.set(1.1, 0.17, 1); e.hpS.renderOrder = 15; e.hpS.visible = false; scene.add(e.hpS); e.hpShow = 0;
  e.dz = new THREE.Sprite(new THREE.SpriteMaterial({ map: FXT.dizzy, depthTest: false, transparent: true, fog: false })); e.dz.renderOrder = 16; e.dz.visible = false; e.dz.scale.set(1.0, 0.5, 1); scene.add(e.dz);
  e.bang = null; return e;
});
function drawHp(e) {
  const c = e.hpC.getContext('2d'); c.clearRect(0, 0, 128, 20); c.fillStyle = INK; c.fillRect(0, 0, 128, 20);
  c.fillStyle = '#ff3d6e'; c.fillRect(4, 4, 120 * Math.max(0, e.hp) / e.maxHp, 12); c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(4, 4, 120 * Math.max(0, e.hp) / e.maxHp, 4); e.hpT.needsUpdate = true;
}
const ALL = [hero, partner, ...enemies];
// distance LOD for the thugs (phones: every rig part is a draw call, x2 with its ink hull, x3 with its shadow):
// beyond 24 m a thug drops its ink outlines and stops casting shadows
for (const f of ALL) { f.J.ol = []; f.J.sh = []; f.root.traverse((o) => { if (o.isMesh && o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide) f.J.ol.push(o); else if (o.isMesh && o.castShadow) f.J.sh.push(o); }); f.lodNear = true; }
function rigLod() {
  for (const e of enemies) { const near = (e.pos.x - hero.pos.x) ** 2 + (e.pos.z - hero.pos.z) ** 2 < 24 * 24;
    if (near === e.lodNear && e.lodHd === QUAL.hd) continue; e.lodNear = near; e.lodHd = QUAL.hd;
    for (const o of e.J.ol) o.visible = near && QUAL.hd; for (const o of e.J.sh) o.castShadow = near; }
}

// ---------------- world collision ----------------
const DROWN_ST = new Set(['down', 'hurt', 'dizzy']); // knocked / thrown thugs that cross the seawall go in the harbour
function collide(f) {
  const p = f.pos; if (f.state === 'drown') return;
  if (f.roof) { // rooftop shortcut: walk inside the parapet, around the AC unit
    p.x = clamp(p.x, ROOF.x0, ROOF.x1); p.z = clamp(p.z, ROOF.z0, ROOF.z1);
    const a = ROOF.ac, m = f.r * 0.8; if (p.x > a.x0 - m && p.x < a.x1 + m && p.z > a.z0 - m && p.z < a.z1 + m) {
      const o = [p.x - (a.x0 - m), a.x1 + m - p.x, p.z - (a.z0 - m), a.z1 + m - p.z], k = o.indexOf(Math.min(...o));
      if (k === 0) p.x = a.x0 - m; else if (k === 1) p.x = a.x1 + m; else if (k === 2) p.z = a.z0 - m; else p.z = a.z1 + m; }
    p.y = ROOF.y; return;
  } p.x = clamp(p.x, WB.x0, WB.x1); p.z = clamp(p.z, WB.z0, WB.z1); // the city edge
  for (const c of collAt(p.x, p.z)) {
    if (c.r !== undefined) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + f.r * 0.8; if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; } }
    else { const m = f.r * 0.8; if (p.x > c.x0 - m && p.x < c.x1 + m && p.z > c.z0 - m && p.z < c.z1 + m) {
      const o = [p.x - (c.x0 - m), c.x1 + m - p.x, p.z - (c.z0 - m), c.z1 + m - p.z], k = o.indexOf(Math.min(...o));
      if (k === 0) p.x = c.x0 - m; else if (k === 1) p.x = c.x1 + m; else if (k === 2) p.z = c.z0 - m; else p.z = c.z1 + m; } }
  }
  // the harbour: never step into the water (slide along the seawall, else back to the last dry spot)
  if (isWater(p.x, p.z) && f.post && DROWN_ST.has(f.state)) { if (f.y < 0.45) startDrown(f); return; } // thugs: in the drink (airborne ones fly on)
  if (isWater(p.x, p.z) && !f.post && (f.state === 'down' || f.state === 'hurt')) { heroSplash(f); return; } // Harold / Mavis: splash, back on the dock
  if (isWater(p.x, p.z)) { const s = f.dry || { x: HERO_START.x, z: HERO_START.z };
    if (!isWater(p.x, s.z)) p.z = s.z; else if (!isWater(s.x, p.z)) p.x = s.x; else { p.x = s.x; p.z = s.z; } f.wet = (f.wet || 0) + 1; }
  if (!isWater(p.x, p.z)) { f.dry = f.dry || { x: 0, z: 0 }; f.dry.x = p.x; f.dry.z = p.z; }
  const gy = groundY(p.x, p.z); p.y = Math.abs(gy - p.y) > 1.2 ? damp(p.y, gy, 9, 1 / 60) : damp(p.y, gy, 18, 1 / 60);
}
function separate() {
  for (let i = 0; i < ALL.length; i++) for (let j = i + 1; j < ALL.length; j++) {
    const a = ALL[i], b = ALL[j]; if (!a.alive || !b.alive || a.state === 'down' || b.state === 'down' || a.roof || b.roof || CINE_ST.has(a.state) || a.fin || b.fin || a.ghost || b.ghost) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.r + b.r;
    if (d < m && d > 1e-4) { const k = (m - d) / 2; a.pos.x -= dx / d * k; a.pos.z -= dz / d * k; b.pos.x += dx / d * k; b.pos.z += dz / d * k; }
  }
}

// ---------------- input ----------------
const KEYS = new Set(); const PRESS = new Set();
const IN = { mx: 0, my: 0, look: 0, lookY: 0, dragX: 0, dragY: 0, lastLook: -9, bot: null };
let DEV = TOUCH ? 'touch' : 'kb';
addEventListener('keydown', (e) => {
  DEV = 'kb'; if (CINE.intro && CINE.intro.t > 0.4) CINE.intro.skip = true;
  audioInit(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
  const k = e.key.toLowerCase(); if (!KEYS.has(k)) PRESS.add(k); KEYS.add(k);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', (e) => KEYS.delete(e.key.toLowerCase()));
addEventListener('blur', () => KEYS.clear());
const pressed = (...ks) => ks.some((k) => PRESS.has(k));
// mouse / touch drag on the canvas orbits the camera; touch stick + buttons
const TOUCHS = { stick: null, sx: 0, sy: 0, x: 0, y: 0, drag: new Map(), btn: { a: false, b: false, l: false, r: false } };
if (TOUCH) document.body.classList.add('touch');
canvas.addEventListener('pointerdown', (e) => {
  audioInit(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
  canvas.setPointerCapture?.(e.pointerId); if (e.pointerType === 'touch') DEV = 'touch'; if (CINE.intro && CINE.intro.t > 0.4) CINE.intro.skip = true;
  // (no floating virtual pad: on touch screens the stick + buttons live on the arcade panel below the game; a drag on the game orbits the camera)

  TOUCHS.drag.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
const ptrMove = (e) => {
  if (e.pointerId === TOUCHS.stick) { const dx = e.clientX - TOUCHS.sx, dy = e.clientY - TOUCHS.sy, d = Math.hypot(dx, dy), m = 52, s = d > m ? m / d : 1;
    TOUCHS.x = dx * s / m; TOUCHS.y = dy * s / m; $('knob').style.transform = `translate(${dx * s}px, ${dy * s}px)`; return; }
  const d = TOUCHS.drag.get(e.pointerId); if (!d) return;
  IN.dragX += e.clientX - d.x; IN.dragY += e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; IN.lastLook = S.time;
};
canvas.addEventListener('pointermove', ptrMove);
const endPtr = (e) => {
  if (e.pointerId === TOUCHS.stick) { TOUCHS.stick = null; TOUCHS.x = TOUCHS.y = 0; $('knob').style.transform = ''; const st = $('stick'); st.classList.remove('act'); st.style.left = ''; st.style.top = ''; }
  TOUCHS.drag.delete(e.pointerId);
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
for (const [id, k] of [['bA', 'a'], ['bB', 'b'], ['bC', 'c'], ['cL', 'l'], ['cR', 'r']]) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); audioInit(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); TOUCHS.btn[k] = true; el.classList.add('down'); DEV = 'touch'; if (CINE.intro && CINE.intro.t > 0.4) CINE.intro.skip = true; if (k === 'a') PRESS.add('j'); if (k === 'b') PRESS.add('k'); if (k === 'c') PRESS.add('e'); });
  const up = () => { TOUCHS.btn[k] = false; el.classList.remove('down'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
}
let PAD_PREV = [];
function readInput() {
  let mx = 0, my = 0, look = 0, lookY = 0;
  if (KEYS.has('a') || KEYS.has('arrowleft')) mx -= 1; if (KEYS.has('d') || KEYS.has('arrowright')) mx += 1;
  if (KEYS.has('w') || KEYS.has('arrowup')) my += 1; if (KEYS.has('s') || KEYS.has('arrowdown')) my -= 1;
  if (KEYS.has('q')) look -= 1; if (KEYS.has('r')) look += 1;
  if (TOUCHS.stick !== null) { mx += TOUCHS.x; my -= TOUCHS.y; }
  if (TOUCHS.btn.l) look -= 1; if (TOUCHS.btn.r) look += 1;
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; IN.padAct = false;
  for (const gp of pads) {
    if (!gp) continue; const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    mx += dz(gp.axes[0] || 0); my -= dz(gp.axes[1] || 0); look += dz(gp.axes[2] || 0); lookY += dz(gp.axes[3] || 0);
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    if (b(4)) look -= 1; if (b(5)) look += 1;
    const prev = PAD_PREV[gp.index] || []; if (b(3)) IN.padAct = true;
    if ((b(2) && !prev[2]) || (b(1) && !prev[1])) PRESS.add('j'); if (b(0) && !prev[0]) PRESS.add('k'); if (b(3) && !prev[3]) PRESS.add('e');
    if (gp.buttons.some((x) => x.pressed) || Math.abs(gp.axes[0] || 0) > 0.5) { DEV = 'pad'; if (CINE.intro && CINE.intro.t > 0.4) CINE.intro.skip = true; }
    PAD_PREV[gp.index] = gp.buttons.map((x) => x.pressed);
  }
  if (IN.bot) { mx = IN.bot.mx; my = IN.bot.my; look += IN.bot.look || 0; if (IN.bot.atk) { PRESS.add('j'); IN.bot.atk = false; } if (IN.bot.jump) { PRESS.add('k'); IN.bot.jump = false; } if (IN.bot.act) { PRESS.add('e'); IN.bot.act = false; } }
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  IN.mx = mx; IN.my = my; IN.look = clamp(look, -1, 1); IN.lookY = lookY; if (look || lookY) IN.lastLook = S.time;
}

// ---------------- camera: cinematic over-the-shoulder (low, close, right-shoulder offset, handheld sway); widens in fights; boxed against walls ----------------
const CAM = { yaw: HERO_START.camYaw, pitch: 0.17, dist: 4.4, cur: 4.4, sh: 0.72, pivot: new THREE.Vector3(HERO_START.x, 1.55, HERO_START.z), look: new THREE.Vector3(), pos: new THREE.Vector3(), fov: 58, lockYawT: 0, fightK: 0 };
function camFwd(yaw) { return [-Math.sin(yaw), -Math.cos(yaw)]; } // xz forward of the camera
function segBox(ax, ay, az, bx, by, bz, b, pad) { // param t of the first hit of segment a->b with an AABB, or 1
  let t0 = 0, t1 = 1; const P = [[ax, bx, b.x0 - pad, b.x1 + pad], [ay, by, (b.y0 || -1), b.h + pad], [az, bz, b.z0 - pad, b.z1 + pad]];
  for (const [a, c, lo, hi] of P) { const d = c - a; if (Math.abs(d) < 1e-6) { if (a < lo || a > hi) return 1; continue; }
    let u0 = (lo - a) / d, u1 = (hi - a) / d; if (u0 > u1) [u0, u1] = [u1, u0]; t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) return 1; }
  return t0;
}
let lockT = null;
function updateCamera(dt, rdt) {
  // orbit input
  CAM.yaw -= IN.look * rdt * 2.3; CAM.yaw -= IN.dragX * 0.0062; CAM.pitch = clamp(CAM.pitch + IN.dragY * 0.0035 + IN.lookY * rdt * 1.4, 0.02, 0.9); IN.dragX = IN.dragY = 0;
  const p = hero.pos; const fighting = lockT && lockT.alive && lockT.state !== 'dying';
  CAM.fightK = damp(CAM.fightK, fighting ? 1 : 0, 2.2, rdt); const fk = CAM.fightK;
  // auto-follow: when running and the player isn't steering the camera, swing in behind the hero
  const idleLook = S.time - IN.lastLook > 1.4;
  if (idleLook && hero.speed > 1 && (hero.state === 'move')) {
    const heading = Math.atan2(-hero.vel.x, -hero.vel.y), d = angTo(CAM.yaw, heading);
    if (Math.abs(d) < 2.2) CAM.yaw += d * (1 - Math.exp(-rdt * 1.1 * clamp(hero.speed / 6, 0, 1)));
  }
  // lock-on framing: keep the target inside the (narrower, off-centre) frame
  if (fighting && idleLook) {
    const tx = lockT.pos.x - p.x, tz = lockT.pos.z - p.z, ty = Math.atan2(-tx, -tz), d = angTo(CAM.yaw, ty);
    if (Math.abs(d) > 0.45) CAM.yaw += (d - Math.sign(d) * 0.45) * (1 - Math.exp(-rdt * 2.4));
  }
  CAM.yaw = wrapA(CAM.yaw);
  // pivot follows the hero's shoulders (vertical lag on jumps)
  const tgt = _v.set(p.x, p.y + 1.55 + hero.y * 0.45, p.z);
  if (fighting) { tgt.x += (lockT.pos.x - p.x) * 0.25; tgt.z += (lockT.pos.z - p.z) * 0.25; }
  CAM.pivot.x = damp(CAM.pivot.x, tgt.x, 9, rdt); CAM.pivot.z = damp(CAM.pivot.z, tgt.z, 9, rdt); CAM.pivot.y = damp(CAM.pivot.y, tgt.y, 6, rdt);
  const portrait = VH() > VW() * 1.15;
  const want = lerp(4.4, 5.9, fk) + (portrait ? 1.4 : 0);
  CAM.dist = damp(CAM.dist, want, 2.5, rdt);
  const pitch = CAM.pitch + fk * 0.12;
  const f = camFwd(CAM.yaw), r = [-f[1], f[0]], cp = Math.cos(pitch), sp = Math.sin(pitch);
  // right-shoulder offset (smaller in fights and on narrow portrait screens so the hero stays readable)
  const sh = lerp(0.95, 0.45, fk) * (portrait ? 0.55 : 1);
  const px = CAM.pivot.x + r[0] * sh, py = CAM.pivot.y, pz = CAM.pivot.z + r[1] * sh;
  const wx = px - f[0] * CAM.dist * cp, wy = py + CAM.dist * sp, wz = pz - f[1] * CAM.dist * cp;
  let t = 1; for (const b of BLD) { if (b.x1 < Math.min(px, wx) - 1 || b.x0 > Math.max(px, wx) + 1 || b.z1 < Math.min(pz, wz) - 1 || b.z0 > Math.max(pz, wz) + 1) continue; const h = segBox(px, py, pz, wx, wy, wz, b, 0.3); if (h < t) t = h; }
  const dd = Math.max(0.9, CAM.dist * t - 0.15);
  CAM.cur = dd < CAM.cur ? dd : damp(CAM.cur, dd, 4, rdt);
  const d = CAM.cur;
  CAM.pos.set(px - f[0] * d * cp, Math.max(py + d * sp, p.y + 0.5), pz - f[1] * d * cp);
  CAM.look.set(px + f[0] * 4.0, py + 0.2 - fk * 0.3, pz + f[1] * 4.0);
  // handheld sway: layered slow sines, a bit stronger in fights
  const T = S.time, amp = 1 + fk * 0.8;
  CAM.pos.x += (Math.sin(T * 0.73) * 0.03 + Math.sin(T * 1.91 + 1) * 0.012) * amp; CAM.pos.y += (Math.sin(T * 1.13 + 2) * 0.025 + Math.sin(T * 2.7) * 0.008) * amp;
  CAM.look.x += Math.sin(T * 0.51 + 4) * 0.05 * amp; CAM.look.y += Math.sin(T * 0.87 + 3) * 0.035 * amp;
  camera.position.copy(CAM.pos);
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - rdt * 3); const k = S.shake * S.shake * 0.25; camera.position.x += rnd(-k, k); camera.position.y += rnd(-k, k); }
  camera.up.set(0, 1, 0); camera.lookAt(CAM.look);
  setFov(lerp(58, 62, fk));
}
function setFov(base) { // wider in portrait so the street still fits
  const aspect = VW() / VH(); let fov = base; if (aspect < 1) fov = clamp(2 * Math.atan(Math.tan((base * 0.82 / 2) * Math.PI / 180) / aspect) * 180 / Math.PI, base, 84);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

// ---------------- combat ----------------
const WORDS_L = [0, 1, 4, 6], WORDS_H = [1, 3, 5];
function pickTarget(dirx, dirz, maxD = 7) {
  let best = null, bs = 1e9;
  for (const e of enemies) {
    if (!e.alive || e.state === 'dying' || e.state === 'drown') continue; const dx = e.pos.x - hero.pos.x, dz = e.pos.z - hero.pos.z, d = Math.hypot(dx, dz); if (d > maxD) continue;
    const ang = Math.acos(clamp((dx * dirx + dz * dirz) / (d || 1), -1, 1));
    const s = d + ang * 2.2 + (e.state === 'down' ? 4 : 0); if (s < bs) { bs = s; best = e; }
  }
  return best;
}
function hitEnemy(e, dmg, heavy, fromYaw, by = hero) {
  if (!e.alive || e.state === 'dying' || e.state === 'drown' || (e.state === 'down' && !heavy)) return false;
  e.hp -= dmg; e.lastBy = by; e.flash = 1; e.J.mat.userData.flashC.value.set('#fff'); e.hpShow = 2.5; drawHp(e); S.hits++;
  S.combo++; S.comboT = 1.3; S.maxCombo = Math.max(S.maxCombo, S.combo);
  const kx = Math.sin(fromYaw), kz = Math.cos(fromYaw);
  const at = _v.set(e.pos.x, e.pos.y + 1.1 * e.scale, e.pos.z);
  spawnSprite(FXT.star, at, heavy ? 1.6 : 1.15, 0.22, { rot: Math.random() * TAU });
  if (heavy || S.combo % 2 === 1) { const w = (heavy ? WORDS_H : WORDS_L)[(Math.random() * 3) | 0]; spawnSprite(FXT.words[w], at.clone().add(new THREE.Vector3(rnd(-0.3, 0.3), 0.8, 0)), heavy ? 1.15 : 0.85, 0.65, { kind: 'word', aspect: 512 / 192, rot: rnd(-0.18, 0.18) }); }
  // dizzy: the first time a thug drops to half health it staggers, seeing stars -> QTE finisher window
  if (e.state === 'dizzy' && e.hp < 1) e.hp = 1; // a dizzy thug can't be KO'd by ordinary hits: the QTE finisher (or its recovery) ends it
  if (e.hp > 0 && (e.state === 'dizzy' || (!e.dizzied && e.hp <= e.maxHp * 0.5))) {
    if (e.state !== 'dizzy') { e.dizzied = true; e.set('dizzy'); qteOpen(e); sfx('ko'); }
    e.kb.set(kx * 1.5, kz * 1.5); e.yaw = fromYaw + Math.PI; S.hitstop = 0.06; S.shake = Math.max(S.shake, 0.4); sfx('hit');
    if (e.bang) e.bang.life = 0.0001; return true;
  }
  if (e.hp <= 0 || heavy) {
    e.set('down'); e.kb.set(kx * (heavy ? 7.5 : 5), kz * (heavy ? 7.5 : 5)); e.vy = 4.2; e.y = 0.01; e.dead = e.hp <= 0; e.yaw = fromYaw + Math.PI;
    S.hitstop = 0.09; S.shake = Math.max(S.shake, 0.75); sfx('heavy');
  } else if (e.state === 'windup' || e.state === 'attack' || (e.big && e.state === 'chase' && Math.random() < 0.6)) { // committed swings (and the bruiser) shrug off light hits
    e.kb.set(kx * 1.2, kz * 1.2); S.hitstop = 0.05; S.shake = Math.max(S.shake, 0.3); sfx('hit');
  } else { e.set('hurt'); e.kb.set(kx * 3.2, kz * 3.2); e.yaw = fromYaw + Math.PI; S.hitstop = 0.055; S.shake = Math.max(S.shake, 0.4); sfx('hit'); }
  if (e.bang) e.bang.life = 0.0001;
  return true;
}
function hurtHero(dmg, fromX, fromZ, heavy) { hurtTurtle(hero, dmg, fromX, fromZ, heavy); }
// either turtle takes a hit; at 0 HP it goes down for good ('ko') until the other one revives it
const NOHURT = new Set(['down', 'getup', 'ko', 'tp', 'hop', 'pclimb', 'boost', 'tag', 'intro', 'power']);
function hurtTurtle(f, dmg, fromX, fromZ, heavy) {
  if (f.inv > 0 || NOHURT.has(f.state) || CINE_ST.has(f.state) || CINE.intro || f.hp <= 0) return;
  if (f.isPartner && f.state === 'revive') return; // covering the revive
  if (f.isPartner) dmg = Math.round(dmg * 0.8);
  f.hp = Math.max(0, f.hp - dmg); f.flash = 1; f.J.mat.userData.flashC.value.set('#ff3d6e');
  const dx = f.pos.x - fromX, dz = f.pos.z - fromZ, d = Math.hypot(dx, dz) || 1; f.yaw = Math.atan2(-dx, -dz);
  if (f === hero) S.combo = 0; S.shake = Math.max(S.shake, f === hero ? 0.5 : 0.25); sfx('hurt'); spawnSprite(FXT.star, _v.set(f.pos.x, f.pos.y + 1.2, f.pos.z), 0.9, 0.2);
  if (f.hp <= 0 || heavy) { f.set('down'); f.kb.set(dx / d * 6, dz / d * 6); f.vy = 4; f.y = 0.01; if (f === hero) S.playerDowns++; else PART.downs++; }
  else { f.set('hurt'); f.kb.set(dx / d * 3, dz / d * 3); }
  f.inv = 0.5;
}
const ATK = { // dur, hit time, range, half-cone (rad), dmg, heavy, lunge
  1: { dur: 0.36, hit: 0.3, range: 2.4, cone: 1.15, dmg: 2, heavy: false, pose: 'atk1', slash: 'side', roll: 0.18 },
  2: { dur: 0.36, hit: 0.3, range: 2.4, cone: 1.15, dmg: 2, heavy: false, pose: 'atk2', slash: 'side', roll: -0.18 },
  3: { dur: 0.6, hit: 0.42, range: 2.75, cone: Math.PI, dmg: 3, heavy: true, pose: 'atk3', slash: 'spin', roll: 0 },
};
function startAttack(n) {
  hero.set('atk'); hero.atkN = n; hero.queued = false; hero.hitDone = false; hero.hit2 = false;
  // soft lock: aim at the best target near the stick direction (or where we face)
  let dx = Math.sin(hero.yaw), dz = Math.cos(hero.yaw);
  if (IN.mx || IN.my) { const f = camFwd(CAM.yaw), r = [-f[1], f[0]]; dx = r[0] * IN.mx + f[0] * IN.my; dz = r[1] * IN.mx + f[1] * IN.my; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
  const t = pickTarget(dx, dz, 5.2); hero.atkT = t;
  hero.yaw = t ? Math.atan2(t.pos.x - hero.pos.x, t.pos.z - hero.pos.z) : Math.atan2(dx, dz);
  sfx('swing');
}
function resolveSwing(A, heavy360, f = hero, skip = null) {
  let any = false;
  for (const e of enemies) {
    if (!e.alive || (skip && skip(e))) continue; const dx = e.pos.x - f.pos.x, dz = e.pos.z - f.pos.z, d = Math.hypot(dx, dz);
    if (d > A.range + e.r * 0.5) continue; if (Math.abs(e.y - f.y) > 1.6) continue;
    const ang = Math.abs(angTo(f.yaw, Math.atan2(dx, dz))); if (!heavy360 && ang > A.cone) continue;
    if (hitEnemy(e, A.dmg, A.heavy, Math.atan2(dx, dz), f)) any = true;
  }
  return any;
}
function dust(x, y, z, n = 2) { for (let i = 0; i < n; i++) spawnSprite(FXT.puff, _v.set(x + rnd(-0.3, 0.3), y + 0.25, z + rnd(-0.3, 0.3)), rnd(0.5, 0.75), 0.4, { kind: 'grow', depth: true, vel: new THREE.Vector3(rnd(-1, 1), 0.8, rnd(-1, 1)) }); }

function updateHero(dt) {
  const h = hero; h.st += dt; h.at += dt; h.inv = Math.max(0, h.inv - dt);
  const f = camFwd(CAM.yaw), r = [-f[1], f[0]];
  const wx = r[0] * IN.mx + f[0] * IN.my, wz = r[1] * IN.mx + f[1] * IN.my, wl = Math.hypot(wx, wz);
  const atk = pressed('j', 'x', 'enter'), jump = pressed('k', ' ');
  const grounded = h.y <= 0.0001 && h.vy <= 0;
  let pose, rate = 16, snapTilt = false;
  const move = (spd, acc) => { h.vel.x = damp(h.vel.x, wx * spd, acc, dt); h.vel.y = damp(h.vel.y, wz * spd, acc, dt); };
  switch (h.state) {
    case 'idle': case 'move': {
      h.state = 'move'; move(6.6, 12);
      if (wl > 0.1) h.yaw += angTo(h.yaw, Math.atan2(wx, wz)) * (1 - Math.exp(-dt * 14));
      h.speed = Math.hypot(h.vel.x, h.vel.y);
      pose = h.speed > 0.6 ? HERO_POSES.run(h.at, h.speed) : HERO_POSES.idle(h.at);
      if (h.speed > 4 && Math.random() < dt * 5) dust(h.pos.x, h.pos.y, h.pos.z, 1);
      if (actHeld() && reviveTarget()) { h.set('revive'); h.rv = 0; h.vel.set(0, 0); break; }
      if (pressed('e', 'f') && tryAction()) break;
      if (atk) startAttack(1); else if (jump) { h.set('air'); h.vy = 8.2; sfx('jump'); dust(h.pos.x, h.pos.y, h.pos.z, 3); }
      break;
    }
    case 'atk': {
      const A = ATK[h.atkN], u = h.st / A.dur; h.speed = 0;
      if (pressed('e', 'f') && qteInRange()) { startFinisher(qteTarget()); pose = HERO_POSES.idle(0); break; }
      if (pressed('e', 'f') && POWER.cd <= 0 && inFight()) { startPower(); pose = HERO_POSES.idle(0); break; } // ACT cancels a cane combo into the POWER move
      // lunge: close the gap to the soft-locked target, else step forward
      const T = h.atkT; let lx = Math.sin(h.yaw), lz = Math.cos(h.yaw), lsp = u < 0.45 ? 2.2 : 0;
      if (T && T.alive) { const dx = T.pos.x - h.pos.x, dz = T.pos.z - h.pos.z, d = Math.hypot(dx, dz); h.yaw += angTo(h.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 20)); lsp = u < 0.45 ? clamp((d - 1.3) * 6, 0, 9) : 0; }
      h.vel.set(lx * lsp, lz * lsp);
      if (!h.hitDone && h.st >= A.hit * A.dur) {
        h.hitDone = true; const sp = _v.set(h.pos.x, h.pos.y + 0.95 + (h.atkN === 3 ? 0.25 : 0), h.pos.z);
        spawnSlash(sp, h.yaw + (h.atkN === 1 ? 0.25 : h.atkN === 2 ? -0.25 : 0), A.slash, A.roll, h.atkN === 2 ? -1 : 1);
        resolveSwing(A, h.atkN === 3);
      }
      if (h.atkN === 3 && !h.hit2 && h.st >= 0.62 * A.dur) { h.hit2 = true; resolveSwing(Object.assign({}, A, { dmg: 1, heavy: true }), true); }
      if (atk && u > 0.25) h.queued = true;
      if (u >= (h.atkN === 3 ? 1 : 0.78) && h.queued && h.atkN < 3) startAttack(h.atkN + 1);
      else if (u >= 1) { h.set('move'); h.at = 0; }
      pose = HERO_POSES[A.pose](Math.min(u, 1)); rate = 30; snapTilt = h.atkN === 3;
      if (jump && u > 0.6) { h.set('air'); h.vy = 8.2; sfx('jump'); }
      break;
    }
    case 'air': case 'airatk': {
      move(6.0, 4); h.vy -= 24 * dt; h.y += h.vy * dt;
      if (wl > 0.1 && h.state === 'air') h.yaw += angTo(h.yaw, Math.atan2(wx, wz)) * (1 - Math.exp(-dt * 8));
      if (h.state === 'air' && atk) { h.set('airatk'); h.vy = Math.max(h.vy, 3.5); const t = pickTarget(Math.sin(h.yaw), Math.cos(h.yaw), 5); if (t) h.yaw = Math.atan2(t.pos.x - h.pos.x, t.pos.z - h.pos.z); sfx('swing'); }
      if (h.state === 'airatk') { pose = HERO_POSES.airatk(h.st / 0.42); snapTilt = true; rate = 30; if (h.st > 0.25) h.vy = Math.min(h.vy, -10); }
      else pose = HERO_POSES.jump(h.vy);
      if (h.y <= 0) {
        h.y = 0; dust(h.pos.x, h.pos.y, h.pos.z, 3);
        if (h.state === 'airatk') { spawnSlash(_v.set(h.pos.x, h.pos.y + 0.4, h.pos.z), h.yaw, 'spin', 0); resolveSwing({ range: 2.6, cone: Math.PI, dmg: 3, heavy: true }, true); S.shake = Math.max(S.shake, 0.6); }
        h.vy = 0; h.set('move'); h.J.tilt.rotation.x = 0;
      }
      break;
    }
    case 'power': { // the ACT POWER move (06b): hop + flip, cane slam into the ground at 45%, recover
      h.vel.set(0, 0); const u = h.st / 0.9; h.speed = 0;
      if (u < 0.45) h.y = Math.sin(u / 0.45 * Math.PI) * 1.5 * (u < 0.3 ? 1 : 0.4 + 0.6 * (0.45 - u) / 0.15); else h.y = 0;
      if (!h.pw.hit && u >= 0.45) { h.pw.hit = true; h.y = 0; powerImpact(); }
      pose = HERO_POSES.airatk(clamp(u * 0.95, 0, 1)); snapTilt = true; rate = 30;
      if (u >= 1) { h.y = 0; h.set('move'); h.J.tilt.rotation.x = 0; }
      break;
    }
    case 'revive': { // hold ACT next to the downed partner
      h.vel.set(0, 0); const P = reviveTarget(); pose = HERO_POSES.revive(h.st); rate = 14;
      if (P) h.yaw += angTo(h.yaw, Math.atan2(P.pos.x - h.pos.x, P.pos.z - h.pos.z)) * (1 - Math.exp(-dt * 12));
      if (!P || !actHeld()) { h.rv = 0; h.set('move'); break; }
      h.rv += dt; if (h.rv >= REVIVE_T) { reviveTurtle(P, hero); h.set('move'); }
      break;
    }
    case 'ko': { // 0 HP: stays down until the partner revives (game over only if both turtles are down)
      h.vel.set(0, 0); pose = HERO_POSES.down(1, true); rate = 14; break;
    }
    case 'climb': case 'leap': case 'vault': case 'kick': case 'fin': case 'boost': {
      pose = cineHero(h, dt); rate = h.state === 'fin' ? 30 : 18; snapTilt = h.state === 'leap' || h.state === 'fin' || h.state === 'boost';
      applyPose(h.J, pose, rate, dt, snapTilt); h.sync(dt); return;
    }
    case 'hurt': { h.vel.set(h.kb.x, h.kb.y); h.kb.multiplyScalar(Math.exp(-dt * 7)); pose = HERO_POSES.hurt(clamp(h.st / 0.35, 0, 1)); rate = 22; if (h.st > 0.35) h.set('move'); break; }
    case 'down': {
      h.vel.set(h.kb.x, h.kb.y); h.kb.multiplyScalar(Math.exp(-dt * 3.5)); h.vy -= 22 * dt; h.y = Math.max(0, h.y + h.vy * dt);
      pose = HERO_POSES.down(h.st, h.y <= 0 && h.st > 0.2); rate = 14;
      if (h.hp <= 0 && h.st > 0.9 && h.y <= 0) { h.set('ko'); h.kb.set(0, 0); }
      else if (h.hp > 0 && h.st > 1.0) { h.set('getup'); h.inv = 1.0; }
      break;
    }
    case 'getup': { h.vel.set(0, 0); pose = HERO_POSES.getup(clamp(h.st / 0.45, 0, 1)); rate = 14; if (h.st > 0.45) h.set('move'); break; }
  }
  h.pos.x += h.vel.x * dt; h.pos.z += h.vel.y * dt; collide(h);
  applyPose(h.J, pose, rate, dt, snapTilt);
  // bandana tails trail behind
  for (const [i, t] of h.J.tails.entries()) { t.rotation.x = damp(t.rotation.x, 0.5 + clamp(h.speed / 6, 0, 1) * 0.9 + Math.sin(S.time * 12 + i) * 0.12, 10, dt); }
  h.sync(dt);
}
let ATTACKERS = 0;
function updateEnemy(e, dt) {
  e.st += dt; e.at += dt; e.cool = Math.max(0, e.cool - dt);
  // target: whichever turtle is nearer (sticky), as long as it is on the street and standing
  const T0 = enemyTarget(e), tg = T0 || hero; e.tgt = T0;
  const dx = tg.pos.x - e.pos.x, dz = tg.pos.z - e.pos.z, dP = Math.hypot(dx, dz);
  const toHeroYaw = Math.atan2(dx, dz), heroFromPost = Math.hypot(tg.pos.x - e.post.x, tg.pos.z - e.post.z), fromPost = Math.hypot(e.pos.x - e.post.x, e.pos.z - e.post.z);
  if (e.fin) { e.sync(dt); return; }
  const heroOk = !!T0;
  let pose, rate = 14, v = [0, 0];
  const SP = e.big ? 3.0 : 3.7, J = e.J;
  const face = (yaw, k = 10) => { e.yaw += angTo(e.yaw, yaw) * (1 - Math.exp(-dt * k)); };
  const walkTo = (x, z, sp) => { const ddx = x - e.pos.x, ddz = z - e.pos.z, d = Math.hypot(ddx, ddz); if (d < 0.15) return 0; const s = Math.min(sp, d * 4); v = [ddx / d * s, ddz / d * s]; face(Math.atan2(ddx, ddz)); return d; };
  switch (e.state) {
    case 'idle': {
      pose = THUG_POSES.idle(e.at, J); if (dP < 14) face(toHeroYaw, 3); else face(e.post.yaw, 2);
      if (heroOk && heroFromPost < 8) { e.set('chase'); if (!e.bang) e.bang = spawnSprite(FXT.bang, _v.set(e.pos.x, e.pos.y + 2.35 * e.scale, e.pos.z), 0.7, 0.8, { aspect: 0.5 }); }
      break;
    }
    case 'chase': {
      if (!heroOk || heroFromPost > 11.5 || fromPost > 9.5) { e.set('return'); break; }
      const canAtk = e.cool <= 0 && ATTACKERS < 2;
      if (canAtk && dP < (e.armed ? 1.9 : 1.65)) { e.set('windup'); ATTACKERS++; sfx('swing'); break; }
      // approach to striking range if we may attack, else hold a ring around the hero and circle
      if (canAtk) walkTo(tg.pos.x - dx / dP * 1.3, tg.pos.z - dz / dP * 1.3, SP);
      else { e.slot += dt * 0.35; const ring = 2.9, a = Math.atan2(-dx, -dz) * 0.6 + e.slot * 0.4; walkTo(tg.pos.x + Math.sin(a) * ring, tg.pos.z + Math.cos(a) * ring, SP * 0.6); face(toHeroYaw, 8); }
      const sp = Math.hypot(v[0], v[1]); pose = sp > 0.5 ? THUG_POSES.run(e.at, sp, J) : THUG_POSES.idle(e.at, J);
      break;
    }
    case 'windup': {
      face(toHeroYaw, 6); pose = THUG_POSES.windup(e.st, J); rate = 12;
      e.J.mat.userData.flashC.value.set('#ffd23c'); e.flash = Math.max(e.flash, 0.25 + 0.25 * Math.sin(e.st * 40));
      if (e.st > (e.big ? 0.7 : 0.5)) { e.set('attack'); e.J.mat.userData.flashC.value.set('#fff'); }
      break;
    }
    case 'attack': {
      pose = THUG_POSES.attack(e.st / 0.3, J); rate = 26; const lunge = e.st < 0.12 ? 4 : 0; v = [Math.sin(e.yaw) * lunge, Math.cos(e.yaw) * lunge];
      if (!e.hitDone && e.st > 0.1) { e.hitDone = true; const ang = Math.abs(angTo(e.yaw, toHeroYaw)); const reach = (e.armed ? 2.0 : 1.7) * e.scale;
        if (dP < reach && ang < 1.0 && tg.y < 0.9 && T0) hurtTurtle(tg, e.big ? 16 : e.armed ? 11 : 8, e.pos.x, e.pos.z, e.big); }
      if (e.st > 0.55) { e.hitDone = false; e.set('chase'); e.cool = rnd(1.1, 2.0) + (e.big ? 0.6 : 0); ATTACKERS = Math.max(0, ATTACKERS - 1); }
      break;
    }
    case 'drown': { // in the harbour: flail, sink, KO (06b startDrown)
      v = [0, 0]; const u = clamp(e.st / 1.2, 0, 1); e.pos.y = lerp(CURB, WY - 2.8, u * u); e.y = 0; pose = THUG_POSES.hurt(0.6 + Math.sin(e.st * 18) * 0.3, J); rate = 20;
      e.J.tilt.rotation.z = Math.sin(e.st * 9) * 0.4 * (1 - u);
      if (e.st > 0.35 && Math.random() < dt * 10) spawnSprite(SPLASH_T, _v.set(e.pos.x + rnd(-0.5, 0.5), WY + 0.2, e.pos.z + rnd(-0.5, 0.5)), rnd(0.35, 0.6), 0.5, { kind: 'grow', depth: true, vel: new THREE.Vector3(0, 1.2, 0) });
      if (e.st > 1.2) drownKO(e);
      e.sync(dt); e.hpS.visible = false; e.dz.visible = false; return;
    }
    case 'dizzy': { // staggering, stars over the head; recovers if the QTE window passes
      v = [e.kb.x, e.kb.y]; e.kb.multiplyScalar(Math.exp(-dt * 6)); pose = THUG_POSES.dizzy(e.st, J); rate = 10;
      if (e.st > DIZZY_T) { e.set('chase'); e.cool = 0.6; }
      break;
    }
    case 'hurt': { v = [e.kb.x, e.kb.y]; e.kb.multiplyScalar(Math.exp(-dt * 7)); pose = THUG_POSES.hurt(clamp(e.st / 0.32, 0, 1), J); rate = 24; if (e.st > 0.34) { e.set('chase'); e.cool = Math.min(e.cool, 0.25); } break; }
    case 'down': {
      v = [e.kb.x, e.kb.y]; e.kb.multiplyScalar(Math.exp(-dt * 3.2)); e.vy -= 22 * dt; e.y = Math.max(0, e.y + e.vy * dt);
      const grounded = e.y <= 0 && e.st > 0.15; pose = THUG_POSES.down(e.st, grounded); rate = 13;
      if (grounded && !e.landed) { e.landed = true; dust(e.pos.x, e.pos.y, e.pos.z, 3); S.shake = Math.max(S.shake, 0.3); }
      if (e.dead && e.st > 1.0) { e.set('dying'); }
      else if (!e.dead && e.st > 1.25) { e.set('getup'); e.landed = false; }
      break;
    }
    case 'getup': { pose = THUG_POSES.getup(clamp(e.st / 0.5, 0, 1), J); if (e.st > 0.5) { if (dP < 2 && ATTACKERS < 2 && heroOk) { e.set('windup'); ATTACKERS++; } else { e.set('chase'); e.cool = 0.3; } } break; }
    case 'dying': {
      pose = THUG_POSES.down(1, true); e.flash = e.st % 0.16 < 0.08 ? 1 : 0;
      if (e.st > 0.7) {
        for (let k = 0; k < 6; k++) spawnSprite(FXT.puff, _v.set(e.pos.x + rnd(-0.6, 0.6), e.pos.y + 0.3, e.pos.z + rnd(-0.6, 0.6)), rnd(0.8, 1.3), 0.5, { kind: 'grow', depth: true, vel: new THREE.Vector3(rnd(-2, 2), 1.5, rnd(-2, 2)) });
        spawnSprite(FXT.star, _v.set(e.pos.x, e.pos.y + 0.6, e.pos.z), 1.4, 0.3);
        e.set('dead'); e.root.visible = false; e.hpS.visible = false; S.kills++; sfx('ko'); if (e.lastBy === partner) PART.kos++; else PART.heroKos++; e.respawn = 14; e.landed = false; $('kon').textContent = S.kills;
      }
      break;
    }
    case 'dead': {
      e.respawn -= dt; const far = Math.hypot(hero.pos.x - e.post.x, hero.pos.z - e.post.z) > 12;
      if (e.respawn <= 0 && far) { e.hp = e.maxHp; e.dead = false; e.pos.set(e.post.x, 0, e.post.z); e.yaw = e.post.yaw; e.root.visible = true; e.set('idle'); e.y = 0; e.J.tilt.rotation.set(0, 0, 0); e.bang = null;
        for (let k = 0; k < 4; k++) spawnSprite(FXT.puff, _v.set(e.pos.x + rnd(-0.5, 0.5), 0.4, e.pos.z + rnd(-0.5, 0.5)), 1, 0.45, { kind: 'grow', depth: true }); }
      return;
    }
    case 'return': {
      const d = walkTo(e.post.x, e.post.z, SP * 0.8); pose = d > 0.2 ? THUG_POSES.run(e.at, SP * 0.8, J) : THUG_POSES.idle(e.at, J);
      if (d < 0.3) e.set('idle'); if (heroOk && heroFromPost < 7) e.set('chase');
      break;
    }
  }
  if (!pose) pose = THUG_POSES.idle(e.at, J); // a state changed this frame: hold the stance for one frame
  e.pos.x += v[0] * dt; e.pos.z += v[1] * dt; collide(e);
  applyPose(J, pose, rate, dt, false);
  e.sync(dt);
  // hp pip
  e.hpShow -= dt; e.hpS.visible = e.hpShow > 0 && e.alive && e.hp > 0 && e.state !== 'dying' && e.state !== 'down' && e.state !== 'dizzy' && !e.fin;
  if (e.hpS.visible) e.hpS.position.set(e.pos.x, e.pos.y + 2.25 * e.scale + 0.1, e.pos.z);
  e.dz.visible = e.state === 'dizzy'; if (e.dz.visible) { e.dz.position.set(e.pos.x, e.pos.y + 2.2 * e.scale + 0.15, e.pos.z); e.dz.material.rotation = Math.sin(e.st * 6) * 0.25; }
  if (e.bang && e.bang.s.visible) e.bang.s.position.set(e.pos.x, e.pos.y + 2.35 * e.scale + Math.sin(e.st * 20) * 0.03, e.pos.z); else e.bang = e.bang && e.bang.s.visible ? e.bang : (e.state === 'idle' ? null : e.bang);
}
// windup/attack tokens are counted fresh every frame (robust against interrupted attacks)
function countAttackers() { ATTACKERS = enemies.filter((e) => e.state === 'windup' || e.state === 'attack').length; }
function turtleOk(f) { return f.hp > 0 && !f.roof && !CINE.intro && (f === hero ? f.state !== 'down' && f.state !== 'ko' && f.state !== 'climb' && f.state !== 'leap' && f.state !== 'boost' : PART_FIGHT.has(f.state)); }
function enemyTarget(e) {
  const a = turtleOk(hero) ? hero : null, b = turtleOk(partner) ? partner : null; if (!a || !b) return a || b;
  const da = Math.hypot(hero.pos.x - e.pos.x, hero.pos.z - e.pos.z), db = Math.hypot(partner.pos.x - e.pos.x, partner.pos.z - e.pos.z);
  if (e.tgt === partner) return db < da + 1.5 ? partner : hero; return da < db + 1.5 ? hero : partner;
}

// ---------------- HUD ----------------
let hpShown = 100, p2Shown = 100, p2Down = false;
function hud(dt) {
  const pct = hero.hp / hero.maxHp * 100;
  if (Math.abs(pct - hpShown) > 0.1) { hpShown = pct; $('hpfill').style.width = pct + '%'; $('hplag').style.width = pct + '%'; }
  const pp = Math.round(partner.hp / partner.maxHp * 100); if (pp !== p2Shown) { p2Shown = pp; $('p2fill').style.width = pp + '%'; }
  const pd = partner.state === 'ko' || partner.hp <= 0; if (pd !== p2Down) { p2Down = pd; $('p2').classList.toggle('dn', pd); }
  S.comboT -= dt; if (S.comboT <= 0 && S.combo) S.combo = 0;
  const cb = $('combo'); if (S.combo >= 2) { cb.classList.add('on'); $('comboN').textContent = S.combo; } else cb.classList.remove('on');
}
let bannerT = 0;
function banner(txt = 'BACK ON YOUR FEET!', t = 1.6) { $('banner').textContent = txt; $('banner').classList.add('on'); bannerT = t; }
if (Q.has('nointro')) setTimeout(() => { const h = $('hint'); if (h) h.style.opacity = '0'; }, 9000);
// prototype nav: open on wide screens, collapsed on phones
{ const p = $('proto'); $('protoT').addEventListener('click', () => p.classList.toggle('open')); }
