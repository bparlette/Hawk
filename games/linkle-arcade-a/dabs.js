// dabs.js — the dab-BUILT layer: real instanced brush-stroke geometry lying on the
// world's surfaces (the fountain-plaza construction, adapted from the proven
// Kâğıt Kart dab-hard carpet). Each dab is a ragged-ellipse quad pinned to a
// surface point, aligned to the surface normal, its long axis along a stroke
// direction that follows the form, in two tones of the surface's own colour with
// a wide value step (0.76–1.30) — that step is what makes strokes read at
// phone size. Terrain is chunked in 120 m bands along z and only the bands
// near the camera are drawn.
import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iNrm;
attribute vec2 iDir;
attribute vec2 iSize;
attribute vec3 iC1;
attribute vec3 iC2;
attribute float iSeed;
varying vec2 vQ;
varying vec3 vC1;
varying vec3 vC2;
varying float vSeed;
#include <fog_pars_vertex>
void main() {
  vQ = vec2(position.x, position.z) * 2.0;
  vC1 = iC1; vC2 = iC2; vSeed = iSeed;
  vec3 N = normalize(mat3(modelMatrix) * iNrm);
  vec3 d3 = vec3(iDir.x, 0.0, iDir.y);
  vec3 A = d3 - N * dot(d3, N);
  A = dot(A, A) > 1e-8 ? normalize(A) : normalize(cross(N, vec3(1.0, 0.0, 0.0)));
  vec3 B = cross(N, A);
  vec3 lp = iPos + A * (position.z * iSize.x) + B * (position.x * iSize.y);
  vec4 wp = modelMatrix * vec4(lp, 1.0);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
varying vec2 vQ;
varying vec3 vC1;
varying vec3 vC2;
varying float vSeed;
#include <fog_pars_fragment>
float dabHash(float n) { return fract(sin(n) * 43758.5453123); }
void main() {
  float ang = atan(vQ.y, vQ.x);
  float chunk = floor((ang + 3.14159) / 6.28318 * 7.0);
  float rag = 0.90 + 0.18 * (dabHash(vSeed * 17.31 + chunk * 3.7) - 0.5);
  float d = length(vQ) / rag;
  if (d > 1.0) discard;
  float streak = clamp(0.5 + vQ.y * 0.55 + (dabHash(vSeed * 7.93) - 0.5) * 0.55, 0.0, 1.0);
  vec3 col = mix(vC1, vC2, streak * 0.50);
  col *= 1.0 + vQ.x * 0.09;                        // impasto: light raking across the stroke
  col *= 0.96 + 0.08 * dabHash(vSeed * 3.77);      // per-dab grain
  col *= 1.0 - 0.16 * smoothstep(0.70, 1.0, d);    // the rim where the brush lifted
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`;

let sharedMat = null;
function dabMaterial() {
  if (sharedMat) return sharedMat;
  sharedMat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    fog: true, side: THREE.DoubleSide,
  });
  return sharedMat;
}

// items: [{ p:Vector3-like [x,y,z], n:[x,y,z], dir: angle (radians, XZ), len, wid, c1:Color, c2:Color, seed }]
export function buildDabMesh(items) {
  const n = items.length;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), dir = new Float32Array(n * 2),
    size = new Float32Array(n * 2), c1 = new Float32Array(n * 3), c2 = new Float32Array(n * 3), seed = new Float32Array(n);
  items.forEach((it, i) => {
    pos.set(it.p, i * 3); nrm.set(it.n, i * 3);
    dir[i * 2] = Math.sin(it.dir); dir[i * 2 + 1] = Math.cos(it.dir);
    size[i * 2] = it.len; size[i * 2 + 1] = it.wid;
    c1.set([it.c1.r, it.c1.g, it.c1.b], i * 3); c2.set([it.c2.r, it.c2.g, it.c2.b], i * 3);
    seed[i] = it.seed;
  });
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const inst = (arr, sz) => new THREE.InstancedBufferAttribute(arr, sz);
  geo.setAttribute('iPos', inst(pos, 3));
  geo.setAttribute('iNrm', inst(nrm, 3));
  geo.setAttribute('iDir', inst(dir, 2));
  geo.setAttribute('iSize', inst(size, 2));
  geo.setAttribute('iC1', inst(c1, 3));
  geo.setAttribute('iC2', inst(c2, 3));
  geo.setAttribute('iSeed', inst(seed, 1));
  geo.instanceCount = n;
  // per-chunk bounds for frustum culling
  const c = new THREE.Vector3();
  items.forEach((it) => c.add(new THREE.Vector3(...it.p)));
  if (n) c.divideScalar(n);
  let r = 0;
  items.forEach((it) => { r = Math.max(r, Math.hypot(it.p[0] - c.x, it.p[1] - c.y, it.p[2] - c.z) + Math.max(it.len, it.wid)); });
  geo.boundingSphere = new THREE.Sphere(c, r);
  const mesh = new THREE.Mesh(geo, dabMaterial());
  mesh.frustumCulled = true;
  mesh.renderOrder = 1;
  return mesh;
}

// Chunked field for terrain: items bucketed by 120 m of z, drawn only near the camera.
export class DabField {
  constructor(parent) { this.parent = parent; this.chunks = []; this.byKey = new Map(); this.range = 430; }
  add(items) {
    for (const it of items) {
      const key = Math.floor(it.p[2] / 120);
      if (!this.byKey.has(key)) this.byKey.set(key, []);
      this.byKey.get(key).push(it);
    }
  }
  build() {
    for (const [key, items] of this.byKey) {
      const mesh = buildDabMesh(items);
      this.parent.add(mesh);
      this.chunks.push({ mesh, zc: key * 120 + 60, count: items.length });
    }
    this.byKey.clear();
    return this.chunks.reduce((s, c) => s + c.count, 0);
  }
  update(camZ) {
    for (const c of this.chunks) c.mesh.visible = Math.abs(c.zc - camZ) < this.range;
  }
}

/* ------------------------------ scatter helpers ------------------------------ */

const _c = new THREE.Color(), _c2 = new THREE.Color();
// KK tone(): one dab's mix of the surface colour — wide value step, sometimes a
// lean to the ink (deep patch) or the paper (dry brush).
export function tonePair(baseHex, inkHex, paperHex, R) {
  const base = new THREE.Color(baseHex);
  const ink = new THREE.Color(inkHex), paper = new THREE.Color(paperHex);
  const one = (out) => {
    out.copy(base);
    const r = R();
    out.multiplyScalar(0.76 + R() * 0.54);
    if (r < 0.16) out.lerp(ink, 0.22);
    else if (r > 0.90) out.lerp(paper, 0.24);
    return out;
  };
  return [one(new THREE.Color()), one(new THREE.Color())];
}

export function surfNormal(hFn, x, z, e = 0.9) {
  const dx = hFn(x + e, z) - hFn(x - e, z);
  const dz = hFn(x, z + e) - hFn(x, z - e);
  const n = new THREE.Vector3(-dx / (2 * e), 1, -dz / (2 * e));
  return n.normalize();
}

function dabAt(o, x, z, len) {
  const y = o.hFn(x, z);
  const n = surfNormal(o.hFn, x, z);
  const [c1, c2] = tonePair(o.pal.base, o.pal.ink, o.pal.paper, o.R);
  const lift = o.lift ?? 0.03;
  return {
    p: [x + n.x * lift, y + n.y * lift, z + n.z * lift],
    n: [n.x, n.y, n.z],
    dir: o.dirFn(x, z, o.R),
    len, wid: len * (o.widRatio ?? 0.5) * (0.8 + o.R() * 0.4),
    c1, c2, seed: o.R() * 100,
  };
}

// Banded scatter over a heightfield: each band is its own jittered grid with
// its own spacing, so dense-near / sparse-far stays predictable in count.
// o: { hFn, z0, z1, bands: [{x0, x1, spacing, len:[a,b] | fn(x,z)}],
//      dirFn, pal, R, skip?, lift?, gap? }
export function scatterBands(o) {
  const items = [];
  for (const b of o.bands) {
    let row = 0;
    for (let z = o.z0; z > o.z1; z -= b.spacing * 0.92, row++) {
      for (let x = b.x0 + (row % 2) * b.spacing * 0.5; x < b.x1; x += b.spacing) {
        const jx = x + (o.R() - 0.5) * b.spacing * 0.7, jz = z + (o.R() - 0.5) * b.spacing * 0.7;
        if (o.skip && o.skip(jx, jz)) continue;
        if (o.R() < (o.gap ?? 0.08)) continue;
        const len = typeof b.len === 'function' ? b.len(jx, jz) : b.len[0] + o.R() * (b.len[1] - b.len[0]);
        items.push(dabAt(o, jx, jz, len));
      }
    }
  }
  return items;
}

// Corridor scatter: bands are lateral ranges around a curving centerline.
// o: { frame(z, lat) -> [x, z], hFn(x, z), z0, z1,
//      bands: [{lat0, lat1, spacing, len:[a,b]}], dirFn, pal, R, skip?, lift?, gap? }
export function scatterCorridor(o) {
  const items = [];
  for (const b of o.bands) {
    let row = 0;
    for (let z = o.z0; z > o.z1; z -= b.spacing * 0.92, row++) {
      for (let lat = b.lat0 + (row % 2) * b.spacing * 0.5; lat < b.lat1; lat += b.spacing) {
        const jz = z + (o.R() - 0.5) * b.spacing * 0.7;
        const jl = lat + (o.R() - 0.5) * b.spacing * 0.7;
        const [jx, jzz] = o.frame(jz, jl);
        if (o.skip && o.skip(jx, jzz)) continue;
        if (o.R() < (o.gap ?? 0.08)) continue;
        const len = b.len[0] + o.R() * (b.len[1] - b.len[0]);
        items.push(dabAt(o, jx, jzz, len));
      }
    }
  }
  return items;
}

// dabs over a sphere's surface (tree canopies, rocks, tank): dir = random tangent.
export function scatterSphere(cx, cy, cz, r, count, pal, R, squashY = 1) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const u = R() * 2 - 1, th = R() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const n = new THREE.Vector3(s * Math.cos(th), u * squashY, s * Math.sin(th)).normalize();
    const p = new THREE.Vector3(cx + n.x * r * 1.01, cy + (n.y * r * squashY) * 1.01, cz + n.z * r * 1.01);
    const [c1, c2] = tonePair(pal.base, pal.ink, pal.paper, R);
    const len = r * (0.55 + R() * 0.5);
    items.push({
      p: [p.x + n.x * 0.03, p.y + n.y * 0.03, p.z + n.z * 0.03],
      n: [n.x, n.y, n.z],
      dir: R() * Math.PI * 2,
      len, wid: len * 0.55,
      c1, c2, seed: R() * 100,
    });
  }
  return items;
}

export const PAL = {
  grass: { base: 0x4f9440, ink: 0x2c5c25, paper: 0xcfe0a4 },
  grassDry: { base: 0x74a047, ink: 0x476b28, paper: 0xe6e2b0 },
  foliage: { base: 0x3e7d2e, ink: 0x27511d, paper: 0x9ccb7e },
  road: { base: 0x625f5c, ink: 0x3a3835, paper: 0xa8a49c },
  stone: { base: 0xb8ab90, ink: 0x6f6450, paper: 0xe6dcc2 },
  rock: { base: 0x8d8d90, ink: 0x55555a, paper: 0xc9c9cd },
  foam: { base: 0xbfeef2, ink: 0x2f9db4, paper: 0xffffff },
  water: { base: 0x2f9db4, ink: 0x1f7f9c, paper: 0x9fe4ee },
  leaf: { base: 0x4da33c, ink: 0x2f7023, paper: 0xa8dd8e },
  gold: { base: 0xd9a92c, ink: 0x9c7414, paper: 0xf2cc52 },
  green: { base: 0x3f7a34, ink: 0x2c5a24, paper: 0x86c06e },
  shield: { base: 0x7a5230, ink: 0x54381e, paper: 0xb0824f },
};
