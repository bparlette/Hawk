# Era 7 Look Study — *Grand Theft Auto V* (2013) + *Skyward Sword* Link (2011)

**Source Ground Truth:**
- [`research/gta5/`](../../research/gta5/SOURCES.md): Official 2013 Rockstar in-engine frames (`gta5-gameplay-banshee.webp`, `gta5-gameplay-franklin-lamar.webp`, `gta5-gameplay-michael-coquette.webp`, `gta5-gameplay-chop-franklin.webp`) plus 60 fps Los Santos gameplay (`xv3wFGGeIsI`)
- *The Legend of Zelda: Skyward Sword* (2011 Wii): [`link-skyward-sword-artwork.webp`](../../research/gta5/link-skyward-sword-artwork.webp), [`link-skyward-sword-artwork-2.webp`](../../research/gta5/link-skyward-sword-artwork-2.webp), [`link-skyward-sword-render.webp`](../../research/gta5/link-skyward-sword-render.webp)
- Canonical spec: [`ERAS.md`](../../ERAS.md) (e7) & canonical framing (`33.6 m` horizontal viewport width at `420×860`, `pitchDeg = 34`, `fovDeg = 55` -> **`distanceM = 66.1`**)

---

## 1. Visual Signature: Crisp Midday PBR HD & Watercolor Hero Contrast
In contrast to GTA IV's desaturated ash-green gloom (`#686e66`) and wet fog, **GTA V (2013)** snaps the image into **high-contrast Southern California midday sunshine**:
- **Lighting & Atmospheric Key:** Clear deep cerulean sky gradient (`#6eb4e8`), razor-sharp cascaded sun contact shadows along curb lips and building eaves (`~0.75` strength), bright specular highlights on clear-coat paint and swimming pools, zero muddy vignette (`lighting/sunny-hdr.png`).
- **Architecture & Street Surfacing (`tiles.png` `2048×832`):**
  - Clean Mediterranean **white stucco (`#dadad2`), warm sandstone blocks, and glass-railed modern condos** paired with cool terracotta roof trim and crisp skylight cutouts.
  - Sun-bleached dark grey-slate asphalt (`#3a3e44`) with razor-sharp bright chrome-yellow center double lines and pure white crosswalk bars (no GTA IV oil grime).
  - Sparkling turquoise-sapphire coastal pool water & sun-glinting Pacific ocean (`#187ab8` -> `#4cc4e6` shimmer).
- **Vehicles (`sprites.png` `2048×2048`, 9 GTA V Cars × 32 Headings):**
  - High-gloss clear-coat paint finishes with crisp black window gaskets, darkened alloy rims, real windshield specular reflections, and wide sporty silhouettes:
    1. `police_cruiser` (#73): Iconic LSPD **black-and-white** cruiser (`#16181c` fenders/roof/rear + `#f4f6f8` doors) w/ slim red/blue LED lightbar
    2. `convertible_blue` (#57): Midnight **Bravado Banshee** (`#1e4686`) w/ broad twin white racing stripe & side exhaust accents (`gta5-gameplay-banshee.webp`)
    3. `sport_red` (#72): Metallic crimson **Dewbauchee Rapid GT / Coquette** (`#b82224`) w/ clear-coat highlight (`gta5-gameplay-michael-coquette.webp`)
    4. `coupe_white` (#81): Pearl-white **Obey 9F** drop-top coupe (`#e8ecf0`) (`gta5-gameplay-franklin-lamar.webp`)
    5. Plus Los Santos Downtown Cab (sunburst yellow/blue trim), pearl sand luxury coupe, metallic violet muscle coupe, seafoam beach subcompact, and burgundy classic.
- **Pedestrians (`peds.png` `624×480`):**
  - Clean sunlit SoCal variety: Franklin blue denim work shirt over white tee + jeans, Michael charcoal blazer & sunglasses, Vespucci Beach activewear, crisp LSPD patrol officer.
- **Skyward Sword Link (`link.png` `80×100` `20×20` 4-dir + drive):**
  - Derived directly from `link-skyward-sword-artwork*.webp`: **vivid sunlit emerald Knight's Tunic (`#2ca448`)** over creamy off-white trousers (`#dcd0b4`), cool **cerulean-teal watercolor bounce lighting (`#4ea6d4`)** along cap/boots, steel chainmail skirt trim, crimson/azure **Hylian Shield** on back, and **Master Sword** cyan-gold pommel guard.
- **HUD & Audio (`hud-font.png`, `audio/*.ogg`):**
  - Flat modern white bold sans-serif typography, clean cyan-striped rounded-corner weapon wheel badges, modern rectangular radar collar (matching GTA V's green/blue/yellow HUD bars under map), and crisp full-range West Coast electro-funk radio loop (`30.0 s`) + sunny surf/traffic ambience (`24.0 s`).
