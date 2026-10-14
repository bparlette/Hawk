// Headless sim of Level 6 (turboCoast). Usage: node work/sim6.js
var fs = require("fs");
var src = fs.readFileSync(process.env.HTML, "utf8");
var a = src.indexOf("var turboCoast = {"), b = src.indexOf("var GAMES =");
var code = src.slice(a, b);
if (process.env.T0) code = code.replace(/S\.time = \d+;/, "S.time = " + process.env.T0 + ";").replace(/S\.time \+= \d+;/, "S.time += " + process.env.BON + ";");
if (process.env.NSEG) code = code.replace("var N = 1500,", "var N = " + process.env.NSEG + ",");
if (process.env.PULL) code = code.replace("seg.curve * 0.3;", "seg.curve * " + process.env.PULL + ";");
if (process.env.SPIN) code = code.replace("S.spin = 1;", "S.spin = " + process.env.SPIN + ";");
if (process.env.CARS) code = code.replace("q < 12;", "q < " + process.env.CARS + ";").replace("q * 95", "q * " + Math.round((+(process.env.NSEG||1500) - 360) / process.env.CARS));
var noop = function () {};
var log = null, bad = null;
function mk() {
  return new Proxy({}, {
    get: function (t, k) {
      if (k in t) return t[k];
      if (k === "createLinearGradient") return function () { return { addColorStop: noop }; };
      return function () {
        for (var i = 0; i < arguments.length; i++) if (typeof arguments[i] === "number" && !isFinite(arguments[i])) bad = k + " " + Array.prototype.join.call(arguments, ",");
        if (log && (k === "fillRect" || k === "translate")) log.push([k, t.fillStyle].concat(Array.prototype.slice.call(arguments)));
      };
    },
    set: function (t, k, v) { t[k] = v; return true; }
  });
}
var ctxStub = mk();
global.setTimeout = noop;
function text() {} var SFX = new Proxy({}, { get: function () { return noop; } }); var noise = noop, kick = noop, beep = noop;
var turboCoast = eval(code + "; turboCoast");

var BOTS = {
  good: { look: 14, react: 1, err: 0, dead: 0.05, lift: 0.75, liftErr: 0.12 },
  average: { look: 9, react: 0.7, err: 0.002, errLen: 20, dead: 0.12, lift: 0.95 },
  sloppy: { look: 6, react: 0.5, err: +(process.env.SE || 0.002), errLen: +(process.env.SL || 30), dead: 0.2, lift: 1.1 }
};
function run(o) {
  var res = { won: false, lost: false, crash: 0, spin: 0, cp: false, t: 0 };
  var api = { win: function () { res.won = true; }, lose: function () { res.lost = true; } };
  var G = turboCoast; G.init(api);
  var errT = 0, errDir = 0, k = {}, zero = 0, lastSpin = 0;
  for (var f = 0; f < 60 * 200 && !res.won && !res.lost; f++) {
    var pz = G.pos + G.PZ, tgt = 0;
    var threats = G.cars.filter(function (c) { var dz = c.z - pz; return dz > -G.SEG * 0.3 && dz < G.SEG * o.look && G.speed > c.spd * 0.9; });
    var lanes = [-0.6, 0, 0.6].filter(function (l) { return threats.every(function (c) { return Math.abs(c.off - l) > 0.34; }); });
    if (lanes.length) { lanes.sort(function (x, y) { return Math.abs(x - G.px) - Math.abs(y - G.px); }); tgt = lanes.indexOf(0) >= 0 && Math.abs(G.px) < 0.3 ? 0 : lanes[0]; }
    if (Math.random() < o.react) {
      k = { a: true };
      var seg = G.segs[Math.floor(G.pos / G.SEG) % G.N], sp = G.speed / G.MAX;
      var drift = -sp * seg.curve * 0.3 * sp; // pull relative to steer rate
      var e = tgt - (G.px + drift * 0.3);
      if (e > o.dead) k.right = true; else if (e < -o.dead) k.left = true;
      if (Math.abs(G.px) > o.lift || (o.liftErr && Math.abs(e) > o.liftErr && e * drift < 0)) k.a = false;
      if (!lanes.length && threats.some(function (c) { return c.z - pz < G.SEG * 2; })) { k.a = false; k.b = true; }
    }
    if (errT > 0) { errT--; k.left = errDir < 0; k.right = errDir > 0; }
    else if (Math.random() < o.err) { errT = o.errLen; errDir = Math.random() < 0.5 ? -1 : 1; }
    var spd0 = G.speed, pos0 = G.pos;
    try { G.update({ k: k, p: {} }); if (f % 3 === 0) G.draw(ctxStub); } catch (err) { res.err = err.stack.split("\n").slice(0, 3).join(" | "); break; }
    if (bad) { res.nan = bad; bad = null; }
    if (isNaN(G.pos + G.px + G.speed)) res.nan = "state";
    if (G.pos < pos0 - 1) res.crash++;
    if (G.spin > 0 && !lastSpin) res.spin++;
    lastSpin = G.spin > 0;
    zero = G.speed === 0 && k.a && !(G.spin > 0) ? zero + 1 : 0;
    if (zero > 30) res.stuck = true;
    // clipping: player overlapping a car without a crash
    G.cars.forEach(function (c) { var dz = c.z - (G.pos + G.PZ); if (Math.abs(dz) < G.SEG * 0.2 && Math.abs(c.off - G.px) < 0.2) res.clip = (res.clip || 0) + 1; });
  }
  res.cp = G.cp; res.t = +(G.t).toFixed(1); res.left = +G.time.toFixed(1);
  return res;
}
var N = +process.argv[2] || 60;
Object.keys(BOTS).forEach(function (name) {
  var w = 0, crash = 0, spin = 0, issues = {}, ts = [], lefts = [];
  for (var i = 0; i < N; i++) {
    var r = run(BOTS[name]);
    if (r.won) { w++; ts.push(r.t); lefts.push(r.left); }
    crash += r.crash; spin += r.spin;
    ["err", "nan", "stuck", "clip"].forEach(function (q) { if (r[q]) issues[q] = r[q]; });
    if (r.won && !r.cp) issues.noCP = true;
  }
  var avg = function (x) { return x.length ? (x.reduce(function (p, q) { return p + q; }, 0) / x.length).toFixed(1) : "-"; };
  ts.sort(function (p, q) { return p - q; });
  console.log(name, "t p0/20/50/80/100", [0, 0.2, 0.5, 0.8, 1].map(function (p) { return ts[Math.min(ts.length - 1, Math.floor(p * ts.length))]; }).join("/"));
  console.log(name, "win", w + "/" + N, "crash/run", (crash / N).toFixed(1), "spin/run", (spin / N).toFixed(1), "t", avg(ts), "left", avg(lefts), JSON.stringify(issues));
});
