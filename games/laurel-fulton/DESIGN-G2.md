# LAUREL / FULTON — `RALLY THE CREW` + Full Fleet Design & Asset Pack (`TASK G2`)

**Author:** Gemini · **Status:** Design + Real-Proportion Fleet Assets Ready for Opus / Moth Review  
**Privacy Rule Enforced:** Exact house + street only — **zero house numbers** anywhere in repo or UI.  
**Scale:** `1:1` Palm City (`10 wu = 1 m`), sprite sheets `1280×640` (`8×4`, `32` angles, `160×160` cells = `2.5 px/wu`), hero portraits `320×200`.

---

## 1. Verified Real-World Fleet Research & Asset Pack (`shots/fleet-sprites/`)

All `9` signature cars are modeled at exact real-world dimensions and baked in Blender `5.2.3 LTS` (Metal GPU) with `#210f2e`-compatible contrast, custom chassis silhouettes, and dedicated `3/4` hero portraits (`tools/build_laurel_fleet.py`):

| Owner | Street | Year / Model | Real Dimensions (`L × W`) | Distinguishing Visuals & Signature FX | Asset Files (`shots/fleet-sprites/`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Brad** | Stansfield Rd | **1987 Chevrolet Camaro IROC-Z** | `4.88 m × 1.85 m` (`48.8×18.5 wu`) | **Two-tone** (white front half / maroon rear half), twin hood louvers, T-top glass, 3-piece spoiler, **yellow headlights**, loud **bass rings** | `brad_camaro87.webp`, `brad_camaro87_hero.webp` |
| **Kosack** | Derby Dr | **~1989 Chevrolet Cavalier** | `4.43 m × 1.68 m` (`44.3×16.8 wu`) | **Red** J-body wedge nose, black beltline molding, flush rectangular headlights | `kosack_cavalier.webp`, `kosack_cavalier_hero.webp` |
| **Jimmy** | Sweet Cherry Ln | **1996 Chevrolet Astro** | `4.82 m × 1.97 m` (`48.2×19.7 wu`) | **Silver** 2nd-gen **extended Aero nose**, roof rack rails, **blue neon underglow**, loud **bass rings** | `jimmy_astro96.webp`, `jimmy_astro96_hero.webp` |
| **Billy** | Sweet Cherry Ln *(shares Jimmy's house)* | **1994 Chevrolet Astro** | `4.75 m × 1.96 m` (`47.5×19.6 wu`) | **Teal-blue** 1st-gen **short blunt boxy nose**, twin sealed-beam grille, parked beside Jimmy's Astro | `billy_astro94.webp`, `billy_astro94_hero.webp` |
| **Jason** | Susini Dr | **1989 Toyota Camry (V20)** | `4.52 m × 1.71 m` (`45.2×17.1 wu`) | **White** crisp 3-box sedan, black rub-strip, amber corners, **no exhaust — sputtering waves** from tailpipe | `jason_camry89.webp`, `jason_camry89_hero.webp` |
| **Clayton Floyd** | Hughes Ave *(Floyds)* | **3rd-Gen Chevrolet Camaro** | `4.88 m × 1.85 m` (`48.8×18.5 wu`) | **Green** metallic wedge F-body, T-top glass, hood blisters, rear decklid spoiler | `clayton_camaro.webp`, `clayton_camaro_hero.webp` |
| **Zack Floyd** | Hughes Ave *(Floyds)* | **Mercury Tracer** | `4.34 m × 1.69 m` (`43.4×16.9 wu`) | **Green** compact upright hatchback/sedan, black bumper trim, short stubby hood | `zack_tracer.webp`, `zack_tracer_hero.webp` |
| **Rigg** | Mossy Stone Ct | **1970–73 Toyota Celica** *(owner: '69)* | `4.17 m × 1.61 m` (`41.7×16.1 wu`) | **Blue** metallic compact fastback coupe, twin hood vents, chrome bumperettes, **blue headlights**, loud **bass rings** | `rigg_celica71.webp`, `rigg_celica71_hero.webp` |
| **Grant** | Early Bud Way | **1990 Cadillac Brougham "USS Mino"** | `5.61 m × 1.91 m` (`56.1×19.1 wu`) | **Maroon** massive `5.61 m` land yacht, **padded vinyl landau half-roof**, chrome bumpers & hood crest | `grant_brougham.webp`, `grant_brougham_hero.webp` |

*(Note: Unassigned black Cavalier remains excluded until the owner names its owner.)*

---

## 2. `PICK YOUR PLAYER` Screen (`shots/g2-pick-player-phone.png`)

Designed at `420×860` phone scale so choosing feels like picking a friend at their driveway:
- **Layout:** Vertical scrolling 2-column (or full-width featured card + 2-up grid) warm dusk/sunset palette (`#1a0e28` background, `#f6e6c4` parchment accent borders, `#210f2e` ink).
- **Per-Friend Card:**
  - `3/4` Hero Car Render (`*_hero.webp`) centered on a warm asphalt driveway pad.
  - **Friend Name** (`Brad`, `Jimmy`, `Grant`, etc.) + **Street Only** (`Stansfield Rd`, `Sweet Cherry Ln`, `Early Bud Way` — zero house numbers).
  - **One-line signature tag pill:** e.g. `87 CAMARO · 2-TONE · BASS`, `96 ASTRO · BLUE GLOW`, `USS MINO · 5.6M LAND YACHT`, `89 CAMRY · NO EXHAUST`.
  - **One-Tap Start:** Tapping a card drops you immediately into that friend's driveway beside their car with `START RALLY` armed.

---

## 3. `RALLY THE CREW` — House Stop Micro-Beats

Each remaining crew house appears as a pulsing golden driveway beacon on the OSM road graph. Stopping within `50 wu` (`5 m`) at `< 40 u/s` triggers a `1.4 s` non-blocking arrival beat (no modal lock!):
1. **Brad (`Stansfield Rd`):** Garage door light spills out; Brad hops in, **yellow headlights** snap on, first deep bass thump ripples outward (`r = 70 → 140 wu`).
2. **Kosack (`Derby Dr`):** Side door slam; red `'89 Cavalier` chirps its tires onto Derby Dr.
3. **Jimmy & Billy (`Sweet Cherry Ln`):** Two-car pickup! Jimmy's **silver '96 Astro** flashes **electric blue neon underglow** + bass pulse while Billy's **teal-blue '94 Astro** pulls out right behind him.
4. **Jason (`Susini Dr`):** **White '89 Camry** cranks, backfires once, and immediately begins coughing irregular **white/grey exhaust waves** from its missing muffler.
5. **The Floyds — Clayton & Zack (`Hughes Ave`):** Twin-exit beat — Clayton's **green Camaro** burbles out first, Zack's **green Mercury Tracer** slots directly behind it.
6. **Rigg (`Mossy Stone Ct`):** **Blue headlights** slice across the cul-de-sac; compact **Celica** spins a tight J-turn out onto Mossy Stone Ct with bass rings pulsing.
7. **Grant (`Early Bud Way`):** The **5.61 m maroon Cadillac "USS Mino"** backs slowly down the apron with wide chrome glints, taking extra curb swing before locking into convoy formation.

---

## 4. Convoy Presentation & Atholton High School Finale (`shots/g2-convoy-phone.png`)

- **Convoy Spacing & Pathing:** Each joined friend follows the player's breadcrumb spline on `world_graph.js` at **`1.7` car lengths (`~85 wu`)** bumper-to-bumper gap, snapping cleanly around cul-de-sacs (`347` OSM dead ends) and preserving bridge layer (`layer +1`) separation.
- **Readability from Chase Camera:**
  - **Sound-system cars** (`Brad`, `Jimmy`, `Rigg`) pulse subtle concentric `#6ee2ff` / `#ffd45c` bass rings synced to a `118 BPM` beat + tiny `1 px` body vibration.
  - **Jimmy's Astro** casts a soft `#369eff` cyan-blue underglow halo onto the asphalt beneath its sills.
  - **Jason's Camry** emits rhythmic jagged white-grey acoustic exhaust rings (`tailpipe_sputter`) trailing behind the rear bumper.
  - **Headlight Cones:** Brad's **yellow**, Rigg's **blue**, and standard warm halogen cones illuminate dusk roads ahead of the convoy line.
- **Atholton High School Finale (`[11307, -39526]`):**
  - Pulling into the Atholton HS front parking apron triggers a `2.5 s` **CONVOY COMPLETE** fanfare as every crew car fans into a crescent semicircle facing the school entrance, headlights sweeping together, bass rings & Jimmy's underglow pulsing across the lot.

---

## 5. Maple Lawn / Laurel Painted Look & Dressing Spec

- **Palette & Ground Treatment:** Golden-hour Howard County late-afternoon sun (`#f4b87a` key, `#3b224a` cool plum shadows). Major corridors (`MD 216 / Scaggsville Rd`, `US-29`, `I-95`) use worn charcoal asphalt with crisp double-yellow / dashed-white striping; neighborhood streets (`Stansfield`, `Sweet Cherry`, `Susini`, `Hughes`, `Early Bud`, `Mossy Stone`) use warmer weathered macadam with grass verges and deciduous Howard County oak/maple canopies (no Miami palms!).
- **Real Water Features:** Rocky Gorge / T. Howard Duckett Reservoir & Middle Patuxent branches painted in deep slate-teal (`#234f68`) with warm shoreline bank highlights.
- **Street Dressing Anchors:**
  - **School Buses:** Parked yellow Type-C school buses in the bus loops at **Atholton High School** and **Reservoir High School**.
  - **Ledo Pizza (`Scaggsville Rd`, Maple Lawn):** Period square-cut pizza parlor storefront with warm red-and-cream awning + neon window `LEDO PIZZA` sign; optional post-rally cruise stop.
  - **Period Traffic:** Background AI traffic pulls from the late-80s/early-90s pool (`Cavalier`, `Camry`, `Tracer`, `Astro`) in muted period tones so the crew's signature paint & mods pop at phone size.
