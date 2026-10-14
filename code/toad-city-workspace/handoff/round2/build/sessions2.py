# Sonnet, Gemini, Haiku and Grok sessions. SONNET_STATUS_TABLE is filled in by r2gen.py at build time.
from sessions_common import *
from sessions import S

SONNET_ROWS = [  # (id, finding, fix, marker files/regex)
 ('M1', 'Stone water table (1.25 m band) ran across the bottom of every rowhouse door: the stoop climbed into stone (door y 0.76–2.81 vs band 0.16–1.41).', 'Band split around `doorU ± 0.65`, marble threshold added at the sill.', 'fix M1'),
 ('M2', 'Arabber canopy: the half-cylinder swept theta 0..π, so it stood as a striped wall on one side of the cart.', 'Theta starts at π/2 so the arc spans the top.', 'fix M2'),
 ('M3', 'Pony floated 0.20 m: leg pivot at 1.2 with 1.0 m legs.', 'Pivot at 1.0, hooves on y = 0.', 'fix M3'),
 ('M4', 'Parked pickup head/tail-light glows placed twice (`fin()` on already-placed geometry): at (10, 5) yaw π/2 they floated 7 m away.', 'Glow quads built from fresh local geometry; cars are being rebuilt in-house anyway.', 'CARS'),
 ('M5', 'Corner downspout buried in the wall (z −0.12..−0.02) and the climb hook inside the collider: blocks with seed 4 and 16 had no usable climb.', 'Pipe and hook moved to the front of the wall (+0.07 / +0.12).', 'fix M5'),
 ('M6', 'Stoops and cornices overhung the block box by up to 1.83 m; your street view hid it by laying pavement outside the block. In the game the plot is raised to CURB and roads are at y 0, so stoops would hang over the road.', '`opts.inset` (integration passes the plot with a 2 m inset; a 20 m box builds cleanly for 30 seeds).', 'fix M6'),
 ('m1', 'Climb `top` and camera-box `h` measured from the kerb in Task A but world y in Task B (0.16 m apart).', 'World y everywhere: `CURB + parTop`.', 'fix m1'),
 ('m2', 'Yard bin lids at the bin row centre, not on their bins.', 'Lid reuses the bin x.', 'fix m2'),
 ('m3', 'Crab shack posts poke 8.5 cm through the roof, back wall stops 37 cm short, neon floats with no frame, collider misses pots/barrels/easel.', 'Posts cut to the roof line, frame added, collider widened.', 'fix m3'),
 ('m4', "Arabber 'stand' seat floated behind the cart with no step.", 'Rear running board; seat on it.', 'fix m4'),
 ('m5', '`PROP_TILES` fallback unguarded in 4 of 5 Task B files (bare ReferenceError as ES modules).', '`typeof` guard and a clear error everywhere.', 'fix m5'),
 ('m6', '`K.makeAtlas._props`: a cache written onto a kit function.', 'Module-level `WeakMap`.', 'fix m6'),
 ('m7', 'Your viewer did not run on the real kit (`applyLight` signature, pose functions, joint names): "one-line change" was several.', 'Round 2 ships the real kit: your viewer must run on it unchanged.', None),
 ('m8', 'Dragon-boat paddles `frustumCulled = false`: a draw call and a shadow call every frame even off screen.', 'Fixed bounding sphere.', 'fix m8'),
 ('m9', "Corner bar's OPEN neon hidden behind the awning (only 'EN' showed).", 'Moved into the glass-block window below the awning.', 'fix m9'),
 ('m10', 'README claims wrong: "open side windows" were dark panels; "3 casting meshes" were 2.', 'Measured-only README.', None),
 ('m11', 'Formstone read as regular coursed stone; real Formstone is irregular faux stone.', 'Irregular tiles.', 'fix m11'),
 ('m12', 'Sedan, hatch, box truck at exactly 7/7 meshes, skateboard 3/3: no headroom.', '≥ 10 % headroom required in round 2.', None),
 ('m13', 'Every file exported `META`: concatenation failed with "Identifier META has already been declared".', 'Renamed to `META_ROWHOUSE`, `META_CORNER`, … ; round 2 requires unique `META_<MODULE>` names.', 'META_'),
]

SONNET_LESSONS_SHORT = """Lessons to apply in every round-2 asset (each comes from a row above):
1. Test at a non-zero position and yaw (M4) and in a street laid out the game's way (M6), not only at the origin.
2. Check every curved or partial primitive's orientation from three sides (M2).
3. Measure ground contact of every leg, wheel, hull and post (M3, m3).
4. Hooks must be reachable: outside colliders, on a visible surface, world-y heights (M5, m1, m4).
5. Colliders cover everything a character could walk through (m3).
6. No writing onto `K`; caches in module `WeakMap`s; `typeof` guards (m5, m6).
7. Nothing with `frustumCulled = false` (m8); no text hidden behind other geometry (m9).
8. README claims must be measured or seen, never assumed (m10); leave headroom (m12); unique `META_<MODULE>` names (m13)."""

