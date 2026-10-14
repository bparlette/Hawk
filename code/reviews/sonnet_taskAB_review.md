# Review: Sonnet's Task A (rowhouse kit) and Task B (props and vehicles) for Toad City Baltimore

- **Repo and branch:** `github.com/bparlette/Hawk`, branch `claude/new-session-j5l7sz`
- **Commit:** `45f304127f96cf3322daf1bb1e6b8c8937374f09`. It sits on top of `8bc940e` (Task B) and `ee613f2` (Task A). Cloned at `/workspace/work/reviews/hawk-ab`.
- **Review only.** I changed nothing in the repo, pushed nothing, posted no comments and opened no PRs.
- **Where my work is:** all scripts and renders are in `/workspace/work/reviews/scratch_ab/`.
  - Node harness: `measure_ab.mjs` → `results_ab.json`
  - Bug probes: `checks_ab.mjs` → `checks_ab.json`, plus `block20.mjs`
  - Concatenation test: `concat_check.sh`
  - Headless renders: `shoot_ab.mjs` and `run.sh`. The output is in `shots/` and the `rep*.json` reports.
  - Three key bugs in one picture: `evidence_sheet.png`
- **Compared against:**
  - The real game in `/workspace/work/toad-city/game/src` (`01_core.js`, `02_atlas.js`, `03_city.js`, `04_actors.js`, `04b_rig_merge.js`)
  - The starter kit we wrote: `/workspace/work/toad-city/handoff/kit/toadcity_kit.js`
  - The task prompts `TASK_A_rowhouse_city_block_kit.md` and `TASK_B_street_props_vehicles.md`
  - The PDF `Toad_City_Brief_SONNET.pdf`, extracted to `scratch_ab/brief.txt`

## Verdict: ship with fixes

The code is clean, compact and deterministic. It passes every budget with a lot of headroom, and the numbers in the READMEs are real: I re-measured them exactly, both in their viewer and in an independent Node harness.

I built every asset against two kits: the kit Sonnet reconstructed, and the starter kit we actually wrote. All 28 assets give byte-identical geometry on both. So the reconstruction did not leak into `src/`.

The rowhouses read as Baltimore at 9 m on a 390×844 screen:
- marble stoops with rails
- bracketed cornices with dentils
- painted screens
- Formstone and brick fronts
- a believable corner bar and corner shop

They are a clear step up from the game's current generic blocks, which are flat tiled boxes.

**What stops "ship as is":**
- **A visible bug on every rowhouse.** The stone water table runs across the bottom of the door, so the stoop climbs into a stone band.
- **Three broken Task B visuals:**
  - the arabber canopy stands on one side of the cart instead of arching over it;
  - the pony hovers 20 cm off the ground;
  - a parked pickup's head and tail lights float away from it at night.
- **A gameplay bug.** When the block's one climb hook lands on a corner building, it sits inside a collider on a drainpipe that is buried in the wall.
- **An undisclosed fit problem with the game.** Stoops and cornices stick out up to 1.83 m past the box you pass in. Their viewer hides this by laying pavement outside the block. In the game, the pavement is inside the 24 m plot.

All the code fixes together are about 1–2 hours. The integration adapter is extra (see "Drop-in fit against the real game").

---

## Was the starter zip really missing from what we shipped?

**Yes.**
- The PDF says the kit "comes as `toadcity_starter_kit.zip`".
- `handoff/build/gen.py` only uses that name in the text. Nothing in the build makes a zip.
- No file of that name exists anywhere in `/workspace`.
- The four kit files do exist, unzipped, in `handoff/kit/`. I cannot tell whether Brad attached that folder some other way.

The brief also tells the model to rebuild the kit from the appendix if the files are missing, so the reconstruction was the expected fallback.

**How faithful the reconstruction is:**
- **Prop and city core.** I took the 165 appendix lines (kit lines 1–86, 88–107 and 398–456). After normalising whitespace, every one appears verbatim in their `toadcity_kit.js`. Zero differences.
- **What they made up.** These are the parts the appendix leaves out:
  - the rig and poses (`HERO_D`/`THUG_D` values, `blank()` returning `{hipsY}`, `THUG_POSES` as objects rather than functions);
  - the lighting (`applyLight(rig, name)` instead of our `applyLight(scene, hemi, sun, name, fill)`).
  - None of it matches our kit. The modules never touch it.
