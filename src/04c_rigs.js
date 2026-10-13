
// ---------------- rigs: REAL procedural rigs for HAROLD, MAVIS and the ONE-EYED BREWMASTER (hark/rigs, 2026-10-13) ----------------
// Everything is built in code: no model files, no clips, no asset files.
//  * ONE shared humanoid skeleton (RIG_BONES, 28 bones): tilt > hips > torso (spine 1) > chest (spine 2) > neck > head > jaw / mustache / monocle,
//    shoulders > elbows > wrists > finger mitts + prop bones (swL / swR = cane, purse = Mavis's handbag swing), hips > knees > ankles > toes.
//    Each character only changes the bone offsets (proportions); the topology, the joint names and the clips are shared.
//  * The body is ONE organic surface: a signed-distance model of smooth-unioned ellipsoids / round cones / capped cones (each bound to a bone)
//    meshed with surface nets in the bind pose (an A-pose, arms out, so the sides never fuse to the arms), with SDF-gradient normals.
//    Skin weights come from the same model: each vertex is weighted to the bones of the solids it is near (exp falloff, top 4, normalised);
//    "rigid" solids (skirt, afro, shoes) keep their own bone. Small props / face parts (eyes, glasses, cane, purse, monocle, mustache) are
//    low-poly rigid pieces merged into the SAME geometry. Flat colours per face (vertex colours, split at colour borders) on the shared
//    toonMat (cel bands + flash) + one weighted-skinning ink hull (OUT_CHAR's uniforms). Result: 1 mesh + 1 outline (+1 shadow) per character.
//  * Clips (RIG_CLIPS) are keyframes authored in code and baked at 20 fps: idle, walk, run, atk1-3 (cane combo), roll (dodge), hurt (hit),
//    knockdown, getup, victory, purse (Mavis), canslam / spin / twirl (Brewmaster). They drive the SAME pose API (HERO_POSES.* / applyPose /
//    joint names), so every fight, the city, the partner AI and the cinematics keep working unchanged: HERO_POSES.idle / run / atk1-3 /
//    hurt / down / getup now sample the clips; HERO_POSES.walk / roll / victory / purse / clip(name, u) are new.
//  * Hooks: buildHero (Harold / Mavis, geometry built once and shared by every instance) and window.buildBrewmaster (09w's RIG HOOK; its geometry
//    is built only the first time the Brewmaster arena builds). ?oldrigs=1 = the previous part-stack rigs (nothing here runs).
//  * Test: ?rigstage=harold|mavis|brew[&rigyaw=rad][&rigclip=name&rigu=0..1] = a turntable stage (window.__rigs.stage(...)); __rigs.stats.
const RIGS = { on: !Q.has('oldrigs'), cache: {}, stats: {}, clips: {} };
const RIG_BONES = [ // [name, parent, offset in the parent's space (from the proportions d)]
  ['tilt', null, () => [0, 0, 0]], ['hips', 'tilt', (d) => [0, d.hip, 0]], ['torso', 'hips', (d) => [0, d.torsoY, 0]], ['chest', 'torso', (d) => [0, d.chestY, 0]],
  ['neck', 'chest', (d) => [0, d.neckY - d.chestY, 0]], ['head', 'neck', () => [0, 0, 0]], ['jaw', 'head', (d) => d.jaw], ['mustache', 'head', (d) => d.must], ['monocle', 'head', (d) => d.mono],
  ['shL', 'chest', (d) => [d.shX, d.shY - d.chestY, 0]], ['elL', 'shL', (d) => [0, -d.upper, 0]], ['haL', 'elL', (d) => [0, -d.fore, 0]], ['fgL', 'haL', (d) => d.fg], ['swL', 'haL', (d) => [0, -0.05 * d.s, 0]],
  ['shR', 'chest', (d) => [-d.shX, d.shY - d.chestY, 0]], ['elR', 'shR', (d) => [0, -d.upper, 0]], ['haR', 'elR', (d) => [0, -d.fore, 0]], ['fgR', 'haR', (d) => d.fg], ['swR', 'haR', (d) => [0, -0.05 * d.s, 0]],
  ['purse', 'swR', () => [0, 0, 0]],
  ['lgL', 'hips', (d) => [d.legX, 0, 0]], ['knL', 'lgL', (d) => [0, -d.thigh, 0]], ['ftL', 'knL', (d) => [0, -d.shin, 0]], ['toeL', 'ftL', (d) => d.toe],
  ['lgR', 'hips', (d) => [-d.legX, 0, 0]], ['knR', 'lgR', (d) => [0, -d.thigh, 0]], ['ftR', 'knR', (d) => [0, -d.shin, 0]], ['toeR', 'ftR', (d) => d.toe],
];
const RIG_BIND = { shL: [0, 0, 0.62], shR: [0, 0, -0.62], lgL: [0, 0, 0.06], lgR: [0, 0, -0.06], elL: [-0.15, 0, 0], elR: [-0.15, 0, 0] }; // A-pose the surface is meshed + bound in
const RIG_HERO_D = Object.assign({}, HERO_D, { chestY: 0.28, jaw: [0, 0.1, -0.06], must: [0, 0.12, 0.3], mono: [0.14, 0.32, 0.26], fg: [0, -0.06, 0.04], toe: [0, -0.03, 0.1], s: 1 });
const RIG_BREW_D = { hip: 0.98, torsoY: 0.06, chestY: 0.5, neckY: 1.2, legX: 0.26, thigh: 0.45, shin: 0.42, shX: 0.72, shY: 0.76, upper: 0.46, fore: 0.42,
  jaw: [0, -0.18, -0.05], must: [0, -0.16, 0.62], mono: [-0.22, 0.17, 0.62], fg: [0, -0.13, 0.05], toe: [0, -0.07, 0.17], s: 1.6 };
if (RIGS.on) for (const j of ['chest', 'jaw', 'fgL', 'fgR', 'toeL', 'toeR', 'purse', 'mustache', 'monocle']) if (!JOINTS.includes(j)) JOINTS.push(j); // rigs: the extra bones join the pose API

