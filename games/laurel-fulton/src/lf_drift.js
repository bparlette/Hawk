// lf_drift.js — DRIFT BANKING (owner, Nov 18 — from the Gridline Rally teardown: its drift-score
// banking was on the steal list, and lf_skid.js already computes the slip).
//
// While the PLAYER's car is in a real drift — the skid module's slip high, at speed, with real
// lateral load (slipOf's own cornering threshold) or a burnout's spin — points BANK UP at
// slip x speed, with a chain multiplier that grows the longer the drift holds. Regain grip for
// ~0.5 s and the bank CASHES IN to the session total (sim.drift.total, shown in the rally HUD
// pill next to CREW). Smash a building hard mid-bank and the bank is LOST — no other penalty.
// The player's car only: convoy and traffic cars lay their own skid marks but never bank.

export const DRIFT = {
  slipMin: 0.5,      // |slipOf| at/above this counts (cornering 0.35..1, grass churn 0.55, donut 0.9)
  speedMin: 80,      // u/s (~18 mph): no banking for parking-lot wiggle or a hard launch
  latMin: 430,       // slipOf's cornering threshold: lateral load = |v| x |steer| x 2.7 x grip
  gripTime: 0.5,     // s of regained grip before the bank cashes in
  rateK: 0.5,        // points/sec = slip x |v| x mult x rateK  (~90/s for a strong drift at x1)
  multRate: 0.4,     // chain multiplier growth per second of unbroken drift
  multCap: 5,
  minCash: 25,       // smaller banks just evaporate — no popup spam for a flick of the wheel
  hardHit: 100,      // u/s (~22 mph) into a building = a hard hit: the bank is lost
  popupLife: 1.25,   // s a cash/lost popup floats over the car
};

export function initDrift(sim) {
  // log lives HERE, not in sim.events: that array is the physics/world event bus other systems
  // (and specs, e.g. spec_l1's empty-events drive) read as contact-only — drift keeps its own.
  sim.drift = { bank: 0, mult: 1, chainT: 0, gripT: 0, total: 0, popups: [], log: [] };   // popups: {x, y, txt, kind, t}
}

// Called from LFSim.driveCar for the player's car only, with the slip layMarks just measured
// (the same step's number — no second detector), the steer/grip driveCar used, and dt.
export function stepDrift(sim, c, slip, steer, grip, dt) {
  const D = sim.drift; if (!D) return;
  const v = Math.abs(c.v), lat = v * Math.abs(steer) * 2.7 * grip;
  const drifting = slip >= DRIFT.slipMin && v >= DRIFT.speedMin && !(c.z > 0) &&
    (lat > DRIFT.latMin * (sim.gripMul || 1) || (c.spinT || 0) > 0);
  if (drifting) {
    D.gripT = 0; D.chainT += dt;
    D.mult = Math.min(DRIFT.multCap, 1 + D.chainT * DRIFT.multRate);
    D.bank += slip * v * D.mult * DRIFT.rateK * dt;
  } else {
    D.chainT = 0; D.mult = 1;
    if (D.bank > 0) { D.gripT += dt; if (D.gripT >= DRIFT.gripTime) cashDrift(sim, c); }
  }
}

export function cashDrift(sim, c) {
  const D = sim.drift; if (!D || D.bank <= 0) return;
  const pts = Math.round(D.bank);
  D.bank = 0; D.gripT = 0;
  if (pts >= DRIFT.minCash) {
    D.total += pts;
    D.popups.push({ x: c.x, y: c.y, txt: 'DRIFT +' + pts, kind: 'cash', t: 0 });
    D.log.push({ t: sim.time, kind: 'drift_cash', model: c.model, pts });
  }
}

// A hard building hit while banking (LFSim.houseCollide): the un-banked points are gone.
export function loseDrift(sim, c) {
  const D = sim.drift; if (!D || D.bank <= 0) return;
  const pts = Math.round(D.bank);
  D.bank = 0; D.gripT = 0; D.chainT = 0; D.mult = 1;
  if (pts >= DRIFT.minCash) {
    D.popups.push({ x: c.x, y: c.y, txt: 'DRIFT LOST', kind: 'lost', t: 0 });
    D.log.push({ t: sim.time, kind: 'drift_lost', model: c.model, pts });
  }
}

// Popup ageing, ticked from LFSim.step so popups live/die in sim time in every mode.
export function ageDrift(sim, dt) {
  const D = sim.drift; if (!D) return;
  for (const p of D.popups) p.t += dt;
  if (D.popups.length) D.popups = D.popups.filter(p => p.t < DRIFT.popupLife);
}
