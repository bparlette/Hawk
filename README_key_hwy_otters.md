# Toad City Baltimore: Task C, gang 5: Key Highway Otters (v1.0.1)

Built to the round-2 brief (O4) on the round-2 ZIP's kit. Branch: `claude/o4-key-hwy-otters`.

**v1.0.1:** the bruiser's sash is now its own thin torus part on the vest instead of painted sphere faces, so it reads as a clean band. The bruiser goes from 32 to 33 parts and from 9,400 to 9,592 tris; the QA below is a full re-run.

Every number below comes from a script run:
- `tools/qa.html` (run headless by `tools/shoot.mjs`) on `kit/toadcity_kit.js` and `kit/real_mergeRig.js`
- `kit/real_viewer.html` renders, with `window.__report.seq.minY`
- Hark's `harness/measure_gang.mjs`, run unchanged, written to `tools/results_gang.json`

`tools/qa_table.py` and `tools/self_check.py` paste them in unedited. The raw QA and render run is `qa/key_hwy_otters_report.json`.

| id | Gang | Animal | District ids | Accent |
|---|---|---|---|---|
| `key_hwy_otters` | Key Highway Otters | river otters | `['fedhill', 'domino', 'underarmour', 'fort']` | green `#23c26b` + brown |

`'underarmour'` is the game's internal district id and is used exactly as given. It appears only in `GANG.district`. Nothing on the otters carries a name, text, logo, or brand colours or patterns.

## What's in this zip

```
src/gang_key_hwy_otters.js      the delivery: GANG, META, buildKeyHwyOtter(K, member, opts), animateGang(J, t, state) (optional)
kit/toadcity_kit.js             the round-2 ZIP's kit, byte-identical (never edited)
kit/real_mergeRig.js            the game's mergeRig as shipped in the ZIP, byte-identical
kit/real_viewer.html            the ZIP's real-pose viewer, byte-identical (the §5 renders use it)
kit/real_poses_04_actors.js, kit/viewer.html, kit/example_gull_thug.js, kit/example_bench.js   the rest of the ZIP's kit/, byte-identical
harness/measure_gang.mjs, harness/realK.mjs, harness/fakedom.mjs   Hark's harness, byte-identical
viewer.html                     kit/real_viewer.html with repo-root paths, the otters as default, the game's dizzy attached, &seq=dizzy, &stars=1
bench.html                      the test bench used for the 60 fps filmstrips, LOD tiles and close-up (&kit=zip&gangs=key_hwy_otters)
previews/key_hwy_otters_*.png   78 images (listed below)
qa/key_hwy_otters_report.json   the raw run behind every number here: every render job, its console output, and the QA report
tools/qa.html, tools/qa.js      the acceptance suite (defaults to the ZIP kit for this gang)
tools/game/thug_dizzy.js        the game's THUG_POSES.dizzy, verbatim, attached to K at test time (see "Kit")
tools/shoot.mjs                 headless runner (Chromium + SwiftShader); fails on any console error or warning
tools/qa_table.py               turns the report into the tables below
tools/self_check.py             fills the brief's §7 self-check from the report and results_gang.json
tools/tile.py                   tiles PNGs for the HD-vs-LOD previews (needs Pillow)
tools/previews_key_hwy_otters.json  the exact render and QA jobs for this delivery
tools/results_gang.json         harness/measure_gang.mjs output for this module
tools/box_sweep.mjs, tools/box_sweep.json   the harness's per-part box ground test swept over getup u = 0 .. 1, and its output
README.md, README_key_hwy_otters.md, LICENSES.md   this file (two identical copies) and the licences
```

**Previews:**
- **Per member, rendered with `kit/real_viewer.html`:**
  - phone 390×844 day and night (`&cam=phone`), unmerged and merged (`&merge=1`)
  - 1280×720 turnarounds day and night, unmerged and merged
  - the real 7-pose strip (`&pose=all`, real `down` included)
  - hit-flash 0.85 merged
  - `&seq=knockdown`, unmerged and merged, captured 8.25 s after load (inside the `down` phase of the 2.55 s loop) of the looping sequence
