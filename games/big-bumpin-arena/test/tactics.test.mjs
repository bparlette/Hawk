// Prompt 2 rules, each proven on the real sim with no rendering: shunt, T-bone spin-out, ball heat, english,
// every power-up, one-timers, surfaces, hazards, stats. Plus the bot match on all three surfaces.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Game } from '../src/game.js';
import { CFG, HZ } from '../src/config.js';
import { buildArena } from '../src/arenas.js';

const Matter = createRequire(import.meta.url)('../vendor/matter.min.js'), B = Matter.Body;
const idle = () => ({ 0: {}, 1: {}, 2: {}, 3: {} });
const put = (body, x, y, angle = 0, vx = 0, vy = 0) => { B.setPosition(body, { x, y }); if (body.label === 'car') B.setAngle(body, angle); B.setVelocity(body, { x: vx, y: vy }); B.setAngularVelocity(body, 0); };
const speed = (body) => Math.hypot(B.getVelocity(body).x, B.getVelocity(body).y);
/** A match in the 'play' state with all four cars parked out of the way and no bots driving. */
function arena(opts = {}) {
  const g = new Game(Matter, { seed: 1, arena: 'rink', surface: 'asphalt', ...opts });
  for (let i = 0; i < CFG.match.kickoffTicks; i++) g.tick(idle());
  [[250, 130], [250, 780], [1030, 130], [1030, 780]].forEach(([x, y], i) => put(g.cars[i].body, x, y, 0));
  return g;
}
const run = (g, n, inputs = idle) => { const ev = []; for (let i = 0; i < n; i++) { g.tick(typeof inputs === 'function' ? inputs(i) : inputs); ev.push(...g.events.filter((e) => e.type !== 'hit')); } return ev; };

test('lateral shunt: an instant sideways barge of about a car width, then a cooldown', () => {
  const g = arena(), car = g.cars[0]; put(car.body, 640, 250, 0);
  run(g, 1, { ...idle(), 0: { shunt: 1 } }); run(g, 20);
  const dy = car.body.position.y - 250;
  assert.ok(dy > 30 && dy < 80, `moved ${dy.toFixed(0)} px to its right`); assert.ok(Math.abs(car.body.position.x - 640) < 12, 'nose did not turn');
  const y1 = car.body.position.y; run(g, 1, { ...idle(), 0: { shunt: 1 } }); run(g, 10);
  assert.ok(Math.abs(car.body.position.y - y1) < 6, 'cooldown blocks an immediate second shunt'); assert.equal(g.stats.shunts[0], 1);
});

test('T-bone: a shunt into an opponent\'s flank spins them out for 0.75 s; teammates and repeat hits are safe', () => {
  const g = arena(), [red, mate, blue] = g.cars;
  put(red.body, 600, 440, 0); put(blue.body, 600, 440 + 62, 0); put(mate.body, 600, 440 - 78, 0);
  const ev = run(g, 12, (i) => ({ ...idle(), 0: { shunt: i === 0 ? 1 : 0 } }));
  assert.ok(ev.some((e) => e.type === 'spin' && e.car === 2 && e.by === 0), 'blue spun out'); assert.equal(g.stats.spinOuts[0], 1);
  assert.ok(blue.spinT > 0 && blue.spinT <= CFG.spin.ticks); const a0 = blue.body.angle;
  run(g, 20, { ...idle(), 2: { throttle: 1, steer: 1 } });
  assert.ok(Math.abs(blue.body.angle - a0) > 1.5, 'it is spinning'); assert.ok(speed(blue.body) < 3, 'throttle is locked out');
  run(g, CFG.spin.ticks); assert.equal(blue.spinT, 0, 'over after 0.75 s');
  put(red.body, 600, 440, 0); put(blue.body, 600, 502, 0); run(g, CFG.shunt.cooldown);
  put(red.body, 600, 440, 0); put(blue.body, 600, 502, 0);
  assert.ok(!run(g, 12, (i) => ({ ...idle(), 0: { shunt: i === 0 ? 1 : 0 } })).some((e) => e.type === 'spin'), 'brief immunity after a spin-out');
  put(red.body, 600, 300, 0); put(mate.body, 600, 300 - 62, 0); run(g, CFG.shunt.cooldown); put(red.body, 600, 300, 0); put(mate.body, 600, 238, 0);
  run(g, 12, (i) => ({ ...idle(), 0: { shunt: i === 0 ? -1 : 0 } })); assert.equal(mate.spinT, 0, 'no friendly spin-outs');
});

