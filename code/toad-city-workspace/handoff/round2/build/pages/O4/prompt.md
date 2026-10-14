# O4 · Thug gang: Key Highway Otters
**For:** Claude Opus · **Setting:** Claude Opus (newest), extended thinking ON, high effort. · **Depends on:** None (parallel with O1–O7). Uses the Harbor Rats v2 reference in the ZIP. · **Delivers to: `claude/o4-key-hwy-otters`**

Attach `Toad_City_Round2_OPUS.zip` to this chat together with this prompt. Everything bulky (code, references, renders) is in the ZIP; this prompt names the files.

## HARD RULES (read first; repeated at the very end)
1. Build only what this session names. One file per gang or boss in `src/`, loaded as its own ES module.
2. No `import` in your modules; everything comes through `K`. Materials only from `K.toonMat` / `K.basicMat` / `K.makeAtlas`; outlines only the shared `K.OUT_CHAR`.
3. No `Math.random()` at build time: seeded LCG (`s = s * 16807 % 2147483647`) from `opts.seed`.
4. Use the kit in the ZIP (`kit/toadcity_kit.js`) byte-identical. Never edit it, never rebuild a kit from memory.
5. Test with the real poses and the real `kit/real_mergeRig.js`. Never emulate either.
6. Budget with headroom: HD member ≤ 36 parts, ≤ 10,800 tris, ≤ 3 materials (caps 40 / 12,000 / 3).
7. Far LOD (`opts.lod === 1`) ≤ 12 parts, ≤ 2,700 tris; it keeps the gang accent part and matches HD colours and proportions.
8. No vertex of a non-hull mesh below y = −0.03 m in any real pose or blend (feet and weapon excepted).
9. `shadow: false` on every `outline: false` part and on every part thinner than 4 cm in two dimensions.
10. Texture caches keyed on a stable kit object (see §2A fix 4); never cache a failed draw.
11. In idle, no part reaches more than 0.35 m beyond `META.radius` horizontally (weapon excepted); report the measured value.
12. README numbers are measured only, each with its pose and time. No "about". The game has no LOD swap: never claim one.
13. Evidence: day + night renders at 390×844 with the real poses, merged and unmerged, for every asset.
14. Push to the branch named in §6 of this prompt, never to `main`.
15. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**.

## Step 0 · Comprehension check (your FIRST reply; write no code and produce no deliverable until Brad answers GO)
1. **List every file in the ZIP** (full path) and say in a few words what you will use it for.
2. **Restate, numbered and in your own words, every HARD RULE above and every lesson or fix row in §2** (one line each).
3. **Answer these questions.** Every answer is in the sections below; quote the exact number, name or code.
   - Q1. What is the real `down` pose's `shL` value, in radians?
   - Q2. What is the largest torso-to-upper-arm gap allowed in `down(1, true)` and `windup(0.6)`?
   - Q3. Which `animateGang` state does the game state `getup` map to?
   - Q4. Give the exact texture-cache key expression.
   - Q5. What are the knock-down hop numbers and the `down` damping rate?
   - Q6. Which value did Hark change `shX` from and to on Harbor Rats, and why does the bruiser differ?
   - Q7. What is the delivery branch name?
   - Q8. What was the v1 Harbor Rats grunts' tail lowest point in the real `down` pose, before the fix?
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

**Where we are:** gang 1 (Harbor Rats) is final in Hark's fixed version. Gang 2 (Pier Gulls) is getting a v1.1 fix pass in session O1. **This session builds gang 5 of 5: the Key Highway Otters.** Gangs run as separate sessions (O2 Catfish, O3 Bandits, O4 Otters) and may run in parallel.

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

