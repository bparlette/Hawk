// Headless sim for Level 2 PIPE PESTS. node work/sim2.js [runs] [frames] [skill]
const fs = require("fs");
const html = fs.readFileSync(process.env.HTML, "utf8");
const start = html.indexOf("(function () {", html.lastIndexOf("<script>"));
const end = html.lastIndexOf("</script>");
let src = html.slice(start, end);
src = src.replace(/var GAMES = \[[^\]]*\];/, function (m) { return m + " globalThis.__PP = pipePests;"; });
const noop = () => {};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === "createLinearGradient" ? () => ({ addColorStop: noop }) : noop), set: (t, k, v) => ((t[k] = v), true) });
const el = { getContext: () => ctx, addEventListener: noop, style: {}, dataset: {}, classList: { add: noop, remove: noop } };
global.document = { getElementById: () => el, querySelectorAll: () => [] };
global.window = { addEventListener: noop, innerWidth: 1280, innerHeight: 900, requestAnimationFrame: noop };
global.getComputedStyle = () => ({ display: "none" });
global.setTimeout = noop;
new Function(src)();
const PP = globalThis.__PP;

const RUNS = +process.argv[2] || 20, FRAMES = +process.argv[3] || 3000, SKILL = +(process.argv[4] || 1);
let rng = 1;
function rand() { rng = (rng * 16807) % 2147483647; return rng / 2147483647; }
Math.random = rand;

function wd(a, b) { let d = a - b; if (d > 160) d -= 320; if (d < -160) d += 320; return d; }
function segOf(G, x, y) { return G.S.findIndex((s) => s.y === y && x >= s.x0 - 3 && x <= s.x1 + 3); }

// scripted player: walks under pests on the level above and jumps; kicks flipped pests; dodges.
function ai(G, k, p, mem) {
  const P = G.p; k.left = k.right = false;
  if (P.dead || !P.on) { if (mem.hold) k[mem.hold] = true; return; }
  mem.hold = null;
  // human model: each pest, when it first gets close, is misread with chance 1-SKILL (no dodge for 50 frames)
  mem.t = (mem.t || 0) + 1; mem.miss = mem.miss || new Map(); mem.err = mem.err || new Map();
  for (const e of G.pests) {
    const near = Math.abs(wd(e.x, P.x)) < 30 && e.y === P.y;
    if (near && !mem.miss.has(e)) mem.miss.set(e, rand() > SKILL ? mem.t + 50 : 0);
    if (!near && mem.miss.has(e) && mem.miss.get(e) < mem.t) mem.miss.delete(e);
    if (!mem.err.has(e) || mem.t % 120 === 0) mem.err.set(e, (rand() - 0.5) * 2 * (1 - SKILL) * 30);
  }
  const blind = (e) => (mem.miss.get(e) || 0) > mem.t;
  const sloppy = false;
  const go = (dx) => { if (Math.abs(dx) < 1.5) return; const d = dx > 0 ? "right" : "left"; k[d] = true; mem.hold = d; };
  const lvl = P.y, pests = G.pests;
  // 1. danger: walking pest closing in on my level
  for (const e of pests) {
    if (e.flip || !e.on || e.y !== lvl || blind(e)) continue;
    const d = wd(e.x, P.x);
    const closing = Math.sign(-d) === e.dir;
    if (closing && Math.abs(d) < 24 && !sloppy) {
      if (lvl === 224 && G.pow.uses > 0 && Math.abs(P.x - 160) < 8) { p.a = true; return; }
      if (Math.abs(d) < 20) { p.a = true; go(d * 10); return; } // hop over it
    }
    if (!closing && Math.abs(d) < 16) { go(-d * 10); return; } // don't walk into its back
  }
  // 2. kick a flipped pest on my level
  const fl = pests.filter((e) => e.flip > 0 && e.y === lvl).sort((a, b) => Math.abs(wd(a.x, P.x)) - Math.abs(wd(b.x, P.x)))[0];
  if (fl) { go(lvl === 224 || lvl === 176 ? wd(fl.x, P.x) : fl.x - P.x); return; }
  if (lvl === 224) {
    // flipped pest up on 176: climb through the middle gap toward it
    const up = pests.find((e) => e.flip > 40 && e.y === 176);
    if (up) {
      const toLeft = up.x < 160, gx = toLeft ? 142 : 178;
      if (Math.abs(P.x - gx) > 3) { go(wd(gx, P.x)); return; }
      p.a = true; mem.hold = toLeft ? "left" : "right"; k[mem.hold] = true; return;
    }
    // bump a pest walking on 176 from below
    const tgt = pests.filter((e) => !e.flip && e.on && e.y === 176).sort((a, b) => Math.abs(wd(a.x, P.x)) - Math.abs(wd(b.x, P.x)))[0];
    if (tgt) {
      const aim = tgt.x + tgt.dir * tgt.spd * 18 + mem.err.get(tgt);
      const d = wd(aim, P.x);
      if (Math.abs(d) < 6 && segOf(G, P.x, 176) >= 0 && !sloppy) { p.a = true; return; }
      go(d); return;
    }
    // many on floor: POW
    if (G.pow.uses > 0 && pests.filter((e) => e.y === 224 && !e.flip && e.on).length >= 2) {
      if (Math.abs(P.x - 160) > 2) go(160 - P.x); else p.a = true; return;
    }
    go(wd(60, P.x)); return;
  }
  // on a platform with nothing to kick: drop back down through the nearest inner edge
  const s = G.S[segOf(G, P.x, lvl)] || { x0: 0, x1: 320 };
  go(s.x0 === 0 ? s.x1 + 10 - P.x : s.x0 - 10 - P.x);
}