test('kinetic heat: consecutive strikes speed the ball up; at full heat a front-on block is flattened; heat fades', () => {
  const g = arena({ surface: 'ice' }), car = g.cars[0], ball = g.ball, blocker = g.cars[2];
  const heats = [], speeds = [];
  put(ball.body, 300, 454, 0, 5, 0);
  for (let k = 0; k < 6; k++) { // keep hitting it from behind before it stops
    put(ball.body, 300, 454, 0, 5, 0); put(car.body, 220, 454, 0, 9, 0);
    const ev = run(g, 12); assert.ok(ev.some((e) => e.type === 'strike'), `strike ${k}`); heats.push(+ball.heat.toFixed(2)); speeds.push(speed(ball.body));
  }
  assert.deepEqual(heats, [0.2, 0.4, 0.6, 0.8, 1, 1]);
  { const cold = arena({ surface: 'ice' }); put(cold.ball.body, 300, 454, 0, 0.5, 0); put(cold.cars[0].body, 220, 454, 0, 9, 0); run(cold, 12); assert.equal(cold.ball.heat, 0, 'a ball that had stopped starts cold'); }
  put(ball.body, 300, 300, 0, 40, 0); run(g, 1); assert.ok(speed(ball.body) > CFG.ball.maxSpeed * 1.3, 'a hot ball is allowed to travel faster'); ball.heat = 1;
  put(car.body, 250, 130, 0); put(blocker.body, 700, 454, Math.PI); put(ball.body, 520, 454, 0, 15, 0);
  const ev = run(g, 20); assert.ok(ev.some((e) => e.type === 'flatten' && e.car === 2), 'blocker flattened');
  assert.ok(blocker.flatT > 0); assert.ok(B.getVelocity(blocker.body).x > 2, 'and knocked back'); assert.ok(ball.heat < 1);
  ball.heat = 0.6; put(ball.body, 300, 300, 0, 4, 0); ball.lastHit = g.world.ticks; run(g, CFG.heat.freeTicks + 40);
  assert.ok(ball.heat < 0.6 && ball.heat > 0, 'fades while rolling free'); put(ball.body, 640, 454, 0, 0, 0); run(g, 40); assert.equal(ball.heat, 0, 'gone when it stops');
});

test('english: dragging the bumper across the ball bends the shot, either way', () => {
  const bend = (vy) => { const g = arena({ surface: 'ice' }), car = g.cars[0], ball = g.ball; put(ball.body, 500, 454); put(car.body, 500 - 76, 454, 0, 8, vy); run(g, 8); const c = ball.curve, a0 = Math.atan2(B.getVelocity(ball.body).y, B.getVelocity(ball.body).x); run(g, 25); return { c, turned: Math.atan2(B.getVelocity(ball.body).y, B.getVelocity(ball.body).x) - a0 }; };
  const right = bend(4), left = bend(-4), straight = bend(0);
  assert.ok(right.c > 0.008 && right.turned > 0.15, `curves one way (${right.turned.toFixed(2)} rad)`); assert.ok(left.c < -0.008 && left.turned < -0.15, 'and the other');
  assert.equal(straight.c, 0); assert.ok(Math.abs(straight.turned) < 0.02, 'a square hit flies straight');
});

