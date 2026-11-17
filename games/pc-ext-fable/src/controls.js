// controls.js — what the A button (the smaller round one, left of the action button) is right now.
// One place decides it, so the HUD, the touch layer and the checks can never disagree, and the
// button never shows an action that does nothing.
//   on foot / in the siege : PUNCH (in OPEN ROAD's start circle: START OPEN ROAD — the grid car waits)
//   in a car               : the job or event action if one is armed (START TAXI, HOOK, DECOY...),
//                            otherwise TURBO (hold). A wreck has no A action.
//   on the board           : none shown (the main button is the ollie; the A key ollies too)
import { jobButton } from './jobs.js';
import { chaseArmed } from './chase.js';
import { openRoadArmed } from './openroad.js';

export const TURBO = { mult: 1.4, accel: 1.6, burn: 3.0, cool: 2.0 };   // top-speed x, accel x, seconds of boost, seconds to recover

export function buttonA(sim) {
  const P = sim.player;
  if (P.mode === 'foot' || P.mode === 'siege') return openRoadArmed(sim) ? { kind: 'event', label: 'START OPEN ROAD' } : { kind: 'punch', label: 'PUNCH' };
  if (P.mode === 'board') return chaseArmed(sim) ? { kind: 'event', label: 'START BOARD CHASE' } : null;
  if (P.mode === 'water') {                        // on a craft: TURBO, same hold-to-boost as a car
    const cr = sim.water && sim.water.ride;
    if (!cr) return null;
    return { kind: 'turbo', label: cr.turboLock > 0 ? 'COOLING' : 'TURBO', cooling: cr.turboLock > 0, heat: (cr.turboHeat || 0) / TURBO.burn };
  }
  if (P.mode !== 'car') return null;
  const jb = jobButton(sim);
  if (jb) return { kind: 'job', label: jb.label };
  const c = P.car;
  if (!c || c.wreck) return null;
  return { kind: 'turbo', label: c.turboLock > 0 ? 'COOLING' : 'TURBO', cooling: c.turboLock > 0, heat: (c.turboHeat || 0) / TURBO.burn };
}

// Hold-to-boost. Up to TURBO.burn seconds of boost; run it dry and it locks out for TURBO.cool.
// Letting go early lets it recover at the same rate. c.turbo (0..1) is the eased strength the car
// physics, engine note and speed streaks all read.
export function stepTurbo(sim, c, held, throttle, dt) {
  const a = buttonA(sim);
  // the press has to START on TURBO: the tap that starts a job must not also fire the boost
  if (held && !c.aHeld) c.turboArmed = !!a && a.kind === 'turbo';
  c.aHeld = held;
  let on = held && c.turboArmed && a && a.kind === 'turbo' && !a.cooling && throttle > 0 && c.v > 20;
  if (c.turboLock > 0) c.turboLock = Math.max(0, c.turboLock - dt);
  if (on) {
    if (!(c.turbo > 0.02)) sim.ev('turbo');
    c.turboHeat = (c.turboHeat || 0) + dt;
    if (c.turboHeat >= TURBO.burn) { c.turboHeat = 0; c.turboLock = TURBO.cool; on = false; sim.ev('turbo_out'); }
  } else if (c.turboHeat > 0 && !(c.turboLock > 0)) c.turboHeat = Math.max(0, c.turboHeat - dt * TURBO.burn / TURBO.cool);
  c.turbo = on ? Math.min(1, (c.turbo || 0) + dt * 5) : Math.max(0, (c.turbo || 0) - dt * 1.6);
  return on;
}
