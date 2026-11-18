#!/usr/bin/env python3
"""Scaggsville MAP -> ASSETS page generator.
Reads the game's own data (roster.json, fleet.json, areas heroes, osm_places)
and writes map-assets.html next to the game: every named place on the painted
map, mapped to the asset files that render it. Re-run after roster/fleet changes.
"""
import json, os, html

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)

roster = json.load(open(os.path.join(GAME, 'data/roster.json')))
fleet = json.load(open(os.path.join(GAME, 'assets/fleet.json')))
manifest = json.load(open(os.path.join(GAME, 'assets/ground-tiles/manifest.json')))
areas = json.load(open(os.path.join(GAME, 'data/areas.json')))
interiors = set()
idir = os.path.join(GAME, 'data/interiors')
if os.path.isdir(idir):
    interiors = {f[:-5] for f in os.listdir(idir) if f.endswith('.json') and f != 'index.json'}

IMG_W, IMG_H = 9920, 12800
AM = manifest['map']
def to_pct(x, y):
    return ((AM['ax'] * x + AM['bx']) / IMG_W * 100, (AM['ay'] * y + AM['by']) / IMG_H * 100)

# lat/lon -> world fit from roster pairs (for OSM places)
pairs = [(p['lon'], p['house'][0], p['lat'], p['house'][1]) for p in roster['people'] if 'lat' in p]
n = len(pairs)
sx = sum(p[0] for p in pairs); sy = sum(p[1] for p in pairs)
sxx = sum(p[0] ** 2 for p in pairs); sxy = sum(p[0] * p[1] for p in pairs)
ax = (n * sxy - sx * sy) / (n * sxx - sx * sx); bx = (sy - ax * sx) / n
sz = sum(p[2] for p in pairs); sw = sum(p[3] for p in pairs)
szz = sum(p[2] ** 2 for p in pairs); szw = sum(p[2] * p[3] for p in pairs)
ay = (n * szw - sz * sw) / (n * szz - sz * sz); by = (sw - ay * sz) / n
def ll_to_world(lat, lon):
    return (ax * lon + bx, ay * lat + by)

# POI coords from osm_places elements (tags.name + center or lat/lon)
pois_osm = {}
try:
    osm = json.load(open(os.path.join(GAME, 'data/osm_places.json')))
    for el in osm.get('elements', []):
        nm = (el.get('tags') or {}).get('name')
        if not nm:
            continue
        c = el.get('center') or el
        if 'lat' in c and 'lon' in c:
            pois_osm[nm] = ll_to_world(c['lat'], c['lon'])
except Exception as e:
    print('osm_places scan failed:', e)

def find_poi(*keys):
    for nm, pos in pois_osm.items():
        if any(k.lower() in nm.lower() for k in keys):
            return pos, nm
    return None, None

ents = []  # dicts: id,name,kind,sub,pos,car,sprite,status,notes
for p in roster['people']:
    sp = p['car']['sprite']
    ents.append(dict(
        id=p['id'], name=p['name'],
        kind='CREW — AT ATHOLTON HS' if p['id'] == 'lamar' else 'CREW HOUSE',
        sub='no house — his Mustang is at the school' if p['id'] == 'lamar' else p.get('street', ''),
        pos=p['house'], car=f"{p['car']['model']} — {p['car']['paint']}", sprite=sp,
        status='LIVE' if p.get('active') else 'SPEC',
        notes=('Interior built (data/interiors/%s.json).' % p['id']) if p['id'] in interiors else 'House in world; interior spec queued (L11).'))
for uc in roster.get('unassigned_cars', []):
    ents.append(dict(id=uc['sprite'], name='Black Cavalier', kind='UNASSIGNED CAR', sub='no house yet',
                     pos=None, car=f"{uc['model']} — {uc['paint']}", sprite=uc['sprite'],
                     status='TBD', notes=uc.get('note', '')))

