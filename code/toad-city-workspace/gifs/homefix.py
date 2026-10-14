#!/usr/bin/env python3
"""homefix.py <index.html> [--skip key,key] [--report path]
Swaps the Toad City home page's stale "In production" / "Coming soon" labels for live links + media (Brad 2026-10-13:
"Update home page. Lots still say in production."). Idempotent: every edit matches the old text exactly and is skipped
when it is already applied. Keys can be skipped (--skip) when that feature is not in the live game yet.
Edits the built-site source (/workspace/built/sites/d5e6bf6a-.../index.html); publish.sh copies it into site/home.
Keeps "coming"/"in progress" for what genuinely is not done: the gang wiring (gangs) and the HD landmark pass."""
import sys, re, json
args = sys.argv[1:]
path = args[0]
skip = set()
report_path = None
if '--skip' in args: skip = set(args[args.index('--skip') + 1].split(','))
if '--report' in args: report_path = args[args.index('--report') + 1]
html = open(path, encoding='utf-8').read()
G = 'https://toad-city-baltimore.surge.sh'
rep = []

def sub(key, old, new, what):
    global html
    if key in skip: rep.append(f'SKIPPED [{key}] {what}'); return
    if new in html and old not in html: rep.append(f'already [{key}] {what}'); return
    n = html.count(old)
    if n == 0: rep.append(f'NOT FOUND [{key}] {what}'); return
    html = html.replace(old, new); rep.append(f'changed [{key}] {what}' + (f' (x{n})' if n > 1 else ''))

def play(q, label='Play now ▶'):
    return f'<a class="x-badge x-badge--green x-live" href="{G}/{q}" target="_blank" rel="noopener">{label}</a>'

def gif(name, label='Watch the loop'):
    return f'<a class="x-badge x-badge--cream x-live" href="gallery/{name}.mp4" target="_blank" rel="noopener">▶ {label}</a>'

# small style for the link badges (once)
CSS = '.x-live { text-decoration: none; cursor: pointer; } .x-live:hover { filter: brightness(1.08); } .x-liverow { display: flex; flex-wrap: wrap; gap: 8px; }'
if CSS not in html:
    html = html.replace('</style>\n    <script>\n      window.onYouTubeIframeAPIReady', '  ' + CSS + '\n    </style>\n    <script>\n      window.onYouTubeIframeAPIReady', 1)

# ---- bosses: 13 "In production" badges -> Play now (direct-start link) ----
BOSSES = [  # (name in the card, game query, gallery-free)
    ('The Raven King', '?ravenking=1'), ('Dr. Shellacious', '?shellacious=1'), ('The Hon Queen', '?honqueen=1'),
    ('Sugar Rush', '?sugarrush=1'), ('The Compression King', '?compking=1'), ('Chef Crabcake', '?crabcake=1'),
    ('The Pool Shark', '?poolshark=1'), ('Captain Cobblestone', '?cobblestone=1'), ('The Penthouse Pigeon', '?pigeon=1'),
    ('The Stoop Scrubber', '?scrubber=1'), ('Pit Beef Pete', '?pete=1'), ('Kingpin Carl', '?carl=1'), ('Riptide Rodney', '?duel=rodney'),
]
for name, q in BOSSES:
    m = re.search(r'(<article class="x-boss">(?:(?!</article>).)*?<h3>' + re.escape(name) + r'</h3>(?:(?!</article>).)*?)<span class="x-badge x-badge--red">In production</span>', html, re.S)
    if m:
        html = html[:m.start()] + m.group(1) + play(q) + html[m.end():]; rep.append(f'changed [boss] {name}: "In production" -> Play now ▶ {G}/{q}')
    elif ('<h3>' + name + '</h3>') in html and (G + '/' + q) in html: rep.append(f'already [boss] {name}')
    else: rep.append(f'NOT FOUND [boss] {name}')

# final boss
sub('brewmaster', '<div class="x-badges"><span class="x-badge">Final boss</span><span class="x-badge x-badge--cream">In production</span></div>',
    '<div class="x-badges"><span class="x-badge">Final boss</span>' + play('?brewmaster=1') + gif('bosses_all', 'All 21 bosses') + '</div>',
    f'Final boss One-Eyed Brewmaster: "In production" -> Play now ▶ {G}/?brewmaster=1 + gallery/bosses_all.mp4')

# ---- Fells Point Phantoms card (gang section): Coming soon -> playable night mission ----
sub('phantoms', '<span class="x-badge">Coming soon</span>\n                <h3>Fells Point Phantoms</h3>',
    '<div class="x-liverow">' + play('?phantoms=1') + gif('features_phantoms') + '</div>\n                <h3>Fells Point Phantoms</h3>',
    f'Fells Point Phantoms: "Coming soon" -> Play now ▶ {G}/?phantoms=1 + gallery/features_phantoms.mp4')

