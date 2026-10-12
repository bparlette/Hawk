QA-REPORT G1 oar-band

# G1 · Independent QA of Harbor Rats v2 (Hark's fix, `hark/harbor-rats-fixes` 751c21b)
Reviewer: Grok Bot, via relay P-004. Method: `content/g3_qa_template.md` (TEMPLATE v2, FAM-1 gangs). Kit source: `Toad_City_Round2_GEMINI.zip` from the G1 surge page, unzipped to `/workspace/g1/`.

## Step 0 · Comprehension check

### 1. ZIP files (105 files; listed by group, every path is real)
- `README_ZIP.md`: the index. I used it to confirm the layout.
- `package.json`: installs three 0.160.0 for the Node harness. I used it with `npm i`.
- `qa/QA_GEMINI_PRO_review_prompt.md`: the gates, the rubric and the output format. I used it to score.
- `kit/toadcity_kit.js` (sha256 `9436da2a…77580880`), `kit/real_poses_04_actors.js`, `kit/real_mergeRig.js`: the real kit, the real poses and the real mergeRig. My headless harness runs on them.
- `kit/example_bench.js`, `kit/example_gull_thug.js`, `kit/viewer.html`, `kit/real_viewer.html`: examples and viewers. Reference only; I did not run the browser viewers.
- `briefs/TASK_C_thug_gangs.md`, `briefs/TASK_C_review_lessons.md`: what v2 is judged against. `briefs/TASK_A_rowhouse_city_block_kit.md` and `briefs/TASK_B_street_props_vehicles.md` are out of scope for G1.
- `reference/harbor_rats/gang_harbor_rats_v2_FIXED.js`, `gang_harbor_rats_v1_bbad681.js`, `harbor_rats_v1_to_v2.diff`, `README_harbor_rats_v2.md`: the module under review, v1, the diff, and the README under review.
- `previews/harbor_rats/v2_delivery/*.png` (18 files) and `previews/harbor_rats/before_after/*.png` (36 files): named-image evidence for style, night and the fixes.
- `reference/taskAB_v1/*` (10 files), `reference/taskAB_fixed/*` (11 files), `previews/taskAB/*.png` (2 files): Task A/B material. Not used here (that is G2).
- `reviews/harbor_rats_review.md`, `reviews/sonnet_taskAB_review.md`: Hark's reviews. I read the first one only after finishing my review, for Coverage vs Hark.
- `prompts/G1_qa-harbor-rats-v2.md`, `G2_qa-sonnet-taskab-fixed.md`, `G3_qa-standing-template.md`: session prompts. I used G1 as the brief.

### 2. Hard rules and §2 lessons, in my own words
1. I review and never rewrite whole files. Fixes are numbered, targeted and come with numbers.
2. I judge only against v2's own brief (Task C plus its lessons) and the lessons in G1.
3. Every claim cites file:line, a measured number or a named image. Anything else is marked UNVERIFIED, with the evidence needed.
4. I don't trust README numbers. I recompute parts, tris, materials and clearances from code.
5. Characters must be original: no real people, mascots, team marks or logos. Real Baltimore names are allowed only in environment pieces.
6. I use the real game facts in §3, not generic three.js assumptions.
7. I score with the QA_GEMINI_PRO rubric. PASS needs all 3 gates, a total of 75 or more, and no category at 0.
8. Blocker means a gate failure or crash, major means a checklist item missed, minor means polish.
9. I read Hark's review only at the end, then write Coverage vs Hark.
10. Markdown only, in §5 order.
11. Step 0 goes at the top, then the full job without waiting for GO.
- L-a (§2): a stand-in `down` pose hid the tail going 0.67 m through the floor, so I test with the real `down`.
- L-b (§2): single-asset previews at (0,0) yaw 0 hid pickup lights floating 7 m away, so I don't trust origin-only previews.
- L-c (§2): pavement laid outside the block hid 1.83 m stoop overhangs, so I check what the preview framing could hide.
- L-d (§2): a review that only reads the README and previews would have passed both, so I measure what the previews can't show.

