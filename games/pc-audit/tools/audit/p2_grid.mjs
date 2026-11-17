// AUDIT PROBE (Opus, Nov 17) — node tools/audit/p2_grid.mjs  (from games/pc-audit/). Lines marked BUG reproduce AUDIT-REPORT.md findings.
import { fresh, run, idle, stick, check, act } from './common.mjs';
const grid = (s) => s.cars.filter(c => c.model === 'conv_rose' && Math.hypot(c.x - 372, c.y - 1275) < 200);
// A. nudge the grid car out of its 30-unit tolerance (a bump), count conv_roses near the site
{ const { s } = fresh(); run(s, 10, idle());
  const n0 = s.cars.length, g0 = s.openroadCar; g0.x += 35; run(s, 5, idle());
  const g = grid(s);
  check('grid car nudged 35 u: no duplicate race car', g.length === 1, `conv_rose cars near the circle: ${g.length}; total cars ${n0} -> ${s.cars.length}; old.fixed=${g0.fixed}`);
  for (let k = 0; k < 5; k++) { s.openroadCar.x += 35; run(s, 5, idle()); }
  check('  ...after 5 more nudges', grid(s).length === 1, `${grid(s).length} race cars parked around the circle (all fixed: never culled)`); }
// B. full Open Road run via JUMP + the real START button, autopilot along the route; then the aftermath
const OR = await import('../../src/openroad.js');
{ const { s, ev } = fresh(); run(s, 10, idle());
  act.jump(s, 'openroad'); run(s, 2, idle());
  run(s, 1, idle({ punch: true })); 
  check('openroad starts from JUMP + A', s.event && s.event.kind === 'openroad', `event ${s.event && s.event.kind}`);
  const R = OR.route(); let maxRoute = 0, i = 0;
  const pilot = () => { const c = s.player.car; if (!c || !s.event) return idle(); const rs = OR.routeSOf(R, c.x, c.y, s.event.routeS); const t = OR.routeAt(R, rs + 90, 0); const a = Math.atan2(t.y - c.y, t.x - c.x); return stick(a, 1, { turbo: (i++ % 300) < 150 }); };
  for (let k = 0; k < 60 * 70 && s.event; k++) { s.step(1 / 60, pilot()); if (s.event) maxRoute = Math.max(maxRoute, s.event.routeS); }
  const r = s.eventResult;
  check('openroad autopilot reaches an end state', !!r, `result ${r && r.text} maxRouteS ${Math.round(maxRoute)}/${Math.round(R.len)} pts ${r && r.pts} busted ${!!s.busted}`);
  const leftovers = s.cars.filter(c => c.x < 0 && c.parked && c.fixed !== false && c.driver == null);
  run(s, 60 * 5, idle());
  check('openroad leaves no permanent parked shell cars', leftovers.filter(c => s.cars.includes(c)).length === 0, `${leftovers.filter(c => s.cars.includes(c)).length} parked route cars kept forever (parked && fixed!==false)`);
  const cops = s.cars.filter(c => c.kind === 'police' && c.x < 0);
  check('after the race: player state sane', s.player.mode === 'car' && s.gripMul === 1, `mode ${s.player.mode} grip ${s.gripMul} stars ${s.stars} shellCops ${cops.length}`);
}
// C. ring guardian must not duplicate: wreck the wreck-ring car, wait at the ring
{ const { s } = fresh(); const rc = s.cars.find(c => c.ring === 'wreck'); rc.wreck = true; rc.dmg = 1;
  s.player.ped.x = 1168; s.player.ped.y = 560; const n = s.cars.filter(c => c.ring).length; run(s, 60 * 11, idle());
  check('ring guardian restores without spawning', !rc.wreck && s.cars.filter(c => c.ring).length === n, `wreck=${rc.wreck} ringCars ${n}->${s.cars.filter(c => c.ring).length}`); }
