
// ======================= TOAD CITY PAPERBOY (Brad, 2026-10-13: "Same exact Baltimore assets city and code.") =======================
// A Paperboy-style route on the Toad City Baltimore engine: Harold rides a BMX down E Fort Ave's rowhouse blocks (Locust Point) delivering the
// Toad City Sun. Everything above this file is copied verbatim from Toad City Baltimore (renderer, toon/cel material, ink hulls, city atlas +
// real-name signs, building()/lamp()/car()/hydrant()/bin()/tree() kit, HD builder HB + sign atlas, World Trade Center + Fells Point landmark
// builders, Harold + Mavis rigs and poses, comic FX + sfx). This file adds only the game: route, rowhouse fronts built with the HB kit,
// obstacles, papers, scoring, a week of days, the bonus BMX course, HUD, touch + keys, a procedural B-more club loop, and a test bot.
// Test params: ?bot=1 (autopilot) &bot=lose (rides into traffic) &god=1 (no crashes, test only) &day=N (start day 0-6) &fast=1 (short cards)

// lmHD(): Toad City's landmark registry, redefined here to only store the builders (the copied WTC / Fells Point code calls it)
function lmHD(id, cx, cz, r, build) { (lmHD.defs || (lmHD.defs = {}))[id] = { id, cx, cz, r, build }; }
function lmMake(id) { // build a registered landmark (one toon mesh + ink hull + its canvas sign atlas), as 03b's lmHD did for the near LOD
  const D = lmHD.defs[id]; LMR(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483646 + 1);
  const hb = new HB(), signs = [], sa = new SA(); D.build(hb, signs, sa); const g = hb.build();
  for (const s of signs) g.add(s.build(DECAL_MAT)); if (sa.items.length) g.add(sa.build()); return g;
}

const PB = window.__pb = { fps: 0, frames: 0, errors: () => window.__celErr.n, log: [] };
const GOD = Q.has('god'), FAST = Q.has('fast'); let BOTQ = Q.get('bot'); PB.setBot = (m) => { BOTQ = m; };
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY3 = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// ---------------- the route: E Fort Ave, four rowhouse blocks, three cross streets (real Locust Point names) ----------------
const FZ = -9, CURBZ = -4, ROADZ1 = 8, FARZ1 = 12; // house fronts, curb line, far curb, far sidewalk edge
const HW = 5, STOOP_D = 1.35, STOOP_H = 0.45;
const ZMIN = -7.2, ZMAX = 7.0;
const LOTS = [], HOUSES = [], XST = [];
const XNAMES = ['LAWRENCE ST', 'WOODALL ST', 'HULL ST', 'BEASON ST'];
{ let x = 0, hn = 1401;
  for (let b = 0; b < 4; b++) {
    for (let i = 0; i < 7; i++) { const h = { i: HOUSES.length, x0: x, x1: x + HW, num: hn, sub: false, floors: 2 + ((HOUSES.length * 7) % 5 === 0 ? 1 : 0), ci: (HOUSES.length * 5) % 8, form: (HOUSES.length * 3) % 4 === 1 };
      h.door = x + 1.0; h.mb = [x + 1.75, x + 2.15]; h.win = [x + 2.45, x + 4.55]; h.stoop = [x + 0.35, x + 1.65]; HOUSES.push(h); LOTS.push({ k: 'house', h }); x += HW; hn += 2; }
    LOTS.push({ k: 'store', x0: x, x1: x + 7, sign: [0, 3, 5, 4][b] }); x += 7; hn += 2;
    if (b < 3) { XST.push({ x0: x, x1: x + 12, name: XNAMES[b] }); x += 12; }
  }
  XST.push({ x0: x, x1: x + 12, name: XNAMES[3] });
  PB.L = x; // the end of the route (the start of the last cross street)
}
const ROUTE_END = PB.L + 6;
const BX0 = PB.L + 22, BX1 = BX0 + 128; // bonus course

// ---------------- scene setup: Toad City lights / fog / sky, HD on, PCF shadows ----------------
applyQuality(true);
renderer.shadowMap.type = THREE.PCFSoftShadowMap; sun.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 }); sun.shadow.camera.updateProjectionMatrix();
const _ck = (a) => a.map((c) => new THREE.Color(c));
const PALK = { // Toad City's day / dusk palette (07_main.js)
  top: _ck(['#4a86c8', '#34386e']), mid: _ck(['#9cc4dc', '#b0706a']), hor: _ck(['#d8dccf', '#f08850']),
  fog: _ck(['#b4c0c6', '#8a6060']), hs: _ck(['#dfe6ff', '#ffb08a']), hg: _ck(['#8a7f74', '#5a4040']), sun: _ck(['#fff3dc', '#ff9a58']) };
const DIRK = [new THREE.Vector3(-0.5, 1.7, 0.42).normalize(), new THREE.Vector3(-1, 0.32, -0.25).normalize()];
function setLight(n) { // n: 0 bright morning .. 1 sunrise glow
  const c = (k, o) => o.copy(PALK[k][0]).lerp(PALK[k][1], n);
  c('top', SKY.U.top.value); c('mid', SKY.U.mid.value); c('hor', SKY.U.hor.value); SKY.U.uStars.value = 0;
  c('fog', scene.fog.color); FOGC.copy(scene.fog.color); renderer.setClearColor(scene.fog.color); scene.fog.near = 70; scene.fog.far = 190;
  OUT_U.fogC.value.copy(scene.fog.color); OUT_U.fogN.value = 70; OUT_U.fogF.value = 190;
  c('hs', hemi.color); c('hg', hemi.groundColor); hemi.intensity = lerp(1.45, 1.05, n); c('sun', sun.color); sun.intensity = lerp(2.1, 1.5, n);
  SUN_DIR.copy(DIRK[0]).lerp(DIRK[1], n * 0.55).normalize(); SKY.sunS.position.copy(SUN_DIR).multiplyScalar(70); SKY.moonS.visible = false;
  NIGHT.value = n * 0.35;
}
SKY.moonS.visible = false;

// ---------------- materials / tiny helpers ----------------
function hullFromMB(mb) { // an ink hull for a city-kit MB (cars): same triangles, odir, OUT_PROP
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(mb.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.N, 3));
  addOdir(g); g.deleteAttribute('normal'); const h = new THREE.Mesh(g, OUT_PROP); h.visible = QUAL.hd; QUAL.outlines.push(h); return h;
}
function kitMesh(fn) { // run a city-kit prop builder (car(), bin(), hydrant()...) into its own mesh at the origin
  const keep = CB.cap, mb = new MB(); CB.cap = mb; const nC = COLL.length, nB = BLD.length; fn(); CB.cap = keep; COLL.length = nC; BLD.length = nB;
  const g = new THREE.Group(), m = mb.build(CITY_MAT); m.castShadow = true; m.receiveShadow = true; g.add(m, hullFromMB(mb)); return g;
}
// merge a part-built prop's meshes per group (keeps animated sub-groups as they are): one toon mesh + one ink hull per group
function mergeParts(node) {
  const meshes = node.children.filter((c) => c.isMesh && !c.isSkinnedMesh && c.material && c.material.isMeshLambertMaterial && !c.userData.keep);
  if (meshes.length > 1) {
    const byMat = new Map(); for (const m of meshes) { if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push(m); }
    for (const [mat, list] of byMat) {
      const P = [], N = [], C = [], OP = [], OD = []; const nm = new THREE.Matrix3(), om = new THREE.Matrix3(), v = new THREE.Vector3();
      for (const m of list) { m.updateMatrix(); let g = m.geometry; const hull = m.children.find((c) => c.isMesh && c.material && c.material.isShaderMaterial);
        nm.getNormalMatrix(m.matrix); om.setFromMatrix4(m.matrix); const idx = g.index, A = g.attributes, n = idx ? idx.count : A.position.count;
        for (let j = 0; j < n; j++) { const i = idx ? idx.getX(j) : j; v.fromBufferAttribute(A.position, i).applyMatrix4(m.matrix); P.push(v.x, v.y, v.z);
          v.fromBufferAttribute(A.normal, i).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z); if (A.color) C.push(A.color.getX(i), A.color.getY(i), A.color.getZ(i)); else C.push(1, 1, 1);
          if (hull && A.odir) { v.fromBufferAttribute(A.position, i).applyMatrix4(m.matrix); OP.push(v.x, v.y, v.z); v.fromBufferAttribute(A.odir, i).applyMatrix3(om); OD.push(v.x, v.y, v.z); } }
        node.remove(m); if (hull) { const k = QUAL.outlines.indexOf(hull); if (k >= 0) QUAL.outlines.splice(k, 1); } }
      const G2 = new THREE.BufferGeometry(); G2.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); G2.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); G2.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      const M = new THREE.Mesh(G2, mat); M.castShadow = true; node.add(M);
      if (OP.length) { const H2 = new THREE.BufferGeometry(); H2.setAttribute('position', new THREE.Float32BufferAttribute(OP, 3)); H2.setAttribute('odir', new THREE.Float32BufferAttribute(OD, 3)); const h = new THREE.Mesh(H2, OUT_CHAR); h.visible = QUAL.hd; QUAL.outlines.push(h); node.add(h); }
    }
  }
  for (const c of node.children) if (!c.isMesh) mergeParts(c);
  return node;
}
const GLASS = canvasTex(256, 200, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#9cc8e0'); g.addColorStop(0.55, '#3c5c78'); g.addColorStop(1, '#26384c'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(30, h); c.lineTo(110, 0); c.lineTo(140, 0); c.lineTo(60, h); c.fill(); c.fillStyle = '#f2efe6'; c.fillRect(w / 2 - 6, 0, 12, h); c.fillRect(0, h * 0.45, w, 10);
  c.strokeStyle = INK; c.lineWidth = 10; c.strokeRect(0, 0, w, h); }, 256);
const BROKEN = canvasTex(256, 200, (c, w, h) => { c.fillStyle = '#14141c'; c.fillRect(0, 0, w, h); const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#9cc8e0'); g.addColorStop(1, '#3c5c78');
  c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h); c.lineTo(0, h); c.lineTo(0, 0); c.moveTo(w * 0.5, h * 0.18); for (let i = 0; i < 14; i++) { const a = -i / 14 * TAU, r = (i % 2 ? 0.22 : 0.42) * h; c.lineTo(w * 0.5 + Math.cos(a) * r * 1.3, h * 0.5 + Math.sin(a) * r); } c.closePath(); c.fill('evenodd');
  c.strokeStyle = '#f4f6ff'; c.lineWidth = 3; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; c.beginPath(); c.moveTo(w * 0.5 + Math.cos(a) * 30, h * 0.5 + Math.sin(a) * 22); c.lineTo(w * 0.5 + Math.cos(a) * 140, h * 0.5 + Math.sin(a) * 110); c.stroke(); }
  c.fillStyle = '#f2efe6'; c.fillRect(w / 2 - 6, 0, 12, h * 0.2); c.fillRect(w / 2 - 6, h * 0.8, 12, h * 0.2); c.strokeStyle = INK; c.lineWidth = 10; c.strokeRect(0, 0, w, h); }, 256);
const GLASS_M = new THREE.MeshLambertMaterial({ map: GLASS, emissive: '#223040', emissiveIntensity: 0.4 }), BROKEN_M = new THREE.MeshLambertMaterial({ map: BROKEN });
const PAPER_TEX = canvasTex(128, 64, (c, w, h) => { c.fillStyle = '#efe9d8'; c.fillRect(0, 0, w, h); c.fillStyle = '#8a8478'; for (let y = 12; y < h; y += 7) c.fillRect(8, y, w - 16, 2); c.fillStyle = '#1a1820'; c.fillRect(8, 3, w - 16, 7); c.fillStyle = '#d23a3a'; c.fillRect(w / 2 - 7, 0, 14, h); }, 128);

