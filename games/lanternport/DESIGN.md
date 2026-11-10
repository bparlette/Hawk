# Lanternport: design

## The idea in one line
The freedom of an open-city crime sandbox, played in a sunlit storybook town, starring two original couriers.

## What we take from the genre, and what we do not
Game mechanics and genres are free to build on. Specific games are not. This project uses the first and
none of the second.

| Genre convention (free to use) | Our version |
|---|---|
| Open city you can cross on foot or by vehicle | A walled town of 36 blocks; roofs are part of the map |
| Take any vehicle | Borrow parked hover-carts, commandeer ones in traffic |
| Escalating police response, lost by breaking line of sight | Heat (five lanterns), the Lantern Watch, a visible "out of sight" bar |
| Pay to clear your wanted level | The tailor: 40 glim for a new coat |
| Mission markers, timers, pass/fail banners | Job beacons, "Job done" / "Job botched" |
| Several playable protagonists you can switch between | Juniper and Fen, with a camera swoop between them |
| Bright cel-shaded adventure look | Our own palette, architecture, characters and shaders |

Never used: any existing game's title, characters, names, map, missions, dialogue, logos, music, sound,
models or textures. The heroes are not elves in green tunics; the town is not a copy of any city; the HUD
uses lanterns, not stars. If a future change would make someone say "that is X from game Y", do not ship it.

Tone is all-ages mischief. Nobody dies: people fall over, see stars and get up; carts bump; the Watch
"collars" you and takes a cut. The crimes are bread, lamps and a tax wagon.

## Pillars
1. **Two ways to move, one city.** Wheels (well, runes) are fast and loud; feet go where carts cannot.
   The best escapes use both: ditch the cart in an alley and go up.
2. **Heat you can read.** You always know if the Watch can see you, and how long until they give up.
3. **Short jobs with one twist each.** A timer, a climb, a hand-off.
4. **Looks like a place.** Low sun, long shadows, lit windows, bunting, grass that moves.

## Systems and numbers (all in `sim.js`, 30 ticks per second, 100 units = 1 m)
- **Hero on foot**: `kit/sm64-controller`. Top run speed 32/tick (about 9.6 m/s). Single jump clears a
  crate (2 m); a crate plus a jump reaches the low roofs (5 m); backflip, triple jump, wall kicks and
  ledge grabs reach higher.
- **Rides**: hover-cart top speed 46/tick, sky-skiff 80, Watch wagon 70, tithe wagon 34. Acceleration is
  first-order (time constant = top speed / accel, about 1.3 s). Handbrake cuts grip from 0.72 to 0.94
  side-slip retention and multiplies turn rate by 1.6, which is the drift.
- **Heat sources**: knock someone over (+1, up to 2), commandeer an occupied cart (+1, up to 2), bump
  traffic (to 1), hit a guard or ram a wagon (+1, up to 4), job scripts (set directly).
- **Watch strength by Heat 1..5**: guards 1, 2, 2, 3, 3; wagons 0, 0, 1, 2, 3. Guards run 27/tick, slower
  than the hero, and cannot climb.
- **Being seen**: a Watch unit within 28 m with a clear line at street level. Above 3 m you are only seen
  from within 9 m. Unseen for 150 + 45 x Heat ticks (6.5 s at one lantern, 12.5 s at five) clears it.
- **Caught**: a guard touches you on foot, a wagon reaches you on foot, or you sit still in a ride next to
  a guard for 1.3 s. Cost: 20% of your glim, the job fails, you restart at the hideout.
- **Economy**: glim crystals 10 each (67 placed on roofs, in alleys and squares), dropped coins 5, jobs
  150 / 250 / 600.

## The town
Seeded generator (`buildCity`). A 6 x 6 grid of 30 m blocks with 12 m streets inside a rampart. Each block
is houses (one to four buildings, 5 to 25 m tall, 3.4 m alleys, crates beside low roofs), a green square,
or one of the set pieces: hideout square, bakery, terrace steps, counting house, tailor, docks.

## Rendering (see `fx.js`)
Scene is rendered in HDR, then one full-screen pass adds contact shading (paired depth samples), a thin
ink line on depth breaks, distance haze that thickens near the ground and warms toward the sun, two-level
bloom from the lit windows and lanterns, a filmic tone curve and a mild warm/cool grade. Materials are
cel-shaded with a soft band edge and a warm rim light; wall, stone, cobble, tile and wood textures are
drawn to canvases at start-up and tiled in world space so nothing stretches.

## Roadmap
1. **Spectate contract + capture** (`docs/SPECTATE.md`): a director camera and bot coverage of all three
   jobs, so `gamepress drive` can record the shot list in `SCRIPT.md`.
2. **More verbs**: rooftop glide, cart boost pads, a grapple for Fen; stunt jumps with slow motion.
3. **More town**: canal and bridges, a market that changes by time of day, interiors for the hideout.
4. **Characters**: modelled and rigged heroes (the rig hooks are `HeroView.snapshot/update`), voiced barks.
5. **Music**: an adaptive theme that adds a drum layer per lantern of Heat.
6. **Roblox port**: the on-foot controller already has a tested Luau port; `sim.js` is engine-free.
