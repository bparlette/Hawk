// siege_check.mjs — rule checks for the Motel Siege (src/siege.js), on the real sim in Node, driven
// through the same input object the touch controls produce (joystick jx/jy, action, punch).
// Usage: node tools/siege_check.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { Sim } from '../src/sim.js';
import { siegeAction } from '../src/siege.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
const S = layout.siege;
let fails = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const DT = 1 / 60, none = { jx: 0, jy: 0, jm: 0, keys: {} };

function fresh(stars = 1) {
  const events = [];
  const sim = new Sim(world, M, 7, (n) => events.push(n));
  const p = sim.player.ped; [p.x, p.y] = layout.motelDoor; sim.stars = stars;
  sim.step(DT, { ...none, action: true });
  return { sim, sg: sim.siege, events };
}
const run = (sim, secs, inp = none, until = null) => { for (let i = 0; i < secs * 60; i++) { sim.step(DT, typeof inp === 'function' ? inp(i) : inp); if (until && until()) return true; } return false; };
const tap = (sim, k) => sim.step(DT, { ...none, [k]: true });
// walk the hero along its current surface to x (real joystick)
function walkTo(sim, x, tol = 0.15) {
  const h = sim.siege.hero;
  return run(sim, 8, () => ({ jx: Math.sign(x - h.x), jy: 0, jm: 1, keys: {} }), () => Math.abs(h.x - x) < tol);
}
function face(sim, dir) { const h = sim.siege.hero; sim.step(DT, { jx: dir, jy: 0, jm: 0.2, keys: {} }); h.face = dir; }
// take the link at the hero's feet in the given joystick direction (-1 up, +1 down) until it lands
function ride(sim, jy) { const h = sim.siege.hero; sim.step(DT, { jx: 0, jy, jm: 1, keys: {} }); return run(sim, 8, { jx: 0, jy, jm: 1, keys: {} }, () => !h.link); }
const quiet = (sg) => { sg.t = -1e6; };          // hold the waves (mechanic checks)