// ---------------- the street (rebuilt each morning: subscriber fronts are painted, the rest are dark) ----------------
const SUB_COLS = ['#e2c464', '#5fa6b8', '#e07a62', '#86b860', '#dc8ec0', '#f0e4c4', '#7896e0', '#f0a050'];
const NON_COLS = ['#4f4a52', '#4a4e54', '#5a4f48', '#46464e'];
const DOOR_COLS = ['#2f5a36', '#8a1f28', '#1f3a7a', '#2a2a2a', '#6a3a8a'];
let STREET = null; const LAMPC = [];
function houseFront(H, SG, h) {
  const Y0 = CURB, x0 = h.x0, x1 = h.x1, W = x1 - x0, F = H.frame(x0, FZ, x1, FZ), sub = h.sub, ht = h.floors * 2.9 + 1.1;
  const col = sub ? SUB_COLS[h.ci] : h.form ? '#86817a' : NON_COLS[h.ci % NON_COLS.length], cc = sub ? '#f6f2ea' : '#8e8a84', marble = sub ? '#f4f2ec' : '#b8b4ac';
  H.box(x0, Y0, FZ - 9, x1, Y0 + ht, FZ, col);
  if (h.form && !sub) for (let k = 0; k < 9; k++) { const u = LMR() * (W - 1), y = 0.6 + LMR() * (ht - 2); H.fbox(F, u, u + 0.6 + LMR() * 0.8, Y0 + y, Y0 + y + 0.3 + LMR() * 0.5, 0, 0.03, LMR() < 0.5 ? '#9a948a' : '#77726b', { ol: false }); } // formstone
  H.fbox(F, 0, W, Y0, Y0 + 0.5, 0, 0.08, marble, { ol: false }); // marble water table
  H.fbox(F, W - 0.07, W, Y0, Y0 + ht, 0, 0.12, '#2a2430', { ol: false }); // party-wall line
  H.fbox(F, -0.02, W + 0.02, Y0 + ht - 0.55, Y0 + ht, 0, 0.42, cc); // cornice
  for (let b = 0.32; b < W - 0.2; b += 0.62) H.fbox(F, b, b + 0.16, Y0 + ht - 0.9, Y0 + ht - 0.55, 0, 0.3, cc, { ol: false });
  H.box(x0 + 0.1, Y0 + ht, FZ - 8.8, x1 - 0.1, Y0 + ht + 0.35, FZ - 0.3, '#3a3a40', { ol: false }); // tar roof lip
  const board = !sub && h.ci % 3 === 0; // a vacant: plywood over the upper windows
  H.windows(F, 0.3, W - 0.3, Y0 + 3.0, Y0 + ht - 0.75, { bw: 1.6, fh: 2.9, ww: 0.86, wh: 1.62, pane: board ? '#b08a5a' : sub ? '#2a3440' : '#18191e', head: cc, sill: cc, mull: board ? null : cc, lit: sub ? 0.25 : 0 });
  // ground floor: door + arched transom, marble stoop, mailbox, the big front window (breakable, its own mesh)
  const d0 = 0.55, d1 = 1.45, dm = (d0 + d1) / 2;
  H.fbox(F, d0 - 0.13, d1 + 0.13, Y0 + STOOP_H, Y0 + 2.62, 0, 0.06, cc, { ol: false });
  H.farch(F, dm, Y0 + 2.62, 0.58, 0, 0.06, cc, { ol: false }, 8);
  H.fbox(F, d0, d1, Y0 + STOOP_H, Y0 + 2.5, 0.03, 0.09, sub ? DOOR_COLS[h.ci % DOOR_COLS.length] : '#3a3430', { ol: false });
  H.farch(F, dm, Y0 + 2.5, 0.45, 0.03, 0.08, '#2a3440', { ol: false, emi: sub ? '#ffcf7a' : null }, 8);
  H.fbox(F, d1 - 0.2, d1 - 0.12, Y0 + 1.45, Y0 + 1.55, 0.09, 0.14, '#d8b040', { ol: false });
  for (let k = 0; k < 3; k++) H.fbox(F, h.stoop[0] - x0, h.stoop[1] - x0, Y0 + k * 0.15, Y0 + (k + 1) * 0.15, 0, STOOP_D * (3 - k) / 3, marble, { ol: k === 0 });
  H.fbox(F, h.mb[0] - x0, h.mb[1] - x0, Y0 + 1.15, Y0 + 1.55, 0, 0.24, sub ? '#1e2a3a' : '#2a2a2a');
  H.fbox(F, h.mb[0] - x0 - 0.02, h.mb[1] - x0 + 0.02, Y0 + 1.55, Y0 + 1.6, 0, 0.27, '#4a5a6a', { ol: false });
  if (sub) H.fbox(F, h.mb[1] - x0 - 0.03, h.mb[1] - x0 + 0.02, Y0 + 1.45, Y0 + 1.82, 0.16, 0.22, '#e03030', { ol: false }); // the red flag: a subscriber
  const w0 = h.win[0] - x0, w1 = h.win[1] - x0;
  H.fbox(F, w0 - 0.14, w1 + 0.14, Y0 + 0.85, Y0 + 2.72, 0, 0.05, cc); H.fbox(F, w0 - 0.2, w1 + 0.2, Y0 + 0.78, Y0 + 0.9, 0, 0.2, cc, { ol: false });
  if (board) H.fbox(F, w0 - 0.05, w1 + 0.05, Y0 + 0.92, Y0 + 2.62, 0.05, 0.09, '#b08a5a'); // plywood: nothing to break
  SG.add(F, dm, Y0 + 2.56, 0.62, 0.26, 0.1, (g, w, hh) => sText(g, String(h.num), w / 2, hh / 2, w * 0.9, hh * 0.8, SERIF, '#e8c870', { weight: 'bold' }));
  if (sub) SG.add(F, (h.mb[0] + h.mb[1]) / 2 - x0, Y0 + 1.22, 0.34, 0.15, 0.26, (g, w, hh) => { g.fillStyle = '#ffd23c'; g.fillRect(0, 0, w, hh); sText(g, 'SUN', w / 2, hh / 2, w * 0.86, hh * 0.84, SANS, '#14101f', { weight: '900' }); });
  // the row's end walls (first / last house of a block): common brick with a few windows, like a real Baltimore end-of-group
  for (const [end, Fs] of [[h.i % 7 === 0, H.frame(x0, FZ - 9, x0, FZ)], [h.i % 7 === 6, H.frame(x1, FZ, x1, FZ - 9)]]) { if (!end) continue;
    H.fbox(Fs, 0, 9, Y0, Y0 + ht, 0, 0.04, '#8a4a3a', { ol: false }); H.fbox(Fs, -0.02, 9.02, Y0 + ht - 0.4, Y0 + ht, 0, 0.2, cc, { ol: false });
    H.windows(Fs, 1.2, 8.2, Y0 + 3.0, Y0 + ht - 0.75, { bw: 2.4, fh: 2.9, ww: 0.7, wh: 1.4, pane: '#22262c', head: '#d8cfb8', sill: '#d8cfb8', lit: 0, pd: 0.07 }); }
  h.board = board; h.ht = ht;
}
function buildStreet() {
  if (STREET) { scene.remove(STREET); STREET.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  CB = new CMB(); DB = new CMB(); GB = new CMB(); COLL.length = 0; BLD.length = 0; LAMPS.length = 0;
  const root = new THREE.Group(); SEED = 4242;
  // ground: road, sidewalks + curbs, cross streets, crosswalks, the far side park strip, the bonus plaza
  const X0 = -40, X1 = BX1 + 60, Lx = PB.L;
  GB.floorSub(X0, CURBZ, X1, ROADZ1, 0, T.road, '#fff', 4, 8);
  const walkRuns = []; { let x = X0; for (const s of XST) { walkRuns.push([x, s.x0]); x = s.x1; } walkRuns.push([XST[3].x1, X1]); }
  for (const [a, b] of walkRuns) { if (b <= a) continue;
    const pave = a > PB.L ? T.pave : T.walk; // the bonus plaza is brick
    GB.floorSub(a, FZ - 0.01, b, CURBZ, CURB, pave, '#fff', 3, 8); CB.wall(a, CURBZ, b, CURBZ, 0, CURB, T.white, '#8a8478');
    GB.floorSub(a, ROADZ1, b, FARZ1, CURB, T.walk, '#fff', 3, 8); CB.wall(b, ROADZ1, a, ROADZ1, 0, CURB, T.white, '#8a8478');
    GB.floorSub(a, FARZ1, b, 40, CURB, T.grass, '#fff', 4, 10);
    GB.floorSub(a, -60, b, FZ, CURB, T.walk, '#cfcac0', 4, 16); } // the back alleys / yards (mostly hidden behind the rows)
  for (const s of XST) { GB.floorSub(s.x0, -60, s.x1, CURBZ, 0.005, T.road, '#fff', 4, 8); GB.floorSub(s.x0, ROADZ1, s.x1, 40, 0.005, T.road, '#fff', 4, 8);
    for (let z = CURBZ + 0.6; z < ROADZ1 - 0.4; z += 1.0) CB.box(s.x0 + 1.2, 0, z, s.x0 + 3.4, 0.02, z + 0.5, '#ece8dc', T.white, {}); // zebra crossing
    for (let z = CURBZ + 0.6; z < ROADZ1 - 0.4; z += 1.0) CB.box(s.x1 - 3.4, 0, z, s.x1 - 1.2, 0.02, z + 0.5, '#ece8dc', T.white, {}); }
  for (let x = X0; x < X1; x += 6) if (!XST.some((s) => x > s.x0 - 3 && x < s.x1)) CB.box(x, 0, 3.42, x + 3, 0.02, 3.58, '#f0c840', T.white, {}); // centre dashes
  // houses (HB kit: one toon mesh + one ink hull + one sign atlas) and the breakable windows
  LMR(777); const H = new HB(), SG = new SA();
  for (const h of HOUSES) houseFront(H, SG, h);
  const hg = H.build(); root.add(hg); if (SG.items.length) root.add(SG.build());
  for (const h of HOUSES) { h.glass = null; if (h.board) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(h.win[1] - h.win[0], 1.68), h.broken ? BROKEN_M : GLASS_M); m.position.set((h.win[0] + h.win[1]) / 2, CURB + 1.76, FZ + 0.07); m.receiveShadow = true; root.add(m); h.glass = m; }
  // corner stores: the Toad City building() with storefronts + its real-name shop signs, and the rows behind (generic city blocks)
  for (const l of LOTS) if (l.k === 'store') building(l.x0, FZ - 9, l.x1, FZ, 2, [0, 2, 5, 1][l.sign % 4], { shops: ['s', 'e'], sign: l.sign, v: 1 });
  // before the route and along the bonus plaza: more Toad City blocks (storefronts on the street side), leaving room for Fells Point
  building(X0, FZ - 12, XST.length ? -14 : -2, FZ, 3, 3, { shops: ['s', 'e'], sign: 6, v: 1 }); building(-12, FZ - 10, -0.4, FZ - 1.5, 2, 4, { shops: ['s', 'e'], sign: 2, v: 0 });
  SEED = 31; for (let x = XST[3].x1 + 1; x < X1; x += 16) { if (x + 15 > BX0 + 58 && x < BX0 + 82) continue; building(x, FZ - 14, x + 15, FZ - 2.5, 2 + Math.floor(srnd() * 3), Math.floor(srnd() * 6), { shops: ['s'], sign: Math.floor(srnd() * 8), v: srnd() < 0.5 ? 1 : 0 }); }
  SEED = 99; for (let x = X0; x < X1; x += 27) { if (XST.some((s) => x < s.x1 && x + 24 > s.x0)) continue; if (x + 24 > BX0 + 50 && x < BX0 + 92) continue;
    building(x, -52, x + 24, -32, 3 + Math.floor(srnd() * 6), Math.floor(srnd() * 6), { ac: true, tower: srnd() < 0.3 ? [0.5, 0.5] : null }); }
  // street furniture: lamps, traffic lights at every corner (colliders kept for the ride), Fort Ave street blades
  LAMPC.length = 0;
  for (let x = 2; x < X1; x += 14) if (!XST.some((s) => x > s.x0 - 1.5 && x < s.x1 + 1.5)) { lampAt(x, CURBZ - 0.55, 0); LAMPC.push([x, CURBZ - 0.55]); }
  for (let x = 8; x < X1; x += 18) if (!XST.some((s) => x > s.x0 - 1.5 && x < s.x1 + 1.5)) lampAt(x, ROADZ1 + 0.6, Math.PI);
  for (const s of XST) { trafficLight(s.x0 - 0.8, CURBZ - 0.6, 0); LAMPC.push([s.x0 - 0.8, CURBZ - 0.6]); trafficLight(s.x1 + 0.8, ROADZ1 + 0.6, Math.PI); }
  root.add(CB.build(CITY_MAT, { cast: true }), GB.build(CITY_MAT), DB.build(DECAL_MAT));
  // street-name blades (Fort Ave + the cross streets)
  const SN = new SA();
  for (const s of XST) { const x = s.x0 - 0.8, z = CURBZ - 0.6;
    SN.at(x - 0.02, CURB + 3.2, z + 0.08, 0, 2.1, 0.42, (g, w, hh) => { g.fillStyle = '#1f6a3a'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#f2efe6'; g.lineWidth = hh * 0.06; g.strokeRect(hh * 0.07, hh * 0.07, w - hh * 0.14, hh - hh * 0.14); sText(g, 'E FORT AVE', w / 2, hh / 2, w * 0.86, hh * 0.62, SANS, '#f2efe6'); });
    SN.at(x + 0.1, CURB + 3.7, z, -Math.PI / 2, 2.1, 0.42, (g, w, hh) => { g.fillStyle = '#1f6a3a'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#f2efe6'; g.lineWidth = hh * 0.06; g.strokeRect(hh * 0.07, hh * 0.07, w - hh * 0.14, hh - hh * 0.14); sText(g, s.name, w / 2, hh / 2, w * 0.86, hh * 0.62, SANS, '#f2efe6'); }); }
  root.add(SN.build());
  // landmarks: Fells Point's Thames St block closes the bonus course, the World Trade Center on the skyline (real signage, copied builders)
  if (!buildStreet.lm) { const fells = lmMake('fells'); fells.position.set(BX0 + 70 - 150, 0, -10.4 - (-52)); const wtc = lmMake('wtc'); wtc.position.set(Lx * 0.62 + 12, 0, -86 + 22.5);
    buildStreet.lm = [fells, wtc]; }
  for (const g of buildStreet.lm) scene.add(g);
  root.traverse((o) => { if (o.isMesh && o.material === CITY_MAT) o.receiveShadow = true; });
  scene.add(root); STREET = root;
}

// ---------------- the hero rider: Harold (Toad City's rig) on a BMX built from the same toon parts ----------------
const RIDER = new THREE.Group(); scene.add(RIDER);
const BIKE = new THREE.Group(); RIDER.add(BIKE);
const HAROLD = buildHero(); RIDER.add(HAROLD.root); HAROLD.swR.scale.setScalar(0.001); // no cane on the route (the merged rig skins it to swR)
{ const pm = toonMat(); BIKE.userData.mat = pm; const FR = '#ff3d6e', CH = '#c8c8d0', BK = '#1a1a20';
  const tube = (ax, ay, bx, by, r, col) => { const L = Math.hypot(bx - ax, by - ay), g = G.cyl(r, r, L, 6); g.rotateZ(Math.atan2(bx - ax, by - ay) * -1); part(BIKE, g, col, (ax + bx) / 2, (ay + by) / 2, 0); };
  tube(-0.5, 0.33, 0.08, 0.36, 0.035, FR); tube(0.08, 0.36, 0.46, 0.78, 0.035, FR); tube(-0.1, 0.72, 0.46, 0.76, 0.035, FR); tube(-0.1, 0.72, 0.08, 0.36, 0.035, FR); tube(-0.5, 0.33, -0.1, 0.72, 0.03, FR);
  tube(0.46, 0.78, 0.55, 0.33, 0.03, CH); tube(0.46, 0.76, 0.42, 1.02, 0.03, CH);
  { const g = G.cyl(0.025, 0.025, 0.62, 6); g.rotateX(Math.PI / 2); part(BIKE, g, BK, 0.42, 1.04, 0); }
  for (const s of [-1, 1]) { const g = G.cyl(0.035, 0.035, 0.12, 6); g.rotateX(Math.PI / 2); part(BIKE, g, '#ffd23c', 0.42, 1.04, s * 0.32); }
  part(BIKE, G.box(0.3, 0.07, 0.14), BK, -0.12, 0.79, 0);
  part(BIKE, G.box(0.36, 0.2, 0.4), '#8a5a2a', 0.66, 0.92, 0); // the front paper basket
  for (const k of [0, 1]) part(BIKE, G.cyl(0.06, 0.06, 0.36, 8), '#efe9d8', 0.66, 1.05 + k * 0.03, -0.09 + k * 0.17, { rot: [Math.PI / 2, 0, 0] });
  const wheel = (x) => { const w = new THREE.Group(); w.userData.mat = pm; w.position.set(x, 0.33, 0); BIKE.add(w);
    part(w, G.tor(0.3, 0.045), BK); part(w, G.tor(0.26, 0.012), CH, 0, 0, 0, { outline: false });
    for (let k = 0; k < 4; k++) part(w, G.box(0.02, 0.52, 0.015), CH, 0, 0, 0, { rot: [0, 0, k * Math.PI / 4], outline: false });
    { const g = G.cyl(0.05, 0.05, 0.1, 8); g.rotateX(Math.PI / 2); part(w, g, '#ffd23c'); } return w; };
  BIKE.userData.wF = wheel(0.55); BIKE.userData.wR = wheel(-0.5);
  // Harold's canvas paper bag over the shoulder
  part(HAROLD.torso, G.box(0.16, 0.36, 0.42), '#e8dcc0', -0.36, 0.12, 0.0); part(HAROLD.torso, G.box(0.04, 0.62, 0.05), '#8a6a3a', -0.12, 0.38, 0.12, { rot: [0, 0, 0.75] });
  part(HAROLD.torso, G.box(0.12, 0.1, 0.36), '#d23a3a', -0.38, 0.32, 0, { outline: false });
  // the paper in hand during a throw
  const pp = G.cyl(0.06, 0.06, 0.34, 8); HAROLD.handPaper = part(HAROLD.haL, pp, '#efe9d8', 0, -0.06, 0.06, { rot: [Math.PI / 2, 0, 0] }); HAROLD.handPaper.visible = false;
  mergeParts(BIKE);
}
HAROLD.root.position.set(-0.08, 0.42, 0); HAROLD.root.rotation.y = Math.PI / 2;

// ---------------- dynamic things: papers, cars, hon ladies, dogs, arabber cart, pigeons, potholes, bundles ----------------
const DYN = new THREE.Group(); scene.add(DYN);
const PAPERS = [];
const PAPER_MAT = toonMat();
for (let i = 0; i < 10; i++) { const g = new THREE.Group(); g.userData.mat = PAPER_MAT; part(g, G.cyl(0.075, 0.075, 0.42, 8), '#efe9d8', 0, 0, 0, { rot: [0, 0, Math.PI / 2] }); part(g, G.cyl(0.08, 0.08, 0.06, 8), '#d23a3a', 0, 0, 0, { outline: false, rot: [0, 0, Math.PI / 2] });
  mergeParts(g); g.visible = false; scene.add(g); PAPERS.push({ g, on: false, v: new THREE.Vector3(), spent: false, rest: 0 }); }
const CAR_COLS = [['#a83a4a', '#d8d0c0'], ['#3a5a8a', '#2a3a5a'], ['#d8a830', '#d8a830'], ['#5a7a4a', '#d8d0c0'], ['#7a3a7a', '#d8d0c0'], ['#e8e4dc', '#3a3a40'], ['#2a2a30', '#2a2a30']];
const CARPOOL = CAR_COLS.map(([b, r]) => kitMesh(() => car(0, 0, Math.PI / 2, b, r)));
const CARS = []; // {g, x, z, vx, vz, len, wid}
function takeCar() { const free = CARPOOL.find((g) => !g.parent || g.parent !== DYN) || kitMesh(() => car(0, 0, Math.PI / 2, '#a83a4a', '#d8d0c0')); if (!CARPOOL.includes(free)) CARPOOL.push(free); DYN.add(free); return free; }
function mkDog(col) {
  const r = new THREE.Group(), b = new THREE.Group(); r.add(b); b.userData.mat = toonMat();
  part(b, G.sph(0.22, 0.2, 0.42), col, 0, 0.5, 0); part(b, G.sph(0.17, 0.16, 0.2), col, 0, 0.68, 0.42); part(b, G.sph(0.09, 0.08, 0.12), '#2a2020', 0, 0.64, 0.6);
  for (const s of [-1, 1]) { part(b, G.box(0.08, 0.16, 0.05), '#3a2a20', s * 0.12, 0.84, 0.36, { rot: [0.3, 0, s * 0.3] }); part(b, G.sph(0.03, 0.03, 0.03), '#14101f', s * 0.08, 0.74, 0.56, { outline: false }); }
  part(b, G.box(0.36, 0.06, 0.07), '#d23a3a', 0, 0.6, 0.3, { outline: false }); // collar
  const legs = []; for (const [x, z] of [[-0.12, 0.26], [0.12, 0.26], [-0.12, -0.26], [0.12, -0.26]]) { const l = new THREE.Group(); l.position.set(x, 0.45, z); l.userData.mat = b.userData.mat; b.add(l); part(l, G.cyl(0.05, 0.04, 0.42, 6), col, 0, -0.2, 0); legs.push(l); }
  const tail = new THREE.Group(); tail.position.set(0, 0.6, -0.4); tail.userData.mat = b.userData.mat; b.add(tail); part(tail, G.cyl(0.03, 0.02, 0.3, 5), col, 0, 0.12, -0.06, { rot: [-0.6, 0, 0] });
  mergeParts(r); return { g: r, legs, tail };
}
function mkArabber() { // a horse-drawn produce cart (Baltimore's arabbers): painted cart, fruit crates, bells rack, a striped umbrella, the driver
  const g = new THREE.Group(), m = toonMat(); g.userData.mat = m;
  const H = new THREE.Group(); H.userData.mat = m; g.add(H); H.position.set(1.6, 0, 0);
  part(H, G.sph(0.32, 0.36, 0.8), '#8a5a3a', 0, 1.25, 0, { rot: [0, Math.PI / 2, 0] }); part(H, G.cap(0.15, 0.55), '#8a5a3a', 0.62, 1.62, 0, { rot: [0, 0, -0.7] }); part(H, G.sph(0.14, 0.15, 0.32), '#8a5a3a', 0.96, 1.85, 0, { rot: [0, Math.PI / 2, 0.4] });
  part(H, G.box(0.5, 0.06, 0.06), '#d23a3a', 0.62, 1.65, 0, { rot: [0, 0, -0.7], outline: false }); part(H, G.sph(0.05, 0.12, 0.2), '#2a1a12', 0.5, 1.95, 0, { outline: false }); // mane + plume
  part(H, G.cone ? G.cone(0.1, 0.3) : G.cyl(0.0, 0.12, 0.3, 6), '#ffd23c', 0.48, 2.12, 0, { outline: false });
  const hl = []; for (const [x, z] of [[0.42, 0.16], [0.42, -0.16], [-0.42, 0.16], [-0.42, -0.16]]) { const l = new THREE.Group(); l.position.set(x, 1.05, z); l.userData.mat = m; H.add(l); part(l, G.cyl(0.07, 0.06, 1.0, 6), '#7a4a2a', 0, -0.5, 0); part(l, G.cyl(0.08, 0.08, 0.08, 6), '#2a2020', 0, -1.0, 0); hl.push(l); }
  const C = new THREE.Group(); C.userData.mat = m; g.add(C); C.position.set(-0.6, 0, 0);
  part(C, G.box(2.0, 0.5, 1.3), '#e8c040', 0, 0.95, 0); part(C, G.box(2.05, 0.12, 1.35), '#2a5aa8', 0, 1.24, 0);
  for (const [x, col] of [[-0.6, '#d82a3a'], [0, '#f0a020'], [0.6, '#68b030']]) { part(C, G.box(0.55, 0.22, 1.1), '#a07040', x, 1.38, 0); for (let k = 0; k < 4; k++) part(C, G.sph(0.11, 0.11, 0.11, 6, 4), col, x + (k % 2 - 0.5) * 0.24, 1.55, (k < 2 ? -0.25 : 0.25), { outline: false }); }
  for (const s of [-1, 1]) { const w = G.tor(0.45, 0.05); part(C, w, '#d82a3a', 0, 0.48, s * 0.7); }
  part(C, G.cyl(0.03, 0.03, 1.6, 6), '#2a2020', -0.8, 2.0, 0); part(C, G.cyl(1.0, 0.0, 0.5, 8), '#e8e4dc', -0.8, 2.9, 0); part(C, G.cyl(1.02, 0.0, 0.5, 4), '#d82a3a', -0.8, 2.92, 0, { outline: false });
  part(C, G.box(0.06, 0.6, 1.0), '#c8a040', 0.85, 1.75, 0, { outline: false }); for (let k = -2; k <= 2; k++) part(C, G.sph(0.06, 0.06, 0.06, 6, 4), '#f0d060', 0.85, 2.05, k * 0.2, { outline: false }); // bells rack
  const D = new THREE.Group(); D.userData.mat = m; C.add(D); D.position.set(0.5, 1.3, 0); // the driver (a simple stand-in figure)
  part(D, G.cap(0.2, 0.35), '#3a6ab0', 0, 0.35, 0); part(D, G.sph(0.17, 0.18, 0.17), '#a07050', 0, 0.82, 0); part(D, G.cyl(0.3, 0.32, 0.05, 10), '#e8d8a0', 0, 0.97, 0); part(D, G.cyl(0.16, 0.18, 0.16, 10), '#e8d8a0', 0, 1.05, 0);
  mergeParts(g); return { g, hl, H };
}
function mkPigeons() { const g = new THREE.Group(), m = toonMat(); g.userData.mat = m; const birds = [];
  for (let i = 0; i < 6; i++) { const b = new THREE.Group(); b.userData.mat = m; g.add(b); b.position.set((i % 3 - 1) * 0.45 + (i > 2 ? 0.2 : 0), 0, (i > 2 ? 0.35 : -0.3));
    part(b, G.sph(0.11, 0.1, 0.16), '#8a8c9a', 0, 0.14, 0); part(b, G.sph(0.07, 0.07, 0.07), '#5a6a7a', 0, 0.25, 0.12); part(b, G.box(0.03, 0.03, 0.05), '#e0a040', 0, 0.24, 0.2, { outline: false });
    part(b, G.box(0.05, 0.05, 0.05), '#6ad0a0', 0, 0.2, 0.09, { outline: false }); for (const s of [-1, 1]) { const w = part(b, G.box(0.18, 0.02, 0.12), '#7a7c8c', s * 0.1, 0.16, -0.02, { outline: false }); w.userData.s = s; }
    b.userData.vy = 0; b.userData.vx = 0; b.userData.vz = 0; b.rotation.y = i * 1.3; birds.push(b); }
  for (const b of birds) { const keep = b.children.filter((c) => c.userData.s); keep.forEach((c) => (c.userData.keep = true)); mergeParts(b); }
  return { g, birds }; }
function mkBundle() { const g = new THREE.Group(); g.userData.mat = toonMat(); for (let k = 0; k < 4; k++) part(g, G.box(0.5, 0.1, 0.36), k % 2 ? '#efe9d8' : '#e2dccb', 0, 0.06 + k * 0.1, 0, { rot: [0, k * 0.12, 0] });
  part(g, G.box(0.06, 0.44, 0.38), '#c8a060', 0, 0.22, 0, { outline: false }); part(g, G.box(0.52, 0.44, 0.06), '#c8a060', 0, 0.22, 0, { outline: false }); return mergeParts(g); }
function mkPothole(r) { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.CircleGeometry(r * 1.12, 12), new THREE.MeshBasicMaterial({ color: INK })), b = new THREE.Mesh(new THREE.CircleGeometry(r, 12), new THREE.MeshLambertMaterial({ color: '#26262a' }));
  for (const m of [a, b]) { m.rotation.x = -Math.PI / 2; g.add(m); } a.position.y = 0.012; b.position.y = 0.02; b.scale.set(1, 0.72, 1); a.scale.set(1, 0.72, 1); return g; }
const CONE_MAT = toonMat(), PROP_MAT = toonMat();
function mkCone() { const g = new THREE.Group(); g.userData.mat = CONE_MAT; part(g, G.cyl(0.04, 0.24, 0.7, 10), '#ff7a1c', 0, 0.35, 0); part(g, G.cyl(0.13, 0.17, 0.12, 10), '#f6f2ea', 0, 0.38, 0, { outline: false }); part(g, G.box(0.5, 0.05, 0.5), '#ff7a1c', 0, 0.03, 0); return mergeParts(g); }
function mkRamp() { // a plywood kicker: a tilted deck on a back wall, yellow grip stripes
  const g = new THREE.Group(); g.userData.mat = PROP_MAT; const L = 2.4, Hh = 0.75, W = 2.2, a = Math.atan2(Hh, L), sl = Math.hypot(L, Hh);
  part(g, G.box(sl, 0.1, W), '#c8a050', L / 2, Hh / 2, 0, { rot: [0, 0, a] }); part(g, G.box(0.12, Hh, W), '#8a6a3a', L - 0.06, Hh / 2, 0);
  for (const s of [-1, 1]) part(g, G.box(L, 0.08, 0.1), '#8a6a3a', L / 2, Hh / 2 - 0.1, s * (W / 2 - 0.05), { rot: [0, 0, a] });
  for (let k = 0.4; k < sl; k += 0.55) part(g, G.box(0.08, 0.02, W - 0.1), '#ffd23c', Math.cos(a) * k, Math.sin(a) * k + 0.07, 0, { rot: [0, 0, a], outline: false });
  return mergeParts(g); }
function mkTarget() { const g = new THREE.Group(); g.userData.mat = toonMat(); part(g, G.cyl(0.05, 0.05, 1.2, 6), '#2a2622', 0, 0.6, 0); const face = new THREE.Group(); face.userData.mat = g.userData.mat; face.position.y = 1.55; g.add(face);
  ['#f6f2ea', '#d82a3a', '#f6f2ea', '#d82a3a'].forEach((c, k) => { const d = G.cyl(0.5 - k * 0.12, 0.5 - k * 0.12, 0.06, 18); d.rotateX(Math.PI / 2); part(face, d, c, 0, 0, k * 0.012, { outline: k === 0 }); }); g.userData.face = face; return mergeParts(g); }

// ---------------- HUD (DOM over the canvas; system fonts only) ----------------
const UI = {}; ['hud', 'hDay', 'hScore', 'hPap', 'hLives', 'hSubs', 'hBar', 'hBarFill', 'hBarMe', 'pops', 'card', 'cardT', 'cardB', 'cardBtn', 'cardBtn2', 'ban', 'joy', 'knob', 'throwB', 'pauseB', 'muteB', 'keys', 'title', 'startB', 'best', 'vign', 'timer', 'say'].forEach((k) => (UI[k] = $(k)));
function setText(el, t) { if (el && el.__t !== t) { el.textContent = t; el.__t = t; } }
const POPS = []; function pop(x, y, z, txt, cls = '') { const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = txt; UI.pops.appendChild(el); POPS.push({ el, p: new THREE.Vector3(x, y, z), t: 0 }); if (POPS.length > 14) { const o = POPS.shift(); o.el.remove(); } }
let banT = 0; function banner(html, d = 1.4) { UI.ban.innerHTML = html; UI.ban.classList.add('on'); banT = d; }
let sayT = 0; function say(who, txt, d = 2.2) { UI.say.innerHTML = '<b>' + who + '</b>' + txt; UI.say.classList.add('on'); sayT = d; }
function vign(c) { UI.vign.style.boxShadow = 'inset 0 0 120px 40px ' + c; UI.vign.style.opacity = '1'; setTimeout(() => (UI.vign.style.opacity = '0'), 160); }

// ---------------- audio: Toad City sfx + paperboy extras + a procedural B-more club loop ----------------
let MUTE = localStorage.getItem('tcpb_mute') === '1', MUS = null;
function tone(type, f0, f1, dur, vol, t0 = 0) { if (!AC || MUTE) return; const t = AC.currentTime + t0, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(SFXBUS); o.start(t); o.stop(t + dur + 0.02); }
function noise(dur, f, q, vol, type = 'bandpass', t0 = 0) { if (!AC || MUTE) return; const t = AC.currentTime + t0, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = NOISE; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(SFXBUS); s.start(t); s.stop(t + dur + 0.02); }
const SND = {
  throw() { if (!MUTE) sfx('swing'); }, thud() { if (!MUTE) sfx('hit'); }, crash() { if (!MUTE) sfx('heavy'); tone('sawtooth', 160, 50, 0.35, 0.14); },
  perfect() { if (!MUTE) sfx('ko'); tone('triangle', 1320, 0, 0.18, 0.08, 0.12); },
  glass() { noise(0.4, 5200, 0.6, 0.3, 'highpass'); for (let k = 0; k < 6; k++) tone('sine', 2400 + Math.random() * 2600, 0, 0.08, 0.05, 0.03 + k * 0.045); },
  bark() { tone('square', 520, 260, 0.09, 0.09); tone('square', 480, 230, 0.1, 0.08, 0.14); }, horn() { tone('sawtooth', 392, 0, 0.32, 0.06); tone('sawtooth', 466, 0, 0.32, 0.05); },
  bell() { tone('sine', 2100, 0, 0.35, 0.08); tone('sine', 2100, 0, 0.35, 0.07, 0.16); }, coo() { noise(0.25, 900, 2, 0.08); tone('sine', 420, 360, 0.18, 0.05, 0.05); },
  pick() { tone('square', 660, 0, 0.06, 0.06); tone('square', 990, 0, 0.1, 0.06, 0.07); }, jump() { if (!MUTE) sfx('jump'); }, hurt() { if (!MUTE) sfx('hurt'); },
};
function music(on) {
  if (!AC) return; if (!on) { if (MUS) { clearInterval(MUS.iv); MUS.g.gain.setTargetAtTime(0, AC.currentTime, 0.1); MUS = null; } return; } if (MUS || MUTE) return;
  const g = AC.createGain(); g.gain.value = 0.0; g.connect(AC.destination); g.gain.setTargetAtTime(0.55, AC.currentTime, 0.4);
  const bpm = 132, st = 60 / bpm / 4; let next = AC.currentTime + 0.1, step = 0;
  const KICK = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0], CLAP = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], BASS = [41, 41, 44, 39];
  const hit = (t, fn) => { try { fn(t); } catch (e) {} };
  const sched = () => { while (next < AC.currentTime + 0.25) { const i = step % 16, bar = Math.floor(step / 16) % 4;
      if (KICK[i]) hit(next, (t) => { const o = AC.createOscillator(), k = AC.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); k.gain.setValueAtTime(0.5, t); k.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(k); k.connect(g); o.start(t); o.stop(t + 0.2); });
      if (CLAP[i]) hit(next, (t) => { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), k = AC.createGain(); s.buffer = NOISE; f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.9; k.gain.setValueAtTime(0.28, t); k.gain.exponentialRampToValueAtTime(0.001, t + 0.12); s.connect(f); f.connect(k); k.connect(g); s.start(t); s.stop(t + 0.14); });
      if (i % 2 === 1) hit(next, (t) => { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), k = AC.createGain(); s.buffer = NOISE; f.type = 'highpass'; f.frequency.value = 7000; k.gain.setValueAtTime(0.07, t); k.gain.exponentialRampToValueAtTime(0.001, t + 0.04); s.connect(f); f.connect(k); k.connect(g); s.start(t); s.stop(t + 0.05); });
      if (i === 0 || i === 6 || i === 10) hit(next, (t) => { const o = AC.createOscillator(), k = AC.createGain(), f = AC.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 440 * Math.pow(2, (BASS[bar] - 69 + 12) / 12); f.type = 'lowpass'; f.frequency.value = 600; k.gain.setValueAtTime(0.12, t); k.gain.exponentialRampToValueAtTime(0.001, t + st * 3); o.connect(f); f.connect(k); k.connect(g); o.start(t); o.stop(t + st * 3.2); });
      if (i === 14 && bar === 3) hit(next, (t) => { const o = AC.createOscillator(), k = AC.createGain(); o.type = 'square'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1175, t + st); k.gain.setValueAtTime(0.03, t); k.gain.exponentialRampToValueAtTime(0.001, t + st * 2); o.connect(k); k.connect(g); o.start(t); o.stop(t + st * 2.1); });
      next += st; step++; } };
  MUS = { g, iv: setInterval(sched, 60) }; sched();
}
function setMute(m) { MUTE = m; localStorage.setItem('tcpb_mute', m ? '1' : '0'); setText(UI.muteB, m ? 'SOUND OFF' : 'SOUND ON'); if (m) music(false); else if (S.mode === 'ride' || S.mode === 'bonus') music(true); }

