# Era 3 Visual & Audio Study (`assets/e3/LOOK.md`)

**Era:** Grand Theft Auto III (2001) + *The Legend of Zelda: Majora's Mask* (2000) — Young Link  
**Canonical Level:** `level/canonical/vice_beach.json` (identical 5-block Vice Beach promenade/road/beach layout, portrait phone framing `420×860`)  
**Ground Truth Studied:** All 7 original-2001 GTA III frames + 4 *Majora's Mask* references in [`research/gta3/`](../../research/gta3/SOURCES.md) (no *Definitive Edition* material used).

---

## 1. Visual Targets Extracted from `research/gta3/`

### Palette & Overcast Atmosphere (`promo-pc-1`, `promo-pc-4`, `promo-pc-7`, `walking-pc`, `stealing-pc`)
- **Muted grey-blue overcast light:** Liberty City sits under a cold slate-cyan/grey overcast sky (`#8ca2ab` horizon haze darkening to `#3a4652` dusk-blue). Ambient illumination is flat and cloudy with low saturation — colors read as weathered urban pigment rather than Miami neon or painted cartoon tiles.
- **Distance fog:** Short ~90 m draw-distance haze (`#7d8e98` daytime overcast / `#36424c` moody late afternoon) swallowing distant skyscrapers and bridge spans (`promo-pc-7`, `driveby-ps2`).
- **Vertex-color-like block shading & heavy contact shadows:** Darker undersides, deep eaves, heavy dark ambient occlusion/blob shadows directly beneath car chassis (`promo-pc-2`, `promo-pc-4`, `stealing-pc`) and pedestrians (`walking-pc`).

### Ground, Road, Water & Architecture (`64×64` early-3D RenderWare grit)
- **Asphalt roads:** Grainy weathered blue-charcoal asphalt (`#4c525a` mid, `#3c4148` tire ruts, `#5d646d` worn crown), cracked centerline oil stains, faded double-yellow center markings (`walking-pc`, `stealing-pc`, `#c49e38`), scuffed off-white crosswalk/lane bars (`#bfc4ca`), dark gutter filth against the curb (`#2d3136`).
- **Sidewalks & Promenade:** Cold concrete pavers (`#8c9198` base, `#9fa4aa` dry highlight, `#696e75` mortar/expansion seams) speckled with loose paper litter (`walking-pc`, `stealing-pc` clearly show blown newspaper sheets glued flat onto sidewalk & street!), plus weathered pinkish-grey-taupe concrete promenade slabs (`#9c8588` muted down from e1/e2's bright coral so Vice Beach still reads unmistakably as Vice Beach while sitting cleanly inside GTA III's grey-blue palette).
- **Curbs:** Thick stone-grey 3D-chamfered curbs (`#a4a8ae` top face, `#5b6068` dark vertical drop edge) framing intersections cleanly (`promo-pc-4`, `stealing-pc`).
- **Vegetation & Sand:** Muted olive-moss grass (`#52613e` / `#404d32` shaded edges, seen in `stealing-pc` & `promo-pc-7`) rather than emerald turf; damp overcast grey-buff beach sand (`#9b9482` dry, `#7c7666` wet/shaded); dark-trunk crossed-quad palm trees with muted sage-olive fronds (`#5c6c42`).
- **Water & Pools:** Murky teal-slate overcast water (`#3a636c` pool / `#304c5a` ocean with subtle low-res scrolling caustics `#5c8791`).
- **Buildings (`<= 12 tris` boxes, `64×64` tiled walls & roofs):** Desaturated red-brown brick (`#7d4b42` in `promo-pc-1`, `promo-pc-2`), dirty buff-grey tenements and fire-escape apartment blocks (`#7c786a`, `#666a70` in `promo-pc-4` & `walking-pc`), dark tar-and-gravel concrete rooftops (`#4d5158`) with thick cast-concrete parapet walls (`#83878e`), corrugated HVAC ducts, and low-poly skylight/elevator boxes. Slots `0..197` in `tiles.png` are re-textured into authentic GTA III brick/concrete/storefront side walls for the upcoming `three.js` 3D extrusion pass.

