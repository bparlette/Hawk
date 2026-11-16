# Palm City — Gemini v2 Look Merge & Asset Pipeline

> **Created by Gemini (v2).**  
> Built on top of **Fable's original v1 Palm City architecture and scripts** ([tools/bake_sprites.py](tools/bake_sprites.py), [BUILD-NOTES.md](BUILD-NOTES.md), [layout.json](layout.json), [src/main.js](src/main.js), [src/sim.js](src/sim.js)). All of Fable's original tool scripts remain untouched; Gemini v2 tooling lives in separate `*_v2` scripts alongside the merged runtime modules (`src/ground.js`, `src/render.js`).

---

## Summary: What Changed from Fable v1 -> Gemini v2

| Layer | Fable v1 (Original) | Gemini v2 (Merged) | Where |
|---|---|---|---|
| **Sprite Painterly Finish** | Kuwahara (`r=1..2`) + subtle plum ink (`0.55`, `[0.16, 0.08, 0.2]`) | **3-stage `paint_finish()`**: Kuwahara (`r=2..3`) → **structure-tensor `oriented_stroke_pass`** (tangent oil-dab smear + cross-stroke impasto ridge relief + `1.14` chroma lift) → crisp dark-plum ink (`0.68..0.76`, `[0.13, 0.06, 0.18]`) | [tools/bake_sprites_v2.py](tools/bake_sprites_v2.py) |
| **Buildings (all 15)** | Pale pastel roofs (`#f4e6c8`..), muted skylights (`0.35`), harsh curb `string_lights` bulb rows on several facades | **Deepened coastal palette** (`#e0825c`, `#58b4a0`, `#d96e8c`, `#e8a258`, `#685ca6`, `#3c629c`), **saffron skylights** (`(1.0, 0.44, 0.03)` @ `glow=0.92`), rooftop storytelling (`garden_bed`, `cafe_umbrella`, `patio_set`, `clothesline`, helipad rings, garage cyan/cobalt awning stripes), and soft `point_light` marquee/facade washes (no blown-out bulb rows) | [tools/bake_sprites_v2.py](tools/bake_sprites_v2.py) |
| **Cars (10 models, 32 angles)** | `coat=0.9, rough=0.32`, single roof highlight bar | **High-gloss clearcoat** (`coat=1.0, rough=0.22, spec=0.85`), deeper saturated pigments, **dual-ribbon roof + blue-tinted windshield glints** (`hl` + `w_glint`), `paint_finish(kuw_r=2, stroke_r=2, stroke_s=0.28)` | [tools/bake_sprites_v2.py](tools/bake_sprites_v2.py) |
| **Props** | `palm0..2`, `bush0..3` lighter olive palette + Kuwahara `2` | Richer frond greens (`#32762e` / `#6ea83e`), multi-bloom `bush0..3` foliage (`kuw_r=3, stroke_s=0.32`), `paint_finish` across static props | [tools/bake_sprites_v2.py](tools/bake_sprites_v2.py) |
| **Peds & Framing & Board** | `PED_SCALE=2.4` (`16` angles), zoomed-out camera, `board` `S=2.4` | **Kept unchanged from Fable v1** (`ped_*.webp` & `src/main.js` untouched; owner rejected slice's `1.7x` peds/zoom) | [tools/bake_sprites.py](tools/bake_sprites.py) |
| **Ground Texture** | Single-pass noise + random dab orientation on `512x512` chunks | **Curl-field two-pass impasto** brushwork (`curlAngle()`, `CELL=32, PER=86`), cross-chunk deterministic border seeding, shadow under-ridges, edge glints, terracotta mosaic pavers, boardwalk planks, wind-carved sand swirls, neutral warm road/parking albedos (eliminating golden-hour lavender cast), wet gutter troughs, scalloped surf | [src/ground.js](src/ground.js) |
| **Time-of-Day Grade & Reflections** | Single scene multiply + dotted wet reflections + `lighter` bloom | **Split ground vs roof grade** (`mul` vs `roofMul` via `preMul`) so dusk drops streets to midnight `[24, 38, 108]` while preserving roof/skylight chroma; **warm-brown golden-hour shadows** (`shadowCol: [108, 68, 56]`) and coral-amber middle (`t=0.55`) without early plum slide; **scanline-rippled continuous wet-street reflections**, softened `drawNeonPuddles`, `'screen'` bloom (`0.24`/`0.22`), `1400`-stroke surface grain | [src/render.js](src/render.js) |

---

## v2 Scripts Created by Gemini

| Script | Purpose | Leaves Fable v1 untouched? |
|---|---|---|
| [tools/bake_sprites_v2.py](tools/bake_sprites_v2.py) | Gemini v2 Blender baker (`buildings`, `cars`, `props`) producing all upgraded `assets/*.webp` sheets (`< 2048px`) and updating `assets/manifest.json` | Yes — Fable's original [tools/bake_sprites.py](tools/bake_sprites.py) is preserved |
| [tools/compare_shots_v2.mjs](tools/compare_shots_v2.mjs) | Captures golden-hour road RGB telemetry and stitches side-by-side before/after PNGs (`shots/merge-compare-*.png`) | Yes — Fable's `tools/shot.mjs` and test scripts are untouched |

---

## How the Visual Improvements Work

### 1. Painterly Sprite Finish (`paint_finish` in [tools/bake_sprites_v2.py](tools/bake_sprites_v2.py))
Fable's v1 baker applied isotropic Kuwahara smoothing followed by `[0.16, 0.08, 0.2]` ink. At game zoom, large roofs still read slightly smooth/CGI:
- **`oriented_stroke_pass()`**: Computes smoothed luminance gradients `(gx, gy)`, derives tangent vectors `(-gy, gx) / mag`, averages color samples along the surface contour (`rad=2..3`), adds an impasto ridge relief term `(lum - lum_normal) * 0.45`, and boosts saturation `1.14x`.
- **`ink()`**: Deepened plum silhouette + internal crease ink (`[0.13, 0.06, 0.18]`) so vehicles, palms, and parapets hold crisp hand-painted edges even under dusk multiply.

### 2. Fixing Golden Hour vs. Keeping Slice Dusk ([src/render.js](src/render.js) + [src/ground.js](src/ground.js))
- **Why the slice read like dusk at golden hour**: The slice used `#14194a` shadow multiply at `t=0.1`, a dark purple road base `[58, 54, 102]`, a purple east soft-light stop, and jumped to plum by `t=0.65`.
- **v2 Merge Fix**:
  - `KEYS` in `src/render.js` separates `shadowCol`, `vigCol`, `vigAlpha`, and `eastGlow` per time keyframe: `t=0.0..0.35` uses warm-brown shadows (`[108, 68, 56]`), bright golden `mul`/`roofMul`, peach east soft-light (`[248, 162, 112]`), and low baseline `neon` (`0.02`), transitioning cleanly through warm sunset coral (`t=0.55`) before midnight indigo dusk (`t=0.86..1.0`).
  - `PAL.road` (`[82, 76, 86]`) and `PAL.parking` (`[62, 58, 66]`) in `src/ground.js` use neutral warm slate dabs instead of lilac/blue-heavy road colors so open sunlit intersections stay warm taupe at `t=0.1` instead of turning lavender.
  - Dusk (`t=0.96`) keeps the slice's split `preMul = mul / roofMul` pass so asphalt plunges to `[24, 38, 108]` while buildings keep `[108, 120, 198]` chroma, making saffron skylights and `NOVA` neons pop cleanly.

### 3. Chunked Curl-Field Ground ([src/ground.js](src/ground.js))
Instead of baking a giant static plate, Gemini v2 embeds the slice's curl-following brushwork into Fable's streaming `512x512` (`CHUNK=256`, `PX_PER_UNIT=2`) chunk cache:
- `CELL=32` deterministic world-space stroke cells iterate neighbor borders (`[k0..k1]`) and advance the PRNG identically on skip so strokes cross chunk seams seamlessly.

---

## Reproduce / Re-Bake Commands (from `games/palm-city/`)

```bash
# Re-bake v2 assets in Blender (leaves peds untouched at v1 scale)
/opt/homebrew/bin/blender -b -P tools/bake_sprites_v2.py -- buildings
/opt/homebrew/bin/blender -b -P tools/bake_sprites_v2.py -- cars
/opt/homebrew/bin/blender -b -P tools/bake_sprites_v2.py -- props

# Capture screenshots & generate side-by-side comparisons
node tools/shot.mjs shots/merge-after-golden.png "cam=1240,1240&t=0.1" --wait 4000
node tools/shot.mjs shots/merge-after-dusk.png   "cam=1035,1275&t=0.96" --wait 4000
node tools/shot.mjs shots/merge-after-mid.png    "cam=1240,1240&t=0.5" --wait 4000
node tools/compare_shots_v2.mjs

# Run Fable's verification & profiler suites
node tools/sim_run.mjs 34
node tools/skate_check.mjs
node tools/touch_check.mjs
node tools/profile.mjs
```
