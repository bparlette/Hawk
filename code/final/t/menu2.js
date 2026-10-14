// menu2.js: arcade menu with CONTINUE (4 rows) + full-page iPhone-13 landscape shots of each tab
const L = require("./lib.js");
(async () => {
  const g = await L.open({ dir: "/workspace/work/final/site", port: 8942 });
  const { S, until, frames, tap, shot } = g; const O = "/workspace/work/final/shots/menu/";
  await g.goto(); await until("window.__SS && __SS.STATE.t > 5 && __SS.STATE.scene === 'title'", 90000);
  await S(() => { localStorage.setItem("ssla_progress", JSON.stringify({ done: [1, 2, 3], last: 3, bro: 1 })); localStorage.setItem("ssla_mode", '"arcade"'); localStorage.setItem("ssla_mode_best", JSON.stringify({ speed: { total: 50273, lv: { 1: 2154 } }, rush: { lv: {} } })); });
  await g.goto(); await until("window.__SS && __SS.STATE.t > 5 && __SS.STATE.scene === 'title'", 90000); await frames(40);
  await g.installTouch(); await tap(192, 120); await frames(20);
  await shot(O + "m2_arcade.png"); await shot(O + "m2_arcade_full.png", true);
  await tap(192, 100); await frames(10); await shot(O + "m2_speed.png"); await shot(O + "m2_speed_full.png", true);
  await tap(270, 100); await frames(10); await shot(O + "m2_rush_full.png", true);
  console.log("errs", g.errs.length); await g.close();
})().catch((e) => { console.log("FAIL", e); process.exit(1); });