### Chunkier Early-3D Vehicles (`promo-pc-2`, `promo-pc-4`, `walking-pc`, `stealing-pc`)
- **Silhouette:** Blockier, chunky beveled 2001 RenderWare boxes (`<= 120 tris` feel in top-down/tilted projections) — broad slab hoods with creased power bulges, prominent full-width black/rubber bumper bars (`#1f2226`), chunky wheel-arch bulges, distinct stepped trunk & roof plates, thick windshield pillars (`#202832` dark blue-slate glass with stark diagonal early-3D specular slash).
- **Detail:** Oversized boxy amber/red wrap-around taillight lenses (`#e8861e` / `#c82824` visible in `promo-pc-2`, `promo-pc-4`), recessed grille slots, heavy dark undercarriage blob shadow extending symmetrically around the chassis (`16–20%` wider than body footprint).
- **Same 9 canonical Vice Beach strip slots** re-built from scratch in chunky GTA III proportions: `taxi_white` (GTA III Cabbie/Esperanto mustard-yellow taxi `#cfa026`), `convertible_blue` (Banshee/Stinger metallic ice-blue `#5a7ea4` w/ white racing stripe, straight from `promo-pc-1`/`promo-pc-2`!), `sedan_gold` (Kuruma muted olive-champagne `#8a825c`), `muscle_purple` (Stallion/Diablo dark plum-charcoal `#603e6e`), `bug_aqua` (Blista/Manana muted teal-slate `#487678`), `classic_maroon` (burgundy Mafia/Stallion convertible `#883848` from `stealing-pc`), `sport_red` (Infernus/Cheetah crimson-brick `#b0322c`), `police_cruiser` (LCPD black-and-white cruiser `#24282e` + crisp white doors `#d2d6dc` + blue-red lightbar), `coupe_white` (Sentinel steel-silver `#a2aab2`).

