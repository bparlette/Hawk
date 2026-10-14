// node soak2.js <dir> <secs> <port> : WebKit iPhone-13 touch soak across modes (arcade / speed / rush), bot with assist; page/frame errors + live audio nodes
const { open } = require("./lib.js");
const DIR = process.argv[2], SECS = +process.argv[3] || 300, PORT = +process.argv[4];
(async () => {
  const T = await open({ dir: DIR, port: PORT });
  const t0 = Date.now(); const plan = [[1, "arcade"], [7, "speed"], [13, "rush"], [15, "arcade"], [3, "rush"], [10, "speed"]]; let i = 0, maxAn = 0; const an = [];
  while (Date.now() - t0 < SECS * 1000) {
    const [n, m] = plan[i++ % plan.length]; await T.startMode(n, m); await T.bot(true, 30 + i); T.log("start", m, n);
    const t1 = Date.now();
    while (Date.now() - t1 < 55000 && Date.now() - t0 < SECS * 1000) {
      await T.p.waitForTimeout(10000);
      const s = await T.S(() => ({ t: __SS.STATE.t, sc: __SS.STATE.scene, lvl: __SS.STATE.level, an: __AN.live, started: __AN.started, fe: (window.__frameErrors || {}).n || 0, eng: __SSENG.stats() }));
      maxAn = Math.max(maxAn, s.an); an.push(s.an);
      T.log(Math.round((Date.now() - t0) / 1000) + "s", m, JSON.stringify(s));
    }
    await T.stopBot();
  }
  const fe = await T.S(() => { const F = window.__frameErrors || {}; return F.n ? [F.n, String(F.last)] : []; });
  T.log("SOAK DONE secs", Math.round((Date.now() - t0) / 1000), "pageErrors", T.errs.length, "frameErrors", fe.length, JSON.stringify(fe), "liveAudio max", maxAn, "samples", an.join(","));
  await T.close(); process.exit(0);
})().catch((e) => { console.log("FAIL", e.stack); process.exit(1); });
