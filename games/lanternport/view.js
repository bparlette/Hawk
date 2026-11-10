// Lanternport view: everything you see, built in code from primitives and the procedural materials in fx.js.
// Reads the simulation, never changes it. `kit` = { toon, glowMat, part, ink, T (textures) }.
import { EDGE, N, ROAD, WALK, PITCH, roadAt, VEHICLES } from './sim.js';

export const U = 0.01;                       // simulation units -> metres
const ANG = (Math.PI * 2) / 0x10000;
const PLASTER = [0xf6e7c8, 0xf2c9a4, 0xcfe0ee, 0xd3e6c4, 0xefc9d6];
const ROOFS = [0xc8553a, 0x3c8f8a, 0x77529c, 0xd9922e];
const SHUTTER = [0x3f6b5c, 0x8a3b32, 0x2f4f7a, 0x6b4a2e];
const CLOTHES = [0xd95f5f, 0x4f97d6, 0x6fbf6f, 0xe6aa3c, 0xa67fd6, 0x8d6e63];
const WOOD = 0x5a3b2a, LIT = [3.4, 2.2, 0.85], DARK = [0.2, 0.34, 0.6];

// ------------------------------------------------------------------------------------------------ city
export function buildCityView(THREE, city, kit) {
  const { toon, glowMat, T } = kit, root = new THREE.Group();
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), C = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
  /** Instanced mesh from [x,y,z, sx,sy,sz, color(hex | [r,g,b] linear), rotY] rows. */
  const inst = (geo, mat, list, cast = true, receive = true) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((e, i) => { Q.setFromAxisAngle(UP, e[7] || 0); M.compose(P.set(e[0], e[1], e[2]), Q, S.set(e[3], e[4], e[5])); im.setMatrixAt(i, M); if (e[6] !== undefined) im.setColorAt(i, Array.isArray(e[6]) ? C.setRGB(...e[6]) : C.setHex(e[6])); });
    im.castShadow = cast; im.receiveShadow = receive; im.frustumCulled = false; root.add(im); return im;
  };
  let seed = city.seed * 7919 + 1; const R = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const unit = new THREE.BoxGeometry(1, 1, 1), plane = new THREE.PlaneGeometry(1, 1), ball = new THREE.SphereGeometry(1, 10, 8);
  const awnGeo = new THREE.BoxGeometry(1, 1, 1); { const p = awnGeo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0) p.setY(i, p.getY(i) * 0.2 - 0.55); awnGeo.computeVertexNormals(); }
  const L = { wall: [], base: [], beam: [], roof: [], frame: [], pane: [], sill: [], shut: [], door: [], step: [], awn: [], sign: [], bloom: [], brick: [], crate: [], barrel: [], lantern: [], rampart: [], crenel: [] };
  const glows = [];                                   // warm light halos: [x,y,z]
  const rp = [], rn = [], ruv = [], rc = [];          // merged mansard roofs
  const quad = (a, b, c, d, col, uA, uB, vTop) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
    let v = [a, b, c, a, c, d], uv = [[uA, 0], [uB, 0], [uB, vTop], [uA, 0], [uB, vTop], [uA, vTop]];
    if (n.y < 0) { n.negate(); v = [a, c, b, a, d, c]; uv = [[uA, 0], [uB, vTop], [uB, 0], [uA, 0], [uA, vTop], [uB, vTop]]; }
    v.forEach((p, i) => { rp.push(p.x, p.y, p.z); rn.push(n.x, n.y, n.z); ruv.push(...uv[i]); rc.push(col.r, col.g, col.b); });
  };
  let k = 0;
  for (const b of city.boxes) {
    const w = (b.x1 - b.x0) * U, h = (b.y1 - b.y0) * U, d = (b.z1 - b.z0) * U, cx = ((b.x0 + b.x1) / 2) * U, cz = ((b.z0 + b.z1) / 2) * U;
    if (b.kind === 'trunk') continue;
    if (b.kind === 'crate') {
      L.crate.push([cx, h / 2, cz, w, h, d, 0xd9a25e]);
      for (const s of [-1, 1]) { L.beam.push([cx + s * (w / 2 - 0.06), h / 2, cz, 0.14, h + 0.04, d + 0.04]); L.beam.push([cx, h / 2 + s * (h / 2 - 0.06), cz, w + 0.04, 0.14, d + 0.04]); }
      L.barrel.push([cx + w / 2 + 0.45, 0.5, cz + (R() - 0.5) * 0.6, 0.38, 1.0, 0.38, 0xb07a45]); continue;
    }
    if (b.kind === 'rampart') {
      L.rampart.push([cx, h / 2, cz, w, h, d]); const alongX = w > d, len = alongX ? w : d;
      for (let t = -len / 2 + 1; t < len / 2; t += 2.6) L.crenel.push([alongX ? cx + t : cx, h + 0.55, alongX ? cz : cz + t, alongX ? 1.4 : w, 1.1, alongX ? d : 1.4]);
      continue;
    }
    if (b.kind === 'fountain' || b.kind === 'stall' || b.kind === 'windmill') continue; // pass 3: built as set pieces below
    if (b.kind === 'barrel') { L.barrel.push([cx, h / 2, cz, 0.8, h, 0.8, 0xa8763e]); continue; }
    // ---- a house
    const tall = h >= 7.5, top = tall ? h - 2.2 : h, tint = PLASTER[b.hue], roofC = ROOFS[b.roof], shutC = SHUTTER[(b.roof + b.hue) % 4];
    L.wall.push([cx, top / 2, cz, w, top, d, tint]); L.base.push([cx, 0.45, cz, w + 0.16, 0.9, d + 0.16]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.beam.push([cx + sx * (w / 2 - 0.05), top / 2, cz + sz * (d / 2 - 0.05), 0.3, top, 0.3]);
    for (let y = 3.5; y < top - 1.2; y += 2.9) L.beam.push([cx, y, cz, w + 0.14, 0.22, d + 0.14]);
    if (tall) {
      L.beam.push([cx, top - 0.13, cz, w + 0.56, 0.28, d + 0.56]);
      const o = 0.3, s = 1.0, x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, V = (x, y, z) => new THREE.Vector3(x, y, z), col = new THREE.Color(roofC), topC = new THREE.Color(roofC).multiplyScalar(0.6);
      const B = [V(x0 - o, top, z0 - o), V(x1 + o, top, z0 - o), V(x1 + o, top, z1 + o), V(x0 - o, top, z1 + o)], Tp = [V(x0 + s, h, z0 + s), V(x1 - s, h, z0 + s), V(x1 - s, h, z1 - s), V(x0 + s, h, z1 - s)];
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, len = B[i].distanceTo(B[j]); quad(B[i], B[j], Tp[j], Tp[i], col, 0, len / 1.5, 2.2); }
      quad(Tp[0], Tp[1], Tp[2], Tp[3], topC, 0, w / 1.5, d / 1.5);
    } else L.roof.push([cx, h - 0.1, cz, w + 0.5, 0.22, d + 0.5, roofC]);
    if (h > 3) { const qx = cx + (k % 2 ? 1 : -1) * (w / 2 - 1.7), qz = cz + (k % 3 ? 1 : -1) * (d / 2 - 1.7); L.brick.push([qx, h + 0.55, qz, 0.75, 1.1, 0.75, 0xa85a42]); L.beam.push([qx, h + 1.15, qz, 0.95, 0.14, 0.95]); }
    const faces = [[0, 0, 1, w, d], [Math.PI, 0, -1, w, d], [Math.PI / 2, 1, 0, d, w], [-Math.PI / 2, -1, 0, d, w]]; // rotY, normal x/z, span, depth
    faces.forEach(([rot, nx, nz, span, depth], f) => {
      const tx = nz, tz = -nx; // tangent along the wall
      const put = (list, t, y, out, sx, sy, sz, color) => list.push([cx + tx * t + nx * (depth / 2 + out), y, cz + tz * t + nz * (depth / 2 + out), sx, sy, sz, color, rot]);
      const doorFace = f === k % 4 && h > 3, shop = doorFace && k % 2 === 0 && span > 9.5;
      const nWin = Math.max(1, Math.floor((span - 1.6) / 2.7));
      for (let y = 2.0; y < top - 1.0; y += 2.9) for (let i = 0; i < nWin; i++) {
        const t = (i - (nWin - 1) / 2) * 2.7;
        if (y < 3 && doorFace && Math.abs(t) < (shop ? 4.6 : 1.9)) continue;
        put(L.frame, t, y, 0.02, 1.2, 1.6, 0.16, 0xf1e6d2); put(L.pane, t, y, 0.11, 0.98, 1.38, 1, R() < 0.3 ? LIT : DARK);
        put(L.sill, t, y - 0.86, 0.1, 1.4, 0.1, 0.34); for (const s of [-1, 1]) put(L.shut, t + s * 0.83, y, 0.04, 0.42, 1.5, 0.08, shutC);
        if (R() < 0.3 && y > 3) { put(L.crate, t, y - 0.7, 0.3, 1.15, 0.24, 0.3, 0x9a6a3f); for (let q = -1; q <= 1; q++) put(L.bloom, t + q * 0.36, y - 0.5, 0.3, 0.2, 0.17, 0.2, [0xff7aa8, 0xffd04a, 0xffffff, 0x6fbf5a, 0x6fbf5a][Math.floor(R() * 5)]); }
      }
      if (doorFace) {
        put(L.beam, 0, 1.3, 0.02, 1.6, 2.6, 0.2); put(L.door, 0, 1.18, 0.1, 1.15, 2.3, 0.1, [0x7a4a30, 0x2f5f7f, 0x9a3f36, 0x3f6b5c][k % 4]); put(L.step, 0, 0.08, 0.3, 2.0, 0.16, 0.7);
        put(L.lantern, 1.05, 2.45, 0.22, 0.22, 0.32, 0.22); glows.push([cx + tx * 1.05 + nx * (depth / 2 + 0.3), 2.45, cz + tz * 1.05 + nz * (depth / 2 + 0.3)]);
        if (shop) {
          for (const s of [-1, 1]) { put(L.frame, s * 2.75, 1.75, 0.02, 2.6, 2.0, 0.18, 0xf1e6d2); put(L.pane, s * 2.75, 1.75, 0.12, 2.36, 1.76, 1, LIT); }
          put(L.awn, 0, 3.25, 0.75, Math.min(span - 1, 8.4), 0.75, 1.5, roofC); put(L.sign, -span / 2 + 1.4, 4.1, 0.55, 0.1, 0.7, 1.0, shutC); put(L.beam, -span / 2 + 1.4, 4.5, 0.55, 0.06, 0.06, 1.1);
        }
      }
    });
    k++;
  }
  const wood = toon(WOOD, { map: T.wood, uv: 0.6, rim: 0.3 });
  inst(unit, toon(0xffffff, { map: T.plaster, uv: 0.22, ao: true }), L.wall); inst(unit, toon(0xb8ab9c, { map: T.stone, uv: 0.5, ao: true }), L.base, false);
  inst(unit, wood, L.beam); inst(unit, toon(0xffffff, { map: T.tiles, uv: 1.1 }), L.roof); inst(unit, toon(0xffffff, { map: T.stone, uv: 1.2 }), L.brick);
  inst(unit, toon(0xffffff), L.frame, false); inst(plane, glowMat(0xffffff, { map: T.glass }), L.pane, false, false); inst(unit, toon(0xcfc6b8), L.sill, false);
  inst(unit, toon(0xffffff, { map: T.wood }), L.shut, false); inst(unit, toon(0xffffff, { map: T.wood }), L.door, false); inst(unit, toon(0xb8ab9c, { map: T.stone, uv: 0.8 }), L.step, false);
  inst(awnGeo, toon(0xffffff, { map: T.stripes }), L.awn); inst(unit, toon(0xffffff), L.sign); inst(ball, toon(0xffffff), L.bloom, false);
  inst(unit, toon(0xffffff, { map: T.wood, uv: 0.9 }), L.crate); inst(new THREE.CylinderGeometry(0.9, 1, 1, 12), toon(0xffffff, { map: T.wood }), L.barrel);
  inst(unit, glowMat(new THREE.Color(3.2, 2.2, 0.8)), L.lantern, false, false);
  inst(unit, toon(0xc9c0b4, { map: T.stone, uv: 0.3, ao: true }), L.rampart); inst(unit, toon(0xc9c0b4, { map: T.stone, uv: 0.3 }), L.crenel);
  if (rp.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(rn, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(ruv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
    const m = new THREE.Mesh(g, toon(0xffffff, { map: T.tiles, vertexColors: true })); m.castShadow = m.receiveShadow = true; root.add(m);
  }
  // corner towers on the ramparts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (EDGE + 150) * U, z = sz * (EDGE + 150) * U, st = T.stone.clone(), tl = T.tiles.clone(); st.repeat.set(10, 6); tl.repeat.set(12, 3);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.2, 24, 20), toon(0xc9c0b4, { map: st, ao: true })); t.position.set(x, 12, z); t.castShadow = t.receiveShadow = true; root.add(t);
    const c = new THREE.Mesh(new THREE.ConeGeometry(8, 9, 20), toon(ROOFS[(sx + sz + 2) % 4], { map: tl })); c.position.set(x, 28.5, z); c.castShadow = true; root.add(c);
  }

  // ---- ground: cobbled streets, paved walks, lawns with real grass
  const E = EDGE * U, street = new THREE.Mesh(new THREE.BoxGeometry(E * 2 + 8, 0.4, E * 2 + 8), toon(0xd6c6ae, { map: T.cobble, uv: 0.52, rim: 0 })); street.position.y = -0.2; street.receiveShadow = true; root.add(street);
  const pave = [], lawn = [], posts = [], arms = [], heads = [], flags = [], lines = [], blades = [], petals = [];
  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, -0.034, 0.5, 0, 0.034, 0.5, 0, 0, 1, 0], 3));
  grassGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  grassGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 0.5, 1, 0.5, 0.5, 1], 2));
  { const a = new THREE.Color(0x2f5e1e), c = new THREE.Color(0x6fa838), e = new THREE.Color(0xb7dc5a); grassGeo.setAttribute('color', new THREE.Float32BufferAttribute([a.r, a.g, a.b, a.r, a.g, a.b, c.r, c.g, c.b, c.r, c.g, c.b, e.r, e.g, e.b], 3)); }
  grassGeo.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 2, 1, 0, 3, 1, 2, 4, 3, 2]);
  for (const b of city.blocks) {
    const w = (b.x1 - b.x0) * U, d = (b.z1 - b.z0) * U, cx = ((b.x0 + b.x1) / 2) * U, cz = ((b.z0 + b.z1) / 2) * U, green = b.kind === 'plaza' || b.kind === 'hideout' || b.kind === 'docks';
    pave.push([cx, 0.025, cz, w, 0.05, d, 0xe9dcc6]);
    if (green) {
      const gw = w - WALK * U * 1.2, gd = d - WALK * U * 1.2; lawn.push([cx, 0.035, cz, gw, 0.07, gd]);
      const n = Math.floor(gw * gd * 16);
      for (let i = 0; i < n; i++) { const x = cx + (R() - 0.5) * gw, z = cz + (R() - 0.5) * gd, s = 0.3 + R() * R() * 0.6, v = 0.8 + R() * 0.4; blades.push([x, 0.06, z, 1 + R(), s, 1, [v, v * (0.95 + R() * 0.1), v * 0.9], R() * 6.28]); }
      for (let i = 0; i < 260; i++) petals.push([cx + (R() - 0.5) * gw, 0.3 + R() * 0.25, cz + (R() - 0.5) * gd, 0.07, 0.05, 0.07, [0xffffff, 0xffe066, 0xff8fb3, 0xb69cff][Math.floor(R() * 4)]]);
    }
    const lampAt = (fx, fz) => { // street lamps (positions only — no view RNG)
      const x = (b.x0 + 45 + fx * (b.x1 - b.x0 - 90)) * U, z = (b.z0 + 45 + fz * (b.z1 - b.z0 - 90)) * U, ox = fx === 0 ? -1 : fx === 1 ? 1 : 0, oz = ox ? 0 : fz === 0 ? -1 : 1;
      posts.push([x, 2.1, z, 0.13, 4.2, 0.13]); posts.push([x, 0.25, z, 0.3, 0.5, 0.3]); arms.push([x + ox * 0.35, 4.15, z + oz * 0.35, ox ? 0.8 : 0.07, 0.07, oz ? 0.8 : 0.07]);
      heads.push([x + ox * 0.7, 3.85, z + oz * 0.7, 0.3, 0.42, 0.3]); posts.push([x + ox * 0.7, 4.1, z + oz * 0.7, 0.4, 0.06, 0.4]); glows.push([x + ox * 0.7, 3.85, z + oz * 0.7]);
    };
    for (const [fx, fz] of [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]) lampAt(fx, fz);
    if (b.i >= 2 && b.i <= 3 && b.j >= 2 && b.j <= 3) for (const [fx, fz] of [[0.25, 0], [0.75, 0], [0.25, 1], [0.75, 1]]) lampAt(fx, fz); // pass 3: the town centre glows denser
  }
  // bunting strung across the streets between poles
  const FLAGS = [0xe2573f, 0xf2b23a, 0x3fa7a0, 0xf4ead8, 0x7d5bb5, 0x5aa9e6], half = (ROAD / 2 + WALK - 20) * U;
  for (let i = 1; i < N; i++) for (let j = 0; j < N; j++) for (const f of [0.3, 0.7]) for (const alongZ of [true, false]) {
    const a = roadAt(i) * U, t = (roadAt(j) + PITCH * f) * U, n = 15;
    for (const s of [-1, 1]) lines.push(alongZ ? [a + s * half, 3.2, t, 0.1, 6.4, 0.1] : [t, 3.2, a + s * half, 0.1, 6.4, 0.1]);
    for (let q = 0; q <= n; q++) {
      const u = q / n, off = (u - 0.5) * 2 * half, y = 6.25 - Math.sin(u * Math.PI) * 1.1;
      if (q && q < n) flags.push(alongZ ? [a + off, y, t, 1, 1, 1, FLAGS[(q + i + j) % 6], 0] : [t, y, a + off, 1, 1, 1, FLAGS[(q + i * 2 + j) % 6], Math.PI / 2]);
      if (q < n) { const u2 = (q + 0.5) / n, o2 = (u2 - 0.5) * 2 * half, y2 = 6.27 - Math.sin(u2 * Math.PI) * 1.1; lines.push(alongZ ? [a + o2, y2, t, (2 * half) / n + 0.05, 0.03, 0.03] : [t, y2, a + o2, 0.03, 0.03, (2 * half) / n + 0.05]); }
    }
  }
  const flagGeo = new THREE.BufferGeometry(); flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.24, 0, 0, 0.24, 0, 0, 0, -0.5, 0, 0.24, 0, 0, -0.24, 0, 0, 0, -0.5, 0], 3));
  flagGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0.6, 0.8, 0, 0.6, 0.8, 0, 0.6, 0.8, 0, 0.6, 0.8, 0, 0.6, 0.8, 0, 0.6, 0.8], 3)); flagGeo.setAttribute('uv', new THREE.Float32BufferAttribute(12, 2));
  inst(unit, toon(0xffffff, { map: T.paver, uv: 0.45, rim: 0 }), pave, false); inst(unit, toon(0x5f9a3a, { map: T.plaster, uv: 0.06, rim: 0 }), lawn, false);
  inst(grassGeo, toon(0xffffff, { vertexColors: true, wind: 'grass', rim: 0 }), blades, false); inst(ball, toon(0xffffff), petals, false, false);
  const iron = toon(0x2e2a38, { rim: 0.8 }); inst(unit, iron, posts); inst(unit, iron, arms, false); inst(unit, glowMat(new THREE.Color(2.2, 1.5, 0.6)), heads, false, false); inst(unit, iron, lines, false, false);
  inst(flagGeo, toon(0xffffff, { wind: 'flag', rim: 0.2 }), flags, false, false);
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(glows.flat(), 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ map: T.glow, size: 1.7, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.0, 0.6, 0.22) })); p.frustumCulled = false; root.add(p); }

  // ---- trees: lumpy layered canopies
  const lump = new THREE.SphereGeometry(1, 14, 10); { const p = lump.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), s = 1 + 0.13 * Math.sin(x * 5.1 + y * 3.3) * Math.cos(z * 4.7 + y * 2.1) + 0.07 * Math.sin(z * 9.0 + x * 7.0); p.setXYZ(i, x * s, y * s, z * s); } lump.computeVertexNormals(); }
  const trunks = [], leaves = [], LEAF = [0x2f6b2a, 0x3f8a34, 0x5aa83e, 0x86c44a];
  city.trees.forEach((t, i) => {
    const x = t.x * U, z = t.z * U, s = t.s; trunks.push([x, 2.0, z, 0.5, 4.0, 0.5, 0x6b4a33]);
    for (const [dx, dy, dz, r, c] of [[0, 4.3, 0, 2.5, 0], [1.5, 4.8, 0.6, 1.9, 1], [-1.3, 4.9, -0.9, 2.0, 1], [0.3, 5.9, -0.4, 2.0, 2], [-0.6, 5.4, 1.3, 1.7, 2], [0.5, 6.8, 0.3, 1.4, 3]])
      leaves.push([x + dx * s, dy * (0.85 + s * 0.15), z + dz * s, r * s, r * s * 0.82, r * s, LEAF[c], i * 1.7 + dx]);
  });
  inst(new THREE.CylinderGeometry(0.55, 1, 1, 10), toon(0xffffff, { map: T.wood }), trunks); inst(lump, toon(0xffffff, { rim: 0.9 }), leaves);

  // ---- pass 3 set pieces: gold-triangle emblem, plaza fountain, market stalls, windmill, tall grass
  const gold = toon(0xf2b23a, { rim: 1.3, side: THREE.DoubleSide });
  const triGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.42, -0.3), new THREE.Vector2(0.42, -0.3), new THREE.Vector2(0, 0.44)]));
  const emblem = (s = 1) => { const g = new THREE.Group(); for (const [tx, ty] of [[0, 0.52], [-0.46, -0.34], [0.46, -0.34]]) { const m = new THREE.Mesh(triGeo, gold); m.position.set(tx * s, ty * s, 0); m.scale.setScalar(s); g.add(m); } return g; };
  if (city.fountain) {
    const g = new THREE.Group(); g.position.set(city.fountain.x * U, 0, city.fountain.z * U); root.add(g);
    const stone = toon(0xc9c0b4, { map: T.stone, uv: 0.5, ao: true });
    kit.part(g, new THREE.CylinderGeometry(3.8, 4.05, 1.3, 24), stone, 0, 0.65, 0, 0);
    const rim = kit.part(g, new THREE.TorusGeometry(3.8, 0.17, 8, 28), stone, 0, 1.32, 0, 0); rim.rotation.x = Math.PI / 2;
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.5, 24), glowMat(new THREE.Color(0.4, 0.8, 1.15))); water.rotation.x = -Math.PI / 2; water.position.y = 1.36; g.add(water);
    kit.part(g, new THREE.CylinderGeometry(0.85, 1.05, 3.9, 12), stone, 0, 2.95, 0, 0);
    kit.part(g, new THREE.CylinderGeometry(1.7, 1.1, 0.35, 16), stone, 0, 5.0, 0, 0);
    kit.part(g, new THREE.SphereGeometry(0.42, 12, 10), gold, 0, 5.55, 0, 0.03);
    for (const a of [0, Math.PI]) { const e = emblem(1.05); e.position.set(Math.sin(a) * 1.02, 3.1, Math.cos(a) * 1.02); e.rotation.y = a; g.add(e); }
  }
  for (const s of city.stalls || []) {
    const g = new THREE.Group(); g.position.set(s.x * U, 0, s.z * U); g.rotation.y = s.face > 0 ? 0 : Math.PI; root.add(g);
    const woodM = toon(WOOD, { map: T.wood, uv: 0.6, rim: 0.3 });
    kit.part(g, new THREE.BoxGeometry(5.6, 1.05, 1.1), woodM, 0, 0.55, 0.85, 0.03);            // counter
    kit.part(g, new THREE.BoxGeometry(5.6, 0.85, 0.7), woodM, 0, 0.45, -1.05, 0.03);          // back shelf
    for (const px of [-2.6, 2.6]) for (const pz of [-1.35, 1.35]) kit.part(g, new THREE.BoxGeometry(0.18, 2.5, 0.18), woodM, px, 1.25, pz, 0.012);
    const awn = kit.part(g, awnGeo, toon(ROOFS[s.hue % 4], { map: T.stripes, rim: 0.4 }), 0, 2.85, 0, 0); awn.scale.set(6.0, 0.85, 3.9);
    kit.part(g, new THREE.BoxGeometry(1.7, 0.55, 0.08), toon(0xf1e6d2, { rim: 0.4 }), 0, 2.05, 1.45, 0.012); // sign board
    const e = emblem(0.5); e.position.set(0, 2.62, 1.98); g.add(e);
    for (let q = 0; q < 5; q++) kit.part(g, ball, toon([0xff7aa8, 0xffd04a, 0x6fbf5a, 0x5aa9e6, 0xe2573f][q], { rim: 0.5 }), -1.9 + q * 0.95, 1.22, 0.85, 0.008).scale.setScalar(0.19); // goods on the counter
    kit.part(g, new THREE.BoxGeometry(0.9, 0.9, 0.9), toon(0xd9a25e, { map: T.wood, uv: 0.9 }), 3.35, 0.45, 0.7, 0.025);
  }
  if (city.windmill) {
    const g = new THREE.Group(); g.position.set(city.windmill.x * U, 0, city.windmill.z * U); root.add(g);
    kit.part(g, new THREE.CylinderGeometry(1.55, 2.25, 15, 14), toon(0xc9c0b4, { map: T.stone, uv: 0.3, ao: true }), 0, 7.5, 0, 0.05);
    kit.part(g, new THREE.ConeGeometry(2.5, 2.8, 14), toon(ROOFS[0], { map: T.tiles, uv: 1.1 }), 0, 16.4, 0, 0.04);
    kit.part(g, new THREE.BoxGeometry(0.9, 1.6, 0.12), toon(0x7a4a30, { map: T.wood }), 1.35, 0.8, 1.35, 0.015).rotation.y = Math.PI / 4;
    const e = emblem(0.85); e.position.set(1.28, 10.5, 1.28); e.rotation.y = Math.PI / 4; g.add(e);
    const rotor = new THREE.Group(); rotor.position.set(1.9, 13.6, 1.9); rotor.rotation.y = Math.PI / 4; g.add(rotor); // faces the town centre, spins on local z
    kit.part(rotor, new THREE.SphereGeometry(0.42, 10, 8), toon(0x7a4a30, { rim: 0.6 }), 0, 0, 0.2, 0.02);
    for (let q = 0; q < 4; q++) { const bl = kit.part(rotor, new THREE.BoxGeometry(0.62, 4.4, 0.07), toon(0xf4ead8, { rim: 0.4 }), 0, 2.35, 0.2, 0.012), hold = new THREE.Group(); hold.rotation.z = q * Math.PI / 2; rotor.add(hold); hold.add(bl); bl.position.set(0, 2.35, 0.2); }
    root.userData.rotor = rotor;
  }
  if (city.grassPatches && city.grassPatches.length) { // interactive tall grass: one instanced mesh, per-patch height
    const rows = [], ranges = [];
    for (const p of city.grassPatches) {
      const start = rows.length, n = Math.floor(Math.PI * p.r * p.r * U * U * 7);
      for (let i = 0; i < n; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * p.r * U * 0.96, s = (0.55 + R() * R() * 0.75) * 1.9, v = 0.9 + R() * 0.35; rows.push([p.x * U + Math.cos(a) * d, 0.06, p.z * U + Math.sin(a) * d, 1 + R(), s, 1, [v * 1.02, v, v * 0.78], R() * 6.28]); }
      ranges.push([start, rows.length]);
    }
    const im = inst(grassGeo, toon(0xffffff, { vertexColors: true, wind: 'grass', rim: 0 }), rows, false);
    const last = new Array(ranges.length).fill(1);
    root.userData.grassCtl = { set(pi, s) { if (Math.abs(s - last[pi]) < 0.02) return; last[pi] = s; const f = 0.16 + 0.84 * s, [a, b] = ranges[pi]; for (let i = a; i < b; i++) { const e = rows[i]; Q.setFromAxisAngle(UP, e[7] || 0); M.compose(P.set(e[0], e[1], e[2]), Q, S.set(e[3], e[4] * f, e[5])); im.setMatrixAt(i, M); } im.instanceMatrix.needsUpdate = true; } };
  }
  return root;
}

