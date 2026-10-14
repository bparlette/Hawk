// ===== copied from Toad City Baltimore src/03f_landmarks_hd_b3.js @ hark/integration e1aaac3 (B3 helpers + Fells Point Thames St rowhouse block with its real signs) =====

// ======================= HD landmarks batch 3 (landmarks pass, 2026-10-13): Fort McHenry, Federal Hill, Sagamore Pendry (Recreation Pier),
// Fells Point (Thames St rowhouses), Under Armour (Tide Point). Same approach as 03b / 03c: one merged toon mesh + one ink hull + one canvas-sign
// atlas per landmark (lmHD), the far LOD = the massing captured by LMCAP in 03_city.js. Ids, positions, footprints, colliders and boss rings are the
// massing's and are not touched here: nothing in this file adds a collider. All lettering is drawn on canvas in code (real wording, no logo files).
const B3 = {
  // a muzzle-loading cannon: barrel from the breech toward angle `a` (0 = +z, PI/2 = +x) on a wooden carriage with two wheels; y = deck height
  cannon(H, x, y, z, a, s = 1, col = '#1d1d20') {
    const dx = Math.sin(a), dz = Math.cos(a), px = Math.cos(a), pz = -Math.sin(a), L = 2.3 * s, yb = y + 0.62 * s;
    H.seg([x - dx * L * 0.42, yb, z - dz * L * 0.42], [x + dx * L * 0.58, yb + 0.12 * s, z + dz * L * 0.58], 0.2 * s, col, { r1: 0.13 * s, seg: 8, ol: true });
    H.add(new THREE.SphereGeometry(0.2 * s, 8, 4).translate(x - dx * L * 0.42, yb, z - dz * L * 0.42), col, { ol: false });
    H.seg([x - dx * 0.95 * s, y + 0.3 * s, z - dz * 0.95 * s], [x + dx * 0.55 * s, y + 0.42 * s, z + dz * 0.55 * s], 0.2 * s, '#5a3a22', { seg: 4 });
    for (const k of [-1, 1]) { const wx = x + px * 0.34 * s * k + dx * 0.25 * s, wz = z + pz * 0.34 * s * k + dz * 0.25 * s;
      H.seg([wx - px * 0.06 * s, y + 0.34 * s, wz - pz * 0.06 * s], [wx + px * 0.06 * s, y + 0.34 * s, wz + pz * 0.06 * s], 0.34 * s, '#3a2a1a', { seg: 10 }); }
  },
  tree(H, x, y, z, s = 1) {
    H.cyl(x, y, z, 0.13 * s, 0.2 * s, 2.6 * s, 6, '#5a4030', { ol: false });
    const g = new THREE.IcosahedronGeometry(1.5 * s, 0); g.translate(x, y + 3.5 * s, z); H.add(g, LMR() < 0.5 ? '#4f7f3a' : '#5d8a40');
    const g2 = new THREE.IcosahedronGeometry(1.05 * s, 0); g2.rotateY(0.7); g2.translate(x + 0.5 * s, y + 4.5 * s, z - 0.3 * s); H.add(g2, '#6a9a48', { ol: false });
  },
  // a black lantern lamppost (Fells Point / park style)
  lantern(H, x, y, z, h = 3.6) {
    H.cyl(x, y, z, 0.07, 0.11, h, 6, '#1a1c1e', { ol: false }); H.cyl(x, y, z, 0.16, 0.18, 0.5, 6, '#1a1c1e', { ol: false });
    H.cyl(x, y + h, z, 0.22, 0.13, 0.5, 6, '#2a2c2e', { ol: false, emi: '#ffd890' }); H.cyl(x, y + h + 0.5, z, 0.02, 0.26, 0.22, 6, '#1a1c1e', { ol: false });
  },
  // a waving flag from canvas strips hung off a pole top (px, ytop, pz) flying toward angle `a`; draw(g, W, H) paints the whole flag
  flag(SG, px, ytop, pz, a, W, Hf, draw, n = 5, amp = 0.35) {
    const dx = Math.sin(a), dz = Math.cos(a), nx = Math.cos(a), nz = -Math.sin(a);
    const P = (u) => { const w = Math.sin(u / W * 5.2) * amp * (u / W + 0.15); return [px + dx * u + nx * w, pz + dz * u + nz * w]; };
    for (let k = 0; k < n; k++) { const u0 = k * W / n, u1 = (k + 1) * W / n, [ax, az] = P(u0), [bx, bz] = P(u1), sag0 = u0 / W * 0.25, sag1 = u1 / W * 0.25;
      SG.quad([ax, ytop - Hf - sag0, az], [bx, ytop - Hf - sag1, bz], [bx, ytop - sag1, bz], [ax, ytop - sag0, az], W / n, Hf, (g, w, h) => { g.save(); g.translate(-k * w, 0); draw(g, w * n, h); g.restore(); }); }
  },
  star(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); },
  // the 1795 Star-Spangled Banner: 15 stripes, 15 stars (5 staggered rows of 3) on a canton over 8 stripes
  banner15(g, W, Hh) {
    for (let i = 0; i < 15; i++) { g.fillStyle = i % 2 ? '#f4f1ea' : '#b8202c'; g.fillRect(0, i * Hh / 15, W, Hh / 15 + 1); }
    const cw = W * 0.38, ch = Hh * 8 / 15; g.fillStyle = '#23336e'; g.fillRect(0, 0, cw, ch);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) B3.star(g, cw * ((c + (r % 2 ? 0.75 : 0.35)) / 3.1) + cw * 0.04, ch * (r + 0.6) / 5.2, Math.min(cw, ch) * 0.075, '#f4f1ea');
  },
  // the modern 50-star US flag
  usFlag(g, W, Hh) {
    for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#f4f1ea' : '#b8202c'; g.fillRect(0, i * Hh / 13, W, Hh / 13 + 1); }
    const cw = W * 0.4, ch = Hh * 7 / 13; g.fillStyle = '#23336e'; g.fillRect(0, 0, cw, ch);
    for (let r = 0; r < 9; r++) for (let c = 0; c < (r % 2 ? 5 : 6); c++) B3.star(g, cw * ((c + (r % 2 ? 1 : 0.5)) / 6), ch * (r + 0.5) / 9, ch * 0.045, '#f4f1ea');
  },
  // the Maryland flag (Calvert gold/black paly + Crossland red/white bottony cross quarters), simplified
  mdFlag(g, W, Hh) {
    const q = (x0, y0, w, h, calvert) => { g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
      if (calvert) { for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#111' : '#e8b020'; g.fillRect(x0 + i * w / 6, y0, w / 6 + 1, h); }
        g.beginPath(); g.moveTo(x0, y0 + h); g.lineTo(x0 + w, y0); g.lineTo(x0 + w, y0 + h); g.closePath(); g.save(); g.clip(); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#e8b020' : '#111'; g.fillRect(x0 + i * w / 6, y0, w / 6 + 1, h); } g.restore(); }
      else { g.fillStyle = '#f4f1ea'; g.fillRect(x0, y0, w, h); g.fillStyle = '#c0202c'; g.fillRect(x0 + w / 2, y0, w / 2, h / 2); g.fillRect(x0, y0 + h / 2, w / 2, h / 2);
        g.fillStyle = '#c0202c'; g.fillRect(x0 + w * 0.44, y0 + h * 0.1, w * 0.12, h * 0.8); g.fillRect(x0 + w * 0.1, y0 + h * 0.44, w * 0.8, h * 0.12); }
      g.restore(); };
    q(0, 0, W / 2, Hh / 2, true); q(W / 2, 0, W / 2, Hh / 2, false); q(0, Hh / 2, W / 2, Hh / 2, false); q(W / 2, Hh / 2, W / 2, Hh / 2, true);
  },
  // a flat ribbon of quads over the ground following groundY (paths / ditches), polyline pts [[x,z],...], width w, lift above ground
  ribbon(H, pts, w, col, lift = 0.04, closed = false) {
    const P = [], N = closed ? pts.length : pts.length - 1, gy = (x, z) => CURB + hillH(x, z) + lift;
    for (let i = 0; i < N; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L * w / 2, nz = (bx - ax) / L * w / 2;
      const a0 = [ax - nx, gy(ax - nx, az - nz), az - nz], a1 = [ax + nx, gy(ax + nx, az + nz), az + nz], b0 = [bx - nx, gy(bx - nx, bz - nz), bz - nz], b1 = [bx + nx, gy(bx + nx, bz + nz), bz + nz];
      P.push(...a0, ...b1, ...b0, ...a0, ...a1, ...b1); }
    return H.tris(P, col, { ol: false });
  },
};
// ======================= FELLS POINT - Thames St / Broadway (refs/fells-point: cobble_1, thames_1/2, broadway_1). The market block becomes a row of
// 18th-19th c. rowhouses on every face: red/orange brick and painted fronts (yellow, cream, green, slate), white trim and cornices, dormers and
// chimneys, shopfronts with green awnings on Thames St (south, the harbour side), wall-mounted lanterns; THE HORSE YOU CAME IN ON SALOON and the cream
// ADMIRAL FELL INN at the Broadway corner, BROADWAY MARKET on the west face. All facades sit on the massing box; nothing stands proud of the collider.
lmHD('fells', 150, -58, 18, (H, signs, SG) => {
  const Y0 = CURB, x0 = 141, x1 = 159, z0 = -64, z1 = -52;
  const COLS = ['#a8503a', '#b8603e', '#9a4632', '#e2c464', '#ece2c8', '#5f7f5a', '#c06848', '#8a8c94', '#b85a40', '#d8b878'];
  H.box(x0 + 0.4, Y0, z0 + 0.4, x1 - 0.4, Y0 + 6.2, z1 - 0.4, '#7a4a3a', { ol: false }); // the core (hidden by the fronts)
  const faces = [['s', H.frame(x0, z1, x1, z1)], ['e', H.frame(x1, z1, x1, z0)], ['n', H.frame(x1, z0, x0, z0)], ['w', H.frame(x0, z0, x0, z1)]];
  LMR(9191); let ci = 0;
  for (const [k, F] of faces) {
    let u = 0; const L = F.L;
    while (u < L - 0.5) {
      let w = 3.4 + LMR() * 1.6; if (L - u - w < 2.6) w = L - u; const u1 = Math.min(L, u + w);
      const corner = k === 's' && u === 0, inn = k === 'w' && u1 >= L - 0.01; // the Admiral Fell Inn wraps the south-west corner
      const floors = inn ? 4 : 3 + (LMR() < 0.35 ? 1 : 0) - (LMR() < 0.15 ? 1 : 0), h = floors * 2.6 + 0.9, col = inn || corner ? '#ece2c8' : COLS[ci++ % COLS.length];
      H.fbox(F, u, u1, Y0, Y0 + h, -0.5, 0.0, col); // front
      H.fbox(F, u - 0.05, u1 + 0.05, Y0 + h - 0.55, Y0 + h, 0, 0.32, '#f2efe6'); // cornice
      for (let b = u + 0.4; b < u1 - 0.2; b += 0.55) H.fbox(F, b, b + 0.14, Y0 + h - 0.8, Y0 + h - 0.55, 0, 0.22, '#f2efe6', { ol: false }); // brackets
      // a pitched slate roof behind the cornice + a chimney and a dormer
      { const g = new THREE.BufferGeometry(), A = [u, Y0 + h, 0], B = [u1, Y0 + h, 0], C = [u1, Y0 + h + 1.6, -3.2], D = [u, Y0 + h + 1.6, -3.2];
        g.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...C, ...A, ...C, ...D], 3)); g.computeVertexNormals(); H.fgeo(F, g, '#4a4a52', { ol: false }); }
      if (LMR() < 0.55) H.fbox(F, u + (u1 - u) * 0.3, u + (u1 - u) * 0.7, Y0 + h + 0.2, Y0 + h + 1.5, -1.6, -0.6, '#f2efe6', { ol: false });
      H.fbox(F, u1 - 0.9, u1 - 0.3, Y0 + h, Y0 + h + 2.4, -2.8, -2.2, '#8a3e2e');
      // windows (white frames, dark panes, shutters on the painted fronts)
      const shut = LMR() < 0.5 ? (LMR() < 0.5 ? '#1f3a2a' : '#1c2430') : null;
      H.windows(F, u + 0.2, u1 - 0.2, Y0 + 3.0, Y0 + h - 0.8, { bw: 1.3, fh: 2.6, ww: 0.7, wh: 1.5, pane: '#22262c', head: '#f2efe6', sill: '#f2efe6', mull: '#f2efe6', lit: 0.4 });
      if (shut) { const nb = Math.max(1, Math.round((u1 - u - 0.4) / 1.3)), bwr = (u1 - u - 0.4) / nb; for (let f = 0; f < floors - 1; f++) for (let b = 0; b < nb; b++) { const uc = u + 0.2 + (b + 0.5) * bwr, yb = Y0 + 3.0 + f * 2.6 + 0.45;
        for (const s of [-1, 1]) H.fbox(F, uc + s * 0.35 - (s < 0 ? 0.3 : 0), uc + s * 0.35 + (s > 0 ? 0.3 : 0), yb, yb + 1.5, 0, 0.05, shut, { ol: false }); } }
      // ground floor: shopfront (south) or door + window (other faces)
      if (k === 's') { H.fbox(F, u + 0.3, u1 - 0.3, Y0 + 0.2, Y0 + 2.5, -0.05, 0.02, '#1e2226', { ol: false, emi: LMR() < 0.7 ? '#ffcf7a' : null });
        H.fbox(F, u + 0.15, u1 - 0.15, Y0 + 2.5, Y0 + 2.75, 0, 0.12, '#2a3a2a', { ol: false });
        if (LMR() < 0.75) { const g = new THREE.BoxGeometry(u1 - u - 0.3, 0.06, 1.1); g.rotateX(0.38); g.translate((u + u1) / 2, Y0 + 2.6, 0.5); H.fgeo(F, g, '#2f5a36', { ol: false }); } }
      else { H.fbox(F, u + 0.4, u + 1.3, Y0 + 0.15, Y0 + 2.4, -0.05, 0.02, '#3a2a22', { ol: false }); H.farch(F, u + 0.85, Y0 + 2.4, 0.45, -0.05, 0.02, '#f2efe6', { ol: false }, 6);
        H.fbox(F, u + 0.3, u + 1.4, Y0, Y0 + 0.3, 0, 0.5, '#e8e4dc', { ol: false }); // marble stoop
        H.windows(F, u + 1.6, u1 - 0.2, Y0 + 0.5, Y0 + 2.6, { bw: 1.3, fh: 2.1, ww: 0.7, wh: 1.4, pane: '#22262c', head: '#f2efe6', lit: 0.3 }); }
      // wall lanterns between fronts on Thames St
      if (k === 's' || k === 'w') { const x = F.xa + F.ux * u1 + F.nx * 0.25, z = F.za + F.uz * u1 + F.nz * 0.25; H.box(x - 0.12, Y0 + 2.9, z - 0.12, x + 0.12, Y0 + 3.4, z + 0.12, '#2a2c2e', { ol: false, emi: '#ffd890' }); }
      u = u1;
    }
  }
  // signs (real Fells Point wording, drawn): the saloon, the inn, Broadway Market
  const S = faces[0][1], W = faces[3][1];
  SG.add(S, 8.2, Y0 + 2.8, 6.4, 0.7, 0.2, (g, w, h) => { g.fillStyle = '#1e2a1e'; g.fillRect(0, 0, w, h); sText(g, 'THE HORSE YOU CAME IN ON SALOON', w / 2, h / 2, w * 0.94, h * 0.62, SERIF, '#e8c870', { weight: 'bold' }); });
  SG.add(S, 13.4, Y0 + 3.2, 2.2, 1.4, 0.2, (g, w, h) => { g.fillStyle = '#1e2a1e'; g.fillRect(0, 0, w, h); sText(g, 'EST.', w / 2, h * 0.3, w * 0.8, h * 0.24, SERIF, '#e8c870'); sText(g, '1775', w / 2, h * 0.66, w * 0.8, h * 0.4, SERIF, '#e8c870'); });
  SG.add(S, 2.3, Y0 + 7.0, 4.0, 0.75, 0.15, (g, w, h) => sText(g, 'ADMIRAL FELL INN', w / 2, h / 2, w * 0.96, h * 0.8, SERIF, '#2a3a5a', { weight: 'bold' }));
  SG.add(W, W.L - 2.4, Y0 + 7.0, 4.0, 0.75, 0.15, (g, w, h) => sText(g, 'ADMIRAL FELL INN', w / 2, h / 2, w * 0.96, h * 0.8, SERIF, '#2a3a5a', { weight: 'bold' }));
  SG.add(W, 4.6, Y0 + 2.75, 6.8, 0.9, 0.2, (g, w, h) => { g.fillStyle = '#6a2a22'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8dcc0'; g.lineWidth = h * 0.06; g.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16);
    sText(g, 'BROADWAY MARKET', w / 2, h / 2, w * 0.9, h * 0.6, SERIF, '#f2e8cc', { weight: 'bold' }); });
  SG.add(S, S.L - 3.0, Y0 + 2.8, 4.4, 0.7, 0.2, (g, w, h) => { g.fillStyle = '#2f5a36'; g.fillRect(0, 0, w, h); sText(g, 'FELLS POINT', w / 2, h / 2, w * 0.9, h * 0.62, SERIF, '#f2efe6', { weight: 'bold', track: h * 0.06 }); });
});

