# Palm City — Jobs Board Design Spec (Gemini)

> **Design spec only** (Task 3 of `bparlette/tasking/gemini.md`; builder Fable implements later in Step 6/Task 6 — no game code or asset changes in this delivery).  
> All coordinates, landmarks, and vehicle types reference the live layout in [layout.json](../layout.json) and vehicle sprites in [assets/manifest.json](../assets/manifest.json).

---

## 0. Jobs Board Hub & Activation Rules

- **Physical Entry & Auto-Offer:**
  - **Public Jobs Board Kiosk** anchored outside the North Plaza / Shops walkway (`x = 690, y = 400`) and outside Garage (`x = 740, y = 1485`). Stepping into the highlighted board zone opens a clean bottom-card selector (4 tiles: `TAXI`, `TOW`, `BUS`, `GETAWAY`).
  - **Contextual Quick-Start:** Hopping into `car_taxi` auto-prompts **`START TAXI`** on the top banner (`TAP ACTION` to accept); similarly `van_sky`/`van_sun` can dispatch `TOW` / `GETAWAY`, or entering any marked job vehicle parked by the Garage (`x = 880, y = 1666`).
- **One Active Mission Slot:** Only one job or City Event runs at a time; aborting (`HOLD ACTION 1.2 s` or getting `BUSTED`) ends the run cleanly and clears job decals/targets.

---

## 1. TAXI — Fare Moods & Undercover Feds

### Core Mechanics
- **Pickup & Landmarks:** Spawn waiting fare (`ped_sun` / `ped_rose` / `ped_white` with pulsing cyan curb halo) at real landmarks: `hotel` (`SOLANA`, `x=550, y=535`), `diner` (`x=550, y=725`), `club` (`NOVA`, `x=990, y=1360`), `motel` (`x=570, y=1355`), `pier` boardwalk (`x=1330, y=1035`), `villa1..3` driveways (`west loop`).
- **Fare Mood Gauge (`0..100`):** Shown as a crisp compact bar beside the timer (`GREEN HAPPY` / `AMBER NERVOUS` / `RED PANIC`):
  - **Preferred Style (randomized per fare from 3 archetypes):**
    - *Speed Freak* — gains mood at `v > 220 u/s` and during drifty turns (`slip > 0.25`); loses mood if crawling `< 80 u/s`.
    - *Smooth VIP* — gains mood on clean curb-to-curb cruising without crashes; loses `-18` per collision or sidewalk pedestrian bump.
    - *Chaos Tourist* — gains mood `+15` per near-miss, Stage-1+ destruction hit nearby, or ollie/rail launch past cops.
- **Undercover Feds (`wanted ≥ 3` Twist):**
  - When `stars >= 3`, **`35%` chance** the picked-up "fare" is an Undercover Federal Agent (`ped_white` or `ped_blue` in disguise).
  - After `5–8 s` driving (`or halfway to destination`), cabin flashes red/blue: fare drops cover (**`BUSTED TRAP!`** trigger if stopped `< 40 u/s` for `1.5 s`!), tries to grab the wheel (`steering jitter ±0.25`), and alerts nearest patrol unit (`stars = max(stars, 4)`).
  - **Counterplay:** Slam speed past `260 u/s` and hard-brake/J-turn OR **eject/bail on foot or skateboard** before the agent locks the doors, turning the cab into an unmanned torpedo!

### Scoring, Fail States & Difficulty Curve
- **Scoring:** Base `$150` + distance bonus + `Mood Bonus` (`+100%` if `mood ≥ 80` on curb drop). Sequential clean fares stack **`Fare Streak x1..x5`**. Escaping/ditching a revealed Fed intact pays `+600` *"FED SHOOK!"*.
- **Fail States:** Cab wrecked to Stage 3 (`DESTRUCTION-DELTA.md`), timer hits `0:00` before drop-off, `mood` drops to `0` (fare dives out at red light/slowdown), or player is `BUSTED` by Fed trap.
- **Difficulty Curve:** Fare 1–2 give `32 s` generous windows and chill tourists; Fare 3+ shorten timers (`22–26 s`), spawn cross-map runs (`SOLANA -> south villa`), and introduce Feds whenever `stars >= 3`.

### Voice Hooks (`TAXI`)
| Hook ID | Trigger Condition | Line Beat |
|---|---|---|
| `VOX_JOB_TAXI_START` | Player starts Taxi run | *"Meter's live — let's make some fares!"* |
| `VOX_JOB_TAXI_PICKUP_CHILL` | Fare enters cab (`Speed` / `Chaos` type) | *"Step on it, don't spare the rubber!"* |
| `VOX_JOB_TAXI_PICKUP_VIP` | Smooth VIP enters cab | *"Smooth and clean, please — zero scratches."* |
| `VOX_JOB_TAXI_MOOD_LOW` | Fare mood drops below `25` | *"Hey! You trying to get us killed?!"* |
| `VOX_JOB_TAXI_FED_REVEAL` | `wanted ≥ 3` undercover Fed blows cover | *"Freeze! Federal agent — pull over NOW!"* |
| `VOX_JOB_TAXI_DROP_CLEAN` | High-mood fare drop-off (`mood ≥ 75`) | *"Keep the change, legend!"* |

