# World Extension — integration notes (data sample, Nov 16 2026)

This sample is **data only**: `shell.json` (surface grid + road traces of real
Miami geography), produced by `tools/extract_shell.py` from Fable's extracted
land/water mask (`sheets/sheet-4.jpg`). No game code was changed. This file is
how the shell plugs into the game later, and what will bite when it does.

## What shell.json holds

- **Grid**: 440 cols × 220 rows of 10-unit (1 m) cells covering
  x ∈ [−4400, 0], y ∈ [0, 2200] — immediately west of the core world
  (1800 × 2200, x ∈ [0, 1800]). Classes: `0` water, `1` land, `2` park.
  Counts: 44,303 water / 50,109 land / 2,388 park cells.
- **Coordinate mapping** (verified from the mask, not assumed): the mask's
  cream grid lines sit every 120 px and its printed labels run −4400 → −400
  across the top and 0 → 2000 down the side, so 120 px = 400 units,
  pixel (0,0) = game (−4400, 0), +x east, +y south (same y-down convention
  as `layout.json`). Landmark cross-checks against sheets 1–3: port island
  NW tip (−2560, 855), Watson Island, the MacArthur strip scans (below).
- **Roads**: three hand-traced polylines in game coordinates —
  `macarthur_causeway` (width 48, 20 pts), `port_boulevard` (48, 13 pts),
  `venetian_causeway` (40, 9 pts). On-land sample shares (share of points
  sampled every 5 units along the trace that land on a non-water cell):
  MacArthur **0.992**, Port Blvd **0.892** (the dip is the marina/channel
  crossing west of the port island, where the mask's strip is fragmented),
  Venetian **0.226** (see risks — the mask draws no roadway there).

## How it plugs in

**Surfaces (`src/world.js`)**: `World` is built from `layout.json`
(`src/main.js` fetches it) and `surfaceAt(x, y)` answers from the shore
function, `roadInfo()` over segment/arc lists, ground rects, defaulting to
`paving`. The shell adds one branch, consulted only outside the core
rectangle (x < 0, or more precisely outside [0, 1800] × [0, 2200]):

1. Convert shell polylines to segments at load and merge them into the
   `roadInfo()` set, so shell roads return `road` / `sidewalk` exactly like
   core roads. Core roads carry one global width (96, `halfRoad` 48);
   shell roads carry per-road widths (48/48/40), so `roadInfo` needs a
   per-segment half-width — a small, contained change.
2. Otherwise look up the grid cell: water → `water`, park → `grass`
   (already in the ground palette), land → `paving` (the core default).
3. Sand: the core derives its beach from `shoreX()` distance; the shell has
   no shore function. Cheapest honest equivalent: a land cell within one
   cell of a water cell paints/queries as `sand` on its water side. Decide
   at integration time; not encoded in the sample.

**Ground painting (`src/ground.js`)**: `GroundPainter` paints 256-unit
chunks at 2 px/unit, sampling `W.surfaceAt()` per pixel — so if `surfaceAt`
answers for negative x, the shell paints itself with the existing painter,
palette and all. No painter changes needed. The cost is chunks: the core is
8 × 9 = 72 chunks and the painter's cache holds ~72 chunks (~72 MB) — i.e.
the whole core, always resident. The shell adds ~18 × 9 ≈ 162 chunks.
Driving the causeway will stream constantly and thrash that cache; the
cache needs an LRU cap raise or an eviction policy before the shell is
drivable end-to-end. This is the biggest perf item.

**Bounds**: `isDrivable()` rejects anything outside `L.world`, and
`src/main.js` clamps both cameras to `layout.world.w/h`. Both need a union
bounds (core ∪ shell) — or `layout.world` grows to {w: 6200, h: 2200} with
an origin offset of −4400, which touches save/spawn/map code. The union
bounds in `World` is the smaller change.

**Roads → facades**: the owner's shell spec is "roads + facades only".
Facade placement can be procedural at load: walk each shell polyline,
sample every ~120 units, and drop a building footprint (rects in the same
format as `layout.buildings`, so `hitSolid` and the baker treat them
identically) on the adjacent land cells, set back from the road edge.
Nothing in the sample pre-commits footprints; the grid + traces are enough
to generate them.

**Untouched**: `layout.json` and everything inside the core rectangle —
surfaces, siege geometry, spawns, jobs, the demo route. The shell is purely
additive geography west of x = 0.

## Risks (honest list)

1. **The seam at x = 0.** The shell's east edge is Miami Beach: land only
   around y ≈ 1100–1600, water north and south of it. The core's west edge
   is city at every y. So the only natural drive connection is the
   MacArthur landfall at (−245, 1275) — a ~245-unit connector across the
   seam at y ≈ 1275 joins the core's west side; everywhere else, driving
   west out of the core reaches bay water within metres. "Shell wraps the
   core" is true geographically, but the *drivable* join is one causeway
   mouth unless more connectors are designed.
2. **Cell coarseness at shorelines.** 10-unit cells step every shoreline
   in 1 m increments (see `sheets/phone_crop.png` — Watson Island's west
   shore and the marina inlets are visibly stair-stepped), and the mask's
   causeway strips are only 30–40 units wide against a 48-unit road:
   road paint will overhang water by ~4–9 units per side unless surface
   lookup treats cells within (road width / 2 + ~10) of a polyline as land
   (a "land apron" under shell roads). Recommended; not in the sample data.
3. **The Venetian Causeway is not in the mask.** Fable's mask classifies
   the water gaps between the Venetian islands as water and draws no
   roadway (trace scores 0.226 on-land). The polyline follows the real
   straight alignment from sheets 1/3, so integration *must* paint this
   road (plus its land apron) from the polyline, never from the grid.
4. **The mask's south is schematic.** No single affine maps the mask onto
   the satellite: the four northern landmarks (port tips, Watson,
   MacArthur landfall) fit to ~7 satellite px, while Brickell Key and
   Fisher Island sit 130–200 px off under the same transform
   (`sheets/verification.png` shows this — trust it along the causeway
   corridor, not south of the port). Fable's mask was evidently stretched
   when assembled. Gameplay geography is unaffected (the game uses the
   mask's own frame), but don't place landmarks by satellite in the south.
5. **Noise cells.** 52 isolated non-water cells sit alone in the bay
   (JPEG/mask specks, visible in the phone crop). A despeckle pass (a cell
   whose 8 neighbours are all water becomes water, and vice versa) should
   run before the grid is consumed, or the painter will dot 1 m islands
   across the bay.
6. **Perf.** Grid lookup is O(1); `roadInfo` over ~42 extra segments is
   the same loop the core already runs. The real costs are the ground
   chunk cache (above) and per-pixel `surfaceAt` during chunk paints —
   the shell branch must stay a couple of array reads.

## Next steps after this sample

1. Owner eyeballs `sheets/verification.png` + `sheets/phone_crop.png`:
   is 10-unit coarseness acceptable at the shorelines, or does the shell
   need a 5-unit grid (4× cells, 4× paint samples) along coasts?
2. Despeckle + land-apron rules folded into `extract_shell.py`; regenerate.
3. `Shell` lookup inside `World.surfaceAt` behind a flag, union bounds,
   per-segment road widths; paint-only drive test down the MacArthur
   Causeway (no facades) against the existing check suite.
4. Procedural facades along the three roads; props/palms pass reusing
   core placement code.
5. Decide the southern geography: accept the mask's schematic south, or
   re-derive Brickell/Fisher placement from sheet-3 before facades land.
