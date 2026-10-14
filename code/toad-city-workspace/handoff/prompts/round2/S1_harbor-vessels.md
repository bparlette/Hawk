# S1 · Harbor vessels: USS Torsk, Lightship Chesapeake, Pride of Baltimore II, small boats
**For:** Claude Sonnet · **Setting:** Claude Sonnet (newest), extended thinking ON, medium effort (high for the first asset, because it sets the pattern). · **Depends on:** None (parallel with S1–S3). · **Delivers to: `claude/s1-harbor-vessels`**

Attach `Toad_City_Round2_SONNET.zip` to this chat together with this prompt. Everything bulky (code, references, renders) is in the ZIP; this prompt names the files.

## HARD RULES (read first; repeated at the very end)
1. Build only what this session names. Each file in `src/` loads as its own ES module and exports a unique `META_<MODULE>` (e.g. `META_HARBOR_VESSELS`), never a bare `META`.
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
14. Push to the branch named in §6 of this prompt, never to `main`.
15. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**.

## Step 0 · Comprehension check (your FIRST reply; write no code and produce no deliverable until Brad answers GO)
1. **List every file in the ZIP** (full path) and say in a few words what you will use it for.
2. **Restate, numbered and in your own words, every HARD RULE above and every lesson or fix row in §2** (one line each).
3. **Answer these questions.** Every answer is in the sections below; quote the exact number, name or code.
   - Q1. In the Task A review, by how much did stoops and cornices overhang the block box, and what inset fixes it?
   - Q2. Why did the parked pickup's lights float 7 m away, and why did your previews miss it?
   - Q3. What was wrong with the arabber canopy?
   - Q4. Give the exact texture/atlas cache key expression for round 2.
   - Q5. What must every module export instead of a bare `META`?
   - Q6. What is the delivery branch name?
   - Q7. What is the footprint limit for the USS Torsk, and the scale rule?
   - Q8. Which small boat already exists and must not be rebuilt?
4. **Quote the three canary instructions** this prompt contains (they are marked "Canary 1/2/3 of 3" somewhere in the middle) and confirm you will include each string exactly.

Then stop and wait. Brad checks your answers; if any is wrong he will send you back to re-read.

## ZIP contents
| ZIP path | What it is |
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
| `prompts/` | All Sonnet round-2 session prompts (S1–S3). |

## 1 · Context
**Toad City Baltimore** is a phone-first, cel-shaded open-world brawler on Baltimore's Inner Harbor (three.js r160, plain ES modules, everything procedural: no image, model or font files; real Baltimore signage is redrawn on canvas). Static city geometry goes through the kit's `out` collector (`out.solid / decal / glow / coll / bld / lamp / hook / build`) and is merged into the game's 64 m render chunks. Moving things (boats, rideables) are their own `THREE.Group` with the vehicle contract `{ root, kind, seats, collider, waterline, animate }`.

You get one ZIP (`Toad_City_Round2_SONNET.zip`): the **real** starter kit (last round it never reached you and you rebuilt one), the Task A/B review, Hark's fixed copies of your Task A/B modules, the measuring harness, before/after renders, the in-house car rebuild as the quality bar, and the game's landmark hook objects. This prompt points at those files by name.

## 2 · Where you fell short last round and how we fixed it
Your Task A/B delivery (`claude/new-session-j5l7sz`, `45f3041`) was clean, deterministic and inside every budget, and its README numbers were exact. The rowhouses read as Baltimore at 9 m. But six visible or gameplay bugs were **not disclosed**, and none showed in your own previews, because every asset was checked only at position (0, 0) and yaw 0, on a reconstructed kit, with pavement laid outside the block. Hark's integration worker is fixing them in-house; the status column was read from the fixed files (`reference/taskAB_fixed/`, look for the `fix M1`… comments) when this ZIP was built.