- **What they added to `K`.** `CURB`, `GF`, `FH`, `PAR`, `WY`, which are not in our kit's `K`.
  - The modules always read them with fallbacks (`K.CURB ?? 0.16`).
  - That is why geometry comes out identical against our kit, which has no `CURB`.

---

## Findings by severity

### BLOCKER
None.

### MAJOR

**M1. The stone water table covers the bottom of every rowhouse door.**
- **Where:** `src/rowkit_rowhouse.js:114` against `:131-135`.
- **What is wrong:** The water table is a box across the full house width: 1.25 m high (y 0.16–1.41 in world), with its front face at 10 cm. The door decal sits at 4 cm, and its bottom is at the stoop height (0.6–1.0 m). So the water table hides the lowest 0.25–0.65 m of the door.
- **What you see:** The top step meets a stone band and the door starts above it. I measured door y 0.76–2.81 against water table y 0.16–1.41.
- **Where it shows:** in my renders (`shots/stoops_close_day.png`, `facade_A_9m_*.png`, left panel of `evidence_sheet.png`) and in Sonnet's own hero preview `previews/rowkit_phone_390x844.png` (houses 524 and 612). It is visible on every house at gameplay distance.
- **Fix:** split the water table into two boxes, leaving `doorU ± 0.65` open. Or end it at `sill` inside the door bay. Add a marble threshold at `sill`.

**M2. The arabber canopy is a vertical half-barrel on one side of the cart.**
- **Where:** `src/veh_carts.js:50`.
- **What is wrong:** `CylinderGeometry(..., thetaStart i·π/6, π/6)` over 6 pieces sweeps theta 0..π. That is the +X half of the cylinder. After `rotateX(π/2)` it stays the +X half, standing vertically. Measured pieces span x 0..0.9, y 1.72..3.52.
- **What you see:** a striped wall on the right of the cart, open on the left (centre panel of `evidence_sheet.png`). The cart's signature silhouette is wrong from every angle except dead side-on.
- **Fix:** use theta from −π/2 to π/2, or rotate the result by `rotateZ(π/2)` so the arc spans the top.

**M3. The pony floats 0.20 m above the road.**
- **Where:** `src/veh_carts.js:69-72`.
- **What is wrong:** The legs pivot at y = 1.2. Each leg reaches down 1.0 m to the bottom of the hoof (two tubes to −0.9, hoof box centred at −0.95, 0.1 tall). Measured hoof min y is 0.200 on all four legs. The cart wheels touch the ground.
- **What you see:** visible at 6–10 m, and the walk cycle makes it obvious.
- **Fix:** pivot at y = 1.0, or lengthen the shin by 0.2.

**M4. A parked pickup's head and tail-light glows are placed twice.**
- **Where:** `src/veh_cars.js:165`.
- **What is wrong:** `P(hl, …)` already runs `fin()` on `hl` in place (`K.place` mutates the geometry). Then `out.glow(fin(hl.clone().translate(0, 0, 0.004)))` places the clone a second time.
- **Why it hides:** at (0, 0, 0) with yaw 0 this is invisible, which is the only case the single-asset previews show.
- **Measured:** at (10, 5) with yaw π/2, the body sits at x 7.2–12.7, z 4.0–6.0. The glows sit at x 14.0–16.0, z −7.7 to −2.3.
- **What you see:** two red tail-light dots hang in the air in their own `show=props` night row (right panel of `evidence_sheet.png`). Every parked pickup in the city would scatter lights around at night.
- **Fix:** build the glow quad from fresh local geometry before calling `fin`, as `vcParked` does for the sedan.

**M5. A block's climb hook can be unreachable when it lands on a corner building.**
- **Where:** `src/rowkit_corner.js:191` and `:197`.
- **What is wrong:** The corner downspout sits at off = −0.07, radius 0.05, so it spans z −0.12..−0.02. That is entirely inside the front wall, so it is invisible. The climb hook sits at local (−cs·(W/2−0.12), −0.12), which is inside the building's collider.
- **How often:** `buildRowBlock` picks exactly one climb piece per block at random. Over seeds 1–20 the hook was inside a collider for seeds 4 and 16. Those blocks have no usable CLIMB at all.
- **Fix:** use off +0.07 for the pipe and toWorld(…, +0.12) for the hook, as the rowhouse does (`rowkit_rowhouse.js:163-177`). Or leave corner pieces out of `climbAt`.

