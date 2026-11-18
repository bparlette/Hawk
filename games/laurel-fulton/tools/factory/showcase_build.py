#!/usr/bin/env python3
"""showcase_build.py — task L9, THE SHOWCASE GENERATOR: every factory city gets its page.

  python3 tools/factory/showcase_build.py [<city-folder>]        (default: $LF_ROOT, else games/laurel-fulton/)
  -> <city>/showcase.generated.html   (never overwrites a hand-made showcase.html)

THE G9 TEMPLATE — fixed section order, mobile-first:
  1 THE MISSION      the one-line pitch: pick your player -> rally the crew -> meet at <place>
  2 THE MAP          public variant: real road network, STREET NAMES ONLY, crew streets + places marked
  3 THE CREW         the roster by street name (shared houses grouped)
  4 THE CARS         every car: the REAL INSPIRATION (reference photo) beside the IN-GAME SPRITE, equal dignity
  5 THE HEROES       every hero home + place: the real reference (if any) beside the in-game footprint tier
  6 THE FLEET        every sprite in one lineup at true relative scale
  7 THE LEDGER       the honesty count: references found / near-match / missing
HONESTY TAGS (never faked): "reference photo" | "near match" | "in-game sprite" | "in-game footprint" |
  "placeholder - no reference yet".  A missing reference is drawn as an empty dashed frame, never a stand-in picture.

INPUTS (all from the city folder): data/roster.json, data/city.json (optional), assets/fleet.json + assets/cars/*.webp,
  data/areas.json (heroes + footprints), data/graph.json (the map), data/addresses.local.json (private; audit only).
REFERENCES: auto-found as <city>/showcase-assets/<id>-ref.<ext> (cars, by person id), <hero-slug>-ref.<ext> (heroes),
  or <city>/data/references/<id>.<ext>; an optional data/references.json adds captions / match levels:
  {"cars": {"<person id>": {"file": "...", "caption": "...", "match": "exact|near"}}, "heroes": {"<slug>": {...}}}

PRIVACY AUDIT: the build FAILS if the output contains any house number — any number from data/addresses.local.json, or any
"<digits> <Street name>" pattern in the visible text.
"""
import os, sys, re, json, html, math

HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.dirname(HERE)
sys.path.insert(0, TOOLS)
EXTS = ('jpg', 'jpeg', 'png', 'webp')
STREET_WORDS = r'(?:Street|St|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Place|Pl|Terrace|Trail|Pike|Parkway|Pkwy|Highway|Hwy|Run|Loop|Path|Row|Alley)'

def esc(s): return html.escape(str(s), quote=True)
def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
def jload(p, default=None):
    return json.load(open(p)) if os.path.exists(p) else default

# ------------------------------------------------------------------ loading
def load(root):
    D = lambda *a: os.path.join(root, *a)
    ro = jload(D('data', 'roster.json')); assert ro, f'{root}: data/roster.json missing - run the factory first'
    return dict(root=root, roster=ro, city=jload(D('data', 'city.json'), {}), fleet=jload(D('assets', 'fleet.json'), {}),
                areas=jload(D('data', 'areas.json'), {}), graph=jload(D('data', 'graph.json')), refs=jload(D('data', 'references.json'), {}),
                world=jload(D('data', 'world.json'), {}), book=jload(D('data', 'addresses.local.json'), {}))

def find_ref(root, key, manifest):
    """-> (relative path | None, caption, match) — only files that really exist count."""
    m = manifest.get(key, {})
    if m.get('file') and os.path.exists(os.path.join(root, m['file'])):
        return m['file'], m.get('caption', ''), m.get('match', 'exact')
    for d, pat in (('showcase-assets', '{k}-ref.{e}'), (os.path.join('data', 'references'), '{k}.{e}')):
        for e in EXTS:
            rel = os.path.join(d, pat.format(k=key, e=e))
            if os.path.exists(os.path.join(root, rel)): return rel.replace(os.sep, '/'), m.get('caption', ''), m.get('match', 'exact')
    return None, m.get('caption', ''), None

def city_name(S):
    return S['city'].get('name') or S['world'].get('name') or os.path.basename(S['root'].rstrip('/')).replace('-', ' ').title()

