# Shared text blocks for the round-2 session prompts. Imported by sessions.py / r2gen.py.
REPO = 'https://github.com/bparlette/hawk'

# ---------------------------------------------------------------- OPUS shared ----------------------------------------------------------------
OPUS_CONTEXT = """**Toad City Baltimore** is a phone-first, cel-shaded open-world brawler on Baltimore's Inner Harbor (three.js r160, plain ES modules, everything procedural: no image, model or font files). You play Harold, an elderly toad with a cane; his wife Mavis (grey afro, handbag) fights beside him. Each district has a thug gang; each landmark has a boss. Characters are plain `THREE.Group` rigs built from primitives with `K.part()`, posed by code, cel-shaded with ink hulls, then merged by the game's `mergeRig()` into 2–4 draw calls.

You get one ZIP (`Toad_City_Round2_OPUS.zip`). It holds the **real** starter kit (last round it never reached you and you rebuilt one from memory), the real `mergeRig`, the real poses, Hark's measuring harness, a real-pose viewer, the fixed Harbor Rats reference, the reviews and before/after renders. Bulky material lives in the ZIP; this prompt points at it by file name."""

OPUS_ZIP_FILES = """| ZIP path | What it is |
|---|---|
| `README_ZIP.md` | Index of the ZIP and the one-line setup (`npm i` at the ZIP root installs three 0.160.0 for the Node harness). |
| `kit/toadcity_kit.js` | The **real** starter kit. Its `THUG_POSES` / `HERO_POSES` / `applyPose` are byte-identical to the game's `src/04_actors.js`. Ship it unchanged. |
| `kit/viewer.html`, `kit/example_gull_thug.js`, `kit/example_bench.js` | The kit test bench and the two interface examples. |
| `kit/real_mergeRig.js` | The game's real `mergeRig()` (verbatim from `src/04b_rig_merge.js`) as an ES module. |
| `kit/real_poses_04_actors.js` | The game's real pose code, verbatim, for reading. |
| `kit/real_viewer.html` | Real-pose viewer: `?mods=../src/<file>.js&show=<id>&pose=all`, `&merge=1` (real mergeRig), `&seq=knockdown|attack|hurt` (real game timings; `window.__report.seq.minY` gives the lowest vertex per rig, unmerged). |
| `harness/realK.mjs`, `harness/fakedom.mjs`, `harness/measure_gang.mjs` | Hark's Node harness. `GANG=./src/gang_<id>.js node harness/measure_gang.mjs` writes `results_gang.json`: parts, tris, hulls, shadow casters, heights, per-pose lowest point and limb gaps, real mergeRig result, determinism. |
| `reference/harbor_rats/` | Harbor Rats v1 (`bbad681`), the fixed v2 (Hark's branch `hark/harbor-rats-fixes`, commit `751c21b`), the v1→v2 diff and the v2 README. |
| `reference/pier_gulls_v1/` | Your Pier Gulls v1 (`f1cfba4`): module, README and QA page. |
| `reviews/harbor_rats_review.md`, `reviews/TASK_C_review_lessons.md` | The full Harbor Rats review and the lessons list. |
| `previews/before_after/` | Before/after renders of every Harbor Rats fix (real poses), and `harbor_rats_fixes_compare.png`. |
| `briefs/TASK_C_thug_gangs.md`, `briefs/TASK_D_bosses.md` | Round-1 briefs (full interfaces, roster, style rules). This prompt overrides them where they differ. |
| `prompts/` | All Opus round-2 session prompts (O1–O7). |"""