**M6. The block's footprint does not match the game's plot layout. Not disclosed.**
- **Where:** `src/rowkit_block.js:51-54`, and `viewer.html:255-256`.
- **What it does:** Fronts are built on the edges of the box you pass in. Stoops (up to 1.8 m) and cornices stick out past it. Over 20 seeds, up to 1.83 m of geometry below 1.2 m height leaves the box.
- **What their viewer hides:** in `?show=street`, the 10 m "street" is a 5 m roadway plus two 2.5 m pavements laid outside the blocks.
- **What the game does:**
  - The 24 m plot is raised to `CURB` (0.16) and roads are at y 0 (`03_city.js:131`, `groundY`).
  - Generic buildings are inset 3 m inside the plot (`03_city.js:194`, `ix0 = b.x0 + 3`).
  - So passing the plot box puts stoops over the road, floating 0.16 m up.
  - Passing the 3 m inset box (18 m) breaks the layout: the west and east rows become 3 m houses.
- **What works (my test):** a 2 m inset box (20 m) builds cleanly for all 30 seeds. Nothing overhangs the plot and the narrowest house is 4.21 m (`block20.mjs`).
- **Fix:** document it and give `buildRowBlock` an explicit `frontInset` or `pavement` option. Integration should pass `x0+2 … x1−2`.

### MINOR

- **m1. Climb-hook `top` and camera-box `h` use different references in A and B.**
  - **Where:** `rowkit_rowhouse.js:176-177` and `rowkit_corner.js:196-197` send `top: parTop` and `bld.h: parTop`, measured from the kerb (12.15 for a 3-storey house). `props_street.js:138` and `:149` send `top: C + top`, which is world height (6.16).
  - **What goes wrong:** the game's climb code will be 0.16 m off for one of the two sets.
  - **Fix:** use world y everywhere: `CURB + parTop`.
- **m2. Yard bin lids are not on the bins.**
  - **Where:** `rowkit_block.js:102`.
  - **What is wrong:** the bodies sit at `cxy + (yr()−0.5)·1.2`, but every lid sits at `cxy`. Measured bins at x 11.51 / 12.26 / 12.20 against lids at 12.00, so lids hang half off.
  - **Fix:** reuse the same x for the lid.
- **m3. Crab shack geometry gaps.**
  - **Where:** `props_crab_shack.js:29`, `:30`, `:39`, `:50`, `:63`.
  - **Posts against the sloped roof:** the front posts poke 8.5 cm through the roof (post top 2.82, roof top 2.735). The back posts stop 12.6 cm under it.
  - **Back wall:** its top is at 2.575 and the roof underside there is 2.95, so there is a 37 cm gap.
  - **Neon:** the CRABS tubes float above the board with no frame (`shots/crab_34_night.png`).
  - **Collider:** it covers x ±2.1, but the crab pots (to −2.99), barrels (to 2.73) and easel (to 2.70) are outside it, so characters walk through them.
  - **Fix:** cut the posts to the roof line, add a neon frame, and widen the collider or add circles.
- **m4. The arabber's standing seat floats behind the cart.**
  - **Where:** `veh_carts.js:75`.
  - **What is wrong:** the 'stand' anchor is at y 0.5, at the extreme rear of the collider (z −3.14). That is 10 cm behind the end board, with no step under it.
  - **Fix:** add a rear step box at y 0.5, or move the anchor onto the floor (y 0.92, inside the cart).
- **m5. The `PROP_TILES` fallback is unguarded in four of the five Task B files.**
  - **Where:** `props_street.js:22`, `props_crab_shack.js:10`, `veh_boats.js:18`, `veh_carts.js:16` all read `PROP_TILES` directly. Only `veh_cars.js:24` checks `typeof PROP_TILES`.
  - **What goes wrong:** used as ES modules without `opts.atlas`, they throw a bare ReferenceError.
  - The fallback works in a concatenated build: I checked that the game source plus these modules parse together.
  - **Fix:** use the same `typeof` guard everywhere and a clear error message.
- **m6. `K.makeAtlas._props` stores a cache as a property on a kit function.**
  - **Where:** the same five files.
  - **What is wrong:** it is a hidden global keyed to the function object. It works, but it is the only place the modules write to anything on `K`.
  - **Fix:** a module-level `let` cache, or have the caller always pass `opts.atlas`.
