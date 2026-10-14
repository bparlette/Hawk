import { fakeDocument } from '../fakedom.mjs'; globalThis.document = fakeDocument;
const { K } = await import('../realK.mjs'); const THREE = K.THREE;
const HR = await import('/workspace/work/reviews/hawk-hr/src/gang_harbor_rats.js');
const isHull = (o) => o.material && o.material.isShaderMaterial; const v = new THREE.Vector3();
function minY(g) { let m = Infinity; g.updateWorldMatrix(true, true); g.traverse((o) => { if (!o.isMesh || isHull(o)) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (v.y < m) m = v.y; } }); return m; }
const J = HR.buildHarborRat(K, 'grunt_a', { seed: 7 }); const dt = 1/60;
K.applyPose(J, K.THUG_POSES.idle(0, J), 1e4, 1, true);
for (let st=0; st<0.34; st+=dt) { K.applyPose(J, K.THUG_POSES.hurt(Math.min(1, st / 0.32), J), 24, dt, false); }
let ey=0.01, vy=4.2;
for (let st=0; st<0.6; st+=dt) { vy -= 22*dt; ey=Math.max(0,ey+vy*dt); J.root.position.y=ey; K.applyPose(J, K.THUG_POSES.down(st, ey<=0&&st>0.15), 13, dt, false); HR.animateGang(J, st, 'down'); J.root.updateMatrixWorld(true);
 console.log(st.toFixed(2), 'ey', ey.toFixed(2), 'tilt', J.tilt.rotation.x.toFixed(2), 'tiltY', J.tilt.position.y.toFixed(2), 'hipsRot', J.hips.rotation.toArray().slice(0,3).map(x=>x.toFixed(2)).join(','), 'tail', minY(J.tail).toFixed(3), 'body', minY(J.root).toFixed(3)); }
