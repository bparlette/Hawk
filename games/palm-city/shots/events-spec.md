# Palm City — City Events Design Spec (Gemini)

> **Design spec only** (Task 3 of `bparlette/tasking/gemini.md`; builder Fable implements later in Step 7/Task 7 — no game code or asset changes in this delivery).  
> Built directly atop Fable's **Destruction Pass** (Task 1) and **Skateboard / Stunt Car** systems in Palm City (`games/palm-city/`).

---

## 0. Event Triggers & Activation

City Events appear as pulsing golden **Event Star Beacons** on open intersections / parking lots (`WRECK IT!` near North Plaza / Coast Promenade, `VALET PARK IT!` at Garage & NOVA parking aprons). Walking or driving into a beacon (`hold/tap ACTION`) starts a clean self-contained timed score-attack round (`HUD swaps clock to crisp countdown timer + Combo Multiplier pill`) with zero scene reload.

---

## 1. WRECK IT! — Timed Destruction Blitz, Domino Anchors & Hit-Stop

### Core Mechanics
- **Rule:** **`45.0 s`** timer (`60 s` in Tier 3). Destroy as much property, street furniture, and target vehicles inside the active city district as possible before time expires.
- **Built Directly on Destruction Pass (Task 1):** Every hit advances the same staged destruction state (`Scuff/Dent -> Cracked/Broken Half -> Wrecked/Collapsed Debris`); **zero** separate destruction code!
- **Domino Chain Anchors (High-Value Cascade Triggers):**
  - Spawned at `6–8` strategic spots per zone, clearly inked so players spot chain lines:
    1. **Pressurized Curb Fire Hydrants** (`x = 1235` coast curbs & Plaza corners) — smashing bursts a high-pressure water jet sideways pushing/staggering cops & knocking over adjacent benches/palms!
    2. **Red Hazard Fuel Drums / Propane Clusters** (construction pockets near `garage` & `office` alleys) — Stage-1 spark ignites a `0.6 s` fizz, then **detonates** with `r = 95 world` blast wave triggering Stage-2/3 collapse on surrounding cars, fences, bushes, and tall palms (**Domino Chain**!).
    3. **Domino Tall-Palm Rows:** Snapping the first tilted palm along the promenade sends its weighted trunk crashing into the next palm/bench/car along the boardwalk (`Task 1` crush rule!).
- **Game Feel — Hit-Stop & 2D Camera Punch:**
  - Every **Domino Anchor detonation**, **Stage-3 car wreck collapse**, or **`≥ 3`-object chain reaction** triggers:
    - **`50 ms` Hit-Stop** (`sim` freezes `3` ticks while flash/sparks linger — makes heavy metal crunch feel huge!).
    - **2D Zoom-Punch & Micro-Shake** (`cam.zoom * 1.045` snapping back over `0.18 s`, damped directional jitter).

### Scoring, Tier Medals & Combo Rules
- **Base Destruction Points:** Bush `+40` · Skate Rail / Lamp `+80` · Bench Break `+100` · Palm Snap `+150` · Car Stage 1/2/3 `+100 / +200 / +500` · Anchor Detonation `+300`.
- **Domino Chain Multiplier (`x1` → `x8`):** Every additional object wrecked within **`1.8 s`** of the last (or linked inside one Anchor blast/fallen-tree cascade) increments the Chain Counter (`CHAIN x4!`).
- **Medal Thresholds (45 s Round):**
  - **Bronze:** `2,500 pts` · **Silver:** `5,500 pts` · **Gold:** `9,500 pts` (requires routing at least `2` Domino Anchor cascades cleanly).

### Fail States & Difficulty Curve
- **Fail States:** Getting **`BUSTED`** by responding patrol units ends the run immediately (`forfeits multiplier`, keeps partial score up to bust); letting chain decay loses combo momentum (timer expiry simply ends and awards medal reached).
- **Difficulty Curve:**
  - *District 1 (Promenade North):* `★1` gentle cop response, forgiving `2.2 s` chain decay window, generous `Fuel Drum -> Palm -> Bench -> Parked Cars` lines.
  - *District 2 (Midtown Motel / NOVA):* Starts at `★2` with active patrol ramming; narrower side streets requiring tight car sweeps (`van_sun` / stolen cab) between Domino Anchors.
  - *District 3 (Garage & Industrial South):* Starts at `★3`, armed cop roadblocks + `1.6 s` fast chain window; `Gold` requires chaining Anchor explosions into incoming police cruisers!

