// ===== copied from Toad City Baltimore src/04b_rig_merge.js @ hark/integration 00058aa (rig merge: each rig -> a few skinned meshes) =====

// ---------------- rig merge (performance): every character part becomes one vertex range of a rigidly-skinned mesh ----------------
// A rig was ~40-90 little meshes, each with its own ink-outline hull (2 draw calls + a shadow call per part). After the rig is built,
// mergeRig() bakes each part into its joint's space, tags its vertices with that joint (skinIndex, weight 1) and merges everything
// per material into one SkinnedMesh whose "bones" are the rig's existing joint groups (poses keep animating the groups as before).
// The hulls merge the same way into one skinned outline mesh. Result: ~2-4 draw calls per character, same look.
const OUT_SKIN = new Map(); // skinned twin of each outline material (same uniforms)
function skinnedOutline(src) {
  let m = OUT_SKIN.get(src); if (m) return m;
  m = new THREE.ShaderMaterial({
    uniforms: src.uniforms, // shared: width, colour and fog follow the original
    vertexShader: `#include <common>
      #include <skinning_pars_vertex>
      attribute vec3 odir; uniform float uW; varying float vD;
      void main() { vec3 p = position; vec3 od = odir;
        #ifdef USE_SKINNING
          mat4 bm = getBoneMatrix(skinIndex.x);
          p = (bindMatrixInverse * (bm * (bindMatrix * vec4(position, 1.0)))).xyz;
          od = mat3(bindMatrixInverse) * (mat3(bm) * (mat3(bindMatrix) * odir));
        #endif
        vec4 wp = modelMatrix * vec4(p, 1.0); vec3 wd = mat3(modelMatrix) * od;
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 2.5, 36.0);
        vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: src.fragmentShader,
    side: THREE.BackSide,
  });
  OUT_SKIN.set(src, m); return m;
}
const _I4 = new THREE.Matrix4(), _N3 = new THREE.Matrix3(), _O3 = new THREE.Matrix3(), _v3 = new THREE.Vector3();
function mergeRig(J) {
  const root = J.root, bones = [], bIdx = new Map(), byMat = new Map(), byOl = new Map(), kill = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || (o.parent && o.parent.isMesh)) return; // part meshes only (hulls are children of parts)
    const b = o.parent; if (!bIdx.has(b)) { bIdx.set(b, bones.length); bones.push(b); }
    const hull = o.children.find((c) => c.isMesh && c.material && c.material.isShaderMaterial);
    const e = { g: o.geometry, M: o.matrix.clone(), bi: bIdx.get(b) };
    if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(e);
    if (hull) { if (!byOl.has(hull.material)) byOl.set(hull.material, []); byOl.get(hull.material).push(e); }
    kill.push(o, ...(hull ? [hull] : []));
  });
  if (!bones.length) return J;
  for (const o of kill) { if (o.parent) o.parent.remove(o); const k = QUAL.outlines.indexOf(o); if (k >= 0) QUAL.outlines.splice(k, 1); }
  const skel = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
  const build = (list, ol) => {
    let nv = 0, ni = 0; for (const e of list) { nv += e.g.attributes.position.count; ni += e.g.index ? e.g.index.count : e.g.attributes.position.count; }
    const P = new Float32Array(nv * 3), N = ol ? null : new Float32Array(nv * 3), UV = ol ? null : new Float32Array(nv * 2), C = ol ? null : new Float32Array(nv * 3),
      OD = ol ? new Float32Array(nv * 3) : null, SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4), IX = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v0 = 0, i0 = 0;
    for (const e of list) {
      const g = e.g, A = g.attributes, n = A.position.count; _N3.getNormalMatrix(e.M); _O3.setFromMatrix4(e.M);
      for (let i = 0; i < n; i++) {
        const k = v0 + i;
        _v3.fromBufferAttribute(A.position, i).applyMatrix4(e.M); P[k * 3] = _v3.x; P[k * 3 + 1] = _v3.y; P[k * 3 + 2] = _v3.z;
        if (ol) { _v3.fromBufferAttribute(A.odir, i).applyMatrix3(_O3); OD[k * 3] = _v3.x; OD[k * 3 + 1] = _v3.y; OD[k * 3 + 2] = _v3.z; }
        else {
          _v3.fromBufferAttribute(A.normal, i).applyMatrix3(_N3).normalize(); N[k * 3] = _v3.x; N[k * 3 + 1] = _v3.y; N[k * 3 + 2] = _v3.z;
          if (A.uv) { UV[k * 2] = A.uv.getX(i); UV[k * 2 + 1] = A.uv.getY(i); }
          if (A.color) { C[k * 3] = A.color.getX(i); C[k * 3 + 1] = A.color.getY(i); C[k * 3 + 2] = A.color.getZ(i); } else C[k * 3] = C[k * 3 + 1] = C[k * 3 + 2] = 1;
        }
        SI[k * 4] = e.bi; SW[k * 4] = 1;
      }
      if (g.index) for (let j = 0; j < g.index.count; j++) IX[i0 + j] = g.index.getX(j) + v0; else for (let j = 0; j < n; j++) IX[i0 + j] = j + v0;
      v0 += n; i0 += g.index ? g.index.count : n;
    }
    const G2 = new THREE.BufferGeometry();
    G2.setAttribute('position', new THREE.BufferAttribute(P, 3));
    if (ol) G2.setAttribute('odir', new THREE.BufferAttribute(OD, 3));
    else { G2.setAttribute('normal', new THREE.BufferAttribute(N, 3)); G2.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); G2.setAttribute('color', new THREE.BufferAttribute(C, 3)); }
    G2.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); G2.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
    G2.setIndex(new THREE.BufferAttribute(IX, 1));
    return G2;
  };
  const add = (geo, mat, ol) => {
    const m = new THREE.SkinnedMesh(geo, mat); m.bind(skel, _I4);
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 2.6); // 2.6 covers a ~2 m rig lying flat in 'down' (reaches ~2.48 m from centre) // rig-space bounds (culling without per-frame CPU skinning)
    m.castShadow = !ol; m.receiveShadow = false;
    if (ol) { m.visible = QUAL.hd; QUAL.outlines.push(m); }
    root.add(m); return m;
  };
  J.merged = [];
  for (const [mat, list] of byMat) J.merged.push(add(build(list, false), mat, false));
  for (const [om, list] of byOl) J.merged.push(add(build(list, true), skinnedOutline(om), true));
  const seen = new Set(); for (const o of kill) if (!seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
  return J;
}
if (!Q.has('nomerge')) {
  const _bh = buildHero, _bt = buildThug;
  buildHero = (o) => mergeRig(_bh(o));
  buildThug = (l) => mergeRig(_bt(l));
}
