# Builds site/game.js = slices reused VERBATIM from the Shell Shock 16-Bit JS game (g16js/site/index.html) + the new 3D code (src/*.js),
# and site/index.html = the 16-bit game's page (head/CSS/cabinet markup) with a WebGL canvas under the HUD canvas.
import re, sys
SRC = '/workspace/work/g16js/site/index.html'
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
    ('if (k === "c" && !keys.has(k)) document.getElementById("screen").classList.toggle("crt");', 'if (k === "v" && !keys.has(k)) document.getElementById("screen").classList.toggle("crt");'),  # C is COUNTER now; the CRT toggle moves to V
    ('PORT_I = {"lenny":0,"rafe":1,"miko":2,"donny":3,"ramrod":4,"zap":5,"scorcher":6,"brickjaw":7,"gulch":8,"jetwash":9,"grimwale":10,"coldfront":11,"rustmaul":12,"razorback":13,"karai":14,"armaggon":15,"leatherhead":16,"viral":17,"traag":18,"granitor":19,"krang":20,"shredder":21,"super":22}',
     'PORT_I = {"lenny":0,"rafe":1,"miko":2,"donny":3,"ramrod":4,"zap":5,"scorcher":6}'),  # only this game's portraits
    ('''BRICKJAW: "brickjaw", "GULCH GATOR": "gulch", JETWASH: "jetwash", GRIMWALE: "grimwale", "COLD FRONT": "coldfront",
    RUSTMAUL: "rustmaul", RAZORBACK: "razorback", KARAI: "karai", ARMAGGON: "armaggon", LEATHERHEAD: "leatherhead", VIRAL: "viral", "GENERAL TRAAG": "traag", TRAAG: "traag", "LT. GRANITOR": "granitor", GRANITOR: "granitor",
    KRANG: "krang", SHREDDER: "shredder", "THE SHREDDER": "shredder", "SUPER SHREDDER": "super" };''', '};'),  # (other games' boss names out)
]
import os as _os
FZ = '/workspace/work/ss3d/frozen'
for a, b in ([] if _os.path.exists(FZ + '/reused.js') else PATCH):
    if a not in reused: sys.exit('patch miss: ' + a[:60])
    reused = reused.replace(a, b)  # snapshot of the patched reused slices / page top / fullscreen IIFE (the 16-bit source keeps changing under other work)
if _os.path.exists(FZ + '/reused.js'): reused = open(FZ + '/reused.js').read()
parts = [open(f'/workspace/work/ss3d/src/{n}.js').read() for n in ['head', 'world', 'sewer', 'subway', 'decor', 'actors', 'game', 'skate', 'freeflow', 'daynight', 'stealth', 'cams', 'van', 'hud']]
js = parts[0] + '\n' + reused + '\n' + '\n'.join(parts[1:]) + '\n  function stageMove(p) { move3D(p); }\n  function drawTurtle() {}\n  function tintSheet() { return null; }\n  const silCtx = null, imgOk = artOk;\n})();\n'
# PORTRAIT FILL (same patch as the other Shell Shock 3D builds, vendored in pfill_patch.py): real aspect in portrait, wider vertical FOV, taller HUD
import importlib.util, sys as _s
_a = _s.argv; _s.argv = ['pfill']; _sp = importlib.util.spec_from_file_location('pfill_patch', '/workspace/work/ss3d/pfill_patch.py'); PF = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(PF); _s.argv = _a
for a_, b_ in PF.P:
    if js.count(a_) != 1: sys.exit('pfill miss: ' + a_[:60])
    js = js.replace(a_, b_)
_h = 0
for a_, b_ in PF.FIT:
    if js.count(a_) == 1: js = js.replace(a_, b_); _h += 1
