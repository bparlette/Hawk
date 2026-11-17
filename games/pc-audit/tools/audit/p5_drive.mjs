// AUDIT PROBE (Opus, Nov 17) — node tools/audit/p5_drive.mjs  (from games/pc-audit/). Lines marked BUG reproduce AUDIT-REPORT.md findings.
import { fresh, run, idle, check, act } from './common.mjs';
for (const id of ['taxi', 'tow', 'bus', 'getaway', 'wreck', 'valet', 'spot', 'openroad']) {
  const { s } = fresh(); act.jump(s, id); run(s, 2, idle());
  const c = s.player.car; if (!c) { check(`${id}: seated`, false); continue; }
  const x0 = c.x, y0 = c.y; let best = 0;
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {           // try four directions; any one must move it
    c.x = x0; c.y = y0; c.v = 0; c.h = a;
    for (let i = 0; i < 90; i++) s.step(1 / 60, idle({ keys: { up: true } }));
    best = Math.max(best, Math.hypot(c.x - x0, c.y - y0));
  }
  check(`${id}: the vehicle drives (best of 4 headings, 1.5 s)`, best > 80, `moved ${Math.round(best)} model ${c.model}`);
}
