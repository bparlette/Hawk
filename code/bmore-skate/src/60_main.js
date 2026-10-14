
// ======================= TOAD CITY SKATE: the run (title > countdown > 2:00 > results > retry), camera, visuals, juice, goals =======================
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const RUN_LEN = clamp(+(Q.get('runlen') || 120), 5, 600);
const GOALS = {
  list: [
    { id: 'score', chip: 'SCORE 25K', name: 'HIGH SCORE', desc: 'Score 25,000 points', target: 25000 },
    { id: 'combo', chip: 'COMBO 5K', name: 'SICK COMBO', desc: 'Land a 5,000-point combo', target: 5000 },
    { id: 'skate', chip: 'SKATE', name: 'S-K-A-T-E', desc: 'Collect the letters S K A T E' },
    { id: 'tape', chip: 'TAPE', name: 'SECRET TAPE', desc: 'Find the secret tape (out on the Constellation pier)' },
    { id: 'gap', chip: 'HARBOR GAP', name: 'HARBOR GAP', desc: 'Jump the water: World Trade Center pier to the Aquarium' },
  ],
  done: 0,
};
const GM = { state: 'load', timeLeft: RUN_LEN, countT: 0, paused: false, runs: 0, best: +(localStorage.getItem('tcs_best') || 0), endT: 0, slowmo: 0, shake: 0, flash: 0, lastResult: null, attractYaw: 1.2 };
// ---------------- the light: a fixed late-afternoon harbour (Toad City's day / dusk palette at n = 0.16) ----------------
(function light() {
  const _ck = (a) => a.map((c) => new THREE.Color(c));
  const P = { top: _ck(['#4a86c8', '#34386e']), mid: _ck(['#9cc4dc', '#b0706a']), hor: _ck(['#d8dccf', '#f08850']), fog: _ck(['#b4c0c6', '#8a6060']), hs: _ck(['#dfe6ff', '#ffb08a']), hg: _ck(['#8a7f74', '#5a4040']), sun: _ck(['#fff3dc', '#ff9a58']) };
  const t = clamp(+(Q.get('dusk') || 0.32), 0, 1), L = (k, out) => out.copy(P[k][0]).lerp(P[k][1], t);
  L('top', SKY.U.top.value); L('mid', SKY.U.mid.value); L('hor', SKY.U.hor.value); SKY.U.uStars.value = 0;
  L('fog', scene.fog.color); OUT_U.fogC.value.copy(scene.fog.color); renderer.setClearColor(scene.fog.color);
  scene.fog.near = 60; scene.fog.far = 175; OUT_U.fogN.value = 60; OUT_U.fogF.value = 175;
  L('hs', hemi.color); L('hg', hemi.groundColor); hemi.intensity = lerp(1.45, 0.85, t); L('sun', sun.color); sun.intensity = lerp(2.1, 1.25, t);
  SUN_DIR.set(-0.75, 1.15, 0.12).normalize(); SKY.sunS.position.copy(SUN_DIR).multiplyScalar(70); SKY.sunS.material.opacity = 1; SKY.moonS.material.opacity = 0;
  for (const c of SKY.clouds) c.material.color.set('#ffe6d8');
  NIGHT.value = 0; for (const q of NIGHTFX.pools) q.visible = false; for (const h of NIGHTFX.halos) h.visible = false; NIGHTFX.neon.tint(0, 1);
})();
// ---------------- the quality: Toad City's HD look (cel bands, ink hulls, PCF shadows), sized for phones ----------------
applyQuality(true);
sun.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048); renderer.shadowMap.type = THREE.PCFSoftShadowMap;
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28 }); sun.shadow.camera.updateProjectionMatrix();
const SHR2 = 28; let SHM2 = sun.shadow.mapSize.x;
// the comic post pass (replaces Toad City's HD straight copy): halftone dots in the shadow bands, a soft ink vignette, a hit flash
POST.uniforms.uHT = { value: Q.has('noht') ? 0 : 1 }; POST.uniforms.uFlash = { value: 0 };
POST.fragmentShader = `uniform sampler2D tSrc; uniform vec2 uRes; uniform float uDither; uniform float uPost; uniform float uHT; uniform float uFlash; varying vec2 vUv;
  vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main() {
    vec3 c = toSRGB(texture2D(tSrc, vUv).rgb);
    if (uHT > 0.5) {
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec2 p = gl_FragCoord.xy / max(1.0, uRes.y / 300.0);
      vec2 q = vec2(p.x + p.y, p.x - p.y) * 0.7071 / 3.0; float d = length(fract(q) - 0.5);
      float dark = smoothstep(0.46, 0.1, l), r = dark * 0.52;
      float m = 1.0 - smoothstep(r - 0.05, r + 0.05, d);
      c = mix(c, c * vec3(0.52, 0.46, 0.68), m * 0.6 * dark);
      vec2 v = vUv - 0.5; c *= 1.0 - dot(v, v) * 0.42;
    }
    c = mix(c, vec3(1.0), uFlash);
    gl_FragColor = vec4(c, 1.0); }`;
