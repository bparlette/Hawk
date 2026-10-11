# Toad City Baltimore: Task C, gang 1 of 5: Harbor Rats

> **Status (after gang 2):** this is the v1 delivery, and it has **not** been retrofitted to the gang-2+ rules.
>
> Since v1, `toadcity_kit.js` uses the game's **real** `down` pose. That means the "Kit note" below, which describes a stand-in fall, and the `down` previews are out of date.
>
> Measured under the gang-2+ QA (`qa/harbor_rats_report_newrules.json`):
> - the tail goes 66.0–79.2 cm below ground in `down`
> - shoulder gaps are 2.9–3.1 cm in `down` (armed windup 2.8 cm)
> - 40/40 parts
> - shadow-rule violations

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

- **Skeleton:** `K.skeleton()` with its own `d` (`HR_D`), which has the same keys as `K.THUG_D`: hip 0.88, slightly shorter legs, lower neck and the head pushed forward for a hunch. All 18 joint names are unchanged, so `K.THUG_POSES` drives the rigs as-is.
- **Extra groups:**
  - `J.tail > J.tail1 > J.tail2` (on the hips) hold the tail.
  - `J.earL` and `J.earR` (on the head) hold the ears.
  - The build sets their rest angles, so the rigs look right if `animateGang` is never called.
- **`animateGang(J, t, state)`** is optional. It swishes the tail (fast when running, stiff when hurt, flat when down) and twitches the ears now and then. It is safe to call on LOD rigs, which have no tail or ears.
- **Materials:** one `K.toonMat()` per rig, plus one canvas-mapped `K.toonMat({ map })` fur sub-material on the head, snout, belly and furry limbs. The sub-material shares the rig's `userData.flash` and `flashC`. Every hull is `K.OUT_CHAR`, added by `K.part()`. Parts thinner than about 4 cm (whiskers, eyes, pupils, brows, teeth, toothpick, eyepatch strap, inner ears, earring, the oar's paint band) use `outline: false`.
- **Fur map:** 256×256, drawn on a canvas once per kit instance from a fixed-seed LCG: fur strokes running down the sphere meridians over soft mottling. It is light and neutral, and the vertex colour tints it, so all four rats share one texture. Its cache is the module-level `HR_FUR` WeakMap keyed on `K`.
- **Determinism:** no `Math.random()`. `opts.seed` drives a 16807 LCG that varies the whisker angle and tail curl slightly. `opts.colors` overrides any colour key.

## Measured budget (headless Chromium, three.js r160, HD, idle pose)

Parts are visible meshes, not counting hulls. Tris are geometry triangles of those meshes. Hull triangles are listed separately; they are the same geometry drawn again by `OUT_CHAR`. This counting convention reproduces the brief's reference figures: the gull example measures 26 parts and 8.5k tris here, and the brief quotes 26–33 parts and 7.6k–8.5k tris for the current thug.

| member | parts (≤ 40) | tris (≤ 12k) | hull tris | materials (≤ 3) | LOD 1 parts (≤ 14) | LOD 1 tris (≤ 3k) | LOD 1 mats | height (m) | feet min y |
|---|---|---|---|---|---|---|---|---|---|
| grunt_a | 40 | 11,220 | 9,408 | 3 | 14 | 1,760 | 2 | 1.95 | −0.002 |
| grunt_b | 40 | 11,572 | 9,816 | 3 | 14 | 1,760 | 2 | 1.95 | −0.002 |
| armed   | 40 | 10,588 | 9,024 | 3 | 14 | 1,760 | 2 | 1.96 (oar up) | −0.002 |
| bruiser | 40 | 10,544 | 10,144 | 3 | 14 | 1,760 | 2 | 2.34 (×1.2 scale) | −0.002 |

- The 3 materials are the toon material, the fur sub-material and `OUT_CHAR`. LOD 1 has no map, so it uses 2.
- **Draw calls, whole frame including the shadow pass:**
  - All four HD rats with the ground: 388 draw calls and 117k tris.
  - All four LOD 1 rats: 161 draw calls and 20.7k tris.
  - Per HD rat that is roughly 40 meshes + about 34 hulls + about 23 shadow casters. The game already drops hulls beyond 24 m and swaps to LOD there.
- **Checks that pass for all four, at both LODs:**
  - The hit-flash shares uniforms (`J.mat.userData.flash.value = 0.85` turns the whole rig white, fur included; see `previews/harbor_rats_hitflash.png`).
  - Every hull is `K.OUT_CHAR`.
  - The rig faces +Z.
  - There are zero console errors or warnings in every preview render.

## Far LOD (`opts.lod === 1`)

The far LOD keeps the same skeleton and the same `J.swR` for the armed rat. It has 14 parts with no map and no fine detail:
- hips and torso
- a mustard neckerchief diamond (the gang colour at distance)
- a tapered egg head that includes the snout
- two ears
- cylinder limbs

There are no hands, feet or tail, and `animateGang` skips the missing groups. The armed rat swaps the neckerchief slot for a single-plank oar.

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
- **Module-level state:** the module keeps a `WeakMap` (`HR_FUR`) at module level so all rats share one fur texture. It is not a `window` global, but if the concatenated `game.js` forbids top-level state, move it into the kit's texture cache.
- **Tail clipping:** in the stand-in `down` pose the tail lies flat behind the rig and can clip the ground slightly.
- **Budget headroom:** HD part counts sit exactly at the 40 cap. Any later additions need a matching removal.