### 3. Answers
- **Q1.** 0.67 m (§2). Task C lessons give 0.66 m grunts and 0.79 m bruiser; I measured 0.653 m and 0.783 m.
- **Q2.** Pavement laid outside the block.
- **Q3.** It only hides the ink hulls and stops shadow casting beyond 24 m. There is no LOD swap.
- **Q4.** 36 parts or fewer and 10,800 tris or fewer per gang member.
- **Q5.** Only after my own review is finished, to write the "Coverage vs Hark" section.

### 4. Canaries (each included exactly)
- Canary 1: "Report: the last heading, exactly: `## Rat Review Check 410`". Included as the last heading.
- Canary 2: "Report: the first line, exactly: `QA-REPORT G1 oar-band`". Included as line 1.
- Canary 3: "Report: the line right after the summary table, exactly: `Rubric version: tcr2-mustard-diamond`". Included.

Assumption (rule 11): the delivery's own `src/`, `LICENSES.md`, `tools/` and shipped `toadcity_kit.js` are not in this ZIP. I reviewed `reference/harbor_rats/gang_harbor_rats_v2_FIXED.js` as `src/gang_harbor_rats.js`. Items that need the missing files are marked UNVERIFIED.

## Evidence base (what I actually ran)
- **Headless Node harness** (`/workspace/g1/harness/h.mjs`, box only): three 0.160.0 with the **real** `kit/toadcity_kit.js` and the real `THUG_POSES` / `applyPose`. The canvas is stubbed, so the fur map texture object exists but has no pixels. It runs the real `kit/real_mergeRig.js`. The bruiser is scaled ×1.2 as the game does (`META.bruiser.scale`). Every vertex of every non-hull mesh is transformed to world space for min-y and bounding-box numbers.
- **Game sequence simulation at 60 fps:** hurt for 0.3 s, then the knock-down hop (vy 4.2, gravity 22, `down(u,false)` until landing, then `down(1,true)`, pose rate 13), switching to getup after 1.25 s (rate 14, 0.5 s), then idle. Run 4 ways: getup mapped to `'idle'`, `'down'` or `'hurt'`, and without `animateGang`.
- **Lint:** `node tools/tc_lint.mjs /workspace/g1/delivery` (v2 module copied to `src/gang_harbor_rats.js` plus the v2 README). Exit 1: **3 ERROR** (C11 at README.md:66, :87, :127) and **1 WARN** (C9 bare `META` at :9, allowed for gang modules).
- **No pixel renders of my own.** Chrome is on the box, but I did not build a WebGL harness. Visual scores rest on the shipped PNGs, which I name each time.

### Recomputed numbers (idle at t = 0, HD unless noted)
| member | parts | tris | hull tris | hulls | shadow casters | mats | height (m) | feet min y | tail min y, real `down(1,true)` no anim / anim | weapon min y in down |
|---|---|---|---|---|---|---|---|---|---|---|
| grunt_a | 40 | 11,220 | 9,408 | 28 | 25 | 3 | 1.966 | +0.002 | −0.653 / +0.059 | n/a |
| grunt_b | 40 | 11,572 | 9,816 | 29 | 26 | 3 | 1.966 | +0.002 | −0.653 / +0.059 | n/a |
| armed | 40 | 10,588 | 9,024 | 28 | 25 | 3 | 1.966 | +0.002 | −0.653 / +0.059 | −0.312 |
| bruiser (×1.2) | 40 | 10,544 | 10,144 | 29 | 28 | 3 | 2.359 | +0.003 | −0.783 / +0.071 | n/a |
| LOD 1 grunt_a / grunt_b / armed / bruiser | 14 / 14 / 14 / 14 | 1,760 / 1,760 / 1,376 / 1,760 | = tris | 14 each | 12 each | 2 | 1.905 / 1.905 / 1.931 / 2.286 | −0.023 / −0.023 / −0.023 / −0.027 (shins) | no tail | armed +0.825 idle |

