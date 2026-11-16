# Era 6 Visual Look Spec — *Grand Theft Auto IV* (2008) × *Twilight Princess* (2006 Release)

**Reference Material Studied (`research/gta4/`):**
- `gta4-gameplay-niko-gun.webp` — Signature 2008 Liberty City gritty overcast atmosphere: desaturated cool grey-olive stone facades, mist-shrouded Gothic cathedral & skyscraper curtain walls, rain-wet specular asphalt streaks, dark obsidian shadows (`#121614`), somber charcoal tailored suit & muted headlights.
- `gta4-artwork-niko-chase.webp` — Heavy boxy American sedans (`PMP 600` / `Vapid Police Cruiser`) catching streaked overcast fluorescent & tunnel specular reflections across bruised olive/grey/rusted-copper clearcoat paint, chrome bumpers, and red/white lightbars.
- `gta4-gameplay-niko-subway.webp` & `gta4-gameplay-street-vendors.webp` — Grimy tiled masonry, weathered concrete trim, warm-beige fluorescent interior bounce, olive-drab quilted winter vest, distressed denim & rugged work boots.
- `gta4-trailer-nrg900.webp` — Thick volumetric exhaust smoke, sparks, muted metallic fairing (`NRG 900 RR`), amber-grey late afternoon haze (`#88867a`), subtle vignette & film grain.
- `link-twilight-princess-artwork.webp`, `link-twilight-princess-artwork-4.webp`, `link-twilight-princess-epona-artwork.webp` — Release *Twilight Princess* (2006) Link: matte woven olive cloth tunic (`#4e664a`), dark chainmail sleeves/skirt, heavy scarred crimson-brown leather gauntlets & strap, tarnished steel Hylian Shield + dark scabbard, weight-shifted stride with cap brim shadowing brow.

---

## 1. Era Mood, Camera Framing & Color Grading

- **Palette & Light:** **The gritty HD turn** (`ERAS.md`) — overcast late-afternoon Liberty City palette built on desaturated **grey-green-brown** concrete (`#6a6c64`), crushed obsidian shadows (`#101210`), wet-look dark specular asphalt ribbons, strong ambient occlusion along curbs/corners, subtle bloom + film grain/vignette.
- **Camera Framing (Locked Series Standard):** `pitchDeg = 36°` (low longer-lens weighty feel), `fovDeg = 50°`, derived portrait `distanceM = 73.9 m` to hold exact **`33.6 m`** canonical horizontal viewport width at `420×860`.
- **Art-Only Manifest (`C1` Rule):** `viceBeachPlacements` omitted — canonical level owns placements exclusively.

---

## 2. Tiles (`tiles.png`, `2048×832` RGBA)

- **Building Façades (`slots 0..197`):** Four 2008 Liberty City / Broker / Algonquin high-detail gritty stone & masonry families — **weathered limestone gothic stone**, **soot-stained Broker brownstone/brick** w/ modeled AC boxes & iron fire-escape railings, **cool curtain-wall midrise office glass**, and **grimy industrial concrete** w/ damp grime decals near sidewalk joins.
- **Ground & Roads:** Rain-dampened dark specular slate asphalt (`#343638`) w/ wet tire tracks, worn chalk-white crosswalks, muted ochre centerlines; cool wet slate-concrete sidewalks (`#767872`) & pitted curb stones; muted olive-grey promenade masonry; stormy choppy Atlantic Ocean (`#26383e`) & muted slate-jade pool (`#386468`).

---

## 3. Vehicles (`sprites.png`, `2048×2048` RGBA, 32-Heading Strips)

~4k-tri Euphoria/RAGE-era heavy 4-door cruisers, muscle sedans, & LCPD patrol cars with pronounced metallic specular highlights, chrome trim, wheel-well shadow depth, and subtle roof/hood grime:
1. `taxi_white` — **Roman's Esperanto / Liberty Cab** (muted ochre cab yellow `#b68e32`)
2. `convertible_blue` — **Comet / Feltzer** (steel-slate metallic blue `#486274`)
3. `sedan_gold` — **Roman's Huntley / Cognoscenti** (taupe champagne `#887e68`)
4. `muscle_purple` — **Sabre GT / Dukes** (deep eggplant/plum `#583c5c` w/ silver strip)
5. `bug_aqua` — **Blista Compact** (muted slate-teal `#426e6c`)
6. `classic_maroon` — **Marbelle / Buccaneer** (desaturated oxblood `#6e2e2e`)
7. `sport_red` — **Turismo / Infernus / Banshee** (moody ruby-crimson `#9c2a2a` w/ carbon louvers)
8. `police_cruiser` — **LCPD Vapid Patrol Cruiser** (iconic Liberty City crisp ice-white `#d8dce0` & midnight navy `#28384e` doors/stripes + sleek red/blue LED bar)
9. `coupe_white` — **PMP 600 / Oracle** (matte pearl-grey `#b2b6ba`)

---

## 4. Hero, Pedestrians, HUD & Realistic Audio

- **Hero (`link.png`, `80×100` RGBA):** Matte worn cloth *Twilight Princess* (2006) tunic (`#4e6448`), shadowed brow under pointed cap brim, scarred crimson leather gauntlets, steel shield & Master Sword.
- **Pedestrians (`peds.png`, `624×480` RGBA):** 8 gritty Niko/Liberty City 2008 coats — Niko homage (`lavender_ped`: olive-brown leather bomber over grey zip hoodie + dark boots), Roman beige bowling shirt (`yellow_ped`), LCPD hi-vis navy cop (`cop`), charcoal peacoat, denim & wool caps.
- **HUD Chrome (`hud-font.png`, `256×320` RGBA):** Clean thin minimalist sans-serif white glyphs (`Helvetica/Din` inspired), sparse crisp hairline radar bezel, cyan/emerald health-armor half-rings (`no neon cartoon bloat`).
- **Audio (`audio/*.ogg`, `44100 Hz` mono Vorbis):** Sparse moody cold-city synth-bass bed (`music.ogg`), gritty damp NYC rain/traffic/siren horizon wash (`ambience.ogg`), heavy low-RPM V8 idle (`engine.ogg`), understated cool minor bell cue (`jingle.ogg`), muffled heavy modern car door thud (`door.ogg`), crisp boot-on-wet-pavement footsteps (`footstep-a/b.ogg`).
