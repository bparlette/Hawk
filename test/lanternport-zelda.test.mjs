// Zelda slate tests: slots 11-14 (pot-rampage, chest-fanfare, dock-fishing, fairy-orbit)
// and cucco-swarm (slot 8).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../games/lanternport/sim.js';
import { simDigest } from '../games/lanternport/capture.js';
import { SCENES, SceneRunner, sceneById } from '../games/lanternport/scenes.js';
import { cuccoSwarm } from '../games/lanternport/cucco.js';
import { ZELDA_SCENES } from '../games/lanternport/zelda.js';

const snap = (S) => JSON.stringify([
  S.actors.map((a) => [a.id, a.x, a.y, a.z, a.yaw, a.vis, a.pose, a.p, a.on, a.flap]),
  S.props.map((p) => [p.id, p.flex, p.unfurl, p.open]),
  S.flash || 0,
]);

test('registry slots: cucco-swarm is slot 8, Zelda slate is slots 11-14', () => {
  assert.equal(SCENES[7].id, 'cucco-swarm', 'slot 8 is cucco-swarm');
  assert.equal(SCENES[8].id, 'stage-test', 'slot 9 is stage-test');
  assert.equal(SCENES[9].id, 'pot-rampage', 'slot 11 is pot-rampage');
  assert.equal(SCENES[10].id, 'chest-fanfare', 'slot 12 is chest-fanfare');
  assert.equal(SCENES[11].id, 'dock-fishing', 'slot 13 is dock-fishing');
  assert.equal(SCENES[12].id, 'fairy-orbit', 'slot 14 is fairy-orbit');
});

const ALL_NEW_SCENES = [cuccoSwarm, ...ZELDA_SCENES];

for (const def of ALL_NEW_SCENES) {
  test(`${def.id}: set is deterministic, act is pure, all events fire in order`, () => {
    const A = def.set(new Game(7)), B = def.set(new Game(7));
    assert.equal(JSON.stringify(A), JSON.stringify(B), 'same seed, same set');

    // Deterministic act across two runs
    for (let t = 0; t < def.duration; t += 10) {
      def.act(A, t);
      def.act(B, t);
      assert.equal(snap(A), snap(B), `act(${t}) pure across runs`);
    }

    // Runner execution and events
    const g = new Game(7), runner = new SceneRunner(g, def);
    while (!runner.done) {
      g.tick({ ...runner.input(), camYaw: 0 });
    }

    assert.deepEqual(runner.fired.map((e) => e.name), def.events.map((e) => e.name), `${def.id} all events fire in order`);
  });
}
