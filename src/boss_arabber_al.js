// boss_arabber_al.js — Toad City Baltimore, Task D boss 11 of 17 (batch 2, O6): Arabber Al, Fells Point.
// tcr2 o6 redclaw-rocket
// A street-produce arabber on his souped-up horse-cart: flat cap, handlebar mustache, rolled sleeves and a green apron, seated on the
// bench of a painted produce wagon (fruit crates, red wheels with chrome hubs, chrome side pipes) drawn by a stocky dappled pony with a
// red plume. Original character: no real person, company or livery.
// Contract: TASK_D_bosses.md + O6 brief + J-003 Q-b: rider and vehicle in one module, J.vehicle is a Group under J.root (merged by the
// real mergeRig, counted in the budget). Normal boss states: run = the cart driving (pony gallop + wheel spin in animateBoss), atk1 =
// the produce throw. Car-chase hook: buildArabberAl() / buildArabberAl(deps) returns { root, update(dt, st), J } with
// st = { t, state, throwK } (throwK 0..1 drives the throwing arm); feet / wheels at y = 0, facing +z.

export const META = { id: 'arabber_al', name: 'Arabber Al', district: 'fells', hp: 120, scale: 1.0, radius: 2.0, height: 2.1, vehicle: 'horse_cart' };
export const ATTACKS = [
  { id: 'melon_lob', pose: 'atk1', dur: 0.95, windup: 0.42, active: [0.46, 0.64], reach: 12, arc: 30, dmg: 12, fx: 'produce_lob', strike: 'haR' },
  { id: 'rein_snap_ram', pose: 'atk2', dur: 1.1, windup: 0.36, active: [0.4, 0.72], reach: 3.5, arc: 50, dmg: 15, move: 8, fx: 'cart_ram', strike: 'haL' },
  { id: 'strawberry_shower', pose: 'atk3', dur: 1.2, windup: 0.4, active: [0.45, 0.7], reach: 5, arc: 180, dmg: 10, fx: 'fruit_spray', strike: 'haR' },
];

