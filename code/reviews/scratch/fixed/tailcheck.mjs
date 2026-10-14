// M1 verification against the REAL game's poses (realK.mjs): exact vertex min-y of the tail (and whole body),
// (a) static real down pose, fall u sweep + grounded, t sweep over two swish periods, every member, HD;
// (b) a simulated game sequence idle -> hurt -> down (1.25 s) -> getup (0.5 s) -> idle at 60 fps with the game's damping
//     rates, for getup mapped to animateGang 'down' and to 'idle'.
import { fakeDocument } from '../fakedom.mjs'; globalThis.document = fakeDocument;
const { K } = await import('../realK.mjs'); const THREE = K.THREE;
const HR = await import(process.env.HR_PATH);
const isHull = (o) => o.material && o.material.isShaderMaterial;
const v = new THREE.Vector3();
function minY(g) { let m = Infinity; g.updateWorldMatrix(true, true); g.traverse((o) => { if (!o.isMesh || isHull(o)) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (v.y < m) m = v.y; } }); return m; }
function bodyMinY(J) { J.tail.visible = false; let m = Infinity; J.root.updateMatrixWorld(true); J.root.traverse((o) => { if (!o.isMesh || isHull(o)) return; let vis = true, q = o; while (q) { if (!q.visible) vis = false; q = q.parent; } if (!vis || (J.swR && isDesc(o, J.swR))) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (v.y < m) m = v.y; } }); J.tail.visible = true; return m; }
const isDesc = (o, g) => { while (o) { if (o === g) return true; o = o.parent; } return false; };
const out = {};
for (const mem of HR.GANG.members) {
  const r = out[mem] = {};
  for (const anim of [false, true]) {
    let worstGround = Infinity, worstFall = Infinity, worstGroundBody = Infinity;
    for (const [u, ground] of [[0.1, false], [0.25, false], [0.4, false], [0.5, false], [0.75, false], [1, false], [1, true]]) for (let t = 0; t < 2.9; t += 0.05) {
      const J = HR.buildHarborRat(K, mem, { seed: 7 }); J.root.scale.setScalar(HR.META[mem].scale);
      K.applyPose(J, K.THUG_POSES.down(u, ground), 1e4, 1, true); if (anim) HR.animateGang(J, t, 'down');
      J.root.updateMatrixWorld(true); const y = minY(J.tail);
      if (ground) { worstGround = Math.min(worstGround, y); worstGroundBody = Math.min(worstGroundBody, bodyMinY(J)); } else worstFall = Math.min(worstFall, y);
      if (!anim) break;
    }
    r[anim ? 'animateGang_down' : 'no_animateGang'] = { tailMinY_grounded: +worstGround.toFixed(3), tailMinY_falling: +worstFall.toFixed(3), bodyMinY_grounded_excl_tail_weapon: +worstGroundBody.toFixed(3) };
  }
  // simulated game sequence
  for (const getupState of ['idle', 'hurt', 'down']) {
    const J = HR.buildHarborRat(K, mem, { seed: 7 }); J.root.scale.setScalar(HR.META[mem].scale);
    const dt = 1 / 60; let T = 0, worst = Infinity, worstAt = '';
    const seg = (dur, fn) => { for (let st = 0; st < dur; st += dt, T += dt) { const [p, rate, state, snap] = fn(st); K.applyPose(J, p, rate, dt, snap); HR.animateGang(J, T, state); J.root.updateMatrixWorld(true); const y = minY(J.tail); if (process.env.DBG && state === "down" && st < 0.4) console.error(st.toFixed(2), y.toFixed(3), J.root.position.y.toFixed(2), J.tilt.rotation.x.toFixed(2)); if (y < worst) { worst = y; worstAt = state + '@' + st.toFixed(2); } } };
    K.applyPose(J, K.THUG_POSES.idle(0, J), 1e4, 1, true);
    seg(0.5, (st) => [K.THUG_POSES.idle(T, J), 10, 'idle', false]);
    seg(0.34, (st) => [K.THUG_POSES.hurt(Math.min(1, st / 0.32), J), 24, 'hurt', false]);
    let ey = 0.01, vy = 4.2;   // the game's knock-down hop (06_game.js:253, :449-450)
    seg(1.25, (st) => { vy -= 22 * dt; ey = Math.max(0, ey + vy * dt); J.root.position.y = ey; return [K.THUG_POSES.down(st, ey <= 0 && st > 0.15), 13, 'down', false]; });
    J.root.position.y = 0;
    seg(0.5, (st) => [K.THUG_POSES.getup(Math.min(1, st / 0.5), J), 14, getupState, false]);
    seg(0.5, (st) => [K.THUG_POSES.idle(T, J), 10, 'idle', false]);
    r['sequence_getup_as_' + getupState] = { tailMinY: +worst.toFixed(3), worstAt };
  }
}
console.log(JSON.stringify(out, null, 1));