// ---------- bones ----------
function rigSkeleton(d) {
  const J = { root: new THREE.Group(), d, bones: [] };
  for (const [n, par, off] of RIG_BONES) { const b = new THREE.Bone(); b.name = n; b.position.fromArray(off(d)); (par ? J[par] : J.root).add(b); J[n] = b; J.bones.push(b); }
  return J;
}
// ---------- the SDF model ----------
const _rq = new THREE.Vector3(), _rm = new THREE.Matrix4(), _rM3 = new THREE.Matrix3();
function rigModel(d, spec) {
  // bind-pose bone matrices (root space)
  const S = rigSkeleton(d); for (const [k, r] of Object.entries(RIG_BIND)) S[k].rotation.fromArray(r); S.root.updateMatrixWorld(true);
  const W = {}; for (const b of S.bones) W[b.name] = b.matrixWorld.clone();
  const solids = [], paints = [], acc = [];
  const toRoot = (bone, c) => new THREE.Vector3().fromArray(c).applyMatrix4(W[bone]);
  const invRot = (bone, rot) => { const m = new THREE.Matrix4().extractRotation(W[bone]); if (rot) m.multiply(_rm.makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]))); return new THREE.Matrix3().setFromMatrix4(m).transpose().elements; };
  const api = {
    E: (bone, c, r, col, o = {}) => solids.push({ t: 0, b: o.b || bone, c: toRoot(bone, c), R: invRot(bone, o.rot), r, col, k: o.k ?? 0.035 * d.s, rigid: !!o.rigid }),
    C: (bone, a, b2, ra, rb, col, o = {}) => solids.push({ t: 1, b: o.b || bone, a: toRoot(bone, a), e: toRoot(bone, b2), ra, rb, col, k: o.k ?? 0.035 * d.s, rigid: !!o.rigid }),
    K: (bone, c, h, r1, r2, col, o = {}) => solids.push({ t: 2, b: o.b || bone, c: toRoot(bone, c), R: invRot(bone, o.rot), h, r1, r2, col, k: o.k ?? 0.02 * d.s, rigid: !!o.rigid }),
    PE: (bone, c, r, col, o = {}) => paints.push({ t: 0, c: toRoot(bone, c), R: invRot(bone, o.rot), r, col, on: o.on }),
    PB: (bone, c, r, col, o = {}) => paints.push({ t: 1, c: toRoot(bone, c), R: invRot(bone, o.rot), r, col, on: o.on }),
    A: (bone, geo, col, pos, o = {}) => acc.push({ bone, geo, col, pos, rot: o.rot, ol: o.outline !== false, surf: o.surf }),
  };
  spec(api, d);
  for (const s of solids) { // culling radius per solid
    if (s.t === 0) s.br = Math.max(...s.r); else if (s.t === 1) { s.c = s.a.clone().add(s.e).multiplyScalar(0.5); s.br = s.a.distanceTo(s.e) / 2 + Math.max(s.ra, s.rb); }
    else s.br = Math.hypot(Math.max(s.r1, s.r2), s.h);
  }
  return { S, W, solids, paints, acc, d };
}
function rigSolidD(s, x, y, z) {
  if (s.t === 1) { // IQ round cone
    const ax = s.a.x, ay = s.a.y, az = s.a.z, bx = s.e.x - ax, by = s.e.y - ay, bz = s.e.z - az, l2 = bx * bx + by * by + bz * bz, rr = s.ra - s.rb, a2 = l2 - rr * rr, il2 = 1 / l2;
    const px = x - ax, py = y - ay, pz = z - az, yy = px * bx + py * by + pz * bz, zz = yy - l2;
    const qx = px * l2 - bx * yy, qy = py * l2 - by * yy, qz = pz * l2 - bz * yy, x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = zz * zz * l2, k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - s.rb;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - s.ra;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - s.ra;
  }
  const R = s.R, dx = x - s.c.x, dy = y - s.c.y, dz = z - s.c.z;
  const lx = R[0] * dx + R[3] * dy + R[6] * dz, ly = R[1] * dx + R[4] * dy + R[7] * dz, lz = R[2] * dx + R[5] * dy + R[8] * dz;
  if (s.t === 0) { const r = s.r, k0 = Math.hypot(lx / r[0], ly / r[1], lz / r[2]), k1 = Math.hypot(lx / (r[0] * r[0]), ly / (r[1] * r[1]), lz / (r[2] * r[2])); return k1 < 1e-9 ? -Math.min(...r) : k0 * (k0 - 1) / k1; }
  // capped cone (axis = local y, half height h, r1 at the bottom, r2 at the top)
  const qx = Math.hypot(lx, lz), qy = ly, h = s.h, r1 = s.r1, r2 = s.r2;
  const cax = qx - Math.min(qx, qy < 0 ? r1 : r2), cay = Math.abs(qy) - h;
  const k2x = r2 - r1, k2y = 2 * h, t = clamp(((r2 - qx) * k2x + (h - qy) * k2y) / (k2x * k2x + k2y * k2y), 0, 1);
  const cbx = qx - r2 + k2x * t, cby = qy - h + k2y * t, sg = cbx < 0 && cay < 0 ? -1 : 1;
  return sg * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby));
}
function rigSdf(M, x, y, z) {
  let d = 1e9;
  for (const s of M.solids) {
    const cx = x - s.c.x, cy = y - s.c.y, cz = z - s.c.z, lb = Math.sqrt(cx * cx + cy * cy + cz * cz) - s.br;
    if (lb > d + s.k) continue; // cannot change the (smooth) min
    const di = rigSolidD(s, x, y, z), k = s.k, h = Math.max(k - Math.abs(d - di), 0) / k; d = Math.min(d, di) - h * h * k * 0.25;
  }
  return d;
}
function rigPaintIn(p, x, y, z) {
  const R = p.R, dx = x - p.c.x, dy = y - p.c.y, dz = z - p.c.z;
  const lx = R[0] * dx + R[3] * dy + R[6] * dz, ly = R[1] * dx + R[4] * dy + R[7] * dz, lz = R[2] * dx + R[5] * dy + R[8] * dz, r = p.r;
  return p.t === 0 ? (lx / r[0]) ** 2 + (ly / r[1]) ** 2 + (lz / r[2]) ** 2 < 1 : Math.abs(lx) < r[0] && Math.abs(ly) < r[1] && Math.abs(lz) < r[2];
}
// surface nets over the model's bounds -> { pos[], tri[] }
function rigMesh(M, h) {
  const mn = new THREE.Vector3(1e9, 1e9, 1e9), mx = new THREE.Vector3(-1e9, -1e9, -1e9);
  for (const s of M.solids) { mn.min(_rq.copy(s.c).subScalar(s.br)); mx.max(_rq.copy(s.c).addScalar(s.br)); }
  mn.subScalar(h * 2); mx.addScalar(h * 2);
  const nx = Math.ceil((mx.x - mn.x) / h) + 1, ny = Math.ceil((mx.y - mn.y) / h) + 1, nz = Math.ceil((mx.z - mn.z) / h) + 1;
  const F = new Float32Array(nx * ny * nz), id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[id(i, j, k)] = rigSdf(M, mn.x + i * h, mn.y + j * h, mn.z + k * h);
  const cx = nx - 1, cy = ny - 1, cid = (i, j, k) => i + cx * (j + cy * k), CV = new Int32Array(cx * cy * (nz - 1)).fill(-1), P = [];
  const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], ED = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0; for (let c = 0; c < 8; c++) { v[c] = F[id(i + CO[c][0], j + CO[c][1], k + CO[c][2])]; if (v[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of ED) { if ((v[a] < 0) === (v[b] < 0)) continue; const t = v[a] / (v[a] - v[b]); sx += CO[a][0] + (CO[b][0] - CO[a][0]) * t; sy += CO[a][1] + (CO[b][1] - CO[a][1]) * t; sz += CO[a][2] + (CO[b][2] - CO[a][2]) * t; n++; }
    CV[cid(i, j, k)] = P.length / 3; P.push(mn.x + (i + sx / n) * h, mn.y + (j + sy / n) * h, mn.z + (k + sz / n) * h);
  }
  // project each vertex onto the surface (2 Newton steps on the SDF)
  const e = h * 0.25;
  for (let q = 0; q < P.length; q += 3) for (let it = 0; it < 2; it++) {
    const x = P[q], y = P[q + 1], z = P[q + 2], f = rigSdf(M, x, y, z);
    const gx = (rigSdf(M, x + e, y, z) - rigSdf(M, x - e, y, z)) / (2 * e), gy = (rigSdf(M, x, y + e, z) - rigSdf(M, x, y - e, z)) / (2 * e), gz = (rigSdf(M, x, y, z + e) - rigSdf(M, x, y, z - e)) / (2 * e);
    const g2 = gx * gx + gy * gy + gz * gz; if (g2 < 1e-8) break; const s = clamp(f / g2, -h, h); P[q] -= gx * s; P[q + 1] -= gy * s; P[q + 2] -= gz * s;
  }
  const T = [];
  const quad = (a, b, c, d2) => { if (a < 0 || b < 0 || c < 0 || d2 < 0) return; const L = (u, w) => (P[u * 3] - P[w * 3]) ** 2 + (P[u * 3 + 1] - P[w * 3 + 1]) ** 2 + (P[u * 3 + 2] - P[w * 3 + 2]) ** 2;
    if (L(a, c) < L(b, d2)) T.push(a, b, c, a, c, d2); else T.push(a, b, d2, b, c, d2); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = F[id(i, j, k)] < 0;
    if (s0 !== (F[id(i + 1, j, k)] < 0)) quad(CV[cid(i, j - 1, k - 1)], CV[cid(i, j, k - 1)], CV[cid(i, j, k)], CV[cid(i, j - 1, k)]);
    if (s0 !== (F[id(i, j + 1, k)] < 0)) quad(CV[cid(i - 1, j, k - 1)], CV[cid(i, j, k - 1)], CV[cid(i, j, k)], CV[cid(i - 1, j, k)]);
    if (s0 !== (F[id(i, j, k + 1)] < 0)) quad(CV[cid(i - 1, j - 1, k)], CV[cid(i, j - 1, k)], CV[cid(i, j, k)], CV[cid(i - 1, j, k)]);
  }
  return { P, T };
}

// quadric edge-collapse decimation (fine surface-nets mesh -> the triangle budget); collapsed vertices are projected back onto the SDF
function rigDecimate(M, P, T, target, h, lab) {
  const nv = P.length / 3, nf = T.length / 3, Fa = new Int32Array(T), alive = new Uint8Array(nf).fill(1), va = new Uint8Array(nv).fill(1), stamp = new Uint32Array(nv), Qd = new Float64Array(nv * 10);
  const vf = Array.from({ length: nv }, () => new Set());
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) vf[Fa[f * 3 + k]].add(f);
  const fn = (f, out) => { const a = Fa[f * 3] * 3, b = Fa[f * 3 + 1] * 3, c = Fa[f * 3 + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    let x = uy * wz - uz * wy, y = uz * wx - ux * wz, z = ux * wy - uy * wx; const l = Math.hypot(x, y, z); if (l < 1e-14) return 0; out[0] = x / l; out[1] = y / l; out[2] = z / l; out[3] = -(out[0] * P[a] + out[1] * P[a + 1] + out[2] * P[a + 2]); return l; };
  const pl = [0, 0, 0, 0];
  for (let f = 0; f < nf; f++) { const ar = fn(f, pl); if (!ar) continue; const [a, b, c, d] = pl, q = [a * a, a * b, a * c, a * d, b * b, b * c, b * d, c * c, c * d, d * d];
    for (let k = 0; k < 3; k++) { const o = Fa[f * 3 + k] * 10; for (let i = 0; i < 10; i++) Qd[o + i] += q[i] * ar; } }
  const qerr = (o1, o2, x, y, z) => { const q = (i) => Qd[o1 + i] + Qd[o2 + i];
    return q(0) * x * x + 2 * q(1) * x * y + 2 * q(2) * x * z + 2 * q(3) * x + q(4) * y * y + 2 * q(5) * y * z + 2 * q(6) * y + q(7) * z * z + 2 * q(8) * z + q(9); };
  const H = []; // binary heap [cost, a, b, sa, sb, x, y, z]
  const push = (e) => { H.push(e); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
  const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return top; };
  const edge = (a, b) => { const A = a * 3, B = b * 3, cand = [[P[A], P[A + 1], P[A + 2]], [P[B], P[B + 1], P[B + 2]], [(P[A] + P[B]) / 2, (P[A + 1] + P[B + 1]) / 2, (P[A + 2] + P[B + 2]) / 2]];
    let best = null, bc = 1e18; for (const c of cand) { const e = qerr(a * 10, b * 10, c[0], c[1], c[2]); if (e < bc) { bc = e; best = c; } }
    const len2 = (P[A] - P[B]) ** 2 + (P[A + 1] - P[B + 1]) ** 2 + (P[A + 2] - P[B + 2]) ** 2; push([bc + len2 * 1e-4, a, b, stamp[a], stamp[b], best[0], best[1], best[2]]); };
  const nbr = (v) => { const s = new Set(); for (const f of vf[v]) for (let k = 0; k < 3; k++) s.add(Fa[f * 3 + k]); s.delete(v); return s; };
  for (let v = 0; v < nv; v++) for (const n of nbr(v)) if (n > v) edge(v, n);
  let live = nf; const n0 = [0, 0, 0, 0], n1 = [0, 0, 0, 0];
  while (live > target && H.length) {
    const [, a, b, sa, sb, x, y, z] = pop(); if (!va[a] || !va[b] || stamp[a] !== sa || stamp[b] !== sb) continue;
    if (lab[a] !== lab[b]) continue; // colour borders keep their fine edges
    const Na = nbr(a), Nb = nbr(b); if (!Na.has(b)) continue; let common = 0; for (const n of Na) if (Nb.has(n)) common++; if (common !== 2) continue;
    // reject collapses that flip a face
    const ox = P[a * 3], oy = P[a * 3 + 1], oz = P[a * 3 + 2], bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2]; let ok = true;
    for (const v of [a, b]) for (const f of vf[v]) { const has = (Fa[f * 3] === a || Fa[f * 3 + 1] === a || Fa[f * 3 + 2] === a) && (Fa[f * 3] === b || Fa[f * 3 + 1] === b || Fa[f * 3 + 2] === b); if (has) continue;
      if (!fn(f, n0)) continue; P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z; const l = fn(f, n1); P[a * 3] = ox; P[a * 3 + 1] = oy; P[a * 3 + 2] = oz; P[b * 3] = bx; P[b * 3 + 1] = by; P[b * 3 + 2] = bz;
      if (!l || n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] < 0.3) { ok = false; break; } if (!ok) break; }
    if (!ok) continue;
    P[a * 3] = x; P[a * 3 + 1] = y; P[a * 3 + 2] = z;
    for (const f of [...vf[b]]) { const has = Fa[f * 3] === a || Fa[f * 3 + 1] === a || Fa[f * 3 + 2] === a;
      if (has) { alive[f] = 0; live--; for (let k = 0; k < 3; k++) vf[Fa[f * 3 + k]].delete(f); }
      else { for (let k = 0; k < 3; k++) if (Fa[f * 3 + k] === b) Fa[f * 3 + k] = a; vf[a].add(f); } }
    vf[b].clear(); va[b] = 0; for (let i = 0; i < 10; i++) Qd[a * 10 + i] += Qd[b * 10 + i]; stamp[a]++;
    for (const n of nbr(a)) edge(a, n);
  }
  // compact + re-project onto the surface
  const map = new Int32Array(nv).fill(-1), P2 = [], T2 = [], L2 = [];
  for (let f = 0; f < nf; f++) if (alive[f]) for (let k = 0; k < 3; k++) { const v = Fa[f * 3 + k]; if (map[v] < 0) { map[v] = P2.length / 3; P2.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); L2.push(lab[v]); } T2.push(map[v]); }
  const e = h * 0.25;
  for (let q = 0; q < P2.length; q += 3) { const x = P2[q], y = P2[q + 1], z = P2[q + 2], f = rigSdf(M, x, y, z), g = rigGrad(M, x, y, z, e); const s = clamp(f, -h, h); P2[q] -= g[0] * s; P2[q + 1] -= g[1] * s; P2[q + 2] -= g[2] * s; }
  return { P: P2, T: T2, L: L2 };
}
function rigGrad(M, x, y, z, e) {
  const gx = rigSdf(M, x + e, y, z) - rigSdf(M, x - e, y, z), gy = rigSdf(M, x, y + e, z) - rigSdf(M, x, y - e, z), gz = rigSdf(M, x, y, z + e) - rigSdf(M, x, y, z - e), l = Math.hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}