# ------------------------------------------------------------------ sprites
def sprite(S, sid, size=240, frame=0):
    """One frame of the in-game sprite sheet (32 angles, 8 cols; frame 0 faces east) as a CSS-cropped tile."""
    f = S['fleet'].get(sid)
    if not f or not os.path.exists(os.path.join(S['root'], 'assets', f['color']['file'])): return None
    cols, ang = f.get('cols', 8), f.get('angles', 32); rows = math.ceil(ang / cols)
    cx, cy = frame % cols, frame // cols
    return (f'<span class="spr" role="img" aria-label="in-game sprite" style="width:{size}px;height:{size}px;'
            f'background:url(assets/{esc(f["color"]["file"])}) -{cx*size}px -{cy*size}px/{cols*size}px {rows*size}px no-repeat"></span>')

# ------------------------------------------------------------------ map
MAJOR = {'motorway', 'trunk', 'primary', 'secondary'}
ROADS = {'motorway': (110, '#e8a24a'), 'motorway_link': (70, '#e8a24a'), 'trunk': (100, '#e8a24a'), 'trunk_link': (60, '#e8a24a'),
         'primary': (90, '#f0d8a0'), 'primary_link': (60, '#f0d8a0'), 'secondary': (75, '#e6e0c8'), 'secondary_link': (50, '#e6e0c8'),
         'tertiary': (55, '#cfd3da'), 'tertiary_link': (40, '#cfd3da'), 'unclassified': (40, '#aeb4c0'), 'residential': (34, '#8e97a8')}

def decimate(pts, step):
    out = [pts[0]]
    for p in pts[1:-1]:
        if math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) >= step: out.append(p)
    out.append(pts[-1]); return out

