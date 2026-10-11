# Toad City Baltimore: Task C, gang 1 of 5: Harbor Rats

This is the first of the five Task C district gangs, built per the outside-AI brief (one gang per session). The brief says each delivery is self-tested in `viewer.html`.

| id | Gang | Animal | District | Accent |
|---|---|---|---|---|
| `harbor_rats` | Harbor Rats | Norway rats | North shore: Harborplace, USS Constellation, World Trade Center, Washington Monument | mustard `#ffd23c` + navy |

## What's here

```
src/gang_harbor_rats.js   the delivery: exports GANG, META, buildHarborRat(K, member, opts), animateGang(J, t, state)
toadcity_kit.js           the kit (REBUILT from the brief's appendix; see "Kit note" below)
example_gull_thug.js      the brief's character-interface example (used by the viewer for comparison)
viewer.html               test bench: ?show=harbor_rats | harbor_rats.<member> | gull_lookout | thug
previews/                 day/night turnarounds, pose sheets, lineup, LOD, hit-flash, 390x844 phone views
tools/shoot.mjs           headless self-test: renders previews, collects console errors and the budget report
tools/previews_harbor_rats.json   the exact preview jobs used for this delivery
LICENSES.md
dist/toadcity_taskC_harbor_rats_v2.zip   everything above, including tools/ (the v1 zip left tools/ out)
```

## How to view

```sh
python3 -m http.server 8000
# open http://localhost:8000/viewer.html?show=harbor_rats
```

- **Query parameters:**
  - `show=harbor_rats.<member>` shows one member.
  - `night=1`, `lod=1`, `pose=idle|run|windup|attack|hurt|down|getup|all` and `turn=1` (front, ¾, side and back views) change what is shown.
  - `cam=three|front|side|back|phone`, with `dist=<m>` for the phone camera, sets the camera.
  - `t=<s>` freezes time, `flash=0.85` turns on the hit-flash, `anim=0` skips `animateGang` and `ui=0` hides the readout.
- **Keys:** N toggles night, P cycles poses, L toggles LOD, F toggles the hit-flash, A toggles `animateGang` and C cycles camera presets.
- **Readout (top left):** draw calls and triangles for the whole frame, including the shadow pass. For each rig it also shows parts, triangles, hull triangles, materials, height and whether the hit-flash uniforms are shared. Over-budget numbers turn red.
- **Headless re-run:** `npm i playwright-core three@0.160.0` somewhere on `NODE_PATH`, then run `node tools/shoot.mjs --batch tools/previews_harbor_rats.json`. The script uses Chromium with SwiftShader, serves three.js r160 from the local npm copy, and exits non-zero on any console error or warning.

## The gang

All four members share one uniform motif, so you can tell the district at a glance: a **navy top**, a **mustard neckerchief** (a torus collar with a diamond knot on the chest) and a **mustard life ring** on the back. Every member is an anthropomorphic Norway rat with these features:
- a long tapered snout
- a pink nose
- a buck tooth
- big round ears with pink insides
- ink whiskers
- a mean ink brow
- pink paws and feet
- a three-segment pink tail

| member | look (silhouette hook) | weapon |
|---|---|---|
| `grunt_a` | Navy watch cap with mustard cuff, full navy jacket, toothpick, blue-grey jeans. Mid brown-grey fur. | none |
| `grunt_b` | Navy flat cap pulled low, rolled hood, sleeves rolled to the fur, one droopy chewed ear. Dark fur. | none |
| `armed` | Eyepatch with strap, navy short sleeves. Light grey fur. | **broken rowboat oar** (wooden shaft, cream blade with a mustard gang-paint band), built along +Y in `J.swR = K.grp(J.haR, 0, -0.04, 0)` |
| `bruiser` | Wide body (×1.28 torso), sleeveless navy vest, big furry shoulders and arms, mustard do-rag, gold earring, one gold tooth, squinting slit eyes. `big: true`; the game scales it ×1.2 and gives it double HP. | none |

### Rig

