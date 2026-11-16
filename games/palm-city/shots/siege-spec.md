# Palm City — Motel Siege Design & Look Spec (Gemini)

> **Design + look target proposal** (Task 2 of `bparlette/tasking/gemini.md`; builder Fable implements later against this spec — no game code or asset changes in this delivery).  
> Anchored to the real Motel block in [layout.json](../layout.json) (`id: "motel"`, `x: 444, y: 1140, w: 252, d: 196, h: 7, sign: "MOTEL"`) and the main game's golden-hour and dusk lighting grades ([src/render.js](../src/render.js)).

## Visual Look Targets *(Updated Nov 16, 2026 — Full-Frame Redo)*

> **Framing Redo Note (Nov 16, 2026):** Replaced the original mid-frame plates with full-bleed `840x1720` (`420x860 @ 2x`) street-level cutaway plates filling every edge with zero empty sky/curb bands: Palm City skyline & chopper spotlight above, dressed 3-floor interior rooms + grounded stairwells + zig-zag fire escape centered, and active street siege (`2` police cruisers, sawhorse barricades, SWAT/patrol units, AC crush impact) across the lower asphalt foreground.

1. [siege-target-golden.png](siege-target-golden.png) — `840x1720` (`420x860 @ 2x`) full-frame portrait cutaway at golden hour (`6:45 PM`, `★3`), showing warm afternoon shafts streaming across all 3 dressed floors, Reception Desk barricade, `VEND` soda crush, Queen Mattress + falling CRT TV + Rolling Linen Cart, Fuse Box sparks, hero climbing Roof Hatch ladder, East Fire Escape -> Skateboard ramp, and street police cordon.
2. [siege-target-dusk.png](siege-target-dusk.png) — Same full-frame density at deep indigo dusk (`7:45 PM`, `★5`), adding hovering police chopper searchlight cone + SWAT roof rappel, pink-magenta `MOTEL / VACANCY` neon bloom, dropped Window AC caving in the East cruiser roof with smoke, hero bailing down East Awning onto escape Skateboard, wet neon asphalt reflections, and red/blue cruiser strobe washes.
3. [siege-target-layout.png](siege-target-layout.png) — Annotated engineering schematic calling out every room, breach point, barricade slot, physics trap trigger, vertical stairwell, and escape path.

---

## 1. Entry, Camera Transition & Viewport Budget

- **World Trigger:** Player approaches the Motel courtyard doorway (`x ∈ [515, 575], y ∈ [1185, 1235]`) in top-down mode. Contextual Action button switches to **`ENTER`** (auto-prompts when `wanted ≥ 1`).
- **Transition (`0.35 s` smoothstep):** Top-down canvas crossfades into the **2D Side-View Cutaway** (`mode: 'siege'`), keeping Palm City's exact `420x860` portrait framing and floating touch HUD (`PUNCH` / `GRAB` + `JUMP` / `BARRICADE` / joystick).
- **Cutaway Playable Bounds (Side-View Coordinates, `1 m = 10 world` matching `UPM = 10`):**
  - Exterior width: `13.8 m` building span (`x_local ∈ [-7.6, +6.2] m`), plus `2.4 m` **East Fire Escape** (`x_local ∈ [+6.2, +8.6] m`), total `16.2 m` well inside `~19 m` horizontal phone framing.
  - Floor height: `3.4 m` per floor × `3 floors = 10.2 m` ceiling + `0.65 m` parapet (`MOTEL` neon pylon tops out at `z = 13.2 m`).
  - Camera tracks player smoothly horizontally (clamped `±1.5 m`) and vertically (`z_cam ∈ [4.2, 8.8] m`) as they climb floor to floor or sprint across the roof.

---

## 2. Floor Plans, Barricades & Physics Traps

Each floor connects via one main interior stairwell and holds both **pushable barricades** (slow/funnel pursuing cops) and **one-shot kinetic physics traps** (heavy knockdowns + multi-target stagger + big score combo).

