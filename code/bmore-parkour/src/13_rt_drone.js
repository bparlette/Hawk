
// =====================================================================================================================================
// 13_rt_drone: FOXTROT, the police drone on your tail. It flies the course line behind you at a set pace; let it get close and its
// searchlight locks on (a meter fills) and you're BUSTED. Procedural model in the Toad City toon + ink style.
// =====================================================================================================================================
const DRN = (function () {
  const mat = toonMat(); const root = new THREE.Group(); root.userData.mat = mat;
  const body = grp(root); body.userData.mat = mat;
  part(body, G.sph(0.62, 0.24, 0.62, 12, 8), '#1d2540', 0, 0, 0);
  part(body, G.sph(0.34, 0.2, 0.34, 10, 6), '#2b375e', 0, 0.16, -0.05);
  part(body, G.box(0.5, 0.08, 0.16), '#f2ede2', 0, 0.02, 0.58, { outline: false }); // white nose band
  part(body, G.sph(0.14, 0.12, 0.14, 8, 6), '#14101f', 0, -0.2, 0.36); // camera ball
  const lens = part(body, G.sph(0.07, 0.07, 0.04, 8, 6), '#7fe8ff', 0, -0.21, 0.48, { outline: false });
  const rotors = [];
  for (const [x, z] of [[0.72, 0.72], [-0.72, 0.72], [0.72, -0.72], [-0.72, -0.72]]) {
    part(body, G.box(0.09, 0.06, 1.0), '#2b375e', x / 2, 0.02, z / 2, { rot: [0, Math.atan2(x, z), 0] });
    part(body, G.cyl(0.08, 0.1, 0.16, 8), '#14101f', x, 0.08, z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.02, 20), new THREE.MeshBasicMaterial({ color: '#c8d0e0', transparent: true, opacity: 0.32, depthWrite: false }));
    disc.position.set(x, 0.18, z); body.add(disc);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.015, 0.07), new THREE.MeshBasicMaterial({ color: '#14101f' })); blade.position.set(x, 0.19, z); body.add(blade); rotors.push(blade);
  }
  // light bar: red + blue, flashing (unlit)
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.12), new THREE.MeshBasicMaterial({ color: '#ff2a3a' })); red.position.set(0.15, 0.3, 0); body.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.12), new THREE.MeshBasicMaterial({ color: '#2a6aff' })); blue.position.set(-0.15, 0.3, 0); body.add(blue);
  // the searchlight: a soft additive cone + a pool of light on whatever it is pointed at
  const coneG = new THREE.ConeGeometry(1.6, 1, 24, 1, true); coneG.translate(0, -0.5, 0);
  const cone = new THREE.Mesh(coneG, new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  cone.renderOrder = 9; scene.add(cone);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 28), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  pool.rotation.x = -Math.PI / 2; pool.renderOrder = 8; scene.add(pool);
  root.scale.setScalar(1.25); scene.add(root);
  const D = { root, s: -10, v: 6, lock: 0, gap: 99, on: false, t: 0, wait: 2.5, pos: new THREE.Vector3(), path: null, idx: 0, target: new THREE.Vector3() };
  function pathAt(s) { const P = D.path; if (!P) return null; let i = D.idx; while (i < P.length - 2 && P[i + 1].s < s) i++; while (i > 0 && P[i].s > s) i--; D.idx = i; const a = P[i], b = P[Math.min(i + 1, P.length - 1)], t = clamp((s - a.s) / Math.max(1e-3, b.s - a.s), 0, 1);
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }; }
  function reset(course, s, v, wait) { D.path = course.path; D.idx = 0; D.s = s; D.v = v; D.lock = 0; D.on = true; D.wait = wait; D.t = 0; const p = pathAt(Math.max(0, s)); D.pos.set(p.x, p.y + 9, p.z); root.visible = true; }
  function hide() { D.on = false; root.visible = false; cone.visible = false; pool.visible = false; }
  // ps = the runner's course progress (m); hp = the runner's position
  function update(dt, ps, hp, active) {
    if (!D.on) return; D.t += dt;
    if (active) { if (D.wait > 0) D.wait -= dt; else { const gap = ps - D.s, v = D.v * (gap > 38 ? 1.7 : gap > 24 ? 1.25 : 1); D.s += v * dt; } }
    D.gap = ps - D.s;
    const p = pathAt(Math.max(-20, D.s)) || { x: hp.x, y: hp.y, z: hp.z }; const close = clamp(1 - (D.gap - 4) / 14, 0, 1);
    const tx = lerp(p.x, hp.x, close * 0.55), tz = lerp(p.z, hp.z, close * 0.55), ty = Math.max(p.y, hp.y) + lerp(8.5, 4.6, close) + Math.sin(D.t * 1.7) * 0.35;
    D.pos.x = damp(D.pos.x, tx + Math.sin(D.t * 0.9) * 1.2 * (1 - close), 3, dt); D.pos.y = damp(D.pos.y, ty, 2.5, dt); D.pos.z = damp(D.pos.z, tz, 3, dt);
    root.position.copy(D.pos);
    const dx = hp.x - D.pos.x, dz = hp.z - D.pos.z; root.rotation.y = damp(root.rotation.y, root.rotation.y + angTo(root.rotation.y, Math.atan2(dx, dz)), 5, dt);
    body.rotation.x = damp(body.rotation.x, clamp(D.v * 0.02 + close * 0.15, 0, 0.3), 3, dt); body.rotation.z = Math.sin(D.t * 1.3) * 0.05;
    for (const r of rotors) r.rotation.y += dt * 38;
    const fl = (D.t * 6) % 2 < 1; red.material.color.set(fl ? '#ff2a3a' : '#3a0a10'); blue.material.color.set(fl ? '#10204a' : '#2a6aff');
    // searchlight onto the runner when it is close, else onto the course ahead of it
    const aim = close > 0.05 ? hp : { x: p.x + Math.sin(root.rotation.y) * 6, y: p.y, z: p.z + Math.cos(root.rotation.y) * 6 };
    const v = new THREE.Vector3(aim.x - D.pos.x, aim.y - D.pos.y, aim.z - D.pos.z), L = v.length();
    cone.visible = pool.visible = true; cone.position.copy(D.pos); cone.scale.set(0.35 + close * 0.15, L, 0.35 + close * 0.15);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), v.normalize());
    cone.material.opacity = 0.06 + 0.12 * close + 0.1 * D.lock; pool.position.set(aim.x, aim.y + 0.05, aim.z); pool.material.opacity = 0.15 + 0.35 * close + 0.3 * D.lock;
    pool.scale.setScalar(0.8 + 0.4 * (1 - close));
    lens.material.color.set(D.lock > 0.05 ? (fl ? '#ff3d6e' : '#ffd23c') : '#7fe8ff');
  }
  return { D, update, reset, hide, pathAt };
})();
