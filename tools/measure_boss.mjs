// tools/measure_boss.mjs — boss measuring harness (O6). Built on Hark's harness/realK.mjs + harness/fakedom.mjs (both unchanged).
// Usage (repo root, three@0.160.0 resolvable, e.g. NODE_PATH=tools/node_modules):
//   BOSS=./src/boss_admiral_redclaw.js node tools/measure_boss.mjs        -> tools/results_boss_<id>.json
// Everything is measured with the root scaled by META.scale (the game sets J.root.scale = META.scale; J-003 / H-002 Q-c).
// Checks: budgets (parts / tris / materials / hulls / flash sharing / shadow rule), height vs META, idle reach beyond META.radius,
// static poses (lowest point + limb gaps), the boss state sequences of tools/boss_seq.js simulated at 60 fps with the real damping
// (lowest non-hull vertex excluding feet and weapon, rig-space culling radius), ATTACKS contract + strike frame vs active window,
// the real mergeRig (kit/real_mergeRig.js), determinism and texture-cache behaviour. Builds run on the ZIP kit AND the game's K.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fakeDocument, CANVAS_LOG } from '../harness/fakedom.mjs';
globalThis.document = fakeDocument;
const { K: KR } = await import('../kit/toadcity_kit.js');
const { mergeRig } = await import('../kit/real_mergeRig.js');
const { K: KG } = await import('../harness/realK.mjs');
const { seqList, seqAt, seqDur, SEQ_NAMES } = await import('./boss_seq.js');
const M = await import(pathToFileURL(path.resolve(process.env.BOSS)).href);
const META = M.META, ATTACKS = M.ATTACKS, P = M.POSES;
const BUILD = M[Object.keys(M).find((k) => k.startsWith('build') && typeof M[k] === 'function' && k.toLowerCase() === ('build' + META.id.replace(/_/g, '')).toLowerCase())]
  || M[Object.keys(M).find((k) => k.startsWith('build') && typeof M[k] === 'function')];
const animate = M.animateBoss || (() => {});
const THREE = KR.THREE, SC = META.scale;
const out = { id: META.id, meta: META, budgets: {}, idle0: {}, reach: {}, poses: {}, seq: {}, attacks: {}, merge: {}, determinism: {}, misc: {} };
const r3 = (x) => +x.toFixed(3);

const isHull = (o) => o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide;
const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
function count(J, K) {
  let parts = 0, tris = 0, hullTris = 0, hulls = 0, badHull = 0, flashBad = 0, shadow = 0; const mats = new Set(), shadowBad = [];
  J.root.traverse((o) => {
    if (!o.isMesh) return; mats.add(o.material);
    if (isHull(o)) { hulls++; hullTris += tri(o.geometry); if (o.material !== K.OUT_CHAR) badHull++; return; }
    parts++; tris += tri(o.geometry); if (o.castShadow) shadow++;
    const fl = o.material.userData.flash;
    if (fl !== J.mat.userData.flash || o.material.userData.flashC !== J.mat.userData.flashC) flashBad++;
    // hard rule 9: outline:false parts and parts thinner than 4 cm in two dimensions must not cast shadows
    const hasHull = o.children.some(isHull); o.geometry.computeBoundingBox(); const s = new THREE.Vector3(); o.geometry.boundingBox.getSize(s);
    const thin = [s.x, s.y, s.z].filter((v) => v < 0.04).length >= 2;
    if (o.castShadow && (!hasHull || thin)) shadowBad.push((o.name || o.parent?.name || '?') + (thin ? ':thin' : ':nohull'));
  });
  const matKinds = [...mats].filter((m) => !isHull({ material: m })).map((m) => (m.isMeshBasicMaterial ? 'basic' : m.map ? 'mapped' : 'toon'));
  return { parts, tris, hulls, hullTris, mats: [...mats].filter((m) => !isHull({ material: m })).length, matKinds, badHull, flashBad, shadowCasters: shadow, shadowBad, drawCallsUnmerged: parts + hulls };
}
const skipSet = (J) => new Set([J.ftL, J.ftR, J.swR, J.swL].filter(Boolean));
const _v = new THREE.Vector3();
// lowest non-hull vertex (world) skipping feet + weapon subtrees, plus the max rig-space distance from the culling centre (all parts)
function scan(J) {
  J.root.updateMatrixWorld(true);
  const skip = skipSet(J), inv = new THREE.Matrix4().copy(J.root.matrixWorld).invert(), C = new THREE.Vector3(0, 0.95, 0);
  let minY = 1e9, minName = '', cull = 0, cullName = '';
  const names = new Map(Object.entries(J).filter(([k, v]) => v && v.isObject3D).map(([k, v]) => [v, k]));
  const nm = (o) => { let p = o; while (p && !names.has(p)) p = p.parent; return p ? names.get(p) : '?'; };
  const walk = (o, sk) => {
    sk = sk || skip.has(o);
    if (o.isMesh && !isHull(o) && o.visible) {
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        _v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
        if (!sk && _v.y < minY) { minY = _v.y; minName = nm(o); }
        _v.applyMatrix4(inv); const d = _v.distanceTo(C); if (d > cull) { cull = d; cullName = nm(o); }
      }
    }
    for (const c of o.children) walk(c, sk);
  };
  walk(J.root, false);
  return { minY, minName, cull, cullName };
}
function bbox(J, noWeapon) {
  const b = new THREE.Box3(); J.root.updateMatrixWorld(true); const skip = noWeapon ? new Set([J.swR, J.swL].filter(Boolean)) : new Set();
  const walk = (o, sk) => { sk = sk || skip.has(o); if (o.isMesh && !isHull(o) && o.visible && !sk) b.expandByObject(o); for (const c of o.children) walk(c, sk); };
  walk(J.root, false); return b;
}
function snap(K, J, p, t, state, u) { K.applyPose(J, p, 1e4, 1, true); animate(J, t, state, u); J.root.updateMatrixWorld(true); }
const fresh = (K, o = {}) => { const J = BUILD(K, Object.assign({ seed: 7 }, o)); J.root.scale.setScalar(SC); return J; };