def sonnet_section(sid, slug, title, task, iface, budgets, selfcheck, branch, toks, quiz_extra, imgs, scope, dep='None (parallel with S1–S3).'):
    canaries = [('README.md: the last section heading, exactly', f'## {toks[0]}'),
                ('Every src/*.js file: line 2, exactly', f'// tcr2 {sid.lower()} {toks[1]}'),
                ('Final message: the first line of the filled self-check block, exactly', f'SELF-CHECK {sid} {toks[2]}')]
    quiz = [
     ('In the Task A review, by how much did stoops and cornices overhang the block box, and what inset fixes it?', 'Up to 1.83 m; a 2 m inset (pass the plot with `opts.inset = 2`, i.e. a 20 m box).'),
     ('Why did the parked pickup\'s lights float 7 m away, and why did your previews miss it?', 'The glow geometry was placed twice (`fin()` on already-placed geometry); previews were only at (0, 0) yaw 0.'),
     ('What was wrong with the arabber canopy?', 'The half-cylinder swept theta 0..π, so it stood vertically on one side instead of arching over the cart.'),
     ('Give the exact texture/atlas cache key expression for round 2.', '`K.QUAL || K.THREE || K`'),
     ('What must every module export instead of a bare `META`?', 'A unique `META_<MODULE>` name (e.g. `META_HARBOR_VESSELS`).'),
     ('What is the delivery branch name?', f'`{branch}`'),
    ] + quiz_extra
    hard = sonnet_hard_rules('Push to the branch named in §6 of this prompt, never to `main`.')
    sections = f"""## 1 · Context
{SONNET_CONTEXT}

## 2 · Where you fell short last round and how we fixed it
{SONNET_FELL_SHORT_HEAD}

{{SONNET_STATUS_TABLE}}

{SONNET_LESSONS_SHORT}

**Texture and atlas caches:** key every module-level cache on `K.QUAL || K.THREE || K` (integration may pass a fresh `{{...K}}` per call), and never store a failed draw.

{SONNET_QUALITY_BAR}

## 3 · The task: {title}
{task}

## 4 · Interface and budgets
{iface}

{budgets}

## 5 · Self-test and evidence
- Serve the ZIP root and open `kit/viewer.html` (or your own viewer started from it) on the **real kit**. Day, night (N), every asset.
- Render every asset at **390×844, day and night**, at gameplay distance (6–10 m), plus 1280×720 day/night. Headless Chrome with `--use-gl=swiftshader`; wait for `window.__ready === true`.
- Build every asset at the origin **and** at (10, 5) with yaw π/2; diff their bounding boxes (glows, decals, colliders and hooks must move with the body).
- Run the relevant `harness_ab/` script against your `src/` and keep the JSON under `tools/`.
- Zero console errors.

## 6 · Delivery
- **Branch:** push to **`{branch}`** on `{REPO}`. If your environment forces its own branch name, push there and name it in your first and last message. That is how Task A/B arrived (`claude/new-session-j5l7sz`).
- **Layout:** `src/` (your modules), `kit/` (unchanged copy of the ZIP kit), `viewer.html`, `previews/` (every PNG in §5), `tools/`, `README.md` (exports, how to view, measured table, known issues with measured sizes), `LICENSES.md`, `dist/toadcity_{sid.lower()}_{slug.replace('-', '_')}_v1.zip`.
- Final message to Brad: branch, commit, zip path, and the filled §7.

## 7 · Final self-check (measured numbers only)
{selfcheck}
"""
    S.append(dict(id=sid, ai='SONNET', slug=f'{sid.lower()}-{slug}', title=title, dep=dep, branch=branch, hard=hard, quiz=quiz, canaries=canaries, sections=sections,
                  setting='Claude Sonnet (newest), extended thinking ON, medium effort (high for the first asset, because it sets the pattern).', imgs=imgs, scope=scope))

# ---------------- S1 harbor vessels ----------------
sonnet_section('S1', 'harbor-vessels', 'Harbor vessels: USS Torsk, Lightship Chesapeake, Pride of Baltimore II, small boats',
"""Build the harbour's historic ships and working boats. Real names and liveries are drawn on canvas (allowed: they really are in the Inner Harbor). No logos copied from images.

| id | What | Contract | Notes |
|---|---|---|---|
| `uss_torsk` | **USS Torsk (SS-423)**, a Tench-class WWII submarine, museum ship at Pier 3 | static prop (`out`) | Long dark-grey hull, raised deck, conning tower (sail) with periscope shears, deck gun, the hull number **423** in white, the shark-mouth paint at the bow. Moored: the waterline sits on the water plane. |
| `lightship_chesapeake` | **Lightship Chesapeake (LV-116)**, museum ship at Pier 3 | static prop (`out`) | **Red hull** with **CHESAPEAKE** in large white letters on both sides, white superstructure, the lantern mast(s) with a light that glows at night (`out.glow`), a funnel. |
| `pride_of_baltimore_ii` | **Pride of Baltimore II**, a topsail schooner (Baltimore clipper type) | static prop (`out`) | Black hull with a thin coloured stripe, raked masts, square topsails + fore-and-aft sails (furled or set: pick one, say which), long bowsprit, ensign. Moored. |
| `police_boat` | Harbour police patrol boat | vehicle | White/blue patrol livery with **POLICE** lettering (generic city styling, no real badge art), light bar that flashes at night in `animate`. 2 seats. |
| `tugboat` | Harbour tug | vehicle | Classic Baltimore harbour tug look: high bow fendering, wheelhouse, stack. 1 seat. |
| `kayak` | Single kayak (and a seeded colour variant) | vehicle | Paddle animates in `animate(dt, speed)`. 1 seat, rider sits low. |
| `paddle_boat_dock` | Paddle-boat rental dock (the dragon paddle boats' dock) | static prop (`out`) | Floating dock + gangway + ticket booth + a few berths; `out.hook('board', {x, z, ang})` per berth. **Check `reference/taskAB_v1/veh_boats.js` first:** the paddle boat itself already exists; build only the dock. |

**Scale rule (same as the in-game USS Constellation, see `reference/game_hooks/constellation_scale.md`):** lengths compressed to about 1/3 of real, beam and height about 1/2, so hatches, rails and doors still fit 2 m characters. Footprints you must stay inside (bow along +Z, centred on x = 0, z = 0):""",
"""Static ships: `export function buildUssTorsk(K, out, atlas, x, z, ang = 0, opts = {})` (same for each static id; `atlas = K.makeAtlas(VESSEL_TILES)` from your own tiles file, one atlas ≤ 1024² for the whole session). Write only through `out`; register `out.coll(...)` for the hull, `out.bld(...)` camera boxes, `out.lamp(...)` for any lamp, `out.hook('climb'|'board', …)` where a hero can get on.
Vehicles: `export function buildPoliceBoat(K, opts = {})` returns `{ root, kind: 'boat', seats, collider, waterline, animate(dt, speed, steer) }` exactly like `veh_boats.js` in `reference/taskAB_v1/`. `waterline` is the local y of the water plane; `root` sits so the water plane is y = 0 locally and the game puts it at `WY = −0.85`.
- Pier deck top is `CURB = 0.16`; the water surface is `WY = −0.85`. Moored hulls sit with their waterline at y = −0.85 world (static) and must not intersect the pier volume.
- Footprint (length × beam, hard limits including bowsprit and fenders): Torsk ≤ 30 × 4 m, Lightship ≤ 14 × 4.5 m, Pride II ≤ 17 × 4 m (mast tops ≤ 18 m), police boat ≤ 7 × 2.6 m, tug ≤ 9 × 3.4 m, kayak ≤ 3.6 × 0.8 m, dock ≤ 14 × 6 m.""",
"""| Asset | Cap | Round-2 target (≥ 10 % headroom) |
|---|---|---|
| `uss_torsk` | 6,000 tris | ≤ 5,400 |
| `lightship_chesapeake` | 5,000 tris | ≤ 4,500 |
| `pride_of_baltimore_ii` | 7,000 tris (rigging as thin decal quads with `shadow:false`) | ≤ 6,300 |
| `police_boat` | 2,500 tris, 6 meshes, 2 materials | ≤ 2,250, ≤ 5 meshes |
| `tugboat` | 3,000 tris, 7 meshes | ≤ 2,700, ≤ 6 meshes |
| `kayak` | 600 tris, 3 meshes | ≤ 540, ≤ 2 meshes |
| `paddle_boat_dock` | 2,000 tris | ≤ 1,800 |
| Static pieces | merge into the chunk: 0 extra draw calls | 0 |""",
"""| Asset | Tris | Meshes | Footprint L × B (measured) | Waterline / deck contact | Overhang outside footprint | Moved at (10,5) yaw π/2: everything moved | Day + night 390×844 rendered | Console errors |
|---|---|---|---|---|---|---|---|---|
| uss_torsk | | — | | | | | | |
| lightship_chesapeake | | — | | | | | | |
| pride_of_baltimore_ii | | — | | | | | | |
| police_boat | | | | | | | | |
| tugboat | | | | | | | | |
| kayak | | | | | | | | |
| paddle_boat_dock | | — | | | | | | |
| **Threshold** | §4 targets | §4 targets | §4 footprints | waterline at −0.85 world | 0 m | yes | yes | 0 |""",
 'claude/s1-harbor-vessels', ('Vessel Check 410', 'torsk-periscope', 'lv116-lantern'),
 [('What is the footprint limit for the USS Torsk, and the scale rule?', '≤ 30 × 4 m; lengths about 1/3 real, beam and height about 1/2 (like the in-game Constellation).'),
  ('Which small boat already exists and must not be rebuilt?', 'The paddle boat (`veh_boats.js`); build only the paddle-boat dock.')],
 ['evidence_sheet.png', 'cars_rebuild_sheet.png', 'sedan_v1_day.png', 'dragon_day.png', 'paddle_day.png'],
 'USS Torsk, Lightship Chesapeake (LV-116), Pride of Baltimore II, police boat, tug, kayaks, paddle-boat dock')

