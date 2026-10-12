  // =====================================================================================================
  // ---------- THE PARTY VAN (new, original design): parked on block 1. E / SPECIAL gets in and out. Arcade handling:
  // stick / arrows = gas, brake + reverse, steer; K / SPACE / JUMP = handbrake (drift); J / H / ATTACK = horn;
  // G / LIGHTS = headlights. Bumps cars, lamp posts and walls, bowls over thugs and smashes crates. Street blocks only. ----------
  // =====================================================================================================
  const VAN = { on: false, x: 9, z: 5.0, yaw: 0, vx: 0, vz: 0, sp: 0, lat: 0, steer: 0, lights: false, hornT: 0, wheel: 0, driftT: 0, hits: 0, props: 0, bumps: 0, maxLat: 0, maxSp: 0, dist: 0, col: null, it: null, L: 5.3, Wd: 2.2 };
  function vanSideTex(cabRight) {
    return canvasTex(512, 220, (g, w, h) => {
      g.fillStyle = "#efe2c0"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#127566"; g.fillRect(0, h * 0.56, w, h * 0.44);
      // sunset stripes sweeping up toward the back
      const cols = ["#ffd23a", "#ff9a1a", "#f2531e", "#b0287a"];
      cols.forEach((c, i) => { g.fillStyle = c; g.beginPath(); const y0 = h * 0.5 + i * 11, x0 = cabRight ? w : 0, x1 = cabRight ? 0 : w, s = cabRight ? -1 : 1;
        g.moveTo(x0, y0); g.lineTo(x0 + s * w * 0.45, y0); g.quadraticCurveTo(x0 + s * w * 0.62, y0, x0 + s * w * 0.7, y0 - 40); g.lineTo(x1, y0 - 58); g.lineTo(x1, y0 - 47); g.lineTo(x0 + s * w * 0.72, y0 - 29); g.quadraticCurveTo(x0 + s * w * 0.64, y0 + 11, x0 + s * w * 0.45, y0 + 11); g.lineTo(x0, y0 + 11); g.closePath(); g.fill(); });
      // cab window + door line
      const cx = cabRight ? w - 120 : 18; g.fillStyle = "#1a2a3c"; g.beginPath(); g.moveTo(cx, 22); g.lineTo(cx + 102, 22); g.lineTo(cx + (cabRight ? 102 : 102), 92); g.lineTo(cx, 92); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(cx + 10, 28, 18, 56);
      g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineWidth = 3; g.strokeRect(cabRight ? w - 132 : 8, 14, 124, h - 40);
      // bubble porthole near the back
      const px = cabRight ? 92 : w - 92; g.fillStyle = "#c8ccd4"; g.beginPath(); g.arc(px, 70, 44, 0, 7); g.fill(); g.fillStyle = "#28406a"; g.beginPath(); g.arc(px, 70, 36, 0, 7); g.fill(); g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.arc(px - 12, 58, 11, 0, 7); g.fill();
      // lettering (original): SEWER SURF CO.
      g.save(); g.translate(w / 2 + (cabRight ? -20 : 20), 162); g.rotate(-0.04); g.font = "italic 900 40px Arial Black, Arial"; g.textAlign = "center"; g.lineWidth = 7; g.strokeStyle = "#0a2a24"; g.strokeText("SEWER SURF CO.", 0, 0); g.fillStyle = "#ffe14a"; g.fillText("SEWER SURF CO.", 0, 0); g.restore();
      // a pizza-slice decal
      const sx = w / 2 + (cabRight ? 40 : -40); g.fillStyle = "#ffcc4a"; g.beginPath(); g.moveTo(sx, 30); g.lineTo(sx + 26, 92); g.lineTo(sx - 26, 92); g.closePath(); g.fill(); g.fillStyle = "#c83a1a"; for (const [a, b] of [[0, 55], [-9, 76], [10, 78]]) { g.beginPath(); g.arc(sx + a, b, 5, 0, 7); g.fill(); } g.fillStyle = "#b0782a"; g.fillRect(sx - 27, 88, 54, 7);
      g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(0, h - 10, w, 10);
    });
  }
  function buildVan() {
    const G = new THREE.Group(), L = VAN.L, Wd = VAN.Wd;
    const body = new THREE.MeshLambertMaterial({ color: 0xefe2c0 }), teal = new THREE.MeshLambertMaterial({ color: 0x127566 }), dark = new THREE.MeshLambertMaterial({ color: 0x1c1e24 }), chrome = new THREE.MeshLambertMaterial({ color: 0xb8bcc6 }), glass = new THREE.MeshLambertMaterial({ color: 0x1a2a3c });
    const sR = new THREE.MeshLambertMaterial({ map: vanSideTex(true) }), sL = new THREE.MeshLambertMaterial({ map: vanSideTex(false) });
    const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); G.add(b); return b; };
    box(L - 0.9, 1.95, Wd, [body, teal, body, dark, sR, sL], -0.45, 1.5, 0);   // box body (+x = front); +z side = cab on the right of the art
    box(0.95, 1.0, Wd, [teal, teal, body, dark, teal, teal], L / 2 - 0.47, 1.0, 0); // nose / hood
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(Wd * 0.92, 1.05), glass); ws.position.set(L / 2 - 0.93, 2.0, 0); ws.rotation.set(0, Math.PI / 2, 0); ws.rotateX(-0.35); G.add(ws);
    box(0.25, 0.3, Wd + 0.1, chrome, L / 2 + 0.02, 0.55, 0); box(0.25, 0.3, Wd + 0.1, chrome, -L / 2 + 0.02, 0.55, 0);
    box(L - 1.2, 0.08, 1.6, dark, -0.6, 2.52, 0); // roof rack
    const board = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 3.4, 12), new THREE.MeshLambertMaterial({ color: 0xff7a2a })); board.scale.set(1, 1, 0.2); board.rotation.z = Math.PI / 2; board.position.set(-0.6, 2.66, 0.25); G.add(board);
    const hl = new THREE.MeshBasicMaterial({ color: 0x555544 }), tl = new THREE.MeshBasicMaterial({ color: 0x661010 });
    VAN.hlMat = hl; VAN.tlMat = tl;
    for (const s of [-1, 1]) { box(0.06, 0.24, 0.42, hl, L / 2 + 0.0, 1.05, s * 0.72); box(0.06, 0.36, 0.22, tl, -L / 2 - 0.02 - 0.45 + 0.45, 1.3, s * 0.92); }
    VAN.wheels = [];
    const wg = new THREE.CylinderGeometry(0.43, 0.43, 0.32, 14); wg.rotateX(Math.PI / 2);
    const wm = new THREE.MeshLambertMaterial({ color: 0x141418 }), hub = new THREE.MeshLambertMaterial({ color: 0xd8d0b0 });
    for (const [x, z] of [[1.6, 1], [1.6, -1], [-1.75, 1], [-1.75, -1]]) {
      const wh = new THREE.Group(); wh.position.set(x, 0.43, z * (Wd / 2 - 0.08)); const t = new THREE.Mesh(wg, wm); wh.add(t); const hb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.34), hub); wh.add(hb); G.add(wh); VAN.wheels.push(wh);
    }
    // headlights: one spot light + two soft additive beams
    const sp = new THREE.SpotLight(0xfff2cc, 0, 30, 0.55, 0.6, 1.2); sp.position.set(L / 2, 1.1, 0); sp.target.position.set(L / 2 + 10, 0, 0); G.add(sp); G.add(sp.target); VAN.spot = sp;
    const bm = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.11, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    VAN.beams = [];
    for (const s of [-1, 1]) { const cg = new THREE.ConeGeometry(1.5, 8, 12, 1, true); cg.translate(0, -4, 0); cg.rotateZ(Math.PI / 2); const c = new THREE.Mesh(cg, bm); c.position.set(L / 2 + 0.05, 1.05, s * 0.72); c.rotation.z = -0.07; c.visible = false; G.add(c); VAN.beams.push(c); }
    WORLD.groups.street.add(G); VAN.mesh = G;
    VAN.col = { box: [0, 0, 0, 0], van: true }; WORLD.cols.push(VAN.col);
    VAN.it = { layer: "street", kind: "van", r: 2.3, label: "DRIVE THE PARTY VAN", x: 0, z: 0 }; WORLD.inter.push(VAN.it);
    vanPlace();
  }
  const vanF = () => [Math.cos(VAN.yaw), Math.sin(VAN.yaw)], vanR = () => [-Math.sin(VAN.yaw), Math.cos(VAN.yaw)];
  function vanPlace() { // mesh, collision box, the "get in" spot (driver's door, on the van's left)
    const [fx, fz] = vanF(), [rx, rz] = vanR();
    VAN.mesh.position.set(VAN.x, 0.0, VAN.z); VAN.mesh.rotation.set(0, -VAN.yaw, 0);
    const ex = Math.abs(fx) * VAN.L / 2 + Math.abs(rx) * VAN.Wd / 2, ez = Math.abs(fz) * VAN.L / 2 + Math.abs(rz) * VAN.Wd / 2;
    VAN.col.box[0] = VAN.x - ex; VAN.col.box[1] = VAN.z - ez; VAN.col.box[2] = VAN.x + ex; VAN.col.box[3] = VAN.z + ez;
    if (VAN.on) { VAN.col.box[0] = VAN.col.box[2] = -999; }
    VAN.it.x = VAN.x - rx * (VAN.Wd / 2 + 0.7) + fx * 0.8; VAN.it.z = VAN.z - rz * (VAN.Wd / 2 + 0.7) + fz * 0.8; VAN.it.taken = VAN.on;
  }
  function vanResetAll() { Object.assign(VAN, { on: false, x: 9, z: 5.0, yaw: 0, vx: 0, vz: 0, sp: 0, lat: 0, steer: 0, lights: false }); if (VAN.mesh) vanPlace(); }
  function vanEnter(p) {
    VAN.on = true; p.hidden = true; p.walkT = 0; p.attackT = 0; p.atk = null; p.crouch = false; STATE.near = null;
    if (p.sk && p.sk.on) skateOff(p);
    if (DAY.lamp > 0.5) VAN.lights = true;
    SFX.door && SFX.door(); vanPlace(); CAM.snap = false;
    skHint("van", "THE PARTY VAN", (STATE.showTouch ? "STICK: GAS / STEER   JUMP: HANDBRAKE DRIFT   ATTACK: HORN   SPECIAL: GET OUT" : "UP/DOWN: GAS + BRAKE   LEFT/RIGHT: STEER   K/SPACE: DRIFT   J/H: HORN   G: LIGHTS   E: GET OUT"));
  }
  function vanExit(p) {
    const [fx, fz] = vanF(), [rx, rz] = vanR();
    const spots = [[-rx * 2.0, -rz * 2.0], [rx * 2.0, rz * 2.0], [-fx * 3.6, -fz * 3.6], [fx * 3.6, fz * 3.6]];
    let ok = null;
    for (const [dx, dz] of spots) { const x = VAN.x + dx, z = VAN.z + dz; if (floorAt("street", x, z) !== null && !vanHitsCol(x, z, 0.4, true)) { ok = [x, z]; break; } }
    if (!ok) { popText("NO ROOM TO GET OUT", VAN.x, 3, VAN.z, "#ff8c1a"); return; }
    VAN.on = false; VAN.vx = VAN.vz = 0; VAN.sp = 0; p.hidden = false;
    placeOn(p, "street", ok[0], ok[1]); CAM.snap = false; p.inv = Math.max(p.inv, 40); SFX.door && SFX.door(); vanPlace();
  }
  function vanHitsCol(x, z, r, skipVan) {
    for (const c of WORLD.cols) {
      if (c.y !== undefined || (c.layer && c.layer !== "street") || (c.van && skipVan)) continue;
      if (c.box) { if (x > c.box[0] - r && x < c.box[2] + r && z > c.box[1] - r && z < c.box[3] + r) return c; }
      else if (Math.hypot(x - c.x, z - c.z) < c.r + r) return c;
    }
    return null;
  }
  function vanBlocked(x, z, yaw) {
    const fx = Math.cos(yaw), fz = Math.sin(yaw), rx = -fz, rz = fx;
    for (const [a, b] of [[VAN.L / 2 - 0.1, VAN.Wd / 2 - 0.1], [VAN.L / 2 - 0.1, -VAN.Wd / 2 + 0.1], [-VAN.L / 2 + 0.1, VAN.Wd / 2 - 0.1], [-VAN.L / 2 + 0.1, -VAN.Wd / 2 + 0.1], [0, VAN.Wd / 2 - 0.1], [0, -VAN.Wd / 2 + 0.1]])
      if (floorAt("street", x + fx * a + rx * b, z + fz * a + rz * b) === null) return "wall";
    for (const a of [VAN.L / 2 - 0.9, 0, -VAN.L / 2 + 0.9]) if (vanHitsCol(x + fx * a, z + fz * a, 0.95)) return "car";
    return null;
  }
  function vanHorn() {
    VAN.hornT = 26; popText("HONK!", VAN.x, 3.2, VAN.z, "#ffe14a"); comicPop(VAN.x, 2.8, VAN.z, "HOOONK!");
    try { if (AC && SFXBUS) { const t = AC.currentTime, g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.setValueAtTime(0.22, t + 0.32); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42); g.connect(SFXBUS);
      for (const f of [349, 440]) { const o = AC.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800; o.connect(lp); lp.connect(g); o.start(t); o.stop(t + 0.45); } } } catch (e) {}
    for (const e of STATE.enemies) if (e.post && e.idle) { const g = entPos(STATE.zone, e, {}); if (Math.hypot(g.gx - VAN.x, g.gz - VAN.z) < 12) engage(e); } // the noise wakes the block
  }
  function vanDrive(p, raw) { // one 60 Hz step at the wheel
    const dt = 1 / 60;
    p.inv = Math.max(p.inv, 20); p.walkT = 0; p.hidden = true;
    if (raw.e || raw.p) { vanExit(p); return; }
    if (raw.a || anyPressed("h")) vanHorn();
    if (anyPressed("g") || VAN.tbHit) { VAN.tbHit = false; VAN.lights = !VAN.lights; SFX.menuMove && SFX.menuMove(); }
    const v = inputVec(); let thr = v ? -v.dy * v.mag : 0, st = v ? v.dx * v.mag : 0;
    const hb = anyHeld("k", " ") || BTN_B.down || !!VAN.botHB;
    const [fx, fz] = vanF(), [rx, rz] = vanR();
    let sp = VAN.vx * fx + VAN.vz * fz, lat = VAN.vx * rx + VAN.vz * rz;
    if (thr > 0.1) { if (sp < -0.5) sp += 22 * dt * thr; else if (sp < 19) sp += (sp < 8 ? 15 : 9) * dt * thr; }
    else if (thr < -0.1) { if (sp > 0.5) sp -= 26 * dt * -thr; else if (sp > -7) sp -= 9 * dt * -thr; }
    else sp *= 1 - dt * 0.7;
    if (hb) sp *= 1 - dt * 1.4;
    VAN.steer = lerp(VAN.steer, st, 0.18);
    const turn = VAN.steer * Math.max(-1, Math.min(1, sp / 5)) * (hb ? 2.9 : 1.9) * (sp < 0 ? 1 : 1);
    VAN.yaw += turn * dt;
    lat *= Math.exp(-dt * (hb ? 0.9 : 9)); // grip: the handbrake lets the back step out
    if (hb && Math.abs(sp) > 6 && Math.abs(VAN.steer) > 0.3) lat += -VAN.steer * Math.sign(sp) * 7 * dt * Math.min(1, Math.abs(sp) / 12); // kick the tail out
    const [nfx, nfz] = vanF(), [nrx, nrz] = vanR();
    VAN.vx = nfx * sp + nrx * lat; VAN.vz = nfz * sp + nrz * lat; VAN.sp = sp; VAN.lat = lat;
    VAN.maxLat = Math.max(VAN.maxLat, Math.abs(lat)); VAN.maxSp = Math.max(VAN.maxSp, Math.abs(sp));
    const nx = VAN.x + VAN.vx * dt, nz = VAN.z + VAN.vz * dt, blk = vanBlocked(nx, nz, VAN.yaw);
    if (blk) {
      const hit = Math.hypot(VAN.vx, VAN.vz);
      if (hit > 3) { STATE.shake = Math.max(STATE.shake, Math.min(14, hit | 0)); SFX.land && SFX.land(); if (hit > 7) { SFX.hit && SFX.hit(); comicPop(VAN.x + nfx * 2.8, 1.5, VAN.z + nfz * 2.8, "KRUNCH!"); } VAN.bumps++; }
      VAN.vx *= -0.3; VAN.vz *= -0.3; VAN.yaw -= turn * dt * 0.5;
      if (vanBlocked(VAN.x, VAN.z, VAN.yaw)) { VAN.yaw += turn * dt * 0.5; }
    } else { VAN.dist += Math.hypot(nx - VAN.x, nz - VAN.z); VAN.x = nx; VAN.z = nz; }
    if (Math.abs(lat) > 2.6 && Math.abs(sp) > 4) { VAN.driftT++; if (VAN.driftT % 4 === 0) { const l = toLocal(STATE.zone, VAN.x - nfx * 2.2, VAN.z - nfz * 2.2); fx_(l, "smoke"); } if (VAN.driftT === 30) popText("DRIFT!", VAN.x, 3.4, VAN.z, "#7fe0ff", true); }
    else VAN.driftT = 0;
    VAN.wheel += sp * dt / 0.43;
    // the player rides along: zone follows the van
    p.gx = VAN.x; p.gz = VAN.z;
    const zn = zoneAtG("street", VAN.x, VAN.z); if (zn && zn !== STATE.zone) setZone(zn);
    const l = toLocal(STATE.zone, VAN.x, VAN.z); p.x = l.x; p.y = l.y; p.fy = floorAt("street", VAN.x, VAN.z) || 0; p.z = 0; p.gy = p.fy;
    // thugs + props in the way
    const spd = Math.hypot(VAN.vx, VAN.vz);
    for (const e of STATE.enemies) {
      if (e.vanCd > 0) { e.vanCd--; continue; }
      if (e.hp <= 0 || e.state === "dying" || e.gone || (e.z || 0) > 20) continue;
      const g = entPos(STATE.zone, e, {}), dx = g.gx - VAN.x, dz = g.gz - VAN.z, a = dx * nfx + dz * nfz, b = dx * nrx + dz * nrz;
      if (Math.abs(a) > VAN.L / 2 + 0.45 || Math.abs(b) > VAN.Wd / 2 + 0.45 || spd < 2.5) continue;
      const wx = Math.sign(a) >= 0 ? nfx : -nfx, wz = Math.sign(a) >= 0 ? nfz : -nfz, du = (Math.abs(b) > VAN.Wd / 2 ? nrx * Math.sign(b) : wx) * STATE.zone.u[0] + (Math.abs(b) > VAN.Wd / 2 ? nrz * Math.sign(b) : wz) * STATE.zone.u[1];
      const boss = !!edef(e).boss || e.type === "ramrod" || e.type === "zap";
      if (e.idle || e.home) engage(e);
      hitEnemy(e, boss ? 2 : Math.min(e.hp, 3 + Math.round(spd / 4)), true, du >= 0 ? 1 : -1, 9, true);
      e.vanCd = 45; VAN.hits++; STATE.shake = Math.max(STATE.shake, 6); comicPop(g.gx, g.gy + 1.4, g.gz, ["THUD!", "WHUMP!", "BONK!"][VAN.hits % 3]);
      VAN.vx *= 0.88; VAN.vz *= 0.88;
    }
    for (const pr of STATE.props) {
      if (pr.state === "broken" || pr.state === "held" || spd < 2) continue;
      const g = entPos(STATE.zone, pr, {}), dx = g.gx - VAN.x, dz = g.gz - VAN.z, a = dx * nfx + dz * nfz, b = dx * nrx + dz * nrz;
      if (Math.abs(a) > VAN.L / 2 + 0.3 || Math.abs(b) > VAN.Wd / 2 + 0.3) continue;
      breakProp(pr, (nfx * STATE.zone.u[0] + nfz * STATE.zone.u[1]) >= 0 ? 1 : -1); VAN.props++;
    }
    vanPlace();
  }
  function fx_(l, kind) { STATE.fx.push({ kind, x: l.x, y: l.y - 4, t: 0, life: 18 }); }
  function vanFrame(dt) { // per render frame: wheels, lights, beams
    if (!VAN.mesh) return;
    const [fx, fz] = vanF();
    for (let i = 0; i < VAN.wheels.length; i++) { const w = VAN.wheels[i]; w.children[0].rotation.z = -VAN.wheel; w.children[1].rotation.z = -VAN.wheel; if (i < 2) w.rotation.y = -VAN.steer * 0.45; }
    const on = VAN.lights; VAN.spot.intensity = on ? 60 : 0; for (const b of VAN.beams) b.visible = on && DAY.lamp > 0.2;
    VAN.hlMat.color.setHex(on ? 0xfff6d0 : 0x555544); VAN.tlMat.color.setHex(VAN.on && VAN.sp < -0.3 ? 0xffffff : (VAN.on && (BTN_B.down || anyHeld("k", " ") || VAN.botHB)) || on ? 0xff2a1a : 0x661010);
    VAN.mesh.position.y = VAN.on ? Math.abs(Math.sin(STATE.t * 0.9)) * 0.02 * Math.min(1, Math.abs(VAN.sp) / 4) : 0;
    VAN.mesh.rotation.x = VAN.on ? VAN.lat * 0.012 : 0; // body roll in the drift
    if (VAN.hornT > 0) VAN.hornT--;
  }
  const _vp = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 62 }, _vw = new THREE.Vector3(), _vl = new THREE.Vector3();
  function vanCamPose(dt) {
    const [fx, fz] = vanF(); const ax = VAN.sp < -1 ? -fx : fx, az = VAN.sp < -1 ? -fz : fz;
    if (!VAN.cdir) VAN.cdir = new THREE.Vector3(ax, 0, az);
    _vw.set(ax, 0, az); VAN.cdir.lerp(_vw, 1 - Math.exp(-dt * 2.6)).normalize();
    const back = 8.4 + Math.min(2.2, Math.abs(VAN.sp) * 0.1);
    _vw.set(VAN.x - VAN.cdir.x * back, 3.5, VAN.z - VAN.cdir.z * back);
    _vl.set(VAN.x + VAN.cdir.x * 5, 1.1, VAN.z + VAN.cdir.z * 5);
    if (!VAN.cinit) { _vp.pos.copy(_vw); _vp.look.copy(_vl); VAN.cinit = true; }
    _vp.pos.lerp(_vw, 1 - Math.exp(-dt * 5)); _vp.look.lerp(_vl, 1 - Math.exp(-dt * 7));
    _vp.fov = 60 + Math.min(12, Math.abs(VAN.sp) * 0.6);
    return _vp;
  }
  function drawVanHUD() {
    if (!VAN.on) { vanButton(false); return; }
    const kmh = Math.round(Math.abs(VAN.sp) * 3.6 * 0.62);
    const vy = 40; rect(W - 92, vy, 86, 24, "rgba(0,0,0,0.6)"); rect(W - 92, vy, 86, 1, "#ffd23a");
    ptext(String(kmh).padStart(3, " ") + " MPH", W - 10, vy + 5, 2, "#ffe060", "right");
    ptext((VAN.lights ? "LIGHTS ON" : "LIGHTS OFF") + (VAN.driftT > 10 ? "  DRIFT" : ""), W - 10, vy + 18, 1, VAN.driftT > 10 ? "#7fe0ff" : "#c8ccd6", "right");
    vanButton(STATE.showTouch);
  }
  function vanButton(on) {
    const scr = document.getElementById("screen"); if (!scr) return;
    if (!VAN.btn) {
      const b = document.createElement("div"); b.className = "ss-tb ss-tb-s"; b.textContent = "LIGHTS"; b.setAttribute("role", "button"); b.setAttribute("aria-label", "Headlights");
      b.addEventListener("pointerdown", (ev) => { ev.preventDefault(); ev.stopPropagation(); VAN.tbHit = true; b.classList.add("on"); STATE.showTouch = true; });
      const up = (ev) => { ev.stopPropagation(); b.classList.remove("on"); }; b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
      scr.appendChild(b); VAN.btn = b;
    }
    const v = on ? "flex" : "none"; if (VAN.btn.style.display !== v) VAN.btn.style.display = v;
  }
