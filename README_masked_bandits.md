# Toad City Baltimore: Task C, gang 4 of 5: Masked Bandits (v1)

This gang is built to TASK_C plus the gang-2+ rules and the v1.1 margins:
- the real down pose and timings (thug getup 0.5 s, dizzy)
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
- stars-sprite clearance in dizzy

`tools/qa.html` and `tools/shoot.mjs` produce every number below (same QA page as gangs 2 and 3), and `tools/qa_table.py` pastes them in unedited. The raw run is `qa/masked_bandits_report.json`.

| id | Gang | Animal | District | Accent |
|---|---|---|---|---|
| `masked_bandits` | Masked Bandits | raccoons | West side: Oriole Park, M&T Bank Stadium, Science Center | orange `#ff9f1c` + grey |

## What's in this zip

```
src/gang_masked_bandits.js      the delivery: GANG, META, buildRaccoon(K, member, opts), animateGang(J, t, state) (optional)
src/gang_cobble_catfish.js      gang 3 v1.1 (viewer.html registers it)
src/gang_pier_gulls.js          gang 2 v1.1 (viewer.html registers it)
src/gang_harbor_rats.js         gang 1, unchanged (viewer.html registers it)
toadcity_kit.js                 the kit, rebuilt from the brief's appendix, with the REAL HERO_POSES.down, THUG_POSES.down and THUG_POSES.dizzy
example_gull_thug.js            the brief's interface example (viewer comparison)
viewer.html                     test bench (see "How to view"); &merge=1 runs the game's mergeRig
previews/masked_bandits_*.png    36 images: for each member, day and night turnarounds, a 7-pose sheet, 60 fps knock-down
                                attack and dizzy filmstrips (real timings, real mergeRig; the gold ring is the stars sprite height)
                                and an HD-vs-LOD turnaround; plus lineups
                                (day, night, merged), LOD lineup, hit-flash (parts and merged) and phone day/night
qa/masked_bandits_report.json   the raw QA and measurement run behind every number in this README
tools/qa.html, tools/qa.js      the acceptance suite
tools/game_merge.js             loads the game's mergeRig unchanged (injects THREE and K.QUAL)
tools/game/04b_rig_merge.js     the game's own file, as supplied (not part of the delivery)
tools/shoot.mjs                 headless runner (Chromium + SwiftShader); fails on any console error or warning
tools/qa_table.py               turns a shoot.mjs report into the tables below
tools/tile.py                   tiles PNGs for the HD-vs-LOD previews (needs Pillow)
tools/previews_masked_bandits.json  the exact jobs for this delivery
tools/previews_cobble_catfish.json, tools/previews_pier_gulls.json, tools/previews_harbor_rats.json   the other gangs' jobs
README.md, LICENSES.md
```

## How to view and re-run

```sh
python3 -m http.server 8000
# viewer:  http://localhost:8000/viewer.html?show=masked_bandits              (lineup; add &merge=1 for the merged rigs)
#          ...?show=masked_bandits.bruiser&strip=knockdown&merge=1            (60 fps hurt > down > getup > idle)
#          ...?show=masked_bandits.armed&strip=attack&merge=1                 (60 fps windup > attack > chase > idle)
#          ...?show=masked_bandits.bruiser&strip=dizzy&merge=1                (60 fps hurt > dizzy 3 s > chase; gold ring = stars sprite)
# QA:      http://localhost:8000/tools/qa.html?gang=masked_bandits            (results in window.__qa)
# headless (npm i playwright-core three@0.160.0, on NODE_PATH):
REPORT=qa/masked_bandits_report.json node tools/shoot.mjs --batch tools/previews_masked_bandits.json
python3 tools/qa_table.py qa/masked_bandits_report.json
```

## The gang

Every member is an anthropomorphic raccoon. Each one has:
- a **grey hoodie with an orange (`#ff9f1c`) kangaroo pocket and orange cuffs**
- **orange sneakers with white soles**, which with the pocket are the gang read at 8 m
- grey fur with the raccoon's own black mask, white brows and cheeks, painted on the head
- a tapered white snout and a dark nose
- round ears with white rims
- dark paws
- a ringed tail hanging close behind the hips

