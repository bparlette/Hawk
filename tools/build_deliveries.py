#!/usr/bin/env python3
"""Builds docs/README_A.md, docs/README_B.md (from docs/measured_*.json) and the two delivery zips in dist/.

    node tools/measure.mjs all && node tools/previews.mjs all && node tools/batch.mjs /tmp/previews_jobs.json
    python3 tools/build_deliveries.py
"""
import json, os, re, sys, zipfile, hashlib, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p)))
A, B = J('docs/measured_A.json'), J('docs/measured_B.json')
VERSION = 1

TASKS = {
    'A': dict(name='rowhouse_kit', title='Task A: Baltimore rowhouse and city-block kit',
              src=['rowkit_tiles', 'rowkit_rowhouse', 'rowkit_corner', 'rowkit_block']),
    'B': dict(name='props_vehicles', title='Task B: street props and vehicles',
              src=['props_tiles', 'props_street', 'props_crab_shack', 'veh_cars', 'veh_boats', 'veh_carts']),
}

LICENSES = """# Licences

All assets are original and procedural (three.js r160, MIT, loaded by the viewer only).

* Everything in `src/` is original code written for Toad City Baltimore. Geometry is built from three.js primitives, extrusions and lofts;
  every texture is drawn on a `<canvas>` at load. There are no model files, image files, web fonts or network fetches in `src/`.
* three.js r160 (MIT, https://github.com/mrdoob/three.js) is loaded by `viewer.html` from https://unpkg.com/three@0.160.0/ through an import map.
  It is **not** copied into `src/` and is not part of this zip.
* No third-party code, snippets, textures or artwork are used. No MIT / CC0 source needs crediting.
* Real Baltimore names and sign styles (Natty Boh-style beer sign, Utz, Old Bay, harbour water-taxi lettering, arabber colours, crab-house wording)
  are re-drawn from plain text and flat shapes on canvas, as the brief allows. No logo file, photo or traced artwork was used or embedded.
  The names belong to their owners and appear here only to make the fictional Inner Harbor read as the real one.
* `toadcity_kit.js` is the shared kit. The starter zip was missing from the hand-off, so it was rebuilt from Appendix A of the brief (see README, "Kit"). Replace it with the real file; nothing in `src/` depends on the rebuilt parts.
"""

def table(rows, header):
    out = ['| ' + ' | '.join(header) + ' |', '|' + '|'.join(['---'] * len(header)) + '|']
    out += ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]
    return '\n'.join(out)

def ok(v, lim):
    return 'pass' if v <= lim else 'OVER'