test('power-ups: boxes appear in pairs every 20 s, and every item does its job', () => {
  const g = arena(), [red, mate, blue] = g.cars, ball = g.ball, I = CFG.items;
  assert.equal(g.world.boxes.filter((b) => b.active).length, 0);
  run(g, I.first + 1); assert.deepEqual(g.world.boxes.map((b) => b.active), [true, true, false, false]);
  put(red.body, g.arena.items[0][0], g.arena.items[0][1]); const ev = run(g, 2); assert.ok(ev.some((e) => e.type === 'pickup' && e.car === 0)); assert.ok(I.pool.includes(red.item)); assert.equal(g.world.boxes[0].active, false);
  run(g, I.period); assert.deepEqual(g.world.boxes.map((b) => b.active), [false, false, true, true], 'next pair, other spots'); g.world.boxes.forEach((b) => { b.active = false; });
  // magnet grille: ball rides the bumper through a turn for 1.5 s, steering is duller, and a shunt knocks it loose
  put(red.body, 500, 454, 0); put(ball.body, 500 + 34 + 34, 454); red.item = 'magnet';
  run(g, 60, (i) => ({ ...idle(), 0: { use: i === 0, throttle: 1, steer: 1 } }));
  assert.equal(ball.magnetBy, red); assert.ok(red.body.angle > 0.8, 'turned with it');
  const nose = { x: red.body.position.x + Math.cos(red.body.angle) * 75, y: red.body.position.y + Math.sin(red.body.angle) * 75 };
  assert.ok(Math.hypot(ball.body.position.x - nose.x, ball.body.position.y - nose.y) < 40, 'ball is on the bumper');
  run(g, 40, { ...idle(), 0: { throttle: 1 } }); assert.equal(ball.magnetBy, null, 'released after 1.5 s'); assert.equal(red.magnetT, 0);
  put(red.body, 500, 300, 0); put(ball.body, 568, 300); red.item = 'magnet'; run(g, 5, (i) => ({ ...idle(), 0: { use: i === 0 } })); assert.equal(ball.magnetBy, red);
  put(blue.body, 500, 300 + 62, 0); run(g, 10, (i) => ({ ...idle(), 2: { shunt: i === 0 ? -1 : 0 } })); assert.equal(red.magnetT, 0, 'a shunt dislodges it');
  // shockwave: half-second wind-up, then everything nearby is thrown outward
  run(g, 200); put(red.body, 640, 454, 0); put(blue.body, 640 + 150, 454, 0); put(ball.body, 640, 454 - 150); red.item = 'shock';
  let e2 = run(g, I.shock.windup - 2, (i) => ({ ...idle(), 0: { use: i === 0 } })); assert.ok(!e2.some((e) => e.type === 'shock'), 'winds up first');
  e2 = run(g, 4); assert.ok(e2.some((e) => e.type === 'shock')); assert.ok(B.getVelocity(blue.body).x > 3, 'car pushed away'); assert.ok(B.getVelocity(ball.body).y < -5, 'ball pushed away');
  // cowcatcher: triple mass for 4 s
  put(red.body, 300, 300, 0); red.item = 'cow'; run(g, 2, (i) => ({ ...idle(), 0: { use: i === 0 } }));
  assert.ok(Math.abs(red.body.mass - red.baseMass * 3) < 1e-6); run(g, I.cow.ticks + 1); assert.ok(Math.abs(red.body.mass - red.baseMass) < 1e-6, 'back to normal');
  // oil slick: dropped behind; whoever drives over it spins, teammates included
  put(red.body, 600, 600, 0); red.item = 'oil'; run(g, 2, (i) => ({ ...idle(), 0: { use: i === 0 } })); assert.equal(g.world.slicks.length, 1);
  const s = g.world.slicks[0]; assert.ok(s.x < 600 - 40, 'behind the car'); put(mate.body, s.x - 120, s.y, 0, 5, 0);
  const e3 = run(g, 40, { ...idle(), 1: { throttle: 1 } }); assert.ok(e3.some((e) => e.type === 'spin' && e.car === 1), 'teammate spun on it');
  run(g, I.oil.ticks); assert.equal(g.world.slicks.length, 0, 'slick dries up');
});

test('one-timer: a strike within 1.5 s of a teammate\'s pass is 30% faster and dead straight', () => {
  const shot = (gap) => { const g = arena({ surface: 'ice' }), [kart, tractor] = g.cars, ball = g.ball;
    put(ball.body, 400, 454); put(tractor.body, 400 - 90, 454, 0, 4, 0); run(g, 10); assert.equal(ball.lastStrike.car, 1);
    put(tractor.body, 250, 780, 0); run(g, gap); const p = ball.body.position; put(ball.body, p.x, p.y, 0, 3, 0); put(kart.body, p.x - 80, p.y, 0, 8, 2);
    const ev = run(g, 8); return { ev, v: speed(ball.body), laser: ball.laser, curve: ball.curve }; };
  const quick = shot(30), late = shot(CFG.oneTimer.window + 20);
  assert.ok(quick.ev.some((e) => e.type === 'onetimer' && e.car === 0 && e.from === 1)); assert.ok(quick.laser > 0); assert.equal(quick.curve, 0);
  assert.ok(!late.ev.some((e) => e.type === 'onetimer')); assert.ok(quick.v > late.v * 1.15, `${quick.v.toFixed(1)} vs ${late.v.toFixed(1)}`);
});

