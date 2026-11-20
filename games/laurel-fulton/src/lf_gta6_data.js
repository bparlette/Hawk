// lf_gta6_data.js — GTA6-look roll-out (Nov 19): hand-placed dressing data for lf_gta6.js.
// SITE FRAME: origin = the hero's footprint centroid; t = unit vector along the storefront /
// front wall (to the right as you face out of the building), n = unit outward normal (toward
// the street or the lot). A prop anchor [type, u, v] sits at origin + t*u + n*v, in world
// units. For places with a door (data/places.json) n is the door normal (flipped toward the
// lot); for other heroes n points at the nearest road, like HeroArt's frame. Extend a site by
// adding rows here — no code changes needed. Anchors that land on a road surface or inside a
// neighbouring footprint are skipped at draw time, so a slightly-off anchor fails safe.
// Prop types: dumpster | barrels | pallets | crates | tires | cones | shed | bins
export const SITE_PROPS = {
  // the Weis lot (Whiskey Bottom) — the sample's own placements, converted to this frame
  // (frame extents: building u[-234,148] v[-127,185], lot u[-297,364] v[-123,714], front v=185)
  'Weis': [
    ['dumpster', 268, 60], ['barrels', 268, 118], ['pallets', 338, 150], ['crates', 208, 205],
    ['barrels', -227, 644], ['tires', -217, 564], ['shed', 274, 634],
    ['cones', -40, 385], ['cones', 26, 385], ['cones', 150, 489],
  ],
  // Ledo Pizza — small flat-roof retail, forecourt lot in front (u along the front, v out)
  'Ledo Pizza': [
    ['dumpster', 74, -6], ['barrels', 88, 40], ['crates', 62, -38], ['cones', -30, 96], ['cones', 34, 96],
  ],
  // Gringada — memory-build restaurant on an end pad; service clutter at the back/side
  'Gringada': [
    ['dumpster', -118, -20], ['barrels', -104, 26], ['pallets', 96, -34], ['crates', 112, 8],
  ],
  // Atholton High School — big flat roof, lots on three sides; service yard dressing at the back
  'Atholton High School': [
    ['dumpster', -260, -760], ['barrels', -228, -760], ['dumpster', 240, -740], ['crates', 268, -700],
    ['cones', -60, 760], ['cones', 60, 760], ['tires', -300, -690],
  ],
  // Reservoir High School — same kit, mirrored yard
  'Reservoir High School': [
    ['dumpster', 210, -420], ['barrels', 178, -420], ['crates', -190, -400], ['cones', -40, 430], ['cones', 40, 430],
  ],
};
// Sites that get pennant strings across the frontage (the reference photos' signature):
// strings run front-corner to front-corner and out to the nearest poles.
export const PENNANT_SITES = ['Weis', 'Ledo Pizza', 'Gringada'];
// Hero homes get archetype scatter instead of hand anchors (bins at the kerb corner, a
// backyard stack) — see lf_gta6.js homeProps(). Schools and big retail use the tables above.
