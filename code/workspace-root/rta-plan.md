# Retro Throwback Arcade — overnight work queue

Hark Page project: name "Retro Throwback Arcade", project_id f182f4b1-a65a-4e1a-913c-75093138d052 (edit with website_coding_agent action=edit; never create a new site; ignore duplicate cc022d74...).
Published file: /workspace/built/sites/f182f4b1-a65a-4e1a-913c-75093138d052/index.html (one inline script; game objects `var name = {...}` before `var GAMES = [...]`; shell after).

## Quality bar (user's words, non-negotiable)
- Nothing worse than his Jungle Fury (Contra-style, /workspace/work/ghpush/jf.html) and Tober's Nightmare (/workspace/work/ghpush/tober.html). Much more detail: shaded multi-color sprites with outlines, animated frames, layered parallax backgrounds, particles, screen shake, hit flashes, music/SFX.
- Controls: ALWAYS a large circular touch stick (like jf.html lines 79-90: 8-way, angle snapped to 45°, small dead zone), forgiving for cardinals AND diagonals, taking up much more of the screen; big round A/B buttons. Game canvas should fill more of the screen.
- Infinite lives in every level (deaths respawn, never game over; HUD shows no finite lives).
- Original art/names, inspired by Nintendo/Sega only.

## Builder rules (proven)
- One focused change per edit. Tell builder: first tool call is edit_file, small edits, no planning, don't read library files, node --check, short report. Big prompts hit the build limit and save nothing.
- New level = 2 builds (core, then content) + playtest/fix pass (node harness with bots) + detail/polish pass(es).
- Never run two builds at once. After each build, confirm with grep on the published file that the change landed.

## NEW STRUCTURE (user, Oct 6 2026 21:00): build all 20 as STANDALONE Hark Pages, show each in chat when done, then at the very end build the hub page that brings them together.
- Each game = its own Hark Page: create with website_coding_agent action=create, project_name "Arcade NN - Title" (e.g. "Arcade 01 - Barrel Climb"). Record its project_id in the table below; all later edits use action=edit with that project_name + project_id. Never create a second page for the same game.
- Standalone shell must have: game-specific title card (big title, tap/A to play, no other menus), the large circular 8-way stick (left) + big round A/B (right), canvas filling the screen, infinite lives, win screen with "PLAY AGAIN", pause, mute, WebAudio SFX + short music loop.
- Levels 1-6 already exist inside the combined page. Seed each standalone from it: `python3 /workspace/work/rta-standalone/make_standalone.py /workspace/built/sites/f182f4b1-a65a-4e1a-913c-75093138d052/index.html N /workspace/work/rta-standalone/NN.html`, then create the page passing that file in assets with the instruction "use this file as index.html verbatim; then replace the multi-level title grid with a single game title card (tap/A to play) and make win show PLAY AGAIN". Then do detail passes as edits until it meets the bar.
- Levels 7-20: create fresh standalone pages (core build → content build → bot playtest/fix → detail passes). Keep each game's code as a single `var name = {title, goal, init(api), update(input), draw(ctx)}` object so it can be merged later.
- DONE for a game = verified landed + bot playtest clean + at least 2 detail passes judged against jf.html/tober.html. When a game is DONE: call website_coding_agent action=show for its page and post ONE short line in chat (what it is, what's notable, bot-tested only) with that preview. That is the only thing runs post.
- FINAL (after all 20 DONE): build the hub. Merge the 20 game objects into one combined page (the old "Retro Throwback Arcade" page, project_id f182f4b1-..., edit it: title = logo + thumbnail grid, tapping a thumbnail is the ONLY way to start, no PRESS ANY BUTTON; deep links ?level=N/#level=N; progress unlock). Also refresh the split GitHub zip (rta-split/split.py) and show the hub.


## QUALITY PASS (user, Oct 6 2026 22:23): "With what you have, bring them up to our standard for quality." NO NEW GAMES. No hub unless asked.
Scope: the 7 existing standalone pages G1-G7 (ids in queue table; G7 Duck Shoot id: see log/website list "arcade-07-duck-shoot").
Reference: /workspace/work/ghpush/jf.html (110 KB) and tober.html. Our games are ~34 KB incl. shared shell: far less art. Close the gap.
Per game, in order G1..G7, each pass = one local edit of the latest local file (rta-standalone/), node --check, bot sim (rta-standalone/sims), smoke 600 frames, then publish via builder edit "cp <asset> index.html verbatim" and grep the published file.
Checklist per game (tick in table below):
 a) Sprites: every actor drawn from multi-color pixel maps (string arrays -> offscreen canvas) with 1px dark outline + 2-tone shading; hero has idle/run(4)/jump/hurt frames; enemies >=2 frames.
 b) Backgrounds: 3 parallax/animated layers (sky gradient + far + near details), animated elements (water shimmer, stars, clouds, drips).
 c) Juice: particles on every hit/pickup/death, hit-flash white, screen shake scaled, score popups, death/respawn blink.
 d) Audio: per-game music loop (2 voices + noise drums), distinct SFX per action.
 e) UI: title card art (logo with outline + preview art), HUD with icons not plain text, win screen tally.
 f) Bot sim clean + 600-frame smoke clean after all edits.
