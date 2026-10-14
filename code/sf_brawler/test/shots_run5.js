// RUN 5 contact-sheet shots: title, map, every grunt type in every state, props/food, enemy projectiles, tea break.
// usage: HTML=index.html TAG=after node shots_run5.js     (HTML is a file in ../game so assets resolve)
const { chromium } = require("playwright");
const HTML = process.env.HTML || "index.html", TAG = process.env.TAG || "after";
const OUT = "/workspace/work/sf_brawler/test/shots/run5/" + TAG + "/";
const BASE = "file:///workspace/work/sf_brawler/game/" + HTML;
(async () => {
  require("fs").mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 704, height: 1520 } });
  let errs = 0;
  pg.on("pageerror", (e) => { errs++; console.log("PAGEERROR", e.message); });
  pg.on("console", (m) => { if (m.type() === "error" && !/level2/.test(m.text())) console.log("CONSOLE", m.text()); });
  await pg.goto(BASE + "?debug&nocache");
  const S = (fn, a) => pg.evaluate(fn, a);
  const until = async (cond, ms = 60000) => { await pg.waitForFunction(cond, null, { timeout: ms, polling: 100 }); };
  const frames = async (n) => { const t0 = await S(() => __SS.STATE.t); await until(`__SS.STATE.t >= ${t0 + n}`); };
  const key = async (k) => { await pg.keyboard.down(k); await pg.waitForTimeout(120); await pg.keyboard.up(k); };
  const canvas = async (n) => { await (await pg.$("#game")).screenshot({ path: OUT + n }); console.log("shot", n); };
  await until("window.__SS && __SS.STATE.t > 5");
  await frames(120); await canvas("01_title.png");
  await key("Enter"); await until("__SS.STATE.scene === 'select'"); await frames(10);
  await key("Enter"); await until("__SS.STATE.scene === 'map'"); await frames(110); await canvas("02_map.png");
  await key("Enter"); await until("__SS.STATE.scene === 'stage'", 60000); await frames(30);
  await S(() => { const T = __SS.STATE; T.enemies = []; T.queue = []; T.locked = true; T.player.inv = 99999; T.player.hp = 16; T.props = []; T.items = []; T.stars = []; T.player.y = 214; T.player.x = T.camX + 16; });
  const TYPES = ["purple", "blue", "star", "sword", "dasher", "heavy"];
  const ST = { idle: { state: "walk", walkT: 0 }, walk: { state: "walk", walkT: 9 }, attack: { state: "attack", t: 20 }, jump: { state: "walk", z: 18, walkT: 0 }, hurt: { state: "hurt", t: 2 }, down: { state: "down", t: 20 } };
  for (const [nm, o] of Object.entries(ST)) {
    await S(([TYPES, o]) => {
      const T = __SS.STATE; T.dbgFreeze = false; T.enemies = TYPES.map((type, i) => Object.assign({ type, x: T.camX + 40 + i * 60, y: 196, z: 0, vz: 0, vx: 0, hp: 5, maxHp: 5, t: 0, facing: 1, flash: 0, cool: 9999, walkT: 0, inv: 0, hits: [], entered: true, side: 1, taunt: 0 }, o));
      T.dbgFreeze = true;
    }, [TYPES, o]);
    await pg.waitForTimeout(700); await canvas("e_" + nm + ".png");
  }
  await S(() => {
    const T = __SS.STATE; T.dbgFreeze = false; T.enemies = []; T.props = []; T.items = [];
    __SS.spawnProp({ kind: "dummy", x: T.camX + 50, y: 180 }); __SS.spawnProp({ kind: "shoji", x: T.camX + 110, y: 180 }); __SS.spawnProp({ kind: "scrolls", x: T.camX + 175, y: 180 });
    ["onigiri", "tea", "chicken", "sushi"].forEach((f, i) => __SS.spawnItem({ food: f, kind: f === "chicken" || f === "sushi" ? "pizza" : "slice", x: T.camX + 240 + i * 36, y: 182 }));
    T.stars = [{ x: T.camX + 60, y: 212, vx: 2.4 }, { x: T.camX + 160, y: 212, vx: 2.8, kind: "hadou" }, { x: T.camX + 280, y: 212, vx: -4.2, kind: "hadoudark" }];
  });
  await frames(12); await S(() => { __SS.STATE.dbgFreeze = true; }); await pg.waitForTimeout(700); await canvas("p_props_food_shots.png");
  await S(() => { const T = __SS.STATE; T.dbgFreeze = false; T.stars = []; T.props = []; T.items = []; __SS.startPizza(); });
  await frames(70); await canvas("t_tea_break.png");
  console.log("PAGE ERRORS:", errs); await b.close();
})().catch((e) => { console.log("SHOTS FAILED", e.message); process.exit(1); });
