#!/usr/bin/env python3
# Round-2 generator: session prompts (md), hosted pages (html), per-AI ZIP kits, ROUND2_INDEX.md, ANSWER_KEYS.md (private).
import os, re, json, shutil, html, zipfile, glob, subprocess, sys, secrets
import markdown
sys.path.insert(0, os.path.dirname(__file__))
import sessions_common as C
import sessions2  # noqa: registers everything in sessions.S
from sessions import S, BOSSES

H = '/workspace/work/toad-city/handoff'; R2 = H + '/round2'; B = R2 + '/build'; COMMON = B + '/common'
PROMPTS = H + '/prompts/round2'; PAGES = B + '/pages'; ZIPS = R2
G = '/workspace/work/toad-city/game'; REV = '/workspace/work/reviews'; VENDOR = G + '/vendor/taskAB'
os.makedirs(PROMPTS, exist_ok=True); os.makedirs(PAGES, exist_ok=True)
AI_NAME = {'OPUS': 'Claude Opus', 'SONNET': 'Claude Sonnet', 'GEMINI': 'Gemini Pro', 'HAIKU': 'Claude Haiku', 'GROK': 'Grok'}

# ---------------- fill build-time placeholders ----------------
def vendor_text():
    t = ''
    for f in sorted(glob.glob(VENDOR + '/*.js')): t += open(f).read()
    return t
VT = vendor_text()
cars_changed = False
try:
    a = open(REV + '/hawk-ab/src/veh_cars.js').read(); b = open(VENDOR + '/veh_cars.js').read()
    cars_changed = len(set(a.split('\n')) ^ set(b.split('\n'))) > 100
except Exception: pass
def status(marker):
    if marker is None: return 'Round-2 rule (applies to your new work)'
    if marker == 'CARS': return 'Superseded: cars rebuilt in-house (in progress)' if cars_changed else 'Pending'
    if marker == 'META_': return 'Fixed in-house' if re.search(r'export const META_[A-Z_]+', VT) else 'Pending'
    return 'Fixed in-house' if marker in VT else '**Pending**'
rows = '\n'.join(f'| {i} | {f} | {x} | {status(m)} |' for i, f, x, m in sessions2.SONNET_ROWS)
STATUS_TABLE = '| # | Before (finding, measured) | After (fix) | Status at ZIP build |\n|---|---|---|---|\n' + rows
SONNET_STATUS = {i: status(m) for i, f, x, m in sessions2.SONNET_ROWS}

LMS = re.findall(r"landmark\('([a-z]+)', '([^']+)'", open(G + '/src/03_city.js').read())
LM_TEXT = ' · '.join(f'`{i}` {n}' for i, n in LMS)
BOSS_TEXT = ' · '.join(f'`{b[0]}` {b[1]} ({b[3]})' for b in BOSSES)
for s in S:
    s['sections'] = s['sections'].replace('{SONNET_STATUS_TABLE}', STATUS_TABLE).replace('{BOSSES}', BOSS_TEXT).replace('{LANDMARKS}', LM_TEXT)
# H2 hard rules (scripts, not JSON)
for s in S:
    if s['id'] == 'H2':
        s['hard'] = """1. Output only the two scripts §3 asks for, plus one example run each.
2. Node 18+ ES modules, zero npm dependencies, each script ≤ 150 lines.
3. Never print the expected-strings file except inside per-string result lines.
4. Every finding names file and line.
5. Error-level findings exit with the code §3 names; warnings never change the exit code.
6. No regex lookbehind; no network access; read-only on the scanned folder.
7. Comment every check with the round-1 bug it catches.
8. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**."""

# ---------------- Step 0 gate (per-session flag, approved by Brad 11 Oct 2026) ----------------
# one_go=True: small sessions answer Step 0 at the top of the reply and continue straight into the deliverable (no GO wait).
# Build sessions (O*, S*, G2) keep the STOP-until-GO gate.
ONE_GO_IDS = {'G1', 'G3', 'H1', 'H2', 'GR1'}
STOP_LINE = 'Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**.'
ONE_GO_LINE = ('Answer the Step 0 comprehension check at the top of your reply, then continue straight into the full deliverable in the same reply; '
               'do not wait for GO. If any Step 0 answer reveals a conflict or a missing file, state your assumption and proceed.')
for s in S:
    s['one_go'] = s['id'] in ONE_GO_IDS
    if s['one_go']:
        if STOP_LINE not in s['hard']: raise SystemExit(f"Step 0 STOP line not found in {s['id']} hard rules")
        s['hard'] = s['hard'].replace(STOP_LINE, ONE_GO_LINE)

