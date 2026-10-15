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

## Couch co-op (src/06cc_coop.js, COOP_PLAN.md)
- Player 2 drops in as **Mavis** by pressing **A or Start on a second controller** (P1 = keyboard/touch + the first pad that moves). Keyboard/touch P1 + one pad: Start on the pad.
  P2: left stick move, A jump, X/B purse combo (jump + X = slam), hold Y beside a downed Harold = revive, right stick / LB / RB = P2's camera when split.
  P2 drops out by turning the pad off / unplugging it, or holding Start 3 s. No second pad = the single-player game, unchanged.
- One shared camera while together (pulls back and tilts as they spread, max 13 m apart, 10 m in portrait); the toad walking away is held at the edge.
  The screen splits only after **2 s of deliberately pushing away at the edge** (a ring fills over that toad's head); hits, jumps, swings and letting go reset it.
  Split = side by side (landscape) or stacked (portrait), shorter draw distance in both views. Walk back within 9 m (7.5 m portrait) and it merges.
- Bosses and own-scene minigames are **turn rotation**: P1 plays (only P1's pad reaches the mode), then a P2'S TURN card (P2: A play, B skip) replays the same ring for P2.
- Tests: `node tests/coop/coop.js <port> <w> <h> [shotDir] [sim]`, `node tests/coop/edge.js <port> <w> <h>`, `node tests/coop/perf.js <port> <w> <h>` (two simulated Xbox pads). Hooks: `window.__coop`.

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
- **The Chip Kid, Harborplace promenade: cane-brawl mech duel (reworked for fun 2026-10-12, hark/chipkid-fun).** SWING (J, X) = a 3-hit cane combo (forehand, backhand, overhead SMASH) with wind-up, motion trail, hitstop, shake, sparks + chip crumbs + foil shreds, mech flinch + white flash, damage numbers, combo counter; hits on an OPEN mech are crits. POWER (ACT, E, Y) fires a special once the meter is full (it fills fast from hits and dodges; bar glows, ACT pulses, POWER READY prompt): BAY DUST CYCLONE, CRAB-MALLET POUND (shockwave), "HON!" HOMER (mech flies off and crashes back), each with slow-mo, zoom and flashes. Dodge (stick, white buttons, A / D, LB / RB) and DUCK (stick down, JUMP, S, A) the slow, loudly telegraphed attacks ("!" over the dome, ground ring / lane flashes): seasoning cloud, chip-can barrage, bag-slam, claw jab. Polish pass (2026-10-12): it hits back now, still clearly telegraphed: ~1.5x attack rate, can barrages most turns with two-can volleys from round 2 (one lane always clear), 1.5x damage, mech HP 220 / 245 / 270; long i-frames, one crab cake per round, one second wind, +20 HP between rounds; hitting it while it guards makes it attack sooner; a swing keeps Harold in his lane. The kid and mech are an original design: a gap-toothed mech pilot (purple flight helmet + antenna, goggles, messy indigo hair, teal jumpsuit) in the purple / teal / lime homemade CRUNCH-O-TRON with a crayon chip-monster doodle (no snack-brand palette, logo or mascot traits). HUD text wraps / shrinks to fit 390 px. 3 short rounds; the final blow is a slow-mo KO (the mech blows apart into a chip cloud, the kid tumbles out, sulks and runs off), then a star grade (hits taken; +1 star for style: 3 specials or 5 dodges) + REMATCH.
- Both: the radio ducks to 22% (`__radio.fightDuck`), the city HUD hides, the arcade panel relabels; a loss offers RETRY (from the phase / round reached) or LEAVE; a win calls `BOSS_CLEAR.clear(lmId)` (06g0_boss_clear.js: boss cleared, district crime 0) and returns to the street.
- Rig hooks: `window.buildBigJimmy(ctx)` / `window.buildChipKid(ctx)` (contracts in the file headers); otherwise procedural stand-ins.
- Shared hit juice in the core (09a, opt-in, used by the Chip Kid and Big Jimmy's belly hits): `DUELS.hitstop / slowmo / shake / zoom / flash / pop / combo / power / ready / impact / hitSfx / trail / debris / sprites`, `DUELS.over(..., { again: true })` = REMATCH on a win card.
- Tests: `?duel=jimmy|chipkid` starts one, `&duelbot=win|lose` plays it (Chip Kid also `mash` = only mashes SWING; `&ckhp=N` test-only low start HP without mercy items; `&ckround=N`); `T/duel/ckshot.js` freezes on hit / special / KO moments for screenshots. `T/duel/bg.sh <name> <port> <kind> <win|lose> <w> <h> <shot.png|-> [sim] [shotAt]` (detached run of T/duel/run.js), `T/duel/entry.js` (city ring -> ACT -> duel -> LEAVE).

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

## Downtown-west district, Rash Field, Hooters (hark/lexington) — src/03d_lexington.js + src/09l_lexington.js
- **Lexington Market** (HD, `lmHD('lexington')`): RES block x -100..-76, z -70..-46 (a block north of Oriole Park), facade on Pratt St. Gray standing-seam gable hall
  + shed wings, LEXINGTON / M A R K E T, WORLD FAMOUS, SINCE 1782, red globe seal, brick piers + black storefront windows, black entry canopy
  ("WORLD FAMOUS · LEXINGTON MARKET"), original stall boards, planters + trees. Night: warm uplight (emi bands + additive washes), lit windows.
  `window.LEX_ANCHOR` = the doors under the canopy (x -90.6, z -47.6, yaw PI = facing the doors) + hall box + inside point. Landmark `lexington` (boss stub Pit Beef Pete at the anchor).
- **Westminster Burying Ground**: RES block x -134..-110: brick-walled graveyard (east gate toward the market, south gate on the street), brick Gothic church
  + tower + spire, seeded tombstones / obelisks / box tombs, Poe's memorial, catacomb hatch stub. `window.POE_ANCHOR` (grave, gates, church, catacombs, stones[]). Name popup only (not a crime district).
- **Rash Field**: PIERS 'rash' x -42..-21, z 19..30 on the south shore between the Science Center and Federal Hill (clear of the water-taxi + paddle-boat paths).
  Striped turf, lines, creases, two goals, benches, rail on the water side, park sign. `window.RASH_ANCHOR` (field box, goals, entry). Landmark `rashfield` (boss stub Riptide Rodney).
- **Hooters** on the octagon at the harbour (south) end of the Light Street Pavilion (-55.5, 0.9): glass curtain wall, dark-bronze canopy with wood soffit + LED strips,
  SUITE 1445, wood side panels, menu board with a drawn owl, bistro table, and the big HOOTERS channel letters (white halo, silver returns, ®) on the Light St face
  AND the harbour face, orange halo glow at night. All lettering is canvas-drawn in code; refs/ images are never shipped. `window.HOOTERS_ANCHOR`.
- Full map: LEXINGTON MKT + RASH FIELD labels (footprint fallback, no baked mini-model yet). Minimap dots come from LANDMARKS.
- Test params: `?goto=<place>` (lexington, lexnear, westminster, poe, rash, hooters, hootersharbor) frames the place with a free camera
  (sim paused); `&gotoplay=1` just drops Harold there. Night: add `&tod=0.5`. Shots: `T/lex/all.sh <port>`, draw calls: `T/lex/dc.sh` (T/ is gitignored).

## The Pool Shark, Pendry roof pool deck (hark/boss-pool-shark) — src/09r_poolshark.js
<!-- poolshark: -->
- A DUELS-core mode (own scene + camera; radio ducked; city HUD hidden). 3/4 view of the Pendry rooftop pool deck over the harbor: Harold walks the deck
  (stick / WASD), CANE (J / SWING / pad X: SCRATCH! > CORNER POCKET! > 8-BALL! spin finisher, auto-faces the nearest target), HOP (K / JUMP / pad A),
  BANK SHOT (E / ACT / pad Y, needs a full POWER meter: hits, dodges and harbor throws fill it).
- The shark hides in the pool and only comes out to attack, every attack telegraphed >= 1.0 s: CUE BREAK (aim lines fan over the deck, then the balls),
  CANNONBALL (landing shadow + ring on Harold, then a wave ring to HOP), FIN CIRCLE (phase 2+, a red ring closes round Harold, then the lunge). After each he
  is OPEN (on the edge chalking up, or beached and flopping): hit him. 3 phases x 125 HP; phase 3 adds Cobblestone Catfish goons: a finisher throws a goon
  into the harbor; one thrown past the shark banks off him. BANK SHOT = Mavis team-up (she racks a giant cue ball to Harold, he banks it off the pool edge
  into the shark: big damage + stun, every goon goes over the rail). Help: 1.2 s i-frames, Mavis' crab cake once a phase when low, one SECOND WIND, +35 HP between phases.
- KO: slow-mo belly flop with no splash ("...plip."), then he floats off on a pink pool float with his shades down. Win = `BOSS_CLEAR.clear('pendry')` + grade card
  (stars by hits taken: <=3 S, <=8 A, else B). Loss = RETRY the phase / LEAVE.
- Entry: the glowing ring at the Pendry boss anchor (LANDMARKS pendry .boss 126, -19.5) -> ACT "FIGHT". Lines: GR1 bosses.pool_shark intro/defeat, cobble_catfish barks.
- Rig hooks: `window.buildPoolShark(ctx)` / `window.buildCatfishGoon(ctx)` (contracts in the file header); otherwise procedural stand-ins.
- Tests: `?poolshark=1&poolsharkauto=win|lose` (or `?duel=poolshark&duelbot=win|lose`), `T/ps/run.js <port> <win|lose> <w> <h> <shot|-> [sim] [shotAt]`, `T/ps/entry.js` (city ring -> ACT -> LEAVE). `__poolshark`.

## The Hon Queen, Federal Hill: slope brawl (hark/boss-hon-queen) — src/09n_honqueen.js
Boss #14 on the DUELS core (own scene + camera, radio ducked, city HUD hidden). ACT "FIGHT" on the pink ring at the Federal Hill boss anchor on the hilltop (-3, 59), or `?honqueen=1`.
- A view up the south slope of Federal Hill (grass, a brick path at the foot, the hilltop park with flagpole, cannon, benches, rowhouses behind; harbor skyline off to the sides).
  Harold climbs (uphill slower). Everything she does knocks him DOWN the hill; past the bottom path he tumbles to the street (8 damage) and climbs back on.
- Attacks, each with a "!" over her head and a >= 1.0 s tell: HAIRSPRAY CLOUD (can shake + rattle, a pink cone tracks Harold then locks red: step out),
  BEEHIVE BOULDER (she lifts her hive, a lit chevron lane runs down the slope: step off or HOP), LAWN-FLAMINGO TOSS (landing rings, flamingos arc in),
  HIP CHECK when Harold is close (hip wiggle + spreading red ring: back off). After each she is OPEN (fanning herself / in curlers): cane her. 3 phases x 110 HP.
- Harold's moveset here: TEASE! > BACKCOMB! > EXTRA HOLD! (spin finisher with a hairspray puff trail), HOP. POWER (hits + dodges) -> ACT = SALON SHOWDOWN team-up:
  slow-mo, Mavis charges up, afro vs beehive, Mavis pins her, Harold vaults in for SALON SMASH (26) and she stays pinned for free hits.
- Help: 1.2 s i-frames, Mavis' crab cake once a phase when low, one SECOND WIND, +35 HP between phases. Combo counter pops, hit-stop, shake, damage numbers.
- KO: slow-mo, the beehive deflates, she rolls down the hill onto a marble stoop: "Go get a crab cake, hon." Grade card (S <= 3 hits, A <= 8, else B).
  Win = `DUELS.bossCleared('fedhill')` -> `BOSS_CLEAR.clear('fedhill')`. Lose = RETRY the phase at full health, or LEAVE.
- Rig hook: `window.buildHonQueen(ctx)` -> `{ root, body?, hips?, hive?, can?, armL?, armR?, glasses?, mats? }` (contract in the file header); `window.buildLawnFlamingo()` -> geometry. Stand-ins otherwise.
- Tests: `?honqueen=1&honqueenauto=win|lose|mash` (mash = SWING-only bot that never dodges), `&honqueenphase=1..3`, `&honqueenhp=N`, or `?duel=honqueen&duelbot=win|lose`.
  T/hq/run.js `<port> <win|lose|mash> <w> <h> <shot.png|-> [sim] [shotAt sec|state]`, T/hq/entry.js (city ring -> ACT -> duel -> LEAVE, draw calls); T/ is gitignored.
## Sugar Rush, sugar refinery roof (hark/boss-sugar-rush) — src/09o_sugarrush.js
<!-- sugarrush: -->
- Boss #15 on the duel core (DUELS): a 3D arena brawl on the refinery roof beside the neon sign, which reads the original homage name **HARBOR SUGAR CO.** (canvas-drawn; no real brand name or logo).
  Entry: the pink ring at the refinery's west door (69.6, 53.5), ACT = FIGHT ("elevator to the roof"). Win = `BOSS_CLEAR.clear('domino')`.
- Moves (each tell >= 1.0 s with a "!" + tell card + ground mark): CRYSTAL SPIKES (rings, then spikes), SUGAR-HIGH DASH (pink after-images mark the path; dizzy after), MOLASSES POOL (amber ring, then a slow pool, no rolling in it).
  OPEN after attacks (crystal heart glows) = full damage; on guard hits chip. 3 phases.
- Harold: 3-hit cane combo with this fight's finisher (ROCK-CANDY CRACKER spin + candy sparkles), ROLL (i-frames, close rolls fill POWER), POWER specials alternating
  NEON OVERLOAD (cane-cracks the sign conduit, neon beam) and MAVIS BACK-BOOST (team-up vault). Damage pops, hitstop, shake, slow-mo KO (sugar avalanche + raining cubes, tap to skip), star grade on the win card.
- Controls: stick / WASD move, SWING (J / pad X), ROLL (JUMP, K / pad A), POWER (ACT, E / pad Y).
- Rig hook: `window.buildSugarRush(ctx)` (contract in the file header); otherwise a procedural sugar-crystal golem stand-in.
- Tests: `?sugarrush=1` starts it, `&sugarrushauto=win|lose|mash`. Runner: `T/sr/run.js <port> <win|lose|mash> <w> <h> <shot|-> [sim] [shotAt|state]`, entry + city draw calls: `T/sr/entry.js <port> <w> <h>` (T/ is gitignored).