OPUS_FELL_SHORT = """### A. Harbor Rats (gang 1, `bbad681`): what the review found and the exact fix
Hark measured v1 against the **real game code** (real poses, real `mergeRig`). Full fixed module: `reference/harbor_rats/gang_harbor_rats_v2_FIXED.js`; full diff: `reference/harbor_rats/harbor_rats_v1_to_v2.diff`. Renders: `previews/before_after/before_*.png` vs `after_*.png`.

| # | Before (measured) | After (fix) |
|---|---|---|
| 1 | **Tail through the floor in the real `down` pose:** lowest point −0.67 m (grunts), −0.80 m (bruiser). `animateGang('down')` only lifted the tail base, still −0.52 / −0.62 m. | `animateGang` lays all three tail segments flat in `'down'` (−0.15, 0.1, 0.15 rad) and, in every other state, blends toward flat as `J.tilt.rotation.x` puts the rig on its back (smoothstep 0.5→1.2 rad), so the getup blend never stabs down. Lowest point now +0.054 m (grunt), +0.065 m (bruiser). |
| 2 | **3 cm shoulder gap** when the arms go overhead (real `down`: `shL` −2.6 / `shR` −2.4; armed `windup`: `shR` −2.9). | `HR_D.shX` 0.30 → **0.27**; the bruiser keeps 0.30 because it has fur shoulder balls. Gap now ≤ 1 cm. |
| 3 | **Stray ink line across every belly.** The neckerchief diamond knot was sunk into the belly, so its ink hull crossed the surface; whiskers (9 mm boxes) also cast shadows. | Diamond moved proud of the belly (z +0.02 → +0.04, tilt −0.25 → −0.45). `shadow: false` added to every `outline: false` part (whiskers, teeth, eyes, brows, strap, toothpick, earring, inner ears, oar band). |
| 4 | **Fur texture cache keyed on `K`**, and it cached `null` when `document` was missing: a `{...K}` wrapper redrew the canvas per spawn, and a DOM-less first build locked the rig out of fur forever. | `const key = K.QUAL \\|\\| K.THREE \\|\\| K;` and `HR_FUR.set(key, tex)` only after a successful draw. |
| 5 | **LOD 1 drift:** the armed rat dropped the mustard neckerchief (gang colour gone at distance); LOD forearms always fur (grunt_a HD forearms are navy); LOD ignored the bruiser's ×1.22 depth. | LOD keeps the diamond on every member; the armed LOD drops the hips sphere instead; forearm colour follows `L.sleeves`; depth × `sz` as in HD. |
| 6 | **Ears sliced through the beanie cuff and do-rag** (side views). | Ear groups moved from (±0.155, 0.33) to (±0.17, 0.35). |
| 7 | Sleeve material chosen by comparing colour values (`upCol === C.fur`). | Branch on the look (`L.sleeves`), never on colour equality. |
| 8 | **README not measured:** "about 34 hulls + about 23 shadow casters" (measured 28–29 and 27–30); "can clip the ground slightly" (it was 0.66 m); claimed "the game swaps LOD 1 in" (it does not); `tools/` listed but missing from the zip. | Every README number now comes from a script, with pose and time; known issues carry their measured size; the zip contains what the README lists. |
| 9 | Viewer mapped game state `getup` → `'down'`. | `getup` → `'idle'` (the tail lifts with the tilt). |
| 10 | Every member at exactly **40/40 parts**: no room for any fix. | Round 2 requires headroom (see §4). Note: the v2 reference still sits at 40/40; copy its technique, not its part count. |

Key snippets (before → after):
```js
// 1. tail in down (animateGang)
- const lift = state === 'down' ? -0.5 : ...;  J.tail.rotation.x = B[0] + lift;   // tail1/tail2 keep their curl
+ const th = J.tilt ? -J.tilt.rotation.x : 0, u = Math.min(1, Math.max(0, (th - 0.5) / 0.7));
+ const k = state === 'down' ? 1 : u * u * (3 - 2 * u), side = 1.2 * Math.sin(Math.PI * k);
+ // each segment = lerp(standing, flat [[-0.15,0,sw],[0.1,0,sw],[0.15,0,sw]], k), + side swing on the base
// 2. shoulder pivot
- shX: 0.3        + shX: 0.27   (bruiser: HR_D_BIG = { ...HR_D, shX: 0.3 } with fur shoulder balls)
// 3. thin parts and the diamond
- { outline: false }                 + { outline: false, shadow: false }
- part(J.torso, G.box(.17,.17,.045), C.mustard, 0, .47, .17*sz + .02, { rot: [-0.25, 0, PI/4] })
+ part(J.torso, G.box(.17,.17,.045), C.mustard, 0, .47, .17*sz + .04, { rot: [-0.45, 0, PI/4] })   // proud of the belly
// 4. cache
- if (HR_FUR.has(K)) return HR_FUR.get(K); ... HR_FUR.set(K, tex);
+ const key = K.QUAL || K.THREE || K; if (HR_FUR.has(key)) return HR_FUR.get(key); ... if (tex) HR_FUR.set(key, tex);
```

### B. Pier Gulls (gang 2, `f1cfba4`): good, but three things were not real
Pier Gulls v1 passed its own QA suite (`tools/qa.html`). Three gaps:
- **`mergeRig` was emulated.** Your README says "The real mergeRig() was not available to me." It is now in `kit/real_mergeRig.js`; use only that.
- **Timings were assumed.** You used rate 14 for idle 0.5 s, hurt 0.3 s, windup 0.4 s, attack 0.5 s. The game's real thug timings (`src/06_game.js`) are:

| State | Pose call | Damping rate | Duration / exit |
|---|---|---|---|
| idle / chase | `idle(t)` / `run(t, sp)` | 14 | until the AI changes state |
| windup | `windup(st)` | 12 | 0.5 s (bruiser 0.7 s), then attack |
| attack | `attack(st / 0.3)` | 26 | lunge 4 m/s for the first 0.12 s; back to chase at 0.55 s |
| hurt | `hurt(st / 0.32)` | 24 | back to chase at 0.34 s |
| dizzy | `dizzy(st)` | 10 | until the QTE ends |
| knock-down | hop vy 4.2, gravity 22, then `down(st, grounded)` | 13 | getup after 1.25 s (or `dying` holds `down(1, true)`) |
| getup | `getup(st / 0.5)` | 14 | 0.5 s, then windup or chase |

- **Margins were thin:** armed 36 parts / 11,656 tris, grunt_b 11,056, bruiser 11,072 tris (cap 12,000). The far LOD dipped to −2.1 cm in the knock-down."""

