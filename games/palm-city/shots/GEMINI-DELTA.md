# Palm City — Look Enhancement Delta Spec (Gemini)

This document specifies the exact visual and implementation changes between the live build captures ([v2-paint-golden.png](v2-paint-golden.png), [v2-paint-dusk.png](v2-paint-dusk.png)) and the reference-anchored target frames ([gemini-target-golden.png](gemini-target-golden.png), [gemini-target-dusk.png](gemini-target-dusk.png)), closing the 5 gaps identified in [`../BUILD-NOTES.md`](../BUILD-NOTES.md) against [`../tools/reference_frames.jpg`](../tools/reference_frames.jpg).

All target images preserve the exact `420×860` mobile viewport, ortho-oblique camera, world layout, entity placement, and translucent HUD overlay (`src/hud.js`). Side-by-side comparisons are in [gemini-compare-golden.png](gemini-compare-golden.png) and [gemini-compare-dusk.png](gemini-compare-dusk.png).

---

## 1. Brushwork Too Timid (Ground, Ocean, Sprites & Canvas Tooth)

**Problem in current build:** Ground chunks read as faint pastel speckles (`ALPHA 0.2–0.3`), ocean waves read as flat stepped bands, and vehicle/building sprites use light `kuwahara(..., 1..2)` smoothing that vanishes at mobile zoom.

### 1.1 Curl-Following Impasto Ground Pass (`src/ground.js`)
Replace isotropic random stroke orientation in **Pass 2** (`CELL = 32`, `CPX = 512`) with a continuous multi-octave streamfunction curl field `θ(x, y) = atan2(∂ψ/∂x, -∂ψ/∂y)` (plus shoreline tangent alignment on `water` and `sand`, and lane/curb axis flow on `road`) with doubled stroke mass:

| Surface (`PAL`) | Current (`src/ground.js` L100–128) | Target Delta |
|---|---|---|
| Global density (`PER`) | `PER = 54` per `32px` cell | Increase to **`PER = 84`** (or keep `54` at `CELL = 24`) |
| `road` / `parking` | `len = 8 + r2*12`, `wid = 4 + r3*4`, `a = 0.22 + r4*0.26`, random angle | **`len = 12 + r2*18`**, **`wid = 5 + r3*5`**, **`a = 0.34 + r4*0.30`**, angle `θ_road ± 0.22 rad` biased along avenue axis with deep cobalt/violet stroke variety |
| `water` | `len = 10 + r2*18`, `wid = 4 + r3*4`, `a = 0.30 + r4*0.30` | **`len = 16 + r2*26`**, **`wid = 5 + r3*6`**, **`a = 0.45 + r4*0.38`**, S-curve swirl ribbons following shoreline normal + foam highlight ribbons (`#f4ead2`, `#bfe6ec`) along wave crests |
| `sand` | `len = 6 + r2*10`, `wid = 4 + r3*4`, `a = 0.22 + r4*0.25` | **`len = 10 + r2*16`**, **`wid = 5 + r3*5`**, **`a = 0.36 + r4*0.30`**, dune-contour swirls mirroring the shoreline curve with warm ochre/saffron highlights (`#f8d88a`, `#d69850`) |
| `grass` / `other` | `len = 6 + r2*9`, `wid = 4 + r3*5`, `a = 0.20 + r4*0.24` | **`len = 9 + r2*14`**, **`wid = 5 + r3*6`**, **`a = 0.32 + r4*0.32`**, multi-pass dry-brush ridges on boardwalk planks and plaza pavers |

### 1.2 Screen-Space Canvas Paint Tooth (`src/render.js`)
In `buildGrain()` (`src/render.js` L60–73):
- Increase tile strokes on the `256×256` grain canvas from `900` (`L = 4..14`, `lw = 1.5..4`, `a = 0.25..0.60`) to **`1400` directional impasto strokes** (`L = 6..18`, `lw = 2.0..5.0`, `a = 0.30..0.65`).
- Raise `soft-light` composite opacity in `draw()` from `globalAlpha = 0.22` to **`0.30`**.

### 1.3 Stronger Kuwahara & Ink Pass on Baked Sprites (`tools/bake_sprites.py`)
- Upgrade `kuwahara(img, r)` radius at bake call sites:
  - Cars & pedestrians (`lines 600, 731`): `r = 1` → **`r = 2`** (`5×5` sector window).
  - Buildings (`line 1264`): `r = 2` → **`r = 3`** (`7×7` sector window, optionally oriented along structure tensor gradient).
- Strengthen `ink()` contour weight on architectural edges, palms, AC units, umbrellas, and vehicles from `0.5..0.6` (`luma < 0.2..0.25`) to **`0.72..0.78`** (`luma < 0.28`) so edges read cleanly at `420×860`.

