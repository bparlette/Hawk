#!/usr/bin/env python3
"""city_factory.py — task L4, THE CITY-GAME FACTORY: a few statements in, a playable city game out.

  python3 tools/factory/city_factory.py <spec.txt> <out-folder> [--bpy <python-with-bpy>] [--tiles <cache-dir>]
      (from games/laurel-fulton/;  out-folder is a NEW game folder, e.g. ../savage)

THE SPEC — one statement per line ('#' comments; quotes for names with spaces):
  city   "<name>" bbox <S> <W> <N> <E>                      the extent (OSM main API is fetched in tiles over it)
  poi    <id> "<OSM name>"                                   a point of interest, found by its real OSM name
  person <id> "<Name>" street "<Street>" [number <n>] car "<year make model colour [two-tone a/b]>" [traits <t> ...]
  person <id> "<Name>" at "<OSM name>" car "..." [traits ...]          someone who lives at a place, not a house
  house  "<House name>" <id> <id> ...                        people who share a house (one rally stop, one label)
  mission rally meet "<OSM name>"                            pick-your-player -> rally the crew -> meet there
traits: bass | underglow[:colour] | sputter | fire | headlights:<colour>
HOUSE NUMBERS are optional and PRIVATE: they go only to <out>/data/addresses.local.json (git-ignored everywhere) and are
used to put a house at its exact OSM address point; without a number a person sits at the middle address of their street.
Nothing the factory writes for the game or a page ever contains a house number.

THE PIPELINE (each step is an existing Laurel/Fulton tool, pointed at the new city by $LF_ROOT — Palm City reuse):
  1 parse  -> data/world.json (bbox), data/city.json (people, cars, POIs, houses, meet), data/cars.json (+ numbers, local)
  2 fetch  -> tools/osm_fetch.py     real OSM roads + places (tiles over the bbox, zero simplification)
  3 roster -> tools/roster_build.py  geocode every person (exact address point / street) + the meet-up
  4 graph  -> tools/osm_graph.py     the drivable graph + report, anchors = the POIs + every house
  5 areas  -> tools/osm_areas.py     real footprints, lots, green, the hero tier (homes + POIs)
  6 bumps  -> tools/bumps_build.py   speed bumps on residential streets
  6b roof  -> tools/roof_build.py    the meet-up building made climbable (task L5) — skipped if OSM has no outline for it
  7 fleet  -> tools/bake_fleet.py    each car statement -> the nearest real body in the library, its paint/two-tone/lamps,
                                     baked in the house style (Blender, Palm City's pipeline)  [needs --bpy]
  8 page   -> <out>/play.html (the Laurel/Fulton engine, this city's data) + <out>/FACTORY.md (what was built)
"""
import os, sys, json, re, shlex, subprocess, math

HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.dirname(HERE); LF = os.path.dirname(TOOLS)
COLOURS = {'white': '#f2f1ec', 'black': '#16161a', 'silver': '#b9bdc2', 'grey': '#7a7d84', 'gray': '#7a7d84', 'red': '#b81d24', 'maroon': '#5a1424',
           'burgundy': '#5a1424', 'blue': '#1f4fb0', 'navy': '#1c2a5a', 'teal': '#1f6f7c', 'teal-blue': '#1f6f7c', 'green': '#2f6b3a', 'yellow': '#e8c22a',
           'orange': '#d9702a', 'brown': '#5a3a24', 'tan': '#c7ad86', 'gold': '#c49a3a', 'purple': '#5a2a6e', 'pink': '#e07aa0', 'cream': '#efe0bd'}
HEADS = {'yellow': ('#ffd23a', (1.0, 0.82, 0.25)), 'blue': ('#7fb2ff', (0.45, 0.65, 1.0)), 'white': ('#f2efe0', (1.0, 0.9, 0.7))}
# make/model words -> the nearest real body in the fleet library (tools/bake_fleet.py CARS); then body-type fallbacks
BODY = [(r'camaro|firebird|trans ?am', 'camaro_brad'), (r'mustang', 'mustang_lamar'), (r'celica|supra|prelude|240sx|rx-?7', 'celica_rigg'),
        (r'cavalier|sunfire|corsica|tempo', 'cavalier_kosack'), (r'astro|safari|aerostar|caravan|voyager|minivan|van', 'astro_jimmy'),
        (r'camry|accord|corolla|civic|taurus|sedan|maxima', 'camry_jason'), (r'tracer|escort|323|hatch|golf|rabbit|civic hatch', 'tracer_zack'),
        (r'brougham|cadillac|town ?car|crown vic|grand marquis|caprice|deville|lincoln', 'brougham_grant'), (r'coupe', 'cavalier_black')]

