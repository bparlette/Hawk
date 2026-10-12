  // =====================================================================================================
  // ---------- SKATEBOARD (new): a board waits by the block-1 ladder in the sewer. In tunnels A and B the hero can ride it:
  // momentum (push / carve / friction), the curved coves work like a half-pipe (ride partway up, gravity pulls you back),
  // two fun-boxes give air, tricks in the air (ATTACK = kickflip, JUMP = 360), land too tilted or mid-trick and you bail.
  // Physics runs in world metres on skateSurf() (world.js); the 2D combat frame (p.x / p.y / p.z) is derived from it, so
  // slashes from the board and enemy hits keep using the reused 16-bit combat code.
  // =====================================================================================================
  const BOARD_SPOT = { x: 37.6, z: 0.9 };
  const SKC = { G: 9.8, ACC: 5.2, VMAX_PUSH: 7.2, VMAX: 11, TURN: 2.9, FRIC: 0.16, OLLIE: 3.7, FLIP_T: 0.36, SPIN_T: 0.5 };
  function makeBoard() {
    const g = new THREE.Group();
    const grip = canvasTex(128, 32, (c, w, h) => { c.fillStyle = "#1a1a1e"; c.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; c.fillRect(Math.random() * w, Math.random() * h, 1, 1); } c.fillStyle = "#3a3a42"; c.fillRect(10, 4, 6, h - 8); c.fillRect(w - 16, 4, 6, h - 8); });
    const art = canvasTex(128, 32, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#ff5a2a"); gr.addColorStop(0.5, "#ffd23a"); gr.addColorStop(1, "#3fe07a"); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.font = "bold italic 20px Impact, Arial Black, Arial"; c.textAlign = "center"; c.fillStyle = "#111"; c.fillText("SEWERSIDE", w / 2, 23); });
    const wood = new THREE.MeshLambertMaterial({ color: 0xb07a40 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.035, 0.22), [wood, wood, new THREE.MeshLambertMaterial({ map: grip }), new THREE.MeshLambertMaterial({ map: art }), wood, wood]);
    deck.position.y = 0.075; g.add(deck);
    for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.2), wood); tip.position.set(s * 0.45, 0.095, 0); tip.rotation.z = s * 0.35; g.add(tip); }
    const truckM = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 }), wheelM = new THREE.MeshLambertMaterial({ color: 0xf2e8c8, emissive: 0x2a2620 });
    for (const x of [-0.27, 0.27]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.2), truckM); t.position.set(x, 0.045, 0); g.add(t);
      for (const z of [-0.09, 0.09]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.035, 10), wheelM); w.rotation.x = Math.PI / 2; w.position.set(x, 0.035, z); g.add(w); }
    }
    return g;
  }
  let SKB = null; // the ridden board mesh (lazy)
  const skAllowedZone = (z) => z && (z.id === "sewerA" || z.id === "sewerB");
  function skHint(id, a, b) { STATE.hintsSeen = STATE.hintsSeen || {}; if (STATE.hintsSeen[id]) return; STATE.hintsSeen[id] = true; (STATE.hintQ || (STATE.hintQ = [])).push({ a, b, id }); skHintShow(); }
  const btnName = (k) => (STATE.showTouch ? { a: "ATTACK", b: "JUMP", p: "SPECIAL", c: "COUNTER", k: "BOARD" } : { a: "J", b: "K", p: "L", c: "C", k: "B" })[k];
  function pickupBoard(p) {
    const it = STATE.near; if (it) it.taken = true;
    STATE.hasBoard = true; if (WORLD.boardProp) WORLD.boardProp.visible = false; if (WORLD.boardRing) WORLD.boardRing.visible = false;
    SFX.pickup(); playerBark(true, "RADICAL WHEELS!");
    skateOn(p);
    skHint("board", "SKATEBOARD!  " + btnName("k") + ": HOP ON / OFF", "STICK: PUSH + CARVE - CARVE INTO THE CURVED WALLS - " + btnName("b") + ": OLLIE");
  }
  function skateOn(p) {
    if (!STATE.hasBoard || !skAllowedZone(STATE.zone) || p.layer !== "sewer" || p.climb || p.grabbedBy || p.deadT > 0 || p.downT > 0 || p.hurtT > 0 || p.z > 0) return false;
    const s = skateSurf(p.gx, p.gz); if (!s || s.lim) return false;
    const dir = p.facing * (CAM.uDot >= 0 ? 1 : -1), u = STATE.zone.u;
    p.sk = { on: true, x: p.gx, y: s.y, z: p.gz, vx: u[0] * dir * 0.8, vy: 0, vz: u[1] * dir * 0.8, air: false, n: [0, 1, 0], up: [0, 1, 0], hx: u[0] * dir, hz: u[1] * dir,
      flip: 0, flipOn: false, spin: 0, spinOn: false, tricks: [], airT: 0, bailT: 0, pushT: 0, total: (p.sk && p.sk.total) || 0, last: null, wish: null, maxH: 0 };
    p.attackT = 0; p.atk = null; p.walkT = 0; SFX.land();
    return true;
  }
  function skateOff(p, why) {
    const S = p.sk; if (!S || !S.on) return;
    S.on = false; p.walkT = 0;
    if (p.layer === "sewer" && STATE.zone && !STATE.zone.lair) { // step off onto walkable floor inside the zone
      const z = STATE.zone, R = z.rects[0]; let gx = clamp(S.x, R[0] + 0.05, R[2] - 0.05), gz = clamp(S.z, R[1] + 0.05, R[3] - 0.05);
      if (floorAt("sewer", gx, gz) === null) { gx = p.gx; gz = p.gz; }
      p.gx = gx; p.gz = gz; const l = toLocal(z, gx, gz); p.x = l.x; p.y = l.y;
      const f = floorAt("sewer", gx, gz); p.fy = f === null ? WORLD.SY : f; p.z = Math.max(0, (S.y - p.fy) / ZH); p.vz = 0; p.gy = p.fy + p.z * ZH;
    }
    if (why === "hit") { fx("dust", p.x, p.y, 14); }
  }
  // input while on the board (replaces the on-foot branch): ollie / tricks / slash, and the stick wish for skateMove
  function skateInput(p, aP, bP, kP) {
    const S = p.sk;
    if (kP && !S.air && S.bailT === 0) { skateOff(p); SFX.land(); return; }
    const v = inputVec(); S.wish = null;
    if (v) { const w = stickToWorld(v.dx, v.dy); S.wish = { x: w.x, z: w.z, mag: v.mag }; }
    if (S.bailT > 0) { IBUF.a = IBUF.b = 0; return; }
    if (bP) {
      IBUF.b = 0;
      if (!S.air) { S.vx += S.n[0] * SKC.OLLIE; S.vy += S.n[1] * SKC.OLLIE; S.vz += S.n[2] * SKC.OLLIE; S.air = true; S.airT = 0; S.up = S.n.slice(); S.y += 0.02; SFX.jump(); dust(p.x, p.y);
        skHint("air", "IN THE AIR: " + btnName("a") + " = KICKFLIP   " + btnName("b") + " = 360 SPIN", "LAND FLAT AND FINISH THE TRICK - OR BAIL!"); }
      else if (!S.spinOn) { S.spinOn = true; S.spin = 0; SFX.swing(); }
    }
    if (aP) {
      IBUF.a = 0;
      if (S.air) { if (!S.flipOn) { S.flipOn = true; S.flip = 0; SFX.swing(); } }
      else if (p.attackT === 0) { autoFace(p); swingCombo(p); } // slash on the move
    }
  }
  function skNormal(x, z, out) { // surface normal; at a kink (ramp lip, fun-box edge) use the continuous side, never a slope across the drop
    const e = 0.04, m = skateSurf(x, z), yc = m ? m.y : 0;
    const sl = (A, B) => {
      const df = A && !A.lim ? A.y - yc : null, db = B && !B.lim ? yc - B.y : null;
      if (df === null && db === null) return 0; if (df === null) return db / e; if (db === null) return df / e;
      return Math.abs(df - db) > 0.05 ? (Math.abs(df) < Math.abs(db) ? df : db) / e : (df + db) / (2 * e);
    };
    const hx = sl(skateSurf(x + e, z), skateSurf(x - e, z)), hz = sl(skateSurf(x, z + e), skateSurf(x, z - e));
    const l = Math.hypot(hx, 1, hz); out[0] = -hx / l; out[1] = 1 / l; out[2] = -hz / l; return out;
  }
  const _n2 = [0, 1, 0];
  function skLand(p, S, s) {
    skNormal(S.x, S.z, _n2);
    const ang = Math.acos(clamp(S.up[0] * _n2[0] + S.up[1] * _n2[1] + S.up[2] * _n2[2], -1, 1));
    const flipLeft = S.flipOn ? Math.PI * 2 - S.flip : 0, spinLeft = S.spinOn ? Math.PI * 2 - S.spin : 0;
    S.y = s.y; S.air = false;
    const vn = S.vx * _n2[0] + S.vy * _n2[1] + S.vz * _n2[2]; if (vn < 0) { S.vx -= _n2[0] * vn; S.vy -= _n2[1] * vn; S.vz -= _n2[2] * vn; }
    S.n = _n2.slice();
    const bad = ang > 0.7 || flipLeft > 0.7 || spinLeft > 0.7;
    if (bad) { // bail: stumble off, board skids, no damage
      S.bailT = 50; S.vx *= 0.25; S.vy *= 0.25; S.vz *= 0.25; S.flipOn = S.spinOn = false; S.flip = S.spin = 0; S.tricks = [];
      SFX.hurt(); STATE.shake = Math.max(STATE.shake, 6); fx("dust", p.x, p.y, 16); STATE.skStat.bails++;
      popText("BAIL!", p.gx, p.gy + 1.9, p.gz, "#ff5a3a");
      skHint("bail", "BAILED!", "LAND WITH THE BOARD FLAT TO THE GROUND AND THE TRICK DONE");
    } else {
      if (S.flipOn || S.spinOn) { if (flipLeft < 0.7 && S.flipOn) S.tricks.push("KICKFLIP"); if (spinLeft < 0.7 && S.spinOn) S.tricks.push("360"); }
      S.flipOn = S.spinOn = false; S.flip = S.spin = 0;
      if (S.tricks.length) {
        const pts = S.tricks.reduce((a, t) => a + (t === "KICKFLIP" ? 300 : 500), 0) * S.tricks.length + (S.airT > 0.6 ? 100 : 0);
        const name = S.tricks.join(" + ");
        STATE.score += pts; S.total += pts; S.last = { name, pts, t: 150 }; STATE.skStat.tricks++;
        popText(name + " +" + pts, p.gx, p.gy + 2.0, p.gz, "#7fff6a"); SFX.pickup();
      }
      S.tricks = []; SFX.land(); dust(p.x, p.y);
    }
  }
  function skBlock(S, ox, oy, oz) { // hit a wall / the cove lip / a fun-box side: slide along whatever axis is free
    const sx = skateSurf(S.x, oz), sz = skateSurf(ox, S.z);
    const okX = sx && !sx.lim && sx.y <= oy + 0.25, okZ = sz && !sz.lim && sz.y <= oy + 0.25;
    if (okX && Math.abs(S.vx) >= Math.abs(S.vz) * 0.2) { S.z = oz; S.vz = -S.vz * 0.15; S.vy = Math.min(S.vy, 0); return sx; }
    if (okZ) { S.x = ox; S.vx = -S.vx * 0.15; S.vy = Math.min(S.vy, 0); return sz; }
    S.x = ox; S.z = oz; S.vx *= -0.2; S.vz *= -0.2; S.vy = Math.min(S.vy, 0); return skateSurf(ox, oz);
  }
  function skateMove(p) {
    const S = p.sk, dt = 1 / 60, N = 3, h = dt / N;
    STATE.skStat = STATE.skStat || { maxWall: 0, air: 0, tricks: 0, bails: 0 };
    // drive: push / carve / brake (on the ground only)
    const vh = Math.hypot(S.vx, S.vz);
    p.walkT = 0;
    if (S.bailT > 0) { S.bailT--; S.vx *= 0.9; S.vz *= 0.9; }
    else if (!S.air && S.wish) {
      const W = S.wish;
      if (vh < 0.5) { S.vx += W.x * SKC.ACC * W.mag * dt; S.vz += W.z * SKC.ACC * W.mag * dt; S.pushT++; }
      else {
        const hx = S.vx / vh, hz = S.vz / vh, dot = hx * W.x + hz * W.z, cr = hx * W.z - hz * W.x;
        if (dot < -0.6) { const k = Math.max(0, 1 - 2.6 * dt); S.vx *= k; S.vz *= k; S.pushT = 0; }
        else {
          const tr = clamp(Math.atan2(cr, dot), -SKC.TURN * W.mag * dt, SKC.TURN * W.mag * dt), c = Math.cos(tr), s = Math.sin(tr);
          const nx = S.vx * c - S.vz * s, nz = S.vx * s + S.vz * c; S.vx = nx; S.vz = nz;
          if (dot > 0.35 && vh < SKC.VMAX_PUSH && S.n[1] > 0.9) { S.vx += hx * SKC.ACC * W.mag * dt; S.vz += hz * SKC.ACC * W.mag * dt; S.pushT++; } else S.pushT = 0;
        }
      }
    } else S.pushT = 0;
    if (S.pushT > 0) p.walkT = S.pushT;
    if (!S.air) { const k = Math.max(0, 1 - SKC.FRIC * dt - (S.wish ? 0 : 0.12 * dt)); S.vx *= k; S.vz *= k; S.vy *= k; }
    const sp = Math.hypot(S.vx, S.vy, S.vz); if (sp > SKC.VMAX) { const k = SKC.VMAX / sp; S.vx *= k; S.vy *= k; S.vz *= k; }
    for (let i = 0; i < N; i++) {
      const ox = S.x, oy = S.y, oz = S.z;
      if (S.air) {
        S.vy -= SKC.G * h; S.x += S.vx * h; S.y += S.vy * h; S.z += S.vz * h; S.airT += h;
        let s = skateSurf(S.x, S.z);
        if (!s || s.lim || s.y > oy + 0.25) s = skBlock(S, ox, oy, oz);
        if (s && S.y <= s.y) skLand(p, S, s);
        continue;
      }
      const n = S.n, gn = -SKC.G * n[1]; // gravity along the slope
      S.vx += (0 - n[0] * gn) * h; S.vy += (-SKC.G - n[1] * gn) * h; S.vz += (0 - n[2] * gn) * h;
      const spd = Math.hypot(S.vx, S.vy, S.vz);
      S.x += S.vx * h; S.z += S.vz * h; const yb = S.y + S.vy * h;
      let s = skateSurf(S.x, S.z);
      if (!s || s.lim || s.y > oy + 0.25) { const wasLim = s && s.lim; s = skBlock(S, ox, oy, oz); if (wasLim) { S.vy = Math.min(S.vy, 0); } if (!s) { S.x = ox; S.z = oz; s = skateSurf(ox, oz) || { y: oy }; } }
      if (yb > s.y + 0.002 && S.vy > 0.5) { S.air = true; S.y = yb; S.airT = 0; S.up = S.n.slice(); continue; } // the ground fell away (fun-box lip): air
      S.y = s.y; skNormal(S.x, S.z, S.n);
      const vn = S.vx * S.n[0] + S.vy * S.n[1] + S.vz * S.n[2]; S.vx -= S.n[0] * vn; S.vy -= S.n[1] * vn; S.vz -= S.n[2] * vn;
      const sp2 = Math.hypot(S.vx, S.vy, S.vz); if (sp2 > 1e-4) { const k = spd / sp2; S.vx *= k; S.vy *= k; S.vz *= k; }
    }
    // tricks spin up in the air; the rider straightens out
    if (S.air) {
      if (S.flipOn) S.flip = Math.min(Math.PI * 2, S.flip + dt * Math.PI * 2 / SKC.FLIP_T);
      if (S.spinOn) S.spin = Math.min(Math.PI * 2, S.spin + dt * Math.PI * 2 / SKC.SPIN_T);
      const k = Math.min(1, dt * 2.2); S.up[0] -= S.up[0] * k; S.up[1] += (1 - S.up[1]) * k; S.up[2] -= S.up[2] * k; const l = Math.hypot(S.up[0], S.up[1], S.up[2]); S.up[0] /= l; S.up[1] /= l; S.up[2] /= l;
      if (S.flipOn && S.flip >= Math.PI * 2) { S.tricks.push("KICKFLIP"); S.flipOn = false; S.flip = 0; }
      if (S.spinOn && S.spin >= Math.PI * 2) { S.tricks.push("360"); S.spinOn = false; S.spin = 0; }
      STATE.skStat.air = Math.max(STATE.skStat.air, S.airT);
    }
    const vh2 = Math.hypot(S.vx, S.vz); if (vh2 > 0.3) { S.hx = S.vx / vh2; S.hz = S.vz / vh2; }
    // back into the 2D combat frame + the 3D player position
    const s0 = skateSurf(S.x, S.z), fy = s0 ? s0.y : S.y;
    const wall = s0 ? s0.y - (floorAt("sewer", clamp(S.x, 20.5, 164.6), clamp(S.z, -2.7, 2.55)) ?? s0.y) : 0;
    if (!S.air && S.n[1] < 0.97) STATE.skStat.maxWall = Math.max(STATE.skStat.maxWall, s0 ? s0.y - WORLD.SY : 0);
    p.gx = S.x; p.gz = S.z; p.fy = Math.min(fy, S.y); p.gy = S.y; p.z = S.air ? Math.max(0, (S.y - fy) / ZH) : 0; p.vz = 0;
    let nz = zoneAtG("sewer", S.x, S.z);
    if (!nz) for (const z of WORLD.zones) if (z.layer === "sewer" && !z.lair) for (const r of z.rects) if (S.x >= r[0] - 0.5 && S.x <= r[2] + 0.5 && S.z >= r[1] - 0.5 && S.z <= r[3] + 0.5) { nz = z; break; }
    if (nz && nz !== STATE.zone) setZone(nz);
    const l = toLocal(STATE.zone, S.x, S.z); p.x = l.x; p.y = l.y;
    const du = S.vx * STATE.zone.u[0] + S.vz * STATE.zone.u[1]; if (Math.abs(du) > 0.4 && p.attackT === 0) p.facing = du > 0 ? 1 : -1;
    if (STATE.zone.lair) { skateOff(p); banner("BOARD OFF", "NO SKATING IN THE LIVING ROOM", "#ffd08a"); }
    if (S.on && !S.air && S.n[1] < 0.8) skHint("wall", "RIDING THE WALL!", "CARVE IN WITH SPEED - GRAVITY BRINGS YOU BACK DOWN");
    return wall;
  }
  // ---- the board under the hero + the hero's lean ----
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _vA = new THREE.Vector3(), _vB = new THREE.Vector3(), _vC = new THREE.Vector3();
  function drawBoard3D() {
    const p = STATE.player, S = p && p.sk;
    if (!SKB) { SKB = makeBoard(); SKB.visible = false; scene.add(SKB); }
    const on = !!(S && S.on && p.layer === "sewer" && STATE.scene !== "title");
    SKB.visible = on; if (!on) return;
    const up = S.air ? S.up : S.n;
    _vB.set(up[0], up[1], up[2]); _vA.set(S.hx, 0, S.hz); _vA.addScaledVector(_vB, -_vA.dot(_vB)).normalize(); _vC.crossVectors(_vA, _vB);
    _m4.makeBasis(_vA, _vB, _vC); SKB.quaternion.setFromRotationMatrix(_m4);
    if (S.spin) { _q1.setFromAxisAngle(_vB.set(0, 1, 0), S.spin); SKB.quaternion.multiply(_q1); }
    if (S.flip) { _q2.setFromAxisAngle(_vA.set(1, 0, 0), S.flip); SKB.quaternion.multiply(_q2); }
    if (S.bailT > 0) { SKB.position.set(S.x + S.hx * (1 - S.bailT / 50) * 1.2, S.y, S.z + S.hz * (1 - S.bailT / 50) * 1.2); _q1.setFromAxisAngle(_vA.set(1, 0, 0), S.bailT * 0.25); SKB.quaternion.multiply(_q1); }
    else SKB.position.set(S.x, S.y - (S.air ? 0 : 0.02), S.z);
  }
  function heroLean(b) { // tilt the hero's billboard with the board (screen-space roll from the board's up vector) and fake the 360
    const p = STATE.player, S = p && p.sk; if (!S || !S.on) return;
    const up = S.air ? S.up : S.n, m = camera.matrixWorld.elements;
    const r = up[0] * m[0] + up[1] * m[1] + up[2] * m[2], u = up[0] * m[4] + up[1] * m[5] + up[2] * m[6];
    b.mesh.rotation.z = clamp(-Math.atan2(r, u), -0.85, 0.85);
    if (S.spin) { const c = Math.cos(S.spin); b.mesh.scale.x *= Math.max(0.12, Math.abs(c)); if (c < 0) b.mat.uniforms.flip.value = 1 - b.mat.uniforms.flip.value; }
  }
