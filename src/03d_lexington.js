
// ======================= DOWNTOWN-WEST DISTRICT + SOUTH SHORE + HOOTERS (feature `lexington`, Brad 2026-10-12; DESIGN.md "New landmark", "Fit tweaks",
// "Lexington Market model reference", "Storefront: Hooters at Harborplace") ===========================================================================
// 1) LEXINGTON MARKET (HD, refs/lexington lex_1-5, reference only): the 2022 market hall seen from the street. One long wide gable with lower shed wings,
//    pale-gray standing-seam metal, white "LEXINGTON" / "M A R K E T" across the gable, "WORLD FAMOUS" left wing, "SINCE 1782" right wing, a tall black-framed
//    window wall with the round red globe seal, red-brick piers between big black storefront windows, the flat black entry canopy reading
//    "WORLD FAMOUS · LEXINGTON MARKET", planters + young trees. Night: warm uplight on the metal (emi bands + additive washes), glowing windows.
//    Placed on the north-west edge a block past Oriole Park (RES x -100..-76, z -70..-46), facing south onto Pratt St.
//    window.LEX_ANCHOR: the entrance under the canopy (Pit Beef Pete's eating contest hooks in here; another branch builds it).
// 2) WESTMINSTER BURYING GROUND (blockout-plus set dressing): the walled graveyard + the brick Gothic church with its tower, west of the market across
//    the street (RES x -134..-110). window.POE_ANCHOR: Poe's memorial inside the corner gate (the Poe stealth night, later).
// 3) RASH FIELD: a green field with two lacrosse goals on a waterfront plaza on the south shore between the Science Center and Federal Hill (PIERS 'rash').
//    window.RASH_ANCHOR: centre spot + goals + field box (Riptide Rodney's lacrosse, later).
// 4) HOOTERS on the OCTAGON at the south (harbour) end of Harborplace's Light Street Pavilion (refs/hooters, reference only): glass curtain wall,
//    deep dark-bronze canopy with a warm wood-slat soffit + LED strips, "SUITE 1445" over the doors, wood-panel side wall, sidewalk menu board with the owl,
//    bistro table; big orange HOOTERS channel letters (white halo, silver returns, ®) on BOTH the Light St face and the harbour face, lit at night.
//    All lettering + the owl are drawn procedurally on canvas (no logo files).
// Landmarks: 'lexington' (boss stub Pit Beef Pete at LEX_ANCHOR) and 'rashfield' (boss stub Riptide Rodney) join LANDMARKS so each new boss clears a district;
// Westminster + Hooters get name popups of their own (09l_lexington.js) without becoming crime districts.
const LEXW = { night: [] }; // additive night-glow meshes (opacity driven by NIGHT in 09l_lexington.js)
const lexGlowTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(255,214,150,0.95)'); gr.addColorStop(0.35, 'rgba(255,190,120,0.45)'); gr.addColorStop(1, 'rgba(255,170,100,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 128); const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = h; g.fillRect(0, 0, 64, 128); return lowTex(c, 64); })();
const lexHaloTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 32, 4, 64, 32, 62); gr.addColorStop(0, 'rgba(255,150,80,0.9)'); gr.addColorStop(0.45, 'rgba(255,110,50,0.45)'); gr.addColorStop(1, 'rgba(255,90,40,0)');
  g.setTransform(1, 0, 0, 0.5, 0, 16); g.fillStyle = gr; g.fillRect(0, -32, 128, 128); return lowTex(c, 64); })();
// a night-glow mesh from quads [{ x, y, z, ry, w, h, tex }] (all quads in one mesh share one texture)
function lexGlow(quads, tex, parent) {
  const P = [], U = [];
  for (const q of quads) { const cs = Math.cos(q.ry), sn = Math.sin(q.ry), hw = q.w / 2, pt = (a, b) => [q.x + a * cs, q.y + b, q.z - a * sn];
    const A = pt(-hw, 0), B = pt(hw, 0), C = pt(hw, q.h), D = pt(-hw, q.h); P.push(...A, ...B, ...C, ...A, ...C, ...D); U.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 }));
  m.renderOrder = 3; m.visible = false; parent.add(m); LEXW.night.push(m); return m;
}
// far LOD for landmarks that have no Phase-1 massing capture: a plain (hull-less) HB mesh
function lexFar(L, build) { const hb = new HB(); build(hb); const g = hb.build(); g.traverse((o) => { if (o.isMesh) o.castShadow = false; }); L.far.add(g); }
// simple young street tree (trunk + two low-poly crowns), into an HB
function lexTree(H, x, z, y0, s = 1) { H.cyl(x, y0, z, 0.07 * s, 0.1 * s, 2.2 * s, 5, '#5a4232', { ol: false });
  const c = new THREE.IcosahedronGeometry(0.95 * s, 0); c.translate(x, y0 + 2.7 * s, z); H.geo(c, '#5f8f3c'); const c2 = new THREE.IcosahedronGeometry(0.6 * s, 0); c2.translate(x + 0.35 * s, y0 + 3.3 * s, z - 0.2 * s); H.geo(c2, '#6f9f44', { ol: false }); }

// ======================= 1) LEXINGTON MARKET =======================
const LXM = { x0: -98.5, x1: -77.5, z0: -68, z1: -50, gx0: -93.5, gx1: -82.5, eave: CURB + 11, ridge: CURB + 14.6, weave: CURB + 9.0, wpeak: CURB + 10.2, base: CURB + 7.2 };
LXM.cx = (LXM.gx0 + LXM.gx1) / 2; // gable centre x (-88)
const LEX_DOOR = { x: -90.6, z: LXM.z1 }; // the main doors under the canopy (left of the window wall, like lex_1)
window.LEX_ANCHOR = { id: 'lexington', name: 'LEXINGTON MARKET', x: LEX_DOOR.x, z: LXM.z1 + 2.4, y: CURB, yaw: Math.PI, // stand here facing the doors (north)
  door: { x: LEX_DOOR.x, z: LXM.z1 }, canopy: { x0: LEX_DOOR.x - 3.6, x1: LEX_DOOR.x + 3.6, z0: LXM.z1, z1: LXM.z1 + 3.4 },
  hall: { x0: LXM.x0, x1: LXM.x1, z0: LXM.z0, z1: LXM.z1, floorY: CURB }, inside: { x: LXM.cx, z: (LXM.z0 + LXM.z1) / 2 },
  stalls: ['pit beef', 'lake trout', 'coddies', 'crab cakes', 'fudge-topped cookies'], note: 'hall is a closed shell (no interior yet): a set piece enters from the door' };
