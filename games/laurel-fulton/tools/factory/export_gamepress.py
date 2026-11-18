#!/usr/bin/env python3
"""export_gamepress.py — file the city-game factory (task L4) into gamepress as a SANITIZED, self-contained tool.
  python3 tools/factory/export_gamepress.py <gamepress-checkout>        (from games/laurel-fulton/)
  -> <gamepress>/tools/city-factory/   {src/ tools/ vendor/ examples/ play.html README.md}

gamepress is public-facing ("no personal paths or names", its AGENTS.md), and the owner's rule is that the real Laurel spec
with real people never ships in the public tool. So the export:
  * renames every fleet template from a person's car to a MODEL (camaro_brad -> camaro_87_twotone, ...),
  * replaces crew names and their home streets wherever they appear in comments/strings with neutral words,
  * drops the Laurel people list + house names from roster_build.py (a city now REQUIRES its own data/city.json),
  * ships ONLY the made-up Savage example spec, never the Laurel one,
  * vendors the four Palm City pieces the engine and the bake import (world.js, input.js, the ped sprites, bake_sprites.py
    + its layout.json) and rewrites those import paths,
  * finishes with an AUDIT: any crew name or home street left anywhere in the export = the export FAILS.
Re-run it whenever the engine or the pipeline changes; it overwrites tools/city-factory/ wholesale."""
import os, sys, re, json, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); LF = os.path.dirname(os.path.dirname(HERE)); PC = os.path.join(os.path.dirname(LF), 'palm-city')
GP = os.path.abspath(sys.argv[1]); OUT = os.path.join(GP, 'tools', 'city-factory')
IDS = {'camaro_brad': 'camaro_87_twotone', 'camaro_clayton': 'camaro_87', 'cavalier_kosack': 'cavalier_96', 'cavalier_black': 'cavalier_89',
       'astro_jimmy': 'astro_96', 'astro_billy': 'astro_94', 'camry_jason': 'camry_89', 'tracer_zack': 'tracer_88', 'celica_rigg': 'celica_87gt',
       'mustang_lamar': 'mustang_87', 'brougham_grant': 'brougham_89'}
NAMES = ['Clayton Floyd', 'Zack Floyd', 'The Floyds', 'Floyds', 'Floyd', 'Lazaris', 'Brad', 'Kosack', 'Jimmy', 'Billy', 'Jason', 'Clayton', 'Zack', 'Rigg', 'Grant', 'Lamar', 'Teter']
STREETS = ['Stansfield Road', 'Stansfield Rd', 'Derby Drive', 'Derby Dr', 'Sweet Cherry Lane', 'Sweet Cherry Ln', 'Susini Drive', 'Susini Dr', 'Hughes Avenue', 'Hughes Ave',
           'Mossy Stone Court', 'Early Bud Way', 'Stansfield', 'Derby', 'Sweet Cherry', 'Susini', 'Hughes', 'Mossy Stone', 'Early Bud']
LOWER_IDS = ['floyds', 'floyd', 'lazaris', 'teter', 'brad', 'kosack', 'jimmy', 'billy', 'jason', 'clayton', 'zack', 'rigg', 'grant', 'lamar']
def sanitize(text):
    for a, b in IDS.items(): text = text.replace(a, b)
    for s in STREETS: text = text.replace(s, 'a crew street')
    for n in NAMES: text = re.sub(r'(?<=[{,\s])' + re.escape(n) + r'(?=\s*:)', "'crew'", text)   # an unquoted object key (Brad: '#e8e4dc') stays valid JS
    for n in NAMES: text = re.sub(r'\b' + re.escape(n) + r"('s)?\b", lambda m: m.group(0) if m.group(0).islower() else 'A CREW MEMBER' if m.group(0).isupper() else 'a crew member', text, flags=re.I)   # any case (BRAD, Rigg's, ...)
    for n in LOWER_IDS: text = re.sub(r"(?<![A-Za-z_])'" + n + r"'", "'crew'", text); text = re.sub(r'\b' + n + r'\b', 'crew', text)   # ids, keys and any lowercase mention
    return re.sub(r'\bTETER\b', 'THE MOM', text)
