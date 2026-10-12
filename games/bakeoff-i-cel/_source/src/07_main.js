
// ---------------- autopilot for tests (?bot=1): walk all four corners, fight every thug met, orbit the camera mid-fight ----------------
const CORNER_PTS = [['SE', 9.3, 9.3], ['E', 24, 0], ['NE', 9.3, -9.3], ['N', 0, -24], ['NW', -9.3, -9.3], ['W', -24, 0], ['SW', -9.3, 9.3], ['S', 0, 20]];
const BOTR = { i: 0, log: [], corners: [], t: 0, orbitT: 0, atkT: 0, done: false, fightT: 0, fights: 0, yaws: [] };
function botThink(dt) {
  BOTR.t += dt; const b = (IN.bot = IN.bot || { mx: 0, my: 0, look: 0 });
  b.look = 0;
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
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const FPS = { v: 60, n: 0, t: 0 };
let last = performance.now(), frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  try {
    let rdt = Math.min(0.05, (now - last) / 1000); last = now; frames++;
    FPS.n++; FPS.t += rdt; if (FPS.t > 1) { FPS.v = Math.round(FPS.n / FPS.t); FPS.n = 0; FPS.t = 0; }
    if (window.__cel && __cel.pause) { renderer.render(scene, camera); return; }
    if (BOT) botThink(rdt);
    readInput();
    if (POSE) { poseView(rdt); renderer.render(scene, camera); return; }
    // ?sim=N runs N fixed 1/60 s steps per rendered frame (headless tests on a slow software GPU)
    const steps = SIM ? SIM : 1;
    for (let k = 0; k < steps; k++) {
      if (SIM) rdt = 1 / 60;
      if (BOT && k > 0) botThink(rdt);
      if (k > 0) readInput();
      let dt = rdt; if (S.hitstop > 0) { S.hitstop -= rdt; dt = rdt * 0.06; }
      S.time += dt;
      countAttackers();
      updateHero(dt);
      for (const e of enemies) updateEnemy(e, dt);
      separate();
      if (k < steps - 1) { updateSprites(rdt); updateSlashes(rdt); PRESS.clear(); updateCamera(dt, rdt); }
    }
    const dt = rdt;
    // soft lock target (for the ring + camera framing)
    let dx = Math.sin(hero.yaw), dz = Math.cos(hero.yaw);
    if (IN.mx || IN.my) { const f = camFwd(CAM.yaw), r = [-f[1], f[0]]; dx = r[0] * IN.mx + f[0] * IN.my; dz = r[1] * IN.mx + f[1] * IN.my; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    const cand = pickTarget(dx, dz, 6.5);
    lockT = cand && cand.state !== 'idle' && cand.state !== 'return' ? cand : (lockT && lockT.alive && lockT.state !== 'dying' && Math.hypot(lockT.pos.x - hero.pos.x, lockT.pos.z - hero.pos.z) < 8 && lockT.state !== 'return' ? lockT : null);
    lockRing.visible = !!lockT;
    if (lockT) { lockRing.position.set(lockT.pos.x, lockT.pos.y + 0.03, lockT.pos.z); lockRing.scale.setScalar(lockT.scale); lockRing.userData.b.rotation.z += rdt * 3; }
    updateCamera(dt, rdt);
    // sun + shadow camera follow the hero (snapped to shadow texels to stop shimmering)
    const tx = SHR * 2 / SHM, sx = Math.round(hero.pos.x / tx) * tx, sz = Math.round(hero.pos.z / tx) * tx;
    sun.target.position.set(sx, 0, sz); sun.position.set(sx + SUN_DIR.x * 70, SUN_DIR.y * 70, sz + SUN_DIR.z * 70);
    window.__sky.position.copy(camera.position);
    updateSprites(rdt); updateSlashes(rdt); hud(rdt);
    if (bannerT > 0) { bannerT -= rdt; if (bannerT <= 0) $('banner').classList.remove('on'); }
    PRESS.clear();
    renderer.render(scene, camera);
  } catch (err) { __celErr.n++; __celErr.last = String(err && err.stack || err); if (__celErr.n < 4) console.error(err); }
}
requestAnimationFrame(frame);
window.__cel = { S, hero, enemies, CAM, BOTR, FPS, IN, renderer, get frames() { return frames; }, atlasRows: _ay + _arow, THREE, camera, scene };