lmColl({ x0: LXM.x0, x1: LXM.x1, z0: LXM.z0, z1: LXM.z1 }); BLD.push({ x0: LXM.x0, x1: LXM.x1, z0: LXM.z0, z1: LXM.z1, h: LXM.eave });
for (const x of [LEX_DOOR.x - 3.4, LEX_DOOR.x + 3.4]) lmColl({ x, z: LXM.z1 + 3.2, r: 0.28 }); // canopy posts
LEXW.lexL = lmHD('lexington', -88, -58, 15, (H, signs, SG) => {
  const Y0 = CURB, { x0, x1, z0, z1, gx0, gx1, eave, ridge, weave, wpeak, base } = LXM, cx = LXM.cx;
  const MET = '#a9afb3', MET2 = '#959ca1', SEAM = '#c4c9cc', BR = '#8a4632', BR2 = '#74392a', BLK = '#1d1f22', GL = '#3b4e5c', CON = '#bdb6aa';
  const winE = () => (LMR() < 0.8 ? '#ffd28a' : '#ffe6b8');
  // ---- masses: brick base under everything, the main gable hall, the two shed wings
  H.box(x0, Y0, z0, x1, base, z1 - 0.05, BR);
  H.box(gx0, base, z0, gx1, eave, z1, MET);
  H.prism('z', z0 - 0.4, z1 + 0.35, [[gx0 - 0.45, eave - 0.25], [gx1 + 0.45, eave - 0.25], [cx, ridge]], '#8f969b'); // the gable roof (standing seam)
  for (const [a, b] of [[x0, gx0], [gx1, x1]]) { H.box(a, base, z0, b, weave, z1 - 0.05, MET2);
    const out = a === x0 ? a - 0.35 : b + 0.35, inn = a === x0 ? b : a; H.prism('z', z0 - 0.3, z1 + 0.3, [[out, weave], [inn, weave], [inn, wpeak]], '#8f969b'); }
  // roof seams (gable slopes + wings), ridge cap
  for (let i = 1; i < 14; i++) { const t = i / 14; for (const s of [-1, 1]) { const xa = cx + s * (gx1 - cx + 0.45) * (1 - t), ya = eave - 0.25 + (ridge - eave + 0.25) * t;
      H.seg([xa, ya + 0.04, z1 + 0.35], [xa, ya + 0.04, z0 - 0.4], 0.035, SEAM); } }
  H.box(cx - 0.18, ridge - 0.05, z0 - 0.4, cx + 0.18, ridge + 0.12, z1 + 0.35, '#7c8388');
  // ---- the south (street) facade
  const F = H.frame(x0, z1, x1, z1), u = (x) => x - x0; // u along the facade = x - x0
  // the gable front: metal panel (eave-high rectangle + triangle) proud of the wall, uplit in horizontal bands (warmest at the bottom)
  const bands = [[base, base + 1.3, '#6c5838'], [base + 1.3, base + 2.6, '#57472e'], [base + 2.6, eave, '#3e3322']];
  for (const [ya, yb, e] of bands) H.fbox(F, u(gx0) - 0.05, u(gx1) + 0.05, ya, yb, 0, 0.12, MET, { emi: e });
  H.tris([gx0 - 0.05, eave, z1 + 0.13, gx1 + 0.05, eave, z1 + 0.13, cx, ridge - 0.12, z1 + 0.13], MET, { emi: '#2a2318' });
  for (let x = gx0 + 0.45; x < gx1 - 0.2; x += 0.55) { const top = eave + (ridge - 0.15 - eave) * (1 - Math.abs(x - cx) / (cx - gx0 + 0.05)); H.fbox(F, u(x) - 0.03, u(x) + 0.03, base + 0.05, top, 0.12, 0.19, SEAM, { ol: false, emi: '#3a3022' }); }
  H.fbox(F, u(gx0) - 0.5, u(gx1) + 0.5, eave - 0.32, eave - 0.18, 0, 0.42, '#d8dcdf', { emi: '#5a4a32' }); // white eave line under the rake
  for (const s of [-1, 1]) { const a = [cx, ridge + 0.05, z1 + 0.36], b = [s < 0 ? gx0 - 0.5 : gx1 + 0.5, eave - 0.3, z1 + 0.36]; H.seg(a, b, 0.09, '#d8dcdf', { emi: '#4a3e2a' }); } // rake trim
  // the tall central window wall (black frames), from the doors' head up to the lettering band
  const wwx0 = gx0 + 1.0, wwx1 = gx1 - 1.2, wwy0 = Y0 + 0.1, wwy1 = base - 0.25;
  H.fbox(F, u(wwx0) - 0.25, u(wwx1) + 0.25, wwy0, wwy1 + 0.25, 0, 0.1, BLK);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const xa = lerp(wwx0, wwx1, c / 6) + 0.08, xb = lerp(wwx0, wwx1, (c + 1) / 6) - 0.08, ya = lerp(wwy0, wwy1, r / 4) + 0.1, yb = lerp(wwy0, wwy1, (r + 1) / 4) - 0.08;
    if (r === 0 && xb < LEX_DOOR.x + 1.6 && xa > LEX_DOOR.x - 1.6) continue; // the doors go here
    H.fbox(F, u(xa), u(xb), ya, yb, 0.1, 0.13, GL, { ol: false, emi: LMR() < 0.85 ? winE() : null }); }
  // doors (glass, bronze frames) + the dark recess behind them
  for (const [a, b] of [[-1.5, -0.05], [0.05, 1.5]]) { H.fbox(F, u(LEX_DOOR.x + a), u(LEX_DOOR.x + b), Y0 + 0.05, Y0 + 2.6, 0.08, 0.14, '#2c3a40', { ol: false, emi: '#ffcf8a' }); H.fbox(F, u(LEX_DOOR.x + (a + b) / 2) - 0.03, u(LEX_DOOR.x + (a + b) / 2) + 0.03, Y0 + 1.1, Y0 + 1.5, 0.14, 0.2, '#b08a50', { ol: false }); }
  // wings: brick piers between big black-framed storefront windows (two tiers), the metal band above
  for (const [a, b] of [[x0, gx0], [gx1, x1]]) { const n = 2, w = (b - a) / n;
    for (let i = 0; i < n; i++) { const xa = a + i * w + 0.45, xb = a + (i + 1) * w - 0.45;
      for (const [ya, yb] of [[Y0 + 0.15, Y0 + 3.1], [Y0 + 3.6, base - 0.4]]) { H.fbox(F, u(xa) - 0.12, u(xb) + 0.12, ya - 0.12, yb + 0.12, 0, 0.06, BLK, { ol: false });
        H.fbox(F, u(xa), u(xb), ya, yb, 0.06, 0.09, GL, { ol: false, emi: LMR() < 0.8 ? winE() : null }); H.fbox(F, u((xa + xb) / 2) - 0.04, u((xa + xb) / 2) + 0.04, ya, yb, 0.09, 0.12, BLK, { ol: false }); } }
    H.pilasters(F, u(a), u(b), Y0, base, w, 0.5, 0.22, BR2); }
  H.pilasters(F, u(gx0), u(gx1), Y0, base, (gx1 - gx0), 0.7, 0.26, BR2); // the brick piers framing the window wall
  H.fbox(F, 0, F.L, base - 0.12, base + 0.12, 0, 0.18, '#5e5a55'); // coping between brick + metal
  for (const [a, b] of [[x0, gx0], [gx1, x1]]) { H.fbox(F, u(a), u(b), base + 0.12, weave, 0, 0.08, MET2, { emi: '#4a3d2a' });
    for (let x = a + 0.4; x < b - 0.2; x += 0.55) H.fbox(F, u(x) - 0.03, u(x) + 0.03, base + 0.12, weave - 0.05, 0.08, 0.14, SEAM, { ol: false, emi: '#2a2318' }); }
  // ---- the flat black entry canopy over the doors (posts, fascia, warm downlights)
  const cz1 = z1 + 3.4, cy = Y0 + 3.3;
  H.box(LEX_DOOR.x - 3.7, cy, z1, LEX_DOOR.x + 3.7, cy + 0.42, cz1, BLK);
  H.box(LEX_DOOR.x - 3.5, cy - 0.04, z1 + 0.2, LEX_DOOR.x + 3.5, cy, cz1 - 0.2, '#3a3026', { ol: false, emi: '#ffcf8a' });
  for (const x of [LEX_DOOR.x - 3.4, LEX_DOOR.x + 3.4]) H.box(x - 0.14, Y0, cz1 - 0.34, x + 0.14, cy, cz1 - 0.06, BLK);
  // ---- side + back walls: brick with window rows, metal band above (outward normal on the right)
  for (const [xa, za, xb, zb, top] of [[x1, z1, x1, z0, weave], [x1, z0, x0, z0, weave], [x0, z0, x0, z1, weave]]) {
    const S = H.frame(xa, za, xb, zb); H.windows(S, 0.6, S.L - 0.6, Y0 + 0.4, base - 0.3, { bw: 2.4, fh: 3.3, ww: 1.6, wh: 2.0, pane: GL, lit: 0.55, sill: '#5e5a55' });
    H.pilasters(S, 0, S.L, Y0, base, 4.8, 0.4, 0.14, BR2, { ol: false }); H.fbox(S, 0, S.L, base - 0.1, base + 0.1, 0, 0.14, '#5e5a55', { ol: false }); }
  { const S = H.frame(gx1, z0, gx0, z0); H.fbox(S, 0, S.L, weave, eave, 0, 0.05, MET2); }
  // ---- rooftop units on the wings
  for (const x of [x0 + 2.4, x1 - 2.4]) H.box(x - 1, wpeak - 0.6, z0 + 4, x + 1, wpeak + 0.5, z0 + 6.5, '#8a8e90');
  // ---- forecourt: concrete planters with young trees, benches; sidewalk pavers
  for (const [xa, xb] of [[x0 + 0.3, LEX_DOOR.x - 4.2], [LEX_DOOR.x + 4.2, gx1 - 0.5], [gx1 + 0.6, x1 - 1.6]]) {
    if (xb - xa < 1.5) continue; const zp0 = z1 + 1.0, zp1 = z1 + 2.2;
    H.box(xa, Y0, zp0, xb, Y0 + 0.62, zp1, CON); H.box(xa + 0.12, Y0 + 0.5, zp0 + 0.12, xb - 0.12, Y0 + 0.64, zp1 - 0.12, '#4a5a32', { ol: false });
    for (let x = xa + 0.9; x < xb - 0.5; x += 3.6) lexTree(H, x, (zp0 + zp1) / 2, Y0 + 0.62, 0.9);
    lmColl({ x0: xa, x1: xb, z0: zp0, z1: zp1 }); }
  // ---- signs (one canvas atlas): LEXINGTON / M A R K E T, WORLD FAMOUS, SINCE 1782, the red globe seal, the canopy fascia
  const W = '#f4f5f2';
  SG.add(F, u(cx), base + 1.85, gx1 - gx0 - 0.6, 1.45, 0.21, (g, w, h) => sText(g, 'LEXINGTON', w / 2, h * 0.53, w * 0.98, h * 0.92, SANS, W, { weight: '700', track: Math.round(h * 0.12) }));
  SG.add(F, u(cx), base + 1.0, 5.2, 0.62, 0.21, (g, w, h) => sText(g, 'M A R K E T', w / 2, h * 0.53, w * 0.98, h * 0.9, SANS, W, { weight: '700' }));
  SG.add(F, u((x0 + gx0) / 2), base + 0.3, 3.4, 1.2, 0.16, (g, w, h) => { sText(g, 'WORLD', w / 2, h * 0.27, w * 0.9, h * 0.42, SANS, W, { weight: '700' }); sText(g, 'FAMOUS', w / 2, h * 0.75, w * 0.95, h * 0.42, SANS, W, { weight: '700' }); });
  SG.add(F, u((gx1 + x1) / 2), base + 0.3, 3.0, 1.2, 0.16, (g, w, h) => { sText(g, 'SINCE', w / 2, h * 0.27, w * 0.8, h * 0.42, SANS, W, { weight: '700' }); sText(g, '1782', w / 2, h * 0.75, w * 0.85, h * 0.44, SANS, W, { weight: '700' }); });
  SG.add(F, u(wwx0 + 0.9), Y0 + 3.85, 1.55, 1.55, 0.2, (g, w, h) => { const r = Math.min(w, h) / 2 - 2; g.translate(w / 2, h / 2); // the round red globe seal (drawn, not the real mark)
    g.fillStyle = '#b8282c'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.strokeStyle = '#f2e6d8'; g.lineWidth = r * 0.06; g.beginPath(); g.arc(0, 0, r * 0.9, 0, TAU); g.stroke();
    g.lineWidth = r * 0.035; g.beginPath(); g.arc(0, 0, r * 0.62, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(0, 0, r * 0.3, r * 0.62, 0, 0, TAU); g.stroke();
    for (const k of [-0.35, 0, 0.35]) { g.beginPath(); g.moveTo(-Math.sqrt(1 - k * k) * r * 0.62, k * r * 0.62); g.lineTo(Math.sqrt(1 - k * k) * r * 0.62, k * r * 0.62); g.stroke(); }
    g.beginPath(); g.moveTo(0, -r * 0.62); g.lineTo(0, r * 0.62); g.stroke();
    g.save(); g.font = `bold ${Math.round(r * 0.17)}px ${SANS}`; g.fillStyle = '#f2e6d8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = 'LEXINGTON MARKET \u2022 1782 \u2022 '; for (let i = 0; i < txt.length; i++) { const a = -Math.PI / 2 + (i - txt.length / 2) / txt.length * TAU; g.save(); g.rotate(a + Math.PI / 2); g.fillText(txt[i], 0, -r * 0.76); g.restore(); }
    g.restore(); });
  SG.at(LEX_DOOR.x, cy + 0.02, cz1 + 0.012, 0, 7.2, 0.38, (g, w, h) => { g.fillStyle = '#16171a'; g.fillRect(0, 0, w, h); sText(g, 'WORLD FAMOUS  \u00b7  LEXINGTON MARKET', w / 2, h * 0.55, w * 0.9, h * 0.62, SANS, '#f4f2ea', { weight: '700', track: 2 }); });
  // stall boards in the window wall (original stall signs, no real stall names)
  const stalls = [['PIT BEEF', '#c0392b'], ['LAKE TROUT', '#2c6e8f'], ['CODDIES', '#c9892a'], ['CRAB CAKES', '#b5502a'], ['COOKIES', '#6a4a2a']];
  stalls.forEach(([t, c], i) => SG.add(F, u(lerp(wwx0 + 1.4, wwx1 - 0.4, i / 4)), Y0 + 2.75, 1.25, 0.34, 0.14, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); sText(g, t, w / 2, h * 0.55, w * 0.88, h * 0.62, SANS, '#fff6e0', { weight: '800' }); }));
}, null);
// night uplight washes on the gable + wings, and a warm pool under the canopy
lexGlow([{ x: LXM.cx, y: LXM.base - 0.4, z: LXM.z1 + 0.3, ry: 0, w: 11.8, h: 6.2 }, { x: (LXM.x0 + LXM.gx0) / 2, y: LXM.base - 1.2, z: LXM.z1 + 0.25, ry: 0, w: 5.6, h: 3.4 },
  { x: (LXM.gx1 + LXM.x1) / 2, y: LXM.base - 1.2, z: LXM.z1 + 0.25, ry: 0, w: 5.6, h: 3.4 }, { x: LEX_DOOR.x, y: CURB + 0.1, z: LXM.z1 + 3.5, ry: 0, w: 7.2, h: 3.0 }], lexGlowTex, LEXW.lexL.near);
