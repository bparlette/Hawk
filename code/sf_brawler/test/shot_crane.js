const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 704, height: 1520 } }); let errs = 0;
  pg.on("pageerror", (e) => { errs++; console.log("PAGEERROR", e.message); });
  await pg.goto("file:///workspace/work/sf_brawler/game/index.html?level=2&debug&nocache&nomap");
  const S = (fn) => pg.evaluate(fn); const until = (c, ms = 90000) => pg.waitForFunction(c, null, { timeout: ms, polling: 100 });
  const key = async (k) => { await pg.keyboard.down(k); await pg.waitForTimeout(120); await pg.keyboard.up(k); };
  await until("window.__SS && __SS.STATE.t > 60");
  for (let i = 0; i < 40; i++) { if (await S(() => __SS.STATE.scene) === "select") break; await key("Enter"); await pg.waitForTimeout(400); }
  await key("Enter"); await until("__SS.STATE.scene === 'stage' && __SS.STATE.player");
  await until("__SS.STATE.t > 400");
  await S(() => { const T = __SS.STATE; T.player.inv = 9999; const p = T.player; for (const z of T.haz) if (z.st && "drop" in z.st) z.st.drop = { x: p.x + 40, y: p.y, t: 46 }; });
  await pg.waitForTimeout(150); await S(() => { __SS.STATE.dbgFreeze = true; }); await pg.waitForTimeout(500);
  await (await pg.$("#game")).screenshot({ path: "/workspace/work/sf_brawler/test/shots/stage2/03b_crane.png" });
  console.log("PAGE ERRORS:", errs); await b.close();
})().catch((e) => { console.log("FAILED", e.message); process.exit(1); });