# ---------------- S2 interiors ----------------
sonnet_section('S2', 'setpiece-interiors', 'Set-piece interiors: National Aquarium halls and the Science Center IMAX/planetarium',
"""Build two arena-sized brawl interiors that plug into the game's landmark hooks (`reference/game_hooks/landmark_hooks.js`):
- `LMHOOK.aquarium` = `{ stub: true, kind: 'underwater_tank', door: {x, z}, tank: { x: 17, y: CURB + 1, z: -19.5, w: 10, d: 11, h: 12 } }` (boss: Big Jimmy, a giant blue crab, fought underwater).
- `LMHOOK.science` = `{ stub: true, kind: 'imax_theatre', door: {x, z}, screen: { x: -46.8, y: CURB + 1, z: 58, w: 8, h: 6, facing: 'west' }, hall: { x0, x1, z0, z1 } }` (boss: Dr. Shellacious, a mad snapping-turtle scientist).

Interiors are **separate rooms** entered through `door`: you build them at a local origin, the game places them off-map and teleports in. The hook values above tell you where the door and screen are in the city; inside you are free within the footprints below.

**`aquarium_interior`**: the ring-tank hall: a central cylindrical tank you walk around on a **spiralling ramp** (2 turns, ≥ 3 m wide, with rails); the **Atlantic coral reef** tank (colourful canvas coral, a school of fish as one animated layer) and the **shark tank** (big glass wall, 3–5 sharks on a slow loop). The bottom of the ring tank is the boss floor: a walkable `underwater: true` zone where Big Jimmy fights. Blue water light, caustic pattern on the floor (canvas, animated by UV offset only).
**`science_imax`**: the IMAX / planetarium hall: raked seating rows (walkable steps), the big curved screen (canvas starfield / planets that glow at night and by day: it is indoors), the projector booth at the back, the planetarium dome above, exhibit plinths on the floor in front of the screen as cover. Dr. Shellacious fights on the stage in front of the screen.""",
"""```js
export function buildAquariumInterior(K, out, atlas, opts = {}) -> {
  footprint: [w, d], heroSpawn: {x, y, z, ang}, bossSpawn: {x, y, z, ang},
  spawns: [{x, y, z, ang}, …],            // ≥ 8 thug spawn points, all on walkable floor, ≥ 2 m from walls
  exits: [{x, z, ang, to: 'door'}],        // back to the city door
  zones: [{ kind: 'underwater', x0, x1, z0, z1, y0, y1 }],   // aquarium only
  lights: [{ x, y, z, color, intensity, range }],             // ANCHORS only: the game's pooled lights use them; never add THREE lights
  animate(t) {}                             // optional: fish/shark/caustic layer (≤ 2 draw calls), no per-frame allocation
}
export function buildScienceImax(K, out, atlas, opts = {}) -> { same shape, no zones }
```
- All static geometry through `out` (solid / decal / glow), colliders through `out.coll`, camera boxes `out.bld` (the camera must never clip a wall: give every room part a camera box), lamps `out.lamp`.
- Walkable surfaces are flat or ramps ≤ 20 % grade; every step ≤ 0.35 m. Return the ramp as a list of walkable slabs in the result: `walk: [{x0, x1, z0, z1, y0, y1}]` so the game can compute floor height.
- Footprints (hard limits): aquarium ≤ 40 × 40 m, height ≤ 16 m; IMAX ≤ 32 × 28 m, height ≤ 14 m. Nothing outside.""",
"""| Asset | Cap | Round-2 target |
|---|---|---|
| `aquarium_interior` | 40,000 tris, 6 draw calls (4 merged layers + ≤ 2 animated) | ≤ 36,000 tris, ≤ 6 calls |
| `science_imax` | 30,000 tris, 5 draw calls | ≤ 27,000 tris, ≤ 5 calls |
| Atlas | one 1024² canvas atlas for both rooms | one |
| Thug spawns | ≥ 8 per room, on walkable floor, ≥ 2 m from walls and colliders | ≥ 8 |""",
"""| Check | aquarium_interior | science_imax | Threshold |
|---|---|---|---|
| Tris / draw calls | | | §4 targets |
| Footprint measured (w × d × h) | | | ≤ 40×40×16 / ≤ 32×28×14 |
| Spawns: count / min distance to a wall or collider | | | ≥ 8 / ≥ 2 m |
| Max step height / max ramp grade | | | ≤ 0.35 m / ≤ 20 % |
| Camera boxes cover every wall (camera never clips at 6 m) | | | yes |
| Light anchors returned / THREE lights created | | | ≥ 1 / 0 |
| `animate` allocations per frame | | | 0 |
| Day + night 390×844 renders (hero spawn, boss spawn, overview) | | | yes |
| Console errors | | | 0 |""",
 'claude/s2-setpiece-interiors', ('Interior Check 410', 'ring-tank-ramp', 'planetarium-lantern'),
 [('What are the aquarium tank hook values (x, z, w, d, h)?', 'x 17, z −19.5, w 10, d 11, h 12 (y = CURB + 1).'),
  ('How many thug spawns per room, and how far from walls?', '≥ 8, at least 2 m from walls and colliders.')],
 ['evidence_sheet.png', 'cars_rebuild_sheet.png', 'block_night_close.png', 'street_game_night.png'],
 'National Aquarium interior (ring tank + ramp, Atlantic coral reef, shark tank) and Science Center IMAX/planetarium hall, with colliders, light anchors, spawns')

