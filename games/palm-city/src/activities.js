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
import { EVENTS } from './events.js';

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
