# Palm City TOOLKIT: test it, fix it, change its look, build new parts

Everything here is a runnable script in this folder (`games/pc-ext-fable/`). Each one works on any
build folder under `games/` where it says `[build]`, so the same tools serve the live game
(`palm-city`), the audit copy (`pc-audit`) and this candidate.

One door: `sh tools/toolkit.sh` prints every command. Browser tools need `CHROME=<path to chromium>`:
- **Mac:** `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` (the default)
- **Cloud box:** `/opt/pw-browsers/chromium`

Node 20+, Python 3 with Pillow and numpy, and `playwright-core` (`npm i` in `tools/`).

---

## 1. What was done (Nov 17, 2026)

| When | What | Where |
|---|---|---|
| Nov 17 a.m. | **Whole-game audit** of the push #2 build: verdict FIX-FIRST, 5 bugs, each reproduced by a probe | `games/pc-audit/AUDIT-REPORT.md`, Hawk 583ba977 |
| Nov 17 | **World extension candidate** (bake-off with Moth): real-geography shell, baked sprites at 1:1, downtown grid, Brickell, port, islands; perf parity with live | `EXTENSION-FABLE.md`, Hawk d9af3601 |
| Nov 17 p.m. | **Natural road colour** (owner: "make roads more natural color"): palette tool + preset `natural-asphalt-v2` applied to this build | §4, `shots/roads-*.png` |
| Nov 17 p.m. | **Audit bugs fixed in this build** and proven by the same probes that found them: **0 BUG lines here, 17 on live** | §3 |
| Nov 17 p.m. | **This toolkit**: probes made build-agnostic, look tools, area report, one entry point | here |

### The road colour change, exactly

- **The old roads:** mauve-lavender asphalt, base `[82,76,86]` with lavender dabs, plus purple oil,
  cracks, manholes and wet troughs. The golden-hour grade measures at about R×1.8, G×1.0, B×0.57,
  which turned that into chocolate-brown roads that read as dirt.
- **Try 1 (`natural-asphalt`):** neutral greys. Under the warm grade it was barely visible: the grade
  wins.
- **Try 2 (`natural-asphalt-v2`, applied):** a **cool charcoal** base `[58,66,80]`, chosen against the
  measured grade so the warm light lands it on warm grey asphalt.
  - Dabs held close to the base, so the brushwork reads as worn tarmac.
  - Oil, cracks, manholes, wet troughs and road glints follow.
  - Parking lots get the same treatment.
  - Kerbs (the plum ink line), lane paint and every other surface are untouched.
  - Dusk is unchanged: night asphalt stays navy.
- **Evidence:** `shots/roads-before-*.png` vs `shots/roads-v2-*.png` (downtown golden, opening golden,
  opening dusk).
- **To put it in the live game:**
  `node tools/look/palette.mjs apply natural-asphalt-v2 palm-city`
  - Undo with `… apply original-palm-city palm-city`; the first apply stores the original as a preset.
  - It is not applied to live yet. That's the owner's call.

### Audit bugs fixed in this build (patches marked `FIX (audit …)`; copy them to live)

| Bug | Fix | File |
|---|---|---|
| H1 JUMP off a boat strands the craft | JUMP releases a ridden craft and sends it home, as a bust does | `src/activities.js` (top of `jump`) |
| H2 Open Road grid car breeds duplicates | A bumped or wrecked grid car rolls home repaired (no spawn). A car the player drove away is released with `fixed=false` and replaced; nothing waits in the circle while you drive it | `src/openroad.js` `ensureGridCar` |
| M1 race traffic parked forever | route cars get `fixed=false` at the end of a run | `src/events.js` `endEvent` |
| M2 JUMP OPEN ROAD seats the wrong car and stacks a duplicate | its own JUMP branch: on foot in the circle beside the grid car, START armed (one press of A) | `src/activities.js` |
| M3 BOATS JUMP strands you in open water | a stray jetski comes home first, and you stand at the mooring | `src/activities.js` |
| L1 heli can't leave the core | flies the shell and the open sea | `src/heli.js` |
| L2 JUMP tiles live while flying | the menu refuses JUMP in the air, as `jump()` does | `src/help.js` |

`tools/help_check.mjs` gained a JUMP-from-a-jetski regression covering seven JUMP targets (audit
finding C2), plus the Open Road on-foot start.

---

## 2. TEST: is the game OK?

| Tool | What it proves | Run |
|---|---|---|
| `tools/check_all.sh` | the 28 rule checks: demo route, skate, feel, destruction, bust, jobs, events, pressure, siege, map, director, turbo, skids, activities, HELP, chase, spotlight, tuning, voices, watercraft, recorder (real video files), polish, extension, Open Road, heli, beauty, instant-start, real-touch controls | `CHROME=… sh tools/toolkit.sh check` |
| `tools/probes/` | **gameplay probes**, the phone-class bugs rule checks miss: JUMP from every mode, duplicates breeding, strandings, every vehicle actually drives, heli range, a full Open Road autopilot run and its leftovers, 6 min of idle traffic. Each `BUG` line is a defect; exit 1 while any remain | `BUILD=palm-city sh tools/toolkit.sh probes` (any build) |
| `tools/geo/ext_perf.mjs` | perf: drives the whole causeway course at 400 u/s and reports frame p50/p95/p99, per-500-unit medians, chunks painted in-frame (hitches), LRU evictions, peak cache. Pass build names to compare | `CHROME=… sh tools/toolkit.sh perf pc-ext-fable palm-city` |
| `tools/profile.mjs`, `tools/frametime.mjs`, `tools/alloc_check.mjs` | render-section timings, demo frame times, allocation per frame (from the perf pass) | see their headers |

