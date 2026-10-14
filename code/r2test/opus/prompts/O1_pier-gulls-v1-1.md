# O1 · Pier Gulls v1.1 fix pass
**For:** Claude Opus · **Setting:** Claude Opus (newest), extended thinking ON, high effort. · **Depends on:** Pier Gulls v1 (f1cfba4). Parallel with O2–O7. · **Delivers to: `claude/o1-pier-gulls-v1-1`**

Attach `Toad_City_Round2_OPUS.zip` to this chat together with this prompt. Everything bulky (code, references, renders) is in the ZIP; this prompt names the files.

## HARD RULES (read first; repeated at the very end)
1. Build only what this session names. One file per gang or boss in `src/`, loaded as its own ES module.
2. No `import` in your modules; everything comes through `K`. Materials only from `K.toonMat` / `K.basicMat` / `K.makeAtlas`; outlines only the shared `K.OUT_CHAR`.
3. No `Math.random()` at build time: seeded LCG (`s = s * 16807 % 2147483647`) from `opts.seed`.
4. Use the kit in the ZIP (`kit/toadcity_kit.js`) byte-identical. Never edit it, never rebuild a kit from memory.
5. Test with the real poses and the real `kit/real_mergeRig.js`. Never emulate either.
6. Budget with headroom: every HD gull ≤ 38 parts and ≤ 11,000 tris (at least 2 parts and 1,000 tris under the 40 / 12,000 caps), ≤ 3 materials.
7. Far LOD ≤ 14 parts, ≤ 3,000 tris; its lowest point in the knock-down ≥ −0.02 m; hands in the dark wingtip colour.
8. No vertex of a non-hull mesh below y = −0.03 m in any real pose or blend (feet and weapon excepted).
9. `shadow: false` on every `outline: false` part and on every part thinner than 4 cm in two dimensions.
10. Texture caches keyed on a stable kit object (see §2A fix 4); never cache a failed draw.
11. In idle, no part reaches more than 0.35 m beyond `META.radius` horizontally (weapon excepted); report the measured value.
12. README numbers are measured only, each with its pose and time. No "about". The game has no LOD swap: never claim one.
13. Evidence: day + night renders at 390×844 with the real poses, merged and unmerged, for every asset.
14. Change only what §3 lists; keep everything that already passes. Push to the branch named in §6.
15. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**.

## Step 0 · Comprehension check (your FIRST reply; write no code and produce no deliverable until Brad answers GO)
1. **List every file in the ZIP** (full path) and say in a few words what you will use it for.
2. **Restate, numbered and in your own words, every HARD RULE above and every lesson or fix row in §2** (one line each).
3. **Answer these questions.** Every answer is in the sections below; quote the exact number, name or code.
   - Q1. What is the real windup duration for a bruiser, and its damping rate?
   - Q2. Attack: pose argument, rate, lunge time, and when does the thug go back to chase?
   - Q3. Hurt and dizzy damping rates?
   - Q4. Thug getup: duration and rate?
   - Q5. How many triangles does your v1 armed gull have, and how many must you cut?
   - Q6. How much of the beanie may be buried in the head?
   - Q7. What colour must the far-LOD hands be?
   - Q8. What is the delivery branch name?
4. **Quote the three canary instructions** this prompt contains (they are marked "Canary 1/2/3 of 3" somewhere in the middle) and confirm you will include each string exactly.

Then stop and wait. Brad checks your answers; if any is wrong he will send you back to re-read.

## ZIP contents
| ZIP path | What it is |
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
| `prompts/` | All Opus round-2 session prompts (O1–O7). |

## 1 · Context
**Toad City Baltimore** is a phone-first, cel-shaded open-world brawler on Baltimore's Inner Harbor (three.js r160, plain ES modules, everything procedural: no image, model or font files). You play Harold, an elderly toad with a cane; his wife Mavis (grey afro, handbag) fights beside him. Each district has a thug gang; each landmark has a boss. Characters are plain `THREE.Group` rigs built from primitives with `K.part()`, posed by code, cel-shaded with ink hulls, then merged by the game's `mergeRig()` into 2–4 draw calls.

You get one ZIP (`Toad_City_Round2_OPUS.zip`). It holds the **real** starter kit (last round it never reached you and you rebuilt one from memory), the real `mergeRig`, the real poses, Hark's measuring harness, a real-pose viewer, the fixed Harbor Rats reference, the reviews and before/after renders. Bulky material lives in the ZIP; this prompt points at it by file name.

**This session is the Pier Gulls v1.1 fix pass**, not a new gang. Your v1 (`f1cfba4` on `claude/new-session-z5ikqq`, `dist/toadcity_taskC_pier_gulls_v1.zip`, QA page `tools/qa.html`) is in the ZIP at `reference/pier_gulls_v1/`. Gang 1 (Harbor Rats) stays Hark's fixed version: do not touch it.