# ---------------- prompt assembly ----------------
ZIPNAME = {k: f'Toad_City_Round2_{k}.zip' for k in AI_NAME}
ZIP_TABLE = {'OPUS': C.OPUS_ZIP_FILES, 'SONNET': C.SONNET_ZIP_FILES, 'GEMINI': C.GEM_ZIP_FILES,
             'HAIKU': """| ZIP path | What it is |
|---|---|
| `README_ZIP.md` | Index of the ZIP. |
| `reference/rowkit/rowkit_rowhouse.js`, `rowkit_corner.js`, `rowkit_tiles.js`, `rowkit_block.js` | The rowhouse kit (Hark's fixed copy) whose overrides and sign boards your tables feed. |
| `reference/rowkit/ALLOWED_VALUES.md` | The override names and allowed values, copied from the code. |
| `reference/lint_targets/` | Round-1 lessons your lint script must catch (Harbor Rats and Task A/B review excerpts). |
| `prompts/` | H1 and H2 session prompts. |""",
             'GROK': """| ZIP path | What it is |
|---|---|
| `README_ZIP.md` | Index of the ZIP. |
| `reference/radio_stations.js` | The station ids, names and track lists from the game's `src/08_radio.js` (excerpt). |
| `reference/landmarks.js` | The game's `LANDMARKS` list (ids, popup names, bosses) from `src/03_city.js`. |
| `reference/roster.md` | Gangs and the 17 bosses with their approved concepts. |
| `reference/screens/` | Game screenshots for tone. |
| `prompts/` | The GR1 session prompt. |"""}

def plant(sections, canaries):
    parts = re.split(r'(?m)^(?=## )', sections)
    parts = [p for p in parts if p.strip()]
    n = len(parts)
    slots = [min(2, n - 2), min(3, n - 2), min(4, n - 2)] if n >= 5 else [1, max(1, n - 3), max(1, n - 2)]
    for k, (where, val) in enumerate(canaries):
        i = slots[k]
        parts[i] = parts[i].rstrip() + f"\n\n> **Canary {k + 1} of 3 (required in your delivery):** {where}: `{val}`\n\n"
    return ''.join(parts)

def prompt_md(s):
    hr = s['hard']
    qs = '\n'.join(f'   - Q{i + 1}. {q}' for i, (q, a) in enumerate(s['quiz']))
    has_zip = True
    if s.get('one_go'):
        step0_head = '## Step 0 · Comprehension check (at the TOP of your reply, then continue straight into the full deliverable in the same reply)'
        step0_tail = ('Then continue straight into the full deliverable in this same reply; do not wait for GO. '
                      'If any Step 0 answer reveals a conflict or a missing file, state your assumption and proceed. Brad hands your whole reply to Hark, who checks the Step 0 answers.')
    else:
        step0_head = '## Step 0 · Comprehension check (your FIRST reply; write no code and produce no deliverable until Brad answers GO)'
        step0_tail = 'Then stop and wait. Brad checks your answers; if any is wrong he will send you back to re-read.'
    deliver = f"Delivers to: `{s['branch']}`" if s['branch'].startswith('claude/') else 'Delivers: a reply in this chat'
    return f"""# {s['id']} · {s['title']}
**For:** {AI_NAME[s['ai']]} · **Setting:** {s['setting']} · **Depends on:** {s['dep']} · **{deliver}**

Attach `{ZIPNAME[s['ai']]}` to this chat together with this prompt. Everything bulky (code, references, renders) is in the ZIP; this prompt names the files.

## HARD RULES (read first; repeated at the very end)
{hr}

{step0_head}
1. **List every file in the ZIP** (full path) and say in a few words what you will use it for.
2. **Restate, numbered and in your own words, every HARD RULE above and every lesson or fix row in §2** (one line each).
3. **Answer these questions.** Every answer is in the sections below; quote the exact number, name or code.
{qs}
4. **Quote the three canary instructions** this prompt contains (they are marked "Canary 1/2/3 of 3" somewhere in the middle) and confirm you will include each string exactly.

{step0_tail}

## ZIP contents
{ZIP_TABLE[s['ai']]}

{plant(s['sections'], s['canaries'])}
## HARD RULES (repeated)
{hr}
"""

def md2html(t):
    t = t.replace('- [ ] ', '- ☐ ')
    return markdown.markdown(t, extensions=['tables', 'fenced_code', 'sane_lists'])

# ---------------- images ----------------
IMG_DIRS = [REV + '/scratch/fixed', REV + '/scratch/shots', REV + '/scratch_ab/shots', REV + '/scratch_ab', REV + '/hawk-hr/previews', '/workspace/work/r2_pg/previews', H + '/img', REV]
IMG_ALIAS = {'cars_rebuild_sheet.png': G + '/T/ab/c_sheet1.png', 'sedan_v1_day.png': REV + '/scratch_ab/shots/sedan_day.png'}
def find_img(name):
    if name in IMG_ALIAS and os.path.exists(IMG_ALIAS[name]): return IMG_ALIAS[name]
    for d in IMG_DIRS:
        p = os.path.join(d, name)
        if os.path.exists(p): return p
    return None