// ---- limb gaps (same method as Hark's measure_gang: surface samples, nearest pair, flag > 2.5 cm) ----
function worldVerts(meshes) {
  const a = [], A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (const m of meshes) {
    const g = m.geometry, p = g.attributes.position, ix = g.index, n = ix ? ix.count : p.count;
    for (let t = 0; t < n; t += 3) {
      const i0 = ix ? ix.getX(t) : t, i1 = ix ? ix.getX(t + 1) : t + 1, i2 = ix ? ix.getX(t + 2) : t + 2;
      A.fromBufferAttribute(p, i0).applyMatrix4(m.matrixWorld); B.fromBufferAttribute(p, i1).applyMatrix4(m.matrixWorld); C.fromBufferAttribute(p, i2).applyMatrix4(m.matrixWorld);
      const e = Math.max(A.distanceTo(B), B.distanceTo(C), C.distanceTo(A)), k = e < 0.05 ? 1 : Math.min(12, Math.ceil(e / 0.025));
      for (let u = 0; u <= k; u++) for (let v = 0; v <= k - u; v++) { const w = k - u - v; a.push([(A.x * u + B.x * v + C.x * w) / k, (A.y * u + B.y * v + C.y * w) / k, (A.z * u + B.z * v + C.z * w) / k]); }
    }
  }
  return a;
}
function minDist(A, B) {
  const cs = 0.03, grid = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
  for (const b of B) { const k = key(Math.floor(b[0] / cs), Math.floor(b[1] / cs), Math.floor(b[2] / cs)); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(b); }
  let m = Infinity;
  for (const a of A) { const cx = Math.floor(a[0] / cs), cy = Math.floor(a[1] / cs), cz = Math.floor(a[2] / cs);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) { const l = grid.get(key(cx + dx, cy + dy, cz + dz)); if (!l) continue;
      for (const b of l) { const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; if (d < m) m = d; } } }
  return m === Infinity ? 0.06 : Math.min(Math.sqrt(m), 0.06);
}
const partsOf = (g) => g.children.filter((c) => c.isMesh && !isHull(c));
const GAP_PAIRS = [['hips', 'torso'], ['torso', 'head'], ['torso', 'shL'], ['torso', 'shR'], ['shL', 'elL'], ['shR', 'elR'], ['elL', 'haL'], ['elR', 'haR'],
  ['hips', 'lgL'], ['hips', 'lgR'], ['lgL', 'knL'], ['lgR', 'knR'], ['knL', 'ftL'], ['knR', 'ftR'], ['haR', 'swR'], ['haL', 'swL']];
