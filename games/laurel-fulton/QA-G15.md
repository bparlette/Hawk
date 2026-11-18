# Task G15 — L11 Hero Homes, Live Features & Nov 18 Canon Visual QA

> Live visual audit against `tasking/g12/SPECS.md` and `tasking/gemini.md` at `420×860 @2x` phone resolution (`CHROME` + `node tools/g15_visual_qa.mjs`). Zero house numbers included.

## 1. Evidence Sheets (Phone Resolution `420×860 @2x`)

- [g15-heroes-grid.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/g15-qa/g15-heroes-grid.png) — All 7 mapped crew homes and 3 mapped POIs at golden hour (`t=0.22`).
- [g15-car-lights-and-logo.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/g15-qa/g15-car-lights-and-logo.png) — Pick screen (`MD-216` sign logo) + `t=0.85` car beams & underglow checks (Rigg, Brad, Jimmy, Kosack).
- [g15-daynight-parity.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/g15-qa/g15-daynight-parity.png) — Side-by-side Palm City vs Scaggsville at `t=0.00`, `t=0.55`, and `t=0.97` + live `tod()` curve check.
- [g15-brads-cutaway.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/g15-qa/g15-brads-cutaway.png) — Brad's L7 split-foyer cutaway (landing, upstairs Teter + dogs, downstairs weights + fireplace + 6 mantle beers).

---

## 2. Live Feature Verdicts (Built Systems)

### A. MD-216 Sign Logo & Pick Screen (`src/main.js`, `assets/logo-sign.webp`)
- **Pass (Art):** The painted green MD-216 `"EXIT 35A-B / Laurel / Scaggsville — EXIT 1 MILE"` highway sign renders clearly at the top of the Pick Screen (`logo-pick.png`) and lists all 9 playable crew members with side-on car sprites and street names (no house numbers).
- **Bugs Found (Actionable for Opus):**
  1. **HUD Draw-Order Overlap:** `0 mph · 6:51 PM` and street label text draw *after* `renderer.draw()` returns (`src/main.js:290`), stamping white clock text right across the middle of the green MD-216 sign and letting `Scaggsville Road` bleed behind/across rows 2–4. Suppressing world HUD labels/clock while `picking === true` will clean this immediately.
  2. **Right-Edge Text Clipping:** Row 2 (`Derby Drive`) and Row 7 (`1987 Toyota Celica GT (fourth gen, pop-up headlights) · Mossy Stone Court`) overflow the right edge of their `372 px` cream card.

### B. Car Headlights & Blue Neon Underglow (`src/lf_render.js:62-87`, `t=0.85`)
- **Rigg (`celica_rigg`):** **PASS** — Bold BLUE gradient headlight cones project cleanly across Hammond Branch Way.
- **Brad (`camaro_brad`):** **PASS** — Distinct warm YELLOW headlight cones project onto Stansfield Road. Slightly lower peak luminance than Rigg's blue (`0.58 * hf` vs `0.68 * hf`) against dark dusk asphalt, still unmistakable.
- **Jimmy (`astro_jimmy`):** **PASS** — Prominent BLUE NEON underglow halo sits visibly beneath Jimmy's silver Astro next to Billy's teal Astro.
- **Kosack (`cavalier_kosack`):** **QUEUED / NOT YET BUILT** — Parked red 3rd-gen Cavalier has standard warm-white headlights only; no flashing red/blue cop lights yet (`data/roster.json` `fx: []`).

### C. Day / Night Parity vs Palm City (`src/main.js`, `src/lf_render.js`)
- **Curve Parity — PASS:** Live clock curve (`0.180` -> `0.329` -> `0.809` at `x16`, cap `0.97`) and HUD clock stamps (`6:38 PM` at `t=0.00`, `7:17 PM` at `t=0.55`, `7:46 PM` at `t=0.97`) match Palm City's keyframes 1:1.
- **Dusk Lighting Gap (`t=0.97`):** Color grading matches Palm City's deep indigo multiply wash, **but** Scaggsville currently lacks residential streetlamp light pools and background house warm window lights, making `t=0.97` substantially darker and flatter in screenshots than Palm City's glowing streets/storefronts. Adding warm porch/streetlamp pools along mapped roads and lit window accents at `gr.lamps > 0.15` will bring visual parity in line with the curve parity.

