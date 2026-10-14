import { fakeDocument } from '../fakedom.mjs'; globalThis.document = fakeDocument;
const { K } = await import('../realK.mjs'); const THREE = K.THREE;
const HR = await import('/workspace/work/reviews/hawk-hr/src/gang_harbor_rats.js');
for (const [mem, pose] of [['grunt_a', 'down'], ['armed', 'windup'], ['grunt_a','idle']]) {
  const J = HR.buildHarborRat(K, mem, { seed: 7 });
  const P = pose === 'down' ? K.THUG_POSES.down(1, true) : pose === 'windup' ? K.THUG_POSES.windup(0.6, J) : K.THUG_POSES.idle(0.5, J);
  K.applyPose(J, P, 1e4, 1, true); HR.animateGang(J, 0.5, pose === 'down' ? 'down' : 'attack'); J.root.updateMatrixWorld(true);
  const w = (g) => g.getWorldPosition(new THREE.Vector3()).toArray().map((x) => x.toFixed(2)).join(',');
  console.log(mem, pose, 'shL', w(J.shL), 'shR', w(J.shR), 'elR', w(J.elR), 'head', w(J.head), 'earL', w(J.earL), 'hips', w(J.hips), 'torso', w(J.torso));
}