function gaps(J) {
  const g = {};
  for (const [a, c] of GAP_PAIRS.concat(J.gapPairs || [])) {
    if (!J[a] || !J[c]) continue; const A = partsOf(J[a]), B = partsOf(J[c]); if (!A.length || !B.length) continue;
    const d = minDist(worldVerts(A), worldVerts(B)) / SC; if (d > 0.025) g[a + '-' + c] = r3(d);   // rig-space cm, like the gangs
  }
  return g;
}

// ================= budgets, on both kits =================
for (const [kn, K] of [['zipKit', KR], ['realGame', KG]]) {
  for (const lod of [0, 1]) {
    const J = fresh(K, { lod }); out.budgets[kn + (lod ? '/lod1' : '')] = count(J, K);
  }
}
const B0 = out.budgets.zipKit;
out.budgets.pass = B0.parts <= 63 && B0.tris <= 19800 && B0.mats <= 4 && !B0.badHull && !B0.flashBad && !B0.shadowBad.length;

// ================= idle height + reach =================
{
  const J = fresh(KR); snap(KR, J, P.idle(0, J), 0, 'idle', 0);
  const b = bbox(J), bw = bbox(J, true);
  out.idle0 = { minY: r3(b.min.y), maxY: r3(b.max.y), height: r3(b.max.y - b.min.y), heightNoWeapon: r3(bw.max.y - bw.min.y), meta: META.height,
    heightErrPct: +(((b.max.y - b.min.y) / META.height - 1) * 100).toFixed(1), zMin: r3(b.min.z), zMax: r3(b.max.z), xMin: r3(b.min.x), xMax: r3(b.max.x) };
  // horizontal reach over one idle cycle (t = 0 .. 3 s), weapon excluded
  let reach = 0, at = 0, rname = '';
  const names = new Map(Object.entries(J).filter(([k, v]) => v && v.isObject3D).map(([k, v]) => [v, k]));
  const nm = (o) => { let q = o; while (q && !names.has(q)) q = q.parent; return q ? names.get(q) : '?'; };
  for (let t = 0; t <= 3.0001; t += 0.05) {
    snap(KR, J, P.idle(t, J), t, 'idle', 0); const skip = new Set([J.swR, J.swL].filter(Boolean));
    const walk = (o, sk) => { sk = sk || skip.has(o); if (o.isMesh && !isHull(o) && o.visible && !sk) { const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i++) { _v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); const h = Math.hypot(_v.x, _v.z); if (h > reach) { reach = h; at = t; rname = nm(o); } } } for (const c of o.children) walk(c, sk); };
    walk(J.root, false);
  }
  out.reach = { idleMaxHoriz: r3(reach), atT: r3(at), part: rname, radius: META.radius, beyondRadius: r3(reach - META.radius), pass: reach - META.radius <= 0.35 };
}

// ================= static poses =================
{
  const list = [['idle', (J) => P.idle(0, J), 'idle', 0], ['idle_t1.1', (J) => P.idle(1.1, J), 'idle', 0], ['run_0.3', (J) => P.run(0.3, 5, J), 'run', 0], ['run_0.6', (J) => P.run(0.6, 5, J), 'run', 0],
    ['hurt_0', (J) => P.hurt(0, J), 'hurt', 0], ['hurt_0.5', (J) => P.hurt(0.5, J), 'hurt', 0.5], ['down_air_0.3', (J) => P.down(0.3, false, J), 'down', 0.3], ['down_1_ground', (J) => P.down(1, true, J), 'down', 1]];
  for (let i = 0; i < 3; i++) for (const u of [0.2, 0.5, 0.8]) list.push([ATTACKS[i].pose + '_' + u, (J) => P[ATTACKS[i].pose](u, J), ATTACKS[i].pose, u]);
  for (const [name, f, st, u] of list) {
    const J = fresh(KR); snap(KR, J, f(J), 1.1, st, u); const s = scan(J);
    out.poses[name] = { minY: r3(s.minY), lowest: s.minName, cullR: r3(s.cull), gaps: gaps(J) };
  }
}

