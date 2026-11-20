# OPUS TASKING — Bunny Hop: bike physics core

You own ONE thing: the bike physics module for **Bunny Hop**, a third-person BMX web game (Three.js, hosted at Hawk `games/bunny-hop/`). Moth owns the game loop, camera, UI, world, and the swim state machine. Build the physics so well that the game feels right the moment it's dropped in. Test-first: write the spec tests red, then implement until green.

## Deliverable

- `src/physics/bikePhysics.js` — pure ESM, zero DOM, zero three.js imports (plain objects/arrays for vectors). All tuning numbers in one exported `CONFIG` object at the top.
- `src/physics/bikePhysics.test.mjs` — Node tests, runnable with `node --test`, all passing.
- `src/physics/NOTES.md` — the tuning table you shipped (every CONFIG value + one line on why).

Do not modify any other file. If the interface below can't express something you need, say so in NOTES.md instead of reaching into other files.

## Interface (fixed — Moth codes against this)

```js
import { createBike } from './bikePhysics.js';
const bike = createBike(CONFIG);
bike.reset({ x, z, heading });            // place on ground
const events = bike.step(dt, input, env); // returns array of event objects (may be empty)
// bike.state is readable at all times:
// { x, y, z, heading, speed, vy, pitch, lean, grounded, crouch01, bailed }
```

`input` = `{ pedal: -1..1, steer: -1..1, hopHeld: bool, hopReleased: bool, airPitch: -1..1 }`
`env` = `{ groundAt(x, z) -> { height, type }, waterLevel }` where `type` is `'ground' | 'bin' | 'deck' | 'water'`. `groundAt` is the host's surface query — it already accounts for bin tops and the bridge deck; you land on whatever it returns.
Events to emit: `{ type: 'hop', charge01 }`, `{ type: 'land', quality: 'clean' | 'wobble' | 'bail', surface }`, `{ type: 'splash', speed }`, `{ type: 'bail', reason }`.

## The feel requirements (this is the whole game)

1. **Momentum is real.** Pedalling accelerates toward a capped top speed with a curve that feels strong off the line and asymptotic at the top. Coasting bleeds speed slowly (rolling resistance + a little aero). Braking (pedal < 0 while moving forward) is firm and fast. No instant starts, no instant stops.
2. **Steering is lean.** Turn rate ∝ steer × a speed curve: nothing at standstill (you cannot pivot in place), gentle at crawl, strongest at cruise, calmer again at top speed. `lean` (visual roll, radians) follows steer × speed with spring lag — the host renders the lean from `state.lean`, so it must look right as a number: smooth in, smooth out, no jitter.
3. **The bunny hop is two-stage.** While `hopHeld`, `crouch01` charges over ~0.12–0.45 s (with a small speed scrub — crouching costs a little speed). On `hopReleased`, pop: vertical velocity from charge (monotonic: longer hold = higher hop, capped), PLUS a pitch impulse that lifts the front first — model `pitch` rising in the first 40% of the airborne phase before levelling. A tap (minimal hold) is a small hop that still clears a curb; a full charge at cruise speed must clear a trash bin (~1.1 m) with margin, and at low speed must be able to land ON a bin top.
4. **Air control.** `airPitch` torques `pitch` in the air at a rate that lets a player correct a bad takeoff but not do flips by accident. Gravity is slightly gamey (a touch stronger than 9.8) so hops feel snappy, not floaty.
5. **Landings are judged.** On touchdown, compare `pitch` against the surface slope (use two `groundAt` probes, front and rear wheel): mismatch ≤ ~18° = clean (keep speed), ≤ ~30° = wobble (speed cut, brief instability flag in state), beyond = bail (event + `bailed: true` until host resets). Landing on `'bin'` counts the same as ground. One-wheel-first landings within the clean window are fine — BMX is forgiving.
6. **Water.** If the bike's y crosses `waterLevel` while falling and `groundAt` says `'water'`, emit `splash` with entry speed and stop simulating the bike (host switches to swim). Don't implement swimming — that's the host's state machine.
7. **Edges are honest.** Riding off a bin, a curb, or the bridge deck keeps horizontal momentum into the fall. No coyote-time magic beyond ~80 ms.

## Tests (write these first; they define "done")

- Hop height is monotonic in charge time; full-charge hop apex ≥ 1.25 m from flat ground.
- Tap hop apex is between 0.15 m and 0.5 m.
- Clean-landing window: pitch mismatches of 15° land clean, 25° wobble, 40° bail (assert event qualities).
- Lean: at cruise speed with full steer, |lean| settles between 0.25 and 0.5 rad with no oscillation after 1 s.
- Standstill: full steer for 1 s changes heading by < 2°.
- Coast-down: from top speed, speed after 3 s of coast is between 55% and 80% of top speed.
- Splash: dropped from the bridge-deck height over water, exactly one `splash` event fires with the entry speed recorded.

Ship it when the tests pass and NOTES.md explains every number. Moth integrates and play-verifies; expect one tuning round-trip.