### Pedestrians (`walking-pc`, `promo-pc-4`, `driveby-ps2`)
- **Proportions & clothing:** Chunkier rigid-limb N64/PS2 silhouette (`24×24` cells, slightly squarer shoulders and heavier dark boots/shoes like `promo-pc-1` Claude's thick sneakers and baggy cargo pants).
- **Muted urban wardrobe:** Olive cargo & black bomber jacket (`Claude`-style ped palette variant alongside trenchcoats, beige/slate windbreakers, olive army fatigues seen in `walking-pc`, grey/brown workmen jackets, navy LCPD cop uniforms, muted floral/amber shirt ped in `promo-pc-4`) plus heavy dark contact shadow beneath feet.

### Hero: Majora's Mask Young Link (`model-n64`, `official-artwork`, `tatl-artwork`, `goron-link`)
- **Proportions:** Young Link (10-year-old child stature vs *Ocarina* Adult Link in `e2`): slightly larger expressive head with **parted golden blonde bangs**, pointed ears, bare skin between green **Kokiri Tunic** skirt hem and cuffed brown **Kokiri Boots** (short socks/bare knees), long trailing green **Kokiri Cap**, brown leather chest strap + red-brown waist belt with gold buckle.
- **Gear (`Kokiri sword and shield`):** Silver-tipped bronze-hilted **Kokiri Sword** slung diagonally across his back/side, paired with his **Deku / Young Link Shield** (round tan-bark wooden Deku Shield with dark rim and crimson Kokiri crest, plus steel/cobalt Hero's Shield accent readability at 20×20 sprite scale), and a tiny warm-gold **Tatl** sparkle pixel dot trailing beside him in idle/walk cues.

### Distinctive GTA III HUD & Chrome (`walking-pc`, `stealing-pc`, `ERAS.md`)
- **Typography:** Heavy condensed drop-shadowed **Pricedown-style** rounded display lettering + chunky tabular fixed-width HUD numerals with crisp `1–2 px` black outlines.
- **Signature 4-color HUD palette (from `walking-pc` / `stealing-pc`):**
  - Clock (`03:16`): warm pale gold (`#d8b468`)
  - Cash (`$00095690`): cool steel-ice blue (`#6e98c8`)
  - Armor (`091`): olive-sage green (`#88a454`) + shield icon
  - Health (`100`): coral terracotta orange-red (`#d66246`) + heart icon
  - Wanted stars: 6 black star outlines (`#14161a`) lighting up warm gold (`#e4b22c`)
  - Weapon box (top-right): rounded square frame with golden-amber outline (`#d8a428`) over translucent dark tinted fill (`rgba(16, 18, 22, 0.72)`)
  - Radar disc (bottom-left): muted tan-ochre (`#b89458`) streets on slate-grey water/land (`#647078`), heavy black circular bezel, white player caret & `N` north pip.
- **Dialog/District banner:** Semi-transparent dark slate-black box (`rgba(12, 14, 18, 0.80)`) with subtle thin bevel border and bold off-white/gold display text.

### Audio Character (`ERAS.md`: `low-rate samples (11–22 kHz), short loops`)
- Synthesized original tracks encoded as Vorbis `.ogg` (source sculpted at `22,050 Hz` band-limited gritty early-2001 console/PC sample character before Vorbis output at `22,050 Hz`):
  - `music.ogg`: moody 96 BPM early-2000s Liberty City dark trip-hop / Head Radio / Rise-FM breakbeat bassline + gritty muted Rhodes/string overcast pads + vinyl crackle.
  - `engine.ogg`: rough 2001 granular 4/6-cylinder idle-to-cruise sample loop.
  - `footstep-a.ogg` / `footstep-b.ogg`: heavy PS2 boot-scuff concrete slap & muted damp beach sand crunch.
  - `door.ogg`: chunky metal latch + hollow low-rate sedan door slam.
  - `ambience.ogg`: cold overcast harbor wind, muffled distant bridge traffic rumble, faint distant siren/foghorn bed.
  - `jingle.ogg`: iconic brief major/minor mission-passed synth-chime fanfare inspired by early-3D GTA completion stingers (100% original melody).

---

## 2. Notes & Flags Against `ERAS.md`

1. **`Hero's Shield` vs `Deku Shield`:** `ERAS.md` specifies `Kokiri sword and Deku shield` for `e3`. Inside `research/gta3/`, `link-majoras-mask-official-artwork-zeldawiki.png` and `link-majoras-mask-tatl-artwork-zeldawiki.png` depict Young Link carrying the **Hero's Shield** (metallic/blue-red crest) alongside the Razor/Kokiri Sword, whereas `link-majoras-mask-model-n64-zeldadungeon.png` shows Young Link's N64 in-game model wearing the wooden round **Deku Shield** with red markings. Our `link.png` follows the N64 in-game model (`Deku Shield` silhouette — wooden round tan body with crimson emblem — + Kokiri Sword), matching both `ERAS.md` and `link-majoras-mask-model-n64-zeldadungeon.png`.
2. **2D Atlas + 3D `three.js` Dual Readiness:** Because `ERAS.md` transitions `e3` to `three.js` (`55°` pitch, `64×64` building box textures, blob shadows, overcast distance fog) while the bake-off manifest schema shares `e1`/`e2`'s keys (`tiles`, `sprites`, `peds`, `link`, `hudFont`, `lighting`, `audio`), `assets/e3/` keeps 100% backward-compatible manifest slots AND fills slots `0..197` with genuine GTA III weathered brick/concrete/storefront side textures plus `lighting/blob-shadow.png` and `lighting/overcast-wash.png` (`duskWash` alias included for engine compatibility).
