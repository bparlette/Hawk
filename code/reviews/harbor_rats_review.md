# Review: Harbor Rats gang (Toad City Baltimore, Task C, gang 1 of 5)

- **What was reviewed:** github `bparlette/hawk`, branch `claude/new-session-z5ikqq`, commit `bbad681`, cloned at `/workspace/work/reviews/hawk-hr`.
- **Compared against:** the real game in `/workspace/work/toad-city/game/src` (`01_core.js`, `04_actors.js`, `04b_rig_merge.js`, `06_game.js`) and the brief `/workspace/work/toad-city/handoff/prompts/TASK_C_thug_gangs.md`.
- **Review only:** nothing in the repo was changed (`git status` is clean). The repo's `previews/` were not overwritten. All scripts and renders are in `/workspace/work/reviews/scratch/`.

## Verdict: drop in after fixes (not a redo)

The module is clean, small (215 lines) and follows the house kit closely. The parts of the kit it relies on (`G`, `part`, `grp`, `skeleton`, `THUG_POSES`, `applyPose`, `JOINTS`) are byte-identical to the real `04_actors.js` (checked with `diff`).

I built every member at HD and LOD1 against two versions of the kit:
- the delivered kit;
- a harness made from the real game's code.

Both agree, and they match the README's budget table exactly. Builds are deterministic, there are no console errors, and the hit-flash reaches every material. The rigs also go through the real game's `mergeRig()` without errors: 3 draw calls per HD rat, and the tail and ear animation still works after the merge.

**What needs fixing:**
1. **Must fix:** the tail sinks 0.5–0.8 m into the ground in the `down` pose. The optional `animateGang` does not fix it either.
2. **Should fix:** the whisker shadows draw a stray ink line across every rat's chest.
3. **Can wait:** some small LOD and cache issues, and README corrections.

All of the fixes together are about 30–60 minutes of work.

**Against our own standard:** it is as good as a first pass we would write in-house, at Harold's level of construction (chunky primitives, a fur sub-map built like `WARTS`, and hit-flash shared across both materials). The gang reads as one gang by day and at night. It saves most of a session per gang, but the integration work below is still ours to do.

---

## Measured vs claimed budgets

Counting follows the brief and README: "parts" are meshes excluding hulls, and "tris" excludes hull triangles. Heights are measured in the idle pose at t=0. Node and headless Chromium give identical numbers.

| member | parts HD (≤40) measured / README | tris HD (≤12k) measured / README | hull tris measured / README | mats HD (≤3) | LOD1 parts (≤14) | LOD1 tris (≤3k) | LOD1 mats | height m (measured) | feet min y HD |
|---|---|---|---|---|---|---|---|---|---|
| grunt_a | 40 / 40 | 11,220 / 11,220 | 9,408 / 9,408 | 3 / 3 | 14 / 14 | 1,760 / 1,760 | 2 / 2 | 1.947 (LOD 1.934) | −0.002 ✓ |
| grunt_b | 40 / 40 | 11,572 / 11,572 | 9,816 / 9,816 | 3 / 3 | 14 / 14 | 1,760 / 1,760 | 2 / 2 | 1.947 (LOD 1.934) | −0.002 ✓ |
| armed | 40 / 40 | 10,588 / 10,588 | 9,024 / 9,024 | 3 / 3 | 14 / 14 | 1,760 / 1,760 | 2 / 2 | 1.947 (README 1.96; oar tip 1.973 at t=0.5) | −0.002 ✓ |
| bruiser (×1.2) | 40 / 40 | 10,544 / 10,544 | 10,144 / 10,144 | 3 / 3 | 14 / 14 | 1,760 / 1,760 | 2 / 2 | 2.337 = 1.948 × 1.2 (LOD 2.321) | −0.002 ✓ |
| *current real thugs (reference)* | 26–33 | 7,584–8,544 | 7,016–7,976 | 2 | — | — | — | — | — |