// ---------------- kit access ----------------
// Normal path: the game / viewer passes the kit object K (everything comes through it, hard rule 2).
// Hook path: the game's live modes pass partial deps ({ THREE, toonMat, outlineMat, ... }, or only { THREE }). kitFrom() completes
// them with helpers copied line for line from kit/toadcity_kit.js (G, part, grp, skeleton, addOdir, bakeColor, blank, legsStance,
// runLegs, applyPose, and toonMat / outlineMat / basicMat when the caller passes none) so the same build runs there.
function kitFrom(o) {
  if (o && o.part && o.skeleton && o.G && o.blank && o.applyPose && o.basicMat) return o;
  if (o && o.part && o.skeleton && o.G && o.blank && o.applyPose) return Object.assign({}, o, { basicMat: (x) => new o.THREE.MeshBasicMaterial(x) });
  const THREE = o.THREE, TAU = Math.PI * 2, QUAL = o.QUAL || { hd: true, outlines: [], texs: [] };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t);
  const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
  const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const addOdir = o.addOdir || ((g) => {
    const p = g.attributes.position, n = g.attributes.normal, map = new Map(), keys = [];
    for (let i = 0; i < p.count; i++) {
      const k = Math.round(p.getX(i) * 1e3) + ',' + Math.round(p.getY(i) * 1e3) + ',' + Math.round(p.getZ(i) * 1e3);
      keys.push(k); let e = map.get(k); if (!e) map.set(k, (e = []));
      const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
      if (!e.some((q) => q[0] * nx + q[1] * ny + q[2] * nz > 0.985)) e.push([nx, ny, nz]);
    }
    const res = new Map();
    for (const [k, e] of map) {
      let x = 0, y = 0, z = 0; for (const q of e) { x += q[0]; y += q[1]; z += q[2]; }
      const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      let mn = 1; for (const q of e) mn = Math.min(mn, q[0] * x + q[1] * y + q[2] * z);
      const s = 1 / Math.max(mn, 0.35); res.set(k, [x * s, y * s, z * s]);
    }
    const od = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const d = res.get(keys[i]); od[i * 3] = d[0]; od[i * 3 + 1] = d[1]; od[i * 3 + 2] = d[2]; }
    g.setAttribute('odir', new THREE.BufferAttribute(od, 3)); return g;
  });
  const bakeColor = o.bakeColor || ((g, col) => {
    const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  });
  const toonMat = o.toonMat || ((opts = {}) => {   // kit/toadcity_kit.js toonMat, verbatim (only used when the caller passes none)
    const m = new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, opts));
    m.userData.flash = { value: 0 }; m.userData.flashC = { value: new THREE.Color(1, 1, 1) };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uFlash = m.userData.flash; sh.uniforms.uFlashC = m.userData.flashC;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uFlash; uniform vec3 uFlashC;')
        .replace('#include <opaque_fragment>', `
          { float ld = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 1e-3), lo = dot(outgoingLight, vec3(0.299, 0.587, 0.114)), r = lo / ld;
            float b = mix(0.46, 0.78, smoothstep(0.38, 0.44, r)); b = mix(b, 1.06, smoothstep(0.86, 0.92, r)); b = mix(b, r, step(1.35, r));
            outgoingLight *= b / max(r, 1e-3);
            outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.88, 0.86, 1.1), (1.0 - smoothstep(0.38, 0.44, r)) * 0.5); }
          outgoingLight = mix(outgoingLight, uFlashC, uFlash);
          #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'psx' + (opts.map ? 'M' : '');
    return m;
  });
  const outlineMat = o.outlineMat || ((w) => new THREE.ShaderMaterial({   // kit outlineMat, verbatim, with its own fog uniforms
    uniforms: { uW: { value: w }, uC: { value: new THREE.Color('#14101f') }, uFogC: { value: new THREE.Color('#000') }, uFogN: { value: 100 }, uFogF: { value: 200 } },
    vertexShader: `attribute vec3 odir; uniform float uW; varying float vD;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vec3 wd = mat3(modelMatrix) * odir;
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 2.5, 36.0);
        vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uC; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF; varying float vD;
      void main() { gl_FragColor = vec4(mix(uC, uFogC, smoothstep(uFogN, uFogF, vD)), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  }));
  const OUT_CHAR = o.OUT_CHAR || outlineMat(0.0042);
  const G = o.G || {
    sph: (rx, ry, rz, ws = 8, hs = 6) => new THREE.SphereGeometry(1, QUAL.hd ? Math.max(ws * 2, 18) : Math.min(ws, 9), QUAL.hd ? Math.max(hs * 2, 12) : Math.min(hs, 7)).scale(rx, ry, rz),
    cap: (r, len, rs = 6) => new THREE.CapsuleGeometry(r, len, QUAL.hd ? 4 : 2, QUAL.hd ? 12 : Math.min(rs, 6)),
    box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    cyl: (rt, rb, h, s = 7, open = false) => new THREE.CylinderGeometry(rt, rb, h, QUAL.hd ? Math.max(s * 2, 14) : Math.min(s, 8), 1, open),
    tor: (R, r, arc = TAU) => new THREE.TorusGeometry(R, r, QUAL.hd ? 6 : 3, QUAL.hd ? 16 : 7, arc),
  };
  const part = (parent, geom, col, x = 0, y = 0, z = 0, q = {}) => {
    bakeColor(geom, col); const ol = q.outline !== false && geom.attributes.normal;
    if (ol) addOdir(geom);
    const m = new THREE.Mesh(geom, q.mat || parent.userData.mat || parent.parent?.userData.mat);
    m.position.set(x, y, z); if (q.rot) m.rotation.set(q.rot[0], q.rot[1], q.rot[2]);
    if (ol) { const h = new THREE.Mesh(geom, q.olMat || OUT_CHAR); h.castShadow = false; h.visible = QUAL.hd; m.add(h); QUAL.outlines.push(h); }
    geom.computeBoundingSphere(); m.castShadow = q.shadow !== false && geom.boundingSphere.radius > 0.1; parent.add(m);
    return m;
  };
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const skeleton = (d, mat) => {
    const J = {}; J.root = new THREE.Group(); J.mat = mat;
    const P = (g) => { g.userData.mat = mat; return g; };
    J.tilt = P(grp(J.root)); J.hips = P(grp(J.tilt, 0, d.hip, 0)); J.torso = P(grp(J.hips, 0, d.torsoY, 0)); J.neck = P(grp(J.torso, 0, d.neckY, 0));
    for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
      J['lg' + k] = P(grp(J.hips, s * d.legX, 0, 0)); J['kn' + k] = P(grp(J['lg' + k], 0, -d.thigh, 0)); J['ft' + k] = P(grp(J['kn' + k], 0, -d.shin, 0));
      J['sh' + k] = P(grp(J.torso, s * d.shX, d.shY, 0)); J['el' + k] = P(grp(J['sh' + k], 0, -d.upper, 0)); J['ha' + k] = P(grp(J['el' + k], 0, -d.fore, 0));
    }
    J.d = d; return J;
  };
  const JOINTS = ['tilt', 'hips', 'torso', 'neck', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'lgL', 'lgR', 'knL', 'knR', 'ftL', 'ftR', 'swL', 'swR'];
  const blank = () => { const p = { y: 0, ty: 0 }; for (const j of JOINTS) p[j] = [0, 0, 0]; return p; };
  const legsStance = (p, wide = 0.13, bend = 0.3) => {
    p.lgL = [-bend * 0.5, 0, wide]; p.lgR = [-bend * 0.3, 0, -wide]; p.knL = [bend, 0, 0]; p.knR = [bend * 0.9, 0, 0];
    p.ftL = [-bend * 0.5, 0, -wide]; p.ftR = [-bend * 0.5, 0, wide]; p.y = -0.04 - bend * 0.08;
  };
  const runLegs = (p, ph, amp = 1) => {
    for (const [k, off] of [['L', 0], ['R', Math.PI]]) {
      const s = Math.sin(ph + off), c = Math.cos(ph + off);
      p['lg' + k] = [-0.85 * s * amp - 0.15, 0, 0]; p['kn' + k] = [0.25 + 1.25 * Math.max(0, c) * amp, 0, 0]; p['ft' + k] = [0.3 * s * amp, 0, 0];
    }
    p.y = -0.05 + 0.07 * Math.abs(Math.sin(ph)) * amp;
  };
  const applyPose = (J, p, r, dt, snapTilt) => {
    for (const j of JOINTS) {
      const g = J[j]; if (!g) continue; const t = p[j];
      if (j === 'tilt' && snapTilt) { g.rotation.set(t[0], t[1], t[2]); continue; }
      if (j === 'tilt') { g.rotation.x = wrapA(g.rotation.x); g.rotation.y = wrapA(g.rotation.y); }
      g.rotation.x = damp(g.rotation.x, t[0], r, dt); g.rotation.y = damp(g.rotation.y, t[1], r, dt); g.rotation.z = damp(g.rotation.z, t[2], r, dt);
    }
    J.hips.position.y = damp(J.hips.position.y, J.d.hip + p.y, r, dt);
    J.tilt.position.y = damp(J.tilt.position.y, p.ty, r, dt);
  };
  return { THREE, TAU, clamp, lerp, ease, damp, wrapA, QUAL, NIGHT: o.NIGHT || { value: 0 }, toonMat, basicMat: o.basicMat || ((x) => new THREE.MeshBasicMaterial(x)),
    outlineMat, OUT_CHAR, addOdir, bakeColor, G, part, grp, skeleton, JOINTS, blank, legsStance, runLegs, applyPose };
}