- **m7. Their viewer does not run on our real starter kit.**
  - **Where:** README_A "Kit" says it "may need a one-line change". `viewer.html:91-109` and `:271` disagree.
  - **What I found:** with `handoff/kit/toadcity_kit.js` swapped in, the page fails:
    - `applyLight(rig, name)` crashes with "reading 'sky'";
    - `haroldDummy` crashes with "setting 'tilt'", because our `THUG_POSES` are functions and our joint names differ.
  - It needs several edits, not one. The modules themselves are unaffected.
- **m8. The dragon boat paddles are never frustum-culled.**
  - **Where:** `veh_boats.js:151`, `paddles.frustumCulled = false`.
  - **What it costs:** 1 draw call and 1 shadow call every frame, even when the boat is off screen. It also re-uploads about 1,440 vertices of position and normal data every frame.
  - **Fix:** set a fixed bounding sphere instead.
- **m9. The corner bar's OPEN neon is mostly hidden behind the awning.**
  - **Where:** `rowkit_corner.js:171`, y = 2.2 behind an awning at 2.55–3.0. Only "EN" shows in `shots/corner_bar_phone_*.png`.
- **m10. The README's claims about window cut-outs and shadow casters are not right.**
  - "The front side windows are open (dark cut-outs)" (README_B and `veh_cars.js:68`). They are dark panels on a solid body, not openings.
  - The lean-out still reads fine from outside, because the rider's hidden half is inside the body.
  - "Shadow pass (the 3 casting meshes)" (README_A). Only 2 meshes cast shadows: the toon mesh and the decal mesh.
- **m11. The Formstone tiles read as regular coursed stone.** Real Formstone is irregular faux stone. Next to brick it still reads as "stone front", and the brief explicitly asks for "irregular blocks". This is subjective.
- **m12. The vehicle mesh count leaves no headroom.**
  - Counting meshes without the ink hull is defensible (see "Claims I verified"). But under that reading `car_sedan`, `car_hatch` and `box_truck` sit at exactly 7 of 7, and `skateboard` at 3 of 3. With the hull they are 8 and 4.
- **m13. META collides when the files are concatenated.** This was disclosed, and the brief causes it.
  - Stripping `export` and appending all ten files gives `SyntaxError: Identifier 'META' has already been declared`.
  - With META renamed per file, both the modules alone and the real game source plus modules pass `node --check` (`concat_check.sh`). No other top-level name collides.
  - Our integration step has to rename it, for every vendor.

### NIT

- **Dead or leftover code:**
  - `veh_cars.js:101`: `if (w.x < 0) mesh.rotation.y = 0;`
  - `rowkit_corner.js:150`: `wallColor` is unused, and so is the `sh` parameter of `band` (`:147`).
  - Dragon boat: `speed > 0.1 ? 0.0 : 0.0` (`veh_boats.js:157`), and `*0.0` terms in the teeth and mane placement.
  - `void A` in `vcPickup`.
- **The car body rolls into turns instead of out of them.** `veh_cars.js:108` uses `-steer`, which leans toward +X on a left turn. That is only about 1.8°.
- **The manhole cover top is at y 0.017–0.019,** not the 0.005 the brief asks for. The ring decal sits only 1.5 mm above the cover cylinder (`props_street.js:123-124`), which risks z-fighting at range on mobile depth buffers.
- **The basement grille quad is 3 mm in front of the water-table face** (`rowkit_rowhouse.js:126`, 0.103 against 0.100). There is no z-fighting in my renders, but it is the tightest gap in the kit.
- **The front number plate floats 3 cm in front of the bumper** (`veh_cars.js:80`).
- **Blade signs show mirrored text from behind,** because the decal material is DoubleSide. That is normal for a one-plane sign.

---

## Brief compliance

### Task A checklist