POST.needsUpdate = true;
let DPR = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 1.25); if (Q.has('dpr')) DPR = +Q.get('dpr');
if (Q.has('lowq')) { DPR = 0.4; sun.shadow.mapSize.set(512, 512); }
function resize() {
  const w = innerWidth, h = innerHeight, lw = Math.round(w * DPR), lh = Math.round(h * DPR);
  renderer.setSize(lw, lh, false); RT.setSize(lw, lh); POST.uniforms.uRes.value.set(lw, lh);
  camera.aspect = w / h; CAM.port = w / h < 0.85; camera.fov = CAM.port ? 74 : 62; camera.updateProjectionMatrix();
}
const CAM = { pos: new THREE.Vector3(), look: new THREE.Vector3(), yaw: 0, init: false, port: false, fovK: 0 };
addEventListener('resize', resize);

// ---------------- world pickups: the S K A T E letters (spinning comic letters with an ink rim), the secret tape, goal markers ----------------
const PICK = (function () {
  const grp = new THREE.Group(); scene.add(grp);
  const letterTex = (ch) => canvasTex(256, 256, (c) => {
    c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, 256, 256);
    const g = c.createRadialGradient(128, 128, 30, 128, 128, 126); g.addColorStop(0, 'rgba(255,210,60,.55)'); g.addColorStop(1, 'rgba(255,210,60,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    c.fillStyle = INK; c.beginPath(); c.arc(128, 128, 92, 0, TAU); c.fill(); c.fillStyle = '#ff5fa2'; c.beginPath(); c.arc(128, 128, 82, 0, TAU); c.fill();
    halftone(c, 46, 46, 164, 164, 'rgba(255,255,255,.28)', 12, 4.2, 1);
    comicText(c, ch, 128, 136, 128, '#ffd23c', null, { shadow: true });
  }, 256);
  const L = SKD.letters.map((d) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTex(d.ch), transparent: true, depthWrite: false, fog: false })); s.scale.set(1.5, 1.5, 1); s.position.set(d.x, d.y, d.z); s.renderOrder = 6; grp.add(s);
    return { d, s };
  });
  // the secret tape: a little cassette (cel body, ink hull) that spins + bobs on the Constellation pier
  const T = SKD.tape, tape = new THREE.Group(); tape.position.set(T.x, T.y, T.z); grp.add(tape);
  { const hb = new HB(); hb.box(-0.32, -0.2, -0.05, 0.32, 0.2, 0.05, '#1c1a22'); hb.box(-0.27, -0.06, 0.05, 0.27, 0.16, 0.06, '#ffd23c', { ol: false }); hb.box(-0.16, -0.02, 0.06, 0.16, 0.1, 0.065, '#2a2630', { ol: false });
    for (const x of [-0.09, 0.09]) hb.geo(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10).rotateX(Math.PI / 2).translate(x, 0.04, 0.07), '#f4f0e6', { ol: false });
    hb.box(-0.2, -0.2, 0.05, 0.2, -0.1, 0.06, '#6a3ab8', { ol: false });
    const m = hb.build(); m.scale.setScalar(1.25); if (m.userData.hull) m.userData.hull.material = OUT_CHAR; tape.add(m); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FXT.star, transparent: true, depthWrite: false, fog: false, opacity: 0.55, color: '#ffe6a0' })); glow.scale.set(1.6, 1.6, 1); glow.renderOrder = 4; tape.add(glow);
  function update(rdt, t) {
    const S = SKP.S;
    for (const l of L) { const got = S.letters.has(l.d.ch); l.s.visible = !got; if (!got) { l.s.position.y = l.d.y + Math.sin(t * 2.4 + l.d.x) * 0.12; l.s.material.rotation = Math.sin(t * 1.7 + l.d.z) * 0.18; } }
    tape.visible = !S.tape; if (!S.tape) { tape.rotation.y = t * 2.2; tape.position.y = T.y + Math.sin(t * 2) * 0.12; glow.material.rotation = t; }
  }
  return { update, L, tape };
})();

