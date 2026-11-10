// Headless proof that the game works: the sim runs with no rendering and no DOM, four bots play a full
// 3-minute match, and BOTH teams must score before the clock runs out. Run: node --test games/big-bumpin-arena/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Game } from '../src/game.js';
import { CFG, HZ } from '../src/config.js';
import { createArenaWallConfigs } from '../src/physics.js';
import { buildArena, ARENA_ORDER, inField } from '../src/arenas.js';
const RINK = buildArena('rink'), W = { w: RINK.w, h: RINK.h };

const Matter = createRequire(import.meta.url)('../vendor/matter.min.js');
const play = (game, maxTicks) => { const log = []; for (let i = 0; i < maxTicks && game.state !== 'over'; i++) { game.tick(); for (const e of game.events) if (e.type !== 'hit') log.push({ ...e, at: game.ticks }); } return log; };

test('four bots play a full match and each team scores before the clock ends', () => {
  const game = new Game(Matter, { seed: 1 }), regulation = CFG.match.seconds * HZ;
  const log = play(game, regulation * 3), goals = log.filter((e) => e.type === 'goal');
  const inRegulation = [0, 1].map((t) => goals.filter((g) => g.team === t && !log.some((e) => e.type === 'overtime' && e.at < g.at)).length);
  console.log(`  final ${game.score[0]}-${game.score[1]} after ${(game.ticks / HZ).toFixed(0)} s; goals in regulation: red ${inRegulation[0]}, blue ${inRegulation[1]}`);
  for (const g of goals) console.log(`   ${(g.at / HZ).toFixed(1)} s  ${g.name}${g.ownGoal ? ' (own goal)' : ''} -> ${['RED', 'BLUE'][g.team]}`);
  assert.equal(game.state, 'over', 'the match ended');
  assert.ok(inRegulation[0] >= 1, 'red scored in regulation');
  assert.ok(inRegulation[1] >= 1, 'blue scored in regulation');
  assert.ok(goals.every((g) => g.scorer !== null), 'every goal names a scorer');
});

test('deterministic: same seed and inputs give the same match; a different seed does not', () => {
  const run = (seed) => { const g = new Game(Matter, { seed, seconds: 40 }); for (let i = 0; i < 40 * HZ; i++) g.tick(); return g.digest(); };
  assert.equal(run(5), run(5));
  assert.notEqual(run(5), run(6));
});

test('match loop: kickoff countdown, goal freezes play then faces off, tie goes to golden-goal overtime', () => {
  const g = new Game(Matter, { seed: 2, seconds: 2 });
  assert.equal(g.state, 'kickoff');
  for (let i = 0; i < CFG.match.kickoffTicks; i++) g.tick({ 0: { throttle: 1 } });
  assert.equal(g.state, 'play');
  const still = { throttle: 0, steer: 0 }, idle = { 0: still, 1: still, 2: still, 3: still };
  for (let i = 0; i < 2 * HZ + 5; i++) g.tick(idle);
  assert.equal(g.overtime, true, 'tied at 0:00 -> overtime'); assert.equal(g.state, 'play');
  // put the ball in the right-hand net with a red touch on record: red scores, golden goal ends the match
  g.lastTouch[0] = { car: 0, tick: g.ticks };
  Matter.Body.setPosition(g.ball.body, { x: RINK.R + 50, y: W.h / 2 });
  g.tick(idle);
  assert.equal(g.state, 'goal'); assert.deepEqual(g.score, [1, 0]); assert.equal(g.lastGoal.name, 'RED 1'); assert.equal(g.lastGoal.ownGoal, false);
  for (let i = 0; i < CFG.match.celebrateTicks; i++) g.tick(idle);
  assert.equal(g.state, 'over'); assert.equal(g.winner, 0);
});

