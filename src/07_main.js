
// ---------------- autopilot for tests (?bot=1): walk up the street and back, fight every thug met, orbit the camera mid-fight ----------------
const CORNER_PTS = [['HARBORPLACE', -40, -33], ['CONSTELLATION', -31, -33], ['WTC', -12, -33], ['AQUARIUM', 19, -33], ['POWERPLANT', 56, -33], ['PRATT', 70, -38.5], ['FOURSEASONS', 82, -41.5]]; // east along the promenade past 6 landmarks
function near0() { let n = 0; for (const e of enemies) if (e.alive && e.state !== 'dying' && e.state !== 'idle' && e.state !== 'return' && Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z) < 4) n++; return n; }
const BOTR = { i: 0, log: [], corners: [], t: 0, orbitT: 0, atkT: 0, done: false, fightT: 0, fights: 0, yaws: [] };
function botThink(dt) {
  BOTR.t += dt; const b = (IN.bot = IN.bot || { mx: 0, my: 0, look: 0 });
  b.look = 0; if (CINE.intro || CINE_ST.has(hero.state) || hero.state === 'ko' || PART.over) { b.mx = b.my = 0; b.actHold = false; return; }
  // the partner is down: run over and hold ACT on it
  if (partner.state === 'ko') { const d = Math.hypot(partner.pos.x - hero.pos.x, partner.pos.z - hero.pos.z);
    if (d < 1.5 || hero.state === 'revive') { b.mx = b.my = 0; b.actHold = true; return; }
    b.actHold = false; const f = camFwd(CAM.yaw), r = [-f[1], f[0]], dx = partner.pos.x - hero.pos.x, dz = partner.pos.z - hero.pos.z; b.mx = (dx * r[0] + dz * r[1]) / d; b.my = (dx * f[0] + dz * f[1]) / d; BOTR.revRuns = (BOTR.revRuns || 0) + 1; return; }
  b.actHold = false;
  // QTE: a dizzy thug in reach -> press the action button (after a human-ish reaction delay) instead of swinging
  if (near0() >= 2 && POWER.cd <= 0 && hero.state === 'move' && !qteInRange()) { b.act = true; BOTR.power = (BOTR.power || 0) + 1; }
  if (QTE && qteInRange()) { b.mx = b.my = 0; BOTR.qteT = (BOTR.qteT || 0) + dt; if (BOTR.qteT > 0.2) { b.act = true; BOTR.qteT = 0; BOTR.qtePressed = (BOTR.qtePressed || 0) + 1; } return; } else BOTR.qteT = 0;
  const near = enemies.filter((e) => e.alive && e.state !== 'dying' && e.state !== 'return' && e.state !== 'idle' && Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z) < 9);
  let tx, tz, stopAt = 0.8;
  if (near.length) {
    near.sort((a, c) => Math.hypot(a.pos.x - hero.pos.x, a.pos.z - hero.pos.z) - Math.hypot(c.pos.x - hero.pos.x, c.pos.z - hero.pos.z));
    const e = near[0]; tx = e.pos.x; tz = e.pos.z; stopAt = 1.6; BOTR.fightT += dt;
    // orbit the camera during fights so we fight from several angles
    BOTR.orbitT += dt; if (BOTR.orbitT % 4 < 0.6) b.look = 1;
    const d = Math.hypot(tx - hero.pos.x, tz - hero.pos.z);
    if (d < 2.4) { BOTR.atkT -= dt; if (BOTR.atkT <= 0) { if (Math.random() < 0.12 && hero.state === 'move') b.jump = true, BOTR.airPend = 0.2; else b.atk = true; BOTR.atkT = 0.11; } }
    if (BOTR.airPend !== undefined) { BOTR.airPend -= dt; if (BOTR.airPend <= 0) { b.atk = true; BOTR.airPend = undefined; } }
    BOTR.yaws.push(+CAM.yaw.toFixed(2));
  } else {
    if (BOTR.i >= CORNER_PTS.length) { BOTR.done = true; b.mx = b.my = 0; return; }
    const [name, x, z] = CORNER_PTS[BOTR.i]; tx = x; tz = z;
    if (Math.hypot(x - hero.pos.x, z - hero.pos.z) < 1.0) { BOTR.corners.push(name); BOTR.log.push(name + '@' + S.time.toFixed(1)); BOTR.i++; }
  }
  const dx = tx - hero.pos.x, dz = tz - hero.pos.z, d = Math.hypot(dx, dz);
  if (d < stopAt) { b.mx = b.my = 0; return; }
  const f = camFwd(CAM.yaw), r = [-f[1], f[0]];
  b.mx = (dx * r[0] + dz * r[1]) / d; b.my = (dx * f[0] + dz * f[1]) / d;
}