- **Skeleton:** `K.skeleton()` with its own `d` (`HR_D`), which has the same keys as `K.THUG_D`: hip 0.88, slightly shorter legs, lower neck and the head pushed forward for a hunch. Shoulder pivots sit at `shX` 0.27 (0.3 for the bruiser, whose wider torso and fur shoulder balls already close the gap), so the upper arm stays on the torso when the real `down` and `windup` poses raise the arms overhead. All 18 joint names are unchanged, so `K.THUG_POSES` drives the rigs as-is.
- **Extra groups:**
  - `J.tail > J.tail1 > J.tail2` (on the hips) hold the tail.
  - `J.earL` and `J.earR` (on the head) hold the ears.
  - The build sets their rest angles, so standing rigs look right if `animateGang` is never called.
- **`animateGang(J, t, state)` is REQUIRED every frame (after `applyPose`) whenever the rig uses the `down` pose.** The rest tail curls up behind the hips, so a rig lying on its back without it pushes the tail 0.66 m (bruiser 0.79 m) through the floor. With `state = 'down'` the whole tail lies flat toward the feet with a small side swish (lowest point +0.06 m grounded, +0.31 m mid-fall, real game poses). In every other state the tail flattens in step with how far `J.tilt` has the rig on its back, so the damped fall and getup blends stay above the floor too. For the standing states it is cosmetic (tail swish, ear twitches). It is safe to call on LOD rigs, which have no tail or ears. State mapping: see Integration notes.
- **Materials:** one `K.toonMat()` per rig, plus one canvas-mapped `K.toonMat({ map })` fur sub-material on the head, snout, belly and furry limbs. The sub-material shares the rig's `userData.flash` and `flashC`. Every hull is `K.OUT_CHAR`, added by `K.part()`. Parts thinner than about 4 cm (whiskers, eyes, pupils, brows, teeth, toothpick, eyepatch strap, inner ears, earring, the oar's paint band) use `outline: false` and `shadow: false`.
- **Fur map:** 256×256, drawn on a canvas once per kit instance from a fixed-seed LCG: fur strokes running down the sphere meridians over soft mottling. It is light and neutral, and the vertex colour tints it, so all four rats share one texture. Its cache is the module-level `HR_FUR` WeakMap keyed on a stable shared kit object (`K.QUAL || K.THREE || K`), so a per-spawn wrapper such as `{ ...K }` reuses the same texture. A build without `document` gets no map and nothing is cached, so the next build with a DOM draws it.
- **Determinism:** no `Math.random()`. `opts.seed` drives a 16807 LCG that varies the whisker angle and tail curl slightly. `opts.colors` overrides any colour key.

## Measured budget (headless Chromium, three.js r160, HD, idle pose)

Parts are visible meshes, not counting hulls. Tris are geometry triangles of those meshes. Hull triangles are listed separately; they are the same geometry drawn again by `OUT_CHAR`. This counting convention reproduces the brief's reference figures: the gull example measures 26 parts and 8.5k tris here, and the brief quotes 26–33 parts and 7.6k–8.5k tris for the current thug.

| member | parts (≤ 40) | tris (≤ 12k) | hull tris | materials (≤ 3) | LOD 1 parts (≤ 14) | LOD 1 tris (≤ 3k) | LOD 1 mats | height (m) | feet min y |
|---|---|---|---|---|---|---|---|---|---|
| grunt_a | 40 | 11,220 | 9,408 | 3 | 14 | 1,760 | 2 | 1.97 | −0.002 |
| grunt_b | 40 | 11,572 | 9,816 | 3 | 14 | 1,760 | 2 | 1.97 | −0.002 |
| armed   | 40 | 10,588 | 9,024 | 3 | 14 | 1,376 | 2 | 1.97 | −0.002 |
| bruiser | 40 | 10,544 | 10,144 | 3 | 14 | 1,760 | 2 | 2.36 (×1.2 scale) | −0.002 |