lexFar(LEXW.lexL, (H) => { const { x0, x1, z0, z1, gx0, gx1, eave, ridge, weave, wpeak, base } = LXM, cx = LXM.cx;
  H.box(x0, CURB, z0, x1, base, z1, '#8a4632', { ol: false }); H.box(gx0, base, z0, gx1, eave, z1, '#a9afb3', { ol: false, emi: '#4a3d2a' }); H.prism('z', z0, z1, [[gx0, eave], [gx1, eave], [cx, ridge]], '#8f969b', { ol: false });
  for (const [a, b] of [[x0, gx0], [gx1, x1]]) H.box(a, base, z0, b, weave, z1, '#959ca1', { ol: false }); H.box(gx0 + 1, CURB, z1, gx1 - 1.2, base + 0.9, z1 + 0.05, '#1d1f22', { ol: false, emi: '#c09060' }); });
landmark('lexington', 'LEXINGTON MARKET', -88, -55, 15, { name: 'Pit Beef Pete', x: window.LEX_ANCHOR.x, z: window.LEX_ANCHOR.z, night: true });

// ======================= 2) WESTMINSTER BURYING GROUND =======================
const WMB = { x0: -133.4, x1: -110.6, z0: -69.4, z1: -46.6, cx0: -129, cx1: -119, cz0: -67.5, cz1: -55.5, tower: { x: -124, z: -54.3, s: 3.2, h: CURB + 13 } };
window.POE_ANCHOR = { id: 'westminster', name: 'WESTMINSTER BURYING GROUND', x: -113.6, z: -49.6, y: CURB, yaw: Math.PI * 0.75, // Poe's memorial inside the corner gate
  grave: { x: -113.6, z: -49.6 }, gate: { x: WMB.x1, z: -50.2, w: 2.2, side: 'east' }, gate2: { x: -118.5, z: WMB.z1, w: 2.2, side: 'south' },
  church: { x0: WMB.cx0, x1: WMB.cx1, z0: WMB.cz0, z1: WMB.cz1 }, catacombs: { x: -124, z: -61.5, note: 'church undercroft entrance (stub)' },
  yard: { x0: WMB.x0, x1: WMB.x1, z0: WMB.z0, z1: WMB.z1 }, stones: [], nightOnly: true };