- **Sequence, worst tail y:**
  - getup→`'idle'`: +0.016 (grunts) and +0.019 (bruiser), at getup frame 93.
  - getup→`'down'`: −0.119 / −0.143.
  - getup→`'hurt'`: −0.108 / −0.129.
  - No `animateGang`: −0.653 / −0.783.
  - Ears never below +0.426. Feet worst −0.026 / −0.032 (allowed exception).
- **Shoulder gap (vertex-sampled upper bound, m):**
  - `down(1,true)`: L/R 0.007/0.010 (grunts, armed) and 0.008/0.012 (bruiser).
  - `windup(0.6)` R: armed 0.006, bruiser 0.012, grunt_a/b 0.021.
- **mergeRig:** HD gives 3 merged meshes with 1 mapped sub-material. LOD 1 gives 2 with 0. `flash`/`flashC` are shared on all 8. The tail and ear groups are skeleton bones.
- **Hygiene:** thin (two dims < 4 cm) shadow casters: 0 on all 8 rigs. The diamond knot has 24 vertices: 0 inside the belly ellipsoid and 0 inside the torso ellipsoid, front at z 0.283.
- **Cache:** two `{...K}` wrapper builds added 0 textures to `QUAL.texs`.
- **Determinism:** grunt_a seed 1 gives −1339907882 twice; seed 2 gives 2067978544.

## Delivery: Harbor Rats v2 (751c21b, Task C gang 1) — overall PASS with notes (HD members); LOD set FAIL
| Asset id | Gates (I/B/O) | Style | Read | Night | Func | Code | Docs | Total | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| grunt_a | P / P / P | 21 | 16 | 12 | 15 | 8 | 5 | 77 | PASS with notes |
| grunt_b | P / P / P | 21 | 16 | 12 | 15 | 8 | 5 | 77 | PASS with notes |
| armed | P / P / P | 21 | 17 | 12 | 13 | 8 | 5 | 76 | PASS with notes |
| bruiser | P / P / P | 21 | 17 | 12 | 14 | 8 | 5 | 77 | PASS with notes |
| LOD 1 set (4 members) | P / P / P | 17 | 12 | 11 | 16 | 8 | 4 | 68 | FAIL |
Rubric version: tcr2-mustard-diamond

Gate notes:
- **I:** the module uses only `K`, has no imports and no own materials, and every export (`GANG`, `META`, `buildHarborRat`, `animateGang`) exists. The delivery's shipped kit hash is UNVERIFIED (see U1).
- **B:** passes against the Task C caps (40 parts, 12k tris, 3 mats; LOD 14 parts, 3k tris), but fails the round-2 headroom in G1 §3 and lesson 6 (finding 1).
- **O:** original rats, with no logos or marks on clothing in `harbor_rats_lineup_day.png`. LICENSES.md is UNVERIFIED (U2).
- **Style/Read/Night** are scored from `v2_delivery/harbor_rats_lineup_day.png`, `_lineup_night.png`, `_phone_390x844*.png` and `_lod1_day.png`.

### All HD members — PASS with notes
1. [major] gang_harbor_rats_v2_FIXED.js:72-176 — HD part count is 40/40 for all 4 members (measured). Round 2 asks for 36 or fewer (G1 §3) and lesson 6 asks for 37 or fewer. Tris are 11,220 (grunt_a) and 11,572 (grunt_b), over the 10,800 headroom target; armed (10,588) and bruiser (10,544) pass. → Remove 4 parts per member:
   - (a) hips sphere :91, which the torso and legs hide, as LOD already does;
   - (b) merge the 2 whisker boxes :111 into one 0.5 × 0.009 × 0.009 box per side pair, or drop to 1;
   - (c) drop the inner-ear discs :129 (2 parts) and darken the ear rim instead.
   For grunt_b, also cut sphere segments on the flat cap :136 (use `G.sph(…, 8, 5)` so HD gives 16×10) to get under 10,800.
