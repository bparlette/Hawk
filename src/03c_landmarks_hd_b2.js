
// ======================= HD landmarks batch 2: National Aquarium (Pier 3), Maryland Science Center, Harborplace pavilions, USS Constellation =======
// Same approach as batch 1 (03b_landmarks_hd.js): one merged toon mesh + one ink hull + one canvas-sign atlas per landmark, far LOD = the massing
// captured in parts/h_landmarks.js (footprints / heights there match these models), extra colliders via lmColl.
// Extra builder helpers (kept here so batch 1 stays untouched):
HB.prototype.seg = function (a, b, r, col, o = {}) { // a round bar from point a to point b (rigging, rods, mullions on slopes)
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); if (L < 1e-4) return this;
  const g = new THREE.CylinderGeometry(o.r1 === undefined ? r : o.r1, r, L, o.seg || 4, 1, !!o.open);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return this.add(g, col, Object.assign({ ol: false }, o));
};
{ const _box = HB.prototype.box; HB.prototype.box = function (x0, y0, z0, x1, y1, z1, col, o) { return _box.call(this, Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), col, o); }; } // corner order free
HB.prototype.tris = function (pts, col, o) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.computeVertexNormals(); return this.add(g, col, o); };
// a polygon prism: profile [[a, y], ...] extruded; 'x' = profile in (z, y) extruded x0..x1, 'z' = profile in (x, y) extruded z0..z1
HB.prototype.prism = function (axis, s0, s1, prof, col, o) {
  const sh = new THREE.Shape(prof.map(([a, y]) => new THREE.Vector2(axis === 'x' ? -a : a, y))), g = new THREE.ExtrudeGeometry(sh, { depth: s1 - s0, bevelEnabled: false });
  if (axis === 'x') { g.rotateY(Math.PI / 2); g.translate(s0, 0, 0); } else g.translate(0, 0, s0); return this.add(g, col, o);
};
// a hip roof over x0..x1 / z0..z1 from y up h, ridge along the long side
HB.prototype.hip = function (x0, z0, x1, z1, y, h, col, o) {
  const W = x1 - x0, D = z1 - z0, P = [], t = (a, b, c) => P.push(...a, ...b, ...c);
  const a = [x0, y, z1], b = [x1, y, z1], c = [x1, y, z0], d = [x0, y, z0];
  if (W >= D) { const r0 = [x0 + D / 2, y + h, (z0 + z1) / 2], r1 = [x1 - D / 2, y + h, (z0 + z1) / 2]; t(a, b, r1); t(a, r1, r0); t(b, c, r1); t(c, d, r0); t(c, r0, r1); t(d, a, r0); }
  else { const r0 = [(x0 + x1) / 2, y + h, z1 - W / 2], r1 = [(x0 + x1) / 2, y + h, z0 + W / 2]; t(a, b, r0); t(b, c, r1); t(b, r1, r0); t(c, d, r1); t(d, a, r0); t(d, r0, r1); }
  return this.tris(P, col, o);
};
// a square / rectangular pyramid (sides only)
HB.prototype.pyr = function (x0, z0, x1, z1, y, apex, col, o) {
  const A = [(x0 + x1) / 2, apex, (z0 + z1) / 2], c = [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], P = [];
  for (let i = 0; i < 4; i++) P.push(...c[i], ...c[(i + 1) % 4], ...A); return this.tris(P, col, o);
};
const LMHOOK = {}; // set-piece interior stubs (phase 5 builds them): LMHOOK.aquarium.tank, LMHOOK.science.imax; also on the LANDMARKS entry as .interior
function lmHook(id, h) { LMHOOK[id] = h; const L = LANDMARKS.find((l) => l.id === id); if (L) L.interior = h; }

// ======================= NATIONAL AQUARIUM, PIER 3 (refs/national-aquarium: exterior_3, night_1): the raw board-formed concrete block over a recessed
// navy base, a ribbon of dark windows, the navy box carrying the big GLASS PYRAMID (blue edge light at night), the red Australia wing with its sloped
// blue glass roof on the west, the colour-square mosaic at the south-west corner, the concrete drum with the blue neon WAVE at the pier's south end,
// the glass entrance on Pratt St, the "Amazing things happen." banner (drawn, not the photo). Pier 4's mammal pavilion + footbridge are not modelled.
const AQ = { mx0: 11, mx1: 23, mz0: -26, mz1: -13, top: CURB + 15, nav: CURB + 17.6, apex: CURB + 24.8, wx0: 7.5, wz0: -26, wz1: -17, wTop: CURB + 8, wPeak: CURB + 14.5,
  dx: 22, dz: -11, dr: 4.6, dTop: CURB + 11, sx1: 18, sz1: -7.5, sTop: CURB + 5.5, ex0: 13, ex1: 21, ez0: -28.2, eTop: CURB + 4.5 };