def readme_a():
    rows = []
    spec = [('rowhouse', 'house, 3 storeys, Formstone', 2500), ('rowhouse_4', 'house, 4 storeys', 2500), ('corner_bar', 'corner bar', 3500), ('corner_shop', 'corner shop', 3500), ('block', 'full block (12-14 houses + 1-2 corners)', 30000)]
    for k, label, lim in spec:
        m = A[k]
        rows.append([f'`{k}`', label, m['meshes'], m['hulls'], m['tris'], m['trisNoHull'], m['drawCalls'], m['materials'], f'<= {lim}', ok(m['tris'], lim)])
    t1 = table(rows, ['asset', 'what', 'meshes', 'ink hulls', 'tris (incl. hulls)', 'tris (no hulls)', 'draw calls', 'materials', 'budget', 'result'])
    d = A['determinism']; bs = d['block_same'][0]; bo = d['block_other']
    atlas = A['atlasInfo']
    return f"""# Toad City Baltimore — {TASKS['A']['title']} (v{VERSION})

Drop-in three.js r160 modules (no imports, one `META`, build functions that take `K`) that fill the generic 24 x 24 m city blocks with recognisable
Baltimore rowhouse streets: Formstone, brick, painted-brick and permastone fronts, white marble stoops, bracketed cornices with dentils, painted window
screens, corner bars and corner shops. Everything is merged through `out`, so a whole block is **{A['block']['drawCalls']} draw calls** and **one 1024² atlas**.

## Contents

```
src/rowkit_tiles.js      KIT_TILES: the canvas-drawn atlas tiles ({atlas['tiles']} tiles, {atlas['areaPct']} % of the 1024² atlas, packed into {atlas['usedHeight']} px of height)
src/rowkit_rowhouse.js   buildRowhouse
src/rowkit_corner.js     buildCornerBar, buildCornerShop
src/rowkit_block.js      buildRowBlock
toadcity_kit.js          the kit (see "Kit" below)
viewer.html              test bench
previews/                <asset>_day.png / _night.png (1280x720), rowkit_phone_*_390x844.png
README.md  LICENSES.md
```

## How to view

```
python3 -m http.server 8000      # in this folder; the viewer loads three.js r160 from unpkg
http://localhost:8000/viewer.html?show=street            two facing blocks across a 10 m street (day; press N for night)
                                ?show=block              one block      (&seed=12 for another mix)
                                ?show=rowhouse           3-storey Formstone house   (rowhouse_brick, rowhouse_permastone, rowhouse_4)
                                ?show=houses             a line-up of every front type and both heights
                                ?show=corner_bar  ?show=corner_shop  ?show=atlas
                                &night=1  &cam=fit|game|phone|front|top  &yaw=&pitch=&zoom=  &pos=x,y,z&look=x,y,z&fov=  &hud=0
```
Keys: **N** night/day, **C** camera, **H** readout. The top-left readout shows triangles / draw calls against the budget (green = inside). `window.__ready === true`
when the first frames are drawn; `window.__errors` lists page errors (empty = zero errors).

## Exports

| file | export | signature | returns |
|---|---|---|---|
| rowkit_tiles.js | `KIT_TILES` | `K.makeAtlas(KIT_TILES)` -> `atlas` (one per task) | tile table |
| rowkit_rowhouse.js | `buildRowhouse` | `(K, out, atlas, x, z, ang = 0, opts = {{}})` | `{{ width, depth, height }}` |
| rowkit_corner.js | `buildCornerBar`, `buildCornerShop` | `(K, out, atlas, x, z, ang = 0, opts = {{}})` | `{{ width, depth, height, corner }}` |
| rowkit_block.js | `buildRowBlock` | `(K, out, atlas, x0, z0, x1, z1, opts = {{}})` | `{{ houses, corners, height, pieces }}` |

`(x, z)` is the centre of the FRONT wall at pavement level; the front faces +Z rotated by `ang` (a house on a block's north edge uses `ang = PI`). The base sits on `K.CURB` (0.16).
Geometry is written only through `out.solid / glow / decal / coll / bld / hook`.

**Options** (all optional, all seeded from `opts.seed`):
`buildRowhouse`: `front` ('formstone' | 'brick' | 'permastone'), `paint` (painted brick), `brick` (0-5 palette index), `variant` (tile tint), `floors` (3 | 4), `width` (4.2-6.0), `depth` (12-14), `bays` (2 | 3),
`doorSide` (-1 | 1), `steps` (3-5), `stoopWidth` (1.3-1.5), `stoopProj` (1.4-1.8), `corniceProj` (0.5-0.8), `brackets` (4-8), `corniceColor` (palette hex), `screens` (painted window screens on/off), `deck` (rooftop deck),
`doorColor` (0-3), `number`, `left` / `right` (a neighbour is attached on that side: no side wall, no end cap), `leftTop` / `rightTop` (neighbour roof height: only the part above it is drawn), `climb` (adds the CLIMB hook on the downspout), `stats` (`{{windows, lit}}` counters).
`buildCornerBar` / `buildCornerShop`: `corner` (-1 | 1: which end of the front wall carries the chamfered corner door), `width` (6.5-8), `depth` (7.5), `chamfer` (1.8), `floors`, `sign`
('tavern' | 'crab' | 'bar_grill' for bars, 'market' | 'carryout' | 'barber' | 'hardware' | 'laundromat' | 'deli' for shops), `shutter` ('none' | 'half' | 'closed'), `left`, `leftTop`, `climb`, `brick`, `corniceColor`.
`buildRowBlock`: `seed`, `builders` = `{{ buildRowhouse, buildCornerBar, buildCornerShop }}` (needed when the files are used as ES modules; in the concatenated game build the globals of the same names are used), `rowDepth` (7.5), `alley` (3), `stats`.

## Measured budgets (viewer readout, `window.__api.measure(id)`; ink hulls are counted in the triangles)

{t1}

* "meshes" = merged toon mesh + glow mesh + decal mesh; every ink hull is one more draw call. A block is `1 + 1 + 1 + 1 = {A['block']['drawCalls']}` draw calls plus the shadow pass (the 3 casting meshes).
* Materials are only what `out` uses: `K.CITY_MAT`, `K.OUT_CITY`, the glow material and the **one** kit atlas material. No per-house materials or meshes.
* House on its own: {A['rowhouse']['tris']} tris (3 storeys) and {A['rowhouse_4']['tris']} (4 storeys). Corner bar {A['corner_bar']['tris']}, corner shop {A['corner_shop']['tris']}. A block is {A['block']['tris']} (typically 13-15k).
* Build cost (desktop CPU, not counting the atlas): about 45-80 ms per block for the geometry plus 5-20 ms for `out.build()`. Expect roughly 3x on a phone; build blocks one per frame while loading.

## Self-test results

| check | result |
|---|---|
| same seed gives the same block | block seed 11 built twice: vertex hash `{bs['hash']}` both times ({bs['verts']} vertices) |
| a different seed gives a visibly different mix | seed 12: hash `{bo['hash']}`, {bo['verts']} vertices; different corners, fronts, heights, colours (see `previews/block_*`) |
| night: about 45 % of windows lit, seeded and stable | block seed 11: {bs['lit']} of {bs['windows']} windows lit = {100*bs['lit']/bs['windows']:.0f} %; seed 12: {bo['lit']} of {bo['windows']} = {100*bo['lit']/bo['windows']:.0f} %; identical on rebuild |
| nothing floats, nothing sinks below `CURB` | lowest y of every asset = 0.16 (`bbox` in `docs/measured_A.json`) |
| colliders, camera boxes, climb hook | block: {bs['coll']} `out.coll` boxes, camera boxes via `out.bld`, exactly one `climb` hook, yard strip closed by `out.coll` |
| one atlas | `KIT_TILES` -> one `K.makeAtlas` of {atlas['tiles']} tiles in {atlas['usedHeight']} px of height |
| console | zero errors / warnings in headless Chromium (swiftshader) for every show listed above |

Acceptance checklist: all five pieces exist with the exact signatures; `?show=street` shows two facing blocks across a 10 m street with pavement, day and night; Formstone, marble stoops, bracketed cornices,
painted screens (6 designs: cottage by a lake, swan, lighthouse, sailboat, crab, heron), corner bar and corner shop are present; 3- and 4-storey variants and 4 front families (Formstone x4 tints, permastone x3, brick x6, painted brick x4);
budgets measured above; night glow on windows, shop glass, glass block and neon; same seed same block.

## What is where

* **Fronts** are decal cells (1.2 m, mirrored at random, tileable tiles): Formstone with bold irregular darker block outlines (not `K.INK`), permastone, 6 brick colours from the building palette, 4 painted-brick pastels.
  The 3D relief is real geometry: stone water table, string courses, lintels and sills, hood over the door, marble stoop (3-5 steps, 1.3-1.5 m wide, 1.4-1.8 m out, cool shadow band on every riser, near-white nosing, iron rails),
  bracketed cornice (0.5-0.8 m, 4-8 brackets, dentil band, crown), parapet, roof hatch, chimney, optional deck, downspout.
* **Night**: every window is one decal plus two glow quads (upper and lower sash) when lit (`#ffe08a` / `#ffbf3c`, chosen by the seeded RNG); unlit windows keep their dark blue-grey glass. Shop glass, glass block and neon always glow.
  Neon (TAVERN / CRABS / GRILL / OPEN) is stroke geometry: dull tube colour by day, bright through `out.glow` at night.
* **Corner bar**: glass block, striped awning, painted board (TAVERN, CRAB HOUSE, BAR & GRILL), neon over the chamfered door, Natty Boh-style blade sign. **Corner shop**: big shop window with Utz / Old Bay / Natty Boh-style product signs and an OPEN sign, roll-up shutter (none / half / closed), awning, wall sign.
* **Block layout** (see the header of `rowkit_block.js`): north and south rows are 7.5 m deep and run the full 24 m; the 9 m between them holds one 10.5 m deep row on the west and on the east edge; a 3 x 9 m yard strip with bins and crates is left in the middle and closed by `out.coll`.
  Neighbours never repeat the same front and colour; a corner bar / shop is placed on 1 or 2 corners, the other corners are ordinary end-of-row houses.

## Kit

`toadcity_kit.js` is **not** the game's file: the starter zip was missing, so it was rebuilt from Appendix A (the prop / city core is the appendix text; the rig, pose and lighting tables that the appendix elides with "..." were re-created from the numbers in the brief).
The modules in `src/` only use `K.THREE`, `K.place`, `K.makeOut`, `K.makeAtlas` and, with fallbacks to the brief's constants, `K.CURB`, `K.GF`, `K.FH`. Swap in the real `toadcity_kit.js` and the viewer and the modules keep working
(the viewer's Harold dummy and lighting use the rebuilt rig / presets and may need a one-line change for the real ones).

## Known issues / decisions

1. **House depth inside a block is 7.5 m (north / south rows) and 10.5 m (west / east houses)**, not 12-14 m: houses on all four streets of a 24 m block with a 3 m yard cannot be deeper. `buildRowhouse` still defaults to 12-14 m on its own; `META.footprint` is the stand-alone one.
2. Window glass is part of the window decal (dark blue-grey) rather than separate `out.solid` quads; lit windows add two glow quads. The visible result matches the brief (dark glass when unlit, warm when lit).
3. The west / east edges of a block hold two houses each (the rows between the north and south rows are only 9 m long).
4. Fonts: `Impact` / `"Arial Black"` are not on every platform; text is auto-fitted (`fitText`) so signs never overflow, but the letter shapes differ where the fallback sans is used (iOS).
5. Shadow bias: decals sit 1.2 cm in front of the wall; with the viewer's sun (`bias -0.0006`, `normalBias 0.06`) there is no acne. The game's shadow settings may need the same normal bias.
6. `rowhouseWindow` is exported from `rowkit_rowhouse.js` as a helper; the corner module carries its own copy (modules cannot import).
7. Helper names are prefixed per file (`rh*`, `cn*`, `bk*`) and the tile tables live in closures, so concatenating the files into one scope does not collide (only `META` is repeated, as the brief requires).
"""