LEXW.wmbL = lmHD('westminster', -122, -58, 13, (H, signs, SG) => {
  const Y0 = CURB, { x0, x1, z0, z1, cx0, cx1, cz0, cz1 } = WMB, BR = '#7e3e2c', BR2 = '#6a3224', STN = '#c9c3b6', GR = '#4f6f3a';
  H.box(x0, Y0 - 0.02, z0, x1, Y0 + 0.03, z1, GR, { ol: false }); // the grass yard
  for (let i = 0; i < 26; i++) H.box(-113 + (LMR() - 0.5) * 2, Y0 + 0.031, -51 - i * 0.62, -112.2 + (LMR() - 0.5) * 2, Y0 + 0.035, -50.7 - i * 0.62, '#8c8574', { ol: false }); // worn path
  // the perimeter brick wall with stone coping, gaps for the two gates (east toward the market, south on the street) + iron gates swung open
  const wallH = 1.7, walls = [[x0, z1, -119.6, z1], [-117.4, z1, x1, z1], [x1, z1, x1, -49.1], [x1, -51.3, x1, z0], [x1, z0, x0, z0], [x0, z0, x0, z1]];
  for (const [xa, za, xb, zb] of walls) { const L = Math.hypot(xb - xa, zb - za); if (L < 0.2) continue; const ax = za === zb;
    const [bx0, bx1, bz0, bz1] = ax ? [Math.min(xa, xb), Math.max(xa, xb), za - 0.22, za + 0.22] : [xa - 0.22, xa + 0.22, Math.min(za, zb), Math.max(za, zb)];
    H.box(bx0, Y0, bz0, bx1, Y0 + wallH, bz1, BR); H.box(bx0 - 0.08, Y0 + wallH, bz0 - 0.08, bx1 + 0.08, Y0 + wallH + 0.14, bz1 + 0.08, STN, { ol: false });
    for (let t = 0; t <= L; t += 4) { const px = ax ? Math.min(xa, xb) + t : xa, pz = ax ? za : Math.min(za, zb) + t; H.box(px - 0.32, Y0, pz - 0.32, px + 0.32, Y0 + wallH + 0.3, pz + 0.32, BR2, { ol: false }); }
    lmColl({ x0: bx0, x1: bx1, z0: bz0, z1: bz1 }); }
  for (const [x, z] of [[-119.6, z1], [-117.4, z1], [x1, -51.3], [x1, -49.1]]) { H.box(x - 0.4, Y0, z - 0.4, x + 0.4, Y0 + 2.4, z + 0.4, BR2); H.cyl(x, Y0 + 2.4, z, 0.05, 0.36, 0.45, 4, STN, { ry: Math.PI / 4 }); lmColl({ x, z, r: 0.45 }); }
  for (const [x, z, a] of [[-119.5, z1 + 0.05, 1], [-117.5, z1 + 0.05, -1]]) for (let k = 0; k < 6; k++) H.box(x + a * 0.05, Y0, z + 0.05 + k * 0.17, x + a * 0.05 + 0.04, Y0 + 1.9, z + 0.09 + k * 0.17, '#1c1c1e', { ol: false }); // open south gate leaves
  for (const [z, a] of [[-51.2, 1], [-49.2, -1]]) for (let k = 0; k < 6; k++) H.box(x1 + 0.05 + k * 0.17, Y0, z + a * 0.05, x1 + 0.09 + k * 0.17, Y0 + 1.9, z + a * 0.05 + 0.04, '#1c1c1e', { ol: false }); // open east gate leaves
  // the church (Westminster Hall): brick nave with buttresses, lancet windows, steep slate roof, the square front tower with pinnacles + a spire
  const roofY = Y0 + 8, rh = 5.2, ccx = (cx0 + cx1) / 2;
  H.box(cx0, Y0, cz0, cx1, roofY, cz1, BR);
  H.prism('z', cz0 - 0.35, cz1 + 0.35, [[cx0 - 0.4, roofY], [cx1 + 0.4, roofY], [ccx, roofY + rh]], '#4a4a52');
  for (const [xa, za, xb, zb] of [[cx1, cz1, cx1, cz0], [cx0, cz0, cx0, cz1]]) { const S = H.frame(xa, za, xb, zb);
    H.windows(S, 0.8, S.L - 0.8, Y0 + 1.8, roofY - 0.6, { bw: 2.4, fh: 5.6, ww: 0.85, wh: 3.4, arch: true, pane: '#2e3a52', lit: 0.4, sill: STN });
    H.pilasters(S, 0, S.L, Y0, roofY - 0.4, 2.4, 0.45, 0.45, BR2); H.fbox(S, 0, S.L, roofY - 0.35, roofY - 0.1, 0, 0.3, STN, { ol: false }); }
  { const S = H.frame(cx1, cz0, cx0, cz0); H.farch(S, S.L / 2, Y0 + 4.5, 1.5, 0.0, 0.05, '#2e3a52', { ol: false, emi: '#7a5a8a' }, 10); H.fbox(S, S.L / 2 - 1.5, S.L / 2 + 1.5, Y0 + 2, Y0 + 4.5, 0, 0.05, '#2e3a52', { ol: false, emi: '#7a5a8a' }); }
  H.tris([cx0 - 0.02, roofY, cz1 + 0.36, cx1 + 0.02, roofY, cz1 + 0.36, ccx, roofY + rh - 0.1, cz1 + 0.36], BR); // brick gable end behind the tower
  const T0 = WMB.tower, ts = T0.s / 2;
  H.box(T0.x - ts, Y0, T0.z - ts, T0.x + ts, T0.h, T0.z + ts, BR2);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { H.box(T0.x + dx * ts - 0.25, Y0, T0.z + dz * ts - 0.25, T0.x + dx * ts + 0.25, T0.h + 0.4, T0.z + dz * ts + 0.25, BR); H.cyl(T0.x + dx * ts, T0.h + 0.4, T0.z + dz * ts, 0.02, 0.28, 1.6, 4, STN, { ry: Math.PI / 4 }); }
  H.cyl(T0.x, T0.h, T0.z, 0.03, ts * 1.05, 7.5, 8, '#4a4a52', { ry: Math.PI / 8 }); H.seg([T0.x, T0.h + 7.4, T0.z], [T0.x, T0.h + 8.4, T0.z], 0.05, '#2a2a2e');
  { const S = H.frame(T0.x - ts, T0.z + ts, T0.x + ts, T0.z + ts); H.farch(S, ts, Y0 + 2.4, 0.8, 0, 0.06, '#3a2418', { ol: false }); H.fbox(S, ts - 0.8, ts + 0.8, Y0, Y0 + 2.4, 0, 0.06, '#3a2418', { ol: false });
    H.farch(S, ts, T0.h - 2.6, 0.55, 0, 0.06, '#1c1c22', { ol: false }); H.fbox(S, ts - 0.55, ts + 0.55, T0.h - 4.4, T0.h - 2.6, 0, 0.06, '#1c1c22', { ol: false });
    for (const y of [Y0 + 4.4, T0.h - 5.2]) H.fbox(S, -0.1, S.L + 0.1, y, y + 0.22, 0, 0.12, STN, { ol: false }); }
  for (const [xa, za, xb, zb] of [[T0.x + ts, T0.z + ts, T0.x + ts, T0.z - ts], [T0.x - ts, T0.z - ts, T0.x - ts, T0.z + ts]]) { const S = H.frame(xa, za, xb, zb); H.farch(S, ts, T0.h - 2.6, 0.55, 0, 0.06, '#1c1c22', { ol: false }); H.fbox(S, ts - 0.55, ts + 0.55, T0.h - 4.4, T0.h - 2.6, 0, 0.06, '#1c1c22', { ol: false }); }
  // the catacomb hatch (stub entrance on the east side of the nave)
  H.box(cx1 + 0.1, Y0, -62.4, cx1 + 1.5, Y0 + 0.45, -60.6, STN); H.box(cx1 + 0.2, Y0 + 0.45, -62.3, cx1 + 1.4, Y0 + 0.5, -60.7, '#2a2420', { ol: false });
  // tombstones: rows of slabs, a few obelisks + box tombs (seeded), clear of the church, the paths and Poe's memorial
  const stones = window.POE_ANCHOR.stones;
  for (let z = z0 + 1.6; z < z1 - 1.2; z += 2.2) for (let x = x0 + 1.4; x < x1 - 1.2; x += 1.9) {
    const jx = x + (LMR() - 0.5) * 0.6, jz = z + (LMR() - 0.5) * 0.5;
    if (jx > cx0 - 1.2 && jx < cx1 + 1.8 && jz > cz0 - 1.2 && jz < T0.z + ts + 1.2) continue; // the church
    if (Math.abs(jx - -113) < 1.3 && jz > -66) continue; if (Math.abs(jz - -50.2) < 1.2 && jx > -116) continue; if (Math.abs(jx - -118.5) < 1.4 && jz > -50) continue; // paths
    if (Math.hypot(jx - -113.6, jz - -49.6) < 2.6) continue; if (LMR() < 0.18) continue;
    const r = LMR(), lean = (LMR() - 0.5) * 0.18, col = LMR() < 0.5 ? STN : LMR() < 0.5 ? '#a9a59b' : '#8e8b84';
    if (r < 0.08) { H.box(jx - 0.18, Y0, jz - 0.18, jx + 0.18, Y0 + 0.35, jz + 0.18, col); H.cyl(jx, Y0 + 0.35, jz, 0.04, 0.13, 1.6, 4, col, { ry: Math.PI / 4 }); stones.push([+jx.toFixed(2), +jz.toFixed(2), 'obelisk']); lmColl({ x: jx, z: jz, r: 0.3 }); }
    else if (r < 0.16) { H.box(jx - 0.45, Y0, jz - 0.8, jx + 0.45, Y0 + 0.6, jz + 0.8, col); H.box(jx - 0.52, Y0 + 0.6, jz - 0.88, jx + 0.52, Y0 + 0.7, jz + 0.88, '#d8d2c4', { ol: false }); stones.push([+jx.toFixed(2), +jz.toFixed(2), 'tomb']); lmColl({ x0: jx - 0.45, x1: jx + 0.45, z0: jz - 0.8, z1: jz + 0.8 }); }
    else { const g = new THREE.BoxGeometry(0.5 + LMR() * 0.2, 0.7 + LMR() * 0.4, 0.1); g.translate(0, g.parameters.height / 2, 0); g.rotateZ(lean); g.translate(jx, Y0, jz); H.geo(g, col);
      stones.push([+jx.toFixed(2), +jz.toFixed(2), 'slab']); }
  }
  // Poe's memorial: a pale marble pedestal on a granite base with a bronze medallion, a little iron rail
  { const px = -113.6, pz = -49.6; H.box(px - 0.9, Y0, pz - 0.7, px + 0.9, Y0 + 0.35, pz + 0.7, '#9a968e'); H.box(px - 0.6, Y0 + 0.35, pz - 0.45, px + 0.6, Y0 + 2.0, pz + 0.45, '#e8e4dc');
    H.box(px - 0.72, Y0 + 2.0, pz - 0.57, px + 0.72, Y0 + 2.25, pz + 0.57, '#d8d4cc'); H.cyl(px, Y0 + 1.3, pz + 0.47, 0.26, 0.26, 0.05, 12, '#6a5030', { ol: false });
    for (let a = 0; a < 16; a++) { const t = a / 16 * TAU; H.seg([px + Math.cos(t) * 1.4, Y0, pz + Math.sin(t) * 1.1], [px + Math.cos(t) * 1.4, Y0 + 0.75, pz + Math.sin(t) * 1.1], 0.025, '#1c1c1e'); }
    lmColl({ x: px, z: pz, r: 0.95 });
    SG.add(H.frame(px - 0.6, pz + 0.46, px + 0.6, pz + 0.46), 0.6, Y0 + 0.55, 1.1, 0.55, 0.01, (g, w, h) => { sText(g, 'EDGAR ALLAN POE', w / 2, h * 0.3, w * 0.9, h * 0.26, SERIF, '#3a3530', { weight: '700' }); sText(g, '1809 \u2013 1849', w / 2, h * 0.68, w * 0.6, h * 0.22, SERIF, '#3a3530', { weight: '600' }); }); }
  // a few bare old trees
  for (const [x, z] of [[-131.2, -48.6], [-131.4, -66.8], [-112.6, -67.6], [-116.4, -56.2]]) { H.cyl(x, Y0, z, 0.16, 0.26, 3.4, 6, '#3e3228');
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + LMR(), L = 1.6 + LMR(); H.seg([x, Y0 + 3.0, z], [x + Math.cos(a) * L, Y0 + 4.3 + LMR() * 0.8, z + Math.sin(a) * L], 0.07, '#3e3228', { r1: 0.02 }); } lmColl({ x, z, r: 0.35 }); }
  // the gate plaque
  SG.add(H.frame(-117.3, z1 + 0.45, -115.3, z1 + 0.45), 1.0, Y0 + 0.9, 1.9, 0.52, 0.01, (g, w, h) => { g.fillStyle = '#1e2a22'; g.fillRect(0, 0, w, h); sText(g, 'WESTMINSTER', w / 2, h * 0.32, w * 0.9, h * 0.32, SERIF, '#e8dcb8', { weight: '700' }); sText(g, 'BURYING GROUND', w / 2, h * 0.72, w * 0.9, h * 0.26, SERIF, '#e8dcb8', { weight: '600' }); });
});
lmColl({ x0: WMB.cx0, x1: WMB.cx1, z0: WMB.cz0, z1: WMB.cz1 }); lmColl({ x0: WMB.tower.x - 1.6, x1: WMB.tower.x + 1.6, z0: WMB.tower.z - 1.6, z1: WMB.tower.z + 1.6 });
BLD.push({ x0: WMB.cx0, x1: WMB.cx1, z0: WMB.cz0, z1: WMB.cz1, h: CURB + 8 }, { x0: WMB.tower.x - 1.6, x1: WMB.tower.x + 1.6, z0: WMB.tower.z - 1.6, z1: WMB.tower.z + 1.6, h: WMB.tower.h });
lexFar(LEXW.wmbL, (H) => { const { cx0, cx1, cz0, cz1, tower: T0 } = WMB; H.box(cx0, CURB, cz0, cx1, CURB + 8, cz1, '#7e3e2c', { ol: false }); H.prism('z', cz0, cz1, [[cx0, CURB + 8], [cx1, CURB + 8], [(cx0 + cx1) / 2, CURB + 13.2]], '#4a4a52', { ol: false });
  H.box(T0.x - 1.6, CURB, T0.z - 1.6, T0.x + 1.6, T0.h, T0.z + 1.6, '#6a3224', { ol: false }); H.cyl(T0.x, T0.h, T0.z, 0.03, 1.7, 7.5, 8, '#4a4a52', { ry: Math.PI / 8, ol: false });
  H.box(WMB.x0, CURB, WMB.z0, WMB.x1, CURB + 0.03, WMB.z1, '#4f6f3a', { ol: false }); });