lmHD('aquarium', 19, -17, 19, (H, signs, SG) => {
  const Y0 = CURB, A = AQ, CON = '#b2ab9e', CON2 = '#9a9387', NAVY = '#26376c', GLS = '#25323e', RED = '#b5332b', BLU = '#3d6fa6';
  // ---- main block: recessed navy base (0..6 m), board-formed concrete above, overhang carried on corner piers
  H.box(A.mx0 + 0.9, Y0, A.mz0 + 0.9, A.mx1 - 0.9, Y0 + 6, A.mz1 - 0.9, NAVY);
  H.box(A.mx0, Y0 + 6, A.mz0, A.mx1, A.top, A.mz1, CON);
  for (const [x, z] of [[A.mx0, A.mz0], [A.mx1 - 0.9, A.mz0], [A.mx1 - 0.9, A.mz1 - 0.9]]) H.box(x, Y0, z, x + 0.9, Y0 + 6, z + 0.9, CON2);
  const f = ppFaces(A.mx0, A.mz0, A.mx1, A.mz1, H);
  for (const k of ['n', 'e', 's', 'w']) { const F = f[k];
    for (let y = Y0 + 6.6; y < A.top - 0.5; y += 1.15) H.band(F, 0, F.L, y, y + 0.05, 0.025, CON2, { ol: false }); // board-form lines
    H.band(F, -0.05, F.L + 0.05, Y0 + 6, Y0 + 6.35, 0.06, CON2, { ol: false });
    H.band(F, -0.12, F.L + 0.12, A.top - 0.45, A.top, 0.14, CON2); // coping
    if (k !== 'w') { // the ribbon of dark windows (exterior_3), mullions + random lit panes
      H.fbox(F, 1.2, F.L - 1.2, Y0 + 8.6, Y0 + 10.8, -0.06, 0.02, GLS, { ol: false });
      for (let u = 1.2; u < F.L - 1.2; u += 1.05) { H.fbox(F, u, u + 0.06, Y0 + 8.6, Y0 + 10.8, 0, 0.05, '#4a525a', { ol: false }); if (LMR() < 0.45) H.fbox(F, u + 0.06, u + 1.0, Y0 + 8.65, Y0 + 10.75, 0, 0.03, GLS, { ol: false, emi: '#cfe0ff' }); }
      H.band(F, 1.1, F.L - 1.1, Y0 + 8.45, Y0 + 8.6, 0.08, CON2, { ol: false }); }
    // base: glazed storefront in the navy recess (lit at night)
    const B = H.frame(...{ n: [A.mx1 - 0.9, A.mz0 + 0.9, A.mx0 + 0.9, A.mz0 + 0.9], e: [A.mx1 - 0.9, A.mz1 - 0.9, A.mx1 - 0.9, A.mz0 + 0.9], s: [A.mx0 + 0.9, A.mz1 - 0.9, A.mx1 - 0.9, A.mz1 - 0.9], w: [A.mx0 + 0.9, A.mz0 + 0.9, A.mx0 + 0.9, A.mz1 - 0.9] }[k]);
    H.windows(B, 0.6, B.L - 0.6, Y0 + 0.4, Y0 + 5.4, { bw: 1.5, fh: 2.5, ww: 1.3, wh: 2.0, pane: '#3b5266', lit: 0.65, mull: '#8a96a2' }); }
  H.fbox(f.n, 4.6, 7.6, Y0 + 11.6, Y0 + 13.1, 0, 0.05, '#6a645a', { ol: false }); for (let y = Y0 + 11.75; y < Y0 + 13; y += 0.22) H.fbox(f.n, 4.65, 7.55, y, y + 0.08, 0.05, 0.12, '#4a463e', { ol: false }); // louvre
  // ---- mosaic of colour squares, the south-west corner (exterior_3 / night_1)
  { const x0 = A.mx0, z0 = A.mz1 - 4.6, pal = ['#f2efe6', '#d8382e', '#3aa64a', '#f0a030', '#a8a296', '#2a3440', '#f2efe6', '#e86a2a'];
    H.box(x0, Y0, z0, x0 + 5.2, Y0 + 6, A.mz1, '#e8e4da');
    for (const F of [H.frame(x0, z0, x0, A.mz1), H.frame(x0, A.mz1, x0 + 5.2, A.mz1)]) for (let r = 0; r < 5; r++) for (let c = 0; c < Math.floor(F.L / 0.95); c++) {
      const col = pal[Math.floor(LMR() * pal.length)]; H.fbox(F, 0.05 + c * 0.95, 0.95 + c * 0.95, Y0 + 0.4 + r * 1.1, Y0 + 1.42 + r * 1.1, 0, 0.04, col, { ol: false, emi: col === '#2a3440' && LMR() < 0.7 ? '#ffe0a0' : (r > 0 && LMR() < 0.25 ? col : null) }); } }
  // ---- the navy box + the GLASS PYRAMID
  const px0 = 12, px1 = 22, pz0 = -25, pz1 = -14;
  H.box(px0, A.top, pz0, px1, A.nav, pz1, NAVY);
  for (const F of Object.values(ppFaces(px0, pz0, px1, pz1, H))) { for (let u = 0.8; u < F.L - 0.6; u += 1.4) H.fbox(F, u, u + 0.9, A.top + 0.9, A.top + 1.9, -0.04, 0.02, GLS, { ol: false, emi: LMR() < 0.5 ? '#bcd4ff' : null }); H.band(F, -0.05, F.L + 0.05, A.nav - 0.18, A.nav, 0.08, '#1a2550', { ol: false }); }
  H.pyr(px0, pz0, px1, pz1, A.nav, A.apex, '#86bccb', { emi: '#2c5a50' });
  { const cx = (px0 + px1) / 2, cz = (pz0 + pz1) / 2, h = A.apex - A.nav, ap = [cx, A.apex, cz], c = [[px0, pz1], [px1, pz1], [px1, pz0], [px0, pz0]], MU = '#d8e4e8';
    const on = (x, z, k) => [lerp(x, cx, k), A.nav + h * k, lerp(z, cz, k)];
    for (let k = 0.11; k < 0.95; k += 0.11) for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; H.seg(on(a[0], a[1], k), on(b[0], b[1], k), 0.045, MU); }
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; for (let t = 1 / 7; t < 0.99; t += 1 / 7) H.seg([lerp(a[0], b[0], t), A.nav, lerp(a[1], b[1], t)], ap, 0.04, MU); }
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; // the edge light: blue tube on the hips + base (blue neon at night, steel blue by day)
      H.seg([a[0], A.nav + 0.05, a[1]], ap, 0.13, '#4a5c9a', { emi: '#7a96ff' }); H.seg([a[0], A.nav + 0.06, a[1]], [b[0], A.nav + 0.06, b[1]], 0.13, '#4a5c9a', { emi: '#7a96ff' }); } }
  // ---- roof plant on the concrete block (outside the navy box)
  for (const [x, z, w, d] of [[A.mx0 + 0.3, A.mz0 + 0.4, 1.6, 0.9], [A.mx1 - 1.9, A.mz0 + 0.3, 1.5, 1.1], [A.mx1 - 0.8, -20, 0.6, 2.2], [A.mx0 + 0.25, -17, 0.6, 1.6]]) H.box(x, A.top, z, x + w, A.top + 1.1, z + d, '#8e8a82');
  // ---- the red AUSTRALIA wing with its sloped blue glass roof + the red steel frame (exterior_3)
  H.box(A.wx0, Y0, A.wz0, A.mx0 + 0.02, A.wTop, A.wz1, RED);
  H.prism('z', A.wz0, A.wz1, [[A.wx0, A.wTop], [A.mx0 + 0.02, A.wTop], [A.mx0 + 0.02, A.wPeak]], BLU, { emi: '#1e3a6a' });
  { const L = Math.hypot(A.mx0 - A.wx0, A.wPeak - A.wTop), sl = Math.atan2(A.wPeak - A.wTop, A.mx0 - A.wx0);
    for (let z = A.wz0 + 0.9; z < A.wz1 - 0.2; z += 0.9) H.seg([A.wx0 - 0.02, A.wTop + 0.02, z], [A.mx0, A.wPeak + 0.02, z], 0.035, '#d8e4ea');
    for (let k = 1; k < 5; k++) { const x = lerp(A.wx0, A.mx0, k / 5), y = lerp(A.wTop, A.wPeak, k / 5) + 0.04; H.seg([x - 0.03, y, A.wz0], [x - 0.03, y, A.wz1], 0.035, '#d8e4ea'); }
    for (const z of [A.wz0 - 0.15, A.wz1 + 0.15]) { H.seg([A.wx0 - 0.15, A.wTop, z], [A.mx0 + 0.1, A.wPeak + 0.35, z], 0.1, '#c0302a'); H.seg([A.mx0 + 0.1, A.wPeak + 0.35, z], [A.mx0 + 0.1, A.wTop, z], 0.1, '#c0302a'); } void L; void sl; }
  for (const F of [H.frame(A.wx0, A.wz0, A.wx0, A.wz1), H.frame(A.wx0, A.wz1, A.mx0, A.wz1), H.frame(A.mx0, A.wz0, A.wx0, A.wz0)]) {
    H.windows(F, 0.4, F.L - 0.4, Y0 + 0.5, Y0 + 3.6, { bw: 1.6, fh: 3.1, ww: 1.3, wh: 2.3, pane: '#3a4e5e', lit: 0.6, mull: '#d8d2c8' });
    H.band(F, -0.06, F.L + 0.06, A.wTop - 0.35, A.wTop, 0.1, '#8a2420'); H.band(F, -0.04, F.L + 0.04, Y0 + 3.8, Y0 + 4.0, 0.06, '#8a2420', { ol: false }); }
  // ---- the south block (glass, lit) and the concrete DRUM with the blue neon WAVE
  H.box(A.mx0, Y0, A.mz1, A.sx1, A.sTop, A.sz1, '#c8c4ba');
  for (const F of [H.frame(A.mx0, A.mz1, A.mx0, A.sz1), H.frame(A.mx0, A.sz1, A.sx1, A.sz1)]) { H.windows(F, 0.3, F.L - 0.3, Y0 + 0.4, A.sTop - 0.6, { bw: 1.2, fh: A.sTop - 1.0 - Y0, ww: 1.05, wh: 3.6, pane: '#33505a', lit: 0.7, mull: '#7aa08a' }); H.band(F, -0.05, F.L + 0.05, A.sTop - 0.4, A.sTop, 0.1, CON2); }
  H.cyl(A.dx, Y0, A.dz, A.dr, A.dr, A.dTop - Y0, 28, CON);
  for (let y = Y0 + 1.1; y < A.dTop - 0.6; y += 1.1) H.cyl(A.dx, y, A.dz, A.dr + 0.02, A.dr + 0.02, 0.05, 28, CON2, { ol: false });
  H.cyl(A.dx, A.dTop - 0.45, A.dz, A.dr + 0.12, A.dr + 0.12, 0.45, 28, CON2);
  H.cyl(A.dx, A.dTop, A.dz, A.dr - 0.7, A.dr - 0.7, 1.3, 24, '#3c6a9a', { emi: '#2a4a8a' }); H.cyl(A.dx, A.dTop + 1.3, A.dz, A.dr - 0.55, A.dr - 0.55, 0.2, 24, CON2);
  for (const th of [0.55, 1.1, 1.65]) { const x = A.dx + Math.sin(th) * (A.dr + 0.03), z = A.dz + Math.cos(th) * (A.dr + 0.03); H.box(x - 0.3, Y0 + 0.2, z - 0.3, x + 0.3, Y0 + 2.6, z + 0.3, '#2a3a4a', { ol: false, emi: '#ffd8a0' }); }
  { let prev = null; for (let i = 0; i <= 60; i++) { const th = lerp(-1.25, 0.55, i / 60), r = A.dr + 0.1, y = Y0 + 6.2 + Math.sin(i / 60 * TAU * 2.25) * 0.9 + (i > 54 ? (i - 54) * 0.12 : 0);
    const p = [A.dx + Math.sin(th) * r, y, A.dz + Math.cos(th) * r]; if (prev) H.seg(prev, p, 0.11, '#5a72d6', { emi: '#86a2ff', seg: 5 }); prev = p; } }
  // ---- Pratt St entrance pavilion (glass, steel) + the name on the concrete above
  H.box(A.ex0, Y0, A.ez0, A.ex1, A.eTop, A.mz0, '#2e3e4c', { emi: '#3a3020' });
  H.box(A.ex0 - 0.3, A.eTop, A.ez0 - 0.3, A.ex1 + 0.3, A.eTop + 0.3, A.mz0, '#d8d6d0');
  { const F = H.frame(A.ex1, A.ez0, A.ex0, A.ez0); for (let u = 0; u <= F.L + 0.01; u += 1.0) H.fbox(F, u - 0.05, u + 0.05, Y0, A.eTop, 0, 0.08, '#d8d6d0', { ol: false }); H.fbox(F, 0, F.L, Y0 + 2.6, Y0 + 2.7, 0, 0.08, '#d8d6d0', { ol: false });
    for (let u = 0.1; u < F.L; u += 1.0) H.fbox(F, u, u + 0.85, Y0 + 0.05, Y0 + 2.55, -0.05, 0.02, '#3a5060', { ol: false, emi: '#ffe2a8' }); }
  SG.add(f.n, f.n.L / 2, Y0 + 6.7, 8.4, 1.3, 0.08, (g, w, h) => { sText(g, 'NATIONAL AQUARIUM', w / 2, h * 0.42, w * 0.97, h * 0.62, SANS, '#1f3a78', { weight: '800', track: 2, stroke: '#e8eef8', sw: h * 0.04 });
    sText(g, 'BALTIMORE', w / 2, h * 0.85, w * 0.3, h * 0.2, SANS, '#1f3a78', { weight: '700', track: 6 }); });
  SG.add(H.frame(A.ex1, A.ez0 - 0.31, A.ex0, A.ez0 - 0.31), 4, A.eTop + 0.02, 6.2, 0.26, 0.02, (g, w, h) => { g.fillStyle = '#1f3a78'; g.fillRect(0, 0, w, h); sText(g, 'NATIONAL AQUARIUM \u00b7 ENTRANCE', w / 2, h / 2, w * 0.95, h * 0.72, SANS, '#ffffff', { weight: '700', track: 2 }); });
  // the west-face banner (exterior_3): "Amazing things happen." over a dolphin in blue water, NATIONAL AQUARIUM / aqua.org (drawn here, not the photo)
  SG.add(f.w, f.w.L - 1.9, Y0 + 7.4, 3.0, 5.6, 0.06, (g, w, h) => {
    const sk = g.createLinearGradient(0, 0, 0, h); sk.addColorStop(0, '#e8f2fa'); sk.addColorStop(0.2, '#e8f2fa'); sk.addColorStop(0.21, '#1f6fae'); sk.addColorStop(1, '#0b2f66'); g.fillStyle = sk; g.fillRect(0, 0, w, h);
    sText(g, 'Amazing', w * 0.06, h * 0.06, w * 0.9, h * 0.07, SANS, '#1f4f9a', { align: 'left', weight: '700' }); sText(g, 'things happen.', w * 0.06, h * 0.14, w * 0.9, h * 0.07, SANS, '#1f4f9a', { align: 'left', weight: '700' });
    g.save(); g.translate(w * 0.55, h * 0.45); g.rotate(-0.35); g.fillStyle = '#9ab4c8'; g.beginPath(); g.ellipse(0, 0, w * 0.26, h * 0.045, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-w * 0.02, -h * 0.03); g.lineTo(w * 0.06, -h * 0.085); g.lineTo(w * 0.08, -h * 0.03); g.fill(); g.beginPath(); g.moveTo(w * 0.24, 0); g.lineTo(w * 0.34, -h * 0.03); g.lineTo(w * 0.32, h * 0.03); g.fill();
    g.beginPath(); g.ellipse(-w * 0.27, h * 0.008, w * 0.05, h * 0.012, 0, 0, TAU); g.fill(); g.restore();
    g.fillStyle = '#20242a'; g.beginPath(); g.ellipse(w * 0.22, h * 0.6, w * 0.035, h * 0.06, 0.3, 0, TAU); g.fill(); g.fillRect(w * 0.2, h * 0.52, w * 0.04, h * 0.02);
    g.fillStyle = '#0a2654'; g.fillRect(0, h * 0.8, w, h * 0.2); g.strokeStyle = '#fff'; g.lineWidth = w * 0.015; g.beginPath(); g.arc(w / 2, h * 0.845, w * 0.05, 0, TAU); g.stroke();
    sText(g, 'NATIONAL', w / 2, h * 0.9, w * 0.6, h * 0.04, SANS, '#fff', { weight: '700', track: 2 }); sText(g, 'AQUARIUM', w / 2, h * 0.94, w * 0.6, h * 0.04, SANS, '#fff', { weight: '700', track: 2 });
    sText(g, 'aqua.org', w / 2, h * 0.975, w * 0.3, h * 0.025, SANS, '#cfe0ff', { weight: '500' }); });
  // stub hook: the underwater tank set piece (phase 5) sits under the pyramid; the Pratt St doors are its way in
  lmHook('aquarium', { stub: true, kind: 'underwater_tank', door: { x: (A.ex0 + A.ex1) / 2, z: A.ez0 - 0.6 }, tank: { x: 17, y: CURB + 1, z: -19.5, w: 10, d: 11, h: 12 } });
});

