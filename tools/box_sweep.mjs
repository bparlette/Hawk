// tools/box_sweep.mjs — the harness's ground test (per-part Box3.setFromObject min y, as in harness/measure_gang.mjs) swept
// wider: the harness's seven poses plus getup u = 0 .. 1 in tenths, every member at HD and LOD 1, on kit/toadcity_kit.js.
// The weapon (J.swR) is skipped only in down (the brief exempts it). Usage, from the repo/zip root:
//   GANG=./src/gang_key_hwy_otters.js OUT=tools/box_sweep.json node tools/box_sweep.mjs
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const { fakeDocument } = await import('../harness/fakedom.mjs'); globalThis.document = fakeDocument;
const { K } = await import('../kit/toadcity_kit.js');
const M = await import(pathToFileURL(path.resolve(process.env.GANG || './src/gang_key_hwy_otters.js')).href);
const BUILD = M[Object.keys(M).find((k) => k.startsWith('build') && typeof M[k] === 'function')];
const THREE = K.THREE, P = K.THUG_POSES; const isHull = (o) => o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide;
const out = {};
for (const mem of M.GANG.members) for (const lod of [0, 1]) {
  const J = BUILD(K, mem, { lod, seed: 7 }); const sc = M.META[mem].scale || 1;
  const tests = [['idle', (J) => P.idle(0.5, J)], ['run', (J) => P.run(0.5, 4.5, J)], ['windup', (J) => P.windup(0.6, J)], ['attack', (J) => P.attack(0.4, J)], ['hurt', (J) => P.hurt(0.15, J)], ['down', () => P.down(1, true)]];
  for (let i = 0; i <= 10; i++) tests.push([`getup(${i / 10})`, (J) => P.getup(i / 10, J)]);
  let worst = { y: Infinity };
  for (const [pose, f] of tests) {
    J.root.scale.setScalar(sc); K.applyPose(J, f(J), 1e4, 1, true); J.root.updateMatrixWorld(true);
    const skip = pose === 'down' && J.swR ? J.swR : null;
    J.root.traverse((o) => { if (!o.isMesh || isHull(o)) return; let p = o; while (p && p !== skip) p = p.parent; if (p) return;
      const b = new THREE.Box3().setFromObject(o); if (b.min.y < worst.y) worst = { y: +b.min.y.toFixed(4), pose, part: o.name || '?' }; });
  }
  out[mem + (lod ? '/lod1' : '')] = worst;
}
fs.writeFileSync(process.env.OUT || 'tools/box_sweep.json', JSON.stringify(out, null, 1));
console.log(out);