// ======================= 3) RASH FIELD =======================
const RSF = { x0: -42, x1: -21, z0: 19, z1: 30, fx0: -40.6, fx1: -22.4, fz0: 20.2, fz1: 29.2 };
RSF.cx = (RSF.fx0 + RSF.fx1) / 2; RSF.cz = (RSF.fz0 + RSF.fz1) / 2;
window.RASH_ANCHOR = { id: 'rashfield', name: 'RASH FIELD', x: RSF.cx, z: RSF.cz, y: CURB + 0.03, yaw: 0, field: { x0: RSF.fx0, x1: RSF.fx1, z0: RSF.fz0, z1: RSF.fz1 },
  goals: [{ x: RSF.fx0 + 2.2, z: RSF.cz, faces: '+x', team: 'otters' }, { x: RSF.fx1 - 2.2, z: RSF.cz, faces: '-x', team: 'toads' }], entry: { x: RSF.cx, z: 31.8 },
  water: 'north edge (z ' + RSF.z0 + ') + west / east seawalls: a defender checked off the field lands in the harbour' };
LEXW.rashL = lmHD('rashfield', RSF.cx, RSF.cz, 11, (H, signs, SG) => {
  const Y0 = CURB, { x0, x1, z0, z1, fx0, fx1, fz0, fz1, cx, cz } = RSF, LN = '#f2f2ea', yl = Y0 + 0.035;
  H.box(x0, WY - 0.3, z0 - 0.02, x1, Y0, z0 + 0.3, '#7a7468'); H.box(x0, Y0, z0, x1, Y0 + 0.08, z0 + 0.35, '#c8c2b4', { ol: false }); // north seawall + coping
  for (let i = 0; i < 9; i++) H.box(lerp(fx0, fx1, i / 9), Y0 + 0.01, fz0, lerp(fx0, fx1, (i + 1) / 9), Y0 + 0.03, fz1, i % 2 ? '#4f8f3a' : '#5a9a42', { ol: false }); // mown stripes
  const line = (ax, az, bx, bz, w = 0.09) => H.box(Math.min(ax, bx) - (az === bz ? 0 : w / 2), yl - 0.004, Math.min(az, bz) - (az === bz ? w / 2 : 0), Math.max(ax, bx) + (az === bz ? 0 : w / 2), yl, Math.max(az, bz) + (az === bz ? w / 2 : 0), LN, { ol: false });
  line(fx0, fz0, fx1, fz0); line(fx0, fz1, fx1, fz1); line(fx0, fz0, fx0, fz1); line(fx1, fz0, fx1, fz1); line(cx, fz0, cx, fz1);
  for (const gx of [fx0 + 2.2, fx1 - 2.2]) { const c = new THREE.RingGeometry(1.0, 1.09, 20); c.rotateX(-Math.PI / 2); c.translate(gx, yl, cz); H.geo(c, LN, { ol: false }); }
  for (const rx of [fx0 + 5.2, fx1 - 5.2]) line(rx, fz0, rx, fz1, 0.07); // restraining lines
  { const c = new THREE.CircleGeometry(0.25, 10); c.rotateX(-Math.PI / 2); c.translate(cx, yl + 0.001, cz); H.geo(c, LN, { ol: false }); }
  // the two goals: orange pipe frames with white nets (open toward the centre)
  for (const [gx, s] of [[fx0 + 2.2, -1], [fx1 - 2.2, 1]]) { const w = 0.95, hgt = 1.35, back = gx + s * 1.1;
    for (const dz of [-w, w]) H.seg([gx, Y0, cz + dz], [gx, Y0 + hgt, cz + dz], 0.045, '#ff7a1a', { seg: 6 });
    H.seg([gx, Y0 + hgt, cz - w], [gx, Y0 + hgt, cz + w], 0.045, '#ff7a1a', { seg: 6 });
    for (const dz of [-w, w]) H.seg([gx, Y0 + 0.02, cz + dz], [back, Y0 + 0.02, cz], 0.03, '#ff7a1a', { seg: 5 });
    const net = [gx, Y0 + hgt, cz - w, gx, Y0 + hgt, cz + w, back, Y0, cz, gx, Y0, cz - w, gx, Y0 + hgt, cz - w, back, Y0, cz, gx, Y0, cz + w, back, Y0, cz, gx, Y0 + hgt, cz + w];
    H.tris(net, '#e8ece8', { ol: false }); H.tris([net[3], net[4], net[5], net[0], net[1], net[2], net[6], net[7], net[8]], '#e8ece8', { ol: false }); // two-sided
    lmColl({ x: (gx + back) / 2, z: cz, r: 0.75 }); }
  // team benches on the promenade side + a low rail along the water side
  for (const bx of [cx - 5, cx + 5]) { H.box(bx - 1.6, Y0, fz1 + 0.35, bx + 1.6, Y0 + 0.45, fz1 + 0.7, '#3a5a8a'); H.box(bx - 1.6, Y0 + 0.45, fz1 + 0.65, bx + 1.6, Y0 + 0.95, fz1 + 0.75, '#3a5a8a', { ol: false }); }
  for (let x = x0 + 0.4; x <= x1 - 0.3; x += 2.1) H.box(x - 0.05, Y0, z0 + 0.12, x + 0.05, Y0 + 1.0, z0 + 0.22, '#3a3a3e', { ol: false });
  H.box(x0 + 0.3, Y0 + 0.95, z0 + 0.12, x1 - 0.3, Y0 + 1.05, z0 + 0.22, '#3a3a3e', { ol: false });
  for (const x of [x0 + 0.2, x1 - 0.2]) for (let z = z0 + 0.4; z <= z1 - 0.3; z += 2.1) H.box(x - 0.05, Y0, z - 0.05, x + 0.05, Y0 + 1.0, z + 0.05, '#3a3a3e', { ol: false });
  for (const x of [x0 + 0.2, x1 - 0.2]) H.box(x - 0.05, Y0 + 0.95, z0 + 0.3, x + 0.05, Y0 + 1.05, z1 - 0.3, '#3a3a3e', { ol: false });
  // the park sign at the promenade entrance
  H.box(cx - 1.7, Y0, z1 - 0.15, cx - 1.55, Y0 + 1.5, z1, '#2a3a2a'); H.box(cx + 1.55, Y0, z1 - 0.15, cx + 1.7, Y0 + 1.5, z1, '#2a3a2a');
  SG.at(cx, Y0 + 0.75, z1 + 0.01, 0, 3.4, 0.8, (g, w, h) => { g.fillStyle = '#1f4a2c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8dcb8'; g.lineWidth = h * 0.05; g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
    sText(g, 'RASH FIELD', w / 2, h * 0.4, w * 0.85, h * 0.42, SANS, '#f4ecd0', { weight: '800', track: 2 }); sText(g, 'INNER HARBOR \u00b7 KEY HIGHWAY', w / 2, h * 0.76, w * 0.8, h * 0.2, SANS, '#e8dcb8', { weight: '600' }); });
}, null);
lmColl({ x0: RSF.x0 + 0.1, x1: RSF.x1 - 0.1, z0: RSF.z0 + 0.1, z1: RSF.z0 + 0.25 }); // the water-side rail (the side rails stay open: knock-ins happen there)
lexFar(LEXW.rashL, (H) => H.box(RSF.fx0, CURB + 0.01, RSF.fz0, RSF.fx1, CURB + 0.03, RSF.fz1, '#55953e', { ol: false }));
landmark('rashfield', 'RASH FIELD', RSF.cx, RSF.cz + 1, 12, { name: 'Riptide Rodney', x: RSF.cx, z: RSF.cz });