| Item | Result | Evidence |
|---|---|---|
| Five pieces with the exact signatures; `?show=street` shows two blocks across a 10 m street with pavement, day and night | **Pass (with a caveat)** | All signatures match. The street renders with no errors. But the "10 m street" is 5 m of road plus 2.5 m pavements outside the blocks (M6). |
| Formstone, marble stoops, bracketed cornices, painted screens, corner bar, corner shop present and recognisable | **Pass** | Renders in `shots/`. Six screen designs. Formstone reads as regular stone (m11). |
| 3- and 4-storey variants, at least 3 front types, at least 4 screen designs | **Pass** | Formstone, brick, painted brick, permastone. 6 screens. |
| Budgets: house ≤ 2.5k, corner ≤ 3.5k, block ≤ 30k tris; block ≤ 4 draw calls; one atlas | **Pass** | House 1,516 (4-storey 1,684). Corner 2,102 / 1,988. Block 14,038 including hulls (13.9k–15.2k over 40 seeds). Always 4 draw calls. One 60-tile atlas. |
| Night: about 45% lit, seeded and stable; shop glass and neon glow | **Pass** | 44.6% over 40 seeds (32–54% per block). Identical on rebuild. Night renders checked. |
| Colliders, camera boxes, climb hooks; nothing floats; nothing below CURB | **Partial** | Minimum y is 0.160 over 40 seeds. Exactly one climb hook per block. But: the hook can be unreachable (M5), lids float (m2), and the door is buried (M1). |
| Same seed gives the same block; a different seed differs visibly | **Pass** | SHA-1 over all vertex attributes plus colliders and hooks matches for the same seed, even with other builds in between. Different seeds differ. Zero `Math.random` calls from module code (all 25k calls trace to three.js UUIDs). |
| Signs read as real Baltimore, all canvas or geometry; LICENSES.md present | **Pass** | Natty Boh-style, Utz and Old Bay are redrawn on canvas. No image files in the repo apart from the previews. LICENSES.md is present. |

### Task B checklist

| Item | Result | Evidence |
|---|---|---|
| Every prop and vehicle exists with the exact signature and return shape | **Pass** | 12 static props plus the recycling variant, and 8 vehicles. Each vehicle returns `{root, kind, seats, collider, waterline, animate}` (plus an extra `parts`). |
| `?show=props` and `?show=vehicles` work with `animate()` running | **Pass** | Rendered with no errors, including the standalone `distB` folder. |
| Budgets measured and in the README; one atlas | **Pass** | All figures match my measurement exactly (table below). One 13-tile atlas. |
| Hooks: manhole, climb, seat, lamps | **Pass** | All counts verified. |
| Night previews: lamp globes, headlights and signs glowing and readable | **Partial** | They glow, but parked pickup lights float away (M4). The cobra-head lens glows only from below. |
| Seats line up with the hero rig; collider matches the visible hull | **Partial** | Colliders are the bounding box (verified). The arabber 'stand' seat floats (m4). The seats were checked against their reconstructed Harold dummy, not our real Harold. |
| Liveries use real names, redrawn; LICENSES.md | **Pass, unverified** | Redrawn on canvas. Accuracy against the real vehicles was not checked (disclosed). |

---

## Budget claims re-measured

Measured three ways and identical each time: their viewer's `window.__api.measure()`, my Node harness, and a build against our real starter kit.

| Asset | Tris incl. hulls (README / measured) | Meshes + hulls | Draw calls | Shadow casters | Materials |
|---|---|---|---|---|---|
| rowhouse (seed 3) | 1,516 / 1,516 | 3+1 | 4 | 2 | 4 |
| rowhouse_4 | 1,684 / 1,684 | 3+1 | 4 | 2 | 4 |
| corner_bar | 2,102 / 2,102 | 3+1 | 4 | 2 | 4 |
| corner_shop | 1,988 / 1,988 | 3+1 | 4 | 2 | 4 |
| block (seed 11) | 14,038 / 14,038 (12,804 without hulls) | 3+1 | 4 | 2 | 4 |
| car_sedan | 922 / 922 | 7+1 | 8 | 6 | 5 |
| box_truck | 840 / 840 | 7+1 | 8 | 6 | 5 |
| arabber_cart | 2,869 / 2,869 | 10+1 | 11 | 9 | 5 |
| water_taxi | 1,118 / 1,118 | 4+1 | 5 | 3 | 5 |
| dragon_boat | 1,975 / 1,975 | 4+1 | 5 | 3 | 5 |
| crab_shack | 1,208 / 1,208 | merged | 0 own | — | — |

All the other props in `results_ab.json` also match: lamps 310 / 200, benches 150 / 126, trash 88 / 188, manhole 50, ladders 206 / 124, parked cars 618 / 610 / 634, paddle boat 1,212, hatch 914, skateboard 376.