OPUS_INTEGRATION = """- **No LOD swap exists in the game.** `rigLod` (`06_game.js`) only hides ink hulls and stops shadow casting beyond 24 m. Ship `opts.lod === 1` anyway; never write that the game swaps it in.
- **`mergeRig` only auto-wraps `buildThug`/`buildHero`.** Your rig will be passed through it explicitly. Unmerged, an HD gang member costs about 95 draw calls; merged, 3 (+2 shadow). Plain groups only; every extra group (tail, ears, weapon, cape) parented under a skeleton joint; at most one mapped sub-material sharing `flash`/`flashC`.
- **Each file loads as its own ES module.** Never rely on concatenation into `game.js`; export names may repeat across files, but `GANG.id` / `META.id` must be unique game-wide."""

OPUS_EVIDENCE = """Render with `kit/real_viewer.html` (real poses, real kit) through headless Chrome (`--use-gl=swiftshader`, wait for `window.__ready === true`). For **every** member or boss:
- **Before/after (or new) renders, day and night, at 390×844** (the phone framing: `&cam=phone`), plus 1280×720 day/night and the pose strip (`&pose=all`).
- The **real-pose strip** must include the real `down` (arms overhead, flat on its back) and the `&seq=knockdown` sequence; record `window.__report.seq.minY` for each rig.
- A **merged** render (`&merge=1`) day and night, and the hit-flash (`&flash=0.85`) merged.
- Run `harness/measure_gang.mjs` (gangs) and keep `results_gang.json` in the delivery under `tools/`."""

