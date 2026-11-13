// Scene staging: every registered scene must play identically on every run and at every timescale,
// and its event log must land on the same ticks. This is the contract the filming pipeline relies on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../games/lanternport/sim.js';
import { SimClock, simDigest } from '../games/lanternport/capture.js';
import { SCENES, SceneRunner, sceneById } from '../games/lanternport/scenes.js';
import { FESTIVAL_DAY_ORDER } from '../games/lanternport/festival.js';

/** Play a scene headless for its full duration; returns the per-tick digests and the fired event log. */
function play(id, seed = 7) {
  const g = new Game(seed), runner = new SceneRunner(g, sceneById(id)), digests = [];
  while (!runner.done) { g.tick({ ...runner.input(), camYaw: 0 }); digests.push(simDigest(g)); }
  return { digests, fired: runner.fired };
}

/** Play a scene through a SimClock at a timescale and render fps (the way the page films it). */
function film(id, scale, fps = 60, seed = 7) {
  const g = new Game(seed), runner = new SceneRunner(g, sceneById(id)), clock = new SimClock(30), digests = [];
  clock.setScale(scale);
  while (!runner.done) clock.advance(1 / fps, () => { if (!runner.done) { g.tick({ ...runner.input(), camYaw: 0 }); digests.push(simDigest(g)); } });
  return { digests, fired: runner.fired };
}

test('registry: ids are unique and sceneById round-trips', () => {
  const ids = SCENES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate scene id');
  for (const s of SCENES) assert.equal(sceneById(s.id), s);
  assert.equal(sceneById('no-such-scene'), null);
});

test('stage-test: deterministic — two runs give identical digests and identical event ticks', () => {
  const a = play('stage-test'), b = play('stage-test');
  assert.deepEqual(b.digests, a.digests);
  assert.deepEqual(b.fired, a.fired);
  assert.deepEqual(a.fired.map((e) => e.name), ['start', 'at-fountain', 'end'], `events fired: ${JSON.stringify(a.fired)}`);
});

test('stage-test: timescale parity — filming at 0.25x changes nothing', () => {
  const ref = play('stage-test');
  const slow = film('stage-test', 0.25);
  assert.deepEqual(slow.digests, ref.digests);
  assert.deepEqual(slow.fired, ref.fired);
  assert.equal(film('stage-test', 2, 144).digests.at(-1), ref.digests.at(-1));
});

test('every registered scene: timescale parity at 0.25x across odd frame rates', () => {
  for (const s of SCENES) {
    if (typeof s.input !== 'function') continue;
    const ref = film(s.id, 1, 60);
    for (const fps of [24, 50, 144]) {
      const slow = film(s.id, 0.25, fps);
      assert.deepEqual(slow.digests, ref.digests, `${s.id} 0.25x at ${fps}fps digests must match 1x`);
      assert.deepEqual(slow.fired, ref.fired, `${s.id} 0.25x at ${fps}fps fired events must match 1x`);
    }
  }
});

test('every registered scene: bookmark framing is finite numbers', () => {
  const g = new Game(7);
  for (const s of SCENES) {
    if (!s.bookmark) continue;
    const b = typeof s.bookmark === 'function' ? s.bookmark(g) : s.bookmark;
    assert.ok(b.pivot.every(Number.isFinite) && Number.isFinite(b.yaw) && Number.isFinite(b.pitch) && b.dist > 0, `${s.id} bookmark`);
  }
});

test('sword-pedestal: deterministic events (hold, grip, strain, drawn, raised) and stage pose', () => {
  const a = play('sword-pedestal'), b = play('sword-pedestal');
  assert.deepEqual(b.digests, a.digests);
  assert.deepEqual(b.fired, a.fired);
  assert.deepEqual(
    a.fired.map((e) => e.name),
    ['hold', 'grip', 'strain', 'drawn', 'raised', 'end'],
    `events fired: ${JSON.stringify(a.fired)}`,
  );
  const def = sceneById('sword-pedestal');
  const S = def.set(new Game(7));
  def.act(S, 510);
  const ped = S.actors.find((ac) => ac.id === 'pedestal');
  const hs = S.actors.find((ac) => ac.id === 'heldSword');
  assert.equal(ped.drawn, true);
  assert.equal(hs.vis, true);
});

test('ocarina-dawn: deterministic events and lightCues dusk -> sunrise transition', () => {
  const g = new Game(7), def = sceneById('ocarina-dawn'), runner = new SceneRunner(g, def), digests = [];
  while (!runner.done) { g.tick({ ...runner.input(), camYaw: 0 }); digests.push(simDigest(g)); }
  const b = play('ocarina-dawn');
  assert.deepEqual(b.digests, digests);
  assert.deepEqual(
    runner.fired.map((e) => e.name),
    ['raise', 'notes', 'dawn', 'wake', 'end'],
    `events fired: ${JSON.stringify(runner.fired)}`,
  );
  const dawnTick = runner.fired.find((e) => e.name === 'dawn').tick;
  assert.ok(runner.lightCues.length >= 2, 'ocarina-dawn must emit lightCues');
  assert.equal(runner.lightCues[0].tick, dawnTick, 'first lightCue fires at dawn tick');
  assert.equal(runner.lightCues.at(-1).light, 'sunrise', 'lightCues finish at sunrise');
});

test('cue beats: every phase boundary in Festival Day + Zelda finale scenes has an aligned sound cue', () => {
  for (const id of [...FESTIVAL_DAY_ORDER, 'sword-pedestal', 'ocarina-dawn']) {
    const def = sceneById(id);
    assert.ok(def, `missing scene ${id}`);
    const sndTicks = new Set((def.sound || []).map((c) => c.at));
    for (const ev of def.events || []) {
      if (ev.at === undefined) continue;
      assert.ok(sndTicks.has(ev.at), `${id}: event ${ev.name}@${ev.at} missing aligned sound cue`);
    }
  }
});
