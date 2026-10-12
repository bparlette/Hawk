#!/usr/bin/env python3
"""Fork the Shell Shock Live engine (read-only source) into SF WORLD BRAWL: game/index.html.
Re-runnable: always starts from the pristine deploy copy."""
import re, json, sys

SRC = "/workspace/work/sf_brawler/engine_base.html"  # frozen copy of the Shell Shock Live engine (deploy copy changes under other agents)
OUT = "/workspace/work/sf_brawler/game/index.html"
s = open(SRC).read()


def R(old, new, count=1):
    global s
    n = s.count(old)
    if count is not None and n != count:
        sys.exit(f"patch: expected {count} of {old[:80]!r}, found {n}")
    s = s.replace(old, new)


def RX(pat, new, count=None):
    global s
    s2, n = re.subn(pat, new, s)
    if count is not None and n != count:
        sys.exit(f"patch: regex expected {count} of {pat!r}, found {n}")
    s = s2

# ---------------------------------------------------------------- head / branding
R('content="Shell Shock Live"', 'content="SF World Brawl"')
R("<title>SHELL SHOCK: LIVE ACTION</title>", "<title>STREET FIGHTER: WORLD BRAWL (fan game)</title>")

# ---------------------------------------------------------------- roster rename (keys + names)
R('    { name: "LENNY", mask: "#2f6bff", reach: 20, spd: 14, weapon: "katana" },\n'
  '    { name: "RAFE", mask: "#e8302a", reach: 14, spd: 10, weapon: "sai" },\n'
  '    { name: "MIKO", mask: "#ff8c1a", reach: 20, spd: 14, weapon: "nunchaku" },\n'
  '    { name: "DONNY", mask: "#9b3fe0", reach: 28, spd: 20, weapon: "bo" },',
  '    { name: "RYU", key: "ryu", mask: "#ff4a3a", reach: 28, spd: 20, weapon: "bo", special: "HADOUKEN" },\n'
  '    { name: "CAMMY", key: "cammy", mask: "#3fd05a", reach: 20, spd: 14, weapon: "katana", special: "CANNON SPIKE" },\n'
  '    { name: "FEI LONG", key: "feilong", mask: "#ffd040", reach: 14, spd: 10, weapon: "sai", special: "REKKAKEN" },\n'
  '    { name: "DEE JAY", key: "deejay", mask: "#3aa8ff", reach: 20, spd: 14, weapon: "nunchaku", special: "MACHINE GUN UPPER" },')
# select-screen stats follow the new order (SPEED, POWER, REACH)
R("const STATS = [[3, 3, 3], [4, 4, 2], [4, 2, 3], [2, 3, 5]];", "const STATS = [[3, 4, 4], [5, 3, 3], [4, 4, 2], [3, 3, 4]];")
# barks / voices keyed by display name
R('    LENNY: ["BY THE BOOK!", "FORM IS EVERYTHING!", "STAY SHARP!", "BLADE AND HONOR!"],\n'
  '    RAFE: ["TOO EASY!", "WHO\'S NEXT?!", "THAT ALL YA GOT?", "LIGHTS OUT!"],\n'
  '    MIKO: ["SHELL YEAH!", "TOTALLY TUBULAR!", "NUNCHUCKED, DUDE!", "PARTY\'S ON!"],\n'
  '    DONNY: ["SCIENCE!", "PHYSICS WINS!", "Q.E.D.!", "LEVERAGE, BABY!"],',
  '    RYU: ["THE ANSWER LIES IN THE HEART OF BATTLE!", "TRAIN HARDER!", "A TRUE WARRIOR NEVER QUITS!", "OSU!"],\n'
  '    CAMMY: ["MISSION COMPLETE!", "TOO SLOW!", "TARGET DOWN!", "KEEP UP!"],\n'
  '    "FEI LONG": ["HWAAA!", "STUDY THE MASTER!", "FASTER THAN FILM!", "WA-TAAH!"],\n'
  '    "DEE JAY": ["FEEL THE RHYTHM!", "MAXIMUM!", "JAMMIN\'!", "YEAH, MON!"],')
R('const VPITCH = { LENNY: [300, 1.0], RAFE: [210, 0.7], MIKO: [380, 1.5], DONNY: [330, 1.2] };',
  'const VPITCH = { RYU: [240, 0.85], CAMMY: [420, 1.45], "FEI LONG": [320, 1.2], "DEE JAY": [210, 0.8] };')
# any "x.name.toLowerCase()" on a brother -> x.key
RX(r"\b((?:p|b|bd|STATE\.player)(?:\.bro)?)\.name\.toLowerCase\(\)", r"\1.key")
# identifier keys: lenny->cammy, rafe->feilong, miko->deejay, donny->ryu
for a, b in [("lenny", "cammy"), ("rafe", "feilong"), ("miko", "deejay"), ("donny", "ryu")]:
    RX(r"\b%s\b" % a, b)
R('nm === "RAFE"', 'nm === "FEI LONG"')
R('nm === "DONNY" && p.z > 2', 'nm === "CAMMY_NOFLIP" && p.z > 2')
R('ctx.translate(0, -14); ctx.rotate(p.facing * 1.2); ctx.translate(0, 14);', 'ctx.translate(0, -14); ctx.rotate(p.facing * 0.35); ctx.translate(0, 14);')
R('if (p.atk === "power" && p.bro.name !== "DONNY") ctx.scale(Math.cos(pr * Math.PI * (p.bro.name === "LENNY" ? 8 : p.bro.name === "MIKO" ? 10 : 4)) >= 0 ? 1 : -1, 1);',
  'if (p.atk === "power" && p.bro.key === "cammy") ctx.scale(Math.cos(pr * Math.PI * 8) >= 0 ? 1 : -1, 1);')