// ------------------------------------------------------------------------------------------------ heroes
const POSES = { // [pitch, squash, arms up, tuck]
  idle: [0, 1, 0, 0], walk: [0.14, 1, 0, 0], crawl: [1.2, 0.8, 0, 0.3], crouch: [0.5, 0.65, 0, 0.5], crouchSlide: [0.6, 0.62, 0, 0.5],
  jump: [0.05, 1.07, 0.7, 0], doubleJump: [0.1, 1.1, 1, 0], wallKick: [-0.2, 1.07, 0.8, 0], freefall: [0.1, 1.03, 0.5, 0], longJump: [1.0, 0.9, 1, 0.2],
  dive: [1.45, 0.95, 1, 0], bellySlide: [1.5, 0.8, 1, 0], jumpKick: [-0.5, 1, 0.3, 0], groundPound: [0, 0.75, 0, 1], poundLand: [0, 0.55, 0, 0.6],
  ledgeGrab: [-0.1, 1.12, 1, 0], ledgeClimbFast: [0.6, 0.9, 0.6, 0.4], ledgeClimbSlow: [0.6, 0.9, 0.6, 0.4], brake: [-0.35, 0.95, 0.3, 0], turnAround: [-0.45, 0.95, 0.4, 0],
  softBonk: [-0.6, 1, 0.6, 0], airKnockback: [-1, 1, 0.8, 0], knockdown: [-1.5, 0.8, 0.5, 0], groundBonk: [-1.5, 0.8, 0.5, 0], bellyStop: [1.3, 0.8, 0.3, 0], seat: [-0.12, 0.8, 0.25, 0.9],
};
const SPINS = { tripleJump: [1, 2, 35], backflip: [-1, 1, 31], sideFlip: [1, 1, 31], rollout: [1, 1, 15] };
export const LOOKS = [
  { coat: 0x3da35d, trim: 0xf2b23a, hair: 0xeec25a, skin: 0xf6c9a0, legs: 0xefe6d0, cap: true, pointedEars: true, gear: true, iris: 0x2f6fd0 }, // Juniper
  { coat: 0x178f8a, trim: 0xf06a4a, hair: 0x2b2838, skin: 0xc98f62, legs: 0x4a3b34, goggles: true }, // Fen
];
const lathe = (THREE, pts, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/** An original courier hero: long flared coat, big scarf, satchel. Built from primitives, posed procedurally. */
export class HeroView {
  constructor(THREE, kit, look) {
    const { part, toon, glowMat } = kit; this.THREE = THREE;
    const g = (this.group = new THREE.Group()), tilt = (this.tilt = new THREE.Group()), body = (this.body = new THREE.Group()); g.add(tilt); tilt.add(body);
    const coat = toon(look.coat, { rim: 0.9, gradientMap: kit.rampSoft, emissive: look.coat, emissiveIntensity: 0.35 }), skin = toon(look.skin, { rim: 0.7 }), trim = toon(look.trim, { rim: 0.8 }), hairM = toon(look.hair, { rim: 1.0 });
    part(body, lathe(THREE, [[0, 0.44], [0.35, 0.42], [0.37, 0.44], [0.3, 0.6], [0.215, 0.82], [0.2, 0.9], [0.215, 1.08], [0.15, 1.22], [0, 1.24]]), coat); // profile runs bottom-to-top: a descending profile flips the lathe normals and the coat shades near-black (pass-3 fix)
    part(body, new THREE.TorusGeometry(0.212, 0.035, 8, 20), toon(0x4a3326), 0, 0.86, 0, 0).rotation.x = Math.PI / 2;                 // belt
    part(body, new THREE.BoxGeometry(0.09, 0.09, 0.05), trim, 0, 0.86, 0.22, 0);                                                    // buckle
    part(body, new THREE.TorusGeometry(0.365, 0.022, 6, 24), trim, 0, 0.44, 0, 0).rotation.x = Math.PI / 2;                          // hem
    const strap = part(body, new THREE.TorusGeometry(0.27, 0.022, 6, 24), toon(0x6b4a33), 0, 1.0, 0, 0); strap.rotation.set(Math.PI / 2, 0.75, 0); strap.scale.set(1, 0.82, 1);
    part(body, new THREE.BoxGeometry(0.22, 0.24, 0.13), toon(0x9a6a3f, { map: kit.T.wood }), -0.3, 0.72, 0.03); part(body, new THREE.BoxGeometry(0.23, 0.1, 0.14), toon(0x6b4a33), -0.3, 0.81, 0.03, 0);
    this.head = part(body, new THREE.SphereGeometry(0.285, 24, 18), skin, 0, 1.47, 0.02); this.head.scale.set(1, 1.04, 0.97);
    const hair = part(this.head, new THREE.SphereGeometry(0.305, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM, 0, 0.03, -0.035); hair.rotation.x = -0.38;
    for (const [x, r] of [[-0.15, 0.5], [0, 0.1], [0.14, -0.45]]) { const f = part(this.head, new THREE.ConeGeometry(0.09, 0.2, 8), hairM, x, 0.22, 0.2, 0.012); f.rotation.set(2.5, 0, r); }
    for (const s of [-1, 1]) {
      if (look.pointedEars) { const ear = part(this.head, new THREE.ConeGeometry(0.052, 0.34, 8), skin, 0.35 * s, 0.09, -0.01, 0); ear.rotation.set(-0.18, 0, -1.12 * s); ear.scale.set(1, 1, 0.55); } // long pointed ear
      else part(this.head, new THREE.SphereGeometry(0.06, 10, 8), skin, 0.275 * s, 0.0, 0.0, 0).scale.set(0.5, 1, 0.8);                               // ear
      part(this.head, new THREE.SphereGeometry(0.058, 12, 10), glowMat(0xf6f2ea), 0.105 * s, 0.015, 0.243, 0).scale.set(1, 1.25, 0.5);           // eye white
      part(this.head, new THREE.SphereGeometry(0.04, 12, 10), glowMat(look.iris || (look.goggles ? 0x3a2a1c : 0x2f5f4f)), 0.105 * s, 0.01, 0.262, 0).scale.set(1, 1.25, 0.5);
      part(this.head, new THREE.SphereGeometry(0.013, 6, 6), glowMat(0xffffff), 0.118 * s, 0.035, 0.283, 0);
      part(this.head, new THREE.BoxGeometry(0.085, 0.018, 0.02), hairM, 0.105 * s, 0.105, 0.262, 0).rotation.z = -0.18 * s;                       // brow
      part(this.head, new THREE.SphereGeometry(0.05, 8, 6), toon(0xff8f7a), 0.185 * s, -0.075, 0.2, 0).scale.set(1, 0.55, 0.4);                  // blush
    }
    part(this.head, new THREE.SphereGeometry(0.03, 8, 6), skin, 0, -0.035, 0.282, 0); part(this.head, new THREE.BoxGeometry(0.07, 0.014, 0.02), glowMat(0x7a3b33), 0, -0.115, 0.262, 0);
    if (look.tail) { this.tail = new THREE.Group(); this.tail.position.set(0, 0.1, -0.27); this.head.add(this.tail); part(this.tail, new THREE.SphereGeometry(0.07, 8, 6), trim, 0, 0, 0, 0); const c = part(this.tail, new THREE.ConeGeometry(0.105, 0.55, 10), hairM, 0, -0.26, -0.06); c.rotation.x = Math.PI + 0.25; }
    if (look.goggles) {
      for (const s of [-1, 1]) { const r = part(this.head, new THREE.TorusGeometry(0.068, 0.022, 8, 16), toon(0xe0b04a), 0.1 * s, 0.2, 0.2, 0); r.rotation.x = -0.5; const l = part(this.head, new THREE.CircleGeometry(0.06, 14), glowMat(new THREE.Color(0.6, 1.3, 1.5)), 0.1 * s, 0.2, 0.205, 0); l.rotation.x = -0.5; }
      part(this.head, new THREE.TorusGeometry(0.292, 0.02, 6, 24), toon(0x3a2a1c), 0, 0.17, 0, 0).rotation.x = Math.PI / 2 - 0.12;
    }
    if (look.cap) { const cap = part(this.head, new THREE.ConeGeometry(0.27, 0.78, 14), coat, 0, -0.04, -0.36, 0); cap.rotation.x = -2.08; } // long pointed cap, base buried in the hair, tip trailing to mid-back
    const sc = part(body, new THREE.TorusGeometry(0.19, 0.09, 10, 20), trim, 0, 1.24, 0.01); sc.rotation.x = Math.PI / 2; sc.scale.set(1, 1, 0.9);
    this.scarf = new THREE.Group(); this.scarf.position.set(0.12, 1.24, -0.18); body.add(this.scarf);
    if (!look.cap) { part(this.scarf, new THREE.BoxGeometry(0.15, 0.05, 0.62), trim, 0, 0, -0.3); part(this.scarf, new THREE.BoxGeometry(0.13, 0.05, 0.46), trim, -0.14, -0.03, -0.22).rotation.y = 0.3; }
    this.scarf.visible = !look.cap;
    if (look.gear) {
      const steel = toon(0x8296ad, { rim: 1.1 });
      const srim = part(body, new THREE.CylinderGeometry(0.185, 0.15, 0.032, 14), trim, 0, 1.02, -0.295, 0); srim.rotation.x = Math.PI / 2 + 0.1;   // shield gold rim
      const sface = part(body, new THREE.CylinderGeometry(0.168, 0.134, 0.05, 14), steel, 0, 1.02, -0.305, 0); sface.rotation.x = Math.PI / 2 + 0.1; // shield steel face
      part(body, new THREE.SphereGeometry(0.05, 10, 8), trim, 0, 1.02, -0.335, 0).scale.set(1, 1, 0.5);                                            // shield boss
      const sword = new THREE.Group(); sword.position.set(0.13, 1.12, -0.375); sword.rotation.z = -0.55; body.add(sword);
      part(sword, new THREE.BoxGeometry(0.055, 0.6, 0.016), toon(0xc3d2e0, { rim: 1.3 }), 0, -0.05, 0, 0);                                          // blade
      part(sword, new THREE.BoxGeometry(0.2, 0.045, 0.05), trim, 0, 0.27, 0, 0);                                                                     // crossguard
      part(sword, new THREE.CylinderGeometry(0.028, 0.028, 0.14, 8), toon(0x2f4fa0), 0, 0.36, 0, 0);                                                // grip
      part(sword, new THREE.SphereGeometry(0.045, 8, 8), trim, 0, 0.45, 0, 0);                                                                       // pommel
    }
    this.arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.255 * s, 1.12, 0); body.add(p); part(p, new THREE.CapsuleGeometry(0.068, 0.3, 6, 10), coat, 0.03 * s, -0.2, 0); part(p, new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), trim, 0.03 * s, -0.38, 0, 0); part(p, new THREE.SphereGeometry(0.07, 10, 8), skin, 0.03 * s, -0.46, 0); return p; });
    this.legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.11 * s, 0.5, 0); body.add(p); part(p, new THREE.CapsuleGeometry(0.075, 0.24, 6, 10), toon(look.legs), 0, -0.2, 0); const bt = part(p, new THREE.CapsuleGeometry(0.085, 0.13, 6, 10), toon(0x4a2f22, { rim: 0.8 }), 0, -0.43, 0.05); bt.rotation.x = Math.PI / 2; part(p, new THREE.CylinderGeometry(0.095, 0.085, 0.1, 10), toon(0x4a2f22), 0, -0.33, 0, 0); return p; });
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: 0x120c20, transparent: true, opacity: 0.4, depthWrite: false })); this.shadow.rotation.x = -Math.PI / 2;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(look.trim).multiplyScalar(2.2), transparent: true, opacity: 0.9, depthWrite: false })); this.ring.rotation.x = -Math.PI / 2;
    this.prev = null; this.cur = [0, 0, 0]; this.prevYaw = 0; this.curYaw = 0; this.stride = 0; this.pose = [0, 1, 0, 0]; this.spinT = 0; this.spinAction = '';
    this.position = new THREE.Vector3(); this.yawRad = 0; this.speed = 0;
  }
  /** Call once per simulation tick. */
  snapshot(h) {
    const v = h.vehicle, m = h.ctrl;
    const seat = v ? (v.kind === 'skiff' ? [-10, 50] : [95, 62]) : null; // sit up front where the camera can see the driver
    const cur = v ? [v.x + Math.sin(v.yaw) * seat[0], seat[1], v.z + Math.cos(v.yaw) * seat[0]] : [m.pos[0], m.pos[1], m.pos[2]], yaw = v ? v.yaw / ANG : m.yaw;
    this.prev = this.cur; this.prevYaw = this.curYaw; this.cur = cur; this.curYaw = yaw;
    if (Math.hypot(cur[0] - this.prev[0], cur[1] - this.prev[1], cur[2] - this.prev[2]) > 600) { this.prev = cur; this.prevYaw = yaw; }
    if (!v) { if (SPINS[m.action]) { if (this.spinAction !== m.action) this.spinT = 0; this.spinT++; } this.spinAction = m.action; this.stride += Math.abs(m.fvel) * 0.05; }
  }
  update(h, alpha, dt, t, active) {
    const v = h.vehicle, m = h.ctrl, L = (a, b) => a + (b - a) * alpha;
    this.position.set(L(this.prev[0], this.cur[0]) * U, L(this.prev[1], this.cur[1]) * U, L(this.prev[2], this.cur[2]) * U);
    const dy = this.curYaw - this.prevYaw; this.yawRad = (this.prevYaw + Math.atan2(Math.sin(dy * ANG), Math.cos(dy * ANG)) / ANG * alpha) * ANG;
    this.group.position.copy(this.position); this.group.rotation.y = this.yawRad;
    const floorY = v ? 0 : m.floorY * U, drop = Math.max(0, this.position.y - floorY);
    this.shadow.visible = !v && drop > 0.05; this.shadow.position.set(this.position.x, floorY + 0.08, this.position.z); this.shadow.scale.setScalar(Math.max(0.35, 1 - drop * 0.08));
    this.ring.visible = active && !v; this.ring.position.set(this.position.x, floorY + 0.09, this.position.z); this.ring.material.opacity = 0.55 + Math.sin(t * 4) * 0.25;
    const act = v ? 'seat' : m.action, air = !v && m.airborne, target = POSES[act] || (air ? POSES.jump : POSES.idle), k = Math.min(1, dt * 14);
    for (let i = 0; i < 4; i++) this.pose[i] += (target[i] - this.pose[i]) * k;
    let pitch = this.pose[0]; const spin = !v && SPINS[m.action];
    if (spin) pitch += spin[0] * Math.min(1, (this.spinT + alpha) / spin[2]) * spin[1] * Math.PI * 2;
    if (!v && m.action === 'groundPound' && m.state === 0) pitch += Math.min(1, (m.timer + alpha) / 10) * Math.PI * 2;
    this.tilt.position.y = 0.8; this.body.position.y = -0.8; this.tilt.rotation.x = pitch;
    const stretch = air ? 1 + Math.max(-0.12, Math.min(0.14, m.vel[1] * 0.0022)) : 1, sy = this.pose[1] * stretch, sxz = 1 / Math.sqrt(Math.max(0.3, sy));
    this.body.scale.set(sxz, sy, sxz);
    const fv = v ? 0 : Math.abs(m.fvel), moving = !air && fv > 0.5, swing = moving ? Math.sin(this.stride) : 0, tuck = this.pose[3], up = this.pose[2];
    this.legs[0].rotation.x = swing * 1.0 - tuck * 1.3; this.legs[1].rotation.x = -swing * 1.0 - tuck * 1.3;
    this.arms[0].rotation.x = -swing * 0.9 - up * 2.6; this.arms[1].rotation.x = swing * 0.9 - up * 2.6; this.arms[0].rotation.z = -up * 0.4 - 0.1; this.arms[1].rotation.z = up * 0.4 + 0.1;
    const wind = Math.min(1, (v ? Math.abs(v.fwd) : fv) / 30);
    this.scarf.rotation.x = -0.95 + wind * 0.9 + Math.sin(t * (5 + wind * 11)) * (0.07 + wind * 0.13); this.scarf.rotation.y = Math.sin(t * 4.3) * 0.22;
    if (this.tail) this.tail.rotation.x = -0.25 + wind * 0.9 + Math.sin(t * 9) * 0.1 * (0.2 + wind);
    this.head.position.y = 1.47 + (moving ? Math.abs(Math.sin(this.stride)) * 0.03 : Math.sin(t * 1.7) * 0.012); this.head.rotation.y = moving || v ? 0 : Math.sin(t * 0.5) * 0.25;
    this.speed = v ? Math.abs(v.fwd) : fv;
  }
}

