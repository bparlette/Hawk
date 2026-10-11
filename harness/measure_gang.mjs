// Hark's review harness (generalised for any gang module). Usage, from the zip root after `npm i three@0.160.0`:
//   GANG=./reference/harbor_rats/gang_harbor_rats_v2_FIXED.js node harness/measure_gang.mjs   -> writes ./results_gang.json
// It builds every member at HD and LOD1 against (a) the starter kit (kit/toadcity_kit.js) and (b) the REAL game code (harness/realK.mjs),
// counts parts / tris / materials, checks flash sharing, hulls, heights, pose ground contact and limb gaps, runs mergeRig,
// and runs determinism checks. Writes results.json next to itself.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fakeDocument, CANVAS_LOG } from './fakedom.mjs';
import path from 'node:path'; import { pathToFileURL } from 'node:url';
globalThis.document = fakeDocument;           // the module's fur map draws on a canvas when `document` exists
const { K: KR } = await import('../kit/toadcity_kit.js');
const { K: KG, mergeRig } = await import('./realK.mjs');
const HR = await import(pathToFileURL(path.resolve(process.env.GANG || process.env.HR_PATH || './reference/harbor_rats/gang_harbor_rats_v2_FIXED.js')).href);
const BUILD = HR[Object.keys(HR).find((k) => k.startsWith('build') && typeof HR[k] === 'function')];
if (!HR.animateGang) HR.animateGang = () => {};
const THREE = KG.THREE;
const MEMBERS = HR.GANG.members;
const POSES = ['idle', 'run', 'windup', 'attack', 'hurt', 'down', 'getup'];
const out = { budgets: {}, poses: {}, merge: {}, determinism: {}, misc: {} };

const isHull = (o) => o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide;
const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
function count(J, K) {
  let parts = 0, tris = 0, hullTris = 0, hulls = 0, badHull = 0, flashBad = 0, shadow = 0; const mats = new Set();
  J.root.traverse((o) => {
    if (!o.isMesh) return; mats.add(o.material);
    if (isHull(o)) { hulls++; hullTris += tri(o.geometry); if (o.material !== K.OUT_CHAR) badHull++; return; }
    parts++; tris += tri(o.geometry); if (o.castShadow) shadow++;
    if (o.material.userData.flash !== J.mat.userData.flash || o.material.userData.flashC !== J.mat.userData.flashC) flashBad++;
  });
  return { parts, tris, hulls, hullTris, mats: mats.size, badHull, flashBad, shadowCasters: shadow, drawCallsUnmerged: parts + hulls };
}
function poseFor(K, J, pose, t = 0.5) {
  const P = K.THUG_POSES;
  switch (pose) {
    case 'run': return P.run(t, 4.5, J);
    case 'windup': return P.windup(0.6, J);
    case 'attack': return P.attack(0.4, J);
    case 'hurt': return P.hurt(0.15, J);
    case 'down': return P.down(1, true);
    case 'getup': return P.getup(0.35, J);
    default: return P.idle(t, J);
  }
}
const STATE = { idle: 'idle', run: 'run', windup: 'attack', attack: 'attack', hurt: 'hurt', down: 'down', getup: 'idle' };
function setPose(K, J, pose, anim, scale) {
  J.root.scale.setScalar(scale);
  K.applyPose(J, poseFor(K, J, pose), 1e4, 1, true);
  if (anim) HR.animateGang(J, 0.5, STATE[pose]);
  J.root.updateMatrixWorld(true);
}
const _v = new THREE.Vector3();
// surface samples: every vertex plus points spread over each triangle (~1.5 cm spacing), in world space
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
const partsOf = (g) => g.children.filter((c) => c.isMesh && !isHull(c));
function bb(P) { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const p of P) for (let i = 0; i < 3; i++) { if (p[i] < lo[i]) lo[i] = p[i]; if (p[i] > hi[i]) hi[i] = p[i]; } return [lo, hi]; }
const inB = (p, [lo, hi], m) => p[0] > lo[0] - m && p[0] < hi[0] + m && p[1] > lo[1] - m && p[1] < hi[1] + m && p[2] > lo[2] - m && p[2] < hi[2] + m;
function minDist(A0, B0) { // grid-accelerated nearest pair, restricted to the bbox overlap
  const bA = bb(A0), bB = bb(B0), A = A0.filter((p) => inB(p, bB, 0.07)), B = B0.filter((p) => inB(p, bA, 0.07));
  if (!A.length || !B.length) return 0.06;
  const cs = 0.03, grid = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
  for (const b of B) { const k = key(Math.floor(b[0] / cs), Math.floor(b[1] / cs), Math.floor(b[2] / cs)); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(b); }
  let m = Infinity;
  for (const a of A) { const cx = Math.floor(a[0] / cs), cy = Math.floor(a[1] / cs), cz = Math.floor(a[2] / cs);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) { const l = grid.get(key(cx + dx, cy + dy, cz + dz)); if (!l) continue;
      for (const b of l) { const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; if (d < m) m = d; } } }
  return Math.min(Math.sqrt(m), 0.06 + (m === Infinity ? 1 : 0)); }
