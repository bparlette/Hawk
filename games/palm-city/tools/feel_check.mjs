// feel_check.mjs — headless checks of the feel-pass rules using the real sim:
// bumps (people, palms), the walkable pier and other interactables, and the punch.
// Usage: node tools/feel_check.mjs   (exit 0 = all pass)
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
const stick = (a, m = 1, extra = {}) => ({ jx: Math.cos(a), jy: Math.sin(a), jm: m, action: false, punch: false, keys: {}, ...extra });
const idle = (extra = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, keys: {}, ...extra });
function fresh() {
  const ev = [];
  const s = new Sim(world, M, 3, (n) => ev.push(n));
  s.cars = []; s.peds = [s.player.ped];           // empty streets: every check places what it needs
  return { s, ev };
}
const run = (s, n, inp) => { for (let i = 0; i < n; i++) s.step(STEP, typeof inp === 'function' ? inp(i) : inp); };
const place = (s, x, y) => { s.player.ped.x = x; s.player.ped.y = y; };
const ped = (s, x, y) => { const p = s.makePed(x, y, 'ped_sun', { type: 'line', x, y, dir: 1 }); p.speed = 0; s.peds.push(p); return p; };
const E = 0, N = -Math.PI / 2, W_ = Math.PI;

// ---------------------------------------------------------------- bumps: people
{
  const { s, ev } = fresh();
  place(s, 1310, 900); const o = ped(s, 1310, 860);
  let minD = 1e9, stumbled = false;
  run(s, 90, () => { minD = Math.min(minD, Math.hypot(o.x - s.player.ped.x, o.y - s.player.ped.y)); stumbled ||= o.mode === 'stumble'; return stick(N); });
  check('running into a pedestrian: they stumble', stumbled && ev.includes('bump'));
  check('…and you never pass through them', minD > 6, `closest ${minD.toFixed(1)}`);
}
{
  const { s } = fresh();
  place(s, 100, 100); const o = ped(s, 800, 800);
  const c = s.addCar(768, 800, E, 'sedan_teal', 'player'); s.player.mode = 'car'; s.player.car = c; c.v = 220;   // close: no time to dive clear
  let wentDown = false;
  run(s, 60, () => { wentDown ||= o.mode === 'down'; return idle(); });
  check('car at speed: pedestrian goes down and it feeds wanted', wentDown && s.stars === 1, `stars ${s.stars}`);
  run(s, 330, idle());
  check('…and gets back up', o.mode !== 'down' && !o.down, o.mode);
}
{
  const { s } = fresh();
  place(s, 100, 100); const o = ped(s, 800, 800);
  const c = s.addCar(760, 800, E, 'sedan_teal', 'player'); s.player.mode = 'car'; s.player.car = c;
  let stumbled = false, down = false;
  run(s, 80, () => { c.v = Math.max(c.v, 30); stumbled ||= o.mode === 'stumble'; down ||= o.mode === 'down'; return idle(); });
  check('slow bumper: pedestrian stumbles aside, no knockdown, no star', stumbled && !down && s.stars === 0);
}
{
  const { s } = fresh();
  Object.assign(s.board, { x: 1310, y: 900, h: N, vx: 0, vy: -200, ridden: true }); s.player.mode = 'board';
  const o = ped(s, 1310, 840);
  let wentDown = false;
  run(s, 40, () => { wentDown ||= o.mode === 'down'; return idle(); });
  const sp = Math.hypot(s.board.vx, s.board.vy);
  check('skater at speed: pedestrian goes down, skater sheds momentum', wentDown && sp < 150, `speed ${sp.toFixed(0)}`);
  run(s, 200, idle());
  check('…and gets back up', o.mode !== 'down', o.mode);
}
// ---------------------------------------------------------------- bumps: palms
const palm = world.trunks.find(t => t.x === 1290 && t.y === 880);
{
  const { s, ev } = fresh();
  place(s, 1290, 930);
  let minD = 1e9;
  run(s, 90, () => { minD = Math.min(minD, Math.hypot(palm.x - s.player.ped.x, palm.y - s.player.ped.y)); return stick(N); });
  check('on foot: a palm is solid', minD >= palm.r + 2.9, `closest ${minD.toFixed(1)} trunk r ${palm.r.toFixed(1)}`);
  check('…and it shakes and drops leaves', ev.includes('rustle') && s.leaves.length > 0, `leaves ${s.leaves.length}`);
}
{
  const { s, ev } = fresh();
  Object.assign(s.board, { x: 1290, y: 960, h: N, vx: 0, vy: -210, ridden: true }); s.player.mode = 'board';
  run(s, 40, idle());
  check('skater at speed into a palm: bail', s.player.mode === 'foot' && ev.includes('bail') && ev.includes('rustle'));
  check('…and the board did not pass the trunk', s.board.y > palm.y, `board y ${s.board.y.toFixed(0)}`);
}
{
  const { s, ev } = fresh();
  place(s, 100, 100);
  const c = s.addCar(1290, 980, N, 'sedan_teal', 'player'); s.player.mode = 'car'; s.player.car = c; c.v = 180;
  run(s, 60, idle());
  check('car into a palm: solid stop with a shake', c.y > palm.y + 20 && Math.abs(c.v) < 40 && ev.includes('rustle') && ev.includes('crash'), `y ${c.y.toFixed(0)} v ${c.v.toFixed(0)}`);
}
// ---------------------------------------------------------------- the pier and other interactables
const PR = layout.pier;
{
  const { s } = fresh();
  place(s, 1340, PR.y + PR.h / 2);
  let minY = 1e9, maxY = -1e9;
  run(s, 420, () => { const p = s.player.ped; minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); return stick(E); });
  const p = s.player.ped;
  check('pier: you can walk out to the very end', p.x > PR.x + PR.w - 8 && p.x < PR.x + PR.w, `x ${p.x.toFixed(0)} of ${PR.x + PR.w}`);
  check('…staying on the planks', minY > PR.y && maxY < PR.y + PR.h);
  run(s, 120, stick(N));
  check('…and the side rail holds you in', s.player.ped.y > PR.y + 3 && s.player.ped.x > 1600, `y ${s.player.ped.y.toFixed(1)}`);
  run(s, 120, stick(E));
  check('…and so does the end rail', s.player.ped.x < PR.x + PR.w - 3, `x ${s.player.ped.x.toFixed(1)}`);
}
{
  const { s } = fresh();
  place(s, 1350, 900);                                   // from the sand north of the pier, straight at the sea
  run(s, 200, stick(E));
  check('open water is still closed on foot', s.player.ped.x < world.shoreX(s.player.ped.y) + 7, `x ${s.player.ped.x.toFixed(0)}`);
}
{
  const { s, ev } = fresh();
  Object.assign(s.board, { x: 1340, y: PR.y + PR.h / 2, h: E, vx: 120, vy: 0, ridden: true }); s.player.mode = 'board';
  run(s, 70, stick(E));
  check('the board rolls onto the pier', s.player.mode === 'board' && s.board.x > PR.x + 100 && !ev.includes('bail'), `x ${s.board.x.toFixed(0)}`);
  run(s, 240, stick(E, 0.5));
  check('…and the end rail keeps board and rider out of the sea', s.board.x < PR.x + PR.w && s.canStand(s.player.ped.x, s.player.ped.y), `board x ${s.board.x.toFixed(0)} rider ${s.player.mode} x ${s.player.ped.x.toFixed(0)}`);
}
{
  const { s } = fresh();
  place(s, 100, 100);
  const c = s.addCar(1340, PR.y + PR.h / 2, E, 'sedan_teal', 'player'); s.player.mode = 'car'; s.player.car = c; c.v = 150;
  run(s, 120, idle());
  check('cars stay off the pier', c.x < PR.x + 30, `x ${c.x.toFixed(0)}`);
}
{
  const { s } = fresh();
  const b = s.benches.find(q => q.x === 800 && q.y === 560);
  place(s, 800, 600);
  let minD = 1e9;
  run(s, 120, () => { minD = Math.min(minD, Math.hypot(s.player.ped.x - b.x, s.player.ped.y - b.y)); return stick(N); });
  check('benches are solid: straight at one, you stop', minD > 7 && s.player.ped.y > b.y + 6, `closest ${minD.toFixed(1)} y ${s.player.ped.y.toFixed(0)}`);
  run(s, 60, stick(E)); run(s, 90, stick(N));
  check('…and you can walk round it', s.player.ped.y < b.y - 10, `y ${s.player.ped.y.toFixed(0)}`);
}
{
  const { s } = fresh();
  const f = layout.props.find(q => q.type === 'fountain');
  place(s, f.x - 70, f.y + 2);
  let minD = 1e9;
  run(s, 150, () => { minD = Math.min(minD, Math.hypot(s.player.ped.x - f.x, s.player.ped.y - f.y)); return stick(E); });
  check('the fountain basin is solid', minD > 32, `closest ${minD.toFixed(1)}`);
}
{
  const { s, ev } = fresh();
  place(s, 1320, 700);
  run(s, 40, stick(E));
  check('promenade rail: you hop it onto the sand', ev.includes('hop') && s.player.ped.x > 1336, `x ${s.player.ped.x.toFixed(0)}`);
}
{
  const t = new Sim(world, M, 3, () => {});                // an untouched sim: the strollers are part of the city
  const q = t.peds.filter(p => p.path && p.path.type === 'pier');
  let reached = false;
  for (let i = 0; i < 60 * 40; i++) { t.step(STEP, idle()); reached ||= q.some(p => p.x > PR.x + PR.w - 20); }
  check('people stroll the pier out to the end', q.length === 2 && reached && q.every(p => t.canStand(p.x, p.y)));
}
// ---------------------------------------------------------------- the punch
{
  const { s, ev } = fresh();
  place(s, 1310, 900); s.player.ped.h = N;
  const o = ped(s, 1310, 884), w1 = ped(s, 1300, 800), w2 = ped(s, 1318, 960), w3 = ped(s, 1305, 1010), far = ped(s, 1310, 500);
  const y0 = s.player.ped.y;
  run(s, 1, idle({ punch: true }));
  check('punch: a hit staggers them', o.mode === 'stumble' && ev.includes('punch') && s.fx.length === 1);
  run(s, 12, idle());
  check('…with a short lunge', y0 - s.player.ped.y > 4 && y0 - s.player.ped.y < 20, `lunged ${(y0 - s.player.ped.y).toFixed(1)}`);
  const react = [w1, w2, w3].filter(w => w.mode === 'flee' || w.gawkT > 0).length;
  check('…witnesses react (run or stare), people far away do not', react === 3 && far.mode === 'walk' && !(far.gawkT > 0), `reacted ${react}/3`);
  run(s, 16, idle());
  s.player.ped.x = o.x; s.player.ped.y = o.y + 12; s.player.ped.h = N;
  run(s, 1, idle({ punch: true }));
  check('…a second hit puts them down', o.mode === 'down', o.mode);
  run(s, 200, idle());
  check('…and they get up and run', o.mode === 'flee' || o.gone, o.mode);
  check('…no cop watching: no stars', s.stars === 0);
}
{
  const { s, ev } = fresh();
  place(s, 1310, 900); s.player.ped.h = N;
  run(s, 1, idle({ punch: true }));
  check('punching thin air is just a swing', ev.includes('swing') && !ev.includes('punch') && s.player.punchN === 1);
  run(s, 5, idle({ punch: true }));
  check('…with a cooldown', s.player.punchN === 1);
}
{
  const { s } = fresh();
  place(s, 1310, 900); s.player.ped.h = N; ped(s, 1310, 884);
  s.addCar(1224, 1000, N, 'police', 'ai', { s: 0, dir: 1, cruise: 0 });       // a patrol car down the road, in sight
  run(s, 1, idle({ punch: true }));
  check('punching someone in a cop\'s view raises wanted', s.stars === 1, `stars ${s.stars}`);
}
{
  const { s } = fresh();
  place(s, 480, 1380); s.player.ped.h = N; ped(s, 480, 1364);                  // south side of the motel
  s.addCar(480, 1100, N, 'police', 'ai', { s: 0, dir: 1, cruise: 0 });         // patrol car north of it: the building is in the way
  run(s, 1, idle({ punch: true }));
  check('…but not when a building blocks the view', s.stars === 0, `stars ${s.stars}`);
}
{
  const { s } = fresh();
  place(s, 1310, 900); s.player.ped.h = N;
  const cop = s.makePed(1310, 884, 'cop', null, 0); cop.mode = 'cop'; s.peds.push(cop);
  run(s, 1, idle({ punch: true }));
  check('punching an officer is a star', s.stars === 1 && cop.mode === 'stumble', `stars ${s.stars} ${cop.mode}`);
}
{
  const { s } = fresh();
  Object.assign(s.board, { x: 1310, y: 900, h: N, vx: 0, vy: -150, ridden: true }); s.player.mode = 'board';
  run(s, 1, idle({ punch: true }));
  check('on the board the fight button is the ollie', s.board.air > 0 && !(s.player.punchN > 0));
}
{
  const { s } = fresh();
  place(s, 100, 100);
  const c = s.addCar(800, 800, E, 'sedan_teal', 'player'); s.player.mode = 'car'; s.player.car = c;
  run(s, 1, idle({ punch: true }));
  check('in a car the fight button does nothing', s.player.mode === 'car' && !(s.player.punchN > 0));
}
console.log(fails ? `FEEL FAIL (${fails})` : 'FEEL OK');
process.exit(fails ? 1 : 0);