// the solids nearest a point (raw distances) -> colour + weights
function rigNear(M, x, y, z) { let best = null, bd = 1e9; const ds = []; for (const s of M.solids) { const di = rigSolidD(s, x, y, z); ds.push(di); if (di < bd) { bd = di; best = s; } } return { best, bd, ds }; }
function rigColour(M, x, y, z) {
  const { best } = rigNear(M, x, y, z); let col = best.col;
  for (const p of M.paints) if ((!p.on || p.on.includes(best.b)) && rigPaintIn(p, x, y, z)) col = p.col;
  return col;
}
// ray from outside along -dir onto the surface (props that sit on the body)
function rigOnSurf(M, p, dir, off) {
  const D = new THREE.Vector3().fromArray(dir).normalize(), q = p.clone().addScaledVector(D, 1.2 * M.d.s); let t = 0, prev = rigSdf(M, q.x, q.y, q.z);
  for (let i = 0; i < 200 && t < 2.4 * M.d.s; i++) { const step = Math.max(0.004, Math.abs(prev) * 0.8); t += step; const x = q.x - D.x * t, y = q.y - D.y * t, z = q.z - D.z * t, f = rigSdf(M, x, y, z); if (f < 0) { t -= step * 0.5; break; } prev = f; }
  return q.addScaledVector(D, -t).addScaledVector(D, off);
}
// ---------- build the merged, weighted geometry ----------
function rigGeometry(d, spec, h, blend, target) {
  const t0 = performance.now(), M = rigModel(d, spec), fine = rigMesh(M, h);
  fine.L = []; for (let v = 0; v < fine.P.length; v += 3) fine.L.push(rigColour(M, fine.P[v], fine.P[v + 1], fine.P[v + 2]));
  const { P, T, L } = target && fine.T.length / 3 > target ? rigDecimate(M, fine.P, fine.T, target, h, fine.L) : fine;
  { // smooth the colour borders: border vertices relax toward their border neighbours (3 passes), then back onto the surface
    const nvb = P.length / 3, nb = Array.from({ length: nvb }, () => new Set());
    for (let f = 0; f < T.length; f += 3) for (let k = 0; k < 3; k++) { nb[T[f + k]].add(T[f + (k + 1) % 3]); nb[T[f + k]].add(T[f + (k + 2) % 3]); }
    const border = (v) => { for (const n of nb[v]) if (L[n] !== L[v]) return true; return false; }, B = []; for (let v = 0; v < nvb; v++) if (border(v)) B.push(v);
    const isB = new Uint8Array(nvb); for (const v of B) isB[v] = 1;
    for (let it = 0; it < 3; it++) { const np = [];
      for (const v of B) { let x = 0, y = 0, z = 0, n = 0; for (const u of nb[v]) if (isB[u]) { x += P[u * 3]; y += P[u * 3 + 1]; z += P[u * 3 + 2]; n++; } np.push(n ? [P[v * 3] * 0.5 + x / n * 0.5, P[v * 3 + 1] * 0.5 + y / n * 0.5, P[v * 3 + 2] * 0.5 + z / n * 0.5] : null); }
      B.forEach((v, i) => { const q = np[i]; if (!q) return; const f = rigSdf(M, q[0], q[1], q[2]), g = rigGrad(M, q[0], q[1], q[2], h * 0.25); P[v * 3] = q[0] - g[0] * f; P[v * 3 + 1] = q[1] - g[1] * f; P[v * 3 + 2] = q[2] - g[2] * f; }); }
  }
  const bi = new Map(M.S.bones.map((b, i) => [b.name, i]));
  const nv0 = P.length / 3, nrm = new Float32Array(nv0 * 3), SI = new Uint16Array(nv0 * 4), SW = new Float32Array(nv0 * 4);
  for (let v = 0; v < nv0; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], g = rigGrad(M, x, y, z, h * 0.35); nrm.set(g, v * 3);
    const { best, bd, ds } = rigNear(M, x, y, z), acc = new Map();
    if (best.rigid) acc.set(best.b, 1);
    else M.solids.forEach((s, i) => { if (s.rigid && s !== best && ds[i] > bd + blend * 0.5) return; const w = Math.exp(-(ds[i] - bd) / blend); if (w > 0.01) acc.set(s.b, (acc.get(s.b) || 0) + w); });
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((a, b) => a + b[1], 0);
    top.forEach(([b, w], k) => { SI[v * 4 + k] = bi.get(b); SW[v * 4 + k] = w / sum; });
  }
  // orientation + flat colour per face; vertices split where colours meet
  const pal = [], palI = new Map(), colOf = (c) => { if (!palI.has(c)) { palI.set(c, pal.length); pal.push(new THREE.Color(c)); } return palI.get(c); };
  const OUT = { p: [], n: [], o: [], c: [], si: [], sw: [] }, IDX = [], remap = new Map();
  const vtx = (v, ci) => { const key = v * 256 + ci; let r = remap.get(key); if (r !== undefined) return r; r = OUT.p.length / 3; remap.set(key, r);
    OUT.p.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); OUT.n.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]); OUT.o.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
    const c = pal[ci]; OUT.c.push(c.r, c.g, c.b); for (let k = 0; k < 4; k++) { OUT.si.push(SI[v * 4 + k]); OUT.sw.push(SW[v * 4 + k]); } return r; };
  for (let f = 0; f < T.length; f += 3) {
    let a = T[f], b = T[f + 1], c = T[f + 2];
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az, wx = P[c * 3] - ax, wy = P[c * 3 + 1] - ay, wz = P[c * 3 + 2] - az;
    const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx; if (fx * fx + fy * fy + fz * fz < 1e-14) continue;
    const gx = nrm[a * 3] + nrm[b * 3] + nrm[c * 3], gy = nrm[a * 3 + 1] + nrm[b * 3 + 1] + nrm[c * 3 + 1], gz = nrm[a * 3 + 2] + nrm[b * 3 + 2] + nrm[c * 3 + 2];
    if (fx * gx + fy * gy + fz * gz < 0) { const t = b; b = c; c = t; }
    const la = L[a], lb = L[b], lc = L[c], ci = colOf(la === lb || la === lc ? la : lb === lc ? lb : rigColour(M, (ax + P[b * 3] + P[c * 3]) / 3, (ay + P[b * 3 + 1] + P[c * 3 + 1]) / 3, (az + P[b * 3 + 2] + P[c * 3 + 2]) / 3));
    IDX.push(vtx(a, ci), vtx(b, ci), vtx(c, ci));
  }
  const bodyTris = IDX.length / 3;
  // rigid props (low poly), outlined ones first so the hull can draw a prefix of the index
  const IDX2 = [], olAcc = M.acc.filter((a) => a.ol), noAcc = M.acc.filter((a) => !a.ol);
  for (const [list, into] of [[olAcc, IDX], [noAcc, IDX2]]) for (const a of list) {
    const g = a.geo.index ? a.geo : a.geo; bakeColor(g, a.col); addOdir(g);
    const L = new THREE.Matrix4().compose(new THREE.Vector3().fromArray(a.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(a.rot || [0, 0, 0]))), new THREE.Vector3(1, 1, 1));
    const Wm = M.W[a.bone].clone().multiply(L);
    if (a.surf) { const p0 = new THREE.Vector3().setFromMatrixPosition(Wm), dirR = new THREE.Vector3().fromArray(a.surf).transformDirection(M.W[a.bone]); const ps = rigOnSurf(M, p0, dirR.toArray(), a.surf[3] || 0); Wm.setPosition(ps); }
    const N3 = new THREE.Matrix3().getNormalMatrix(Wm), O3 = new THREE.Matrix3().setFromMatrix4(Wm), A = g.attributes, base = OUT.p.length / 3, b = bi.get(a.bone);
    for (let i = 0; i < A.position.count; i++) {
      _rq.fromBufferAttribute(A.position, i).applyMatrix4(Wm); OUT.p.push(_rq.x, _rq.y, _rq.z);
      _rq.fromBufferAttribute(A.normal, i).applyMatrix3(N3).normalize(); OUT.n.push(_rq.x, _rq.y, _rq.z);
      _rq.fromBufferAttribute(A.odir, i).applyMatrix3(O3); OUT.o.push(_rq.x, _rq.y, _rq.z);
      OUT.c.push(A.color.getX(i), A.color.getY(i), A.color.getZ(i)); OUT.si.push(b, 0, 0, 0); OUT.sw.push(1, 0, 0, 0);
    }
    if (g.index) for (let j = 0; j < g.index.count; j++) into.push(g.index.getX(j) + base); else for (let j = 0; j < A.position.count; j++) into.push(j + base);
    g.dispose();
  }
  const nOl = IDX.length; IDX.push(...IDX2);
  const G = new THREE.BufferGeometry(), nv = OUT.p.length / 3;
  G.setAttribute('position', new THREE.Float32BufferAttribute(OUT.p, 3)); G.setAttribute('normal', new THREE.Float32BufferAttribute(OUT.n, 3));
  G.setAttribute('color', new THREE.Float32BufferAttribute(OUT.c, 3)); G.setAttribute('odir', new THREE.Float32BufferAttribute(OUT.o, 3));
  G.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(OUT.si, 4)); G.setAttribute('skinWeight', new THREE.Float32BufferAttribute(OUT.sw, 4));
  G.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(IDX, 1) : new THREE.Uint16BufferAttribute(IDX, 1));
  const GO = new THREE.BufferGeometry(); for (const k of ['position', 'odir', 'skinIndex', 'skinWeight']) GO.setAttribute(k, G.attributes[k]); GO.setIndex(new THREE.BufferAttribute(G.index.array.slice(0, nOl), 1));
  return { G, GO, stats: { tris: IDX.length / 3, fineTris: fine.T.length / 3, bodyTris, propTris: IDX.length / 3 - bodyTris, verts: nv, ms: Math.round(performance.now() - t0), h } };
}
// weighted-skinning ink hull (same uniforms / fragment as OUT_CHAR)
let RIG_OL = null;
function rigOutlineMat() {
  if (RIG_OL) return RIG_OL;
  RIG_OL = new THREE.ShaderMaterial({ uniforms: OUT_CHAR.uniforms, fragmentShader: OUT_CHAR.fragmentShader, side: THREE.BackSide,
    vertexShader: `#include <common>
      #include <skinning_pars_vertex>
      attribute vec3 odir; uniform float uW; varying float vD;
      void main() { vec3 p = position; vec3 od = odir;
        #ifdef USE_SKINNING
          mat4 sm = skinWeight.x * getBoneMatrix(skinIndex.x) + skinWeight.y * getBoneMatrix(skinIndex.y) + skinWeight.z * getBoneMatrix(skinIndex.z) + skinWeight.w * getBoneMatrix(skinIndex.w);
          sm = bindMatrixInverse * sm * bindMatrix; p = (sm * vec4(position, 1.0)).xyz; od = mat3(sm) * odir;
        #endif
        vec4 wp = modelMatrix * vec4(p, 1.0); vec3 wd = mat3(modelMatrix) * od;
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 2.5, 36.0);
        vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }` });
  return RIG_OL;
}
// one instance: fresh bones + a SkinnedMesh / hull sharing the cached geometry
function rigInstance(kind, d, spec, h, blend, sphere, target) {
  let C = RIGS.cache[kind]; if (!C) { C = RIGS.cache[kind] = rigGeometry(d, spec, h, blend, target); RIGS.stats[kind] = C.stats; }
  const J = rigSkeleton(d); J.kind = 'hero'; J.rig = kind; J.tails = []; J.mat = toonMat();
  for (const [k, r] of Object.entries(RIG_BIND)) J[k].rotation.fromArray(r);
  const mesh = new THREE.SkinnedMesh(C.G, J.mat), ol = new THREE.SkinnedMesh(C.GO, rigOutlineMat());
  J.root.add(mesh); J.root.add(ol); J.root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(J.bones); mesh.bind(skel, mesh.matrixWorld); ol.bind(skel, ol.matrixWorld);
  for (const k of Object.keys(RIG_BIND)) J[k].rotation.set(0, 0, 0);
  for (const m of [mesh, ol]) { m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, sphere[0], 0), sphere[1]); }
  mesh.castShadow = true; mesh.receiveShadow = false; ol.castShadow = false; ol.visible = QUAL.hd; QUAL.outlines.push(ol);
  J.merged = [mesh, ol]; J.mesh = mesh; J.hull = ol;
  return J;
}

