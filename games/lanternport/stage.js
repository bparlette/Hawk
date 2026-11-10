// Stage: the cast, sets and choreography of Lanternport's film scenes, as pure data and maths (no DOM, no three.js).
// A film scene adds three things to a scenes.js definition:
//   set(game)      -> { origin: [x, y, z] metres, props: [...], actors: [...] }   built once, from the seeded city only
//   act(S, t)      mutates the actors (position, yaw, pose) for scene time t, in ticks. t may be fractional: the page
//                  calls it at render time with the blended tick, so motion is smooth at any timescale and the
//                  picture can never drift from the sim clock. It must be a pure function of (S, t).
//   sound / bed    cue list and music bed, fired by tick (see index.html)
// Positions are scene metres (1 m = 100 sim units), yaw 0 looks along +Z, like everything else in the view.
export const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** Keyframes: kf(t, [[tick, value], ...]) with numbers or equal-length arrays. Eased between keys, held outside. */
export function kf(t, keys, smooth = true) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [t0, a] = keys[i - 1], [t1, b] = keys[i]; let u = (t - t0) / (t1 - t0 || 1); if (smooth) u = ease(u); return Array.isArray(a) ? a.map((v, k) => v + (b[k] - v) * u) : a + (b - a) * u; }
  }
  return keys[keys.length - 1][1];
}
export const between = (t, a, b) => t >= a && t < b;
/** 0 before a, 1 after b, eased between. */
export const ramp = (t, a, b) => ease((t - a) / (b - a));
/** A person. look = { skin, top, bottom, hair, hat?, dress?, scarf? } (hex colours). pose fields are read by stageview.js. */
export function person(id, look, x, y, z, yaw = 0) { return { id, kind: 'person', look, x, y, z, yaw, pose: {}, vis: true }; }
export function thing(id, kind, x, y, z, yaw = 0, extra = {}) { return { id, kind, x, y, z, yaw, vis: true, ...extra }; }
/** Walk an actor along waypoints [[tick, x, z], ...]: sets position, facing and a walk cycle. */
export function walk(a, t, path, speedScale = 1) {
  const p = kf(t, path.map(([k, x, z]) => [k, [x, z]]), false); let yaw = a.yaw, moving = false;
  for (let i = 1; i < path.length; i++) if (t >= path[i - 1][0] && t < path[i][0]) { const dx = path[i][1] - path[i - 1][1], dz = path[i][2] - path[i - 1][2]; if (Math.hypot(dx, dz) > 1e-6) { yaw = Math.atan2(dx, dz); moving = true; } }
  a.x = p[0]; a.z = p[1]; a.yaw = yaw; a.pose.walk = moving ? t * 0.42 * speedScale : null;
}
/** Deterministic small noise from an integer (for crowd variety, never Math.random). */
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// Lanternport's own two couriers. Juniper wears the hero look from the playable
// game (green tunic, blonde hair, pointed cap and ears, shield and sword —
// stageview.js builds the kit when look.hero is set). Fen in teal and coral.
export const JUNIPER = { skin: 0xf6c9a0, top: 0x3da35d, bottom: 0xd06a28, hair: 0xeec25a, hero: true }; // hero = the Linkle kit (braids, capelet, compass) — see stageview.js
export const FEN = { skin: 0xc98f62, top: 0x178f8a, bottom: 0x4a3b34, hair: 0x2b2838, scarf: 0xf06a4a, goggles: true };
const TOPS = [0xd95f5f, 0x4f97d6, 0x6fbf6f, 0xe6aa3c, 0xa67fd6, 0xf4ead8, 0xe07a9a, 0x3fa7a0], SKINS = [0xf6c9a0, 0xc98f62, 0x9a6844, 0xe8b48a], HAIRS = [0x3a2a1c, 0x8a5a2e, 0xd9b36a, 0x2b2838, 0xa8a8b0, 0x6b3a2a];
/** A townsperson look picked deterministically from an index. */
export function townLook(i) { return { skin: SKINS[i % 4], top: TOPS[(i * 3 + 1) % 8], bottom: [0x35304d, 0x4a3b34, 0x5a6478, 0x3f5a4a][(i * 5) % 4], hair: HAIRS[(i * 7) % 6], hat: i % 3 === 0 ? TOPS[(i + 4) % 8] : undefined, dress: i % 4 === 1 }; }
