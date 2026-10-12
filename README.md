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
Touch: the arcade panel from Brad's demos shell docked under a tall game view (ball-top stick, SWING red, JUMP yellow, white buttons = camera,
ACT = big glowing green button). Stick and buttons ~18% larger than the demos shell; hit areas scaled to match. No floating pad.

## ACT (one context button) — src/06b_cine.js `actContext()`
Priority: FINISH (dizzy-thug QTE) > SEWER (`MANHOLES`) > CLIMB / LEAP (`CLIMBS`) > RIDE / DRIVE / BOARD (`VEHICLES`, `RIDE.v`; ACT again = GET OFF)
> KICK OPEN / VAULT (street actions) > POWER (in a fight). Phase 1 fills only the street actions + POWER; MANHOLES / CLIMBS / VEHICLES are empty hook lists.
POWER = Harold's "cane quake": hop + flip + cane slam, shockwave downs thugs within ~5 m, 0.24 s hit-pause + heavy shake, 7 s cooldown (ring on the button),
Mavis joins with her spinning handbag when she is close and free. ACT also cancels a cane combo into POWER.

## Tools
./mk.sh (parts -> src/03_city.js -> site/game.js), serve.py, shot.js, view.js (frozen free-camera asset renders), ccheck.js (water/buildings/hill/cycle/
draw calls/POWER/panel/bot run past 6 landmarks), dc.js (draw calls), deploy.sh + verify.sh (surge + md5 check).

## Bird Brain Bobby: HOME RUN DERBY (src/06g_derby.js, branch hark/bobby-derby)
Oriole Park's boss fight. ACT "PLAY BALL" on the glowing plate + spinning ball at the boss anchor (-91.5, 0) (REMATCH once cleared), or `?derby=1`.
- Own scene + camera (the city is not drawn or simulated while it runs): batter's-box view behind Harold (his cane is the bat), Bobby on the mound,
  a brick-warehouse ballpark (arched-bay outfield wall, 7.4 m warehouse wall in right, the long warehouse + lofts behind, bleachers + instanced crowd, light towers).
- Pitches: FASTBALL (big leg kick, red glow/trail), CURVEBALL (dropped arm slot + wrist snap, blue), CHANGEUP (slow windup that hangs at the top, green),
  KNUCKLEBALL (no kick, fluttering fingers, yellow, wobbles). Pitch 1-4 fastballs only; changeups from 5, curves from 9, knucklers from 15; speed rises
  over ~26 pitches (fastball 78 -> 97 mph shown; real flight 1.0 -> 0.6 s). Off-the-plate "waste" pitches from pitch 11 (take = BALL, free).
- Swing: tap the game / click / Space / J / K / E / Enter / gamepad A / arcade SWING or ACT. Press timestamps are used (not the next frame).
  Contact = swing time + 0.14 s vs. the ball's plate time: inside 0.04 s = full power, contact up to 0.14 s; early pulls (left), late goes oppo.
  Desktop: the mouse aims on the plate plane (above the ball = grounder, below = pop-up, too far = whiff). Touch / pad / keys: timing only, the stick
  (or WASD) biases spray (+-18 deg) and loft (+-10 deg). A ghost ring shows where the pitch will cross and closes in as it arrives.
- Ball flight: gravity + quadratic drag (k 0.0035); fence 98 m (322 ft) at the lines to 120 m (394 ft) centre, 3.8 m tall (7.4 m in right).
  HOME RUN over the wall; FOUL outside 45 deg (free); SINGLE (off the wall, line drive in a gap, hard grounder); OUT (fly / line / ground / pop out);
  STRIKE (whiff or a called strike) = out. Perfect contact ~445 ft.
- 10 homers before 10 outs: crowd roar + fireworks + Bobby's defeat line + BOSS_CLEAR.clear('orioles') -> "BACK TO THE CITY". 10 outs: retry card.
- Radio ducked to 20% while it runs (`__radio.duckTo(k)`, scales every player's setVolume) and restored on exit; the Bandcamp fallback embed can't be ducked.
- Bobby's lines: GR1 bird_brain_bobby intro (start + his gloat on a loss) / defeat (win).
- RIG HOOK: if any module defines `buildBirdBrainBobby()` it replaces the stand-in. Return an Object3D or `{ root, pose?(state, u, t, info), hand? }`
  (root faces +Z toward the plate, feet at y 0, ~2.6 m). States: idle, windup (u 0..1, info.pitch), follow, watch, cheer, mad, defeat, gloat.
- BOSS_CLEAR (src/06g0_boss_clear.js, shared byte-for-byte with the other boss branches): `.clear(lmId, info)`, `.crime[lmId]`, `.cityCrime()`, `.on(fn)`, 'tcb:bossclear' event.
- Tests: `node dtest.js <port> perfect|miss <w> <h> [out.png] [sim]` (scripted runs, swiftshader) and `node dtest.js <port> shot <w> <h> out.png`.
  `__derby.stats()`, `__derby.D.freeze`, `__derby.D.speed`; `?dseed=N` fixes the pitch sequence.
