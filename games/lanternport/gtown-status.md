# gtown-status — Lanternport Town Re-Dress (Gemini Pass)

## Status
- **Step 1 (Re-dress architecture, silhouettes & colour blocking in `dressing.js`):** ✅ Green & committed (25/25 tests pass).
- **Step 2 (Capture & visually inspect before/after stills at full and 420px phone width across all 6 viewpoints):** 🔄 In progress.

## Added Draw Calls & Instance Budget
- **Added Draw Calls:** `15` (one `THREE.InstancedMesh` per material list in `LISTS`).
- **Total Instances:** `15,099` (`cloth: 7,869`, `bloom: 1,358`, `glass: 1,185`, `iron: 838`, `cream: 635`, `pot: 538`, `timber: 487`, `pole: 473`, `tile: 470`, `leaf: 392`, `plank: 378`, `stone: 262`, `barrel: 118`, `spire: 67`, `rope: 29`).
- **Untouched files:** `stage.js`, `filmscenes.js`, `filmscenes2.js`, `festival.js`, `fx.js`, `sim.js`, `index.html`, `view.js` — byte-identical.

## What Changed by Viewpoint
- **Central Plaza (`plaza`):** Added the towering golden **Central Plaza Sun-Spire & Lantern Crown** above the fountain (`y = 5..22m`), 8 radial festival bunting & glowing lantern ribbons out to perimeter masts, and 4 **Triumphal Striped Festival Archways** framing the North/South plaza entrances and the `photo-call` camera sightline.
- **Streets (`street`):** Added street-spanning festival bunting garlands, glowing warm string lights, and overhead banner bridges every 16m across the road grid, plus deep 5-stripe shopfront awnings (`1.55m` projection), painted geometric wall murals, vertical facade banners, and street-lamp pennants.
- **Dock (`dock`):** Added bold striped harbour awnings, large painted harbour murals, overhead dock bunting + lantern spans across the `x = 84` dockside avenue, and rooftop skyline towers on the warehouse backdrop (`z = 78`).
- **Harbour (`harbour`):** Replaced thin furled sticks with **full billowing colourful square sails** (`y = 17..29m`) in crimson, saffron gold, turquoise, cobalt, and cream above both sea walls, upgraded the quay crane into a **15m Saffron-Yellow & Crimson Harbour Gantry Crane** hoisting a turquoise container, and added colour-blocked cargo stacks, sea-wall murals, and criss-crossing dock festival spans.
- **Rooftop & Pool (`rooftop`, `pool`):** Added an outer-rim **Rooftop Festival Pergola** with timber posts, striped valances, and glowing lanterns along the North and West edges of `stageRoof` (strictly outside the interior keep-out), plus **Clock/Bell Cupola Towers**, **Striped Rooftop Pavilions**, **Rooftop Billboards & Pennant Spires** on surrounding roofs, and **5 Tethered Festival Hot-Air Balloons** (`y = 29.5..33.5m`) in the skyline.
