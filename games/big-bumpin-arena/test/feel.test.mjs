// Feel: hitstop window, trauma shake, goal tension, music mood. Pure helpers; the sim is untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Game } from '../src/game.js';
import { HZ } from '../src/config.js';
import { hitstopMs, hitstopFor, traumaFor, Trauma, goalTension, moodFor } from '../src/feel.js';

const Matter = createRequire(import.meta.url)('../vendor/matter.min.js'), B = Matter.Body;

test('hitstop: 40-80 ms on hard hits and goals, none on taps or ball-wall bounces', () => {
  assert.equal(hitstopMs({ type: 'hit', kind: 'car-car', force: 2 }), 0, 'a tap does not stop the game');
  assert.equal(hitstopMs({ type: 'hit', kind: 'ball-wall', force: 14 }), 0, 'wall bounces never stop the game');
  assert.equal(hitstopMs({ type: 'hit', kind: 'ball-car', force: 5 }), 40, 'the lightest hard hit is the 40 ms floor');
  assert.equal(hitstopMs({ type: 'hit', kind: 'car-car', force: 20 }), 80, 'the hardest is the 80 ms ceiling');
  const mid = hitstopMs({ type: 'hit', kind: 'car-wall', force: 8.5 }); assert.ok(mid > 40 && mid < 80, `mid hit ${mid}`);
  assert.equal(hitstopMs({ type: 'goal' }), 80);
  assert.equal(hitstopFor([{ type: 'hit', kind: 'car-car', force: 6 }, { type: 'goal' }, { type: 'count' }]), 80, 'the longest request wins');
  for (let f = 0; f < 30; f += 0.5) { const ms = hitstopMs({ type: 'hit', kind: 'ball-car', force: f }); assert.ok(ms === 0 || (ms >= 40 && ms <= 80), `force ${f} -> ${ms}`); }
});

test('trauma shake: scales with impact, decays smoothly to rest, offset is bounded', () => {
  assert.ok(traumaFor({ type: 'hit', kind: 'car-car', force: 14 }) > traumaFor({ type: 'hit', kind: 'car-car', force: 4 }) * 2, 'harder hit, more trauma');
  assert.equal(traumaFor({ type: 'hit', kind: 'ball-wall', force: 14 }), 0);
  const t = new Trauma(); t.add(0.9); let prev = t.amount, peak = 0;
  for (let i = 0; i < 120; i++) { t.update(1 / 60); assert.ok(t.amount <= prev + 1e-12, 'never rises on its own'); prev = t.amount; const o = t.offset(22); peak = Math.max(peak, Math.abs(o.x), Math.abs(o.y)); assert.ok(Math.abs(o.x) <= 22 && Math.abs(o.y) <= 22); }
  assert.equal(t.amount, 0, 'fully at rest after two seconds'); assert.deepEqual(t.offset(22), { x: 0, y: 0, rot: 0 }, 'no shake at rest');
  assert.ok(peak > 1, 'it did shake');
  const small = new Trauma(), big = new Trauma(); small.add(0.2); big.add(0.9); assert.ok(big.amount > small.amount * 10, 'trauma^2: a big hit is far bigger than a small one');
});

test('goal tension rises as the ball threatens a goal and is zero out of play', () => {
  const g = new Game(Matter, { seed: 1, arena: 'rink' }); while (g.state !== 'play') g.tick();
  const mid = g.arena, goal = g.arena.goals[1];
  B.setPosition(g.ball.body, { x: mid.cx, y: mid.cy }); B.setVelocity(g.ball.body, { x: 0, y: 0 }); const calm = goalTension(g);
  B.setPosition(g.ball.body, { x: goal.x - 120, y: goal.y }); B.setVelocity(g.ball.body, { x: 9, y: 0 }); const hot = goalTension(g);
  assert.ok(calm < 0.15 && hot > 0.7 && hot > calm * 4, `calm ${calm.toFixed(2)} hot ${hot.toFixed(2)}`);
  B.setVelocity(g.ball.body, { x: -9, y: 0 }); assert.ok(goalTension(g) < hot, 'rolling away is less tense than rolling in');
  g.state = 'goal'; assert.equal(goalTension(g), 0);
});

test('music mood follows the match state: calm, play, goal', () => {
  const g = new Game(Matter, { seed: 1, arena: 'rink' });
  assert.equal(moodFor(g, false), 'calm'); assert.equal(moodFor(g, true), 'calm', 'countdown is calm');
  while (g.state !== 'play') g.tick(); assert.equal(moodFor(g, true), 'play');
  g.state = 'goal'; assert.equal(moodFor(g, true), 'goal'); g.state = 'over'; assert.equal(moodFor(g, true), 'goal');
  const before = g.digest(); moodFor(g, true); goalTension(g); assert.equal(g.digest(), before, 'feel helpers never touch the sim');
});

test('feel never alters the sim: a match with the feel helpers sampled every tick is identical to one without', () => {
  const run = (sample) => { const g = new Game(Matter, { seed: 5, arena: 'rink' }); for (let i = 0; i < HZ * 40; i++) { g.tick(); if (sample) { hitstopFor(g.events); goalTension(g); moodFor(g, true); g.events.forEach(traumaFor); } } return g.digest(); };
  assert.equal(run(true), run(false));
});