---

## 2. TOW — Cable Physics & Payload-as-Weapon

### Core Mechanics
- **Rig & Cable Constraint:** Player drives a heavy yellow/utility Tow Cab (`van_sun` variant with rear boom hook). Approaching any disabled, parked, or wrecked car (`Stage 0..3`) and tapping **`HOOK`** (`Action` button) attaches a taut visible steel cable (`maxLen = 74`, spring `k = 28`, damping `0.85`).
- **Two-Body Sling Physics:**
  - Towed payload trails along constraint circle `dist ≤ maxLen`; sharp steering kicks whip the payload laterally (`angular momentum`), creating a sweeping **wrecking ball on a tether**!
  - **Payload-as-Weapon:** Any street prop (bench, lamp, palm, bush per Task 1 Destruction System) or police car / pursuing officer struck by the **swinging towed payload** suffers speed-scaled impact damage (`2.2x` mass multiplier vs normal bumper hit) while shielding the tow truck from direct nose damage!
  - Holding **`UNHOOK`** (`Action` button while moving `v > 140 u/s`) **slingshots** the detached car forward along its tangent velocity vector toward roadblocks or pursuers!
- **Target Drop:** Haul marked repo / wrecked vehicles back into the Garage Apron (`x = 744..1116, y = 1500..1706`).

### Scoring, Fail States & Difficulty Curve
- **Scoring:** Base `$400` per towed vehicle + `+250` per police cruiser smashed by swinging payload + `+150` combo for slingshot takedown into roadblock.
- **Fail States:** Cable **snaps** on extreme tensile shock (`pullForce > F_max` twice -> *"CABLE SNAPPED!"*, must re-hook or timer expires), payload falls into ocean water (`x > shoreX`), or tow truck wrecked to Stage 3.
- **Difficulty Curve:** Contract 1: motionless parked sedan in `NOVA` lot (`x=852, y=1146`) with light traffic; Contract 2: damaged smoking van guarded by angry owner (`punch/flee`); Contract 3+: live **active police cruiser** or armored courier van that fights steering while pursuing cops try to pit-maneuver the truck!

### Voice Hooks (`TOW`)
| Hook ID | Trigger Condition | Line Beat |
|---|---|---|
| `VOX_JOB_TOW_START` | Contract accepted at Garage/board | *"Hook 'em and drag 'em — no excuses."* |
| `VOX_JOB_TOW_HOOKED` | Tow cable latches onto target car | *"Locked in! Keep the cable tight!"* |
| `VOX_JOB_TOW_WEAPON_HIT` | Swung payload smashes cop car or prop | *"Whoa — watch that backswing!"* |
| `VOX_JOB_TOW_SLINGSHOT` | High-speed release slingshots payload | *"Heads up — incoming metal!"* |
| `VOX_JOB_TOW_SNAP` | Over-tension breaks tow cable | *"Cable snapped! Re-hook it!"* |
| `VOX_JOB_TOW_DELIVERED` | Target settles in Garage drop apron | *"Clean haul! Next one's waiting."* |

---

## 3. BUS — Route Loop, Curb Dwell & Chaos Pressure

### Core Mechanics
- **Vehicle:** Heavy high-mass coastal shuttle (`van_sky` / long coach tuned `mass = 2.4x`, strong straight momentum, wider turn radius, rams traffic/props cleanly).
- **Fixed 6-Stop Loop:**
  1. `SOLANA Hotel` Curb (`x=680, y=390`)
  2. `TACOS Shops` South (`x=880, y=410`)
  3. `Palm Fountain Plaza` East (`x=1195, y=470`)
  4. `Ocean Pier` Promenade (`x=1305, y=1035`)
  5. `NOVA Club` Front (`x=990, y=1365`)
  6. `Garage Terminus` (`x=920, y=1480`)
- **Curb Dwell Bar (`1.8 s` per stop):** Slow to `< 35 u/s` inside the glowing stop rectangle while `3–5` riders jog cleanly aboard (`VOX_JOB_BUS_BOARD`). Driving out early voids half the stop payout; staying too long while `wanted ≥ 2` invites cop flanking!

### Scoring, Fail States & Difficulty Curve
- **Scoring:** `$120` per boarded group + `Full Route Bonus $500` + `On-Time Tip +$200` if completing all 6 stops under `75 s`.
- **Fail States:** Timer expires between stops, bus wrecked to Stage 3, or fleeing every waiting stop without boarding (`0` stops completed before route closes).
- **Difficulty Curve:** Lap 1 has clear curbs; Lap 2 (`wanted ≥ 2` active on coastal loop) spawns double-parked delivery vans forcing player to plow or weave curbs; Lap 3 adds rush-hour cross-traffic and tight `9 s` inter-stop splits.