meet = roster['meetup']
ents.append(dict(id='atholton', name='Atholton High School', kind='POI / MEETUP', sub='the rally finish',
                 pos=meet['pos'], car="Lamar's 1987 Mustang GT — ON FIRE here", sprite='mustang_lamar',
                 status='LIVE', notes='Opening mission ends here. Lamar has no house; his Mustang burns at the school.'))
for key, name, kind, note in [
    (('Ledo',), 'Ledo Pizza', 'POI', 'Crew pizza spot (spec: g12/SPECS.md).'),
    (('Reservoir',), 'Reservoir High School', 'POI', 'The other school (spec: g12/SPECS.md).'),
    (('Maple Lawn',), 'Maple Lawn', 'POI', 'The new development (spec: g12/SPECS.md).'),
    (('Weis',), 'Weis Markets — Whiskey Bottom', 'POI', 'L12: go-inside interior. Jason security · Brad pizzas · Brian fired ("Fuck Scott").'),
]:
    pos, nm = find_poi(*key)
    ents.append(dict(id=name.split()[0].lower(), name=name, kind=kind, sub='Whiskey Bottom, Laurel' if 'Weis' in name else '',
                     pos=pos, car='', sprite='', status='SPEC QUEUED' if pos else 'SPEC QUEUED',
                     notes=note + ('' if pos else ' Placement from map data at build time.')))
ents.append(dict(id='scott', name='Scott', kind='CREW HOUSE', sub='Whiskey Bottom',
                 pos=None, car='Honda Civic — for now', sprite='', status='TBD',
                 notes='A RANDOM house in Whiskey Bottom is Scott\'s (builders pick it). The name in Rigg\'s Weis line: "Fuck Scott." No sprite yet.'))
ents.append(dict(id='klink-van', name="David Klink's Scooby-Doo van", kind='SET-PIECE', sub="parked by Rigg's house",
                 pos=next(p['house'] for p in roster['people'] if p['id'] == 'rigg'), car='Mystery-Machine-style panel van (prop)',
                 sprite='', status='SPEC QUEUED', notes='Exhaust tip is steppable on foot (step-up hop + puff). No sprite yet.'))
ents.append(dict(id='gringada', name='Gringada (1998)', kind='POI', sub='a Columbia shopping center',
                 pos=None, car='', sprite='', status='SPEC QUEUED',
                 notes='Mexican restaurant, gone now — existed in 1998. Brad works there; Jimmy + Clayton steal food. Memory build, not in today\'s map data.'))
ents.append(dict(id='astro-108', name='The Astro on Route 108', kind='SET-PIECE', sub='parked on MD-108',
                 pos=None, car='Chevrolet Astro (random, parked)', sprite='', status='SPEC QUEUED',
                 notes="Jason robs its parking lights. Placement on Route 108 at build time."))

def sprite_cell(sp):
    f = fleet.get(sp, {}).get('color', {}).get('file', '')
    if not f:
        return '<div class="nosp">no sprite yet</div>'
    return (f'<div class="cell" style="background-image:url(\'assets/{f}\')" title="{sp}"></div>')

def asset_files(sp):
    if sp not in fleet:
        return '<li class="none">no assets yet</li>'
    e = fleet[sp]
    out = []
    for part in ('color', 'light', 'shadow'):
        if part in e:
            out.append(f"<li>assets/{e[part]['file']} <span>({part})</span></li>")
    out.append(f"<li class='dim'>fleet.json: {sp} — {e.get('angles', '?')} angles, {e.get('length', '?')}u long</li>")
    return ''.join(out)

markers, cards = [], []
for e in ents:
    if e['pos']:
        px, py = to_pct(e['pos'][0], e['pos'][1])
        markers.append(f'<a class="mk" href="#{e["id"]}" style="left:{px:.2f}%;top:{py:.2f}%" title="{html.escape(e["name"])}"></a>')
    chip = {'LIVE': 'live', 'SPEC': 'spec', 'SPEC QUEUED': 'spec', 'TBD': 'tbd'}[e['status']]
    cards.append(f"""<section class="card" id="{e['id']}">
  <div class="thumb">{sprite_cell(e['sprite'])}</div>
  <div class="body">
    <h3>{html.escape(e['name'])} <span class="chip {chip}">{e['status']}</span></h3>
    <div class="kind">{e['kind']}{' — ' + html.escape(e['sub']) if e['sub'] else ''}</div>
    {('<div class="car">' + html.escape(e['car']) + '</div>') if e['car'] else ''}
    <div class="pos">{('world ' + str([round(v) for v in e['pos']])) if e['pos'] else 'placement TBD'}</div>
    <ul class="files">{asset_files(e['sprite'])}</ul>
    <p class="notes">{html.escape(e['notes'])}</p>
  </div>
</section>""")

