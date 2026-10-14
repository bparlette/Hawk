#!/usr/bin/env python3
# Generates the three Toad City outside-AI briefs (HTML -> PDF via headless Chromium) and the per-task prompt .md files.
import markdown, html, json, os, re, sys, subprocess
H = '/workspace/work/toad-city/handoff'
B = H + '/build'
KIT = open(H + '/kit/toadcity_kit.js').read().split('\n')
rd = lambda p: open(B + '/' + p).read()
CTX, DLV = rd('common_context.md'), rd('common_delivery.md')
TASK = {k: rd(f'task_{k}.md') for k in 'ABCD'}
QA, HAIKU = rd('qa_gemini.md'), rd('haiku.md')

def md(s):
    s = s.replace('- [ ] ', '- ☐ ')
    h = markdown.markdown(s, extensions=['tables', 'fenced_code'])
    return re.sub(r'<td><code>([^<]*)</code>', lambda m: '<td><code>' + m.group(1).replace('_', '_<wbr>') + '</code>', h)

def kit_lines(ranges):
    out = []
    for a, b in ranges:
        out += KIT[a - 1:b]
        out.append('// …')
    return '\n'.join(out[:-1]).rstrip()

def full_prompt(k, role):
    return f"{role}\n\n{CTX}\n\n{TASK[k]}\n\n{DLV}\n"

ROLE = {
    'C': 'You are the lead character builder for Toad City Baltimore (Claude Opus, extended thinking on, high or max effort). Build ONE gang per session and self-test it in viewer.html before you move on.',
    'D': 'You are the lead character builder for Toad City Baltimore (Claude Opus, extended thinking on, high or max effort). Build ONE boss per session and self-test it in viewer.html before you move on.',
    'A': 'You are the environment-kit builder for Toad City Baltimore (Claude Sonnet, extended thinking on, medium effort; use high effort for the first kit piece, because it sets the pattern). Self-test every piece in viewer.html before you move on.',
    'B': 'You are the props and vehicles builder for Toad City Baltimore (Claude Sonnet, extended thinking on, medium effort; use high effort for the first prop and the first vehicle, because they set the pattern). Self-test every piece in viewer.html before you move on.',
}
NAMES = {'A': 'TASK_A_rowhouse_city_block_kit.md', 'B': 'TASK_B_street_props_vehicles.md', 'C': 'TASK_C_thug_gangs.md', 'D': 'TASK_D_bosses.md'}

# ---------- write the plain .md prompts ----------
os.makedirs(H + '/prompts', exist_ok=True)
for k in 'ABCD':
    open(H + '/prompts/' + NAMES[k], 'w').write(full_prompt(k, ROLE[k]))
open(H + '/prompts/QA_GEMINI_PRO_review_prompt.md', 'w').write(QA + '\n\n' + '\n\n'.join(
    '## Acceptance checklist and budgets: ' + TASK[k].split('\n')[0].lstrip('# ') + '\n' + re.search(r'## Performance budget.*?(?=\n## )', TASK[k], re.S).group(0) + '\n' + re.search(r'## Acceptance checklist.*?(?=\n## )', TASK[k], re.S).group(0)
    for k in 'ABCD'))
open(H + '/prompts/HAIKU_helper_prompts.md', 'w').write(HAIKU)

