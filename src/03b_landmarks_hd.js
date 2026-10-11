
// ---------------- HD landmarks (phase 3): procedural, ref-matched landmark models in the cel/ink style, with LOD ----------------
// Each HD landmark = one merged vertex-coloured toon mesh (one shared material, night window glow from an `emi` attribute) + one merged
// ink-outline hull (major forms only; windows and fine trim skip the hull so the lines stay clean). Near the camera the HD model shows;
// farther out the Phase-1 massing (captured per landmark by LMCAP in the city builder) shows instead. The swap is done per frame in
// scene.onBeforeRender from the camera position. Collision boxes stay the massing's.
const LM_MAT = (() => {
  const m = toonMat(); const pc = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => {
    pc(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 emi; varying vec3 vEmi;').replace('#include <fog_vertex>', '#include <fog_vertex>\nvEmi = emi;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEmi; uniform float uNight;')
      .replace('#include <opaque_fragment>', 'outgoingLight += vEmi * uNight;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'psxLM'; return m;
})();
const LMR = (() => { let s = 1234567; return (seed) => { if (seed !== undefined) s = seed; s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
class HB { // HD builder: non-indexed triangles with position / normal / colour / emissive; `ol` parts also go to the outline hull
  constructor() { this.P = []; this.N = []; this.C = []; this.E = []; this.oP = []; this.oN = []; }
  add(g, col, o = {}) {
    if (g.index) g = g.toNonIndexed(); if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, c = new THREE.Color(col), e = o.emi ? new THREE.Color(o.emi) : null, ol = o.ol !== false;
    for (let i = 0; i < p.count; i++) {
      this.P.push(p.getX(i), p.getY(i), p.getZ(i)); this.N.push(n.getX(i), n.getY(i), n.getZ(i)); this.C.push(c.r, c.g, c.b);
      if (e) this.E.push(e.r, e.g, e.b); else this.E.push(0, 0, 0);
      if (ol) { this.oP.push(p.getX(i), p.getY(i), p.getZ(i)); this.oN.push(n.getX(i), n.getY(i), n.getZ(i)); }
    }
    return this;
  }
  box(x0, y0, z0, x1, y1, z1, col, o) { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return this.add(g, col, o); }
  cyl(x, y0, z, rt, rb, h, seg, col, o = {}) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open); if (o.ry) g.rotateY(o.ry); g.translate(x, y0 + h / 2, z); return this.add(g, col, o); }
  geo(g, col, o) { return this.add(g, col, o); }
  // a wall frame: from (xa,za) to (xb,zb) with the outward normal on the right-hand side seen from outside (the faceOf convention)
  frame(xa, za, xb, zb) { const L = Math.hypot(xb - xa, zb - za), ux = (xb - xa) / L, uz = (zb - za) / L; return { xa, za, ux, uz, nx: -uz, nz: ux, L, ang: Math.atan2(-uz, ux) }; }
  // a box in wall space: u along the wall, y up, d outward from the wall plane
  fbox(F, u0, u1, y0, y1, d0, d1, col, o) {
    const g = new THREE.BoxGeometry(Math.max(0.01, u1 - u0), Math.max(0.01, y1 - y0), Math.max(0.01, d1 - d0)); g.translate((u0 + u1) / 2, (y0 + y1) / 2, (d0 + d1) / 2);
    return this.fgeo(F, g, col, o);
  }
  fgeo(F, g, col, o) { g.rotateY(F.ang); g.translate(F.xa, 0, F.za); return this.add(g, col, o); }
  // an arch head (half disc) in wall space centred at u, springing at y, radius r, from d0 to d1
  farch(F, u, y, r, d0, d1, col, o, seg = 8) {
    const g = new THREE.CylinderGeometry(r, r, d1 - d0, seg, 1, false, -Math.PI / 2, Math.PI); g.rotateX(-Math.PI / 2); g.translate(u, y, (d0 + d1) / 2);
    return this.fgeo(F, g, col, o);
  }
  // a window grid on a wall: bays of width bw from u0..u1, floors of height fh from y0..y1; each window = sill + dark pane (lit at night by chance)
  windows(F, u0, u1, y0, y1, o) {
    const bw = o.bw || 1.6, fh = o.fh || 3, ww = o.ww || bw * 0.55, wh = o.wh || fh * 0.55, nb = Math.max(1, Math.round((u1 - u0) / bw)), nf = Math.max(1, Math.round((y1 - y0) / fh));
    const bwr = (u1 - u0) / nb, fhr = (y1 - y0) / nf, lit = o.lit === undefined ? 0.5 : o.lit;
    for (let f = 0; f < nf; f++) for (let b = 0; b < nb; b++) {
      if (o.skip && o.skip(b, f, nb, nf)) continue;
      const uc = u0 + (b + 0.5) * bwr, yb = y0 + f * fhr + (fhr - wh) * (o.wy === undefined ? 0.45 : o.wy);
      const on = LMR() < lit, warm = LMR() < 0.8;
      const pc = o.pane ? (typeof o.pane === 'function' ? o.pane(b, f) : o.pane) : '#2b333d';
      this.fbox(F, uc - ww / 2, uc + ww / 2, yb, yb + wh, -0.05, o.pd || 0.02, pc, { ol: false, emi: on ? (warm ? '#ffcf7a' : '#bfd8ff') : null });
      if (o.arch) this.farch(F, uc, yb + wh, ww / 2, -0.05, o.pd || 0.02, pc, { ol: false, emi: on ? (warm ? '#ffcf7a' : '#bfd8ff') : null }, 6);
      if (o.sill) this.fbox(F, uc - ww / 2 - 0.08, uc + ww / 2 + 0.08, yb - 0.12, yb, 0, 0.14, o.sill, { ol: false });
      if (o.head) this.fbox(F, uc - ww / 2 - 0.06, uc + ww / 2 + 0.06, yb + wh + (o.arch ? ww / 2 : 0), yb + wh + (o.arch ? ww / 2 : 0) + 0.14, 0, 0.1, o.head, { ol: false });
      if (o.mull) this.fbox(F, uc - 0.035, uc + 0.035, yb, yb + wh, 0, 0.05, o.mull, { ol: false });
      if (o.awn && LMR() < o.awn) this.fbox(F, uc - ww / 2, uc + ww / 2, yb + wh * 0.62, yb + wh, 0.02, 0.07, o.awnC || '#4f74a8', { ol: false });
    }
  }
  // vertical pilasters (proud brick piers) every `every` m along a wall
  pilasters(F, u0, u1, y0, y1, every, w, d, col, o = {}) { const n = Math.max(1, Math.round((u1 - u0) / every)); for (let i = 0; i <= n; i++) { const u = u0 + (u1 - u0) * i / n; this.fbox(F, u - w / 2, u + w / 2, y0, y1, 0, d, col, o); } }
  band(F, u0, u1, y0, y1, d, col, o) { return this.fbox(F, u0, u1, y0, y1, 0, d, col, o); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3)); g.setAttribute('emi', new THREE.Float32BufferAttribute(this.E, 3)); g.computeBoundingSphere();
    const grp = new THREE.Group(), mesh = new THREE.Mesh(g, LM_MAT); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh);
    if (this.oP.length) {
      const h = new THREE.BufferGeometry(); h.setAttribute('position', new THREE.Float32BufferAttribute(this.oP, 3)); h.setAttribute('normal', new THREE.Float32BufferAttribute(this.oN, 3));
      addOdir(h); h.deleteAttribute('normal'); h.computeBoundingSphere();
      const hull = new THREE.Mesh(h, OUT_CITY); hull.visible = QUAL.hd; QUAL.outlines.push(hull); grp.add(hull); grp.userData.hull = hull;
    }
    grp.userData.tris = this.P.length / 9; return grp;
  }
}
// generic signs for the HD models reuse the city's decal atlas (one small decal mesh per landmark)
function hdSign(F, u, y, w, tr, hh = w / 4, d = 0.12) { const mb = new MB(), x0 = F.xa + F.ux * (u - w / 2) + F.nx * d, z0 = F.za + F.uz * (u - w / 2) + F.nz * d, x1 = F.xa + F.ux * (u + w / 2) + F.nx * d, z1 = F.za + F.uz * (u + w / 2) + F.nz * d; mb.wall(x0, z0, x1, z1, y, y + hh, tr, '#fff', [0.002, 0.002, 0.998, 0.998]); return mb; }

// extra colliders for HD parts that stand proud of the massing (the city's collider grid is already built, so add to it directly)
function lmColl(c) { COLL.push(c); const x0 = (c.r ? c.x - c.r : c.x0) - 1.5, x1 = (c.r ? c.x + c.r : c.x1) + 1.5, z0 = (c.r ? c.z - c.r : c.z0) - 1.5, z1 = (c.r ? c.z + c.r : c.z1) + 1.5;
  for (let i = Math.floor(x0 / 16); i <= Math.floor(x1 / 16); i++) for (let j = Math.floor(z0 / 16); j <= Math.floor(z1 / 16); j++) { const k = i + ',' + j; (COLLG.get(k) || COLLG.set(k, []).get(k)).push(c); } }

// ---------------- real signage (Brad's real-signage rule, 2026-10-11): every sign is drawn on canvas in code from the refs (no logo files).
// One canvas atlas per landmark (shelf-packed) -> one double-sided unlit mesh, so a landmark's signs cost one draw call; unlit = they read as lit at night.
class SA {
  constructor() { this.items = []; }
  // on a wall frame: centred at u, bottom at y, w x h metres, d out from the wall
  add(F, u, y, w, h, d, draw) { const x = F.xa + F.ux * u + F.nx * d, z = F.za + F.uz * u + F.nz * d; return this.at(x, y, z, F.ang, w, h, draw); }
  at(x, y, z, ry, w, h, draw) { this.items.push({ x, y, z, ry, w, h, draw }); return this; }
  build() {
    const W = 1024, pm = (it) => Math.min(W / it.w, 300 / it.h, 160); let cx = 0, cy = 0, rowH = 0;
    for (const it of this.items) { const k = pm(it); it.pw = Math.ceil(it.w * k); it.ph = Math.ceil(it.h * k); if (cx + it.pw > W) { cx = 0; cy += rowH + 4; rowH = 0; } it.px = cx; it.py = cy; cx += it.pw + 4; rowH = Math.max(rowH, it.ph); }
    const Hc = Math.min(2048, 1 << Math.ceil(Math.log2(Math.max(64, cy + rowH)))), c = document.createElement('canvas'); c.width = W; c.height = Hc; const g = c.getContext('2d');
    for (const it of this.items) { g.save(); g.beginPath(); g.rect(it.px, it.py, it.pw, it.ph); g.clip(); g.translate(it.px, it.py); it.draw(g, it.pw, it.ph); g.restore(); }
    const P = [], U = [];
    for (const it of this.items) {
      const cs = Math.cos(it.ry), sn = Math.sin(it.ry), hw = it.w / 2, pt = (a, b) => [it.x + a * cs, it.y + b, it.z - a * sn];
      const u0 = it.px / W, u1 = (it.px + it.pw) / W, v1 = 1 - it.py / Hc, v0 = 1 - (it.py + it.ph) / Hc;
      const A = pt(-hw, 0), B = pt(hw, 0), C = pt(hw, it.h), D = pt(-hw, it.h);
      P.push(...A, ...B, ...C, ...A, ...C, ...D); U.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: lowTex(c, 512), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: true }));
    m.renderOrder = 2; return m;
  }
}
const SCRIPT = '"Brush Script MT", "Segoe Script", "Snell Roundhand", "Apple Chancery", "URW Chancery L", "Z003", cursive';
const SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif', SANS = '"Helvetica Neue", Helvetica, Arial, "DejaVu Sans", sans-serif';
// text that fills a box: centred, shrunk to fit width, optional outline + glow
function sText(g, txt, x, y, maxW, px, font, fill, o = {}) {
  g.save(); g.font = `${o.weight || 'bold'} ${px}px ${font}`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
  if (o.slant) g.transform(1, 0, -o.slant, 1, o.slant * y, 0);
  const w = g.measureText(txt).width; if (w > maxW) { const k = maxW / w; g.translate(x, y); g.scale(k, 1); g.translate(-x, -y); }
  if (o.track) g.letterSpacing = o.track + 'px';
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = px * 0.25; }
  if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.sw || px * 0.12; g.strokeStyle = o.stroke; g.strokeText(txt, x, y); }
  g.fillStyle = fill; g.fillText(txt, x, y); g.restore();
}

