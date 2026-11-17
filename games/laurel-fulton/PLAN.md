# LAUREL/FULTON — architecture + build plan (task L1, Opus, Nov 17, 2026)

## 1. What the data gives us (evidence first)

| | |
|---|---|
| Source | OSM main API, 4×4 tiles over the stage-1 bbox (S 39.105 / W −76.942 / N 39.202 / E −76.846) — `tools/osm_fetch.py`. Overpass (stage 1's source) is reset by the cloud box's egress; the main API is not. **8,632 highway ways — the exact count stage 1 reported**, so this is the same road set. |
| Extent | **8.29 km × 10.72 km** |
| Drivable network | 6,419 ways → **10,220 vertices, 12,435 edges, 907 km** (service 398 · residential 275 · tertiary 73 · motorway 34 · primary 32 · motorway_link 28 · secondary 25 · trunk 18 · trunk_link 11 · unclassified 10) — `tools/osm_graph.py`, `data/graph_report.json` |
| Connectivity | **96.7 % in one component**; the small islands (31, 27, 26 … vertices) are disconnected parking lots |
| Cul-de-sacs | **347** residential dead ends — the game must turn cars round in them (AI and convoy) |
| One-ways | 1,332 edges (dual carriageways, ramps, roundabouts) — routing honours them |
| Short edges | 49 under 3 m (OSM node splits at junctions) — merge for traffic, keep for drawing |
| **Grade separation** | **58 crossings without a shared node — all 58 tagged bridge/layer** (US-29 over Sandy Spring Rd, Dustin Rd over US-29, I-95 over Stansfield Rd…). The data is clean; the *game* must render and drive two levels. |
| Labels | MD-216 is mostly `ref` only, no `name` — labels fall back to ref ("MD 216"). |
| Anchors | Ledo Pizza (11845 Scaggsville Rd), Atholton HS, Reservoir HS — and **every roster house as an exact OSM address point** except Grant (his street, Sandy St, is outside the bbox, as Moth found) — `data/roster.json` |
| Sample route | Ledo → Brad's: **7.22 km** shortest legal path (Scaggsville Rd / MD 216 → Crest Rd → Harding Rd → Stansfield Rd). The owner's sample route (via Maple Lawn Blvd) is a forced waypoint, a little longer. |

Maps: `shots/l1-graph-full.png`, `shots/l1-graph-sample.png` (`tools/graph_map.py`).

## 2. Decisions

**Scale: 1:1, at Palm City's 10 units per metre.** "Real geometry is sacred" rules out compression
(it bends curves and squeezes lots), and Moth's car sprites are true-scale. At Palm City's driving
feel (top 290 u/s ≈ 29 m/s ≈ 65 mph, turbo 405) Ledo → Brad's is ~4 minutes; corner to corner ~6 —
a real-size suburb, like the open-world games this is modelled on. No zoning; one continuous world,
streamed.

**World = the graph, queried through a spatial index.** Palm City's `World` answers `roadInfo` /
`surfaceAt` by scanning every segment — fine for 10 roads, fatal for 12,435 edges. Laurel/Fulton's
`world_graph.js` buckets every edge segment into a 256-unit grid (the ground chunk size); a query
looks at one cell + neighbours. Surfaces: carriageway by OSM lanes × 3.4 m (defaults per class),
sidewalk bands on residential/tertiary+ (where OSM has them), service roads narrow and kerbless,
everything else grass/lot from OSM landuse (next fetch: `landuse`, `amenity=parking`, building
footprints — already in the tiles).

**Two levels.** Edges carry `layer` (bridge = +1). Each car carries its current layer; it may only
move onto an edge of its layer or one connected at a vertex. A bridge deck is drawn above the ground
pass with its own cast shadow; collisions and surface queries are layer-aware. The US-29/MD-216
interchange is the proof case.

**Streaming.** Palm City's `GroundPainter` already paints 256-unit chunks time-sliced with a 64-chunk
LRU; with the grid index each chunk only touches its local edges, so paint cost stays per-chunk
regardless of map size. ~137k possible chunks; only the ~60 around the view ever exist.

**Carry over from Palm City (the reference — its opening streets are the physics BAR):** car physics
(`driveCar` / `moveCar` / turbo), skids, destruction, recorder + auto-director, input (gptouch
standard: floating stick, round buttons, PointerEvent isolation, gesture guard, iOS audio fix),
HUD, HELP/JUMP, voices. **New:** the graph world + layers, graph traffic (route-following on the
graph instead of the loop), the roster, the mission system (L2: pick-your-player, pickups, convoy),
signature car FX (bass rings, underglow, tailpipe sputter), house lots.

**Repo:** `games/laurel-fulton/` — `data/` (OSM pulls, graph, roster), `tools/` (fetch, graph,
roster, maps, spec tests), `src/` (forked from palm-city: `world_graph.js` replaces `world.js`;
`sim.js`/`render.js` adapted), `shots/`.

## 3. Build order (commit as each lands)
1. **L1 sample (now):** `world_graph.js` + spec test → drivable corridor Ledo → Maple Lawn Blvd →
   MD 216 → Stansfield Rd, painted with Palm City's painter, true road widths, kerbs, bridges.
   BAR evidence: recorded drive + phone-size captures beside Palm City's opening.
2. **L2 on the sample:** roster → pick-your-player → pickups on/near the route → convoy (graph
   following at road spacing, handles doubling back) → Atholton HS meet-up.
3. Full extent (after the owner's verdict on the sample), then traffic + police on the graph.

## 4. Test-first (red until built) — `tools/spec_l1.mjs`
Graph loads and indexes; every anchor snaps to a drivable edge; `surfaceAt` is `road` along the whole
sample route and never `road` 30 m off it; a scripted drive through the **real input path** follows
the route Ledo → Brad's without leaving the carriageway; on the interchange the car on US-29 never
collides with MD-216 below; the car turns round in a cul-de-sac; query cost < 20 µs.

## 5. Flagged for the owner (per "flag the tradeoff and ask")
- **Friends' names at their home addresses on a public site.** Hawk's game folders publish to public
  GitHub Pages, so the roster (names + exact addresses + cars) is readable by anyone. The tasking
  directs real names and places; I am building it as directed. A low-cost safeguard if wanted: keep
  the houses at their real spots but put only first names / no house numbers in anything shipped.
  **Owner, Nov 17: exact house + street, no house numbers posted.** roster.json carries street + exact
  position + OSM element only; the numbers live in a git-ignored local file (tools/roster_build.py).
- **Map extent:** Grant's street is ~292 m south of the bbox. Extending south is a fetch flag
  (`tools/osm_fetch.py`) plus a roster re-run.
