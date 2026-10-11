# vendor/taskAB: Sonnet's Task A (rowhouse kit) + Task B (props, vehicles), fixed and wired into Toad City

Source: github.com/bparlette/Hawk, branch `claude/new-session-j5l7sz`, commit `45f3041` (`src/`). Copied here and fixed in place.
The review with every finding is `/workspace/work/reviews/sonnet_taskAB_review.md`. Nothing was pushed or posted to GitHub.

`gen.sh` (run by `../../build.sh`) concatenates these files into `src/02b_taskab_vendor.js` (`export` stripped). `src/02c_taskab.js` is the adapter
that builds the kit object `K` from the game's globals and routes every `out` call into the game's own city builders.

## Fixes (review id -> what changed)

| id | file | fix |
|---|---|---|
| M1 | rowkit_rowhouse.js | The stone water table and its cap are split around the door bay (`doorU +- 0.65`). A marble threshold sits at the sill. The door now meets the top step. |
| M2 | veh_carts.js | Canopy theta runs from pi/2 to 3pi/2, which is the arc over the cart after `rotateX`. It also gets a painted underside, so it shows from below and behind. |
| M3 | veh_carts.js | The leg pivot moved from y 1.2 to y 1.0, so the hooves stand on y = 0. |
| M4 | veh_cars.js | The cars were rebuilt (see below). Every glow quad is built from fresh car-space geometry and placed once. A check confirms each light stays inside its car's box at 3 poses for every kind. |
| M5 | rowkit_corner.js | The corner downspout is outside the wall, 0.27 m out, so it clears the 0.2 m pilaster. It hangs on four wall straps and has a shoe. The climb hook sits in front of the pipe. Over seeds 1-40, every block has exactly one hook. That hook is outside every collider, a 0.45 m hero fits within ACT range of it, and a visible pipe is beside it. |
| M6 | rowkit_block.js | New `opts.inset`. The game passes the 24 m plot with `inset: 2`. Nothing overhangs the plot: the largest low overhang is -0.17 m over 40 seeds. Nothing sits below CURB. |
| m1 | rowhouse, corner | Climb `top` and camera-box `h` are both world y (`CURB + parapet top`), the same reference the props use. |
| m2 | rowkit_block.js | Each yard bin lid sits on its own bin. |
| m3 | props_crab_shack.js | Posts are cut to the sloped roof's underside, and the back wall reaches the roof. The CRABS neon stands on a dark raceway. The collider covers the pots, barrels and easel. |
| m4 | veh_carts.js | A rear running board was added under the arabber's `stand` seat, which now sits at y 0.5, z -2.43. |
| m5 / m6 | all Task B files | `PROP_TILES` is guarded with a clear error ("pass opts.atlas ..."). The atlas cache lives in a module-level `WeakMap`, and nothing is written onto `K`. |
| m8 | veh_boats.js | The dragon-boat paddles are frustum-culled against a fixed sphere that holds every stroke angle. |
| m9 | rowkit_corner.js | The bar's OPEN neon moved into the glass-block window, below the awning. |
| m11 | rowkit_tiles.js | Formstone is now irregular faux stone: rows that wander, stones that span two rows, lumpy 6-8 sided outlines, deep mortar and aggregate speckle. |
| m13 | all | Each file has its own `META_*` name, so the ten files concatenate. |
| nits | | Removed dead code (`wallColor`, `sh`, `* 0.0` terms). The manhole top is now at 0.005 (it was 0.017). The basement grille has a 9 mm clearance. The car body rolls out of a turn. |

## API additions (all backwards-compatible)

- `buildRowBlock(..., { inset, p3 })`
  - `inset` shrinks the box before building (default 0).
  - `p3` is the share of 3-storey houses (default 0.55; Fells Point uses 0.9).
- `veh_cars.js` adds:
  - `buildParkedCar(K, out, x, z, ang, { kind, seed })`, where `kind` is one of `sedan`, `hatch`, `wagon`, `minivan`, `pickup`, `cab`
  - `buildCarWagon`, `buildCarMinivan`, `buildCarPickup`, `buildCarCab`
  - The old names still work: `buildCarSedan`, `buildCarHatch`, `buildBoxTruck`, `buildParkedCarSedan`, `buildParkedCarHatchback`, `buildParkedCarPickup`.
- `out.glass(geom)` is optional. The geometry carries an RGBA colour attribute. A kit without `glass` gets an opaque tinted pane through `out.solid`.

## Corrections to the delivered READMEs

- "Front side windows are open (dark cut-outs)": that was not true. They were dark panels on a solid body. The rebuilt cars have real transparent glass over a modelled interior.
- "Shadow pass (the 3 casting meshes)": only 2 meshes ever cast (toon + decal). In the game, the kit's large masses cast through the city chunks. Small parts (under 0.9 m) go to the non-casting ground chunks.
- The viewer needs more than "a one-line change" to run on the real starter kit (review m7). The game uses `02c_taskab.js` instead of the viewer.
- The block's footprint overhang (M6) is now documented and controlled by `inset`.

## Rebuilt cars (veh_cars.js)

Each car has these parts:
- a lofted lower body with a chamfered sill and shoulder, a 1.5 cm side crease, a tapered nose and tail, and a grimy rocker
- a separate tapered greenhouse: raked windshield, tumblehome to a bevelled roof, A / B / C pillars, black belt and drip trims
- transparent tinted glass with a glossy streak, over a dash, steering wheel, seat backs and headrests
- dark wheel wells with fender lips, and tyres with sidewalls and hubcaps (white walls on the old sedans)
- chrome or black bumpers, a grille, head and tail lamps that glow at night, mirrors, door seams and handles, a rub strip and Maryland plates
- seeded period paint plus a little grime

The box truck has an Utz-style or MOVING & STORAGE livery, a roll-up door and marker lights. The cab has a lit roof sign and a checker band.

**Drivable vehicles** (incl. ink hull): 1.8k-2.0k tris and 7 meshes. The box truck has 8 meshes:
- body
- hull
- glass
- glow
- livery decal (truck only)
- 3 wheel meshes (front left, front right, rear pair)

**Parked cars** (incl. hull): 1.6k-1.85k tris, merged into the city chunks. `animate()` allocates nothing.
