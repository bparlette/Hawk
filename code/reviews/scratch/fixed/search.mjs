import { fakeDocument } from '../fakedom.mjs'; globalThis.document = fakeDocument;
const { K } = await import('../realK.mjs'); const THREE = K.THREE;
const HR = await import('/workspace/work/reviews/hawk-hr/src/gang_harbor_rats.js');
const isHull = (o) => o.material && o.material.isShaderMaterial; const v = new THREE.Vector3();
function minY(g) { let m = Infinity; g.updateWorldMatrix(true, true); g.traverse((o) => { if (!o.isMesh || isHull(o)) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 3) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (v.y < m) m = v.y; } }); return m; }
const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
function anim(J, t, state, P) {
  const B = J.tailBase, f = 2.2, a = 0.22;
  const up = [[B[0], Math.sin(t * f) * a, 0], [B[1], 0, Math.sin(t * f - 0.9) * a * 0.9], [B[2], 0, Math.sin(t * f - 1.8) * a]];
  const flat = [[-0.15, 0, Math.sin(t * 2.2) * 0.08], [0.1, 0, Math.sin(t * 2.2 - 0.9) * 0.07], [0.15, 0, Math.sin(t * 2.2 - 1.8) * 0.08]];
  const th = -J.tilt.rotation.x; const k = state === 'down' ? 1 : ss(P.a, P.b, th);
  const side = P.c * Math.sin(Math.PI * k);
  [J.tail, J.tail1, J.tail2].forEach((g, i) => g.rotation.set(up[i][0] + (flat[i][0] - up[i][0]) * k, up[i][1] + (flat[i][1] - up[i][1]) * k, up[i][2] + (flat[i][2] - up[i][2]) * k + (i === 0 ? side : 0)));
}
function run(mem, P) {
  const J = HR.buildHarborRat(K, mem, { seed: 7 }); J.root.scale.setScalar(HR.META[mem].scale);
  const dt = 1 / 60; let T = 0, worst = Infinity;
  K.applyPose(J, K.THUG_POSES.idle(0, J), 1e4, 1, true);
  const seg = (dur, fn) => { for (let st = 0; st < dur; st += dt, T += dt) { const [p, rate, state] = fn(st); K.applyPose(J, p, rate, dt, false); anim(J, T, state, P); J.root.updateMatrixWorld(true); worst = Math.min(worst, minY(J.tail)); } };
  seg(0.34, (st) => [K.THUG_POSES.hurt(Math.min(1, st / 0.32), J), 24, 'idle']);
  let ey = 0.01, vy = 4.2;
  seg(1.25, (st) => { vy -= 22 * dt; ey = Math.max(0, ey + vy * dt); J.root.position.y = ey; return [K.THUG_POSES.down(st, ey <= 0 && st > 0.15), 13, 'down']; });
  J.root.position.y = 0;
  seg(0.5, (st) => [K.THUG_POSES.getup(Math.min(1, st / 0.5), J), 14, 'idle']);
  seg(0.3, (st) => [K.THUG_POSES.idle(T, J), 10, 'idle']);
  return worst;
}
const res = [];
for (const a of [0.4, 0.5, 0.6]) for (const b of [1.1, 1.2, 1.35]) for (const c of [0.8, 1.0, 1.2]) { const P = { a, b, c }; res.push([Math.min(run('grunt_a', P), run('bruiser', P)), P]); }
res.sort((x, y) => y[0] - x[0]); for (const r of res.slice(0, 10)) console.log(r[0].toFixed(3), JSON.stringify(r[1]));
