// node smoke.js <game.html> [frames]  -- runs the whole page script with stubbed DOM, real rAF loop, random input
const fs = require("fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const start = html.indexOf("(function () {", html.lastIndexOf("<script>")), end = html.lastIndexOf("</script>");
const src = html.slice(start, end);
const N = +process.argv[3] || 600;
const noop = () => {};
let calls = 0, errs = 0;
const grad = () => ({ addColorStop: noop });
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === "createLinearGradient" || k === "createRadialGradient") ? grad : k === "measureText" ? () => ({ width: 10 }) : (...a) => { calls++; if (k === "drawImage" && !a[0]) throw new Error("drawImage of null"); }), set: (t, k, v) => ((t[k] = v), true) });
const mkEl = () => ({ getContext: () => ctx, addEventListener: noop, style: {}, dataset: {}, classList: { add: noop, remove: noop }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 240 }), offsetHeight: 100, offsetWidth: 50, width: 0, height: 0 });
const el = mkEl();
const winL = {};
global.document = { getElementById: () => el, querySelectorAll: () => [], createElement: () => mkEl() };
let rafCb = null;
global.window = { addEventListener: (n, f) => { (winL[n] = winL[n] || []).push(f); }, innerWidth: 1280, innerHeight: 900, requestAnimationFrame: (f) => { rafCb = f; }, location: { search: "", hash: "" }, history: { replaceState: noop }, localStorage: { getItem: () => null, setItem: noop } };
global.getComputedStyle = () => ({ display: "none" });
global.setTimeout = noop; global.URLSearchParams = URLSearchParams;
global.requestAnimationFrame = (f) => window.requestAnimationFrame(f);
let rng = 5; Math.random = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
new Function("window", "document", "requestAnimationFrame", src)(window, document, (f) => window.requestAnimationFrame(f));
const key = (type, code) => (winL[type] || []).forEach((f) => f({ code, preventDefault: noop }));
const dirs = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
let ts = 0, frames = 0;
for (let i = 0; i < N; i++) {
  if (i % 45 === 0) { key("keydown", "KeyZ"); } else if (i % 45 === 3) key("keyup", "KeyZ");
  if (i % 30 === 0) { dirs.forEach((d) => key("keyup", d)); key("keydown", dirs[Math.floor(Math.random() * 4)]); }
  ts += 1000 / 60;
  const cb = rafCb; rafCb = null;
  try { cb(ts); frames++; } catch (e) { errs++; if (errs < 4) console.log("ERR frame", i, e.stack.split("\n").slice(0, 3).join(" | ")); }
}
console.log(JSON.stringify({ frames, errs, drawCalls: calls }));
process.exit(errs ? 1 : 0);