# ---------- shared HTML sections ----------
CSS = """
@page { size: Letter; margin: 0.6in 0.62in 0.7in 0.62in; }
* { box-sizing: border-box; }
body { font: 9.6pt/1.38 'DejaVu Sans', Helvetica, Arial, sans-serif; color: #1d1a26; margin: 0; }
h1 { font-size: 19pt; margin: 0 0 8px; color: #14101f; border-bottom: 3px solid #ff3d6e; padding-bottom: 4px; break-after: avoid; }
h1.sec { break-before: page; }
h2 { font-size: 13pt; margin: 14px 0 5px; color: #2f2457; break-after: avoid; }
h3 { font-size: 11pt; margin: 10px 0 4px; break-after: avoid; }
p { margin: 4px 0 7px; } ul, ol { margin: 3px 0 7px; padding-left: 20px; } li { margin: 1.5px 0; }
table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 8.6pt; break-inside: auto; }
th, td { border: 1px solid #c9c4d6; padding: 2px 5px; vertical-align: top; text-align: left; }
th { background: #2f2457; color: #fff; } tr:nth-child(even) td { background: #f5f3fa; } tr { break-inside: avoid; }
td code { overflow-wrap: break-word; word-break: normal; }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: 8.4pt; background: #f1eef7; padding: 0 2px; border-radius: 2px; overflow-wrap: anywhere; }
pre { font-family: 'DejaVu Sans Mono', monospace; font-size: 7.6pt; line-height: 1.32; background: #16131f; color: #ece8f6; padding: 8px 10px;
      border-radius: 5px; white-space: pre-wrap; word-break: break-all; overflow-wrap: anywhere; margin: 6px 0 10px; }
pre code { background: none; color: inherit; font-size: inherit; padding: 0; }
pre.small { font-size: 5.7pt; line-height: 1.17; padding: 6px 7px; }
.prompt { border: 2px dashed #ff3d6e; border-radius: 8px; padding: 6px 12px 4px; margin: 8px 0; background: #fffafc; font-size: 8.7pt; line-height: 1.34; }
.prompt table { font-size: 7.9pt; } .prompt pre { font-size: 7.1pt; }
.prompt > .tag { display: inline-block; background: #ff3d6e; color: #fff; font-weight: 700; font-size: 8pt; padding: 1px 8px; border-radius: 3px; margin: 2px 0 4px; }
.prompt h1 { font-size: 14pt; border-bottom: 2px solid #2f2457; break-before: auto; }
.prompt h2 { font-size: 11.5pt; }
.setting { border-left: 6px solid #23c26b; background: #eefaf2; padding: 8px 12px; margin: 10px 0; border-radius: 4px; }
.note { border-left: 6px solid #ffd23c; background: #fffbe8; padding: 7px 12px; margin: 8px 0; border-radius: 4px; font-size: 9.4pt; }
figure { margin: 6px 0 10px; break-inside: avoid; } figure img { width: 100%; max-height: 2.45in; object-fit: cover; border-radius: 5px; border: 1px solid #c9c4d6; display: block; }
figure.tall2 img { max-height: 2.0in; object-fit: contain; background: #16131f; }
figure.tall img { max-height: 2.85in; object-fit: contain; background: #16131f; }
figcaption { font-size: 8.3pt; color: #4b4560; margin-top: 3px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.g4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; } .g4 figure img { height: 1.25in; }
.g21 { display: grid; grid-template-columns: 1.9fr 1fr 1fr; gap: 12px; align-items: start; }
.sw { display: grid; grid-template-columns: repeat(8, 1fr); gap: 5px; margin: 6px 0 10px; }
.sw div { border: 1px solid #c9c4d6; border-radius: 4px; font-size: 7.6pt; overflow: hidden; break-inside: avoid; }
.sw i { display: block; height: 14px; } .sw span { display: block; padding: 2px 4px; }
.cover { height: 8.9in; display: flex; flex-direction: column; break-after: page; }
.cover .band { background: #14101f; color: #fff; padding: 26px 26px 20px; border-radius: 10px; }
.cover .band .k { color: #ffd23c; font-weight: 700; letter-spacing: 2px; font-size: 10pt; }
.cover .band .t { font-size: 30pt; font-weight: 800; line-height: 1.1; margin: 8px 0 6px; }
.cover .band .s { font-size: 12.5pt; color: #d9d3ea; }
.cover img { width: 100%; height: 4.3in; object-fit: cover; border-radius: 10px; margin: 14px 0 10px; }
.toc { break-after: page; } .toc ol { list-style: none; padding: 0; font-size: 11pt; } .toc li { display: flex; border-bottom: 1px dotted #aaa; padding: 5px 0; }
.toc li span:first-child { flex: 1; } .toc li.sub { padding-left: 22px; font-size: 9.8pt; }
"""

SWATCH = [('#14101f', 'INK: outlines, black'), ('#6f7f34', 'Harold skin'), ('#b8b47a', 'Harold throat'), ('#7a5232', 'Harold cardigan'),
          ('#5e3e24', 'cardigan trim'), ('#5a5248', 'Harold slacks'), ('#7f8f3e', 'Mavis skin'), ('#5f73b0', 'Mavis dress base'),
          ('#f08ab0', 'floral pink'), ('#c8c6c2', 'Mavis afro'), ('#6a1f3a', 'handbag'), ('#c8a040', 'gold: clasp, bangle'),
          ('#e8d888', 'toad eye gold'), ('#ff3d6e', 'accent pink-red'), ('#7b4dff', 'accent violet'), ('#ff9f1c', 'accent orange'),
          ('#23c26b', 'accent green'), ('#2f5bd3', 'accent blue'), ('#ffd23c', 'accent yellow'), ('#1fd3c6', 'accent teal'),
          ('#8a4a3a', 'red brick'), ('#6f6a62', 'grey stone'), ('#9a6a44', 'tan brick'), ('#5a4f5c', 'plum'),
          ('#4f5a52', 'green-grey'), ('#a4907a', 'sandstone'), ('#c9b48a', 'trim cream'), ('#eae6dc', 'marble stoop'),
          ('#ffa050', 'lamp light'), ('#ffe08a', 'lit window'), ('#ff3a1c', 'neon red'), ('#c8d0ff', 'night camera fill')]

def fig(src, cap, cls=''):
    return f'<figure class="{cls}"><img src="../img/{src}"><figcaption>{cap}</figcaption></figure>'

