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

## Voltage Vic, Power Plant: rhythm battle — src/06v_vic_rhythm.js
ACT "FIGHT VIC" at the Power Plant boss anchor (56, -5.5) or `?vic=1`. Vic spins three B-MORE 410 radio records through the radio's own hidden
YouTube player (`__radio.lend()` / `unlend()`: radio paused, dial locked, ticker credits the record): phase 1 "Dance My Pain Away" (Rod Lee),
2 "How U Wanna Carry It" (Miss Tony), 3 "Doo Doo Brown" (2 Hyped Brothers & A Dog), DJ scratch between. Beatmaps from `VIC_SONGS` (bpm, beat0,
section start `at`, bars; one entry per track) + `VIC_SET` (record per phase). No YouTube (offline / blocked / headless / ad stuck 9 s) =
procedural Web Audio club beat at 130 BPM. Judged on media time from event timestamps (AudioContext via getOutputTimestamp, or
player.getCurrentTime() through a small PLL), never frame time. Lanes: D F J K / arrows / pad X A Y B (4) or 3 tap zones on phones.
Win = `BOSS_CLEAR.clear('powerplant')` (or the identical stand-in: localStorage tcb_boss_clear + 'tcb:bossclear' event); lose = RETRY.
Test params: `?vic=perfect|miss`, `?vicbars=N`, `?vicyt=stub|stubac|0`, `?vicsync=1` (tap-along beat0 calibration, saved per track), `?viclat=ms`.
Opus's rig: if `buildVoltageVic()` exists it replaces the stand-in eel (`update(dt, {beat, hurt, drop, state})` is called if present).
Test: T/vic/vtest.js (gitignored T/).

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
## Boss duels (hark/duel-bosses)
Game-style boss fights as their own modes (src/09a_duel_core.js core, 09b_jimmy.js, 09c_chipkid.js). Walk onto the glowing ring at an entrance and press ACT (FIGHT):
- **Big Jimmy, National Aquarium doors: underwater swim fight.** Stick / WASD swim (locked on to Jimmy), UP / DOWN (white buttons, SPACE / SHIFT, RT-RB / LT-LB or the right stick), STRIKE (SWING, ACT, J / E, X), DASH (JUMP, K, A). Dodge claw snaps (a claw rises and flashes red) and bubble blasts (he glows cyan and froths); when he rears up his belly glows gold: strike it (2 hits a rear, 5 a phase, 3 phases). AIR drains: hover in a bubble vent column to refill (phase 3: one vent sleeps at a time).
- **The Chip Kid, Harborplace promenade: Punch-Out-style mech duel.** Dodge left / right (stick, white buttons, A / D, LB / RB), DUCK (stick down, JUMP, S, A), PUNCH (SWING, J, X), UPPERCUT (ACT, E, Y; spends a star). Tells: seasoning cloud (shakers tip + glow orange: duck), chip-can barrage (belly hatch opens, lanes flash: step out), bag-slam (crouch + leap, shadow grows: dodge), claw jab (claw pulls back + flashes red: dodge away or duck). Punch in the openings; clean cloud / slam dodges earn stars. 3 rounds; the mech collapses, the kid pops out, sulks and runs off.
- Both: the radio ducks to 22% (`__radio.fightDuck`), the city HUD hides, the arcade panel relabels; a loss offers RETRY (from the phase / round reached) or LEAVE; a win calls `BOSS_CLEAR.clear(lmId)` (06g0_boss_clear.js: boss cleared, district crime 0) and returns to the street.
- Rig hooks: `window.buildBigJimmy(ctx)` / `window.buildChipKid(ctx)` (contracts in the file headers); otherwise procedural stand-ins.
- Tests: `?duel=jimmy|chipkid` starts one, `&duelbot=win|lose` plays it. `T/duel/bg.sh <name> <port> <kind> <win|lose> <w> <h> <shot.png|-> [sim] [shotAt]` (detached run of T/duel/run.js), `T/duel/entry.js` (city ring -> ACT -> duel -> LEAVE).

## Racer bosses + harbour rides (hark/racer-bosses) — src/06h_racers.js
- **Arabber Al, Fells Point: chase racer.** ACT "CHASE AL" at his parked produce cart (165.4, -55.4). Behind-the-car racer round a cobblestone loop with
  two water-taxi crossings; Al flings watermelons / cabbages / tomato crates. Ram him 3 times before the 90 s clock. Steer stick / A-D / pad; BOOST SWING or ACT
  (J / E / pad X, Y); HOP JUMP (K / pad A). Win = `BOSS_CLEAR.clear('fells')`.
