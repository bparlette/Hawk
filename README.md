# Toad City Baltimore — Phase 1 (city blockout)

Live: https://toad-city-baltimore.surge.sh  (HD cel-shaded default; `?retro=1` = the 32-bit look)

Fork of K · Toad Street 32 (`/workspace/work/ss3d-bakeoff/k_toad32`, untouched). Same Harold / Mavis rigs, cane combat, Mavis AI + handbag,
dizzy-thug QTE finisher, Cinema City camera, keyboard / gamepad.

## World (src/03_city.js, assembled from parts/ by ./mk.sh)
- Inner Harbor basin + the Northwest Branch running east into the fog; the real map compressed ~3x. X east, Z south.
- Land ~2 blocks deep all round: 24 m blocks, 10 m streets (Pratt St, Key Hwy, Light St with centre lines), a 6 m brick promenade on every water edge, piers.
- 16 landmark massings (boxes / simple solids, ORIGINAL generic signs only), each in `LANDMARKS` with a `boss` anchor {name, x, z[, y, water]} for phase 5:
  Harborplace (2 pavilions), USS Constellation (ship), World Trade Center (pentagon), National Aquarium (pyramids), Power Plant (4 black stacks),
  Four Seasons (glass tower), Pendry (recreation pier + clock tower + roof pool), Fells Point (market hall, low rowhouses, cobbles), Washington Monument (column),
  Oriole Park (warehouse + stands), M&T Bank Stadium (bowl), Science Center (tiers + dome), Federal Hill (walkable mound), Domino Sugar (two-line script sign on a
  lattice, original name "Harbor Sugars": gold by day, red neon at night), Under Armour / Tide Point (brick halls + clock tower), Fort McHenry (star fort + flag).
- HD landmarks (phase 3): src/03b_landmarks_hd.js (batch 1: Domino, WTC, Power Plant complex) + src/03c_landmarks_hd_b2.js (batch 2: National Aquarium,
  Maryland Science Center, Harborplace pavilions, USS Constellation). Merged toon mesh + ink hull + one canvas-sign atlas each; near/far LOD swap at 125 m
  (`?lmhd=near|far` pins it); far LOD = the massing captured with LMCAP in parts/h_landmarks.js. Set-piece interior stubs: `LMHOOK` / `LANDMARKS[i].interior`
  (aquarium underwater tank, Science Center IMAX).
- Collision: seawalls (slide along, never enter the water), building / prop colliders in a 16 m grid, world bounds. Federal Hill raises the ground height.
- 31 thugs posted in pairs/trios at every landmark district. Thugs > 48 m away sleep (hidden, not simulated); > 24 m they drop ink outlines + shadows.
- Chunked city meshes (64 m, frustum culled), instanced lamp glows (2 draw calls), 4 pooled point lights that follow the hero.
- HUD: landmark name popup, minimap (water, piers, landmarks, heroes, nearby thugs).
- Day/night: 600 s loop (5 min day -> night, 5 min night -> day). `?tod=0..1` pins it, `?cycle=N` sets the loop length.

## Controls
Keyboard: WASD move, J cane, K jump, E = ACT (hold: revive), Q/R or drag: camera, H = HD/32-bit.
Full-screen map: tap / click the minimap (MAP tab), Tab, or gamepad Back/Select. Close: X, tap outside (the arcade panel counts), Tab, Esc, pad Back/B. Game pauses while it is open (src/07b_fullmap.js). M stays the radio key.
The map is an illustrated 2.5D view of the game's own layout (basin, piers, promenade, every generic building as a little block, boats, promenade trees) with the 16 landmarks as mini-models of their in-game models and white speech-bubble labels (HD 7 bigger, gold rim). The mini-models are baked from the game's scene: `node mkthumbs.js <port> <dir>` (needs the game served, renders each footprint clipped, ortho 3/4 aerial, transparent) then `python3 mkthumbs.py <dir>` packs `site/fmthumbs.webp` + `src/07a_fmthumbs.js`. The atlas is fetched only the first time the map opens.
Touch: the arcade panel from Brad's demos shell docked under a tall game view (ball-top stick, SWING red, JUMP yellow, white buttons = camera,
ACT = big glowing green button). Stick and buttons ~18% larger than the demos shell; hit areas scaled to match. No floating pad.