def cover(model, title, sub, setting, img='city_day.jpg'):
    return f"""<section class="cover"><div class="band"><div class="k">TOAD CITY BALTIMORE · OUTSIDE-AI BRIEF · {model.upper()}</div>
<div class="t">{title}</div><div class="s">{sub}</div></div>
<img src="../img/{img}"><div class="setting"><b>Recommended setting.</b> {setting}</div>
<p style="font-size:8.6pt;color:#4b4560;margin-top:auto">Prepared for Brad Parlette, 11 October 2026. Everything is built procedurally in code; real Baltimore signage is redrawn on canvas, never copied from logo files. The starter kit (<code>toadcity_kit.js</code>, <code>viewer.html</code> and two example modules) comes as <code>toadcity_starter_kit.zip</code>. Its core is printed in the appendix in case the zip is missing.</p></section>"""

def toc(items):
    lis = ''.join(f'<li class="{"sub" if sub else ""}"><span>{t}</span><span>{{{{P:{t}}}}}</span></li>' for t, sub in items)
    return f'<section class="toc"><h1>Contents</h1><ol>{lis}</ol></section>'

def overview():
    return f"""<h1 class="sec">1 · Project overview</h1>
<p><b>Toad City Baltimore</b> is an open-world, cel-shaded street brawler set on Baltimore's Inner Harbor, built for phones first. You play <b>Harold</b>, an elderly toad with a cane. His wife <b>Mavis</b> (grey afro, floral dress, a handbag she swings) fights beside you under AI control. Together you clear crime out of each district around the harbour. Each landmark district has a set-piece fight and a boss, and the final boss is Mister Formstone. The real map is compressed about 3×: landmarks sit about one block apart, with a 6 m brick promenade along the water and land about two blocks deep. Day turns to night every 5 minutes (a 600 s loop), and at night the windows, street lamps and neon light up.</p>
<div class="g21">{fig('city_day.jpg', 'City overview, day: the harbour basin, the street grid and the landmark massings (in-house). Night lights about 45% of windows and warm lamps along the promenade.')}
{fig('phone_day.jpg', 'iPhone portrait 390×844: the game view above the arcade control panel.', 'tall')}
{fig('arcade_panel.jpg', 'The arcade panel (ball-top stick, round buttons, big ACT button). Assets must read in the view above it.', 'tall')}</div>
<h2>Tech stack</h2>
<ul><li><b>three.js r160</b> with plain ES modules. The game source is a set of <code>src/*.js</code> files that a shell script concatenates into one module (<code>game.js</code>). There is no bundler and no framework.</li>
<li><b>Everything procedural:</b> geometry comes from three.js primitives in code, and every texture is drawn on a <code>&lt;canvas&gt;</code> at load. There are no image, model or font files to license. Audio is separate (not part of this work).</li>
<li><b>Look:</b> MeshLambert plus a 3-band toon ramp injected with <code>onBeforeCompile</code>, vertex colours, inverted-hull ink outlines and PCF soft shadows from one sun. A <code>?retro=1</code> 32-bit mode exists, but the kit is HD-only and that is what you deliver for.</li>
<li><b>How deliveries plug in:</b> each module is a file that receives the kit object <code>K</code> (the same functions the game uses). In-house, we strip the <code>export</code> keywords, append the file to <code>src/</code>, bind <code>K</code> to the game's globals and register the build function in the gang, boss, prop or vehicle tables. If your module runs in the kit viewer, it runs in the game.</li></ul>
<h2>Target devices and performance budgets</h2>
<p>The main target is an <b>iPhone in portrait, 390×844 CSS px at DPR 2</b> (the game view is the tall area above the arcade panel), plus desktop Chrome and Safari. Aim for 60 fps, with a 30 fps floor on a mid-range iPhone. Current city frames measure <b>76–168 draw calls and 99k–346k triangles</b> at five spots (day, 390×844, including the shadow pass), so new assets must be lean.</p>
<table><tr><th>Budget</th><th>Limit</th><th>Notes</th></tr>
<tr><td>Whole frame (iPhone)</td><td>≤ 250 draw calls, ≤ 400k tris</td><td>Includes the shadow pass. The in-house team owns this number; your assets must not blow it.</td></tr>
<tr><td>Reference: Harold / Mavis</td><td>60 / 54 parts · 14.0k / 15.7k tris</td><td>Measured in the kit viewer. Each part is a mesh plus an ink hull.</td></tr>
<tr><td>Reference: current thug</td><td>26–33 parts · 7.6k–8.5k tris</td><td>Two materials (one toon plus the shared outline).</td></tr>
<tr><td>New gang member (Task C)</td><td>≤ 40 parts · ≤ 12k tris · ≤ 3 mats</td><td>Far LOD (<code>opts.lod = 1</code>): ≤ 14 parts, ≤ 3k tris, no fine detail.</td></tr>
<tr><td>Boss (Task D)</td><td>≤ 70 parts · ≤ 22k tris · ≤ 4 mats</td><td>One boss on screen at a time.</td></tr>
<tr><td>Rowhouse kit (Task A)</td><td>house ≤ 2.5k · corner ≤ 3.5k · block ≤ 30k tris</td><td>Merged: a full block is ≤ 4 draw calls. One 1024² atlas for the whole kit.</td></tr>
<tr><td>Static props (Task B)</td><td>120–2,500 tris each</td><td>Merged into the chunk, so they add no draw calls. Per-prop limits are in the task.</td></tr>
<tr><td>Vehicles (Task B)</td><td>600–6,000 tris · 3–12 meshes</td><td>Their own Group, so they move. At most 2 materials each.</td></tr>
<tr><td>Textures</td><td>canvas only · ≤ 1024² atlas · ≤ 256² per character map</td><td>Drawn in code at load; mipmapped in HD.</td></tr></table>
<p><b>Merged geometry and shared materials:</b> the static city is written into merged builders, each 64 m chunk being one toon mesh, one outline hull, one glow mesh and one decal mesh, and the chunks are frustum-culled. Characters are groups of parts that share one toon material per rig. <b>LOD the game already does:</b> thugs beyond 24 m drop their ink hulls and stop casting shadows, and beyond 48 m they sleep (hidden). Hulls must therefore be BackSide ShaderMaterial children so this code can find them.</p>
<h2>Coordinates and scale</h2>
<table><tr><th>Item</th><th>Value</th><th>Item</th><th>Value</th></tr>
<tr><td>Units / axes</td><td>metres · Y up · X east · Z south (north = −Z)</td><td>Facing at yaw 0</td><td>+Z (characters, vehicles, house fronts)</td></tr>
<tr><td>City block</td><td>24 × 24 m</td><td>Street</td><td>10 m wide (grid period 34 m)</td></tr>
<tr><td>Promenade</td><td>6 m brick strip on every water edge</td><td>Kerb / pavement top</td><td><code>CURB = 0.16</code></td></tr>
<tr><td>Ground floor / upper floor</td><td><code>GF = 4.4</code> / <code>FH = 3.4</code></td><td>Parapet</td><td><code>PAR = 1.3</code></td></tr>
<tr><td>Water surface</td><td><code>WY = −0.85</code></td><td>Render chunk / collision cell</td><td>64 m / 16 m</td></tr>
<tr><td>World bounds</td><td>x −136…213, z −106…104</td><td>Harbour basin</td><td>x −60…400, z −30…30</td></tr>
<tr><td>Harold / Mavis</td><td>about 1.6 m / about 2.0 m (afro)</td><td>Thug / bruiser</td><td>about 2.0 m / ×1.2</td></tr></table>
<div class="note"><b>Signage rule.</b> Brad wants the city to look like the real Inner Harbor: storefronts, signs and props <b>may use real Baltimore businesses' names and sign styles where they really exist</b> (Phillips Seafood, Barnes &amp; Noble and Hard Rock Cafe at the Power Plant, the water-taxi branding, Natty Boh-style corner-bar signs, Utz, Old Bay). The neon sign in section 2 shows how: the real script wording <b>redrawn on canvas</b>, never a copied logo file or photo. <b>Bosses and thugs stay original characters</b> (no real people).</div>
<p><b>Readability on a phone:</b> silhouettes must read at 6–10 m on a 390×844 screen; exaggerate key shapes by 10–20% (heads, hands, cornices, stoops, lamp heads); give each gang, district or vehicle one accent colour; check every asset in both the day and the night preset before delivery.</p>"""