def parse(path):
    city, pois, people, houses, meet = None, [], [], {}, None
    for raw in open(path):
        line = raw.split('#', 1)[0].strip()
        if not line: continue
        t = shlex.split(line); k = t[0]
        if k == 'city': city = {'name': t[1], 'bbox': [float(v) for v in t[t.index('bbox') + 1:t.index('bbox') + 5]]}
        elif k == 'poi': pois.append({'id': t[1], 'name': t[2]})
        elif k == 'person':
            p = {'id': t[1], 'name': t[2]}
            if 'street' in t: p['street'] = t[t.index('street') + 1]
            if 'at' in t: p['at'] = t[t.index('at') + 1]; p['street'] = None
            if 'number' in t: p['number'] = t[t.index('number') + 1]
            if 'car' in t: p['car_text'] = t[t.index('car') + 1]
            p['traits'] = t[t.index('traits') + 1:] if 'traits' in t else []
            people.append(p)
        elif k == 'house':
            for pid in t[2:]: houses[pid] = t[1]
        elif k == 'mission': meet = t[t.index('meet') + 1]
    assert city and people and meet, 'a spec needs city, at least one person and the mission meet'
    return city, pois, people, houses, meet

def car_from(text, traits, pid):
    s = text.lower(); base = next((b for pat, b in BODY if re.search(pat, s)), 'camry_jason')
    y = re.search(r'\b(19|20)\d\d\b', s)
    if base == 'cavalier_kosack' and y and int(y.group(0)) < 1995: base = 'cavalier_black'      # second-gen boxy vs the rounded '95+
    words = re.findall(r'[a-z\-]+', s)
    tt = re.search(r'two-tone\s+([a-z\-]+)\s*/\s*([a-z\-]+)', s)
    paint = COLOURS.get(tt.group(1)) if tt else next((COLOURS[w] for w in words if w in COLOURS), '#b9bdc2')
    spec = {'base': base, 'paint': paint}
    if tt: spec['paint2'] = COLOURS.get(tt.group(2), paint); spec['split'] = 0.5
    fx = []
    for tr in traits:
        if tr == 'bass': fx.append('bass')
        elif tr.startswith('underglow'): fx.append('underglow_blue')
        elif tr in ('sputter', 'no-exhaust'): fx.append('tailpipe_sputter')
        elif tr == 'fire': fx.append('on_fire')
        elif tr.startswith('headlights:') and tr.split(':')[1] in HEADS: spec['head'], spec['headcol'] = HEADS[tr.split(':')[1]]
    return f'{pid}_{base.split("_")[0]}', spec, fx

def run(cmd, env):
    print('  $', ' '.join(cmd), flush=True)
    r = subprocess.run(cmd, env=env, cwd=LF, capture_output=True, text=True)
    if r.returncode: print(r.stdout[-2000:], r.stderr[-2000:]); sys.exit(f'step failed: {cmd[1] if len(cmd) > 1 else cmd}')
    return r.stdout

