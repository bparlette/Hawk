# Palm City — Sky + Street Pressure Production Sprite Sheets (`SPRITES.md`)

Game-ready Blender renders (`UPM = 10`, matching `games/palm-city/assets/manifest.json` scale and `32`-angle clockwise indexing `k = Math.round(h / (2π) * 32) % 32`) with Kuwahara flattening, structure-tensor impasto strokes, and `#1a0f2e` (`[0.10, 0.06, 0.18]`) plum contour ink matching the merged Moth slice.

All files are transparent WebP (`cwebp -q 90 -alpha_q 100`, strictly `< 2048 px`).

---

## Asset Manifest & Integration Spec

| Sprite File | Dimensions (px) | Grid (`cols × rows`) | World Metrics (`w`, `h`, `ox`, `oy`) | Variant / Blend | Fable System (Task 5) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `chopper_body.webp` | `1536 × 768` | `8 × 4` (`32` angles, `192×192` cell) | `w: 96, h: 96, ox: -48, oy: -48` | Day/Golden · `source-over` | **Chopper** fuselage (`h` = flight heading) |
| `chopper_body_dusk.webp` | `1536 × 768` | `8 × 4` (`32` angles, `192×192` cell) | `w: 96, h: 96, ox: -48, oy: -48` | Dusk/Night · lit nose & tail beacon · `source-over` | **Chopper** fuselage (`t >= 0.55`) |
| `chopper_rotor.webp` | `192 × 192` | `1 × 1` (single centered disc) | `w: 96, h: 96, ox: -48, oy: -48` | Day/Golden · translucent · rotate `time * 18 rad/s` | **Chopper** rotor overlay (`hub = chopper pos`) |
| `chopper_rotor_dusk.webp` | `192 × 192` | `1 × 1` (single centered disc) | `w: 96, h: 96, ox: -48, oy: -48` | Dusk/Night · cool cyan tip blur · `source-over` | **Chopper** rotor overlay (`t >= 0.55`) |
| `chopper_shadow.webp` | `128 × 128` | `1 × 1` (soft altitude blob) | `w: 128, h: 128, ox: -64, oy: -64` | Shadow · rotate by `chopper.h + π/2`, draw @ `0.28..0.42` α | **Chopper** altitude ground shadow (`pos + SHADOW_DIR * alt`) |
| `car_swat_van.webp` | `1024 × 512` | `8 × 4` (`32` angles, `128×128` cell) | `w: 64, h: 64, ox: -32, oy: -32` | Day/Golden · `4.9m × 2.02m` armored hull · `source-over` | **SWAT Van** (`4★–5★` roadblock / intercept) |
| `car_swat_van_dusk.webp` | `1024 × 512` | `8 × 4` (`32` angles, `128×128` cell) | `w: 64, h: 64, ox: -32, oy: -32` | Dusk/Night · darkened roof armor + lit bars · `source-over` | **SWAT Van** (`t >= 0.55`) |
| `car_swat_van_sh.webp` | `768 × 384` | `8 × 4` (`32` angles, `96×96` cell) | `w: 96, h: 96, ox: -36.41, oy: -51.11` | Shadow · exact `car_van_sky_sh.webp` parity | **SWAT Van** cast shadow |
| `car_swat_van_light.webp` | `56 × 176` | `1 × 1` (north-facing `+Y` cone) | `w: 70, h: 220, ox: -35, oy: -160` | Night additive · rotate `car.h + π/2` · `'screen'` | **SWAT Van** headlight & tail wash |
| `prop_sawhorse.webp` | `80 × 80` | `1 × 1` (static/rotatable barricade) | `w: 40, h: 40, ox: -20, oy: -20` | Day/Golden · orange/white stripe + beacon · `source-over` | **Roadblock Barricade** (Task 1 smash-through) |
| `prop_sawhorse_dusk.webp` | `80 × 80` | `1 × 1` | `w: 40, h: 40, ox: -20, oy: -20` | Dusk/Night · cooled frame + bright amber beacon | **Roadblock Barricade** (`t >= 0.55`) |
| `prop_sawhorse_sh.webp` | `83 × 83` | `1 × 1` (sun-offset shadow) | `w: 52, h: 52, ox: -26, oy: -26` | Shadow · draw before prop | **Roadblock Barricade** ground shadow |
| `prop_sawhorse_night.webp` | `96 × 96` | `1 × 1` (additive amber glow) | `w: 48, h: 48, ox: -24, oy: -24` | Night additive · `'screen'` (`alpha` pulse `sin(time*8)`) | **Roadblock Barricade** beacon flare |
| `prop_spike_strip.webp` | `96 × 48` | `1 × 1` (`4.0m × 0.8m` mat) | `w: 48, h: 24, ox: -24, oy: -12` | Day/Golden · yellow reel caps + 2 glints · `source-over` | **Spike Strip** hazard (`4★–5★`, Getaway) |
| `prop_spike_strip_dusk.webp` | `96 × 48` | `1 × 1` (`4.0m × 0.8m` mat) | `w: 48, h: 24, ox: -24, oy: -12` | Dusk/Night · cool steel stud contrast + 4 specular stars | **Spike Strip** hazard (`t >= 0.55`) |
| `prop_spike_strip_sh.webp` | `96 × 48` | `1 × 1` | `w: 48, h: 24, ox: -24, oy: -12` | Shadow · low-profile contact shadow | **Spike Strip** ground contact shadow |
| `cruiser_lightbar_32.webp` | `1024 × 512` | `8 × 4` (`32` angles, `128×128` cell) | `w: 64, h: 64, ox: -32, oy: -32` | Day strobe bloom · feathered `'screen'` · `alpha ~ 0.42` | **Roadblock / Pursuit Cruiser** split red/blue roof glow |
| `cruiser_lightbar_32_dusk.webp` | `1024 × 512` | `8 × 4` (`32` angles, `128×128` cell) | `w: 64, h: 64, ox: -32, oy: -32` | Dusk strobe bloom · wide radius `'screen'` · `alpha ~ 0.90` | **Roadblock / Pursuit Cruiser** dusk/night glow |
| `cruiser_lightbar_phases.webp` | `384 × 128` | `3 × 1` (`[both, red, blue]`, north-facing) | `w: 64, h: 64, ox: -32, oy: -32` | Day animated · rotate `car.h + π/2`, cycle phase `(time*7)|0 % 3` | **Animated Cruiser Strobe** (`'screen'`) |
| `cruiser_lightbar_phases_dusk.webp` | `384 × 128` | `3 × 1` (`[both, red, blue]`, north-facing) | `w: 64, h: 64, ox: -32, oy: -32` | Dusk animated · rotate `car.h + π/2` (`alpha ~ 0.90`) | **Animated Cruiser Strobe** (`t >= 0.55`) |

