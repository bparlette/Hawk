
// ======================= stadiums: ORIOLE PARK AT CAMDEN YARDS + M&T BANK STADIUM in HD (hark/stadiums, 2026-10-13) =======================
// Brad: "the stadiums need to look more like a baseball field and a football field." Both are read from the city, the drone and fly-overs.
// Same landmark ids / anchors / footprints / colliders as before (03_city.js keeps the collider + BLD pushes of the old massings via
// standColl(); the warehouse massing stays and is refined here). No logo files: every marking and sign is drawn on canvas in code.
// Cost: ONE merged toon mesh (LM_MAT, night glow via emi) + ONE ink hull for both stadiums, ONE canvas-textured field quad per stadium,
// ONE sign-atlas mesh for both (scoreboard, video boards, gate signs). Open-top: nothing roofs a field.
// Orientation: Oriole Park's home plate is at the west (behind it the west stand), the outfield faces east toward Eutaw St + the warehouse;
// right field is the south side (the scoreboard stands in right-centre). M&T's field runs north-south, midfield = the Raven King anchor (-106, 76).
const STADIUMS = (function () {
  const Y0 = CURB, H = new HB(), sa = new SA(), out = { fields: [] };
  LMR(4242421);
  const rbox = (cx, cz, w, d, y0, y1, ry, col, o) => { const g = new THREE.BoxGeometry(w, y1 - y0, d); g.rotateY(ry); g.translate(cx, (y0 + y1) / 2, cz); H.add(g, col, o); };
  const seg = (ax, az, bx, bz, y0, y1, th, col, o) => { const L = Math.hypot(bx - ax, bz - az); rbox((ax + bx) / 2, (az + bz) / 2, L + th * 0.5, th, y0, y1, Math.atan2(-(bz - az), bx - ax), col, o); };
  const faceTo = (nx, nz) => Math.atan2(nx, nz); // SA / rbox ry that faces the unit direction (nx, nz)
  // stand rect helper: u along the stand, d from the field edge outward ('away' = the side the rows rise toward)
  function SR(x0, z0, x1, z1, away) {
    const alongX = away === 'n' || away === 's', L = alongX ? x1 - x0 : z1 - z0, D = alongX ? z1 - z0 : x1 - x0;
    const r = (u0, u1, d0, d1) => away === 'w' ? [x1 - d1, z0 + u0, x1 - d0, z0 + u1] : away === 'e' ? [x0 + d0, z0 + u0, x0 + d1, z0 + u1]
      : away === 'n' ? [x0 + u0, z1 - d1, x0 + u1, z1 - d0] : [x0 + u0, z0 + d0, x0 + u1, z0 + d1];
    return { L, D, r, F: H.frame(...faceOf(x0, z0, x1, z1, away)) };
  }
  const bx = (R, y0, y1, col, o) => H.box(R[0], y0, R[1], R[2], y1, R[3], col, o);
  // a two-deck seating bowl side: lower deck rows, a club / concourse band (glass glows at night), upper deck rows, back wall, aisles
  function tiers(x0, z0, x1, z1, away, h, P) {
    const S = SR(x0, z0, x1, z1, away), { L, D } = S, u0 = P.t0 || 0, u1 = L - (P.t1 || 0);
    const dl = D * P.split, dc = D * (P.split + P.conc), back = P.back || 0.5, rows = [];
    for (let i = 0; i < P.nl; i++) rows.push([dl * i / P.nl, dl * (i + 1) / P.nl, h * (P.yl0 + (P.yl1 - P.yl0) * i / (P.nl - 1))]);
    for (let i = 0; i < P.nu; i++) rows.push([dc + (D - back - dc) * i / P.nu, dc + (D - back - dc) * (i + 1) / P.nu, h * (P.yu0 + (P.yu1 - P.yu0) * i / (P.nu - 1))]);
    rows.forEach(([a, b, y], i) => {
      bx(S.r(u0, u1, a, b), Y0, Y0 + y - 0.24, P.conc_c, { ol: false });
      bx(S.r(u0, u1, a + 0.05, b), Y0 + y - 0.24, Y0 + y, i % 2 ? P.seat : P.seat2, { ol: false });
      for (let u = u0 + P.aisle; u < u1 - 1; u += P.aisle) bx(S.r(u - 0.3, u + 0.3, a, b), Y0 + y - 0.2, Y0 + y + 0.03, P.conc_c, { ol: false });
    });
    const yc = h * P.yc;
    bx(S.r(u0, u1, dl, dc), Y0, Y0 + yc, P.fascia, { ol: true });                                                  // concourse / club level block
    bx(S.r(u0, u1, dl - 0.06, dl + 0.02), Y0 + yc - 1.5, Y0 + yc - 0.35, '#1d222c', { ol: false, emi: '#ffd890' }); // club glass
    bx(S.r(u0, u1, dc - 0.08, dc + 0.25), Y0 + h * P.yu0 - 1.1, Y0 + h * P.yu0 + 0.12, P.band, { ol: true });      // upper deck fascia
    bx(S.r(u0, u1, D - back, D), Y0, Y0 + h, P.ext, { ol: true });                                                  // back wall
    bx(S.r(u0, u1, 0, 0.25), Y0, Y0 + Math.max(1.0, h * P.yl0 - 0.15), P.wall, { ol: true });                     // field wall
    for (const u of [u0, u1]) bx(S.r(u - 0.2, u + 0.2, 0, D), Y0, Y0 + h * 0.5, P.ext, { ol: false });            // end walls (vomitory frames)
    return S;
  }

  // ============================== ORIOLE PARK AT CAMDEN YARDS ==============================
  const OP = { x0: -124, z0: -26, x1: -92, z1: 26, home: [-120.5, 0], base: 9.0 };
  const HX = OP.home[0], HZ = OP.home[1], RC = 27, RLF = 24.5, RRF = 23.2, Q4 = Math.PI / 4;
  const wallR = (phi) => RC + ((phi < 0 ? RLF : RRF) - RC) * Math.pow(Math.min(1, Math.abs(phi) / Q4), 1.6); // phi: 0 = centre field (+x), +45 deg = right field line (+z)
  const wp = (phi, r = wallR(phi)) => [HX + Math.cos(phi) * r, HZ + Math.sin(phi) * r];
  const B1 = [HX + OP.base * Math.SQRT1_2, HZ + OP.base * Math.SQRT1_2], B3 = [HX + OP.base * Math.SQRT1_2, HZ - OP.base * Math.SQRT1_2], B2 = [HX + OP.base * Math.SQRT2, HZ];
  const MOUND = [HX + OP.base * 60.5 / 90, HZ];
  out.orioles = { home: OP.home, B1, B2, B3, mound: MOUND, wallR };

  function ballparkTex() {
    const K = 20, W = OP.x1 - OP.x0, D = OP.z1 - OP.z0, c = document.createElement('canvas'); c.width = W * K; c.height = D * K; const g = c.getContext('2d');
    const px = (x) => (x - OP.x0) * K, pz = (z) => (z - OP.z0) * K, P = (p) => [px(p[0]), pz(p[1])];
    g.fillStyle = '#4e8e38'; g.fillRect(0, 0, c.width, c.height);
    // mowed crosshatch (diamonds square to the base lines)
    g.save(); g.translate(px(HX), pz(HZ)); for (const [rot, col] of [[Q4, 'rgba(32,84,26,0.28)'], [-Q4, 'rgba(150,210,110,0.16)']]) { g.save(); g.rotate(rot); g.fillStyle = col; for (let k = -60; k < 60; k += 2) if (k % 4 === 0) g.fillRect(k * K * 0.85, -80 * K, 0.85 * 2 * K * 0.5 * 2, 160 * K); g.restore(); } g.restore();
    // beyond the fence: darker grass, the batter's eye, the bullpens (left-centre)
    g.save(); g.beginPath(); g.rect(0, 0, c.width, c.height); g.moveTo(...P([HX, HZ])); for (let i = 0; i <= 40; i++) g.lineTo(...P(wp(-Q4 + i / 40 * 2 * Q4))); g.closePath();
    g.clip('evenodd'); g.fillStyle = '#3b6d2c'; g.fillRect(0, 0, c.width, c.height); g.restore();
    g.fillStyle = '#23402a'; g.fillRect(px(-93.2), pz(-4), 1.2 * K, 8 * K); // batter's eye
    for (const z0 of [-21.5, -17.8]) { g.fillStyle = '#b07a4a'; g.fillRect(px(-99.5), pz(z0), 6 * K, 2.8 * K); g.fillStyle = '#4e8e38'; g.fillRect(px(-99.1), pz(z0 + 0.5), 5.2 * K, 1.8 * K);
      for (const x of [-98.2, -96.2]) { g.fillStyle = '#b07a4a'; g.beginPath(); g.arc(px(x), pz(z0 + 1.4), 0.7 * K, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.fillRect(px(x) - 4, pz(z0 + 1.4) - 1, 8, 2); } }
    // warning track
    const DIRT = '#b98250', TRACK = '#a8744a';
    g.fillStyle = TRACK; g.beginPath(); for (let i = 0; i <= 48; i++) g.lineTo(...P(wp(-Q4 - 0.04 + i / 48 * (2 * Q4 + 0.08)))); for (let i = 48; i >= 0; i--) { const ph = -Q4 - 0.04 + i / 48 * (2 * Q4 + 0.08); g.lineTo(...P(wp(ph, wallR(ph) - 1.5))); } g.closePath(); g.fill();
    // infield dirt: the arc round the rubber, clipped to fair territory (+ a little foul) so it meets the lines
    g.save(); g.beginPath(); g.moveTo(...P([HX - 1, HZ])); g.lineTo(...P([HX + 30 * Math.cos(-Q4 - 0.1), HZ + 30 * Math.sin(-Q4 - 0.1)])); g.lineTo(...P([HX + 30, HZ])); g.lineTo(...P([HX + 30 * Math.cos(Q4 + 0.1), HZ + 30 * Math.sin(Q4 + 0.1)])); g.closePath(); g.clip();
    g.fillStyle = DIRT; g.beginPath(); g.arc(px(MOUND[0]), pz(MOUND[1]), 9.5 * K, 0, TAU); g.fill(); g.restore();
    // infield grass square (inset from the base paths), cut-outs round the bases, home circle, mound
    const ctr = [(HX + B2[0]) / 2, HZ], ins = (p, k) => [ctr[0] + (p[0] - ctr[0]) * k, ctr[1] + (p[1] - ctr[1]) * k];
    g.fillStyle = '#58993f'; g.beginPath(); for (const p of [[HX, HZ], B1, B2, B3]) g.lineTo(...P(ins(p, 0.8))); g.closePath(); g.fill();
    g.save(); g.beginPath(); for (const p of [[HX, HZ], B1, B2, B3]) g.lineTo(...P(ins(p, 0.8))); g.closePath(); g.clip(); g.translate(px(HX), pz(HZ)); g.rotate(Q4); g.fillStyle = 'rgba(32,84,26,0.22)'; for (let k = -20; k < 20; k += 2) g.fillRect(k * K * 0.9, -20 * K, 0.9 * K, 40 * K); g.restore();
    g.fillStyle = DIRT; for (const p of [B1, B2, B3]) { g.beginPath(); g.arc(...P(p), 1.15 * K, 0, TAU); g.fill(); }
    g.beginPath(); g.arc(px(HX), pz(HZ), 1.9 * K, 0, TAU); g.fill(); g.beginPath(); g.arc(...P(MOUND), 1.2 * K, 0, TAU); g.fill();
    for (const s of [-1, 1]) { g.beginPath(); g.arc(px(HX + 0.6), pz(HZ + s * 4.6), 0.55 * K, 0, TAU); g.fillStyle = '#b07a4a'; g.fill(); g.strokeStyle = '#f4f2ea'; g.lineWidth = 2; g.stroke(); } // on-deck circles
    // chalk: foul lines to the poles, batter's boxes, catcher's box, coach's boxes
    g.strokeStyle = '#f6f4ec'; g.lineCap = 'butt'; g.lineWidth = 0.16 * K;
    for (const s of [-1, 1]) { const e = wp(s * Q4); g.beginPath(); g.moveTo(px(HX + 0.5), pz(HZ + s * 0.5)); g.lineTo(...P(e)); g.stroke(); }
    g.lineWidth = 0.09 * K; for (const s of [-1, 1]) g.strokeRect(px(HX - 0.6), pz(HZ + (s < 0 ? -1.25 : 0.35)), 1.2 * K, 0.9 * K);
    g.strokeRect(px(HX - 1.7), pz(HZ - 0.45), 1.0 * K, 0.9 * K);
    for (const p of [[HX + 6.6, HZ + 9.4], [HX + 6.6, HZ - 10.6]]) g.strokeRect(px(p[0]), pz(p[1]), 2 * K, 1.2 * K);
    // bases + home plate + rubber
    g.fillStyle = '#ffffff'; for (const p of [B1, B2, B3]) { g.save(); g.translate(...P(p)); g.rotate(Q4); g.fillRect(-0.32 * K, -0.32 * K, 0.64 * K, 0.64 * K); g.restore(); }
    g.save(); g.translate(px(HX), pz(HZ)); const hp = 0.34 * K; g.beginPath(); g.moveTo(hp, -hp); g.lineTo(hp, hp); g.lineTo(-hp * 0.2, hp); g.lineTo(-hp, 0); g.lineTo(-hp * 0.2, -hp); g.closePath(); g.fill(); g.restore();
    g.fillRect(px(MOUND[0]) - 2, pz(MOUND[1]) - 0.3 * K, 4, 0.6 * K);
    return c;
  }
  function field(x0, z0, x1, z1, canvas, id) {
    const y = Y0 + 0.02, Pp = [x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0], U = [0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); bakeColor(g, '#ffffff'); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, toonMat({ map: lowTex(canvas, 256) })); m.receiveShadow = true; m.name = 'field_' + id; scene.add(m); out.fields.push(m); return m;
  }
  field(OP.x0, OP.z0, OP.x1, OP.z1, ballparkTex(), 'orioles');
  // --- the diamond in 3D: mound, bases, outfield wall + padding, foul poles, dugouts, backstop
  H.cyl(MOUND[0], Y0, MOUND[1], 1.05, 1.3, 0.26, 16, '#b98250', { ol: false }); H.box(MOUND[0] - 0.08, Y0 + 0.26, MOUND[1] - 0.3, MOUND[0] + 0.08, Y0 + 0.3, MOUND[1] + 0.3, '#f4f2ea', { ol: false });
  for (const p of [B1, B2, B3]) rbox(p[0], p[1], 0.5, 0.5, Y0, Y0 + 0.12, Q4, '#f8f8f2', { ol: false });
  { const N = 26; let prev = wp(-Q4); for (let i = 1; i <= N; i++) { const ph = -Q4 + i / N * 2 * Q4, p = wp(ph), hh = ph > 0.3 ? 3.0 : 1.7; // right field: the tall scoreboard-side wall
      seg(prev[0], prev[1], p[0], p[1], Y0, Y0 + hh, 0.4, '#1d4a33', { ol: true }); seg(prev[0], prev[1], p[0], p[1], Y0 + hh, Y0 + hh + 0.12, 0.5, '#d8c27a', { ol: false }); prev = p; } }
  for (const s of [-1, 1]) { const p = wp(s * Q4); H.cyl(p[0], Y0, p[1], 0.11, 0.14, 10, 8, '#f2c41e'); rbox(p[0] - 0.25, p[1], 0.5, 0.06, Y0 + 3.5, Y0 + 9.6, 0, '#f2c41e', { ol: false }); }
  for (const s of [-1, 1]) { // dugouts along the base lines (1B = south, 3B = north), sunk into foul territory
    const dx = Math.SQRT1_2, dz = s * Math.SQRT1_2, nx = -Math.SQRT1_2, nz = s * Math.SQRT1_2, t = 5.4, off = 3.3, cx = HX + dx * t + nx * off, cz = HZ + dz * t + nz * off, ry = Math.atan2(-dz, dx);
    rbox(cx, cz, 5.2, 1.6, Y0, Y0 + 0.9, ry, '#1a1d22', { ol: true }); rbox(cx + nx * 0.15, cz + nz * 0.15, 5.6, 2.0, Y0 + 0.9, Y0 + 1.1, ry, '#2c5e3c', { ol: true });
    rbox(cx - nx * 0.82, cz - nz * 0.82, 5.2, 0.12, Y0 + 0.75, Y0 + 0.92, ry, '#e8e2d0', { ol: false }); }
  { let prev = null; for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.72 + 0.56 * i / 10), p = [HX + Math.cos(a) * 3.0, HZ + Math.sin(a) * 3.0]; if (prev) seg(prev[0], prev[1], p[0], p[1], Y0, Y0 + 1.1, 0.25, '#1d4a33', { ol: true }); prev = p; } }
  // --- the horseshoe: green seats, lower + upper deck (west behind home, north = 3B side, south = 1B side), brick arcade outside
  const OPS = { nl: 6, nu: 5, split: 0.46, conc: 0.1, yl0: 0.1, yl1: 0.42, yc: 0.55, yu0: 0.6, yu1: 0.95, aisle: 5.5, seat: '#2f7a46', seat2: '#27693c', conc_c: '#b9b2a4', fascia: '#24402e', band: '#1f3b2a', ext: '#8a4632', wall: '#1d4a33' };
  const sW = tiers(-134, -34, -124, 34, 'w', 14, OPS), sN = tiers(-124, -34, -96, -26, 'n', 11, Object.assign({}, OPS, { t0: 0 })), sS = tiers(-124, 26, -96, 34, 's', 11, OPS);
  for (const [S, h] of [[sW, 14], [sN, 11], [sS, 11]]) { const F = S.F, n = Math.max(2, Math.round(F.L / 3.4));
    for (let i = 0; i < n; i++) { const uc = (i + 0.5) * F.L / n, ww = F.L / n * 0.56; // two storeys of brick arches
      for (const [ya, yb] of [[0.3, h * 0.34], [h * 0.42, h * 0.7]]) { H.fbox(F, uc - ww / 2, uc + ww / 2, Y0 + ya, Y0 + yb - ww / 2, -0.04, 0.03, '#2a1f1a', { ol: false, emi: LMR() < 0.5 ? '#ffcf7a' : null }); H.farch(F, uc, Y0 + yb - ww / 2, ww / 2, -0.04, 0.03, '#2a1f1a', { ol: false }, 6); } }
    H.pilasters(F, 0, F.L, Y0, Y0 + h * 0.78, F.L / n, 0.45, 0.16, '#7a3c2a', { ol: false }); H.band(F, -0.1, F.L + 0.1, Y0 + h * 0.78, Y0 + h * 0.84, 0.22, '#d9cdb0', { ol: false });
    H.band(F, 0, F.L, Y0 + h * 0.84, Y0 + h, 0.06, '#2a4a36', { ol: false }); }
  H.box(-134.3, Y0 + 14, -34, -129, Y0 + 14.35, 34, '#1f3b2a', { ol: true }); // the green steel sunshade roof over the upper deck behind home
  for (let z = -32; z <= 32; z += 8) H.cyl(-129.4, Y0 + 12.2, z, 0.12, 0.12, 1.9, 6, '#1f3b2a', { ol: false });
  // --- light towers (same four spots + colliders as before): lattice-ish masts + lamp banks aimed at the infield
  for (const [x, z] of [[-128, -30], [-128, 30], [-98, -30], [-98, 30]]) {
    H.cyl(x, Y0, z, 0.28, 0.42, 26, 8, '#3c403c'); const dx = -108 - x, dz = 0 - z, l = Math.hypot(dx, dz), nx = dx / l, nz = dz / l, ry = faceTo(nx, nz), tx = Math.cos(ry), tz = -Math.sin(ry);
    rbox(x + nx * 0.5, z + nz * 0.5, 5.2, 0.5, Y0 + 25, Y0 + 28.4, ry, '#2c302c', { ol: true });
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { const u = -2.0 + i, cx = x + nx * 0.82 + tx * u, cz = z + nz * 0.82 + tz * u; rbox(cx, cz, 0.7, 0.18, Y0 + 25.3 + j * 1.0, Y0 + 26.0 + j * 1.0, ry, '#f4f0dc', { ol: false, emi: '#fff3cc' }); } }
  // --- Eutaw Street: brick walkway between the outfield and the warehouse, the warehouse refined (piers, cornice, banners), street blades
  H.box(-92, Y0, -34, -88.05, Y0 + 0.03, 34, '#9a5844', { ol: false });
  for (let z = -33; z < 34; z += 2.2) H.box(-92, Y0 + 0.03, z, -88.05, Y0 + 0.04, z + 0.08, '#b9846c', { ol: false });
  for (const k of ['w', 'e']) { const F = H.frame(...faceOf(-88, -34, -80, 34, k));
    H.pilasters(F, 0.3, F.L - 0.3, Y0, Y0 + 21.4, 4.25, 0.55, 0.2, '#6c3324', { ol: false });
    H.band(F, -0.35, F.L + 0.35, Y0 + 21.2, Y0 + 22.25, 0.36, '#5a2a1c', { ol: true }); H.band(F, -0.1, F.L + 0.1, Y0 + 4.6, Y0 + 4.85, 0.16, '#cdb894', { ol: false });
    if (k === 'w') for (let u = 4.25; u < F.L - 2; u += 8.5) { H.fbox(F, u - 0.42, u + 0.42, Y0 + 5.6, Y0 + 8.8, 0.28, 0.33, '#e86a24', { ol: false }); H.fbox(F, u - 0.42, u + 0.42, Y0 + 6.9, Y0 + 7.4, 0.33, 0.35, '#181818', { ol: false });
      H.fbox(F, u - 0.5, u + 0.5, Y0 + 8.8, Y0 + 8.9, 0.2, 0.4, '#202020', { ol: false }); } }
  H.box(-88.6, Y0 + 22.25, -34, -79.4, Y0 + 22.6, 34, '#3e342e', { ol: false });
  for (const s of [-1, 1]) { H.cyl(-88.7, Y0, s * 33, 0.06, 0.07, 3.6, 6, '#264a34', { ol: false });
    sa.at(-89.5, Y0 + 3.15, s * 33, faceTo(0, s), 1.6, 0.34, (g, w, h) => { g.fillStyle = '#1f6a3c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = h * 0.08; g.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16); sText(g, 'EUTAW ST', w / 2, h * 0.54, w * 0.86, h * 0.62, SANS, '#ffffff', { weight: '800' }); }); }
  // --- the scoreboard in right-centre (on two legs, facing home plate) with the ORIOLE PARK header
  { const cx = -95.6, cz = 22.4, dx = HX - cx, dz = HZ - cz, l = Math.hypot(dx, dz), nx = dx / l, nz = dz / l, ry = faceTo(nx, nz), tx = Math.cos(ry), tz = -Math.sin(ry);
    for (const s of [-1, 1]) H.cyl(cx + tx * s * 3.2, Y0, cz + tz * s * 3.2, 0.3, 0.3, 6.2, 8, '#2a3a2e');
    rbox(cx, cz, 9.4, 0.6, Y0 + 6, Y0 + 11.6, ry, '#18301f', { ol: true }); rbox(cx, cz, 7.6, 0.5, Y0 + 11.6, Y0 + 13.3, ry, '#18301f', { ol: true });
    const fx = cx + nx * 0.34, fz = cz + nz * 0.34;
    sa.at(fx, Y0 + 6.2, fz, ry, 9.0, 5.2, (g, w, h) => { g.fillStyle = '#10261a'; g.fillRect(0, 0, w, h); const cw = w / 17, rh = h / 6;
      g.fillStyle = '#e8e0c8'; const hdr = ['', '', '', '', '1', '2', '3', '4', '5', '6', '7', '8', '9', '', 'R', 'H', 'E'];
      hdr.forEach((t, i) => t && sText(g, t, (i + 0.5) * cw, rh * 0.8, cw, rh * 0.55, SANS, '#e8e0c8'));
      [['VISITORS', [0, 0, 1, 0, 0, 0, 0, 0, 0], [1, 4, 0]], ['BALTIMORE', [2, 0, 0, 1, 0, 3, 0, 0, ''], [6, 9, 0]]].forEach(([nm, ln, rhe], r) => { const y = rh * (1.9 + r * 1.15);
        sText(g, nm, cw * 2, y, cw * 3.6, rh * 0.6, SANS, '#ffffff', { weight: '800' }); ln.forEach((v, i) => sText(g, String(v), (i + 4.5) * cw, y, cw, rh * 0.62, SANS, '#ffd27a'));
        rhe.forEach((v, i) => sText(g, String(v), (i + 14.5) * cw, y, cw, rh * 0.62, SANS, '#ffd27a')); });
      g.fillStyle = '#e86a24'; g.fillRect(0, rh * 4.15, w, rh * 0.12);
      sText(g, 'BALL 2   STRIKE 1   OUT 1', w * 0.5, rh * 5.0, w * 0.9, rh * 0.62, SANS, '#ffffff', { weight: '700' }); });
    sa.at(fx, Y0 + 11.75, fz, ry, 7.3, 1.45, (g, w, h) => { g.fillStyle = '#18301f'; g.fillRect(0, 0, w, h); sText(g, 'ORIOLE PARK', w / 2, h * 0.55, w * 0.92, h * 0.78, SERIF, '#f2e6c4', { weight: '700', stroke: '#e86a24', sw: h * 0.05 }); }); }
  // gate signs on the brick (home plate gate behind the west stand, the north side facing downtown)
  sa.at(-134.6, Y0 + 9.4, 0, faceTo(-1, 0), 14, 1.3, (g, w, h) => { g.fillStyle = '#1f3b2a'; g.fillRect(0, 0, w, h); sText(g, 'ORIOLE PARK AT CAMDEN YARDS', w / 2, h * 0.56, w * 0.94, h * 0.66, SERIF, '#f2e6c4', { weight: '700' }); });
  sa.at(-110, Y0 + 7.6, -34.6, faceTo(0, -1), 12, 1.2, (g, w, h) => { g.fillStyle = '#1f3b2a'; g.fillRect(0, 0, w, h); sText(g, 'ORIOLE PARK AT CAMDEN YARDS', w / 2, h * 0.56, w * 0.94, h * 0.66, SERIF, '#f2e6c4', { weight: '700' }); });

  // ============================== M&T BANK STADIUM ==============================
  const MT = { x0: -124, z0: 56, x1: -88, z1: 96, fx0: -114, fx1: -98, fz0: 58, fz1: 94, yd: 0.3 };
  const zy = (y) => MT.fz0 + 3 + y * MT.yd; // yards from the north goal line -> z (50 = midfield z 76)
  out.ravens = { field: MT, zy };
  function footballTex() {
    const K = 26, W = MT.x1 - MT.x0, D = MT.z1 - MT.z0, c = document.createElement('canvas'); c.width = W * K; c.height = D * K; const g = c.getContext('2d');
    const px = (x) => (x - MT.x0) * K, pz = (z) => (z - MT.z0) * K, cx = (MT.fx0 + MT.fx1) / 2;
    g.fillStyle = '#3f7a30'; g.fillRect(0, 0, c.width, c.height);
    for (let y = -10; y < 110; y += 5) { g.fillStyle = (y / 5) % 2 ? '#4f9038' : '#468532'; g.fillRect(px(MT.fx0 - 1.6), pz(zy(y)), (MT.fx1 - MT.fx0 + 3.2) * K, 5 * MT.yd * K + 1); }
    // white border round the field + team areas (between the 32s) on both sidelines
    g.strokeStyle = '#f6f6f0'; g.lineWidth = 0.32 * K; g.strokeRect(px(MT.fx0 - 0.3), pz(MT.fz0 - 0.3), (MT.fx1 - MT.fx0 + 0.6) * K, (MT.fz1 - MT.fz0 + 0.6) * K);
    g.lineWidth = 0.08 * K; for (const [x, w] of [[MT.fx0 - 3.6, 2.6], [MT.fx1 + 1.0, 2.6]]) g.strokeRect(px(x), pz(zy(32)), w * K, (zy(68) - zy(32)) * K);
    // end zones: purple, the wording drawn in code (no logo files)
    for (const [z0, txt, rot] of [[MT.fz0, 'RAVENS', 0], [zy(100), 'BALTIMORE', Math.PI]]) {
      g.fillStyle = '#3a1d6e'; g.fillRect(px(MT.fx0), pz(z0), (MT.fx1 - MT.fx0) * K, 3 * K);
      g.save(); g.translate(px(cx), pz(z0 + 1.5)); g.rotate(rot); g.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = -8; i < 8; i++) g.fillRect(i * 1.0 * K, -1.5 * K, 0.08 * K, 3 * K);
      sText(g, txt, 0, 0.06 * K, (MT.fx1 - MT.fx0 - 1.4) * K, 2.05 * K, '"Arial Black", Impact, ' + SANS, '#ffffff', { weight: '900', stroke: '#0c0a10', sw: 0.26 * K });
      sText(g, txt, 0, 0.06 * K, (MT.fx1 - MT.fx0 - 1.4) * K, 2.05 * K, '"Arial Black", Impact, ' + SANS, '#ffffff', { weight: '900', stroke: '#c9a24a', sw: 0.08 * K }); g.restore(); }
    // lines: sidelines, end lines, goal lines, every 5 yards, hash ticks every yard (sidelines + the narrow NFL hashes)
    g.fillStyle = '#f8f8f2'; const lw = 0.11 * K;
    g.fillRect(px(MT.fx0) - lw / 2, pz(MT.fz0), lw, (MT.fz1 - MT.fz0) * K); g.fillRect(px(MT.fx1) - lw / 2, pz(MT.fz0), lw, (MT.fz1 - MT.fz0) * K);
    g.fillRect(px(MT.fx0), pz(MT.fz0) - lw / 2, (MT.fx1 - MT.fx0) * K, lw); g.fillRect(px(MT.fx0), pz(MT.fz1) - lw / 2, (MT.fx1 - MT.fx0) * K, lw);
    for (let y = 0; y <= 100; y++) { const z = pz(zy(y));
      if (y % 5 === 0) { const w = y === 0 || y === 100 ? lw * 1.8 : lw; g.fillRect(px(MT.fx0), z - w / 2, (MT.fx1 - MT.fx0) * K, w); continue; }
      const tl = 0.22 * K, tw = 0.05 * K;
      for (const x of [MT.fx0 + 0.12, MT.fx1 - 0.12 - 0.22, cx - 0.93 - 0.22, cx + 0.93]) g.fillRect(px(x), z - tw / 2, tl, tw); }
    for (const s of [-1, 1]) g.fillRect(px(cx - 0.12), pz(zy(s < 0 ? 2 : 98)) - lw / 2, 0.24 * K, lw); // PAT marks
    // numbers every 10 (bottoms toward each sideline) with the little arrows toward the nearer goal
    const NF = '"Arial Black", Impact, ' + SANS;
    for (let y = 10; y <= 90; y += 10) { const n = y <= 50 ? y : 100 - y, s = String(n), z = pz(zy(y));
      for (const [x, rot] of [[MT.fx0 + 3.0, Math.PI / 2], [MT.fx1 - 3.0, -Math.PI / 2]]) { g.save(); g.translate(px(x), z); g.rotate(rot);
        sText(g, s[0], -0.52 * K, 0, 0.8 * K, 1.15 * K, NF, '#f8f8f2', { weight: '900' }); sText(g, s[1], 0.52 * K, 0, 0.8 * K, 1.15 * K, NF, '#f8f8f2', { weight: '900' });
        if (n !== 50) { const dir = (y < 50 ? -1 : 1) * (rot > 0 ? 1 : -1), ax = dir * 1.12 * K; g.beginPath(); g.moveTo(ax + dir * 0.24 * K, -0.28 * K); g.lineTo(ax, -0.4 * K); g.lineTo(ax, -0.16 * K); g.closePath(); g.fill(); }
        g.restore(); } }
    return c;
  }
  field(MT.x0, MT.z0, MT.x1, MT.z1, footballTex(), 'ravens');
  // goal posts (yellow goosenecks behind each end line) + sideline benches between the 35s
  for (const [ze, s] of [[MT.fz0, -1], [MT.fz1, 1]]) { const Y = '#f2c81e', zb = ze + s * 0.9, cxx = (MT.fx0 + MT.fx1) / 2;
    H.cyl(cxx, Y0, zb, 0.14, 0.16, 2.0, 8, Y); H.cyl(cxx, Y0, zb, 0.28, 0.28, 1.1, 8, '#2a1a4a', { ol: false });
    rbox(cxx, (zb + ze) / 2, 0.16, Math.abs(ze - zb) + 0.16, Y0 + 1.92, Y0 + 2.08, 0, Y); rbox(cxx, ze, 2.6, 0.14, Y0 + 2.0, Y0 + 2.14, 0, Y);
    for (const k of [-1, 1]) H.cyl(cxx + k * 1.24, Y0 + 2.0, ze, 0.06, 0.07, 3.4, 6, Y); }
  for (const x of [MT.fx0 - 2.4, MT.fx1 + 2.4]) for (let z = zy(36); z < zy(64); z += 2.4) { H.box(x - 0.25, Y0, z, x + 0.25, Y0 + 0.45, z + 1.9, '#2a1a4a', { ol: true }); H.box(x + (x < -106 ? -0.4 : 0.25), Y0, z, x + (x < -106 ? -0.25 : 0.4), Y0 + 0.85, z + 1.9, '#3a2a6a', { ol: false }); }
  // --- the bowl: purple seats in two tiers with a glass club band, light-grey concrete outside with purple bands; east gap (z 70-82) stays open
  const MTS = { nl: 7, nu: 6, split: 0.44, conc: 0.12, yl0: 0.07, yl1: 0.42, yc: 0.55, yu0: 0.6, yu1: 0.96, aisle: 6, seat: '#5a3a9e', seat2: '#4a2e88', conc_c: '#b6b2ac', fascia: '#2b2140', band: '#3a1d6e', ext: '#c7c2b8', wall: '#241a3a' };
  const mW = tiers(-134, 48, -124, 104, 'w', 22, MTS), mN = tiers(-124, 48, -80, 56, 'n', 20, MTS), mS = tiers(-124, 96, -80, 104, 's', 20, MTS);
  const mE1 = tiers(-88, 56, -80, 70, 'e', 20, MTS), mE2 = tiers(-88, 82, -80, 96, 'e', 20, MTS);
  for (const [S, h] of [[mW, 22], [mN, 20], [mS, 20], [mE1, 20], [mE2, 20]]) { const F = S.F;
    H.pilasters(F, 0, F.L, Y0, Y0 + h, 4.6, 0.7, 0.22, '#aaa59c', { ol: false });
    H.band(F, -0.1, F.L + 0.1, Y0 + h * 0.36, Y0 + h * 0.42, 0.3, '#3a1d6e', { ol: false }); H.band(F, -0.1, F.L + 0.1, Y0 + h - 0.6, Y0 + h, 0.32, '#3a1d6e', { ol: true });
    H.windows(F, 0.8, F.L - 0.8, Y0 + h * 0.46, Y0 + h * 0.62, { bw: 2.3, fh: h * 0.16, ww: 1.6, wh: h * 0.1, pane: '#232a36', lit: 0.6 }); }
  // the arched, cantilevered canopies over the upper sideline decks (west: one long wing; east: one over each stand) + their light rims
  function canopy(xa, xb, z0, z1, ytop, rise, xFront) { const N = 18, Pp = [], th = 0.35, dropF = 1.1;
    const yAt = (t) => ytop + rise * Math.sin(Math.PI * t), pt = (x, t, k) => [x, yAt(t) - (x === xFront ? dropF : 0) - k, lerp(z0, z1, t)];
    const q = (a, b, c, d) => Pp.push(...a, ...b, ...c, ...a, ...c, ...d), xBack = xFront === xa ? xb : xa;
    for (let i = 0; i < N; i++) { const t0 = i / N, t1 = (i + 1) / N;
      q(pt(xBack, t0, 0), pt(xBack, t1, 0), pt(xFront, t1, 0), pt(xFront, t0, 0)); q(pt(xFront, t0, th), pt(xFront, t1, th), pt(xBack, t1, th), pt(xBack, t0, th));
      q(pt(xFront, t0, 0), pt(xFront, t1, 0), pt(xFront, t1, th), pt(xFront, t0, th)); q(pt(xBack, t0, th), pt(xBack, t1, th), pt(xBack, t1, 0), pt(xBack, t0, 0)); }
    let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.computeVertexNormals(); H.geo(g, '#e9e7e2');
    g = new THREE.BufferGeometry(); const Pf = []; for (let i = 0; i < N; i++) { const t0 = i / N, t1 = (i + 1) / N, a = pt(xFront, t0, th), b = pt(xFront, t1, th);
      Pf.push(a[0], a[1] - 0.02, a[2], b[0], b[1] - 0.02, b[2], b[0], b[1] - 0.3, b[2], a[0], a[1] - 0.02, a[2], b[0], b[1] - 0.3, b[2], a[0], a[1] - 0.3, a[2]); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(Pf, 3)); g.computeVertexNormals(); H.geo(g, '#3a1d6e', { ol: false });
    for (let i = 1; i < 8; i++) { const t = i / 8, z = lerp(z0, z1, t); H.cyl(xBack, Y0 + ytop - 1.6, z, 0.14, 0.14, yAt(t) - ytop + 1.6, 6, '#8e8a84', { ol: false }); }
    for (let i = 0; i <= 2 * N; i++) { const t = i / (2 * N), p = pt(xFront, t, th + 0.32); H.box(p[0] - 0.22, p[1] - 0.25, p[2] - 0.35, p[0] + 0.22, p[1], p[2] + 0.35, '#f4f0e0', { ol: false, emi: '#fff4d0' }); } }
  canopy(-134.6, -127.0, 46.5, 105.5, Y0 + 22.4, 3.4, -127.0);
  canopy(-84.4, -79.4, 54.8, 71.2, Y0 + 20.4, 1.4, -84.4); canopy(-84.4, -79.4, 80.8, 97.2, Y0 + 20.4, 1.4, -84.4);
  for (const [z, dz] of [[48.9, 1], [103.1, -1]]) for (let x = -122; x <= -82; x += 2.2) H.box(x - 0.3, Y0 + 20.0, z - 0.25, x + 0.3, Y0 + 20.5, z + 0.25, '#f4f0e0', { ol: false, emi: '#fff4d0' }); // end light rims
  // video boards above each end zone (north board: the RAVENS board; south: the scoreboard)
  for (const [z, s] of [[48.2, 1], [103.8, -1]]) { const z0 = z - s * 0.3, z1 = z + s * 0.2;
    H.box(-115, Y0 + 19.6, Math.min(z0, z1), -97, Y0 + 27.4, Math.max(z0, z1), '#151018', { ol: true }); for (const x of [-112, -100]) H.box(x - 0.4, Y0 + 18, z - 0.6, x + 0.4, Y0 + 19.6, z + 0.6, '#3a3640', { ol: false });
    sa.at(-106, Y0 + 20.0, z + s * 0.28, faceTo(0, s), 17.2, 7.0, s > 0
      ? (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2c1260'); gr.addColorStop(1, '#120628'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
          sText(g, 'RAVENS', w / 2, h * 0.42, w * 0.86, h * 0.5, '"Arial Black", Impact, ' + SANS, '#f6f2ff', { weight: '900', stroke: '#c9a24a', sw: h * 0.03 });
          g.fillStyle = '#c9a24a'; g.fillRect(0, h * 0.74, w, h * 0.04); sText(g, 'M&T BANK STADIUM', w / 2, h * 0.87, w * 0.7, h * 0.15, SANS, '#ffffff', { weight: '800' }); }
      : (g, w, h) => { g.fillStyle = '#0c0a12'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a1d6e'; g.fillRect(0, 0, w, h * 0.22);
          sText(g, 'M&T BANK STADIUM', w / 2, h * 0.11, w * 0.6, h * 0.14, SANS, '#ffffff', { weight: '800' });
          sText(g, 'BALTIMORE', w * 0.27, h * 0.4, w * 0.4, h * 0.15, SANS, '#c9b8ff', { weight: '800' }); sText(g, 'VISITORS', w * 0.73, h * 0.4, w * 0.4, h * 0.15, SANS, '#d0d0d0', { weight: '800' });
          sText(g, '14', w * 0.27, h * 0.66, w * 0.3, h * 0.32, '"Arial Black", Impact, ' + SANS, '#ffd25a', { weight: '900' }); sText(g, '10', w * 0.73, h * 0.66, w * 0.3, h * 0.32, '"Arial Black", Impact, ' + SANS, '#ffd25a', { weight: '900' });
          sText(g, '4TH   2:00   1ST & 10', w / 2, h * 0.9, w * 0.8, h * 0.13, SANS, '#ffffff', { weight: '700' }); }); }
  sa.at(-134.6, Y0 + 15.4, 76, faceTo(-1, 0), 16, 1.6, (g, w, h) => { g.fillStyle = '#3a1d6e'; g.fillRect(0, 0, w, h); sText(g, 'M&T BANK STADIUM', w / 2, h * 0.56, w * 0.92, h * 0.68, SANS, '#ffffff', { weight: '900' }); });
  sa.at(-102, Y0 + 13.6, 47.4, faceTo(0, -1), 15, 1.5, (g, w, h) => { g.fillStyle = '#3a1d6e'; g.fillRect(0, 0, w, h); sText(g, 'M&T BANK STADIUM', w / 2, h * 0.56, w * 0.92, h * 0.68, SANS, '#ffffff', { weight: '900' }); });

  const grp = H.build(), signs = sa.build(); grp.name = 'stadiums_hd'; signs.name = 'stadiums_signs'; scene.add(grp, signs);
  out.mesh = grp; out.signs = signs; out.tris = grp.userData.tris; return out;
})();
window.__stadiums = STADIUMS;