function minDistOld(A, B) { let m = Infinity; for (const a of A) for (const b of B) { const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; if (d < m) m = d; } return Math.sqrt(m); }
function bbox(J) { const b = new THREE.Box3(); J.root.traverse((o) => { if (o.isMesh && !isHull(o)) b.expandByObject(o); }); return b; }
function poseCheck(K, J, pose, anim, scale) {
  setPose(K, J, pose, anim, scale);
  const b = bbox(J);
  // parts poking below the ground (y < -0.03) — by group name
  const under = [];
  const names = new Map(Object.entries(J).filter(([k, v]) => v && v.isObject3D).map(([k, v]) => [v, k]));
  J.root.traverse((o) => { if (o.isMesh && !isHull(o)) { const bb = new THREE.Box3().setFromObject(o); if (bb.min.y < -0.03) under.push((names.get(o.parent) || '?') + ':' + bb.min.y.toFixed(2)); } });
  // gaps between adjacent bone part-sets (vertex-to-vertex; overlap ≈ 0)
  const pairs = [['hips', 'torso'], ['torso', 'head'], ['torso', 'shL'], ['torso', 'shR'], ['shL', 'elL'], ['shR', 'elR'], ['elL', 'haL'], ['elR', 'haR'],
    ['hips', 'lgL'], ['hips', 'lgR'], ['lgL', 'knL'], ['lgR', 'knR'], ['knL', 'ftL'], ['knR', 'ftR'], ['hips', 'tail'], ['tail', 'tail1'], ['tail1', 'tail2'],
    ['head', 'earL'], ['head', 'earR'], ['haR', 'swR']];
  const gaps = {};
  for (const [a, c] of pairs) { if (!J[a] || !J[c]) continue; const A = partsOf(J[a]), B = partsOf(J[c]); if (!A.length || !B.length) continue; const d = minDist(worldVerts(A), worldVerts(B)); if (d > 0.025) gaps[a + '-' + c] = +d.toFixed(3); }
  return { minY: +b.min.y.toFixed(3), maxY: +b.max.y.toFixed(3), under, gaps };
}

for (const [kname, K] of [['starterKit', KR], ['realGame', KG]]) {
  out.budgets[kname] = {}; out.poses[kname] = {};
  for (const mem of MEMBERS) {
    const scale = HR.META[mem].scale;
    for (const lod of [0, 1]) {
      const J = BUILD(K, mem, { lod, seed: 7 });
      const c = count(J, K);
      setPose(K, J, 'idle', false, scale);
      const b = bbox(J); c.height = +(b.max.y - b.min.y).toFixed(3); c.minY = +b.min.y.toFixed(3); c.maxY = +b.max.y.toFixed(3);
      c.heightUnscaled = +(c.height / scale).toFixed(3);
      // height with oar excluded (armed): body only
      if (J.swR) { J.swR.visible = false; const b2 = new THREE.Box3(); J.root.traverse((o) => { if (o.isMesh && !isHull(o)) { let v = true, p = o; while (p) { if (!p.visible) v = false; p = p.parent; } if (v) b2.expandByObject(o); } }); c.heightNoWeapon = +(b2.max.y - b2.min.y).toFixed(3); J.swR.visible = true; }
      c.groups = ['tail', 'tail1', 'tail2', 'earL', 'earR', 'swR', 'head'].filter((k) => J[k]);
      c.kind = J.kind; c.meta = !!J.meta;
      // facing: snout tip should be the max-z point of the head
      const hb = new THREE.Box3().setFromObject(J.head); c.headZ = [+hb.min.z.toFixed(2), +hb.max.z.toFixed(2)];
      out.budgets[kname][mem + (lod ? '/lod1' : '')] = c;
      out.poses[kname][mem + (lod ? '/lod1' : '')] = {};
      for (const pose of POSES) for (const anim of (pose === "down" ? [false, true] : [false])) {
        const J2 = BUILD(K, mem, { lod, seed: 7 });
        out.poses[kname][mem + (lod ? '/lod1' : '')][pose + (anim ? '+anim' : '')] = poseCheck(K, J2, pose, anim, scale);
      }
    }
  }
}
// real-game kit's own thug for reference (counting convention)
for (const [i, look] of KG.THUG_LOOKS.entries()) { const J = KG.buildThug(look); out.budgets.realGame['current_thug_' + i] = count(J, KG); }