CAPTION = {
 'after_down_side_grunt_a.png': 'AFTER: Harbor Rats grunt in the real down pose: tail laid flat (lowest +0.054 m).',
 'before_down_side_grunt_a.png': 'BEFORE: v1 tail stabs 0.67 m through the floor in the real down pose.',
 'before_down_side_bruiser.png': 'BEFORE: v1 bruiser tail −0.80 m in the real down pose.',
 'after_down_side_bruiser.png': 'AFTER: bruiser tail flat (lowest +0.065 m).',
 'before_whisker_chest_grunt_a.png': 'BEFORE: stray ink line across the belly (sunk diamond hull + whisker shadow).',
 'after_whisker_chest_grunt_a.png': 'AFTER: diamond proud of the belly, thin parts shadow:false.',
 'before_lod_vs_hd_armed.png': 'BEFORE: armed LOD lost the mustard neckerchief.',
 'after_lod_vs_hd_armed.png': 'AFTER: LOD keeps the gang colour; hips sphere dropped instead.',
 'harbor_rats_fixes_compare.png': 'Harbor Rats v1 vs v2 overview (Hark fixes).',
 'after_real_merged_flash.png': 'Real mergeRig + hit-flash on the fixed rats.',
 'after_real_merged_lineup.png': 'Fixed Harbor Rats merged with the real mergeRig.',
 'pier_gulls_lineup_day.png': 'Pier Gulls v1 lineup, day (your delivery).', 'pier_gulls_lineup_night.png': 'Pier Gulls v1 lineup, night.',
 'pier_gulls_bruiser_knockdown_60fps.png': 'Pier Gulls v1 knock-down strip (assumed timings).', 'pier_gulls_armed_hd_vs_lod1.png': 'Pier Gulls v1 armed: HD vs LOD 1.',
 'evidence_sheet.png': 'BEFORE (Task A/B v1): buried door, sideways canopy, floating pickup lights.',
 'cars_rebuild_sheet.png': 'QUALITY BAR: in-house car rebuild (work in progress): glass, interiors, arches, trim.',
 'sedan_v1_day.png': 'BEFORE: v1 sedan, flat profile, dark panels for windows.',
 'dragon_day.png': 'Task B dragon boat (exists).', 'paddle_day.png': 'Task B paddle boat (exists; build only the dock).',
 'block_night_close.png': 'Task A block at night.', 'street_game_night.png': 'Street at night in the game.', 'stoops_close_day.png': 'Task A stoops close-up (v1).',
 'corner_bar_phone_night.png': 'Corner bar at night, 390×844 (v1).', 'corner_bar_phone_day.png': 'Corner bar, 390×844 (v1).', 'props_lamps_phone_night.png': 'Task B lamps at night (v1).',
 'houses_day.png': 'Rowhouse variety (v1).', 'heroes_day.jpg': 'Harold and Mavis, day: the quality bar.', 'heroes_night.jpg': 'Harold and Mavis, night.',
 'fight_day.jpg': 'A fight in the city.', 'city_night.jpg': 'The city at night.', 'thugs_day.jpg': 'Current placeholder thugs.', 'sign_night.jpg': 'Neon sign quality bar at night.',
}

# ---------------- ZIPs ----------------
SECRET_PAT = re.compile(r'(ghp_[A-Za-z0-9]{20,}|github_pat_|SURGE_TOKEN\s*=\s*\S|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|xox[bap]-|sk-[A-Za-z0-9]{20,}|password\s*[:=]\s*\S)', re.I)
def add(z, src, arc):
    if os.path.isdir(src):
        for root, _, files in os.walk(src):
            if '.git' in root or 'node_modules' in root: continue
            for f in files: add(z, os.path.join(root, f), os.path.join(arc, os.path.relpath(os.path.join(root, f), src)))
        return
    if not os.path.exists(src): print('  missing', src); return
    if src.endswith(('.js', '.mjs', '.md', '.html', '.json', '.txt', '.diff', '.sh', '.py')):
        txt = open(src, errors='ignore').read()
        if SECRET_PAT.search(txt): raise SystemExit(f'SECRET-LIKE STRING in {src}; refusing to zip')
    z.write(src, arc)

def readme_zip(ai):
    return f"""# {ZIPNAME[ai]}
Toad City Baltimore, outside-AI round 2 kit for {AI_NAME[ai]}. Built 11 October 2026 by Hark.

Start with the session prompt you were given (also in `prompts/`). Do its Step 0 comprehension check first.

{ZIP_TABLE[ai]}

Node harness setup (from the ZIP root): `npm i` (installs three 0.160.0 from package.json). Browser pages load three r160 from unpkg through an import map.
No credentials, tokens or private data are in this ZIP.
"""