test('own goals are named: a stale or missing touch credits the other team\'s last toucher', () => {
  const g = new Game(Matter, { seed: 3 });
  for (let i = 0; i < CFG.match.kickoffTicks; i++) g.tick();
  g.lastTouch = [null, { car: 2, tick: g.ticks }];           // only blue has touched it...
  Matter.Body.setPosition(g.ball.body, { x: RINK.R + 50, y: W.h / 2 }); // ...and it ends up in blue's own net
  g.tick({ 0: {}, 1: {}, 2: {}, 3: {} });
  assert.deepEqual(g.score, [1, 0]); assert.equal(g.lastGoal.ownGoal, true); assert.equal(g.lastGoal.name, 'BLUE 1');
  for (let i = 0; i < CFG.match.celebrateTicks + 1; i++) g.tick();
  assert.equal(g.state, 'faceoff'); assert.ok(Math.abs(g.ball.body.position.x - W.w / 2) < 1, 'ball back on the centre spot');
});

test('weight classes: the tractor out-shoves the kart, the kart out-accelerates the tractor; cars never enter a net', () => {
  const g = new Game(Matter, { seed: 4 });
  for (let i = 0; i < CFG.match.kickoffTicks; i++) g.tick();
  const [kart, tractor] = g.cars; assert.equal(kart.clsName, 'light'); assert.equal(tractor.clsName, 'heavy');
  const x0 = [kart.body.position.x, tractor.body.position.x], go = { throttle: 1, steer: 0 }, stop = { throttle: 0 };
  for (let i = 0; i < 20; i++) g.tick({ 0: go, 1: go, 2: stop, 3: stop });
  assert.ok(kart.body.position.x - x0[0] > (tractor.body.position.x - x0[1]) * 1.5, 'kart is quicker off the line');
  // head-on: both at the same speed, the kart is the one thrown back
  const B = Matter.Body, y = 200;
  B.setPosition(kart.body, { x: 500, y }); B.setAngle(kart.body, 0); B.setVelocity(kart.body, { x: 5, y: 0 });
  B.setPosition(tractor.body, { x: 640, y }); B.setAngle(tractor.body, Math.PI); B.setVelocity(tractor.body, { x: -5, y: 0 });
  let hit = false; for (let i = 0; i < 30 && !hit; i++) { g.tick({ 0: stop, 1: stop, 2: stop, 3: stop }); hit = g.events.some((e) => e.kind === 'car-car'); }
  assert.ok(hit, 'they collided');
  for (let i = 0; i < 3; i++) g.tick({ 0: stop, 1: stop, 2: stop, 3: stop });
  assert.ok(B.getVelocity(kart.body).x < -1, 'kart bounced back'); assert.ok(B.getVelocity(tractor.body).x < 0, 'tractor kept coming');
  // drive the kart straight at the left goal mouth: the lip stops it at the goal line
  B.setPosition(kart.body, { x: RINK.L + 120, y: W.h / 2 }); B.setAngle(kart.body, Math.PI); B.setVelocity(kart.body, { x: -6, y: 0 });
  for (let i = 0; i < 90; i++) g.tick({ 0: { throttle: 1, turbo: true }, 1: stop, 2: stop, 3: stop });
  assert.ok(kart.body.position.x > RINK.L, 'car stays out of the net');
});

test('turbo drains while held, regenerates, and regenerates faster in a teammate\'s slipstream', () => {
  const g = new Game(Matter, { seed: 5 }), B = Matter.Body, [kart, tractor] = g.cars, stop = { throttle: 0 };
  for (let i = 0; i < CFG.match.kickoffTicks; i++) g.tick();
  for (let i = 0; i < 60; i++) g.tick({ 0: { throttle: 1, turbo: true }, 1: stop, 2: stop, 3: stop });
  assert.ok(kart.turbo < 0.6, 'meter drained'); assert.ok(B.getVelocity(kart.body).x > CFG.classes.light.maxSpeed * 1.2, 'faster than normal top speed');
  const regen = (draft) => {
    kart.turbo = 0.2;
    for (let i = 0; i < 60; i++) {
      B.setPosition(tractor.body, { x: 500, y: 300 }); B.setAngle(tractor.body, 0); B.setVelocity(tractor.body, { x: 4, y: 0 });
      B.setPosition(kart.body, { x: 500 - 110, y: draft ? 300 : 600 }); B.setAngle(kart.body, 0); B.setVelocity(kart.body, { x: 4, y: 0 });
      g.tick({ 0: { throttle: 0.5 }, 1: { throttle: 0.5 }, 2: stop, 3: stop });
    }
    return kart.turbo - 0.2;
  };
  const alone = regen(false), tucked = regen(true);
  assert.ok(alone > 0); assert.ok(tucked > alone * 2.5, `slipstream refill ${tucked.toFixed(3)} vs ${alone.toFixed(3)}`);
});