// ---------------- juice: sparks, dust, speed lines, trick word pops (Toad City's FXT kit + its sprite pool) ----------------
const JUICE = (function () {
  const sparkTex = canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.3, 'rgba(255,200,80,.9)'); g.addColorStop(1, 'rgba(255,120,20,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }, 64);
  const N = 90, sp = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), N);
  sp.frustumCulled = false; sp.renderOrder = 8; scene.add(sp);
  const P = []; for (let i = 0; i < N; i++) P.push({ life: 0, t: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.1 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(); let pi = 0;
  function spark(x, y, z, vx, vz, n = 2) { for (let k = 0; k < n; k++) { const p = P[pi = (pi + 1) % N]; Object.assign(p, { x, y, z, vx: -vx * 0.25 + rnd(-1.5, 1.5), vy: rnd(1, 3.2), vz: -vz * 0.25 + rnd(-1.5, 1.5), t: 0, life: rnd(0.2, 0.45), s: rnd(0.06, 0.13) }); } }
  function update(dt) {
    q.copy(camera.quaternion);
    for (let i = 0; i < N; i++) { const p = P[i]; if (p.t < p.life) { p.t += dt; p.vy -= 14 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const k = 1 - p.t / p.life; m4.compose(v.set(p.x, p.y, p.z), q, sc.set(p.s * k + 0.01, p.s * k + 0.01, 1)); }
      else m4.makeScale(0, 0, 0); sp.setMatrixAt(i, m4); }
    sp.instanceMatrix.needsUpdate = true;
  }
  function dust(x, y, z, n = 3, size = 0.9) { for (let k = 0; k < n; k++) spawnSprite(FXT.puff, new THREE.Vector3(x + rnd(-0.3, 0.3), y + 0.15, z + rnd(-0.3, 0.3)), size * rnd(0.6, 1), 0.45, { kind: 'grow', vel: new THREE.Vector3(rnd(-1, 1), 0.6, rnd(-1, 1)), depth: true }); }
  const WORDS = {}; const wordTex = (w, fill) => WORDS[w] || (WORDS[w] = canvasTex(512, 192, (c) => {
    c.fillStyle = INK; c.beginPath(); for (let k = 0; k < 28; k++) { const r = k % 2 ? 62 : 92, a = k / 28 * TAU; c.lineTo(256 + Math.cos(a) * r * 2.5, 96 + Math.sin(a) * r * 0.95); } c.fill();
    c.fillStyle = '#fff'; c.beginPath(); for (let k = 0; k < 28; k++) { const r = k % 2 ? 54 : 82, a = k / 28 * TAU; c.lineTo(256 + Math.cos(a) * r * 2.5, 96 + Math.sin(a) * r * 0.95); } c.fill();
    halftone(c, 60, 20, 392, 152, 'rgba(255,95,162,.35)', 12, 4, 1); comicText(c, w, 256, 100, w.length > 7 ? 62 : w.length > 5 ? 80 : 96, fill, null, { sx: 1 }); }, 256));
  function word(w, fill = '#ffd23c', at) { const S = SKP.S, p = at || new THREE.Vector3(S.x, S.y + 2.3, S.z); spawnSprite(wordTex(w, fill), p, 1.25, 0.9, { kind: 'word', aspect: 512 / 192 }); }
  // speed lines: a screen-space overlay canvas (ink streaks from the edges when fast)
  const sl = document.createElement('canvas'); sl.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:5;pointer-events:none;opacity:0;transition:opacity .2s'; document.body.appendChild(sl);
  const sg = sl.getContext('2d'); let slT = 0;
  function lines(rdt, amt) {
    sl.style.opacity = amt > 0.02 ? String(Math.min(0.85, amt)) : '0'; if (amt <= 0.02) return; slT += rdt; if (slT < 0.05) return; slT = 0;
    const w = sl.width = Math.round(innerWidth / 2), h = sl.height = Math.round(innerHeight / 2), cx = w / 2, cy = h * 0.46; sg.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, r0 = Math.max(w, h) * rnd(0.42, 0.55), r1 = r0 + rnd(30, 90); sg.strokeStyle = i % 3 ? 'rgba(255,255,255,.55)' : 'rgba(20,16,31,.55)'; sg.lineWidth = rnd(1, 2.5);
      sg.beginPath(); sg.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8); sg.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8); sg.stroke(); }
  }
  return { spark, update, dust, word, lines };
})();