def build_zip(ai):
    out = f'{ZIPS}/{ZIPNAME[ai]}'
    if os.path.exists(out): os.remove(out)
    z = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
    z.writestr('README_ZIP.md', readme_zip(ai))
    for s in S:
        if s['ai'] == ai: z.writestr(f"prompts/{s['id']}_{s['slug'].split('-', 1)[1]}.md", s['md'])
    P = H + '/prompts'
    if ai in ('OPUS', 'SONNET', 'GEMINI'):
        add(z, COMMON + '/kit', 'kit'); add(z, COMMON + '/package.json', 'package.json')
    if ai == 'OPUS':
        add(z, COMMON + '/harness', 'harness'); add(z, COMMON + '/reference/harbor_rats', 'reference/harbor_rats')
        for f in ['src/gang_pier_gulls.js', 'README_pier_gulls.md', 'tools/qa.html', 'tools/qa.js']: add(z, '/workspace/work/r2_pg/' + f, 'reference/pier_gulls_v1/' + os.path.basename(f))
        add(z, REV + '/harbor_rats_review.md', 'reviews/harbor_rats_review.md'); add(z, P + '/TASK_C_review_lessons.md', 'reviews/TASK_C_review_lessons.md')
        for f in sorted(glob.glob(REV + '/scratch/fixed/before_*.png') + glob.glob(REV + '/scratch/fixed/after_*.png')): add(z, f, 'previews/before_after/' + os.path.basename(f))
        add(z, REV + '/harbor_rats_fixes_compare.png', 'previews/before_after/harbor_rats_fixes_compare.png')
        for f in ['heroes_day.jpg', 'heroes_night.jpg', 'thugs_day.jpg', 'thugs_night.jpg']: add(z, H + '/img/' + f, 'previews/style/' + f)
        add(z, P + '/TASK_C_thug_gangs.md', 'briefs/TASK_C_thug_gangs.md'); add(z, P + '/TASK_D_bosses.md', 'briefs/TASK_D_bosses.md')
    if ai == 'SONNET':
        add(z, B + '/sonnet_extra/harness_ab', 'harness_ab'); add(z, B + '/sonnet_extra/game_hooks', 'reference/game_hooks')
        add(z, REV + '/hawk-ab/src', 'reference/taskAB_v1'); add(z, B + '/sonnet_extra/taskAB_fixed', 'reference/taskAB_fixed')
        add(z, REV + '/sonnet_taskAB_review.md', 'reviews/sonnet_taskAB_review.md')
        add(z, REV + '/scratch_ab/evidence_sheet.png', 'previews/before_after/evidence_sheet.png')
        for f in ['ev_canopy.png', 'ev_door.png', 'ev_pickup_glow.png', 'stoops_close_day.png', 'corner_bar_phone_night.png', 'arabber_34_day.png', 'crab_34_night.png', 'street_game_day.png', 'street_game_night.png', 'block_night_close.png', 'dragon_day.png', 'paddle_day.png']:
            add(z, REV + '/scratch_ab/shots/' + f, 'previews/before_after/' + f)
        add(z, find_img('cars_rebuild_sheet.png'), 'previews/quality_bar/cars_rebuild_sheet.png'); add(z, find_img('sedan_v1_day.png'), 'previews/quality_bar/sedan_v1_day.png')
        for f in ['sign_day.jpg', 'sign_night.jpg', 'street_night.jpg', 'city_night.jpg']: add(z, H + '/img/' + f, 'previews/style/' + f)
        add(z, P + '/TASK_A_rowhouse_city_block_kit.md', 'briefs/TASK_A_rowhouse_city_block_kit.md'); add(z, P + '/TASK_B_street_props_vehicles.md', 'briefs/TASK_B_street_props_vehicles.md')
    if ai == 'GEMINI':
        add(z, P + '/QA_GEMINI_PRO_review_prompt.md', 'qa/QA_GEMINI_PRO_review_prompt.md')
        for f in ['TASK_C_thug_gangs.md', 'TASK_C_review_lessons.md', 'TASK_A_rowhouse_city_block_kit.md', 'TASK_B_street_props_vehicles.md']: add(z, P + '/' + f, 'briefs/' + f)
        add(z, REV + '/harbor_rats_review.md', 'reviews/harbor_rats_review.md'); add(z, REV + '/sonnet_taskAB_review.md', 'reviews/sonnet_taskAB_review.md')
        add(z, COMMON + '/reference/harbor_rats', 'reference/harbor_rats')
        for f in sorted(glob.glob(REV + '/hawk-hr/previews/*.png')): add(z, f, 'previews/harbor_rats/v2_delivery/' + os.path.basename(f))
        for f in sorted(glob.glob(REV + '/scratch/fixed/before_*.png') + glob.glob(REV + '/scratch/fixed/after_*.png')): add(z, f, 'previews/harbor_rats/before_after/' + os.path.basename(f))
        add(z, REV + '/hawk-ab/src', 'reference/taskAB_v1'); add(z, B + '/sonnet_extra/taskAB_fixed', 'reference/taskAB_fixed')
        add(z, REV + '/scratch_ab/evidence_sheet.png', 'previews/taskAB/evidence_sheet.png'); add(z, find_img('cars_rebuild_sheet.png'), 'previews/taskAB/cars_rebuild_sheet.png')
    if ai == 'HAIKU':
        for f in ['rowkit_rowhouse.js', 'rowkit_corner.js', 'rowkit_tiles.js', 'rowkit_block.js']: add(z, B + '/sonnet_extra/taskAB_fixed/' + f, 'reference/rowkit/' + f)
        z.writestr('reference/rowkit/ALLOWED_VALUES.md', ALLOWED_VALUES)
        z.writestr('reference/lint_targets/LESSONS.md', LINT_LESSONS)
    if ai == 'GROK':
        z.writestr('reference/radio_stations.js', RADIO_EXCERPT); z.writestr('reference/landmarks.js', LM_EXCERPT); z.writestr('reference/roster.md', ROSTER)
        for f in ['fight_day.jpg', 'city_night.jpg', 'thugs_day.jpg', 'heroes_day.jpg', 'sign_night.jpg']: add(z, H + '/img/' + f, 'reference/screens/' + f)
    z.close(); return out

