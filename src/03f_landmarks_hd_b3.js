
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

// ======================= FORT McHENRY (refs/fort-mchenry: aerial_web_1/2 star plan, fort_1 parade ground, fort_2 sally port). The five-point star of
// red-brick scarp walls with stone coping and green grass ramparts on top, inside a mown ditch band + an outer star path (the covered way);
// cannons on the bastion points; the red-brick barracks with white two-tier porches on the parade ground with a gravel ring; the giant 15-star,
// 15-stripe Star-Spangled Banner on a tall white pole; brick sally-port gate piers and the brown park sign out front. The north bastion gun
// platform, its ramp and the set-piece cannon (09_fort.js) stay in the city mesh (not captured), so the HD model leaves them alone.
lmHD('fort', 176, 78, 26, (H, signs, SG) => {
  const cx = 176, cz = 78, R = 17, r = 10.5, Y0 = CURB, WH = 4.2, BR = '#9a4a36', BR2 = '#8a4030', COP = '#d9d1bd', GR = '#5f9440', GR2 = '#6fa64c';
  const star = (Ro, ri) => { const V = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? ri : Ro; V.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); } return V; };
  const V = star(R, r);
  // the ditch (a darker mown band hugging the walls) and the outer star path (covered way) - flat, over the lawn
  const D = star(R + 5.2, r + 3.2), Pth = star(R + 7.6, r + 4.6);
  { const P = []; for (let i = 0; i < 10; i++) { const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 10], [cx2, cz2] = D[(i + 1) % 10], [dx2, dz2] = D[i];
      P.push(ax, Y0 + 0.03, az, dx2, Y0 + 0.03, dz2, cx2, Y0 + 0.03, cz2, ax, Y0 + 0.03, az, cx2, Y0 + 0.03, cz2, bx, Y0 + 0.03, bz); }
    H.tris(P, '#4d7d36', { ol: false }); }
  B3.ribbon(H, D, 0.5, '#8a7a5a', 0.045, true); // the counterscarp edge
  B3.ribbon(H, Pth, 1.4, '#d4cbb2', 0.04, true); // the gravel covered way
  for (let i = 0; i < 10; i++) {
    const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 10], L = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2, ang = Math.atan2(-(bz - az), bx - ax);
    if (i === 5) continue; // the sally port gap (same as the massing)
    const wall = (len, th, y0, h, col, o, off = 0) => { const g = new THREE.BoxGeometry(len, h, th); g.translate(0, y0 + h / 2, off); g.rotateY(ang); g.translate(mx, 0, mz); H.add(g, col, o); };
    wall(L + 1.2, 2.4, Y0, WH - 0.55, BR); // brick scarp
    for (let y = 0.7; y < WH - 0.7; y += 0.7) wall(L + 1.22, 2.42, Y0 + y, 0.06, BR2, { ol: false }); // brick coursing lines
    wall(L + 1.3, 2.55, Y0 + WH - 0.55, 0.3, COP); // stone coping
    wall(L + 1.1, 2.3, Y0 + WH - 0.25, 0.45, GR); // grass rampart on top
    const g = new THREE.CylinderGeometry(0.01, 1.15, 0.7, 4, 1); g.scale(L / 1.6, 1, 1); g.rotateY(ang); g.translate(mx, Y0 + WH + 0.55, mz); H.add(g, GR2, { ol: false }); // the turf parapet ridge
  }
  // stone quoins on the bastion points
  for (let i = 0; i < 10; i += 2) { const [x, z] = V[i]; H.cyl(x, Y0, z, 1.0, 1.1, WH - 0.55, 6, '#b8ac96', { ol: false }); }
  // cannons on the ramparts at four bastion points (the north one is the set piece's own gun platform), pointing out
  for (const i of [2, 4, 6, 8]) { const [x, z] = V[i], a = Math.atan2(x - cx, z - cz), ix = cx + (x - cx) * 0.84, iz = cz + (z - cz) * 0.84;
    B3.cannon(H, ix, Y0 + WH + 0.2, iz, a, 1.0); B3.cannon(H, ix + Math.cos(a) * 1.8, Y0 + WH + 0.2, iz - Math.sin(a) * 1.8, a, 1.0); }
  // sally port: brick gate piers with stone caps at both ends of the gap, and a lintel arch sign over a brick screen just inside (fort_2)
  { const [ax, az] = V[5], [bx, bz] = V[6];
    for (const [x, z] of [[ax, az], [bx, bz]]) { H.box(x - 1.3, Y0, z - 1.3, x + 1.3, Y0 + WH + 1.2, z + 1.3, BR); H.box(x - 1.45, Y0 + WH + 1.2, z - 1.45, x + 1.45, Y0 + WH + 1.5, z + 1.45, COP); }
    const ang = Math.atan2(bz - az, bx - ax), nx = Math.sin(ang), nz = -Math.cos(ang), sx = (ax + bx) / 2 + nx * 9.5, sz = (az + bz) / 2 + nz * 9.5;
    // the brown park sign out on the lawn in front of the gap (posts + board)
    const out = Math.hypot(sx - cx, sz - cz) > Math.hypot((ax + bx) / 2 - cx, (az + bz) / 2 - cz) ? 1 : -1, ox = (ax + bx) / 2 + nx * 9.5 * out, oz = (az + bz) / 2 + nz * 9.5 * out;
    const ry = Math.atan2(ox - cx, oz - cz), F = H.frame(ox - Math.cos(ry) * 2.4, oz + Math.sin(ry) * 2.4, ox + Math.cos(ry) * 2.4, oz - Math.sin(ry) * 2.4);
    H.fbox(F, 0.2, 0.45, Y0, Y0 + 2.4, -0.15, 0.1, '#4a3424'); H.fbox(F, 4.35, 4.6, Y0, Y0 + 2.4, -0.15, 0.1, '#4a3424'); H.fbox(F, 0, 4.8, Y0 + 1.0, Y0 + 2.5, -0.1, 0.05, '#5b3c26');
    SG.add(F, 2.4, Y0 + 1.06, 4.6, 1.38, 0.07, (g, w, h) => { g.fillStyle = '#5b3c26'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8dcc0'; g.lineWidth = h * 0.03; g.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1);
      sText(g, 'FORT McHENRY', w / 2, h * 0.36, w * 0.9, h * 0.34, SERIF, '#f2e8cc', { weight: 'bold' });
      sText(g, 'NATIONAL MONUMENT AND HISTORIC SHRINE', w / 2, h * 0.66, w * 0.88, h * 0.13, SANS, '#f2e8cc', { weight: 'bold' });
      sText(g, 'National Park Service', w / 2, h * 0.84, w * 0.6, h * 0.1, SANS, '#e8dcc0', { weight: '500' }); }); }
  // the barracks on the massing's interior block (170..179 x 75..79): red brick, two storeys, white two-tier porch on the south (parade) side, red roof
  { const x0 = 170, x1 = 179, z0 = 75, z1 = 78.1, h = 5.6;
    H.box(x0, Y0, z0, x1, Y0 + h, z1, BR); H.box(x0 - 0.15, Y0 + h, z0 - 0.15, x1 + 0.15, Y0 + h + 0.25, z1 + 1.05, '#e6e0d0');
    H.hip(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 1.2, Y0 + h + 0.25, 1.6, '#b4574a');
    const S = H.frame(x0, z1, x1, z1); H.windows(S, 0.6, 8.4, Y0 + 0.3, Y0 + h - 0.2, { bw: 1.5, fh: 2.7, ww: 0.7, wh: 1.5, pane: '#2a2622', head: '#e6e0d0', lit: 0.3 });
    const N = H.frame(x1, z0, x0, z0); H.windows(N, 0.6, 8.4, Y0 + 0.3, Y0 + h - 0.2, { bw: 1.5, fh: 2.7, ww: 0.7, wh: 1.5, pane: '#2a2622', head: '#e6e0d0', lit: 0.3 });
    for (let x = x0 + 0.3; x <= x1 - 0.2; x += 1.45) H.box(x - 0.09, Y0, z1 + 0.75, x + 0.09, Y0 + h, z1 + 0.93, '#f2efe6', { ol: false }); // porch posts
    H.box(x0, Y0 + 2.7, z1, x1, Y0 + 2.86, z1 + 0.95, '#e6e0d0', { ol: false }); // the upper porch floor
    for (const y of [Y0 + 3.6, Y0 + 0.9]) H.box(x0, y, z1 + 0.82, x1, y + 0.07, z1 + 0.9, '#f2efe6', { ol: false }); // the white railings
    for (let x = x0 + 0.15; x < x1; x += 0.3) H.box(x - 0.02, Y0 + 2.86, z1 + 0.84, x + 0.02, Y0 + 3.6, z1 + 0.88, '#f2efe6', { ol: false });
    for (const x of [x0 + 1.2, x1 - 1.2]) H.box(x - 0.3, Y0 + h + 0.8, (z0 + z1) / 2 - 0.3, x + 0.3, Y0 + h + 2.2, (z0 + z1) / 2 + 0.3, '#8a4030'); }
  // the parade ground: a gravel ring round the flagpole lawn
  { const fx = cx + 5, fz = cz + 4, pts = []; for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; pts.push([fx + Math.cos(a) * 3.6, fz + Math.sin(a) * 2.6]); } B3.ribbon(H, pts, 1.1, '#d8d0bc', 0.035, true); }
  // the giant flagpole (on the massing pole's spot) with the 15-star Star-Spangled Banner flying east
  { const fx = cx + 5, fz = cz + 4, ph = 27;
    H.cyl(fx, Y0, fz, 0.42, 0.55, 0.6, 8, '#cfc8b8'); H.cyl(fx, Y0, fz, 0.13, 0.22, ph, 8, '#f2f0ea', { ol: false }); H.add(new THREE.SphereGeometry(0.3, 8, 6).translate(fx, Y0 + ph + 0.25, fz), '#d8b040', { ol: false });
    B3.flag(SG, fx + 0.15, Y0 + ph - 0.3, fz, Math.PI / 2, 11, 6.6, B3.banner15, 6, 0.55); }
});

