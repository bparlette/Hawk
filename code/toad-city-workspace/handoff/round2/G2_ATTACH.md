# G2 (Gemini QA of Sonnet Task A/B after Hark's fixes): files to attach

Zip with all of these: `/workspace/work/toad-city/handoff/round2/G2_attachments.zip` (3.1 MB, 15 files).
Attach it **together with** `Toad_City_Round2_GEMINI.zip` (from the G2 page:
https://toad-city-r2-gemini-g2-qa-sonnet-taskab-fixed-2cd88e.surge.sh/).

Built 2026-10-11 from game commit c2a95c8 (vendor/taskAB at that commit). The Gemini ZIP's
`reference/taskAB_fixed/` was regenerated the same evening and matches these files byte for byte.
The attachment zip is the authoritative copy.

**Status note:** the fix pass is committed locally (c2a95c8) but **not deployed** to the live game yet.
The mobile bot check ran short of HEAD (see PROGRESS.md). The vendor files themselves are final, so G2 can review them now.
Don't tell Gemini the fixes are live in the game.

## Fixed vendor/taskAB files (`taskAB_fixed/`)
| file | what it is |
|---|---|
| rowkit_rowhouse.js | Task A rowhouse (M1 door/water table, m1 world-y hooks) |
| rowkit_corner.js | corner bar / corner shop (M5 downspout + climb hook, m9 OPEN neon) |
| rowkit_block.js | block builder (M6 `inset`, `p3`, m2 bin lids) |
| rowkit_tiles.js | façade atlas (m11 Formstone) |
| props_street.js | lamps, bins, benches, manholes (m5/m6 atlas guard + WeakMap cache) |
| props_tiles.js | prop atlas |
| props_crab_shack.js | crab shack (m3 posts/roof/collider/neon raceway) |
| veh_carts.js | arabber cart + pony (M2 canopy, M3 hooves, m4 running board) |
| veh_boats.js | dragon paddle boats (m8 paddle culling) |
| veh_cars.js | cars **rebuilt in-house** (M4 glows): sedan, hatch, wagon, minivan, pickup, cab, box truck, `buildParkedCar` |
| README.md | fix table (review id → change), API additions, corrections to Sonnet's READMEs, rebuilt-car notes |
| taskAB_v1_to_fixed.diff | full diff from Sonnet's delivered `src/` (commit 45f3041) to these files |

## After-fix preview PNGs (`previews_after_fix/`)
| file | shows |
|---|---|
| taskAB_fixes_before_after.png | BEFORE / AFTER for M1 door, M2 canopy, M3 hooves, M4 pickup glows, M5 corner climb point, M6 2 m inset |
| taskAB_cars_before_after.png | delivered cars vs the in-house rebuild, so G2 can score the cars against `previews/taskAB/cars_rebuild_sheet.png` |
| taskAB_street_day_night.png | in game, phone 390x844: rowhouse blocks + props + parked cars, side street and cross street, day and night |

Source paths: `/workspace/work/toad-city/game/vendor/taskAB/*`,
`/workspace/work/toad-city/handoff/round2/build/sonnet_extra/taskAB_fixed/taskAB_v1_to_fixed.diff`,
`/workspace/work/toad-city/assets_preview/taskAB_{fixes_before_after,cars_before_after,street_day_night}.png`.
Not included: `gen.sh` (game build glue, not part of the kit). Never attach `ANSWER_KEYS.md`.
