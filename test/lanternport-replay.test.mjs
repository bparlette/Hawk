// Film Mode (record & replay): recorded live/scripted runs must replay bit-exactly via SimClock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../games/lanternport/sim.js';
import { Bot } from '../games/lanternport/bot.js';
import { SimClock, simDigest } from '../games/lanternport/capture.js';
import { SceneRunner, sceneById } from '../games/lanternport/scenes.js';
import {
  REPLAY_SPEEDS,
  SessionRecorder,
  TakeStore,
  ReplayPlayer,
  verifyTakeDeterminism,
} from '../games/lanternport/replay.js';

function makeMockStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
  };
}

test('bit-exact free-play record & replay across 0.5x / 1x / 2x SimClock scales', () => {
  const seed = 7;
  const g = new Game(seed);
  const bot = new Bot(g);
  const session = new SessionRecorder(seed);
  const clock = new SimClock(30);
  const liveDigests = [];

  session.startRecording(g, { name: 'Free Play Bot Run' });
  let tickCount = 0;
  while (tickCount < 360) {
    clock.advance(1 / 60, () => {
      if (tickCount >= 360) return;
      const bi = bot.input();
      // Mix in manual controls: camera yaw sweeps, dives, hero swaps, vehicle use attempts
      const raw = {
        ...bi,
        camYaw: (tickCount * 137) & 0x7fff,
        b: tickCount % 95 === 10,
        z: tickCount % 120 >= 40 && tickCount % 120 < 48,
        use: tickCount === 180 || tickCount === 181,
        swap: tickCount === 250,
      };
      const inp = session.recordTick(raw);
      g.tick(inp);
      liveDigests.push(simDigest(g));
      tickCount++;
    });
  }
  const liveEndDigest = simDigest(g);
  const take = session.stopRecording(g);

  // Persist through JSON + TakeStore (the same round-trip localStorage performs)
  const store = new TakeStore(makeMockStorage());
  const saved = store.save(take);
  assert.equal(saved.ok, true);
  const loaded = store.get(take.id);
  assert.ok(loaded, 'take must load back from storage');
  assert.equal(loaded.durationTicks, 360);
  assert.equal(loaded.endDigest, liveEndDigest);

  for (const speed of REPLAY_SPEEDS) {
    for (const fps of [24, 60, 144]) {
      const check = verifyTakeDeterminism(loaded, {
        scale: speed,
        fps,
        perTickExpectedDigests: liveDigests,
      });
      assert.equal(check.done, true, `speed ${speed}x @ ${fps}fps did not finish`);
      assert.equal(check.preludeMatch, true);
      assert.equal(check.digestMatch, true, `end digest mismatch at ${speed}x @ ${fps}fps: ${check.actualEndDigest} vs ${check.expectedEndDigest}`);
      assert.equal(check.firstDiverge, null, `per-tick divergence at ${speed}x @ ${fps}fps`);
      assert.equal(check.actualEndDigest, liveEndDigest);
    }
  }
});

test('mid-session take (with pre-roll input + place() jump) replays bit-exactly', () => {
  const seed = 7;
  const g = new Game(seed);
  const bot = new Bot(g);
  const session = new SessionRecorder(seed);

  // Pre-roll 180 ticks before pressing Record, including a hero relocation via place()
  for (let t = 0; t < 180; t++) {
    if (t === 90) {
      g.place(0, 1200, 40, -800);
      session.recordPlace(0, 1200, 40, -800);
    }
    const raw = { ...bot.input(), camYaw: (t * 73) & 0x3fff };
    const inp = session.recordTick(raw);
    g.tick(inp);
  }

  const startDigest = simDigest(g);
  session.startRecording(g, { name: 'Mid-Session Rooftop' });
  const takeDigests = [];
  for (let t = 0; t < 240; t++) {
    if (t === 110) {
      g.place(0, -1400, 60, 1500);
      session.recordPlace(0, -1400, 60, 1500);
    }
    const raw = { ...bot.input(), camYaw: (t * 211) & 0x7fff, swap: t === 170 };
    const inp = session.recordTick(raw);
    g.tick(inp);
    takeDigests.push(simDigest(g));
  }
  const take = session.stopRecording(g);

  assert.equal(take.startTick, 180);
  assert.equal(take.endTick, 420);
  assert.equal(take.durationTicks, 240);
  assert.equal(take.startDigest, startDigest);

  const check = verifyTakeDeterminism(JSON.parse(JSON.stringify(take)), {
    scale: 0.5,
    fps: 60,
    perTickExpectedDigests: takeDigests,
  });
  assert.equal(check.preludeMatch, true, 'prelude digest mismatch');
  assert.equal(check.digestMatch, true, 'take end digest mismatch');
  assert.equal(check.firstDiverge, null, 'per-tick divergence during mid-session take');
});