// ---------------- game state ----------------
const S = { mode: 'title', day: clamp(+(Q.get('day') || 0), 0, 6), score: 0, lives: 3, papers: 10, t: 0, best: +(localStorage.getItem('tcpb_best') || 0),
  r: { x: -10, z: -2.8, y: 0, vy: 0, v: 0, air: false, crash: 0, inv: 0, lean: 0, ph: 0, throwT: 0, pitch: 0, spin: 0 }, stats: null, hs: 0, shake: 0, paused: false, bonus: null };
const OBS = []; // per-day obstacles: {k, g, x, z, r, ...}
function initSubs() { for (const h of HOUSES) { h.sub = false; h.broken = false; } const pick = [0, 1, 3, 4, 6, 8, 9, 11, 14, 15, 17, 19, 21, 22, 24, 26]; for (const i of pick) HOUSES[i].sub = true; }
function subsCount() { return HOUSES.filter((h) => h.sub).length; }
function clearObs() { for (const o of OBS) { if (o.g && o.g.parent) o.g.parent.remove(o.g); } OBS.length = 0; for (const c of CARS) if (c.g.parent) c.g.parent.remove(c.g); CARS.length = 0; for (const p of PAPERS) { p.on = false; p.g.visible = false; } }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function inXst(x, m = 0) { return XST.some((s) => x > s.x0 - m && x < s.x1 + m); }
function spawnDay(d) {
  clearObs(); const R = rng(1000 + d * 77);
  // static curbside props (city kit): bins + hydrants, as obstacles; lamp posts + traffic light poles collide too
  for (const [x, z] of LAMPC) OBS.push({ k: 'prop', g: null, x, z, r: 0.3 });
  for (let x = 6; x < PB.L - 4; x += 9 + R() * 8) { if (inXst(x, 2)) continue; const k = R() < 0.5 ? 'bin' : 'hydrant'; const g = kitMesh(() => (k === 'bin' ? bin(0, 0, ['#22c4b4', '#3a5a3a', '#2a3a6a'][Math.floor(R() * 3)]) : hydrant(0, 0)));
    g.position.set(x, 0, -4.5); DYN.add(g); OBS.push({ k: 'prop', g, x, z: -4.5, r: 0.42 }); }
  for (let x = 52; x < PB.L; x += 70 + R() * 20) { if (inXst(x, 3)) continue; const g = kitMesh(() => tree(0, 0)); g.position.set(x, 0, -4.9); DYN.add(g); OBS.push({ k: 'prop', g, x, z: -4.9, r: 0.4 }); }
  // hon ladies (Mavis's rig): walkers on the sidewalk + a few on their stoops
  const nh = 2 + d; for (let i = 0; i < nh; i++) { const J = buildHero({ wife: true }); J.swR.visible = true; const x = 25 + R() * (PB.L - 40); if (inXst(x, 2)) continue; const walk = R() < 0.65;
    const z = walk ? -6.6 + R() * 2 : FZ + STOOP_D + 0.2; DYN.add(J.root); J.root.position.set(x, CURB, z); J.root.rotation.y = walk ? (R() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : 0;
    OBS.push({ k: 'hon', g: J.root, J, x, z, r: 0.42, vx: walk ? (J.root.rotation.y > 0 ? 1 : -1) * (0.6 + R() * 0.5) : 0, said: false, t: R() * 5 }); }
  // dogs: wait by a stoop, chase when Harold rolls past
  const nd = 1 + Math.floor(d * 0.7); for (let i = 0; i < nd; i++) { const h = HOUSES[3 + Math.floor(R() * (HOUSES.length - 4))]; const D = mkDog(['#a07040', '#3a3030', '#e8dcc0', '#8a8a90'][i % 4]); const x = h.x0 + 3.2, z = -6.9;
    D.g.position.set(x, CURB, z); DYN.add(D.g); OBS.push({ k: 'dog', g: D.g, D, x, z, r: 0.45, st: 'wait', t: 0, hx: x }); }
  // the arabber cart (from Tuesday): slow, in the parking lane
  const na = d >= 1 ? 1 + (d >= 4 ? 1 : 0) : 0; for (let i = 0; i < na; i++) { const A = mkArabber(), x = 40 + i * 90 + R() * 20; A.g.position.set(x, 0, -2.2); DYN.add(A.g); OBS.push({ k: 'arab', g: A.g, A, x, z: -2.2, r: 0.9, len: 2.3, vx: 1.7 + d * 0.12, t: 0, said: 0 }); }
  // pigeons on the sidewalk
  const np = 1 + Math.floor(d / 2); for (let i = 0; i < np; i++) { const P = mkPigeons(), x = 30 + R() * (PB.L - 50); if (inXst(x, 2)) continue; P.g.position.set(x, CURB, -5.8 + R() * 1.2); DYN.add(P.g); OBS.push({ k: 'pig', g: P.g, P, x, z: P.g.position.z, r: 0.75, up: 0 }); }
  // potholes
  const npt = 2 + d; for (let i = 0; i < npt; i++) { const x = 20 + R() * (PB.L - 30); if (inXst(x, 1)) continue; const z = [-1.2, 0.4, 2.2, 5.0][Math.floor(R() * 4)], r = 0.5 + R() * 0.25, g = mkPothole(r); g.position.set(x, 0, z); DYN.add(g); OBS.push({ k: 'hole', g, x, z, r: r * 0.75 }); }
  // paper bundles
  for (const x of [45, 115, 170].slice(0, d >= 5 ? 2 : 3)) { const g = mkBundle(); const z = -5.4; g.position.set(x, CURB, z); DYN.add(g); OBS.push({ k: 'bundle', g, x, z, r: 0.75 }); }
  S.traffic = { d, nextA: 0, nextB: 0.5, cross: XST.map(() => false), R };
}
function spawnCar(z, dir, x, sp) { const g = takeCar(); g.rotation.y = dir > 0 ? 0 : Math.PI; g.position.set(x, 0, z); const o = { k: 'car', g, x, z, vx: dir * sp, vz: 0, half: 2.2, wid: 1.0 }; CARS.push(o); return o; }
function spawnCross(s, dirZ, sp) { const g = takeCar(); g.rotation.y = dirZ > 0 ? -Math.PI / 2 : Math.PI / 2; const x = (s.x0 + s.x1) / 2 + (dirZ > 0 ? -2.2 : 2.2), z = dirZ > 0 ? -30 : 34; g.position.set(x, 0, z); const o = { k: 'car', g, x, z, vx: 0, vz: dirZ * sp, half: 1.0, wid: 2.2, cross: true }; CARS.push(o); }
function trafficStep(dt) {
  const T_ = S.traffic, r = S.r; if (!T_) return; const d = T_.d;
  T_.nextA -= dt; T_.nextB -= dt;
  const dens = 0.55 + d * 0.12;
  if (T_.nextA <= 0) { T_.nextA = (5.5 - d * 0.45) / dens + T_.R() * 2; spawnCar(1.8, 1, r.x + 55 + T_.R() * 20, 2.6 + d * 0.25 + T_.R()); }
  if (T_.nextB <= 0) { T_.nextB = (4.2 - d * 0.35) / dens + T_.R() * 2; spawnCar(5.2, -1, r.x + 75 + T_.R() * 20, 6 + d * 0.5 + T_.R() * 2); }
  XST.forEach((s, i) => { if (T_.cross[i] || S.mode !== 'ride') return; const ahead = s.x0 - r.x; if (ahead < 26 && ahead > 10) { T_.cross[i] = true; if (T_.R() < 0.45 + d * 0.08) spawnCross(s, T_.R() < 0.5 ? 1 : -1, 7 + d * 0.6); } });
  for (let i = CARS.length - 1; i >= 0; i--) { const c = CARS[i];
    if (!c.cross) { const lead = CARS.find((o) => o !== c && !o.cross && o.z === c.z && Math.sign(o.x - c.x) === Math.sign(c.vx) && Math.abs(o.x - c.x) < 7); if (!lead) c.x += c.vx * dt; }
    else c.z += c.vz * dt;
    c.g.position.set(c.x, 0, c.z);
    if (Math.abs(c.x - r.x) > 120 || Math.abs(c.z) > 45) { c.g.parent && c.g.parent.remove(c.g); CARS.splice(i, 1); continue; }
    if (!c.honk && !c.cross && c.vx < 0 && c.x - r.x < 14 && c.x > r.x && Math.abs(c.z - r.z) < 1.4) { c.honk = true; SND.horn(); }
  }
}

// ---------------- input: keys, touch joystick + throw button, the bot ----------------
const KEY = {}; let THROW_Q = 0;
addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); KEY[k] = true; if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if ((k === ' ' || k === 'j' || k === 'enter') && !e.repeat) { if (UI.card.classList.contains('on')) { cardPick(1); } else if (S.mode === 'title') startGame(); else THROW_Q++; }
  if ((k === 'p' || k === 'escape') && !e.repeat) togglePause(); if (k === 'm' && !e.repeat) setMute(!MUTE); });
