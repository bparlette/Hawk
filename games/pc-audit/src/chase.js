// chase.js — BOARD CHASE, a city event on the skateboard (task 7H). Ride to the marker on the
// promenade at the pier, press START: the wanted level jumps to three stars and a checkpoint chain
// lights up across the city — PIER → PLAZA → NOVA → VILLAS → SAFEHOUSE. Each checkpoint fills a
// quarter of the escape meter and points you at the next. Win by reaching the safehouse with the
// meter full, or by shaking the cops entirely before you get there. It runs in the same event slot
// as WRECK IT! and VALET (sim.event), scores on the same pattern, and uses the existing board —
// no new vehicle, no new physics. Bust rules are the 7C on-foot rules: only a board that is being
// held still at arrest range fills the meter; a moving board is never busted.
export const CHASE = {
  name: 'BOARD CHASE', site: [1296, 1035],               // on the promenade at the foot of the pier
  // the game's own named places (jobs.js PLACES / SAFEHOUSE), copied here so this module has no import cycle
  route: [['PLAZA', 1168, 470], ['NOVA', 990, 1390], ['VILLAS', 700, 1988], ['SAFEHOUSE', 1232, 1350]],
  reach: 48, time: 150, par: 100, perCheckpoint: 400, win: 1200, perSecond: 15, shook: 800,
};

export function initChase(sim) { sim.chaseSite = { kind: 'chase', name: CHASE.name, p: CHASE.site }; }

// INSTANT-START (owner rule, Nov 16): the board rack. The board is a singleton (sim.board) —
// this never creates one; it recalls the one that exists to the rack beside the ring when the
// player presses ACTION at the marker without it, so the same press then mounts it.
export function boardRack(sim) {
  const p = sim.player.ped, b = sim.board;
  if (sim.player.mode !== 'foot' || !b || sim.player.board === b) return;
  if (Math.hypot(p.x - CHASE.site[0], p.y - CHASE.site[1]) < 30 && Math.hypot(b.x - CHASE.site[0], b.y - CHASE.site[1]) > 60) {
    b.x = CHASE.site[0]; b.y = CHASE.site[1] + 14; b.vx = 0; b.vy = 0; b.grind = null; b.z = 0; b.air = 0;
  }
}

// is START BOARD CHASE armed? On the board, at the marker, nothing else running.
export function chaseArmed(sim) {
  const P = sim.player, b = sim.board;
  return P.mode === 'board' && !sim.event && !sim.job && !sim.busted && Math.hypot(b.x - CHASE.site[0], b.y - CHASE.site[1]) < 60;
}

export function startChase(sim) {
  if (!chaseArmed(sim)) return null;
  const first = CHASE.route[0];
  const ev = sim.event = { kind: 'chase', name: CHASE.name, t: 0, timer: CHASE.time, count: 0, car: null, pts: 0, n: 0, idx: 0, meter: 0, spot: [first[1], first[2]], next: first[0] };
  sim.eventResult = null; sim.ev('jobstart', 'chase');
  if (sim.stars < 3) { sim.stars = 3; sim.lostT = 0; sim.ev('star', 3); }      // the cops come at three stars
  sim.say('BOARD CHASE — GO!', 1.6);
  return ev;
}

// one tick; `end(text, ok, extra)` and `pay(pts, label)` are the events module's own, so results and
// scoring look and behave exactly like the other two events
export function stepChase(sim, ev, dt, end, pay) {
  ev.timer -= dt;
  const p = sim.player.ped, R = CHASE.route;
  if (sim.stars === 0 && ev.t > 1) {                       // shook them: that is an escape too
    pay(CHASE.shook, 'SHOOK THE COPS');
    ev.pts += CHASE.shook;
    end('BOARD CHASE — SHOOK THEM', true, { cp: ev.idx, of: R.length });
    return;
  }
  if (ev.timer <= 0) { end('OUT OF TIME', false, { cp: ev.idx, of: R.length }); return; }
  const c = R[ev.idx];
  if (Math.hypot(p.x - c[1], p.y - c[2]) >= CHASE.reach) return;
  ev.idx++; ev.n = ev.idx; ev.meter = ev.idx / R.length;
  if (ev.idx < R.length) {
    const nx = R[ev.idx];
    pay(CHASE.perCheckpoint, 'CHECKPOINT · ' + c[0]);
    ev.pts += CHASE.perCheckpoint; ev.spot = [nx[1], nx[2]]; ev.next = nx[0];
    sim.say(nx[0] + ' NEXT', 1.4); sim.punchZoom = 1;
    return;
  }
  const bonus = CHASE.win + Math.max(0, Math.round(CHASE.par - ev.t)) * CHASE.perSecond;
  pay(bonus, 'SAFEHOUSE — ESCAPED');
  ev.pts += bonus;
  sim.stars = 0; sim.lostT = 0;                            // inside: the heat is off
  end('BOARD CHASE — ESCAPED', true, { cp: ev.idx, of: R.length, secs: Math.round(ev.t) });
}
