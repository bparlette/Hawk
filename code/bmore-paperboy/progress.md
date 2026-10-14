# Toad City Paperboy — progress

Brief (Brad via Hark, 2026-10-13): Paperboy-style bike delivery on the SAME Toad City Baltimore assets + code. Standalone copy; Toad City repo untouched.

## Layout
- `tools/extract.py` copies modules read-only from `/workspace/work/toad-city/game-int/src` (hark/integration) with provenance headers:
  01_core (renderer, toon/cel, ink hulls; + halftone patch in HD post), 02_atlas (city atlas, real-name signs), 03_kit (from 03_city: MB/CMB builders,
  building(), lamp/trafficLight/hydrant/bin/car/tree, sky), 03b_hd (HB builder, SA sign atlas, sText, World Trade Center builder),
  03f_fells (B3 helpers + Fells Point Thames St block with real signs), 04_actors (Harold/Mavis rigs + poses), 04b_rig_merge, 05_fx (comic FX + sfx).
- `src/10_paperboy.js` = the game. `src/index.html` = page (system fonts only). `tools/build.sh` -> `site/` (index.html, game.js, three.module.min.js).
- QA: `tools/runqa.sh <w> <h> smoke|week|god|lose` (headless, under toad-city/locks/chrome.flock) -> `qa/*.log`, `qa/shots/`.

## Game
- Route: E Fort Ave (Locust Point), 4 blocks x 7 rowhouses + corner stores, cross streets Lawrence / Woodall / Hull / Beason.
- Subscribers = painted fronts + red mailbox flag + SUN sticker; non-subscribers dark/formstone/vacant plywood.
- Mailbox 250 (PERFECT), door/stoop 100, non-sub window smash 100+; sub window = cancel. Bundles +10 papers. 3 lives.
- Obstacles: traffic both ways + cross traffic, hon ladies (Mavis rig), dogs (chase), arabber cart, pigeons, potholes, bins/hydrants/trees/lamps.
- Day tally: missed/broken subs cancel; perfect day = +1000, +1 life, +1 new subscriber. Bonus BMX course (ramps, targets, cones, timer) by Fells Point.
- Mon..Sun rising difficulty; Sunday at sunrise light. Win card after Sunday; game over (lives 0 or no subs) -> RETRY from Monday.
- Test params: ?bot=1, ?bot=lose, ?god=1, ?day=N, ?fast=1. window.__pb.advance(sec) fast-forwards for headless QA.

## Status (2026-10-14 ~05:00 ET)
- Build OK (site/game.js ~198 KB + local three.module.min.js r160 copied from Toad City). Copied from toad-city game-int @ e1aaac3.
- Headless QA (SwiftShader, tools/qa.js), all 0 console errors / 0 page errors / 0 failed requests, no horizontal overflow:
  - 1280x720 smoke: Mon route -> tally (16/16 kept, 2 PERFECT) -> bonus course cleared -> Tue card.
  - 1280x720 god (bot, no-crash test flag): full week Mon..Sun, 7 tallies + 7 bonus courses, WEEK COMPLETE card, score 31,730.
  - 1280x720 week (bot, real crashes): game over on Tuesday (arabber collisions; fixed respawn so the cart is moved clear).
  - 390x844 smoke (touch emulation, tap buttons): Mon route + bonus + Tue card.
  - 390x844 lose (bot rides into traffic): GAME OVER card after 3 car crashes, tap RETRY -> Monday, score 0, 3 lives (RETRY_OK).
  - Headless FPS (software GL, not representative of a phone GPU): 1280x720 ~1.4-1.6 fps, 390x844 ~3.5 fps. Scene: 57-86 draw calls, 90-150k tris.
- Inside Brad's Demos (html.demo-embed) the page hides its own stick/throw button; shell keys W/A/S/D + J (throw) + Enter + P/M.
- Thumb: shorts/thumb.webp (640x400, real Sunday gameplay frame). Short: tools/cap.js frames -> shorts/ (in progress).