// ---------------- pose sheet (?pose=1): every animation frozen side by side, for checking the rigs ----------------
const SIM = +(Q.get('sim') || 0), POSE = Q.has('pose');
let poseRigs = null;
function poseView(dt) {
  if (!poseRigs) {
    hero.root.visible = false; enemies.forEach((e) => (e.root.visible = false));
    const H = [['idle', 0.3], ['run', 0.2], ['atk1', 0.1], ['atk1', 0.6], ['atk2', 0.6], ['atk3', 0.45], ['jump', 0], ['airatk', 0.35], ['hurt', 0.2], ['down', 1]];
    const Tq = [['idle', 0], ['run', 0.3], ['windup', 0], ['attack', 0.5], ['hurt', 0.2], ['down', 1]];
    poseRigs = [];
    H.forEach(([n, u], i) => { const J = buildHero(); scene.add(J.root); J.root.position.set(-9 + i * 2, 0, 0); J.root.rotation.y = Q.get('pose') === 'b' ? Math.PI : 0.5; poseRigs.push([J, () => (n === 'idle' ? HERO_POSES.idle(0.3) : n === 'run' ? HERO_POSES.run(u, 6) : n === 'jump' ? HERO_POSES.jump(1) : n === 'down' ? HERO_POSES.down(1, true) : HERO_POSES[n](u))]); });
    Tq.forEach(([n, u], i) => { const look = THUG_LOOKS[i % 5]; const J = buildThug(look); scene.add(J.root); J.root.position.set(-6 + i * 2.4, 0, -4); J.root.rotation.y = 0.5; if (look.big) J.root.scale.setScalar(1.2);
      poseRigs.push([J, () => (n === 'idle' ? THUG_POSES.idle(0, J) : n === 'run' ? THUG_POSES.run(u, 4, J) : n === 'down' ? THUG_POSES.down(1, true) : THUG_POSES[n](u, J))]); });
  }
  for (const [J, f] of poseRigs) applyPose(J, f(), 60, 1, true);
  const pv = Q.get('pv') || 'h'; if (pv === 'h') { camera.position.set(-3.5, 1.6, 4.2); camera.lookAt(-3.5, 0.9, 0); } else if (pv === 'h2') { camera.position.set(4.5, 1.6, 4.2); camera.lookAt(4.5, 0.9, 0); } else { camera.position.set(0, 1.8, 2.6); camera.lookAt(0, 1.0, -4); }
}