// ---------------- events from the sim -> HUD / audio / FX / goals ----------------
function goalCheck() {
  const S = SKP.S; let n = 0;
  for (const g of GOALS.list) {
    const was = g.done;
    g.done = g.id === 'score' ? S.score >= g.target : g.id === 'combo' ? S.bestCombo >= g.target : g.id === 'skate' ? S.letters.size >= 5 : g.id === 'tape' ? S.tape : S.gapsDone.has('HARBOR GAP');
    if (g.done) n++;
    if (g.done && !was && GM.state === 'play') { SKH.banner(`GOAL!<small>${g.name}</small>`, 1.8); SKA.play('goal'); GM.flash = 0.35; }
  }
  if (n !== GOALS.done || !GOALS.chipped) { GOALS.done = n; GOALS.chipped = true; SKH.goalsChips(GOALS); }
}
function handleEvents() {
  const S = SKP.S;
  for (const e of S.events) {
    if (window.__bot) { const B = __bot.B; if (B.ev.length < 600) B.ev.push([e.type, e.name || e.why || e.ch || '', e.pts || e.total || e.lost || 0, +S.x.toFixed(1), +S.y.toFixed(2), +S.z.toFixed(1), +S.t.toFixed(2)]); }
    if (e.type === 'pop') { SKA.play('pop'); JUICE.dust(S.x, S.y, S.z, 2, 0.6); }
    else if (e.type === 'land') { SKA.play('land', e); JUICE.dust(S.x, S.y, S.z, e.hard ? 5 : 3, e.hard ? 1.1 : 0.8); if (e.hard) GM.shake = Math.max(GM.shake, 0.18); }
    else if (e.type === 'flip') SKA.play('flip');
    else if (e.type === 'grab') SKA.play('grab');
    else if (e.type === 'grind') { SKA.play('lock'); GM.shake = Math.max(GM.shake, 0.06); }
    else if (e.type === 'bank') { SKA.play('bank', e); SKH.onBank(e.total, e.mult); if (e.total >= 2000) JUICE.word(e.total >= 8000 ? 'INSANE!' : e.total >= 4000 ? 'SICK!' : 'NICE!', e.total >= 8000 ? '#ff5fa2' : '#7dff6b'); goalCheck(); }
    else if (e.type === 'bail') { SKA.play('bail'); SKH.onBail(e.lost); JUICE.word(e.why === 'SPLASH' ? 'SPLASH!' : ['BAIL!', 'OOF!', 'SLAM!'][Math.floor(Math.random() * 3)], '#ff8a3d'); GM.shake = 0.45; GM.slowmo = 0.3; if (e.why === 'SPLASH') SKA.play('splash'); if (e.lost > 500) SKH.toast(`Bailed: <b>${SKH.fmt(e.lost)}</b> lost`); }
    else if (e.type === 'clack') SKA.play('clack');
    else if (e.type === 'splash') SKA.play('splash');
    else if (e.type === 'bump') { if (e.s > 3) { SKA.play('bump'); GM.shake = Math.max(GM.shake, 0.1); } }
    else if (e.type === 'letter') { SKA.play('letter'); SKH.banner(`${e.ch}<small>${e.n} / 5 LETTERS</small>`, 1.1); GOALS.chipped = false; goalCheck(); }
    else if (e.type === 'tape') { SKA.play('goal'); SKH.toast('<b>SECRET TAPE</b> found: the B-MORE 410 mixtape'); goalCheck(); }
    else if (e.type === 'gap') { SKA.play('gap'); SKH.toast(`<b>${e.name}</b> +${e.pts}`, 1.6); if (e.goal) goalCheck(); }
    else if (e.type === 'special') { SKA.play('special'); JUICE.word(e.name.split(' ')[0] + '!', '#7fe8ff'); GM.flash = 0.25; }
    else if (e.type === 'nospecial') { SKA.play('nope'); SKH.toast('Fill the <b>SPECIAL</b> meter with tricks first', 1.6); }
    else if (e.type === 'respawn') {}
  }
  S.events.length = 0;
}