## 2 · Where you fell short last round and how we fixed it
### A. Harbor Rats (gang 1, `bbad681`): what the review found and the exact fix
Hark measured v1 against the **real game code** (real poses, real `mergeRig`). Full fixed module: `reference/harbor_rats/gang_harbor_rats_v2_FIXED.js`; full diff: `reference/harbor_rats/harbor_rats_v1_to_v2.diff`. Renders: `previews/before_after/before_*.png` vs `after_*.png`.

| # | Before (measured) | After (fix) |
|---|---|---|
| 1 | **Tail through the floor in the real `down` pose:** lowest point −0.67 m (grunts), −0.80 m (bruiser). `animateGang('down')` only lifted the tail base, still −0.52 / −0.62 m. | `animateGang` lays all three tail segments flat in `'down'` (−0.15, 0.1, 0.15 rad) and, in every other state, blends toward flat as `J.tilt.rotation.x` puts the rig on its back (smoothstep 0.5→1.2 rad), so the getup blend never stabs down. Lowest point now +0.054 m (grunt), +0.065 m (bruiser). |
| 2 | **3 cm shoulder gap** when the arms go overhead (real `down`: `shL` −2.6 / `shR` −2.4; armed `windup`: `shR` −2.9). | `HR_D.shX` 0.30 → **0.27**; the bruiser keeps 0.30 because it has fur shoulder balls. Gap now ≤ 1 cm. |
| 3 | **Stray ink line across every belly.** The neckerchief diamond knot was sunk into the belly, so its ink hull crossed the surface; whiskers (9 mm boxes) also cast shadows. | Diamond moved proud of the belly (z +0.02 → +0.04, tilt −0.25 → −0.45). `shadow: false` added to every `outline: false` part (whiskers, teeth, eyes, brows, strap, toothpick, earring, inner ears, oar band). |
| 4 | **Fur texture cache keyed on `K`**, and it cached `null` when `document` was missing: a `{...K}` wrapper redrew the canvas per spawn, and a DOM-less first build locked the rig out of fur forever. | `const key = K.QUAL \|\| K.THREE \|\| K;` and `HR_FUR.set(key, tex)` only after a successful draw. |
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

- **Margins were thin:** armed 36 parts / 11,656 tris, grunt_b 11,056, bruiser 11,072 tris (cap 12,000). The far LOD dipped to −2.1 cm in the knock-down.

## 3 · The task: Pier Gulls v1.1
Measured numbers from your own v1 README (idle, t = 0):

| member | HD parts | HD tris | v1.1 target | LOD 1 knock-down low point |
|---|---|---|---|---|
| grunt_a | 33 | 10,760 | ≤ 38 / ≤ 11,000 (passes) | −2.1 cm → ≥ −2.0 cm |
| grunt_b | 33 | 11,056 | cut ≥ 56 tris | −2.1 cm → ≥ −2.0 cm |
| armed | 36 | 11,656 | cut ≥ 656 tris | check |
| bruiser | 33 | 11,072 | cut ≥ 72 tris | check |

Do exactly these, then re-measure everything:
1. **Real `mergeRig`:** delete the emulation from your QA; import `kit/real_mergeRig.js` in the viewer and in `tools/qa.js`; report draw calls after merge, that the hit-flash covers every merged mesh, and that `animateGang` still moves the merged bones.
2. **Real timings:** replace your assumed phases with the table in §2B (windup 0.5 s / bruiser 0.7 s at rate 12; attack `attack(st/0.3)` at rate 26 with a 0.12 s lunge, back to chase at 0.55 s; hurt 0.32 s at rate 24; dizzy rate 10; getup 0.5 s at rate 14; idle/chase rate 14). `kit/real_viewer.html?seq=attack|hurt|knockdown` plays them. Re-run every ground and shoulder check through these sequences.
3. **Margins:** every HD member ≤ 38 parts and ≤ 11,000 tris (lower segment counts on hidden spheres first; do not drop the gang read).
4. **Beanie:** the bruiser's beanie must be < 55 % buried in the head (measure the share of its surface inside the head volume; report it).
5. **Far LOD:** lowest point in the knock-down ≥ −0.02 m (it was −0.021 m); hands in the dark wingtip colour so the LOD keeps the gull read.
6. **README:** measured numbers only, with the new timings named in "How things are measured"; remove every "assumed" line.

> **Canary 1 of 3 (required in your delivery):** README_pier_gulls.md: the last section heading, exactly: `## Gull Check 410`

## 4 · Interface and budgets
Unchanged from v1 (`GANG`, `META`, `buildPierGull(K, member, opts)`, `animateGang`). Budgets for v1.1:

| Budget (per member) | Cap | v1.1 target |
|---|---|---|
| HD parts | 40 | **≤ 38** |
| HD tris | 12,000 | **≤ 11,000** |
| Materials | 3 | ≤ 3 |
| LOD 1 parts / tris | 14 / 3,000 | ≤ 14 / ≤ 3,000 |
| LOD 1 knock-down low point | — | ≥ −0.02 m |
| Beanie buried share (bruiser) | — | < 55 % |

