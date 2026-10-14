# Round-2 session definitions. Each session: id, ai, slug, title, dep, branch, hard (rules list text), quiz [(q,a)],
# canaries [(where, exact string)], selfcheck [(measure, threshold)], sections (markdown, the MIDDLE of the prompt), imgs (page images).
from sessions_common import *

S = []

GANGS = {
 'cobble_catfish': dict(name='Cobblestone Catfish', animal='channel catfish', district="Fells Point, Pendry: `['fells', 'pendry']`", accent="slate `#5f6688` + teal `#1fd3c6`", fn='buildCobbleCatfish',
   look='Channel catfish: wide flat head, long barbels (4 pairs; the long upper pair is the silhouette), small eyes set wide, forked tail, slick slate skin with a pale belly. Fells Point is cobblestones, tugboats, old taverns and the waterfront: think dockhand slickers, knit watch caps, rubber boots, tavern aprons. Teal is the gang mark.',
   tail='The forked tail sits behind the hips: in the real `down` the rig lies on its back, so a tail that sticks out backward points at the floor. Design it to pass at rest, or follow rule A1 exactly.',
   weapon='an original improvised weapon from the waterfront (a gaff hook with a padded end, a cobblestone in a sock, a tavern stool leg). Keep it non-lethal-looking and PG-13.',
   thin='barbels'),
 'masked_bandits': dict(name='Masked Bandits', animal='raccoons', district="Oriole Park, M&T Bank Stadium, Science Center: `['orioles', 'ravens', 'science']`", accent="orange `#ff9f1c` + grey", fn='buildMaskedBandit',
   look='Raccoons: the black eye mask (use `K.INK`-adjacent dark grey, not pure black), ringed tail, nimble black hands, pointed ears. West side is ballparks and the stadium lots: tailgate gear, oversized jerseys with **no team marks or real logos**, ballcaps, fanny packs. Orange is the gang mark.',
   tail='The ringed tail is long and bushy: it is the hardest part of this gang. In the real `down` the rig lies on its back; a bushy tail behind the hips goes straight through the floor unless you follow rule A1.',
   weapon='an original improvised weapon from the stadium lots (a foam finger with a brick inside, a folded camp chair, a pretzel-stand pole). Non-lethal-looking, PG-13.',
   thin='whiskers'),
 'key_hwy_otters': dict(name='Key Highway Otters', animal='river otters', district="Federal Hill, Domino Sugar, Tide Point, Fort McHenry: `['fedhill', 'domino', 'underarmour', 'fort']`", accent="green `#23c26b` + brown", fn='buildKeyHwyOtter',
   look='River otters: sleek long body, small round ears, broad flat muzzle with whiskers, webbed paws, thick tapering tail. South shore is the Key Highway promenade, the sugar refinery, Tide Point offices and the fort: think track jackets, refinery hard hats (no real company marks), joggers, a drum-major-style sash on the bruiser. Green is the gang mark.',
   tail='The thick tapering tail sits behind the hips: in the real `down` it points at the floor unless it hangs down at rest or follows rule A1.',
   weapon='an original improvised weapon from the south shore (a sugar sack swung like a flail, a rolled jogging mat, a toy cannon ramrod). Non-lethal-looking, PG-13.',
   thin='whiskers'),
}

QUIZ_GANG = lambda branch, extra: [
 ('What is the real `down` pose\'s `shL` value, in radians?', '−2.6 (and `shR` −2.4; armed `windup` raises `shR` to −2.9).'),
 ('What is the largest torso-to-upper-arm gap allowed in `down(1, true)` and `windup(0.6)`?', '1 cm.'),
 ('Which `animateGang` state does the game state `getup` map to?', "`'idle'` (chase→run, windup→attack, dizzy→hurt, down/dying→down)."),
 ('Give the exact texture-cache key expression.', '`K.QUAL || K.THREE || K`'),
 ('What are the knock-down hop numbers and the `down` damping rate?', 'vy 4.2, gravity 22, rate 13; getup after 1.25 s.'),
 ('Which value did Hark change `shX` from and to on Harbor Rats, and why does the bruiser differ?', '0.30 → 0.27; the bruiser keeps 0.30 because it has fur shoulder balls.'),
 ('What is the delivery branch name?', f'`{branch}`'),
 extra,
]