---

## 2. Dusk Is Hazy, Not Deep (Midnight Palette & Rooftop Separation)

**Problem in current build:** At dusk (`t = 1.00`), `KEYS.mul = [74, 80, 162]` washes the scene into flat grey-lavender (`v2-paint-dusk.png`), muting rooftop color while leaving cast shadows faint (`shadow = 0.24`).

### 2.1 Deep Ultramarine Night Grade (`src/render.js`)
Update `KEYS` (`src/render.js` L18–24) and shadow/vignette multipliers:

| Keyframe / Param | Current (`src/render.js`) | Target Delta |
|---|---|---|
| `KEYS[t=0.70]` | `mul: [168, 128, 186]`, `warm: 0.20`, `shadow: 0.40` | `mul: [138, 108, 182]`, `warm: 0.22`, `shadow: 0.56` |
| `KEYS[t=0.85]` | `mul: [112, 106, 182]`, `warm: 0.08`, `shadow: 0.26` | **`mul: [52, 68, 148]`**, `warm: 0.05`, **`shadow: 0.44`** |
| `KEYS[t=1.00]` | `mul: [74, 80, 162]`, `warm: 0.04`, `shadow: 0.24` | **`mul: [24, 38, 108]`**, **`warm: 0.02`**, **`shadow: 0.42`** |
| Shadow multiply tint | `#3e3488` | **`#14194a`** (deep prussian indigo) |
| Vignette | `rgba(20, 10, 40, 0.35 + 0.2*t)` | **`rgba(8, 12, 38, 0.42 + 0.28*t)`** |

### 2.2 Preserve Roof Chroma & Boost Hot Saffron Windows (`src/render.js`, `tools/bake_sprites.py`)
- **Split grade weighting:** Apply the full `[24, 38, 108]` midnight multiply to `ground` and road planes, while compositing upper building layers (`bld_*`) with a lifted-chroma night tint (**`[96, 110, 192]`**, `+0.18` saturation retention) so dusk roofs (ultramarine `office`, plum `NOVA` terrace, emerald/cobalt `shops` striped awnings) hold crisp color contrast against the near-black street.
- **Emissive window temperature & output (`tools/bake_sprites.py`):**
  - `office` `skylights(..., glow=0.3)` (`line 1154`) → **`glow=1.1`**, shifted warmer to saffron-gold `(1.0, 0.76, 0.28)`.
  - `office` `glassroof` `night=0.45` (`line 1146`) → **`night=0.95`**, warm amber `(1.0, 0.68, 0.28)`.
  - Raise `G.windows` intensity curve ceiling (`src/render.js` L28) from `0.8` to **`1.05`**.

---

## 3. Wet-Asphalt Reflections Are Dotted (Continuous Rippled Mirror Strips)

**Problem in current build:** `drawWetReflections()` (`src/render.js` L463–478) renders `i = 0..6` discrete vertical ellipses per reflector, appearing as isolated teardrops/dots. Simultaneously, `string_lights(..., night=40.0)` (`tools/bake_sprites.py`) bakes into a clipped white bead row under `NOVA`.

### 3.1 Replace Dotted Ellipses With Scanline-Sliced Wavy Mirror Columns (`src/render.js`)
In `drawWetReflections()` (`src/render.js` L458–482):
1. Replace the `for (let i = 0; i < 7; i++)` discrete `ellipse()` loop with **`2px` horizontal scanline slices** spanning `y ∈ [0, r.len]` down-screen from each reflector.
2. Perturb each slice by a dual-frequency ripple offset:
   - `dx(y) = A * sin(y * 0.42 + phase + time * 2.4) + 0.45 * A * sin(y * 0.95 - time * 1.7)` (`A ≈ 3.5..6.5 px` scaled by `dist / r.len`)
   - Width jitter `sliceW(y) = baseW * (0.45 + 0.55 * sin²(y * 0.31 + phase)) * (1 - 0.55 * (y / r.len))`
   - Alpha decay `α(y) = peakAlpha * exp(-1.6 * y / r.len)` (`peakAlpha ≈ 0.55` for signs, `0.48` for streetlamps)
3. Multiply-mask reflected slices by asphalt dark puddle mask so reflections shimmer inside wet tire ruts while breaking cleanly at lane paint and dry curb edges.

### 3.2 Upgrade Reflector Sources (`src/render.js` L446–456, `tools/bake_sprites.py`)
- Increase `buildReflectors()` streak reach: lamps `len: 70 → 120` (color `#ffb256`), signs `len: 95 → 130`, and allow multi-band storefront reflectors (magenta `#ff4fd8`, gold `#ffbf5c`, cyan `#3fe0ff`) where club/shop facades face south across the wet street.
- In `tools/bake_sprites.py`: lower `string_lights` emissive strength from `night=40.0` (`line 964`) down to **`night=3.5`** with warm bulb color `#ffcf86`, and remove the road-facing curb string row on `club` (`line 1171`) so it no longer forms a dotted white line cutting off reflections.

