# Palm City — Destruction Phase 2 Production Sprites (`games/palm-city/shots/destruction2-sprites/`)

**Audit note:** Checked `games/palm-city/src/destruct.js`, `assets/manifest.json`, and `shots/destruction-sprites/` prior to build — Phase 2 building fronts, fences, 4-stage hydrants, and market stalls did not yet exist in live assets or `shots/`, so all `28` transparent WebP sprites (`7` families × `4` damage states `_s0.._s3`) were built fresh at Palm City's live `2 px / wu` (`UPM=10`) scale with `#210f2e` dark-plum ink contours and matching [DESTRUCTION2-DELTA.md](../DESTRUCTION2-DELTA.md).

**Generator script:** `node games/palm-city/tools/build_destr2_sprites.mjs` (`cwebp -q 90 -alpha_q 100`)

## Inventory (`28` Files)

| Family | Files | Pixels (`w × h`) | World Metrics (`w, h, ox, oy`) | Staged States (`s0 → s1 → s2 → s3`) |
|---|---|---:|---:|---|
| **Storefront Glass** | `glass_bay_s0..s3.webp` | `192 × 64` | `96, 32, -48, -16` | Intact 3-pane glazed bay → rubber scuff + hairline crack → dual spiderweb fractures + chips → dark doorway void, jagged glass teeth, snapped mullion & sidewalk shards |
| **Striped Awning** | `awning_coral_s0..s3.webp` | `192 × 80` | `96, 40, -48, -20` | Taut coral/cream awning → bowed center steel bar + crease → torn right half dangling over bent support arms → wall brackets + crumpled canvas scraps |
| **Rooftop Signage** | `sign_nova_s0..s3.webp` | `160 × 96` | `80, 48, -40, -24` | Lit `NOVA` blade housing → `14°` tilt + snapped strut + cracked tube → `-36°` single-bolt hang w/ dangling yellow spark lead → crushed unlit box flat on curb + broken tube dust |
| **Picket Yard Fence** | `fence_picket_s0..s3.webp` | `160 × 64` | `80, 32, -40, -16` | Intact residential picket bay → bowed rails + `+15°` center post lean → car-punched breach w/ canted rail stubs & splinters → flush post sockets + scattered boards |
| **Chain-Link Fence** | `fence_chain_s0..s3.webp` | `160 × 64` | `80, 32, -40, -16` | Intact courtyard iron/chain bay → concave center dent → snapped peeling left/right bars & uprooted post → base pipe sockets + tangled wire scraps |
| **Fire Hydrant** | `hydrant_s0..s3.webp` | `96 × 96` | `48, 48, -24, -24` | Uses `events-sprites/anchor_hydrant_*` base: intact red hydrant → `18°` tilted leaking valve + spray → sheared vertical frothy geyser plume & widening curb pool → twisted iron flange in quiet pool + loose cap |
| **Market Stall** | `market_stall_s0..s3.webp` | `144 × 112` | `72, 56, -36, -28` | Teal/cream boardwalk canopy + wood counter → `+12°` skewed frame + spilled citrus → corner pole snap (`-20°` squash) + scattered fruit → flattened tarp ribbons & splintered trestle planks |