// ======================= MARYLAND SCIENCE CENTER (refs/maryland-science-center: exterior_1 aerial, msc_web_1 / msc_web_3 entrance). Seen from the
// harbour (looking south), left to right = east to west: the 1976 dark-brick block with its brick stair towers + the white observatory dome on the roof,
// the glass box with the yellow ELEMENTS CAFE pod, the brick panel with the oval MARYLAND SCiENCE CENTER sign + IMAX THEATER / DAVIS PLANETARIUM
// banners, the slim glass stair tower, the curved glass drum with the yellow "Let's science" canopy, the silver ribbed wing + the west glass box;
// the crossed-rod steel sculpture over the plaza. The IMAX theatre (later set piece) is a stub hook inside the brick block.
const MSC = { bx0: -51, bx1: -42.5, bz0: 52, bz1: 69, bTop: CURB + 12, gx0: -50.5, gx1: -43, gz0: 47, gz1: 52, gTop: CURB + 10, px0: -53.2, px1: -50.5, pz0: 48, pz1: 57, pTop: CURB + 13.2,
  tx0: -54.5, tx1: -53.2, tz0: 47.8, tz1: 49.4, tTop: CURB + 15.2, dx: -57.6, dz: 55, dr: 5.6, dTop: CURB + 9.6, d2Top: CURB + 12.6, wx0: -66, wx1: -62, wz0: 47.6, wz1: 57, wTop: CURB + 8.6,
  mx0: -66, mx1: -56, mz0: 57, mz1: 69, mTop: CURB + 11, cx0: -56, cx1: -51, cz0: 57, cz1: 69 };
