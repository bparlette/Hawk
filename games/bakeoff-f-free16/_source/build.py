# Builds site/game.js = slices reused VERBATIM from the Shell Shock 16-Bit JS game (g16js/site/index.html) + the new 3D code (src/*.js),
# and site/index.html = the 16-bit game's page (head/CSS/cabinet markup) with a WebGL canvas under the HUD canvas.
import re, sys
SRC = '/workspace/work/ss3d-bakeoff/g16_index.html'
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

# ---- bake-off: four sites (free / paper / gta / skyline) from one source, MODE baked into each game.js ----
import os, shutil
BASE = '/workspace/work/ss3d-bakeoff'
parts = [open(f'{BASE}/src/{n}.js').read() for n in ['head', 'city', 'skyline', 'actors', 'game', 'hud']]
js0 = parts[0] + '\n' + reused + '\n' + '\n'.join(parts[1:]) + '\n  function stageMove(p) { move3D(p); }\n  function drawTurtle() {}\n  function tintSheet() { return null; }\n  const silCtx = null, imgOk = artOk;\n})();\n'
fs = '\n'.join(src[6025:6081])
assert fs.strip().startswith('// ---------- Full-screen toggle'), fs[:80]
SITES = {'free': ('A', 'FREE CITY', 'shellshock-free-city'), 'paper': ('B', 'PAPER CITY', 'shellshock-paper-city'), 'gta': ('C', 'GTA CITY', 'shellshock-gta-city'), 'skyline': ('D', 'SKYLINE CITY', 'shellshock-skyline-city')}
ASSETS = ['three.module.min.js', 'atlas_lenny.webp', 'atlas_rafe.webp', 'atlas_miko.webp', 'atlas_donny.webp', 'atlas_ninja.webp', 'shared_sprites.webp',
          'sp_lenny.webp', 'sp_rafe.webp', 'sp_miko.webp', 'sp_donny.webp', 'hud_portraits.webp', 'cabinet_special.webp', 'stick.webp', 'title_logo.webp', 'title_bg.jpg',
          'icon180.png', 'icon192.png', 'icon512.png', 'v8_lenny.webp', 'v8_rafe.webp', 'v8_miko.webp', 'v8_donny.webp', 'v8_thug.webp', 'levels/enemies_street.webp',
          'tex/asphalt.jpg', 'tex/sidewalk.jpg', 'tex/roof.jpg', 'tex/facade_a.jpg', 'tex/facade_b.jpg', 'tex/mural_pizza.jpg', 'tex/mural_gator.jpg', 'tex/props2.webp',
          'tex/skyline.jpg', 'tex/taxi_side.webp', 'tex/van_side.webp', 'atlas_ramrod.webp', 'atlas_zap.webp', 'atlas_scorcher.webp', 'drill.webp']
CSS = """  #screen canvas#gl { z-index: 0; image-rendering: auto; }
  #screen canvas#game { z-index: 1; background: transparent; }
  #screen canvas#bloom { display: none !important; }
  html, body { max-width: 100vw; overflow-x: hidden; }
  #proto { position: fixed; z-index: 60; left: calc(env(safe-area-inset-left, 0px) + 4px); top: calc(env(safe-area-inset-top, 0px) + 4px); display: flex; flex-direction: column; gap: 3px; align-items: stretch; width: 104px; box-sizing: border-box;
    padding: 4px; border-radius: 8px; background: rgba(8,8,14,.78); border: 1px solid rgba(255,210,60,.55); font: 700 10px/1 system-ui, -apple-system, sans-serif; color: #ffd23c; white-space: nowrap; letter-spacing: .5px; }
  #proto b { padding: 1px 2px 2px; text-align: center; font-size: 9px; }
  #proto a { color: #c8ccd6; text-decoration: none; padding: 3px 4px; border-radius: 6px; text-align: center; border: 1px solid rgba(255,255,255,.22); touch-action: manipulation; }
  #proto a.on { color: #000; background: #ffd23c; border-color: #ffd23c; }
  .camb { position: absolute; z-index: 4; bottom: 4%; width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(255,255,255,.45); background: rgba(8,8,14,.55); color: #fff; font: 700 15px/1 system-ui, sans-serif; padding: 0; touch-action: none; opacity: .7; }
  .camb[data-d="-1"] { left: 2%; } .camb[data-d="1"] { right: 2%; }
  @media (hover: hover) and (pointer: fine) { .camb { opacity: .45; } }
</style>"""
for mode, (letter, name, sub) in SITES.items():
    out = f'{BASE}/site_{mode}'
    os.makedirs(out + '/tex', exist_ok=True); os.makedirs(out + '/levels', exist_ok=True)
    for a in ASSETS: shutil.copyfile(f'{BASE}/site/' + a, out + '/' + a)
    js = js0.replace('"__MODE__"', '"' + mode + '"')
    open(out + '/game.js', 'w').write(js)
    top = '\n'.join(src[:99])
    top = top.replace('<title>SHELL SHOCK 16-BIT</title>', f'<title>SHELL SHOCK 3D - {letter}: {name}</title>').replace('content="Shell Shock Live"', f'content="SS {name.title()}"')
    btns = '<button class="camb" data-d="-1" aria-label="Swing camera left">&#10226;</button><button class="camb" data-d="1" aria-label="Swing camera right">&#10227;</button>' if mode != 'free' else ''
    top = top.replace('<canvas id="game" width="384" height="224"></canvas>', '<canvas id="gl" width="384" height="224"></canvas><canvas id="game" width="384" height="224"></canvas>' + btns)
    top = top.replace('<a id="trailerbtn" href="https://shellshock16bit-trailer.surge.sh/" aria-label="Watch the trailer">&#9654; WATCH TRAILER</a>\n', '')
    links = ''.join(f'<a href="https://{v[2]}.surge.sh/"{" class=on" if k == mode else ""}>{v[0]} {v[1].split()[0]}</a>' for k, v in SITES.items())
    top = top.replace('<div id="cab">', f'<div id="proto"><b>{letter}: {name}</b>{links}</div>\n<div id="cab">')
    top = top.replace('</style>', CSS, 1)
    assert '<canvas id="gl"' in top and 'id="proto"' in top
    hidden = '<div hidden aria-hidden="true">\n' + '\n'.join(f'  <img id="atlas-{n}" src="atlas_{n}.webp" alt="" />' for n in ['lenny', 'rafe', 'miko', 'donny']) + '\n</div>\n'
    html = top + '\n' + hidden + '<script type="module" src="game.js"></script>\n<script>\n' + fs + '\n</script>\n</body>\n</html>\n'
    open(out + '/index.html', 'w').write(html)
    open(out + '/manifest.webmanifest', 'w').write('{"name":"Shell Shock ' + name.title() + '","short_name":"SS ' + name.title() + '","start_url":"./","scope":"./","display":"fullscreen","orientation":"any","background_color":"#000000","theme_color":"#000000","icons":[{"src":"icon192.png","sizes":"192x192","type":"image/png"},{"src":"icon512.png","sizes":"512x512","type":"image/png"}]}')
    open(out + '/CNAME', 'w').write(sub + '.surge.sh')
    print(mode, len(js), len(html))