// ---------------- the rig ----------------
// Al sits at z = +0.25 (J.hips.position.z) so the whole wagon is centred on the root for culling; the bench top is at y 0.86
const D = { hip: 0.98, torsoY: 0.06, neckY: 0.6, legX: 0.13, thigh: 0.4, shin: 0.4, shX: 0.3, shY: 0.5, upper: 0.29, fore: 0.27 };
const C = { skin: '#c98a5a', shirt: '#f0e6c8', apron: '#3f7d4a', pants: '#4a3a2c', cap: '#6a5a48', boot: '#2a1e16', stache: '#3a2a20',
  wood: '#c24a2a', wood2: '#e8b84a', bed: '#7a4a2a', rim: '#d23a2a', chrome: '#d8dce6', melon: '#4f9a3a', straw: '#e0303a', orange: '#ff9a2a',
  pony: '#b8865a', mane: '#3a2618', plume: '#e0283a', collar: '#2a6a9a', ink: '#14101f' };

function build(K, opts) {
  const { G, part, grp, THREE } = K, PI = Math.PI;
  const mat = K.toonMat(); const J = K.skeleton(D, mat); J.K = K;
  J.hips.position.z = 0.25;
  const lod = opts.lod === 1;
  // ---- Al ----
  part(J.hips, G.sph(0.22, 0.15, 0.18), C.pants, 0, 0.02, 0);
  part(J.torso, G.sph(0.27, 0.32, 0.22), C.shirt, 0, 0.3, 0);
  part(J.torso, G.box(0.36, 0.5, 0.06), C.apron, 0, 0.18, 0.2, { rot: [0.12, 0, 0] });
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.17, 0.2, 0.18), C.skin, 0, 0.2, 0.01);
  part(head, G.sph(0.16, 0.04, 0.05), C.stache, 0, 0.12, 0.16, { rot: [0, 0, 0] });                              // handlebar mustache
  part(head, G.box(0.24, 0.05, 0.04), C.ink, 0, 0.25, 0.16, { outline: false, shadow: false });                  // eyes / brow band
  part(head, G.sph(0.2, 0.08, 0.21), C.cap, 0, 0.34, -0.01);                                                     // flat cap crown
  part(head, G.box(0.24, 0.025, 0.14), C.cap, 0, 0.31, 0.18, { rot: [0.15, 0, 0] });                             // cap brim
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    part(J['sh' + k], G.sph(0.1, 0.1, 0.1), C.shirt, 0, 0, 0);
    part(J['sh' + k], G.cap(0.08, D.upper - 0.08), C.shirt, 0, -D.upper / 2, 0);
    part(J['el' + k], G.cap(0.07, D.fore - 0.08), C.skin, 0, -D.fore / 2, 0);                                     // rolled sleeves
    part(J['ha' + k], G.sph(0.085, 0.08, 0.08), C.skin, 0, -0.03, 0);
    part(J['lg' + k], G.cap(0.1, D.thigh - 0.1), C.pants, 0, -D.thigh / 2, 0);
    part(J['kn' + k], G.cap(0.09, D.shin - 0.14), C.pants, 0, -D.shin / 2 + 0.02, 0);
    part(J['ft' + k], G.sph(0.1, 0.08, 0.17), C.boot, 0, -0.03, 0.06);
  }
  const sw = J.swR = grp(J.haR, 0, -0.05, 0.02); sw.userData.mat = mat;                                          // the melon he throws
  J.melon = part(sw, G.sph(0.17, 0.14, 0.14), C.melon, 0, -0.13, 0);
  // ---- the wagon (J.vehicle, under J.root) ----
  const V = J.vehicle = grp(J.root, 0, 0, -0.2); V.userData.mat = mat;
  part(V, G.box(0.86, 0.12, 0.4), C.wood2, 0, 0.8, 0.43);                                                        // bench
  part(V, G.box(0.86, 0.06, 0.34), C.bed, 0, 0.4, 0.92, { rot: [0.25, 0, 0] });                                  // footboard
  part(V, G.box(1.24, 0.12, 1.5), C.bed, 0, 0.62, -0.42);                                                        // bed
  for (const s of [-1, 1]) {
    part(V, G.box(0.06, 0.34, 1.5), C.wood, s * 0.62, 0.84, -0.42);                                              // painted side boards
    part(V, G.cyl(0.04, 0.04, 1.1, 8), C.chrome, s * 0.78, 0.36, -0.2, { rot: [PI / 2, 0, 0] });               // side pipes
  }
  for (const [x, z, f] of [[-0.3, -0.15, C.straw], [0.3, -0.15, C.orange], [0, -0.82, C.melon]]) {
    part(V, G.box(0.48, 0.28, 0.42), C.wood2, x, 0.82, z);                                                      // crate
    part(V, G.sph(0.22, 0.12, 0.19), f, x, 0.98, z);                                                            // heaped produce
  }
  J.wheels = [];
  for (const s of [-1, 1]) {
    const w = grp(V, s * 0.72, 0.5, -0.5); w.userData.mat = mat; J.wheels.push(w);
    part(w, G.tor(0.45, 0.05), C.rim, 0, 0, 0, { rot: [0, PI / 2, 0] });
    part(w, G.cyl(0.42, 0.42, 0.03, 12), C.wood2, 0, 0, 0, { rot: [0, 0, PI / 2] });                            // painted wheel disc
    part(w, G.cyl(0.13, 0.13, 0.08, 10), C.chrome, s * 0.03, 0, 0, { rot: [0, 0, PI / 2] });                    // chrome hub
  }
  for (const s of [-1, 1]) part(V, G.cyl(0.03, 0.03, 0.62, 6), C.wood2, s * 0.32, 0.62, 1.0, { rot: [PI / 2 - 0.1, 0, 0] });   // shafts
  // ---- the pony (under the vehicle; legs and head are groups animateBoss gallops) ----
  const P = J.pony = grp(V, 0, 0, 1.52); P.userData.mat = mat;
  part(P, G.sph(0.33, 0.31, 0.47), C.pony, 0, 0.78, 0);
  const nk = J.ponyHead = grp(P, 0, 0.92, 0.34); nk.userData.mat = mat;
  part(nk, G.cap(0.14, 0.24), C.pony, 0, 0.14, 0.1, { rot: [0.8, 0, 0] });
  part(nk, G.sph(0.15, 0.15, 0.25), C.pony, 0, 0.3, 0.3, { rot: [0.7, 0, 0] });
  part(nk, G.sph(0.1, 0.1, 0.1), C.mane, 0, 0.17, 0.45);                                                         // muzzle
  part(nk, G.box(0.07, 0.3, 0.2), C.mane, 0, 0.26, -0.02, { rot: [0.8, 0, 0] });                                 // mane
  for (const s of [-1, 1]) part(nk, G.cyl(0.0, 0.05, 0.13, 5), C.pony, s * 0.08, 0.46, 0.24, { rot: [-0.1, 0, s * -0.3] });   // ears
  part(nk, G.box(0.2, 0.03, 0.04), C.ink, 0, 0.36, 0.38, { rot: [0.7, 0, 0], outline: false, shadow: false });                     // eyes
  part(nk, G.sph(0.06, 0.15, 0.06), C.plume, 0, 0.58, 0.18, { rot: [-0.3, 0, 0] });                              // plume
  J.ponyLegs = [];
  for (const [x, z] of [[0.16, 0.26], [-0.16, 0.26], [0.16, -0.26], [-0.16, -0.26]]) {
    const l = grp(P, x, 0.58, z); l.userData.mat = mat; J.ponyLegs.push(l);
    part(l, G.cap(0.085, 0.38), C.pony, 0, -0.29, 0);
  }
  const tl = J.ponyTail = grp(P, 0, 0.88, -0.45); tl.userData.mat = mat;
  part(tl, G.cap(0.06, 0.32), C.mane, 0, -0.18, -0.06, { rot: [-0.4, 0, 0] });
  J.gapPairs = [['torso', 'neck']];
  J.kind = 'boss'; J.meta = META;
  return J;
}