const LMHD = { list: [], near: 125, force: Q.get('lmhd') }; // ?lmhd=near|far pins the LOD (previews / A-B checks)
function lmHD(id, cx, cz, r, build) {
  const cap = LM_CAPS[id]; const far = new THREE.Group();
  if (cap) { if (cap.cb.P.length) { const m = cap.cb.build(CITY_MAT); m.castShadow = true; m.receiveShadow = true; far.add(m); } if (cap.db.P.length) far.add(cap.db.build(DECAL_MAT)); }
  LMR(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483646 + 1);
  const hb = new HB(), signs = [], sa = new SA(); build(hb, signs, sa); const near = hb.build();
  for (const s of signs) near.add(s.build(DECAL_MAT)); if (sa.items.length) near.add(sa.build());
  scene.add(far, near); near.visible = false;
  const L = { id, cx, cz, r, far, near, tris: near.userData.tris, isNear: false }; LMHD.list.push(L); return L;
}
scene.onBeforeRender = (r, s, cam) => {
  for (const L of LMHD.list) {
    const d = Math.hypot(cam.position.x - L.cx, cam.position.z - L.cz) - L.r;
    const n = LMHD.force === 'near' ? true : LMHD.force === 'far' ? false : (L.isNear ? d < LMHD.near + 8 : d < LMHD.near);
    if (n !== L.isNear) { L.isNear = n; L.near.visible = n; L.far.visible = !n; }
  }
};