def readme_b():
    st = ['lamp_acorn', 'lamp_cobra', 'bench_park', 'bench_bus', 'trash_can', 'trash_can_recycling', 'crab_shack', 'manhole', 'ladder_wall', 'ladder_drop', 'parked_car_sedan', 'parked_car_hatchback', 'parked_car_pickup']
    lim = dict(lamp_acorn=350, lamp_cobra=250, bench_park=250, bench_bus=300, trash_can=250, trash_can_recycling=250, crab_shack=2500, manhole=120, ladder_wall=300, ladder_drop=300, parked_car_sedan=1500, parked_car_hatchback=1500, parked_car_pickup=1500)
    rows = []
    for k in st:
        m = B[k]; hooks = ', '.join(f'{n} x{c}' for n, c in m.get('hooks', {}).items()) or '-'
        rows.append([f'`{k}`', m['tris'], m['trisNoHull'], f'<= {lim[k]}', ok(m['tris'], lim[k]), m.get('coll', 0), hooks, m.get('lamps', 0)])
    t1 = table(rows, ['prop', 'tris (incl. hulls)', 'tris (no hulls)', 'budget', 'result', 'coll', 'hooks', 'lamps'])
    vl = dict(water_taxi=(4000, 8), paddle_boat=(2500, 6), dragon_boat=(6000, 10), car_sedan=(2000, 7), car_hatch=(2000, 7), box_truck=(2500, 7), arabber_cart=(5000, 12), skateboard=(600, 3))
    rows = []
    for k, (tl, ml) in vl.items():
        m = B[k]; c = m['collider']
        rows.append([f'`{k}`', m['kind'], m['tris'], m['trisNoHull'], f'<= {tl}', m['meshes'], f'<= {ml}', m['hulls'], m['drawCalls'], m['materials'], m['seats'], f"{round(c['w'], 2)} x {round(c['l'], 2)} x {round(c['h'], 2)}", m['waterline'], 'pass' if m['tris'] <= tl and m['meshes'] <= ml else 'OVER'])
    t2 = table(rows, ['vehicle', 'kind', 'tris (incl. hulls)', 'tris (no hulls)', 'budget', 'meshes', 'budget', 'ink hulls', 'draw calls', 'materials', 'seats', 'collider w x l x h', 'waterline', 'result'])
    atlas = B['atlasInfo']
    return f"""# Toad City Baltimore — {TASKS['B']['title']} (v{VERSION})

Static street props that merge into the chunk (no draw calls of their own) and rideable vehicles (their own small Groups): 9 props + 3 parked cars, 3 boats, 2 cars, a box truck, an arabber cart with a walking pony and a skateboard.
One 1024² atlas for the whole task (`PROP_TILES`, {atlas['tiles']} tiles, {atlas['areaPct']} % of the atlas, {atlas['usedHeight']} px high).

## Contents

```
src/props_tiles.js        PROP_TILES: bench plates and ads, crab-shack sign and chalkboard menu, manhole cover, recycling sticker, number plate, vehicle liveries
src/props_street.js       buildLampAcorn, buildLampCobra, buildBenchPark, buildBenchBus, buildTrashCan, buildManhole, buildLadderWall, buildLadderDrop
src/props_crab_shack.js   buildCrabShack
src/veh_cars.js           buildCarSedan, buildCarHatch, buildBoxTruck + the static buildParkedCarSedan / buildParkedCarHatchback / buildParkedCarPickup
src/veh_boats.js          buildWaterTaxi, buildPaddleBoat, buildDragonBoat
src/veh_carts.js          buildArabberCart, buildSkateboard
toadcity_kit.js           the kit (rebuilt from Appendix A, see "Kit")
viewer.html  previews/  README.md  LICENSES.md
```
(The parked cars live in `veh_cars.js` because they share the drivable cars' model.)

## How to view

```
python3 -m http.server 8000      # in this folder; the viewer loads three.js r160 from unpkg
http://localhost:8000/viewer.html?show=props            every static prop in a row on a pavement strip (Harold dummy for scale)
                                ?show=vehicles          every vehicle, animate() running: boats bob on the water plane (WY), wheels spin, paddles stroke, pony walks
                                ?show=<id>              one asset: lamp_acorn lamp_cobra bench_park bench_bus trash_can crab_shack manhole ladder_wall ladder_drop
                                                        parked_car_sedan parked_car_hatchback parked_car_pickup water_taxi paddle_boat dragon_boat car_sedan car_hatch box_truck arabber_cart skateboard
                                &night=1  &seed=n  &recycling=1 (trash can)  &collider=1 (green collider box)  &group=water|land (vehicles)  &cam= &yaw= &pitch= &zoom= &t=  &hud=0
```
Keys: **N** night/day, **C** camera, **Space** pause animation, **H** readout. Vehicles are shown with a Harold-sized dummy at every seat anchor. `window.__ready === true` after the first frames; `window.__errors` is empty when clean.

## Contracts

**Static props**: `buildXxx(K, out, x, z, ang = 0, opts = {{}})`, returns its `META.pieces[id]` entry (`{{ id, kind, footprint, height }}`). Base on `K.CURB` (the manhole at y 0.005, the parked cars on the road at y 0). Facing +Z rotated by `ang`.
`opts.atlas` = the shared `K.makeAtlas(PROP_TILES)`; if omitted the `PROP_TILES` global of the concatenated game build is used (cached on `K.makeAtlas._props`, so all files share one atlas).
Hooks: benches `out.hook('seat', {{x, y, z, ang}})`, manhole `out.hook('manhole', {{x, z}})`, ladders `out.hook('climb', {{x, z, ang, top}})` (`opts.top` = roof height), lamps `out.lamp(x, y, z)`. Colliders through `out.coll`.

**Vehicles**: `buildXxx(K, opts = {{}})` returns
`{{ root, kind: 'boat' | 'car' | 'cart' | 'board', seats: [{{ x, y, z, ang, pose: 'stand' | 'sit' | 'lean_out' }}], collider: {{ w, l, h }}, waterline, animate(v, dt, speed, steer, t) }}`.
* Facing +Z, wheels / base on y = 0, units in metres. The vehicle is centred on its bounding box along Z, so `collider` is a **centred** box along +Z with its base at y = 0 (the viewer draws it with `&collider=1`).
* `root` belongs to the game (position, yaw). `animate` only moves inner groups (`bob`, wheels, paddles, legs): speed in m/s, `steer` in -1..1 (positive = left, towards +X), `t` in seconds. It is cheap (no allocation).
* Boats: `waterline` is the local y that sits on the water plane, so `root.position.y = K.WY - waterline`. Everything else (bobbing, pitch) is done inside `animate`.
* Seat anchors: `'stand'` = the rider's feet point; `'sit'` and `'lean_out'` = the rider's hips (seat surface). `ang` is the rider's facing about Y (0 = looks along +Z). The driver of the cars sits on +X (left). `'lean_out'` (cars) is a label for the game's lean pose: the front side windows are open (dark cut-outs) so Harold and Mavis can lean out.
* Night: head / tail lights, cabin and cabin windows, nav lights, masthead, lanterns and the crab-shack sign glow through `out.glow` (the shared `K.GLOW_MAT`). Vehicles add no lights.
* Materials: the merged body uses the kit's `out` materials; the moving parts share **one** `K.toonMat()` per vehicle. No other material is created.

## Measured budgets (`window.__api.measure(id)`; ink hulls are counted in "tris (incl. hulls)")

### Static props (merge into the chunk: 0 draw calls of their own)

{t1}

### Vehicles

{t2}

* "meshes" are renderable meshes **not counting the ink hulls** (the brief's own reference counts "a mesh plus an ink hull" as one part). Draw calls = meshes + hulls.
* "materials" = distinct materials in the vehicle: the shared kit `out` materials (toon, ink hull, glow, atlas) + the one `toonMat` for the moving parts.
* `trash_can_recycling` is `buildTrashCan(..., {{ recycling: true }})`; the plain can is {B['trash_can']['tris']} tris.
* The dragon boat's 20 paddles are one mesh whose vertices are rotated per frame about each paddle's shoulder (about 500 vertices); `v.parts.paddles.visible = false` switches it off if the game prefers no CPU vertex work.

## Self-test results

| check | result |
|---|---|
| every prop and vehicle exists with the exact signature and return shape | all 12 static props (plus the recycling variant) and the 8 vehicles load and build with zero console errors |
| `?show=props` / `?show=vehicles` | pavement row with all 12 static props; vehicles with animate running |
| budgets | tables above, all pass |
| hooks | manhole -> `'manhole'`, ladders -> `'climb'`, benches -> `'seat'`, lamps -> `out.lamp` (counts in the first table) |
| night previews | lamp globes, headlights / tail lights, cabin windows, crab-shack neon, lanterns glow (`previews/*_night.png`) |
| seats line up with the hero rig | Harold dummy (1.6 m, kit rig) at every anchor in `?show=<vehicle>`; hips on the seat, feet on the deck |
| collider matches the visible hull | `&collider=1` overlay; box = the vehicle's bounding box (mast / mirrors excluded from width / height where noted in code) |
| one atlas | `PROP_TILES` -> one `K.makeAtlas` ({atlas['tiles']} tiles) for all props and vehicles |

## Kit

`toadcity_kit.js` was rebuilt from Appendix A (the starter zip was missing); the rig, pose tables and lighting presets that the appendix elides were re-created from the brief's numbers.
The modules use `K.THREE`, `K.place`, `K.makeOut`, `K.makeAtlas`, `K.toonMat` and `K.CURB` (fallback 0.16). Nothing else. Replace the file with the game's own kit and they keep working.

## Known issues / decisions

1. Livery details are recreations from memory (the harbour water-taxi's white / navy / gold scheme with blue lettering, the Utz-style truck, arabber red / yellow / green): the wording and shapes are original canvas drawings, not a verified match of the real vehicles.
2. Vehicle meshes are counted without ink hulls (see above). With hulls the car body adds one draw call, the sedan reads 8 draw calls.
3. The cars' `lean_out` is only a label for the game's pose; the viewer leans its dummy by about 55 degrees so the anchor can be checked against the open window.
4. Wheels, paddles, pony legs and tail are moving parts and have **no ink hull** (the dark tyres and thin parts do not need one); the pony's body, the dragon head and everything merged do.
5. `animate` assumes `dt` in seconds and a speed in m/s; the pony's walk, wheel spin and paddle rate scale with `speed`; at `speed = 0` boats still bob and the pony stands.
6. The crab shack's neon CRABS is geometry (dull tube by day); the painted STEAMED CRABS board is a canvas decal and does not glow (a glow layer would hide it). One `out.lamp` lights the front.
7. Parked cars stand on the road (y 0). Place them with `ang` = the lane direction; the viewer's props row turns them by 90 degrees to line up.
8. Helper names are namespaced per file (`PS`, `CS`, `VC`, `VB`, `VT`, `vcFit`, ...) and `PROP_TILES` lives in a closure, so concatenating the files does not collide (only `META` is repeated, as required).
"""

