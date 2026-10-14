
// ---------------- night lights: instanced lamp glow pools + lamp-head halos (2 draw calls for every lamp), 4 pooled point lights
// that hop to the lamps nearest the hero, and the Domino Sugar rooftop neon sign (original lettering) ----------------
const NIGHTFX = { pools: [], halos: [], lights: [], neon: null, near: null };
(function nightFx() {
  const pool = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,170,70,1)'); gr.addColorStop(0.5, 'rgba(255,130,40,.55)'); gr.addColorStop(1, 'rgba(255,110,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return lowTex(c, 32); })();
  const halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,170,80,.7)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return lowTex(c, 32); })();
  const pm = basicSnap({ map: pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const pg = new THREE.PlaneGeometry(7.5, 7.5); pg.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(pg, pm, LAMPS.length); pools.renderOrder = 2;
  const hm = new THREE.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 });
  const hg = new THREE.PlaneGeometry(2.6, 2.6);
  const halos = new THREE.InstancedMesh(hg, hm, LAMPS.length); halos.renderOrder = 3;
  const m4 = new THREE.Matrix4();
  LAMPS.forEach((L, i) => { m4.makeTranslation(L.x, groundY(L.x, L.z) + 0.03, L.z); pools.setMatrixAt(i, m4); m4.makeTranslation(L.x, L.y - 0.1, L.z); halos.setMatrixAt(i, m4); });
  pools.frustumCulled = halos.frustumCulled = false; scene.add(pools, halos); NIGHTFX.pools.push(pools); NIGHTFX.halos.push(halos);
  // the halo quads turn to face the camera (cheap: one shared rotation for all instances via onBeforeRender)
  halos.onBeforeRender = () => { halos.quaternion.identity(); };
  hm.onBeforeCompile = (sh) => { // billboard each instance in the vertex shader
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
      vec4 ic = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec4 mvPosition = viewMatrix * ic; mvPosition.xy += position.xy;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  for (let i = 0; i < 4; i++) { const pl = new THREE.PointLight('#ffa050', 0, 15, 1.3); scene.add(pl); NIGHTFX.lights.push(pl); }
  NIGHTFX.near = (x, z) => { // move the 4 point lights to the 4 lamps nearest (x, z)
    const s = LAMPS.map((L) => [(L.x - x) ** 2 + (L.z - z) ** 2, L]).sort((a, b) => a[0] - b[0]);
    NIGHTFX.lights.forEach((pl, i) => { const L = s[i][1]; pl.position.set(L.x, L.y - 0.6, L.z); });
  };
  // Domino Sugars: the real two-line script sign ("Domino" over "Sugars", rounded box border) on its open steel lattice, facing the harbour
  // (Brad 2026-10-10, overriding the original-name rule for this sign only; matched to refs/domino-sugar sign_1 day, sign_2 + sign_night_web night).
  // Drawn on canvas (script/italic fonts + strokes), no photo or logo file. Day: gold letters on the open frame. Night: red-orange neon with a glowing
  // box outline, a red point light and a red reflection streak across the water. Two planes cross-fade (day / night).
  function dominoTex(night) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 640; const g = c.getContext('2d'); g.clearRect(0, 0, 1024, 640);
    const RED = '#ff3a1c', CORE = '#ffc2a6', GOLD = '#f0b440', GOLD2 = '#b87a22', INKG = '#4a2e0c';
    const glow = (b) => { g.shadowColor = night ? '#ff2a10' : 'rgba(0,0,0,0)'; g.shadowBlur = night ? b : 0; };
    // rounded box border (double line like the tubes)
    g.lineJoin = 'round'; rrect(g, 34, 34, 956, 572, 64);
    if (night) { glow(34); g.strokeStyle = RED; g.lineWidth = 20; g.stroke(); glow(0); g.strokeStyle = CORE; g.lineWidth = 5; g.stroke(); }
    else { g.strokeStyle = INKG; g.lineWidth = 24; g.stroke(); g.strokeStyle = GOLD; g.lineWidth = 15; g.stroke(); }
    const word = (txt, x, y, font, slant, fillW) => { g.save(); g.translate(x, y); g.transform(1, 0, -slant, 1, 0, 0); g.font = font; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if (night) { glow(30); g.fillStyle = RED; g.fillText(txt, 0, 0, fillW); g.lineWidth = 9; g.strokeStyle = RED; g.strokeText(txt, 0, 0, fillW); glow(0); g.lineWidth = 3.5; g.strokeStyle = CORE; g.strokeText(txt, 0, 0, fillW); }
      else { const gr = g.createLinearGradient(0, -200, 0, 20); gr.addColorStop(0, '#ffd877'); gr.addColorStop(0.55, GOLD); gr.addColorStop(1, GOLD2); g.lineWidth = 12; g.strokeStyle = INKG; g.strokeText(txt, 0, 0, fillW); g.fillStyle = gr; g.fillText(txt, 0, 0, fillW); }
      g.restore(); };
    word('Domino', 512, 330, 'italic 900 318px "Brush Script MT", "Snell Roundhand", "Apple Chancery", Georgia, "Times New Roman", "DejaVu Serif", serif', 0.16, 900);
    // the swash under "Domino" (a hand-drawn tail sweeping back from the o)
    g.save(); g.beginPath(); g.moveTo(170, 372); g.bezierCurveTo(360, 410, 650, 404, 880, 346); g.lineCap = 'round';
    if (night) { glow(26); g.strokeStyle = RED; g.lineWidth = 15; g.stroke(); glow(0); g.strokeStyle = CORE; g.lineWidth = 4; g.stroke(); } else { g.strokeStyle = INKG; g.lineWidth = 20; g.stroke(); g.strokeStyle = GOLD; g.lineWidth = 11; g.stroke(); }
    g.restore();
    word('Sugars', 520, 555, 'bold 172px Georgia, "Times New Roman", "DejaVu Serif", serif', 0.02, 600);
    return lowTex(c, 256);
  }
  const SW = 17, SH = 10.6, SX = 82, SY = CURB + DOM_H + 7.1, SZ = 49.7;
  const dayMat = basicSnap({ map: dominoTex(false), transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.02 });
  const mat = basicSnap({ map: dominoTex(true), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 });
  const signD = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), dayMat); signD.position.set(SX, SY, SZ); signD.rotation.y = Math.PI; signD.renderOrder = 4; scene.add(signD);
  const signN = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), mat); signN.position.set(SX, SY, SZ - 0.04); signN.rotation.y = Math.PI; signN.renderOrder = 5; scene.add(signN);
  // red reflection streak across the water toward the north shore (rippled bands)
  const sc = document.createElement('canvas'); sc.width = 64; sc.height = 512; const sg = sc.getContext('2d'); sg.clearRect(0, 0, 64, 512);
  for (let y = 0; y < 512; y += 6) { const a = Math.min(1, (1 - y / 512) ** 1.1 * (0.7 + 0.5 * srnd())), w = 64 * (0.5 + 0.5 * srnd()) * (1 - y / 900); sg.fillStyle = `rgba(255,${50 + (srnd() * 40) | 0},20,${a.toFixed(3)})`; sg.fillRect(32 - w / 2, y, w, 3 + srnd() * 3); }
  const stex = lowTex(sc, 64);
  const smat = basicSnap({ map: stex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, opacity: 0 });
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(11, 52), smat); streak.rotation.x = -Math.PI / 2; streak.position.set(SX, WY + 0.04, 29.6 - 26); streak.renderOrder = 3; scene.add(streak);
  const nl = new THREE.PointLight('#ff3a2a', 0, 36, 1.2); nl.position.set(SX, CURB + DOM_H + 7, 43); scene.add(nl);
  NIGHTFX.neon = { mat, dayMat, light: nl, streak, tint: (on, fl) => { mat.opacity = Math.min(1, on * 1.15) * fl; dayMat.opacity = 1 - sstep(0.15, 0.85, on); smat.opacity = on * fl; streak.visible = on > 0.02; } };
})();