**Rule:** a feature isn't done until `check` is green **and** `probes` shows 0 BUG lines. Headless
numbers compare builds against each other; a phone is the real proof.

## 3. FIX: the loop that worked here

1. **Reproduce** with a probe before touching code. Copy the nearest probe in `tools/probes/` (they
   share `common.mjs`, which builds the real world + sim exactly as `main.js` does). Write the bug as
   a `check(name, ok, detail)` that prints `BUG` today.
2. **Fix** in `src/` and mark it `// FIX (…): why`.
3. **Re-run** `probes` (0 BUG lines) and `check` (28 green).
4. **Same probe, other build:** `BUILD=palm-city sh tools/toolkit.sh probes` shows whether live still
   has the bug.
5. **Update the rule check** if the fix changes designed behaviour (as `help_check` did for the Open
   Road start), and add a regression line there too.

## 4. LOOK: change how it looks, then judge it against THE BAR

| Tool | Use |
|---|---|
| `tools/look/palette.mjs` | `list` presets · `show [build]` the PAL rows · `apply <preset> [build] [--dry]`. The first apply saves `original-<build>` (revert by applying it). Presets live in `tools/look/palettes.json`: `pal` rows (base / var / dabs per surface) + `swaps` (hard-coded detail colours). Ground chunks repaint on reload |
| `tools/look/capture.sh` | phone-size (420×860 @2x), pinned-light captures of the standard spots: `opening-golden opening-dusk pier nova downtown-golden downtown-dusk causeway brickell port`. `sh tools/toolkit.sh capture before downtown-golden` → `shots/before-downtown-golden.png`. Add a spot = one line |
| `tools/look/sheet.py` | contact sheet: `sh tools/toolkit.sh sheet out.png shots/a.png shots/b.png --h 600` |

**Recipe:** capture `before` → apply → capture `after` → sheet them beside the opening → judge (texture
density, finish, mood at golden and at dusk) → keep or revert. The grade is strong, so tune against it.
Measure the transfer (mean pixel of a road patch, before vs after, as in §1) instead of trusting the
swatch.

## 5. BUILD NEW PARTS of the map

| Tool | Use |
|---|---|
| `tools/geo/proj.py` | lon/lat ↔ world units (Web-Mercator; 2/3 unit per ground metre; anchored on the MacArthur landfall). Also reads stitched tile sheets at the right pixel |
| `tools/geo/mask.py` | classifies every 10-unit cell from the supplied street maps (OSM water/park colours) with the satellite sheet as fallback |
| `tools/geo/geo_to_shell.py` | the whole extension as data: grid + roads + sprite buildings + lamps + palms + parked cars → `shell.json`, `shell_layout.json` (seeded, deterministic). `sample` or `phase1` |
| `tools/geo/area_report.py` | before you build somewhere: surface shares, roads crossing, what's already there, which baked sprites fit and how often, ASCII map. `sh tools/toolkit.sh area -3700 1750 -3200 2250` |
| `tools/geo/ext_shots.sh` | the extension's BAR captures |

**Recipe: add a district.**
1. **Find room:** `area x0 y0 x1 y1` shows the land share and what fits.
2. **Lay the streets:** in `geo_to_shell.py`, add `road('name', [(x,y), …])`. `walk=24` gives the core's
   sidewalk, and a short `walk` makes a causeway.
3. **Add blocks:** append `(xa, ya, xb, yb, 'kind')` to `blocks` (core-size blocks: ~360 × 350
   between road centres, so a 252-unit sprite fits at 1:1), or add a fit-search region to `REG` for
   loose placement.
4. **Regenerate:** run `geo` (it prints counts and the water/land agreement with the live grid).
5. **Test:** `check`, `probes`, `perf`, then `capture` + `sheet` against the opening.

**Rules learned building phase 1:**
- **Never shrink a baked sprite.** Scale is part of THE BAR; an area too small for a 1:1 sprite gets
  gardens, not toy houses.
- **Match the core's densities.**
  - **Lamps:** one per ~280–360 units. Three times that stacks into a milky dusk haze.
  - **Palms:** ~one per 230 units along a street. Each palm is a long alpha shadow plus a scaled
    sprite; 200 of them doubled frame times.
- **Simulate only what's near.** Shell parked cars sleep until the player is within 1,400 units and
  wake as the same objects. Simulating all 84 everywhere doubled the sim cost.
- **Never let a guardian spawn.** Restore the one object; spawning is how duplicates breed (audit H2).
- **New layout data goes through the existing pipeline:** World, GroundPainter, Renderer statics,
  `destruct.js`. That way new parts inherit shadows, night light, destruction and solids for free.
