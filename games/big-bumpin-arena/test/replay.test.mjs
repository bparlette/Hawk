// Goal replay: the clip is a re-simulation from (opts, recorded inputs), so it must reproduce the live match exactly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Game } from '../src/game.js';
import { HZ } from '../src/config.js';
import { Recorder, Replay, REPLAY } from '../src/replay.js';

const Matter = createRequire(import.meta.url)('../vendor/matter.min.js');
const OPTS = { seed: 3, arena: 'rink', seconds: 120 };
// a scripted pair of humans (car 0 and car 2) so the input stream is not empty
const humans = (t) => ({ 0: { throttle: 1, steer: Math.sin(t / 37), turbo: t % 200 < 40, brake: false, shunt: t % 311 === 0 ? 1 : 0, use: false }, 2: { throttle: 0.8, steer: Math.cos(t / 51), turbo: false, brake: false, shunt: 0, use: false } });

/** Play a live match until the first goal (plus the tail of the clip), recording inputs and a digest per tick. */
function live(opts = OPTS) {
  const g = new Game(Matter, opts), rec = new Recorder(), digests = [];
  let goalTick = 0;
  for (let i = 0; i < HZ * 400 && !(goalTick && g.ticks >= goalTick + REPLAY.postTicks); i++) {
    const h = humans(g.ticks); rec.record(g.ticks, h); g.tick(h); digests[g.ticks] = g.digest();
    for (const e of g.events) { if (e.type === 'go') rec.markGo(g.ticks); if (e.type === 'goal' && !goalTick) goalTick = g.lastGoal.tick; }
  }
  assert.ok(goalTick, 'the live match produced a goal'); return { g, rec, digests, goalTick };
}

test('replay reproduces the live goal tick-for-tick (other matches existed in between, so body ids differ)', () => {
  const { g, rec, digests, goalTick } = live();
  for (let i = 0; i < 3; i++) { const d = new Game(Matter, { seed: 99 + i }); for (let t = 0; t < 30; t++) d.tick(); }   // shift Matter's global id counters
  const r = new Replay(Game, Matter, OPTS, rec, goalTick); r.seek();
  let compared = 0; while (!r.done) { r.update(1 / 20); if (r.game.ticks > r.start) { assert.equal(r.game.digest(), digests[r.game.ticks], `diverged at tick ${r.game.ticks}`); compared++; } }
  assert.ok(compared > 100, `compared ${compared} ticks`);
  assert.equal(r.game.lastGoal.tick, goalTick); assert.deepEqual(r.game.score, g.score); assert.equal(r.game.lastGoal.team, g.lastGoal.team);
});

test('replay clip window: the last 3 s before the goal, never inside a countdown, then a short tail', () => {
  const rec = new Recorder(); const mk = (goal, go) => { rec.markGo(go); return new Replay(Game, Matter, OPTS, rec, goal); };
  assert.equal(mk(3000, 0).start, 3000 - 3 * HZ, 'three seconds back');
  assert.equal(mk(3000, 2900).start, 2900, 'but not before play restarted');
  assert.equal(mk(120, 0).start, 0, 'an early goal replays from the start');
  assert.equal(mk(3000, 0).end, 3000 + REPLAY.postTicks);
  assert.ok(REPLAY.slowEnd >= 0.15 && REPLAY.slowEnd < REPLAY.slowStart && REPLAY.slowStart < 1, 'always slower than real time, slowest at the goal');
});

test('replay is always slow motion, slowest at the goal, lasts under 10 s, can be skipped by any input, and never touches the live match', () => {
  const { g, rec, goalTick } = live(); const before = g.digest();
  const r = new Replay(Game, Matter, OPTS, rec, goalTick); r.seek(); const speeds = []; let frames = 0, tPrev = r.game.ticks;
  while (!r.done && frames < 60 * 30) { speeds.push(r.speed); r.update(1 / 60); frames++; assert.ok(r.game.ticks - tPrev <= 1, 'never more than a tick per frame at this speed'); tPrev = r.game.ticks; }
  assert.ok(speeds.every((v) => v < 1), 'slower than real time throughout'); assert.ok(speeds[speeds.length - 1] < speeds[0] * 0.6, 'and slowest at the goal');
  assert.ok(frames / 60 > 3 && frames / 60 < 10, `the clip lasted ${(frames / 60).toFixed(1)} s of wall-clock`); assert.ok(r.done);
  const r2 = new Replay(Game, Matter, OPTS, rec, goalTick); r2.seek(); for (let i = 0; i < 30; i++) r2.update(1 / 60);
  assert.equal(r2.done, false); r2.skip(); assert.equal(r2.done, true, 'skippable'); const t1 = r2.game.ticks; r2.update(1); assert.equal(r2.game.ticks, t1, 'a skipped replay stops');
  assert.equal(g.digest(), before, 'the live game is untouched'); assert.ok(r2.progress >= 0 && r2.progress <= 1);
});

test('chunked seek (spread over the celebration) lands in the same state as a one-shot seek', () => {
  const { rec, goalTick } = live({ ...OPTS, seed: 4 }); const a = new Replay(Game, Matter, { ...OPTS, seed: 4 }, rec, goalTick), b = new Replay(Game, Matter, { ...OPTS, seed: 4 }, rec, goalTick);
  a.seek(); let calls = 0; while (!b.seek(40)) calls++;
  assert.equal(a.game.ticks, b.game.ticks); assert.equal(a.game.digest(), b.game.digest()); assert.ok(calls >= 1 || a.start <= 40, 'it took several small chunks');
});