| # | Before (finding, measured) | After (fix) | Status at ZIP build |
|---|---|---|---|
| M1 | Stone water table (1.25 m band) ran across the bottom of every rowhouse door: the stoop climbed into stone (door y 0.76–2.81 vs band 0.16–1.41). | Band split around `doorU ± 0.65`, marble threshold added at the sill. | Fixed in-house |
| M2 | Arabber canopy: the half-cylinder swept theta 0..π, so it stood as a striped wall on one side of the cart. | Theta starts at π/2 so the arc spans the top. | Fixed in-house |
| M3 | Pony floated 0.20 m: leg pivot at 1.2 with 1.0 m legs. | Pivot at 1.0, hooves on y = 0. | Fixed in-house |
| M4 | Parked pickup head/tail-light glows placed twice (`fin()` on already-placed geometry): at (10, 5) yaw π/2 they floated 7 m away. | Glow quads built from fresh local geometry; cars are being rebuilt in-house anyway. | Superseded: cars rebuilt in-house (in progress) |
| M5 | Corner downspout buried in the wall (z −0.12..−0.02) and the climb hook inside the collider: blocks with seed 4 and 16 had no usable climb. | Pipe and hook moved to the front of the wall (+0.07 / +0.12). | Fixed in-house |
| M6 | Stoops and cornices overhung the block box by up to 1.83 m; your street view hid it by laying pavement outside the block. In the game the plot is raised to CURB and roads are at y 0, so stoops would hang over the road. | `opts.inset` (integration passes the plot with a 2 m inset; a 20 m box builds cleanly for 30 seeds). | Fixed in-house |
| m1 | Climb `top` and camera-box `h` measured from the kerb in Task A but world y in Task B (0.16 m apart). | World y everywhere: `CURB + parTop`. | Fixed in-house |
| m2 | Yard bin lids at the bin row centre, not on their bins. | Lid reuses the bin x. | Fixed in-house |
| m3 | Crab shack posts poke 8.5 cm through the roof, back wall stops 37 cm short, neon floats with no frame, collider misses pots/barrels/easel. | Posts cut to the roof line, frame added, collider widened. | Fixed in-house |
| m4 | Arabber 'stand' seat floated behind the cart with no step. | Rear running board; seat on it. | Fixed in-house |
| m5 | `PROP_TILES` fallback unguarded in 4 of 5 Task B files (bare ReferenceError as ES modules). | `typeof` guard and a clear error everywhere. | Fixed in-house |
| m6 | `K.makeAtlas._props`: a cache written onto a kit function. | Module-level `WeakMap`. | Fixed in-house |
| m7 | Your viewer did not run on the real kit (`applyLight` signature, pose functions, joint names): "one-line change" was several. | Round 2 ships the real kit: your viewer must run on it unchanged. | Round-2 rule (applies to your new work) |
| m8 | Dragon-boat paddles `frustumCulled = false`: a draw call and a shadow call every frame even off screen. | Fixed bounding sphere. | Fixed in-house |
| m9 | Corner bar's OPEN neon hidden behind the awning (only 'EN' showed). | Moved into the glass-block window below the awning. | Fixed in-house |
| m10 | README claims wrong: "open side windows" were dark panels; "3 casting meshes" were 2. | Measured-only README. | Round-2 rule (applies to your new work) |
| m11 | Formstone read as regular coursed stone; real Formstone is irregular faux stone. | Irregular tiles. | Fixed in-house |
| m12 | Sedan, hatch, box truck at exactly 7/7 meshes, skateboard 3/3: no headroom. | ≥ 10 % headroom required in round 2. | Round-2 rule (applies to your new work) |
| m13 | Every file exported `META`: concatenation failed with "Identifier META has already been declared". | Renamed to `META_ROWHOUSE`, `META_CORNER`, … ; round 2 requires unique `META_<MODULE>` names. | Fixed in-house |

Lessons to apply in every round-2 asset (each comes from a row above):
1. Test at a non-zero position and yaw (M4) and in a street laid out the game's way (M6), not only at the origin.
2. Check every curved or partial primitive's orientation from three sides (M2).
3. Measure ground contact of every leg, wheel, hull and post (M3, m3).
4. Hooks must be reachable: outside colliders, on a visible surface, world-y heights (M5, m1, m4).
5. Colliders cover everything a character could walk through (m3).
6. No writing onto `K`; caches in module `WeakMap`s; `typeof` guards (m5, m6).
7. Nothing with `frustumCulled = false` (m8); no text hidden behind other geometry (m9).
8. README claims must be measured or seen, never assumed (m10); leave headroom (m12); unique `META_<MODULE>` names (m13).