out.poses.realThugBaseline = {};
for (const i of [0, 1, 3, 4]) for (const pose of POSES) { const J = KG.buildThug(KG.THUG_LOOKS[i]); J.head = J.head; const r = poseCheck(KG, J, pose, false, KG.THUG_LOOKS[i].big ? 1.2 : 1); if (r.under.length || Object.keys(r.gaps).length || pose === 'idle') out.poses.realThugBaseline['look' + i + ':' + pose] = r; }
// idle heights at t = 0 (no bob), as the delivered viewer measures them
out.idle0 = {};
for (const [kname, K] of [['starterKit', KR], ['realGame', KG]]) for (const mem of MEMBERS) for (const lod of [0, 1]) {
  const J = BUILD(K, mem, { lod, seed: 7 }); J.root.scale.setScalar(HR.META[mem].scale); K.applyPose(J, K.THUG_POSES.idle(0, J), 1e4, 1, true); J.root.updateMatrixWorld(true);
  const b = bbox(J); out.idle0[kname + ':' + mem + (lod ? '/lod1' : '')] = { minY: +b.min.y.toFixed(3), maxY: +b.max.y.toFixed(3), h: +(b.max.y - b.min.y).toFixed(3) };
}
// mergeRig (the real game wraps buildThug in it): does a Harbor Rat merge, and what does it cost?
for (const mem of MEMBERS) for (const lod of [0, 1]) {
  const J = BUILD(KG, mem, { lod, seed: 7 });
  const before = count(J, KG);
  try {
    mergeRig(J);
    const ms = J.merged.map((m) => ({ ol: isHull(m), skinned: m.isSkinnedMesh, verts: m.geometry.attributes.position.count, tris: tri(m.geometry), hasUv: !!m.geometry.attributes.uv, map: !!m.material.map }));
    const bones = J.merged[0].skeleton.bones.length;
    // pose + animate after merge, render-free check that bones are still the live groups
    KG.applyPose(J, KG.THUG_POSES.attack(0.4, J), 1e4, 1, true); HR.animateGang(J, 1.2, 'run'); J.root.updateMatrixWorld(true);
    J.merged[0].skeleton.update();
    const tailBone = J.tail ? J.merged[0].skeleton.bones.indexOf(J.tail) : -1;
    out.merge[mem + (lod ? '/lod1' : '')] = { ok: true, drawCalls: J.merged.length, meshes: ms, bones, tailIsBone: tailBone >= 0, partsBefore: before.parts, trisBefore: before.tris };
  } catch (e) { out.merge[mem + (lod ? '/lod1' : '')] = { ok: false, err: String(e.stack || e) }; }
}
{ const J = KG.buildThug(KG.THUG_LOOKS[1]); mergeRig(J); out.merge.current_thug_1 = { drawCalls: J.merged.length }; }