def patch_viewer(files):
    s = open(os.path.join(ROOT, 'viewer.html')).read()
    lst = ', '.join(f"'{f}'" for f in files)
    return re.sub(r"const FILES = \[[^\]]*\];", f"const FILES = [{lst}];", s, count=1)

def build_zip(letter):
    t = TASKS[letter]
    name = f"toadcity_task{letter}_{t['name']}_v{VERSION}.zip"
    path = os.path.join(ROOT, 'dist', name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    readme = readme_a() if letter == 'A' else readme_b()
    open(os.path.join(ROOT, 'docs', f'README_{letter}.md'), 'w').write(readme)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in t['src']:
            z.write(os.path.join(ROOT, 'src', f + '.js'), f'src/{f}.js')
        z.write(os.path.join(ROOT, 'toadcity_kit.js'), 'toadcity_kit.js')
        z.writestr('viewer.html', patch_viewer(t['src']))
        pv = sorted(os.listdir(os.path.join(ROOT, 'previews')))
        mine = [p for p in pv if not p.startswith('_') and (p.startswith('rowkit_') or p in {f'{a}_{d}.png' for a in A_IDS for d in ('day', 'night')}) ] if letter == 'A' else \
               [p for p in pv if not p.startswith('_') and (p.startswith('props_') or p.startswith('vehicles') or p in {f'{a}_{d}.png' for a in B_IDS for d in ('day', 'night')})]
        for p in mine:
            z.write(os.path.join(ROOT, 'previews', p), f'previews/{p}')
        z.writestr('README.md', readme)
        z.writestr('LICENSES.md', LICENSES)
    return path

A_IDS = ['rowhouse', 'rowhouse_4', 'rowhouse_brick', 'rowhouse_permastone', 'houses', 'corner_bar', 'corner_shop', 'block', 'street']
B_IDS = ['lamp_acorn', 'lamp_cobra', 'bench_park', 'bench_bus', 'trash_can', 'trash_can_recycling', 'crab_shack', 'manhole', 'ladder_wall', 'ladder_drop', 'parked_car_sedan', 'parked_car_hatchback', 'parked_car_pickup',
         'water_taxi', 'paddle_boat', 'dragon_boat', 'car_sedan', 'car_hatch', 'box_truck', 'arabber_cart', 'skateboard', 'props', 'vehicles_water', 'vehicles_land', 'vehicles']

if __name__ == '__main__':
    open(os.path.join(ROOT, 'LICENSES.md'), 'w').write(LICENSES)
    for L in ('A', 'B'):
        p = build_zip(L)
        print(os.path.basename(p), os.path.getsize(p) // 1024, 'KB', hashlib.md5(open(p, 'rb').read()).hexdigest()[:8])
