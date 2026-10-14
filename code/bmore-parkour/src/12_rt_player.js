
// =====================================================================================================================================
// 12_rt_player: the runner controller. Momentum running, jump (coyote + buffer), auto vault / mantle / ledge grab, wall run (auto when
// you meet a wall side-on in the air), vertical wall climb (jump into a wall), ladders, slide, landing roll (slide in the air), hard
// landings, zip lines. Collides with RK's solids (Toad City buildings + course props).
// =====================================================================================================================================
const PL = (function () {
  const R = 0.32, HS = 1.75, HSL = 0.85, G = 21, STEP = 0.75, JV = 7.1;
  const P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, st: 'idle', t: 0, mom: 0, coyote: 0, jumpBuf: 0, rollBuf: 0, peak: 0,
    wall: null, wrDir: null, wrSide: 1, wrSp: 0, wrCool: 0, wrBox: null, climbUsed: false, wjT: 0, wjN: null, zip: null, zipT: 0, zipSp: 0, zipCool: 0,
    man: null, lad: null, stepY: 0, ph: 0, height: HS, course: null, onEvent: () => {}, dead: null, lastJumpT: 9, steps: 0, airT: 0 };
  const _c = { nx: 0, nz: 0 };
  const hs = () => Math.hypot(P.vel.x, P.vel.z);
  const TR = (k) => { (P.trace || (P.trace = [])).push(k + '@' + P.pos.x.toFixed(1) + ',' + P.pos.y.toFixed(2) + ',' + P.pos.z.toFixed(1)); if (P.trace.length > 14) P.trace.shift(); };
  function set(st) { if (P.st !== st) { P.st = st; P.t = 0; TR(st); } }
  function reset(x, y, z, yaw, sp = 0) {
    P.pos.set(x, y, z); P.yaw = yaw; P.vel.set(Math.sin(yaw) * sp, 0, Math.cos(yaw) * sp); P.st = 'run'; P.t = 0; P.mom = sp > 6 ? 0.4 : 0; P.coyote = 0; P.jumpBuf = 0; P.rollBuf = 0;
    P.peak = y; P.zip = null; P.man = null; P.lad = null; P.wrCool = 0; P.zipCool = 0.3; P.dead = null; P.climbUsed = false; P.height = HS; P.airT = 0; }
  // ---- horizontal collision: push the runner's circle out of every box that overlaps its body span; returns the contacts
  function collideH(step, height) {
    const out = []; const x = P.pos.x, z = P.pos.z, fy = P.pos.y;
    RK.boxesNear(x, z, (s) => {
      if (s.y1 <= fy + step || s.y0 >= fy + height - 0.02) return;
      const cx = clamp(P.pos.x, s.x0, s.x1), cz = clamp(P.pos.z, s.z0, s.z1); let dx = P.pos.x - cx, dz = P.pos.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) return;
      let nx, nz, push;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; push = R - d; }
      else { const pen = [[P.pos.x - s.x0, -1, 0], [s.x1 - P.pos.x, 1, 0], [P.pos.z - s.z0, 0, -1], [s.z1 - P.pos.z, 0, 1]].sort((a, b) => a[0] - b[0])[0]; nx = pen[1]; nz = pen[2]; push = pen[0] + R; }
      P.pos.x += nx * push; P.pos.z += nz * push; out.push({ s, nx, nz, top: s.y1 });
    });
    // a wall's real top is the top of whatever is stacked on it at the grab point (a roof slab under its parapet): mantle onto that, never into it
    for (const c of out) { const gx = P.pos.x - c.nx * 0.6, gz = P.pos.z - c.nz * 0.6;
      for (let k = 0, ch = true; ch && k < 4; k++) { ch = false; RK.boxesNear(gx, gz, (s) => { if (s.y0 <= c.top + 0.05 && s.y1 > c.top + 0.01 && gx > s.x0 - R * 0.5 && gx < s.x1 + R * 0.5 && gz > s.z0 - R * 0.5 && gz < s.z1 + R * 0.5) { c.top = s.y1; ch = true; } }); } }
    return out;
  }
  function ceilingAt(x, z, y0, y1) { let hit = null; RK.boxesNear(x, z, (s) => { if (s.y0 > y0 && s.y0 < y1 && x > s.x0 - R + 0.06 && x < s.x1 + R - 0.06 && z > s.z0 - R + 0.06 && z < s.z1 + R - 0.06) { if (!hit || s.y0 < hit) hit = s.y0; } }); return hit; }
  function roomAt(x, z, y) { return ceilingAt(x, z, y + 0.02, y + HS) === null && !boxAt(x, z, y + 0.05, y + HS); }
  function boxAt(x, z, y0, y1) { let h = false; RK.boxesNear(x, z, (s) => { if (s.y1 > y0 && s.y0 < y1 && x > s.x0 - R * 0.8 && x < s.x1 + R * 0.8 && z > s.z0 - R * 0.8 && z < s.z1 + R * 0.8) h = true; }); return h; }
  const thick = (s, nx, nz) => (Math.abs(nx) > Math.abs(nz) ? s.x1 - s.x0 : s.z1 - s.z0);
  function startMantle(c, quick) {
    const tx = P.pos.x - c.nx * (quick ? 0.55 : 0.6), tz = P.pos.z - c.nz * (quick ? 0.55 : 0.6);
    P.man = { ax: P.pos.x, ay: P.pos.y, az: P.pos.z, tx, ty: c.top, tz, dur: quick ? 0.24 : 0.5, sp: Math.max(hs() * 0.55, 4.2), nx: -c.nx, nz: -c.nz, quick };
    P.vel.set(0, 0, 0); TR('man>' + c.top.toFixed(2) + '/' + ((c.s && c.s.k) || '?')); set('mantle'); P.onEvent(quick ? 'mantleq' : 'mantle');
  }
  function startVault(c, sp, land) {
    const th = thick(c.s, c.nx, c.nz), d = th + R * 2 + 0.25, ex = P.pos.x - c.nx * d, ez = P.pos.z - c.nz * d;
    P.man = { ax: P.pos.x, ay: P.pos.y, az: P.pos.z, tx: ex, ty: land === undefined ? P.pos.y : land, tz: ez, top: c.top, dur: clamp(d / Math.max(sp, 6) + 0.12, 0.28, 0.42), sp: Math.max(sp, 6.4), nx: -c.nx, nz: -c.nz };
    set('vault'); P.onEvent('vault');
  }
  // ---- the per-frame update. IN: { wx, wz (wish dir in world, |w| <= 1), jumpP, jumpH, slideP, slideH }
  function update(dt, IN) {
    if (P.dead || P.st === 'fin' || P.st === 'busted') { P.t += dt; return; }
    P.t += dt; P.wrCool -= dt; P.zipCool -= dt; P.wjT -= dt; P.lastJumpT += dt;
    if (IN.jumpP) P.jumpBuf = 0.16; else P.jumpBuf -= dt;
    if (IN.slideP) P.rollBuf = 0.5; else P.rollBuf -= dt;
    const wl = Math.hypot(IN.wx, IN.wz), wx = IN.wx, wz = IN.wz;
    switch (P.st) {
      case 'mantle': case 'vault': return doMantle(dt);
      case 'zip': return doZip(dt, IN);
      case 'ladder': return doLadder(dt, IN);
      case 'wallrun': return doWallrun(dt, IN);
      case 'climb': return doClimb(dt, IN);
    }
    const grounded = P.st === 'run' || P.st === 'slide' || P.st === 'roll' || P.st === 'stun' || P.st === 'idle';
    // ---------- zip lines + ladders grab first
    if (P.zipCool <= 0 && tryZip()) return;
    if (tryLadder(wx, wz)) return;
    let sp = hs();
    if (grounded) {
      // speed + momentum (flow): holding a straight line at speed builds it, stopping / walls / hard landings bleed it
      if (P.st === 'run' || P.st === 'idle') {
        const vmax = 7.0 + 3.3 * P.mom, tx = wx * vmax, tz = wz * vmax;
        const rate = wl > 0.1 ? (sp > 6 ? 5.0 : 8.0) : 9.0;
        P.vel.x = damp(P.vel.x, tx, rate, dt); P.vel.z = damp(P.vel.z, tz, rate, dt); sp = hs();
        if (sp > 6.6 && wl > 0.7) P.mom = Math.min(1, P.mom + dt / 2.4); else if (sp < 4) P.mom = Math.max(0, P.mom - dt / 0.7);
        set(sp > 0.4 ? 'run' : 'idle');
        if (P.jumpBuf > 0) return jump();
        if (P.rollBuf > 0.42 && sp > 3.5) { set('slide'); P.rollBuf = 0; P.vel.multiplyScalar(Math.min(1.12, 11 / Math.max(sp, 1))); P.onEvent('slide'); }
      } else if (P.st === 'slide') {
        const k = Math.exp(-0.55 * dt); P.vel.x *= k; P.vel.z *= k; sp = hs();
        if (wl > 0.1 && sp > 0.5) { const a = Math.atan2(P.vel.x, P.vel.z), b = Math.atan2(wx, wz), na = a + clamp(angTo(a, b), -1.6 * dt, 1.6 * dt); P.vel.x = Math.sin(na) * sp; P.vel.z = Math.cos(na) * sp; }
        const ceil = ceilingAt(P.pos.x, P.pos.z, P.pos.y + HSL - 0.05, P.pos.y + HS);
        if (ceil !== null && sp < 3.2) { const a = Math.atan2(P.vel.x, P.vel.z); P.vel.x = Math.sin(a) * 3.2; P.vel.z = Math.cos(a) * 3.2; }
        if (P.jumpBuf > 0 && ceil === null) return jump();
        if ((P.t > 0.9 || sp < 2.2) && ceil === null) set('run');
      } else if (P.st === 'roll') { if (P.t > 0.48) set('run'); }
      else if (P.st === 'stun') { const k = Math.exp(-6 * dt); P.vel.x *= k; P.vel.z *= k; if (P.t > 0.5) set('run'); }
      P.height = P.st === 'slide' || P.st === 'roll' ? HSL : HS;
      // move + collide
      P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
      const cs = collideH(STEP, P.height);
      for (const c of cs) {
        const into = -(P.vel.x * c.nx + P.vel.z * c.nz), winto = -(wx * c.nx + wz * c.nz), rise = c.top - P.pos.y;
        if ((into > 2.2 || winto > 0.7) && rise <= 1.8 && (P.st === 'run' || P.st === 'roll' || P.st === 'idle')) {
          const th = thick(c.s, c.nx, c.nz), ex = P.pos.x - c.nx * (th + R * 2 + 0.25), ez = P.pos.z - c.nz * (th + R * 2 + 0.25);
          const land = RK.floorAt(ex, ez, c.top + 0.2).y;
          if (th <= 1.7 && sp > 2.6 && land > P.pos.y - 1.2 && land < P.pos.y + 0.3 && roomAt(ex, ez, land)) { startVault(c, sp, land); return; }
          if (roomAt(P.pos.x - c.nx * 0.55, P.pos.z - c.nz * 0.55, c.top)) { startMantle(c, rise < 1.2); return; }
        }
        // a wall: keep the tangential part (slide along it), bleed momentum on a head-on hit
        const vn = P.vel.x * c.nx + P.vel.z * c.nz; if (vn < 0) { P.vel.x -= vn * c.nx; P.vel.z -= vn * c.nz; if (-vn > 4) { P.mom *= 0.5; P.onEvent('bump'); } }
      }
      // floor: step up / walk off an edge
      const fl = RK.floorAt(P.pos.x, P.pos.z, P.pos.y + STEP, 0.2);
      if (fl.y < P.pos.y - 0.06) { set('air'); P.coyote = 0.14; P.peak = P.pos.y; P.vel.y = 0; P.airT = 0; }
      else { if (fl.y > P.pos.y + 0.02) P.stepY += fl.y - P.pos.y; P.pos.y = fl.y; P.vel.y = 0; P.climbUsed = false; }
      if (sp > 0.5) P.yaw += angTo(P.yaw, Math.atan2(P.vel.x, P.vel.z)) * Math.min(1, dt * 14);
      if (P.st === 'run') { const ph0 = P.ph; P.ph += dt * (6.2 + sp * 0.75); if (Math.floor(ph0 / Math.PI) !== Math.floor(P.ph / Math.PI)) P.onEvent('step'); }
    } else {
      // ---------- airborne
      P.airT += dt; P.coyote -= dt;
      if (P.jumpBuf > 0 && P.coyote > 0) return jump();
      if (P.jumpBuf > 0 && P.wjT > 0 && P.wjN) { // wall jump off a wall you just slid down
        P.vel.set(P.wjN.x * 6.2, JV, P.wjN.z * 6.2); P.yaw = Math.atan2(P.wjN.x, P.wjN.z); P.wjT = 0; P.jumpBuf = 0; P.climbUsed = false; P.peak = P.pos.y; P.onEvent('walljump'); return; }
      const cur = sp, cap = Math.max(cur, 5.5);
      if (wl > 0.1) { P.vel.x = damp(P.vel.x, wx * cap, 2.4, dt); P.vel.z = damp(P.vel.z, wz * cap, 2.4, dt); const n = hs(); if (n > cap) { P.vel.x *= cap / n; P.vel.z *= cap / n; } }
      P.vel.y -= G * (P.vel.y < 0 ? 1.12 : (IN.jumpH || P.lastJumpT > 0.25 ? 1 : 1.6)) * dt;
      if (P.vel.y < -38) P.vel.y = -38;
      const py = P.pos.y; P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; P.pos.y += P.vel.y * dt;
      if (P.vel.y > 0) { const c = ceilingAt(P.pos.x, P.pos.z, py + P.height - 0.05, P.pos.y + P.height + 0.02); if (c !== null) { P.pos.y = c - P.height - 0.02; P.vel.y = 0; } }
      P.peak = Math.max(P.peak, P.pos.y);
      // wall-run magnet: a billboard / wall just beside you, side-on, at speed
      if (P.wrCool <= 0 && tryWallrunMagnet()) return;
      const cs = collideH(0.3, P.height);
      for (const c of cs) {
        const vdx = P.vel.x, vdz = P.vel.z, n = Math.max(1e-3, Math.hypot(vdx, vdz)), into = -(vdx * c.nx + vdz * c.nz) / n, winto = wl > 0.1 ? -(wx * c.nx + wz * c.nz) / wl : 0, rise = c.top - P.pos.y;
        // ledge grab / mantle
        if (rise > 0.25 && rise <= 2.15 && (into > 0.35 || winto > 0.5) && roomAt(P.pos.x - c.nx * 0.6, P.pos.z - c.nz * 0.6, c.top)) { startMantle(c, rise < 1.05); return; }
        const tall = rise > 1.6 && c.s.y0 < P.pos.y + 0.6;
        // wall run: side-on contact at speed
        if (tall && Math.abs(into) < 0.62 && n > 4.5 && P.wrCool <= 0 && c.s !== P.wrBox) { startWallrun(c, n); return; }
        // wall climb: jump into a wall head-on (or hit it within a beat of jumping)
        if (rise > 2.15 && (into > 0.62 || winto > 0.7) && !P.climbUsed && (P.jumpBuf > 0 || P.lastJumpT < 0.45) && P.vel.y > -3) { startClimb(c); return; }
        const vn = P.vel.x * c.nx + P.vel.z * c.nz; if (vn < 0) { P.vel.x -= vn * c.nx * 1.0; P.vel.z -= vn * c.nz * 1.0; }
        if (into > 0.6 && tall) { P.wjT = 0.3; P.wjN = { x: c.nx, z: c.nz }; }
      }
      // landing
      if (P.vel.y <= 0) {
        const fl = RK.floorAt(P.pos.x, P.pos.z, py + 0.35, 0.2);
        if (P.pos.y <= fl.y) { P.pos.y = fl.y; land(P.peak - fl.y); }
      }
      if (P.vel.y < -1) P.yaw += angTo(P.yaw, Math.atan2(P.vel.x, P.vel.z)) * Math.min(1, dt * 3);
    }
    if (P.pos.y < 2.0 && !P.dead && !P.safe && !nearFin()) die('fell');
  }
  function jump() {
    const sp = hs(); P.vel.y = JV + (P.st === 'slide' ? 0.4 : 0); set('air'); P.jumpBuf = 0; P.coyote = 0; P.peak = P.pos.y; P.lastJumpT = 0; P.airT = 0;
    if (sp > 6) { P.vel.x *= 1.04; P.vel.z *= 1.04; } // a little carry: momentum rewards the take-off
    P.onEvent('jump');
  }
  function land(fall) {
    const sp = hs();
    if (fall > 27 && !P.safe) { die('splat'); return; }
    if (fall > 4.2 && P.rollBuf > 0) { set('roll'); P.rollBuf = 0; P.vel.y = 0; P.onEvent('roll'); const k = Math.max(sp, 6.5) / Math.max(sp, 0.01); P.vel.x *= k * 0.95; P.vel.z *= k * 0.95; }
    else if (fall > 6.5) { set('stun'); P.vel.multiplyScalar(0.25); P.vel.y = 0; P.mom = 0; P.onEvent('hardland'); }
    else { set(sp > 0.4 ? 'run' : 'idle'); P.vel.y = 0; P.onEvent(fall > 1.4 ? 'land' : 'landsoft'); if (fall > 3) P.mom *= 0.85; }
    P.climbUsed = false;
  }
  // the finish landmark sits at street level: dropping off the last zip next to it is the way in, not a fall
  function nearFin() { return !!(P.fin && Math.hypot(P.fin.x - P.pos.x, P.fin.z - P.pos.z) < 12); }
  function die(why) { TR('die:' + why); P.dead = why; P.onEvent('die:' + why); }
  // ---------- wall run
  function startWallrun(c, sp) {
    const tx = -c.nz, tz = c.nx; const s = Math.sign(P.vel.x * tx + P.vel.z * tz) || 1;
    P.wrDir = { x: tx * s, z: tz * s }; P.wall = c; P.wrBox = c.s; P.wrSp = clamp(sp, 8.2, 11); P.vel.y = clamp(P.vel.y * 0.4 + 2.2, 2.6, 3.4);
    // which side the wall is on (+1 = left of the run direction)
    P.wrSide = ((-c.nx) * P.wrDir.z - (-c.nz) * P.wrDir.x) > 0 ? 1 : -1; // cross(dir, toWall).y > 0: the wall is on the runner's left
    set('wallrun'); P.onEvent('wallrun');
  }
  function tryWallrunMagnet() {
    const sp = hs(); if (sp < 4.5) return false; let best = null;
    RK.boxesNear(P.pos.x, P.pos.z, (s) => {
      if (!s.wr || s === P.wrBox) return; if (s.y1 < P.pos.y + 1.4 || s.y0 > P.pos.y + 0.5) return;
      const cx = clamp(P.pos.x, s.x0, s.x1), cz = clamp(P.pos.z, s.z0, s.z1), dx = P.pos.x - cx, dz = P.pos.z - cz, d = Math.hypot(dx, dz);
      if (d < 0.05 || d > R + 0.95) return; const nx = dx / d, nz = dz / d; const along = Math.abs((P.vel.x * nx + P.vel.z * nz) / sp); if (along > 0.62) return;
      if (!best || d < best.d) best = { s, nx, nz, d, top: s.y1, cx, cz };
    });
    if (!best) return false;
    P.pos.x = best.cx + best.nx * (R + 0.04); P.pos.z = best.cz + best.nz * (R + 0.04); startWallrun(best, sp); return true;
  }
  function doWallrun(dt, IN) {
    const c = P.wall, s = c.s;
    P.pos.x += P.wrDir.x * P.wrSp * dt; P.pos.z += P.wrDir.z * P.wrSp * dt; P.vel.y -= 4.8 * dt; P.pos.y += P.vel.y * dt;
    // keep hugging the wall; does it still continue beside us?
    const cx = clamp(P.pos.x, s.x0, s.x1), cz = clamp(P.pos.z, s.z0, s.z1), dx = P.pos.x - cx, dz = P.pos.z - cz, d = Math.hypot(dx, dz);
    const onWall = d < R + 0.25 && d > 0.01 && P.pos.y + 1.0 < s.y1 && P.pos.y > s.y0 - 0.6;
    if (onWall) { P.pos.x = cx + (dx / d) * (R + 0.04); P.pos.z = cz + (dz / d) * (R + 0.04); }
    P.vel.x = P.wrDir.x * P.wrSp; P.vel.z = P.wrDir.z * P.wrSp; P.yaw += angTo(P.yaw, Math.atan2(P.wrDir.x, P.wrDir.z)) * Math.min(1, dt * 16);
    P.ph += dt * 15; if (Math.floor((P.ph - dt * 15) / Math.PI) !== Math.floor(P.ph / Math.PI)) P.onEvent('wrstep');
    if (P.jumpBuf > 0) { // leap off: forward + away from the wall
      P.vel.set(P.wrDir.x * P.wrSp * 0.97 + c.nx * 2.2, JV * 0.95, P.wrDir.z * P.wrSp * 0.97 + c.nz * 2.2); P.jumpBuf = 0; P.wrCool = 0.25; set('air'); P.peak = P.pos.y; P.lastJumpT = 0; P.onEvent('walljump'); return; }
    if (!onWall || P.t > 1.2) { P.vel.x += c.nx * 0.6; P.vel.z += c.nz * 0.6; P.wrCool = 0.3; set('air'); P.peak = P.pos.y; return; }
    if (P.vel.y < 0) { const fl = RK.floorAt(P.pos.x, P.pos.z, P.pos.y + 0.3, 0.2); if (P.pos.y <= fl.y) { P.pos.y = fl.y; P.wrBox = null; land(0); } }
    if (P.pos.y < 2.0 && !P.safe && !nearFin()) die('fell');
  }
  // ---------- vertical wall climb
  function startClimb(c) { P.wall = c; P.vel.set(0, 8.3, 0); P.climbUsed = true; set('climb'); P.yaw = Math.atan2(-c.nx, -c.nz); P.onEvent('climb'); }
  function doClimb(dt, IN) {
    const c = P.wall; P.vel.y -= 15 * dt; P.pos.y += P.vel.y * dt;
    const rise = c.top - P.pos.y;
    if (rise <= 2.1 && rise > 0 && roomAt(P.pos.x - c.nx * 0.6, P.pos.z - c.nz * 0.6, c.top)) { startMantle(c, false); return; }
    if (P.jumpBuf > 0 && P.t > 0.12) { P.vel.set(c.nx * 6.2, JV, c.nz * 6.2); P.yaw = Math.atan2(c.nx, c.nz); P.jumpBuf = 0; set('air'); P.peak = P.pos.y; P.onEvent('walljump'); return; }
    if (P.vel.y < -1.5) { set('air'); P.peak = P.pos.y; P.wjT = 0.35; P.wjN = { x: c.nx, z: c.nz }; P.vel.x = c.nx * 0.5; P.vel.z = c.nz * 0.5; }
  }
  // ---------- mantle / vault (scripted arcs)
  function doMantle(dt) {
    const m = P.man, u = clamp(P.t / m.dur, 0, 1);
    if (P.st === 'vault') { const e = u; P.pos.x = lerp(m.ax, m.tx, e); P.pos.z = lerp(m.az, m.tz, e); P.pos.y = lerp(m.ay, m.ty, e) + Math.sin(u * Math.PI) * (m.top - m.ay + 0.22); }
    else if (m.quick) { const e = ease(u); P.pos.y = lerp(m.ay, m.ty, Math.min(1, e * 1.4)); P.pos.x = lerp(m.ax, m.tx, e); P.pos.z = lerp(m.az, m.tz, e); }
    else { const up = clamp(u / 0.65, 0, 1), fw = clamp((u - 0.45) / 0.55, 0, 1); P.pos.y = lerp(m.ay, m.ty + 0.05, ease(up)); P.pos.x = lerp(m.ax, m.tx, ease(fw)); P.pos.z = lerp(m.az, m.tz, ease(fw)); }
    P.yaw += angTo(P.yaw, Math.atan2(m.nx, m.nz)) * Math.min(1, dt * 12);
    if (u >= 1) {
      const fl = RK.floorAt(P.pos.x, P.pos.z, P.pos.y + 0.6, 0.2); P.pos.y = Math.max(fl.y, Math.min(P.pos.y, fl.y + 0.01));
      P.vel.set(m.nx * m.sp, 0, m.nz * m.sp); set('run'); P.climbUsed = false;
      if (fl.y < P.pos.y - 0.05) { set('air'); P.peak = P.pos.y; P.coyote = 0.12; }
      P.onEvent('mantled');
    }
  }
  // ---------- zip lines
  function tryZip() {
    const C = P.course; if (!C) return false; const hy = P.pos.y + (P.st === 'slide' ? 1.0 : 1.9);
    for (const z of C.zips) {
      const vx = P.pos.x - z.A.x, vy = hy - z.A.y, vz = P.pos.z - z.A.z, t = (vx * z.dir.x + vy * z.dir.y + vz * z.dir.z) / z.len;
      if (t < 0 || t > 0.9) continue; const qx = z.A.x + z.dir.x * z.len * t, qy = z.A.y + z.dir.y * z.len * t, qz = z.A.z + z.dir.z * z.len * t;
      const d = Math.hypot(P.pos.x - qx, hy - qy, P.pos.z - qz); if (d > (P.st === 'air' ? 1.6 : 1.05)) continue;
      const along = P.vel.x * z.dir.x + P.vel.z * z.dir.z; if (along < -1) continue;
      P.zip = z; P.zipT = t; P.zipSp = Math.max(7.5, along); set('zip'); P.onEvent('zip'); return true;
    }
    return false;
  }
  function doZip(dt, IN) {
    const z = P.zip; const slope = -z.dir.y;
    P.zipSp = clamp(P.zipSp + (19 * slope - 0.6) * dt, 7, 17.5); P.zipT += P.zipSp * dt / z.len;
    const t = Math.min(P.zipT, 1); P.pos.set(z.A.x + z.dir.x * z.len * t, z.A.y + z.dir.y * z.len * t - 1.95, z.A.z + z.dir.z * z.len * t);
    P.vel.set(z.dir.x * P.zipSp, z.dir.y * P.zipSp, z.dir.z * P.zipSp); P.yaw += angTo(P.yaw, Math.atan2(z.dir.x, z.dir.z)) * Math.min(1, dt * 10);
    const off = P.zipT >= 0.985 || (P.jumpBuf > 0 && P.t > 0.25 && !z.fin);
    if (off) { const k = Math.hypot(z.dir.x, z.dir.z); P.vel.set(z.dir.x / k * P.zipSp * 0.85, P.jumpBuf > 0 ? 4.5 : 0.5, z.dir.z / k * P.zipSp * 0.85); P.zip = null; P.zipCool = 0.6; P.jumpBuf = 0; set('air'); P.peak = P.pos.y; P.onEvent('zipoff'); }
  }
  // ---------- ladders
  function tryLadder(wx, wz) {
    const C = P.course; if (!C) return false;
    for (const L of C.ladders) {
      const dx = P.pos.x - L.x, dz = P.pos.z - L.z, d = Math.hypot(dx, dz); if (d > 0.8) continue;
      if (P.pos.y < L.y0 - 0.6 || P.pos.y > L.y1 - 1.2) continue;
      const into = -(P.vel.x * L.nx + P.vel.z * L.nz), winto = -(wx * L.nx + wz * L.nz); if (into < 0.5 && winto < 0.4) continue;
      P.lad = L; P.vel.set(0, 0, 0); set('ladder'); P.yaw = Math.atan2(-L.nx, -L.nz); P.onEvent('ladder'); return true;
    }
    return false;
  }
  function doLadder(dt, IN) {
    const L = P.lad; P.pos.x = damp(P.pos.x, L.x + L.nx * (R + 0.1), 12, dt); P.pos.z = damp(P.pos.z, L.z + L.nz * (R + 0.1), 12, dt); P.pos.y += 5.2 * dt;
    if (P.t % 0.32 < dt) P.onEvent('rung');
    if (P.jumpBuf > 0 && P.t > 0.2) { P.vel.set(L.nx * 4.5, 5.5, L.nz * 4.5); P.jumpBuf = 0; set('air'); P.peak = P.pos.y; P.lad = null; return; }
    if (P.pos.y + 1.6 >= L.y1) { startMantle({ nx: L.nx, nz: L.nz, top: L.y1, s: null }, false); P.man.dur = 0.36; P.lad = null; }
  }
  // what the big context button means right now
  function context() {
    switch (P.st) { case 'zip': return 'LET GO'; case 'wallrun': return 'LEAP'; case 'climb': return 'CLIMB'; case 'ladder': return 'CLIMB'; case 'mantle': case 'vault': return 'VAULT'; }
    if (P.st === 'air') return P.wjT > 0 ? 'WALL JUMP' : 'JUMP';
    return 'JUMP';
  }
  return { P, R, HS, update, reset, set, context, hs };
})();
