# CASH MOUNTAIN — asset provenance

| Asset | File | Source | License |
|---|---|---|---|
| US $100 bill, obverse, Series 2009 (stack tops, loose bills) | `assets/bill100.png` | Wikimedia Commons — https://commons.wikimedia.org/wiki/File:USA_100_Dollar_Bill_Series2009_Obverse.png | Public domain (US federal government work) |
| US $1 bill, obverse, Series 2009 (rolled bill) | `assets/bill1.jpg` | Wikimedia Commons — https://commons.wikimedia.org/wiki/File:US_one_dollar_bill,_obverse,_series_2009.jpg | Public domain (US federal government work) |
| Kraft paper, tileable (wrapped brick packages) | `assets/kraft.png` | Wikimedia Commons, by Coyau — https://commons.wikimedia.org/wiki/File:Kraft_tileable_1024x1024.png | Public domain |
| Anton font (HUD counter) | `assets/anton.woff2` | Google Fonts — https://fonts.google.com/specimen/Anton | Apache License 2.0 |
| Three.js r160 | `vendor/three.module.min.js` | threejs.org — vendored from this project's existing copy (originally npm `three@0.160.0`) | MIT |

## Owner-supplied photoreal props (added Nov 16, 2026 — these now carry the scene)

The owner supplied generated photoreal stills + video loops (Nov 16) after the
procedural props read as "cheesy/fake" on camera. The four hero props are now
2.5D photo cards in the 3D scene; originals + cutouts live in
`~/workspace/ar-photoreal/`.

| Asset | File | Source | License / notes |
|---|---|---|---|
| Banded cash-stack cluster (centrepiece card) | `assets/photo/cash-stacks.png` | Owner-supplied generated still (Nov 16), white-background product shot | Owner-provided; alpha cutout by Moth |
| Cash-stack variants ×4 (front-left, front-right, centre pile, back-left pile) | `assets/photo/stack-*.png` | Crops of the same owner-supplied cluster still, each trimmed to its alpha bbox | Owner-provided |
| Duffel bag full of cash | `assets/photo/duffel.png` | Owner-supplied generated still (Nov 16) | Owner-provided; alpha cutout by Moth |
| Taped kraft bricks (3-stack) | `assets/photo/bricks.png` | Owner-supplied generated still (Nov 16) | Owner-provided; alpha cutout by Moth |
| Digital pocket scale | `assets/photo/scale.png` | Owner-supplied generated still (Nov 16) | Owner-provided; alpha cutout by Moth |
| Smoke wisp loop (CRACK HOUSE tier, additive plane over the ashtray) | `assets/photo/smoke-drift.mp4` | Owner-supplied generated video (Nov 16), smoke segment of a 3-part render, black background | Owner-provided; extracted + crossfade-looped + transcoded to H.264 by Moth |

**Cutout method:** rembg (ISNet `isnet-general-use` model) on the pure-white
backgrounds, near-white fringe decontamination, bbox trim. Each cutout was
verified composited over black and over a warm dark background — no white
fringing. (The duffel needed ISNet specifically: u2net left sealed white
background pockets in the handle/strap gaps.) Cards get a baked soft
elliptical contact shadow and a slight warm tint (1.0 / .962 / .905) to grade
the neutral product shots toward the look-target's tungsten room light.
Grading reference: `~/workspace/ar-photoreal/look-target.jpg`.

## What stayed procedural, and why
- **Loose scatter bills + rolled bill** (public-domain bill textures above) — small, flat on the table; they read fine and add spread the cards don't.
- **Baggies** — tiny translucent pouches at the scale; sub-100px on a phone screen, the photo props carry the tableau without them needing a reshoot.
- **Ashtray + cigarette + ember + its little procedural smoke sprites** — kept as the smoke *source*; the owner video wisp now rises from the same spot at CRACK HOUSE and does the atmospheric work.
- **Contact-shadow blob under the whole pile** — kept as overall grounding beneath the per-card shadows.
- Retired Nov 16: procedural cash-stack boxes, capsule duffels, kraft-box bricks and the canvas-LCD scale (replaced by the photo cards above). The public-domain kraft texture is no longer used by the bricks but remains in the tree.

All tableau props are generic movie-prop styling. No Rockstar/GTA art or logos are used.
