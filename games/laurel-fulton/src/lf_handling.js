// Per-car handling (easy-five feature 3): a tuning table keyed by car MODEL, applied inside
// LFSim.driveCar — the one physics choke point — but ONLY to the player's car and to convoy
// followers. Ambient traffic, cop chasers, the fake-cop peel-off and the cop minigame keep the
// stock Palm City physics byte-for-byte (their speeds were audit-tuned: spec_traffic, the
// 263 u/s peel-off). Multipliers, all relative to the stock constants:
//   grip  — scales the slip threshold in lf_skid's slipOf (higher = bites, needs more lateral
//           load to slide; lower = lets go early). Also scales the drift-bank lateral minimum,
//           so a grippy car must be driven harder to bank and a loose one banks easily.
//   turn  — scales the yaw rate (2.7 rad/s base). Turn deviations are kept at HALF strength
//           on purpose: at full strength the convoy's cornering paths diverged enough that
//           four followers wedged in the Atholton parking shuffle (spec_l2/spec_convoy
//           anti-stuck lifts 4 > the <=2 bar, Nov 18 tuning runs); halved, both specs pass
//           with 0 lifts and the ordering (Celica > Camaro > Camry > Astro) still measures.
//   accel — scales the 240 u/s^2 drive acceleration (brake/reverse rates untouched).
//   top   — scales the vmax the caller passed in.
// College Park's fleet uses different model keys for the same archetypes (its heroes drive a
// Camaro, an Astro, a Brougham, a Camry and a Tracer), so those rows mirror the Laurel ones.
export const HANDLING = {
  // Laurel / Scaggsville fleet
  camaro_brad:     { grip: 1.25, turn: 1.08, accel: 1.10, top: 1.00 },   // Brad's '87 Camaro: high grip, bites on turn-in
  camaro_clayton:  { grip: 1.25, turn: 1.08, accel: 1.10, top: 1.00 },   // Clayton's Camaro: same car, same manners
  astro_jimmy:     { grip: 0.70, turn: 0.90, accel: 0.90, top: 0.95 },   // the Astros: wallowy, low grip, slides easily, slow turn-in
  astro_billy:     { grip: 0.70, turn: 0.90, accel: 0.90, top: 0.95 },
  brougham_grant:  { grip: 0.85, turn: 0.90, accel: 0.75, top: 1.12 },   // Grant's Cadillac: floaty, lazy off the line, long legs
  camry_jason:     { grip: 1.00, turn: 1.00, accel: 1.00, top: 1.00 },   // Jason's Camry: plain neutral, the reference car
  celica_rigg:     { grip: 1.10, turn: 1.15, accel: 1.05, top: 0.98 },   // Rigg's Celica GT: nimble, quick turn
  cavalier_kosack: { grip: 1.00, turn: 1.03, accel: 1.00, top: 1.00 },   // Kosack's Cavalier: near-neutral, a hint of turn
  tracer_zack:     { grip: 0.95, turn: 1.08, accel: 0.95, top: 0.95 },   // Zack's Tracer: light hatch, eager turn-in
  mustang_lamar:   { grip: 0.90, turn: 1.03, accel: 1.15, top: 1.05 },   // Lamar's Mustang: strong motor, tail-happy
  // College Park fleet (same archetypes, CP model keys)
  moe_camaro:      { grip: 1.25, turn: 1.08, accel: 1.10, top: 1.00 },
  juno_astro:      { grip: 0.70, turn: 0.90, accel: 0.90, top: 0.95 },
  pike_brougham:   { grip: 0.85, turn: 0.90, accel: 0.75, top: 1.12 },
  dre_camry:       { grip: 1.00, turn: 1.00, accel: 1.00, top: 1.00 },
  tess_tracer:     { grip: 0.95, turn: 1.08, accel: 0.95, top: 0.95 },
};

// The row for a car, or null when stock physics apply: only the player's own car and convoy
// followers get a personality. Unknown models (cavalier_black etc.) stay neutral.
export function handlingOf(c, sim) {
  if (!c || !sim) return null;
  if (c !== sim.player && c.follower !== true) return null;
  return HANDLING[c.model] || null;
}
