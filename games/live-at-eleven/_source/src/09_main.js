
// ---------------- autopilot for tests (?bot=1): sag the ratings until the police come, outrun them, then fight the gang on camera.
// It deliberately lets the camera-shy thug reach the crew, throws a few punches while the feed is down (off-camera), then helps the crew up.
const BOTR = { phase: 'wait', t: 0, atkT: 0, airPend: undefined, log: [], done: false, fleeT: 0, wp: null, offT: 0, fightT: 0, stuck: 0, lastPos: [0, 0] };
const FLEE_WP = [[0, 36], [0, 18], [0, 0], [0, -18], [0, -36], [36, 0], [18, 0], [-18, 0], [-36, 0]];
function botLog(s) { BOTR.log.push(s + '@' + S.time.toFixed(1)); }
function botThink(dt) {
  const b = (IN.bot = IN.bot || { mx: 0, my: 0, look: 0 }); b.look = 0; b.mx = b.my = 0; BOTR.t += dt;
  if (NEWS.over) { BOTR.done = true; return; }
  if (REPLAY.on || hero.state === 'cuffed') return;
  let tx = null, tz = null, stopAt = 0.8;
  const cop = COP.on && (COP.state === 'chase' || COP.state === 'exit') ? COP.f : null;
  if (BOTR.phase === 'wait') { // walk to the middle of the intersection and loiter (ratings sag -> hostile chyron -> police)
    if (cop) { BOTR.phase = 'flee'; botLog('cop'); }
    else if (S.time > 45) { BOTR.phase = 'fight'; botLog('nocop'); }
    else { tx = 0; tz = 34; stopAt = 0.6; }
  }
  if (cop) {
    const dC = Math.hypot(cop.pos.x - hero.pos.x, cop.pos.z - hero.pos.z);
    if (BOTR.phase === 'flee' || dC < 6) {
      if (BOTR.phase === 'flee') { // kite the officer round a loop in the south street: the hero is faster, the officer can't close
        if (!BOTR.dir) { const a0 = Math.atan2(hero.pos.x - cop.pos.x, hero.pos.z - cop.pos.z); BOTR.dir = Math.sin(a0) >= 0 ? 1 : -1; }
        const a = Math.atan2(hero.pos.x, hero.pos.z - 34) + 0.7 * BOTR.dir; BOTR.wp = [Math.sin(a) * 7, 34 + Math.cos(a) * 7]; BOTR.fleeT = 1;
      }
      BOTR.fleeT -= dt;
      if (!BOTR.wp || BOTR.fleeT <= 0 || Math.hypot(BOTR.wp[0] - hero.pos.x, BOTR.wp[1] - hero.pos.z) < 2) {
        BOTR.fleeT = 0.5; let best = null, bs = -1e9;
        for (const w of FLEE_WP) { const dc = Math.hypot(w[0] - cop.pos.x, w[1] - cop.pos.z), dh = Math.hypot(w[0] - hero.pos.x, w[1] - hero.pos.z); if (dh < 2) continue; const sc = dc - dh * 0.5 - (dc < dh + 2 ? 60 : 0); if (sc > bs) { bs = sc; best = w; } }
        BOTR.wp = best || [0, 0];
      }
      tx = BOTR.wp[0]; tz = BOTR.wp[1]; stopAt = 0.4;
    }
  } else if (BOTR.phase === 'flee') { BOTR.phase = 'fight'; botLog('copGone'); }
  if (tx === null && BOTR.phase !== 'wait') {
    const crewDown = CREW.state === 'down';
    const near = enemies.filter((e) => e.alive && e.state !== 'dying' && e.state !== 'dead' && !e.tgtCrew && Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z) < (crewDown ? 3.5 : 9) && (e.state !== 'idle' || Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z) < 4));
    if (crewDown && (EV.offCam > 0 || !near.length || BOTR.offT > 3)) { // go help the crew up
      const o = CREW.op; tx = o.pos.x; tz = o.pos.z; stopAt = 1.6;
      if (Math.hypot(o.pos.x - hero.pos.x, o.pos.z - hero.pos.z) < 2.2 && hero.state === 'move' && o.st > 0.6) { b.help = true; if (!BOTR.helped) { BOTR.helped = 1; botLog('help'); } }
    } else if (near.length) {
      if (crewDown) BOTR.offT += dt;
      near.sort((p, q) => Math.hypot(p.pos.x - hero.pos.x, p.pos.z - hero.pos.z) - Math.hypot(q.pos.x - hero.pos.x, q.pos.z - hero.pos.z));
      const e = near[0]; tx = e.pos.x; tz = e.pos.z; stopAt = 1.6; BOTR.fightT += dt;
      const d = Math.hypot(tx - hero.pos.x, tz - hero.pos.z);
      const hold = enemies.some((q) => q.tgtCrew) && !crewDown; // let the camera-shy thug reach the crew (tests the knockdown)
      if (d < 2.4 && !hold) { BOTR.atkT -= dt; if (BOTR.atkT <= 0) { if (Math.random() < 0.1 && hero.state === 'move') { b.jump = true; BOTR.airPend = 0.2; } else b.atk = true; BOTR.atkT = 0.11; } }
      if (BOTR.airPend !== undefined) { BOTR.airPend -= dt; if (BOTR.airPend <= 0) { b.atk = true; BOTR.airPend = undefined; } }
    } else {
      const nxt = enemies.find((e) => e.alive && e.state !== 'dead' && e.state !== 'dying');
      if (nxt && !nxt.tgtCrew) { tx = nxt.pos.x; tz = nxt.pos.z; stopAt = 1.5; } // (a thug going for the crew is left alone on purpose)
    }
  }
  if (tx === null) return;
  { // route through the intersection when a corner block is in the way
    let cut = false; for (let i = 1; i < 12; i++) { const u = i / 12, x = lerp(hero.pos.x, tx, u), z = lerp(hero.pos.z, tz, u); if (Math.abs(x) > SW - 0.6 && Math.abs(z) > SW - 0.6) { cut = true; break; } }
    if (cut) { tx = clamp(hero.pos.x, -4, 4) * 0.3; tz = clamp(hero.pos.z, -4, 4) * 0.3; stopAt = 0.3; }
  }
  const dx = tx - hero.pos.x, dz = tz - hero.pos.z, d = Math.hypot(dx, dz);
  if (d < stopAt) return;
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
    if (REPLAY.on) { // instant replay: the live action is frozen while the slow-mo plays from angle 2
      const vt = SIM ? Math.max(rdt, SIM / 120) : rdt; // ?sim=N: replay + chyron run on (scaled) game time so slow headless frames don't stretch them
      updateReplay(vt); newsHud(0, vt); updateChyron(vt); PRESS.clear(); renderer.render(scene, camera); replayThumb(); return;
    }
    if (NEWS.over) { updateCamera(0, rdt); PRESS.clear(); renderer.render(scene, camera); return; }
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
      newsStep(dt);
      if (REPLAY.on || NEWS.over) break;
      if (k < steps - 1) { updateSprites(rdt); updateSlashes(rdt); PRESS.clear(); updateCamera(dt, rdt); }
    }
    const dt = rdt;
    // soft lock target (for the ring + camera framing)
    let dx = Math.sin(hero.yaw), dz = Math.cos(hero.yaw);
    if (IN.mx || IN.my) { const f = camFwd(CAM.yaw), r = [-f[1], f[0]]; dx = r[0] * IN.mx + f[0] * IN.my; dz = r[1] * IN.mx + f[1] * IN.my; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    const cand = pickTarget(dx, dz, 6.5);
    lockT = cand && cand.state !== 'idle' && cand.state !== 'return' ? cand : (lockT && lockT.alive && lockT.state !== 'dying' && Math.hypot(lockT.pos.x - hero.pos.x, lockT.pos.z - hero.pos.z) < 8 && lockT.state !== 'return' ? lockT : null);
    lockRing.visible = !!lockT && !REPLAY.on;
    if (lockT) { lockRing.position.set(lockT.pos.x, lockT.pos.y + 0.03, lockT.pos.z); lockRing.scale.setScalar(lockT.scale); lockRing.userData.b.rotation.z += rdt * 3; }
    if (!REPLAY.on) updateCamera(dt, rdt);
    // moon + shadow camera follow the hero (snapped to shadow texels to stop shimmering)
    const tx = SHR * 2 / SHM, sx = Math.round(hero.pos.x / tx) * tx, sz = Math.round(hero.pos.z / tx) * tx;
    sun.target.position.set(sx, 0, sz); sun.position.set(sx + SUN_DIR.x * 70, SUN_DIR.y * 70, sz + SUN_DIR.z * 70);
    window.__sky.position.copy(camera.position);
    updateSprites(rdt); updateSlashes(rdt); hud(rdt); newsHud(dt, SIM ? steps / 60 : rdt); updateChyron(SIM ? steps / 60 : rdt);
    if (bannerT > 0) { bannerT -= rdt; if (bannerT <= 0) $('banner').classList.remove('on'); }
    PRESS.clear();
    renderer.render(scene, camera);
  } catch (err) { __celErr.n++; __celErr.last = String(err && err.stack || err); if (__celErr.n < 4) console.error(err); }
}
requestAnimationFrame(frame);
window.__cel = { S, hero, enemies, CAM, BOTR, FPS, IN, renderer, get frames() { return frames; }, atlasRows: _ay + _arow, THREE, camera, scene, NEWS, RT, EV, CREW, COP, REPLAY, CHY, TARGET, GAME_LEN };
