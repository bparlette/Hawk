// labels_check.mjs — helper labels retire after first use (owner rule, Nov 17): a vehicle/mode
// word plaque (BOATS, TAXI, ...) is a first-time-play helper. Ride/drive that vehicle
// CONTINUOUSLY for ~3 s and the plaque fades and never returns — not later in the session,
// not after a reload (localStorage, one key per label). Other labels are untouched.
// Drives the real sim headless with a stub localStorage; a "reload" is a fresh Sim reading
// the same stub. Usage: node tools/labels_check.mjs   (exit 0 = all pass)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- localStorage stub, installed before any Sim is built (labels.js reads it lazily)
const backing = new Map();
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
  clear: () => backing.clear(),
  key: (i) => [...backing.keys()][i] ?? null,
  get length() { return backing.size; },
};

const { World } = await import('../src/world.js');
const { Sim } = await import('../src/sim.js');
const { markers } = await import('../src/activities.js');
const { labelLearned, LEARN_SECONDS } = await import('../src/labels.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
const STEP = 1 / 60;
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) fails++; };
const stick = (a, m = 1, extra = {}) => ({ jx: Math.cos(a), jy: Math.sin(a), jm: m, action: false, punch: false, turbo: false, keys: {}, ...extra });
const idle = (extra = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, ...extra });
const run = (s, secs, inp) => { const n = Math.round(secs * 60); for (let i = 0; i < n; i++) s.step(STEP, typeof inp === 'function' ? inp(i) : inp); };
const has = (s, id) => markers(s).find(m => m.a.id === id);
function fresh() {
  const s = new Sim(world, M, 3, () => {});
  s.cars = s.cars.filter(c => c.parked);
  s.peds = [s.player.ped];
  return s;
}
const PIER = layout.pier;
function mountAt(s, kind) {
  const cr = s.water.craft.find(c => c.kind === kind);
  s.player.ped.x = cr.x; s.player.ped.y = PIER.y + PIER.h - 6;
  run(s, STEP, idle({ action: true }));
  return cr;
}
function rideOut(s, cr) { cr.x = 1700; cr.y = 1500; cr.h = -Math.PI / 2; cr.vx = cr.vy = 0; }

// 1. first play: every plaque is up, nothing persisted yet
{
  backing.clear();
  const s = fresh();
  check('first play: BOATS plaque is drawn', !!has(s, 'boats') && has(s, 'boats').alpha === 1);
  check('first play: TAXI plaque is drawn', !!has(s, 'taxi'));
  check('first play: nothing learned, nothing stored', !labelLearned(s, 'boats') && backing.size === 0);
}

// 2. ride the jetski: under ~3 s the plaque stays; past ~3 s continuous it retires and fades
{
  backing.clear();
  const s = fresh();
  const cr = mountAt(s, 'jetski');
  check('mounted the jetski', s.player.mode === 'water' && s.water.ride === cr);
  rideOut(s, cr);
  run(s, LEARN_SECONDS - 0.5, stick(-Math.PI / 2));
  check('2.5 s on the jetski: not learned yet', !labelLearned(s, 'boats') && backing.get('pc_label_boats') !== '1');
  // cross the 3 s line one frame at a time and watch the goodbye fade happen
  let sawMidFade = false, gone = false;
  for (let i = 0; i < 120; i++) {
    s.step(STEP, stick(-Math.PI / 2));
    const m = has(s, 'boats');
    if (!m) { gone = true; break; }
    if (m.alpha > 0.05 && m.alpha < 0.95) sawMidFade = true;
  }
  check('~3 s continuous: BOATS learned and persisted', labelLearned(s, 'boats') && backing.get('pc_label_boats') === '1');
  check('the plaque fades rather than blinking out (a mid-fade frame exists)', sawMidFade);
  check('after the fade the plaque is gone for good', gone);
  check('riding the jetski did NOT retire TAXI', !!has(s, 'taxi') && backing.get('pc_label_taxi') !== '1');
  check('the JOBS signpost is still up (no job learned)', !!has(s, 'jobs'));
}

// 3. reload: a fresh Sim over the same localStorage never draws BOATS again, from frame one
{
  const s = fresh();   // backing still holds pc_label_boats from block 2 — that IS the reload
  check('after reload: BOATS never comes back', !has(s, 'boats') && labelLearned(s, 'boats'));
  check('after reload: unlearned TAXI still shows', !!has(s, 'taxi'));
}

// 4. continuity: 2 s on, hop off, 2 s on again is NOT enough — the count is continuous
{
  backing.clear();
  const s = fresh();
  const cr = mountAt(s, 'jetski');
  rideOut(s, cr);
  run(s, 2.0, stick(-Math.PI / 2));
  cr.x = 1592; cr.y = PIER.y + PIER.h + 36; cr.vx = cr.vy = 0;   // back alongside the dock
  run(s, STEP, idle({ action: true }));
  check('hopped off at the dock', s.player.mode === 'foot');
  const cr2 = mountAt(s, 'jetski');
  rideOut(s, cr2);
  run(s, 2.0, stick(-Math.PI / 2));
  check('2 s + off + 2 s: still not learned (continuous, not cumulative)', !labelLearned(s, 'boats'));
  run(s, 1.2, stick(-Math.PI / 2));
  check('one unbroken 3.2 s ride: learned', labelLearned(s, 'boats'));
}

// 5. a job vehicle: driving the cab retires TAXI only; the signpost waits for all four jobs
{
  backing.clear();
  const s = fresh();
  const P = s.player, cab = s.cars.find(c => c.job === 'taxi');
  P.mode = 'car'; P.car = cab; cab.driver = 'player'; cab.parked = false; P.ped.hidden = true;
  run(s, LEARN_SECONDS + 0.3, idle());
  check('3.3 s in the cab: TAXI learned and persisted', labelLearned(s, 'taxi') && backing.get('pc_label_taxi') === '1');
  run(s, 0.6, idle());
  P.mode = 'foot'; P.car = null; cab.driver = null; cab.parked = true; P.ped.hidden = false;   // step out: the plaque would normally return
  check('after stepping out, the TAXI plaque does NOT return', !has(s, 'taxi'));
  check('TOW / BUS / GETAWAY plaques untouched', !!has(s, 'tow') && !!has(s, 'bus') && !!has(s, 'getaway'));
  check('BOATS untouched by driving the cab', !!has(s, 'boats'));
  check('JOBS signpost still up (only one job learned)', !!has(s, 'jobs'));
}

console.log(fails ? `LABELS FAIL (${fails})` : 'LABELS OK');
process.exit(fails ? 1 : 0);