test('surfaces: the ball slides on ice and dies on dirt; cars slide sideways on ice', () => {
  const roll = (surface) => { const g = arena({ surface }); put(g.ball.body, 300, 454, 0, 9, 0); run(g, 90); return g.ball.body.position.x - 300; };
  const ice = roll('ice'), asphalt = roll('asphalt'), dirt = roll('dirt');
  assert.ok(ice > asphalt * 1.25 && asphalt > dirt * 1.6, `ice ${ice.toFixed(0)} > asphalt ${asphalt.toFixed(0)} > dirt ${dirt.toFixed(0)}`);
  const slide = (surface) => { const g = arena({ surface }); put(g.cars[0].body, 640, 300, 0, 0, 6); run(g, 20, { ...idle(), 0: { throttle: 0.2 } }); return g.cars[0].body.position.y - 300; };
  assert.ok(slide('ice') > slide('asphalt') * 2, 'sideways momentum survives on ice');
});

test('hazards: conveyor pads, pop-up pylons that wait for a clear hatch, and a final-minute tilt; all off by default', () => {
  const H = CFG.hazards, RK = buildArena('rink'), pad = RK.pads[0], px = (pad.x0 + pad.x1) / 2, py = (pad.y0 + pad.y1) / 2;
  let g = arena(); put(g.ball.body, px, py); run(g, 30); assert.ok(Math.abs(g.ball.body.position.x - px) < 1, 'no pads unless switched on');
  g = arena({ hazards: { pads: true } }); put(g.ball.body, px, py); put(g.cars[0].body, px - 40, py + 4, 0); run(g, 30);
  assert.ok(g.ball.body.position.x > px + 40, 'ball carried along'); assert.ok(g.cars[0].body.position.x > px, 'car boosted along');
  g = arena({ hazards: { pylons: true } }); const [sx, sy] = RK.pylons[0]; put(g.cars[0].body, sx, sy, 0);
  let ev = run(g, H.pylons.down + 2);
  assert.equal(ev.filter((e) => e.type === 'pylon' && e.up).length, 3, 'three rise'); assert.equal(g.world.pylons[0].up, false, 'the blocked one waits');
  put(g.cars[0].body, 250, 130, 0); run(g, 3); assert.equal(g.world.pylons[0].up, true, 'then rises once clear');
  put(g.ball.body, sx - 120, sy, 0, 10, 0); ev = []; for (let i = 0; i < 20; i++) { g.tick(idle()); ev.push(...g.events); }
  assert.ok(ev.some((e) => e.type === 'hit' && e.pylon), 'ball bounces off a raised pylon'); assert.ok(B.getVelocity(g.ball.body).x < 0);
  run(g, H.pylons.up); assert.ok(g.world.pylons.every((p) => !p.up), 'they retract');
  g = arena({ hazards: { tilt: true }, seconds: 120 }); put(g.ball.body, 900, 300); run(g, 40); assert.ok(Math.abs(g.ball.body.position.x - 900) < 1, 'flat until the final minute');
  g.clock = 59 * HZ; run(g, 60); assert.ok(g.ball.body.position.x > 910, 'then the floor draws the ball toward the nearer goal');
});

test('season ladder data: teams can field any weight-class mix, and weaker bots are weaker', () => {
  const g = new Game(Matter, { seed: 1, arena: 'rink', teams: [['light', 'heavy'], ['heavy', 'heavy']] });
  assert.deepEqual(g.cars.map((c) => c.clsName), ['light', 'heavy', 'heavy', 'heavy']);
  let strong = 0, weak = 0;
  for (let s = 1; s <= 6; s++) { const m = new Game(Matter, { seed: s, skill: [1, 0.1] }); let n = 0; while (m.state !== 'over' && n++ < HZ * 600) m.tick(); strong += m.score[0]; weak += m.score[1]; }
  assert.ok(strong > weak * 1.3, `skill 1.0 scored ${strong}, skill 0.1 scored ${weak} over six matches`);
});