def style(extra_imgs=True):
    sw = ''.join(f'<div><i style="background:{c}"></i><span><b>{c}</b><br>{n}</span></div>' for c, n in SWATCH)
    return f"""<h1 class="sec">2 · Style guide and quality bar</h1>
<p>Everything you deliver must look like it belongs next to Harold and Mavis below. These are the <b>asset starters</b>: renders of the real game models through the kit viewer you were given. They are the quality bar.</p>
<div class="g2">{fig('heroes_day.jpg', 'Harold and Mavis, day preset: chunky primitives, warty skin map, floral and curls maps, three hard cel bands, ink hulls.')}
{fig('heroes_night.jpg', 'The same at night: hemisphere and sun drop, a warm lamp and a cool camera-side fill keep the characters readable.')}</div>
<div class="g2">{fig('thugs_day.jpg', 'The current thugs (to be replaced by Task C gangs): readable but plain. Your work must reach Harold-level detail.')}
{fig('example_day.jpg', 'The kit examples: a gull thug (character interface) and a bench (prop interface, with an atlas decal). The readout shows the budget check.')}</div>
<h2>Palette</h2><div class="sw">{sw}</div>
<p>Use mid-value base colours, because the toon ramp multiplies them by 0.46, 0.78 or 1.06. <b>Never use pure #000 or #fff</b>: use INK <code>#14101f</code> for black and at most <code>#f2f2f2</code> for white. Shadows are tinted slightly cool.</p>
<h2>Toon ramp (cel bands)</h2>
<ul><li>The lighting ratio <i>r</i> (lit luminance ÷ base luminance) is snapped to three bands: <b>shadow 0.46</b> (r below 0.38–0.44), <b>mid 0.78</b> and <b>lit 1.06</b> (r above 0.86–0.92). Edges are hard (smoothstep over 0.06).</li>
<li>The shadow band is tinted by (0.88, 0.86, 1.10) at 50%. Strong local light (r above 1.35, such as a lamp at night) passes through unbanded.</li>
<li>A hit-flash uniform mixes the whole rig to white (<code>mat.userData.flash</code>). Every sub-material of a rig must share it.</li></ul>
<h2>Ink outlines</h2>
<ul><li>The outlines are <b>inverted hulls</b>: back faces of the same geometry pushed out along a mitred vertex direction (<code>odir</code>, from <code>addOdir()</code>), coloured INK <code>#14101f</code>.</li>
<li>Width = <code>uW × camera distance</code>, with the distance clamped to 2.5–36 m. <b>Characters 0.0042</b>, <b>city 0.0034</b>, <b>props 0.0030</b>. That gives a near-constant 2–3 px line on a phone, which fades into the fog colour with distance.</li>
<li>Only major masses get hulls. Use <code>outline: false</code> on parts thinner than about 4 cm (characters) or 6 cm (buildings), and on flat decals. Never use screen-space edge detection.</li></ul>
<h2>Night lighting rules</h2>
<table><tr><th>Preset</th><th>Sky / fog</th><th>Hemisphere (sky / ground, intensity)</th><th>Sun (colour, intensity, direction)</th></tr>
<tr><td>Day</td><td>#9cc4dc / #b4c0c6</td><td>#dfe6ff / #8a7f74, 1.45</td><td>#fff3dc, 2.1, (−0.5, 1.7, 0.42)</td></tr>
<tr><td>Dusk</td><td>#b0706a / #8a6060</td><td>#ffb08a / #5a4040, 0.85</td><td>#ff9a58, 1.25, (−1, 0.32, −0.25)</td></tr>
<tr><td>Night</td><td>#0a0f1a / #0b0f17</td><td>#4a5a88 / #14141c, 0.32</td><td>moonlight #8aa0e8, 0.45, (0.45, 1.2, −0.9)</td></tr></table>
<ul><li><b>NIGHT</b> (0 for day to 1 for night) drives every glow. Windows light by a stable seeded hash (about 45% lit, warm <code>#ffe08a</code>/<code>#ffbf3c</code>). Shop glass, signs and neon always glow.</li>
<li>Street lamps are warm orange <code>#ffa050</code>: additive glow pools on the ground, billboard halos, and 4 pooled point lights (intensity 16, range 15 m) that follow the hero. Assets <b>never add their own lights</b>; they register lamp points instead.</li>
<li>A cool camera-side fill (<code>#c8d0ff</code>, 3.2) keeps characters readable at night. Do not make character bodies emissive; only intentional glow parts (a ghost, crystals, sparks) may glow.</li></ul>
<div class="g4">{fig('street_night.jpg', 'Night street (in-game): lit windows, lamp pools and shop signs (current placeholders; real Baltimore signs are now wanted).')}
{fig('city_night.jpg', 'City at night: about 45% of windows lit, warm promenade lamps.')}
{fig('sign_day.jpg', 'Neon sign quality bar, day: canvas-drawn lettering on a steel lattice.')}
{fig('sign_night.jpg', 'The same sign at night: red-orange neon, soft glow, water reflection streak.')}</div>
"""

