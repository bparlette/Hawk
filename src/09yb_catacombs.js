
// ======================= POE CATACOMBS (DESIGN.md "Poe night goes full horror (catacombs chapter)"): chapter 2 of the Poe night.
// NIGHT ONLY survival-horror descent under Westminster church: 3 crypt rooms in a line, a LANTERN CONE with limited OIL (drains while lit; pick up oil flasks),
// creaking doors that open when you take the room's KEY, shambling "Nevermore" shadows that can't be fought: blind them with the FLASH (B: 15 oil) for 3 s or avoid them.
// Raven King crows jump-scare the screen now and then (cartoony, PG). Room 3 holds the NEVERMORE FEATHER; lifting it wakes two fast shadows: run for the hatch.
// Clear = the Nevermore Feather (same save as the graveyard; the Raven King ring reads window.hasNevermoreFeather()).
// Entry: ring left of the Poe ring at Westminster. Tests: ?cata=1&cataauto=win|lose, ?duel=catacombs&duelbot=win|lose.
// Rig hook (Opus, optional): window.buildNevermoreShadow({ THREE, toonMat, outlineMat, addOdir, QUAL }) -> { root, update?(dt) }.
(function () {
  const P = { scene: null, cam: null, title: 'CATACOMBS', pips: 1,
    hint: '<b>WASD</b> move · <b>B</b>/<b>K</b> flash (15 oil) · <b>E</b> leave · walk onto glows to take keys, oil, the feather',
    labels: { a: '', b: 'FLASH', c: 'LEAVE', l: '', r: '' } };
  const RZ = [0, -12, -24], HW = 7, DOORX = 1.3, OIL0 = 100, DRAIN = 2.2, FLASHC = 15, STUN = 3;
  const WALLS = [[-HW - 0.6, -HW, -29.5, 5.4], [HW, HW + 0.6, -29.5, 5.4], [-HW, HW, 4.8, 5.4], [-HW, HW, -29.5, -28.9],
    [-HW, -DOORX, -6.3, -5.7], [DOORX, HW, -6.3, -5.7], [-HW, -DOORX, -18.3, -17.7], [DOORX, HW, -18.3, -17.7]];
  const DOORS = [{ z: -6, open: false, y: 0 }, { z: -18, open: false, y: 0 }];
  const KEYS = [{ x: 4.6, z: -2.4, room: 0 }, { x: -4.8, z: -14.5, room: 1 }]; // room 3 holds the feather instead
  const FEATHER = { x: 0, z: -26.4 }, HATCH = { x: -5.5, z: -22.0 };
  const OILS = [[-4.8, 1.8], [5, -9], [-5, -9.2], [4.5, -21], [-3, -27]];
  const SH = [ // shadow patrols: [path], speed
    { p: [[-4.5, -2], [-4.5, 2.5]], sp: 1.3 }, { p: [[3, 3], [3, -3.2]], sp: 1.5 },
    { p: [[-4, -9], [4, -9]], sp: 1.4 }, { p: [[4.5, -14], [-4.5, -14]], sp: 1.6 },
    { p: [[-4.5, -21.5], [-4.5, -26]], sp: 1.5 }, { p: [[4.5, -21.5], [4.5, -26]], sp: 1.7 }];
  const V = new THREE.Vector3();
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
  const isNight = () => NIGHT.value > 0.5 || Q.has('cata') || Q.has('duel');
  const ringT = canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke(); g.lineWidth = 4; g.setLineDash([10, 9]); g.beginPath(); g.arc(64, 64, 36, 0, TAU); g.stroke(); });
  const flat = (col, s, op = 0.8) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: ringT, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; return m; };
  function hitWall(x, z, r) { for (const w of WALLS) if (x > w[0] - r && x < w[1] + r && z > w[2] - r && z < w[3] + r) return true;
    for (const d of DOORS) if (!d.open && Math.abs(z - d.z) < 0.3 + r && Math.abs(x) < DOORX + 0.1) return true; return false; }
  P.hitWall = hitWall;
  function shadowRig() {
    let rig = null; try { if (typeof window.buildNevermoreShadow === 'function') rig = window.buildNevermoreShadow({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    if (rig && rig.root) { rig.kind = 'hook'; return rig; }
    const K = DUELS.kit(), G = DUELS.GEO, R = { root: new THREE.Group(), kind: 'standin' }; // original stand-in: a tall hunched inky shade with two pale eyes, facing +z
    K.add(G.cone(0.55, 1.9, 7), '#0c0a16', 0, 0.95, 0).add(G.sph(0.3, 8, 6), '#14101f', 0, 1.9, 0.12).add(G.sph(0.07, 5, 4), '#e8f4ff', -0.12, 1.95, 0.38).add(G.sph(0.07, 5, 4), '#e8f4ff', 0.12, 1.95, 0.38)
      .add(G.box(0.12, 0.9, 0.12), '#0c0a16', -0.62, 1.0, 0.25, 0.6, 0, 0.2).add(G.box(0.12, 0.9, 0.12), '#0c0a16', 0.62, 1.0, 0.25, 0.6, 0, -0.2);
    K.mesh(toonMat(), R.root); return R;
  }
  function setPiece() {
    const K = DUELS.kit(), G = DUELS.GEO, sc = P.scene;
    for (const w of WALLS) K.add(G.box(w[1] - w[0], 3, w[3] - w[2]), '#4a4440', (w[0] + w[1]) / 2, 1.5, (w[2] + w[3]) / 2);
    for (const z of RZ) for (const x of [-5.6, 5.6]) K.add(G.box(0.7, 2.6, 0.7), '#6a625a', x, 1.3, z - 3.2).add(G.box(0.9, 0.3, 0.9), '#5a524a', x, 2.7, z - 3.2); // pillars
    for (const z of RZ) for (const x of [-2.6, 2.6]) K.add(G.box(1.5, 0.7, 0.8), '#7a746c', x, 0.35, z + 2.2).add(G.sph(0.22, 6, 5), '#d8d4c8', x - 0.3, 0.9, z + 2.2); // sarcophagi + a skull
    P.deco = K.mesh(toonMat(), sc, 0.005);
    P.doorM = DOORS.map((d) => { const k = DUELS.kit(); k.add(G.box(2.7, 2.6, 0.5), '#3a2416', 0, 1.3, 0).add(G.box(2.7, 0.1, 0.52), '#8a6a2a', 0, 1.9, 0); const m = k.mesh(toonMat(), sc, 0.005); m.position.set(0, 0, d.z); return m; });
    P.hatch = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.8), new THREE.MeshBasicMaterial({ color: '#6a4a24' })); P.hatch.position.set(HATCH.x, 0.05, HATCH.z); sc.add(P.hatch);
  }
  function coneMesh() {
    const N = 16, pos = [0, 0.1, 0], idx = [], r = 6.2, HALF = 0.62; for (let i = 0; i <= N; i++) { const a = -HALF + (2 * HALF * i) / N; pos.push(Math.sin(a) * r, 0.1, Math.cos(a) * r); if (i > 0) idx.push(0, i, i + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffe8a0', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); m.frustumCulled = false; m.renderOrder = 2; return m;
  }
  P.build = function () {
    const sc = (P.scene = new THREE.Scene()); P.cam = new THREE.PerspectiveCamera(46, VW() / VH(), 0.1, 90);
    sc.fog = new THREE.Fog('#05060c', 14, 30); sc.background = new THREE.Color('#05060c');
    DUELS.sceneLights(sc, '#4a5088', '#0c0c18', 0.55, '#8090d0', 0.35, new THREE.Vector3(-0.3, 1, 0.5));
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(18, 40), new THREE.MeshLambertMaterial({ color: '#2a2622' })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, -12); sc.add(fl);
    setPiece();
    P.H = buildHero(); sc.add(P.H.root); P.cone = coneMesh(); sc.add(P.cone);
    P.sh = SH.map((s) => { const r = shadowRig(); sc.add(r.root); return { s, rig: r, x: s.p[0][0], z: s.p[0][1], yaw: 0, wp: 1, stun: 0, chase: false, extra: false }; });
    P.keys = KEYS.map((k) => { const m = flat('#ffd23c', 1.3); m.position.set(k.x, 0.08, k.z); sc.add(m); return { k, m, done: false }; });
    P.oils = OILS.map((o) => { const m = flat('#6ad0ff', 1.0); m.position.set(o[0], 0.08, o[1]); sc.add(m); return { o, m, done: false }; });
    P.fth = flat('#b49aff', 1.6); P.fth.position.set(FEATHER.x, 0.08, FEATHER.z); sc.add(P.fth);
    P.exitR = flat('#6aff8a', 2.0); P.exitR.position.set(HATCH.x, 0.1, HATCH.z); sc.add(P.exitR); P.exitR.visible = false;
    P.crow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, depthWrite: false })); P.crow.renderOrder = 9; sc.add(P.crow);
    P.layout();
  };
  P.layout = function () { const port = VH() > VW(); P.cam.fov = port ? 52 : 42; P.cam.aspect = VW() / VH(); P.cam.updateProjectionMatrix(); P.camH = port ? 17 : 14; P.camZ = port ? 7 : 6.4; };
  P.onResize = () => { if (P.cam) P.layout(); };
  function ui() { const st = P.st; if (!st) return; DUELS.sub('KEYS ' + st.keys + '/2 · OIL ' + Math.ceil(st.oil) + (st.feather ? ' · RUN FOR THE HATCH!' : ''), 'ROOM ' + (st.room + 1) + '/3'); DUELS.bars(clamp(st.oil / OIL0, 0, 1), st.fear); }
  function reset() {
    const st = (P.st = { t: 0, x: 0, z: 3, yaw: Math.PI, spd: 0, oil: OIL0, keys: 0, feather: false, over: false, fear: 0, room: 0, scare: 0, scareT: 4 + Math.random() * 3, fcd: 0, flash: 0, ghost: !!(DUELS.bot && DUELS.bot.mode === 'win'), grace: 2 });
    for (const d of DOORS) d.open = false; P.doorM.forEach((m) => { m.visible = true; });
    for (const k of P.keys) { k.done = false; k.m.visible = true; } for (const o of P.oils) { o.done = false; o.m.visible = true; } P.fth.visible = true; P.exitR.visible = false;
    P.sh = P.sh.filter((s) => { if (s.extra) { s.rig.root.parent && s.rig.root.parent.remove(s.rig.root); return false; } return true; });
    for (const s of P.sh) { s.x = s.s.p[0][0]; s.z = s.s.p[0][1]; s.wp = 1; s.stun = 0; s.chase = false; } ui(); return st;
  }
  P.start = function () { reset(); DUELS.banner('THE CATACOMBS<small>UNDER WESTMINSTER</small>', 2.2); DUELS.say('MAVIS', 'Hold the lantern high, Harold. I do not like the sound of that.', 3.2); DUELS.log.push('cata:start'); };
  P.retry = function () { reset(); DUELS.banner('ONCE MORE<small>THE DARK IS PATIENT</small>', 1.4); };
  P.exit = function () { try { dispatchEvent(new CustomEvent('tcb:cata', { detail: { feather: !!(window.__poe && window.__poe.save.feather) } })); } catch (e) {} };
  function caught(st, why) { st.over = true; DUELS.hurt(); DUELS.banner('NEVERMORE<small>' + why + '</small>', 1.6); DUELS.over('lose', why, 'The shadows closed in. Keys: ' + st.keys + '/2' + (st.feather ? ', feather in hand' : '') + '.'); }
  P.step = function (dt, I) {
    const st = P.st; if (!st) return; st.t += dt; if (st.over) return;
    if (I.c) { DUELS.exit('leave'); return; }
    let mx = I.mx, my = I.my; const L = Math.hypot(mx, my); if (L > 1) { mx /= L; my /= L; }
    const sp = 3.1 * Math.min(1, L); let nx = st.x, nz = st.z;
    if (L > 0.12) { nx += mx * sp * dt; if (!hitWall(nx, st.z, 0.35)) st.x = nx; nz += -my * sp * dt; if (!hitWall(st.x, nz, 0.35)) st.z = nz; st.yaw = Math.atan2(mx, -my); st.spd = sp; } else st.spd = 0;
    st.room = st.z < -18 ? 2 : st.z < -6 ? 1 : 0;
    st.oil = Math.max(0, st.oil - DRAIN * dt * (st.oil > 0 ? 1 : 0)); // the lantern burns while you are down here
    st.fcd -= dt; st.flash = Math.max(0, st.flash - dt);
    if ((I.b || I.a) && st.fcd <= 0) { if (st.oil >= FLASHC) { st.oil -= FLASHC; st.fcd = 0.8; st.flash = 0.35; DUELS.hitSfx && DUELS.hitSfx('power');
        for (const s of P.sh) { const dx = s.x - st.x, dz = s.z - st.z, d = Math.hypot(dx, dz); if (d < 6.2 && Math.abs(angDiff(st.yaw, Math.atan2(dx, dz))) < 0.7) { s.stun = STUN; DUELS.pop && DUELS.pop('BLINDED', V.set(s.x, 2.4, s.z), ''); DUELS.log.push('cata:blind'); } } }
      else { st.fcd = 0.6; DUELS.tell('NOT ENOUGH OIL', 0.8); } }
    // pickups
    for (const k of P.keys) if (!k.done && Math.hypot(k.k.x - st.x, k.k.z - st.z) < 0.9) { k.done = true; k.m.visible = false; st.keys++; const d = DOORS[k.k.room]; d.open = true; P.doorM[k.k.room].visible = false; DUELS.tell('KEY! A DOOR CREAKS OPEN', 1.4); DUELS.log.push('cata:key' + st.keys); }
    for (const o of P.oils) if (!o.done && Math.hypot(o.o[0] - st.x, o.o[1] - st.z) < 0.9) { o.done = true; o.m.visible = false; st.oil = Math.min(OIL0, st.oil + 30); DUELS.tell('OIL +30', 0.9); }
    if (!st.feather && P.fth.visible && st.keys >= 2 && Math.hypot(FEATHER.x - st.x, FEATHER.z - st.z) < 1) { st.feather = true; P.fth.visible = false; P.exitR.visible = true; DUELS.banner('THE FEATHER!<small>NOW RUN FOR THE HATCH</small>', 1.8); DUELS.log.push('cata:feather');
      for (const sx of [-5.5, 5.5]) { const r = shadowRig(); P.scene.add(r.root); P.sh.push({ s: { p: [[sx, -27], [sx, -26]], sp: 2.3 }, rig: r, x: sx, z: -27.4, yaw: 0, wp: 1, stun: 0, chase: true, extra: true }); } }
    // shadows
    st.grace -= dt; let fear = 0;
    for (const s of P.sh) {
      if (s.stun > 0) { s.stun -= dt; continue; }
      const dx = st.x - s.x, dz = st.z - s.z, d = Math.hypot(dx, dz);
      if (!st.ghost && st.grace <= 0 && (s.chase || d < 4.4) && d < (s.chase ? 40 : 4.4) && Math.abs((s.z < -18 ? 2 : s.z < -6 ? 1 : 0) - st.room) < 1.1) { const spd = s.s.sp * (s.chase ? 1.05 : 1.35); s.yaw = Math.atan2(dx, dz); const nx2 = s.x + (dx / d) * spd * dt, nz2 = s.z + (dz / d) * spd * dt; if (!hitWall(nx2, s.z, 0.3)) s.x = nx2; if (!hitWall(s.x, nz2, 0.3)) s.z = nz2; fear = Math.max(fear, 1 - d / 5); }
      else { const w = s.s.p[s.wp], wx = w[0] - s.x, wz = w[1] - s.z, wd = Math.hypot(wx, wz); s.yaw += clamp(angDiff(s.yaw, Math.atan2(wx, wz)), -2 * dt, 2 * dt); if (wd < 0.2) s.wp = (s.wp + 1) % s.s.p.length; else { const m = Math.min(wd, s.s.sp * dt); s.x += (wx / wd) * m; s.z += (wz / wd) * m; } }
      if (!st.ghost && d < 0.85) { caught(st, 'CAUGHT BY A SHADOW'); return; }
    }
    st.fear = lerp(st.fear, fear, Math.min(1, dt * 4));
    if (st.oil <= 0 && !st.ghost) { st.dark = (st.dark || 0) + dt; if (st.dark > 6) { caught(st, 'THE LANTERN DIED'); return; } } else st.dark = 0;
    // jump-scare crows (cosmetic, PG)
    st.scareT -= dt; if (st.scareT <= 0) { st.scareT = 7 + Math.random() * 6; st.scare = 0.5; DUELS.tell('CAW!', 0.5); DUELS.log.push('cata:scare'); } st.scare = Math.max(0, st.scare - dt);
    ui();
    if (st.feather && Math.hypot(HATCH.x - st.x, HATCH.z - st.z) < 1.2) {
      st.over = true; const sv = window.__poe && window.__poe.save; const first = sv ? !sv.feather : false; if (sv) { sv.feather = true; sv.clears++; try { localStorage.setItem('tcb_poe', JSON.stringify(sv)); } catch (e) {} }
      CITY.log.push('cata:feather@' + S.time.toFixed(1)); try { dispatchEvent(new CustomEvent('tcb:feather', { detail: { first, via: 'catacombs' } })); } catch (e) {}
      DUELS.over('win', 'OUT OF THE DARK', 'You climb out into the moonlit graveyard with the Nevermore Feather. The Raven King will answer to it now (M&amp;T Stadium).'); }
  };
  P.render = function (rdt) {
    const st = P.st; if (!st) return; const t = st.t, H = P.H;
    H.root.position.set(st.x, 0, st.z); H.root.rotation.y = st.yaw;
    applyPose(H, st.spd > 0.2 ? HERO_POSES.run(t, st.spd) : HERO_POSES.idle(t), 16, rdt, false);
    P.cone.position.set(st.x, 0, st.z); P.cone.rotation.y = st.yaw; P.cone.visible = st.oil > 0; P.cone.material.opacity = (0.16 + 0.14 * Math.min(1, st.oil / 30)) + (st.flash > 0 ? 0.5 : 0) + (st.oil < 20 ? Math.sin(t * 30) * 0.05 : 0);
    for (const s of P.sh) { s.rig.root.position.set(s.x, s.stun > 0 ? 0 : Math.abs(Math.sin(t * 3 + s.wp)) * 0.08, s.z); s.rig.root.rotation.y = s.yaw; s.rig.root.rotation.z = s.stun > 0 ? Math.sin(t * 40) * 0.12 : 0; s.rig.update && s.rig.update(rdt); }
    for (const m of P.keys) if (m.m.visible) { m.m.rotation.z += rdt; m.m.material.opacity = 0.5 + 0.35 * Math.sin(t * 3); }
    for (const m of P.oils) if (m.m.visible) m.m.rotation.z -= rdt;
    P.fth.rotation.z += rdt; P.exitR.rotation.z += rdt * 1.3;
    P.crow.material.opacity = st.scare > 0 ? st.scare : 0; P.crow.position.set(st.x, 1.5, st.z + 0.5); P.crow.rotation.x = -Math.PI / 2 + 0.9; P.crow.scale.set(14, 14, 1);
    const cx = clamp(st.x, -3, 3), cz = clamp(st.z, -25, 1); P.cam.position.set(cx, P.camH, cz + P.camZ); P.cam.lookAt(cx, 0.2, cz - 0.4);
    OUT_U.fogC.value.copy(P.scene.fog.color); OUT_U.fogN.value = 14; OUT_U.fogF.value = 30;
  };
  P.botThink = function (B) {
    const st = P.st; if (!st || st.over) return; B.mx = B.my = 0; B.up = B.down = false; B.b = false;
    const go = (tx, tz) => { const dx = tx - st.x, dz = tz - st.z, d = Math.hypot(dx, dz); if (d < 0.15) return d; B.mx = dx / d; B.my = -dz / d; return d; };
    if (B.mode === 'lose') { const s = P.sh[0]; go(s.x, s.z); return; }
    // route through the door gaps (x 0) between rooms
    const via = (tx, tz) => { if (st.z > -6.6 && tz < -6) { if (Math.abs(st.x) > 0.5 && st.z > -5) return go(0, st.z); } if (st.z > -18.6 && tz < -18 && st.z < -6.5 && Math.abs(st.x) > 0.5 && st.z > -17.3) return go(0, st.z); return go(tx, tz); };
    let tgt; const k = P.keys.find((q) => !q.done);
    if (k) tgt = [k.k.x, k.k.z]; else if (!st.feather) tgt = [FEATHER.x, FEATHER.z]; else tgt = [HATCH.x, HATCH.z];
    // when a wall is in the way of a lower room, pass the door centre first
    if (tgt[1] < -6 && st.z > -5.2 && Math.abs(st.x) > 0.6) tgt = [0, st.z]; else if (tgt[1] < -6 && st.z > -6.6 && st.z <= -5.2) tgt = [0, -7.5];
    else if (tgt[1] < -18 && st.z > -17.2 && st.z < -6.6 && Math.abs(st.x) > 0.6) tgt = [0, st.z]; else if (tgt[1] < -18 && st.z <= -17.2 && st.z > -18.8) tgt = [0, -19.5];
    else if (st.feather && st.z < -18 && false) tgt = [HATCH.x, HATCH.z];
    go(tgt[0], tgt[1]);
  };
  DUELS.reg('catacombs', P);
  let n = 0;
  MODE.ticks.push((rdt) => {
    n++;
    if (n === 1 && window.POE_ANCHOR) {
      const A = window.POE_ANCHOR, rx = A.x - 1.5, rz = A.z + 1.8, y = groundY(rx, rz);
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: ringT, color: '#7a5af0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(rx, y + 0.05, rz); ring.renderOrder = 2; ring.visible = false; scene.add(ring); P.ring = ring;
      const act = { kind: 'cata', x: rx, z: rz, r: 1.7, y: 2.2, ok: () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels') || Q.has('cata')), go: () => { if (!isNight()) { banner('THE CATACOMBS OPEN ONLY AFTER DARK.', 2.4); return; } DUELS.start('catacombs'); } };
      Object.defineProperty(act, 'label', { get: () => (isNight() ? 'CATACOMBS' : 'CATACOMBS: AFTER DARK'), configurable: true });
      ACTIONS.push(act); P.act = act;
    }
    if (P.ring) { const d = Math.hypot(P.ring.position.x - hero.pos.x, P.ring.position.z - hero.pos.z); P.ring.visible = d < 16 && !DUELS.cur; if (P.ring.visible) { P.ring.rotation.z += rdt * 0.7; P.ring.material.opacity = 0.6 + 0.3 * Math.sin(S.time * 3); } }
    if (n === 3 && Q.has('cata') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('cataauto'); DUELS.start('catacombs', m === 'win' || m === 'lose' ? { bot: m } : {}); }
  });
  window.__cata = P;
})();
