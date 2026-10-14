
// ======================= HARBOR GRAND PRIX: the downtown street race (item j; DESIGN.md "Side quest: Harbor Grand Prix street race", Brad 2026-10-12).
// Nods to the real Grand Prix of Baltimore (2011-13) without any series, team or sponsor branding: original open-wheel racers, a closed loop along
// Pratt Street by the harbor, a turn past Oriole Park, a hairpin by the Convention Center, concrete barriers, catch fencing, grandstands and city blocks.
// A DUELS-core mode (own scene + chase camera): 3 laps against 3 rival racers. Win = take the checkered flag FIRST; any other finish offers RETRY / LEAVE.
// Controls: the car accelerates by itself. STEER with the stick (A / D, arrows, the white pad). BRAKE = K (pad B). BOOST = J (pad A): burns the boost meter
// (it refills as you drive). Corners push you wide in proportion to speed, so brake for the hairpin and steer into the turn; the walls and the grass slow you.
// Entry: ACT "GRAND PRIX" on the Harborplace promenade (locked until 6 bosses are beaten, "GRAND PRIX: CLEAR N MORE BOSSES"). Tests: ?duel=grandprix starts at once;
// &gpauto=win|lose (or &duelbot=) plays it; &gpseed=N. Win is remembered in localStorage (tcb_gp_won) and logged in DUELS.log ('grandprix:win').
// RIG HOOK (procedural stand-in racers until a real rig drops in):  window.buildGrandPrixCar(ctx, i) -> Object3D (front +Z, about 1.6 m wide, 4 m long), i 0 = Harold.
// <GPSIM> ------------------------------------------------------------------------------------------------------------------------------------------
const GPS = (function () {
  const CP = [[-130, 10], [-40, 0], [50, 0], [120, -10], [155, -45], [130, -85], [60, -90], [20, -60], [-30, -45], [-90, -60], [-140, -40], [-155, -10]];
  const HW = 6.5, BW = 9.2, LAT = 9, VMAX = 44, BOOST = 12, LAPS = 3, DSS = 2;
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  let P = []; const n0 = CP.length;
  for (let i = 0; i < n0; i++) { const a = CP[(i + n0 - 1) % n0], b = CP[i], c = CP[(i + 1) % n0], d = CP[(i + 2) % n0]; for (let k = 0; k < 40; k++) { const t = k / 40; P.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t)]); } }
  let tot = 0; const cum = [0]; for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length]; tot += Math.hypot(q[0] - P[i][0], q[1] - P[i][1]); cum.push(tot); }
  const N = Math.round(tot / DSS), ds = tot / N, X = new Float32Array(N), Z = new Float32Array(N);
  { let j = 0; for (let i = 0; i < N; i++) { const s = i * ds; while (cum[j + 1] < s) j++; const f = (s - cum[j]) / (cum[j + 1] - cum[j]), a = P[j], b = P[(j + 1) % P.length]; X[i] = a[0] + (b[0] - a[0]) * f; Z[i] = a[1] + (b[1] - a[1]) * f; } }
  const TX = new Float32Array(N), TZ = new Float32Array(N), K = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = (i + N - 1) % N, b = (i + 1) % N, dx = X[b] - X[a], dz = Z[b] - Z[a], l = Math.hypot(dx, dz); TX[i] = dx / l; TZ[i] = dz / l; }
  const K0 = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = (i + N - 1) % N, b = (i + 1) % N; K0[i] = ((TX[b] - TX[a]) * -TZ[i] + (TZ[b] - TZ[a]) * TX[i]) / (2 * ds); } // + = the road bends to the right
  for (let i = 0; i < N; i++) { let s = 0; for (let k = -3; k <= 3; k++) s += K0[(i + k + N) % N]; K[i] = s / 7; }
  const L = tot;
  const wrap = (s) => { s %= L; return s < 0 ? s + L : s; };
  function at(s, o) { s = wrap(s); const f = s / ds, i = Math.floor(f) % N, j = (i + 1) % N, u = f - Math.floor(f); o = o || {};
    o.x = X[i] + (X[j] - X[i]) * u; o.z = Z[i] + (Z[j] - Z[i]) * u; let tx = TX[i] + (TX[j] - TX[i]) * u, tz = TZ[i] + (TZ[j] - TZ[i]) * u; const l = Math.hypot(tx, tz) || 1; o.tx = tx / l; o.tz = tz / l; o.k = K[i] + (K[j] - K[i]) * u; return o; }
  const kapAt = (s) => K[Math.floor(wrap(s) / ds) % N];
  function ahead(s, len) { let m = 0, sg = 0; for (let q = 0; q <= len; q += 6) { const k = kapAt(s + q); if (Math.abs(k) > m) { m = Math.abs(k); sg = Math.sign(k); } } return { m, sg }; }
  // one car step. c: { s, d, v, lat, boostT, hitT, skill }, in: { steer -1..1 (+ = right), brake, boost }
  function stepCar(c, dt, inp) {
    const k = kapAt(c.s); let vt = VMAX * (c.skill || 1);
    if (Math.abs(c.d) > HW) vt *= 0.55; if (c.boostT > 0) { vt += BOOST; c.boostT -= dt; }
    if (inp.brake) c.v -= 34 * dt; else c.v += (c.v < vt ? 24 : -18) * dt;
    c.v = Math.max(c.v, 6); c.hitT = (c.hitT || 0) - dt;
    c.lat = inp.steer * LAT * Math.min(1, Math.max(0.4, c.v / 20)) - k * c.v * c.v * 0.22;
    c.d += c.lat * dt;
    if (Math.abs(c.d) > BW) { c.d = Math.sign(c.d) * BW; if (c.hitT <= 0 && c.v > 12) { c.v *= 0.55; c.hitT = 0.5; c.hit = 1; } c.v = Math.max(8, c.v - 10 * dt); }
    c.s += c.v * dt;
  }
  // the line / steering a driver (rival or bot) would use
  function drive(c, skill) { const kk = ahead(c.s, 44), kn = kapAt(c.s), f = Math.min(1, Math.max(0.4, c.v / 20));
    const line = Math.max(-1, Math.min(1, kapAt(c.s + 26) * 60)) * 4.2 + (c.off || 0);
    const steer = Math.max(-1, Math.min(1, ((line - c.d) * 0.8 + kn * c.v * c.v * 0.22) / (LAT * f)));
    const vcap = Math.sqrt((LAT * 0.8) / (0.22 * Math.max(kk.m, 0.002))) * skill;
    return { steer, brake: c.v > vcap + 1.5, vcap }; }
  return { CP, HW, BW, LAT, VMAX, BOOST, LAPS, L, N, ds, at, kapAt, ahead, stepCar, drive, wrap };
})();
// </GPSIM> -----------------------------------------------------------------------------------------------------------------------------------------
const GPRIX = (function () {
  const S = { scene: null, cam: null, title: 'HARBOR GRAND PRIX', pips: 1,
    hint: '<b>A / D</b> steer · <b>K</b> brake · <b>J</b> BOOST · corners push you wide: brake for the hairpin',
    labels: { a: 'BOOST', b: 'BRAKE', c: '', l: '', r: '' } };
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), E3 = new THREE.Euler(), SC = new THREE.Vector3(), PO = new THREE.Vector3();
  const { HW, BW, L, N, ds, at, wrap, LAPS, VMAX } = GPS;
  const TRG = { x: -36, z: -32.6, ox: -38.5, oz: -32.6 };
  const COL = ['#3fd13a', '#e0372b', '#2d7bff', '#ffb52e'], NAMES = ['HAROLD', 'RED SKIMMER', 'BLUE HERON', 'GOLD CRAB'];
  let seed = 11; const rr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // ---------- textures (canvas only) ----------
  const roadTex = () => canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#34363f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(' + (i % 2 ? '255,255,255' : '0,0,0') + ',0.05)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#e9e6d8'; g.fillRect(2, 0, 3, h); g.fillRect(w - 5, 0, 3, h); g.fillStyle = '#f2d34a'; g.fillRect(w / 2 - 1, 8, 2, 48); g.fillRect(w / 2 - 1, 72, 2, 48); }, 128);
  const kerbTex = () => canvasTex(16, 32, (g, w, h) => { g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8352a'; g.fillRect(0, 0, w, h / 2); }, 32);
  const fenceTex = () => canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(210,214,222,0.9)'; g.lineWidth = 2; for (let i = -h; i < w + h; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); } }, 64);
  const crowdTex = () => canvasTex(64, 32, (g, w, h) => { g.fillStyle = '#4a4458'; g.fillRect(0, 0, w, h); const cs = ['#ff7a59', '#ffd23c', '#7adfff', '#fff', '#9dff6b', '#ff8ab0', '#2d7bff']; for (let i = 0; i < 150; i++) { g.fillStyle = cs[i % cs.length]; g.fillRect((i * 37) % w, (i * 11) % h, 3, 3); } }, 64);
  const brickT = () => canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#9b4b3a'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < h; y += 8) { g.fillRect(0, y, w, 1); for (let x = (y / 8) % 2 ? 0 : 8; x < w; x += 16) g.fillRect(x, y, 1, 8); } g.fillStyle = '#ffe9a8'; for (let y = 10; y < h - 6; y += 18) for (let x = 8; x < w - 4; x += 16) g.fillRect(x, y, 6, 9); }, 64);
  const signTex = () => canvasTex(512, 96, (g, w, h) => { g.fillStyle = '#14101f'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23c'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8); g.fillStyle = '#fff'; g.font = 'bold 56px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.fillText('HARBOR GRAND PRIX', w / 2, 66); }, 512);
  const checkTex = () => canvasTex(64, 16, (g, w, h) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#fff' : '#111'; g.fillRect(x * 4, y * 8, 4, 8); } }, 64);
  // ribbon along the track between two (d, y) offsets; uv v runs along the road (every vscale metres)
  function strip(dA, yA, dB, yB, vscale, mat, s0 = 0, s1 = L) { const n = Math.max(2, Math.round((s1 - s0) / ds)), P = new Float32Array((n + 1) * 6), U = new Float32Array((n + 1) * 4), I = []; const o = {};
    for (let i = 0; i <= n; i++) { const s = s0 + (s1 - s0) * i / n; at(s, o); const rx = -o.tz, rz = o.tx; P.set([o.x + rx * dA, yA, o.z + rz * dA, o.x + rx * dB, yB, o.z + rz * dB], i * 6); U.set([0, s / vscale, 1, s / vscale], i * 4); if (i < n) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); return new THREE.Mesh(g, mat); }
  function carMesh(i) { if (window.buildGrandPrixCar) { try { const r = window.buildGrandPrixCar({ THREE, toonMat: window.toonMat, QUAL: window.QUAL }, i); if (r) return r.root || r; } catch (e) { console.error(e); } }
    const g = new THREE.Group(), col = COL[i], mat = (c) => new THREE.MeshLambertMaterial({ color: c }), body = mat(col), blk = mat('#16141c');
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    add(new THREE.BoxGeometry(0.95, 0.42, 2.6), body, 0, 0.42, 0); add(new THREE.BoxGeometry(0.5, 0.26, 1.5), body, 0, 0.36, 2.0); add(new THREE.BoxGeometry(1.7, 0.08, 0.5), body, 0, 0.2, 2.75); add(new THREE.BoxGeometry(1.4, 0.7, 0.14), body, 0, 0.9, -1.75);
    const wg = new THREE.CylinderGeometry(0.4, 0.4, 0.42, 10); for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.98, -1.2], [0.98, -1.2]]) { const w = add(wg, blk, x, 0.4, z); w.rotation.z = Math.PI / 2; }
    add(new THREE.SphereGeometry(i === 0 ? 0.36 : 0.3, 10, 8), mat(i === 0 ? '#7bd84a' : '#f4e8d0'), 0, 0.88, -0.1); if (i === 0) { add(new THREE.SphereGeometry(0.1, 6, 6), mat('#fff'), -0.17, 1.12, 0.15); add(new THREE.SphereGeometry(0.1, 6, 6), mat('#fff'), 0.17, 1.12, 0.15); }
    add(new THREE.BoxGeometry(0.3, 0.1, 0.5), mat('#ffd23c'), 0, 0.68, -0.6); return g; }
  S.build = function () {
    const sc = (S.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#bfe3f4', 90, 330); sc.background = new THREE.Color('#9ed3f0');
    S.cam = new THREE.PerspectiveCamera(58, VW() / VH(), 0.3, 420);
    DUELS.sceneLights(sc, '#fff6e0', '#6d6a60', 1.15, '#fff0cc', 1.5, new THREE.Vector3(-0.4, 1, 0.5));
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: '#b4ae9c' })); gnd.rotation.x = -Math.PI / 2; gnd.position.set(0, -0.05, -40); sc.add(gnd);
    const wat = new THREE.Mesh(new THREE.PlaneGeometry(900, 330), new THREE.MeshLambertMaterial({ color: '#3a86b4' })); wat.rotation.x = -Math.PI / 2; wat.position.set(0, 0, 195); sc.add(wat);
    const rt = roadTex(); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; sc.add(strip(-HW, 0.02, HW, 0.02, 16, new THREE.MeshLambertMaterial({ map: rt })));
    const kt = kerbTex(); kt.wrapS = kt.wrapT = THREE.RepeatWrapping; const km = new THREE.MeshLambertMaterial({ map: kt }); sc.add(strip(HW, 0.03, HW + 1, 0.03, 3, km), strip(-HW - 1, 0.03, -HW, 0.03, 3, km));
    const pav = new THREE.MeshLambertMaterial({ color: '#8c8a84' }); sc.add(strip(HW + 1, 0.01, BW + 3, 0.01, 8, pav), strip(-BW - 3, 0.01, -HW - 1, 0.01, 8, pav));
    const ft = fenceTex(); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(1, 1); const fm = new THREE.MeshBasicMaterial({ map: ft, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: true });
    sc.add(strip(BW + 0.8, 0, BW + 0.8, 3.4, 4, fm), strip(-BW - 0.8, 0, -BW - 0.8, 3.4, 4, fm));
    // concrete barriers (one instanced mesh), blue-and-white blocks every few
    const nb = Math.floor(L / 2.2) * 2, bar = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.95, 2.2), new THREE.MeshLambertMaterial({ color: '#ffffff' }), nb), o = {}, C = new THREE.Color();
    for (let i = 0; i < nb; i++) { const side = i % 2 ? 1 : -1, s = Math.floor(i / 2) * 2.2; at(s, o); const d = side * (BW + 0.35); E3.set(0, Math.atan2(o.tx, o.tz), 0); Q4.setFromEuler(E3); M4.compose(PO.set(o.x - o.tz * d, 0.47, o.z + o.tx * d), Q4, SC.set(1, 1, 1)); bar.setMatrixAt(i, M4); C.set(Math.floor(i / 2) % 6 < 2 ? '#2d6ac0' : '#c9c9c4'); bar.setColorAt(i, C); }
    sc.add(bar);
    // start / finish line + arch
    const sf = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, 2.4), new THREE.MeshBasicMaterial({ map: checkTex() })); at(0, o); sf.rotation.set(-Math.PI / 2, 0, 0); sf.rotation.order = 'YXZ'; sf.rotation.y = Math.atan2(o.tx, o.tz); sf.position.set(o.x, 0.05, o.z); sc.add(sf);
    const arch = new THREE.Group(), sg = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 2, 2.4), new THREE.MeshBasicMaterial({ map: signTex(), side: THREE.DoubleSide })); sg.position.y = 7.6; arch.add(sg);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8.8, 0.7), new THREE.MeshLambertMaterial({ color: '#2a2438' })); p.position.set(sx * (HW + 1), 4.4, 0); arch.add(p); }
    arch.position.set(o.x, 0, o.z); arch.rotation.y = Math.atan2(o.tx, o.tz); sc.add(arch);
    // grandstands (instanced tiers + roofs) on the left/outside of the start straight, the harbor side stretch and the hairpin exit
    const ct = crowdTex(), tiers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: ct }), 18), roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#d8352a' }), 3); let ti = 0, ri = 0;
    for (const [s0, side] of [[40, -1], [250, 1], [Math.round(L * 0.62), -1]]) { at(s0, o); const yaw = Math.atan2(o.tx, o.tz);
      for (let k = 0; k < 4; k++) { const d = side * (BW + 5.5 + k * 2.2); E3.set(0, yaw, 0); Q4.setFromEuler(E3); M4.compose(PO.set(o.x - o.tz * d, 0.7 + k * 1.3, o.z + o.tx * d), Q4, SC.set(2.2, 1.4 + k * 2.6, 44)); tiers.setMatrixAt(ti++, M4); }
      const d = side * (BW + 10); M4.compose(PO.set(o.x - o.tz * d, 7, o.z + o.tx * d), Q4, SC.set(10.5, 0.3, 46)); roofs.setMatrixAt(ri++, M4); }
    tiers.count = ti; roofs.count = ri; sc.add(tiers, roofs);
    // city blocks (instanced, brick with lit windows) well off the road
    const bt = brickT(), blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: bt }), 90); let bi = 0; seed = 5;
    const farFrom = (x, z, m) => { for (let i = 0; i < N; i += 3) { const dx = X(i) - x, dz = Z(i) - z; if (dx * dx + dz * dz < m * m) return false; } return true; };
    const X = (i) => at(i * ds).x, Z = (i) => at(i * ds).z;
    for (let tr = 0; tr < 900 && bi < 90; tr++) { const x = -230 + rr() * 460, z = -190 + rr() * 200; if (z > 22) continue; const w = 12 + rr() * 16, dd = 12 + rr() * 14; if (!farFrom(x, z, 24 + Math.max(w, dd) * 0.6)) continue;
      const h = 8 + rr() * 30; E3.set(0, 0, 0); Q4.setFromEuler(E3); M4.compose(PO.set(x, h / 2, z), Q4, SC.set(w, h, dd)); blocks.setMatrixAt(bi, M4); C.setHSL(0.02 + rr() * 0.07, 0.35, 0.55 + rr() * 0.3); blocks.setColorAt(bi, C); bi++; }
    blocks.count = bi; sc.add(blocks);
    S.cars = []; for (let i = 0; i < 4; i++) { const m = carMesh(i); sc.add(m); S.cars.push({ m, i }); }
    S.sh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.4), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.0 })); // (unused marker)
    S.camP = new THREE.Vector3(); S.camL = new THREE.Vector3();
  };
  // ---------- race state ----------
  function reset() { seed = 11 + ((+Q.get('gpseed') || 0) | 0);
    const grid = [[-18, 0, 1], [-6, 2.6, 0.97], [-6, -2.6, 0.94], [-12, -2.6, 0.9]]; // player on the third row; rivals by skill (Gold Crab on pole)
    const order = [[-12, 2.6, 0, 1.0], [-6, -2.6, 1, 0.965], [0, 2.6, 2, 0.94], [-24, -2.6, 3, 0.97]];
    S.car = order.map(([s, d, i, sk]) => ({ i, s, d, v: 0, lat: 0, boostT: 0, hitT: 0, hit: 0, skill: sk, off: (i - 1.5) * 0.6, fin: false, finT: 0, lap: 0 }));
    S.car.sort((a, b) => a.i - b.i); S.me = S.car[0]; S.me.skill = 1; S.boost = 0.6; S.t = 0; S.cd = 0; S.over = false; S.won = false; S.order = []; S.shk = 0; S.lapShown = 0; S.endT = 0; S.fwin = 0; S.lost = 0;
    S.camP.set(0, 0, 0); S.camL.set(0, 0, 0); S.camInit = false;
    const st = { t: 0 }; return st; }
  S.start = function () { reset(); DUELS.log.push('grandprix:start'); DUELS.banner('HARBOR GRAND PRIX<small>PRATT STREET · 3 LAPS · WIN IT FIRST</small>', 2.4); DUELS.say('ANNOUNCER', 'Gentle-toads, start your engines! Three laps of Pratt Street, hairpin at the Convention Center.', 3.4); };
  S.retry = function () { reset(); DUELS.banner('ROUND TWO<small>FRESH TIRES · BACK ON THE GRID</small>', 1.6); };
  S.exit = function () { DUELS.bars(1, 1); };
  const prog = (c) => c.s;
  const rankOf = (c) => 1 + S.car.filter((o) => o !== c && (o.fin && !c.fin ? true : (c.fin && !o.fin ? false : (o.fin && c.fin ? S.order.indexOf(o) < S.order.indexOf(c) : prog(o) > prog(c))))).length;
  S.step = function (dt, I) {
    if (!S.car) return; S.t += dt; const me = S.me;
    // countdown
    if (S.cd < 3) { const c0 = Math.floor(S.cd); S.cd += dt; const c1 = Math.floor(S.cd); if (c1 !== c0 && c1 < 3) DUELS.banner(String(3 - c1), 0.9); if (S.cd >= 3) { DUELS.banner('GO!', 0.8); DUELS.hitSfx && DUELS.hitSfx('heavy'); } updateHud(); return; }
    if (S.over) { S.endT += dt; return; }
    // player input
    const ctrl = { steer: clamp(I.mx, -1, 1), brake: !!(I.bh || I.b || I.down), boost: !!(I.a || I.c) };
    if (me.fin) { ctrl.steer = 0; ctrl.brake = false; ctrl.boost = false; }
    if (ctrl.boost && S.boost >= 0.3 && me.boostT <= 0) { me.boostT = S.boost * 2.5; S.boost = 0; DUELS.flash('#ffd23c', 0.25); }
    S.boost = Math.min(1, S.boost + dt * (me.boostT > 0 ? 0 : 0.11));
    const pl = S.car.slice(); for (const c of S.car) { if (c === me) { GPS.stepCar(c, dt, me.fin ? Object.assign(GPS.drive(c, 0.6), { brake: false }) : ctrl); if (me.fin) c.skill = 0.5; }
      else { const d = GPS.drive(c, c.skill), gap = c.s - me.s, rb = gap > 90 ? 0.94 : gap < -70 ? 1.05 : 1; const sk = c.skill; c.skill = sk * rb; GPS.stepCar(c, dt, { steer: d.steer, brake: d.brake }); c.skill = sk; }
      if (c.hit) { c.hit = 0; if (c === me) { S.shk = 0.6; DUELS.hurt && DUELS.hurt(); DUELS.hitSfx && DUELS.hitSfx('heavy'); } } }
    // bumping
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) { const A = S.car[a], B = S.car[b], dsx = A.s - B.s, dd = A.d - B.d; if (Math.abs(dsx) < 3.8 && Math.abs(dd) < 1.7) { const sg = dd >= 0 ? 1 : -1; A.d += sg * 0.5; B.d -= sg * 0.5; (dsx > 0 ? B : A).v *= 0.97; A.v *= 0.99; B.v *= 0.99; if (A === me || B === me) S.shk = Math.max(S.shk, 0.25); } }
    // laps + finish
    for (const c of S.car) { if (!c.fin && c.s >= LAPS * L) { c.fin = true; c.finT = S.t; S.order.push(c); if (c === me) { S.fwin = S.order.length === 1; } } }
    const lap = Math.min(LAPS, 1 + Math.floor(Math.max(0, me.s) / L)); if (lap !== S.lapShown) { S.lapShown = lap; if (lap > 1 && lap <= LAPS) DUELS.banner(lap === LAPS ? 'FINAL LAP' : 'LAP ' + lap, 1.1); }
    if (!S.over) {
      if (me.fin) { S.over = true; S.endT = 0; const r = S.order.indexOf(me) + 1; if (S.fwin) { S.won = true; DUELS.log.push('grandprix:win'); try { localStorage.setItem('tcb_gp_won', '1'); } catch (e) {} DUELS.banner('CHECKERED FLAG!<small>HAROLD WINS THE HARBOR GRAND PRIX</small>', 3); DUELS.say('ANNOUNCER', 'Harold takes it! Somebody tell his hip it was a good one!', 3);
          setTimeout(() => { if (DUELS.cur === S) DUELS.over('win', 'CHAMPION OF PRATT STREET!', 'Three laps, one hairpin, zero apologies. The cane is polished, the trophy is cheap, the crowd on the stoops is on its feet.'); }, SIM ? 400 : 2600); }
        else { const t = ['', '1ST', '2ND', '3RD', '4TH'][r]; DUELS.log.push('grandprix:lose:' + r); setTimeout(() => { if (DUELS.cur === S) DUELS.over('lose', t + ' PLACE', 'Somebody beat you to the flag. Brake before the hairpin, steer into the bend, and save the BOOST for the straights.'); }, SIM ? 300 : 1200); } }
      else if (S.order.length && S.order[0] !== me) { S.lost = (S.lost || 0) + dt; if (S.lost > 1.6) { S.over = true; S.endT = 0; const r = rankOf(me), t = ['', '1ST', '2ND', '3RD', '4TH'][r]; DUELS.log.push('grandprix:lose:' + r);
          setTimeout(() => { if (DUELS.cur === S) DUELS.over('lose', t + ' PLACE', 'A rival took the flag first. Brake before the hairpin, steer into the bend, and burn the BOOST on the straights.'); }, SIM ? 300 : 900); } }
    }
    S.shk = Math.max(0, S.shk - dt * 1.5); updateHud();
  };
  function updateHud() { const me = S.me; if (!me) return; DUELS.bars(S.boost, clamp(me.s / (LAPS * L), 0, 1)); const lap = Math.min(LAPS, 1 + Math.floor(Math.max(0, me.s) / L));
    DUELS.sub('LAP ' + lap + '/' + LAPS + ' · P' + rankOf(me) + '/4', Math.round(me.v * 3.6) + ' KM/H' + (me.boostT > 0 ? ' · BOOST' : '')); }
  const O = {};
  S.render = function (rdt) {
    if (!S.car) return; const dt = Math.min(0.05, rdt * (SIM || 1)), me = S.me;
    for (const c of S.car) { const m = S.cars[c.i].m; at(c.s, O); const rx = -O.tz, rz = O.tx; m.position.set(O.x + rx * c.d, 0.05, O.z + rz * c.d); m.rotation.y = Math.atan2(O.tx, O.tz) - clamp(c.lat * 0.02, -0.25, 0.25); m.rotation.z = clamp(-c.lat * 0.006, -0.1, 0.1); }
    // chase camera: behind and above Harold; further back and wider the faster he goes (speed is felt from low, close flying scenery)
    at(me.s, O); const rx = -O.tz, rz = O.tx, port = VH() > VW(), sp = clamp(me.v / VMAX, 0, 1.3), back = (port ? 11 : 9) + sp * 2.5, up = port ? 4.8 : 3.7;
    const fin = S.over && S.won, orb = fin ? S.endT * 0.7 : 0;
    V.set(O.x + rx * me.d * 0.8 - O.tx * back * Math.cos(orb) + rx * back * Math.sin(orb) * 0.8, up + (fin ? 1.2 : 0), O.z + rz * me.d * 0.8 - O.tz * back * Math.cos(orb) + rz * back * Math.sin(orb) * 0.8);
    V2.set(O.x + rx * me.d + O.tx * 14, 1.0, O.z + rz * me.d + O.tz * 14); if (fin) V2.set(O.x + rx * me.d, 1.0, O.z + rz * me.d);
    if (!S.camInit) { S.camP.copy(V); S.camL.copy(V2); S.camInit = true; }
    S.camP.lerp(V, 1 - Math.exp(-7 * dt)); S.camL.lerp(V2, 1 - Math.exp(-9 * dt)); S.cam.position.copy(S.camP);
    if (S.shk > 0) S.cam.position.add(V.set(rnd(-1, 1), rnd(-1, 1), 0).multiplyScalar(S.shk * 0.25));
    S.cam.lookAt(S.camL); const fov = 56 + sp * 12 + (me.boostT > 0 ? 8 : 0) + (port ? 8 : 0); if (Math.abs(S.cam.fov - fov) > 0.05) { S.cam.fov = damp(S.cam.fov, fov, 6, dt); S.cam.updateProjectionMatrix(); }
    S.scene.fog.near = 90; S.scene.fog.far = 330;
  };
  S.onResize = () => {};
  // ---------- test bot: gpauto=win drives the racing line with the same driver model as the rivals (slightly better) and boosts on straights; lose never steers ----------
  S.botThink = function (B, dt) {
    if (!S.car || S.over) return; const me = S.me; B.mx = 0; B.bh = false;
    if (B.mode === 'lose') { return; }
    if (S.cd < 3) return; const d = GPS.drive(me, 1.03); B.mx = d.steer; B.bh = d.brake;
    if (S.boost >= 0.9 && me.boostT <= 0 && GPS.ahead(me.s, 60).m < 0.006) B.a = true;
  };
  DUELS.reg('grandprix', S);
  S.trigger = TRG;
  // ---------- the city side: a glowing ring on the Harborplace promenade; ACT = GRAND PRIX (needs 6 bosses beaten) ----------
  const NEED = 6, left = () => Math.max(0, NEED - BOSS_CLEAR.cleared.size);
  function setupTrigger() {
    const rt = canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke(); g.lineWidth = 4; g.setLineDash([10, 9]); g.beginPath(); g.arc(64, 64, 38, 0, TAU); g.stroke(); }, 128);
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: rt, color: '#ffd23c', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(TRG.x, groundY(TRG.x, TRG.z) + 0.04, TRG.z); ring.renderOrder = 2; scene.add(ring);
    MODE.ticks.push((rdt) => { const d = Math.hypot(TRG.x - hero.pos.x, TRG.z - hero.pos.z); ring.visible = d < 40; ring.material.opacity = left() ? 0.4 : 1; ring.rotation.z += rdt * 0.8; });
    ACTIONS.push({ kind: 'boss', label: 'GRAND PRIX', x: TRG.x, z: TRG.z, r: 1.7, y: 2.2, ok: () => !DUELS.cur && (!BOT || Q.has('duels')), go: () => { if (!left()) DUELS.start('grandprix'); } });
    const act = ACTIONS[ACTIONS.length - 1]; Object.defineProperty(act, 'label', { get: () => (left() ? 'GRAND PRIX: CLEAR ' + left() + ' MORE BOSSES' : 'HARBOR GRAND PRIX'), configurable: true });
  }
  let n = 0; MODE.ticks.push(() => { n++; if (n === 1) setupTrigger(); if (n === 3 && Q.get('gpauto') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('gpauto'); DUELS.start('grandprix', m === 'win' || m === 'lose' ? { bot: m } : {}); } });
  window.__gprix = S; S.GPS = GPS;
})();