### D. Brad's L7 Split-Foyer Cutaway (`src/lf_interior.js`, `src/lf_interior_render.js`, `data/interiors/brad.json`)
- **Cutaway Craft — PASS:** Dollhouse cross-section, brick side cut, wood-paneled lower room vs striped upstairs wallpaper, stairs, weight bench/plates, ember-glow fireplace (zero flame tongues), 6 removable mantle beers, cooler, fridge, rocking Teter in recliner, and 2 roaming golden retrievers all read crisp at phone scale (`g15-brads-cutaway.png`).
- **Two Spec Mismatches + One Cold-Boot Race Found:**
  1. **Teter's Greeting Line (`src/lf_interior.js:58`):** Live build still uses placeholder `"Hi hon! There’s beer in the cooler."` instead of Nov 18 canon in `g12/SPECS.md`: **`"Hi guys, what are you getting into today?.... You are all alcoholics."`**
  2. **Missing Basement Computer (`data/interiors/brad.json` / `src/lf_interior_render.js`):** Brad's basement computer with **`"eDonkey"`** on its screen is not yet present downstairs.
  3. **Cold-Boot `?player=brad` Race (`src/main.js:97-98` vs `L139`):** Because `KITS['brad']` loads asynchronously in Phase 2 after `pick(Q.get('player'))` fires at module bottom, `?player=brad` (and fast manual taps before Phase 2 finishes) skips `goIn('brad', ...)` and drops Brad outside on foot (`tools/l7_shots.mjs` cannot enter the house without waiting on Phase 2).

---

## 3. Per-House & POI Verdicts vs `tasking/g12/SPECS.md`

> **Current State Across Mapped Buildings:** Task `G14` tuned hero footprints (`S=1.40` homes / `1.16` POIs, `#210f2e` ink outline, eave trim, distinct roof palette) and faded background buildings so every target location pops in 1 glance (`g15-heroes-grid.png`). Except for **Atholton HS (L5 `lf_roof.js`)**, **none of the L11 Street View facade art or house arrival beats are wired yet** — buildings remain top-down extruded roof polygons with parked crew cars.