addEventListener('keyup', (e) => { KEY[e.key.toLowerCase()] = false; });
const JOY = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
function showTouch() { document.body.classList.add('touch'); }
if (TOUCH) showTouch();
UI.joy.addEventListener('pointerdown', (e) => { e.preventDefault(); showTouch(); audioInit(); JOY.id = e.pointerId; const r = UI.joy.getBoundingClientRect(); JOY.cx = r.left + r.width / 2; JOY.cy = r.top + r.height / 2; joyMove(e); UI.joy.setPointerCapture(e.pointerId); });
UI.joy.addEventListener('pointermove', (e) => { if (e.pointerId === JOY.id) joyMove(e); });
const joyEnd = (e) => { if (e.pointerId !== JOY.id) return; JOY.id = null; JOY.x = JOY.y = 0; UI.knob.style.transform = 'translate(-50%,-50%)'; };
UI.joy.addEventListener('pointerup', joyEnd); UI.joy.addEventListener('pointercancel', joyEnd);
function joyMove(e) { const R = UI.joy.clientWidth * 0.36; let dx = e.clientX - JOY.cx, dy = e.clientY - JOY.cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } JOY.x = dx / R; JOY.y = dy / R; UI.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; }
UI.throwB.addEventListener('pointerdown', (e) => { e.preventDefault(); showTouch(); audioInit(); THROW_Q++; UI.throwB.classList.add('dn'); });
UI.throwB.addEventListener('pointerup', () => UI.throwB.classList.remove('dn')); UI.throwB.addEventListener('pointercancel', () => UI.throwB.classList.remove('dn'));
UI.pauseB.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); togglePause(); });
UI.muteB.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); setMute(!MUTE); });
UI.startB.addEventListener('pointerdown', (e) => { e.preventDefault(); audioInit(); startGame(); });
let cardCb = null, cardCb2 = null, cardT = 0;
UI.cardBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); cardPick(1); });
UI.cardBtn2.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); cardPick(2); });
function card(title, body, btn, cb, btn2, cb2) { UI.cardT.innerHTML = title; UI.cardB.innerHTML = body; UI.cardBtn.textContent = btn; cardCb = cb; UI.cardBtn2.style.display = btn2 ? '' : 'none'; if (btn2) UI.cardBtn2.textContent = btn2; cardCb2 = cb2 || null; UI.card.classList.add('on'); cardT = 0; PB.log.push('card:' + title.replace(/<[^>]+>/g, ' ').trim()); }
function cardPick(n) { if (!UI.card.classList.contains('on') || cardT < 0.45) return; const cb = n === 2 ? cardCb2 : cardCb; if (!cb) return; UI.card.classList.remove('on'); cardCb = cardCb2 = null; cb(); }
function togglePause() { if (S.mode !== 'ride' && S.mode !== 'bonus') return; S.paused = !S.paused; document.body.classList.toggle('paused', S.paused); setText(UI.pauseB, S.paused ? 'RESUME' : 'PAUSE'); if (S.paused) music(false); else music(true); }
function readInput() {
  const I = { steer: 0, speed: 0, throw: THROW_Q > 0 }; THROW_Q = 0;
  if (KEY.arrowleft || KEY.a) I.steer -= 1; if (KEY.arrowright || KEY.d) I.steer += 1; if (KEY.arrowup || KEY.w) I.speed += 1; if (KEY.arrowdown || KEY.s) I.speed -= 1;
  if (JOY.id !== null) { if (Math.abs(JOY.x) > 0.18) I.steer += clamp(JOY.x * 1.25, -1, 1); if (Math.abs(JOY.y) > 0.25) I.speed -= clamp(JOY.y * 1.25, -1, 1); }
  // screen mapping: the street runs up-right, houses top-left. LEFT = toward the houses (-z), RIGHT = toward the road (+z), UP = faster
  if (BOTQ) botThink(I);
  I.steer = clamp(I.steer, -1, 1); I.speed = clamp(I.speed, -1, 1); return I;
}

