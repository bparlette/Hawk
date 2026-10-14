  // =====================================================================================================
  // ---------- 3D WORLD (new): two NYC blocks at 3 A.M., the sewer under them, the rooftops above ----------
  // Units are metres. X runs east along block 1, Z runs south (toward the camera on block 1), Y is up.
  // Static geometry is merged into one mesh per material per region (street / sewer / roof) for low draw calls.
  // =====================================================================================================
  const PX = 0.028, DY = 0.09, ZH = 0.028, SPRM = 0.028; // metres per 2D px along a zone, per depth px, per jump px; sprite px
  const TEXL = new THREE.TextureLoader();
  const TEX = {};
  function tex(name, rep) {
    const key = name + (rep ? ":r" : "");
    if (TEX[key]) return TEX[key];
    const t = TEXL.load(name);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return (TEX[key] = t);
  }
  function canvasTex(w, h, draw, rep) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
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

  function buildWorld(scene) {
    const G = WORLD.groups;
    for (const k of ["street", "roof", "sewer", "inside", "subway"]) { G[k] = new THREE.Group(); scene.add(G[k]); }
    // ---- materials ----
    const M = {
      asphalt: lam(tex("tex/asphalt.jpg", true)), side: lam(tex("tex/sidewalk.jpg", true)), roof: lam(tex("tex/roof.jpg", true)),
      facA: lam(tex("tex/facade_a.jpg")), facB: lam(tex("tex/facade_b.jpg")), facF: lam(tex("tex/facade_fire.jpg"), { emissive: 0x2a0c00 }),
      facAr: lam(tex("tex/facade_a.jpg", true)), facBr: lam(tex("tex/facade_b.jpg", true)),
      swall: lam(tex("tex/sewer_wall.jpg", true)), sfloor: lam(tex("tex/sewer_floor.jpg", true)), sceil: lam(tex("tex/sewer_ceil.jpg", true)),
      lair: lam(tex("tex/lair_wall.jpg")),
      metal: lam(null, { color: 0x2a2c33 }), curb: lam(tex("tex/sidewalk.jpg", true), { color: 0x9a9aa2 }),
    };
    WORLD.M = M;
    const ST = new Builder(), RF = new Builder(), SW = new Builder();
    const night = [0.78, 0.8, 0.95];
    // ================= STREET =================
    // asphalt: block 1 (x -12..154, z -7..7), cross street + lot run north
    ST.floor(M.asphalt, -12, -7, 154, 7, 0, 6);
    ST.floor(M.asphalt, 154, -150, 168, 7, 0, 6);
    // lane paint: dashed yellow centre line + crosswalk (canvas texture strips)
    const paint = lam(canvasTex(64, 64, (g) => { g.fillStyle = "#e6c650"; g.globalAlpha = 0.75; g.fillRect(0, 0, 64, 64); }), { transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let x = -10; x < 148; x += 6) ST.floor(paint, x, -0.12, x + 3, 0.12, 0.012, 64);
    for (let z = -148; z < -14; z += 6) ST.floor(paint, 160.88, z, 161.12, z + 3, 0.012, 64);
    const white = lam(canvasTex(64, 64, (g) => { g.fillStyle = "#e8e8f0"; g.fillRect(0, 0, 64, 64); }), { transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let z = -6.5; z < 6.5; z += 1.2) ST.floor(white, 150.4, z, 153.4, z + 0.6, 0.012, 64); // crosswalk into the junction
    for (let x = 154.5; x < 167.5; x += 1.2) ST.floor(white, x, -10.6, x + 0.6, -7.8, 0.012, 64);
    // sidewalks (raised 0.14 m) + curbs
    const SWH = 0.14;
    const walks = [[-12, -11, 154, -7], [-12, 7, 172, 11], [150, -150, 154, -11], [168, -150, 172, 7]];
    WORLD.walks = walks;
    // subway kiosk stairwells are cut into two sidewalks (the stairs descend along dx / dz from the open end)
    WORLD.kiosks = [{ x0: 40, x1: 44.6, z0: -10.4, z1: -8.4, dx: -1, dz: 0, name: "TORTUGA ST" }, { x0: 150.6, x1: 152.6, z0: -122, z1: -117.6, dx: 0, dz: -1, name: "CANAL WORKS" }];
    const holeyFloor = (x0, z0, x1, z1) => { // the sidewalk slab minus any kiosk opening inside it
      const h = WORLD.kiosks.find((k) => k.x0 >= x0 && k.x1 <= x1 && k.z0 >= z0 && k.z1 <= z1);
      if (!h) return ST.floor(M.side, x0, z0, x1, z1, SWH, 3.2);
      ST.floor(M.side, x0, z0, h.x0, z1, SWH, 3.2); ST.floor(M.side, h.x1, z0, x1, z1, SWH, 3.2);
      ST.floor(M.side, h.x0, z0, h.x1, h.z0, SWH, 3.2); ST.floor(M.side, h.x0, h.z1, h.x1, z1, SWH, 3.2);
    };
    for (const [x0, z0, x1, z1] of walks) {
      holeyFloor(x0, z0, x1, z1);
      ST.wall(M.curb, x0, z1, x1, z1, 0, SWH, x0 / 3, 0, x1 / 3, 0.05); // south-facing curb face
      ST.wall(M.curb, x1, z0, x0, z0, 0, SWH, x1 / 3, 0, x0 / 3, 0.05);
      ST.wall(M.curb, x1, z1, x1, z0, 0, SWH, 0, 0, 1, 0.05); ST.wall(M.curb, x0, z0, x0, z1, 0, SWH, 0, 0, 1, 0.05);
    }
    // ---- buildings: facade texture on the street face, same texture on the sides, tar roof ----
    // fac: [mat, aspect]; a building is a box; front = side facing the street
    const FAC = { A: [M.facA, 1584 / 672], B: [M.facB, 1376 / 768], F: [M.facF, 1376 / 768] };
    WORLD.blds = [];
    function bld(x0, z0, x1, z1, h, front, f, opts = {}) {
      const [mat, asp] = FAC[f], col = opts.col || [1, 1, 1];
      const fw = front === "S" || front === "N" ? x1 - x0 : z1 - z0;
      const uSpan = (fw / h) / asp; // fraction of the texture width the front covers at true aspect (wraps by tiling)
      const tm = uSpan > 1.02 ? (f === "A" ? M.facAr : f === "B" ? M.facBr : mat) : mat;
      const u1 = Math.min(uSpan, tm === mat ? 1 : uSpan), uo = opts.uo || 0;
      const sideU = (len) => Math.min(1, (len / h) / asp);
      // front
      if (front === "S") ST.wall(tm, x0, z1, x1, z1, 0, h, uo, 0, uo + u1, 1, col);
      if (front === "N") ST.wall(tm, x1, z0, x0, z0, 0, h, uo, 0, uo + u1, 1, col);
      if (front === "E") ST.wall(tm, x1, z1, x1, z0, 0, h, uo, 0, uo + u1, 1, col);
      if (front === "W") ST.wall(tm, x0, z0, x0, z1, 0, h, uo, 0, uo + u1, 1, col);
      // the other three faces (darker), only the parts above neighbours matter but whole faces are cheap
      const dk = [col[0] * 0.55, col[1] * 0.55, col[2] * 0.6];
      if (front !== "S") ST.wall(mat, x0, z1, x1, z1, 0, h, 0, 0, sideU(x1 - x0), 1, dk);
      if (front !== "N") ST.wall(mat, x1, z0, x0, z0, 0, h, 0, 0, sideU(x1 - x0), 1, dk);
      if (front !== "E") ST.wall(mat, x1, z1, x1, z0, 0, h, 0, 0, sideU(z1 - z0), 1, dk);
      if (front !== "W") ST.wall(mat, x0, z0, x0, z1, 0, h, 0, 0, sideU(z1 - z0), 1, dk);
      if (!opts.noRoof) ST.floor(M.roof, x0, z0, x1, z1, h, 5, [0.75, 0.75, 0.8]);
      WORLD.blds.push({ x0, z0, x1, z1, h });
    }
    // block 1 north side (front faces south, z = -11): the burning building sits mid-block
    bld(-40, -36, -12, -11, 14, "S", "B");
    bld(-12, -36, 15, -11, 14, "S", "B", { uo: 0.3 });
    bld(15, -40, 53, -11, 16, "S", "A");
    bld(53, -38, 81.6, -11, 16, "S", "F");
    bld(81.6, -35, 106.6, -11, 14, "S", "B", { noRoof: true });   // roof 1 (walkable)
    bld(108.6, -35, 126, -11, 12, "S", "A", { noRoof: true, uo: 0.1 }); // roof 2 (alleys either side)
    bld(128, -40, 150, -11, 16, "S", "A", { noRoof: true, uo: 0.55 });  // roof 3 (corner)
    ST.wall(M.facBr, 106.6, -34, 108.6, -34, 0, 14, 0, 0, 0.1, 0.9, [0.35, 0.33, 0.4]);
    ST.wall(M.facBr, 126, -34, 128, -34, 0, 14, 0, 0, 0.1, 0.9, [0.35, 0.33, 0.4]);
    ST.floor(M.asphalt, 106.6, -34, 108.6, -11, 0.01, 6, [0.4, 0.4, 0.45]); ST.floor(M.asphalt, 126, -34, 128, -11, 0.01, 6, [0.4, 0.4, 0.45]);
    // block 1 south side (front faces north, z = 11)
    bld(-40, 11, -10, 36, 15, "N", "A", { uo: 0.4 });
    bld(-10, 11, 22, 36, 14, "N", "B");
    bld(22, 11, 60, 38, 16, "N", "A");
    bld(60, 11, 86, 34, 13, "N", "B", { uo: 0.25 });
    bld(86, 11, 124, 40, 16, "N", "A", { uo: 0.2 });
    bld(124, 11, 172, 36, 15, "N", "B");
    bld(172, -12, 200, 36, 16, "W", "A"); // the T-junction's east face
    // west end of block 1: a low building closes the street
    bld(-70, -11, -12, 11, 14, "E", "B", { uo: 0.5 });
    // block 2 west side (front faces east, x = 150) and east side (front faces west, x = 172)
    bld(124, -78, 150, -40, 15, "E", "B");
    bld(124, -112, 150, -78, 16, "E", "A", { uo: 0.35 });
    bld(124, -150, 150, -112, 14, "E", "B", { uo: 0.6 });
    bld(172, -40, 200, -12, 14, "W", "B", { uo: 0.4 });
    bld(172, -78, 200, -40, 16, "W", "A");
    bld(172, -116, 200, -78, 15, "W", "B");
    bld(172, -150, 200, -116, 16, "W", "A", { uo: 0.6 });
    // ---- the lot at the north end (Ramrod's arena): gravel, fences, a backdrop wall ----
    const dirt = lam(tex("tex/asphalt.jpg", true), { color: 0xa08a78 });
    ST.floor(dirt, 128, -188, 172, -150, 0, 7);
    bld(100, -215, 200, -188, 18, "S", "A", { uo: 0.15 });
    bld(100, -188, 128, -150, 13, "E", "B", { uo: 0.2 });
    bld(172, -188, 200, -150, 15, "W", "B", { uo: 0.7 });
    // chain-link fence along the lot mouth's sides (alpha texture)
    const fenceT = canvasTex(128, 128, (g, w, h) => {
      g.strokeStyle = "rgba(170,175,185,0.85)"; g.lineWidth = 2;
      for (let i = -128; i < 256; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
      g.fillStyle = "rgba(120,124,132,1)"; g.fillRect(0, 0, 128, 5); g.fillRect(0, 0, 5, 128);
    }, true);
    const fence = new THREE.MeshLambertMaterial({ map: fenceT, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, vertexColors: true });
    ST.wall(fence, 128.2, -150, 128.2, -188, 0, 3.2, 0, 0, 38 / 2.5, 3.2 / 2.5);
    // ---- sky: skyline panorama on a big cylinder + dark dome ----
    const skyT = tex("tex/skyline.jpg"); skyT.wrapS = THREE.RepeatWrapping;
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(420, 420, 260, 32, 1, true, 0, Math.PI * 2),
      new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false }));
    skyT.repeat.set(3, 1); sky.position.set(80, 92, -60); sky.renderOrder = -10; G.street.add(sky);
    WORLD.sky = sky;
    // ================= ROOFTOPS (roof group) =================
    // three walkable roofs + a plank walkway; parapets from the facade's cornice band
    const parT = tex("tex/facade_b.jpg", true);
    const par = lam(parT, { color: 0xb0a8a8 });
    const ROOFS = [ // x0 z0 x1 z1 y
      { id: "roof1", x0: 81.6, z0: -35, x1: 106.6, z1: -11, y: 14, walk: [82.0, -34.6, 106.55, -11.4] },
      { id: "roof2", x0: 108.6, z0: -35, x1: 126, z1: -11, y: 12, walk: [108.65, -34.6, 125.95, -11.4] },
      { id: "roof3", x0: 128, z0: -40, x1: 150, z1: -11, y: 16, walk: [128.05, -39.6, 149.6, -11.4] },
    ];
    WORLD.roofs = ROOFS;
    for (const r of ROOFS) {
      RF.floor(M.roof, r.x0, r.z0, r.x1, r.z1, r.y, 5);
      const ph = 0.9, t = 0.35; // parapet height / thickness, as 4 thin boxes (outer + inner faces + top)
      const box = (x0, z0, x1, z1) => {
        const y0 = r.y, y1 = r.y + ph, uv = (l) => [0, 0.88, l / 6, 1];
        RF.wall(par, x0, z1, x1, z1, y0, y1, ...uv(x1 - x0)); RF.wall(par, x1, z0, x0, z0, y0, y1, ...uv(x1 - x0));
        RF.wall(par, x1, z1, x1, z0, y0, y1, ...uv(z1 - z0)); RF.wall(par, x0, z0, x0, z1, y0, y1, ...uv(z1 - z0));
        RF.floor(M.curb, x0, z0, x1, z1, y1, 2);
      };
      box(r.x0, r.z1 - t, r.x1, r.z1); box(r.x0, r.z0, r.x1, r.z0 + t);
      if (r.id === "roof1") box(r.x0, r.z0, r.x0 + t, r.z1); // roof 2's edges and roof 3's west edge are the jump / plank
      if (r.id === "roof3") box(r.x1 - t, r.z0, r.x1, r.z1);
      if (r.id === "roof1") box(r.x1 - t, r.z0, r.x1, r.z0 + 6);
    }
    // the lower roof 2 shows the taller neighbours' side walls (already part of the building boxes)
    // plank walkway roof 2 (y 12) -> roof 3 (y 16) over a gap: a ramp of boards
    const wood = lam(canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = "#5a3e26"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) { g.fillStyle = ["#6e4c2e", "#5f4128", "#7a5534", "#674629"][i]; g.fillRect(i * 32 + 1, 0, 30, h); }
      g.strokeStyle = "rgba(0,0,0,0.45)"; for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = "rgba(20,10,5,0.5)"; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 6);
    }, true));
    WORLD.plank = { x0: 123, x1: 129.5, z0: -24, z1: -22, y0: 12, y1: 16 }; // the ramp starts on roof 2, ends on roof 3
    {
      const P = WORLD.plank;
      RF.quad(wood, [P.x0, P.y0 + 0.05, P.z1], [P.x1, P.y1 + 0.05, P.z1], [P.x1, P.y1 + 0.05, P.z0], [P.x0, P.y0 + 0.05, P.z0], [[0, 0], [0, 4], [1, 4], [1, 0]]);
      RF.quad(wood, [P.x0, P.y0 - 0.1, P.z0], [P.x1, P.y1 - 0.1, P.z0], [P.x1, P.y1 - 0.1, P.z1], [P.x0, P.y0 - 0.1, P.z1], [[0, 0], [0, 4], [1, 4], [1, 0]], [0.4, 0.4, 0.4]);
    }
    // ================= SEWER (y -6, ceiling -2.4) =================
    const SY = -6, SC = -2.4, SH = SC - SY;
    WORLD.SY = SY; WORLD.SC = SC;
    const wu = SH * (1376 / 768); // metres per wall texture repeat
    // tunnel A along x (z -3..3), water channel on the north side; tunnel B along -z (x 159..165)
    const A = { x0: 20, x1: 165, z0: -3, z1: 3 }, Bt = { x0: 159, x1: 165, z0: -96, z1: -3 };
    WORLD.tunA = A; WORLD.tunB = Bt;
    const waterT = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#14561c"; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(4,30,8,${0.2 + Math.random() * 0.3})`; g.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 2 + Math.random() * 3); }
      for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(${120 + Math.random() * 80 | 0},255,${90 + Math.random() * 60 | 0},${0.12 + Math.random() * 0.3})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 30, 1 + Math.random() * 2.5, 0, 0, 7); g.fill(); }
    }, true);
    const water = new THREE.MeshLambertMaterial({ map: waterT, color: 0x4a8a50, emissive: 0x06260a, transparent: true, opacity: 0.94, vertexColors: true });
    WORLD.waterM = water;
    WORLD.anim.push((t) => { waterT.offset.x = t * 0.03; waterT.offset.y = Math.sin(t * 0.6) * 0.02; });
    // tunnel A
    SW.floor(M.sfloor, A.x0, -0.9, A.x1 - 6, A.z1, SY, 4);
    SW.floor(water, A.x0, A.z0, A.x1 - 6, -0.9, SY - 0.25, 6);
    SW.wall(M.swall, A.x0, -0.9, A.x1 - 6, -0.9, SY - 0.25, SY, 0, 0, (A.x1 - 6 - A.x0) / 4, 0.06); // channel lip
    // north wall of A (the one the camera faces) is built in stretches by buildSewerDetail
    // south wall, with an opening into the hidden lair at x 89..95
    SW.wall(M.swall, 89, A.z1, A.x0, A.z1, SY, SC, 0, 0, (89 - A.x0) / wu, 1, [0.62, 0.62, 0.6]);
    SW.wall(M.swall, A.x1, A.z1, 89, A.z1, SY, SC, 0, 0, (A.x1 - 89) / wu, 1, [0.62, 0.62, 0.6]); // south wall (beside the camera, kept dim)
    SW.wall(M.swall, A.x0, A.z1, A.x0, A.z0, SY - 0.25, SC, 0, 0, 6 / wu, 1); // west end
    SW.floor(M.sceil, A.x0, A.z0, A.x1, A.z1, SC, 6, [0.7, 0.7, 0.7], true);
    // junction + tunnel B
    SW.floor(M.sfloor, A.x1 - 6, A.z0, A.x1, A.z1, SY, 4); // the corner (tunnel B's own floor + channel come from buildSewerDetail)
    SW.wall(M.swall, A.x1, Bt.z0, A.x1, A.z1, SY - 0.25, SC, -Bt.z0 / wu, 0, -A.z1 / wu, 1, [0.62, 0.62, 0.6]); // east wall of B (faces west, -x; beside the camera, kept dim)
    SW.wall(M.swall, A.x1, A.z1, A.x1 - 6, A.z1, SY, SC, 0, 0, 6 / wu, 1); // corner's south wall (faces north)
    SW.wall(M.swall, Bt.x0, Bt.z0, Bt.x1, Bt.z0, SY, SC, 0, 0, 6 / wu, 1); // north end
    SW.floor(M.sceil, Bt.x0, Bt.z0, Bt.x1, A.z0, SC, 6, [0.7, 0.7, 0.7], true);
    // channel down the middle of B
    // the hidden lair: a room south of tunnel A at x 87..97, z 3..11
    // the lair: a room NORTH of tunnel A (x 85..99, z -11..-3), entered through a lit archway in the wall the camera faces
    const L = { x0: 85, x1: 99, z0: -11, z1: -3 }; WORLD.lairR = L;
    SW.floor(lam(tex("tex/sewer_floor.jpg", true), { color: 0xc8b090 }), L.x0, L.z0, L.x1, L.z1, SY, 3);
    SW.wall(M.lair, L.x0, L.z0, L.x1, L.z0, SY, SY + 5, 0, 0.0, 1, 0.92);           // back wall: couch, TV, pizza boxes (faces +z)
    SW.wall(M.swall, L.x1, L.z0, L.x1, L.z1, SY, SY + 5, 0, 0, 8 / wu, 1);
    SW.wall(M.swall, L.x0, L.z1, L.x0, L.z0, SY, SY + 5, 0, 0, 8 / wu, 1);
    // its front wall seen from inside (faces -z), with the archway (x 89..95) and the window (x 96.4..98.4) cut out
    SW.wall(M.swall, 89, L.z1, L.x0, L.z1, SY, SY + 5, 0, 0, 4 / wu, 1); SW.wall(M.swall, L.x1, L.z1, 98.4, L.z1, SY, SY + 5, 0, 0, 0.6 / wu, 1); SW.wall(M.swall, 96.4, L.z1, 95, L.z1, SY, SY + 5, 0, 0, 1.4 / wu, 1);
    SW.wall(M.swall, 95, L.z1, 89, L.z1, SY + 2.5, SY + 5, 0, 0.5, 6 / wu, 1); SW.wall(M.swall, 98.4, L.z1, 96.4, L.z1, SY, SY + 1.0, 0, 0, 2 / wu, 0.2); SW.wall(M.swall, 98.4, L.z1, 96.4, L.z1, SY + 2.2, SY + 5, 0, 0.45, 2 / wu, 1);
    SW.wall(M.swall, 99, L.z1, 85, L.z1, SC, SY + 5, 0, 0.7, 14 / wu, 1); // above the tunnel ceiling line
    SW.floor(M.sceil, L.x0, L.z0, L.x1, L.z1, SY + 5, 6, [0.6, 0.6, 0.6], true);
    // pipes along tunnel A's walls (cylinders merged)
    {
      const pipeM = lam(null, { color: 0x6a4a32 }), gs = [];
      const cyl = (x0, y, z, len, r, axis) => { const g = new THREE.CylinderGeometry(r, r, len, 8, 1, true); if (axis === "x") g.rotateZ(Math.PI / 2); else g.rotateX(Math.PI / 2); g.translate(x0, y, z); gs.push(g); };
      cyl((A.x0 + 88) / 2, SC - 0.35, A.z0 + 0.25, 88 - A.x0, 0.18, "x"); cyl((96 + A.x1 - 6) / 2, SC - 0.35, A.z0 + 0.25, A.x1 - 6 - 96, 0.18, "x");
      cyl(A.x1 - 0.25, SC - 0.5, (Bt.z0 + A.z0) / 2, A.z0 - Bt.z0, 0.14, "z");
      cyl((A.x0 + 89) / 2, SC - 0.6, A.z1 - 0.22, 89 - A.x0, 0.14, "x");
      cyl((95 + A.x1) / 2, SC - 0.6, A.z1 - 0.22, A.x1 - 95, 0.14, "x");
      cyl(Bt.x0 + 0.25, SC - 0.4, (Bt.z0 + A.z0) / 2, A.z0 - Bt.z0, 0.18, "z");
      const geo = mergeGeos(gs); const mesh = new THREE.Mesh(geo, pipeM); G.sewer.add(mesh);
    }
    buildSewerDetail(G, M, SY, SC, wu);
    // ================= props that are geometry: lamp posts, cars, water towers, skylights =================
    buildLamps(ST); buildCars(G.street); buildRoofProps(RF, G.roof);
    ST.build(G.street); RF.build(G.roof); SW.build(G.sewer);
    // ================= lights (a fixed pool of point lights is moved to the nearest sources) =================
    // street lamps
    for (const L of WORLD.lampPos) WORLD.lights.push({ reg: "street", x: L[0], y: 5.6, z: L[1], c: 0xffc070, i: 26, d: 15 });
    // neon spill from the painted signs (pink / cyan / green), fire, sewer lamps, lair TV
    [[30, -9.5, 0xff3fa0], [70, -9, 0xff7a20], [100, -9.5, 0x3fd8ff], [140, -9.5, 0x50ff80], [40, 9.5, 0xff40c0], [105, 9.5, 0x40c8ff], [152, -60, 0xff4080], [170, -100, 0x40e0ff], [152, -130, 0xffa040]]
      .forEach(([x, z, c]) => WORLD.lights.push({ reg: "street", x, y: 3.2, z, c, i: 14, d: 10 }));
    // (the tunnels' lamp pools come from buildSewerDetail, one per stretch)
    WORLD.lights.push({ reg: "sewer", x: 90, y: SY + 1.4, z: -9.4, c: 0x60ffd0, i: 10, d: 9, flick: 1 });
    WORLD.lights.push({ reg: "sewer", x: 94, y: SY + 4, z: -8, c: 0xffc080, i: 18, d: 12 });
    WORLD.lights.push({ reg: "sewer", x: 88, y: SY + 3, z: -6, c: 0xffa860, i: 14, d: 10, flick: 1 });
    for (const r of ROOFS) WORLD.lights.push({ reg: "roof", x: (r.x0 + r.x1) / 2, y: r.y + 4, z: (r.z0 + r.z1) / 2, c: 0x9aa8ff, i: 12, d: 18 });
    WORLD.lights.push({ reg: "roof", x: 116, y: 16, z: -30, c: 0xff40c0, i: 14, d: 14 });
    buildZones();
  }
  function mergeGeos(gs) { // minimal BufferGeometry merge (non-indexed position/normal/uv)
    const P = [], N = [], U = [];
    for (let g of gs) { if (g.index) g = g.toNonIndexed(); const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv ? g.attributes.uv.array : null;
      for (let i = 0; i < p.length; i++) { P.push(p[i]); N.push(n[i]); } for (let i = 0; i < p.length / 3; i++) { U.push(u ? u[i * 2] : 0, u ? u[i * 2 + 1] : 0); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.computeBoundingSphere(); return g;
  }
  function buildLamps(ST) {
    const pos = []; // [x, z, armDir, alongX]
    for (let x = 4; x < 150; x += 26) { pos.push([x, -7.5, 1, true]); pos.push([x + 13, 7.5, -1, true]); }
    for (let z = -24; z > -150; z -= 26) { pos.push([153.5, z, 1, false]); pos.push([168.5, z - 13, -1, false]); }
    pos.push([140, -170, 1, true]);
    WORLD.lampPos = [];
    const gs = [], heads = [];
    for (const [x, z, d, alongX] of pos) {
      const g = new THREE.CylinderGeometry(0.09, 0.13, 6, 6); g.translate(x, 3, z); gs.push(g);
      const arm = new THREE.BoxGeometry(alongX ? 0.08 : 1.5, 0.08, alongX ? 1.5 : 0.08); arm.translate(x + (alongX ? 0 : d * 0.7), 5.9, z + (alongX ? d * 0.7 : 0)); gs.push(arm);
      const hx = x + (alongX ? 0 : d * 1.4), hz = z + (alongX ? d * 1.4 : 0);
      const h = new THREE.CylinderGeometry(0.16, 0.34, 0.22, 10); h.translate(hx, 5.84, hz); gs.push(h);
      const gl = new THREE.CircleGeometry(0.28, 10); gl.rotateX(Math.PI / 2); gl.translate(hx, 5.72, hz); heads.push(gl);
      WORLD.lampPos.push([hx, hz]);
      WORLD.cols.push({ x, z, r: 0.25 });
    }
    WORLD.groups.street.add(new THREE.Mesh(mergeGeos(gs), lam(null, { color: 0x30343c, vertexColors: false })));
    WORLD.groups.street.add(new THREE.Mesh(mergeGeos(heads), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })));
    // light cones under the heads (additive glow quads on the ground) are drawn by the pooled lights
  }
  // ---- vehicles: extruded side silhouettes (painted side art on both faces) ----
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
  function buildCars(group) {
    // [img, length m, height m, width m, bodyColour, list of placements [x, z, rotY]]
    const defs = [
      { src: "tex/van_side.webp", len: 5.6, w: 2.1, body: 0xd8d8dc, at: [[55, -5.4, 0]], van: true },
      { src: "tex/taxi_side.webp", len: 5.0, w: 1.9, body: 0xc8a020, at: [[22, -5.6, 0], [117, -5.6, 0], [152.6, -64, -Math.PI / 2], [152.6, -136, -Math.PI / 2], [138, -5.6, 0]] },
    ];
    for (const D of defs) {
      const img = new Image(); img.src = D.src;
      img.onload = () => {
        const shp = silhouetteShape(img, 0.985), asp = img.height / img.width;
        const geo = new THREE.ExtrudeGeometry(shp, { depth: 1, bevelEnabled: false, curveSegments: 1 });
        { // side walls (roof, hood, bumpers) sample the paint just inside the silhouette edge, so the roof is the body colour
          const pos = geo.attributes.position, uv = geo.attributes.uv, g1 = geo.groups.find((g) => g.materialIndex === 1);
          if (g1) for (let i = g1.start; i < g1.start + g1.count; i++) { const vi = geo.index ? geo.index.getX(i) : i; uv.setXY(vi, pos.getX(vi), pos.getY(vi) - 0.03); }
          uv.needsUpdate = true;
        }
        geo.translate(-0.5, 0, -0.5); geo.scale(D.len, D.len * asp, D.w);
        const t = tex(D.src); const cap = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5 }); const sideM = new THREE.MeshLambertMaterial({ map: t, color: 0x9a9aa0 });
        for (const [x, z, ry] of D.at) {
          const m = new THREE.Mesh(geo, [cap, sideM]); m.position.set(x, 0, z); m.rotation.y = ry; group.add(m);
          const ax = Math.abs(Math.cos(ry)), hl = D.len / 2 * ax + D.w / 2 * (1 - ax), hz = D.w / 2 * ax + D.len / 2 * (1 - ax);
          WORLD.cols.push({ box: [x - hl, z - hz, x + hl, z + hz] });
          if (D.van) { // the news van's logo panel, both sides
            const sign = canvasTex(512, 160, (g, w, h) => {
              g.fillStyle = "#f4f4f6"; g.fillRect(0, 0, w, h);
              g.fillStyle = "#1a3fa8"; g.beginPath(); g.arc(80, 80, 62, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "bold 92px Arial Black, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("7", 80, 86);
              g.fillStyle = "#c8201a"; g.font = "bold 58px Arial Black, Arial"; g.textAlign = "left"; g.fillText("CHANNEL", 158, 56); g.fillStyle = "#1a3fa8"; g.fillText("7 NEWS", 158, 116);
            });
            const sm = new THREE.MeshLambertMaterial({ map: sign });
            for (const sd of [1, -1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 0.7), sm); pl.position.set(0.2, D.len * asp * 0.56, sd * (D.w / 2 + 0.01)); if (sd < 0) pl.rotation.y = Math.PI; m.add(pl); }
          }
        }
      };
    }
  }
  function buildRoofProps(RF, group) {
    // water towers: wooden barrel + cone roof on a steel stand (merged per material)
    const woodT = canvasTex(256, 128, (g, w, h) => {
      for (let i = 0; i < 32; i++) { const v = 70 + (Math.random() * 30 | 0); g.fillStyle = `rgb(${v + 20},${v - 8},${v - 30})`; g.fillRect(i * 8, 0, 8, h); g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(i * 8, 0, 1, h); }
      g.fillStyle = "#2a2a30"; for (const y of [12, 50, 88, 118]) g.fillRect(0, y, w, 5);
      g.fillStyle = "rgba(30,60,20,0.25)"; g.fillRect(0, 100, w, 28);
    }, true);
    const towers = [[96, -27, 14], [120, -29, 12], [146, -35.2, 16], [60, -30, 16], [30, -32, 16], [190, -60, 16], [185, -130, 16]];
    const barrel = [], cones = [], legs = [];
    for (const [x, z, y] of towers) {
      const b = new THREE.CylinderGeometry(1.7, 1.8, 3.4, 16, 1, true); b.translate(x, y + 3.6 + 1.7, z); barrel.push(b);
      const c = new THREE.ConeGeometry(1.95, 1.3, 16); c.translate(x, y + 3.6 + 3.4 + 0.65, z); cones.push(c);
      for (const [dx, dz] of [[1.3, 1.3], [-1.3, 1.3], [1.3, -1.3], [-1.3, -1.3]]) { const l = new THREE.BoxGeometry(0.16, 3.6, 0.16); l.translate(x + dx, y + 1.8, z + dz); legs.push(l); }
      const pl = new THREE.BoxGeometry(3.2, 0.14, 3.2); pl.translate(x, y + 3.6, z); legs.push(pl);
      for (const s of [-1, 1]) { const br = new THREE.BoxGeometry(2.8, 0.07, 0.07); br.rotateZ(s * 0.9); br.translate(x, y + 1.8, z + 1.3); legs.push(br); const br2 = br.clone(); br2.translate(0, 0, -2.6); legs.push(br2); }
      if (y > 12) WORLD.cols.push({ x, z, r: 1.6, y });
    }
    const bm = new THREE.MeshLambertMaterial({ map: woodT });
    group.add(new THREE.Mesh(mergeGeos(barrel), bm));
    group.add(new THREE.Mesh(mergeGeos(cones), new THREE.MeshLambertMaterial({ color: 0x3a3a42 })));
    group.add(new THREE.Mesh(mergeGeos(legs), new THREE.MeshLambertMaterial({ color: 0x1e2026 })));
    // skylights: glowing glass grids
    const glass = new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#ffe6a8"); gr.addColorStop(1, "#d88a3a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = "#1c1c22"; for (let i = 0; i <= 4; i++) { g.fillRect(i * 31, 0, 4, h); g.fillRect(0, i * 31, w, 4); }
      g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(8, 8, 20, 50);
    }) });
    const frameM = new THREE.MeshLambertMaterial({ color: 0x3a3e46 });
    const skys = [[88, -20, 14], [100, -28, 14], [114, -18, 12], [136, -22, 16], [146, -20, 16]];
    WORLD.skylights = skys;
    for (const [x, z, y] of skys) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 2.0), frameM); base.position.set(x, y + 0.25, z); group.add(base);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), glass); gl.rotation.x = -Math.PI / 2; gl.position.set(x, y + 0.52, z); group.add(gl);
      WORLD.cols.push({ box: [x - 1.4, z - 1.1, x + 1.4, z + 1.1], y });
      WORLD.lights.push({ reg: "roof", x, y: y + 1.2, z, c: 0xffb060, i: 6, d: 6 });
    }
    // AC units + vents
    const acM = new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = "#8a8e96"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#4a4e56"; for (let i = 6; i < 60; i += 6) g.fillRect(4, i, 56, 2); g.strokeStyle = "#2a2e36"; g.lineWidth = 3; g.strokeRect(1, 1, 62, 62); }) });
    for (const [x, z, y] of [[85, -14, 14], [104, -33, 14], [125, -14, 12], [146, -14, 16], [131, -37, 16]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.2), acM); m.position.set(x, y + 0.55, z); group.add(m); WORLD.cols.push({ box: [x - 0.9, z - 0.7, x + 0.9, z + 0.7], y });
    }
    // rooftop billboard with neon (original text)
    const bb = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = "#151020"; g.fillRect(0, 0, w, h);
      g.shadowColor = "#ff3fc0"; g.shadowBlur = 24; g.strokeStyle = "#ff5ad0"; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
      g.font = "bold 88px Arial Black, Arial"; g.textAlign = "center"; g.fillStyle = "#7fffff"; g.shadowColor = "#3fe8ff"; g.fillText("PIZZA", w / 2, 112);
      g.font = "bold 46px Arial Black, Arial"; g.fillStyle = "#ffd84a"; g.shadowColor = "#ffb020"; g.fillText("OPEN ALL NIGHT", w / 2, 190);
    });
    const bbm = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: bb }));
    bbm.position.set(116, 12 + 5.2, -34.6); group.add(bbm);
    const post = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.25, 0.25), frameM); post.position.set(116, 14.8, -34.7); group.add(post);
    for (const dx of [-3.5, 3.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), frameM); p.position.set(116 + dx, 13.5, -34.7); group.add(p); }
  }
  // ---------- zones: each is a 2D beat-'em-up frame laid into the city ----------
  // O = near-left corner (metres), u = unit along the zone (screen right), v = unit toward the camera, depth = metres across.
  // (no arenas: the world is open; enemy posts and encounters live in game.js)
  function buildZones() {
    const Z = (o) => Object.assign({ ents: { enemies: [], props: [], items: [], stars: [] }, locks: [] }, o);
    WORLD.zones = [
      Z({ id: "block2", layer: "street", reg: "street", rects: [[150.6, -150, 171.4, 10.4]], O: [171.4, 10.4], u: [0, -1], v: [1, 0], depth: 20.8,
        cam: { a: 26, dist: 6.6, h: 2.9, fov: 55 }, box: [150.8, -200, 171.6, 10.6, 99] }),
      Z({ id: "block1", layer: "street", reg: "street", rects: [[-11.5, -10.6, 150.6, 8.6]], O: [-11.5, 8.6], u: [1, 0], v: [0, 1], depth: 19.2,
        cam: { a: 26, dist: 6.6, h: 2.9, fov: 55 }, box: [-11, -10.8, 171.6, 10.6, 99] }),
      Z({ id: "lot", layer: "street", reg: "street", rects: [[128.6, -187.4, 171.4, -150]], O: [171.4, -150], u: [0, -1], v: [1, 0], depth: 42.8,
        cam: { a: 22, dist: 8, h: 3.6, fov: 56 }, box: [128.8, -187.6, 171.6, -100, 99] }),
      Z({ id: "sewerB", layer: "sewer", reg: "sewer", rects: [[159.3, -95.4, 164.7, -2.6]], O: [164.7, 2.6], u: [0, -1], v: [1, 0], depth: 5.4,
        cam: { a: 42, dist: 5.2, h: 1.4, fov: 64 }, box: [159.6, -95.75, 164.2, 2.2, WORLD.SC - 0.3] }),
      Z({ id: "lair", layer: "sewer", reg: "sewer", rects: [[85.4, -10.6, 98.6, -3.4], [89.3, -3.6, 94.7, -2.6]], O: [85.4, -2.6], u: [1, 0], v: [0, 1], depth: 8,
        cam: { a: 10, dist: 5, h: 2.8, fov: 70 }, box: [85.6, -10.7, 98.4, -3.5, WORLD.SY + 4.6], lair: true }),
      Z({ id: "sewerA", layer: "sewer", reg: "sewer", rects: [[20.4, -2.75, 164.7, 2.6]], O: [20.4, 2.6], u: [1, 0], v: [0, 1], depth: 5.35,
        cam: { a: 42, dist: 5.2, h: 1.4, fov: 64 }, box: [20.6, -2.75, 164.3, 2.2, WORLD.SC - 0.3] }),
      Z({ id: "lobby", layer: "inside", reg: "inside", rects: [[131.6, -23.3, 146.4, -11.6]], O: [131.6, -11.6], u: [1, 0], v: [0, 1], depth: 11.7,
        cam: { a: 6, dist: 6, h: 2.0, fov: 72 }, box: [131.7, -23.2, 146.3, -11.45, 3.85] }),
      Z({ id: "roofs", layer: "roof", reg: "street", rects: [[82.2, -34.4, 106.6, -11.6], [106.6, -34.4, 108.6, -11.6], [108.6, -34.4, 126, -11.6], [126, -34.4, 128.4, -11.6], [128.4, -39.4, 149.6, -11.6]],
        O: [82.2, -11.6], u: [1, 0], v: [0, 1], depth: 27.8, cam: { a: 24, dist: 7.2, h: 3.4, fov: 55 }, box: [60, -60, 170, 30, 99] }),
      Z({ id: "subway", layer: "subway", reg: "subway", rects: [[8.3, 41.1, 209.7, 52.0]], O: [8.3, 52.0], u: [1, 0], v: [0, 1], depth: 10.9,
        cam: { a: 18, dist: 6.2, h: 2.3, fov: 60 }, box: [8.3, 41.3, 209.7, 51.9, SUB.CY - 0.3] }),
    ];
    for (const z of WORLD.zones) {
      z.FB = 215; z.FT = 215 - z.depth / DY; z.len = 0;
      for (const r of z.rects) for (const [x, zz] of [[r[0], r[1]], [r[2], r[3]], [r[0], r[3]], [r[2], r[1]]]) z.len = Math.max(z.len, ((x - z.O[0]) * z.u[0] + (zz - z.O[1]) * z.u[1]) / PX);
    }
  }
  const zoneById = (id) => WORLD.zones.find((z) => z.id === id);
  function toLocal(z, gx, gz) {
    const dx = gx - z.O[0], dz = gz - z.O[1];
    return { x: (dx * z.u[0] + dz * z.u[1]) / PX, y: z.FB + (dx * z.v[0] + dz * z.v[1]) / DY };
  }
  function toGlobal(z, x, y) {
    const a = x * PX, b = (y - z.FB) * DY;
    return { gx: z.O[0] + z.u[0] * a + z.v[0] * b, gz: z.O[1] + z.u[1] * a + z.v[1] * b };
  }
  // floor height of a layer at a point (null = not walkable); roof alleys report a deep floor (you fall)
  function floorAt(layer, gx, gz) {
    if (layer === "street") {
      let ok = false;
      for (const z of WORLD.zones) if (z.layer === "street") for (const r of z.rects) if (gx >= r[0] && gx <= r[2] && gz >= r[1] && gz <= r[3]) ok = true;
      if (!ok) return null;
      for (const [x0, z0, x1, z1] of WORLD.walks) if (gx >= x0 && gx <= x1 && gz >= z0 && gz <= z1) return 0.14;
      return 0;
    }
    if (layer === "sewer") {
      for (const z of WORLD.zones) if (z.layer === "sewer") for (const r of z.rects) if (gx >= r[0] && gx <= r[2] && gz >= r[1] && gz <= r[3]) { if (gz < -2.95 && gx > 85 && gx < 99) return WORLD.SY; if (gx > 90.4 && gx < 93.6 && gz < -0.85) return WORLD.SY; return (gz < -0.9 && gx < 159) || (gx >= 159 && gx < 160 && gz < -3.2) ? WORLD.SY - 0.22 : WORLD.SY; }
      return null;
    }
    if (layer === "subway") return subFloor(gx, gz);
    if (layer === "inside") return gx >= 131.6 && gx <= 146.4 && gz >= -23.3 && gz <= -11.6 ? 0 : null;
    // roofs
    const P = WORLD.plank;
    if (gx >= P.x0 && gx <= P.x1 && gz >= P.z0 && gz <= P.z1) {
      const k = (gx - P.x0) / (P.x1 - P.x0); return P.y0 + (P.y1 - P.y0) * k;
    }
    for (const r of WORLD.roofs) { const w = r.walk; if (gx >= w[0] && gx <= w[2] && gz >= w[1] && gz <= w[3]) return r.y; }
    if (gz > -34.6 && gz < -11.4 && ((gx > 106.5 && gx < 108.7) || (gx > 125.9 && gx < 128.1))) return -40; // an alley gap: nothing underfoot
    return null;
  }