def gang_session(n, gid):
    g = GANGS[gid]; sid = f'O{n}'; slug = gid.replace('_', '-'); branch = f'claude/o{n}-{slug}'
    tok = {'cobble_catfish': ('Catfish Check 410', 'cobble-sextant', 'mussel-lantern'),
           'masked_bandits': ('Bandit Check 410', 'camden-pretzel', 'bullpen-lantern'),
           'key_hwy_otters': ('Otter Check 410', 'refinery-bell', 'ramrod-lantern')}[gid]
    canaries = [('README.md: the last section heading, exactly', f'## {tok[0]}'),
                (f'src/gang_{gid}.js: line 2, exactly', f'// tcr2 {sid.lower()} {tok[1]}'),
                ('Final message: the first line of the filled self-check block, exactly', f'SELF-CHECK {sid} {tok[2]}')]
    quiz = QUIZ_GANG(branch, ('What was the v1 Harbor Rats grunts\' tail lowest point in the real `down` pose, before the fix?', '−0.67 m (bruiser −0.80 m; with the old animateGang −0.52 / −0.62 m).'))
    hard = opus_hard_rules('HD member ≤ 36 parts, ≤ 10,800 tris, ≤ 3 materials (caps 40 / 12,000 / 3).',
                           'Far LOD (`opts.lod === 1`) ≤ 12 parts, ≤ 2,700 tris; it keeps the gang accent part and matches HD colours and proportions.',
                           f'Push to the branch named in §6 of this prompt, never to `main`.')
    sections = f"""## 1 · Context
{OPUS_CONTEXT}

**Where we are:** gang 1 (Harbor Rats) is final in Hark's fixed version. Gang 2 (Pier Gulls) is getting a v1.1 fix pass in session O1. **This session builds gang {n + 1} of 5: the {g['name']}.** Gangs run as separate sessions (O2 Catfish, O3 Bandits, O4 Otters) and may run in parallel.

## 2 · Where you fell short last round and how we fixed it
{OPUS_FELL_SHORT}

## 3 · The task: {g['name']} ({g['animal']})
Build the four members `grunt_a`, `grunt_b`, `armed`, `bruiser` of the **{g['name']}**, district {g['district']}, signature accent {g['accent']}.
- **Look:** {g['look']}
- **Gang read:** one shared uniform motif (jacket colour, bandana or patch shape) so the four read as one gang at 8 m on a 390×844 screen and read as different from the rats (navy + mustard) and the gulls (white + blue). No real gang colours or symbols, no brand logos, no real people.
- **Members:** each has one silhouette hook (a hat, a prop, a posture). `armed` carries {g['weapon']} It lives in `J.swR = K.grp(J.haR, 0, -0.04, 0)` and is built along +Y, at both LODs. `bruiser` is built big (wider and deeper; the game also scales it ×1.2 and doubles its HP).
- **Tail rule for this gang:** {g['tail']}
- **Rule A1 (only if the tail cannot pass at rest):** `animateGang` must lay the tail flat toward the feet in `'down'` and blend it with `J.tilt.rotation.x` in every other state, exactly like Harbor Rats v2; the README must then say in bold that **`animateGang` is required every frame after `applyPose` whenever `down` is used**, and give the measured clearance with and without it.
- **Thin parts:** the {g['thin']} and any strap or rod get `outline: false, shadow: false`. No outlined decorative part may sit mostly inside another outlined part (that is what drew the Harbor Rats belly line).
- **Style:** Harold-level construction (chunky `K.G` primitives, vertex colours, the toon ramp, ink hulls), big readable heads, mid-value colours, `K.INK` for black, at most `#f2f2f2` for white, readable under the night preset. One optional ≤ 256² canvas skin map, drawn deterministically.

## 4 · Interface and budgets
File `src/gang_{gid}.js`, exactly this shape (see `briefs/TASK_C_thug_gangs.md` for the full contract):
```js
// tcr2 …  (line 2: the canary comment from the comprehension check)
export const GANG = {{ id: '{gid}', name: '{g['name']}', animal: '…', district: [ … ], accent: '…', members: ['grunt_a', 'grunt_b', 'armed', 'bruiser'] }};
export const META = {{ grunt_a: {{ hp: 8, scale: 1, radius: 0.42, weapon: null }}, /* … */ bruiser: {{ hp: 16, scale: 1.2, radius: 0.55, weapon: null, big: true }} }};
export function {g['fn']}(K, member = 'grunt_a', opts = {{}}) {{ /* opts: {{ lod: 0 | 1, seed, colors }} */ … return J; }}
export function animateGang(J, t, state) {{ /* optional unless rule A1 applies */ }}
```
- The 18 joints from `K.skeleton()`; a custom `d` keeps the `K.THUG_D` keys with `hip` 0.8–1.0. Facing +Z, feet on y = 0 in idle, height 1.8–2.2 m (bruiser × 1.2).
- One `toonMat` per rig plus at most one mapped sub-material that shares `mat.userData.flash` and `flashC`; hit-flash 0.85 turns the whole rig white, merged and unmerged.

| Budget (per member) | Cap | Round-2 target (≥ 10 % headroom) |
|---|---|---|
| HD parts (meshes, hulls excluded) | 40 | **≤ 36** |
| HD triangles (hulls excluded) | 12,000 | **≤ 10,800** |
| Materials (toon + 1 mapped + shared outline) | 3 | ≤ 3 |
| LOD 1 parts / tris | 14 / 3,000 | **≤ 12 / ≤ 2,700** |
| Lowest non-hull vertex, every real pose and the knock-down blend (feet, weapon excepted) | — | ≥ −0.03 m |
| LOD 1 lowest point in the knock-down | — | ≥ −0.02 m |
| Shoulder gap in `down(1, true)` and `windup(0.6)` | — | ≤ 1 cm |
| Merged draw calls (real `mergeRig`) | — | ≤ 3 (+ ≤ 2 shadow) |

{OPUS_INTEGRATION}

## 5 · Self-test and evidence
{OPUS_EVIDENCE}
- Test the end pose and the blend: `down(u, false)` for u 0.1–1, `down(1, true)`, and hurt → down → getup → idle at 60 fps with the real rates in §2B. Compare HD and LOD 1 silhouettes front, ¾ and side.
- Close front view in daylight: no ink line that follows no edge.

## 6 · Delivery
- **Branch:** push to **`{branch}`** on `{REPO}` (create it from the current `claude/new-session-z5ikqq`). If your environment forces its own branch name, push there and put the branch name in your first and last message. That is how gangs 1 and 2 arrived.
- **Layout:** `src/gang_{gid}.js`, `kit/` (unchanged copy), `viewer.html` (start from `kit/real_viewer.html`), `previews/` (every PNG in §5), `tools/` (your scripts + `results_gang.json`), `README_{gid}.md` (exports, how to view, the measured table, known issues with measured sizes), `LICENSES.md`, and `dist/toadcity_taskC_{gid}_v1.zip` containing all of it.
- Then send Brad the final message: branch, commit hash, zip path, and the filled §7 self-check.

## 7 · Final self-check (fill every cell with a measured number before you say you are done)
| Check | grunt_a | grunt_b | armed | bruiser | Threshold |
|---|---|---|---|---|---|
| HD parts / tris / materials | | | | | ≤ 36 / ≤ 10,800 / ≤ 3 |
| LOD 1 parts / tris | | | | | ≤ 12 / ≤ 2,700 |
| Hulls / shadow casters (HD) | | | | | report |
| Height (idle, t = 0) / feet min y | | | | | 1.8–2.2 m (×1.2 bruiser) / ≥ −0.03 |
| Lowest non-hull point: real `down(1,true)` / knock-down `seq.minY` | | | | | ≥ −0.03 m |
| Tail / ear lowest point in `down`, with and without `animateGang` | | | | | ≥ −0.03 m |
| LOD 1 lowest point in knock-down | | | | | ≥ −0.02 m |
| Shoulder gap `down(1,true)` / `windup(0.6)` | | | | | ≤ 1 cm |
| Real `mergeRig`: draw calls after / flash covers all / animateGang moves bones | | | | | ≤ 3 / yes / yes |
| Max horizontal reach beyond `META.radius` in idle (weapon excepted) | | | | | ≤ 0.35 m |
| `outline:false` parts without `shadow:false` | | | | | 0 |
| Console errors (viewer, day + night) | | | | | 0 |
| Determinism: same seed → same hash | | | | | yes |
"""
    S.append(dict(id=sid, ai='OPUS', slug=f'{sid.lower()}-{slug}', title=f'Thug gang: {g["name"]}', dep='None (parallel with O1–O7). Uses the Harbor Rats v2 reference in the ZIP.',
                  branch=branch, hard=hard, quiz=quiz, canaries=canaries, sections=sections, setting='Claude Opus (newest), extended thinking ON, high effort.',
                  imgs=['after_down_side_grunt_a.png', 'before_down_side_grunt_a.png', 'before_whisker_chest_grunt_a.png', 'after_whisker_chest_grunt_a.png', 'before_lod_vs_hd_armed.png', 'after_lod_vs_hd_armed.png', 'harbor_rats_fixes_compare.png'],
                  scope=f'{g["name"]} ({g["animal"]}): 4 members + far LOD, district {g["district"].split(":")[0]}'))

