
<!-- ===================== LEVELS 8-15 (restructure worker L8-15) ===================== -->
# Levels 8–15: Zone 1 → Twist → Zone 2 → Arena (Phase 1: design + art)

**Shared notes for L8–15**
- All new art is in `/workspace/work/restructure/L8-15/out/`. Nothing is installed in `levels/` yet, and no `levels/*.js` or `index.html` was touched.
- Each Zone 2 background has the same pixel size as its Zone 1 jpg. Its floor-top line is painted at the same image y, `floor[0] × 512/224`. That means each Zone 2 section can reuse Zone 1's `floor:` value exactly. The right edge is cross-faded (64 px) into a mirror of the left edge, so the engine's horizontal tiling joins cleanly.
- Twist sheets are P-mode PNGs made with the same `kit.py` key/pack pipeline as `props_9_13`. They are stored at about **2 sheet px per world px**, so draw them with `api.ctx.drawImage(img, x,y,w,h, dx,dy, w/2,h/2)`. Frame rects are `[x,y,w,h]` in `out/meta.json`, under the sheet's file name.
- The mini-boss sheet (`level9_ronin.png`) uses the `[x,y,w,h,anchorX]` bottom-aligned strip format of `level15_elite.png` / `level8_razorback.png`. The idle frame is 176 px tall; drawing at `RN_SK = 88/176` gives about 88 world px.
- Suggested section shape (normSection): `Zone1 {bg:Z1, length≈1300, locks:[0,620], waves:[w1,w2]}` → `Twist {bg:…, length 384–1400, locks/waves as listed, hazards:[twist]}` → `Zone2 {bg:Z2, floor:<same as Z1>, length≈1300, locks:[0,620], waves:[w3,w4]}` → existing arena section, unchanged. Each level's current 4 wave lists split 2 + 2 across the zones. The twist adds 2–3 waves' worth of time with its own spawns.
- Twist types are all different across L8–15: stealth, mini-boss, collapse/drop, vehicle ride, defend-the-ally, turret gimmick, hazard run / timed escape, falling-elevator fight.

## Level 8 — FORTRESS OF RAZORBACK
- **Zone 1:** fortress corridor, `level8_fortress.jpg` (existing), floor [172,205]. **2 waves:** `["purple","gunner","purple"]`, `["sword","gunner","dasher","purple"]`. Hazards: lasers, vents, panels.
- **Twist: STEALTH / SEARCHLIGHT. "LOCKDOWN SWEEP" (~2.5 waves of time, on the Zone 1 bg, length ~900, scroll unlocked).**
  - Ceiling searchlight sentries (`lamp`) slide along the ceiling rail. Each one throws a code-drawn light cone onto the floor band.
  - Crouching behind a `cover` barricade, or standing in a dark `alcove`, hides you.
  - If a cone touches you: the lamp turns `lampRed`, the `klaxon` flashes, the existing `doors` hazard drops 2 troopers, and the existing `lasers` slam on for 4 s.
  - Reach the far blast door without being seen 3 times, or clear the alarm spawns. Score bonus for a clean run ("GHOST" banner).
- **Zone 2:** NEW `level8_reactor.jpg` (1864×512, floor [172,205]). Razorback's reactor hangar: a magenta reactor column, trooper assembly racks, catwalks, the same gunmetal/magenta/cyan lighting. **2 waves:** `["heavy","gunner","blue","star"]`, `["heavy","gunner","dasher","sword","gunner"]`. Hazards: vents, doors (trooper racks), panels.
- **Transition:** the sweep ends at a blast door, reusing the `doors` hazard art. It grinds open with a red beacon, the camera scrolls through, and the bg switches on the door frame. Then on to the throne room (`level8_final_boss.jpg`, unchanged).
- **Twist art:** `out/level8_sentry.png` (520×141): lamp, lampRed, klaxon, cover, alcove. The alcove is an opaque wall inset, drawn on the back wall.