// ---- determinism ----
function hashRig(J) {
  const h = crypto.createHash('sha1'); J.root.updateMatrixWorld(true);
  J.root.traverse((o) => {
    h.update(o.type + '|' + (o.parent && o.parent.type) + '|' + o.position.toArray().map((x) => x.toFixed(6)).join(',') + '|' + o.rotation.toArray().slice(0, 3).map((x) => x.toFixed(6)).join(','));
    if (o.isMesh) { for (const k of ['position', 'color', 'normal']) { const a = o.geometry.attributes[k]; if (a) h.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength)); } h.update(isHull(o) ? 'H' : o.material.map ? 'M' : 'T'); }
  });
  if (J.tailBase) h.update(JSON.stringify(J.tailBase));
  return h.digest('hex').slice(0, 16);
}
const realRandom = Math.random; let randCalls = 0; Math.random = () => { randCalls++; return realRandom(); };
const D = {};
for (const K of [KR, KG]) {
  const kn = K === KR ? 'starterKit' : 'realGame'; D[kn] = {};
  for (const mem of MEMBERS) for (const lod of [0, 1]) {
    const a = hashRig(BUILD(K, mem, { lod, seed: 7 }));
    // interleave other builds, other seeds and some wall time
    BUILD(K, 'bruiser', { seed: 99 }); BUILD(K, 'armed', { lod: 1, seed: 3 });
    const t0 = Date.now(); while (Date.now() - t0 < 15);
    const b = hashRig(BUILD(K, mem, { lod, seed: 7 }));
    const c = hashRig(BUILD(K, mem, { lod, seed: 8 }));
    const z = hashRig(BUILD(K, mem, { lod }));
    const neg = hashRig(BUILD(K, mem, { lod, seed: -5 }));
    const big = hashRig(BUILD(K, mem, { lod, seed: 2147483647 * 3 + 11 }));
    D[kn][mem + (lod ? '/lod1' : '')] = { sameSeedEqual: a === b, seed8Differs: a !== c, noSeedOk: !!z, negSeedOk: !!neg, hugeSeedOk: !!big };
  }
}
D.mathRandomCallsDuringBuilds = randCalls;
Math.random = realRandom;
// fur canvas drawing: identical stroke log on two fresh kit instances
{
  const freshK = () => Object.assign({}, KR, { QUAL: Object.assign({}, KR.QUAL, { texs: [] }), THREE: Object.assign({}, KR.THREE) });
  CANVAS_LOG.length = 0; BUILD(freshK(), 'grunt_a', {}); const l1 = CANVAS_LOG.join(';');
  CANVAS_LOG.length = 0; BUILD(freshK(), 'grunt_a', {}); const l2 = CANVAS_LOG.join(';');
  // a per-spawn wrapper {...K} sharing QUAL: does it redraw the canvas?
  CANVAS_LOG.length = 0; BUILD(Object.assign({}, KR), 'grunt_a', {}); D.redrawnForWrapperK = CANVAS_LOG.length > 0;
  CANVAS_LOG.length = 0; BUILD(KR, 'grunt_a', {}); BUILD(KR, 'grunt_b', {}); const l3 = CANVAS_LOG.length;
  D.furCanvas = { identicalAcrossKitInstances: l1 === l2, drawCalls: l1.split(';').length, redrawnOnSameK: l3 > 0 };
}
// texture sharing: two rats on the same K share one Texture object; colors override
{
  const a = BUILD(KR, 'grunt_a', {}), b = BUILD(KR, 'bruiser', {});
  const ta = new Set(), tb = new Set(); a.root.traverse((o) => o.isMesh && o.material.map && ta.add(o.material.map)); b.root.traverse((o) => o.isMesh && o.material.map && tb.add(o.material.map));
  D.furShared = [...ta][0] === [...tb][0];
  const c = BUILD(KR, 'grunt_a', { colors: { navy: '#ff0000' } }); let red = 0; c.root.traverse((o) => { if (o.isMesh && !isHull(o)) { const col = o.geometry.attributes.color; if (col.getX(0) > 0.99 && col.getY(0) < 0.01) red++; } });
  D.colorsOverrideParts = red;
  const u = BUILD(KR, 'nonsense', {}); D.unknownMemberFallsBackTo = u.meta === HR.META.grunt_a ? 'grunt_a' : 'other';
  // the module mutates nothing on K
  D.kitKeysUnchanged = Object.keys(KR).length;
}
// what document-less environments do (e.g. a worker or SSR): HR_FUR caches null for that K forever
{
  const save = globalThis.document; delete globalThis.document; const K2 = Object.assign({}, KR, { QUAL: Object.assign({}, KR.QUAL, { texs: [] }), THREE: Object.assign({}, KR.THREE) });
  const J = BUILD(K2, 'grunt_a', {}); globalThis.document = save; const J2 = BUILD(K2, 'grunt_a', {});
  let m = new Set(); J2.root.traverse((o) => o.isMesh && m.add(o.material)); D.nullTexCachedAfterDocAppears = m.size;
}
out.determinism = D;
fs.writeFileSync(path.resolve(process.env.OUT || 'results_gang.json'), JSON.stringify(out, null, 1));
console.log('done');