R('return Math.floor(p.walkT / 9) % 2 ? (name === "cammy" ? "walk2" : "idle") : "walk";', 'return Math.floor(p.walkT / 9) % 2 ? "idle" : "walk";')

# ---------------------------------------------------------------- atlases (new art, same frame layout)
rects = json.load(open("/workspace/work/sf_brawler/art/atlas_rects.json"))
def arow(name, src):
    r = rects[src]
    return name + ": { " + ", ".join(f"{k}: {v}" for k, v in r.items()) + " },"
start = s.index("  const ATLAS = {\n")
end = s.index("    zap: {", start)
s = s[:start] + "  const ATLAS = {\n    " + "\n    ".join([
    arow("cammy", "cammy"), arow("feilong", "feilong"), arow("deejay", "deejay"), arow("ryu", "ryu"),
    arow("ninja", "ninja"), arow("gunner", "gunner"),
    "ramrod: { idle: [0, 0, 117, 190], walk: [119, 4, 127, 186], charge: [248, 24, 161, 166], kick: [411, 4, 153, 186], fire: [566, 7, 157, 183], hurt: [725, 13, 132, 177], down: [859, 126, 196, 64] },",
    arow("ken", "ken"), arow("evil", "evil"),
]) + "\n" + s[end:]
R('<img id="atlas-amber" src="atlas_amber.png" alt="" />',
  '<img id="atlas-amber" src="atlas_amber.png" alt="" />\n  <img id="atlas-ken" src="atlas_ken.png" alt="" />\n  <img id="atlas-evil" src="atlas_evil.png" alt="" />')
R("const NINJA_HUE = { blue: 180, purple: 235, star: 330 };", "const NINJA_HUE = {}; // SF: scouts keep their own colours")
R('hue: hue !== undefined ? hue : type === "dasher" ? 100 : type === "heavy" ? 150 : undefined,', 'hue: hue,')
R("const BOSS_ATLAS_K = { ramrod: 58 * 1.6 * 0.92 / 190,", "const BOSS_ATLAS_K = { ken: 50 * 1.6 * 0.92 / 190, evil: 54 * 1.6 * 0.92 / 190, ramrod: 58 * 1.6 * 0.92 / 190,")
R('    if (at === "ramrod") {\n      if (s === "throw" || s === "summon") return "fire";',
  '    if (at === "ramrod" || at === "ken" || at === "evil") {\n      if (s === "throw" || s === "summon") return "fire";')
R('&& at !== "ramrod";\n    if (!sheet)', '&& at !== "ramrod" && at !== "ken" && at !== "evil";\n    if (!sheet)')
# boss alpha (teleports / vanish) + fade when a fadeOnDeath boss dies
R("    frameTint = red ? \"sepia(1) saturate(6) hue-rotate(-40deg) brightness(0.9)\" : null;\n    if (lying)",
  "    frameTint = red ? \"sepia(1) saturate(6) hue-rotate(-40deg) brightness(0.9)\" : null;\n"
  "    const bAl = Math.max(0, Math.min(1, (e.alpha !== undefined ? e.alpha : 1) * (e.state === \"dying\" && cfg.fadeOnDeath ? Math.max(0, 1 - e.t / 50) : 1)));\n"
  "    if (bAl <= 0) { frameTint = null; return; }\n    const bA0 = ctx.globalAlpha; ctx.globalAlpha = bA0 * bAl;\n    if (lying)")
R("    else drawFrame(sheet, ATLAS[at][fr], sx + jx, sy, k, e.facing);\n    frameTint = null;",
  "    else drawFrame(sheet, ATLAS[at][fr], sx + jx, sy, k, e.facing);\n    ctx.globalAlpha = bA0;\n    frameTint = null;")

# ---------------------------------------------------------------- HUD portrait: head crop of the fighter's own atlas
R('    rect(11, 9, 12, 14, "#3fae3a"); rect(10, 11, 14, 10, "#3fae3a"); rect(9, 13, 16, 4, p.bro.mask); rect(24, 16, 2, 4, p.bro.mask);\n'
  '    rect(12, 14, 4, 2, "#fff"); rect(18, 14, 4, 2, "#fff"); rect(15, 14, 1, 2, "#000"); rect(21, 14, 1, 2, "#000"); rect(14, 20, 6, 1, "#24702a");',
  '    { const pim = atlasImg(p.bro.key); if (pim) { const f = ATLAS[p.bro.key].idle, kk = 19 / (f[3] * 0.27); ctx.save(); ctx.beginPath(); ctx.rect(8, 7, 18, 18); ctx.clip(); drawFrame(pim, f, 17, 7 + f[3] * kk - 1, kk, 1); ctx.restore(); } else rect(9, 9, 16, 14, p.bro.mask); }')

# ---------------------------------------------------------------- specials
R('''    cammy: { name: "CYCLONE SLASH", dur: 36, vz: 3.4, r: 36, ry: 15, dmg: 3, rehit: 12 },
    feilong: { name: "DRILL DIVE", dur: 30, vz: 1.5, move: 3.6, r: 24, ry: 11, dmg: 3, rehit: 10, front: true },
    deejay: { name: "NUNCHUCK COPTER", dur: 48, vz: 2.4, hover: true, r: 31, ry: 14, dmg: 2, rehit: 10 },
    ryu: { name: "BO VAULT SLAM", dur: 46, vz: 5, move: 1.4, r: 26, ry: 12, dmg: 2, land: { r: 58, ry: 20, dmg: 3 } },''',
  '''    cammy: { name: "CANNON SPIKE", dur: 34, vz: 3.6, move: 2.8, front: true, r: 30, ry: 13, dmg: 3, rehit: 12 },
    feilong: { name: "REKKAKEN", dur: 36, vz: 0.5, move: 3.0, r: 24, ry: 11, dmg: 2, rehit: 12, front: true },
    deejay: { name: "MACHINE GUN UPPER", dur: 44, vz: 1.4, hover: true, r: 28, ry: 13, dmg: 1, rehit: 6 },
    ryu: { name: "HADOUKEN", dur: 28, vz: 0, r: 14, ry: 8, dmg: 1, proj: { dmg: 4, speed: 4.4 } },''')
