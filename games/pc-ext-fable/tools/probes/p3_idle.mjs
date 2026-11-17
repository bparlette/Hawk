// GAMEPLAY PROBE (Opus audit, Nov 17) — BUILD=<folder> node tools/probes/p3_idle.mjs  (from games/pc-audit/). Lines marked BUG reproduce AUDIT-REPORT.md findings.
import { SRC, fresh, run, idle, check } from './common.mjs';
// No input at all: the player stands near the circle for 6 minutes of normal traffic.
const { s } = fresh(); s.player.ped.x = 330; s.player.ped.y = 1180;
const roses = () => s.cars.filter(c => c.openroad !== undefined || (c.model === 'conv_rose' && c.fixed === true));
for (let m = 1; m <= 6; m++) { run(s, 60 * 60, idle()); console.log(`t=${m}min cars ${s.cars.length} grid-born cars ${s.cars.filter(c => c.model === 'conv_rose' && c.fixed === true).length} gridcar@${Math.round(s.openroadCar.x)},${Math.round(s.openroadCar.y)}`); }
check('6 min of idle traffic by the circle: one race car', s.cars.filter(c => c.model === 'conv_rose' && c.fixed === true).length === 1);