A game is QUALITY-DONE when a-f are all ticked. Then show its page and post one short chat line (game + 1-2 notable upgrades + bot-tested only).
| # | Game | a | b | c | d | e | f |
|---|------|---|---|---|---|---|---|
| 1 | Barrel Climb | x | x | x | x | x | x |
| 2 | Pipe Pests | x | x | x | x | x | x |
| 3 | Ring Rush | x | x | x | x | x | x |
| 4 | Gem Columns | x | x | x | x | x | x |
| 5 | Balloon Brawl | x | x | x | x | x | x |
| 6 | Turbo Coast | x | x | x | x | x | x |
| 7 | Duck Shoot | x | x | x | x | x | x |

## Queue (top to bottom; [x] when DONE)
| # | Game | Page project_id | Status |
|---|------|-----------------|--------|
| 1 | Barrel Climb | 259f23c8-6e7d-4bb0-a394-8bcb77c1e355 | [x] DONE (title card+PLAY AGAIN; sim 10/10) |
| 2 | Pipe Pests | e7379f98-c090-4339-8b20-7eb09a6db311 | [x] DONE (sim2 20/20 0 deaths, smoke clean, 2 detail passes) |
| 3 | Ring Rush | dd8a7883-46e4-45f2-a10f-882840b3e0cc | [x] DONE (sim3 40/40, smoke clean, 2 detail passes) |
| 4 | Gem Columns | ff5fd656-5edf-490a-b399-3b8674595ecd | [x] DONE (gemsim 92% win, 0 errors; smoke clean; shaded gems/frame/glints + bg gradient, chain shake) |
| 5 | Balloon Brawl | c9c3e5a8-05ff-4f96-8348-c6aae094629c | [x] DONE (sim5 60/60 all bots; smoke clean; detail: earlier storm/shimmer/fish + outlines/shade/death shake) |
| 6 | Turbo Coast | d1254d43-2d93-42b6-a461-e58cfa7b916f | [x] DONE (sim6 good 60/60, avg 53/60, sloppy 32/60; smoke clean; mountains, outlined cars/shadows, speed lines, spin shake) |
| 7 | Duck Shoot (Duck Hunt) | 97224b14-0322-4194-8bf0-898a8393139b | [x] DONE (simgen+bot07 9/9 wins, 0 draw errors; built with parallax/particles/shake/outlines) |
| 8 | Ice Block Push (Pengo) | - | new |
| 9 | Pill Panic (Dr. Mario) | - | new |
| 10 | Sky Harrier (Space Harrier) | - | new |
| 11 | Dirt Rally (Excitebike) | - | new |
| 12 | Chick Rescue (Flicky) | - | new |
| 13 | Peak Climber (Ice Climber) | - | new |
| 14 | Neon Kart (F-Zero/Mario Kart) | - | new |
| 15 | Bit Boxer (Punch-Out!!) | - | new |
| 16 | Iso Strike (Zaxxon) | - | new |
| 17 | Street Rumble (Streets of Rage) | - | new |
| 18 | Dungeon Room (Zelda) | - | new |
| 19 | Pastel Zone (Fantasy Zone) | - | new |
| 20 | Coin Plumber (SMB 1-1) | - | new |
| HUB | Retro Throwback Arcade | f182f4b1-a65a-4e1a-913c-75093138d052 | last |
Stop editing the combined page now except for the final hub step.