# ---------------- S3 street props 2 ----------------
sonnet_section('S3', 'street-props-2', 'Baltimore street-life props, batch 2',
"""Build these static props (all through `out`). **Already covered by Task A/B, do not duplicate:** acorn and cobra lamps, park bench, bus-stop bench with its pole sign, trash cans, crab shack, manholes, ladders, parked cars, and in Task A: 6 painted screens (cottage, swan, lighthouse, sail, crab, heron), shop boards CORNER MARKET / CARRYOUT / BARBER / HARDWARE / LAUNDROMAT / DELI, bar boards TAVERN / CRAB HOUSE / BAR & GRILL, the Natty Boh-style blade sign, Utz and Old Bay window signs.

| id | Prop | Notes |
|---|---|---|
| `bus_shelter` | Bus shelter | Glass-and-steel shelter with its own bench, route map panel and an **MTA Maryland-style** route sign drawn on canvas (real agency, redrawn). Do not re-create `bench_bus`'s pole sign. |
| `boh_tower_sign` | Rooftop tower sign in the National Bohemian tower style | A rooftop lattice tower with a big round lit sign. **Original artwork and wording** (no Mr. Boh face, no real slogan): a winking one-eyed crab or a generic "B-MORE BEER" style mark. Glows at night. |
| `screen_windows_2` | Painted window screens, batch 2 | 6 **new** screen designs not in Task A's list (e.g. a row of rowhouses, the harbour skyline at sunset, a mountain cabin, ducks on a pond, a lighthouse alternative, a waterfall), as a prop that fits any window `(w, h)`. |
| `stoop_chalk` | Marble-stoop kids' chalk decals | Hopscotch, hearts, a sun, names, a chalk crab; flat decals on pavement and the bottom step (z-offset ≥ 4 mm, `shadow:false`). |
| `team_banners` | Lamp-post banners | Orange/black bird-style and purple/black raven-style banners, **original marks only** (no team logos, no team names), plus a neutral "BALTIMORE" harbour banner. Hang from the acorn lamp arm height (3.4–4.2 m). |
| `snowball_stand` | Baltimore snowball stand | Small shed/counter with a flavour board (egg custard, skylight, chocolate with marshmallow), cups, umbrella. Glows at night. |
| `corner_store_signs` | Corner store / bar / carryout sign set | Blade signs, awning lettering and window decals that take any text from a table (`opts.name`, `opts.kind: 'store'|'bar'|'carryout'`), drawn with the same board style as Task A. The name table comes from session H1 later; ship 6 sample names. |
| `light_rail_stop` | Light-rail stop | Low platform with tactile edge, shelter, ticket machine, the station sign drawn MTA-style, and a short length of track + catenary poles (geometry only, no train). |""",
"""Each prop: `export function buildBusShelter(K, out, atlas, x, z, ang = 0, opts = {})` (same signature shape as `example_bench.js`). One atlas for the whole session (`PROPS2_TILES`, ≤ 1024²). Hooks: `out.hook('seat', …)` on benches, `out.lamp(…)` for lit signs. Footprints (hard limits, including canopy and sign overhang): shelter ≤ 4 × 1.8 m, tower sign base ≤ 3 × 3 m (height ≤ 9 m above its roof base), stand ≤ 3 × 2.5 m, light-rail stop ≤ 12 × 4 m (track length included), banners within 0.9 m of the pole.""",
"""| Prop | Cap (tris) | Round-2 target |
|---|---|---|
| bus_shelter | 900 | ≤ 810 |
| boh_tower_sign | 1,200 | ≤ 1,080 |
| screen_windows_2 | 40 per screen | ≤ 36 |
| stoop_chalk | 60 per decal set | ≤ 54 |
| team_banners | 120 per pole | ≤ 108 |
| snowball_stand | 1,000 | ≤ 900 |
| corner_store_signs | 200 per sign | ≤ 180 |
| light_rail_stop | 2,000 | ≤ 1,800 |
| All | merged into the chunk: 0 extra draw calls | 0 |""",
"""| Prop | Tris | Footprint measured | Overhang outside footprint | Floats / sinks (min y vs base) | Moved at (10,5) yaw π/2: everything moved | Hooks reachable (outside colliders) | Day + night 390×844 | Console errors |
|---|---|---|---|---|---|---|---|---|
| bus_shelter | | | | | | | | |
| boh_tower_sign | | | | | | | | |
| screen_windows_2 | | | | | | | | |
| stoop_chalk | | | | | | | | |
| team_banners | | | | | | | | |
| snowball_stand | | | | | | | | |
| corner_store_signs | | | | | | | | |
| light_rail_stop | | | | | | | | |
| **Threshold** | §4 | §4 | 0 m | 0 m | yes | yes | yes | 0 |""",
 'claude/s3-street-props-2', ('Stoop Check 410', 'snowball-custard', 'lightrail-lantern'),
 [('Which painted screen designs already exist from Task A?', 'Cottage, swan, lighthouse, sail, crab, heron (6).'),
  ('Where does the corner-store name table come from?', 'Session H1 (Haiku) later; ship 6 sample names now.')],
 ['evidence_sheet.png', 'cars_rebuild_sheet.png', 'stoops_close_day.png', 'corner_bar_phone_night.png', 'props_lamps_phone_night.png'],
 'Bus shelter (MTA-style), boh-style tower sign (original), screens batch 2, stoop chalk, original team-style banners, snowball stand, corner-store sign set, light-rail stop')

# ---------------- GEMINI ----------------
QA_GATES = """Use the scoring format in `qa/QA_GEMINI_PRO_review_prompt.md` exactly: the summary table per asset (Gates I/B/O, Style, Read, Night, Func, Code, Docs, Total, Verdict), then numbered findings `[severity] file:line — what → exact fix`, then "Top 3 fixes"."""