**Brief's "no team marks" rule:** the orange always sits on grey clothing. There are no birds, letters, numbers or logos anywhere. The only black is the raccoon's natural mask and paws.

| member | silhouette hook | notes |
|---|---|---|
| `grunt_a` | orange watch cap with a grey cuff (painted); ears poke out above it | blue-grey jeans |
| `grunt_b` | big orange headphones on a grey band | darker fur, brown jeans |
| `armed` | **a traffic cone swung by its tip** (orange, white reflective band, square base) | weapon in `J.swR = K.grp(J.haR, 0, -0.04, 0)` along +Y |
| `bruiser` | orange do-rag (painted), sleeveless hoodie, bare furry arms | lighter fur, ×1.28 width / ×1.2 depth; `big: true` (game ×1.2, windup 0.7 s) |

## Rig, materials, integration

- **Skeleton:** `K.skeleton()` with `MB_D`, which has the same keys as `K.THUG_D` (hip 0.9). All 18 joints are unchanged.
- **Extras:** there is one extra, `J.tail`, a plain `THREE.Group` directly under `J.hips`. The weapon is in the standard `J.swR`.
  - **Why the tail hangs down:** a raccoon tail can't stand up behind the back. In the real `down` pose, anything more than about 23 cm behind the body goes through the ground.
  - So the tail hangs close behind the hips, angled out to the left. It clears the ground in `down` **without** `animateGang` (table below).
- **`animateGang` is optional.** It only sways `J.tail` sideways, and holds still in `'down'`.
  - Expected state mapping if you call it: down/dying → `'down'`, getup → `'idle'`, chase → `'run'`, windup → `'attack'`, dizzy → `'hurt'`.
- **Materials:** one `K.toonMat()` per rig, plus **one** canvas-mapped `K.toonMat({ map })` fur sub-material (head, ears, tail, bruiser arms) that shares `userData.flash` and `flashC`.
  - All hulls are `K.OUT_CHAR`.
  - LOD 1 uses no map.
- **Texture cache:** keyed on `K.QUAL || K.THREE || K`. A failed draw returns `null` and is never cached.
- **Painted details (`mbPaint`, face bounding-box midpoint):** these are recoloured faces on existing parts, not extra meshes:
  - the hoodie pocket and cuffs
  - the raccoon mask, brows and cheeks
  - the ear rims
  - the tail rings
  - the sneaker soles
  - the beanie cuff and the bruiser's do-rag
  - the cone's reflective band
- **Far LOD (`mbConcat`):** joins already-placed `K.G` primitives into one non-indexed part, which is then painted. That way the 11–12-part LOD keeps the HD colours: head with snout, ears and mask; sleeve with paw; jeans with sneaker; and a ringed tail.
  - The LOD sneaker is a cylinder lying across the foot. It pitches with the shin in getup without digging its toe in; a box toe dug 5.7–7.6 cm into the ground.
- **Shadow and outline rules are enforced in code** by `mbPart`:
  - `outline:false` implies `shadow:false`.
  - Any part under 4 cm in two dimensions gets neither an outline nor a shadow.
- **mergeRig():** verified with the game's own function (table below).
- **Standalone ES module:** no imports and no reliance on concatenation. Helper names are `mb`-prefixed anyway.
- **No LOD swap in the game today.** `opts.lod === 1` builds TASK_C's far variant.

**Fixes the QA drove during the build:**
- **Bruiser upper arm:** its capsule end sat 1.5 cm under the shoulder ball's skin, so its hull drew 18 px of stray ink in the dizzy-right sway. It's now 4 cm deep: 8 px.
- **LOD sneakers:** see the cylinder note above.
- **Bruiser tail:** flattened from 0.10 to 0.03 rad of back-pitch. Its clearance in `down` went from 0.1 cm to 2.8 cm.

## Measured numbers

The measurements are the same as in the Pier Gulls README ("How things are measured"), with the game's real timings (thug getup 0.5 s), dizzy and the real `mergeRig`.

