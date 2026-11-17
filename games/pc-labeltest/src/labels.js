// labels.js — first-time-play helper labels (owner rule, Nov 17): the word plaques that name a
// vehicle or mode (BOATS over the moorings, TAXI / TOW / BUS / GETAWAY over the job cars,
// HELICOPTER over the pad, WRECK IT! / VALET / SPOTLIGHT / OPEN ROAD over the rings, BOARD
// CHASE at the pier, MOTEL SIEGE at the door) are training wheels for a first session only.
// Use that vehicle/mode continuously for LEARN_SECONDS and its plaque retires — for good,
// across sessions: one localStorage key per label ('pc_label_<id>'). A plaque for something
// you have never used behaves exactly as it always did, and using one vehicle never retires
// another's plaque. The Garage's JOBS signpost is a hub, not a vehicle: it retires once all
// four job plaques have retired.
//
// The learned set lives on the sim (loaded from localStorage at first touch), so a fresh page
// re-reads what earlier sessions persisted, and separate sims never share state.
export const LEARN_SECONDS = 3;        // continuous use that retires a label
export const LABEL_FADE = 0.5;         // the goodbye fade, in sim seconds
const PREFIX = 'pc_label_';
export const JOB_LABELS = ['taxi', 'tow', 'bus', 'getaway'];

function store() { try { return globalThis.localStorage || null; } catch { return null; } }

function learnedSet(sim) {
  if (sim.learnedLabels) return sim.learnedLabels;
  const set = new Set();
  const ls = store();
  if (ls) {
    try {
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && k.startsWith(PREFIX) && ls.getItem(k) === '1') set.add(k.slice(PREFIX.length));
      }
    } catch { /* read blocked: start fresh */ }
  }
  sim.learnedLabels = set;
  return set;
}

export function labelLearned(sim, id) { return learnedSet(sim).has(id); }

export function learnLabel(sim, id) {
  const set = learnedSet(sim);
  if (set.has(id)) return;
  set.add(id);
  const ls = store();
  if (ls) { try { ls.setItem(PREFIX + id, '1'); } catch { /* write blocked: session-only */ } }
  (sim.labelFadeAt || (sim.labelFadeAt = {}))[id] = sim.time;
}

// What a plaque's opacity is this frame: 1 = shown as always, 0..1 = fading out in the moment
// it retires, -1 = gone (learned in an earlier session, or the fade has finished).
export function labelAlpha(sim, id) {
  if (id === 'jobs') {                                   // the signpost follows the four job plaques
    if (!JOB_LABELS.every(j => labelLearned(sim, j))) return 1;
    const ats = JOB_LABELS.map(j => (sim.labelFadeAt || {})[j]).filter(v => v != null);
    if (!ats.length) return -1;                          // all learned before this session
    const f = 1 - (sim.time - Math.max(...ats)) / LABEL_FADE;
    return f > 0 ? f : -1;
  }
  if (!labelLearned(sim, id)) return 1;
  const at = (sim.labelFadeAt || {})[id];
  if (at == null) return -1;                             // learned in an earlier session: never drawn
  const f = 1 - (sim.time - at) / LABEL_FADE;
  return f > 0 ? f : -1;
}

// The label the player is using right now, if any: the vehicle/mode they are in, not the one
// they are merely near. An event outranks the plain car it is driven in; a job is its vehicle.
export function labelInUse(sim) {
  const P = sim.player;
  if (P.mode === 'water') return 'boats';
  if (P.mode === 'air') return 'heli';
  if (P.mode === 'siege') return 'motel';
  if (sim.event) return sim.event.kind;                  // wreck / valet / spot / openroad / chase
  if (P.mode === 'car' && P.car && P.car.job) return P.car.job;
  return null;
}

// Per-step tracker (sim.step calls this): accumulate CONTINUOUS use of one label; switching
// vehicles or stepping out starts the count over. At LEARN_SECONDS the label retires.
export function stepLabels(sim, dt) {
  const u = sim.labelUse || (sim.labelUse = { id: null, t: 0 });
  const id = labelInUse(sim);
  if (id !== u.id) { u.id = id; u.t = 0; }
  if (!id || labelLearned(sim, id)) return;
  u.t += dt;
  if (u.t >= LEARN_SECONDS) { learnLabel(sim, id); u.t = 0; }
}
