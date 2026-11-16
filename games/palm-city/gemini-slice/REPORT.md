# Palm City — Gemini Asset Slice Report

Playable slice in [`gemini-slice/`](./) reproducing the promenade block (`office`, `NOVA` club, `garage`, west/east avenues, promenade, beach, shoreline, plus west-block `apartments` and `motel`), wired into a self-contained copy of the live game with `?demo`, `t = 0..1` day→dusk transitions, and zero fallback render paths.

## Side-by-Side Engine Captures (Same `?cam`, Same `?t`)

- **Golden Hour (`cam=1240,1240&t=0.1`):** [shots/compare-golden.png](shots/compare-golden.png) ([baseline](shots/base-golden.png) vs [slice](shots/slice-golden.png))
- **Blue Dusk (`cam=1035,1275&t=0.96`):** [shots/compare-dusk.png](shots/compare-dusk.png) ([baseline](shots/base-dusk.png) vs [slice](shots/slice-dusk.png))

---

## 1. Asset Inventory: Generated vs Reused

All generated assets are `.webp`, checked under the `< 2048 px` per-side phone cap (`117` WebP files checked, max single asset `1720×1980` and max sprite sheet width `1920`). Lighting stays locked to `layout.json` (`sun.azimuthDeg = 255`, `sun.elevationDeg = 30`).

| Group | Status in `gemini-slice/` | Details |
|---|---|---|
| **Buildings** | **Generated (5 slice buildings)** | `club` (`NOVA`), `office`, `garage`, `apartments`, `motel` (`_color`, `_sh`, `_night` in [tools/bake_slice.py](tools/bake_slice.py)). Rooftop terraces, cedar planters, clotheslines, umbrellas, bold emerald/cobalt stripes, saffron skylights, and removed south curb string-dots on `NOVA`. All other city buildings (`diner`, `hotel`, `police`, `shops`, houses, villas) are **reused**. |
| **Ground Plate** | **Generated (`ground_slice.webp`)** | `1720×1980` px WebP covering `x=680..1540, y=710..1700` at `2 px/unit` ([tools/gen_ground_slice.mjs](tools/gen_ground_slice.mjs) + structure-tensor stroke relief in `bake_slice.py`). Replaces procedural chunks inside the slice bounds (`src/render.js`). Procedural chunks are **reused** outside the slice during `?demo`. |
| **Cars** | **Generated (all 9 variants, 16 angles)** | Color, shadow, and headlight beams for all 9 vehicles (`conv_mint`, `conv_rose`, `sedan_*`, `van_*`, `taxi`, `police`) at 16 angles (`>= 8`) with dual clearcoat roof glints (`kuw_r=2`, plum ink contour). |
| **Palms & Bushes** | **Generated (`palm0..2`, `bush0..3`)** | All 3 palms and all 4 flowering bush variants re-baked with `kuw_r=3` + structure-tensor strokes and placed in slice promenade/plaza/dune clusters in `src/render.js` (`buildStatics()`). Props (`lamp`, `pier`, `board`, `fountain`, `lifeguard`, `hydrant`, `bench`, `trash`) are **reused**. |
| **People** | **Generated (`1.7×` size, 8 angles × 3 poses)** | All 7 outfits (`player`, `ped_straw`, `ped_rose`, `ped_blue`, `ped_white`, `ped_sun`, `cop`) baked at `1.7×` world scale (`66.3×66.3` vs `39×39`), 8 angles (`>= 4`), boosted `26°` stride, readable hats/caps/visors. |
| **Render Code** | **Modified in `gemini-slice/src/`** | Deep midnight `KEYS` (`[24, 38, 108]`), split `roofMul` (`[108, 120, 198]`) via ground pre-multiply `M_ground / M_roof`, `#14194a` shadows, boosted `buildGrain()` (`1400` strokes @ `0.30` alpha), scanline-rippled `drawWetReflections()` columns, softened `drawNeonPuddles()`, `'screen'` bloom composite. |

---

## 2. Where Assets Drift From the Baked-Light System