## Level 9 — SHADOWS OF EDO
- **Zone 1:** Edo village street, `level9_edo.jpg` (existing), floor [172,216]. **2 waves:** `["purple","purple","star"]`, `["blue","sword","purple","dasher"]`. Hazards: arrival, smoke, ambush.
- **Twist: MINI-BOSS. "THE RONIN AT THE GATE" (one locked screen at the village gate, ~2.5 waves of time).**
  - An oni-masked armoured ronin (HP about 24, roughly half of Karai).
  - Moves:
    - guard: blocks frontal hits; break it with a jump attack or a throw.
    - wind → slash: a wide horizontal cut with a floor danger stripe.
    - lunge: a long dash thrust down your lane.
    - At 50% HP, summons 2 `star` ninjas once.
  - Defeat = `down` frame, sword drops, gate swings open.
  - Reuses the `volley` arrows as background pressure only after 50% HP.
- **Zone 2:** NEW `level9_bamboo.jpg` (1630×512, floor [172,216]). Bamboo grove road to the castle: torii gates, stone lanterns, the castle keep on the hill, the same sunset and the purple rift. **2 waves:** `["star","sword","blue","dasher","purple"]`, `["sword","sword","blue","star","dasher"]`. Hazards: spikes (bamboo stakes fit here), smoke, volley.
- **Transition:** the ronin falls, the gate swings open, and a petal gust plus a short white wipe carry you onto the bamboo road. The road ends at the castle steps, leading to the courtyard arena (`level9_castle.jpg`, unchanged; Karai).
- **Twist art:** `out/level9_ronin.png` (913×176, `[x,y,w,h,anchorX]`): idle, walk1, walk2, guard, wind, slash, lunge, hurt, down. *Known nit:* the hurt frame's thighs were patched where the lunge blade overlapped them in the render. It reads fine at game scale (about 0.5×) but is not perfect up close.

## Level 10 — PIRATE SHIP
- **Zone 1:** main deck, `level10_galleon.jpg` (existing), floor [166,218]. **2 waves:** `["purple","purple","star"]`, `["sword","blue","purple","gunner"]`. Hazards: `ship(false)` (roll, barrels, cannon volleys, boarding ropes).
- **Twist: COLLAPSE / DROP TO A LOWER LEVEL. "TIMBER!" (~2 waves of time).**
  - An enemy broadside snaps the main mast. The `mast` crashes across the deck as a big shadow telegraph, then blocks the back lanes as a jump-over obstacle.
  - The deck starts splitting. `hole` patches open under a floor reticle, and `plank1-3` debris flies (reuse the dive-lock cracked-plank code).
  - Survive 1 wave of boarders while the holes spread. Then the whole floor gives way, players drop through with a fall animation, and a dust burst lands them on the gun deck.
  - A `keg` with a lit fuse rolls across as a throwable: hit it toward enemies.
- **Zone 2:** NEW `level10_gundeck.jpg` (1878×512, floor [166,218]). The gun deck below: cannon rows at open ports showing the sea, lanterns, hammocks, a ladder up to a light shaft. **2 waves:** `["heavy","sword","dasher","star"]`, `["heavy","gunner","sword","blue","purple"]`. Hazards: ship roll (reduced), barrels, cannon recoil (a cannon fires out of its port and its carriage slams back across a lane).
- **Transition in:** the drop through the deck. **Out:** climb the `ladder` (painted) up to the quarterdeck arena (`level10_galleon_boss.jpg`, unchanged; Armaggon).
- **Twist art:** `out/level10_collapse.png` (568×539): mast, hole, plank1, plank2, plank3, ladder, keg.

## Level 11 — WILD WEST TRAIN
- **Zone 1:** boxcar roofs, `level11_train.jpg` (existing), floor [147,186]. **2 waves:** `["purple","purple","blue"]`, `["star","purple","heavy","blue"]`. Hazards: scenery, gaps, events (tunnel/tower), hats.
- **Twist: VEHICLE CHASE / RIDE. "HANDCAR PURSUIT" (~3 waves of time, auto-scroll on `level11_desert.jpg` used as a tiled backdrop).**
  - The outlaws uncouple the rear cars. The turtles jump onto a pump `handcarA`/`handcarB` (lever alternates on the beat), riding on `track` that tiles under it.
  - An `outlawCar` armoured handcar runs alongside on a parallel track. Its riders leap across in pairs (reuse `leapIn`).
  - Hit the car's shield 3× to knock it off the rails. Two passes. The existing `tunnel` event can reuse its LOW warning.