- **Per member, rendered with `bench.html`:**
  - 60 fps knock-down, attack and dizzy filmstrips (real timings, real mergeRig; the gold ring is the stars sprite height)
  - an HD-vs-LOD turnaround
  - a close daylight front view
- **Gang:**
  - phone lineups day and night, unmerged and merged
  - 1280×720 lineups day and night
  - LOD lineup
  - `&seq=knockdown` lineups at HD and LOD
  - a stars-height lineup

## How to view and re-run

```sh
python3 -m http.server 8000
# viewer:  http://localhost:8000/viewer.html                                   (lineup; &merge=1 merged, &night=1, &lod=1)
#          ...viewer.html?show=key_hwy_otters.bruiser&seq=knockdown            (real timings; window.__report.seq.minY)
#          ...viewer.html?show=key_hwy_otters.bruiser&seq=dizzy&merge=1        (hurt > dizzy 3 s at rate 10 > chase; gold ring = stars)
#          ...kit/real_viewer.html?mods=../src/gang_key_hwy_otters.js&show=key_hwy_otters&pose=all   (the ZIP's own viewer)
# bench:   ...bench.html?kit=zip&gangs=key_hwy_otters&show=key_hwy_otters.armed&strip=attack&merge=1
# QA:      http://localhost:8000/tools/qa.html?gang=key_hwy_otters&inkMargin=8&hdTris=10800   (results in window.__qa)
# headless (npm i playwright-core three@0.160.0, on NODE_PATH):
REPORT=qa/key_hwy_otters_report.json node tools/shoot.mjs --batch tools/previews_key_hwy_otters.json
python3 tools/qa_table.py qa/key_hwy_otters_report.json
GANG=./src/gang_key_hwy_otters.js OUT=tools/results_gang.json node harness/measure_gang.mjs
GANG=./src/gang_key_hwy_otters.js OUT=tools/box_sweep.json node tools/box_sweep.mjs
python3 tools/self_check.py qa/key_hwy_otters_report.json tools/results_gang.json
```

## The gang

Every member is an anthropomorphic river otter. Each one has:
- a **green (`#23c26b`) track jacket** with a brown collar, a brown waistband, and a brown stripe and cuff down each sleeve; this is the gang read at 8 m
- sleek brown fur
- a broad flat cream muzzle with a dark nose, whiskers and a pale throat
- small round ears
- dark webbed feet
- joggers
- a thick tapering tail hanging close behind the hips

The bruiser swaps the jacket for a brown vest with a green drum-major sash. Green and brown keep them apart from the rats (navy + mustard), gulls (white + blue), catfish (teal + slate) and bandits (orange + grey). There are no letters, numbers, logos or brand marks anywhere.

| member | silhouette hook | notes |
|---|---|---|
| `grunt_a` | refinery hard hat: a cream dome with a painted green band and a cream brim | grey joggers; ears set lower and wider under the brim |
| `grunt_b` | painted green headband, cream towel round the neck | darker fur, green-grey joggers |
| `armed` | **a plain sugar sack swung on a short rope** (cream, brown tie band, no print) | weapon in `J.swR = K.grp(J.haR, 0, -0.04, 0)`, built along +Y, at both LODs |
| `bruiser` | flared brown drum-major shako with a painted green band and a green plume; brown vest, green sash, bare furry arms | ×1.28 width / ×1.2 depth; `big: true` (game ×1.2, windup 0.7 s), hp 16, radius 0.55 |

## Rig, materials, integration