def gem(sid, slug, title, task, attach, toks, quiz, scope, dep, selfcheck):
    canaries = [('Report: the last heading, exactly', f'## {toks[0]}'),
                ('Report: the first line, exactly', f'QA-REPORT {sid} {toks[1]}'),
                ('Report: the line right after the summary table, exactly', f'Rubric version: tcr2-{toks[2]}')]
    hard = f"""1. You are a reviewer. You never rewrite whole files; you give targeted, numbered fixes with numbers.
2. Judge each delivery only against its own brief and the lessons in this prompt.
3. Every claim cites a file and line, a measured number, or a named image. Anything you cannot verify is marked UNVERIFIED with the evidence you need.
4. Do not trust README numbers: recompute what you can from the code (part counts, segment counts, materials).
5. Characters must be original (no real people, mascots, team marks, brand logos). Environment may use real Baltimore names where they really are, redrawn in code.
6. Use the real game facts in §3, not general three.js assumptions.
7. Score with the rubric in `qa/QA_GEMINI_PRO_review_prompt.md`: PASS needs all three gates, total ≥ 75 and no category at 0.
8. Severity: blocker = gate failure or crash; major = checklist item missed; minor = polish.
9. Read Hark's own review only after you finish yours, then add a "Coverage vs Hark" section.
10. Output markdown only, in the order of §5.
11. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**."""
    sections = f"""## 1 · Context
Toad City Baltimore is a phone-first, cel-shaded three.js r160 brawler on Baltimore's Inner Harbor; every asset is procedural code. Builders (Claude Opus: characters; Claude Sonnet: environment) deliver modules; Hark (the in-house integrator) reviews them against the **real** game code. You are the independent second reviewer.

## 2 · Where reviews fell short last round
Last round's builder viewers hid real bugs because they ran on stand-in kits: a stand-in `down` pose hid the Harbor Rats tail going 0.67 m through the floor; single-asset previews at (0, 0) yaw 0 hid Sonnet's pickup lights floating 7 m away; pavement laid outside the block hid 1.83 m stoop overhangs. A review that only reads the README and the previews would have passed both. **Your job is to catch what the previews cannot show.**

## 3 · Real game facts to check against
- Real thug `down`: rig flat on its back (`tilt` −π/2 + 0.08), arms overhead (`shL` −2.6, `shR` −2.4); everything behind the hips points at the floor.
- Knock-down: hop vy 4.2, gravity 22, `down` at rate 13, getup after 1.25 s (getup 0.5 s at rate 14).
- The game has **no LOD swap**: `rigLod` only hides hulls and stops shadows beyond 24 m.
- `mergeRig` merges every part per material into skinned meshes: rigs must be plain groups with extras under skeleton joints and at most one mapped sub-material sharing `flash`/`flashC`.
- Texture caches must be keyed on `K.QUAL || K.THREE || K` and never cache a failure.
- `shadow: false` on every `outline: false` part and every part thinner than 4 cm.
- Static props merge into 64 m chunks; the plot is raised to CURB 0.16 with roads at y 0; a 2 m inset is required for rowhouse fronts.
- Budget headroom expected from round 2: gangs ≤ 36 parts / ≤ 10,800 tris; bosses ≤ 63 / ≤ 19,800; props and vessels ≥ 10 % under cap.

## 4 · The task: {title}
{task}

**What Brad attaches to this chat:** {attach}

## 5 · Output
{QA_GATES}
Then a section "Coverage vs Hark" (after reading Hark's review): what you found that Hark missed, what Hark found that you missed.

## 6 · Final self-check (fill in before you send the report)
{selfcheck}
"""
    S.append(dict(id=sid, ai='GEMINI', slug=f'{sid.lower()}-{slug}', title=title, dep=dep, branch='— (reply in chat)', hard=hard, quiz=quiz, canaries=canaries, sections=sections,
                  setting='Gemini Pro (newest), thinking set to high.', imgs=['harbor_rats_fixes_compare.png', 'evidence_sheet.png', 'after_down_side_grunt_a.png', 'before_down_side_grunt_a.png'], scope=scope, attach=attach))

GEM_SC = """| Check | Value | Threshold |
|---|---|---|
| Assets scored | | every asset in the delivery |
| Findings with a file:line or a measured number | | 100 % |
| Numbers recomputed from code (not copied from README) | | ≥ 3 per asset |
| UNVERIFIED items, each with the evidence needed | | listed |
| Coverage vs Hark section present | | yes |"""

gem('G1', 'qa-harbor-rats-v2', 'Independent QA of Harbor Rats v2',
"""Review **Harbor Rats v2** (Hark's fixed version) against `briefs/TASK_C_thug_gangs.md` and `briefs/TASK_C_review_lessons.md`. Inputs: `reference/harbor_rats/gang_harbor_rats_v2_FIXED.js`, the v1→v2 diff, `README_harbor_rats_v2.md`, `previews/harbor_rats/`. Score each member (grunt_a, grunt_b, armed, bruiser) and the LOD set. Check in particular: does every lesson (1–8) hold in v2? Is the 40/40 part count a problem now that round 2 asks for headroom? Does `animateGang` handle every game state? Any new issue the fixes introduced (e.g. the diamond now proud of the belly, ears moved)?""",
'`Toad_City_Round2_GEMINI.zip` (it contains the v2 module, diff, README and previews). Optional: the Hawk repo URL https://github.com/bparlette/hawk (v1 is on branch `claude/new-session-z5ikqq`; the v2 fix branch `hark/harbor-rats-fixes` is local to Hark and is only in the ZIP unless Hark pushes it).',
('Rat Review Check 410', 'oar-band', 'mustard-diamond'),
[('By how much did the v1 Harbor Rats tail go through the floor in the real down pose (grunts)?', '0.67 m (−0.67 m lowest point; bruiser −0.80 m).'),
 ('Which preview trick hid Sonnet\'s 1.83 m stoop overhang?', 'Their street view laid the pavement outside the block.'),
 ('What does the game\'s `rigLod` actually do beyond 24 m?', 'Hides ink hulls and stops shadow casting; there is no LOD swap.'),
 ('What gang part-count target does round 2 set?', '≤ 36 parts (≤ 10,800 tris).'),
 ('When do you read Hark\'s own review?', 'Only after finishing yours, for the "Coverage vs Hark" section.')],
 'Independent QA of Harbor Rats v2 (Hark fix) vs TASK_C + lessons', 'None. Send any time.', GEM_SC)