let wins = 0, totalFr = 0, errs = 0, deaths = 0, stuck = 0, flips = 0, kills = 0, livesLeft = 0;
const res = [];
for (let r = 0; r < RUNS; r++) {
  rng = 1 + r * 7919;
  let done = null, f = 0;
  const api = { win: () => (done = "win"), lose: () => (done = "lose") };
  const input = { k: {}, p: {} }, mem = {};
  PP.init(api);
  if (!PP.__w) { const origFlip = PP.flip; PP.flip = function (e) { flips++; origFlip.call(this, e); }; PP.__w = 1; }
  let prevDead = 0, last = new Map();
  try {
    for (f = 0; f < FRAMES && !done; f++) {
      for (const k in input.p) delete input.p[k];
      ai(PP, input.k, input.p, mem);
      PP.update(input); PP.draw(ctx);
      const P = PP.p;
      if (P.dead && !prevDead) {
        deaths++;
        const nearFlipped = PP.pests.some((e) => e.flip > 0 && Math.abs(wd(e.x, P.x)) < 12 && Math.abs(e.y - P.y) < 14);
        if (nearFlipped) { kills++; console.log("near-flipped death", P.x.toFixed(0), P.y, JSON.stringify(PP.pests.map((e) => [e.x.toFixed(0), e.y, e.flip, e.mad, e.hop]))); }
        if (r === 0) { const e = PP.pests.slice().sort((a, b) => Math.abs(wd(a.x, P.x)) - Math.abs(wd(b.x, P.x)))[0]; console.log("death f" + f, "hero", P.x.toFixed(0), P.y, "pest", e && [e.x.toFixed(0), e.y, e.flip, e.on, e.dir]); }
      }
      prevDead = P.dead;
      for (const e of PP.pests) {
        if (!isFinite(e.x) || !isFinite(e.y) || e.y > 260) throw new Error("pest out of bounds " + JSON.stringify(e));
        const key = e; const l = last.get(key);
        if (P.dead || PP.won) continue;
        if (!e.flip && l && l.x === e.x && l.y === e.y) { l.n++; if (l.n === 30) stuck++; } else last.set(key, { x: e.x, y: e.y, n: 0 });
      }
    }
  } catch (err) { errs++; console.log("run", r, "frame", f, err.stack.split("\n").slice(0, 3).join(" | ")); }
  if (done === "win") { wins++; livesLeft += PP.lives; }
  totalFr += f;
  res.push((done || "timeout") + "@" + f + " k" + PP.kicked + " L" + PP.lives);
}
console.log(res.join("  "));
console.log({ RUNS, SKILL, wins, avgFrames: Math.round(totalFr / RUNS), errs, deaths, flippedKills: kills, stuckEvents: stuck, flips, avgLivesOnWin: wins ? (livesLeft / wins).toFixed(2) : 0 });
