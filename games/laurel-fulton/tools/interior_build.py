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
  Nov 18 (the Floyds): split-foyer takes  mom-lines "<l1>|<l2>"  (a mom with her OWN line, not Brad's mom's),  dad "<Name>"
           (a dad DOWNSTAIRS GAMING by the fireplace who has NO line in canon: he rides the engine's silent-resident slot —
           the `son` key — because the engine's `dad` slot is hard-wired to Rigg's yell beat and this dad never speaks; he
           stands at the downstairs TV, by the fire),  party 1  (the night party's indoor room is the lower level, M-C), and
           house <id>  (a SHARED house — the Floyds is Clayton AND Zack's: the kit is built once per brother so the loader's
           person-keyed entry works for both, and every copy carries the HOUSE id, so figures keyed off the kit id behave
           the same whoever you play).
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
    if mom and o and o('mom-lines'): k['teter']['lines'] = o('mom-lines').split('|')      # the Floyds' mom has her own line (the butter churner)
    if o and o('dad'):                                                                    # the Floyds' dad: downstairs gaming by the fireplace, silent (see header)
        tv = next((p for p in k['props'] if p['kind'] == 'tv' and p['floor'] == 'lower'), None)
        k['son'] = {'name': o('dad'), 'floor': 'lower', 'x': round((tv['x'] + 0.8) if tv else (fp['x'] - 0.9), 2)}
    if o and o('party'):                                                                  # the night party's indoor guests belong in the lower level (M-C)
        lf = next(f for f in k['floors'] if f['id'] == 'lower'); k['party'] = {'floor': 'lower', 'x0': lf['x0'] + 0.3, 'x1': lf['x1'] - 0.3}
    if o and o('house'): k['id'] = o('house')                                              # a shared house: every person-keyed copy carries the house id
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

def three_level(pid, up, down, beers, dogs, mom, o):
    """Kosack's house (owner design, Nov 18 — tasking L14): a THREE-LEVEL cutaway, a basement plus the big top two floors.
    BASEMENT = an ARCADE + a FULL BAR + a GIANT HOLE IN THE WALL (it is also the night party's indoor room: kit `party`).
    BARK BEAT on entry, from the kit's generic `barks` list (the same format any later house can use): Kosack yells from the TOP
    STAIR HALLWAY "Chinese food is here." -> Rigg "watch wang wash wang." -> Kosack "shut up."
    FRAMING (the viral-short audit, Nov 18: far-end speakers fell out of the 540x960 portrait frame): every speaker stands within
    ~4 m of the front door, stacked over the stair column, so all three bubbles stay in frame while you stand in the doorway."""
    W = 12.0; Z0, Z1, ZB = 0.2, 3.0, -2.6
    k = {'id': pid, 'type': 'three-level', 'width': W, 'grade': 0.0, 'ceiling': 2.5,
         'floors': [{'id': 'main', 'z': Z0, 'x0': 0.0, 'x1': W}, {'id': 'upper', 'z': Z1, 'x0': 3.4, 'x1': W}, {'id': 'lower', 'z': ZB, 'x0': 0.0, 'x1': W}],
         'links': [{'id': 'up', 'a': 'main', 'ax': 0.9, 'b': 'upper', 'bx': 3.4, 'press': True}, {'id': 'down', 'a': 'main', 'ax': 5.4, 'b': 'lower', 'bx': 2.6, 'press': True}],
         'door': {'floor': 'main', 'x': 0.35},
         'rooms': [{'floor': 'main', 'x0': 0.0, 'x1': 6.6, 'name': 'living room', 'wall': '#dccaa2', 'floorc': '#9c6b44'},
                   {'floor': 'main', 'x0': 6.6, 'x1': W, 'name': 'kitchen', 'wall': '#e6dcb8', 'floorc': '#c9b99a'},
                   {'floor': 'upper', 'x0': 3.4, 'x1': 6.4, 'name': 'top stair hallway', 'wall': '#e6dcc4', 'floorc': '#a8845a'},
                   {'floor': 'upper', 'x0': 6.4, 'x1': W, 'name': "Kosack's room", 'wall': '#6a7c5c', 'floorc': '#6e5a4c'},
                   {'floor': 'lower', 'x0': 0.0, 'x1': 6.0, 'name': 'the arcade', 'wall': '#2e2848', 'floorc': '#3a3046'},
                   {'floor': 'lower', 'x0': 6.0, 'x1': W, 'name': 'the bar', 'wall': '#5a3a2a', 'floorc': '#4a3a30'}],
         'props': [], 'spots': [{'act': 'EXIT', 'floor': 'main', 'x': 0.35}]}
    PLACE = {'main': {'couch': 3.0, 'tv': 4.6, 'rug': 3.0, 'lamp': 1.9, 'plant': 6.2, 'fridge': 11.2, 'table': 9.0, 'cooler': 7.4, 'picture': 2.6},
             'upper': {'picture': 4.6, 'plant': 6.0, 'bed': 10.8, 'speaker': 8.0, 'lamp': 9.4},
             'lower': {'arcade': 1.2, 'bar': 9.2, 'hole': 7.0, 'speaker': 11.4, 'couch': 4.4}}
    upper = o('upper', '').split(',') if o('upper') else []
    for fl, items in (('main', up), ('upper', upper), ('lower', down)):
        for i, kind in enumerate(items):
            x = PLACE[fl].get(kind, 4 + i * 1.5)
            p = {'kind': kind, 'floor': fl, 'x': x}
            if kind == 'arcade': p['cabinets'] = ['GALAGA', 'MORTAL KOMBAT', 'NBA JAM']      # a row of three cabinets, screens lit
            if kind == 'bar': p['beers'] = beers or 8                                         # a full bar: counter, stools, back shelf, taps
            k['props'].append(p)
            if kind in ('cooler', 'fridge'): k['spots'].append({'act': 'GRAB BEER', 'floor': fl, 'x': x, 'src': kind})
            if kind == 'bar': k['spots'].append({'act': 'GRAB BEER', 'floor': fl, 'x': x, 'src': 'bar'})
            if kind == 'arcade': k['spots'].append({'act': 'PLAY', 'floor': fl, 'x': x + 0.9, 'src': 'arcade'})
    k['dogs'] = dogs
    k['barks'] = [{'who': pid, 'name': o('host', 'Kosack'), 'floor': 'upper', 'x': 3.9, 'text': 'Chinese food is here.', 'at': 1.0},
                  {'who': 'rigg', 'name': 'Rigg', 'floor': 'lower', 'x': 3.2, 'text': 'watch wang wash wang.', 'at': 3.3},
                  {'who': pid, 'name': o('host', 'Kosack'), 'floor': 'upper', 'x': 3.9, 'text': 'shut up.', 'at': 5.4}]
    k['party'] = {'floor': 'lower', 'x0': 0.4, 'x1': W - 0.4}                                  # the night party's indoor guests stand here (M-C)
    k['cpuIdle'] = {'floor': 'lower', 'x': 8.4}                                               # CPU-Kosack: at his own bar
    return k

TYPES = {'split-foyer': split_foyer, 'two-story-entry': two_story_entry, 'three-level': three_level}
def build(t):
    pid, typ = t[0], t[1]
    if typ in ('store', 'restaurant'):                    # L12/L13 public places (tools/place_interior_build.py): not a crew house, so not in index.json — data/places.json lists them
        import place_interior_build; k = place_interior_build.TYPES[typ](pid)
        os.makedirs(os.path.join(ROOT, 'data', 'interiors'), exist_ok=True); json.dump(k, open(os.path.join(ROOT, 'data', 'interiors', pid + '.json'), 'w'), indent=1); return k
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