THUG_EXCERPT = kit_lines([(226, 236)])  # real buildThug opening

def code_section(kind):
    gull = open(H + '/kit/example_gull_thug.js').read(); bench = open(H + '/kit/example_bench.js').read()
    k_list = """<table><tr><th>K member</th><th>What it is (reuse it; do not re-create it)</th></tr>
<tr><td><code>K.THREE</code></td><td>three.js r160 namespace (the game's own instance)</td></tr>
<tr><td><code>K.toonMat(opts)</code></td><td>The cel-shaded Lambert material with vertex colours and hit-flash. One per character rig; sub-materials with a map copy its <code>userData.flash</code> and <code>flashC</code>.</td></tr>
<tr><td><code>K.basicMat(opts)</code></td><td>An unlit material for glow parts (opacity driven by <code>K.NIGHT.value</code>).</td></tr>
<tr><td><code>K.OUT_CHAR / OUT_PROP / OUT_CITY</code></td><td>The three shared outline hull materials (widths 0.0042 / 0.0030 / 0.0034).</td></tr>
<tr><td><code>K.G.sph / cap / box / cyl / tor</code></td><td>The primitive geometry makers. They pick HD segment counts for you.</td></tr>
<tr><td><code>K.part(parent, geom, colour, x, y, z, {rot, outline, mat, shadow})</code></td><td>Bakes the colour, adds the ink hull and casts shadows. The parent group must carry <code>userData.mat</code>.</td></tr>
<tr><td><code>K.grp(parent, x, y, z)</code> · <code>K.skeleton(d, mat)</code></td><td>Groups; the 18-joint rig: tilt, hips, torso, neck, shL/R, elL/R, haL/R, lgL/R, knL/R, ftL/R, swL/R.</td></tr>
<tr><td><code>K.HERO_D / K.THUG_D</code></td><td>Rig proportions (hip height, limb lengths).</td></tr>
<tr><td><code>K.blank() · legsStance() · runLegs() · applyPose()</code></td><td>Pose objects and helpers. <code>K.THUG_POSES</code> and <code>K.HERO_POSES</code> are the game's own animations.</td></tr>
<tr><td><code>K.place(geom, x, y, z, ry)</code> · <code>K.makeOut()</code> · <code>K.makeAtlas(tiles)</code></td><td>The static-geometry path: world placement, the merging collector (<code>out.solid / glow / decal / coll / bld / lamp / hook / build</code>) and the single canvas atlas.</td></tr>
<tr><td><code>K.CITY_MAT · K.GLOW_MAT · K.LIGHT · K.applyLight · K.NIGHT · K.INK</code></td><td>The shared city materials, the day/dusk/night presets and the ink colour.</td></tr></table>"""
    s = f"""<h1 class="sec">3 · Code starter and interface</h1>
<p>Every delivery is a <b>drop-in JS module</b>: no imports, one <code>META</code>, build functions that take <code>K</code>. Below is a real excerpt from the game, the opening of the thug builder exactly as it ships, followed by the kit examples that define the interface you must follow.</p>
<h2>Real excerpt: how the game builds a thug (src/04_actors.js)</h2><pre>{html.escape(THUG_EXCERPT)}</pre>
<p>The pattern: one <code>toonMat</code> per rig → <code>skeleton(d, mat)</code> → <code>part(joint, G.prim(…), colour, x, y, z, opts)</code> on each joint → <code>J.head</code> group under <code>J.neck</code> → <code>J.kind</code> → return <code>J</code>. The game wraps <code>J</code> in a Fighter (position, yaw, HP, AI), drives the joints with the pose tables and flashes <code>J.mat</code> on hits.</p>
{k_list}"""
    if kind in ('chars', 'all'):
        s += f"<h2>Character interface: example_gull_thug.js (complete)</h2><pre>{html.escape(gull)}</pre>"
    if kind in ('props', 'all'):
        s += f"<h2>Prop interface: example_bench.js (complete)</h2><pre>{html.escape(bench)}</pre>"
    s += """<h2>Rules that make code drop in</h2><ul>
<li>No <code>import</code>. No globals, no <code>window</code>, no DOM except canvas drawing inside texture or atlas functions. No <code>Math.random()</code> at build time (use a seeded LCG from <code>opts.seed</code>).</li>
<li>Characters return the rig <code>J</code> (bosses also export <code>POSES</code> and <code>ATTACKS</code>). Static pieces write only through <code>out</code>. Vehicles return <code>{ root, kind, seats, collider, waterline, animate }</code>.</li>
<li>Facing is +Z, the base sits at y = 0 and units are metres. Materials come only from <code>K</code>. Never change <code>toadcity_kit.js</code>.</li></ul>"""
    return s

