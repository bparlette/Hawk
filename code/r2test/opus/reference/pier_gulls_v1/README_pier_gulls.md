# Toad City Baltimore: Task C, gang 2 of 5: Pier Gulls

This gang is built to TASK_C plus the gang-2+ rules from gang 1's review:
- the real down pose
- nothing through the ground
- shadow rules
- the texture-cache key
- the gang accent on the LOD
- 37-part headroom
- measured-only numbers
- integration facts

`tools/qa.html` and `tools/shoot.mjs` produce every number below, and `tools/qa_table.py` pastes them in unedited. The raw run is `qa/pier_gulls_report.json`.

| id | Gang | Animal | District | Accent |
|---|---|---|---|---|
| `pier_gulls` | Pier Gulls | herring gulls | Piers: National Aquarium, Power Plant, Four Seasons | white + blue `#2f5bd3` |

## What's in this zip

```
src/gang_pier_gulls.js          the delivery: GANG, META, buildPierGull(K, member, opts), animateGang(J, t, state) (optional)
src/gang_harbor_rats.js         gang 1, unchanged v1; present because viewer.html registers it
toadcity_kit.js                 the kit, rebuilt from the brief's appendix; HERO_POSES.down and THUG_POSES.down are now the REAL ones
example_gull_thug.js            the brief's interface example (viewer comparison)
viewer.html                     test bench (see "How to view")
previews/pier_gulls_*.png       27 images: for each member, day and night turnarounds, a 7-pose sheet, a 60 fps knock-down
                                filmstrip and an HD-vs-LOD turnaround; plus the armed attack filmstrip, lineup day/night,
                                LOD lineup, hit-flash and phone day/night
qa/pier_gulls_report.json       the raw QA and measurement run behind every number in this README
tools/qa.html, tools/qa.js      the acceptance suite (ground, shoulders, stray hulls, shadows, mergeRig, budgets, LOD IoU)
tools/shoot.mjs                 headless runner (Chromium + SwiftShader): renders previews, runs QA, fails on any console error or warning
tools/qa_table.py               turns a shoot.mjs report into the tables below
tools/tile.py                   tiles PNGs for the HD-vs-LOD previews (needs Pillow)
tools/previews_pier_gulls.json  the exact jobs for this delivery (previews, frame measurements and QA)
tools/previews_harbor_rats.json gang 1's jobs (kept for reference)
README.md, LICENSES.md
```

## How to view and re-run

```sh
python3 -m http.server 8000
# viewer:  http://localhost:8000/viewer.html?show=pier_gulls          (lineup)
#          ...?show=pier_gulls.armed&strip=knockdown                   (60 fps hurt > down > getup > idle filmstrip)
# QA:      http://localhost:8000/tools/qa.html?gang=pier_gulls         (results in window.__qa; about 10 s)
#          ...?gang=pier_gulls&debug=bruiser,torso/jacket,side         (paints that part's stray ink red)
# headless (npm i playwright-core three@0.160.0, on NODE_PATH):
REPORT=qa/pier_gulls_report.json node tools/shoot.mjs --batch tools/previews_pier_gulls.json
python3 tools/qa_table.py qa/pier_gulls_report.json
```

**Viewer parameters:** `show`, `night=1`, `lod=1`, `pose=idle|run|windup|attack|hurt|down|getup|all`, `turn=1`, `strip=knockdown|attack|run`, `cam=three|front|side|back|phone`, `dist`, `zoom`, `look`, `t`, `flash=0.85`, `anim=0`, `ui=0`.

**Viewer keys:** N night, P pose, L LOD, F flash, A anim, C camera.

## The gang

Every member is an anthropomorphic herring gull. Each one has:
- a **blue (`#2f5bd3`) top with a white chest band**, which is the gang read at 8 m
- a hooked yellow bill with the red gonys spot
- pale glaring eyes under an ink brow
- wing-arms ending in dark wingtip fists with a white "mirror" spot
- pink legs and webbed feet
- a short white tail
- shorts

