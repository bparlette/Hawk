# Palm City — Destruction Production Sprite Sheets (`SPRITES.md`)

Game-ready individual transparent WebP sprites (`cwebp -q 90 -alpha_q 100`) split cleanly at Palm City's live scale (`UPM = 10`, `2 px` per world unit) directly from the merged `assets/car_*.webp` (`k = 24` North-facing `-π/2` cell) and `assets/palm0.webp` sources, matching [DESTRUCTION-DELTA.md](../DESTRUCTION-DELTA.md) and the approved `destruction-target-*.png` look targets.

Total exported files: **`63`** (`40` vehicle states + `3` palm states + `4` bench states + `4` skate rail states + `12` pooled debris assets). Zero game code edits.

---

## 1. Vehicles — 10 Models × 4 Damage Stages (`40` Files)

**Files:** `car_<model>_s<0..3>.webp` for all `10` models:
`sedan_coral`, `sedan_teal`, `sedan_cream`, `sedan_plum`, `conv_mint`, `conv_rose`, `van_sky`, `van_sun`, `taxi`, `police`.

- **Pixel Dimensions:** `128 × 128 px` each (`source-over`, transparent background)
- **World Metrics & Anchor:** `w: 64.0, h: 64.0, ox: -32.0, oy: -32.0` (North-facing `-π/2` local orientation — rotate at draw time via `g.rotate(car.h + Math.PI / 2)` so it overlays or replaces the base car cell cleanly)

| Stage | Suffix | Threshold (`DESTRUCTION-DELTA.md`) | Visual & Model-Specific Details |
| :--- | :--- | :--- | :--- |
| **Stage 0 (Intact)** | `_s0` | `dmg < 0.25` | Exact North-facing cell (`k = 24`) from merged `assets/car_<model>.webp`. |
| **Stage 1 (Scuff & Dent)** | `_s1` | `0.25 <= dmg < 0.60` | Asymmetric front-right fender cave-in, metallic primer streaks, darkened right headlight, hairline windshield crack. `police`: cracked right blue lightbar prism. `taxi`: scuffed sign corner. |
| **Stage 2 (Cracked / Bent)** | `_s2` | `0.60 <= dmg < 0.99` | Longitudinal crush + lateral chassis S-bend with `#210f2e` re-inked contour, hood soot corner, askew detached front chrome bumper. **Model rules:** `van_sky`/`van_sun`/`conv_*` show **windshield-only cracks**; `sedan_*` add rear glass cracks; `taxi` shows **skewed off-axis roof sign**; `police` shows **cracked/split red-blue lightbar**. |
| **Stage 3 (Crumpled Wreck)** | `_s3` | `dmg >= 1.0` | Charred crumpled accordion body keeping ~28–34% base paint pigment so families stay distinguishable, hollowed dark glass cavities + fracture stars, 3 splayed rubber tires, detached bumper bar, and warm hood engine ember (`#ffcf5c` -> `#ff761c`). Pair underneath with `debris_ash_scorch.webp`. |

---

## 2. Trees & Street Props (`11` Files)

