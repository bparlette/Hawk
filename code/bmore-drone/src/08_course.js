
// ======================= the course: ring gates strung around the real Toad City Inner Harbor =======================
// Each gate: p = centre (world m), r = inner radius, lm = the landmark it shows off (HUD popup), via = extra spline points
// placed AFTER this gate to bend the racing line round a corner (not gates). X east, Z south, y up (water at WY = -0.85).
const COURSES = {
  harbor: {
    name: 'INNER HARBOR GRAND PRIX', laps: 3,
    start: { p: [-40, 5.0, 17], yaw: Math.PI / 2 }, // just past gate 0 on the grid, nose east
    gates: [
      { p: [-44, 5.0, 17], r: 3.8, lm: 'START / FINISH', start: true },
      { p: [-18, 4.0, 17], r: 3.2, lm: 'RASH FIELD' },
      { p: [20, 6.0, 12], r: 3.2, lm: 'NATIONAL AQUARIUM' },
      { p: [56, 8.0, 8], r: 3.2, lm: 'POWER PLANT' },
      { p: [96, 3.4, 2], r: 3.0, lm: 'INNER HARBOR' },
      { p: [126, 4.5, -11], r: 3.2, lm: 'PENDRY PIER' },
      { p: [150, 7.0, 6], r: 3.4, lm: 'HARBOR EAST' },
      { p: [112, 7.5, 40], r: 3.2, lm: 'UNDER ARMOUR' },
      { p: [82, 17.0, 40], r: 3.8, lm: 'DOMINO SUGARS' },
      { p: [40, 7.5, 41], r: 3.2, lm: 'KEY HIGHWAY' },
      { p: [-3, 17.0, 56], r: 3.8, lm: 'FEDERAL HILL', via: [[-27, 10, 42]] },
      { p: [-48, 7.5, 41], r: 3.2, lm: 'SCIENCE CENTER' },
      { p: [-71, 7.5, 14], r: 3.2, lm: 'LIGHT STREET' },
      { p: [-71, 8.5, -28], r: 3.2, lm: 'CAMDEN YARDS' },
      { p: [-52, 7.5, -41], r: 3.2, lm: 'PRATT STREET', via: [[-38, 6.2, -46]] },
      { p: [-37, 3.9, -60], r: 2.8, lm: 'PRATT ST SKYWALK' },
      { p: [-30, 7.5, -75], r: 3.2, lm: 'CHARLES STREET' },
      { p: [-12, 7.5, -75], r: 3.2, lm: 'WASHINGTON MONUMENT' },
      { p: [-3, 7.5, -55], r: 3.2, lm: 'DOWNTOWN', via: [[-0.5, 7.8, -38]] },
      { p: [0, 5.0, -22], r: 3.2, lm: 'WORLD TRADE CENTER' },
      { p: [-28, 4.5, -2], r: 3.2, lm: 'USS CONSTELLATION', via: [[-55, 5, 9]] },
    ],
  },
};
// a glass skywalk across the street north of Pratt St (Baltimore's downtown skywalks link the harbour blocks), so the course flies UNDER a bridge.
// Built like the city props (toon + ink hull) BEFORE the collision passes, so it is solid like everything else.
const SKYWALK = (function () {
  const G = new THREE.Group(); scene.add(G);
  const glassT = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#9fd6e8'; g.fillRect(0, 0, 256, 64); g.fillStyle = 'rgba(255,255,255,.55)'; for (let x = 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x + 4, 60); g.lineTo(x + 14, 4); g.lineTo(x + 18, 4); g.lineTo(x + 8, 60); g.fill(); }
    g.fillStyle = '#2a3440'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 4, 64); g.fillRect(0, 0, 256, 5); g.fillRect(0, 59, 256, 5); return lowTex(c, 256); })();
  const signT = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d'); g.fillStyle = INK; g.fillRect(0, 0, 512, 96); g.fillStyle = '#1f6a4a'; g.fillRect(6, 6, 500, 84);
    comicText(g, 'PRATT ST SKYWALK', 256, 50, 46, '#fff', null, { shadow: false }); return lowTex(c, 512); })();
  function box(x0, y0, z0, x1, y1, z1, col, map) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const m = map ? toonMat({ vertexColors: false, map }) : toonMat(); if (!map) bakeColor(g, col);
    const me = new THREE.Mesh(g, m); me.castShadow = me.receiveShadow = true; G.add(me);
    addOdir(g); const o = new THREE.Mesh(g, OUT_CITY); G.add(o); QUAL.outlines.push(o); o.visible = QUAL.hd; return me;
  }
  // span x -47 .. -27 over the street at z -60, deck 7.4 m up (gate below it at 4.6 m)
  const x0 = -47, x1 = -27, zc = -60, w = 1.7, y0 = 7.4, y1 = 10.2;
  box(x0, y0, zc - w, x1, y0 + 0.45, zc + w, '#d8d2c4');                // deck
  box(x0, y1 - 0.3, zc - w - 0.15, x1, y1, zc + w + 0.15, '#3a4a5a');      // roof
  box(x0, y0 + 0.45, zc - w, x1, y1 - 0.3, zc - w + 0.12, null, glassT);   // glass walls
  box(x0, y0 + 0.45, zc + w - 0.12, x1, y1 - 0.3, zc + w, null, glassT);
  for (let x = x0 + 2; x < x1; x += 4) { box(x - 0.12, y0 - 0.3, zc - w - 0.1, x + 0.12, y0, zc + w + 0.1, '#2a3440'); } // under-truss ribs
  const s = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.2), toonMat({ vertexColors: false, map: signT })); s.position.set((x0 + x1) / 2, (y0 + y1) / 2 + 0.1, zc + w + 0.06); G.add(s);
  const s2 = s.clone(); s2.position.z = zc - w - 0.06; s2.rotation.y = Math.PI; G.add(s2);
  G.traverse((o) => { o.userData.noHF = true; }); HF.boxes.push({ x0, x1, y0: y0 - 0.3, y1, z0: zc - w - 0.15, z1: zc + w + 0.15 });
  return G;
})();
const GATE_C = { next: new THREE.Color('#ffd23c'), after: new THREE.Color('#7fe8ff'), idle: new THREE.Color('#e9e4ff'), done: new THREE.Color('#6a6478'), start: new THREE.Color('#ff3d6e') };
const COURSE = (function () {
  let C = null; const G = new THREE.Group(); scene.add(G);
  const ringGeo = (r) => { const g = new THREE.TorusGeometry(r, 0.26, 8, 32); g.computeVertexNormals(); return g; };
  const glowT = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 34, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,240,170,.55)'); gr.addColorStop(0.78, 'rgba(255,210,60,.35)'); gr.addColorStop(1, 'rgba(255,200,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return lowTex(c, 128); })();
  const numTex = (txt, bg) => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = INK; rrect(g, 6, 10, 244, 108, 22); g.fill(); g.fillStyle = bg; rrect(g, 14, 18, 228, 92, 16); g.fill(); halftone(g, 14, 18, 228, 92, 'rgba(20,16,31,.16)', 10, 3, 1);
    comicText(g, txt, 128, 68, txt.length > 3 ? 46 : 64, '#fff', null, { shadow: false }); return lowTex(c, 256); };
  const checkerT = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#14101f' : '#fff'; g.fillRect(x * 32, y * 16, 32, 16); g.fillRect(x * 32, 64 + y * 16, 32, 16); }
    g.fillStyle = '#ff3d6e'; g.fillRect(0, 32, 512, 32); comicText(g, 'TOAD CITY DRONE RACER', 256, 50, 26, '#ffd23c', null, { shadow: false }); return lowTex(c, 512); })();
  let gates = [], curve = null, samples = [], total = 0;
  function build(id) {
    C = COURSES[id]; while (G.children.length) G.remove(G.children[0]); gates = [];
    const pts = C.gates.map((g) => new THREE.Vector3(...g.p));
    // the racing line: a closed centripetal Catmull-Rom through every gate (+ via points)
    const line = []; C.gates.forEach((g, i) => { line.push(pts[i]); if (g.via) for (const v of g.via) line.push(new THREE.Vector3(...v)); });
    curve = new THREE.CatmullRomCurve3(line, true, 'centripetal');
    total = curve.getLength(); const n = Math.ceil(total / 1.0); samples = curve.getSpacedPoints(n); samples.pop();
    // gate normals follow the line through each gate
    C.gates.forEach((g, i) => {
      const p = pts[i]; let best = 0, bd = 1e9; samples.forEach((s, k) => { const d = s.distanceToSquared(p); if (d < bd) { bd = d; best = k; } });
      const a = samples[(best - 2 + samples.length) % samples.length], b = samples[(best + 2) % samples.length]; const n3 = b.clone().sub(a).normalize();
      const root = new THREE.Group(); root.position.copy(p); root.lookAt(p.clone().add(n3)); G.add(root);
      const geo = ringGeo(g.r); const mat = toonMat({ vertexColors: false, color: (g.start ? GATE_C.start : GATE_C.idle).clone(), emissive: new THREE.Color(0, 0, 0) });
      const ring = new THREE.Mesh(geo, mat); ring.castShadow = true; root.add(ring); ring.userData.noHF = true;
      addOdir(geo); const ol = new THREE.Mesh(geo, OUT_PROP); root.add(ol); QUAL.outlines.push(ol); ol.visible = QUAL.hd;
      // inner stripes: 8 small blocks on the ring (read as a racing gate, not a donut)
      const sg = new THREE.BoxGeometry(0.2, 0.62, 0.62); const sm = toonMat({ vertexColors: false, color: new THREE.Color('#14101f') });
      for (let k = 0; k < 8; k++) { const s = new THREE.Mesh(sg, sm); const a2 = k / 8 * TAU; s.position.set(Math.cos(a2) * g.r, Math.sin(a2) * g.r, 0); s.rotation.z = a2; s.userData.noHF = true; root.add(s); }
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(g.r * 3.1, g.r * 3.1), new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
      glow.renderOrder = 5; root.add(glow);
      const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: numTex(g.start ? 'GO' : String(i), g.start ? '#ff3d6e' : '#2a6cff'), depthWrite: false, transparent: true }));
      lab.scale.set(2.4, 1.2, 1); lab.position.set(0, g.r + 1.3, 0); root.add(lab);
      if (g.start) { // the start/finish banner over the ring + two pylons down to the water
        const ban = new THREE.Mesh(new THREE.PlaneGeometry(g.r * 2.8, g.r * 0.55), toonMat({ vertexColors: false, map: checkerT, side: THREE.DoubleSide }));
        ban.position.set(0, g.r + 0.55, 0); root.add(ban); lab.position.y = g.r + 1.9;
        for (const s of [1, -1]) { const pg = new THREE.CylinderGeometry(0.16, 0.2, g.p[1] - WY + 1, 8); pg.translate(0, -(g.p[1] - WY + 1) / 2, 0); bakeColor(pg, '#e9e4ff');
          const pm = new THREE.Mesh(pg, toonMat()); pm.position.set(s * (g.r + 0.3), 0, 0); root.add(pm); addOdir(pg); const po = new THREE.Mesh(pg, OUT_PROP); pm.add(po); QUAL.outlines.push(po); po.visible = QUAL.hd; }
      }
      // where this gate sits along the line (for race progress)
      gates.push({ ...g, i, c: p, n: n3, root, ring, mat, glow, lab, s: best, pass: 0 });
    });
    return C;
  }
  function setState(nextI, lapDone) { // colour the gates: next (gold, pulsing glow), the one after (cyan), others idle
    const N = gates.length;
    gates.forEach((g, i) => {
      const k = (i - nextI + N) % N; const c = k === 0 ? GATE_C.next : k === 1 ? GATE_C.after : g.start ? GATE_C.start : GATE_C.idle;
      g.mat.color.copy(c); g.mat.emissive.copy(c).multiplyScalar(k === 0 ? 0.45 : k === 1 ? 0.18 : 0.04); g.glow.material.opacity = k === 0 ? 0.9 : 0; g.isNext = k === 0;
      g.lab.material.opacity = k <= 2 ? 1 : 0.35;
    });
  }
  function tick(t) { for (const g of gates) { if (g.isNext) { const s = 1 + Math.sin(t * 7) * 0.05; g.ring.scale.setScalar(s); g.glow.scale.setScalar(1 + Math.sin(t * 7) * 0.08); g.glow.material.opacity = 0.75 + Math.sin(t * 7) * 0.2; } else g.ring.scale.setScalar(1); } }
  // did the segment a->b fly through gate g? (crossing its plane inside the ring, in the travel direction)
  const _d = new THREE.Vector3();
  function crossed(g, a, b) {
    const da = _d.copy(a).sub(g.c).dot(g.n), db = _d.copy(b).sub(g.c).dot(g.n); if (!(da < 0 && db >= 0)) return null;
    const t = da / (da - db); const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    const off = Math.hypot(x - g.c.x, y - g.c.y, z - g.c.z); return off <= g.r + 0.25 ? { off, t } : null;
  }
  // nearest sample index to a point, searched near a hint (cheap progress tracking)
  function nearestS(p, hint = -1, span = 60) {
    const N = samples.length; let best = 0, bd = 1e9;
    if (hint < 0) { for (let k = 0; k < N; k++) { const d = samples[k].distanceToSquared(p); if (d < bd) { bd = d; best = k; } } return best; }
    for (let o = -span; o <= span; o++) { const k = (hint + o + N) % N; const d = samples[k].distanceToSquared(p); if (d < bd) { bd = d; best = k; } } return best;
  }
  function check(r = 0.9) { // QA: blocked samples along the racing line
    const bad = []; samples.forEach((s, k) => { const h = HF.solidAt(s.x, s.y, s.z, r); if (h) bad.push([k, +s.x.toFixed(1), +s.y.toFixed(1), +s.z.toFixed(1), h]); }); return bad;
  }
  return { build, setState, tick, crossed, nearestS, check, get gates() { return gates; }, get samples() { return samples; }, get total() { return total; }, get curve() { return curve; }, get C() { return C; }, group: G };
})();