// ---------------- papers ----------------
const GRAV = 14;
function throwPaper() {
  const r = S.r; if (r.throwT > 0 || r.crash > 0) return; if (S.mode === 'ride' && S.papers <= 0) { banner('OUT OF PAPERS!<small>GRAB A BUNDLE</small>', 1.1); SND.hurt(); return; }
  const p = PAPERS.find((q) => !q.on) || PAPERS[0]; p.on = true; p.spent = false; p.rest = 0; p.hit = null; p.g.visible = true;
  p.g.position.set(r.x + 0.15, r.y + 1.3, r.z - 0.3); p.v.set(r.v + 0.6, 3.0, -8.0); p.g.rotation.set(0, 0, 0);
  if (S.mode === 'ride') S.papers--; r.throwT = 0.3; S.stats.thrown++; SND.throw(); PB.log.push('throw');
}
function deliver(h, how, p) { if (!h.sub || h.delivered || h.brokeToday) return false; h.delivered = true; const pts = how === 'mailbox' ? 250 : 100; addScore(pts, p.g.position, how === 'mailbox' ? 'PERFECT! +250' : (how === 'door' ? 'DOOR +100' : 'STOOP +100'), how === 'mailbox' ? 'gold' : '');
  if (how === 'mailbox') { SND.perfect(); spawnSprite(FXT.star, p.g.position.clone(), 1.1, 0.4); S.stats.perfect++; } else SND.thud(); S.stats.delivered++; PB.log.push('deliver:' + h.num + ':' + how); return true; }
function addScore(n, pos, txt, cls) { S.score += n; if (pos) pop(pos.x, pos.y + 0.4, pos.z, txt || '+' + n, cls); }
function smash(h, p) { if (!h.glass || h.broken) return false; h.broken = true; h.glass.material = BROKEN_M; SND.glass(); S.hs = 0.06; S.shake = 0.25;
  spawnSprite(FXT.words[(h.i * 3) % FXT.words.length], p.g.position.clone().add(new THREE.Vector3(0, 0.6, 0.6)), 1.6, 0.6, { kind: 'word', aspect: 2.6 }); shards(p.g.position);
  if (h.sub) { h.brokeToday = true; S.stats.subBroke++; pop(p.g.position.x, p.g.position.y + 0.6, p.g.position.z, 'SUBSCRIBER! CANCEL...', 'bad'); say('HON', 'My window! Cancel my Sun, ya jagoff!'); PB.log.push('subwindow:' + h.num); }
  else { S.stats.smashed++; addScore(100 + S.stats.smashed * 10, p.g.position, 'SMASH! +' + (100 + S.stats.smashed * 10), 'gold'); PB.log.push('smash:' + h.num); }
  return true; }
