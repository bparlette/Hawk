# Palm City: World Extension, Fable's candidate (task 11 bake-off)

Owner, Nov 17: "finish your geo and push, I will have Moth do a bake-off." This folder is Fable's
entry. It is the live game (`games/palm-city/`, push #2 build) with **Fable's extension shell**
swapped in. Art, voices and audio load from `../palm-city/` exactly as `pc-audit` does, so this
folder holds code and data only. The live game is untouched.

Play: `games/pc-ext-fable/`. To jump straight to a place, add a static camera: `?cam=-3540,460&t=0.1`
(downtown at golden hour), `&t=0.9` (dusk), `?cam=-1500,1095` (MacArthur Causeway). The HELP menu's
OPEN ROAD JUMP drives the whole course.

## What is different from the live extension

| | Live (Moth) | This candidate (Fable) |
|---|---|---|
| Geography source | the land/water mask Fable presented | **the same supplied sheets**, re-derived by a repo tool (`tools/geo/geo_to_shell.py`). Water/land agrees with the live grid on **97.9 %** of cells |
| Causeways | MacArthur, Port Blvd, Venetian | **the same three traces, verbatim** (so OPEN ROAD and every coordinate in the build stay valid) |
| Downtown | open terracotta land | **a street grid on real arteries**: Biscayne Blvd on the bayfront joins both causeway ends; N Miami Ave, NW 3rd Ave, NW 7th Ave; NE 14th St, NE 8th St, Port Blvd / NE 6th, Flagler St. Core-size blocks, 24-unit sidewalks with curbs and lane paint |
| Brickell | none | Brickell Ave bridge across the river and a two-block grid |
| Buildings | 33 flat painted masses (placeholder pastels) | **19 buildings that wear the game's own baked Blender sprites at 1:1**: office, apartments, warehouse, houses, villas. They get the same colour, shadow and night passes as the opening, plus solids. No two neighbouring blocks repeat a sprite; the core's named landmarks (SOLANA, TACOS, NOVA…) are never reused |
| Ground | land = one terracotta paver | city blocks = paving with plaza / parking / garden lots; open land = garden; Dodge Island = asphalt lots; Watson and the Venetian islands = island gardens |
| Street life | 50 palms | 52 street lamps at the core's spacing (with lamp light, wet reflections and destruction), 74 palms at the core's density, bushes in the gardens, and **84 kerbside parked cars**: real cars, jackable, breakable |

## THE BAR (judged against the opening, phone size 420×860 @2x)

- **Sample** (the causeway plus the first downtown blocks): `shots/ext-bar-opening-golden.png` vs
  `shots/ext-bar-downtown-golden.png`, and `ext-bar-opening-dusk.png` vs `ext-bar-downtown-dusk.png`.
  Same painter strokes, the same baked buildings at the same scale, curbs and lane dashes, parked
  cars, palms. At dusk: the same navy grade, lit windows, and lamp pools at the core's spacing.
  - The first sample failed the bar at dusk. With three times the core's lamp density, the additive
    pools stacked into a milky haze. Iterated to the core's spacing (one lamp per ~280–360 units).
    It then **passed**, and the task's rule took it straight on to phase 1.
- **Phase 1:** `shots/ext-phase1-{brickell,port,causeway,watson,landfall,causeway-dusk}.png`.

**Below the bar / still needs:**
1. **No pedestrians in the shell**, the same as the live extension. The ped system walks the core's
   loop and promenade only.
2. **No moving traffic in the shell**, apart from OPEN ROAD's own route cars. The parked cars are
   real, but nothing drives the downtown grid.
3. **The small islands carry no houses.** The Venetian chain and Watson Island are about 100 units
   across at this scale, and no baked house fits at 1:1. Shrinking sprites would break the bar's
   scale, so they are island gardens.
4. **Only 9 generic baked sprites exist,** so downtown alternates office and apartments. Eight
   towers read as a district, but a real skyline needs new bakes (`tools/bake_sprites.py`).
5. **Airport strip: not built.** The supplied refs stop at downtown and Brickell; Moth's README
   gives no airport bounds.
6. **South of the shell grid** (y > 2200, west of the core), the camera can look past the end of
   the surveyed area onto open "sea". The live build has the same edge.
7. **Owner play on a real phone is the proof that counts.** Everything here is headless.

## Perf (the task's gate: the chunk cache must evict again; frame times must hold)

`CHROME=<chromium> node tools/geo/ext_perf.mjs pc-ext-fable palm-city` drives the whole OPEN ROAD
course (core seam → MacArthur → downtown) at 400 u/s in both builds. It appends to
`shots/ext-perf.jsonl` and reports per-500-unit medians.

Two runs each (headless software raster; compare the two builds against each other, not with a phone):

| Build | p50 | p95 | Chunks painted in-frame | Evicted | Peak cache |
|---|---|---|---|---|---|
| this candidate | 49.9 / 49.9 | 317 / 333 | 66 / 64 | 59 / 58 | 64 |
| live palm-city | 50 / 50 | 250 / 300 | 61 / 67 | 62 / 61 | 64 |

- **The LRU evicts at its 64-chunk cap in both, and frame times match.** The per-segment medians are
  the same 33–50 ms in both builds. The live build's p95 ran lower on both runs (250–300 against
  317–333); the medians are what match.
