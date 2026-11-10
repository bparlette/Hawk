# BIG BUMPIN' ARENA!

2v2 bumper-car ball. Ram an oversized ball into the other team's net. Grounded arcade physics: cars shove,
bounce and spin, and never flip or leave the floor. Original game and name; no third-party marks or characters.

Built from the gamepress prompts in `docs/fable-prompts/big-bumpin-2v2.md` (Prompt 1 core slice + Prompt 2
tactics), then extended with six arenas, a fifth style pack and a Roblox port.

## Run
Serve the repo with any static server and open `games/big-bumpin-arena/index.html`. Everything is local:
Matter.js and the touch controller are vendored in `vendor/`; there is no build step and no network request.

```
node --test games/big-bumpin-arena/test/      # 33 headless tests (incl. the Luau suite under lune), about 10 s
```

| | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Drive | W/S throttle and brake/reverse, A/D steer (heading-relative) | left stick, RT/LT (or d-pad) | floating stick on the left half: drive toward where you point; a hard change of direction pulls the handbrake |
| Turbo | Shift (or K) | A | ⚡ |
| Handbrake drift | Space (or L) | B / X | automatic |
| Shunt left / right | Q / E | LB / RB | ◀ ▶ |
| Power-up | F (or J) | Y | ★ |

V (or the ◐ button) switches style pack at any time. M mutes. Player 1 is Red 1. A second gamepad joins as
Red 2; `?p2=versus` puts it on Blue 1. Every other car is a bot.

URL params: `?arena=`, `?surface=`, `?style=`, `?hazards=all|pads,pylons,tilt`, `?mode=season`, `?seed=N`,
`?auto=1` / `?spectate=1` (four bots), `?secs=N`, `?ff=N|goal|hot` (fast-forward before the first frame; used
for the screenshots in `shots/`).

## Arenas (`src/arenas.js`)
Arenas are data: an outline, goals, furniture, pits, booms and spot positions. Every outline is symmetric
under a half-turn, so neither end is better. Big arenas use a follow camera and a radar.

| Arena | Size | Shape | What is in it | Ground |
|---|---|---|---|---|
| The Rink | 1280 x 908 | rounded rectangle | nothing: the classic | asphalt |
| Lot 7 | 2100 x 1300 | chamfered rectangle | telephone poles (wires overhead), parked cars, kerb islands, bollards, a trolley bay | asphalt |
| Frostbite Pond | 2000 x 1300 | irregular pond, no straight walls | rocks, fishing huts, four fishing holes that swallow cars | ice |
| Dust Bowl | 2000 x 1240 | six-sided | hay bales, tyre stacks, a boom arm swinging about the centre | dirt |
| The Pinch | 2200 x 1240 | hourglass | shipping containers, bollards, drums; a narrow throat | asphalt |
| The Midway | 1900 x 1400 | round | a turning carousel in the middle, bollards, booths, bunting | asphalt |

Any arena can be played on any surface, and with any of the three optional hazards.

## The game
- **Weight classes**: tractor (heavy, slow, big ball punch) and kart (light, quick, easily shoved).
- **Turbo**: 2.2 s of +50% top speed; refills in 9 s, or 3 s in a teammate's slipstream.
- **Lateral shunt**: an instant sideways barge of about a car width, 0.7 s cooldown.
- **T-bone spin-out**: shunt or full-speed ram into an opponent's flank or rear quarter and they spin for 0.75 s.
- **Ball heat**: consecutive strikes on a moving ball add 12.5% speed each, up to five; at full heat a
  front-on block is flattened and thrown back. Heat fades when the ball rolls free and dies when it stops.
- **English**: dragging the bumper across the ball bends the shot.
- **One-timer**: strike within 1.5 s of a teammate's touch for +30% speed and a dead-straight shot.
- **Power-ups** (two boxes every 20 s): magnet grille, air-horn shockwave, heavy cowcatcher, oil slick,
  harpoon tether (snaps when a post gets between you and your catch).
- **Surfaces**: asphalt, ice (sliding ball, drifting cars), dirt (the ball dies fast).
- **Hazards** (optional): conveyor speed pads, pop-up bumper pylons, a final-minute floor tilt toward the goals.
- **Match**: 3:00, 3-2-1 kickoff, goal banner with the scorer's name (own goals named), face-off reset,
  golden-goal overtime, a result screen with shots, shunts, spin-outs and top speed.
- **Season**: four AI teams (Tractor Crew, Kart Kids, Chair Racers, Delivery Vans) with rising bot skill
  and different weight-class mixes.

