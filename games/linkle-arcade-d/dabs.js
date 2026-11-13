// dabs.js — ATTEMPT C: the fountain's own construction, not an approximation of it.
//
// Attempt A drew each dab as a filled ragged ELLIPSE whose colour was a wide
// random jump (0.76–1.30×) from its neighbours — that is why the ground read as
// camouflage, the road as grey stepping-stones and the canopy as camo. The
// oil-paint plaza (Blendi's renderer, src/oilpaint/) never does that. Attempt C
// rebuilds the layer with the fountain's actual pieces:
//
//   * brush.js — the plaza's procedural brush sheet, copied verbatim: eight
//     bristle marks; R = paint height, G = where paint exists (dry-brush gaps
//     and furrows included), B = the slow second-colour streak along the
//     bristles. A stroke here is the brush mark itself, alpha and all — never
//     a filled ellipse.
//   * the dab fragment from src/oilpaint/dabs.js: discard where the brush has
//     no paint, c1→c2 mixed by the sheet's streak channel, and impasto rake
//     light from the height channel's gradient (light raking across the
//     stroke, warm where it catches). Output alpha feeds alpha-to-coverage
//     against the finish pass's MSAA target, exactly as the plaza does.
//   * colour the plaza way (paint3/jitter in src/oilpaint/common.js): each
//     surface owns light / half-tone / shade mixes; a dab takes ONE banded
//     mix with a small jitter (±5%), and its second colour is the same mix
//     lifted ×1.14 — the fountain's c2 rule. Neighbours therefore differ by a
//     step, not a leap: no confetti, no camo.
//   * stroke SHAPE the plaza way: elongated marks (across ≈ ⅓ of along),
//     lying flat on the surface (the plaza's `lie` dabs), pinned to world
//     points, running along the form — fall-line on hills, along-travel on
//     the road, strata on stone, one direction on water.
//   * stroke SCALE the plaza way: the fountain's ground marks are ~0.15 m
//     across × ~0.3 m along in a plaza seen from ~8 m. Scaled to this game's
//     chase camera (~8–10 m behind the hero), terrain strokes here are
//     ~0.9–1.5 m long near the course, growing only with distance band —
//     Attempt A used 3.6–12 m ovals, ten times too big, which is precisely
//     what made them read as blobs and puddles.
//
// Terrain stays chunked in 120 m z-bands drawn near the camera (DabField), so
// the density the fountain needs near the eye stays affordable.
import * as THREE from 'three';
import { createBrushSheet } from './brush.js';

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iNrm;
attribute vec2 iDir;
attribute vec2 iSize;
attribute vec3 iC1;
attribute vec3 iC2;
attribute float iSeed;
attribute float iCell;
varying vec2 vUv;
varying vec3 vC1;
varying vec3 vC2;
#include <fog_pars_vertex>
float dabHash(float n) { return fract(sin(n) * 43758.5453123); }
void main() {
  vC1 = iC1; vC2 = iC2;
  vec3 N = normalize(mat3(modelMatrix) * iNrm);
  vec3 d3 = vec3(iDir.x, 0.0, iDir.y);
  vec3 A = d3 - N * dot(d3, N);
  A = dot(A, A) > 1e-8 ? normalize(A) : normalize(cross(N, vec3(1.0, 0.0, 0.0)));
  vec3 B = cross(N, A);
  vec3 lp = iPos + A * (position.z * iSize.x) + B * (position.x * iSize.y);
  vec4 wp = modelMatrix * vec4(lp, 1.0);
  // the brush mark runs along +v of its sheet cell: u = across (quad x), v = along (quad z);
  // per-dab flips, as the fountain chooses them from the dab's own hash
  float flip = dabHash(iSeed * 3.17) > 0.5 ? -1.0 : 1.0;
  float endf = dabHash(iSeed * 7.71) > 0.5 ? -1.0 : 1.0;
  vec2 q = vec2(position.x * flip, position.z * endf) * 0.5 + 0.5;
  vUv = (vec2(mod(iCell, 4.0), floor(iCell / 4.0)) + q) / vec2(4.0, 2.0);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

// The plaza's dab fragment (src/oilpaint/dabs.js), kept line-for-line where the
// host allows: same discard, same streak mix, same rake. The host differences:
// GLSL1 style + fog chunks (this game's other materials are fogged), and no
// wanderer-glaze (this game has no figure shadow map to glaze with).
const FRAG = /* glsl */ `
uniform sampler2D tBrush;
uniform float uImpasto;
varying vec2 vUv;
varying vec3 vC1;
varying vec3 vC2;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(tBrush, vUv);
  if (t.g < 0.3) discard;
  vec2 e = vec2(1.5 / 512.0, 0.0);
  float hu = texture2D(tBrush, vUv + e.xy).r - texture2D(tBrush, vUv - e.xy).r;
  float hv = texture2D(tBrush, vUv + e.yx).r - texture2D(tBrush, vUv - e.yx).r;
  // the paint stands up off the canvas and the light rakes across it; the
  // stroke's screen axes here are its own across/along (vUv), so the rake is
  // taken in brush space — same gradient, same weights as the plaza.
  float rake = 0.5 * hu - 0.7 * hv;
  vec3 col = mix(vC1, vC2, smoothstep(0.52, 0.78, t.b));
  col *= mix(0.95, 1.04, t.r);
  col *= 1.0 + rake * 1.25 * uImpasto;
  col += vec3(1.0, 0.97, 0.9) * pow(max(rake, 0.0), 2.0) * 1.2 * uImpasto;
  gl_FragColor = vec4(col, smoothstep(0.3, 0.62, t.g));
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
    alphaToCoverage: true,
  });
  sharedMat.uniforms.tBrush = { value: createBrushSheet() };
  sharedMat.uniforms.uImpasto = { value: 1.0 };
  return sharedMat;
}

// the sheet's long-stroke cells only (kinds [0,0,0,2,1,1,0,2] — cells 4,5 are
// the pressed round dabs; round is what we are NOT doing)
const LONG_CELLS = [0, 1, 2, 3, 6, 7];
function cellFor(seed) {
  const h = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
  return LONG_CELLS[Math.floor(h * LONG_CELLS.length) % LONG_CELLS.length];
}

// items: [{ p:[x,y,z], n:[x,y,z], dir: angle (radians, XZ), len, wid, c1:Color, c2:Color, seed }]
export function buildDabMesh(items) {
  const n = items.length;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), dir = new Float32Array(n * 2),
    size = new Float32Array(n * 2), c1 = new Float32Array(n * 3), c2 = new Float32Array(n * 3),
    seed = new Float32Array(n), cell = new Float32Array(n);
  items.forEach((it, i) => {
    pos.set(it.p, i * 3); nrm.set(it.n, i * 3);
    dir[i * 2] = Math.sin(it.dir); dir[i * 2 + 1] = Math.cos(it.dir);
    size[i * 2] = it.len; size[i * 2 + 1] = it.wid;
    c1.set([it.c1.r, it.c1.g, it.c1.b], i * 3); c2.set([it.c2.r, it.c2.g, it.c2.b], i * 3);
    seed[i] = it.seed;
    cell[i] = cellFor(it.seed);
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
  geo.setAttribute('iCell', inst(cell, 1));
  geo.instanceCount = n;
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

// paint3, the fountain's way: a surface owns light / half-tone / shade mixes.
// One dab takes ONE band — shade on the form's dark side isn't knowable at
// scatter time, so bands are dealt 25 / 50 / 25 like the plaza's lit factor
// deals them — with the plaza's small jitter (0.45 hash jitter ≈ ±5% here),
// and c2 is the same mix lifted ×1.14, jittered again: the fountain's exact
// c2 = hazed(jitter(c * 1.14)) rule, minus the distance haze (fog does that).
// Attempt A multiplied each dab by a fresh 0.76–1.30 random — neighbouring
// strokes leapt in value and the field read as camouflage. Bands + small
// jitter keep neighbours neighbours.
export function tonePair(baseHex, inkHex, paperHex, R) {
  const base = new THREE.Color(baseHex);
  const ink = new THREE.Color(inkHex), paper = new THREE.Color(paperHex);
  const jit = (c, amt) => c.multiplyScalar(1 + (R() - 0.5) * 2 * amt);
  const c1 = base.clone();
  const band = R();
  if (band < 0.25) c1.lerp(ink, 0.38);            // shade mix
  else if (band > 0.75) c1.lerp(paper, 0.34);     // light mix
  // else: half-tone — the base itself
  jit(c1, 0.05);
  const c2 = jit(c1.clone().multiplyScalar(1.14), 0.04);
  return [c1, c2];
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
    len, wid: len * (o.widRatio ?? 0.34) * (0.85 + o.R() * 0.3),
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

// strokes over a sphere's surface (tree canopies, rocks, tank): elongated
// marks following a tangent direction, denser and narrower than Attempt A's
// round patches — the plaza paints crowns with small broken touches.
export function scatterSphere(cx, cy, cz, r, count, pal, R, squashY = 1) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const u = R() * 2 - 1, th = R() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const n = new THREE.Vector3(s * Math.cos(th), u * squashY, s * Math.sin(th)).normalize();
    const p = new THREE.Vector3(cx + n.x * r * 1.01, cy + (n.y * r * squashY) * 1.01, cz + n.z * r * 1.01);
    const [c1, c2] = tonePair(pal.base, pal.ink, pal.paper, R);
    const len = r * (0.38 + R() * 0.3);
    items.push({
      p: [p.x + n.x * 0.03, p.y + n.y * 0.03, p.z + n.z * 0.03],
      n: [n.x, n.y, n.z],
      dir: R() * Math.PI * 2,
      len, wid: len * 0.36,
      c1, c2, seed: R() * 100,
    });
  }
  return items;
}

// Surface palettes: base is the surface's OWN colour (the same hex the
// underpainting texture is built on), ink its shade mix, paper its light mix
// where the canvas shows through. Aligned with tex.js so a stroke sits in its
// surface's family instead of patching over it.
export const PAL = {
  grass: { base: 0x57a047, ink: 0x3f8434, paper: 0x8fd864 },
  grassDry: { base: 0x74a047, ink: 0x476b28, paper: 0xe6e2b0 },
  foliage: { base: 0x3e7d2e, ink: 0x27511d, paper: 0x9ccb7e },
  road: { base: 0x625f5c, ink: 0x3a3835, paper: 0x8f8a82 },
  stone: { base: 0xb8ab90, ink: 0x6f6450, paper: 0xe6dcc2 },
  rock: { base: 0x8d8d90, ink: 0x55555a, paper: 0xc9c9cd },
  foam: { base: 0xbfeef2, ink: 0x2f9db4, paper: 0xffffff },
  water: { base: 0x2f9db4, ink: 0x1f7f9c, paper: 0x9fe4ee },
  leaf: { base: 0x4da33c, ink: 0x2f7023, paper: 0xa8dd8e },
  gold: { base: 0xd9a92c, ink: 0x9c7414, paper: 0xf2cc52 },
  green: { base: 0x3f7a34, ink: 0x2c5a24, paper: 0x86c06e },
  shield: { base: 0x7a5230, ink: 0x54381e, paper: 0xb0824f },
};
