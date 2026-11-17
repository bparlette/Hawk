#!/usr/bin/env python3
# roster_build.py — writes data/roster.json, the ONE roster file task L2 asks for (players, houses, cars,
# signature effects, mission meet-up). Every house sits at its EXACT OSM address point (data/osm_places.json),
# in world units (same projection as tools/osm_graph.py), on its real street.
# OWNER RULE (Nov 17): exact house + street, but NO HOUSE NUMBERS posted. The numbers live only in
# data/addresses.local.json ({"id": ["number", "Street Name"]}, git-ignored, never committed): with it the
# tool geocodes; without it, each person keeps the position already in data/roster.json. roster.json itself
# carries the street, the position and the OSM element — never a number.
# A person not yet in the map extent stays "active": false (Grant until the map extends south): a data change
# activates them, never a code change. Edit PEOPLE (no numbers) and re-run.
#   python3 tools/roster_build.py                                      (from games/laurel-fulton/)
import json, os, math
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import world_cfg
ROOT = world_cfg.root()
LAT0, LON0 = world_cfg.LAT0, world_cfg.LON0
KX, KY, U = math.cos(math.radians(LAT0)) * 111320.0, 110540.0, 10.0
proj = lambda lat, lon: (round((lon - LON0) * KX * U), round(-(lat - LAT0) * KY * U))
# owner's roster (tasking fable.md, task L2 state update, Nov 17; Grant corrected to Early Bud Way, Billy added)
PEOPLE = [
 {'id': 'brad',    'name': 'Brad',    'street': 'Stansfield Road', 'car': {'model': '1987 Chevrolet Camaro', 'paint': 'two-tone: front half white, rear half maroon', 'headlights': 'yellow', 'fx': ['bass']}},
 {'id': 'kosack',  'name': 'Kosack',  'street': 'Derby Drive',      'car': {'model': '1996 Chevrolet Cavalier sedan (third gen)', 'paint': 'red', 'fx': []}},
 {'id': 'jimmy',   'name': 'Jimmy',   'street': 'Sweet Cherry Lane', 'car': {'model': '1996 Chevrolet Astro', 'paint': 'silver', 'fx': ['bass', 'underglow_blue']}},
 {'id': 'jason',   'name': 'Jason',   'street': 'Susini Drive',      'car': {'model': '1989 Toyota Camry', 'paint': 'white', 'fx': ['tailpipe_sputter']}},
 {'id': 'clayton', 'name': 'Clayton Floyd', 'street': 'Hughes Avenue', 'car': {'model': 'Chevrolet Camaro', 'paint': 'green', 'fx': []}},
 {'id': 'zack',    'name': 'Zack Floyd',    'street': 'Hughes Avenue', 'car': {'model': 'Mercury Tracer', 'paint': 'green', 'fx': []}},
 {'id': 'rigg',    'name': 'Rigg',    'street': 'Mossy Stone Court', 'car': {'model': '1987 Toyota Celica GT (fourth gen, pop-up headlights)', 'paint': 'blue', 'headlights': 'blue', 'fx': ['bass']}},
 {'id': 'billy',   'name': 'Billy',   'street': 'Sweet Cherry Lane', 'car': {'model': '1994 Chevrolet Astro (first gen)', 'paint': 'teal-blue', 'fx': []}, 'note': "shares Jimmy's house"},
 {'id': 'lamar',   'name': 'Lamar',   'street': None, 'at': 'Atholton High School', 'car': {'model': '1987 Ford Mustang GT hatchback (Fox body)', 'paint': 'unstated (silver placeholder)', 'fx': ['on_fire']}, 'note': 'no house on the map; his car lives at the school, burning (the finale set piece)'},
 {'id': 'grant',   'name': 'Grant',   'street': 'Early Bud Way',      'car': {'model': 'Cadillac Brougham "USS Mino"', 'paint': 'maroon', 'fx': []}},
]
CITY = json.load(open(os.path.join(ROOT, 'data', 'city.json'))) if os.path.exists(os.path.join(ROOT, 'data', 'city.json')) else None
if CITY: PEOPLE = CITY['people']                                   # the factory's people (tools/factory/city_factory.py)
MEET = CITY['meet'] if CITY else 'Atholton High School'
P = json.load(open(os.path.join(ROOT, 'data', 'osm_places.json')))['elements']
LOCAL = os.path.join(ROOT, 'data', 'addresses.local.json')
book = json.load(open(LOCAL)) if os.path.exists(LOCAL) else {}
prev = {}
if os.path.exists(os.path.join(ROOT, 'data', 'roster.json')):
    prev = {q['id']: q for q in json.load(open(os.path.join(ROOT, 'data', 'roster.json')))['people']}