2. [major] gang_harbor_rats_v2_FIXED.js:207-226 and README:126, :133 — the tail stays above the floor only if `animateGang` runs every frame **and** getup is mapped to `'idle'`. Measured worst tail y in the 60 fps sequence:
   - +0.016 m with `'idle'`;
   - −0.119 m (bruiser −0.143) with `'down'`;
   - −0.108 / −0.129 with `'hurt'`;
   - −0.653 / −0.783 with no call.
   Lesson 2's "first choice" (passes without `animateGang`) is not met, and the module can't enforce the mapping. → Map game states inside `animateGang`: add `const S = {dying:'down', getup:'idle', chase:'run', windup:'attack', dizzy:'hurt'}; state = S[state] || state;` at :212, so a raw game state can't sink the tail.
3. [minor] gang_harbor_rats_v2_FIXED.js:125 — the v2 edit put `ear.userData.mat = mat;` **inside** the trailing `//` comment, so it no longer runs (measured: `J.earL.userData.mat === undefined`). The inner-ear disc :129 still gets `J.mat` only through `part()`'s `parent.parent?.userData.mat` fallback (`kit/toadcity_kit.js:100`). → Move the statement before the comment: `const ear = …grp(head, sd * 0.17, 0.35, -0.03); ear.userData.mat = mat;   // up/out: …`.
4. [minor] README_harbor_rats_v2.md:66, :87, :127 — 3 estimate phrases ("about 4 cm", "about 95 draw calls", "about 0.3 m"), tc_lint C11 ERROR ×3, against lesson 7. → Replace them with measured values: "thinner than 0.04 m in two dimensions"; "93–97 draw calls (40 + 28–29 + 25–28)"; "the oar goes 0.312 m below y 0 in `down(1,true)`".
5. [minor] README_harbor_rats_v2.md:106-118 — the "Kit note" still says the `down` previews use a stand-in fall. v2 previews are labelled as real poses (ZIP index; `before_after/after_down_side_grunt_a.png` shows the rig flat with the tail laid toward the feet), so the note is stale. → Rewrite the kit note for v2: state which kit rendered the v2 previews, and quote its sha256.
6. [minor] HR_D_BIG gang_harbor_rats_v2_FIXED.js:19 — the bruiser's shoulder gap is 0.012 m (R) in `down(1,true)` and 0.012 m in `windup(0.6)` (vertex-sampled upper bound), slightly over lesson 1's 0.01 m. → Set `shX` from 0.30 to 0.29, then re-measure with surface sampling.

### armed — extra
7. [minor] gang_harbor_rats_v2_FIXED.js:171-176 — the oar goes 0.312 m below y 0 in real `down(1,true)` (measured). The stock pipe and bat thugs go 0.19–0.24 m (README:127). This is allowed by the lesson 2 weapon exception, but it is the deepest in the game. → Shorten the shaft from 0.82 to 0.70 m and move the blade centre from y 0.76 to 0.64 (paint band 0.88 → 0.76), which takes about 0.1 m off the dip.

### LOD 1 set — FAIL (Read 12, Docs 4: total under 75)
8. [major] hrLod gang_harbor_rats_v2_FIXED.js:184-204 and `v2_delivery/harbor_rats_lod1_day.png` — the 4 LOD members differ mainly by colour and scale. There is no hat or eyepatch silhouette and no weapon detail beyond a plank, so grunt_a and grunt_b are near-identical. The game never swaps LOD in (G1 §3, README:134), so there is no runtime saving to credit (template G5). → Spend the 0 free parts better, or simply keep LOD 1 for reference only and say so in README:95. If kept, give each member 1 hat part (beanie, cap, patch, do-rag) by merging the two LOD ears into one wide disc.
9. [minor] README_harbor_rats_v2.md:81 — README says LOD 1 heights are 1.93 / 1.96 / 2.32. My code measurement at idle t = 0 is 1.905 / 1.931 / 2.286 (2.5–3.4 cm lower; HD matches within 0.4 cm). → Re-measure in the viewer, state the pose and time (lesson 7), and fix the row. The cause of the gap is UNVERIFIED.

