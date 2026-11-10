# Lanternport

**Two couriers. One very borrowable city.** An original open-city sandbox: run the rooftops, borrow
hover-carts, pull jobs, and shake the Lantern Watch, in a cel-shaded storybook town.

The pitch is a genre mash-up (an open-city crime sandbox played in a bright, toon fantasy style) built
as an **original game**. No characters, names, maps, art, music or text from any existing game are used;
see `DESIGN.md` for the line we hold and why.

Play: serve the repo root and open `games/lanternport/index.html`.

```
python3 -m http.server 8791        # from the repo root
# http://localhost:8791/games/lanternport/index.html
```

## Controls
| | On foot | Driving |
|---|---|---|
| WASD / arrows / left stick | move (camera-relative) | throttle, brake/reverse, steer |
| Space / A | jump (hold = higher; again on landing = double, triple) | handbrake (drift) |
| F / Enter / Y | get in the nearest ride | hop out (when slow) |
| Tab / T / RB | switch hero (only with no Heat and no job running) | same |
| Shift / Z | crouch (then Space = backflip; while running = long jump) | |
| J / X / B | dive-tackle | |
| Q, E or mouse drag | orbit camera | |
| R, H | restart, hide help | |

Touch: on-screen stick plus JUMP, DUCK, DIVE, RIDE and SWAP buttons.

URL params: `?pr=N` (render scale cap, default 1.5; use 1 on slow GPUs), `?auto=1` or `?spectate=1` (bot plays: finishes the first job, then cruises), `?seed=N`
(city layout), `?clean=1` (no title or help).

## What is in the slice
- **City**: a 6 x 6 block walled town generated from a seed: 72 buildings, alleys, crates, three green
  squares, a rooftop terrace block, traffic and pedestrians.
- **Two heroes**: Juniper (rooftop courier) and Fen (skiff pilot). Swap between them at any quiet moment;
  the camera lifts over the town and drops onto the other twin.
- **On foot**: the verified platformer controller from `kit/sm64-controller/` (triple jump, wall kick,
  ledge grab, long jump, dive). Roofs are playable space, and they are how you hide.
- **Rides**: hover-carts (slow, everywhere), sky-skiffs (fast, two parked), Watch wagons (not yours).
  Arcade handling with handbrake drift. Take a parked one, or commandeer one in traffic.
- **Heat**: five lanterns. Knocking people over, taking an occupied cart, and ramming the Watch raise
  it. Guards chase on foot; wagons join at three lanterns. Break line of sight (corners, alleys,
  rooftops) until the green bar fills and the Heat is gone. Or pay the tailor 40 glim for a new coat.
  Get caught and you lose a fifth of your glim and wake up at the hideout.
- **Three jobs**: Hot Bread Run (timed delivery), Lamplighters (rooftop collect, then escape),
  Tithe Day (ram a wagon, grab the strongbox, hand it to the other twin, escape as them).

## Files
| File | What |
|---|---|
| `sim.js` | The whole game as a deterministic 30 Hz simulation. No rendering, no DOM. |
| `view.js` | Everything visible: the town (timber-framed houses, mansard roofs, shuttered windows, shopfronts, bunting, lamps, lawns of swaying grass, trees, ramparts), heroes, rides, townsfolk. |
| `fx.js` | The look: procedural textures, cel shader with rim light, sky with clouds and mountain ridges, and the HDR post pipeline (contact shading, ink edges, haze, bloom, filmic grade). No art files anywhere. |
| `index.html` | Loop, camera, input, HUD, radar, synth sound. |
| `bot.js` | Scripted player used by the test and by attract mode. |
| `DESIGN.md` | Design document: pillars, systems, numbers, originality rules, roadmap. |
| `SCRIPT.md` | Story, job scripts, bark lines, and the shot list for short videos. |
| `../../test/lanternport.test.mjs` | 10 headless tests (run with `node --test test/lanternport.test.mjs`). |

## Known limits (honest list)
- Flat ground only: no slopes, bridges, water or interiors.
- Guards cannot climb. That is the rooftop-hiding rule, not an oversight, but it means a roof is always safe.
- Traffic and chasers steer by street grid, not a real pathfinder; they can jam at junctions.
- Visuals are all procedural geometry and shaders. Stylised, well lit and atmospheric, but not hand-modelled art: characters are primitives with no skinned animation, and there are no interiors, water or weather.
- The mansard roofs are drawn slightly inside the flat collision top, so a hero at a roof edge stands a little proud of the slope.
- Sound is a small synth (beeps and an engine hum). No music yet.
- Jobs 2 and 3 are covered by rule tests that place the hero, not by a bot that plays them end to end.
- Not yet run through `gamepress grade` or the spectate-camera contract in `docs/SPECTATE.md`
  (`?spectate=1` only switches on the bot).
- Imports `../../kit/` directly; publishing needs the usual kit-bundle step.