if os.path.exists(OUT): shutil.rmtree(OUT)
for d in ['src', 'tools/factory', 'vendor/palm-city/src', 'vendor/palm-city/tools', 'vendor/palm-city/assets', 'examples']: os.makedirs(os.path.join(OUT, d), exist_ok=True)
# the engine
for f in sorted(os.listdir(os.path.join(LF, 'src'))):
    s = open(os.path.join(LF, 'src', f)).read().replace("'../../palm-city/", "'../vendor/palm-city/")
    open(os.path.join(OUT, 'src', f), 'w').write(sanitize(s))
open(os.path.join(OUT, 'play.html'), 'w').write(open(os.path.join(LF, 'play.html')).read().replace('<title>Laurel / Fulton</title>', '<title>City Game</title>'))
# the pipeline
for f in ['world_cfg.py', 'osm_fetch.py', 'osm_graph.py', 'osm_areas.py', 'roster_build.py', 'bumps_build.py', 'roof_build.py', 'graph_pack.py', 'compress_map.py', 'bake_fleet.py', 'spec_l2.mjs', 'fleet_sheet.py']:
    s = open(os.path.join(LF, 'tools', f)).read()
    if f == 'roster_build.py':                              # no Laurel people, no Laurel house names: a city brings its own city.json
        s = re.sub(r"PEOPLE = \[\n.*?\n\]\n", "PEOPLE = []          # every city brings its own people in data/city.json (tools/factory/city_factory.py)\n", s, flags=re.S)
        s = re.sub(r"SPRITE = \{.*?\}   #", "SPRITE = {}   #", s, flags=re.S)
        s = re.sub(r"'houses': \(CITY or \{\}\)\.get\('houses', \{.*?\}\)", "'houses': (CITY or {}).get('houses', {})", s, flags=re.S)
    if f == 'bake_fleet.py':
        s = s.replace("PS = os.path.abspath(os.path.join(ROOT, '..', 'palm-city', 'tools', 'bake_sprites.py'))", "PS = os.path.abspath(os.path.join(HERE, '..', 'vendor', 'palm-city', 'tools', 'bake_sprites.py'))")
    if f == 'spec_l2.mjs': s = s.replace("const WHO = process.argv[2] || 'jason'", "const WHO = process.argv[2] || MI.players(ROSTER)[0].id")
    open(os.path.join(OUT, 'tools', f), 'w').write(sanitize(s))
for f in ['city_factory.py', 'smoke_city.mjs']:
    open(os.path.join(OUT, 'tools', 'factory', f), 'w').write(sanitize(open(os.path.join(HERE, f)).read()))
shutil.copy(os.path.join(HERE, 'examples', 'savage.spec'), os.path.join(OUT, 'examples', 'savage.spec'))   # the made-up example only
# Palm City pieces, vendored (the engine's noise + touch input, the ped sprites, the Blender bake + its layout)
for f in ['world.js', 'input.js', 'labels.js']: shutil.copy(os.path.join(PC, 'src', f), os.path.join(OUT, 'vendor', 'palm-city', 'src', f))
shutil.copy(os.path.join(PC, 'tools', 'bake_sprites.py'), os.path.join(OUT, 'vendor', 'palm-city', 'tools', 'bake_sprites.py'))
shutil.copy(os.path.join(PC, 'layout.json'), os.path.join(OUT, 'vendor', 'palm-city', 'layout.json'))
fx = open(os.path.join(LF, 'src', 'lf_fx.js')).read()
for f in set(re.findall(r"'([\w]+\.webp)'", fx[fx.index('PED_FILE'):fx.index('PED_FILE') + 600])): shutil.copy(os.path.join(PC, 'assets', f), os.path.join(OUT, 'vendor', 'palm-city', 'assets', f))
open(os.path.join(OUT, 'README.md'), 'w').write(open(os.path.join(HERE, 'GAMEPRESS-README.md')).read())
# AUDIT: nothing personal may survive
bad = []
for root, _, files in os.walk(OUT):
    for f in files:
        if f.endswith(('.webp', '.png')): continue
        t = open(os.path.join(root, f), errors='ignore').read()
        for w in NAMES + STREETS + ['Laurel / Fulton private', 'addresses.local.json"']:
            if re.search(r'\b' + re.escape(w) + r'\b', t, re.I): bad.append((os.path.relpath(os.path.join(root, f), OUT), w))   # case-insensitive
if bad: print('EXPORT AUDIT FAILED — personal names/streets left:', bad[:20]); sys.exit(1)
n = sum(len(fs) for _, _, fs in os.walk(OUT))
print(f'exported {n} files to {OUT} — audit clean (no crew names, no home streets, no Laurel spec)')
