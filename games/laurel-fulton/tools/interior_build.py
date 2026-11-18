#!/usr/bin/env python3
"""interior_build.py — task L7: an INTERIOR from a statement, the way the factory states a car -> data/interiors/<id>.json
  python3 tools/interior_build.py <person-id> split-foyer [up <furn,...>] [down <furn,...>] [mantle-beers N] [dogs N] [mom "<Name>"]
  (also a factory statement:  interior brad split-foyer up couch,cooler,tv,fridge,rug,picture,lamp,plant down weights,fireplace,couch,rug,picture,lamp mantle-beers 6 dogs 2 mom "Teter" — the polished Brad statement; spec_l7 proves it reproduces data/interiors/brad.json byte-for-byte)

THE KIT (metres; x runs front door -> back wall, z up from the yard grade; the game draws it as a SIDE CUTAWAY):
  floors   walkable spans {id, z, x0, x1}            links  stairs {id, a, ax, b, bx} joining floor a at ax to floor b at bx
  rooms    {floor, x0, x1, name, wall, floorc}       props  {kind, floor, x, ...} — the furniture, in a fixed library:
           couch tv cooler fridge weights fireplace (+ mantle beers) recliner (mom's chair) table lamp
           decor (Moth's polish pass, Nov 17): rug picture lamp plant — placed by the PLACE map below, drawn by the
           renderer; they carry no spots, they make the room read as lived-in. THE STANDARD for how a cutaway must
           look and feel lives in tools/INTERIOR-SPEC.md — camera, light, labels, life. Read it before touching
           either this file or the renderer; a house that follows the spec comes out polished in ONE build.
  spots    what ACTION does where: GRAB BEER (cooler / fridge / mantle) and EXIT (the front door); DRINK is anywhere once
           you hold one; PAT is next to a dog. house type 'split-foyer' = true to the type: the front door opens onto a mid
           landing, a half-flight UP to the main level, a half-flight DOWN to the half-sunk lower level.
  teter / dogs / cpuIdle   the residents: mom fixed in her recliner upstairs, N golden retrievers, and where CPU-you idles.
  Nov 18 (L7 remainder): + props computer (screen: eDonkey) cdwriter bed speaker; house type 'two-story-entry' (Rigg's: a big
           TWO-STORY ENTRYWAY, a straight flight up to a hall + Brian's bedroom door, a living room with his dad's recliner, a
           door down to the basement = his computer + CD writer) takes  upper <furn,...> dad "<Name>" son "<Name>"; its flights
           are `press` links (stairs overlap a floor: push UP/DOWN at the foot to take them). `dad`+`son` = the house BEAT: you
           walk in, the dad yells for the son, the son comes down the stairs.
A new house type is a new layout function below; new furniture is a new kind in src/lf_interior_render.js."""
import os, sys, json, shlex
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import world_cfg
ROOT = world_cfg.root()

MOM_LINES = ['Hi guys, what are you getting into today?....', 'You are all alcoholics.']     # Brad's mom (owner, Nov 18 HOUSE BEATS), said in two beats

