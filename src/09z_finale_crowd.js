// ======================= FINALE CROWD: the cheering city under the drone flyover (Brad 2026-10-13: "I don't see people in the windows and rooftops and streets and stoops cheering").
// Only alive while the drone flies after CITY SAVED (09z_finale.js calls __crowd.on() / off() / frame()); the normal city is untouched (nothing is added to the
// scene until on(), and everything is removed again by off()).
//   PEOPLE: one InstancedMesh of a low-poly toad townsfolk (legs, shirt, wide toad head, eyes, two arms) with per-instance skin / shirt colours. All the animation is
//     in the vertex shader (no skinning): a per-instance phase + style picks wave / jump / clap / sign-holder / stoop-sitter (sits until the drone comes near, then
//     stands up and waves or claps). Each one turns to face the camera in the shader, so the whole crowd watches you go by.
//   WINDOWS: one InstancedMesh of window cards on the generic buildings: a lit room (warm lamp / TV blue / pink) with one or two procedural silhouettes waving.
//   SIGNS: one InstancedMesh of hand-held boards ("THANK YOU HAROLD & MAVIS", "HON!", "CITY SAVED", "WE LOVE YOU HON") above the sign-holders' heads.
//   STOOPS: one InstancedMesh of white marble rowhouse steps (Fells Point + the low south-shore rowhouses) the stoop sitters sit on.
//   SKY: one additive Points system for the city fireworks over the harbor + confetti puffs over the nearest crowds.
//   AUDIO: a WebAudio crowd bed (band-passed noise) whose gain follows how many people are near the camera, plus "woo" voices + clap bursts as you pass.
// LOD / culling: every spot is precomputed once from the city data (BLD roofs, GEN blocks' sidewalks, the harbor promenade + piers, Federal Hill, landmark roofs);
// every 0.3 s only the spots near the camera (and not behind it) are written into the instance buffers, nearest first, up to a fixed cap per mesh.
// Added draw calls while on: people 1 + windows 1 + signs 1 + stoops 1 + sky points 1 = 5. State on window.__crowd (stats()).
(function () {
  const AUTO = Q.has('finaleauto');
  let seed = 4242; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[(R() * a.length) | 0];
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const SKIN = ['#6fae4a', '#8cc152', '#5a9a5c', '#a3b94a', '#4f8f6a', '#9a8f4a', '#7ab36a', '#b0a35a', '#6a9e8a'].map(hex);
  const SHIRT = ['#ff7a1a', '#ff7a1a', '#4a2a8a', '#4a2a8a', '#e83a3a', '#2a6fd6', '#ffd23c', '#ffffff', '#ff6bb0', '#2aa87a', '#222230', '#c81e3a'].map(hex);
  const CAP = { people: AUTO ? 520 : 760, windows: 300, signs: 28, stoops: 140 };
  const S = { on: false, built: false, people: 0, windows: 0, signs: 0, stoops: 0, bursts: 0, confetti: 0, loud: 0, refills: 0, spots: 0, winSpots: 0, t: 0 };
  const U = { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uFlash: { value: new THREE.Vector3() } };

  // ---------------- the spots (built once, lazily, from the city data) ----------------
  // person spot: x, y, z, style (0 wave, 1 jump, 2 clap, 3 sign, 4 stoop), scale, phase, skin, shirt
  const P = [], W = [], ST = []; // people, window cards {x,y,z,ry,w,h}, stoops {x,y,z,ry}
  const styleMix = () => { const r = R(); return r < 0.4 ? 0 : r < 0.68 ? 1 : 2; };
  function person(x, z, y, style, opt = {}) { if (y === undefined) y = groundY(x, z); P.push({ x, y, z, st: style === undefined ? styleMix() : style, s: opt.s || 1.05 + R() * 0.35, ph: R() * 100, sk: pick(SKIN), sh: pick(SHIRT), sign: opt.sign }); }
  let signN = 0; const SIGNS = 4;
  function maybeSign(x, z, y) { if (R() < 0.035) { person(x, z, y, 3, { sign: signN++ % SIGNS }); return true; } return false; }
  function crowdRow(x0, z0, x1, z1, gap, rows, rowGap, nx, nz, dens = 0.85, y) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(L / gap));
    for (let i = 0; i <= n; i++) for (let r = 0; r < rows; r++) { if (R() > dens) continue; const t = (i + (R() - 0.5) * 0.6) / n;
      const x = lerp(x0, x1, t) + nx * r * rowGap + (R() - 0.5) * 0.4, z = lerp(z0, z1, t) + nz * r * rowGap + (R() - 0.5) * 0.4;
      if (!maybeSign(x, z, y)) person(x, z, y); }
  }
  const isGenB = (b) => { const f = (b.h - GF - PAR) / FH; return Math.abs(f - Math.round(f)) < 0.01 && f >= 1 && f <= 9; };
  function build() {
    if (S.built) return; S.built = true;
    // 1) the harbor promenade (north, south, west edges): two or three rows along the seawall, plus the piers' edges
    const zN = BASIN.z0 - 1.2, zS = BASIN.z1 + 1.2;
    const piersAt = (z) => PIERS.filter((p) => (z < 0 ? p.z0 <= BASIN.z0 + 0.1 : p.z1 >= BASIN.z1 - 0.1));
    const gaps = (z) => { const segs = []; let x = BASIN.x0 - 2; for (const p of piersAt(z).sort((a, b) => a.x0 - b.x0)) { if (p.x0 > x) segs.push([x, p.x0]); x = Math.max(x, p.x1); } segs.push([x, 213]); return segs; };
    for (const [a, b] of gaps(BASIN.z0)) crowdRow(a, zN, b, zN, 1.25, 3, -1.15, 0, -1, 0.8);
    for (const [a, b] of gaps(BASIN.z1)) crowdRow(a, zS, b, zS, 1.4, 2, 1.15, 0, 1, 0.7);
    crowdRow(BASIN.x0 - 1.2, -28, BASIN.x0 - 1.2, 28, 1.3, 2, -1.1, -1, 0, 0.75);
    for (const p of PIERS) { if (p.id === 'rash') continue; // pier edges facing the water
      if (p.w.includes('w')) crowdRow(p.x0 + 0.9, p.z0 + 1, p.x0 + 0.9, p.z1 - 1, 1.3, 1, 0, 1, 0, 0.7);
      if (p.w.includes('e')) crowdRow(p.x1 - 0.9, p.z0 + 1, p.x1 - 0.9, p.z1 - 1, 1.3, 1, 0, -1, 0, 0.7);
      if (p.w.includes('s') && p.z1 < 0) crowdRow(p.x0 + 1, p.z1 - 0.9, p.x1 - 1, p.z1 - 0.9, 1.3, 1, 0, 0, -1, 0.75); }
    // 2) the streets: sidewalk crowds round every generic block (thinner away from the water)
    for (const b of GEN) { const nearW = Math.abs(b.z0) < 50 && Math.abs(b.z1) < 75, d = nearW ? 0.55 : 0.32, g = 1.6;
      crowdRow(b.x0 + 1, b.z0 + 1.1, b.x1 - 1, b.z0 + 1.1, g, 1, 0, 0, 1, d, CURB); crowdRow(b.x0 + 1, b.z1 - 1.1, b.x1 - 1, b.z1 - 1.1, g, 1, 0, 0, -1, d, CURB);
      crowdRow(b.x0 + 1.1, b.z0 + 2, b.x0 + 1.1, b.z1 - 2, g, 1, 0, 1, 0, d * 0.8, CURB); crowdRow(b.x1 - 1.1, b.z0 + 2, b.x1 - 1.1, b.z1 - 2, g, 1, 0, -1, 0, d * 0.8, CURB); }
    // 3) rooftops + 4) lit windows with waving silhouettes + 5) stoops: from the generic buildings' collision boxes
    for (const b of BLD) {
      if (!isGenB(b) || b.x1 - b.x0 < 4 || b.z1 - b.z0 < 4) continue; const fl = Math.round((b.h - GF - PAR) / FH);
      if (b.x0 < -136 || b.x1 > 214 || b.z0 < -106 || b.z1 > 106) continue; // the far skyline wall
      // roof crowd: along the parapet edges, a knot in the middle
      const y = b.h - 0.6, m = 0.9, rd = 0.5;
      crowdRow(b.x0 + m, b.z0 + m, b.x1 - m, b.z0 + m, 1.3, 1, 0, 0, 1, rd, y); crowdRow(b.x0 + m, b.z1 - m, b.x1 - m, b.z1 - m, 1.3, 1, 0, 0, -1, rd, y);
      crowdRow(b.x0 + m, b.z0 + 2, b.x0 + m, b.z1 - 2, 1.3, 1, 0, 1, 0, rd * 0.8, y); crowdRow(b.x1 - m, b.z0 + 2, b.x1 - m, b.z1 - 2, 1.3, 1, 0, -1, 0, rd * 0.8, y);
      for (let k = 0; k < 4; k++) if (R() < 0.6) person(lerp(b.x0 + 2, b.x1 - 2, R()), lerp(b.z0 + 2, b.z1 - 2, R()), y, 1);
      // windows: the facade bays (03_city building(): bays of ~3.6 m, floors of FH from GF), ~38 % lit with someone at the glass
      const faces = [['s', b.x0, b.z1, b.x1, b.z1, 0], ['n', b.x1, b.z0, b.x0, b.z0, Math.PI], ['e', b.x1, b.z1, b.x1, b.z0, Math.PI / 2], ['w', b.x0, b.z0, b.x0, b.z1, -Math.PI / 2]];
      for (const [k, xa, za, xb, zb, ry] of faces) { const L = Math.hypot(xb - xa, zb - za), nb = Math.max(1, Math.round(L / 3.6)), bw = L / nb, ux = (xb - xa) / L, uz = (zb - za) / L, nx = -uz, nz = ux; // outward normal
        for (let i = 0; i < nb; i++) for (let f = 0; f < fl; f++) { if (R() > 0.38) continue; const c = (i + 0.5) * bw;
          W.push({ x: xa + ux * c + nx * 0.09, z: za + uz * c + nz * 0.09, y: GF + f * FH + FH * 0.5, ry, w: Math.min(1.9, bw * 0.55), h: 2.0, ph: R() * 100, hue: R() < 0.6 ? 0 : R() < 0.6 ? 1 : 2, n: R() < 0.35 ? 2 : 1, st: R() < 0.3 ? 1 : 0 }); }
        // stoops: low rowhouses (Fells Point, the south shore) get white marble steps + a sitter every ~4.4 m on each face
        const fells = b.x0 >= 138 && b.z1 < 0, southRow = b.z0 > 0 && fl <= 3;
        if (fells || southRow) { const ns = Math.max(1, Math.floor(L / 4.4));
          for (let i = 0; i < ns; i++) { const c = (i + 0.5) * L / ns, sx = xa + ux * c + nx * 0.55, sz = za + uz * c + nz * 0.55;
            ST.push({ x: sx, z: sz, ry }); person(sx + nx * 0.15, sz + nz * 0.15, CURB + 0.48, 4);
            if (R() < 0.45) person(sx + nx * 1.3 + ux * 0.6, sz + nz * 1.3 + uz * 0.6, CURB, 4); } } }
    }
    // 6) landmark knots: Federal Hill's slope + summit, the Domino roof behind the sign, the Power Plant roof, the Aquarium plaza, the Monument square, Harborplace
    for (let i = 0; i < 150; i++) { const a = R() * TAU, r = Math.sqrt(R()) * 0.85, x = HILL.x + Math.cos(a) * HILL.rx * r, z = HILL.z + Math.sin(a) * HILL.rz * r; if (!maybeSign(x, z)) person(x, z, undefined, R() < 0.5 ? 1 : 0); }
    for (let i = 0; i < 46; i++) { const x = lerp(73, 91, R()), z = lerp(52.5, 64.5, R()); person(x, z, CURB + DOM_H, R() < 0.55 ? 1 : 0); }
    for (let i = 0; i < 26; i++) person(lerp(45.5, 51.5, R()), lerp(-26, -10.5, R()), CURB + 11.6, R() < 0.5 ? 1 : 0);
    for (let i = 0; i < 40; i++) { const x = lerp(7, 31, R()), z = lerp(-6.5, -4.5, R()); if (!maybeSign(x, z)) person(x, z); }
    for (let i = 0; i < 50; i++) { const a = R() * TAU, r = 5.5 + R() * 6, x = -20 + Math.cos(a) * r, z = -92 + Math.sin(a) * r; if (!maybeSign(x, z)) person(x, z, undefined, R() < 0.4 ? 1 : 0); }
    for (let i = 0; i < 40; i++) { const x = lerp(-59, -45, R()), z = lerp(-21, -20.2, R()) - (R() < 0.5 ? 0 : 9.5); person(x, z); }
    S.spots = P.length; S.winSpots = W.length; S.stoopSpots = ST.length;
    meshes();
  }

  // ---------------- the meshes ----------------
  let PM = null, WM = null, SM = null, TM = null, SKY = null;
  const fogU = () => THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
  const ROT = `mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,s, 0.0,-s,c); }
    mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c,s,0.0, -s,c,0.0, 0.0,0.0,1.0); }
    mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.0,-s, 0.0,1.0,0.0, s,0.0,c); }`;
  function toadGeo() { // toad townsfolk, ~1.25 m, facing +z. aPart.x: 0 skin, 1 left arm, 2 right arm, 3 eye white, 4 pupil, 5 pants, 6 shirt, 7 mouth
    const parts = [];
    const add = (g, part, m) => { g = g.index ? g.toNonIndexed() : g; if (m) g.applyMatrix4(m); parts.push([g, part]); };
    const M = (x, y, z, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.085, 0.1, 0.34, 6, 1), 5, M(s * 0.12, 0.17, 0));
    add(new THREE.SphereGeometry(1, 8, 6), 6, M(0, 0.56, 0, 0.29, 0.33, 0.24));
    add(new THREE.SphereGeometry(1, 9, 6), 0, M(0, 0.93, 0.02, 0.31, 0.2, 0.27));
    for (const s of [-1, 1]) { add(new THREE.SphereGeometry(0.085, 6, 5), 3, M(s * 0.13, 1.09, 0.1)); add(new THREE.SphereGeometry(0.045, 5, 4), 4, M(s * 0.13, 1.1, 0.175)); }
    add(new THREE.BoxGeometry(0.22, 0.025, 0.03), 7, M(0, 0.88, 0.27));
    for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(0.055, 0.06, 0.36, 5, 1); g.translate(0, -0.18, 0); add(g, s < 0 ? 1 : 2, M(s * 0.3, 0.74, 0));
      const h = new THREE.SphereGeometry(0.075, 5, 4); h.translate(0, -0.38, 0); add(h, s < 0 ? 1 : 2, M(s * 0.3, 0.74, 0)); }
    let n = 0; for (const [g] of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), prt = new Float32Array(n); let o = 0;
    for (const [g, part] of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); prt.fill(part, o, o + g.attributes.position.count); o += g.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(prt, 1));
    return g;
  }
  function peopleMat() {
    return new THREE.ShaderMaterial({ fog: true, uniforms: Object.assign(fogU(), U),
      vertexShader: `#include <common>
        #include <fog_pars_vertex>
        attribute float aPart; attribute vec4 aAnim; attribute vec3 aSkin; attribute vec3 aShirt;
        uniform float uT; uniform vec3 uCam; varying vec3 vCol; varying float vL; ${ROT}
        void main(){
          vec3 T = instanceMatrix[3].xyz; float s = length(instanceMatrix[0].xyz);
          float ph = aAnim.x, st = aAnim.y, d = distance(uCam.xz, T.xz), nr = 1.0 - smoothstep(16.0, 70.0, d), t = uT * aAnim.z + ph;
          vec3 p = position, n = normal; float part = aPart;
          float yOff = abs(sin(t * 4.0)) * 0.07 * (0.5 + nr), az = 0.18, ax = 0.0;
          bool armR = part > 1.5 && part < 2.5;
          if (st < 0.5) { az = armR ? 2.45 + 0.45 * sin(t * 9.0) : 0.25; }
          else if (st < 1.5) { yOff = abs(sin(t * 5.0)) * 0.42 * (0.35 + 0.65 * nr); az = 2.55 + 0.3 * sin(t * 10.0); }
          else if (st < 2.5) { ax = -1.25; az = -(0.08 + 0.38 * (0.5 + 0.5 * sin(t * 13.0))); yOff *= 1.5; }
          else if (st < 3.5) { az = 2.9; yOff = abs(sin(t * 3.0)) * 0.08; }
          else { float up = smoothstep(48.0, 24.0, d); yOff = -0.34 * (1.0 - up) + up * abs(sin(t * 4.5)) * 0.14;
            if (fract(ph * 0.37) > 0.5) { az = armR ? mix(0.35, 2.45 + 0.45 * sin(t * 9.0), up) : 0.25; }
            else { ax = mix(-0.7, -1.25, up); az = mix(0.1, -(0.08 + 0.38 * (0.5 + 0.5 * sin(t * 13.0))), up); } }
          if (part > 0.5 && part < 2.5) { float side = part < 1.5 ? -1.0 : 1.0; vec3 sh = vec3(side * 0.3, 0.74, 0.0); mat3 Rm = rotZ(side * az) * rotX(ax); p = sh + Rm * (p - sh); n = Rm * n; }
          p.y += yOff; p *= s;
          float yaw = atan(uCam.x - T.x, uCam.z - T.z); mat3 Ry = rotY(yaw);
          vec3 w = T + Ry * p; vec3 nw = normalize(Ry * n);
          vCol = part < 2.5 ? aSkin : part < 3.5 ? vec3(0.96) : part < 4.5 ? vec3(0.04) : part < 5.5 ? aShirt * 0.35 + vec3(0.05) : part < 6.5 ? aShirt : vec3(0.15, 0.05, 0.05);
          vec3 v = normalize(uCam - w); vL = 0.5 + 0.3 * max(dot(nw, normalize(vec3(0.3, 0.9, 0.4))), 0.0) + 0.35 * max(dot(nw, v), 0.0);
          vec4 mvPosition = viewMatrix * vec4(w, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <fog_pars_fragment>
        uniform vec3 uFlash; varying vec3 vCol; varying float vL;
        void main(){ gl_FragColor = vec4(vCol * vL + uFlash * 0.22, 1.0);
          #include <fog_fragment>
        }` });
  }
  function windowMat() {
    return new THREE.ShaderMaterial({ fog: true, uniforms: Object.assign(fogU(), U),
      vertexShader: `#include <common>
        #include <fog_pars_vertex>
        attribute vec4 aWin; varying vec2 vUv; varying vec4 vW;
        void main(){ vUv = uv; vW = aWin; vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <fog_pars_fragment>
        uniform float uT; uniform vec3 uFlash; varying vec2 vUv; varying vec4 vW;
        float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
        float person(vec2 uv, float cx, float t, float both){
          float bob = abs(sin(t * 5.0)) * 0.05; vec2 q = uv - vec2(cx, bob);
          float b = step(abs(q.x), 0.12 - q.y * 0.08) * step(q.y, 0.44) * step(0.0, q.y);
          vec2 h = (q - vec2(0.0, 0.55)) / vec2(0.16, 0.1); float hd = step(dot(h, h), 1.0);
          float e = step(length(q - vec2(-0.08, 0.64)), 0.045) + step(length(q - vec2(0.08, 0.64)), 0.045);
          float a1 = 0.35 + 0.55 * sin(t * 7.0); vec2 sh = vec2(0.1, 0.38); float arm = step(seg(q, sh, sh + 0.3 * vec2(sin(a1), cos(a1))), 0.04);
          float a2 = 0.35 + 0.55 * sin(t * 7.0 + 1.7); vec2 sl = vec2(-0.1, 0.38); float arm2 = both * step(seg(q, sl, sl + 0.3 * vec2(-sin(a2), cos(a2))), 0.04);
          return clamp(b + hd + e + arm + arm2, 0.0, 1.0); }
        void main(){
          vec2 uv = vUv; float hue = vW.y; float t = uT * 1.2 + vW.x;
          vec3 bg = hue < 0.5 ? vec3(1.0, 0.78, 0.42) : hue < 1.5 ? vec3(0.5, 0.72, 1.0) : vec3(1.0, 0.58, 0.74);
          bg *= 0.62 + 0.38 * uv.y; bg += vec3(0.25, 0.2, 0.1) * (1.0 - length(uv - vec2(0.5, 0.8)));
          if (hue > 0.5 && hue < 1.5) bg *= 0.85 + 0.15 * sin(uT * 23.0 + vW.x);
          float s = vW.z > 1.5 ? max(person(uv, 0.3, t, vW.w), person(uv, 0.7, t + 1.3, 1.0 - vW.w)) : person(uv, 0.5, t, vW.w);
          vec3 c = mix(bg, vec3(0.06, 0.03, 0.07), s);
          if (uv.x < 0.06 || uv.x > 0.94 || uv.y < 0.05 || uv.y > 0.95) c = vec3(0.14, 0.1, 0.08);
          gl_FragColor = vec4(c + uFlash * 0.12, 1.0);
          #include <fog_fragment>
        }` });
  }
  const SIGN_TXT = [['THANK YOU', 'HAROLD & MAVIS', '#ffffff', '#e83a3a'], ['HON!', '', '#ffd23c', '#4a2a8a'], ['CITY', 'SAVED', '#ffffff', '#ff7a1a'], ['WE LOVE YOU', 'HON', '#ff9ad0', '#1b1030']];
  function signMat() {
    const tx = canvasTex(512, 512, (g, w, h) => { g.clearRect(0, 0, w, h); const rh = h / 4;
      SIGN_TXT.forEach(([a, b, bgc, fg], i) => { const y = i * rh; g.fillStyle = '#000'; g.fillRect(6, y + 6, w - 12, rh - 12); g.fillStyle = bgc; g.fillRect(12, y + 12, w - 24, rh - 24);
        g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${b ? 40 : 70}px monospace`;
        if (b) { g.fillText(a, w / 2, y + rh * 0.36); g.fillText(b, w / 2, y + rh * 0.7); } else g.fillText(a, w / 2, y + rh * 0.54); }); }, 512);
    return new THREE.ShaderMaterial({ fog: true, transparent: false, side: THREE.DoubleSide, uniforms: Object.assign(fogU(), U, { uMap: { value: tx } }),
      vertexShader: `#include <common>
        #include <fog_pars_vertex>
        attribute vec4 aSign; uniform float uT; uniform vec3 uCam; varying vec2 vUv; ${ROT}
        void main(){ vec3 T = instanceMatrix[3].xyz; float s = length(instanceMatrix[0].xyz); float t = uT * aSign.z + aSign.x;
          vUv = vec2(uv.x, (uv.y + 3.0 - aSign.y) / 4.0);
          vec3 p = position * s; p.y += (1.62 + abs(sin(t * 3.0)) * 0.08) * s; p.x += sin(t * 2.0) * 0.05;
          float yaw = atan(uCam.x - T.x, uCam.z - T.z); vec3 w = T + rotY(yaw) * p;
          vec4 mvPosition = viewMatrix * vec4(w, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <fog_pars_fragment>
        uniform sampler2D uMap; uniform vec3 uFlash; varying vec2 vUv;
        void main(){ vec4 c = texture2D(uMap, vUv); if (c.a < 0.5) discard; gl_FragColor = vec4(c.rgb * 0.95 + uFlash * 0.15, 1.0);
          #include <fog_fragment>
        }` });
  }
  function stoopGeo() { // three white marble steps, ~1.3 m wide, stepping down 0.48 m away from the wall (+z)
    const parts = []; for (let i = 0; i < 3; i++) { const g = new THREE.BoxGeometry(1.3, 0.16 * (3 - i), 0.36); g.translate(0, 0.08 * (3 - i), -0.36 + i * 0.36); parts.push(g.toNonIndexed()); }
    let n = 0; for (const g of parts) n += g.attributes.position.count; const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return g;
  }
  function meshes() {
    const pg = toadGeo();
    const aAnim = new THREE.InstancedBufferAttribute(new Float32Array(CAP.people * 4), 4), aSkin = new THREE.InstancedBufferAttribute(new Float32Array(CAP.people * 3), 3), aShirt = new THREE.InstancedBufferAttribute(new Float32Array(CAP.people * 3), 3);
    for (const a of [aAnim, aSkin, aShirt]) a.setUsage(THREE.DynamicDrawUsage);
    pg.setAttribute('aAnim', aAnim); pg.setAttribute('aSkin', aSkin); pg.setAttribute('aShirt', aShirt);
    PM = new THREE.InstancedMesh(pg, peopleMat(), CAP.people); PM.frustumCulled = false; PM.count = 0; PM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); PM.name = 'crowd:people';
    const wg = new THREE.PlaneGeometry(1, 1); const aWin = new THREE.InstancedBufferAttribute(new Float32Array(CAP.windows * 4), 4); aWin.setUsage(THREE.DynamicDrawUsage); wg.setAttribute('aWin', aWin);
    WM = new THREE.InstancedMesh(wg, windowMat(), CAP.windows); WM.frustumCulled = false; WM.count = 0; WM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); WM.name = 'crowd:windows';
    const sg = new THREE.PlaneGeometry(1.5, 0.75); const aSign = new THREE.InstancedBufferAttribute(new Float32Array(CAP.signs * 4), 4); aSign.setUsage(THREE.DynamicDrawUsage); sg.setAttribute('aSign', aSign);
    SM = new THREE.InstancedMesh(sg, signMat(), CAP.signs); SM.frustumCulled = false; SM.count = 0; SM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); SM.name = 'crowd:signs';
    TM = new THREE.InstancedMesh(stoopGeo(), new THREE.MeshBasicMaterial({ color: '#cfc9bd' }), CAP.stoops); TM.frustumCulled = false; TM.count = 0; TM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); TM.name = 'crowd:stoops';
    SKY = skySys(2400);
  }

  // ---------------- refill: nearest spots in front of the camera into the instance buffers ----------------
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _f = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
  let idx = null, dist = null;
  function nearest(list, cap, R0, cx, cz, fx, fz, out) {
    const n = list.length; if (!idx || idx.length < n) { idx = new Int32Array(Math.max(n, 4096)); dist = new Float32Array(idx.length); }
    let k = 0; const R2 = R0 * R0;
    for (let i = 0; i < n; i++) { const s = list[i], dx = s.x - cx, dz = s.z - cz, d2 = dx * dx + dz * dz; if (d2 > R2) continue;
      if (d2 > 400 && dx * fx + dz * fz < -0.25 * Math.sqrt(d2)) continue; // behind the camera (more than ~20 m away): culled
      idx[k] = i; dist[k] = d2; k++; }
    const order = Array.from(idx.subarray(0, k)); if (k > cap) { const D = dist; const m = new Map(); for (let j = 0; j < k; j++) m.set(idx[j], D[j]); order.sort((a, b) => m.get(a) - m.get(b)); order.length = cap; }
    out.length = 0; for (const i of order) out.push(list[i]); return out;
  }
  const selP = [], selW = [], selT = [];
  function refill(cam) {
    S.refills++; const cx = cam.position.x, cz = cam.position.z; cam.getWorldDirection(_f); const fl = Math.hypot(_f.x, _f.z) || 1, fx = _f.x / fl, fz = _f.z / fl;
    const reach = clamp(70 + (cam.position.y - 10) * 0.8, 70, 110);
    nearest(P, CAP.people, reach, cx, cz, fx, fz, selP); nearest(W, CAP.windows, reach * 0.9, cx, cz, fx, fz, selW); nearest(ST, CAP.stoops, 70, cx, cz, fx, fz, selT);
    const an = PM.geometry.attributes.aAnim.array, sk = PM.geometry.attributes.aSkin.array, sh = PM.geometry.attributes.aShirt.array, sa = SM.geometry.attributes.aSign.array;
    let ns = 0;
    selP.forEach((s, i) => { _m.makeScale(s.s, s.s, s.s); _m.setPosition(s.x, s.y, s.z); PM.setMatrixAt(i, _m);
      an[i * 4] = s.ph; an[i * 4 + 1] = s.st; an[i * 4 + 2] = 0.85 + (s.ph % 1) * 0.35; an[i * 4 + 3] = 0; sk.set(s.sk, i * 3); sh.set(s.sh, i * 3);
      if (s.st === 3 && ns < CAP.signs) { SM.setMatrixAt(ns, _m); sa[ns * 4] = s.ph; sa[ns * 4 + 1] = s.sign; sa[ns * 4 + 2] = 0.85 + (s.ph % 1) * 0.35; ns++; } });
    PM.count = selP.length; PM.instanceMatrix.needsUpdate = true; for (const k of ['aAnim', 'aSkin', 'aShirt']) PM.geometry.attributes[k].needsUpdate = true;
    SM.count = ns; SM.instanceMatrix.needsUpdate = true; SM.geometry.attributes.aSign.needsUpdate = true;
    const aw = WM.geometry.attributes.aWin.array;
    selW.forEach((s, i) => { _q.setFromAxisAngle(_Y, s.ry); _m.compose(_p.set(s.x, s.y, s.z), _q, _s.set(s.w, s.h, 1)); WM.setMatrixAt(i, _m); aw[i * 4] = s.ph; aw[i * 4 + 1] = s.hue; aw[i * 4 + 2] = s.n; aw[i * 4 + 3] = s.st; });
    WM.count = selW.length; WM.instanceMatrix.needsUpdate = true; WM.geometry.attributes.aWin.needsUpdate = true;
    selT.forEach((s, i) => { _q.setFromAxisAngle(_Y, s.ry); _m.compose(_p.set(s.x, CURB, s.z), _q, _s.set(1, 1, 1)); TM.setMatrixAt(i, _m); });
    TM.count = selT.length; TM.instanceMatrix.needsUpdate = true;
    S.people = PM.count; S.windows = WM.count; S.signs = SM.count; S.stoops = TM.count;
    // loudness: how many people are close (drives the cheer bed)
    let L = 0; for (let i = 0; i < Math.min(selP.length, 220); i++) { const s = selP[i], d = Math.hypot(s.x - cx, s.y - cam.position.y, s.z - cz); L += 1 / (1 + d / 10); }
    S.loudT = clamp(L / 26, 0, 1);
  }

  // ---------------- the sky: city fireworks over the harbor + confetti puffs (one additive Points system) ----------------
  function skySys(cap) {
    const Pp = new Float32Array(cap * 3), C = new Float32Array(cap * 4), Z = new Float32Array(cap), st = new Float32Array(cap * 9); let n = 0; // st: vel 3, age, life, size, drag, grav, flags
    const g = new THREE.BufferGeometry(); const aP = new THREE.BufferAttribute(Pp, 3).setUsage(THREE.DynamicDrawUsage), aC = new THREE.BufferAttribute(C, 4).setUsage(THREE.DynamicDrawUsage), aZ = new THREE.BufferAttribute(Z, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', aP); g.setAttribute('pcol', aC); g.setAttribute('psize', aZ); g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 300 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 pcol; attribute float psize; uniform float uScale; varying vec4 vC; void main(){ vC = pcol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(psize * uScale / max(0.5, -mv.z), 1.0, 120.0); }`,
      fragmentShader: `varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0) discard; gl_FragColor = vec4(vC.rgb, vC.a * (1.0 - r) * (1.0 - r)); }` });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 6; pts.name = 'crowd:sky';
    const cols = []; const shells = [];
    function emit(x, y, z, vx, vy, vz, life, size, c, drag, grav, flags) { if (n >= cap) return; const i = n++, o = i * 9; Pp[i * 3] = x; Pp[i * 3 + 1] = y; Pp[i * 3 + 2] = z;
      st[o] = vx; st[o + 1] = vy; st[o + 2] = vz; st[o + 3] = 0; st[o + 4] = life; st[o + 5] = size; st[o + 6] = drag; st[o + 7] = grav; st[o + 8] = flags; cols[i] = c; }
    function step(dt, t) {
      for (let i = 0; i < n; i++) { const o = i * 9; st[o + 3] += dt;
        if (st[o + 3] >= st[o + 4]) { n--; if (i !== n) { Pp.copyWithin(i * 3, n * 3, n * 3 + 3); st.copyWithin(o, n * 9, n * 9 + 9); cols[i] = cols[n]; } i--; continue; }
        const dr = Math.exp(-st[o + 6] * dt); st[o] *= dr; st[o + 1] = st[o + 1] * dr - st[o + 7] * dt; st[o + 2] *= dr;
        const f = st[o + 8]; if (f & 1) { st[o] += Math.sin(t * 6 + i) * dt * 2; st[o + 2] += Math.cos(t * 5 + i * 1.3) * dt * 2; } // confetti flutter
        Pp[i * 3] += st[o] * dt; Pp[i * 3 + 1] += st[o + 1] * dt; Pp[i * 3 + 2] += st[o + 2] * dt;
        const u = st[o + 3] / st[o + 4], c = cols[i]; let a = u < 0.08 ? 1 : Math.pow(1 - u, 1.3); if (f & 1) a *= 0.55 + 0.45 * Math.sin(t * 17 + i * 2.1);
        const hot = f & 1 ? 0 : Math.max(0, 1 - u * 5); C[i * 4] = Math.min(1, c[0] + hot * 0.6); C[i * 4 + 1] = Math.min(1, c[1] + hot * 0.6); C[i * 4 + 2] = Math.min(1, c[2] + hot * 0.6); C[i * 4 + 3] = a;
        Z[i] = st[o + 5] * (f & 1 ? 1 : 0.55 + 0.45 * (1 - u)); }
      g.setDrawRange(0, n); aP.needsUpdate = aC.needsUpdate = aZ.needsUpdate = true;
      for (let k = shells.length - 1; k >= 0; k--) { const s = shells[k]; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vy -= 9 * dt;
        if (Math.random() < dt * 50) emit(s.x, s.y, s.z, rnd(-0.4, 0.4), rnd(-1.5, -0.4), rnd(-0.4, 0.4), 0.5, 0.6, GOLD, 0.6, 2, 0);
        if (s.t >= s.fuse) { shells.splice(k, 1); burst(s); } }
    }
    return { pts, mat, emit, step, shells, clear() { n = 0; shells.length = 0; g.setDrawRange(0, 0); }, get n() { return n; } };
  }
  const GOLD = hex('#ffcf7a'), PAL = [['#ff3d3d', '#ffd23c'], ['#3d8bff', '#ffffff'], ['#6bff7a', '#ffd23c'], ['#ff6be8', '#9adfff'], ['#ffd23c'], ['#ff8a3d', '#ffffff'], ['#b46bff', '#6bffd8'], ['#ff3d3d', '#ffffff', '#3d6dff']].map((a) => a.map(hex));
  const CONF = ['#ff3d3d', '#ffd23c', '#3d8bff', '#6bff7a', '#ff6be8', '#ffffff', '#ff8a3d'].map(hex);
  const FLASH = { k: 0, c: [1, 1, 1] };
  function launch(cam) { // from the water ahead of the camera (the harbor basin), apex 30-60 m
    cam.getWorldDirection(_f); let x = cam.position.x + _f.x * rnd(40, 90) + rnd(-30, 30), z = cam.position.z + _f.z * rnd(40, 90) + rnd(-20, 20);
    x = clamp(x, BASIN.x0 + 6, 205); z = clamp(z, BASIN.z0 + 5, BASIN.z1 - 5);
    const apex = rnd(30, 58), vy = Math.sqrt(2 * 9 * apex); SKY.shells.push({ x, y: 0, z, vx: rnd(-1.5, 1.5), vy, vz: rnd(-1, 1), t: 0, fuse: vy / 9 * rnd(0.92, 1), kind: pick(['peony', 'peony', 'ring', 'willow', 'crackle']), cols: pick(PAL) });
  }
  function burst(s) {
    S.bursts++; const n = s.kind === 'ring' ? 80 : s.kind === 'willow' ? 100 : 130, sp = s.kind === 'willow' ? 11 : 17;
    for (let i = 0; i < n; i++) { const c = s.cols[i % s.cols.length]; let vx, vy, vz;
      if (s.kind === 'ring') { const a = i / n * TAU; vx = Math.cos(a) * sp; vy = Math.sin(a) * sp * 0.4; vz = Math.sin(a) * sp; }
      else { const u = Math.random() * 2 - 1, a = Math.random() * TAU, r = Math.sqrt(1 - u * u), k = sp * rnd(0.85, 1.05); vx = r * Math.cos(a) * k; vy = u * k; vz = r * Math.sin(a) * k; }
      if (s.kind === 'willow') SKY.emit(s.x, s.y, s.z, vx, vy, vz, rnd(2.6, 3.4), 2.2, GOLD, 1.1, 3.2, 0);
      else SKY.emit(s.x, s.y, s.z, vx, vy, vz, rnd(1.4, 2.0), 2.6, c, 1.6, 2.4, 0); }
    SKY.emit(s.x, s.y, s.z, 0, 0, 0, 0.2, 14, [1, 1, 1], 0, 0, 0);
    FLASH.k = Math.min(1.4, FLASH.k + 0.8); FLASH.c = s.cols[0];
    boom(s); S.cheerBoost = 1; // the crowd roars at every burst
  }
  function confetti(cam) { // a puff over one of the nearest visible crowds
    if (!selP.length) return; const s = selP[(Math.random() * Math.min(selP.length, 60)) | 0];
    for (let i = 0; i < 26; i++) SKY.emit(s.x + rnd(-1, 1), s.y + 2.2 * s.s + rnd(0, 0.6), s.z + rnd(-1, 1), rnd(-2.5, 2.5), rnd(3, 6.5), rnd(-2.5, 2.5), rnd(1.6, 2.4), 0.28, pick(CONF), 2.2, 3.5, 1);
    S.confetti++;
  }

  // ---------------- audio: the crowd bed + woo voices + claps + distant booms ----------------
  const A = { bed: null, g: null, g2: null, lfo: null, nextWoo: 0, nextClap: 0 };
  const AOK = () => typeof AC !== 'undefined' && AC && AC.state === 'running' && !AUTO;
  function audioOn() {
    if (!AOK() || A.bed || !NOISE) return;
    try { const out = SFXBUS || AC.destination, mk = (f, q) => { const b = AC.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; return b; };
      const src = AC.createBufferSource(); src.buffer = NOISE; src.loop = true; const f1 = mk(620, 0.7), f2 = mk(1900, 1.4); A.g = AC.createGain(); A.g.gain.value = 0.0001; A.g2 = AC.createGain(); A.g2.gain.value = 0.0001;
      src.connect(f1); f1.connect(A.g); A.g.connect(out); src.connect(f2); f2.connect(A.g2); A.g2.connect(out);
      A.lfo = AC.createOscillator(); A.lfo.frequency.value = 0.7; const lg = AC.createGain(); lg.gain.value = 0.25; A.lfo.connect(lg); lg.connect(f1.frequency); A.lfo.start(); src.start(); A.bed = src; } catch (e) { A.bed = null; }
  }
  function audioOff() { if (!A.bed) return; try { const t = AC.currentTime; A.g.gain.setTargetAtTime(0.0001, t, 0.2); A.g2.gain.setTargetAtTime(0.0001, t, 0.2); const b = A.bed, l = A.lfo; setTimeout(() => { try { b.stop(); l.stop(); } catch (e) {} }, 900); } catch (e) {} A.bed = null; }
  function woo(k) { const t = AC.currentTime, out = SFXBUS || AC.destination, o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(), f0 = rnd(260, 420) * (Math.random() < 0.4 ? 1.6 : 1);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * rnd(1.5, 1.9), t + 0.22); o.frequency.exponentialRampToValueAtTime(f0 * 1.2, t + 0.6);
    f.type = 'bandpass'; f.frequency.value = rnd(800, 1200); f.Q.value = 3; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03 * k, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.7); }
  function claps(k) { const out = SFXBUS || AC.destination; for (let i = 0; i < 8; i++) { const t = AC.currentTime + Math.random() * 0.6, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = NOISE; f.type = 'highpass'; f.frequency.value = 1400; g.gain.setValueAtTime(0.05 * k, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.3); s.stop(t + 0.06); } }
  function boom(s) { if (!AOK() || !NOISE || !CAMR) return; const d = Math.hypot(s.x - CAMR.position.x, s.y - CAMR.position.y, s.z - CAMR.position.z), t = AC.currentTime + Math.min(0.4, d / 340), out = SFXBUS || AC.destination, k = clamp(60 / d, 0.25, 1);
    const o = AC.createOscillator(), og = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(36, t + 0.5);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.45 * k, t + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.75);
    const n = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); n.buffer = NOISE; f.type = 'bandpass'; f.frequency.value = rnd(900, 1700); f.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * k, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.4); }

  // ---------------- lifecycle ----------------
  let CAMR = null, refT = 0, fwT = 0, cfT = 0;
  function on(cam, opt = {}) {
    if (S.on) return; build(); S.on = true; S.t = 0; CAMR = cam || camera; refT = 0; fwT = 0.4; cfT = 0.8; S.fireworks = opt.fireworks !== false; S.loud = 0; S.cheerBoost = 0;
    scene.add(PM, WM, SM, TM, SKY.pts); SKY.clear(); refill(CAMR);
    if (S.fireworks) for (let i = 0; i < 3; i++) launch(CAMR);
    audioOn();
  }
  function off() { if (!S.on) return; S.on = false; scene.remove(PM, WM, SM, TM, SKY.pts); SKY.clear(); PM.count = WM.count = SM.count = TM.count = 0; S.people = S.windows = S.signs = S.stoops = 0; FLASH.k = 0; U.uFlash.value.set(0, 0, 0); audioOff(); }
  function frame(rdt, cam) {
    if (!S.on) return; CAMR = cam || camera; S.t += rdt; U.uT.value += rdt; U.uCam.value.copy(CAMR.position);
    refT -= rdt; if (refT <= 0) { refT = 0.3; refill(CAMR); }
    if (S.fireworks) { fwT -= rdt; if (fwT <= 0) { fwT = rnd(0.5, 1.3); launch(CAMR); if (Math.random() < 0.3) launch(CAMR); } }
    cfT -= rdt; if (cfT <= 0) { cfT = rnd(0.35, 0.8); confetti(CAMR); }
    SKY.mat.uniforms.uScale.value = LOW.h * 1.15; SKY.step(rdt, S.t);
    FLASH.k = Math.max(0, FLASH.k - rdt * 2.4); U.uFlash.value.set(FLASH.c[0], FLASH.c[1], FLASH.c[2]).multiplyScalar(FLASH.k);
    S.cheerBoost = Math.max(0, (S.cheerBoost || 0) - rdt * 0.8); S.loud = damp(S.loud, clamp((S.loudT || 0) + S.cheerBoost * 0.25, 0, 1), 2.5, rdt);
    if (A.bed) { const t = AC.currentTime; A.g.gain.setTargetAtTime(0.0001 + S.loud * 0.22, t, 0.25); A.g2.gain.setTargetAtTime(0.0001 + S.loud * 0.07, t, 0.25);
      if (S.t > A.nextWoo && S.loud > 0.18) { A.nextWoo = S.t + rnd(0.25, 1.1) / (0.4 + S.loud); woo(S.loud); }
      if (S.t > A.nextClap && S.loud > 0.3) { A.nextClap = S.t + rnd(0.7, 1.6); claps(S.loud); } }
    else if (S.t > 0.5 && AOK() && S.t % 1 < rdt) audioOn();
  }
  window.__crowd = { S, on, off, frame, refill: () => S.on && refill(CAMR || camera), stats: () => ({ on: S.on, people: S.people, windows: S.windows, signs: S.signs, stoops: S.stoops, bursts: S.bursts, confetti: S.confetti,
    loud: +S.loud.toFixed(2), spots: S.spots, winSpots: S.winSpots, stoopSpots: S.stoopSpots, refills: S.refills, inScene: !!(PM && PM.parent) }), get meshes() { return { PM, WM, SM, TM, SKY }; } };
})();
