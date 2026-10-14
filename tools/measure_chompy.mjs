// headless check for src/npc_chompy.js on the real game K (harness/realK.mjs) + real mergeRig
import fs from 'node:fs';
import { fakeDocument } from '../harness/fakedom.mjs'; globalThis.document = fakeDocument;
const { K, mergeRig } = await import('../harness/realK.mjs');
const { buildChompy, META } = await import('../src/npc_chompy.js');
const THREE = K.THREE, out = { meta: META, poses: {}, merge: null };
const ms = []; let api; for (let i = 0; i < 20; i++) { const t0 = performance.now(); api = buildChompy(K); ms.push(performance.now() - t0); }
ms.sort((a, b) => a - b); out.buildMsMedian = +ms[10].toFixed(2);
let parts = 0, tris = 0, hulls = 0; const mats = new Set();
api.root.traverse((o) => { if (!o.isMesh) return; if (o.material.side === THREE.BackSide) { hulls++; return; } parts++; mats.add(o.material);
  tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
Object.assign(out, { parts, tris, hulls, materials: mats.size });
for (const s of META.states) for (const u of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]) {
  api.J.pose(s, u); const b = new THREE.Box3().setFromObject(api.root); out.poses[s + '@' + u] = { minY: +b.min.y.toFixed(3), maxY: +b.max.y.toFixed(3) };
  if (!Number.isFinite(b.min.y)) throw new Error('bad pose ' + s); }
api.setState('chomp'); for (let i = 0; i < 200; i++) api.update(1 / 60); out.afterChompState = api.state;
try { const r = mergeRig(api.J); let dc = 0; api.root.traverse((o) => { if (o.isMesh) dc++; }); out.merge = { ok: true, drawCalls: dc }; } catch (e) { out.merge = { ok: false, err: String(e.message) }; }
fs.writeFileSync('tools/results_npc_chompy.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 600));
