  // ---------- HUD + menus (2D canvas over the 3D view): the 16-bit HUD, select screen, cards, results ----------
  const PROJ = new THREE.Vector3();
  function project(gx, gy, gz) { PROJ.set(gx, gy, gz).project(camera); return { x: (PROJ.x + 1) / 2 * W, y: (1 - PROJ.y) / 2 * H, ok: PROJ.z < 1 && PROJ.z > -1 }; }
  function localScreen(e, h) { const P = entPos(STATE.zone, e, {}); return project(P.gx, P.gy + h, P.gz); }
  const TITLE_LOGO3 = mkArt("title_logo.webp");
  function drawTitle3D() {
    const t = STATE.t;
    ctx.fillStyle = "rgba(6,4,12,0.35)"; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(0,0,0,0.55)"); g.addColorStop(0.45, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.7)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const bob = Math.sin(t * 0.04) * 2;
    if (artOk(TITLE_LOGO3)) { const lw = 236, lh = lw * 138 / 516; ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(TITLE_LOGO3, 0, 0, 516, 138, W / 2 - lw / 2, 12 + bob, lw, lh); ctx.restore(); }
    // the "3D" plate under the painted logo
    ctx.save(); ctx.translate(W / 2, 78 + bob); ctx.rotate(-0.05);
    rect(-118, -2, 236, 4, "#000"); rect(-40, -15, 80, 30, "#000"); rect(-38, -13, 76, 26, "#e8302a"); rect(-38, -13, 76, 3, "#ff7a5a"); ptext("3D", 1, -9, 3, "#000"); ptext("3D", 0, -10, 3, "#fff");
    ctx.restore();
    ptext("LEVEL 1: BIG APPLE, 3 A.M.", W / 2, 124, 1, "#ffd27a");
    if (Math.floor(t / 24) % 2 === 0) ptext("PRESS START", W / 2, 150, 2, "#fff");
    ptext("ENTER / TAP / ATTACK", W / 2, 172, 1, "#c8ccd6");
    ptext("ARROWS MOVE  J ATTACK  K JUMP  L SPECIAL  E/L USE", W / 2, 204, 1, "#9aa0b8");
  }
  function updateTitle3D() {
    if (anyPressed("enter", " ", "j", "k") || tapPoint || BTN_A.hit || BTN_B.hit || BOT) { tapPoint = null; SFX.confirm(); STATE.scene = "select"; selPick = 0; selWipe = 0; if (BOT) botPickT = 20; }
  }
  let botPickT = 0;
  function updateSelect3D() {
    if (selWipe > 0) { tapPoint = null; if (++selWipe > 22) beginLevel(STATE.selectIndex, 1); return; }
    if (BOT && botPickT > 0 && --botPickT === 0) { STATE.selectIndex = (+((Q.match(/[?&]bro=(\d)/) || [])[1] || 0)) % 4; SFX.confirm(); selPick = 30; return; }
    updateSelect();
  }
  function updateCard3D() { tapPoint = null; if (--STATE.cardT <= 0) { STATE.scene = "stage"; banner("BLOCK 1", "FIRE ON 3RD AVENUE - GET TO THE CORNER!", "#ffe060"); } }
  function drawCard3D() {
    const k = Math.min(1, (150 - STATE.cardT) / 20), out = STATE.cardT < 20 ? STATE.cardT / 20 : 1;
    ctx.globalAlpha = 0.85 * out; rect(0, 0, W, H, "#000"); ctx.globalAlpha = k * out;
    ptext("SCENE 1", W / 2, 70, 3, "#ffe060");
    rect(W / 2 - 90, 92, 180, 2, "#e8401a");
    ptext("BIG APPLE, 3 A.M.", W / 2, 104, 2, "#fff");
    ptext("THE FOOT GANG TORCHED A BUILDING ON 3RD AVENUE.", W / 2, 130, 1, "#ffd27a");
    ptext("CLEAR THE BLOCK. STOP RAMROD.", W / 2, 142, 1, "#ffd27a");
    ptext("MANHOLES AND FIRE ESCAPES HIDE SECRETS...", W / 2, 162, 1, "#7fd85a");
    const wf = 1 - (150 - STATE.cardT) / 20; if (wf > 0) { ctx.globalAlpha = Math.ceil(wf * 8) / 8; rect(0, 0, W, H, "#fff"); }
    ctx.globalAlpha = 1;
  }
  const FPS = { n: 0, t0: 0, v: 60, hist: [] };
  function drawStageHUD() {
    const p = STATE.player; if (!p) return;
    // speech bubbles (enemies + the player's bark), score pops, prompts: projected from 3D
    for (const e of STATE.enemies) if (e.sayT > 0 && e.say) { const s = localScreen(e, e.type === "ramrod" ? 2.7 : 2.0); if (s.ok) bubble(s.x, s.y, e.say, e.type === "ramrod" ? "#e8302a" : "#3a3a8a", 8); }
    if (STATE.pBark) { const s = project(p.gx, p.gy + 2.0, p.gz); if (s.ok) bubble(s.x, s.y, STATE.pBark.s, p.bro.mask, 8); }
    for (const f of STATE.fx) {
      if (!f.hud || !f.g) continue;
      const k = f.t / f.life, s = project(f.g.x, f.g.y, f.g.z); if (!s.ok) continue;
      if (f.kind === "x" && f.draw) { safe(() => f.draw(API, Object.assign({}, f, { y: s.y }), s.x, k)); continue; }
      ctx.globalAlpha = k < 0.5 ? 1 : stepA(2 - k * 2);
      if (f.kind === "pop") ptext("+100", s.x, s.y - k * 18, 1, "#ffe060"); else if (f.kind === "pop5") ptext("+500", s.x, s.y - k * 22, 2, "#ffe060"); else ptext("+5000", s.x, s.y - k * 26, 2, "#ff8c1a");
      ctx.globalAlpha = 1;
    }
    if (STATE.near && !p.climb) {
      const s = project(STATE.near.x, (p.layer === "sewer" ? WORLD.SY : p.fy) + 2.3, STATE.near.z);
      if (s.ok) { const lab = (STATE.showTouch ? "SPECIAL > " : "E > ") + STATE.near.label, w = lab.length * 6 + 14; ctx.globalAlpha = 0.85; rect(s.x - w / 2, s.y - 10, w, 13, "#000"); ctx.globalAlpha = 1; rect(s.x - w / 2, s.y + 3, w, 1, "#ffd23a"); ptext(lab, s.x, s.y - 7, 1, Math.floor(STATE.t / 15) % 2 ? "#ffd23a" : "#fff"); }
    }
    // ---- the 16-bit HUD (ported): P1 box with portrait, name, score, 10 health pips, lives ----
    rect(4, 3, 150, 26, "#fff"); rect(5, 4, 148, 24, "#10101c");
    rect(7, 6, 20, 20, "#2a2a40"); rect(8, 7, 18, 18, "#000");
    drawPortrait(p.bro.name.toLowerCase(), 8, 7, 18);
    ptext(p.bro.name, 31, 10, 1, p.bro.mask, "left");
    ptext(String(Math.min(999999, STATE.score)).padStart(6, "0"), 150, 10, 1, "#fff", "right");
    const pipT = Math.ceil(p.hp * 10 / 16);
    if (pipT < HUDS.shown) { for (let i = pipT; i < HUDS.shown; i++) HUDS.flash[i] = 24; HUDS.shown = pipT; }
    else if (pipT > HUDS.shown && ++HUDS.tick % 4 === 0) HUDS.flash[HUDS.shown++] = -6;
    for (let i = 0; i < 10; i++) {
      const f = HUDS.flash[i], on = i < HUDS.shown;
      let c = on ? (HUDS.shown <= 3 ? "#e8302a" : "#3fae3a") : "#401010";
      if (f > 0) { c = Math.floor(f / 3) % 2 ? "#ff3a2a" : "#fff"; HUDS.flash[i]--; }
      else if (f < 0) { c = "#c8ffb0"; HUDS.flash[i]++; }
      rect(31 + i * 8, 18, 7, 6, c);
    }
    ptext("x" + Math.max(0, STATE.lives), 150, 21, 1, "#ffd27a", "right");
    if (STATE.specT > 0 && (STATE.specT > 50 || Math.floor(STATE.specT / 4) % 2)) ptext(STATE.specName, W / 2, 42, 2, p.bro.mask);
    if (p.hold && p.holdT < 90 && Math.floor(STATE.t / 12) % 2) ptext("ATTACK: SLAM   DOWN+ATTACK: TOSS", W / 2, 34, 1, "#fff");
    if (STATE.tagT > 0 && (Math.floor(STATE.tagT / 8) % 2 || STATE.tagT > 90)) ptext(p.bro.name + " TAGS IN!", W / 2, 52, 2, p.bro.mask);
    if (p.grabbedBy) ptext("MASH ATTACK! " + p.mash + "/" + (p.grabbedBy.type === "zap" ? 8 : 6), W / 2, 40, 1, "#fff");
    if (STATE.goT > 0 && Math.floor(STATE.t / 15) % 2) ptext("GO!", W - 40, 60, 2, "#ffe060");
    // boss bar (ported): slides in for the Zap-Rollers, Scorcher and Ramrod
    const rr = STATE.enemies.find((e) => e.type === "ramrod");
    const zaps = rr ? [rr] : STATE.enemies.filter((e) => e.type === "zap");
    const left = zaps.reduce((a, e) => a + Math.max(0, e.hp), 0);
    if (zaps.length) HUDS.bossMax = Math.max(HUDS.bossMax, rr ? rr.maxHp : zaps.length * Math.round(10 * diff().boss));
    const bossOn = zaps.length > 0;
    if (rr) HUDS.lastName = rr.name || "RAMROD"; else if (zaps.length) HUDS.lastName = "ZAP-ROLLER";
    HUDS.slide = Math.max(0, Math.min(1, HUDS.slide + (bossOn ? 0.08 : -0.08)));
    if (bossOn && HUDS.boss === 0) HUDS.boss = left;
    HUDS.boss = HUDS.boss > left ? Math.max(left, HUDS.boss - 0.25) : left;
    if (HUDS.slide > 0 && HUDS.bossMax) {
      const bName = HUDS.lastName || "ZAP-ROLLER", bKey = bossPortraitKey(bName), hasP = !!(bKey && artOk(PORT_IM));
      const by = Math.round(3 - 28 * (1 - HUDS.slide)), x0 = 160, bw = hasP ? 164 : 186, bx = x0 + (hasP ? 27 : 5);
      rect(x0, by, 196, 26, "#fff"); rect(x0 + 1, by + 1, 194, 24, "#10101c");
      if (hasP) { rect(x0 + 3, by + 3, 20, 20, "#2a2a40"); drawPortrait(bKey, x0 + 4, by + 4, 18); }
      ptext(bName, bx, by + 8, 1, "#c8ccd6", "left");
      rect(bx, by + 15, bw, 7, "#401010");
      rect(bx, by + 15, Math.round(bw * HUDS.boss / HUDS.bossMax), 7, "#fff");
      rect(bx, by + 15, Math.round(bw * left / HUDS.bossMax), 7, "#e8302a");
    } else if (!bossOn) { HUDS.bossMax = 0; HUDS.boss = 0; HUDS.lastName = ""; }
    if (STATE.bossT > 0 && Math.floor(STATE.t / 10) % 2) ptext(rr && rr.cfg ? "WARNING: " + rr.name + "!" : rr ? "WARNING: RAMROD!" : "WARNING: ZAP-ROLLERS!", W / 2, 64, 2, "#ff4a3a");
    if (STATE.intro > 0 && !rr && Math.floor(STATE.t / 10) % 2) ptext("SOMETHING'S DRILLING UP!", W / 2, 64, 2, "#ff4a3a");
    if (STATE.clearT > 0) { rect(0, 84, W, 40, "rgba(0,0,0,0.6)"); ptext("AREA CLEAR", W / 2, 98, 3, "#ffe060"); }
    if (STATE.banner && !STATE.clearT) {
      const B = STATE.banner, a = B.t < 12 ? B.t / 12 : B.t > 170 ? (200 - B.t) / 30 : 1;
      ctx.globalAlpha = Math.max(0, a) * 0.7; rect(0, 150, W, 34, "#000"); ctx.globalAlpha = Math.max(0, a);
      ptext(B.a, W / 2, 154, 2, B.c); ptext(B.b, W / 2, 172, 1, "#fff"); ctx.globalAlpha = 1;
    }
    if (STATE.lock && STATE.locked && !STATE.lock.boss && Math.floor(STATE.t / 30) % 2 === 0 && STATE.enemies.length) ptext("WAVE " + (STATE.waveI + 1) + "/" + STATE.lock.waves.length, W / 2, HUDS.slide > 0 ? 34 : 20, 1, "#c8ccd6");
    if (CAM.fade > 0) { ctx.globalAlpha = Math.min(1, CAM.fade); rect(0, 0, W, H, "#000"); ctx.globalAlpha = 1; }
    if (STATE.elev) { // inside the car: the dial counts the floors
      const E = STATE.elev, fl = Math.max(1, Math.min(5, Math.round(E.up ? 1 + E.k * 4 : 5 - E.k * 4)));
      rect(W / 2 - 60, 70, 120, 70, "#2a2010"); rect(W / 2 - 57, 73, 114, 64, "#120e08");
      ptext("ELEVATOR", W / 2, 80, 1, "#c8a040"); ptext("FLOOR " + (fl === 5 ? "R" : fl), W / 2, 100, 2, "#ffd08a");
      if (Math.floor(STATE.t / 10) % 2) ptext(E.up ? "GOING UP" : "GOING DOWN", W / 2, 124, 1, "#c8ccd6");
    }
    if (STATE.win && STATE.win.t > 90) { ctx.globalAlpha = Math.min(1, (STATE.win.t - 90) / 60); rect(0, 0, W, H, "#000"); ctx.globalAlpha = 1; }
    if (/[?&]fps\b/.test(Q)) ptext(FPS.v + " FPS", W - 4, 214, 1, "#7fd85a", "right");
  }
  function drawEnd(win) {
    const k = Math.min(1, (win ? STATE.winT : STATE.overT) / 20), secs = Math.floor(STATE.playT / 60);
    ctx.globalAlpha = 0.82 * k; rect(0, 0, W, H, "#000"); ctx.globalAlpha = k;
    rect(W / 2 - 124, 26, 248, 172, "#fff"); rect(W / 2 - 123, 27, 246, 170, "#10101c");
    if (win) {
      ptext("BLOCK CLEARED!", W / 2, 44, 2, "#ffe060"); rect(W / 2 - 90, 62, 180, 2, "#e8401a");
      const rows = [["SCORE", String(Math.min(999999, STATE.score)).padStart(6, "0")], ["ENEMIES DEFEATED", String(STATE.kills)], ["TIME", Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0")],
        ["SECRETS FOUND", STATE.secrets + "/1"], ["LIVES LEFT", String(STATE.lives)]];
      rows.forEach(([a, b], i) => { if (STATE.winT > 20 + i * 10) { ptext(a, W / 2 - 100, 76 + i * 15, 1, "#c8ccd6", "left"); ptext(b, W / 2 + 100, 76 + i * 15, 1, "#fff", "right"); } });
      if (STATE.winT > 80) { ptext("RAMROD IS DOWN. THE CITY SLEEPS.", W / 2, 158, 1, "#7fd85a"); }
      if (STATE.winT > 60 && Math.floor(STATE.t / 20) % 2) ptext("PLAY AGAIN: ATTACK, ENTER OR TAP", W / 2, 178, 1, "#ffd27a");
    } else {
      ptext("GAME OVER", W / 2, 60, 4, "#e8302a"); rect(W / 2 - 90, 92, 180, 2, "#e8401a");
      ptext("SCORE " + String(Math.min(999999, STATE.score)).padStart(6, "0"), W / 2, 112, 2, "#fff");
      ptext("THE FOOT GANG RULES THE BLOCK... FOR NOW.", W / 2, 140, 1, "#ffd27a");
      if (STATE.overT > 40 && Math.floor(STATE.t / 20) % 2) ptext("TRY AGAIN: ATTACK, ENTER OR TAP", W / 2, 172, 1, "#ffd27a");
    }
    ctx.globalAlpha = 1;
  }
  function updateEnd(win) {
    const k = win ? ++STATE.winT : ++STATE.overT;
    if (k > 60 && (anyPressed("enter", " ", "j") || tapPoint || BTN_A.hit)) { tapPoint = null; SFX.confirm(); STATE.scene = "title"; STATE.player = null; STATE.zone = null; window.__ssDone = win ? "win" : "over"; }
  }
  // ---------- bot (?bot): plays the level for automated checks, via the same input paths ----------
  const BOTR = { i: 0, stuck: 0, lx: 0, lz: 0, t: 0, log: [] };
  const ROUTE = [ // goals: go (layer, x, z) / use (the nearest interact) / wait for a lock
    ["go", "street", 14, 0], ["go", "street", 33.9, 2.0], ["use"], ["go", "sewer", 60, 1.2], ["go", "sewer", 80, 1.2], ["go", "sewer", 92, 2.4], ["go", "sewer", 92, 7.5], ["go", "sewer", 92, 2.0], ["go", "sewer", 40, 1.6], ["go", "sewer", 34, 2.35], ["use"],
    ["go", "street", 45, 0], ["go", "street", 67, -2], ["go", "street", 90, -2], ["go", "street", 101, -4], ["go", "street", 140, 0], ["go", "street", 158, 0], ["go", "street", 161, -3],
    ["go", "street", 130, -2], ["go", "street", 97.6, -9.4], ["use"], ["go", "roof", 100, -22], ["go", "roof", 103, -22], ["jump", "roof", 112, -22], ["go", "roof", 121, -23], ["go", "roof", 131, -23], ["go", "roof", 136, -32], ["go", "roof", 145.5, -38.4], ["go", "roof", 137.4, -33], ["go", "roof", 137.4, -27.4], ["go", "roof", 141.2, -27.6], ["use"], ["go", "inside", 140, -15], ["go", "inside", 140, -12.1], ["use"], ["go", "street", 146, -9], ["go", "street", 152.5, -8], ["go", "street", 151.4, -24.6], ["use"], ["go", "roof", 148.4, -25], ["use"],
    ["go", "street", 160, -40], ["go", "street", 160, -60], ["go", "street", 160, -90], ["go", "street", 160, -110], ["go", "street", 160, -140], ["go", "street", 150, -165], ["go", "street", 150, -172],
  ];
  const ROUTE_S = [ // ?route=sewer: in at the block-1 manhole, through both tunnels, out of the far manhole on block 2
    ["go", "street", 14, 0], ["go", "street", 33.9, 2.0], ["use"], ["go", "sewer", 80, 1.2], ["go", "sewer", 92, 2.4], ["go", "sewer", 92, 7.5], ["go", "sewer", 92, 2.0],
    ["go", "sewer", 158, 0], ["go", "sewer", 162, -2], ["go", "sewer", 162, -60], ["go", "sewer", 162, -94.9], ["use"], ["go", "street", 160, -90], ["end"]];
  if (/[?&]route=sewer\b/.test(Q)) ROUTE.splice(0, ROUTE.length, ...ROUTE_S);
  function botStep() {
    BOTIN.on = true; BOTIN.dx = BOTIN.dy = 0;
    const p = STATE.player; if (!p || STATE.scene !== "stage" || p.climb) return;
    if (STATE.win || STATE.over) return;
    BOTR.t++;
    const press = (k) => { pressed.add(k); };
    const goWorld = (gx, gz, slow, eps) => { // world direction -> camera-relative stick
      const dx = gx - p.gx, dz = gz - p.gz, l = Math.hypot(dx, dz); if (l < (eps || 0.25)) return true;
      const wx = dx / l, wz = dz / l; const st = worldToStick(wx, wz); let sx = st.dx, sy = st.dy;
      const m = Math.hypot(sx, sy) || 1; BOTIN.dx = sx / m * (slow ? 0.6 : 1); BOTIN.dy = sy / m * (slow ? 0.6 : 1); return false;
    };
    if (STATE.locked || STATE.enemies.length) { // fight: line up on the nearest foe's row, close in, swing; special when swarmed
      const foes = STATE.enemies.filter((e) => canHitState(e) || e.state === "enter" || e.state === "walk");
      if (p.grabbedBy && BOTR.t % 2 === 0) press("j");
      if (!foes.length) { if (STATE.locked) { const c = toGlobal(STATE.zone, STATE.camX + W / 2, (FLOOR_TOP + FLOOR_BOT) / 2); goWorld(c.gx, c.gz, true); } return; }
      foes.sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) * 2 - Math.abs(b.x - p.x) - Math.abs(b.y - p.y) * 2);
      const e = foes[0], side = p.x < e.x ? -1 : 1, want = e.x + side * (p.bro.reach + 2), dy = e.y - p.y;
      const danger = STATE.enemies.find((o) => (o.type === "ramrod" && ["tele", "charge", "fire"].includes(o.state) && Math.sign(p.x - o.x) === o.facing && Math.abs(o.y - p.y) < 12) || (o.type === "zap" && o.state === "ram" && o.t < 30 && Math.abs(o.y - p.y) < 10) || (o.type === "dasher" && o.state === "attack" && o.t < 26 && Math.abs(o.y - p.y) < 10));
      if (danger) { const dirY = p.y > danger.y ? 1 : -1; let ty = danger.y + dirY * 34; if (ty > FLOOR_BOT - 4 || ty < FLOOR_TOP + 4) ty = danger.y - dirY * 34; const gd = toGlobal(STATE.zone, p.x, ty); goWorld(gd.gx, gd.gz); return; }
      const tl = { x: want, y: e.y }; const g = toGlobal(STATE.zone, tl.x, tl.y);
      const close = Math.abs(p.x - want) < 4 && Math.abs(dy) < 4;
      if (!close) goWorld(g.gx, g.gz, Math.abs(p.x - want) < 20, 0.04);
      const inR = foes.find((o) => Math.abs(o.x - p.x) < p.bro.reach + 13 && Math.abs(o.y - p.y) < 9);
      if (inR && p.attackT <= 2 && BOTR.t % 3 === 0) { p.facing = inR.x > p.x ? 1 : -1; press("j"); }
      const near = STATE.enemies.filter((o) => canHitState(o) && Math.abs(o.x - p.x) < 44 && Math.abs(o.y - p.y) < 16).length;
      if (near >= 3 && p.hp > 5 && p.attackT === 0 && BOTR.t - (BOTR.lastSp || 0) > 100) { BOTR.lastSp = BOTR.t; press("l"); }
      return;
    }
    const G = ROUTE[BOTR.i]; if (!G) return;
    if (G[0] === "end") { window.__ssDone = "route"; return; }
    if (G[0] === "use") { if (STATE.near) { press("e"); BOTR.log.push("use@" + BOTR.i + ":" + STATE.near.kind); BOTR.i++; } else { BOTR.stuck++; if (BOTR.stuck > 200) { BOTR.log.push("nouse@" + BOTR.i); BOTR.i++; BOTR.stuck = 0; } } return; }
    if (G[1] !== p.layer) { BOTR.stuck++; if (BOTR.stuck > 300) { BOTR.log.push("skip@" + BOTR.i + " layer"); BOTR.i++; BOTR.stuck = 0; } return; }
    const done = goWorld(G[2], G[3]);
    if (G[0] === "jump" && p.gx > 105.0 && p.gx < 106.2 && p.z === 0) press("k");
    if (done) { BOTR.i++; BOTR.stuck = 0; return; }
    if (BOTR.t % 30 === 0) { const mv = Math.hypot(p.gx - BOTR.lx, p.gz - BOTR.lz); BOTR.lx = p.gx; BOTR.lz = p.gz; if (mv < 0.3) { if (++BOTR.stuck > 8) { BOTR.log.push("stuck@" + BOTR.i + " " + p.gx.toFixed(1) + "," + p.gz.toFixed(1)); BOTR.i++; BOTR.stuck = 0; } } else BOTR.stuck = 0; }
  }
  window.__ss = { STATE, BOTR, WORLD, get cam() { return camera; }, get info() { return renderer && renderer.info.render; }, use() { const p = STATE.player, it = nearInteract(p); if (it && !p.climb) startClimb(p, it); return !!it; }, FPS, zoneById, placeOn, toLocal };
  // ---------- main loop: fixed 60 Hz simulation, render every animation frame ----------
  const SCN = {
    title: [updateTitle3D, drawTitle3D], select: [updateSelect3D, drawSelect], card: [updateCard3D, drawCard3D],
    stage: [updateStage3D, drawStageHUD], win: [() => updateEnd(true), () => drawEnd(true)], over: [() => updateEnd(false), () => drawEnd(false)],
  };
  let last = 0, acc = 0, booted = false;
  const ERR = (window.__frameErrors = { n: 0, last: null });
  function simStep() {
    STATE.t++;
    pollGamepad();
    if (BOT) botStep();
    const S = SCN[STATE.scene]; if (S) S[0]();
    pressed.clear(); tapPoint = null; for (const b of BTNS) b.hit = false;
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, last ? (ts - last) / 1000 : 1 / 60); last = ts;
    FPS.n++; if (ts - FPS.t0 > 1000) { FPS.v = Math.round(FPS.n * 1000 / (ts - FPS.t0)); FPS.hist.push(FPS.v); if (FPS.hist.length > 120) FPS.hist.shift(); FPS.n = 0; FPS.t0 = ts; }
    if (!booted) { if (STATE.scene === "boot") { drawBoot(); } return; }
    try {
      acc += dt * TURBO; let n = 0;
      while (acc >= 1 / 60 && n < 5 * TURBO) { simStep(); acc -= 1 / 60; n++; }
      if (n >= 5 * TURBO) acc = 0;
    } catch (err) { ERR.n++; ERR.last = String(err && err.stack || err); if (ERR.n < 5) console.error("sim", err); }
    try { render3D(dt, ts / 1000); } catch (err) { ERR.n++; ERR.last = String(err && err.stack || err); if (ERR.n < 5) console.error("render", err); }
    try {
      ctx.setTransform(RES, 0, 0, RES, 0, 0); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, W, H);
      const S = SCN[STATE.scene]; if (S) S[1]();
      drawSpeaker();
    } catch (err) { ERR.n++; ERR.last = String(err && err.stack || err); if (ERR.n < 5) console.error("draw", err); for (let i = 0; i < 16; i++) ctx.restore(); ctx.globalAlpha = 1; }
    try { audioFrame(); updateCabFx(); } catch (err) { }
  }
  function drawBoot() {
    ctx.setTransform(RES, 0, 0, RES, 0, 0); ctx.clearRect(0, 0, W, H); rect(0, 0, W, H, "#000");
    ptext("LOADING THE BIG APPLE...", W / 2, 104, 1, "#ffd27a");
  }
  // boot: build the city, wait for the art, then the title
  try { init3D(); } catch (err) { console.error("3D init failed", err); }
  relayout(); fit3D();
  const bootArt = ["atlas_lenny.webp", "atlas_rafe.webp", "atlas_miko.webp", "atlas_donny.webp", "levels/enemies_street.webp", "atlas_ramrod.webp", "atlas_zap.webp", "atlas_scorcher.webp", "shared_sprites.webp", "sp_lenny.webp", "sp_rafe.webp", "sp_miko.webp", "sp_donny.webp", "drill.webp", RAY_SRC];
  bootArt.forEach(spriteTex);
  const SHOTQ = (Q.match(/[?&]shot=([a-z0-9]+)/) || [])[1];
  const SHOTS = { street: ["street", 30, 1], fire: ["street", 58, -1], sewer: ["sewer", 70, 0.5], lair: ["sewer", 92, 6], roof: ["roof", 100, -24], lot: ["street", 152, -166], lobby: ["inside", 140, -14.5], elev: ["inside", 141.2, -22.3], sewend: ["sewer", 162, -94.7], bulk: ["roof", 141.2, -25], door: ["street", 138, -8.5], corner: ["street", 150, 0], block2: ["street", 160, -60] };
  function goShot() {
    STATE.scene = "title"; startGame(+((Q.match(/[?&]bro=(\d)/) || [])[1] || 0)); STATE.scene = "stage"; STATE.banner = null;
    const S = SHOTS[SHOTQ]; if (S) placeOn(STATE.player, S[0], S[1], S[2]);
    for (const z of WORLD.zones) for (const L of z.locks) if (/[?&]nolock\b/.test(Q)) L.done = true;
  }
  window.__ss_goShot = goShot;
  THREE.DefaultLoadingManager.onLoad = () => { if (!booted) { booted = true; STATE.scene = "title"; if (SHOTQ) goShot(); if (BOT) window.__ssBoot = true; } };
  setTimeout(() => { if (!booted) { booted = true; STATE.scene = "title"; } }, 9000);
  requestAnimationFrame(frame);