gem('G2', 'qa-sonnet-taskab-fixed', 'QA of Sonnet Task A/B after Hark\'s fixes',
"""**Send only after Hark tells Brad the fix pass has landed.** Review Sonnet's Task A/B **after** Hark's fixes: `reference/taskAB_fixed/` (the snapshot in this ZIP may be older: use the files and preview PNGs Hark sends with the go-ahead), against `briefs/TASK_A_rowhouse_city_block_kit.md` and `briefs/TASK_B_street_props_vehicles.md`. For every finding M1–M6 and m1–m13 in Hark's review, mark FIXED / PARTIAL / OPEN with evidence, then do a full new pass. Cars are being rebuilt in-house: score the new cars against `previews/taskAB/cars_rebuild_sheet.png` only if Hark includes them.""",
'`Toad_City_Round2_GEMINI.zip`, plus the fixed `vendor/taskAB` files and the after-fix preview PNGs that Hark sends Brad when the fix pass lands. Original delivery: https://github.com/bparlette/hawk/tree/claude/new-session-j5l7sz.',
('Rowhouse Review Check 410', 'water-table', 'arabber-canopy'),
[('What was finding M1 in Task A?', 'The stone water table covered the bottom of every rowhouse door.'),
 ('What inset fixes the stoop overhang?', '2 m (a 20 m box from a 24 m plot).'),
 ('When may this session be sent?', 'Only after Hark says the fix pass has landed.'),
 ('What three labels do you give each earlier finding?', 'FIXED / PARTIAL / OPEN.'),
 ('Where were climb-hook heights measured from in Task A before the fix?', 'From the kerb (Task B used world y); the fix uses world y everywhere.')],
 'QA of Sonnet Task A/B after Hark\'s fixes (send after Hark says the fix pass landed)', 'Hark\'s Task A/B fix pass must land first (Hark tells Brad).', GEM_SC)

gem('G3', 'qa-standing-template', 'Standing QA template for every new delivery',
"""Write a **reusable QA prompt** that Brad can paste for every future delivery (gangs, bosses, vessels, interiors, props, Haiku tables, Grok writing). It must:
1. Start with a 10-line intake checklist (layout, kit byte-identical, branch named, canaries present, self-check filled).
2. Have one block per asset family with the real-game checks from §3 that apply (characters: real `down`, mergeRig, shadows, cache key, headroom; static props: chunk merge, footprint, (10,5)-yaw test, world-y hooks; vehicles: waterline, seats, collider; data/text: schema valid, no trademarks, PG-13).
3. Include a canary/self-check verification step that asks Brad to paste the session's expected strings (Brad keeps them privately) and reports found / missing without echoing them first.
4. End with the output format from `qa/QA_GEMINI_PRO_review_prompt.md`.
Deliver it as one markdown code block titled `TOAD CITY QA TEMPLATE v2`, ≤ 180 lines.""",
'`Toad_City_Round2_GEMINI.zip` only.',
('Template Check 410', 'intake-ten', 'family-blocks'),
[('How many lines may the intake checklist have?', '10.'),
 ('What is the code-block title of the template?', '`TOAD CITY QA TEMPLATE v2`'),
 ('What is the maximum length of the template?', '180 lines.'),
 ('How does the template handle canary strings?', 'Brad pastes the expected strings privately; the template reports found / missing without echoing them first.'),
 ('Name the static-prop position test round 2 requires.', 'Build at the origin and at (10, 5) with yaw π/2 and check everything moved.')],
 'Standing QA template for every new delivery', 'None. Send any time.', GEM_SC.replace('Assets scored', 'Template families covered').replace('every asset in the delivery', '7 families'))

# ---------------- HAIKU ----------------
def haiku(sid, slug, title, task, schema, toks, quiz, scope, selfcheck, dep='None. Send any time.'):
    canaries = [('Output JSON: a top-level key "_canary" whose value is exactly', f'tcr2-{sid.lower()}-{toks[0]}'),
                ('Output: the line right before the first JSON block, exactly', f'HAIKU-OUT {sid} {toks[1]}'),
                ('Final message: the first line of the filled self-check block, exactly', f'SELF-CHECK {sid} {toks[2]}')]
    hard = f"""1. Output only what §4 asks for, in the exact schema. No prose inside the JSON.
2. Valid JSON (RFC 8259): double quotes, no trailing commas, no comments.
3. No real trademarks or brand names unless §3 explicitly lists them as allowed.
4. No duplicates: every entry unique by the field §4 names.
5. Colours are 6-digit hex `#rrggbb`, mid-value (each channel 0x30–0xe8), never pure black or white.
6. PG-13: no slurs, no profanity beyond mild, no real people.
7. If a field's allowed values are listed, use only those values.
8. Count your entries before you finish; the counts are exact, not approximate.
9. Long output: split into numbered parts only if you must; each part valid JSON on its own.
10. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**."""
    sections = f"""## 1 · Context
Toad City Baltimore is a phone-first cel-shaded brawler on Baltimore's Inner Harbor. The rowhouse kit (built by Sonnet, fixed in-house) draws Baltimore rowhouses, corner stores and street signs procedurally; it reads variation tables to make every block different. You produce those tables.

## 2 · Where helpers fell short last round
Last round's builders guessed values the game could not consume and wrote README numbers nobody measured. For tables that means: every value must match what the kit actually reads (the allowed values below are copied from the kit's code), and every count must be exact.

## 3 · The task: {title}
{task}

## 4 · Exact schema
{schema}

## 5 · Final self-check (fill in with counted numbers)
{selfcheck}
"""
    S.append(dict(id=sid, ai='HAIKU', slug=f'{sid.lower()}-{slug}', title=title, dep=dep, branch='— (reply in chat)', hard=hard, quiz=quiz, canaries=canaries, sections=sections,
                  setting='Claude Haiku (newest), extended thinking OFF.', imgs=['stoops_close_day.png', 'corner_bar_phone_day.png', 'houses_day.png'], scope=scope))

STREETS = ['Pratt Street', 'Lombard Street', 'Light Street', 'Charles Street', 'Calvert Street', 'South Street', 'Gay Street', 'President Street', 'Market Place', 'Water Street', 'Redwood Street', 'Baltimore Street', 'Fayette Street', 'Key Highway', 'Covington Street', 'Battery Avenue', 'Hanover Street', 'Cross Street', 'Hamburg Street', 'Montgomery Street', 'Warren Avenue', 'Henrietta Street', 'Riverside Avenue', 'Fort Avenue', 'Clement Street', 'Churchill Street', 'Grindall Street', 'Hill Street', 'Randall Street', 'Williams Street', 'Lee Street', 'Hughes Street', 'Thames Street', 'Aliceanna Street', 'Fleet Street', 'Eastern Avenue', 'Broadway', 'Ann Street', 'Wolfe Street', 'Bond Street', 'Caroline Street', 'Lancaster Street', 'Fell Street', 'Shakespeare Street', 'Durham Street', 'Dallas Street', 'Chester Street', 'Washington Street', 'Boston Street', 'Central Avenue', 'Exeter Street', 'Albemarle Street', 'High Street', 'Eden Street', 'Spring Street', 'Wills Street', 'Philpot Street', 'Lancaster Street', 'Conway Street', 'Barre Street', 'Lee Street', 'Camden Street', 'Sharp Street', 'Howard Street', 'Eutaw Street', 'Paca Street', 'Hanover Street']
STREETS = list(dict.fromkeys(STREETS))

