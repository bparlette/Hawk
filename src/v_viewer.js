
// ---------------- K viewer: HAROLD on a turntable (same model / materials / 32-bit post layer as the game) ----------------
const V = { rot: 0.5, spin: true, dist: 4.1, anim: 'idle', at: 0, night: false, J: null, drag: null, pts: new Map(), pinch0: 0, dist0: 0, lastInput: -9 };
scene.fog = null;
// plinth: a stepped round turntable
const PLM = toonMat();
const plinth = new THREE.Group(); scene.add(plinth);
function plinthPart(g, col, y) { bakeColor(g, col); const m = new THREE.Mesh(g, PLM); m.position.y = y; m.receiveShadow = true; m.castShadow = true; plinth.add(m);
  if (g.attributes.normal) { addOdir(g); const h = new THREE.Mesh(g, OUT_PROP); h.visible = QUAL.hd; m.add(h); QUAL.outlines.push(h); } return m; }
plinthPart(new THREE.CylinderGeometry(1.05, 1.15, 0.22, 40), '#3a3a52', -0.11);
plinthPart(new THREE.CylinderGeometry(0.95, 0.95, 0.05, 40), '#c8a040', 0.02);
const turn = plinthPart(new THREE.CylinderGeometry(0.9, 0.9, 0.04, 40), '#5a4a6a', 0.05);
const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), toonMat()); bakeColor(floor.geometry, '#8a8496'); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.22; floor.receiveShadow = true; scene.add(floor);
const lamp = new THREE.PointLight('#ffa050', 0, 9, 1.2); lamp.position.set(-1.6, 2.6, 1.2); scene.add(lamp);
const rim = new THREE.DirectionalLight('#8fb0ff', 0); rim.position.set(1.5, 2, -3); scene.add(rim);
function buildModel() {
  const old = V.J; if (old) { old.root.parent.remove(old.root); old.root.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); }); }
  QUAL.outlines = QUAL.outlines.filter((h) => !old || !isIn(h, old.root));
  const J = buildHero(); J.root.position.y = 0.07; J.root.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshLambertMaterial) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(J.root); V.J = J; applyPose(J, HERO_POSES.idle(0), 60, 1, true);
}
function isIn(o, root) { for (let p = o; p; p = p.parent) if (p === root) return true; return false; }
function setLight(night) {
  V.night = night;
  if (!night) { scene.background = new THREE.Color('#9cc8e8'); hemi.color.set('#dfe6ff'); hemi.groundColor.set('#8a7f74'); hemi.intensity = 1.5; sun.color.set('#fff3dc'); sun.intensity = 2.2; sun.position.set(-2.5, 6, 3.5); lamp.intensity = 0; rim.intensity = 0; }
  else { scene.background = new THREE.Color('#0d1220'); hemi.color.set('#4a5a88'); hemi.groundColor.set('#14141c'); hemi.intensity = 0.4; sun.color.set('#8aa0e8'); sun.intensity = 0.5; sun.position.set(2, 6, -2); lamp.intensity = 7; rim.intensity = 1.2; }
  floor.material.color.set(night ? '#2a2e3a' : '#ffffff');
  OUT_U.fogC.value.set('#000'); OUT_U.fogN.value = 100; OUT_U.fogF.value = 200;
  $('bDN').textContent = night ? 'NIGHT' : 'DAY'; document.body.classList.toggle('night', night);
}
function setHD(on) { applyQuality(on); buildModel(); for (const h of QUAL.outlines) h.visible = !!on; sun.shadow.mapSize.set(on ? 2048 : 512, on ? 2048 : 512); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } renderer.shadowMap.type = on ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
  scene.traverse((o) => { if (o.material && o.material.isMeshLambertMaterial) o.material.needsUpdate = true; }); $('bQ').textContent = on ? 'HD' : '32-BIT'; resize(); }
