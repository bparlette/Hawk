#!/usr/bin/env python3
# tools/stage.py [thumb_src.png] -> pub/index.html (game inlined, imports ./three.module.min.js, panel art inlined as data URIs),
# pub/three.module.min.js, pub/thumb.webp, pub/entry.json
import os, sys, json, shutil, time, base64
from PIL import Image
R = '/workspace/work/bmore-parkour'; S = R + '/site'; P = R + '/pub'
os.makedirs(P, exist_ok=True)
html = open(S + '/index.html', encoding='utf-8').read(); js = open(S + '/game.js', encoding='utf-8').read()
assert '</script' not in js.lower(), 'game.js contains </script'
tag = '<script type="module" src="game.js"></script>'
assert tag in html
# the arcade panel art: inline both webps so the published page is index.html + three.module.min.js only
for f in ('panel.webp', 'stick.webp'):
    uri = 'data:image/webp;base64,' + base64.b64encode(open(S + '/' + f, 'rb').read()).decode()
    assert f in html, f
    html = html.replace('url(' + f + ')', 'url(' + uri + ')').replace('src="' + f + '"', 'src="' + uri + '"')
out = html.replace(tag, '<script type="module">\n' + js + '\n</script>')
open(P + '/index.html', 'w', encoding='utf-8').write(out)
shutil.copy2(S + '/three.module.min.js', P + '/three.module.min.js')
if len(sys.argv) > 1:
    im = Image.open(sys.argv[1]).convert('RGB'); w, h = im.size; th = round(w * 10 / 16)
    if th <= h: im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
    im.resize((640, 400), Image.LANCZOS).save(P + '/thumb.webp', 'WEBP', quality=82)
entry = {"id": "toad-city-rooftops", "title": "Toad City Rooftops", "category": "Originals",
         "keys": {"up": "KeyW", "down": "KeyS", "left": "KeyA", "right": "KeyD", "attack": "ShiftLeft", "jump": "Space", "special": "KeyE", "start": "Enter", "select": "KeyP"},
         "labels": {"attack": "SHIFT · SLIDE", "jump": "SPACE · JUMP", "special": "E · CAM", "start": "START", "select": "PAUSE"},
         "extras": [{"label": "MUSIC", "key": "KeyM"}], "autostart": [], "orientation": "any",
         "note": "Rooftop parkour on the Toad City Baltimore engine (same city kit, rowhouse roofs, HD landmarks with real signage, toon/ink shading): 3 courses, FOXTROT police drone chaser, medals. Source /workspace/work/bmore-parkour.",
         "path": "g/toad-city-rooftops/index.html", "thumb": "thumbs/toad-city-rooftops.webp?v=%d" % int(time.time())}
json.dump(entry, open(P + '/entry.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('staged', os.path.getsize(P + '/index.html'), 'bytes; thumb', os.path.exists(P + '/thumb.webp'))
