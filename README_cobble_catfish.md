# Toad City Baltimore: Task C, gang 3 of 5: Cobblestone Catfish (v1.1)

This gang is built to TASK_C plus the gang-2+ rules and the v1.1 margins:
- the real down pose and timings
- nothing through the ground
- shadow rules
- the texture-cache key
- the gang accent on the LOD, with matched colours
- HD ≤ 35 parts and ≤ 11,000 tris
- LOD ≤ 12 parts and ≤ 2,000 tris
- every part < 55 % buried
- LOD ≥ −2 cm
- measured-only numbers
- integration facts
- the game's real `mergeRig()`

`tools/qa.html` and `tools/shoot.mjs` produce every number below (same QA page as the Pier Gulls), and `tools/qa_table.py` pastes them in unedited. The raw run is `qa/cobble_catfish_report.json`.

| id | Gang | Animal | District | Accent |
|---|---|---|---|---|
| `cobble_catfish` | Cobblestone Catfish | channel catfish | Fells Point, Pendry | slate `#5f6688` + teal `#1fd3c6` |

## What changed in v1.1

v1 was accepted. v1.1 re-checks it against three corrections from the in-house team:
- **Dizzy:** the game's new `THUG_POSES.dizzy` is in the kit, copied exactly. QA runs hurt → dizzy (3 s at rate 10) → chase at 60 fps, with and without `animateGang`, on HD and LOD. It checks:
  - ground clearance
  - shoulder gaps every 10th frame
  - clearance below the stars sprite (2.2 × scale + 0.15 m above the root) every frame
  - stray ink in idle and at both extremes of the dizzy sway
