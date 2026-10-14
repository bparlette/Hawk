// Level 14: TECHNODROME PORTAL. Built only on the public plugin API v1 (window.SS); see ss_level_api.md.
// Section 1: a Manhattan street under the war machine. Fortress modules rip loose from the Technodrome and fall
// (shadow telegraph), then lie in the street as temporary cover / platforms before phasing back out. Laser turret
// drones hover in at the screen edge, lock onto a lane and fire a beam along it (modules block it).
// Section 2: the plaza under the half-materialised Technodrome. Boss: KRANG in his android body. Armoured body;
// the brain window in his belly glows when he is open (after a stomp, while a fist is out, after the eye laser,
// while he summons). Stomp shockwave, fist rocket, eye laser sweep, mouser swarms, phase 2 module salvo.
// Outro: Krang's brain flees into the Technodrome, Shredder appears in the hatch and retreats to his tower.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;
  const BG1 = "levels/level14_portal.jpg", BG2 = "levels/level14_technodrome.jpg";
  let G = null; // all module state for the current section (reset on section entry / onStart, cleared on unload)
  const fresh = () => ({ mods: [], modCd: 200, turrets: [], turCd: 260, mousers: [], rings: [], laser: null, scorch: [], bolts: [], boltCd: 120,
    lastHp: -1, told: false, toldGlow: 0, wreck: null, salvo: 0 });

  // ---- Music: original D-minor invasion march (148 BPM) + a re-keyed, faster boss track ----
  const CH = ["Dm", "Dm", "F", "C", "Dm", "Dm", "Am", "E", "Dm", "F", "C", "G", "Dm", "Am", "E", "E"];
  const music = A.track({ bpm: 148, loop: true, chords: CH,
    lead: ["D5:3 .:1 D5:2 F5:2 A5:4 G5:2 F5:2", "E5:2 D5:2 C5:4 A4:4 .:4", "F5:2 A5:2 C6:4 A5:2 G5:2 F5:4", "E5:3 .:1 G5:2 E5:2 C5:4 .:4",
      "D5:3 .:1 D5:2 F5:2 A5:4 D6:4", "C6:2 A5:2 F5:2 A5:2 D5:4 .:4", "E5:2 A5:2 C6:4 B5:2 A5:2 E5:4", "G#5:4 B5:4 E6:4 .:4",
      "A5:3 .:1 A5:2 D6:2 F6:4 E6:2 D6:2", "C6:2 A5:2 F5:4 A5:2 C6:2 F6:4", "E6:2 D6:2 C6:2 G5:2 E5:4 G5:4", "D6:2 B5:2 G5:4 B5:2 D6:2 G6:4",
      "F6:3 .:1 E6:2 D6:2 A5:4 D6:4", "C6:2 E6:2 A6:4 G6:2 E6:2 C6:4", "B5:4 G#5:4 E5:4 B4:4", "E5:8 .:8"].join(" "),
    bass: A.bassLine(CH, [0, 0, 12, 0, 7, 0, 12, 10]),
    arp: A.arpLine(CH, 24, [0, 2, 1, 2]),
    drums: A.rep("k.hhs.hkk.hks.hh", 15).concat(["k.s.s.sss.ssssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, 2, 180);

  // ---- helpers ----
  const canHurt = (p) => p && p.deadT === 0 && p.inv === 0 && !(p.sinkT > 0);
  const hittable = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);
  const glow = (c, x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  const boss = () => A.enemies.find((e) => e.boss);
  const blink = (t, n) => Math.floor(t / (n || 6)) % 2 === 1;
  function zig(c, x0, y0, x1, y1, n, amp) { c.beginPath(); c.moveTo(x0, y0); for (let i = 1; i < n; i++) { const k = i / n; c.lineTo(x0 + (x1 - x0) * k + A.rnd(-amp, amp), y0 + (y1 - y0) * k + A.rnd(-amp, amp)); } c.lineTo(x1, y1); c.stroke(); }

  // ================= FALLING FORTRESS MODULES (both sections) =================
  // fall: shadow grows on the floor for FALL frames (the last 18 the module is visible dropping out of the portal),
  // crash (2 dmg + knockdown, wrecks enemies), then REST as a solid block: cover vs shots/lasers and a platform you can
  // jump onto (standing on it is safe from floor shockwaves), flickers for the last 60 frames and phases out.
  const MW = 15, MD = 7, MH = 15, FALL = 66, REST = 430;
  function modAt(x, y, pad) { return G.mods.find((m) => m.st !== "fall" && Math.abs(m.x - x) < MW + (pad || 0) && Math.abs(m.y - y) < MD + (pad || 0)); }
  function dropModule(api, x, y, fall) {
    x = Math.max(api.camX + 24, Math.min(api.camX + api.W - 24, x)); y = Math.max(api.floorTop + MD, Math.min(api.floorBot - 2, y));
    if (G.mods.some((m) => Math.abs(m.x - x) < MW * 2 + 6 && Math.abs(m.y - y) < MD * 2 + 4)) return false;
    G.mods.push({ x, y, st: "fall", t: 0, fall: fall || FALL, seed: Math.random() * 99 | 0, flip: Math.random() < 0.5 ? -1 : 1 });
    if (G.mods.length === 1 || Math.random() < 0.5) api.SFX.charge();
    return true;
  }
  function crushModule(api, m) { m.st = "dead"; api.SFX.boom(); api.fx("boom", m.x, m.y - 10, 26); api.fx("smoke", m.x, m.y - 8, 24); api.dust(m.x, m.y); }
  function updateModules(api, p) {
    for (const m of G.mods) {
      m.t++;
      if (m.st === "fall") {
        if (m.t === m.fall) { // crash
          m.st = "rest"; m.t = 0; api.SFX.boom(); api.shake(3, 10, true); api.STATE.shake = Math.max(api.STATE.shake, 6);
          api.dust(m.x - 10, m.y); api.dust(m.x + 10, m.y); api.fx("smoke", m.x, m.y - 6, 22);
          if (canHurt(p) && Math.abs(p.x - m.x) < MW + 5 && Math.abs(p.y - m.y) < MD + 5 && p.z < MH + 24) api.hurtPlayer(2, false, p.x < m.x ? -1 : 1);
          for (const e of api.enemies) if (hittable(e) && Math.abs(e.x - m.x) < MW + 5 && Math.abs(e.y - m.y) < MD + 5) api.hitEnemy(e, 3, true, e.x < m.x ? -1 : 1);
          for (const q of G.mousers) if (Math.abs(q.x - m.x) < MW + 4 && Math.abs(q.y - m.y) < MD + 4) killMouser(api, q);
        }
        continue;
      }
      if (m.st !== "rest") continue;
      if (m.t >= REST) { m.st = "dead"; api.fx("smoke", m.x, m.y - 10, 20); api.SFX.zap(); continue; }
      // the player: platform from above, solid from the side
      if (p.deadT === 0 && !(p.sinkT > 0)) {
        const dx = p.x - m.x, dy = p.y - m.y;
        if (Math.abs(dx) < MW + 2 && Math.abs(dy) < MD + 1 && p.z >= MH - 5 && p.vz <= 0) { p.z = MH; p.vz = 0; m.perch = 1; }
        else if (Math.abs(dx) < MW + 5 && Math.abs(dy) < MD + 2 && p.z < MH - 5) {
          const px = MW + 5 - Math.abs(dx), py = (MD + 2 - Math.abs(dy)) * 1.6;
          if (px < py) p.x += (dx < 0 ? -1 : 1) * px; else p.y += (dy < 0 ? -1 : 1) * (MD + 2 - Math.abs(dy));
          p.y = Math.max(api.floorTop, Math.min(api.floorBot, p.y));
          if (api.STATE.locked) p.x = Math.max(api.camX + 12, Math.min(api.camX + api.W - 12, p.x));
        }
      }
      for (const e of api.enemies) {
        if (e.boss) { if (e.state !== "dying" && e.z < MH && Math.abs(e.x - m.x) < MW + 12 && Math.abs(e.y - m.y) < MD + 4) { crushModule(api, m); break; } continue; }
        if (!["walk", "attack", "hurt"].includes(e.state) || e.z > MH - 4) continue;
        const dx = e.x - m.x, dy = e.y - m.y;
        if (Math.abs(dx) < MW + 5 && Math.abs(dy) < MD + 2) { if (MW + 5 - Math.abs(dx) < (MD + 2 - Math.abs(dy)) * 1.6) e.x = m.x + (dx < 0 ? -1 : 1) * (MW + 5); else e.y = Math.max(api.floorTop, Math.min(api.floorBot, m.y + (dy < 0 ? -1 : 1) * (MD + 2))); }
      }
      // cover: enemy shots that reach a module are stopped
      api.STATE.stars = api.STATE.stars.filter((s) => {
        if (s.update) return true;
        if (Math.abs(s.x - m.x) < MW && Math.abs(s.y - m.y) < MD + 2 && (!s.arc || s.z < MH)) { api.fx(s.arc ? "smoke" : "clink", s.x, s.y - (s.arc ? s.z : 12), 12); if (!s.arc) api.SFX.clink(); return false; }
        return true;
      });
    }
    G.mods = G.mods.filter((m) => m.st !== "dead");
  }
  function drawModuleBody(api, c, m, x, by, alpha) { // x = screen centre, by = screen y of the front-bottom edge
    const top = by - 2 * MD - MH, s = m.seed;
    c.save(); c.globalAlpha = alpha;
    // top face
    c.fillStyle = "#5c5a66"; c.fillRect(x - MW, top, MW * 2, MD * 2);
    c.fillStyle = "#77758a"; c.fillRect(x - MW, top, MW * 2, 2);
    c.strokeStyle = "#2a2832"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x - MW + 9 + (s % 5), top); c.lineTo(x - MW + 13 + (s % 5), top + MD * 2); c.moveTo(x + 4 + (s % 4), top); c.lineTo(x + 1 + (s % 4), top + MD * 2); c.stroke();
    // front face
    const g = c.createLinearGradient(0, by - MH, 0, by); g.addColorStop(0, "#4a4854"); g.addColorStop(1, "#24222c");
    c.fillStyle = g; c.fillRect(x - MW, by - MH, MW * 2, MH);
    c.strokeStyle = "#141218"; c.lineWidth = 1; c.strokeRect(x - MW + 0.5, top + 0.5, MW * 2 - 1, by - top - 1);
    // armour plate seams glowing violet (Technodrome hull)
    c.strokeStyle = api.t % 40 < 20 ? "#c46aff" : "#a24ae8"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x - MW + 2, by - MH + 4); c.lineTo(x - 4 * m.flip, by - MH + 4); c.lineTo(x - 1 * m.flip, by - 2); c.moveTo(x + MW - 2, by - MH + 7); c.lineTo(x + 6 * m.flip, by - MH + 7); c.stroke();
    for (const [rx, ry] of [[-MW + 3, -MH + 2], [MW - 4, -MH + 2], [-MW + 3, -3], [MW - 4, -3]]) { c.fillStyle = "#8a8898"; c.fillRect(x + rx, by + ry, 1.2, 1.2); }
    // torn edge + dangling cable
    c.fillStyle = "#14121a"; const ex = x + m.flip * MW;
    c.beginPath(); c.moveTo(ex, top + 2); c.lineTo(ex - m.flip * 4, top + 7); c.lineTo(ex, top + 11); c.lineTo(ex - m.flip * 3, by - 6); c.lineTo(ex, by - 2); c.closePath(); c.fill();
    c.strokeStyle = "#2a1838"; c.lineWidth = 1; c.beginPath(); c.moveTo(ex - m.flip * 2, top + 9); c.quadraticCurveTo(ex + m.flip * 5, top + 14, ex + m.flip * 3, by - 3); c.stroke();
    if ((api.t + s) % 50 < 4) { c.fillStyle = "#fff6c0"; c.fillRect(ex + m.flip * 3, by - 4, 1.5, 1.5); c.fillStyle = "#ffcf5a"; c.fillRect(ex + m.flip * 5, by - 6, 1, 1); }
    c.restore();
  }
  function drawModulesBack(api, cx) {
    const c = api.ctx;
    for (const m of G.mods) {
      const x = m.x - cx; if (x < -40 || x > api.W + 40) continue;
      if (m.st === "fall") {
        const k = m.t / m.fall, r = 4 + k * (MW + 2);
        c.save(); c.globalAlpha = 0.25 + 0.5 * k; c.fillStyle = "#08040e"; c.beginPath(); c.ellipse(x, m.y, r, r * 0.42, 0, 0, 6.29); c.fill();
        c.globalAlpha = 0.5; c.strokeStyle = k > 0.7 && blink(m.t, 3) ? "#ffe060" : "#ff3a6a"; c.lineWidth = 1; c.beginPath(); c.ellipse(x, m.y, MW + 3, (MW + 3) * 0.42, 0, 0, 6.29); c.stroke(); c.restore();
        if (blink(m.t)) api.ptext("!", x, m.y - 22, 2, "#ffe060");
        continue;
      }
      const fade = m.t > REST - 60 ? (blink(m.t, 3) ? 0.35 : 0.85) : 1;
      api.contactShadow(x, m.y + MD - 1, 0, MW + 2);
      drawModuleBody(api, c, m, x, m.y + MD, fade);
      if (m.t > REST - 60) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.35; c.fillStyle = "#b45aff"; for (let i = 0; i < 6; i++) c.fillRect(x - MW, m.y + MD - 2 * MD - MH + i * 5 + (api.t % 5), MW * 2, 1); c.restore(); }
      if (m.t < 8) { c.save(); c.globalAlpha = 1 - m.t / 8; api.rect(x - MW - 4, m.y + MD - 2 * MD - MH - 2, MW * 2 + 8, 2 * MD + MH + 4, "#ffffff"); c.restore(); }
    }
  }
  function drawModulesFront(api, cx) {
    const c = api.ctx, p = api.player;
    for (const m of G.mods) {
      const x = m.x - cx; if (x < -40 || x > api.W + 40) continue;
      if (m.st === "fall") { // the module drops out of the sky during the last 18 frames
        const left = m.fall - m.t; if (left > 18) continue;
        const z = left * left * 0.62;
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.5; c.fillStyle = "#b45aff"; c.fillRect(x - 5, m.y - z - 60, 10, 50); c.restore();
        drawModuleBody(api, c, m, x, m.y + MD - z, 1);
        continue;
      }
      // redraw over actors standing behind the block (depth fix: everything drawBack draws is under every actor)
      const behind = (a) => a && a.y < m.y - MD + 1 && Math.abs(a.x - m.x) < MW + 14 && (a.z || 0) < MH;
      if (behind(p) || api.enemies.some(behind) || G.mousers.some(behind)) drawModuleBody(api, c, m, x, m.y + MD, m.t > REST - 60 ? (blink(m.t, 3) ? 0.35 : 0.85) : 1);
    }
  }

  // ================= LASER TURRET DRONES (section 1) =================
  // fly in at a screen edge -> AIM (tracks your lane, dotted red line, "!") -> LOCK -> FIRE a beam along that lane
  // (jump it or step out of the lane; modules block it; it also burns enemies) -> second shot -> fly away.
  const T_IN = 34, T_AIM = 52, T_LOCK = 14, T_FIRE = 26, T_GAP = 60, TZ = 14;
  function turretEnd(api, tu) { // beam end x (stops at the first module on that lane)
    let end = tu.side < 0 ? api.camX + api.W + 20 : api.camX - 20;
    for (const m of G.mods) if (m.st === "rest" && Math.abs(m.y - tu.ty) < MD + 3) {
      const face = tu.side < 0 ? m.x - MW : m.x + MW;
      if (tu.side < 0 ? face > tu.x && face < end : face < tu.x && face > end) end = face;
    }
    return end;
  }
  function updateTurrets(api, p, allow) {
    const S = api.STATE;
    if (allow && S.locked && S.wave >= 1 && !G.turrets.length && --G.turCd <= 0) {
      const side = Math.random() < 0.5 ? -1 : 1; // -1 = left edge (fires right)
      G.turrets.push({ side, x: 0, y: p.y, ty: p.y, t: 0, shots: 0, ph: "in" });
      G.turCd = 380 + (Math.random() * 120 | 0); api.SFX.zap();
    }
    for (const tu of G.turrets) {
      tu.t++;
      const home = tu.side < 0 ? api.camX + 14 : api.camX + api.W - 14, off = tu.side < 0 ? api.camX - 30 : api.camX + api.W + 30;
      if (tu.ph === "in") { tu.x = api.lerp(off, home, Math.min(1, tu.t / T_IN)); tu.y = api.lerp(tu.y, p.y, 0.05); if (tu.t >= T_IN) { tu.ph = "aim"; tu.t = 0; api.SFX.charge(); } }
      else if (tu.ph === "aim") { tu.x = home; tu.y = api.lerp(tu.y, Math.max(api.floorTop, Math.min(api.floorBot, p.y)), 0.07); tu.ty = tu.y; if (tu.t >= T_AIM) { tu.ph = "lock"; tu.t = 0; } }
      else if (tu.ph === "lock") { tu.x = home; if (tu.t >= T_LOCK) { tu.ph = "fire"; tu.t = 0; tu.hit = new Set(); api.SFX.gun(); api.shake(1, 6, true); } }
      else if (tu.ph === "fire") {
        tu.x = home; const end = turretEnd(api, tu), lo = Math.min(tu.x, end), hi = Math.max(tu.x, end);
        if (canHurt(p) && !tu.hit.has(p) && p.x > lo && p.x < hi && Math.abs(p.y - tu.ty) < 6 && p.z < 12) { tu.hit.add(p); api.hurtPlayer(2, false, -tu.side); }
        for (const e of api.enemies) if (hittable(e) && !tu.hit.has(e) && e.x > lo && e.x < hi && Math.abs(e.y - tu.ty) < 6) { tu.hit.add(e); api.hitEnemy(e, 2, true, -tu.side); }
        if (tu.t % 4 === 0) api.fx("spark", end, tu.ty - 12, 6);
        if (tu.t >= T_FIRE) { tu.shots++; tu.t = 0; tu.ph = tu.shots >= 2 ? "out" : "gap"; }
      } else if (tu.ph === "gap") { tu.x = home; tu.y = api.lerp(tu.y, p.y, 0.05); if (tu.t >= T_GAP) { tu.ph = "aim"; tu.t = 0; api.SFX.charge(); } }
      else if (tu.ph === "out") { tu.x = api.lerp(home, off, Math.min(1, tu.t / 30)); if (tu.t >= 30) tu.dead = true; }
    }
    G.turrets = G.turrets.filter((tu) => !tu.dead);
  }
  function drawTurrets(api, cx) {
    const c = api.ctx;
    for (const tu of G.turrets) {
      const x = tu.x - cx, row = tu.ph === "lock" || tu.ph === "fire" ? tu.ty : tu.y, y = row - TZ + 4 + Math.sin(api.t * 0.15) * 0.8, f = -tu.side;
      // lane line: dotted while aiming, solid when locked, beam when firing
      if (tu.ph === "aim" || tu.ph === "lock") {
        c.save(); c.strokeStyle = tu.ph === "lock" ? "rgba(255,70,90,0.9)" : "rgba(255,70,90,0.55)"; c.lineWidth = 1; if (tu.ph === "aim") c.setLineDash([3, 3]);
        c.beginPath(); c.moveTo(x, row - 12); c.lineTo(tu.side < 0 ? api.W + 10 : -10, row - 12); c.stroke(); c.restore();
        c.save(); c.globalAlpha = 0.25; api.rect(0, row - 2, api.W, 3, "#ff3a5a"); c.restore();
        if (blink(tu.t)) api.ptext("!", x + f * 2, y - 16, 2, "#ffe060");
      }
      if (tu.ph === "fire") {
        const ex = turretEnd(api, tu) - cx, w = 4 + Math.sin(api.t * 0.9) * 1.2;
        c.save(); c.globalCompositeOperation = "lighter";
        c.fillStyle = "rgba(255,40,90,0.35)"; c.fillRect(Math.min(x, ex), row - 12 - w, Math.abs(ex - x), w * 2);
        c.fillStyle = "rgba(255,120,150,0.8)"; c.fillRect(Math.min(x, ex), row - 13.5, Math.abs(ex - x), 3);
        c.fillStyle = "#fff4f6"; c.fillRect(Math.min(x, ex), row - 12.5, Math.abs(ex - x), 1);
        c.globalAlpha = 0.45; c.fillStyle = "rgba(255,60,100,0.8)"; c.fillRect(Math.min(x, ex), row - 1, Math.abs(ex - x), 2); // floor glow
        glow(c, ex, row - 12, 10, "rgba(255,200,220,0.9)"); c.restore();
      }
      // the drone: armoured dome, violet seams, cannon, thruster
      api.shadow(x, row, TZ, 8);
      c.save(); c.translate(x, y);
      c.fillStyle = "#2c2a34"; c.beginPath(); c.ellipse(0, 0, 9, 7, 0, 0, 6.29); c.fill();
      c.fillStyle = "#56546a"; c.beginPath(); c.ellipse(-1, -2, 7, 4.5, 0, 0, 6.29); c.fill();
      c.strokeStyle = "#b45aff"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-8, 1); c.lineTo(8, 1); c.moveTo(0, -7); c.lineTo(0, 1); c.stroke();
      c.fillStyle = "#1a1820"; c.fillRect(f > 0 ? 5 : -15, -2, 10, 3.5); c.fillStyle = "#6a6878"; c.fillRect(f > 0 ? 5 : -15, -2, 10, 1);
      const hot = tu.ph === "lock" || tu.ph === "fire" || (tu.ph === "aim" && blink(tu.t, 4));
      c.fillStyle = hot ? "#ff4a6a" : "#7a2a3a"; c.beginPath(); c.arc(f * 4, -1, 1.8, 0, 6.29); c.fill();
      c.globalCompositeOperation = "lighter"; c.fillStyle = api.t % 4 < 2 ? "rgba(140,180,255,0.9)" : "rgba(200,120,255,0.8)"; c.beginPath(); c.moveTo(-3, 6); c.lineTo(3, 6); c.lineTo(0, 11 + (api.t % 3)); c.closePath(); c.fill();
      c.restore();
    }
  }

  // ================= SECTION 1 =================
  const street = {
    init: () => { G = fresh(); return {}; },
    update(st, api, p) {
      if (!G) return;
      const S = api.STATE;
      if (S.phase !== "exit" && S.playT > 120 && --G.modCd <= 0) {
        G.modCd = (S.locked ? 230 : 330) + (Math.random() * 90 | 0);
        const near = Math.random() < 0.6;
        if (G.mods.length < 3) dropModule(api, near ? p.x + api.rnd(-30, 30) : api.camX + api.rnd(40, api.W - 40), near ? p.y + api.rnd(-8, 8) : api.rnd(api.floorTop + 8, api.floorBot - 4));
      }
      updateModules(api, p);
      updateTurrets(api, p, true);
      if (--G.boltCd <= 0) { G.boltCd = 140 + (Math.random() * 200 | 0); G.bolts.push({ x: api.rnd(30, api.W - 30), t: 0 }); if (Math.random() < 0.5) api.SFX.zap(); }
      G.bolts = G.bolts.filter((b) => ++b.t < 14);
    },
    drawBack(st, api, cx) {
      if (!G) return;
      const c = api.ctx;
      for (const b of G.bolts) { // portal lightning in the sky
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 1 - b.t / 14;
        c.strokeStyle = "#e8c8ff"; c.lineWidth = 1.2; zig(c, b.x, 0, b.x + A.rnd(-30, 30), 40 + (b.x % 30), 7, 5);
        if (b.t < 3) { c.globalAlpha = 0.12; c.fillStyle = "#c08aff"; c.fillRect(0, 0, api.W, api.H); }
        c.restore();
      }
      drawModulesBack(api, cx);
    },
    drawFront(st, api, cx) { if (!G) return; drawModulesFront(api, cx); drawTurrets(api, cx); },
  };

  // ================= MOUSERS (summoned by Krang) =================
  function spawnMouser(api, x, y) { G.mousers.push({ x, y: Math.max(api.floorTop, Math.min(api.floorBot, y)), z: 0.1, vz: 2.2, t: 0, bite: 0, facing: -1, chomp: 0 }); api.dust(x, y); }
  function killMouser(api, q) { if (q.dead) return; q.dead = true; api.fx("spark", q.x, q.y - 6, 8); api.fx("smoke", q.x, q.y - 4, 14); api.SFX.clink(); api.STATE.score += 100; api.fx("pop", q.x, q.y - 14, 30); }
  function updateMousers(api, p) {
    for (const q of G.mousers) {
      if (q.dead) continue;
      q.t++; if (q.bite > 0) q.bite--; if (q.chomp > 0) q.chomp--;
      if (q.z > 0 || q.vz > 0) { q.z += q.vz; q.vz -= 0.25; if (q.z <= 0) { q.z = 0; q.vz = 0; } }
      const dx = p.x - q.x, dy = p.y - q.y;
      if (q.z === 0 && p.deadT === 0) {
        const sp = 1.25 + (q.t % 60 < 10 ? 0.6 : 0);
        if (Math.abs(dx) > 7) q.x += Math.sign(dx) * sp; if (Math.abs(dy) > 1) q.y += Math.sign(dy) * Math.min(0.8, Math.abs(dy));
        q.facing = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) < 11 && Math.abs(dy) < 5 && p.z < 6 && q.bite === 0) { q.bite = 62; q.chomp = 12; api.SFX.munch ? api.SFX.munch() : api.SFX.hit(); if (canHurt(p)) api.hurtPlayer(1, false); }
      }
      if (G.mods.some((m) => m.st === "rest" && Math.abs(q.x - m.x) < MW + 3 && Math.abs(q.y - m.y) < MD + 2)) { q.x -= q.facing * 1.25; }
      // any swing from the brother scraps it
      if (p.attackT > 0 && p.atk) {
        const ddx = (q.x - p.x) * p.facing;
        if (ddx > -6 && ddx < (p.bro.reach || 20) + 10 && Math.abs(q.y - p.y) < 10 && p.z < 20) killMouser(api, q);
      }
      if (q.t > 760) { q.dead = true; api.fx("smoke", q.x, q.y - 4, 16); }
    }
    G.mousers = G.mousers.filter((q) => !q.dead);
  }
  function drawMouser(api, q, cx) {
    const c = api.ctx, x = q.x - cx, y = q.y - q.z, f = q.facing, step = Math.floor(q.t / 4) % 2, jaw = q.chomp > 0 ? Math.abs(Math.sin(q.chomp * 0.8)) * 0.7 : 0.1 + (q.t % 20 < 10 ? 0.15 : 0);
    api.shadow(x, q.y, q.z, 9);
    c.save(); c.translate(x, y); c.scale(f * 1.45, 1.45);
    c.strokeStyle = "#3a3c46"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-2, -5); c.lineTo(-3 + (step ? 2 : -1), 0); c.moveTo(1, -5); c.lineTo(1 + (step ? -1 : 2), 0); c.stroke();
    c.fillStyle = "#2a2c34"; c.fillRect(-5 + (step ? 2 : -1), -1, 3, 1); c.fillRect(0 + (step ? -1 : 2), -1, 3, 1);
    c.fillStyle = "#8c94a8"; c.beginPath(); c.ellipse(-1, -7, 4.5, 3.2, -0.2, 0, 6.29); c.fill(); // body
    c.strokeStyle = "#5a6070"; c.lineWidth = 1; c.beginPath(); c.moveTo(-5, -7); c.lineTo(-9, -9); c.stroke(); // tail
    c.save(); c.translate(3, -9); // head with chomping jaws
    c.save(); c.rotate(-jaw); c.fillStyle = "#a8b0c4"; c.beginPath(); c.moveTo(-2, 0); c.lineTo(7, -1); c.lineTo(7, 1.5); c.lineTo(-2, 2); c.closePath(); c.fill();
    c.fillStyle = "#ffffff"; for (let i = 1; i < 7; i += 2) c.fillRect(i, 1.4, 1, 1); c.restore();
    c.save(); c.rotate(jaw * 0.8); c.fillStyle = "#7a8296"; c.beginPath(); c.moveTo(-2, 2); c.lineTo(6, 2.5); c.lineTo(6, 4); c.lineTo(-2, 4); c.closePath(); c.fill(); c.fillStyle = "#ffffff"; for (let i = 1; i < 6; i += 2) c.fillRect(i, 1.8, 1, 1); c.restore();
    c.fillStyle = "#ff3a3a"; c.fillRect(1, -1, 1.6, 1.6); c.restore();
    c.restore();
  }

  // ================= BOSS ARENA CONTROLLER =================
  const RING_K = 0.3, HATCH = { x: 192, y: 127 };
  const vulnerable = (b) => b && (b.vuln > 0 || b.fistOut || b.state === "stagger");
  const arena = {
    init: () => { G = fresh(); G.modCd = 420; return {}; },
    update(st, api, p) {
      if (!G) return;
      const b = boss(), fight = b && b.go && b.state !== "dying" && !api.STATE.outro;
      if (b) {
        if (b.vuln > 0) b.vuln--;
        // armour: while the brain window is dark the android shrugs off half of every hit
        if (G.lastHp < 0) G.lastHp = b.hp;
        if (b.hp < G.lastHp && b.state !== "dying" && b.hp > 0) {
          const d = G.lastHp - b.hp;
          if (!vulnerable(b)) {
            b.hp = Math.min(b.maxHp, b.hp + d * 0.5); api.fx("clink", b.x + b.facing * 2, b.y - 50, 12);
            if (!G.told) { G.told = true; api.playerBark(true, "TOO TOUGH! HIT HIM WHEN THE BRAIN GLOWS!"); }
          } else api.fx("spark", b.x + b.facing * 2, b.y - 50, 10);
        }
        G.lastHp = b.hp;
      }
      if (!b && G.wreckAt && !G.wreck) G.wreck = G.wreckAt;
      if (fight && --G.modCd <= 0) { G.modCd = (b.p2 ? 250 : 400) + (Math.random() * 80 | 0); if (G.mods.length < 3) dropModule(api, p.x + api.rnd(-26, 26), p.y + api.rnd(-6, 6)); }
      if (G.salvo > 0 && --G.salvo % 22 === 0) dropModule(api, p.x + api.rnd(-60, 60), api.rnd(api.floorTop + 8, api.floorBot - 4), 70);
      updateModules(api, p);
      updateMousers(api, p);
      // stomp shockwave rings (jump them, or stand on a module)
      G.rings = G.rings.filter((R) => {
        if (R.delay > 0) { R.delay--; return true; }
        R.r += 3;
        const test = (x, y, z) => { const d = Math.hypot(x - R.x, (y - R.y) / RING_K); return Math.abs(d - R.r) < 6 && z < 4; };
        if (canHurt(p) && !R.hit.has(p) && test(p.x, p.y, p.z)) { R.hit.add(p); api.hurtPlayer(2, false, p.x < R.x ? -1 : 1); }
        for (const e of api.enemies) if (hittable(e) && !R.hit.has(e) && test(e.x, e.y, e.z)) { R.hit.add(e); api.hitEnemy(e, 2, true, e.x < R.x ? -1 : 1); }
        for (const q of G.mousers) if (test(q.x, q.y, q.z)) killMouser(api, q);
        return R.r < 320;
      });
      // eye laser sweep
      const L = G.laser;
      if (L && (!b || b.state !== "fire")) G.laser = null;
      else if (L && L.on) {
        const nx = L.x + L.dir * 4.6, blk = G.mods.find((m) => m.st === "rest" && Math.abs(m.y - L.y) < MD + 3 && (L.dir > 0 ? m.x - MW >= L.x - 1 && m.x - MW <= nx : m.x + MW <= L.x + 1 && m.x + MW >= nx));
        if (blk) { L.x = blk.x - L.dir * MW; L.stop = true; } else if (!L.stop) L.x = nx;
        if (api.t % 2 === 0) G.scorch.push({ x: L.x, y: L.y, t: 0 });
        if (canHurt(p) && Math.abs(p.x - L.x) < 9 && Math.abs(p.y - L.y) < 7 && p.z < 12) api.hurtPlayer(2, false, L.dir);
        for (const e of api.enemies) if (hittable(e) && Math.abs(e.x - L.x) < 9 && Math.abs(e.y - L.y) < 7) api.hitEnemy(e, 2, true, L.dir);
        for (const q of G.mousers) if (Math.abs(q.x - L.x) < 8 && Math.abs(q.y - L.y) < 6) killMouser(api, q);
        if (api.t % 5 === 0) api.fx("spark", L.x, L.y - 2, 6);
      }
      G.scorch = G.scorch.filter((s) => ++s.t < 70);
    },
    drawBack(st, api, cx) {
      if (!G) return;
      const c = api.ctx, b = boss();
      // Technodrome seams pulse; brighter while Krang is in phase 2
      c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.18 + 0.1 * Math.sin(api.t * 0.07) + (b && b.p2 ? 0.12 : 0) + (G.flash || 0);
      glow(c, 192 - cx, 70, 90, "rgba(190,80,255,0.7)"); c.restore();
      if (G.flash > 0) G.flash = Math.max(0, G.flash - 0.02);
      if (G.hatchShut > 0) { // the hatch door slides down in the outro
        const h = Math.min(1, G.hatchShut) * 29; api.rect(169 - cx, 98, 48, h, "#1a1820"); api.rect(169 - cx, 98 + h - 2, 48, 2, "#5a5868");
        c.save(); c.globalAlpha = 0.6; api.rect(169 - cx, 98 + h - 1, 48, 1, "#b45aff"); c.restore();
      }
      if (G.wreck) drawWreck(api, G.wreck, cx);
      for (const s of G.scorch) { c.save(); c.globalAlpha = (1 - s.t / 70) * 0.8; c.fillStyle = s.t < 10 ? "#ffb0c0" : "#2a1418"; c.beginPath(); c.ellipse(s.x - cx, s.y, 4, 1.6, 0, 0, 6.29); c.fill(); c.restore(); }
      // stomp warning + rings
      if (b && b.state === "slam" && b.t < 40) {
        const k = b.t / 40; c.save(); c.globalAlpha = 0.25 + 0.35 * k; c.strokeStyle = blink(b.t, 3) ? "#ffe060" : "#ff3a5a"; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(b.x - cx, b.y, 20 + k * 30, (20 + k * 30) * RING_K, 0, 0, 6.29); c.stroke(); c.restore();
        if (blink(b.t)) api.ptext("JUMP!", b.x - cx, b.y + 10, 1, "#ffe060");
      }
      for (const R of G.rings) {
        if (R.delay > 0) continue;
        const a = Math.max(0, 1 - R.r / 320);
        c.save(); c.globalCompositeOperation = "lighter";
        c.strokeStyle = `rgba(255,170,60,${0.5 * a + 0.2})`; c.lineWidth = 5; c.beginPath(); c.ellipse(R.x - cx, R.y, R.r, R.r * RING_K, 0, 0, 6.29); c.stroke();
        c.strokeStyle = `rgba(255,250,220,${0.8 * a + 0.2})`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(R.x - cx, R.y, R.r, R.r * RING_K, 0, 0, 6.29); c.stroke();
        c.restore();
      }
      drawModulesBack(api, cx);
    },
    drawFront(st, api, cx) {
      if (!G) return;
      const c = api.ctx, b = boss();
      for (const q of G.mousers) drawMouser(api, q, cx);
      drawModulesFront(api, cx);
      // eye laser: targeting line while charging, then the beam from his eye to the burning floor point
      const L = G.laser;
      if (b && L) {
        const ex = b.x - cx + b.facing * 7, ey = b.y - b.z - 86;
        if (!L.on) {
          c.save(); c.strokeStyle = blink(api.t, 3) ? "rgba(255,60,80,0.9)" : "rgba(255,200,80,0.7)"; c.setLineDash([2, 3]); c.lineWidth = 1;
          c.beginPath(); c.moveTo(ex, ey); c.lineTo(L.tx - cx, L.y); c.stroke(); c.restore();
          c.save(); c.globalAlpha = 0.2; api.rect(0, L.y - 2, api.W, 4, "#ff3a5a"); c.restore();
        } else {
          c.save(); c.globalCompositeOperation = "lighter";
          c.strokeStyle = "rgba(255,40,80,0.45)"; c.lineWidth = 6; c.beginPath(); c.moveTo(ex, ey); c.lineTo(L.x - cx, L.y); c.stroke();
          c.strokeStyle = "rgba(255,150,170,0.9)"; c.lineWidth = 2.2; c.stroke();
          c.strokeStyle = "#ffffff"; c.lineWidth = 0.8; c.stroke();
          glow(c, L.x - cx, L.y, 14, "rgba(255,180,120,0.95)"); glow(c, ex, ey, 7, "rgba(255,90,110,1)");
          c.restore();
        }
      }
      if (b && vulnerable(b) && b.state !== "dying" && G.toldGlow < 2 && blink(api.t, 8)) api.ptext("HIT THE BRAIN!", b.x - cx, b.y + 10, 1, "#ffe060");
    },
  };

  // ================= KRANG (android body), drawn on canvas =================
  // Feet at the origin, facing right, ~92 world px tall. Tan body, maroon briefs/boots, grey harness, gold belly
  // window with the pink brain inside (glows when he is open to damage).
  const SKIN = "#dcaa78", SKIN_D = "#b07f55", SKIN_L = "#f0c896", MAR = "#8a1e2c", MAR_D = "#5c1019", STEEL = "#80838e", STEEL_D = "#4a4c56", GOLD = "#e8b830", GOLD_D = "#9a7012";
  function limb(c, x0, y0, x1, y1, w, col, out) { c.lineCap = "round"; c.strokeStyle = out || "#2a1810"; c.lineWidth = w + 1.6; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
  function legPose(c, hx, hy, th, sh, col, boot) { // thigh angle th / shin angle sh (0 = straight down, + = forward)
    const kx = hx + Math.sin(th) * 17, ky = hy + Math.cos(th) * 17, ax = kx + Math.sin(sh) * 16, ay = ky + Math.cos(sh) * 16;
    limb(c, hx, hy, kx, ky, 11, col); limb(c, kx, ky, ax, ay, 9, col);
    c.fillStyle = STEEL_D; c.fillRect(kx - 3, ky - 1.5, 6, 3); // knee joint
    c.save(); c.translate(ax, ay); c.rotate(-sh * 0.4);
    c.fillStyle = "#2a1810"; c.beginPath(); c.moveTo(-6.5, -5); c.lineTo(6.5, -5); c.lineTo(6.5, 1); c.quadraticCurveTo(12.5, 1.5, 12.5, 7.6); c.lineTo(-6.5, 7.6); c.closePath(); c.fill();
    c.fillStyle = boot; c.beginPath(); c.moveTo(-5.6, -4.2); c.lineTo(5.6, -4.2); c.lineTo(5.6, 1.8); c.quadraticCurveTo(11.6, 2.2, 11.6, 6.8); c.lineTo(-5.6, 6.8); c.closePath(); c.fill();
    c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(-5.6, 5.6, 17.2, 1.2); c.fillStyle = "rgba(255,255,255,0.2)"; c.fillRect(-5, -4, 9, 1);
    c.restore();
    return [ax, ay];
  }
  function armPose(c, sx, sy, a, bend, col, fist, rocket) { // a: 0 = hanging, PI/2 = pointing forward
    const ex = sx + Math.sin(a) * 15, ey = sy + Math.cos(a) * 15, fa = a + bend, wx = ex + Math.sin(fa) * 14, wy = ey + Math.cos(fa) * 14;
    limb(c, sx, sy, ex, ey, 12, col); limb(c, ex, ey, wx, wy, 10.5, col);
    c.save(); c.translate(wx, wy); c.rotate(-fa);
    c.fillStyle = STEEL; c.fillRect(-6, -4, 12, 3.8); c.fillStyle = STEEL_D; c.fillRect(-6, -1, 12, 1); // wristband
    if (fist) { c.fillStyle = "#2a1810"; c.beginPath(); c.arc(0, 4, 7.2, 0, 6.29); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(0, 4, 6.3, 0, 6.29); c.fill(); c.strokeStyle = "rgba(60,30,10,0.6)"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-3, 5); c.lineTo(3, 5); c.moveTo(-3, 6.8); c.lineTo(3, 6.8); c.stroke(); }
    else { c.fillStyle = "#26242c"; c.fillRect(-3.5, 0, 7, 3); if (rocket) { c.globalCompositeOperation = "lighter"; c.fillStyle = "rgba(255,170,60,0.9)"; c.beginPath(); c.arc(0, 2.5, 3, 0, 6.29); c.fill(); } }
    c.restore();
    return [wx, wy];
  }
  function drawBrain(c, x, y, w, h, t, hot) {
    c.fillStyle = hot ? "#ff9ab4" : "#e8829a"; c.beginPath(); c.ellipse(x, y, w, h, 0, 0, 6.29); c.fill();
    c.strokeStyle = hot ? "#b0305a" : "#a2405a"; c.lineWidth = 0.7; c.beginPath();
    for (let i = -2; i <= 2; i++) { const ox = x + i * w * 0.35; c.moveTo(ox, y - h * 0.8); c.quadraticCurveTo(ox + 2 + Math.sin(t * 0.2 + i), y, ox - 1, y + h * 0.8); }
    c.moveTo(x - w * 0.8, y - 0.5); c.quadraticCurveTo(x, y - 2 + Math.sin(t * 0.15), x + w * 0.8, y + 0.5); c.stroke();
    c.fillStyle = "#fff"; c.fillRect(x + w * 0.35, y - 1.6, 1.6, 1.4); c.fillStyle = "#111"; c.fillRect(x + w * 0.5, y - 1.3, 0.8, 0.9); // Krang's tiny face
  }
  function drawKrang(api, sx, sy, f, P) {
    const c = api.ctx, t = api.t;
    c.save(); c.translate(sx, sy);
    if (P.lie) { c.translate(f * 40 * P.lie, -20 * P.lie); c.rotate(-f * Math.PI / 2 * P.lie); }
    c.scale(f * 0.92, 0.92);
    const cr = P.crouch || 0, lean = P.lean || 0, wk = P.walk;
    const hipY = -40 + cr, sw = wk === null || wk === undefined ? 0 : Math.sin(wk) * 0.38;
    // back limbs (darker)
    const lift = P.lift || 0;
    legPose(c, -4, hipY, -sw - lift * 0.15, -sw * 0.5 + (wk != null ? Math.max(0, -Math.cos(wk)) * 0.3 : 0), SKIN_D, MAR_D);
    c.save(); c.translate(0, hipY); c.rotate(lean); c.translate(0, -hipY);
    armPose(c, -12, hipY - 41, P.armB !== undefined ? P.armB : -sw * 0.6 + 0.1, P.bendB !== undefined ? P.bendB : 0.35, SKIN_D, true);
    c.restore();
    // front leg
    legPose(c, 5, hipY, sw + lift * 1.15, sw * 0.4 - lift * 0.2 + (wk != null ? Math.max(0, Math.cos(wk)) * 0.3 : 0), SKIN, MAR);
    // torso (rotates around the hips with lean)
    c.save(); c.translate(0, hipY); c.rotate(lean); c.translate(0, -hipY);
    const y0 = hipY;
    c.fillStyle = "#2a1810"; c.beginPath();
    c.moveTo(-15, y0 + 4); c.lineTo(17, y0 + 4); c.quadraticCurveTo(20, y0 - 12, 26, y0 - 30); c.quadraticCurveTo(27, y0 - 44, 12, y0 - 47); c.lineTo(-12, y0 - 47);
    c.quadraticCurveTo(-25, y0 - 44, -24, y0 - 30); c.quadraticCurveTo(-19, y0 - 12, -15, y0 + 4); c.closePath(); c.fill();
    const tg = c.createLinearGradient(-24, 0, 26, 0); tg.addColorStop(0, SKIN_D); tg.addColorStop(0.55, SKIN); tg.addColorStop(1, SKIN_L);
    c.fillStyle = tg; c.beginPath();
    c.moveTo(-14, y0 + 3); c.lineTo(16, y0 + 3); c.quadraticCurveTo(19, y0 - 12, 25, y0 - 30); c.quadraticCurveTo(26, y0 - 43, 12, y0 - 46); c.lineTo(-12, y0 - 46);
    c.quadraticCurveTo(-24, y0 - 43, -23, y0 - 30); c.quadraticCurveTo(-18, y0 - 12, -14, y0 + 3); c.closePath(); c.fill();
    c.strokeStyle = "rgba(110,60,30,0.55)"; c.lineWidth = 0.8; c.beginPath(); // pecs
    c.moveTo(-8, y0 - 31); c.quadraticCurveTo(4, y0 - 25, 22, y0 - 31); c.moveTo(5, y0 - 44); c.lineTo(5, y0 - 28); c.moveTo(-2, y0 - 22); c.quadraticCurveTo(6, y0 - 20, 15, y0 - 22); c.stroke();
    // briefs
    c.fillStyle = MAR; c.beginPath(); c.moveTo(-15, y0 - 8); c.lineTo(16, y0 - 8); c.lineTo(17, y0 + 4); c.quadraticCurveTo(8, y0 + 9, 1, y0 + 4); c.quadraticCurveTo(-7, y0 + 9, -15, y0 + 4); c.closePath(); c.fill();
    c.fillStyle = MAR_D; c.fillRect(-15, y0 - 8, 31, 1.5);
    // gold belly frame + brain window
    const wx = 2, wy = y0 - 15, v = P.vuln || 0;
    c.fillStyle = GOLD_D; c.fillRect(wx - 15, wy - 9, 31, 17);
    c.fillStyle = GOLD; c.fillRect(wx - 14, wy - 8.5, 29, 15.5);
    c.fillStyle = "#fff3a8"; c.fillRect(wx - 14, wy - 8.5, 29, 1);
    c.fillStyle = "#c8261a"; c.fillRect(wx + 11.5, wy - 4, 2, 2); c.fillRect(wx + 11.5, wy, 2, 2); // indicator studs
    c.fillStyle = v > 0 ? "#3a1020" : "#140810"; c.fillRect(wx - 11, wy - 6.5, 21.5, 11.5);
    if (!P.empty) drawBrain(c, wx - 0.5, wy - 0.8, 8.6, 4.6, t, v > 0); else { c.fillStyle = "#2a0a14"; c.fillRect(wx - 11, wy - 6.5, 21.5, 11.5); if (t % 20 < 10) { c.fillStyle = "#ff4a6a"; c.fillRect(wx - 2, wy - 1, 2, 2); } }
    c.fillStyle = "rgba(220,240,255,0.3)"; c.beginPath(); c.moveTo(wx - 10.5, wy - 6); c.lineTo(wx - 7, wy - 6); c.lineTo(wx - 10.5, wy - 1); c.closePath(); c.fill(); // glass glare
    if (v > 0) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.45 + 0.35 * Math.sin(t * 0.4); glow(c, wx, wy, 18, "rgba(255,230,120,0.95)"); c.globalAlpha = 0.9; c.strokeStyle = "#fff6a0"; c.lineWidth = 1; c.strokeRect(wx - 14.5, wy - 9, 30, 16.5); c.restore(); }
    if (P.redWin) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.6; glow(c, wx, wy, 14, "rgba(255,60,90,0.95)"); c.restore(); }
    // harness straps + shoulder pads
    c.strokeStyle = STEEL_D; c.lineWidth = 4.2; c.beginPath(); c.moveTo(-15, y0 - 44); c.lineTo(-10, y0 - 24); c.moveTo(17, y0 - 44); c.lineTo(14, y0 - 24); c.moveTo(-20, y0 - 35); c.lineTo(24, y0 - 35); c.stroke();
    c.strokeStyle = STEEL; c.lineWidth = 3; c.stroke();
    c.fillStyle = "#2c2e36"; for (let i = 0; i < 6; i++) c.fillRect(-17 + i * 7.6, y0 - 35.6, 1.3, 1.3); c.fillRect(-11.6, y0 - 29, 1.3, 1.3); c.fillRect(14.4, y0 - 29, 1.3, 1.3);
    c.fillStyle = "#2a1810"; c.beginPath(); c.ellipse(-14, y0 - 43, 10, 6, -0.3, 0, 6.29); c.fill(); c.beginPath(); c.ellipse(15, y0 - 43, 10, 6, 0.3, 0, 6.29); c.fill();
    c.fillStyle = STEEL; c.beginPath(); c.ellipse(-14, y0 - 43.5, 9, 5, -0.3, 0, 6.29); c.fill(); c.beginPath(); c.ellipse(15, y0 - 43.5, 9, 5, 0.3, 0, 6.29); c.fill();
    c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(10, y0 - 47, 8, 1); c.fillRect(-18, y0 - 47, 7, 1);
    // head: thick neck, small bald head, steel headband + antenna
    const hx = 4 + (P.headX || 0), hy = y0 - 53 + (P.headY || 0);
    limb(c, 3, y0 - 45, hx, hy + 3, 9, SKIN_D);
    c.fillStyle = "#2a1810"; c.beginPath(); c.ellipse(hx, hy, 7.2, 7.6, 0, 0, 6.29); c.fill();
    c.fillStyle = SKIN; c.beginPath(); c.ellipse(hx, hy, 6.4, 6.9, 0, 0, 6.29); c.fill();
    c.fillStyle = SKIN_L; c.beginPath(); c.ellipse(hx + 2, hy - 2, 3, 3.5, 0, 0, 6.29); c.fill();
    c.fillStyle = STEEL_D; c.fillRect(hx - 6.6, hy - 4.6, 13.4, 3.2); c.fillStyle = STEEL; c.fillRect(hx - 6.4, hy - 4.4, 13, 2);
    c.fillStyle = "#2c2e36"; c.fillRect(hx - 4, hy - 4, 1, 1); c.fillRect(hx + 1, hy - 4, 1, 1);
    c.strokeStyle = STEEL_D; c.lineWidth = 1.2; c.beginPath(); c.moveTo(hx, hy - 7); c.lineTo(hx, hy - 10); c.stroke(); c.fillStyle = STEEL; c.fillRect(hx - 1.2, hy - 11.2, 2.4, 1.6);
    const eg = P.eye || 0; // eye, brow, mouth (face looks right)
    c.fillStyle = eg > 0 ? (t % 4 < 2 ? "#ffffff" : "#ff5a6a") : "#ffffff"; c.fillRect(hx + 3, hy - 1, 2.6, 1.8);
    c.fillStyle = eg > 0 ? "#ff2a3a" : "#1a1010"; c.fillRect(hx + 4.4, hy - 0.8, 1.2, 1.4);
    c.fillStyle = "#3a2010"; c.fillRect(hx + 2.4, hy - 2.4, 3.8, 0.9);
    c.fillRect(hx + 3, hy + 3.2, 3.2, P.mouth ? 1.8 : 0.8);
    if (eg > 0) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = Math.min(1, eg); glow(c, hx + 4.5, hy, 6 + eg * 4, "rgba(255,60,80,1)"); c.restore(); }
    c.restore(); // torso
    // front arm (on top)
    c.save(); c.translate(0, hipY); c.rotate(lean); c.translate(0, -hipY);
    armPose(c, 15, hipY - 41, P.armF !== undefined ? P.armF : sw * 0.6 + 0.1, P.bendF !== undefined ? P.bendF : 0.3, SKIN, !P.noFistF, P.rocketF);
    c.restore();
    c.restore();
  }
  function krangPose(api, e) {
    const s = e.state, t = e.t, P = { vuln: vulnerable(e) ? 1 : 0, walk: null };
    if (s === "walk" || s === "enter") { if (e.walkT > 0) P.walk = e.walkT * 0.16; }
    else if (s === "kwind") { P.armF = -0.7; P.bendF = 0.8; P.lean = -0.08; }
    else if (s === "kick") { const k = Math.min(1, t / 5); P.armF = api.lerp(-0.7, 1.55, k); P.bendF = api.lerp(0.8, 0.05, k); P.lean = 0.12 * k; }
    else if (s === "slam") {
      if (t < 40) { const k = Math.min(1, t / 26); P.lift = k; P.lean = -0.1 * k; P.armF = 0.9 * k; P.armB = 1.2 * k; P.bendF = 0.9; P.redWin = blink(t, 3) && t < 14; }
      else { const k = Math.max(0, 1 - (t - 40) / 8); P.lift = 0.15 * k; P.crouch = t < 60 ? 3 : 1; P.lean = 0.14; P.armF = 0.6; P.armB = 0.3; P.mouth = 1; }
    } else if (s === "throw") { P.armF = Math.PI / 2 - 0.05; P.bendF = 0; P.lean = 0.05; P.noFistF = !!e.fistOut || e.fist2; P.rocketF = !!e.fistOut; if (e.p2 && e.fist2Out) { P.armB = Math.PI / 2 - 0.15; P.bendB = 0; } P.redWin = t < 30 && blink(t, 3); }
    else if (s === "fire") { P.eye = t < 36 ? t / 36 : 1; P.headY = 1; P.armF = 0.25; P.armB = 0.1; P.mouth = 1; }
    else if (s === "summon") { P.armB = Math.PI - 0.4; P.bendB = -0.2; P.armF = 0.6; P.mouth = 1; }
    else if (s === "rage") { P.armF = Math.PI - 0.5 + Math.sin(t * 0.3) * 0.15; P.armB = Math.PI - 0.3 - Math.sin(t * 0.3) * 0.15; P.bendF = P.bendB = -0.3; P.mouth = 1; P.redWin = blink(t, 4); }
    else if (s === "hurt") { P.lean = -0.18; P.armF = 0.5; P.armB = -0.3; P.mouth = 1; }
    else if (s === "stagger") { P.lean = -0.12 + (t % 4 < 2 ? 0.04 : -0.04); P.armF = 0.9; P.armB = 0.7; P.mouth = 1; P.headX = -1; }
    else if (s === "down") { P.lie = Math.min(1, t / 10); P.armF = 2.2; P.armB = 2.6; }
    else if (s === "getup") { P.lie = Math.max(0, 1 - t / 16); P.crouch = 3; }
    else if (s === "dying") { P.lie = Math.min(1, t / 26); P.armF = 2.4; P.armB = 2.8; P.mouth = 1; }
    else if (s === "phase") { P.armF = 0.4; P.armB = 0.2; }
    return P;
  }
  function drawWreck(api, w, cx) { // the empty android lying in the plaza after the KO
    const c = api.ctx; api.contactShadow(w.x - cx, w.y, 0, 26);
    drawKrang(api, w.x - cx, w.y, w.f, { lie: 1, armF: 2.4, armB: 2.8, vuln: 0, walk: null, empty: true });
    if (api.t % 30 < 3) api.fx("spark", w.x - w.f * 30 + api.rnd(-8, 8), w.y - 6, 8);
    if (api.t % 24 === 0) api.fx("smoke", w.x - w.f * 20 + api.rnd(-14, 14), w.y - 10, 22);
  }

  // ---- Krang's custom moves ----
  const P2CFG = { speed: 1.05, cool: 58 };
  function pick(api, e, p) {
    const dx = p.x - e.x, ax = Math.abs(dx), cfg = e.cfg;
    e.t = 0; e.cool = cfg.cool + (Math.random() * 24 | 0); e.facing = dx >= 0 ? 1 : -1;
    if (ax < 32 && Math.random() < 0.7) { e.state = "kwind"; return; }
    const opts = ["slam", "throw", "fire"];
    if (ax < 70) opts.push("slam");
    if (ax > 60) opts.push("throw", "fire");
    if (!(e.sumCd > 0) && G.mousers.length < 3) opts.push("summon");
    let m = opts[Math.random() * opts.length | 0];
    if (m === e.lastMove && Math.random() < 0.65) m = opts[Math.random() * opts.length | 0];
    e.lastMove = m; e.state = m;
    if (m === "throw") { e.fistOut = false; e.fist2 = false; e.fist2Out = false; e.row = p.y; }
    if (m === "fire") { G.laser = { on: false, tx: p.x, y: p.y, x: e.x, dir: e.facing, n: 0 }; api.SFX.charge(); }
  }
  function launchFist(api, e, p, second) {
    const f = e.facing, y = second ? Math.max(api.floorTop, Math.min(api.floorBot, p.y)) : e.row;
    const s = { x: e.x + f * 26, y, z: 30, vx: f * 4.4, kind: "fist", owner: e, back: false, hit: new Set(), t: 0, second, f,
      update: fistUpdate, draw: fistDraw };
    api.shot(s); api.SFX.gun(); api.SFX.rumble(); api.fx("smoke", e.x + f * 22, y - 30, 14);
    if (second) e.fist2Out = true; else e.fistOut = true;
  }
  function fistUpdate(api, s) {
    const p = api.player, e = s.owner; s.t++;
    if (!e || e.state === "dying" || e.gone) { s.dead = true; api.fx("smoke", s.x, s.y - 30, 14); if (e) { e.fistOut = false; e.fist2Out = false; } return true; }
    if (!s.back) {
      s.x += s.vx;
      const blk = G && G.mods.find((m) => m.st === "rest" && Math.abs(m.y - s.y) < MD + 4 && Math.abs(m.x - s.x) < MW + 4);
      if (blk) { crushModule(api, blk); s.back = true; }
      if (s.x < api.camX + 6 || s.x > api.camX + api.W - 6 || s.t > 90) { s.back = true; s.hit = new Set(); api.SFX.land(); api.fx("spark", s.x, s.y - 30, 8); }
    } else { // home in on the arm socket
      const hx = e.x + e.facing * 24, hy = e.y, dx = hx - s.x, dy = hy - s.y, d = Math.hypot(dx, dy);
      if (d < 7 || s.t > 220) { s.dead = true; if (s.second) e.fist2Out = false; else e.fistOut = false; api.SFX.clink(); return true; }
      s.x += dx / d * 4.2; s.y += dy / d * Math.min(4.2, d) * 0.6; s.vx = dx > 0 ? 4 : -4;
    }
    if (canHurt(p) && !s.hit.has(p) && Math.abs(p.x - s.x) < 11 && Math.abs(p.y - s.y) < 6 && p.z < 22) { s.hit.add(p); api.hurtPlayer(2, false, s.vx > 0 ? 1 : -1); }
    for (const en of api.enemies) if (hittable(en) && !s.hit.has(en) && Math.abs(en.x - s.x) < 11 && Math.abs(en.y - s.y) < 6) { s.hit.add(en); api.hitEnemy(en, 2, true, s.vx > 0 ? 1 : -1); }
    if (G) for (const q of G.mousers) if (Math.abs(q.x - s.x) < 9 && Math.abs(q.y - s.y) < 5) killMouser(api, q);
    return true;
  }
  function fistDraw(api, s, sx, sy) {
    const c = api.ctx, f = s.vx >= 0 ? 1 : -1, y = s.y - s.z;
    c.save(); c.translate(sx, y); c.scale(f, 1);
    c.globalCompositeOperation = "lighter"; // jet flame out of the wrist
    for (let i = 0; i < 3; i++) { c.fillStyle = ["rgba(255,90,30,0.7)", "rgba(255,180,60,0.8)", "rgba(255,250,200,0.9)"][i]; c.beginPath(); c.moveTo(-6, -3 + i); c.lineTo(-18 + i * 4 - (api.t % 3) * 2, 0); c.lineTo(-6, 3 - i); c.closePath(); c.fill(); }
    c.globalCompositeOperation = "source-over";
    c.fillStyle = STEEL_D; c.fillRect(-7, -4.5, 4, 9); c.fillStyle = STEEL; c.fillRect(-7, -4.5, 4, 2);
    c.fillStyle = "#2a1810"; c.beginPath(); c.arc(0, 0, 6.4, 0, 6.29); c.fill();
    c.fillStyle = SKIN; c.beginPath(); c.arc(0, 0, 5.5, 0, 6.29); c.fill();
    c.strokeStyle = "rgba(60,30,10,0.6)"; c.lineWidth = 0.6; c.beginPath(); for (let i = -1; i <= 2; i++) { c.moveTo(3, i * 2 - 1); c.lineTo(5.5, i * 2 - 1); } c.stroke();
    c.restore();
  }

  const bossCfg = {
    name: "KRANG", base: "ramrod", atlas: "ramrod", height: 96, hp: 34, speed: 0.75, chargeSpeed: 1, cool: 84, pitch: 190,
    moves: ["kick", "slam", "throw", "fire", "summon"],
    lines: {
      intro: "BEHOLD! THE TECHNODROME HAS ARRIVED!",
      hit: ["OW! WATCH THE MERCHANDISE!", "MY BEAUTIFUL BODY!", "YOU INSOLENT REPTILES!", "OOH, THAT SMARTS!"],
      summon: "MOUSERS! CHEW THEM UP!",
      ko: "NO! NOT MY BODY! SHREDDERRR!",
    },
    spawn(api, e) { Object.assign(e, { state: "phase", t: 0, x: 250, y: 186, z: 0, facing: -1, inv: 999, sumCd: 520, vuln: 0 }); api.SFX.zap(); },
    update(api, e, p) {
      const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0);
      if (e.state === "phase") { // teleported in by a beam from the Technodrome
        e.inv = 2; e.facing = p.x < e.x ? -1 : 1;
        if (e.t % 12 === 0 && e.t < 80) { api.SFX.zap(); api.shake(1, 6, true); }
        if (e.t === 70) { api.SFX.boom(); api.shake(3, 14, true); api.dust(e.x - 14, e.y); api.dust(e.x + 14, e.y); }
        if (e.t === 130) api.enemySay(e, bossCfg.lines.intro, 100, 190, true);
        if (e.t === 225) api.enemySay(e, "NOW, TURTLES... TASTE MY NEW BODY!", 90, 190, true);
        if (e.t >= 300) { e.inv = 0; e.state = "walk"; e.t = 0; e.cool = 40; e.go = true; }
        return true;
      }
      if (e.state === "rage") { // phase 2: the Technodrome rains modules, Krang powers up
        e.inv = 2; e.facing = p.x < e.x ? -1 : 1;
        if (e.t === 1) { api.enemySay(e, "TECHNODROME! FULL POWER! CRUSH THEM!", 110, 200, true); api.SFX.charge(); }
        if (e.t % 10 === 0) { api.shake(2, 8, true); api.fx("spark", e.x + api.rnd(-16, 16), e.y - api.rnd(20, 80), 10); }
        if (e.t === 40) { G.salvo = 22 * 4 + 1; G.flash = 0.5; api.SFX.boom(); }
        if (e.t >= 170) {
          e.p2 = true; e.cfg = Object.assign({}, e.cfg, P2CFG); e.rageLock = false; e.sumCd = 360;
          api.playerBark(true, "HE'S OVERLOADING! WATCH THE SKY!"); e.state = "walk"; e.t = 0; e.cool = 30;
        }
        return true;
      }
      if (e.state === "walk" && !e.p2 && !e.rageLock && e.hp <= e.maxHp * 0.5) { e.state = "rage"; e.t = 0; e.rageLock = true; return true; }
      if (e.state === "walk" && free && e.cool <= 1 && !e.fistOut && !e.fist2Out) { pick(api, e, p); return true; }
      if (e.state === "slam") { // STOMP: leg up (40 f), crash + shockwave ring(s), then stuck (brain exposed)
        if (e.t === 1) api.SFX.charge();
        if (e.t === 40) {
          api.SFX.boom(); api.shake(5, 16, true); api.STATE.shake = Math.max(api.STATE.shake, 10); api.dust(e.x - 12, e.y); api.dust(e.x + 12, e.y); api.fx("ring", e.x + e.facing * 8, e.y, 18);
          G.rings.push({ x: e.x + e.facing * 8, y: e.y, r: 12, hit: new Set() });
          if (e.p2) G.rings.push({ x: e.x + e.facing * 8, y: e.y, r: 12, hit: new Set(), delay: 26 });
          if (canHurt(p) && p.z < 4 && Math.abs(p.x - e.x - e.facing * 8) < 24 && Math.abs(p.y - e.y) < 12) api.hurtPlayer(2, false, p.x >= e.x ? 1 : -1);
          e.vuln = 80; G.toldGlow++;
        }
        if (e.t > 40 && e.t % 9 === 0 && e.t < 100) api.fx("spark", e.x + e.facing * 10, e.y - 4, 8);
        if (e.t >= 104) { e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "throw") { // FIST ROCKET: aim (red line), launch, wait for the fist to come home
        if (e.t < 34) { e.facing = p.x >= e.x ? 1 : -1; e.row = api.lerp(e.row, p.y, 0.15); e.y += Math.sign(e.row - e.y) * Math.min(0.5, Math.abs(e.row - e.y)); }
        if (e.t === 34) { launchFist(api, e, p, false); G.toldGlow++; }
        if (e.p2 && e.t === 58) launchFist(api, e, p, true);
        if (e.t > 40 && !e.fistOut && !e.fist2Out) { e.state = "walk"; e.t = 0; e.vuln = 20; }
        if (e.t > 260) { e.fistOut = e.fist2Out = false; e.state = "walk"; e.t = 0; }
        return true;
      }
      if (e.state === "fire") { // EYE LASER: charge + target line (36 f), then the beam sweeps out along your lane
        const L = G.laser; if (!L) { e.state = "walk"; e.t = 0; return true; }
        if (!L.on) {
          if (e.t < 30) { L.tx = api.lerp(L.tx, p.x, 0.12); L.y = api.lerp(L.y, p.y, 0.12); e.facing = L.tx >= e.x ? 1 : -1; }
          if (e.t >= 36) { L.on = true; L.x = e.x + e.facing * 14; L.dir = e.facing; L.stop = false; L.n++; api.SFX.zap(); api.SFX.gun(); }
        } else if (L.stop || L.x < api.camX - 10 || L.x > api.camX + api.W + 10) {
          if (e.p2 && L.n < 2) { Object.assign(L, { on: false, tx: p.x, y: p.y, n: L.n }); e.t = 10; api.SFX.charge(); }
          else { G.laser = null; e.state = "stagger"; e.t = 0; e.vx = 0; e.vuln = 70; G.toldGlow++; api.fx("smoke", e.x + e.facing * 6, e.y - 88, 22); } // overheated
        }
        return true;
      }
      if (e.state === "summon") {
        if (e.t === 14) {
          api.enemySay(e, bossCfg.lines.summon, 80, 190);
          const n = e.p2 ? 4 : 3;
          for (let i = 0; i < n; i++) spawnMouser(api, e.x + (i - (n - 1) / 2) * 18 + e.facing * 10, e.y + api.rnd(-10, 10));
          e.sumCd = e.p2 ? 620 : 820; e.vuln = 60; api.SFX.door();
        }
        if (e.t >= 50) { e.state = "walk"; e.t = 0; }
        return true;
      }
      return false; // kwind / kick (the engine's close-range blow), hurt etc.
    },
    draw(api, e, sx, sy) {
      const c = api.ctx;
      if (e.state === "phase") { // materialise inside a violet beam
        const t = e.t, k = Math.min(1, Math.max(0, (t - 20) / 50));
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = t < 90 ? 0.75 : Math.max(0, 0.75 - (t - 90) / 40);
        const bw = 20 + Math.sin(t * 0.5) * 3, g = c.createLinearGradient(sx - bw, 0, sx + bw, 0);
        g.addColorStop(0, "rgba(160,60,255,0)"); g.addColorStop(0.5, "rgba(230,190,255,0.95)"); g.addColorStop(1, "rgba(160,60,255,0)");
        c.fillStyle = g; c.fillRect(sx - bw, 0, bw * 2, sy + 2); c.restore();
        if (k <= 0) return;
        c.save(); c.globalAlpha = k < 1 ? (t % 4 < 2 ? k : k * 0.4) : 1;
        drawKrang(api, sx, sy, e.facing, { vuln: 0, walk: null, armF: 0.4, armB: 0.2 }); c.restore();
        if (k < 1) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.5; c.fillStyle = "#c88aff"; for (let i = 0; i < 9; i++) c.fillRect(sx - 24, sy - 92 + i * 10 + (t % 10), 48, 1); c.restore(); }
        return;
      }
      if (e.state === "rage" || e.p2) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = (e.state === "rage" ? 0.45 : 0.18) + 0.12 * Math.sin(api.t * 0.2); glow(c, sx, sy - 46, 56, "rgba(190,80,255,0.8)"); c.restore(); }
      api.contactShadow(sx, e.y, e.z, 22);
      const P = krangPose(api, e), jx = e.state === "kwind" ? -e.facing : 0;
      drawKrang(api, sx + jx, sy, e.facing, P);
      if (e.state === "rage" && api.t % 6 < 3) { c.save(); c.strokeStyle = "#e8c8ff"; c.lineWidth = 1; zig(c, sx + api.rnd(-18, 18), sy - 96, sx + api.rnd(-18, 18), sy - 10, 6, 5); c.restore(); }
    },
    onDefeat(api, e) { if (G) { G.rings = []; G.laser = null; G.salvo = 0; for (const q of G.mousers) killMouser(api, q); G.wreckAt = { x: e.x, y: e.y, f: e.facing }; } },
  };

  // ================= OUTRO: Krang's brain flees, Shredder retreats to his tower =================
  function drawBrainWalker(api, x, y, z, t, f) {
    const c = api.ctx; api.shadow(x, y, z, 6);
    c.save(); c.translate(x, y - z); c.scale(f, 1);
    c.strokeStyle = "#d86a88"; c.lineWidth = 1.3; c.lineCap = "round"; // tentacle legs
    for (let i = 0; i < 4; i++) { const ph = t * 0.5 + i * 1.7; c.beginPath(); c.moveTo(-4 + i * 2.6, -5); c.quadraticCurveTo(-6 + i * 3 + Math.sin(ph) * 3, -2, -5 + i * 3.2 + Math.sin(ph + 1) * 2, 0); c.stroke(); }
    drawBrain(c, 0, -9, 6.5, 4.6, t, true);
    c.restore();
  }
  function drawShredder(api, x, y, k, t) { // small figure in the hatch doorway: steel-tinted ninja + spiked helmet + cape
    const c = api.ctx, sheet = api.tintSheet("ninja", { sepia: 0.3, sat: 0.35, hue: 200, bri: 1.15 }), F = api.ATLAS.ninja, h = 150 * k;
    c.save(); c.fillStyle = "#4a1a6a"; c.beginPath(); c.moveTo(x - 5, y - h * 0.82); c.lineTo(x + 5, y - h * 0.82); c.lineTo(x + 9 + Math.sin(t * 0.1) * 1.5, y - 1); c.lineTo(x - 10 + Math.sin(t * 0.1 + 1) * 1.5, y - 1); c.closePath(); c.fill(); c.restore();
    if (sheet) api.drawFrame(sheet, F.idle, x, y, k, -1); else api.rect(x - 4, y - h, 8, h, "#8a8ea0");
    const hy = y - h * 0.93;
    c.fillStyle = "#3a3e4a"; c.beginPath(); c.ellipse(x - 0.3, hy + 2.2, 3.4, 3.6, 0, 0, 6.29); c.fill(); // steel helmet + face mask
    c.fillStyle = "#c8ccd8"; c.beginPath(); c.ellipse(x - 0.3, hy + 2, 2.9, 3.1, 0, 0, 6.29); c.fill();
    c.fillStyle = "#1a1a22"; c.fillRect(x - 2.6, hy + 1.6, 4.4, 0.9); c.fillStyle = "#ff3a3a"; c.fillRect(x - 2.2, hy + 1.7, 1, 0.6); c.fillRect(x + 0.2, hy + 1.7, 1, 0.6);
    c.fillStyle = "#8a90a0"; for (let i = -2; i <= 1; i++) c.fillRect(x + i * 1.1, hy + 3.4, 0.5, 1.4); // mouth grille
    c.fillStyle = "#c8ccd8";
    c.beginPath(); c.moveTo(x - 1, hy - 2); c.lineTo(x + 1, hy - 2); c.lineTo(x, hy - 8); c.closePath(); c.fill(); // helmet blade
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * 2, hy); c.lineTo(x + s * 3, hy + 1); c.lineTo(x + s * 7, hy - 4); c.closePath(); c.fill(); } // side horns
    c.fillStyle = "#c8ccd8"; for (const s of [-1, 1]) { const sx = x + s * 4.5, sy = y - h * 0.74; c.fillStyle = "#c8ccd8"; c.beginPath(); c.ellipse(sx, sy + 1, 3, 1.8, 0, 0, 6.29); c.fill(); c.beginPath(); c.moveTo(sx - 1, sy); c.lineTo(sx + s * 5, sy - 4); c.lineTo(sx + s * 2, sy + 1.5); c.closePath(); c.fill(); c.beginPath(); c.moveTo(sx + 1, sy); c.lineTo(sx + s * 2, sy - 5); c.lineTo(sx + s * 3, sy); c.closePath(); c.fill(); } // spiked shoulder armour
  }
  const OUT_DOOR = { x: 192, y: 160, z: 33 };
  const outro = {
    update(api, st, t) {
      const p = api.player, S = api.STATE;
      S.fx = S.fx.filter((f) => ++f.t < f.life); // the engine does not tick effects during an outro (see NOTES.md)
      if (t === 1) {
        G = G || fresh(); G.rings = []; G.laser = null; G.mousers = []; G.salvo = 0;
        const w = G.wreckAt || { x: 230, y: 188, f: -1 }; G.wreck = w;
        Object.assign(st, { bx: w.x - w.f * 6, by: w.y, bz: 18, bvz: 2.4, ph: "pop", shred: 0, cap: -1 });
        api.SFX.door(); api.fx("smoke", w.x, w.y - 16, 24);
      }
      // brain hops out of the wreck, then scuttles to the hatch and up the ramp
      if (st.ph === "pop") { st.bz += st.bvz; st.bvz -= 0.2; st.bx -= G.wreck.f * 0.6; if (st.bz <= 0) { st.bz = 0; st.ph = "run"; api.SFX.land(); } }
      else if (st.ph === "run") {
        const dx = OUT_DOOR.x - st.bx, dy = OUT_DOOR.y - st.by;
        st.bx += Math.sign(dx) * Math.min(1.6, Math.abs(dx)); st.by += Math.sign(dy) * Math.min(0.8, Math.abs(dy)); st.bf = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) st.ph = "ramp";
      } else if (st.ph === "ramp") { st.bz += 0.5; if (st.bz >= OUT_DOOR.z) { st.ph = "in"; st.inT = t; api.SFX.door(); } }
      if (t === 30) st.say = { s: "I'LL BE BACK FOR YOU, TURTLES!", t: 110, who: "brain" };
      if (t === 70) api.playerBark(true, "THE BRAIN'S GETTING AWAY!");
      // the brother steps toward the hatch
      const tx = 150, ty = 180, dx = tx - p.x, dy = ty - p.y;
      if (t > 60 && t < 260 && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) { p.x += Math.sign(dx) * Math.min(1.2, Math.abs(dx)); p.y += Math.sign(dy) * Math.min(0.8, Math.abs(dy)); p.walkT++; p.facing = dx >= 0 ? 1 : -1; } else p.walkT = 0;
      if (st.ph === "in" && !st.shred && t - st.inT > 20) { st.shred = t; api.SFX.confirm(); api.fx("smoke", 192, 126, 26); api.fx("smoke", 186, 118, 24); }
      if (st.shred) {
        const k = t - st.shred;
        if (k === 16) st.say = { s: "YOU WANT ME, TURTLES? COME CLIMB MY TOWER!", t: 140, who: "shred" };
        if (k === 170) { api.SFX.boom(); api.fx("smoke", 192, 120, 30); api.fx("smoke", 198, 112, 28); api.fx("smoke", 186, 116, 26); st.gone = true; }
        if (k > 180 && k < 220) { G.hatchShut = (k - 180) / 40; if (k === 181) api.SFX.door(); }
        if (k === 220) { api.SFX.rumble(); api.shake(4, 40, true); G.flash = 0.6; }
        if (k === 250) api.playerBark(true, "SHREDDER'S TOWER... THIS ENDS TONIGHT!");
        if (k === 300) { st.cap = 0; api.SFX.confirm(); }
        if (k > 560) return true;
      }
      if (st.say && --st.say.t <= 0) st.say = null;
      if (st.cap >= 0) st.cap++;
      return t > 1500;
    },
    draw(api, st, t, cx) {
      if (st.bx === undefined) return;
      const c = api.ctx;
      if (st.shred && !st.gone) { const k = t - st.shred; c.save(); c.globalAlpha = Math.min(1, k / 12); drawShredder(api, 192 - cx, 127, 0.19, t); c.restore(); }
      if (st.ph !== "in") drawBrainWalker(api, st.bx - cx, st.by, st.bz, t, st.bf || -1);
      if (st.say) {
        if (st.say.who === "brain" && st.ph !== "in") api.bubble(st.bx - cx, st.by - st.bz - 22, st.say.s, "#c0305a", 7);
        if (st.say.who === "shred" && !st.gone) api.bubble(192 - cx, 92, st.say.s, "#5a1a8a", 7);
      }
      if (st.cap >= 0) { // caption: the next level, never THE END
        const a = Math.min(1, st.cap / 25);
        c.globalAlpha = 0.5 * a; api.rect(0, 30, api.W, 50, "#07040c"); c.globalAlpha = a;
        api.ptext("NEXT: THE FINAL ASCENT", api.W / 2, 44, 2, st.cap % 24 < 12 ? "#ffe060" : "#ffb21a");
        if (st.cap > 40) api.ptext("SHREDDER WAITS AT THE TOP OF HIS TOWER.", api.W / 2, 66, 1, "#ffffff");
        c.globalAlpha = 1;
      }
    },
  };

  SS.registerLevel({
    number: 14,
    name: "TECHNODROME PORTAL",
    card: { title: "TECHNODROME PORTAL", tagline: "THE WAR MACHINE IS PHASING INTO NEW YORK!", color: "#b04aff" },
    music, bossMusic,
    hues: { purple: 235, sword: 265, star: 320, blue: 185, heavy: 12, gunner: 192, dasher: 290 },
    images: [],
    sections: [
      { bg: BG1, floor: [170, 214], length: 2800, locks: [0, 680, 1380, 2080],
        waves: [["purple", "purple", "star"], ["purple", "heavy", "gunner", "sword"], ["heavy", "gunner", "blue", "star"], ["heavy", "heavy", "gunner", "dasher", "sword"]],
        weather: "embers", hazards: [street], sky: "#1a0c2c", ground: "#3a3444" },
      { bg: BG2, floor: [160, 216], length: 384, locks: [], waves: [], hazards: [arena], weather: "embers", sky: "#1a0c2c", ground: "#3a3048" },
    ],
    boss: bossCfg,
    outro,
    onStart() { G = fresh(); },
    onUnload() { G = null; street.init = arena.init = null; },
  });
})();