### Voice Hooks (`BUS`)
| Hook ID | Trigger Condition | Line Beat |
|---|---|---|
| `VOX_JOB_BUS_START` | Route begins | *"Coastal loop — stick to the schedule!"* |
| `VOX_JOB_BUS_BOARD` | Doors open cleanly inside curb box | *"All aboard — watch the doors!"* |
| `VOX_JOB_BUS_SKIP_WARN` | Pulls out before dwell bar fills | *"Hey, half the line's still on the curb!"* |
| `VOX_JOB_BUS_RUSH` | Hits full stop combo under timer | *"Express service — right on the dot!"* |
| `VOX_JOB_BUS_FINISH` | Completes full 6-stop loop | *"End of the line — solid shift!"* |

---

## 4. GETAWAY DRIVER — Crew Extraction, Spike Strips, Cash Decoys & Tandem Skateboard Bail

### Core Mechanics
1. **Heist Extraction (`0–12 s`):** Pull up at active heist target (`office` front `x=990, y=1150` or `hotel` vault side `x=440, y=380`); `2` masked crew (`ped` sprites) sprint out carrying duffel bags as alarm bell sounds (`wanted` jumps immediately to **`★3`**!).
2. **Police Spike Strips (`★3+`):** Roadblocks ahead unroll visible **silver steel spike mats** (`w = 88, d = 12` spanning 1 lane — leaving narrow curb/sidewalk gaps!). Hitting a strip pops front/rear tires on that side: car pulls toward blown side (`steerBias ±0.32`), top speed drops `30%`, and sparks spray from rim!
3. **Active Cash Decoys (Fight Button in Getaway Mode):**
   - Tapping `FIGHT/DECOY` flings a swirling stack of `$100` bills (`max 3 charges`, recharges slowly or via cash pickups) behind the rear bumper.
   - Pursuing patrol cars within `r = 160` swerve/brake momentarily or pedestrians swarm the street blocking police lanes for `3.0 s` (`+150 DECOY CLEAN`)!
4. **Climax: Tandem Skateboard Bail (`last leg` or emergency eject!):**
   - If getaway car gets **spiked or pinned at low speed / Stage 2+ damage** within `350` world of the East Safe House (`villa2` pier alley `x=1300, y=900` or South Pier ramp `x=1340, y=1350`), pressing **`ACTION / BAIL`** pops BOTH the hero AND crewmate onto the **Skateboard in Tandem** (`crewmate grips shoulders / crouches behind hero` on `board`, keeping full ollie/rail-grind ability while shedding car hitbox so you slip through narrow alleys/promenade rails to safety!).

### Scoring, Fail States & Difficulty Curve
- **Scoring:** Heist Cut `$1,000` + `+200` per decoyed cop car + `+400` **Tandem Board Finish** bonus if crossing safe-house zone on the skateboard!
- **Fail States:** Crewmate left behind (`> 20 s` outside car after pickup), crew downed by police/wreck explosion, or driver `BUSTED`.
- **Difficulty Curve:**Tier 1: `★2` pursuit, `1` spike strip on North curve; Tier 2: `★3` double ambush + narrow promenade escape; Tier 3: `★4` chopper spotlight + staggered lane-wide spike strips demanding sidewalk shortcuts + mandatory Tandem Skateboard Alley Bail!

### Voice Hooks (`GETAWAY DRIVER`)
| Hook ID | Trigger Condition | Line Beat |
|---|---|---|
| `VOX_JOB_GETAWAY_ALARM` | Crew exits heist with duffel bags | *"Go, go, go — alarms are singing!"* |
| `VOX_JOB_GETAWAY_SPIKES` | Patrol deploys spike strip ahead | *"Spike strip ahead — hug the curb!"* |
| `VOX_JOB_GETAWAY_TIRE_BLOWN` | Car rolls over spikes | *"Rim's chewing tarmac — ditch this wreck!"* |
| `VOX_JOB_GETAWAY_DECOY` | Cash decoy bundle dropped | *"Eat street paper, boys!"* |
| `VOX_JOB_GETAWAY_TANDEM_BAIL` | Driver + crew bail onto skateboard | *"Hop on — skate the alley!"* |
| `VOX_JOB_GETAWAY_CLEAR` | Reaches safehouse & shakes tail | *"Clean cut! Counting bills tonight!"* |

---

## Summary Voice Hook Index (Moth 50-Line Pack Mapping)

The Jobs Board claims **`22`** deterministic hook slots (`VOX_JOB_TAXI_*` × 6, `VOX_JOB_TOW_*` × 6, `VOX_JOB_BUS_*` × 5, `VOX_JOB_GETAWAY_*` × 6 -> wait: count cleanly = `23` slots!) paired cleanly alongside the `12` City Event hooks in [events-spec.md](events-spec.md) and remaining `15` core Siege / Freeroam / Wanted lines for Moth's 50-line pack.
