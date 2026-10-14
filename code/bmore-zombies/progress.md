# Toad City: Dead Streets — progress
- 2026-10-14 00:12 start. Sandbox heavily loaded (shell timeouts). Orienting from bmore-paperboy (same brief pattern; its tools reused).
- Layout: tools/extract.py copies Toad City modules read-only from /workspace/work/toad-city/game-int/src (hark/integration) — 01_core (+halftone patch), 02_atlas, 03_kit, 03b WTC, 03f Fells Point, 04_actors, 04b_rig_merge, 05_fx.
  Game = src/10_dz_world.js (map grid, city build, flow fields), 11_dz_horde.js (instanced horde, specials, explosions), 12_dz_game.js (player, weapons, barricades, gates, boss, taxi, stages, HUD, input, audio, bot, loop), src/index.html.
  tools/build.sh -> site/. QA: tools/runqa.sh <w> <h> smoke|win|lose|perf|shots (chrome.flock, port 8796) -> qa/*.log, qa/shots/.
- Route: W Pratt St -> HOLD Pratt & Light (40s, gate 1) -> E Pratt past WTC -> HOLD President St (45s, gate 2) -> Fells Point -> FINALE Broadway Pier (90s + The Harbor Hulk boss) -> board water taxi.
- Hawk sparse clone: /workspace/work/bmore-zombies/hawk (branch main from FETCH_HEAD).
- 00:55 first build OK (syntax). Smoke QA queued behind the shared chrome lock.
- 01:55 smoke 1280x720 ran: boot 1.7 s, attract title, stage 0 -> 1 reached by bot (282 kills), PAUSE_OK on hidden tab; 303 pageerrors all from one bug (spatial hash not initialised before first rehash, hit by the title attract bot) -> fixed. Camera lowered/more oblique, keys legend fades after 25 s, advance() snaps camera.
- 02:00 batch queued (one lock hold): 1280 win, 390 smoke, 390 lose, 1280 perf, 390 perf, 540x960@2x capture (Short frames), 1280 lose. Publish tooling ready: tools/push-hawk.sh + tools/entry.json, tools/make_short.sh.
- 02:09 win run 1280x720 (earlier build): 0 game errors; bot cleared stages 0-4, holds + gates worked, retry-checkpoint worked, boss fight rendered (shot win-boss.png), but bot died 3x to the Hulk charge (boss 4432/5200) -> no win yet. Never picked up shotgun/SMG crates.
  Fixes: Hulk HP 5200->3400, charge 13->11.5 m/s, 34->26 dmg; bot dodges charge lane/slam; crates moved to open road spots + 1.8 m pickup; zombie bodies built from low-poly primitives (horde budget); scrap/ammo pickup cap 24; harness death-card race fixed; build.sh now atomic.
- 02:15 batch 1 results (0 game errors everywhere): 390 smoke OK (stage 0->1, PAUSE_OK); 390 lose: death card -> RETRY_CP_OK, RESTART_OK; perf 1280: 523 alive / 523 drawn, 1.69M tris, sim 0.9 ms/step; perf 390: 520 alive/drawn, 1.67M tris, sim 1.09 ms/step; SwiftShader real-render 0.5-1.6 fps (software GL cap).
  Balance: Mavis purse 34->22 dmg, 0.8->0.95 s (a standing player survived 200 s on stage 0); stage 0 spawn 1.5->2.2/s. Portrait camera widened (27 up / 19 back, fov 66).
  Short capture at 1080x1920 was ~20 s/frame -> killed; now 540x960 @1x, 0.1 s sim per frame, upscaled by ffmpeg (tools/make_short.sh).
- 02:27 batch 2 queued: 1280 win, 390 win, capture, 1280 perf, 1280 lose.
- 02:52 batch 2: 0 game errors. 1280 lose RETRY_CP_OK + RESTART_OK. perf 1280: 523 alive/drawn, sim 2.83 ms/step at 523 (no bot), body tris ~1.06-1.78k per zombie type, 1.69M scene tris. Bot (no god) reached the finale but died (spitter, own bomb) and harness race on death card -> fixed (cards resolved via __dz.card). Bot still skipped weapon crates -> crate goal now overrides route; crate pickup 2.4 m; bomb self-damage radius 2.6 m.
  Short: shorts/toad-city-dead-streets-short.mp4 (1080x1920, 30 fps, 10.4 s, silent, 104 real frames from the capture plan). Thumb: shorts/thumb.webp (640x400) from a 1280x720 boss-fight QA frame.
- 02:55 batch 3 queued: 1280 wingod, 390 wingod, 1280 win (no god), 390 smoke.
- 03:03 batch 3: WIN FLOW VERIFIED (god mode, test-only) at 1280x720 and 390x844: shotgun/SMG/harpoon crates collected, barricades built + broken, both gates, Hulk down, taxi docked, results card, PLAY AGAIN -> REPLAY_OK, 0 errors; peak 544 / 514 alive. Fixed: S.won never reset (2nd run couldn't win); accuracy now per trigger pull; escape = chase cam on the taxi.
  No-god bot: through stage 4 with 1 death, then 6 finale attempts, best Hulk at 588 HP -> eased finale: ramp 30->22/s, cap 660->560, Hulk 3400->3000, spit 10->8, checkpoint retry = full HP.
- 03:05 final batch: 1280 win (no god), 390 smoke, 1280 wingod.