function setAnim(a) { V.anim = a; V.at = 0; for (const b of document.querySelectorAll('.an')) b.classList.toggle('on', b.dataset.a === a); }
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h; let lw, lh;
  if (QUAL.hd) { const dpr = Math.min(devicePixelRatio || 1, 2); lw = Math.round(w * dpr); lh = Math.round(h * dpr); }
  else if (a >= 1) { lh = LINES; lw = Math.round(LINES * a); } else { lw = LINES; lh = Math.round(LINES / a); }
  LOW.w = lw; LOW.h = lh; renderer.setSize(lw, lh, false); RT.setSize(lw, lh); POST.uniforms.uRes.value.set(lw, lh); SNAP.value.set(lw / 2, lh / 2);
  camera.aspect = a; camera.fov = a < 1 ? clamp(2 * Math.atan(Math.tan(20 * Math.PI / 180) / a) * 180 / Math.PI, 40, 70) : 40; camera.updateProjectionMatrix();
}
// input: drag to rotate (mouse + touch), pinch / wheel to zoom
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture?.(e.pointerId); V.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); V.lastInput = performance.now();
  if (V.pts.size === 2) { const [p, q] = [...V.pts.values()]; V.pinch0 = Math.hypot(p.x - q.x, p.y - q.y); V.dist0 = V.dist; } });
canvas.addEventListener('pointermove', (e) => { const p = V.pts.get(e.pointerId); if (!p) return; V.lastInput = performance.now();
  if (V.pts.size === 1) { V.rot += (e.clientX - p.x) * 0.012; }
  p.x = e.clientX; p.y = e.clientY;
  if (V.pts.size === 2) { const [a, b] = [...V.pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (V.pinch0 > 0) V.dist = clamp(V.dist0 * V.pinch0 / d, 1.6, 8); } });
const up = (e) => { V.pts.delete(e.pointerId); if (V.pts.size < 2) V.pinch0 = 0; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); V.dist = clamp(V.dist * Math.exp(e.deltaY * 0.0012), 1.6, 8); }, { passive: false });
$('bQ').addEventListener('click', () => setHD(!QUAL.hd));
$('bDN').addEventListener('click', () => setLight(!V.night));
$('bSpin').addEventListener('click', () => { V.spin = !V.spin; $('bSpin').classList.toggle('on', V.spin); });
for (const b of document.querySelectorAll('.an')) b.addEventListener('click', () => setAnim(b.dataset.a));
addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (k === 'h') setHD(!QUAL.hd); if (k === 'n') setLight(!V.night); if (k === '1') setAnim('idle'); if (k === '2') setAnim('walk'); if (k === '3') setAnim('swing'); });
addEventListener('resize', resize);
// animation: idle / walk (in place) / cane swing (the 3-hit combo, looped)
function pose(dt) {
  V.at += dt; const t = V.at;
  if (V.anim === 'walk') return [HERO_POSES.run(t * 0.62, 2.6), 16, false];
  if (V.anim === 'swing') { const L = [0.36, 0.36, 0.6, 0.5], tot = L.reduce((a, b) => a + b), u = t % tot; let s = 0;
    for (let i = 0; i < 3; i++) { if (u < s + L[i]) return [HERO_POSES['atk' + (i + 1)]((u - s) / L[i]), 30, i === 2]; s += L[i]; }
    return [HERO_POSES.idle(t), 14, false]; }
  return [HERO_POSES.idle(t), 14, false];
}
let last = performance.now(), frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  try {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; frames++;
    if (V.spin && V.pts.size === 0 && now - V.lastInput > 1500) V.rot += dt * 0.45;
    const [p, r, snap] = pose(dt); applyPose(V.J, p, r, dt, snap); V.J.root.rotation.y = V.rot; turn.rotation.y = V.rot;
    const portrait = innerHeight > innerWidth; const ty = portrait ? 0.82 : 0.86;
    camera.position.set(0, ty + V.dist * 0.2, V.dist); camera.lookAt(0, ty, 0);
    sun.target.position.set(0, 0, 0);
    draw();
  } catch (err) { __celErr.n++; __celErr.last = String(err && err.stack || err); if (__celErr.n < 4) console.error(err); }
}
sun.shadow.camera.left = sun.shadow.camera.bottom = -3; sun.shadow.camera.right = sun.shadow.camera.top = 3; sun.shadow.camera.updateProjectionMatrix();
buildModel(); setLight(Q.get('night') === '1' || Q.get('tod') === '0.5'); setHD(QUAL.hd); setAnim(Q.get('anim') || 'idle');
if (Q.has('rot')) { V.rot = +Q.get('rot'); V.spin = false; $('bSpin').classList.remove('on'); }
requestAnimationFrame(frame);
window.__v = { V, setHD, setLight, setAnim, QUAL, get frames() { return frames; }, renderer, camera };
