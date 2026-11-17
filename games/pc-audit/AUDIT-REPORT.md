# PALM CITY push #2 — WHOLE-GAME AUDIT REPORT

Auditor: Opus (queue task "OPUS: WHOLE-GAME AUDIT", tasking/fable.md), Nov 17, 2026.
Target: `games/pc-audit/` (the copy of the build now live). Token rules followed: no image,
audio or video file was opened; no other game folder was read. `../palm-city/shell.json` and
`shell_layout.json` were *loaded by the probe scripts* the same way the game loads them
(main.js:78-79), and never opened by hand.

## VERDICT: **FIX-FIRST** — 5 items (all small and contained; list at the bottom)

The new lanes are mostly sound. The boat really drives, the sea, the heli, the guardians, Open
Road and the recorder all work in play. The full suite is 28/28 green once it can find its files
(see C1). But two player-facing bugs can **strand a player or quietly break the world over a long
session**, and three smaller ones sit on the same paths. Every finding below was reproduced
headless, on the real `Sim`, through the real input/JUMP path. `sh tools/audit/run_all.sh`
reproduces all of them: each `BUG` line is one finding, and the script exits 1 until they are fixed.

---

## HIGH

### H1. JUMP from a boat or jetski is broken: the player snaps back, or the craft is lost for the session
- **Where:** `src/activities.js:103` — `leave()` releases only a car (`if (P.mode === 'car')`).
  `src/help.js:16` `canJump` allows `mode === 'water'`, and `jump()` (activities.js:100) does not
  refuse it.
- **What happens (probe `p1_jump.mjs`, mounted jetski, then JUMP):**
  - MOTEL / HELICOPTER / BOATS: `jump()` returns true and the panel closes, but `P.mode` stays
    `'water'`. The next `stepCraft` puts the ped back on the craft. To the player, JUMP silently
    does nothing.
  - TAXI / any job, WRECK IT! / any event, BOARD CHASE: the player does leave. The craft keeps
    `ridden = true` and `sim.water.ride` stays set. A ridden craft can never be mounted again
    (`nearCraft` needs `!cr.ridden`, watercraft.js:71), and the stranding guardian skips it
    (`if (cr.ridden) continue`, watercraft.js:337). Probe: 40 s later the jetski is still
    `ridden=true`, drifting in the bay. One of the two craft is gone until reload.
- **Fix:** in `jump()`'s `leave()`, handle `P.mode === 'water'` the way `respawn()` already does
  (sim.js:793-800): clear `ridden`, null `water.ride` and `water.cop`, send the craft to `cr.home`,
  and set mode to `'foot'`.

### H2. The OPEN ROAD grid car breeds duplicates, and nothing ever removes them
- **Where:** `src/openroad.js:100-112` `ensureGridCar`. If the waiting car is more than 30 units
  from the circle, it is "released" and a **new** car is spawned with `fixed: true`. The released
  car keeps its own `fixed: true`, so the population filter (`(c.parked && c.fixed !== false)`,
  sim.js ~250) keeps it forever.
- **Why it fires on its own:** the circle `[372,1275]` sits on the loop's west road (loop
  `x0 = 360`). Loop traffic shoves the parked convertible out of its 30-unit tolerance.
- **Probe (`p3_idle.mjs`, no input at all, player standing near the circle):** 1 race car for the
  first 4 min, 2 at minute 5. `p2_grid.mjs`: six 35-unit nudges leave **7** permanent race cars
  around the circle. The growth is unbounded over a long session. It breaks the owner's
  instant-start rule ("no duplicates, ever", FEATURE-MAP §9) and clogs the loop lane.
- **Fix:** restore the singleton the way `guardRingCars` does (move it home, repair it, never
  spawn), or at least set `old.fixed = false` when releasing it. Also consider moving the circle
  off the loop's lane.

## MEDIUM