nfiles = sum(len([1 for p in ('color', 'light', 'shadow') if p in fleet[s]]) for s in fleet)
page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scaggsville — Map to Assets</title>
<style>
 body{{margin:0;background:#101418;color:#e8ecf1;font-family:-apple-system,'Segoe UI',Roboto,sans-serif}}
 header{{padding:14px 16px 6px}} h1{{margin:0;font-size:22px}} .sub{{color:#9fb0c3;font-size:13px;margin-top:4px}}
 a{{color:#7cc4ff}}
 .mapwrap{{position:relative;margin:10px 12px;border:1px solid #2a3442;border-radius:10px;overflow:hidden}}
 .mapwrap img{{display:block;width:100%}}
 .mk{{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#ffd23e;border:2px solid #101418;box-shadow:0 0 0 2px #ffd23e88}}
 .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;padding:6px 12px 20px}}
 .card{{display:flex;gap:12px;background:#171d24;border:1px solid #2a3442;border-radius:10px;padding:12px}}
 .cell{{width:64px;height:64px;background-size:800% 400%;background-position:0 0;image-rendering:auto;background-color:#0b0e11;border-radius:8px}}
 .nosp{{width:64px;height:64px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:10px;color:#8fa1b5;background:#0b0e11;border-radius:8px;padding:4px;box-sizing:border-box}}
 h3{{margin:0 0 2px;font-size:16px}} .kind{{color:#9fb0c3;font-size:12px}} .car{{font-size:13px;margin-top:4px}}
 .pos{{color:#7d8ea3;font-size:12px;margin-top:2px}} ul.files{{margin:8px 0 0;padding-left:16px;font-size:12px;color:#c6d2df;word-break:break-all}}
 ul.files span,ul.files .dim{{color:#7d8ea3}} ul.files li.none{{color:#e0a23e;list-style:none;margin-left:-16px}}
 .notes{{font-size:12.5px;color:#b9c7d6;margin:8px 0 0}}
 .chip{{font-size:10px;padding:2px 7px;border-radius:20px;vertical-align:2px}}
 .chip.live{{background:#1d4d2b;color:#8ff0ae}} .chip.spec{{background:#4d3d1d;color:#ffd98f}} .chip.tbd{{background:#4d1d2a;color:#ff9fb2}}
 footer{{padding:0 16px 24px;color:#7d8ea3;font-size:12px}}
</style></head><body>
<header><h1>SCAGGSVILLE — map → assets</h1>
<div class="sub">Every named place on the painted map, and the asset files that render it. Tap a gold dot to jump to its card. <a href="./">▶ Play the game</a></div></header>
<div class="mapwrap"><img src="assets/ground-painted.webp" alt="Scaggsville painted map">{''.join(markers)}</div>
<div class="grid">{''.join(cards)}</div>
<footer>{len(ents)} places mapped · {len(fleet)} car sprite sets · {nfiles} car asset files · painted ground: 168 tiles (assets/ground-tiles/) + ground-painted.webp · data: roster.json, areas.json ({len(areas['buildings'])} buildings), graph.json · generated by tools/map_assets_gen.py from the game's own data.</footer>
</body></html>"""

out = os.path.join(GAME, 'map-assets.html')
open(out, 'w').write(page)
print('wrote', out, len(page), 'bytes ·', len(ents), 'entities ·', sum(1 for e in ents if e['pos']), 'with map positions')
for e in ents:
    print(('  POS ' if e['pos'] else '  TBD ') + e['name'])
