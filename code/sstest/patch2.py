f='/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/index.html'; s=open(f).read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt, (a[:90], s.count(a)); s=s.replace(a,b)
blk=open('/workspace/work/ss_engine_block.js').read()
rep("""  // ---------- Loop ----------
  const SCENES = {""", blk + """
  // ---------- Loop ----------
  const SCENES = {
    loading: { update: updateLoading, draw: drawLoading },""")
rep("""    const LV = (STATE.level || 1) > 1 ? LEVELS[STATE.level - 1] : null;
    if (s === "card")""","""    const LV = curLV();
    if (s === "loading") return MUS.cur;
    if (s === "card")""")
rep("""    if (selWipe > 0) { tapPoint = null; if (++selWipe > 22) startStage(STATE.selectIndex); return; }""","""    if (selWipe > 0) { tapPoint = null; if (++selWipe > 22) beginLevel(STATE.selectIndex, startLevelQ()); return; }""")
rep("""    if (titleT > 40) text("LEVEL " + startLevelQ() + ": " + LEVELS[startLevelQ() - 1].name, W / 2, 84, 10, "#ffd27a");""","""    if (titleT > 40) { const n = startLevelQ(), d = LEVELS[n - 1]; text("LEVEL " + n + (d ? ": " + d.name : ""), W / 2, 84, 10, "#ffd27a"); }""")
rep("""      const nxN = nextLevelNum(STATE.level || 1);
      if (nxN) { // on to the next registered level with the same brother, score carried
        startStage(BROTHERS.indexOf(STATE.player.bro), nxN, { score: STATE.score });
        HUDS.shown = 10; return;
      }
      Object.assign(STATE, { scene: "title", player: null, enemies: [], stars: [], fx: [], balls: [], debris: [], camX: 0, clear: false, cut: null, results: null,
        intro: 0, pod: null, amberTaken: false, section: "A", phase: "waves", locked: false, queue: [], bossT: 0, stop: 0, shake: 0, fadeIn: 0, fadeOut: 0 });
      titleT = 0; selPick = 0; selWipe = 0;
    }""","""      const n1 = (STATE.level || 1) + 1;
      if (!LVMISS.has(n1)) { beginLevel(BROTHERS.indexOf(STATE.player.bro), n1, { score: STATE.score }); HUDS.shown = 10; return; } // loading card covers a slow fetch
      toTitle();
    }""")
rep("""    const r = STATE.results; r.t++;""","""    const r = STATE.results; r.t++;
    if (r.t === 1) injectLevel((STATE.level || 1) + 1); // prefetch only the next level's JS (its images load when it starts)""")
rep("""    const nxN = nextLevelNum(STATE.level || 1), nx = nxN ? LEVELS[nxN - 1] : null;
    if (r.t > 60) ptext(nx ? "NEXT: LEVEL " + nxN + " - " + nx.name : "THE END... FOR NOW!", W / 2, 142, 1, "#ff8c1a");
    if (r.t > 50 && Math.floor(STATE.t / 20) % 2) ptext(nx ? "CONTINUE: ATTACK, ENTER OR TAP" : "PLAY AGAIN: ATTACK, ENTER OR TAP", W / 2, 172, 1, "#ffd27a");""","""    const n1 = (STATE.level || 1) + 1, nx = LEVELS[n1 - 1], gone = LVMISS.has(n1);
    if (r.t > 60) ptext(gone ? "THE END... FOR NOW!" : "NEXT: LEVEL " + n1 + (nx ? " - " + nx.name : ""), W / 2, 142, 1, "#ff8c1a");
    if (r.t > 50 && Math.floor(STATE.t / 20) % 2) ptext(gone ? "PLAY AGAIN: ATTACK, ENTER OR TAP" : "CONTINUE: ATTACK, ENTER OR TAP", W / 2, 172, 1, "#ffd27a");""")
rep("""    e.t++;
    const dxp = p.x - e.x, dyp = p.y - e.y;
    if (e.type === "zap") updateZap(e, p, dxp, dyp);""","""    e.t++;
    const dxp = p.x - e.x, dyp = p.y - e.y;
    if (e.state === "enter") { bossEnter(e); return; }
    if (e.type === "zap") updateZap(e, p, dxp, dyp);""")
