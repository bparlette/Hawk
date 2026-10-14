const L = require("./lib.js");
(async () => {
  const g = await L.open({ dir: "/workspace/work/deploy/shell-shock-live-action", port: 8951 });
  const { S, until, frames, tap, shot } = g; const O = "/workspace/work/menu5/";
  await g.goto(); await until("window.__SS && __SS.STATE.t > 5 && __SS.STATE.scene === 'title'", 90000);
  await S(() => { localStorage.setItem("ssla_progress", JSON.stringify({ done: [1, 2, 3], last: 3, bro: 1 })); localStorage.setItem("ssla_mode", '"rush"'); });
  await g.goto(); await until("window.__SS && __SS.STATE.t > 5 && __SS.STATE.scene === 'title'", 90000); await frames(40);
  await g.installTouch(); await tap(192, 120); await frames(20);
  await shot(O + "menu.png"); await shot(O + "menu_full.png", true);
  // tap SPEED RUN row (y = 106+22+6)
  await tap(192, 134); await frames(30);
  console.log("after speed tap", JSON.stringify(await S(() => ({ sc: __SS.STATE.scene, mode: localStorage.getItem("ssla_mode") }))));
  console.log("errs", g.errs.length, g.errs.slice(0,3)); await g.close();
})().catch((e) => { console.log("FAIL", e); process.exit(1); });