---

## Drop-in fit against the real game

The game concatenates the source files (`build.sh`: `cat src/0*.js > site/game.js`), so I checked these modules against that setup.

**What the game has:**
- `THREE`
- `place` (`03_city.js:76`, same signature)
- `toonMat` (`01_core.js:92`, signature `(opts, tiled)`, so `toonMat()` works)
- `CURB`, `GF`, `FH` (`03_city.js:83`, same values 0.16 / 4.4 / 3.4)

**What it does not have:**
- **No kit object.** There is no `K`, `makeOut`, `makeAtlas`, `basicMat`, `GLOW_MAT` or `mergeGeoms` anywhere in `game/src`.
- **A different city material.** The game's `CITY_MAT` is a tiled-atlas material that needs a `tr` attribute (`02_atlas.js:146`).
- **No city outlines.** The city outline builder `OL` is a no-op class (`03_city.js:70`).
- **No glow mesh.** Night windows come from an emissive-atlas hash in the shader.
- **Different lamp and climb data.** Lamps are pushed as `{x, z, y, px, pz}` by `lampAt` (`03_city.js:577-578`). Climbing is a `LADDER` stub (`03_city.js:593`).

**What that means:** the `out` collector these modules write into is the design of our starter kit, not game code. To integrate we must write a small adapter `makeOut` and `makeAtlas`:
- `solid` → `CB.geom(g, col)`
- `decal` → a per-chunk mesh with the kit atlas material
- `glow` → a new per-chunk glow layer
- `coll` → `COLL`, `bld` → `BLD`
- `lamp` → `LAMPS` (converted)
- `hook` → a new hook table

That adapter is about 1–3 hours. It would be the same for any vendor. Our brief's line "if your module runs in the kit viewer, it runs in the game" is not literally true for Tasks A and B.

**Other fit points:**
- Concatenation only works after META is renamed (m13).
- The `typeof buildRowhouse` fallback in `rowkit_block.js:37-39` works in the concatenated scope. As ES modules it throws a clear error unless `opts.builders` is passed.
- No module touches `window` or `document`. The only `document.createElement` calls come from the kit's own `makeAtlas`.
- Each zip unzips and runs standalone with zero errors: `scratch_ab/distA` (street, block night) and `distB` (props, vehicles night). The zip `src/` files are byte-identical to the repo `src/`.

## Draw-call reality (game at about 130–250 calls today, about 190 is the mobile target)

**If each block is its own `out.build()`:**
- 4 calls plus 2 shadow-pass calls per block.
- The game has 24 generic blocks. With about 8–14 visible from street level, that is +48 to +84 calls.
- That breaks the 190 target on its own.

**If everything is routed into the game's 64 m chunk builders (the right way):**
- The toon geometry joins the existing `CB` mesh at no extra cost.
- Each visible chunk adds:
  - +1 glow layer
  - +1 Task A atlas mesh
  - +1 Task B atlas mesh where props exist
  - optionally +1 city hull (the game currently draws no city outline)
  - plus 1–2 shadow calls
- About 4–5 calls × roughly 5–6 visible chunks is **about +20–30 calls**.
- On a busy 250-call view that lands at 270–280. On a typical view it fits under 190.
- Replacing the current generic buildings saves nothing, because they already share the chunk meshes.
- The kit's `GLOW_MAT` uses opacity 0 by day, so the glow layer still costs a call in daytime. That is a kit design issue (ours): hide the mesh by day.

**Vehicles are their own groups:**
- A drivable car is 8 calls plus 6 shadow casters, about 14.
- The arabber cart is 11 + 9.
- Boats are 5 + 3. The dragon boat paddles are never culled (m8).
- That is fine for the one vehicle the player is on. Ambient traffic must use the merged `parked_car_*` versions, or merge the wheels.

**Triangles:** 24 blocks × about 14k = about 340k for the city. About 110–200k are in view.

**Build cost:**
- A block's geometry took 39.7 ms here, plus 4.7 ms for `out.build()`. That was on this sandbox's ARM CPU in Node. The author measured 45–80 ms on a desktop.
- On a phone, expect about 100–200 ms per block, so about 2.5–5 s for all 24. Build one block per frame or behind the loading screen.
- `animate()` makes no per-frame allocations (I read the code). The dragon boat takes 12.6 µs per frame and the cart 0.8 µs.