// ------------------------------------------------------------------------------------------------ vehicles & folk
export function makeVehicle(THREE, kit, v) {
  const { part, toon, glowMat, T } = kit, g = new THREE.Group(), b = new THREE.Group(); g.add(b); g.userData.body = b;
  const rune = v.kind === 'wagon' ? new THREE.Color(2.6, 1.3, 0.3) : v.kind === 'tithe' ? new THREE.Color(2.4, 0.9, 2.2) : new THREE.Color(0.5, 2.2, 2.6), r = VEHICLES[v.kind].r * U;
  const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 1.05, 28), new THREE.MeshBasicMaterial({ map: T.glow, color: rune.clone().multiplyScalar(0.45), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.09; g.add(glow); g.userData.glow = glow;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.62, 0.05, 8, 32), glowMat(rune)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; b.add(ring); g.userData.ring = ring;
  const lamp = (x, y, z, c = new THREE.Color(3.4, 2.3, 0.9)) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), glowMat(c)); m.position.set(x, y, z); b.add(m); part(b, new THREE.CylinderGeometry(0.16, 0.16, 0.05, 8), toon(0x2e2a38), x, y + 0.15, z, 0); return m; };
  const woodM = (c) => toon(c, { map: T.wood, rim: 0.6 }), brass = toon(0xd9a441, { rim: 1.2 });
  if (v.kind === 'cart') {
    const cloth = v.tag === 'baker' ? 0xf4ead8 : CLOTHES[v.id % 5];
    part(b, new THREE.BoxGeometry(1.7, 0.55, 2.7), woodM(0xc08a52), 0, 0.75, 0); part(b, new THREE.BoxGeometry(1.84, 0.1, 2.84), woodM(0x6b4a33), 0, 1.05, 0, 0); part(b, new THREE.BoxGeometry(1.84, 0.1, 2.84), woodM(0x6b4a33), 0, 0.5, 0, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(b, new THREE.BoxGeometry(0.12, 0.7, 0.12), brass, sx * 0.86, 0.78, sz * 1.36, 0);
    const top = part(b, new THREE.CylinderGeometry(0.86, 0.86, 1.5, 16, 1, false, 0, Math.PI), toon(cloth, { map: T.stripes, side: THREE.DoubleSide }), 0, 1.1, -0.6, 0); top.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    for (const z of [-1.33, 0.13]) part(b, new THREE.TorusGeometry(0.87, 0.035, 6, 16, Math.PI), woodM(0x6b4a33), 0, 1.1, z, 0);
    part(b, new THREE.BoxGeometry(1.5, 0.3, 0.1), woodM(0x6b4a33), 0, 1.2, 1.32); lamp(0.62, 1.42, 1.3); lamp(-0.62, 1.42, 1.3);
    if (v.tag === 'baker') for (let i = 0; i < 3; i++) part(b, new THREE.SphereGeometry(0.2, 10, 8), toon(0xd9963f, { rim: 1 }), -0.4 + i * 0.4, 1.22, 0.75).scale.set(1, 0.7, 1.5);
  } else if (v.kind === 'skiff') {
    part(b, new THREE.SphereGeometry(1, 24, 16), toon(0x23a89c, { rim: 1.2 }), 0, 0.75, 0).scale.set(0.82, 0.36, 1.9); part(b, new THREE.SphereGeometry(1, 20, 12), toon(0xf4ead8), 0, 0.6, 0, 0).scale.set(0.72, 0.3, 1.74);
    const rail = part(b, new THREE.TorusGeometry(0.8, 0.03, 6, 28), brass, 0, 0.78, 0, 0); rail.rotation.x = Math.PI / 2; rail.scale.set(1, 2.3, 1);
    part(b, new THREE.BoxGeometry(0.07, 0.75, 0.95), toon(0xf06a4a), 0, 1.25, -1.2).rotation.x = -0.4; part(b, new THREE.BoxGeometry(2.0, 0.06, 0.6), toon(0xf06a4a), 0, 0.8, -1.0);
    const w = part(b, new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xbfefff, { transparent: true, opacity: 0.45, rim: 2 }), 0, 0.95, 0.75, 0); w.scale.set(1, 0.8, 1.2); lamp(0, 0.9, 1.82);
  } else if (v.kind === 'wagon') {
    part(b, new THREE.BoxGeometry(1.9, 1.15, 3.0), toon(0x263466, { rim: 1 }), 0, 1.0, 0); part(b, new THREE.BoxGeometry(1.96, 0.14, 3.06), brass, 0, 0.82, 0, 0); part(b, new THREE.BoxGeometry(1.96, 0.08, 3.06), brass, 0, 1.5, 0, 0);
    part(b, new THREE.BoxGeometry(1.5, 0.5, 1.2), toon(0x1a2450), 0, 1.78, -0.3); for (const s of [-1, 1]) part(b, new THREE.BoxGeometry(0.03, 0.5, 0.9), glowMat(new THREE.Color(0.35, 0.5, 0.75)), s * 0.96, 1.15, 0.6, 0);
    g.userData.beacon = [lamp(-0.5, 2.18, -0.3, new THREE.Color(4, 1.6, 0.3)), lamp(0.5, 2.18, -0.3, new THREE.Color(0.4, 2.0, 4))]; lamp(0.7, 1.0, 1.52); lamp(-0.7, 1.0, 1.52);
  } else {
    part(b, new THREE.BoxGeometry(2.3, 1.5, 3.3), toon(0x5e3570, { rim: 1 }), 0, 1.2, 0); for (const y of [0.5, 1.2, 1.9]) part(b, new THREE.BoxGeometry(2.36, 0.14, 3.36), brass, 0, y, 0, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(b, new THREE.BoxGeometry(0.16, 1.56, 0.16), brass, sx * 1.12, 1.2, sz * 1.62, 0);
    part(b, new THREE.BoxGeometry(1.2, 0.7, 0.9), brass, 0, 2.3, -0.6); part(b, new THREE.CylinderGeometry(0.45, 0.45, 0.1, 20), glowMat(new THREE.Color(2.6, 1.9, 0.6)), 0, 1.2, 1.67, 0).rotation.x = Math.PI / 2;
  }
  return g;
}
export function makeFolk(THREE, kit, guard, hue = 0) {
  const { part, toon, glowMat } = kit, g = new THREE.Group(), b = new THREE.Group(); g.add(b); g.userData.body = b;
  const s = guard ? 1.12 : 0.94 + (hue % 3) * 0.04, skin = toon([0xf6c9a0, 0xc98f62, 0x9a6844][hue % 3], { rim: 0.7 }), cloth = toon(guard ? 0x263466 : CLOTHES[hue], { rim: 0.8 });
  part(b, lathe(THREE, [[0, 1.2 * s], [0.14 * s, 1.18 * s], [0.2 * s, 1.02 * s], [0.19 * s, 0.8 * s], [0.3 * s, 0.3 * s], [0.34 * s, 0.1 * s], [0, 0.1 * s]], 14), cloth);
  if (guard) { part(b, new THREE.TorusGeometry(0.2 * s, 0.03, 6, 16), toon(0xd9a441, { rim: 1.2 }), 0, 0.82 * s, 0, 0).rotation.x = Math.PI / 2; part(b, new THREE.BoxGeometry(0.2, 0.5, 0.02), toon(0xd9a441), 0, 0.78 * s, 0.22 * s, 0); }
  const head = part(b, new THREE.SphereGeometry(0.23 * s, 16, 12), skin, 0, 1.4 * s, 0.01);
  for (const e of [-1, 1]) part(head, new THREE.SphereGeometry(0.032 * s, 8, 6), glowMat(0x241c28), 0.085 * s * e, 0.01, 0.205 * s, 0);
  for (const e of [-1, 1]) { const a = new THREE.Group(); a.position.set(0.21 * s * e, 1.05 * s, 0); b.add(a); part(a, new THREE.CapsuleGeometry(0.055 * s, 0.3 * s, 4, 8), cloth, 0.03 * e, -0.2 * s, 0); part(a, new THREE.SphereGeometry(0.058 * s, 8, 6), skin, 0.03 * e, -0.42 * s, 0, 0); (g.userData.arms ||= []).push(a); }
  if (guard) {
    part(b, new THREE.SphereGeometry(0.26 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xd9a441, { rim: 1.4 }), 0, 1.43 * s, 0); part(b, new THREE.ConeGeometry(0.07, 0.3, 8), toon(0xc8553a), 0, 1.8 * s, 0, 0);
    part(b, new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6), toon(0x5a3b2a), 0.38, 1.0, 0.12, 0); const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMat(new THREE.Color(4, 2.2, 0.6))); l.position.set(0.38, 2.05, 0.12); b.add(l);
  } else {
    const hairC = toon([0x3a2a1c, 0x8a5a2e, 0xd9b36a, 0x2b2838, 0xa8a8b0, 0x6b3a2a][hue], { rim: 0.9 }); const hr = part(head, new THREE.SphereGeometry(0.245 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairC, 0, 0.02, -0.02, 0.012); hr.rotation.x = -0.3;
    if (hue % 3 === 0) { part(b, new THREE.CylinderGeometry(0.36 * s, 0.36 * s, 0.03, 16), toon(CLOTHES[(hue + 3) % 6]), 0, 1.58 * s, 0); part(b, new THREE.CylinderGeometry(0.17 * s, 0.2 * s, 0.16, 14), toon(CLOTHES[(hue + 3) % 6]), 0, 1.66 * s, 0, 0); }
    else if (hue % 3 === 1) part(b, new THREE.BoxGeometry(0.3, 0.26, 0.16), toon(0x9a6a3f, { map: kit.T.wood }), 0.26 * s, 0.62 * s, 0.05);
  }
  return g;
}
/** A cucco: round white plaza bird — red comb, orange beak, tail feathers, flap-ready wings. */
export function makeCucco(THREE, kit) {
  const { part, toon, glowMat } = kit, g = new THREE.Group(), b = new THREE.Group(); g.add(b); g.userData.body = b;
  const white = toon(0xf6f1e6, { rim: 0.7 }), red = toon(0xd23b2e, { rim: 0.9 }), orange = toon(0xf08a1d, { rim: 0.9 });
  part(b, new THREE.SphereGeometry(0.26, 14, 10), white, 0, 0.32, 0).scale.set(1, 0.92, 1.18);                        // round body
  for (const e of [-1, 0, 1]) { const t = part(b, new THREE.ConeGeometry(0.07, 0.3, 6), white, 0.07 * e, 0.48, -0.26, 0); t.rotation.x = -0.9; t.rotation.z = -0.35 * e; } // tail feathers
  const head = new THREE.Group(); head.position.set(0, 0.55, 0.17); b.add(head); g.userData.head = head;
  part(head, new THREE.SphereGeometry(0.155, 12, 10), white, 0, 0, 0);
  for (const e of [-1, 0, 1]) part(head, new THREE.SphereGeometry(0.045, 8, 6), red, 0.05 * e, 0.15, 0, 0);             // comb
  const beak = part(head, new THREE.ConeGeometry(0.05, 0.16, 8), orange, 0, -0.02, 0.17, 0); beak.rotation.x = Math.PI / 2; // beak
  for (const e of [-1, 1]) part(head, new THREE.SphereGeometry(0.022, 6, 6), glowMat(0x241c28), 0.07 * e, 0.03, 0.125, 0); // eyes
  g.userData.wings = [-1, 1].map((e) => { const w = new THREE.Group(); w.position.set(0.22 * e, 0.42, -0.02); b.add(w); part(w, new THREE.BoxGeometry(0.3, 0.04, 0.24), white, 0.15 * e, 0, 0); w.rotation.z = -0.15 * e; return w; });
  for (const e of [-1, 1]) part(b, new THREE.CylinderGeometry(0.016, 0.016, 0.16, 6), orange, 0.08 * e, 0.08, 0, 0);   // legs
  return g;
}
export function makePickup(THREE, kit, p) {
  const g = new THREE.Group(), { glowMat, T } = kit, halo = (c, s) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.scale.setScalar(s); g.add(m); };
  if (p.kind === 'rupee') { // pass 3: denominations — green pays 5 glim, blue 25, red 100; bigger and brighter as the value climbs
    const look = { 1: [new THREE.Color(0.4, 2.5, 0.8), new THREE.Color(0.1, 0.8, 0.25), 0.2], 5: [new THREE.Color(0.35, 0.6, 3.1), new THREE.Color(0.15, 0.3, 0.95), 0.26], 20: [new THREE.Color(3.1, 0.45, 0.4), new THREE.Color(0.95, 0.15, 0.1), 0.32] }[p.denom || 1];
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(look[2]), glowMat(look[0]));
    gem.scale.set(1, 2.0, 1); g.add(gem); halo(look[1], look[2] * 5);
  }
  else if (p.kind === 'glim' || p.kind === 'coin') { // rupees: elongated gems, colour by value — coin (5 glim) green, glim (10 glim) blue
    const glim = p.kind === 'glim', s = glim ? 0.24 : 0.18;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(s), glowMat(glim ? new THREE.Color(0.45, 0.95, 2.9) : new THREE.Color(0.4, 2.5, 0.8)));
    gem.scale.set(1, 2.0, 1); g.add(gem); halo(glim ? new THREE.Color(0.15, 0.35, 0.9) : new THREE.Color(0.1, 0.8, 0.25), s * 5);
  }
  else if (p.kind === 'lamp') { g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), glowMat(new THREE.Color(1.8, 2.8, 3.4)))); kit.part(g, new THREE.TorusGeometry(0.33, 0.045, 6, 20), kit.toon(0xd9a441, { rim: 1.2 }), 0, 0, 0, 0); halo(new THREE.Color(0.4, 0.7, 0.9), 3.2); }
  else { kit.part(g, new THREE.BoxGeometry(0.9, 0.6, 0.6), kit.toon(0x8a5a3c, { map: T.wood })); kit.part(g, new THREE.BoxGeometry(0.94, 0.12, 0.64), kit.toon(0xd9a441, { rim: 1.2 }), 0, 0.12, 0, 0); halo(new THREE.Color(1.0, 0.7, 0.2), 4); }
  return g;
}
const BEACON = { job: [2.4, 1.6, 0.25], goal: [0.3, 1.9, 2.4], tailor: [2.4, 0.6, 1.3], hideout: [0.5, 2.0, 0.5] };
export function makePot(THREE, kit) { // pass 3: a breakable clay pot — lathe body, darker rim and soil
  const g = new THREE.Group(), { part, toon } = kit;
  const prof = [[0.001, 0], [0.17, 0], [0.27, 0.05], [0.34, 0.24], [0.31, 0.42], [0.25, 0.5], [0.3, 0.56], [0.33, 0.6], [0.27, 0.6], [0.23, 0.53]];
  part(g, lathe(THREE, prof, 14), toon(0xb56545, { rim: 0.7 }), 0, 0, 0, 0.03);
  const soil = part(g, new THREE.CircleGeometry(0.23, 12), toon(0x4a3220, { rim: 0.2 }), 0, 0.53, 0, 0); soil.rotation.x = -Math.PI / 2;
  return g;
}
export function makeBeacon(THREE, kit) {  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ map: kit.T.beam, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 16, 36, 1, true), mat); col.position.y = 8; g.add(col);
  const ringM = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }), ring = new THREE.Mesh(new THREE.RingGeometry(2.8, 3.1, 48), ringM); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; g.add(ring);
  g.userData.set = (kind) => { mat.color.setRGB(...BEACON[kind]).multiplyScalar(0.28); ringM.color.setRGB(...BEACON[kind]); };
  return g;
}
