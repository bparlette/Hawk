import { fakeDocument } from './fakedom.mjs'; globalThis.document = fakeDocument;
const { K } = await import('./realK.mjs'); const HR = await import('../hawk-hr/src/gang_harbor_rats.js'); const THREE = K.THREE;
const isHull = (o) => o.material && o.material.isShaderMaterial;
function minYof(g) { const b = new THREE.Box3(); g.traverse((o) => { if (o.isMesh && !isHull(o)) b.expandByObject(o); }); return b.min.y; }
for (const mem of ['grunt_a', 'bruiser']) for (const [label, set] of [
  ['rest', () => {}],
  ['animateGang down', (J) => HR.animateGang(J, 0.5, 'down')],
  ['proposed down: T.x=-0.15, T1.x=0.1, T2.x=0.15', (J) => { J.tail.rotation.set(-0.15, 0, 0); J.tail1.rotation.set(0.1, 0, 0); J.tail2.rotation.set(0.15, 0, 0); }],
]) for (const ground of [false, true]) for (const u of [0.25, 0.5, 1]) {
  if (ground && u !== 1) continue;
  const J = HR.buildHarborRat(K, mem, { seed: 7 }); J.root.scale.setScalar(HR.META[mem].scale);
  K.applyPose(J, K.THUG_POSES.down(u, ground), 1e4, 1, true); set(J); J.root.updateMatrixWorld(true);
  console.log(mem.padEnd(8), label.padEnd(46), ground ? 'ground' : 'fall u=' + u, 'tail minY', minYof(J.tail).toFixed(3), ' body minY(no tail)', (() => { J.tail.visible = false; const b = new THREE.Box3(); J.root.traverse((o) => { if (o.isMesh && !isHull(o)) { let v = true, p = o; while (p) { if (!p.visible) v = false; p = p.parent; } if (v) b.expandByObject(o); } }); return b.min.y.toFixed(3); })());
}
// thin (outline:false) parts that still cast shadows
const J = HR.buildHarborRat(K, 'armed', { seed: 7 }); const names = new Map(Object.entries(J).filter(([k, v]) => v && v.isObject3D).map(([k, v]) => [v, k]));
const thin = []; J.root.traverse((o) => { if (o.isMesh && !isHull(o) && !o.children.some(isHull) && o.castShadow) thin.push(names.get(o.parent) + ':' + o.geometry.type + JSON.stringify(Object.values(o.geometry.parameters).slice(0, 3))); });
console.log('armed thin parts casting shadows:', thin);
for (const m of ['grunt_a', 'grunt_b', 'bruiser']) { const J2 = HR.buildHarborRat(K, m, { seed: 7 }); const t = []; J2.root.traverse((o) => { if (o.isMesh && !isHull(o) && !o.children.some(isHull) && o.castShadow) t.push(o.geometry.type + JSON.stringify(Object.values(o.geometry.parameters).slice(0, 3))); }); console.log(m, t); }
