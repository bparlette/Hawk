#!/usr/bin/env python3
# tools/stage.py <thumb_src.png>  -> pub/index.html (game inlined, imports ./three.module.min.js), pub/three.module.min.js, pub/thumb.webp, pub/entry.json
import os, sys, json, shutil, time
from PIL import Image
R = '/workspace/work/bmore-drone'; S = R + '/site'; P = R + '/pub'
os.makedirs(P, exist_ok=True)
html = open(S + '/index.html', encoding='utf-8').read(); js = open(S + '/game.js', encoding='utf-8').read()
assert '</script' not in js.lower(), 'game.js contains </script'
tag = '<script type="module" src="game.js"></script>'
assert tag in html
out = html.replace(tag, '<script type="module">\n' + js + '\n</script>')
open(P + '/index.html', 'w', encoding='utf-8').write(out)
shutil.copy2(S + '/three.module.min.js', P + '/three.module.min.js')
if len(sys.argv) > 1:
    im = Image.open(sys.argv[1]).convert('RGB'); w, h = im.size; th = round(w * 9 / 16)
    if th <= h: im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
    im.resize((640, 360), Image.LANCZOS).save(P + '/thumb.webp', 'WEBP', quality=82)
entry = {"id": "toad-city-drone", "title": "Toad City Drone Racer", "category": "Originals",
         "keys": {"up": "KeyW", "down": "KeyS", "left": "KeyA", "right": "KeyD", "attack": "ShiftLeft", "jump": "Space", "special": "KeyV", "start": "Enter"},
         "labels": {"attack": "SHIFT · BOOST", "jump": "SPACE · CLIMB", "special": "V · CAM"},
         "extras": [{"label": "PAUSE", "key": "KeyP"}, {"label": "MUTE", "key": "KeyM"}], "autostart": [], "orientation": "any",
         "note": "FPV drone race around the Inner Harbor on the Toad City Baltimore engine (same city kit, HD landmarks, toon/ink shading). Source /workspace/work/bmore-drone.",
         "path": "g/toad-city-drone/index.html", "thumb": "thumbs/toad-city-drone.webp?v=%d" % int(time.time())}
json.dump(entry, open(P + '/entry.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('staged', os.path.getsize(P + '/index.html'), 'bytes; thumb', os.path.exists(P + '/thumb.webp'))
