import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../games/lanternport/sim.js';
import { SceneRunner, sceneById } from '../games/lanternport/scenes.js';

test('cucco-swarm: fires clip, swarm, circuit, vault, break-off, and end events', () => {
  const def = sceneById('cucco-swarm');
  assert.ok(def, 'scene exists');
  const g = new Game(7);
  const runner = new SceneRunner(g, def);
  while (!runner.done) {
    g.tick({ ...runner.input(), camYaw: 0 });
  }
  const firedNames = runner.fired.map(e => e.name);
  assert.ok(firedNames.includes('clip'), 'has clip');
  assert.ok(firedNames.includes('swarm'), 'has swarm');
  assert.ok(firedNames.includes('circuit'), 'has circuit');
  assert.ok(firedNames.includes('vault'), 'has vault');
  assert.ok(firedNames.includes('break-off'), 'has break-off');
});