### Voice Hooks (`WRECK IT!`)
| Hook ID | Trigger Condition | Line Beat |
|---|---|---|
| `VOX_EVT_WRECK_START` | Countdown `3-2-1-GO` begins | *"Forty-five seconds — tear the block down!"* |
| `VOX_EVT_WRECK_DOMINO` | Domino Anchor ignites ≥ 3-object chain | *"Boom! Look at 'em fall like dominoes!"* |
| `VOX_EVT_WRECK_CHAIN_5X` | Combo multiplier hits `5x` or higher | *"Unstoppable! Pure beachfront chaos!"* |
| `VOX_EVT_WRECK_10S` | `10.0 s` remaining warning | *"Ten seconds left — finish strong!"* |
| `VOX_EVT_WRECK_GOLD` | Round ends with Gold medal score | *"Total demolition! City Hall's gonna cry!"* |
| `VOX_EVT_WRECK_BUSTED` | Busted mid-event | *"Cuffed right before the finale — tough break!"* |

---

## 2. VALET PARK IT! — Precision Stunts & 5× J-Turns

### Core Mechanics
- **Parking Bays (Anchored to Real Lots in `layout.json`):**
  - Active target stall glows cyan-gold inside real bays (`garage` south apron `x=744..1116, y=1666`, `NOVA` parking strip `x=852..1128, y=1146`, plus `hotel SOLANA` & `diner` curb valets).
  - HUD shows exact **Alignment Reticle**: car nose/tail orientation arrow (`tolerance ±14°` for Clean, `±25°` for Sloppy) inside painted stall lines.
- **Stunt Entry Bonus Multipliers:**
  - **Standard Pull-In (`1x`):** Drive slowly into stall and settle (`v < 15 u/s` for `0.45 s`).
  - **Power-Slide Park (`2.5x`):** Enter bay sideways at slip angle `> 0.35 rad` and lock inside lines cleanly!
  - **Signature J-TURN (`5.0x`):** Approach at **`v ≥ 180 u/s`**, whip steering past **`135°–180°`** within `1.1 s` before settling (`nose facing OUTWARD or locked reverse-spin into tight bay without scraping neighboring cars!`) -> freezes briefly with bright **`J-TURN PARK! 5x`** banner + golden wheel-smoke burst!
- **Damage Integrity Bonus:** Any bump against flanking parked cars or concrete curb (`Stage-1` scuff) cuts the bay's **Mint Paint Bonus (`+$300`)** to `0`.

### Scoring, Fail States & Difficulty Curve
- **Scoring:** Base `$200` per bay × Entry Multiplier (`1x` / `2.5x` / **`5x J-Turn`**) + **`Mint Condition +$300`** + **`Speed Split Bonus` (`+$20` per spare second)**.
- **Difficulty Curve & Tightening Constraints:**
  - *Round 1 (`3` wide bays, SOLANA & Plaza):* Clean open stalls (`w = 34`), no chasing cops; generous `50 s` total clock.
  - *Round 2 (`4` flanked bays, NOVA Lot):* Parked sedans flank left & right (`margin ±6 px`), oncoming traffic along Ocean Loop forces sharp J-turn timing between cars.
  - *Round 3 (`5` narrow bays, Garage Lot + Heat):* Timed `★2` police patrol sweeps street — player must whip crisp **`5x` J-Turns** in narrow `Garage` stalls under pursuit pressure!
- **Fail States:** Car destroyed (`Stage 3`), bay time clock (`45–55 s`) expires before parking required quota, or getting `BUSTED` while settling in a bay.

### Voice Hooks (`VALET PARK IT!`)
| Hook ID | Trigger Condition | Line Beat |
|---|---|---|
| `VOX_EVT_VALET_START` | Valet run starts | *"Keys in hand — park it clean, park it fast!"* |
| `VOX_EVT_VALET_MINT` | Clean bay lock with zero paint scuffs | *"Not even a hairline scratch — spotless!"* |
| `VOX_EVT_VALET_DRIFT` | `2.5x` slide-in park locked | *"Smooth slide right between the lines!"* |
| `VOX_EVT_VALET_JTURN` | **`5x` J-Turn Park** verified | *"FIVE-X J-TURN! Pure velvet!"* |
| `VOX_EVT_VALET_SCRAPE` | Clips flanking car / loses Mint bonus | *"Oof — that bumper's coming out of tips!"* |
| `VOX_EVT_VALET_COMPLETE` | Clears all bays before timer | *"VIP valet legend — keys on the hook!"* |

---

## Complete Voice Hook Inventory (Jobs + Events Cross-Check)

Total deterministic trigger lines specified across Tasks 2–3:
- **Jobs Board (`jobs-spec.md`):** `23` IDs (`6` Taxi + `6` Tow + `5` Bus + `6` Getaway)
- **City Events (`events-spec.md`):** `12` IDs (`6` Wreck It + `6` Valet Park It)
- **Shared Core / Motel Siege Hooks (for remaining `15` slots of Moth's 50-line pack):** Motel breach megaphone, Vending/AC trap cheer, Choppers spotlight locked, Skateboard bail cheer, Wanted star up/cleared, Car jacked, Busted sting.