| Target (Street / Area) | What's Live Now (`g15-heroes-grid.png`) | Verdict vs `SPECS.md` & Required L11 Build Items |
|---|---|---|
| **Brad** (Stansfield Rd) | Off-white `5608` footprint + two-tone Camaro w/ YELLOW lights + walkable L7 split-foyer interior. | **Partial Pass** (top-down silhouette + cutaway exist). Needs Teter's `"alcoholics"` line + downstairs **`"eDonkey"`** PC + Street View front elevation polish. |
| **Kosack** (Derby Dr) | L-shaped brick-terracotta `15666` polygon + red Cavalier in cul-de-sac driveway. | **Footprint Only (Pre-L11).** Needs flashing **cop lights** always on in Cavalier, **fake-cop pull-over mini-game** (lights + siren, no tickets), and optional **night party (100 people)** in basement + backyard pool. |
| **The Lazaris house — Jimmy & Billy** (Sweet Cherry Ln) | Brown `8582` polygon + Jimmy's silver Astro (`underglow_blue`) beside Billy's teal Astro. | **Footprint Only (Pre-L11).** Missing `SPECS.md` signature **RED front door** + white double garage facade and missing the 3-step **shoes-in-yard beat** (mom throws boots -> Riggleman `"why are my boots in the yard"` -> Jimmy `"Mamma duke a timberland hater"`). |
| **Jason** (Susini Dr) | Warm cream 6-vert `9575` polygon + white `'89` Camry (`tailpipe_sputter`). | **Footprint Only (Pre-L11).** Missing **dark front door** contrast point + garage read, living room **consoles + TV with giant speakers**, and basement **Genesis (Evander Holyfield boxing)** + **teacher-looking-like-a-cheeseburger portrait**. |
| **The Floyds — Clayton & Zack** (Hughes Ave) | Single olive-sage `5313` polygon + green Camaro & green Tracer parked out front. | **Below Spec (Pre-L11).** `SPECS.md` calls for the **two-house side-by-side white + red pair** as a composition; missing mom line (`"you owe me money for the broken butter churner"`), dad **playing video games downstairs by fireplace**, arrival **basketball + fighting beat**, and optional **night party** site. |
| **Rigg** (Mossy Stone Ct) | Slate `8912` polygon on curved cul-de-sac + blue `'87` Celica GT w/ BLUE beams. | **Footprint Only (Pre-L11).** Missing **reddish-brown rear deck/patio**, curved asphalt drive emphasis, **David Klink's Scooby-Doo van** (`exhaust tip steppable` hop + puff), interior **two-story foyer + dad yelling `"Brrrrrriiiiiiaaaaannnn"` + Brian walking downstairs + basement computer/CD writer**, and **Rigg-isms** (`"IGURT GOGURT"`, `"fuck shit diesel"`). |
| **Grant** (Early Bud Way) | Largest 14-vert `8249` maroon-accent footprint + maroon Cadillac Brougham (`USS Mino`). | **Footprint Only (Pre-L11).** Missing **white facade + signature BLACK shutters** + long side wall read, and mom `"move your car"` beat. |
| **Ledo Pizza** (POI — Scaggsville Rd) | Bold red `7046` storefront polygon + front parking lot (spawn anchor). | **Footprint Only (Pre-L11).** Needs brick storefront + glowing **`OPEN` sign** readable day and dusk. |
| **Atholton High School** (POI — Freetown Rd side) | **Pass (L5 Live):** Full 21,396 m² multi-wing `lf_roof.js` 2-storey complex w/ courtyards, brick walls, membrane parapet, HVAC/climbable holds + burning Mustang set piece. | **Strongest POI.** Add **covered walkway frontage** from `SPECS.md` in L11 if extending entrance dressing. |
| **Reservoir High School** (POI — Fulton) | Large 38-vert `7406` tan school polygon + front parking lot. | **Footprint Only (Pre-L11).** Needs long **brick frontage** elevation matching Atholton's brick grammar across its lot. |

---

## 4. Queued Nov 18 Canon Beats Matrix (Unbuilt / Pending L11–L13)

- **Maple Lawn District (`map-assets.html` `SPEC QUEUED`):** No hero build or green-roof main-street brick retail strip styling yet in `areas.json` / `lf_render.js`.
- **Weis Markets — Whiskey Bottom (`L12`, `SPEC QUEUED`):** No supermarket build or cutaway interior yet (aisles, checkouts, deli/pizza counter where **Brad makes pizzas**, security desk where **Jason is security**, store lore where **Brian got fired for opening a bottle of soda -> `"Fuck Scott"`**).
- **Scott's House + Civic (`TBD`, `SPEC QUEUED`):** Random Whiskey Bottom house + Honda Civic ("for now") not yet placed.
- **Gringada 1998 (`L13`, `SPEC QUEUED`):** Columbia shopping-center period Mexican restaurant (stucco/tile accents/sign; **Brad works there**, **Jimmy & Clayton steal food**, Zack: `"why are you going to Clayton it"` -> Jimmy eats it super fast) not yet built.
- **Route 108 Astro Set-Piece (`SPEC QUEUED`):** Random Chevrolet Astro parked on MD-108 with **Jason robbing its parking lights** not yet placed.
- **Convoy Mischief Behaviour (`src/lf_mission.js`):** Currently follows breadcrumb trail smoothly at fixed `SP = 78`; **not yet implemented** per `SPECS.md`: followers racing/passing you, yelling `"Cole Trickle"`, bumping + `"rubbin is racing"`, throwing dollar bills (`ones`) / pens / pennies out windows.