// ================= sequences at 60 fps (real damping, root hop, animateBoss) =================
{
  let worstY = 1e9, worstCull = 0;
  for (const name of SEQ_NAMES) {
    const list = seqList(name, ATTACKS), T = seqDur(list), J = fresh(KR);
    snap(KR, J, P.idle(0, J), 0, 'idle', 0);
    let mY = 1e9, mAt = 0, mWhat = '', cR = 0, cAt = 0, cWhat = '';
    for (let f = 0; f <= Math.ceil(T * 60); f++) {
      const t = f / 60, q = seqAt(P, J, list, Math.min(t, T - 1e-6));
      KR.applyPose(J, q.p, q.rate, 1 / 60, false); J.root.position.y = q.y; animate(J, t, q.state, q.u);
      const s = scan(J);
      if (s.minY < mY) { mY = s.minY; mAt = t; mWhat = q.state + ':' + s.minName; }
      if (s.cull > cR) { cR = s.cull; cAt = t; cWhat = q.state + ':' + s.cullName; }
    }
    out.seq[name] = { minY: r3(mY), at: r3(mAt), lowest: mWhat, cullR: r3(cR), cullAt: r3(cAt), cullWhat: cWhat };
    worstY = Math.min(worstY, mY); worstCull = Math.max(worstCull, cR);
  }
  out.seq.worstMinY = r3(worstY); out.seq.worstCullR = r3(worstCull);
  out.seq.passFloor = worstY >= -0.03; out.seq.passCull26 = worstCull <= 2.6; out.seq.cull19Info = worstCull <= 1.9;
}

// ================= ATTACKS contract + strike frame =================
{
  const A = ATTACKS; out.attacks.count = A.length; out.attacks.poses = A.map((a) => a.pose);
  out.attacks.contractOk = A.length === 3 && new Set(A.map((a) => a.pose)).size === 3 && A.every((a) => ['atk1', 'atk2', 'atk3'].includes(a.pose)
    && a.active[0] < a.active[1] && a.active[0] >= 0 && a.active[1] <= 1 && a.windup <= a.active[0] && a.dur > 0 && a.reach > 0 && a.dmg > 0 && typeof a.id === 'string');
  // strike frame: play the attack at rate 30 from idle (60 fps); the strike joint (a.strike, default haR) is the hitting part.
  // The frame where that joint's world speed peaks must fall inside the active window.
  out.attacks.each = A.map((a) => {
    const J = fresh(KR); snap(KR, J, P.idle(0, J), 0, 'idle', 0);
    const key = a.strike || 'haR', node = J[key]; let prev = null, best = 0, bestU = 0; const speeds = [];
    const n = Math.round(a.dur * 60);
    for (let f = 0; f <= n; f++) {
      const u = f / n; KR.applyPose(J, P[a.pose](u, J), 30, 1 / 60, false); animate(J, f / 60, a.pose, u); J.root.updateMatrixWorld(true);
      const p = new THREE.Vector3().setFromMatrixPosition(node.matrixWorld);
      if (prev) { const sp = p.distanceTo(prev) * 60; speeds.push(r3(sp)); if (sp > best) { best = sp; bestU = u; } }
      prev = p;
    }
    return { id: a.id, pose: a.pose, strike: key, active: a.active, peakU: r3(bestU), peakSpeed: r3(best), peakInActive: bestU >= a.active[0] - 1 / n && bestU <= a.active[1] + 1 / n };
  });
  out.attacks.allPeaksInActive = out.attacks.each.every((e) => e.peakInActive);
}

// ================= real mergeRig =================
{
  const J = fresh(KR); const before = count(J, KR);
  try {
    mergeRig(J);
    const fl = new Set(J.merged.filter((m) => !isHull(m)).map((m) => m.material.userData.flash));
    snap(KR, J, P[ATTACKS[0].pose](0.5, J), 1, ATTACKS[0].pose, 0.5); animate(J, 1.3, 'run', 0); J.merged[0].skeleton.update();
    out.merge = { ok: true, drawCalls: J.merged.length, toonCalls: J.merged.filter((m) => !isHull(m)).length, outlineCalls: J.merged.filter(isHull).length,
      shadowCalls: J.merged.filter((m) => m.castShadow).length, bones: J.merged[0].skeleton.bones.length, flashShared: fl.size === 1 && [...fl][0] === J.mat.userData.flash,
      partsBefore: before.parts, trisBefore: before.tris };
  } catch (e) { out.merge = { ok: false, err: String(e.stack || e) }; }
}

