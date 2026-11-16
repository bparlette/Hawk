# Era 4 Visual Look Spec — *Grand Theft Auto: Vice City* (2002) × *The Wind Waker* (Toon Link, 2002)

**Reference Material Studied (`research/vice-city/`):**
- `vice-city-2002-cover-wikipedia.jpg` — Iconic Miami 1986 Art Deco comic-grid palette: sky cyan (`#28a4dc`), flamingo pink (`#f37eb8`), warm cream stucco, cobalt Ocean bays, yellow/red 80s wedges, neon-script "Vice City" chrome/pink type.
- `vice-city-2002-motorcycle-gameplay-wikipedia.jpg` — Real 2002 in-game Ocean Drive shot: low pastel yellow/lavender/salmon/mint Art Deco hotels facing the palm-lined Ocean Beach promenade, warm olive-charcoal asphalt with twin crisp yellow centerlines, green radial Ocean Beach map inside a **hot-pink radar ring**, glowing neon-cyan dollar digits (`$00000000`), pink HP heart + magenta fist weapon box, and pastel-cyan sky clock.
- `vice-city-gameplay-regina-gtawiki.webp` — Low-angle warm peach/magenta Miami sunset horizon haze framing palms and the 1980s **Regina wood-panel station wagon** (maroon roof/hood, olive flank, bright chrome bumpers & dish hubcaps).
- `vice-city-gameplay-katana-gtawiki.webp` — Tommy Vercetti's vibrant cyan tropical palm-print shirt against turquoise Ocean Beach hotels & warm-grey pavement.
- `vice-city-gameplay-freeway-gtawiki.webp` & `vice-city-promo-voodoo-gtawiki.webp` — Warm golden dusk highlights on white stucco, cream fascia trims, red **Voodoo** lowrider tail-fins with white cove accent stripe, chrome bumpers, and sunset palm silhouettes.
- `link-wind-waker-gameplay-wikipedia.jpg`, `link-wind-waker-official-artwork-zeldawiki.png`, `link-wind-waker-artwork-4-zeldawiki.png`, `link-wind-waker-figurine-zeldadungeon.png` — Cel-shaded **Toon Link**: large oversized expressive head, sweeping blonde bangs (`#f0cc3a`), vivid grass-green tunic (`#4db83b`) & floppy pointed cap with clean two-tone cel shade (`#2a7d22`), thick hand-inked outline (`#181c22`), white cuffs/tights, gold-swirl belt buckle, wooden **Hero's Shield** with crimson emblem, crimson-trim sea vessel / Ocean crest palette, and crisp stylized white swirl waves on deep cobalt/turquoise sea.

---

## 1. Era Mood, Camera Framing & Color Grading

- **Palette & Light:** Warm Miami **pastel sunset** over Ocean Drive — low sun bathing east-west avenues in warm apricot/gold (`#f4b87c`) while ambient shadows drift softly **violet-plum** (`#382848`), replacing Era 3's cold overcast steel-blue.
- **Vertical Haze / Sky Dome:** Peach-orange lower horizon melting into cotton-candy **magenta-pink** and warm twilight azure overhead (`420×860` dusk wash + soft emissive bloom halos on streetlamps and neon trim).
- **Camera Framing (Owner Nov 15 Standard):** `ERAS.md` pitch `48°` and vertical `fovDeg = 55°`, with camera distance derived per `DESIGN-e4.md §3` to match the series **`~33.6 m` street width visible at the player** on `420×860` portrait phones (`distanceM ≈ 66.1 m`, keeping `48°` look without tunnel-vision crop).
- **Art-Only Manifest (`C1` Rule):** `assets/e4/manifest.json` contains zero world placements (`viceBeachPlacements` omitted — live strictly in `level/canonical/vice_beach.json`).

---

## 2. Tiles (`tiles.png`, `2048×832` RGBA)

Every canonical surface (`86` used Vice Beach lids, `14` `flatTransparentMap` overlays, and `198` extruded 3D wall slots `0..197`) is re-skinned while keeping canonical footprints identical:
- **Art Deco Building Façades (`slots 0..197`):** Four Miami Ocean Beach architectural families — **flamingo-pink**, **seafoam-mint**, **pastel sky-cyan**, and **warm cream-peach stucco** — featuring recessed dark awning colonnades, glass-block lobby bays, horizontal Art Deco speedline belt-courses, and thin **emissive hot-pink / electric-cyan neon cornice stripes**.
- **Ocean Beach Promenade & Sidewalks (`lids 93, 8, 141, 9, 101`):** Sun-warmed pink-terracotta & cream checkerboard/octagonal promenade pavers (`#d99f86` / `#e8cdb4`) beside pale cream-taupe Art Deco terrazzo curb blocks (`#d2c6ba`).
- **Boulevard Asphalt & Road Markings (`lids 1, 2, 22–25, 74–75, 80, 92, 94, 99, 103–106, 112, 119, 133–136`):** Sun-faded warm plum-charcoal asphalt (`#524b5a`) with crisp weathered **ochre-yellow centerlines** (`#e0aa42`), cream crosswalk bars, and faint warm dusk oil/tire track patina.
- **Ocean & Hotel Pools (`lids 41, 7`):** Tropical **Wind-Waker turquoise / Vice cobalt sea** (`#1ca7c4` ocean with delicate hand-painted sunlit foam curls; bright aqua pool tiles `#2cd2de` with crisp white bevel lip).
- **Beach Sand & Tropical Palms:** Warm golden Miami beach sand (`#e8cfa0`) + lush sunlit coastal coconut palm crowns & poolside planter greens.