const SHARDS = []; { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.12, 0.02, 0, 0.03, 0.15, 0], 3)); geo.computeVertexNormals();
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i % 3 ? '#cfe8ff' : '#ffffff', side: THREE.DoubleSide })); m.visible = false; scene.add(m); SHARDS.push({ m, v: new THREE.Vector3(), t: 0 }); } }
function shards(pos) { for (const s of SHARDS) { s.m.visible = true; s.m.position.copy(pos); s.v.set(rnd(-2, 2), rnd(1, 4), rnd(0.5, 4)); s.t = 1.2; } }
function paperStep(p, dt) {
  const g = p.g, P = g.position;
  if (p.rest > 0) { p.rest -= dt; if (p.rest <= 0) { p.on = false; g.visible = false; } return; }
  p.v.y -= GRAV * dt; P.addScaledVector(p.v, dt); g.rotation.y += dt * 14; g.rotation.x += dt * 3;
  const groundY = P.z < CURBZ || P.z > ROADZ1 ? CURB : 0;
  // the house fronts: mailbox / door / window / wall
  if (P.z <= FZ + 0.12 && P.z > FZ - 1 && S.mode === 'ride') {
    const h = HOUSES.find((q) => P.x >= q.x0 && P.x < q.x1); const y = P.y - CURB;
    if (h && !p.spent) {
      if (P.x >= h.mb[0] - 0.12 && P.x <= h.mb[1] + 0.12 && y >= 1.0 && y <= 1.75) { if (!deliver(h, 'mailbox', p)) SND.thud(); }
      else if (P.x >= h.win[0] && P.x <= h.win[1] && y >= 0.85 && y <= 2.65 && h.glass && !h.broken) smash(h, p);
      else if (P.x >= h.door - 0.5 && P.x <= h.door + 0.5 && y >= STOOP_H && y <= 2.7) { if (!deliver(h, 'door', p)) SND.thud(); }
      else SND.thud();
    } else if (!p.spent) SND.thud();
    p.spent = true; P.z = FZ + 0.13; p.v.z = Math.abs(p.v.z) * 0.25; p.v.x *= 0.3; p.v.y = Math.min(p.v.y, 0.5);
  }
  // stoops (three marble steps, deep to shallow)
  if (S.mode === 'ride' && P.z < FZ + STOOP_D && P.z > FZ) { const h = HOUSES.find((q) => P.x >= q.stoop[0] && P.x <= q.stoop[1]);
    if (h) { const step = clamp(Math.ceil((FZ + STOOP_D - P.z) / (STOOP_D / 3)), 1, 3), top = CURB + step * 0.15; if (P.y <= top + 0.05) { P.y = top + 0.06; if (!p.spent) { deliver(h, 'stoop', p) || SND.thud(); p.spent = true; } p.v.set(0, 0, 0); p.rest = 1.4; g.rotation.set(0, 0, 0); return; } } }
  // things on the street
  for (const o of OBS) { if (p.spent) break; const dx = P.x - o.x, dz = P.z - o.z;
    if (o.k === 'dog' && dx * dx + dz * dz < 0.5 && P.y < CURB + 1.0 && o.st !== 'stun') { o.st = 'stun'; o.t = 2.5; addScore(50, P, 'BONK! +50'); SND.bark(); spawnSprite(FXT.dizzy, new THREE.Vector3(o.x, 1.2, o.z), 1.0, 2.0, { depth: true }); p.spent = true; p.v.multiplyScalar(-0.2); }
    else if (o.k === 'hon' && dx * dx + dz * dz < 0.35 && P.y < CURB + 1.9) { addScore(0, P, 'HEY HON!', 'bad'); say('HON', ['Watch it, hon!', 'Ya hit me wit da Sun, hon!', 'Hon, I already read it!'][Math.floor(Math.random() * 3)]); SND.thud(); p.spent = true; p.v.multiplyScalar(-0.2); }
    else if (o.k === 'pig' && !o.up && dx * dx + dz * dz < 1.2 && P.y < CURB + 0.8) { o.up = 1; addScore(25, P, 'COO! +25'); SND.coo(); p.spent = true; }
    else if (o.k === 'arab' && Math.abs(dx - 0.5) < 2.2 && Math.abs(dz) < 0.8 && P.y < 2.4) { addScore(25, P, 'STRAWBERRIES! +25'); SND.thud(); p.spent = true; p.v.multiplyScalar(-0.2); }
    else if (o.k === 'target' && !o.down && Math.abs(dx) < 0.55 && Math.abs(P.z - o.z) < 0.45 && Math.abs(P.y - 1.55) < 0.75) { o.down = true; S.bonus.targets++; addScore(200, P, 'BULLSEYE! +200', 'gold'); SND.perfect(); spawnSprite(FXT.star, P.clone(), 1.0, 0.35); p.spent = true; p.v.multiplyScalar(-0.15); }
  }
  for (const c of CARS) { if (p.spent) break; if (Math.abs(P.x - c.x) < (c.cross ? 1.0 : 2.2) && Math.abs(P.z - c.z) < (c.cross ? 2.2 : 1.0) && P.y < 1.9) { addScore(25, P, 'CLANG! +25'); SND.thud(); p.spent = true; p.v.set(c.vx * 0.5, 2, -p.v.z * 0.3); } }
  if (P.y <= groundY + 0.07) { P.y = groundY + 0.07; if (!p.spent) { p.spent = true; S.stats.missed++; } p.v.set(0, 0, 0); p.rest = 1.0; g.rotation.set(0, g.rotation.y, 0); }
}

// ---------------- the ride ----------------
function riderHits(r) { // anything Harold runs into: returns a reason or null
  const hitC = (x, z, rad) => { const dx = Math.max(Math.abs(r.x - x) - 0.45, 0), dz = r.z - z; return dx * dx + dz * dz < rad * rad; };
  for (const o of OBS) {
    if (o.k === 'bundle' || o.k === 'target' || o.k === 'ramp' || o.k === 'finish') continue;
    if (o.k === 'hole') { if (!r.air && hitC(o.x, o.z, o.r)) return 'POTHOLE!'; continue; }
    if (r.air && r.y > 0.6) continue;
    if (o.k === 'pig') { if (!o.up && hitC(o.x, o.z, o.r)) return 'PIGEONS!'; continue; }
    if (o.k === 'dog' && o.st === 'stun') continue;
    if (o.k === 'arab') { if (Math.abs(r.x - (o.x + 0.5)) < 2.6 && Math.abs(r.z - o.z) < 1.0) return 'ARABBER CART!'; continue; }
    if (hitC(o.x, o.z, o.r + 0.32)) return o.k === 'hon' ? 'HON!' : o.k === 'dog' ? 'DOG!' : o.k === 'cone' ? 'CONE!' : 'OOF!';
  }
  for (const c of CARS) if (Math.abs(r.x - c.x) < c.half + 0.6 && Math.abs(r.z - c.z) < c.wid + 0.25) return 'CAR!';
  // stoops jut onto the sidewalk
  if (S.mode === 'ride' && r.z - 0.3 < FZ + STOOP_D) for (const h of HOUSES) if (r.x + 0.7 > h.stoop[0] && r.x - 0.7 < h.stoop[1]) return 'STOOP!';
  return null;
}
function crash(why) {
  const r = S.r; if (r.crash > 0 || r.inv > 0 || GOD) return; r.crash = 1.7; S.stats.crashes++; SND.crash(); S.hs = 0.12; S.shake = 0.8; vign('rgba(255,40,60,.85)'); banner(why + '<small>' + (S.mode === 'bonus' ? 'BONUS OVER' : 'WIPEOUT') + '</small>', 1.4);
  spawnSprite(FXT.words[1], new THREE.Vector3(r.x, 1.8, r.z), 1.8, 0.7, { kind: 'word', aspect: 2.6 }); spawnSprite(FXT.puff, new THREE.Vector3(r.x, 0.5, r.z), 1.4, 0.5); PB.log.push('crash:' + why + ':' + r.x.toFixed(1) + ':' + r.z.toFixed(1));
  try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
}
function afterCrash() {
  const r = S.r;
  if (S.mode === 'bonus') { endBonus(false); return; }
  S.lives--; if (S.lives <= 0) { gameOver('OUT OF LIVES'); return; }
  r.inv = 2.2; r.v = 2; r.z = clamp(r.z, -6.2, ZMAX); if (r.z < -4.2) r.z = -5.6; // back on the bike
  for (let i = CARS.length - 1; i >= 0; i--) if (Math.abs(CARS[i].x - r.x) < 12) { CARS[i].g.parent && CARS[i].g.parent.remove(CARS[i].g); CARS.splice(i, 1); }
  for (const o of OBS) if (o.k === 'dog' && o.st === 'chase') { o.st = 'stun'; o.t = 3; }
  for (const o of OBS) if (o.k === 'arab' && o.x - r.x > -6 && o.x - r.x < 12) { o.x = r.x + 16; if (Math.abs(r.z - o.z) < 1.6) r.z = o.z - 1.6; }
  banner('LIVES ' + S.lives + '<small>KEEP ROLLING</small>', 1.0);
}
function rideStep(dt, I) {
  const r = S.r, d = S.day, bonus = S.mode === 'bonus';
  r.throwT = Math.max(0, r.throwT - dt); r.inv = Math.max(0, r.inv - dt);
  if (r.crash > 0) { r.crash -= dt; r.v = damp(r.v, 0, 3, dt); r.x += r.v * dt; if (r.crash <= 0) afterCrash(); return; }
  const base = bonus ? 7 : 5.6 + d * 0.22, vT = clamp(base + I.speed * (I.speed > 0 ? 3.2 : 3.6), 2.0, base + 3.2);
  r.v = damp(r.v, vT, I.speed !== 0 ? 2.6 : 1.6, dt);
  r.x += r.v * dt; r.lean = damp(r.lean, I.steer, 6, dt);
  r.z = clamp(r.z + I.steer * 5.2 * dt, bonus ? -6.8 : ZMIN, ZMAX);
  // curb hop + air (ramps in the bonus course)
  const gy = r.z < CURBZ || r.z > ROADZ1 ? CURB : 0; r.ph += dt * r.v * 1.6;
  if (r.air) { r.vy -= 18 * dt; r.y += r.vy * dt; r.spin += dt * 5.5; if (r.y <= gy) { r.y = gy; r.air = false; r.spin = 0; spawnSprite(FXT.puff, new THREE.Vector3(r.x, 0.3, r.z), 0.9, 0.35); SND.thud(); S.shake = 0.2; } }
  else { r.y = damp(r.y, gy, 18, dt); }
  if (I.throw) throwPaper();
  // bundles + ramps
  for (let i = OBS.length - 1; i >= 0; i--) { const o = OBS[i];
    if (o.k === 'bundle' && Math.abs(r.x - o.x) < 0.9 && Math.abs(r.z - o.z) < 0.9) { const n = 10; S.papers = Math.min(30, S.papers + n); pop(o.x, 1.4, o.z, 'PAPERS +' + n, 'gold'); SND.pick(); o.g.parent && o.g.parent.remove(o.g); OBS.splice(i, 1); PB.log.push('bundle'); }
    else if (o.k === 'ramp' && !r.air && r.x > o.x && r.x < o.x + 2.4 && Math.abs(r.z - o.z) < 1.15) { r.air = true; r.vy = 6.2 + r.v * 0.15; r.y = 0.8; SND.jump(); if (!o.used) { o.used = true; S.bonus.ramps++; addScore(100, new THREE.Vector3(r.x, 2, r.z), 'AIR! +100'); } }
  }
  const why = riderHits(r); if (why) crash(why);
}
function obsStep(dt) {
  const r = S.r, t = S.t;
  for (const o of OBS) {
    if (o.k === 'hon') { o.t += dt; if (o.vx) { o.x += o.vx * dt; if (o.x < 4 || o.x > PB.L - 4 || inXst(o.x, 1)) { o.vx *= -1; o.g.rotation.y = o.vx > 0 ? Math.PI / 2 : -Math.PI / 2; } }
      o.g.position.x = o.x; applyPose(o.J, o.vx ? HERO_POSES.run(o.t, 1.6) : HERO_POSES.idle(o.t), 10, dt, false); if (o.vx) { o.J.hips.position.y = o.J.d.hip - 0.02 + Math.abs(Math.sin(o.t * 6)) * 0.03; }
      if (!o.said && Math.abs(o.x - r.x) < 6 && o.x > r.x) { o.said = true; if (Math.random() < 0.6) say('HON', ['Mornin\', hon!', 'Where\'s my Sun, hon?', 'Slow down, hon!', 'Hon, ya paper\'s late!'][Math.floor(Math.random() * 4)], 1.8); } }
    else if (o.k === 'dog') { const D = o.D; o.t -= dt;
      if (o.st === 'wait') { D.tail.rotation.x = Math.sin(t * 12) * 0.5; if (r.x > o.x + 0.5 && r.x < o.x + 4 && Math.abs(r.z - o.z) < 9 && r.crash <= 0 && r.inv <= 0) { o.st = 'chase'; o.t = 3.4; SND.bark(); pop(o.x, 1.2, o.z, 'WOOF!', 'bad'); } }
      else if (o.st === 'chase') { const tx = r.x - 0.2, tz = r.z, dx = tx - o.x, dz = tz - o.z, l = Math.hypot(dx, dz) || 1, sp = 6.5 + S.day * 0.18; o.x += dx / l * sp * dt; o.z += dz / l * sp * dt; o.g.rotation.y = Math.atan2(dx, dz);
        D.legs.forEach((l2, i) => (l2.rotation.x = Math.sin(t * 18 + i * 1.6) * 0.8)); D.tail.rotation.x = Math.sin(t * 20) * 0.6; if (o.t <= 0) { o.st = 'sit'; } if (Math.random() < dt * 1.2) SND.bark(); }
      else if (o.st === 'stun') { D.legs.forEach((l2) => (l2.rotation.x = 0.0)); if (o.t <= 0) o.st = 'sit'; }
      else { D.legs.forEach((l2) => (l2.rotation.x = 0)); }
      o.g.position.set(o.x, o.z < CURBZ ? CURB : 0, o.z); }
    else if (o.k === 'arab') { o.x += o.vx * dt; o.t += dt; o.g.position.x = o.x; o.A.hl.forEach((l2, i) => (l2.rotation.z = Math.sin(o.t * 7 + i * Math.PI / 2) * 0.4)); o.A.H.position.y = Math.abs(Math.sin(o.t * 7)) * 0.05;
      if (o.x > r.x && o.x - r.x < 14 && o.said < 1) { o.said = 1; say('ARABBER', 'STRAWBERRIES! WATERMELLLLON!', 2.2); SND.bell(); } }
    else if (o.k === 'pig') { const P = o.P; if (!o.up && Math.abs(r.x - o.x) < 2.6 && Math.abs(r.z - o.z) < 2.0 && r.v < 5.0) { o.up = 1; SND.coo(); }
      if (o.up) { o.up += dt; P.birds.forEach((b, i) => { b.position.y += dt * (2.5 + i * 0.3); b.position.x += dt * Math.cos(i) * 2; b.position.z += dt * (Math.sin(i * 2) * 2 - 1); b.children.forEach((c) => { if (c.userData.s) c.rotation.z = c.userData.s * Math.sin(t * 40) * 0.9; }); }); if (o.up > 3) o.g.visible = false; }
      else P.birds.forEach((b, i) => { b.rotation.x = Math.max(0, Math.sin(t * 3 + i * 2)) * 0.5; }); }
    else if (o.k === 'target' && o.down) { const f = o.g.userData.face; f.rotation.x = damp(f.rotation.x, -Math.PI / 2, 10, dt); }
    else if (o.k === 'bundle') o.g.rotation.y += dt * 1.5;
  }
}
// ---------------- render the rider ----------------
function riderPose(dt) {
  const r = S.r, J = HAROLD; RIDER.position.set(r.x, r.y, r.z);
  const crashU = r.crash > 0 ? 1 - r.crash / 1.7 : 0;
  RIDER.rotation.set(r.crash > 0 ? 0 : -r.lean * 0.12, -r.lean * 0.22, r.air ? Math.sin(r.spin) * 0.25 : 0);
  BIKE.userData.wF.rotation.z -= r.v * dt / 0.33; BIKE.userData.wR.rotation.z -= r.v * dt / 0.33;
  let p;
  if (r.crash > 0) { p = HERO_POSES.down(crashU, crashU > 0.5); J.root.position.set(-0.08 - crashU * 1.6, 0.42 - crashU * 0.3, -crashU * 0.4); BIKE.rotation.set(Math.min(1.3, crashU * 3), 0, 0); }
  else { J.root.position.set(-0.08, 0.42, 0); BIKE.rotation.set(0, 0, 0);
    p = blank(); const ph = r.ph; p.torso = [0.55, 0, 0]; p.neck = [-0.45, 0, 0];
    p.lgL = [-1.25 - 0.45 * Math.sin(ph), 0, 0.1]; p.knL = [1.55 + 0.4 * Math.sin(ph + 1.3), 0, 0]; p.lgR = [-1.25 - 0.45 * Math.sin(ph + Math.PI), 0, -0.1]; p.knR = [1.55 + 0.4 * Math.sin(ph + Math.PI + 1.3), 0, 0];
    p.shR = [-1.15, 0, -0.15]; p.elR = [-0.35, 0, 0]; p.shL = [-1.15, 0, 0.15]; p.elL = [-0.35, 0, 0]; p.y = -0.36;
    if (r.throwT > 0) { const u = 1 - r.throwT / 0.3; p.shL = [lerp(-2.6, -0.6, ease(u)), 0, lerp(0.4, 1.4, u)]; p.elL = [lerp(-1.4, -0.1, u), 0, 0]; p.torso = [0.4, lerp(-0.5, 0.6, u), 0]; }
    if (r.air) { p.lgL = p.lgR = [-1.0, 0, 0]; p.knL = p.knR = [1.2, 0, 0]; p.shL = [-1.6, 0, 0.6]; } }
  J.handPaper.visible = r.throwT > 0.12;
  applyPose(J, p, r.crash > 0 ? 8 : 18, dt, false);
  // flicker while invulnerable
  RIDER.visible = !(r.inv > 0 && Math.floor(r.inv * 12) % 2 === 0);
}
// ---------------- camera: Paperboy's high angle, the street running up and to the right ----------------
const CAM = { x: 0, z: 0, y: 0, init: false };
function camStep(dt) {
  const r = S.r, port = VH() > VW() * 1.05, bonus = S.mode === 'bonus';
  const fx = r.x + (port ? 6.5 : 6), fz = port ? clamp(r.z * 0.45 - 3.4, -6.5, 0) : clamp(r.z * 0.55 - 4.4, -7, 1);
  if (!CAM.init) { CAM.x = fx; CAM.z = fz; CAM.init = true; }
  CAM.x = damp(CAM.x, fx, 6, dt); CAM.z = damp(CAM.z, fz, 3, dt);
  const off = port ? [-13.5, 17, 9.5] : [-11, 12.5, 15.5], sk = S.shake * 0.35; // portrait: the street runs up the screen, houses on the left
  camera.position.set(CAM.x + off[0] + (Math.random() - 0.5) * sk, off[1] + (Math.random() - 0.5) * sk, CAM.z + off[2]);
  camera.lookAt(CAM.x, 1.2, CAM.z);
  const fov = port ? 64 : 46; if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  SKY.U && window.__sky && window.__sky.position.copy(camera.position);
  sun.target.position.set(r.x + 6, 0, r.z - 3); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 60); sun.target.updateMatrixWorld();
}
function resize() {
  const w = VW(), h = VH(), dpr = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 1.25), lw = Math.round(w * dpr), lh = Math.round(h * dpr);
  renderer.setSize(lw, lh, false); RT.setSize(lw, lh); POST.uniforms.uRes.value.set(lw, lh); POST.uniforms.uHT.value = 5.2 * dpr; camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------------- the flow: title -> day card -> ride -> tally -> bonus -> next day ... -> week complete / game over ----------------
