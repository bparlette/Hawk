# Toad City Skate — progress

Brad's brief (2026-10-13 22:44): Tony Hawk-style skate game on the SAME EXACT Baltimore assets + code as Toad City Baltimore.
Standalone; Toad City repo / branches / surge site untouched. Publish to bparlette/Hawk main `brad-demos/g/toad-city-skate/`.

## Source
- `tc/` = verbatim copies of toad-city `game-int` (branch hark/integration, HEAD e1aaac3) modules:
  01_core (renderer, toonMat cel bands, inverted-hull ink outlines), 02_atlas (city atlas, halftone, comicText), 03_city (the whole Inner Harbor city:
  blocks, rowhouses, props, piers, water, sky, lamps), 03b/03c/03d/03e/03f (HD landmarks with real signage), 04_actors (pose API), 04c_rigs (procedural
  SDF rig system), 05_fx (comic FX sprites, WebAudio bus).
  Only change: one RES line in tc/03_city.js reserving the empty Pratt St block x 2..26 z -70..-46 for the skate rowhouse row.
  (04b_rig_merge not needed: no part-stack rigs are built.)
- `src/` = the skate game:
  - 10_district.js: skate props built with Toad City's own lmHD/HB/SA kit: 6 Italianate rowhouses (brick / formstone / painted, marble stoops,
    iron stoop rails, painted window screens), harbour benches, granite ledges, harbour railing, Pratt St funbox + flat bar, 3 kickers, pickups, gaps.
  - 20_skater.js: TAD (young toad skater) on the 04c rig system (SDF body, same skeleton, toonMat + skinned ink hull) + procedural board + poses.
  - 30_play.js: skate sim (ride, push, carve, ollie, flips, grabs, spins, grinds/slides with balance, manuals, bails, respawn) + trick scoring/combo.
  - 40_hud.js: keyboard, touch stick + buttons, gamepad, HUD.
  - 50_audio.js: WebAudio skate SFX + procedural Baltimore club loop.
  - 60_main.js: run flow (title, 3-2-1, 2:00, results, retry), chase camera, visuals, juice, goals.
  - 70_bot.js: QA autopilot (?bot=route|loop|wander) driving the real inputs.
- `build.sh` -> dist/index.html (+ three.module.min.js beside it). `index.tpl.html` = HUD + CSS.
- QA: qa/probe.js (plan-driven headless runs), qa/run.sh (queues under /workspace/work/toad-city/locks/chrome.flock, run with setsid nohup).

## Log
- 2026-10-14 ~05:00: first boot clean (0 errors), city + skater render. Bot route in progress.
- 2026-10-14 07:44 UTC: bot tuned. Autopilot (route = lap + Constellation tape line + laps) now clears FUNBOX GAP, HARBOR GAP (slow tight right turn east of the railing end, retry on bail), harbour rail (K), Pratt St kicker (E, wide swing east for a straight run-up), stoop rails (T, line z -50.05 = the rail), secret tape (then rolls off the pier end: the water respawn drops Tad on the promenade by the pier), in a loop.
  Changes: Constellation kicker moved 2.5 m back (z -23.1..-20.5) + tape z -17.6 (room to land); letter E y 3.0 z -39.3. Bot: committed turn direction when facing away, uturn wps never "passed from behind", retry/splash wp flags.
  Bot run (qa/bot1.log, ?bot=route&sim=8&lowq 1280x720): 33,537 pts, best combo 5,013, ALL 5 GOALS, 1 bail (the planned splash), 0 console errors.
- publish.py: games.json written with indent=1 and no trailing newline (the file's real format on main), entry inserted right after toad-city-paperboy.
- 2026-10-14 ~08:30 UTC (finisher 2, after sandbox restart): verified bot1 (33,537 / 5 goals / 1 planned splash / 0 errors), p2 portrait flow 390x844 (title, pause/resume, results, one-tap retry -> count, 0 errors), 1280x720 default-quality run (qa/tf2.log, 0 errors), feet check qa/feet_side.png + feet_back.png (sneakers sit on the deck).
  thumb.webp = qa/b1_30.png (real bot run, harbour + stoop-combo GOAL) cropped 16:10 -> 640x400 (main's thumbs are 640x400).
  publish.py fixed: main games.json is now indent=2, ensure_ascii=False, no trailing newline -> format detected by exact round-trip, refuses to write if not reproducible; entry placed after the last toad-city-* entry.
  PUBLISHED: commits 3f58e2d (index.html) 0a7ce75 (three.module.min.js) 4b8b542 (thumb) 12fd235 (games.json, +42 lines only, after toad-city-drone).
  Live https://bparlette.github.io/Hawk/brad-demos/g/toad-city-skate/index.html -> 200, qa/live.js (Chrome via curl-fed routes; sandbox proxy blocks Chrome) 0 console errors, boots to title, Enter -> countdown.