# ---- landmarks: Lexington Market is built ----
sub('lexington', '<h3 class="x-h3">Coming</h3>\n            <span class="x-badge">Coming soon</span>',
    '<h3 class="x-h3">New district</h3>\n            <span class="x-badge x-badge--green">Walkable now</span>',
    'Landmarks "Coming / Coming soon" (Lexington Market) -> "New district / Walkable now"')
sub('stadiums', '<li>Oriole Park</li>\n            <li>M&amp;T Bank Stadium</li>',
    '<li>Oriole Park · HD ballpark</li>\n            <li>M&amp;T Bank Stadium · HD field</li>',
    'Blockout list: Oriole Park + M&T Bank Stadium now flagged HD (stadiums pass live); rest of the list stays "HD coming" (landmark pass in progress)')

# ---- "Coming to the city" section -> "New in the city" with live links ----
sub('coming-head', '<p class="head__eyebrow">On the way</p>\n            <h2 class="x-h2">Coming to the city</h2>',
    '<p class="head__eyebrow">Just shipped</p>\n            <h2 class="x-h2">New in the city</h2>',
    'Section "On the way / Coming to the city" -> "Just shipped / New in the city"')
CARDS = [  # key, card title, play query, gallery clip (or None)
    ('lexington', 'Lexington Market', '', None),
    ('poe', "Poe's grave stealth night", '?poe=1', 'features_poe'),
    ('fishing', 'Harbor fishing and Chompy', '?fish=1', 'features_fishing'),
    ('grandprix', 'Harbor Grand Prix', '?duel=grandprix', 'features_grandprix'),
    ('hooters', 'Hooters at Harborplace', '', None),
    ('drone', 'Drone mode', '?finale=1', 'features_drone'),
]
for key, title, q, clip in CARDS:
    old = f'<span class="x-badge">Coming soon</span><h3>{title}</h3>'
    lab = 'Walk there now ▶' if not q else 'Play now ▶'
    new = '<div class="x-liverow">' + play(q, lab) + (gif(clip) if clip else '') + f'</div><h3>{title}</h3>'
    sub(key, old, new, f'"{title}": "Coming soon" -> {lab} {G}/{q}' + (f' + gallery/{clip}.mp4' if clip else ''))

# new shipped cards appended to the same grid (once)
NEW = [
    ('rigs', 'Real rigs for Harold, Mavis and the Brewmaster', 'Smooth-skinned procedural skeletons with hand-keyed walks, swings and hugs. Add ?oldrigs=1 to compare with the old blocky rigs.', play('', 'Play now ▶') + f'<a class="x-badge x-badge--cream x-live" href="{G}/?oldrigs=1" target="_blank" rel="noopener">Old rigs</a>'),
    ('polish', 'First fights, polished', 'The Dragon Boat Duchess, Big Jimmy and Chef Crabcake got clearer tells, cane combos on dizzy bosses, new POWER moves and Mavis crab-cake heals.', play('?duchess=1', 'Duchess ▶') + play('?jimmy=1', 'Big Jimmy ▶') + play('?crabcake=1', 'Chef Crabcake ▶')),
    ('finalecrowd', 'The city cheers back', 'Beat the Brewmaster and the drone takes an autopilot flyover while toad townsfolk wave from windows, rooftops and marble stoops.', play('?finale=1', 'See the finale ▶') + gif('features_fireworks', 'Fireworks loop')),
    ('stadiums', 'Camden Yards and M&amp;T in HD', 'A real diamond with chalk, bases and the B&amp;O warehouse; a striped 100-yard field with purple end zones.', play('', 'Walk there now ▶') + gif('features_derby', 'Derby loop')),
    ('desktop', 'Toad City for Mac + ES-DE', 'An unsigned universal Mac app with controller support and an ES-DE setup kit (pre-release).', '<a class="x-badge x-badge--green x-live" href="https://github.com/bparlette/Hawk/releases/tag/desktop-v2" target="_blank" rel="noopener">Download desktop-v2 ▶</a>'),
]
grid_anchor = '<h3>Drone mode</h3>'
i = html.find(grid_anchor)
if i >= 0:
    end = html.find('</div>\n        </section>', i)
    add = ''
    for key, title, body, links in NEW:
        if key in skip: rep.append(f'SKIPPED [{key}] new card "{title}"'); continue
        if f'<h3>{title}</h3>' in html: rep.append(f'already [{key}] new card "{title}"'); continue
        add += f'\n            <article class="x-ink"><div class="x-ink__body"><div class="x-liverow">{links}</div><h3>{title}</h3><p>{body}</p></div></article>'
        rep.append(f'added [{key}] new card "{title}"')
    if add and end > 0: html = html[:end] + add.lstrip('\n').join(['\n', '']) + '\n          ' + html[end:]
else: rep.append('NOT FOUND drone card anchor for new cards')

open(path, 'w', encoding='utf-8').write(html)
left = re.findall(r'(?i)in production|coming soon|coming to the city', html)
rep.append(f'remaining "in production / coming soon" strings: {len(left)}')
out = '\n'.join(rep)
print(out)
if report_path: open(report_path, 'w').write(out + '\n')
