// does the neckerchief diamond (box 0.17x0.17x0.045, torso-local) cut into the belly ellipsoid? (sampled on its surface)
import * as THREE from '/workspace/work/toad-city/game/site/three.module.min.js';
function test(sx, sz, z, rx, infl = 0.008) {
  const belly = { c: new THREE.Vector3(0, 0.27, 0.12 * sz), r: new THREE.Vector3(0.18 * sx, 0.24, 0.12 * sz), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0)) };
  const bq = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, Math.PI / 4)); const bc = new THREE.Vector3(0, 0.47, z);
  const iq = belly.q.clone().invert(); let worst = -1, n = 12;
  const w = 0.17 / 2 + infl, h = 0.17 / 2 + infl, d = 0.045 / 2 + infl;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) {
    if (!(i === 0 || i === n || j === 0 || j === n || k === 0 || k === n)) continue;
    const p = new THREE.Vector3((i / n * 2 - 1) * w, (j / n * 2 - 1) * h, (k / n * 2 - 1) * d).applyQuaternion(bq).add(bc);
    const l = p.sub(belly.c).applyQuaternion(iq); const e = (l.x / belly.r.x) ** 2 + (l.y / belly.r.y) ** 2 + (l.z / belly.r.z) ** 2;
    if (e < 1) worst = Math.max(worst, 1 - e);
  }
  return worst;  // -1 = no surface point inside the belly
}
for (const [name, sx, sz] of [['grunt', 1, 1], ['bruiser', 1.28, 1.22]]) {
  console.log(name, 'current', test(sx, sz, 0.17 * sz + 0.02, -0.25).toFixed(3));
  for (const rx of [-0.25, -0.35, -0.45]) for (let dz = 0; dz <= 0.08; dz += 0.005) { if (test(sx, sz, 0.17 * sz + 0.02 + dz, rx) < 0) { console.log(' rx', rx, 'clear at +dz', dz.toFixed(3)); break; } }
}