haiku('H1', 'variation-tables', 'Variation tables: rowhouse combos, store names, street signs',
"""Produce three JSON tables in one JSON object.
1. **`rowhouses`: exactly 200** rowhouse variation combos, each a valid set of the kit's `buildRowhouse` overrides (allowed values below, copied from `rowkit_rowhouse.js`) plus three new colour fields the integration will consume (`trim`, `awning`, `awningStripe`). Make them look like real Baltimore blocks: mostly brick and Formstone, painted brick in pastel trims, a few permastone; cornice colours from the list; awnings on about a third.
2. **`signs`: exactly 120** plausible, **original** corner-store, bar and carryout names in the Baltimore vernacular (e.g. the style of "Charm City Carryout", "Hon's Corner Tavern", "Locust Point Deli"), with the board colours. No real trademarks or existing business names you know of; no brand names (no Natty Boh, Utz, Old Bay, Domino in names). Mix: 50 store, 40 bar, 30 carryout. Text ≤ 16 characters per line so it fits a 4:1 board.
3. **`streets`: exactly 80** street-name signs using **only** the real Inner Harbor / Federal Hill / Fells Point street names listed below (you may repeat a street with a different block number or neighbourhood placement, but each `id` is unique). Block numbers must be plausible hundreds (100–2900).

Allowed street names: """ + ', '.join(STREETS) + '.',
"""```json
{
  "_canary": "…",
  "rowhouses": [
    { "id": "rh001",
      "front": "formstone | brick | permastone",
      "variant": 0,                 // integer 0–3 (formstone uses fs_0..3, permastone ps_0..2 = variant % 3)
      "paint": false,               // true only with front "brick"
      "brick": 0,                   // integer 0–5: 0 br_red, 1 br_tan, 2 br_plum, 3 br_grey, 4 br_green, 5 br_sand (used when front "brick")
      "corniceColor": "#c9b48a",    // one of: #c9b48a #4f5a52 #5a4f5c #8a4a3a #a4907a #9ab0b8 #c49a9a
      "doorColor": 0,               // integer 0–3
      "screens": true,              // painted screens in the ground-floor windows
      "floors": 3,                  // 3 or 4
      "trim": "#c9b48a",            // new: window/door trim colour, mid-value hex
      "awning": null,               // new: null or a mid-value hex
      "awningStripe": null          // new: null or a mid-value hex (only when awning is set)
    }
  ],
  "signs": [
    { "id": "sg001", "kind": "store | bar | carryout", "text": "LOCUST PT DELI", "sub": "COLD CUTS · LOTTO",   // sub ≤ 24 chars or ""
      "bg": "#2f5a3a", "border": "#eae6dc", "ink": "#ffe08a" }       // same three colours the kit's board(bg, border, text, ink) uses
  ],
  "streets": [
    { "id": "st001", "name": "Thames Street", "block": 1600, "neighborhood": "Fells Point | Federal Hill | Inner Harbor | Harbor East | Locust Point" }
  ]
}
```
(The `//` comments above are documentation only: your output must not contain comments.)""",
('rowhouse-chalk', 'formstone-ledger', 'thames-lantern'),
[('How many rowhouse combos, store/bar/carryout names and street signs?', '200; 120 (50 store, 40 bar, 30 carryout); 80.'),
 ('Which `brick` index is `br_plum`?', '2.'),
 ('When may `paint` be true?', 'Only when `front` is "brick".'),
 ('What is the maximum characters per sign text line?', '16 (sub ≤ 24).'),
 ('Which seven cornice colours are allowed?', '#c9b48a #4f5a52 #5a4f5c #8a4a3a #a4907a #9ab0b8 #c49a9a'),
 ('Which brand names are banned in sign names?', 'Natty Boh, Utz, Old Bay, Domino (and any real trademark).')],
 '200 rowhouse colour/trim/awning combos, 120 original store/bar/carryout names, 80 real-street signs, as JSON for the rowhouse kit',
"""| Check | Value | Threshold |
|---|---|---|
| rowhouses count / unique ids | | 200 / 200 |
| signs count by kind (store / bar / carryout) | | 50 / 40 / 30 |
| streets count / names outside the allowed list | | 80 / 0 |
| `paint: true` on a non-brick front | | 0 |
| Colours outside 0x30–0xe8 per channel | | 0 |
| Sign text lines over 16 chars | | 0 |""")

haiku('H2', 'lint-scripts', 'Delivery lint and canary-check scripts',
"""Write two small dependency-free Node scripts (Node 18+, ES modules, no npm packages) that Hark runs on every delivery folder:
1. **`tc_lint.mjs <folder>`**: walks `<folder>/src/*.js` and reports, per file, with line numbers: any `import` statement; `Math.random(`; `new THREE.Mesh*Material` / `MeshStandardMaterial` / `MeshPhysicalMaterial`; `PointLight` / `SpotLight` / `DirectionalLight`; `TextureLoader` / `GLTFLoader` / `fetch(` / `http`; `frustumCulled = false`; a `{ … outline: false … }` options object on the same line without `shadow: false`; a bare `export const META ` (should be `META_<NAME>` for environment modules: warn only); a module-level `WeakMap`/`Map` cache whose `.get(`/`.has(` key is exactly `K` (should be `K.QUAL || K.THREE || K`); README lines in `<folder>/README*.md` containing "about", "approx", "~" next to a number. Exit code 1 on any error-level finding. Output a markdown table.
2. **`tc_canary.mjs <folder> <strings.txt>`**: reads one expected string per line from `strings.txt` (Brad keeps it privately) and reports, per string, FOUND (with file:line) or MISSING, searching every text file in the folder (`.js .md .json .html .txt`). Never prints the strings file contents except in the result lines.
Both scripts ≤ 150 lines each, commented, no regex lookbehind (Safari-safe habits).""",
"""Deliver two code blocks titled `tc_lint.mjs` and `tc_canary.mjs`, then one example run output for each on an imaginary folder. No JSON schema: the canary JSON key rule becomes a comment line `// _canary: <value>` as line 1 of `tc_lint.mjs`.""",
('lint-oyster', 'canary-crab', 'lint-lantern'),
[('Which options-object pattern must `tc_lint.mjs` flag?', '`outline: false` without `shadow: false` on the same line.'),
 ('What cache key is wrong, and what should it be?', 'Exactly `K`; should be `K.QUAL || K.THREE || K`.'),
 ('What exit code on an error-level finding?', '1.'),
 ('Maximum length per script?', '150 lines.'),
 ('Which README words next to a number must be flagged?', '"about", "approx", "~".')],
 'Delivery lint script and canary-check script (Node, no deps)',
"""| Check | Value | Threshold |
|---|---|---|
| tc_lint.mjs lines | | ≤ 150 |
| tc_canary.mjs lines | | ≤ 150 |
| npm dependencies | | 0 |
| Patterns covered from §3 list | | all 11 |""")
# H2 canary 1 differs: the comment line
S[-1]['canaries'][0] = ('tc_lint.mjs: line 1, exactly', '// _canary: tcr2-h2-lint-oyster')
S[-1]['canaries'][1] = ('Output: the line right before the tc_lint.mjs code block, exactly', 'HAIKU-OUT H2 canary-crab')