| member | silhouette hook | notes |
|---|---|---|
| `grunt_a` | blue bucket hat | khaki shorts, grey mantle |
| `grunt_b` | blue cap worn backwards | first-winter juvenile: brown mottled plumage, dark bill, dark eye; denim shorts |
| `armed` | blue sweatband; **frozen rockfish** swung by the tail | weapon in `J.swR = K.grp(J.haR, 0, -0.04, 0)` along +Y: tail fin, tapered body, lateral stripe, eye |
| `bruiser` | blue beanie with white cuff, gold chain, sleeveless vest | great black-backed gull (dark mantle), ×1.28 width / ×1.2 depth; `big: true`, so the game scales it ×1.2 |

## Rig, materials, integration

- **Skeleton:** `K.skeleton()` with `PG_D`, which has the same keys as `K.THUG_D` (hip 0.9). All 18 joints are unchanged, so `K.THUG_POSES` drives the rig as-is.
- **Extras:** there is one extra, `J.tail`, a plain `THREE.Group` directly under `J.hips`. The weapon lives in the standard `J.swR` joint.
  - The tail tips **up** at rest (pitch 0.62–0.68 rad), so it clears the ground in the real `down` **without** `animateGang` (table below).
- **`animateGang` is optional.** It only flicks `J.tail`: yaw ±0.16–0.3 rad, never below the rest pitch, and frozen in `'down'`.
  - If you call it, the expected state mapping is: down/dying → `'down'`, getup → `'idle'`, chase → `'run'`, windup → `'attack'`, dizzy → `'hurt'`.
- **Materials:** one `K.toonMat()` per rig, plus **one** canvas-mapped `K.toonMat({ map })` feather sub-material.
  - The sub-material covers the head, forearms, tail and the bruiser's shoulders, and shares `userData.flash` and `flashC`.
  - All hulls are `K.OUT_CHAR`, added by `K.part()`. LOD 1 uses no map.
- **Texture cache:** keyed on `K.QUAL || K.THREE || K`. A missing `document` or 2D context returns `null` and is never cached; the rig then falls back to the plain toon material.
- **Shadow and outline rules are enforced in code** by `pgPart`:
  - `outline:false` implies `shadow:false`.
  - Any part under 4 cm in two dimensions gets neither an outline nor a shadow. QA confirms 0 violations (table below).
  - Decorative rings that wrap a body (the chest band and the beanie cuff) are **open tubes**, so no end caps are buried inside the part they wrap.
- **mergeRig():** the rig uses plain groups only, every extra is parented directly under a skeleton joint, and there is one mapped sub-material.
  - QA emulates a per-group merge: direct child meshes are merged by material and by outlined-or-not, with hulls merged alongside. It then checks the hit-flash and `animateGang` on the merged rig (table).
  - The real `mergeRig()` was not available to me.
- **Standalone ES module:** no imports and no reliance on concatenation. Helper names are `pg`-prefixed anyway.
- **No LOD swap in the game today.** `opts.lod === 1` builds TASK_C's far variant; beyond 24 m the game only hides hulls and shadows.

## Measured numbers

How things are measured (`tools/qa.js`):
- **Parts** are non-hull meshes. **Tris** exclude hulls.
- **Height and feet** are measured in idle at t = 0, with `META.scale` applied.
- **Sequences** run at 60 fps.
  - The knock-down uses the game's own timings: a hop (vy 4.2, gravity 22), then `down` at damping rate 13 for 1.25 s, then `getup` at rate 14 for 0.5 s.
  - The other phases (idle 0.5 s, hurt 0.3 s, windup 0.4 s, attack 0.5 s, run 1.2 s at speed 4.5) use rate 14 and `snapTilt = false`. Those durations and rates are my assumptions.
- **Shoulder gap** is the signed distance from the parts on `shL`/`shR` to the parts on `torso`; 0 means touching or overlapping.
- **Stray ink** is render-based. It counts a part's ink that lies on top of other parts and more than 5 px from that part's own visible pixels, at 6 m, 256², from four views. A part fails above 12 px.

QA run: 34 jobs, 0 console errors/warnings. All acceptance checks: PASS.