- **All within budget**, but every HD member sits exactly at the 40-part cap, so there is no headroom.
- **Real cost after the merge:**
  - 3 draw calls per HD rat (fur mesh, toon mesh, outline), plus 2 for the shadow pass. The current thugs take 2.
  - About 20–21k triangles per rat including hulls, against 15–16k for the current thugs (+33%). With 31 thugs that is about 640k triangles plus the shadow pass, so it is worth a phone frame-time check.
- **Whole frame in the viewer:**
  - 4 HD rats: 388 draw calls and 117.0k tris, which matches the README.
  - 4 LOD1 rats: 161 calls and 20.7k tris, which also matches.
  - 4 merged HD rats: 21 calls.
- **README per-rat breakdown is off:** it says "about 34 hulls + about 23 shadow casters". Measured is 28–29 hulls and 27–30 shadow casters. The totals are still right.

## Hard-rule checklist

| rule | result | evidence |
|---|---|---|
| 1. No imports; everything comes through K | **PASS** | `grep` finds no `import`. The module only uses `K.G`, `part`, `grp`, `skeleton`, `toonMat`, `INK`, `lowTex` and `THREE` (`THREE` only for `RepeatWrapping` and the `CanvasTexture` fallback). |
| 2. No `Math.random` at build time; seeded LCG only | **PASS** | There is no `Math.random` in the module. `opts.seed` goes through a 16807 LCG, normalised to [1, 2147483646], so seed 0, negative and huge seeds are all safe. The fur canvas uses a fixed seed (4242). About 50k `Math.random` calls did happen during my builds, but they come from three.js's own UUID generation (4 per Object3D, geometry or material; the stock thug does the same). |
| 3. No window, globals or DOM outside canvas texture drawing | **PASS** | `document` is used only in `hrFurTex` (`src/gang_harbor_rats.js:34-35`). There is one module-level `WeakMap` (see finding m3). |
| 4. Materials only from K; one toon material per rig; sub-material shares `flash` and `flashC` | **PASS** | One `toonMat()` per rig plus one mapped `toonMat({map})` (HD only), which shares the same `userData.flash` and `flashC` objects (`:78`). `flashBad = 0` on every member at both LODs, in both kits and after `mergeRig`. The renders `scratch/shots/real_merged_flash.png` and `harbor_rats_hitflash.png` show the whole rig, fur included, going white. The game mutates `flashC.value` in place (`06_game.js:239,268,424`), so the shared object follows. |
| 5. Exports `GANG`, `META`, `buildHarborRat(K, member, opts)` and the optional `animateGang` | **PASS** | `:5`, `:9`, `:66`, `:200`. `GANG` and `META` match the brief's interface exactly. An unknown member falls back to `grunt_a`. |
| 6. Budgets | **PASS** | See the table. |
| 7. Faces +Z, feet at y=0, height 1.9–2.0 m (bruiser ×1.2) | **PASS** | The snout tip is at z=+0.56 and the back of the head at −0.16. Feet min y is −0.002 in idle at t=0, and the viewer's measurement agrees. Heights are 1.947 m, and 2.337 m for the bruiser. Your 1.9–2.0 window is tighter than the brief's 1.8–2.2 m; it passes both. |
| 8. Original designs only | **PASS** | Generic navy and mustard (the brief's own accent), a life ring, an eyepatch and a broken oar. No logos, likenesses or real gang symbols. `LICENSES.md` is present. |
| Hulls are `K.OUT_CHAR`, and they are BackSide ShaderMaterial children | **PASS** | `badHull = 0` everywhere. Thin parts use `outline:false`. The game's distance-LOD traversal (`06_game.js:59`) finds the hulls, and after a merge it finds the merged outline instead. |
| Joint names and parents | **PASS** | All 18 skeleton joints are untouched (`HR_D` has the same keys as `THUG_D`, with hip 0.88). Extra groups: `J.head` on `J.neck`, `J.tail > tail1 > tail2` on `J.hips`, `J.earL`/`earR` on `J.head`, and `J.swR = K.grp(J.haR, 0, -0.04, 0)` for `armed` at both LODs (`:166`, `:192`). |
| LOD path never references groups it did not create | **PASS** | `hrLod` makes no tail or ears and does make `J.swR` for `armed`. `animateGang` guards `J.tail && J.tailBase` and each `J['ear'+k]`, so it ran on all LOD rigs with no errors. |
| Detached limbs in `K.THUG_POSES` | **PASS for HD stand poses; see finding m1 for `down`** | I checked the gap between every adjacent bone's part set by surface sampling, in all 7 poses with both the delivered and the real poses. HD shows no gaps above 2.5 cm except the shoulder (3 cm) when the arms go overhead in the real `down` pose and in `windup`. The oar passes through the hand in every pose. |
| Determinism | **PASS** | See below. |
| Console errors | **PASS: 0** | See below. |

## Determinism result: PASS

I hashed every Object3D (type, parent, position, rotation) and every mesh's position, colour and normal buffers, plus the material kind and `J.tailBase`.

- **Same seed, all 8 member/LOD combinations, in both the delivered and the real kit:** the hashes are identical when built twice. Between the two builds I ran other members, other seeds and a 15 ms wall-clock wait, so call order and time have no effect.
- **Seed 7 vs seed 8:** HD differs (whisker angle and tail curl). LOD1 is identical, which is expected because LOD uses no random values.
- **Missing, negative and huge seeds:** all build fine.
- **Fur canvas:** the stroke log (6,963 canvas calls) is identical across two fresh kit objects. The same K reuses the cached texture, and two rats on one K share a single `Texture`.

## Console-error result: 0 errors, 0 warnings

I ran the repo's own `tools/shoot.mjs` (unmodified) against all 22 jobs in `tools/previews_harbor_rats.json`. Outputs were redirected to `scratch/shots/` and the jobs were split into 3 batches because of the sandbox's 2-minute limit. I also ran 6 extra views:
- the default `viewer.html?show=harbor_rats`;
- an LOD1 lineup;
- the `thug` and `gull_lookout` references;
- the armed rat's LOD poses;
- the bruiser's poses from the side.

All 28 reported `ok`. The run used three r160 and Chromium 1134 with SwiftShader.

I also ran 12 more renders in `scratch/viewer_real.html`, a copy of the viewer with the **real game's poses and real `mergeRig`** swapped in. They also produced 0 errors.

---

## Findings, ranked by severity

### Real bugs

**M1 (Major): the tail goes 0.5–0.8 m into the ground in the `down` pose, and `animateGang` does not fix it**
- **Where:** `src/gang_harbor_rats.js:158-159` (rest curl) and `:203-207` (the `down` branch of `animateGang`).
- **What goes wrong:**
  - The rest tail curls backward and up. Its cumulative X rotation is about 1.95 rad, from `tailBase` = [0.75–0.85, 0.65, 0.55–0.7].
  - When the rig falls onto its back (the real `HERO_POSES.down` has tilt −π/2+0.08 and ty 0.2), everything behind the body ends up below the floor.
  - **Measured with the real pose:** the tail's lowest point is −0.67 m for the grunts and −0.80 m for the bruiser. With `animateGang(…, 'down')` it is still −0.52 m and −0.62 m, because only the base gets `lift −0.5` while `tail1` and `tail2` keep their curl.
  - On screen the tail stabs down through the pavement between the legs. You can see it in the repo's own `previews/harbor_rats_*_poses.png` "down" frames and in `scratch/shots/real_down_side_noanim.png`.
  - The real game currently never calls `animateGang`, so the brief's "must look fine if it is never called" requirement fails for `down`.
  - The README (line 122) calls this "can clip the ground slightly", which understates it.
- **Fix (verified numerically with the real pose):**
  - In `animateGang`, when `state === 'down'`, flatten the whole tail instead of only lifting the base: `J.tail.rotation.set(-0.15, Math.sin(t*f)*0.08, 0); J.tail1.rotation.set(0.1, 0, ...); J.tail2.rotation.set(0.15, 0, ...)`.
  - With that change the tail's lowest point is +0.054 m (grunt) and +0.065 m (bruiser) on the ground, and +0.30 m or higher mid-fall. The tail then lies flat toward the feet.
  - Integration must call `animateGang` every frame, at least for down, getup and drown. Document it in the README as required whenever the `down` pose is used, not optional.
  - If integration will not call it, the only static alternative is a tail that hangs mostly downward at rest (`tailBase` ≈ [0.2, 0.15, 0.1]). That loses the rat silhouette, so prefer the `animateGang` fix.

**m1 (Minor): 3 cm shoulder gap when the arms go overhead (real `down` pose, armed `windup`), on grunt_a, grunt_b and armed**
- **Where:** `:17` (`HR_D.shX: 0.3`) and `:143-144` (only the bruiser gets a shoulder ball).
- **What goes wrong:**
  - The shoulder pivot sits about 10 cm outside the torso ellipsoid's surface at shoulder height. The torso half-width at y 0.5 is about 0.20 against `shX` 0.30.
  - At rest the 8.2 cm upper-arm capsule overlaps the torso, but with `shL`/`shR` at −2.6 rad (the real `down` pose) or −2.9 rad (armed `windup`) a 2.8–3.1 cm gap opens.
  - The delivered previews hide this, because the stand-in `HERO_POSES.down` splays the arms sideways instead of raising them overhead.
  - Ink hulls (about 3 cm wide at 8 m) partly mask it.
- **Fix:** set `HR_D.shX` to 0.27, or add a 0.09 m navy shoulder sphere on `J.shL`/`J.shR`, as the bruiser has and the stock thug has (`04_actors.js:158`). The second option needs a part freed first; the bruiser's two half-teeth or the LOD-style merged ear are candidates. Re-check with `scratch/viewer_real.html?show=harbor_rats&pose=down`.

**m2 (Minor, visual, every daylight shot): whiskers cast shadows and draw a stray ink line across the chest and neckerchief**
- **Where:** `:105` (whiskers), and also `:133` (the eyepatch strap torus).
- **What goes wrong:**
  - `K.part` turns on `castShadow` when the bounding radius is above 0.1. The 0.5 m whisker boxes have a radius of 0.25, so they cast shadows.
  - The result is a thin diagonal dark line across every rat's diamond knot and belly. You can see it in the repo's lineup and turnaround previews.
  - **Confirmed by A/B:** `scratch/shots/whisker_cmp.png` shows the line on the left and gone on the right with whisker shadows off.
  - In the game's 512 px BasicShadowMap these 9 mm casters would shimmer.
- **Fix:** pass `shadow: false` on the whiskers and the strap. As a rule, give every `outline:false` part `shadow:false`.

**m3 (Minor): the `HR_FUR` cache can lock in "no texture", and its key is fragile**
- **Where:** `:30-54`, especially `:32` and `:53`.
- **What goes wrong:**
  - If the first build for a given K happens without `document` (a worker, a test, SSR), `null` is cached, and that K never gets fur even after a DOM appears. Measured: 2 materials instead of 3 after `document` appears.
  - The cache is keyed on the K object's identity, so an integration that passes a fresh wrapper (`{...K, extra}`) per spawn redraws a 256² canvas and adds another texture to `QUAL.texs` for every rat.
  - In the intended use (one K for the whole game) it is safe, and the shared texture is fine because the game never disposes thug textures.
  - **On the top-level-state question:** it is module-level mutable state, but not a global. It is no worse than the game's own module-level `FLORAL`, `WARTS` and `CURLS` textures (`04_actors.js:34-55`), and it does not affect determinism.
- **Fix:** key on a stable shared object (`const key = K.QUAL || K.THREE || K`) and do not cache `null`. Better still, have integration expose a kit texture cache.

**m4 (Minor, LOD only): the LOD loses gang read and drifts from HD**
- **Where:** `:179-181`, `:187`.
- **What goes wrong:**
  - The `armed` LOD drops the mustard neckerchief diamond to make room for the oar, so at distance the armed rat loses the gang colour (the README admits this).
  - LOD forearms are always fur, but grunt_a's HD forearms are navy, so the colour pops when the LOD swaps.
  - LOD hips and torso ignore the bruiser's `sz` (1.22 depth).
  - Flat-ended LOD limb cylinders open 3–6 cm gaps at the shoulder in `down` and `hurt`.
  - LOD shins poke 3–5 cm below y=0 in hurt and getup. The stock thugs' feet do the same, so this one is cosmetic.
- **Fix:**
  - For `armed`, drop the LOD hips sphere instead of the diamond; at more than 24 m the torso and legs cover it.
  - Use `L.sleeves === 'navy' ? C.navy : C.fur` for the LOD forearm.
  - Multiply z by `sz` as HD does.

**m5 (Minor, visual): ears pass through the hats**
- **Where:** `:119-120` against `:125-127` (beanie and cuff) and `:134-135` (do-rag).
- **What goes wrong:** in side views the ear discs slice through the beanie cuff and the do-rag. See `previews/harbor_rats_grunt_a_day.png` and `harbor_rats_bruiser_day.png`, "side" panel.
- **Fix:** move the ears out to x ±0.17 and y 0.35, or shrink the cuff radius and lower the hats by 2–3 cm, so the ears read as "through holes".

### Not bugs in the delivery: integration work and README corrections

**I1: The real game has no LOD1 swap.**
- The README (line 84) and the brief say "the game swaps it in beyond 24 m".
- In fact `06_game.js:57-65` (`rigLod`) only hides hulls and stops shadow casting beyond 24 m.
- Using `opts.lod === 1` means building both rigs per thug and swapping them with pose sync. That is integration work and is not tested anywhere yet.

**I2: Gang rigs must be run through `mergeRig` explicitly.**
- `04b_rig_merge.js:87-91` wraps only `buildThug` and `buildHero`.
- Unmerged, each HD rat is about 40 meshes + 28 hulls + 28 shadow casters, roughly 96 draw calls. Times 31 thugs that is about 3,000 calls.
- Merged, it is 3 calls plus 2 for shadows. I verified in Node and in the browser that the merge succeeds: 20–21 bones, the tail and ears become bones and still animate, the fur mesh keeps its UVs, and the hit-flash works.
- Collect `J.ol` and `J.sh` after the merge, as `06_game.js:59` does.

**I3: Loading the modules.**
- The game builds by concatenating `src/0*.js` into one module (`build.sh`).
- Five gang files each exporting `GANG`, `META` and `animateGang` would collide if concatenated, so load them as separate ES modules.
- Integration also has to assemble a `K` object from the game's globals, since there is no `K` in the game today.

**I4: State mapping for `animateGang`.**
- It only knows idle, run, attack, hurt and down. Unknown states fall back to idle values.
- The game's states also include chase, windup, dizzy, getup, drown and dead. Map them: chase→run, windup→attack, dizzy→hurt, and getup/drown→down. For getup, also see M1.

**I5: Kit fidelity.**
- **Identical to the real game:**
  - Everything the module calls (`G`, `part`, `grp`, `skeleton`, `THUG_D`, `JOINTS`, `blank`, `legsStance`, `runLegs`, `THUG_POSES`, `applyPose`).
  - The outline shader.
  - `addOdir`.
- **Different from the real game:**
  - `toonMat`: the game adds vertex snap, the `uToon` switch and a `tiled` variant, and uses cache key `'psx'` rather than `'psx'+'M'`. In HD the result is the same. A mapped sub-material without its own cache key is fine, because three r160 already separates programs on the `map` flag.
  - `lowTex`: the game downsamples to 128 px and uses nearest filtering in 32-bit mode, then switches to the 256 px source in HD. That works for the fur map.
  - **`HERO_POSES.down` stand-in:** this is the one difference that matters. The real pose raises the arms overhead, which is what exposed m1.
  - **`buildThug` stand-in:** 23 parts, against 26–33 for the real thugs.

**README corrections:**
- **Line 84:** it should say 28–29 hulls and 27–30 shadow casters, not "about 34 + about 23", and drop "swaps to LOD there".
- **Line 122:** describe the tail clipping honestly; it is 0.5–0.8 m, not "slightly".
- **Line 77:** the armed height its own viewer reports is 1.95, not 1.96.
- **Line 17:** `tools/` is listed in "What's here" but is not in `dist/…v1.zip`. Every other file in the zip is byte-identical to the repo.

### Style nits
- **`:142-145`:** sleeve material is chosen by comparing colour values (`upCol === C.fur`). If `opts.colors` makes navy equal fur, the material flips. Branch on `L.sleeves` instead.
- **`:79-80`, `:122`:** three ways of saying "use the fur material" (the `fur` object, `FO()` and an inline `{mat: furMat}`). Pick one.
- **Zero part headroom (40/40):** any addition, including the shoulder fix, needs a matching removal. Candidates: combine the bruiser's two half-teeth into one box with two colours (vertex colours by face), or drop the separate pink inner ear in favour of a darker inner ring on the same disc.
- **Readability:** the snout's taper reads short from the front, and the mustard beanie cuff reads more like a headband. The flat cap, eyepatch and do-rag read well.
- **LOD head:** the tapered egg looks like a flat puck from three-quarter view. Acceptable beyond 24 m.
- **`hrTaper` keeps sphere normals:** this is intentional and documented, and it is fine.

## Visual quality against the game's HD style

- **Construction:** it matches the house look: chunky primitives, vertex colours on the three-band cel ramp, constant-width ink hulls and a neutral canvas fur map tinted by vertex colour. That is the same approach as Harold's `WARTS` skin.
- **Gang read:** the navy top, mustard neckerchief and back life ring read as one gang at 8 m on 390×844, by day and at night (`previews/harbor_rats_phone_390x844*.png`). Each member has a distinct hook:
  - grunt_a: the beanie;
  - grunt_b: the flat cap and the droopy ear;
  - armed: the eyepatch and the oar;
  - bruiser: the bulk and the do-rag.
- **Detail level:** a clear step above the current plain thugs, and in the same family as Harold and Mavis (compared with `/workspace/work/toad-city/assets_preview/phase1_compare_day_night_desktop_phone.jpg`).
- **Weak points:** the whisker-shadow line (m2), ears through the hats (m5), the tail in `down` (M1), and the LOD silhouettes being near-identical apart from colour.

## Files

- **Review (this file):** `/workspace/work/reviews/harbor_rats_review.md`.
- **Scratch harness (review-only, outside the repo), in `/workspace/work/reviews/scratch/`:**
  - `realK.mjs`: the real game's `01_core`/`04_actors`/`04b_rig_merge` code extracted verbatim, for Node.
  - `kitReview.mjs`: the delivered kit, re-pointed at three r160.
  - `fakedom.mjs`: a canvas stub that logs every call.
  - `measure.mjs`, which writes `results.json`: budgets, pose and ground checks, limb gaps, `mergeRig`, determinism.
  - `tailfix.mjs`: verifies the M1 fix and lists the thin shadow casters.
  - `kitreal_browser.js` and `viewer_real.html`: the viewer with the real poses and an optional `&merge=1` (real `mergeRig`).
  - `shoot2.mjs`.
  - Job files: `jobs*.json`.
  - Renders: `shots/*.png`.
  - Shoot reports: `shoot_report*.json`.
- **To re-run the browser shots:** `. /workspace/work/toad-city/game/env.sh`, then:
  ```
  THREE_FILE=/workspace/work/toad-city/game/site/three.module.min.js \
  CHROME=/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome \
  NODE_PATH=/workspace/work/trailer_v2/node_modules \
  node <shoot.mjs|shoot2.mjs> --batch <jobs.json>
  ```