// ---------- the characters ----------
const RG = { // low-poly prop geometry
  sph: (rx, ry, rz, w = 8, hh = 6) => new THREE.SphereGeometry(1, w, hh).scale(rx, ry, rz),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s, 1),
  tor: (R, r, arc = TAU, rs = 5, ts = 12) => new THREE.TorusGeometry(R, r, rs, ts, arc),
};
function rigToadSpec(W) { // HAROLD (W = false) / MAVIS (W = true): same dimensions as the part-stack rigs they replace
  return ({ E, C, K, PE, PB, A }, d) => {
    const SK = W ? '#7f8f3e' : '#6f7f34', SK2 = W ? '#c4c08a' : '#b8b47a', WART = W ? '#66752c' : '#58682a', TOP = W ? '#5f73b0' : '#7a5232', LEGC = W ? SK : '#5a5248', SHOE = W ? '#6a2a3a' : '#3a2a1e';
    // trunk
    if (W) { E('hips', [0, 0.04, 0], [0.26, 0.16, 0.22], TOP); K('hips', [0, -0.2, 0], 0.28, 0.42, 0.25, TOP, { rigid: true }); }
    else E('hips', [0, 0.02, 0], [0.27, 0.18, 0.23], LEGC);
    E('torso', [0, 0.13, -0.01], [0.31, 0.25, 0.27], TOP); E('chest', [0, 0.0, -0.02], [0.34, 0.33, 0.3], TOP);
    // head: wide flat toad head, pale throat on the jaw, eye bulges
    E('head', [0, 0.16, 0.03], [0.33, 0.21, 0.3], SK); E('head', [0, -0.03, 0.13], [0.29, 0.12, 0.25], SK2, { b: 'jaw', k: 0.05 });
    for (const s of [-1, 1]) E('head', [s * 0.14, 0.3, 0.13], [0.105, 0.1, 0.1], SK, { k: 0.04 });
    if (W) { E('head', [0, 0.5, -0.2], [0.44, 0.38, 0.38], '#c8c6c2', { rigid: true, k: 0.06 }); // the grey afro: one cloud + curls
      let sd = 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 16; i++) { const a = r() * TAU, e = r() * 1.4 - 0.25, R = 0.36; E('head', [Math.cos(a) * Math.cos(e) * R * 1.05, 0.5 + Math.sin(e) * R, -0.2 + Math.sin(a) * Math.cos(e) * R], [0.13, 0.12, 0.13], '#c8c6c2', { rigid: true, k: 0.07 }); }
      for (let i = 0; i < 9; i++) { const a = r() * TAU, e = r() * 1.2; PE('head', [Math.cos(a) * Math.cos(e) * 0.45, 0.5 + Math.sin(e) * 0.42, -0.2 + Math.sin(a) * Math.cos(e) * 0.42], [0.07, 0.07, 0.07], '#a6a39d'); }
    }
    // arms (sleeve / skin by solid), webbed mitt hands on the wrist + finger bones
    for (const k of ['L', 'R']) {
      E('sh' + k, [0, 0, 0], [0.12, 0.12, 0.12], TOP); C('sh' + k, [0, 0, 0], [0, -d.upper, 0], 0.095, 0.085, TOP, { b: 'sh' + k });
      C('el' + k, [0, 0, 0], [0, -d.fore + 0.03, 0], 0.08, 0.072, W ? SK : TOP);
      E('ha' + k, [0, -0.035, 0.01], [0.09, 0.05, 0.09], SK, { k: 0.03 }); E('fg' + k, [0, -0.01, 0.03], [0.085, 0.045, 0.08], SK, { k: 0.03 });
      if (!W) PB('el' + k, [0, -d.fore + 0.045, 0], [0.12, 0.03, 0.12], '#5e3e24', { on: ['el' + k] });
      // legs: slacks / bare toad legs, shoes (rigid heel + toe)
      C('lg' + k, [0, 0.02, 0], [0, -d.thigh, 0], 0.12, 0.105, LEGC); C('kn' + k, [0, 0, 0], [0, -d.shin + 0.04, 0], 0.102, 0.09, LEGC);
      E('ft' + k, [0, -0.03, 0.0], [0.12, 0.07, 0.12], SHOE, { k: 0.02, rigid: true }); E('toe' + k, [0, 0, 0.05], [0.13, 0.066, 0.11], SHOE, { k: 0.02, rigid: true });
      if (!W) PB('kn' + k, [0, -d.shin + 0.06, 0], [0.2, 0.025, 0.2], '#4a4238', { on: ['kn' + k] });
    }
    // paint: shirt front, belt / dress print
    if (!W) { PE('chest', [0, 0.0, 0.24], [0.15, 0.28, 0.14], '#d8cfb4'); PB('hips', [0, 0.12, 0], [0.4, 0.03, 0.4], '#2a2018', { on: ['hips', 'torso'] }); }
    else { let sd = 3; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); const FL = ['#f08ab0', '#fff0f4', '#f0a0c8', '#ffffff'];
      for (let i = 0; i < 22; i++) { const a = r() * TAU, y = -0.44 + r() * 0.46, rr = lerp(0.42, 0.25, (y + 0.48) / 0.56); PE('hips', [Math.cos(a) * rr, y, Math.sin(a) * rr], [0.065, 0.065, 0.065], FL[i % 4], { on: ['hips'] }); }
      for (let i = 0; i < 14; i++) { const a = r() * TAU, y = -0.25 + r() * 0.5; PE('chest', [Math.cos(a) * 0.33, y, Math.sin(a) * 0.29], [0.06, 0.06, 0.06], FL[i % 4], { on: ['chest', 'torso'] }); } }
    // face props
    const MO = W ? '#9a3050' : '#2a1a14';
    A('head', RG.box(0.42, 0.024, 0.04), MO, [0, 0.115, 0.3], { outline: false, surf: [0, 0, 1, -0.005] });
    for (const s of [-1, 1]) {
      A('head', RG.box(0.06, 0.024, 0.04), MO, [s * 0.225, 0.1, 0.26], { rot: [0, s * 0.5, s * -0.35], outline: false });
      A('head', RG.sph(0.075, 0.07, 0.05), '#e8d888', [s * 0.14, 0.32, 0.205]); A('head', RG.box(0.075, 0.026, 0.02), '#121010', [s * 0.14, 0.32, 0.252], { outline: false });
      A('head', RG.box(0.11, 0.028, 0.035), SK, [s * 0.14, 0.375, 0.2], { rot: [0.5, 0, 0] });
      if (!W) { A('head', RG.tor(0.085, 0.013, TAU, 4, 12), '#1a1410', [s * 0.14, 0.32, 0.27], { outline: false }); A('head', RG.box(0.015, 0.015, 0.26), '#1a1410', [s * 0.235, 0.33, 0.14], { outline: false }); }
      else A('head', RG.box(0.1, 0.02, 0.02), '#121010', [s * 0.15, 0.395, 0.23], { rot: [0, 0, s * -0.3], outline: false });
      A('head', RG.sph(0.03, 0.02, 0.02, 5, 4), WART, [s * 0.24, 0.2, 0.16], { outline: false, surf: [s * 0.6, 0.3, 0.7, -0.008] });
    }
    if (!W) { A('head', RG.box(0.1, 0.015, 0.015), '#1a1410', [0, 0.33, 0.28], { outline: false }); A('head', RG.sph(0.03, 0.02, 0.025, 5, 4), WART, [0.05, 0.36, 0.0], { outline: false, surf: [0, 1, 0, -0.008] });
      // cardigan edges, pockets, buttons, collar (sit on the chest surface)
      for (const s of [-1, 1]) { A('chest', RG.box(0.06, 0.46, 0.04), '#5e3e24', [s * 0.13, 0.0, 0.2], { rot: [0.12, 0, 0], surf: [0, 0, 1, 0.0] }); A('torso', RG.box(0.11, 0.09, 0.04), '#5e3e24', [s * 0.2, 0.1, 0.2], { surf: [0, 0, 1, 0.0] }); }
      for (const y of [0.13, 0.02, -0.1]) A('chest', RG.box(0.03, 0.03, 0.03), '#e8d8a8', [-0.13, y, 0.25], { outline: false, surf: [0, 0, 1, 0.012] });
      A('chest', RG.box(0.16, 0.05, 0.06), '#5e3e24', [0, 0.3, 0.14], { surf: [0, 0.4, 1, -0.01] });
      for (const [x, y, z] of [[0.14, 0.12, -0.27], [-0.1, -0.02, -0.29], [0.04, 0.14, -0.28]]) A('chest', RG.sph(0.035, 0.03, 0.03, 5, 4), '#5e3e24', [x, y, z], { outline: false, surf: [0, 0, -1, -0.01] });
    } else { // lace collar + pearls, gold bangle
      A('chest', RG.cyl(0.17, 0.2, 0.06, 12), '#efe8dc', [0, 0.3, 0.02]);
      for (let k = -5; k <= 5; k++) { const a = k * 0.27; A('chest', RG.sph(0.034, 0.034, 0.034, 6, 4), '#f6f2ea', [Math.sin(a) * 0.21, 0.27 - Math.abs(k) * 0.012, Math.cos(a) * 0.21], { outline: false, surf: [Math.sin(a), 0.25, Math.cos(a), 0.02] }); }
      A('elL', RG.cyl(0.088, 0.088, 0.04, 10), '#c8a040', [0, -d.fore + 0.06, 0], { outline: false });
    }
    // props on the prop bones
    if (!W) { // the wooden walking cane (identical placement to the old rig: tip at swR (0, 0.63, 0))
      A('swR', RG.cyl(0.024, 0.026, 0.66, 6), '#7a4a22', [0, 0.3, 0]); A('swR', RG.tor(0.07, 0.022, Math.PI, 4, 8), '#6a3e1c', [0.07, -0.04, 0], { rot: [0, 0, Math.PI] });
      A('swR', RG.cyl(0.032, 0.032, 0.06, 6), '#1a1a1a', [0, 0.63, 0], { outline: false });
    } else { // the handbag on its own swing bone
      A('purse', RG.box(0.03, 0.3, 0.02), '#3a1a1a', [0, 0.14, 0], { outline: false }); A('purse', RG.box(0.32, 0.25, 0.13), '#6a1f3a', [0, 0.4, 0]);
      A('purse', RG.box(0.33, 0.04, 0.14), '#4a1428', [0, 0.52, 0]); A('purse', RG.box(0.06, 0.05, 0.03), '#c8a040', [0, 0.5, 0.08], { outline: false });
    }
  };
}
function rigBrewSpec() { // the ONE-EYED BREWMASTER: round head, one big monocled eye + one squint, handlebar mustache, a single curl, vest + apron + bow tie
  return ({ E, C, PE, PB, A }, d) => {
    const NAVY = '#2a2e48', VEST = '#b0562a', WHITE = '#f4f0e6', SKIN = '#f2c49a', SHOE = '#141018', HAIR = '#3a2210';
    E('hips', [0, 0.06, 0], [0.5, 0.3, 0.42], NAVY);
    E('torso', [0, 0.38, 0.02], [0.66, 0.62, 0.56], VEST, { k: 0.08 }); E('chest', [0, 0.2, -0.04], [0.6, 0.46, 0.5], VEST, { k: 0.08 });
    E('head', [0, 0.04, 0.04], [0.6, 0.6, 0.6], SKIN, { k: 0.08 });
    for (const s of [-1, 1]) E('head', [s * 0.6, 0.04, 0.04], [0.1, 0.14, 0.1], '#e8b088', { k: 0.05 });
    E('head', [0, -0.04, 0.64], [0.15, 0.15, 0.15], '#e89a7a', { k: 0.05 }); // bulb nose
    for (const k of ['L', 'R']) {
      E('sh' + k, [0, 0, 0], [0.22, 0.22, 0.22], WHITE); C('sh' + k, [0, 0, 0], [0, -d.upper, 0], 0.17, 0.15, WHITE);
      C('el' + k, [0, 0, 0], [0, -d.fore + 0.04, 0], 0.15, 0.13, SKIN); E('ha' + k, [0, -0.06, 0.02], [0.15, 0.1, 0.15], SKIN, { k: 0.04 }); E('fg' + k, [0, -0.02, 0.04], [0.14, 0.09, 0.13], SKIN, { k: 0.04 });
      PB('el' + k, [0, -0.03, 0], [0.22, 0.06, 0.22], '#e4ded2', { on: ['el' + k, 'sh' + k] }); // rolled sleeve
      C('lg' + k, [0, 0.03, 0], [0, -d.thigh, 0], 0.21, 0.19, NAVY); C('kn' + k, [0, 0, 0], [0, -d.shin + 0.06, 0], 0.19, 0.17, NAVY);
      E('ft' + k, [0, -0.03, 0.0], [0.17, 0.1, 0.17], SHOE, { rigid: true, k: 0.03 }); E('toe' + k, [0, 0, 0.06], [0.17, 0.09, 0.15], SHOE, { rigid: true, k: 0.03 });
    }
    // paint: shirt front between the vest panels, leather apron + pocket + top band, belt (trunk only)
    const TR = ['torso', 'chest', 'hips'];
    PB('torso', [0, -0.06, 0], [0.9, 0.05, 0.9], '#3a2a1a', { on: TR });
    PE('chest', [0, 0.12, 0.5], [0.22, 0.6, 0.35], WHITE, { on: TR }); PE('torso', [0, 0.5, 0.55], [0.2, 0.4, 0.3], WHITE, { on: TR });
    PB('torso', [0, 0.0, 0.62], [0.36, 0.5, 0.42], '#6a4428', { on: TR }); PB('torso', [0, 0.5, 0.62], [0.33, 0.035, 0.42], '#4a2e1a', { on: TR }); PB('torso', [0, -0.06, 0.7], [0.15, 0.11, 0.3], '#5a3a22', { on: TR });
    // face
    A('head', RG.sph(0.17, 0.17, 0.12, 10, 8), '#ffffff', [-0.22, 0.17, 0.5], { surf: [0, 0, 1, -0.02] }); A('head', RG.sph(0.085, 0.085, 0.05, 8, 6), '#14101f', [-0.21, 0.17, 0.62], { outline: false, surf: [0, 0, 1, 0.06] });
    A('head', RG.sph(0.03, 0.03, 0.02, 5, 4), '#ffffff', [-0.18, 0.21, 0.64], { outline: false, surf: [0, 0, 1, 0.08] });
    A('monocle', RG.tor(0.19, 0.035, TAU, 5, 14), '#e8c070', [0, 0, 0.0]); A('monocle', RG.cyl(0.008, 0.008, 0.5, 4), '#e8c070', [-0.14, -0.23, -0.04], { rot: [0, 0, 0.5], outline: false });
    A('head', RG.box(0.22, 0.035, 0.05), '#5a3018', [0.22, 0.17, 0.5], { rot: [0, 0, -0.18], outline: false, surf: [0, 0, 1, 0.0] }); A('head', RG.box(0.24, 0.05, 0.05), '#4a2a16', [0.22, 0.3, 0.5], { rot: [0, 0, 0.12], surf: [0, 0, 1, 0.0] });
    A('head', RG.box(0.3, 0.07, 0.06), '#4a2a16', [-0.22, 0.42, 0.48], { rot: [0, 0, -0.1], surf: [0, 0.3, 1, 0.0] });
    A('head', RG.tor(0.12, 0.04, Math.PI * 1.6, 5, 10), HAIR, [0, 0.72, 0.05], { rot: [0, Math.PI / 2, 0.4] });
    A('head', RG.box(0.18, 0.04, 0.04), '#8a3a3a', [0, -0.3, 0.5], { outline: false, surf: [0, 0, 1, 0.0] });
    for (const s of [-1, 1]) { A('mustache', RG.cyl(0.07, 0.1, 0.42, 6), HAIR, [s * 0.2, 0, 0], { rot: [0, 0, s * 1.35] }); A('mustache', RG.tor(0.08, 0.035, Math.PI * 1.5, 4, 8), HAIR, [s * 0.42, 0.06, 0], { rot: [0, 0, s > 0 ? 0 : Math.PI] }); }
    A('chest', RG.box(0.34, 0.12, 0.08), '#2ab0a0', [0, 0.42, 0.4], { surf: [0, 0.25, 1, 0.02] }); A('chest', RG.sph(0.07, 0.07, 0.05, 6, 5), '#1a8a7a', [0, 0.42, 0.44], { surf: [0, 0.25, 1, 0.06] });
    for (const y of [0.24, 0.08]) A('chest', RG.sph(0.04, 0.04, 0.03, 6, 5), '#e8c070', [0.2, y, 0.4], { outline: false, surf: [0, 0, 1, 0.0] });
    // the mash paddle in his right hand (prop bone)
    A('swR', RG.cyl(0.05, 0.05, 1.45, 6), '#a07040', [0, 0.5, 0]); A('swR', RG.box(0.34, 0.55, 0.08), '#b8844a', [0, 1.42, 0]); A('swR', RG.box(0.36, 0.06, 0.1), '#7a5030', [0, 1.13, 0]);
  };
}
// grid steps tuned for the budgets (Harold / Mavis ~3-5k tris, Brewmaster ~2-3k)
const RIG_KINDS = {
  harold: () => [RIG_HERO_D, rigToadSpec(false), 0.034, 0.03, [0.95, 2.6], 3400],
  mavis: () => [RIG_HERO_D, rigToadSpec(true), 0.038, 0.03, [0.95, 2.6], 3500],
  brew: () => [RIG_BREW_D, rigBrewSpec(), 0.06, 0.07, [1.5, 3.6], 1900],
};
function rigBuild(kind) { const [d, spec, h, blend, sph, tgt] = RIG_KINDS[kind](); return rigInstance(kind, d, spec, h, blend, sph, tgt); }

