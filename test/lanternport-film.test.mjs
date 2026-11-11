// FILM-IT mode: the framing maths must reward a centred, right-sized, steady shot and punish losing her.
// film.js is pure logic — the page feeds it viewfinder projections; the sim is never involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { frameQuality, FilmRun, Audience, ChatFeed, CHAT } from '../games/lanternport/film.js';

test('framing: a centred hero at a good size with a still camera scores high', () => {
  const r = frameQuality({ fx: 0, fy: 0.08, visible: true, fracH: 0.45, camMove: 0 });
  assert.ok(r.q > 0.85, `expected > 0.85, got ${r.q}`);
  assert.equal(r.center, 1); assert.equal(r.size, 1); assert.equal(r.smooth, 1);
});

test('framing: an off-frame hero scores zero', () => {
  for (const [fx, fy] of [[2, 0], [-1.8, 0.3], [0, 2.2], [5, 5]]) {
    const r = frameQuality({ fx, fy, visible: false, fracH: 0.45, camMove: 0 });
    assert.equal(r.q, 0);
  }
  // visible flag false (underwater / off stage) is always zero, wherever the projection lands
  assert.equal(frameQuality({ fx: 0, fy: 0, visible: false, fracH: 0.45, camMove: 0 }).q, 0);
});

test('framing: losing the centre bleeds score smoothly, not in steps', () => {
  const mid = frameQuality({ fx: 0.55, fy: 0.08, visible: true, fracH: 0.45, camMove: 0 }).q;
  const edge = frameQuality({ fx: 1.0, fy: 0.08, visible: true, fracH: 0.45, camMove: 0 }).q;
  const out = frameQuality({ fx: 1.35, fy: 0.08, visible: true, fracH: 0.45, camMove: 0 }).q;
  assert.ok(mid > edge && edge > out && out < 0.1, `mid ${mid} edge ${edge} out ${out}`);
});

test('framing: a tiny hero and a cropped hero both score worse than the sweet size', () => {
  const sweet = frameQuality({ fx: 0, fy: 0.08, visible: true, fracH: 0.45, camMove: 0 }).q;
  const tiny = frameQuality({ fx: 0, fy: 0.08, visible: true, fracH: 0.1, camMove: 0 }).q;
  const cropped = frameQuality({ fx: 0, fy: 0.08, visible: true, fracH: 1.1, camMove: 0 }).q;
  assert.ok(tiny < sweet * 0.6, `tiny ${tiny} vs sweet ${sweet}`);
  assert.ok(cropped < sweet, `cropped ${cropped} vs sweet ${sweet}`);
  assert.ok(cropped > tiny, 'cropped should still beat a speck');
});

test('framing: camera shake is penalised — same shot, worse score', () => {
  const still = frameQuality({ fx: 0, fy: 0.08, visible: true, fracH: 0.45, camMove: 0 });
  const whip = frameQuality({ fx: 0, fy: 0.08, visible: true, fracH: 0.45, camMove: 0.12 });
  assert.equal(whip.smooth, 0);
  assert.ok(whip.q < still.q * 0.6, `whip ${whip.q} vs still ${still.q}`);
  const drift = frameQuality({ fx: 0, fy: 0.08, visible: true, fracH: 0.45, camMove: 0.01 });
  assert.ok(drift.q > whip.q && drift.q < still.q, 'a gentle drift sits between the two');
});

test('run: score is the 0..100 average, best frame and streaks are tracked', () => {
  const run = new FilmRun();
  for (let t = 0; t < 60; t++) run.add(1, t);
  assert.equal(run.score, 100); assert.equal(run.best, 1); assert.equal(run.bestTick, 59); assert.equal(run.goodStreak, 60);
  for (let t = 60; t < 120; t++) run.add(0, t);
  assert.equal(run.score, 50); assert.equal(run.lostStreak, 60); assert.equal(run.goodStreak, 0);
  run.reset(); assert.equal(run.score, 0); assert.equal(run.bestTick, -1);
});

test('audience: good footage pulls a crowd, bad footage drains it, events spike it', () => {
  const a = new Audience(), start = a.viewers;
  for (let i = 0; i < 200; i++) a.update(0.95);
  const peak = a.viewers;
  assert.ok(peak > start * 10, `crowd grew ${start} -> ${peak}`);
  for (let i = 0; i < 400; i++) a.update(0);
  assert.ok(a.viewers < peak * 0.3, `crowd drained to ${a.viewers}`);
  const before = a.viewers; a.boost(1.35, 40);
  assert.ok(a.viewers > before + 40, 'boost adds viewers');
  // deterministic: same input sequence, same crowd
  const b = new Audience(), c = new Audience();
  for (let i = 0; i < 50; i++) { b.update(0.7); c.update(0.7); }
  assert.equal(b.viewers, c.viewers);
});

test('chat: event lines exist for the dive beats, streaks and idle lines cycle without repeats-in-a-row', () => {
  const feed = new ChatFeed();
  for (const name of ['splash', 'leap', 'rim-sit', 'strut']) assert.ok(feed.event(name), `no chat for ${name}`);
  assert.equal(feed.event('no-such-event'), null);
  const seen = new Set(); for (let i = 0; i < CHAT.good.length; i++) seen.add(feed.streak('good'));
  assert.ok(seen.size >= CHAT.good.length - 1, 'good lines cycle through the pool');
  assert.ok(feed.streak('lost').length > 0 && feed.idle().length > 0);
});