## Log
- 2026-10-06 20:35 plan written.
- LOCK 2026-10-06 20:34 (main chat finishing L6 tune pass)
- 20:36 L6 tune pass landed (bot fixes: traffic pass-through, draw order, hitbox). UNLOCK 2026-10-06 20:36
- LOCK 2026-10-06 20:37 (scheduled run)
- 20:47 L6 clock restored: 46 s + 20 s checkpoint, track 3000 segs, 34 traffic cars; sim bots 100/85/60% (curve pull left at 0.3: raising it breaks the good bot). Re-split+zip.
- 20:49 SHELL landed in 2 builds: pointer-event 8-way stick (#stick/#knob, 45° snap, 8% dead zone, feeds setKey Arrow*), dpad removed, A/B min(24vw,116px), canvas non-integer scale. Verified by grep + node --check only.
- 20:52 Infinite lives landed (1 build): lives-- and game-over checks removed in L1/L2/L3/L5, HUD 'LIVES INF', L5 life balls removed, api.lose = instant level retry (L4 top-out), L6 timeout → back to checkpoint (20 s) or start (46 s). Sims sim2/3/5/6/gemsim run clean (sim2 GAMES hook fixed to regex). Re-split+zip.
- 20:53 L1 detail build 1/3 landed: night-sky gradient, moon, twinkling stars, 2 skyline layers w/ lit windows, shaded girders, broken-ladder rail gap (black box removed). Smoke test (work/smoke.js, all 6 levels 600 frames) clean. Next: L1 sprite outlines/shading + barrel-smash/jump particles + screen shake on death.
- 20:53 L1 detail builds 2-3 landed: barrel-smash spark burst + screen shake (smash 6, death 14), outlined/shaded barrels and ape, hero drop shadow. Smoke clean. Hero sprite outline still flat → leave for second sweep. Re-split+zip.
- 20:56 L2 detail (3 builds) landed: sewer backdrop (gradient, brick wall, bg pipes, drips), kick spark burst + shake, outlined/shaded pests. sim2 10/10 clean (sim2 ctx stub now supports gradients). Re-split+zip.
- 21:00 L3 detail builds 1-2 landed: gradient sky, 2 parallax layers (snow-capped mountains 0.22, checkered hills 0.45), gradient water; foe-pop spark burst. sim3 all bots 40/40, smoke clean (sim3/sim5/gemsim ctx stubs now support gradients). Re-split+zip.
- UNLOCK 2026-10-06 21:01
- 21:01 User switched to standalone-per-game structure (see above). Running combined-page item may finish; then switch.
- LOCK 2026-10-06 21:46
- 21:48 G1 page created (259f23c8), seed verbatim.
- 22:01 G1 DONE: shell post-processing via rta-standalone/post.py (title card, YOU WIN/PLAY AGAIN, infinite-lives intro) then builder cp's the file verbatim as asset (works, ~30s). Bot sim: rta-standalone/sims/sim1.js <html> runs frames (10/10 wins). NOTE: send_message allows only ONE final per run, so chat line for all DONE games goes in one final at end of run.
- 22:10 G2-G6 pages created from seed+post.py (ids in table). Titles landed via cp. Next: bot sims (run against combined page), G1 page refresh w/ 01b (goal wrap) pending.
- 21:53 actual (earlier log times wrong). sims 2-6 clean vs combined page: sim2 0 deaths, sim3 40/40 all bots, sim5 60/60, sim6 good 60/60 avg 54/60, gemsim 92% win.
- 21:58 G3 detail pass 2 (hurt shake, grass tufts) landed in artifact (mirror under built/sites lags; verify via download_artifact s3_key from builder result). G3 DONE.
- 22:01 G2 DONE (pass 2: hero outline/shade/shadow, brick highlight). sim2 runs on standalone html if copied to /tmp/g2/index.html with work/sim2.js alongside.
- 22:03 G5 DONE.
- 22:02 G4 DONE.
- 22:05 G6 DONE. Next: G7 Duck Shoot; plan: write game object in rta-standalone/games/NN.js, inject into 01b shell via make_new.py (replace barrelClimb object + GAMES), cp via builder.
- 22:10 music loop added to shell via music.py (m1..m6 published to pages 1-6 via cp). G7 Duck Shoot in progress: games/07.js
- 22:17 G7 DONE. New-game pipeline: write games/NN.js (var name = {title,goal,init,update,draw}), python3 make_new.py m1.html games/NN.js name nNN.html 0 0; python3 music.py nNN.html nNNm.html <notes> <step>; fix <title>; node --check; sims/simgen.js <html> <var> <runs> <frames> sims/botNN.js; builder create w/ asset cp. Next: G8 Ice Block Push. UNLOCK 22:17
- 22:23 USER: 'That's enough games for now.' Overnight task 1fb5f8f6 and morning report a5daead8 CANCELLED. 7 standalone pages exist (G1-G7 Duck Shoot). Hub not built.
- LOCK 2026-10-06 22:25 (quality pass scheduled run)
- 22:28 QP G1 a) landed (qp/q1a.html): pixel-map sprite kit (mk/blit: auto outline + rim shading, offscreen canvas, fillRect fallback), hero idle/run4/jump/climb2/hurt, barrels 4+2 frames, ape calm/roar + posed arms/fists/legs, rescuee 2 frames, hammer. sim1 10/10, smoke clean. New tools: sims/smoke.js (600-frame full-page), sims/shot.js (software-canvas PNG screenshot).
- 22:29 QP G1 b) landed (q1b): drifting 2-speed cloud banks over moon (moved off HUD, pulsing halo), shooting star, flickering skyline windows, crane silhouette w/ blinking beacon + swinging hook. sim1 10/10, smoke clean.
- 22:30 QP G1 c) landed (q1c): burst() particles on death/respawn/hammer pickup/jump-score/barrel landing/throw/hero landing, white hit-flash sprites (hero hurtW, barrel ghost), shake on throw/pickup, respawn blink 90f w/ invuln, HAMMER! popup. mk() got 4th arg flat. sim1 10/10, smoke 600+3000 clean.
- 22:31 QP G1 d) landed (q1d): shell audio engine via qp/audio.py (noise(), kick(), playMusic() reading GAMES[gi].music {step, lead, mel[], bass[], drum 'k.h.s.'}), 32-step tune; SFX: climb ticks, footsteps, land thud, barrel bounce, ape pound kicks, 2-note score, hammer tick, smash crunch, hit noise. sim1 10/10, smoke clean.
- 22:37 QP G1 e) landed (q1e; builder wrote in chunks, byte-identical): qp/ui.py shell UI = outlined 2-tone logo() w/ shine sweep, GAMES[0].titleArt(ctx,t) animated preview (ape, rolling barrels, running hero, rescuee), goal band; win screen counts up GAMES[gi].tally rows + SCORE; game HUD chips w/ pixel icons (head x inf, coin, clock, hammer timer bar). f) published file: sim1 20/20, smoke 600 + 5000 clean. G1 QUALITY-DONE. Latest local: rta-standalone/01q.html.
- 22:38 QP G2 a) landed (q2a): sprite kit + hero idle/run4/jump/hurt(grey), pests 3 moods x walk2 + on-back2 + white warning flash, tumbling kicked pests use back sprite, coin 4-frame spin. sims/sim2.js now reads HTML env (HTML=<file> node sims/sim2.js 20): 20/20, smoke 600+3000 clean.
- 22:40 QP G2 b) landed (q2b): far layer dim pipe network w/ pulsing light flows + blinking eyes, mid steam bursts, near swaying chains, floor water channel shimmer. sim2 20/20, smoke clean.
- 22:41 QP G2 c) landed (q2c): burst() on bump (brick dust + small shake), flip (white flash sprite 6f + FLIP! popup), POW (24-part + screen flash), death (burst, shake 12, hero white flash), respawn sparkle, jump/land dust. sim2 20/20, smoke 600+3000 clean.
- 22:42 QP G2 d) landed (q2d): audio.py engine + 32-step minor tune w/ drums; SFX footsteps, land thud, pipe whoosh on spawn/warp, POW kick+rumble, death noise. sim2 20/20, smoke clean.
- 22:41 QP G2 e) landed (q2e): ui.py shell UI, titleArt (pipes, pests, running hero, spinning coin), HUD icon chips (head x inf, pest 0/8, coin score, POW blocks), tally (kicked, flips, coins, POW, tumbles, time). f) published: sim2 20/20, smoke 600+5000 clean. G2 QUALITY-DONE. Latest local: 02q.html.
- 22:51 QP G3 a) landed (q3a): hero idle/run4/skid/air/hurt + 14px spin-ball map (rotated in 45-degree steps), ladybug foe 2 wheel frames, ring 4-frame spin, bird 2-frame flap. sims/sim3.js reads HTML env: all bots 40/40; smoke 600+3000 clean. Next: G3 b (latest local qp/q3a.html).
- UNLOCK 2026-10-06 22:52
- LOCK 2026-10-06 23:09
- 23:14 QP G3 b) landed (q3b): far sun+flock, mid water glints+pollen. sim3 40/40, smoke clean. Next: G3 c (latest qp/q3b.html).
- UNLOCK 2026-10-06 23:15
- LOCK 2026-10-06 23:55
- 23:57 QP G3 c) landed (q3c): burst() particles w/ gravity, landing dust, ring burst, hit burst, stomp shake. sim3 40/40, smoke clean. Next: G3 d audio (latest qp/q3c.html).
- UNLOCK 2026-10-06 23:58
- LOCK 2026-10-07 00:40
- 00:43 QP G3 d) landed (q3d->q3e): audio engine + tune + footsteps/chime noise. sim3 40/40, smoke clean. Next: G3 e UI (latest qp/q3e.html).
- UNLOCK 2026-10-07 00:44
- LOCK 2026-10-07 01:25
- 01:30 QP G3 e) landed (q3f): titleArt, ring tally on win. f) sim3 40/40, smoke 600+5000 clean. G3 DONE (03q.html). Next: G4.
- UNLOCK 2026-10-07 01:30
- LOCK 2026-10-07 03:40
- UNLOCK 2026-10-07 03:41 (no G4 work done this fire)
- LOCK 2026-10-07 04:25
- UNLOCK 2026-10-07 04:26 (no G4 work done this fire)
- LOCK 2026-10-07 06:39
- UNLOCK 2026-10-07 06:40 (no work done this fire)
- LOCK 2026-10-07 08:55
- 08:58 QP G4 a) landed (q4a): 6 distinct pixel gem sprites (circle/hex/diamond/octagon/triangle/square) + white silhouettes + miner mascot (idle/blink/cheer/worry). gemsim 93%, smoke clean. Next: G4 b (latest qp/q4a.html). G4 page id ff5fd656-5edf-490a-b399-3b8674595ecd (plan queue id was typo-free; published path confirmed).
- LOCK 2026-10-07 09:40
- 09:47 QP G4 b) landed (q4b, published, cmp identical): moon+shooting star, 2 crystal ridges, fog, drifting shards, torches, drips, frame glint. gemsim 95%, 0 errors, smoke clean. Next: G4 c (latest qp/q4b.html).
- 09:49 QP G4 c) landed (q4c, published identical): burst() w/ gravity, lock dust+sparkles, homing sparks to GEMS bar, chain/win/overflow bursts+screen flash, win confetti, overflow gem smoke. gemsim 87% (30 runs) 0 errors, smoke clean. Next: G4 d audio (latest qp/q4c.html).
- 09:54 QP G4 d) landed (q4d, published identical): audio.py engine + 32-step A-minor tune w/ drums; move tick, rotate swoosh, lock thunk+kick, clear sparkle noise, chain arpeggio, danger heartbeat, overflow crash, win fanfare. gemsim.js now stubs noise/kick. smoke clean, gemsim 87%/0 err. Next: G4 e UI (latest qp/q4d.html).
- 10:01 QP G4 e)+f) landed (q4e, published identical, saved as 04q.html): titleArt (stone well, falling stick, big gems, miner), HUD icon chips, win tally (gems/best chain/pieces/seconds), shorter goal text. Published file: gemsim 87% 0 err, smoke 600 + 5000 clean. G4 QUALITY-DONE. Next: G5 a (start from m5.html).
- 10:07 QP G5 a) landed (q5a, published identical): hero idle/run4/flap up+mid/glide/hurt sprites, foe 3 flap frames + white silhouettes, 3 balloon colors x 2 sizes, pink canopy sprite. sims/sim5.js (HTML env) 60/60 all bots, smoke clean. Next: G5 b (latest qp/q5a.html).
- 10:13 QP G5 b) landed (q5b, published identical): bgFar (horizon isles, sweeping lighthouse beam, 4 drifting cloud banks, bird flock) + bgNear (swaying vines + drips under platforms, grass tufts, fireflies, moon glints on water). sim5 60/60, smoke clean. Next: G5 c juice (latest qp/q5b.html).
- UNLOCK 2026-10-07 10:14
- LOCK 2026-10-07 10:25
- 10:26 QP G5 c) landed (q5c, published identical): burst() w/ gravity+dust kinds, pop-star flash, hit-flash white on hero/foes, hit-stop, shake scaled, coloured bouncing popups, flap/run/land dust, death scraps + water spray, respawn sparkle, win confetti. sim5 60/60, smoke clean. Next: G5 d audio (latest qp/q5c.html).
- 10:27 QP G5 d) landed (q5d, published identical): audio.py engine + 32-step D-minor tune w/ drums; flap whoosh, stomp, balloon-pop, death sting, splash, land thud, footsteps, ceiling bonk, respawn arpeggio, fish chomp, thunder, win fanfare. sim5.js now Proxy-stubs SFX. sim 60/60, smoke clean. Next: G5 e UI (latest qp/q5d.html).
- 10:31 QP G5 e)+f) landed (q5e, published identical, saved 05q.html): moon crescent, titleArt (hero on 2 balloons, foe popped into parachute, lighthouse), HUD coin/foe chips + AIR balloon indicator, win tally (foes/stomps/hits/seconds). Published: sim5 60/60, smoke 600+5000 clean. G5 QUALITY-DONE. Next: G6 a (start from m6.html).
- 10:36 QP G6 a) landed (q6a, published identical): pixel-art rear-view player car (straight/left/right + brake-light variants, driver helmet), traffic cars 3 colours x 2 frames (+white silhouettes built), 2-frame swaying palms, arrow signs. sims/sim6.js (HTML env): good 60/60, smoke clean. Next: G6 b (latest qp/q6a.html; game obj is turboCoast, sprite prop S.SQ, helper S.spr(ctx,sp,x,y,w,h,flip)).
- 10:38 QP G6 b) landed (q6b, published identical): S.bg() = starry sky, striped sun w/ halo, drifting clouds, sea w/ sun glints+waves, 3 parallax ridges (far peaks, mid hills, palm tree-line) steering with curve via S.bgx, gulls, roadside flowers. sim6 good 60/60, smoke clean. Next: G6 c juice (latest qp/q6b.html).
- 10:42 QP G6 c) landed (q6c, published identical): screen-space particles (offroad dust, brake smoke, exhaust flames, bump sparks, spin debris, checkpoint confetti), white hit-flash on cars, shake scaled to hit/offroad speed, popups (BUMP!/SPIN OUT!/TIME +20/TIME UP), respawn blink, flash. sim6 60/60 good, smoke clean (sim6 stubs text/SFX). Next: G6 d audio (latest qp/q6c.html; game has NO in-game SFX yet: add engine pitch, tyre screech, bump, spin, checkpoint, time-up, finish).
- 10:44 QP G6 d) landed (q6d, published identical): audio.py engine + 32-step A-minor synthwave tune w/ drums; speed-pitched engine, tyre skid, brake squeal, gravel rumble, near-miss whoosh, bump, spin-out, checkpoint arpeggio, time-up, 5s countdown ticks, win fanfare. sim6 60/60 good, smoke clean. Next: G6 e UI (latest qp/q6d.html; run ui.py then titleArt/HUD chips/tally; HUD currently uses ctx.font monospace text).
- 10:53 QP G6 e)+f) landed (q6e, published identical, saved 06q.html): titleArt (sunset road, hero car, traffic, palms), HUD clock chip/big time/progress bar w/ checkpoint+finish markers/speed gauge, win tally (run time/top speed/bumps/spin-outs) + time-bonus score. Published: sim6 good 60/60 avg 54/60, smoke 600+5000 clean. G6 QUALITY-DONE. Next: G7 a (duck shoot, start from published; sim: node sims/simgen.js <html> duckShoot 9 6000 sims/bot07.js).
- UNLOCK 2026-10-07 10:53
- LOCK 2026-10-07 11:09
- 11:16 QP G7 a) landed (q7a, published identical): mallard sprites (up/mid/down/dead + white flash), dog laugh x2 / hit frames + held-duck sprite (dog was fully hidden behind grass before; now rises 56px), bodies outlined+shaded. simgen+bot07 9/9, smoke clean. Next: G7 b (latest qp/q7a.html; game var duckShoot, sprite prop SX, gen7.py makes sprites).
- 11:21 QP G7 b) landed (q7b, published identical): bgFar (rayed pulsing sun, snowy ridges, drifting mist, 2 cloud layers, bird flock), bgMid (pond w/ shimmer, falling leaves, butterflies, tree sway), bgNear (swaying flowers, pollen, wind-gust grass). simgen 9/9, smoke clean. Next: G7 c juice (latest qp/q7b.html).
- 11:24 QP G7 c) landed (q7c, published identical): burst() w/ gravity, muzzle sparks, hit sparks+feathers+hit-stop+flash, STREAK/MISS/LAST SHOT/FLY AWAY popups, feather trail on fall, ground-thud grass burst + shake, dog-rise grass burst, crosshair recoil + blink when empty, win confetti. simgen 9/9, smoke 600+3000 clean. Next: G7 d audio (latest qp/q7c.html; run python3 qp/audio.py in out then add music prop + SFX).
- 11:27 QP G7 d) landed (q7d, published identical): audio.py engine + 32-step C-major tune w/ drums; shot boom, empty click, quack on spawn, wingbeat ticks, hit smash+chime, falling whistle, ground thud, dog yap/laugh, fly-away sting, streak chime, fail sting, win fanfare. simgen 9/9, smoke 600+3000 clean. Next: G7 e UI (latest qp/q7d.html).
- 11:37 QP G7 e)+f) landed (q7e, published identical, saved 07q.html): titleArt (mallard + tracking crosshair, laughing dog in the grass, ridges), HUD star score chip / duck-icon hit tracker / bullet icons / streak, win tally (ducks, shots, accuracy, best streak). Published: simgen 9/9, smoke 600+5000 clean. G7 QUALITY-DONE. ALL 7 GAMES TICKED.
- UNLOCK 2026-10-07 11:30
