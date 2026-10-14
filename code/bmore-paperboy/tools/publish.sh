#!/usr/bin/env bash
# Additive publish of Toad City Paperboy to bparlette/Hawk main: brad-demos/g/toad-city-paperboy/ + thumbs/toad-city-paperboy.webp + one games.json entry.
# Runs under the demos edit lock; re-reads current main + games.json before writing; touches only this game's files.
set -u
cd /workspace/work/bmore-paperboy || exit 1
ID=toad-city-paperboy
exec 9>/workspace/work/demos/.edit.lock; flock -w 600 9 || { echo LOCK_FAIL; exit 1; }
cd hawk
git sparse-checkout set --no-cone /brad-demos/games.json "/brad-demos/g/$ID/" "/brad-demos/thumbs/$ID.webp"
for try in 1 2 3 4 5 6; do
  timeout 100 git fetch -q --depth 1 origin main || { echo "fetch failed ($try)"; sleep 15; continue; }
  git checkout -q -B main FETCH_HEAD && git reset -q --hard FETCH_HEAD
  python3 - "$ID" <<'PY'
import json, sys, shutil, os, time
gid = sys.argv[1]
site = '/workspace/work/bmore-paperboy/site'
d = f'brad-demos/g/{gid}'
if os.path.isdir(d): shutil.rmtree(d)
os.makedirs(d)
for f in ['index.html', 'game.js', 'three.module.min.js']: shutil.copy2(os.path.join(site, f), os.path.join(d, f))
html = open(os.path.join(d, 'index.html'), encoding='utf-8').read()
if 'demo-embed.js' not in html:
    html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<script src="../../demo-embed.js"></script>', 1)
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(html)
os.makedirs('brad-demos/thumbs', exist_ok=True)
shutil.copy2('/workspace/work/bmore-paperboy/shorts/thumb.webp', f'brad-demos/thumbs/{gid}.webp')
p = 'brad-demos/games.json'; J = json.load(open(p, encoding='utf-8'))
entry = {"id": gid, "title": "Toad City Paperboy", "category": "Originals",
  "keys": {"up": "KeyW", "down": "KeyS", "left": "KeyA", "right": "KeyD", "attack": "KeyJ", "start": "Enter"},
  "labels": {"attack": "J · THROW"},
  "extras": [{"label": "PAUSE", "key": "KeyP"}, {"label": "MUTE", "key": "KeyM"}],
  "autostart": [], "orientation": "any",
  "note": "Paperboy-style route on the Toad City Baltimore engine (same rowhouse kit, props, cars, Harold/Mavis rigs, Fells Point + WTC landmarks, toon/ink shading). Source /workspace/work/bmore-paperboy.",
  "path": f"g/{gid}/index.html", "thumb": f"thumbs/{gid}.webp?v={int(time.time())}"}
G = [g for g in J['games'] if g['id'] != gid]
at = next((i + 1 for i, g in enumerate(G) if g['id'] in ('toad-city-baltimore', 'toad-street-32')), len(G))
G.insert(at, entry); J['games'] = G
if entry['category'] not in J['categories']: J['categories'].append(entry['category'])
json.dump(J, open(p, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('entry at', at, 'of', len(G))
PY
  git add --sparse -A "brad-demos/g/$ID" "brad-demos/thumbs/$ID.webp" brad-demos/games.json
  git status --short | head
  git -c user.name=Hark -c user.email=hark@hark.local commit -qm "Brad's Demos: add Toad City Paperboy (Toad City Baltimore engine, Paperboy-style route)" || { echo NOTHING_TO_COMMIT; exit 0; }
  timeout 100 git push -q origin HEAD:refs/heads/main && { echo "HAWK_PUSHED $(git rev-parse --short HEAD)"; exit 0; }
  echo "push failed ($try)"; sleep 15
done
echo PUSH_FAIL; exit 1
