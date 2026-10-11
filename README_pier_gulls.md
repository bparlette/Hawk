# Toad City Baltimore: Task C, gang 2 of 5: Pier Gulls (v1.1.1)

This gang is built to TASK_C plus the gang-2+ rules:
- the real down pose
- nothing through the ground
- shadow rules
- the texture-cache key
- the gang accent on the LOD
- headroom
- measured-only numbers
- integration facts

**v1.1** closes the open gaps from v1 using the game's own code:
- the real `mergeRig()`
- the real state timings
- wider safety margins
- dark wingtip hands on the far LOD

`tools/qa.html` and `tools/shoot.mjs` produce every number below, and `tools/qa_table.py` pastes them in unedited. The raw run is `qa/pier_gulls_report.json`.

| id | Gang | Animal | District | Accent |
|---|---|---|---|---|
| `pier_gulls` | Pier Gulls | herring gulls | Piers: National Aquarium, Power Plant, Four Seasons | white + blue `#2f5bd3` |

## v1.1.1: QA re-run after gang 3 (no change to `src/gang_pier_gulls.js`)

v1.1 was accepted. v1.1.1 re-checks it against three corrections from the in-house team; the module is byte-identical to v1.1.
- **Dizzy:** the game's new `THUG_POSES.dizzy` is in the kit, copied exactly. QA runs hurt → dizzy (3 s at rate 10) → chase at 60 fps, with and without `animateGang`, on HD and LOD. It checks:
  - ground clearance
  - shoulder gaps every 10th frame
  - clearance below the stars sprite (2.2 × scale + 0.15 m above the root) every frame
  - stray ink in idle and at both extremes of the dizzy sway