lmHD('science', -54, 58, 16, (H, signs, SG) => {
  const Y0 = CURB, M = MSC, BR = '#7a3b2b', BR2 = '#683022', BR3 = '#86442f', GL = '#3f6f9a', GLD = '#2c4a66', ST = '#d4d8dc', YEL = '#e8b028', SIL = '#b4bac0';
  const glassFace = (F, y0, y1, o = {}) => { // curtain wall: tinted glass, light steel grid, random lit panels
    H.fbox(F, 0, F.L, y0, y1, -0.04, 0.02, o.col || GL, { ol: false });
    const nb = Math.max(1, Math.round(F.L / (o.bw || 1.5))), nf = Math.max(1, Math.round((y1 - y0) / (o.fh || 1.8)));
    for (let i = 0; i <= nb; i++) H.fbox(F, F.L * i / nb - 0.05, F.L * i / nb + 0.05, y0, y1, 0, 0.07, ST, { ol: false });
    for (let j = 0; j <= nf; j++) H.fbox(F, 0, F.L, y0 + (y1 - y0) * j / nf - 0.04, y0 + (y1 - y0) * j / nf + 0.04, 0, 0.06, ST, { ol: false });
    for (let i = 0; i < nb; i++) for (let j = 0; j < nf; j++) if (LMR() < (o.lit || 0.45)) H.fbox(F, F.L * i / nb + 0.06, F.L * (i + 1) / nb - 0.06, y0 + (y1 - y0) * j / nf + 0.05, y0 + (y1 - y0) * (j + 1) / nf - 0.05, 0.005, 0.03, GLD, { ol: false, emi: LMR() < 0.8 ? '#ffe0a8' : '#cfe0ff' });
  };
  // ---- the brick block (east) + the connecting brick mass behind the drum
  H.box(M.bx0, Y0, M.bz0, M.bx1, M.bTop, M.bz1, BR); H.box(M.cx0, Y0, M.cz0, M.cx1, M.bTop, M.cz1, BR2);
  for (const F of Object.values(ppFaces(M.bx0, M.bz0, M.bx1, M.bz1, H))) { H.band(F, -0.1, F.L + 0.1, M.bTop - 0.4, M.bTop, 0.12, BR2); for (let y = Y0 + 1; y < M.bTop - 0.6; y += 2.4) H.band(F, 0, F.L, y, y + 0.08, 0.04, BR3, { ol: false });
    H.windows(F, 1.0, F.L - 1.0, Y0 + 8.2, Y0 + 10.6, { bw: 3.2, fh: 2.4, ww: 0.5, wh: 1.6, pane: '#2a2f38', lit: 0.4 }); }
  for (const [x, z, w, top] of [[-50.8, 52.2, 2.6, CURB + 16.2], [-45.2, 52.6, 2.4, CURB + 15.4], [-50.6, 62.5, 2.4, CURB + 15.8], [-44.6, 64.8, 2.6, CURB + 16.6], [-55.6, 66, 2.4, CURB + 15.2]]) { // the brick stair towers
    H.box(x, Y0, z, x + w, top, z + w, BR3); H.box(x - 0.1, top - 0.35, z - 0.1, x + w + 0.1, top, z + w + 0.1, BR2);
    for (const F of Object.values(ppFaces(x, z, x + w, z + w, H))) H.fbox(F, F.L / 2 - 0.12, F.L / 2 + 0.12, Y0 + 2, top - 1.2, -0.05, 0.02, '#4a2418', { ol: false }); }
  // the observatory: a white dome on a short drum on the brick roof (exterior_1)
  H.cyl(-46.8, M.bTop, 60.5, 2.0, 2.0, 1.2, 16, '#c8c4bc'); { const g = new THREE.SphereGeometry(2.05, 16, 8, 0, TAU, 0, Math.PI / 2); g.translate(-46.8, M.bTop + 1.2, 60.5); H.geo(g, '#f2f2f0'); }
  H.box(-46.95, M.bTop + 1.2, 58.4, -46.65, M.bTop + 3.2, 58.6, '#9aa0a8', { ol: false }); // the dome slit
  // rooftop: white tent structure (exterior_1) on the connecting block
  H.box(M.cx0 + 0.4, M.bTop, M.cz0 + 1, M.cx1 - 0.4, M.bTop + 0.9, M.cz0 + 7, '#e8e8e4'); for (let z = M.cz0 + 1.6; z < M.cz0 + 7; z += 1.5) H.prism('x', M.cx0 + 0.4, M.cx1 - 0.4, [[z - 0.75, M.bTop + 0.9], [z + 0.75, M.bTop + 0.9], [z, M.bTop + 1.6]], '#f4f4f0');
  // ---- the east glass box + the yellow ELEMENTS CAFE pod
  H.box(M.gx0, Y0, M.gz0, M.gx1, M.gTop, M.gz1, GL);
  { const f = ppFaces(M.gx0, M.gz0, M.gx1, M.gz1, H); for (const k of ['n', 'e', 'w']) glassFace(f[k], Y0 + 0.05, M.gTop - 0.05, { bw: 1.4, fh: 1.65 });
    H.box(M.gx0 - 0.12, M.gTop - 0.1, M.gz0 - 0.12, M.gx1 + 0.12, M.gTop + 0.25, M.gz1 + 0.12, ST);
    H.box(-50.2, Y0, 46.4, -46.2, Y0 + 3.3, 48.6, YEL); H.box(-50.3, Y0 + 3.3, 46.3, -46.1, Y0 + 3.5, 48.7, '#c8901a');
    const N = H.frame(-46.2, 46.4, -50.2, 46.4); H.fbox(N, 0.6, 2.3, Y0 + 0.05, Y0 + 2.4, -0.04, 0.03, '#2a3440', { ol: false, emi: '#ffe0a8' }); H.fbox(N, 2.6, 3.6, Y0 + 0.05, Y0 + 2.4, -0.04, 0.03, '#2a3440', { ol: false, emi: '#ffe0a8' });
    SG.add(N, 2.0, Y0 + 2.55, 3.4, 0.5, 0.03, (g, w, h) => sText(g, 'ELEMENTS CAF\u00c9', w / 2, h / 2, w * 0.95, h * 0.8, SERIF, '#e8486a', { weight: '900', stroke: '#8a1a30', sw: h * 0.05 })); }
  // ---- the brick panel with the oval sign + the two banners
  H.box(M.px0, Y0, M.pz0, M.px1, M.pTop, M.pz1, BR); H.box(M.px0 - 0.08, M.pTop - 0.3, M.pz0 - 0.08, M.px1 + 0.08, M.pTop, M.pz1 + 0.08, BR2);
  H.box(M.px0 + 0.6, M.pTop, M.pz0 + 0.5, M.px0 + 1.4, M.pTop + 0.5, M.pz0 + 1.6, '#c8c8c4'); // the rooftop camera box (msc_web_1)
  { const N = H.frame(M.px1, M.pz0, M.px0, M.pz0);
    SG.add(N, N.L / 2, Y0 + 9.6, 2.5, 1.25, 0.1, (g, w, h) => { g.fillStyle = '#c8ccd0'; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, 0, 0, TAU); g.fill(); g.fillStyle = '#111316'; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - h * 0.07, h / 2 - h * 0.07, 0, 0, TAU); g.fill();
      sText(g, 'MARYLAND', w * 0.52, h * 0.27, w * 0.38, h * 0.13, SANS, '#7fb4e8', { weight: '700', track: 2 }); sText(g, 'SCiENCE', w * 0.47, h * 0.55, w * 0.68, h * 0.36, SERIF, '#f4f4f0', { weight: '700' });
      sText(g, 'CENTER', w * 0.66, h * 0.79, w * 0.3, h * 0.12, SANS, '#7fb4e8', { weight: '700', track: 2 }); });
    const banner = (x, title, sub, art) => SG.add(N, x, Y0 + 2.6, 1.15, 5.0, 0.06, (g, w, h) => { g.fillStyle = '#14181e'; g.fillRect(0, 0, w, h); art(g, w, h);
      sText(g, title, w / 2, h * 0.045, w * 0.9, h * 0.035, SANS, '#ffffff', { weight: '800' }); sText(g, sub, w / 2, h * 0.94, w * 0.9, h * 0.06, SANS, '#7fd0ff', { weight: '900' }); });
    banner(0.75, 'IMAX THEATER', 'IMAX', (g, w, h) => { const sk = g.createLinearGradient(0, h * 0.1, 0, h * 0.85); sk.addColorStop(0, '#3a6a9a'); sk.addColorStop(0.5, '#a8c8d8'); sk.addColorStop(1, '#2a3a2a'); g.fillStyle = sk; g.fillRect(0, h * 0.08, w, h * 0.8);
      g.fillStyle = '#e86a1a'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + s * w * 0.18, h * 0.3, w * 0.2, h * 0.07, s * 0.5, 0, TAU); g.fill(); } g.fillStyle = '#1a1a1a'; g.fillRect(w * 0.48, h * 0.22, w * 0.04, h * 0.16);
      g.fillStyle = '#f2f0ea'; g.beginPath(); g.ellipse(w * 0.5, h * 0.66, w * 0.34, h * 0.09, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(w * 0.26, h * 0.6, w * 0.13, 0, TAU); g.fill(); });
    banner(1.95, 'DAVIS PLANETARIUM', 'Under the Dome', (g, w, h) => { g.fillStyle = '#0a1230'; g.fillRect(0, h * 0.08, w, h * 0.8); g.fillStyle = '#fff'; for (let i = 0; i < 60; i++) g.fillRect(LMR() * w, h * 0.08 + LMR() * h * 0.6, 1.5, 1.5);
      g.fillStyle = '#1a2a1a'; g.beginPath(); g.moveTo(0, h * 0.88); g.lineTo(0, h * 0.72); g.quadraticCurveTo(w / 2, h * 0.62, w, h * 0.72); g.lineTo(w, h * 0.88); g.fill();
      sText(g, 'Day', w / 2, h * 0.3, w * 0.8, h * 0.07, SCRIPT, '#f4f0e0'); sText(g, 'Turns to', w / 2, h * 0.37, w * 0.8, h * 0.05, SCRIPT, '#f4f0e0'); sText(g, 'Night', w / 2, h * 0.45, w * 0.9, h * 0.08, SCRIPT, '#f4f0e0'); }); }
  // ---- the slim glass stair tower (white frame)
  H.box(M.tx0, Y0, M.tz0, M.tx1, M.tTop, M.tz1, GL); H.box(M.tx0 - 0.1, M.tTop - 0.5, M.tz0 - 0.1, M.tx1 + 0.1, M.tTop, M.tz1 + 0.1, '#f2f2ee');
  { const f = ppFaces(M.tx0, M.tz0, M.tx1, M.tz1, H); for (const k of ['n', 'e', 'w']) { const F = f[k]; for (const u of [0, F.L]) H.fbox(F, u - 0.1, u + 0.1, Y0, M.tTop - 0.5, 0, 0.1, '#f2f2ee', { ol: false }); for (let y = Y0 + 2.2; y < M.tTop - 0.6; y += 1.9) H.fbox(F, 0, F.L, y, y + 0.1, 0, 0.08, '#f2f2ee', { ol: false });
    for (let y = Y0 + 2.3; y < M.tTop - 1; y += 1.9) if (LMR() < 0.6) H.fbox(F, 0.12, F.L - 0.12, y + 0.15, y + 1.7, 0.005, 0.03, GLD, { ol: false, emi: '#e8f0ff' }); } }
  // ---- the curved glass DRUM (lower curtain wall, white band, recessed upper ring, flat roof) + the "Let's science" canopy
  H.cyl(M.dx, Y0, M.dz, M.dr, M.dr, M.dTop - Y0, 32, GL, { emi: '#3a3420' });
  for (let i = 0; i < 32; i++) { const a = i / 32 * TAU, x = M.dx + Math.sin(a) * (M.dr + 0.04), z = M.dz + Math.cos(a) * (M.dr + 0.04); H.box(x - 0.06, Y0, z - 0.06, x + 0.06, M.dTop, z + 0.06, ST, { ol: false }); }
  for (let y = Y0 + 2.4; y < M.dTop - 0.5; y += 2.4) H.cyl(M.dx, y, M.dz, M.dr + 0.05, M.dr + 0.05, 0.1, 32, ST, { ol: false });
  H.cyl(M.dx, M.dTop, M.dz, M.dr + 0.25, M.dr + 0.25, 0.7, 32, '#e4e6e8');
  H.cyl(M.dx, M.dTop + 0.7, M.dz, M.dr - 1.1, M.dr - 1.1, M.d2Top - M.dTop - 1.1, 28, '#5d7f9c', { emi: '#2a3040' });
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, x = M.dx + Math.sin(a) * (M.dr - 1.06), z = M.dz + Math.cos(a) * (M.dr - 1.06); H.box(x - 0.05, M.dTop + 0.7, z - 0.05, x + 0.05, M.d2Top - 0.4, z + 0.05, ST, { ol: false }); }
  H.cyl(M.dx, M.d2Top - 0.4, M.dz, M.dr - 0.8, M.dr - 0.8, 0.4, 28, '#d8dade');
  for (const [x, z] of [[-58.6, 53.6], [-56.4, 56.2]]) H.box(x, M.d2Top, z, x + 1.2, M.d2Top + 0.7, z + 0.8, '#8a8e92'); // roof plant
  { const cxa = -58.9, cxb = -55.1, zb = M.dz - M.dr - 1.4, za = M.dz - M.dr + 0.6, y = Y0 + 2.9; // canopy (msc_web_1): yellow box frame on two posts
    H.box(cxa, y, zb, cxb, y + 0.75, za, YEL); H.box(cxa + 0.15, y - 0.05, zb + 0.15, cxb - 0.15, y + 0.02, za, '#a87a10', { ol: false });
    for (const x of [cxa + 0.12, cxb - 0.3]) H.box(x, Y0, zb + 0.1, x + 0.18, y, zb + 0.3, '#c8901a'); lmColl({ x0: cxa, x1: cxb, z0: zb, z1: zb + 0.4 });
    H.box(cxa + 0.3, Y0, za - 0.9, cxb - 0.3, Y0 + 2.5, za - 0.7, '#2a3440', { emi: '#ffe4b0' });
    SG.at((cxa + cxb) / 2, y - 0.45, zb - 0.02, 0, 3.4, 0.42, (g, w, h) => { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); sText(g, "Let's", w * 0.3, h / 2, w * 0.3, h * 0.7, SANS, '#fff', { weight: '800' }); sText(g, 'science', w * 0.66, h / 2, w * 0.4, h * 0.7, SANS, '#fff', { weight: '800' }); }); }
  // ---- the silver ribbed wing (behind) + the west glass box with its white roof slab
  H.box(M.mx0, Y0, M.mz0, M.mx1, M.mTop, M.mz1, SIL);
  for (const F of Object.values(ppFaces(M.mx0, M.mz0, M.mx1, M.mz1, H))) { for (let u = 0.3; u < F.L; u += 0.6) H.fbox(F, u - 0.06, u + 0.06, Y0 + 0.5, M.mTop - 0.3, 0, 0.08, '#9aa0a8', { ol: false }); H.band(F, -0.15, F.L + 0.15, M.mTop - 0.3, M.mTop + 0.1, 0.2, '#dde0e2'); }
  H.box(M.mx0 + 0.6, M.mTop, M.mz0 + 0.8, M.mx1 - 0.6, M.mTop + 0.9, M.mz1 - 0.8, '#c4c8cc'); // the raised roof deck
  H.box(M.wx0, Y0, M.wz0, M.wx1, M.wTop, M.wz1, GL);
  { const f = ppFaces(M.wx0, M.wz0, M.wx1, M.wz1, H); for (const k of ['n', 'w', 'e']) glassFace(f[k], Y0 + 0.05, M.wTop - 0.6, { bw: 1.3, fh: 2.0, col: '#356a5a', lit: 0.55 });
    H.box(M.wx0 - 0.5, M.wTop - 0.6, M.wz0 - 0.6, M.wx1 + 0.5, M.wTop + 0.25, M.wz1 + 0.2, '#ecece8'); }
  // ---- the crossed-rod stainless sculpture over the plaza (msc_web_1 / 3): a tensegrity of floating struts tied by cables, on three leaning ground struts
  { const S = '#e4e8ec', K = '#8a9098', ends = [];
    for (const [x, z, tx, ty, tz] of [[-57.2, 46.4, -55.6, CURB + 7.4, 46.9], [-51.6, 46.6, -53.0, CURB + 7.0, 47.0], [-54.4, 47.6, -54.2, CURB + 6.6, 46.5]]) { H.seg([x, CURB, z], [tx, ty, tz], 0.08, S, { seg: 6 }); lmColl({ x, z, r: 0.3 }); ends.push([tx, ty, tz]); }
    for (let i = 0; i < 9; i++) { const c = [lerp(-58, -50.5, LMR()), CURB + 7.2 + LMR() * 6.2, lerp(45.8, 47.8, LMR())], a = LMR() * TAU, el = (LMR() - 0.5) * 1.3, L = 3.2 + LMR() * 2.2;
      const d = [Math.cos(a) * Math.cos(el) * L / 2, Math.sin(el) * L / 2, Math.sin(a) * Math.cos(el) * L / 2 * 0.35], A = [c[0] - d[0], c[1] - d[1], c[2] - d[2]], B = [c[0] + d[0], c[1] + d[1], c[2] + d[2]];
      H.seg(A, B, 0.075, S, { seg: 6 }); ends.push(A, B); }
    for (let i = 0; i < ends.length; i++) { let best = -1, bd = 1e9; for (let k = 0; k < ends.length; k++) { if (k === i || (k >> 1) === (i >> 1) && i > 2 && k > 2) continue; const e = ends[k], dd = Math.hypot(e[0] - ends[i][0], e[1] - ends[i][1], e[2] - ends[i][2]); if (dd < bd && dd > 0.5) { bd = dd; best = k; } } if (best >= 0) H.seg(ends[i], ends[best], 0.014, K); } }
  lmHook('science', { stub: true, kind: 'imax_theatre', door: { x: -57, z: M.dz - M.dr - 1.8 }, screen: { x: -46.8, y: CURB + 1, z: 58, w: 8, h: 6, facing: 'west' }, hall: { x0: M.bx0, x1: M.bx1, z0: M.bz0, z1: M.bz1 } });
});

