// Adapter: canonical Vice Beach extraction -> the level shape play/engine/sim.js eats.
//
// level/canonical/vice_beach.json (from level/extract_level.py, straight out of the real
// miami.cmp) stores per-cell GTA 1 surface fields: [zone, type, z, lid, lidrot, dir, slope, palm].
// The sim wants strand-style rows of single characters (see sim.js: SOLID_FOOT "~oBp", ROUGH "bg")
// plus a route. This module converts the zones, attaches The Run for Vice Beach, and passes the
// raw cells through untouched so renderers can draw the real lid tiles via assets/<era>/manifest.json.
//
// Zone -> sim char:
//   O ocean -> o (solid)   B bay -> ~ (solid)   P pool -> p (solid)   H building -> B (solid)
//   S sand  -> b (rough)   G grass -> g (rough) M promenade -> m      W sidewalk -> s   R road -> r
//   X void  -> o (solid; none occur in the rect)
export const ZONE_TO_SIM = { O: "o", B: "~", P: "p", H: "B", S: "b", G: "g", M: "m", W: "s", R: "r", X: "o" };

// The Run — Vice Beach. One deterministic route through the canonical level, driven by
// createAutopilot() through the same {mx, my, act} input a thumb produces, so it is the
// identical drive in every era. All positions are tile units (x east, y south, origin at the
// rect's north-west corner; map coords = local + (192, 11)).
//
//   1. On foot on the promenade at the south end of the beach (49.5, 68.5), facing west.
//   2. Walk west across the promenade to the car waiting on the east N-S road (45.5, 68.5).
//   3. Drive north up that road, west across the middle E-W road (y 29-32), then north up
//      Ocean Drive (x 32-35) and park at (33.5, 15.8).
//   4. On foot east along the y~15.6 sidewalk/grass gap to the promenade; finish there,
//      mid-beach, with the sand and the Atlantic just east.
export const VICE_ROUTE = {
  name: "The Run — Vice Beach",
  spawn: { x: 49.5, y: 68.5, heading_deg: 270 },
  car: { x: 45.5, y: 68.5, heading_deg: 0 },
  legs: [
    { mode: "foot", to: [[47.5, 68.5], [46.0, 68.5]], then: "enter" },
    { mode: "drive", to: [[45.5, 50.0], [45.5, 30.5], [33.5, 30.5], [33.5, 15.8]], then: "exit" },
    { mode: "foot", to: [[38.0, 15.6], [44.0, 15.6], [49.8, 15.6]], then: "finish" },
  ],
  finish: { x: 49.8, y: 15.6, what: "the promenade, mid-beach" },
};

export function adaptLevel(canon) {
  const rows = canon.rows, h = rows.length, w = rows[0].length;
  const ground = rows.map(r => [...r].map(z => ZONE_TO_SIM[z] || "o").join(""));
  return {
    name: "Vice Beach",
    source: canon.source,
    tile_m: canon.cell_world_units,
    w, h,
    ground,
    route: VICE_ROUTE,
    cells: canon.cells,          // raw [zone, type, z, lid, lidrot, dir, slope, palm] per cell — renderers draw from this
    zones: canon.zones,
    rect: canon.rect,
  };
}
