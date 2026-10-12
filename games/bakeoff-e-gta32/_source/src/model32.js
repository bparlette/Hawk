  // =====================================================================================================
  // ---------- MODELS 32 (prototype E): PS1 / Saturn-era low-poly characters, built in code, rigged + animated in code ----------
  // Segmented rigid-limb rigs (the 32-bit way): ~600 tris each, tiny hand-painted canvas textures with nearest filtering,
  // flat-shaded Lambert lit by the city's own lights, plus a mild PS1 vertex snap (384x224 grid) and affine texture warp.
  // =====================================================================================================
  const M32 = { snap: new THREE.Vector2(192, 112), heroes: null, thugs: new Map(), pool: [], tris: {} };
  function px32(w, h, draw) { // crisp low-res texture: nearest filter, no mips
    const t = canvasTex(w, h, draw); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.anisotropy = 1; return t;
  }
  const P32_FS_OUT = "#include <opaque_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.97, 0.9), uFlash);";
  function ps1Mat(map, o = {}) {
    const m = new THREE.MeshLambertMaterial({ map, flatShading: true, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: o.glow === undefined ? 0.24 : o.glow, side: o.side || THREE.FrontSide, alphaTest: o.alphaTest || 0 });
    const U = (m.userData.u = { uSnap: { value: M32.snap }, uFlash: { value: 0 } });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSnap = U.uSnap; sh.uniforms.uFlash = U.uFlash;
      sh.vertexShader = "uniform vec2 uSnap;\nvarying float vAffW;\n" + sh.vertexShader.replace("#include <project_vertex>",
        "#include <project_vertex>\n  { vec4 sp = gl_Position; sp.xy = floor(sp.xy / sp.w * uSnap + 0.5) / uSnap * sp.w; gl_Position = sp; }\n#ifdef USE_MAP\n  vMapUv *= gl_Position.w;\n#endif\n  vAffW = gl_Position.w;");
      sh.fragmentShader = "uniform float uFlash;\nvarying float vAffW;\n" + sh.fragmentShader
        .replace("#include <map_fragment>", "#ifdef USE_MAP\n  vec4 sampledDiffuseColor = texture2D( map, vMapUv / vAffW );\n  diffuseColor *= sampledDiffuseColor;\n#endif")
        .replace("#include <emissivemap_fragment>", "#ifdef USE_EMISSIVEMAP\n  totalEmissiveRadiance *= texture2D( emissiveMap, vMapUv / vAffW ).rgb;\n#endif")
        .replace("#include <opaque_fragment>", P32_FS_OUT);
    };
    m.customProgramCacheKey = () => "ps1v1" + (o.alphaTest ? "a" : "");
    return m;
  }
  // ---- tiny palette painter: a seeded ordered dither so every texture has the same crisp 32-bit grain ----
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function ditherFill(g, x0, y0, w, h, cA, cB, amt) { // cA base, cB shade, amt 0..1 how much of cB
    const A = hexRGB(cA), B0 = hexRGB(cB), B = A.map((v, i) => Math.round(v + (B0[i] - v) * 0.55));
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const b = BAYER[(y & 3) * 4 + (x & 3)] / 16, c = b < amt ? B : A; g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.fillRect(x, y, 1, 1);
    }
  }
  const pxr = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  // ---- geometry helpers (limbs hang from their joint: top at 0, extending down -y). Cylinders/spheres face +z at u = 0.5 ----
  function cylG(rt, rb, h, seg, open) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!open, Math.PI); g.translate(0, -h / 2, 0); return g; }
  function boxG(w, h, d, oy = 0, oz = 0) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, oy, oz); return g; }
  function sphG(r, ws, hs) { return new THREE.SphereGeometry(r, ws, hs, -Math.PI / 2); }
  function bladeG(len, w, th) { // tapered blade with a point, along +z from the guard
    const g = new THREE.BoxGeometry(w, th, len, 1, 1, 2); g.translate(0, 0, len / 2);
    const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const z = P.getZ(i); if (z > len * 0.99) { P.setX(i, P.getX(i) * 0.08); } else if (z > len * 0.4) P.setX(i, P.getX(i) * 0.85); }
    P.needsUpdate = true; g.computeVertexNormals(); return g;
  }
  const triCount = (o) => { let n = 0; o.traverse((c) => { if (c.isMesh && c.geometry) n += (c.geometry.index ? c.geometry.index.count : c.geometry.attributes.position.count) / 3; }); return Math.round(n); };
  // ---------- textures ----------
  const TX32 = {};
  function heroTex() {
    if (TX32.hero) return TX32.hero;
    const T = {};
    T.skin = px32(16, 16, (g) => { ditherFill(g, 0, 0, 16, 16, "#3f9a3a", "#2f7a2e", 0.3); pxr(g, "#58b84a", 3, 2, 2, 1); pxr(g, "#58b84a", 10, 9, 2, 1); });
    T.head = px32(32, 16, (g) => { // sphere: u = 0.5 is the face; the mask band covers the eye line
      ditherFill(g, 0, 0, 32, 16, "#43a03c", "#2f7a2e", 0.28); ditherFill(g, 0, 12, 32, 4, "#3a8c34", "#2a6a28", 0.5);
      pxr(g, "#1c3a18", 12, 11, 8, 1); pxr(g, "#1c3a18", 19, 10, 1, 1); pxr(g, "#1c3a18", 12, 10, 1, 1); // a cocky grin
      pxr(g, "#f4f0e0", 14, 12, 3, 1); pxr(g, "#5ec850", 13, 3, 6, 1);
    });
    T.mask = px32(32, 8, (g) => { // bandana band: u = 0.5 front. Eyes: white with dark pupils, angled brow
      ditherFill(g, 0, 0, 32, 8, "#2f6bff", "#1f48c0", 0.25); pxr(g, "#173a9a", 0, 7, 32, 1); pxr(g, "#6a9aff", 0, 0, 32, 1);
      for (const ex of [11, 18]) { pxr(g, "#0c1430", ex - 1, 2, 5, 4); pxr(g, "#fffaf0", ex, 3, 3, 2); pxr(g, "#101010", ex + (ex < 16 ? 2 : 0), 3, 1, 2); }
      pxr(g, "#0c1430", 10, 1, 4, 1); pxr(g, "#0c1430", 18, 1, 4, 1); // furrowed brows
      pxr(g, "#173a9a", 2, 1, 1, 6); pxr(g, "#173a9a", 29, 1, 1, 6); // the knot at the back (u = 0 / 1)
    });
    T.tail = px32(8, 16, (g) => { ditherFill(g, 0, 0, 8, 16, "#2f6bff", "#1f48c0", 0.3); pxr(g, "#173a9a", 0, 15, 8, 1); pxr(g, "#6a9aff", 1, 0, 2, 16); });
    T.plas = px32(32, 16, (g) => { // torso: plastron across the front half (u 0.25..0.75)
      ditherFill(g, 0, 0, 32, 16, "#3f9a3a", "#2f7a2e", 0.3);
      ditherFill(g, 9, 0, 14, 16, "#e8c860", "#c8a040", 0.22); pxr(g, "#8a6420", 9, 0, 1, 16); pxr(g, "#8a6420", 22, 0, 1, 16);
      for (const y of [4, 8, 12]) pxr(g, "#9a7428", 10, y, 12, 1); pxr(g, "#9a7428", 16, 0, 1, 16); pxr(g, "#fff0a0", 11, 1, 3, 1);
    });
    T.shell = px32(32, 32, (g) => { // dome, pole (top of the texture) = the middle of the back; the equator = the rim
      ditherFill(g, 0, 0, 32, 32, "#3a5a26", "#2a421c", 0.3);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const x = c * 8 + (r % 2 ? 4 : 0), y = r * 5; g.strokeStyle = "#1a2a10"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, 7, 4); pxr(g, "#5a7a36", x + 2, y + 1, 3, 1); }
      ditherFill(g, 0, 14, 32, 3, "#c8a050", "#a07a30", 0.3); pxr(g, "#6a4a18", 0, 17, 32, 1); for (let x = 2; x < 32; x += 4) pxr(g, "#6a4a18", x, 14, 1, 3);
      ditherFill(g, 0, 18, 32, 14, "#3f9a3a", "#2f7a2e", 0.3);
    });
    T.belt = px32(32, 8, (g) => { ditherFill(g, 0, 0, 32, 8, "#7a4a24", "#5a3418", 0.3); pxr(g, "#3a2410", 0, 0, 32, 1); pxr(g, "#3a2410", 0, 7, 32, 1);
      pxr(g, "#c8a040", 13, 1, 6, 6); pxr(g, "#fff0a0", 14, 2, 2, 1); pxr(g, "#7a5a18", 15, 3, 2, 2); }); // a plain round-ish brass buckle
    T.pad = px32(8, 8, (g) => { ditherFill(g, 0, 0, 8, 8, "#8a5a2c", "#6a4220", 0.3); pxr(g, "#b07a40", 1, 1, 3, 1); pxr(g, "#3a2410", 0, 7, 8, 1); });
    T.wrap = px32(8, 8, (g) => { ditherFill(g, 0, 0, 8, 8, "#d8c8a0", "#a89870", 0.3); for (let y = 1; y < 8; y += 3) pxr(g, "#8a7a58", 0, y, 8, 1); });
    T.blade = px32(4, 16, (g) => { for (let y = 0; y < 16; y++) { pxr(g, "#9aa4b8", 0, y, 4, 1); } pxr(g, "#eef4ff", 1, 0, 1, 16); pxr(g, "#5a6478", 3, 0, 1, 16); pxr(g, "#ffffff", 1, 2, 1, 3); });
    T.hilt = px32(8, 8, (g) => { ditherFill(g, 0, 0, 8, 8, "#1a1a2a", "#2a2a40", 0.3); for (let y = 0; y < 8; y += 2) pxr(g, "#2f6bff", (y / 2) % 2 ? 1 : 4, y, 3, 1); });
    T.guard = px32(4, 4, (g) => { ditherFill(g, 0, 0, 4, 4, "#c8a040", "#8a6a20", 0.3); });
    return (TX32.hero = T);
  }
  const THUG_COL = { purple: ["#6a3a9e", "#4a2672", "#9466c8"], blue: ["#2c4c94", "#1c3268", "#5a7ec8"], dasher: ["#8e2c2a", "#621c1a", "#c05248"] };
  function thugTex(kind) {
    const key = "thug_" + kind; if (TX32[key]) return TX32[key];
    const [c0, c1, c2] = THUG_COL[kind] || THUG_COL.purple, T = {};
    T.gi = px32(16, 16, (g) => { ditherFill(g, 0, 0, 16, 16, c0, c1, 0.3); pxr(g, c2, 2, 1, 1, 6); pxr(g, c1, 9, 4, 1, 9); });
    T.torso = px32(32, 16, (g) => { // crossed gi lapels at the front (u = 0.5), dark undershirt in the V
      ditherFill(g, 0, 0, 32, 16, c0, c1, 0.3);
      for (let y = 0; y < 12; y++) { pxr(g, "#141018", 16 - Math.max(1, 6 - (y >> 1)), y, Math.max(2, (6 - (y >> 1)) * 2), 1); }
      for (let y = 0; y < 13; y++) { pxr(g, c2, 10 + (y >> 1), y, 1, 1); pxr(g, c2, 21 - (y >> 1), y, 1, 1); }
      pxr(g, c1, 0, 15, 32, 1);
    });
    T.head = px32(32, 16, (g) => { // hood + face cloth, an eye slit with a sliver of skin, glinting eyes
      ditherFill(g, 0, 0, 32, 16, c1, "#100c16", 0.35); ditherFill(g, 9, 9, 14, 7, "#1a1622", "#0c0a10", 0.3);
      pxr(g, "#e0b088", 10, 6, 12, 3); pxr(g, "#9a7050", 10, 8, 12, 1);
      pxr(g, "#fff6c0", 12, 7, 2, 1); pxr(g, "#fff6c0", 18, 7, 2, 1); pxr(g, "#100c16", 11, 5, 4, 1); pxr(g, "#100c16", 17, 5, 4, 1);
      pxr(g, c2, 4, 2, 2, 1); pxr(g, c2, 26, 2, 2, 1);
    });
    T.sash = px32(32, 8, (g) => { ditherFill(g, 0, 0, 32, 8, "#1a1418", "#2a2028", 0.3); pxr(g, "#c8302a", 0, 3, 32, 2); pxr(g, "#7a1a18", 0, 5, 32, 1); });
    T.wrap = px32(8, 8, (g) => { ditherFill(g, 0, 0, 8, 8, "#2a2a32", "#1a1a20", 0.3); for (let y = 1; y < 8; y += 3) pxr(g, "#4a4a56", 0, y, 8, 1); });
    T.plate = px32(8, 8, (g) => { ditherFill(g, 0, 0, 8, 8, "#3a3a46", "#24242e", 0.3); pxr(g, "#7a7a8a", 1, 1, 5, 1); pxr(g, "#101014", 0, 7, 8, 1); });
    T.skin = px32(8, 8, (g) => { ditherFill(g, 0, 0, 8, 8, "#c89a74", "#a07a58", 0.3); });
    return (TX32[key] = T);
  }
  // ---------- rig ----------
  function mkPart(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
  function joint(parent, x, y, z, order) { const j = new THREE.Group(); j.position.set(x, y, z); if (order) j.rotation.order = order; parent.add(j); return j; }
  // spec: proportions + the materials for each piece; returns the joint handles the animator drives
  function buildRig(S) {
    const R = { root: new THREE.Group(), mats: [], blades: [] };
    const M = (t, o) => { const m = ps1Mat(t, o); R.mats.push(m); return m; };
    const mt = {}; for (const k in S.tex) mt[k] = M(S.tex[k], S.matOpt && S.matOpt[k]);
    R.body = joint(R.root, 0, 0, 0); // fall pivot at the feet
    R.hips = joint(R.body, 0, S.hipY, 0);
    mkPart(R.hips, boxG(S.pelvis[0], S.pelvis[1], S.pelvis[2]), mt.belt);
    R.torso = joint(R.hips, 0, S.pelvis[1] * 0.4, 0, "YXZ");
    const tg = new THREE.CylinderGeometry(S.chest[0], S.chest[1], S.chest[2], S.chestSeg || 8, 1, false, Math.PI); tg.translate(0, S.chest[2] / 2, 0); tg.scale(1, 1, S.chestDepth || 0.78);
    mkPart(R.torso, tg, mt.torso);
    R.neck = joint(R.torso, 0, S.chest[2], 0.01, "YXZ");
    R.head = joint(R.neck, 0, S.headR * 0.85, 0.01, "YXZ");
    const hg = sphG(S.headR, 8, 6); hg.scale(1, S.headSq || 0.95, 1.04); mkPart(R.head, hg, mt.head);
    if (S.extras) S.extras(R, mt, S);
    // arms
    R.sh = []; R.el = []; R.wr = [];
    for (const sd of [1, -1]) { // +1 = left (+x), -1 = right
      const sh = joint(R.torso, sd * S.shX, S.chest[2] - S.shDrop, 0, "YXZ");
      mkPart(sh, cylG(S.arm[0], S.arm[0] * 0.9, S.arm[1], 6), mt.limb);
      if (S.shoulder) S.shoulder(sh, mt, sd);
      const el = joint(sh, 0, -S.arm[1], 0, "XYZ");
      mkPart(el, cylG(S.arm[0] * 0.92, S.arm[0] * 0.85, S.arm[2], 6), mt.fore || mt.limb);
      if (S.elbow) S.elbow(el, mt, sd);
      const wr = joint(el, 0, -S.arm[2], 0, "XYZ");
      mkPart(wr, boxG(S.hand, S.hand * 1.05, S.hand * 1.1, -S.hand * 0.4), mt.hand || mt.limb);
      if (S.weapon) S.weapon(R, wr, mt, sd);
      R.sh.push(sh); R.el.push(el); R.wr.push(wr);
    }
    // legs
    R.hip = []; R.kn = []; R.ft = [];
    for (const sd of [1, -1]) {
      const hp = joint(R.hips, sd * S.legX, -S.pelvis[1] * 0.3, 0, "XZY");
      mkPart(hp, cylG(S.leg[0], S.leg[0] * 0.88, S.leg[1], 6), mt.limb);
      const kn = joint(hp, 0, -S.leg[1], 0, "XYZ");
      mkPart(kn, cylG(S.leg[0] * 0.86, S.leg[0] * 0.72, S.leg[2], 6), mt.shin || mt.limb);
      if (S.knee) S.knee(kn, mt, sd);
      const ft = joint(kn, 0, -S.leg[2], 0, "XYZ");
      mkPart(ft, boxG(S.foot[0], S.foot[1], S.foot[2], -S.foot[1] / 2 + 0.01, S.foot[2] * 0.25), mt.foot || mt.limb);
      R.hip.push(hp); R.kn.push(kn); R.ft.push(ft);
    }
    // blob shadow
    R.shadow = new THREE.Mesh(SHADOW_G, SHADOW_M); R.shadow.renderOrder = 1;
    R.root.traverse((o) => { if (o.isMesh) o.renderOrder = 2; });
    R.pose = newPose(); R.tris = triCount(R.root);
    return R;
  }
  function heroSpec() {
    const T = heroTex();
    return {
      tex: { belt: T.belt, torso: T.plas, head: T.head, limb: T.skin, mask: T.mask, tail: T.tail, shell: T.shell, pad: T.pad, wrap: T.wrap, blade: T.blade, hilt: T.hilt, guard: T.guard },
      matOpt: { tail: { side: THREE.DoubleSide }, blade: { glow: 0.55 } },
      hipY: 0.64, pelvis: [0.4, 0.15, 0.3], chest: [0.25, 0.21, 0.46], chestDepth: 0.8, headR: 0.2, headSq: 0.92,
      shX: 0.3, shDrop: 0.09, arm: [0.078, 0.23, 0.21], hand: 0.105, legX: 0.13, leg: [0.095, 0.27, 0.27], foot: [0.14, 0.09, 0.22],
      extras(R, mt) {
        const sg = sphG(1, 8, 6); sg.rotateX(-Math.PI / 2); sg.scale(0.3, 0.33, 0.2);
        R.shell = mkPart(R.torso, sg, mt.shell, 0, 0.25, -0.07);
        const bg = new THREE.CylinderGeometry(0.207, 0.207, 0.09, 8, 1, true, Math.PI);
        mkPart(R.head, bg, mt.mask, 0, 0.035, 0);
        R.tails = [];
        for (const sd of [1, -1]) { // two bandana tails off the knot, swung by the animator
          const tj = joint(R.head, sd * 0.04, 0.03, -0.2, "XYZ");
          const tq = new THREE.PlaneGeometry(0.07, 0.34); tq.translate(0, -0.17, 0);
          mkPart(tj, tq, mt.tail); R.tails.push(tj);
        }
      },
      shoulder(sh, mt) { },
      elbow(el, mt) { mkPart(el, boxG(0.12, 0.08, 0.13, -0.02), mt.pad); mkPart(el, cylG(0.08, 0.08, 0.07, 6, true).translate(0, -0.13, 0), mt.wrap); },
      knee(kn, mt) { mkPart(kn, boxG(0.13, 0.1, 0.12, 0.0, 0.035), mt.pad); },
      weapon(R, wr, mt, sd) { // a straight-bladed sword in each fist, blade along +z from the fist
        const sw = joint(wr, 0, -0.05, 0.0, "XYZ");
        mkPart(sw, boxG(0.032, 0.032, 0.17, 0, -0.03), mt.hilt);
        mkPart(sw, boxG(0.12, 0.03, 0.03, 0, 0.065), mt.guard);
        const bl = mkPart(sw, bladeG(0.66, 0.05, 0.016), mt.blade, 0, 0, 0.08);
        R.blades.push({ sw, bl, len: 0.74, side: sd });
      },
    };
  }
  function thugSpec(kind) {
    const T = thugTex(kind), big = kind === "purple" ? 1.03 : kind === "dasher" ? 0.97 : 1;
    return {
      tex: { belt: T.sash, torso: T.torso, head: T.head, limb: T.gi, fore: T.wrap, shin: T.wrap, foot: T.wrap, hand: T.wrap, plate: T.plate, skin: T.skin, tail: T.sash },
      matOpt: { tail: { side: THREE.DoubleSide, glow: 0.34 }, belt: { glow: 0.34 }, torso: { glow: 0.34 }, head: { glow: 0.36 }, limb: { glow: 0.34 }, fore: { glow: 0.3 }, plate: { glow: 0.34 } },
      hipY: 0.82 * big, pelvis: [0.38, 0.16, 0.27], chest: [0.29, 0.2, 0.5], chestDepth: 0.74, chestSeg: 6, headR: 0.16, headSq: 1.05,
      shX: 0.32, shDrop: 0.07, arm: [0.078, 0.27, 0.25], hand: 0.1, legX: 0.125, leg: [0.092, 0.36, 0.35], foot: [0.12, 0.08, 0.21],
      extras(R, mt) { // hood peak + the sash knot's two tails at the back
        const hk = new THREE.ConeGeometry(0.1, 0.12, 4); hk.rotateX(-0.9); mkPart(R.head, hk, mt.head, 0, 0.1, -0.08);
        R.tails = [];
        for (const sd of [1, -1]) { const tj = joint(R.hips, sd * 0.06, 0.0, -0.14, "XYZ"); const tq = new THREE.PlaneGeometry(0.07, 0.3); tq.translate(0, -0.15, 0); mkPart(tj, tq, mt.tail); R.tails.push(tj); }
      },
      shoulder(sh, mt, sd) { const g = boxG(0.15, 0.06, 0.16, 0.0); mkPart(sh, g, mt.plate).rotation.z = sd * 0.35; },
      elbow() {}, knee() {},
    };
  }
  // ---------- poses: joint targets, eased toward each frame (attacks snap harder) ----------
  function newPose() { return { by: 0, bx: 0, bz: 0, fall: 0, lean: 0, twist: 0, roll: 0, hx: 0, hy: 0, sL: [0, 0, 0], sR: [0, 0, 0], eL: 0, eR: 0, wL: 0, wR: 0, hL: [0, 0], hR: [0, 0], kL: 0, kR: 0, fL: 0, fR: 0, tail: 0 }; }
  const ease3 = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3), sstep = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  function blendPose(P, T, k) {
    for (const key in T) {
      const a = P[key], b = T[key];
      if (Array.isArray(b)) for (let i = 0; i < b.length; i++) a[i] += (b[i] - a[i]) * k;
      else P[key] = a + (b - a) * k;
    }
  }
  function applyRig(R, P) {
    R.body.rotation.x = P.fall; R.body.position.set(P.bx, P.by, P.bz); R.body.rotation.z = P.roll;
    R.torso.rotation.set(P.lean, P.twist, 0); R.head.rotation.set(P.hx, P.hy, 0);
    const S = [P.sL, P.sR], E = [P.eL, P.eR], Wr = [P.wL, P.wR], Hh = [P.hL, P.hR], K = [P.kL, P.kR], F = [P.fL, P.fR];
    for (let i = 0; i < 2; i++) {
      const sd = i === 0 ? 1 : -1;
      R.sh[i].rotation.set(S[i][0], S[i][1] * sd, S[i][2] * sd); // yaw / roll mirrored: + = outward for either arm
      R.el[i].rotation.set(E[i], 0, 0); R.wr[i].rotation.set(Wr[i], 0, 0);
      R.hip[i].rotation.set(Hh[i][0], 0, Hh[i][1] * sd); R.kn[i].rotation.set(K[i], 0, 0); R.ft[i].rotation.set(F[i], 0, 0);
    }
    if (R.tails) { R.tails[0].rotation.set(0.5 + P.tail, 0, 0.25); R.tails[1].rotation.set(0.4 + P.tail * 0.8, 0, -0.25); }
  }
  // legs: a run / walk cycle at phase ph (radians), amount a (0..1), s = stride
  function legsCycle(T, ph, a, s) {
    const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);
    T.hL = [-sL * s * a - 0.12 * a, 0.04]; T.hR = [-sR * s * a - 0.12 * a, 0.04];
    T.kL = (0.25 + Math.max(0, Math.cos(ph)) * 1.1) * a + 0.08; T.kR = (0.25 + Math.max(0, Math.cos(ph + Math.PI)) * 1.1) * a + 0.08;
    T.fL = -0.2 * sL * a; T.fR = -0.2 * sR * a;
    T.by = -Math.abs(Math.cos(ph)) * 0.035 * a;
  }
  function stance(T, low) { T.hL = [-0.32 - low, 0.12]; T.hR = [0.05 - low * 0.4, 0.14]; T.kL = 0.48 + low * 1.4; T.kR = 0.42 + low * 1.2; T.fL = -0.12; T.fR = 0.18; T.by = -0.04 - low * 0.18; }
  // the hero: guard (blades up in front), run (blades trailing), the 3-hit combo, jump spin, cyclone special, hurt, knockdown
  function heroTarget(p, R, t) {
    const T = newPose(); let k = 18, spin = 0, hop = 0;
    const guard = () => { T.sL = [-1.05, 0.05, 0.18]; T.eL = -0.65; T.wL = 0.85; T.sR = [-0.45, 0.4, 0.38]; T.eR = -1.65; T.wR = 0.3; };
    const br = Math.sin(t * 2.6);
    if (p.deadT > 0 || p.downT > 0) { // knocked flat on the shell; the last frames of downT stand back up
      const lie = p.deadT > 0 ? 1 : p.downT > 14 ? 1 : p.downT / 14, air = Math.min(1, (p.z || 0) / 20);
      T.fall = -1.45 * sstep(lie) * (1 - air * 0.4); T.by = 0.2 * sstep(lie) - 0.02; T.bz = -0.35 * sstep(lie);
      T.sL = [-0.4, 1.0, 1.2]; T.sR = [-0.6, 0.8, 1.1]; T.eL = -0.6; T.eR = -0.9; T.hL = [-0.9, 0.3]; T.hR = [-0.5, 0.25]; T.kL = 1.3; T.kR = 0.9; T.hx = 0.35;
      if (p.deadT > 0) { T.sL = [-0.2, 1.3, 1.4]; T.sR = [-0.1, 1.2, 1.4]; T.hx = 0.6; T.kL = 0.6; T.kR = 0.3; }
      else T.roll = Math.sin(t * 9) * 0.08 * lie; // rocking on the shell
      k = 12;
    } else if (p.hurtT > 0 || p.grabbedBy) {
      guard(); T.lean = -0.42; T.hx = -0.45; T.twist = 0.25; T.sL = [-0.2, 0.9, 0.9]; T.sR = [-0.3, 0.8, 0.8]; T.eL = -0.5; T.eR = -0.5; stance(T, 0.1); T.bz = -0.06; k = 30;
    } else if (p.atk === "power" && p.spec) { // CYCLONE SLASH: blades straight out, three spins in the air
      const el = p.atkDur - p.attackT, u = el / p.atkDur; spin = ease3(u) * Math.PI * 6;
      T.sL = [-0.15, 0, 1.45]; T.sR = [-0.15, 0, 1.45]; T.eL = 0; T.eR = 0; T.wL = 1.5; T.wR = 1.5; T.hL = [-0.7, 0.2]; T.hR = [-0.2, 0.3]; T.kL = 1.2; T.kR = 0.8; T.lean = 0.12; k = 40;
    } else if (p.atk === "jump") { // aerial spin slash
      const el = p.atkDur - p.attackT, u = el / p.atkDur; spin = ease3(u) * Math.PI * 2;
      T.sL = [-0.5, 0.2, 1.3]; T.sR = [-0.5, 0.2, 1.3]; T.eL = -0.2; T.eR = -0.2; T.wL = 1.4; T.wR = 1.4; T.hL = [-1.1, 0.2]; T.hR = [-0.8, 0.2]; T.kL = 1.6; T.kR = 1.4; T.lean = 0.3; k = 36;
    } else if (p.atk && p.atk[0] === "c") {
      const sp = swingPhase(p) || { ph: "rec", u: 1 }, ph = sp.ph, u = sp.u; guard(); stance(T, 0.08); k = 42;
      const W = ph === "wind" ? 0 : ph === "strike" ? ease3(u) : 1, back = ph === "rec" ? sstep(u) : 0;
      if (p.atk === "c1") { // right blade: wide horizontal cut, right to left
        T.sR = [-1.42, -1.55 + 2.75 * W, 0.15]; T.eR = -0.35 + 0.25 * W; T.wR = 1.35; T.twist = -0.5 + 1.05 * W; T.lean = 0.12 + 0.1 * W; T.hy = -T.twist * 0.6;
        T.hL = [-0.55, 0.12]; T.kL = 0.6; T.hR = [0.2, 0.18]; T.kR = 0.38;
      } else if (p.atk === "c2") { // left blade: rising backhand, low right to high left
        T.sL = [-0.25 - 2.25 * W, -0.75 + 1.75 * W, 0.2]; T.eL = -0.5 + 0.3 * W; T.wL = 1.3; T.twist = -0.45 + 1.0 * W; T.lean = 0.2 - 0.25 * W; T.hy = -T.twist * 0.5;
        T.sR = [-0.4, 0.4, 0.5]; T.eR = -1.4; T.hR = [-0.5, 0.12]; T.kR = 0.6; T.hL = [0.15, 0.16]; T.kL = 0.4;
      } else { // c3: both blades overhead, then a crossing X cut down with a little hop
        const up = ph === "wind" ? sstep(u) : 1;
        T.sL = [-2.7 * up + 2.25 * W, 0.6 - 1.25 * W, 0.15]; T.sR = [-2.7 * up + 2.25 * W, 0.6 - 1.25 * W, 0.15]; T.eL = -0.3; T.eR = -0.3; T.wL = 1.25; T.wR = 1.25;
        T.lean = -0.15 * up + 0.55 * W; T.hx = -0.2 * up + 0.25 * W; hop = ph === "strike" ? Math.sin(u * Math.PI) * 0.16 : 0; stance(T, 0.05 + 0.18 * W); T.by += hop;
      }
    } else if (p.z > 0 || p.vz > 0) { // jump: tuck going up, reach down coming down
      const up = p.vz > 0; guard(); T.sL = [-0.6, 0.6, 0.7]; T.sR = [-0.6, 0.6, 0.7]; T.eL = -0.9; T.eR = -0.9; T.wL = 0.6; T.wR = 0.6;
      T.hL = [up ? -1.2 : -0.6, 0.15]; T.hR = [up ? -0.4 : -0.2, 0.15]; T.kL = up ? 1.7 : 0.8; T.kR = up ? 1.1 : 0.5; T.lean = 0.25; k = 22;
    } else if (p.walkT > 0) { // run: lean in, blades swept back like a ninja sprint
      const sp = R.spd || 0, a = clamp(sp / 4.4, 0.35, 1), ph = R.phase;
      legsCycle(T, ph, a, 0.85);
      T.lean = 0.12 + 0.28 * a; T.hx = -0.12 * a;
      T.sL = [0.25 + 0.6 * a + Math.sin(ph) * 0.35 * (1 - a), 0.15, 0.25]; T.sR = [0.25 + 0.6 * a + Math.sin(ph + Math.PI) * 0.35 * (1 - a), 0.15, 0.25];
      T.eL = -0.55; T.eR = -0.55; T.wL = 1.2 * a; T.wR = 1.2 * a; T.twist = Math.sin(ph) * 0.18; T.tail = 0.9 * a + Math.sin(t * 14) * 0.15;
      k = 16;
    } else { guard(); stance(T, 0); T.lean = 0.1 + br * 0.015; T.by -= br * 0.008; T.hx = -0.05; T.tail = Math.sin(t * 1.7) * 0.12; k = 10; }
    return { T, k, spin };
  }
  // foot soldiers: fists-up guard, walk, punch / kick / dash, hurt, knockdown, get-up
  function thugTarget(e, R, t) {
    const T = newPose(); let k = 16;
    const guard = () => { T.sL = [-0.8, -0.3, 0.12]; T.eL = -1.75; T.sR = [-0.55, -0.15, 0.18]; T.eR = -2.0; T.wL = 0.3; T.wR = 0.3; };
    const st = e.state, A = e.a32 || {};
    if (st === "down" || st === "dying" || st === "out" || (st === "getup")) {
      const lie = st === "getup" ? 1 - sstep(e.t / 20) : 1, air = Math.min(1, (e.z || 0) / 24);
      T.fall = -1.5 * sstep(lie) * (1 - air * 0.35); T.by = 0.1 * lie; T.bz = -0.5 * sstep(lie);
      T.sL = [-0.5, 1.2, 1.3]; T.sR = [-0.3, 1.1, 1.2]; T.eL = -0.4; T.eR = -0.6; T.hL = [-0.5, 0.25]; T.hR = [-0.2, 0.2]; T.kL = 0.9; T.kR = 0.4; T.hx = 0.4;
      if (st === "getup") { T.hL = [-1.3 * lie, 0.2]; T.kL = 1.6 * lie + 0.3; T.sR = [-0.6 * lie, 0.3, 0.5]; }
      k = st === "getup" ? 22 : 14;
    } else if (st === "hurt") {
      guard(); T.lean = -0.5; T.hx = -0.5; T.twist = (e.t % 8 < 4 ? 0.2 : -0.2); T.sL = [-0.3, 0.9, 0.9]; T.sR = [-0.3, 0.9, 0.9]; T.eL = -0.6; T.eR = -0.6; stance(T, 0.1); k = 34;
    } else if (st === "attack") {
      guard(); stance(T, 0.1);
      const kind = A.kind || "punch", tt = e.t;
      if (kind === "punch") { // wind up, then a straight right with the hips behind it
        const W = tt < A.hit ? 0 : ease3((tt - A.hit) / 4), wind = sstep(tt / A.hit);
        T.sR = [-0.6 + 0.35 * wind - 1.3 * W, 0.15 + 0.25 * wind - 0.4 * W, 0.15]; T.eR = -2.1 * (1 - W) - 0.05; T.twist = 0.45 * wind - 0.95 * W; T.lean = 0.05 + 0.25 * W;
        T.hL = [-0.6, 0.12]; T.kL = 0.6; T.hR = [0.25, 0.14]; T.kR = 0.3; T.bz = 0.12 * W; k = tt >= A.hit ? 45 : 18;
      } else if (kind === "kick") { // chambered knee, then a snapping front kick
        const W = tt < A.hit ? 0 : ease3((tt - A.hit) / 4), wind = sstep(tt / A.hit);
        T.hR = [-1.25 * wind - 0.35 * W, 0.1]; T.kR = 1.7 * wind * (1 - W) + 0.05; T.fR = 0.6 * W; T.lean = -0.25 * wind - 0.15 * W; T.hL = [0.05, 0.1]; T.kL = 0.25;
        T.sL = [-0.6, 0.6, 0.6]; T.sR = [-0.4, 0.5, 0.6]; k = tt >= A.hit ? 45 : 18;
      } else { // dash: crouch, then a low shoulder-first rush
        const crouch = tt < A.crouch;
        if (crouch) { stance(T, 0.3); T.lean = 0.5; T.sL = [0.4, 0.3, 0.3]; T.sR = [0.4, 0.3, 0.3]; T.eL = -0.8; T.eR = -0.8; }
        else { legsCycle(T, tt * 0.9, 1, 1.0); T.lean = 0.75; T.sL = [0.9, 0.2, 0.4]; T.sR = [-1.3, -0.2, 0.15]; T.eR = -0.2; T.eL = -0.6; T.hx = -0.5; }
        k = 26;
      }
    } else if (e.walkT > 0) {
      const sp = R.spd || 0, a = clamp(sp / 3.2, 0.3, 1); legsCycle(T, R.phase, a, 0.7); guard(); T.lean = 0.12 + 0.15 * a;
      T.sL[0] += Math.sin(R.phase + Math.PI) * 0.25 * a; T.sR[0] += Math.sin(R.phase) * 0.25 * a; T.twist = Math.sin(R.phase) * 0.12;
    } else { // guard, bouncing on the balls of the feet (idle posts stand easier)
      const idle = e.idle; guard(); stance(T, 0.02);
      if (idle) { T.sL = [-0.1, 0.1, 0.12]; T.sR = [-0.1, 0.1, 0.12]; T.eL = -0.35; T.eR = -0.35; T.lean = 0.02; T.hL = [-0.1, 0.12]; T.hR = [0.05, 0.12]; T.kL = 0.12; T.kR = 0.1; T.by = 0; T.hy = Math.sin(t * 0.7 + (e.ring || 0)) * 0.3; }
      else { const b = Math.abs(Math.sin(t * 5 + (e.ring || 0))); T.by -= b * 0.025; }
      k = 10;
    }
    return { T, k, spin: 0 };
  }
  // ---------- the instances ----------
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
  function rigFor(scene, key, spec) {
    let R = key === "hero" ? M32.hero : M32.thugs.get(key);
    if (!R) { R = buildRig(spec()); scene.add(R.root); scene.add(R.shadow); if (key === "hero") { M32.hero = R; R.trails = R.blades.map(() => mkTrail(scene)); } M32.tris[key.split("#")[0]] = R.tris; if (key !== "hero") M32.thugs.set(key, R); }
    return R;
  }
  function placeRig(R, P, yaw, spin, dt, light) {
    R.root.position.set(P.gx, P.gy, P.gz); R.root.rotation.y = yaw + spin; R.root.visible = true;
    const lift = Math.max(0, P.gy - P.fy), s = Math.max(0.35, 1 - lift / 2.5);
    R.shadow.visible = true; R.shadow.position.set(P.gx, P.fy + 0.03, P.gz); R.shadow.scale.set(0.95 * s, 1, 0.75 * s);
    // ground speed for the gait (m/s) and the cycle phase
    if (R.lx !== undefined) { const d = Math.hypot(P.gx - R.lx, P.gz - R.lz); const v = dt > 0 ? d / dt : 0; R.spd = R.spd === undefined ? v : R.spd + (Math.min(8, v) - R.spd) * Math.min(1, dt * 10); R.phase = (R.phase || 0) + d * 3.4 / (R.stride || 0.95); }
    R.lx = P.gx; R.lz = P.gz;
  }
  function poseRig(R, tgt, dt) {
    const k = 1 - Math.exp(-dt * tgt.k);
    if (R.first) { blendPose(R.pose, tgt.T, 1); R.first = false; } else blendPose(R.pose, tgt.T, k);
    applyRig(R, R.pose);
  }
  function setFlash(R, f) { if (R.flashV === f) return; R.flashV = f; for (const m of R.mats) m.userData.u.uFlash.value = f; }
  // ---- sword trails: a fading ribbon between each blade's base and tip while a cut is live ----
  const TRAIL_N = 12;
  function mkTrail(scene) {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(TRAIL_N * 2 * 3), col = new Float32Array(TRAIL_N * 2 * 3), idx = [];
    for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3; scene.add(mesh);
    return { mesh, pts: [], on: false };
  }
  function stepTrail(tr, b, live, col) {
    if (live) {
      b.bl.updateWorldMatrix(true, false);
      const base = new THREE.Vector3(0, 0, 0.3).applyMatrix4(b.bl.matrixWorld), tip = new THREE.Vector3(0, 0, 0.7).applyMatrix4(b.bl.matrixWorld);
      tr.pts.unshift([base, tip, 1]);
    }
    for (const q of tr.pts) q[2] -= 0.16;
    tr.pts = tr.pts.filter((q) => q[2] > 0).slice(0, TRAIL_N);
    const n = tr.pts.length; tr.mesh.visible = n > 1; if (n < 2) return;
    const P = tr.mesh.geometry.attributes.position, C = tr.mesh.geometry.attributes.color;
    for (let i = 0; i < TRAIL_N; i++) {
      const q = tr.pts[Math.min(i, n - 1)], a = i < n ? q[2] * (1 - i / TRAIL_N) : 0;
      P.setXYZ(i * 2, q[0].x, q[0].y, q[0].z); P.setXYZ(i * 2 + 1, q[1].x, q[1].y, q[1].z);
      const a2 = a * a * 0.55; C.setXYZ(i * 2, col[0] * a2 * 0.15, col[1] * a2 * 0.15, col[2] * a2 * 0.15); C.setXYZ(i * 2 + 1, col[0] * a2, col[1] * a2, col[2] * a2);
    }
    P.needsUpdate = true; C.needsUpdate = true;
  }
  // ---- lock-on marker: a pixel ring under the soft-locked foe ----
  let LOCKRING = null;
  function lockRing(scene) {
    if (LOCKRING) return LOCKRING;
    const t = px32(32, 32, (g) => { g.clearRect(0, 0, 32, 32); for (let a = 0; a < 16; a++) { if (a % 4 === 3) continue; const r = 14, x = 16 + Math.cos(a / 16 * Math.PI * 2) * r, y = 16 + Math.sin(a / 16 * Math.PI * 2) * r; g.fillStyle = a % 4 === 0 ? "#fff6c0" : "#ffb030"; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); } });
    const g = new THREE.PlaneGeometry(1.25, 1.25); g.rotateX(-Math.PI / 2);
    LOCKRING = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    LOCKRING.renderOrder = 1; scene.add(LOCKRING); return LOCKRING;
  }
  // ---- per frame: pose + place every 32-bit actor (called from drawEntities in E) ----
  const FOOT32 = { purple: 1, blue: 1, dasher: 1 };
  const isFoot32 = (e) => !!FOOT32[e.type];
  function draw32(scene, z, dt) {
    const p = STATE.player, t = STATE.t / 60;
    const used = new Set();
    if (p && !p.hidden) {
      const R = rigFor(scene, "hero", heroSpec); used.add(R);
      const P = { gx: p.gx, gy: p.gy, gz: p.gz, fy: p.fy };
      const tg = heroTarget(p, R, t); placeRig(R, P, p.hy || 0, tg.spin, dt); poseRig(R, tg, dt);
      R.root.visible = !(p.inv > 0 && p.deadT === 0 && p.downT === 0 && Math.floor(STATE.t / 3) % 2 === 0);
      setFlash(R, p.hurtT > 10 ? 0.6 : 0);
      const sp = p.atk && p.atk[0] === "c" ? swingPhase(p) : null;
      const liveR = (sp && sp.ph === "strike" && p.atk !== "c2") || p.atk === "power" || p.atk === "jump" || (sp && sp.ph === "strike" && p.atk === "c3");
      const liveL = (sp && sp.ph === "strike" && p.atk !== "c1") || p.atk === "power" || p.atk === "jump";
      R.root.updateMatrixWorld(true);
      R.blades.forEach((b, i) => stepTrail(R.trails[i], b, b.side > 0 ? liveL : liveR, [0.45, 0.7, 1.0]));
    }
    for (const e of STATE.enemies) {
      if (!isFoot32(e) || e.state === "out") continue;
      if (!e.mk) e.mk = e.type + "#" + (M32.n = (M32.n || 0) + 1);
      const R = rigFor(scene, e.mk, () => thugSpec(e.type)); used.add(R);
      const P = entPos(z, e, {});
      const tg = thugTarget(e, R, t); placeRig(R, P, e.hy || 0, 0, dt); poseRig(R, tg, dt);
      setFlash(R, e.flash > 0 && e.flash % 2 ? 0.75 : 0);
      if (e.state === "dying" && Math.floor(e.t / 3) % 2) R.root.visible = false;
    }
    for (const R of [M32.hero, ...M32.thugs.values()]) if (R && !used.has(R)) { R.root.visible = false; R.shadow.visible = false; R.first = true; if (R.trails) R.trails.forEach((tr) => { tr.pts = []; tr.mesh.visible = false; }); }
    // drop rigs of enemies that no longer exist
    for (const [k, R] of M32.thugs) if (!STATE.enemies.some((e) => e.mk === k)) { scene.remove(R.root); scene.remove(R.shadow); M32.thugs.delete(k); }
    const L = lockRing(scene), tgt = STATE.lock32;
    if (tgt && STATE.enemies.includes(tgt) && canHitState(tgt) && p && p.deadT === 0) {
      const P = entPos(z, tgt, {}); L.visible = true; L.position.set(P.gx, P.fy + 0.05, P.gz); L.rotation.y = STATE.t * 0.05;
      const pul = 1 + Math.sin(STATE.t * 0.25) * 0.06; L.scale.set(pul, 1, pul);
    } else L.visible = false;
  }
  function hide32() { for (const R of [M32.hero, ...M32.thugs.values()]) if (R) { R.root.visible = false; R.shadow.visible = false; R.first = true; if (R.trails) R.trails.forEach((tr) => { tr.pts = []; tr.mesh.visible = false; }); } if (LOCKRING) LOCKRING.visible = false; }