test('arenas: six different places, every one sealed, fair and furnished inside its own walls', () => {
  assert.deepEqual(ARENA_ORDER, ['rink', 'lot', 'pond', 'derby', 'pinch', 'midway']);
  const shapes = new Set();
  for (const id of ARENA_ORDER) {
    const A = buildArena(id), walls = createArenaWallConfigs(CFG, A), names = walls.map((w) => w.name);
    for (const n of ['leftLip', 'rightLip', 'leftPostTop', 'rightPostBottom']) assert.ok(names.includes(n), `${id} ${n}`);
    assert.equal(new Set(names).size, names.length, `${id}: names are unique`); shapes.add(`${A.w}x${A.h}x${A.poly.length}`);
    for (const p of [...A.obstacles, ...A.pits, ...A.items.map(([x, y]) => ({ x, y })), ...A.pylons.map(([x, y]) => ({ x, y }))]) assert.ok(inField(A, p.x, p.y), `${id}: something is outside the floor`);
    for (const p of A.field) { const q = A.field.find(([x, y]) => Math.abs(x - (A.w - p[0])) < 1e-6 && Math.abs(y - (A.h - p[1])) < 1e-6); assert.ok(q, `${id}: outline is not half-turn symmetric`); }
    // fire the ball in 48 directions at top speed; it must still be inside the building 5 s later
    for (let k = 0; k < 48; k++) {
      const g = new Game(Matter, { seed: 9, arena: id }), a = (k / 48) * Math.PI * 2;
      for (const c of g.cars) Matter.Body.setPosition(c.body, { x: -900 - c.index * 300, y: -900 });
      Matter.Body.setPosition(g.ball.body, { x: A.cx + 60, y: A.cy + 150 }); Matter.Body.setVelocity(g.ball.body, { x: Math.cos(a) * CFG.ball.maxSpeed, y: Math.sin(a) * CFG.ball.maxSpeed });
      for (let i = 0; i < 300; i++) g.world.step([null, null, null, null]);
      const p = g.ball.body.position;
      assert.ok(p.x > A.L - A.netDepth - 2 && p.x < A.R + A.netDepth + 2 && p.y > A.bounds.top - 2 && p.y < A.bounds.bottom + 2, `${id}: ball escaped at angle ${k}: ${p.x.toFixed(0)},${p.y.toFixed(0)}`);
    }
  }
  assert.equal(shapes.size, 6, 'no two arenas share a size and outline'); assert.ok(buildArena('lot').w > RINK.w * 1.5, 'the new ones are much bigger than the rink');
});

for (const id of ARENA_ORDER) {
  test(`bot match in ${buildArena(id).name}: both teams score in regulation`, () => {
    const g = new Game(Matter, { seed: 1, arena: id, hazards: { pads: true, pylons: true, tilt: true } }), goals = [];
    for (let n = 0; g.state !== 'over' && n < HZ * 900; n++) { const ot = g.overtime; g.tick(); for (const e of g.events) if (e.type === 'goal') goals.push({ team: e.team, ot }); }
    const reg = [0, 1].map((tm) => goals.filter((x) => x.team === tm && !x.ot).length);
    console.log(`  ${id}: ${g.score.join('-')} on ${g.surface}`);
    assert.equal(g.state, 'over'); assert.ok(reg[0] >= 1 && reg[1] >= 1, `red ${reg[0]}, blue ${reg[1]}`);
  });
}
