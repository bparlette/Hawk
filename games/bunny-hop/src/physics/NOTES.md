# Bunny Hop — bike physics: shipped tuning & integration notes

`bikePhysics.js` is pure ESM (no DOM, no three.js). `node --test games/bunny-hop/src/physics/` → 17/17 passing
(the 7 brief tests plus 10 more for steering, braking, the bin clear/land-on, edges and coyote time, walls, reset, and frame-rate independence).

## Conventions (read these first)

| Thing | Convention |
|---|---|
| Forward | `(sin heading, cos heading)` in x/z, same as v1. `steer +1` turns heading negative (to the right), same as v1. |
| `speed` | Signed speed along heading (m/s). Negative means rolling backwards. In the air it is the horizontal speed, which stays constant. |
| `pitch` | Radians, **positive = nose up**. ⚠ v1 used negative for nose up. Render as `rotation.x = -pitch` (or whatever matches your rig). |
| `airPitch` | `+1` pulls the nose up. v1 mapped W to nose down, so map W → `airPitch: -1` and S → `+1` to keep the old feel. |
| `lean` | Radians, same sign as `steer`. Feed it straight to the roll axis. It is a critically-damped spring (exact solution), so it never overshoots or jitters at any frame rate. |
| Integration | `step()` clamps `dt` to 0.1 s and substeps at ≤ 1/120 s. `hopReleased` is applied once per frame, on the first substep. |

## Interface notes / gaps (Moth, please read)

1. **`groundAt` must return `{ height, type }`.** The current `buildWorld.groundAt` returns a bare number. The module tolerates that, but treats every surface as `'ground'`, so **water never fires**. Wrap it in the host: return `type: 'water'` where `water.contains(x,z)` (height = canal bed), `'bin'` on bin tops, `'deck'` on the bridge and ramps.
2. **No `colliders` in the env.** Buildings, posts and walls must appear in `groundAt` as tall heights (e.g. roof height). Anything more than `stepUp` (0.15 m) above the rider is a wall: below `wallBailSpeed` the bike stops, above it the bike bails (`reason: 'crash'`). If you would rather keep separate colliders, resolve them in the host after `step()`.
3. **`reset(pose, env?)`** takes an optional second argument. Without it, the bike uses the env from the last `step()`. If there is none yet, it snaps to the ground on the next step. `reset` clears `bailed`, `splashed`, wobble, crouch, speed and lean.
4. **After `splash` or `bail`, `step()` is a no-op that returns `[]`** until `reset()`. Swimming, climb-out and remount are the host's job. To remount on the bank after swimming, call `reset({ x, z, heading }, env)`.
5. **Riding (not falling) into water also splashes**, e.g. rolling down the shallows past the waterline. The brief only mentions falling, but otherwise the bike would ride along the canal bed.
6. **Extra read-only state:** `wobbling` (true for 0.5 s after a wobble landing; steering and lean are at 50%; good for a shake effect), `splashed`, `surface` (type under the wheels), `airTime`.
7. **The landing slope uses three probes per wheel side.** A wheel probe counts only if the halfway probe lies on the straight line from the contact point. Otherwise it is a ledge (bin edge, curb, deck lip) and reads as overhang (flat), not as a 46° "slope". This keeps one-wheel-on-the-bin-edge landings fair.
8. Events are objects (`{ type: … }`). v1 used strings, so update the host's `events.includes('splash')`-style checks.

## Tuning table (every `CONFIG` value)

### World / integration
| Key | Value | Why |
|---|---|---|
| `gravity` | 13.0 m/s² | ~1.33 g: a full hop is ~0.94 s in the air. Snappy, not floaty. |
| `maxSubstep` | 1/120 s | Collision and landing timing stay consistent from 30 to 144 fps (a test checks the hop apex agrees within 3 cm). |
| `maxFrameDt` | 0.1 s | Stops a tab-switch hitch from teleporting the bike through a bin. |

### Momentum
| Key | Value | Why |
|---|---|---|
| `topSpeed` | 12 m/s | ~43 km/h, a fast BMX sprint. Reached asymptotically, never exceeded by pedalling. |
| `cruiseSpeed` | 7 m/s | Reference speed: steer peak and full lean sit here. Tests use it as "cruise". |
| `pedalAccel` | 7 m/s² | Accel = `pedalAccel·(pedal − v/top)`. Strong off the line (~0.7 g), fading to 0 at top. Reaches ~5 m/s in 1 s. Analog `pedal` gives a proportional cruise speed. Drag is folded into this curve while pedalling. |
| `rollingResistance` | 0.35 m/s² | Constant part of coast-down: a 1 m/s roll takes ~3 s to stop, so crawling feels like rolling, not sticking. |
| `aeroDrag` | 0.008 /m | `k·v²` part: at top speed this adds 1.15 m/s². 3 s of coasting from 12 m/s leaves ~71% (spec 55–80%). |
| `brakeDecel` | 9 m/s² | Firm: 12 m/s → 0 in ~1.3 s. No instant stop. |
| `reverseAccel` | 2 m/s² | Back-pedal from standstill to roll backwards, so you can shuffle off a wall. |
| `reverseMaxSpeed` | 1.5 m/s | Backwards is for repositioning only. |
| `slopeGravityScale` | 0.6 | Bridge ramps (~10.6°) cost or give ~1.4 m/s², which you can feel without stalling the climb. |
| `crouchScrub` | 0.8 m/s² | Charging costs a little speed (~0.36 m/s max). It stops once fully charged, so holding a charge isn't punished forever. |