- **Zone 2:** NEW `level11_saloon.jpg` (1672×512, floor [147,186]). Inside the passenger saloon car: varnished panelling, windows on the sunset desert, brass lamps, green benches, a bar counter. **2 waves:** `["dasher","sword","purple","star","gunner"]`, `["heavy","gunner","dasher","purple","sword"]`. Hazards: hats, plus a new light gimmick: the car lurches, sliding bottles/luggage drop from the racks as the throwables `crate`/`rock` from level11_props. Tunnel events become "lamps go dark" moments.
- **Transition:** the handcar catches the train and players leap onto the rear platform (white flash), through the saloon door. The saloon's front door opens onto the flatcar arena (`level11_boss.jpg`, unchanged; Leatherhead).
- **Twist art:** `out/level11_handcar.png` (520×535): handcarA (lever left), track, handcarB (lever right), outlawCar.

## Level 12 — FUTURE NYC 2105
- **Zone 1:** skyway, `level12_skyway.jpg` (existing), floor [170,216]. **2 waves:** `["purple","blue","purple"]`, `["gunner","dasher","blue","star"]`. Hazards: traffic, pads, drones.
- **Twist: DEFEND THE ALLY. "HACK THE GATE" (one locked screen at the station gate, ~3 waves of time).**
  - A friendly hacker bot (`bot`, then `botHack` with a code-drawn cyan beam) hovers at the `gateLock` terminal and hacks for about 40 s. It has its own HP bar.
  - Enemies target the bot first. `gunner` shots and `dasher` rushes hit it, and it switches to `botHurt` and pauses the hack while damaged.
  - Security drones (the existing `drones` hazard) sweep it too.
  - The bot reaching 0 HP is not a fail: it reboots after 6 s and the timer loses 25%.
  - On success: `botCheer`, the terminal becomes `gateOpen`, and the doors part.
- **Zone 2:** NEW `level12_station.jpg` (1786×512, floor [170,216]). A maglev station platform: glass wall, a maglev in a tube, holo-ads, the neon skyline behind. **2 waves:** `["heavy","sword","gunner","dasher"]`, `["heavy","gunner","blue","dasher","star"]`. Hazards: pads (they read well as platform pulse plates), drones, plus an "arriving maglev" lane gust: a light lane telegraph, then a pushback wind (code).
- **Transition:** the gate opens and the camera walks through into the station. The station's far end has the data-hub door, which leads to the arena (`level12_datahub.jpg`, unchanged; Viral).
- **Twist art:** `out/level12_ally.png` (520×180): bot, botHack, botHurt, botCheer, gateLock, gateOpen. *Nit:* the gateOpen screen has a tiny painted "OPEN"-like glyph.

## Level 13 — DIMENSION X
- **Zone 1:** alien plain, `level13_dimx.jpg` (existing), floor [150,194]. **2 waves:** `["purple","gunner","blue"]`, `["heavy","dasher","gunner","purple"]`. Hazards: acid, chasm, meteors, bunkers; level-wide low gravity kept.
- **Twist: TURRET / THROWABLE GIMMICK. "SEIZE THE CANNON" (~2.5 waves of time, locked screen).**
  - Beat the 2-soldier crew off a rock-soldier `cannon`. Standing at its seat and pressing attack mans it.
  - The player aims up/down with lanes. `cannonFire` launches `shell`s at incoming stone `pod` drop-pods arcing in from the sky. Each pod that lands bursts into `rubble` and releases a rock soldier.
  - Shoot 8 pods, or clear what lands. Enemies can knock you off the seat.
  - Reuses the meteor shadow telegraphs and the crater code.