ALLOWED_VALUES = """# buildRowhouse overrides (rowkit_rowhouse.js, `opts`)
- front: 'formstone' | 'brick' | 'permastone'
- variant: 0..3 (formstone tiles fs_0..fs_3; permastone ps_(variant % 3))
- paint: boolean (brick only; painted tiles pt_(variant % 4))
- brick: 0..5 -> br_red, br_tan, br_plum, br_grey, br_green, br_sand
- corniceColor: '#c9b48a' '#4f5a52' '#5a4f5c' '#8a4a3a' '#a4907a' '#9ab0b8' '#c49a9a' (RH_CORNICE)
- doorColor: 0..3 (door_0..door_3) · screens: boolean · floors: 3 | 4
- NEW (integration will add): trim, awning, awningStripe (hex)
# Sign boards (rowkit_tiles.js): board(bg, border, text, ink, fontSize) on a 256x64 tile (4:1); e.g. board('#2f5a3a', '#eae6dc', 'CORNER MARKET', '#ffe08a', 38)
"""
LINT_LESSONS = """# Bugs from round 1 the lint script must catch
- outline:false parts without shadow:false (Harbor Rats whiskers cast shadows; stray ink line).
- Texture cache keyed on K (Harbor Rats fur cache); must be K.QUAL || K.THREE || K and never cache null.
- README "about 34 hulls" (measured 28-29), "clips slightly" (0.66 m): unmeasured numbers.
- export const META in every file: concatenation collided (Task A/B m13).
- frustumCulled = false on the dragon-boat paddles (Task B m8).
- Unguarded global fallback PROP_TILES (Task B m5); a cache written onto a kit function (m6).
"""

def excerpt_radio():
    t = open(G + '/src/08_radio.js').read().split('\n')
    keep = [l for l in t if re.search(r"const (TRACKS|STATIONS|SNAME|SSHORT|STATION) ", l) or l.strip().startswith(('ducky:', 'club:', 'rap:'))]
    return '// Excerpt of the game\'s src/08_radio.js: station ids and names (read-only reference)\n' + '\n'.join(keep) + '\n'
RADIO_EXCERPT = excerpt_radio()
LM_EXCERPT = '// The game\'s LANDMARKS (src/03_city.js): landmark(id, popupName, x, z, radius, boss)\n' + '\n'.join(l.strip() for l in open(G + '/src/03_city.js').read().split('\n') if l.startswith("landmark('")) + '\n'
ROSTER = '# Gangs\n- harbor_rats Harbor Rats (rats) · pier_gulls Pier Gulls (gulls) · cobble_catfish Cobblestone Catfish · masked_bandits Masked Bandits (raccoons) · key_hwy_otters Key Highway Otters\n\n# Bosses\n' + '\n'.join(f'- `{b[0]}` {b[1]} ({b[2]}): {b[3]}' for b in BOSSES) + '\n'