test('staged scene watch -> take control -> manual play records & replays bit-exactly', () => {
  const seed = 7;
  const g = new Game(seed);
  const def = sceneById('cucco-swarm');
  assert.ok(def, 'cucco-swarm scene exists');
  const session = new SessionRecorder(seed);

  // Watch scene for first 120 ticks, then switch to manual Take Control for 120 ticks
  const runner = new SceneRunner(g, def);
  const P = g.city.places;
  g.place(g.active, P.hideout.x, 0, P.hideout.z);
  session.recordPlace(g.active, P.hideout.x, 0, P.hideout.z);
  session.startRecording(g, { name: 'Cucco Takeover', sceneId: def.id, sceneMode: 'watch', sceneTick: 0 });

  const expected = [];
  for (let t = 0; t < 120; t++) {
    session.recordSceneState(def.id, 'watch', runner.t);
    const inp = session.recordTick({ ...runner.input(), camYaw: 0 });
    g.tick(inp);
    expected.push(simDigest(g));
  }
  // Mid-take Take Control (place hero at plaza fountain + manual movement)
  const f = g.city.fountain;
  g.place(g.active, f.x + 200, 40, f.z + 200);
  session.recordPlace(g.active, f.x + 200, 40, f.z + 200);
  session.recordSceneState(def.id, 'ready', 0);
  for (let t = 0; t < 120; t++) {
    const inp = session.recordTick({ stickX: 0.5, stickY: 0.8, a: t % 30 === 5, b: t % 50 === 12, camYaw: 4096 });
    g.tick(inp);
    expected.push(simDigest(g));
  }

  const take = session.stopRecording(g);
  const player = new ReplayPlayer(JSON.parse(JSON.stringify(take)));
  assert.equal(player.preludeMatch, true);

  // Verify pause, step halfway, restart, and run to completion at 2x
  player.paused = true;
  const c = new SimClock(30);
  player.advanceClock(c, 0.25);
  assert.equal(player.cursor, 0, 'paused player must not advance ticks');

  player.paused = false;
  c.setScale(2);
  while (player.cursor < 100) player.advanceClock(c, 1 / 60);
  assert.ok(player.cursor >= 100);

  player.reset();
  assert.equal(player.cursor, 0, 'reset rewinds take to tick 0 of take');
  const full = verifyTakeDeterminism(take, { scale: 2, fps: 60, perTickExpectedDigests: expected });
  assert.equal(full.digestMatch, true);
  assert.equal(full.firstDiverge, null);
});

test('TakeStore manages named takes (save, list, rename, remove)', () => {
  const store = new TakeStore(makeMockStorage());
  const makeDummy = (id, name, createdAt) => ({
    version: 1,
    id,
    name,
    seed: 7,
    sceneId: null,
    startTick: 0,
    startDigest: 'a',
    endTick: 10,
    endDigest: 'b',
    durationTicks: 10,
    prelude: [],
    ops: [[10]],
    createdAt,
  });

  store.save(makeDummy('t1', 'First', 1000));
  store.save(makeDummy('t2', 'Second', 2000));
  assert.deepEqual(store.list().map((t) => t.id), ['t2', 't1']);
  assert.equal(store.rename('t1', 'Dock Flip'), true);
  assert.equal(store.get('t1').name, 'Dock Flip');
  assert.equal(store.remove('t2'), true);
  assert.deepEqual(store.list().map((t) => t.id), ['t1']);
  assert.equal(store.nextName('Take'), 'Take 2');
});