- **Zone 2:** NEW `level13_canyon.jpg` (1809×512, floor [150,194]). A glowing crystal canyon: violet walls, magenta and teal crystals, a stone arch, ooze pools, the same alien sky. **2 waves:** `["sword","gunner","star","heavy"]`, `["heavy","gunner","dasher","blue","gunner"]`. Hazards: acid, meteors (crystal meteors fit perfectly), chasm (one crack only), gravity.
- **Transition:** the last cannon shot blasts the rock wall at the screen's right edge (big boom plus rubble burst) and opens the canyon mouth. The canyon ends at the fortress approach arena (`level13_dimx_boss.jpg`, unchanged; Traag → Granitor).
- **Twist art:** `out/level13_turret.png` (520×354): cannon, cannonFire, pod, rubble, shell. The pod's acid-green trail survived the chroma key and was checked.

## Level 14 — TECHNODROME PORTAL
- **Zone 1:** portal street, `level14_portal.jpg` (existing), floor [170,214]. **2 waves:** `["purple","purple","star"]`, `["purple","heavy","gunner","sword"]`. Hazards: street (falling modules, turrets, mousers).
- **Twist: HAZARD RUN + TIMED ESCAPE. "TENDRIL ALLEY" (~2 waves of time, length ~1400, scroll unlocked, 45 s countdown banner "PORTAL SURGE").**
  - Technodrome drill tendrils burst from the asphalt down the street in 3 stages: `mound` (warning, with purple glow cracks), `drillHalf` (lane hit), `drillFull` (rears up, then stabs the marked spot).
  - Each leaves a `crater` (slow zone), with `chunk1-3` flying.
  - Light mouser spawns only. Reaching the El overpass before 0 escapes the surge. At 0, a surge shockwave deals 2 damage and resets you 300 px (no fail).
- **Zone 2:** NEW `level14_elstreet.jpg` (1696×512, floor [170,214]). Under the elevated subway: green El girders along the back sidewalk, a stalled train overhead, roll-down shutters, small fires, the purple vortex between the girders. The street band is clear. **2 waves:** `["heavy","gunner","blue","star"]`, `["heavy","heavy","gunner","dasher","sword"]`. Hazards: street turrets, mousers, plus the stalled train dropping sparks/debris (reuse module shadows, small).
- **Transition:** the tendril run ends under the El, where the screen shakes and the last tendril retreats. The El street ends at the plaza arena (`level14_technodrome.jpg`, unchanged; Krang).
- **Twist art:** `out/level14_tendril.png` (520×459): mound, crater, chunk1, drillHalf, chunk2, chunk3, drillFull.

## Level 15 — SHREDDER'S TOWER (finale; restructured in the same spirit)
- Current order: elevator (one screen, 4 waves) → penthouse (Shredder) → lab run (3 waves) → Super Shredder breach in the lab.
- New order keeps **both boss fights, their code and their sequence intact**. Only the climb before them is reshaped.
- **Zone 1:** mutagen labs (tower sub-levels), `level15_lab.jpg` (existing), floor [178,220]. **2 waves:** `["purple","sword","gunner","purple"]`, `["heavy","sword","star","dasher"]`. Hazards: vats.
- **Twist: FALLING-ELEVATOR FIGHT. "EXPRESS TO THE TOP" (~3 waves of time, existing one-screen `level15_elevator.jpg`, floor [186,221], existing `elevator` hazard).**
  - The climb plays as today, with Foot Elite drop-ins and security scans.
  - At floor 88, the cable snaps: `cable` whips past the glass with sparks, the `elight` flashes red, and floor speed reverses into a plunge with streaks going UP. Low gravity: jumps float.
  - The `hatch` tears off and two Elite drop in. `brake` clamps grind sparks on both rails, and a `weight` counterweight rushes past (a shadow telegraph, then a vertical hazard down one lane).
  - The brakes catch (screen shake), then the car is winched back up to floor 99, "DING".
