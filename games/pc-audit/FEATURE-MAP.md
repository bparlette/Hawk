# PALM CITY — FEATURE MAP (for the whole-game audit)

Every feature in the push #2 build, where to find it, and how to test it in play.
Compiled Nov 17, 2026 from the game brief + the staged source; **where the brief and
the code disagree, the code wins and the disagreement is noted inline.**
Coordinates are world units (1 unit = 10 cm), y grows south. Core city: x ∈ [0, 1800],
y ∈ [0, 2200]. Player spawn [1240, 1240]; bust respawn [600, 1730].

**Run it:** this folder served as a page (index.html). Controls: floating joystick
(left half, anchors under the thumb) + two round buttons bottom-right — big = context
ACTION (JACK / EXIT / ENTER / BOARD / STEAL…), small = context A (PUNCH on foot,
TURBO in a car, OLLIE on the board, LAND in the helicopter, the armed job/event START).

---

## 1. Free roam, jacking, turbo, damage

- **WHAT:** walk, punch, jack any parked or stopped car (hood-slide entry), drive the
  loop + cross streets, wreck the city. Skid marks persist ~2 min. Breakables
  (benches, lamps, palms, rails, fountain, lifeguard towers) damage in stages
  intact → scuffed → cracked → destroyed; cars dent panel-by-panel, smoke, and die
  as permanent wrecks. Player-caused breakage scores (TIMBER +500 etc.).
- **WHERE:** everywhere; the board lies at [1222, 1250] near spawn.
- **TEST:** jack a parked car (ACTION beside it); hold A in a car = TURBO (top speed
  ×1.4, 290 → 405 u/s, ~3 s burn, ~2 s cooldown); ram a bench/palm repeatedly and
  watch the damage stages; wreck a car and confirm it stays a wreck.

## 2. Wanted, police, chopper, roadblocks, bust

- **WHAT:** stars for jacking (+1), hitting a ped (+1), hitting a cop car (+2),
  witnessed crime; a star fades per 14 s unseen. Cop cars ram and officers bail for
  foot chases (they can only grab a skateboard moving < 45 u/s). A pinned, stopped
  player fills the bust meter → BUSTED → respawn + the director highlight (§10).
  At 3★+ the police **helicopter** joins: searchlight pool (r 70) keeps you "seen",
  slew-capped so a car can outrun the beam. At 4★+ **roadblocks**: cruiser V,
  sawhorses (shatter above 130 u/s, stop you below), spike strips. Spikes put a car
  on the 150 u/s limp — but the *player's* car first gets ~8 s ON RIMS (cap ~210,
  sparks) before the limp (polish bundle). Cops on legal jobs stand down (§3).
- **TEST:** jack a car in view of a cop (1★, cop barks start); hit a cop car (3★,
  chopper arrives, beam tracks you); reach 4★ and find a roadblock; drive over
  spikes and feel rims-then-limp; get pinned and fill the bust meter.

## 3. The four Garage jobs — TAXI / TOW / BUS / GETAWAY

- **WHERE:** the Garage kerb, y = 1456. All four vehicles live there now, 75 units
  apart: GETAWAY van [785, 1456] · tow vehicle [860, 1456] · TAXI cab [935, 1456] ·
  bus [1010, 1456]. A floating tag rides each vehicle; the yellow JOBS hub marker
  sits over the Garage (~[920, 1452]).
- **CODE TRUTH (brief/help text disagree):** there are no tow-truck or bus models
  yet — `jobs.js` falls back: TOW drives a **van_sun**, BUS a **van_sky** (heavy:
  slow, 72% steering). The HELP text still says "tow truck"/"bus". Known art gap,
  not a bug in the job logic.
- **HOW TO START:** get in the flagged vehicle; the small button reads START.
- **TAXI:** pick up the fare (one of 4 passenger types), deliver to the marker.
  Moods pay differently (speed / smoothness / chaos). At 3★+, ~35% of fares are
  undercover feds — hard accel then hard brake throws them out (+600). Legal job:
  cops stand down while it runs.
- **TOW:** hook the marked target car on the spring cable (rest 44, max 74 units —
  the cable length IS the mechanic), haul it to the Garage. Payload smashes at 2.2×
  damage; above 140 u/s it can be SLUNG as a wrecking ball; two over-tensions snap it.
- **BUS:** six-stop loop SOLANA → TACOS → PLAZA → PIER → NOVA → GARAGE; stop in the
  halo, dwell 1.8 s; lap splits tighten 36 / 30 / 24 s.