R("    STATE.specT = 70; STATE.specName = S.name + \"!\";\n  }",
  "    STATE.specT = 70; STATE.specName = S.name + \"!\";\n"
  "    if (S.proj) { (STATE.pshots = STATE.pshots || []).push({ x: p.x + p.facing * 16, y: p.y, z: 24, vx: p.facing * S.proj.speed, dmg: S.proj.dmg, t: -8, dir: p.facing, hit: new Set() }); }\n  }\n"
  "  // Player projectiles (Ryu's Hadouken): fly straight, one hit, cancel enemy fireballs\n"
  "  function updatePShots() {\n"
  "    if (!STATE.pshots || !STATE.pshots.length) return;\n"
  "    STATE.pshots = STATE.pshots.filter((s) => {\n"
  "      if (++s.t <= 0) return true; // wind-up: the ball forms in the hands\n"
  "      s.x += s.vx;\n"
  "      for (const e of STATE.enemies) if (canHitState(e) && !s.hit.has(e) && Math.abs(e.x - s.x) < 14 && Math.abs(e.y - s.y) < 10 && e.z < 40) {\n"
  "        s.hit.add(e); hitEnemy(e, s.dmg, true, s.dir, 4, true); fx(\"boom\", s.x, s.y - 20, 18); return false; }\n"
  "      if (targetHits(s.x, s.y, 0, 10, 10, s.dmg, s.dir, \"special\", s.hit)) { fx(\"boom\", s.x, s.y - 20, 18); return false; }\n"
  "      for (const pr of STATE.props || []) if (pr.state === \"idle\" && Math.abs(pr.x - s.x) < 12 && Math.abs(pr.y - s.y) < 10) { propHit(pr, 3, s.dir, true); fx(\"spark\", s.x, s.y - 16, 8); return false; }\n"
  "      for (const q of STATE.stars) if (!q.arc && !q.dead && Math.abs(q.x - s.x) < 12 && Math.abs(q.y - s.y) < 10) { q.dead = true; fx(\"boom\", s.x, s.y - 18, 16); SFX.boom(); return false; }\n"
  "      return s.x > STATE.camX - 30 && s.x < STATE.camX + W + 30;\n"
  "    });\n"
  "    STATE.stars = STATE.stars.filter((q) => !q.dead);\n"
  "  }\n"
  "  function drawHadou(sx, sy, r, t, c0, c1) { // energy ball: soft glow, bright core, trailing wisps\n"
  "    ctx.save(); ctx.globalCompositeOperation = \"lighter\";\n"
  "    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.2); g.addColorStop(0, c0); g.addColorStop(0.35, c1); g.addColorStop(1, \"rgba(0,0,0,0)\");\n"
  "    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r * 2.2, 0, 6.29); ctx.fill();\n"
  "    ctx.fillStyle = \"#fff\"; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.7, r * 0.55, 0, 0, 6.29); ctx.fill();\n"
  "    ctx.globalAlpha = 0.5; ctx.strokeStyle = c1; ctx.lineWidth = 1.5;\n"
  "    for (let i = 0; i < 3; i++) { const a = t * 0.5 + i * 2.1; ctx.beginPath(); ctx.ellipse(sx, sy, r * 1.3, r * 0.9, a, 0, 3.6); ctx.stroke(); }\n"
  "    ctx.restore(); ctx.globalAlpha = 1; ctx.lineWidth = 1;\n"
  "  }\n"
  "  function drawPShots(cx) {\n"
  "    for (const s of STATE.pshots || []) {\n"
  "      const p = STATE.player, sx = s.t <= 0 && p ? p.x - cx + p.facing * 14 : s.x - cx, sy = s.y - s.z;\n"
  "      const r = s.t <= 0 ? 3 + (8 + s.t) * 0.7 : 9;\n"
  "      if (s.t > 0) { shadow(sx, s.y, 18, 8); for (let i = 1; i < 4; i++) drawHadou(sx - s.dir * i * 7, sy, r * (1 - i * 0.22), STATE.t + i, \"rgba(180,230,255,0.25)\", \"rgba(40,120,255,0.18)\"); }\n"
  "      drawHadou(sx, sy, r, STATE.t, \"rgba(220,245,255,1)\", \"rgba(60,150,255,0.8)\");\n"
  "    }\n"
  "  }")
R("    updateProps(p); updateItems(p);\n", "    updateProps(p); updateItems(p); updatePShots();\n")
R("    vfxDraw(cx, false);\n    if (STATE.section === \"A\") drawHallFG(cx);", "    drawPShots(cx);\n    vfxDraw(cx, false);\n    if (STATE.section === \"A\") drawHallFG(cx);")
# custom energy-ball kinds for enemy shots (Ken / Evil Ryu)
R('    else if (k === "ray") { ctx.restore(); drawRay(sx, sy); return; }',
  '    else if (k === "ray") { ctx.restore(); drawRay(sx, sy); return; }\n'
  '    else if (k === "hadou") { ctx.restore(); drawHadou(sx, sy - 6, 6, STATE.t, "rgba(220,245,255,1)", "rgba(60,150,255,0.8)"); return; }\n'
  '    else if (k === "hadoudark") { ctx.restore(); drawHadou(sx, sy - 6, 6.5, STATE.t, "rgba(255,220,255,1)", "rgba(170,40,255,0.85)"); return; }')
