// Headless sim for gemColumns: node work/gemsim.js [runs] [skill 0..1]
var fs = require("fs");
var src = fs.readFileSync(process.env.HTML, "utf8");
var a = src.indexOf("var gemColumns = {"), b = src.indexOf("var GAMES =");
var block = src.slice(a, b);
var noop = function () {};
var ctxStub = new Proxy({}, { get: function (t, k) { return k in t ? t[k] : (k === "createLinearGradient" || k === "createRadialGradient") ? function () { return { addColorStop: noop }; } : noop; }, set: function (t, k, v) { t[k] = v; return true; } });
var W = 320, H = 240;
var noise = noop, kick = noop, beep = noop, SFX = { hit: noop, win: noop, pick: noop, smash: noop, jump: noop };
var text = noop, ctx = ctxStub;
global.setTimeout = function (f) { f(); };
var gemColumns = eval(block + "; gemColumns");

var RUNS = +process.argv[2] || 200, SKILL = process.argv[3] !== undefined ? +process.argv[3] : 0.7;
var DROP = process.argv[4] !== undefined ? +process.argv[4] : 0.5, pieces = 0;

function clone(g) { return g.map(function (r) { return r.slice(); }); }
// score a placement on a copy of the grid: cleared gems minus height penalty
function evalPlace(G, col, gems, ROWS, COLS) {
  G = clone(G);
  var r = -3; while (r + 3 < ROWS && G[r + 3][col] === -1) r++;
  if (r < 0) return -1e9;
  for (var k = 0; k < 3; k++) G[r + k][col] = gems[k];
  var total = 0, chain = 0;
  while (true) {
    var n = 0, M = G.map(function (row) { return row.map(function () { return false; }); });
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var rr = 0; rr < ROWS; rr++) for (var c = 0; c < COLS; c++) { var v = G[rr][c]; if (v < 0) continue;
      for (var d = 0; d < 4; d++) { var dr = dirs[d][0], dc = dirs[d][1], len = 1;
        while (rr + dr * len < ROWS && c + dc * len >= 0 && c + dc * len < COLS && G[rr + dr * len][c + dc * len] === v) len++;
        if (len >= 3) for (var q = 0; q < len; q++) M[rr + dr * q][c + dc * q] = true; } }
    for (rr = 0; rr < ROWS; rr++) for (c = 0; c < COLS; c++) if (M[rr][c]) { n++; G[rr][c] = -1; }
    if (!n) break; total += n; chain++;
    for (c = 0; c < COLS; c++) { var w = ROWS - 1; for (rr = ROWS - 1; rr >= 0; rr--) if (G[rr][c] >= 0) { var vv = G[rr][c]; G[rr][c] = -1; G[w--][c] = vv; } }
  }
  var hs = 0, mx = 0, adj = 0;
  for (c = 0; c < COLS; c++) { var h = 0; for (rr = 0; rr < ROWS; rr++) if (G[rr][c] >= 0) { h = ROWS - rr; break; } hs += h; mx = Math.max(mx, h); }
  // pairs of same colour adjacent = future potential
  for (rr = 0; rr < ROWS; rr++) for (c = 0; c < COLS; c++) { var v2 = G[rr][c]; if (v2 < 0) continue;
    if (c + 1 < COLS && G[rr][c + 1] === v2) adj++; if (rr + 1 < ROWS && G[rr + 1][c] === v2) adj++; if (rr + 1 < ROWS && c + 1 < COLS && G[rr + 1][c + 1] === v2) adj++; }
  return total * 10 - hs * 0.6 - Math.max(0, mx - 8) * 8 + adj * 1.5;
}

function run() {
  var g = Object.create(gemColumns); g.init({ win: function () { g._res = "win"; }, lose: function () { g._res = "lose"; } });
  var f = 0, plan = null, lastP = null, errors = [], react = 0, maxFloat = 0, chainMax = 0, winFrame = 0;
  while (!g._res && f < 60 * 60 * 15) {
    f++;
    var inp = { k: {}, p: {} };
    if (g.p && g.p !== lastP) {
      lastP = g.p; react = 25 + (Math.random() * 35 | 0); pieces++;
      // pick placement
      var best = null, bs = -1e18, opts = [];
      for (var rot = 0; rot < 3; rot++) { var gems = g.p.g.slice(); for (var q = 0; q < rot; q++) gems.unshift(gems.pop());
        for (var c = 0; c < g.COLS; c++) { var s = evalPlace(g.grid, c, gems, g.ROWS, g.COLS); opts.push({ c: c, rot: rot, s: s }); if (s > bs) { bs = s; best = opts[opts.length - 1]; } } }
      if (Math.random() > SKILL) { var ok = opts.filter(function (o) { return o.s > -1e8; }); best = ok[Math.random() * ok.length | 0] || best; }
      plan = { c: best.c, rot: best.rot, t: 0, drop: Math.random() < DROP };
    }
    if (g.p && plan) {
      plan.t++;
      if (plan.t > react && plan.t % 6 === 0) {
        if (plan.rot > 0) { inp.p.up = true; plan.rot--; }
        else if (g.p.c < plan.c) inp.p.right = true;
        else if (g.p.c > plan.c) inp.p.left = true;
      }
      if (plan.rot === 0 && g.p.c === plan.c && plan.t > react + 20 && plan.drop) inp.k.down = true;
    }
    try { g.update(inp); g.draw(ctxStub); } catch (e) { errors.push(e.stack); break; }
    if (g.won === 2) winFrame = f;
    chainMax = Math.max(chainMax, g.chain || 0);
    // floating check when idle
    if (!(g.flash > 0) && !g.marks) for (var cc = 0; cc < g.COLS; cc++) { var seen = false; for (var r = 0; r < g.ROWS; r++) { if (g.grid[r][cc] >= 0) seen = true; else if (seen) { maxFloat++; } } }
  }
  return { res: g._res || "timeout", f: winFrame || f, cleared: g.cleared, errors: errors, float: maxFloat, chainMax: chainMax };
}

var wins = 0, times = [], errs = 0, fl = 0, cm = 0, lostAt = [];
for (var i = 0; i < RUNS; i++) { var r = run(); if (r.errors.length) { errs++; if (errs === 1) console.log(r.errors[0]); }
  if (r.res === "win") { wins++; times.push(r.f / 60); } else lostAt.push(r.cleared); fl += r.float; cm = Math.max(cm, r.chainMax); }
times.sort(function (x, y) { return x - y; });
console.log("skill", SKILL, "runs", RUNS, "win%", (100 * wins / RUNS).toFixed(0), "median s", (times[times.length >> 1] || 0).toFixed(0),
  "p10", (times[times.length / 10 | 0] || 0).toFixed(0), "p90", (times[times.length * 0.9 | 0] || 0).toFixed(0),
  "pieces/run", (pieces / RUNS).toFixed(0), "errors", errs, "floatFrames", fl, "maxChain", cm, "lostAt avg", lostAt.length ? (lostAt.reduce(function (a, b) { return a + b; }, 0) / lostAt.length).toFixed(0) : "-");