- **Thug getup** is 0.5 s at rate 14 (0.45 s was the hero's). Re-running the knock-down at 0.5 s changes nothing material:

| member | knock-down worst, getup 0.45 s → 0.5 s | tail / head min y in down, 0.45 s → 0.5 s | LOD knock-down worst, 0.45 s → 0.5 s |
|---|---|---|---|
| grunt_a | -1.2 cm → -1.1 cm | 1.4 cm / 21.7 cm → 1.4 cm / 21.7 cm | -1.3 cm → -1.3 cm |
| grunt_b | -1.2 cm → -1.1 cm | 1.4 cm / 18.2 cm → 1.4 cm / 18.2 cm | -1.3 cm → -1.3 cm |
| armed | -1.2 cm → -1.1 cm | 1.4 cm / 23.7 cm → 1.4 cm / 23.7 cm | -1.3 cm → -1.3 cm |
| bruiser | -1.5 cm → -1.4 cm | 1.7 cm / 28.4 cm → 1.7 cm / 28.4 cm | -1.9 cm → -1.8 cm |

- **Culling sphere:** the in-house team confirmed and fixed it (radius 2.6, centre unchanged). QA now uses 2.6 and makes it a pass flag. The worst Pier Gulls reach is 2.48 m (armed, in `down`).
- **Result:** every check passes, including all the new ones (tables below). The tightest new margin is the bruiser's left upper arm: **12 px** of stray ink in the dizzy-left side view. The limit fails only *above* 12 px, so it passes, but with no headroom. Say if you want it widened before gang 5.

## What changed in v1.1

| change | v1.0 | v1.1 |
|---|---|---|
| QA merge check | an emulated per-group merge | the game's **real** `mergeRig()` (`tools/game/04b_rig_merge.js`, byte-identical, loaded through `tools/game_merge.js`) |
| QA and filmstrip timings | my assumptions | **the game's**: idle/chase rate 14; windup 0.5 s (bruiser 0.7 s) at rate 12; attack pose over 0.3 s at rate 26, chase from 0.55 s; hurt pose over 0.32 s at rate 24, next state at 0.34 s; down pose rate 14; getup at rate 14 (0.45 s in v1.1, corrected to the thug's 0.5 s in v1.1.1) |
| pupils, gonys spot, wingtip mirrors, fish eye | spheres (396 tris each) | boxes (12 tris each), like the brief's gull example |
| white chest band (HD and LOD) | an open-tube part | painted onto the jacket's rings (`pgPaint`): one fewer part, and no hull ticks along its edge |
| fish stripe | a separate plate | painted onto the fish |
| bruiser beanie cuff | a separate open tube (beanie 59.8 % buried) | painted onto the beanie, and the beanie sits 3 cm higher |
| bruiser arms | shoulder ball 0.128 m; upper arm capsule 0.105 × 0.23 m; forearm 0.09 × 0.17 m | shoulder ball 0.12 m; upper arm 0.105 × 0.26 m; forearm 0.088 × 0.15 m, centred 2.5 cm lower (upper arm now 52.7 % buried) |
| LOD 1 | 14 parts, grey forearm ends | **12 parts**, **dark wingtip colour on the hands** (painted forearm ends), hats painted on (except grunt_a's bucket hat), soles 1 cm higher, box shins |
| QA margins (new pass flags) | n/a | HD ≤ 35 parts and ≤ 11,000 tris; LOD ≤ 12 parts and ≤ 2,000 tris; every part < 55 % buried; LOD ≥ −2 cm in every sequence |

## What's in this zip

```
src/gang_pier_gulls.js          the delivery: GANG, META, buildPierGull(K, member, opts), animateGang(J, t, state) (optional)
src/gang_harbor_rats.js         gang 1, unchanged (left as-is at your request); present because viewer.html registers it
src/gang_cobble_catfish.js      gang 3 v1.1 (viewer.html registers it)
src/gang_masked_bandits.js      gang 4 v1 (viewer.html registers it)
toadcity_kit.js                 the kit, rebuilt from the brief's appendix, with the REAL HERO_POSES.down, THUG_POSES.down and THUG_POSES.dizzy
example_gull_thug.js            the brief's interface example (viewer comparison)
viewer.html                     test bench (see "How to view"); &merge=1 runs the game's mergeRig
previews/pier_gulls_*.png       36 images: for each member, day and night turnarounds, a 7-pose sheet, 60 fps knock-down
                                attack and dizzy filmstrips (real timings, real mergeRig; the gold ring is the stars sprite height)
                                and an HD-vs-LOD turnaround; plus lineups
                                (day, night, merged), LOD lineup, hit-flash (parts and merged) and phone day/night
qa/pier_gulls_report.json       the raw v1.1.1 QA and measurement run behind every number in this README
qa/pier_gulls_v1.1_report.json  the accepted v1.1 run (getup 0.45 s, no dizzy), for the getup comparison
qa/pier_gulls_v1.0_rerun_with_v1.1_qa.json   v1.0's geometry measured by the v1.1 QA (the "before" column)
tools/qa.html, tools/qa.js      the acceptance suite
tools/game_merge.js             loads the game's mergeRig unchanged (injects THREE and K.QUAL)
tools/game/04b_rig_merge.js     the game's own file, as supplied (not part of the delivery)
tools/shoot.mjs                 headless runner (Chromium + SwiftShader); fails on any console error or warning
tools/qa_table.py               turns a shoot.mjs report into the tables below
tools/tile.py                   tiles PNGs for the HD-vs-LOD previews (needs Pillow)
tools/previews_pier_gulls.json  the exact jobs for this delivery (previews, frame measurements and QA)
tools/previews_harbor_rats.json, tools/previews_cobble_catfish.json, tools/previews_masked_bandits.json   the other gangs' jobs
README.md, LICENSES.md
```

## How to view and re-run

```sh
python3 -m http.server 8000
# viewer:  http://localhost:8000/viewer.html?show=pier_gulls                  (lineup; add &merge=1 for the merged rigs)
#          ...?show=pier_gulls.bruiser&strip=knockdown&merge=1                (60 fps hurt > down > getup > idle)
#          ...?show=pier_gulls.armed&strip=attack&merge=1                     (60 fps windup > attack > chase > idle)
#          ...?show=pier_gulls.bruiser&strip=dizzy&merge=1                    (60 fps hurt > dizzy 3 s > chase; gold ring = stars sprite)
# QA:      http://localhost:8000/tools/qa.html?gang=pier_gulls                (results in window.__qa)
#          ...?gang=pier_gulls&debug=bruiser,torso/jacket,side                (paints that part's stray ink red)
#          ...?gang=pier_gulls&debugmerge=grunt_a                             (parts vs merged render, and their diff)
# headless (npm i playwright-core three@0.160.0, on NODE_PATH):
REPORT=qa/pier_gulls_report.json node tools/shoot.mjs --batch tools/previews_pier_gulls.json
python3 tools/qa_table.py qa/pier_gulls_report.json qa/pier_gulls_v1.0_rerun_with_v1.1_qa.json
```

## The gang

Every member is an anthropomorphic herring gull. Each one has:
- a **blue (`#2f5bd3`) top with a white chest band**, which is the gang read at 8 m
- a hooked yellow bill with the red gonys spot
- pale glaring eyes under an ink brow
- wing-arms ending in dark wingtip fists with a white "mirror" mark
- pink legs and webbed feet
- a short white tail
- shorts

| member | silhouette hook | notes |
|---|---|---|
| `grunt_a` | blue bucket hat | khaki shorts, grey mantle |
| `grunt_b` | blue cap worn backwards | first-winter juvenile: brown mottled plumage, dark bill, dark eye; denim shorts |
| `armed` | blue sweatband; **frozen rockfish** swung by the tail | weapon in `J.swR = K.grp(J.haR, 0, -0.04, 0)` along +Y |
| `bruiser` | blue beanie with white cuff, gold chain, sleeveless vest | great black-backed gull (dark mantle), ×1.28 width / ×1.2 depth; `big: true` (game ×1.2, windup 0.7 s) |

## Rig, materials, integration

- **Skeleton:** `K.skeleton()` with `PG_D`, which has the same keys as `K.THUG_D` (hip 0.9). All 18 joints are unchanged.
- **Extras:** there is one extra, `J.tail`, a plain `THREE.Group` directly under `J.hips`. The weapon is in the standard `J.swR`.
  - The tail tips **up** at rest, so it clears the ground in the real `down` **without** `animateGang`.
- **`animateGang` is optional.** It only flicks `J.tail`.
  - Expected state mapping if you call it: down/dying → `'down'`, getup → `'idle'`, chase → `'run'`, windup → `'attack'`, dizzy → `'hurt'`.
- **Materials:** one `K.toonMat()` per rig, plus **one** canvas-mapped `K.toonMat({ map })` feather sub-material that shares `userData.flash` and `flashC`.
  - All hulls are `K.OUT_CHAR`.
  - LOD 1 uses no map.
- **Texture cache:** keyed on `K.QUAL || K.THREE || K`. A missing `document` or 2D context returns `null` and is never cached.
- **Painted details (`pgPaint`):** these parts are built non-indexed (`toNonIndexed()`), and faces are recoloured after `K.part()`.
  - Each face is tested at the midpoint of its bounding box, so both triangles of a sphere quad agree and bands follow the rings cleanly.
  - `mergeRig` copies vertex colours, so the paint survives the merge (see the `merged` previews).
- **Shadow and outline rules are enforced in code** by `pgPart`:
  - `outline:false` implies `shadow:false`.
  - Any part under 4 cm in two dimensions gets neither an outline nor a shadow.
- **mergeRig():** verified with the game's own function (table below). The rig merges into 3 skinned meshes (toon, feather, outline) with 16–17 bones.
  - The merged vertices match the parts to 0.000 mm in 7 poses.
  - With hit-flash on, 0 rig pixels stay unflashed (feather sub-material included).
  - `animateGang` still moves the 24 tail vertices on the merged rig.
- **Standalone ES module:** no imports and no reliance on concatenation.
- **No LOD swap in the game today.** `opts.lod === 1` builds TASK_C's far variant.

## Measured numbers

How things are measured (`tools/qa.js`):
- **Parts** are non-hull meshes. **Tris** exclude hulls.
- **Height and feet** are measured in idle at t = 0, with `META.scale` applied.
- **Sequences** run at 60 fps with the game's timings (see "What changed").
  - knock-down = idle 0.5 s → hurt 0.34 s → hop + down 1.25 s → getup 0.5 s → idle 0.6 s
  - dizzy = idle 0.4 s → hurt 0.34 s → dizzy 3 s (rate 10) → chase 0.6 s → idle 0.5 s
  - attack = idle 0.4 s → windup → attack 0.55 s → chase 0.6 s → idle 0.5 s
  - run = idle 0.3 s → chase 1.2 s → idle 0.5 s
- **Shoulder gap** is the signed distance from the parts on `shL`/`shR` to the parts on `torso`; 0 means touching or overlapping.
- **Stray ink** is render-based. It counts a part's ink that lies on top of other parts and more than 5 px from that part's own visible pixels, at 6 m, 256², from four views. A part fails above 12 px.

QA run: 44 jobs, 0 console errors/warnings. All acceptance checks: PASS.

| member | LOD | parts | tris | hull tris | hulls | materials | shadow casters | draw calls (meshes + hulls) | height | feet min y (idle) |
|---|---|---|---|---|---|---|---|---|---|---|
| grunt_a | HD | 32 | 8,812 | 7,936 | 23 | 3 | 23 | 55 | 1.901 m | 0.017 m |
| grunt_a | 1 | 12 | 1,968 | 1,968 | 12 | 2 | 12 | 24 | 1.884 m | 0.015 m |
| grunt_b | HD | 32 | 9,108 | 8,232 | 23 | 3 | 23 | 55 | 1.884 m | 0.017 m |
| grunt_b | 1 | 12 | 1,924 | 1,924 | 12 | 2 | 12 | 24 | 1.859 m | 0.015 m |
| armed | HD | 34 | 9,312 | 8,424 | 24 | 3 | 24 | 58 | 1.858 m | 0.017 m |
| armed | 1 | 12 | 1,968 | 1,968 | 12 | 2 | 12 | 24 | 1.859 m | 0.015 m |
| bruiser | HD | 31 | 9,096 | 8,220 | 22 | 3 | 22 | 53 | 2.395 m | 0.019 m |
| bruiser | 1 | 12 | 1,924 | 1,924 | 12 | 2 | 12 | 24 | 2.234 m | 0.015 m |

- Whole frame, all four members + ground, `show=pier_gulls&lod=0&t=0.5`: **314 draw calls, 101,954 triangles** (incl. shadow pass).
- Whole frame, all four members + ground, `show=pier_gulls&lod=1&t=0.5`: **145 draw calls, 23,354 triangles** (incl. shadow pass).
- Whole frame, all four members + ground, `show=pier_gulls&lod=0&t=0.5&merge=1`: **21 draw calls, 105,470 triangles** (incl. shadow pass).

**Ground clearance** (lowest non-hull vertex, worst frame; floor is −3.0 cm; feet and weapon exempt only in `down`; A = with animateGang):

| member | knockdown 60 fps | knockdown A | attack 60 fps | attack A | run 60 fps | run A | dizzy 60 fps | dizzy A | pose sweeps | LOD 1 (knockdown / attack / run / dizzy) |
|---|---|---|---|---|---|---|---|---|---|---|
| grunt_a | -1.1 cm (ftR/foot, idle) | -1.1 cm (ftR/foot, idle) | 0.2 cm (ftR/foot, idle) | 0.2 cm (ftR/foot, idle) | 1.1 cm (ftR/foot, idle) | 1.1 cm (ftR/foot, idle) | -0.4 cm (ftR/foot, idle) | -0.4 cm (ftR/foot, idle) | -1.3 cm (ftR/foot, idle) | -1.3 cm / 0.1 cm / 1.6 cm / -0.3 cm |
| grunt_b | -1.1 cm (ftR/foot, idle) | -1.1 cm (ftR/foot, idle) | 0.2 cm (ftR/foot, idle) | 0.2 cm (ftR/foot, idle) | 1.1 cm (ftR/foot, idle) | 1.1 cm (ftR/foot, idle) | -0.4 cm (ftR/foot, idle) | -0.4 cm (ftR/foot, idle) | -1.3 cm (ftR/foot, idle) | -1.3 cm / 0.1 cm / 1.6 cm / -0.3 cm |
| armed | -1.1 cm (ftR/foot, idle) | -1.1 cm (ftR/foot, idle) | 0.2 cm (ftR/foot, idle) | 0.2 cm (ftR/foot, idle) | 1.1 cm (ftR/foot, idle) | 1.1 cm (ftR/foot, idle) | -0.4 cm (ftR/foot, idle) | -0.4 cm (ftR/foot, idle) | -1.3 cm (ftR/foot, idle) | -1.3 cm / 0.1 cm / 1.6 cm / -0.3 cm |
| bruiser | -1.4 cm (knR/shin, idle) | -1.4 cm (knR/shin, idle) | -1.4 cm (knR/shin, idle) | -1.4 cm (knR/shin, idle) | 0.7 cm (ftR/foot, idle) | 0.7 cm (ftR/foot, idle) | -0.5 cm (ftR/foot, idle) | -0.5 cm (ftR/foot, idle) | -1.6 cm (knR/shin, idle) | -1.8 cm / -1.8 cm / 1.6 cm / -0.7 cm |

**Dizzy** (hurt → `THUG_POSES.dizzy` 3 s at rate 10 → chase; stars sprite at 2.2 × scale + 0.15 m above the root):

| member | stars height | clearance below stars HD (highest part) | with animateGang | LOD 1 | worst shoulder gap in dizzy L / R |
|---|---|---|---|---|---|
| grunt_a | 2.35 m | 43.4 cm (head/hat) | 43.4 cm | 45.0 cm (head/hat) | 0.0 cm / 0.0 cm |
| grunt_b | 2.35 m | 46.0 cm (head/cap) | 46.0 cm | 48.6 cm (head/head) | 0.0 cm / 0.0 cm |
| armed | 2.35 m | 48.6 cm (head/head) | 48.6 cm | 48.6 cm (head/head) | 0.0 cm / 0.0 cm |
| bruiser | 2.79 m | 38.8 cm (head/beanie) | 38.8 cm | 55.3 cm (head/head) | 0.0 cm / 0.0 cm |

**Down pose and shoulders** (`down(1, true)` snapped; knock-down end = last frame of the 60 fps `down` phase):

| member | shoulder gap down L / R | shoulder gap windup L / R | tail min y, down(1,true) | tail min y, knock-down end | head min y, down(1,true) | min y excl. feet+weapon, down(1,true) |
|---|---|---|---|---|---|---|
| grunt_a | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 1.4 cm | 1.4 cm | 21.7 cm | 1.4 cm |
| grunt_b | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 1.4 cm | 1.4 cm | 18.2 cm | 1.4 cm |
| armed | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 1.4 cm | 1.4 cm | 23.7 cm | 1.4 cm |
| bruiser | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 1.7 cm | 1.7 cm | 28.4 cm | 1.7 cm |

**Outlines, shadows, LOD silhouette** (buried = share of a part's surface inside other outlined parts; stray ink rendered at 6 m, 256², 4 views, in idle and both dizzy sway extremes):

| member | worst buried share (part) | worst stray ink px (part, view) | shadow-rule violations HD / LOD | LOD IoU front / 3/4 / side |
|---|---|---|---|---|
| grunt_a | 44.5 % (shR/upper) | 5 (head/hat, dizzyL/side) | 0 / 0 | 0.902 / 0.869 / 0.882 |
| grunt_b | 46.3 % (head/head) | 2 (shR/upper, idle/back) | 0 / 0 | 0.889 / 0.865 / 0.879 |
| armed | 46.4 % (shR/upper) | 2 (shL/upper, idle/back) | 0 / 0 | 0.901 / 0.870 / 0.879 |
| bruiser | 52.7 % (shR/upper) | 12 (shL/upper, dizzyL/side) | 0 / 0 | 0.863 / 0.835 / 0.858 |

**The game's real `mergeRig()`** (`tools/game/04b_rig_merge.js`, run on the HD rig):

| member | meshes + hulls before | merged meshes (solid + outline) | bones | draw calls + shadow calls | max vertex Δ merged vs parts (7 poses) | flash: unflashed px of rig px (flash 0.85) | animateGang moves merged tail | render diff px: interior / edge (of rig px) | farthest vertex from culling sphere centre, all sequences (r = 2.6) |
|---|---|---|---|---|---|---|---|---|---|
| grunt_a | 32 + 23 | 3 (2 + 1) | 16 | 3 + 2 | 0.000 mm | 0 of 7591 | 2.0 cm (24 verts) | 11 / 332 (of 9350) | 2.20 m |
| grunt_b | 32 + 23 | 3 (2 + 1) | 16 | 3 + 2 | 0.000 mm | 0 of 7488 | 2.0 cm (24 verts) | 3 / 316 (of 9092) | 2.20 m |
| armed | 34 + 24 | 3 (2 + 1) | 17 | 3 + 2 | 0.000 mm | 0 of 7974 | 2.0 cm (24 verts) | 9 / 351 (of 9787) | 2.48 m |
| bruiser | 31 + 22 | 3 (2 + 1) | 16 | 3 + 2 | 0.000 mm | 0 of 12909 | 2.6 cm (24 verts) | 34 / 560 (of 15250) | 2.22 m |

**Before → after** (`qa/pier_gulls_v1.0_rerun_with_v1.1_qa.json` → this run; both measured by this QA, real timings and real mergeRig):

| member | HD parts | HD tris | LOD parts | LOD tris | worst buried | worst stray px | HD ground worst | LOD ground worst | LOD IoU min |
|---|---|---|---|---|---|---|---|---|---|
| grunt_a | 33 → 32 | 10,760 → 8,812 | 14 → 12 | 1,392 → 1,968 | 44.5 % → 44.5 % | 4 → 5 | -1.2 cm → -1.1 cm | -2.1 cm → -1.3 cm | 0.893 → 0.869 |
| grunt_b | 33 → 32 | 11,056 → 9,108 | 14 → 12 | 1,732 → 1,924 | 46.3 % → 46.3 % | 2 → 2 | -1.2 cm → -1.1 cm | -2.1 cm → -1.3 cm | 0.909 → 0.865 |
| armed | 36 → 34 | 11,656 → 9,312 | 14 → 12 | 1,392 → 1,968 | 46.9 % → 46.4 % | 2 → 2 | -1.2 cm → -1.1 cm | -2.1 cm → -1.3 cm | 0.892 → 0.870 |
| bruiser | 33 → 31 | 11,072 → 9,096 | 14 → 12 | 1,732 → 1,924 | 59.8 % → 52.7 % | 6 → 12 | -1.5 cm → -1.4 cm | -2.7 cm → -1.8 cm | 0.924 → 0.835 |

Per-member pass flags (caps, margins, ground, shoulders, stray hulls, shadows, flash, hulls, merge, height, feet): grunt_a: PASS, grunt_b: PASS, armed: PASS, bruiser: PASS

## Game-side finding (resolved in-house)

`mergeRig()`'s fixed culling sphere (radius 1.9) was too small for a ~2 m thug lying in `down`. The in-house team confirmed it and raised the radius to 2.6; the centre is unchanged at (0, 0.95, 0). QA now checks every frame of every sequence against 2.6. The worst Pier Gulls reach is 2.48 m (armed, in `down`).

## Not modelled

- **The attack's forward lunge.** By agreement: the game handles root motion.

## Kit note

`toadcity_starter_kit.zip` was never supplied, so `toadcity_kit.js` is still the rebuild from the brief's appendix.
- **Real game code:** `HERO_POSES.down`, `THUG_POSES.down` and `THUG_POSES.dizzy`.
- **Verbatim from the appendix:** everything this module uses from `K`.
- **Still stand-ins:** `HERO_POSES.idle/run`, `buildThug`, the light presets and the prop collector.

## Known issues (with sizes)

- **Platform:** tested only in headless Chromium with SwiftShader, with 0 console errors or warnings across all jobs. It has not been run on iOS Safari or an iPhone.
- **Idle-bob foot dip:** the idle bob takes HD feet to −1.1 cm (bruiser −1.4 cm) and LOD 1 to −1.3 cm (bruiser −1.8 cm). The floor is −3 cm, and the LOD margin target is −2 cm.
- **LOD silhouette:** the painted hats make the LOD head smaller than the HD hat shapes, so silhouette IoU against HD is now 0.835–0.902 (v1.0: 0.892–0.934). The bruiser is lowest (0.835, 3/4 view), because its raised HD beanie is painted flat onto the LOD head.
- **Merged vs parts render:** 3–34 interior pixels differ out of 9,000–15,000 rig pixels. Another 316–560 pixels differ only along outline edges, where the skinned outline rasterises about 1 px differently.
- **Stray ink:** the worst is 7 px against the 12 px limit. The 5 px, 12 px and 6 m thresholds are mine, not the game's.
- **Box pupils and mirrors:** these are boxes now, as in the brief's example. Close up, the pupils read square.
- **Stray ink at the limit:** the bruiser's left upper arm shows 12 px in the dizzy-left side view, exactly at the 12 px limit (fails only above 12).
