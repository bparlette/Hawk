#!/usr/bin/env python3
# roster_build.py — writes data/roster.json, the ONE roster file task L2 asks for (players, houses, cars,
# signature effects, mission meet-up), geocoding every house from OSM address points in data/osm_places.json
# and placing it in world units (same projection as tools/osm_graph.py). A person whose address is not in
# the data stays in the roster with "active": false (e.g. Grant until the map extends south) — a data
# change activates them, never a code change. Edit PEOPLE below and re-run.
#   python3 tools/roster_build.py                                      (from games/laurel-fulton/)
import json, os, math
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
LAT0, LON0 = (39.105 + 39.202) / 2, (-76.942 + -76.846) / 2
KX, KY, U = math.cos(math.radians(LAT0)) * 111320.0, 110540.0, 10.0
proj = lambda lat, lon: (round((lon - LON0) * KX * U), round(-(lat - LAT0) * KY * U))
# owner's roster (tasking fable.md, task L2 state update, Nov 17)
PEOPLE = [
 {'id': 'brad',    'name': 'Brad',    'addr': ['10128', 'Stansfield Road'], 'car': {'model': '1987 Chevrolet Camaro', 'paint': 'two-tone: front half white, rear half maroon', 'headlights': 'yellow', 'fx': ['bass']}},
 {'id': 'kosack',  'name': 'Kosack',  'addr': ['10400', 'Derby Drive'],      'car': {'model': '~1989 Chevrolet Cavalier', 'paint': 'red', 'fx': []}},
 {'id': 'jimmy',   'name': 'Jimmy',   'addr': ['8313', 'Sweet Cherry Lane'], 'car': {'model': '1996 Chevrolet Astro', 'paint': 'silver', 'fx': ['bass', 'underglow_blue']}},
 {'id': 'jason',   'name': 'Jason',   'addr': ['8743', 'Susini Drive'],      'car': {'model': '1989 Toyota Camry', 'paint': 'white', 'fx': ['tailpipe_sputter']}},
 {'id': 'clayton', 'name': 'Clayton Floyd', 'addr': ['9946', 'Hughes Avenue'], 'car': {'model': 'Chevrolet Camaro', 'paint': 'green', 'fx': []}},
 {'id': 'zack',    'name': 'Zack Floyd',    'addr': ['9946', 'Hughes Avenue'], 'car': {'model': 'Mercury Tracer', 'paint': 'green', 'fx': []}},
 {'id': 'rigg',    'name': 'Rigg',    'addr': ['8201', 'Mossy Stone Court'], 'car': {'model': 'first-gen Toyota Celica (owner: 1969; refs 1970-73)', 'paint': 'blue', 'headlights': 'blue', 'fx': ['bass']}},
 {'id': 'grant',   'name': 'Grant',   'addr': ['6311', 'Sandy Street'],      'car': {'model': 'Cadillac Brougham "USS Mino"', 'paint': 'maroon', 'fx': []}},
]
P = json.load(open(os.path.join(ROOT, 'data', 'osm_places.json')))['elements']
out = []
for p in PEOPLE:
    hit = next((q for q in P if q['tags'].get('addr:housenumber') == p['addr'][0] and q['tags'].get('addr:street') == p['addr'][1]), None)
    e = dict(p, address=' '.join(p['addr'])); e.pop('addr')
    if hit: e.update(active=True, lat=round(hit['lat'], 6), lon=round(hit['lon'], 6), house=list(proj(hit['lat'], hit['lon'])), osm=f"{hit['type']}/{hit['id']}")
    else: e.update(active=False, why='address not in the current map extent (data/osm_places.json)')
    out.append(e)
school = next(q for q in P if q['tags'].get('name') == 'Atholton High School' and q['tags'].get('amenity') == 'school')
roster = {'_doc': 'The ONE roster (task L2). Written by tools/roster_build.py from OSM address points. house = world units (10/m, x east, y south).',
          'people': out, 'unassigned_cars': [{'model': 'Chevrolet Cavalier', 'paint': 'black', 'note': 'no owner yet - no house, no design work until the owner names whose it is'}],
          'meetup': {'name': 'Atholton High School', 'lat': round(school['lat'], 6), 'lon': round(school['lon'], 6), 'pos': list(proj(school['lat'], school['lon']))}}
json.dump(roster, open(os.path.join(ROOT, 'data', 'roster.json'), 'w'), indent=1)
for e in out: print(f"{e['id']:8s} {'ACTIVE ' if e['active'] else 'pending'} {e['address']:26s} {e.get('house', '')}")