QA run: 44 jobs, 0 console errors/warnings. All acceptance checks: PASS.

| member | LOD | parts | tris | hull tris | hulls | materials | shadow casters | draw calls (meshes + hulls) | height | feet min y (idle) |
|---|---|---|---|---|---|---|---|---|---|---|
| grunt_a | HD | 30 | 10,080 | 9,228 | 23 | 3 | 19 | 53 | 1.919 m | 0.020 m |
| grunt_a | 1 | 11 | 1,712 | 1,712 | 11 | 2 | 11 | 22 | 1.918 m | 0.014 m |
| grunt_b | HD | 32 | 9,988 | 9,136 | 25 | 3 | 19 | 57 | 1.874 m | 0.020 m |
| grunt_b | 1 | 11 | 1,712 | 1,712 | 11 | 2 | 11 | 22 | 1.873 m | 0.014 m |
| armed | HD | 31 | 9,752 | 8,900 | 24 | 3 | 20 | 55 | 1.874 m | 0.020 m |
| armed | 1 | 12 | 1,780 | 1,780 | 12 | 2 | 12 | 24 | 1.873 m | 0.014 m |
| bruiser | HD | 29 | 9,684 | 8,832 | 22 | 3 | 20 | 51 | 2.249 m | 0.024 m |
| bruiser | 1 | 11 | 1,712 | 1,712 | 11 | 2 | 11 | 22 | 2.249 m | 0.015 m |

- Whole frame, all four members + ground, `show=masked_bandits&lod=0&t=0.5`: **295 draw calls, 106,042 triangles** (incl. shadow pass).
- Whole frame, all four members + ground, `show=masked_bandits&lod=1&t=0.5`: **136 draw calls, 20,750 triangles** (incl. shadow pass).
- Whole frame, all four members + ground, `show=masked_bandits&lod=0&t=0.5&merge=1`: **21 draw calls, 115,106 triangles** (incl. shadow pass).

**Ground clearance** (lowest non-hull vertex, worst frame; floor is −3.0 cm; feet and weapon exempt only in `down`; A = with animateGang):

| member | knockdown 60 fps | knockdown A | attack 60 fps | attack A | run 60 fps | run A | dizzy 60 fps | dizzy A | pose sweeps | LOD 1 (knockdown / attack / run / dizzy) |
|---|---|---|---|---|---|---|---|---|---|---|
| grunt_a | −0.8 cm (ftR/sneaker, idle) | −0.8 cm (ftR/sneaker, idle) | 0.6 cm (ftR/sneaker, idle) | 0.6 cm (ftR/sneaker, idle) | 2.1 cm (ftR/sneaker, idle) | 2.1 cm (ftR/sneaker, idle) | 0.1 cm (ftR/sneaker, idle) | 0.1 cm (ftR/sneaker, idle) | −0.9 cm (ftR/sneaker, idle) | −1.4 cm / −0.1 cm / 1.4 cm / −0.5 cm |
| grunt_b | −0.8 cm (ftR/sneaker, idle) | −0.8 cm (ftR/sneaker, idle) | 0.6 cm (ftR/sneaker, idle) | 0.6 cm (ftR/sneaker, idle) | 2.1 cm (ftR/sneaker, idle) | 2.1 cm (ftR/sneaker, idle) | 0.1 cm (ftR/sneaker, idle) | 0.1 cm (ftR/sneaker, idle) | −0.9 cm (ftR/sneaker, idle) | −1.4 cm / −0.1 cm / 1.4 cm / −0.5 cm |
| armed | −0.8 cm (ftR/sneaker, idle) | −0.8 cm (ftR/sneaker, idle) | 0.6 cm (ftR/sneaker, idle) | 0.6 cm (ftR/sneaker, idle) | 2.1 cm (ftR/sneaker, idle) | 2.1 cm (ftR/sneaker, idle) | 0.1 cm (ftR/sneaker, idle) | 0.1 cm (ftR/sneaker, idle) | −0.9 cm (ftR/sneaker, idle) | −1.4 cm / −0.1 cm / 1.4 cm / −0.5 cm |
| bruiser | −0.9 cm (ftR/sneaker, idle) | −0.9 cm (ftR/sneaker, idle) | −0.9 cm (ftR/sneaker, idle) | −0.9 cm (ftR/sneaker, idle) | 2.5 cm (ftR/sneaker, idle) | 2.5 cm (ftR/sneaker, idle) | 0.1 cm (ftR/sneaker, idle) | 0.1 cm (ftR/sneaker, idle) | −1.1 cm (ftR/sneaker, idle) | −1.9 cm / −1.9 cm / 1.5 cm / −0.7 cm |