- **Thug getup** is 0.5 s at rate 14 (v1 used the hero's 0.45 s). Re-running the knock-down at 0.5 s changes nothing material (before → after table below).
- **Culling sphere:** the radius is now 2.6 in the game, and QA checks it as a pass flag. The worst catfish reach is 2.38 m (armed, in `down`).

**One fix came out of the dizzy check.** In the dizzy-left sway, the bruiser's wide head tipped onto the sweater's top.
- The sweater's rim hull then drew **22 px** of stray ink across the head and barbel (3/4 view), against the 12 px limit.
- Raising the bruiser's head by 4 cm moved the problem to the head's own lower rim (15 px, dizzy-right front view).
- At **8 cm** higher (`J.head` offset `y = 0.08` on the bruiser only), the worst stray ink is **9 px**. The bruiser is 2.36 m tall (2.31 m before, scale 1.2), with 0.40 m clearance below the stars sprite.
- Two other attempts made no difference or made it worse, so they were reverted: shorter bruiser barbels, and moving the chin barbels forward. Nothing else in the module changed.

## What's in this zip

```
src/gang_cobble_catfish.js      the delivery: GANG, META, buildCatfish(K, member, opts), animateGang(J, t, state) (optional)
src/gang_pier_gulls.js          gang 2 v1.1 (unchanged; viewer.html registers it)
src/gang_harbor_rats.js         gang 1, unchanged (viewer.html registers it)
src/gang_masked_bandits.js      gang 4 v1 (viewer.html registers it)
toadcity_kit.js                 the kit, rebuilt from the brief's appendix, with the REAL HERO_POSES.down, THUG_POSES.down and THUG_POSES.dizzy
example_gull_thug.js            the brief's interface example (viewer comparison)
viewer.html                     test bench (see "How to view"); &merge=1 runs the game's mergeRig
previews/cobble_catfish_*.png   36 images: for each member, day and night turnarounds, a 7-pose sheet, 60 fps knock-down
                                attack and dizzy filmstrips (real timings, real mergeRig; the gold ring is the stars sprite height)
                                and an HD-vs-LOD turnaround; plus lineups
                                (day, night, merged), LOD lineup, hit-flash (parts and merged) and phone day/night
qa/cobble_catfish_report.json   the raw v1.1 QA and measurement run behind every number in this README
qa/cobble_catfish_v1_report.json   the accepted v1 run (getup 0.45 s, no dizzy), the "before" column
tools/qa.html, tools/qa.js      the acceptance suite
tools/game_merge.js             loads the game's mergeRig unchanged (injects THREE and K.QUAL)
tools/game/04b_rig_merge.js     the game's own file, as supplied (not part of the delivery)
tools/shoot.mjs                 headless runner (Chromium + SwiftShader); fails on any console error or warning
tools/qa_table.py               turns a shoot.mjs report into the tables below
tools/tile.py                   tiles PNGs for the HD-vs-LOD previews (needs Pillow)
tools/previews_cobble_catfish.json  the exact jobs for this delivery
tools/previews_pier_gulls.json, tools/previews_harbor_rats.json, tools/previews_masked_bandits.json   the other gangs' jobs
README.md, LICENSES.md
```

## How to view and re-run

```sh
python3 -m http.server 8000
# viewer:  http://localhost:8000/viewer.html?show=cobble_catfish              (lineup; add &merge=1 for the merged rigs)
#          ...?show=cobble_catfish.bruiser&strip=knockdown&merge=1            (60 fps hurt > down > getup > idle)
#          ...?show=cobble_catfish.armed&strip=attack&merge=1                 (60 fps windup > attack > chase > idle)
#          ...?show=cobble_catfish.bruiser&strip=dizzy&merge=1                (60 fps hurt > dizzy 3 s > chase; gold ring = stars sprite)
# QA:      http://localhost:8000/tools/qa.html?gang=cobble_catfish            (results in window.__qa)
# headless (npm i playwright-core three@0.160.0, on NODE_PATH):
REPORT=qa/cobble_catfish_report.json node tools/shoot.mjs --batch tools/previews_cobble_catfish.json
python3 tools/qa_table.py qa/cobble_catfish_report.json qa/cobble_catfish_v1_report.json
```

## The gang

Every member is an anthropomorphic channel catfish. Each one has:
- a **slate (`#5f6688`) fisherman's sweater with teal (`#1fd3c6`) suspenders**
- **teal knee-high rubber boots**, which with the suspenders are the gang read at 8 m
- a wide, flat, spotted head with a pale belly underneath
- a wide frowning mouth and small eyes under an ink brow
- two long barbels splayed from the mouth corners, plus two short chin barbels
- a dorsal fin standing up between the shoulder blades
- pectoral-fin mitts for hands
- a tail fin

| member | silhouette hook | notes |
|---|---|---|
| `grunt_a` | slate newsboy cap, peak pulled low | olive-grey skin, brown work trousers |
| `grunt_b` | teal watch cap with a slate cuff (painted) | darker skin, green-grey trousers |
| `armed` | teal headband (painted on the head); **cobblestone in a teal net bag on a rope** | weapon in `J.swR = K.grp(J.haR, 0, -0.04, 0)` along +Y |
| `bruiser` | slate harbour captain's cap (teal band, ink peak), sleeveless vest, bare spotted arms | a flathead: yellow-brown, head ×1.12 wide and sitting 8 cm higher (v1.1), ×1.28 width / ×1.2 depth; `big: true` (game ×1.2, windup 0.7 s) |

## Rig, materials, integration

- **Skeleton:** `K.skeleton()` with `CF_D`, which has the same keys as `K.THUG_D` (hip 0.9, neck 0.62). All 18 joints are unchanged.
- **Extras:** there is one extra, `J.tail`, a plain `THREE.Group` directly under `J.hips`, low on the hips and tipped up. The weapon is in the standard `J.swR`.
  - The tail clears the ground in the real `down` **without** `animateGang`.
- **`animateGang` is optional.** It only sweeps `J.tail` from side to side, and holds still in `'down'`.
  - Expected state mapping if you call it: down/dying → `'down'`, getup → `'idle'`, chase → `'run'`, windup → `'attack'`, dizzy → `'hurt'`.
- **Materials:** one `K.toonMat()` per rig, plus **one** canvas-mapped `K.toonMat({ map })` spotted-skin sub-material (head, mitts, bruiser arms) that shares `userData.flash` and `flashC`.
  - All hulls are `K.OUT_CHAR`.
  - LOD 1 uses no map.
- **Texture cache:** keyed on `K.QUAL || K.THREE || K`. A failed draw returns `null` and is never cached.
- **Painted details (`cfPaint`, face bounding-box midpoint):** these are recoloured faces on existing parts, not extra meshes:
  - the suspenders, painted onto whole longitude columns of the sweater, so they run clean and vertical
  - the head's pale belly and the armed member's teal headband
  - the beanie's slate cuff and the captain's cap band
  - the net on the armed member's cobblestone
  - on the LOD: the hats and the skin-coloured mitt ends
- **Shadow and outline rules are enforced in code** by `cfPart`:
  - `outline:false` implies `shadow:false`.
  - Any part under 4 cm in two dimensions gets neither an outline nor a shadow.
  - The HD tail fin is a flattened ellipsoid, not a box. On the bruiser, a box fin's mitred hull corners drew 31–35 px of stray ink on the sweater.
- **mergeRig():** verified with the game's own function (table below).
- **Standalone ES module:** no imports and no reliance on concatenation. Helper names are `cf`-prefixed anyway.
- **No LOD swap in the game today.** `opts.lod === 1` builds TASK_C's far variant.

## Measured numbers

The measurements are the same as in the Pier Gulls README ("How things are measured"), with the game's real timings (thug getup 0.5 s), dizzy and the real `mergeRig`.

QA run: 44 jobs, 0 console errors/warnings. All acceptance checks: PASS.

| member | LOD | parts | tris | hull tris | hulls | materials | shadow casters | draw calls (meshes + hulls) | height | feet min y (idle) |
|---|---|---|---|---|---|---|---|---|---|---|
| grunt_a | HD | 32 | 10,128 | 9,276 | 25 | 3 | 21 | 57 | 1.884 m | 0.020 m |
| grunt_a | 1 | 12 | 1,880 | 1,880 | 12 | 2 | 12 | 24 | 1.815 m | 0.021 m |
| grunt_b | HD | 31 | 10,116 | 9,264 | 24 | 3 | 20 | 55 | 1.943 m | 0.020 m |
| grunt_b | 1 | 12 | 1,880 | 1,880 | 12 | 2 | 12 | 24 | 1.815 m | 0.021 m |
| armed | HD | 32 | 10,524 | 9,672 | 25 | 3 | 21 | 57 | 1.816 m | 0.020 m |
| armed | 1 | 12 | 1,924 | 1,924 | 12 | 2 | 12 | 24 | 1.815 m | 0.021 m |
| bruiser | HD | 32 | 9,788 | 8,936 | 25 | 3 | 23 | 57 | 2.356 m | 0.024 m |
| bruiser | 1 | 12 | 1,924 | 1,924 | 12 | 2 | 12 | 24 | 2.358 m | 0.022 m |

- Whole frame, all four members + ground, `show=cobble_catfish&lod=0&t=0.5`: **312 draw calls, 109,214 triangles** (incl. shadow pass).
- Whole frame, all four members + ground, `show=cobble_catfish&lod=1&t=0.5`: **145 draw calls, 22,826 triangles** (incl. shadow pass).
- Whole frame, all four members + ground, `show=cobble_catfish&lod=0&t=0.5&merge=1`: **21 draw calls, 118,262 triangles** (incl. shadow pass).

**Ground clearance** (lowest non-hull vertex, worst frame; floor is −3.0 cm; feet and weapon exempt only in `down`; A = with animateGang):

| member | knockdown 60 fps | knockdown A | attack 60 fps | attack A | run 60 fps | run A | dizzy 60 fps | dizzy A | pose sweeps | LOD 1 (knockdown / attack / run / dizzy) |
|---|---|---|---|---|---|---|---|---|---|---|
| grunt_a | −0.8 cm (ftR/boot, idle) | −0.8 cm (ftR/boot, idle) | 0.6 cm (ftR/boot, idle) | 0.6 cm (ftR/boot, idle) | 2.1 cm (ftR/boot, idle) | 2.1 cm (ftR/boot, idle) | 0.1 cm (ftR/boot, idle) | 0.1 cm (ftR/boot, idle) | −0.9 cm (ftR/boot, idle) | −0.6 cm / 0.7 cm / 2.2 cm / 0.2 cm |
| grunt_b | −0.8 cm (ftR/boot, idle) | −0.8 cm (ftR/boot, idle) | 0.6 cm (ftR/boot, idle) | 0.6 cm (ftR/boot, idle) | 2.1 cm (ftR/boot, idle) | 2.1 cm (ftR/boot, idle) | 0.1 cm (ftR/boot, idle) | 0.1 cm (ftR/boot, idle) | −0.9 cm (ftR/boot, idle) | −0.6 cm / 0.7 cm / 2.2 cm / 0.2 cm |
| armed | −0.8 cm (ftR/boot, idle) | −0.8 cm (ftR/boot, idle) | 0.6 cm (ftR/boot, idle) | 0.6 cm (ftR/boot, idle) | 2.1 cm (ftR/boot, idle) | 2.1 cm (ftR/boot, idle) | 0.1 cm (ftR/boot, idle) | 0.1 cm (ftR/boot, idle) | −0.9 cm (ftR/boot, idle) | −0.6 cm / 0.7 cm / 2.2 cm / 0.2 cm |
| bruiser | −0.9 cm (ftR/boot, idle) | −0.9 cm (ftR/boot, idle) | −0.9 cm (ftR/boot, idle) | −0.9 cm (ftR/boot, idle) | 2.5 cm (ftR/boot, idle) | 2.5 cm (ftR/boot, idle) | 0.1 cm (ftR/boot, idle) | 0.1 cm (ftR/boot, idle) | −1.1 cm (ftR/boot, idle) | −1.1 cm / −1.1 cm / 2.3 cm / −0.1 cm |

**Dizzy** (hurt → `THUG_POSES.dizzy` 3 s at rate 10 → chase; stars sprite at 2.2 × scale + 0.15 m above the root):

| member | stars height | clearance below stars HD (highest part) | with animateGang | LOD 1 | worst shoulder gap in dizzy L / R |
|---|---|---|---|---|---|
| grunt_a | 2.35 m | 45.8 cm (head/cap) | 45.8 cm | 52.2 cm (head/head) | 0.0 cm / 0.0 cm |
| grunt_b | 2.35 m | 39.4 cm (head/beanie) | 39.4 cm | 52.2 cm (head/head) | 0.0 cm / 0.0 cm |
| armed | 2.35 m | 52.2 cm (head/head) | 52.2 cm | 52.2 cm (head/head) | 0.0 cm / 0.0 cm |
| bruiser | 2.79 m | 40.3 cm (head/cap) | 40.3 cm | 40.3 cm (head/cap) | 0.0 cm / 0.0 cm |

**Down pose and shoulders** (`down(1, true)` snapped; knock-down end = last frame of the 60 fps `down` phase):

| member | shoulder gap down L / R | shoulder gap windup(1) L / R | windup(0.6) L / R | tail min y, down(1,true) | tail min y, knock-down end | head min y, down(1,true) | min y excl. feet+weapon, down(1,true) |
|---|---|---|---|---|---|---|---|
| grunt_a | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 3.9 cm | 3.9 cm | 23.4 cm | 3.9 cm |
| grunt_b | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 3.9 cm | 3.9 cm | 23.4 cm | 3.9 cm |
| armed | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 3.9 cm | 3.9 cm | 23.4 cm | 3.9 cm |
| bruiser | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 1.6 cm | 1.6 cm | 32.5 cm | 1.3 cm |

**Outlines, shadows, LOD silhouette** (buried = share of a part's surface inside other outlined parts; stray ink rendered at 6 m, 256², 4 views, in idle and both dizzy sway extremes):

| member | worst buried share (part) | worst stray ink px (part, view) | shadow-rule violations HD / LOD | LOD IoU front / 3/4 / side |
|---|---|---|---|---|
| grunt_a | 44.5 % (shR/upper) | 4 (head/chinbarbel, dizzyL/side) | 0 / 0 | 0.875 / 0.858 / 0.865 |
| grunt_b | 44.5 % (shR/upper) | 3 (shR/upper, idle/back) | 0 / 0 | 0.861 / 0.838 / 0.840 |
| armed | 46.2 % (shR/upper) | 3 (head/chinbarbel, dizzyL/side) | 0 / 0 | 0.909 / 0.876 / 0.878 |
| bruiser | 52.8 % (shR/upper) | 9 (shL/upper, dizzyR/three) | 0 / 0 | 0.916 / 0.896 / 0.892 |

**The game's real `mergeRig()`** (`tools/game/04b_rig_merge.js`, run on the HD rig):

| member | meshes + hulls before | merged meshes (solid + outline) | bones | draw calls + shadow calls | max vertex Δ merged vs parts (7 poses) | flash: unflashed px of rig px (flash 0.85) | animateGang moves merged tail | render diff px: interior / edge (of rig px) | farthest vertex from culling sphere centre, all sequences (pass: r = 2.6; info: ZIP kit r = 1.9) |
|---|---|---|---|---|---|---|---|---|---|
| grunt_a | 32 + 25 | 3 (2 + 1) | 16 | 3 + 2 | 0.000 mm | 0 of 7879 | 1.0 cm (247 verts) | 0 / 26 (of 9711) | 2.16 m (outside 1.9) |
| grunt_b | 31 + 24 | 3 (2 + 1) | 16 | 3 + 2 | 0.000 mm | 0 of 8178 | 1.0 cm (247 verts) | 0 / 31 (of 9965) | 2.16 m (outside 1.9) |
| armed | 32 + 25 | 3 (2 + 1) | 17 | 3 + 2 | 0.000 mm | 0 of 7903 | 1.0 cm (247 verts) | 1 / 33 (of 9752) | 2.38 m (outside 1.9) |
| bruiser | 32 + 25 | 3 (2 + 1) | 16 | 3 + 2 | 0.000 mm | 0 of 13828 | 1.3 cm (247 verts) | 0 / 26 (of 16776) | 2.18 m (outside 1.9) |

**Idle reach and determinism** (reach = farthest non-hull vertex from the root's vertical axis over idle t = 0 .. 2 s at 15 fps, weapon excepted, minus META.radius; hash = every part's world vertices, colours and joint transforms after `idle(0)`):

| member | META.radius | farthest reach (part) | beyond radius (limit 0.35 m) | hash seed 7 (twice) | HD and LOD same seed → same hash | seed 8 hash (differs) |
|---|---|---|---|---|---|---|
| grunt_a | 0.42 m | 0.631 m (haL/mitt, t = 0.00 s) | 0.211 m | `1ebae121` | yes | `5c53ce0d` (yes) |
| grunt_b | 0.42 m | 0.631 m (haL/mitt, t = 0.00 s) | 0.211 m | `d70fd655` | yes | `a3430261` (yes) |
| armed | 0.42 m | 0.644 m (haR/mitt, t = 0.00 s) | 0.224 m | `2f199c89` | yes | `6b4f7a15` (yes) |
| bruiser | 0.55 m | 0.778 m (haL/mitt, t = 0.00 s) | 0.228 m | `d99c0b64` | yes | `543b8f60` (yes) |

**Before → after** (`qa/cobble_catfish_v1_report.json` → this run; both measured by this QA, real timings and real mergeRig):

| member | HD parts | HD tris | LOD parts | LOD tris | worst buried | worst stray px | HD ground worst | LOD ground worst | LOD IoU min |
|---|---|---|---|---|---|---|---|---|---|
| grunt_a | 32 → 32 | 10,128 → 10,128 | 12 → 12 | 1,880 → 1,880 | 44.5 % → 44.5 % | 2 → 4 | −0.8 cm → −0.8 cm | −0.7 cm → −0.6 cm | 0.858 → 0.858 |
| grunt_b | 31 → 31 | 10,116 → 10,116 | 12 → 12 | 1,880 → 1,880 | 44.5 % → 44.5 % | 3 → 3 | −0.8 cm → −0.8 cm | −0.7 cm → −0.6 cm | 0.838 → 0.838 |
| armed | 32 → 32 | 10,524 → 10,524 | 12 → 12 | 1,924 → 1,924 | 46.2 % → 46.2 % | 2 → 3 | −0.8 cm → −0.8 cm | −0.7 cm → −0.6 cm | 0.876 → 0.876 |
| bruiser | 32 → 32 | 9,788 → 9,788 | 12 → 12 | 1,924 → 1,924 | 52.8 % → 52.8 % | 7 → 9 | −1.0 cm → −0.9 cm | −1.2 cm → −1.1 cm | 0.899 → 0.892 |

Per-member pass flags (caps, margins, ground, shoulders, stray hulls, shadows, flash, hulls, merge, height, feet): grunt_a: PASS, grunt_b: PASS, armed: PASS, bruiser: PASS

## Game-side finding (resolved in-house)

`mergeRig()`'s culling sphere radius is now 2.6 (centre (0, 0.95, 0)), and QA uses it. Farthest vertex from the centre over all sequences: grunt_a 2.16 m, grunt_b 2.16 m, armed 2.38 m, bruiser 2.18 m.

## Kit note

`toadcity_kit.js` is the rebuild from the brief's appendix.
- **Real game code:** `HERO_POSES.down`, `THUG_POSES.down` and `THUG_POSES.dizzy`.
- **Verbatim from the appendix:** everything this module uses from `K`.
- **Still stand-ins:** `HERO_POSES.idle/run`, `buildThug`, the light presets and the prop collector.

## Re-run at the game's down timings

The QA was re-run with the knock-down at `down(st, grounded)` (`st` in seconds) damped at rate 13, then getup 0.5 s at rate 14 (`06_game.js`). The earlier run used the fraction form at rate 14.

I compared every distance in the old and new reports (ground clearances, down-pose clearances, shoulder gaps, stars clearance, culling reach, stray ink, buried share) value by value: **the largest change is 0.0 cm, so no number moved and no version was bumped.** The new report adds only checks that did not exist then: windup(0.6) gaps, idle reach, the determinism hash, and ear clearance in `down`. They are in the tables above, and all pass.

## Known issues (with sizes)

- **Platform:** tested only in headless Chromium with SwiftShader, with 0 console errors or warnings across all jobs. It has not been run on iOS Safari or an iPhone.
- **Margins:** HD is 31–32 parts and 9,788–10,524 tris. LOD is 12 parts and 1,880–1,924 tris.
- **Lowest vertex (any sequence):** HD -0.9 cm, LOD -1.1 cm. The floor is −3 cm, and the LOD margin target is −2 cm.
- **Buried parts:** the most buried part is shR/upper on bruiser at 52.8 % (limit 55 %).
- **Stray ink:** the worst is 9 px (shL/upper on bruiser) against the 12 px limit, over idle and both dizzy extremes. The 5 px, 12 px and 6 m thresholds are mine, not the game's.
- **Dizzy stars:** the closest approach is 39.4 cm below the sprite (head/beanie on grunt_b).
- **LOD silhouette:** IoU against HD is 0.838–0.916.
- **Merged vs parts render:** 0–1 interior pixels differ out of 9,711–16,776 rig pixels. Another 26–33 pixels differ only along outline edges.
- **Suspender look:** the suspenders are whole 20° sphere columns, so on the sweater they read as broad teal stripes rather than thin straps.
- **Not modelled:** the attack's forward lunge, by agreement (the game handles root motion).