## 3 · The task: Key Highway Otters (river otters)
Build the four members `grunt_a`, `grunt_b`, `armed`, `bruiser` of the **Key Highway Otters**, district Federal Hill, Domino Sugar, Tide Point, Fort McHenry: `['fedhill', 'domino', 'underarmour', 'fort']`, signature accent green `#23c26b` + brown.
- **Look:** River otters: sleek long body, small round ears, broad flat muzzle with whiskers, webbed paws, thick tapering tail. South shore is the Key Highway promenade, the sugar refinery, Tide Point offices and the fort: think track jackets, refinery hard hats (no real company marks), joggers, a drum-major-style sash on the bruiser. Green is the gang mark.
- **Gang read:** one shared uniform motif (jacket colour, bandana or patch shape) so the four read as one gang at 8 m on a 390×844 screen and read as different from the rats (navy + mustard) and the gulls (white + blue). No real gang colours or symbols, no brand logos, no real people.
- **Members:** each has one silhouette hook (a hat, a prop, a posture). `armed` carries an original improvised weapon from the south shore (a sugar sack swung like a flail, a rolled jogging mat, a toy cannon ramrod). Non-lethal-looking, PG-13. It lives in `J.swR = K.grp(J.haR, 0, -0.04, 0)` and is built along +Y, at both LODs. `bruiser` is built big (wider and deeper; the game also scales it ×1.2 and doubles its HP).
- **Tail rule for this gang:** The thick tapering tail sits behind the hips: in the real `down` it points at the floor unless it hangs down at rest or follows rule A1.
- **Rule A1 (only if the tail cannot pass at rest):** `animateGang` must lay the tail flat toward the feet in `'down'` and blend it with `J.tilt.rotation.x` in every other state, exactly like Harbor Rats v2; the README must then say in bold that **`animateGang` is required every frame after `applyPose` whenever `down` is used**, and give the measured clearance with and without it.
- **Thin parts:** the whiskers and any strap or rod get `outline: false, shadow: false`. No outlined decorative part may sit mostly inside another outlined part (that is what drew the Harbor Rats belly line).
- **Style:** Harold-level construction (chunky `K.G` primitives, vertex colours, the toon ramp, ink hulls), big readable heads, mid-value colours, `K.INK` for black, at most `#f2f2f2` for white, readable under the night preset. One optional ≤ 256² canvas skin map, drawn deterministically.

> **Canary 1 of 3 (required in your delivery):** README.md: the last section heading, exactly: `## Otter Check 410`

## 4 · Interface and budgets
File `src/gang_key_hwy_otters.js`, exactly this shape (see `briefs/TASK_C_thug_gangs.md` for the full contract):
```js
// tcr2 …  (line 2: the canary comment from the comprehension check)
export const GANG = { id: 'key_hwy_otters', name: 'Key Highway Otters', animal: '…', district: [ … ], accent: '…', members: ['grunt_a', 'grunt_b', 'armed', 'bruiser'] };
export const META = { grunt_a: { hp: 8, scale: 1, radius: 0.42, weapon: null }, /* … */ bruiser: { hp: 16, scale: 1.2, radius: 0.55, weapon: null, big: true } };
export function buildKeyHwyOtter(K, member = 'grunt_a', opts = {}) { /* opts: { lod: 0 | 1, seed, colors } */ … return J; }
export function animateGang(J, t, state) { /* optional unless rule A1 applies */ }
```
- The 18 joints from `K.skeleton()`; a custom `d` keeps the `K.THUG_D` keys with `hip` 0.8–1.0. Facing +Z, feet on y = 0 in idle, height 1.8–2.2 m (bruiser × 1.2).
- One `toonMat` per rig plus at most one mapped sub-material that shares `mat.userData.flash` and `flashC`; hit-flash 0.85 turns the whole rig white, merged and unmerged.

| Budget (per member) | Cap | Round-2 target (≥ 10 % headroom) |
|---|---|---|
| HD parts (meshes, hulls excluded) | 40 | **≤ 36** |
| HD triangles (hulls excluded) | 12,000 | **≤ 10,800** |
| Materials (toon + 1 mapped + shared outline) | 3 | ≤ 3 |
| LOD 1 parts / tris | 14 / 3,000 | **≤ 12 / ≤ 2,700** |
| Lowest non-hull vertex, every real pose and the knock-down blend (feet, weapon excepted) | — | ≥ −0.03 m |
| LOD 1 lowest point in the knock-down | — | ≥ −0.02 m |
| Shoulder gap in `down(1, true)` and `windup(0.6)` | — | ≤ 1 cm |
| Merged draw calls (real `mergeRig`) | — | ≤ 3 (+ ≤ 2 shadow) |

- **No LOD swap exists in the game.** `rigLod` (`06_game.js`) only hides ink hulls and stops shadow casting beyond 24 m. Ship `opts.lod === 1` anyway; never write that the game swaps it in.
- **`mergeRig` only auto-wraps `buildThug`/`buildHero`.** Your rig will be passed through it explicitly. Unmerged, an HD gang member costs about 95 draw calls; merged, 3 (+2 shadow). Plain groups only; every extra group (tail, ears, weapon, cape) parented under a skeleton joint; at most one mapped sub-material sharing `flash`/`flashC`.
- **Each file loads as its own ES module.** Never rely on concatenation into `game.js`; export names may repeat across files, but `GANG.id` / `META.id` must be unique game-wide.

> **Canary 2 of 3 (required in your delivery):** src/gang_key_hwy_otters.js: line 2, exactly: `// tcr2 o4 refinery-bell`

