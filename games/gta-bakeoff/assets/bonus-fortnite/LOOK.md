# Bonus Round 3 — Fortnite (Stylized UE5 PBR + Slurp Shield Chrome) + Hero Link

## Visual Research Summary (`/tmp/fn_ref/` — `-RmEwdSG1LE` & `KJZXCBV5ln4`)

Derived from third-person Fortnite city/driving and Battle Royale captures:

1. **Stylized UE5 PBR Materiality & Palette:**
   - **Roadways & Curbs:** Smooth brushed medium-slate asphalt (`#4a5260`) with crisp high-contrast white crosswalk zebras, bold double yellow center stripes (`#f6d43c`), and clean chamfered light-concrete curbs (`#b8bec6`).
   - **Foliage & Ground:** Lush chartreuse/emerald lawns (`#68b83c`), warm honey boardwalk decking (`#c89254`), bright bleached beach sand (`#e8d49c`), and crystal cerulean Unreal water (`#28a8d8`) with clean painted foam highlights.
   - **Architecture:** Stylized suburban/coastal storefronts — painted plaster, brick trim, warm golden glowing interior panes alongside sky-reflective glass.

2. **Vehicles, Peds & Fortnite Hero Link:**
   - **Vehicles (`sprites.png`):** Whiplash racing stripes & rear diffusers, Bear truck cabs, Victory Taxi cabs, and Island Tactical Police cruisers with electric blue/magenta roof bars + cyan headlight bloom.
   - **Peds (`peds.png`) & Hero (`link.png`):** Broad-shouldered stylized proportions with strong top-edge rim highlights; **Fortnite Link** sports his emerald tunic with glowing **Slurp-Cyan `#3cd4ff` shield accents**, bold boots, golden hair silhouette, and a Legendary-gold rimmed blade/shield!

3. **UI Chrome (`hud-font.png`):**
   - Crisp **100 Health (`#52e042`) + 100 Shield (`#3cd4ff`)** stacked dual bars, skewed bold *Burbank*-inspired condensed display glyphs, square corner Storm minimap, and **Golden Legendary rarity weapon slot (`#ffaa22`)**.

## Canonical Framing & C1 Contract

- `era`: `"bonus-fortnite"`, **art-only manifest** (zero `viceBeachPlacements` per C1).
- `cameraHint`: `pitchDeg: 36`, `fovDeg: 55`, `distanceM: 66.1` -> `2 × 66.1 × (420/860) × tan(27.5°) = 33.6 m` canonical horizontal viewport width.
- `fogHint`: `{ "color": "#6eb8f6", "farM": 160 }`.
