# Palm City — City Life Variety Wave 2 (`games/palm-city/shots/life-sprites/`)

**Audit Note:** Checked `assets/ped_*.webp`, `assets/car_*.webp`, and `tools/bake_sprites_v2.py` prior to baking (`ped_cop`, `ped_player`, `ped_ped_{blue,rose,straw,sun,white}` + `car_{conv_mint,conv_rose,police,sedan_coral,sedan_cream,sedan_plum,sedan_teal,taxi,van_sky,van_sun}`). None of the beach, business, night-crowd wave-2 outfits or these two paint variants existed yet, so all `11` production WebP sheets below were baked cleanly in Blender Cycles `5.2.3 LTS` via `bake_sprites_v2.py` at exact game metrics (`UPM=10`, `PED_SCALE=2.4`, Kuwahara paint pass + `#210f2e` dark-plum ink). Zero edits to live `assets/` or `manifest.json`.

**Generator script:** `/opt/homebrew/bin/blender -b -P games/palm-city/tools/build_life_wave2.py`

## 1. Pedestrian Variety Wave 2 (`6` Sets + Shared Shadow — `16` Angles × `3` Stride Poses)

All color sheets measure **`1032 × 344 px`** (`12 × 4` grid of `86 × 86 px` frames; world `w: 39.0, h: 39.0, ox: -19.5, oy: -19.5`) paired with shared **`ped_life_sh.webp`** (`1188 × 396 px`; world `w: 110.0, h: 110.0, ox: -20.23, oy: -64.32`).

| Theme Group | File | Palette & Wardrobe | Suggested District / Time Weight |
|---|---|---|---|
| **Beach** | `ped_beach_surfer.webp` | Turquoise rashguard `#32d6c8`, coral swim trunks `#ff6854`, blond hair + baseball `cap`, flip-flops | Beach boardwalk, pier & lifeguard promenade (all day) |
| **Beach** | `ped_beach_resort.webp` | Hibiscus-coral top `#ff5e82`, tan boardshorts `#e8c688`, sun `hat` (straw brim), sandals | Boardwalk strollers & pier tourists |
| **Business** | `ped_biz_suit.webp` | Tailored navy suit coat `#243456`, slate trousers `#1c2234`, dark oxfords | `office`, `police`, & downtown plaza morning/afternoon |
| **Business** | `ped_biz_exec.webp` | Cream linen summer suit `#f2e4cc`, teal slacks `#2f787e`, loafers | `hotel` (`SOLANA`), `shops`, & taxi VIP fares |
| **Night Crowd** | `ped_night_clubber.webp` | Electric magenta jacket `#ff3ea5`, dark midnight denim `#18162b`, white kicks | `NOVA` nightclub exterior & dusk-to-night sidewalks (`t >= 0.55`) |
| **Night Crowd** | `ped_night_velvet.webp` | Ice-cyan silk shirt `#3ee8ff`, charcoal trousers `#222434`, black loafers | `NOVA`, `diner`, & coastal boardwalk evening foot traffic |

## 2. Vehicle Color-Variant Sheets (`2` Models + Shadows — `32` Angles)

All color sheets measure **`1024 × 512 px`** (`8 × 4` grid of `128 × 128 px` frames; world `w: 64.0, h: 64.0, ox: -32.0, oy: -32.0`) paired with **`768 × 384 px`** shadow sheets (`w: 96.0, h: 96.0, ox: -36.41, oy: -51.11`); reuses `car_conv_*_light.webp` / `car_sedan_*_light.webp` (`56 × 176 px`).

| Vehicle Variant | Base Archetype | Files | Paint Finish |
|---|---|---|---|
| **Sunset Convertible** | `convertible` (`46 × 19 wu`) | `car_conv_sunset.webp`, `car_conv_sunset_sh.webp` | Juicy Sunset Tangerine `#ff7832` w/ cream interior |
| **Lavender Sedan** | `sedan` (`46 × 19 wu`) | `car_sedan_lavender.webp`, `car_sedan_lavender_sh.webp` | Pastel Electric Lavender `#b87cff` gloss paint |