# ---- O1: Pier Gulls v1.1 ----
def o1():
    branch = 'claude/o1-pier-gulls-v1-1'
    canaries = [('README_pier_gulls.md: the last section heading, exactly', '## Gull Check 410'),
                ('src/gang_pier_gulls.js: line 2, exactly', '// tcr2 o1 rockfish-tide'),
                ('Final message: the first line of the filled self-check block, exactly', 'SELF-CHECK O1 pier-four-lantern')]
    quiz = [
     ('What is the real windup duration for a bruiser, and its damping rate?', '0.7 s (others 0.5 s) at rate 12.'),
     ('Attack: pose argument, rate, lunge time, and when does the thug go back to chase?', '`attack(st / 0.3)`, rate 26, lunge for the first 0.12 s, back to chase at 0.55 s.'),
     ('Hurt and dizzy damping rates?', 'hurt 24 (0.32 s, exits at 0.34 s); dizzy 10.'),
     ('Thug getup: duration and rate?', '0.5 s at rate 14 (0.45 s is the hero getup, not the thug one).'),
     ('How many triangles does your v1 armed gull have, and how many must you cut?', '11,656; cut at least 656 to reach ≤ 11,000.'),
     ('How much of the beanie may be buried in the head?', 'Under 55 %.'),
     ('What colour must the far-LOD hands be?', 'Dark wingtip colour (the gull\'s dark primaries), not the body colour.'),
     ('What is the delivery branch name?', f'`{branch}`'),
    ]
    hard = opus_hard_rules('every HD gull ≤ 38 parts and ≤ 11,000 tris (at least 2 parts and 1,000 tris under the 40 / 12,000 caps), ≤ 3 materials.',
                           'Far LOD ≤ 14 parts, ≤ 3,000 tris; its lowest point in the knock-down ≥ −0.02 m; hands in the dark wingtip colour.',
                           'Change only what §3 lists; keep everything that already passes. Push to the branch named in §6.')
    sections = f"""## 1 · Context
{OPUS_CONTEXT}

**This session is the Pier Gulls v1.1 fix pass**, not a new gang. Your v1 (`f1cfba4` on `claude/new-session-z5ikqq`, `dist/toadcity_taskC_pier_gulls_v1.zip`, QA page `tools/qa.html`) is in the ZIP at `reference/pier_gulls_v1/`. Gang 1 (Harbor Rats) stays Hark's fixed version: do not touch it.

## 2 · Where you fell short last round and how we fixed it
{OPUS_FELL_SHORT}

## 3 · The task: Pier Gulls v1.1
Measured numbers from your own v1 README (idle, t = 0):

| member | HD parts | HD tris | v1.1 target | LOD 1 knock-down low point |
|---|---|---|---|---|
| grunt_a | 33 | 10,760 | ≤ 38 / ≤ 11,000 (passes) | −2.1 cm → ≥ −2.0 cm |
| grunt_b | 33 | 11,056 | cut ≥ 56 tris | −2.1 cm → ≥ −2.0 cm |
| armed | 36 | 11,656 | cut ≥ 656 tris | check |
| bruiser | 33 | 11,072 | cut ≥ 72 tris | check |

Do exactly these, then re-measure everything:
1. **Real `mergeRig`:** delete the emulation from your QA; import `kit/real_mergeRig.js` in the viewer and in `tools/qa.js`; report draw calls after merge, that the hit-flash covers every merged mesh, and that `animateGang` still moves the merged bones.
2. **Real timings:** replace your assumed phases with the table in §2B (windup 0.5 s / bruiser 0.7 s at rate 12; attack `attack(st/0.3)` at rate 26 with a 0.12 s lunge, back to chase at 0.55 s; hurt 0.32 s at rate 24; dizzy rate 10; getup 0.5 s at rate 14; idle/chase rate 14). `kit/real_viewer.html?seq=attack|hurt|knockdown` plays them. Re-run every ground and shoulder check through these sequences.
3. **Margins:** every HD member ≤ 38 parts and ≤ 11,000 tris (lower segment counts on hidden spheres first; do not drop the gang read).
4. **Beanie:** the bruiser's beanie must be < 55 % buried in the head (measure the share of its surface inside the head volume; report it).
5. **Far LOD:** lowest point in the knock-down ≥ −0.02 m (it was −0.021 m); hands in the dark wingtip colour so the LOD keeps the gull read.
6. **README:** measured numbers only, with the new timings named in "How things are measured"; remove every "assumed" line.

## 4 · Interface and budgets
Unchanged from v1 (`GANG`, `META`, `buildPierGull(K, member, opts)`, `animateGang`). Budgets for v1.1:

| Budget (per member) | Cap | v1.1 target |
|---|---|---|
| HD parts | 40 | **≤ 38** |
| HD tris | 12,000 | **≤ 11,000** |
| Materials | 3 | ≤ 3 |
| LOD 1 parts / tris | 14 / 3,000 | ≤ 14 / ≤ 3,000 |
| LOD 1 knock-down low point | — | ≥ −0.02 m |
| Beanie buried share (bruiser) | — | < 55 % |

{OPUS_INTEGRATION}

## 5 · Self-test and evidence
{OPUS_EVIDENCE}
- **Before/after pairs** for each change (v1 render left, v1.1 right): merged flash, knock-down strip, LOD hands, bruiser beanie side view.

## 6 · Delivery
- **Branch:** push to **`{branch}`** on `{REPO}` (branch it from `f1cfba4`). If your environment forces its own branch name, push there and name it in your first and last message.
- **Layout:** as v1, plus `dist/toadcity_taskC_pier_gulls_v1_1.zip`; `previews/before_after/`.
- Final message to Brad: branch, commit, zip path, filled §7.

## 7 · Final self-check (measured numbers only)
| Check | grunt_a | grunt_b | armed | bruiser | Threshold |
|---|---|---|---|---|---|
| HD parts / tris / materials | | | | | ≤ 38 / ≤ 11,000 / ≤ 3 |
| LOD 1 parts / tris | | | | | ≤ 14 / ≤ 3,000 |
| Real `mergeRig` draw calls after / flash covers all / bones animate | | | | | ≤ 3 / yes / yes |
| Lowest point: `seq=knockdown`, `seq=attack`, `seq=hurt` (HD) | | | | | ≥ −0.03 m |
| LOD 1 lowest point in knock-down | | | | | ≥ −0.02 m |
| Shoulder gap `down(1,true)` / `windup(0.6)` | | | | | ≤ 1 cm |
| Beanie buried share | — | — | — | | < 55 % |
| LOD hands colour = wingtip colour | | | | | yes |
| Console errors | | | | | 0 |
"""
    S.append(dict(id='O1', ai='OPUS', slug='o1-pier-gulls-v1-1', title='Pier Gulls v1.1 fix pass', dep='Pier Gulls v1 (f1cfba4). Parallel with O2–O7.', branch=branch, hard=hard, quiz=quiz,
                  canaries=canaries, sections=sections, setting='Claude Opus (newest), extended thinking ON, high effort.',
                  imgs=['pier_gulls_lineup_day.png', 'pier_gulls_lineup_night.png', 'pier_gulls_bruiser_knockdown_60fps.png', 'pier_gulls_armed_hd_vs_lod1.png', 'after_real_merged_flash.png'],
                  scope='Pier Gulls v1.1: real mergeRig, real timings, ≥2 parts/1k tris margin, beanie <55% buried, LOD dip ≥ −2 cm, dark wingtip LOD hands'))