// ---------------- main loop ----------------
function gateInput() { if (CINE.intro) { IN.mx = IN.my = 0; PRESS.clear(); } }
function camStep(dt, rdt) {
  if (CINE.intro) { updateCamera(dt, rdt); introCamera(rdt); }
  else if (cineCamActive()) cineCamera(rdt);
  else updateCamera(dt, rdt);
}
if (!Q.has('nointro') && !POSE) { CINE.intro = { t: 0, dur: 5.2 }; $('title').classList.add('on'); $('hint').style.opacity = '0'; }
function resize() { // low-res target: LINES (240) on the short side, the long side follows the screen's aspect (portrait keeps its aspect too)
  const w = VW(), h = VH(), a = w / h; let lw, lh;
  if (QUAL.hd) { const dpr = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 1.25); lw = Math.round(w * dpr); lh = Math.round(h * dpr); }
  else if (a >= 1) { lh = LINES; lw = Math.round(LINES * a); } else { lw = LINES; lh = Math.round(LINES / a); }
  LOW.w = lw; LOW.h = lh; renderer.setSize(lw, lh, false); RT.setSize(lw, lh); POST.uniforms.uRes.value.set(lw, lh); SNAP.value.set(lw / 2, lh / 2);
  camera.aspect = a; camera.updateProjectionMatrix();
}
function setHD(on) { // the quality toggle: everything but the day/night cycle and the game
  applyQuality(on);
  sun.shadow.mapSize.set(on ? 2048 : SHM, on ? 2048 : SHM); renderer.shadowMap.type = on ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap; if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  scene.traverse((o) => { if (o.material && o.material.isMeshLambertMaterial) o.material.needsUpdate = true; });
  const b = $('qbtn'); if (b) b.textContent = on ? 'HD' : '32-BIT'; resize();
}
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'h' && !e.repeat) setHD(!QUAL.hd); });
{ const b = $('qbtn'); if (b) b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); setHD(!QUAL.hd); }); }
addEventListener('resize', resize); setHD(QUAL.hd);

