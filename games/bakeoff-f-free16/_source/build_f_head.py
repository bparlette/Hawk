# Builds site/game.js = slices reused VERBATIM from the Shell Shock 16-Bit JS game (g16js/site/index.html) + the new 3D code (src/*.js),
# and site/index.html = the 16-bit game's page (head/CSS/cabinet markup) with a WebGL canvas under the HUD canvas.
import re, sys
SRC = '/workspace/work/ss3d-bakeoff/f_free16/g16_index.html'
src = open(SRC).read().split('\n')
R = [  # (what, first line, last line) - 1-based, inclusive
    ("wake lock", 170, 187), ("audio + music + SFX + barks", 188, 451), ("layout + cabinet/touch/keyboard/gamepad input", 452, 723),
    ("drawing helpers + pixel HUD font", 725, 765), ("select screen", 1716, 1790), ("data-driven enemies/projectiles/props/pickups", 1791, 1905),
    ("fx + startAtk + swings + hurt/grab/hitEnemy/tokens/player hits", 1947, 2090), ("spawnEnemy", 2091, 2107),
    ("defeat + enemy AI + Zap-Roller AI + Ramrod AI", 2296, 2492), ("atlas tables + portraits", 2696, 2734),
    ("sprite exposure/rim/frame pickers", 2753, 2847), ("Level-1 enemy skins", 2856, 2888), ("zap frames", 3011, 3017), ("ramrod frames", 3044, 3055),
    ("speech bubble", 3367, 3375), ("speaker toggle", 3955, 3962), ("difficulty, hit rules, zones, applyMove", 3966, 4023),
    ("pizza pickups", 4039, 4062), ("props (break / lift / throw / roll)", 4092, 4180), ("throws", 4217, 4269), ("specials", 4270, 4303),
    ("wave entrances", 4316, 4332), ("Scorcher mid-boss", 4452, 4494), ("resetWorldBits + featureInput", 4498, 4514),
    ("boss enter / move pick / extra moves", 4956, 5009), ("hit-stop", 5766, 5770),
]
out = []
for name, a, b in R:
    out.append(f"  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines {a}-{b}: {name} =====")
    out.extend(src[a - 1:b])
reused = '\n'.join(out)
PATCH = [  # minimal, named patches to reused code
    ('{ const tb = document.getElementById("trailerbtn");', '{ const tb = document.getElementById("trailerbtn"); if (tb) {'),  # no trailer button on this page
    ('tb.addEventListener("touchend", go, { passive: false }); tb.addEventListener("click", go); }', 'tb.addEventListener("touchend", go, { passive: false }); tb.addEventListener("click", go); } }'),
    (', MAP_BG = mkArt("map_bg.jpg")', ''),  # the stage map is not part of this game
    ('    const s = STATE.scene;\n    if (s === "title" || s === "select") return "title";', '    const s = STATE.scene;\n    if (s === "win" || s === "over") return "clear";\n    if (s === "title" || s === "select") return "title";'),
    ('try { if (navigator.vibrate) navigator.vibrate(ms); }', 'try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); }'),  # no blocked-vibrate console errors before a tap
    ('    if (STATE.section === "A") for (let d = 100;', '    if (false) for (let d = 100;'),  # no hallway doors outside
    ('    if (e.entered) e.x = Math.max(STATE.camX + 8, Math.min(STATE.camX + W - 8, e.x));', '    if (e.entered && STATE.locked) e.x = Math.max(STATE.camX + 8, Math.min(STATE.camX + W - 8, e.x));'),  # open world: no screen pinning
]
for a, b in PATCH:
    if a not in reused: sys.exit('patch miss: ' + a[:60])
    reused = reused.replace(a, b)