- **Zone 2:** NEW `level15_dojo.jpg` (1880×512, floor [178,220]). The Foot sky dojo on the top floor: rain-streaked windows on the night city, crimson banners, armour stands, a gong, lanterns. Tower-night lighting. **2 waves:** `["blue","star","sword","dasher"]`, `["sword","sword","heavy","dasher","star"]`, all Foot Elite skins. Hazards: a light-only code gimmick where the gong rings and lanterns dim (optional).
- **Arena (unchanged):** the penthouse rooftop, `level15_penthouse.jpg`: SHREDDER.
  - Judgment call: the lab section currently sits between Shredder and Super Shredder. With the lab moved to Zone 1, Super Shredder's breach plays where it fits best.
  - **Option A (recommended):** after Shredder's KO, a short "he falls through the roof into the labs" cut, then a one-screen lab arena section (`level15_lab.jpg`, length 384) running the existing `labArena` + `vats` hazards untouched. This is the least code change and keeps the finale 100% intact.
  - **Option B:** run `labArena` on the penthouse bg.
  - Option A reuses the lab bg twice (opening + finale arena). That is acceptable story-wise: you return to where he mutates.
- **Transition:** lab → elevator doors close; elevator "DING" → doors open onto the dojo; dojo stairs → roof.
- **Twist art:** `out/level15_freefall.png` (520×461): cable, brake, hatch, weight, elight.


## Levels 1–7 (written by the L1-7 restructure worker, 2026-10-08)

Shared conventions for this batch:
- **Art lives in** `/workspace/work/restructure/L1-7/`: `bg/` (zone-2 strips, twist backgrounds, proposed arenas), `props/levelN_twist.png` (P-mode, packed with kit.pack; `_rgba.png` beside each), `meta.json` (frame rects + bg sizes), `contact/LN_contact.jpg`. Rebuild with `python3 build.py` then `python3 contact.py`.
- **Backgrounds**: 512 px tall like every existing `levelN_*.jpg` (drawLevelBG scales to H=224, so 1 world px = 2.286 bg px). Each zone-2 strip was painted with that level's zone-1 bg as the style reference and **keeps zone 1's `floor` values**: the wall/floor line sits at the same height, so `floor` can be copied over unchanged. Strips are pre-blended to wrap horizontally (the last 96 px are crossfaded into the first), so plain tiling (no `bgMirror`) loops without a hard seam.
- **Prop sheets**: sheet px = 2x world px (draw at 0.5), the same rule as props_2_6_8. Frames are `[x, y, w, h]` in `meta.json → props → levelN_twist.png → frames`.
- **Waves** use only existing enemy types (purple, blue, star, sword, heavy, dasher, gunner). Lengths and locks are suggestions in the existing `sections` format; the twist is listed as its own section, or as a hazard inside one, for the code phase to wire.
- No mini-boss was used in 1–7, so no new character sheet was needed. Mini-boss and defend-the-ally twists are left for 8–15.

### Level 1 — BURNING TENEMENT (built into index.html)
- **Zone 1 (existing):** the burning hallway (`hallway.jpg`, mirrored tiling, floor 150–215). **2 waves**: [purple, purple, blue] and [star, heavy, purple, dasher]. Keep the fire FX, ceiling smoke and Zap-Roller intro.
- **Twist: COLLAPSING FLOOR (drop to a lower level), about 2.5 waves of time.** Past the last lock, the floor starts giving way. Cracked boards (`crack`) glow, then become holes (`hole`) one after another along the lane. Burning beams (`beam`) and `debris` rain down with the usual shadow-on-floor telegraph. The player is pushed right as the floor caves in behind them, while dashers and ninjas jump in. At the end the whole stretch drops. Show a fall wipe (debris falling past, screen shake), then land in zone 2. The stairs and rolling ball can stay in zone 1 or be cut, since the drop takes the place of the stairwell.
- **Transition:** the drop. Zone 2 opens with a ragged burning ceiling hole painted at its left end, where the players land.
- **Zone 2 (new):** `bg/level1_lobby.jpg` (1968x512, floor 150–215). The ground-floor lobby of the same building: mailboxes, a cage elevator, the glass street doors, sprinklers spraying, the ceiling hole at the left. **2 waves**: [sword, dasher, blue, purple] and [heavy, gunner, star, dasher, purple]. A Scorcher mid-boss beat can sit here if it is kept.
- **Boss arena (existing):** the apartment, `room.jpg` (section B, Ramrod + Razor). Reached through the burning door (`door` frame) at the lobby's right end.
- **Twist art:** `props/level1_twist.png`: hole, crack, beam, debris, door.