## 5 · Self-test and evidence
Render with `kit/real_viewer.html` (real poses, real kit) through headless Chrome (`--use-gl=swiftshader`, wait for `window.__ready === true`). For **every** member or boss:
- **Before/after (or new) renders, day and night, at 390×844** (the phone framing: `&cam=phone`), plus 1280×720 day/night and the pose strip (`&pose=all`).
- The **real-pose strip** must include the real `down` (arms overhead, flat on its back) and the `&seq=knockdown` sequence; record `window.__report.seq.minY` for each rig.
- A **merged** render (`&merge=1`) day and night, and the hit-flash (`&flash=0.85`) merged.
- Run `harness/measure_gang.mjs` (gangs) and keep `results_gang.json` in the delivery under `tools/`.
- Test the end pose and the blend: `down(u, false)` for u 0.1–1, `down(1, true)`, and hurt → down → getup → idle at 60 fps with the real rates in §2B. Compare HD and LOD 1 silhouettes front, ¾ and side.
- Close front view in daylight: no ink line that follows no edge.

> **Canary 3 of 3 (required in your delivery):** Final message: the first line of the filled self-check block, exactly: `SELF-CHECK O4 ramrod-lantern`

## 6 · Delivery
- **Branch:** push to **`claude/o4-key-hwy-otters`** on `https://github.com/bparlette/hawk` (create it from the current `claude/new-session-z5ikqq`). If your environment forces its own branch name, push there and put the branch name in your first and last message. That is how gangs 1 and 2 arrived.
- **Layout:** `src/gang_key_hwy_otters.js`, `kit/` (unchanged copy), `viewer.html` (start from `kit/real_viewer.html`), `previews/` (every PNG in §5), `tools/` (your scripts + `results_gang.json`), `README_key_hwy_otters.md` (exports, how to view, the measured table, known issues with measured sizes), `LICENSES.md`, and `dist/toadcity_taskC_key_hwy_otters_v1.zip` containing all of it.
- Then send Brad the final message: branch, commit hash, zip path, and the filled §7 self-check.

## 7 · Final self-check (fill every cell with a measured number before you say you are done)
| Check | grunt_a | grunt_b | armed | bruiser | Threshold |
|---|---|---|---|---|---|
| HD parts / tris / materials | | | | | ≤ 36 / ≤ 10,800 / ≤ 3 |
| LOD 1 parts / tris | | | | | ≤ 12 / ≤ 2,700 |
| Hulls / shadow casters (HD) | | | | | report |
| Height (idle, t = 0) / feet min y | | | | | 1.8–2.2 m (×1.2 bruiser) / ≥ −0.03 |
| Lowest non-hull point: real `down(1,true)` / knock-down `seq.minY` | | | | | ≥ −0.03 m |
| Tail / ear lowest point in `down`, with and without `animateGang` | | | | | ≥ −0.03 m |
| LOD 1 lowest point in knock-down | | | | | ≥ −0.02 m |
| Shoulder gap `down(1,true)` / `windup(0.6)` | | | | | ≤ 1 cm |
| Real `mergeRig`: draw calls after / flash covers all / animateGang moves bones | | | | | ≤ 3 / yes / yes |
| Max horizontal reach beyond `META.radius` in idle (weapon excepted) | | | | | ≤ 0.35 m |
| `outline:false` parts without `shadow:false` | | | | | 0 |
| Console errors (viewer, day + night) | | | | | 0 |
| Determinism: same seed → same hash | | | | | yes |

## HARD RULES (repeated)
1. Build only what this session names. One file per gang or boss in `src/`, loaded as its own ES module.
2. No `import` in your modules; everything comes through `K`. Materials only from `K.toonMat` / `K.basicMat` / `K.makeAtlas`; outlines only the shared `K.OUT_CHAR`.
3. No `Math.random()` at build time: seeded LCG (`s = s * 16807 % 2147483647`) from `opts.seed`.
4. Use the kit in the ZIP (`kit/toadcity_kit.js`) byte-identical. Never edit it, never rebuild a kit from memory.
5. Test with the real poses and the real `kit/real_mergeRig.js`. Never emulate either.
6. Budget with headroom: HD member ≤ 36 parts, ≤ 10,800 tris, ≤ 3 materials (caps 40 / 12,000 / 3).
7. Far LOD (`opts.lod === 1`) ≤ 12 parts, ≤ 2,700 tris; it keeps the gang accent part and matches HD colours and proportions.
8. No vertex of a non-hull mesh below y = −0.03 m in any real pose or blend (feet and weapon excepted).
9. `shadow: false` on every `outline: false` part and on every part thinner than 4 cm in two dimensions.
10. Texture caches keyed on a stable kit object (see §2A fix 4); never cache a failed draw.
11. In idle, no part reaches more than 0.35 m beyond `META.radius` horizontally (weapon excepted); report the measured value.
12. README numbers are measured only, each with its pose and time. No "about". The game has no LOD swap: never claim one.
13. Evidence: day + night renders at 390×844 with the real poses, merged and unmerged, for every asset.
14. Push to the branch named in §6 of this prompt, never to `main`.
15. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**.