| Sprite File | Dimensions (px) | World Metrics (`w`, `h`, `ox`, `oy`) | Stage / Threshold | Notes for Fable |
| :--- | :--- | :--- | :--- | :--- |
| `palm_s1.webp` | `184 × 184` | `w: 92, h: 92, ox: -46, oy: -46` | **Palm Stage 1** (`0.35 <= dmg < 1.0`) | Leaned/ruffled `palm0.webp` crown with notched brown tips & collar crack. |
| `palm_s2.webp` | `256 × 184` | `w: 128, h: 92, ox: -18, oy: -46` | **Palm Stage 2** (Fallen trunk + crown) | **Anchor `(0, 0)` sits at the split stump center** (`px = 36, py = 92`) extending East `+X`; rotate canvas by impact angle `hitAngle` so the fallen trunk lands away from collision! |
| `palm_s3_stump.webp` | `128 × 128` | `w: 64, h: 64, ox: -32, oy: -32` | **Palm Stage 3** (Permanent stump + fronds) | Heartwood split stump (`#ddb47e` / `#6c4428`) + 3 scattered leaflets. |
| `bench_s0.webp` | `96 × 64` | `w: 48, h: 32, ox: -24, oy: -16` | **Bench Stage 0** (`dmg < 0.25`) | Intact 3-slat park bench matching `render.js` wood bench palette + cast-iron legs. |
| `bench_s1.webp` | `96 × 64` | `w: 48, h: 32, ox: -24, oy: -16` | **Bench Stage 1** (`0.25 <= dmg < 0.65`) | Jagged center plank fracture & `~4.5°` skew. |
| `bench_s2.webp` | `96 × 64` | `w: 48, h: 32, ox: -24, oy: -16` | **Bench Stage 2** (`0.65 <= dmg < 1.0`) | Snapped clean into 2 angled halves with pale `#e4ba88` splintered ends. |
| `bench_s3.webp` | `96 × 64` | `w: 48, h: 32, ox: -24, oy: -16` | **Bench Stage 3** (`dmg >= 1.0`) | Criss-crossed pile of 4 short plank shards (non-blocking). |
| `rail_s0.webp` | `160 × 64` | `w: 80, h: 32, ox: -40, oy: -16` | **Skate Rail Stage 0** (`dmg < 0.25`) | Intact chrome rail segment (`~64 wu` span, `#dde4ef` + `#210f2e` ink). |
| `rail_s1.webp` | `160 × 64` | `w: 80, h: 32, ox: -40, oy: -16` | **Skate Rail Stage 1** (`0.25 <= dmg < 0.65`) | Mid-span inward bow + center stress crack (disable grind above `0.6`). |
| `rail_s2.webp` | `160 × 64` | `w: 80, h: 32, ox: -40, oy: -16` | **Skate Rail Stage 2** (`0.65 <= dmg < 1.0`) | Snapped cleanly into two offset angled chrome tubes. |
| `rail_s3.webp` | `160 × 64` | `w: 80, h: 32, ox: -40, oy: -16` | **Skate Rail Stage 3** (`dmg >= 1.0`) | 3 scattered bent chrome scrap tubes. |

---

## 3. Pooled Debris Set (`12` Files — Zero-Allocation Ring Pool)

All debris items share centered anchors (`ox: -w/2, oy: -h/2`) for Fable's `max 160` ring-buffer debris pool:

| Sprite File | Dimensions (px) | World Metrics (`w × h`) | Debris Pool Category | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `debris_glass_1.webp` | `32 × 32` | `16 × 16` (`ox: -8, oy: -8`) | `glass` | Triangle windshield shard w/ specular edge glint |
| `debris_glass_2.webp` | `32 × 32` | `16 × 16` (`ox: -8, oy: -8`) | `glass` | Chunky polygon lamp/window glass shard |
| `debris_glass_3.webp` | `32 × 32` | `16 × 16` (`ox: -8, oy: -8`) | `glass` | Narrow acute windshield wedge shard |
| `debris_wood_1.webp` | `48 × 32` | `24 × 16` (`ox: -12, oy: -8`) | `wood` | Broken bench / café crate plank w/ splintered tip |
| `debris_wood_2.webp` | `48 × 32` | `24 × 16` (`ox: -12, oy: -8`) | `wood` | Detached green palm leaflet |
| `debris_wood_3.webp` | `32 × 32` | `16 × 16` (`ox: -8, oy: -8`) | `wood` | Bark / wood wedge splinter |
| `debris_metal_1.webp` | `48 × 32` | `24 × 16` (`ox: -12, oy: -8`) | `metal` | Detached chrome bumper trim strip |
| `debris_metal_2.webp` | `32 × 32` | `16 × 16` (`ox: -8, oy: -8`) | `metal` | Buckled dark hood / fender panel chip |
| `debris_metal_3.webp` | `32 × 32` | `16 × 16` (`ox: -8, oy: -8`) | `metal` | Shattered police red/blue lightbar cap shard |
| `debris_tire_1.webp` | `32 × 32` | `16 × 16` (`ox: -8, oy: -8`) | `tire` | Knocked-loose complete tire + rim |
| `debris_tire_2.webp` | `32 × 32` | `16 × 16` (`ox: -8, oy: -8`) | `tire` | Torn rubber tread arc (spike strip / blowout) |
| `debris_ash_scorch.webp` | `128 × 128` | `64 × 64` (`ox: -32, oy: -32`) | `scorch` | Ground soot stain stamped underneath Stage-3 wrecks |
