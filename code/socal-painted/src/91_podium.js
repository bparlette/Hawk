/* ---------------- trophy ceremony: podium, trophies, top three cheering ---------------- */
const PODIUM = { spots: [[0, 1.25], [-2.3, 0.85], [2.3, 0.55]], rigs: [], trophies: [] };
function buildPodium(g) {
  const mb = new MB();
  mb.add(place(GG.box(200, 1, 80), 0, -0.5, -20), '#f2c27a', false);
  mb.add(place(GG.box(200, 0.2, 60), 0, -0.3, -60), '#2fd3ff', false);
  const cols = ['#ffd23c', '#d1d8e0', '#e08a3c'];
  PODIUM.spots.forEach(([x, h], i) => { mb.add(place(GG.box(2.1, h, 1.8), x, h / 2, 0), cols[i]); mb.add(place(GG.box(2.2, 0.12, 1.9), x, h, 0), '#fff6dc'); });
  mb.add(place(GG.box(9, 0.25, 3.2), 0, 0.12, 0.3), '#ff5fa2');
  srand(5); for (let i = 0; i < 9; i++) mbPalm(mb, -30 + i * 7.5 + rng() * 2, 0, -10 - rng() * 8, 1 + rng() * 0.3, rng() - 0.5, false);
  mbCrowd(mb, -9, -4.5, 0, 2.2, 14, 21); mbCrowd(mb, 4.5, 9, 0, 2.2, 14, 22);
  mb.build(g);
  ['1ST', '2ND', '3RD'].forEach((s, i) => signMesh(g, s, cols[i], INK, INK, PODIUM.spots[i][0], PODIUM.spots[i][1] * 0.5, 0.92, 1.3, 0));
  signMesh(g, 'CALIFORNIA GAMES', '#14101f', '#ffd23c', '#ff5fa2', 0, 4.8, -3, 7.5, 0, 'FAN REMAKE · TROPHY CEREMONY');
  for (let i = 0; i < 3; i++) { const t = new THREE.Group(); t.userData.mat = SCENE_MAT; const c = cols[i];
    part(t, GG.cyl(0.18, 0.24, 0.12, 12), '#5c3828', 0, 0.06, 0); part(t, GG.cyl(0.04, 0.06, 0.3, 8), c, 0, 0.27, 0); part(t, GG.cyl(0.24, 0.1, 0.34, 14), c, 0, 0.58, 0);
    for (const s of [-1, 1]) part(t, GG.tor(0.1, 0.025, 6, 12), c, s * 0.25, 0.6, 0, { rot: [0, 0, 0] });
    g.add(t); PODIUM.trophies.push(t); }
  g.userData.holders = [grp(g), grp(g), grp(g)];
}
function loadPodiumScene() {
  const g = showEnv('podium', buildPodium);
  setSky('#2a2f8f', '#e07ab0', '#ffc28a', 30, 140, [80, 60, -300]);
  const top = Game.podium.slice(0, 3);
  PODIUM.rigs.length = 0;
  for (let i = 0; i < 3; i++) {
    const h = g.userData.holders[i]; while (h.children.length) h.remove(h.children[0]);
    const tr = PODIUM.trophies[i]; tr.visible = !!top[i] && top[i].s > 0;
    tr.position.set(PODIUM.spots[i][0] + 0.55, PODIUM.spots[i][1] + 0.06, 0.45);
    if (!top[i]) continue;
    const J = buildDude(top[i].p.look); if (J.root.parent) J.root.parent.remove(J.root);
    h.add(J.root); h.position.set(PODIUM.spots[i][0], PODIUM.spots[i][1] + 0.06, 0); J.root.position.set(0, 0, 0); J.root.rotation.set(0, 0, 0); J.tilt.rotation.set(0, 0, 0);
    PODIUM.rigs.push(J);
  }
  EVI = EVI; cam.x = 0; cam.y = -2.0 / U; CAMS.tilt = 0.06;
  const bandH = V.H * 0.46 - V.top; CAMS.cy = V.top + bandH / 2 + 6; cam.z = Math.min(V.W / (V.portrait ? 270 : 330), bandH / 190);
  clearParts(); clearPops(); SPZ = 0;
}
function syncPodium() {
  for (let i = 0; i < PODIUM.rigs.length; i++) { const J = PODIUM.rigs[i]; poseDude(J, i === 0 ? 'cheer' : 'wave', T.real + i); J.root.rotation.y = Math.sin(T.real * 0.8 + i) * 0.25; J.flash.value = 0; }
  for (const t of PODIUM.trophies) t.rotation.y = T.real * 1.5;
}
function drawPodiumLabels(g, u) {
  const st = Game.podium; if (!st) return;
  for (let i = 0; i < Math.min(3, st.length); i++) {
    const [x, h] = PODIUM.spots[i]; worldToScreen(x / U, -(h + 2.25) / U, 0, _sp);
    txt(g, st[i].p.name, _sp.x, _sp.y, (i === 0 ? 20 : 15) * u, i === 0 ? '#ffd23c' : '#fff', 'center', -0.05);
    g.font = '800 ' + Math.round(10 * u) + 'px system-ui,sans-serif'; g.fillStyle = '#fff6dc'; g.textAlign = 'center';
    g.fillText((V.portrait ? '' : SPONSORS[st[i].p.sp].n + ' · ') + (Game.state === 'champ' ? st[i].s + ' PTS' : fmt(st[i].s)), _sp.x, _sp.y + 18 * u);
  }
  const t = Game.state === 'champ' ? 'CALIFORNIA CHAMPION' : 'TROPHIES';
  if (!V.portrait) txt(g, t, V.W / 2, V.top + 8 + 14 * u, 26 * u, '#ff5fa2', 'center', -0.05);
}
