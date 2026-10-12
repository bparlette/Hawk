  // ===== CITY (bake-off): one 4-way intersection, four corner blocks. Shared utils copied from Shell Shock 3D world.js / decor.js =====
  const PX = 0.028, DY = 0.09, ZH = 0.028, SPRM = 0.028; // metres per 2D px along a zone, per depth px, per jump px; sprite px
  const TEXL = new THREE.TextureLoader();
  const TEX = {};
  const PXTEX = /^tex\/(asphalt|sidewalk|roof|facade_a|facade_b|mural_pizza|mural_gator|skyline|taxi_side|van_side|props2)\.(jpg|webp)$/; // G: pixel-art versions (px.py)
  function tex(name, rep) {
    const key = name + (rep ? ":r" : "");
    if (TEX[key]) return TEX[key];
    const t = TEXL.load(HD && PXTEX.test(name) ? name.replace(/\.(jpg|webp)$/, ".png") : name);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (HD) t.magFilter = THREE.NearestFilter;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return (TEX[key] = t);
  }
  function canvasTex(w, h, draw, rep, pxf) {
    let c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    // G: painted canvas art is shrunk to a pixel-art grid and shown nearest-filtered (pxf = shrink factor; small textures stay as drawn)
    const f = !HD ? 1 : pxf || (Math.max(w, h) >= 512 ? 4 : Math.max(w, h) >= 256 ? 2 : 1);
    if (f > 1) { const d = document.createElement("canvas"); d.width = Math.max(1, Math.round(w / f)); d.height = Math.max(1, Math.round(h / f)); const g = d.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(c, 0, 0, d.width, d.height); c = d; }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (HD && f > 1) t.magFilter = THREE.NearestFilter;
    if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  // ---- merge builder: quads accumulate per material key; build() makes one mesh per key ----
  class Builder {
    constructor() { this.m = new Map(); }
    arr(mat) { let a = this.m.get(mat); if (!a) this.m.set(mat, (a = { p: [], uv: [], n: [], c: [] })); return a; }
    quad(mat, a, b, c, d, uv, col) { // a b c d counter-clockwise seen from the front
      const A = this.arr(mat);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const P = [a, b, c, a, c, d], U = [uv[0], uv[1], uv[2], uv[0], uv[2], uv[3]];
      const C = col || [1, 1, 1], CC = Array.isArray(C[0]) ? [C[0], C[1], C[2], C[0], C[2], C[3]] : null;
      for (let i = 0; i < 6; i++) { A.p.push(P[i][0], P[i][1], P[i][2]); A.uv.push(U[i][0], U[i][1]); A.n.push(nx, ny, nz); const k = CC ? CC[i] : C; A.c.push(k[0], k[1], k[2]); }
    }
    // vertical wall from (x0,z0) to (x1,z1), front faces the viewer who sees x0 on the left
    wall(mat, x0, z0, x1, z1, y0, y1, u0 = 0, v0 = 0, u1 = 1, v1 = 1, col) {
      this.quad(mat, [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], col);
    }
    floor(mat, x0, z0, x1, z1, y, tile = 4, col, ceil) { // tile = metres per texture repeat
      const u0 = x0 / tile, u1 = x1 / tile, v0 = -z1 / tile, v1 = -z0 / tile;
      if (ceil) this.quad(mat, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], col);
      else this.quad(mat, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], col);
    }
    build(group) {
      for (const [mat, A] of this.m) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(A.p, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(A.uv, 2));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(A.n, 3));
        g.setAttribute("color", new THREE.Float32BufferAttribute(A.c, 3));
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, mat); mesh.matrixAutoUpdate = false; group.add(mesh);
      }
      this.m.clear();
    }
  }
  const lam = (map, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ map, vertexColors: true }, o));
  const WORLD = { groups: {}, zones: [], lights: [], inter: [], cols: [], anim: [], steam: [], fires: [], signs: [] };
  function mergeGeos(gs) { // minimal BufferGeometry merge (non-indexed position/normal/uv)
    const P = [], N = [], U = [];
    for (let g of gs) { if (g.index) g = g.toNonIndexed(); const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv ? g.attributes.uv.array : null;
      for (let i = 0; i < p.length; i++) { P.push(p[i]); N.push(n[i]); } for (let i = 0; i < p.length / 3; i++) { U.push(u ? u[i * 2] : 0, u ? u[i * 2 + 1] : 0); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.computeBoundingSphere(); return g;
  }
  function silhouetteShape(img, bottomFrac) {
    const c = document.createElement("canvas"), w = 72, h = Math.round(96 * img.height / img.width); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data;
    const top = [];
    for (let x = 0; x < w; x++) { let y = 0; while (y < h && d[(y * w + x) * 4 + 3] < 140) y++; top.push(y); }
    for (let x = 1; x < w - 1; x++) top[x] = [top[x - 1], top[x], top[x + 1]].sort((a, b) => a - b)[1]; // median: no spikes
    const s = new THREE.Shape(); const yb = h * bottomFrac;
    let x0 = 0; while (x0 < w && top[x0] >= yb - 1) x0++; let x1 = w - 1; while (x1 > 0 && top[x1] >= yb - 1) x1--;
    s.moveTo(x0 / w, 1 - yb / h);
    for (let x = x0; x <= x1; x++) s.lineTo((x + 0.5) / w, 1 - Math.min(yb, top[x]) / h);
    s.lineTo((x1 + 1) / w, 1 - yb / h); s.closePath();
    return s;
  }
  // ---- point particles (steam, smoke, embers, sparks): one Points object per blend mode, fixed pools ----
  const softDot = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  class Particles {
    constructor(n, additive, group) {
      this.n = n; this.i = 0;
      this.p = new Float32Array(n * 3); this.c = new Float32Array(n * 4); this.s = new Float32Array(n);
      this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.t = new Float32Array(n); this.grow = new Float32Array(n); this.col = new Float32Array(n * 4);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute("pcol", new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute("psize", new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
      const m = new THREE.ShaderMaterial({
        uniforms: { map: { value: softDot }, scale: { value: 300 } }, transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        vertexShader: "attribute vec4 pcol; attribute float psize; uniform float scale; varying vec4 vc; void main(){ vc=pcol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=psize*scale/max(0.5,-mv.z); gl_Position=projectionMatrix*mv; }",
        fragmentShader: "uniform sampler2D map; varying vec4 vc; void main(){ vec4 t=texture2D(map, gl_PointCoord); gl_FragColor=vec4(vc.rgb, vc.a*t.a); if(gl_FragColor.a<0.01) discard; }",
      });
      this.mesh = new THREE.Points(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; group.add(this.mesh); this.mat = m;
    }
    emit(x, y, z, vx, vy, vz, life, size, grow, r, g, b, a) {
      const i = this.i; this.i = (this.i + 1) % this.n;
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
      this.life[i] = life; this.t[i] = 0; this.s[i] = size; this.grow[i] = grow; this.col.set([r, g, b, a], i * 4);
    }
    step(dt) {
      for (let i = 0; i < this.n; i++) {
        if (this.life[i] <= 0) { this.c[i * 4 + 3] = 0; continue; }
        this.t[i] += dt; const k = this.t[i] / this.life[i];
        if (k >= 1) { this.life[i] = 0; this.c[i * 4 + 3] = 0; continue; }
        this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
        this.s[i] += this.grow[i] * dt;
        const fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        this.c[i * 4] = this.col[i * 4]; this.c[i * 4 + 1] = this.col[i * 4 + 1]; this.c[i * 4 + 2] = this.col[i * 4 + 2]; this.c[i * 4 + 3] = this.col[i * 4 + 3] * fade;
      }
      const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.pcol.needsUpdate = true; g.attributes.psize.needsUpdate = true;
    }
  }
  const PART = {};
  // ---------- stubs for the layers this prototype does not have (sewer / subway / interiors) ----------
  const SUB = { CY: 0, PY: -99, TY: -99, zE: -999 };
  function subFloor() { return null; }
  function updateTrain() {}
  // ---------- the intersection ----------
  // Origin = the middle of the crossing. X east, Z south, Y up. Roads |x|<7 (N-S) and |z|<7 (E-W); sidewalks to 11; buildings from 11.
  const CITY = { L: 44, R: 7, S: 11 };
  function neonTex(txt, c1, c2, vertical) {
    return canvasTex(vertical ? 128 : 512, vertical ? 512 : 160, (g, cw, ch) => {
      g.fillStyle = "rgba(10,6,16,0.92)"; g.fillRect(6, 6, cw - 12, ch - 12);
      g.shadowColor = c2; g.shadowBlur = 22; g.strokeStyle = c2; g.lineWidth = 6; g.strokeRect(14, 14, cw - 28, ch - 28);
      g.fillStyle = c1; g.shadowColor = c1; g.shadowBlur = 26; g.textAlign = "center"; g.textBaseline = "middle";
      if (vertical) { g.font = "bold 84px Arial Black, Arial"; const L = txt.split(""); L.forEach((ch2, i) => g.fillText(ch2, cw / 2, 70 + i * ((ch - 120) / Math.max(1, L.length - 1)))); }
      else { g.font = "bold " + (txt.length > 9 ? 64 : 86) + "px Arial Black, Arial"; g.fillText(txt, cw / 2, ch / 2 + 4); }
    });
  }
  function buildWorld(scene) {
    const G = WORLD.groups;
    for (const k of ["street", "roof", "sewer", "inside", "subway"]) { G[k] = new THREE.Group(); scene.add(G[k]); }
    if (SKY) skyInit();
    PART.street = new Particles(420, false, G.street); PART.glow = new Particles(200, true, G.street);
    PART.fx = new Particles(300, false, G.street); PART.fxg = new Particles(300, true, G.street);
    const M = {
      asphalt: lam(tex("tex/asphalt.jpg", true)), side: lam(tex("tex/sidewalk.jpg", true)), roof: lam(tex("tex/roof.jpg", true)),
      curb: lam(tex("tex/sidewalk.jpg", true), { color: 0x9a9aa2 }),
    };
    WORLD.M = M;
    const ST = new Builder();
    const { L, R, S } = CITY;
    // ---- ground: asphalt everywhere (under the buildings too, so nothing ever shows a void) ----
    ST.floor(M.asphalt, -90, -90, 90, 90, 0, 6);
    // ---- sidewalks: an L in each corner + a strip in front of each street-end building ----
    const SWH = 0.14, walks = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const a = [R, S, L, S + 0.0], ax = (lo, hi) => (sx > 0 ? [lo, hi] : [-hi, -lo]), az = (lo, hi) => (sz > 0 ? [lo, hi] : [-hi, -lo]);
      const [x0, x1] = ax(R, L), [z0, z1] = az(R, S); walks.push([x0, z0, x1, z1]); // along the E-W road
      const [x2, x3] = ax(R, S), [z2, z3] = az(S, L); walks.push([x2, z2, x3, z3]);  // along the N-S road
      void a;
    }
    walks.push([L - 3, -R, L, R], [-L, -R, -L + 3, R], [-R, -L, R, -L + 3], [-R, L - 3, R, L]);
    WORLD.walks = walks;
    for (const [x0, z0, x1, z1] of walks) {
      ST.floor(M.side, x0, z0, x1, z1, SWH, 3.2);
      ST.wall(M.curb, x0, z1, x1, z1, 0, SWH, x0 / 3, 0, x1 / 3, 0.05); ST.wall(M.curb, x1, z0, x0, z0, 0, SWH, x1 / 3, 0, x0 / 3, 0.05);
      ST.wall(M.curb, x1, z1, x1, z0, 0, SWH, 0, 0, 1, 0.05); ST.wall(M.curb, x0, z0, x0, z1, 0, SWH, 0, 0, 1, 0.05);
    }
    // ---- road paint: dashed yellow centre lines, stop lines, zebra crosswalks on all four arms ----
    const paint = lam(canvasTex(64, 64, (g) => { g.fillStyle = "#e6c650"; g.fillRect(0, 0, 64, 64); }), { transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const white = lam(canvasTex(64, 64, (g) => { g.fillStyle = "#ececf2"; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 90; i++) { g.fillStyle = "rgba(60,60,70,0.5)"; g.fillRect(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 5, 1 + Math.random() * 3); } }), { transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let d = S + 2; d < L - 3; d += 5) {
      ST.floor(paint, d, -0.12, d + 2.6, 0.12, 0.012, 64); ST.floor(paint, -d - 2.6, -0.12, -d, 0.12, 0.012, 64);
      ST.floor(paint, -0.12, d, 0.12, d + 2.6, 0.012, 64); ST.floor(paint, -0.12, -d - 2.6, 0.12, -d, 0.012, 64);
    }
    for (let k = -R + 0.5; k < R - 0.4; k += 1.2) {
      ST.floor(white, R + 0.6, k, R + 3.4, k + 0.6, 0.012, 64); ST.floor(white, -R - 3.4, k, -R - 0.6, k + 0.6, 0.012, 64);
      ST.floor(white, k, R + 0.6, k + 0.6, R + 3.4, 0.012, 64); ST.floor(white, k, -R - 3.4, k + 0.6, -R - 0.6, 0.012, 64);
    }
    ST.floor(white, R + 3.8, 0.2, R + 4.2, R - 0.3, 0.012, 64); ST.floor(white, -R - 4.2, -R + 0.3, -R - 3.8, -0.2, 0.012, 64);
    ST.floor(white, -R + 0.3, R + 3.8, -0.2, R + 4.2, 0.012, 64); ST.floor(white, 0.2, -R - 4.2, R - 0.3, -R - 3.8, 0.012, 64);
    ST.build(G.street);
    // ---- buildings: one group per building (so the camera can fade the one in its way) ----
    const T = { A: [tex("tex/facade_a.jpg", true), 1584 / 672], B: [tex("tex/facade_b.jpg", true), 1376 / 768], P: [tex("tex/mural_pizza.jpg"), 1024 / 434], G: [tex("tex/mural_gator.jpg"), 1024 / 434] };
    WORLD.blds = [];
    // faces: { S|N|E|W: "A" | "B" | "P" | "G" } = street fronts; others get a darker brick side
    function bld(x0, z0, x1, z1, h, faces, opts = {}) {
      const B = new Builder(), grp = new THREE.Group(), mats = [];
      const mk = (map, o) => { const m = lam(map, o); mats.push(m); return m; };
      const fm = {}; for (const k in faces) fm[k] = mk(T[faces[k]][0]);
      const sideM = mk(T.B[0]), roofM = mk(tex("tex/roof.jpg", true)), capM = mk(tex("tex/sidewalk.jpg", true), { color: 0x8a8690 });
      const len = { S: x1 - x0, N: x1 - x0, E: z1 - z0, W: z1 - z0 };
      const P = { S: [x0, z1, x1, z1], N: [x1, z0, x0, z0], E: [x1, z1, x1, z0], W: [x0, z0, x0, z1] };
      for (const f of ["S", "N", "E", "W"]) {
        const [ax, az, bx, bz] = P[f];
        if (faces[f]) {
          const [, asp] = T[faces[f]], mural = faces[f] === "P" || faces[f] === "G";
          const hh = mural ? Math.min(h, len[f] / asp) : h;
          const uo = (opts.uo && opts.uo[f]) || 0;
          if (mural) { B.wall(fm[f], ax, az, bx, bz, 0, hh, 0, 0, 1, 1); if (hh < h) B.wall(sideM, ax, az, bx, bz, hh, h, 0, 0.55, len[f] / (h * T.B[1]), 1, [0.5, 0.48, 0.55]); }
          else B.wall(fm[f], ax, az, bx, bz, 0, h, uo, 0, uo + len[f] / (h * asp), 1, opts.col || [1, 1, 1]);
        } else B.wall(sideM, ax, az, bx, bz, 0, h, 0, 0, len[f] / (h * T.B[1]), 1, [0.48, 0.46, 0.54]);
      }
      if (SKY) { // D: the painted storefront floors stay, the building keeps going up (shared merged meshes, see skyline.js)
        const tints = [[1, 1, 1], [0.84, 0.86, 1.0], [1.06, 0.94, 0.82], [0.9, 0.76, 0.74], [0.95, 0.9, 0.95]];
        const Ht = skyUpper(x0, z0, x1, z1, h, opts.up || 0, faces, tints[(srnd() * tints.length) | 0]);
        B.build(grp); G.street.add(grp);
        const b = { x0, z0, x1, z1, h: Ht, grp, mats, fade: 1 }; WORLD.blds.push(b); return b;
      }
      B.floor(roofM, x0, z0, x1, z1, h, 5, [0.72, 0.72, 0.78]);
      // parapet: a thin cornice rim (reads well from the raised camera)
      const ph = 0.7, t = 0.32, y0 = h, y1 = h + ph;
      const rim = (a0, b0, a1, b1) => { B.wall(capM, a0, b1, a1, b1, y0, y1, 0, 0, (a1 - a0) / 2, 0.3); B.wall(capM, a1, b0, a0, b0, y0, y1, 0, 0, (a1 - a0) / 2, 0.3); B.wall(capM, a1, b1, a1, b0, y0, y1, 0, 0, (b1 - b0) / 2, 0.3); B.wall(capM, a0, b0, a0, b1, y0, y1, 0, 0, (b1 - b0) / 2, 0.3); B.floor(capM, a0, b0, a1, b1, y1, 2); };
      rim(x0, z1 - t, x1, z1); rim(x0, z0, x1, z0 + t); rim(x0, z0 + t, x0 + t, z1 - t); rim(x1 - t, z0 + t, x1, z1 - t);
      B.build(grp); G.street.add(grp);
      const b = { x0, z0, x1, z1, h: h + ph, grp, mats, fade: 1 };
      WORLD.blds.push(b); return b;
    }
    // corner blocks (NE, NW, SE, SW): a tall corner building with two fronts + one building down each street + a filler behind
    const CB = [
      // [sx, sz, corner faces, corner h, ew-front facade, ew h, ns-front facade, ns h]
      [1, -1, { S: "A", W: "B" }, 16, "B", 13, "A", 14],
      [-1, -1, { S: "B", E: "A" }, 14, "A", 16, "B", 12.5],
      [1, 1, { N: "B", W: "A" }, 15, "A", 12.5, "B", 16],
      [-1, 1, { N: "A", E: "B" }, 13, "B", 15, "A", 14],
    ];
    const box = (sx, sz, a0, a1, b0, b1) => { const xs = [sx * a0, sx * a1].sort((p, q) => p - q), zs = [sz * b0, sz * b1].sort((p, q) => p - q); return [xs[0], zs[0], xs[1], zs[1]]; };
    const ewF = (sz) => (sz < 0 ? "S" : "N"), nsF = (sx) => (sx < 0 ? "E" : "W");
    const UP = SKY ? [[24, 15, 18, 36], [27, 12, 21, 42], [18, 21, 12, 33], [21, 18, 15, 39]] : [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; // D: storeys added on top (metres)
    CB.forEach(([sx, sz, cf, ch, ef, eh, nf, nh], i) => {
      let r = box(sx, sz, S, 27, S, 27); bld(r[0], r[1], r[2], r[3], ch, cf, { uo: { S: 0.1 * i, N: 0.3 + 0.1 * i, E: 0.2, W: 0.45 }, up: UP[i][0] });
      r = box(sx, sz, 27, 70, S, 30); bld(r[0], r[1], r[2], r[3], eh, { [ewF(sz)]: ef }, { uo: { S: 0.55 - 0.1 * i, N: 0.15 * i }, up: UP[i][1] });
      r = box(sx, sz, S, 27, 27, 70); bld(r[0], r[1], r[2], r[3], nh, { [nsF(sx)]: nf }, { uo: { E: 0.35 * i, W: 0.6 - 0.1 * i }, up: UP[i][2] });
      r = box(sx, sz, 27, 70, 30, 70); bld(r[0], r[1], r[2], r[3], Math.max(eh, nh) + 2, {}, { up: UP[i][3] });
    });
    // street-end buildings close the four arms (two painted murals, two tenements)
    bld(L, -S, 70, S, 14, { W: "P" }, { up: SKY ? 6 : 0 }); bld(-70, -S, -L, S, 13, { E: "G" }, { up: SKY ? 9 : 0 });
    bld(-S, -70, S, -L, 15, { S: "A" }, { uo: { S: 0.4 }, up: SKY ? 9 : 0 }); bld(-S, L, S, 70, 14, { N: "B" }, { uo: { N: 0.2 }, up: SKY ? 6 : 0 });
    // ---- awnings over shop doors (striped canvas, both sides) ----
    const awnT = (c1, c2) => canvasTex(128, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 16, 0, 16, h); } g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, h - 10, w, 10); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.beginPath(); g.arc(i * 16 + 8, h - 10, 8, 0, Math.PI); g.fill(); } });
    const AW = new Builder(), awM = [lam(awnT("#c8302a", "#f0e6d0"), { side: THREE.DoubleSide }), lam(awnT("#1e6a3a", "#e8e0c8"), { side: THREE.DoubleSide }), lam(awnT("#2a3a9a", "#e8e0c8"), { side: THREE.DoubleSide })];
    const awning = (x, z, f, w, mi) => { // f = which way the wall faces
      const d = 1.3, y0 = 3.3, y1 = 2.75, m = awM[mi % 3];
      if (f === "S") AW.quad(m, [x - w / 2, y1, z + d], [x + w / 2, y1, z + d], [x + w / 2, y0, z], [x - w / 2, y0, z], [[0, 0], [w / 2, 0], [w / 2, 1], [0, 1]]);
      if (f === "N") AW.quad(m, [x + w / 2, y1, z - d], [x - w / 2, y1, z - d], [x - w / 2, y0, z], [x + w / 2, y0, z], [[0, 0], [w / 2, 0], [w / 2, 1], [0, 1]]);
      if (f === "E") AW.quad(m, [x + d, y1, z + w / 2], [x + d, y1, z - w / 2], [x, y0, z - w / 2], [x, y0, z + w / 2], [[0, 0], [w / 2, 0], [w / 2, 1], [0, 1]]);
      if (f === "W") AW.quad(m, [x - d, y1, z - w / 2], [x - d, y1, z + w / 2], [x, y0, z + w / 2], [x, y0, z - w / 2], [[0, 0], [w / 2, 0], [w / 2, 1], [0, 1]]);
    };
    [[19, -S, "S", 4, 0], [36, -S, "S", 3.5, 1], [-17, -S, "S", 4, 2], [-34, -S, "S", 3.4, 0], [21, S, "N", 4, 2], [-22, S, "N", 4, 1], [38, S, "N", 3.4, 0],
      [S, -19, "E", 4, 1], [-S, -35, "W", 3.6, 0], [S, 34, "E", 3.6, 2], [-S, 20, "W", 4, 0], [-S, -18, "W", 3.6, 2], [S, 18, "E", 3.4, 0]]
      .forEach(([x, z, f, w, mi]) => awning(x, z, Math.abs(z) === CITY.S ? (z < 0 ? "S" : "N") : (x > 0 ? "W" : "E"), w, mi));
    // note: a wall on the north side of the E-W road faces south (+z): awnings at z=-S hang toward +z ("S")
    AW.build(G.street);
    // ---- neon signs sticking out from the walls (original text) ----
    const signs = [ // text, colour, rim, vertical, x, y, z, rotY
      ["PIZZA", "#ff4a3a", "#3aff6a", true, 15, 5.6, -S + 0.5, Math.PI / 2], ["ARCADE", "#3ae8ff", "#ff3ac8", false, 31, 4.3, -S + 0.06, 0],
      ["DINER", "#ff6ad8", "#3ae8ff", true, -15, 5.6, S - 0.5, Math.PI / 2], ["VIDEO", "#5aff8a", "#ff4ad0", false, -31, 4.3, S - 0.06, Math.PI],
      ["HOTEL", "#ff3a3a", "#ffd23a", true, S - 0.5, 6.2, 16, 0], ["DELI", "#ff4ad0", "#3aff8a", false, -S + 0.06, 4.3, 30, Math.PI / 2],
      ["KARATE", "#ffd23a", "#ff3a3a", true, -S + 0.5, 6.2, -16, 0], ["OPEN 24 HRS", "#ffe23a", "#ff3a3a", false, S - 0.06, 4.3, -31, -Math.PI / 2],
      ["BAR", "#ff3ac8", "#ffd23a", true, 33, 5.2, S - 0.5, Math.PI / 2], ["COMICS", "#ffb43a", "#3ae8ff", false, -36, 4.3, -S + 0.06, 0],
    ];
    for (const [t, c1, c2, vert, x, y, z, ry] of signs) {
      const w = vert ? 0.9 : 3.4, h = vert ? 3.6 : 1.06;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: neonTex(t, c1, c2, vert), side: THREE.DoubleSide, transparent: true }));
      if (HD) m.material.color.setScalar(2.6); // G: HDR neon -> bloom
      m.position.set(x, y, z); m.rotation.y = ry; G.street.add(m);
      if (SKY) { m.material.side = THREE.FrontSide; const bk = m.clone(); bk.rotation.y = ry + Math.PI; G.street.add(bk); } // D: two-sided signs read right way round from both sides
      const onZ = Math.abs(z) >= S - 0.6; WORLD.lights.push({ reg: "street", x: onZ ? x : x - Math.sign(x) * 1.6, y: 3.2, z: onZ ? z - Math.sign(z) * 1.6 : z, c: new THREE.Color(c1).getHex(), i: 14, d: 10 });
    }
    // ---- graffiti tags low on the walls (original) ----
    const tag = (txt, c1, c2) => canvasTex(512, 192, (g, w, h) => {
      g.font = "italic bold 92px Impact, Arial Black, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = 16; g.strokeStyle = "#101014"; g.strokeText(txt, w / 2, h / 2);
      const gr = g.createLinearGradient(0, 40, 0, 150); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillText(txt, w / 2, h / 2);
      g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.globalAlpha = 0.6; g.strokeText(txt, w / 2 - 2, h / 2 - 2);
    });
    for (const [t, c1, c2, x, z, ry] of [["SHELL SHOCK", "#5aff5a", "#1a9a2a", 24, -S + 0.03, 0], ["NYC '89", "#ff5ad0", "#7a2aff", -26, S - 0.03, Math.PI], ["RADICAL!", "#3ae8ff", "#1a5aff", S - 0.03, 24, -Math.PI / 2], ["3 A.M.", "#ffd23a", "#ff6a1a", -S + 0.03, -26, Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.35), new THREE.MeshLambertMaterial({ map: tag(t, c1, c2), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(x, 1.3, z); m.rotation.y = ry; G.street.add(m);
    }
    buildLamps(); buildProps(); buildRoofProps();
    buildCars(G.street, [ // parked along the curbs
      { src: "tex/taxi_side.webp", len: 5.0, w: 1.9, at: [[24, -5.7, 0], [-6.0 + 0.3, 27, -Math.PI / 2], [-30, 5.7, Math.PI]] },
      { src: "tex/van_side.webp", len: 5.6, w: 2.1, at: [[5.7, -30, Math.PI / 2]] },
    ]);
    // ---- sky: skyline panorama on a cylinder (D: a night-sky dome, the panorama faded into it, and a backdrop of distant towers) ----
    if (SKY) { SKYW.B.build(G.street); skyBackdrop(); skySky(G.street); }
    else {
    const skyT = tex("tex/skyline.jpg"); skyT.wrapS = THREE.RepeatWrapping; skyT.repeat.set(3, 1);
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(300, 300, 220, 32, 1, true), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.position.set(0, 70, 0); sky.renderOrder = -10; G.street.add(sky);
    }
    // ---- manholes with steam ----
    const coverT = canvasTex(128, 128, (g) => {
      g.fillStyle = "#1a1a1e"; g.beginPath(); g.arc(64, 64, 63, 0, 7); g.fill();
      const r = g.createRadialGradient(54, 50, 4, 64, 64, 60); r.addColorStop(0, "#6a6a72"); r.addColorStop(1, "#34343a"); g.fillStyle = r; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
      g.strokeStyle = "#202024"; g.lineWidth = 3; for (let i = -48; i <= 48; i += 12) { g.beginPath(); g.moveTo(16, 64 + i); g.lineTo(112, 64 + i); g.stroke(); g.beginPath(); g.moveTo(64 + i, 16); g.lineTo(64 + i, 112); g.stroke(); }
      g.strokeStyle = "#8a8a92"; g.lineWidth = 2; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.stroke();
      g.fillStyle = "#c8c8d0"; g.font = "bold 13px Arial"; g.textAlign = "center"; g.fillText("CITY SEWER", 64, 68);
    }, false, 2);
    const coverM = new THREE.MeshLambertMaterial({ map: coverT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    for (const [x, z] of [[2.5, 2], [26, -2.5], [-2, -30], [-24, 3]]) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), coverM); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); G.street.add(m);
      WORLD.steam.push({ x, z });
    }
    WORLD.lights.push({ reg: "street", x: 0, y: 12, z: 0, c: 0x9aa8ff, i: 20, d: 30 }); // moonlit crossing
    buildZones();
  }
  function buildLamps() {
    const R = CITY.R, pos = []; // [x, z, arm dx, arm dz] (arm points over the road)
    for (const d of [18, 36]) { pos.push([d, -R - 0.5, 0, 1], [-d + 6, R + 0.5, 0, -1], [R + 0.5, d - 4, -1, 0], [-R - 0.5, -d + 2, 1, 0]); }
    pos.push([R + 0.6, -R - 0.6, -0.7, 0.7], [-R - 0.6, R + 0.6, 0.7, -0.7], [-R - 0.6, -R - 0.6, 0.7, 0.7], [R + 0.6, R + 0.6, -0.7, -0.7]);
    const gs = [], heads = [];
    for (const [x, z, dx, dz] of pos) {
      const g = new THREE.CylinderGeometry(0.09, 0.14, 6, 8); g.translate(x, 3, z); gs.push(g);
      const base = new THREE.CylinderGeometry(0.2, 0.24, 0.5, 8); base.translate(x, 0.25, z); gs.push(base);
      const arm = new THREE.BoxGeometry(0.08, 0.08, 1.5); arm.rotateY(Math.atan2(dx, dz)); arm.translate(x + dx * 0.7, 5.9, z + dz * 0.7); gs.push(arm);
      const hx = x + dx * 1.4, hz = z + dz * 1.4;
      const h = new THREE.CylinderGeometry(0.16, 0.34, 0.22, 10); h.translate(hx, 5.84, hz); gs.push(h);
      const gl = new THREE.CircleGeometry(0.28, 10); gl.rotateX(Math.PI / 2); gl.translate(hx, 5.72, hz); heads.push(gl);
      WORLD.lights.push({ reg: "street", x: hx, y: 5.6, z: hz, c: 0xffc070, i: 26, d: 15 });
      WORLD.cols.push({ x, z, r: 0.25 });
    }
    WORLD.groups.street.add(new THREE.Mesh(mergeGeos(gs), lam(null, { color: 0x30343c, vertexColors: false })));
    const hm = new THREE.MeshBasicMaterial({ color: 0xffe0a0 }); if (HD) hm.color.multiplyScalar(4); // G: hot lamp heads bloom
    WORLD.groups.street.add(new THREE.Mesh(mergeGeos(heads), hm));
  }
  function buildProps() {
    const G = WORLD.groups;
    // painted hydrant cutouts (Live level-2 prop art), turned to the camera every frame
    const hyM = new THREE.MeshLambertMaterial({ map: tex("tex/props2.webp"), transparent: true, alphaTest: 0.4 });
    const hyG = new THREE.PlaneGeometry(0.55, 1.1); hyG.translate(0, 0.55, 0);
    { const uv = hyG.attributes.uv; const u0 = 0, u1 = 26 / 390, v0 = 0, v1 = 1 - 26 / 78; uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); }
    WORLD.hydrants = [];
    for (const [x, z] of [[13, -7.7], [-7.7, 14], [7.7, 22], [-20, 7.7], [30, 7.7]]) { const m = new THREE.Mesh(hyG, hyM); m.position.set(x, 0.14, z); G.street.add(m); WORLD.hydrants.push(m); WORLD.cols.push({ x, z, r: 0.3 }); }
    // dumpsters: painted steel box with a slanted lid and a tag
    const dumpT = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = "#1f5a34"; g.fillRect(0, 0, w, h); g.fillStyle = "#17462a"; for (let i = 0; i < w; i += 32) g.fillRect(i, 0, 6, h);
      g.fillStyle = "#0e2a1a"; g.fillRect(0, 0, w, 10); g.fillStyle = "rgba(120,60,20,0.5)"; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 10, 2 + Math.random() * 6);
      g.font = "italic bold 44px Impact, Arial"; g.fillStyle = "#ff5ad0"; g.fillText("TAG!", 70, 84); g.fillStyle = "#e8e8e8"; g.font = "bold 16px Arial"; g.fillText("NO DUMPING", 150, 112);
    });
    const dM = new THREE.MeshLambertMaterial({ map: dumpT }), lidM = new THREE.MeshLambertMaterial({ color: 0x14361f });
    for (const [x, z, ry] of [[40, -9.6, 0], [-9.6, -40, Math.PI / 2], [-40, 9.6, 0], [9.6, 39, Math.PI / 2]]) {
      const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.2), dM); m.position.y = 0.79; g.add(m);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.08, 1.3), lidM); lid.position.set(0, 1.5, -0.05); lid.rotation.x = -0.12; g.add(lid);
      for (const sx of [-0.9, 0.9]) for (const sz of [-0.45, 0.45]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), lidM); wh.rotation.x = Math.PI / 2; wh.position.set(sx, 0.12, sz); g.add(wh); }
      g.position.set(x, 0.0, z); g.rotation.y = ry; G.street.add(g);
      const ax = Math.abs(Math.cos(ry)), hl = 1.1 * ax + 0.6 * (1 - ax), hz = 0.6 * ax + 1.1 * (1 - ax);
      WORLD.cols.push({ box: [x - hl, z - hz, x + hl, z + hz] });
    }
    // newsstands: a green kiosk, magazine racks on the front, a NEWS header, a roof overhang
    const magT = canvasTex(256, 160, (g, w, h) => {
      g.fillStyle = "#1c3a24"; g.fillRect(0, 0, w, h); g.fillStyle = "#2a2a2a"; g.fillRect(8, 8, w - 16, h - 16);
      const cols = ["#e8302a", "#ffd23a", "#3a8aff", "#ff6ad8", "#5aff8a", "#ffffff", "#ff8c1a", "#9b3fe0"];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) { const x = 14 + c * 33, y = 14 + r * 47; g.fillStyle = cols[(r * 7 + c * 3) % 8]; g.fillRect(x, y, 28, 40); g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(x + 3, y + 4, 22, 6); g.fillStyle = "rgba(255,255,255,0.7)"; g.fillRect(x + 4, y + 26, 18, 2); g.fillRect(x + 4, y + 31, 14, 2); }
    });
    const hdrT = canvasTex(256, 48, (g, w, h) => { g.fillStyle = "#14361f"; g.fillRect(0, 0, w, h); g.fillStyle = "#ffe23a"; g.font = "bold 34px Arial Black, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("NEWS", w / 2, h / 2 + 2); });
    const kM = new THREE.MeshLambertMaterial({ color: 0x1e4a2a }), magM = new THREE.MeshLambertMaterial({ map: magT }), hM = new THREE.MeshBasicMaterial({ map: hdrT }), rfM = new THREE.MeshLambertMaterial({ color: 0x0f2a18 });
    for (const [x, z, ry] of [[-18, -8.8, 0], [8.8, 30, -Math.PI / 2], [17, 8.8, Math.PI]]) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 1.4), kM); body.position.y = 1.19; g.add(body);
      const front = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), magM); front.position.set(0, 1.1, 0.71); g.add(front);
      const hdr = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), hM); hdr.position.set(0, 2.45, 0.92); hdr.rotation.x = -0.1; g.add(hdr);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 2.0), rfM); roof.position.set(0, 2.3, 0.2); g.add(roof);
      g.position.set(x, 0.14, z); g.rotation.y = ry; G.street.add(g);
      const ax = Math.abs(Math.cos(ry)), hl = 1.3 * ax + 0.8 * (1 - ax), hz = 0.8 * ax + 1.3 * (1 - ax);
      WORLD.cols.push({ box: [x - hl, z - hz, x + hl, z + hz] });
      WORLD.lights.push({ reg: "street", x: x, y: 2.0, z: z, c: 0xfff0c0, i: 8, d: 6 });
    }
  }
  function buildRoofProps() {
    const G = WORLD.groups;
    const woodT = canvasTex(256, 128, (g, w, h) => {
      for (let i = 0; i < 32; i++) { const v = 70 + (Math.random() * 30 | 0); g.fillStyle = `rgb(${v + 20},${v - 8},${v - 30})`; g.fillRect(i * 8, 0, 8, h); g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(i * 8, 0, 1, h); }
      g.fillStyle = "#2a2a30"; for (const y of [12, 50, 88, 118]) g.fillRect(0, y, w, 5);
    }, true);
    const barrel = [], cones = [], legs = [], acs = [];
    const top = (x, z) => { for (const b of WORLD.blds) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return b; return null; };
    for (const [x, z] of SKY ? [[33, -15], [-33, 15], [15, 33], [-15, -33], [52, -14.5], [-52, 14.5], [14.5, 52], [-14.5, -52], [20, -20], [-21, 19], [40, -40], [-40, 40], [56, 56], [-56, -56], [60, 6], [-60, -6], [6, -60], [-6, 60]] : [[20, -20], [-20, -36], [36, 20], [-21, 19], [32, -36]]) {
      const b = top(x, z); if (!b) continue; const y = b.h - 0.7;
      const br = new THREE.CylinderGeometry(1.7, 1.8, 3.4, 16, 1, true); br.translate(x, y + 3.6 + 1.7, z); barrel.push(br);
      const c = new THREE.ConeGeometry(1.95, 1.3, 16); c.translate(x, y + 3.6 + 3.4 + 0.65, z); cones.push(c);
      for (const [dx, dz] of [[1.3, 1.3], [-1.3, 1.3], [1.3, -1.3], [-1.3, -1.3]]) { const l = new THREE.BoxGeometry(0.16, 3.6, 0.16); l.translate(x + dx, y + 1.8, z + dz); legs.push(l); }
      const pl = new THREE.BoxGeometry(3.2, 0.14, 3.2); pl.translate(x, y + 3.6, z); legs.push(pl);
      b.extra = (b.extra || 0) + 1;
    }
    for (const [x, z] of [[16, -15], [-24, -14], [14, 24], [-15, 15], [34, -16], [-36, 15], [15, -36], [-16, 36]]) {
      const b = top(x, z); if (!b) continue; const a = new THREE.BoxGeometry(1.6, 1.1, 1.2); a.translate(x, b.h - 0.7 + 0.55, z); acs.push(a);
    }
    const acM = new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = "#8a8e96"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#4a4e56"; for (let i = 6; i < 60; i += 6) g.fillRect(4, i, 56, 2); g.strokeStyle = "#2a2e36"; g.lineWidth = 3; g.strokeRect(1, 1, 62, 62); }) });
    if (barrel.length) {
      G.street.add(new THREE.Mesh(mergeGeos(barrel), new THREE.MeshLambertMaterial({ map: woodT })));
      G.street.add(new THREE.Mesh(mergeGeos(cones), new THREE.MeshLambertMaterial({ color: 0x3a3a42 })));
      G.street.add(new THREE.Mesh(mergeGeos(legs), new THREE.MeshLambertMaterial({ color: 0x1e2026 })));
    }
    if (acs.length) G.street.add(new THREE.Mesh(mergeGeos(acs), acM));
    if (SKY) skyRoofs(top);
  }
  // ---- vehicles: extruded side silhouettes with the painted side art (from Shell Shock 3D) ----
  function buildCars(group, defs) {
    for (const D of defs) {
      const img = new Image(); img.src = D.src;
      for (const [x, z, ry] of D.at) { const ax = Math.abs(Math.cos(ry)), hl = D.len / 2 * ax + D.w / 2 * (1 - ax), hz = D.w / 2 * ax + D.len / 2 * (1 - ax); WORLD.cols.push({ box: [x - hl, z - hz, x + hl, z + hz] }); WORLD.cars.push({ x0: x - hl, z0: z - hz, x1: x + hl, z1: z + hz, h: 1.9 }); }
      img.onload = () => {
        const shp = silhouetteShape(img, 0.985), asp = img.height / img.width;
        const geo = new THREE.ExtrudeGeometry(shp, { depth: 1, bevelEnabled: false, curveSegments: 1 });
        { const pos = geo.attributes.position, uv = geo.attributes.uv, g1 = geo.groups.find((g) => g.materialIndex === 1);
          if (g1) for (let i = g1.start; i < g1.start + g1.count; i++) { const vi = geo.index ? geo.index.getX(i) : i; uv.setXY(vi, pos.getX(vi), pos.getY(vi) - 0.03); }
          uv.needsUpdate = true; }
        geo.translate(-0.5, 0, -0.5); geo.scale(D.len, D.len * asp, D.w);
        const t = tex(D.src); const cap = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5 }); const sideM = new THREE.MeshLambertMaterial({ map: t, color: 0x9a9aa0 });
        for (const [x, z, ry] of D.at) { const m = new THREE.Mesh(geo, [cap, sideM]); m.position.set(x, 0, z); m.rotation.y = ry; group.add(m); }
      };
    }
  }
  WORLD.cars = [];
  function buildDecor() {}
  // ---------- the combat frame: ONE zone covers the whole crossing. The reused 16-bit combat runs in a 2D frame (x along u, y across v);
  // the frame's axis follows the camera's screen-right (snapped to the nearest street axis) so fights always read left/right on screen.
  const FRAMES = [{ O: [-CITY.L, CITY.L], u: [1, 0], v: [0, 1] }, { O: [CITY.L, CITY.L], u: [0, -1], v: [1, 0] }];
  function buildZones() {
    const L = CITY.L - 0.4, S = CITY.S - 0.4;
    const z = { id: "x", layer: "street", reg: "street", rects: [[-L, -S, L, S], [-S, -L, S, L]], ents: { enemies: [], props: [], items: [], stars: [] }, locks: [],
      depth: CITY.L * 2, cam: { a: 0, dist: 8, h: 3, fov: 50 }, box: [-200, -200, 200, 200, 99], frame: 0 };
    z.FB = 215; z.FT = 215 - z.depth / DY; z.len = (CITY.L * 2) / PX;
    Object.assign(z, { O: FRAMES[0].O.slice(), u: FRAMES[0].u.slice(), v: FRAMES[0].v.slice() });
    WORLD.zones = [z];
  }
  const zoneById = () => WORLD.zones[0];
  function toLocal(z, gx, gz) {
    const dx = gx - z.O[0], dz = gz - z.O[1];
    return { x: (dx * z.u[0] + dz * z.u[1]) / PX, y: z.FB + (dx * z.v[0] + dz * z.v[1]) / DY };
  }
  function toGlobal(z, x, y) {
    const a = x * PX, b = (y - z.FB) * DY;
    return { gx: z.O[0] + z.u[0] * a + z.v[0] * b, gz: z.O[1] + z.u[1] * a + z.v[1] * b };
  }
  function floorAt(layer, gx, gz) {
    if (layer !== "street") return null;
    let ok = false; for (const r of WORLD.zones[0].rects) if (gx >= r[0] && gx <= r[2] && gz >= r[1] && gz <= r[3]) ok = true;
    if (!ok) return null;
    for (const [x0, z0, x1, z1] of WORLD.walks) if (gx >= x0 && gx <= x1 && gz >= z0 && gz <= z1) return 0.14;
    return 0;
  }
  // ---------- per-frame decor: steam, particles, building fade ----------
  function stepDecor(dt) {
    for (const f of WORLD.anim) f();
    for (const s of WORLD.steam) for (let q = 0; q < 2; q++) if (Math.random() < 0.35) PART.street.emit(s.x + rnd(-0.3, 0.3), 0.1, s.z + rnd(-0.3, 0.3), rnd(-0.15, 0.25), rnd(0.8, 1.4), rnd(-0.1, 0.1), rnd(2.0, 3.2), rnd(0.25, 0.45), 0.45, 0.8, 0.82, 0.9, 0.13);
    if (SKY) skySteam(dt);
    PART.street.step(dt); PART.glow.step(dt); PART.fx.step(dt); PART.fxg.step(dt);
    for (const b of WORLD.blds) {
      const want = b.want === undefined ? 1 : b.want; b.fade += (want - b.fade) * Math.min(1, dt * 8);
      const a = b.fade, tr = a < 0.98;
      for (const m of b.mats) { if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = a; m.depthWrite = a > 0.6; }
      b.grp.visible = a > 0.04;
    }
  }
  function updateArrows() {}
  // segment (a -> b, 3D) vs building boxes: returns the smallest hit fraction (1 = clear)
  function segHit(ax, ay, az, bx, by, bz, pad, list) {
    let best = 1;
    for (const b of list || WORLD.blds) {
      let t0 = 0, t1 = 1; const P = [[ax, bx, b.x0 - pad, b.x1 + pad], [ay, by, -1, b.h + pad], [az, bz, b.z0 - pad, b.z1 + pad]];
      let ok = true;
      for (const [s, e, lo, hi] of P) {
        const d = e - s;
        if (Math.abs(d) < 1e-9) { if (s < lo || s > hi) { ok = false; break; } continue; }
        let u0 = (lo - s) / d, u1 = (hi - s) / d; if (u0 > u1) { const q = u0; u0 = u1; u1 = q; }
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }
