  // ---------- decor (new): manholes + steam, the burning building, fire escapes, ladders, neon, graffiti, hydrants ----------
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
  // ---- flame sprite sheet (procedural, 4 frames) ----
  const FLAME_T = canvasTex(256, 128, (g) => {
    g.filter = "blur(2.5px)";
    for (let f = 0; f < 4; f++) {
      const cx = f * 64 + 32;
      for (let layer = 0; layer < 4; layer++) {
        const cols = ["rgba(200,40,10,0.55)", "rgba(255,110,20,0.7)", "rgba(255,190,60,0.8)", "rgba(255,245,190,0.9)"];
        g.fillStyle = cols[layer]; const s = 1 - layer * 0.22;
        g.beginPath(); g.moveTo(cx - 26 * s, 126);
        for (let i = 0; i <= 10; i++) { const k = i / 10, w = Math.sin(k * Math.PI) * 26 * s, y = 126 - k * (110 * s) - Math.sin(f * 1.7 + i * 1.3) * 6; g.lineTo(cx - w + Math.sin(f + i) * 3, y); }
        g.lineTo(cx + Math.sin(f * 2.1) * 6, 126 - 122 * s);
        for (let i = 10; i >= 0; i--) { const k = i / 10, w = Math.sin(k * Math.PI) * 26 * s, y = 126 - k * (110 * s) - Math.cos(f * 1.3 + i * 1.1) * 6; g.lineTo(cx + w + Math.cos(f + i) * 3, y); }
        g.closePath(); g.fill();
      }
    }
  });
  FLAME_T.repeat.set(0.25, 1);
  function flameMesh(group, x, y, z, w, h, rotY) {
    const t = FLAME_T.clone(); t.needsUpdate = true; t.repeat.set(0.25, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.geometry.translate(0, h / 2, 0); m.position.set(x, y, z); m.rotation.y = rotY || 0; m.renderOrder = 4; group.add(m);
    const ph = Math.random() * 10;
    WORLD.anim.push((tt) => { t.offset.x = (Math.floor(tt * 12 + ph) % 4) * 0.25; m.scale.y = 0.85 + 0.2 * Math.sin(tt * 9 + ph); });
    return m;
  }
  function buildDecor() {
    const G = WORLD.groups;
    PART.street = new Particles(420, false, G.street); PART.glow = new Particles(260, true, G.street);
    PART.sewer = new Particles(160, false, G.sewer); PART.sglow = new Particles(160, true, G.sewer);
    PART.fx = new Particles(300, false, G.street); PART.fxg = new Particles(300, true, G.street);
    PART.sfx = new Particles(200, false, G.sewer); PART.sfxg = new Particles(200, true, G.sewer);
    // ---- manhole covers (round iron, top-down) ----
    const coverT = canvasTex(128, 128, (g) => {
      g.fillStyle = "#1a1a1e"; g.beginPath(); g.arc(64, 64, 63, 0, 7); g.fill();
      const r = g.createRadialGradient(54, 50, 4, 64, 64, 60); r.addColorStop(0, "#6a6a72"); r.addColorStop(1, "#34343a"); g.fillStyle = r; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
      g.strokeStyle = "#202024"; g.lineWidth = 3; for (let i = -48; i <= 48; i += 12) { g.beginPath(); g.moveTo(16, 64 + i); g.lineTo(112, 64 + i); g.stroke(); g.beginPath(); g.moveTo(64 + i, 16); g.lineTo(64 + i, 112); g.stroke(); }
      g.strokeStyle = "#8a8a92"; g.lineWidth = 2; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.stroke();
      g.fillStyle = "#c8c8d0"; g.font = "bold 13px Arial"; g.textAlign = "center"; g.fillText("N.Y.C. SEWER", 64, 68);
    });
    const coverM = new THREE.MeshLambertMaterial({ map: coverT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    WORLD.manholes = [[34, 2.0, 1], [162, -94.2, 1], [80, -2.5, 0], [122, 3, 0], [161, -30, 0], [158, -74, 0], [149, -168, 0], [8, -1, 0]];
    for (const [x, z, use] of WORLD.manholes) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), coverM); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); G.street.add(m);
      WORLD.steam.push({ x, z, use, k: Math.random() * 10 });
    }
    // ---- the burning building (block 1 north, x 53..81.6): flames in the windows, embers, smoke, flicker light ----
    const FB = { x0: 53, x1: 81.6, z: -11, h: 16 };
    const wins = [[0.13, 0.62], [0.25, 0.78], [0.39, 0.62], [0.54, 0.79], [0.6, 0.45], [0.78, 0.62], [0.88, 0.78], [0.12, 0.43], [0.4, 0.27], [0.71, 0.27]];
    for (const [fx0, fy] of wins) flameMesh(G.street, FB.x0 + fx0 * (FB.x1 - FB.x0), fy * FB.h - 0.6, FB.z + 0.25, 1.6, 2.4);
    for (const fx0 of [0.42, 0.52, 0.62, 0.93]) flameMesh(G.street, FB.x0 + fx0 * (FB.x1 - FB.x0), 0.1, FB.z + 0.3, 2.2, 3.2);
    WORLD.fires.push({ x0: FB.x0, x1: FB.x1, z: FB.z, h: FB.h });
    WORLD.lights.push({ reg: "street", x: 67, y: 5, z: -7, c: 0xff7020, i: 60, d: 22, flick: 2, fire: true });
    WORLD.lights.push({ reg: "street", x: 60, y: 11, z: -9, c: 0xff5010, i: 30, d: 16, flick: 2 });
    // fire-escape structure + full-height ladder on the roof-1 building (x 91..99), and a ladder on the corner building
    const grate = canvasTex(64, 64, (g) => { g.fillStyle = "rgba(0,0,0,0)"; g.clearRect(0, 0, 64, 64); g.strokeStyle = "#2a2c32"; g.lineWidth = 4; for (let i = 0; i <= 64; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); } g.lineWidth = 6; g.strokeRect(0, 0, 64, 64); }, true);
    const rail = canvasTex(64, 64, (g) => { g.clearRect(0, 0, 64, 64); g.fillStyle = "#24262c"; g.fillRect(0, 0, 64, 6); g.fillRect(0, 58, 64, 6); for (let i = 0; i < 64; i += 8) g.fillRect(i, 0, 3, 64); }, true);
    const gM = new THREE.MeshLambertMaterial({ map: grate, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const rM = new THREE.MeshLambertMaterial({ map: rail, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const FE = new Builder();
    for (const y of [3.4, 6.6, 9.8]) {
      FE.floor(gM, 90.5, -11, 97, -9.8, y, 1.2);
      FE.wall(rM, 90.5, -9.8, 97, -9.8, y, y + 1, 0, 0, 6.5, 1); FE.wall(rM, 90.5, -11, 90.5, -9.8, y, y + 1, 0, 0, 1.2, 1);
    }
    for (const [y0, y1] of [[3.4, 6.6], [6.6, 9.8]]) FE.quad(gM, [91.2, y0, -10.6], [95.8, y1, -10.6], [95.8, y1, -10.1], [91.2, y0, -10.1], [[0, 0], [5, 0], [5, 0.5], [0, 0.5]]);
    FE.build(G.street);
    const ladT = tex("tex/props3.webp");
    const ladM = new THREE.MeshLambertMaterial({ map: ladT, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const lu0 = 115 / 1024, lu1 = 175 / 1024, lv0 = 0, lv1 = 1 - 272 / 722;
    const LB = new Builder();
    const ladder = (x, z, y0, y1, face) => { // face: "S" = on a south-facing wall, "E" = on an east-facing wall
      for (let y = y0; y < y1; y += 3.75) {
        const ya = y, yb = Math.min(y1, y + 3.75), vv = lv0 + (lv1 - lv0) * ((yb - ya) / 3.75);
        if (face === "S") LB.wall(ladM, x - 0.3, z, x + 0.3, z, ya, yb, lu0, lv0, lu1, vv);
        else LB.wall(ladM, x, z + 0.3, x, z - 0.3, ya, yb, lu0, lv0, lu1, vv);
      }
    };
    ladder(97.6, -10.55, 0, 15.2, "S");
    ladder(150.12, -25, 0, 17.1, "E");
    LB.build(G.street);
    const SB = new Builder();
    for (const [x, z, f] of [[34, 2.95, "N"], [162, -95.95, "S"]]) {
      for (let y = WORLD.SY; y < WORLD.SC + 0.01; y += 3.75) {
        const yb = Math.min(WORLD.SC, y + 3.75), vv = lv0 + (lv1 - lv0) * ((yb - y) / 3.75);
        if (f === "N") SB.wall(ladM, x + 0.3, z, x - 0.3, z, y, yb, lu0, lv0, lu1, vv); else SB.wall(ladM, x - 0.3, z, x + 0.3, z, y, yb, lu0, lv0, lu1, vv);
      }
    }
    SB.build(G.sewer);
    // light shafts down the manhole ladders + drips
    for (const [x, z] of [[34, 2.3], [162, -95.3]]) {
      const shaft = new THREE.Mesh(new THREE.CircleGeometry(0.62, 16), new THREE.MeshBasicMaterial({ color: 0x9aa8c8, transparent: true, opacity: 0.35 }));
      shaft.rotation.x = Math.PI / 2; shaft.position.set(x, WORLD.SC - 0.01, z); G.sewer.add(shaft);
    }
    // ---- neon signs that stick out from the walls (original text), glowing additive ----
    const neon = (txt, c1, c2, vertical, w, h) => canvasTex(vertical ? 128 : 512, vertical ? 512 : 160, (g, cw, ch) => {
      g.fillStyle = "rgba(10,6,16,0.92)"; g.fillRect(6, 6, cw - 12, ch - 12);
      g.shadowColor = c2; g.shadowBlur = 22; g.strokeStyle = c2; g.lineWidth = 6; g.strokeRect(14, 14, cw - 28, ch - 28);
      g.fillStyle = c1; g.shadowColor = c1; g.shadowBlur = 26; g.textAlign = "center"; g.textBaseline = "middle";
      if (vertical) { g.font = "bold 84px Arial Black, Arial"; const L = txt.split(""); L.forEach((ch2, i) => g.fillText(ch2, cw / 2, 70 + i * ((ch - 120) / Math.max(1, L.length - 1)))); }
      else { g.font = "bold " + (txt.length > 9 ? 64 : 86) + "px Arial Black, Arial"; g.fillText(txt, cw / 2, ch / 2 + 4); }
    });
    const signs = [ // text, colours, vertical, x, y, z, rotY, w, h
      ["PIZZA", "#ff4a3a", "#3aff6a", true, 18.5, 5.5, -10.4, Math.PI / 2],
      ["ARCADE", "#3ae8ff", "#ff3ac8", false, 44, 4.4, -10.7, 0],
      ["BAR", "#ff3ac8", "#ffd23a", true, 86, 5, -10.4, Math.PI / 2],
      ["OPEN 24 HRS", "#ffe23a", "#ff3a3a", false, 113, 3.8, -10.75, 0],
      ["DINER", "#ff6ad8", "#3ae8ff", true, 33, 5.5, 10.4, Math.PI / 2],
      ["VIDEO", "#5aff8a", "#ff4ad0", false, 98, 4, 10.75, Math.PI],
      ["HOTEL", "#ff3a3a", "#ffd23a", true, 150.6, 6, -60, 0],
      ["CHECK CASHED", "#3ae8ff", "#ffe23a", false, 171.25, 3.8, -88, -Math.PI / 2],
      ["DELI", "#ff4ad0", "#3aff8a", false, 150.75, 3.8, -122, Math.PI / 2],
      ["KARATE", "#ffd23a", "#ff3a3a", true, 171.4, 6.5, -45, 0],
    ];
    for (const [t, c1, c2, vert, x, y, z, ry] of signs) {
      const w = vert ? 0.9 : 3.4, h = vert ? 3.6 : 1.06;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: neon(t, c1, c2, vert), side: THREE.DoubleSide, transparent: true }));
      m.position.set(x, y, z); m.rotation.y = ry; G.street.add(m);
      WORLD.signs.push(m);
    }
    // ---- graffiti on the street-level walls (original tags) ----
    const tag = (txt, c1, c2) => canvasTex(512, 192, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.font = "italic bold 92px Impact, Arial Black, Arial"; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineJoin = "round"; g.lineWidth = 16; g.strokeStyle = "#101014"; g.strokeText(txt, w / 2, h / 2);
      const gr = g.createLinearGradient(0, 40, 0, 150); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillText(txt, w / 2, h / 2);
      g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.globalAlpha = 0.6; g.strokeText(txt, w / 2 - 2, h / 2 - 2);
      g.globalAlpha = 0.5; g.fillStyle = c1; for (let i = 0; i < 6; i++) g.fillRect(60 + Math.random() * 390, 130 + Math.random() * 20, 3, 20 + Math.random() * 30);
    });
    const tags = [["SHELL SHOCK", "#5aff5a", "#1a9a2a", 6, -10.97, 0], ["NYC '89", "#ff5ad0", "#7a2aff", 49, 10.97, Math.PI], ["3 A.M.", "#ffd23a", "#ff6a1a", 124, -10.97, 0],
      ["RADICAL!", "#3ae8ff", "#1a5aff", 150.03, -100, Math.PI / 2], ["HALF SHELL", "#ff4a3a", "#ffd23a", 171.97, -128, -Math.PI / 2], ["SEWER CREW", "#7aff4a", "#2a8a2a", 60, -2.97, 0]];
    for (const [t, c1, c2, x, z, ry] of tags) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.35), new THREE.MeshLambertMaterial({ map: tag(t, c1, c2), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      const sewer = t === "SEWER CREW";
      m.position.set(x, sewer ? WORLD.SY + 1.6 : 1.3, z); m.rotation.y = ry; (sewer ? G.sewer : G.street).add(m);
    }
    // ---- painted hydrants (Live level-2 prop cutout) + dumpsters ----
    const pr2 = tex("tex/props2.webp");
    const hyM = new THREE.MeshLambertMaterial({ map: pr2, transparent: true, alphaTest: 0.4 });
    const hyG = new THREE.PlaneGeometry(0.55, 1.1); hyG.translate(0, 0.55, 0);
    { const uv = hyG.attributes.uv; const u0 = 0 / 390, u1 = 26 / 390, v0 = 1 - 78 / 78, v1 = 1 - 26 / 78; uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); }
    WORLD.hydrants = [];
    for (const [x, z] of [[28, -7.6], [92, 7.6], [153.6, -40], [168.4, -110], [12, 7.6]]) { const m = new THREE.Mesh(hyG, hyM); m.position.set(x, 0.14, z); G.street.add(m); WORLD.hydrants.push(m); WORLD.cols.push({ x, z, r: 0.3 }); }
    const dumpT = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = "#1f5a34"; g.fillRect(0, 0, w, h); g.fillStyle = "#17462a"; for (let i = 0; i < w; i += 32) g.fillRect(i, 0, 6, h);
      g.fillStyle = "#0e2a1a"; g.fillRect(0, 0, w, 10); g.fillStyle = "rgba(120,60,20,0.5)"; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 10, 2 + Math.random() * 6);
      g.font = "italic bold 44px Impact, Arial"; g.fillStyle = "#ff5ad0"; g.fillText("TAG!", 70, 84); g.fillStyle = "#e8e8e8"; g.font = "bold 16px Arial"; g.fillText("NO DUMPING", 150, 112);
    });
    const dM = new THREE.MeshLambertMaterial({ map: dumpT });
    for (const [x, z, ry] of [[104.4, -9.6, 0], [131, -183, 0.3], [166, -160, 1.2], [44, 9.3, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.2), dM); m.position.set(x, 0.79, z); m.rotation.y = ry; G.street.add(m);
      WORLD.cols.push({ x, z, r: 1.1 });
    }
    // lot: burning trash barrel, rubble
    flameMesh(G.street, 136, 1.0, -176, 1.1, 1.4); flameMesh(G.street, 136, 1.0, -176, 1.1, 1.4, Math.PI / 2);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 12), new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = "#3a2a22"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#6a3a1a"; for (let i = 0; i < 20; i++) g.fillRect(Math.random() * 64, Math.random() * 64, 6, 3); g.fillStyle = "#1a1a1a"; g.fillRect(0, 10, 64, 4); g.fillRect(0, 50, 64, 4); }) }));
    bar.position.set(136, 0.5, -176); G.street.add(bar); WORLD.cols.push({ x: 136, z: -176, r: 0.55 });
    WORLD.lights.push({ reg: "street", x: 136, y: 2.0, z: -176, c: 0xff7a2a, i: 24, d: 12, flick: 2, fire: true });
    WORLD.lights.push({ reg: "street", x: 150, y: 9, z: -168, c: 0xa0b0ff, i: 55, d: 34 });
    WORLD.lights.push({ reg: "street", x: 166, y: 6, z: -180, c: 0xffd8a0, i: 40, d: 22 });
    WORLD.lights.push({ reg: "street", x: 140, y: 6, z: -156, c: 0xff60c0, i: 30, d: 18 });
    // interact points: manholes + ladders
    WORLD.inter = [
      { layer: "street", x: 34, z: 2.0, r: 1.3, kind: "drop", label: "DROP INTO THE SEWER", to: { layer: "sewer", x: 34, z: 1.6 } },
      { layer: "sewer", x: 34, z: 2.4, r: 1.3, kind: "up", label: "CLIMB UP", to: { layer: "street", x: 34, z: 2.0 } },
      { layer: "street", x: 162, z: -94.2, r: 1.3, kind: "drop", label: "DROP INTO THE SEWER", to: { layer: "sewer", x: 162, z: -94.6 } },
      { layer: "sewer", x: 162, z: -95, r: 1.3, kind: "up", label: "CLIMB UP", to: { layer: "street", x: 162, z: -94.2 } },
      { layer: "street", x: 97.6, z: -10.2, r: 1.5, kind: "climb", label: "CLIMB THE FIRE ESCAPE", lx: 97.6, lz: -10.25, top: 15.0, to: { layer: "roof", x: 97.6, z: -12.6 } },
      { layer: "roof", x: 97.6, z: -12.2, r: 1.4, kind: "down", label: "CLIMB DOWN", lx: 97.6, lz: -10.25, top: 15.0, to: { layer: "street", x: 97.6, z: -9.9 } },
      { layer: "roof", x: 148.8, z: -25, r: 1.4, kind: "down", label: "CLIMB DOWN", lx: 150.4, lz: -25, top: 17.0, to: { layer: "street", x: 151.3, z: -25 } },
      { layer: "street", x: 151.2, z: -25, r: 1.5, kind: "climb", label: "CLIMB TO THE ROOFS", lx: 150.4, lz: -25, top: 17.0, to: { layer: "roof", x: 148.6, z: -25 } },
    ];
    buildInterior();
    buildSubway();
  }
  // ---- the walk-in building: a lobby inside the corner building, with an elevator to roof 3 ----
  function buildInterior() {
    const G = WORLD.groups, I = new Builder(), L = { x0: 131.2, x1: 146.8, z0: -23.6, z1: -11.2, h: 4.2 };
    const lob = lam(tex("tex/lobby_wall.jpg")), lobR = lam(tex("tex/lobby_wall.jpg"));
    WORLD.lobby = L;
    I.wall(lob, L.x0, L.z0, L.x1, L.z0, 0, L.h, 0.0, 0, 1.0, 1); // back wall (mailboxes, elevator) faces +z
    const tileU = [0.02, 0.29]; // plain tile run of the same painting, repeated along the side walls
    for (let z = L.z1; z > L.z0 + 0.01; z -= 4.1) { const z2 = Math.max(L.z0, z - 4.1), k = (z - z2) / 4.1;
      I.wall(lobR, L.x0, z, L.x0, z2, 0, L.h, tileU[0], 0, tileU[0] + (tileU[1] - tileU[0]) * k, 1, [0.85, 0.85, 0.85]);
      I.wall(lobR, L.x1, z2, L.x1, z, 0, L.h, tileU[0], 0, tileU[0] + (tileU[1] - tileU[0]) * k, 1, [0.85, 0.85, 0.85]); }
    for (let x = L.x0; x < L.x1 - 0.01; x += 4.1) { const x2 = Math.min(L.x1, x + 4.1), k = (x2 - x) / 4.1;
      I.wall(lobR, x2, L.z1, x, L.z1, 0, L.h, tileU[0], 0, tileU[0] + (tileU[1] - tileU[0]) * k, 1, [0.7, 0.7, 0.7]); }
    const floorT = canvasTex(128, 128, (g) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#d8d2b8" : "#2c5a46"; g.fillRect(i * 32, j * 32, 32, 32); }
      g.fillStyle = "rgba(40,30,20,0.25)"; for (let i = 0; i < 60; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 8, 1 + Math.random() * 3); }, true);
    I.floor(lam(floorT), L.x0, L.z0, L.x1, L.z1, 0.005, 2.4);
    const ceilT = canvasTex(128, 128, (g) => { g.fillStyle = "#3a3a36"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "#2a2a26"; g.lineWidth = 2; for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); } }, true);
    I.floor(lam(ceilT), L.x0, L.z0, L.x1, L.z1, L.h, 2.4, [0.8, 0.8, 0.8], true);
    I.build(G.inside);
    // fluorescent tubes (emissive) + their lights, a flickering one by the mailboxes
    const tubeM = new THREE.MeshBasicMaterial({ color: 0xe8fff0 });
    for (const [x, z] of [[135, -15], [142, -15], [135, -20.5], [142, -20.5]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.18), tubeM); m.position.set(x, L.h - 0.05, z); G.inside.add(m); }
    WORLD.lights.push({ reg: "inside", x: 138.5, y: 3.6, z: -15, c: 0xd8ffe8, i: 22, d: 12 });
    WORLD.lights.push({ reg: "inside", x: 134, y: 3.6, z: -20.5, c: 0xd8ffe0, i: 16, d: 9, flick: 1 });
    WORLD.lights.push({ reg: "inside", x: 141.2, y: 3.0, z: -22.4, c: 0xffd08a, i: 18, d: 8 });
    WORLD.lights.push({ reg: "inside", x: 140, y: 2.0, z: -12.2, c: 0xff7a40, i: 10, d: 7, flick: 2, fire: true }); // street fire glow through the door
    // the street door on block 1 (glass doors + lit transom), and the roof-3 elevator bulkhead
    const doorT = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#3a2a20"; g.fillRect(0, 0, w, h); g.fillStyle = "#ffcf7a"; g.fillRect(14, 70, 106, 180); g.fillRect(136, 70, 106, 180);
      g.fillStyle = "rgba(60,40,20,0.35)"; for (let i = 0; i < 8; i++) g.fillRect(14, 70 + i * 24, 228, 3);
      g.fillStyle = "#c8a040"; g.fillRect(118, 70, 20, 180); g.fillStyle = "#1a1210"; g.fillRect(0, 0, w, 62);
      g.shadowColor = "#3ae8ff"; g.shadowBlur = 16; g.fillStyle = "#7ff4ff"; g.font = "bold 44px Arial Black, Arial"; g.textAlign = "center"; g.fillText("APTS 7-49", w / 2, 46);
    });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.9), new THREE.MeshBasicMaterial({ map: doorT })); door.position.set(140, 1.45 + 0.14, -10.97); G.street.add(door);
    WORLD.lights.push({ reg: "street", x: 140, y: 2.2, z: -9.8, c: 0xffc070, i: 14, d: 7 });
    const BH = { x0: 139.4, x1: 143, z0: -31.4, z1: -28.6, y: 16, h: 3.1 }; WORLD.bulk = BH;
    const BB = new Builder(), bm = lam(tex("tex/facade_b.jpg", true), { color: 0x9a9090 });
    BB.wall(bm, BH.x1, BH.z0, BH.x0, BH.z0, BH.y, BH.y + BH.h, 0, 0.55, 0.4, 0.8); BB.wall(bm, BH.x1, BH.z1, BH.x1, BH.z0, BH.y, BH.y + BH.h, 0, 0.55, 0.3, 0.8); BB.wall(bm, BH.x0, BH.z0, BH.x0, BH.z1, BH.y, BH.y + BH.h, 0, 0.55, 0.3, 0.8);
    BB.wall(bm, BH.x0, BH.z1, BH.x1, BH.z1, BH.y, BH.y + BH.h, 0, 0.55, 0.4, 0.8);
    BB.wall(lob, 140.15, BH.z1 + 0.02, 142.25, BH.z1 + 0.02, BH.y, BH.y + 2.5, 0.548, 0.12, 0.738, 0.86); // the same brass elevator doors
    BB.floor(M_roofCap(), BH.x0, BH.z0, BH.x1, BH.z1, BH.y + BH.h, 3);
    BB.build(G.roof);
    WORLD.cols.push({ box: [BH.x0, BH.z0, BH.x1, BH.z1], y: 16 });
    WORLD.lights.push({ reg: "roof", x: 141.2, y: 18.6, z: -27.6, c: 0xffd08a, i: 12, d: 7 });
    const lampM = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })); lampM.position.set(141.2, 18.75, -28.45); G.roof.add(lampM);
    WORLD.inter.push(
      { layer: "street", x: 140, z: -10.5, r: 1.4, kind: "door", label: "ENTER THE BUILDING", to: { layer: "inside", x: 140, z: -12.6 } },
      { layer: "inside", x: 140, z: -12.0, r: 1.3, kind: "door", label: "EXIT TO THE STREET", to: { layer: "street", x: 140, z: -9.9 } },
      { layer: "inside", x: 141.2, z: -22.6, r: 1.4, kind: "elev", up: true, label: "ELEVATOR UP TO THE ROOF", to: { layer: "roof", x: 141.2, z: -27.7 } },
      { layer: "roof", x: 141.2, z: -27.9, r: 1.3, kind: "elev", up: false, label: "ELEVATOR DOWN TO THE LOBBY", to: { layer: "inside", x: 141.2, z: -22.2 } },
    );
  }
  const M_roofCap = () => WORLD.M.curb;
  let steamT = 0;
  function stepDecor(dt, t, reg) {
    for (const f of WORLD.anim) f(t);
    if (reg === "street") {
      steamT += dt;
      for (const s of WORLD.steam) { // manhole steam: slow white plumes, thicker from the sewer entrances
        for (let q = 0; q < 2; q++) if (Math.random() < (s.use ? 0.5 : 0.32)) PART.street.emit(s.x + rnd(-0.3, 0.3), 0.1, s.z + rnd(-0.3, 0.3), rnd(-0.15, 0.25), rnd(0.8, 1.4), rnd(-0.1, 0.1), rnd(2.0, 3.2), rnd(0.25, 0.45), 0.45, 0.8, 0.82, 0.9, 0.13);
      }
      for (const F of WORLD.fires) { // embers + smoke off the burning building
        if (Math.random() < 0.9) PART.glow.emit(rnd(F.x0, F.x1), rnd(1, F.h), F.z + rnd(0.3, 1.5), rnd(-0.3, 0.6), rnd(0.8, 2.2), rnd(0, 0.6), rnd(1.2, 2.6), rnd(0.06, 0.14), -0.02, 1, rnd(0.35, 0.65), 0.1, 0.9);
        if (Math.random() < 0.35) PART.street.emit(rnd(F.x0, F.x1), F.h + rnd(-2, 0), F.z + rnd(0, 2), rnd(-0.2, 0.6), rnd(1.2, 2), 0, rnd(4, 6), rnd(1.5, 2.5), 1.2, 0.16, 0.13, 0.14, 0.55);
      }
      if (Math.random() < 0.5) PART.glow.emit(136 + rnd(-0.3, 0.3), 1.5, -176 + rnd(-0.3, 0.3), rnd(-0.2, 0.2), rnd(1, 2), rnd(-0.2, 0.2), rnd(0.8, 1.6), 0.08, -0.02, 1, 0.55, 0.15, 0.9);
      PART.street.step(dt); PART.glow.step(dt); PART.fx.step(dt); PART.fxg.step(dt);
    } else if (reg === "subway") stepSubway(dt, t);
    else {
      if (Math.random() < 0.3) PART.sewer.emit(rnd(22, 158), WORLD.SY - 0.1, rnd(-2.8, -1), rnd(-0.1, 0.1), rnd(0.15, 0.35), 0, rnd(2, 4), rnd(0.6, 1.2), 0.4, 0.55, 0.9, 0.55, 0.16); // green mist off the water
      for (const [x, z] of [[34, 2.3], [162, -95.3]]) if (Math.random() < 0.25) PART.sglow.emit(x + rnd(-0.3, 0.3), WORLD.SC - 0.2, z + rnd(-0.2, 0.2), 0, -rnd(1, 1.6), 0, 1.4, 0.05, 0, 0.7, 0.8, 1, 0.5);
      stepSewerFx(dt, t);
      if (Math.random() < 0.15) PART.sewer.emit(159.5, WORLD.SY - 0.1, rnd(-94, -4), 0, rnd(0.15, 0.3), 0, rnd(2, 4), rnd(0.5, 1), 0.4, 0.55, 0.9, 0.55, 0.14);
      PART.sewer.step(dt); PART.sglow.step(dt); PART.sfx.step(dt); PART.sfxg.step(dt);
    }
  }
  // ---- interact arrows: a bright bouncing yellow arrow over every usable door / manhole / ladder / elevator / subway stair
  // (and the lair archway). Shown ~3 s out of every 20 s, and whenever the player is within ~6 m; hidden in climbs / cutscenes.
  const ARROW_T = canvasTex(128, 160, (g, w, h) => {
    const path = () => { g.beginPath(); g.moveTo(40, 14); g.lineTo(88, 14); g.lineTo(88, 72); g.lineTo(114, 72); g.lineTo(64, 136); g.lineTo(14, 72); g.lineTo(40, 72); g.closePath(); };
    g.shadowColor = "rgba(255,220,60,0.95)"; g.shadowBlur = 18; path(); g.fillStyle = "#ffd23a"; g.fill(); g.shadowBlur = 0;
    path(); g.lineJoin = "round"; g.lineWidth = 9; g.strokeStyle = "#140c00"; g.stroke();
    path(); const gr = g.createLinearGradient(0, 14, 0, 136); gr.addColorStop(0, "#fff6a0"); gr.addColorStop(0.5, "#ffd23a"); gr.addColorStop(1, "#ff9a10"); g.fillStyle = gr; g.fill();
    g.fillStyle = "rgba(255,255,255,0.7)"; g.fillRect(46, 22, 10, 44);
  });
  const ARROWS = [];
  function arrowPoints() {
    if (ARROWS.length) return ARROWS;
    const pts = WORLD.inter.map((it) => ({ layer: it.layer, x: it.x, z: it.z })).concat([{ layer: "sewer", x: 92, z: -2.3, lair: true }]);
    for (const P of pts) {
      const f = floorAt(P.layer, P.x, P.z); P.y = (f === null || f < -30 ? (P.layer === "sewer" ? WORLD.SY : 0) : f) + 2.75;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ARROW_T, transparent: true, depthWrite: false, fog: false }));
      s.scale.set(0.95, 1.2, 1); s.renderOrder = 8; s.visible = false; scene.add(s); P.s = s; P.ph = Math.random() * 6; ARROWS.push(P);
    }
    return ARROWS;
  }
  function updateArrows(t) {
    const p = STATE.player, on = STATE.scene === "stage" && p && !p.climb && !(STATE.intro > 0) && !STATE.win && !STATE.over && !STATE.elev && CAM.fade < 0.3;
    const cyc = (STATE.playT % 1200) < 180;
    for (const P of arrowPoints()) {
      let v = on && P.layer === p.layer && !(P.lair && STATE.lairFound);
      if (v) { const d = Math.hypot(p.gx - P.x, p.gz - P.z); v = d < 6 || (cyc && d < 40); }
      P.s.visible = v;
      if (v) { P.s.position.set(P.x, P.y + Math.abs(Math.sin(t * 4.2 + P.ph)) * 0.28, P.z); const k = 1 + Math.sin(t * 8.4 + P.ph) * 0.04; P.s.scale.set(0.95 * k, 1.2 * k, 1); }
    }
  }
