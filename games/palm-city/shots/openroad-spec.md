# OPEN ROAD — Look & Feel Spec (Task G16)

> Governing visual & feel specification for `games/palm-city/src/openroad3d.js`, uniting the pseudo-3D OutRun chase view (`chasecam.js`, `openroad.js`) with Palm City's `#210f2e` dark-plum inked painted world style at `420×860` phone scale.

## 1. Visual Bar — Painted Cohesion with Core Palm City

The Sunset GP pseudo-3D projection geometry in `openroad3d.js` (`SEG_LEN = 5`, `DRAW_SEGS = 170`, `ROAD_HALF = 27`, `CAM_H = 13`, `CAM_DEPTH = 0.84`, `SPR_V = 1.55`, `CHASE.horizon = 0.315`) is the structural baseline. To eliminate flat vector fills and match the 2D painted city:

1. **Dark-Plum Ink Unifier (`#210f2e`):**
   - Every roadside element (palm trunks/fronds, roadside bushes, streetlamps, downtown buildings, guardrails, checkpoint banners/posts, traffic cars, crowds, and the hero rear-view car) carries explicit `#210f2e` contour weight scaling with perspective (`max(0.75, 1.15 * u)` far -> `1.6–2.4 px` on the hero chassis).
   - Eliminates sticker/clip-art softness against the dusk sky and fog haze.
2. **Painted Road & Coastal Water Texture (Deterministic per-segment / per-band):**
   - **Road asphalt (`ROAD_COL`):** Retain the warm alternating corduroy bands (`#786a5e` / `#706357`) for speed sensation, layered with subtle longitudinal dark/warm brush streaks (shoulder wear + twin tire-track ribbons converging smoothly to the vanishing point without moiré flicker).
   - **Biscayne Bay water (`GROUND_COL.water`):** Layer deterministic sunlit horizontal wave glints (`rgba(255,246,204, ...)` near golden hour -> cool cyan shimmer `rgba(140,235,255, ...)` at dusk) onto bay strips along MacArthur Causeway.
   - **Sand & Grass verges:** Crisp `#210f2e` / warm-ochre curb lip separation under guardrails and rumble strips (`#e8e0d0` / `#d94f3d`).
3. **Hero Car (`drawCarRear`) & Traffic Readability at Phone Zoom:**
   - Hero car width (`vw * 0.40`, `conv_rose` `#ffc2cf -> #f28ba4 -> #c25b78` default grid car): crisp `#210f2e` outer ink perimeter, beltline/trunk seam line, warm highlight rim along the deck & folded boot, subtle diagonal sheen on rear glass / windscreen header, glowing brake/tail halos on decel, and symmetric **twin chrome exhaust tips** framed in `#210f2e` ink so the azure turbo flame erupts cleanly between them.
4. **Gates & Finish Archway:**
   - Gold checkpoint posts/banners (`#ffb02e`) and checkered FINISH arch edged in `#210f2e` ink so `CHECKPOINT` / `FINISH` lettering pops sharply against both golden-hour peach clouds (`t = 0.2`) and deep ultramarine dusk (`t = 0.92`).

## 2. Speed, Camera & Event Feel Numbers (Verified in `openroad.js` & `chasecam.js`)

| System | Tuned Value | Purpose in Play |
|---|---|---|
| Starting Clock Bank | `OPENROAD.bank = 12 s` | Immediate arcade urgency off the 3-count grid hold |
| Checkpoint Grants | `[7, 6, 6, 6, 5] s` (`42 s` total) | Tight gate-to-gate rescue tension (~`4,511` wu course) |
| Score Economy | `cpPts = 400`, `nearPts = 150`, `driftPts = 100`, `finishPts = 1000 + 25/s` | Rewards tight traffic threading and controlled slides |
| Chase Tyre Bite | `OPENROAD.gripMul = 1.45` | Confident high-speed sweepers through causeway curves |
| Speed FOV Breath | `camDepth = 0.84 * (1 - 0.10 * speedR)` | Pulls horizon peripheral rush open at top speed |
| Curve Camera Sway | `view.lat` exponential lag (`dt * 9`), hero yaw offset `±30 px`, roll `±0.085 rad` | Physical weight transfer into corners |
| Turbo & Shake | `car.turbo > 0.25` azure flame + `sin(time * 38) * 1.6 * speedR` suspension tremor | Tactile speed payoff |
| Corner Tire Feedback | `lat > 560 && \|v\| > 120` -> rear tire smoke + `'screech'` | Instant auditory/visual limit warning |
| Pressure Choreography | 3 stars pinned, 2 pursuit cars held through countdown + choppers + finish crowd cheer | Unbroken cinematic race climax |

## 3. Acceptance Evidence

- Phone bake-off (`420×860 @2x`) comparing `before` vs `after` at Golden Hour (`t=0.18`) and Blue Dusk (`t=0.90`) in `shots/openroad-bakeoff/bakeoff-openroad-phone.png`.
- Full automated verification via `node tools/openroad_check.mjs` (`OPENROAD OK` — all Node & Playwright browser assertions passing with zero errors).