// ---------- clips: keyframes authored in code, baked at 20 fps ----------
const RIG_FPS = 20;
const KP = (base, mods = {}) => { const p = blank(); if (base) for (const k in base) p[k] = Array.isArray(base[k]) ? base[k].slice() : base[k]; for (const k in mods) p[k] = Array.isArray(mods[k]) ? mods[k].slice() : mods[k]; return p; };
const rigStance = (wide, bend, mods) => { const p = blank(); legsStance(p, wide, bend); return KP(p, mods); };
const R_IDLE = rigStance(0.16, 0.42, { torso: [0.14, 0.32, 0], neck: [-0.1, -0.3, 0], hips: [0, -0.25, 0], shL: [-0.55, 0, 0.42], elL: [-1.1, 0, 0], haL: [0.15, 0, 0], swL: [Math.PI / 2 + 0.55, 0, 0.35],
  shR: [-0.25, 0, -0.3], elR: [-0.5, 0, 0], swR: [Math.PI - 0.25, 0, 0], fgL: [-0.35, 0, 0], fgR: [-0.8, 0, 0] });
function rigCycleKeys(n, fn) { const K = []; for (let i = 0; i <= n; i++) K.push([i / n, fn(i / n * TAU)]); return K; }
const RIG_CLIP_SRC = {
  idle: { dur: TAU / 3.2, loop: true, interp: 'cr', keys: [
    [0, KP(R_IDLE)], [0.25, KP(R_IDLE, { y: R_IDLE.y + 0.025, chest: [-0.035, 0, 0], neck: [-0.13, -0.3, 0], fgL: [-0.5, 0, 0] })],
    [0.5, KP(R_IDLE, { chest: [0, 0.02, 0] })], [0.75, KP(R_IDLE, { y: R_IDLE.y - 0.025, chest: [0.035, 0, 0], neck: [-0.07, -0.32, 0], jaw: [0.04, 0, 0], swR: [Math.PI - 0.2, 0, 0.04] })], [1, KP(R_IDLE)]] },
  walk: { dur: TAU / 7.5, loop: true, interp: 'cr', keys: rigCycleKeys(8, (ph) => { const p = blank(); runLegs(p, ph, 0.45); const s = Math.sin(ph);
    return KP(p, { torso: [0.2, s * 0.08, 0], chest: [0.03, -s * 0.08, 0], neck: [-0.15, -s * 0.06, 0], shL: [0.5 * s, 0, 0.25], elL: [-0.45, 0, 0], swL: [Math.PI / 2 + 0.6, 0, 0.3],
      shR: [-0.35 - 0.3 * s, 0, -0.28], elR: [-0.45, 0, 0], swR: [Math.PI - 0.45 + 0.25 * s, 0, 0], fgR: [-0.8, 0, 0], fgL: [-0.3, 0, 0], toeL: [Math.max(0, -Math.cos(ph)) * 0.45, 0, 0], toeR: [Math.max(0, Math.cos(ph)) * 0.45, 0, 0] }); }) },
  run: { dur: TAU / 12, loop: true, interp: 'cr', keys: rigCycleKeys(8, (ph) => { const p = blank(); runLegs(p, ph, 1); const s = Math.sin(ph);
    return KP(p, { torso: [0.42, s * 0.15, 0], chest: [0.05, -s * 0.1, 0], neck: [-0.32, -s * 0.12, 0], shL: [1.0, 0, 0.35], elL: [-0.35, 0, 0], swL: [Math.PI / 2 + 1.1, 0, 0.2],
      shR: [0.6, 0, -0.35], elR: [-0.5, 0, 0], swR: [Math.PI - 0.6, 0, 0], fgR: [-0.8, 0, 0], fgL: [-0.5, 0, 0], toeL: [Math.max(0, -Math.cos(ph)) * 0.6, 0, 0], toeR: [Math.max(0, Math.cos(ph)) * 0.6, 0, 0] }); }) },
};
{ // the cane combo (same timing as the old atk1-3: wind-up hold to u .12, sweep to u .45, follow-through)
  const L = { lgL: [-0.7, 0, 0.18], knL: [0.75, 0, 0], lgR: [0.35, 0, -0.18], knR: [0.3, 0, 0] }, Lm = { lgR: [-0.7, 0, -0.18], knR: [0.75, 0, 0], lgL: [0.35, 0, 0.18], knL: [0.3, 0, 0] };
  const a10 = rigStance(0.2, 0.55, Object.assign({ torso: [0.2, -0.85, 0], hips: [0, -0.4, 0], neck: [-0.1, 0.6, 0], chest: [0, -0.22, 0], shR: [-1.1, 0, -1.25], elR: [-0.7, 0, 0], swR: [Math.PI / 2, 0, -0.6], fgR: [-0.9, 0, 0],
    shL: [-0.4, 0, 0.5], elL: [-1.2, 0, 0], swL: [Math.PI / 2 + 0.6, 0, 0.3] }, L));
  const a11 = KP(a10, { torso: [0.2, 0.95, 0], hips: [0, 0.45, 0], neck: [-0.1, -0.6, 0], chest: [0, 0.28, 0], shR: [-1.45, 0, 0.55], elR: [-0.1, 0, 0], swR: [Math.PI / 2, 0, 0.3], jaw: [0.12, 0, 0] });
  RIG_CLIP_SRC.atk1 = { dur: 0.36, keys: [[0, a10], [0.12, KP(a10, { chest: [0, -0.3, 0] })], [0.45, a11], [0.62, KP(a11, { chest: [0, 0.34, 0], torso: [0.22, 1.0, 0] })], [1, KP(a11, { chest: [0, 0.12, 0], jaw: [0, 0, 0] })]] };
  const a20 = rigStance(0.2, 0.55, Object.assign({ torso: [0.2, 0.85, 0], hips: [0, 0.4, 0], neck: [-0.1, -0.6, 0], chest: [0, 0.22, 0], shL: [-1.1, 0, 1.25], elL: [-0.7, 0, 0], swL: [Math.PI / 2, 0, 0.6],
    shR: [-0.4, 0, -0.5], elR: [-1.2, 0, 0], swR: [Math.PI / 2 + 0.6, 0, -0.3], fgR: [-0.9, 0, 0] }, Lm));
  const a21 = KP(a20, { torso: [0.2, -0.95, 0], hips: [0, -0.45, 0], neck: [-0.1, 0.6, 0], chest: [0, -0.28, 0], shL: [-1.45, 0, -0.55], elL: [-0.1, 0, 0], swL: [Math.PI / 2, 0, -0.3], jaw: [0.12, 0, 0] });
  RIG_CLIP_SRC.atk2 = { dur: 0.36, keys: [[0, a20], [0.12, KP(a20, { chest: [0, 0.3, 0] })], [0.45, a21], [0.62, KP(a21, { chest: [0, -0.34, 0], torso: [0.22, -1.0, 0] })], [1, KP(a21, { chest: [0, -0.12, 0], jaw: [0, 0, 0] })]] };
  const w3 = rigStance(0.24, 0.35, { shL: [-0.8, 0, 0.3], shR: [-0.8, 0, -0.3], elL: [-1.3, 0, 0], elR: [-1.3, 0, 0], torso: [0.35, 0.6, 0], chest: [0.1, 0.25, 0], y: -0.15, fgR: [-0.9, 0, 0] });
  const s3 = (a, y) => rigStance(0.24, 0.35, { tilt: [0, -a * TAU, 0], y, lgL: [-0.9, 0, 0.1], knL: [1.4, 0, 0], lgR: [-0.2, 0, -0.15], knR: [0.6, 0, 0], shL: [-0.15, 0, 1.45], shR: [-0.15, 0, -1.45],
    elL: [-0.1, 0, 0], elR: [-0.1, 0, 0], swL: [Math.PI / 2, 0, -0.2], swR: [Math.PI / 2, 0, 0.2], torso: [0.1, 0, 0], chest: [0, -0.15, 0], fgR: [-0.9, 0, 0], jaw: [0.15, 0, 0], toeL: [0.4, 0, 0], toeR: [0.3, 0, 0] });
  RIG_CLIP_SRC.atk3 = { dur: 0.6, keys: [[0, w3], [0.14, w3], [0.2, s3(0.03, 0.22)], [0.4, s3(0.5, 0.45)], [0.65, s3(1, 0.12)], [0.72, KP(s3(1, 0), { chest: [0.1, 0.1, 0] })], [1, KP(s3(1, 0), { chest: [0, 0, 0], jaw: [0, 0, 0], lgL: [-0.5, 0, 0.1], knL: [0.7, 0, 0] })]] };
}
{ // hit, knockdown, get-up, dodge roll, victory
  const h0 = rigStance(0.16, 0.5, { torso: [-0.45, 0.2, 0], neck: [-0.5, 0, 0], chest: [-0.22, 0, 0], jaw: [0.28, 0, 0], shL: [-0.8, 0, 0.9], shR: [-0.8, 0, -0.9], elL: [-0.7, 0, 0], elR: [-0.7, 0, 0],
    swL: [Math.PI / 2 + 0.8, 0, 0], swR: [Math.PI / 2 + 0.8, 0, 0], fgL: [0.4, 0, 0], fgR: [-0.6, 0, 0] });
  RIG_CLIP_SRC.hurt = { dur: 0.35, interp: 'lin', keys: [[0, h0], [0.3, KP(h0, { torso: [-0.3, 0.16, 0], neck: [-0.35, 0, 0], chest: [-0.1, 0, 0], jaw: [0.15, 0, 0] })], [1, KP(h0, { torso: [0, 0.2, 0], neck: [0, 0, 0], chest: [0, 0, 0], jaw: [0, 0, 0] })]] };
  const lie = KP(null, { tilt: [-Math.PI / 2 + 0.08, 0, 0], lgL: [-0.6, 0, 0.3], knL: [0.9, 0, 0], lgR: [-0.2, 0, -0.2], knR: [0.4, 0, 0], shL: [-2.6, 0, 0.6], shR: [-2.4, 0, -0.9], elL: [-0.4, 0, 0], elR: [-0.4, 0, 0],
    neck: [0.4, 0, 0], swL: [Math.PI / 2, 0, 0], swR: [Math.PI / 2, 0, 0], fgR: [-0.6, 0, 0], toeL: [0.3, 0, 0], toeR: [0.2, 0, 0], jaw: [0.2, 0, 0] });
  RIG_CLIP_SRC.knockdown = { dur: 0.45, keys: [[0, KP(h0, { y: 0 })], [0.45, KP(lie, { tilt: [-Math.PI / 2 * 0.62, 0, 0], shL: [-2.0, 0, 1.1], shR: [-2.0, 0, -1.2], lgL: [-0.9, 0, 0.3], knL: [1.1, 0, 0], chest: [-0.2, 0, 0] })],
    [0.8, KP(lie, { tilt: [-Math.PI / 2 - 0.05, 0, 0], chest: [0.1, 0, 0] })], [1, lie]] };
  const g = (k) => rigStance(0.2, 1.2 * (1 - k), { torso: [0.8 * (1 - k), 0, 0], neck: [-0.1 - 0.3 * (1 - k), -0.3 * k, 0], shL: [lerp(0.4, -0.55, k), 0, 0.42], elL: [lerp(-0.2, -1.1, k), 0, 0], shR: [lerp(0.3, -0.25, k), 0, -0.3], elR: [lerp(-0.2, -0.5, k), 0, 0],
    swL: [Math.PI / 2 + 0.55, 0, 0.35], swR: [Math.PI - 0.25, 0, 0], fgR: [-0.8, 0, 0], chest: [0.2 * (1 - k), 0, 0] });
  RIG_CLIP_SRC.getup = { dur: 0.45, keys: [[0, g(0)], [0.55, KP(g(0.5), { chest: [0.25, 0, 0] })], [1, g(1)]] };
  const tuck = (a, ty, y) => KP(null, { tilt: [a, 0, 0], ty, y, lgL: [-1.6, 0, 0.12], lgR: [-1.6, 0, -0.12], knL: [2.2, 0, 0], knR: [2.2, 0, 0], ftL: [0.4, 0, 0], ftR: [0.4, 0, 0], torso: [0.9, 0, 0], chest: [0.4, 0, 0], neck: [0.3, 0, 0],
    shL: [-1.2, 0, 0.3], shR: [-1.2, 0, -0.3], elL: [-1.6, 0, 0], elR: [-1.6, 0, 0], swL: [Math.PI / 2 + 1.2, 0, 0], swR: [Math.PI / 2 + 1.2, 0, 0], fgR: [-0.9, 0, 0] });
  RIG_CLIP_SRC.roll = { dur: 0.5, keys: [[0, rigStance(0.2, 1.0, { torso: [0.6, 0, 0], chest: [0.2, 0, 0], shL: [-0.8, 0, 0.4], shR: [-0.8, 0, -0.4], elL: [-1.0, 0, 0], elR: [-1.0, 0, 0], swR: [Math.PI / 2 + 0.6, 0, 0] })],
    [0.2, tuck(Math.PI * 0.45, 0.25, -0.2)], [0.5, tuck(Math.PI, 0.55, -0.25)], [0.78, tuck(Math.PI * 1.6, 0.3, -0.2)], [1, rigStance(0.2, 0.9, { tilt: [TAU, 0, 0], torso: [0.5, 0, 0], shL: [-0.6, 0, 0.5], shR: [-0.6, 0, -0.5], swR: [Math.PI / 2 + 0.6, 0, 0] })]] };
  const v = (y, wv, j) => KP(R_IDLE, { y: R_IDLE.y + y, shR: [-3.0, 0, -0.3], elR: [-0.2, 0, 0], swR: [Math.PI / 2 - 0.2, 0, 0], shL: [-2.6, 0, 0.5 + wv], elL: [-0.3, 0, 0], torso: [-0.05, 0.1, 0], chest: [-0.15, 0, 0], neck: [-0.25, 0, 0], jaw: [j, 0, 0], fgL: [0, 0, 0] });
  RIG_CLIP_SRC.victory = { dur: 1.0, loop: true, interp: 'cr', keys: [[0, v(0, 0, 0.1)], [0.25, v(0.17, 0.35, 0.3)], [0.5, v(0, 0, 0.1)], [0.75, v(0.17, -0.2, 0.3)], [1, v(0, 0, 0.1)]] };
  // MAVIS: the handbag swing (wind back, big flat swing, the bag lags on its own bone and whips through)
  const p0 = rigStance(0.2, 0.55, { torso: [0.15, -0.9, 0], hips: [0, -0.4, 0], chest: [0, -0.25, 0], neck: [-0.1, 0.65, 0], shR: [-1.0, 0, -1.35], elR: [-0.35, 0, 0], swR: [Math.PI / 2 + 0.3, 0, 0], purse: [0, 0, -0.35],
    shL: [-0.5, 0, 0.6], elL: [-1.1, 0, 0], lgL: [-0.7, 0, 0.18], knL: [0.75, 0, 0], lgR: [0.35, 0, -0.18], knR: [0.3, 0, 0] });
  const p1 = KP(p0, { torso: [0.22, 0.95, 0], hips: [0, 0.45, 0], chest: [0, 0.3, 0], neck: [-0.1, -0.6, 0], shR: [-1.5, 0, 0.6], elR: [-0.05, 0, 0], purse: [0, 0, 0.9], jaw: [0.2, 0, 0] });
  RIG_CLIP_SRC.purse = { dur: 0.5, keys: [[0, p0], [0.15, KP(p0, { purse: [0, 0, -0.6], chest: [0, -0.32, 0] })], [0.45, p1], [0.62, KP(p1, { purse: [0, 0, 1.5], chest: [0, 0.36, 0] })], [1, KP(p1, { purse: [0, 0, 0.3], chest: [0, 0.1, 0], jaw: [0, 0, 0] })]] };
  // BREWMASTER: can-tower slam, the spin, the mustache twirl
  const up = (k) => rigStance(0.2, 0.35, { shL: [-2.9 - k * 0.1, 0, 0.3], shR: [-2.9 - k * 0.1, 0, -0.3], elL: [-0.35, 0, 0], elR: [-0.35, 0, 0], chest: [-0.25 - k * 0.08, 0, 0], torso: [-0.15, 0, 0], neck: [-0.3, 0, 0], jaw: [0.15 + k * 0.1, 0, 0], y: 0.02 + k * 0.03, fgL: [-0.6, 0, 0], fgR: [-0.6, 0, 0], swR: [Math.PI - 0.3, 0, 0] });
  const slam = rigStance(0.24, 0.95, { shL: [0.25, 0, 0.25], shR: [0.25, 0, -0.25], elL: [-0.25, 0, 0], elR: [-0.25, 0, 0], torso: [0.55, 0, 0], chest: [0.3, 0, 0], neck: [-0.4, 0, 0], jaw: [0.35, 0, 0], fgL: [-1.0, 0, 0], fgR: [-1.0, 0, 0], swR: [Math.PI - 0.2, 0, 0] });
  RIG_CLIP_SRC.canslam = { dur: 1.2, keys: [[0, KP(R_IDLE)], [0.35, up(0)], [0.6, up(1)], [0.72, slam], [0.8, KP(slam, { y: slam.y - 0.04, chest: [0.36, 0, 0] })], [1, slam]] };
  const sp = (s) => rigStance(0.2, 0.3, { shL: [-0.2, 0, 1.45], shR: [-0.2, 0, -1.45], elL: [-0.1, 0, 0], elR: [-0.1, 0, 0], torso: [0.1, s * 0.15, 0], chest: [0, s * 0.12, 0], neck: [-0.1, -s * 0.2, 0], mustache: [0, 0, s * 0.35], jaw: [0.1, 0, 0],
    lgL: [-0.3 - 0.3 * s, 0, 0.15], lgR: [-0.3 + 0.3 * s, 0, -0.15], knL: [0.5 + 0.3 * s, 0, 0], knR: [0.5 - 0.3 * s, 0, 0], fgL: [0.2, 0, 0], fgR: [-0.6, 0, 0], swR: [Math.PI, 0, 0] });
  RIG_CLIP_SRC.spin = { dur: 0.5, loop: true, interp: 'cr', keys: [[0, sp(0)], [0.25, sp(1)], [0.5, sp(0)], [0.75, sp(-1)], [1, sp(0)]] };
  const tw = (s) => KP(R_IDLE, { shR: [-2.0, 0.35, -0.15], elR: [-2.0, 0, 0], haR: [0.2, 0, 0.3 * s], fgR: [-0.3 - 0.5 * (1 + s), 0, 0], shL: [0.15, 0, 0.75], elL: [-1.4, 0.6, 0], haL: [0.4, 0, 0], mustache: [0, 0, 0.12 + 0.45 * s], neck: [-0.15, 0.15, 0.12 * s], chest: [0, -0.06, 0.04 * s], swR: [Math.PI / 2, 0, 0] });
  RIG_CLIP_SRC.twirl = { dur: 0.8, loop: true, interp: 'cr', keys: [[0, tw(0)], [0.25, tw(1)], [0.5, tw(0)], [0.75, tw(-1)], [1, tw(0)]] };
}
// bake: every joint channel + y / ty at 20 fps
const RIG_CH = () => JOINTS.length * 3 + 2;
function rigBake(src) {
  const n = Math.max(2, Math.round(src.dur * RIG_FPS) + 1), C = RIG_CH(), out = new Float32Array(n * C), K = src.keys, flat = (p) => { const a = new Float32Array(C); JOINTS.forEach((j, i) => { const v = p[j] || [0, 0, 0]; a[i * 3] = v[0]; a[i * 3 + 1] = v[1]; a[i * 3 + 2] = v[2]; }); a[C - 2] = p.y || 0; a[C - 1] = p.ty || 0; return a; };
  const V = K.map(([, p]) => flat(p)), T = K.map(([t]) => t), cr = src.interp === 'cr', lin = src.interp === 'lin';
  for (let f = 0; f < n; f++) {
    const u = f / (n - 1); let s = 0; while (s < T.length - 2 && u > T[s + 1]) s++;
    const t = clamp((u - T[s]) / Math.max(1e-6, T[s + 1] - T[s]), 0, 1), w = lin ? t : ease(t);
    const a = V[s], b = V[s + 1], a0 = V[s > 0 ? s - 1 : src.loop ? T.length - 2 : s], b1 = V[s + 2 < T.length ? s + 2 : src.loop ? 1 : s + 1];
    for (let c = 0; c < C; c++) {
      if (cr) { const t2 = t * t, t3 = t2 * t; out[f * C + c] = 0.5 * (2 * a[c] + (-a0[c] + b[c]) * t + (2 * a0[c] - 5 * a[c] + 4 * b[c] - b1[c]) * t2 + (-a0[c] + 3 * a[c] - 3 * b[c] + b1[c]) * t3); }
      else out[f * C + c] = a[c] + (b[c] - a[c]) * w;
    }
  }
  return { n, C, F: out, loop: !!src.loop, dur: src.dur };
}
function rigClip(name) { let c = RIGS.clips[name]; if (!c) { const s = RIG_CLIP_SRC[name]; if (!s) return null; c = RIGS.clips[name] = rigBake(s); } return c; }
// sample a clip at u (0..1 through it; loops wrap) into a fresh pose (linear between the 20 fps frames)
function rigSample(name, u, into) {
  const c = rigClip(name), p = into || blank(); if (!c) return p;
  if (c.loop) u = u - Math.floor(u); else u = clamp(u, 0, 1);
  const x = u * (c.n - 1), f0 = Math.min(c.n - 1, Math.floor(x)), f1 = Math.min(c.n - 1, f0 + 1), t = x - f0, F = c.F, C = c.C, A = f0 * C, B = f1 * C;
  JOINTS.forEach((j, i) => { const k = i * 3; p[j] = [F[A + k] + (F[B + k] - F[A + k]) * t, F[A + k + 1] + (F[B + k + 1] - F[A + k + 1]) * t, F[A + k + 2] + (F[B + k + 2] - F[A + k + 2]) * t]; });
  p.y = F[A + C - 2] + (F[B + C - 2] - F[A + C - 2]) * t; p.ty = F[A + C - 1] + (F[B + C - 1] - F[A + C - 1]) * t; p.clip = name; p.u = u;
  return p;
}
function rigBlend(a, b, w) { for (const j of JOINTS) { const x = a[j], y = b[j]; a[j] = [x[0] + (y[0] - x[0]) * w, x[1] + (y[1] - x[1]) * w, x[2] + (y[2] - x[2]) * w]; } a.y += (b.y - a.y) * w; a.ty += (b.ty - a.ty) * w; return a; }