- **Water taxi / paddle boats.** ACT "WATER TAXI" at a taxi stop (`__rb.RIDES.STOPS`) or "PADDLE BOAT" at the Harborplace paddle boats (-51.4, -12): a harbour ride.
- **Dragon Boat Duchess (roaming water boss): boat ramming race.** She ambushes the first boat ride: ram her into a pier or buoy 3 times; her paddle-sceptre
  swing (raised + glowing) and splash waves (dragon head rears: HOP). Lose the hull = retry. Beaten = saved flag (localStorage tcb_duchess_beaten), the ride carries on.
- Both fights: own scene + camera (city sim paused), radio `__radio.duckTo(0.2)`, the full map is blocked while a fight runs (boat rides still allow it).
- Rig hooks: `buildArabberAl()` / `buildDragonBoatDuchess()` (Object3D or `{ root, update(dt, st) }`, feet y 0, facing +z, ~1.8 m).
- Tests: `?rb=al|duchess|duchess-paddle|ride`, `?rbauto=win|lose`, `?rbtime=N`, `?rbfresh=1`; T/rb/run.js (`PORT=` env, default 8743), T/int3/entry.js (entry ACT labels + shots).

## Kingpin Carl, rowhouse basement lanes: duckpin bowling (hark/carl) — src/09k_carl.js
Boss 19. ACT "BOWL CARL" at the cellar door (CARL_DOOR: x -86, z -79, the street face of the rowhouse block north of Lexington Market; at night, by day the
label reads LANES OPEN AT NIGHT), or `?carl=1`. Runs as a DUELS kind (09a core: own scene + camera, radio fightDuck, city HUD hidden, RETRY / LEAVE card).
- Real duckpin rules: 10 frames, up to 3 balls, small balls with no finger holes, 10 small pins, deadwood cleared after every ball; strike = 10 + next 2 balls,
  spare (10 in two) = 10 + next ball, else the pins of 3 balls ("ten" on the third = 10); frame 10 strike = 2 more balls, spare = 1 more (fresh racks).
  Harold bowls his frame, then Carl bowls his. Beat Carl's total to win (a tie goes to the house).
- Controls: aim with the stick (A / D, arrows, white buttons, pad stick); then SWING or ACT (J / E / Space / Enter, pad X or Y, or tap the game) three times:
  lock aim + start POWER, set power + start SPIN, set spin + bowl. JUMP (K, pad A) = SWAT. During Carl's / Mavis's roll a tap fast-forwards.
- Masked Bandits beats: a heckler pops up by the left gutter and wobbles the aim until swatted (one per frame, ~60% of Harold's frames); frames 4 and 8 a
  greased lane (sheen + arrows: the ball slides that way); on Carl's frames 2 / 5 / 8 a Bandit sneaks onto the deck and kicks a standing pin for Carl
  (SWAT = CALL IT, the pin stands). Two swats earn Mavis's bonus ball: she bowls her purse once after Carl's frame; her pins add to Harold's total.
- Pin physics: `duckSim(up, params, pos)`, a 2D top-view impulse sim (ball 1.6 kg, pins 0.72 kg, kickback walls, pit) at a fixed 1/240 s with no trig,
  run to the end at release and played back at 60 Hz: every roll is decided by its inputs (deterministic for the auto params). Carl searches the same sim
  (114 lines, 14 per step) and then misses by a seeded human error (CARL_SIG). Scoring: `duckScore(frames)`, `frameState(frame, tenth)`.
- Win = `BOSS_CLEAR.clear('duckpin')`: Carl's lanes are their own LANDMARKS entry ('duckpin', "DUCKPIN DEN LANES", district: 'lexington') so beating him
  clears his sub-district without touching Pete's 'lexington' boss flag. Lines: Grok GR4 modes.carl_duckpin (frame calls, Carl taunts, Bandit heckles,
  Mavis bonus, win / lose), inlined as CARL_TXT.
- Rig hooks: `buildKingpinCarl(ctx)` and `buildMaskedBandit(ctx, i)` (contracts in the file header); otherwise procedural stand-ins (a hefty possum in an
  orange bowling shirt with his gold lucky towel; raccoons in the gang's orange jackets).
- Tests: `?carl=1`, `&carlauto=win|lose` (bot, 5x speed), `&carlseed=N`, `&carlframes=N` (short game), `&carlday=1` (door works by day).
  T/carl/run.js (`node T/carl/run.js <port> win|lose|play <w> <h> <shot.png|-> [sim] [phases] [extra query]`), T/carl/entry.js (door label, ACT, LEAVE, city draw calls).