| member | LOD | parts | tris | hull tris | hulls | materials | shadow casters | draw calls (meshes + hulls) | height | feet min y (idle) |
|---|---|---|---|---|---|---|---|---|---|---|
| grunt_a | HD | 33 | 10,760 | 7,964 | 24 | 3 | 24 | 57 | 1.901 m | 0.017 m |
| grunt_a | 1 | 14 | 1,392 | 1,392 | 14 | 2 | 14 | 28 | 1.891 m | 0.008 m |
| grunt_b | HD | 33 | 11,056 | 8,260 | 24 | 3 | 24 | 57 | 1.884 m | 0.017 m |
| grunt_b | 1 | 14 | 1,732 | 1,732 | 14 | 2 | 14 | 28 | 1.893 m | 0.008 m |
| armed | HD | 36 | 11,656 | 8,452 | 25 | 3 | 25 | 61 | 1.858 m | 0.017 m |
| armed | 1 | 14 | 1,392 | 1,392 | 14 | 2 | 14 | 28 | 1.867 m | 0.008 m |
| bruiser | HD | 33 | 11,072 | 8,276 | 24 | 3 | 24 | 57 | 2.359 m | 0.019 m |
| bruiser | 1 | 14 | 1,732 | 1,732 | 14 | 2 | 14 | 28 | 2.371 m | 0.007 m |

- Whole frame, all four members + ground, `show=pier_gulls&lod=0&t=0.5`: **330 draw calls, 110,450 triangles** (incl. shadow pass).
- Whole frame, all four members + ground, `show=pier_gulls&lod=1&t=0.5`: **169 draw calls, 18,746 triangles** (incl. shadow pass).

**Ground clearance** (lowest non-hull vertex, worst frame; floor is −3.0 cm; feet and weapon exempt only in `down`):

| member | knock-down 60 fps | + animateGang | attack 60 fps | + animateGang | run 60 fps | + animateGang | pose sweeps | LOD 1 (knock-down / attack / run) |
|---|---|---|---|---|---|---|---|---|
| grunt_a | -1.2 cm (ftR/foot, idle) | -1.2 cm (ftR/foot, idle) | -0.6 cm (ftR/foot, idle) | -0.6 cm (ftR/foot, idle) | 1.1 cm (ftR/foot, idle) | 1.1 cm (ftR/foot, idle) | -1.3 cm (ftR/foot, idle) | -2.1 cm / -0.8 cm / 0.8 cm |
| grunt_b | -1.2 cm (ftR/foot, idle) | -1.2 cm (ftR/foot, idle) | -0.6 cm (ftR/foot, idle) | -0.6 cm (ftR/foot, idle) | 1.1 cm (ftR/foot, idle) | 1.1 cm (ftR/foot, idle) | -1.3 cm (ftR/foot, idle) | -2.1 cm / -0.8 cm / 0.8 cm |
| armed | -1.2 cm (ftR/foot, idle) | -1.2 cm (ftR/foot, idle) | -0.6 cm (ftR/foot, idle) | -0.6 cm (ftR/foot, idle) | 1.1 cm (ftR/foot, idle) | 1.1 cm (ftR/foot, idle) | -1.3 cm (ftR/foot, idle) | -2.1 cm / -0.8 cm / 0.8 cm |
| bruiser | -1.5 cm (knR/shin, idle) | -1.5 cm (knR/shin, idle) | -0.9 cm (ftR/foot, idle) | -0.9 cm (ftR/foot, idle) | 0.7 cm (ftR/foot, idle) | 0.7 cm (ftR/foot, idle) | -1.6 cm (knR/shin, idle) | -2.7 cm / -1.2 cm / 0.8 cm |

**Down pose and shoulders** (`down(1, true)` snapped; knock-down end = last frame of the 60 fps `down` phase):

| member | shoulder gap down L / R | shoulder gap windup L / R | tail min y, down(1,true) | tail min y, knock-down end | head min y, down(1,true) | min y excl. feet+weapon, down(1,true) |
|---|---|---|---|---|---|---|
| grunt_a | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 1.4 cm | 1.4 cm | 21.7 cm | 1.4 cm |
| grunt_b | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 1.4 cm | 1.4 cm | 18.2 cm | 1.4 cm |
| armed | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 1.4 cm | 1.4 cm | 23.7 cm | 1.4 cm |
| bruiser | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 1.7 cm | 1.7 cm | 26.0 cm | 1.7 cm |