rep("""    e.life = (e.life || 0) + 1;
    if (e.barkCd > 0) e.barkCd--;
    if (e.state === "walk") {
      if (e.cool > 0) e.cool--;""","""    e.life = (e.life || 0) + 1;
    if (e.barkCd > 0) e.barkCd--;
    if (e.sumCd > 0) e.sumCd--;
    const cfg = e.cfg;
    if (cfg && cfg.update && !["hurt", "stagger", "down", "getup", "dying"].includes(e.state) && safe(() => cfg.update(API, e, p), false)) { e.x = Math.max(L, Math.min(R, e.x)); return; }
    if (cfg && bossExtra(e, p, dxp, dyp, free)) { e.x = Math.max(L, Math.min(R, e.x)); return; }
    if (e.state === "walk") {
      if (e.cool > 0) e.cool--;""")
rep("""      if (Math.abs(mx) > 3) e.x += Math.sign(mx) * Math.min(Math.abs(my) > 6 ? 0.35 : 0.7, Math.abs(mx));""","""      const bsp = cfg && cfg.speed ? cfg.speed : 1;
      if (Math.abs(mx) > 3) e.x += Math.sign(mx) * Math.min((Math.abs(my) > 6 ? 0.35 : 0.7) * bsp, Math.abs(mx));""")
rep("""      if (free && e.cool === 0) {
        const ax = Math.abs(dxp), r = Math.random();""","""      if (free && e.cool === 0 && cfg) bossPickMove(e, p, dxp, dyp);
      else if (free && e.cool === 0) {
        const ax = Math.abs(dxp), r = Math.random();""")
rep("""        STATE.stars.push({ x: e.x + e.facing * 24, y: e.y, vx: e.facing * 2.6, vy, ray: true }); SFX.gun();""","""        const kind = cfg && cfg.shot && cfg.shot !== "ray" ? cfg.shot : null;
        STATE.stars.push({ x: e.x + e.facing * 24, y: e.y, vx: e.facing * 2.6, vy, ray: !kind, kind }); SFX.gun();""")
rep("""      e.x += e.facing * 3.5; e.walkT += 2;""","""      e.x += e.facing * 3.5 * (cfg && cfg.chargeSpeed ? cfg.chargeSpeed : 1); e.walkT += 2;""")
rep("""  function drawRamrod(e, sx, sy) {
    const im""","""  function drawRamrod(e, sx, sy) {
    if (e.cfg) return drawBossCfg(e, sx, sy);
    const im""")
rep("""    drawFrame(im, ATLAS.zap[fr], jx, jy, ZAP_K, e.facing);""","""    drawFrame(e.cfg && e.cfg.tint ? tintSheet("zap", e.cfg.tint) || im : im, ATLAS.zap[fr], jx, jy, ZAP_K * (e.cfg && e.cfg.scale || 1), e.facing);""")
rep("""  function drawZap(e, sx, sy) {
    const zim""","""  function drawZap(e, sx, sy) {
    if (e.cfg && e.cfg.draw) return drawBossCfg(e, sx, sy);
    const zim""")
rep("""      else if (!(e.barkCd > 0)) { e.barkCd = 240; if (Math.random() < 0.5) playerBark(true); else enemySay(e, ["OOF! LUCKY SHOT!", "YOU'LL PAY FOR THAT!", "GRR... SHELL-HEADS!", "THAT TICKLED!"][Math.random() * 4 | 0], 80, 110, true); }""","""      else if (!(e.barkCd > 0)) { e.barkCd = 240; const HL = (e.cfg && e.cfg.lines && e.cfg.lines.hit) || ["OOF! LUCKY SHOT!", "YOU'LL PAY FOR THAT!", "GRR... SHELL-HEADS!", "THAT TICKLED!"]; if (Math.random() < 0.5) playerBark(true); else enemySay(e, HL[Math.random() * HL.length | 0], 80, (e.cfg && e.cfg.pitch) || 110, true); }""")
rep("""        e.say = "THIS AIN'T OVER, TURTLES!"; e.sayT = 110; SFX.chat(100, 7, 0.16);""","""        e.say = (e.cfg && e.cfg.lines && e.cfg.lines.ko) || "THIS AIN'T OVER, TURTLES!"; e.sayT = 110; SFX.chat((e.cfg && e.cfg.pitch) || 100, 7, 0.16);
        if (e.cfg && e.cfg.onDefeat) safe(() => e.cfg.onDefeat(API, e));""")