# reset pshots with the world
R("function resetWorldBits() { STATE.props = []; STATE.items = [];", "function resetWorldBits() { STATE.pshots = []; STATE.props = []; STATE.items = [];")

# ---------------------------------------------------------------- level 1 is a plugin (levels/level1.js)
R('const LEVELS = [{ number: 1, name: "HALLWAY FIRE", builtin: true }];', 'const LEVELS = [];')
R("const curLV = () => ((STATE.level || 1) > 1 ? LEVELS[STATE.level - 1] || null : null);", "const curLV = () => LEVELS[(STATE.level || 1) - 1] || null;")
R('if (!n || n < 2) throw new Error("level number must be >= 2");', 'if (!n || n < 1) throw new Error("level number must be >= 1");')
R("    if (n <= 1) return startStage(broI, 1, keep);\n", "")
R("function unloadAllExcept(keep) { for (let i = 1; i < LEVELS.length; i++)", "function unloadAllExcept(keep) { for (let i = 0; i < LEVELS.length; i++)")
R("    if ((STATE.level || 1) > 1) return drawLevelCard();", "    return drawLevelCard();")
R("      if (L.fromQ) startStage(L.broI, 1); // bad ?level=N: fall back to level 1", "      if (L.fromQ && L.n !== 1) beginLevel(L.broI, 1); // bad ?level=N: fall back to stage 1")
R('LV_NAMES[STATE.level || 1] = LVc ? LVc.name : "HALLWAY FIRE";', 'LV_NAMES[STATE.level || 1] = LVc ? LVc.name : "RYU\'S DOJO";')
# mid-boss from the level def
R("    const cfg = MIDBOSS_CFG, y =", "    const cfg = (curLV() && curLV().midBoss) || MIDBOSS_CFG, y =")
R("    STATE.enemies.push(e); STATE.bossT = 150; SFX.rumble();\n    return e;",
  "    STATE.enemies.push(e); STATE.bossT = 150; SFX.rumble();\n    if (cfg.spawn) safe(() => cfg.spawn(API, e));\n    return e;")

# ---------------------------------------------------------------- stage map: 12 stops, shown before Stage 1 too
R('const LV_NAMES = { 1: "HALLWAY FIRE" }, LV_FINAL = {};',
  'const LV_NAMES = { 1: "RYU\'S DOJO", 2: "METRO CITY STREETS", 3: "E. HONDA\'S BATHHOUSE", 4: "GUILE\'S AIRBASE", 5: "BLANKA\'S JUNGLE", 6: "ZANGIEF\'S STEEL MILL",\n'
  '    7: "VEGA\'S CAGE", 8: "DHALSIM\'S TEMPLE", 9: "HONG KONG ROOFTOPS", 10: "WORLD WARRIOR ARENA", 11: "SHADALOO BASE", 12: "AKUMA\'S VOLCANO" }, LV_FINAL = { 12: true };\n'
  '  const LV_BOSS = { 1: "KEN / EVIL RYU", 2: "BALROG", 3: "E. HONDA", 4: "GUILE", 5: "BLANKA", 6: "ZANGIEF", 7: "VEGA", 8: "DHALSIM", 9: "DOLL UNIT", 10: "M. BISON", 11: "FINAL BISON", 12: "AKUMA (SECRET 1CC)" };')
R("const MAP_N = 15, ACT_SPLIT = 8;", "const MAP_N = 12, ACT_SPLIT = 6;")
R("const mapNode = (i) => i < ACT_SPLIT ? { x: 40 + i * 44, y: 84 + (i % 2 ? -9 : 9) } : { x: 348 - (i - ACT_SPLIT) * 44 - 22, y: 150 + ((i - ACT_SPLIT) % 2 ? -9 : 9) };",
  "const mapNode = (i) => i < ACT_SPLIT ? { x: 52 + i * 56, y: 80 + (i % 2 ? -9 : 9) } : { x: 332 - (i - ACT_SPLIT) * 56, y: 148 + ((i - ACT_SPLIT) % 2 ? -9 : 9) };")
R('ptext("ACT 1", 8, 56, 1, M.n1 <= ACT_SPLIT ? "#ffe060" : "#7fd85a", "left"); ptext("ACT 2", 8, 178, 1, M.n1 > ACT_SPLIT ? "#ffe060" : "#6a6a88", "left");',
  'ptext("WORLD TOUR", W - 8, 36, 1, M.n1 <= ACT_SPLIT ? "#ffe060" : "#7fd85a", "right"); ptext("SHADOW CONSPIRACY", 8, 178, 1, M.n1 > ACT_SPLIT ? "#ffe060" : "#6a6a88", "left");')
R('    ptext("NEXT: SCENE " + M.n1 + (nm ? " - " + nm : ""), W / 2, 194, 1, "#ff8c1a");',
  '    ptext("NEXT: STAGE " + M.n1 + (nm ? " - " + nm : ""), W / 2, 194, 1, "#ff8c1a");\n'
  '    if (LV_BOSS[M.n1]) ptext("BOSS: " + LV_BOSS[M.n1], W / 2, 203, 1, "#c8ccd6");')
