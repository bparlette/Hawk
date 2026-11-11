import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../games/lanternport/lib/three.module.min.js';
import { Game } from '../games/lanternport/sim.js';
import { sceneById } from '../games/lanternport/scenes.js';
import { StageView } from '../games/lanternport/stageview.js';
import { thing } from '../games/lanternport/stage.js';
import '../games/lanternport/zelda.js';

test('fairy: stage actor kind builds cleanly via StageView', () => {
  const fakeKit = {
    toon: () => new THREE.MeshBasicMaterial(),
    part: (parent, geom, mat, x, y, z) => {
      const m = new THREE.Mesh(geom, mat);
      m.position.set(x || 0, y || 0, z || 0);
      parent.add(m);
      return m;
    },
  };
  const S = {
    origin: [0, 0, 0],
    props: [],
    actors: [thing('myFairy', 'fairy', 0, 1.8, 0)],
  };
  const view = new StageView(THREE, fakeKit, S);
  assert.ok(view.nodes.has('myFairy'), 'fairy actor node instantiated');
});

test('pot-rampage: all staged pots end broken', () => {
  const def = sceneById('pot-rampage');
  const S = def.set(new Game(7));
  def.act(S, def.duration - 1);
  assert.equal(S.actors.find(a => a.id === 'pot1').vis, false);
  assert.equal(S.actors.find(a => a.id === 'pot2').vis, false);
  assert.equal(S.actors.find(a => a.id === 'pot3').vis, false);
  assert.equal(S.actors.find(a => a.id === 'pot4').vis, false);
  assert.equal(S.actors.find(a => a.id === 'bigpot').vis, false);
});

test('chest-fanfare: hold is at least 60 ticks', () => {
  const def = sceneById('chest-fanfare');
  const itemUpEvent = def.events.find(e => e.name === 'item-up');
  const applauseEvent = def.events.find(e => e.name === 'applause');
  assert.ok(applauseEvent.at - itemUpEvent.at >= 60, 'held for at least 2 full seconds (60 ticks)');
});
