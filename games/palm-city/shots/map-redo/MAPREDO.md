# Palm City — City Map Redo Bake-Off (`MAPREDO.md`)

**Queue 4 Task 1** (`bparlette/tasking/gemini.md`). Zero edits to live `src/` or runtime `assets/`.

---

## 1. Audit of Shipped `src/map.js` (`before/`)

- **Problem:** `CityMap.build(F)` sampled `world.surfaceAt(wx, wy)` into flat RGB constants (`SURF`) with a diagonal `sin(...) * sin(...)` brush modulation (reading as halftone dots at phone scale), two-tone flat `fillRect` roofs (`ROOF`), and `3.2 px` solid green palm dots.
- **Label Collisions:** Plain stroked text (`fillText` / `strokeText`) lacked plaque framing and collided at `WRECK IT!` / `SKATE PARK`, `HELICOPTER` / `HOSPITAL`, `PIER` / `BOATS`, `GETAWAY` / `TAXI` / `TOW` / `BUS`, and `VALET — PARK IT!` / `POLICE`.
- **Reference Captures Preserved in `before/`:**
  - `before/map-spawn.png` (untouched copy of `shots/map-spawn.png`)
  - `before/map-motel.png` (untouched copy of `shots/map-motel.png`)
  - `before/map-before-golden.png` (`t = 0.25`, `420×860 @2x` phone)
  - `before/map-before-dusk.png` (`t = 0.90`, `420×860 @2x` phone)

---

## 2. Method & Baked Overview Assets (`after/`)

- **Script:** `node tools/build_map_redo.mjs`
- **How it bakes:** Instantiates an offscreen `Renderer(ctx, world, ground, M)` inside Playwright Chromium (`chaseOK = false`, `drawActivityMarkers = () => {}`, static `cleanSim` with `cars: []`, `peds: []`, `eventSites: []`) centered at `(900, 1100)` with `zoom = 0.5`, rendering the entire `1800 × 2200` world through the game's own `GroundPainter`, ocean shader, shadow pass, building roof sprites, palms, bushes, pier, fountain, surface grain, and time-of-day grading + dusk lighting.
- **Exact Dimensions & Aspect:**
  - `after/map_base_golden.webp` — `900 × 1100 px` (`0.5 px / wu`, `9:11` exact aspect matching `1800 × 2200` world; `cwebp -q 92`)
  - `after/map_base_dusk.webp` — `900 × 1100 px` (`0.5 px / wu`, `9:11` exact aspect; `cwebp -q 92`)
  - On `420 × 860` phone (`mapFrame(420, 860, world)`): `F.w = 396`, `F.h = 484` (`k = 0.22`). At `2×` Retina (`792 × 968 px`), the `900 × 1100` baked base downsamples cleanly at `~1.14×` supersampling with zero pixelation.
- **UI / Signage Plaques (`after/map-after-{golden,dusk}.png`):**
  - Parchment-cream (`rgba(252,238,210,0.92)`) & dark-plum (`#210f2e`) bordered plaques for buildings/areas, coral-pink (`#ff5c9a`) for `MOTEL` (door `[706, 1310]`), dark-plum/cyan (`#6ee2ff`) for activities/jobs, and gold (`#ffd45c`) for active targets & `YOU`, with non-overlapping staggered offsets.

---

## 3. One-Step WIRING Note for Fable

1. Copy `shots/map-redo/after/map_base_golden.webp` and `shots/map-redo/after/map_base_dusk.webp` to `assets/map_base_golden.webp` and `assets/map_base_dusk.webp` (and register in `src/assets.js`).
2. In `src/map.js`, replace `CityMap.build(F)`'s `surfaceAt` pixel loop with `g.drawImage(t >= 0.55 ? duskImg : goldenImg, F.x, F.y, F.w, F.h)` inside the rounded `F.x, F.y, F.w, F.h` clip (passing `t` from `main.js` into `cityMap.draw(...)`, or cross-fading `duskImg` with `globalAlpha = smooth(0.45, 0.85, t)`).
3. Replace plain `strokeText`/`fillText` in `CityMap.draw` with the `drawPlaque` + `OFFSETS` block from `tools/build_map_redo.mjs` so all 12+ POIs and activity pins remain legible without overlapping.

---

## 4. Bake-Off Sheets

- `bakeoff-golden-phone.png` — `420×860` phone comparison at golden hour (`t = 0.25`)
- `bakeoff-dusk-phone.png` — `420×860` phone comparison at blue dusk (`t = 0.90`)