if _h != 1: sys.exit('pfill fit miss')
open('/workspace/work/ss3d/site/game.js', 'w').write(js)
print('game.js', len(js), 'bytes;', sum(b - a + 1 for _, a, b in R), 'reused lines')
# fullscreen / rotate-to-landscape IIFE (reused verbatim) goes in its own classic script
fs = open(FZ + '/fs.js').read() if _os.path.exists(FZ + '/fs.js') else '\n'.join(src[6025:6081])
assert fs.strip().startswith('// ---------- Full-screen toggle'), fs[:80]
# index.html: the 16-bit page head + cabinet, with the WebGL canvas
top = open(FZ + '/top.html').read() if _os.path.exists(FZ + '/top.html') else '\n'.join(src[:99])
top = top.replace('<title>SHELL SHOCK 16-BIT</title>', '<title>SHELL SHOCK 3D</title>').replace('content="Shell Shock Live"', 'content="Shell Shock 3D"')
top = top.replace('<canvas id="game" width="384" height="224"></canvas>', '<canvas id="gl" width="384" height="224"></canvas><canvas id="game" width="384" height="224"></canvas>')
top = top.replace('<a id="trailerbtn" href="https://shellshock16bit-trailer.surge.sh/" aria-label="Watch the trailer">&#9654; WATCH TRAILER</a>\n', '')
top = top.replace('</style>', '  #screen canvas#gl { z-index: 0; image-rendering: auto; }\n  #screen canvas#game { z-index: 1; background: transparent; }\n  #screen canvas#bloom { display: none !important; }\n  html, body { max-width: 100vw; }\n  .ss-tb { position: absolute; z-index: 4; right: 1.6%; width: 15.5%; height: 12.5%; display: none; align-items: center; justify-content: center; border-radius: 999px; font: 900 clamp(7px, 1.45vw, 12px)/1 "Arial Black", Arial, sans-serif; letter-spacing: 0; color: #111; background: radial-gradient(circle at 50% 35%, #ffffff, #ffe060 45%, #d89a10); box-shadow: 0 0 0 2px #000, 0 3px 0 2px #6a4a00; opacity: .82; touch-action: none; user-select: none; -webkit-user-select: none; }\n  .ss-tb-c { bottom: 5%; }\n  .ss-tb-k { bottom: 21%; background: radial-gradient(circle at 50% 35%, #ffffff, #7fff9a 45%, #1aa04a); box-shadow: 0 0 0 2px #000, 0 3px 0 2px #0a5020; }\n  .ss-tb.hot { opacity: 1; animation: sstb .25s steps(2) infinite; }\n  .ss-tb.on { transform: translateY(2px); filter: brightness(.8); }\n  .ss-tb-s { bottom: 37%; background: radial-gradient(circle at 50% 35%, #ffffff, #8ad8ff 45%, #1a70b0); box-shadow: 0 0 0 2px #000, 0 3px 0 2px #0a3a60; }\n  .ss-tb-cam { left: 1.6%; right: auto; top: 15%; width: 10%; height: 10%; background: radial-gradient(circle at 50% 35%, #ffffff, #ff9ad8 45%, #b02a80); box-shadow: 0 0 0 2px #000, 0 3px 0 2px #600a40; }\n  @media (orientation: portrait) { .ss-tb { height: auto; aspect-ratio: 2.5 / 1; width: 19%; font-size: 10px; } .ss-tb-cam { top: 6%; width: 13%; } }\n  @keyframes sstb { 50% { box-shadow: 0 0 0 2px #000, 0 0 14px 6px #fff8a0; } }\n</style>')
assert '<canvas id="gl"' in top
hidden = '<div hidden aria-hidden="true">\n' + '\n'.join(f'  <img id="atlas-{n}" src="atlas_{n}.webp" alt="" />' for n in ['lenny', 'rafe', 'miko', 'donny']) + '\n</div>\n'
html = top + '\n' + hidden + '<script type="module" src="game.js"></script>\n<script>\n' + fs + '\n</script>\n</body>\n</html>\n'
open('/workspace/work/ss3d/site/index.html', 'w').write(html)
open('/workspace/work/ss3d/site/manifest.webmanifest', 'w').write('{"name":"Shell Shock 3D","short_name":"Shell Shock 3D","start_url":"./","scope":"./","display":"fullscreen","orientation":"any","background_color":"#000000","theme_color":"#000000","icons":[{"src":"icon192.png","sizes":"192x192","type":"image/png"},{"src":"icon512.png","sizes":"512x512","type":"image/png"}]}')
print('index.html', len(html))