- **GETAWAY:** pick up the crew: alarm, instant 3★, a spike strip ahead. Three
  bill-DECOYS make cruisers brake. Safe house = +1000, −2★. Spiked near it: BAIL
  onto the skateboard (crewmate rides tandem) and skate in (+400). Full enforcement —
  no legal-job stand-down.
- **TEST:** run each job end-to-end from the kerb; confirm START only arms in the
  right vehicle; confirm no wanted stars accrue during TAXI/TOW/BUS (except the
  scripted fed trap / GETAWAY's own alarm).

## 4. WRECK IT! — plaza ring [1168, 470]

- **WHAT:** 45 s destruction score-attack inside radius 430; chained breaks within
  2.2 s multiply; medals at 2500 / 5500 / 9500.
- **START:** be in a working car within 70 of the ring and press START. A coral
  sedan waits IN the ring at [1225, 505] (the instant-start ring car, §9).
- **TEST:** start from the ring car; chain bench → rail → palm breaks and watch the
  multiplier; check the medal thresholds splash at the end.

## 5. VALET — PARK IT! — [760, 1690]

- **WHAT:** 50 s precision parking, three rounds in the lit bays at [810, 1680],
  [920, 1680], [1030, 1680]; bonuses for mint (untouched) parks and J-turns.
- **START:** in a car at the ring; a cream sedan waits at [715, 1655]. You park the
  car you arrived in — VALET spawns no cars; leaving the car ends the run.
- **TEST:** park all three bays; clip a cone/car on one and confirm the mint bonus
  is lost but the run continues.

## 6. SPOTLIGHT RAVE — fountain ring [1000, 560]

- **WHAT:** 120 s. The real pressure chopper pins you at 3★ and its searchlight
  pool (r 70) is the stage. HYPE only accrues in-beam AND earning (donuts ~2.4/s,
  drift, near-miss; parked = 0). Five continuous seconds out of the beam = LOST
  THE LIGHT. Hype tiers at 34 / 67 raise the star floor to 4★ / 5★, speed the beam
  slew (120 → 175 → 225 u/s) and call in one backup cruiser each. ~17 crowd peds
  ring the fountain.
- **START:** in a car at the ring; a mint convertible waits at [955, 605]. Leaving
  the car or wrecking it ends the run.
- **TEST:** donut inside the beam and watch HYPE climb; sit parked in the beam
  (HYPE must not move); drive out and count the 5 s grace; cross 34 and 67.

## 7. BOARD CHASE — promenade at the pier foot [1296, 1035]

- **WHAT:** on the skateboard at instant 3★: checkpoints in order PLAZA → NOVA →
  VILLAS → SAFEHOUSE, +400 each, escape meter fills a quarter per checkpoint;
  win at the safehouse (heat → 0, +1200) or shake the cops entirely (+800).
  150 s clock. Grabs only land BELOW 45 u/s: speed is armour.
- **START:** ride the board within 60 of the marker and press the board-mode
  button. **Board rack:** if the board is anywhere else, stand at the marker on
  foot and press ACTION — the game's one board recalls to [1296, 1049] and you
  step on. There is never a second board.
- **TEST:** leave the board across the map, walk to the marker, one ACTION press
  → board under your feet; run the checkpoints in order; slow below 45 near a
  foot cop and get grabbed.

## 8. MOTEL SIEGE — motel door [706, 1310]

- **WHAT:** the one side-view mode: walk in and the game cuts to a three-floor
  cutaway. Escalating cop waves (lobby rush → pool doors → balcony ladder → SWAT
  rappelling under the chopper spotlight → pairs every 13 s). Punch, push
  barricades (desk, mattress, dresser) into choke points, spring traps (vending
  machine, CRT TV, linen cart, fuse-box blackout, window AC dropped three
  storeys). Roof-hatch escape lands you on your skateboard in the alley at speed
  (+1500, +100 per KO, one star shed). Grabbed with the ring full = BUSTED.
- **START:** on foot within 30 of the glowing door, press ENTER. Nothing external
  is needed — no vehicle, no item; stars only pick the starting wave. (A cop-hood
  ollie landing near the door at 3★+ — "HOT ENTRY", +1500 — also arms it.)
- **TEST:** enter at 0★ and at 3★ (different opening waves); spring two traps;
  escape via the roof once and get caught once.

## 9. Instant-start guardians + board rack (the owner's rule)

- **WHAT:** a yellow circle is a promise: whatever the game needs is IN the
  circle, one press starts. Beyond the ring cars (§§4–6), the kerb homes (§3) and
  the board rack (§7): every guaranteed vehicle has a **site guardian** — if it is
  wrecked or far from home, not in use, and the player stays within 420 of the
  site for a continuous 10 s, the singleton is restored home, repaired. Guardians
  only ever move/repair the one existing object — population counts never change
  (no duplicates, ever). Watercraft and the helicopter have their own versions
  (§§11–12).
- **TEST:** wreck the taxi at the kerb, stand at the Garage, wait ~10 s → cab
  back and whole. Drive the bus across the map, abandon it, return to the kerb
  on foot → bus restored. Count job cars before/after (always exactly 4 flagged).

## 10. OPEN ROAD — start circle [372, 1275], course west

- **WHAT:** point-to-point checkpoint race OUT of the city (v2 — the brief's
  city-loop description is superseded by the owner's Nov 16 correction; code
  wins). Grid at the core's west edge → seam connector → MacArthur Causeway
  westbound → downtown S-leg → finish at Port Boulevard's west end [−3220, 800].
  Route ≈ 4,496 units. Starting bank 12 s; 5 checkpoints (capture radius 110)
  grant +7/+6/+6/+6/+5 s. Score: checkpoint 400, near-miss 150, held drift 100,
  finish 1000 + 25 per second left. Exactly 2 pursuit cars + the chopper, stars
  pinned at 3★. Out of time = throttle-dead roll-stop, NOT a bust; being pinned
  is a normal bust. The event runs its own light traffic on the course (both
  directions) as near-miss fodder.
- **THE CAMERA:** a painted OutRun chase cam for this event only — heading-up
  world composited in 24 strips, vertical squash 0.58, dusk sky band across the
  top ~31.5% of the screen, car anchored ~68% down, elevation swells faked by
  strip shift; steering is remapped to camera space and grip is ×1.45. A news-cam
  picture-in-picture (240×160) rides along. Tire smoke on hard steering.
- **START:** a rose convertible waits IN the circle at all times (the grid car).
  Walk in on foot: A reads START OPEN ROAD — one press seats you and starts the
  countdown. Arriving in your own car works like the other events.
- **TEST:** start on foot from the grid car; hit all 5 checkpoints (+TIME splashes);
  finish and check the score maths; run out of time once (roll-stop, no bust);
  confirm the chase cam blends in/out and free roam's top-down camera is untouched
  afterwards.

## 11. HOSPITAL HELICOPTER — pad [990, 1009]

- **WHAT:** a stealable medevac helicopter on the hospital roof (hospital building
  [864, 884], 252×250 — the old office footprint re-skinned). The roof is walkable:
  enter through the west parapet gap [850, 981, 26×56]; roof plane
  [876, 896, 228×226]. While on the roof, cop cars below cannot pin a bust.
- **START:** on the roof within 46 of the heli, press STEAL (+2★). Flight is
  skateboard-simple: velocity bends to the stick, top speed 450 u/s, no collisions
  airborne; the camera eases out to ~1.7× the walking view (a fast scout view).
  Press LAND any time: legal on road/grass/sand/plaza/parking/paving/sidewalk,
  the roof, and the pier deck — refused over water or inside a building footprint.
  A landed heli is re-boardable where it sits (FLY), and the menu marker then
  rides the parked heli. **Ram the police chopper mid-air: both crash —
  CHOPPER DOWN +1000.** A wrecked or bay-lost heli is replaced on the pad after
  60 s — but if you're standing at the hospital, the wait clamps to ~3 s.
- **TEST:** walk the roof via the gap (no teleport); steal (stars +2); land on a
  road, on the pier, and try water (refused); ram the police chopper at 3★+;
  wreck it and time the pad respawn away from the hospital (~60 s) vs standing
  on the roof (~3 s).

## 12. BOATS & JETSKI — pier moorings + the extended sea

- **WHERE:** south side of the pier (pier deck y ≈ 1020): jetski [1592, 1086],
  cigarette boat [1652, 1088]. Stand on the deck within 46 of a craft, ACTION
  mounts it. Dismount only at the pier (slow + close).
- **WHAT:** water-only physics. Jetski: top 240 (turbo ×1.4), carvy. Cigarette
  boat: top 400, turbo 560, wide turns — the straight-line speed king (a slide-
  penalty bug that left it only rotating was fixed in this build; verify it
  drives). Police boat (top 470) spawns at 2★+ on water only and busts by
  pinning; hold turbo in the boat and you walk away, cruise and it runs you down.
  Three bay buoys to thread: [1742, 862], [1696, 1212], [1748, 1562].
- **THE SEA (new in this build):** navigable water now runs to seaE = 2500 /
  seaS = 2900 (the land world's 1800×2200 + 700 each way): ~1110 units of open
  water east of the shore (≈2.7× before) and a 700-deep sea south of the island.
  Buoy lines mark both new edges in play. Land, pier and moored boats are bump
  solids.
- **INSTANT-START:** bust on the water returns your craft to its mooring
  immediately; a craft left > 260 from home, unseen (player > 500 away) for
  20 s, also returns. The craft count is always exactly 2.
- **TEST:** full-throttle straight line in the boat (must translate, must beat
  the jetski's top speed); sail east past the old shoreline to the buoy line;
  get busted mid-bay and check the craft is back at the pier when you arrive.

## 13. The western extension + causeways

- **WHAT:** real-Miami shell west of the core: x ∈ [−4400, 0], y ∈ [0, 2200] —
  MacArthur Causeway (width 48), Port Boulevard (48), Venetian Causeway (40),
  port island, Watson Island, downtown. The one drivable join from the core is
  the MacArthur landfall at (−245, 1275); everywhere else the core's west edge
  meets bay water. Shell roads drive like core roads; shell land is paving/park
  by grid. Ground paints in 256-unit chunks with an LRU cache (cap 64) — long
  causeway drives stream chunks.
- **KNOWN PLACEHOLDER:** shell land wears one orange paver treatment and the
  downtown facades are placeholder pastels; the southern shoreline is ragged.
  That is a known art-pass debt, not a defect to file.
- **TEST:** drive the full MacArthur from the landfall to the port; cross the
  Venetian; confirm cars stay on the decks (no water driving) and the ground
  keeps up at turbo speed.

## 14. HELP / JUMP menu (two-column, new in this build)

- **WHAT:** the start page and HELP panel list all 12 activities in a two-column
  grid of compact tiles (icon + name + JUMP, one-line how): MOTEL SIEGE, TAXI,
  TOW, BUS, GETAWAY, WRECK IT!, VALET, SPOTLIGHT RAVE, BOARD CHASE, OPEN ROAD,
  HELICOPTER, BOATS & JETSKI. Everything fits one 420×860 screen, no scrolling;
  PLAY stays pinned at the bottom. The REC / NEWS pills hide while the menu is
  open (they used to cover the WRECK IT! and VALET jump buttons).
- **JUMP:** teleports you to the activity, armed: job JUMPs seat you in the job
  vehicle wherever it is, event JUMPs put you in a car on the ring, the chase
  JUMP brings the board, the heli JUMP lands you beside the heli (pad or
  field-parked), boats JUMP puts you at the pier. Free — no score or wanted
  change. (JUMP still refuses if the needed vehicle is a wreck; the guardians
  in §9 are what heal that — stand at the site instead.)
- **TEST:** open HELP at 420×860 and 420×640: all 12 tiles visible, none covered;
  JUMP to every entry and confirm you land somewhere playable with the start
  armed; confirm REC/NEWS reappear on PLAY.

## 15. Recorder, Channel 7 frame, Auto-Director

- **WHAT:** the game records every run as seed + input log + weighted event
  marks. On a bust, the director replays your best ~20 s letterboxed with camera
  cuts (follow / wide / tight-lead) and 0.35× slow-mo at the heaviest moment; a
  two-angle splice opens wide (0.8×) when the peak is near, then tight (1.22×)
  slow-mo. **SAVE CLIP** (on the highlight) and the **REC** toggle (live) capture
  canvas + the game's real audio via MediaRecorder and download/share a video
  file. The **Channel 7 broadcast frame** (NEWS pill) is drawn into the canvas,
  so it is baked into recordings: default ON for highlight saves, OFF for live
  REC; the pill flips both for the session.
- **TEST:** get busted and watch the highlight; SAVE CLIP and play the file back
  (picture + game audio, synced); REC a live chase with NEWS on and off.

## 16. Beauty effects (the six winners — default look of this build)

- **WHAT:** six effects, ON from boot: `roof` (2.5D roof parallax), `sway`
  (palm crowns + their shadows sway), `causeway` (water depth: caustics +
  deck-shadow band on the NORTH edge of causeway decks), `bleed` (gouache
  edge-bleed, plaza + NOVA districts only), `puddle` (curb puddles with light
  reflections), `petals` (slipstream petals behind fast cars).
- **TEST:** the switchboard is live: `?fx=none` = the plain game,
  `?fx=-sway` = winners minus sway, `?fx=none,roof` = roof alone; or toggle
  `window.__palm.fx` (a Set) in the console — applies next frame, except
  `bleed`, which only reaches ground chunks painted after the toggle.
  Beauty check target: tools/beauty_check.mjs (40 assertions).

## 17. Voices & radio

- **WHAT:** recorded lines wired to hooks: cop barks from 1★ and on star-rises,
  a cop line on bust, pedestrian near-miss shouts (closing speed > 80 u/s),
  job/event callouts, Palm City FM idents every 35–60 s at ≤1★. iOS gets .m4a
  mirrors, everything else .ogg; DISPATCH lines also carry a radio-clean
  variant. The voice module logs every play to `window.__vox.log`.
- **TEST:** earn 1★ and listen for a bark; idle at 0–1★ for a minute for an FM
  ident; start TAXI/TOW/BUS and hear the callouts. (For the lines that are
  still silent, see Known Absences — the hooks fire, the audio doesn't exist
  yet.)

---

## KNOWN INTENTIONAL ABSENCES — do not file these as bugs

1. **Rim light** — removed on owner veto (Nov 16). There is no 'rim' switch or
   draw code anywhere in this build, by design.
2. **Ocean Drive sheen** — the pulsing golden wash on the road, removed on
   owner veto (Nov 16, "yellow lighting on the ground at night"). The polish
   check asserts its absence (`fxSheen === undefined`).
3. **38 wave-2 voice hooks have no audio yet** — Gemini TTS quota stopped the
   Nov 17 run at 41/79. The code hooks fire; the files don't exist. Missing:
   jobs (TOW_SLINGSHOT, GETAWAY_ALARM, GETAWAY_CLEAR), events (WRECK_START,
   WRECK_CHAIN_5X, WRECK_BUSTED, VALET_START, VALET_JTURN, VALET_COMPLETE),
   destruction ×4, palm snaps ×5, SWAT ×7, siege ×6, Spotlight (SPOT_BEAM,
   SPOT_TIER2, SPOT_TIER3, SPOT_WIN, SPOT_BUSTED — SPOT_START does have audio),
   and both helicopter lines (HELI_STEAL, HELI_DOWN). Full list: Hawk
   games/palm-city/assets/audio/voice/WAVE2-MANIFEST.md.
4. **Unbuilt held tasks, not regressions:** the 1997 mode toggle, Rain Mode,
   and Destruction 2 do not exist in this build. Neither do LIVE AT 7 or
   CAUSEWAY FLAIL. Their absence is the plan, not a defect.
5. **Tow-truck / bus models** — see §3: the jobs run on van fallbacks until
   the art lands.

## TEST HOOKS (debug / probe surface in this build)

- `window.__palm` = { director, recorder, input, world, ground, cam, renderer,
  newscam, fx (the live beauty Set, §16), dpr(), sim (getter), M (the asset
  manifest) } — the main probe handle: read sim state, flip effects, drive the
  director/recorder from the console.
- `window.__vox` — the voice module; `__vox.log` is the play trail
  ({ n, name, id, act }) proving a hook fired even when its audio is absent.
- `window.__prof` — per-section CPU timings; only with `?prof` (also suppresses
  the start page).
- `window.__ui` — the start/HELP UI object.
- URL parameters: `?demo` (autopilot plays the real input path: walk → jack →
  drive → chase → bust → highlight), `?demo&highlight` (jump straight to a
  demo highlight), `?t=0..1` (pin the time of day, 0 = golden hour, 1 = blue
  dusk; also disables the director and the start page), `?cam=x,y` (static
  camera), `?fx=…` (§16), `?dpr=N` (pin device pixel ratio), `?nostart`,
  `?nodirector`.
- Check suites: tools/check_all.sh runs the Node suites (28 green at stage
  time); the browser-half suites (record / polish / extension / touch shots)
  need a Chromium that launches — in sandboxed VMs they have died at launch
  (SIGTRAP) on pristine trees too, which is an environment limit, not a
  build failure.