// ---------------- the skater's visual state ----------------
const VIS = { t: 0, pushPh: 0, flipR: 0 };
function skaterVisual(rdt) {
  const S = SKP.S, R = SKR.root, BP = SKR.boardPivot, BS = SKR.boardSpin, RP = SKR.riderPivot;
  VIS.t += rdt;
  let yaw = S.h, y = S.y, pose, rate = 14, roll = 0, pitch = 0, riderY = 0.105, boardY = 0.09;
  BS.rotation.set(0, 0, 0); BP.rotation.set(0, 0, 0); BP.position.set(0, boardY, 0); RP.rotation.set(0, -Math.PI / 2, 0);
  if (S.mode === 'ground') {
    if (S.getup > 0) pose = SKR.P.getup(1 - S.getup / 0.6);
    else if (S.buf.ollie > 0 || (SKI.held.ollie && S.v > 0)) pose = SKR.P.crouch(0.8);
    else pose = SKR.P.roll(VIS.t, S.lean, S.pushT > 0 ? (S.pushT % 1) : 0, S.v);
    roll = S.lean * 0.12; pitch = -S.slope * 0.75;
    if (S.landT > 0) { const k = S.landT / 0.28; pose.knL[0] += 0.7 * k; pose.knR[0] += 0.7 * k; pose.y -= 0.12 * k; }
  } else if (S.mode === 'manual') {
    pose = SKR.P.manual(S.bal, S.manual.nose); const a = S.manual.special ? 0.6 : 0.3; pitch = (S.manual.nose ? 1 : -1) * a; BP.position.y = boardY + Math.sin(Math.abs(pitch)) * 0.28; riderY = 0.105 + Math.sin(Math.abs(pitch)) * 0.25;
    if (S.manual.special) { RP.rotation.y = -Math.PI / 2 + Math.sin(VIS.t * 9) * 0.25; }
  } else if (S.mode === 'air') {
    yaw = S.travel + S.yawOff;
    const fl = S.flip, gr = S.grab;
    if (gr) pose = SKR.P.grab(gr.kind, clamp(gr.t / 0.12, 0, 1));
    else if (fl && fl.special) pose = SKR.P.special(fl.u);
    else pose = SKR.P.air(S.vy, fl ? Math.sin(Math.PI * clamp(fl.u, 0, 1)) : clamp(S.airT * 3, 0, 0.6));
    if (fl) { const a = clamp(fl.u, 0, 1) * TAU * fl.n * (fl.sg || 1); if (fl.ax === 'z') BS.rotation.z = a; else if (fl.ax === 'x') BS.rotation.x = a; else BS.rotation.y = a * 0.5; riderY += Math.sin(Math.PI * clamp(fl.u, 0, 1)) * 0.22; BP.position.y = boardY + Math.sin(Math.PI * clamp(fl.u, 0, 1)) * 0.12; }
    if (S.airT < 0.14 && !fl) BP.rotation.x = -0.35 * (1 - S.airT / 0.14); // the pop: tail snaps down
    if (gr) { BP.position.y = boardY + 0.22; riderY += 0.12; if (gr.kind === 'METHOD') BP.rotation.z = -0.5; else if (gr.kind === 'NOSEGRAB') BP.rotation.x = 0.3; else if (gr.kind === 'TAILGRAB') BP.rotation.x = -0.3; else BP.rotation.z = 0.25; }
    rate = 18;
  } else if (S.mode === 'grind') {
    const r = S.gr; yaw = r.yaw; pose = SKR.P.grind(S.bal, r.slide ? 'slide' : 'grind', VIS.t);
    const g = r.g; pitch = -Math.atan2((g.b.y - g.a.y) * r.dir, Math.hypot(g.b.x - g.a.x, g.b.z - g.a.z)) * (r.slide ? 0 : 1);
    y -= r.slide ? 0.06 : 0.03; roll = r.slide ? Math.atan2(g.b.y - g.a.y, Math.hypot(g.b.x - g.a.x, g.b.z - g.a.z)) * (Math.sin(r.yaw - Math.atan2(r.u.x, r.u.z)) > 0 ? 1 : -1) : 0;
    if (/NOSE/.test(r.name)) { BP.rotation.x = 0.25; BP.position.z = -0.2; } else if (/5-0|TAIL/.test(r.name)) { BP.rotation.x = -0.25; BP.position.z = 0.2; } else if (/CROOKED|SMITH/.test(r.name)) { BP.rotation.x = 0.18; BP.rotation.z = 0.2; }
    if (r.special) { RP.rotation.y = -Math.PI / 2 + Math.sin(VIS.t * 10) * 0.4; riderY += 0.12; }
    // sparks off the rail
    if (Math.random() < 0.85) JUICE.spark(S.x, S.y + 0.02, S.z, S.vx, S.vz, g.kind === 'rail' ? 2 : 1);
  } else if (S.mode === 'bail') {
    pose = SKR.P.bail(S.bailT); rate = 10; y = S.y;
  }
  if (S.fakie && S.mode !== 'bail' && S.mode !== 'air' && S.mode !== 'grind') yaw += Math.PI;
  R.position.set(S.x, y, S.z); R.rotation.set(pitch, yaw, roll);
  RP.position.y = riderY;
  SKR.pose(pose, rate, rdt, S.mode === 'bail' && S.bailT < 0.02);
  if (S.mode === 'bail') { // the board flies on its own
    R.updateMatrixWorld(true); const b = S.board, lp = R.worldToLocal(new THREE.Vector3(b.x, b.y, b.z)); BP.position.copy(lp); BS.rotation.set(b.r, 0, b.r * 0.4);
    if (S.bailSplash) RP.position.y = riderY - clamp(S.bailT * 1.2, 0, 1.6);
  }
  // blob shadow on the floor under the board
  const fl = SKP.floorAt(S.x, S.z, S.y + 0.05), hgt = Math.max(0, S.y - fl.f);
  SKR.blob.position.set(S.x, (fl.water ? WY : fl.f) + 0.02, S.z); SKR.blob.scale.setScalar(clamp(1 - hgt * 0.25, 0.35, 1)); SKR.blob.material.opacity = fl.water ? 0.12 : 0.3 * clamp(1 - hgt * 0.2, 0.3, 1);
}

