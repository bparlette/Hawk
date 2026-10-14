// node mode.js <dir> <speed|rush> <port> [turbo] [from] : WebKit iPhone-13 touch bot, full mode chain from scene <from> to modeEnd.
// Checks: timer runs, split banner per level, no results/pizza/map scene in between, entrances (rush: every boss gets one, incl. Super Shredder),
// modeEnd summary, ssla_mode_best persisted across reload.
const { open } = require("./lib.js");
const DIR = process.argv[2], MODE = process.argv[3], PORT = +process.argv[4], TURBO = +(process.argv[5] || 2), FROM = +(process.argv[6] || 1);
const OUT = "/workspace/work/final/shots/" + MODE + "/"; require("fs").mkdirSync(OUT, { recursive: true });
(async () => {
  const T = await open({ dir: DIR, port: PORT });
  const r = { mode: MODE, levels: [], banners: [], entr: [], bad: [], ok: false };
  try {
    await T.S(() => 0).catch(() => {});
    await T.startMode(FROM, MODE, "&turbo=" + TURBO);
    await T.S((v) => { localStorage.removeItem("ssla_mode_best"); if (v) localStorage.setItem("ssla_mode_best", v); }, process.env.SEED_BEST || "").catch(() => {});
    await T.bot(true, 9);
    const t0 = Date.now(); let lastLv = 0, lastBan = 0, lastEntr = "", lastKey = "", lastChange = Date.now(), lastT = -1;
    while (true) {
      await T.p.waitForTimeout(300);
      const s = await T.S(() => { const S = __SS.STATE, E = S.entr; return { sc: S.scene, lv: S.level, t: S.t, res: !!S.results, pz: !!S.pizza, cut: !!S.cut, modeT: S.modeT || 0,
        entr: E ? (E.e && (E.e.name || E.e.type)) : "", q: (S.entrQ || []).length, sec: S.section + ":" + S.sec, en: S.enemies.length, camX: Math.round(S.camX), px: S.player ? Math.round(S.player.x) : 0,
        bossHp: S.enemies.filter((e) => e.boss).map((e) => e.hp).join(","), fe: (window.__frameErrors || {}).n || 0 }; });
      if (["map", "results"].includes(s.sc) || s.res || s.pz) { r.bad.push(s.sc + (s.res ? ":results" : "") + (s.pz ? ":pizza" : "") + "@L" + s.lv); T.log("BAD intermediate", JSON.stringify(s)); }
      if (s.lv !== lastLv && s.sc === "stage") { lastLv = s.lv; r.levels.push(s.lv); T.log(`${MODE} L${s.lv} start wall=${Math.round((Date.now() - t0) / 1000)}s`); }
      if (s.entr && s.entr !== lastEntr) { r.entr.push(s.lv + ":" + s.entr + (s.q ? "+q" + s.q : "")); T.log("entrance", s.lv, s.entr, "queue", s.q); }
      lastEntr = s.entr;
      if (s.modeT && !lastBan) {
        const b = await T.S(() => { const R = window.__SS.RUN ? __SS.RUN() : null; return null; });
        r.banners.push(s.lv); await T.shot(OUT + `banner_L${s.lv}.png`); T.log("split banner L" + s.lv);
      }
      lastBan = s.modeT;
      const key = [s.sec, s.en, s.camX, s.px, s.bossHp, s.modeT > 0, s.entr, s.sc, s.lv].join("|");
      if (key !== lastKey) { lastKey = key; lastChange = Date.now(); }
      if (s.sc === "modeEnd") { await T.p.waitForTimeout(1500); await T.shot(OUT + "modeEnd.png"); break; }
      if (Date.now() - lastChange > 45000) { r.softlock = s; await T.shot(OUT + "softlock.png"); T.log("SOFTLOCK", JSON.stringify(s)); break; }
      if (Date.now() - t0 > 3000000) { r.timeout = s; T.log("TIMEOUT", JSON.stringify(s)); break; }
      lastT = s.t;
    }
    await T.stopBot();
    r.best = await T.S(() => localStorage.getItem("ssla_mode_best"));
    // reload: persisted?
    await T.goto("?debug"); await T.until("window.__SS && __SS.STATE.scene === 'title'", 90000);
    r.bestAfterReload = await T.S(() => localStorage.getItem("ssla_mode_best"));
    const B = JSON.parse(r.bestAfterReload || "{}")[MODE] || {};
    r.lvBest = Object.keys(B.lv || {}).length; r.total = B.total || 0;
    r.ok = !r.softlock && !r.timeout && !r.bad.length && r.levels.length === 16 - FROM && r.banners.length === 16 - FROM && r.lvBest === 16 - FROM && (FROM > 1 || r.total > 0) && r.bestAfterReload === r.best;
    // menu shot showing the best line
    await T.installTouch(); await T.tap(192, 120); await T.frames(20); await T.shot(OUT + "menu_after.png");
  } catch (e) { r.err = e.message.slice(0, 300); T.log("ERR", r.err); }
  r.pe = T.errs.length; r.fe = await T.S(() => (window.__frameErrors || {}).n || 0).catch(() => -1);
  T.log("RESULT", JSON.stringify(r));
  await T.close(); process.exit(0);
})().catch((e) => { console.log("FAIL", e.stack); process.exit(1); });
