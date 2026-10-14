// tools/qa.js — automated acceptance checks for a gang module. Open tools/qa.html?gang=<id> (served from the repo root);
// results land in window.__qa (and a summary on the page). tools/shoot.mjs collects them headlessly.
//
// Checks (all measured, nothing estimated):
//  • budgets: parts (non-hull meshes), tris (excluding hulls), hull tris, materials, shadow casters, height, feet min y — HD and LOD 1
//  • ground: min y of every non-hull vertex through 60 fps runs of the game's own pose sequences (knock-down hop, attack, run),
//    with and without animateGang, plus snapped sweeps of every pose; feet and weapon are exempt only while in `down`
//  • shoulder gap: distance from the upper-arm/shoulder parts to the torso parts in down(1, true) and windup (≤ 1 cm)
//  • stray hulls: outlined parts sunk mostly (> 60 % of vertices) inside another outlined part
//  • shadow flags: outline:false parts and parts under 4 cm in two dimensions must not cast shadows
//  • mergeRig emulation: per-group merge by material, then hit-flash coverage and animateGang still moving its groups
//  • LOD silhouette: IoU of HD vs LOD 1 masks from front, 3/4 and side
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { K } from '../toadcity_kit.js';

const Q = new URLSearchParams(location.search);
const GANG_ID = Q.get('gang') || 'pier_gulls';
const M = await import(`../src/gang_${GANG_ID}.js`);
const BUILD = M[Object.keys(M).find((k) => k.startsWith('build') && typeof M[k] === 'function')];
const ANIM = M.animateGang;
const P = K.THUG_POSES, DT = 1 / 60, FLOOR = -0.03;

const isHull = (o) => o.isMesh && o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide;
const partsOf = (J) => { const a = []; J.root.traverse((o) => { if (o.isMesh && !isHull(o)) a.push(o); }); return a; };
const triCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const r3 = (v) => Math.round(v * 1000) / 1000;

function build(member, lod) {
  const J = BUILD(K, member, { lod, seed: 7 });
  J.root.scale.setScalar(M.META[member]?.scale || 1);
  // name -> group map for classification (skeleton joints + extras the module hung on J)
  const named = new Map();
  for (const [k, v] of Object.entries(J)) if (v && v.isObject3D && k !== 'root') named.set(v, k);
  J.__named = named;
  return J;
}
function keyOf(J, o) { for (let p = o.parent; p; p = p.parent) if (J.__named.has(p)) return J.__named.get(p); return 'root'; }
function under(o, g) { for (let p = o; p; p = p.parent) if (p === g) return true; return false; }
function label(J, m) { return `${keyOf(J, m)}/${m.name || m.geometry.type}`; }

// ---------- pose helpers ----------
function snap(J, p) { K.applyPose(J, p, 1e4, 1, true); J.root.updateMatrixWorld(true); }
function minY(J, exempt) {
  let best = { y: Infinity, part: '' }; const v = new THREE.Vector3();
  for (const m of partsOf(J)) {
    if (!m.visible || (exempt && exempt(m))) continue;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); if (v.y < best.y) best = { y: v.y, part: label(J, m) }; }
  }
  return best;
}
const downExempt = (J) => (m) => under(m, J.ftL) || under(m, J.ftR) || (J.swR && under(m, J.swR)) || (J.swL && under(m, J.swL));