- **Skeleton:** `K.skeleton()` with `KO_D`, which has the same keys as `K.THUG_D` (hip 0.9) and a longer neck. All 18 joints are unchanged.
- **Extras:** one extra, `J.tail`, a plain `THREE.Group` directly under `J.hips` (`mergeRig` turns it into a bone; see the harness's `tailIsBone`). The weapon is in the standard `J.swR`.
- **The tail passes at rest, so `animateGang` is optional (Rule A1 does not apply).**
  - In the real `down` pose, anything more than about 23 cm behind the body goes through the ground, so the tail hangs close behind the hips.
  - It clears the ground in `down(1, true)` and at the end of the knock-down **without** `animateGang`. Measured clearances with and without it are in the self-check and the down table.
  - `animateGang(J, t, state)` only sways `J.tail` sideways, never further back than its rest pitch, and holds still in `'down'`.
  - Expected state mapping if you call it: down/dying → `'down'`, getup → `'idle'`, chase → `'run'`, windup → `'attack'`, dizzy → `'hurt'`.
- **Materials:** one `K.toonMat()` per rig, plus **one** canvas-mapped `K.toonMat({ map })` fur sub-material (head, ears, tail, bruiser arms) that shares `userData.flash` and `flashC`.
  - All hulls are `K.OUT_CHAR`.
  - LOD 1 uses no map.
- **Texture cache:** keyed on `K.QUAL || K.THREE || K`. A failed draw returns `null` and is never cached.
- **Determinism:** the only randomness is a seeded LCG (`s = s * 16807 % 2147483647`) from `opts.seed`. There is no `Math.random`.
- **Painted details (`koPaint`, face bounding-box midpoint):** recoloured faces on existing parts, not extra meshes:
  - the jacket collar, waistband, sleeve stripe and cuff
  - the bruiser's vest sash
  - the throat
  - the hat band, headband and shako band
  - the sack's tie band
- **Far LOD (`koConcat`):** joins already-placed `K.G` primitives into one non-indexed part, which is then painted. That way the 11–12-part LOD keeps the HD colours: head with muzzle and ears, sleeve with paw, and jogger with foot.
  - The LOD foot is a cylinder lying across the shin's end, so it pitches with the shin in getup without digging in.
- **Shadow and outline rules are enforced in code** by `koPart`:
  - `outline:false` implies `shadow:false`.
  - Any part under 4 cm in two dimensions (whiskers, pupils) gets neither an ink hull nor a shadow.
- **Standalone ES module:** no imports and no reliance on concatenation. Helper names are `ko`-prefixed anyway.
- **No LOD swap in the game.** `opts.lod === 1` builds TASK_C's far variant; the game does not swap it in.

**Fixes the QA drove during the build:**
- **Ears under hats:** on `grunt_a` and the bruiser, the ears sat inside the hat brim, at 88.5 % and 55.7 % buried. They now sit lower and wider, so every part is under 55 %.
- **Bruiser sash (v1.0.1):** v1 painted the sash on the vest's sphere faces, which read as a stepped band.
  - It is now a separate torus part (`sash`) ringed round the vest, tilted 0.45 rad, with its tube 3.6 cm thick.
  - The first try, higher and steeper on the chest, crossed the shoulder ball (59.6 % buried, 15 px stray ink on the vest). Moving it lower and flatter fixed both; the numbers below are for this version.
  - The LOD keeps the band as painted faces on the jacket, matching its position.
- **Bruiser shako:** a straight drum's rim drew 9 px of stray ink across the brow. The shako now flares upward from a narrow base that sits inside the head, at 3 px.
- **Harness ground margin:** the harness tests each part's bounding box (`Box3.setFromObject`), which is more conservative than vertices.
  - It put the tail at −2.6 to −3.0 cm in `down` and the bruiser's LOD shin and foot at −3.1 cm in `getup(0.3)`.
  - The tail now hangs 1 cm closer to the body and is 7 mm slimmer. The LOD foot is 2 cm shorter front to back.
  - Measured the harness's way over its poses plus `getup` u = 0 … 1 (`tools/box_sweep.mjs`), the worst box is now −2.0 cm (shin on bruiser/lod1, getup(0.3)).
- **LOD 1 face:** the far head's muzzle box read as a blank visor up close. It now has a dark nose and two eye dots, joined into the same part (+36 tris).

## Kit

- **`kit/` is the round-2 ZIP's `kit/`, byte-identical.** I never edited it and never rebuilt any of it.
- **Dizzy is attached at test time:** `kit/toadcity_kit.js` predates the game's `THUG_POSES.dizzy`. `tools/game/thug_dizzy.js` holds the game's function verbatim, and `attachDizzy(K)` sets `K.THUG_POSES.dizzy` at run time only if it is missing.
  - The QA page, `viewer.html` and `bench.html` call it. The module itself never touches `K.THUG_POSES`.
  - The QA report records it: `dizzyAttachedAtTestTime: true`.
- **Timings are the game's (`06_game.js`):**
  - `down` damps at rate 13, with `st` in seconds, and getup starts after 1.25 s
  - getup is `getup(st / 0.5)` at rate 14
  - dizzy is `dizzy(st)` at rate 10 for 3 s, from hurt, to chase

## Measured numbers

QA run on the ZIP kit with the approved margins:
- HD ≤ 35 parts and ≤ 10,800 tris
- LOD ≤ 12 parts and ≤ 2,000 tris
- LOD ≥ −2 cm
- every part < 55 % buried
- stray ink ≤ 12 px; QA run at 8 px for headroom

The measurements are the same as in the earlier gangs' READMEs. The new checks are:
- windup(0.6) shoulder gaps
- idle reach
- the determinism hash
- the harness
- the real-viewer `seq.minY`

### §7 self-check

| Check | grunt_a | grunt_b | armed | bruiser | Threshold |
|---|---|---|---|---|---|
| HD parts / tris / materials | 32 / 9,400 / 3 | 31 / 9,140 / 3 | 32 / 9,752 / 3 | 33 / 9,592 / 3 | ≤ 36 / ≤ 10,800 / ≤ 3 |
| LOD 1 parts / tris | 12 / 1,648 | 11 / 1,592 | 12 / 1,704 | 12 / 1,648 | ≤ 12 / ≤ 2,700 |
| Hulls / shadow casters (HD) | 23 / 19 | 22 / 18 | 23 / 19 | 24 / 21 | report |
| Height (idle, t = 0) / feet min y | 1.895 m / 0.020 m | 1.819 m / 0.020 m | 1.819 m / 0.020 m | 2.492 m / 0.024 m | 1.8–2.2 m (×1.2 bruiser: 2.16–2.64) / ≥ −0.03 |
| Lowest non-hull point: real down(1,true) / knock-down seq.minY | 3.5 cm / 1.6 cm | 3.5 cm / 1.9 cm | 3.5 cm / 1.7 cm | 0.5 cm / 0.8 cm | ≥ −3.0 cm |
| Tail / ear lowest point in down(1,true), without / with animateGang | tail 3.5 cm / 3.5 cm; ears 38.4 cm / 38.4 cm | tail 3.5 cm / 3.5 cm; ears 41.1 cm / 41.1 cm | tail 3.5 cm / 3.5 cm; ears 41.1 cm / 41.1 cm | tail 4.5 cm / 4.5 cm; ears 46.1 cm / 46.1 cm | ≥ −3.0 cm |
| LOD 1 lowest point in knock-down (QA 60 fps / real_viewer seq.minY) | −0.9 cm / 0.1 cm | −0.9 cm / 0.1 cm | −0.9 cm / 0.1 cm | −1.3 cm / 0.0 cm | ≥ −2.0 cm |
| Shoulder gap down(1,true) / windup(0.6) | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | ≤ 1 cm |
| Real mergeRig: draw calls after / flash covers all / animateGang moves bones | 3 / yes / yes | 3 / yes / yes | 3 / yes / yes | 3 / yes / yes | ≤ 3 / yes / yes |
| Max horizontal reach beyond META.radius in idle (weapon excepted) | 19.4 cm | 19.4 cm | 20.2 cm | 21.0 cm | ≤ 35 cm |
| outline:false parts without shadow:false | 0 | 0 | 0 | 0 | 0 |
| Console errors (viewer, day + night) | 0 | 0 | 0 | 0 | 0 |
| Determinism: same seed → same hash | yes (aa9a0293) | yes (18e9c843) | yes (09195e37) | yes (7beeb0bf) | yes |

Viewer console errors and warnings over all 83 evidence jobs: 0 (real_viewer day 0, night 0). QA: ALL PASS on the zip (kit/toadcity_kit.js + kit/real_mergeRig.js) kit, dizzy attached at test time: yes.

### `kit/real_viewer.html` `&seq=knockdown`: `window.__report.seq.minY`

Lowest non-hull vertex over the looping knock-down, feet and weapon excepted, captured 8.25 s after load (inside the `down` phase of the 2.55 s loop):

| rig | unmerged, single rig | merged job, single rig | HD lineup | LOD 1 lineup |
|---|---|---|---|---|
| grunt_a | 1.6 cm | none (the viewer skips skinned meshes) | 3.2 cm | 0.1 cm |
| grunt_b | 1.9 cm | none (the viewer skips skinned meshes) | 3.2 cm | 0.1 cm |
| armed | 1.7 cm | none (the viewer skips skinned meshes) | 3.2 cm | 0.1 cm |
| bruiser | 0.8 cm | none (the viewer skips skinned meshes) | 2.3 cm | 0.0 cm |

### Hark's harness (`tools/results_gang.json`)

| rig | parts / tris | hulls / shadow casters | merge ok / draw calls / bones / tail is bone | lowest y over idle, run, windup, attack, hurt, down, down+anim, getup (pose) | poses with parts under ground / shoulder gaps | same seed equal / seed 8 differs |
|---|---|---|---|---|---|---|
| grunt_a | 32 / 9,400 | 23 / 19 | yes / 3 / 16 / yes | −0.5 cm (down) | 0 / 0 | yes / yes |
| grunt_a/lod1 | 12 / 1,648 | 12 / 12 | yes / 2 / 11 / yes | −1.5 cm (getup) | 0 / 0 | yes / no |
| grunt_b | 31 / 9,140 | 22 / 18 | yes / 3 / 16 / yes | −0.5 cm (down) | 0 / 0 | yes / yes |
| grunt_b/lod1 | 11 / 1,592 | 11 / 11 | yes / 2 / 11 / yes | −1.5 cm (getup) | 0 / 0 | yes / no |
| armed | 32 / 9,752 | 23 / 19 | yes / 3 / 17 / yes | −14.8 cm (down) | 2 / 0 | yes / yes |
| armed/lod1 | 12 / 1,704 | 12 / 12 | yes / 2 / 12 / yes | −13.4 cm (down) | 2 / 0 | yes / no |
| bruiser | 33 / 9,592 | 24 / 21 | yes / 3 / 16 / yes | −1.9 cm (down) | 0 / 0 | yes / yes |
| bruiser/lod1 | 12 / 1,648 | 12 / 12 | yes / 2 / 11 / yes | −2.0 cm (getup) | 0 / 0 | yes / no |

The harness's lowest point is the bounding box of every non-hull part (`Box3.setFromObject`, feet and weapon included), so it reads lower than the vertices. It flags a part under −3 cm in `under`. The only entries are the armed member's weapon (`swR`) in `down`, which the brief exempts: armed ['swR:-0.15'], armed/lod1 ['swR:-0.13']. Other poses: none. The QA tables and the real viewer's `seq.minY` use vertices and exempt the feet and the weapon, as the brief does. LOD rigs take no seed, so seed 8 builds the same LOD.

**Box sweep** (`tools/box_sweep.json`: the harness's per-part box test over its poses plus getup u = 0 … 1, weapon skipped in `down`):

| rig | lowest box (part, pose) |
|---|---|
| grunt_a | −0.5 cm (tail, down) |
| grunt_a/lod1 | −1.5 cm (shin, getup(0.3)) |
| grunt_b | −0.5 cm (tail, down) |
| grunt_b/lod1 | −1.5 cm (shin, getup(0.3)) |
| armed | −0.5 cm (tail, down) |
| armed/lod1 | −1.5 cm (shin, getup(0.3)) |
| bruiser | −1.9 cm (sash, down) |
| bruiser/lod1 | −2.0 cm (shin, getup(0.3)) |

### QA tables

QA run: 83 jobs, 0 console errors/warnings. All acceptance checks: PASS.

| member | LOD | parts | tris | hull tris | hulls | materials | shadow casters | draw calls (meshes + hulls) | height | feet min y (idle) |
|---|---|---|---|---|---|---|---|---|---|---|
| grunt_a | HD | 32 | 9,400 | 8,524 | 23 | 3 | 19 | 55 | 1.895 m | 0.020 m |
| grunt_a | 1 | 12 | 1,648 | 1,648 | 12 | 2 | 12 | 24 | 1.866 m | 0.019 m |
| grunt_b | HD | 31 | 9,140 | 8,264 | 22 | 3 | 18 | 53 | 1.819 m | 0.020 m |
| grunt_b | 1 | 11 | 1,592 | 1,592 | 11 | 2 | 11 | 22 | 1.820 m | 0.019 m |
| armed | HD | 32 | 9,752 | 8,876 | 23 | 3 | 19 | 55 | 1.819 m | 0.020 m |
| armed | 1 | 12 | 1,704 | 1,704 | 12 | 2 | 12 | 24 | 1.820 m | 0.019 m |
| bruiser | HD | 33 | 9,592 | 8,716 | 24 | 3 | 21 | 57 | 2.492 m | 0.024 m |
| bruiser | 1 | 12 | 1,648 | 1,648 | 12 | 2 | 12 | 24 | 2.388 m | 0.021 m |


**Ground clearance** (lowest non-hull vertex, worst frame; floor is −3.0 cm; feet and weapon exempt only in `down`; A = with animateGang):

| member | knockdown 60 fps | knockdown A | attack 60 fps | attack A | run 60 fps | run A | dizzy 60 fps | dizzy A | pose sweeps | LOD 1 (knockdown / attack / run / dizzy) |
|---|---|---|---|---|---|---|---|---|---|---|
| grunt_a | −0.8 cm (ftR/foot, idle) | −0.8 cm (ftR/foot, idle) | 0.5 cm (ftR/foot, idle) | 0.5 cm (ftR/foot, idle) | 1.9 cm (ftR/foot, idle) | 1.9 cm (ftR/foot, idle) | 0.0 cm (ftR/foot, idle) | 0.0 cm (ftR/foot, idle) | −0.9 cm (ftR/foot, idle+anim) | −0.9 cm / 0.4 cm / 1.9 cm / 0.0 cm |
| grunt_b | −0.8 cm (ftR/foot, idle) | −0.8 cm (ftR/foot, idle) | 0.5 cm (ftR/foot, idle) | 0.5 cm (ftR/foot, idle) | 1.9 cm (ftR/foot, idle) | 1.9 cm (ftR/foot, idle) | 0.0 cm (ftR/foot, idle) | 0.0 cm (ftR/foot, idle) | −0.9 cm (ftR/foot, idle+anim) | −0.9 cm / 0.4 cm / 1.9 cm / 0.0 cm |
| armed | −0.8 cm (ftR/foot, idle) | −0.8 cm (ftR/foot, idle) | 0.5 cm (ftR/foot, idle) | 0.5 cm (ftR/foot, idle) | 1.9 cm (ftR/foot, idle) | 1.9 cm (ftR/foot, idle) | 0.0 cm (ftR/foot, idle) | 0.0 cm (ftR/foot, idle) | −0.9 cm (ftR/foot, idle+anim) | −0.9 cm / 0.4 cm / 1.9 cm / 0.0 cm |
| bruiser | −0.9 cm (ftR/foot, idle) | −0.9 cm (ftR/foot, idle) | −1.0 cm (ftR/foot, idle) | −1.0 cm (ftR/foot, idle) | 2.0 cm (ftR/foot, idle) | 2.0 cm (ftR/foot, idle) | 0.0 cm (ftR/foot, idle) | 0.0 cm (ftR/foot, idle) | −1.1 cm (ftR/foot, idle+anim) | −1.3 cm / −1.3 cm / 2.1 cm / −0.1 cm |

**Dizzy** (hurt → `THUG_POSES.dizzy` 3 s at rate 10 → chase; stars sprite at 2.2 × scale + 0.15 m above the root):

| member | stars height | clearance below stars HD (highest part) | with animateGang | LOD 1 | worst shoulder gap in dizzy L / R |
|---|---|---|---|---|---|
| grunt_a | 2.35 m | 44.6 cm (head/hat) | 44.6 cm | 46.1 cm (head/hat) | 0.0 cm / 0.0 cm |
| grunt_b | 2.35 m | 52.1 cm (head/head) | 52.1 cm | 52.1 cm (head/head) | 0.0 cm / 0.0 cm |
| armed | 2.35 m | 52.1 cm (head/head) | 52.1 cm | 52.1 cm (head/head) | 0.0 cm / 0.0 cm |
| bruiser | 2.79 m | 27.9 cm (head/plume) | 27.9 cm | 38.4 cm (head/shako) | 0.0 cm / 0.0 cm |

**Down pose and shoulders** (`down(1, true)` snapped; knock-down end = last frame of the 60 fps `down` phase):

| member | shoulder gap down L / R | shoulder gap windup(1) L / R | windup(0.6) L / R | tail min y, down(1,true) | tail min y, knock-down end | ears min y, down(1,true) | tail / ears with animateGang | head min y, down(1,true) | min y excl. feet+weapon, down(1,true) |
|---|---|---|---|---|---|---|---|---|---|
| grunt_a | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 3.5 cm | 3.5 cm | 38.4 cm | 3.5 cm / 38.4 cm | 24.8 cm | 3.5 cm |
| grunt_b | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 3.5 cm | 3.5 cm | 41.1 cm | 3.5 cm / 41.1 cm | 26.8 cm | 3.5 cm |
| armed | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 3.5 cm | 3.5 cm | 41.1 cm | 3.5 cm / 41.1 cm | 26.8 cm | 3.5 cm |
| bruiser | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 0.0 cm / 0.0 cm | 4.5 cm | 4.5 cm | 46.1 cm | 4.5 cm / 46.1 cm | 32.2 cm | 0.5 cm |

**Outlines, shadows, LOD silhouette** (buried = share of a part's surface inside other outlined parts; stray ink rendered at 6 m, 256², 4 views, in idle and both dizzy sway extremes):

| member | worst buried share (part) | worst stray ink px (part, view) | shadow-rule violations HD / LOD | LOD IoU front / 3/4 / side |
|---|---|---|---|---|
| grunt_a | 48.2 % (head/brim) | 4 (shR/upper, idle/front) | 0 / 0 | 0.925 / 0.919 / 0.929 |
| grunt_b | 44.9 % (hips/joggers) | 5 (torso/towel, dizzyR/side) | 0 / 0 | 0.920 / 0.925 / 0.925 |
| armed | 44.9 % (hips/joggers) | 1 (head/head, idle/front) | 0 / 0 | 0.926 / 0.918 / 0.920 |
| bruiser | 49.1 % (shR/upper) | 3 (head/shako, idle/front) | 0 / 0 | 0.913 / 0.897 / 0.902 |

**The game's real `mergeRig()`** (`kit/real_mergeRig.js`, the ZIP's copy, run on the HD rig):

| member | meshes + hulls before | merged meshes (solid + outline) | bones | draw calls + shadow calls | max vertex Δ merged vs parts (7 poses) | flash: unflashed px of rig px (flash 0.85) | animateGang moves merged tail | render diff px: interior / edge (of rig px) | farthest vertex from culling sphere centre, all sequences (pass: r = 2.6; info: ZIP kit r = 1.9) |
|---|---|---|---|---|---|---|---|---|---|
| grunt_a | 32 + 23 | 3 (2 + 1) | 16 | 3 + 2 | 0.000 mm | 0 of 7377 | 1.9 cm (88 verts) | 1 / 47 (of 9052) | 2.15 m (outside 1.9) |
| grunt_b | 31 + 22 | 3 (2 + 1) | 16 | 3 + 2 | 0.000 mm | 0 of 7136 | 1.9 cm (88 verts) | 0 / 33 (of 8757) | 2.15 m (outside 1.9) |
| armed | 32 + 23 | 3 (2 + 1) | 17 | 3 + 2 | 0.000 mm | 0 of 7717 | 1.9 cm (88 verts) | 0 / 23 (of 9426) | 2.44 m (outside 1.9) |
| bruiser | 33 + 24 | 3 (2 + 1) | 16 | 3 + 2 | 0.000 mm | 0 of 12945 | 2.3 cm (88 verts) | 0 / 0 (of 15428) | 2.17 m (outside 1.9) |

**Idle reach and determinism** (reach = farthest non-hull vertex from the root's vertical axis over idle t = 0 .. 2 s at 15 fps, weapon excepted, minus META.radius; hash = every part's world vertices, colours and joint transforms after `idle(0)`):

| member | META.radius | farthest reach (part) | beyond radius (limit 0.35 m) | hash seed 7 (twice) | HD and LOD same seed → same hash | seed 8 hash (differs) |
|---|---|---|---|---|---|---|
| grunt_a | 0.42 m | 0.614 m (haL/paw, t = 0.00 s) | 0.194 m | `aa9a0293` | yes | `60445ac3` (yes) |
| grunt_b | 0.42 m | 0.614 m (haL/paw, t = 0.00 s) | 0.194 m | `18e9c843` | yes | `c739e8f3` (yes) |
| armed | 0.42 m | 0.622 m (haR/paw, t = 0.00 s) | 0.202 m | `09195e37` | yes | `9cb86f97` (yes) |
| bruiser | 0.55 m | 0.760 m (haL/paw, t = 0.00 s) | 0.210 m | `7beeb0bf` | yes | `3ecad89f` (yes) |

Per-member pass flags (caps, margins, ground, shoulders, stray hulls, shadows, flash, hulls, merge, height, feet): grunt_a: PASS, grunt_b: PASS, armed: PASS, bruiser: PASS

## Culling sphere

`mergeRig()`'s culling sphere is centred at (0, 0.95, 0). QA checks it as a pass flag at **r = 2.6**, the fixed game's radius.

The ZIP's `kit/real_mergeRig.js` predates that fix and still says 1.9, so reach against 1.9 is reported for information only.

Farthest vertex from the centre over all sequences: grunt_a 2.15 m, grunt_b 2.15 m, armed 2.44 m, bruiser 2.17 m. Every rig is inside 2.6 (pass). Against the ZIP's 1.9, for information: grunt_a outside by 25.1 cm, grunt_b outside by 25.1 cm, armed outside by 53.7 cm, bruiser outside by 27.1 cm.

## Known issues (with sizes)

- **Platform:** tested only in headless Chromium with SwiftShader, with 0 console errors or warnings across all 83 jobs. It has not been run on iOS Safari or an iPhone.
- **Margins:** HD is 31–33 parts and 9,140–9,752 tris. LOD is 11–12 parts and 1,592–1,704 tris.
- **Lowest vertex (any QA sequence, feet and weapon exempt only in `down`):** HD −1.0 cm, LOD −1.3 cm. The floor is −3 cm, and the LOD target is −2 cm.
- **Buried parts:** the most buried part is shR/upper on bruiser at 49.1 % (limit 55 %).
- **Stray ink:** the worst is 5 px (torso/towel on grunt_b) against the 12 px limit; the QA ran at 8 px. This covers idle and both dizzy extremes. The 6 m distance and the pixel thresholds are mine, not the game's.
- **Idle reach:** the farthest is 21.0 cm beyond META.radius (haL/paw on bruiser), against the 35 cm limit.
- **Dizzy stars:** the closest approach is 27.9 cm below the sprite (head/plume on bruiser).
- **LOD silhouette:** IoU against HD is 0.897–0.929.
- **Merged vs parts render:** 0–1 interior pixels differ out of 8,757–15,428 rig pixels. Another 0–47 pixels differ only along outline edges.
- **Bruiser sash look:** the sash is a tilted ring around the vest rather than a chest-to-hip diagonal, so it reads as a wide sash-belt. Its tube is stretched to the vest's ellipse, so it is wider than it is thick.
- **Real viewer, merged `seq.minY`:** `kit/real_viewer.html` skips skinned meshes in `seq.minY`, so its merged jobs report no value. The QA's merged-vs-parts vertex check (max Δ in the mergeRig table) covers merged geometry instead.
- **Not modelled:** the attack's forward lunge, by agreement (the game handles root motion).

## Otter Check 410

- `src/gang_key_hwy_otters.js` line 2 is the brief's canary.
- `kit/` is byte-identical to the round-2 ZIP: sha256 of all 10 files in `kit/` and `harness/` match the ZIP (`kit/toadcity_kit.js` 9436da2ab12f…).
- QA verdict on this build: ALL PASS (zip (kit/toadcity_kit.js + kit/real_mergeRig.js); 0 console errors or warnings in 83 jobs).
