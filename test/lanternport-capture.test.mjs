// Capture camera kit: slow motion must never change the game, and the freecam maths must hold together.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../games/lanternport/sim.js';
import { Bot } from '../games/lanternport/bot.js';
import { SimClock, FreeCam, TIMESCALES, simDigest } from '../games/lanternport/capture.js';

/** Play the bot for `ticks` sim ticks at a timescale, rendering at `fps`; returns the digest after every tick and the frames it took. */
function film(scale, ticks, fps = 60, seed = 7) {
  const g = new Game(seed), bot = new Bot(g), clock = new SimClock(30), digests = []; clock.setScale(scale);
  let frames = 0;
  while (digests.length < ticks) { clock.advance(1 / fps, () => { if (digests.length < ticks) { g.tick({ ...bot.input(), camYaw: 0 }); digests.push(simDigest(g)); } }); frames++; }
  return { digests, frames };
}

test('timescale parity: the same scripted inputs at 1x and 0.25x give an IDENTICAL sim digest at every matching tick', () => {
  const one = film(1, 600), slow = film(0.25, 600);
  assert.equal(one.digests.length, 600); assert.deepEqual(slow.digests, one.digests);
  assert.ok(slow.frames > one.frames * 3.9 && slow.frames < one.frames * 4.1, `0.25x took ${slow.frames} frames vs ${one.frames}`);
});

test('every timescale (0.25 / 0.5 / 1 / 2) and odd frame rates land on the same game', () => {
  const ref = film(1, 300).digests;
  for (const s of TIMESCALES) assert.equal(film(s, 300).digests[299], ref[299], `${s}x diverged`);
  for (const fps of [24, 50, 144]) assert.equal(film(0.5, 300, fps).digests[299], ref[299], `${fps} fps diverged`);
  assert.notEqual(film(1, 300, 60, 8).digests[299], ref[299], 'the digest does tell different games apart');
});

test('SimClock: whole ticks only, a 0..1 blend factor, and only the four allowed speeds', () => {
  const c = new SimClock(30); let n = 0;
  const a = c.advance(1 / 60, () => n++); assert.equal(n, 0); assert.ok(Math.abs(a - 0.5) < 1e-9);
  c.advance(1 / 60, () => n++); assert.equal(n, 1);
  assert.equal(c.setScale(3), 1, 'unsupported speeds fall back to 1x'); assert.equal(c.setScale(0.25), 0.25);
  assert.equal(c.nudge(-1), 0.25); assert.equal(c.nudge(1), 0.5); assert.equal(c.nudge(1), 1); assert.equal(c.nudge(1), 2); assert.equal(c.nudge(1), 2);
  c.setScale(0.25); n = 0; for (let i = 0; i < 8; i++) c.advance(1 / 60, () => n++); assert.equal(n, 1, 'at 0.25x one tick takes eight 60 fps frames');
});

test('FreeCam: takes over from exactly where the follow camera was, then orbits, pans, flies and dollies', () => {
  const f = new FreeCam(); f.takeOver([0, 5, -10], [0, 1, 0]);
  const p = f.position(); assert.ok(Math.hypot(p[0], p[1] - 5, p[2] + 10) < 1e-9, 'no jump on takeover'); assert.equal(f.on, true);
  f.orbit(Math.PI / 2, 0); const q = f.position(); assert.ok(Math.abs(q[0] + f.dist * Math.cos(f.pitch)) < 1e-6 && Math.abs(q[2]) < 1e-6, 'orbit swings round the pivot at the same distance');
  const d0 = f.dist; f.dolly(0.5); assert.ok(Math.abs(f.dist - d0 / 2) < 1e-9); f.dolly(1e-9); assert.equal(f.dist, 1.5);
  const before = [...f.pivot]; f.fly(3, 0, 0); assert.ok(Math.abs(Math.hypot(f.pivot[0] - before[0], f.pivot[2] - before[2]) - 3) < 1e-9, 'fly moves the rig along the view');
  f.pan(0, -99); assert.ok(f.pivot[1] >= 0.1, 'never below the ground'); f.orbit(0, 99); assert.ok(f.pitch <= 1.5);
  f.release(); assert.equal(f.on, false);
});
