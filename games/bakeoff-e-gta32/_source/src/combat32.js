  // =====================================================================================================
  // ---------- COMBAT 360 (prototype E): the reused 16-bit combat (combo timing, hitEnemy, hurtPlayer, specials, SFX) driven in
  // full 3D. The hero has a real heading; cuts land in a cone in front of it; a soft lock turns each swing toward the best foe and
  // steps in; the five foot soldiers surround, circle and attack from any side (two attack tokens), with a short leash home. ----------
  // =====================================================================================================
  const C32 = {
    CUT: { c1: [1.7, 70], c2: [1.7, 75], c3: [1.9, 88], jump: [1.6, 180], power: [2.2, 180] }, // reach (m), half cone (deg)
    AGGRO: 7, LEASH: 8, LOSE: 11, RESPAWN: 540,
    stat: { hits: [], hurts: [], kills: 0, atks: [] },
  };
  const g32 = (e) => toGlobal(STATE.zone, e.x, e.y);
  function mv32(e, wx, wz) { const z = STATE.zone; e.x += (wx * z.u[0] + wz * z.u[1]) / PX; e.y += (wx * z.v[0] + wz * z.v[1]) / DY; }
  const yawTo = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);
  const faceSign = (hy) => { const z = STATE.zone; return Math.sin(hy) * z.u[0] + Math.cos(hy) * z.u[1] >= 0 ? 1 : -1; };
  const engaged32 = (e) => isFoot32(e) ? !e.idle && !e.home && e.state !== "out" : e.state !== "out";
  // ---- the hero ----
  function heading32(p, w, attacking) { // called from move3D with the world move direction
    const want = Math.atan2(w.x, w.z); if (p.hy === undefined) p.hy = want;
    if (!attacking) p.hy = wrapA(p.hy + wrapA(want - p.hy) * 0.32);
    p.facing = faceSign(p.hy);
  }
  function pickTarget32(p, intent, maxD) {
    let best = null, bs = 1e9;
    for (const e of STATE.enemies) {
      if (!canHitState(e) || e.state === "out") continue;
      const g = g32(e), dx = g.gx - p.gx, dz = g.gz - p.gz, d = Math.hypot(dx, dz); if (d > maxD) continue;
      const da = Math.abs(wrapA(Math.atan2(dx, dz) - intent)); if (da > 115 * DEG && d > 2.0) continue;
      const s = d * (1 + 1.3 * da / Math.PI) - (e === STATE.lock32 ? 0.35 : 0); if (s < bs) { bs = s; best = { e, d, dx, dz }; }
    }
    return best;
  }
  function aim32(p) { // soft aim: turn the swing to the best foe in front (stick = intent), and step in when it is a little out of reach
    const v = inputVec(); let intent = p.hy || 0;
    if (v) { const w = stickToWorld(v.dx, v.dy); intent = Math.atan2(w.x, w.z); }
    const T = pickTarget32(p, intent, 4.2); p.lunge32 = null;
    if (!T) { p.hy = intent; p.facing = faceSign(p.hy); return; }
    p.hy = Math.atan2(T.dx, T.dz); p.facing = faceSign(p.hy); STATE.lock32 = T.e;
    if (T.d > 1.2) { const n = 8, s = Math.min(T.d - 1.05, 1.6) / n; p.lunge32 = { x: T.dx / T.d * s, z: T.dz / T.d * s, n }; }
  }
  function lunge32(p) { const L = p.lunge32; if (!L || L.n <= 0) return; mv32(p, L.x, L.z); L.n--; }
  function lockStep32(p) { // the sticky soft lock the ring + camera use
    const cur = STATE.lock32, ok = (e) => e && STATE.enemies.includes(e) && canHitState(e) && engaged32(e);
    let dc = 1e9; if (ok(cur)) { const g = g32(cur); dc = Math.hypot(g.gx - p.gx, g.gz - p.gz); if (dc > 7.5) dc = 1e9; }
    let best = null, bd = 1e9;
    for (const e of STATE.enemies) { if (!ok(e)) continue; const g = g32(e), d = Math.hypot(g.gx - p.gx, g.gz - p.gz); if (d < bd) { bd = d; best = e; } }
    if (dc < 1e8 && !(best && best !== cur && bd < dc * 0.55)) return;
    STATE.lock32 = best && bd < 6.5 ? best : null;
  }
  function knock32(e, nx, nz, p) {
    e.hy = Math.atan2(-nx, -nz); e.vx = 0;
    if (e.state === "fly") { e.state = "down"; e.t = 0; e.vz = 4.6; e.z = Math.max(e.z || 0, 0.1); e.bounced = false; e.kv = { x: nx * 0.11, z: nz * 0.11 }; return; }
    if (e.state === "down") e.kv = { x: nx * 0.08, z: nz * 0.08 };
    else if (e.state === "hurt") e.kv = { x: nx * 0.05, z: nz * 0.05 };
    if (e.idle || e.home) { e.idle = false; e.home = false; e.back = 0; }
  }
  function hits360(p) {
    const k = p.atk; if (!k || k === "throw") return;
    const pr = 1 - p.attackT / p.atkDur, power = k === "power", combo = k[0] === "c";
    const sp = combo ? swingPhase(p) : null;
    if (combo) { if (!sp || sp.ph !== "strike") return; }
    else if (power ? pr < 0.1 || pr > 0.9 : pr < 0.3) return;
    const [R, cone] = C32.CUT[k] || [1.7, 70];
    const dmg = power ? (p.spec ? p.spec.dmg : 3) : k === "jump" ? 2 : k === "c3" ? 2 : 1;
    const inCone = (gx, gz, zz) => {
      const dx = gx - p.gx, dz = gz - p.gz, d = Math.hypot(dx, dz);
      if (d > R || Math.abs((zz || 0) - p.z) * ZH > 1.15) return false;
      return cone >= 180 || d < 0.4 || Math.abs(wrapA(Math.atan2(dx, dz) - p.hy)) < cone * DEG;
    };
    for (const e of STATE.enemies) {
      const juggle = e.state === "down" && e.z > 0 && !e.juggled && e.hp > 0;
      if (p.hitSet.has(e) || e.inv > 0 || e.state === "out" || !(juggle || canHitState(e))) continue;
      const g = g32(e); if (!inCone(g.gx, g.gz, e.z)) continue;
      p.hitSet.add(e); if (juggle) e.juggled = true;
      const dx = g.gx - p.gx, dz = g.gz - p.gz, d = Math.hypot(dx, dz) || 1;
      hitEnemy(e, dmg, k !== "c1" && k !== "c2", faceSign(Math.atan2(dx, dz)), k === "c1" ? 3 : 4, k === "c3" || power);
      knock32(e, dx / d, dz / d, p);
      if (combo && STATE.stop < 2) STATE.stop = 2;
      STATE.fx.push({ kind: "wspark", x: e.x, y: e.y - 20 - e.z, t: 0, life: 9, c: "#8fc0ff", dir: p.facing });
      // where the foe stood relative to the camera when it was cut (the test reads this: fights from every side)
      C32.stat.hits.push({ cam: Math.round(wrapA(Math.atan2(dx, dz) - Math.atan2(CAM.fwd.x, CAM.fwd.z)) / DEG), k, t: STATE.t });
      if (C32.stat.hits.length > 400) C32.stat.hits.shift();
    }
    for (const pr2 of STATE.props || []) {
      if (pr2.state !== "idle" || p.hitSet.has(pr2)) continue;
      const g = g32(pr2); if (!inCone(g.gx, g.gz, 0)) continue;
      p.hitSet.add(pr2); propHit(pr2, dmg, faceSign(Math.atan2(g.gx - p.gx, g.gz - p.gz)), k === "c3" || power);
    }
  }
  function hurt32(p, e, dmg, knock) { // a foot soldier's blow lands: the hero turns to it and is pushed / knocked away from it
    const g = g32(e), dx = p.gx - g.gx, dz = p.gz - g.gz, d = Math.hypot(dx, dz) || 1;
    C32.stat.hurts.push({ rel: Math.round(wrapA(Math.atan2(-dx, -dz) - (p.hy || 0)) / DEG), t: STATE.t, type: e.type });
    if (C32.stat.hurts.length > 200) C32.stat.hurts.shift();
    const hp0 = p.hp, inv0 = p.inv;
    p.kdx = dx / d; p.kdz = dz / d;
    hurtPlayer(dmg, false, knock ? 1 : 0);
    if (p.hp < hp0 || p.inv > inv0) { p.hy = Math.atan2(-dx, -dz); p.facing = faceSign(p.hy); if (!knock) mv32(p, dx / d * 0.14, dz / d * 0.14); }
  }
  function down32(p) { const s = Math.abs(p.kvx) * PX * 1.5; mv32(p, (p.kdx || 0) * s, (p.kdz || 0) * s); p.kvx *= 0.9; }
  // ---- the foot soldiers ----
  function tokens360(p) {
    const pool = STATE.enemies.filter((e) => isFoot32(e));
    for (const e of pool) if (e.token && (!engaged32(e) || !["walk", "attack"].includes(e.state))) e.token = false;
    const n = pool.filter((e) => e.token).length;
    if (n >= 2 || p.deadT > 0) return;
    pool.filter((e) => !e.token && engaged32(e) && e.state === "walk" && !(e.back > 0) && (e.cool || 0) < 20)
      .map((e) => { const g = g32(e); return [e, Math.hypot(g.gx - p.gx, g.gz - p.gz)]; }).sort((a, b) => a[1] - b[1])
      .slice(0, 2 - n).forEach(([e]) => (e.token = true));
  }
  const ATK32 = {
    purple: () => ({ kind: "punch", hit: 16, end: 32, reach: 1.45, dmg: 1, knock: 0 }),
    blue: () => (Math.random() < 0.55 ? { kind: "kick", hit: 15, end: 34, reach: 1.6, dmg: 2, knock: Math.random() < 0.3 } : { kind: "punch", hit: 13, end: 28, reach: 1.45, dmg: 1, knock: 0 }),
    dasher: () => ({ kind: "punch", hit: 14, end: 30, reach: 1.45, dmg: 1, knock: 0 }),
  };
  function turnTo(e, yaw, k) { e.hy = wrapA((e.hy || 0) + wrapA(yaw - (e.hy || 0)) * k); }
  function ai360(e, p) {
    const D = edef(e);
    if (e.flash > 0) e.flash--; if (e.inv > 0) e.inv--; if (e.sayT > 0) e.sayT--; e.t++;
    if (e.hy === undefined) e.hy = Math.random() * 6.28;
    const g = g32(e), dx = p.gx - g.gx, dz = p.gz - g.gz, d = Math.hypot(dx, dz) || 0.001, toP = Math.atan2(dx, dz), alive = p.deadT === 0;
    const gp = e.gpost || { x: g.gx, z: g.gz }, dpost = Math.hypot(g.gx - gp.x, g.gz - gp.z);
    const st = e.state;
    if (st === "fly") { e.state = "down"; e.vz = 4.6; e.z = Math.max(0.1, e.z || 0); e.kv = e.kv || { x: -Math.sin(toP) * 0.1, z: -Math.cos(toP) * 0.1 }; }
    if (e.state === "walk") {
      coolTick(e);
      // leash: idle at the post -> wake (with the pack) when the hero comes near -> chase a short way -> walk home
      if (e.idle && alive && d < C32.AGGRO) { e.idle = false; e.home = false; e.cool = Math.max(e.cool || 0, 18); for (const o of STATE.enemies) if (o.idle && o.gpost && Math.hypot(o.gpost.x - gp.x, o.gpost.z - gp.z) < 6) { o.idle = false; o.cool = Math.max(o.cool || 0, 30); } }
      if (e.home && alive && d < C32.AGGRO * 0.6 && dpost < C32.LEASH * 0.7) e.home = false;
      if (!e.idle && !e.home && (dpost > C32.LEASH || d > C32.LOSE || !alive)) { e.home = true; e.token = false; e.back = 0; }
      if (e.idle) { e.walkT = 0; if (d < 14) turnTo(e, toP, 0.06); return; }
      if (e.home) {
        const hx = gp.x - g.gx, hz = gp.z - g.gz, hd = Math.hypot(hx, hz);
        if (hd < 0.25) { e.home = false; e.idle = true; e.walkT = 0; return; }
        const s = Math.min(0.038, hd); mv32(e, hx / hd * s, hz / hd * s); turnTo(e, Math.atan2(hx, hz), 0.15); e.walkT++; return;
      }
      // engaged: tokens step in, the rest hold a ring around the hero and circle; blue ones work round behind
      if (e.back > 0) e.back--;
      const tok = e.token && !(e.back > 0);
      let bA = Math.atan2(-dx, -dz);
      if (!tok) { bA += (e.side || 1) * 0.0055; if (D.circleBehind) bA += wrapA((p.hy || 0) + Math.PI - bA) * 0.012; }
      const ring = tok ? (e.type === "dasher" && (e.cool || 0) === 0 ? 3.6 : 1.05) : 2.4 + ((e.ring || 0) / 20) * 0.9;
      let tx = p.gx + Math.sin(bA) * ring, tz = p.gz + Math.cos(bA) * ring;
      for (const o of STATE.enemies) { // spread out round the hero
        if (o === e || o.state === "out" || !isFoot32(o)) continue; const og = g32(o), sx = g.gx - og.gx, sz = g.gz - og.gz, sd = Math.hypot(sx, sz);
        if (sd < 1.4 && sd > 0.001) { tx += sx / sd * (1.4 - sd) * 1.6; tz += sz / sd * (1.4 - sd) * 1.6; }
      }
      const mx = tx - g.gx, mz = tz - g.gz, md = Math.hypot(mx, mz);
      const sp = (D.speed || 0.8) * 0.042 * (tok ? 1.2 : 0.85);
      if (md > 0.06) { const s = Math.min(sp, md); mv32(e, mx / md * s, mz / md * s); e.walkT++; } else e.walkT = 0;
      { const ng = g32(e), nx = p.gx - ng.gx, nz = p.gz - ng.gz, nd = Math.hypot(nx, nz); if (nd < 0.8 && nd > 0.001 && p.deadT === 0) mv32(e, -nx / nd * (0.8 - nd), -nz / nd * (0.8 - nd)); }
      turnTo(e, toP, 0.18);
      if (!tok && !(e.tauntCd > 0) && Math.random() < 0.0025 && !STATE.enemies.some((o) => o.sayT > 0)) { e.tauntCd = 400; enemySay(e, ["C'MON!", "SURROUND HIM!", "GET BEHIND HIM!", "NICE SHELL, NERD!", "TAKE HIM!"][Math.random() * 5 | 0], 60, 150 + Math.random() * 60); }
      if (e.tauntCd > 0) e.tauntCd--;
      const free = alive && !(p.downT > 0) && p.z * ZH < 0.6;
      if (tok && free && (e.cool || 0) === 0) {
        const ad = Math.abs(wrapA(e.hy - toP));
        if (e.type === "dasher" && d > 2.4 && d < 5.5 && ad < 0.3) { e.state = "attack"; e.t = 0; e.hitP = false; e.a32 = { kind: "dash", crouch: 14, run: 32, end: 46, dmg: 1 }; e.dashY = toP; }
        else if (d < 1.4 && ad < 0.45) { e.state = "attack"; e.t = 0; e.hitP = false; e.a32 = (ATK32[e.type] || ATK32.purple)(); }
        if (e.state === "attack") { C32.stat.atks.push({ rel: Math.round(wrapA(Math.atan2(-dx, -dz) - (p.hy || 0)) / DEG), kind: e.a32.kind }); if (C32.stat.atks.length > 200) C32.stat.atks.shift(); }
      }
    } else if (e.state === "attack") {
      const A = e.a32 || (e.a32 = ATK32.purple());
      if (A.kind === "dash") {
        if (e.t < A.crouch) { turnTo(e, toP, 0.12); e.dashY = e.hy; mv32(e, -Math.sin(e.hy) * 0.006, -Math.cos(e.hy) * 0.006); }
        else if (e.t < A.run) {
          mv32(e, Math.sin(e.dashY) * 0.12, Math.cos(e.dashY) * 0.12); e.walkT += 2; if (e.t % 4 === 0) dust(e.x, e.y);
          if (!e.hitP && alive && p.inv === 0 && d < 0.8 && p.z * ZH < 0.5) { e.hitP = true; hurt32(p, e, A.dmg, true); STATE.shake = 6; }
        }
        if (e.t === A.crouch) SFX.swing();
      } else {
        if (e.t < A.hit) turnTo(e, toP, 0.09);
        else if (e.t < A.hit + 4) mv32(e, Math.sin(e.hy) * 0.025, Math.cos(e.hy) * 0.025);
        if (e.t === A.hit) {
          SFX.swing();
          if (alive && p.inv === 0 && d < A.reach && Math.abs(wrapA(toP - e.hy)) < 65 * DEG && p.z * ZH < 0.7 && p.atk !== "power") { hurt32(p, e, A.dmg, A.knock); fx("spark", p.x, p.y - 28, 8); }
        }
      }
      if (e.t >= A.end) { e.state = "walk"; e.cool = 50 + (Math.random() * 45 | 0); e.token = false; e.back = 24 + (Math.random() * 18 | 0); e.side = Math.random() < 0.5 ? -1 : 1; }
    } else if (e.state === "hurt") {
      const K = e.kv; if (K) { mv32(e, K.x, K.z); K.x *= 0.85; K.z *= 0.85; }
      if (e.t >= 14) { e.state = "walk"; e.cool = Math.max(e.cool || 0, 20); e.idle = false; e.home = false; }
    } else if (e.state === "down") {
      const K = e.kv; if (K) { mv32(e, K.x, K.z); const f = e.z > 0 ? 0.97 : 0.8; K.x *= f; K.z *= f; }
      e.z += e.vz || 0;
      if (e.z > 0) e.vz -= 0.25;
      else if (!e.bounced && e.vz < -1) { e.bounced = true; e.z = 0.1; e.vz = -e.vz * 0.35; fx("dust", e.x, e.y, 16); SFX.land(); STATE.shake = Math.max(STATE.shake, 3); }
      else { e.z = 0; e.vz = 0; }
      if (e.z === 0 && e.hp <= 0) { e.state = "dying"; e.t = 0; }
      else if (e.z === 0 && e.t > 60) { e.state = "getup"; e.t = 0; }
    } else if (e.state === "getup") {
      if (e.t >= 20) { e.state = "walk"; e.cool = 30; e.inv = 6; e.juggled = false; e.idle = false; e.home = false; }
    } else if (e.state === "dying") {
      if (e.t >= 34) { // KO: score, smoke, maybe a slice - then they regroup at their post a while later (persistent crew)
        STATE.score += 100; SFX.defeat(); fx("smoke", e.x, e.y - 12, 22); fx("pop", e.x, e.y - 30, 40); STATE.kills++; C32.stat.kills++;
        if (Math.random() < diff().drop * (D.drop || 1) * 2) spawnItem({ kind: "slice", x: e.x, y: e.y, z: 6, vz: 2.6 });
        e.state = "out"; e.t = 0; e.token = false; if (STATE.lock32 === e) STATE.lock32 = null;
      }
    } else if (e.state === "out") {
      if (e.t > C32.RESPAWN && Math.hypot(p.gx - gp.x, p.gz - gp.z) > 6) { // back from the corner: at the post, ready again
        const l = toLocal(STATE.zone, gp.x, gp.z); e.x = l.x; e.y = l.y; e.z = 0; e.vz = 0; e.kv = null;
        e.hp = Math.max(1, Math.round(((D.hp || 3) + (Math.random() < 0.5 ? 1 : 0)) * diff().hp)); e.state = "walk"; e.t = 0; e.idle = true; e.home = false; e.cool = 30; e.inv = 20; e.juggled = false;
        fx("smoke", e.x, e.y - 10, 20);
      }
    }
    if (e.z > 0 && (e.state === "hurt" || e.state === "getup" || e.state === "dying")) { e.vz = (e.vz > 0 ? 0 : e.vz || 0) - 0.3; e.z = Math.max(0, e.z + e.vz); if (e.z === 0) e.vz = 0; }
    e.facing = faceSign(e.hy);
  }
  // all five down at once: a beat of quiet before the crew regroups
  function clear32() {
    const foot = STATE.enemies.filter(isFoot32);
    const allOut = foot.length && foot.every((e) => e.state === "out");
    if (allOut && !STATE.clear32) { STATE.clear32 = true; banner("INTERSECTION CLEAR!", "THE CREW WILL REGROUP AT THEIR CORNERS", "#7fff6a"); SFX.pickup(); STATE.score += 1000; }
    if (!allOut) STATE.clear32 = false;
  }
  // ---- HUD: the locked foe's name + health under the player box ----
  const NAME32 = { purple: "STREET BRAWLER", blue: "STREET KICKER", dasher: "STREET RUNNER" };
  function drawLock32() {
    const e = STATE.lock32; if (!e || !STATE.enemies.includes(e) || e.state === "out") return;
    const mx = Math.max(1, e.maxHp32 || (e.maxHp32 = Math.max(e.hp, 4)));
    rect(4, 31, 92, 12, "rgba(0,0,0,0.6)"); ptext(NAME32[e.type] || "STREET THUG", 6, 33, 1, "#ffd27a", "left");
    rect(6, 40, 88, 2, "#401010"); rect(6, 40, Math.round(88 * Math.max(0, e.hp) / mx), 2, "#e8302a");
  }
  // ---- test driver (?t32): walk a route or fight, through the same input path as the stick ----
  const DRV = { on: false, mode: "idle", route: [], i: 0, log: [] };
  function drive32() {
    BOTIN.on = DRV.on; BOTIN.dx = BOTIN.dy = 0; if (!DRV.on) return;
    const p = STATE.player; if (!p || p.climb) return;
    const go = (gx, gz) => { const dx = gx - p.gx, dz = gz - p.gz, l = Math.hypot(dx, dz); if (l < 0.35) return true; const st = worldToStick(dx / l, dz / l), m = Math.hypot(st.dx, st.dy) || 1; BOTIN.dx = st.dx / m; BOTIN.dy = st.dy / m; return false; };
    if (DRV.mode === "route") { const G = DRV.route[DRV.i]; if (!G) { DRV.mode = "done"; return; } if (go(G[0], G[1])) { DRV.log.push([DRV.i, +p.gx.toFixed(1), +p.gz.toFixed(1)]); DRV.i++; } return; }
    if (DRV.mode === "fight") { // close on the nearest awake foe and keep swinging; jump-slash / special now and then
      let best = null, bd = 1e9; for (const e of STATE.enemies) { if (e.state === "out" || !canHitState(e)) continue; const g = g32(e), d = Math.hypot(g.gx - p.gx, g.gz - p.gz); if (d < bd) { bd = d; best = g; } }
      if (best && bd > 1.3) go(best.gx, best.gz);
      if (best && bd < 2.6 && p.attackT <= 2 && STATE.t % 4 === 0) pressed.add("j");
      if (best && STATE.t % 240 === 0 && p.hp > 6) pressed.add("l");
      if (best && STATE.t % 300 === 150) { pressed.add("k"); DRV.jumpT = STATE.t; }
      if (DRV.jumpT && STATE.t - DRV.jumpT === 8) pressed.add("j");
    }
  }
  window.__e32 = { DRV, C32, M32, SW: SWINGS.lenny, get lock() { return STATE.lock32; } };