// ================= determinism + caches =================
{
  const hashRig = (J) => {
    const h = crypto.createHash('sha1'); J.root.updateMatrixWorld(true);
    J.root.traverse((o) => { h.update(o.type + '|' + o.position.toArray().map((x) => x.toFixed(6)).join(',') + '|' + o.rotation.toArray().slice(0, 3).map((x) => x.toFixed(6)).join(','));
      if (o.isMesh) for (const k of ['position', 'color']) { const a = o.geometry.attributes[k]; if (a) h.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength)); } });
    return h.digest('hex').slice(0, 16);
  };
  const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
  const a = hashRig(BUILD(KR, { seed: 7 })); BUILD(KR, { seed: 99 }); const b = hashRig(BUILD(KR, { seed: 7 }));
  const c = hashRig(BUILD(KR, { seed: 8 })), z = hashRig(BUILD(KR, {})), neg = hashRig(BUILD(KR, { seed: -5 })), big = hashRig(BUILD(KR, { seed: 2147483647 * 3 + 11 }));
  // three.js itself calls Math.random for every object's UUID, so the call count is not the test: the build must give the same rig
  // whatever Math.random returns (two constant stubs), and the module source must not mention Math.random() outside comments.
  Math.random = () => 0.123; const h1 = hashRig(BUILD(KR, { seed: 7 })); Math.random = () => 0.987; const h2 = hashRig(BUILD(KR, { seed: 7 }));
  Math.random = real;
  const src = fs.readFileSync(path.resolve(process.env.BOSS), 'utf8').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  out.determinism = { hash: a, sameSeedEqual: a === b, seed8Differs: a !== c, noSeedOk: !!z, negSeedOk: !!neg, hugeSeedOk: !!big, threeUuidRandomCalls: calls,
    independentOfMathRandom: h1 === h2 && h1 === a, mathRandomInSource: /Math\.random\s*\(/.test(src) };
  CANVAS_LOG.length = 0; BUILD(KR, {}); const n1 = CANVAS_LOG.length; CANVAS_LOG.length = 0; BUILD(KR, {}); const n2 = CANVAS_LOG.length;
  CANVAS_LOG.length = 0; BUILD(Object.assign({}, KR), {}); const n3 = CANVAS_LOG.length;
  out.determinism.canvas = { firstBuildOps: n1, secondBuildOps: n2, wrapperKOps: n3, cachedOnSameK: n2 === 0, cachedForWrapperK: n3 === 0 };
  out.misc.kitKeys = Object.keys(KR).length;
}
// ================= summary =================
const pass = out.budgets.pass && Math.abs(out.idle0.heightErrPct) <= 10 && out.reach.pass && out.seq.passFloor && out.seq.passCull26 && out.attacks.contractOk
  && out.attacks.allPeaksInActive && out.merge.ok && out.merge.flashShared && out.determinism.sameSeedEqual && out.determinism.independentOfMathRandom && !out.determinism.mathRandomInSource;
out.summary = { pass, parts: B0.parts, tris: B0.tris, mats: B0.mats, matKinds: B0.matKinds, mergedCalls: out.merge.drawCalls, height: out.idle0.height, heightErrPct: out.idle0.heightErrPct,
  worstMinY: out.seq.worstMinY, worstCullR: out.seq.worstCullR, idleBeyondRadius: out.reach.beyondRadius, reachPart: out.reach.part, strikes: out.attacks.each.map((e) => e.pose + '@' + e.peakU + (e.peakInActive ? '' : '!')).join(' ') };
const file = path.resolve(process.env.OUT || `tools/results_boss_${META.id}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.summary));
if (!out.budgets.pass) console.log('budget detail', JSON.stringify(B0));
for (const [k, v] of Object.entries(out.seq)) if (typeof v === 'object' && v.minY < -0.03) console.log('FLOOR', k, JSON.stringify(v));
for (const [k, v] of Object.entries(out.poses)) if (Object.keys(v.gaps).length || v.minY < -0.03) console.log('POSE', k, JSON.stringify(v));
