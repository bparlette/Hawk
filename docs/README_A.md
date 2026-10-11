# Toad City Baltimore — Task A: Baltimore rowhouse and city-block kit (v1)

Drop-in three.js r160 modules (no imports, one `META`, build functions that take `K`) that fill the generic 24 x 24 m city blocks with recognisable
Baltimore rowhouse streets: Formstone, brick, painted-brick and permastone fronts, white marble stoops, bracketed cornices with dentils, painted window
screens, corner bars and corner shops. Everything is merged through `out`, so a whole block is **4 draw calls** and **one 1024² atlas**.

## Contents

```
src/rowkit_tiles.js      KIT_TILES: the canvas-drawn atlas tiles (60 tiles, 70 % of the 1024² atlas, packed into 880 px of height)
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
| rowkit_rowhouse.js | `buildRowhouse` | `(K, out, atlas, x, z, ang = 0, opts = {})` | `{ width, depth, height }` |
| rowkit_corner.js | `buildCornerBar`, `buildCornerShop` | `(K, out, atlas, x, z, ang = 0, opts = {})` | `{ width, depth, height, corner }` |
| rowkit_block.js | `buildRowBlock` | `(K, out, atlas, x0, z0, x1, z1, opts = {})` | `{ houses, corners, height, pieces }` |

`(x, z)` is the centre of the FRONT wall at pavement level; the front faces +Z rotated by `ang` (a house on a block's north edge uses `ang = PI`). The base sits on `K.CURB` (0.16).
Geometry is written only through `out.solid / glow / decal / coll / bld / hook`.

**Options** (all optional, all seeded from `opts.seed`):
`buildRowhouse`: `front` ('formstone' | 'brick' | 'permastone'), `paint` (painted brick), `brick` (0-5 palette index), `variant` (tile tint), `floors` (3 | 4), `width` (4.2-6.0), `depth` (12-14), `bays` (2 | 3),
`doorSide` (-1 | 1), `steps` (3-5), `stoopWidth` (1.3-1.5), `stoopProj` (1.4-1.8), `corniceProj` (0.5-0.8), `brackets` (4-8), `corniceColor` (palette hex), `screens` (painted window screens on/off), `deck` (rooftop deck),
`doorColor` (0-3), `number`, `left` / `right` (a neighbour is attached on that side: no side wall, no end cap), `leftTop` / `rightTop` (neighbour roof height: only the part above it is drawn), `climb` (adds the CLIMB hook on the downspout), `stats` (`{windows, lit}` counters).
`buildCornerBar` / `buildCornerShop`: `corner` (-1 | 1: which end of the front wall carries the chamfered corner door), `width` (6.5-8), `depth` (7.5), `chamfer` (1.8), `floors`, `sign`
('tavern' | 'crab' | 'bar_grill' for bars, 'market' | 'carryout' | 'barber' | 'hardware' | 'laundromat' | 'deli' for shops), `shutter` ('none' | 'half' | 'closed'), `left`, `leftTop`, `climb`, `brick`, `corniceColor`.
`buildRowBlock`: `seed`, `builders` = `{ buildRowhouse, buildCornerBar, buildCornerShop }` (needed when the files are used as ES modules; in the concatenated game build the globals of the same names are used), `rowDepth` (7.5), `alley` (3), `stats`.

## Measured budgets (viewer readout, `window.__api.measure(id)`; ink hulls are counted in the triangles)

| asset | what | meshes | ink hulls | tris (incl. hulls) | tris (no hulls) | draw calls | materials | budget | result |
|---|---|---|---|---|---|---|---|---|---|
| `rowhouse` | house, 3 storeys, Formstone | 3 | 1 | 1516 | 1434 | 4 | 4 | <= 2500 | pass |
| `rowhouse_4` | house, 4 storeys | 3 | 1 | 1684 | 1602 | 4 | 4 | <= 2500 | pass |
| `corner_bar` | corner bar | 3 | 1 | 2102 | 1952 | 4 | 4 | <= 3500 | pass |
| `corner_shop` | corner shop | 3 | 1 | 1988 | 1830 | 4 | 4 | <= 3500 | pass |
| `block` | full block (12-14 houses + 1-2 corners) | 3 | 1 | 14038 | 12804 | 4 | 4 | <= 30000 | pass |

* "meshes" = merged toon mesh + glow mesh + decal mesh; every ink hull is one more draw call. A block is `1 + 1 + 1 + 1 = 4` draw calls plus the shadow pass (the 3 casting meshes).
* Materials are only what `out` uses: `K.CITY_MAT`, `K.OUT_CITY`, the glow material and the **one** kit atlas material. No per-house materials or meshes.
* House on its own: 1516 tris (3 storeys) and 1684 (4 storeys). Corner bar 2102, corner shop 1988. A block is 14038 (typically 13-15k).
* Build cost (desktop CPU, not counting the atlas): about 45-80 ms per block for the geometry plus 5-20 ms for `out.build()`. Expect roughly 3x on a phone; build blocks one per frame while loading.

## Self-test results

| check | result |
|---|---|
| same seed gives the same block | block seed 11 built twice: vertex hash `665200483` both times (18051 vertices) |
| a different seed gives a visibly different mix | seed 12: hash `409655314`, 18430 vertices; different corners, fronts, heights, colours (see `previews/block_*`) |
| night: about 45 % of windows lit, seeded and stable | block seed 11: 46 of 102 windows lit = 45 %; seed 12: 40 of 95 = 42 %; identical on rebuild |
| nothing floats, nothing sinks below `CURB` | lowest y of every asset = 0.16 (`bbox` in `docs/measured_A.json`) |
| colliders, camera boxes, climb hook | block: 28 `out.coll` boxes, camera boxes via `out.bld`, exactly one `climb` hook, yard strip closed by `out.coll` |
| one atlas | `KIT_TILES` -> one `K.makeAtlas` of 60 tiles in 880 px of height |
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
