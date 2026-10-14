import { fakeDocument } from '../fakedom.mjs'; globalThis.document = fakeDocument;
const { K } = await import('../realK.mjs'); const THREE = K.THREE;
const HR = await import(process.env.HR_PATH);
const isHull = (o) => o.material && o.material.isShaderMaterial;
const pts = (g) => { const a = []; const v = new THREE.Vector3(); g.children.filter((c) => c.isMesh && !isHull(c)).forEach((m) => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) a.push(v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).clone()); }); return a; };
for (const [mem, pose, side] of [['grunt_a', 'down', 'L'], ['grunt_a', 'down', 'R'], ['armed', 'windup', 'R']]) {
  const J = HR.buildHarborRat(K, mem, { seed: 7 });
  K.applyPose(J, pose === 'down' ? K.THUG_POSES.down(1, true) : K.THUG_POSES.windup(0.6, J), 1e4, 1, true); J.root.updateMatrixWorld(true);
  // torso surface: is any shoulder-arm vertex inside the torso ellipsoid? report min distance between point sets
  const A = pts(J.torso), B = pts(J['sh' + side]); let best = [1e9];
  for (const a of A) for (const b of B) { const d = a.distanceTo(b); if (d < best[0]) best = [d, a, b]; }
  console.log(mem, pose, side, best[0].toFixed(3), best[1].toArray().map((x) => x.toFixed(2)).join(','), best[2].toArray().map((x) => x.toFixed(2)).join(','));
}