def split_foyer(pid, up, down, beers, dogs, mom, o=None):
    W = 12.0
    k = {'id': pid, 'type': 'split-foyer', 'width': W, 'grade': 0.0, 'ceiling': 2.5,
         'floors': [{'id': 'landing', 'z': 0.3, 'x0': 0.0, 'x1': 1.7}, {'id': 'main', 'z': 1.55, 'x0': 3.6, 'x1': W}, {'id': 'lower', 'z': -0.95, 'x0': 3.6, 'x1': W}],
         'links': [{'id': 'up', 'a': 'landing', 'ax': 1.7, 'b': 'main', 'bx': 3.6}, {'id': 'down', 'a': 'landing', 'ax': 1.7, 'b': 'lower', 'bx': 3.6}],
         'door': {'floor': 'landing', 'x': 0.35},
         'rooms': [{'floor': 'main', 'x0': 3.6, 'x1': 9.2, 'name': 'upstairs living room', 'wall': '#d9c79c', 'floorc': '#9c6b44'},
                   {'floor': 'main', 'x0': 9.2, 'x1': W, 'name': 'kitchen', 'wall': '#e6dcb8', 'floorc': '#c9b99a'},
                   {'floor': 'lower', 'x0': 3.6, 'x1': W, 'name': 'downstairs living room', 'wall': '#8a6446', 'floorc': '#6e5a4c'}],
         'props': [], 'spots': [{'act': 'EXIT', 'floor': 'landing', 'x': 0.35}]}
    # placement is BY KIND, not by statement order (polish pass): a statement lists what a room HAS; the kit decides
    # where it sits, the way a room would actually be arranged. Unknown kinds fall back to the slot row.
    PLACE = {'main': {'recliner': 4.3, 'plant': 3.95, 'couch': 6.6, 'rug': 6.6, 'picture': 6.4, 'cooler': 8.3, 'lamp': 9.05, 'tv': 10.2, 'fridge': 11.3, 'table': 7.6},
             'lower': {'weights': 5.0, 'picture': 5.2, 'computer': 6.95, 'fireplace': 8.6, 'rug': 9.6, 'couch': 10.8, 'lamp': 11.65, 'plant': 4.1, 'table': 7.2}}
    lay = {'main': [4.3, 6.6, 8.3, 10.2, 11.3], 'lower': [5.0, 8.6, 10.8, 6.9, 11.5]}
    if mom: up = ['recliner'] + [u for u in up if u != 'recliner']
    for fl, items in (('main', up), ('lower', down)):
        for i, kind in enumerate(items):
            x = PLACE[fl].get(kind, lay[fl][i] if i < len(lay[fl]) else 4 + i * 1.5)
            p = {'kind': kind, 'floor': fl, 'x': x}
            if kind == 'fireplace': p['mantle'] = beers
            if kind == 'computer': p['screen'] = 'eDonkey'                      # Brad's basement computer (owner, Nov 18): the screen says eDonkey
            k['props'].append(p)
            if kind in ('cooler', 'fridge'): k['spots'].append({'act': 'GRAB BEER', 'floor': fl, 'x': x, 'src': kind})
            if kind == 'fireplace': k['spots'].append({'act': 'GRAB BEER', 'floor': fl, 'x': x, 'src': 'mantle'})
    if mom: k['teter'] = {'name': mom, 'floor': 'main', 'x': next(p['x'] for p in k['props'] if p['kind'] == 'recliner'), 'lines': MOM_LINES}
    k['dogs'] = dogs
    fp = next((p for p in k['props'] if p['kind'] == 'fireplace'), None)
    k['cpuIdle'] = {'floor': fp['floor'], 'x': fp['x'] + 1.2} if fp else {'floor': 'main', 'x': 6.6}   # CPU-you idles with a beer by the fire
    return k