- Two costs were found and fixed on the way:
  - **Parked-car simulation.** 84 kerbside cars ran collision probes every step: 1.7 ms/step against
    0.6, and 33 ms frames in the core. These cars are now **dormant** until the player is within
    1,400 units, and sleep again beyond 1,700 if untouched; the same objects wake and sleep. Cars at
    rest also skip the collision probe.
  - **Palm overdraw.** The first pass had 200 palms. Each palm draws a long alpha shadow and a scaled
    sprite, so they are now at the core's density.
- A shell chunk paints about 40 % slower than in the live shell (more curbs and lane paint). Painting
  is time-sliced, and the drive shows no frame cost from it.

## How it was made (recreate from paper)

1. **Projection** (`tools/geo/proj.py`): Web-Mercator metres, scaled to 2/3 world unit per ground
   metre and anchored on the MacArthur landfall. Because the supplied sheets are stitched z16/z17
   tiles, `Sheet` snaps their stated bounds outward to whole tiles. It asserts the snap matches every
   sheet's pixel size.
2. **Mask** (`tools/geo/mask.py`): 10-unit cells over x −4400..0, y 0..2200. Each cell is classified
   from the OSM street sheets: water `(170,211,223)`, park greens, otherwise land. The satellite
   overview is the fallback outside them. 3×3 majority per cell, then two 5×5 majority passes.
3. **Layout** (`tools/geo/geo_to_shell.py [sample|phase1]`): run from `games/pc-ext-fable/`, it writes
   `shell.json` and `shell_layout.json` (seeded, deterministic). It:
   - copies the live causeways and the seam connector verbatim;
   - adds the street grid;
   - re-classes land (blocks, lots, gardens, port lots, island gardens);
   - fits baked sprites into blocks (wholly on land, clear of every road and sidewalk, never the same
     as the neighbour);
   - fit-searches the port for warehouses and Miami Beach's west shore and Palm/Hibiscus/Star Islands
     for houses (7 houses and villas fit, wholly on land);
   - lines the streets with lamps, palms and parked cars;
   - prints its counts and the water/land agreement with the live grid.
4. **Engine hooks.** All are in this folder and marked `FABLE candidate`:
   - `world.js`: each road's own sidewalk width; lot classes 3 plaza / 4 parking; garden bushes.
   - `main.js`: the shell's sprite buildings and lamps join the core lists, so they get the core's
     whole treatment. Sprites are aliased by `tpl`. A failed shell load now shows the red error
     banner instead of silently running core-only (audit finding M4).
   - `sim.js`: dormant kerbside cars; cars at rest skip the collision probe.
   - `openroad.js`: the race's downtown leg follows Biscayne Blvd to the Port Blvd corner (the live
     S-leg cut across where this candidate's blocks stand).
   - `tools/extension_check.mjs`: the downtown drivability probe sits on N Miami Ave.
5. **Checks** (from `games/pc-ext-fable/`): `CHROME=<chromium> sh tools/check_all.sh` gives **28/28
   green**. The `palm-city` symlink in this folder lets the browser-half checks resolve
   `../palm-city/` art on the tools' local server; the published page never follows it.
6. **Captures:** `CHROME=<chromium> sh tools/geo/ext_shots.sh` writes the ten `shots/ext-*.png`.
