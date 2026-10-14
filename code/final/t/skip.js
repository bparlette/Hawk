// node skip.js <dir> <cases csv> <port> : touch (screen tap) skip of each boss entrance on iPhone-13 WebKit.
// case n = Boss Rush scene n (straight to the arena + entrance); "15s" = Super Shredder (Shredder KO'd after his skipped entrance).
// Pass: entrance active, tapped at t>=30 -> gone within a few frames before len, skipped flag, boss(es) in walk, inv 0, then takes damage.
const { open } = require("./lib.js");
const DIR = process.argv[2], CASES = process.argv[3].split(","), PORT = +process.argv[4];
const OUT = "/workspace/work/final/shots/skip/"; require("fs").mkdirSync(OUT, { recursive: true });
(async () => {
  const T = await open({ dir: DIR, port: PORT }); const all = [];
  for (const C of CASES) {
    const n = parseInt(C, 10), want = C === "15s" ? "SUPER SHREDDER" : null, r = { c: C, ok: false }; const pe0 = T.errs.length;
    let botOn = false;
    try {
      await T.startMode(n, "rush");
      for (let i = 0; i < 1500; i++) {
        const s = await T.S(() => { const E = __SS.STATE.entr; return E ? { t: E.t, len: E.len, name: E.e && (E.e.name || E.e.type) } : null; });
        if (s && (!want || s.name === want) && s.t >= 30) { r.name = s.name; r.len = s.len; r.tAt = s.t; break; }
        if (s && want && s.name !== want) { await T.tap(192, 120); await T.frames(5); continue; }
        if (want) { // 15s: let the bot beat a 1-hp Shredder the normal way, stop it the moment Super Shredder's entrance starts
          if (s) { if (botOn) { await T.stopBot(); botOn = false; } }
          else { if (!botOn) { await T.bot(true, 4); botOn = true; } await T.S(() => { for (const e of __SS.STATE.enemies) if (e.boss && e.name !== "SUPER SHREDDER" && e.hp > 1) e.hp = 1; }); }
        } else if (!s) await T.S(() => __T.stick(1, 0)); else await T.S(() => __T.stick(0, 0)); // walk on until the boss shows up (L5 rush strip)
        await T.p.waitForTimeout(100);
      }
      if (!r.name) throw new Error("no entrance");
      await T.shot(OUT + C + "_pre.png");
      await T.tap(192, 120); // tap the screen
      await T.frames(4);
      const e1 = await T.S(() => { const S = __SS.STATE; return { entr: !!S.entr, q: (S.entrQ || []).length, bosses: S.enemies.filter((e) => e.boss).map((e) => ({ n: e.name, st: e.state, inv: e.inv, hp: e.hp, sx: Math.round(e.x - S.camX) })) }; });
      r.after = e1; await T.shot(OUT + C + "_post.png");
      await T.bot(true, 3); await T.p.waitForTimeout(+process.env.BOTMS || 8000); await T.stopBot();
      const hp1 = await T.S(() => __SS.STATE.enemies.filter((e) => e.boss).reduce((a, e) => a + e.hp, 0));
      const hp0 = e1.bosses.reduce((a, e) => a + e.hp, 0); r.hp = [hp0, hp1];
      r.ok = !e1.entr && e1.bosses.length > 0 && e1.bosses.every((b) => b.st === "walk" && b.inv === 0) && hp1 < hp0;
    } catch (e) { r.err = e.message.slice(0, 200); }
    r.pe = T.errs.length - pe0; r.fe = await T.S(() => (window.__frameErrors || {}).n || 0).catch(() => -1);
    all.push(r); T.log("CASE", JSON.stringify(r));
  }
  T.log("SKIP SUMMARY", all.filter((r) => r.ok).length + "/" + all.length, JSON.stringify(all.map((r) => r.c + ":" + (r.ok ? "PASS" : "FAIL"))));
  await T.close(); process.exit(0);
})().catch((e) => { console.log("FAIL", e.stack); process.exit(1); });
