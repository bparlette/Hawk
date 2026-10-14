import crypto from 'node:crypto';
import { fakeDocument } from '../fakedom.mjs'; globalThis.document = fakeDocument;
const { K } = await import('../realK.mjs');
const A = await import('/workspace/work/reviews/hawk-hr/src/gang_harbor_rats.js'), B = await import('./prerefactor_tmp.js');
function h(J) { const x = crypto.createHash('sha1'); J.root.updateMatrixWorld(true); J.root.traverse((o) => { x.update(o.type + o.position.toArray().join() + o.rotation.toArray().slice(0, 3).join()); if (o.isMesh) { for (const k of ['position', 'color', 'normal', 'uv']) { const a = o.geometry.attributes[k]; if (a) x.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength)); } x.update(o.material.isShaderMaterial ? 'H' : o.material.map ? 'M' : 'T'); x.update(String(o.castShadow)); } }); return x.digest('hex').slice(0, 12); }
let same = 0, n = 0; for (const m of A.GANG.members) for (const lod of [0, 1]) { n++; const a = h(A.buildHarborRat(K, m, { lod, seed: 7 })), b = h(B.buildHarborRat(K, m, { lod, seed: 7 })), a2 = h(A.buildHarborRat(K, m, { lod, seed: 7 })); console.log(m, lod, a, b, a === b ? 'same' : 'DIFF', a === a2 ? 'det' : 'NONDET'); if (a === b) same++; }
console.log(same + '/' + n);
