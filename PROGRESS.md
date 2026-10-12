# K · Toad Street 32 — PROGRESS

Fork of j_cinema (Cinema City). Goal: one-street world, elderly toad couple (HAROLD player, MAVIS AI), PS1/32-bit look, 2-min day/night cycle.

## 2026-10-11 00:57 UTC
- Copied j_cinema src/site/tools into k_toad32 (j_cinema untouched). Removed CNAME.
- 01:22 UTC Rewrote: 01_core (low-res RT + 15-bit/Bayer post, Lambert PS1 mats w/ vertex snap + affine-ish uv + night emissive atlas), 02_atlas (muted palette, emissive atlas, 2048->512 nearest), 03_city (one N-S street z 3.6..46.4, both ends barricaded + capped, lamps/neon/glow pools, sky w/ sun/moon/stars), 04_actors (HAROLD + MAVIS toads, low-poly), 05_fx (words, 128px tex, bot route), 06* (posts, collide, actions: door/vault/QTE only, intro crane), 07_main (resize to 240 lines, day/night cycle ?tod ?cycle, clock HUD), index.html (Press Start 2P pixel HUD).
- First shots (day/dusk/night 1280, dusk 390x844): 0 errors, ~20-29 fps swiftshader. Fixed: fog colour not updating (Fog copies colour), window lit-hash, night camera fill light, cane hangs down in idle/run, proto label width, portrait partner slot.
- 01:47 UTC Brad: HD default (?retro=1 = 32-bit), cel bands + ink outlines + smooth heads + wart/afro textures in HD; viewer site/viewer.html (HAROLD turntable). DEPLOYED interim build: toad-street-32.surge.sh / and /viewer.html, HTTP 200, md5 match (index 332136f1, game 93e8ecad, viewer.js b87e465a).
- 01:51 UTC Live build == current build (md5 verified). Shots saved (shot-hd-*, shot-32-*, shot-day/night=HD, shot-compare.jpg, viewer-compare.jpg). demos add-game (embed cab like cinema-city) + bg deploy. aistudio commits (not pushed).

## 2026-10-12 (hark/duel-bosses, worktree game-duels from 6c95e25; NOT deployed)
- Two game-style boss fights as their own modes: src/09a_duel_core.js (DUELS: MODE.duel hook in 07_main, own scene + camera, HUD, input, radio duck via __radio.fightDuck, RETRY / LEAVE, city entrance rings, BOSS_CLEAR on a win), 09b_jimmy.js (Big Jimmy underwater swim fight), 09c_chipkid.js (The Chip Kid Punch-Out mech duel). Harborplace stub is now The Chip Kid; GR2 chip_kid lines + Harborplace blurb in src/06e_gr2_bosses.js (writing/gen_gr2.py). 06g0_boss_clear.js copied verbatim from hark/bobby-derby (keep ONE copy at merge).
- Headless (swiftshader, ?sim=3, T/duel/run.js via T/duel/bg.sh): scripted win + loss(+retry) for both duels at 390x844 and 1280x720, 0 console errors / page errors. Duel draw calls: Jimmy 65 (win runs) / 60, Chip Kid 81 (peak, during fx). City at the entrances: within +2 of 6c95e25 (T/duel/citydc.js). T/duel/entry.js: ring -> ACT (FIGHT) -> duel -> LEAVE restores HUD, labels, radio (fduck 1) and puts Harold back outside.
- Shots: ../assets_preview/jimmy_swim_390.png, ../assets_preview/chipkid_duel_390.png.
