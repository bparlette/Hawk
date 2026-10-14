
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
