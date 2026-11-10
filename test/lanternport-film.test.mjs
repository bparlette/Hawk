// Film scenes (filmscenes.js): every one must be a pure, deterministic function of its tick, keep the sim untouched,
// fire its beats in order, and mix its money beat loudest. Iterates the registry, so new scenes are covered automatically.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../games/lanternport/sim.js';
import { simDigest } from '../games/lanternport/capture.js';
import { SCENES, SceneRunner } from '../games/lanternport/scenes.js';
import { FILM_SCENES } from '../games/lanternport/filmscenes.js';

const snap = (S) => JSON.stringify([S.actors.map((a) => [a.id, a.x, a.y, a.z, a.yaw, a.vis, a.pose, a.p, a.on, a.flap]), S.props.map((p) => [p.id, p.flex, p.unfurl]), S.flash || 0]);
const MONEY = { 'rooftop-dive': 'splash', 'photo-call': 'brass', 'snapper-shop': 'chord', 'garden-guard': 'sting', 'festival-roundabout': 'cheer', 'dawn-shift': 'rollout', 'harbor-run': 'wings' };

test('film scenes lead the registry in brief order, so bookmark keys 1-8 match the brief', () => {
  assert.deepEqual(SCENES.slice(0, FILM_SCENES.length).map((s) => s.id), FILM_SCENES.map((s) => s.id));
  assert.equal(SCENES.at(-1).id, 'stage-test');
});

for (const def of FILM_SCENES) {
  test(`${def.id}: set is deterministic, act is a pure function of the tick, nothing goes non-finite`, () => {
    const A = def.set(new Game(7)), B = def.set(new Game(7));
    assert.equal(JSON.stringify(A), JSON.stringify(B), 'same seed, same set');
    const at = {}; for (const t of [0, 37.5, 200, def.duration * 0.5, def.duration - 1]) { def.act(A, t); at[t] = snap(A); }
    for (let t = 0; t < def.duration; t += 0.5) { def.act(A, t); for (const a of A.actors) assert.ok([a.x, a.y, a.z, a.yaw || 0].every(Number.isFinite), `${a.id} at tick ${t}`); }
    for (const t of Object.keys(at)) { def.act(A, +t); assert.equal(snap(A), at[t], `act(${t}) depends only on t`); }
    assert.ok(def.duration >= 20 * 30 && def.duration <= 40 * 30, 'a 20-40 second Short');
  });
  test(`${def.id}: beats fire in order, the sim is untouched, and the money beat is the loudest cue`, () => {
    const g = new Game(7), idle = new Game(7), run = new SceneRunner(g, def);
    while (!run.done) { g.tick({ ...run.input(), camYaw: 0 }); idle.tick({ camYaw: 0 }); }
    assert.equal(simDigest(g), simDigest(idle), 'the scene plays on the stage, not in the sim');
    assert.deepEqual(run.fired.map((e) => e.name), def.events.map((e) => e.name)); assert.deepEqual(run.fired.map((e) => e.tick), [...run.fired.map((e) => e.tick)].sort((a, b) => a - b));
    assert.ok(def.sound.length > 3, 'has its sound'); assert.ok(def.sound.every((c) => c.at >= 0 && c.at < def.duration));
    const loud = [...def.sound].sort((a, b) => (b.vol ?? 1) - (a.vol ?? 1))[0]; assert.equal(loud.cue, MONEY[def.id], 'money beat mixed loudest');
    assert.ok(def.bed && def.light, 'has a music bed and a light state');
  });
}