# ---------------- GROK ----------------
def grok():
    sid = 'GR1'
    canaries = [('Output JSON: top-level key "_canary" with value exactly', 'tcr2-gr1-pratt-street-pigeon'),
                ('Output JSON: radio.bumpers must include one bumper whose id is exactly', 'bump_410_canary'),
                ('Final message: the first line of the filled self-check block, exactly', 'SELF-CHECK GR1 natty-lantern')]
    quiz = [('How many barks per gang per category, and which categories?', '8 each for idle, taunt, hit, KO.'),
            ('How many DJ bumpers in total, and which station ids?', '10 total, tagged with auto, day, night, ducky, lor, club, rap (at least one each).'),
            ('How long is each landmark blurb?', 'Exactly 2 sentences.'),
            ('How many landmarks, and where do their ids come from?', '16, from the LANDMARKS list in §3 (e.g. harborplace, constellation, …).'),
            ('What content rating, and what is banned?', 'PG-13; no slurs, no real people, no real trademarks in jokes, no real gang references.'),
            ('Which boss is the final boss?', 'Mister Formstone.')]
    hard = """1. Output one JSON object in the exact schema of §4. No prose inside it.
2. Valid JSON: double quotes, no trailing commas, no comments.
3. PG-13: mild language only; no slurs; no real people; no real gangs; no real brand jokes.
4. Baltimore slang welcome (hon, down the ocean, jawn is Philly so skip it, "yo", "B-more", "Charm City") but readable to anyone.
5. Every line ≤ 70 characters (barks ≤ 48) so it fits a phone speech bubble.
6. Counts are exact: count before you finish.
7. Station ids and landmark ids exactly as listed; never invent new ones.
8. Radio bumpers never name real songs or artists; they are station voice only.
9. Reply first with the Step 0 comprehension check, then STOP until Brad says **GO**."""
    sections = """## 1 · Context
Toad City Baltimore: you play Harold, an elderly toad with a cane, beside his wife Mavis (grey afro, handbag), cleaning crime out of Baltimore's Inner Harbor. Thug gangs are anthropomorphic Chesapeake animals; each landmark has an original boss. A radio (B-MORE 410 RADIO) plays between fights, and a popup names each landmark as you arrive.

## 2 · Where writers fell short last round
Nobody wrote for us last round, but our builders lost time on values the game could not consume. So: ids must match the game's exactly, counts must be exact, and lines must fit the phone bubbles.

## 3 · The task
**Gangs (id → who):** `harbor_rats` Harbor Rats (Norway rats, north shore: Harborplace, Constellation, WTC, Washington Monument; mustard + navy) · `pier_gulls` Pier Gulls (herring gulls, the piers: Aquarium, Power Plant, Four Seasons; white + blue) · `cobble_catfish` Cobblestone Catfish (channel catfish, Fells Point and Pendry; slate + teal) · `masked_bandits` Masked Bandits (raccoons, west side: Oriole Park, M&T Bank Stadium, Science Center; orange + grey) · `key_hwy_otters` Key Highway Otters (river otters, south shore: Federal Hill, Domino Sugar, Tide Point, Fort McHenry; green + brown).
- Per gang: 8 barks each for `idle`, `taunt`, `hit` (when struck), `ko` (when knocked out). Each gang has its own voice.

**Bosses (id → concept):** {BOSSES}
- Per boss: 3 `intro` lines (one is picked when the fight starts) and 3 `defeat` lines.

**Radio:** B-MORE 410 RADIO. Station ids and display names, exactly as the game stores them: `auto` AUTO (follows day/night), `day` B-MORE 410 DAY, `night` B-MORE 410 NIGHT, `ducky` DUCKY DYNAMO FM, `lor` LOR BITEWHO, `club` B-MORE CLUB, `rap` B-MORE RAP. Write **10 DJ bumpers total** (station voice between songs, 1–2 sentences, ≤ 70 chars per line), each tagged with one station id; at least one bumper per station id.

**Landmarks (id → popup name), exactly the game's LANDMARKS list:** {LANDMARKS}
- Per landmark: a 2-sentence popup blurb (first sentence: the real place in plain words; second: a funny Toad City twist tied to its boss or gang). Real facts must be true.

## 4 · Exact schema
```json
{
  "_canary": "…",
  "gangs": { "harbor_rats": { "idle": ["…" ×8], "taunt": [×8], "hit": [×8], "ko": [×8] }, "pier_gulls": {…}, "cobble_catfish": {…}, "masked_bandits": {…}, "key_hwy_otters": {…} },
  "bosses": { "bird_brain_bobby": { "intro": ["…" ×3], "defeat": ["…" ×3] }, … all 17 … },
  "radio": { "bumpers": [ { "id": "bump_01", "station": "night", "text": "…" } ×10 ] },
  "landmarks": { "harborplace": { "name": "HARBORPLACE", "blurb": ["sentence one.", "sentence two."] }, … all 16 … }
}
```
This matches the game: radio stations are keyed by these ids in `src/08_radio.js` (`STATIONS`, `SNAME`), and the landmark popup reads `LANDMARKS[i].name` (we will add `blurb` beside it).

## 5 · Final self-check (fill in with counted numbers)
| Check | Value | Threshold |
|---|---|---|
| Gangs × categories × lines | | 5 × 4 × 8 = 160 |
| Bosses with 3 intro + 3 defeat | | 17 |
| Bumpers total / station ids covered | | 10 / 7 |
| Landmarks with exactly 2 sentences | | 16 |
| Lines over the length limit | | 0 |
| JSON parses | | yes |
"""
    S.append(dict(id=sid, ai='GROK', slug='gr1-barks-radio-blurbs', title='Writing: thug barks, boss lines, radio bumpers, landmark blurbs', dep='None. Send any time.',
                  branch='— (reply in chat)', hard=hard, quiz=quiz, canaries=canaries, sections=sections, setting='Grok (newest), default settings.',
                  imgs=['fight_day.jpg', 'city_night.jpg', 'thugs_day.jpg', 'sign_night.jpg'], scope='Thug barks per gang, boss intro/defeat lines, 10 radio DJ bumpers, 2-sentence blurbs for all 16 landmarks (JSON)'))
grok()
