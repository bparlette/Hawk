import json,sys
p=sys.argv[1]; s=open(p).read()
m=json.load(open('meta.json'))
old_cfg='''  const MIDBOSS_CFG = { name: "SCORCHER", base: "ramrod", atlas: "ramrod", tint: { sepia: 0.7, sat: 3, hue: -25, bri: 1.05 }, scale: 0.92, hp: 18, speed: 1.1,'''
assert s.count(old_cfg)==1
fr=", ".join(f'{k}: [{",".join(map(str,v))}]' for k,v in m.items())
new='''  // Painted sheet atlas_scorcher.png (faces right); frames [x, y, w, h, hipX]. Drawn feet-centre on the hip like the level sprites.
  const SCORCHER_IM = document.createElement("img"); SCORCHER_IM.src = "atlas_scorcher.png";
  const SCORCHER_FR = { %s };
  const SCORCHER_K = 58 * 1.6 * 0.92 / 190 * 0.92; // same on-screen size as the old tinted ramrod sheet (idle 190px -> ~78px)
  function scorcherFrame(e) {
    const s = e.state, t = e.t;
    if (s === "dying" || s === "down") return "down";
    if (s === "getup") return t < 8 ? "getup1" : "getup2";
    if (s === "stagger") return "daze";
    if (s === "hurt") return "hurt";
    if (s === "tele" || s === "charge" || s === "kwind" || s === "kick") return s;
    if (s === "throw") { // scoop rubble, cock the arm, let fly at t = 14 + 12i (bossExtra's release frames)
      const n = MIDBOSS_CFG.throwN || 1, r = t - 14;
      if (t < 6) return "throw1";
      if (r < 0) return "throw2";
      const i = Math.floor(r / 12), ph = r %% 12;
      return i < n - 1 && ph >= 6 ? "throw2" : "release";
    }
    if ((s === "walk" || s === "enter") && e.walkT > 0) return ["walk1", "idle", "walk2", "idle"][Math.floor(e.walkT / 10) %% 4];
    return "idle";
  }
  function drawScorcher(api, e, sx, sy) {
    const fxOk = !flashAll && ctx !== silCtx;
    if (!imgOk(SCORCHER_IM)) { rect(sx - 12, sy - 78, 24, 78, "#1c1a22"); return; }
    const fr = SCORCHER_FR[scorcherFrame(e)], k = SCORCHER_K;
    const red = fxOk && ((e.state === "tele" && e.t %% 6 < 3) || (e.state === "throw" && e.t < 14 && e.t %% 6 < 3) || (e.hp < e.maxHp * 0.3 && e.state !== "dying" && e.life %% 12 < 3));
    const jx = e.state === "stagger" ? (e.t %% 4 < 2 ? 1 : -1) : e.state === "kwind" ? -e.facing : 0;
    frameTint = red ? "sepia(1) saturate(6) hue-rotate(-40deg) brightness(0.9)" : null;
    drawFrame(SCORCHER_IM, fr, sx + jx + (fr[2] / 2 - fr[4]) * k * e.facing, sy, k, e.facing);
    frameTint = null;
  }
  const MIDBOSS_CFG = { name: "SCORCHER", base: "ramrod", atlas: "ramrod", draw: drawScorcher, scale: 0.92, hp: 18, speed: 1.1,''' % fr
s=s.replace(old_cfg,new)
open(p,'w').write(s)
print('ok')