function startGame() {
  if (S.mode !== 'title' && S.mode !== 'over') return; audioInit(); try { AC && AC.resume(); } catch (e) {}
  UI.title.classList.remove('on'); document.body.classList.add('playing');
  S.score = 0; S.lives = 3; S.day = clamp(+(Q.get('day') || 0), 0, 6); initSubs(); PB.log.push('start'); startDay();
}
function startDay() {
  const d = S.day; S.mode = 'card'; for (const h of HOUSES) { h.delivered = false; h.brokeToday = false; h.broken = false; }
  buildStreet(); spawnDay(d); setLight(d === 6 ? 0.55 : d * 0.05);
  S.papers = 10; S.stats = { delivered: 0, perfect: 0, smashed: 0, subBroke: 0, thrown: 0, missed: 0, crashes: 0 };
  Object.assign(S.r, { x: -12, z: -2.6, y: 0, v: 0, crash: 0, inv: 0, air: false, throwT: 0 }); CAM.init = false;
  const subs = subsCount(); PB.log.push('day:' + d);
  card(DAYS[d] + '<small>E FORT AVE · LOCUST POINT</small>', `<p><b>${subs}</b> subscribers on the route · <b>${S.papers}</b> papers in the bag</p><p class="tip">${['Bright houses with the red mailbox flag take the Sun. Mailbox = PERFECT.', 'The arabber is out today. Give the cart room.', 'Dogs chase. A paper on the nose stops them.', 'Pigeons scatter if you slow down (or hit them with a paper).', 'Dark houses: smash a window for a bonus. Never a subscriber\'s!', 'Traffic\'s heavy on Saturdays. Watch the cross streets.', 'Sunday edition. Last day: keep your subscribers.'][d]}</p>`, 'RIDE ▶', () => { S.mode = 'ride'; music(true); banner(DAY3[d] + '<small>GO!</small>', 1.0); SND.bell(); });
}
function endDay() {
  if (S.mode !== 'ride') return; S.mode = 'card'; music(false); const st = S.stats;
  let kept = 0, lost = [], perfectDay = true; for (const h of HOUSES) { if (!h.sub) continue; if (h.delivered && !h.brokeToday) kept++; else { perfectDay = false; lost.push(h); } }
  for (const h of lost) h.sub = false;
  let gained = null; if (perfectDay && kept > 0) { const cand = HOUSES.filter((h) => !h.sub && !h.board); if (cand.length) { gained = cand[(S.day * 5) % cand.length]; gained.sub = true; } S.score += 1000; S.lives = Math.min(5, S.lives + 1); }
  S.score += kept * 50;
  const rows = HOUSES.map((h) => `<i class="${h === gained ? 'n' : lost.includes(h) ? 'x' : h.sub ? 's' : ''}" title="${h.num}"></i>`).join('');
  PB.log.push('tally:' + S.day + ':kept' + kept + ':lost' + lost.length);
  const subs = subsCount();
  if (subs <= 0) { gameOver('EVERY SUBSCRIBER CANCELLED'); return; }
  card(DAYS[S.day] + ' DONE<small>THE TOAD CITY SUN</small>', `<div class="route">${rows}</div>
    <p>Delivered <b>${st.delivered}</b> (${st.perfect} perfect) · Windows smashed <b>${st.smashed}</b></p>
    <p>${lost.length ? `<span class="bad">${lost.length} cancelled</span>` : '<span class="gold">PERFECT DELIVERY! +1000 · +1 LIFE</span>'}${gained ? ' · <span class="gold">NEW SUBSCRIBER: ' + gained.num + '</span>' : ''}</p>
    <p>Subscribers tomorrow: <b>${subs}</b> · Score <b>${S.score.toLocaleString()}</b></p>`, 'BONUS BMX COURSE ▶', startBonus);
}
function startBonus() {
  S.mode = 'card'; clearObs(); S.bonus = { t: 30 - S.day, targets: 0, ramps: 0, done: false };
  const R = rng(5000 + S.day); let x = BX0 + 10;
  while (x < BX1 - 10) { const k = R();
    if (k < 0.34) { const g = mkRamp(), z = [-5.2, -1.0, 3.0][Math.floor(R() * 3)]; g.position.set(x, 0, z); DYN.add(g); OBS.push({ k: 'ramp', g, x, z }); x += 9; }
    else if (k < 0.62) { const g = mkTarget(), z = -8.6; g.position.set(x, 0, z); DYN.add(g); OBS.push({ k: 'target', g, x, z, down: false }); x += 5; }
    else { for (let i = 0; i < 2 + Math.floor(S.day / 3); i++) { const g = mkCone(), z = -6 + R() * 12; g.position.set(x + R() * 3, 0, z); DYN.add(g); OBS.push({ k: 'cone', g, x: g.position.x, z, r: 0.28 }); } x += 7; }
  }
  const fin = new THREE.Group(); fin.userData.mat = toonMat(); part(fin, G.box(0.3, 4.5, 0.3), '#2a2622', 0, 2.25, -7.5); part(fin, G.box(0.3, 4.5, 0.3), '#2a2622', 0, 2.25, 7.5); for (let k = 0; k < 10; k++) part(fin, G.box(0.25, 0.8, 1.5), k % 2 ? '#14101f' : '#f6f2ea', 0, 4.5, -6.75 + k * 1.5, { outline: false });
  fin.position.set(BX1, 0, 0); DYN.add(fin); OBS.push({ k: 'finish', g: fin, x: BX1, z: 0 });
  Object.assign(S.r, { x: BX0 - 6, z: 0, y: 0, v: 3, crash: 0, inv: 0, air: false }); CAM.init = false;
  card('BONUS BMX COURSE<small>THAMES ST · FELLS POINT</small>', `<p>Ramps <b>+100</b> · Targets <b>+200</b> · Finish <b>+1000</b> + time</p><p class="tip">Unlimited papers. One wipeout ends the bonus. ${S.bonus.t}s on the clock.</p>`, 'GO ▶', () => { S.mode = 'bonus'; music(true); SND.bell(); banner('BONUS!<small>' + S.bonus.t + ' SECONDS</small>', 1.0); });
}
function endBonus(finished) {
  if (S.mode !== 'bonus') return; S.mode = 'card'; music(false); const b = S.bonus; let add = 0;
  if (finished) { add = 1000 + Math.ceil(b.t) * 50; S.score += add; SND.perfect(); }
  PB.log.push('bonus:' + (finished ? 'finish' : 'out') + ':' + b.targets + ':' + b.ramps);
  const last = S.day >= 6;
  card(finished ? 'COURSE CLEAR!' : 'BONUS OVER', `<p>Targets <b>${b.targets}</b> · Air <b>${b.ramps}</b>${finished ? ` · Finish <b>+${add}</b>` : ''}</p><p>Score <b>${S.score.toLocaleString()}</b></p>`, last ? 'FINISH THE WEEK ▶' : 'NEXT DAY: ' + DAYS[S.day + 1] + ' ▶', () => { if (last) winWeek(); else { S.day++; startDay(); } });
}
function saveBest() { if (S.score > S.best) { S.best = S.score; localStorage.setItem('tcpb_best', String(S.best)); return true; } return false; }
function winWeek() { S.mode = 'over'; const nb = saveBest(); PB.log.push('win'); SND.perfect(); music(false);
  card('WEEK COMPLETE!<small>HAROLD KEPT THE ROUTE</small>', `<p><b>${subsCount()}</b> subscribers still taking the Sun</p><p>Final score <b>${S.score.toLocaleString()}</b>${nb ? ' · <span class="gold">NEW BEST!</span>' : ' · Best ' + S.best.toLocaleString()}</p>`, 'PLAY AGAIN', () => { S.mode = 'over'; startGame(); }); }
