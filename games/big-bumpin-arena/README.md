# BIG BUMPIN' ARENA!

2v2 bumper-car ball in one enclosed rink. Ram an oversized ball into the other team's net. Grounded arcade
physics: cars shove, bounce and spin, and never flip or leave the floor. Original game, original name, no
third-party branding.

Status: **Prompt 1 core slice** (`gamepress docs/fable-prompts/big-bumpin-2v2.md`). Placeholder flat colours;
no art pass yet. Not committed: left in the working tree for verification.

## Run
Serve the repo (any static server) and open `games/big-bumpin-arena/index.html`. Everything is local:
Matter.js and the touch controller are vendored in `vendor/`, there is no build step and no network request.

```
node --test games/big-bumpin-arena/test/      # headless bot match + rules (7 tests)
```

| | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Drive | W/S or up/down = throttle, brake/reverse; A/D or left/right = steer (heading-relative) | left stick steer, RT/LT throttle (or stick up/down, d-pad) | floating stick on the left half: the car drives toward where you point |
| Turbo | Shift (or K) | A (or RB) | A button |
| Handbrake drift | Space (or L) | B / X (or LB) | B button |

M mutes. Player 1 is Red 1 (the kart). A second gamepad that presses any button joins as Red 2 (the
tractor); `?p2=versus` puts it on Blue 1 instead. Every other car is a bot.

URL params: `?seed=N` (bots and kickoff aims), `?auto=1` or `?spectate=1` (four bots, no title),
`?autostart=1`, `?secs=N` (match length), `?ff=N` / `?ff=goal` (fast-forward the sim before the first frame;
used for the screenshots in `shots/`).

## The game
- **Rink**: 1280 x 908 world, rounded corners, thick boards, a recessed net behind each goal line with
  round posts. A car-only lip on each goal line keeps cars out of the nets; the ball passes through it.
- **Weight classes** (`CFG.classes`): tractor (mass 12, slow, big ball punch) and kart (mass 4, quick,
  easily shoved). Each team fields one of each.
- **Turbo**: 2.2 s of +50% top speed on a meter that takes 9 s to refill, or 3 s tucked in a teammate's
  slipstream (chevrons on the car, the meter outline pulses).
- **Match**: 3:00 clock, 3-2-1 kickoff, goal = flash + horn + cars frozen + clock paused for 2 s, face-off
  reset, 1 s beat, play. Level at 0:00 = golden-goal overtime. Goals name the scorer; own goals are named.
- **Bots**: the kart chases (gets behind the ball, drives it at goal), the tractor sweeps (sits between
  ball and own net, steps up to clear).

## Files
| File | Layer |
|---|---|
| `src/config.js` | Every tuning number. |
| `src/physics.js` | Factories: named arena walls, net zones, ball, car bodies. |
| `src/world.js` | Matter engine, fixed 1/60 s step, car handling, turbo and slipstream, collision events. |
| `src/game.js` | Teams, score, clock, state machine, last-touch attribution. Seeded and deterministic. |
| `src/bots.js` | Chaser and sweeper. |
| `src/render.js` | Canvas drawing and HUD. Reads the game only; `PALETTE` at the top is the restyle point. |
| `src/audio.js` | Synth sound and the iOS audio fixes. |
| `index.html` | Loop, input merge (keyboard, gamepad, gptouch), phone gesture guard. |
| `test/bot-match.test.mjs` | The headless tests. |

The sim files (`config`, `physics`, `world`, `game`, `bots`) import nothing from the DOM or the renderer.

## What came from which donor (dossier: `gamepress docs/fable-prompts/big-bumpin-donors.md`)
| Donor | Lifted | Where |
|---|---|---|
| ice-bumpers `js/game.js` L51-L70, L82 | World size 1280 x 908, goal lines at x = 110 / 1170, ~207 px goal mouth, car-heavier-than-ball mass ratio, 180 s clock | `config.js` |
| ice-bumpers `mapBounds.json` | The idea that goal mouths are recesses in the wall line. The 40 polygons themselves were not copied: the brief asks for rounded corners, and that file's corners are stepped blocks | `physics.js` |
| ice-bumpers L229-L269, L387-L394 | Goal choreography (freeze cars, pause clock, 2 s, reset to face-off spots, 1 s, re-enable) and the one-goal-per-ball latch | `game.js` |
| car-league `game/` layout | config / physics factories / World / Game split, sim separate from rendering | whole `src/` |
| car-league `config/arena.ts` L27-L153, `World.ts` L132-L146, `Game.ts` L122-L133 | `createArenaWallConfigs()` with named walls and net boxes; goals keyed to named nets | `physics.js`, `world.js` |
| GameKart `main.js` L983-L1000 | Throttle gated by measured forward speed; sideways speed bled off by a grip factor that drops while drifting | `world.js _drive` |
| kfarr `rapier-arcade-body` L169-L196 | Steering maths: yaw rate scales with speed, sign flips in reverse | `world.js _drive` |
| kfarr L146-L157 (the rule) | Rotation exists on the yaw axis only: one 2D rigid body per car, so no flip is possible | `physics.js createCar` |
| kfarr `rapier-vehicle` L282-L290 | Fixed-step accumulator with clamped delta and capped catch-up | `index.html` |
| Wocket-Weague `Player.ts` L102-L124 | Grip expressed as a rate (strong normally, weak while drifting) rather than a per-frame kill | `config.js car.gripRate / driftRate` |
| raycast-vehicle `Vehicle.js` L906-L917 | Grip fades back in over 0.35 s after a big load, so a hit actually moves the car | `world.js` (`slip`) |
| rocketball L190-L208, carball.io `SoccerBall.js` | Matter ball starting numbers (frictionAir ~0.01, lively restitution, hard speed cap) | `config.js ball` |
| carball.io `Game.js` L262-L292 | Last-touch attribution with the 5 s own-goal rule | `game.js _goal` |

Watch-outs obeyed: no velocity pinning (forward speed is only added to, sideways speed only decays); no
`setTimeout` in the sim (tick countdowns); wall names live on the bodies, not in an index-zipped map; no
variable timestep; spin from collisions is kept; a dead ball pinned on the boards is rolled back into play.

Built new (no donor has it): the bots, the turbo meter and slipstream, weight classes, the car-only goal
lip, golden-goal overtime.

## Known limits
- Bots are simple. Across seeds 1-12, both teams scored in 10 of 12 full bot matches (seeds 4 and 9 were
  shut-outs). The required test uses seed 1.
- Local 2-player on a second gamepad is wired but has not been tried with two physical pads.
- Touch was checked in a phone-sized emulated viewport, not on a real phone; the iOS audio path is untested
  on a device.
- No art pass, by instruction.