---

## Integration Notes for Fable

1. **Manifest Drop-In (`cars['swat_van']` & `props`):**
   - `car_swat_van*` shares exact cell dimensions (`64×64` wu color, `96×96` wu shadow with `ox=-36.41, oy=-51.11`, and `70×220` wu light cone with `ox=-35, oy=-160`) with `car_van_sky.webp`. Copy directly into `assets/` and add one `swat_van` block under `manifest.json -> cars`.
2. **Chopper Multi-Layer Draw Order:**
   - Draw `chopper_shadow.webp` in the ground shadow pass at `(chop.x + SHADOW_DIR.x * chop.alt, chop.y + SHADOW_DIR.y * chop.alt)` rotated by `chop.h + π/2`.
   - Draw volumetric spotlight cone (`'screen'`, `PRESSURE-DELTA.md`) beneath the fuselage.
   - Draw `chopper_body*.webp` (cell `k = Math.round(chop.h / (2π) * 32) % 32`) above buildings/trees, then `chopper_rotor*.webp` centered on the mast (`chop.x + cos(chop.h)*2.5`, `chop.y + sin(chop.h)*2.5`) spinning at `time * 18` rad/s.
3. **Zero Square Box Artifacts on Strobe Overlays:**
   - All `cruiser_lightbar_*` textures smoothly ramp radial alpha & RGB to `0.0` well inside the `128×128` cell boundary (`edge_r <= 0.72` -> smoothstep to `0` at `1.0`). Draw directly with `g.globalCompositeOperation = 'screen'` (no clipping needed).
4. **Roadblock Barricade Destruction Hook:**
   - `prop_sawhorse.webp` (`width = 24 wu`, shallow depth `6 wu`) breaks via Task 1 smash-through rules above `45%` vehicle speed with minor velocity graze (`~8%`) instead of halting a pursuit vehicle.
