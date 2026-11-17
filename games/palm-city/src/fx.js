// fx.js — BEAUTY WINNERS (Nov 16 2026). Six of the seven beauty samples, promoted by the
// owner's verdict ("implement all except rim light") from opt-in samples to the game's
// default look: roof parallax, palm shadow sway, causeway water depth, gouache edge bleed,
// curb puddles and slipstream petals are ON from boot. Rim light was cut by the same verdict
// and its code is removed entirely — there is no 'rim' switch anywhere.
// The switchboard stays a switchboard, so tuning can still kill any winner live:
// window.__palm.fx is the live set (delete a name to turn that effect off, add it back to
// restore; applies next frame — 'bleed' is the exception: it is baked into ground chunks as
// they paint, so it only reaches chunks painted after the toggle, and chunks already cached
// keep their paint until the LRU evicts them). The URL speaks the same language, tokens
// applied left to right: ?fx=none turns everything off, ?fx=-sway turns one winner off,
// ?fx=none,roof leaves only roof on, a bare name turns an effect on.

export const FX_DEFAULTS = ['roof', 'sway', 'causeway', 'bleed', 'puddle', 'petals'];
export const FX = new Set(FX_DEFAULTS);
export const fxOn = (name) => FX.has(name);

export function fxFromQuery(q) {
  const v = q.get('fx');
  if (!v) return;
  for (const n of v.split(',')) {
    const s = n.trim();
    if (!s) continue;
    if (s === 'none') FX.clear();
    else if (s[0] === '-') FX.delete(s.slice(1));
    else FX.add(s);
  }
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