# ---- bosses ----
BOSSES = [
 ('bird_brain_bobby', 'Bird Brain Bobby', 'orioles', 'A rogue bird mascot (orange-and-black songbird, original design) who pitches fastballs down a brick warehouse hallway'),
 ('raven_king', 'The Raven King', 'ravens', 'A giant raven linebacker in shoulder pads (original colours) with a "Nevermore" blitz charge'),
 ('dr_shellacious', 'Dr. Shellacious', 'science', 'A mad snapping-turtle scientist in a lab coat and goggles who fights in the IMAX theatre'),
 ('hon_queen', 'The Hon Queen', 'fedhill', 'Beehive hair, cat-eye glasses and leopard-print capris; throws hairspray clouds and shoves you down the hill'),
 ('sugar_rush', 'Sugar Rush', 'domino', 'A sugar-crystal golem, faceted and glittering, glowing at night beside the neon sign'),
 ('compression_king', 'The Compression King', 'underarmour', 'An athleisure mannequin brute in blank, unbranded gear'),
 ('admiral_redclaw', 'Admiral Redclaw', 'fort', 'A redcoat crab admiral from 1812 with a cannon arm firing rocket barrages'),
 ('big_jimmy', 'Big Jimmy', 'aquarium', 'A giant blue crab (a male "jimmy") fought underwater'),
 ('voltage_vic', 'Voltage Vic', 'powerplant', 'An electric-eel DJ whose attacks drop on a Baltimore club beat'),
 ('chef_crabcake', 'Chef Crabcake', 'fourseasons', 'A chef who throws blinding seasoning and swings two crab mallets'),
 ('arabber_al', 'Arabber Al', 'fells', 'A street-produce arabber on a souped-up horse-cart that runs a car chase'),
 ('pool_shark', 'The Pool Shark', 'pendry', 'A shark hustler in a cabana shirt and sunglasses, with a pool-cue attack and a belly-flop splash'),
 ('dragon_boat_duchess', 'Dragon Boat Duchess', 'harborplace', "Rides a giant dragon paddle boat; regal and tiara'd, with a paddle-sceptre"),
 ('captain_cobblestone', 'Captain Cobblestone', 'constellation', 'A ghost privateer: translucent glow at night, cutlass and lantern'),
 ('penthouse_pigeon', 'The Penthouse Pigeon', 'wtc', 'A rich pigeon in a smoking jacket on a rooftop deck'),
 ('stoop_scrubber', 'The Stoop Scrubber', 'monument', 'A marble-step matriarch with a scrub brush, a bucket and slippery suds'),
 ('mister_formstone', 'Mister Formstone (final boss)', 'city-wide', 'A crime lord whose face and body are fake-stone (Formstone) armour plates that crack off in phases to reveal the creature beneath'),
]
BATCH = {5: BOSSES[0:6], 6: BOSSES[6:12], 7: BOSSES[12:17]}
BTOK = {5: ('Ballpark Check 410', 'warehouse-fastball', 'nevermore-lantern'),
        6: ('Pier Boss Check 410', 'redclaw-rocket', 'jimmy-lantern'),
        7: ('Formstone Check 410', 'duchess-sceptre', 'formstone-lantern')}