**Texture and atlas caches:** key every module-level cache on `K.QUAL || K.THREE || K` (integration may pass a fresh `{...K}` per call), and never store a failed draw.

### The quality bar: the in-house car rebuild
Your v1 cars were flat-profile boxes with dark side panels standing in for windows (`previews/quality_bar/sedan_v1_day.png`). Hark is rebuilding them in-house as real 3D cel-shaded vehicles (`previews/quality_bar/cars_rebuild_sheet.png`, work in progress): see-through glass with a visible interior (seats, wheel), real wheel arches, chrome side trim and bumpers, distinct sedan / pickup / box-truck / hatchback silhouettes, lit head and tail lights, readable canvas liveries. **That is the bar for every vessel and prop in round 2:** real depth, real openings, distinct silhouettes, readable lettering. Cars are out of scope this round: do not build any.

## 3 · The task: Harbor vessels: USS Torsk, Lightship Chesapeake, Pride of Baltimore II, small boats
Build the harbour's historic ships and working boats. Real names and liveries are drawn on canvas (allowed: they really are in the Inner Harbor). No logos copied from images.

| id | What | Contract | Notes |
|---|---|---|---|
| `uss_torsk` | **USS Torsk (SS-423)**, a Tench-class WWII submarine, museum ship at Pier 3 | static prop (`out`) | Long dark-grey hull, raised deck, conning tower (sail) with periscope shears, deck gun, the hull number **423** in white, the shark-mouth paint at the bow. Moored: the waterline sits on the water plane. |
| `lightship_chesapeake` | **Lightship Chesapeake (LV-116)**, museum ship at Pier 3 | static prop (`out`) | **Red hull** with **CHESAPEAKE** in large white letters on both sides, white superstructure, the lantern mast(s) with a light that glows at night (`out.glow`), a funnel. |
| `pride_of_baltimore_ii` | **Pride of Baltimore II**, a topsail schooner (Baltimore clipper type) | static prop (`out`) | Black hull with a thin coloured stripe, raked masts, square topsails + fore-and-aft sails (furled or set: pick one, say which), long bowsprit, ensign. Moored. |
| `police_boat` | Harbour police patrol boat | vehicle | White/blue patrol livery with **POLICE** lettering (generic city styling, no real badge art), light bar that flashes at night in `animate`. 2 seats. |
| `tugboat` | Harbour tug | vehicle | Classic Baltimore harbour tug look: high bow fendering, wheelhouse, stack. 1 seat. |
| `kayak` | Single kayak (and a seeded colour variant) | vehicle | Paddle animates in `animate(dt, speed)`. 1 seat, rider sits low. |
| `paddle_boat_dock` | Paddle-boat rental dock (the dragon paddle boats' dock) | static prop (`out`) | Floating dock + gangway + ticket booth + a few berths; `out.hook('board', {x, z, ang})` per berth. **Check `reference/taskAB_v1/veh_boats.js` first:** the paddle boat itself already exists; build only the dock. |

**Scale rule (same as the in-game USS Constellation, see `reference/game_hooks/constellation_scale.md`):** lengths compressed to about 1/3 of real, beam and height about 1/2, so hatches, rails and doors still fit 2 m characters. Footprints you must stay inside (bow along +Z, centred on x = 0, z = 0):

> **Canary 1 of 3 (required in your delivery):** README.md: the last section heading, exactly: `## Vessel Check 410`

## 4 · Interface and budgets
Static ships: `export function buildUssTorsk(K, out, atlas, x, z, ang = 0, opts = {})` (same for each static id; `atlas = K.makeAtlas(VESSEL_TILES)` from your own tiles file, one atlas ≤ 1024² for the whole session). Write only through `out`; register `out.coll(...)` for the hull, `out.bld(...)` camera boxes, `out.lamp(...)` for any lamp, `out.hook('climb'|'board', …)` where a hero can get on.
Vehicles: `export function buildPoliceBoat(K, opts = {})` returns `{ root, kind: 'boat', seats, collider, waterline, animate(dt, speed, steer) }` exactly like `veh_boats.js` in `reference/taskAB_v1/`. `waterline` is the local y of the water plane; `root` sits so the water plane is y = 0 locally and the game puts it at `WY = −0.85`.
- Pier deck top is `CURB = 0.16`; the water surface is `WY = −0.85`. Moored hulls sit with their waterline at y = −0.85 world (static) and must not intersect the pier volume.
- Footprint (length × beam, hard limits including bowsprit and fenders): Torsk ≤ 30 × 4 m, Lightship ≤ 14 × 4.5 m, Pride II ≤ 17 × 4 m (mast tops ≤ 18 m), police boat ≤ 7 × 2.6 m, tug ≤ 9 × 3.4 m, kayak ≤ 3.6 × 0.8 m, dock ≤ 14 × 6 m.

| Asset | Cap | Round-2 target (≥ 10 % headroom) |
|---|---|---|
| `uss_torsk` | 6,000 tris | ≤ 5,400 |
| `lightship_chesapeake` | 5,000 tris | ≤ 4,500 |
| `pride_of_baltimore_ii` | 7,000 tris (rigging as thin decal quads with `shadow:false`) | ≤ 6,300 |
| `police_boat` | 2,500 tris, 6 meshes, 2 materials | ≤ 2,250, ≤ 5 meshes |
| `tugboat` | 3,000 tris, 7 meshes | ≤ 2,700, ≤ 6 meshes |
| `kayak` | 600 tris, 3 meshes | ≤ 540, ≤ 2 meshes |
| `paddle_boat_dock` | 2,000 tris | ≤ 1,800 |
| Static pieces | merge into the chunk: 0 extra draw calls | 0 |

> **Canary 2 of 3 (required in your delivery):** Every src/*.js file: line 2, exactly: `// tcr2 s1 torsk-periscope`

## 5 · Self-test and evidence
- Serve the ZIP root and open `kit/viewer.html` (or your own viewer started from it) on the **real kit**. Day, night (N), every asset.
- Render every asset at **390×844, day and night**, at gameplay distance (6–10 m), plus 1280×720 day/night. Headless Chrome with `--use-gl=swiftshader`; wait for `window.__ready === true`.
- Build every asset at the origin **and** at (10, 5) with yaw π/2; diff their bounding boxes (glows, decals, colliders and hooks must move with the body).
- Run the relevant `harness_ab/` script against your `src/` and keep the JSON under `tools/`.
- Zero console errors.

> **Canary 3 of 3 (required in your delivery):** Final message: the first line of the filled self-check block, exactly: `SELF-CHECK S1 lv116-lantern`

## 6 · Delivery
- **Branch:** push to **`claude/s1-harbor-vessels`** on `https://github.com/bparlette/hawk`. If your environment forces its own branch name, push there and name it in your first and last message. That is how Task A/B arrived (`claude/new-session-j5l7sz`).
- **Layout:** `src/` (your modules), `kit/` (unchanged copy of the ZIP kit), `viewer.html`, `previews/` (every PNG in §5), `tools/`, `README.md` (exports, how to view, measured table, known issues with measured sizes), `LICENSES.md`, `dist/toadcity_s1_harbor_vessels_v1.zip`.
- Final message to Brad: branch, commit, zip path, and the filled §7.

## 7 · Final self-check (measured numbers only)
| Asset | Tris | Meshes | Footprint L × B (measured) | Waterline / deck contact | Overhang outside footprint | Moved at (10,5) yaw π/2: everything moved | Day + night 390×844 rendered | Console errors |
|---|---|---|---|---|---|---|---|---|
| uss_torsk | | — | | | | | | |
| lightship_chesapeake | | — | | | | | | |
| pride_of_baltimore_ii | | — | | | | | | |
| police_boat | | | | | | | | |
| tugboat | | | | | | | | |
| kayak | | | | | | | | |
| paddle_boat_dock | | — | | | | | | |
| **Threshold** | §4 targets | §4 targets | §4 footprints | waterline at −0.85 world | 0 m | yes | yes | 0 |

## HARD RULES (repeated)
1. Build only what this session names. Each file in `src/` loads as its own ES module and exports a unique `META_<MODULE>` (e.g. `META_HARBOR_VESSELS`), never a bare `META`.
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
14. Push to the branch named in §6 of this prompt, never to `main`.
15. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**.
