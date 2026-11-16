# Palm City — True Night Production Sprites (`games/palm-city/shots/night-sprites/`)

Production-ready transparent WebP sprites derived directly from [NIGHT-DELTA.md](../NIGHT-DELTA.md) and matching Palm City's live sprite scale (`0.8 px / wu`, true alpha keying with feathered edges so zero black bounding-box cutouts appear under either `lighter` or `screen` compositing).

## 1. Headlight Cone Set & Light Pools

| Sprite | Pixels | World Size (`wu`) | Anchor Offset (`ox, oy`) | Usage & Palette |
|---|---:|---:|---:|---|
| `night_headlight_quartz.webp` | `56 × 176` | `70 × 220` | `-35, -160` | Civilian sedans & convertibles: quartz cream `#fff6d0` → warm `#ffe8a3` twin forward beam cones + ruby `#ff263a` rear tail halos. |
| `night_headlight_highbeam.webp` | `72 × 224` | `90 × 280` | `-45, -216` | Sport / muscle / taxi high-beams: long-throw `#fffbe6` → `#ffd980` twin beams + sport ruby brake strip. |
| `night_headlight_police.webp` | `56 × 176` | `70 × 220` | `-35, -160` | Patrol cruisers: cool halogen twin cones + painted red/blue roof lightbar ambient bloom + rear tail halos. |
| `night_headlight_heavy.webp` | `64 × 200` | `80 × 250` | `-40, -185` | City Bus & Tow Truck: wide warm amber beams + 3 amber cab clearance roof dots + dual heavy rear tails. |
| `night_taillight_brake.webp` | `48 × 48` | `60 × 60` | `-30, -30` | Standalone ruby brake flare + reverse lamp cores stamped on braking/drifting cars. |
| `night_ped_flashlight.webp` | `56 × 88` | `70 × 110` | `-28, -72` | Narrow cool-white officer / SWAT / security flashlight beam cone. |
| `night_lamp_pool_amber.webp` | `160 × 160` | `200 × 200` | `-100, -100` | Sodium streetlamp drop-in (`lamp_night` replacement): `#fff5d6` (`r=18 wu`) → `#ffba54` (`r=85 wu`) feathered sidewalk pool. |
| `night_pier_lantern.webp` | `304 × 152` | `380 × 190` | `-190, -95` | Wooden pier twin rail pools (`pier_night` replacement) + painted vertical amber water shimmer columns below pier edge. |

## 2. Night Car & Pedestrian Rim Accents (Sheet-Aligned Overlays)

| Sprite | Pixels | Sheet Grid | Usage |
|---|---:|---|---|
| `night_car_accent_sheet.webp` | `1024 × 512` | `8 × 4` (`128 × 128` cells, `32` angles) | Exact frame-aligned moonlight cool silver-blue rim (`#9fd0ff`) + windshield glass specular sheen + warm lower-right sodium bounce (`#ffae52`) for compositing over darkened vehicles at `t = 1.00`. |
| `night_ped_accent_sheet.webp` | `1032 × 344` | `12 × 4` (`86 × 86` cells, `16` angles × `3` poses) | Exact frame-aligned cool moonlit crown/shoulder rim + warm curb sodium bounce so pedestrians remain cleanly legible against `mul [10, 14, 42]`. |

## 3. Moonlit Coastal Water Edge & Open-Ocean Shimmer

| Sprite | Pixels | World Size (`wu`) | Usage |
|---|---:|---:|---|
| `night_water_edge_shore.webp` | `512 × 128` | `640 × 160` | Seamlessly horizontally tileable midnight beach shelf (`#050a1e`) with three periodic sinusoidal moonlit breaking surf ribbons (`#cdeaff` + `#6eaff5` halo) and sea-foam sparkles. |
| `night_water_shimmer_sheet.webp` | `512 × 256` | `2 × 2` animated frames (`256 × 128` each) | 4-frame looping painted open-water moonlit wavelet shimmer tile for animating offshore sparkles along the East ocean strip. |

## 4. Boosted Lit-Window & Neon Building Overlays (`night_bld_*.webp`)

All 9 overlays keep identical dimensions and origins (`-w/2, -h/2` in `wu`) to `assets/bld_*_night.webp` in `manifest.json`, with baked opaque black rects keyed to true feathered alpha, `12 px` border halo feathering (no hard texture box cuts), saffron skylight/window boost (`#ffcc66` → `#ffa23e`), and rich neon glow (`NOVA`, `DINER`, `MOTEL`, `SOLANA`):

- `night_bld_club.webp` (`346 × 264` px = `432 × 330 wu`)
- `night_bld_diner.webp` (`320 × 272` px = `400 × 340 wu`)
- `night_bld_motel.webp` (`346 × 301` px = `432 × 376 wu`)
- `night_bld_hotel.webp` (`320 × 344` px = `400 × 430 wu`)
- `night_bld_shops.webp` (`480 × 232` px = `600 × 290 wu`)
- `night_bld_apartments.webp` (`346 × 328` px = `432 × 410 wu`)
- `night_bld_office.webp` (`346 × 344` px = `432 × 430 wu`)
- `night_bld_police.webp` (`360 × 301` px = `450 × 376 wu`)
- `night_bld_garage.webp` (`442 × 264` px = `552 × 330 wu`)
