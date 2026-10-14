
// ---------------- particles: two pooled Points systems (alpha + additive) ----------------
function makePS(n, additive) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('pcol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('psize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 }, uFogC: OUT_U.fogC, uFogN: OUT_U.fogN, uFogF: OUT_U.fogF },
    vertexShader: `attribute vec4 pcol; attribute float psize; uniform float uScale; varying vec4 vC; varying float vD;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vC = pcol; vD = -mv.z; gl_PointSize = psize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec4 vC; varying float vD; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
        ${additive ? 'float a = vC.a * smoothstep(0.5, 0.1, d); gl_FragColor = vec4(vC.rgb * a, a);' :
        'float a = vC.a * (d < 0.36 ? 1.0 : smoothstep(0.5, 0.36, d)); vec3 col = vC.rgb * (d > 0.3 ? 0.82 : 1.0); col = mix(col, uFogC, smoothstep(uFogN, uFogF, vD)); gl_FragColor = vec4(col, a);'}
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = additive ? 6 : 5; scene.add(pts);
  return { n, g, pos, col, size, mat, i: 0, x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n), vz: new Float32Array(n),
    life: new Float32Array(n), ml: new Float32Array(n), s0: new Float32Array(n), s1: new Float32Array(n), r: new Float32Array(n), gg: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n), grav: new Float32Array(n), drag: new Float32Array(n) };
}
const PS_A = makePS(1600, false), PS_X = makePS(1600, true);
const _pc = new THREE.Color();
function pEmit(S, x, y, z, vx, vy, vz, life, s0, s1, col, a, grav, drag) {
  const i = S.i; S.i = (S.i + 1) % S.n;
  S.x[i] = x; S.y[i] = y; S.z[i] = z; S.vx[i] = vx; S.vy[i] = vy; S.vz[i] = vz; S.life[i] = life; S.ml[i] = life; S.s0[i] = s0; S.s1[i] = s1;
  S.r[i] = col.r; S.gg[i] = col.g; S.b[i] = col.b; S.a[i] = a; S.grav[i] = grav; S.drag[i] = drag;
}
function psStep(S, dt) {
  for (let i = 0; i < S.n; i++) {
    if (S.life[i] <= 0) { if (S.size[i] !== 0) S.size[i] = 0; continue; }
    S.life[i] -= dt; const k = Math.exp(-S.drag[i] * dt);
    S.vx[i] *= k; S.vy[i] = S.vy[i] * k - S.grav[i] * dt; S.vz[i] *= k;
    S.x[i] += S.vx[i] * dt; S.y[i] += S.vy[i] * dt; S.z[i] += S.vz[i] * dt;
    const t = 1 - S.life[i] / S.ml[i];
    S.pos[i * 3] = S.x[i]; S.pos[i * 3 + 1] = S.y[i]; S.pos[i * 3 + 2] = S.z[i];
    S.size[i] = S.life[i] > 0 ? S.s0[i] + (S.s1[i] - S.s0[i]) * t : 0;
    S.col[i * 4] = S.r[i]; S.col[i * 4 + 1] = S.gg[i]; S.col[i * 4 + 2] = S.b[i]; S.col[i * 4 + 3] = S.a[i] * (1 - t * t);
  }
  S.g.attributes.position.needsUpdate = true; S.g.attributes.pcol.needsUpdate = true; S.g.attributes.psize.needsUpdate = true;
}
function psReset(S) { S.life.fill(0); S.size.fill(0); S.g.attributes.psize.needsUpdate = true; }
const C_BLOOD = new THREE.Color('#9e1b26'), C_BLOOD2 = new THREE.Color('#c4283a'), C_ACID = new THREE.Color('#a8d63a'), C_DUST = new THREE.Color('#e7c193'), C_SMOKE = new THREE.Color('#4a3f3c'), C_SMOKEL = new THREE.Color('#d9d2cc');
const C_FIRE = new THREE.Color('#ff8a1e'), C_FIRE2 = new THREE.Color('#ffd23c'), C_SPARK = new THREE.Color('#fff2a0'), C_NITRO = new THREE.Color('#4fc9ff'), C_HOT = new THREE.Color('#ff4a1a'), C_WHITE = new THREE.Color('#ffffff'), C_GREEN = new THREE.Color('#7dffb0');
function bloodBurst(x, y, z, vx, vz, n, acid) {
  for (let k = 0; k < n; k++) pEmit(PS_A, x, y + rnd(0.6, 1.5), z, vx * 0.3 + rnd(-4, 4), rnd(2, 7), vz * 0.3 + rnd(-4, 4), rnd(0.35, 0.7), rnd(0.25, 0.5), rnd(0.5, 0.9), acid ? C_ACID : (k & 1 ? C_BLOOD : C_BLOOD2), 1, 14, 1.5);
}
function sparkBurst(x, y, z, n, sp = 8) {
  for (let k = 0; k < n; k++) pEmit(PS_X, x, y, z, rnd(-sp, sp), rnd(1, sp * 1.1), rnd(-sp, sp), rnd(0.2, 0.45), rnd(0.14, 0.24), 0.04, C_SPARK, 1, 20, 2);
}
function explosionFx(x, y, z, r) {
  for (let k = 0; k < 40; k++) { const a = Math.random() * TAU, s = rnd(2, 10) * r / 6; pEmit(PS_X, x, y + 0.5, z, Math.cos(a) * s, rnd(2, 12), Math.sin(a) * s, rnd(0.35, 0.8), rnd(1.0, 2.0) * r / 6, rnd(2.5, 4.2) * r / 6, k & 1 ? C_FIRE : C_FIRE2, 1, -2, 2.5); }
  for (let k = 0; k < 22; k++) { const a = Math.random() * TAU, s = rnd(1, 6) * r / 6; pEmit(PS_A, x, y + 1, z, Math.cos(a) * s, rnd(2, 8), Math.sin(a) * s, rnd(1.0, 2.0), rnd(1.5, 2.5) * r / 6, rnd(4, 6) * r / 6, C_SMOKE, 0.85, -1.5, 1.2); }
  sparkBurst(x, y + 0.6, z, 24, 14);
  shockRing(x, z, r, '#ffd23c');
}
// expanding shock rings (pooled)
const RINGS = [];
for (let i = 0; i < 10; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23c', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  m.visible = false; m.renderOrder = 7; scene.add(m); RINGS.push({ m, t: 1, r: 1 });
}
let ringI = 0;
function shockRing(x, z, r, col) { const R = RINGS[ringI]; ringI = (ringI + 1) % RINGS.length; R.t = 0; R.r = r; R.m.material.color.set(col); R.m.position.set(x, hm(x, z) + 0.3, z); R.m.visible = true; }
function ringsStep(dt) { for (const R of RINGS) { if (!R.m.visible) continue; R.t += dt * 2.6; if (R.t >= 1) { R.m.visible = false; continue; } const s = R.r * (0.2 + R.t); R.m.scale.set(s, 1, s); R.m.material.opacity = 1 - R.t; } }

// ---------------- telegraphs (ground rings / lanes that fill before they hit) ----------------
const TELE = [];
const teleGeoC = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), teleGeoL = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
for (let i = 0; i < 12; i++) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uP: { value: 0 }, uMode: { value: 0 }, uT: { value: 0 } }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
    vertexShader: 'varying vec2 vU; void main(){ vU = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uP; uniform float uMode; uniform float uT; varying vec2 vU;
      void main(){ float f, edge;
        if (uMode < 0.5) { float r = length(vU); f = step(r, uP); edge = smoothstep(0.9, 0.96, r) * step(r, 1.0); }
        else { float u = vU.y; f = step(u, uP); edge = step(0.44, abs(vU.x)) + step(0.97, u); }
        float stripes = step(0.5, fract((vU.x + vU.y) * 3.0 - uT * 2.0));
        float a = clamp(edge * 0.95 + f * (0.32 + 0.12 * stripes) + 0.1, 0.0, 1.0);
        gl_FragColor = vec4(mix(vec3(1.0, 0.25, 0.15), vec3(1.0, 0.9, 0.3), edge * 0.4), a * 0.9);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(teleGeoC, mat); m.visible = false; m.renderOrder = 3; scene.add(m);
  TELE.push({ m, mat, t: 0, dur: 1, on: false, cb: null, kind: 0, x: 0, z: 0, r: 0, len: 0, yaw: 0, id: 0 });
}
let teleId = 0;
// kind 0 ring (x,z,r); kind 1 lane (x,z start, yaw, len, width). cb fires when it fills.
function teleSpawn(kind, x, z, r, dur, cb, yaw = 0, len = 0) {
  const T = TELE.find((t) => !t.on); if (!T) { cb && cb(); return null; }
  T.on = true; T.t = 0; T.dur = dur; T.cb = cb; T.kind = kind; T.x = x; T.z = z; T.r = r; T.yaw = yaw; T.len = len; T.id = ++teleId;
  T.m.geometry = kind ? teleGeoL : teleGeoC; T.mat.uniforms.uMode.value = kind;
  T.m.position.set(x, hm(x, z) + 0.25, z); T.m.rotation.set(0, yaw, 0);
  if (kind) T.m.scale.set(r, 1, len); else T.m.scale.set(r, 1, r);
  T.m.visible = true; return T;
}
function teleStep(dt) {
  for (const T of TELE) {
    if (!T.on) continue; T.t += dt; T.mat.uniforms.uP.value = Math.min(1, T.t / T.dur); T.mat.uniforms.uT.value += dt;
    if (T.kind === 0) T.m.position.y = hm(T.x, T.z) + 0.25;
    if (T.t >= T.dur) { T.on = false; T.m.visible = false; const cb = T.cb; T.cb = null; cb && cb(); }
  }
}
function teleReset() { for (const T of TELE) { T.on = false; T.m.visible = false; T.cb = null; } }

// ---------------- bullets / tracers (instanced) ----------------
const BN = 260;
const tracerMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 1.6), new THREE.MeshBasicMaterial({ color: '#ffe48a', fog: false }), BN);
tracerMesh.frustumCulled = false; tracerMesh.count = BN; scene.add(tracerMesh);
const BU = { x: new Float32Array(BN), y: new Float32Array(BN), z: new Float32Array(BN), vx: new Float32Array(BN), vy: new Float32Array(BN), vz: new Float32Array(BN), life: new Float32Array(BN), dmg: new Float32Array(BN), boom: new Uint8Array(BN), n: 0 };
for (let i = 0; i < BN; i++) { _m4.makeScale(0, 0, 0); tracerMesh.setMatrixAt(i, _m4); }

// ---------------- floating text (drawn on the HUD canvas) ----------------
const FT = []; for (let i = 0; i < 48; i++) FT.push({ on: false, x: 0, y: 0, z: 0, t: 0, txt: '', col: '#fff', size: 1 });
let ftI = 0;
function floatText(x, y, z, txt, col = '#fff', size = 1) { const f = FT[ftI]; ftI = (ftI + 1) % FT.length; f.on = true; f.x = x; f.y = y; f.z = z; f.t = 0; f.txt = txt; f.col = col; f.size = size; }