// a) entry
{
  const sim = new Sim(world, M, 7, () => {});
  sim.step(DT, { ...none, action: true });
  check(!sim.siege && sim.player.mode !== 'siege', 'action away from the motel door does not enter', sim.player.mode);
  const { sim: s2, sg } = fresh();
  check(s2.player.mode === 'siege' && sg && sg.hero.surf === 'F0', 'action at the motel door enters the siege', s2.player.mode);
  check(siegeAction(s2).label === 'PUSH', 'first prompt is PUSH (the reception desk beside you)');
}
// b) barricade: shove the desk, cops stop and bash through
{
  const { sim, sg } = fresh();
  run(sim, 0.4);                                   // the entry beat (input held for 0.35 s)
  tap(sim, 'action');
  run(sim, 0.5);
  const d = sg.barricades[0];
  check(d.placed && Math.abs(d.cur - d.to) < 0.01, 'PUSH slides the desk into the lobby doorway', d.cur.toFixed(2));
  run(sim, 6, none, () => sg.cops.some(c => c.blockedBy));
  const t0 = sg.t;
  check(sg.cops.some(c => c.blockedBy && c.x < d.cur), 'cops stop at the desk');
  run(sim, 10, none, () => d.broken);
  check(d.broken && sg.t - t0 > 2.5, 'they bash through it, not instantly', `${(sg.t - t0).toFixed(1)} s`);
}
// c) vending machine: tip it onto cops
{
  const { sim, sg } = fresh(); quiet(sg);
  const v = sg.traps.find(t => t.kind === 'vend');
  walkTo(sim, v.x + 0.8); face(sim, -1);
  const c1 = sg.cops[sg.cops.push({ ...sg.hero, kind: 'cop', surf: 'F0', x: v.x - 1.2, st: 'stun', stunT: 9, hp: 2 }) - 1];
  const s0 = sim.score || 0;
  tap(sim, 'punch'); run(sim, 0.5);
  check(v.state === 'down', 'punching the vending machine tips it', v.state);
  check(c1.st === 'down' && (sim.score || 0) - s0 >= 300, 'it crushes the officer under it (+300)', `${c1.st} +${(sim.score || 0) - s0}`);
}
// d) TV off the dresser
{
  const { sim, sg } = fresh(); quiet(sg);
  const h = sg.hero; h.surf = 'F1'; h.z = S.floors[1];
  const tv = sg.traps.find(t => t.kind === 'tv');
  walkTo(sim, tv.x - 0.7); face(sim, 1);
  const c1 = sg.cops[sg.cops.push({ ...h, kind: 'cop', surf: 'F1', x: tv.x + 2.6, st: 'stun', stunT: 9, hp: 2, link: null }) - 1];
  tap(sim, 'punch'); run(sim, 1.2);
  check(tv.state === 'broken' && c1.st === 'down', 'a punched TV flies, smashes, drops the cop it lands on', `${tv.state} ${c1.st} x ${tv.x.toFixed(1)}`);
}
// e) linen cart bowls a corridor
{
  const { sim, sg } = fresh(); quiet(sg);
  const h = sg.hero; h.surf = 'F1'; h.z = S.floors[1];
  const cart = sg.traps.find(t => t.kind === 'cart');
  walkTo(sim, cart.x + 0.7); face(sim, -1);
  for (const dx of [-1.5, -2.6, -3.4]) sg.cops.push({ ...h, kind: 'cop', surf: 'F1', x: cart.x + dx, st: 'stun', stunT: 9, hp: 2, link: null });
  tap(sim, 'punch'); run(sim, 1.5);
  check(cart.hits === 3 && cart.state === 'tipped', 'the cart bowls all three officers in its lane, then tips', `${cart.hits} ${cart.state}`);
}
// f) fuse box
{
  const { sim, sg } = fresh(); quiet(sg);
  const h = sg.hero; h.surf = 'F2'; h.z = S.floors[2];
  const fb = sg.traps.find(t => t.kind === 'fusebox');
  walkTo(sim, fb.x + 0.6);
  const c1 = sg.cops[sg.cops.push({ ...h, kind: 'cop', surf: 'F2', x: fb.x - 1.2, st: 'walk', hp: 2, link: null, speed: 0.01 }) - 1];
  face(sim, -1); tap(sim, 'punch'); run(sim, 0.1);
  check(c1.st === 'stun' && sg.lightsOut > 2, 'the fuse box shorts the lights and stuns the cop beside it', c1.st);
}
// g) window AC: three storeys onto the street
{
  const { sim, sg } = fresh(); quiet(sg);
  const h = sg.hero; h.surf = 'F2'; h.z = S.floors[2];
  const ac = sg.traps.find(t => t.kind === 'ac');
  walkTo(sim, ac.x - 0.4); face(sim, 1);
  const c1 = sg.cops[sg.cops.push({ ...h, kind: 'cop', surf: 'F0', x: ac.x + 0.9, z: 0, st: 'stun', stunT: 9, hp: 2, link: null }) - 1];
  const s0 = sim.score || 0;
  tap(sim, 'punch'); run(sim, 1.6);
  check(ac.state === 'dropped' && c1.st === 'down', 'the AC drops three storeys and flattens the cop below', `${ac.state} ${c1.st}`);
  check((sim.score || 0) - s0 >= 500 && sg.cruisers[1].dmg >= 2, 'BIG DROP +500 and it caves in the cruiser', `+${(sim.score || 0) - s0} car ${sg.cruisers[1].dmg}`);
}
// h) the hatch and the ladder
{
  const { sim, sg } = fresh(); quiet(sg);
  const h = sg.hero; h.surf = 'F2'; h.z = S.floors[2];
  walkTo(sim, S.ladder.x, 0.1);
  check(siegeAction(sim).label === 'PRY', 'under the shut hatch the button says PRY');
  ride(sim, -1);
  check(h.surf === 'F2' && !h.link, 'the ladder can not be climbed while the hatch is shut');
  tap(sim, 'punch'); run(sim, 0.4); tap(sim, 'punch'); run(sim, 0.2);
  check(sg.hatch.open, 'two punches pop the hatch');
  check(ride(sim, -1) && h.surf === 'R', 'then the ladder climbs to the roof', h.surf);
}
// i) cops follow you upstairs
{
  const { sim, sg } = fresh();
  const h = sg.hero; h.surf = 'F2'; h.z = S.floors[2]; h.x = 1.5;
  run(sim, 30, none, () => sg.cops.some(c => c.surf === 'F2'));
  check(sg.cops.some(c => c.surf === 'F2'), 'cops climb two flights of stairs to reach you', sg.cops.map(c => c.surf || 'link').join(','));
}
// j) the full escape: hatch -> roof -> drop to the fire escape -> down the flight -> LEAP -> board
{
  const { sim, sg } = fresh(2);
  const h = sg.hero; h.surf = 'F2'; h.z = S.floors[2]; quiet(sg);
  const stars0 = sim.stars, s0 = sim.score || 0;
  walkTo(sim, S.ladder.x, 0.1); tap(sim, 'punch'); run(sim, 0.4); tap(sim, 'punch'); run(sim, 0.2);
  ride(sim, -1);
  run(sim, 6, { jx: 1, jy: 0, jm: 1, keys: {} }, () => h.surf === 'E2');
  check(h.surf === 'E2', 'run off the east end of the roof onto the fire-escape balcony', String(h.surf));
  walkTo(sim, S.fireEscape.flight.x0, 0.2);
  ride(sim, 1);
  check(h.surf === 'F1', 'down the fire-escape flight to the lower balcony', String(h.surf));
  walkTo(sim, S.fireEscape.x1 - 0.3, 0.2);
  check(siegeAction(sim).label === 'LEAP', 'at the balcony rail the button says LEAP');
  tap(sim, 'action');
  run(sim, 3, none, () => sim.player.mode === 'board');
  const b = sim.board;
  check(sim.player.mode === 'board' && b.vx > 150 && Math.hypot(b.x - S.exit[0], b.y - S.exit[1]) < 40, 'you land on the board in the alley, rolling out', `${sim.player.mode} v${Math.round(b.vx)} @${Math.round(b.x)},${Math.round(b.y)}`);
  check((sim.score || 0) - s0 >= 1500 && sim.stars === stars0 - 1, 'MOTEL ESCAPED: +1500 and a star shed', `+${(sim.score || 0) - s0} stars ${stars0}->${sim.stars}`);
}
// k) stand still and you're arrested; then the normal respawn
{
  const { sim } = fresh();
  run(sim, 14, none, () => !!sim.busted);
  check(!!sim.busted, 'stand still in the lobby and the cops arrest you');
  run(sim, 5);
  check(sim.player.mode === 'foot' && !sim.siege && sim.stars === 0, 'BUSTED ends the siege into the normal respawn', `${sim.player.mode} ${sim.stars}`);
}
// l) the escalation schedule
{
  const { sim, sg } = fresh();
  const h = sg.hero; h.surf = 'R'; h.z = S.roof; h.x = 3.5; sg.hatch.open = false;   // up out of reach
  const seen = {};
  // (the arrest is held off so the schedule itself is what's checked)
  run(sim, 56, () => { h.arrest = 0; for (const k in sg.breaches) if (sg.breaches[k] && !seen[k]) seen[k] = sg.t.toFixed(0); return none; });
  check(seen.pool && seen.ladder && seen.roof, 'waves: pool doors, balcony ladder, SWAT on the roof', JSON.stringify(seen));
  check(sim.stars >= 4, 'the stars climb with the waves', String(sim.stars));
  check(sg.cops.some(c => c.kind === 'swat'), 'SWAT rappel in');
}
console.log(fails ? `SIEGE FAIL (${fails})` : 'SIEGE OK');
process.exit(fails ? 1 : 0);
