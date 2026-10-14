# Level 7: SCRAPYARD SMASH (levels/level7.js, ~29 KB)

Files: level7.js, level7_junkyard.jpg (strip), level7_junkyard_boss.jpg (boss arena). Screenshots: shot_gameplay.png,
shot_hazard.png (grinder shower + magnet aim + tire/barrel + edge warning + belt klaxon), shot_magnet.png (player snatched),
shot_boss_warn.png (crusher warning + magnet pull), shot_boss.png (crusher slam shockwave + scrap-rain shadow).

## Structure
- Card: "SCRAPYARD SMASH" / "ONE GUY'S TRASH IS ANOTHER GUY'S WEAPON." (#ff8c1a). Original 138 BPM E-minor track; boss music = stock boss track +4 semitones @172.
- Section 0: junkyard strip, floor [160,218], length 2380, locks [0,520,1060,1620], 4 waves (3/4/4/5 enemies), embers weather.
- Section 1: boss arena (one screen, `waves: []` so the boss walks in right away).

## Hazards
- **Conveyor** (back lane y 159–175): pushes player and non-boss enemies 0.62 px/f; drawn belt with moving cleats + direction chevrons. Every ~9 s it slows, klaxon lamps/chevrons flash red for 70 f, then reverses.
- **Grinder sparks** (x 315 + 903·k, under the painted grinder): 54 f rev-up (trickle + floor glow + "!"), then a 64 f shower over the back lanes: 1 dmg to the player, knocks enemies down.
- **Crane magnet** (only during locked waves): picks the player (55%) or an enemy, flashing shadow + "!" for 64 f, drops, snatches up to 2 (player and/or enemies), lifts ~56 f, lets go: player 1 dmg knockdown, enemies 2 dmg knockdown.
- **Rolling tires / oil barrels** (during locked waves, every ~4–6 s): flashing edge arrow on the lane for 54 f, then roll across; jump them. Tire 1 dmg, barrel 2 dmg, both knock down and hit enemies too.
- **Car crusher** (boss arena, timed every 400 f once the boss is in): 62 f warning (lamps flash, "JUMP!", faint ring guides), the ram crushes the car, and a floor shockwave ellipse expands from the crusher: 2 dmg knockdown if grounded. It also hits minions and staggers the boss for 3 dmg, so luring him into it is rewarded.

## Boss: RUSTMAUL (the yard's magnet-crane operator)
ramrod atlas, rust tint, scale 1.18, 38 HP, phase 2 at 50% (faster, shorter cooldowns, calls a purple + dasher).
Patterns: charge, kick, slam, tire throw (stock), plus custom via `update`: **magnet pull** (44 f coil-glow telegraph, then drags the player in for ~86 f; a shock clap for 2 dmg if he gets reeled in; walk away to escape) and **scrap rain** (4–5 chunks fall onto flashing shadows, one on the player's position).
Lines: intro "NOTHING LEAVES MY YARD IN ONE PIECE!", hit lines, ko "RECYCLE... ME... GENTLY...".
Outro: "EVERY SCRAP TRUCK HEADS FOR THAT TOWER..." → "THE FORTRESS. LET'S END THIS!" with a magenta beacon on the skyline + "NEXT: THE FORTRESS".

## Tests
- `node --check` OK. Headless auto-play (`?level=7&debug`): loading → stage → section 2 → boss RUSTMAUL → KO → outro → pizza → results → title, no exceptions or hook errors. A DEATHS=1 run (tag-ins) also completes.
- Instrumented runs confirmed: magnet catches player and enemies, rollers spawn, grinder hits, crusher ring hits player, minions and boss, scrap rain / pull / slam / throw / kick all fire, and the phase-2 switch.

## API gaps / workarounds (no engine changes)
- A boss `update` hook runs before the engine counts down `e.cool` and picks a move in the same frame, so `e.cool === 0` never shows up in the hook. Custom moves trigger on `e.cool <= 1`.
- No custom boss state names: anything outside the engine's hittable-state list makes the boss invulnerable. The custom moves reuse the `"pull"` and `"summon"` names (tagged with `e.cm = "scrap"`) so they stay hittable; `"summon"` uses the stock "fire" pose.
- No API to hold or carry the player. The magnet sets `p.x/p.y/p.z` itself every frame, then sets `p.inv = 0` and calls `hurtPlayer(1, false, dir)` on release.
- No hook to draw over the boss sprite. The pull glow and field lines are drawn in the arena section's `drawFront`.
- Phase 2 changes `cfg.cool` and `cfg.speed` on the boss config. `spawn` resets them, and `onUnload` drops the hook references.
- Engine note (not a level bug): the API doc says strips tile without mirroring, but ss_assets/README says mirror tiling. This strip tiles cleanly either way.