### What holds in v2 (lessons 1–8, measured)
- **L1 shoulder gap:** 1 cm or less for grunts and armed in `down`.
- **L2 tail:** only with `animateGang` (finding 2). Ears are never below +0.426 m.
- **L3:** 0 outline:false parts without shadow:false (lint C8). 0 thin casters. The diamond is proud of the belly (0/24 vertices inside), so the stray line cause is removed in code.
- **L4:** key is `K.QUAL || K.THREE || K` at :36; null is never cached (:39-58); wrappers add 0 textures.
- **L5:** the LOD keeps the mustard diamond on all 4 (:188), the navy forearm on grunt_a (:194) and the bruiser's `sz` depth.
- **L6:** fails (finding 1).
- **L7:** fails (findings 4, 9).
- **L8:** README states there is no LOD swap and that `mergeRig` is required. The merge measured 3 meshes HD and 2 meshes LOD, with flash shared.

## Top 3 fixes
1. Cut 4 parts per HD member (finding 1), to 36 or fewer, and get grunt_a/grunt_b under 10,800 tris.
2. Map game states inside `animateGang` (finding 2), so getup can never sink the tail 0.12–0.14 m. Also restore `ear.userData.mat` at :125 (finding 3).
3. README to measured numbers only: the 3 C11 lines, the LOD heights and the stale kit note (findings 4, 5, 9).

## Coverage vs Hark
Hark's `reviews/harbor_rats_review.md` covers **v1 (bbad681)**. I read it only after the review above was finished.
- **I found and Hark missed (v1 review, or new in v2):**
  - The v2 regression at :125, where `ear.userData.mat` is commented out.
  - The getup-mapping sensitivity, measured at −0.119 / −0.143 m. Hark verified the tail fix only with getup mapped to idle.
  - Round-2 headroom: 2 members over 10,800 tris on top of 40/40 parts.
  - The LOD 1 height mismatch in the README.
  - The stale kit note.
  - Bruiser shoulder gap of 1.2 cm.
  - Oar dip measured at 0.312 m.
- **Hark found and I missed:**
  - Visual-only items: the snout taper reads short from the front, the beanie cuff reads as a headband (review:200), and the LOD head looks like a puck from ¾ (:201).
  - Hark's console-error run (0 errors) and the 6,963-call fur-canvas determinism log (:76).
  - Hark compared against the game's `06_game.js` and `01_core.js` source, which is not in this ZIP.
  - I could not reproduce these without real renders or game source.

## UNVERIFIED
- U1: kit byte-identity (template I2). The delivery's own `toadcity_kit.js` is not in the ZIP. Needed: that file's sha256 to compare with `9436da2a…77580880`.
- U2: LICENSES.md and `tools/` contents (README:19-20). Needed: the delivery's `dist/toadcity_taskC_harbor_rats_v2.zip`.
- U3: Style, Read and Night scores are from Hark's shipped PNGs, not my own renders. Needed: a WebGL render of `kit/real_viewer.html?show=harbor_rats` (day, night, 390×844) on this box.
- U4: hit-flash pixel whiteness. In `harbor_rats_hitflash.png` a faint cream tint is visible on the chests. Needed: a pixel probe of a flashed frame (the code shares the uniforms, measured).
- U5: `'drown'` state behaviour (README:133 "untested"). Needed: the game's drown pose values.
- U6: the shoulder gap is a vertex-to-vertex upper bound, not true surface distance. Needed: surface sampling.

## Rat Review Check 410
| Check | Value | Threshold |
|---|---|---|
| Assets scored | 5 of 5 (grunt_a, grunt_b, armed, bruiser, LOD 1 set) | every asset in the delivery |
| Findings with a file:line or a measured number | 9 of 9 (100 %) | 100 % |
| Numbers recomputed from code (not copied from README) | 10 per HD member (parts, tris, hull tris, hulls, shadow casters, mats, height, feet y, tail y ×2), plus weapon y for armed; 7 for the LOD set | ≥ 3 per asset |
| UNVERIFIED items, each with the evidence needed | listed (6 items, U1–U6) | listed |
| Coverage vs Hark section present | yes | yes |