def boss_session(n):
    sid = f'O{n}'; L = BATCH[n]; branch = f'claude/o{n}-bosses-{["", "", "", "", "", "a", "b", "c"][n]}'
    roster = '\n'.join(f'| `{b[0]}` | {b[1]} | `{b[2]}` | {b[3]} |' for b in L)
    tok = BTOK[n]
    canaries = [('README_bosses.md: the last section heading, exactly', f'## {tok[0]}'),
                ('Every src/boss_<id>.js: line 2, exactly', f'// tcr2 {sid.lower()} {tok[1]}'),
                ('Final message: the first line of the filled self-check block, exactly', f'SELF-CHECK {sid} {tok[2]}')]
    special = []
    ids = [b[0] for b in L]
    if 'arabber_al' in ids or 'dragon_boat_duchess' in ids:
        special.append('- **Vehicle bosses** (Arabber Al\'s cart, the Duchess\'s dragon boat): rider and vehicle in one module; `J.vehicle` is a Group under `J.root`, parented so `mergeRig` merges it; the vehicle counts toward the part budget. The dragon boat sits on the waterline: hull bottom at y = −0.85 relative to the pier top is the water (`WY`).')
    if any(i in ids for i in ('sugar_rush', 'voltage_vic', 'captain_cobblestone')):
        special.append('- **Night glow** (Sugar Rush crystals, Voltage Vic sparks, Captain Cobblestone ghost): `K.basicMat({ transparent: true })` parts whose opacity follows `K.NIGHT.value` in `animateBoss`. No lights. The glow parts get `outline: false, shadow: false`.')
    if 'mister_formstone' in ids:
        special.append('- **Mister Formstone goes last.** `opts.phase` 0/1/2 removes armour plates in stages, and `J.plates` lists the plate meshes so the game can knock them off. Plates must survive `mergeRig`: keep them as separate parts under their joint, and document whether integration should merge before or after removing plates (measure both).')
    if 'big_jimmy' in ids:
        special.append('- **Big Jimmy** is fought underwater in the Aquarium tank: a crab rig with 8 legs + 2 claws still uses the 18 skeleton joints for its body and arms; extra legs go on extra groups under `J.hips` animated in `animateBoss`, safe to skip.')
    special = '\n'.join(special) or '- No vehicle or glow bosses in this batch.'
    quiz = [
     ('How many entries must `ATTACKS` have, and what must each attack\'s `active` window line up with?', 'Exactly 3; the visible strike frame of its pose.'),
     ('At which damping rates does the game apply hero attack, hurt and down/getup poses (the rates to test boss poses at)?', 'attack 30, hurt 22, down/getup 14.'),
     ('Size of the model sheet image, and what views does it hold?', '2048×1024: front, ¾, side, back, plus atk1, atk2, atk3, labelled, neutral grey, day preset.'),
     ('How close must `META.height` be to the measured bounding box?', 'Within 10 %.'),
     ('What drives the opacity of a night-glow part?', '`K.NIGHT.value`, in `animateBoss` (basicMat, transparent; no lights).'),
     ('Which function must every boss rig pass through, and what draw-call count do we expect after it?', 'The real `mergeRig` (`kit/real_mergeRig.js`); about 3–5 draw calls (one per material + one outline).'),
     ('What is the delivery branch name?', f'`{branch}`'),
     ('Which Harbor Rats fix changed the neckerchief diamond, and how?', 'Fix 3: moved proud of the belly (z +0.02 → +0.04, tilt −0.25 → −0.45) so its hull no longer draws a stray ink line.'),
    ]
    hard = opus_hard_rules('each boss ≤ 63 parts, ≤ 19,800 tris, ≤ 4 materials (caps 70 / 22,000 / 4).',
                           'Exactly 3 `ATTACKS`, each with a distinct silhouette and an `active` window on the visible strike frame.',
                           'One boss at a time: design note → build + idle → attacks → hurt/down/run → sheet + previews → self-check, then the next. Push to the branch named in §6.')
    sections = f"""## 1 · Context
{OPUS_CONTEXT}

**This session builds {len(L)} of the 17 approved bosses** (batch {n - 4} of 3; sessions O5, O6, O7 may run in parallel). Bosses are original characters: no real people, likenesses, official mascots, team marks or brand logos on them.

## 2 · Where you fell short last round and how we fixed it
These lessons come from the gangs, but every one applies to boss rigs (capes, tails, shells, wings and backpacks hit the floor in a flat-on-back `down` exactly like a rat tail).
{OPUS_FELL_SHORT}

## 3 · The task: bosses for this batch
| id | Boss | Landmark id | Approved concept (keep it) |
|---|---|---|---|
{roster}

Per boss, in order: (1) a ~120-word design note (silhouette, palette, the three attacks); (2) build + idle, self-tested; (3) atk1–atk3, self-tested; (4) hurt, down, run; (5) the model sheet and previews; (6) the §7 row.
{special}
- A small boss-owned prop (a lectern, a DJ booth, a bucket) is fine and counts toward the budget. No landmark architecture.
- `down` for a boss is your own `POSES.down`; if it lays the rig on its back, everything behind the hips must stay above y = −0.03 m (lessons A1–A2).

## 4 · Interface and budgets
File `src/boss_<id>.js` (full contract in `briefs/TASK_D_bosses.md`):
```js
// tcr2 …  (line 2: the canary comment)
export const META = {{ id: 'raven_king', name: 'The Raven King', district: 'ravens', hp: 120, scale: 1.6, radius: 0.9, height: 3.4 }};
export const ATTACKS = [ {{ id, pose: 'atk1', dur, windup, active: [a, b], reach, arc, dmg, move?, fx }}, /* atk2 */, /* atk3 */ ];
export function buildRavenKing(K, opts = {{}}) {{ const mat = K.toonMat(); const J = K.skeleton(D, mat); /* … */ J.kind = 'boss'; J.meta = META; return J; }}
export const POSES = {{ idle(t, J) {{}}, run(t, speed, J) {{}}, hurt(u, J) {{}}, down(u, ground, J) {{}}, atk1(u, J) {{}}, atk2(u, J) {{}}, atk3(u, J) {{}} }};
export function animateBoss(J, t, state, u) {{ /* optional; safe to skip */ }}
```
Poses are built from `K.blank()` with `K.legsStance()` / `K.runLegs()` and applied with `K.applyPose(J, pose, rate, dt, snapTilt)` (hero attacks use rate 30, hurt rate 22, down/getup rate 14 in the game: test your poses at those rates).

| Budget (per boss) | Cap | Round-2 target |
|---|---|---|
| Parts (meshes, hulls excluded) | 70 | **≤ 63** |
| Triangles (hulls excluded) | 22,000 | **≤ 19,800** |
| Materials | 4 (toon + ≤ 2 mapped + 1 glow) | ≤ 4 |
| Merged draw calls (real `mergeRig`) | — | report (≤ 5 expected) |
| `META.height` vs measured | — | within 10 % |
| Lowest non-hull point in every pose (feet, weapon excepted) | — | ≥ −0.03 m |

{OPUS_INTEGRATION}

## 5 · Self-test and evidence
{OPUS_EVIDENCE}
- Per boss: `previews/<id>_sheet.png` (2048×1024), `<id>_day.png`, `<id>_night.png`, `<id>_phone_390x844.png` and `<id>_phone_390x844_night.png` (boss facing Harold at about 6 m), plus an attack strip that marks the `active` window frames.

## 6 · Delivery
- **Branch:** push to **`{branch}`** on `{REPO}`. If your environment forces its own branch name, push there and name it in your first and last message.
- **Layout:** `src/boss_<id>.js` per boss, `kit/` (unchanged), `viewer.html` (from `kit/real_viewer.html`, add `?show=<boss>&pose=atk1…`), `previews/`, `tools/`, `README_bosses.md` (per-boss measured table, known issues with sizes), `LICENSES.md`, `dist/toadcity_taskD_batch{n - 4}_v1.zip`.

## 7 · Final self-check (one row per boss, measured numbers only)
| Boss | Parts | Tris | Mats | Merged calls | Height vs META | Lowest point (all poses) | 3 attacks distinct + active on strike frame | Flash merged | Console errors |
|---|---|---|---|---|---|---|---|---|---|
{chr(10).join(f'| `{b[0]}` | | | | | | | | | |' for b in L)}
| **Threshold** | ≤ 63 | ≤ 19,800 | ≤ 4 | report | ±10 % | ≥ −0.03 m | yes | yes | 0 |
"""
    S.append(dict(id=sid, ai='OPUS', slug=f'{sid.lower()}-bosses-{"abc"[n - 5]}', title=f'Bosses batch {n - 4}: ' + ', '.join(b[1].split(' (')[0] for b in L),
                  dep='None (parallel). Mister Formstone (O7) is built last within O7.' if n == 7 else 'None (parallel with O1–O7).',
                  branch=branch, hard=hard, quiz=quiz, canaries=canaries, sections=sections,
                  setting='Claude Opus (newest), extended thinking ON, high effort (max for Mister Formstone, the vehicle bosses and Sugar Rush).',
                  imgs=['heroes_day.jpg', 'heroes_night.jpg', 'after_real_merged_lineup.png', 'before_down_side_bruiser.png', 'after_down_side_bruiser.png'],
                  scope='Bosses: ' + ', '.join(b[0] for b in L)))

o1()
for i, gid in enumerate(['cobble_catfish', 'masked_bandits', 'key_hwy_otters']):
    gang_session(i + 2, gid)
for n in (5, 6, 7):
    boss_session(n)