**iOS Safari:** the only newer syntax is `??` (Safari 13.1+) and `Array.prototype.flat` (12+). No `?.`, logical assignment, `.at()`, `structuredClone`, `roundRect` or lookbehind regex.

---

## Claims I verified

- The kit's prop and city core is the appendix verbatim (165 of 165 lines). The modules use only `K.THREE`, `place`, `makeOut`, `makeAtlas` and `toonMat`, plus `CURB`, `GF` and `FH` with fallbacks.
- All 28 assets give identical geometry against our real starter kit.
- Every budget number in both READMEs is exact.
- A block is always 4 draw calls (40 seeds). Each task uses one atlas: A has 60 tiles in 880 px of height, B has 13 tiles.
- Determinism: same seed, same hash; a different seed differs. The modules call `Math.random` zero times. The canvas call log of each atlas is identical between builds.
- 45% of windows lit at night (44.6% over 40 seeds), stable on rebuild.
- Task A never dips below `CURB` (minimum y 0.160).
- Exactly one climb hook per block. 28 colliders at seed 11. The yard strip is closed by a collider.
- No `window` or `document` use in `src/`. Concatenation collides only on `META`.
- Both zips match `src/`, run standalone and show zero console errors.
- No text decal is mirrored, for either value of `cs` and all four `ang` values. I checked the decal UV handedness against the face normal.
- Facing and `ang` handling, the left/right neighbour logic, the corner `cs` mirroring and the collider AABBs are all correct. I read the code and checked the renders.
- `animate()` makes no per-frame allocations. Boat waterline semantics match the brief.
- Counting vehicle "meshes" without hulls is defensible. The brief's own contract comment counts the body as "3–4 draw calls" (toon, hull, glow, decal) inside a mesh cap, and its reference table counts "a mesh plus an ink hull" as one part. But see m12 on headroom.
- The house depth inside a block (7.5 m and 10.5 m against 12–14 m standalone) is disclosed and geometrically necessary. A 24 m block with frontage on all four streets plus a 3 m yard cannot hold 12–14 m deep houses on every side.

## Claims I could not verify, and why

- **Real-phone frame rate and Safari behaviour.** I had no device, and the renders were done in SwiftShader Chromium.
- **Z-fighting on real mobile depth buffers.** I saw none at 390×844 with near plane 0.2. The risk spots are listed under NIT.
- **Livery and wording accuracy** for the water taxi, Utz truck, Old Bay and arabber cart. This was disclosed and not researched here. "HANOVER, PA · FRESH SINCE 1921" matches Utz's public history from my general knowledge only.
- **iOS font fallback for the signs.** It needs a device.
- **Whether the kit reached Sonnet some other way.** I can only say that no starter zip exists in the workspace.
- **Seat fit against the real Harold.** Their dummy is the reconstructed rig. I did not re-pose our Harold on the seats.

## Things the author did not disclose

1. The water table buries the bottom of every door (M1). It is visible in their own phone preview.
2. The arabber canopy has the wrong orientation (M2).
3. The pony floats 0.2 m (M3).
4. Parked pickup lights are placed twice (M4).
5. The corner downspout is buried in the wall, and the climb hook can sit inside a collider (M5).
6. Stoops and cornices overhang the block box by up to 1.83 m. Their street view puts the pavement outside the blocks, which does not match the game's plots (M6).
7. The viewer needs several changes, not "one line", to run on the real kit (m7).
8. Climb `top` and `bld.h` use different references in A and B (m1).
9. The crab shack collider leaves out its pots, barrels and easel. Its posts and roof do not meet (m3).
10. The shadow-caster count in README_A is wrong (m10).
11. Not the author's fault, but worth knowing: the game has no `makeOut` or `makeAtlas`, so we owe an adapter.

---

## Bottom line

**Is it at the project's quality standard?** Not yet as delivered, because of five visible or gameplay bugs (M1–M5). After about 1–2 hours of fixes it is at or above our standard. The rowhouse kit looks better than our current generic city.

**Does it save us time?** Yes. It is 28 finished, budget-safe, deterministic assets in about 1,800 lines, which would take us several sessions. The remaining cost is the fixes above plus the `makeOut` adapter (about 1–3 hours) that any vendor's delivery would need.
