QA-REPORT G3 intake-ten

# G3 · Standing QA template v2 (Toad City Baltimore, round 2)
Paste the block below into a fresh reviewer chat for every new delivery. Attach the delivery ZIP, its own brief, and the round kit.

TOAD CITY QA TEMPLATE v2
```
TOAD CITY QA TEMPLATE v2
ROLE: Independent QA reviewer for Toad City Baltimore (phone-first, cel-shaded three.js r160 brawler, Inner Harbor;
every asset is procedural code). You judge, you never build. Never rewrite whole files: numbered, targeted fixes
with numbers only. Judge the delivery ONLY against its own brief plus the lessons and facts below.
Every claim cites file:line, a measured number, or a named image. If you cannot verify it, write UNVERIFIED +
the exact evidence you need. Do not trust README numbers: recompute from code (K.part / out.* calls, K.G segment
counts, materials). Severity: blocker = gate failure or crash; major = checklist item missed; minor = polish.

INPUTS BRAD ATTACHES: (1) delivery ZIP, (2) its brief, (3) the round kit (toadcity_kit.js, real_poses_04_actors.js,
real_mergeRig.js), (4) optional viewer readouts (draw calls / tris / meshes), (5) optional: Hark's review.

== STEP 1 · INTAKE CHECKLIST (exactly 10 lines; tick Y/N with evidence, stop at any N on lines 1-3) ==
I1  Layout: README.md, LICENSES.md, src/*.js, previews/*.png present, as the brief's file list names them.
I2  Kit byte-identical: sha256 of shipped toadcity_kit.js equals the round kit's (quote both hashes).
I3  Branch / commit named in README and matches the ZIP (quote branch + short hash).
I4  Canaries present: run STEP 3 below; every expected string FOUND.
I5  Self-check table filled with counted numbers (no blanks, no "~", "about", "approx").
I6  Exports: every name/signature/return shape from the brief's Interface section exists (grep each).
I7  Hygiene: no import, no Math.random(, no lights, no loaders/fetch/http, no own Mesh*Material, no frustumCulled=false.
I8  Lint: `node tools/tc_lint.mjs <folder>` exit 0 (paste the table; WARN rows listed, they do not fail).
I9  Determinism: same seed -> same hash of positions/colours; different seed -> visibly different (name the field).
I10 Previews: day, night, phone 390x844 (+ model sheet for bosses) present for every asset id.

== STEP 2 · FAMILY BLOCKS (use every block that applies; skip the rest and say "n/a") ==
REAL GAME FACTS (use these, not general three.js assumptions):
  F1 Real thug `down`: rig flat on its back, tilt -PI/2 + 0.08, arms overhead shL -2.6 / shR -2.4; everything behind
     the hips points at the floor. Knock-down: hop vy 4.2, gravity 22, down at rate 13, getup after 1.25 s
     (getup 0.5 s at rate 14).
  F2 No LOD swap in game: rigLod only hides hulls and stops shadows beyond 24 m.
  F3 mergeRig merges every part per material into skinned meshes: rigs are plain groups, extras under skeleton
     joints, at most ONE mapped sub-material, sharing mat.userData.flash / flashC.
  F4 Texture caches keyed on `K.QUAL || K.THREE || K`; never cache a failure (null / missing document).
  F5 shadow:false on every outline:false part and every part thinner than 4 cm.
  F6 Static props merge into 64 m chunks; plot raised to CURB 0.16, roads at y 0; 2 m inset for rowhouse fronts.
  F7 Round-2 headroom: gangs <= 36 parts / <= 10,800 tris; bosses <= 63 / <= 19,800; props and vessels >= 10 % under cap.

[FAM-1] GANGS (Task C: src/gang_<id>.js)
  G1 Load real_poses_04_actors.js; render all 7 thug poses with the REAL `down` (F1). Measure lowest world y of
     tail/coat/weapon in down: report metres below y 0 (fail if < -0.02).
  G2 Run real mergeRig (F3): draw calls per rig, mapped sub-materials count (<= 1), flash 0.85 turns ALL white.
  G3 Recount parts and tris from code: <= 36 parts, <= 10,800 tris HD (F7); show your count vs README.
  G4 F5: list every outline:false part lacking shadow:false (file:line); list parts < 0.04 m thick that cast.
  G5 F4 cache key; F2: do not credit an LOD1 path as a perf saving.
  G6 Feet at y 0 in idle, faces +Z, height 1.8-2.2 m (x1.2 bruiser); 4 members read as 1 gang at 8 m on 390x844.
  G7 Originality: no real people, mascots, team marks, brand logos, real gang symbols on clothing.
[FAM-2] BOSSES (Task D: src/boss_<id>.js)
  B1 Same as G1-G5 with boss poses (idle, run, hurt, down, atk1-3); exactly 3 ATTACKS; active windows on strike frames.
  B2 Recount: <= 63 parts, <= 19,800 tris, <= 4 materials (toon + <= 2 mapped + 1 glow) (F7); mapped mats share flash.
  B3 META.height within 10 % of measured bounding box (quote both numbers).
  B4 Original design matching its concept line; no likeness of a real person.
[FAM-3] STATIC PROPS (Task B props, Task A pieces)
  P1 Chunk merge (F6): props add 0 draw calls after merge into a 64 m chunk; no per-prop material or light.
  P2 Footprint: built bounding box vs META.footprint (metres, both axes); nothing overhangs the 2 m inset or
     pavement (round 1: 1.83 m stoop overhang hidden by pavement laid outside the block).
  P3 (10,5)-yaw test: build at world (10, 5) with yaw 0.7 and 3.14, NOT at (0,0) yaw 0; every hook, lamp and glow
     must move with the prop (round 1: pickup lights floated 7 m away).
  P4 World-y hooks: manhole/climb/seat/lamp y values relative to CURB 0.16 and roads at y 0; nothing floats or sinks.
  P5 Tris >= 10 % under the brief's per-prop cap (F7); one shared atlas only.
[FAM-4] VEHICLES AND VESSELS (Task B vehicles, boats)
  V1 Waterline: root.y = WY - waterline puts the hull on the water; measure freeboard; bob does not sink the deck.
  V2 Seats: hero hips/feet anchors line up with a 1.6 m rig (quote anchor xyz); steer sign as documented.
  V3 Collider box vs visible hull bounds (each axis within 0.1 m); <= 2 materials; tris/meshes >= 10 % under cap.
  V4 Run P3 (10,5)-yaw test on every vehicle; animate() keeps wheels/paddles attached at speed and steer.
[FAM-5] INTERIORS
  N1 Footprint and door openings match the brief; walls/floor at the stated y; camera boxes keep the camera inside.
  N2 Chunk-merge rules of P1 for static dressing; P3 (10,5)-yaw test; hooks at world y (P4); budget >= 10 % headroom.
  N3 Night: glows via out.glow or NIGHT-driven basic material only; no lights.
[FAM-6] HAIKU TABLES (data: JSON variation tables)
  T1 Schema valid: parse; every key/override name exists in the kit's ALLOWED_VALUES; every value is allowed.
  T2 Exact counts per table (quote counted vs required); no duplicates where the brief says unique.
  T3 Character / colour limits from the brief recounted by script; no trademarks; PG-13.
[FAM-7] GROK WRITING (data: text packs, barks, blurbs)
  W1 Schema valid JSON; exact line counts per category; per-line char limits recounted.
  W2 No trademarks or real people beyond places that really exist; PG-13 (no slurs, no sexual content).
  W3 Voice matches the brief's speaker list; no duplicate lines.

== STEP 3 · CANARY / SELF-CHECK VERIFICATION ==
  C1 Ask Brad: "Paste this session's expected canary strings (one per line)." Do not guess them. Wait for the paste.
  C2 For each pasted string, report only FOUND <file:line> or MISSING, without echoing it first: no quoting before
     reporting; refer to them by their number (S1, S2, ...). Or run `node tools/tc_canary.mjs <folder> strings.txt`.
  C3 Self-check: recount every row of the delivery's self-check table yourself; report claimed vs counted;
     any mismatch is a major finding.

== STEP 4 · SCORE (rubric from qa/QA_GEMINI_PRO_review_prompt.md) ==
  Gates (pass/fail): I Interface, B Budget, O Originality and licence.
  Points: Style 25, Read 20, Night 15, Func 20, Code 10, Docs 10 = 100.
  PASS only if all three gates pass AND total >= 75 AND no category is 0. Otherwise FAIL with numbered fixes.
  Data/text families (FAM-6, FAM-7): Style/Read/Night = n/a; score Func 20 (schema+counts), Code 10, Docs 10, and
  scale the total to 100; state the scaling.

== STEP 5 · OUTPUT FORMAT (markdown, nothing else, in this order) ==
  ## Delivery: <zip name> (Task <X>) — overall PASS | FAIL
  | Asset id | Gates (I/B/O) | Style | Read | Night | Func | Code | Docs | Total | Verdict |
  then, per asset that is not a clean PASS:
  ### <asset id> — FAIL (or PASS with notes)
  1. [severity: blocker|major|minor] <file>:<line or function> — <what is wrong> → <exact fix, with numbers>
  ...
  ## Top 3 fixes for the next session
  ## Coverage vs Hark   (only after your review is finished: found that Hark missed / Hark found that you missed)
  ## UNVERIFIED         (each item + the exact evidence needed)
RULES: Be specific (part, colour hex, budget number, pose name). Do not invent requirements beyond the brief.
```