test('landscape: fishing holes swallow cars, the boom bats things away, the harpoon drags and snaps on a post', () => {
  let g = arena({ arena: 'pond' }); const pit = g.arena.pits[0], car = g.cars[0];
  put(car.body, pit.x - 150, pit.y, 0, 6, 0); let ev = run(g, 40, { ...idle(), 0: { throttle: 1 } });
  assert.ok(ev.some((e) => e.type === 'pit' && e.car === 0), 'fell in'); assert.ok(car.pitT > 0); assert.ok(Math.hypot(car.body.position.x - car.spawn.x, car.body.position.y - car.spawn.y) < 2, 'fished out onto its face-off spot');
  const x0 = car.body.position.x; run(g, 30, { ...idle(), 0: { throttle: 1 } }); assert.ok(Math.abs(car.body.position.x - x0) < 1, 'held there briefly'); run(g, 80, { ...idle(), 0: { throttle: 1 } }); assert.ok(car.body.position.x > x0 + 30, 'then drives on');
  put(g.ball.body, pit.x, pit.y); run(g, 5); assert.ok(Math.hypot(g.ball.body.position.x - pit.x, g.ball.body.position.y - pit.y) < 2, 'the ball is too big to fall in');
  g = arena({ arena: 'derby' }); const s = g.world.sweepers[0]; assert.ok(s);
  put(g.ball.body, s.x + Math.cos(s.a + 0.5) * 150, s.y + Math.sin(s.a + 0.5) * 150); run(g, 60);
  assert.ok(speed(g.ball.body) > 1.5, 'the boom swept the ball'); assert.ok(Math.abs(s.a) > 1, 'and keeps turning');
  g = arena({ arena: 'lot' }); const me = g.cars[0], pole = g.arena.obstacles.find((o) => o.kind === 'pole');
  put(me.body, pole.x - 400, pole.y + 200, 0); put(g.ball.body, pole.x - 60, pole.y + 200); me.item = 'harpoon';
  ev = run(g, 2, (i) => ({ ...idle(), 0: { use: i === 0 } })); assert.equal(g.world.tethers.length, 1, 'hooked the ball'); assert.equal(me.item, null);
  const d0 = Math.hypot(g.ball.body.position.x - me.body.position.x, g.ball.body.position.y - me.body.position.y); run(g, 50);
  assert.ok(Math.hypot(g.ball.body.position.x - me.body.position.x, g.ball.body.position.y - me.body.position.y) < d0 - 60, 'reeled it in');
  put(me.body, pole.x - 250, pole.y, 0); put(g.ball.body, pole.x + 200, pole.y); ev = run(g, 3); assert.ok(ev.some((e) => e.type === 'snap' && e.cut), 'line snapped on the telephone pole'); assert.equal(g.world.tethers.length, 0);
  put(me.body, pole.x - 250, pole.y, 0); put(g.ball.body, pole.x + 200, pole.y); me.item = 'harpoon'; ev = run(g, 2, (i) => ({ ...idle(), 0: { use: i === 0 } }));
  assert.ok(ev.some((e) => e.type === 'miss')); assert.equal(me.item, 'harpoon', 'no clear shot: you keep it');
});

for (const surface of ['asphalt', 'ice', 'dirt']) {
  test(`bot match on ${surface} with every hazard on: both teams score in regulation, stats are kept`, () => {
    const g = new Game(Matter, { seed: 1, arena: 'rink', surface, hazards: { pads: true, pylons: true, tilt: true } }), seen = {}, goals = [];
    for (let n = 0; g.state !== 'over' && n < HZ * 900; n++) { const ot = g.overtime; g.tick(); for (const e of g.events) { seen[e.type] = (seen[e.type] || 0) + 1; if (e.type === 'goal') goals.push({ team: e.team, ot }); } }
    const reg = [0, 1].map((t) => goals.filter((x) => x.team === t && !x.ot).length);
    console.log(`  ${surface}: ${g.score.join('-')}  shots ${g.stats.shots.join('/')}  shunts ${g.stats.shunts.join('/')}  spin-outs ${g.stats.spinOuts.join('/')}  top speed ${g.stats.topSpeed.map((v) => v.toFixed(1)).join('/')}  one-timers ${seen.onetimer || 0}  items ${seen.item || 0}`);
    assert.equal(g.state, 'over'); assert.ok(reg[0] >= 1 && reg[1] >= 1, `red ${reg[0]}, blue ${reg[1]}`);
    assert.ok(g.stats.shots[0] + g.stats.shots[1] > 0 && g.stats.shunts[0] + g.stats.shunts[1] > 0); assert.ok(Math.max(...g.stats.topSpeed) <= CFG.car.hardCap + 1e-6);
  });
}