// ---------- swap in ----------
if (RIGS.on) {
  RIGS.legacy = Object.assign({}, HERO_POSES);
  HERO_POSES.idle = (t) => rigSample('idle', t / (TAU / 3.2));
  HERO_POSES.walk = (t) => rigSample('walk', t / (TAU / 7.5));
  HERO_POSES.run = (t, sp) => { const u = t * (7 + sp * 0.9) / TAU, w = clamp((sp - 2.2) / 3, 0, 1); const p = rigSample('walk', u); return w > 0 ? rigBlend(p, rigSample('run', u), w) : p; };
  for (const k of ['atk1', 'atk2', 'atk3', 'hurt', 'getup', 'roll', 'purse']) HERO_POSES[k] = (u) => rigSample(k, u);
  HERO_POSES.down = (u, ground) => { const p = rigSample('knockdown', ground ? 1 : clamp(u * 2.2, 0, 1)); p.ty = ground ? 0.3 : 0.6; return p; };
  HERO_POSES.victory = (t) => rigSample('victory', t);
  HERO_POSES.clip = (name, u) => rigSample(name, u);
  const _bh = buildHero;
  buildHero = (o = {}) => { try { return rigBuild(o.wife ? 'mavis' : 'harold'); } catch (e) { console.warn('rigs: fallback to the part-stack rig', e); RIGS.failed = String(e); return _bh(o); } };
  // the Brewmaster (09w RIG HOOK): built the first time his arena builds; animated by the clips through update()
  window.buildBrewmaster = function () {
    const J = rigBuild('brew'); J.kind = 'brew'; const R = { root: J.root, body: J.torso, head: J.head, armL: J.shL, armR: J.shR, mustache: J.mustache, paddle: J.swR, flash: [J.mat], J };
    J.mat.userData.flashC.value.set('#fff');
    const SY = 1.5; let ry = Math.PI;
    R.update = (dt, st, info) => {
      const t = info.t, u = clamp(info.u, 0, 1); let p, rate = 14, rootRY = Math.PI, glow = null; const mt = u * 1;
      switch (st) {
        case 'towerTell': p = rigSample('canslam', u * 0.62); glow = { c: '#ffd23c', v: 0.25 + 0.25 * (Math.sin(t * 22) * 0.5 + 0.5) }; break;
        case 'tower': p = rigSample('canslam', 0.62 + u * 0.38); rate = 26; break;
        case 'geyTell': p = rigSample('walk', t * 2.6); p.torso = [0.35, 0, 0]; p.shL = [-0.4, 0, 0.8]; p.shR = [-0.4, 0, -0.8]; p.y -= 0.1; R.root.position.y = Math.abs(Math.sin(t * 18)) * 0.08; glow = { c: '#fff6d8', v: 0.2 + 0.3 * (Math.sin(t * 18) * 0.5 + 0.5) }; break;
        case 'gey': p = rigSample('victory', t); break;
        case 'spinTell': p = rigSample('twirl', t / 0.8); rootRY = Math.PI + Math.sin(t * 14) * 0.25 * u; glow = { c: '#ff5fa2', v: 0.2 + 0.3 * u }; break;
        case 'spin': p = rigSample('spin', t / 0.5); rate = 22; break;
        case 'open': p = rigSample('hurt', 0.35); p.torso = [0.45 + Math.sin(t * 9) * 0.05, 0, 0]; p.shL = [0.4, 0, 0.3]; p.shR = [0.4, 0, -0.3]; rootRY = Math.PI + Math.sin(t * 5) * 0.25; break;
        case 'quaked': p = rigSample('hurt', 0); p.shL = [-2.4, 0, 0.4]; p.shR = [-2.4, 0, -0.4]; break;
        case 'haymaker': { const k = info.u * 3.0; p = rigSample('hurt', 0.2); // 09w: setM(st, 'haymaker', 3.0)
          if (k >= 0.9 && k < 1.9) { R.root.position.y = Math.sin(clamp((k - 0.9) / 1.0, 0, 1) * Math.PI * 0.5) * 2.6; p.shL = [-2.8, 0, 0.3]; p.shR = [-2.8, 0, -0.3]; p.torso = [-0.6, 0, 0]; }
          else if (k >= 1.9) { R.root.position.y = damp(R.root.position.y, 0, 6, dt); p.torso = [0.6, 0, 0]; } break; }
        default: p = rigSample('idle', t / (TAU / 3.2)); p.shR = [-0.5 + Math.sin(t * 4) * 0.2, 0, -0.2]; p.elR = [-0.6, 0, 0]; p.shL = [-0.9 + Math.sin(t * 4 + 1) * 0.25, 0, 0.3]; p.neck = [-0.1, 0, Math.sin(t * 5) * 0.08];
      }
      p.y *= SY; p.ty *= SY; applyPose(J, p, rate, dt, false);
      if (st !== 'spin') { const tgt = rootRY + Math.round((R.root.rotation.y - rootRY) / TAU) * TAU; R.root.rotation.y = damp(R.root.rotation.y, tgt, 10, dt); }
      if (glow && J.mat.userData.flash) { J.mat.userData.flashC.value.set(glow.c); J.mat.userData.flash.value = Math.max(J.mat.userData.flash.value, glow.v); }
      void mt; void ry;
    };
    return R;
  };
}