### M1. Each OPEN ROAD run leaves its shell traffic parked on the causeway forever
- **Where:** `src/events.js` `endEvent`, the openroad branch. Route cars are set to
  `driver = null; parked = true` but `fixed` is left alone. The population filter then keeps them
  for good (same rule as H2).
- **Probe (`p2_grid.mjs`):** one autopilot run (FINISHED, 3550 pts) leaves **6** cars that are
  never culled. Each further run adds more.
- **Fix:** add `c.fixed = false` there, or remove the route cars outright.

### M2. JUMP → OPEN ROAD seats the wrong car and stacks a second race car on the player
- **Where:** `src/activities.js:138-143`, the generic event branch: "borrow the nearest free car,
  put it on the ring".
- **Probe (`p6_startjump.mjs`):**
  - From the **start page**, the JUMP arrives on the first sim step, before `stepEvents` has ever
    called `ensureGridCar`. The player is seated in a parked civilian `sedan_cream`. One step later
    the rose race car spawns on top of it (gap 0).
  - **Mid-session** the grid car is the one seated. The next tick, `ensureGridCar` sees it is now
    the player's car and spawns another rose in the same spot.
  - Either way, the player starts the race overlapping a duplicate car, and the duplicate stays.
- **Fix:** give OPEN ROAD its own JUMP branch: on foot in the circle beside the grid car (A reads
  START OPEN ROAD, the designed start). Or seat `ensureGridCar(sim)` and have `ensureGridCar` skip
  respawning while `P.car === sim.openroadCar`.

### M3. BOATS JUMP strands the player in open water when the jetski isn't at its mooring
- **Where:** `src/activities.js:117-121` places the player at `x = craft[0].x`, wherever the
  jetski currently is.
- **Probe (`p1_jump.mjs`):** with the jetski at [2200,2300], JUMP puts the player at [2200,1044],
  which is open water, off the pier (`canStand` false). The stick moves them **0** units. Hard
  stranded; the only way out is another JUMP.
- **Fix:** use `cr.home.x` (the mooring), clamped to the pier deck. Or send an unridden craft home
  first, then place the player.

### M4. If shell.json fails to load, the whole extension silently disappears
- **Where:** `src/main.js:75-83` catches a failed fetch and sets `shell = null`.
- **Effect:** no west extension at all. The OPEN ROAD course then runs over undrivable water and
  cannot be finished. There is no error banner, which breaks the build's own "no fallback path,
  show it red" rule (assets.js throws for the same situation).
- **Fix:** throw the same way assets.js does.

## LOW

- **L1.** The helicopter can't leave the core rect. `src/heli.js:174-176` clamps it to
  `L.world` (0..1800 × 0..2200). Probe: it stops at x=30 heading west and x=1770 heading east, so
  it reaches neither the western extension nor the extended sea. The HELP text says "fly anywhere"
  (activities.js:61). Either clamp to `world.bounds` / `seaE` / `seaS`, or reword the text.
- **L2.** While flying, HELP shows every JUMP tile as live. Tapping one closes the panel and does
  nothing, because `jump()` refuses `'air'`. Fix: add `'air'` to `canJump` (help.js:16).
- **L3.** The job and ring guardians restore a car onto its home without checking whether the spot
  is occupied (jobs.js:54-56, events.js `guardRingCars`). `carCollisions` shoves the cars apart, so
  this is cosmetic.
- **L4.** HELP at a 640-unit view height with a notch inset above ~16 units pushes the BACK button
  past the bottom edge (help.js:21-37: panel bottom = 624 + safeTop). 640-unit views only occur on
  wide or short screens.

## CHECK-SUITE HONESTY

- **C1. The audit copy's own suite cannot run as packaged.** pc-audit loads its art, voices and
  shell from `../palm-city/`, but the tools serve `pc-audit/` as root and read `ROOT/shell.json`.
  Run in place, 9 of 28 checks fail:
  - five browser checks (record, polish, touch, …) time out with `waitForFunction`, because the
    page never boots;
  - four (extension, openroad, beauty, …) fail with `ENOENT pc-audit/shell.json`.

  These are path failures, not the "SIGTRAP at launch" environment limit FEATURE-MAP describes, so
  that note can hide them. With `palm-city` and the two shell files linked into a scratch mirror,
  **all 28 pass** (EXIT 0). So "28 green" is true of the build; it is just not reproducible from
  this folder as shipped.
