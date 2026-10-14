# Shell Shock Live — background art for Levels 3–8

All art is original (no logos/trademarks), illustrated comic-painterly side view, made to drop in the same way as
`hallway.jpg` (strips) and `room.jpg` (single-screen boss rooms). Height is 512 px on every file, same as hallway/room.

**Scale reminder:** the game draws a strip scaled to canvas height H=224, so 1 world px = 512/224 ≈ 2.286 image px.
Current walk band `FLOOR_TOP=150 … FLOOR_BOT=215` = image **y 343 … 491**. Every strip below has its floor/walkway
starting around y 330–400, i.e. roughly the same place as hallway.jpg (its floor starts ≈ y 385).
Strips were checked with the game's mirror tiling (every other tile flipped): no visible seams.

| File | Size | Walkable floor band (image y) | ≈ world y | Notes |
|---|---|---|---|---|
| level3_sewer.jpg | 2064x512 | glowing green water channel 345–398, dry stone walkway 400–512 | 151–174 water, 175–224 walkway | Back lane is literally in the water: either use FLOOR_TOP≈175 for this level, or keep 150 and treat y<174 as a wading lane (slow + splash fx). |
| level3_sewer_boss.jpg | 1032x512 | water 340–395, stone floor 400–512 | as above | Giant grated outflow pipe gushing green water, centre back. |
| level4_highway.jpg | 2064x512 | asphalt road 345–512 (lane dashes ≈ 375) | 151–224 | Guardrail + skyline at sunset. Evenly repeating — good for auto-scroll (just advance camX every frame). No separate boss arena: fight the boss on the same loop. |
| level5_docks.jpg | 2064x512 | wooden plank dock 356–512 | 156–224 | Warehouse roll-up doors, crates, containers, cranes, harbor + skyline. Moon painted out so mirroring doesn't make two moons. |
| level5_docks_boss.jpg | 1032x512 | steel ship deck 365–512 | 160–224 | Cargo-ship deck, 3 roll-up hatches, lamps. |
| level6_snow.jpg | **1720x512** | snowbank/curb 315–335, street 335–465, sidewalk 465–512 | 147–224 | Cropped narrower than the others so the parked cars at the edges aren't sliced by the mirror seam. |
| level6_snow_boss.jpg | 1032x512 | snowy plaza edge 330–345, frozen ice rink 345–480 | 151–210 | Frozen fountain centre back, string lights. |
| level7_junkyard.jpg | 2064x512 | conveyor belt runs along the back at 328–368; oily ground 370–512 (loose scrap along the very bottom edge 480–512) | 162–224 | Back lane overlaps the conveyor; good place for a conveyor hazard. |
| level7_junkyard_boss.jpg | 1032x512 | steel-plate floor 363–512 | 159–224 | Car crusher centre back, crane electromagnet overhead. |
| level8_fortress.jpg | 2064x512 | metal grated floor 389–455; below 455 is the catwalk edge/underfloor cables | 170–199 (floor), 199–224 underfloor | Front lane reads as the catwalk lip; consider FLOOR_BOT≈205 here, or ignore (it's just background). Console screens contain tiny glyph-like marks, not readable text. |
| level8_final_boss.jpg | 1032x512 | polished metal floor 347–512 (throne dais base ≈ 388) | 152–224 | Throne in front of a magenta reactor core, city skyline through side windows. Final boss arena. |

`src/` holds the raw generations (PNG) these were cropped from, in case a re-crop is needed.

## Hazard / enemy ideas that fit the art
- **L3 Sewer:** water lane slows players & enemies (splash fx); sludge geysers erupt from the round floor grates; enemies drop in from wall pipes; ratty mutant minions; boss: a hulking sewer-gator brute who surfs out of the outflow pipe and sends green-water waves across the floor.
- **L4 Highway (skateboard, auto-scroll):** oncoming cars/trucks in lanes with a warning flash, potholes and oil slicks, enemy bikers/hover-drones that swoop in; boss on an armoured semi-truck or a jetpack goon pacing the scroll.
- **L5 Docks:** swinging crane hooks, crates dropping from above (shadow telegraph), roll-up doors that open to spawn enemies (like the hallway doors), forklifts; boss on the ship deck: a harpoon/anchor-chain wielding pirate-type heavy with hatch-spawned adds.
- **L6 Snow:** icy patches = slide, snowballs/ice chunks thrown, snowplow charging across the street, falling icicles from awnings; boss arena ice rink: everyone slides, boss is a freezing-gas-gun villain or a figure-skater blade enemy.
- **L7 Junkyard:** conveyor belt pushes characters sideways, sparks/grinder burns, crane magnet that snatches metal-wearing enemies/players, rolling tires and oil barrels; boss: a scrap-golem or magnet-crane operator, car crusher slams as a timed arena hazard.
- **L8 Fortress:** laser grids across lanes, steam vents (the art has vents), sliding blast doors spawn robot troopers, electrified floor panels; final boss: the mastermind on the throne, reactor core pulses = shockwave rings, side windows for drop-in henchmen.