R('if (M.t > 25 && Math.floor(STATE.t / 20) % 2) ptext("ATTACK, ENTER OR TAP TO GO", W / 2, 210, 1, "#ffd27a");',
  'if (M.t > 25 && Math.floor(STATE.t / 20) % 2) ptext("ATTACK, ENTER OR TAP TO GO", W / 2, 214, 1, "#ffd27a");')
R('ptext("? = COMING SOON", 8, 36, 1, "#8a8aa8", "left");', 'ptext("STAGES 2-12: COMING SOON", 8, 36, 1, "#8a8aa8", "left");')
R("if (++selWipe > 22) beginLevel(STATE.selectIndex, startLevelQ()); return; }",
  "if (++selWipe > 22) { if (startLevelQ() === 1 && !/[?&]nomap\\b/.test(location.search)) startMap(STATE.selectIndex, 1, null); else beginLevel(STATE.selectIndex, startLevelQ()); } return; }")
R("    if (p) drawRimIdle(p.bro.key, hx, hy, 22, 26);", "    const mb = p ? p.bro : BROTHERS[M.broI]; if (mb) drawRimIdle(mb.key, hx, hy, 22, 26);")

# ---------------------------------------------------------------- text rebrand
RX(r'"SCENE " \+ ', '"STAGE " + ')
R('"NEXT: LEVEL " + n1', '"NEXT: STAGE " + n1')
R('text("LEVEL " + n + (d ? ": " + d.name : ""), W / 2, 84, 10, "#ffd27a");', 'text("STAGE " + n + ": " + (LV_NAMES[n] || ""), W / 2, 84, 10, "#ffd27a");')
R('text("CHOOSE YOUR BROTHER", W / 2, 18, 16, "#fff");', 'text("CHOOSE YOUR FIGHTER", W / 2, 18, 16, "#fff");')
R("      drawWeaponIcon(x, 145, b.weapon);", "      text(b.special, x, 145, 6, sel ? \"#ffd27a\" : \"#8a7ab0\");")
R('"GRR... SHELL-HEADS!"', '"IS THAT ALL?"')
R('"THIS AIN\'T OVER, TURTLES!"', '"THIS ISN\'T OVER!"')
R('"NICE SHELL, NERD!"', '"WEAK STANCE!"')
R('    ptext("PIZZA BREAK!", W / 2, 20, 2, "#ffe060");', '    ptext("TEA BREAK!", W / 2, 20, 2, "#ffe060");')
R('Math.floor(t / 40) % 2 ? "NOM NOM!" : "MMM!"', 'Math.floor(t / 40) % 2 ? "ITADAKIMASU!" : "MMM!"')
R('playerBark(true, it.kind === "pizza" ? "A WHOLE PIE! YES!" : ["MMM, EXTRA CHEESE!", "SLICE OF LIFE!", "HOT AND FRESH!"][Math.random() * 3 | 0]);',
  'playerBark(true, it.kind === "pizza" ? (it.food === "sushi" ? "A WHOLE SUSHI PLATTER!" : "ROAST CHICKEN! YES!") : it.food === "tea" ? ["GREEN TEA. FOCUS.", "AH, HOT TEA!"][Math.random() * 2 | 0] : ["ONIGIRI!", "RICE POWER!"][Math.random() * 2 | 0]);')
R('ptext("STAGE MAP", W / 2, 16, 2, "#ffe060");', 'ptext("WORLD WARRIOR MAP", W / 2, 16, 2, "#ffe060");')
R('"ssla_diff"', '"sfwb_diff"', 2)
R('const HS_KEY = "ssla_hiscores_v1"', 'const HS_KEY = "sfwb_hiscores_v1"')
R('"ssla_initials"', '"sfwb_initials"', 2)
R('ptext("SC " + r.l, 236, y, 1, "#9a8ab0", "left");', 'ptext("ST " + r.l, 236, y, 1, "#9a8ab0", "left");')

# ---------------------------------------------------------------- title: dawn sky + mountains, flame logo
R('    drawLogo("SHELL SHOCK:", W / 2, Math.round(12 - (1 - e) * 110), 5);\n    drawLogo("LIVE ACTION", W / 2, Math.round(56 - (1 - e) * 110), 3);',
  '    drawLogo("STREET FIGHTER", W / 2, Math.round(10 - (1 - e) * 110), 4);\n    drawLogo("WORLD BRAWL", W / 2, Math.round(48 - (1 - e) * 110), 3);\n'
  '    if (titleT > 40) ptext("FAN GAME", W / 2 + 132, 70, 1, "#c8ccd6");')
R('''    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],''',
  '''    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
    W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],''')
R('const COL = ["#7fd85a", "#ffe040", "#3fae3a", "#3fae3a", "#3fae3a", "#2f9a30", "#24702a"];',
  'const COL = ["#fff27a", "#ffd23a", "#ffb02a", "#ff8a1a", "#ff5a14", "#e8300e", "#b81a0a"];')
