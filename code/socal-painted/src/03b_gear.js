/* ---------------- gear: boards, bike, disk, footbag (cached per look) ---------------- */
const gearCache = {};
function gearMat() { return toonMat(); }
function buildSkateboard(look) {
  const k = 'sk' + look.key; if (gearCache[k]) return gearCache[k];
  const g = new THREE.Group(); g.userData.mat = gearMat();
  part(g, GG.box(0.86, 0.05, 0.24), look.shirt, 0, 0.13, 0);
  part(g, GG.box(0.8, 0.012, 0.2), INK, 0, 0.16, 0, { outline: false });
  part(g, GG.box(0.5, 0.014, 0.05), look.trim, 0, 0.168, 0, { outline: false });
  for (const s of [-1, 1]) { part(g, GG.cyl(0.13, 0.13, 0.05, 10), look.shirt, s * 0.43, 0.13, 0, { rot: [Math.PI / 2, 0, 0], outline: false });
    part(g, GG.box(0.06, 0.05, 0.2), '#d1d8e0', s * 0.27, 0.085, 0); for (const z of [-0.1, 0.1]) part(g, GG.cyl(0.05, 0.05, 0.05, 10), '#2fd3ff', s * 0.27, 0.05, z, { rot: [Math.PI / 2, 0, 0] }); }
  gearCache[k] = g; return g;
}
function buildSurfboard(look) {
  const k = 'sf' + look.key; if (gearCache[k]) return gearCache[k];
  const g = new THREE.Group(); g.userData.mat = gearMat();
  part(g, GG.sph(1.15, 0.06, 0.3, 18, 8), '#fff6dc', 0, 0.06, 0);
  part(g, GG.box(1.9, 0.02, 0.07), look.shirt, 0, 0.115, 0, { outline: false });
  part(g, GG.box(1.6, 0.02, 0.035), look.trim === INK ? '#ff5fa2' : look.trim, 0, 0.118, 0.07, { outline: false });
  part(g, GG.box(0.22, 0.2, 0.02), look.shirt, -0.9, -0.06, 0, { rot: [0, 0, 0.4] });
  gearCache[k] = g; return g;
}
function buildBike(look) {
  const k = 'bk' + look.key; if (gearCache[k]) return gearCache[k];
  const g = new THREE.Group(); g.userData.mat = gearMat(); const fr = look.shirt;
  const wheel = (x) => { const w = grp(g, x, 0.33, 0); part(w, GG.tor(0.3, 0.05, 8, 20), INK, 0, 0, 0); part(w, GG.tor(0.25, 0.025, 6, 18), '#ffd23c', 0, 0, 0, { outline: false });
    for (let i = 0; i < 3; i++) part(w, GG.box(0.5, 0.025, 0.02), '#d1d8e0', 0, 0, 0, { rot: [0, 0, i * Math.PI / 3], outline: false }); part(w, GG.cyl(0.05, 0.05, 0.1, 8), '#d1d8e0', 0, 0, 0, { rot: [Math.PI / 2, 0, 0] }); return w; };
  g.userData.wheels = [wheel(-0.5), wheel(0.5)];
  const tube = (x0, y0, x1, y1, r) => { const l = Math.hypot(x1 - x0, y1 - y0); part(g, GG.cyl(r || 0.035, r || 0.035, l, 8), fr, (x0 + x1) / 2, (y0 + y1) / 2, 0, { rot: [0, 0, -Math.atan2(x1 - x0, y1 - y0)] }); };
  tube(-0.5, 0.33, -0.08, 0.36); tube(-0.08, 0.36, 0.38, 0.7); tube(-0.5, 0.33, -0.15, 0.72); tube(-0.15, 0.72, 0.38, 0.72); tube(-0.08, 0.36, -0.15, 0.72); tube(0.38, 0.72, 0.5, 0.33);
  tube(0.38, 0.72, 0.33, 0.95, 0.03); part(g, GG.cyl(0.03, 0.03, 0.62, 8), '#d1d8e0', 0.33, 0.97, 0, { rot: [Math.PI / 2, 0, 0] });
  part(g, GG.box(0.24, 0.06, 0.1), INK, -0.18, 0.76, 0); part(g, GG.cyl(0.09, 0.09, 0.03, 12), '#d1d8e0', -0.08, 0.36, 0.06, { rot: [Math.PI / 2, 0, 0] });
  part(g, GG.box(0.24, 0.12, 0.012), look.trim === INK ? '#fff6dc' : look.trim, 0.06, 0.54, 0.05, { rot: [0, 0, 0.62], outline: false });
  gearCache[k] = g; return g;
}
function buildDisk(col) {
  const g = new THREE.Group(); g.userData.mat = gearMat();
  part(g, GG.cyl(0.14, 0.12, 0.035, 18), col || '#ff5fa2', 0, 0, 0); part(g, GG.tor(0.11, 0.012, 6, 18), '#ffd23c', 0, 0.02, 0, { rot: [Math.PI / 2, 0, 0], outline: false }); return g;
}
function buildFootbag() {
  const g = new THREE.Group(); g.userData.mat = gearMat();
  part(g, GG.sph(0.075, 0.07, 0.075, 10, 8), '#ff5fa2', 0, 0, 0); part(g, GG.sph(0.077, 0.03, 0.077, 10, 6), '#ffd23c', 0, 0, 0, { outline: false });
  part(g, GG.sph(0.03, 0.077, 0.077, 6, 8), '#2fd3ff', 0, 0, 0, { outline: false }); return g;
}
// mount a rig (and optional gear) into an event group; returns the holder
function mountRig(parent, J, gear) {
  if (J.root.parent) J.root.parent.remove(J.root);
  const h = parent.userData.holder || (parent.userData.holder = grp(parent));
  while (h.children.length) h.remove(h.children[0]);
  if (gear) { if (gear.parent) gear.parent.remove(gear); h.add(gear); }
  h.add(J.root); J.root.position.set(0, 0, 0); J.root.rotation.set(0, 0, 0); J.tilt.rotation.set(0, 0, 0); J.root.scale.set(1, 1, 1);
  return h;
}