def task_section(k, title):
    return f"""<h1 class="sec">{title}</h1>
<p>The box below is the <b>complete copy-paste prompt</b> for this task. Give it to the model together with <code>toadcity_starter_kit.zip</code>. The same text is in <code>prompts/{NAMES[k]}</code>.</p>
<div class="prompt"><span class="tag">COPY-PASTE PROMPT · TASK {k}</span>{md(full_prompt(k, ROLE[k]))}</div>"""

def delivery_section(n):
    return f"""<h1 style="margin-top:18px">{n} · Delivery instructions</h1><p>The full delivery and self-test block is the last part of every copy-paste prompt above. In summary: <b>one zip per task</b>, named <code>toadcity_task&lt;LETTER&gt;_&lt;short-name&gt;_v&lt;N&gt;.zip</code>, containing <code>src/</code> (your modules), an unchanged <code>toadcity_kit.js</code>, <code>viewer.html</code>, <code>previews/</code> (day and night PNGs at 1280×720 per asset, plus a 390×844 phone framing), a <code>README.md</code> with the measured budget table, and <code>LICENSES.md</code>.</p>
<div class="note"><b>Licences.</b> Everything should be procedural or original. If any snippet comes from elsewhere, it must be MIT or CC0 and credited in <code>LICENSES.md</code> (name, URL, licence). three.js itself is MIT and is loaded by the viewer only, never copied into <code>src/</code>. Do not send anything with an unclear licence, and no photographs, logo image files or traced artwork. Real sign wording and styles are fine when redrawn in code.</div>
<p><b>Hand-back:</b> one zip per task, versioned (<code>_v1</code>, <code>_v2</code> …); re-deliver the whole zip after fixes, not a diff. A separate QA model reviews each zip (pass/fail per asset, with numbered fixes), so expect one fix round. List anything unfinished under <i>Known issues</i> in the README.</p>"""

