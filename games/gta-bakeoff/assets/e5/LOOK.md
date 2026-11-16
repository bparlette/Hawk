# Era 5 Visual Look Spec — *Grand Theft Auto: San Andreas* (2004) × *Twilight Princess* (2004 Reveal Link)

**Reference Material Studied (`research/san-andreas/`):**
- `gtasa-gameplay-grove-street.webp` — Iconic Los Santos cul-de-sac at golden hour: warm peach-amber horizon haze blending into muted dusty teal upper sky, deep olive-teal ambient shadows under palms, warm tan stucco bungalows (`#c8a678`) & lit yellow bungalow windows at dusk, brownish-grey asphalt roads.
- `gtasa-promo-screen03.webp` — Saturated tangerine-gold sunset gradient sky (`#f29224 -> #d86418`), silhouetted BMX frame with orange rim light, warm golden chrome highlights, lowrider sedan parked beside weathered tan clapboard walls.
- `gtasa-promo-screen04.webp` — High-contrast Los Santos midday amber bounce light, ochre LSPD highway patrol motorcycle cop uniform (`#cfa052`), sleek white/black police bike with red/blue lights, weathered stucco apartment blocks.
- `gtasa-promo-screen09.webp` & `gtasa-promo-screen13.webp` — Bold Old English / Gothic white-black-outlined `San Andreas` HUD spirit, chunky ~800-tri Monster pickup w/ treaded off-road tires and painted two-tone stripes, dust kicked into sunlit air.
- `link-twilight-princess-artwork.webp`, `link-twilight-princess-artwork-2.webp`, `link-twilight-princess-epona-artwork.webp` — 2004-reveal **Twilight Princess Link**: grounded realistic proportions, muted sage-green tunic (`#587452`), brass ringmail chainmail visible under collar and hem (`#9e8644`), heavy leather shoulder strap, wrist bracers & chestnut riding boots, steel Ordon/Hylian Shield (`#667084`) with crimson crest, straight steel broadsword.

---

## 1. Era Mood, Camera Framing & Color Grading

- **Palette & Light:** **Golden hour over everything** (`ERAS.md`) — warm amber-apricot directional sunlight (`#f2a854`) cutting diagonally across dusty Los Santos concrete, paired with distinctly cool **teal-slate shadows** (`#2a4444`) and heavy golden atmospheric distance haze (`#d69454`, `farM: 120`).
- **Camera Framing (Locked Series Standard):** `pitchDeg = 42°`, `fovDeg = 60°`, derived portrait `distanceM = 59.6 m` to hold exact **`33.6 m`** canonical horizontal viewport width at `420×860`.
- **Art-Only Manifest (`C1` Rule):** `viceBeachPlacements` omitted — canonical level owns placements exclusively.

---

## 2. Tiles (`tiles.png`, `2048×832` RGBA)

- **Building Walls (`slots 0..197`):** Four Los Santos / Vinewood / Grove Street facade families — warm **sunbaked stucco cottages/apartments**, weathered **Grove clapboard timber siding**, golden-hour **brick storefronts with corrugated shop awnings**, and **downtown glass-grid midrises** glowing warm amber in dusk windows.
- **Ground & Road Surfaces:** Sun-faded brownish-charcoal asphalt (`#58504a`) with crisp bone-white crosswalks and warm gold-ochre centerlines; sandy-tan terracotta Ocean Blvd promenade pavers (`#c8a47c`); warm dust-beige concrete sidewalks (`#beb09c`) with teal shadow kerbs; deep golden-teal Ocean surf (`#26686c`) & shimmering turquoise hotel pool (`#3ca8a4`).
- **Palms & Foliage:** Dense warm-olive & amber-rimlit Los Santos palm frond canopies (`build_sa_palm`).

---

## 3. Vehicles (`sprites.png`, `2048×2048` RGBA, 32-Heading Strips)

Mid-2000s ~800-tri silhouettes with wheel-arch flares, twin racing stripes, roof lightbars, and subtle sky/sunset **env-map reflection bands** across hoods & glass:
1. `taxi_white` — **Cabbie / Los Santos Checker Cab** (warm amber cab yellow `#dba834`)
2. `convertible_blue` — **Comet / Feltzer Soft-Top** (cool dusty teal-blue `#4a8ea6` convertible)
3. `sedan_gold` — **Greenwood / Glendale** (classic Grove Street two-tone cream & champagne-gold `#c4ab72`)
4. `muscle_purple` — **Savanna / Voodoo Lowrider** (Ballas royal violet `#84429e` w/ gold pinstripe spear)
5. `bug_aqua` — **Blista Compact / Hustler** (sage-mint green `#4e9e82` GSF hatch)
6. `classic_maroon` — **Tahoma / Sabre Turbo** (burnt sunset burgundy `#9e3c38` w/ twin cream racing stripes)
7. `sport_red` — **Infernus / Banshee** (glossy crimson-orange `#d83e32` w/ center white-gold Viper stripe)
8. `police_cruiser` — **LSPD Cruiser** (crisp matte black & warm pearl-white `#ece8dc` patrol livery + red/blue lightbar)
9. `coupe_white` — **Elegy / Sultan** (sunlit warm pearl coupe `#e2dccf`)

---

## 4. Hero, Pedestrians, HUD & West-Coast Analogue Audio

- **Hero (`link.png`, `80×100` RGBA):** *Twilight Princess* Link rendered cleanly top-down at `20×20` with realistic elongated limbs, muted sage tunic, brass chainmail shoulder glints, brown gauntlets/boots, grey-blue metallic shield with crimson crest, and steel broadsword.
- **Pedestrians (`peds.png`, `624×480` RGBA):** 8 San Andreas silhouettes — CJ homage (`white_ped`: white tank + baggy blue jeans!), Grove Street green jersey/hoodie (`green_ped`), Ballas purple (`lavender_ped`), tan LSPD motorcycle/foot cop (`cop`), warm orange-shirt Vagos (`yellow_ped`), turquoise Aztecas (`cyan_ped`).
- **HUD Chrome (`hud-font.png`, `256×320` RGBA):** Condensed crisp uppercase/Old-English inspired ivory display type w/ heavy black outline (`$00000000` Grove green cash `#58b454`, deep red health bar `#c43232`, white armor bar, bold square/disc radar rim).
- **Audio (`audio/*.ogg`, `44100 Hz` mono Vorbis):** Warm West-Coast G-funk bass + lead whine + dusty boom-bap drum loop (`music.ogg`), warm coastal evening surf/cicadas (`ambience.ogg`), lowrider V8 idle (`engine.ogg`), harp-meets-G-funk motif (`jingle.ogg`), steel car door & sneaker steps.