function gameOver(why) { S.mode = 'over'; music(false); const nb = saveBest(); PB.log.push('gameover:' + why);
  card('GAME OVER<small>' + why + '</small>', `<p>Made it to <b>${DAYS[S.day]}</b> · Score <b>${S.score.toLocaleString()}</b>${nb ? ' · <span class="gold">NEW BEST!</span>' : ' · Best ' + S.best.toLocaleString()}</p>`, 'RETRY FROM MONDAY', () => { S.mode = 'over'; startGame(); }); }

// ---------------- HUD update ----------------
function hud() {
  setText(UI.hDay, S.mode === 'bonus' ? 'BONUS' : DAY3[S.day]); setText(UI.hScore, S.score.toLocaleString());
  setText(UI.hPap, S.mode === 'bonus' ? '∞' : String(S.papers)); UI.hPap.parentNode.classList.toggle('low', S.mode === 'ride' && S.papers <= 2);
  setText(UI.hLives, '♥'.repeat(Math.max(0, S.lives))); setText(UI.hSubs, String(subsCount()));
  const u = S.mode === 'bonus' ? clamp((S.r.x - BX0) / (BX1 - BX0), 0, 1) : clamp(S.r.x / ROUTE_END, 0, 1); UI.hBarMe.style.left = (u * 100).toFixed(1) + '%';
  if (S.mode === 'bonus') setText(UI.timer, Math.max(0, Math.ceil(S.bonus.t)) + 's'); UI.timer.style.display = S.mode === 'bonus' ? '' : 'none';
  if (!hud.marks || hud.marksDay !== S.day + ':' + S.mode) { hud.marksDay = S.day + ':' + S.mode; UI.hBar.querySelectorAll('i').forEach((e) => e.remove());
    if (S.mode !== 'bonus') for (const h of HOUSES) if (h.sub) { const e = document.createElement('i'); e.style.left = ((h.x0 + 2.5) / ROUTE_END * 100).toFixed(1) + '%'; e.dataset.h = h.i; UI.hBar.appendChild(e); } hud.marks = true; }
  UI.hBar.querySelectorAll('i').forEach((e) => { const h = HOUSES[+e.dataset.h]; e.className = h.delivered ? 'ok' : h.brokeToday ? 'x' : ''; });
}
const _pv = new THREE.Vector3();
function popsStep(dt) { const w = VW(), h = VH(); for (let i = POPS.length - 1; i >= 0; i--) { const p = POPS[i]; p.t += dt; p.p.y += dt * 0.9; if (p.t > 1.3) { p.el.remove(); POPS.splice(i, 1); continue; }
  _pv.copy(p.p).project(camera); p.el.style.transform = `translate(${((_pv.x * 0.5 + 0.5) * w).toFixed(0)}px, ${((-_pv.y * 0.5 + 0.5) * h).toFixed(0)}px) translate(-50%,-50%) scale(${p.t < 0.12 ? 0.6 + p.t * 4 : 1})`; p.el.style.opacity = p.t > 0.9 ? String(1 - (p.t - 0.9) / 0.4) : '1'; } }

// ---------------- test bot (QA + capture): delivers to subscribers, dodges, takes bundles; ?bot=lose rides into traffic ----------------
const BOTS = { z: -3.4, card: 0 };
function predictLanding(r) { // simulate a throw from here: where does it end up? -> {house, kind}
  const P = new THREE.Vector3(r.x + 0.15, r.y + 1.3, r.z - 0.3), V = new THREE.Vector3(r.v + 0.6, 3.0, -8.0), dt = 1 / 120;
  for (let i = 0; i < 160; i++) { V.y -= GRAV * dt; P.addScaledVector(V, dt);
    if (P.z <= FZ + 0.12) { const h = HOUSES.find((q) => P.x >= q.x0 && P.x < q.x1), y = P.y - CURB; if (!h) return null;
      if (P.x >= h.mb[0] - 0.12 && P.x <= h.mb[1] + 0.12 && y >= 1.0 && y <= 1.75) return { h, k: 'mailbox' };
      if (P.x >= h.win[0] && P.x <= h.win[1] && y >= 0.85 && y <= 2.65) return { h, k: 'window' };
      if (P.x >= h.door - 0.5 && P.x <= h.door + 0.5 && y >= STOOP_H && y <= 2.7) return { h, k: 'door' }; return null; }
    if (P.z < FZ + STOOP_D) { const h = HOUSES.find((q) => P.x >= q.stoop[0] && P.x <= q.stoop[1]); if (h) { const step = clamp(Math.ceil((FZ + STOOP_D - P.z) / (STOOP_D / 3)), 1, 3); if (P.y <= CURB + step * 0.15 + 0.05) return { h, k: 'stoop' }; } }
    if (P.y <= (P.z < CURBZ ? CURB : 0)) return null; }
  return null;
}
function botThink(I) {
  const r = S.r;
  if (UI.card.classList.contains('on')) { BOTS.card += 1 / 60; if (BOTS.card > (FAST ? 0.6 : 1.4)) { BOTS.card = 0; cardPick(1); } return; }
  if (S.mode === 'title') { startGame(); return; }
  if (S.mode !== 'ride' && S.mode !== 'bonus') return;
  if (BOTQ === 'lose') { I.steer = clamp((5.2 - r.z) * 0.8, -1, 1); I.speed = 1; return; }
  // lane choice: candidate z values scored by clearance over the next ~1.6 s
  const cand = S.mode === 'bonus' ? [-5.2, -3, -1, 1, 3, 5] : [-6.6, -5.7, -4.8, -3.4, -2.4, -0.6, 0.8, 3.4];
  const want = S.mode === 'bonus' ? -5.4 : -5.7; // ride the sidewalk: close enough for mailbox PERFECTs
  let best = BOTS.z, bs = -1e9;
  for (const zc of cand) { let s = -Math.abs(zc - want) * 0.6 - Math.abs(zc - r.z) * 0.25;
    for (let k = 0; k <= 8; k++) { const tt = k * 0.2, x = r.x + r.v * tt, z = r.z + clamp(zc - r.z, -4.6 * tt, 4.6 * tt); // where Harold is on the way there
      for (const o of OBS) { if (o.k === 'bundle') { if (Math.abs(o.x - x) < 1 && Math.abs(o.z - z) < 1 && S.papers < 12) s += 4; continue; } if (o.k === 'target' || o.k === 'finish') continue;
        if (o.k === 'ramp') { continue; } if (o.k === 'pig' && o.up) continue; if (o.k === 'dog' && o.st === 'stun') continue;
        const ox = o.x + (o.vx || 0) * tt + (o.k === 'dog' && o.st === 'chase' ? r.v * tt : 0), half = o.k === 'arab' ? 3.0 : 1.2, wid = o.k === 'arab' ? 1.2 : (o.r || 0.5) + 0.9;
        if (Math.abs(ox - x) < half && Math.abs(o.z - z) < wid) s -= 50 / (1 + k); }
      for (const c of CARS) { const cx = c.x + c.vx * tt, cz = c.z + c.vz * tt; if (Math.abs(cx - x) < c.half + 1.4 && Math.abs(cz - z) < c.wid + 0.9) s -= 60 / (1 + k * 0.5); }
      if (S.mode === 'ride' && z - 0.3 < FZ + STOOP_D) s -= 100; }
    if (s > bs) { bs = s; best = zc; } }
  BOTS.z = best; I.steer = clamp((best - r.z) * 1.6, -1, 1);
  const blocked = bs < -20, dog = OBS.some((o) => o.k === 'dog' && o.st === 'chase');
  const pig = OBS.some((o) => o.k === 'pig' && !o.up && o.x > r.x && o.x - r.x < 7 && Math.abs(o.z - r.z) < 1.6);
  I.speed = pig ? -1 : dog ? 1 : blocked ? -1 : (S.mode === 'bonus' ? 0.6 : 0);
  // throw: a predicted hit on an undelivered subscriber, or a dark window when papers are spare
  if (S.mode === 'ride' && r.throwT <= 0 && S.papers > 0) { const L = predictLanding(r);
    if (L) { const spare = S.papers - HOUSES.filter((h) => h.sub && !h.delivered && h.x0 > r.x).length;
      let later = false; if (L.k !== 'mailbox' && L.h.sub) { const sx = r.x; for (const dx of [0.35, 0.7, 1.05]) { r.x = sx + dx; const L2 = predictLanding(r); if (L2 && L2.h === L.h && L2.k === 'mailbox') later = true; } r.x = sx; }
      if (L.h.sub && !L.h.delivered && L.k !== 'window' && !later) I.throw = true; else if (!L.h.sub && L.k === 'window' && !L.h.broken && spare > 2) I.throw = true; } }
  if (S.mode === 'bonus' && r.throwT <= 0) for (const o of OBS) if (o.k === 'target' && !o.down) { const tt = (r.z - 0.3 - o.z) / 8.0, px = r.x + 0.15 + (r.v + 0.6) * tt; if (Math.abs(px - o.x) < 0.35 && tt > 0) I.throw = true; }
}

// ---------------- main loop ----------------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
resize(); initSubs(); buildStreet(); spawnDay(S.day); setLight(0.05); Object.assign(S.r, { x: 12, z: -3.0, v: 0 });
setText(UI.best, S.best ? 'BEST ' + S.best.toLocaleString() : ''); setText(UI.muteB, MUTE ? 'SOUND OFF' : 'SOUND ON');
function frame(now) {
  requestAnimationFrame(frame);
  let rdt = Math.min(0.05, (now - last) / 1000); last = now; fpsAcc += rdt; fpsN++; if (fpsAcc >= 1) { PB.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  PB.frames++;
  if (PB.freeze) rdt = 0; // capture mode: the test advances the sim itself, frames only render
  else { sim(rdt); riderPose(rdt); camStep(rdt); }
  hud(); popsStep(rdt);
  renderer.info.autoReset = false; renderer.info.reset(); renderer.setRenderTarget(RT); renderer.render(scene, camera); PB.calls = renderer.info.render.calls; PB.tris = renderer.info.render.triangles;
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}
function sim(rdt) {
  if (banT > 0 && (banT -= rdt) <= 0) UI.ban.classList.remove('on'); if (sayT > 0 && (sayT -= rdt) <= 0) UI.say.classList.remove('on');
  let dt = rdt; if (S.hs > 0) { S.hs -= rdt; dt = rdt * 0.08; } S.shake = Math.max(0, S.shake - rdt * 2.2);
  const I = readInput();
  if (!S.paused) {
    S.t += dt;
    if (S.mode === 'ride' || S.mode === 'bonus') {
      rideStep(dt, I); obsStep(dt); if (S.mode === 'ride') trafficStep(dt);
      if (S.mode === 'ride' && S.r.x >= ROUTE_END && S.r.crash <= 0) endDay();
      if (S.mode === 'bonus') { S.bonus.t -= dt; if (S.r.x >= BX1 && S.r.crash <= 0) endBonus(true); else if (S.bonus.t <= 0) { banner('TIME!', 1); endBonus(false); } }
    } else if (S.mode === 'title') { const r = S.r; r.v = 4.2; r.x += r.v * dt; r.ph += dt * r.v * 1.6; if (r.x > 120) r.x = 12; obsStep(dt); }
    for (const p of PAPERS) if (p.on) paperStep(p, dt);
    for (const s of SHARDS) if (s.m.visible) { s.t -= dt; s.v.y -= 12 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += dt * 9; s.m.rotation.y += dt * 7; if (s.t <= 0 || s.m.position.y < 0) s.m.visible = false; }
    updateSprites(dt);
  }
  cardT += rdt; PB.simT = (PB.simT || 0) + rdt;
}
// QA: run the simulation forward without rendering (headless Chrome renders with SwiftShader, far below real-device speed)
PB.advance = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { sim(1 / 60); riderPose(1 / 60); camStep(1 / 60); popsStep(1 / 60); } hud(); };
PB.stats = () => ({ mode: S.mode, day: S.day, x: +S.r.x.toFixed(1), z: +S.r.z.toFixed(1), score: S.score, lives: S.lives, papers: S.papers, subs: subsCount(), st: S.stats, card: UI.card.classList.contains('on') ? UI.cardT.textContent : null, fps: PB.fps, err: window.__celErr.n, calls: PB.calls, tris: PB.tris });
requestAnimationFrame(frame);
UI.title.classList.add('on');
PB.S = S; PB.HOUSES = HOUSES; PB.start = startGame; PB.card = cardPick; PB.ready = true;