def opus_hard_rules(budget_line, lod_line, extra):
    return f"""1. Build only what this session names. One file per gang or boss in `src/`, loaded as its own ES module.
2. No `import` in your modules; everything comes through `K`. Materials only from `K.toonMat` / `K.basicMat` / `K.makeAtlas`; outlines only the shared `K.OUT_CHAR`.
3. No `Math.random()` at build time: seeded LCG (`s = s * 16807 % 2147483647`) from `opts.seed`.
4. Use the kit in the ZIP (`kit/toadcity_kit.js`) byte-identical. Never edit it, never rebuild a kit from memory.
5. Test with the real poses and the real `kit/real_mergeRig.js`. Never emulate either.
6. Budget with headroom: {budget_line}
7. {lod_line}
8. No vertex of a non-hull mesh below y = −0.03 m in any real pose or blend (feet and weapon excepted).
9. `shadow: false` on every `outline: false` part and on every part thinner than 4 cm in two dimensions.
10. Texture caches keyed on a stable kit object (see §2A fix 4); never cache a failed draw.
11. In idle, no part reaches more than 0.35 m beyond `META.radius` horizontally (weapon excepted); report the measured value.
12. README numbers are measured only, each with its pose and time. No "about". The game has no LOD swap: never claim one.
13. Evidence: day + night renders at 390×844 with the real poses, merged and unmerged, for every asset.
14. {extra}
15. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**."""

# ---------------------------------------------------------------- SONNET shared ----------------------------------------------------------------
SONNET_CONTEXT = """**Toad City Baltimore** is a phone-first, cel-shaded open-world brawler on Baltimore's Inner Harbor (three.js r160, plain ES modules, everything procedural: no image, model or font files; real Baltimore signage is redrawn on canvas). Static city geometry goes through the kit's `out` collector (`out.solid / decal / glow / coll / bld / lamp / hook / build`) and is merged into the game's 64 m render chunks. Moving things (boats, rideables) are their own `THREE.Group` with the vehicle contract `{ root, kind, seats, collider, waterline, animate }`.

You get one ZIP (`Toad_City_Round2_SONNET.zip`): the **real** starter kit (last round it never reached you and you rebuilt one), the Task A/B review, Hark's fixed copies of your Task A/B modules, the measuring harness, before/after renders, the in-house car rebuild as the quality bar, and the game's landmark hook objects. This prompt points at those files by name."""

SONNET_ZIP_FILES = """| ZIP path | What it is |
|---|---|
| `README_ZIP.md` | Index of the ZIP and setup (`npm i` at the ZIP root installs three 0.160.0 for the Node harness). |
| `kit/toadcity_kit.js`, `kit/viewer.html`, `kit/example_bench.js`, `kit/example_gull_thug.js` | The **real** starter kit and bench. Ship the kit unchanged; your viewer must run on it. |
| `reference/taskAB_v1/` | Your Task A/B modules as delivered (branch `claude/new-session-j5l7sz`, commit `45f3041`). |
| `reference/taskAB_fixed/` | Hark's fixed copies (the integration worker's `vendor/taskAB`, snapshot at ZIP build time), plus `taskAB_v1_to_fixed.diff`. |
| `reference/game_hooks/landmark_hooks.js` | The game's `LMHOOK.aquarium` / `LMHOOK.science` objects and the `LANDMARKS` list (excerpt of `src/03_city.js` and `src/03c_landmarks_hd_b2.js`). |
| `reference/game_hooks/constellation_scale.md` | How the in-game USS Constellation is scaled (the scale rule for ships). |
| `harness_ab/` | Hark's Node harness for Task A/B (`measure_ab.mjs`, `checks_ab.mjs`, `block20.mjs`, `fakedom2.mjs`, `starter_kit.mjs`), re-pointed at `kit/` and `reference/`. |
| `reviews/sonnet_taskAB_review.md` | The full review. |
| `previews/before_after/` | `evidence_sheet.png` (door, canopy, pickup glow) and the review renders. |
| `previews/quality_bar/` | The in-house car rebuild (`cars_rebuild_sheet.png`) and your v1 sedan for comparison. |
| `briefs/TASK_A_rowhouse_city_block_kit.md`, `briefs/TASK_B_street_props_vehicles.md` | Round-1 briefs (contracts, style). This prompt overrides them where they differ. |
| `prompts/` | All Sonnet round-2 session prompts (S1–S3). |"""