// ---------------- day / night: a continuous loop (default 600 s): 5 min day -> night, 5 min night -> day. ?tod=0..1 pins it (0 day, .25 dusk, .5 night), ?cycle=N sets the loop length ----------------
const CYC = { len: clamp(+(Q.get('cycle') || 600), 4, 7200), pin: Q.has('tod') ? clamp(+Q.get('tod'), 0, 1) : null, t: 0, tod: 0, n: 0, lamps: 0 };
const FILL = new THREE.PointLight('#c8d0ff', 0, 12, 1.2); scene.add(FILL);
const _ck = (a) => a.map((c) => new THREE.Color(c));
const PALK = { // day, dusk, night
  top: _ck(['#4a86c8', '#34386e', '#03050b']), mid: _ck(['#9cc4dc', '#b0706a', '#0a0f1a']), hor: _ck(['#d8dccf', '#f08850', '#141a26']),
  fog: _ck(['#b4c0c6', '#8a6060', '#0b0f17']), hs: _ck(['#dfe6ff', '#ffb08a', '#4a5a88']), hg: _ck(['#8a7f74', '#5a4040', '#14141c']),
  sun: _ck(['#fff3dc', '#ff9a58', '#8aa0e8']), cloud: _ck(['#ffffff', '#ffb0a0', '#20242e']),
};
const DIRK = [new THREE.Vector3(-0.5, 1.7, 0.42).normalize(), new THREE.Vector3(-1, 0.32, -0.25).normalize(), new THREE.Vector3(0.45, 1.2, -0.9).normalize()];
const _cc = new THREE.Color(), _dir = new THREE.Vector3();
const k3 = (n) => (n < 0.5 ? [0, n * 2] : [1, n * 2 - 1]);
function col3(arr, n, out) { const [i, t] = k3(n); return out.copy(arr[i]).lerp(arr[i + 1], t); }
const num3 = (a, b, c, n) => { const [i, t] = k3(n); return i ? lerp(b, c, t) : lerp(a, b, t); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function updateCycle(dt) {
  CYC.t += dt; CYC.tod = CYC.pin !== null ? CYC.pin : (CYC.t / CYC.len) % 1;
  const n = CYC.n = 0.5 - 0.5 * Math.cos(CYC.tod * TAU); // 0 day .. 1 night
  col3(PALK.top, n, SKY.U.top.value); col3(PALK.mid, n, SKY.U.mid.value); col3(PALK.hor, n, SKY.U.hor.value); SKY.U.uStars.value = sstep(0.62, 0.92, n);
  col3(PALK.fog, n, scene.fog.color); FOGC.copy(scene.fog.color); OUT_U.fogC.value.copy(scene.fog.color); OUT_U.fogN.value = scene.fog.near; OUT_U.fogF.value = scene.fog.far; renderer.setClearColor(scene.fog.color); scene.fog.near = num3(40, 30, 16, n); scene.fog.far = num3(150, 125, 85, n);
  col3(PALK.hs, n, hemi.color); col3(PALK.hg, n, hemi.groundColor); hemi.intensity = num3(1.45, 0.85, 0.32, n);
  col3(PALK.sun, n, sun.color); sun.intensity = num3(2.1, 1.25, 0.45, n);
  const [i, t] = k3(n); _dir.copy(DIRK[i]).lerp(DIRK[i + 1], t).normalize(); SUN_DIR.copy(_dir);
  SKY.sunS.position.copy(i ? DIRK[1] : _dir).multiplyScalar(70); SKY.sunS.material.opacity = 1 - sstep(0.45, 0.65, n);
  SKY.moonS.position.copy(DIRK[2]).multiplyScalar(70); SKY.moonS.material.opacity = sstep(0.5, 0.8, n);
  col3(PALK.cloud, n, _cc); for (const c of SKY.clouds) c.material.color.copy(_cc);
  // night: windows light up, street lamps switch on (orange glow pools + halos + point lights), the BINGO neon buzzes on
  NIGHT.value = sstep(0.32, 0.62, n);
  const on = CYC.lamps = sstep(0.38, 0.56, n);
  NIGHTFX.pools.forEach((q, k) => { q.material.opacity = on * 0.8; q.visible = on > 0.01; });
  NIGHTFX.halos.forEach((h) => { h.material.opacity = on; h.visible = on > 0.01; });
  NIGHTFX.lights.forEach((l) => { l.intensity = on * 16; });
  FILL.intensity = on * 3.2; FILL.position.copy(camera.position); FILL.position.y += 1.2; // a soft camera-side fill so the old folks read at night
  const fl = on > 0.5 && Math.sin(CYC.t * 23) > 0.93 ? 0.55 : 1; // the odd neon flicker
  const mins = Math.floor(((12 + CYC.tod * 24) % 24) * 60 / 10) * 10; if (mins !== CYC.mins) { CYC.mins = mins; const h = Math.floor(mins / 60), m = mins % 60;
    $('clock').textContent = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; }
  NIGHTFX.neon.tint(on, on > 0.01 ? fl : 1); NIGHTFX.neon.light.intensity = on * 14 * fl;
}
// ---------------- city HUD: landmark name popup + minimap (the harbour, landmark dots, the heroes, thugs nearby) ----------------
const CITY = { lmk: null, lmkT: 0, nearT: 0, mapT: 0, visited: new Set(), log: [] };
const MAP = (function () {
  const c = $('mmap'); if (!c) return null; const W = 150, H = 92, k = W / (WB.x1 - WB.x0 + 20);
  c.width = W * 2; c.height = H * 2; const g = c.getContext('2d'); const bg = document.createElement('canvas'); bg.width = c.width; bg.height = c.height; const b = bg.getContext('2d');
  const X = (x) => (x - WB.x0 + 10) * k * 2, Z = (z) => (z - WB.z0 + 6) * k * 2;
  b.fillStyle = '#3a3a40'; b.fillRect(0, 0, bg.width, bg.height);
  b.fillStyle = '#6a665e'; for (const p of PLOTS) b.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * k * 2, (p.z1 - p.z0) * k * 2);
  b.fillStyle = '#2f6f96'; b.fillRect(X(BASIN.x0), Z(BASIN.z0), (BASIN.x1 - BASIN.x0) * k * 2, (BASIN.z1 - BASIN.z0) * k * 2);
  b.fillStyle = '#a8705a'; for (const p of PIERS) b.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * k * 2, (p.z1 - p.z0) * k * 2);
  b.fillStyle = '#ffe08a'; for (const L of LANDMARKS) { b.beginPath(); b.arc(X(L.x), Z(L.z), 3.2, 0, TAU); b.fill(); }
  return { c, g, bg, X, Z };
})();
function cityHud(rdt) {
  CITY.nearT -= rdt; if (CITY.nearT <= 0) { CITY.nearT = 0.25; NIGHTFX.near(hero.pos.x, hero.pos.z); rigLod();
    let best = null, bd = 1e9; for (const L of LANDMARKS) { const d = Math.hypot(L.x - hero.pos.x, L.z - hero.pos.z); if (d < L.r && d < bd) { bd = d; best = L; } }
    if (best !== CITY.lmk) { CITY.lmk = best; if (best) { $('lmk').textContent = best.name; $('lmk').classList.add('on'); CITY.lmkT = BARK.lmBlurb(best) || 3.2; if (!CITY.visited.has(best.id)) { CITY.visited.add(best.id); CITY.log.push(best.id + '@' + S.time.toFixed(1)); } } } }
  if (APANEL) { const c = actContext(); APANEL.setAct(c, c && c.kind === 'power' ? 1 - POWER.cd / POWER.CD : 1); }
  if (CITY.lmkT > 0) { CITY.lmkT -= rdt; if (CITY.lmkT <= 0) { $('lmk').classList.remove('on'); BARK.lmBlurb(null); } }
  if (MAP) { CITY.mapT -= rdt; if (CITY.mapT <= 0) { CITY.mapT = 0.1; const { g, bg, X, Z } = MAP; g.drawImage(bg, 0, 0);
    g.fillStyle = '#ff3d6e'; for (const e of enemies) if (e.alive && e.state !== 'dying' && Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z) < 60) g.fillRect(X(e.pos.x) - 2, Z(e.pos.z) - 2, 4, 4);
    g.fillStyle = '#ff9ad0'; g.beginPath(); g.arc(X(partner.pos.x), Z(partner.pos.z), 3, 0, TAU); g.fill();
    const hx = X(hero.pos.x), hz = Z(hero.pos.z), a = hero.yaw; g.fillStyle = '#9dff6b'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath();
    g.moveTo(hx + Math.sin(a) * 9, hz + Math.cos(a) * 9); g.lineTo(hx + Math.sin(a + 2.5) * 6, hz + Math.cos(a + 2.5) * 6); g.lineTo(hx + Math.sin(a - 2.5) * 6, hz + Math.cos(a - 2.5) * 6); g.closePath(); g.fill(); g.stroke(); } }
}
const FPS = { v: 60, n: 0, t: 0 };
let last = performance.now(), frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  try {
    let rdt = Math.min(0.05, (now - last) / 1000); last = now; frames++;
    FPS.n++; FPS.t += rdt; if (FPS.t > 1) { FPS.v = Math.round(FPS.n / FPS.t); FPS.n = 0; FPS.t = 0; }
    if (FMAP.F.open) { FMAP.frame(rdt); return; } // full-screen map open: the game is paused (no sim, no 3D draw; the canvas keeps its last frame)
    if (window.__cel && __cel.pause) { draw(); return; }
    if (BOT) botThink(rdt);
    readInput(); gateInput();
    if (POSE) { poseView(rdt); updateCycle(rdt); draw(); return; }
    // ?sim=N runs N fixed 1/60 s steps per rendered frame (headless tests on a slow software GPU)
    const steps = SIM ? SIM : 1;
    for (let k = 0; k < steps; k++) {
      if (SIM) rdt = 1 / 60;
      if (BOT && k > 0) botThink(rdt);
      if (k > 0) { readInput(); gateInput(); }
      let dt = rdt; if (S.hitstop > 0) { S.hitstop -= rdt; dt = rdt * 0.06; }
      S.time += dt;
      countAttackers();
      POWER.cd = Math.max(0, POWER.cd - dt);
      updateHero(dt);
      updatePartner(dt);
      for (const e of enemies) { // thugs far from the heroes sleep (hidden, not simulated) to keep draw calls + CPU down on phones
        const d2 = (e.pos.x - hero.pos.x) ** 2 + (e.pos.z - hero.pos.z) ** 2;
        if (d2 > 48 * 48 && (e.state === 'idle' || e.state === 'return')) { e.root.visible = false; e.hpS.visible = false; continue; }
        if (!e.root.visible && e.state !== 'dead') e.root.visible = true;
        updateEnemy(e, dt); }
      separate();
      if (k < steps - 1) { updateSprites(rdt); updateSlashes(rdt); PRESS.clear(); camStep(dt, rdt); }
    }
    const dt = rdt;
    // soft lock target (for the ring + camera framing)
    let dx = Math.sin(hero.yaw), dz = Math.cos(hero.yaw);
    if (IN.mx || IN.my) { const f = camFwd(CAM.yaw), r = [-f[1], f[0]]; dx = r[0] * IN.mx + f[0] * IN.my; dz = r[1] * IN.mx + f[1] * IN.my; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    const cand = pickTarget(dx, dz, 6.5);
    lockT = CINE_ST.has(hero.state) || hero.roof ? null : cand && cand.state !== 'idle' && cand.state !== 'return' ? cand : (lockT && lockT.alive && lockT.state !== 'dying' && Math.hypot(lockT.pos.x - hero.pos.x, lockT.pos.z - hero.pos.z) < 8 && lockT.state !== 'return' ? lockT : null);
    lockRing.visible = !!lockT;
    if (lockT) { lockRing.position.set(lockT.pos.x, lockT.pos.y + 0.03, lockT.pos.z); lockRing.scale.setScalar(lockT.scale); lockRing.userData.b.rotation.z += rdt * 3; }
    camStep(dt, rdt);
    // sun + shadow camera follow the hero (snapped to shadow texels to stop shimmering)
    const tx = SHR * 2 / SHM, sx = Math.round(hero.pos.x / tx) * tx, sz = Math.round(hero.pos.z / tx) * tx;
    sun.target.position.set(sx, 0, sz); sun.position.set(sx + SUN_DIR.x * 70, SUN_DIR.y * 70, sz + SUN_DIR.z * 70);
    window.__sky.position.copy(camera.position);
    updateSprites(rdt); updateSlashes(rdt); hud(rdt);
    if (bannerT > 0) { bannerT -= rdt; if (bannerT <= 0) $('banner').classList.remove('on'); }
    cineUpdate(rdt);
    updateCycle(SIM ? rdt * SIM : rdt);
    cityHud(rdt);
    BARK.tick(rdt);
    PRESS.clear();
    draw();
  } catch (err) { __celErr.n++; __celErr.last = String(err && err.stack || err); if (__celErr.n < 4) console.error(err); }
}
requestAnimationFrame(frame);
window.__cel = { S, hero, partner, PART, BOOST_P, hurtTurtle, reviveTurtle, partnerSlot, get KEYS() { return KEYS; }, enemies, CAM, BOTR, FPS, IN, renderer, CINE, ACTIONS, DOOR, PIZZA, LADDER, ROOF, get QTE() { return QTE; }, get lockT() { return lockT; }, press: (k) => PRESS.add(k), tryAction, get frames() { return frames; }, atlasRows: _ay + _arow, THREE, camera, scene, CYC, LOW, NIGHTFX, draw, QUAL, setHD, LANDMARKS, CITY, POWER, WATERK, startDrown, actContext, APANEL, MANHOLES, CLIMBS, VEHICLES, RIDE, isWater, groundY, WB, COLL, BLD, PIERS, POSTS, CARS, WATER };