R('rect(x0 + c * cell - 2, y + r * cell - 2, cell + 4, cell + 4, "#0a1a0a"); // outline', 'rect(x0 + c * cell - 2, y + r * cell - 2, cell + 4, cell + 4, "#2a0604"); // outline')
R('if (r === 1) rect(x0 + c * cell, y + r * cell, cell, 1, "#fff6a0");', 'if (r === 0) rect(x0 + c * cell, y + r * cell, cell, 1, "#ffffff");')
night_start = s.index("  function drawNight() {")
night_end = s.index("  function updateTitle() {")
s = s[:night_start] + '''  function drawNight() { // SF: dawn over misty mountains (title, map, initials)
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#1a1038"); grd.addColorStop(0.45, "#6a2a5a"); grd.addColorStop(0.72, "#e8784a"); grd.addColorStop(1, "#ffcf8a");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) { const tw = Math.sin(STATE.t * 0.05 + i * 2.3) > 0.6; rect(hash(i) * W, hash(i + 99) * 60, 1, 1, tw ? "#fff" : "#a890c0"); }
    // rising sun
    ctx.fillStyle = "rgba(255,230,160,0.18)"; ctx.beginPath(); ctx.arc(300, 150, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffe7a0"; ctx.beginPath(); ctx.arc(300, 150, 26, 0, Math.PI * 2); ctx.fill();
    // three mountain ridges with mist bands between them
    const R = [["#5a3a6a", 118, 34, 0.018], ["#3a2448", 140, 28, 0.026], ["#1a1024", 166, 22, 0.035]];
    R.forEach(([col, base, amp, f], j) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) ctx.lineTo(x, base - Math.abs(Math.sin(x * f + j * 1.7)) * amp - Math.sin(x * f * 3.1 + j) * amp * 0.25);
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,220,200,0.10)"; ctx.fillRect(0, base - 6, W, 10);
    });
    // a pagoda roof silhouette on the near ridge
    const px = 70, py = 150; ctx.fillStyle = "#120a18";
    for (let k = 0; k < 3; k++) { const w = 26 - k * 6, y = py - k * 10; ctx.beginPath(); ctx.moveTo(px - w, y); ctx.lineTo(px + w, y); ctx.lineTo(px + w - 6, y - 5); ctx.lineTo(px - w + 6, y - 5); ctx.closePath(); ctx.fill(); rect(px - w + 8, y, (w - 8) * 2, 5, "#120a18"); }
  }
''' + s[night_end:]

# ---------------------------------------------------------------- music: new title theme (original, A minor pentatonic, 152 BPM)
R('const T_CH = ["Em", "Em", "C", "D", "Em", "Em", "C", "B", "Am", "C", "G", "D", "Em", "C", "B", "B"];',
  'const T_CH = ["Am", "Am", "F", "G", "Am", "Am", "Dm", "E", "F", "G", "Em", "Am", "Dm", "F", "E", "E"];')
R('const T_RIFF = "E5:2 .:1 E5:1 G5:2 E5:2 B5:3 A5:1 G5:2 F#5:2";', 'const T_RIFF = "A5:2 .:1 A5:1 C6:2 A5:2 G5:3 E5:1 D5:2 E5:2";')
t0 = s.index("    lead: [T_RIFF,")
t1 = s.index('].join(" "),', t0)
s = s[:t0] + '''    lead: [T_RIFF, "A4:2 C5:2 D5:2 E5:2 A5:4 .:4", "F5:2 .:1 F5:1 A5:2 C6:2 D6:3 C6:1 A5:2 G5:2", "G5:4 D5:4 B4:4 D5:2 G5:2",
      T_RIFF, "C6:2 A5:2 G5:2 E5:2 A5:4 .:4", "D5:2 F5:2 A5:2 D6:2 C6:2 A5:2 F5:4", "E5:4 G#5:4 B5:6 .:2",
      "F5:3 G5:1 A5:2 C6:2 A5:2 G5:2 F5:4", "G5:3 A5:1 B5:2 D6:2 B5:2 A5:2 G5:4", "E5:2 G5:2 B5:2 E6:2 D6:2 B5:2 G5:4", "A5:2 C6:2 E6:4 D6:2 C6:2 A5:4",
      "D6:2 .:1 D6:1 C6:2 A5:2 F5:2 A5:2 D6:4", "C6:2 A5:2 F5:2 C5:2 F5:4 A5:4", "B5:2 G#5:2 E5:2 G#5:2 B5:4 E6:4", "E6:2 D6:2 B5:2 G#5:2 E5:4 .:4"''' + s[t1:]
R("const TITLE = track({ bpm: 150,", "const TITLE = track({ bpm: 152,")

# ---------------------------------------------------------------- food pickups (tea / onigiri = small, roast chicken / sushi = full)
R("t: 0, life: o.life | 0, bob: Math.random() * 6 };",
  "t: 0, life: o.life | 0, bob: Math.random() * 6 };\n"
  "    it.food = o.food || (it.kind === \"pizza\" ? (Math.random() < 0.5 ? \"chicken\" : \"sushi\") : (Math.random() < 0.5 ? \"tea\" : \"onigiri\"));")