### Level 2 — STREET RUMBLE
- **Zone 1 (existing):** the neon street, `level2_street.jpg` (floor 168–218). **2 waves**: [purple, purple, blue] and [star, heavy, dasher, blue]. Hazards: manholes, hydrants.
- **Twist: SEARCHLIGHT / STEALTH CLIMB, about 2 waves of time.** At the end of the street the players climb the fire escape (`escape` prop at the zone-1 right end; short climb cut). The first ~2 screens of the rooftops become a stealth run. A Foot attack helicopter (`heli` + `lamp`; the cone stays code-drawn, as in L12's drone) hovers and sweeps a searchlight across the roof. If the light catches a player, a siren goes off: gunners rappel in (2–3 drop-ins), and the chopper fires a short volley using the existing ray bolt. Players stay safe in the shadows of the water towers and bulkhead, or can sneak-attack lone sentries (purple) for a bonus. Then the chopper peels off and the locks start.
- **Transition:** climbing the ladder (fire-escape prop) from the street to the roof. A roof hatch (`hatch`) can be the spawn door for zone-2 enemies.
- **Zone 2 (new):** `bg/level2_rooftops.jpg` (1724x512, floor 168–218). Wet tar roofs, water towers, a neon billboard back, the skyline. **2 waves**: [dasher, purple, sword, star] and [heavy, dasher, gunner, blue, purple]. Weather: rain (as zone 1). Manholes and hydrants don't fit up here, so the hazard is the chopper making occasional passes.
- **Boss arena:** L2 has **no separate arena bg today** (Brickjaw fights at the end of the street strip). A **proposed** one-screen arena is painted: `bg/level2_rooftop_boss.jpg` (1032x512, floor 168–218), the top roof with a helipad under the billboard. Wiring it is optional.
- **Twist art:** `props/level2_twist.png`: heli, lamp, escape, hatch. The heli frame includes a short painted beam stub under the lamp. Draw the code cone over it, or clip the bottom ~50 sheet px.

### Level 3 — SEWER SHOWDOWN
- **Zone 1 (existing):** the tunnels, `level3_sewer.jpg` (floor 154–218). **2 waves**: [dasher, purple, dasher, blue] and [purple, star, heavy, dasher, blue]. Hazards: wading lane, pipes, geysers.
- **Twist: TIMED ESCAPE / FLOOD RISING, about 2.5 waves of time.** A closed sluice gate (`gateShut`) at the end of zone 1 bursts open: the `frame` stays, the gate slides up, and the `gush` torrent pours out. A green flood crest (`wave`, tiled from the left edge) chases the player rightward under a countdown ("GET TO HIGHER GROUND!"). The camera pushes like an auto-scroll at ~2.2. Floating `raft` and `drum` pieces drift in the lane and can be knocked into enemies. Dashers surf in on the crest. If the crest catches the player, it does damage and knockback rather than an instant KO. The run ends when the player grabs the `ladder` up onto the pump-station platform.
- **Transition:** the ride on the flood. The crest washes the player into the pump station, and they climb the ladder onto the walkway.
- **Zone 2 (new):** `bg/level3_pumpstation.jpg` (1968x512, floor 154–218). A flooded pump station with giant turbines, flywheels, a gauge panel, a catwalk, and a green back channel at the same height as zone 1's. **2 waves**: [sword, dasher, gunner, purple] and [heavy, dasher, star, sword, purple]. Hazards: geysers + wading (reused).
- **Boss arena (existing):** `level3_sewer_boss.jpg` (Gulch Gator).
- **Twist art:** `props/level3_twist.png`: wave, gateShut, gush, frame, raft, drum, ladder.

### Level 4 — SUNSET SHRED (auto-scroll highway)
- **Zone 1 (existing):** the elevated highway at sunset, `level4_highway.jpg` (floor 160–216, auto 2.4). **2 waves**: [purple, blue, dasher] and [blue, star, dasher, purple]. Hazards: road, traffic, riders.
- **Twist: TURRET GIMMICK, about 2.5 waves of time.** An ally flatbed pickup (`truck`, with `truckGun` showing the turret mounted) pulls alongside in the middle lane. The player hops onto the bed and mans the water cannon (`turret` swivels; the `spray` muzzle blast shows on fire). For ~45 s, move up and down to aim across lanes and blast incoming drones, rider dashers and lane missiles with the existing drones, riders and rocket logic. Traffic keeps coming. Then the truck drops the player off at the tunnel mouth.
- **Transition:** the ride into the tunnel. The truck drives into the tunnel and the bg changes behind a short dark band or flash.
- **Zone 2 (new):** `bg/level4_tunnel.jpg` (1624x512, floor 160–216; the exit-mouth curves were cropped so the strip loops as straight tunnel). Sodium-lit tiled tunnel with a walkway rail. **2 waves**: [dasher, heavy, blue, star] and [gunner, dasher, purple, blue, dasher]. Hazards: road, traffic, drones (as the current section 2), with darker headlight glows.
- **Boss arena:** L4 has **none today** (Jetwash is fought on the scrolling highway). A **proposed** arena is painted: `bg/level4_tunnel_boss.jpg` (1032x512, floor 160–216), the road just outside the tunnel exit at dusk with a bridge in the distance. Wiring it is optional.
- **Twist art:** `props/level4_twist.png`: truckGun, truck, turret, spray. The truck faces right; mirror it for leftward travel.

### Level 5 — DOCKSIDE DOUBLE-CROSS
- **Zone 1 (existing):** the dock warehouses, `level5_docks.jpg` (floor 166–218). **2 waves**: [purple, purple, blue, star] and [sword, heavy, purple, star, blue]. Hazards: dockDoors, craneHooks, dockCrates, forklift.
- **Twist: VEHICLE CHASE / RIDE, about 2.5 waves of time.** The players jump onto a harbour patrol boat. The fight takes place on its rear `deck` (a painted plate drawn as a fixed foreground covering the floor band; suggested floor for this section [170, 214]) while `bg/level5_harbour.jpg` (open water + skyline, 1968x512) scrolls behind at auto ~3. Foot jet-skis (`jetski`, with ninja sprites drawn riding) pull alongside with `wake` trails and drop boarders onto the deck: dashers and purples. Buoys (`buoy`) pass as parallax props. The `bow` spray sits at the screen edge. The chase ends when the boat comes alongside the cargo ship. The side-on `boat` sprite is for the arrival and departure shots.
- **Transition:** the ride. The boat pulls up to the ship, and the players climb the side onto its deck (fade or climb).
- **Zone 2 (new):** `bg/level5_shipdeck.jpg` (1968x512, floor 166–218). The cargo ship's main deck between container stacks, with a crane overhead and the harbour visible through a gap. **2 waves**: [dasher, heavy, gunner, purple] and [sword, heavy, dasher, star, blue]. Hazards: craneHooks + dockCrates (reused; containers swing in from the crane).
- **Boss arena (existing):** `level5_docks_boss.jpg` (the ship superstructure, Grimwale).
- **Twist art:** `props/level5_twist.png`: boat, wake, jetski, bow, buoy, deck. The twist bg is `bg/level5_harbour.jpg`.

### Level 6 — FROSTBITE BOULEVARD
- **Zone 1 (existing):** the snowy brownstone street, `level6_snow.jpg` (floor 160–216). **2 waves**: [purple, purple, blue] and [star, purple, dasher, heavy]. Hazards: ice, snowballs, icicles, snowplow.
- **Twist: ENVIRONMENTAL HAZARD RUN (thin ice), about 2 waves of time.** The players cut through the park across the frozen pond (the first ~2 screens of the zone-2 strip, where the fence opens onto the pond). Ice plates (`ice0` → `ice1` → `ice2` → `ice3` hole) crack under anyone who stands on them for more than ~1 s. Falling into a hole does damage and briefly freezes the player (reuse the frozen-block visual). Enemies can be knocked into holes for a quick KO. Roof-snow avalanches (`slide`) dump off the park-side buildings with the icicle telegraph, and snowball lobbers fire from behind `drift` mounds. `sawhorse` barricades mark the start and end. The camera pushes slowly (auto ~1.6), so standing still means falling through.
- **Transition:** going through the park gate. The street ends at the park railings, and a gate opening leads in.
- **Zone 2 (new):** `bg/level6_park.jpg` (1711x512, floor 160–216). A snowy park at night with lamp posts, fairy lights, a stone footbridge and the frozen pond behind the fence. **2 waves**: [heavy, sword, star, dasher] and [heavy, gunner, dasher, purple, blue]. Hazards: snowballs, icicles, ice (the snowplow is dropped, since there's no road here).
- **Boss arena (existing):** `level6_snow_boss.jpg` (the frozen plaza rink, Cold Front).
- **Twist art:** `props/level6_twist.png`: ice0–ice3, slide, drift, sawhorse.

### Level 7 — SCRAPYARD SMASH
- **Zone 1 (existing):** the junkyard machines, `level7_junkyard.jpg` (floor 160–218). **2 waves**: [purple, purple, blue] and [star, heavy, purple, dasher]. Hazards: conveyor, grinder, magnet, rollers.
- **Twist: FALLING-ELEVATOR FIGHT, about 2.5 waves of time.** The players step onto a freight car-lift (`lift`; its deck slab is the floor, suggested floor for this section [176, 206]), and it drops down a shaft into the smelter. `bg/level7_shaft.jpg` (1032x448, tiles vertically) scrolls upward behind the lift. Enemies drop onto the deck from above (enemies "fall in" from the top of the screen, as the L3 pipe drops do). Crushed-car cubes (`cube`) and swinging `hook`s fall past or onto the deck with shadow telegraphs. Halfway down, the brakes (`brake` + `sparks`) bite: the screen shakes and everyone stumbles. Then the free fall resumes, ending in a hard landing at the foundry floor.
- **Transition:** the elevator ride down.
- **Zone 2 (new):** `bg/level7_foundry.jpg` (1968x512, floor 160–218). The smelter foundry hall: furnace mouths, a ladle pouring molten metal, gantry chains, scrap cubes. (The ingot moulds sit on the very back edge of the floor band; treat them as decoration.) **2 waves**: [sword, gunner, purple, blue] and [heavy, dasher, star, sword, purple]. Weather: embers. Hazards: grinder (as furnace vents) + rollers + magnet (reused).
- **Boss arena (existing):** `level7_junkyard_boss.jpg` (the car crusher, Rustmaul), reached back up a ramp. Or treat the arena as part of the foundry; it still reads as the same yard.
- **Twist art:** `props/level7_twist.png`: lift, brake, cube, hook, sparks. The twist bg is `bg/level7_shaft.jpg`.

## GAME MODES (user request 2026-10-08 22:00 ET) — build into phase 2 wiring
Levels must be modular (zone1 / twist / zone2 / boss arena as separable segments) so one level data set drives 3 modes, chosen on title/menu:
- ARCADE: full level (zone1 -> twist -> zone2 -> boss arena) with results screen. Default; = current game flow.
- SPEED RUN: per level only ONE wave then the boss; NO level-over/results screen — boss KO transitions straight into next level (one quick transition). Run timer shown, best time saved per mode.
- BOSS RUSH: boss arena only, boss -> boss across all 15 (incl. Shredder -> Super Shredder), with quick transitions, no results between. Best time saved.
Saves/progress/high scores kept separate per mode; level-select + gallery preserved. Entrances play in all modes (skippable).