export function buildArabberAl(K0, opts = {}) {
  if (K0 && K0.part && K0.skeleton) return build(kitFrom(K0), opts);           // boss contract: (K, opts) -> J
  // car-chase hook (J-003 Q-b): called with no arguments, or with deps; THREE comes from deps, then window.K / window.THREE
  const deps = K0 || globalThis.K || (globalThis.THREE ? { THREE: globalThis.THREE } : null);
  if (!deps || !deps.THREE) throw new Error('buildArabberAl(): pass { THREE } (or the kit K), or expose window.THREE');
  const K = kitFrom(deps), J = build(K, Object.assign({}, opts, deps.part ? {} : deps));
  K.applyPose(J, POSES.idle(0, J), 1e4, 1, true);
  let tt = 0;
  return { root: J.root, J, update(dt, st = {}) {
    tt = st.t ?? tt + dt; const k = st.throwK || 0, s = st.state || 'idle';
    const p = k > 0 ? POSES.atk1(k, J) : s === 'run' || s === 'drive' || s === 'chase' ? POSES.run(tt, 6, J) : s === 'hurt' ? POSES.hurt(0.3, J) : POSES.idle(tt, J);
    K.applyPose(J, p, k > 0 ? 30 : 14, Math.min(dt || 1 / 60, 0.1), false);
    animateBoss(J, tt, k > 0 ? 'atk1' : s === 'drive' || s === 'chase' ? 'run' : s, k);
  } };
}