rep(""""kwind", "kick", "fire", "stagger"].includes(e.state)) || !inBox""",""""kwind", "kick", "fire", "stagger", "throw", "slam", "summon", "pull", "boss"].includes(e.state)) || !inBox""")
rep("""    STATE.stars = STATE.stars.filter((s) => {
      s.x += s.vx; if (s.vy) {""","""    STATE.stars = STATE.stars.filter((s) => {
      if (s.update && safe(() => s.update(API, s), false)) return !s.dead;
      if (s.arc) { // lobbed: flies on an arc, hurts near the ground, shatters on landing
        s.x += s.vx; s.y += s.vy || 0; s.z += s.vz; s.vz -= 0.2;
        const near = p.deadT === 0 && p.inv === 0 && Math.abs(s.x - p.x) < 10 && Math.abs(s.y - p.y) < 8 && Math.abs(s.z - p.z) < 14;
        if (near) { hurtPlayer(s.dmg || 2); fx("spark", s.x, s.y - s.z - 6, 8); return false; }
        if (s.z <= 0) { fx("smoke", s.x, s.y - 4, 16); dust(s.x, s.y); SFX.land(); return false; }
        return true;
      }
      s.x += s.vx; if (s.vy) {""")
rep("""    for (const s of STATE.stars) { shadow(s.x - cx, s.y, 10); if (s.ray) drawRay(s.x - cx, s.y - 14); else drawStar(s.x - cx, s.y - 12); }""","""    for (const s of STATE.stars) { shadow(s.x - cx, s.y, s.arc ? s.z * 2 : 10); if (s.draw || s.kind) drawShot(s, cx); else if (s.ray) drawRay(s.x - cx, s.y - 14); else drawStar(s.x - cx, s.y - 12); }""")
rep("""    const rr = STATE.enemies.find((e) => e.type === "ramrod");
    const zaps = rr ? [rr] : STATE.enemies.filter((e) => e.type === "zap");""","""    const rr = STATE.enemies.find((e) => e.boss) || STATE.enemies.find((e) => e.type === "ramrod");
    const zaps = rr ? [rr] : STATE.enemies.filter((e) => e.type === "zap");""")
rep("""      ptext(rr ? "RAMROD" : "ZAP-ROLLER", W / 2 - 143, by + 9, 1, "#c8ccd6", "left");""","""      ptext(rr ? (rr.name || "RAMROD") : "ZAP-ROLLER", W / 2 - 143, by + 9, 1, "#c8ccd6", "left");""")
rep("""    if (STATE.bossT > 0 && Math.floor(STATE.t / 10) % 2) ptext(STATE.section === "B" ? "WARNING: RAMROD!" : "WARNING: ZAP-ROLLERS!", W / 2, 64, 2, "#ff4a3a");""","""    if (STATE.bossT > 0 && Math.floor(STATE.t / 10) % 2) ptext(rr && rr.cfg ? "WARNING: " + rr.name + "!" : STATE.section === "B" ? "WARNING: RAMROD!" : "WARNING: ZAP-ROLLERS!", W / 2, 64, 2, "#ff4a3a");
    if (STATE.section === "L" && curSec() && curSec().auto && STATE.phase === "waves") { const S = curSec(), k = Math.min(1, STATE.scroll / S.length); rect(W / 2 - 50, 16, 100, 4, "#2a2a40"); rect(W / 2 - 50, 16, Math.round(100 * k), 4, "#ffe060"); }
    if (STATE.section === "L" && STATE.phase === "exit" && STATE.goT > 0 && Math.floor(STATE.t / 15) % 2) ptext("GO →", W - 50, 60, 2, "#ffe060");""")
rep("""    if (STATE.section === "B") { drawRoom(); drawPod(cx); drawDebris(cx, true); drawRazor(STATE.cut, cx); } else drawHall(cx);""","""    if (STATE.section === "L") { drawLevelBG(cx); runHaz("drawBack", cx); }
    else if (STATE.section === "B") { drawRoom(); drawPod(cx); drawDebris(cx, true); drawRazor(STATE.cut, cx); } else drawHall(cx);""")
rep("""    if (STATE.section !== "B") drawHallFG(cx);""","""    if (STATE.section === "A") drawHallFG(cx);
    if (STATE.section === "L") {
      runHaz("drawFront", cx);
      const S = curSec(); if (S.weather) drawWeather(S.weather); if (S.drawFront) safe(() => S.drawFront(API, cx));
      if (STATE.outro && curLV().outro && curLV().outro.draw) safe(() => curLV().outro.draw(API, STATE.outro.st, STATE.outro.t, cx));
    }""")
