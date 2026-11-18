#!/usr/bin/env python3
"""interior_build.py — task L7: an INTERIOR from a statement, the way the factory states a car -> data/interiors/<id>.json
  python3 tools/interior_build.py <person-id> split-foyer [up <furn,...>] [down <furn,...>] [mantle-beers N] [dogs N] [mom "<Name>"]
  (also a factory statement:  interior brad split-foyer up couch,tv,cooler down weights,fireplace,couch mantle-beers 6 dogs 2 mom "Teter")

THE KIT (metres; x runs front door -> back wall, z up from the yard grade; the game draws it as a SIDE CUTAWAY):
  floors   walkable spans {id, z, x0, x1}            links  stairs {id, a, ax, b, bx} joining floor a at ax to floor b at bx
  rooms    {floor, x0, x1, name, wall, floorc}       props  {kind, floor, x, ...} — the furniture, in a fixed library:
           couch tv cooler fridge weights fireplace (+ mantle beers) recliner (mom's chair) table lamp
  spots    what ACTION does where: GRAB BEER (cooler / fridge / mantle) and EXIT (the front door); DRINK is anywhere once
           you hold one; PAT is next to a dog. house type 'split-foyer' = true to the type: the front door opens onto a mid
           landing, a half-flight UP to the main level, a half-flight DOWN to the half-sunk lower level.
  teter / dogs / cpuIdle   the residents: mom fixed in her recliner upstairs, N golden retrievers, and where CPU-you idles.
A new house type is a new layout function below; new furniture is a new kind in src/lf_interior_render.js."""
import os, sys, json, shlex
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import world_cfg
ROOT = world_cfg.root()

def split_foyer(pid, up, down, beers, dogs, mom):
    W = 12.0
    k = {'id': pid, 'type': 'split-foyer', 'width': W, 'grade': 0.0, 'ceiling': 2.5,
         'floors': [{'id': 'landing', 'z': 0.3, 'x0': 0.0, 'x1': 1.7}, {'id': 'main', 'z': 1.55, 'x0': 3.6, 'x1': W}, {'id': 'lower', 'z': -0.95, 'x0': 3.6, 'x1': W}],
         'links': [{'id': 'up', 'a': 'landing', 'ax': 1.7, 'b': 'main', 'bx': 3.6}, {'id': 'down', 'a': 'landing', 'ax': 1.7, 'b': 'lower', 'bx': 3.6}],
         'door': {'floor': 'landing', 'x': 0.35},
         'rooms': [{'floor': 'main', 'x0': 3.6, 'x1': 9.2, 'name': 'upstairs living room', 'wall': '#d9c79c', 'floorc': '#9c6b44'},
                   {'floor': 'main', 'x0': 9.2, 'x1': W, 'name': 'kitchen', 'wall': '#e6dcb8', 'floorc': '#c9b99a'},
                   {'floor': 'lower', 'x0': 3.6, 'x1': W, 'name': 'downstairs living room', 'wall': '#8a6446', 'floorc': '#6e5a4c'}],
         'props': [], 'spots': [{'act': 'EXIT', 'floor': 'landing', 'x': 0.35}]}
    lay = {'main': [4.3, 6.6, 8.3, 10.2, 11.3], 'lower': [5.0, 8.6, 10.8, 6.9, 11.5]}
    if mom: up = ['recliner'] + [u for u in up if u != 'recliner']
    for fl, items in (('main', up), ('lower', down)):
        for i, kind in enumerate(items):
            x = lay[fl][i] if i < len(lay[fl]) else 4 + i * 1.5
            p = {'kind': kind, 'floor': fl, 'x': x}
            if kind == 'fireplace': p['mantle'] = beers
            k['props'].append(p)
            if kind in ('cooler', 'fridge'): k['spots'].append({'act': 'GRAB BEER', 'floor': fl, 'x': x, 'src': kind})
            if kind == 'fireplace': k['spots'].append({'act': 'GRAB BEER', 'floor': fl, 'x': x, 'src': 'mantle'})
    if mom: k['teter'] = {'name': mom, 'floor': 'main', 'x': next(p['x'] for p in k['props'] if p['kind'] == 'recliner')}
    k['dogs'] = dogs
    fp = next((p for p in k['props'] if p['kind'] == 'fireplace'), None)
    k['cpuIdle'] = {'floor': fp['floor'], 'x': fp['x'] + 1.2} if fp else {'floor': 'main', 'x': 6.6}   # CPU-you idles with a beer by the fire
    return k

TYPES = {'split-foyer': split_foyer}
def build(t):
    pid, typ = t[0], t[1]
    opt = lambda key, d=None: t[t.index(key) + 1] if key in t else d
    k = TYPES[typ](pid, (opt('up', '') or '').split(',') if opt('up') else [], (opt('down', '') or '').split(',') if opt('down') else [],
                   int(opt('mantle-beers', 0)), int(opt('dogs', 0)), opt('mom'))
    os.makedirs(os.path.join(ROOT, 'data', 'interiors'), exist_ok=True)
    json.dump(k, open(os.path.join(ROOT, 'data', 'interiors', pid + '.json'), 'w'), indent=1)
    ix = os.path.join(ROOT, 'data', 'interiors', 'index.json'); ids = json.load(open(ix)) if os.path.exists(ix) else []
    if pid not in ids: json.dump(sorted(ids + [pid]), open(ix, 'w'))     # which crew houses have a walk-in interior (the game reads this)
    return k
if __name__ == '__main__':
    k = build(shlex.split(' '.join(shlex.quote(a) for a in sys.argv[1:])))
    print(f"interior {k['id']}: {k['type']}, {len(k['floors'])} floors, {len(k['props'])} props ({', '.join(p['kind'] for p in k['props'])}), "
          f"{k['dogs']} dogs{', ' + k['teter']['name'] + ' in her chair' if 'teter' in k else ''}")