// ---------- 60 fps sequences (the game's timings: knock-down hop vy 4.2, g 22, rate 13 for 1.25 s; getup rate 14 for 0.5 s) ----------
function seqs(J) {
  return {
    knockdown: [
      { n: 'idle', dur: 0.5, rate: 14, st: 'idle', f: (t) => P.idle(t, J) },
      { n: 'hurt', dur: 0.3, rate: 14, st: 'hurt', f: (t, u) => P.hurt(u, J) },
      { n: 'down', dur: 1.25, rate: 13, st: 'down', hop: true, f: (t, u, g) => P.down(u, g) },
      { n: 'getup', dur: 0.5, rate: 14, st: 'idle', f: (t, u) => P.getup(u, J) },
      { n: 'idle', dur: 0.6, rate: 14, st: 'idle', f: (t) => P.idle(t, J) },
    ],
    attack: [
      { n: 'idle', dur: 0.4, rate: 14, st: 'idle', f: (t) => P.idle(t, J) },
      { n: 'windup', dur: 0.4, rate: 14, st: 'attack', f: (t, u) => P.windup(u, J) },
      { n: 'attack', dur: 0.5, rate: 14, st: 'attack', f: (t, u) => P.attack(u, J) },
      { n: 'idle', dur: 0.5, rate: 14, st: 'idle', f: (t) => P.idle(t, J) },
    ],
    run: [
      { n: 'idle', dur: 0.3, rate: 14, st: 'idle', f: (t) => P.idle(t, J) },
      { n: 'run', dur: 1.2, rate: 14, st: 'run', f: (t) => P.run(t, 4.5, J) },
      { n: 'idle', dur: 0.5, rate: 14, st: 'idle', f: (t) => P.idle(t, J) },
    ],
  };
}
function runSeq(member, name, withAnim, lod = 0) {
  const J = build(member, lod), S = seqs(J)[name];
  snap(J, P.idle(0, J));
  let t = 0, worst = { y: Infinity }, frames = 0, downEnd = null;
  for (const ph of S) {
    let vy = 0, landed = false;
    if (ph.hop) { vy = 4.2; J.root.position.y = 0; }
    const n = Math.round(ph.dur / DT);
    for (let i = 1; i <= n; i++) {
      t += DT; frames++;
      const u = i / n;
      if (ph.hop && !landed) { vy -= 22 * DT; J.root.position.y += vy * DT; if (J.root.position.y <= 0 && vy < 0) { J.root.position.y = 0; landed = true; } }
      K.applyPose(J, ph.f(t, u, landed), ph.rate, DT, false);
      if (withAnim && ANIM) ANIM(J, t, ph.st);
      J.root.updateMatrixWorld(true);
      const m = minY(J, ph.n === 'down' ? downExempt(J) : null);
      if (m.y < worst.y) worst = { y: r3(m.y), part: m.part, phase: ph.n, t: r3(t) };
      if (ph.n === 'down' && i === n) downEnd = clearances(J);
    }
  }
  return { worst, frames, pass: worst.y >= FLOOR, downEnd };
}
function clearances(J) {
  const out = {};
  for (const k of ['tail', 'earL', 'earR', 'head']) if (J[k]) { let y = Infinity; const v = new THREE.Vector3(); J[k].traverse((m) => { if (m.isMesh && !isHull(m)) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); y = Math.min(y, v.y); } } }); out[k] = r3(y); }
  return out;
}
// snapped sweeps of every pose at u = 0 .. 1 (run: t over one stride)
function sweeps(member) {
  const J = build(member, 0); let worst = { y: Infinity };
  const tests = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    tests.push(['idle', () => P.idle(u * 1.6, J)], ['run', () => P.run(u * 0.8, 4.5, J)], ['windup', () => P.windup(u, J)], ['attack', () => P.attack(u, J)],
      ['hurt', () => P.hurt(u, J)], ['down', () => P.down(u, true)], ['down_air', () => P.down(u, false)], ['getup', () => P.getup(u, J)]);
  }
  for (const [n, f] of tests) {
    snap(J, f());
    for (const withAnim of [false, true]) {
      if (withAnim && ANIM) { ANIM(J, 0.7, { run: 'run', windup: 'attack', attack: 'attack', hurt: 'hurt', down: 'down', down_air: 'down', getup: 'idle' }[n] || 'idle'); J.root.updateMatrixWorld(true); }
      const m = minY(J, n.startsWith('down') ? downExempt(J) : null);
      if (m.y < worst.y) worst = { y: r3(m.y), part: m.part, pose: n + (withAnim ? '+anim' : '') };
    }
  }
  return { worst, pass: worst.y >= FLOOR };
}

