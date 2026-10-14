// node arcade.js <dir> <levels csv> <port> [turbo] : WebKit iPhone-13 touch bot, Arcade level n from NEW GAME to results.
// Logs section/twist progress, twist goal cause (cap vs normal), softlocks (no progress), page/frame errors.
const { open } = require("./lib.js");
const DIR = process.argv[2], LV = process.argv[3].split(",").map(Number), PORT = +process.argv[4], TURBO = +(process.argv[5] || 2);
const OUT = "/workspace/work/final/shots/arc/"; require("fs").mkdirSync(OUT, { recursive: true });
(async () => {
  const T = await open({ dir: DIR, port: PORT });
  const summary = [];
  for (const n of LV) {
    const r = { lv: n, ok: false, twists: [], secs: [], pe0: T.errs.length };
    try {
      await T.startMode(n, "arcade", "&turbo=" + TURBO); await T.bot(true, 5 + n);
      const t0 = Date.now(); let lastKey = "", lastChange = Date.now(), lastSec = "", tw = null;
      while (true) {
        await T.p.waitForTimeout(500);
        const s = await T.S(() => { const S = __SS.STATE, w = S.tw; return { sc: S.scene, t: S.t, sec: S.section + ":" + S.sec, res: !!S.results, pz: !!S.pizza, en: S.enemies.length, camX: Math.round(S.camX), px: S.player ? Math.round(S.player.x) : 0, hp: S.player ? S.player.hp : 0,
          ot: S.outro ? S.outro.t >> 5 : -1, sc2: S.score, entr: !!S.entr, fo: S.fadeOut, ph: S.phase, fe: (window.__frameErrors || {}).n || 0,
          tw: w ? { kind: w.d.kind, t: w.t, goal: w.goal, done: w.done, max: w.d.maxLen || 3900, goalAt: w.goalAt } : null }; });
        if (s.tw && (!tw || tw.kind !== s.tw.kind || s.sec !== tw.sec)) { tw = { kind: s.tw.kind, sec: s.sec, goalT: 0, capped: false }; r.twists.push(tw); }
        if (tw && s.tw && s.tw.kind === tw.kind && s.tw.goal && !tw.goalT) { tw.goalT = s.tw.t; tw.capped = s.tw.t > s.tw.max; T.log(`L${n} twist ${tw.kind} goal at t=${s.tw.t} capped=${tw.capped}`); }
        if (tw && s.tw && s.tw.done && !tw.doneT) tw.doneT = s.tw.t;
        if (s.sec !== lastSec) { r.secs.push(s.sec); lastSec = s.sec; T.log(`L${n} sec ${s.sec} t=${s.t} wall=${Math.round((Date.now() - t0) / 1000)}s`); if (r.secs.length <= 8) await T.shot(OUT + `L${n}_${r.secs.length}.png`); }
        const key = [s.sec, s.en, s.camX, s.px, s.sc2, s.pz, s.res, s.fo, s.entr, s.ph, s.tw && s.tw.goal, s.ot].join("|");
        if (key !== lastKey) { lastKey = key; lastChange = Date.now(); }
        if (s.res) { r.ok = true; r.t = s.t; r.wall = Math.round((Date.now() - t0) / 1000); await T.shot(OUT + `L${n}_results.png`); break; }
        if (Date.now() - lastChange > 45000) { r.softlock = s; r.dump = await T.S(() => { const S = __SS.STATE, p = S.player, pick = (o) => { const q = {}; for (const k in o) { const v = o[k]; if (v === null || ["number", "string", "boolean"].includes(typeof v)) q[k] = v; } return q; }; return { p: Object.assign(pick(p), { grabbedBy: !!p.grabbedBy, bro: p.bro && p.bro.name }), en: S.enemies.map(pick), locked: S.locked, phase: S.phase, entr: !!S.entr, entrQ: (S.entrQ || []).length, cut: !!S.cut }; }); T.log("DUMP", JSON.stringify(r.dump)); await T.shot(OUT + `L${n}_softlock.png`); T.log(`L${n} SOFTLOCK`, JSON.stringify(s)); break; }
        if (Date.now() - t0 > 900000) { r.timeout = s; await T.shot(OUT + `L${n}_timeout.png`); T.log(`L${n} TIMEOUT`, JSON.stringify(s)); break; }
        r.fe = s.fe;
      }
    } catch (e) { r.err = e.message.slice(0, 300); T.log("ERR", r.err); }
    await T.stopBot();
    r.pe = T.errs.length - r.pe0; r.fe = await T.S(() => (window.__frameErrors || {}).n || 0).catch(() => -1);
    summary.push(r); T.log("RESULT", JSON.stringify(r));
  }
  T.log("SUMMARY", JSON.stringify(summary.map((r) => ({ lv: r.lv, ok: r.ok, t: r.t, pe: r.pe, fe: r.fe, tw: r.twists.map((w) => w.kind + "@" + w.goalT + (w.capped ? "CAP" : "")).join(","), soft: !!r.softlock }))));
  await T.close(); process.exit(0);
})().catch((e) => { console.log("FAIL", e.stack); process.exit(1); });
