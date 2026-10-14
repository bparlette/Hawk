// STAGES 2-3 screenshots: gameplay, painted props, hazard, boss arena + every painted boss state (frozen), outro.
// usage: LV=2 PICK=0 node shots_stage23.js
const { chromium } = require("playwright");
const LV = +(process.env.LV || 2), PICK = +(process.env.PICK || 0);
const OUT = "/workspace/work/sf_brawler/test/shots/stage" + LV + "/";
const BASE = "file:///workspace/work/sf_brawler/game/index.html";
const STATES = {
  2: [["idle", { state: "walk", walkT: 0 }], ["walk", { state: "walk", walkT: 13 }], ["slash", { state: "slash", t: 18, _ownState: "slash" }], ["burning", { state: "burning", t: 34, _ownState: "burning" }],
      ["scrape", { state: "scrape", t: 20, z: 30, _ownState: "scrape" }], ["grab", { state: "grab", t: 8, _ownState: "grab" }], ["buster", { state: "lift", t: 20, _ownState: "lift" }], ["catch", { state: "catch", t: 20, _ownState: "catch" }],
      ["meido", { state: "meido", t: 10, _ownState: "meido" }], ["hurt", { state: "hurt", t: 2 }], ["fall", { state: "down", t: 4, z: 14 }], ["down", { state: "down", t: 30 }], ["getup", { state: "getup", t: 10 }], ["ko", { state: "dying", t: 30 }]],
  3: [["idle", { state: "walk", walkT: 0 }], ["walk", { state: "walk", walkT: 13 }], ["chain", { state: "chain", t: 24, _ownState: "chain" }], ["bullhead", { state: "bullhead", t: 30, z: 12, _ownState: "bullhead" }],
      ["bullhorn", { state: "bullhorn", t: 10, _ownState: "bullhorn" }], ["murder", { state: "murder", t: 12, _ownState: "murder" }], ["birdie", { state: "bullhorn", t: 40, _ownState: "bullhorn" }], ["taunt", { state: "taunt", t: 20, _ownState: "taunt" }],
      ["hurt", { state: "hurt", t: 2 }], ["fall", { state: "down", t: 4, z: 14 }], ["down", { state: "down", t: 30 }], ["getup", { state: "getup", t: 10 }], ["ko", { state: "dying", t: 30 }]],
};
(async () => {
  require("fs").mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 704, height: 1520 } });
  let errs = 0;
  pg.on("pageerror", (e) => { errs++; console.log("PAGEERROR", e.message); });
  pg.on("console", (m) => { if ((m.type() === "error" || m.type() === "warning") && !/level\d+\.js|Failed to load resource/.test(m.text())) { console.log("CONSOLE", m.type(), m.text()); if (/hook error|drawTinted/.test(m.text())) errs++; } });
  await pg.goto(BASE + "?level=" + LV + "&debug&nocache&nomap");
  const S = (fn, a) => pg.evaluate(fn, a);
  const until = async (cond, ms = 90000) => { console.log("wait", String(cond).slice(0, 70)); try { await pg.waitForFunction(cond, null, { timeout: ms, polling: 100 }); } catch (e) { console.log("TIMEOUT on", String(cond), "scene=", await pg.evaluate(() => window.__SS && __SS.STATE.scene + " t=" + __SS.STATE.t)); throw e; } };
  const frames = async (n) => { const t0 = await S(() => __SS.STATE.t); await until(`__SS.STATE.t >= ${t0 + n}`); };
  const key = async (k) => { await pg.keyboard.down(k); await pg.waitForTimeout(120); await pg.keyboard.up(k); };
  const canvas = async (n) => { await (await pg.$("#game")).screenshot({ path: OUT + n }); console.log("shot", n); };
  await until("window.__SS && __SS.STATE.t > 5");
  await frames(60);
  for (let i = 0; i < 40; i++) { const sc = await S(() => __SS.STATE.scene); if (sc === "select") break; if (i % 5 === 0) console.log("scene", sc); await key(sc === "title" || sc === "levelsel" ? "Enter" : "Enter"); await frames(20); }
  await until("__SS.STATE.scene === 'select'"); await frames(10);
  for (let i = 0; i < PICK; i++) { await key("ArrowRight"); await frames(4); }
  await key("Enter"); await until("__SS.STATE.scene === 'stage' && __SS.STATE.player", 90000);
  await S(() => { __SS.STATE.player.inv = 99999; });
  await until("__SS.STATE.cardT === undefined || __SS.STATE.cardT <= 0", 30000).catch(() => {});
  await frames(150); await canvas("01_gameplay.png");
  // props + crane/taxi hazard near the player
  await S(() => { const T = __SS.STATE; T.player.hp = 16; T.player.x = T.camX + 60; for (const e of T.enemies) e.x = Math.min(e.x, T.camX + 360); });
  await frames(240); await canvas("02_gameplay_b.png");
  await S(() => { const T = __SS.STATE; T.locked = true; T.locked = true; for (const z of T.haz || []) if (z.st && "next" in z.st) { z.st.t = z.st.next; } });
  await frames(44); await canvas("03_hazard.png");
  // skip to the arena
  await S(() => { const T = __SS.STATE, L = __SS.LEVELS[T.level - 1], s0 = L.sections[0]; T.enemies = []; T.queue = []; T.wave = s0.locks.length; T.locked = false; T.phase = "exit"; T.camX = s0.length - 384; T.player.x = s0.length - 20; });
  await until("__SS.STATE.sec === 1", 30000); await until("__SS.STATE.enemies.some(e => e.boss)", 30000); await frames(150);
  await S(() => { __SS.STATE.player.hp = 16; }); await canvas("04_boss_intro.png");
  await frames(200); await canvas("05_boss_fight.png");
  for (const [nm, o] of STATES[LV]) {
    await S(([o]) => {
      const T = __SS.STATE, e = T.enemies.find((q) => q.boss); T.dbgFreeze = false; T.stars = [];
      Object.assign(e, { x: T.camX + 200, y: 196, z: 0, vz: 0, vx: 0, facing: -1, flash: 0, warn: false, alpha: 1, cool: 9999, walkT: 0 }, o);
      T.player.x = T.camX + 90; T.player.y = 196; T.player.z = 0; T.player.heldAt = null; T.dbgFreeze = true;
    }, [o]);
    await pg.waitForTimeout(500); await canvas("b_" + nm + ".png");
  }
  await S(() => { const T = __SS.STATE; T.dbgFreeze = false; const e = T.enemies.find((q) => q.boss); Object.assign(e, { state: "walk", t: 0, _ownState: null, z: 0, cool: 30 }); e.hp = 1; });
  // let the bot-free player just stand; kill via hp
  await S(() => { const T = __SS.STATE, e = T.enemies.find((q) => q.boss); e.hp = 0; e.state = "dying"; e.t = 0; T.bossDown = true; });
  await until("__SS.STATE.outro", 60000).catch(() => console.log("no outro flag"));
  await frames(250); await canvas("06_outro.png");
  console.log("PAGE ERRORS:", errs); await b.close();
})().catch((e) => { console.log("SHOTS FAILED", e.message); process.exit(1); });