// ---------- signed distance to a closed mesh (negative inside), from its world triangles ----------
const TRI_CACHE = new WeakMap();
function worldTris(m) {
  let c = TRI_CACHE.get(m); if (c && c.ver === m.matrixWorld.elements.join()) return c.tris;
  const g = m.geometry, p = g.attributes.position, idx = g.index, tris = [], a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3();
  const n = idx ? idx.count : p.count;
  for (let i = 0; i < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(p, i0).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(p, i1).applyMatrix4(m.matrixWorld); cc.fromBufferAttribute(p, i2).applyMatrix4(m.matrixWorld);
    const t = new THREE.Triangle(a.clone(), b.clone(), cc.clone()); if (t.getArea() < 1e-9) continue;
    t.nrm = t.getNormal(new THREE.Vector3()); tris.push(t);
  }
  const box = new THREE.Box3().setFromObject(m, true);
  TRI_CACHE.set(m, { ver: m.matrixWorld.elements.join(), tris, box }); return tris;
}
function signedDist(v, m) {
  const tris = worldTris(m), cp = new THREE.Vector3(); let best = Infinity, sign = 1;
  for (const t of tris) { t.closestPointToPoint(v, cp); const d = cp.distanceToSquared(v); if (d < best) { best = d; sign = Math.sign(cp.sub(v).negate().dot(t.nrm)) || 1; t.closestPointToPoint(v, cp); } }
  return Math.sqrt(best) * sign;
}
function vertsWorld(m) { const p = m.geometry.attributes.position, out = []; for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); return out; }
function shoulderGaps(J) {
  const ps = partsOf(J), torso = ps.filter((m) => keyOf(J, m) === 'torso'), res = {};
  for (const k of ['L', 'R']) {
    const arm = ps.filter((m) => keyOf(J, m) === 'sh' + k); let gap = Infinity;
    for (const m of arm) for (const v of vertsWorld(m)) { let sd = Infinity; for (const tm of torso) sd = Math.min(sd, signedDist(v, tm)); gap = Math.min(gap, sd); }
    res[k] = r3(Math.max(0, gap));
  }
  return res;
}
// Stray-hull check, two parts:
//  • buried: area-weighted share of each outlined part's surface lying inside another outlined part (> 60 % = "sunk mostly
//    inside", rule 3). Surface sampled at about one point per 4 cm².
//  • stray ink (rendered, real outline shader): the rig is drawn flat white with its real OUT_CHAR hulls from 4 views at a
//    6 m gameplay distance (hull ≈ 3 px wide at 256²). For each outlined part A, A's hull is hidden and the frame re-drawn;
//    the ink that disappears is A's ink. Ink that lies on top of the parts (not outside the silhouette, where outline ink
//    belongs) and further than STRAY_R px from A's own visible pixels is a stray line drawn across some other part. Reported in pixels per view; a part fails at > STRAY_MAX px in any view.
const STRAY_R = 5, STRAY_MAX = 12, SR = 256;
const DEBUG = Q.get('debug') ? Q.get('debug').split(',') : null;   // ?debug=<member>,<joint/part>,<view> paints that part's stray ink red
function debugPaint(base, isStray, own) {
  const c = document.createElement('canvas'); c.width = c.height = SR; c.style.cssText = 'width:512px;height:512px;image-rendering:pixelated'; const x = c.getContext('2d'), im = x.createImageData(SR, SR);
  for (let y = 0; y < SR; y++) for (let xx = 0; xx < SR; xx++) { const i = y * SR + xx, o = ((SR - 1 - y) * SR + xx) * 4; const st = isStray(i);
    im.data[o] = st ? 255 : own[i] ? 120 : base[i * 4]; im.data[o + 1] = st ? 0 : own[i] ? 200 : base[i * 4 + 1]; im.data[o + 2] = st ? 0 : own[i] ? 255 : base[i * 4 + 2]; im.data[o + 3] = 255; }
  x.putImageData(im, 0, 0); document.body.appendChild(c);
}
function samples(m) {
  const pts = [];
  for (const t of worldTris(m)) {
    const area = t.getArea(), n = Math.max(1, Math.min(10, Math.ceil(area / 0.0004)));
    const bary = n === 1 ? [[1 / 3, 1 / 3]] : [[1 / 6, 1 / 6], [2 / 3, 1 / 6], [1 / 6, 2 / 3], [1 / 3, 1 / 3], [0.45, 0.45], [0.1, 0.45], [0.45, 0.1], [0.25, 0.6], [0.6, 0.25], [0.05, 0.05]].slice(0, n);
    for (const [u, v] of bary) pts.push({ p: new THREE.Vector3().copy(t.a).multiplyScalar(1 - u - v).addScaledVector(t.b, u).addScaledVector(t.c, v), w: area / bary.length });
  }
  return pts;
}
function buried(J) {
  const ol = partsOf(J).filter((m) => m.children.some(isHull)), out = {};
  const boxes = new Map(ol.map((m) => [m, new THREE.Box3().setFromObject(m, true).expandByScalar(0.005)]));
  for (const a of ol) {
    let total = 0, inside = 0;
    for (const { p, w } of samples(a)) { total += w; for (const b of ol) { if (b !== a && boxes.get(b).containsPoint(p) && signedDist(p, b) < -0.002) { inside += w; break; } } }
    out[label(J, a)] = r3(inside / total);
  }
  return out;
}
const SRT = new THREE.WebGLRenderTarget(SR, SR); const WHITE = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }), RED = new THREE.MeshBasicMaterial({ color: 0xff0000 });
function shot(sc, cam) { RR.setSize(SR, SR); RR.setRenderTarget(SRT); RR.render(sc, cam); const px = new Uint8Array(SR * SR * 4); RR.readRenderTargetPixels(SRT, 0, 0, SR, SR, px); RR.setRenderTarget(null); return px; }
function dilate(m, r) {
  const a = new Uint8Array(m.length), b = new Uint8Array(m.length);
  for (let y = 0; y < SR; y++) for (let x = 0; x < SR; x++) { let v = 0; for (let k = -r; k <= r && !v; k++) { const xx = x + k; if (xx >= 0 && xx < SR && m[y * SR + xx]) v = 1; } a[y * SR + x] = v; }
  for (let y = 0; y < SR; y++) for (let x = 0; x < SR; x++) { let v = 0; for (let k = -r; k <= r && !v; k++) { const yy = y + k; if (yy >= 0 && yy < SR && a[yy * SR + x]) v = 1; } b[y * SR + x] = v; }
  return b;
}
function strayInk(J) {
  snap(J, P.idle(0, J));
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0xffffff); sc.add(J.root);
  const ps = partsOf(J), orig = new Map(ps.map((m) => [m, m.material])), ol = ps.filter((m) => m.children.some(isHull));
  for (const m of ps) m.material = WHITE;
  const fogN = K.OUT_U.fogN.value, fogF = K.OUT_U.fogF.value; K.OUT_U.fogN.value = 1e4; K.OUT_U.fogF.value = 2e4;
  const res = {};
  for (const [vn, ang] of [['front', 0], ['three', 0.8], ['side', Math.PI / 2], ['back', Math.PI]]) {
    const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 50); const c = new THREE.Box3().setFromObject(J.root, true).getCenter(new THREE.Vector3());
    cam.position.set(Math.sin(ang) * 6, 1.6, Math.cos(ang) * 6); cam.lookAt(0, c.y, 0); cam.updateMatrixWorld();
    const base = shot(sc, cam), ink = (px, i) => px[i * 4] < 90 && px[i * 4 + 1] < 90;
    // coverage of the parts alone (hulls hidden): ink outside it is silhouette outline against the background, never stray
    const hl = []; J.root.traverse((o) => { if (isHull(o)) { hl.push(o); o.visible = false; } });
    const cov = shot(sc, cam); for (const h of hl) h.visible = true;
    const onPart = (i) => cov[i * 4] < 250;
    for (const a of ol) {
      const h = a.children.find(isHull); h.visible = false; const noA = shot(sc, cam); h.visible = true;
      a.material = RED; const vis = shot(sc, cam); a.material = WHITE;
      const own = new Uint8Array(SR * SR); for (let i = 0; i < own.length; i++) own[i] = vis[i * 4] > 200 && vis[i * 4 + 1] < 60 ? 1 : 0;
      const near = dilate(own, STRAY_R); let stray = 0;
      for (let i = 0; i < own.length; i++) if (ink(base, i) && !ink(noA, i) && !near[i] && onPart(i)) stray++;
      if (DEBUG && DEBUG[1] === label(J, a) && DEBUG[2] === vn) debugPaint(base, (i) => ink(base, i) && !ink(noA, i) && !near[i] && onPart(i), own);
      const k = label(J, a); res[k] = res[k] || {}; res[k][vn] = stray;
    }
  }
  for (const m of ps) m.material = orig.get(m); K.OUT_U.fogN.value = fogN; K.OUT_U.fogF.value = fogF; sc.remove(J.root);
  return res;
}
function strayHulls(J) {
  snap(J, P.idle(0, J));
  const bur = buried(J), ink = strayInk(J), report = [];
  for (const k of Object.keys(bur)) { const v = ink[k] || {}; report.push({ part: k, buried: bur[k], strayPx: v, maxStrayPx: Math.max(0, ...Object.values(v)) }); }
  return report;
}
function shadowRules(J) {
  const bad = [];
  for (const m of partsOf(J)) {
    const hull = m.children.some(isHull);
    m.geometry.computeBoundingBox(); const s = new THREE.Vector3(); m.geometry.boundingBox.getSize(s);
    const thin = [s.x, s.y, s.z].filter((x) => x < 0.04).length >= 2;
    if (!hull && m.castShadow) bad.push(label(J, m) + ': outline:false but casts shadow');
    if (thin && (m.castShadow || hull)) bad.push(label(J, m) + ': < 4 cm in two dims but has ' + (hull ? 'hull' : 'shadow'));
  }
  return bad;
}
function budget(J) {
  snap(J, P.idle(0, J));
  const ps = partsOf(J), mats = new Set(); let tris = 0, hullTris = 0, hulls = 0, casters = 0, flashBad = 0;
  J.root.traverse((o) => { if (!o.isMesh) return; mats.add(o.material); if (isHull(o)) { hulls++; hullTris += triCount(o.geometry); } });
  for (const m of ps) { tris += triCount(m.geometry); if (m.castShadow) casters++; if (m.material.userData.flash !== J.mat.userData.flash || m.material.userData.flashC !== J.mat.userData.flashC) flashBad++; }
  const box = new THREE.Box3(); for (const m of ps) box.expandByObject(m, true);
  const feet = minY(J);
  const hullMatsOK = [...mats].filter((m) => m.isShaderMaterial).every((m) => m === K.OUT_CHAR);
  return { parts: ps.length, tris, hullTris, hulls, mats: mats.size, casters, drawCalls: ps.length + hulls, shadowCalls: casters, height: r3(box.max.y - box.min.y), feetMinY: r3(feet.y), flashBad, hullMatsOK };
}