def main():
    a = sys.argv[1:]
    spec_path, out = a[0], os.path.abspath(a[1])
    bpy = a[a.index('--bpy') + 1] if '--bpy' in a else None
    city, pois, people, houses, meet = parse(spec_path)
    os.makedirs(os.path.join(out, 'data'), exist_ok=True); os.makedirs(os.path.join(out, 'assets', 'cars'), exist_ok=True)
    tiles = a[a.index('--tiles') + 1] if '--tiles' in a else os.path.join('/tmp', 'cityfactory_tiles_' + re.sub(r'\W+', '_', city['name']).lower())
    # 1 parse -> the city's data
    S, W, N, E = city['bbox']; k = max(1, min(6, math.ceil(max(N - S, (E - W) * 0.78) / 0.024)))   # ~2.7 km tiles: under the API's node cap
    json.dump({'name': city['name'], 'bbox': city['bbox']}, open(os.path.join(out, 'data', 'world.json'), 'w'), indent=1)
    cars, book, city_people = {}, {}, []
    for p in people:
        q = {'id': p['id'], 'name': p['name'], 'street': p.get('street'), 'car': None}
        if p.get('at'): q['at'] = p['at']
        if p.get('car_text'):
            sid, spec, fx = car_from(p['car_text'], p['traits'], p['id'])
            cars[sid] = spec; q['car'] = {'model': p['car_text'], 'paint': p['car_text'], 'fx': fx, 'sprite': sid}
        if p.get('number') and p.get('street'): book[p['id']] = [p['number'], p['street']]
        city_people.append(q)
    json.dump({'name': city['name'], 'pois': pois, 'people': city_people, 'houses': houses, 'meet': meet}, open(os.path.join(out, 'data', 'city.json'), 'w'), indent=1)
    json.dump(cars, open(os.path.join(out, 'data', 'cars.json'), 'w'), indent=1)
    if book: json.dump(book, open(os.path.join(out, 'data', 'addresses.local.json'), 'w'), indent=1)   # PRIVATE (git-ignored)
    env = dict(os.environ, LF_ROOT=out)
    print(f"[1] {city['name']}: {len(people)} people, {len(pois)} POIs, {len(cars)} cars, meet at {meet}; {k}x{k} tiles")
    # 2..6 the existing tools, pointed at the new city
    print('[2]', run(['python3', 'tools/osm_fetch.py', '--tiles', tiles, '--k', str(k)], env).strip().splitlines()[-1])
    print('[3]'); print(run(['python3', 'tools/roster_build.py'], env))
    print('[4]', run(['python3', 'tools/osm_graph.py', '--out', os.path.join(out, 'data', 'graph.json')], env)[:0] + 'graph built')
    rep = json.load(open(os.path.join(out, 'data', 'graph_report.json')))
    print(f"    {rep['edges']} edges, {rep['km_total']} km, largest component {rep['largest_component_share']}, anchors {sorted(rep['anchors'])}")
    print('[5]', run(['python3', 'tools/osm_areas.py', '--tiles', tiles], env).strip())
    print('[6]', run(['python3', 'tools/bumps_build.py'], env).strip())
    try: print('[6b]', run(['python3', 'tools/roof_build.py'], env).strip())          # L5: the meet-up's roof is climbable (if OSM maps its building)
    except SystemExit as e: print('[6b] no climbable roof:', e)
    # 7 the fleet
    if bpy and cars: print('[7]', ' '.join(re.findall(r'car \S+ baked', run([bpy, 'tools/bake_fleet.py', *cars.keys(), '--carfile', os.path.join(out, 'data', 'cars.json')], env))))
    elif cars: print('[7] SKIPPED: no --bpy python given — cars are specified in data/cars.json, sprites not baked')
    # 8 the page
    lf_rel = os.path.relpath(os.path.join(LF, 'src', 'main.js'), out)
    page = open(os.path.join(LF, 'play.html')).read().replace('src="src/main.js"', f'src="{lf_rel}"').replace('<title>Laurel / Fulton</title>', f"<title>{city['name']}</title>")
    open(os.path.join(out, 'play.html'), 'w').write(page)
    ro = json.load(open(os.path.join(out, 'data', 'roster.json')))
    lines = [f"# {city['name']} — built by the city-game factory", '', f"Spec: {os.path.basename(spec_path)} · bbox {city['bbox']} · play: play.html", '',
             f"Graph: {rep['edges']} edges, {rep['km_total']} km drivable. Anchors: {', '.join(sorted(rep['anchors']))}.", '', '| person | where | car | placed |', '|---|---|---|---|']
    for p in ro['people']: lines.append(f"| {p['name']} | {p.get('street') or p.get('at')} | {(p.get('car') or {}).get('model', '-')} | {'exact address' if p.get('active') and not p.get('approx') else ('street' if p.get('approx') else 'NOT FOUND')} |")
    open(os.path.join(out, 'FACTORY.md'), 'w').write('\n'.join(lines) + '\n')
    print(f"[8] {out}/play.html + FACTORY.md — {sum(1 for p in ro['people'] if p.get('active'))}/{len(ro['people'])} people placed, meet at {ro['meetup']['name']}")

if __name__ == '__main__':
    main()
