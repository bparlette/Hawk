// Chromium screenshots of SF WORLD BRAWL. Waits on game frames (headless runs ~16 fps under load).
// PART=1: title (cabinet), select, map, card, gameplay, Ken.  PART=2 [PICK=n]: special move + Evil Ryu attacks.
// PART=3: vanish cutscene, outro, tea break, results, initials.   usage: PART=1 node shots.js [baseUrl]
const { chromium } = require("playwright");
const OUT = "/workspace/work/sf_brawler/test/shots/";
const BASE = process.argv[2] || "file:///workspace/work/sf_brawler/game/index.html";
const PART = process.env.PART || "1", PICK = +(process.env.PICK || 0);
(async () => {
  require("fs").mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 704, height: 1520 } });
  let errs = 0;
  pg.on("pageerror", (e) => { errs++; console.log("PAGEERROR", e.message); });
  pg.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.type(), m.text()); });
  await pg.goto(BASE + "?debug&nocache" + (PART !== "1" ? "&nomap" : ""));
  const S = (fn) => pg.evaluate(fn);
  const until = async (cond, ms = 60000) => { await pg.waitForFunction(cond, null, { timeout: ms, polling: 100 }); };
  const frames = async (n) => { const t0 = await S(() => __SS.STATE.t); await until(`__SS.STATE.t >= ${t0 + n}`); };
  const key = async (k) => { await pg.keyboard.down(k); await pg.waitForTimeout(120); await pg.keyboard.up(k); };
  const canvas = async (n) => { await (await pg.$("#game")).screenshot({ path: OUT + n }); console.log("shot", n); };
  const done = async () => { console.log("state", await S(() => JSON.stringify({ scene: __SS.STATE.scene, score: __SS.STATE.score }))); console.log("PAGE ERRORS:", errs); await b.close(); };
  await until("window.__SS && __SS.STATE.t > 5");

  if (PART === "1") {
    await frames(150);
    await pg.screenshot({ path: OUT + "01_title_cabinet.png" }); console.log("shot 01_title_cabinet.png");
    await canvas("01b_title_screen.png");
    await key("Enter"); await until("__SS.STATE.scene === 'select'"); await frames(20); await canvas("02_select.png");
    await key("Enter"); await until("__SS.STATE.scene === 'map'"); await frames(120); await canvas("03_map.png");
    await key("Enter"); await until("__SS.STATE.scene === 'card'"); await frames(40); await canvas("04_card.png");
    await until("__SS.STATE.scene === 'stage'"); await frames(60);
    await pg.keyboard.down("ArrowRight"); await frames(80); await pg.keyboard.up("ArrowRight");
    for (let i = 0; i < 5; i++) await key("j");
    await canvas("05_gameplay.png");
    await frames(60); await canvas("05c_gameplay.png");
    await S(() => { const T = __SS.STATE; T.player.hp = 16; T.player.grabbedBy = null; T.enemies = []; T.queue = []; T.locked = true; T.player.inv = 900; __SS.spawnMidBoss(); });
    await frames(170); await canvas("06_ken_intro.png");
    await until("__SS.STATE.enemies.some(e => e.boss && ['open','hado','shoryu'].includes(e.state) && e.t > 16)", 40000); await canvas("06b_ken_fight.png");
    await frames(150); await canvas("06c_ken_fight.png");
    return done();
  }
  await key("Enter"); await until("__SS.STATE.scene === 'select'"); await frames(5);
  for (let i = 0; i < PICK; i++) { await key("ArrowRight"); await frames(3); }
  await key("Enter"); await until("__SS.STATE.scene === 'stage'"); await frames(20);
  await S(() => { const T = __SS.STATE; T.enemies = []; T.queue = []; T.locked = true; T.player.inv = 900; T.player.hp = 16; T.player.grabbedBy = null; });
  if (PART === "4") {
    await S(() => { __SS.STATE.score = 23450; __SS.startPizza(); });
    await frames(60); await canvas("10_tea_break.png");
    await until("!!__SS.STATE.results", 60000); await frames(80); await canvas("11_results.png");
    await key("Enter"); await until("__SS.STATE.scene === 'initials'", 20000); await frames(30); await canvas("12_initials.png");
    for (let i = 0; i < 3; i++) { await key("j"); await frames(6); }
    await frames(90); await canvas("13_after_initials.png");
    console.log("hiscores", await S(() => JSON.stringify(__SS.HISCORES.slice(0, 3))), "LS keys", await S(() => Object.keys(localStorage).join(",")));
    return done();
  }
  if (PART === "2") { await frames(10); await key("l"); await frames(14); await canvas("05b_special_" + PICK + "a.png"); await frames(10); await canvas("05b_special_" + PICK + "b.png"); if (process.env.ONLYSPECIAL) return done(); }
  await S(() => { const T = __SS.STATE; T.enemies = []; T.queue = []; T.wave = 5; T.locked = false; T.player.x = 2290; T.player.hp = 16; });
  await until("__SS.STATE.sec === 1"); await frames(170);
  if (PART === "2") {
    await canvas("07_evil_intro.png"); await S(() => { __SS.STATE.player.inv = 900; });
    await until("__SS.STATE.enemies.some(e => e.boss && e.state === 'hado' && e.t > 14)", 40000); await canvas("07b_evil_hadouken.png");
    await until("__SS.STATE.enemies.some(e => e.boss && e.state === 'dash' && e.t > 12)", 40000); await canvas("07c_evil_dash.png");
    return done();
  }
  await S(() => { const e = __SS.STATE.enemies.find((x) => x.boss); if (e) e.hp = Math.max(1, Math.floor(e.maxHp * 0.08)); });
  await until("__SS.STATE.enemies.some(e => e.state === 'vanish')"); await frames(50); await canvas("08_vanish.png");
  await until("!!__SS.STATE.outro", 60000); await frames(60); await canvas("09_outro.png");
  await frames(160); await canvas("09b_outro_teaser.png");
  await until("!!__SS.STATE.pizza", 60000); await frames(60); await canvas("10_tea_break.png");
  await until("!!__SS.STATE.results", 60000); await frames(80); await canvas("11_results.png");
  await key("Enter"); await until("__SS.STATE.scene === 'initials'", 20000); await frames(30); await canvas("12_initials.png");
  return done();
})().catch((e) => { console.log("SHOTS FAILED", e.message); process.exit(1); });
