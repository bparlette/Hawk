
// ======================= the hero drone: a 5" racing quad built like the Toad City props (toon material, ink hulls) =======================
// carbon X frame, four motor bells with spinning 3-blade props + motion-blur discs, a TPU canopy painted like the Toad City face
// (green with the blue mask band + white eyes), an FPV camera pod, twin antennas, an LED strip in the pilot colour and a battery strap.
const DRONE_COLS = {
  hero: { body: '#5ccf3a', band: '#1f7bff', led: '#9dff6b', arm: '#23202c', strap: '#ffd23c' },
  mavis: { body: '#c9c3cf', band: '#ff5fa2', led: '#ff9ad0', arm: '#2a2430', strap: '#ff5fa2' },
  vic: { body: '#ffd23c', band: '#14101f', led: '#7fe8ff', arm: '#202028', strap: '#7fe8ff' },
  sugar: { body: '#ff3a1c', band: '#ffe08a', led: '#ffb04a', arm: '#2a1a1a', strap: '#ffe08a' },
  ghost: { body: '#bfe8ff', band: '#5a7aff', led: '#bfe8ff', arm: '#3a4a6a', strap: '#bfe8ff' },
};
const DRONE_OUT = outlineMat(0.0046);
function droneFaceTex(col) { // canopy decal: the toad face (band + eyes) and a race number
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = col.body; g.fillRect(0, 0, 256, 128);
  halftone(g, 0, 0, 256, 128, 'rgba(20,16,31,.18)', 10, 2.4, 1);
  g.fillStyle = INK; g.fillRect(0, 40, 256, 40); g.fillStyle = col.band; g.fillRect(0, 44, 256, 32);
  g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 4;
  for (const x of [50, 78]) { g.beginPath(); g.ellipse(x, 60, 11, 10, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(x + 2, 61, 4, 0, TAU); g.fill(); g.fillStyle = '#fff'; }
  return lowTex(c, 128);
}
function buildDrone(colKey = 'hero', opts = {}) {
  const col = DRONE_COLS[colKey] || DRONE_COLS.hero, G = new THREE.Group(), parts = [];
  const mat = toonMat({ vertexColors: true });
  const ghost = !!opts.ghost;
  const add = (geo, c, x, y, z, rx = 0, ry = 0, rz = 0, outline = true, m = mat) => {
    geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz); geo.translate(x, y, z); if (m === mat) bakeColor(geo, c);
    const me = new THREE.Mesh(geo, m); me.castShadow = !ghost; G.add(me); parts.push(me);
    if (outline && !ghost) { addOdir(geo); const o = new THREE.Mesh(geo, DRONE_OUT); G.add(o); QUAL.outlines.push(o); o.visible = QUAL.hd; }
    return me;
  };
  // frame: two crossing carbon arms + a centre plate
  const AL = 0.62;
  for (const s of [1, -1]) add(new THREE.BoxGeometry(AL * 2, 0.05, 0.12), col.arm, 0, 0, 0, 0, s * Math.PI / 4, 0);
  add(new THREE.BoxGeometry(0.34, 0.06, 0.5), col.body, 0, 0.02, 0);
  // battery + strap on top, canopy in front
  add(new THREE.BoxGeometry(0.22, 0.14, 0.36), col.band, 0, 0.12, -0.04);
  add(new THREE.BoxGeometry(0.24, 0.02, 0.07), col.strap, 0, 0.2, -0.04);
  const can = new THREE.SphereGeometry(0.2, 14, 8, 0, TAU, 0, Math.PI / 2); can.scale(1, 0.8, 1.25);
  const faceM = toonMat({ vertexColors: false, map: droneFaceTex(col) });
  const cm = add(can, col.body, 0, 0.05, 0.16, 0, 0, 0, true, faceM);
  // FPV camera pod (looks forward, +z)
  add(new THREE.BoxGeometry(0.12, 0.11, 0.1), '#14101f', 0, 0.08, 0.38);
  add(new THREE.CylinderGeometry(0.035, 0.04, 0.05, 10), '#5a8aff', 0, 0.08, 0.44, Math.PI / 2, 0, 0, false);
  // antennas (rear, swept back)
  for (const s of [1, -1]) add(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 5), '#14101f', s * 0.08, 0.2, -0.26, -0.7, 0, s * 0.25, false);
  // motors + props
  const props = [], discs = [];
  const discT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(230,230,240,.28)'); gr.addColorStop(0.9, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return lowTex(c, 64); })();
  const discM = new THREE.MeshBasicMaterial({ map: discT, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true, opacity: 0.9 });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.sin(a) * AL, z = Math.cos(a) * AL;
    add(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 12), col.strap, x, 0.06, z);
    add(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 12), col.led, x, 0.12, z, 0, 0, 0, false);
    const P = new THREE.Group(); P.position.set(x, 0.15, z); G.add(P); props.push(P);
    for (let b = 0; b < 3; b++) { const bg = new THREE.BoxGeometry(0.42, 0.012, 0.07); bg.translate(0.21, 0, 0); bg.rotateY(b * TAU / 3); bakeColor(bg, i % 2 ? '#ff5fa2' : '#7fe8ff'); const bm = new THREE.Mesh(bg, mat); bm.castShadow = false; P.add(bm); }
    const dg = new THREE.CircleGeometry(0.44, 20); dg.rotateX(-Math.PI / 2); const d = new THREE.Mesh(dg, discM); d.position.set(x, 0.155, z); d.renderOrder = 4; G.add(d); discs.push(d);
  }
  // LED underglow strip
  const ledM = new THREE.MeshBasicMaterial({ color: col.led, fog: true });
  for (const s of [1, -1]) { const lg = new THREE.BoxGeometry(0.04, 0.02, 0.4); const l = new THREE.Mesh(lg, ledM); l.position.set(s * 0.17, -0.03, 0); G.add(l); }
  if (ghost) G.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.42; o.material.depthWrite = false; o.castShadow = false; } });
  G.userData = { props, discs, spin: 0, led: ledM, col };
  G.scale.setScalar(opts.scale || 1);
  return G;
}
// per-frame prop spin + blur (thr 0..1)
function spinDrone(D, thr, dt) {
  const u = D.userData; u.spin += dt * (20 + thr * 70);
  u.props.forEach((P, i) => { P.rotation.y = (i % 2 ? -1 : 1) * u.spin; P.visible = thr < 0.35; });
  u.discs.forEach((d) => { d.visible = thr >= 0.2; d.material.opacity = 0.35 + thr * 0.55; });
}
