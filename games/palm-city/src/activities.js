// activities.js — the ONE registry of things to do in Palm City. The floating street markers,
// the map's activity POIs and (7G) the HELP panel and start page are all generated from it, so
// anything registered here is discoverable everywhere at once.
//
// An activity: { id, name, tag, how, group, color, live(sim), pos(sim), hint }.
//   name  : full title (HELP rows)            tag : the short word on the street marker / map
//   how   : one line, how to start it         group: 'siege' | 'job' | 'event' | 'hub'
//   live  : can it be started right now?      pos : world [x, y] the marker hangs over (null = hide)
// A hub (the Garage's JOBS sign) is a signpost, not something you start: it gets a marker and no
// HELP row. To add an activity, push one more entry in build() — nothing else needs touching.
import { EVENTS, quitEvent } from './events.js';
import { quitJob } from './jobs.js';
import { dismount, mount } from './skate.js';
import { CHASE } from './chase.js';

const JOB = {
  taxi:    { name: 'TAXI',    how: 'Get in the yellow cab and press START. Fares pay more when they stay happy.' },
  tow:     { name: 'TOW',     how: 'Get in the tow truck at the Garage kerb and press START. Hook cars, haul them back.' },
  bus:     { name: 'BUS',     how: 'Get in the bus at the Garage kerb and press START. Keep to the stops and the clock.' },
  getaway: { name: 'GETAWAY', how: 'Get in the sun-yellow van and press START. Pick up the crew, lose the cops.' },
};
const EVENT_HOW = {
  wreck: 'Drive onto the orange ring by the plaza and press START. Smash everything before time runs out.',
  valet: 'Drive onto the blue ring south of the Garage and press START. Park clean, park fast.',
};

export function initActivities(sim) {
  const L = sim.W.L, list = [];
  const jobCar = (k) => sim.cars.find(c => c.job === k);
  list.push({
    id: 'motel', group: 'siege', name: 'MOTEL SIEGE', tag: 'MOTEL SIEGE', color: '#ff5a7a',
    how: 'Walk to the glowing motel door, west of NOVA, and press ENTER.',
    live: () => !sim.busted, pos: () => (sim.player.mode === 'siege' ? null : L.motelDoor), door: true,
  });
  for (const k of ['taxi', 'tow', 'bus', 'getaway']) list.push({
    id: k, group: 'job', name: JOB[k].name, tag: JOB[k].name, color: '#6ee2ff', how: JOB[k].how,
    car: () => jobCar(k),
    live: () => { const c = jobCar(k); return !!c && !c.wreck && !sim.job; },
    // the tag rides on the parked vehicle; it steps aside while you are driving it or working the job
    pos: () => { const c = jobCar(k); return !c || c.wreck || c.driver === 'player' || (sim.job && sim.job.car === c) ? null : [c.x, c.y]; },
  });
  for (const s of sim.eventSites || []) list.push({
    id: s.kind, group: 'event', name: EVENTS[s.kind].name.replace(' — ', ': '), tag: s.kind === 'wreck' ? 'WRECK IT!' : 'VALET', color: s.kind === 'wreck' ? '#ff7a4a' : '#6ee2ff',
    how: EVENT_HOW[s.kind] || 'Drive onto the ring and press START.',
    live: () => !sim.event && !sim.job, pos: () => (sim.event ? null : s.p), site: s,
  });
  if (sim.chaseSite) list.push({
    id: 'chase', group: 'event', name: 'BOARD CHASE', tag: 'BOARD CHASE', color: '#7dffa8', board: true,
    how: 'Ride the skateboard to the pier marker and press START. Hit every checkpoint to the safehouse.',
    live: () => !sim.event && !sim.job, pos: () => (sim.event ? null : sim.chaseSite.p), site: sim.chaseSite,
  });
  const g = L.buildings.find(b => b.id === 'garage');
  if (g) list.push({ id: 'jobs', group: 'hub', name: 'JOBS', tag: 'JOBS', color: '#ffd45c', how: '', live: () => true, pos: () => [g.x + g.w / 2, g.y + g.d * 0.45], big: true });
  sim.activities = list;
}

// what the street markers draw this frame: [{ a, x, y }] for every activity with a position
export function markers(sim, out = []) {
  out.length = 0;
  for (const a of sim.activities || []) { const p = a.pos(); if (p) out.push({ a, x: p[0], y: p[1] }); }
  return out;
}

// the rows HELP and the start page list: everything startable, in one order
export function helpRows(sim) { return (sim.activities || []).filter(a => a.group !== 'hub'); }

// JUMP: put the player AT an activity, ready to play — free, no score or wanted change. Whatever
// was running (a job, an event, a board ride, a drive) is ended cleanly first, exactly as getting
// out would. Motel: on foot at the door, ENTER armed. Jobs: seated in the job vehicle, START armed.
// Events: in a car on the ring, START armed. Returns true if the jump happened.
export function jump(sim, id) {
  const a = (sim.activities || []).find(q => q.id === id), P = sim.player, p = P.ped;
  if (!a || a.group === 'hub' || P.mode === 'siege' || sim.siege || sim.busted) return false;
  quitJob(sim); quitEvent(sim);
  if (P.mode === 'board') dismount(sim);
  const leave = () => { if (P.mode === 'car') { const c = P.car; c.v = 0; c.driver = null; c.parked = true; c.fixed = false; P.mode = 'foot'; P.car = null; p.hidden = false; } };
  const seat = (c) => { leave(); c.driver = 'player'; c.parked = false; c.fixed = false; c.v = 0; c.siren = false; P.mode = 'car'; P.car = c; p.hidden = true; p.x = c.x; p.y = c.y; };
  if (a.group === 'siege') {
    leave();
    const d = sim.W.L.motelDoor; p.x = d[0] + 14; p.y = d[1]; p.h = Math.PI; p.hidden = false;
  } else if (a.group === 'job') {
    const c = a.car();
    if (!c || c.wreck) return false;
    seat(c);
  } else if (a.board) {
    // the board chase: standing on the board at the pier marker, START armed
    leave();
    const b = sim.board; b.x = CHASE.site[0]; b.y = CHASE.site[1]; b.vx = b.vy = 0; p.x = b.x; p.y = b.y; p.h = -Math.PI / 2; p.hidden = false;
    mount(sim);
  } else {
    // an event wants a car: keep the one you are in, else borrow the nearest one that still runs
    let c = P.mode === 'car' && !P.car.wreck && !P.car.job ? P.car : null;
    if (!c) { let bd = 1e18; for (const k of sim.cars) { if (k.wreck || k.job || k.driver) continue; const d = (k.x - a.site.p[0]) ** 2 + (k.y - a.site.p[1]) ** 2; if (d < bd) { bd = d; c = k; } } }
    if (!c) return false;
    seat(c); c.x = a.site.p[0]; c.y = a.site.p[1]; c.h = -Math.PI / 2; p.x = c.x; p.y = c.y;
  }
  P.stunT = 0; P.slowT = 0;
  sim.camSnap = true;                                   // main.js cuts the camera instead of swooping across town
  sim.ev('door');
  return true;
}