// ======================= DOMINO SUGARS (refs/domino-sugar): brick refinery blocks with rows of windows and cream string courses,
// a taller rear block, two cream smokestacks, white silos, a cream warehouse base on the water side, the rooftop sign lattice ==============
lmHD('domino', 82, 57, 16, (H) => {
  const BR = '#7c4330', BR2 = '#6a3626', BR3 = '#8a4d36', CR = '#e2d3b4', CR2 = '#cdbb98', Y0 = CURB, TOP = CURB + DOM_H;
  const win = { bw: 1.55, fh: 3.1, ww: 0.86, wh: 1.7, sill: CR, lit: 0.45, awn: 0.35, awnC: '#5a80b8', pane: '#2a2f38' };
  // main block 72..92 x 48..60, rear block 72..92 x 60..66 (a bit lower, then the tall tower section on the west end)
  H.box(72, Y0, 48, 92, TOP, 60, BR);
  H.box(72, Y0, 60, 92, TOP - 3, 66, BR2);
  H.box(72, Y0, 57, 79, TOP + 5, 66, BR3); // the tall tower block behind the sign (the refinery's taller rear section with the big stack)
  // the cream warehouse base along the water side and the west end (ground floor, loading doors)
  H.box(70.6, Y0, 47.2, 93.4, Y0 + 4.6, 66.4, CR2);
  for (const [xa, za, xb, zb] of [[93.4, 47.2, 70.6, 47.2], [93.4, 66.4, 93.4, 47.2], [70.6, 66.4, 93.4, 66.4], [70.6, 47.2, 70.6, 66.4]]) { // N E S W, outward on the right
    const F = H.frame(xa, za, xb, zb);
    for (let u = 1.5; u < F.L - 1.5; u += 3.2) { H.fbox(F, u - 0.9, u + 0.9, 0.16, 3.0, -0.05, 0.03, LMR() < 0.25 ? '#a83a2a' : '#4a4640', { ol: false }); H.fbox(F, u - 1.1, u + 1.1, 3.0, 3.25, 0, 0.12, '#8a7a60', { ol: false }); }
    H.band(F, 0, F.L, Y0 + 4.4, Y0 + 4.9, 0.25, CR);
  }
  // facades: north (harbour, under the sign), east, south, west - window grid, brick pilasters every 2 bays, cream string courses
  const faces = [[72, 48, 92, 48, TOP], [92, 48, 92, 60, TOP], [92, 60, 92, 66, TOP - 3], [92, 66, 79, 66, TOP - 3], [79, 66, 72, 66, TOP + 5], [72, 66, 72, 57, TOP + 5], [72, 57, 72, 48, TOP]];
  // faces are listed from outside with the outward normal on the right: build each as wall frame (xb,zb)->(xa,za) reversed when needed
  for (const [xa, za, xb, zb, top] of faces) {
    const F = H.frame(xb, zb, xa, za); // reverse so the normal points out (the footprint is walked clockwise in x-east / z-south)
    H.windows(F, 0.4, F.L - 0.4, Y0 + 5.2, top - 1.6, win);
    H.pilasters(F, 0, F.L, Y0 + 4.9, top - 0.6, 3.1, 0.34, 0.16, BR2, { ol: false });
    for (const y of [Y0 + 11.4, Y0 + 17.6]) H.band(F, 0, F.L, y, y + 0.22, 0.12, CR, { ol: false });
    H.band(F, -0.2, F.L + 0.2, top - 0.9, top - 0.55, 0.22, CR); // cornice
    H.band(F, -0.1, F.L + 0.1, top - 0.55, top + 0.6, 0.06, BR2); // parapet
  }
  // tall west tower: its own north + east faces above the main roof, darker brick, rooftop penthouse
  for (const F2 of [H.frame(79, 57, 72, 57), H.frame(79, 66, 79, 57)]) { // the tower's north + east faces above the lower roofs
    H.windows(F2, 0.4, F2.L - 0.4, TOP - 2.6, TOP + 3.6, { bw: 1.55, fh: 3.1, ww: 0.86, wh: 1.7, sill: CR, lit: 0.4 }); H.band(F2, -0.2, F2.L + 0.2, TOP + 4.1, TOP + 4.45, 0.22, CR); }
  H.box(73.5, TOP + 5, 59, 77.5, TOP + 8, 63, BR2); H.box(73.3, TOP + 8, 58.8, 77.7, TOP + 8.4, 63.2, CR);
  // two tall cream smokestacks behind (left one taller, as in the refinery refs) + dark caps
  for (const [x, z, h, rb] of [[74.5, 63.5, 44, 1.25], [86, 64.2, 35, 1.05]]) {
    H.cyl(x, TOP - 3, z, rb * 0.82, rb, h - (TOP - 3 - Y0), 14, '#ece4d2');
    H.cyl(x, Y0 + h - 1.2, z, rb * 0.9, rb * 0.9, 1.2, 14, '#3a3532');
    for (const k of [0.35, 0.6]) H.cyl(x, TOP - 3 + (h - TOP + 3) * k, z, rb * 0.96, rb * 0.96, 0.4, 14, '#d4c8b0', { ol: false });
  }
  // white concrete silos (four, a head house on top) at the south-west corner
  for (const [x, z] of [[74.5, 67.6], [77.5, 67.6], [74.5, 70.4], [77.5, 70.4]]) { H.cyl(x, Y0, z, 1.45, 1.45, 22, 16, '#e8e6e0'); H.cyl(x, Y0 + 22, z, 1.45, 1.2, 0.6, 16, '#cfcbc2', { ol: false }); }
  H.box(73.6, Y0 + 22, 66.8, 78.4, Y0 + 25, 71.2, '#d8d4ca');
  for (let y = Y0 + 2; y < Y0 + 21; y += 2.6) H.box(76.0 - 0.12, y, 66.1, 76.0 + 0.12, y + 0.08, 66.2, '#9a968c', { ol: false });
  // rooftop clutter: a water tank on legs, vents, a small boiler house
  H.cyl(89, TOP + 2.2, 63, 1.2, 1.2, 2.2, 12, '#6a5a48'); H.cyl(89, TOP + 4.4, 63, 0.05, 1.3, 0.8, 12, '#4a3e32');
  for (const [lx, lz] of [[88.2, 62.2], [89.8, 62.2], [88.2, 63.8], [89.8, 63.8]]) H.box(lx - 0.08, TOP - 3, lz - 0.08, lx + 0.08, TOP + 2.2, lz + 0.08, '#3a3532', { ol: false });
  H.box(84, TOP - 3, 61, 88, TOP - 0.5, 65, BR3); for (const x of [81, 83.5]) H.cyl(x, TOP, 58, 0.35, 0.35, 1.4, 8, '#8a8a84', { ol: false });
  // flag on the tower
  H.box(75.4, TOP + 8.4, 61, 75.5, TOP + 15, 61.1, '#d8d8d0', { ol: false });
  for (let i = 0; i < 7; i++) H.box(75.5, TOP + 13.2 + i * 0.26, 61.04, 77.9, TOP + 13.46 + i * 0.26, 61.06, i % 2 ? '#f2f0ea' : '#b8323a', { ol: false });
  H.box(75.5, TOP + 14.0, 61.03, 76.6, TOP + 15.0, 61.07, '#2a3a7a', { ol: false });
  // the sign's open steel lattice (the sign faces are the canvas planes in the night-FX block): verticals, three chords, X-bracing, back struts
  { const C = '#3a3532', y0 = TOP, zf = 50.05;
    for (let k = 0; k <= 8; k++) H.box(73 + k * 2.25 - 0.13, y0, zf - 0.13, 73 + k * 2.25 + 0.13, y0 + 13.2, zf + 0.13, C);
    for (const y of [1.6, 7.1, 12.6]) H.box(72.7, y0 + y - 0.13, zf - 0.13, 91.3, y0 + y + 0.13, zf + 0.13, C);
    for (let k = 0; k < 8; k++) for (const [ya, yb] of [[1.6, 7.1], [7.1, 12.6]]) for (const s of [1, -1]) {
      const xa = 73 + k * 2.25, xb = xa + 2.25, L = Math.hypot(2.25, yb - ya), g = new THREE.BoxGeometry(L, 0.1, 0.1); g.rotateZ(s * Math.atan2(yb - ya, 2.25)); g.translate((xa + xb) / 2, y0 + (ya + yb) / 2, zf + 0.12); H.geo(g, C, { ol: false }); }
    for (const x of [73, 79.75, 84.25, 91]) { const g = new THREE.BoxGeometry(0.2, 0.2, 6.2); g.rotateX(-0.95); g.translate(x, y0 + 2.6, zf + 2.2); H.geo(g, C, { ol: false }); }
    H.box(72.6, y0 - 0.1, zf - 0.6, 91.4, y0 + 0.2, zf + 3.4, '#4a4440', { ol: false }); } // catwalk
});

