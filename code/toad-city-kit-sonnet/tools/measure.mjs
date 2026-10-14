// node tools/measure.mjs [A|B|all]  -> prints the measured budget tables and writes docs/measured_<task>.json
import { open, load, root } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
const which = process.argv[2] || 'all';
const b = await open({ w: 640, h: 400 }); const page = await b.newPage();
await load(page, b.port, 'show=street&hud=0');
const res = {};
const ev = (fn, arg) => page.evaluate(fn, arg);
if (which === 'A' || which === 'all') {
  const A = {};
  for (const id of ['rowhouse', 'rowhouse_brick', 'rowhouse_permastone', 'rowhouse_4', 'corner_bar', 'corner_shop', 'block']) A[id] = await ev((i) => window.__api.measure(i), id);
  A.determinism = {
    block_same: [await ev(() => window.__api.hash('block', 11)), await ev(() => window.__api.hash('block', 11))],
    block_other: await ev(() => window.__api.hash('block', 12)),
    house_same: [await ev(() => window.__api.hash('house', 4)), await ev(() => window.__api.hash('house', 4))], house_other: await ev(() => window.__api.hash('house', 5)),
  };
  A.atlasInfo = await ev(async () => { const T = await import('/src/rowkit_tiles.js'); let ax = 0, ay = 0, row = 0, area = 0, n = 0; for (const t of Object.values(T.KIT_TILES)) { if (ax + t.w > 1024) { ax = 0; ay += row; row = 0; } ax += t.w; row = Math.max(row, t.h); area += t.w * t.h; n++; } return { tiles: n, usedHeight: ay + row, areaPct: +(100 * area / 1048576).toFixed(1) }; });
  res.A = A; fs.writeFileSync(path.join(root, 'docs/measured_A.json'), JSON.stringify(A, null, 1));
}
if (which === 'B' || which === 'all') {
  const Bm = {}; const ids = await ev(() => window.__api.assets());
  for (const id of ids) Bm[id] = await ev((i) => window.__api.measure(i), id);
  Bm.trash_can_recycling = await ev(() => window.__api.measure('trash_can', { recycling: true }));
  Bm.atlasInfo = await ev(async () => { const T = await import('/src/props_tiles.js'); let ax = 0, ay = 0, row = 0, area = 0, n = 0; for (const t of Object.values(T.PROP_TILES)) { if (ax + t.w > 1024) { ax = 0; ay += row; row = 0; } ax += t.w; row = Math.max(row, t.h); area += t.w * t.h; n++; } return { tiles: n, usedHeight: ay + row, areaPct: +(100 * area / 1048576).toFixed(1) }; });
  res.B = Bm; fs.writeFileSync(path.join(root, 'docs/measured_B.json'), JSON.stringify(Bm, null, 1));
}
for (const [t, tab] of Object.entries(res)) { console.log('== Task', t); for (const [id, r] of Object.entries(tab)) { if (id === 'determinism' || id === 'atlasInfo') { console.log(id, JSON.stringify(r)); continue; } console.log(id.padEnd(22), `tris ${r.tris} (no hull ${r.trisNoHull})  meshes ${r.meshes}+${r.hulls}h  draws ${r.drawCalls}  mats ${r.materials}  bbox ${JSON.stringify(r.bbox)}`); } }
console.log('viewer errors', await ev(() => window.__errors.length), 'console', b.errors.length); b.errors.forEach((e) => console.log(e));
await b.close();
