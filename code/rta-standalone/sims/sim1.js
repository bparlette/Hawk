// node sim1.js <game.html> [runs] [frames]
const fs = require("fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const start = html.indexOf("(function () {", html.lastIndexOf("<script>"));
const end = html.lastIndexOf("</script>");
let src = html.slice(start, end);
src = src.replace(/var GAMES = \[[^\]]*\];/, function (m) { return m + " globalThis.__G = GAMES[0];"; });
const noop = () => {};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === "createLinearGradient" ? () => ({ addColorStop: noop }) : noop), set: (t, k, v) => ((t[k] = v), true) });
const el = { getContext: () => ctx, addEventListener: noop, style: {}, dataset: {}, classList: { add: noop, remove: noop } };
global.document = { getElementById: () => el, querySelectorAll: () => [] };
global.window = { addEventListener: noop, innerWidth: 1280, innerHeight: 900, requestAnimationFrame: noop };
global.getComputedStyle = () => ({ display: "none" });
global.setTimeout = noop;
new Function(src)();
const Gm = globalThis.__G;
const RUNS = +process.argv[3] || 10, FRAMES = +process.argv[4] || 9000;
let rng = 7; Math.random = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
let wins = 0, deaths = 0, tot = 0, wf = [];
for (let r = 0; r < RUNS; r++) {
  let won = false; let f = 0;
  Gm.init({ win: () => { won = true; }, lose: () => { Gm.init(this.api); } });
  let prevDead = 0;
  for (f = 0; f < FRAMES && !won; f++) {
    const k = {}, p = {}, P = Gm.p;
    if (!P.dead) {
      const L = Gm.L.filter((l) => l.g === P.g && !l.broken).sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x))[0];
      if (P.climb !== null) k.up = true;
      else if (L) {
        // barrel dodge: approaching barrel on my girder
        let jump = false;
        for (const B of Gm.barrels) {
          if (B.gi === P.g && !B.falling && B.onLadder === null && Math.abs(B.x - P.x) < 20 && Math.abs(B.x - P.x) > 8 && Math.sign(P.x - B.x) === Math.sign(B.vx) && !P.jumping) jump = true;
        }
        const dx = L.x - P.x;
        if (Math.abs(dx) > 1) { if (dx > 0) k.right = true; else k.left = true; } else k.up = true;
        if (jump) p.a = true;
        if (P.jumping && Math.abs(dx) <= 1) k.up = false;
      }
    }
    if (P.dead && !prevDead) deaths++;
    prevDead = P.dead;
    Gm.update({ k, p });
  }
  if (won) { wins++; wf.push(f); }
}
console.log("runs", RUNS, "wins", wins, "deaths", deaths, "avg win frames", wf.length ? Math.round(wf.reduce((a, b) => a + b) / wf.length) : "-");