def two_story_entry(pid, up, down, beers, dogs, mom, o):
    """Rigg's house (owner memory, Nov 18): the front door opens into a big TWO-STORY ENTRYWAY; a straight flight rises along it
    to the upstairs hall, and from the entry you see Brian's bedroom door at the end of that hall. Living room beside the entry
    (his dad's recliner). A door at the back of it goes DOWN to the basement = Brian's territory: his computer + a CD writer."""
    W = 13.0; Z0, Z1, ZB = 0.2, 3.0, -2.4
    k = {'id': pid, 'type': 'two-story-entry', 'width': W, 'grade': 0.0, 'ceiling': 2.5,
         'floors': [{'id': 'main', 'z': Z0, 'x0': 0.0, 'x1': W}, {'id': 'upper', 'z': Z1, 'x0': 5.4, 'x1': W}, {'id': 'lower', 'z': ZB, 'x0': 3.4, 'x1': W}],
         'links': [{'id': 'up', 'a': 'main', 'ax': 1.2, 'b': 'upper', 'bx': 5.4, 'press': True}, {'id': 'down', 'a': 'main', 'ax': 12.4, 'b': 'lower', 'bx': 9.0, 'press': True}],
         'door': {'floor': 'main', 'x': 0.35},
         'rooms': [{'floor': 'main', 'x0': 0.0, 'x1': 5.4, 'name': 'two-story entryway', 'wall': '#e3d6b8', 'floorc': '#b9a27a', 'h': Z1 + 2.5 - Z0},
                   {'floor': 'main', 'x0': 5.4, 'x1': 9.4, 'name': 'living room', 'wall': '#d6c39a', 'floorc': '#9c6b44'},
                   {'floor': 'main', 'x0': 9.4, 'x1': W, 'name': 'kitchen', 'wall': '#e6dcb8', 'floorc': '#c9b99a'},
                   {'floor': 'upper', 'x0': 5.4, 'x1': 9.0, 'name': 'upstairs hall', 'wall': '#e6dcc4', 'floorc': '#a8845a'},
                   {'floor': 'upper', 'x0': 9.0, 'x1': W, 'name': "Brian's bedroom", 'wall': '#5f6f8c', 'floorc': '#6e5a4c'},
                   {'floor': 'lower', 'x0': 3.4, 'x1': W, 'name': "Brian's basement", 'wall': '#7b6a58', 'floorc': '#5e5448'}],
         'props': [], 'spots': [{'act': 'EXIT', 'floor': 'main', 'x': 0.35}]}
    PLACE = {'main': {'chandelier': 2.9, 'picture': 3.6, 'plant': 4.9, 'tv': 6.1, 'couch': 7.1, 'rug': 7.1, 'lamp': 5.8, 'recliner': 8.95, 'fridge': 11.0, 'table': 10.2, 'cooler': 10.0},
             'upper': {'door': 9.0, 'picture': 6.6, 'plant': 5.9, 'lamp': 8.4, 'speaker': 10.0, 'bed': 12.0, 'table': 10.9},
             'lower': {'cooler': 3.9, 'computer': 5.3, 'cdwriter': 6.7, 'rug': 7.7, 'lamp': 8.2, 'couch': 7.9, 'picture': 4.4}}
    upper = o('upper', '').split(',') if o('upper') else []
    if o('dad'): up = ['recliner'] + [u for u in up if u != 'recliner']
    for fl, items in (('main', up), ('upper', upper), ('lower', down)):
        for i, kind in enumerate(items):
            x = PLACE[fl].get(kind, 4 + i * 1.5)
            p = {'kind': kind, 'floor': fl, 'x': x}
            if kind == 'computer': p['screen'] = 'eDonkey'
            k['props'].append(p)
            if kind in ('cooler', 'fridge'): k['spots'].append({'act': 'GRAB BEER', 'floor': fl, 'x': x, 'src': kind})
    k['props'].append({'kind': 'door', 'floor': 'upper', 'x': 9.0, 'label': 'BRIAN'})      # Brian's bedroom door, in plain sight from the entry
    k['props'].append({'kind': 'cellardoor', 'floor': 'main', 'x': 12.4})                      # the door down to the basement
    k['dogs'] = dogs
    rec = next((p for p in k['props'] if p['kind'] == 'recliner'), None)
    if o('dad') and rec: k['dad'] = {'name': o('dad'), 'floor': 'main', 'x': rec['x'], 'yell': 'Brrrrrriiiiiiaaaaannnn'}
    if o('son'): k['son'] = {'name': o('son'), 'floor': 'upper', 'x': 11.2}
    cd = next((p for p in k['props'] if p['kind'] == 'computer'), None)
    k['cpuIdle'] = {'floor': 'lower', 'x': (cd['x'] - 1.15) if cd else 6.0}                 # CPU-Brian idles at his computer
    return k

TYPES = {'split-foyer': split_foyer, 'two-story-entry': two_story_entry}
def build(t):
    pid, typ = t[0], t[1]
    opt = lambda key, d=None: t[t.index(key) + 1] if key in t else d
    k = TYPES[typ](pid, (opt('up', '') or '').split(',') if opt('up') else [], (opt('down', '') or '').split(',') if opt('down') else [],
                   int(opt('mantle-beers', 0)), int(opt('dogs', 0)), opt('mom'), opt)
    os.makedirs(os.path.join(ROOT, 'data', 'interiors'), exist_ok=True)
    json.dump(k, open(os.path.join(ROOT, 'data', 'interiors', pid + '.json'), 'w'), indent=1)
    ix = os.path.join(ROOT, 'data', 'interiors', 'index.json'); ids = json.load(open(ix)) if os.path.exists(ix) else []
    if pid not in ids: json.dump(sorted(ids + [pid]), open(ix, 'w'))     # which crew houses have a walk-in interior (the game reads this)
    return k
if __name__ == '__main__':
    k = build(shlex.split(' '.join(shlex.quote(a) for a in sys.argv[1:])))
    print(f"interior {k['id']}: {k['type']}, {len(k['floors'])} floors, {len(k['props'])} props ({', '.join(p['kind'] for p in k['props'])}), "
          f"{k['dogs']} dogs{', ' + k['teter']['name'] + ' in her chair' if 'teter' in k else ''}")
