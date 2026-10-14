// Shell Shock trailer capture: drives a game build in headless Chromium with a scripted bot,
// steps the game loop manually (requestAnimationFrame is hijacked, so capture is frame-exact and
// independent of machine speed), and saves every 2nd game frame (60fps game -> 30fps video) as JPEG
// plus a per-frame metadata line (scene, phase, boss hp, combos, tag-ins, ...) used by the editor.
//
// node capture.js <baseUrl> <outDir> <mode> [level] [maxFrames]
//   mode = live            level = level number for live mode (1 = built-in Hallway Fire)
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_MODULE || "playwright");

const [BASE, OUT, MODE = "live", LEVEL = "1", MAXF = "16000"] = process.argv.slice(2);
const maxFrames = +MAXF;
fs.mkdirSync(path.join(OUT, "frames"), { recursive: true });

// Runs in the page before any game script: manual frame stepping + in-page bot + frame metadata.
const INIT = () => {
  let cb = null;
  window.requestAnimationFrame = (f) => { cb = f; return 1; };
  let vnow = 0;
  const realNow = performance.now.bind(performance);
  performance.now = () => vnow;
  const key = (type, k) => window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
  const held = new Set();
  const hold = (k, on) => { if (on && !held.has(k)) { key("keydown", k); held.add(k); } if (!on && held.has(k)) { key("keyup", k); held.delete(k); } };
  const tapQ = []; // keys pressed this frame, released next frame
  const tap = (k) => { if (held.has(k)) return; key("keydown", k); tapQ.push(k); };
  const B = (window.__BOT = { f: 0, stuck: 0, last: "", killedOnce: false, events: [] });
  const ev = (s) => B.events.push({ f: B.f, s });
  let seen = new Set();
  const mark = (s) => { if (!seen.has(s)) { seen.add(s); ev(s); } };

  function bot(S) {
    while (tapQ.length) key("keyup", tapQ.pop());
    if (!S) return;
    const p = S.player;
    if (S.scene === "title" && B.f > 150 && B.f % 30 === 0) tap("enter"); // let the title breathe ~2.5s
    if (S.scene === "select" && B.f % 40 === 20) { if (B.f % 80 === 20) tap("arrowright"); else tap("enter"); }
    if (S.scene !== "stage" || !p) { for (const k of [...held]) hold(k, false); return; }
    if (S.results) { mark("results"); if (S.results.t > 150 && B.f % 10 === 0) tap("j"); return; }
    if (S.pizza) { mark("pizza"); return; }
    if (S.cut) { mark("cutscene"); return; }
    // three scripted KOs (after ~20 s of play) so the every-3rd-KO tag-in shows; otherwise invincible
    B.deaths = B.deaths || 0;
    if (B.deaths < 3 && S.playT > 1200 + B.deaths * 170 && p.deadT === 0 && p.z === 0 && !p.inv && !S.intro) { B.deaths++; p.hp = 0; p.deadT = 70; ev("scripted-death " + B.deaths); }
    else if (p.deadT === 0) p.hp = Math.max(p.hp, 8);
    const foes = (S.enemies || []).filter((e) => !["dying", "fly", "intro", "enter"].includes(e.state) && (e.entered === undefined || e.entered));
    let tx, ty = p.y;
    if (foes.length) {
      foes.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
      const e = foes[0]; tx = e.x + (e.x > p.x ? -18 : 18); ty = e.y;
    } else if ((S.enemies || []).length) { tx = S.camX + 192; ty = 185; } else tx = p.x + 60;
    hold("arrowright", tx > p.x + 3); hold("arrowleft", tx < p.x - 3);
    hold("arrowdown", ty > p.y + 2); hold("arrowup", ty < p.y - 2);
    if (foes.length && Math.abs(foes[0].x - p.x) < 32) {
      if (Math.sign(foes[0].x - p.x) !== p.facing) { hold("arrowright", foes[0].x > p.x); hold("arrowleft", foes[0].x < p.x); }
      const r = B.f % 240;
      if (r < 6 && B.f % 3 === 0) tap("k");                 // jump...
      else if (r >= 6 && r < 14 && B.f % 4 === 0) tap("j"); // ...jump attack
      else if (r > 200 && r < 204) tap("l");                // power move now and then
      else if (B.f % 7 === 0) tap("j");                     // combo mash
    }
    if (B.f % 97 === 0 && !foes.length) tap("k");
    const prog = [S.level, S.section, S.sec, S.wave, S.phase, (S.enemies || []).length, Math.round((S.camX || 0) / 50)].join(",");
    if (prog === B.last) B.stuck++; else { B.stuck = 0; B.last = prog; }
    if (B.stuck > 2400) { ev("force-progress"); for (const e of S.enemies) { e.hp = 0; e.state = "dying"; e.t = 0; } p.grabbedBy = null; B.stuck = 0; }
  }

  function meta(S) {
    if (!S) return { scene: "?" };
    const p = S.player, en = S.enemies || [];
    const boss = en.find((e) => e.boss || e.type === "ramrod") || null;
    const zaps = en.filter((e) => e.type === "zap");
    return {
      scene: S.scene, level: S.level || 1, section: S.section, sec: S.sec, phase: S.phase,
      bro: p && p.bro ? p.bro.name : null, atk: p ? p.atk : null, combo: p ? p.combo : 0,
      hurt: en.filter((e) => ["hurt", "fly", "down", "stagger"].includes(e.state)).length,
      dying: en.filter((e) => e.state === "dying").length, enemies: en.length,
      boss: boss ? { name: boss.name || (boss.cfg && boss.cfg.name) || (boss.type === "ramrod" ? "RAMROD" : boss.type), hp: boss.hp, max: boss.maxHp, state: boss.state } : zaps.length ? { name: "ZAP-ROLLER", hp: zaps.reduce((a, z) => a + Math.max(0, z.hp), 0), max: zaps.length * 10, state: zaps[0].state } : null,
      intro: S.intro || 0, bossDown: !!S.bossDown, cut: !!S.cut, pizza: !!S.pizza, results: !!S.results, outro: !!S.outro,
      tag: S.tagT || 0, dead: p ? p.deadT : 0, sink: p ? p.sinkT || 0 : 0, kills: S.kills || 0, score: S.score || 0, clear: !!S.clear,
    };
  }

  window.__CAP = {
    step(n, every, capture) {
      const out = [];
      const cv = document.getElementById("game");
      for (let i = 0; i < n; i++) {
        const S = window.__CAP_STATE;
        bot(S);
        vnow += 1000 / 60; B.f++;
        const f = cb; cb = null; if (f) f(vnow);
        if (B.f % every === 0) {
          const m = meta(window.__CAP_STATE); m.f = B.f;
          if (capture) m.jpg = cv.toDataURL("image/jpeg", 0.85);
          out.push(m);
        }
      }
      const events = B.events; B.events = [];
      return { frames: out, events };
    },
    realNow,
  };
};