---

## 4. Bloom Has No Falloff (Eliminate White Additive Clipping)

**Problem in current build:** Overlapping additive `'lighter'` quads in `lg` + `bloomA (1/4 @ 0.20)` + `bloomB (1/8 @ 0.32)` sum straight past `RGB (255, 255, 255)`, creating hard white rectangles (especially under `NOVA`).

### 4.1 Chromaticity-Preserving Soft-Knee Bloom (`src/render.js` L305–346)
1. **Multi-stop radial falloff:** Build radial light sprites with explicit exponential intermediate stops (`0.00 -> α*0.75`, `0.30 -> α*0.38`, `0.60 -> α*0.12`, `0.85 -> α*0.03`, `1.00 -> 0`) instead of linear fade, avoiding flat plateau saturation where radii overlap.
2. **Soft-knee / chromaticity clamp before final composite:** After accumulating `lg` (half-res light buffer) and blurring `bloomA` / `bloomB`, apply a chromaticity-preserving Reinhard shoulder per pixel (`out = c / (1 + lum / L_knee)` with `L_knee = 0.85`) or lower bloom gain (`bloomA`: `0.20 -> 0.18`, `bloomB`: `0.32 -> 0.16`) and composite the secondary wide bloom (`bloomB`) via **`'screen'`** instead of `'lighter'`.
3. **Result:** Stacked club/shop/lamp lights retain vivid magenta, cyan, and warm-amber hues right up to their bright cores without blowing out to white.

---

## 5. Roofs Need Story & Variety (`tools/bake_sprites.py`)

**Problem in current build:** Flat gravel roofs (`#b8a898`, `#d8d2ca`, `#9ea0a8`) and pale `PASTEL` walls look interchangeable and lifeless at game zoom.

### 5.1 Material & Color Contrast (`tools/bake_sprites.py`)
- Deepen `PASTEL` and roof albedo sets (`lines 830, 1070–1071, 1100–1101, 1122, 1145`):
  - Replace washed greys (`#9ea0a8`, `#b8a898`) with rich terracotta clay (`#c85232`), cedar deck plank tones (`#9e5c30`), saturated cobalt/indigo slate (`#2a4478`), warm sandstone (`#d6a878`), and coral stucco (`#e07a5f`).
  - Strengthen awning contrast on `shops` (`line 1072`) to bold emerald-teal & ultramarine (`#169e82`, `#1f3f96`) visible both in golden hour and deep dusk.

### 5.2 Game-Zoom Rooftop Props (`build_building()` L1044–1248)
- **Residential (`apartment` / golden-hour middle blocks):** Add dual-material roofs (ribbed terracotta tile slope + timber terrace deck), catenary clotheslines strung with saturated laundry rectangles (`#f5f0e6`, `#d94f3d`, `#4a88c7`, `#f2c14e`), dense dark-emerald planter beds with colorful blooms, and a rooftop palm corner.
- **Cafe / `shops` terraces:** Add faceted octagonal sun umbrellas (`#e8a87c`, `#f4d58d`), clustered wooden bistro tables/chairs, and distinct bold-inked HVAC manifolds.
- **`office` / evening blocks:** Frame the helipad (`#3a3c46`), dark cobalt slate membrane, lush pocket courtyard gardens lit from within (`night = 1.2`), and warm golden `3×3` `skylights` grid.
- **`club` (`NOVA`):** Add organized lounge furniture groups (round tables, chairs, potted palms) around the clean glowing `NOVA` centerpiece (`#ff48d8`), removing raw box clutter and blown-out string-light beads.

---

## Deliverable Verification Checklist

- [x] `games/palm-city/shots/gemini-target-golden.png` — `420×860` PNG, exact camera/layout/HUD (`6:45 PM`), dense swirling impasto, coastal waves, terracotta/laundry/umbrella rooftop story.
- [x] `games/palm-city/shots/gemini-target-dusk.png` — `420×860` PNG, exact camera/layout/HUD (`7:45 PM`), deep midnight blues against hot saffron windows, striped mirror wet-asphalt reflections, zero clipped white bloom.
- [x] `games/palm-city/shots/gemini-compare-golden.png` — Side-by-side before/after (`v2-paint-golden.png` vs `gemini-target-golden.png`).
- [x] `games/palm-city/shots/gemini-compare-dusk.png` — Side-by-side before/after (`v2-paint-dusk.png` vs `gemini-target-dusk.png`).
- [x] `games/palm-city/shots/GEMINI-DELTA.md` — Implementable engineering spec covering all 5 gaps.