- **No LOD swap exists in the game.** `rigLod` (`06_game.js`) only hides ink hulls and stops shadow casting beyond 24 m. Ship `opts.lod === 1` anyway; never write that the game swaps it in.
- **`mergeRig` only auto-wraps `buildThug`/`buildHero`.** Your rig will be passed through it explicitly. Unmerged, an HD gang member costs about 95 draw calls; merged, 3 (+2 shadow). Plain groups only; every extra group (tail, ears, weapon, cape) parented under a skeleton joint; at most one mapped sub-material sharing `flash`/`flashC`.
- **Each file loads as its own ES module.** Never rely on concatenation into `game.js`; export names may repeat across files, but `GANG.id` / `META.id` must be unique game-wide.

> **Canary 2 of 3 (required in your delivery):** src/gang_pier_gulls.js: line 2, exactly: `// tcr2 o1 rockfish-tide`

## 5 · Self-test and evidence
Render with `kit/real_viewer.html` (real poses, real kit) through headless Chrome (`--use-gl=swiftshader`, wait for `window.__ready === true`). For **every** member or boss:
- **Before/after (or new) renders, day and night, at 390×844** (the phone framing: `&cam=phone`), plus 1280×720 day/night and the pose strip (`&pose=all`).
- The **real-pose strip** must include the real `down` (arms overhead, flat on its back) and the `&seq=knockdown` sequence; record `window.__report.seq.minY` for each rig.
- A **merged** render (`&merge=1`) day and night, and the hit-flash (`&flash=0.85`) merged.
- Run `harness/measure_gang.mjs` (gangs) and keep `results_gang.json` in the delivery under `tools/`.
- **Before/after pairs** for each change (v1 render left, v1.1 right): merged flash, knock-down strip, LOD hands, bruiser beanie side view.

> **Canary 3 of 3 (required in your delivery):** Final message: the first line of the filled self-check block, exactly: `SELF-CHECK O1 pier-four-lantern`

## 6 · Delivery
- **Branch:** push to **`claude/o1-pier-gulls-v1-1`** on `https://github.com/bparlette/hawk` (branch it from `f1cfba4`). If your environment forces its own branch name, push there and name it in your first and last message.
- **Layout:** as v1, plus `dist/toadcity_taskC_pier_gulls_v1_1.zip`; `previews/before_after/`.
- Final message to Brad: branch, commit, zip path, filled §7.

## 7 · Final self-check (measured numbers only)
| Check | grunt_a | grunt_b | armed | bruiser | Threshold |
|---|---|---|---|---|---|
| HD parts / tris / materials | | | | | ≤ 38 / ≤ 11,000 / ≤ 3 |
| LOD 1 parts / tris | | | | | ≤ 14 / ≤ 3,000 |
| Real `mergeRig` draw calls after / flash covers all / bones animate | | | | | ≤ 3 / yes / yes |
| Lowest point: `seq=knockdown`, `seq=attack`, `seq=hurt` (HD) | | | | | ≥ −0.03 m |
| LOD 1 lowest point in knock-down | | | | | ≥ −0.02 m |
| Shoulder gap `down(1,true)` / `windup(0.6)` | | | | | ≤ 1 cm |
| Beanie buried share | — | — | — | | < 55 % |
| LOD hands colour = wingtip colour | | | | | yes |
| Console errors | | | | | 0 |

## HARD RULES (repeated)
1. Build only what this session names. One file per gang or boss in `src/`, loaded as its own ES module.
2. No `import` in your modules; everything comes through `K`. Materials only from `K.toonMat` / `K.basicMat` / `K.makeAtlas`; outlines only the shared `K.OUT_CHAR`.
3. No `Math.random()` at build time: seeded LCG (`s = s * 16807 % 2147483647`) from `opts.seed`.
4. Use the kit in the ZIP (`kit/toadcity_kit.js`) byte-identical. Never edit it, never rebuild a kit from memory.
5. Test with the real poses and the real `kit/real_mergeRig.js`. Never emulate either.
6. Budget with headroom: every HD gull ≤ 38 parts and ≤ 11,000 tris (at least 2 parts and 1,000 tris under the 40 / 12,000 caps), ≤ 3 materials.
7. Far LOD ≤ 14 parts, ≤ 3,000 tris; its lowest point in the knock-down ≥ −0.02 m; hands in the dark wingtip colour.
8. No vertex of a non-hull mesh below y = −0.03 m in any real pose or blend (feet and weapon excepted).
9. `shadow: false` on every `outline: false` part and on every part thinner than 4 cm in two dimensions.
10. Texture caches keyed on a stable kit object (see §2A fix 4); never cache a failed draw.
11. In idle, no part reaches more than 0.35 m beyond `META.radius` horizontally (weapon excepted); report the measured value.
12. README numbers are measured only, each with its pose and time. No "about". The game has no LOD swap: never claim one.
13. Evidence: day + night renders at 390×844 with the real poses, merged and unmerged, for every asset.
14. Change only what §3 lists; keep everything that already passes. Push to the branch named in §6.
15. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**.
