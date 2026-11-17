// AUDIT PROBE (Opus, Nov 17) — node tools/audit/p4_craft_heli.mjs  (from games/pc-audit/). Lines marked BUG reproduce AUDIT-REPORT.md findings.
import { fresh, run, idle, stick, check, act } from './common.mjs';
const H = await import('../../src/heli.js');
// boats: full throttle east from the mooring, record speed and displacement
for (const kind of ['jetski', 'boat']) {
  const { s } = fresh(); const cr = s.water.craft.find(c => c.kind === kind), PIER = s.W.L.pier;
  s.player.ped.x = cr.x; s.player.ped.y = PIER.y + PIER.h - 6; run(s, 1, idle({ action: true }));
  const x0 = cr.x, y0 = cr.y; let vmax = 0;
  for (let i = 0; i < 60 * 6; i++) { s.step(1 / 60, stick(Math.PI / 2 + 0.4, 1, { turbo: i > 120 })); vmax = Math.max(vmax, Math.hypot(cr.vx, cr.vy)); }
  check(`${kind} translates under full throttle`, Math.hypot(cr.x - x0, cr.y - y0) > 300, `moved ${Math.round(Math.hypot(cr.x - x0, cr.y - y0))} vmax ${Math.round(vmax)} now ${Math.round(cr.x)},${Math.round(cr.y)}`);
  // drive to the far SE corner and check it stays in the sea bounds
  for (let i = 0; i < 60 * 25; i++) s.step(1 / 60, stick(Math.atan2(2850 - cr.y, 2450 - cr.x), 1, { turbo: true }));
  check(`${kind} reaches the extended sea SE`, cr.x > 2000 && cr.y > 2400, `at ${Math.round(cr.x)},${Math.round(cr.y)}`);
}
// heli: steal via JUMP, fly west over the extension and east over the extended sea
{ const { s } = fresh(); act.jump(s, 'heli'); run(s, 2, idle()); run(s, 1, idle({ action: true }));
  check('heli steal from JUMP spot', s.player.mode === 'air', `mode ${s.player.mode} stars ${s.stars}`);
  run(s, 60, idle());
  for (let i = 0; i < 60 * 15; i++) s.step(1 / 60, stick(Math.PI, 1));
  const h = s.heli; check('heli can fly over the western extension', h.x < -200, `stopped at x=${Math.round(h.x)} (world bounds x0=${s.W.bounds.x0})`);
  for (let i = 0; i < 60 * 15; i++) s.step(1 / 60, stick(0, 1));
  check('heli can fly over the extended sea', h.x > 1800, `stopped at x=${Math.round(h.x)} (seaE=${s.W.seaE})`);
  // land on water refused, then land on the pier
  h.x = 1700; h.y = 1300; run(s, 2, idle({ action: true })); check('heli refuses water landing', h.state === 'fly', h.state);
  h.x = 1500; h.y = 1035; h.vx = h.vy = 0; run(s, 1, idle({ action: true })); run(s, 90, idle());
  const p = s.player.ped; check('heli lands on the pier, player steps out standable', h.state === 'parked' && s.player.mode === 'foot' && s.canStand(p.x, p.y), `state ${h.state} ped ${Math.round(p.x)},${Math.round(p.y)} canStand ${s.canStand(p.x, p.y)}`);
  // narrow-landing: land on a lone sand spot right at the waterline
  run(s, 1, idle({ action: true })); run(s, 60, idle());
  const yy = 600, sx = s.W.shoreX(yy); h.x = sx - 3; h.y = yy; h.vx = h.vy = 0; run(s, 1, idle({ action: true })); run(s, 90, idle());
  check('heli landed at the waterline: player not stranded', s.canStand(p.x, p.y), `state ${h.state} ped ${Math.round(p.x)},${Math.round(p.y)} surf ${s.W.surfaceAt(p.x, p.y)}`);
}
