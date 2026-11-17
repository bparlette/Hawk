// AUDIT PROBE (Opus, Nov 17) — node tools/audit/p1_jump.mjs  (from games/pc-audit/). Lines marked BUG reproduce AUDIT-REPORT.md findings.
import { fresh, run, idle, stick, check, act, STEP } from './common.mjs';
// 1. every JUMP from foot lands playable
for (const a of fresh().s.activities.filter(a => a.group !== 'hub')) {
  const { s } = fresh(); run(s, 30, idle());
  const ok = act.jump(s, a.id); run(s, 10, idle());
  const P = s.player, p = P.ped, f = s.focus();
  check(`jump ${a.id} from foot`, ok && (P.mode !== 'foot' || s.canStand(p.x, p.y) || (s.roofStand && s.roofStand(p.x, p.y))), `mode ${P.mode} at ${Math.round(f.x)},${Math.round(f.y)}`);
}
// 2. JUMP from a boat
for (const id of ['motel', 'taxi', 'chase', 'heli', 'boats', 'wreck']) {
  const { s } = fresh(); run(s, 30, idle());
  const cr = s.water.craft[0], PIER = s.W.L.pier;
  s.player.ped.x = cr.x; s.player.ped.y = PIER.y + PIER.h - 6; run(s, 1, idle({ action: true }));
  const mounted = s.player.mode === 'water';
  run(s, 120, stick(Math.PI / 2, 1));     // ride a bit south
  const r = act.jump(s, id); run(s, 30, idle());
  const p = s.player.ped;
  const stillRidden = s.water.craft.filter(c => c.ridden).length;
  check(`jump ${id} from a jetski (mounted=${mounted})`, r && s.player.mode !== 'water' && stillRidden === 0,
    `returned ${r} mode ${s.player.mode} ped ${Math.round(p.x)},${Math.round(p.y)} craftRidden=${stillRidden} water.ride=${!!s.water.ride}`);
  if (id === 'taxi') {   // orphan check: can anyone ever mount craft[0] again?
    run(s, 60 * 40, idle());
    check('  jetski usable again 40 s later', !s.water.craft[0].ridden, `ridden=${s.water.craft[0].ridden} at ${Math.round(s.water.craft[0].x)},${Math.round(s.water.craft[0].y)}`);
  }
}
// 3. BOATS jump when the jetski is out in the bay (unridden)
{ const { s } = fresh(); const cr = s.water.craft[0]; cr.x = 2200; cr.y = 2300; run(s, 5, idle());
  act.jump(s, 'boats'); run(s, 5, idle()); const p = s.player.ped;
  check('jump boats while jetski is out in the bay', s.canStand(p.x, p.y), `ped ${Math.round(p.x)},${Math.round(p.y)} surface ${s.W.surfaceAt(p.x, p.y)} onPier ${s.W.onPier(p.x, p.y, 0)}`);
  const x0 = p.x, y0 = p.y; run(s, 120, stick(Math.PI, 1)); check('  ...and can walk away', Math.hypot(p.x - x0, p.y - y0) > 20, `moved ${Math.round(Math.hypot(p.x - x0, p.y - y0))}`); }