d0 = s.index('    const crust = "#c8862a", cr2 = "#e8a850", cheese = "#f6cf4a", ch2 = "#ffe68a", pep = "#b8281a", ol = "#2a1408";')
d1 = s.index("    ctx.restore();\n    if ((STATE.t + (it.bob * 10 | 0)) % 40 < 6)", d0)
s = s[:d0] + '''    const ol = "#1a0e08";
    if (it.food === "chicken") { // whole roast chicken on a plate
      ctx.fillStyle = "#e8e8f0"; ctx.beginPath(); ctx.ellipse(sx, y - 2, 12, 3.5, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = ol; ctx.beginPath(); ctx.ellipse(sx, y - 7, 9.5, 6, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#b8641e"; ctx.beginPath(); ctx.ellipse(sx, y - 7, 8.5, 5.2, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#e0943a"; ctx.beginPath(); ctx.ellipse(sx - 2, y - 9, 5, 2.5, -0.3, 0, 6.29); ctx.fill();
      rect(sx + 7, y - 12, 2, 5, "#b8641e"); rect(sx + 7, y - 14, 3, 3, "#fff6e0"); rect(sx - 10, y - 11, 2, 5, "#b8641e"); rect(sx - 11, y - 13, 3, 3, "#fff6e0");
    } else if (it.food === "sushi") { // sushi platter: nigiri on a wooden geta
      rect(sx - 13, y - 4, 26, 4, ol); rect(sx - 12, y - 4, 24, 3, "#b8844a"); rect(sx - 12, y - 4, 24, 1, "#e0b47a");
      for (let i = 0; i < 4; i++) { const x = sx - 11 + i * 6; rect(x, y - 9, 5, 5, ol); rect(x, y - 8, 5, 4, "#f4f4ec"); rect(x, y - 10, 5, 3, i % 2 ? "#ff7a4a" : "#e8302a"); rect(x, y - 10, 5, 1, "#ffb08a"); rect(x + 2, y - 9, 1, 4, "#1a2a1a"); }
    } else if (it.food === "tea") { // cup of green tea, steaming
      rect(sx - 5, y - 11, 10, 11, ol); rect(sx - 4, y - 10, 8, 9, "#d8d0c0"); rect(sx - 4, y - 10, 8, 2, "#6aa83a"); rect(sx - 4, y - 5, 8, 1, "#8a6a4a");
      if (Math.floor(STATE.t / 10) % 2) { rect(sx - 2, y - 15, 1, 3, "rgba(255,255,255,0.6)"); rect(sx + 1, y - 17, 1, 3, "rgba(255,255,255,0.5)"); }
    } else { // onigiri: rice triangle with a nori band
      ctx.fillStyle = ol; ctx.beginPath(); ctx.moveTo(sx, y - 16); ctx.lineTo(sx + 8, y - 1); ctx.lineTo(sx - 8, y - 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f8f8f2"; ctx.beginPath(); ctx.moveTo(sx, y - 14.5); ctx.lineTo(sx + 6.5, y - 2); ctx.lineTo(sx - 6.5, y - 2); ctx.closePath(); ctx.fill();
      rect(sx - 4, y - 7, 8, 5, "#1a2a1a"); rect(sx - 3, y - 7, 6, 1, "#2a4a2a"); rect(sx - 1, y - 11, 2, 1, "#ffffff");
    }
''' + s[d1:]
R('const msg = full ? "+500" : it.kind === "pizza" ? "FULL HEALTH!" : "+HEALTH";', 'const msg = full ? "+500" : it.kind === "pizza" ? "FULL HEALTH!" : "+HEALTH";')
# tea-break vignette: onigiri instead of a pizza slice, a tea tray instead of the box
sl0 = s.index("  function drawSlice(x, y, len) {")
sl1 = s.index("  function drawPizza() {")
s = s[:sl0] + '''  function drawSlice(x, y, len) { // SF: an onigiri held out at (x, y); shrinks as it gets eaten
    x = Math.round(x); y = Math.round(y);
    const L = Math.max(3, Math.round(len * 0.55));
    ctx.fillStyle = "#1a0e08"; ctx.beginPath(); ctx.moveTo(x + L, y - L - 1); ctx.lineTo(x + 2 * L + 1, y + L); ctx.lineTo(x - 1, y + L); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f8f8f2"; ctx.beginPath(); ctx.moveTo(x + L, y - L); ctx.lineTo(x + 2 * L, y + L - 1); ctx.lineTo(x, y + L - 1); ctx.closePath(); ctx.fill();
    rect(x + L - 3, y + 1, 6, L - 1, "#1a2a1a");
  }
''' + s[sl1:]
R('''    rect(-30, -24, 60, 10, "#a8743a"); rect(-29, -23, 58, 8, "#c8945a"); rect(-29, -23, 58, 1, "#e0b47a");
    rect(-32, -14, 64, 13, "#b8844a"); rect(-32, -14, 64, 2, "#e0b47a"); rect(-32, -2, 64, 2, "#6a4420");
    rect(-26, -13, 52, 3, "#f6cf4a"); for (let i = 0; i < 5; i++) rect(-22 + i * 10, -13, 3, 2, "#a8241a");''',
  '''    rect(-32, -14, 64, 13, "#5a2a14"); rect(-32, -14, 64, 2, "#8a4a24"); rect(-32, -2, 64, 2, "#2a1408"); // low lacquered tray
    rect(-24, -22, 9, 9, "#1a0e08"); rect(-23, -21, 7, 7, "#d8d0c0"); rect(-23, -21, 7, 2, "#6aa83a"); // tea cup
    for (let i = 0; i < 3; i++) { const ox2 = 2 + i * 9; ctx.fillStyle = "#f8f8f2"; ctx.beginPath(); ctx.moveTo(ox2, -22); ctx.lineTo(ox2 + 4, -15); ctx.lineTo(ox2 - 4, -15); ctx.closePath(); ctx.fill(); rect(ox2 - 2, -18, 4, 3, "#1a2a1a"); }''')
R('c: ["#f2c94c", "#c8862a", "#d8402a", "#fff2a0"][i % 4]', 'c: ["#ffffff", "#f0f0e0", "#1a2a1a", "#e8e8d8"][i % 4]')
R('      ctx.strokeStyle = "#ffe68a"; ctx.lineWidth = 0.8;', '      ctx.strokeStyle = "rgba(255,255,255,0)"; ctx.lineWidth = 0.8;')

# ---------------------------------------------------------------- dojo props: training dummy, shoji screen, scroll rack
R("const PROP_DEF = { barrel: { hp: 3, w: 12, h: 18 }, crate: { hp: 2, w: 14, h: 14 }, trash: { hp: 2, w: 12, h: 17 }, cone: { hp: 1, w: 9, h: 12 } };",
  "const PROP_DEF = { barrel: { hp: 3, w: 12, h: 18 }, crate: { hp: 2, w: 14, h: 14 }, trash: { hp: 2, w: 12, h: 17 }, cone: { hp: 1, w: 9, h: 12 },\n"
  "    dummy: { hp: 3, w: 10, h: 24 }, shoji: { hp: 1, w: 18, h: 22 }, scrolls: { hp: 2, w: 16, h: 18 } };")