// ---------- test stage (?rigstage=harold|mavis|brew): a lit turntable, the city loop keeps running underneath ----------
RIGS.stage = function (kind, yaw = 0, clip = 'idle', u = 0.3) {
  const T = RIGS.st || (RIGS.st = (() => {
    const sc = new THREE.Scene(); sc.background = new THREE.Color('#9cc8e8');
    sc.add(new THREE.HemisphereLight('#dfe6ff', '#8a7f74', 1.5)); const sun = new THREE.DirectionalLight('#fff3dc', 2.2); sun.position.set(-2.5, 6, 3.5); sc.add(sun);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(6, 40), toonMat()); bakeColor(fl.geometry, '#8a8496'); fl.rotation.x = -Math.PI / 2; sc.add(fl);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60); return { sc, cam, J: null };
  })());
  if (T.J) T.sc.remove(T.J.root);
  T.J = kind === 'brew' ? window.buildBrewmaster().J : rigBuild(kind); T.sc.add(T.J.root); T.J.root.rotation.y = yaw;
  const p = rigSample(clip, u); if (kind === 'brew') { p.y *= 1.5; p.ty *= 1.5; } applyPose(T.J, p, 60, 1, true);
  const H = kind === 'brew' ? 3.0 : 1.75, a = VW() / VH(); T.cam.aspect = a; T.cam.fov = a < 1 ? 2 * Math.atan(Math.tan(15 * Math.PI / 180) / a) * 180 / Math.PI : 30; T.cam.updateProjectionMatrix();
  const vf = Math.tan(T.cam.fov * Math.PI / 360), hf = vf * a, dist = Math.max(H * 0.62 / vf, H * 0.5 / hf); T.cam.position.set(0, H * 0.55, dist); T.cam.lookAt(0, H * 0.47, 0);
  for (const h of QUAL.outlines) if (h === T.J.hull) h.visible = QUAL.hd;
  RIGS.stageOn = true; return RIGS.stats[kind];
};
if (Q.has('rigstage')) { const _dr = draw; draw = (sc, cam) => (RIGS.stageOn && RIGS.st ? _dr(RIGS.st.sc, RIGS.st.cam) : _dr(sc, cam)); }
window.__rigs = RIGS;