# ---------------- sonnet extras: harness, hooks, fixed snapshot ----------------
def sonnet_extra():
    E = B + '/sonnet_extra'; shutil.rmtree(E, ignore_errors=True); os.makedirs(E + '/harness_ab'); os.makedirs(E + '/game_hooks'); os.makedirs(E + '/taskAB_fixed')
    for f in glob.glob(VENDOR + '/*.js'): shutil.copy(f, E + '/taskAB_fixed/')
    d = subprocess.run(['diff', '-ru', REV + '/hawk-ab/src', VENDOR], capture_output=True, text=True).stdout
    d = d.replace(REV + '/hawk-ab/src', 'taskAB_v1').replace(VENDOR, 'taskAB_fixed')
    open(E + '/taskAB_fixed/taskAB_v1_to_fixed.diff', 'w').write(d)
    for f in ['measure_ab.mjs', 'checks_ab.mjs', 'block20.mjs', 'fakedom2.mjs', 'starter_kit.mjs', 'sonnet_kit.mjs']:
        t = open(REV + '/scratch_ab/' + f).read()
        t = t.replace("'/workspace/work/toad-city/game/site/three.module.min.js'", "'three'")
        t = t.replace("'/workspace/work/reviews/hawk-ab/src/'", "(process.env.SRC || new URL('../reference/taskAB_fixed/', import.meta.url).pathname)")
        if '/workspace' in t: t = re.sub(r"/workspace/[^'\"\s]*", '<local path removed>', t)
        open(E + '/harness_ab/' + f, 'w').write(t)
    open(E + '/harness_ab/README.md', 'w').write('Hark review harness for Task A/B. From the ZIP root: `npm i`, then `node harness_ab/measure_ab.mjs` (set SRC=./src/ to point at your modules; default reference/taskAB_fixed/). Writes JSON next to the script. `sonnet_kit.mjs` is your round-1 reconstructed kit, kept only so the old comparisons run; use kit/toadcity_kit.js for new work.\n')
    c3 = open(G + '/src/03c_landmarks_hd_b2.js').read().split('\n')
    hooks = [l for l in c3 if 'LMHOOK' in l or 'lmHook(' in l]
    open(E + '/game_hooks/landmark_hooks.js', 'w').write('// Excerpts from the game (read-only reference)\n// src/03c_landmarks_hd_b2.js: set-piece hooks\n' + '\n'.join(hooks) + '\n\n' + LM_EXCERPT)
    open(E + '/game_hooks/constellation_scale.md', 'w').write("""# Ship scale rule (from the in-game USS Constellation, src/03c_landmarks_hd_b2.js)
- Real ship: about 61 m on deck. In game: hull from z −9.4 to −29.4 = **20 m long** (about 1/3), beam B = 2.6 m half-width = **5.2 m** (real 12.8 m: about 0.4), deck at CURB + 1.6 m, rail at CURB + 1.98 m, keel at WY − 1.2 (WY = −0.85 water plane, CURB = 0.16 pier top).
- Rule for round-2 ships: lengths about 1/3 of real, beam and heights about 1/2, so hatches, rails and gangways still fit 1.6–2.0 m characters.
- Piers (x0, x1, z0, z1): Pier 1 (Constellation) −40..−35, −30..−8; Pier 3 (Aquarium) 6..32, −30..−4; Pier 4 (Power Plant) 44..68, −30..−4.
""")
sonnet_extra()

# ---------------- build prompts ----------------
for s in S:
    s['md'] = prompt_md(s)
    fn = f"{PROMPTS}/{s['id']}_{s['slug'].split('-', 1)[1]}.md"
    open(fn, 'w').write(s['md']); s['md_path'] = fn
    # sanity: quiz answers must not be stated in the hard-rules block
print('prompts:', len(S))

