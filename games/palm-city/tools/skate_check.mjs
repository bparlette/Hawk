// skate_check.mjs — headless checks of the skateboard rules using the real sim.
// Usage: node tools/skate_check.mjs   (exit 0 = all pass)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { Sim } from '../src/sim.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
const STEP = 1 / 60;
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) fails++; };
const stick = (a, m = 1, action = false) => ({ jx: Math.cos(a), jy: Math.sin(a), jm: m, action, keys: {} });
const idle = (action = false) => ({ jx: 0, jy: 0, jm: 0, action, keys: {} });
function fresh() {
  const ev = [];
  const s = new Sim(world, M, 3, (n, v) => ev.push(n));
  s.cars = s.cars.filter(c => c.parked);  // quiet streets for deterministic checks
  s.peds = [s.player.ped];
  return { s, ev };
}
const run = (s, n, inp) => { for (let i = 0; i < n; i++) s.step(STEP, typeof inp === 'function' ? inp(i) : inp); };

// 1. pickup with the action button
{
  const { s } = fresh();
  s.player.ped.x = s.board.x + 8; s.player.ped.y = s.board.y;
  run(s, 1, idle(true));
  check('action button mounts the board', s.player.mode === 'board');
  run(s, 120, stick(-Math.PI / 2));
  const sp = Math.hypot(s.board.vx, s.board.vy);
  check('pushing builds speed', sp > 120, `speed ${sp.toFixed(0)}`);
  run(s, 60, idle());
  const sp2 = Math.hypot(s.board.vx, s.board.vy);
  check('momentum carries when you stop pushing', sp2 > sp * 0.6, `speed ${sp2.toFixed(0)}`);
}
// 2. ollie onto the promenade rail -> grind
{
  const { s, ev } = fresh();
  Object.assign(s.board, { x: 1326, y: 700, h: -Math.PI / 2, vx: 0, vy: -200, ridden: true });
  s.player.mode = 'board';
  run(s, 1, stick(-Math.PI / 2 + 0.25, 1, true));
  run(s, 50, stick(-Math.PI / 2 + 0.2, 0.3));
  check('ollie lands into a rail grind', !!s.board.grind || ev.includes('grind'), `x ${s.board.x.toFixed(0)}`);
  run(s, 60, idle());
  check('grind chains the combo', s.combo && s.combo.n >= 2, s.combo ? `n ${s.combo.n} pts ${s.combo.pts}` : '');
}
// 3. hood ollie off a cop car pays best
{
  const { s } = fresh();
  Object.assign(s.board, { x: 800, y: 780, h: 0, vx: 220, vy: 0, ridden: true });
  s.player.mode = 'board';
  s.addCar(860, 780, Math.PI / 2, 'police', null, { parked: true });
  run(s, 12, idle());
  run(s, 1, idle(true));
  run(s, 40, idle());
  check('cop hood ollie scores', s.lastTrick?.name === 'COP HOOD!' || (s.combo && s.combo.pts >= 900), s.combo ? `pts ${s.combo.pts}` : '');
}
// 4. near-miss
{
  const { s } = fresh();
  Object.assign(s.board, { x: 700, y: 820, h: 0, vx: 60, vy: 0, ridden: true });
  s.player.mode = 'board';
  const c = s.addCar(560, 800, 0, 'sedan_teal', null);
  c.v = 260;
  run(s, 50, i => { c.v = 260; return idle(); });
  check('near-miss counts', !!s.combo && s.combo.n >= 1, s.combo ? `pts ${s.combo.pts}` : 'no combo');
}
// 5. bail into a wall at speed
{
  const { s, ev } = fresh();
  Object.assign(s.board, { x: 420, y: 1000, h: Math.PI, vx: -0, vy: 0, ridden: true });
  s.player.mode = 'board';
  Object.assign(s.board, { x: 715, y: 1000, vx: -230, vy: 0, h: Math.PI });
  run(s, 30, idle());
  check('slamming a wall bails', s.player.mode === 'foot' && ev.includes('bail'));
}
// 6. drop the board when slow
{
  const { s } = fresh();
  Object.assign(s.board, { x: 1250, y: 1250, vx: 0, vy: 0, ridden: true });
  s.player.mode = 'board';
  run(s, 1, idle(true));
  check('action when stopped drops the board', s.player.mode === 'foot' && !s.board.ridden);
}
console.log(fails ? `SKATE FAIL (${fails})` : 'SKATE OK');
process.exit(fails ? 1 : 0);
