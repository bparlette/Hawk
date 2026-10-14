// node boss14.js <dir> <port> <runs> [lvl] [mode]: repeat a boss fight (rush start) with different bot seeds; dump on softlock
const { open } = require("./lib.js");
const DIR = process.argv[2], PORT = +process.argv[3], RUNS = +process.argv[4] || 5, LVL = +(process.argv[5] || 14), MODE = process.argv[6] || "rush";
(async () => {
  const T = await open({ dir: DIR, port: PORT }); const res = [];
  for (let i = 0; i < RUNS; i++) {
    const r = { i };
    try {
      await T.startMode(LVL, MODE, "&turbo=2"); if (process.env.WARP) { const W2 = +process.env.WARP; for (let k = 0; k < 40; k++) { const sec = await T.S(() => __SS.STATE.sec); if (sec >= W2) break; await T.S(() => { const S = __SS.STATE; if (S.tw) { S.tw.goal = 1; S.tw.done = 1; } S.enemies = S.enemies.filter((e) => e.boss); S.queue = []; if (!S.fadeOut) S.fadeOut = 1; }); await T.frames(60); } }
      await T.bot(true, 100 + i * 17);
      const t0 = Date.now(); let lastKey = "", lc = Date.now();
      while (true) {
        await T.p.waitForTimeout(400);
        const s = await T.S(() => { const S = __SS.STATE, p = S.player; return { t: S.t, modeT: S.modeT || 0, res: !!(S.results || S.pizza || S.outro), sc: S.scene, px: Math.round(p.x), py: Math.round(p.y), st: [p.downT, p.deadT, !!p.grabbedBy, p.hp].join(","), en: S.enemies.map((e) => e.type + ":" + e.state + ":" + Math.round(e.x) + ":" + e.hp).join("|") }; });
        const key = s.px + "|" + s.py + "|" + s.en + "|" + s.st;
        if (key !== lastKey) { lastKey = key; lc = Date.now(); }
        if (s.modeT || s.sc !== "stage" || s.res) { r.ok = true; r.wall = Math.round((Date.now() - t0) / 1000); break; }
        if (Date.now() - lc > 40000) {
          r.soft = await T.S(() => { const S = __SS.STATE, p = S.player, pick = (o) => { const q = {}; for (const k in o) { const v = o[k]; if (v === null || ["number", "string", "boolean"].includes(typeof v)) q[k] = v; } return q; };
            return { p: Object.assign(pick(p), { grabbedBy: !!p.grabbedBy }), en: S.enemies.map(pick), stars: S.stars.length, locked: S.locked, camX: S.camX, haz: S.haz && S.haz.length }; });
          await T.shot(`/workspace/work/final/shots/boss${LVL}_soft_${i}.png`); break; }
        if (Date.now() - t0 > 400000) { r.timeout = s; break; }
      }
    } catch (e) { r.err = e.message.slice(0, 200); }
    await T.stopBot(); res.push(r); T.log("RUN", JSON.stringify(r));
  }
  T.log("ERRS", T.errs.length); await T.close(); process.exit(0);
})().catch((e) => { console.log("FAIL", e.stack); process.exit(1); });