def sonnet_hard_rules(extra):
    return f"""1. Build only what this session names. Each file in `src/` loads as its own ES module and exports a unique `META_<MODULE>` (e.g. `META_HARBOR_VESSELS`), never a bare `META`.
2. No `import` in modules; everything through `K`. Materials only from `K.toonMat` / `K.basicMat` / `K.makeAtlas`; outlines only `K.OUT_*`. Never write onto `K` or its functions.
3. No `Math.random()` at build time: seeded LCG from `opts.seed`.
4. Use the kit in the ZIP (`kit/toadcity_kit.js`) byte-identical; your viewer must run on it unchanged.
5. Budget with ≥ 10 % headroom under every cap in §4 (tris, meshes, draw calls).
6. Nothing overhangs the footprint you are given; nothing floats; nothing sinks below its base (kerb, pier deck or waterline).
7. Every geometry is placed exactly once. Check every asset at a non-zero position and yaw, not only at the origin.
8. `shadow: false` on decals, glows and anything thinner than 4 cm in two dimensions.
9. Atlas/texture caches in module-level `WeakMap`s keyed on a stable kit object (§2); never cache a failure; guard every global fallback with `typeof`.
10. Static pieces must survive the game's chunk merge: world-space geometry through `out` only, no per-mesh state, no `frustumCulled = false`.
11. Heights in hooks and camera boxes are world y, everywhere.
12. README numbers are measured only, each with its seed, position and yaw. No "about". The game has no LOD swap.
13. Evidence: day + night renders at 390×844 for every asset, in the kit viewer on the real kit.
14. {extra}
15. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**."""

SONNET_FELL_SHORT_HEAD = """Your Task A/B delivery (`claude/new-session-j5l7sz`, `45f3041`) was clean, deterministic and inside every budget, and its README numbers were exact. The rowhouses read as Baltimore at 9 m. But six visible or gameplay bugs were **not disclosed**, and none showed in your own previews, because every asset was checked only at position (0, 0) and yaw 0, on a reconstructed kit, with pavement laid outside the block. Hark's integration worker is fixing them in-house; the status column was read from the fixed files (`reference/taskAB_fixed/`, look for the `fix M1`… comments) when this ZIP was built."""

SONNET_QUALITY_BAR = """### The quality bar: the in-house car rebuild
Your v1 cars were flat-profile boxes with dark side panels standing in for windows (`previews/quality_bar/sedan_v1_day.png`). Hark is rebuilding them in-house as real 3D cel-shaded vehicles (`previews/quality_bar/cars_rebuild_sheet.png`, work in progress): see-through glass with a visible interior (seats, wheel), real wheel arches, chrome side trim and bumpers, distinct sedan / pickup / box-truck / hatchback silhouettes, lit head and tail lights, readable canvas liveries. **That is the bar for every vessel and prop in round 2:** real depth, real openings, distinct silhouettes, readable lettering. Cars are out of scope this round: do not build any."""

GEM_ZIP_FILES = """| ZIP path | What it is |
|---|---|
| `README_ZIP.md` | Index of the ZIP. |
| `qa/QA_GEMINI_PRO_review_prompt.md` | The scoring format: gates I/B/O, 100-point rubric, output format. |
| `kit/toadcity_kit.js` | The real starter kit the builders must ship byte-identical. |
| `kit/real_poses_04_actors.js`, `kit/real_mergeRig.js` | The game's real poses and real `mergeRig`, verbatim. |
| `briefs/TASK_C_thug_gangs.md`, `briefs/TASK_C_review_lessons.md`, `briefs/TASK_A_rowhouse_city_block_kit.md`, `briefs/TASK_B_street_props_vehicles.md` | What the builders were asked for. |
| `reviews/harbor_rats_review.md`, `reviews/sonnet_taskAB_review.md` | Hark's own reviews. Your review must be independent: read them only at the end, to check coverage. |
| `reference/harbor_rats/` | Harbor Rats v1 (`bbad681`), v2 fixed (`hark/harbor-rats-fixes`, `751c21b`), the diff and the v2 README. |
| `previews/harbor_rats/` | v2 delivery previews plus before/after renders of every fix (real poses). |
| `reference/taskAB_v1/`, `reference/taskAB_fixed/` | Sonnet's Task A/B as delivered and Hark's fixed copies with the diff. |
| `previews/taskAB/` | Review evidence renders and the car rebuild sheet. |
| `prompts/` | G1–G3 session prompts. |"""
