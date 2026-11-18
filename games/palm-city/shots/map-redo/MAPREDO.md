# City Map Redo (`Queue 4 Task 1`) — `MAPREDO.md`

> Full-world overview baked directly from Palm City's live `GroundPainter` + `Renderer` (zero halftone dots, zero flat solid rectangles) with `#210f2e`-inked painted signage plaques. Zero live `src/` or runtime `assets/` edits.

---

## 1. Method & Visual Gains vs `before/`

- **Why `before/` failed (`src/map.js:60-85`):** Sampled `world.surfaceAt()` on a diagonal `Math.sin` halftone grid, drew buildings as flat two-tone boxes, ignored baked roofs/shadows/water waves/skate park ramps/night bloom, and stacked plain text (`WRECK IT!` collided into `SKATE PARK`; `VALET — PARK IT!` overlapped `POLICE`).
- **How `after/` is built (`tools/build_map_redo.mjs`):**
  1. Paints all `256`-unit ground chunks across `0..1800 × 0..2200` via `GroundPainter.get(cx, cy)`.
  2. Invokes the live engine `Renderer.draw(sim, { x: 900, y: 1100, zoom: 0.5 }, tod, 2.4)` at both **Golden Hour (`t=0.18`)** and **Blue Dusk (`t=0.90`)**, producing `900×1100 px` (`0.5 px/wu`) true engine overviews (`palm-map-golden-clean.webp`, `palm-map-dusk-clean.webp`) carrying real brush dabs, crosswalks, ocean shimmer, baked `_sh.webp` cast shadows, `bld_*.webp` roofs, and `_night.webp` additive neon/lamp glow.
  3. Composites `#210f2e`-inked painted signage plaques with clean leader ticks on clustered markers so all 18 places/jobs/events read cleanly at `420×860` phone scale.

---

## 2. Exact Aspect, Scale & Frame Metrics (`src/map.js` Compatibility)

- **World Bounds:** `1800 × 2200 wu` (`aspect = 9 : 11 = 0.81818`).
- **Baked Map Sheet Size:** **`900 × 1100 px`** (`0.5 px / wu`, exact `1 : 1` world aspect; `~2.27×` Retina oversampling inside `mapFrame(420, 860, world)` where `F.w = 396`, `F.h = 484`).
- **`toMap(F, wx, wy)` Preserved Unchanged:** `F.x + wx * F.k`, `F.y + wy * F.k`.

---

## 3. One-Step WIRING Note for Fable (`src/map.js`)

1. Copy `after/palm-map-golden-clean.webp` and `after/palm-map-dusk-clean.webp` into `games/palm-city/assets/` (e.g. `map_golden.webp`, `map_dusk.webp`).
2. In `CityMap.build()` / `draw()`, draw the pre-baked `900×1100` WebP (crossfading `map_golden` -> `map_dusk` by `smooth(0.45, 0.90, tod)`) directly into `(F.x, F.y, F.w, F.h)` instead of running the per-pixel `surfaceAt` halftone loop — faster load, zero halftone artifacts, 100% painted parity with play.
3. Replace plain `strokeText`/`fillText` POI labels with `#210f2e`-bordered painted plaques and deconflicted offsets (`WRECK IT!` north of `SKATE PARK`, `VALET` south of `POLICE`, `TOW`/`BUS` split left/right).

---

## 4. Bake-Off Sheets (`420×860` Phone Scale)

- [bakeoff-map-golden-phone.png](./bakeoff-map-golden-phone.png)
- [bakeoff-map-dusk-phone.png](./bakeoff-map-dusk-phone.png)
- **Rebuild:** `node tools/build_map_redo.mjs` (from `games/palm-city/`)