---

## 3. Vehicles (`sprites.png`, `2048×2048` RGBA, 32-Heading Strips)

1980s angular wedges, box sedans, and classic Americana with pastel/metallic paint, **fake env-map chrome specular diagonal strips** across roofs/windshields, and crisp tail-fin/lightbar detail:
1. `taxi_white` — **Kaufman Checker Cab** (warm marigold yellow `#f0c438`, checker door band, roof medallion)
2. `convertible_blue` — **Banshee / Stinger Convertible** (pastel sky-cyan `#56c4e8` open 2-seater with tan interior & chrome windshield frame)
3. `sedan_gold` — **Admiral / Oceanic Sedan** (champagne gold `#dbb978` boxy 80s 4-door)
4. `muscle_purple` — **Voodoo Lowrider** (plum-magenta `#a63a7e` with sweeping chrome/white flank spear)
5. `bug_aqua` — **Blista Compact** (seafoam mint-aqua `#4cd2ba` 80s hatch)
6. `classic_maroon` — **Regina Woody Wagon** (deep burgundy `#9e3c42` with warm oak wood-grain side paneling `#a07044`)
7. `sport_red` — **Infernus / Cheetah** (crimson 80s supercar wedge `#e62e3e`, Testarossa side strakes, rear engine vents, chrome rim gleam)
8. `police_cruiser` — **VCPD Cruiser** (Miami emerald-green `#248e66` & pearl white `#eef4f4` livery, red/blue strobe bar)
9. `coupe_white` — **Deluxo / Stallion Wedge** (clean Miami pearl-white `#eef0f5` angular coupe catching pink/cyan sky reflections)

---

## 4. Hero & Pedestrians (`link.png`, `peds.png`)

- **Hero (`link.png`, `80×100` RGBA, `20×20` cel grid):** *The Wind Waker* **Toon Link** rendered with explicit two-tone cel shading, bold `1 px` dark ink outline (`#181c22`), large expressive head/eyes, golden-yellow hair swoop, vibrant emerald tunic (`#4cc03a` lit / `#297c22` shadow), brown swirl belt, wood/red **Hero's Shield**, and crisp blade glints across all 4 cardinal directions + `drive` frame.
- **Pedestrians (`peds.png`, `624×480` RGBA):** 8 Miami 1986 outfits (Tommy Vercetti homage in cyan palm Hawaiian shirt & jeans, white pastel Crockett suit over pink tee, coral beach resort wear, tan VCPD patrol officer, mint roller/beachgoers) with warm purple-charcoal drop shadows.

---

## 5. HUD, Lighting & Original 1980s Synthwave Audio

- **HUD Chrome (`hud-font.png`, `256×320`):** Bold italic/neon **Vice City** display glyphs paired with signature **electric cyan** clock/cash tint (`#4ef2ff`), **hot-pink** heart/armor/radar rim (`#ff4db8`), and translucent twilight radar plate.
- **Lighting (`lighting/*.png`):** `sunset-wash.png` (aliased as `overcast-wash.png` / `dusk-wash.png`, `420×860`), hot-pink/cyan neon `lamp-glow.png` (`128×128`), warm `headlight-cone.png` (`96×160`), and `blob-shadow.png` (`64×64`).
- **Audio (`audio/*.ogg`, 44.1 kHz Vorbis, 7 original tracks):**
  - `music.ogg`: Original 1980s Miami Synthwave instrumental (`~116 BPM`, gated-reverb snare, Roland Juno-inspired pulse bass, shimmering brass-bell synth progression).
  - `ambience.ogg`: Warm Atlantic Ocean surf crash & gentle coastal palm breeze.
  - `engine.ogg`: Throaty twin-cam 80s Italian wedge V8 / sports coupe exhaust purr.
  - `jingle.ogg`: Cel-shaded *Wind Waker*-inspired bright harp + neon synth pickup chord.
  - `door.ogg`, `footstep-a.ogg`, `footstep-b.ogg`: Crisp steel coupe latch/slam and sunlit boardwalk footsteps.
