# Motel Siege — Interior Cutaway Art Bake-Off (`games/palm-city/shots/siege-interiors-bakeoff/`)

**Audit First Verdict (Upgrade Over Shipped Cutaway, Keep Layout Alignment `1:1`):**  
Inspected Fable's live `src/siege_render.js`, `assets/siege/motel_{color,night}.webp` (`1664×1105 px`), `assets/siege.json`, and `shots/siege-{lobby,tv}.png`.  
- **Strengths kept untouched (`1:1` geometry):** Directional Cycles raking sunlight, roof-hatch sunbeam, staircase/ladder geometry, east fire escape, and flanking palm trees align pixel-for-pixel with `src/siege.js` physics.
- **Identified gaps in `before/`:** The Cycles Kuwahara bake blurs structural slabs, window mullions, shutters, stair rails, ladder rungs, and the `CHECK IN` sign into low-contrast mud without `#210f2e` dark-plum contours — creating a visual clash with crisp `#210f2e`-inked traps (`desk`, `vend`, `tv`, `cart`, `dresser`, `mattress`). Furthermore, `motel_night.webp` overhead lights render as dim flat spots at dusk (`t = 0.68`).
- **Candidate improvements in `after/`:** Preserves `1664×1105` coordinates pixel-for-pixel while adding warm sunlit room pastel glazes, carpet runners/baseboards, louvered shutter & sky pane inkwork, crisp glowing neon `CHECK IN` signage, unified `#210f2e` floor slab/stair/ladder/HVAC contours, warm saffron overhead sconce light cones at dusk, and matched surface-highlighted `barricade_*` + `prop_roof_hatch_*` assets.

## Contents
- [`before/`](before/) — Untouched copies of Fable's shipped `assets/siege/` interior, barricade, hatch, sign, and ladder WebPs.
- [`after/`](after/) — Candidate upgraded `motel_color.webp`, `motel_night.webp`, `barricade_desk_{intact,damaged}.webp`, `barricade_{mattress,dresser}.webp`, and `prop_roof_hatch_{closed,open}.webp` (zero edits to live `assets/` or `src/`).
- [`bakeoff-golden-phone.png`](bakeoff-golden-phone.png) — Side-by-side live `420×860 @ 2x` phone render comparison in Golden Hour (`t = 0.25`) via `page.route()` swap.
- [`bakeoff-dusk-phone.png`](bakeoff-dusk-phone.png) — Side-by-side live `420×860 @ 2x` phone render comparison at Dusk (`t = 0.68`).

**Reproducible script:** `node games/palm-city/tools/build_siege_bakeoff.mjs`
