
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
  // Domino Sugar: a giant rooftop neon sign facing the harbour (original lettering)
  const nc = document.createElement('canvas'); nc.width = 512; nc.height = 128; const g = nc.getContext('2d');
  g.fillStyle = '#140a0c'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#ff3a3a'; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
  g.font = 'italic 900 92px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff2020'; g.shadowBlur = 14; g.fillStyle = '#ff5a4a'; g.fillText('SUGAR', 256, 68, 470);
  const nt = lowTex(nc, 256);
  const mat = basicSnap({ map: nt, color: new THREE.Color(0.35, 0.35, 0.35), side: THREE.DoubleSide });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(17, 4.25), mat); sign.position.set(82, CURB + 30 + 3.6, 49.6); sign.rotation.y = Math.PI; scene.add(sign);
  const sc = new THREE.Mesh(new THREE.BoxGeometry(18, 0.25, 0.25), toonMat({ vertexColors: false, color: '#2a2622' })); sc.position.set(82, CURB + 31.2, 49.75); scene.add(sc);
  for (const x of [75, 82, 89]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6, 0.25), sc.material); p.position.set(x, CURB + 33, 49.9); scene.add(p); }
  const nl = new THREE.PointLight('#ff3a3a', 0, 30, 1.2); nl.position.set(82, CURB + 33, 44); scene.add(nl);
  NIGHTFX.neon = { mat, light: nl };
})();
