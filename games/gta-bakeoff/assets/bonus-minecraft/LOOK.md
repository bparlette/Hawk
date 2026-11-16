# Bonus Round 1 Look Study — *Minecraft* (Voxel Block Edition) + Link Skin

**Deliverable for `bparlette/gta` (`tasking/gemini.md`, Task 10)**  
**Canonical Level:** `level/canonical/vice_beach.json` (identical layout; Vice Beach rebuilt in 16×16 texel voxel blocks & pixel skins)  
**Canonical Framing:** `pitchDeg = 46°`, `fovDeg = 70°` (default Minecraft FOV), derived `distanceM = 49.1 m` -> **`33.6 m` horizontal street width** at `420×860`, **`fogHint.farM = 128` (8 chunks)** sky blue (`#8ec5ff`).

---

## 1. Visual Signature: Nearest-Neighbor 16×16 Block Texels & Sharp Voxel Geometry
- **Crisp Texel Grids (`tiles.png` `2048×832`):**
  - Every `64×64` tile is authored on an exact **4× upscaled 16×16 voxel block grid** (nearest-neighbor texels, zero blurry curves):
    - Roadways (`lids 1, 2, 134`): Deep dark **Blackstone / Deepslate Brick** tarmac + yellow Wool/Terracotta dashed dividers & crisp Quartz crosswalk bars.
    - Promenade & Sidewalk (`lids 8, 93, 141`): Alternating **Oak Wood Plank (`#b88c52`) boardwalk** & beveled **Stone Brick** pavers.
    - Coastal Shore & Pool (`lids 7, 29, 41`): Chunky speckled **Sand Block (`#e2d89c`)**, deep stepped pixel **Water Block** caustics, and Prismarine-cyan swimming pool tiles.
    - Facades & Roofs: Smooth Quartz stucco, Red Terracotta roof stairs, Glowstone / Sea Lantern lit interior windows, and lush Oak Leaf foliage overlays (`lids 21, 126`).
- **Blocky Cars & Mobs (`sprites.png`, `peds.png`):**
  - **9 Voxel Vehicles × 32 Headings:** Chunky stepped fenders, stained black glass windscreens, Glowstone headlamps, Redstone block taillights, including an **Iron-Block & Lapis Police Cruiser**, emerald/gold voxel sports cars, and Oak/Yellow Wool Taxi.
  - **8 Player-Skin Peds:** Classic 8×8 square heads + swinging boxy arms/legs (Steve cyan tee, Alex olive tunic, purple/red jacket skins, Villager tunic, Iron-Helmet Constable).
- **Minecraft Skin Link (`link.png` `80×100`, `20×20` cells):**
  - Square 8-texel voxel head silhouette with trailing blocky pointed cap, vibrant grass-emerald pixel tunic w/ leather chest strap, back-mounted Iron/Lapis **Hylian Shield block**, and glittering cyan **Diamond Sword** at side.
- **Hotbar HUD & Audio (`hud-font.png`, `audio/*.ogg`):**
  - Chunky Mojangles-style pixel typeface, stone-grey **3D-beveled hotbar inventory slots**, classic crisp red **Heart icons**, Azure **Armor chestplates**, Lime **XP meter**, serene wooden-marimba chiptune music (`32.0 s`), XP-orb pickup chime (`2.4 s`), and crisp stone/grass block footsteps.