// ---------------- the chase camera (behind + above, swings with the travel direction; pulls in near walls) ----------------
const _cv = new THREE.Vector3(), _ct = new THREE.Vector3();
function camHit(x0, y0, z0, x1, y1, z1) { // march target -> camera; returns the fraction at the first building box (camera collision, the city's BLD boxes)
  let best = 1; const N = 14;
  for (let i = 1; i <= N; i++) { const t = i / N, x = lerp(x0, x1, t), y = lerp(y0, y1, t), z = lerp(z0, z1, t);
    for (const b of BLD) if (x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3 && y < b.h + 0.2) { return Math.max(0.2, (i - 1) / N); } }
  return best;
}
function cameraStep(rdt, attract) {
  const S = SKP.S;
  const sp = Math.hypot(S.vx, S.vz);
  let want = S.mode === 'grind' ? Math.atan2(S.vx, S.vz) : S.mode === 'air' ? (sp > 1 ? Math.atan2(S.vx, S.vz) : S.travel) : S.mode === 'bail' ? CAM.yaw : (S.v > 0.6 ? S.h : CAM.yaw);
  if (attract) want = GM.attractYaw;
  if (!CAM.init) { CAM.yaw = want; }
  CAM.yaw += wrapA(want - CAM.yaw) * (1 - Math.exp(-(S.mode === 'air' ? 2.2 : 4.2) * rdt));
  const fast = clamp((sp - 6) / 7, 0, 1); CAM.fovK = damp(CAM.fovK, fast, 3, rdt);
  const dist = (CAM.port ? 6.4 : 5.4) + fast * 0.9 + (S.mode === 'bail' ? 1.2 : 0), hgt = (CAM.port ? 2.9 : 2.35) + fast * 0.3;
  const tx = S.x + Math.sin(CAM.yaw) * 1.6, ty = S.y + 1.15, tz = S.z + Math.cos(CAM.yaw) * 1.6;
  let cx = S.x - Math.sin(CAM.yaw) * dist, cy = S.y + hgt, cz = S.z - Math.cos(CAM.yaw) * dist;
  const f = camHit(S.x, S.y + 1.3, S.z, cx, cy, cz); if (f < 1) { cx = lerp(S.x, cx, f); cz = lerp(S.z, cz, f); cy = lerp(S.y + 1.3, cy, f) + (1 - f) * 1.6; }
  cy = Math.max(cy, (isWater(cx, cz) ? WY : groundY(cx, cz)) + 0.9);
  _cv.set(cx, cy, cz); _ct.set(tx, ty, tz);
  if (!CAM.init) { CAM.pos.copy(_cv); CAM.look.copy(_ct); CAM.init = true; }
  CAM.pos.x = damp(CAM.pos.x, _cv.x, 9, rdt); CAM.pos.z = damp(CAM.pos.z, _cv.z, 9, rdt); CAM.pos.y = damp(CAM.pos.y, _cv.y, S.mode === 'air' ? 3.5 : 7, rdt);
  CAM.look.lerp(_ct, 1 - Math.exp(-12 * rdt));
  camera.position.copy(CAM.pos);
  if (GM.shake > 0) { const a = GM.shake * 0.35; camera.position.x += rnd(-a, a); camera.position.y += rnd(-a, a) * 0.7; camera.position.z += rnd(-a, a); GM.shake = Math.max(0, GM.shake - rdt * 1.6); }
  camera.lookAt(CAM.look);
  const fov = (CAM.port ? 74 : 62) + CAM.fovK * 8 + (S.specialOn ? 2 : 0); if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

// ---------------- the run flow ----------------
const UI = { title: $('titleC'), pause: $('pauseC'), res: $('resC') };
function goalListHtml(el, live) {
  el.innerHTML = GOALS.list.map((g, i) => `<li class="${live && g.done ? 'done' : ''}"><i>${live && g.done ? '✓' : i + 1}</i><span>${g.name}<small>${g.desc}${g.id === 'skate' && live ? ' · ' + 'SKATE'.split('').map((c) => (SKP.S.letters.has(c) ? c : '·')).join(' ') : ''}</small></span></li>`).join('');
}
function showCard(c) { for (const k in UI) UI[k].classList.toggle('on', UI[k] === c); }
function toTitle() { GM.state = 'title'; goalListHtml($('tGoals'), false); $('tKeys').innerHTML = SKH.keysHtml(); showCard(UI.title); GM.attractYaw = 1.2; }
function startRun() {
  SKA.unlock(); SKP.reset(); for (const g of GOALS.list) g.done = false; GOALS.chipped = false; goalCheck();
  GM.timeLeft = RUN_LEN; GM.state = 'count'; GM.countT = 3.2; GM.paused = false; GM.runs++; GM.endT = 0; CAM.init = false; GM.lastCount = 4;
  showCard(null); SKH.toast(TOUCH || document.body.classList.contains('touch') ? 'Stick: steer · <b>OLLIE</b> to pop · <b>GRIND</b> near rails' : '<b>SPACE</b> ollie · <b>J</b> flip · <b>K</b> grab · <b>L</b> grind', 3.2);
  SKA.musicStart();
}
function endRun() {
  if (SKP.inCombo() && SKP.S.mode !== 'bail') SKP.bank(); handleEvents(); goalCheck();
  const S = SKP.S; GM.state = 'results'; SKA.musicStop(); SKA.play('horn'); S.frozen = true;
  const won = GOALS.done === GOALS.list.length, newBest = S.score > GM.best; if (newBest) { GM.best = S.score; localStorage.setItem('tcs_best', String(S.score)); }
  $('rHead').textContent = won ? 'ALL GOALS!' : 'TIME!';
  $('rScore').textContent = SKH.fmt(S.score);
  const rank = S.score >= 60000 ? 'HARBOR LEGEND' : S.score >= 40000 ? 'PRATT ST PRO' : S.score >= 25000 ? 'STOOP RIPPER' : S.score >= 10000 ? 'FELLS POINT AM' : S.score >= 3000 ? 'ROWHOUSE ROOKIE' : 'BENCH WARMER';
  $('rRank').textContent = `${rank} · ${GOALS.done} / ${GOALS.list.length} GOALS`;
  $('rBest').textContent = newBest ? 'NEW BEST RUN!' : GM.best ? 'BEST ' + SKH.fmt(GM.best) : '';
  $('rStats').innerHTML = [['BEST COMBO', SKH.fmt(S.bestCombo)], ['BEST TRICK', S.bestTrick || '-'], ['TRICKS', S.stats.tricks], ['BAILS', S.stats.bails], ['GRIND TIME', S.stats.grindT.toFixed(1) + 's'], ['BIGGEST AIR', S.stats.maxAir.toFixed(2) + 's']].map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join('');
  goalListHtml($('rGoals'), true);
  GM.lastResult = { score: S.score, goals: GOALS.done, won, bestCombo: S.bestCombo, tricks: S.stats.tricks, bails: S.stats.bails, letters: [...S.letters].join(''), tape: S.tape, gap: S.gapsDone.has('HARBOR GAP') };
  setTimeout(() => { if (GM.state === 'results') showCard(UI.res); }, 900);
}
function setPause(p) { if (GM.state !== 'play' && GM.state !== 'count') return; GM.paused = p; if (p) { goalListHtml($('pGoals'), true); showCard(UI.pause); for (const k in SKI.held) SKI.held[k] = 0; } else showCard(null); }
$('startB').addEventListener('click', startRun);
$('retryB').addEventListener('click', startRun);
$('resumeB').addEventListener('click', () => setPause(false));
$('restartB').addEventListener('click', startRun);
$('pauseB').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); setPause(!GM.paused); });
{ const mb = $('muteB'); mb.classList.toggle('off', !SKA.on); mb.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); SKA.unlock(); SKA.setOn(!SKA.on); mb.classList.toggle('off', !SKA.on); }); }
SKH.setOnKey((e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (GM.state === 'play' || GM.state === 'count') { setPause(!GM.paused); return true; } }
  if (e.code === 'KeyM') { SKA.unlock(); SKA.setOn(!SKA.on); $('muteB').classList.toggle('off', !SKA.on); return true; }
  if ((e.code === 'Enter' || e.code === 'Space') && (GM.state === 'title' || (GM.state === 'results' && UI.res.classList.contains('on')))) { startRun(); return true; }
  if (e.code === 'KeyR' && (GM.state === 'results' || GM.paused)) { startRun(); return true; }
  return false;
});
addEventListener('visibilitychange', () => { if (document.hidden && GM.state === 'play') setPause(true); });

