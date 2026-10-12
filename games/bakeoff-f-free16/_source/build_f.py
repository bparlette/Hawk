# Prototype F "Free City 16-bit": prototype A (free city camera) with the ORIGINAL Shell Shock 16-Bit pixel sprites,
# a low-res nearest-upscaled framebuffer and 16-bit pixel textures. Self-contained copy: reads only f_free16/.
import os, shutil, json, re, sys
exec(open('/workspace/work/ss3d-bakeoff/f_free16/build_f_head.py').read())   # -> `reused` (16-bit code slices + patches), `src`
BASE = '/workspace/work/ss3d-bakeoff/f_free16'
G16 = '/workspace/work/aistudio-games/games/shell-shock-16bit/'
OUT = f'{BASE}/site_f'
parts = [open(f'{BASE}/src/{n}.js').read() for n in ['head', 'city', 'skyline', 'actors', 'game', 'hud']]
parts.insert(1, open(f'{BASE}/src16/pixel.js').read())
js = parts[0] + '\n' + reused + '\n' + '\n'.join(parts[1:]) + '\n  function stageMove(p) { move3D(p); }\n  function drawTurtle() {}\n  function tintSheet() { return null; }\n  const silCtx = null, imgOk = artOk;\n})();\n'
js = js.replace('"__MODE__"', '"free"')
JSP = [  # F patches to the copied 3D code (each must hit exactly)
    ('free: "A: FREE CITY"', 'free: "F: FREE CITY 16-BIT"'),
    ('"v8_lenny.webp", "v8_rafe.webp", "v8_miko.webp", "v8_donny.webp", "v8_thug.webp", ', ''),
    ('ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(TITLE_LOGO3', 'ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(TITLE_LOGO3'),
    ('rect(-40, -15, 80, 30, "#000"); rect(-38, -13, 76, 26, "#e8302a"); rect(-38, -13, 76, 3, "#ff7a5a"); ptext("3D", 1, -9, 3, "#000"); ptext("3D", 0, -10, 3, "#fff");',
     'rect(-46, -12, 92, 24, "#000"); rect(-44, -10, 88, 20, "#e8302a"); rect(-44, -10, 88, 3, "#ff7a5a"); ptext("16-BIT", 1, -6, 2, "#000"); ptext("16-BIT", 0, -7, 2, "#fff");'),
    ('"RAISED 3/4 VIEW - IT NEVER TURNS (R: 90 DEG)"', '"16-BIT SPRITES - RAISED 3/4 VIEW (R: TURN 90 DEG)"'),
]
for a, b in JSP:
    n = js.count(a)
    if n != 1: sys.exit(f'js patch hits {n}: {a[:70]}')
    js = js.replace(a, b)
# the sprite grid table (per sheet: block size + per-blob grid phase, from tools/phase.py)
js = js.replace('const PXGRID = null;', 'const PXGRID = ' + open(f'{BASE}/pxgrid.json').read() + ';', 1)
os.makedirs(OUT + '/levels', exist_ok=True); os.makedirs(OUT + '/px', exist_ok=True); os.makedirs(OUT + '/tex', exist_ok=True)
for a in ['atlas_lenny.webp', 'atlas_rafe.webp', 'atlas_miko.webp', 'atlas_donny.webp', 'atlas_ninja.webp', 'atlas_ramrod.webp', 'atlas_zap.webp', 'atlas_scorcher.webp',
          'shared_sprites.webp', 'sp_lenny.webp', 'sp_rafe.webp', 'sp_miko.webp', 'sp_donny.webp', 'hud_portraits.webp', 'drill.webp', 'stick.webp', 'title_logo.webp',
          'title_bg.jpg', 'cabinet_special.webp', 'icon180.png', 'icon192.png', 'icon512.png', 'levels/enemies_street.webp']:
    shutil.copyfile(G16 + a, OUT + '/' + a)   # the ORIGINAL 16-bit art