- **C2.** `help_check` only JUMPs from foot, never from a boat, the heli or the board. That is how
  H1 shipped green.
- **C3.** `instant_start_check` only "settles" the OPEN ROAD grid car. It never bumps it, never lets
  traffic run, and never counts race cars afterwards. That is how H2 shipped green.
- **C4.** `openroad_check` never counts the cars left after a run. That is how M1 shipped green.
- **Suggestion:** fold `tools/audit/run_all.sh` into `check_all.sh` once the fixes land, so these
  stay covered.

## VERIFIED OK IN PLAY (probes, real sim)

- **Watercraft:** the cigarette boat translates (615 units in 6 s, vmax 369, ahead of the jetski's
  309), and both craft reach the extended sea's SE corner. The "only rotated" fix holds.
- **Helicopter:** steal from the JUMP spot, refused water landing, pier landing, and a waterline
  landing all leave the player standable.
- **Hover cache:** hovering at heli zoom 0.59 for 45 s caused no ground-cache thrash. The cache
  settles at 63 of 64 chunks with 0 evictions (`heli_cache_probe.mjs`, 420×1000).
- **Every job and event vehicle drives:** taxi, van_sun tow, van_sky bus, getaway, and the
  wreck/valet/spot ring cars.
- **Ring guardian:** restores a wrecked ring car with no duplicate.
- **OPEN ROAD:** starts from JUMP + A. The autopilot finishes the full 4511-unit course (3550 pts,
  no bust), and grip resets to 1 afterwards.
- **JUMP from foot:** all 12 entries land the player somewhere playable.

## HOW THE AUDIT WAS RUN (recreate from paper)

1. **Read FEATURE-MAP.md**, then the new-lane source: watercraft.js, heli.js, openroad.js,
   chasecam.js, activities.js, help.js, events.js (start/end/guardians), jobs.js (guardian), the
   main.js camera/stick/shell wiring, and the ground.js LRU.
2. **Probes** live in `tools/audit/`. From `games/pc-audit/`, run `sh tools/audit/run_all.sh`, or
   one at a time with `node tools/audit/<probe>.mjs`:
   - `p1_jump`: JUMP from foot / jetski / with the jetski out;
   - `p2_grid`: grid-car nudge, a full Open Road autopilot run plus leftovers, the ring guardian;
   - `p3_idle`: 6 min of idle traffic at the circle;
   - `p4_craft_heli`: boats, sea, heli range and landings;
   - `p5_drive`: every job and event vehicle drives;
   - `p6_startjump`: start-page and mid-session JUMP OPEN ROAD.

   `common.mjs` builds the world exactly as main.js does (layout + `../palm-city/shell.json` +
   `shell_layout.json`).
3. **Full suite in a mirror:** copy `games/pc-audit` to a scratch directory. Inside the copy,
   `ln -s <Hawk>/games/palm-city palm-city`, plus symlinks for `shell.json` and
   `shell_layout.json`. Then run `CHROME=<chromium> sh tools/check_all.sh` → 28/28, EXIT 0.
   `tools/audit/heli_cache_probe.mjs` needs the same mirror.

## FIX-FIRST LIST

1. **H1** — release the craft in `jump()`'s `leave()`.
2. **H2** — make the grid car a restored singleton (no spawn), and release it with
   `fixed = false`.
3. **M1** — `fixed = false` on route cars at the end of OPEN ROAD.
4. **M2** — give OPEN ROAD its own JUMP branch.
5. **M3** — BOATS JUMP places the player at the mooring.

M4 and L1–L4 are recommended follow-ups and do not block the ship.
