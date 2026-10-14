// Headless sim of Level 5 (balloonBrawl). Usage: node work/sim5.js [trace]
var fs = require("fs");
var src = fs.readFileSync(process.env.HTML, "utf8");
var a = src.indexOf("var balloonBrawl = {"), b = src.indexOf("var GAMES =");
var code = src.slice(a, b);
var noop = function () {};
var ctxStub = new Proxy({}, { get: function (t, k) { return k in t ? t[k] : (k === "createLinearGradient" || k === "createRadialGradient") ? function () { return { addColorStop: noop }; } : noop; }, set: function (t, k, v) { t[k] = v; return true; } });
var W = 320, H = 240;
var SFX = new Proxy({}, { get: function () { return noop; } });
function beep() {} function text() {} var noise = noop, kick = noop;
global.setTimeout = function () {};
var balloonBrawl = eval(code + "; balloonBrawl");
function run(o) {
  var res = { won: false, lost: false, deaths: [], causes: {} };
  var api = { win: function (s) { res.won = true; res.score = s; }, lose: function () { res.lost = true; } };
  var G = balloonBrawl; G.init(api);
  var lastLives = G.lives, cause = "", stuckFoe = {}, chuteAge = {}, maxFish = 0, held = false, hold = 0;
  for (var f = 0; f < 60 * 240 && !res.won && !res.lost; f++) {
    var P = G.p, k = {}, p = {};
    if (!P.dead) {
      var best = null, bd = 1e9;
      G.foes.forEach(function (e) { var d = Math.abs(G.wdx(e.x, P.x)) + Math.abs(e.y - P.y) * 0.5; if (d < bd) { bd = d; best = e; } });
      var ty = best ? (best.st === "fly" ? best.y - 14 - o.slack : best.y) : 120;
      var overW = P.x > 46 && P.x < 274;
      var want = P.y > ty || (overW && P.y > 180);
      if (Math.random() < o.react) held = want;
      if (held && f % o.tap === 0) p.a = true;
      if (best && Math.random() < o.react) { var dx = G.wdx(best.x, P.x); if (best.st !== "fly" || P.y < best.y - 6 || Math.abs(dx) > 30) { if (dx > 4) k.right = true; if (dx < -4) k.left = true; } else { if (dx > 0) k.left = true; else k.right = true; } }
    }
    try { G.update({ k: k, p: p }); G.draw(ctxStub); } catch (err) { res.err = err.stack.split("\n").slice(0, 3).join(" | "); break; }
    if (G.lives < lastLives) { lastLives = G.lives; res.deaths.push(cause); }
    if (P.dead === 90) { cause = G.fish ? "fish@" + Math.round(G.fishY || 0) : P.sink ? "water" : "foe"; res.causes[cause] = (res.causes[cause] || 0) + 1; }
    G.foes.forEach(function (e, i) {
      if (e.x < 0 || e.x >= 320 || e.y < 0 || e.y > 240 || isNaN(e.x + e.y)) res.offscreen = [e.st, e.x, e.y];
      if (e.st !== "chute") e._ca = 0;
      if (e.st === "chute") { e._ca = (e._ca || 0) + 1; if (e._ca > 600 && !res.chuteStuck) { res.chuteStuck = [e.x, e.y]; if (process.env.DBG) console.log("STUCK", f, JSON.stringify(e), JSON.stringify(G.p)); } }
      if (e.st === "fly") { e._u = e._u || 0; var under = G.PL.some(function (pl) { return e.x >= pl.x0 && e.x <= pl.x1 && e.y > pl.y + 8 && e.y < pl.y + 40; }); e._u = under ? e._u + 1 : 0; if (e._u > 300) res.stuckUnder = [Math.round(e.x), Math.round(e.y)]; }
    });
  }
  if (!res.won && !res.lost && process.env.DBG) console.log("TIMEOUT", JSON.stringify(G.p), JSON.stringify(G.foes));
  res.frames = f; res.lives = G.lives; res.score = G.score; res.left = G.foes.length + (6 - G.spawned);
  return res;
}
if (process.argv[2] === "trace") { console.log(JSON.stringify(run({ react: 0.5, slack: 0, tap: 6 }))); return; }
[{ name: "sharp", react: 0.9, slack: 4, tap: 4 }, { name: "average", react: 0.35, slack: 0, tap: 6 }, { name: "sloppy", react: 0.2, slack: -6, tap: 8 }].forEach(function (c) {
  var wins = 0, lives = 0, causes = {}, flags = {}, frames = 0, N = 60;
  for (var i = 0; i < N; i++) { var r = run(c); if (r.won) { wins++; lives += r.lives; frames += r.frames; }
    for (var q in r.causes) causes[q] = (causes[q] || 0) + r.causes[q];
    ["err", "offscreen", "chuteStuck", "stuckUnder"].forEach(function (q) { if (r[q]) flags[q] = r[q]; }); if (!r.won && !r.lost) flags.timeout = (flags.timeout || 0) + 1; }
  console.log(c.name, "wins", wins + "/" + N, "avgLivesLeft", (lives / Math.max(1, wins)).toFixed(2), "avgSec", (frames / Math.max(1, wins) / 60).toFixed(0), JSON.stringify(causes), JSON.stringify(flags));
});