// ---------------- the frame ----------------
const FPS = { v: 60, n: 0, t: 0, hist: [] };
let last = performance.now();
const SIM = +(Q.get('sim') || 0);
const CAPTURE = Q.has('capture');
function frame(now) {
  if (!CAPTURE) requestAnimationFrame(frame);
  try {
    let rdt = Math.min(0.05, (now - last) / 1000); last = now; if (SIM) rdt = 1 / 60; if (CAPTURE) rdt = 1 / 30;
    FPS.n++; FPS.t += (now - (frame.p || now)) / 1000; frame.p = now; if (FPS.t >= 1) { FPS.v = Math.round(FPS.n / FPS.t); FPS.hist.push(FPS.v); if (FPS.hist.length > 300) FPS.hist.shift(); FPS.n = 0; FPS.t = 0; }
    window.__cel.frames++;
    SKH.read();
    if (window.__bot) __bot.think(rdt);
    let dt = rdt; if (GM.slowmo > 0) { GM.slowmo -= rdt; dt = rdt * 0.4; }
    const S = SKP.S;
    if (GM.state === 'title') { // attract: the camera drifts round the harbour behind a parked skater
      GM.attractYaw += rdt * 0.12; S.frozen = true;
    } else if (GM.state === 'count' && !GM.paused) {
      GM.countT -= rdt * (SIM || 1); const n = Math.ceil(GM.countT - 0.2); if (n !== GM.lastCount) { GM.lastCount = n; if (n >= 1 && n <= 3) { SKH.count(String(n)); SKA.play('beep'); } else if (n <= 0) { SKH.count('GO!'); SKA.play('beep', { hi: 1 }); } }
      S.frozen = true; if (GM.countT <= 0) { GM.state = 'play'; S.frozen = false; setTimeout(() => SKH.count(''), 700); }
    } else if (GM.state === 'play' && !GM.paused) {
      S.frozen = false;
      const steps = SIM ? SIM : 1; GM.timeLeft -= dt * steps; for (let k = 0; k < steps; k++) { if (k > 0) { SKH.read(); if (window.__bot) __bot.think(rdt); } SKP.step(dt); }
      if (GM.timeLeft <= 0) { GM.timeLeft = 0; endRun(); }
    }
    if (!GM.paused && GM.state !== 'title') { if (GM.state !== 'play') SKP.step(0); }
    handleEvents(); if (GM.state === 'play') goalCheck();
    if (!GM.paused) { skaterVisual(GM.state === 'title' ? rdt : dt); PICK.update(rdt, now / 1000); JUICE.update(dt); updateSprites(dt); }
    cameraStep(rdt, GM.state === 'title');
    const sp = Math.hypot(S.vx, S.vz); JUICE.lines(rdt, GM.state === 'play' && !GM.paused ? clamp((sp - 9.5) / 4, 0, 1) * 0.8 + (S.specialOn ? 0.15 : 0) : 0);
    SKA.frame(rdt, S, GM.state === 'play' && !GM.paused);
    // the sun's shadow camera follows the skater (snapped to texels)
    const tx = SHR2 * 2 / SHM2, sx = Math.round(S.x / tx) * tx, sz = Math.round(S.z / tx) * tx;
    sun.target.position.set(sx, 0, sz); sun.position.set(sx + SUN_DIR.x * 70, SUN_DIR.y * 70, sz + SUN_DIR.z * 70);
    window.__sky.position.copy(camera.position);
    SKH.update(rdt, GM);
    if (GM.flash > 0) { GM.flash -= rdt; } POST.uniforms.uFlash.value = Math.max(0, GM.flash) * 0.9;
    draw();
  } catch (e) { __celErr.n++; __celErr.last = String(e && e.stack || e); if (__celErr.n < 4) console.error(e); }
}
// ---------------- boot ----------------
const BOOT = { t0: performance.now() };
window.__cel = { frames: 0, renderer, GM, GOALS, SKP, SKI, SKD, SKR, FPS, camera, scene, startRun, endRun, setPause, BOOT };
setTimeout(() => {
  BOOT.rigMs = SKR.build();
  resize(); SKP.reset(); skaterVisual(0.016); CAM.init = false; cameraStep(0.016, true);
  BOOT.ms = Math.round(performance.now() - BOOT.t0);
  $('loading').classList.add('gone');
  if (Q.has('autostart')) startRun(); else toTitle();
  if (CAPTURE) window.__adv = (n = 1) => { for (let i = 0; i < n; i++) frame(performance.now()); return __cel.frames; }; else requestAnimationFrame(frame);
}, 30);
