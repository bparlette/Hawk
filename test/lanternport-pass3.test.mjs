// Lanternport pass 3: breakable pots, cuttable grass, rupee denominations, denser streets.
// All proven headlessly on the real simulation; the pass-1 suite stays untouched in lanternport.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, GRASS_REGROW, buildCity } from '../games/lanternport/sim.js';
import { Bot } from '../games/lanternport/bot.js';

const run = (g, n, input = {}) => { const seen = []; for (let i = 0; i < n; i++) { g.tick(typeof input === 'function' ? input(i) : input); seen.push(...g.events); } return seen; };
// Drop the hero from a height onto (x, z) and ground-pound: the universal smash/trim verb in these tests.
const pound = (g, x, z) => { g.place(0, x, 500, z); run(g, 4); g.tick({ z: true }); return run(g, 60); };

test('pots: the city places a real set of them, deterministically, never inside a solid', () => {
  const a = buildCity(7);
  assert.deepEqual(a.pots, buildCity(7).pots);
  assert.ok(a.pots.length >= 30, `expected 30+ pots, got ${a.pots.length}`);
  for (const p of a.pots) for (const b of a.boxes) {
    if (b.kind === 'trunk') continue;
    assert.ok(!(p.x > b.x0 - 40 && p.x < b.x1 + 40 && p.z > b.z0 - 40 && p.z < b.z1 + 40), `pot inside ${b.kind} at ${p.x},${p.z}`);
  }
});

test('pots: a ground-pound smashes a pot and pots pay out seeded rupees (green or blue only)', () => {
  const smashAll = () => {
    const g = new Game(7), seen = new Set(), drops = [];
    for (const p of [...g.pots]) {
      if (p.broken) continue;
      pound(g, p.x, p.z);
      for (const pk of g.pickups) if (pk.kind === 'rupee' && !seen.has(pk)) { seen.add(pk); drops.push(pk.denom); }
    }
    return { g, drops };
  };
  const a = smashAll(), b = smashAll();
  assert.ok(a.g.pots.every((p) => p.broken), 'every pot should smash under a pound');
  assert.deepEqual(a.drops, b.drops, 'same seed, same drops');
  assert.ok(a.drops.length >= 5, `expected a healthy number of rupee drops, got ${a.drops.length}`);
  assert.ok(a.drops.every((d) => d === 1 || d === 5), 'pots drop green (1) or blue (5), never red');
});

test('grass: a pound trims a patch flat, and it regrows after the full regrow window', () => {
  const g = new Game(7);
  const patch = g.grass.find((p) => p.x > 9000 && p.z > 9000); // a docks patch, far from the cuccos
  assert.ok(patch, 'docks patch exists');
  assert.equal(patch.trimT, 0);
  const ev = pound(g, patch.x, patch.z);
  assert.ok(ev.includes('grassCut'), 'trim event fired');
  assert.ok(patch.trimT > GRASS_REGROW - 120, `patch is trimmed flat (trimT ${patch.trimT})`);
  run(g, GRASS_REGROW + 10);
  assert.equal(patch.trimT, 0, 'patch has fully regrown');
});

test('rupees: denominations pay 5 / 25 / 100 glim', () => {
  const g = new Game(7);
  const hp = () => { const p = g.hero.ctrl.pos; return { x: p[0], z: p[2] }; };
  for (const [denom, value] of [[1, 5], [5, 25], [20, 100]]) {
    const before = g.coins, { x, z } = hp();
    g.pickups.push({ kind: 'rupee', denom, x, y: 60, z, taken: false });
    g.tick({});
    assert.equal(g.coins - before, value, `denom ${denom} pays ${value}`);
  }
});

test('job bonus: finishing the bread run leaves a red rupee at the bakery beacon', () => {
  const g = new Game(7), bot = new Bot(g);
  let guard = 0;
  while (!g.completed.includes('bread') && guard++ < 2400) g.tick(bot.input());
  assert.deepEqual(g.completed, ['bread']);
  const red = g.pickups.find((p) => p.kind === 'rupee' && p.denom === 20 && !p.taken);
  assert.ok(red, 'a red rupee waits at the job beacon');
  const B = g.city.places.bakery;
  assert.ok(Math.hypot(red.x - B.x, red.z - B.z) < 200, 'the red rupee is at the bakery');
});

test('streets: pass 3 traffic and parked vehicles thicken the roads', () => {
  const g = new Game(7);
  const npc = g.vehicles.filter((v) => v.driver === 'npc');
  assert.ok(npc.length >= 13, `expected 13+ traffic vehicles, got ${npc.length}`);
  assert.ok(npc.some((v) => v.kind === 'skiff'), 'traffic includes skiffs, not only carts');
  assert.ok(g.vehicles.filter((v) => !v.driver).length >= 6, 'parked vehicles to borrow');
});
