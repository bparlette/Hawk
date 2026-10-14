# Toad City Rooftops — progress

Rooftop parkour game on the Toad City Baltimore city. Brad: "Same exact Baltimore assets city and code."

## Layout
- `src/01_core.js … 05_fx.js` — copied verbatim from `/workspace/work/toad-city/game-int/src` (branch hark/integration, HEAD e1aaac3): renderer, toon/cel material, inverted-hull ink outlines, the city atlas, the whole city kit (rowhouse blocks with sunk roofs, parapets, rooftop units, water towers, fire escapes), all HD landmarks with real signage (batches 1-3, Lexington, stadiums), sky, night FX, rig kit (skeleton/part/poses), comic FX, sfx bus.
- `src/10_rt_kit.js` — reads the city's own BLD/COLL data into solids + walkable roofs; course generator (crate stairs, ladders, scaffold decks, wall-run billboards, ducts to slide under, vents to vault, zip lines; finish zip into the landmark).
- `src/11_rt_runner.js` — SKIP the roof runner (Toad City rig kit) + parkour poses.
- `src/12_rt_player.js` — controller: momentum/flow, jump (coyote/buffer/variable), vault, mantle/ledge grab, wall run, wall climb, wall jump, ladders, slide, landing roll, hard landing, zip lines, falls.
- `src/13_rt_drone.js` — FOXTROT police drone chaser with searchlight lock-on.
- `src/14_rt_audio.js` — synthesized wind / steps / landings / drone / zip + procedural Baltimore-club loop.
- `src/15_rt_main.js` — 3 courses, camera (FOV + speed lines + halftone post), HUD, Toad City arcade panel (touch), keyboard/gamepad, flow, medals, results, retry, bot (?bot=1).
- `site/` — build output (`./build.sh` concatenates src/*.js → site/game.js). `three.module.min.js`, `panel.webp`, `stick.webp` copied from Toad City.
- `T/` — headless QA (`T/bg.sh <log> <script> …` runs under the shared chrome flock).

## Courses
1. PRATT STREET → HARBORPLACE (day)
2. FEDERAL HILL → hilltop park (dusk)
3. FELLS POINT → market (night)

## Status
- 2026-10-13 late: modules written, first build passes node --check. QA in progress.
- 2026-10-14 ~09:00 UTC (finisher 2): bot stuck spots fixed, all three courses finish with ?bot=1 (T/s8.log, 0 errors): PRATT 19.8 s, FEDERAL HILL 20.4 s, FELLS POINT 20.0 s.
  Fixes: (1) a wall's grab height = top of whatever is stacked on it (roof slab + parapet) so mantles land on the parapet, not inside it; (2) ground vault only when the landing is not higher than you, vault lands at the real floor, post-mantle floor snap looks 0.6 m up (was dropping runners to the street -> "fell"); (3) ground auto-mantle up to 1.8 m; (4) no "fell" within 12 m of the street-level finish landmark (Fells Point's last zip drops you beside the market); (5) bot unstick: no course progress for 0.7 s on the ground -> jump (FELLS uses it once at s=134, corner cut into the side of the last crate stair).
  MEDALS set from bot times: pratt [23,29,36], fedhill [24,30,37], fells [23,29,36].
  Clone at hawk/ is empty (git checkout failed) -> publish via tools/publish.py (contents API, same as bmore-skate/publish.py; games.json format verified by exact round-trip). tools/stage.py thumbs now 640x400 like main's.
  QA (T/qa9.log): 1280x720 course 0 L: menu 3 cards, no overflow, busted -> RETRY -> count, fall -> "fell", RESTART, bot win 19.80 GOLD, results, RETRY -> count, 0 errors.
  390x844 course 2 P: menu, busted, retry, (fall step teleported onto another roof -> busted instead of fell: QA-harness limit), restart, bot win 18.86 GOLD, results, retry, 0 errors, no overflow.
  PUBLISHED: 7c0eb3f (index.html) 10118bf (three.module.min.js) 6b0a757 (thumb, from T/qa/L_04_run_mid.png) 8e0a0b1 (games.json +34 lines, after toad-city-skate).
  Live https://bparlette.github.io/Hawk/brad-demos/g/toad-city-rooftops/index.html -> 200, 0 console errors (bmore-skate/qa/live.js), boots + countdown.