**Dizzy** (hurt → `THUG_POSES.dizzy` 3 s at rate 10 → chase; stars sprite at 2.2 × scale + 0.15 m above the root):

| member | stars height | clearance below stars HD (highest part) | with animateGang | LOD 1 | worst shoulder gap in dizzy L / R |
|---|---|---|---|---|---|
| grunt_a | 2.35 m | 42.1 cm (head/ear) | 42.1 cm | 42.9 cm (head/head) | 0.0 cm / 0.0 cm |
| grunt_b | 2.35 m | 46.6 cm (head/ear) | 46.6 cm | 47.4 cm (head/head) | 0.0 cm / 0.0 cm |
| armed | 2.35 m | 46.6 cm (head/ear) | 46.6 cm | 47.4 cm (head/head) | 0.0 cm / 0.0 cm |
| bruiser | 2.79 m | 52.9 cm (head/ear) | 52.9 cm | 53.9 cm (head/head) | 0.0 cm / 0.0 cm |

**Down pose and shoulders** (`down(1, true)` snapped; knock-down end = last frame of the 60 fps `down` phase):

| member | shoulder gap down L / R | shoulder gap windup(1) L / R | windup(0.6) L / R | tail min y, down(1,true) | tail min y, knock-down end | ears min y, down(1,true) | tail / ears with animateGang | head min y, down(1,true) | min y excl. feet+weapon, down(1,true) |
|---|---|---|---|---|---|---|---|---|---|
| grunt_a | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 2.5 cm | 2.5 cm | 46.3 cm | 2.5 cm / 46.3 cm | 25.7 cm | 2.5 cm |
| grunt_b | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 2.5 cm | 2.5 cm | 44.3 cm | 2.5 cm / 44.3 cm | 25.7 cm | 2.5 cm |
| armed | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 2.5 cm | 2.5 cm | 44.3 cm | 2.5 cm / 44.3 cm | 25.7 cm | 2.5 cm |
| bruiser | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 2.8 cm | 2.8 cm | 53.1 cm | 2.8 cm / 53.1 cm | 30.9 cm | 2.8 cm |