def appendix(title, ranges, note):
    return f"""<h1 class="sec">{title}</h1><p>{note}</p><pre class="small">{html.escape(kit_lines(ranges))}</pre>"""

def checklists_all():
    out = ''
    for k in 'ABCD':
        t = TASK[k]; name = t.split('\n')[0].lstrip('# ')
        bud = re.search(r'## Performance budget.*?(?=\n## )', t, re.S).group(0)
        acc = re.search(r'## Acceptance checklist.*?(?=\n## )', t, re.S).group(0)
        dont = re.search(r'## Do NOT.*?(?=\n## )', t, re.S).group(0)
        iface = re.search(r'## Interface.*?(?=\n## )', t, re.S)
        iface = iface.group(0) if iface else ''
        out += f'<h2 style="font-size:14pt;border-bottom:2px solid #2f2457;margin-top:16px">{name}</h2>' + md(iface.replace('## ', '### ')) + md(bud.replace('## ', '### ')) + md(acc.replace('## ', '### ')) + md(dont.replace('## ', '### '))
    return out

# ---------- the three documents ----------
SET_OPUS = 'Use <b>Claude Opus</b> (the newest Opus available to you) with <b>extended thinking ON at high effort</b> (max for the hardest bosses: Mister Formstone, the vehicle bosses and Sugar Rush). Work on <b>one gang or one boss per session</b>, and self-test it in <code>viewer.html</code> (day, night, every pose, the budget readout) before you move on. Opus is the lead character builder.'
SET_SONNET = 'Use <b>Claude Sonnet</b> (the newest Sonnet available to you) with <b>extended thinking ON at medium effort</b>, and <b>high effort for the first kit piece</b> (the Formstone rowhouse), the first prop and the first vehicle, because those set the pattern. Work on one kit piece or prop family per session and self-test it in <code>viewer.html</code> before you move on. Hand finished, QA-passed modules to <b>Claude Haiku</b> for variations (Appendix B).'
SET_GEM = 'Use <b>Gemini Pro</b> (the newest Pro model available to you) with <b>thinking set to high</b>. You are the <b>QA reviewer</b>: you do not build. Review one delivery zip at a time (its code, README and preview PNGs) and return a pass/fail list with specific numbered fixes per asset, using the rubric in section 5.'

APP_CHARS = [(1, 86), (88, 119), (218, 218), (264, 278), (350, 397)]
APP_PROPS = [(1, 86), (88, 107), (398, 456)]

