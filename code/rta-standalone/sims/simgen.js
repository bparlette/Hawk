// generic: node simgen.js <html> <varname> <runs> <frames> <botmodule>
const fs = require("fs");
const html = fs.readFileSync(process.argv[2], "utf8"), V = process.argv[3];
const start = html.indexOf("(function () {", html.lastIndexOf("<script>")), end = html.lastIndexOf("</script>");
let src = html.slice(start, end).replace(/var GAMES = \[[^\]]*\];/, (m) => m + " globalThis.__G = " + V + ";");
const noop = () => {};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === "createLinearGradient" || k === "createRadialGradient") ? () => ({ addColorStop: noop }) : noop), set: (t, k, v) => ((t[k] = v), true) });
const el = { getContext: () => ctx, addEventListener: noop, style: {}, dataset: {}, classList: { add: noop, remove: noop } };
global.document = { getElementById: () => el, querySelectorAll: () => [] };
global.window = { addEventListener: noop, innerWidth: 1280, innerHeight: 900, requestAnimationFrame: noop };
global.getComputedStyle = () => ({ display: "none" });
global.setTimeout = noop;
new Function(src)();
const G = globalThis.__G, bot = require(require("path").resolve(process.argv[6]));
const RUNS = +process.argv[4] || 10, FRAMES = +process.argv[5] || 6000;
let rng = 11; Math.random = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
const res = [];
for (let r = 0; r < RUNS; r++) {
  let won = false, lost = 0, f = 0, drawErr = 0;
  const api = { win: () => { won = true; }, lose: () => { lost++; G.init(api); } };
  G.init(api); const mem = {};
  for (f = 0; f < FRAMES && !won; f++) {
    const k = {}, p = {}; bot(G, k, p, mem, r);
    G.update({ k, p });
    if (f % 30 === 0) { try { G.draw(ctx); } catch (e) { drawErr++; if (drawErr === 1) console.log("DRAW ERR", e.message); } }
  }
  res.push({ won, lost, f, drawErr });
}
console.log(JSON.stringify({ wins: res.filter((x) => x.won).length, runs: RUNS, avgLosses: res.reduce((a, x) => a + x.lost, 0) / RUNS, avgFrames: Math.round(res.reduce((a, x) => a + x.f, 0) / RUNS), drawErrs: res.reduce((a, x) => a + x.drawErr, 0) }));