(async () => {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.addInitScript(INIT);
  const q = MODE === "live" ? `?debug&level=${LEVEL}` : "?";
  await page.goto(BASE.replace(/\/$/, "") + "/index.html" + q, { waitUntil: "load" });
  await page.waitForTimeout(1500); // images decode
  const metaP = path.join(OUT, "meta.jsonl"), evP = path.join(OUT, "events.jsonl");
  fs.writeFileSync(metaP, ""); fs.writeFileSync(evP, ""); // appended synchronously so a killed run keeps its data
  const metaF = { write: (s) => fs.appendFileSync(metaP, s), end() {} }, evF = { write: (s) => fs.appendFileSync(evP, s), end() {} };
  let idx = 0, f = 0, done = false, resultsAt = -1, t0 = Date.now();
  while (f < maxFrames && !done) {
    const r = await page.evaluate(() => window.__CAP.step(60, 2, true));
    f += 60;
    for (const ev of r.events) { evF.write(JSON.stringify(ev) + "\n"); console.log(`f${ev.f} ${ev.s}`); }
    for (const m of r.frames) {
      idx++;
      const name = "f" + String(idx).padStart(5, "0") + ".jpg";
      fs.writeFileSync(path.join(OUT, "frames", name), Buffer.from(m.jpg.split(",")[1], "base64"));
      delete m.jpg; m.file = name; metaF.write(JSON.stringify(m) + "\n");
      if (m.results && resultsAt < 0) resultsAt = f;
      if (m.scene === "loading") await page.waitForTimeout(30);
      if (MODE === "live" && m.scene === "stage" && m.level !== +LEVEL && f > 600) done = true; // rolled into next level
      if (m.scene === "title" && f > 3000) done = true;
    }
    if (resultsAt > 0 && f - resultsAt > 420) done = true; // keep ~7 s of results card
    if (idx % 600 === 0) console.log(`  ${idx} frames captured (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  metaF.end(); evF.end();
  console.log(`DONE ${OUT}: ${idx} frames, ${f} game frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