// ======================= HARBORPLACE (refs/harborplace: pratt_web_4 aerial, light_1 night, pavilion_2 panorama): the two 1980 market pavilions:
// two storeys of glass behind round cream concrete columns, a cream floor slab / balcony with a dark-green rail, navy awnings, a cream eave slab,
// pale copper-green hip roofs with a glazed roof monitor, cross gables with lit arched glass ends on the water side, rooftop vents; the Pratt Street
// Pavilion's octagonal west end with its own roof + glass skylight; flagpoles (US + Maryland) on the plaza; "Harborplace" fascia signs.
const HPV = [{ id: 'pratt', x0: -58, z0: -29, x1: -46, z1: -22, along: 'x', water: 's', street: 'n', name: 'PRATT STREET PAVILION', oct: { x: -54.6, z: -25.5, r: 3.75 } },
  { id: 'light', x0: -59, z0: -18, x1: -52, z1: 2, along: 'z', water: 'e', street: 'w', name: 'LIGHT STREET PAVILION' }];
lmHD('harborplace', -52, -12, 22, (H, signs, SG) => {
  const Y0 = CURB, E1 = Y0 + 3.3, E2 = Y0 + 6.4, COL = '#ddd5c4', CR2 = '#c8bfa9', GLS = '#2a3a42', FR = '#2f4a3c', ROOF = '#93bfa2', ROOF2 = '#7aa88a', AWN = '#25387a';
  for (const P of HPV) {
    const { x0, z0, x1, z1 } = P, ix0 = x0 + 0.9, ix1 = x1 - 0.9, iz0 = z0 + 0.9, iz1 = z1 - 0.9, f = ppFaces(ix0, iz0, ix1, iz1, H), fo = ppFaces(x0, z0, x1, z1, H);
    const octX1 = P.oct ? P.oct.x + P.oct.r * 0.6 : null; // the octagon replaces the west end of the Pratt pavilion
    const bx0 = P.oct ? octX1 : ix0;
    H.box(bx0, Y0, iz0, ix1, E2, iz1, GLS);
    H.box(P.oct ? octX1 - 0.3 : x0, E1, z0, x1, E1 + 0.35, z1, COL); // floor slab / balcony
    H.box((P.oct ? octX1 - 0.3 : x0) - 0.35, E2, z0 - 0.35, x1 + 0.35, E2 + 0.45, z1 + 0.35, COL); // eave slab
    // glazing: mullions + transoms (dark green), lit shops at night, navy awnings over the ground floor, balcony rail
    for (const k of ['n', 'e', 's', 'w']) { const F = f[k], Fo = fo[k]; if (P.oct && k === 'w') continue;
      const ua = P.oct && (k === 'n' || k === 's') ? (k === 'n' ? 0 : octX1 - ix0) : 0, ub = P.oct && (k === 'n' || k === 's') ? (k === 'n' ? F.L - (octX1 - ix0) : F.L) : F.L;
      for (const [y0, y1] of [[Y0 + 0.05, E1 - 0.05], [E1 + 0.4, E2 - 0.05]]) {
        for (let u = ua; u < ub - 0.3; u += 1.25) { const u1 = Math.min(ub, u + 1.25), lit = LMR() < 0.75;
          H.fbox(F, u + 0.06, u1 - 0.06, y0 + 0.1, y1 - 0.1, 0, 0.03, lit ? '#3a4a50' : GLS, { ol: false, emi: lit ? (LMR() < 0.85 ? '#ffd690' : '#ffb0d0') : null }); H.fbox(F, u - 0.05, u + 0.05, y0, y1, 0, 0.06, FR, { ol: false }); }
        H.fbox(F, ua, ub, y1 - 0.75, y1 - 0.68, 0, 0.06, FR, { ol: false }); }
      for (let u = ua + 0.2; u < ub - 1; u += 2.5) H.fbox(F, u, u + 2.1, Y0 + 2.45, Y0 + 2.62, 0.03, 0.85, AWN, { ol: false });
      const oa = ua + (Fo.L - F.L) / 2, ob = ub + (Fo.L - F.L) / 2;
      for (const ry of [0.55, 1.05]) H.fbox(Fo, oa, ob + (k === 'n' && P.oct ? 0.9 : 0), E1 + 0.35 + ry, E1 + 0.4 + ry, -0.05, 0.0, FR, { ol: false });
      for (let u = oa; u <= ob + 0.01; u += 0.6) H.fbox(Fo, u - 0.02, u + 0.02, E1 + 0.35, E1 + 1.45, -0.05, -0.01, FR, { ol: false });
      // round cream columns (full height) along the outer line
      for (let u = oa + 0.2; u <= ob - 0.1; u += 2.5) { const x = Fo.xa + Fo.ux * u - Fo.nx * 0.35, z = Fo.za + Fo.uz * u - Fo.nz * 0.35; H.cyl(x, Y0, z, 0.22, 0.24, E2 - Y0, 8, COL); } }
    // the hip roof, its glazed roof monitor, and the cross gables with arched lit glass ends on the water side
    const rh = (P.along === 'x' ? z1 - z0 : x1 - x0) * 0.3 + 0.6, ry = E2 + 0.45;
    const rx0 = (P.oct ? octX1 - 0.3 : x0) - 0.35;
    H.hip(rx0, z0 - 0.35, x1 + 0.35, z1 + 0.35, ry, rh, ROOF);
    { const mw = 1.2, cx = (rx0 + x1 + 0.35) / 2, cz = (z0 + z1) / 2, L = P.along === 'x' ? (x1 - rx0) * 0.45 : (z1 - z0) * 0.6, yb = ry + rh * 0.72;
      const [mx0, mz0, mx1, mz1] = P.along === 'x' ? [cx - L / 2, cz - mw, cx + L / 2, cz + mw] : [cx - mw, cz - L / 2, cx + mw, cz + L / 2];
      H.box(mx0, yb, mz0, mx1, ry + rh + 0.55, mz1, '#3a4e56', { emi: '#5a4a2a' }); H.hip(mx0 - 0.2, mz0 - 0.2, mx1 + 0.2, mz1 + 0.2, ry + rh + 0.55, 0.55, ROOF2);
      for (const F of Object.values(ppFaces(mx0, mz0, mx1, mz1, H))) for (let u = 0.5; u < F.L; u += 0.7) H.fbox(F, u - 0.03, u + 0.03, yb, ry + rh + 0.55, 0, 0.04, FR, { ol: false }); }
    const gables = P.along === 'x' ? [-49.6] : [-13.2, -6, 1.2 - 2.2];
    for (const g of gables) { const gw = 1.9, gh = rh * 0.95, yb = ry;
      if (P.along === 'x') { const zw = z1 + 0.5, zi = (z0 + z1) / 2; H.prism('z', zi, zw, [[g - gw, yb], [g + gw, yb], [g, yb + gh]], ROOF2);
        H.box(g - gw + 0.1, yb - 0.45, zw - 0.2, g + gw - 0.1, yb + 0.02, zw, COL, { ol: false });
        const F = H.frame(g - gw, zw, g + gw, zw); H.farch(F, gw, yb, gw - 0.35, 0.0, 0.03, '#3a4a50', { ol: false, emi: '#ffd690' }, 10); for (const du of [-0.6, 0, 0.6]) H.fbox(F, gw + du - 0.03, gw + du + 0.03, yb, yb + Math.sqrt(Math.max(0, (gw - 0.35) ** 2 - du * du)), 0.03, 0.06, FR, { ol: false });
        SG.add(F, gw, yb - 0.44, 3.4, 0.42, 0.03, (gg, w, h) => { gg.fillStyle = '#1f3a30'; gg.fillRect(0, 0, w, h); sText(gg, 'Harborplace', w / 2, h * 0.54, w * 0.92, h * 0.78, SERIF, '#f2e6c4', { weight: '600' }); }); }
      else { const xw = x1 + 0.5, xi = (x0 + x1) / 2; H.prism('x', xi, xw, [[g - gw, yb], [g + gw, yb], [g, yb + gh]], ROOF2);
        H.box(xw - 0.2, yb - 0.45, g - gw + 0.1, xw, yb + 0.02, g + gw - 0.1, COL, { ol: false });
        const F = H.frame(xw, g + gw, xw, g - gw); H.farch(F, gw, yb, gw - 0.35, 0.0, 0.03, '#3a4a50', { ol: false, emi: '#ffd690' }, 10); for (const du of [-0.6, 0, 0.6]) H.fbox(F, gw + du - 0.03, gw + du + 0.03, yb, yb + Math.sqrt(Math.max(0, (gw - 0.35) ** 2 - du * du)), 0.03, 0.06, FR, { ol: false });
        SG.add(F, gw, yb - 0.44, 3.4, 0.42, 0.03, (gg, w, h) => { gg.fillStyle = '#1f3a30'; gg.fillRect(0, 0, w, h); sText(gg, 'Harborplace', w / 2, h * 0.54, w * 0.92, h * 0.78, SERIF, '#f2e6c4', { weight: '600' }); }); } }
    // rooftop vents (pratt_web_4)
    for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5, x = P.along === 'x' ? lerp(rx0 + 1.5, x1 - 1, t) : (x0 + x1) / 2 + (i % 2 ? 1.6 : -1.6), z = P.along === 'x' ? (z0 + z1) / 2 + (i % 2 ? 1.5 : -1.5) : lerp(z0 + 1.5, z1 - 1.5, t);
      H.cyl(x, ry + rh * 0.35, z, 0.22, 0.26, 0.9, 8, '#b8bcb0'); H.cyl(x, ry + rh * 0.35 + 0.9, z, 0.36, 0.3, 0.2, 8, '#8a9088'); }
    // street-side name board
    { const S = fo[P.street]; SG.add(S, S.L / 2 + (P.oct ? 2 : 0), E2 + 0.02, 6.2, 0.42, 0.37, (g, w, h) => { g.fillStyle = '#1f3a30'; g.fillRect(0, 0, w, h); sText(g, 'HARBORPLACE \u00b7 ' + P.name, w / 2, h * 0.55, w * 0.95, h * 0.68, SERIF, '#f2e6c4', { weight: '600', track: 1 }); }); }
    // the octagonal west end: two glazed storeys behind columns, its own eave + octagonal roof + a glass pyramid skylight
    if (P.oct) { const { x, z, r } = P.oct, rot = Math.PI / 8;
      H.cyl(x, Y0, z, r - 0.8, r - 0.8, E2 - Y0, 8, GLS, { ry: rot });
      for (let i = 0; i < 8; i++) { const a0 = i / 8 * TAU + rot, a1 = (i + 1) / 8 * TAU + rot, rr = (r - 0.8) / Math.cos(Math.PI / 8) * 1.0;
        const ax = x + Math.sin(a0) * rr, az = z + Math.cos(a0) * rr, bx = x + Math.sin(a1) * rr, bz = z + Math.cos(a1) * rr; const F = H.frame(bx, bz, ax, az);
        for (const [y0, y1] of [[Y0 + 0.05, E1 - 0.05], [E1 + 0.4, E2 - 0.05]]) { H.fbox(F, 0.1, F.L - 0.1, y0 + 0.1, y1 - 0.1, 0, 0.03, '#3a4a50', { ol: false, emi: LMR() < 0.8 ? '#ffd690' : null }); H.fbox(F, F.L / 2 - 0.04, F.L / 2 + 0.04, y0, y1, 0, 0.06, FR, { ol: false }); }
        H.fbox(F, 0.1, F.L - 0.1, Y0 + 2.45, Y0 + 2.62, 0.03, 0.85, AWN, { ol: false });
        const cxp = x + Math.sin(a0) * (r - 0.3) / Math.cos(Math.PI / 8) * 0.96, czp = z + Math.cos(a0) * (r - 0.3) / Math.cos(Math.PI / 8) * 0.96; H.cyl(cxp, Y0, czp, 0.22, 0.24, E2 - Y0, 8, COL); }
      H.cyl(x, E1, z, r, r, 0.35, 8, COL, { ry: rot }); H.cyl(x, E2, z, r + 0.4, r + 0.4, 0.45, 8, COL, { ry: rot });
      H.cyl(x, E2 + 0.45, z, 1.1, r + 0.4, 2.2, 8, ROOF, { ry: rot }); H.cyl(x, E2 + 2.65, z, 0.02, 1.15, 1.1, 8, '#a8d4e0', { ry: rot, emi: '#6a5a30' });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + rot, rr = 1.15 / Math.cos(Math.PI / 8); H.seg([x + Math.sin(a) * rr, E2 + 2.65, z + Math.cos(a) * rr], [x, E2 + 3.75, z], 0.035, '#e8ecee'); } }
  }
  // flagpoles on the plaza east of the Pratt pavilion: the US flag + the Maryland flag (drawn as stripes / quarters in the mesh, not textures)
  const flag = (x, z, kind) => { const top = CURB + 11; H.cyl(x, CURB, z, 0.06, 0.1, top - CURB, 6, '#e0e0dc', { ol: false }); H.cyl(x, top, z, 0.13, 0.13, 0.22, 6, '#c8a040', { ol: false }); lmColl({ x, z, r: 0.3 });
    const W = 2.4, Hh = 1.4, y1 = top - 0.2, y0 = y1 - Hh, zz = z + 0.02;
    if (kind === 'us') { for (let i = 0; i < 13; i++) H.box(x + 0.08, y1 - (i + 1) * Hh / 13, zz - 0.01, x + 0.08 + W, y1 - i * Hh / 13, zz + 0.01, i % 2 ? '#f4f2ec' : '#b8283a', { ol: false });
      H.box(x + 0.08, y1 - Hh * 7 / 13, zz - 0.015, x + 0.08 + W * 0.4, y1, zz + 0.015, '#243a7a', { ol: false });
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { const sx = x + 0.2 + c * W * 0.07, sy = y1 - 0.12 - r * Hh * 0.13; H.box(sx, sy - 0.03, zz - 0.02, sx + 0.05, sy + 0.03, zz + 0.02, '#ffffff', { ol: false }); } }
    else { const q = (qx, qy, cal) => { const ax = x + 0.08 + qx * W / 2, ay = y0 + qy * Hh / 2;
        if (cal) for (let i = 0; i < 6; i++) H.box(ax + i * W / 12, ay, zz - 0.01, ax + (i + 1) * W / 12, ay + Hh / 2, zz + 0.01, (i + (qx + qy) % 2) % 2 ? '#1c1c1c' : '#e8b020', { ol: false });
        else { H.box(ax, ay, zz - 0.01, ax + W / 2, ay + Hh / 2, zz + 0.01, '#f4f2ec', { ol: false }); H.box(ax + W / 4 - 0.07, ay + 0.06, zz - 0.015, ax + W / 4 + 0.07, ay + Hh / 2 - 0.06, zz + 0.015, '#c0283a', { ol: false }); H.box(ax + 0.08, ay + Hh / 4 - 0.07, zz - 0.015, ax + W / 2 - 0.08, ay + Hh / 4 + 0.07, zz + 0.015, '#c0283a', { ol: false }); } };
      q(0, 1, true); q(1, 0, true); q(1, 1, false); q(0, 0, false); } };
  flag(-58.2, -20.6, 'us'); flag(-55.4, -20.6, 'md'); // on the corner plaza between the two pavilions (pratt_web_4)
});