## Style packs (`src/styles.js`)
One game, five skins, switchable while playing. A pack is data: palette, material mode (cel / gloss / flat),
outline pass, lighting rig, post FX (low-res pixel target, bloom, vignette), arena dressing and UI theme.

| Pack | Direction |
|---|---|
| CEL (default) | flat colour, ink outlines, pale floor, blue boards with yellow pennants |
| GLOSSY | dark arena, clearcoat gradients, neon lines, sweeping light beams, bloom |
| PIXEL | the world is drawn to a 400 px target and scaled up unsmoothed |
| FAIRGROUND | purple night, magenta boards with gold trim, chasing marquee bulbs |
| PRIME | the showpiece: soft shadows, raised walls, floodlight pools and edge darkening, headlight beams, team under-glow, a light on the ball, persistent skid marks, film grain |

## Files
| File | Layer |
|---|---|
| `src/config.js` | Every tuning number. |
| `src/arenas.js` | Arena data and the builder that turns it into outline, goals, furniture, spots. |
| `src/physics.js` | Factories: wall slabs from the outline, net zones, ball, car bodies. |
| `src/world.js` | Matter engine, fixed 1/60 s step, handling, turbo, shunt, spin-outs, ball heat and curve, power-ups, hazards, pits, booms, tethers. |
| `src/game.js` | Teams, score, clock, state machine, last-touch attribution. Seeded and deterministic. |
| `src/bots.js` | Chaser and sweeper roles, obstacle avoidance, shunt and power-up use, a skill dial. |
| `src/styles.js`, `src/render.js`, `src/landscape.js` | Style packs, the renderer and camera, per-arena scenery and furniture. |
| `src/audio.js` | Synth sound (engine, impacts, horn, crowd swell) and the iOS audio fixes. |
| `index.html` | Menu, loop, input merge (keyboard, gamepad, gptouch), phone gesture guard. |
| `test/*.test.mjs` | Headless tests: bot matches on every arena and surface, each rule, determinism. |
| `roblox/` | Luau port (see `roblox/README.md`). |

The sim files (`config`, `arenas`, `physics`, `world`, `game`, `bots`) import nothing from the DOM or the renderer.

## What came from which donor (dossier: gamepress `docs/fable-prompts/big-bumpin-donors.md`)
| Donor | Lifted | Where |
|---|---|---|
| ice-bumpers `js/game.js` L51-L70, L82 | Rink dimensions for The Rink, car-heavier-than-ball mass ratio, 180 s clock | `arenas.js`, `config.js` |
| ice-bumpers `mapBounds.json` | Goal mouths as recesses in the wall line (the polygons themselves were not copied) | `arenas.js`, `physics.js` |
| ice-bumpers L229-L269, L387-L394, L211-L217 | Goal choreography; the one-goal-per-ball latch; pole spots for the pylons | `game.js`, `arenas.js` |
| car-league `game/` | config / physics factories / World / Game split; named walls; goals keyed to named nets | whole `src/` |
| GameKart `main.js` L983-L1000, L923-L928, L753-L806 | Throttle gated by forward speed, grip that drops while drifting; `triggerSpinOut()` (retuned to 0.75 s); ItemBox collect/respawn flow | `world.js` |
| kfarr L146-L157, L169-L196, `rapier-vehicle` L282-L290 | Yaw-only rotation rule; steering maths; fixed-step accumulator | `physics.js`, `world.js`, `index.html` |
| Wocket-Weague `Player.ts` L102-L124 | Grip as a rate | `config.js` |
| raycast-vehicle `Vehicle.js` L906-L917, `main.js` L552-L613 | Grip fading back in after a hit; exponential camera damping | `world.js`, `render.js` |
| rocketball, carball.io | Matter ball starting numbers; last-touch attribution with the 5 s own-goal rule | `config.js`, `game.js` |

Watch-outs obeyed: no velocity pinning; no `setTimeout` in the sim; wall names live on the bodies; fixed
timestep; collision spin is kept; a dead ball is rolled back into play.

## Known limits
- Bots are simple. They score on every arena and surface in the tested seeds, but shut-outs happen on others.
- Bots steer round furniture with a look-ahead rule, not a path planner; they can still wedge briefly.
- Touch and iOS audio were checked in an emulated phone viewport, not on a device. Two-pad local play is wired but untried on hardware.
- PRIME uses canvas blur filters; on browsers without `ctx.filter` it falls back to hard shadows and no bloom.
- The Roblox port has its own small physics and is not tick-identical to this build (details in `roblox/README.md`).
