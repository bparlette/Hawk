  // ===== H: ISO CITY - painted isometric extras: dithered cut-away shader patch, per-building rooftop furniture, light pools, contact shadows =====
  const ISO_CUT = { ctr: { value: new THREE.Vector2(0, 0) }, rad: { value: 200 } };
  const PROJ_ISO_S = new THREE.Vector3(), _dbs = new THREE.Vector2();
  const ISO_CUT_HEAD = "uniform float uCut; uniform vec2 uCtr; uniform float uRad;\n" +
    "float isoB2(vec2 a){ a=floor(a); return fract(dot(a, vec2(0.5, a.y*0.75))); }\n" +
    "float isoB4(vec2 a){ return isoB2(0.5*a)*0.25 + isoB2(a); }\n";
  // inside the hole round the hero nothing is drawn, the rest of the building thins to a 4x4 ordered dither
  const ISO_CUT_BODY = "if (uCut > 0.001) { float isoD = length(gl_FragCoord.xy - uCtr) / uRad; float isoK = mix(1.0, smoothstep(0.8, 1.15, isoD) * (vIsoY < 3.4 ? 1.0 : 0.3), uCut); if (isoB4(gl_FragCoord.xy) >= isoK) discard; }\n";
  function isoCutMat(m, U) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uCut = U.cut; sh.uniforms.uCtr = ISO_CUT.ctr; sh.uniforms.uRad = ISO_CUT.rad;
      sh.vertexShader = "varying float vIsoY;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vIsoY = (modelMatrix * vec4(transformed, 1.0)).y;");
      sh.fragmentShader = "varying float vIsoY;\n" + ISO_CUT_HEAD + sh.fragmentShader.replace(/void\s+main\s*\(\s*\)\s*\{/, (s) => s + "\n" + ISO_CUT_BODY);
    };
    m.customProgramCacheKey = () => "isocut";
  }
  let ISOSEED = 9041;
  const irnd = () => ((ISOSEED = (ISOSEED * 16807) % 2147483647) / 2147483647);
  const ISOT = {};
  function isoTex() {
    if (ISOT.wood) return ISOT;
    ISOT.wood = canvasTex(256, 128, (g, w, h) => { // weathered cedar staves + iron hoops
      for (let i = 0; i < 32; i++) { const v = 78 + (irnd() * 34 | 0); g.fillStyle = `rgb(${v + 26},${v - 4},${v - 30})`; g.fillRect(i * 8, 0, 8, h); g.fillStyle = "rgba(0,0,0,0.32)"; g.fillRect(i * 8, 0, 1, h); g.fillStyle = "rgba(255,220,170,0.08)"; g.fillRect(i * 8 + 2, 0, 2, h); }
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(20,10,5,0.45)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = "#26262c"; for (const y of [10, 46, 84, 116]) { g.fillRect(0, y, w, 5); g.fillStyle = "rgba(160,170,200,0.35)"; g.fillRect(0, y, w, 1); g.fillStyle = "#26262c"; }
    }, true);
    ISOT.ac = canvasTex(128, 128, (g) => { // a painted roof AC unit top: grille + fan
      g.fillStyle = "#9a9ea6"; g.fillRect(0, 0, 128, 128); g.fillStyle = "#6a6e76"; g.fillRect(6, 6, 116, 116);
      g.fillStyle = "#24262c"; g.beginPath(); g.arc(64, 64, 44, 0, 7); g.fill(); g.strokeStyle = "#8a8e96"; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(64, 64, 10 + i * 7, 0, 7); g.stroke(); }
      g.fillStyle = "#4a4e56"; g.beginPath(); g.arc(64, 64, 8, 0, 7); g.fill(); g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(6, 6, 116, 4);
    });
    ISOT.acSide = canvasTex(128, 64, (g) => { g.fillStyle = "#8a8e96"; g.fillRect(0, 0, 128, 64); g.fillStyle = "#4a4e56"; for (let i = 8; i < 60; i += 6) g.fillRect(6, i, 116, 2); g.strokeStyle = "#2a2e36"; g.lineWidth = 3; g.strokeRect(1, 1, 126, 62); g.fillStyle = "rgba(120,60,20,0.35)"; g.fillRect(90, 40, 30, 20); });
    ISOT.brick = canvasTex(256, 256, (g, w, h) => { // bulkhead brick + a door (u 0..0.5 brick, u 0.5..1 door face)
      g.fillStyle = "#3a2a26"; g.fillRect(0, 0, w, h);
      for (let r = 0, y = 0; y < h; r++, y += 10) for (let x = -(r % 2) * 14; x < w; x += 28) { const v = 0.75 + irnd() * 0.4; g.fillStyle = `rgb(${120 * v | 0},${70 * v | 0},${56 * v | 0})`; g.fillRect(x + 1, y + 1, 26, 8); }
      g.fillStyle = "#1c2a26"; g.fillRect(150, 70, 84, 186); g.fillStyle = "#2e4a40"; g.fillRect(156, 76, 72, 180); g.fillStyle = "#c8b070"; g.fillRect(212, 160, 8, 8);
      g.fillStyle = "#ffe2a0"; g.fillRect(180, 50, 24, 12); const gl = g.createRadialGradient(192, 60, 2, 192, 60, 60); gl.addColorStop(0, "rgba(255,210,140,0.55)"); gl.addColorStop(1, "rgba(255,210,140,0)"); g.fillStyle = gl; g.fillRect(132, 0, 120, 140);
    });
    ISOT.sky = canvasTex(128, 128, (g) => { // skylight: warm lit glass panes
      const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, "#ffe6a8"); gr.addColorStop(1, "#d8823a"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.fillStyle = "#2a2622"; for (let i = 0; i <= 128; i += 32) { g.fillRect(i - 3, 0, 6, 128); g.fillRect(0, i - 3, 128, 6); }
      g.fillStyle = "rgba(255,255,255,0.25)"; g.beginPath(); g.moveTo(10, 10); g.lineTo(50, 10); g.lineTo(10, 60); g.fill();
    });
    ISOT.glow = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(255,255,255,0.55)"); r.addColorStop(0.65, "rgba(255,255,255,0.16)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
    ISOT.ao = canvasTex(16, 64, (g) => { const r = g.createLinearGradient(0, 0, 0, 64); r.addColorStop(0, "rgba(6,4,12,0.62)"); r.addColorStop(0.45, "rgba(6,4,12,0.22)"); r.addColorStop(1, "rgba(6,4,12,0)"); g.fillStyle = r; g.fillRect(0, 0, 16, 64); });
    return ISOT;
  }
  // rooftop furniture for one building, in its own group with its own materials (so the cut-away takes it too)
  function isoRoof(b, h, mk) {
    const T = isoTex(), y = h, w = b.x1 - b.x0, d = b.z1 - b.z0, area = w * d;
    const parts = { wood: [], dark: [], ac: [], acs: [], brick: [], sky: [], gl: [], pipe: [], bulb: [], planter: [], leaf: [] }, glows = [];
    const taken = [];
    const spot = (r) => { // a free spot on the roof, clear of the parapet and of what is already up there
      for (let t = 0; t < 30; t++) { const x = b.x0 + 1 + r + irnd() * (w - 2 - 2 * r), z = b.z0 + 1 + r + irnd() * (d - 2 - 2 * r); if (taken.every(([a, c, q]) => Math.hypot(a - x, c - z) > q + r + 0.6)) { taken.push([x, z, r]); return [x, z]; } }
      return null;
    };
    let top = h + 0.7;
    const nTow = area > 900 ? 2 : area > 180 ? 1 : irnd() < 0.5 ? 1 : 0;
    for (let i = 0; i < nTow; i++) {
      const s = spot(2.3); if (!s) continue; const [x, z] = s, R = 1.45 + irnd() * 0.5, leg = 2.6 + irnd() * 1.6, bh = 2.8 + irnd() * 1.2, y0 = y + leg;
      const br = new THREE.CylinderGeometry(R, R * 1.06, bh, 18, 1, false); br.translate(x, y0 + bh / 2, z); parts.wood.push(br);
      const c = new THREE.ConeGeometry(R * 1.12, R * 0.8, 18); c.translate(x, y0 + bh + R * 0.4, z); parts.dark.push(c);
      const fin = new THREE.SphereGeometry(0.16, 8, 6); fin.translate(x, y0 + bh + R * 0.8 + 0.1, z); parts.dark.push(fin);
      for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const l = new THREE.BoxGeometry(0.16, leg, 0.16); l.translate(x + dx * R * 0.72, y + leg / 2, z + dz * R * 0.72); parts.dark.push(l); }
      for (const k of [0.35, 0.7]) { const xb = new THREE.BoxGeometry(R * 1.5, 0.08, 0.08); xb.translate(x, y + leg * k, z + R * 0.72); parts.dark.push(xb); const xb2 = xb.clone(); xb2.translate(0, 0, -R * 1.44); parts.dark.push(xb2); }
      const pl = new THREE.BoxGeometry(R * 2.1, 0.14, R * 2.1); pl.translate(x, y0, z); parts.dark.push(pl);
      const lad = new THREE.BoxGeometry(0.5, leg + bh, 0.06); lad.translate(x, y + (leg + bh) / 2, z + R + 0.05); parts.dark.push(lad);
      top = Math.max(top, y0 + bh + R * 0.8);
    }
    const nAc = Math.min(4, 1 + Math.floor(area / 160));
    for (let i = 0; i < nAc; i++) { const s = spot(1.1); if (!s) continue; const [x, z] = s, g = new THREE.BoxGeometry(1.7, 1.0, 1.3); g.translate(x, y + 0.5, z);
      const pos = g.attributes.position, nrm = g.attributes.normal; // top face -> fan art, sides -> louvres (one material each)
      const topG = new THREE.PlaneGeometry(1.7, 1.3); topG.rotateX(-Math.PI / 2); topG.translate(x, y + 1.01, z); parts.ac.push(topG); void pos; void nrm; parts.acs.push(g); }
    if (area > 160 && irnd() < 0.85) { // stair bulkhead with a lit door
      const s = spot(1.8); if (s) { const [x, z] = s, g = new THREE.BoxGeometry(2.6, 2.7, 2.4); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5 + (i >= 16 && i < 20 ? 0.5 : 0)); g.translate(x, y + 1.35, z); parts.brick.push(g);
        const cap = new THREE.BoxGeometry(2.9, 0.16, 2.7); cap.translate(x, y + 2.75, z); parts.dark.push(cap);
        glows.push([x, y + 0.08, z + 1.9, 2.6, 0xffc88a, 0.6]); top = Math.max(top, y + 2.9); } }
    const nSky = area > 300 ? 2 : area > 120 ? 1 : 0;
    for (let i = 0; i < nSky; i++) { const s = spot(1.4); if (!s) continue; const [x, z] = s, g = new THREE.BoxGeometry(2.4, 0.5, 1.8); g.translate(x, y + 0.25, z); parts.dark.push(g);
      const gl = new THREE.PlaneGeometry(2.2, 1.6); gl.rotateX(-Math.PI / 2); gl.translate(x, y + 0.52, z); parts.sky.push(gl); glows.push([x, y + 0.56, z, 3.4, 0xffb060, 0.45]); }
    // festoon lights strung across the roof between two poles
    if (area > 200 && irnd() < 0.65) {
      const ax = b.x0 + 2, az = b.z0 + 2 + irnd() * (d - 4), bx = b.x1 - 2, bz = b.z0 + 2 + irnd() * (d - 4), n = Math.max(8, Math.round(Math.hypot(bx - ax, bz - az) / 1.1));
      for (const [px, pz] of [[ax, az], [bx, bz]]) { const pole = new THREE.CylinderGeometry(0.06, 0.08, 2.6, 6); pole.translate(px, y + 1.3, pz); parts.dark.push(pole); }
      for (let i = 0; i <= n; i++) { const k = i / n, x = ax + (bx - ax) * k, z = az + (bz - az) * k, yy = y + 2.5 - Math.sin(k * Math.PI) * 0.7;
        const bl = new THREE.SphereGeometry(0.11, 6, 4); bl.translate(x, yy, z); parts.bulb.push(bl); if (i % 3 === 1) glows.push([x, y + 0.08, z, 1.5, 0xffc070, 0.5]); }
    }
    // planters with shrubs (a rooftop garden) on some roofs
    if (irnd() < 0.55) { const n = 2 + Math.floor(irnd() * 4); for (let i = 0; i < n; i++) { const s = spot(0.8); if (!s) continue; const [x, z] = s, bx2 = new THREE.BoxGeometry(1.3, 0.5, 0.7); bx2.translate(x, y + 0.25, z); parts.planter.push(bx2);
      for (let j = 0; j < 3; j++) { const sp = new THREE.IcosahedronGeometry(0.32 + irnd() * 0.18, 0); sp.translate(x - 0.4 + j * 0.4, y + 0.7 + irnd() * 0.15, z); parts.leaf.push(sp); } } }
    // a satellite dish
    if (irnd() < 0.5) { const s = spot(0.7); if (s) { const [x, z] = s, dsh = new THREE.SphereGeometry(0.6, 12, 6, 0, Math.PI * 2, 0, 0.9); dsh.rotateX(-1.1); dsh.rotateY(irnd() * 6); dsh.translate(x, y + 1.1, z); parts.pipe.push(dsh); const st = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6); st.translate(x, y + 0.5, z); parts.dark.push(st); } }
    const nPipe = 1 + Math.floor(irnd() * 3);
    for (let i = 0; i < nPipe; i++) { const s = spot(0.4); if (!s) continue; const [x, z] = s, ph = 0.9 + irnd() * 1.3, g = new THREE.CylinderGeometry(0.22, 0.22, ph, 10); g.translate(x, y + ph / 2, z); parts.pipe.push(g);
      const hd = new THREE.CylinderGeometry(0.34, 0.26, 0.2, 10); hd.translate(x, y + ph + 0.1, z); parts.pipe.push(hd); if (irnd() < 0.6) WORLD.isoSteam.push({ x, y: y + ph + 0.2, z }); }
    const M = {
      wood: mk(T.wood, { vertexColors: false }), dark: mk(null, { vertexColors: false, color: 0x2a2a32 }), ac: mk(T.ac, { vertexColors: false }), acs: mk(T.acSide, { vertexColors: false }),
      brick: mk(T.brick, { vertexColors: false }), sky: null, pipe: mk(null, { vertexColors: false, color: 0x5a5e66 }),
      bulb: null, planter: mk(null, { vertexColors: false, color: 0x5a3a26 }), leaf: mk(null, { vertexColors: false, color: 0x3e7a44, flatShading: true }),
    };
    for (const k in parts) {
      if (!parts[k].length) continue;
      let m = M[k];
      if (k === "sky") { m = new THREE.MeshBasicMaterial({ map: T.sky, color: 0xe8d0b0 }); b.mats.push(m); }
      if (k === "bulb") { m = new THREE.MeshBasicMaterial({ color: 0xffe6a0 }); b.mats.push(m); }
      const mesh = new THREE.Mesh(mergeGeos(parts[k]), m); b.grp.add(mesh);
    }
    if (glows.length) { // warm light spilled on the roof, one additive mesh per building (cut away with it)
      const GB = new Builder(), gm = new THREE.MeshBasicMaterial({ map: T.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2 });
      for (const [x, yy, z, r, c, a] of glows) { const C = new THREE.Color(c).multiplyScalar(a); GB.quad(gm, [x - r, yy, z + r], [x + r, yy, z + r], [x + r, yy, z - r], [x - r, yy, z - r], [[0, 0], [1, 0], [1, 1], [0, 1]], [C.r, C.g, C.b]); }
      GB.build(b.grp); b.mats.push(gm);
    }
    b.top = top;
  }
  // light pools under every lamp / sign / kiosk, glows on the roofs, soft contact shadow at the foot of every wall
  function isoDecals(G) {
    const T = isoTex();
    const pools = WORLD.lights.filter((L) => L.reg === "street" && L.y < 7).map((L) => ({ x: L.x, y: 0.165, z: L.z, r: L.d * (L.i > 20 ? 0.4 : 0.34), c: L.c, a: L.i > 20 ? 0.7 : L.i > 9 ? 0.5 : 0.4 }));
    const PB = new Builder(), pm = new THREE.MeshBasicMaterial({ map: T.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const P of pools) { const C = new THREE.Color(P.c).multiplyScalar(P.a), r = P.r; PB.quad(pm, [P.x - r, P.y, P.z + r], [P.x + r, P.y, P.z + r], [P.x + r, P.y, P.z - r], [P.x - r, P.y, P.z - r], [[0, 0], [1, 0], [1, 1], [0, 1]], [C.r, C.g, C.b]); }
    PB.build(G);
    const B = new Builder(), aoM = new THREE.MeshBasicMaterial({ map: T.ao, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 });
    const D = 1.7, y = 0.16;
    for (const b of WORLD.blds) {
      const { x0, z0, x1, z1 } = b;
      B.quad(aoM, [x0, y, z1 + D], [x1, y, z1 + D], [x1, y, z1], [x0, y, z1], [[0, 0], [1, 0], [1, 1], [0, 1]]); // south foot
      B.quad(aoM, [x1, y, z0 - D], [x0, y, z0 - D], [x0, y, z0], [x1, y, z0], [[0, 0], [1, 0], [1, 1], [0, 1]]); // north foot
      B.quad(aoM, [x1 + D, y, z0], [x1 + D, y, z1], [x1, y, z1], [x1, y, z0], [[0, 0], [1, 0], [1, 1], [0, 1]]); // east foot
      B.quad(aoM, [x0 - D, y, z1], [x0 - D, y, z0], [x0, y, z0], [x0, y, z1], [[0, 0], [1, 0], [1, 1], [0, 1]]); // west foot
    }
    B.build(G);
  }
  WORLD.isoGlows = []; WORLD.isoSteam = [];
  function isoSteamStep() { for (const s of WORLD.isoSteam) if (Math.random() < 0.22) PART.street.emit(s.x + rnd(-0.15, 0.15), s.y, s.z + rnd(-0.15, 0.15), rnd(-0.1, 0.3), rnd(0.7, 1.2), rnd(-0.15, 0.15), rnd(2.2, 3.2), rnd(0.35, 0.55), 0.7, 0.82, 0.82, 0.92, 0.12); }