out = []
SPRITE = {'brad': 'camaro_brad', 'kosack': 'cavalier_kosack', 'jimmy': 'astro_jimmy', 'billy': 'astro_billy', 'jason': 'camry_jason',
          'clayton': 'camaro_clayton', 'zack': 'tracer_zack', 'rigg': 'celica_rigg', 'grant': 'brougham_grant', 'lamar': 'mustang_lamar'}   # assets/fleet.json (tools/bake_fleet.py)
for p in PEOPLE:
    p = dict(p)
    if p.get('car') and p['id'] in SPRITE and not p['car'].get('sprite'): p['car'] = dict(p['car'], sprite=SPRITE[p['id']])
    e = dict(p); num = (book.get(p['id']) or [None])[0]
    hit = next((q for q in P if num and q['tags'].get('addr:housenumber') == num and q['tags'].get('addr:street') == p['street']), None)
    if hit: e.update(active=True, lat=round(hit['lat'], 6), lon=round(hit['lon'], 6), house=list(proj(hit['lat'], hit['lon'])), osm=f"{hit['type']}/{hit['id']}")
    elif p.get('at'):                                              # lives at a named place (Lamar: Atholton HS lot)
        q = next(q for q in P if q['tags'].get('name') == p['at'])
        e.update(active=True, lat=round(q['lat'], 6), lon=round(q['lon'], 6), house=list(proj(q['lat'], q['lon'])), osm=f"{q['type']}/{q['id']}")
    elif p.get('street') and not num and any(q['tags'].get('addr:street') == p['street'] for q in P):   # street only (public specs): the street's middle address
        on = sorted((q for q in P if q['tags'].get('addr:street') == p['street'] and q['tags'].get('addr:housenumber', '').isdigit()), key=lambda q: int(q['tags']['addr:housenumber']))
        q = on[len(on) // 2] if on else next(q for q in P if q['tags'].get('addr:street') == p['street'])
        e.update(active=True, lat=round(q['lat'], 6), lon=round(q['lon'], 6), house=list(proj(q['lat'], q['lon'])), osm=f"{q['type']}/{q['id']}", approx='street')
    elif p['id'] in prev and prev[p['id']].get('active'):          # no address book here: keep the known exact house
        e.update({k: prev[p['id']][k] for k in ('active', 'lat', 'lon', 'house', 'osm')})
    else: e.update(active=False, why='house not in the current map extent (or no local address book to geocode it)')
    out.append(e)
school = next(q for q in P if q['tags'].get('name') == MEET and (CITY or q['tags'].get('amenity') == 'school'))
roster = {'_doc': 'The ONE roster (task L2). Written by tools/roster_build.py from OSM address points. house = world units (10/m, x east, y south).',
          'people': out, 'houses': (CITY or {}).get('houses', {'jimmy': 'The Lazaris house', 'billy': 'The Lazaris house', 'clayton': 'The Floyds', 'zack': 'The Floyds'}), 'unassigned_cars': [] if CITY else [{'model': 'Chevrolet Cavalier', 'paint': 'black', 'sprite': 'cavalier_black', 'note': 'no owner yet - no house, no design work until the owner names whose it is'}],
          'meetup': {'name': MEET, 'lat': round(school['lat'], 6), 'lon': round(school['lon'], 6), 'pos': list(proj(school['lat'], school['lon']))}}
json.dump(roster, open(os.path.join(ROOT, 'data', 'roster.json'), 'w'), indent=1)
for e in out: print(f"{e['id']:8s} {'ACTIVE ' if e['active'] else 'pending'} {(e.get('street') or e.get('at')):20s} {e.get('house', '')}")
