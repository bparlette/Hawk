# Era 8 Look Study — *Grand Theft Auto VI* (2026 Trailer Look) + *Tears of the Kingdom* Link (2023)

**Source Ground Truth:**
- [`research/gta6/`](../../research/gta6/SOURCES.md): Official Trailer 2 frames (`gta6-trailer2-hanks-waffles.webp`, `gta6-trailer2-bison-pickup.webp`, `gta6-trailer2-city-bus.webp`, `gta6-trailer2-interstate-397.webp`, `gta6-trailer2-la-perle.webp`) plus Official Trailer 2 (`VQRLujxTm3c`) and Trailer 1 (`QdBZY2fkU-0`) Leonida magic-hour & Ocean Beach neon sequences.
- *The Legend of Zelda: Tears of the Kingdom* (2023 Switch): [`link-tears-of-the-kingdom-artwork.webp`](../../research/gta6/link-tears-of-the-kingdom-artwork.webp), [`link-tears-of-the-kingdom-artwork-2.webp`](../../research/gta6/link-tears-of-the-kingdom-artwork-2.webp), [`link-tears-of-the-kingdom-archaic-tunic.webp`](../../research/gta6/link-tears-of-the-kingdom-archaic-tunic.webp)
- Canonical spec: [`ERAS.md`](../../ERAS.md) (e8 — Fable owns the live renderer; we deliver the full photoreal-trailer asset kit under the identical asset contract) & canonical framing (`33.6 m` horizontal viewport width at `420×860`, `pitchDeg = 30`, `fovDeg = 45` -> **`distanceM = 83.1`**)

---

## 1. Visual Signature: Leonida Magic-Hour into Photoreal Neon & Wet Speculars
Compared to GTA V's dry SoCal midday (`#6eb4e8`), **GTA VI (2026 trailer look)** bathes Leonida in **sunset magenta-peach horizon atmospheric scatter fading into hyper-rich nocturnal neon bloom**:
- **Lighting & Atmospheric Key:** Deep sunset violet-indigo zenith grading down through electric **magenta-amber horizon mist (`#d8687c`)** (`lighting/leonida-magic.png`); saturated **hot pink (`#ff3898`), electric cyan (`#28e6ff`), and sodium amber (`#ff9c34`)** emissive building trim and signage casting real colored spill pools directly across sidewalks and damp tarmac.
- **Photoreal PBR Surfaces (`tiles.png` `2048×832`):**
  - High-density Deco stucco, graffiti murals (`Little Haiti / La Perle`), warm wood-grain boardwalk decking, and **lit interior windows with warm/cyan parallax depth gradients** (`#ffbe68` & `#54d8f2` warm/cool interior rooms!).
  - **Wet reflective dark asphalt (`#1c202a`)** embedding shimmering puddle streaks that reflect adjacent magenta, cyan, and amber neon signage.
  - Luminous bioluminescent-teal coastal Key water & backlit pool deck.
- **Light Cards & Anamorphic Streaks (`lighting/*.png`):**
  - Dual **horizontal anamorphic lens flare wisps** on `lamp-glow.png` and saturated **warm-white / cyan-edge LED headlight cones (`headlight-cone.png`)** + crisp volumetric street-lamp haze cards (`neon-pink.png`, `neon-cyan.png` baked cleanly alongside `lamp-glow.png`, `headlight-cone.png`, `blob-shadow.png`, and `leonida-magic.png`).
- **Vehicles (`sprites.png` `2048×2048`, 9 Leonida Trailer Vehicles × 32 Headings):**
  - Hyper-detailed multi-tone roofs, curved windshield pillars, realistic LED head/tail signatures (`|‾|` C-clamp DRLs & lightbar tails):
    1. `police_cruiser` (#73): **Leonida VCPD Tactical Dark-Navy & Metallic Pearl** cruiser w/ modern full-width red/blue LED array (`Trailer 2` night pullover)
    2. `convertible_blue` (#57): Electric Leonida teal-blue **Banshee GTS / Coquette D10**
    3. `sedan_gold` (#60): Metallic champagne-silver **Bravado Bison / Vice truck** silhouette (`gta6-trailer2-bison-pickup.webp`)
    4. `coupe_white` (#81): Satin pearl-white **Inveterate / Cheetah Classic** (`Trailer 1` Ocean Beach!)
    5. `sport_red` (#72): Candy apple crimson supercar w/ twin LED tailblades & carbon vents
    6. Plus Neon Vice Cab (amber/teal livery), deep orchid lowrider, turquoise Keys compact, and burgundy cruiser.
- **Pedestrians (`peds.png` `624×480`):**
  - Vibrant Leonida crowd: Jason rolled-sleeves olive/cream shirt & camo shorts, Lucia white halter / denim / hi-vis orange vest, **Miami Manatees `#10` teal jersey**, neon club nightlife sequins, and VCPD officer.
- **Tears of the Kingdom Link (`link.png` `80×100` `20×20` 4-dir + drive):**
  - Derived straight from `link-tears-of-the-kingdom-artwork*.webp`: **vivid Champion azure blue tunic (`#2488d8`)** over dark navy inner collar & leather shoulder straps, billowing charcoal-navy **Hylian cape** trailing at back/shoulders, gold waist belt + green Zonai Battery vials on hip, and the unmistakable **glowing turquoise-jade Zonai Right Arm (`#36f4d2`)** pulsing clearly in all 4 directions!
- **HUD & Audio (`hud-font.png`, `audio/*.ogg`):**
  - Ultra-crisp translucent modern sans UI glyphs accented with hot pink / electric cyan highlights, sleek rounded minimap frame, and lush trailer-grade modern Miami nocturnal synthwave (`112 BPM`, lush stereo-feel sub bass + Leonida dusk night ambience & modern EV/V8 engine hum).
