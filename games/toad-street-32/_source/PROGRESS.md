# K · Toad Street 32 — PROGRESS

Fork of j_cinema (Cinema City). Goal: one-street world, elderly toad couple (HAROLD player, MAVIS AI), PS1/32-bit look, 2-min day/night cycle.

## 2026-10-11 00:57 UTC
- Copied j_cinema src/site/tools into k_toad32 (j_cinema untouched). Removed CNAME.
- 01:22 UTC Rewrote: 01_core (low-res RT + 15-bit/Bayer post, Lambert PS1 mats w/ vertex snap + affine-ish uv + night emissive atlas), 02_atlas (muted palette, emissive atlas, 2048->512 nearest), 03_city (one N-S street z 3.6..46.4, both ends barricaded + capped, lamps/neon/glow pools, sky w/ sun/moon/stars), 04_actors (HAROLD + MAVIS toads, low-poly), 05_fx (words, 128px tex, bot route), 06* (posts, collide, actions: door/vault/QTE only, intro crane), 07_main (resize to 240 lines, day/night cycle ?tod ?cycle, clock HUD), index.html (Press Start 2P pixel HUD).
- First shots (day/dusk/night 1280, dusk 390x844): 0 errors, ~20-29 fps swiftshader. Fixed: fog colour not updating (Fog copies colour), window lit-hash, night camera fill light, cane hangs down in idle/run, proto label width, portrait partner slot.
- 01:47 UTC Brad: HD default (?retro=1 = 32-bit), cel bands + ink outlines + smooth heads + wart/afro textures in HD; viewer site/viewer.html (HAROLD turntable). DEPLOYED interim build: toad-street-32.surge.sh / and /viewer.html, HTTP 200, md5 match (index 332136f1, game 93e8ecad, viewer.js b87e465a).
- 01:51 UTC Live build == current build (md5 verified). Shots saved (shot-hd-*, shot-32-*, shot-day/night=HD, shot-compare.jpg, viewer-compare.jpg). demos add-game (embed cab like cinema-city) + bg deploy. aistudio commits (not pushed).