// ======================= FEDERAL HILL PARK (refs/federal-hill: park_1 cannon + skyline, park_2 slope, park_3 aerial). The hill itself (heightfield,
// collision, the Hon Queen's ring) is the city's; this adds the park on it: the brick stair straight up the north face with black rails, the brick
// crest walk, black Civil War cannon on octagonal concrete plinths along the north crest aimed at downtown, a black iron rail on the crest,
// the stone obelisk, lantern posts, a ring of trees on the south/east/west brow, the tall US flag on the summit pole and the park sign at the foot.
lmHD('fedhill', -3, 59, 28, (H, signs, SG) => {
  const gy = (x, z) => CURB + hillH(x, z);
  const ell = (d, a) => [HILL.x + Math.cos(a) * HILL.rx * d, HILL.z + Math.sin(a) * HILL.rz * d]; // a = -PI/2 is due north (toward the harbour)
  // the crest walk (brick) round the brow, and the stair up the north face
  { const pts = []; for (let i = 0; i < 40; i++) pts.push(ell(0.34, i / 40 * TAU)); B3.ribbon(H, pts, 1.4, '#a85a44', 0.05, true); }
  { const x = HILL.x, zs = HILL.z - HILL.rz * 1.02, ze = HILL.z - HILL.rz * 0.3; let zPrev = zs, yPrev = gy(x, zs);
    B3.ribbon(H, [[x, zs - 1.2], [x, zs]], 2.6, '#b8b0a0', 0.04); // landing at the foot
    for (let z = zs; z < ze; z += 0.45) { const y = gy(x, z + 0.45); H.box(x - 1.2, Math.min(yPrev, y) - 0.25, z, x + 1.2, y + 0.04, z + 0.45, (Math.round(z / 0.45) % 2) ? '#bdb5a5' : '#c9c1b1', { ol: false }); yPrev = y; zPrev = z; }
    for (const sx of [-1.35, 1.35]) { const pts = []; for (let z = zs; z <= ze + 0.01; z += (ze - zs) / 8) pts.push([x + sx, gy(x + sx, z) + 1.0, z]);
      for (let k = 0; k < pts.length - 1; k++) H.seg(pts[k], pts[k + 1], 0.045, '#1a1c1e', { seg: 4 });
      for (const p of pts) H.seg([p[0], p[1] - 1.0, p[2]], p, 0.04, '#1a1c1e', { seg: 4 }); } }
  // black iron rail along the north crest, broken for the stair
  { const pts = []; for (let a = -Math.PI * 0.92; a <= -Math.PI * 0.08 + 1e-3; a += Math.PI / 30) { const [x, z] = ell(0.27, a); pts.push([x, gy(x, z) + 0.95, z]); }
    for (let k = 0; k < pts.length - 1; k++) { if (Math.abs((pts[k][0] + pts[k + 1][0]) / 2 - HILL.x) < 1.8) continue; H.seg(pts[k], pts[k + 1], 0.04, '#1a1c1e', { seg: 4 });
      const p = pts[k]; H.seg([p[0], p[1] - 0.95, p[2]], p, 0.035, '#1a1c1e', { seg: 4 }); } }
  // Civil War cannon on octagonal concrete plinths on the north brow, aimed at downtown (north-west / north)
  for (const a of [-Math.PI * 0.8, -Math.PI * 0.66, -Math.PI * 0.36, -Math.PI * 0.22]) { const [x, z] = ell(0.24, a), y = gy(x, z);
    H.cyl(x, y - 0.4, z, 0.8, 0.85, 1.45, 8, '#c8c2b4'); const ga = Math.atan2(x - HILL.x - 4, z - HILL.z) * 0.35 + Math.PI;
    H.seg([x - Math.sin(ga) * 1.1, y + 1.35, z - Math.cos(ga) * 1.1], [x + Math.sin(ga) * 1.6, y + 1.5, z + Math.cos(ga) * 1.6], 0.24, '#1b1b1e', { r1: 0.15, seg: 8, ol: true });
    H.add(new THREE.SphereGeometry(0.25, 8, 4).translate(x - Math.sin(ga) * 1.1, y + 1.35, z - Math.cos(ga) * 1.1), '#1b1b1e', { ol: false }); }
  // the stone obelisk monument on the east brow
  { const [x, z] = ell(0.33, -0.15), y = gy(x, z); H.box(x - 1, y - 0.3, z - 1, x + 1, y + 0.8, z + 1, '#bdb6a8'); H.cyl(x, y + 0.8, z, 0.35, 0.6, 5.2, 4, '#d4cebf', { ry: Math.PI / 4 }); H.cyl(x, y + 6.0, z, 0.0, 0.35, 0.7, 4, '#d4cebf', { ry: Math.PI / 4 }); }
  // lantern posts round the crest walk
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i + 0.5) / 8 * TAU, [x, z] = ell(0.42, a); B3.lantern(H, x, gy(x, z) - 0.1, z, 3.4); }
  // trees on the south / east / west brow (the north face stays open lawn like the real slope)
  LMR(4242);
  for (let i = 0; i < 26; i++) { const a = -Math.PI * 0.05 + (i / 26) * Math.PI * 1.1 + (LMR() - 0.5) * 0.08, d = 0.5 + LMR() * 0.38, [x, z] = ell(d, a); B3.tree(H, x, gy(x, z) - 0.1, z, 0.85 + LMR() * 0.4); }
  for (const a of [-Math.PI * 0.97, -Math.PI * 0.03]) { const [x, z] = ell(0.7, a); B3.tree(H, x, gy(x, z) - 0.1, z, 1.1); }
  // the summit flagpole (the massing pole's spot) with a big US flag flying east
  { const y = gy(HILL.x, HILL.z); H.cyl(HILL.x, y - 0.2, HILL.z, 0.4, 0.5, 0.6, 8, '#c8c2b4'); H.cyl(HILL.x, y, HILL.z, 0.1, 0.17, 17, 8, '#f2f0ea', { ol: false });
    H.add(new THREE.SphereGeometry(0.22, 8, 6).translate(HILL.x, y + 17.2, HILL.z), '#d8b040', { ol: false });
    B3.flag(SG, HILL.x + 0.1, y + 16.8, HILL.z, Math.PI / 2, 6.4, 3.4, B3.usFlag, 5, 0.35); }
  // the park sign at the foot of the stair (brown board, cream lettering)
  { const x = HILL.x + 3.6, z = HILL.z - HILL.rz * 1.06, F = H.frame(x - 1.7, z, x + 1.7, z); // facing... north: build on a south-to-north frame
    const Fn = H.frame(x + 1.7, z, x - 1.7, z); H.fbox(Fn, 0.15, 0.35, CURB, CURB + 2.0, -0.1, 0.1, '#3a2a1c'); H.fbox(Fn, 3.05, 3.25, CURB, CURB + 2.0, -0.1, 0.1, '#3a2a1c'); H.fbox(Fn, 0, 3.4, CURB + 0.9, CURB + 2.1, -0.08, 0.04, '#4a3424');
    SG.add(Fn, 1.7, CURB + 0.96, 3.2, 1.08, 0.06, (g, w, h) => { g.fillStyle = '#4a3424'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8dcc0'; g.lineWidth = h * 0.03; g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
      sText(g, 'FEDERAL HILL PARK', w / 2, h * 0.42, w * 0.88, h * 0.34, SERIF, '#f2e8cc'); sText(g, 'BALTIMORE CITY RECREATION & PARKS', w / 2, h * 0.74, w * 0.8, h * 0.13, SANS, '#e8dcc0'); }); void F; }
});