Heights are measured in idle at t = 0 (the viewer's readout). They are 2 cm taller than v1 (1.95 / 2.34) because the ears moved up to clear the hats; the ears are now the top of every rat. LOD 1 heights are 1.93 (armed 1.96, bruiser 2.32), and LOD 1 shins sit 0.03 m below y = 0 in idle, as in v1.

- The 3 materials are the toon material, the fur sub-material and `OUT_CHAR`. LOD 1 has no map, so it uses 2.
- **Draw calls, whole frame including the shadow pass:**
  - All four HD rats with the ground: 379 draw calls and 116.8k tris.
  - All four LOD 1 rats: 161 draw calls and 19.5k tris.
  - Per HD rat that is 40 meshes + 28–29 hulls + 25–28 shadow casters (grunt_a 28 / 25, grunt_b 29 / 26, armed 28 / 25, bruiser 29 / 28). Unmerged, that is about 95 draw calls per rat; run through the game's `mergeRig()` it is 3 (fur mesh, toon mesh, outline) plus 2 in the shadow pass. See Integration notes.
  - Beyond 24 m the game hides hulls and stops shadow casting (`rigLod` in `06_game.js`). It does **not** swap to LOD 1; see Integration notes.
- **Checks that pass for all four, at both LODs:**
  - The hit-flash shares uniforms (`J.mat.userData.flash.value = 0.85` turns the whole rig white, fur included; see `previews/harbor_rats_hitflash.png`).
  - Every hull is `K.OUT_CHAR`.
  - The rig faces +Z.
  - There are zero console errors or warnings in every preview render.

## Far LOD (`opts.lod === 1`)

The far LOD keeps the same skeleton and the same `J.swR` for the armed rat. It has 14 parts with no map and no fine detail:
- hips and torso (the bruiser keeps its HD ×1.28 width and ×1.22 depth)
- a mustard neckerchief diamond on every member (the gang colour at distance)
- a tapered egg head that includes the snout
- two ears
- cylinder limbs, with navy forearms where the HD sleeves are navy (grunt_a)

There are no hands, feet or tail, and `animateGang` skips the missing groups. The armed rat drops the hips sphere (the torso and legs cover it at distance) to make room for a single-plank oar, so he keeps the neckerchief.

## Kit note (please read)

**`toadcity_starter_kit.zip` was not supplied with this brief.** `toadcity_kit.js` was therefore rebuilt from the brief's appendix, as the brief allows ("If the files did not come with this brief, rebuild them from the appendix"). It is not byte-identical to the in-house kit.

- **Copied verbatim from the appendix:** everything printed there. That covers `toonMat`, `basicMat`, `outlineMat` and the three `OUT_*` materials, `addOdir`, `bakeColor`, `lowTex`, `G`, `part`, `grp`, `skeleton`, `HERO_D`, `THUG_D`, `JOINTS`, `blank`, `legsStance`, `runLegs`, `SWF`, `THUG_POSES` and `applyPose`.
- **Stand-ins for the sections the appendix omits, each tagged `[reconstructed]`:**
  - `HERO_POSES` (only `down`, plus a basic idle and run). `THUG_POSES.down` calls `HERO_POSES.down`, so the **`down` pose in the previews uses a stand-in fall** onto the back.
  - `buildThug` (the real opening lines, plus guessed limbs). The viewer uses it only as the `thug` reference.
  - `LIGHT` and `applyLight` (values from the brief's night-lighting table).
  - `CITY_MAT`, `GLOW_MAT`, and a minimal `place`, `makeOut` and `makeAtlas`.
  - `buildHero` is not rebuilt.
- **What the module uses from `K`:** `G`, `part`, `grp`, `skeleton`, `toonMat`, `INK`, `lowTex` and `THREE` (`THREE` only when `lowTex` is missing). All of these are verbatim.
- **Before merging:** drop in the real kit and re-run the viewer. The likeliest difference is the real `HERO_POSES.down`.

## Known issues

- **Platforms:** tested only in headless Chromium (SwiftShader). It has not been run on iOS Safari or a real iPhone.
- **Lighting:** the viewer's night camera fill and lamp are my reading of the brief. The fill is a `#c8d0ff` point light at intensity 3.2 on the camera, and the lamp is a `#ffa050` light at 16 with a 15 m range. The game's own values may differ slightly. Under the lamp the mustard do-rag goes past the 1.35 ratio and shows unbanded, which matches the kit's "strong local light passes through" rule.
- **Snout normals:** the tapered snout keeps its sphere normals, so its shading stays smooth and the outline stays even. This is intentional.
- **Module-level state:** the module keeps a `WeakMap` (`HR_FUR`, keyed on `K.QUAL || K.THREE || K`) at module level so all rats share one fur texture. It is not a `window` global, but if the concatenated `game.js` forbids top-level state, move it into the kit's texture cache.
- **Tail clipping:** in v1 the tail went 0.5–0.8 m into the ground in the real `down` pose (0.66 m grunts, 0.79 m bruiser), with or without `animateGang`. It is fixed **only when `animateGang` runs every frame** (see Rig). Without it the tail still goes 0.66–0.79 m under the floor in `down`. With it, the measured lowest point is +0.06 m (bruiser +0.07 m) on the ground and +0.012 m at worst through a simulated hurt → down → getup → idle sequence with the game's damping and the knock-down hop, provided getup is mapped to `'idle'`. Mapping getup to `'down'` or `'hurt'` dips the tail 0.12–0.19 m under the floor for a few frames.
- **Weapon in `down`:** the armed rat's oar goes about 0.3 m into the ground in the real `down` pose, as the game's own pipe and bat thugs do (0.19–0.24 m). Not changed.
- **Ears and hats:** the ears now sit at x ±0.17, y 0.35, which clears the cuff and do-rag in the middle of the ear. The ear roots still enter the hat, by design, so the ears read as coming through holes in it.
- **Budget headroom:** HD part counts still sit exactly at the 40 cap (the review fixes added no parts). Any later addition needs a matching removal.

## Integration notes (for the in-house merge)

- **Call `animateGang(J, t, state)` every frame, after `applyPose`.** State mapping from the game's thug states: `down` and `dying` → `'down'`; `getup` → `'idle'` (the tilt-follow lifts the tail as the rig sits up); `chase` → `'run'`; `windup` → `'attack'`; `dizzy` → `'hurt'`; everything else by name. `drown` is untested.
- **No LOD swap in the game.** `rigLod` (`06_game.js`) only hides hulls and stops shadows beyond 24 m. Using `opts.lod === 1` means building both rigs per thug and swapping them with pose sync, which is new integration work.
- **Run every gang rig through `mergeRig()`** (`04b_rig_merge.js` only wraps `buildThug` and `buildHero`). Verified with the real `mergeRig`: 3 draw calls per HD rat (2 for LOD 1); the tail and ear groups become bones and still animate; the fur mesh keeps its UVs and the hit-flash still covers it. Collect `J.ol` / `J.sh` after the merge, as the game does.
- **Load gang files as separate ES modules.** Five files each exporting `GANG`, `META` and `animateGang` collide if concatenated into `game.js`. Integration also has to assemble `K` from the game's globals.

## Changes after the in-house review (2026-10-11)

- **Tail in `down`:** `animateGang` lays the tail flat in `down` and follows the rig's back-tilt in other states; it is now required whenever `down` is used.
- **Shoulder gap overhead:** `shX` 0.3 → 0.27 for grunt_a, grunt_b and armed (the 3 cm gap in the real `down` and `windup` poses is now under 1 cm). No part added.
- **Stray chest line:** it came from the neckerchief diamond's ink hull cutting through the belly, not from the whisker shadows. The diamond now sits 2 cm proud of the belly and is tilted to its slope (HD). Whiskers, the eyepatch strap and every `outline: false` part also stopped casting shadows.
- **Fur cache:** it is keyed on `K.QUAL || K.THREE || K`, and "no texture" is never cached.
- **LOD 1:** every member keeps the neckerchief (armed drops the hips sphere instead); grunt_a has navy forearms; the bruiser keeps its depth.
- **Ears:** moved up and out to clear the beanie cuff and do-rag.
- **Viewer:** `getup` now drives `animateGang` with `'idle'`.
- **Previews:** regenerated with `tools/shoot.mjs` (22 jobs, 0 console errors), and the zip rebuilt as v2.