// ======================= 4) HOOTERS on the Light Street Pavilion's octagon =======================
const HOO = { x: -55.5, z: 0.9, a: 3.2, can: 1.45, Y1: CURB + 3.6, E2: CURB + 7.0, top: CURB + 10.4 }; // apothem a; canopy overhang can
HOO.R = HOO.a / Math.cos(Math.PI / 8);
window.HOOTERS_ANCHOR = { x: HOO.x - HOO.a - 1.8, z: HOO.z, door: { x: HOO.x - HOO.a, z: HOO.z }, yaw: Math.PI / 2, face: 'west (Light St)' };
// the channel-letter sign, drawn once (one canvas per face in the atlas): orange faces, deep silver returns, a white rounded halo behind every letter, a small ®
function hootersLetters(g, w, h) {
  const txt = 'HOOTERS', px = Math.round(h * 0.7), font = `900 ${px}px "Arial Black", "Helvetica Neue", Helvetica, Arial, "DejaVu Sans", sans-serif`;
  g.font = font; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; const sp = px * 0.02; let tw = 0; const ws = [...txt].map((c) => { const m = g.measureText(c).width; tw += m + sp; return m; }); tw -= sp;
  const k = Math.min(1, (w * 0.86) / tw); g.save(); g.translate(w * 0.06, 0); g.scale(k, 1);
  const by = h * 0.8; let x = 0; const xs = ws.map((m) => { const v = x; x += m + sp; return v; });
  g.lineJoin = 'round'; g.lineCap = 'round';
  [...txt].forEach((c, i) => { g.strokeStyle = '#ffffff'; g.lineWidth = px * 0.3; g.strokeText(c, xs[i], by); g.fillStyle = '#ffffff'; g.fillText(c, xs[i], by); }); // white halo clouds
  const d = Math.max(2, Math.round(px * 0.07)); for (let s = d; s > 0; s--) { g.fillStyle = s > d * 0.5 ? '#8c9298' : '#b9bfc4'; [...txt].forEach((c, i) => g.fillText(c, xs[i] + s * 0.6, by + s)); } // silver returns
  [...txt].forEach((c, i) => { const gr = g.createLinearGradient(0, by - px * 0.75, 0, by); gr.addColorStop(0, '#e2632f'); gr.addColorStop(1, '#c24a22'); g.fillStyle = gr; g.fillText(c, xs[i], by);
    g.strokeStyle = '#8a2e12'; g.lineWidth = Math.max(1, px * 0.02); g.strokeText(c, xs[i], by); });
  g.restore(); g.font = `bold ${Math.round(px * 0.2)}px Arial, sans-serif`; g.fillStyle = '#c24a22'; g.fillText('\u00ae', w * 0.06 + tw * k + px * 0.04, by - px * 0.62);
}
// the owl (procedural, original drawing in the sidewalk-sign style: round brown body, cream face disc, big orange-ringed eyes)
function hootersOwl(g, cx, cy, s) {
  g.save(); g.translate(cx, cy);
  g.fillStyle = '#7a4e2c'; g.beginPath(); g.ellipse(0, s * 0.18, s * 0.42, s * 0.55, 0, 0, TAU); g.fill();
  g.fillStyle = '#5c3a20'; g.beginPath(); g.moveTo(-s * 0.36, -s * 0.22); g.lineTo(-s * 0.3, -s * 0.5); g.lineTo(-s * 0.12, -s * 0.3); g.fill(); g.beginPath(); g.moveTo(s * 0.36, -s * 0.22); g.lineTo(s * 0.3, -s * 0.5); g.lineTo(s * 0.12, -s * 0.3); g.fill();
  g.fillStyle = '#e8d6b4'; g.beginPath(); g.ellipse(0, s * 0.42, s * 0.24, s * 0.26, 0, 0, TAU); g.fill();
  g.strokeStyle = '#a07040'; g.lineWidth = s * 0.03; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, s * (0.3 + i * 0.1), s * 0.12, 0.3, Math.PI - 0.3); g.stroke(); }
  for (const sx of [-1, 1]) { g.fillStyle = '#e2632f'; g.beginPath(); g.arc(sx * s * 0.17, -s * 0.06, s * 0.16, 0, TAU); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(sx * s * 0.17, -s * 0.06, s * 0.11, 0, TAU); g.fill();
    g.fillStyle = '#1a1210'; g.beginPath(); g.arc(sx * s * 0.17 + s * 0.02, -s * 0.05, s * 0.055, 0, TAU); g.fill(); }
  g.fillStyle = '#e8a030'; g.beginPath(); g.moveTo(-s * 0.05, s * 0.06); g.lineTo(s * 0.05, s * 0.06); g.lineTo(0, s * 0.16); g.fill(); g.restore();
}
LEXW.hooL = lmHD('hooters', HOO.x, HOO.z, 5, (H, signs, SG) => {
  const Y0 = CURB, { x, z, a, can, Y1, E2, top } = HOO, R = HOO.R, rot = Math.PI / 8, BRZ = '#3a2e26', BRZ2 = '#2a221c', WOOD = '#b07a48', AL = '#d4d8dc', GL = '#56707c', COL = '#ddd5c4', ROOF = '#93bfa2';
  const face = (k, rr) => { const p = k * Math.PI / 4, A = [x + Math.sin(p - rot) * rr, z + Math.cos(p - rot) * rr], B = [x + Math.sin(p + rot) * rr, z + Math.cos(p + rot) * rr]; return H.frame(A[0], A[1], B[0], B[1]); };
  // faces k: 0 south (harbour), 1 SE, 2 east (harbour), 3 NE, 4 north (into the pavilion), 5 NW, 6 west (Light St), 7 SW
  H.cyl(x, Y0, z, R + 0.35, R + 0.35, 0.1, 8, '#c8c2b4', { ry: rot, ol: false });
  H.cyl(x, Y0 + 0.1, z, R - 0.15, R - 0.15, E2 - Y0 - 0.1, 8, GL, { ry: rot });
  for (let k = 0; k < 8; k++) { if (k === 4) continue; const F = face(k, a), L = F.L;
    if (k === 7 || k === 3) { H.fbox(F, 0.05, L - 0.05, Y0 + 0.1, Y1, 0, 0.06, WOOD); for (let i = 1; i < 5; i++) H.fbox(F, 0.05, L - 0.05, Y0 + 0.1 + i * (Y1 - Y0) / 5 - 0.02, Y0 + 0.1 + i * (Y1 - Y0) / 5 + 0.02, 0.06, 0.08, '#8a5a30', { ol: false }); }
    else { H.fbox(F, 0.06, L - 0.06, Y0 + 0.12, Y1 - 0.05, 0, 0.03, '#7894a2', { ol: false, emi: '#ffd690' });
      for (const t of [0, 0.5, 1]) H.fbox(F, t * L - 0.04, t * L + 0.04, Y0 + 0.1, Y1, 0.03, 0.07, AL, { ol: false });
      H.fbox(F, 0, L, Y0 + 2.5, Y0 + 2.56, 0.03, 0.07, AL, { ol: false }); }
    // upper storey glass + mullions
    H.fbox(F, 0.06, L - 0.06, Y1 + 0.55, E2 - 0.1, 0, 0.03, '#7894a2', { ol: false, emi: LMR() < 0.7 ? '#ffd690' : null });
    for (const t of [0, 0.33, 0.67, 1]) H.fbox(F, t * L - 0.04, t * L + 0.04, Y1 + 0.5, E2, 0.03, 0.07, AL, { ol: false });
  }
  // doors on the Light St face (k 6)
  { const F = face(6, a), L = F.L; H.fbox(F, L / 2 - 0.85, L / 2 + 0.85, Y0 + 0.1, Y0 + 2.35, 0.03, 0.09, '#506068', { ol: false, emi: '#ffe0a8' }); H.fbox(F, L / 2 - 0.03, L / 2 + 0.03, Y0 + 0.1, Y0 + 2.35, 0.09, 0.12, AL, { ol: false });
    for (const s of [-1, 1]) H.fbox(F, L / 2 + s * 0.15 - 0.02, L / 2 + s * 0.15 + 0.02, Y0 + 0.9, Y0 + 1.6, 0.12, 0.17, AL, { ol: false }); }
  // the deep dark-bronze canopy: fascia slab, warm wood-slat soffit, LED strips + downlights (lit at night)
  H.cyl(x, Y1, z, (a + can) / Math.cos(rot), (a + can) / Math.cos(rot), 0.5, 8, BRZ, { ry: rot });
  H.cyl(x, Y1 - 0.04, z, (a + can - 0.12) / Math.cos(rot), (a + can - 0.12) / Math.cos(rot), 0.04, 8, '#b98656', { ry: rot, ol: false, emi: '#3a2a18' });
  for (let k = 0; k < 8; k++) { const p = k * Math.PI / 4; for (const f of [0.45, 0.85]) { const rr = a + can * f;
      H.seg([x + Math.sin(p - rot) * rr / Math.cos(rot) * 0.98, Y1 - 0.06, z + Math.cos(p - rot) * rr / Math.cos(rot) * 0.98], [x + Math.sin(p + rot) * rr / Math.cos(rot) * 0.98, Y1 - 0.06, z + Math.cos(p + rot) * rr / Math.cos(rot) * 0.98], 0.025, '#fff4d8', { emi: '#fff0c8' }); } }
  H.cyl(x, Y1 + 0.5, z, (a + can) / Math.cos(rot) - 0.05, (a + can) / Math.cos(rot) - 0.05, 0.05, 8, BRZ2, { ry: rot, ol: false });
  // eave slab + the octagonal hip roof (pale green standing seam) + a little lantern cap
  H.cyl(x, E2, z, R + 0.55, R + 0.55, 0.42, 8, COL, { ry: rot });
  H.cyl(x, E2 + 0.42, z, 0.55, R + 0.55, top - E2 - 0.42, 8, ROOF, { ry: rot });
  for (let k = 0; k < 8; k++) { const p = k * Math.PI / 4 + rot; H.seg([x + Math.sin(p) * (R + 0.55), E2 + 0.44, z + Math.cos(p) * (R + 0.55)], [x + Math.sin(p) * 0.55, top + 0.02, z + Math.cos(p) * 0.55], 0.05, '#7aa88a'); }
  H.cyl(x, top, z, 0.3, 0.6, 0.5, 8, COL, { ry: rot }); H.cyl(x, top + 0.5, z, 0.02, 0.32, 0.6, 8, ROOF, { ry: rot });
  // the big HOOTERS channel letters on short posts at the canopy edge: Light St face (west, k 6) and harbour face (east, k 2) - one drawing, placed twice
  const SW = 5.0, SH = 1.4;
  for (const k of [6, 2]) { const F = face(k, a + can - 0.25); const L = F.L, yb = Y1 + 0.78;
    for (const t of [0.12, 0.38, 0.62, 0.88]) H.fbox(F, L / 2 + (t - 0.5) * SW * 0.86 - 0.04, L / 2 + (t - 0.5) * SW * 0.86 + 0.04, Y1 + 0.5, yb + 0.15, -0.12, -0.04, AL, { ol: false });
    H.fbox(F, L / 2 - SW * 0.44, L / 2 + SW * 0.44, Y1 + 0.62, Y1 + 0.7, -0.14, -0.02, AL, { ol: false });
    SG.add(F, L / 2, yb, SW, SH, 0.02, hootersLetters); }
  // SUITE 1445 over the doors, the red-and-white decal on the SW... (south-west glass k 0 = harbour, decal on the right glass of the Light St side k 5)
  { const F = face(6, a); SG.add(F, F.L / 2, Y0 + 2.48, 1.5, 0.26, 0.1, (g, w, h) => { g.fillStyle = '#1c2226'; g.fillRect(0, 0, w, h); sText(g, 'SUITE 1445', w / 2, h * 0.55, w * 0.86, h * 0.66, SANS, '#ffffff', { weight: '700', track: 1 }); }); }
  { const F = face(5, a); SG.add(F, F.L / 2, Y0 + 2.0, 1.6, 0.36, 0.08, (g, w, h) => { g.fillStyle = 'rgba(255,255,255,0.0)'; g.clearRect(0, 0, w, h); sText(g, 'HOOTERS', w / 2, h * 0.56, w * 0.94, h * 0.8, SANS, '#d8282c', { weight: '900', stroke: '#ffffff', sw: h * 0.12 }); }); }
  // the sidewalk menu board (owl + HOOTERS + Wings · Shrimp · Burgers) and a bistro table with two chairs on the Light St promenade
  { const mx = HOO.x - a - can - 1.0, mz = HOO.z + 2.6; H.box(mx - 0.05, Y0, mz - 0.45, mx + 0.05, Y0 + 1.25, mz + 0.45, '#b8bcc0'); H.box(mx - 0.25, Y0, mz - 0.35, mx + 0.25, Y0 + 0.05, mz + 0.35, '#3a3a3e', { ol: false });
    SG.at(mx - 0.06, Y0 + 0.22, mz, -Math.PI / 2, 0.84, 1.0, (g, w, h) => { g.fillStyle = '#121212'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8ccd0'; g.lineWidth = w * 0.03; g.strokeRect(w * 0.02, w * 0.02, w * 0.96, h - w * 0.04);
      sText(g, 'HOOTERS', w * 0.5, h * 0.14, w * 0.86, h * 0.13, SANS, '#e2632f', { weight: '900', stroke: '#ffffff', sw: h * 0.012 }); hootersOwl(g, w * 0.26, h * 0.42, h * 0.3);
      for (const [i, t] of ['Wings', 'Shrimp', 'Burgers'].entries()) sText(g, t, w * 0.68, h * (0.32 + i * 0.12), w * 0.5, h * 0.1, SANS, '#f2c12e', { weight: '800' });
      g.fillStyle = '#f2c12e'; g.strokeStyle = '#e2632f'; g.lineWidth = w * 0.015; g.beginPath(); g.moveTo(w * 0.22, h * 0.76); g.lineTo(w * 0.6, h * 0.76); g.lineTo(w * 0.6, h * 0.7); g.lineTo(w * 0.8, h * 0.82); g.lineTo(w * 0.6, h * 0.94); g.lineTo(w * 0.6, h * 0.88); g.lineTo(w * 0.22, h * 0.88); g.closePath(); g.fill(); g.stroke(); });
    lmColl({ x: mx, z: mz, r: 0.4 });
    const tx = HOO.x - a - can - 0.6, tz = HOO.z - 2.4; H.cyl(tx, Y0, tz, 0.05, 0.05, 0.72, 6, '#2a2a2e', { ol: false }); H.cyl(tx, Y0 + 0.72, tz, 0.38, 0.38, 0.04, 10, '#d8d8d0');
    for (const s of [-1, 1]) { H.box(tx - 0.2, Y0 + 0.44, tz + s * 0.62 - 0.2, tx + 0.2, Y0 + 0.48, tz + s * 0.62 + 0.2, '#2a2a2e', { ol: false }); H.box(tx - 0.2, Y0 + 0.48, tz + s * 0.82 - 0.02, tx + 0.2, Y0 + 0.9, tz + s * 0.82 + 0.02, '#2a2a2e', { ol: false });
      for (const dx of [-0.17, 0.17]) H.box(tx + dx - 0.02, Y0, tz + s * 0.62 - 0.02, tx + dx + 0.02, Y0 + 0.44, tz + s * 0.62 + 0.02, '#2a2a2e', { ol: false }); }
    lmColl({ x: tx, z: tz, r: 0.5 }); }
}, null);
lmColl({ x: HOO.x, z: HOO.z, r: HOO.a + 0.1 }); BLD.push({ x0: HOO.x - HOO.a, x1: HOO.x + HOO.a, z0: HOO.z - HOO.a, z1: HOO.z + HOO.a, h: HOO.E2 });
// night: an orange glow behind each sign (face glow + white halo backlight read), a warm wash on the canopy
{ const qs = []; for (const k of [6, 2]) { const p = k * Math.PI / 4, rr = HOO.a + HOO.can - 0.32, cx = HOO.x + Math.sin(p) * rr, cz = HOO.z + Math.cos(p) * rr; qs.push({ x: cx, y: HOO.Y1 + 0.35, z: cz, ry: p, w: 7.0, h: 2.6 }); }
  lexGlow(qs, lexHaloTex, LEXW.hooL.near); }
lexFar(LEXW.hooL, (H) => { const { x, z, Y1, E2, top } = HOO, R = HOO.R; H.cyl(x, CURB, z, R, R, E2 - CURB, 8, '#33424a', { ry: Math.PI / 8, ol: false });
  H.cyl(x, Y1, z, R + 1.5, R + 1.5, 0.5, 8, '#3a2e26', { ry: Math.PI / 8, ol: false }); H.cyl(x, E2, z, 0.5, R + 0.55, top - E2, 8, '#93bfa2', { ry: Math.PI / 8, ol: false }); });
