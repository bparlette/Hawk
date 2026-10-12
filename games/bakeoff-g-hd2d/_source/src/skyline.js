  // ===== D: SKYLINE CITY - the same crossing, built tall. Upper floors, fire escapes, cornices, rooftop furniture, a backdrop
  // skyline and a night sky, all merged into a handful of shared meshes (one draw call per material). Only used when SKY. =====
  let SKYSEED = 20261009;
  const srnd = () => ((SKYSEED = (SKYSEED * 16807) % 2147483647) / 2147483647); // seeded: the same lit windows on every load
  const BAY = 2.6, FLR = 3.0; // metres per window bay / per storey on the upper floors (matches the painted facades' rhythm)
  const SKYW = {};
  function skyInit() {
    const bricks = (g, x0, y0, w, h, base) => { // running-bond brick with per-brick tone, mortar and grime
      g.fillStyle = "#3a2c28"; g.fillRect(x0, y0, w, h);
      for (let r = 0, y = y0; y < y0 + h; r++, y += 8) for (let x = x0 - (r % 2) * 12; x < x0 + w; x += 24) {
        const v = 0.78 + srnd() * 0.36; g.fillStyle = `rgb(${base[0] * v | 0},${base[1] * v | 0},${base[2] * v | 0})`; g.fillRect(x + 1, y + 1, 22, 6);
      }
    };
    // upper wall tile: 2 bays x 2 storeys, 520 x 600 px (100 px per metre)
    SKYW.wallT = canvasTex(520, 600, (g, w, h) => {
      bricks(g, 0, 0, w, h, [128, 78, 62]);
      for (let f = 0; f < 2; f++) for (let b = 0; b < 2; b++) {
        const X = b * 260, Y = f * 300;
        g.fillStyle = "rgba(20,14,12,0.35)"; g.fillRect(X, Y + 296, 260, 4); // floor line
        g.fillStyle = "#a89a86"; g.fillRect(X + 62, Y + 52, 136, 14); g.fillStyle = "#7a6e60"; g.fillRect(X + 62, Y + 63, 136, 3); // stone lintel
        g.fillStyle = "#0c0a0c"; g.fillRect(X + 70, Y + 66, 120, 168); // recess
        g.fillStyle = "#3c3630"; g.fillRect(X + 74, Y + 70, 112, 160); // frame
        for (const [y0, y1] of [[74, 148], [152, 226]]) { // two sashes: dark glass with a cold reflection
          const gr = g.createLinearGradient(X + 78, Y + y0, X + 182, Y + y1); gr.addColorStop(0, "#1a2232"); gr.addColorStop(0.55, "#0e121c"); gr.addColorStop(1, "#151a26");
          g.fillStyle = gr; g.fillRect(X + 78, Y + y0, 104, y1 - y0);
          g.fillStyle = "rgba(150,170,220,0.10)"; g.beginPath(); g.moveTo(X + 96, Y + y0); g.lineTo(X + 120, Y + y0); g.lineTo(X + 92, Y + y1); g.lineTo(X + 78, Y + y1); g.fill();
        }
        if ((f + b) % 2 === 0) { g.fillStyle = "rgba(190,170,130,0.22)"; g.fillRect(X + 78, Y + 74, 104, 40); } // a shade half down
        g.fillStyle = "#b0a28c"; g.fillRect(X + 64, Y + 234, 132, 9); g.fillStyle = "#6a5e50"; g.fillRect(X + 64, Y + 241, 132, 3); // sill
        const gr = g.createLinearGradient(0, Y + 244, 0, Y + 300); gr.addColorStop(0, "rgba(10,8,8,0.35)"); gr.addColorStop(1, "rgba(10,8,8,0)"); g.fillStyle = gr; g.fillRect(X + 72, Y + 244, 116, 56); // grime
        if (f === 1 && b === 0) { g.fillStyle = "#8a8e96"; g.fillRect(X + 96, Y + 196, 68, 34); g.fillStyle = "#5a5e66"; for (let i = 0; i < 6; i++) g.fillRect(X + 100, Y + 200 + i * 5, 60, 2); }
      }
    }, true);
    // lit windows (four rooms) - drawn to sit exactly on the glass of the wall tile
    SKYW.litT = canvasTex(1024, 256, (g) => {
      const room = (i, c0, c1, draw) => { const X = i * 256; const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(X, 0, 256, 256); draw(X); g.fillStyle = "#3c3630"; g.fillRect(X, 122, 256, 10); g.fillRect(X, 0, 256, 4); g.fillRect(X, 252, 256, 4); };
      room(0, "#ffd68a", "#e89a3a", (X) => { g.fillStyle = "#b8442a"; g.fillRect(X, 0, 46, 256); g.fillRect(X + 210, 0, 46, 256); g.fillStyle = "rgba(90,30,10,0.5)"; g.fillRect(X + 40, 0, 6, 256); g.fillRect(X + 210, 0, 6, 256); });
      room(1, "#fff2c8", "#f0c070", (X) => { g.fillStyle = "rgba(150,110,60,0.45)"; for (let y = 6; y < 120; y += 9) g.fillRect(X, y, 256, 4); });
      room(2, "#ffc870", "#d08030", (X) => { g.fillStyle = "rgba(40,20,10,0.75)"; g.fillRect(X + 150, 150, 70, 106); g.beginPath(); g.arc(X + 70, 210, 34, 0, 7); g.fill(); g.fillStyle = "#fff0c0"; g.beginPath(); g.moveTo(X + 50, 60); g.lineTo(X + 90, 60); g.lineTo(X + 100, 100); g.lineTo(X + 40, 100); g.fill(); });
      room(3, "#7ab0ff", "#2a4aa0", (X) => { g.fillStyle = "rgba(220,240,255,0.35)"; g.fillRect(X + 60, 150, 120, 70); g.fillStyle = "rgba(10,10,30,0.6)"; g.fillRect(X + 20, 200, 216, 56); });
    });
    // fire-escape ironwork atlas: grate (top-left), railing (top-right), stair (bottom)
    SKYW.ironT = canvasTex(512, 512, (g) => {
      g.clearRect(0, 0, 512, 512); g.fillStyle = "#fff";
      for (let i = 0; i < 256; i += 10) { g.fillRect(i, 0, 3, 256); g.fillRect(0, i, 256, 3); } g.fillRect(0, 0, 256, 6); g.fillRect(0, 250, 256, 6); g.fillRect(0, 0, 6, 256); g.fillRect(250, 0, 6, 256);
      g.fillRect(256, 0, 256, 12); g.fillRect(256, 120, 256, 8); g.fillRect(256, 244, 256, 12); for (let x = 256; x < 512; x += 14) g.fillRect(x, 0, 4, 256);
      g.fillRect(0, 256, 512, 26); g.fillRect(0, 486, 512, 26); for (let x = 6; x < 512; x += 22) g.fillRect(x, 256, 8, 256);
    }, false, 2);
    // cornice: moulding, dentils, brackets, fascia (light stone, tinted per building)
    SKYW.corT = canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = "#b8ae9e"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#d8d0c0"; g.fillRect(0, 0, w, 12); g.fillStyle = "#8a8070"; g.fillRect(0, 12, w, 5); g.fillStyle = "#c8bea8"; g.fillRect(0, 17, w, 10);
      for (let x = 0; x < w; x += 16) { g.fillStyle = "#e0d8c8"; g.fillRect(x + 2, 30, 10, 14); g.fillStyle = "#6a6050"; g.fillRect(x + 12, 30, 4, 14); }
      for (let x = 0; x < w; x += 64) { g.fillStyle = "#cfc5b2"; g.fillRect(x + 22, 46, 20, 52); g.fillStyle = "#7a7060"; g.fillRect(x + 42, 46, 5, 52); g.beginPath(); g.fillStyle = "#cfc5b2"; g.arc(x + 32, 98, 10, 0, Math.PI); g.fill(); }
      g.fillStyle = "#9a9080"; g.fillRect(0, 108, w, 20); g.fillStyle = "#6a6050"; g.fillRect(0, 108, w, 3);
      g.fillStyle = "rgba(0,0,0,0.18)"; for (let i = 0; i < 60; i++) g.fillRect(srnd() * w, 46 + srnd() * 80, 2, 8 + srnd() * 20);
    }, true);
    SKYW.M = {
      wall: new THREE.MeshLambertMaterial({ map: SKYW.wallT, vertexColors: true }),
      lit: new THREE.MeshBasicMaterial({ map: SKYW.litT, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
    if (HD) SKYW.M.lit.color.setScalar(1.7); // G: warm windows glow a little through the bloom
    Object.assign(SKYW.M, {
      iron: new THREE.MeshLambertMaterial({ map: SKYW.ironT, color: 0x2c2a30, alphaTest: 0.5, side: THREE.DoubleSide }),
      cor: new THREE.MeshLambertMaterial({ map: SKYW.corT, vertexColors: true }),
      roof: new THREE.MeshLambertMaterial({ map: tex("tex/roof.jpg", true), vertexColors: true }),
    });
    SKYW.B = new Builder();
  }
  const mulC = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  // the tall part of a building: stone belt at h, brick storeys with windows up to h+up, fire escapes on the street fronts, a cornice and a roof
  function skyUpper(x0, z0, x1, z1, h, up, faces, tint) {
    const B = SKYW.B, M = SKYW.M, H = h + up;
    const P = { S: [x0, z1, x1, z1], N: [x1, z0, x0, z0], E: [x1, z1, x1, z0], W: [x0, z0, x0, z1] };
    const nf = Math.round(up / FLR);
    for (const f of ["S", "N", "E", "W"]) {
      const [ax, az, bx, bz] = P[f], len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len, nx = -dz, nz = dx;
      const at = (s, y, o) => [ax + dx * s + nx * o, y, az + dz * s + nz * o];
      const street = !!faces[f], cb = mulC(tint, street ? 1.12 : 0.85), ct = mulC(tint, street ? 0.85 : 0.66);
      if (up > 0) B.wall(M.wall, ax, az, bx, bz, h, H, 0, 0, len / (2 * BAY), up / (2 * FLR), [cb, cb, ct, ct]);
      // ledges: a belt course over the painted storefront floors, the big cornice on top
      const ext = f === "S" || f === "N";
      const ledge = (y0, y1, out, v0, v1, k) => {
        const e = ext ? out : 0, s0 = -e, s1 = len + e, c = mulC(tint, k), cu = mulC(tint, k * 0.45);
        B.quad(M.cor, at(s0, y0, out), at(s1, y0, out), at(s1, y1, out), at(s0, y1, out), [[0, v0], [len / 6, v0], [len / 6, v1], [0, v1]], c);
        B.quad(M.cor, at(s0, y0, 0), at(s1, y0, 0), at(s1, y0, out), at(s0, y0, out), [[0, 0], [len / 6, 0], [len / 6, 0.15], [0, 0.15]], cu);
        B.quad(M.cor, at(s0, y1, out), at(s1, y1, out), at(s1, y1, 0), at(s0, y1, 0), [[0, 0.9], [len / 6, 0.9], [len / 6, 1], [0, 1]], c);
        if (ext) { B.quad(M.cor, at(s0, y0, 0), at(s0, y0, out), at(s0, y1, out), at(s0, y1, 0), [[0, v0], [0.1, v0], [0.1, v1], [0, v1]], cu); B.quad(M.cor, at(s1, y0, out), at(s1, y0, 0), at(s1, y1, 0), at(s1, y1, out), [[0, v0], [0.1, v0], [0.1, v1], [0, v1]], cu); }
      };
      ledge(h - 0.05, h + 0.45, 0.3, 0, 0.2, 0.9);
      ledge(H - 1.15, H, 0.8, 0, 1, 1.0);
      if (up <= 0) continue;
      // lit windows: one overlay quad per lit pane, seeded so every load matches
      const nb = Math.floor(len / BAY), lp = HD ? (street ? 0.5 : 0.3) : street ? 0.36 : 0.2;
      for (let j = 0; j < nf; j++) for (let k = 0; k < nb; k++) {
        if (srnd() > lp) continue;
        const s0 = k * BAY + 0.3 * BAY, s1 = k * BAY + 0.7 * BAY, y0 = h + j * FLR + 0.2467 * FLR, y1 = h + j * FLR + 0.7533 * FLR, v = (srnd() * 4) | 0, br = 0.7 + srnd() * 0.35;
        const pA = at(s0, y0, 0.03), pB = at(s1, y0, 0.03), pC = at(s1, y1, 0.03), pD = at(s0, y1, 0.03);
        B.quad(M.lit, pA, pB, pC, pD, [[v / 4 + 0.004, 0], [(v + 1) / 4 - 0.004, 0], [(v + 1) / 4 - 0.004, 1], [v / 4 + 0.004, 1]], [br, br, br]);
      }
      // fire escapes: two bays wide, a platform + railing per storey, a zig-zag stair between them
      if (!street || nf < 2) continue;
      for (let c = 1; c + 2 < nb; c += 6) {
        const s0 = c * BAY + 0.12, s1 = (c + 2) * BAY - 0.12, out = 1.15, ir = mulC([1, 1, 1], 1);
        for (let j = 0; j < nf; j++) {
          const y = h + j * FLR + 0.55;
          B.quad(M.iron, at(s0, y, 0), at(s1, y, 0), at(s1, y, out), at(s0, y, out), [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]], ir);
          B.quad(M.iron, at(s0, y, out), at(s1, y, out), at(s1, y + 0.95, out), at(s0, y + 0.95, out), [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]], ir);
          for (const s of [s0, s1]) B.quad(M.iron, at(s, y, 0), at(s, y, out), at(s, y + 0.95, out), at(s, y + 0.95, 0), [[0.5, 0.5], [0.61, 0.5], [0.61, 1], [0.5, 1]], ir);
          if (j > 0) { const yl = y - FLR, l = j % 2 ? s0 + 0.35 : s1 - 0.35, r = j % 2 ? s1 - 0.35 : s0 + 0.35;
            B.quad(M.iron, at(l, yl, 0.3), at(r, y, 0.3), at(r, y, 0.85), at(l, yl, 0.85), [[0, 0], [1, 0], [1, 0.5], [0, 0.5]], ir); }
        }
        // the drop ladder hanging over the storefront
        const yb = h + 0.55; B.quad(M.iron, at(s1 - 0.9, yb - 2.2, 0.95), at(s1 - 0.45, yb - 2.2, 0.95), at(s1 - 0.45, yb, 0.95), at(s1 - 0.9, yb, 0.95), [[0, 0], [0.2, 0], [0.2, 0.5], [0, 0.5]], ir);
      }
    }
    B.floor(M.roof, x0, z0, x1, z1, H - 0.7, 5, mulC(tint, 0.8));
    return H;
  }
  // ---- rooftop furniture: water towers, antennas with blinking lights, billboards, a rooftop neon, steam vents ----
  function skyRoofs(top) {
    const G = WORLD.groups.street, frame = [], blink = [];
    const ant = (x, z, hgt) => { const b = top(x, z); if (!b) return; const y = b.h - 0.7;
      const m = new THREE.CylinderGeometry(0.07, 0.16, hgt, 6); m.translate(x, y + hgt / 2, z); frame.push(m);
      for (let k = 1; k < 4; k++) { const cr = new THREE.BoxGeometry(1.6 - k * 0.3, 0.06, 0.06); cr.translate(x, y + hgt * k / 4.2, z); frame.push(cr); }
      const l = new THREE.SphereGeometry(0.28, 8, 6); l.translate(x, y + hgt + 0.2, z); blink.push(l); };
    [[-48, -48, 14], [50, -45, 18], [45, 50, 12], [-50, 46, 16], [20, -48, 10], [-38, -22, 9], [40, 22, 9]].forEach(([x, z, hh]) => ant(x, z, hh));
    if (frame.length) G.add(new THREE.Mesh(mergeGeos(frame), new THREE.MeshLambertMaterial({ color: 0x24262c })));
    const bm = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false }); if (blink.length) G.add(new THREE.Mesh(mergeGeos(blink), bm));
    WORLD.anim.push(() => { const on = (performance.now() / 1000) % 1.6 < 0.55; bm.color.setHex(on ? 0xff2a1a : 0x3a0806); });
    // billboards: painted ads (original), on steel frames with a catwalk, facing the crossing
    const ad = (draw) => canvasTex(1024, 432, (g, w, h) => { draw(g, w, h); g.strokeStyle = "#e8e4dc"; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14); });
    const ads = [
      ad((g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#c8201a"); gr.addColorStop(1, "#7a0e10"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = "rgba(255,255,255,0.08)"; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(760 + i * 3, 216, 300 - i * 24, 0, 7); g.fill(); }
        g.fillStyle = "#2a0a08"; g.beginPath(); g.moveTo(800, 60); g.lineTo(860, 60); g.lineTo(870, 120); g.quadraticCurveTo(900, 170, 900, 230); g.lineTo(900, 380); g.lineTo(760, 380); g.lineTo(760, 230); g.quadraticCurveTo(760, 170, 790, 120); g.closePath(); g.fill();
        g.fillStyle = "#f4f0e8"; g.fillRect(768, 240, 124, 70); g.fillStyle = "#c8201a"; g.font = "bold 36px Arial Black, Arial"; g.textAlign = "center"; g.fillText("FIZZ", 830, 290);
        g.textAlign = "left"; g.fillStyle = "#fff"; g.font = "italic bold 150px Georgia, serif"; g.fillText("Fizz Cola", 50, 220); g.font = "bold 44px Arial Black, Arial"; g.fillStyle = "#ffd23a"; g.fillText("ICE COLD AT 3 A.M.", 60, 320); }),
      ad((g, w, h) => { g.fillStyle = "#101a3a"; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.fillStyle = "rgba(255,255,255," + (0.2 + srnd() * 0.6) + ")"; g.fillRect(srnd() * w, srnd() * h, 2, 2); }
        g.strokeStyle = "#3ae8ff"; g.lineWidth = 6; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(150, 216, 40 + i * 34, -0.9, 0.9); g.stroke(); }
        g.fillStyle = "#ffd23a"; g.font = "bold 130px Arial Black, Arial"; g.fillText("WKRZ 99", 320, 200); g.fillStyle = "#fff"; g.font = "bold 46px Arial Black, Arial"; g.fillText("ALL HITS - ALL NIGHT", 330, 290); g.fillStyle = "#ff5ad0"; g.font = "bold 36px Arial"; g.fillText("99.1 FM  BIG APPLE RADIO", 330, 350); }),
      ad((g, w, h) => { g.fillStyle = "#f2e6c8"; g.fillRect(0, 0, w, h); g.fillStyle = "#1e6a3a"; g.fillRect(0, 300, w, 132);
        g.fillStyle = "#c86a1a"; for (const [x, r] of [[180, 110], [330, 90]]) { g.beginPath(); g.arc(x, 180, r, 0, 7); g.fill(); g.fillStyle = "#f2e6c8"; g.beginPath(); g.arc(x, 180, r * 0.32, 0, 7); g.fill(); g.fillStyle = "#c86a1a"; }
        g.fillStyle = "#3a1a0a"; g.font = "bold 92px Arial Black, Arial"; g.fillText("BIG APPLE", 470, 150); g.fillText("BAGELS", 470, 250); g.fillStyle = "#fff"; g.font = "bold 44px Arial Black, Arial"; g.fillText("HOT OUT THE OVEN SINCE 1961", 60, 385); }),
    ];
    const bbs = [[0, -47.5, 0, 0], [47.5, 0, -Math.PI / 2, 1], [0, 47.5, Math.PI, 2]]; // on the low buildings that close three of the street ends, facing the crossing
    const steel = [], lamps = [];
    for (const [x, z, ry, ai] of bbs) {
      const b = top(x, z); if (!b) continue; const y = b.h - 0.7 + 2.4, w = 11, hh = w * 432 / 1024;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ map: ads[ai], color: 0xd8d4cc })); m.position.set(x, y + hh / 2, z); m.rotation.y = ry; G.add(m);
      const fx = Math.cos(ry), fz = -Math.sin(ry), nx = Math.sin(ry), nz = Math.cos(ry); // along the board / its facing
      for (const s of [-w * 0.4, 0, w * 0.4]) { const l = new THREE.BoxGeometry(0.18, y - (b.h - 0.7) + hh, 0.18); l.translate(x + fx * s - nx * 0.4, (b.h - 0.7 + y + hh) / 2, z + fz * s - nz * 0.4); steel.push(l); }
      const back = new THREE.BoxGeometry(w + 0.3, hh + 0.3, 0.12); back.rotateY(ry); back.translate(x - nx * 0.08, y + hh / 2, z - nz * 0.08); steel.push(back);
      const cw = new THREE.BoxGeometry(w, 0.1, 0.9); cw.rotateY(ry); cw.translate(x + nx * 0.45, y - 0.1, z + nz * 0.45); steel.push(cw);
      for (const s of [-w * 0.33, 0, w * 0.33]) { const lp = new THREE.BoxGeometry(0.5, 0.18, 0.3); lp.rotateY(ry); lp.translate(x + fx * s + nx * 0.85, y + 0.02, z + fz * s + nz * 0.85); lamps.push(lp); }
    }
    if (steel.length) G.add(new THREE.Mesh(mergeGeos(steel), new THREE.MeshLambertMaterial({ color: 0x2a2c32 })));
    if (lamps.length) G.add(new THREE.Mesh(mergeGeos(lamps), new THREE.MeshBasicMaterial({ color: 0xfff0c0 })));
    // a big rooftop neon on the fourth street end (west), facing the crossing
    { const b = top(-47.5, 0); if (b) { const y = b.h - 0.7, m = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.06), new THREE.MeshBasicMaterial({ map: neonTex("HOTEL ARCADIA".slice(6), "#ff3a6a", "#3ae8ff"), transparent: true }));
      m.position.set(-47.3, y + 4.4, 0); m.rotation.y = Math.PI / 2; G.add(m);
      const fr = []; for (const s of [-5, 0, 5]) { const l = new THREE.BoxGeometry(0.16, 6.4, 0.16); l.translate(-47.6, y + 3.2, s); fr.push(l); } const cr = new THREE.BoxGeometry(0.12, 0.12, 13); cr.translate(-47.6, y + 2.2, 0); fr.push(cr);
      G.add(new THREE.Mesh(mergeGeos(fr), new THREE.MeshLambertMaterial({ color: 0x1e2026 })));
      WORLD.lights.push({ reg: "street", x: -45, y: y + 4, z: 0, c: 0xff3a6a, i: 30, d: 16 }); } }
    // rooftop steam vents (drawn by stepDecor from a small particle pool of their own)
    WORLD.roofSteam = [];
    for (const [x, z] of [[14, -16], [-16, 14], [16, 14], [-14, -26], [26, -14], [-26, 16]]) { const b = top(x, z); if (b) WORLD.roofSteam.push({ x, z, y: b.h - 0.4 }); }
    PART.roof = new Particles(220, false, G);
  }
  // ---- the distant city: stepped towers in a ring past the blocks, lit window dots, a couple of spires with red lights ----
  function skyBackdrop() {
    const G = WORLD.groups.street, B = new Builder();
    const winT = canvasTex(256, 512, (g, w, h) => { g.fillStyle = "#14121e"; g.fillRect(0, 0, w, h);
      for (let y = 4; y < h; y += 12) for (let x = 4; x < w; x += 10) { const r = srnd(); g.fillStyle = r < 0.2 ? "#ffd27a" : r < 0.26 ? "#9ac8ff" : r < 0.3 ? "#ffefc0" : "#22202e"; g.fillRect(x, y, 5, 7); } }, true, 2);
    const M = new THREE.MeshBasicMaterial({ map: winT, vertexColors: true });
    const box = (cx, cz, wx, wz, y0, y1, c) => {
      const x0 = cx - wx / 2, x1 = cx + wx / 2, z0 = cz - wz / 2, z1 = cz + wz / 2, u = srnd(), sv = (y1 - y0) / 40;
      B.wall(M, x0, z1, x1, z1, y0, y1, u, 0, u + wx / 25, sv, c); B.wall(M, x1, z0, x0, z0, y0, y1, u, 0, u + wx / 25, sv, c);
      B.wall(M, x1, z1, x1, z0, y0, y1, u, 0, u + wz / 25, sv, c); B.wall(M, x0, z0, x0, z1, y0, y1, u, 0, u + wz / 25, sv, c);
      B.floor(M, x0, z0, x1, z1, y1, 400, [0.08, 0.07, 0.1]);
    };
    const spires = [];
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * Math.PI * 2 + srnd() * 0.08, r = 105 + srnd() * 120, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      if (Math.abs(cx) < 80 && Math.abs(cz) < 80) continue;
      const wx = 14 + srnd() * 22, wz = 14 + srnd() * 22, hgt = 45 + srnd() * 110 * (r > 170 ? 1.25 : 1), k = 0.55 + srnd() * 0.35, c = [k, k * 0.95, k * 1.1];
      box(cx, cz, wx, wz, 0, hgt, c);
      if (srnd() < 0.55) box(cx, cz, wx * 0.66, wz * 0.66, hgt, hgt + 12 + srnd() * 26, c); // a setback
      if (srnd() < 0.2) { const t = hgt + 40; const s = new THREE.ConeGeometry(2.4, 26, 8); s.translate(cx, t + 13, cz); spires.push(s); }
    }
    B.build(G);
    if (spires.length) G.add(new THREE.Mesh(mergeGeos(spires), new THREE.MeshBasicMaterial({ color: 0x2a2838 })));
  }
  // ---- night sky dome (gradient + stars) behind the painted skyline band, whose cloudy top is faded into it ----
  function skySky(G) {
    const domeT = canvasTex(2048, 1024, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h / 2); gr.addColorStop(0, "#04050e"); gr.addColorStop(0.55, "#0e0c24"); gr.addColorStop(0.85, "#241a3a"); gr.addColorStop(1, "#2e2242");
      g.fillStyle = gr; g.fillRect(0, 0, w, h / 2); g.fillStyle = "#2e2242"; g.fillRect(0, h / 2, w, h / 2);
      for (let i = 0; i < 900; i++) { const y = Math.pow(srnd(), 1.4) * h * 0.42, x = srnd() * w, b = srnd(); g.fillStyle = `rgba(${220 + b * 35 | 0},${220 + b * 30 | 0},255,${0.25 + b * 0.75})`; g.fillRect(x, y, b > 0.93 ? 3 : 2, b > 0.93 ? 3 : 2); }
      const mg = g.createRadialGradient(1500, 250, 0, 1500, 250, 120); mg.addColorStop(0, "rgba(220,220,255,0.35)"); mg.addColorStop(1, "rgba(220,220,255,0)"); g.fillStyle = mg; g.fillRect(1380, 130, 240, 240);
      g.fillStyle = "#e8e6f4"; g.beginPath(); g.arc(1500, 250, 26, 0, 7); g.fill(); g.fillStyle = "rgba(160,160,190,0.5)"; g.beginPath(); g.arc(1492, 244, 7, 0, 7); g.arc(1508, 260, 5, 0, 7); g.fill();
    }, false, 2);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(620, 32, 16), new THREE.MeshBasicMaterial({ map: domeT, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -12; G.add(dome);
    // painted skyline band: the top third fades out so its clouds melt into the dome
    const band = new THREE.Mesh(new THREE.CylinderGeometry(300, 300, 190, 32, 1, true), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, transparent: true, visible: false }));
    band.position.set(0, 55, 0); band.renderOrder = -11; G.add(band);
    TEXL.load(HD ? "tex/skyline.png" : "tex/skyline.jpg", (t) => {
      const img = t.image, c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      g.globalCompositeOperation = "destination-out"; const gr = g.createLinearGradient(0, 0, 0, c.height * 0.5); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height * 0.5);
      const ct = new THREE.CanvasTexture(c); ct.colorSpace = THREE.SRGBColorSpace; ct.wrapS = THREE.RepeatWrapping; ct.repeat.set(3, 1); ct.anisotropy = 4; if (HD) ct.magFilter = THREE.NearestFilter;
      band.material.map = ct; band.material.visible = true; band.material.needsUpdate = true;
    });
    // an airliner crossing high over the city: two blinking lights
    const plane = new THREE.Group(), pr = new THREE.MeshBasicMaterial({ color: 0xff3a2a, fog: false }), pw = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    const d1 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 4), pr), d2 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 4), pw); d2.position.x = 6; plane.add(d1, d2); G.add(plane);
    WORLD.anim.push(() => { const t = performance.now() / 1000, k = (t % 70) / 70; plane.position.set(-420 + 840 * k, 230 + Math.sin(k * 3) * 10, -260 + 180 * k); d1.visible = t % 1.1 < 0.25; d2.visible = (t + 0.5) % 1.4 < 0.15; });
  }
  function skySteam(dt) {
    if (!PART.roof) return;
    for (const s of WORLD.roofSteam) if (Math.random() < 0.3) PART.roof.emit(s.x + rnd(-0.3, 0.3), s.y, s.z + rnd(-0.3, 0.3), rnd(-0.2, 0.4), rnd(0.9, 1.5), rnd(-0.2, 0.2), rnd(2.5, 3.5), rnd(0.6, 0.9), 0.9, 0.8, 0.8, 0.9, 0.12);
    PART.roof.step(dt);
  }