### Steering & lean
| Key | Value | Why |
|---|---|---|
| `maxTurnRate` | 1.7 rad/s | Peak yaw at full steer. About a 3.5 m radius at peak speed: tight like BMX but controllable. |
| `steerPeakSpeed` | 6 m/s | Authority curve `x·e^(1−x)` with x = v/6: 0 at rest (no pivoting), 0.38 at 1 m/s (gentle), 1.0 at 6, 0.97 at cruise, 0.74 at top (calmer). |
| `leanMax` | 0.42 rad | ~24° full-steer lean: reads clearly on screen, inside the spec's 0.25–0.5 band. |
| `leanFullSpeed` | 6 m/s | Lean ramps in by smoothstep with speed, so there is none at rest and it builds through the crawl. |
| `leanStiffness` | 9 rad/s | Critically damped: about 0.5 s to 99%, no overshoot. Feels weighted but responsive. |
| `airLeanReturn` | true | In the air, lean springs back to 0 (steer has no effect mid-air). |

### Hop
| Key | Value | Why |
|---|---|---|
| `hopTapTime` | 0.12 s | Holds up to this are taps (charge 0). Gives a deliberate gap between a tap and a charged hop. |
| `hopFullTime` | 0.45 s | Full charge. `charge01 = (hold − 0.12)/0.33`. `crouch01 = hold/0.45` is the visual squat, rising from the first frame. |
| `hopTapHeight` | 0.30 m | Tap apex: clears a 0.12 m curb with a lot of room, but is clearly a small hop. |
| `hopFullHeight` | 1.45 m | Full apex. Apex is linear in charge, so the rule is simple. Clears a 1.06 m bin with 0.39 m margin. At cruise, the time above bin height (0.48 s) covers 3.4 m, vs the bin's 1.04 m. At ~2 m/s, the same hop lands on top of the bin. |
| `popPitch` | 0.36 rad | ~21° nose lift at full charge (scaled 45–100% by charge). Reads as "front wheel first". |
| `popPitchRise` | 0.4 | The nose rises over the first 40% of the predicted airtime (spec)… |
| `popPitchSettle` | 0.9 | …and eases back to level by 90%, so an untouched hop lands clean on flat. On a bin top (~76% of airtime) ~4° of lift is left: still clean. The pop is applied as a delta, so air control and takeoff slope stack on top of it. |
| `coyoteTime` | 0.08 s | A hop still pops for 80 ms after rolling off an edge (spec limit). |

### Air control
| Key | Value | Why |
|---|---|---|
| `airPitchAccel` | 10 rad/s² | A 25° bad takeoff is fixed in ~0.35 s of stick. |
| `airPitchMaxRate` | 2.4 rad/s | Even with full stick for a whole max-height hop (~0.95 s) you reach ~80°, far from a flip. |
| `airPitchDamping` | 6 /s | Rotation bleeds out quickly when the stick is released, so you don't keep spinning. |
| `airPitchLimit` | 1.3 rad | Hard clamp (~75°). Anything near it is a guaranteed bail anyway. |

### Ground contact
| Key | Value | Why |
|---|---|---|
| `wheelbase` | 1.0 m | Front/rear probe spacing for slope, roughly a BMX wheelbase. |
| `stepUp` | 0.15 m | Rolls up the 0.12 m curbs. Bin sides (1.06 m) and deck rails (0.52 m) are walls, so you have to hop them. |
| `followSlope` | 0.47 (tan 25°) | The steepest descent the bike sticks to. Ramps (10.6°) are followed. Curbs and ledges drop you into a real fall with momentum kept. |
| `snapSlack` | 0.05 m | Per-substep downhill tolerance, so tiny terrain noise doesn't cause micro-airs. |
| `overhang` | 0.06 m | If the halfway probe is this far off the contact→wheel line, the wheel is over a ledge, not on a slope (see gap 7). |
| `groundPitchRate` | 16 /s | Visual pitch eases onto the slope (~0.2 s): ramps blend in and landings settle instead of snapping. |

### Landing judge
| Key | Value | Why |
|---|---|---|
| `cleanAngle` | 18° | Mismatch ≤ 18° lands clean and keeps full speed. Forgiving, BMX-style. One-wheel-first is fine. |
| `wobbleAngle` | 30° | 18–30° is a wobble. Beyond 30° is a bail (`land{quality:'bail'}` + `bail{reason:'landing'}`, `bailed = true`). |
| `wobbleSpeedKeep` | 0.7 | A wobble costs 30% of speed, which you feel without stopping the run. |
| `wobbleTime` | 0.5 s | How long `state.wobbling` stays true. |
| `wobbleSteerScale` | 0.5 | Steering and lean are halved while wobbling, which sells the instability. |

### Crashes
| Key | Value | Why |
|---|---|---|
| `wallBailSpeed` | 6 m/s | Hitting a wall or bin side above ~22 km/h bails (`reason: 'crash'`). Below that the bike stops. Applies on the ground and in the air. |

## Tuning knobs for the round-trip
- Hops too high or low: `hopFullHeight` / `hopTapHeight` (metres of apex, no maths needed).
- Too floaty or too heavy: `gravity`. Hop heights stay the same because the pop speed is derived from height and gravity; only the airtime changes.
- Turning too twitchy: `maxTurnRate`, then `steerPeakSpeed` to move where it peaks.
- Too punishing: widen `cleanAngle` / `wobbleAngle`, or raise `wallBailSpeed`.
- Any key can be overridden per instance: `createBike({ gravity: 12 })` merges over `CONFIG`.
