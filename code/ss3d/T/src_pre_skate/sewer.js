  // =====================================================================================================
  // ---------- SEWER DETAIL (new): tunnels A and B broken into stretches that each look different ----------
  // brick / concrete / old tile walls, original tags + murals, side grates, outflow pipes pouring water, junction alcoves,
  // coloured lamp pools, crates / a shopping cart / a mattress, rats, a ladder shaft with light coming down,
  // and the lair's lit archway + window on tunnel A's north wall (the wall the camera faces).
  // =====================================================================================================
  const TAGS = ["DRIPZ", "SEWERSIDE", "KRUNCH", "GRIMEY 89", "BLUB!", "NO EXIT", "SLIME CITY", "ZOOT", "WET PAINT", "FLUSH CREW"];
  function tagTex(word, i) {
    return canvasTex(512, 192, (g, w, h) => {
      const cols = [["#ff3fa0", "#ffe14a"], ["#3fe0ff", "#ff7a1a"], ["#7fff3a", "#c040ff"], ["#ffffff", "#ff3a30"], ["#ffb43a", "#30e0a0"]][i % 5];
      g.translate(w / 2, h / 2); g.rotate((i % 3 - 1) * 0.08); g.translate(-w / 2, -h / 2);
      g.font = `italic bold ${word.length > 8 ? 74 : 96}px Impact, Arial Black, Arial`; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineJoin = "round"; g.lineWidth = 16; g.strokeStyle = "#0a0a0a"; g.strokeText(word, w / 2, h / 2);
      g.lineWidth = 6; g.strokeStyle = cols[1]; g.strokeText(word, w / 2, h / 2);
      const gr = g.createLinearGradient(0, h * 0.25, 0, h * 0.75); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]); g.fillStyle = gr; g.fillText(word, w / 2, h / 2);
      g.fillStyle = cols[0]; for (let k = 0; k < 9; k++) { const x = 60 + Math.random() * (w - 120), y = h / 2 + 20 + Math.random() * 20; g.fillRect(x, y, 4, 20 + Math.random() * 40); } // drips
      g.fillStyle = "#fff"; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(80 + Math.random() * (w - 160), 40 + Math.random() * 40, 4, 0, 7); g.fill(); }
    });
  }
  function grateTex() {
    return canvasTex(128, 96, (g, w, h) => {
      const gr = g.createRadialGradient(64, 60, 4, 64, 60, 70); gr.addColorStop(0, "#3a7a3a"); gr.addColorStop(1, "#050805"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = "#2a2622"; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10); g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h);
      for (let x = 18; x < w - 10; x += 14) { g.fillStyle = "#3a3632"; g.fillRect(x, 10, 6, h - 20); g.fillStyle = "#5a524a"; g.fillRect(x, 10, 2, h - 20); }
      g.fillStyle = "rgba(120,60,20,0.5)"; for (let i = 0; i < 20; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 5);
    });
  }
  function lairSignTex() { // hand-painted plank sign over the archway (original)
    return canvasTex(512, 160, (g, w, h) => {
      for (let i = 0; i < 4; i++) { g.fillStyle = ["#7a4a24", "#6a3e1e", "#845228", "#70441f"][i]; g.fillRect(0, i * 40, w, 38); }
      g.fillStyle = "rgba(0,0,0,0.35)"; for (let i = 0; i < 50; i++) g.fillRect(Math.random() * w, Math.random() * h, 10 + Math.random() * 30, 2);
      g.fillStyle = "#2a1a0e"; for (const [x, y] of [[14, 14], [w - 22, 14], [14, h - 22], [w - 22, h - 22]]) g.fillRect(x, y, 8, 8);
      g.font = "bold 58px Impact, Arial Black, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 8; g.strokeStyle = "#1a0e06";
      g.strokeText("HOME SWEET SEWER", w / 2, 62); g.fillStyle = "#ffe14a"; g.fillText("HOME SWEET SEWER", w / 2, 62);
      g.font = "bold 30px Arial Black, Arial"; g.strokeText("KNOCK 3 TIMES - PIZZA ONLY", w / 2, 122); g.fillStyle = "#7fff6a"; g.fillText("KNOCK 3 TIMES - PIZZA ONLY", w / 2, 122);
      g.fillStyle = "#ffcf3a"; g.beginPath(); g.moveTo(452, 100); g.lineTo(500, 118); g.lineTo(452, 140); g.closePath(); g.fill(); // a little pizza slice
    });
  }
  function ratTex() {
    return canvasTex(128, 64, (g) => {
      g.fillStyle = "#e88a9a"; g.lineWidth = 3; g.strokeStyle = "#e88a9a"; g.beginPath(); g.moveTo(30, 44); g.quadraticCurveTo(8, 40, 4, 56); g.stroke();
      g.fillStyle = "#4a3e36"; g.beginPath(); g.ellipse(58, 42, 30, 15, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(92, 40, 16, 11, 0.2, 0, 7); g.fill();
      g.fillStyle = "#6a5a50"; g.beginPath(); g.ellipse(88, 30, 6, 7, 0, 0, 7); g.fill(); g.fillStyle = "#ff3030"; g.fillRect(98, 36, 4, 4);
      g.fillStyle = "#e88a9a"; g.fillRect(106, 42, 6, 4); g.fillStyle = "#2a221e"; g.fillRect(44, 54, 5, 8); g.fillRect(70, 54, 5, 8);
    });
  }
  function buildSewerDetail(G, M, SY, SC, wu) {
    const S = new Builder();
    const brick = M.swall, conc = lam(tex("tex/tunnel_wall.jpg", true), { color: 0x8a9a80 }), tile = lam(tex("tex/subway_wall.jpg", true), { color: 0x9aa47a });
    const mPizza = lam(tex("tex/mural_pizza.jpg")), mGator = lam(tex("tex/mural_gator.jpg"));
    const decal = (t) => new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, vertexColors: true });
    const H = SC - (SY - 0.25), Y0 = SY - 0.25;
    const MAT = { brick: [brick, wu], conc: [conc, 4.4], tile: [tile, H * (1024 / 572)] };
    // wall strip along the north wall of tunnel A (z -3, faces +z) or the west wall of tunnel B (x 159, faces +x); s/e = along coords
    const wallA = (mat, rep, x0, x1, y0 = Y0, y1 = SC, col) => S.wall(mat, x0, -3, x1, -3, y0, y1, x0 / rep, (y0 - Y0) / H, x1 / rep, (y1 - Y0) / H, col);
    const wallB = (mat, rep, z0, z1, y0 = Y0, y1 = SC, col) => S.wall(mat, 159, z0, 159, z1, y0, y1, -z0 / rep, (y0 - Y0) / H, -z1 / rep, (y1 - Y0) / H, col); // z0 > z1
    // ---- stretches: [from, to, wall, lamp colour, flicker] (A runs east along x, B runs north along -z) ----
    const A = [[20, 34, "brick", 0xffb060, 0], [34, 48, "conc", 0x50ff70, 0], [48, 60, "tile", 0xffc070, 1], [60, 65, "junc", 0xff4a30, 0], [65, 80, "brick", 0x60d8ff, 0],
      [80, 89, "conc", 0xffa850, 0], [89, 99, "lair", 0xffb070, 0], [99, 112, "tile", 0x50ff70, 1], [112, 126, "conc", 0xc060ff, 0], [126, 140, "brick", 0xffb060, 0],
      [140, 145, "junc", 0x40ff80, 0], [145, 159, "tile", 0xffc070, 2]];
    const B = [[-3, -16, "conc", 0xffb060, 0], [-16, -30, "tile", 0x50ff70, 1], [-30, -44, "brick", 0xff7a40, 0], [-44, -49, "junc", 0xff4a30, 0], [-49, -66, "conc", 0xc060ff, 0],
      [-66, -80, "brick", 0x60d8ff, 0], [-80, -96, "tile", 0xffb060, 2]];
    WORLD.sewerFx = { falls: [], rats: [], shafts: [] };
    const lampM = new THREE.MeshBasicMaterial({ color: 0xffffff }), cageM = new THREE.MeshLambertMaterial({ color: 0x2a2622 });
    const lamp = (x, z, c, fl, alongX) => { // caged wall lamp + its light pool
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, SC - 0.55, z); G.sewer.add(m);
      const cg = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.34 : 0.22, 0.34, alongX ? 0.22 : 0.34), new THREE.MeshLambertMaterial({ color: 0x1a1816, wireframe: true })); cg.position.copy(m.position); G.sewer.add(cg);
      WORLD.lights.push({ reg: "sewer", x: x + (alongX ? 0 : 0.8), y: SC - 0.7, z: z + (alongX ? 0.8 : 0), c, i: 17, d: 10.5, flick: fl });
    };
    const junction = (a, b, alongA) => { // a recess with a dark side tunnel running off it
      const d = 4;
      if (alongA) {
        S.floor(M.sfloor, a, -3 - d, b, -3, SY - 0.22, 4, [0.5, 0.55, 0.5]);
        S.wall(brick, a, -3 - d, a, -3, Y0, SC, 0, 0, d / wu, 1, [0.7, 0.7, 0.7]); // west side (faces +x)... drawn from both sides below
        S.wall(brick, a, -3, a, -3 - d, Y0, SC, 0, 0, d / wu, 1, [0.7, 0.7, 0.7]);
        S.wall(brick, b, -3 - d, b, -3, Y0, SC, 0, 0, d / wu, 1, [0.7, 0.7, 0.7]); S.wall(brick, b, -3, b, -3 - d, Y0, SC, 0, 0, d / wu, 1, [0.7, 0.7, 0.7]);
        S.wall(brick, a, -3 - d, a + 0.6, -3 - d, Y0, SC, 0, 0, 0.1, 1, [0.6, 0.6, 0.6]); S.wall(brick, b - 0.6, -3 - d, b, -3 - d, Y0, SC, 0, 0, 0.1, 1, [0.6, 0.6, 0.6]);
        S.wall(brick, a + 0.6, -3 - d, b - 0.6, -3 - d, SY + 2.4, SC, 0, 0.6, 0.6, 1, [0.6, 0.6, 0.6]);
        S.floor(M.sceil, a, -3 - d, b, -3, SC, 6, [0.5, 0.5, 0.5], true);
        const dark = new THREE.Mesh(new THREE.PlaneGeometry(b - a - 1.2, 2.7), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 40, 2, 32, 40, 40); r.addColorStop(0, "#000"); r.addColorStop(1, "#0c140c"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }) }));
        dark.position.set((a + b) / 2, Y0 + 1.35, -3 - d + 0.01); G.sewer.add(dark);
        S.floor(water, a, -3 - d, b, -3, SY - 0.24, 6);
      } else {
        S.floor(M.sfloor, 159 - d, a <= b ? a : b, 159, a <= b ? b : a, SY - 0.22, 4, [0.5, 0.55, 0.5]);
        const zN = Math.min(a, b), zS = Math.max(a, b);
        S.wall(brick, 159 - d, zS, 159, zS, Y0, SC, 0, 0, d / wu, 1, [0.7, 0.7, 0.7]); S.wall(brick, 159, zS, 159 - d, zS, Y0, SC, 0, 0, d / wu, 1, [0.7, 0.7, 0.7]);
        S.wall(brick, 159, zN, 159 - d, zN, Y0, SC, 0, 0, d / wu, 1, [0.7, 0.7, 0.7]); S.wall(brick, 159 - d, zN, 159, zN, Y0, SC, 0, 0, d / wu, 1, [0.7, 0.7, 0.7]);
        S.wall(brick, 159 - d, zS, 159 - d, zS - 0.6, Y0, SC, 0, 0, 0.1, 1, [0.6, 0.6, 0.6]); S.wall(brick, 159 - d, zN + 0.6, 159 - d, zN, Y0, SC, 0, 0, 0.1, 1, [0.6, 0.6, 0.6]);
        S.wall(brick, 159 - d, zS - 0.6, 159 - d, zN + 0.6, SY + 2.4, SC, 0, 0.6, 0.6, 1, [0.6, 0.6, 0.6]);
        S.floor(M.sceil, 159 - d, zN, 159, zS, SC, 6, [0.5, 0.5, 0.5], true);
        const dark = new THREE.Mesh(new THREE.PlaneGeometry(zS - zN - 1.2, 2.7), new THREE.MeshBasicMaterial({ color: 0x020402 })); dark.rotation.y = Math.PI / 2; dark.position.set(159 - d + 0.01, Y0 + 1.35, (zN + zS) / 2); G.sewer.add(dark);
        S.floor(water, 159 - d, zN, 159, zS, SY - 0.24, 6);
      }
    };
    const water = WORLD.waterM;
    let ti = 0;
    for (const [a, b, kind, c, fl] of A) {
      if (kind === "junc") { junction(a, b, true); lamp((a + b) / 2, -2.85, c, fl, true); continue; }
      if (kind === "lair") continue; // built below with its openings
      const [m, rep] = MAT[kind], tint = kind === "conc" ? [0.85, 0.95, 0.85] : [1, 1, 1];
      wallA(m, rep, a, b, Y0, SC, tint);
      lamp(a + (b - a) * 0.5, -2.85, c, fl, true);
    }
    for (const [a, b, kind, c, fl] of B) {
      if (kind === "junc") { junction(a, b, false); lamp(159.15, (a + b) / 2, c, fl, false); continue; }
      const [m, rep] = MAT[kind], tint = kind === "conc" ? [0.85, 0.95, 0.85] : [1, 1, 1];
      wallB(m, rep, a, b, Y0, SC, tint);
      lamp(159.15, a + (b - a) * 0.5, c, fl, false);
    }
    // the lair stretch: brick with a lit archway (x 89..95) and a barred window (x 96.4..98.4) into the room
    wallA(brick, wu, 89, 95, SY + 2.5, SC); wallA(brick, wu, 95, 96.4); wallA(brick, wu, 98.4, 99);
    wallA(brick, wu, 96.4, 98.4, Y0, SY + 1.0); wallA(brick, wu, 96.4, 98.4, SY + 2.2, SC);
    { // archway trim (lit stone blocks) + bars + the sign + warm spill on the floor
      const trimM = new THREE.MeshLambertMaterial({ color: 0xb8946a, emissive: 0x3a2008 });
      for (const [x, w] of [[88.85, 0.3], [95.15, 0.3]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.75, 0.3), trimM); m.position.set(x, SY + 1.25, -2.95); G.sewer.add(m); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.3, 0.3), trimM); top.position.set(92, SY + 2.62, -2.95); G.sewer.add(top);
      const barM = new THREE.MeshLambertMaterial({ color: 0x2a2420 });
      for (let x = 96.6; x < 98.4; x += 0.3) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 0.05), barM); m.position.set(x, SY + 1.6, -3.0); G.sewer.add(m); }
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.12), new THREE.MeshLambertMaterial({ map: lairSignTex(), emissive: 0x2a1a08 })); sign.position.set(92, SY + 3.15, -2.9); sign.rotation.x = -0.06; G.sewer.add(sign);
      const spill = new THREE.Mesh(new THREE.PlaneGeometry(8, 5.5), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 0, 4, 64, 0, 120); r.addColorStop(0, "rgba(255,190,110,0.75)"); r.addColorStop(1, "rgba(255,160,80,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      spill.rotation.x = -Math.PI / 2; spill.position.set(92, SY + 0.02, -0.25); G.sewer.add(spill);
      WORLD.lights.push({ reg: "sewer", x: 92, y: SY + 1.6, z: -2.2, c: 0xffb070, i: 22, d: 9, fire: true });
      WORLD.lights.push({ reg: "sewer", x: 97.4, y: SY + 1.6, z: -2.4, c: 0x80ffd8, i: 8, d: 5, flick: 1 }); // TV flicker through the window
      // plank bridge across the channel to the archway
      const plank = lam(canvasTex(64, 128, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = ["#6e4c2e", "#5f4128", "#7a5534", "#674629"][i]; g.fillRect(i * 16 + 1, 0, 14, h); } }, true));
      S.floor(plank, 90.4, -3, 93.6, -0.85, SY + 0.04, 2);
    }
    // ---- murals + tags ----
    S.wall(mPizza, 66.5, -2.99, 78.5, -2.99, SY + 0.2, SC - 0.25, 0, 0.3, 1, 1);
    S.wall(mGator, 114, -2.99, 124, -2.99, SY + 0.1, SC - 0.2, 0.06, 0.08, 0.94, 0.92);
    S.wall(mGator, 159.01, -50, 159.01, -63, SY + 0.1, SC - 0.2, 0.06, 0.08, 0.94, 0.92, [0.9, 0.9, 0.9]);
    const tagAt = [[24, 1], [38.5, 0], [51, 0.4], [83.5, 0.2], [101, 0.6], [129, 0.3], [149, 0.5], [-8, 0.4], [-20, 0.1], [-35, 0.5], [-70, 0.3], [-86, 0.5]];
    tagAt.forEach(([s, y], i) => {
      const m = decal(tagTex(TAGS[i % TAGS.length], i)); const w = 3.4, h = 1.25;
      if (s > 0) S.wall(m, s, -2.98, s + w, -2.98, SY + 0.5 + y, SY + 0.5 + y + h, 0, 0, 1, 1);
      else S.wall(m, 159.02, s, 159.02, s - w, SY + 0.5 + y, SY + 0.5 + y + h, 0, 0, 1, 1);
    });
    // ---- side grates (glowing green behind) ----
    const gm = lam(grateTex());
    for (const s of [44, 57, 108, 134, -12, -40, -76]) {
      if (s > 0) S.wall(gm, s, -2.97, s + 1.4, -2.97, SY - 0.2, SY + 0.85, 0, 0, 1, 1); else S.wall(gm, 159.03, s, 159.03, s - 1.4, SY - 0.2, SY + 0.85, 0, 0, 1, 1);
      WORLD.lights.push({ reg: "sewer", x: s > 0 ? s + 0.7 : 159.6, y: SY + 0.4, z: s > 0 ? -2.4 : s - 0.7, c: 0x40ff60, i: 5, d: 4 });
    }
    // ---- outflow pipes pouring water into the channel ----
    const pipeM = new THREE.MeshLambertMaterial({ color: 0x5a4a3a }), fallT = canvasTex(64, 256, (g, w, h) => { for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${150 + Math.random() * 60 | 0},255,${170 + Math.random() * 60 | 0},${0.25 + Math.random() * 0.5})`; g.fillRect(8 + Math.random() * 44, Math.random() * h, 3 + Math.random() * 6, 20 + Math.random() * 60); } }, true);
    const fallM = new THREE.MeshBasicMaterial({ map: fallT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, color: 0x9affb0 });
    WORLD.anim.push((t) => { fallT.offset.y = t * 1.6; });
    for (const s of [42, 106, 152, -24, -88]) {
      const alongA = s > 0, py = SY + 1.6;
      const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 12, 1, true), pipeM);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 14), pipeM);
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.85), fallM);
      if (alongA) { pp.rotation.x = Math.PI / 2; pp.position.set(s, py, -2.75); rim.position.set(s, py, -2.45); fall.position.set(s, SY + 0.7, -2.42); WORLD.sewerFx.falls.push([s, -2.4]); }
      else { pp.rotation.z = Math.PI / 2; pp.position.set(159.25, py, s); rim.rotation.y = Math.PI / 2; rim.position.set(159.55, py, s); fall.rotation.y = Math.PI / 2; fall.position.set(159.58, SY + 0.7, s); WORLD.sewerFx.falls.push([159.6, s]); }
      G.sewer.add(pp); G.sewer.add(rim); G.sewer.add(fall);
    }
    // ---- a ladder shaft with street light pouring down (tunnel A x 132, tunnel B z -73) ----
    const rungM = new THREE.MeshLambertMaterial({ color: 0x6a6460 });
    const beamT = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(220,230,255,0.75)"); gr.addColorStop(1, "rgba(200,220,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); const sg = g.createLinearGradient(0, 0, w, 0); sg.addColorStop(0, "rgba(0,0,0,1)"); sg.addColorStop(0.3, "rgba(0,0,0,0)"); sg.addColorStop(0.7, "rgba(0,0,0,0)"); sg.addColorStop(1, "rgba(0,0,0,1)"); g.globalCompositeOperation = "destination-out"; g.fillStyle = sg; g.fillRect(0, 0, w, h); });
    const beamM = new THREE.MeshBasicMaterial({ map: beamT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const [x, z, alongA] of [[132, -2.2, true], [160.0, -73, false]]) {
      for (let y = SY + 0.4; y < SC; y += 0.4) { const r = new THREE.Mesh(new THREE.BoxGeometry(alongA ? 0.6 : 0.05, 0.05, alongA ? 0.05 : 0.6), rungM); r.position.set(alongA ? x : 159.12, y, alongA ? -2.92 : z); G.sewer.add(r); }
      for (const o of [-0.3, 0.3]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, SC - SY + 1.2, 0.05), rungM); r.position.set(alongA ? x + o : 159.12, (SY + SC) / 2 + 0.6, alongA ? -2.9 : z + o); G.sewer.add(r); }
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: 0xc8d8ff })); hole.rotation.x = Math.PI / 2; hole.position.set(alongA ? x : 159.6, SC - 0.01, alongA ? -2.4 : z); G.sewer.add(hole);
      for (const ry of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, SC - SY), beamM); b.position.set(alongA ? x : 159.7, (SY + SC) / 2, alongA ? -2.0 : z); b.rotation.y = ry; G.sewer.add(b); }
      WORLD.lights.push({ reg: "sewer", x: alongA ? x : 160, y: SY + 1.2, z: alongA ? -1.6 : z, c: 0xb8c8ff, i: 18, d: 8 });
      WORLD.sewerFx.shafts.push([alongA ? x : 159.8, alongA ? -2.0 : z]);
    }
    // ---- tunnel B: water channel along the west wall (x 159..160), lip, pipe on the east wall too ----
    S.floor(water, 159, -95.6, 160, -3.2, SY - 0.25, 6);
    S.wall(M.swall, 160, -3.2, 160, -95.6, SY - 0.25, SY, 0, 0, 92 / 4, 0.06);
    S.floor(M.sfloor, 160, -96, 165, -3, SY, 4);
    // ---- junk: crate stacks, a mattress, a shopping cart in the channel ----
    const crateM = new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = "#7a5530"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#5a3c20"; g.fillRect(0, 0, 64, 6); g.fillRect(0, 58, 64, 6); g.fillRect(0, 0, 6, 64); g.fillRect(58, 0, 6, 64); g.save(); g.translate(32, 32); g.rotate(0.78); g.fillRect(-44, -3, 88, 6); g.restore(); }) });
    for (const [x, z, s, r] of [[55.4, 2.4, 0.9, 0.2], [56.4, 2.45, 0.7, -0.1], [55.8, 2.4, 0.6, 0.5, 1], [148, 2.3, 0.9, 0.1], [163.9, -88, 0.9, 0.3], [164, -86.8, 0.7, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateM); m.position.set(x, SY + s / 2 + (r === 0.5 ? 0.9 : 0), z); m.rotation.y = r; G.sewer.add(m);
    }
    const matT = canvasTex(128, 96, (g, w, h) => { for (let x = 0; x < w; x += 12) { g.fillStyle = x % 24 ? "#d8d0c0" : "#7a9ac8"; g.fillRect(x, 0, 12, h); } g.fillStyle = "rgba(120,90,30,0.55)"; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 20, 6 + Math.random() * 12, 0, 0, 7); g.fill(); } });
    const mat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.3), new THREE.MeshLambertMaterial({ map: matT }));
    mat.position.set(52.5, SY + 0.95, -2.55); mat.rotation.x = -1.25; G.sewer.add(mat);
    const mat2 = mat.clone(); mat2.position.set(159.55, SY + 0.95, -33); mat2.rotation.set(0, Math.PI / 2, 0); mat2.rotateX(-1.25); G.sewer.add(mat2);
    const wireT = canvasTex(64, 64, (g) => { g.strokeStyle = "#c8ccd4"; g.lineWidth = 3; for (let i = 0; i <= 64; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } }, true);
    const wireM = new THREE.MeshLambertMaterial({ map: wireT, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    const cart = new THREE.Group(); const basket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6), wireM); basket.position.y = 0.55; cart.add(basket);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.6), cageM); handle.position.set(-0.5, 0.9, 0); cart.add(handle);
    for (const [dx, dz] of [[-0.35, -0.25], [0.35, -0.25], [-0.35, 0.25], [0.35, 0.25]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8), cageM); w.rotation.x = Math.PI / 2; w.position.set(dx, 0.1, dz); cart.add(w); }
    cart.position.set(84.5, SY - 0.2, -2.0); cart.rotation.set(0.3, 0.4, 0.25); G.sewer.add(cart);
    const cart2 = cart.clone(); cart2.position.set(159.5, SY - 0.2, -68); cart2.rotation.set(0.2, 1.9, -0.3); G.sewer.add(cart2);
    // ---- rats: little billboards that scurry along the wall foot, turn, and scurry back ----
    const rM = new THREE.SpriteMaterial({ map: ratTex(), transparent: true, alphaTest: 0.2 });
    for (const [a, b, z] of [[22, 46, 2.7], [60, 84, 2.75], [100, 126, 2.7], [138, 156, 2.75]]) { const s = new THREE.Sprite(rM.clone()); s.scale.set(0.5, 0.25, 1); G.sewer.add(s); WORLD.sewerFx.rats.push({ s, a, b, z, x: a + Math.random() * (b - a), v: 2.4 + Math.random(), axis: "x" }); }
    for (const [a, b] of [[-10, -40], [-56, -90]]) { const s = new THREE.Sprite(rM.clone()); s.scale.set(0.5, 0.25, 1); G.sewer.add(s); WORLD.sewerFx.rats.push({ s, a: b, b: a, z: 164.7, x: (a + b) / 2, v: 2.6, axis: "z" }); }
    S.build(G.sewer);
  }
  function stepSewerFx(dt, t) {
    const F = WORLD.sewerFx; if (!F) return;
    for (const [x, z] of F.falls) if (Math.random() < 0.5) PART.sglow.emit(x + rnd(-0.15, 0.15), WORLD.SY - 0.15, z + rnd(-0.15, 0.15), rnd(-0.4, 0.4), rnd(0.4, 1.0), rnd(-0.4, 0.4), rnd(0.3, 0.6), rnd(0.05, 0.1), 0, 0.6, 1, 0.7, 0.6);
    for (const [x, z] of F.shafts) if (Math.random() < 0.25) PART.sewer.emit(x + rnd(-0.4, 0.4), WORLD.SY + rnd(0.2, 3), z + rnd(-0.4, 0.4), rnd(-0.05, 0.05), rnd(-0.15, -0.05), 0, rnd(2, 3), rnd(0.04, 0.07), 0, 0.85, 0.9, 1, 0.5);
    for (const r of F.rats) {
      r.x += r.v * dt * (r.dir || 1);
      if (r.x > Math.max(r.a, r.b)) r.dir = -1; if (r.x < Math.min(r.a, r.b)) r.dir = 1;
      const hop = Math.abs(Math.sin(t * 18 + r.a)) * 0.03;
      if (r.axis === "x") r.s.position.set(r.x, WORLD.SY + 0.13 + hop, r.z); else r.s.position.set(r.z, WORLD.SY + 0.13 + hop, r.x);
      const sgn = (r.dir || 1) * (r.axis === "x" ? 1 : -1) * (CAM.uDot >= 0 ? 1 : -1); r.s.material.rotation = 0; r.s.scale.x = 0.5 * (r.axis === "x" ? sgn : -sgn);
    }
  }
