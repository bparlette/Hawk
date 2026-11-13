// Set dressing (games/lanternport/dressing.js): deterministic, finite, stays out of colliders' way and off the sets.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCity, EDGE } from '../games/lanternport/sim.js';
import { planDressing, stageRoof, LISTS, PROPS, frame, GROUND_REACH, U } from '../games/lanternport/dressing.js';

const city = buildCity(7), KEEP = [[31, -11, 10], [21, -21, 10], [93, 87.5, 10]];
const plan = planDressing(city, { keepOut: KEEP });
const rows = Object.entries(plan.lists).flatMap(([n, l]) => l.map((e) => [n, e]));

test('dressing: same city -> the same plan, every time; no random or clock in the module', () => {
  assert.equal(JSON.stringify(planDressing(buildCity(7), { keepOut: KEEP }).lists), JSON.stringify(plan.lists));
  assert.notEqual(JSON.stringify(planDressing(buildCity(8), { keepOut: KEEP }).lists), JSON.stringify(plan.lists), 'another seed dresses differently');
  const src = fs.readFileSync(new URL('../games/lanternport/dressing.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/Math\.random|Date\.now|performance\.now/.test(src));
});

test('dressing: every row is well formed and every list has a geometry + material', () => {
  assert.ok(rows.length > 2000, `a real amount of dressing (${rows.length})`);
  for (const [n, e] of rows) {
    assert.ok(LISTS[n], `list ${n} is declared`);
    assert.equal(e.length, 10, `${n} row width`);
    for (let i = 0; i < 6; i++) assert.ok(Number.isFinite(e[i]), `${n} row finite`);
    assert.ok(e[3] > 0 && e[4] > 0 && e[5] > 0, `${n} row has a size`);
    assert.ok(typeof e[6] === 'number' || (Array.isArray(e[6]) && e[6].length === 3), `${n} row colour`);
  }
  assert.equal(plan.counts.total, rows.length);
});

test('dressing: budget — instanced, a fixed handful of draw calls, bounded instance count', () => {
  assert.ok(Object.keys(LISTS).length <= 16, 'one draw call per list');
  assert.ok(plan.counts.total < 16000, `instances ${plan.counts.total}`);
});

test('dressing: ground props hug a wall or a park corner — streets, walks and scene sets stay clear', () => {
  const solid = city.boxes.filter((b) => b.kind === 'house' || b.kind === 'rampart');
  const wallDist = (x, z) => { let d = 1e9; for (const b of solid) { const dx = Math.max(b.x0 * U - x, 0, x - b.x1 * U), dz = Math.max(b.z0 * U - z, 0, z - b.z1 * U); d = Math.min(d, Math.hypot(dx, dz)); } return d; };
  const park = (x, z) => city.blocks.some((b) => (b.kind === 'plaza' || b.kind === 'hideout' || b.kind === 'docks') && x > b.x0 * U && x < b.x1 * U && z > b.z0 * U && z < b.z1 * U);
  const E = EDGE * U;
  let ground = 0;
  for (const [n, e] of rows) {
    const [x, y, z] = e;
    if (y > 2.6 || Math.abs(x) > E || Math.abs(z) > E) continue;           // wall-mounted / rooftop / out at sea
    ground++;
    const reach = Math.max(e[3], e[5]) / 2;
    assert.ok(wallDist(x, z) - reach < GROUND_REACH + 0.9 || park(x, z), `${n} at ${x.toFixed(1)}, ${z.toFixed(1)} stands ${wallDist(x, z).toFixed(2)} m from any wall`);
    if (park(x, z) && wallDist(x, z) > 3) for (const [kx, kz, r] of KEEP) assert.ok(Math.hypot(x - kx, z - kz) >= r, `${n} inside the keep-out at ${kx}, ${kz}`);
  }
  assert.ok(ground > 500);
});

test('dressing: the stage roof and the lamp-mission terraces carry no rooftop dressing', () => {
  const r = stageRoof(city), steps = city.blocks.find((b) => b.kind === 'steps');
  for (const [n, e] of rows) {
    const [x, y, z] = e;
    if (x > r.x0 * U + 0.2 && x < r.x1 * U - 0.2 && z > r.z0 * U + 0.2 && z < r.z1 * U - 0.2) assert.ok(y < r.y1 * U - 2.3, `${n} on the pool roof at y ${y}`);
    if (x > steps.x0 * U + 3.2 && x < steps.x1 * U - 3.2 && z > steps.z0 * U + 8.2 && z < steps.z1 * U - 3.2) assert.fail(`${n} on the terraces`);
  }
});

test('dressing: the prop kit is reusable — any prop at any frame, on any height', () => {
  for (const name of Object.keys(PROPS)) {
    const L = {}; for (const k of Object.keys(LISTS)) L[k] = [];
    PROPS[name](L, frame(10, 20, 1, 0, 5), 0.5);
    const out = Object.values(L).flat();
    assert.ok(out.length > 0, name);
    for (const e of out) { assert.ok(e[0] >= 10 - 1e-9 && e[0] < 10 + GROUND_REACH + 0.6, `${name} stays in front of its wall (${e[0]})`); assert.ok(e[1] > 5, `${name} stands on the frame height`); }
  }
});