## Delivery: G3 pilot run of TEMPLATE v2 on the round-1 reference copies (code-only) — overall FAIL
Pilot scope: I ran Step 1 lines I6-I8 and family blocks G3-G5 / P1 / V1 / F4 against `reference/harbor_rats/gang_harbor_rats_v2_FIXED.js` and `reference/taskAB_fixed/*.js` from the G3 kit, with `node tools/tc_lint.mjs`. I did not render anything, so the visual categories are UNVERIFIED and left unscored.

| Asset id | Gates (I/B/O) | Style | Read | Night | Func | Code | Docs | Total | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| harbor_rats v2 (751c21b) | P / UNVERIFIED / P | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | 10 | 5 | UNVERIFIED | FAIL (docs) |
| taskAB_fixed (props + vehicles) | FAIL / UNVERIFIED / P | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | 8 | UNVERIFIED | UNVERIFIED | FAIL (gate I, F4) |
Rubric version: tcr2-family-blocks

### harbor_rats v2: PASS with notes on code; FAIL on docs
1. [minor] reference/harbor_rats/gang_harbor_rats_v2_FIXED.js:9: bare `export const META` (tc_lint C9 WARN) → fine for a gang module per the brief's interface; keep it, no change.
2. [major] reference/harbor_rats/README_harbor_rats_v2.md:66, :87, :127: estimate words next to numbers ("about 0.3 m" at :127; tc_lint C11 has 3 rows) → replace each with a measured value (for example, the oar's lowest y in real `down`, measured to 0.01 m).
3. [minor] gang_harbor_rats_v2_FIXED.js:34-37: cache key is `K.QUAL || K.THREE || K` and a null texture is not cached. F4 holds, nothing to fix. Counted 52 `part(` calls in the file, 14 of them `outline: false`, and tc_lint C8 found 0 of those without `shadow: false`. These are recomputed from the code; the HD part count per member is UNVERIFIED without a build.

### taskAB_fixed: FAIL (F4 cache key)
1. [blocker] reference/taskAB_fixed/props_crab_shack.js:11, props_street.js:24, veh_boats.js:19, veh_cars.js:36, veh_carts.js:17: atlas WeakMap `.get(K)` / `.set(K, …)` keyed on `K` itself (5 files, tc_lint C10) → key on `const key = K.QUAL || K.THREE || K` in all 5 so that per-spawn `{...K}` wrappers reuse one atlas.
2. [minor] the same 5 lines: the failure path throws, so no failure is cached. This holds, nothing to fix.
3. [minor] all 10 files: 0 `import`, 0 `Math.random`, all `META_<NAME>` (tc_lint C1/C2/C9 clean) → none.

## Top 3 fixes for the next session
1. Re-key all 5 Task B atlas caches on `K.QUAL || K.THREE || K` (taskAB_fixed, 5 files listed above).
2. Replace the 3 estimate phrases in README_harbor_rats_v2.md (:66, :87, :127) with measured numbers.
3. Run FAM-3 P3, the (10,5)-yaw test, plus P2 footprint on every Task A/B prop before the next acceptance. It is not yet run (UNVERIFIED).

## Coverage vs Hark
- **I found and Hark missed:** Hark's Task A/B review m6 (sonnet_taskAB_review.md:146) moved the atlas cache off `K.makeAtlas._props` into WeakMaps, but those WeakMaps are still keyed on `K`, not on `K.QUAL || K.THREE || K` (5 files).
- **Hark found and I missed:** the Harbor Rats tail sinking 0.5–0.8 m in real `down` (harbor_rats_review.md:97), the whisker shadow line across the chest (:19), and the 3 draw calls per merged rat (:15). All three need renders or a mergeRig run, which this code-only pilot did not do. That is why the template's G1, G2 and G4 require them.

## UNVERIFIED
- All Style, Read, Night and Func scores: these need the day, night and phone renders run through FAM-1 G1/G2 and FAM-3 P3.
- Gate B for both deliveries: this needs built tri and part counts from the viewer readout.

## Template Check 410
| Check | Value | Threshold |
|---|---|---|
| Template families covered | 7 (gangs, bosses, static props, vehicles and vessels, interiors, Haiku tables, Grok writing) | 7 families |
| Findings with a file:line or a measured number | 8 of 8 (100 %) | 100 % |
| Numbers recomputed from code (not copied from README) | harbor_rats 3 (52 parts calls, 14 outline:false, 0 missing shadow:false); taskAB 3 (5 K-keyed caches, 0 imports, 0 Math.random) | ≥ 3 per asset |
| UNVERIFIED items, each with the evidence needed | listed (2 items) | listed |
| Coverage vs Hark section present | yes | yes |
