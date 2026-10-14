// Headless sim of Level 3 (ringRush). Usage: node work/sim3.js [maxSpeedFrac]
var fs = require("fs");
var src = fs.readFileSync(process.env.HTML, "utf8");
var a = src.indexOf("var ringRush = {"), b = src.indexOf("var GAMES =");
var code = src.slice(a, b);
var noop = function () {};
var ctxStub = new Proxy({}, { get: function (t, k) { return k in t ? t[k] : (k === "createLinearGradient" || k === "createRadialGradient") ? function () { return { addColorStop: noop }; } : noop; }, set: function (t, k, v) { t[k] = v; return true; } });
var W = 320, H = 240, keys = {}, pressed = {};
var SFX = { jump: noop, hit: noop, win: noop, pick: noop, smash: noop };
function beep() {} function noise() {} function text() {}
global.setTimeout = function () {};
var ringRush = eval(code + "; ringRush");
function run(opts) {
  var res = { won: false, frames: 0, deaths: [], maxX: 0, rings: 0 };
  var api = { win: function (s) { res.won = true; res.score = s; }, lose: function () { res.lost = true; } };
  ringRush.init(api);
  var G = ringRush, lastLives = G.lives, stuck = 0, lastX = 0;
  for (var f = 0; f < 60 * 120 && !res.won && !res.lost; f++) {
    var P = G.p, k = { right: true }, p = {};
    if (opts.lift && Math.abs(P.vx) > opts.lift) k.right = false; // moderate-speed player
    // look ahead for pits / enemies
    var look = opts.look + Math.abs(P.vx) * 6;
    if (!P.on && !P.dead && look <= 2 && G.gy(P.x) >= 999 && P.vy >= 0 && !P.spin && Math.random() < 0.5) p.a = true; // coyote press
    if (P.on && !P.dead) {
      var pit = false;
      for (var d = 0; d < look; d += 2) if (G.gy(P.x + d) >= 999) { pit = true; break; }
      var en = G.E.some(function (e) { return e.alive && e.x - P.x > 0 && e.x - P.x < 28 + Math.abs(P.vx) * 4; });
      if ((pit && G.gy(P.x + 6) >= 999 - 1 ? true : pit && Math.random() < opts.react) || en && Math.random() < opts.react) p.a = true;
    }
    G.update({ k: k, p: p });
    G.draw(ctxStub);
    if (G.lives < lastLives) { res.deaths.push(Math.round(lastX)); lastLives = G.lives; }
    if (!G.p.dead) lastX = G.p.x;
    res.maxX = Math.max(res.maxX, G.p.x);
    if (f % 300 === 299) { if (Math.abs(G.p.x - res.prevX) < 20 && !G.p.dead) { res.stuck = Math.round(G.p.x); break; } res.prevX = G.p.x; }
    if (opts.trace && f % opts.trace === 0) console.log(f, Math.round(G.p.x), Math.round(G.p.y), G.p.vx.toFixed(2), G.p.vy.toFixed(2), G.p.on, G.p.dead, G.lives);
    if (!G.p.dead && G.p.on && G.gy(G.p.x) < 999 && Math.abs(G.p.y - G.gy(G.p.x)) > 1) res.offGround = Math.round(G.p.x);
    if (!G.p.dead && G.p.y > G.gy(G.p.x) + 2 && G.gy(G.p.x) < 999 && !res.through) { res.through = Math.round(G.p.x); res.ti = [f, G.p.y, G.gy(G.p.x), G.p.vx, G.p.vy, G.p.on, G.lives, G.won]; }
    if (G.spring.t === 12) res.spring = Math.round(G.p.vy * 10) / 10;
  }
  res.frames = f; res.rings = G.rings; res.lives = G.lives; res.score = G.score;
  return res;
}
if (process.argv[2] === "trace") { console.log(JSON.stringify(run({ look: +process.argv[5] || 20, react: +process.argv[6] || 1, trace: +process.argv[3] || 10, lift: +process.argv[4] || 0 }))); return; }
var configs = [
  { name: "fast", look: 20, react: 1 },
  { name: "moderate 2.5", look: 20, react: 1, lift: 2.5 },
  { name: "slow 2.0", look: 20, react: 1, lift: 2.0 },
  { name: "sloppy", look: 20, react: 0.3, lift: 3 },
  { name: "late-edge 2.5", look: -14, react: 0.5, lift: 2.5 },
  { name: "late-edge fast", look: -20, react: 0.2 },
  { name: "slow 1.6", look: 10, react: 1, lift: 1.6 }
];
configs.forEach(function (c) {
  var wins = 0, sample = null, tries = [];
  for (var i = 0; i < 40; i++) { var r = run(c); if (r.won) wins++; if (!sample || (!r.won && sample.won)) sample = r; tries.push(3 - r.lives + (r.won ? 0 : 0)); }
  console.log(c.name, "wins", wins + "/40", JSON.stringify(sample));
});
