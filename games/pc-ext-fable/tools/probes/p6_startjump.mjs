// GAMEPLAY PROBE (Opus audit, Nov 17) — BUILD=<folder> node tools/probes/p6_startjump.mjs  (from games/pc-audit/). Lines marked BUG reproduce AUDIT-REPORT.md findings.
import { SRC, fresh, run, idle, check } from './common.mjs';
// the start page: JUMP is delivered as input on the very first sim step (main.js ui.jump)
const { s } = fresh(); s.step(1 / 60, idle({ jump: 'openroad' })); run(s, 3, idle()); run(s, 1, idle({ punch: true }));   // JUMP, then A = START OPEN ROAD
const c = s.player.car; run(s, 3, idle());
const g = s.openroadCar;
check('start-page JUMP OPEN ROAD seats the grid race car', c && c === g, `seated ${c && c.model} ring=${c && c.ring} openroad=${c && c.openroad}; grid car ${g && g.model} at ${g && Math.round(g.x)},${g && Math.round(g.y)}; gap ${c && g ? Math.round(Math.hypot(c.x - g.x, c.y - g.y)) : '-'}`);
const vr = s.cars.find(k => k.ring === 'valet');
check('VALET ring car still waiting in its ring', vr && vr !== c && Math.hypot(vr.x - 715, vr.y - 1655) < 5, `valet ring car at ${vr && Math.round(vr.x)},${vr && Math.round(vr.y)} (driven by player: ${vr === c})`);
// same thing later in a session, after the grid car exists
const t = fresh().s; run(t, 30, idle()); t.step(1 / 60, idle({ jump: 'openroad' })); run(t, 3, idle()); run(t, 1, idle({ punch: true }));
const roses = t.cars.filter(k => k.model === 'conv_rose' && Math.hypot(k.x - 372, k.y - 1275) < 200).length;
check('mid-session JUMP OPEN ROAD seats the grid race car, no duplicate', t.player.car && t.player.car.openroad && roses === 1 && !!t.event, `roses ${roses} event ${t.event && t.event.kind}`,  `seated ${t.player.car && t.player.car.model}`);