DOCS = {
 'OPUS': dict(file='Toad_City_Brief_OPUS.pdf', model='Claude Opus', title='Characters: thug gangs and the 17 bosses',
   sub='Tasks C and D · lead character builder · drop-in three.js rig modules', setting=SET_OPUS, img='heroes_day.jpg',
   toc=[('1 · Project overview', 0), ('2 · Style guide and quality bar', 0), ('3 · Code starter and interface', 0), ('4 · Task C: Thug gangs (5 district gangs)', 0),
        ('5 · Task D: The 17 bosses', 0), ('6 · Delivery instructions', 0), ('Appendix · Kit core (characters)', 0)],
   body=lambda: overview() + style() + code_section('chars') + task_section('C', '4 · Task C: Thug gangs (5 district gangs)') + task_section('D', '5 · Task D: The 17 bosses')
     + delivery_section(6) + appendix('Appendix · Kit core (characters)', APP_CHARS, 'The character-relevant core of <code>toadcity_kit.js</code>, printed so you can rebuild it if the zip is missing (… marks omitted sections: buildHero, buildThug, hero poses, the prop collector; THUG_POSES.down reuses HERO_POSES.down). The file ends by exporting every function and constant above as <code>export const K = { … }</code>. Use the zip copy when you have it.')),
 'SONNET': dict(file='Toad_City_Brief_SONNET.pdf', model='Claude Sonnet', title='Environment: rowhouse kit, street props and vehicles',
   sub='Tasks A and B · merged city geometry and rideable vehicles · drop-in three.js modules', setting=SET_SONNET, img='street_night.jpg',
   toc=[('1 · Project overview', 0), ('2 · Style guide and quality bar', 0), ('3 · Code starter and interface', 0), ('4 · Task A: Baltimore rowhouse and city-block kit', 0),
        ('5 · Task B: Street props and vehicles', 0), ('6 · Delivery instructions', 0), ('Appendix A · Kit core (props and city)', 0), ('Appendix B · Haiku helper prompts', 0)],
   body=lambda: overview() + style() + code_section('props') + task_section('A', '4 · Task A: Baltimore rowhouse and city-block kit') + task_section('B', '5 · Task B: Street props and vehicles')
     + delivery_section(6) + appendix('Appendix A · Kit core (props and city)', APP_PROPS, 'The prop and city core of <code>toadcity_kit.js</code>, printed so you can rebuild it if the zip is missing (… marks omitted sections: characters and poses, lighting presets). The file ends by exporting every function and constant above as <code>export const K = { … }</code>. Use the zip copy when you have it.')
     + '<h1 class="sec">Appendix B · Haiku helper prompts</h1><p>Short, low-effort prompts for <b>Claude Haiku</b> (extended thinking off). Use them only on Sonnet modules that have <b>passed QA</b>. Haiku makes colour, window, sign and trim variations and tidies file names and READMEs, without touching geometry logic, budgets or interfaces. The same text is in <code>prompts/HAIKU_helper_prompts.md</code>.</p>'
     + md(HAIKU.split('\n', 3)[3])),
 'GEMINI_PRO': dict(file='Toad_City_Brief_GEMINI_PRO.pdf', model='Gemini Pro', title='QA review: style, budgets and acceptance for all four tasks',
   sub='Reviewer role · pass/fail per asset with specific fixes · Tasks A, B, C and D', setting=SET_GEM, img='city_night.jpg',
   toc=[('1 · Project overview', 0), ('2 · Style guide and quality bar', 0), ('3 · Code starter and interface', 0), ('4 · Acceptance checklists and budgets (A–D)', 0),
        ('5 · Review prompt and scoring rubric', 0), ('6 · Review workflow', 0)],
   body=lambda: overview() + style() + code_section('all')
     + '<h1 class="sec">4 · Acceptance checklists and budgets (A–D)</h1><p>These are the exact interfaces, budgets, checklists and "do not" lists the builders received. Judge each delivery against its own task only.</p>' + checklists_all()
     + '<h1 class="sec">5 · Review prompt and scoring rubric</h1><div class="prompt"><span class="tag">COPY-PASTE REVIEW PROMPT</span>' + md(QA.split('\n', 1)[1].replace('## Copy-paste review prompt', '').split('## Scoring rubric')[0]) + '</div>'
     + md('## Scoring rubric' + QA.split('## Scoring rubric')[1])
     + """<h1 class="sec">6 · Review workflow</h1><ol>
<li><b>Intake:</b> for each zip, confirm the folder layout (src/, toadcity_kit.js, viewer.html, previews/, README.md, LICENSES.md). If something is missing, give an immediate FAIL with a blocker per missing item.</li>
<li><b>Kit integrity:</b> the delivered <code>toadcity_kit.js</code> must be byte-identical to the kit printed in the builders' briefs. Any edit is a Gate I blocker.</li>
<li><b>Code pass:</b> grep for <code>import</code>, <code>new THREE.Mesh*Material</code>, <code>MeshStandard</code>, <code>Math.random</code>, <code>PointLight</code>, <code>SpotLight</code>, <code>TextureLoader</code>, <code>GLTFLoader</code>, <code>fetch(</code> and http URLs. Each hit is a finding (Gate I or O).</li>
<li><b>Budget pass:</b> estimate the triangles from the code (sphere ≈ 2·w·h, capsule ≈ 2·(rings+caps)·radial, box 12, cylinder ≈ 4·segments) and compare them with the README table. More than a 15% mismatch means UNVERIFIED and a request for the viewer readout.</li>
<li><b>Visual pass:</b> compare the day and night PNGs with the style guide renders. Check outline presence and width, the three bands, palette fit, phone readability and the night glows.</li>
<li><b>Write the report</b> in the output format. Put the Top 3 fixes first in priority. Keep fixes concrete: name the file, the function or part, the number or colour, and the expected result.</li>
<li><b>Re-review</b> the v2 zip against the v1 findings: mark each one FIXED, PARTIAL or OPEN, then do a full new pass.</li></ol>
<div class="note">Builders: <b>Claude Opus</b> does Task C (gangs) and Task D (bosses). <b>Claude Sonnet</b> does Task A (rowhouse kit) and Task B (props and vehicles), with <b>Claude Haiku</b> making variations of modules that have passed QA. Landmark buildings and frame-level performance are done in-house and are out of scope; flag any landmark modelling you see as a finding.</div>"""),
}

def build_html(key):
    d = DOCS[key]
    body = cover(d['model'], d['title'], d['sub'], d['setting'], d['img']) + toc([(t, s) for t, s in d['toc']]) + d['body']()
    return f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{body}</body></html>'

if __name__ == '__main__':
    pages = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    for key, d in DOCS.items():
        h = build_html(key)
        for t, _ in d['toc']:
            h = h.replace('{{P:' + t + '}}', str(pages.get(key, {}).get(t, '·')))
        open(f'{B}/{key}.html', 'w').write(h)
    print('ok')