**Outlines, shadows, LOD silhouette** (buried = share of a part's surface inside other outlined parts; stray ink rendered at 6 m, 256², 4 views, in idle and both dizzy sway extremes):

| member | worst buried share (part) | worst stray ink px (part, view) | shadow-rule violations HD / LOD | LOD IoU front / 3/4 / side |
|---|---|---|---|---|
| grunt_a | 52.4 % (head/ear) | 2 (head/snout, dizzyL/front) | 0 / 0 | 0.899 / 0.914 / 0.880 |
| grunt_b | 51.2 % (head/snout) | 7 (head/band, idle/side) | 0 / 0 | 0.898 / 0.924 / 0.915 |
| armed | 51.2 % (head/snout) | 4 (hips/jeans, dizzyR/side) | 0 / 0 | 0.918 / 0.941 / 0.928 |
| bruiser | 50.7 % (head/snout) | 8 (torso/hood, idle/back) | 0 / 0 | 0.921 / 0.926 / 0.911 |

**The game's real `mergeRig()`** (`tools/game/04b_rig_merge.js`, run on the HD rig):

| member | meshes + hulls before | merged meshes (solid + outline) | bones | draw calls + shadow calls | max vertex Δ merged vs parts (7 poses) | flash: unflashed px of rig px (flash 0.85) | animateGang moves merged tail | render diff px: interior / edge (of rig px) | farthest vertex from culling sphere centre, all sequences (pass: r = 2.6; info: ZIP kit r = 1.9) |
|---|---|---|---|---|---|---|---|---|---|
| grunt_a | 30 + 23 | 3 (2 + 1) | 16 | 3 + 2 | 0.000 mm | 0 of 7683 | 1.9 cm (1224 verts) | 0 / 97 (of 9319) | 2.15 m (outside 1.9) |
| grunt_b | 32 + 25 | 3 (2 + 1) | 16 | 3 + 2 | 0.000 mm | 0 of 7576 | 1.9 cm (1224 verts) | 1 / 98 (of 9252) | 2.15 m (outside 1.9) |
| armed | 31 + 24 | 3 (2 + 1) | 17 | 3 + 2 | 0.000 mm | 0 of 7942 | 1.9 cm (1224 verts) | 4 / 107 (of 9698) | 2.46 m (outside 1.9) |
| bruiser | 29 + 22 | 3 (2 + 1) | 16 | 3 + 2 | 0.000 mm | 0 of 12349 | 2.3 cm (1224 verts) | 0 / 2 (of 14605) | 2.17 m (outside 1.9) |

**Idle reach and determinism** (reach = farthest non-hull vertex from the root's vertical axis over idle t = 0 .. 2 s at 15 fps, weapon excepted, minus META.radius; hash = every part's world vertices, colours and joint transforms after `idle(0)`):

| member | META.radius | farthest reach (part) | beyond radius (limit 0.35 m) | hash seed 7 (twice) | HD and LOD same seed → same hash | seed 8 hash (differs) |
|---|---|---|---|---|---|---|
| grunt_a | 0.42 m | 0.620 m (haL/paw, t = 0.00 s) | 0.200 m | `44ae809b` | yes | `b5a61347` (yes) |
| grunt_b | 0.42 m | 0.620 m (haL/paw, t = 0.00 s) | 0.200 m | `9516f2e7` | yes | `14469343` (yes) |
| armed | 0.42 m | 0.630 m (haR/paw, t = 0.00 s) | 0.210 m | `12a04a4b` | yes | `e50475b7` (yes) |
| bruiser | 0.55 m | 0.768 m (haL/paw, t = 0.00 s) | 0.218 m | `fe787ddb` | yes | `8e0b8fd7` (yes) |

Per-member pass flags (caps, margins, ground, shoulders, stray hulls, shadows, flash, hulls, merge, height, feet): grunt_a: PASS, grunt_b: PASS, armed: PASS, bruiser: PASS

## Culling sphere

`mergeRig()`'s culling sphere radius is now 2.6 (centre (0, 0.95, 0)), and QA checks it as a pass flag. Farthest vertex from the centre over all sequences: grunt_a 2.15 m, grunt_b 2.15 m, armed 2.46 m, bruiser 2.17 m.

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
- **Margins:** HD is 29–32 parts and 9,684–10,080 tris. LOD is 11–12 parts and 1,712–1,780 tris.
- **Lowest vertex (any sequence):** HD -0.9 cm, LOD -1.9 cm. The floor is −3 cm, and the LOD margin target is −2 cm.
- **Buried parts:** the most buried part is head/ear on grunt_a at 52.4 % (limit 55 %).
- **Stray ink:** the worst is 8 px (torso/hood on bruiser) against the 12 px limit, over idle and both dizzy extremes. The 5 px, 12 px and 6 m thresholds are mine, not the game's.
- **Dizzy stars:** the closest approach is 42.1 cm below the sprite (head/ear on grunt_a).
- **LOD silhouette:** IoU against HD is 0.880–0.941.
- **Merged vs parts render:** 0–4 interior pixels differ out of 9,252–14,605 rig pixels. Another 2–107 pixels differ only along outline edges.
- **Tail look:** the tail hangs close behind the hips, angled out to the left, rather than standing up. In `down`, anything more than about 23 cm behind the body goes through the ground.
- **Not modelled:** the attack's forward lunge, by agreement (the game handles root motion).