1. **Pre-darkened 2D Ground Plate (`ground_slice.webp`):** Because `ground_slice.webp` was painted in 2D Canvas from `World.surfaceAt()` / `curlAngle()` noise rather than rendered in Blender Cycles, its directional paint-stroke edge glints (`[-0.9, -0.7]` px) are only an approximate sun-side offset (`255°`) and carry zero ambient occlusion under building walls or benches. Its baked shadows rely entirely on the engine's `shadowCv` multiply layer (`#14194a`).
2. **Split Roof/Street Night Grade (`M_ground / M_roof`):** Multiplying the ground and shadows first by `M_pre = M_ground / M_roof` before drawing building/ped/car sprites and applying `M_roof` preserves vivid roof and skin chroma at dusk (`compare-dusk.png`), *but* visually disconnects ground cast shadows slightly from building wall shading at mid-twilight (`t = 0.65..0.85`): street shadows plunge toward deep ultramarine while cast-shadow emitters (buildings, lamps) stay brighter and warmer.
3. **Skylight Emissive Saturation Under Additive `'lighter'`:** Initial Cycles emission `(1.0, 0.78, 0.30)` at `night=1.35` clipped through AgX toward pale ivory-white on screen when added over lit concrete roofs; lowering linear green/blue emission to `(1.0, 0.44, 0.03)` at `night=0.92..0.95` was required so `'lighter'` compositing landed on hot saffron-yellow without white blowout.
4. **Slice Boundary & `?demo` Exit:** Leaving `(680..1540, 710..1700)` during `?demo` exposes an abrupt impasto transition where `ground_slice.webp` feathers back into baseline `GroundPainter` chunks (`demo_0`), and non-slice buildings like `DINER` (`demo_2`) still show their baseline pale roofs and white curb string-light dots.
5. **1.7× Pedestrians vs World Proportions & 8 Angles:** At `1.7×` (`66.3` units ≈ `6.6 m` frame), hats, shirts, and stride read unmistakably at mobile zoom both in golden hour and dusk, though characters now appear taller/wider relative to cars (`width: 19 u`, `length: 46 u`) and doorways. Cutting from `16` to `8` angles (`45°` steps) is clean on straight avenues/promenade walks, with visible angle popping when AI peds turn corners.

---

## 3. Honest Assessment: Does the Look Survive the Engine?

**Yes — inside the live `420×860` engine, the target look largely survives and genuinely transforms the game, with two concrete caveats:**

- **What survived cleanly at 1:1 scale:**
  - **Dusk depth vs roof chroma (`compare-dusk.png`):** The zero-allocation `M_pre * M_roof` split grade + `'screen'` bloom keeps `office`'s ultramarine membrane, `NOVA`'s pink/terracotta terrace, `garage`'s striped teal/cobalt canopy, and saffron skylights crisp against near-black indigo asphalt — solving both the hazy lavender wash and white additive blowout.
  - **Rippled street mirror streaks:** Replacing 7 discrete `ellipse()` calls and `NOVA`'s curb dot row with road-clipped sinusoidal scanline ribbons (`2.2 px` step) turned the `NOVA` corridor into continuous multi-band (magenta/gold/cyan) wet-asphalt reflections.
  - **Paint energy & figure readability (`compare-golden.png`):** Dense curl-following brushwork on the road, boardwalk planks, sand dunes, and turquoise surf holds together alongside the `1.7×` pedestrians and lush palm/bush clusters under real oblique sun shadows (`255° / 30°`) and full `?demo` gameplay (`sim_run.mjs` passed: `DEMO OK: jacked and busted`).
- **What needs real engineering before full-game rollout:**
  - `ground_slice.webp` (`1720×1980`) works only because it is bounded to one block (`< 2048 px` phone limit). Scaling the full city (`1800×2200` world = `3600×4400 px`) cannot use a single raster plate without breaking phone memory/texture rules — **the curl-field & two-pass impasto painter from `gen_ground_slice.mjs` should be ported directly into `src/ground.js`'s `512×512` `GroundPainter` chunk generator**, while `oriented_stroke_pass()` stays baked into all remaining `bake_sprites.py` assets.