rep("""        const pose = swingPose(p);
        ctx.save(); ctx.translate(sx, p.y - p.z - (pose ? pose.hop : 0));""","""        const pose = swingPose(p), board = STATE.section === "L" && curSec() && curSec().auto;
        if (p.sinkT > 0) { ctx.save(); ctx.beginPath(); ctx.rect(sx - 40, 0, 80, p.sinkAt.y + 1); ctx.clip(); ctx.translate(0, (32 - p.sinkT) * 2); }
        ctx.save(); ctx.translate(sx, p.y - p.z - (pose ? pose.hop : 0) - (board ? 3 : 0));""")
rep("""        ctx.restore();
        if (p.atk && !p.grabbedBy) drawSwingTrail(p, sx, p.y - p.z - (pose ? pose.hop : 0));""","""        ctx.restore();
        if (board && p.deadT === 0) drawBoard(sx, p.y, p.z);
        if (p.sinkT > 0) ctx.restore();
        if (p.atk && !p.grabbedBy) drawSwingTrail(p, sx, p.y - p.z - (pose ? pose.hop : 0));""")
rep("""        if (white) drawSilhouette((x, y) => draw(e, x, y), sx, e.y - e.z + bob);
        else draw(e, sx, e.y - e.z + bob);""","""        const eb = e.board && e.state !== "down" && e.state !== "dying" ? 3 : 0;
        if (white) drawSilhouette((x, y) => draw(e, x, y), sx, e.y - e.z + bob - eb);
        else draw(e, sx, e.y - e.z + bob - eb);
        if (eb) drawBoard(sx, e.y, e.z);""")
rep("""        const real = e.type === "zap" ? atlasImg("zap") : ram ? atlasImg("ramrod") : e.type === "gunner" ? atlasImg("gunner") : ninjaSheet(e.type);""","""        const real = e.type === "zap" ? atlasImg("zap") : ram ? atlasImg("ramrod") : e.type === "gunner" || e.type === "heavy" ? atlasImg("gunner") : atlasImg("ninja");""")
rep("""      const tall = e.type === "ramrod" ? 92 : e.type === "zap" ? 62 : 60, pop = e.sayT > 60 ? 2 : 0;""","""      const tall = e.boss || e.type === "ramrod" ? bossHeight(e) + 7 : e.type === "zap" ? 62 : e.type === "heavy" ? 68 : 60, pop = e.sayT > 60 ? 2 : 0;""")
rep("""      else if (f.kind === "dust") { /* drawn as pooled dust particles */ }""","""      else if (f.kind === "dust") { /* drawn as pooled dust particles */ }
      else if (f.kind === "ring") { ctx.globalAlpha = 1 - k; ctx.strokeStyle = "#fff6c0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(fx0, f.y, 8 + k * 40, 3 + k * 12, 0, 0, 6.29); ctx.stroke(); ctx.lineWidth = 1; ctx.globalAlpha = 1; }
      else if (f.draw) safe(() => f.draw(API, f, fx0, k));""")
rep("""  function drawNinjaAtlas(e, sx, sy) {
    if (e.type === "gunner") {
      const g = atlasImg("gunner");
      if (!g) return drawNinja(e, sx, sy);
      return drawFrame(g, ATLAS.gunner[ninjaFrame(e)], sx, sy, NINJA_K, e.facing);
    }
    const sheet = e.type !== "gunner" && ninjaSheet(e.type);""","""  function drawNinjaAtlas(e, sx, sy) {
    if (e.type === "gunner" || e.type === "heavy") {
      const g = e.hue !== undefined ? tintSheet("gunner", { sepia: 0.6, sat: 2.4, hue: e.hue }) : atlasImg("gunner");
      if (!g) return drawNinja(e, sx, sy);
      const jx = e.type === "heavy" && e.state === "attack" && e.t < 16 ? (e.t % 4 < 2 ? 1 : -1) : 0; // haymaker wind-up shudder
      return drawFrame(g, ATLAS.gunner[ninjaFrame(e)], sx + jx, sy, NINJA_K * (e.type === "heavy" ? 1.18 : 1), e.facing);
    }
    const sheet = e.hue !== undefined ? tintSheet("ninja", { sepia: 0.7, sat: 3, hue: e.hue }) : ninjaSheet(e.type);""")
rep("""  if (/[?&]debug\\b/.test(location.search)) window.__SS = { STATE, startPizza, enemySay, playerBark, BTN_A };""","""  if (/[?&]debug\\b/.test(location.search)) window.__SS = { STATE, startPizza, enemySay, playerBark, BTN_A, spawnBoss, LEVELS, LVLOAD };""")
open(f,'w').write(s)
print("patched")