// ---------- mergeRig emulation: per group, merge direct child meshes by (material, outlined); hulls merged alongside ----------
function mergeRigEmu(J) {
  const groups = []; J.root.traverse((o) => { if (o.isGroup || (o.isObject3D && !o.isMesh)) groups.push(o); });
  for (const g of groups) {
    const meshes = g.children.filter((c) => c.isMesh && !isHull(c)); if (!meshes.length) continue;
    const buckets = new Map();
    for (const m of meshes) { const k = m.material.uuid + (m.geometry.attributes.odir ? '|o' : '|n'); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(m); }
    for (const list of buckets.values()) {
      const geoms = list.map((m) => {
        m.updateMatrix(); const gg = m.geometry.clone(); gg.applyMatrix4(m.matrix);
        if (gg.attributes.odir) { const n3 = new THREE.Matrix3().setFromMatrix4(m.matrix); const o = gg.attributes.odir, v = new THREE.Vector3(); for (let i = 0; i < o.count; i++) { v.fromBufferAttribute(o, i).applyMatrix3(n3); o.setXYZ(i, v.x, v.y, v.z); } }
        return gg;
      });
      const merged = mergeGeometries(geoms, false); if (!merged) throw new Error('mergeGeometries failed in ' + (J.__named.get(g) || g.type));
      const mm = new THREE.Mesh(merged, list[0].material); mm.castShadow = list.some((m) => m.castShadow); mm.name = 'merged';
      if (merged.attributes.odir) mm.add(new THREE.Mesh(merged, K.OUT_CHAR));
      for (const m of list) g.remove(m); g.add(mm);
    }
  }
  J.root.updateMatrixWorld(true);
}
function mergeCheck(member) {
  const J = build(member, 0); snap(J, P.idle(0, J));
  const before = partsOf(J).length;
  mergeRigEmu(J);
  const ps = partsOf(J);
  const flashShared = ps.every((m) => m.material.userData.flash === J.mat.userData.flash && m.material.userData.flashC === J.mat.userData.flashC);
  J.mat.userData.flash.value = 0.85; const flashCovers = ps.every((m) => m.material.userData.flash.value === 0.85); J.mat.userData.flash.value = 0;
  const mapped = new Set(ps.filter((m) => m.material.map).map((m) => m.material)).size;
  // extras must be plain groups directly under a skeleton joint
  const extras = [...J.__named.entries()].filter(([o, k]) => !K.JOINTS.includes(k) && k !== 'head').map(([o, k]) => ({ k, plain: o.type === 'Group', parent: J.__named.get(o.parent) || 'none' }));
  // animateGang still moves the merged geometry of every group it animates
  let animMoves = null;
  if (ANIM && J.tail) {
    const probe = J.tail.children.find((c) => c.isMesh); const v = new THREE.Vector3();
    const at = (t, st) => { ANIM(J, t, st); J.root.updateMatrixWorld(true); return v.fromBufferAttribute(probe.geometry.attributes.position, 0).applyMatrix4(probe.matrixWorld).clone(); };
    animMoves = { tailMergedMeshPresent: !!probe, moved_m: r3(at(0.1, 'run').distanceTo(at(0.25, 'run'))) };
  }
  return { meshesBefore: before, meshesAfter: ps.length, hullsAfter: (() => { let n = 0; J.root.traverse((o) => { if (isHull(o)) n++; }); return n; })(), flashShared, flashCovers, mappedSubMaterials: mapped, extras, animMoves };
}

