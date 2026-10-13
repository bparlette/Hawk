
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
  // a free quad from four world points (bottom-left, bottom-right, top-right, top-left); w x h metres sets the texture density only
  quad(A, B, C, D, w, h, draw) { this.items.push({ q: [A, B, C, D], w, h, draw }); return this; }
  build() {
    const W = 1024, pm = (it) => Math.min(W / it.w, 300 / it.h, 160); let cx = 0, cy = 0, rowH = 0;
    for (const it of this.items) { const k = pm(it); it.pw = Math.ceil(it.w * k); it.ph = Math.ceil(it.h * k); if (cx + it.pw > W) { cx = 0; cy += rowH + 4; rowH = 0; } it.px = cx; it.py = cy; cx += it.pw + 4; rowH = Math.max(rowH, it.ph); }
    const Hc = Math.min(2048, 1 << Math.ceil(Math.log2(Math.max(64, cy + rowH)))), c = document.createElement('canvas'); c.width = W; c.height = Hc; const g = c.getContext('2d');
    for (const it of this.items) { g.save(); g.beginPath(); g.rect(it.px, it.py, it.pw, it.ph); g.clip(); g.translate(it.px, it.py); it.draw(g, it.pw, it.ph); g.restore(); }
    const P = [], U = [];
    for (const it of this.items) {
      const u0q = it.px / W, u1q = (it.px + it.pw) / W, v1q = 1 - it.py / Hc, v0q = 1 - (it.py + it.ph) / Hc;
      if (it.q) { const [A, B, C, D] = it.q; P.push(...A, ...B, ...C, ...A, ...C, ...D); U.push(u0q, v0q, u1q, v0q, u1q, v1q, u0q, v0q, u1q, v1q, u0q, v1q); continue; } // free quad (bl, br, tr, tl)
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

// ======================= POWER PLANT COMPLEX, PIER 4 (refs/power-plant, Brad 2026-10-11 09:03): THREE joined buildings, not one.
// West: the PHILLIPS SEAFOOD building (flat roof, tall gridded windows, bracket frieze, attic, the red "Phillips" roof sign);
// centre: the POWER PLANT hall (taller, recessed balconied bay, BARNES & NOBLE / BOOKSELLERS, a stepped tower with the POWER PLANT plaque + 1900 / 2000,
// a slate pitched roof carrying the FOUR BLACK STACKS in a north-south row, the giant AMP HOUSE blade sign on the tower);
// east: the cafe building (lower eaves, stepped parapet + pediment, big round-arched windows, red-roofed entrance pavilion). HOMAGE (Brad 2026-10-12):
// the real trademark name, roundels, guitar and motto are replaced by an original procedural 'AMP HOUSE' cafe sign set (bolt badge, blade sign, TURN IT UP, HON marquee). Widths / heights are read off exterior_2 (x 0.0188 m/px, y 0.038 m/px, the city's 3x map compression)
const PPX = (px) => 44.8 + (px - 50) * 0.0188, PPY = (py) => CURB + (770 - py) * 0.038;
const PP = { phX0: PPX(50), phX1: PPX(440), pcX1: PPX(805), hrX1: PPX(1260), zN: -27, hrZN: -25.5, phZS: -9.5, pcZS: -8.8, hrZS: -9.3,
  phTop: PPY(470), pcTop: PPY(365), twX0: PPX(500), twX1: PPX(760), twTop: PPY(300), gbX0: PPX(568), gbX1: PPX(700), gbTop: PPY(255),
  hrEave: PPY(480), hrPar: PPY(445), hrStep: PPY(410), hrPeak: PPY(362), stX: 58.1, stZ: [-13.2, -16.6, -20, -23.4], stTop: CURB + 26.5, ridge: PPY(365) + 2.6 };
const ppFaces = (x0, z0, x1, z1, H) => ({ s: H.frame(x0, z1, x1, z1), e: H.frame(x1, z1, x1, z0), n: H.frame(x1, z0, x0, z0), w: H.frame(x0, z0, x0, z1) });
const ampBolt = (g, x, y, k, col, ink) => { g.save(); g.translate(x, y); g.scale(k, k); g.beginPath(); g.moveTo(0.18, -1); g.lineTo(-0.42, 0.12); g.lineTo(-0.02, 0.12); g.lineTo(-0.2, 1);
  g.lineTo(0.44, -0.18); g.lineTo(0.04, -0.18); g.closePath(); g.fillStyle = col; g.fill(); if (ink) { g.lineWidth = 0.08; g.strokeStyle = ink; g.stroke(); } g.restore(); };
// homage: original AMP HOUSE badge (rounded navy plate, gold rim, yellow bolt, block lettering) - no real trademark text or logo shape
const hrLogo = (g, w, h, o = {}) => { const m = Math.min(w, h), r = m * 0.16; g.save(); const rr = (x, y, ww, hh, q) => { g.beginPath(); g.moveTo(x + q, y); g.arcTo(x + ww, y, x + ww, y + hh, q); g.arcTo(x + ww, y + hh, x, y + hh, q); g.arcTo(x, y + hh, x, y, q); g.arcTo(x, y, x + ww, y, q); g.closePath(); };
  rr(w / 2 - m * 0.48, h / 2 - m * 0.48, m * 0.96, m * 0.96, r); g.fillStyle = '#d9a83a'; g.fill(); rr(w / 2 - m * 0.42, h / 2 - m * 0.42, m * 0.84, m * 0.84, r * 0.8); g.fillStyle = '#1e2a4a'; g.fill();
  ampBolt(g, w / 2, h / 2 - m * 0.1, m * 0.22, '#ffd23c', '#7a4a10');
  sText(g, 'AMP HOUSE', w / 2, h / 2 + m * 0.22, m * 0.76, m * 0.17, SANS, '#fff2c8', { weight: '900' }); sText(g, 'HARBOR CAFE', w / 2, h / 2 + m * 0.34, m * 0.6, m * 0.08, SANS, '#d9a83a', { weight: '700' }); g.restore(); };
lmHD('powerplant', 56, -17, 19, (H, signs, SG) => {
  const BR = '#a9502f', BR2 = '#8e3f25', BR3 = '#b45a38', CR = '#e2d3b2', Y0 = CURB, GLS = '#262c34', GRN = '#2f6a4a', SL = '#2e3036', P = PP;
  const pane = '#33404c', mull = '#e8e4da';
  // ---------- WEST: PHILLIPS building ----------
  { const x0 = P.phX0, x1 = P.phX1, z0 = P.zN, z1 = P.phZS, top = P.phTop, f = ppFaces(x0, z0, x1, z1, H);
    H.box(x0, Y0, z0, x1, top, z1, BR); H.box(x0 - 0.15, Y0, z0 - 0.15, x1 + 0.1, Y0 + 0.8, z1 + 0.15, '#6a5a50');
    H.box(x0, top - 0.02, z0, x1, top + 0.08, z1, '#4a4440', { ol: false });
    for (const k of ['s', 'w', 'n']) { const F = f[k];
      H.windows(F, 0.4, F.L - 0.4, Y0 + 0.9, PPY(675), { bw: 1.22, fh: PPY(675) - Y0 - 0.9, ww: 0.7, wh: 1.7, pane: GLS, lit: 0.7, head: CR, wy: 0.3 }); // ground floor
      H.windows(F, 0.4, F.L - 0.4, PPY(682), PPY(552), { bw: 1.22, fh: PPY(552) - PPY(682), ww: 0.9, wh: PPY(560) - PPY(675), pane, lit: 0.45, mull, sill: CR, wy: 0.3 }); // the tall gridded windows
      { const nb = Math.max(1, Math.round((F.L - 0.8) / 1.22)), bwr = (F.L - 0.8) / nb, y0 = PPY(682) + (PPY(552) - PPY(682) - (PPY(560) - PPY(675))) * 0.3, y1 = y0 + PPY(560) - PPY(675);
        for (let b = 0; b < nb; b++) { const uc = 0.4 + (b + 0.5) * bwr; for (const du of [-0.225, 0.225]) H.fbox(F, uc + du - 0.025, uc + du + 0.025, y0, y1, 0, 0.04, mull, { ol: false }); for (let y = y0 + 0.5; y < y1 - 0.1; y += 0.5) H.fbox(F, uc - 0.45, uc + 0.45, y, y + 0.05, 0, 0.04, mull, { ol: false }); } }
      H.pilasters(F, 0.4, F.L - 0.4, Y0 + 0.8, PPY(535), 1.22, 0.22, 0.14, BR2, { ol: false });
      H.band(F, -0.1, F.L + 0.1, PPY(682), PPY(676), 0.16, CR, { ol: false });
      for (let u = 0.4; u <= F.L - 0.3; u += 0.61) H.fbox(F, u - 0.09, u + 0.09, PPY(552), PPY(538), 0, 0.22, CR, { ol: false }); // frieze brackets
      H.band(F, -0.2, F.L + 0.2, PPY(538), PPY(518), 0.32, CR); // cornice
      H.windows(F, 0.4, F.L - 0.4, PPY(515), PPY(478), { bw: 1.22, fh: PPY(478) - PPY(515), ww: 0.5, wh: 0.7, pane: GLS, lit: 0.4, wy: 0.4 }); // attic
      H.band(F, -0.05, F.L + 0.05, top - 0.35, top + 0.25, 0.1, BR2); }
    for (const x of [x0 + 0.3, x1 - 0.5]) H.box(x - 0.3, top, z1 - 0.9, x + 0.5, PPY(455), z1, BR2); // end chimney piers on the harbour face
    H.box(x0 + 0.6, top, -21, x0 + 3.2, top + 1.6, -15, '#5a5a5e'); // rooftop plant room (refs: grey box behind the parapet)
    // the PHILLIPS roof sign: bold red script with a white edge on a red-painted frame standing on the roof (exterior_2)
    const sx = PPX(243), sz = z1 - 1.4; H.box(sx - 2.2, top, sz - 0.1, sx + 2.2, top + 0.25, sz + 0.1, '#8a1c18', { ol: false });
    for (const dx of [-1.8, -0.6, 0.6, 1.8]) H.box(sx + dx - 0.06, top, sz - 0.3, sx + dx + 0.06, top + 1.9, sz - 0.18, '#5a1410', { ol: false });
    SG.at(sx, top + 0.2, sz, 0, 4.4, 2.0, (g, w, h) => sText(g, 'Phillips', w / 2, h * 0.55, w * 0.97, h * 0.94, SCRIPT, '#e3221a', { weight: 'bold', slant: 0.1, stroke: '#fde8dc', sw: h * 0.06, glow: '#ff2a1a' }));
    // ground: Phillips Seafood entrance under a green half-dome canopy + red awnings along the promenade
    const F = f.s, cu = PPX(203) - x0; H.fbox(F, cu - 1.1, cu + 1.1, Y0 + 2.4, Y0 + 2.55, 0, 1.6, GRN, { ol: false });
    { const g = new THREE.CylinderGeometry(1.1, 1.1, 1.6, 10, 1, false, -Math.PI / 2, Math.PI); g.rotateX(-Math.PI / 2); g.rotateY(Math.PI); g.scale(1, 0.75, 1); g.translate(cu, Y0 + 2.55, 0.8); H.fgeo(F, g, GRN); }
    SG.add(F, cu, Y0 + 1.75, 2.1, 0.62, 1.62, (g, w, h) => { g.fillStyle = '#1c2630'; g.fillRect(0, 0, w, h); sText(g, 'Phillips', w / 2, h * 0.38, w * 0.8, h * 0.62, SCRIPT, '#e8261c', { slant: 0.1, stroke: '#fff', sw: h * 0.04 }); sText(g, 'SEAFOOD', w / 2, h * 0.82, w * 0.4, h * 0.22, SANS, '#fff', { track: 2 }); });
    H.fbox(F, 0.1, cu - 1.3, Y0 + 2.5, Y0 + 2.65, 0, 1.4, '#c0302a', { ol: false }); H.fbox(F, cu + 1.3, F.L - 0.2, Y0 + 2.5, Y0 + 2.65, 0, 1.0, '#c0302a', { ol: false });
    // the rope cargo net hung on the east end of the harbour face (exterior_2)
    for (let i = 0; i < 6; i++) H.fbox(F, F.L - 1.2 + i * 0.18, F.L - 1.16 + i * 0.18, PPY(670), PPY(545), 0, 0.08, '#6a5a44', { ol: false });
  }
  // ---------- CENTRE: the POWER PLANT hall ----------
  { const x0 = P.phX1, x1 = P.pcX1, z0 = P.zN, z1 = P.pcZS, top = P.pcTop, f = ppFaces(x0, z0, x1, z1, H);
    H.box(x0, Y0, z0, x1, top, z1 - 0.7, BR); H.box(x0 + 0.2, Y0, z1 - 0.8, x1 - 0.2, top, z1, BR); // the front projects a little
    // slate pitched roof with the white clerestory band, running north-south behind the tower (exterior_1)
    { const g = new THREE.BufferGeometry(), xm = (x0 + x1) / 2, yb = top + 0.9, yr = P.ridge, za = z0 + 0.3, zb = -12.4;
      const v = [[x0 + 0.2, yb, za], [x1 - 0.2, yb, za], [xm, yr, za], [x0 + 0.2, yb, zb], [x1 - 0.2, yb, zb], [xm, yr, zb]], Pp = [], t = (a, b, c) => Pp.push(...v[a], ...v[b], ...v[c]);
      t(0, 2, 1); t(3, 4, 5); t(0, 3, 5); t(0, 5, 2); t(1, 2, 5); t(1, 5, 4); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.computeVertexNormals(); H.geo(g, SL);
      H.box(x0 + 0.2, top, za, x1 - 0.2, yb, zb, '#e8e6de'); for (let z = za + 0.6; z < zb - 0.3; z += 0.9) H.box(x0 + 0.15, top + 0.2, z, x1 - 0.15, yb - 0.15, z + 0.4, '#3a3f48', { ol: false, emi: LMR() < 0.5 ? '#ffd690' : null }); }
    for (const k of ['w', 'e', 'n']) { const F = f[k]; if (k === 'w' || k === 'e') { /* side walls mostly hidden by the wings: upper storeys only */ }
      const y0w = k === 'n' ? Y0 + 1 : Math.max(P.phTop, P.hrPar) + 0.4;
      H.windows(F, 0.4, F.L - 0.4, y0w, top - 1.2, { bw: 1.3, fh: 2.2, ww: 0.6, wh: 1.4, arch: true, pane: GLS, lit: 0.45, head: CR });
      H.band(F, -0.2, F.L + 0.2, top - 1.1, top - 0.8, 0.3, CR); }
    const F = H.frame(x0 + 0.2, z1, x1 - 0.2, z1), L = F.L, u = (px) => PPX(px) - x0 - 0.2;
    // brick piers framing the recessed balconied centre bay (exterior_2: two tall piers, the bay between with railed balconies)
    for (const [a, b] of [[430, 446], [480, 498], [718, 735], [788, 805]]) H.fbox(F, u(a), u(b), Y0 + 0.9, PPY(398), 0, 0.35, BR3);
    H.fbox(F, u(498), u(718), Y0 + 3.1, PPY(470), -1.0, -0.95, '#3e4a56', { ol: false });
    for (let y = Y0 + 3.1; y < PPY(472); y += 2.05) { H.fbox(F, u(498), u(718), y, y + 0.22, -0.9, 0.05, '#7a3522', { ol: false }); // floor slab
      for (const ry of [0.62, 1.0]) H.fbox(F, u(498), u(718), y + ry, y + ry + 0.06, 0.02, 0.06, '#2a2a28', { ol: false }); // balcony rails
      for (let k = 0; k <= 12; k++) { const uu = u(498) + (u(718) - u(498)) * k / 12; H.fbox(F, uu - 0.02, uu + 0.02, y + 0.22, y + 1.0, 0.02, 0.05, '#2a2a28', { ol: false }); }
      for (let k = 0; k < 6; k++) { const uu = u(498) + (u(718) - u(498)) * (k + 0.5) / 6; H.fbox(F, uu - 0.3, uu + 0.3, y + 0.3, y + 1.8, -0.94, -0.92, '#5a6a78', { ol: false, emi: LMR() < 0.6 ? '#ffd690' : null }); } }
    for (const [a, b] of [[446, 480], [735, 788]]) { // the side bays: small windows with green awnings
      H.windows(F, u(a), u(b), Y0 + 3.1, PPY(470), { bw: u(b) - u(a), fh: 2.05, ww: 0.42, wh: 1.2, pane: GLS, lit: 0.45, sill: CR, awn: 1, awnC: GRN }); }
    H.band(F, -0.1, L + 0.1, PPY(470), PPY(462), 0.25, CR, { ol: false }); H.band(F, -0.2, L + 0.2, PPY(398), PPY(390), 0.45, CR); // cornice under the arched row
    H.windows(F, u(498), u(720), PPY(390), PPY(366), { bw: 0.52, fh: PPY(366) - PPY(390), ww: 0.3, wh: 0.55, arch: true, pane: GLS, lit: 0.55 });
    // BARNES&NOBLE / BOOKSELLERS: white serif capitals standing off the bay (exterior_2)
    SG.add(F, u(600), PPY(468), 4.4, 1.7, 0.5, (g, w, h) => { sText(g, 'BARNES&NOBLE', w / 2, h * 0.34, w * 0.98, h * 0.6, SERIF, '#fbfaf4', { weight: 'bold', stroke: '#2a2420', sw: h * 0.035 });
      sText(g, 'BOOKSELLERS', w / 2, h * 0.82, w * 0.6, h * 0.26, SERIF, '#fbfaf4', { weight: '600', stroke: '#2a2420', sw: h * 0.02, track: 3 }); });
    // ground: the green Barnes & Noble store canopy with its sign + glazed store front
    H.fbox(F, u(446), u(788), Y0 + 0.9, Y0 + 2.9, -0.2, -0.15, '#2a3a36', { ol: false, emi: '#ffe4a8' });
    H.fbox(F, u(515), u(690), Y0 + 2.4, Y0 + 2.6, 0, 1.4, GRN); H.fbox(F, u(515), u(690), Y0 + 2.6, Y0 + 3.15, 1.25, 1.4, GRN, { ol: false });
    SG.add(F, u(602), Y0 + 2.62, 3.1, 0.5, 1.43, (g, w, h) => { g.fillStyle = '#1f4a36'; g.fillRect(0, 0, w, h); sText(g, 'BARNES&NOBLE', w / 2, h * 0.36, w * 0.9, h * 0.48, SERIF, '#fff'); sText(g, 'BOOKSELLERS', w / 2, h * 0.8, w * 0.5, h * 0.22, SERIF, '#fff', { track: 2 }); });
    // the tower above the hall: POWER PLANT plaque, a balcony, arched windows; 1900 / 2000 corner plaques on the shoulders
    const tz0 = -12.6, tz1 = z1 - 0.1;
    H.box(P.twX0, top, tz0, P.twX1, P.twTop, tz1, BR); H.box(P.twX0 - 0.15, P.twTop - 0.3, tz0 - 0.15, P.twX1 + 0.15, P.twTop + 0.05, tz1 + 0.15, CR);
    for (const [xa, xb] of [[x0 + 0.2, x0 + 1.2], [x1 - 1.2, x1 - 0.2]]) { H.box(xa, top, tz1 - 1, xb, PPY(320), tz1, BR3); H.box(xa - 0.08, PPY(322), tz1 - 1.08, xb + 0.08, PPY(316), tz1 + 0.08, CR); }
    H.band(F, -0.25, L + 0.25, top - 0.25, top + 0.15, 0.4, CR);
    const T = H.frame(P.twX0, tz1, P.twX1, tz1), tu = (px) => PPX(px) - P.twX0;
    H.windows(T, tu(510), tu(745), top + 0.15, PPY(345), { bw: 0.6, fh: PPY(345) - top - 0.15, ww: 0.34, wh: 0.7, arch: true, pane: GLS, lit: 0.6, wy: 0.35 });
    H.fbox(T, tu(555), tu(660), top + 0.0, top + 0.1, 0, 0.5, '#3a3a38', { ol: false }); for (const ry of [0.25, 0.45]) H.fbox(T, tu(555), tu(660), top + ry, top + ry + 0.05, 0.45, 0.5, '#2a2a28', { ol: false }); // balcony
    SG.add(T, tu(612), PPY(347), 3.5, 1.0, 0.6, (g, w, h) => { g.fillStyle = '#2e2216'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8a050'; g.lineWidth = h * 0.07; g.strokeRect(h * 0.07, h * 0.07, w - h * 0.14, h - h * 0.14);
      sText(g, 'POWER PLANT', w / 2, h * 0.55, w * 0.88, h * 0.62, SERIF, '#e8c060', { stroke: '#6a4a18', sw: h * 0.035 }); });
    for (const [px, t] of [[472, '1900'], [763, '2000']]) SG.add(F, u(px), top + 0.35, 1.05, 0.7, 0.3, (g, w, h) => { g.fillStyle = '#2e2216'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8a050'; g.lineWidth = h * 0.08; g.strokeRect(2, 2, w - 4, h - 4); sText(g, t, w / 2, h * 0.54, w * 0.8, h * 0.56, SERIF, '#e8c060'); });
    { const T2 = H.frame(P.twX0, tz1, P.twX1, tz1); H.fbox(T2, tu(700), tu(740), PPY(368), PPY(338), 0, 0.02, GLS, { ol: false }); }
    // the stepped gable on top of the tower + the block the blade sign stands on
    { const xa = P.gbX0, xb = P.gbX1, xm = (xa + xb) / 2, ya = P.twTop, yb = PPY(282), za = tz0 + 0.6, zb = tz1 - 0.2;
      H.box(xa, ya, za, xb, yb, zb, BR); const g = new THREE.BufferGeometry(), v = [[xa, yb, zb], [xb, yb, zb], [xm, P.gbTop, zb], [xa, yb, za], [xb, yb, za], [xm, P.gbTop, za]], Pp = [], t = (a, b, c) => Pp.push(...v[a], ...v[b], ...v[c]);
      t(0, 1, 2); t(3, 5, 4); t(0, 2, 5); t(0, 5, 3); t(1, 4, 5); t(1, 5, 2); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.computeVertexNormals(); H.geo(g, '#5a5650');
      const G = H.frame(xa, zb, xb, zb); H.windows(G, 0.25, G.L - 0.25, ya + 0.15, yb - 0.1, { bw: 0.62, fh: yb - ya - 0.25, ww: 0.32, wh: 0.6, pane: GLS, lit: 0.6, sill: CR });
      H.box(xa - 0.12, yb, zb - 0.1, xb + 0.12, yb + 0.12, zb + 0.12, CR, { ol: false });
      H.box(xm - 0.6, P.gbTop - 0.6, za + 0.6, xm + 0.6, P.gbTop + 0.6, zb - 0.6, BR2); }
    // the FOUR BLACK STACKS, a north-south row on the roof ridge (exterior_1), each on a short base, banded, with a flared cap
    for (let si = 0; si < 4; si++) { const z = P.stZ[si], sx = P.stX - 0.5 + si * 0.35, b0 = P.ridge - 0.6, h = P.stTop - b0; // the row runs a touch north-east (exterior_1 / exterior_2 stagger)
      H.box(sx - 1.2, top + 0.9, z - 1.2, sx + 1.2, P.ridge + 0.2, z + 1.2, '#3a3532');
      H.cyl(sx, b0, z, 1.0, 1.08, h - 0.5, 16, '#1d1c1d'); H.cyl(sx, P.stTop - 0.6, z, 1.08, 1.02, 0.6, 16, '#2c2a2a'); H.box(sx - 0.12, P.stTop, z - 0.12, sx + 0.12, P.stTop + 0.22, z + 0.12, '#8a1a14', { ol: false, emi: '#ff2a1a' }); // aircraft warning light
      for (const k of [0.25, 0.55, 0.82]) H.cyl(sx, b0 + h * k, z, 1.08 - 0.06 * k, 1.08 - 0.06 * k, 0.18, 16, '#353233', { ol: false }); }
    lmColl({ x0: x0 + 0.2, x1: x1 - 0.2, z0: z1 - 0.8, z1 });
    // north (Pratt St) end: the real carved lettering of the original power company
    { const N = H.frame(x1, z0, x0, z0); SG.add(N, N.L / 2, top - 2.2, N.L * 0.9, 0.42, 0.06, (g, w, h) => sText(g, 'UNITED RAILWAYS & ELECTRIC COMPANY', w / 2, h / 2, w * 0.98, h * 0.8, SERIF, '#7a3a24', { weight: '600', stroke: '#c48a6a', sw: h * 0.03 })); }
  }
  // homage: the giant AMP HOUSE blade sign on the tower (replaces the real trademark guitar); double-sided cut-out, same footprint
  SG.at((P.gbX0 + P.gbX1) / 2, P.gbTop + 0.55, -10.2, 0, 3.5, PPY(28) - P.gbTop - 0.55, (g, w, h) => {
    const q = w * 0.18; g.beginPath(); g.moveTo(q, 0); g.lineTo(w - q, 0); g.quadraticCurveTo(w, 0, w, q); g.lineTo(w, h - q); g.quadraticCurveTo(w, h, w - q, h); g.lineTo(q, h); g.quadraticCurveTo(0, h, 0, h - q); g.lineTo(0, q); g.quadraticCurveTo(0, 0, q, 0); g.closePath();
    g.fillStyle = '#1e2a4a'; g.fill(); g.lineWidth = w * 0.07; g.strokeStyle = '#d9a83a'; g.stroke();
    g.fillStyle = '#ffd23c'; for (let y = h * 0.06; y < h * 0.95; y += h * 0.035) { g.beginPath(); g.arc(w * 0.12, y, w * 0.028, 0, TAU); g.arc(w * 0.88, y, w * 0.028, 0, TAU); g.fill(); } // marquee bulbs
    ['A', 'M', 'P'].forEach((c, i) => sText(g, c, w / 2, h * (0.12 + i * 0.13), w * 0.62, h * 0.11, SANS, '#ffd23c', { weight: '900', stroke: '#7a4a10', sw: w * 0.03 }));
    ampBolt(g, w / 2, h * 0.58, w * 0.3, '#ff7a2a', '#5a2a08');
    ['H', 'O', 'U', 'S', 'E'].forEach((c, i) => sText(g, c, w / 2, h * (0.72 + i * 0.05), w * 0.4, h * 0.045, SANS, '#fff2c8', { weight: '800' })); });
  // ---------- EAST: the cafe building (homage AMP HOUSE signage) ----------
  { const x0 = P.pcX1, x1 = P.hrX1, z0 = P.hrZN, z1 = P.hrZS, f = ppFaces(x0, z0, x1, z1, H), u = (px) => PPX(px) - x0;
    H.box(x0, Y0, z0, x1, P.hrEave, z1, BR); H.box(x0, Y0, z0, x1 + 0.12, Y0 + 0.8, z1 + 0.12, '#6a5a50');
    H.box(PPX(870), P.hrEave, z1 - 3, x1, P.hrPar, z1, BR); H.box(PPX(870), P.hrEave, z0, x1, P.hrPar - 0.6, z1 - 3, BR2); // parapet wall + the roof behind
    H.box(PPX(950), P.hrPar, z1 - 1.2, PPX(1120), P.hrStep, z1, BR); H.box(PPX(950) - 0.1, P.hrStep - 0.05, z1 - 1.3, PPX(1120) + 0.1, P.hrStep + 0.12, z1 + 0.1, CR);
    H.box(PPX(870) - 0.1, P.hrPar - 0.05, z1 - 3.1, x1 + 0.1, P.hrPar + 0.12, z1 + 0.1, CR); H.box(x0, P.hrEave - 0.05, z1 - 3.1, PPX(870), P.hrEave + 0.12, z1 + 0.1, CR);
    { const xa = PPX(955), xb = PPX(1060), xm = (xa + xb) / 2, g = new THREE.BufferGeometry(), za = z1 - 1.0, zb = z1, ya = P.hrStep, v = [[xa, ya, zb], [xb, ya, zb], [xm, P.hrPeak, zb], [xa, ya, za], [xb, ya, za], [xm, P.hrPeak, za]], Pp = [], t = (a, b, c) => Pp.push(...v[a], ...v[b], ...v[c]);
      t(0, 1, 2); t(3, 5, 4); t(0, 2, 5); t(0, 5, 3); t(1, 4, 5); t(1, 5, 2); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.computeVertexNormals(); H.geo(g, BR3);
      H.box(xm - 0.12, P.hrPeak - 0.2, za, xm + 0.12, P.hrPeak + 0.3, zb + 0.05, CR, { ol: false }); }
    const F = f.s;
    H.band(F, -0.1, F.L + 0.15, PPY(545), PPY(535), 0.2, CR, { ol: false }); H.band(F, -0.1, F.L + 0.15, PPY(690), PPY(684), 0.18, CR, { ol: false });
    for (const [a, b] of [[835, 878], [918, 955], [1085, 1127], [1175, 1222]]) { // the tall round-arched lower windows (white grids)
      const uc = (u(a) + u(b)) / 2, ww = u(b) - u(a), y0 = PPY(670), y1 = PPY(590);
      H.fbox(F, u(a), u(b), y0, y1, -0.05, 0.02, pane, { ol: false, emi: LMR() < 0.7 ? '#ffd28a' : null }); H.farch(F, uc, y1, ww / 2, -0.05, 0.02, pane, { ol: false }, 8);
      for (let k = 1; k < 3; k++) H.fbox(F, u(a) + ww * k / 3 - 0.03, u(a) + ww * k / 3 + 0.03, y0, y1 + ww * 0.4, 0, 0.04, mull, { ol: false });
      for (let y = y0 + 0.45; y < y1 + ww * 0.4; y += 0.45) H.fbox(F, u(a), u(b), y, y + 0.05, 0, 0.04, mull, { ol: false });
      H.farch(F, uc, y1, ww / 2 + 0.12, 0, 0.06, CR, { ol: false }, 8); H.fbox(F, u(a) - 0.1, u(b) + 0.1, y0 - 0.12, y0, 0, 0.14, CR, { ol: false }); }
    { const a = 982, b = 1055, y0 = PPY(675), y1 = PPY(578); H.fbox(F, u(a), u(b), y0, y1, -0.05, 0.02, '#2a2a30', { ol: false, emi: '#ffcf7a' }); // the big gridded entrance window
      for (let k = 1; k < 5; k++) H.fbox(F, u(a) + (u(b) - u(a)) * k / 5 - 0.03, u(a) + (u(b) - u(a)) * k / 5 + 0.03, y0, y1, 0, 0.04, '#5a3a2a', { ol: false });
      for (let y = y0 + 0.35; y < y1; y += 0.35) H.fbox(F, u(a), u(b), y, y + 0.05, 0, 0.04, '#5a3a2a', { ol: false }); }
    for (const [a, b, big] of [[915, 948, 0], [975, 1048, 1], [1075, 1113, 0]]) { const uc = (u(a) + u(b)) / 2, ww = u(b) - u(a), y0 = PPY(505), y1 = PPY(465) + (big ? 0.2 : 0); // upper arched windows in the gable
      H.fbox(F, u(a), u(b), y0, y1, -0.05, 0.02, pane, { ol: false, emi: LMR() < 0.6 ? '#ffd28a' : null }); H.farch(F, uc, y1, ww / 2, -0.05, 0.02, pane, { ol: false }, 8);
      H.farch(F, uc, y1, ww / 2 + 0.14, 0, 0.06, CR, { ol: false }, 8); for (let k = 1; k < (big ? 4 : 2) + 1; k++) H.fbox(F, u(a) + ww * k / ((big ? 4 : 2) + 1) - 0.03, u(a) + ww * k / ((big ? 4 : 2) + 1) + 0.03, y0, y1 + ww * 0.45, 0, 0.04, mull, { ol: false }); }
    H.pilasters(F, u(820), u(1250), Y0 + 0.8, P.hrEave - 0.3, 1.45, 0.26, 0.12, BR2, { ol: false });
    // homage roundels (bolt + AH), the AMP HOUSE badge + the TURN IT UP, HON marquee (replace the real trademark roundels/logo/motto)
    const hrc = (g, w, h) => { const R = w / 2 - 1; g.fillStyle = '#d9a83a'; g.beginPath(); g.arc(w / 2, h / 2, R, 0, TAU); g.fill(); g.fillStyle = '#1e2a4a'; g.beginPath(); g.arc(w / 2, h / 2, R * 0.82, 0, TAU); g.fill();
      ampBolt(g, w / 2, h * 0.42, R * 0.38, '#ffd23c'); sText(g, 'AH', w / 2, h * 0.75, R * 0.8, R * 0.34, SANS, '#fff2c8', { weight: '900' }); };
    SG.add(F, u(878), PPY(505), 1.0, 1.0, 0.12, hrc); SG.add(F, u(1148), PPY(478), 1.0, 1.0, 0.12, hrc);
    SG.add(F, u(1012), PPY(552), 2.3, 2.3, 0.16, (g, w, h) => hrLogo(g, w, h));
    SG.add(F, u(1015), PPY(580), 2.4, 0.6, 0.18, (g, w, h) => { g.fillStyle = '#fbf6ee'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.25); g.quadraticCurveTo(w / 2, -h * 0.25, w, h * 0.25); g.lineTo(w, h); g.fill();
      g.strokeStyle = '#d9a83a'; g.lineWidth = h * 0.06; g.stroke(); sText(g, 'TURN IT UP, HON', w / 2, h * 0.6, w * 0.9, h * 0.5, SANS, '#1e2a4a', { weight: '900' }); });
    // red-roofed entrance pavilion + red awnings + green window awnings
    { const xa = PPX(940), xb = PPX(1062), zb = z1 + 1.6, ya = Y0 + 2.6; for (const x of [xa + 0.1, xb - 0.1]) H.box(x - 0.08, Y0, zb - 0.1, x + 0.08, ya, zb + 0.06, '#3a2a22', { ol: false });
      const g = new THREE.CylinderGeometry(0.01, 1.0, 0.9, 4); g.rotateY(Math.PI / 4); g.scale((xb - xa) * 0.72, 1, 1.25); g.translate((xa + xb) / 2, ya + 0.45, z1 + 0.85); H.geo(g, '#b8302a');
      H.box(xa, ya - 0.2, z1, xb, ya, zb, '#8a2a24', { ol: false }); lmColl({ x0: xa, x1: xb, z0: z1, z1: zb }); }
    H.fbox(F, u(812), u(935), Y0 + 2.2, Y0 + 2.35, 0, 1.6, '#c0302a', { ol: false }); H.fbox(F, u(1068), u(1255), Y0 + 2.2, Y0 + 2.35, 0, 1.6, '#c0302a', { ol: false });
    for (const [a, b] of [[840, 875], [918, 955], [1085, 1125], [1180, 1225]]) H.fbox(F, u(a), u(b), PPY(700), PPY(686), 0.02, 0.45, GRN, { ol: false });
    // side + back: arched windows, eaves cornice
    for (const k of ['e', 'n']) { const G = f[k]; H.windows(G, 0.5, G.L - 0.5, Y0 + 1, P.hrEave - 1, { bw: 1.6, fh: (P.hrEave - Y0 - 2) / 2, ww: 0.8, wh: 2.6, arch: true, head: CR, pane: GLS, lit: 0.55, mull });
      H.band(G, -0.1, G.L + 0.1, P.hrEave - 0.4, P.hrEave, 0.3, CR); }
    for (const x of [x0 + 2, x1 - 1.5]) H.cyl(x, P.hrPar - 0.6, -18, 0.35, 0.35, 1.2, 8, '#8a8a84', { ol: false });
  }
});
