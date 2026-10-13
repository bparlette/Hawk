// ======================= BALTIMORE BIKE LIFE (DESIGN.md "Side quest: Baltimore Bike Life: Excitebike-style side-scrolling racer").
// Four courses, one per district (Key Highway, Fells Point, Rowhouse Block, Federal Hill), each with 4 lanes, ramps, mud, bumps, crowd zones, night variants.
//   Throttle is automatic. TURBO = hold B / K (engine HEAT climbs; at 100% the engine stalls on the shoulder until it cools under 45%).
//   LANES = stick up / down (WASD / arrows / pad d-pad). LEAN: hold WHEELIE (R / SPACE) on the ground to pop a wheelie (style meter, crowd zones pay x3; hold it
//   past the limit and you FLIP); in the air R leans back, L (SHIFT / C) leans forward: land flat (match the slope) for a speed boost, nose or tail first and you wipe out.
//   Rides: dirt bike (fast, long wheelies, easy to crash) or 4-wheeler (steady, shrugs off bumps and mud, worse in the air). Fells Point is a 4-wheeler course.
//   Rivals: the WHEELIE KINGS, a friendly crew of original animal riders (Sprocket the Possum, Mudflap the Raccoon, Gravel Gus the Groundhog, leader Mama Diesel the Badger).
//   Beat the featured rider of each course (cross the line first). All four wins = crew jacket + custom bike paint (saved).
// Runs on the boss-duel core (09a: MODE.duel, HUD, RETRY / LEAVE, radio duck). Side quest: no boss clear.
// Rig hook (Opus, optional): window.buildWheelieKing({ THREE, toonMat, outlineMat, kit, id, color }) -> { root, update?(dt, t, st) } (rider only, seated at the bike origin, facing +x).
// Tests: ?bike=1 &bikecourse=0..3 (&bikenight=1, &bikequad=1) &bikeauto=win|lose (also ?duel=bikelife&duelbot=win|lose).
// Entry: ACT "RIDE OUT" at a crew meetup ring in each district (Key Hwy, Federal Hill, Rowhouse Block, Fells Point).
(function () {
  const F = { scene: null, cam: null, title: 'BIKE LIFE', pips: 1,
    hint: '<b>stick</b> lanes · <b>K</b> turbo · <b>SPACE</b> wheelie / lean back · <b>SHIFT</b> lean fwd · <b>E</b> leave',
    labels: { a: '', b: 'TURBO', c: 'LEAVE', l: 'NOSE', r: 'WHEELIE' } };
  const bc = (v, a, b) => Math.max(a, Math.min(b, v)), bl = (a, b, u) => a + (b - a) * u, se = (u) => u * u * (3 - 2 * u);
  const LANE_Z = [-1.5, -0.5, 0.5, 1.5], LANE_W = 1.0;
  const COURSES = [
    { id: 'keyhwy', name: 'KEY HIGHWAY', len: 820, quad: false, rival: 'SPROCKET THE POSSUM', rid: 'sprocket', rcol: '#9a9aa6', rv: 20.0, sky: ['#7ec4ee', '#d8eefb'], gnd: '#3a3a44', seed: 11 },
    { id: 'fells', name: 'FELLS POINT COBBLES', len: 760, quad: true, rival: 'MUDFLAP THE RACCOON', rid: 'mudflap', rcol: '#5a5a62', rv: 19.6, sky: ['#f0a85a', '#fbe4b8'], gnd: '#6a5f58', seed: 23 },
    { id: 'rowhouse', name: 'ROWHOUSE BLOCK', len: 740, quad: false, rival: 'GRAVEL GUS THE GROUNDHOG', rid: 'gus', rcol: '#9a6a3a', rv: 20.6, sky: ['#8ccaf0', '#e6f2fa'], gnd: '#44444c', seed: 37 },
    { id: 'fedhill', name: 'FEDERAL HILL DROP', len: 840, quad: false, rival: 'MAMA DIESEL THE BADGER', rid: 'diesel', rcol: '#3a3a40', rv: 21.4, sky: ['#6ab0e8', '#cfe8f8'], gnd: '#3e3e48', seed: 53, leader: true },
  ];
  const SPOTS = [
    { c: 0, name: 'KEY HIGHWAY RIDE-OUT', x: -70, z: 41 },
    { c: 3, name: 'FEDERAL HILL RIDE-OUT', x: 20, z: 41 },
    { c: 2, name: 'ROWHOUSE BLOCK RIDE-OUT', x: 90, z: 41 },
    { c: 1, name: 'FELLS POINT RIDE-OUT', x: 126, z: -12 },
  ];
  const V = new THREE.Vector3();
  // test params: ?bike=1 [&bikeauto=win|lose] [&bikecourse=N], or the CI boss form ?bikelife=1&bikelifeauto=win (course 0) and ?bikelife1=1&bikelife1auto=... (courses 1-3)
  const BQ = [['bike', 'bikeauto'], ['bikelife', 'bikelifeauto'], ['bikelife0', 'bikelife0auto'], ['bikelife1', 'bikelife1auto'], ['bikelife2', 'bikelife2auto'], ['bikelife3', 'bikelife3auto']];
  function bikeQ() { for (let i = 0; i < BQ.length; i++) if (Q.has(BQ[i][0])) return { on: true, auto: Q.get(BQ[i][1]), course: i >= 2 ? i - 2 : 0 }; return { on: false }; }
  const isNight = () => (typeof NIGHT !== 'undefined' && NIGHT.value > 0.5) || Q.has('bikenight');
  const LS = 'tcb_bike';
  let save = { won: {}, best: {}, jacket: false, paint: false, rides: 0 };
  try { Object.assign(save, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
  const persist = () => { try { localStorage.setItem(LS, JSON.stringify(save)); } catch (e) {} };
  window.__bikelife = { save };
  function rng(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------------- course data ----------------
  function makeCourse(i) {
    const C = COURSES[i], r = rng(C.seed), R = (a, b) => a + r() * (b - a), len = C.len;
    const obs = [], levels = [{ x0: -60, x1: len + 90, h: 0 }], crowd = [];
    const lanes = () => { const n = 1 + Math.floor(r() * 3), l0 = Math.floor(r() * (5 - n)); return [l0, l0 + n - 1]; };
    let x = 70;
    const gapAt = C.id === 'keyhwy' ? len * 0.55 : C.id === 'fedhill' ? len * 0.6 : -1;
    while (x < len - 55) {
      if (gapAt > 0 && x < gapAt && x + 40 > gapAt - 14) x = gapAt - 14; // clear run-up
      if (gapAt > 0 && Math.abs(x - (gapAt - 14)) < 0.5) {
        if (C.id === 'keyhwy') { obs.push({ k: 'ramp', x: gapAt - 7, len: 6, h: 1.5, l0: 0, l1: 3, pier: true }); levels.splice(0, 1, { x0: -60, x1: gapAt, h: 0 }, { x0: gapAt, x1: gapAt + 7.5, h: -6, gap: true }, { x0: gapAt + 7.5, x1: len + 90, h: 0 }); x = gapAt + 22; }
        else { obs.push({ k: 'ramp', x: gapAt - 9, len: 8, h: 1.7, l0: 0, l1: 3, big: true }); levels.splice(0, 1, { x0: -60, x1: gapAt, h: 0 }, { x0: gapAt, x1: len + 90, h: -2.6 }); x = gapAt + 24; }
        continue;
      }
      const roll = r(), ln = lanes();
      if (C.id === 'fells') {
        if (roll < 0.62) { const l = lanes(); for (let k = 0; k < 3; k++) obs.push({ k: 'bump', x: x + k * 3.2, len: 2.4, h: 0.22, l0: l[0], l1: l[1] }); x += R(16, 26); }
        else if (roll < 0.82) { obs.push({ k: 'mud', x, len: R(7, 11), h: 0, l0: ln[0], l1: ln[1] }); x += R(20, 30); }
        else { obs.push({ k: 'ramp', x, len: 4, h: 0.8, l0: ln[0], l1: ln[1] }); x += R(24, 34); }
      } else if (C.id === 'rowhouse') {
        if (roll < 0.6) { obs.push({ k: 'ramp', x, len: 3.6, h: 0.95, l0: ln[0], l1: ln[1], stoop: true }); x += R(22, 34); }
        else if (roll < 0.85) { obs.push({ k: 'mud', x, len: R(6, 10), h: 0, l0: ln[0], l1: ln[1] }); x += R(20, 28); }
        else { obs.push({ k: 'bump', x, len: 2.6, h: 0.25, l0: 0, l1: 3 }); x += R(18, 26); }
      } else {
        if (roll < 0.5) { obs.push({ k: 'ramp', x, len: 5, h: 1.2, l0: ln[0], l1: ln[1] }); x += R(24, 38); }
        else if (roll < 0.82) { obs.push({ k: 'mud', x, len: R(7, 12), h: 0, l0: ln[0], l1: ln[1] }); x += R(22, 32); }
        else { obs.push({ k: 'bump', x, len: 2.6, h: 0.25, l0: ln[0], l1: ln[1] }); x += R(18, 28); }
      }
    }
    // crowd zones: neighbours on the stoops and in the windows
    const nz = C.id === 'rowhouse' ? 5 : C.id === 'fells' ? 3 : 3;
    for (let k = 0; k < nz; k++) { const cx = R(90, len - 90) + k * 0; crowd.push({ x0: cx, x1: cx + R(30, 46) }); }
    crowd.sort((a, b) => a.x0 - b.x0); for (let k = 1; k < crowd.length; k++) if (crowd[k].x0 < crowd[k - 1].x1 + 10) { crowd[k].x0 = crowd[k - 1].x1 + 10; crowd[k].x1 = crowd[k].x0 + 34; }
    return { C, len, obs, levels, crowd, gapAt };
  }
  function levelH(cs, x) { for (const L of cs.levels) if (x >= L.x0 && x < L.x1) return L.h; return 0; }
  function groundAt(cs, x, lane) {
    let h = levelH(cs, x); if (h < -3) return h;
    for (const o of cs.obs) { if (lane < o.l0 || lane > o.l1 || x < o.x - 0.1 || x > o.x + o.len + 0.1) continue;
      if (o.k === 'ramp') { if (x <= o.x + o.len) h += o.h * (x - o.x) / o.len; } else if (o.k === 'bump') { const u = (x - o.x) / o.len; if (u > 0 && u < 1) h += o.h * Math.sin(u * Math.PI); } }
    return h;
  }
  const mudAt = (cs, x, lane) => { for (const o of cs.obs) if (o.k === 'mud' && lane >= o.l0 && lane <= o.l1 && x >= o.x && x <= o.x + o.len) return true; return false; };
  const roughAt = (cs, x, lane) => { for (const o of cs.obs) if (o.k === 'bump' && lane >= o.l0 && lane <= o.l1 && x >= o.x && x <= o.x + o.len) return true; return false; };
  const crowdAt = (cs, x) => { for (const c of cs.crowd) if (x >= c.x0 && x <= c.x1) return true; return false; };

  // ---------------- meshes ----------------
  function skyTex(c0, c1, night) {
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 128; const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128);
    if (night) { gr.addColorStop(0, '#0a0a22'); gr.addColorStop(1, '#3a2a5a'); } else { gr.addColorStop(0, c0); gr.addColorStop(1, c1); }
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128); const t = new THREE.CanvasTexture(cv); return t;
  }
  function buildBike(quad, col) {
    const root = new THREE.Group(), G = DUELS.GEO, K = DUELS.kit();
    if (quad) {
      K.add(G.box(1.5, 0.35, 0.8), col, 0, 0.5, 0).add(G.box(0.7, 0.18, 0.5), '#2a2a30', -0.1, 0.78, 0).add(G.box(0.5, 0.5, 0.7), col, 0.55, 0.7, 0).add(G.cyl(0.02, 0.02, 0.9, 5), '#c8c8d0', 0.7, 1.0, 0, Math.PI / 2, 0, 0)
        .add(G.box(0.18, 0.08, 0.9), '#2a2a30', -0.92, 0.5, 0).add(G.box(0.1, 0.5, 0.5), '#ffd23c', 0.95, 0.65, 0);
    } else {
      K.add(G.box(1.1, 0.14, 0.14), col, 0, 0.62, 0, 0, 0, 0.08).add(G.box(0.14, 0.7, 0.14), col, 0.62, 0.62, 0, 0, 0, -0.35).add(G.box(0.5, 0.2, 0.2), '#2a2a30', -0.15, 0.82, 0)
        .add(G.box(0.34, 0.34, 0.26), '#c8c8d0', 0.05, 0.52, 0).add(G.cyl(0.02, 0.02, 0.7, 5), '#c8c8d0', 0.78, 1.0, 0, Math.PI / 2, 0, 0).add(G.box(0.4, 0.06, 0.2), col, 0.78, 0.9, 0, 0, 0, 0.3).add(G.box(0.5, 0.05, 0.2), col, -0.7, 0.76, 0, 0, 0, 0.18);
    }
    const body = K.mesh(toonMat(), root, 0.005);
    const mkWheel = (r) => { const w = DUELS.kit(); w.add(G.tor(r, r * 0.34, Math.PI * 2, 8, 16), '#1a1a20', 0, 0, 0).add(G.cyl(r * 0.28, r * 0.28, 0.1, 8), '#c8c8d0', 0, 0, 0, Math.PI / 2, 0, 0).add(G.box(r * 1.7, 0.03, 0.04), '#9a9aa6', 0, 0, 0).add(G.box(0.03, r * 1.7, 0.04), '#9a9aa6', 0, 0, 0); return w.mesh(toonMat(), root, 0.004); };
    const wr = quad ? 0.36 : 0.34, wF = mkWheel(wr), wR = mkWheel(wr); wF.position.set(0.78, wr, 0); wR.position.set(-0.78, wr, 0);
    const extra = [];
    if (quad) { const a = mkWheel(wr), b = mkWheel(wr); a.position.set(0.78, wr, 0.55); wF.position.z = -0.55; b.position.set(-0.78, wr, 0.55); wR.position.z = -0.55; extra.push(a, b); }
    return { root, wF, wR, extra, wr, body };
  }
  function buildRival(id, col) { // stand-in animal rider behind buildWheelieKing()
    const G = DUELS.GEO, K = DUELS.kit(), root = new THREE.Group();
    if (typeof window.buildWheelieKing === 'function') { try { const R = window.buildWheelieKing({ THREE, toonMat, outlineMat: typeof outlineMat !== 'undefined' ? outlineMat : null, kit: DUELS.kit, id, color: col }); if (R && R.root) { R.kind = 'rig'; return R; } } catch (e) {} }
    const ear = id === 'sprocket' ? 0.2 : 0.14;
    K.add(G.sph(0.3, 10, 7), col, 0, 0.95, 0, 0, 0, 0, 0.9, 1.25, 0.8).add(G.sph(0.24, 10, 7), col, 0.18, 1.52, 0).add(G.sph(0.12, 8, 6), '#e8d8c0', 0.42, 1.46, 0).add(G.sph(0.04, 5, 4), '#14101f', 0.52, 1.5, 0)
      .add(G.cone(ear, 0.26, 5), col, 0.08, 1.8, -0.1).add(G.cone(ear, 0.26, 5), col, 0.08, 1.8, 0.1).add(G.box(0.12, 0.5, 0.12), col, 0.35, 1.0, 0.18, 0, 0, -0.9).add(G.box(0.12, 0.5, 0.12), col, 0.35, 1.0, -0.18, 0, 0, -0.9)
      .add(G.box(0.16, 0.55, 0.14), col, 0.1, 0.45, 0.12, 0, 0, -0.5).add(G.box(0.16, 0.55, 0.14), col, 0.1, 0.45, -0.12, 0, 0, -0.5).add(G.sph(0.27, 8, 6), '#ffd23c', 0.2, 1.64, 0, 0, 0, 0, 1, 0.5, 1); // helmet cap
    if (id === 'diesel') K.add(G.box(0.3, 0.08, 0.5), '#e8c040', -0.1, 1.15, 0, 0, 0, 0).add(G.box(0.08, 0.5, 0.5), '#e8c040', -0.12, 0.95, 0); // crew jacket flash
    K.mesh(toonMat(), root, 0.005); return { root, kind: 'standin' };
  }
  // ---------------- course scene ----------------
  function buildCourse(i) {
    if (F.cg) { F.scene.remove(F.cg); F.cg.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); F.cg = null; }
    const cs = (F.cs = makeCourse(i)), C = cs.C, G = DUELS.GEO, K = DUELS.kit(), night = F.night, grp = new THREE.Group(), r = rng(C.seed + 7);
    F.cg = grp; F.scene.add(grp);
    const gc = night ? '#22222c' : C.gnd;
    for (const L of cs.levels) if (L.h > -5) K.add(G.box(L.x1 - L.x0, 3, 4.6), gc, (L.x0 + L.x1) / 2, L.h - 1.5, 0);
    for (const L of cs.levels) if (L.h > -5) { for (let x = Math.ceil(L.x0 / 4) * 4; x < L.x1 - 1; x += 4) for (const z of [-1, 0, 1]) { if (x < cs.len + 80) K.add(G.box(1.6, 0.02, 0.07), night ? '#8a8aa0' : '#f2ead0', x, L.h + 0.011, z); } }
    // curbs + sidewalk behind
    for (const L of cs.levels) if (L.h > -5) K.add(G.box(L.x1 - L.x0, 0.35, 1.8), night ? '#3a3a46' : '#9a9aa4', (L.x0 + L.x1) / 2, L.h - 0.15 + 0.17, -3.4).add(G.box(L.x1 - L.x0, 0.3, 0.3), night ? '#4a4a56' : '#c8c8d0', (L.x0 + L.x1) / 2, L.h + 0.15, -2.4);
    // finish arch
    const fx = cs.len; K.add(G.box(0.3, 3.4, 0.3), '#14101f', fx, 1.7, -2.4).add(G.box(0.3, 3.4, 0.3), '#14101f', fx, 1.7, 2.4).add(G.box(0.4, 0.8, 5.2), '#ffffff', fx, 3.6, 0);
    for (let k = 0; k < 10; k++) for (let j = 0; j < 2; j++) if ((k + j) % 2 === 0) K.add(G.box(0.42, 0.4, 0.52), '#14101f', fx, 3.4 + j * 0.4, -2.34 + k * 0.52);
    K.add(G.box(0.05, 0.02, 4.0), '#ffffff', fx, 0.02, 0);
    for (let k = 0; k < 8; k++) K.add(G.box(0.06, 0.02, 0.5), k % 2 ? '#14101f' : '#ffffff', fx + 0.2, 0.025, -1.75 + k * 0.5);
    // obstacles
    for (const o of cs.obs) {
      const zc = (LANE_Z[o.l0] + LANE_Z[o.l1]) / 2, zd = (o.l1 - o.l0 + 1) * LANE_W, h0 = levelH(cs, o.x + 0.1);
      if (o.k === 'ramp') {
        const ang = Math.atan2(o.h, o.len), sl = Math.hypot(o.len, o.h), col = o.stoop ? (night ? '#7a6a5a' : '#c8b8a0') : o.big ? '#ffd23c' : o.pier ? '#8a6a3a' : '#c8a050';
        K.add(G.box(sl, 0.12, zd), col, o.x + o.len / 2, h0 + o.h / 2, zc, 0, 0, ang);
        for (let s = 0; s < 6; s++) { const u = (s + 0.5) / 6, hh = o.h * u; K.add(G.box(o.len / 6, hh, zd * 0.96), night ? '#5a4a3a' : '#8a6a3a', o.x + u * o.len, h0 + hh / 2 - 0.06, zc); }
        K.add(G.box(0.08, 0.5, zd), '#ff7a1a', o.x + o.len, h0 + o.h + 0.2, zc);
      } else if (o.k === 'mud') { K.add(G.box(o.len, 0.05, zd), '#4a3422', o.x + o.len / 2, h0 + 0.025, zc); for (let s = 0; s < 6; s++) K.add(G.sph(0.18, 5, 4), '#5a4430', o.x + r() * o.len, h0 + 0.08, zc + (r() - 0.5) * zd * 0.8, 0, 0, 0, 1.6, 0.3, 1.2); }
      else if (o.k === 'bump') { K.add(G.sph(o.len / 2, 8, 5), C.id === 'fells' ? '#7a6e66' : '#6a6a74', o.x + o.len / 2, h0 - o.len / 2 + o.h * 0.5 + 0.02, zc, 0, 0, 0, 1, o.h / (o.len / 2) * 1.0 + 0.0001, zd / o.len * 1.0 + 0.05); }
    }
    // crowds: neighbours on the sidewalk, bouncing in render via one instanced sprite-less body each (static kit)
    F.crowdXs = [];
    for (const c of cs.crowd) for (let x = c.x0; x < c.x1; x += 1.25) {
      const cc = ['#e85a4a', '#4aa8e8', '#ffd23c', '#8ae85a', '#e87ad8', '#f2ead0'][Math.floor(r() * 6)], zc = -3.0 - r() * 1.3, hh = 0.9 + r() * 0.3;
      K.add(G.cone(0.26, hh, 6), cc, x + r() * 0.4, hh / 2 + 0.2, zc).add(G.sph(0.17, 6, 5), ['#e8c0a0', '#a0704a', '#6a4a30'][Math.floor(r() * 3)], x, hh + 0.38, zc).add(G.box(0.07, 0.5, 0.07), cc, x - 0.22, hh + 0.2, zc, 0, 0, 0.7).add(G.box(0.07, 0.5, 0.07), cc, x + 0.22, hh + 0.2, zc, 0, 0, -0.7);
    }
    // scenery by course
    const bz = -6.5;
    if (C.id === 'fells' || C.id === 'rowhouse') {
      const brick = night ? ['#5a2a24', '#4a2a2a', '#3a2a30'] : ['#a8503a', '#b86a4a', '#8a4a3a'], form = night ? '#6a6a70' : '#b8b8b0';
      for (let x = -20; x < cs.len + 70; x += 5.2) {
        const b = r(), hh = 6 + Math.floor(b * 2) * 1.6, col = C.id === 'rowhouse' && b > 0.55 ? form : brick[Math.floor(r() * 3)];
        K.add(G.box(5.1, hh, 5), col, x, hh / 2, bz).add(G.box(5.2, 0.4, 5.2), night ? '#3a2a2a' : '#6a3a2a', x, hh + 0.2, bz);
        for (let wy = 0; wy < 2; wy++) for (let wx = 0; wx < 2; wx++) K.add(G.box(0.9, 1.3, 0.08), night ? (r() > 0.5 ? '#ffd890' : '#1a1a2a') : '#8ac8e8', x - 1.1 + wx * 2.2, 3 + wy * 2.3, bz + 2.55);
        K.add(G.box(1.2, 2.1, 0.08), '#3a2a20', x, 1.2, bz + 2.55).add(G.box(2.2, 0.3, 1.4), '#c8c8c0', x, 0.15, bz + 3.2); // door + marble stoop
      }
    } else if (C.id === 'keyhwy') {
      for (let x = -20; x < cs.len + 70; x += 14) { const hh = 5 + r() * 4; K.add(G.box(13, hh, 6), night ? '#4a4a5a' : ['#9a8a7a', '#8a7a6a', '#aa9a8a'][Math.floor(r() * 3)], x, hh / 2, bz - 1).add(G.box(13.2, 0.3, 6.2), '#3a3a44', x, hh + 0.15, bz - 1); for (let wx = 0; wx < 4; wx++) K.add(G.box(1.8, 1.2, 0.08), night ? '#ffd890' : '#7ab8d8', x - 4.8 + wx * 3.2, hh * 0.6, bz + 2.05); }
    } else {
      K.add(G.sph(40, 10, 6), night ? '#1a3a2a' : '#5aa04a', cs.gapAt + 40, -34, -26, 0, 0, 0, 2.2, 0.55, 1);
      for (let x = -20; x < cs.len + 70; x += 11) { const hh = 6 + r() * 14; K.add(G.box(9, hh, 6), night ? '#3a3a4e' : ['#8a8a98', '#7a7a8a', '#9a9aa8'][Math.floor(r() * 3)], x, hh / 2 - 2, -22 - r() * 6); }
    }
    // streetlights at night + the harbor on the near side of Key Highway
    for (let x = 10; x < cs.len + 60; x += 22) { K.add(G.cyl(0.05, 0.07, 3.6, 5), '#2a2a30', x, 1.8, -2.5).add(G.sph(0.2, 6, 5), night ? '#ffe090' : '#cfcfcf', x, 3.7, -2.5); }
    F.cgm = K.mesh(toonMat(), grp, 0.006);
    if (C.id === 'keyhwy') { const w = new THREE.Mesh(new THREE.PlaneGeometry(cs.len + 200, 24), new THREE.MeshBasicMaterial({ color: night ? '#0e2040' : '#3a98c0', fog: true })); w.rotation.x = -Math.PI / 2; w.position.set(cs.len / 2, -0.35, 15.2); grp.add(w); }
    const wg = new THREE.Mesh(new THREE.PlaneGeometry(cs.len + 200, 30), new THREE.MeshBasicMaterial({ color: night ? '#0a1a34' : '#2a78a8', fog: true })); wg.rotation.x = -Math.PI / 2; wg.position.set(cs.len / 2, -3.2, 2); grp.add(wg);
    // crowd bob + rivals' bikes live on the scene root so they survive course rebuilds
  }
  F.build = function () {
    const sc = (F.scene = new THREE.Scene()); F.cam = new THREE.PerspectiveCamera(46, VW() / VH(), 0.1, 160);
    F.night = isNight(); sc.fog = new THREE.Fog(F.night ? '#14122a' : '#bcdcf0', 40, 120);
    DUELS.sceneLights(sc, F.night ? '#8a90d0' : '#fff2d8', F.night ? '#1a1a30' : '#4a6a7a', F.night ? 0.9 : 1.25, F.night ? '#aab4ff' : '#fff0d0', F.night ? 0.9 : 1.5, new THREE.Vector3(-0.4, 1, 0.8));
    F.sky = new THREE.Mesh(new THREE.PlaneGeometry(200, 70), new THREE.MeshBasicMaterial({ map: skyTex('#7ec4ee', '#d8eefb', false), fog: false })); F.sky.position.set(0, 18, -50); sc.add(F.sky);
    F.H = buildHero(); sc.add(F.H.root); F.bikes = {}; F.R = [];
    const ui = document.createElement('div'); ui.className = 'bikeui';
    ui.innerHTML = '<div class="trk"><i class="d0"></i><i class="d1"></i><i class="d2"></i><i class="d3"></i><u></u></div><div class="sty"></div><div class="hot"></div>';
    DUELS.hudEl.appendChild(ui); F.ui = { el: ui, trk: ui.querySelector('.trk'), dots: [0, 1, 2, 3].map((k) => ui.querySelector('.d' + k)), sty: ui.querySelector('.sty'), hot: ui.querySelector('.hot') };
    const css = document.createElement('style'); css.textContent = `
      #duel .bikeui { display: none; position: absolute; inset: 0; pointer-events: none; }
      body.duel-bikelife #duel .bikeui { display: block; }
      #duel .bikeui .trk { position: absolute; left: 12px; right: 12px; top: calc(env(safe-area-inset-top, 0px) + 112px); height: 6px; background: #14101f; border: 2px solid #fff; border-radius: 5px; }
      #duel .bikeui .trk i { position: absolute; top: -6px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #14101f; margin-left: -5px; background: #888; }
      #duel .bikeui .trk i.d0 { background: #ffd23c; z-index: 3; } #duel .bikeui .trk i.d1 { background: #ff5a4a; z-index: 2; }
      #duel .bikeui .sty { position: absolute; left: 0; right: 0; top: calc(env(safe-area-inset-top, 0px) + 134px); text-align: center; font-size: 11px; color: #ffd23c; text-shadow: 2px 2px 0 #14101f; }
      #duel .bikeui .hot { position: absolute; left: 0; right: 0; top: 44%; text-align: center; font-size: 14px; color: #ff6a3a; text-shadow: 2px 2px 0 #14101f; opacity: 0; transition: opacity .15s; }
      #duel .bikeui .hot.on { opacity: 1; }`;
    document.head.appendChild(css); F.layout();
  };
  F.layout = function () {
    const port = VH() > VW(); F.port = port; F.cam.fov = port ? 62 : 44; F.cam.updateProjectionMatrix(); F.camZ = port ? 14.5 : 12.5; F.camY = port ? 4.6 : 3.8;
  };
  F.onResize = () => { if (F.cam) F.layout(); };
  function bikeFor(key, quad, col) { const k = key + (quad ? 'q' : 'd'); if (!F.bikes[k]) { const b = buildBike(quad, col); b.root.visible = false; F.scene.add(b.root); F.bikes[k] = b; } return F.bikes[k]; }

  // ---------------- state ----------------
  function reset() {
    const cs = F.cs, C = cs.C, quad = !!(C.quad || Q.has('bikequad')), jacket = save.jacket;
    for (const k in F.bikes) F.bikes[k].root.visible = false;
    const st = (F.st = { t: 0, x: 0, y: 0, vy: 0, v: 0, lane: 2, laneT: 2, z: LANE_Z[2], pitch: 0, air: false, airT: 0, heat: 0, stall: false, wheelie: 0, wheelieHeld: false, crash: 0, crashes: 0, style: 0, score: 0, cdown: 3.2, over: false, done: false, finT: 0, quad, shake: 0, mud: false, myHeld: false, spin: 0, turbo: false, flipped: false, msgT: 0, bumpCd: 0, lastGY: 0, slopeV: 0, wasBoost: 0 });
    F.pb = bikeFor('p', quad, save.paint ? '#ffd23c' : '#e83a2a'); F.pb.root.visible = true;
    st.rivals = [0, 1, 2].map((k) => { const feat = k === 0, id = feat ? C.rid : ['wk1', 'wk2'][k - 1], col = feat ? C.rcol : ['#8a7a9a', '#7a9a8a'][k - 1], rq = quad && k !== 1; const rv = feat ? C.rv : C.rv - 0.5 - k * 0.3;
      const bk = bikeFor('r' + k + C.id, rq, ['#3a8ae8', '#8ae83a', '#e83ad8'][k]); bk.root.visible = true; if (!F.R[k] || F.R[k].cid !== C.id) { if (F.R[k] && F.R[k].rig) bk.root.remove(F.R[k].rig.root); const rig = buildRival(id, col); F.R[k] = { cid: C.id, rig }; bk.root.add(rig.rig ? rig.rig.root : rig.root); F.R[k].rig = rig; if (rig.root.parent !== bk.root) bk.root.add(rig.root); }
      return { k, id, feat, bike: bk, x: -3 - k * 2.2, lane: [1, 0, 3][k], lane2: [1, 0, 3][k], z: LANE_Z[[1, 0, 3][k]], v: 0, y: 0, pitch: 0, base: rv, fin: null, look: 0, name: feat ? C.rival : id === 'wk1' ? 'CREW RIDER' : 'CREW RIDER' }; });
    st.lane = 2; st.laneT = 2; st.x = 0; F.H.root.visible = true; DUELS.bars(1, 0); updateHUD(true); return st;
  }
  function updateHUD(force) {
    const st = F.st, C = F.cs.C; let place = 1; for (const r of st.rivals) if (r.x > st.x) place++;
    DUELS.sub('PLACE ' + place + '/4 · ' + Math.round(st.v * 3.6) + ' KM/H', C.name + (st.quad ? ' · 4-WHEELER' : ' · DIRT BIKE'));
    F.ui.sty.textContent = st.wheelie > 0.2 ? 'WHEELIE ' + st.wheelie.toFixed(1) + 's' + (crowdAt(F.cs, st.x) ? '  CROWD x3!' : '') + '  ' + Math.round(st.style) : (st.score ? 'STYLE ' + Math.round(st.score) : '');
    const W = F.ui.trk.clientWidth || 300; F.ui.dots[0].style.left = (bc(st.x / F.cs.len, 0, 1) * 100) + '%'; F.ui.dots[1].style.left = (bc(st.rivals[0].x / F.cs.len, 0, 1) * 100) + '%'; F.ui.dots[2].style.left = (bc(st.rivals[1].x / F.cs.len, 0, 1) * 100) + '%'; F.ui.dots[3].style.left = (bc(st.rivals[2].x / F.cs.len, 0, 1) * 100) + '%';
    F.ui.hot.classList.toggle('on', st.stall); F.ui.hot.textContent = st.stall ? 'ENGINE OVERHEATED...' : '';
  }
  F.start = function (opts = {}) {
    let ci = F.courseNext != null ? F.courseNext : Q.get('bikecourse') != null ? parseInt(Q.get('bikecourse'), 10) : (bikeQ().course || 0); F.courseNext = null; ci = bc(ci | 0, 0, 3);
    F.night = isNight(); F.scene.fog.color.set(F.night ? '#14122a' : '#bcdcf0'); F.scene.fog.near = 40; F.scene.fog.far = 120;
    buildCourse(ci); const C = F.cs.C; F.sky.material.map = skyTex(C.sky[0], C.sky[1], F.night); F.sky.material.needsUpdate = true; if (!F.night) F.scene.fog.color.set(C.sky[1]);
    reset(); save.rides++; persist();
    DUELS.banner('BALTIMORE BIKE LIFE<small>' + C.name + ' · BEAT ' + C.rival + '</small>', 2.4);
    DUELS.say(C.rival.split(' THE')[0], ['Sunday ride-out! Try to keep up, old timer.', 'Wheelie King rules: ride loud, ride clean.', 'Mud in lane two, friend. Pick your line.', 'Nobody beats Mama Diesel on the hill.'][ci], 3.2);
    F.log = DUELS.log.push('bike:' + C.id + ':' + (F.night ? 'night' : 'day') + ':' + (F.st.quad ? 'quad' : 'dirt'));
  };
  F.retry = function () { reset(); DUELS.banner('NEW START<small>' + F.cs.C.name + '</small>', 1.2); };
  F.exit = function () { persist(); try { dispatchEvent(new CustomEvent('tcb:bike', { detail: { save } })); } catch (e) {} };

  // ---------------- physics ----------------
  function wipe(st, why) {
    if (st.crash > 0) return; st.crash = 1.5; st.crashes++; st.v = Math.min(st.v, 3); st.vy = Math.max(st.vy, 2); st.air = true; st.wheelie = 0; st.spin = 0; st.shake = 0.5; st.stallBy = 0;
    DUELS.hurt(); DUELS.banner(why, 1.1); DUELS.log.push('bike:crash:' + why); try { DUELS.hitSfx('heavy'); } catch (e) {}
  }
  function playerStep(st, dt, I) {
    const cs = F.cs, C = cs.C, quad = st.quad, G = quad ? 27 : 22, V0 = (quad ? 19.6 : 21.0);
    st.t += dt; st.msgT -= dt; st.bumpCd -= dt;
    if (st.cdown > 0) { st.cdown -= dt; if (st.cdown <= 0) DUELS.banner('GO!', 0.7); else if (Math.ceil(st.cdown) !== st.cdn) { st.cdn = Math.ceil(st.cdown); DUELS.banner(String(st.cdn), 0.6); } return; }
    // lanes
    if (I.my > 0.5 && !st.myHeld) { st.laneT = Math.max(0, st.laneT - 1); st.myHeld = true; } else if (I.my < -0.5 && !st.myHeld) { st.laneT = Math.min(3, st.laneT + 1); st.myHeld = true; } else if (Math.abs(I.my) < 0.3) st.myHeld = false;
    st.lane += (st.laneT - st.lane) * Math.min(1, dt * 11); st.z = bl(LANE_Z[0], LANE_Z[3], (st.lane) / 3); const lane = bc(Math.round(st.lane), 0, 3);
    const lean = (I.rh ? 1 : 0) - (I.lh ? 1 : 0), turbo = !!I.bh && !st.stall && st.crash <= 0;
    st.turbo = turbo;
    if (turbo) { st.heat += 0.42 * dt; if (st.heat >= 1) { st.heat = 1; st.stall = true; DUELS.tell('OVERHEATED! COAST UNTIL IT COOLS', 1.4); } } else st.heat = Math.max(0, st.heat - (st.stall ? 0.3 : 0.26) * dt);
    if (st.stall && st.heat < 0.45) { st.stall = false; DUELS.banner('ENGINE BACK', 0.7); }
    DUELS.bars(1 - st.heat, st.x / cs.len);
    const g0 = groundAt(cs, st.x, lane);
    if (st.crash > 0) { // wipe-out: tumble, then back on the wheels
      st.crash -= dt; st.spin += dt * 9; st.pitch = -st.spin * (st.crash > 0.5 ? 1 : 0.4); st.v = Math.max(0, st.v - 14 * dt); if (!st.air) st.y = g0; else { st.vy -= G * dt; st.y += st.vy * dt; if (st.y <= g0) { st.y = g0; st.air = false; st.vy = 0; } }
      st.x += st.v * dt; if (st.crash <= 0) { st.pitch = 0; st.v = Math.max(st.v, 4); st.air = false; st.y = groundAt(cs, st.x, lane); st.spin = 0; }
      return;
    }
    // speed
    st.mud = !st.air && mudAt(cs, st.x, lane); const rough = !st.air && roughAt(cs, st.x, lane);
    let target = V0 * (turbo ? 1.32 : 1) * (st.mud ? (quad ? 0.78 : 0.55) : 1) * (st.wheelie > 0.2 ? 0.97 : 1); if (st.stall) target = 2.5;
    if (!st.air) { st.v += (target - st.v) * Math.min(1, dt * (st.stall ? 0.8 : 1.5)); if (rough && !quad && st.pitch < 0.3) { st.v -= 7 * dt; st.shake = Math.max(st.shake, 0.18); } else if (rough) st.shake = Math.max(st.shake, 0.08); }
    st.x += st.v * dt;
    const gN = groundAt(cs, st.x, lane);
    if (st.y < -2.4 && gN < -3 || st.y < -3.4) { // splash: ride out of the water
      st.x = (cs.gapAt > 0 && st.x < cs.gapAt + 8 ? cs.gapAt + 9 : st.x); st.y = 0; st.vy = 0; st.air = false; st.v = 5; st.pitch = 0; st.crashes++; st.crash = 0; st.wheelie = 0; DUELS.hurt(); DUELS.banner('SPLASH!<small>FISHED OUT, BACK ON THE ROAD</small>', 1.4); DUELS.log.push('bike:splash'); return;
    }
    if (!st.air) {
      if (gN < st.y - 0.25 && gN < g0 - 0.2 || gN < -3) { st.air = true; st.airT = 0; st.vy = bc(st.slopeV, 0, 9); st.wasBoost = 0; }
      else { st.slopeV = (gN - st.y) / Math.max(dt, 1e-3); st.y = gN; }
    }
    if (st.air) {
      st.airT += dt; st.vy -= G * dt; st.y += st.vy * dt; st.pitch += lean * (quad ? 1.5 : 2.3) * dt; st.pitch = bc(st.pitch, -1.9, 1.9);
      if (lean === 0) st.pitch += (0 - st.pitch) * Math.min(1, dt * 0.35); // gentle self-levelling for thumbs
      const gl = groundAt(cs, st.x, lane); if (st.y <= gl && gl > -3 && st.vy <= 0) {
        const sl = bc((gl - groundAt(cs, st.x - 0.7, lane)) / 0.7, -0.7, 0.7), ang = Math.atan(sl); let err = Math.abs(st.pitch - ang); if (st.airT < 0.35) err *= 0.3;
        st.y = gl; st.air = false; st.vy = 0;
        if (err < 0.3) { st.v += st.airT > 0.35 ? 3 : 0; if (st.airT > 0.35) { st.score += 60 * (crowdAt(cs, st.x) ? 3 : 1); DUELS.banner('SMOOTH LANDING!<small>+SPEED</small>', 0.8); try { DUELS.hitSfx('light'); } catch (e) {} } st.pitch = ang; }
        else if (err < 0.65 || (quad && err < 0.9)) { st.v *= 0.82; st.pitch = ang; st.shake = 0.3; DUELS.tell('ROUGH LANDING', 0.6); }
        else wipe(st, st.pitch > ang ? 'TAIL FIRST!' : 'NOSE FIRST!');
      }
    } else {
      const sl = bc((st.y - groundAt(cs, st.x - 0.7, lane)) / 0.7, -0.7, 0.7), ang = Math.atan(sl);
      if (lean > 0 && !st.stall && st.crash <= 0 && st.v > 6) { // wheelie
        st.wheelie += dt; const maxW = quad ? 2.2 : 3.2; st.pitch += ((quad ? 0.55 : 0.8) + ang - st.pitch) * Math.min(1, dt * 7);
        const crowd = crowdAt(cs, st.x); st.style += dt * 40 * (crowd ? 3 : 1); if (st.wheelie > maxW - 0.6) DUELS.tell('TOO HIGH! LET GO!', 0.3);
        if (st.wheelie > maxW) { wipe(st, 'FLIPPED!'); st.pitch = 1.2; st.spin = 0; }
      } else { if (st.wheelie > 0) { const w = st.wheelie; if (w > 0.9) { st.v += Math.min(w, 2.5) * 1.1; st.score += st.style; DUELS.banner('WHEELIE ' + w.toFixed(1) + 's<small>+' + Math.round(st.style) + ' STYLE</small>', 0.8); } st.wheelie = 0; st.style = 0; } st.pitch += (ang - st.pitch) * Math.min(1, dt * 9); }
    }
    // rivals bump
    for (const r of st.rivals) { if (st.bumpCd > 0) break; if (Math.abs(r.x - st.x) < 0.95 && Math.abs(r.z - st.z) < 0.55 && Math.abs(r.y - st.y) < 0.9) {
      st.bumpCd = 0.9; if (st.air || st.pitch > 0.5) { wipe(st, 'BUMPED MID-AIR!'); } else { st.v *= 0.86; r.v *= 0.9; st.shake = 0.2; DUELS.tell('BUMPED!', 0.5); r.laneShift = 1; } } }
    st.shake = Math.max(0, st.shake - dt * 1.5);
  }
  function rivalStep(st, dt, r) {
    const cs = F.cs, quad = r.bike.wr > 0.35 && r.bike.extra.length, started = st.cdown <= 0;
    if (!started) return;
    r.look -= dt; if (r.look <= 0 || r.laneShift) { r.look = 0.5 + Math.random() * 0.3; r.laneShift = 0; let bad = false; for (let d = 2; d < 17; d += 3) if (mudAt(cs, r.x + d, r.lane2)) bad = true;
      if (bad) { const opts = [r.lane2 - 1, r.lane2 + 1].filter((l) => l >= 0 && l <= 3 && !mudAt(cs, r.x + 9, l)); if (opts.length) r.lane2 = opts[Math.floor(Math.random() * opts.length)]; } }
    r.lane += (r.lane2 - r.lane) * Math.min(1, dt * 6); r.z = bl(LANE_Z[0], LANE_Z[3], r.lane / 3); const ln = bc(Math.round(r.lane), 0, 3);
    let tv = r.base * (1 + 0.05 * Math.sin(st.t * 0.8 + r.k * 2)) * (mudAt(cs, r.x, ln) ? (quad ? 0.8 : 0.6) : 1);
    if (!r.feat) { const d = r.x - st.x; if (d < -30) tv *= 1.04; else if (d > 40) tv *= 0.97; } else { const d = r.x - st.x; if (d > 60) tv *= 0.985; } // featured rival keeps a fair, honest pace
    if (r.fin != null) tv = 12; r.v += (tv - r.v) * Math.min(1, dt * 1.4); r.x += r.v * dt;
    let g = groundAt(cs, r.x, ln); if (g < -3) g = r.yHold != null ? r.yHold + 0.6 * Math.sin(Math.min(1, (r.x - (cs.gapAt > 0 ? cs.gapAt : r.x)) / 7) * Math.PI) : 0; else r.yHold = g;
    r.y += (g - r.y) * Math.min(1, dt * 7); const sl = (g - groundAt(cs, r.x - 0.7, ln)) / 0.7; r.pitch += (Math.atan(bc(sl, -0.6, 0.6)) - r.pitch) * Math.min(1, dt * 6);
    if (r.fin == null && r.x >= cs.len) r.fin = st.t;
  }
  F.step = function (dt, I) {
    const st = F.st; if (!st) return; if (st.over) return;
    if (I.c || I.back) { DUELS.exit('leave'); return; }
    playerStep(st, dt, I);
    for (const r of st.rivals) rivalStep(st, dt, r);
    updateHUD();
    if (!st.done && st.x >= F.cs.len) { st.done = true; st.finT = st.t; const feat = st.rivals[0]; let place = 1; for (const r of st.rivals) if (r.fin != null) place++;
      st.place = place; if (feat.fin != null) { st.over = true; DUELS.over('lose', 'BEATEN TO THE LINE', feat.name + ' crossed first. You were ' + ['', '1st', '2nd', '3rd', '4th'][place] + ' of 4. ' + st.crashes + ' wipe-out' + (st.crashes === 1 ? '' : 's') + '.'); }
      else win(st, place); }
    else if (!st.done && st.rivals[0].fin != null && !st.over) { st.over = true; DUELS.over('lose', 'RIVAL FINISHED FIRST', st.rivals[0].name + ' took the checkered flag. Keep the engine cool, pick clear lanes, land flat.'); }
  };
  function win(st, place) {
    st.over = true; const C = F.cs.C; save.won[C.id] = true; save.best[C.id] = Math.min(save.best[C.id] || 999, +st.finT.toFixed(2)); let extra = '';
    if (COURSES.every((c) => save.won[c.id]) && !save.jacket) { save.jacket = true; save.paint = true; extra = ' ALL FOUR COURSES: CREW JACKET + GOLD PAINT JOB UNLOCKED!'; }
    persist(); try { CITY.log.push('bike:win:' + C.id); } catch (e) {}
    DUELS.log.push('bike:win:' + C.id + ':' + place);
    DUELS.over('win', 'FIRST ACROSS THE LINE!', C.rival + ' ate your dust. ' + ['', '1st', '2nd', '3rd'][place] + ' of 4 in ' + st.finT.toFixed(1) + 's, style ' + Math.round(st.score) + ', ' + st.crashes + ' wipe-out' + (st.crashes === 1 ? '' : 's') + '.' + extra);
  }

  // ---------------- render ----------------
  F.render = function (rdt) {
    const st = F.st; if (!st) return; const t = st.t, cs = F.cs, pb = F.pb;
    const place = (bk, x, y, z, pitch, sp, rid) => { bk.root.position.set(x, y, z); bk.root.rotation.z = pitch; const rs = (sp || 0) * rdt / bk.wr; bk.wF.rotation.z -= rs; bk.wR.rotation.z -= rs; for (const e of bk.extra) e.rotation.z -= rs; };
    place(pb, st.x, st.y, st.z, st.pitch, st.v, null);
    // Harold seated on the bike: use the standing rig, crouched, leaning into the bars
    const H = F.H; H.root.position.set(st.x - 0.1 * Math.cos(st.pitch), st.y + 0.4 + Math.sin(st.pitch) * -0.1, st.z); H.root.rotation.set(0, Math.PI / 2, st.pitch);
    let p = HERO_POSES.idle(t); legsStance(p, 0.5, 0.5); p.torso = [st.crash > 0 ? 0.4 : -0.45, 0, 0]; p.shR = [-1.2, 0, -0.1]; p.shL = [-1.2, 0, 0.1]; p.y = -0.38 + (st.wheelie > 0.1 ? 0.05 : 0); if (st.crash > 0) p = HERO_POSES.hurt ? HERO_POSES.hurt(0.6) : p;
    applyPose(H, p, 16, rdt, false);
    for (const r of st.rivals) { place(r.bike, r.x, r.y, r.z, r.pitch, r.v, r.id); if (r.rig.update) r.rig.update(rdt, t, r); const dy = Math.abs(Math.sin(t * 9 + r.k)) * 0.03; if (r.rig.root) r.rig.root.position.set(-0.05, 0.3 + dy, 0); }
    // camera: side-on, ahead of the player, a little higher in the air; shake on bumps and turbo FOV kick
    const ly = 0.9 + Math.max(0, st.y) * 0.45, lx = st.x + (F.port ? 3.2 : 4.5), sk = st.shake * 0.12;
    F.camX = F.camX == null ? lx : F.camX + (lx - F.camX) * Math.min(1, rdt * 6); F.camLY = F.camLY == null ? ly : F.camLY + (ly - F.camLY) * Math.min(1, rdt * 4);
    F.cam.position.set(F.camX + 0.6 + (Math.random() - 0.5) * sk, F.camY + F.camLY * 0.35 + (Math.random() - 0.5) * sk, F.camZ); F.cam.lookAt(F.camX, F.camLY, 0);
    const fov = (F.port ? 62 : 44) + (st.turbo ? 5 : 0); F.cam.fov += (fov - F.cam.fov) * Math.min(1, rdt * 5); F.cam.updateProjectionMatrix();
    F.sky.position.x = F.camX; OUT_U && OUT_U.fogC && (OUT_U.fogC.value.copy(F.scene.fog.color), OUT_U.fogN.value = 40, OUT_U.fogF.value = 120);
  };

  // ---------------- test bot: win = turbo while cool, clear lanes, wheelie on straights, level in the air; lose = full turbo + wheelie (overheats and flips) ----------------
  F.botThink = function (B, dt) {
    const st = F.st; if (!st || st.over) return; B.mx = 0; B.my = 0; B.bh = false; B.rh = false; B.lh = false;
    const cs = F.cs, mode = B.mode;
    if (mode === 'lose') { B.bh = true; B.rh = true; return; }
    const lane = bc(Math.round(st.lane), 0, 3);
    // lane choice: avoid mud / bumps in the next 22 m
    const bad = (l) => { let b = 0; for (let d = 1; d < 22; d += 2) { if (mudAt(cs, st.x + d, l)) b += 2; if (roughAt(cs, st.x + d, l)) b += 1; } return b; };
    B.ph = (B.ph || 0) + 1; let best = lane, bb = bad(lane); for (const l of [lane - 1, lane + 1]) if (l >= 0 && l <= 3 && bad(l) < bb - 1) { best = l; bb = bad(l); }
    if (best !== st.laneT && B.ph % 2 === 0) B.my = best < st.laneT ? 1 : -1; else B.my = 0;
    B.bh = st.heat < 0.72 && !st.stall && !st.air;
    let nearOb = 99; for (const o of cs.obs) if (o.x > st.x - 2 && o.x - st.x < nearOb && o.l0 <= lane && o.l1 >= lane && o.k !== 'mud') nearOb = o.x - st.x; if (cs.gapAt > 0 && cs.gapAt - st.x > -2 && cs.gapAt - st.x < nearOb) nearOb = cs.gapAt - st.x;
    if (st.air) { const target = 0; if (st.pitch > target + 0.12) B.lh = true; else if (st.pitch < target - 0.12) B.rh = true; }
    else if (nearOb > 24 && st.wheelie < 1.8 && st.v > 8 && !st.stall && st.crash <= 0 && !roughAt(cs, st.x, lane)) B.rh = true;
    // keep a ramp's tilt on takeoff
    if (!st.air && nearOb < 1.5) { B.bh = false; }
  };
  DUELS.reg('bikelife', F);

  // ---------------- city side: a ride-out ring at each district meetup, ACT = RIDE OUT ----------------
  const ringT = canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke(); g.lineWidth = 4; g.setLineDash([10, 9]); g.beginPath(); g.arc(64, 64, 38, 0, TAU); g.stroke(); }, 128);
  const rings = [];
  function setup() {
    for (const sp of SPOTS) {
      const y = groundY(sp.x, sp.z);
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: ringT, color: '#ff9a2a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(sp.x, y + 0.05, sp.z); ring.renderOrder = 2; ring.visible = false; scene.add(ring); rings.push({ ring, sp });
      ACTIONS.push({ kind: 'bike', label: 'RIDE OUT', x: sp.x, z: sp.z, r: 1.7, y: 2.2, ok: () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels') || Q.has('bike')), go: () => { F.courseNext = sp.c; DUELS.start('bikelife'); } });
    }
    window.__bikelife.spots = SPOTS;
  }
  MODE.ticks.push((rdt) => { for (const r of rings) { const d = Math.hypot(r.sp.x - hero.pos.x, r.sp.z - hero.pos.z); r.ring.visible = d < 22 && !DUELS.cur; if (r.ring.visible) { r.ring.rotation.z += rdt * 0.8; r.ring.material.opacity = 0.65 + 0.3 * Math.sin(performance.now() / 300); } } });
  let n = 0; MODE.ticks.push(() => { n++; if (n === 1) setup();
    const bq = bikeQ(); if (n === 3 && bq.on && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = bq.auto; DUELS.start('bikelife', m === 'win' || m === 'lose' ? { bot: m } : {}); } });
})();