// ---------- LOD silhouette IoU ----------
const RT = new THREE.WebGLRenderTarget(160, 160), RR = new THREE.WebGLRenderer({ antialias: false }); RR.setSize(160, 160);
const BLACK = new THREE.MeshBasicMaterial({ color: 0x000000 });
function mask(J, view, box) {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0xffffff); sc.add(J.root); sc.overrideMaterial = BLACK;
  const hulls = []; J.root.traverse((o) => { if (isHull(o)) { hulls.push([o, o.visible]); o.visible = false; } });
  const c = box.getCenter(new THREE.Vector3()), h = (box.max.y - box.min.y) * 0.55 + 0.1;
  const cam = new THREE.OrthographicCamera(-h, h, h, -h, 0.1, 50);
  const dir = { front: [0, 0, 1], three: [0.7, 0, 0.7], side: [1, 0, 0] }[view];
  cam.position.set(c.x + dir[0] * 10, c.y, c.z + dir[2] * 10); cam.lookAt(c); cam.updateMatrixWorld();
  RR.setRenderTarget(RT); RR.render(sc, cam); const px = new Uint8Array(160 * 160 * 4); RR.readRenderTargetPixels(RT, 0, 0, 160, 160, px); RR.setRenderTarget(null);
  for (const [o, vis] of hulls) o.visible = vis; sc.remove(J.root);
  const m = new Uint8Array(160 * 160); for (let i = 0; i < m.length; i++) m[i] = px[i * 4] < 128 ? 1 : 0; return m;
}
function silhouette(member) {
  const A = build(member, 0), B = build(member, 1); snap(A, P.idle(0, A)); snap(B, P.idle(0, B));
  const box = new THREE.Box3().setFromObject(A.root, true); const out = {};
  for (const v of ['front', 'three', 'side']) { const a = mask(A, v, box), b = mask(B, v, box); let i = 0, u = 0; for (let k = 0; k < a.length; k++) { i += a[k] & b[k]; u += a[k] | b[k]; } out[v] = r3(i / u); }
  return out;
}