// ======================= SAGAMORE PENDRY - the 1914 RECREATION PIER (refs/sagamore-pendry: pendry_1, pier_1/2). Red brick Beaux-Arts head house in
// the middle (taller), cream stone base band, the huge round carriage arch through the base (both faces), a giant order of white columns with arched
// windows between, the RECREATION PIER frieze, a brick attic and a cream pediment with the carved crest; the maroon PENDRY banners; brick wings with
// cream trim and balustrades either side; the pool deck (turquoise pool, navy loungers, cabana) on the east wing roof (kept from the massing).
lmHD('pendry', 126, -25, 17, (H, signs, SG) => {
  const Y0 = CURB, z0 = -29, z1 = -21.5, BR = '#9a4636', CR = '#e8e0cc', CR2 = '#d8cfb8', hx0 = 119.5, hx1 = 132.5, HH = 13.4, WH = 9;
  // wings
  for (const [x0, x1] of [[112, hx0], [hx1, 140]]) {
    H.box(x0, Y0, z0, x1, Y0 + WH, z1, BR); H.box(x0 - 0.1, Y0, z0 - 0.1, x1 + 0.1, Y0 + 1.2, z1 + 0.1, CR2); // cream water table
    H.box(x0 - 0.2, Y0 + WH - 0.6, z0 - 0.2, x1 + 0.2, Y0 + WH, z1 + 0.2, CR); // cornice
    for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.55) for (const z of [z0 + 0.05, z1 - 0.05]) H.box(x - 0.06, Y0 + WH, z - 0.06, x + 0.06, Y0 + WH + 0.8, z + 0.06, CR, { ol: false }); // balustrade
    for (const z of [z0 + 0.05, z1 - 0.05]) H.box(x0, Y0 + WH + 0.8, z - 0.1, x1, Y0 + WH + 0.95, z + 0.1, CR, { ol: false });
    for (const F of [H.frame(x0, z1, x1, z1), H.frame(x1, z0, x0, z0)]) { H.windows(F, 0.3, F.L - 0.3, Y0 + 1.4, Y0 + WH - 0.8, { bw: 1.75, fh: 3.4, ww: 0.95, wh: 2.1, pane: '#262a30', head: CR, sill: CR, arch: true, lit: 0.45 }); H.band(F, 0, F.L, Y0 + 4.7, Y0 + 4.9, 0.12, CR, { ol: false }); }
  }
  for (const F of [H.frame(112, z0, 112, z1), H.frame(140, z1, 140, z0)]) H.windows(F, 0.4, F.L - 0.4, Y0 + 1.4, Y0 + WH - 0.8, { bw: 1.8, fh: 3.4, ww: 0.95, wh: 2.1, pane: '#262a30', head: CR, arch: true, lit: 0.45 });
  // head house
  H.box(hx0, Y0, z0 - 0.4, hx1, Y0 + HH, z1 + 0.4, BR);
  H.box(hx0 - 0.15, Y0, z0 - 0.55, hx1 + 0.15, Y0 + 1.5, z1 + 0.55, CR2);
  H.box(hx0 - 0.25, Y0 + 11.0, z0 - 0.75, hx1 + 0.25, Y0 + 12.3, z1 + 0.75, CR); // entablature
  H.box(hx0 - 0.3, Y0 + HH, z0 - 0.6, hx1 + 0.3, Y0 + HH + 0.35, z1 + 0.6, CR); // top cornice
  H.prism('z', z0 - 0.6, z1 + 0.6, [[hx0 - 0.3, Y0 + HH + 0.35], [hx1 + 0.3, Y0 + HH + 0.35], [(hx0 + hx1) / 2, Y0 + HH + 3.2]], '#b04c3a'); // brick pediment / gable
  for (const z of [z0 - 0.62, z1 + 0.62]) { const s = z < -25 ? -1 : 1; // cream raking cornices on both gables
    H.seg([hx0 - 0.4, Y0 + HH + 0.4, z + s * 0.06], [(hx0 + hx1) / 2, Y0 + HH + 3.35, z + s * 0.06], 0.22, CR, { seg: 4 }); H.seg([(hx0 + hx1) / 2, Y0 + HH + 3.35, z + s * 0.06], [hx1 + 0.4, Y0 + HH + 0.4, z + s * 0.06], 0.22, CR, { seg: 4 }); }
  H.hip(hx0 - 0.1, z0 - 0.3, hx1 + 0.1, z1 + 0.3, Y0 + HH + 0.3, 2.9, '#6a5a52');
  for (const F of [H.frame(hx1, z0 - 0.4, hx0, z0 - 0.4), H.frame(hx0, z1 + 0.4, hx1, z1 + 0.4)]) { const L = F.L, m = L / 2;
    // the carriage arch: dark opening + cream voussoir ring + keystone
    H.fbox(F, m - 3.1, m + 3.1, Y0, Y0 + 2.9, -0.3, 0.02, '#1c1a18', { ol: false }); H.farch(F, m, Y0 + 2.9, 3.1, -0.3, 0.02, '#1c1a18', { ol: false }, 14);
    { const g = new THREE.RingGeometry(3.1, 3.6, 16, 1, 0, Math.PI); g.translate(m, Y0 + 2.9, 0.06); H.fgeo(F, g, CR, { ol: false }); }
    H.fbox(F, m - 0.35, m + 0.35, Y0 + 5.7, Y0 + 6.5, 0, 0.12, CR, { ol: false });
    H.band(F, 0, L, Y0 + 6.5, Y0 + 6.8, 0.2, CR); // the stone band over the base
    for (let u = 1.2; u < L; u += 1.6) if (Math.abs(u - m) > 3.8) H.fbox(F, u - 0.4, u + 0.4, Y0 + 2.0, Y0 + 3.3, -0.05, 0.02, '#262a30', { ol: false }); // small base windows
    // the giant order: 6 white columns, arched windows between, corner pavilions with quoins
    const cs = [2.3, 4.0, 5.7, 7.3, 9.0, 10.7];
    for (const u of cs) { H.fgeo(F, new THREE.CylinderGeometry(0.28, 0.32, 4.2, 10).translate(u, Y0 + 6.8 + 2.1, 0.45), '#f4f0e6'); H.fbox(F, u - 0.4, u + 0.4, Y0 + 6.8, Y0 + 7.05, 0.05, 0.85, CR, { ol: false }); H.fbox(F, u - 0.42, u + 0.42, Y0 + 10.75, Y0 + 11.0, 0.05, 0.87, CR, { ol: false }); }
    for (let k = 1; k < cs.length - 2; k++) { const u = (cs[k] + cs[k + 1]) / 2; H.fbox(F, u - 0.5, u + 0.5, Y0 + 7.3, Y0 + 9.6, -0.05, 0.02, '#20252c', { ol: false, emi: '#ffcf7a' }); H.farch(F, u, Y0 + 9.6, 0.5, -0.05, 0.02, '#20252c', { ol: false, emi: '#ffcf7a' }, 8); }
    H.band(F, 1.6, L - 1.6, Y0 + 7.0, Y0 + 7.4, 0.5, CR, { ol: false }); // balcony slab behind the columns
    for (let u = 1.7; u < L - 1.6; u += 0.3) H.fbox(F, u - 0.04, u + 0.04, Y0 + 7.4, Y0 + 8.1, 0.38, 0.46, CR, { ol: false });
    for (const u0 of [0, L - 1.2]) for (let y = 1.6; y < 10.8; y += 0.8) H.fbox(F, u0 + (y % 1.6 < 0.8 ? 0 : 0.25), u0 + 1.2 - (y % 1.6 < 0.8 ? 0 : 0.25), Y0 + y, Y0 + y + 0.4, 0, 0.08, CR, { ol: false }); // quoins
    // the crest in the pediment
    H.fgeo(F, new THREE.CylinderGeometry(0.75, 0.75, 0.2, 10).rotateX(Math.PI / 2).translate(m, Y0 + HH + 1.3, 0.25), CR, { ol: false });
    // frieze lettering + PENDRY banners
    SG.add(F, m, Y0 + 11.15, 8.6, 1.0, 0.8, (g, w, h) => sText(g, 'RECREATION PIER', w / 2, h / 2, w * 0.96, h * 0.72, SERIF, '#5a4a3a', { weight: '600', track: h * 0.08 }));
    SG.add(F, m, Y0 + HH + 0.55, 2.0, 0.6, 0.65, (g, w, h) => sText(g, '1914', w / 2, h / 2, w * 0.9, h * 0.8, SERIF, '#6a5a48', { weight: '600' }));
    for (const u of [cs[0] + 0.85, cs[5] - 0.85]) SG.add(F, u, Y0 + 7.4, 0.78, 3.1, 0.75, (g, w, h) => { g.fillStyle = '#8a2a3c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8c890'; g.lineWidth = w * 0.05; g.strokeRect(w * 0.1, w * 0.1, w * 0.8, h - w * 0.2);
      g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); sText(g, 'PENDRY', 0, 0, h * 0.8, w * 0.5, SERIF, '#f4ead4', { weight: '500', track: w * 0.08 }); g.restore(); });
    // Maryland + US flags on short staffs at the corner pavilions (pendry_1)
    for (const [u, fd] of [[0.6, B3.usFlag], [L - 0.6, B3.mdFlag]]) { const x = F.xa + F.ux * u + F.nx * 0.6, z = F.za + F.uz * u + F.nz * 0.6; H.seg([F.xa + F.ux * u, Y0 + 5.2, F.za + F.uz * u], [x + F.nx * 1.4, Y0 + 6.6, z + F.nz * 1.4], 0.04, '#2a2a2a', { seg: 4 });
      B3.flag(SG, x + F.nx * 1.3, Y0 + 6.55, z + F.nz * 1.3, Math.atan2(F.nx, F.nz), 1.3, 0.85, fd, 2, 0.06); }
  }
  // the pool deck on the east wing roof (the massing's rooftop pool, dressed): turquoise pool, deck, navy loungers, a small cabana bar
  H.box(133.2, Y0 + WH, -28.4, 139.5, Y0 + WH + 0.08, -22.1, '#dcd6ca', { ol: false });
  H.box(134.2, Y0 + WH + 0.08, -27.4, 138.6, Y0 + WH + 0.12, -23.6, '#3fc4dc', { ol: false, emi: '#1a5a66' });
  for (let k = 0; k < 6; k++) for (const z of [-28.0, -23.0]) H.box(134.4 + k * 0.72, Y0 + WH + 0.08, z - 0.3, 134.85 + k * 0.72, Y0 + WH + 0.36, z + 0.3, '#1f2f5a', { ol: false });
  H.box(133.4, Y0 + WH, -25.9, 134.0, Y0 + WH + 1.6, -24.4, '#3a2e26');
});

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

