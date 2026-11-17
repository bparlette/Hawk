// fx.js — BEAUTY SAMPLES (Nov 16 2026). Seven visual effects from the approved beauty slate,
// built as verdict samples, not final art: every effect defaults OFF in normal play and is
// switched by a debug hook — the URL (?fx=roof,sway,causeway,rim,bleed,puddle,petals) and/or
// the live set window.__palm.fx (add/delete applies next frame; 'bleed' is the exception — it
// is baked into ground chunks as they paint, so it only reaches chunks painted after the
// toggle, and chunks already cached keep their paint until the LRU evicts them). With the set
// empty, painting and rendering are behaviour-identical to the base game: every hook below is
// a Set lookup that short-circuits before any work happens.

export const FX = new Set();
export const fxOn = (name) => FX.has(name);

export function fxFromQuery(q) {
  const v = q.get('fx');
  if (v) for (const n of v.split(',')) { const s = n.trim(); if (s) FX.add(s); }
}

// GOUACHE EDGE BLEED district: the plaza block and the NOVA block INCLUDING their bounding
// roads (so the ring roads' centres get the soft treatment too), with the district edges on
// the FAR side of those roads — the treatment boundary then coincides with a surface border
// instead of stopping mid-road or mid-block.
export const BLEED_RECTS = [
  { x0: 312, y0: 132, x1: 1248, y1: 848 },     // plaza block + its ring roads (loop W/N/E, y-800 street)
  { x0: 732, y0: 752, x1: 1248, y1: 1468 },    // NOVA block + its roads (x-780 street, loop E, y-1420 street)
];
export function inBleed(x, y) {
  for (const r of BLEED_RECTS) if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return true;
  return false;
}

// CURB PUDDLES: three on Ocean Drive (the loop's east leg, x 1152..1248) and one on the plaza's
// south-east corner. tint = the sign/lamp colour the mirror patch throws back.
export const PUDDLES = [
  { x: 1196, y: 1010, rx: 30, ry: 13, tint: [255, 178, 86] },   // Ocean Drive: lamp amber
  { x: 1218, y: 1135, rx: 24, ry: 11, tint: [63, 216, 255] },   // Ocean Drive: DINER cyan spill
  { x: 1172, y: 1222, rx: 27, ry: 12, tint: [255, 120, 170] },  // Ocean Drive: pink sign spill
  { x: 1086, y: 700, rx: 30, ry: 14, tint: [255, 138, 60] },    // plaza SE corner: TACOS orange
];