// ---------- run everything ----------
const R = { gang: GANG_ID, members: {} };
const out = document.getElementById('out');
for (const member of (DEBUG ? [DEBUG[0]] : M.GANG.members)) {
  out.textContent += `\n${member}…`;
  const hd = build(member, 0), lod = build(member, 1);
  const r = R.members[member] = { hd: budget(hd), lod: budget(lod) };
  r.hd.shadowRule = shadowRules(hd); r.lod.shadowRule = shadowRules(lod);
  r.hullOverlap = strayHulls(build(member, 0));
  r.strayHulls = r.hullOverlap.filter((x) => x.buried > 0.6 || x.maxStrayPx > STRAY_MAX);
  { const J = build(member, 0); snap(J, P.down(1, true)); r.shoulderGapDown = shoulderGaps(J); r.downEndSnapped = clearances(J); r.downEndSnappedMinY = r3(minY(J, downExempt(J)).y); }
  { const J = build(member, 0); snap(J, P.windup(1, J)); r.shoulderGapWindup = shoulderGaps(J); }
  r.sequences = {};
  for (const name of ['knockdown', 'attack', 'run']) for (const anim of [false, true]) {
    if (anim && !ANIM) continue; r.sequences[name + (anim ? '+anim' : '')] = runSeq(member, name, anim);
  }
  r.lodSequences = {};
  for (const name of ['knockdown', 'attack', 'run']) r.lodSequences[name] = runSeq(member, name, true, 1);
  r.sweeps = sweeps(member);
  r.merge = mergeCheck(member);
  r.silhouetteIoU = silhouette(member);
  const seqPass = Object.values(r.sequences).every((x) => x.pass) && Object.values(r.lodSequences).every((x) => x.pass);
  r.pass = {
    budgetHD: r.hd.parts <= 37 && r.hd.tris <= 12000 && r.hd.mats <= 3, budgetLOD: r.lod.parts <= 14 && r.lod.tris <= 3000 && r.lod.mats <= 3,
    ground: seqPass && r.sweeps.pass, shoulders: Math.max(r.shoulderGapDown.L, r.shoulderGapDown.R, r.shoulderGapWindup.L, r.shoulderGapWindup.R) <= 0.01,
    strayHulls: r.strayHulls.length === 0, shadows: !r.hd.shadowRule.length && !r.lod.shadowRule.length,
    flash: !r.hd.flashBad && !r.lod.flashBad && r.merge.flashShared && r.merge.flashCovers, hulls: r.hd.hullMatsOK && r.lod.hullMatsOK,
    merge: r.merge.mappedSubMaterials <= 1 && r.merge.extras.every((e) => e.plain && K.JOINTS.includes(e.parent) || e.k === 'swR' || e.k === 'swL') && (!r.merge.animMoves || r.merge.animMoves.moved_m > 0.005),
    height: r.hd.height >= 1.8 * (M.META[member].scale || 1) && r.hd.height <= 2.2 * (M.META[member].scale || 1), feet: Math.abs(r.hd.feetMinY) <= 0.03,
  };
  out.textContent += ' ' + (Object.values(r.pass).every(Boolean) ? 'PASS' : 'FAIL ' + Object.entries(r.pass).filter(([, v]) => !v).map(([k]) => k).join(','));
}
R.allPass = Object.values(R.members).every((r) => Object.values(r.pass).every(Boolean));
out.textContent += `\n\nALL: ${R.allPass ? 'PASS' : 'FAIL'}`;
window.__qa = R; window.__ready = true;