**Outlines, shadows, merge, LOD silhouette**:

| member | worst buried share (part) | worst stray ink px @6 m (part, view) | shadow-rule violations HD / LOD | mergeRig: meshes before → after, hulls after | flash shared + covers after merge | mapped sub-materials | animateGang moves merged tail | LOD IoU front / 3/4 / side |
|---|---|---|---|---|---|---|---|---|
| grunt_a | 44.5 % (shR/upper) | 4 (head/hat, front) | 0 / 0 | 33 → 20, 17 | yes | 1 | yes, 1.0 cm | 0.908 / 0.899 / 0.893 |
| grunt_b | 46.3 % (head/head) | 2 (shR/upper, back) | 0 / 0 | 33 → 20, 17 | yes | 1 | yes, 1.0 cm | 0.920 / 0.912 / 0.909 |
| armed | 46.9 % (shR/upper) | 2 (shL/upper, back) | 0 / 0 | 36 → 22, 18 | yes | 1 | yes, 1.0 cm | 0.905 / 0.896 / 0.892 |
| bruiser | 59.8 % (head/beanie) | 6 (torso/jacket, side) | 0 / 0 | 33 → 20, 17 | yes | 1 | yes, 1.4 cm | 0.934 / 0.924 / 0.932 |

Per-member pass flags: grunt_a: PASS, grunt_b: PASS, armed: PASS, bruiser: PASS

## Kit note

`toadcity_starter_kit.zip` was never supplied, so `toadcity_kit.js` is still the rebuild from the brief's appendix.
- **Real since gang 1:** `HERO_POSES.down` and `THUG_POSES.down` are now the code from `src/04_actors.js` that you sent.
- **Verbatim from the appendix:** everything this module uses from `K`: `G`, `part`, `grp`, `skeleton`, `toonMat`, `INK`, `lowTex`, `QUAL`, `THREE`, `THUG_POSES` and `applyPose`.
- **Still stand-ins:** `HERO_POSES.idle/run`, `buildThug`, the light presets and the prop collector.

## Known issues (with sizes)

- **Platform:** tested only in headless Chromium with SwiftShader, with 0 console errors or warnings across all jobs. It has not been run on iOS Safari or an iPhone.
- **Idle-bob foot dip:** the game's idle bob (±3 cm) takes the right foot to −1.2 cm and the bruiser's right shin to −1.5 cm, inside the −3 cm floor. LOD 1 reaches −2.1 cm, and −2.7 cm on the bruiser.
  - At bob-neutral, the HD feet sit +1.7 cm above y = 0 (bruiser +1.9 cm), and LOD 1 sits +0.7 to +0.8 cm.
- **Close margins:**
  - The bruiser's beanie is 59.8 % buried against a 60 % limit, with 0 px of stray ink.
  - The armed gull is at 36 of 37 parts and 11,656 HD tris against a 12,000 limit.
- **Stray ink:** the worst is 6 px (bruiser jacket, side view) against the 12 px limit. The 5 px, 12 px and 6 m thresholds are mine, not the game's.
- **LOD colours:** LOD 1 has no wingtip fists, so HD's dark hands become grey forearm ends. LOD silhouettes score IoU 0.892–0.934 against HD.
- **mergeRig:** emulated, not the game's function (see above). On the emulation, each member's 33–36 meshes merge to 20–22 meshes plus 17–18 hulls.
- **Sequence assumptions:** only the knock-down timings came from the game. The hurt, attack and run durations and rate 14 are assumed (see "How things are measured").
- **Gang 1 (Harbor Rats) is not retrofitted.** Run through the same QA (`qa/harbor_rats_report_newrules.json` in the repo), it reproduces the review:
  - the tail goes 66.0–79.2 cm below ground in `down`
  - shoulder gaps are 2.9–3.1 cm in `down` (armed windup 2.8 cm)
  - 40/40 parts
  - shadow-rule violations