// ======================= WORLD TRADE CENTER (refs/world-trade-center): regular pentagon, tan precast; solid corner piers, horizontal ribbon windows
// between tan spandrels on every floor, a narrow pier mid-face, a solid tan crown band, recessed glass lobby on a granite base ==============
lmHD('wtc', -12, -22.5, 14, (H, signs, SG) => {
  const cx = -12, cz = -22.5, r = 6.6, h = 62, rot = 0.3, TAN = '#cfba92', TAN2 = '#b8a27c', GL = '#3b5f66', Y0 = CURB;
  const V = []; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + rot; V.push([cx + Math.sin(a) * r, cz + Math.cos(a) * r]); }
  const pent = (rad, y0, hh, col, o) => H.cyl(cx, y0, cz, rad, rad, hh, 5, col, Object.assign({ ry: rot }, o));
  pent(r + 0.5, Y0, 0.6, '#8a8278'); // granite plinth
  pent(r - 0.7, Y0 + 0.6, 4.4, '#28323c'); // recessed glass lobby
  pent(r - 0.32, Y0 + 5, h - 9, GL, { ol: false }); // the glass core behind the ribbons
  const FL = 2.15, n = Math.floor((h - 10) / FL);
  for (let f = 0; f <= n; f++) pent(r, Y0 + 5 + f * FL, 0.95, f % 4 === 0 ? TAN2 : TAN, { ol: f === 0 }); // tan spandrel per floor
  pent(r, Y0 + h - 4.4, 4.4, TAN); // solid crown band (mechanical floors)
  pent(r - 0.6, Y0 + h, 1.6, TAN2); pent(r - 0.35, Y0 + h + 1.6, 0.35, '#e0d2b4');
  for (let i = 0; i < 5; i++) {
    const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 5], mx = (ax + bx) / 2, mz = (az + bz) / 2;
    let F = H.frame(ax, az, bx, bz); if ((mx - cx) * F.nx + (mz - cz) * F.nz < 0) F = H.frame(bx, bz, ax, az); // outward normal
    // corner piers (solid tan, full height) and a narrow mid-face pier
    H.fbox(F, -0.2, 1.2, Y0 + 0.6, Y0 + h, -0.4, 0.18, TAN); H.fbox(F, F.L - 1.2, F.L + 0.2, Y0 + 0.6, Y0 + h, -0.4, 0.18, TAN);
    H.fbox(F, F.L / 2 - 0.22, F.L / 2 + 0.22, Y0 + 5, Y0 + h - 4.4, -0.3, 0.06, TAN2, { ol: false });
    // lobby columns
    for (let u = 1.8; u < F.L - 1.4; u += 1.5) H.fbox(F, u - 0.14, u + 0.14, Y0 + 0.6, Y0 + 5, -0.3, 0.3, '#9a9288', { ol: false });
    // ribbon glass: random lit segments at night + a few sky-reflection panes by day
    for (let f = 0; f < n; f++) { const y = Y0 + 5 + f * FL + 0.95; let u = 1.3;
      while (u < F.L - 1.3) { const w = 0.7 + LMR() * 1.6, u1 = Math.min(F.L - 1.3, u + w), on = LMR() < 0.42, sky = LMR() < 0.18;
        if (on || sky) H.fbox(F, u, u1, y + 0.02, y + FL - 0.97, -0.25, -0.2, sky ? '#7fa8bf' : GL, { ol: false, emi: on ? (LMR() < 0.75 ? '#ffd690' : '#c8dcff') : null }); u = u1 + 0.05; } }
  }
  // roof: mechanical box + antenna masts
  H.box(cx - 2, Y0 + h + 1.9, cz - 2, cx + 2, Y0 + h + 4.2, cz + 2, '#9a8e78'); H.cyl(cx + 1.2, Y0 + h + 4.2, cz, 0.08, 0.1, 6, 6, '#c8c8c0', { ol: false }); H.cyl(cx - 1.4, Y0 + h + 4.2, cz + 0.8, 0.06, 0.08, 3.5, 6, '#c8c8c0', { ol: false });
  // granite entrance wall with the (generic) name sign, facing the promenade
  { const F = H.frame(cx - 5, cz + r + 1.2, cx + 5, cz + r + 1.2); H.fbox(F, 0, 10, Y0, Y0 + 2.2, -0.6, 0, '#958b80'); // granite base wall (tower_3 ref)
    for (let u = 0.9; u < 10; u += 0.9) H.fbox(F, u - 0.012, u + 0.012, Y0, Y0 + 2.2, 0, 0.01, '#c8c0b4', { ol: false });
    SG.add(F, 5, Y0 + 1.15, 9.2, 0.62, 0.02, (g, w, h) => sText(g, 'THE WORLD TRADE CENTER \u00b7 BALTIMORE', w / 2, h / 2, w * 0.98, h * 0.82, SERIF, '#d6b25a', { weight: '500', stroke: '#6a5420', sw: h * 0.05 })); }
  // the flags of the world hanging in the glass lobby (tower_3 ref)
  for (let i = 0; i < 5; i++) { const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 5];
    for (let t = 0.2; t < 0.85; t += 0.13) { const x = lerp(ax, bx, t) * 0.82 + cx * 0.18, z = lerp(az, bz, t) * 0.82 + cz * 0.18, cl = ['#c8202a', '#1f3f9a', '#f2f2ee', '#1f8a3a', '#f0c020'][(i * 7 + Math.round(t * 20)) % 5];
      H.box(x - 0.25, Y0 + 2.2, z - 0.25, x + 0.25, Y0 + 4.4, z + 0.25, cl, { ol: false }); } }
});