zips = {ai: build_zip(ai) for ai in AI_NAME}
for ai, p in zips.items(): print('zip', p, os.path.getsize(p) // 1024, 'KB')

# ---------------- answer keys (PRIVATE) ----------------
def selfcheck_thresholds(s):
    m = re.search(r'## \d · Final self-check.*', s['sections'], re.S)
    return m.group(0).split('\n', 1)[1].strip() if m else ''
ak = ['# Toad City Round 2 · ANSWER KEYS (PRIVATE: never paste into an AI chat, never publish)',
      '', 'How to use: when an AI sends its Step 0 reply, compare its quiz answers with the expected answers below. All must be right (wording may differ; numbers, names and code must match). It must also quote all three canary instructions. If anything is wrong or missing, reply "Re-read the whole prompt, especially the middle sections, and redo Step 0." Do not say GO until it passes. When the delivery arrives, search it for the three canary strings (Hark can run `tc_canary.mjs` from session H2) and check the filled self-check against the thresholds.', '']
for ai in AI_NAME:
    ak.append(f'\n---\n\n# {AI_NAME[ai]}')
    for s in [x for x in S if x['ai'] == ai]:
        ak.append(f"\n## {s['id']} · {s['title']}")
        ak.append(f"Delivery: {s['branch']}\n\n### Quiz: expected answers")
        for i, (q, a) in enumerate(s['quiz']): ak.append(f'{i + 1}. **{q}** → {a}')
        ak.append('\n### Canary strings to find in the delivery')
        for k, (where, val) in enumerate(s['canaries']): ak.append(f'{k + 1}. {where}: `{val}`')
        ak.append('\n### Required self-check numbers and pass thresholds\n' + selfcheck_thresholds(s))
open(R2 + '/ANSWER_KEYS.md', 'w').write('\n'.join(ak) + '\n')

# ---------------- pages ----------------
CSS = """body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1d1a26;background:#f6f4fb}
header{background:#14101f;color:#fff;padding:18px 20px}header .k{color:#ffd23c;font-weight:700;letter-spacing:2px;font-size:12px}
header h1{margin:6px 0 4px;font-size:24px}header p{margin:0;color:#d9d3ea;font-size:14px}
main{max-width:980px;margin:0 auto;padding:16px}
.bar{position:sticky;top:0;z-index:5;display:flex;gap:10px;flex-wrap:wrap;background:#f6f4fb;padding:10px 0;border-bottom:1px solid #ddd}
.btn{display:inline-block;background:#ff3d6e;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none}
.btn.alt{background:#2f2457}
.card{background:#fff;border:1px solid #ddd;border-radius:10px;padding:14px 18px;margin:14px 0}
.prompt h1{font-size:22px;border-bottom:3px solid #ff3d6e}.prompt h2{font-size:18px;color:#2f2457;margin-top:22px}
table{border-collapse:collapse;width:100%;font-size:13.5px;display:block;overflow-x:auto}th,td{border:1px solid #c9c4d6;padding:4px 6px;text-align:left;vertical-align:top}th{background:#2f2457;color:#fff}
pre{background:#16131f;color:#ece8f6;padding:10px;border-radius:6px;overflow-x:auto;font-size:12.5px;white-space:pre-wrap;word-break:break-word}code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92em}
blockquote{border-left:5px solid #ffd23c;background:#fffbe8;margin:10px 0;padding:6px 12px}
.imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}.imgs figure{margin:0}.imgs img{width:100%;border-radius:6px;border:1px solid #ccc}
figcaption{font-size:13px;color:#4b4560}#ok{color:#23c26b;font-weight:700;align-self:center}
"""
def page_html(s, img_list, zipname):
    figs = ''.join(f'<figure><a href="img/{n}"><img src="img/{n}" loading="lazy" alt=""></a><figcaption>{html.escape(c)}</figcaption></figure>' for n, c in img_list)
    raw = json.dumps(s['md']).replace('</', '<\\/')
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>{s['id']} · {html.escape(s['title'])} · Toad City round 2</title><style>{CSS}</style></head><body>
<header><div class="k">TOAD CITY BALTIMORE · ROUND 2 · {AI_NAME[s['ai']].upper()}</div><h1>{s['id']} · {html.escape(s['title'])}</h1>
<p>Paste the whole prompt into a fresh {AI_NAME[s['ai']]} chat and attach the ZIP kit below. {html.escape(s['setting'])}</p></header>
<main><div class="bar"><button class="btn" id="cp">Copy prompt</button><a class="btn alt" href="{zipname}" download>Download ZIP kit ({os.path.getsize(zips[s['ai']]) // 1024 // 1024 or 1} MB)</a><a class="btn alt" href="prompt.md" download>Prompt as .md</a><span id="ok"></span></div>
<div class="card"><b>Depends on:</b> {html.escape(s['dep'])}<br><b>Delivery:</b> <code>{html.escape(s['branch'])}</code></div>
<div class="card prompt">{md2html(s['md'])}</div>
<h2>Before / after and reference renders</h2><div class="imgs">{figs}</div>
<p style="font-size:12px;color:#777">Prepared by Hark for Brad Parlette, 11 October 2026. Everything here is procedural game code and renders; no credentials.</p></main>
<script>const P={raw};document.getElementById('cp').onclick=async()=>{{try{{await navigator.clipboard.writeText(P)}}catch(e){{const t=document.createElement('textarea');t.value=P;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove()}}document.getElementById('ok').textContent='Copied ✓';setTimeout(()=>document.getElementById('ok').textContent='',2500)}};</script>
</body></html>"""

from PIL import Image
def stage_img(src, dst):
    im = Image.open(src); im.thumbnail((1400, 1400))
    if im.mode in ('RGBA', 'P'): im = im.convert('RGB')
    im.save(dst, 'JPEG', quality=84)

SUF = json.load(open(B + '/suffixes.json')) if os.path.exists(B + '/suffixes.json') else {}
def domain(key, base):
    if key not in SUF: SUF[key] = secrets.token_hex(3)
    return f'toad-city-r2-{base}-{SUF[key]}.surge.sh'
for s in S:
    d = PAGES + '/' + s['id']; shutil.rmtree(d, ignore_errors=True); os.makedirs(d + '/img')
    shutil.copy(zips[s['ai']], d + '/' + ZIPNAME[s['ai']]); open(d + '/prompt.md', 'w').write(s['md'])
    il = []
    for n in s['imgs']:
        p = find_img(n)
        if not p: print('  no img', n); continue
        out = os.path.splitext(n)[0] + '.jpg'; stage_img(p, d + '/img/' + out); il.append((out, CAPTION.get(n, n)))
    open(d + '/index.html', 'w').write(page_html(s, il, ZIPNAME[s['ai']]))
    open(d + '/robots.txt', 'w').write('User-agent: *\nDisallow: /\n')
    s['domain'] = domain(s['id'], f"{s['ai'].lower()}-{s['slug']}")
INDEX_DOMAIN = domain('INDEX', 'index')
json.dump(SUF, open(B + '/suffixes.json', 'w'), indent=1)

ORDER = """1. **Send now, in parallel (each in its own fresh chat):** O1–O7 (Opus), S1–S3 (Sonnet), G1 and G3 (Gemini), H1 and H2 (Haiku), GR1 (Grok). Each AI can run several sessions at once.
2. **In every chat:** paste the prompt (Copy prompt button), attach that AI's ZIP kit.
   - **Build sessions (O1–O7, S1–S3, G2) stop for GO:** the AI's first reply is the Step 0 comprehension check only. Brad (or Hark) checks it against the private answer key. Say **GO** only when it passes; otherwise tell it to re-read the whole prompt and redo Step 0.
   - **Small sessions (G1, G3, H1, H2, GR1) deliver in one go:** the reply opens with the Step 0 answers and continues straight into the full deliverable, with no GO. Brad hands the whole reply to Hark, who checks Step 0 and reviews the deliverable.
3. **G2 (Gemini QA of Sonnet A/B) waits** until Hark says the Task A/B fix pass has landed; Hark then sends the fixed files and preview PNGs to attach.
4. **Bring back:** for Opus and Sonnet, the branch name and commit hash they push to `bparlette/hawk` (and the dist zip path); for Gemini, Haiku and Grok, the full reply (markdown or JSON). Hand each to Hark for review.
5. **After Opus/Sonnet deliveries land:** run G3's template in a new Gemini chat for each delivery, attaching the branch URL and the preview PNGs Hark sends."""
def index_html():
    rows = ''.join(f'<tr><td><b>{s["id"]}</b></td><td>{AI_NAME[s["ai"]]}</td><td><a href="https://{s["domain"]}/">{html.escape(s["title"])}</a></td><td>{html.escape(s["dep"])}</td><td><code>{html.escape(s["branch"])}</code></td></tr>' for s in S)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Toad City round 2 briefs</title><style>{CSS}</style></head><body>
<header><div class="k">TOAD CITY BALTIMORE · OUTSIDE-AI ROUND 2</div><h1>All round-2 briefs</h1><p>One page per session: prompt, Copy button, ZIP kit and before/after renders.</p></header>
<main><div class="card">{md2html(ORDER)}</div><div class="card"><table><tr><th>ID</th><th>AI</th><th>Brief</th><th>Depends on</th><th>Delivery</th></tr>{rows}</table></div></main></body></html>"""
d = PAGES + '/INDEX'; shutil.rmtree(d, ignore_errors=True); os.makedirs(d); open(d + '/index.html', 'w').write(index_html()); open(d + '/robots.txt', 'w').write('User-agent: *\nDisallow: /\n')

# ---------------- ROUND2_INDEX.md ----------------
lines = ['# Toad City · Round 2 index', '', f'Index page: https://{INDEX_DOMAIN}/', '', '## How to run these sessions', ORDER, '', '## Sessions', '',
         '| ID | AI | Scope | Depends on | Delivery branch | Prompt file | Page |', '|---|---|---|---|---|---|---|']
for s in S:
    lines.append(f"| {s['id']} | {AI_NAME[s['ai']]} | {s['scope']} | {s['dep']} | `{s['branch']}` | `prompts/round2/{os.path.basename(s['md_path'])}` | https://{s['domain']}/ |")
lines += ['', '## ZIP kits (one per AI, in handoff/round2/)'] + [f'- `{ZIPNAME[a]}`: {os.path.getsize(zips[a]) // 1024} KB' for a in AI_NAME]
lines += ['', '## What Brad attaches', '- Every session: that AI\'s ZIP kit (the page has a download link).',
          '- G1: the Gemini ZIP (contains Harbor Rats v2). Hawk repo: https://github.com/bparlette/hawk (v1 branch `claude/new-session-z5ikqq`; v2 is Hark\'s local branch `hark/harbor-rats-fixes`, in the ZIP only unless Hark pushes it).',
          '- G2: the Gemini ZIP plus the fixed vendor/taskAB files and after-fix preview PNGs Hark sends when the fix pass lands; original branch https://github.com/bparlette/hawk/tree/claude/new-session-j5l7sz.',
          '- G3 (each later use): the delivery branch URL and the preview PNGs Hark sends.',
          '', 'Answer keys: `ANSWER_KEYS.md` (private; never on a page or in a ZIP).', '', '## Task A/B fix status at build time', STATUS_TABLE]
open(R2 + '/ROUND2_INDEX.md', 'w').write('\n'.join(lines) + '\n')
json.dump([{k: s[k] for k in ('id', 'ai', 'title', 'domain', 'branch', 'dep', 'scope')} | {'md': s['md_path']} for s in S] + [{'id': 'INDEX', 'domain': INDEX_DOMAIN}], open(B + '/sessions.json', 'w'), indent=1)
print('index', INDEX_DOMAIN); print(json.dumps(SONNET_STATUS))