---

## 5. Post-Merge Verification (`Hawk` merge `3d8f6fcb` — L11 / L12 / L13 / L7b)

Following the initial pre-merge audit (`a25ce071`), Opus merged `opus-heroes` (`d5d08b13`, `b1023167`), `opus-stores` (`ac4ba746`), and `opus-brad-rigg` (`77f1d8a0`, `433a5bfd`) at `3d8f6fcb`. Verified post-merge on `main`:

### Automated Rule Checks (All Passing)
- `node tools/spec_l7b.mjs` -> **`SPEC L7b OK`**:
  - Brad's downstairs **`eDonkey`** CRT PC + Teter's updated `"Hi guys, what are you getting into today?...."` -> `"You are all alcoholics."` line.
  - Rigg's **two-story entryway** + basement `eDonkey`/CD writer + dad `"Brrrrrriiiiiiaaaaannnn"` yell + Brian stairs descent.
  - **David Klink's Scooby-Doo van** parked by Rigg's house with steppable exhaust tip (`z 5`, puff particles) + **Rigg-isms** (`"IGURT GOGURT"`, `"fuck shit diesel"`).
- `node tools/spec_l12.mjs` -> **`SPEC L12 OK`**:
  - **Weis Markets (Whiskey Bottom)** cutaway (`Jason` security, `Brad` pizza counter, `Rigg` soda bottle firing beat -> `"Fuck Scott."`) + **Scott's** Whiskey Bottom house & Civic stand-in.
  - **Gringada (1998)** memory build (`Brad` cooking, `Clayton` & `Zack` `"why are you going to Clayton it"`, `Jimmy` 0.83 s steal-eat beat) + **Route 108 Astro** stand-in on Guilford Rd (`ROB LIGHTS`).

### Visual Inspection of Merged Proof Shots (`420×860 @2x`)
- [l11-lazaris-close.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/l11-lazaris-close.png): Brick two-story facade, white double garage, glowing **RED front door** landmark, and Jimmy/Billy's Astros read cleanly at phone zoom.
- [l11-floyds-close.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/l11-floyds-close.png): White + red side-by-side paired house composition + orange driveway basketball hoop next to Clayton & Zack's green cars.
- [l11-ledo-night-close.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/l11-ledo-night-close.png): Striped awning + brick unit + glowing red **`OPEN` sign** cutting sharply through night multiply.
- [l7b-brad-basement-computer.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/l7b-brad-basement-computer.png): `"eDonkey2000 / eDonkey"` CRT monitor renders crisply downstairs beside weights & fireplace.
- [l7b-rigg-4-brian-comes.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/l7b-rigg-4-brian-comes.png): Two-story entryway arched window + Brian walking down the staircase.
- [l7b-van-3-puff.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/l7b-van-3-puff.png): Mystery van parked beside Rigg's Celica with Jason standing on rear exhaust corner emitting exhaust puff.
- [l12-9-fuck-scott.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/l12-9-fuck-scott.png): Weis soda aisle firing exchange (`"Fuck Scott."` bubble + dropped soda beside Scott).

### Remaining Items Routed to Moth (`moth.md` `M-A..M-D`)
1. **Convoy Mischief (`M-A`)**, **Kosack's Cop Lights + Fake-Cop Pull-Over Minigame (`M-B` / `G17`)**, **100-Guest Night Party (`M-C` / `G18`)**, and **L6 Online Leftovers (`M-D`)** await Moth's build wiring.
2. Live UI fixes noted earlier remain open: Pick-screen `0 mph · HH:MM` HUD overlap across the `MD-216` sign logo (`src/main.js`) and sparse residential streetlamps at `t=0.97`.