R('trash: ["#8a8f98", "#5a5f68", "#b8bdc6", "#3a3f48"], cone: ["#ff7a1a", "#ffffff", "#c8501a", "#ff9a3a"] }[pr.kind];',
  'trash: ["#8a8f98", "#5a5f68", "#b8bdc6", "#3a3f48"], cone: ["#ff7a1a", "#ffffff", "#c8501a", "#ff9a3a"],\n'
  '      dummy: ["#c8a060", "#8a6a3a", "#e8d0a0", "#5a3a1a"], shoji: ["#f4ecd8", "#5a3a1a", "#e8dcc0", "#3a2410"], scrolls: ["#f0e6c8", "#8a2a1a", "#5a3a1a", "#e8c040"] }[pr.kind];')
R("const drop = pr.drop || (pr.kind !== \"cone\" && Math.random() < 0.15 ? \"slice\" : null);",
  "const drop = pr.drop || (pr.kind !== \"cone\" && pr.kind !== \"shoji\" && Math.random() < (pr.kind === \"scrolls\" ? 0.6 : 0.15) ? \"slice\" : null);")
R("    if (drop && drop !== \"none\") spawnItem({ kind: drop, x:", "    if (drop && drop !== \"none\") spawnItem({ food: pr.food, kind: drop, x:")
R("t: 0, flash: 0, rot: 0, hit: null, onBreak: o.onBreak || null };", "t: 0, flash: 0, rot: 0, hit: null, onBreak: o.onBreak || null, food: o.food };")
R('''    } else { // traffic cone''',
  '''    } else if (pr.kind === "dummy") { // makiwara training dummy: straw-wrapped post on a base
      rect(-6, -2, 12, 2, ol); rect(-5, -2, 10, 1, "#5a3a1a");
      rect(-2, -26, 4, 25, ol); rect(-1, -25, 2, 24, "#8a6a3a");
      rect(-5, -24, 10, 12, ol); rect(-4, -23, 8, 10, "#c8a060"); for (const ry of [-21, -18, -15]) rect(-4, ry, 8, 1, "#8a6a3a");
      rect(-7, -10, 14, 2, ol); rect(-6, -10, 12, 1, "#a07a40"); // arm
    } else if (pr.kind === "shoji") { // free-standing shoji screen panel
      rect(-10, -24, 20, 24, ol); rect(-9, -23, 18, 22, "#f4ecd8");
      for (const gx of [-3, 3]) rect(gx, -23, 1, 22, "#5a3a1a"); for (const gy of [-17, -11, -5]) rect(-9, gy, 18, 1, "#5a3a1a");
      rect(-11, -1, 4, 1, "#3a2410"); rect(7, -1, 4, 1, "#3a2410");
    } else if (pr.kind === "scrolls") { // scroll rack: tea and onigiri tucked behind the scrolls
      rect(-9, -20, 18, 20, ol); rect(-8, -19, 16, 18, "#5a3a1a"); rect(-8, -13, 16, 1, "#3a2410"); rect(-8, -7, 16, 1, "#3a2410");
      for (let i = 0; i < 4; i++) { rect(-7 + i * 4, -18, 3, 4, "#f0e6c8"); rect(-7 + i * 4, -12, 3, 4, i % 2 ? "#e8c040" : "#f0e6c8"); rect(-7 + i * 4 + 1, -6, 2, 4, "#8a2a1a"); }
    } else { // traffic cone''')

for a, b in [("lenny", "cammy"), ("rafe", "feilong"), ("miko", "deejay"), ("donny", "ryu")]:
    R('src="atlas_%s.png"' % a, 'src="atlas_%s.png"' % b)
R('MIDBOSS_CFG = { name: "SCORCHER"', 'MIDBOSS_CFG = { name: "SPARRING PARTNER"')
R('lines: { intro: "FIRE\'S MY BUSINESS, SHELLHEADS!", hit: ["HEY! HOT STUFF COMIN\' THROUGH!", "YOU\'RE PLAYIN\' WITH FIRE!"], ko: "TOO... HOT... TO HANDLE..." } };',
  'lines: { intro: "LET\'S SPAR!", hit: ["NICE ONE!", "AGAIN!"], ko: "GOOD MATCH!" } };')
R('const HS_SEED = [["LEN", 12000], ["RAF", 10000], ["MIK", 8500], ["DON", 7000], ["AMB", 6000], ["ZAP", 5000], ["RAM", 4000], ["JAX", 3000], ["KIT", 2000], ["PIE", 1000]];',
  'const HS_SEED = [["RYU", 12000], ["KEN", 10000], ["CHN", 8500], ["GLE", 7000], ["CMY", 6000], ["FEI", 5000], ["DJ.", 4000], ["SAK", 3000], ["DAN", 2000], ["BLK", 1000]];')
R('ptext("STAGE " + (STATE.level || 1) + " CLEAR", W / 2, 50, 3, "#ffe060");', 'ptext("STAGE " + (STATE.level || 1) + " CLEAR", W / 2, 50, 2, "#ffe060");')
R('function drawTurtle(x, y, mask, facing, swing, step, weapon = "katana") {', 'function drawTurtle(x, y, mask, facing, swing, step, weapon = "katana") {\n    return; // SF fork: never draw the procedural turtle fallback (atlas not loaded yet = draw nothing)')
# ---------------------------------------------------------------- done
open(OUT, "w").write(s)
print("patched OK", len(s))