// ======================= USS CONSTELLATION (refs/uss-constellation: ship_1, con_2): the 1854 sloop-of-war moored bow-north beside her pier (Pier 1).
// Lofted hull: mint-green copper bottom, black topsides, the white gunport band with black ports, black bulwarks; gold scrollwork at the bow + a gold
// figurehead, the white stern with windows + CONSTELLATION in gold; three masts (pale lower masts, wooden topmasts, fighting tops, crosstrees),
// black yards, the mizzen gaff + spanker boom, bowsprit + jib-boom; shrouds with ratlines (canvas net quads), stays + backstays; the white deck awning;
// the stern ensign, masthead pennants and the jack; wooden pile dolphins with mooring lines; a gangway to the pier.
lmHD('constellation', -31, -18, 20, (H, signs, SG) => {
  const cx = -31, zs = -9.4, zb = -29.4, B = 2.6, KEEL = WY - 1.2, DECK = CURB + 1.6, RAIL = CURB + 1.98;
  const lenP = (t) => t < 0.1 ? 0.74 + 0.26 * Math.sin(t / 0.1 * Math.PI / 2) : t < 0.58 ? 1 : Math.pow(Math.max(0, Math.cos(Math.min(1, (t - 0.58) / 0.42) * Math.PI / 2)), 0.75);
  const secP = (yn) => (0.2 + 0.8 * Math.pow(Math.sin(Math.min(1, yn / 0.62) * Math.PI / 2), 0.55)) * (yn > 0.85 ? 1 - (yn - 0.85) * 0.25 : 1);
  const hw = (z, y) => { const t = (z - zs) / (zb - zs), yn = (y - KEEL) / (RAIL - KEEL); return B * lenP(Math.min(1, t / (0.9 + 0.1 * yn))) * secP(yn); };
  const NS = 30, Zs = []; for (let i = 0; i <= NS; i++) Zs.push(lerp(zs, zb, Math.pow(i / NS, 0.92)));
  const band = (ya, yb, col, o = {}) => { const P = [], ys = [ya, (ya + yb) / 2, yb];
    for (const sg of [1, -1]) for (let i = 0; i < NS; i++) for (let j = 0; j < 2; j++) {
      const za = Zs[i], zc = Zs[i + 1], y0 = ys[j], y1 = ys[j + 1], ins = o.inner ? -0.12 : 0;
      const a = [cx + sg * (hw(za, y0) + ins), y0, za], b = [cx + sg * (hw(zc, y0) + ins), y0, zc], c = [cx + sg * (hw(zc, y1) + ins), y1, zc], d = [cx + sg * (hw(za, y1) + ins), y1, za];
      if ((sg > 0) !== !!o.inner) P.push(...a, ...b, ...c, ...a, ...c, ...d); else P.push(...a, ...c, ...b, ...a, ...d, ...c); }
    H.tris(P, col, o); };
  const yC = WY + 0.55, yW0 = CURB + 0.42, yW1 = CURB + 0.95;
  band(KEEL, yC, '#5ec4a4'); band(yC, yW0, '#1b1a1d'); band(yW0, yW1, '#ece6d4'); band(yW1, RAIL, '#1b1a1d');
  band(DECK, RAIL, '#2a2628', { inner: true, ol: false });
  { const P = []; for (let i = 0; i < NS; i++) { const za = Zs[i], zc = Zs[i + 1], wa = hw(za, DECK) - 0.1, wc = hw(zc, DECK) - 0.1; P.push(cx - wa, DECK, za, cx + wa, DECK, za, cx + wc, DECK, zc, cx - wa, DECK, za, cx + wc, DECK, zc, cx - wc, DECK, zc); } H.tris(P, '#8a6c4a', { ol: false }); }
  for (let k = -4; k <= 4; k++) H.box(cx + k * 0.5 - 0.012, DECK + 0.005, zb + 1.2, cx + k * 0.5 + 0.012, DECK + 0.012, zs - 0.3, '#6a5034', { ol: false });
  { const P = [], ys = [KEEL + 0.4, yC, yW0, yW1, RAIL], cols = ['#5ec4a4', '#1b1a1d', '#ece6d4', '#f2eee2']; // the transom (stern face), white above the gunport band (light_1)
    for (let j = 0; j < 4; j++) { const a = hw(zs, ys[j]), b = hw(zs, ys[j + 1]); H.tris([cx - a, ys[j], zs, cx + a, ys[j], zs, cx + b, ys[j + 1], zs, cx - a, ys[j], zs, cx + b, ys[j + 1], zs, cx - b, ys[j + 1], zs], cols[j]); } void P; }
  H.box(cx - 2.1, RAIL - 0.02, zs - 0.06, cx + 2.1, RAIL + 0.55, zs + 0.06, '#f2eee2'); H.box(cx - 2.15, RAIL + 0.55, zs - 0.1, cx + 2.15, RAIL + 0.68, zs + 0.1, '#1b1a1d');
  for (let i = 0; i < 5; i++) H.box(cx - 1.6 + i * 0.8 - 0.18, yW1 + 0.2, zs + 0.02, cx - 1.6 + i * 0.8 + 0.18, yW1 + 0.6, zs + 0.07, '#20262c', { ol: false, emi: '#ffd690' });
  SG.at(cx, yW0 + 0.06, zs + 0.09, 0, 3.6, 0.42, (g, w, h) => sText(g, 'CONSTELLATION', w / 2, h * 0.55, w * 0.96, h * 0.8, SERIF, '#d8b04a', { weight: '700', stroke: '#3a2a0a', sw: h * 0.05, track: 2 }));
  // gunports: black squares in the white band along both sides (gun deck), + small ports in the black bulwark
  for (let z = -26.2; z < -11; z += 1.25) for (const sg of [1, -1]) { const y = (yW0 + yW1) / 2, w = hw(z, y);
    H.box(cx + sg * (w - 0.06), y - 0.2, z - 0.22, cx + sg * (w + 0.04), y + 0.2, z + 0.22, '#121214', { ol: false });
    if (Math.round(z * 4) % 2 === 0) { const y2 = RAIL - 0.36, w2 = hw(z, y2); H.box(cx + sg * (w2 - 0.05), y2 - 0.1, z - 0.13, cx + sg * (w2 + 0.04), y2 + 0.1, z + 0.13, '#e8e2d0', { ol: false }); } }
  // bow: gold scrollwork trail boards + figurehead, cutwater
  for (const sg of [1, -1]) { let prev = null; for (let i = 0; i <= 10; i++) { const z = lerp(zb + 3.2, zb + 0.15, i / 10), y = lerp(yW1 + 0.15, CURB + 1.35, i / 10), p = [cx + sg * (hw(z, y) + 0.04), y, z]; if (prev) H.seg(prev, p, 0.07, '#d4a840'); prev = p; }
    for (let i = 0; i < 4; i++) { const z = zb + 0.9 + i * 0.55, y = yW0 + 0.15 + i * 0.05; H.seg([cx + sg * (hw(z, y) + 0.04), y, z], [cx + sg * (hw(z + 0.4, y + 0.3) + 0.04), y + 0.3, z + 0.4], 0.05, '#d4a840'); } }
  H.seg([cx, KEEL + 0.6, zb + 1.2], [cx, CURB + 1.5, zb - 0.6], 0.12, '#1b1a1d', { ol: true }); H.seg([cx, CURB + 1.2, zb - 0.4], [cx, CURB + 1.75, zb - 1.0], 0.2, '#d4a840', { r1: 0.12, seg: 6 });
  // deck: the white awning amidships (ship_1), hatch, wheel, capstan
  H.prism('z', -24.2, -13.2, [[cx - 1.95, RAIL + 0.1], [cx + 1.95, RAIL + 0.1], [cx + 1.95, RAIL + 0.35], [cx, RAIL + 0.95], [cx - 1.95, RAIL + 0.35]], '#ecebe6');
  H.cyl(cx, DECK, -10.9, 0.3, 0.34, 0.7, 10, '#6a4a2a'); H.cyl(cx, DECK, -20.5, 0.35, 0.42, 0.6, 10, '#5a3a22');
  // masts: fore / main / mizzen (main tallest), lower masts pale, topmasts wood, fighting tops, crosstrees, black yards
  const MASTS = [[-23.4, 20.5], [-17.6, 23.5], [-12.4, 17.5]], tops = [];
  for (const [mz, mh] of MASTS) { const y = (k) => DECK + mh * k;
    H.cyl(cx, DECK, mz, 0.21, 0.27, mh * 0.43, 8, '#e2dccb'); H.cyl(cx, y(0.38), mz, 0.15, 0.17, mh * 0.36, 8, '#7a5634'); H.cyl(cx, y(0.7), mz, 0.07, 0.11, mh * 0.3, 6, '#7a5634');
    H.box(cx - 1.0, y(0.42), mz - 0.75, cx + 1.0, y(0.42) + 0.14, mz + 0.6, '#2a2220'); H.box(cx - 0.32, y(0.4), mz - 0.3, cx + 0.32, y(0.47), mz + 0.3, '#2a2220', { ol: false });
    H.box(cx - 0.6, y(0.72), mz - 0.1, cx + 0.6, y(0.72) + 0.08, mz + 0.1, '#2a2220', { ol: false }); H.box(cx - 0.08, y(0.72), mz - 0.35, cx + 0.08, y(0.72) + 0.08, mz + 0.35, '#2a2220', { ol: false });
    H.cyl(cx, DECK + mh, mz, 0.11, 0.08, 0.18, 8, '#2a2220', { ol: false });
    for (const [k, L, r] of [[0.33, 0.42, 0.13], [0.56, 0.33, 0.1], [0.79, 0.23, 0.075], [0.93, 0.15, 0.055]]) { const yy = y(k), hl = mh * L / 2;
      H.seg([cx - hl, yy, mz - 0.25], [cx, yy, mz - 0.25], r, '#191818', { r1: r * 0.55, seg: 6, ol: k < 0.5 }); H.seg([cx, yy, mz - 0.25], [cx + hl, yy, mz - 0.25], r * 0.55, '#191818', { r1: r, seg: 6, ol: k < 0.5 });
      H.seg([cx - hl * 0.92, yy - 0.12, mz - 0.18], [cx + hl * 0.92, yy - 0.12, mz - 0.18], r * 0.85, '#d6ccb2', { seg: 5 }); } // furled sail on the yard
    tops.push({ mz, mh, top: y(0.42), tm: y(0.72), head: DECK + mh }); }
  { const m = tops[2]; H.seg([cx, m.top - 1.2, m.mz + 0.3], [cx, m.top + 0.6, m.mz + 4.4], 0.1, '#191818'); H.seg([cx, DECK + 1.6, m.mz + 0.3], [cx, DECK + 1.75, zs + 2.4], 0.12, '#191818'); } // gaff + spanker boom
  // bowsprit + jib-boom (over the promenade, well above head height) + the dolphin striker
  const bsE = [cx, CURB + 4.0, zb - 4.0], jbE = [cx, CURB + 5.0, zb - 6.2];
  H.seg([cx, DECK + 0.2, zb + 2.2], bsE, 0.14, '#2a2220', { r1: 0.24, seg: 8, ol: true }); H.seg(bsE, jbE, 0.07, '#7a5634', { r1: 0.12, seg: 6 });
  H.seg([cx, CURB + 3.6, zb - 3.2], [cx, CURB + 2.2, zb - 3.0], 0.05, '#2a2220');
  // rigging: shrouds with ratlines (one canvas net, free quads), topmast shrouds, stays, backstays
  const net = (g, w, h) => { g.strokeStyle = '#141212'; g.lineWidth = Math.max(1.5, w * 0.03); const n = Math.max(4, Math.round(w / 9)); for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(w * (0.04 + 0.92 * i / n), h); g.lineTo(w * (0.04 + 0.92 * i / n), 0); g.stroke(); }
    g.lineWidth = Math.max(1, w * 0.015); for (let y = h - 5; y > 2; y -= Math.max(5, h / 46)) { g.beginPath(); g.moveTo(w * 0.04, y); g.lineTo(w * 0.96, y); g.stroke(); } };
  for (const m of tops) for (const sg of [1, -1]) {
    const wb = hw(m.mz, RAIL) + 0.32, A = [cx + sg * wb, RAIL - 0.3, m.mz - 1.5], Bq = [cx + sg * wb, RAIL - 0.3, m.mz + 1.4], C = [cx + sg * 0.85, m.top, m.mz + 0.4], D = [cx + sg * 0.85, m.top, m.mz - 0.55];
    SG.quad(A, Bq, C, D, 2.9, m.top - RAIL, net); H.box(cx + sg * (wb - 0.25), RAIL - 0.45, m.mz - 1.7, cx + sg * (wb + 0.05), RAIL - 0.3, m.mz + 1.6, '#1b1a1d', { ol: false }); // channel
    SG.quad([cx + sg * 0.95, m.top + 0.14, m.mz - 0.5], [cx + sg * 0.95, m.top + 0.14, m.mz + 0.45], [cx + sg * 0.25, m.tm, m.mz + 0.12], [cx + sg * 0.25, m.tm, m.mz - 0.12], 1.0, m.tm - m.top, net);
    H.seg([cx + sg * 0.5, m.tm + 0.08, m.mz], [cx + sg * 0.12, m.head - 0.4, m.mz], 0.025, '#141212');
    H.seg([cx + sg * 0.15, m.tm, m.mz], [cx + sg * (hw(m.mz + 3.5, RAIL) + 0.2), RAIL - 0.3, m.mz + 3.5], 0.03, '#141212'); H.seg([cx + sg * 0.1, m.head - 0.5, m.mz], [cx + sg * (hw(m.mz + 5, RAIL) + 0.2), RAIL - 0.3, m.mz + 5], 0.025, '#141212'); }
  const [fo, ma, mi] = tops, L = '#141212';
  H.seg([cx, fo.top, fo.mz], [cx, DECK + 0.4, zb + 1.2], 0.05, L); H.seg([cx, fo.tm, fo.mz], bsE, 0.04, L); H.seg([cx, fo.head - 0.5, fo.mz], jbE, 0.03, L); H.seg([cx, fo.tm - 1, fo.mz], jbE, 0.025, L);
  H.seg([cx, ma.top, ma.mz], [cx, DECK + 1.2, fo.mz + 0.6], 0.05, L); H.seg([cx, ma.tm, ma.mz], [cx, fo.top + 0.2, fo.mz], 0.04, L); H.seg([cx, ma.head - 0.5, ma.mz], [cx, fo.tm, fo.mz], 0.03, L);
  H.seg([cx, mi.top, mi.mz], [cx, DECK + 1.2, ma.mz + 0.6], 0.04, L); H.seg([cx, mi.tm, mi.mz], [cx, ma.top + 0.2, ma.mz], 0.035, L); H.seg([cx, mi.head - 0.4, mi.mz], [cx, ma.tm, ma.mz], 0.03, L);
  for (const sg of [1, -1]) H.seg(bsE, [cx + sg * 1.6, CURB + 1.4, zb + 0.6], 0.03, L); H.seg(jbE, [cx, CURB + 2.2, zb - 3.0], 0.025, L);
  // flags: the stern ensign on its staff, masthead pennants (green, Historic Ships), the jack at the bowsprit
  { const sx = cx, sz = zs - 0.15, top = RAIL + 3.0; H.seg([sx, RAIL, sz], [sx, top, sz + 0.25], 0.05, '#2a2220'); const W = 2.2, Hh = 1.25, z0 = sz + 0.3, y1 = top - 0.05;
    for (let i = 0; i < 13; i++) H.box(sx - 0.01, y1 - (i + 1) * Hh / 13, z0, sx + 0.01, y1 - i * Hh / 13, z0 + W, i % 2 ? '#f4f2ec' : '#b8283a', { ol: false });
    H.box(sx - 0.015, y1 - Hh * 7 / 13, z0, sx + 0.015, y1, z0 + W * 0.4, '#243a7a', { ol: false });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) H.box(sx - 0.02, y1 - 0.12 - r * Hh * 0.13 - 0.03, z0 + 0.1 + c * W * 0.07, sx + 0.02, y1 - 0.12 - r * Hh * 0.13 + 0.03, z0 + 0.15 + c * W * 0.07, '#ffffff', { ol: false }); }
  for (const m of [fo, ma, mi]) { const y = m.head - 0.3; H.prism('x', cx - 0.015, cx + 0.015, [[m.mz + 0.1, y], [m.mz + 0.1, y - 0.75], [m.mz + 1.5, y - 0.45]], '#2a7a4a', { ol: false }); }
  H.seg([cx, CURB + 3.1, zb - 2.4], [cx, CURB + 4.6, zb - 2.4], 0.03, '#2a2220'); H.box(cx - 0.015, CURB + 3.85, zb - 2.4, cx + 0.015, CURB + 4.55, zb - 1.3, '#243a7a', { ol: false });
  for (let i = 0; i < 6; i++) H.box(cx - 0.02, CURB + 4.0 + (i % 2) * 0.3, zb - 2.2 + Math.floor(i / 2) * 0.35, cx + 0.02, CURB + 4.06 + (i % 2) * 0.3, zb - 2.14 + Math.floor(i / 2) * 0.35, '#ffffff', { ol: false });
  // wooden pile dolphins in the water (con_2 / ship_1) with mooring lines to the hull, and the gangway to the pier
  for (const [x, z, toZ] of [[-26.4, -25.5, -24.5], [-26.4, -13.5, -14], [-31, -6.6, -9.6], [-26.8, -19.4, -19]]) {
    H.cyl(x, WY - 0.6, z, 0.32, 0.78, 2.9, 10, '#8a7a5c'); H.cyl(x, WY + 2.3, z, 0.2, 0.34, 0.25, 10, '#6a5a44'); for (const k of [0.3, 0.7]) H.cyl(x, WY - 0.6 + 2.9 * k, z, 0.74 - 0.42 * k + 0.02, 0.74 - 0.42 * k + 0.02, 0.1, 10, '#3a3430', { ol: false });
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; H.seg([x + Math.sin(a) * 0.78, WY - 0.55, z + Math.cos(a) * 0.78], [x + Math.sin(a) * 0.33, WY + 2.28, z + Math.cos(a) * 0.33], 0.02, '#5a4a38'); }
    const sg = x > cx ? 1 : 0; H.seg([x, WY + 2.0, z], sg ? [cx + hw(toZ, CURB + 1.2) + 0.05, CURB + 1.2, toZ] : [cx, yW1, zs + 0.05], 0.035, '#d8ccb0', { seg: 4 }); }
  { const za = -18.6, zb2 = -17.2, xa = -35, xb = cx - hw(-18, DECK) + 0.05, ya = CURB + 0.05, yb = DECK + 0.1, g = new THREE.BoxGeometry(Math.hypot(xb - xa, yb - ya), 0.1, zb2 - za);
    g.rotateZ(Math.atan2(yb - ya, xb - xa)); g.translate((xa + xb) / 2, (ya + yb) / 2, (za + zb2) / 2); H.geo(g, '#6a5034');
    for (const z of [za, zb2]) { H.seg([xa, ya + 1.0, z], [xb, yb + 1.0, z], 0.035, '#d8ccb0'); for (let t = 0; t <= 1.001; t += 0.5) H.seg([lerp(xa, xb, t), lerp(ya, yb, t), z], [lerp(xa, xb, t), lerp(ya, yb, t) + 1.0, z], 0.03, '#2a2220'); } }
});