def build_map(S, people, places):
    g = S['graph']
    if not g: return None
    ex = [e for e in g['edges'] if e['hw'] in ROADS]
    xs = [p[0] for e in ex for p in e['pts']]; ys = [p[1] for e in ex for p in e['pts']]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys); W, H = x1 - x0, y1 - y0
    step = max(30, max(W, H) / 700)
    by = {}
    for e in ex: by.setdefault(e['hw'], []).append(e)
    paths = []
    for hw in ('residential', 'unclassified', 'tertiary_link', 'tertiary', 'secondary_link', 'secondary', 'primary_link', 'primary', 'trunk_link', 'trunk', 'motorway_link', 'motorway'):
        if hw not in by: continue
        w, col = ROADS[hw]; w *= max(1, max(W, H) / 30000)
        d = ''.join('M' + ' '.join(f'{round(p[0])} {round(p[1])}' for p in decimate(e['pts'], step)) for e in by[hw])
        paths.append(f'<path d="{d}" stroke="{col}" stroke-width="{w:.0f}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
    unit = max(W, H) / 1000.0          # 1 css-ish px at the default zoom
    fs = unit * 15
    # labels: the longest major streets + every crew street (street names only)
    names = {}
    for e in ex:
        n = (e.get('name') or '').strip()
        if n: names.setdefault(n, []).append(e)
    crew_streets = {p['street'] for p in people if p.get('street')}
    ranked = sorted(((sum(e['len'] for e in v), n) for n, v in names.items() if any(e['hw'] in MAJOR for e in v)), reverse=True)
    pick = [n for _, n in ranked[:14]] + [n for n in crew_streets if n in names]
    seen, labels = set(), []
    for n in pick:
        if n in seen: continue
        seen.add(n); e = max(names[n], key=lambda z: z['len']); p = e['pts'][len(e['pts']) // 2]
        cls = 'cs' if n in crew_streets else 'ms'
        labels.append(f'<text class="{cls}" x="{p[0]:.0f}" y="{p[1]:.0f}" font-size="{fs:.0f}">{esc(n)}</text>')
    marks = []
    for p in people:          # crew marker sits on the street; the label is the street name, never a number
        if p.get('house'):
            marks.append(f'<circle class="crew" cx="{p["house"][0]:.0f}" cy="{p["house"][1]:.0f}" r="{unit*6:.0f}"/>')
    for n, pos in places:
        marks.append(f'<g class="poi"><rect x="{pos[0]-unit*6:.0f}" y="{pos[1]-unit*6:.0f}" width="{unit*12:.0f}" height="{unit*12:.0f}" rx="{unit*2:.0f}"/>'
                     f'<text x="{pos[0]+unit*10:.0f}" y="{pos[1]+unit*4:.0f}" font-size="{fs*1.15:.0f}">{esc(n)}</text></g>')
    pad = unit * 40
    return (f'<svg id="mapsvg" viewBox="{x0-pad:.0f} {y0-pad:.0f} {W+2*pad:.0f} {H+2*pad:.0f}" xmlns="http://www.w3.org/2000/svg" '
            f'role="img" aria-label="Public road map, street names only"><rect x="{x0-pad:.0f}" y="{y0-pad:.0f}" width="{W+2*pad:.0f}" height="{H+2*pad:.0f}" fill="#0f1420"/>'
            + ''.join(paths) + ''.join(labels) + ''.join(marks) + '</svg>', len(ex), len(names))

# ------------------------------------------------------------------ hero footprints
def hero_svg(S, hero, bs):
    b = S['areas']['buildings'][hero['b']]
    pts = list(zip(b[0::2], b[1::2])); xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    half = max(max(xs) - min(xs), max(ys) - min(ys)) / 2 * 1.5 + 120
    near = []
    for o in bs:
        if o is b: continue
        ox, oy = o[0], o[1]
        if abs(ox - cx) < half * 1.4 and abs(oy - cy) < half * 1.4: near.append(o)
    poly = lambda f: ' '.join(f'{f[i]:.0f},{f[i+1]:.0f}' for i in range(0, len(f), 2))
    bg = ''.join(f'<polygon points="{poly(o)}" fill="#2a3040" stroke="#3a4256" stroke-width="6"/>' for o in near[:140])
    cls = 'hp' if hero['kind'] == 'poi' else 'hh'
    return (f'<svg class="foot" viewBox="{cx-half:.0f} {cy-half:.0f} {2*half:.0f} {2*half:.0f}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="in-game footprint">'
            f'<rect x="{cx-half:.0f}" y="{cy-half:.0f}" width="{2*half:.0f}" height="{2*half:.0f}" fill="#1a2a1e"/>{bg}'
            f'<polygon class="{cls}" points="{poly(b)}" stroke-linejoin="round"/></svg>')

# ------------------------------------------------------------------ page parts
def tag(kind, text): return f'<span class="tag {kind}">{esc(text)}</span>'

def ref_frame(S, key, manifest, what, missing_text):
    rel, cap, match = find_ref(S['root'], key, manifest)
    if rel:
        t = tag('near', 'near match') if match == 'near' else tag('real', 'reference photo')
        return (f'<figure class="real"><div class="fr"><img loading="lazy" src="{esc(rel)}" alt="Reference photo for {esc(what)}"></div>'
                f'<figcaption>{t}<span>{esc(cap) or "the real thing"}</span></figcaption></figure>'), ('near' if match == 'near' else 'found')
    return (f'<figure class="real miss"><div class="fr"><span class="none">no reference photo<br>yet</span></div>'
            f'<figcaption>{tag("miss", "placeholder - no reference yet")}<span>{esc(missing_text)}</span></figcaption></figure>'), 'missing'

def sections(S):
    ro, name = S['roster'], city_name(S)
    people = ro['people']; meet = ro.get('meetup') or {}
    meet_name = meet.get('name') or S['city'].get('meet') or 'the meet-up'
    cars_ref = S['refs'].get('cars', {}); heroes_ref = S['refs'].get('heroes', {})
    houses = ro.get('houses', {})
    ledger = {'found': 0, 'near': 0, 'missing': 0}; led_rows = []
    out = []
    # 1 mission
    out.append(f'''<header class="top"><p class="eyebrow">a real place, built as a game</p><h1>{esc(name)}</h1>
<p class="mission"><b>Pick your player</b> at their house &rarr; get in the car &rarr; <b>rally the crew</b>, street to street &rarr; the whole convoy meets at <b>{esc(meet_name)}</b>.</p>
<p class="lede">Every car and every hero place below is shown the same way: the <em>real inspiration</em> on one side, the <em>in-game asset</em> built from it on the other.</p></header>''')
    # 2 map
    places = []
    for h in S['areas'].get('heroes', []):
        if h['kind'] == 'poi' and h['b'] < len(S['areas'].get('buildings', [])):
            b = S['areas']['buildings'][h['b']]; places.append((h['who'], (sum(b[0::2]) / (len(b) / 2), sum(b[1::2]) / (len(b) / 2))))
    mp = build_map(S, people, places)
    if mp:
        svg, nedges, nnames = mp
        out.append(f'''<section id="map"><h2><span class="n">1</span>The map</h2>
<p class="note">The real road network from OpenStreetMap, drawn at full extent. Public version: <b>street names only</b> &mdash; no house numbers. Gold dots are the crew&rsquo;s streets; squares are the named places.</p>
<div class="mapctl"><button type="button" data-z="-1" aria-label="zoom out">&minus;</button><button type="button" data-z="1" aria-label="zoom in">+</button><span>{nedges:,} road segments &middot; {nnames} named streets</span></div>
<div class="mapbox" id="mapbox">{svg}</div></section>''')
    # 3 roster by street
    groups = {}
    for p in people: groups.setdefault(p.get('street') or ('at ' + p.get('at', '?')), []).append(p)
    rows = []
    for street, ps in sorted(groups.items(), key=lambda kv: kv[0].lower()):
        share = {houses.get(p['id']) for p in ps if houses.get(p['id'])}
        who = ' &amp; '.join(f'<b>{esc(p["name"])}</b>' for p in ps)
        extra = f' <i>&mdash; {esc(", ".join(sorted(share)))}</i>' if share else ''
        rows.append(f'<li><span class="st">{esc(street)}</span><span class="wh">{who}{extra}</span></li>')
    out.append(f'<section id="crew"><h2><span class="n">2</span>The crew, by street</h2><ul class="roster">{"".join(rows)}</ul>'
               f'<p class="note small">Rally finale: <b>{esc(meet_name)}</b>.</p></section>')
    # 4 cars
    cards = []; used = set()
    for p in people:
        c = p.get('car')
        if not c: continue
        sid = c.get('sprite'); used.add(sid)
        spr = sprite(S, sid)
        left, st = ref_frame(S, p['id'], cars_ref, c['model'], 'drop a photo of the real car in showcase-assets/ to fill this frame')
        ledger[st] += 1; led_rows.append((p['name'] + ' - ' + c['model'], st))
        right = (f'<figure class="game"><div class="fr dark">{spr}</div><figcaption>{tag("game", "in-game sprite")}<span>top-down, 32 angles</span></figcaption></figure>' if spr else
                 f'<figure class="game miss"><div class="fr dark"><span class="none">sprite not baked</span></div><figcaption>{tag("miss", "placeholder - no sprite yet")}</figcaption></figure>')
        fx = c.get('fx') or []
        fxs = ' '.join(f'<span class="chip">{esc(x.replace("_", " "))}</span>' for x in fx)
        cards.append(f'<article class="card"><h3>{esc(p["name"])}</h3><p class="where">{esc(p.get("street") or p.get("at") or "")}</p>'
                     f'<p class="car">{esc(c["model"])} {fxs}</p><div class="pair">{left}<div class="arr" aria-hidden="true">&rarr;</div>{right}</div></article>')
    for uc in ro.get('unassigned_cars', []):
        sid = uc.get('sprite'); used.add(sid); spr = sprite(S, sid)
        left, st = ref_frame(S, sid, cars_ref, uc.get('model', ''), 'unclaimed car - no reference yet')
        ledger[st] += 1; led_rows.append(('Unclaimed - ' + uc.get('model', sid), st))
        cards.append(f'<article class="card"><h3>Waiting for an owner</h3><p class="where">no house yet</p><p class="car">{esc(uc.get("paint", ""))} {esc(uc.get("model", ""))}</p>'
                     f'<div class="pair">{left}<div class="arr" aria-hidden="true">&rarr;</div><figure class="game"><div class="fr dark">{spr or ""}</div><figcaption>{tag("game", "in-game sprite")}</figcaption></figure></div></article>')
    out.append(f'<section id="cars"><h2><span class="n">3</span>The cars &middot; real &rarr; game</h2><p class="note">Left: the real car. Right: the sprite that drives the map.</p>{"".join(cards)}</section>')
    # 5 heroes
    hc = []; bs = S['areas'].get('buildings', [])
    st_of = {}
    for p in people: st_of.setdefault(houses.get(p['id']) or p['name'], p)
    for h in S['areas'].get('heroes', []):
        if h['b'] >= len(bs): continue
        key = slug(h['who']); person = st_of.get(h['who'])
        occupants = [p['name'] for p in people if (houses.get(p['id']) or p['name']) == h['who']]
        where = (person.get('street') if person and person.get('street') else '') if h['kind'] == 'home' else 'named place'
        left, st = ref_frame(S, 'hero-' + key, heroes_ref, h['who'], 'hero-tier footprint is drawn from the real OSM outline; art pending')
        ledger[st] += 1; led_rows.append((h['who'], st))
        roof = ' <span class="chip">climbable roof</span>' if h.get('roof') else ''
        right = f'<figure class="game"><div class="fr dark">{hero_svg(S, h, bs)}</div><figcaption>{tag("game", "in-game footprint")}<span>real OSM outline, hero tier</span></figcaption></figure>'
        who = f'<p class="car">{esc(" & ".join(occupants))}</p>' if occupants and h['kind'] == 'home' and occupants != [h['who']] else ''
        hc.append(f'<article class="card"><h3>{esc(h["who"])}{roof}</h3><p class="where">{esc(where)}</p>{who}<div class="pair">{left}<div class="arr" aria-hidden="true">&rarr;</div>{right}</div></article>')
    out.append(f'<section id="heroes"><h2><span class="n">4</span>The hero places &middot; real &rarr; game</h2><p class="note">The crew&rsquo;s homes and the named places get the detailed tier; everything else stays a faded background shape. Street-level reference for homes stays in private build material.</p>{"".join(hc)}</section>')
    # 6 fleet lineup
    tiles = []
    for sid, f in sorted(S['fleet'].items(), key=lambda kv: -kv[1].get('length', 0)):
        spr = sprite(S, sid, 150)
        if spr: tiles.append(f'<div class="ft">{spr}<span>{esc(sid.replace("_", " "))}</span><small>{f.get("length", 0)/10:.2f} m</small></div>')
    out.append(f'<section id="fleet"><h2><span class="n">5</span>The fleet &middot; true relative scale</h2><p class="note">Longest to shortest, same scale for all: a land yacht really is that much bigger than a hatchback.</p><div class="lineup">{"".join(tiles)}</div></section>')
    # 7 ledger
    tot = sum(ledger.values())
    led = ''.join(f'<li class="{s}"><span>{esc(n)}</span><b>{ {"found": "reference photo", "near": "near match", "missing": "no reference yet"}[s] }</b></li>' for n, s in led_rows)
    out.append(f'<section id="ledger"><h2><span class="n">6</span>The honesty ledger</h2><p class="note">{ledger["found"]} of {tot} pairings have a real reference photo, {ledger["near"]} a near match, {ledger["missing"]} are still placeholders. Nothing is faked: an empty frame means no reference exists yet.</p><ul class="led">{led}</ul></section>')
    return out, ledger, tot

CSS = '''
:root{--bg:#10131c;--panel:#1a2030;--panel2:#141927;--ink:#eef0f6;--dim:#9aa3b8;--gold:#f5c542;--blue:#7fd4ff;--line:#2b344a;--ok:#6fd38c;--warn:#f0a35a;--miss:#8a93a8;--gutter:16px}
@media (prefers-color-scheme:light){:root:not([data-theme=dark]){--bg:#f3efe4;--panel:#fffdf6;--panel2:#ebe5d4;--ink:#1b1e29;--dim:#5b6376;--gold:#8a5f00;--blue:#0b5f86;--line:#d2c9b0;--ok:#1e7a3c;--warn:#a65a10;--miss:#6a7184}}
:root[data-theme=dark]{--bg:#10131c}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Georgia,'Times New Roman',serif;overflow-x:hidden}
main,header.top{max-width:980px;margin:0 auto;padding:0 var(--gutter)}
header.top{padding-top:34px;text-align:center}
.eyebrow{margin:0;color:var(--blue);font:600 12px/1.2 system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase}
h1{margin:6px 0 8px;color:var(--gold);font-size:clamp(30px,9vw,52px);line-height:1.05;letter-spacing:.5px}
.mission{font-size:clamp(16px,4.4vw,21px);margin:8px 0}.lede{color:var(--dim);font-size:15px;margin:6px 0 0}
h2{display:flex;align-items:center;gap:10px;color:var(--gold);font-size:clamp(20px,5.4vw,28px);margin:38px 0 8px}
h2 .n{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--gold);color:var(--bg);font:700 14px system-ui,sans-serif;flex:none}
.note{color:var(--dim);font-size:15px;margin:4px 0 12px}.note.small{font-size:13.5px}
.mapctl{display:flex;gap:8px;align-items:center;margin-bottom:8px;font:13px system-ui,sans-serif;color:var(--dim)}
.mapctl button{width:40px;height:40px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:600 20px system-ui,sans-serif}
.mapbox{overflow:auto;border:1px solid var(--line);border-radius:12px;background:#0f1420;max-height:78vh;-webkit-overflow-scrolling:touch}
#mapsvg{display:block;width:100%;height:auto}
#mapsvg text{paint-order:stroke;stroke:#0f1420;stroke-width:5;stroke-linejoin:round;fill:#c9d0e0;font-family:system-ui,sans-serif}
#mapsvg text.cs{fill:#ffd96a;font-weight:700}#mapsvg .crew{fill:#f5c542;stroke:#0f1420;stroke-width:6}
#mapsvg .poi rect{fill:#7fd4ff;stroke:#0f1420;stroke-width:6}#mapsvg .poi text{fill:#7fd4ff;font-weight:700}
.roster{list-style:none;margin:0;padding:0;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.roster li{display:flex;flex-wrap:wrap;gap:2px 14px;justify-content:space-between;padding:10px 14px;background:var(--panel);border-top:1px solid var(--line)}
.roster li:first-child{border-top:0}.roster .st{color:var(--blue);font:600 14px system-ui,sans-serif}.roster .wh i{color:var(--dim)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px;margin:14px 0}
.card h3{margin:0;color:var(--gold);font-size:21px}.where{margin:0;color:var(--blue);font:13.5px system-ui,sans-serif}.car{margin:4px 0 10px;font-size:15px}
.chip{display:inline-block;font:11px/1 system-ui,sans-serif;padding:3px 7px;border-radius:99px;background:var(--panel2);border:1px solid var(--line);color:var(--dim);margin-left:4px;vertical-align:middle}
.pair{display:grid;grid-template-columns:1fr;gap:6px}.arr{text-align:center;color:var(--gold);font-size:24px;line-height:1;transform:rotate(90deg);height:22px}
@media(min-width:640px){.pair{grid-template-columns:1fr 36px 1fr;align-items:stretch}.arr{transform:none;height:auto;align-self:center}}
figure{margin:0;display:flex;flex-direction:column;background:var(--panel2);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.fr{aspect-ratio:4/3;display:grid;place-items:center;overflow:hidden;background:#0c0f17}.fr img{width:100%;height:100%;object-fit:cover;display:block}
.fr.dark{background:radial-gradient(circle at 50% 45%,#2a3248,#0f1320 75%)}.fr .spr{max-width:100%;transform-origin:center}
.fr svg.foot{width:100%;height:100%;display:block}.foot .hh{fill:#f5c542;stroke:#fff3c4;stroke-width:12}.foot .hp{fill:#7fd4ff;stroke:#e2f6ff;stroke-width:12}
figure.miss .fr{border:2px dashed var(--miss);margin:8px;border-radius:8px;aspect-ratio:auto;background:transparent;aspect-ratio:16/9}.none{color:var(--miss);font:13px/1.35 system-ui,sans-serif;text-align:center}
figcaption{display:flex;flex-direction:column;gap:3px;padding:8px 10px 10px;font:12.5px/1.35 system-ui,sans-serif;color:var(--dim)}
.tag{align-self:flex-start;font:700 10.5px/1 system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;padding:4px 8px;border-radius:99px}
.tag.real{background:rgba(111,211,140,.16);color:var(--ok);border:1px solid var(--ok)}.tag.near{background:rgba(240,163,90,.14);color:var(--warn);border:1px solid var(--warn)}
.tag.game{background:rgba(127,212,255,.14);color:var(--blue);border:1px solid var(--blue)}.tag.miss{background:transparent;color:var(--miss);border:1px dashed var(--miss)}
.lineup{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}.ft{display:flex;flex-direction:column;align-items:center;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:6px 6px 8px;font:12px system-ui,sans-serif;color:var(--ink)}
.ft small{color:var(--dim)}.ft .spr{background-color:transparent}
.led{list-style:none;margin:0;padding:0;font:14px system-ui,sans-serif}.led li{display:flex;justify-content:space-between;gap:12px;padding:8px 2px;border-top:1px solid var(--line)}
.led li b{font-size:12px;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}.led .found b{color:var(--ok)}.led .near b{color:var(--warn)}.led .missing b{color:var(--miss)}
footer{color:var(--dim);text-align:center;font-size:13px;padding:26px var(--gutter) 40px}
'''
JS = '''(function(){var s=document.getElementById('mapsvg'),box=document.getElementById('mapbox'),z=1;if(!s)return;
document.querySelectorAll('.mapctl button').forEach(function(b){b.addEventListener('click',function(){
var r=box.clientWidth,cx=(box.scrollLeft+r/2)/s.clientWidth,cy=(box.scrollTop+box.clientHeight/2)/s.clientHeight;
z=Math.max(1,Math.min(8,z*(b.dataset.z==='1'?2:.5)));s.style.width=(z*100)+'%';
box.scrollLeft=cx*s.clientWidth-r/2;box.scrollTop=cy*s.clientHeight-box.clientHeight/2;});});})();'''

def render(S):
    secs, ledger, tot = sections(S); name = city_name(S)
    desc = f'{name}: the public map, the roster by street, and every car and hero place as real inspiration beside in-game asset.'
    page = (f'<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{esc(name)} Showcase</title><meta name="description" content="{esc(desc)}"><style>{CSS}</style></head><body>\n'
            + secs[0] + '\n<main>\n' + '\n'.join(secs[1:]) + '\n</main>\n'
            f'<footer>Generated by the city-game factory (tools/factory/showcase_build.py) from this city&rsquo;s own data. Street names only &mdash; no house numbers.</footer>\n'
            f'<script>{JS}</script></body></html>\n')
    return page, ledger, tot

# ------------------------------------------------------------------ privacy audit
def audit(page, book):
    """-> list of problems. Checks visible text + attributes (drawing data is stripped first)."""
    t = re.sub(r'<style.*?</style>|<script.*?</script>', ' ', page, flags=re.S)
    t = re.sub(r'\b(?:d|points|viewBox|style)="[^"]*"', ' ', t)
    t = re.sub(r'<[^>]+>', lambda m: ' ' + ' '.join(re.findall(r'(?:alt|aria-label|title|content)="([^"]*)"', m.group(0))) + ' ', t)
    t = html.unescape(t); bad = []
    for m in re.finditer(r'\b(\d{1,5})\s+(?:[A-Z][A-Za-z\.\']*\s+){0,3}' + STREET_WORDS + r'\b', t):
        if 1900 <= int(m.group(1)) <= 2035 and not re.search(r'^\d+\s+(?:[A-Z][a-z]+\s+){0,3}' + STREET_WORDS + r'\b', m.group(0)): continue
        bad.append(m.group(0))
    for pid, v in (book or {}).items():
        num = str(v[0] if isinstance(v, (list, tuple)) else v).strip(); street = v[1] if isinstance(v, (list, tuple)) and len(v) > 1 else ''
        if street and re.search(r'\b' + re.escape(num) + r'\b\s+' + re.escape(street), t, re.I): bad.append(f'{num} {street}')
        if len(num) >= 3 and not (1900 <= int(num) <= 2035 if num.isdigit() else False) and re.search(r'(?<![\w.])' + re.escape(num) + r'(?![\w.])', t): bad.append(f'number {num}')
    return bad

def build(root, quiet=False):
    root = os.path.abspath(root); S = load(root)
    page, ledger, tot = render(S)
    bad = audit(page, S['book'])
    if bad: sys.exit(f'PRIVACY AUDIT FAILED - house number(s) in the showcase output: {sorted(set(bad))[:5]}; nothing written')
    out = os.path.join(root, 'showcase.generated.html'); open(out, 'w').write(page)
    msg = (f'{out} - {len(page)//1024} KB; pairings: {ledger["found"]} reference photo, {ledger["near"]} near match, {ledger["missing"]} missing '
           f'of {tot}; privacy audit clean')
    if not quiet: print(msg)
    return out, msg

if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('-')]
    import world_cfg
    build(a[0] if a else world_cfg.root())
