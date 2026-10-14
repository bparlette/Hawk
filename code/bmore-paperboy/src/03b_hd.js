// ===== copied from Toad City Baltimore src/03b_landmarks_hd.js @ hark/integration e1aaac3 (HD builder HB, sign atlas SA, sText, World Trade Center builder) =====

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

