
// ---------------- wrecks, ruins, decor ----------------
function outlineMatInst(w, col = '#1a0f12') {
  return new THREE.ShaderMaterial({
    uniforms: { uW: { value: w }, uC: { value: new THREE.Color(col) }, uFogC: OUT_U.fogC, uFogN: OUT_U.fogN, uFogF: OUT_U.fogF },
    vertexShader: `attribute vec3 odir; uniform float uW; varying float vD;
      void main() { mat4 im = modelMatrix * instanceMatrix; vec4 wp = im * vec4(position, 1.0); vec3 wd = mat3(im) * odir;
        float L = length(wd); wd = L > 1e-5 ? wd / L * length(odir) : vec3(0.0);
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 3.0, 60.0);
        vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uC; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF; varying float vD;
      void main() { gl_FragColor = vec4(mix(uC, uFogC, smoothstep(uFogN, uFogF, vD)), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
}
const _wm = new THREE.Matrix4();
function placeParts(parts, x, z, yaw, extraRot, dy = 0) {
  _e.set(extraRot ? extraRot[0] : 0, yaw, extraRot ? extraRot[2] : 0); _q.setFromEuler(_e);
  _wm.compose(_v1.set(x, baseH(x, z) + dy, z), _q, _v2.set(1, 1, 1));
  for (const g of parts) g.applyMatrix4(_wm);
  return parts;
}
const RUSTS = ['#9c4b2e', '#7d5a45', '#b86b3c', '#6f7d7a', '#a3896a', '#5d6b78'];
function carParts(c) {
  return [
    P(GEO.box(1.9, 0.75, 4.3), c, [0, 0.75, 0], null, null, { jitter: 0.1 }),
    P(GEO.box(1.7, 0.65, 2.1), c, [0, 1.42, -0.25], null, [0.92, 1, 1]),
    P(GEO.box(1.55, 0.5, 2.15), '#2b2a33', [0, 1.45, -0.25]),
    P(GEO.box(1.95, 0.3, 0.3), '#4a3a33', [0, 0.55, 2.2]),
    P(GEO.cyl(0.42, 0.42, 0.3, 8), '#241c1c', [0.95, 0.42, 1.35], [0, 0, 1.57]),
    P(GEO.cyl(0.42, 0.42, 0.3, 8), '#241c1c', [-0.95, 0.42, -1.4], [0, 0, 1.57]),
    P(GEO.box(0.5, 0.06, 0.5), '#c9b089', [0.4, 1.76, 0.2], [0, 0.4, 0]),
  ];
}
function busParts() {
  const p = [P(GEO.box(2.6, 2.6, 10), '#d79a2b', [0, 1.7, 0], null, null, { jitter: 0.12 }), P(GEO.box(2.65, 0.25, 10.05), '#3a2c25', [0, 0.55, 0])];
  for (let z = -4; z <= 4; z += 1.6) for (const s of [-1, 1]) p.push(P(GEO.box(0.06, 0.9, 1.2), '#2b2a33', [s * 1.31, 2.25, z]));
  p.push(P(GEO.box(2.4, 1.0, 0.06), '#2b2a33', [0, 2.3, 5.02]));
  for (const z of [-3.2, 3.2]) for (const s of [-1, 1]) p.push(P(GEO.cyl(0.55, 0.55, 0.35, 8), '#241c1c', [s * 1.2, 0.55, z], [0, 0, 1.57]));
  return p;
}
function tankerParts() {
  return [
    P(GEO.cyl(1.35, 1.35, 7.5, 12), '#c9c2b4', [0, 1.9, -1.2], [1.57, 0, 0], null, { jitter: 0.08 }),
    P(GEO.box(2.6, 0.2, 7.6), '#3a2c25', [0, 0.6, -1.2]),
    P(GEO.box(2.3, 2.2, 2.2), '#a33a2a', [0, 1.6, 3.8]),
    P(GEO.box(2.0, 0.8, 0.06), '#2b2a33', [0, 2.2, 4.92]),
    P(GEO.box(2.75, 0.5, 0.8), '#ffcf2e', [0, 1.9, -1.2]),
  ];
}
function planeParts() {
  return [
    P(GEO.cyl(1.9, 1.7, 14, 10), '#c8ccd0', [0, 1.6, 0], [1.57, 0, 0.1], null, { jitter: 0.06 }),
    P(GEO.cone(1.9, 3.5, 10), '#b9bcc0', [0, 1.6, 8.6], [1.57, 0, 0]),
    P(GEO.box(13, 0.35, 3.2), '#b3b7ba', [3.2, 0.8, 1], [0, 0.2, -0.12]),
    P(GEO.box(0.3, 3.6, 2.6), '#b3b7ba', [0, 4.1, -6], [0.3, 0, 0]),
    P(GEO.box(0.32, 1.2, 1.6), '#c0392b', [0, 4.6, -6.3], [0.3, 0, 0]),
    P(GEO.cyl(0.7, 0.8, 2.6, 8), '#5a5f66', [5.5, 0.6, 1.8], [1.57, 0, 0]),
  ];
}
function tireStack(n) { const p = []; for (let i = 0; i < n; i++) p.push(P(GEO.tor(0.55, 0.26, 6, 12), '#26201f', [(i % 2) * 0.12, 0.26 + i * 0.5, 0], [1.57, 0, 0])); return p; }
(function buildWrecks() {
  const parts = [];
  SEED = 21;
  const CARS = [[-30, -50, 0.4], [25, -35, 2.1, 1], [-60, 10, 1.2], [55, -12, -0.6], [-22, 62, 2.6], [32, 78, 0.9, 1], [-82, -32, 1.9], [86, 32, -1.1], [-70, 122, 0.3], [75, 112, 2.0], [-128, -58, 1.0], [132, 44, 2.9, 1], [-28, -126, 1.4], [26, -100, -1.2], [-140, 10, 0.2], [52, -128, 0.7]];
  for (const [x, z, yaw, flip] of CARS) {
    const c = RUSTS[(srnd() * RUSTS.length) | 0];
    parts.push(...placeParts(carParts(c), x, z, yaw, flip ? [0, 0, Math.PI] : [srnd() * 0.1, 0, srnd() * 0.15], flip ? 2.1 : 0));
    addCol(x + Math.sin(yaw) * 1.2, z + Math.cos(yaw) * 1.2, 1.5); addCol(x - Math.sin(yaw) * 1.2, z - Math.cos(yaw) * 1.2, 1.5);
  }
  const BUSES = [[-46, -96, 0.8], [96, -98, -0.5], [-100, 102, 2.0], [-128, -120 + 30, 1.4]];
  for (const [x, z, yaw] of BUSES) {
    parts.push(...placeParts(busParts(), x, z, yaw, [0, 0, (srnd() - 0.5) * 0.2]));
    for (let k = -1; k <= 1; k++) addCol(x + Math.sin(yaw) * k * 3.4, z + Math.cos(yaw) * k * 3.4, 1.8);
  }
  parts.push(...placeParts(tankerParts(), 70, -75, 1.0, [0, 0, 0.08]));
  for (let k = -1; k <= 1; k++) addCol(70 + Math.sin(1.0) * (k * 3 + 0.4), -75 + Math.cos(1.0) * (k * 3 + 0.4), 1.8);
  parts.push(...placeParts(planeParts(), -92, -60 + 0, 2.6, [0, 0, 0.15], -0.6));
  for (let k = -2; k <= 2; k++) addCol(-92 + Math.sin(2.6) * k * 3.2, -60 + Math.cos(2.6) * k * 3.2, 2.1);
  const TIRES = [[-14, -60], [15, -66], [-12, 96], [14, 104], [-60, -110], [64, 64], [-90, 40], [100, -40], [40, -10], [-40, 30 + 20]];
  for (const [x, z] of TIRES) { parts.push(...placeParts(tireStack(2 + ((srnd() * 3) | 0)), x, z, 0)); addCol(x, z, 0.9); }
  // gas station ruin (original sign)
  const gs = [
    P(GEO.box(14, 0.4, 9), '#7d6a5b', [0, 5, 0]), P(GEO.box(0.6, 5, 0.6), '#8a8a8a', [-6, 2.5, -3.8]), P(GEO.box(0.6, 5, 0.6), '#8a8a8a', [6, 2.5, -3.8]),
    P(GEO.box(0.6, 5, 0.6), '#8a8a8a', [-6, 2.5, 3.8]), P(GEO.box(0.6, 3.2, 0.6), '#8a8a8a', [6, 1.6, 3.8], [0.3, 0, 0.2]),
    P(GEO.box(1, 1.8, 0.7), '#c0392b', [-2, 0.9, 0]), P(GEO.box(1, 1.8, 0.7), '#c0392b', [2, 0.9, 0], [0, 0, 0.5]),
    P(GEO.box(0.7, 12, 0.7), '#6b6b6b', [10, 6, 0]), P(GEO.box(5, 3.2, 0.5), '#ffcf2e', [10, 12.5, 0], [0, 0, 0.12]), P(GEO.box(4.4, 1.2, 0.56), '#c0392b', [10, 12.2, 0], [0, 0, 0.12]),
  ];
  parts.push(...placeParts(gs, -138, 46, 1.9));
  addCol(-138, 46, 4.5);
  // water tower
  const wt = [];
  for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) wt.push(P(GEO.box(0.4, 12, 0.4), '#6e4a37', [a, 6, b], [b * 0.03, 0, -a * 0.03]));
  wt.push(P(GEO.cyl(3.4, 3.4, 4.5, 10), '#b9875d', [0, 14, 0], null, null, { jitter: 0.08 }), P(GEO.cone(3.8, 2, 10), '#8f4e36', [0, 17.2, 0]));
  parts.push(...placeParts(wt, 128, 90, 0.3));
  addCol(128, 90, 3.4);
  // dead trees, skull piles, signs, pylons
  for (let i = 0; i < 26; i++) {
    const a = srnd() * TAU, r = 40 + srnd() * 110, x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (Math.abs(x) < 18 && z > -70 && z < 110) continue; if (Math.abs(z - TZ) < 15) continue;
    const t = [P(GEO.cyl(0.18, 0.3, 4, 6), '#4a3328', [0, 2, 0], [0.1, 0, 0.12])];
    for (let k = 0; k < 3; k++) t.push(P(GEO.cyl(0.06, 0.13, 2.2, 5), '#4a3328', [0, 2.2 + k * 0.6, 0], [0.9, k * 2.1, 0.2], null), );
    t[1].translate(0, 0, 0);
    parts.push(...placeParts(t, x, z, srnd() * 3));
  }
  for (let i = 0; i < 6; i++) {
    const x = -150 + i * 60, z = 150 - Math.abs(i - 2.5) * 6;
    const py = [P(GEO.box(0.5, 16, 0.5), '#5a5048', [0, 8, 0]), P(GEO.box(7, 0.4, 0.4), '#5a5048', [0, 15, 0]), P(GEO.box(0.4, 9, 0.4), '#5a5048', [1.6, 7, 0], [0, 0, 0.3]), P(GEO.box(0.4, 9, 0.4), '#5a5048', [-1.6, 7, 0], [0, 0, -0.3])];
    parts.push(...placeParts(py, x, z, 0.1));
  }
  const m = withOutline(merge(parts), propMat, OUT_PROP, scene); m.castShadow = true; m.receiveShadow = true;
})();

// ---------------- explosive fuel barrels (instanced, respawning) ----------------
const BARRELS = [];
const barrelGeo = merge([
  P(GEO.cyl(0.55, 0.55, 1.3, 12), '#d8342a'), P(GEO.cyl(0.58, 0.58, 0.12, 12), '#2a1d1a', [0, 0.4, 0]), P(GEO.cyl(0.58, 0.58, 0.12, 12), '#2a1d1a', [0, -0.4, 0]),
  P(GEO.box(0.5, 0.42, 0.05), '#ffcf2e', [0, 0, 0.55]),
]);
const barrelMesh = new THREE.InstancedMesh(barrelGeo, propMat, 24);
const barrelOl = new THREE.InstancedMesh(barrelGeo, outlineMatInst(0.0036), 24);
barrelOl.instanceMatrix = barrelMesh.instanceMatrix; barrelMesh.castShadow = true; barrelMesh.frustumCulled = barrelOl.frustumCulled = false;
scene.add(barrelMesh, barrelOl);
(function placeBarrels() {
  const SP = [[-8, -70], [9, -78], [-24, -30], [28, -50], [-50, 50], [48, 40], [-80, 60], [84, 60], [-12, 108], [14, 112], [-100, -80], [104, -60], [-66, -8], [70, 10], [0, -55], [-35, 130 - 20], [36, 128 - 18], [-130, 80], [128, -20], [0, 92]];
  SP.forEach(([x, z], i) => BARRELS.push({ x, z, alive: true, t: 0, i }));
  barrelMesh.count = barrelOl.count = BARRELS.length;
})();
function syncBarrel(b) {
  if (b.alive) { _q.setFromAxisAngle(_v3.set(0, 1, 0), b.i * 1.3); _m4.compose(_v1.set(b.x, hm(b.x, b.z) + 0.65, b.z), _q, _v2.set(1, 1, 1)); }
  else _m4.makeScale(0, 0, 0);
  barrelMesh.setMatrixAt(b.i, _m4); barrelMesh.instanceMatrix.needsUpdate = true;
}
BARRELS.forEach(syncBarrel);

// ---------------- extraction point: pad, radio mast, beam ----------------
const EXT = { open: false, t: 0 };
(function buildExtraction() {
  const parts = [];
  parts.push(P(GEO.cyl(EXTRACT.r, EXTRACT.r, 0.4, 24), '#4b4a4f', [0, 0.2, 0]));
  for (let i = 0; i < 12; i++) parts.push(P(GEO.box(1.6, 0.44, 1.0), (i & 1) ? '#ffcf2e' : '#2a1d1a', [Math.sin(i / 12 * TAU) * (EXTRACT.r - 0.6), 0.22, Math.cos(i / 12 * TAU) * (EXTRACT.r - 0.6)], [0, i / 12 * TAU, 0]));
  parts.push(P(GEO.box(5, 0.46, 1.1), '#f4efe2', [0, 0.23, 0]), P(GEO.box(1.1, 0.46, 5), '#f4efe2', [0, 0.23, 0]));
  // lattice mast behind the pad
  const mx = 0, mz = EXTRACT.r + 4;
  for (let y = 0; y < 26; y += 2) {
    const s = 1.4 - y * 0.035;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(P(GEO.box(0.22, 2.1, 0.22), '#c0392b', [mx + a * s, y + 1, mz + b * s]));
    parts.push(P(GEO.box(s * 2, 0.16, 0.16), (y / 2) & 1 ? '#f4efe2' : '#c0392b', [mx, y + 2, mz - s], [0, 0, 0.6]));
  }
  parts.push(P(GEO.sph(0.8, 0.8, 0.8), '#ffef9a', [mx, 27, mz]));
  placeParts(parts, EXTRACT.x, EXTRACT.z, 0);
  const m = withOutline(merge(parts), propMat, OUT_PROP, scene); m.castShadow = true; m.receiveShadow = true;
  addCol(EXTRACT.x + mx, EXTRACT.z + mz, 2);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#7dffb0', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(EXTRACT.r * 0.9, EXTRACT.r, 160, 24, 1, true), beamMat);
  beam.position.set(EXTRACT.x, baseH(EXTRACT.x, EXTRACT.z) + 80, EXTRACT.z); scene.add(beam);
  EXT.beam = beam; EXT.mat = beamMat;
  const ringMat = new THREE.MeshBasicMaterial({ color: '#7dffb0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(EXTRACT.r - 0.6, EXTRACT.r + 0.4, 40), ringMat); ring.rotation.x = -Math.PI / 2;
  ring.position.set(EXTRACT.x, baseH(EXTRACT.x, EXTRACT.z) + 0.5, EXTRACT.z); scene.add(ring); EXT.ring = ring; EXT.ringMat = ringMat;
})();
