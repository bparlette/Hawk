# Bonus Round 2 — Roblox (Studs & Plastic / Jailbreak Look) + R6 Link

## Visual Research Summary (`/tmp/rbx_ref/rbx_jb.mp4` — `9hbOxMsmNtE`)

Captured from real Roblox third-person open-world city gameplay (`Jailbreak` classic + modern hybrid cues):

1. **Palette & Material Language — Smooth Plastic + Molded Studs:**
   - **Roadways & Curbs:** Deep glossy black asphalt (`#141820`) flanked by crisp light-slate (`#8aa0c0`) concrete/plastic curbs and bright off-white painted lane stripes.
   - **Studs & Surface Grain:** Iconic `4×4` circular raised plastic stud matrices pressed across grass lawns (`#2a9828`), beach sand (`#e2cc8c`), sidewalk slabs (`#b8c2ce`), and wooden boardwalk tiles (`#9e6234`), topped with clean plastic specular rim bevels.
   - **Architecture:** Clean geometric blocks — bright cobalt-glass towers (`#3874dc`), dark brick vaults (`#36404e`), glowing warm windows (`#ffe47a`), and hard-edged bright terracotta/white flat roofs.
   - **Atmosphere:** High-clarity daylight/dusk skybox wash (`#7ec4ff` horizon haze to `140 m`).

2. **Vehicles & R6 Pedestrians / Link Hero:**
   - **Vehicles (`sprites.png`):** Glossy ABS-plastic sports hypercars (electric blue `#1658ff` w/ matte black rear wing as seen in `ref1.png`/`ref3.png`, bright yellow cabs, red roadsters, black-and-white Roblox Police Cruiser w/ neon cyan/red siren lightbar).
   - **Peds (`peds.png`) & Hero (`link.png`):** Unmistakable **R6 boxy proportions** — wide cylindrical-top yellow heads (`#f5cd30` classic Roblox Noob & citizen variants), square shoulders, rectangular legs with zero knee joint, and **Roblox R6 Link** sporting a bright green peaked Hero cap, emerald torso w/ brown strap, classic **Linked Sword** glint, and plastic shield!

3. **UI Chrome (`hud-font.png`):**
   - Clean translucent charcoal CoreGui panels (`#1b1e24`), bold sans-serif numerals, glowing orange-ringed circular hotbar slots (`1: Sword`, `2: Pistol/Key`), and red-green Roblox health/speed bars.

## Canonical Framing & C1 Contract

- `era`: `"bonus-roblox"`, **art-only manifest** (zero `viceBeachPlacements` per C1).
- `cameraHint`: `pitchDeg: 40`, `fovDeg: 70`, `distanceM: 49.1` -> `2 × 49.1 × (420/860) × tan(35°) = 33.6 m` canonical horizontal viewport width.
- `fogHint`: `{ "color": "#7ec4ff", "farM": 140 }`.