// ======================= POWER PLANT (refs/power-plant): red-brick power station, cream stone bands + cornice, tall round-arched windows,
// corner towers, a stepped central gable tower carrying the FOUR BLACK smokestacks, the lower arched east wing with a gabled end ==============
lmHD('powerplant', 56, -17, 19, (H, signs, SG) => {
  const BR = '#a2482f', BR2 = '#8a3a26', CR = '#e6d9bc', Y0 = CURB, TOP = CURB + 15, GLS = '#262c34';
  H.box(47, Y0, -27, 65, TOP, -9, BR);
  H.box(46.8, Y0, -27.2, 65.2, Y0 + 1.1, -8.8, '#6a5a50'); // stone water table
  const faces = [[47, -9, 65, -9], [65, -9, 65, -27], [65, -27, 47, -27], [47, -27, 47, -9]]; // S (harbour), E, N, W - outward on the right
  for (const [xa, za, xb, zb] of faces) {
    const F = H.frame(xa, za, xb, zb);
    // ground-floor arcade of tall round-headed openings, upper storeys of paired windows, a row of small arched attic windows
    H.windows(F, 2.2, F.L - 2.2, Y0 + 1.1, Y0 + 6.6, { bw: 2.3, fh: 5.5, ww: 1.5, wh: 3.4, arch: true, head: CR, pane: GLS, lit: 0.75, wy: 0.2 });
    H.windows(F, 2.2, F.L - 2.2, Y0 + 6.6, Y0 + 10.6, { bw: 1.15, fh: 4.0, ww: 0.62, wh: 2.6, sill: CR, head: CR, pane: GLS, lit: 0.5, mull: '#d8ccb0' });
    H.windows(F, 2.2, F.L - 2.2, Y0 + 11.4, TOP - 1.2, { bw: 1.15, fh: 2.4, ww: 0.55, wh: 1.0, arch: true, pane: GLS, lit: 0.4, wy: 0.35 });
    H.pilasters(F, 2.2, F.L - 2.2, Y0 + 1.1, TOP - 0.8, 2.3, 0.3, 0.2, BR2, { ol: false });
    H.band(F, -0.2, F.L + 0.2, Y0 + 6.4, Y0 + 6.7, 0.18, CR, { ol: false }); H.band(F, -0.3, F.L + 0.3, Y0 + 10.5, Y0 + 11.4, 0.3, CR); // the cream stone band
    H.band(F, -0.4, F.L + 0.4, TOP - 0.7, TOP - 0.2, 0.42, CR); H.band(F, -0.25, F.L + 0.25, TOP - 0.2, TOP + 0.7, 0.12, BR2); // cornice + parapet
    for (let u = 1.2; u < F.L; u += 1.15) H.fbox(F, u - 0.18, u + 0.18, TOP - 1.0, TOP - 0.7, 0, 0.3, CR, { ol: false }); // corbel dentils
  }
  // corner towers: proud of the walls, a little taller, cream caps with small pyramids
  lmColl({ x0: 51.5, x1: 60.5, z0: -15.5, z1: -8.5 });
  for (const [x, z] of [[47, -27], [65, -27], [47, -9], [65, -9]]) {
    lmColl({ x0: x - 1.3, x1: x + 1.3, z0: z - 1.3, z1: z + 1.3 });
    H.box(x - 1.3, Y0, z - 1.3, x + 1.3, TOP + 2.2, z + 1.3, BR2); H.box(x - 1.5, TOP + 2.2, z - 1.5, x + 1.5, TOP + 2.7, z + 1.5, CR);
    const g = new THREE.CylinderGeometry(0.01, 1.45, 1.6, 4); g.rotateY(Math.PI / 4); g.translate(x, TOP + 3.5, z); H.geo(g, '#3f5a50');
    for (const [xa, za, xb, zb] of [[x - 1.3, z + 1.3, x + 1.3, z + 1.3], [x + 1.3, z - 1.3, x - 1.3, z - 1.3], [x + 1.3, z + 1.3, x + 1.3, z - 1.3], [x - 1.3, z - 1.3, x - 1.3, z + 1.3]]) {
      const F = H.frame(xa, za, xb, zb); H.windows(F, 0.6, 2.0, Y0 + 2, TOP + 1.6, { bw: 1.4, fh: 3.3, ww: 0.5, wh: 1.8, arch: true, pane: GLS, lit: 0.4 }); }
  }
  // stack base behind the roof (x 50..63) and the projecting central bay on the harbour face, rising above the cornice in a stepped gable (refs)
  H.box(50, TOP, -21, 63, TOP + 3, -16, BR2); H.box(49.85, TOP + 2.6, -21.15, 63.15, TOP + 3.1, -15.85, CR);
  H.box(51.5, Y0, -15.5, 60.5, TOP + 4.5, -8.5, BR);
  for (const [x0, x1, y0] of [[52.6, 59.4, TOP + 4.5], [53.8, 58.2, TOP + 6.3], [55, 57, TOP + 8.1]]) { H.box(x0, y0, -12.4, x1, y0 + 1.8, -8.5, BR); H.box(x0 - 0.2, y0 + 1.8, -12.6, x1 + 0.2, y0 + 2.15, -8.3, CR); }
  H.box(51.3, TOP + 4.1, -15.7, 60.7, TOP + 4.6, -8.3, CR);
  { const F = H.frame(51.5, -8.5, 60.5, -8.5);
    H.windows(F, 0.6, F.L - 0.6, Y0 + 11.6, TOP + 3.6, { bw: 1.5, fh: 2.8, ww: 0.8, wh: 1.9, arch: true, head: CR, pane: GLS, lit: 0.55 });
    H.windows(F, 0.6, F.L - 0.6, Y0 + 1.1, Y0 + 10.4, { bw: 3, fh: 9.3, ww: 2.0, wh: 7.6, pane: GLS, lit: 0.7, mull: '#d8ccb0', head: CR, wy: 0.3 }); // tall glazed bay
    H.pilasters(F, 0, F.L, Y0 + 1.1, TOP + 4.1, 3, 0.4, 0.22, BR2);
    H.band(F, -0.2, F.L + 0.2, Y0 + 10.5, Y0 + 11.4, 0.34, CR);
    const G = H.frame(53.8, -8.5, 58.2, -8.5); H.windows(G, 0.4, G.L - 0.4, TOP + 6.5, TOP + 8, { bw: 1.4, fh: 1.5, ww: 0.6, wh: 0.9, arch: true, pane: GLS, lit: 0.6 });
    // POWER PLANT: gold serif capitals on a dark plaque high on the bay, 1900 / 2000 date plaques either side (exterior_2 ref)
    SG.add(F, 4.5, TOP + 2.0, 7.4, 1.25, 0.3, (g, w, h) => { g.fillStyle = '#3a2a1c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8a050'; g.lineWidth = h * 0.06; g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
      sText(g, 'POWER PLANT', w / 2, h * 0.54, w * 0.9, h * 0.66, SERIF, '#e8c060', { stroke: '#6a4a18', sw: h * 0.04 }); });
    for (const [u, t] of [[0.2, '1900'], [8.8, '2000']]) SG.add(F, u, TOP + 2.2, 1.3, 0.8, 0.3, (g, w, h) => { g.fillStyle = '#3a2a1c'; g.fillRect(0, 0, w, h); sText(g, t, w / 2, h / 2, w * 0.86, h * 0.6, SERIF, '#e8c060'); });
    // BARNES&NOBLE / BOOKSELLERS: white condensed serif letters standing off the bay
    SG.add(F, 4.5, Y0 + 12.4, 8.6, 1.5, 0.45, (g, w, h) => { sText(g, 'BARNES&NOBLE', w / 2, h * 0.36, w * 0.98, h * 0.62, SERIF, '#fbfaf4', { stroke: '#2a2420', sw: h * 0.04 });
      sText(g, 'BOOKSELLERS', w / 2, h * 0.82, w * 0.5, h * 0.26, SERIF, '#fbfaf4', { weight: '600', stroke: '#2a2420', sw: h * 0.02 }); }); }
  for (const [xa, za, xb, zb] of [[60.5, -8.5, 60.5, -15.5], [51.5, -15.5, 51.5, -8.5]]) { const F = H.frame(xa, za, xb, zb); H.windows(F, 0.5, F.L - 0.5, TOP + 0.4, TOP + 4, { bw: 1.6, fh: 3.6, ww: 0.6, wh: 1.8, arch: true, pane: GLS, lit: 0.5 }); }
  // the four black stacks in a row (refs: tall, dark, slightly tapered, banded)
  for (const x of [52, 55, 58, 61]) {
    H.cyl(x, TOP + 3, -18, 1.0, 1.2, 37 - 3 - 15 + 0.4, 16, '#1d1b1a');
    H.cyl(x, Y0 + 36.2, -18, 1.12, 1.12, 0.7, 16, '#3a3532');
    for (const k of [0.3, 0.62]) H.cyl(x, TOP + 3 + 18.9 * k, -18, 1.16 - 0.1 * k, 1.16 - 0.1 * k, 0.35, 16, '#33302d', { ol: false });
  }
  // east wing (65..68.6 x -24..-12): lower brick hall with tall arched windows and a gabled end with a big round window
  H.box(65, Y0, -24, 68.6, Y0 + 9, -12, BR);
  { const F = H.frame(68.6, -12, 68.6, -24); H.windows(F, 0.8, F.L - 0.8, Y0 + 1, Y0 + 8, { bw: 2.4, fh: 7, ww: 1.4, wh: 4.4, arch: true, head: CR, pane: GLS, lit: 0.6, mull: '#d8ccb0', wy: 0.25 });
    H.band(F, -0.2, F.L + 0.2, Y0 + 8.4, Y0 + 9.0, 0.3, CR); }
  for (const z of [-12, -24]) { const s = z === -12 ? 1 : -1, F = s > 0 ? H.frame(65, -12, 68.6, -12) : H.frame(68.6, -24, 65, -24);
    H.windows(F, 0.3, F.L - 0.3, Y0 + 1, Y0 + 8, { bw: 3.6, fh: 7, ww: 1.6, wh: 4.2, arch: true, head: CR, pane: GLS, lit: 0.6, wy: 0.25 }); }
  { const g = new THREE.BufferGeometry(); // gabled roof of the east wing
    const p = [65, 9, -24, 68.6, 9, -24, 66.8, 11.4, -24, 65, 9, -12, 66.8, 11.4, -12, 68.6, 9, -12]; const P = []; const tri = (a, b, c) => P.push(...p.slice(a * 3, a * 3 + 3), ...p.slice(b * 3, b * 3 + 3), ...p.slice(c * 3, c * 3 + 3));
    tri(0, 2, 1); tri(3, 5, 4); tri(0, 3, 4); tri(0, 4, 2); tri(1, 2, 4); tri(1, 4, 5);
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.map((v, i) => (i % 3 === 1 ? v + Y0 : v)), 3)); g.computeVertexNormals(); H.geo(g, BR2); }
  // waterside awnings + generic sign on the harbour face
  { const F = H.frame(47, -9, 65, -9); for (const u of [2.6, 15.4]) H.fbox(F, u - 1.6, u + 1.6, Y0 + 3.4, Y0 + 3.6, 0, 1.4, '#a8302a', { ol: false }); // red awnings
    // Phillips: big red script with a white outline on the west block (exterior_2 ref), + the Phillips Seafood canopy sign at the door
    SG.add(F, 2.95, Y0 + 11.7, 3.1, 1.25, 1.45, (g, w, h) => sText(g, 'Phillips', w / 2, h * 0.55, w * 0.96, h * 0.9, SCRIPT, '#e0261c', { weight: 'bold', slant: 0.12, stroke: '#fff4ea', sw: h * 0.1, glow: '#ff3020' }));
    SG.add(F, 2.6, Y0 + 3.62, 3.2, 0.6, 1.42, (g, w, h) => { g.fillStyle = '#1f2a3a'; g.fillRect(0, 0, w, h); sText(g, 'Phillips', w * 0.36, h * 0.5, w * 0.5, h * 0.8, SCRIPT, '#e8302a', { slant: 0.1, stroke: '#fff', sw: h * 0.06 }); sText(g, 'SEAFOOD', w * 0.78, h * 0.52, w * 0.36, h * 0.38, SANS, '#fff'); });
    SG.add(F, 15.4, Y0 + 3.62, 3.2, 0.6, 1.42, (g, w, h) => { g.fillStyle = '#a8302a'; g.fillRect(0, 0, w, h); sText(g, 'HARD ROCK CAFE', w / 2, h * 0.52, w * 0.9, h * 0.5, SANS, '#ffd23a'); }); }
  // Hard Rock Cafe: round yellow/red logo medallion on the east wing's harbour end + small HRC roundels (exterior_2 ref)
  const hrLogo = (g, w, h) => { const R = Math.min(w, h) / 2 - 2; g.translate(w / 2, h / 2);
    g.fillStyle = '#f5c51e'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.lineWidth = R * 0.08; g.strokeStyle = '#7a1a10'; g.stroke();
    g.fillStyle = '#d82a1c'; g.beginPath(); g.arc(0, 0, R * 0.8, 0, TAU); g.fill();
    sText(g, 'Hard Rock', 0, -R * 0.12, R * 1.5, R * 0.5, SCRIPT, '#ffe8a0', { slant: 0.1, stroke: '#5a0e08', sw: R * 0.05 }); sText(g, 'CAFE', 0, R * 0.42, R * 1.0, R * 0.32, SANS, '#ffe8a0'); };
  { const F = H.frame(65, -12, 68.6, -12); SG.add(F, 1.8, Y0 + 9.4, 2.4, 2.4, 0.15, hrLogo); }
  for (const u of [3.4, 14.6]) SG.add(H.frame(47, -9, 65, -9), u, Y0 + 8.1, 1.1, 1.1, 0.2, (g, w, h) => { const R = w / 2 - 1; g.fillStyle = '#e6d9bc'; g.beginPath(); g.arc(w / 2, h / 2, R, 0, TAU); g.fill(); g.strokeStyle = '#7a3a26'; g.lineWidth = R * 0.12; g.stroke(); sText(g, 'HRC', w / 2, h / 2, R * 1.4, R * 0.7, SERIF, '#7a3a26'); });
  // the giant Hard Rock guitar standing on the roof in front of the stacks (a flat cut-out, drawn both sides) with the round logo across its body
  SG.at(56, TOP + 10.1, -10.6, 0, 4.6, 12.5, (g, w, h) => {
    const k = w / 46; g.save(); g.scale(k, k); // design space 46 x 125
    g.fillStyle = '#e8e2d0'; g.fillRect(20.5, 6, 5, 70); for (let y = 12; y < 74; y += 5) { g.fillStyle = '#9a927e'; g.fillRect(20.5, y, 5, 0.6); } // neck + frets
    g.fillStyle = '#d8304a'; g.beginPath(); g.moveTo(19, 0); g.lineTo(28, 0); g.lineTo(29, 9); g.lineTo(18, 9); g.closePath(); g.fill(); // headstock
    g.fillStyle = '#c8c0b0'; for (let i = 0; i < 3; i++) { g.fillRect(15.5, 1.5 + i * 2.6, 3, 1.4); g.fillRect(28.5, 1.5 + i * 2.6, 3, 1.4); }
    g.beginPath(); g.moveTo(23, 72); g.bezierCurveTo(5, 66, 2, 82, 6, 92); g.bezierCurveTo(10, 100, 0, 108, 6, 116); g.bezierCurveTo(12, 126, 34, 126, 40, 116);
    g.bezierCurveTo(46, 108, 36, 100, 40, 92); g.bezierCurveTo(44, 80, 40, 64, 30, 70); g.closePath(); g.fillStyle = '#e8365a'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = '#5a0e1a'; g.stroke();
    g.fillStyle = '#f4f0e6'; g.fillRect(14, 108, 18, 3); g.restore();
    g.save(); g.translate(0, 84 * k - w * 0.36); hrLogo(g, w, w * 0.72 * 1.0); g.restore(); });
});