// ======================= UNDER ARMOUR - TIDE POINT (refs/under-armour: tidepoint_web_1 aerial, tidepoint_web_2 rooftop sign). The two old industrial
// brick halls (same footprints as the massing) with big multi-pane factory windows in white frames, brick pilasters, cream string courses and a
// cream cornice; the red accent stair box; the connector tower; the white steel frame on the north hall roof carrying UNDER ARMOUR in big block
// capitals facing the harbour; the red vertical CASCADE banner (Tide Point's buildings keep their old soap-brand names); US + Maryland flags on the roof.
lmHD('underarmour', 116, 58, 18, (H, signs, SG) => {
  const Y0 = CURB, BR = '#8e4a38', BR2 = '#7e3e2e', CR = '#e8e0cc', h = 11;
  const hall = (x0, z0, x1, z1) => {
    H.box(x0, Y0, z0, x1, Y0 + h, z1, BR); H.box(x0 - 0.2, Y0 + h - 0.5, z0 - 0.2, x1 + 0.2, Y0 + h + 0.15, z1 + 0.2, CR);
    H.box(x0 + 0.3, Y0 + h + 0.15, z0 + 0.3, x1 - 0.3, Y0 + h + 0.25, z1 - 0.3, '#5a5650', { ol: false });
    for (const F of [H.frame(x0, z1, x1, z1), H.frame(x1, z0, x0, z0), H.frame(x1, z1, x1, z0), H.frame(x0, z0, x0, z1)]) {
      H.pilasters(F, 0, F.L, Y0, Y0 + h - 0.5, 2.5, 0.45, 0.18, BR2, { ol: false });
      H.band(F, 0, F.L, Y0 + 3.9, Y0 + 4.15, 0.2, CR, { ol: false }); H.band(F, 0, F.L, Y0 + 0, Y0 + 0.6, 0.12, '#b8ae9a', { ol: false });
      H.windows(F, 0.2, F.L - 0.2, Y0 + 0.9, Y0 + h - 0.8, { bw: 2.5, fh: 3.35, ww: 1.75, wh: 2.55, pane: '#2a3038', mull: '#f2efe6', sill: CR, head: CR, lit: 0.5 });
      // factory sash grid (white muntins) over each window
      const nb = Math.max(1, Math.round((F.L - 0.4) / 2.5)), bwr = (F.L - 0.4) / nb, nf = Math.max(1, Math.round((h - 1.7) / 3.35)), fhr = (h - 1.7) / nf;
      for (let f = 0; f < nf; f++) for (let b = 0; b < nb; b++) { const uc = 0.2 + (b + 0.5) * bwr, yb = Y0 + 0.9 + f * fhr + (fhr - 2.55) * 0.45;
        for (const t of [0.33, 0.66]) H.fbox(F, uc - 0.875, uc + 0.875, yb + 2.55 * t - 0.03, yb + 2.55 * t + 0.03, 0, 0.05, '#f2efe6', { ol: false });
        for (const t of [0.25, 0.75]) H.fbox(F, uc - 0.875 + 1.75 * t - 0.03, uc - 0.875 + 1.75 * t + 0.03, yb, yb + 2.55, 0, 0.05, '#f2efe6', { ol: false }); }
    }
  };
  hall(106, 48, 126, 56); hall(106, 60, 126, 68);
  // the connector tower (the massing's 22 m tower): brick with cream bands, a red top panel and a flat cap
  { const x0 = 113.5, x1 = 118.5, z0 = 56.5, z1 = 59.5; H.box(x0, Y0, z0, x1, Y0 + 22, z1, BR); for (const y of [11, 16.5]) H.box(x0 - 0.15, Y0 + y, z0 - 0.15, x1 + 0.15, Y0 + y + 0.35, z1 + 0.15, CR, { ol: false });
    H.box(x0 - 0.1, Y0 + 18, z0 - 0.1, x1 + 0.1, Y0 + 21.6, z1 + 0.1, '#c8282c'); H.box(x0 - 0.3, Y0 + 21.6, z0 - 0.3, x1 + 0.3, Y0 + 22.3, z1 + 0.3, CR);
    for (const F of [H.frame(x0, z1, x1, z1), H.frame(x1, z0, x0, z0)]) H.windows(F, 0.4, F.L - 0.4, Y0 + 11.6, Y0 + 16.3, { bw: 1.6, fh: 2.4, ww: 0.9, wh: 1.7, pane: '#2a3038', mull: '#f2efe6', lit: 0.5 }); }
  // the red accent stair box on the north hall's west end (tidepoint_web_2)
  H.box(106.6, Y0 + 4.2, 47.5, 109.4, Y0 + h + 1.2, 48.2, '#c8282c'); H.box(106.4, Y0 + h + 1.2, 47.3, 109.6, Y0 + h + 1.5, 48.4, '#2a2a2a', { ol: false });
  // the rooftop sign frame (white steel) on the north hall, set back from the north edge, and its block capitals facing the harbour
  { const sx0 = 110.4, sx1 = 125.4, sz = 49.6, y0 = Y0 + h + 0.25, y1 = y0 + 3.3;
    for (let x = sx0; x <= sx1 + 0.01; x += 1.5) { H.box(x - 0.09, y0, sz - 0.09, x + 0.09, y1 + 0.2, sz + 0.09, '#eeeeea', { ol: false }); H.seg([x, y0, sz + 1.6], [x, y1 - 0.5, sz + 0.1], 0.06, '#eeeeea'); }
    for (const y of [y0 + 0.35, y1 - 0.25, y1 + 0.2]) H.box(sx0, y - 0.06, sz - 0.08, sx1, y + 0.06, sz + 0.08, '#eeeeea', { ol: false });
    SG.at((sx0 + sx1) / 2, y0 + 0.45, sz - 0.14, Math.PI, sx1 - sx0 - 0.4, 2.85, (g, w, hh) => sText(g, 'UNDER ARMOUR', w / 2, hh * 0.55, w * 0.99, hh * 0.98, '"Arial Black", "Helvetica Neue", Arial, "DejaVu Sans", sans-serif', '#f6f6f2', { weight: '900', stroke: '#9a9a96', sw: hh * 0.04 })); }
  // CASCADE: the red vertical blade sign on the north hall's north face
  { const F = H.frame(126, 48, 106, 48); H.fbox(F, 4.2, 4.3, Y0 + 3.2, Y0 + 9.6, 0, 1.1, '#3a3a3a', { ol: false });
    SG.add(F, 4.25, Y0 + 3.4, 1.0, 6.0, 0.6, (g, w, hh) => { g.fillStyle = '#c8282c'; g.fillRect(0, 0, w, hh); g.save(); g.translate(w / 2, hh / 2); g.rotate(Math.PI / 2); sText(g, 'C A S C A D E', 0, 0, hh * 0.9, w * 0.5, SANS, '#f6f2ea', { weight: 'bold' }); g.restore(); });
    const F2 = H.frame(126, 48, 106, 48); void F2; }
  // US + Maryland flags on staffs at the north hall's north-west roof corner
  for (const [x, fd] of [[107.2, B3.usFlag], [108.6, B3.mdFlag]]) { H.cyl(x, Y0 + h + 0.25, 49.0, 0.04, 0.06, 5.2, 6, '#d8d8d0', { ol: false }); B3.flag(SG, x + 0.05, Y0 + h + 5.3, 49.0, Math.PI / 2, 1.6, 1.0, fd, 2, 0.08); }
});
// ---- draw-call budget (batch 3). Batch 3 swaps to HD closer in than batches 1-2 (nearD 70 m; the far LODs were dressed up in 03_city.js).
// The draw calls are pooled instead of 3-4 per landmark: a per-vertex landmark index (lmv) + a uniform mask drops a landmark's vertices
// out of the clip volume while it is in the other LOD state.
//  - FAR: all five far LODs (massing + their decal signs, decals pushed 6 cm off their walls) = ONE city-atlas mesh, no shadow (past ~70 m
//    it is outside the hero-following shadow camera).
//  - NEAR, east four (fort, pendry, fells, under armour): ONE toon mesh (casts shadow) + ONE ink hull + ONE sign mesh (their canvas sign
//    atlases stacked into one texture); the group is hidden when none of the four is near. Federal Hill keeps its own lmHD near group.
// The per-frame masks ride on scene.onBeforeRender after 03b's LOD swap. Colliders are untouched (nothing here adds or moves one).
(function b3pool() {
  const LB = (id) => LMHD.list.find((L) => L.id === id), all = ['fort', 'fedhill', 'pendry', 'fells', 'underarmour'].map(LB).filter(Boolean);
  const east = ['fort', 'pendry', 'fells', 'underarmour'].map(LB).filter(Boolean);
  for (const L of all) L.nearD = 70;
  const mask = (arr, name, show) => `for (int i = 0; i < ${arr.length}; i++) if (i == int(lmv + 0.5) && ${name}[i] ${show ? '<' : '>'} 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);`;
  const decl = (arr, name) => `attribute float lmv; uniform float ${name}[${arr.length}];`;
  // merge non-indexed geometries [geo, li, xform?] over the named attributes, adding lmv
  const merge = (parts, names) => { let n = 0; for (const [g] of parts) n += g.attributes.position.count;
    const out = {}; for (const k of names) out[k] = new Float32Array(n * parts[0][0].attributes[k].itemSize); const lmv = new Float32Array(n); let o = 0;
    for (const [g, li, fx] of parts) { const c = g.attributes.position.count; for (const k of names) { const a = g.attributes[k], arr = (fx && fx[k]) ? fx[k](a) : a.array; out[k].set(arr, o * a.itemSize); } lmv.fill(li, o, o + c); o += c; }
    const g = new THREE.BufferGeometry(); for (const k of names) g.setAttribute(k, new THREE.BufferAttribute(out[k], parts[0][0].attributes[k].itemSize));
    g.setAttribute('lmv', new THREE.BufferAttribute(lmv, 1)); g.computeBoundingSphere(); return g; };
  // ---- FAR: one mesh
  const farHide = { value: all.map(() => 0) };
  const farMat = toonMat({ map: atlasTex, alphaTest: 0.5 }, true), fpc = farMat.onBeforeCompile;
  farMat.onBeforeCompile = (sh) => { fpc(sh); sh.uniforms.uLmHide = farHide;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + decl(all, 'uLmHide')).replace('#include <fog_vertex>', '#include <fog_vertex>\n' + mask(all, 'uLmHide', false)); };
  farMat.customProgramCacheKey = () => 'psxB3far';
  const push = (a) => { const p = a.array.slice(); return p; };
  const farParts = []; all.forEach((L, li) => { for (const m of [...L.far.children]) if (m.isMesh) {
    const dec = m.material === DECAL_MAT, g = m.geometry;
    farParts.push([g, li, dec ? { position: (a) => { const p = push(a), nn = g.attributes.normal.array; for (let i = 0; i < p.length; i++) p[i] += nn[i] * 0.06; return p; } } : null]); L.far.remove(m); } });
  let farMesh = null;
  if (farParts.length) { farMesh = new THREE.Mesh(merge(farParts, ['position', 'normal', 'uv', 'color', 'tr']), farMat); farMesh.castShadow = false; farMesh.receiveShadow = true; scene.add(farMesh); for (const [g] of farParts) g.dispose(); }
  // ---- NEAR (east four): one mesh + one hull + one sign mesh
  const nearOn = { value: east.map(() => 0) };
  const lmMat = toonMat(), lpc = lmMat.onBeforeCompile;
  lmMat.onBeforeCompile = (sh) => { lpc(sh); sh.uniforms.uLmNear = nearOn;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 emi; varying vec3 vEmi; ' + decl(east, 'uLmNear'))
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvEmi = emi;\n' + mask(east, 'uLmNear', true));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEmi; uniform float uNight;')
      .replace('#include <opaque_fragment>', 'outgoingLight += vEmi * uNight;\n#include <opaque_fragment>'); };
  lmMat.customProgramCacheKey = () => 'psxLMb3';
  const meshP = [], hullP = [], signs = [];
  east.forEach((L, li) => { for (const m of [...L.near.children]) {
    if (m.material === LM_MAT) meshP.push([m.geometry, li]);
    else if (m.material === OUT_CITY) { hullP.push([m.geometry, li]); const k = QUAL.outlines.indexOf(m); if (k >= 0) QUAL.outlines.splice(k, 1); }
    else if (m.material && m.material.map && m.material.map.userData.src) signs.push([m, li]);
    else continue;
    L.near.remove(m); } });
  const grp = new THREE.Group(); grp.visible = false; scene.add(grp);
  if (meshP.length) { const m = new THREE.Mesh(merge(meshP, ['position', 'normal', 'color', 'emi']), lmMat); m.castShadow = true; m.receiveShadow = true; grp.add(m); for (const [g] of meshP) g.dispose(); }
  if (hullP.length) { const hm = outlineMat(0.0034); hm.uniforms.uLmNear = nearOn;
    hm.vertexShader = hm.vertexShader.replace('attribute vec3 odir;', 'attribute vec3 odir; ' + decl(east, 'uLmNear')).replace(/gl_Position = projectionMatrix \* viewMatrix \* wp; \}/, 'gl_Position = projectionMatrix * viewMatrix * wp; ' + mask(east, 'uLmNear', true) + ' }');
    const h = new THREE.Mesh(merge(hullP, ['position', 'odir']), hm); h.visible = QUAL.hd; QUAL.outlines.push(h); grp.add(h); for (const [g] of hullP) g.dispose(); }
  if (signs.length) { // stack the sign atlases (full-res canvases, 1024 wide) into one canvas and remap v
    const srcs = signs.map(([m]) => m.material.map.userData.src), X = [], Y = []; let cx = 0, cy = 0, W = 1024, Ht = 0; // columns of 1024 px, <= 4096 tall
    for (const s of srcs) { if (cy + s.height > 4096 && cy > 0) { cx += 1024; cy = 0; } X.push(cx); Y.push(cy); cy += s.height; Ht = Math.max(Ht, cy); W = cx + 1024; }
    const c = document.createElement('canvas'); c.width = W; c.height = Ht; const g2 = c.getContext('2d');
    srcs.forEach((s, i) => g2.drawImage(s, X[i], Y[i]));
    const kmax = Math.max(...srcs.map((s) => Math.min(1, 512 / Math.max(s.width, s.height))));
    const parts = signs.map(([m, li], i) => [m.geometry, li, { uv: (a) => { const u = a.array.slice(), Hc = srcs[i].height, Wc = srcs[i].width;
      for (let k = 0; k < u.length; k += 2) { u[k] = (X[i] + u[k] * Wc) / W; u[k + 1] = 1 - (Y[i] + (1 - u[k + 1]) * Hc) / Ht; } return u; } }]);
    const sm = new THREE.MeshBasicMaterial({ map: lowTex(c, Math.round(kmax * Math.max(W, Ht))), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: true });
    sm.onBeforeCompile = (sh) => { sh.uniforms.uLmNear = nearOn; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + decl(east, 'uLmNear')).replace('#include <fog_vertex>', '#include <fog_vertex>\n' + mask(east, 'uLmNear', true)); };
    sm.customProgramCacheKey = () => 'b3signs';
    const s = new THREE.Mesh(merge(parts, ['position', 'uv']), sm); s.renderOrder = 2; grp.add(s);
    for (const [m] of signs) { m.geometry.dispose(); const t = m.material.map, q = QUAL.texs.indexOf(t); if (q >= 0) QUAL.texs.splice(q, 1); t.dispose(); m.material.dispose(); } }
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (...a) { prev.apply(this, a);
    let anyFar = false, anyNear = false;
    for (let i = 0; i < all.length; i++) { farHide.value[i] = all[i].isNear ? 1 : 0; if (!all[i].isNear) anyFar = true; }
    for (let i = 0; i < east.length; i++) { nearOn.value[i] = east[i].isNear ? 1 : 0; if (east[i].isNear) anyNear = true; }
    if (farMesh) farMesh.visible = anyFar; grp.visible = anyNear; };
})();