// ---------------- poses (Al stays on the bench: seated legs in every pose) ----------------
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lp = (a, b, t) => a + (b - a) * t, ez = (t) => t * t * (3 - 2 * t);
function seat(J, lift = 0) {
  const p = J.K.blank();
  p.lgL = [-1.45 + lift, 0, 0.12]; p.knL = [1.4 - lift, 0, 0]; p.lgR = [-1.45 + lift, 0, -0.12]; p.knR = [1.4 - lift, 0, 0];
  p.ftL = [0.1, 0, 0]; p.ftR = [0.1, 0, 0]; return p;
}
export const POSES = {
  idle(t, J) {   // reins in the left hand, right hand tossing the melon, hollering at the street
    const p = seat(J), b = Math.sin(t * 2.4);
    p.torso = [0.08, 0.15, 0]; p.neck = [-0.05 + 0.06 * b, -0.15, 0];
    p.shL = [-0.9, 0, 0.2]; p.elL = [-0.9, 0, 0];
    p.shR = [-0.6, 0, -0.35]; p.elR = [-1.6 + 0.35 * Math.abs(b), 0, 0];
    return p;
  },
  run(t, sp, J) {   // driving: leaning into it, both hands on the reins, bouncing on the bench
    const p = seat(J), ph = t * (8 + sp); p.y = 0.03 * Math.abs(Math.sin(ph));
    p.torso = [0.35, 0.05 * Math.sin(ph), 0]; p.neck = [-0.3, 0, 0];
    p.shL = [-1.2, 0, 0.15]; p.elL = [-0.5 - 0.15 * Math.sin(ph), 0, 0]; p.shR = [-1.2, 0, -0.15]; p.elR = [-0.5 - 0.15 * Math.sin(ph), 0, 0];
    return p;
  },
  hurt(u, J) {
    const p = seat(J), k = 1 - u;
    p.torso = [-0.5 * k, 0.3 * k, 0]; p.neck = [-0.5 * k, 0, 0]; p.shL = [-0.6, 0, 0.9]; p.shR = [-0.6, 0, -0.9]; p.elL = p.elR = [-0.8, 0, 0];
    return p;
  },
  down(u, ground, J) {   // knocked flat on his back into his own produce: legs up over the bench, arms flung out
    const p = seat(J, 0.6); p.tilt = [ground ? -1.2 : -1.2 * cl(u * 2.2), 0, 0]; p.ty = ground ? 0.42 : 0.6;
    p.shL = [-2.2, 0, 0.9]; p.shR = [-2.0, 0, -1.0]; p.elL = p.elR = [-0.3, 0, 0]; p.neck = [0.5, 0, 0];
    return p;
  },
  // atk1 melon lob: half-stands, cocks the melon back behind the head, then an overhand lob (the melon leaves the hand at u 0.55)
  atk1(u, J) {
    const p = seat(J, 0.35), c = ez(cl(u / 0.42)), th = ez(cl((u - 0.44) / 0.12)), rec = ez(cl((u - 0.75) / 0.25));
    p.y = 0.12 * c * (1 - rec); p.torso = [lp(lp(0.08, -0.35, c), 0.45, th) - rec * 0.3, lp(0.15, 0.5, c) * (1 - th), 0]; p.neck = [lp(0, 0.2, c) - th * 0.4, 0, 0];
    p.shR = [lp(lp(-0.6, -2.7, c), -1.3, th) + rec * 0.6, 0, -0.2]; p.elR = [lp(lp(-1.6, -1.5, c), -0.2, th), 0, 0];
    p.shL = [lp(-0.9, -0.5, c), 0, 0.5]; p.elL = [-0.9, 0, 0];
    return p;
  },
  // atk2 rein-snap ram: stands up in the footboard and cracks the reins two-handed (the pony rears, then the cart rams forward)
  atk2(u, J) {
    const p = seat(J, 0.5), up = ez(cl(u / 0.36)), sn = ez(cl((u - 0.38) / 0.08)), rec = ez(cl((u - 0.8) / 0.2));
    p.y = 0.18 * up * (1 - rec); p.torso = [lp(lp(0.1, -0.3, up), 0.55, sn) - rec * 0.4, 0, 0]; p.neck = [-0.2 * sn, 0, 0];
    for (const [s, k] of [[1, 'L'], [-1, 'R']]) { p['sh' + k] = [lp(lp(-0.9, -2.8, up), -1.0, sn) + rec * 0.2, 0, s * 0.25]; p['el' + k] = [lp(-0.9, -0.2, up), 0, 0]; }
    return p;
  },
  // atk3 strawberry shower: twists left, scoops both arms from the crates and flings a wide arc of fruit across the front
  atk3(u, J) {
    const p = seat(J, 0.25), w = ez(cl(u / 0.4)), fl = ez(cl((u - 0.43) / 0.18)), rec = ez(cl((u - 0.82) / 0.18));
    p.torso = [0.15, lp(lp(0.15, 1.1, w), -0.9, fl) * (1 - rec) + rec * 0.15, 0]; p.hips = [0, lp(0, 0.3, w) * (1 - fl), 0]; p.neck = [0, lp(-0.5, 0.6, fl) * (1 - rec), 0];
    for (const [s, k] of [[1, 'L'], [-1, 'R']]) { p['sh' + k] = [lp(lp(-0.6, -0.4, w), -1.4, fl), 0, s * lp(lp(0.3, 0.5, w), 1.25, fl) * (1 - rec * 0.6)]; p['el' + k] = [lp(lp(-1.0, -1.6, w), -0.15, fl), 0, 0]; }
    return p;
  },
};

// optional (safe to skip): pony gallop + head toss + rearing on the ram, wheels spinning when driving, melon hidden after the lob
export function animateBoss(J, t, state, u = 0) {
  if (!J.ponyLegs) return;
  const drive = state === 'run' || state === 'atk2' ? 1 : 0, gal = t * 11;
  J.ponyLegs.forEach((l, i) => { l.rotation.x = drive ? Math.sin(gal + (i < 2 ? 0 : Math.PI) + (i % 2) * 0.6) * 0.75 : Math.sin(t * 1.3 + i) * 0.04; });
  const rear = state === 'atk2' ? Math.sin(cl((u - 0.1) / 0.5) * Math.PI) : 0;
  J.pony.rotation.x = -0.45 * rear; J.pony.position.y = 0.18 * rear;
  J.ponyHead.rotation.x = drive ? Math.sin(gal) * 0.12 : Math.sin(t * 0.9) * 0.06; J.ponyTail.rotation.x = drive ? 0.5 + Math.sin(gal * 0.5) * 0.3 : Math.sin(t * 1.7) * 0.1;
  for (const w of J.wheels) w.rotation.x = drive ? t * 9 : 0;
  if (J.melon) J.melon.visible = !(state === 'atk1' && u > 0.56);
}