## ACT (one context button) — src/06b_cine.js `actContext()`
Priority: FINISH (dizzy-thug QTE) > SEWER (`MANHOLES`) > CLIMB / LEAP (`CLIMBS`) > RIDE / DRIVE / BOARD (`VEHICLES`, `RIDE.v`; ACT again = GET OFF)
> KICK OPEN / VAULT (street actions) > POWER (in a fight). Phase 1 fills only the street actions + POWER; MANHOLES / CLIMBS / VEHICLES are empty hook lists.
POWER = Harold's "cane quake": hop + flip + cane slam, shockwave downs thugs within ~5 m, 0.24 s hit-pause + heavy shake, 7 s cooldown (ring on the button),
Mavis joins with her spinning handbag when she is close and free. ACT also cancels a cane combo into POWER.

## Fort McHenry set piece: "The Bombardment" — src/09_fort.js (DESIGN.md spec)
- Walk up the ramp inside the fort's north bastion onto the gun platform (walkable: `RAMPS` / `rampH` in parts/f_layout.js; platform, ramp steps and the
  cannon prop in parts/h_landmarks.js). At the cannon the prompt reads CANNON: ACT / E / pad Y, pad A, or tap the prompt.
- First-person Duck Hunt-style gallery in its own scene + camera (the city is not drawn while it runs). Tap / click = aim + fire; mouse move aims;
  WASD / arrows / panel stick / pad sticks move the crosshair; Space / J / K / E / F / Enter, panel buttons, pad A / X / RB / RT fire; reload ring on the
  crosshair (0.5 s, 0.42 s in wave 4). Leave: ✕, Esc, pad Back. Hit tests are screen-space (min 38 px for shots in the air: phone friendly).
- Waves: 1 sloops (cannonballs), 2 bomb ketches (high-arc mortar shells that burst over the fort), 3 the rocket ship (rockets, red streak trails),
  4 the flagship: shoot it to a wreck, then Admiral Redclaw on the quarterdeck (3 hits); the rest of the fleet withdraws. Original ships, plain red pennants.
- The storm flag (canvas-drawn 15-star / 15-stripe banner) is the health bar: hits fray it from the fly end and burn holes; at 0 it falls -> RETRY WAVE / LEAVE.
  +10 between waves. Sky: night -> pre-dawn -> sunrise across the waves.
- Win: the storm flag comes down during "O say does that star-spangled banner yet wave", the big garrison flag rises over the final phrase
  ("O'er the land of the free and the home of the brave"), fireworks, score card, CONTINUE -> back on the rampart, `BOSS_CLEAR.clear('fort')`
  (src/06g0_boss_clear.js, the same file as the other boss branches: boss cleared + district crime -> 0 + 'tcb:bossclear' event), green minimap dot, Redclaw's defeat line.
- Music: Web Audio fife (two-voice harmony from wave 2, low doubling from wave 3) and snare / bass drum arrangement of the Star-Spangled Banner tune
  (notes written out in `SEC`; public-domain melody, no recording), 88 / 96 / 104 / 112 bpm by wave, drum rolls between waves. The radio is held
  (`__radio.hold(true)`: paused, since iOS ignores setVolume) for the whole set piece and resumed after.
- Redclaw hook: if `window.boss_admiral_redclaw.buildAdmiralRedclaw` (or `window.BOSS_MODULES.boss_admiral_redclaw`, or a global `buildAdmiralRedclaw`)
  exists it is called with `{ THREE, toonMat, outlineMat, scale }` and may return an Object3D or `{ root, update(dt, mode) }`; it is scaled to ~2.6 m and
  stands on the flagship's quarterdeck. Otherwise a stand-in crab in a bicorne.
- Perf: ~12-21 draw calls in the set piece (ships + projectiles instanced, all fx in two Points systems, sky/water one shader each).
- Test hooks: `?fort=1` starts it at load, `?fortwave=N` starts at wave N, `?fortauto=1` / `__fort.F.auto = true` = auto-aim autopilot, `__fort.F.pause`.
  T/fort/ftest.js (untracked) runs city -> ramp -> ACT -> taps -> all waves -> win -> return.

## Tools
./mk.sh (parts -> src/03_city.js -> site/game.js), serve.py, shot.js, view.js (frozen free-camera asset renders), ccheck.js (water/buildings/hill/cycle/
draw calls/POWER/panel/bot run past 6 landmarks), dc.js (draw calls), deploy.sh + verify.sh (surge + md5 check).
