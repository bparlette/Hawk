
// (BOSS_CLEAR, the boss-clear + crime-meter hook, lives in src/06g0_boss_clear.js)
// ---------------- Bird Brain Bobby, Oriole Park: HOME RUN DERBY (DESIGN.md "Game-style boss fights") ----------------
// Its own little scene (the city is not drawn while it runs): a batter's-box camera behind Harold (cane = bat) facing Bobby on the mound,
// in a ballpark walled by brick warehouses. Bobby throws fastballs / curves / changeups / knuckleballs, each with its own windup tell
// (and a hand glow + ball trail in the pitch's colour: red / blue / green / yellow). Swing: tap / click / Space / J / gamepad A (+ the
// arcade SWING / ACT buttons). Timing decides contact; on desktop the mouse aims (high/low + pull/oppo); on phones it is timing only, with an
// optional aim from the panel stick (or WASD / pad stick). Ball flight (gravity + drag) decides foul / out / single / HOME RUN (over the wall).
// 10 homers before 10 outs wins (BOSS_CLEAR.clear('orioles')); 10 outs = retry. The radio is ducked while it runs.
// Entry: ACT "PLAY BALL" at the Oriole Park boss anchor, or ?derby=1 (?derby=perfect / ?derby=miss = scripted runs for tests).
// RIG HOOK: Bobby's real rig comes from Opus (O5). If a module defines buildBirdBrainBobby() it is used instead of the stand-in:
//   it returns an Object3D or { root, pose?(state, u, t, info), hand? }. root faces +Z (toward the plate), feet at y = 0, about 2.6 m tall.
//   state: 'idle' | 'windup' | 'release' | 'follow' | 'cheer' | 'mad' | 'defeat' | 'gloat'; u = 0..1 progress; info.pitch = 'fast' | 'curve' | 'change' | 'knuckle'.
const DERBY = (function () {
  const LMID = 'orioles';
  const LM = LANDMARKS.find((l) => l.id === LMID);
  const RULE = { homers: 10, outs: 10 };
  const SL = 0.14;                       // swing press -> cane through the zone (s)
  const WIN_T = 0.14, PERFECT_T = 0.04; // timing window (s): contact inside WIN_T, full power inside PERFECT_T
  const AIM_R = 0.42;                    // desktop aim: the cane misses when the aim point is further than this from the ball (m)
  const PLATE_Z = 0, MOUND_Z = -18.4, REL = new THREE.Vector3(-0.62, 2.05, MOUND_Z + 1.3);
  const KDRAG = 0.0035, GRAV = 9.81;
  const wallR = (phi) => 98 + 22 * Math.cos(clamp(phi, -Math.PI / 4, Math.PI / 4) * 2); // fence distance (m): 98 m (322 ft) at the lines, 120 m (394 ft) to centre
  const wallH = (phi) => (phi > 0.26 ? 7.4 : 3.8);                                        // right field: the tall warehouse wall
  const FT = 3.28084;
  const PT = { // pitch types: colour (tell glow + trail), windup s, flight time s (early -> late), mph shown (early -> late)
    fast: { name: 'FASTBALL', col: '#ff4a3a', wind: 1.05, T: [1.02, 0.6], mph: [78, 97] },
    curve: { name: 'CURVEBALL', col: '#4aa8ff', wind: 1.2, T: [1.22, 0.8], mph: [68, 83] },
    change: { name: 'CHANGEUP', col: '#52ff7a', wind: 1.45, T: [1.38, 0.95], mph: [64, 80] },
    knuckle: { name: 'KNUCKLEBALL', col: '#ffe03a', wind: 1.25, T: [1.42, 1.02], mph: [58, 72] },
  };
  let rs = 1; const rng = () => { rs |= 0; rs = (rs + 0x6d2b79f5) | 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const D = { on: false, built: false, state: 'off', t: 0, st: 0, homers: 0, outs: 0, pitches: 0, last: null, lastFt: 0, best: 0, bot: null, runs: 0, wins: 0, losses: 0,
    log: [], pitch: null, swing: null, hit: null, cheer: 0, aim: { x: 0, y: 0.8, mouse: false, mx: 0, my: 0, mT: -9 }, keyT: -1, ptrT: -1, ptrPend: false, padPrev: false, frames: 0, results: { HR: 0, OUT: 0, SINGLE: 0, FOUL: 0, STRIKE: 0, BALL: 0 } };

  // ---- scene ----
  const SC = new THREE.Scene(); const CAMD = new THREE.PerspectiveCamera(55, 1, 0.1, 700);
  const FOG = new THREE.Color('#e6977a'); SC.fog = new THREE.Fog(FOG, 170, 520);
  SC.add(new THREE.HemisphereLight('#ffe2c8', '#4a6a3a', 1.35));
  const key = new THREE.DirectionalLight('#fff0d8', 1.9); key.position.set(30, 60, 50); SC.add(key, key.target);
  const rim = new THREE.DirectionalLight('#ff9a6a', 0.7); rim.position.set(-40, 20, -80); SC.add(rim);
  const tex = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const repTex = (w, h, f) => { const t = tex(w, h, f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  const GLOW = tex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });

  // static geometry is merged: one mesh per material (+ one ink hull each)
  function mergeGeo(list) {
    let n = 0; const gs = list.map(({ g, m, us, vs }) => { const q = g.index ? g.toNonIndexed() : g; q.applyMatrix4(m); if (q.attributes.uv && (us !== 1 || vs !== 1)) { const u = q.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * us, u.getY(i) * vs); } n += q.attributes.position.count; return q; });
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), Cc = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
    for (const q of gs) { const c = q.attributes.position.count; P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3); Cc.set(q.attributes.color.array, o * 3); if (q.attributes.uv) U.set(q.attributes.uv.array, o * 2); o += c; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(Cc, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    g.computeBoundingSphere(); return g;
  }
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  const L = { grass: [], flat: [], ink: [], brick: [], ware: [] };
  function put(list, g, col, x, y, z, ry = 0, rx = 0, rz = 0, us = 1, vs = 1) { bakeColor(g, col); _e.set(rx, ry, rz); _q.setFromEuler(_e); _m4.compose(_p.set(x, y, z), _q, _s); L[list].push({ g, m: _m4.clone(), us, vs }); }
  function bake(list, mat, ink) { if (!L[list].length) return null; const g = mergeGeo(L[list]); const me = new THREE.Mesh(g, mat); me.matrixAutoUpdate = false; me.updateMatrix(); SC.add(me);
    if (ink) { addOdir(g); const h = new THREE.Mesh(g, OUT_PROP); h.matrixAutoUpdate = false; h.visible = QUAL.hd; QUAL.outlines.push(h); me.add(h); } return me; }
  const dirTo = (phi, r, y = 0) => new THREE.Vector3(Math.sin(phi) * r, y, -Math.cos(phi) * r);

  function buildPark() {
    // sky: dusk gradient
    SC.background = tex(8, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a2050'); g.addColorStop(0.42, '#5a3f86'); g.addColorStop(0.72, '#d0708a'); g.addColorStop(0.9, '#ffa070'); g.addColorStop(1, '#ffc88a'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    const GRASS = repTex(128, 128, (c) => { c.fillStyle = '#3f8a3a'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#4fa046'; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64);
      for (let i = 0; i < 500; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(20,60,20,.12)' : 'rgba(150,220,120,.1)'; c.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } });
    const BRICK = repTex(256, 256, (c, w, h) => { // one bay of the outfield wall: brick + a blind arch + a dark window
      c.fillStyle = '#8a3a26'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < w; x += 32) { c.fillStyle = `hsl(${10 + Math.random() * 8},${45 + Math.random() * 15}%,${30 + Math.random() * 9}%)`; c.fillRect(x + 1, y + 1, 30, 14); }
      c.fillStyle = '#5a2418'; c.beginPath(); c.moveTo(56, 236); c.lineTo(56, 110); c.arc(128, 110, 72, Math.PI, 0); c.lineTo(200, 236); c.closePath(); c.fill();
      c.fillStyle = '#1c1a26'; c.beginPath(); c.moveTo(74, 228); c.lineTo(74, 112); c.arc(128, 112, 54, Math.PI, 0); c.lineTo(182, 228); c.closePath(); c.fill();
      c.strokeStyle = '#3a3440'; c.lineWidth = 5; c.beginPath(); c.moveTo(128, 60); c.lineTo(128, 228); c.moveTo(74, 150); c.lineTo(182, 150); c.stroke();
      c.fillStyle = '#c8b090'; c.fillRect(0, 240, w, 16); c.fillRect(0, 0, w, 8); });
    const WARE = repTex(256, 256, (c, w, h) => { // warehouse facade: brick + 2 x 2 tall windows with stone lintels (some lit)
      c.fillStyle = '#7a3524'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 12) for (let x = (y / 12) % 2 ? -12 : 0; x < w; x += 24) { c.fillStyle = `hsl(${9 + Math.random() * 8},${40 + Math.random() * 15}%,${27 + Math.random() * 8}%)`; c.fillRect(x + 1, y + 1, 22, 10); }
      for (const wx of [40, 152]) for (const wy of [24, 152]) { c.fillStyle = '#d8c8a8'; c.fillRect(wx - 6, wy - 10, 76, 12); c.fillStyle = Math.random() < 0.4 ? '#ffd890' : '#232838'; c.fillRect(wx, wy, 64, 84);
        c.strokeStyle = '#1a1a22'; c.lineWidth = 4; c.strokeRect(wx, wy, 64, 84); c.beginPath(); c.moveTo(wx + 32, wy); c.lineTo(wx + 32, wy + 84); c.moveTo(wx, wy + 42); c.lineTo(wx + 64, wy + 42); c.stroke(); } });
    // ground
    put('grass', new THREE.CircleGeometry(175, 64), '#ffffff', 0, 0, 0, 0, -Math.PI / 2);
    { const g = L.grass[0].g, u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * 44, u.getY(i) * 44); }
    put('flat', new THREE.CircleGeometry(28.5, 40), '#b77a48', 0, 0.012, -19.4, 0, -Math.PI / 2);      // infield dirt
    put('flat', new THREE.PlaneGeometry(24.2, 24.2).rotateX(-Math.PI / 2), '#4a9a42', 0, 0.024, -19.4, Math.PI / 4); // infield grass
    put('flat', new THREE.CircleGeometry(4.3, 28), '#b77a48', 0, 0.036, 0, 0, -Math.PI / 2);           // home plate circle
    put('ink', new THREE.CylinderGeometry(2.7, 3.0, 0.26, 28), '#b77a48', 0, 0.13, MOUND_Z);           // mound
    put('flat', new THREE.BoxGeometry(0.62, 0.04, 0.16), '#ffffff', 0, 0.27, MOUND_Z + 0.3);             // rubber
    { const s = new THREE.Shape(); s.moveTo(-0.215, 0); s.lineTo(0.215, 0); s.lineTo(0.215, -0.215); s.lineTo(0, -0.43); s.lineTo(-0.215, -0.215); s.closePath(); // plate, point to the catcher
      put('flat', new THREE.ShapeGeometry(s), '#ffffff', 0, 0.05, -0.0, 0, -Math.PI / 2); }
    for (const [x, z] of [[19.4, -19.4], [0, -38.8], [-19.4, -19.4]]) put('flat', new THREE.BoxGeometry(0.42, 0.08, 0.42), '#ffffff', x, 0.05, z, Math.PI / 4);
    for (const s of [-1, 1]) { // foul lines + batter's boxes
      put('flat', new THREE.BoxGeometry(0.09, 0.02, 99), '#ffffff', s * Math.sin(Math.PI / 4) * 50.5, 0.045, -Math.cos(Math.PI / 4) * 50.5, -s * Math.PI / 4);
      const bx = s * 0.95; for (const [w, d, x, z] of [[0.06, 1.8, bx - 0.6, 0.1], [0.06, 1.8, bx + 0.6, 0.1], [1.26, 0.06, bx, -0.8], [1.26, 0.06, bx, 1.0]]) put('flat', new THREE.BoxGeometry(w, 0.02, d), '#f4f0e8', x, 0.045, z);
    }
    // warning track
    for (let k = 0; k < 36; k++) { const a0 = -Math.PI / 4 + (k / 36) * Math.PI / 2, a1 = a0 + Math.PI / 72, r = wallR(a1) - 2.6; put('flat', new THREE.BoxGeometry(2 * Math.sin(Math.PI / 72) * r + 0.3, 0.02, 5), '#9a6a40', Math.sin(a1) * r, 0.03, -Math.cos(a1) * r, -a1); }
    // the outfield wall: brick warehouse bays (arched windows), green pad, yellow home-run line; tall warehouse wall in right field
    const NSEG = 30;
    for (let k = 0; k < NSEG; k++) { const a0 = -Math.PI / 4 + (k / NSEG) * Math.PI / 2, a1 = a0 + Math.PI / 2 / NSEG, am = (a0 + a1) / 2;
      const p0 = dirTo(a0, wallR(a0)), p1 = dirTo(a1, wallR(a1)), w = p0.distanceTo(p1) + 0.12, h = wallH(am), c = p0.clone().add(p1).multiplyScalar(0.5), ry = Math.atan2(-(p1.z - p0.z), p1.x - p0.x);
      put('brick', new THREE.BoxGeometry(w, h, 1.0), '#ffffff', c.x, h / 2, c.z, ry, 0, 0, w / 5.2, h / 5.2);
      put('ink', new THREE.BoxGeometry(w, 0.3, 1.3), '#1f4a2a', c.x, h + 0.15, c.z, ry);
      put('flat', new THREE.BoxGeometry(w, 0.12, 1.32), '#ffd23c', c.x, h + 0.36, c.z, ry);
      if (am < 0.2) for (let r = 0; r < 7; r++) { const rr = wallR(am) + 2.2 + r * 1.7; // left / centre-field bleachers behind the wall
        put('ink', new THREE.BoxGeometry(w * rr / wallR(am) + 0.1, 1.0 + r * 1.15, 1.7), r % 2 ? '#1d5a3a' : '#23683f', Math.sin(am) * rr, (1.0 + r * 1.15) / 2 + 2.4, -Math.cos(am) * rr, -am); }
    }
    for (const s of [-1, 1]) { const a = s * Math.PI / 4, top = dirTo(a, wallR(a)); put('ink', new THREE.CylinderGeometry(0.16, 0.16, 22, 8), '#ffd23c', top.x, 11, top.z); } // foul poles
    // the long brick warehouse behind right field, + a skyline of warehouses / lofts
    { const a = 0.55, c = dirTo(a, 150), len = 170, hgt = 30, ry = -a;
      put('ware', new THREE.BoxGeometry(len, hgt, 20), '#ffffff', c.x, hgt / 2, c.z, ry, 0, 0, len / 9, hgt / 9);
      put('ink', new THREE.BoxGeometry(len + 1, 1.6, 21), '#4a2a22', c.x, hgt + 0.8, c.z, ry);
      for (let i = -3; i <= 3; i++) { const q = c.clone().add(new THREE.Vector3(Math.cos(ry) * i * 22, 0, -Math.sin(ry) * i * 22)); put('ink', new THREE.BoxGeometry(3, 4, 3), '#3a2622', q.x, hgt + 3, q.z, ry); } }
    for (const [a, r, w, h] of [[-0.62, 215, 40, 46], [-0.32, 240, 34, 62], [-0.08, 255, 44, 38], [0.12, 230, 30, 54], [-0.85, 190, 30, 30], [0.95, 160, 36, 40]]) { const c = dirTo(a, r); put('ware', new THREE.BoxGeometry(w, h, 24), '#e8d8d0', c.x, h / 2, c.z, -a, 0, 0, w / 9, h / 9); }
    // side walls + stands down the lines (seen at the frame edges in landscape)
    for (const s of [-1, 1]) { const a = s * Math.PI / 4, n = new THREE.Vector3(Math.cos(a) * s, 0, Math.sin(a) * s);
      for (const [d0, d1] of [[14, 52], [52, 92]]) { const m = (d0 + d1) / 2, c = dirTo(a, m).add(n.clone().multiplyScalar(17)), w = d1 - d0;
        put('brick', new THREE.BoxGeometry(w, 2.6, 0.8), '#ffffff', c.x, 1.3, c.z, -a + s * Math.PI / 2 - s * Math.PI / 2 + (s > 0 ? -Math.PI / 2 : Math.PI / 2), 0, 0, w / 5.2, 0.5);
        for (let r = 0; r < 6; r++) { const cc = c.clone().add(n.clone().multiplyScalar(1.6 + r * 1.6)); put('ink', new THREE.BoxGeometry(w, 0.9 + r * 0.9, 1.6), r % 2 ? '#1d5a3a' : '#23683f', cc.x, (0.9 + r * 0.9) / 2 + 2, cc.z, s > 0 ? -a - Math.PI / 2 : -a + Math.PI / 2); } } }
    // light towers
    const towers = [[-0.62, 150], [-0.12, 158], [0.42, 142], [0.98, 120]];
    for (const [a, r] of towers) { const c = dirTo(a, r); put('ink', new THREE.CylinderGeometry(0.5, 0.8, 44, 8), '#2a2a32', c.x, 22, c.z); put('ink', new THREE.BoxGeometry(9, 4.2, 1.2), '#30303a', c.x, 45, c.z, -a); }
    D.grassM = bake('grass', toonMat({ map: GRASS }), false);
    bake('flat', toonMat(), false); bake('ink', toonMat(), true);
    bake('brick', toonMat({ map: BRICK }), true); bake('ware', toonMat({ map: WARE }), true);
    // light-bank glows
    const gm = new THREE.SpriteMaterial({ map: GLOW, color: '#fff2d0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    for (const [a, r] of towers) { const c = dirTo(a, r); for (let i = -1; i <= 1; i++) { const sp = new THREE.Sprite(gm); sp.position.set(c.x + Math.cos(-a) * i * 2.8, 45.3, c.z - Math.sin(-a) * i * 2.8); sp.scale.setScalar(9); SC.add(sp); } }
    // the crowd: one instanced mesh on the bleacher steps; bounces when a ball leaves the yard
    const CG = bakeColor(new THREE.BoxGeometry(0.9, 1.3, 0.6), '#ffffff'); const N = 520;
    const crowd = new THREE.InstancedMesh(CG, toonMat(), N); crowd.frustumCulled = false; const cols = ['#ff7a1a', '#ffffff', '#18141c', '#e84a3a', '#3a6aff', '#ffd23c', '#c8a8ff', '#ff9ad0', '#7a5a4a'];
    D.crowd = { mesh: crowd, base: [], ph: [] }; const cc = new THREE.Color(); let i = 0;
    while (i < N) { const am = -Math.PI / 4 + rng() * (0.2 + Math.PI / 4), r = Math.floor(rng() * 7), rr = wallR(am) + 2.2 + r * 1.7, y = 2.4 + 1.0 + r * 1.15 + 0.65;
      D.crowd.base.push([Math.sin(am) * rr, y, -Math.cos(am) * rr, -am]); D.crowd.ph.push(rng() * TAU); crowd.setColorAt(i, cc.set(cols[Math.floor(rng() * cols.length)])); i++; }
    crowdPose(0); SC.add(crowd);
  }
  function crowdPose(k) { const C = D.crowd; for (let i = 0; i < C.base.length; i++) { const b = C.base[i], j = k > 0 ? Math.abs(Math.sin(D.t * 9 + C.ph[i])) * 0.9 * k : 0;
    _e.set(0, b[3] + (k > 0 ? Math.sin(D.t * 5 + C.ph[i]) * 0.3 * k : 0), 0); _q.setFromEuler(_e); _m4.compose(_p.set(b[0], b[1] + j, b[2]), _q, _s); C.mesh.setMatrixAt(i, _m4); }
    C.mesh.instanceMatrix.needsUpdate = true; }

  // ---- Bobby: the stand-in rig (replaced by Opus's buildBirdBrainBobby() when it exists) ----
  function buildBobbyStandIn() {
    const mat = toonMat(); const J = {}; J.root = new THREE.Group(); J.mat = mat;
    const P = (g) => { g.userData.mat = mat; return g; };
    const ORA = '#ff7a1a', BLK = '#1a161e', BEL = '#fff1dc', BEAK = '#ffc21a';
    J.body = P(grp(J.root, 0, 1.05, 0)); J.torso = P(grp(J.body, 0, 0.1, 0)); J.head = P(grp(J.torso, 0, 1.05, 0.05));
    part(J.torso, G.sph(0.62, 0.72, 0.56), ORA, 0, 0.45, 0);                       // round orange body
    part(J.torso, G.sph(0.42, 0.5, 0.2), BEL, 0, 0.38, 0.42);                      // cream belly patch
    part(J.torso, G.sph(0.6, 0.42, 0.5), BLK, 0, 0.78, -0.08);                     // black back / shoulders
    part(J.torso, G.box(0.9, 0.12, 0.2), BLK, 0, 0.06, 0.38, { rot: [0.2, 0, 0] });  // belt
    // head: black hood, orange cheeks, big mismatched eyes, chipped beak, backwards cap with a mohawk crest poking through
    part(J.head, G.sph(0.46, 0.44, 0.44), BLK, 0, 0.18, 0);
    for (const s of [-1, 1]) part(J.head, G.sph(0.17, 0.15, 0.1), ORA, s * 0.27, 0.06, 0.33);
    part(J.head, G.sph(0.16, 0.19, 0.08), '#ffffff', -0.15, 0.27, 0.39); part(J.head, G.sph(0.11, 0.13, 0.07), '#ffffff', 0.15, 0.25, 0.4);
    part(J.head, G.sph(0.06, 0.08, 0.04), '#000000', -0.12, 0.25, 0.46, { outline: false }); part(J.head, G.sph(0.05, 0.06, 0.04), '#000000', 0.13, 0.23, 0.45, { outline: false });
    part(J.head, G.box(0.2, 0.04, 0.04), '#000000', -0.15, 0.48, 0.39, { rot: [0, 0, -0.35], outline: false }); // cocked eyebrow
    part(J.head, G.cyl(0.0, 0.13, 0.32, 8), BEAK, 0, 0.1, 0.52, { rot: [Math.PI / 2 + 0.15, 0, 0] });
    part(J.head, G.cyl(0.0, 0.1, 0.2, 8), '#e09a10', 0, 0.0, 0.47, { rot: [Math.PI / 2 - 0.25, 0, 0] });
    part(J.head, G.sph(0.44, 0.2, 0.44), BLK, 0, 0.42, -0.02);                                     // cap crown (backwards)
    part(J.head, G.box(0.42, 0.04, 0.3), BLK, 0, 0.38, -0.45, { rot: [-0.25, 0, 0] });             // brim to the back
    part(J.head, G.sph(0.06, 0.04, 0.06), ORA, 0, 0.61, -0.02);                                   // cap button
    for (const [x, h, r] of [[-0.09, 0.32, -0.25], [0, 0.4, 0], [0.09, 0.3, 0.25]]) part(J.head, G.cyl(0.02, 0.07, h, 6), ORA, x, 0.66 + h / 2 - 0.05, 0.06, { rot: [0.25, 0, r] });
    // wings = arms (black, orange tips), sweatbands; the right one throws
    for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
      const sh = J['w' + k] = P(grp(J.torso, s * 0.6, 0.72, 0)); const el = J['e' + k] = P(grp(sh, 0, -0.42, 0)); const ha = J['h' + k] = P(grp(el, 0, -0.38, 0));
      part(sh, G.sph(0.17, 0.26, 0.17), BLK, 0, -0.2, 0); part(el, G.sph(0.14, 0.24, 0.14), BLK, 0, -0.18, 0); part(el, G.cyl(0.12, 0.12, 0.08, 8), '#ffffff', 0, -0.33, 0);
      part(ha, G.sph(0.15, 0.13, 0.08), ORA, 0, -0.07, 0); for (const f of [-1, 0, 1]) part(ha, G.box(0.05, 0.16, 0.05), ORA, f * 0.07, -0.18, 0, { outline: false });
      const lg = J['lg' + k] = P(grp(J.body, s * 0.28, 0.05, 0)); const kn = J['kn' + k] = P(grp(lg, 0, -0.42, 0));
      part(lg, G.cap(0.1, 0.3), ORA, 0, -0.2, 0); part(kn, G.cap(0.08, 0.36), ORA, 0, -0.26, 0);
      part(kn, G.sph(0.2, 0.12, 0.32), '#ffffff', 0, -0.56, 0.1); part(kn, G.box(0.3, 0.04, 0.2), ORA, 0, -0.48, 0.14, { outline: false }); // big sneakers
    }
    part(J.hL, G.sph(0.24, 0.2, 0.12), '#5a3a22', 0, -0.12, 0.04);                     // mitt
    const R = mergeRig(J); R.hand = J.hR; return R;
  }
  const BP = { // Bobby pose targets (joint -> [x,y,z]), damped toward each frame
    idle: (t) => ({ body: [0.05, 0, Math.sin(t * 2) * 0.05], torso: [0, Math.sin(t * 1.3) * 0.15, 0], head: [Math.sin(t * 2.6) * 0.08, Math.sin(t * 0.9) * 0.3, 0], wL: [-0.3, 0, 0.5], eL: [-1.2, 0, 0], wR: [0.2, 0, -0.35], eR: [-0.3, 0, 0], lgL: [0, 0, 0.08], lgR: [0, 0, -0.08], knL: [0, 0, 0], knR: [0, 0, 0], y: 1.05 + Math.abs(Math.sin(t * 2)) * 0.03 }),
  };
  function bobbyWindup(type, u, t) { // the tells
    const p = BP.idle(0); p.head = [0.1, 0, 0];
    const a = ease(clamp(u / 0.35, 0, 1)), b = ease(clamp((u - 0.3) / 0.42, 0, 1)), c = ease(clamp((u - 0.74) / 0.26, 0, 1));
    p.wL = [lerp(-0.3, -1.2, a), 0, lerp(0.5, -0.2, a)]; p.eL = [-1.4, 0, 0]; p.wR = [lerp(0.2, -1.2, a), 0, lerp(-0.35, 0.2, a)]; p.eR = [-1.4, 0, 0];
    let kick = 1.5, turn = -0.7, armBack = 2.6, slot = 0;
    if (type === 'fast') kick = 2.1;                               // fastball: huge leg kick
    if (type === 'curve') { kick = 1.2; slot = -0.9; turn = -0.9; } // curve: drops the arm slot, leans over, wrist snap
    if (type === 'change') { kick = 1.6; }                         // changeup: slow, with a hang at the top (time-warped below)
    if (type === 'knuckle') { kick = 0.25; armBack = 1.6; }        // knuckler: no kick, short push + fluttering fingers
    p.lgL = [-kick * b * (1 - c) - 0.2 * c, 0, 0.08]; p.knL = [kick * 0.9 * b * (1 - c), 0, 0];
    p.torso = [lerp(0, -0.2, b) + c * 0.55, turn * b * (1 - c) + c * 0.5, slot * 0.25 * b];
    p.body = [0.05 + c * 0.35, 0, slot * 0.12 * b]; p.y = 1.05 + 0.06 * b - 0.12 * c;
    if (b > 0) { p.wR = [lerp(-1.2, armBack, b) * (1 - c) + lerp(armBack, -1.7, c) * c, 0, lerp(0.2, -0.5 + slot, b)]; p.eR = [lerp(-1.4, -0.4, b) - (1 - c) * 0.5 * b, 0, 0];
      p.wL = [lerp(-1.2, -1.5, b) + c * 1.2, 0, lerp(-0.2, 0.9, b)]; p.eL = [-0.3, 0, 0]; }
    p.lgR = [c * 0.5, 0, -0.08]; p.knR = [c * 0.6, 0, 0];
    if (type === 'knuckle') { const f = Math.sin(t * 38) * 0.25 * a; p.eR = [p.eR[0] + f, 0, f]; p.eL = [p.eL[0] - f, 0, -f]; p.head = [0.1, Math.sin(t * 9) * 0.25, 0]; }
    if (type === 'curve') p.eR = [p.eR[0], b * 1.2 * Math.sin(t * 14), 0];
    return p;
  }
  function bobbyPoseFor(state, u, t) {
    if (state === 'follow') { const p = bobbyWindup(D.pitch ? D.pitch.type : 'fast', 1, t); const k = ease(clamp(u, 0, 1)); p.wR = [-1.7 + k * 1.4, 0, -0.4 + k * 0.6]; p.torso = [0.55 - k * 0.5, 0.5 - k * 0.4, 0]; p.body = [0.4 - k * 0.3, 0, 0]; p.lgL = [-0.2 + k * 0.2, 0, 0.08]; p.knL = [0, 0, 0]; p.y = 0.93 + k * 0.1; return p; }
    if (state === 'cheer') { const p = BP.idle(t); const s = Math.sin(t * 16); p.wL = [-2.6 + s * 0.4, 0, 0.8]; p.wR = [-2.6 - s * 0.4, 0, -0.8]; p.eL = p.eR = [-0.2, 0, 0]; p.y = 1.05 + Math.abs(Math.sin(t * 8)) * 0.35; p.head = [-0.3, 0, 0]; return p; }
    if (state === 'mad') { const p = BP.idle(t); const s = Math.sin(t * 22); p.torso = [0.35, s * 0.25, 0]; p.head = [0.4, -s * 0.5, 0]; p.wL = [-0.8, 0, 1.2 + s * 0.3]; p.wR = [-0.8, 0, -1.2 + s * 0.3]; p.lgL = [-0.9 * Math.max(0, s), 0, 0.1]; p.knL = [0.9 * Math.max(0, s), 0, 0]; return p; }
    if (state === 'watch') { const p = BP.idle(t); p.torso = [-0.1, Math.PI * 0.85 * ease(clamp(u * 2, 0, 1)), 0]; p.head = [-0.5, 0.3, 0]; p.wL = [-0.5, 0, 0.6]; p.wR = [-0.5, 0, -0.6]; return p; }
    if (state === 'defeat') { const p = BP.idle(0); const k = ease(clamp(u * 1.6, 0, 1)); p.body = [-1.45 * k, 0, 0.1 * Math.sin(t * 3) * (1 - k)]; p.y = 1.05 - 0.62 * k; p.wL = [-2.6 * k, 0, 1.0]; p.wR = [-2.6 * k, 0, -1.0]; p.lgL = [-1.3 * k, 0, 0.3]; p.lgR = [-1.1 * k, 0, -0.3]; p.head = [0.3 * k, Math.sin(t * 4) * 0.4 * k, 0]; return p; }
    if (state === 'gloat') { const p = BP.idle(t); const s = Math.sin(t * 7); p.body = [0, 0, s * 0.2]; p.torso = [0, s * 0.5, 0]; p.wL = [-1.6, 0, 1.4 + s * 0.4]; p.wR = [-1.6, 0, -1.4 + s * 0.4]; p.eL = p.eR = [-0.8, 0, 0]; p.y = 1.05 + Math.abs(s) * 0.15; p.lgL = [-0.6 * Math.max(0, s), 0, 0.1]; p.lgR = [-0.6 * Math.max(0, -s), 0, -0.1]; return p; }
    return BP.idle(t);
  }
  function applyBobby(p, dt, r = 14) { const J = D.bob.J; if (!J) return;
    for (const k of ['body', 'torso', 'head', 'wL', 'eL', 'wR', 'eR', 'lgL', 'lgR', 'knL', 'knR']) { const g = J[k], v = p[k]; if (!g || !v) continue; g.rotation.x = damp(g.rotation.x, v[0], r, dt); g.rotation.y = damp(g.rotation.y, v[1], r, dt); g.rotation.z = damp(g.rotation.z, v[2], r, dt); }
    J.body.position.y = damp(J.body.position.y, p.y, r, dt); }
  function buildBobby() {
    let ext = null; try { if (typeof buildBirdBrainBobby === 'function') ext = buildBirdBrainBobby(); } catch (e) { console.error(e); ext = null; }
    if (!ext && typeof window.buildBirdBrainBobby === 'function') { try { ext = window.buildBirdBrainBobby(); } catch (e) { console.error(e); ext = null; } }
    if (ext) { const root = ext.isObject3D ? ext : ext.root; if (root) return { root, ext: ext.isObject3D ? {} : ext, J: null, hand: ext.hand || null, rig: 'opus' }; }
    const R = buildBobbyStandIn(); return { root: R.root, ext: null, J: R, hand: R.hand, rig: 'stand-in' };
  }
  function bobbyPose(state, u, dt) {
    D.bob.state = state; const ext = D.bob.ext;
    if (ext) { if (typeof ext.pose === 'function') { try { ext.pose(state, u, D.t, { pitch: D.pitch && D.pitch.type, dt }); } catch (e) { console.error(e); ext.pose = null; } } return; }
    applyBobby(state === 'windup' ? bobbyWindup(D.pitch.type, u, D.t) : bobbyPoseFor(state, u, D.t), dt, state === 'windup' ? 18 : 10);
  }

  // ---- Harold (his own rig instance; the city Harold stays put) ----
  function hStance(t) { const p = blank(); legsStance(p, 0.26, 0.55); p.torso = [0.22, -0.65, 0]; p.hips = [0, -0.3, 0]; p.neck = [-0.05, 1.0, 0];
    p.shR = [-2.0, 0, -0.85]; p.elR = [-1.25, 0, 0]; p.swR = [Math.PI / 2 + 0.75, 0, Math.sin(t * 3) * 0.18]; p.shL = [-1.35, 0, -0.25]; p.elL = [-1.3, 0, 0]; p.swL = [Math.PI / 2, 0, 0];
    p.y += Math.sin(t * 2.4) * 0.015; return p; }
  function hSwing(u, hi) { const p = hStance(0); const a = ease(clamp((u - 0.03) / 0.3, 0, 1)), f = ease(clamp((u - 0.33) / 0.5, 0, 1));
    p.torso = [0.22 + a * 0.1, lerp(-0.85, 1.05, a) + f * 0.45, 0]; p.hips = [0, lerp(-0.4, 0.55, a) + f * 0.2, 0]; p.neck = [-0.05, lerp(1.05, 0.15, a) - f * 0.6, 0];
    p.shR = [lerp(-2.0, -1.5 + hi * 0.45, a) - f * 0.5, 0, lerp(-1.1, 0.5, a) + f * 0.7]; p.elR = [lerp(-1.25, -0.1, a), 0, 0]; p.swR = [Math.PI / 2, 0, lerp(-0.5, 0.25, a) + f * 0.4];
    p.shL = [lerp(-1.35, -1.5 + hi * 0.45, a), 0, lerp(-0.25, 0.9, a) + f * 0.5]; p.elL = [lerp(-1.3, -0.3, a), 0, 0];
    p.lgL = [-0.55 * a, 0, 0.32]; p.knL = [0.55 * a, 0, 0]; p.ftR = [0.5 * a, 0, 0.4]; return p; }
  function hCheer(t) { const p = hStance(t); const s = Math.sin(t * 12); p.shR = [-2.9, 0, -0.3 + s * 0.2]; p.elR = [-0.2, 0, 0]; p.swR = [Math.PI / 2 + 0.2, 0, 0]; p.shL = [-2.7, 0, 0.4 - s * 0.2]; p.elL = [-0.3, 0, 0]; p.torso = [-0.1, 0, 0]; p.neck = [-0.3, 0.6, 0]; p.y += Math.abs(s) * 0.12; return p; }
  function hSlump(t) { const p = hStance(t); p.torso = [0.65, -0.2, 0]; p.neck = [0.4, 0.3, 0]; p.shR = [0.1, 0, -0.2]; p.elR = [-0.2, 0, 0]; p.swR = [Math.PI - 0.3, 0, 0]; p.shL = [0.1, 0, 0.2]; p.elL = [-0.2, 0, 0]; return p; }

  // ---- ball, trail, aim reticle, pitch ghost, glow ----
  let BALL, TRAIL, TRG, RET, GHOST, HGLOW, ZONE, FW;
  const TN = 22, tpts = [];
  function buildFx() {
    const g = new THREE.Group(); g.userData.mat = toonMat(); SC.add(g); BALL = g;
    part(g, new THREE.SphereGeometry(0.11, 14, 10), '#fbfaf2'); part(g, new THREE.TorusGeometry(0.105, 0.012, 4, 16), '#e03a2a', 0, 0, 0, { outline: false, rot: [0.6, 0.3, 0] });
    g.visible = false;
    TRG = new THREE.BufferGeometry(); TRG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TN * 2 * 3), 3)); TRG.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TN * 2 * 3), 3));
    const idx = []; for (let i = 0; i < TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } TRG.setIndex(idx);
    TRAIL = new THREE.Mesh(TRG, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); TRAIL.frustumCulled = false; SC.add(TRAIL);
    const ringM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, fog: false });
    RET = new THREE.Group(); SC.add(RET); RET.renderOrder = 5;
    const r1 = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.125, 28), ringM); r1.renderOrder = 5; RET.add(r1);
    for (let k = 0; k < 4; k++) { const tk = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.07), ringM); tk.renderOrder = 5; const a = k * Math.PI / 2; tk.position.set(Math.sin(a) * 0.17, Math.cos(a) * 0.17, 0); tk.rotation.z = -a; RET.add(tk); }
    GHOST = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.13, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false })); GHOST.renderOrder = 4; SC.add(GHOST);
    { const pts = [[-0.28, 0.48], [0.28, 0.48], [0.28, 1.12], [-0.28, 1.12], [-0.28, 0.48]].map(([x, y]) => new THREE.Vector3(x, y, PLATE_Z));
      ZONE = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, depthWrite: false, fog: false })); SC.add(ZONE); }
    HGLOW = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#ffffff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false })); HGLOW.scale.setScalar(1.1); SC.add(HGLOW);
    // shadows (blobs)
    const sm = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.32, depthWrite: false });
    D.shH = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), sm); D.shH.rotation.x = -Math.PI / 2; SC.add(D.shH);
    D.shB = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), sm); D.shB.rotation.x = -Math.PI / 2; SC.add(D.shB);
    D.shBall = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), sm); D.shBall.rotation.x = -Math.PI / 2; SC.add(D.shBall);
    // fireworks: one Points pool
    const NF = 900, fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 3).fill(-999), 3)); fg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NF * 3), 3));
    const pts = new THREE.Points(fg, new THREE.PointsMaterial({ size: 3.4, map: GLOW, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); pts.frustumCulled = false; SC.add(pts);
    FW = { pts, g: fg, n: NF, p: [], next: 0, shells: [], live: 0 }; for (let i = 0; i < NF; i++) FW.p.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, c: new THREE.Color() });
  }
  function fwSpark(x, y, z, vx, vy, vz, col, life) { const P = FW.p[FW.next]; FW.next = (FW.next + 1) % FW.n; Object.assign(P, { x, y, z, vx, vy, vz, life, max: life }); P.c.copy(col); }
  const FWC = ['#ff7a1a', '#ffd23c', '#ffffff', '#ff3d6e', '#7dffc0', '#6fd8ff', '#c8a8ff'].map((c) => new THREE.Color(c));
  function fwShell(x, z, h, big = 1) { FW.shells.push({ x, y: 2, z, vy: 34 + rng() * 10, top: h, big, col: FWC[Math.floor(rng() * FWC.length)], col2: FWC[Math.floor(rng() * FWC.length)] }); dsfx('launch'); }
  function fwTick(dt) {
    for (let i = FW.shells.length - 1; i >= 0; i--) { const s = FW.shells[i]; s.y += s.vy * dt; s.vy -= 9 * dt; fwSpark(s.x + rnd(-0.2, 0.2), s.y, s.z, rnd(-1, 1), -3, rnd(-1, 1), FWC[1], 0.35);
      if (s.y >= s.top || s.vy < 4) { const n = Math.round(80 * s.big); for (let k = 0; k < n; k++) { const u = rng() * 2 - 1, a = rng() * TAU, r = Math.sqrt(1 - u * u), sp = (16 + rng() * 6) * s.big; fwSpark(s.x, s.y, s.z, r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp, k % 3 ? s.col : s.col2, 1.3 + rng() * 0.7); } FW.shells.splice(i, 1); dsfx('boom'); } }
    const P = FW.g.attributes.position.array, C = FW.g.attributes.color.array; let live = 0;
    for (let i = 0; i < FW.n; i++) { const q = FW.p[i]; if (q.life <= 0) { if (P[i * 3 + 1] !== -999) { P[i * 3 + 1] = -999; C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = 0; } continue; }
      live++; q.life -= dt; const dr = Math.exp(-1.6 * dt); q.vx *= dr; q.vy = q.vy * dr - 9 * dt * 0.6; q.vz *= dr; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const k = clamp(q.life / q.max, 0, 1), f = k * k * (0.75 + 0.25 * Math.sin(q.life * 40 + i));
      P[i * 3] = q.x; P[i * 3 + 1] = q.y; P[i * 3 + 2] = q.z; C[i * 3] = q.c.r * f; C[i * 3 + 1] = q.c.g * f; C[i * 3 + 2] = q.c.b * f; }
    FW.live = live; FW.g.attributes.position.needsUpdate = true; FW.g.attributes.color.needsUpdate = true;
  }

  // ---- sound (Web Audio, procedural) ----
  function dsfx(kind) {
    if (!AC || AC.state !== 'running') return; const t = AC.currentTime; const out = SFXBUS || AC.destination;
    try {
      const g = AC.createGain(); g.connect(out); const nz = () => { const s = AC.createBufferSource(); s.buffer = NOISE; return s; };
      if (kind === 'crack') { const s = nz(), f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800; s.connect(f); f.connect(g); const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(400, t + 0.06); o.connect(g);
        g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); s.start(t); s.stop(t + 0.18); o.start(t); o.stop(t + 0.08); }
      else if (kind === 'tick') { const s = nz(), f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; s.connect(f); f.connect(g); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); s.start(t); s.stop(t + 0.08); }
      else if (kind === 'pop') { const s = nz(), f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; s.connect(f); f.connect(g); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); s.start(t); s.stop(t + 0.1); }
      else if (kind === 'cheer' || kind === 'roar') { const L = kind === 'roar' ? 4.5 : 2.2; for (const fq of [700, 1300, 2100]) { const s = nz(); s.loop = true; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = 0.8; s.connect(f); f.connect(g); s.start(t); s.stop(t + L); }
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(kind === 'roar' ? 0.5 : 0.32, t + 0.35); g.gain.setTargetAtTime(0.0001, t + L * 0.5, L * 0.18); }
      else if (kind === 'boo') { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.linearRampToValueAtTime(95, t + 0.9); const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; o.connect(f); f.connect(g);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0); o.start(t); o.stop(t + 1.0); }
      else if (kind === 'boom') { const s = nz(), f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.6); s.connect(f); f.connect(g); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); s.start(t); s.stop(t + 0.4); }
      else if (kind === 'launch') { const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(1800, t + 0.5); o.connect(g); g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); o.start(t); o.stop(t + 0.55); }
      else if (kind === 'organ' || kind === 'sad') { // the ballpark organ: "charge!" (or a sad slide on a loss)
        const N = kind === 'organ' ? [[392, 0], [523, 0.16], [659, 0.32], [784, 0.48], [659, 0.72], [784, 0.84]] : [[392, 0], [370, 0.3], [349, 0.6], [330, 0.9]];
        for (const [fq, at] of N) { const o = AC.createOscillator(), o2 = AC.createOscillator(), gg = AC.createGain(); o.type = 'square'; o2.type = 'triangle'; o.frequency.value = fq; o2.frequency.value = fq * 2; o.connect(gg); o2.connect(gg); gg.connect(out);
          const d = kind === 'organ' ? (at > 0.8 ? 0.5 : 0.14) : 0.32; gg.gain.setValueAtTime(0.0001, t + at); gg.gain.exponentialRampToValueAtTime(0.06, t + at + 0.02); gg.gain.exponentialRampToValueAtTime(0.0001, t + at + d); o.start(t + at); o2.start(t + at); o.stop(t + at + d + 0.02); o2.stop(t + at + d + 0.02); } }
      else sfx(kind);
    } catch (e) { /* audio is optional */ }
  }

  // ---- HUD (DOM) ----
  const css = document.createElement('style');
  css.textContent = `
  #dby { position: fixed; left: 0; top: 0; width: 100vw; height: 100dvh; pointer-events: none; z-index: 40; display: none; font-family: 'PX', 'Courier New', monospace; color: #fff; }
  body.touch #dby { height: calc(100dvh - var(--panel)); }
  body.derby #dby { display: block; }
  body.derby #hpbox, body.derby #p2, body.derby #ko, body.derby #combo, body.derby #lmk, body.derby #lmkb, body.derby #mmap, body.derby #hint, body.derby #prompt, body.derby #face, body.derby #clock, body.derby #banner, body.derby #bark, body.derby #qbtn, body.derby #title, body.derby #proto { display: none !important; }
  #dbS { position: absolute; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 36px); transform: translateX(-50%); display: flex; gap: 6px; align-items: stretch; }
  #dbS > div { background: #1b1030ee; border: 3px solid #000; box-shadow: 3px 3px 0 #000, inset 0 0 0 2px #ff7a1a; padding: 6px 9px 5px; text-align: center; min-width: 74px; }
  #dbS b { display: block; white-space: nowrap; font-size: 8px; color: #ffd23c; letter-spacing: 1px; margin-bottom: 4px; }
  #dbS span { font-size: 15px; } #dbS small { font-size: 8px; color: #ccc; }
  #dbS .pips { display: flex; gap: 2px; justify-content: center; margin-top: 4px; } #dbS .pips i { width: 5px; height: 5px; background: #3a2a50; display: block; }
  #dbS .hr .pips i.on { background: #7dffc0; } #dbS .out .pips i.on { background: #ff3d6e; }
  #dbW { position: absolute; left: 50%; top: 34%; transform: translate(-50%, -50%) scale(.6); font-size: clamp(22px, 7vw, 54px); white-space: nowrap; opacity: 0; transition: transform .18s, opacity .18s;
    text-shadow: 4px 4px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000; text-align: center; }
  #dbW.on { opacity: 1; transform: translate(-50%, -50%) scale(1); } #dbW small { display: block; font-size: .36em; margin: 10px auto 0; color: #ffd23c; white-space: normal; width: min(86vw, 640px); line-height: 1.5; }
  #dbP { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); font-size: 10px; background: #000a; padding: 6px 10px; border: 2px solid #000; white-space: nowrap; opacity: 0; transition: opacity .2s; }
  #dbP.on { opacity: 1; }
  #dbB { position: absolute; max-width: min(260px, 70vw); background: #2a1650; color: #fff; border: 3px solid #000; box-shadow: 3px 3px 0 #000, inset 0 0 0 2px #ff7a1a; padding: 7px 10px 8px; font: 800 14px/1.25 system-ui, sans-serif; transform: translate(-50%, -100%); opacity: 0; transition: opacity .2s; }
  #dbB.on { opacity: 1; } #dbB b { display: block; color: #ffd23c; font: 9px 'PX', monospace; margin-bottom: 4px; }
  #dbC { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(420px, 88vw); background: #1b1030f2; border: 4px solid #000; box-shadow: 5px 5px 0 #000, inset 0 0 0 3px #ff7a1a; padding: 16px 14px; text-align: center; display: none; pointer-events: auto; }
  #dbC.on { display: block; } #dbC h2 { font-size: clamp(13px, 4vw, 18px); color: #ffd23c; margin: 0 0 10px; line-height: 1.4; } #dbC p { font: 700 13px/1.45 system-ui, sans-serif; margin: 6px 0; color: #eee; }
  #dbC button { font: 11px 'PX', monospace; background: #ff7a1a; color: #000; border: 3px solid #000; box-shadow: 3px 3px 0 #000; padding: 10px 14px; margin: 10px 6px 0; cursor: pointer; }
  #dbC button.alt { background: #ccc; }
  #dbQ { position: absolute; left: 8px; top: calc(env(safe-area-inset-top, 0px) + 36px); pointer-events: auto; font: 9px 'PX', monospace; background: #1b1030; color: #fff; border: 2px solid #000; box-shadow: 2px 2px 0 #000; padding: 7px 8px; cursor: pointer; }
  #dbH { position: absolute; left: 50%; bottom: 46px; transform: translateX(-50%); font-size: 8px; color: #fff; text-shadow: 1px 1px 0 #000; white-space: nowrap; opacity: .9; }
  @media (max-width: 480px) { #dbS > div { min-width: 64px; padding: 5px 6px 4px; } #dbS b { font-size: 7px; letter-spacing: 0; } #dbS span { font-size: 12px; } #dbQ { top: calc(env(safe-area-inset-top, 0px) + 100px); } #dbH { font-size: 7px; } }`;
  document.head.appendChild(css);
  const hudEl = document.createElement('div'); hudEl.id = 'dby';
  hudEl.innerHTML = '<div id="dbS"><div class="hr"><b>HOMERS</b><span id="dbHR">0</span><small>/10</small><div class="pips" id="dbHRp"></div></div><div class="out"><b>OUTS</b><span id="dbOU">0</span><small>/10</small><div class="pips" id="dbOUp"></div></div><div><b>LAST HIT</b><span id="dbFT">--</span><small> FT</small></div></div>' +
    '<div id="dbW"></div><div id="dbP"></div><div id="dbB"><b>BIRD BRAIN BOBBY</b><span></span></div><div id="dbH"></div><button id="dbQ" type="button">✕ QUIT</button>' +
    '<div id="dbC"><h2></h2><div class="txt"></div><div class="btns"></div></div>';
  document.body.appendChild(hudEl);
  for (const id of ['dbHRp', 'dbOUp']) $(id).innerHTML = '<i></i>'.repeat(10);
  for (const ev of ['pointerdown', 'touchstart']) $('dbQ').addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  $('dbQ').addEventListener('click', (e) => { e.stopPropagation(); exit('quit'); });
  $('dbC').addEventListener('pointerdown', (e) => e.stopPropagation());
  function hudScore() { $('dbHR').textContent = D.homers; $('dbOU').textContent = D.outs; $('dbFT').textContent = D.lastFt ? D.lastFt : '--';
    $('dbHRp').querySelectorAll('i').forEach((x, i) => x.classList.toggle('on', i < D.homers)); $('dbOUp').querySelectorAll('i').forEach((x, i) => x.classList.toggle('on', i < D.outs)); }
  let wordT = 0, bubT = 0, pT = 0;
  function word(txt, sub, col = '#fff', t = 1.6) { const w = $('dbW'); w.innerHTML = txt + (sub ? '<small>' + sub + '</small>' : ''); w.style.color = col; w.classList.add('on'); wordT = t; }
  function pinfo(txt, col, t = 1.6) { const e = $('dbP'); e.textContent = txt; e.style.color = col || '#fff'; e.classList.add('on'); pT = t; }
  function say(kind) { const lines = (LM && LM.boss && LM.boss.lines) || (GR1.bosses && GR1.bosses.bird_brain_bobby) || {}; const arr = lines[kind] || []; if (!arr.length) return null;
    const ln = arr[D.lineI[kind] % arr.length]; D.lineI[kind]++; $('dbB').querySelector('span').textContent = ln; $('dbB').classList.add('on'); bubT = 3.4; D.log.push({ say: kind, line: ln }); return ln; }
  function card(title, html, btns) { const c = $('dbC'); c.querySelector('h2').innerHTML = title; c.querySelector('.txt').innerHTML = html; const b = c.querySelector('.btns'); b.innerHTML = '';
    for (const [lab, fn, alt] of btns) { const el = document.createElement('button'); el.type = 'button'; el.textContent = lab; if (alt) el.className = 'alt'; el.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); b.appendChild(el); }
    c.classList.add('on'); }
  const hideCard = () => $('dbC').classList.remove('on');

  // ---- input: timestamps so a swing counts when it was pressed, not when the next frame saw it ----
  const SWK = new Set([' ', 'j', 'k', 'e', 'enter', 'l']);
  addEventListener('keydown', (e) => { if (!D.on || e.repeat) return; const k = e.key.toLowerCase(); if (SWK.has(k)) { D.keyT = e.timeStamp || performance.now(); D.keyPend = true; } if (k === 'escape') exit('quit'); }, { capture: true });
  canvas.addEventListener('pointerdown', (e) => { if (!D.on) return; if (e.pointerType === 'mouse' && e.button !== 0) return; D.ptrT = e.timeStamp || performance.now(); D.ptrPend = true; if (e.pointerType === 'mouse') aimFromMouse(e); });
  canvas.addEventListener('pointermove', (e) => { if (!D.on || e.pointerType !== 'mouse') return; aimFromMouse(e); });
  function aimFromMouse(e) { const r = canvas.getBoundingClientRect(); D.aim.mx = ((e.clientX - r.left) / r.width) * 2 - 1; D.aim.my = -((e.clientY - r.top) / r.height) * 2 + 1; D.aim.mouse = true; D.aim.mT = D.t; }
  const RAY = new THREE.Raycaster(), PLN = new THREE.Plane(new THREE.Vector3(0, 0, 1), -PLATE_Z), _hit = new THREE.Vector3(), _ndc = new THREE.Vector2();
  function mouseAim() { _ndc.set(D.aim.mx, D.aim.my); RAY.setFromCamera(_ndc, CAMD); if (!RAY.ray.intersectPlane(PLN, _hit)) return null; return { x: clamp(_hit.x, -1.2, 1.2), y: clamp(_hit.y, 0, 2.2) }; }
  const mouseMode = () => D.aim.mouse && !TOUCH && D.t - D.aim.mT < 4 && !D.bot;

  // ---- pitches ----
  function level() { return clamp(D.pitches / 26, 0, 1); }
  function choosePitch() {
    const n = D.pitches, lv = level(); let pool;
    if (n < 4) pool = [['fast', 1]]; else if (n < 8) pool = [['fast', 2], ['change', 1]]; else if (n < 14) pool = [['fast', 2], ['change', 1], ['curve', 1.4]];
    else pool = [['fast', 2], ['change', 1.2], ['curve', 1.6], ['knuckle', 1.1 + lv]];
    let s = pool.reduce((a, b) => a + b[1], 0) * rng(); let type = pool[0][0]; for (const [t, w] of pool) { if ((s -= w) <= 0) { type = t; break; } }
    const P = PT[type], T = lerp(P.T[0], P.T[1], lv) * (0.97 + rng() * 0.06), mph = Math.round(lerp(P.mph[0], P.mph[1], lv) + rng() * 2);
    const waste = n >= 10 && rng() < 0.12 + lv * 0.08; // now and then a pitch off the plate: take it for a BALL
    const tx = waste ? (rng() < 0.5 ? -1 : 1) * (0.42 + rng() * 0.15) : (rng() * 2 - 1) * 0.22, ty = waste ? 0.55 + rng() * 0.6 : 0.58 + rng() * 0.46;
    const side = rng() < 0.5 ? -1 : 1, ph = rng() * TAU, wind = P.wind * lerp(1, 0.78, lv) * (type === 'change' ? 1 : 1);
    return { type, T, mph, tx, ty, side, ph, wind, waste, tRel: 0, tArr: 0, swung: false, res: null };
  }
  const brk = (P, u, out) => { // the pitch's break (m) at progress u (0 release .. 1 plate); the crossing point is exact at u = 1
    let dx = 0, dy = 0;
    if (P.type === 'fast') { dy = 0.06 * u; }
    else if (P.type === 'curve') { dy = -0.62 * u * u; dx = 0.32 * u * u * P.side; }
    else if (P.type === 'change') { dy = -0.28 * u * u; dx = -0.14 * u * u; }
    else if (P.type === 'knuckle') { dx = 0.15 * Math.sin(u * 8.5 + P.ph) * u; dy = 0.11 * Math.sin(u * 6.3 + P.ph * 1.7) * u; }
    out.x = dx; out.y = dy; return out; };
  const _b = { x: 0, y: 0 }, _b1 = { x: 0, y: 0 };
  function pitchPos(P, t, out) { // ball position at derby time t during the pitch (keeps flying past the plate to the catcher)
    const u = (t - P.tRel) / P.T; brk(P, 1, _b1);
    const sx = REL.x, sy = REL.y, sz = REL.z, ex = P.tx - _b1.x, ey = P.ty - _b1.y, ez = PLATE_Z;
    if (u <= 1) { brk(P, u, _b); return out.set(sx + (ex - sx) * u + _b.x, sy + (ey - sy) * u + _b.y, sz + (ez - sz) * u); }
    const du = u - 1; brk(P, 0.98, _b); const px = sx + (ex - sx) * 0.98 + _b.x, py = sy + (ey - sy) * 0.98 + _b.y, pz = sz + (ez - sz) * 0.98;
    return out.set(P.tx + (P.tx - px) * du * 50, P.ty + (P.ty - py) * du * 50, Math.min(PLATE_Z + (ez - sz) * du, 1.25));
  }

  // ---- hit physics ----
  function simFlight(v, la, phi, y0 = 0.9) { // gravity + quadratic drag; returns sampled points (1/60 s) + landing + wall check
    const pts = []; let x = 0, y = y0, z = 0; const vh = v * Math.cos(la), vy0 = v * Math.sin(la); let vx = vh * Math.sin(phi), vz = -vh * Math.cos(phi), vy = vy0;
    const dt = 1 / 120; let t = 0, wallHit = null, over = false, land = 0; const R = wallR(phi), H = wallH(phi);
    for (let i = 0; i < 1600; i++) { const s = Math.hypot(vx, vy, vz); vx -= KDRAG * s * vx * dt; vz -= KDRAG * s * vz * dt; vy -= (GRAV + KDRAG * s * vy) * dt; x += vx * dt; y += vy * dt; z += vz * dt; t += dt;
      if (i % 2 === 1) pts.push([x, y, z]);
      const d = Math.hypot(x, z);
      if (!wallHit && Math.abs(phi) <= Math.PI / 4 + 0.01 && d >= R) { wallHit = { y, t }; if (y > H + 0.36) over = true; else { vx *= -0.35; vz *= -0.35; } }
      if (y <= 0 && t > 0.05) { if (!land) land = Math.hypot(x, z); if (vy < -2 && pts.length < 1500) { vy = -vy * 0.32; vx *= 0.6; vz *= 0.6; y = 0.001; if (Math.abs(vy) < 1.5) break; continue; } break; } }
    return { pts, over, wallHit, t, land: land || Math.hypot(x, z) };
  }
  function resolveContact(P, ts, aim) { // -> {kind, ...} or null (whiff)
    const tc = ts + SL, e = tc - P.tArr; const ball = pitchPos(P, clamp(tc, P.tRel, P.tArr + 0.25), new THREE.Vector3());
    if (Math.abs(e) > WIN_T) return null;
    let dv = 0, dh = 0, phiB = 0, laB = 0;
    if (aim.mouse) { dv = aim.y - ball.y; dh = aim.x - ball.x; if (Math.hypot(dv, dh) > AIM_R) return null; }
    else { phiB = aim.bx * 0.32; laB = aim.by * 0.17; }
    const qt = Math.abs(e) <= PERFECT_T ? 1 : 1 - (Math.abs(e) - PERFECT_T) / (WIN_T - PERFECT_T), qa = 1 - 0.55 * Math.pow(Math.hypot(dv, dh) / AIM_R, 2);
    const v = 21 + 26 * Math.pow(clamp(qt, 0, 1), 1.1) * qa;
    let la = (30 - dv * 125) * Math.PI / 180 + laB, phi = (e / WIN_T) * 0.98 + dh * 1.1 + phiB;
    if (qt < 0.97) { la += (rng() - 0.5) * 0.12; phi += (rng() - 0.5) * 0.1; }
    if (qt < 0.45) la -= (0.45 - qt) * 0.9 * (rng() < 0.5 ? 1 : -1.6); // mishits: topped grounders or pop-ups
    la = clamp(la, -0.35, 1.45);
    const F = simFlight(v, la, phi, ball.y); const ft = Math.round(F.land * FT); // a homer's distance = where it would have landed
    let kind, why = '';
    if (Math.abs(phi) > Math.PI / 4) { kind = 'FOUL'; why = phi < 0 ? 'down the left-field line' : 'down the right-field line'; }
    else if (F.over) kind = 'HR';
    else { const d = F.land, ldeg = la * 180 / Math.PI, gap = Math.abs(Math.sin(phi * 9 + v)) > 0.45;
      if (ldeg > 52) { kind = 'OUT'; why = 'pop-up'; }
      else if (ldeg < 9) { kind = v > 37 && gap ? 'SINGLE' : 'OUT'; why = kind === 'OUT' ? 'grounder' : 'through the infield'; }
      else if (F.wallHit) { kind = 'SINGLE'; why = 'off the wall'; }
      else if (ldeg < 24 && d > 40 && gap) { kind = 'SINGLE'; why = 'line drive'; }
      else { kind = 'OUT'; why = ldeg < 24 ? 'lined out' : 'fly out'; } }
    return { kind, why, v, la, phi, e, qt, qa, ft: kind === 'FOUL' ? 0 : ft, F, ball, tc, perfect: qt >= 1 && qa > 0.98 };
  }

  // ---- flow ----
  function reset() { D.homers = 0; D.outs = 0; D.pitches = +(Q.get('dpitch') || 0); // ?dpitch=N: start the pitch mix / speed further on (tests)
    D.lastFt = 0; D.pitch = null; D.swing = null; D.hit = null; D.results = { HR: 0, OUT: 0, SINGLE: 0, FOUL: 0, STRIKE: 0, BALL: 0 }; D.lineI = D.lineI || { intro: 0, defeat: 0 }; hudScore(); }
  function setState(s) { D.state = s; D.st = 0; }
  function start(mode) {
    if (D.on) return; if (!D.built) build();
    D.on = true; D.runs++; D.bot = mode === 'perfect' || mode === 'miss' ? mode : null; rs = +(Q.get('dseed') || 0) || ((Date.now() & 0xffff) + 1); if (D.bot) rs = 4242;
    reset(); D.t = 0; D.cheer = 0; D.won = false; document.body.classList.add('derby'); hideCard();
    try { if (FMAP.F.open) FMAP.close('derby'); } catch (e) {}
    try { if (window.__radio && __radio.duckTo) __radio.duckTo(0.2); } catch (e) {}
    D.saved = { fogC: OUT_U.fogC.value.clone(), fogN: OUT_U.fogN.value, fogF: OUT_U.fogF.value };
    OUT_U.fogC.value.copy(FOG); OUT_U.fogN.value = 170; OUT_U.fogF.value = 520;
    KEYS.clear(); PRESS.clear(); D.keyPend = D.ptrPend = false;
    $('dbH').textContent = TOUCH ? 'TAP TO SWING · STICK = AIM (OPTIONAL)' : 'SPACE / CLICK / A TO SWING · MOUSE AIMS';
    setState('intro'); say('intro'); dsfx('organ'); D.log.push({ ev: 'start', mode: mode || 'play', rig: D.bob.rig });
  }
  function exit(why) {
    if (!D.on) return; D.on = false; D.bot = null; document.body.classList.remove('derby'); hideCard(); $('dbB').classList.remove('on'); $('dbW').classList.remove('on'); $('dbP').classList.remove('on');
    try { if (window.__radio && __radio.duckTo) __radio.duckTo(1); } catch (e) {}
    if (D.saved) { OUT_U.fogC.value.copy(D.saved.fogC); OUT_U.fogN.value = D.saved.fogN; OUT_U.fogF.value = D.saved.fogF; }
    KEYS.clear(); PRESS.clear(); IN.dragX = IN.dragY = 0; D.log.push({ ev: 'exit', why }); setState('off');
    resize(); last = performance.now();
  }
  function nextPitch() { if (D.homers >= RULE.homers || D.outs >= RULE.outs) return; D.pitch = choosePitch(); D.swing = D.swing && D.swing.t0 > D.t - 0.5 ? D.swing : null; D.hit = null; setState('windup'); }
  function result(kind, extra = {}) {
    D.results[kind] = (D.results[kind] || 0) + 1; D.pitches++;
    const P = D.pitch; D.log.push({ n: D.pitches, pitch: P.type, mph: P.mph, res: kind, ft: extra.ft || 0, e: extra.e != null ? +extra.e.toFixed(3) : null, why: extra.why || '' });
    if (kind === 'HR') { D.homers++; D.lastFt = extra.ft; D.best = Math.max(D.best, extra.ft); }
    else if (kind === 'OUT' || kind === 'STRIKE') D.outs++;
    if (extra.ft) D.lastFt = extra.ft;
    hudScore(); setState('result'); D.resKind = kind;
  }
  function win() { D.won = true; D.wins++; setState('win'); D.said = false; word('YOU WIN!', 'BIRD BRAIN BOBBY IS OUTTA HERE', '#7dffc0', 2.6); dsfx('roar'); dsfx('organ');
    BOSS_CLEAR.clear(LMID, { how: 'home run derby', homers: D.homers, outs: D.outs, best: D.best, pitches: D.pitches });
    D.log.push({ ev: 'win', homers: D.homers, outs: D.outs, best: D.best }); }
  function lose() { D.losses++; setState('lose'); word("YOU'RE OUT!", '10 OUTS', '#ff3d6e', 3.5); say('intro'); dsfx('sad'); D.log.push({ ev: 'lose', homers: D.homers, outs: D.outs }); }
  function endCard() {
    if (D.lastEnd === 'win') card('ORIOLE PARK CLEARED!', `<p>${D.homers} homers, ${D.outs} outs. Longest: ${D.best} ft.</p><p>Bird Brain Bobby is grounded. The West Side breathes easier.</p>`, [['BACK TO THE CITY', () => exit('win')]]);
    else card('BOBBY WINS THIS ONE', `<p>${D.homers} homers before 10 outs. You need 10.</p><p>Watch his windup: red kick = fastball, blue drop = curve, green hang = changeup, yellow flutter = knuckler.</p>`, [['RETRY', () => { hideCard(); D.on = false; start(D.lastMode); }], ['LEAVE', () => exit('lose'), true]]);
  }
  function doSwing(ts, aim) {
    D.swing = { t0: ts, hi: aim.mouse ? clamp((aim.y - 0.8) / 0.4, -1, 1) : clamp(aim.by || 0, -1, 1) }; dsfx('swing');
    const P = D.pitch; if (!P || P.swung || D.state !== 'pitch') { D.log.push({ ev: 'swing-idle', st: D.state }); return; }
    P.swung = true; P.swingT = ts; const r = resolveContact(P, ts, aim); P.res = r || { kind: 'WHIFF', tc: ts + SL, e: ts + SL - P.tArr };
  }
  function build() {
    buildPark(); buildFx(); D.bob = buildBobby(); SC.add(D.bob.root); D.bob.root.position.set(0, 0.26, MOUND_Z); D.bob.root.scale.setScalar(1.05);
    D.har = buildHero(); SC.add(D.har.root); D.har.root.position.set(-0.98, 0.04, 0.12); D.har.root.rotation.y = Math.PI / 2; applyPose(D.har, hStance(0), 60, 1, true);
    D.built = true;
  }

  // ---- camera ----
  const BASE = { pos: new THREE.Vector3(), look: new THREE.Vector3() }; const _cl = new THREE.Vector3(), _cp = new THREE.Vector3(), _tmp = new THREE.Vector3();
  function baseView() { const a = VW() / Math.max(1, VH());
    if (a < 0.8) { BASE.pos.set(0.3, 2.6, 7.4); BASE.look.set(-0.2, 0.75, -18); CAMD.fov = 50; }
    else { BASE.pos.set(0.95, 2.45, 6.8); BASE.look.set(-0.3, 0.95, -18); CAMD.fov = 38; }
    CAMD.aspect = a; CAMD.updateProjectionMatrix(); }
  const CAMS = { look: new THREE.Vector3(0, 1.6, -18), pos: new THREE.Vector3(0, 1.7, 4.4), shake: 0 };

  // ---- the step ----
  const _bp = new THREE.Vector3();
  function step(dt) {
    D.t += dt; D.st += dt; const P = D.pitch;
    // swing input (bot / keys / pointer / pad / panel buttons via PRESS)
    let swingAt = null; const now = performance.now();
    if (D.keyPend) { swingAt = D.t - clamp((now - D.keyT) / 1000, 0, 0.1); D.keyPend = false; }
    if (D.ptrPend) { swingAt = D.t - clamp((now - D.ptrT) / 1000, 0, 0.1); D.ptrPend = false; }
    if (['j', 'k', 'e', ' ', 'enter'].some((k) => PRESS.has(k)) && swingAt === null) swingAt = D.t;
    PRESS.clear();
    let aim = { mouse: false, bx: IN.mx, by: IN.my };
    if (mouseMode()) { const m = mouseAim(); if (m) aim = { mouse: true, x: m.x, y: m.y }; }
    if (D.bot && P && D.state === 'pitch' && !P.swung) { const ts = D.bot === 'perfect' ? P.tArr - SL : P.tArr - SL - 0.42;
      if (D.t >= ts) { swingAt = ts; if (D.bot === 'perfect') { const b = pitchPos(P, P.tArr, _tmp); aim = { mouse: true, x: b.x, y: b.y }; } else aim = { mouse: false, bx: 0, by: 0 }; } }
    if (D.state === 'intro' || D.state === 'win' || D.state === 'lose' || D.state === 'card') swingAt = null;
    if (swingAt !== null && (!D.swing || D.t - D.swing.t0 > 0.55)) doSwing(swingAt, aim);
    D.aimNow = aim;

    if (D.state === 'intro') { bobbyPose('gloat', 0, dt); if (D.st > (D.bot ? 1.2 : 3.0) || (swingAt !== null && D.st > 0.6)) { $('dbB').classList.remove('on'); nextPitch(); } }
    else if (D.state === 'windup') { const u = clamp(D.st / P.wind, 0, 1); const uw = P.type === 'change' ? (u < 0.55 ? u / 0.55 * 0.62 : u < 0.78 ? 0.62 + (u - 0.55) / 0.23 * 0.1 : 0.72 + (u - 0.78) / 0.22 * 0.28) : u; // the changeup hangs at the top
      bobbyPose('windup', uw, dt);
      if (D.st >= P.wind) { P.tRel = D.t; P.tArr = D.t + P.T; setState('pitch'); pinfo(PT[P.type].name + ' · ' + P.mph + ' MPH', PT[P.type].col, P.T + 1.2); dsfx('tick'); tpts.length = 0; } }
    else if (D.state === 'pitch') { bobbyPose('follow', D.st / 0.6, dt);
      const r = P.res;
      if (r && r.kind !== 'WHIFF' && D.t >= r.tc) { // contact!
        D.hit = { r, t0: D.t, i: 0 }; tpts.length = 0; dsfx('crack'); CAMS.shake = r.perfect ? 0.5 : 0.25; setState('hit');
        if (r.kind === 'HR') { dsfx('cheer'); } }
      else if (D.t >= P.tArr + 0.3) { // past the plate
        dsfx('pop');
        if (r && r.kind === 'WHIFF') { word('STRIKE!', 'SWING AND A MISS · OUT', '#ff3d6e', 1.3); result('STRIKE', { e: r.e, why: 'whiff' }); }
        else { const inZ = Math.abs(P.tx) < 0.3 && P.ty > 0.45 && P.ty < 1.15; if (inZ) { word('STRIKE!', 'CALLED · OUT', '#ff3d6e', 1.3); result('STRIKE', { why: 'called' }); } else { word('BALL', 'GOOD EYE', '#9fe0ff', 1.0); result('BALL', { why: 'taken' }); } } } }
    else if (D.state === 'hit') { const H = D.hit, r = H.r, k = (D.t - H.t0) * 60; H.i = Math.min(r.F.pts.length - 1, Math.floor(k));
      const hp = r.F.pts[H.i], elapsed = D.t - H.t0;
      if (r.kind === 'HR' && r.F.wallHit && elapsed >= r.F.wallHit.t && !H.fw) { H.fw = true; const p = r.F.pts[Math.min(r.F.pts.length - 1, Math.round(r.F.wallHit.t * 60))]; fwShell(p[0] * 1.1, p[2] * 1.1, 42 + rng() * 10, 0.8); D.cheer = 1.6; }
      bobbyPose(r.kind === 'HR' ? 'watch' : 'idle', elapsed / 1.2, dt);
      const done = r.kind === 'FOUL' ? elapsed > 1.2 : r.kind === 'HR' ? elapsed > Math.min(r.F.t, (r.F.wallHit ? r.F.wallHit.t : 3) + 1.0) : elapsed > Math.min(r.F.t, 2.6);
      if (done) { const ftS = r.ft ? r.ft + ' FT' : '';
        if (r.kind === 'HR') { word(r.perfect ? 'MOONSHOT!' : 'HOME RUN!', ftS, '#ffd23c', 1.6); dsfx('ko'); }
        else if (r.kind === 'FOUL') word('FOUL BALL', r.why.toUpperCase(), '#ffffff', 1.1);
        else if (r.kind === 'SINGLE') { word('SINGLE', (r.why + ' · ' + ftS).toUpperCase(), '#9fe0ff', 1.3); }
        else { word('OUT!', (r.why + (ftS ? ' · ' + ftS : '')).toUpperCase(), '#ff3d6e', 1.3); dsfx('boo'); }
        result(r.kind, { ft: r.ft, e: r.e, why: r.why }); } }
    else if (D.state === 'result') { const k = D.resKind;
      bobbyPose(k === 'HR' ? 'mad' : k === 'OUT' || k === 'STRIKE' ? 'cheer' : 'idle', D.st, dt);
      if (D.st > (D.bot ? 0.9 : 1.5)) { if (D.homers >= RULE.homers) win(); else if (D.outs >= RULE.outs) lose(); else nextPitch(); } }
    else if (D.state === 'win') { bobbyPose('defeat', D.st / 1.5, dt); D.cheer = 2; if (!D.said && D.st > 2.7) { D.said = true; say('defeat'); } // his line after the big word
      D.fwT = (D.fwT || 0) - dt; if (D.fwT <= 0 && D.st < 7) { D.fwT = 0.32 + rng() * 0.3; const a = (rng() - 0.5) * 1.4, r = 105 + rng() * 40; fwShell(Math.sin(a) * r, -Math.cos(a) * r, 24 + rng() * 18, 1.1 + rng() * 0.5); }
      if (D.st > (D.bot ? 3.4 : 6.8)) { setState('card'); D.endWas = 'win'; endCard2('win'); } }
    else if (D.state === 'lose') { bobbyPose('gloat', 0, dt); if (D.st > (D.bot ? 1.5 : 3.2)) { setState('card'); D.endWas = 'lose'; endCard2('lose'); } }
    else if (D.state === 'card') { bobbyPose(D.endWas === 'win' ? 'defeat' : 'gloat', 1, dt); if (D.endWas === 'win') D.cheer = Math.max(D.cheer, 0.6); }

    // Harold
    const H = D.har; let hp;
    if (D.swing && D.t - D.swing.t0 < 0.62) hp = hSwing(clamp((D.t - D.swing.t0) / 0.42, 0, 1), D.swing.hi);
    else if ((D.state === 'result' && D.resKind === 'HR') || D.state === 'win' || (D.state === 'card' && D.endWas === 'win')) hp = hCheer(D.t);
    else if (D.state === 'lose' || (D.state === 'card' && D.endWas === 'lose') || (D.state === 'result' && (D.resKind === 'OUT' || D.resKind === 'STRIKE'))) hp = hSlump(D.t);
    else hp = hStance(D.t);
    applyPose(H, hp, D.swing && D.t - D.swing.t0 < 0.5 ? 40 : 14, dt, true);

    // ball
    let bv = false;
    if (D.state === 'pitch' && P) { pitchPos(P, D.t, _bp); bv = _bp.z < 1.2 || D.t < P.tArr + 0.2; }
    else if (D.state === 'hit' && D.hit) { const p = D.hit.r.F.pts[D.hit.i]; _bp.set(p[0], Math.max(0.11, p[1]), p[2]); bv = true; }
    BALL.visible = bv; if (bv) { BALL.position.copy(_bp); BALL.rotation.x += dt * 30; BALL.rotation.y += dt * 11; D.shBall.visible = true; D.shBall.position.set(_bp.x, 0.06, _bp.z); } else D.shBall.visible = false;
    // trail
    const tcol = new THREE.Color(P ? PT[P.type].col : '#ffffff'); if (D.state === 'hit') tcol.set('#ffffff');
    if (bv) { tpts.unshift(_bp.clone()); if (tpts.length > TN) tpts.length = TN; } else if (tpts.length) tpts.pop();
    trailUpdate(tcol.multiplyScalar(1.4), D.state === 'hit' ? 0.2 : 0.16);
    // hand glow = the tell colour during the windup
    if (D.state === 'windup' && P && D.bob.hand) { D.bob.hand.getWorldPosition(_tmp); HGLOW.position.copy(_tmp); const u = D.st / P.wind; HGLOW.material.color.set(PT[P.type].col); HGLOW.material.opacity = clamp((u - 0.2) * 2.5, 0, 1) * (0.75 + 0.25 * Math.sin(D.t * 30)); HGLOW.scale.setScalar(0.9 + u * 0.6); }
    else if (D.state === 'windup' && P) { HGLOW.position.copy(REL); HGLOW.material.color.set(PT[P.type].col); HGLOW.material.opacity = clamp(D.st / P.wind, 0, 1); }
    else HGLOW.material.opacity = Math.max(0, HGLOW.material.opacity - dt * 4);
    // pitch ghost (where it will cross) + aim reticle
    if (D.state === 'pitch' && P) { const u = (D.t - P.tRel) / P.T; GHOST.position.set(P.tx, P.ty, PLATE_Z + 0.02); GHOST.material.opacity = clamp((u - 0.15) * 1.2, 0, 0.55) * (u < 1.05 ? 1 : 0); GHOST.material.color.set(PT[P.type].col); GHOST.scale.setScalar(1 + (1 - clamp(u, 0, 1)) * 1.2); }
    else GHOST.material.opacity = 0;
    if (D.state === 'pitch' || D.state === 'windup') { RET.visible = true; let rx, ry; if (aim.mouse) { rx = aim.x; ry = aim.y; } else { rx = (P && D.state === 'pitch' ? P.tx : 0) + aim.bx * 0.18; ry = (P && D.state === 'pitch' ? P.ty : 0.82) + aim.by * 0.15; }
      RET.position.set(rx, ry, PLATE_Z + 0.03); RET.lookAt(CAMD.position); RET.children[0].material.opacity = aim.mouse ? 0.85 : 0.45; } else RET.visible = false;
    ZONE.visible = D.state === 'windup' || D.state === 'pitch';
    // blobs
    D.har.root.updateMatrixWorld(); D.shH.position.set(D.har.root.position.x, 0.05, D.har.root.position.z);
    D.shB.position.set(D.bob.root.position.x, 0.28, D.bob.root.position.z);
    // crowd + fireworks
    D.cheer = Math.max(0, D.cheer - dt * 0.6); if (D.cheer > 0.01 || D.crowdK > 0.01) { crowdPose(Math.min(1, D.cheer)); D.crowdK = D.cheer; }
    fwTick(dt);
    // camera
    let tp = BASE.pos, tl = BASE.look, rate = 4;
    if (D.state === 'intro') { const k = ease(clamp(D.st / 2.4, 0, 1)); _cp.set(lerp(-6, BASE.pos.x, k), lerp(9, BASE.pos.y, k), lerp(16, BASE.pos.z, k)); _cl.set(0, lerp(3, BASE.look.y, k), lerp(-40, BASE.look.z, k)); tp = _cp; tl = _cl; rate = 8; }
    else if (D.state === 'hit' || (D.state === 'result' && D.hit)) { const p = D.hit.r.F.pts[D.hit.i]; const far = Math.hypot(p[0], p[2]);
      _cl.set(p[0], Math.max(1.5, p[1]), p[2]); _cp.set(p[0] * 0.18, 2.6 + Math.min(10, p[1] * 0.25) + far * 0.02, 5.5 - far * 0.06); tp = _cp; tl = _cl; rate = D.state === 'result' ? 2.5 : 3.2; }
    else if (D.state === 'win' || (D.state === 'card' && D.endWas === 'win')) { const a = D.t * 0.15; _cp.set(-1.2 + Math.sin(a) * 0.8, 2.4, -5); _cl.set(-0.3, 6, -60); tp = _cp; tl = _cl; rate = 1.6; } // Bobby flat on the mound, fireworks over the wall
    else if (D.state === 'lose' || (D.state === 'card' && D.endWas === 'lose')) { _cp.set(0.6, 1.9, -9); _cl.set(0, 2.2, MOUND_Z); tp = _cp; tl = _cl; rate = 1.8; }
    CAMS.pos.x = damp(CAMS.pos.x, tp.x, rate, dt); CAMS.pos.y = damp(CAMS.pos.y, tp.y, rate, dt); CAMS.pos.z = damp(CAMS.pos.z, tp.z, rate, dt);
    CAMS.look.x = damp(CAMS.look.x, tl.x, rate * 1.5, dt); CAMS.look.y = damp(CAMS.look.y, tl.y, rate * 1.5, dt); CAMS.look.z = damp(CAMS.look.z, tl.z, rate * 1.5, dt);
    CAMS.shake = Math.max(0, CAMS.shake - dt * 2.5);
    $('dbH').style.opacity = D.state === 'win' || D.state === 'lose' || D.state === 'card' ? '0' : '.9';
    // timers
    if (wordT > 0) { wordT -= dt; if (wordT <= 0) $('dbW').classList.remove('on'); }
    if (pT > 0) { pT -= dt; if (pT <= 0) $('dbP').classList.remove('on'); }
    if (bubT > 0) { bubT -= dt; if (bubT <= 0) $('dbB').classList.remove('on'); }
  }
  function endCard2(kind) { D.lastEnd = kind; endCard(); }
  const _tv = new THREE.Vector3(), _side = new THREE.Vector3(), _toC = new THREE.Vector3();
  function trailUpdate(col, w) {
    const P = TRG.attributes.position.array, C = TRG.attributes.color.array, n = tpts.length;
    for (let i = 0; i < TN; i++) { const a = tpts[Math.min(i, n - 1)], b = tpts[Math.min(i + 1, n - 1)];
      if (!a || n < 2) { for (let j = 0; j < 6; j++) { P[i * 6 + j] = 0; C[i * 6 + j] = 0; } continue; }
      _tv.subVectors(a, b); if (_tv.lengthSq() < 1e-8) _tv.set(0, 0, 1); _toC.subVectors(CAMD.position, a); _side.crossVectors(_tv, _toC).normalize().multiplyScalar(w * (1 - i / TN));
      P[i * 6] = a.x + _side.x; P[i * 6 + 1] = a.y + _side.y; P[i * 6 + 2] = a.z + _side.z; P[i * 6 + 3] = a.x - _side.x; P[i * 6 + 4] = a.y - _side.y; P[i * 6 + 5] = a.z - _side.z;
      const f = i < n - 1 ? Math.pow(1 - i / TN, 1.5) : 0; C[i * 6] = C[i * 6 + 3] = col.r * f; C[i * 6 + 1] = C[i * 6 + 4] = col.g * f; C[i * 6 + 2] = C[i * 6 + 5] = col.b * f; }
    TRG.attributes.position.needsUpdate = true; TRG.attributes.color.needsUpdate = true;
  }
  // the bubble follows Bobby's head on screen
  const _hv = new THREE.Vector3();
  function bubblePos() { if (!$('dbB').classList.contains('on')) return; D.bob.root.getWorldPosition(_hv); _hv.y += 3.0; _hv.project(CAMD); const r = canvas.getBoundingClientRect();
    const x = clamp((_hv.x * 0.5 + 0.5) * r.width, 140, r.width - 140), y = clamp((-_hv.y * 0.5 + 0.5) * r.height, 120, r.height - 40); const b = $('dbB'); b.style.left = x + 'px'; b.style.top = y + 'px'; }

  function frame(rdt) {
    D.frames++; readInput(); // keys / stick / pad -> IN (aim bias) + PRESS (pad A, panel SWING / ACT)
    const pads = navigator.getGamepads ? navigator.getGamepads() : []; let pa = false; for (const gp of pads) if (gp && gp.buttons[0] && gp.buttons[0].pressed) pa = true; D.padPrev = pa;
    if (APANEL) APANEL.setAct({ kind: 'boss', label: 'SWING' }, 1);
    baseView();
    const fx = D.speed || SIM; const steps = D.freeze ? 0 : fx ? fx : 1; for (let k = 0; k < steps; k++) step(fx ? 1 / 60 : rdt); // D.speed / ?sim=N: N fixed steps per frame (tests) // D.freeze: tests hold a frame for screenshots
    CAMD.position.copy(CAMS.pos); if (CAMS.shake > 0) { CAMD.position.x += (Math.random() - 0.5) * CAMS.shake * 0.25; CAMD.position.y += (Math.random() - 0.5) * CAMS.shake * 0.25; }
    CAMD.lookAt(CAMS.look); bubblePos();
    renderer.info.autoReset = false; renderer.info.reset(); draw(SC, CAMD); D.calls = renderer.info.render.calls; D.tris = renderer.info.render.triangles; renderer.info.autoReset = true;
  }
  // test hooks
  const api = { D, start, exit, frame, get on() { return D.on; }, BOSS_CLEAR, wallR, simFlight, PT, SC, CAMD, get calls() { return renderer.info.render.calls; },
    stats: () => ({ calls: D.calls, tris: D.tris, state: D.state, homers: D.homers, outs: D.outs, pitches: D.pitches, lastFt: D.lastFt, best: D.best, results: D.results, rig: D.bob && D.bob.rig, won: D.won, wins: D.wins, losses: D.losses, cleared: BOSS_CLEAR.cleared.has(LMID), log: D.log.slice(-40) }),
    retry: () => { hideCard(); D.on = false; start(D.lastMode); } };
  const _start = start; start = (mode) => { D.lastMode = mode; _start(mode); };
  api.start = start;
  return api;
})();
// ACT at the Oriole Park boss anchor: PLAY BALL
ICONS.boss = '<circle cx="12" cy="12" r="8.5"/><path d="M7 5.5c2 2.6 2 10.4 0 13M17 5.5c-2 2.6-2 10.4 0 13"/>';
{ const L = LANDMARKS.find((l) => l.id === 'orioles');
  if (L && L.boss) { const B = L.boss, y = groundY(B.x, B.z);
    ACTIONS.push({ kind: 'boss', get label() { return B.cleared ? 'REMATCH' : 'PLAY BALL'; }, x: B.x, z: B.z, r: 2.4, y: 2.2, ok: () => !DERBY.on && !hero.roof, go: () => DERBY.start() });
    // a marker so the fight can be found: a glowing home plate ring + a big spinning ball on a stand
    const g = new THREE.Group(); g.userData.mat = toonMat(); g.position.set(B.x, y, B.z); scene.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.45, 32), basicSnap({ color: '#ff7a1a', transparent: true, opacity: 0.75, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    const ball = new THREE.Group(); ball.userData.mat = g.userData.mat; ball.position.y = 2.1; g.add(ball); part(ball, new THREE.SphereGeometry(0.42, 16, 12), '#fbfaf2'); part(ball, new THREE.TorusGeometry(0.4, 0.035, 4, 20), '#e03a2a', 0, 0, 0, { outline: false, rot: [0.6, 0.3, 0] });
    part(g, G.cyl(0.05, 0.08, 1.7, 8), '#2a2a32', 0, 0.85, 0);
    DERBY.marker = { g, ring, ball, tick: (t) => { ball.rotation.y = t * 1.6; ball.position.y = 2.1 + Math.sin(t * 2) * 0.12; ring.material.opacity = 0.45 + 0.3 * Math.sin(t * 4); } }; } }