shutil.copyfile(f'{BASE}/site_orig/three.module.min.js', OUT + '/three.module.min.js')
open(OUT + '/game.js', 'w').write(js)
LINKS = [('A FREE', 'shellshock-free-city', 'Free City'), ('B PAPER', 'shellshock-paper-city', 'Paper City'), ('C GTA', 'shellshock-gta-city', 'GTA City'),
         ('D SKYLINE', 'shellshock-skyline-city', 'Skyline City'), ('E GTA 32', 'shellshock-gta32-city', 'GTA City 32-bit'), ('F FREE 16', 'shellshock-free16-city', 'Free City 16-bit')]
CSS = """  #screen canvas#gl { z-index: 0; image-rendering: pixelated; image-rendering: crisp-edges; }
  #screen canvas#game { z-index: 1; background: transparent; }
  #screen canvas#bloom { display: none !important; }
  html, body { max-width: 100vw; overflow-x: hidden; }
  #proto { position: fixed; z-index: 60; left: calc(env(safe-area-inset-left, 0px) + 4px); top: calc(env(safe-area-inset-top, 0px) + 4px); display: flex; flex-direction: column; gap: 3px; align-items: stretch; width: 126px; box-sizing: border-box;
    padding: 4px; border-radius: 8px; background: rgba(8,8,14,.8); border: 1px solid rgba(255,210,60,.55); font: 700 10px/1 system-ui, -apple-system, sans-serif; color: #ffd23c; white-space: nowrap; letter-spacing: .5px; }
  #proto b { padding: 1px 2px 2px; text-align: center; font-size: 9px; }
  #proto a { color: #c8ccd6; text-decoration: none; padding: 3px 4px; border-radius: 6px; text-align: center; border: 1px solid rgba(255,255,255,.22); touch-action: manipulation; }
  #proto a.on { color: #000; background: #ffd23c; border-color: #ffd23c; }
</style>"""
top = '\n'.join(src[:99])
top = top.replace('<title>SHELL SHOCK 16-BIT</title>', '<title>SHELL SHOCK 3D - F: FREE CITY 16-BIT</title>').replace('content="Shell Shock Live"', 'content="SS Free City 16"')
top = top.replace('<canvas id="game" width="384" height="224"></canvas>', '<canvas id="gl" width="384" height="224"></canvas><canvas id="game" width="384" height="224"></canvas>')
top = top.replace('<a id="trailerbtn" href="https://shellshock16bit-trailer.surge.sh/" aria-label="Watch the trailer">&#9654; WATCH TRAILER</a>\n', '')
links = ''.join(f'<a href="https://{u}.surge.sh/" title="{t}"{" class=on" if l.startswith("F") else ""}>{l}</a>' for l, u, t in LINKS)
top = top.replace('<div id="cab">', f'<div id="proto"><b>F &middot; Free City 16-bit</b>{links}</div>\n<div id="cab">')
top = top.replace('</style>', CSS, 1)
assert '<canvas id="gl"' in top and 'id="proto"' in top and 'id="trailerbtn"' not in top
hidden = '<div hidden aria-hidden="true">\n' + '\n'.join(f'  <img id="atlas-{n}" src="atlas_{n}.webp" alt="" />' for n in ['lenny', 'rafe', 'miko', 'donny']) + '\n</div>\n'
fs = '\n'.join(src[6025:6081]); assert fs.strip().startswith('// ---------- Full-screen toggle')
html = top + '\n' + hidden + '<script type="module" src="game.js"></script>\n<script>\n' + fs + '\n</script>\n</body>\n</html>\n'
open(OUT + '/index.html', 'w').write(html)
open(OUT + '/manifest.webmanifest', 'w').write('{"name":"Shell Shock Free City 16-bit","short_name":"SS Free 16","start_url":"./","scope":"./","display":"fullscreen","orientation":"any","background_color":"#000000","theme_color":"#000000","icons":[{"src":"icon192.png","sizes":"192x192","type":"image/png"},{"src":"icon512.png","sizes":"512x512","type":"image/png"}]}')
open(OUT + '/CNAME', 'w').write('shellshock-free16-city.surge.sh')
print('built', len(js), len(html))
