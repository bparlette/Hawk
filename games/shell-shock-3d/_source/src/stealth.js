  // =====================================================================================================
  // ---------- ROOFTOP STEALTH (new): sentries with sweeping vision cones, crouch-walk (X / SHIFT / SNEAK), cover behind
  // chimneys, AC units and water-tower pump houses, a detection meter per sentry, and silent takedowns from behind.
  // A sentry that fills its meter (or gets hit) alerts its pack and the normal freeflow fight takes over. ----------
  // =====================================================================================================
  const STL = { det: 0, hid: false, td: 0, spotted: 0, cones: [], hide: [], hold: false, seenT: 0 };
  const SENTRY_LOOK = { "97,-20": 0.6, "101,-26": Math.PI, "94,-28": -0.4, "146,-19": Math.PI * 0.75 }; // initial look angle per post (world, radians)
  const roofStealth = () => STATE.zone && STATE.zone.layer === "roof";
  function buildStealth() {
    const G = WORLD.groups.roof;
    // chimneys: brick stacks with a cap (cover you can stand behind)
    const brickT = canvasTex(64, 128, (g, w, h) => { g.fillStyle = "#5a2e24"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < w; x += 16) { g.fillStyle = `rgb(${120 + (Math.random() * 40 | 0)},${52 + (Math.random() * 20 | 0)},${40 + (Math.random() * 14 | 0)})`; g.fillRect(x + 1, y + 1, 14, 6); } g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, 0, w, 10); }, true);
    const bm = new THREE.MeshLambertMaterial({ map: brickT }), capM = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    const chims = [[95, -21.5, 14], [100, -16.5, 14], [89.5, -24.5, 14], [104, -20.5, 14], [91.5, -14.5, 14], [117, -16, 12], [134, -30, 16], [142, -15.5, 16]];
    const cg = [], kg = [];
    for (const [x, z, y] of chims) {
      const b = new THREE.BoxGeometry(1.1, 1.8, 1.1); b.translate(x, y + 0.9, z); cg.push(b);
      const c = new THREE.BoxGeometry(1.35, 0.16, 1.35); c.translate(x, y + 1.88, z); kg.push(c);
      WORLD.cols.push({ box: [x - 0.55, z - 0.55, x + 0.55, z + 0.55], y }); STL.hide.push({ x, z, r: 0.72, h: 1.8, y });
    }
    G.add(new THREE.Mesh(mergeGeos(cg), bm)); G.add(new THREE.Mesh(mergeGeos(kg), capM));
    // pump houses under the walkable roofs' water towers (the barrels sit up on legs - this is the cover)
    const pm = new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = "#6a6e76"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#4a4e56"; for (let i = 4; i < 64; i += 10) g.fillRect(0, i, 64, 3); g.fillStyle = "#2a2e36"; g.fillRect(24, 26, 16, 38); }) });
    for (const [x, z, y] of [[96, -27, 14], [120, -29, 12], [146, -35.2, 16]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 2.0), pm); m.position.set(x, y + 0.75, z); G.add(m);
      WORLD.cols.push({ box: [x - 1.0, z - 1.0, x + 1.0, z + 1.0], y }); STL.hide.push({ x, z, r: 1.15, h: 1.5, y });
    }
    // the AC units already on the roofs are cover too (low: crouch behind them)
    for (const c of WORLD.cols) if (c.box && c.y !== undefined && c.box[2] - c.box[0] < 2 && c.box[2] - c.box[0] > 1.7) STL.hide.push({ x: (c.box[0] + c.box[2]) / 2, z: (c.box[1] + c.box[3]) / 2, r: 0.85, h: 1.1, y: c.y });
    // vision cones: a fan on the roof floor, alpha fading out with distance
    const fanT = canvasTex(128, 4, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.75, "rgba(255,255,255,0.5)"); gr.addColorStop(0.97, "rgba(255,255,255,0.75)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const N = 14, A = 0.72, P = [0, 0, 0], U = [0, 0.5], I = [];
    for (let i = 0; i <= N; i++) { const a = -A + 2 * A * i / N; P.push(Math.cos(a), 0, Math.sin(a)); U.push(1, 0.5); }
    for (let i = 1; i <= N; i++) I.push(0, i + 1, i);
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: fanT, transparent: true, depthWrite: false, opacity: 0.3, color: 0xffe040, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      m.renderOrder = 3; m.visible = false; G.add(m); STL.cones.push(m);
    }
  }
  function sentryOf(e) { // roof sentries get a sweeping look direction instead of turning to face the player
    if (!e.post || STATE.zone.layer !== "roof") return false;
    if (e.look === undefined) { const g = toGlobal(STATE.zone, e.post.x, e.post.y), key = Math.round(g.gx) + "," + Math.round(g.gz); e.look0 = SENTRY_LOOK[key] !== undefined ? SENTRY_LOOK[key] : (e.facing > 0 ? 0 : Math.PI); e.look = e.look0; e.lookT = (Math.random() * 400) | 0; e.det = 0; e.sentry = true; }
    return true;
  }
  function losBlocked(ax, az, bx, bz, crouch) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    for (const h of STL.hide) {
      if (!crouch && h.h < 1.6) continue; // low cover only hides you while you crouch
      const t = ((h.x - ax) * dx + (h.z - az) * dz) / L2; if (t < 0.04 || t > 0.98) continue;
      const qx = ax + dx * t - h.x, qz = az + dz * t - h.z; if (qx * qx + qz * qz < h.r * h.r) return true;
    }
    return false;
  }
  const _sp = {};
  function stealthTick(p) { // 60 Hz: crouch, look sweeps, detection
    const wantC = (anyHeld("x", "shift") || STL.hold) && !p.climb && !VAN.on && p.z === 0 && p.attackT === 0 && p.deadT === 0 && !(p.sk && p.sk.on) && !p.carry;
    p.crouch = wantC;
    STL.det = 0; STL.hid = false;
    if (!roofStealth() || p.layer !== "roof") return;
    const R0 = lerp(9.5, 5.5, DAY.night), Rc = p.crouch ? 0.62 : 1;
    let inRange = 0, blockedAll = true;
    for (const e of STATE.enemies) {
      if (!sentryOf(e) || !e.idle || e.alerted || e.hp <= 0 || e.state !== "walk") continue;
      e.lookT++;
      if (e.lookT % 520 === 0) e.look0 += Math.PI * (Math.random() < 0.5 ? 0.75 : -0.75); // turn to watch another way
      e.look = lerp(e.look, e.look0 + 0.55 * Math.sin(e.lookT * 0.013), 0.06);
      e.facing = Math.cos(e.look) * STATE.zone.u[0] + Math.sin(e.look) * STATE.zone.u[1] >= 0 ? 1 : -1;
      const g = entPos(STATE.zone, e, _sp), dx = p.gx - g.gx, dz = p.gz - g.gz, d = Math.hypot(dx, dz);
      const R = R0 * Rc; let da = Math.atan2(dz, dx) - e.look; da = Math.atan2(Math.sin(da), Math.cos(da));
      const blk = losBlocked(g.gx, g.gz, p.gx, p.gz, p.crouch);
      if (d < R + 2) { inRange++; if (!blk) blockedAll = false; }
      let rate = 0;
      if (d < R && Math.abs(da) < 0.72 && !blk) rate = (0.6 + 2.4 * (1 - d / R)) * (p.crouch ? 0.5 : 1) * (p.attackT > 0 ? 2 : 1);
      else if (!p.crouch && d < 2.3 && !blk) rate = 0.9; // heard you stomping up behind
      e.det = rate > 0 ? e.det + rate / 60 : Math.max(0, e.det - 0.3 / 60);
      if (rate > 0 && e.det > 0.05 && !e.sayT && e.det < 0.5 && !e.huh) { e.huh = true; enemySay(e, "HUH?", 50, 60); }
      if (e.det >= 1) stealthAlert(e, p);
      STL.det = Math.max(STL.det, e.det);
    }
    STL.hid = p.crouch && inRange > 0 && blockedAll;
  }
  function stealthAlert(e, p) { // spotted: the whole pack on this roof wakes and the freeflow fight starts
    if (e.alerted) return;
    const g0 = entPos(STATE.zone, e, {});
    let n = 0;
    for (const o of STATE.enemies) {
      if (!o.post || o.alerted) continue; const g = entPos(STATE.zone, o, _sp);
      if (o !== e && Math.hypot(g.gx - g0.gx, g.gz - g0.gz) > 16) continue;
      o.alerted = true; o.det = 1; engage(o); n++;
      if (o.state === "walk") o.facing = p.x >= o.x ? 1 : -1;
    }
    STL.spotted++; STL.seenT = 70;
    if (e.state === "walk") enemySay(e, "INTRUDER! GET 'EM!", 90, 90, true);
    popText("SPOTTED!", g0.gx, g0.gy + 2.7, g0.gz, "#ff4a3a", true); SFX.charge && SFX.charge(); STATE.shake = Math.max(STATE.shake, 4);
  }
  function stealthTarget(p) { // an unaware sentry you're right behind
    if (!roofStealth() || p.layer !== "roof" || p.z > 0 || p.attackT > 0) return null;
    let best = null, bd = 1.9;
    for (const e of STATE.enemies) {
      if (!e.sentry || !e.idle || e.alerted || e.hp <= 0 || e.state !== "walk" || e.det >= 1) continue;
      const g = entPos(STATE.zone, e, _sp), dx = p.gx - g.gx, dz = p.gz - g.gz, d = Math.hypot(dx, dz);
      if (d > bd) continue;
      const front = (dx * Math.cos(e.look) + dz * Math.sin(e.look)) / (d || 1);
      if (front > 0.25) continue; // must be behind (or beside-and-behind)
      bd = d; best = e;
    }
    if (!best) return null;
    const g = entPos(STATE.zone, best, {}), it = STL.it || (STL.it = { layer: "roof", kind: "silent", r: 3, label: "SILENT TAKEDOWN" });
    it.e = best; it.x = g.gx; it.z = g.gz; return it;
  }
  function stealthTakedown(p, e) {
    e.silent = true; e.det = 0;
    p.facing = e.x >= p.x ? 1 : -1; p.crouch = false;
    const sw = SWINGS[p.bro.name.toLowerCase()].c3; startAtk(p, "c3", sw.w + sw.s + sw.r); p.hitSet.add(e); p.ffSwing = false;
    hitEnemy(e, e.hp + 9, true, p.facing, 2, false); e.silent = true;
    STATE.slowT = Math.max(STATE.slowT || 0, 30); STATE.score += 300; STL.td++;
    const g = entPos(STATE.zone, e, {}); popText("SILENT TAKEDOWN", g.gx, g.gy + 2.6, g.gz, "#7fe0ff", true); comicPop(g.gx, g.gy + 1.4, g.gz, "SHHK!");
    skHint("silent", "SILENT TAKEDOWN!", "STAY OUT OF THE CONES, CROUCH BEHIND COVER, AND HIT " + (STATE.showTouch ? "SPECIAL" : "E") + " FROM BEHIND");
  }
  // ---- per render frame: the cones ----
  function stealthDraw() {
    let i = 0;
    if (STATE.scene === "stage" && STATE.zone && STATE.zone.layer === "roof") {
      const R0 = lerp(9.5, 5.5, DAY.night), p = STATE.player, Rc = p && p.crouch ? 0.62 : 1;
      for (const e of STATE.enemies) {
        if (!e.sentry || !e.idle || e.alerted || e.hp <= 0 || e.state !== "walk" || i >= STL.cones.length) continue;
        const m = STL.cones[i++], g = entPos(STATE.zone, e, _sp);
        m.visible = true; m.position.set(g.gx, g.fy + 0.06, g.gz); m.rotation.set(0, -e.look, 0); m.scale.set(R0 * Rc, 1, R0 * Rc);
        const k = Math.min(1, e.det || 0); m.material.color.setRGB(1, lerp(0.88, 0.2, k), lerp(0.25, 0.1, k)); m.material.opacity = 0.34 + 0.3 * k + (k > 0.6 ? 0.15 * Math.sin(STATE.t * 0.6) : 0);
      }
    }
    for (; i < STL.cones.length; i++) STL.cones[i].visible = false;
  }
  // ---- HUD: an eye over every sentry that's noticing you, the crouch / hidden tag, the sneak button ----
  function drawStealthHUD() {
    const p = STATE.player; if (!p || p.layer !== "roof" || !roofStealth()) { stealthButton(false); return; }
    for (const e of STATE.enemies) {
      if (!e.sentry || e.hp <= 0 || e.state !== "walk" || (!e.idle && !e.alerted)) continue;
      if (e.alerted && STL.seenT <= 0) continue;
      const k = Math.min(1, e.det || 0); if (k < 0.02 && !e.alerted) continue;
      const s = localScreen(e, 2.35); if (!s.ok) continue;
      const x = s.x, y = s.y, red = k >= 1 || e.alerted;
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(x, y, 9, 5.5, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, 8, 4.5, 0, 0, 7); ctx.clip();
      ctx.fillStyle = "#2a2a3a"; ctx.fillRect(x - 8, y - 5, 16, 10);
      ctx.fillStyle = red ? "#ff3a2a" : k > 0.6 ? "#ff8c1a" : "#ffe14a"; ctx.fillRect(x - 8, y + 5 - 10 * k, 16, 10 * k);
      ctx.restore();
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill();
      if (red) ptext("!", x, y - 15, 1, "#ff3a2a");
    }
    if (STL.seenT > 0) STL.seenT--;
    if (p.crouch) { ptext(STL.hid ? "HIDDEN" : "SNEAKING", W / 2, H - 22, 1, STL.hid ? "#7fe0ff" : "#c8ccd6"); }
    if (STL.det > 0.02) { const bw = 80; rect(W / 2 - bw / 2, H - 13, bw, 5, "#000"); rect(W / 2 - bw / 2 + 1, H - 12, (bw - 2) * Math.min(1, STL.det), 3, STL.det > 0.6 ? "#ff5a2a" : "#ffe14a"); }
    if (STATE.enemies.some((e) => e.sentry && e.idle && !e.alerted)) skHint("stealth", "ROOFTOP STEALTH", "HOLD " + (STATE.showTouch ? "SNEAK" : "X / SHIFT") + " TO CROUCH. STAY OUT OF THE CONES, HIDE BEHIND CHIMNEYS + AC UNITS, TAKE THEM DOWN FROM BEHIND");
    stealthButton(STATE.scene === "stage" && !p.climb && STATE.showTouch);
  }
  // hold-to-sneak touch button
  function stealthButton(on) {
    const scr = document.getElementById("screen"); if (!scr) return;
    if (!STL.btn) {
      const b = document.createElement("div"); b.className = "ss-tb ss-tb-s"; b.textContent = "SNEAK"; b.setAttribute("role", "button"); b.setAttribute("aria-label", "Sneak (hold)");
      const dn = (ev) => { ev.preventDefault(); ev.stopPropagation(); STL.hold = true; b.classList.add("on"); STATE.showTouch = true; };
      const up = (ev) => { ev.stopPropagation(); STL.hold = false; b.classList.remove("on"); };
      b.addEventListener("pointerdown", dn); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
      scr.appendChild(b); STL.btn = b;
    }
    const v = on ? "flex" : "none"; if (STL.btn.style.display !== v) STL.btn.style.display = v;
    if (!on) STL.hold = false;
  }