### Floor 1 — Lobby & Vending Hall (`z = 0.0..3.4 m`)
| Zone (`x_local`) | Room / Feature | Interactive Object | Mechanic & Timing |
|---|---|---|---|
| `-7.6..-3.0 m` | Lobby Entrance | **Double Glass Doors** (Breach A) + **Check-in Reception Desk** (Barricade #1) | Hold/tap action to shove heavy wood desk across lobby doorway (`0.4 s` push, absorbs `3` shotgun/baton slams before splintering via Destruction Pass stages). |
| `-1.8..+2.4 m` | Vending Alcove | **Glowing `VEND` Soda Machine** (Trap #1) | Punch/kick from behind tips machine `90°` forward onto floor (`0.35 s` fall); **crushes** up to 2 entering officers for `+300 TRAP KO` and permanently blocks narrow choke unless cops smash around it (`3 s` delay). |
| `+2.4..+6.2 m` | Courtyard Wing & Stairs | **East Pool Window** (Breach B @ ★2+) + **Stairwell up to F2** (`x = +3.5..+5.5 m`) | Upward staircase climbs smoothly into Floor 2 East Guest Wing. |

### Floor 2 — Guest Corridor (`z = 3.4..6.8 m`)
| Zone (`x_local`) | Room / Feature | Interactive Object | Mechanic & Timing |
|---|---|---|---|
| `-7.6..-2.2 m` | Room 201 | **Queen Mattress** (Barricade #2) + **CRT TV on Dresser** (Trap #2) | Shove mattress `1.2 m` west onto stairwell landing (`0.35 s`, trips/staggers rushing officers); punch CRT TV off dresser ledge so it **plummets down the West drop / stair lip**, glass-shattering on impact (`+250`, stuns radius `1.6 m`). |
| `-2.2..+2.2 m` | Central Corridor | **Rolling Linen Housekeeping Cart** (Trap #3) | Shove East or West (`v = 7.5 m/s`) — bowls straight through corridor knocking down every officer in its lane before crashing through Room 202 partition (`+200` per bowled cop). |
| `+2.2..+6.2 m` | Room 202 & Balcony | **Courtyard Ladder Anchor** (Breach C @ ★3+) + **Stairwell** | Cops deploy metal extension ladder from pool courtyard at `★3`; hero can kick ladder off rail once (`6 s` reset delay). |

### Floor 3 — Penthouse & Roof Hatch (`z = 6.8..10.2 m`)
| Zone (`x_local`) | Room / Feature | Interactive Object | Mechanic & Timing |
|---|---|---|---|
| `-7.6..-1.4 m` | Room 301 & Storage | **Oak Dresser** (Barricade #3) + **Wall Fuse Box** | Punching fuse box shorts corridor lights (`2.5 s` flicker + electrical spark stun radius `1.8 m`). |
| `-1.4..+3.5 m` | Hallway & Ceiling Hatch | **Steel Roof Ladder** (`x = 0.0 m`) + **Padlocked Roof Hatch** (`z = 10.2 m`) | Interact `0.8 s` (or `2` fast punches) pops latch open (`58°` Coral hatch swings upward). Climbing shaft puts hero on main Motel Roof. |
| `+3.5..+6.2 m` | East Suite Sill | **Window AC Unit** (Trap #4) | Punch from inside pops rusty bolts -> heavy metal compressor drops `3` stories (`g = 18 m/s^2`) onto exterior street/fire-escape queue below, **crushing parked police squad car roof / massed officers** (`+500 BIG DROP`, triggers Stage-2 car dent/smoke!). |

---

## 3. Escape Route (Roof → Fire Escape → Skateboard Bail)

1. **Roof Dash (`z = 10.2..13.2 m`):** Hero emerges through center **Roof Hatch** (`x = 0.0 m`), sprints East past the glowing `MOTEL` neon sign pylon (`x = +4.9 m`, pink neon glow pool in dusk mode). Jumping onto low HVAC vent (`x = -5.4 m`) optionally gives higher vantage/ammo stash.
2. **Exterior Zig-Zag Fire Escape (`x = +6.2..+8.6 m`):** Drop or vault East parapet onto Floor 3 iron fire-escape balcony; either sprint down the 2 zig-zag metal flights (`F3 → F2 → F1 Coral Awning`) **or** grind/slide straight down the outer railing!
3. **Final Skateboard Bail (`x = +7.9 m, z = 0.0 m`):** Leap off Floor 1 awning (`z = 3.1 m`) onto the **leaning escape skateboard** waiting at the East Alley Ramp (`world coords x = 710, y = 1230`), landing straight into an auto-mounted kick-push (`v_out = 210 u/s` east/south) back in the **Top-Down Open World** with `MOTEL ESCAPED! +1500` stunt banner and `1` wanted star shed if cleanly breaking line of sight!

---

## 4. Siege Escalation by Wave / Wanted Stars

| Time / Star Tier | Pressure & Breach Vector | Visual & Audio Cues |
|---|---|---|
| **Wave 1 (★1, `0–15 s`)** | 2 Patrol officers kick open Lobby Double Glass (`F1` West); advance steadily up stairs checking behind Lobby desk. | Squad car pulls up at curb (`red/blue` lightbar pulse); voice hook: police megaphone bark. |
| **Wave 2 (★2, `15–30 s`)** | Courtyard Pool Window (`F1` East) smashes inward (`glass shards` per Destruction Spec); 3 officers split pincer from West Lobby + East Courtyard. | Interior saffron window spill flares as doors bust open; sirens stay faint outdoors. |
| **Wave 3 (★3, `30–50 s`)** | Riot-baton / shotgun pair stacks stairwell; **Exterior Aluminum Ladder** clanks onto Room 202 balcony (`F2` East). | Ladder silhouette climbs outside glass; Floor 2 corridor echoes heavy boots. |
| **Wave 4–5 (★4–★5, `50 s+`)** | Police **Chopper Spotlight** (Fable Task 5 integration) rakes across upper cutaway windows (`soft radial gold-white cone`), followed by **2 SWAT officers rappelling onto Roof Hatch** if player hasn't escaped `F3`. | Chopper rotor thump; hatch rattles visibly with dust particles before SWAT drops in — forcing dash onto Fire Escape → Skateboard exit! |

---

## 5. Cutaway Visual Style & Grade Rules (`src/render.js`)

- **Architectural Shell & Ink:** Bold `#20192b` (`0.12–0.15` luma) cutaway wall frame borders separating rooms from background exterior sky (`#f2b678` warm apricot at golden hour, `#18245a` deep indigo at dusk). Interior wall fills use muted teal/terracotta washes (`#d9a882`, `#c49894`, `#8aa4a0`) with Kuwahara + `oriented_stroke_pass` + `#210f2e` contour ink so every trap silhouette (`VEND`, `CRT TV`, `AC Unit`, `Bench/Mattress`) pops against the back wall.
- **Golden vs Dusk Contrast:** Golden hour pushes diagonal low-sun shafts (`azimuth 255°`) deep through lobby/room windows onto wood floors; dusk drops exterior sky/street to midnight indigo (`[24, 38, 108]`), brightens warm saffron windows/interior practicals (`#ffae48`), and applies `'screen'` bloom to the pink `MOTEL` neon (`#ff3f6a`) and red/blue police lightbar (`#ff2238` / `#2268ff`).
