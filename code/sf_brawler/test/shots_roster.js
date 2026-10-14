// Chromium: every fighter's special mid-move. usage: [PICKS=0,1,..] node shots_roster.js  -> shots/roster/sp_<n>_<k>.png + meta.json
const { chromium } = require("playwright");
const fs = require("fs");
const OUT = "/workspace/work/sf_brawler/test/shots/roster/";
const BASE = process.argv[2] || "file:///workspace/work/sf_brawler/game/index.html";
const PICKS = (process.env.PICKS || "0,1,2,3,4,5,6,7,8,9,10,11").split(",").map(Number);
const PHASES = (process.env.PHASES || "0.12,0.4,0.75").split(",").map(Number);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  let errs = 0; const meta = {};
  const pg = await b.newPage({ viewport: { width: 704, height: 1520 }, deviceScaleFactor: 2 });
  pg.on("pageerror", (e) => { errs++; console.log("PAGEERROR", e.message); });
  pg.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text()); });
  await pg.goto(BASE + "?debug&nocache&nomap");
  const S = (fn, a) => pg.evaluate(fn, a);
  const until = async (cond, ms = 60000) => { await pg.waitForFunction(cond, null, { timeout: ms, polling: "raf" }); };
  const frames = async (n) => { const t0 = await S(() => __SS.STATE.t); await until(`__SS.STATE.t >= ${t0 + n}`); };
  const key = async (k) => { await pg.keyboard.down(k); await pg.waitForTimeout(90); await pg.keyboard.up(k); };
  await until("window.__SS && __SS.STATE.t > 5");
  await key("Enter"); await until("__SS.STATE.scene === 'select'"); await frames(3);
  await key("Enter"); await until("__SS.STATE.scene === 'stage'"); await frames(10);
  for (const PICK of PICKS) { // swap the fighter in place (same stage) - one page load for the whole roster
    const name = await S((i) => { const T = __SS.STATE, p = T.player; p.bro = SS.api.BROTHERS[i]; T.enemies = []; T.queue = []; T.locked = true; p.inv = 0; p.hp = 16; p.grabbedBy = null; p.facing = 1; p.x = T.camX + 70; T.pBark = null; return p.bro.key; }, PICK);
    await until("__SS.STATE.player.atk == null && __SS.STATE.player.z === 0", 20000);
    await S(() => { const T = __SS.STATE, p = T.player; p.x = T.camX + 70; p.inv = 0; __SS.startSpecial(p); });
    for (let k = 0; k < PHASES.length; k++) {
      await until(`__SS.STATE.player.atk === 'power' && (1 - __SS.STATE.player.attackT / __SS.STATE.player.atkDur) >= ${PHASES[k]}`, 20000);
      await S(() => { __SS.STATE.dbgFreeze = true; __SS.STATE.player.inv = 0; }); await pg.waitForTimeout(200);
      await (await pg.$("#game")).screenshot({ path: OUT + `sp_${PICK}_${k}.png` });
      const info = await S(() => { const T = __SS.STATE, p = T.player; return { x: p.x - T.camX, y: p.y - p.z, pr: 1 - p.attackT / p.atkDur, shots: (T.pshots || []).map((s) => [s.x - T.camX, s.y - s.z]) }; });
      meta[`${PICK}_${k}`] = Object.assign({ name }, info);
      console.log("shot", PICK, name, k, JSON.stringify(info));
      await S(() => { __SS.STATE.dbgFreeze = false; });
    }
    fs.writeFileSync(OUT + `meta_${PICK}.json`, JSON.stringify(Object.fromEntries(Object.entries(meta).filter(([k]) => k.startsWith(PICK + "_")))));
    await S(() => { __SS.STATE.pshots = []; });
  }
  let old = {}; try { old = JSON.parse(fs.readFileSync(OUT + "meta.json", "utf8")); } catch (_) {}
  fs.writeFileSync(OUT + "meta.json", JSON.stringify(Object.assign(old, meta)));
  console.log("PAGE ERRORS:", errs);
  await b.close();
})().catch((e) => { console.log("SHOTS FAILED", e.message); process.exit(1); });
