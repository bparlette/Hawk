
// ======================= TOAD CITY DRONE RACER: race rules, rivals, ghost, camera + juice, HUD, menus, main loop =======================
const SET = Object.assign({ mode: 'arcade', cam: 'chase', tod: 'day', rivals: 'both' }, JSON.parse(localStorage.getItem('tcdr.set') || '{}'));
const saveSet = () => localStorage.setItem('tcdr.set', JSON.stringify(SET));
const BOTQ = Q.get('bot'); // QA: ?bot=1 autopilot | idle | crash
const SIM = clamp(+(Q.get('sim') || 1), 1, 12); // QA only: simulated seconds per real second (fixed 1/50 s physics steps either way)
const PENALTY = 2.0, LAPS = clamp(+(Q.get('laps') || 3), 1, 5);
document.body.classList.toggle('touch', TOUCH);
if (Q.has('mode')) SET.mode = Q.get('mode') === 'acro' ? 'acro' : 'arcade';
if (Q.has('cam')) SET.cam = Q.get('cam') === 'fpv' ? 'fpv' : 'chase';
if (Q.has('tod')) SET.tod = ['day', 'dusk', 'night'].includes(Q.get('tod')) ? Q.get('tod') : SET.tod;

// ---------------- day / night (Toad City's cycle, pinned to the chosen time of day) ----------------
const CYC = { t: 0, tod: 0, n: 0, lamps: 0 };
const FILL = new THREE.PointLight('#c8d0ff', 0, 14, 1.2); scene.add(FILL);
const _ck = (a) => a.map((c) => new THREE.Color(c));
const PALK = {
  top: _ck(['#4a86c8', '#34386e', '#03050b']), mid: _ck(['#9cc4dc', '#b0706a', '#0a0f1a']), hor: _ck(['#d8dccf', '#f08850', '#141a26']),
  fog: _ck(['#b4c0c6', '#8a6060', '#0b0f17']), hs: _ck(['#dfe6ff', '#ffb08a', '#4a5a88']), hg: _ck(['#8a7f74', '#5a4040', '#14141c']),
  sun: _ck(['#fff3dc', '#ff9a58', '#8aa0e8']), cloud: _ck(['#ffffff', '#ffb0a0', '#20242e']),
};
const DIRK = [new THREE.Vector3(-0.5, 1.7, 0.42).normalize(), new THREE.Vector3(-1, 0.32, -0.25).normalize(), new THREE.Vector3(0.45, 1.2, -0.9).normalize()];
const _cc = new THREE.Color(), _dir = new THREE.Vector3();
const k3 = (n) => (n < 0.5 ? [0, n * 2] : [1, n * 2 - 1]);
function col3(arr, n, out) { const [i, t] = k3(n); return out.copy(arr[i]).lerp(arr[i + 1], t); }
const num3 = (a, b, c, n) => { const [i, t] = k3(n); return i ? lerp(b, c, t) : lerp(a, b, t); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function updateCycle(dt) {
  CYC.t += dt; CYC.tod = { day: 0.06, dusk: 0.27, night: 0.5 }[SET.tod];
  const n = CYC.n = 0.5 - 0.5 * Math.cos(CYC.tod * TAU);
  col3(PALK.top, n, SKY.U.top.value); col3(PALK.mid, n, SKY.U.mid.value); col3(PALK.hor, n, SKY.U.hor.value); SKY.U.uStars.value = sstep(0.62, 0.92, n);
  col3(PALK.fog, n, scene.fog.color); FOGC.copy(scene.fog.color); OUT_U.fogC.value.copy(scene.fog.color); renderer.setClearColor(scene.fog.color);
  scene.fog.near = num3(60, 46, 30, n); scene.fog.far = num3(210, 170, 120, n); OUT_U.fogN.value = scene.fog.near; OUT_U.fogF.value = scene.fog.far;
  col3(PALK.hs, n, hemi.color); col3(PALK.hg, n, hemi.groundColor); hemi.intensity = num3(1.45, 0.85, 0.32, n);
  col3(PALK.sun, n, sun.color); sun.intensity = num3(2.1, 1.25, 0.45, n);
  const [i, t] = k3(n); _dir.copy(DIRK[i]).lerp(DIRK[i + 1], t).normalize(); SUN_DIR.copy(_dir);
  SKY.sunS.position.copy(i ? DIRK[1] : _dir).multiplyScalar(70); SKY.sunS.material.opacity = 1 - sstep(0.45, 0.65, n);
  SKY.moonS.position.copy(DIRK[2]).multiplyScalar(70); SKY.moonS.material.opacity = sstep(0.5, 0.8, n);
  col3(PALK.cloud, n, _cc); for (const c of SKY.clouds) c.material.color.copy(_cc);
  NIGHT.value = sstep(0.32, 0.62, n);
  const on = CYC.lamps = sstep(0.38, 0.56, n);
  NIGHTFX.pools.forEach((q) => { q.material.opacity = on * 0.8; q.visible = on > 0.01; });
  NIGHTFX.halos.forEach((h) => { h.material.opacity = on; h.visible = on > 0.01; });
  NIGHTFX.lights.forEach((l) => { l.intensity = on * 16; });
  FILL.intensity = on * 3.0; FILL.position.copy(camera.position);
  const fl = on > 0.5 && Math.sin(CYC.t * 23) > 0.93 ? 0.55 : 1;
  NIGHTFX.neon.tint(on, on > 0.01 ? fl : 1); NIGHTFX.neon.light.intensity = on * 14 * fl;
  for (const m of LEXW.night) { m.material.opacity = NIGHT.value * 0.85; m.visible = NIGHT.value > 0.02; }
}

// ---------------- world: collision passes, course, crafts ----------------
camera.far = 420; camera.updateProjectionMatrix();
function resize() {
  const w = VW(), h = VH(), a = w / h; const dpr = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 1.25);
  const lw = Math.round(w * dpr), lh = Math.round(h * dpr); LOW.w = lw; LOW.h = lh; renderer.setSize(lw, lh, false); RT.setSize(lw, lh); POST.uniforms.uRes.value.set(lw, lh); SNAP.value.set(lw / 2, lh / 2);
  camera.aspect = a; camera.updateProjectionMatrix();
}
applyQuality(true); sun.shadow.mapSize.set(2048, 2048); renderer.shadowMap.type = THREE.PCFSoftShadowMap; Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34 }); sun.shadow.camera.updateProjectionMatrix();
scene.traverse((o) => { if (o.material && o.material.isMeshLambertMaterial) o.material.needsUpdate = true; });
resize(); addEventListener('resize', resize);
HF.build();
const CRS = COURSE.build('harbor');
const NG = COURSE.gates.length;
const P = newCraft('hero');
const RIV = [{ key: 'mavis', name: 'MAVIS', skill: 0.93 }, { key: 'vic', name: 'VOLTAGE VIC', skill: 0.88 }, { key: 'sugar', name: 'SUGAR RUSH', skill: 0.83 }].map((r, i) => Object.assign(newCraft(r.key), r, { lane: [-1.3, 1.3, 0][i], vlane: [0.4, -0.3, 0.8][i], s: 0, fin: 0 }));
const GH = newCraft('ghost', { ghost: true }); GH.mesh.visible = false;
// ---------------- the AI line: speed profile from the curvature of the racing line ----------------
const LINE = (function () {
  const S = COURSE.samples, N = S.length, v = new Float32Array(N), VMAX = 30, ALAT = 20, ACC = 10, DEC = 16;
  for (let k = 0; k < N; k++) {
    const a = S[(k - 4 + N) % N], b = S[k], c = S[(k + 4) % N]; const u = b.clone().sub(a), w = c.clone().sub(b); const ang = u.angleTo(w), len = (u.length() + w.length()) / 2;
    const kap = ang / Math.max(len, 0.1); v[k] = Math.min(VMAX, Math.sqrt(ALAT / Math.max(kap, 1e-4)));
    const dy = Math.abs(c.y - a.y) / 8; if (dy > 0.5) v[k] *= 0.85; // steep climbs / dives
  }
  for (let it = 0; it < 3; it++) { for (let k = N - 1; k >= 0; k--) { const n = (k + 1) % N; v[k] = Math.min(v[k], Math.sqrt(v[n] * v[n] + 2 * DEC)); } for (let k = 0; k < N; k++) { const p = (k - 1 + N) % N; v[k] = Math.min(v[k], Math.sqrt(v[p] * v[p] + 2 * ACC)); } }
  let T = 0; for (let k = 0; k < N; k++) T += 1 / v[k];
  const tan = (k) => S[(k + 2) % N].clone().sub(S[(k - 2 + N) % N]).normalize();
  return { v, T, N, tan, at: (s) => { const f = ((s % N) + N) % N, i = Math.floor(f), j = (i + 1) % N, t = f - i; return { p: S[i].clone().lerp(S[j], t), v: lerp(v[i], v[j], t), i }; } };
})();
const S0 = COURSE.gates[0].s; // sample index of the start/finish gate
// medal targets from the reference line (rounded to the half second)
const REF = LINE.T * LAPS, MEDALS = { gold: Math.ceil(REF * 1.02 * 2) / 2, silver: Math.ceil(REF * 1.16 * 2) / 2, bronze: Math.ceil(REF * 1.34 * 2) / 2 };
const LIMIT = +(Q.get('limit') || Math.max(MEDALS.bronze * 1.9, 200));

// ---------------- persistence ----------------
const KEY = () => 'tcdr.' + CRS.name.replace(/\W+/g, '').toLowerCase() + '.' + SET.mode;
const loadBest = () => { try { return JSON.parse(localStorage.getItem(KEY() + '.best') || 'null'); } catch (e) { return null; } };
const loadGhost = () => { try { return JSON.parse(localStorage.getItem(KEY() + '.ghost') || 'null'); } catch (e) { return null; } };

// ---------------- race state ----------------
const R = { st: 'menu', t: 0, raceT: 0, count: 0, lap: 0, next: 1, last: 0, lapT0: 0, laps: [], splits: [], crashT: 0, crashes: 0, pen: 0, fin: null, close: 0, posN: 1, rec: [], recT: 0, ghost: null, best: null, closeN: 0, cleanN: 0, place: 0, results: null, prog: 0, sNear: -1 };
const CAM = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 70, roll: 0, shake: 0, mode: SET.cam, kick: 0 };
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _e1 = new THREE.Euler();
function gateYaw(g) { return Math.atan2(g.n.x, g.n.z); }
function resetRace() {
  R.st = 'count'; R.t = 0; R.count = 3.6; R.raceT = 0; R.lap = 0; R.next = 1; R.last = 0; R.lapT0 = 0; R.laps = []; R.splits = []; R.crashT = 0; R.crashes = 0; R.pen = 0; R.fin = null; R.place = 0;
  R.rec = []; R.recT = 0; R.closeN = 0; R.cleanN = 0; R.results = null; R.sNear = -1; R.lastCount = 4;
  R.best = loadBest(); R.ghost = SET.rivals !== 'ai' ? loadGhost() : null;
  const st = CRS.start; placeCraft(P, _v1.set(...st.p), st.yaw); P.boost = 1; P.inv = 0; P.mesh.visible = CAM.mode !== 'fpv'; P.assist = SET.mode === 'arcade';
  const g0 = COURSE.gates[0];
  RIV.forEach((r, i) => { r.s = S0 + 1 - i * 2.2; r.fin = 0; r.mesh.visible = SET.rivals !== 'ghost'; r.boostT = 0; const a = LINE.at(r.s); placeCraft(r, a.p, gateYaw(g0)); });
  GH.mesh.visible = !!R.ghost; if (R.ghost) placeCraft(GH, _v1.set(...st.p), st.yaw);
  COURSE.setState(R.next); CAM.pos.copy(P.pos).addScaledVector(_v1.set(Math.sin(P.yaw), 0, Math.cos(P.yaw)), -4).add(_v2.set(0, 1.5, 0)); CAM.look.copy(P.pos);
  STICKS.reset(); IN.touchBoost = false; showScr(null); document.body.classList.add('racing'); document.body.classList.remove('paused');
  $('count').style.display = 'block'; $('count').textContent = '3'; $('count').classList.remove('go'); hint(controlsHint(), 4);
  AUD.init(); lmk(CRS.name, 2.4);
}
// ---------------- HUD helpers ----------------
const fmt = (t) => { if (!isFinite(t)) return '--:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
let popT = 0, lmkT = 0, hintT = 0, deltaT = 0;
function pop(txt, sub = '', col = '#ffd23c', dur = 1.1) { const e = $('pop'); e.style.top = ''; e.innerHTML = txt + (sub ? `<small>${sub}</small>` : ''); e.style.color = col; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); popT = dur; }
function lmk(txt, dur = 2.2) { const e = $('lmk'); e.textContent = txt; e.classList.add('on'); lmkT = dur; }
function hint(txt, dur = 3) { const e = $('hint'); e.textContent = txt; e.classList.add('on'); hintT = dur; }
function controlsHint() {
  if (TOUCH) return SET.mode === 'arcade' ? 'Left thumb flies · right thumb climbs / strafes · BOOST on the right' : 'ACRO: left = throttle + yaw · right = pitch + roll';
  if (IN.pad) return SET.mode === 'arcade' ? 'Left stick fly · right stick altitude / strafe · RT boost' : 'ACRO Mode 2 · RT boost';
  return SET.mode === 'arcade' ? 'W/S fly · A/D turn · Space/C up/down · Q/E strafe · SHIFT boost' : 'ACRO: W/S throttle · A/D yaw · arrows pitch/roll · SHIFT boost';
}
function controlsText() {
  const a = SET.mode === 'arcade';
  const kb = a ? '<b>Keys</b>: W/S forward/back · A/D turn · Space or ↑ climb · C or ↓ descend · Q/E or ←/→ strafe · Shift boost' : '<b>Keys (Mode 2)</b>: W/S throttle · A/D yaw · ↑/↓ pitch · ←/→ roll · Shift boost';
  const tp = a ? '<b>Touch</b>: left thumb = fly + turn, right thumb = altitude + strafe, BOOST button. Arcade assist holds gate height and helps you line up.' : '<b>Touch</b>: left = throttle + yaw (centre hovers), right = pitch + roll rates. No self-levelling.';
  const gp = a ? '<b>Pad</b>: left stick fly · right stick altitude/strafe · RT/A boost · Start pause · Y camera' : '<b>Pad</b>: Mode 2 sticks · RT/A boost · Start pause · Y camera';
  return `${kb}<br>${tp}<br>${gp}<br><b>Rules</b>: fly the gold gate next. Crash = back to your last gate, +${PENALTY.toFixed(1)}s. ${LAPS} laps. Medals: gold ${fmt(MEDALS.gold)} · silver ${fmt(MEDALS.silver)} · bronze ${fmt(MEDALS.bronze)}. R restart · Esc pause · V camera · M music.`;
}
// ---------------- minimap ----------------
const MM = (function () {
  const c = $('mm'), g = c.getContext('2d'), bg = document.createElement('canvas'); bg.width = c.width; bg.height = c.height; const b = bg.getContext('2d');
  const S = COURSE.samples; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const s of S) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); }
  const pad = 14, k = Math.min((c.width - pad * 2) / (x1 - x0), (c.height - pad * 2) / (z1 - z0)), ox = (c.width - (x1 - x0) * k) / 2, oz = (c.height - (z1 - z0) * k) / 2;
  const X = (x) => ox + (x - x0) * k, Z = (z) => oz + (z - z0) * k;
  b.fillStyle = '#3a3a40'; b.fillRect(0, 0, bg.width, bg.height);
  b.fillStyle = '#6a665e'; for (const p of PLOTS) b.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * k, (p.z1 - p.z0) * k);
  b.fillStyle = '#2f6f96'; b.fillRect(X(BASIN.x0), Z(BASIN.z0), (BASIN.x1 - BASIN.x0) * k, (BASIN.z1 - BASIN.z0) * k);
  b.fillStyle = '#a8705a'; for (const p of PIERS) b.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * k, (p.z1 - p.z0) * k);
  b.strokeStyle = '#14101f'; b.lineWidth = 7; b.lineJoin = 'round'; b.beginPath(); S.forEach((s, i) => (i ? b.lineTo(X(s.x), Z(s.z)) : b.moveTo(X(s.x), Z(s.z)))); b.closePath(); b.stroke();
  b.strokeStyle = '#e9e4ff'; b.lineWidth = 3; b.stroke();
  return { draw() {
    g.drawImage(bg, 0, 0);
    COURSE.gates.forEach((q, i) => { g.fillStyle = q.isNext ? '#ffd23c' : i === 0 ? '#ff3d6e' : '#14101f'; g.beginPath(); g.arc(X(q.c.x), Z(q.c.z), q.isNext ? 6 : 3, 0, TAU); g.fill(); });
    if (GH.mesh.visible) { g.fillStyle = '#bfe8ff'; g.beginPath(); g.arc(X(GH.pos.x), Z(GH.pos.z), 4, 0, TAU); g.fill(); }
    for (const r of RIV) if (r.mesh.visible) { g.fillStyle = DRONE_COLS[r.key].body; g.strokeStyle = '#14101f'; g.lineWidth = 2; g.beginPath(); g.arc(X(r.pos.x), Z(r.pos.z), 5, 0, TAU); g.fill(); g.stroke(); }
    const hx = X(P.pos.x), hz = Z(P.pos.z), a = P.yaw; g.fillStyle = '#9dff6b'; g.strokeStyle = '#14101f'; g.lineWidth = 3; g.beginPath();
    g.moveTo(hx + Math.sin(a) * 11, hz + Math.cos(a) * 11); g.lineTo(hx + Math.sin(a + 2.5) * 7, hz + Math.cos(a + 2.5) * 7); g.lineTo(hx + Math.sin(a - 2.5) * 7, hz + Math.cos(a - 2.5) * 7); g.closePath(); g.stroke(); g.fill();
  } };
})();
// ---------------- trail (LED streaks behind the hero; orange when boosting) ----------------
const TRAIL = (function () {
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return lowTex(c, 64); })();
  const pool = []; for (let i = 0; i < 48; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.visible = false; scene.add(s); pool.push({ s, t: 0, life: 0.4 }); }
  let k = 0, acc = 0; const cHero = new THREE.Color(DRONE_COLS.hero.led), cBoost = new THREE.Color('#ff9a3d');
  return { tick(dt, D, on) {
    acc += dt; if (on && acc > 0.016) { acc = 0; for (const side of [-1, 1]) { const f = pool[k++ % pool.length]; f.t = 0; f.life = D.boosting ? 0.45 : 0.28; f.s.visible = true;
      _v1.set(side * 0.62, 0.08, -0.45).applyQuaternion(D.q).add(D.pos); f.s.position.copy(_v1); f.s.material.color.copy(D.boosting ? cBoost : cHero); f.size = D.boosting ? 0.75 : 0.42; } }
    for (const f of pool) { if (!f.s.visible) continue; f.t += dt; const u = f.t / f.life; if (u >= 1) { f.s.visible = false; continue; } f.s.material.opacity = (1 - u) * 0.85; const sc = f.size * (1 - u * 0.6); f.s.scale.set(sc, sc, 1); }
  } };
})();
// ---------------- race tick ----------------
function crash(why) {
  R.st = 'crash'; R.crashT = 1.15; R.crashes++; R.pen += PENALTY; R.raceT += PENALTY; CAM.shake = 1; POST.uniforms.uHit.value = 1; AUD.play('crash');
  spawnSprite(FXT.star, P.pos, 3.2, 0.45, { depth: false }); spawnSprite(FXT.puff, P.pos, 2.6, 0.7, { kind: 'grow', vel: _v1.set(0, 1, 0) });
  for (let i = 0; i < 4; i++) spawnSprite(FXT.puff, _v1.copy(P.pos).add(_v2.set(rnd(-1, 1), rnd(-0.5, 1), rnd(-1, 1))), rnd(1, 1.8), rnd(0.5, 0.9), { kind: 'grow', vel: _v3.set(rnd(-3, 3), rnd(1, 3), rnd(-3, 3)) });
  spawnSprite(FXT.words[[0, 3, 4][R.crashes % 3]], _v1.copy(P.pos).add(_v2.set(0, 1.2, 0)), 2.2, 0.8, { kind: 'word', aspect: 2.6 });
  P.vel.multiplyScalar(-0.15); pop(`+${PENALTY.toFixed(1)}s`, 'CRASH · BACK TO GATE ' + (R.last || 'START'), '#ff3d6e', 1.2); $('pop').style.top = '58%';
}
function respawn() {
  const g = COURSE.gates[R.last]; const yaw = gateYaw(g);
  _v1.copy(g.c).addScaledVector(g.n, 1.5); if (HF.solidAt(_v1.x, _v1.y, _v1.z, 0.4)) _v1.copy(g.c);
  placeCraft(P, _v1, yaw); if (SET.mode === 'acro') { P.vel.copy(g.n).multiplyScalar(4); } P.inv = 1.6; R.st = 'race'; P.mesh.visible = CAM.mode !== 'fpv';
  R.sNear = -1;
}
function passGate(g, off) {
  const clean = off < g.r * 0.42; AUD.play(clean ? 'clean' : 'gate'); P.boost = Math.min(1, P.boost + (clean ? 0.2 : 0.12)); if (clean) R.cleanN++;
  spawnSprite(FXT.star, g.c, clean ? 3.4 : 2.4, 0.4, { depth: true });
  g.mat.emissive.setRGB(1, 1, 1); CAM.kick = Math.max(CAM.kick, clean ? 1 : 0.6);
  const lapT = R.raceT - R.lapT0; R.splits[g.i] = lapT; R.last = g.i;
  // split vs. the best lap at this gate
  if (R.best && R.best.splits && R.best.splits[g.i] && g.i !== 0) { const d = lapT - R.best.splits[g.i]; const e = $('delta'); e.textContent = (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(2); e.className = 'ink on ' + (d >= 0 ? 'up' : 'dn'); deltaT = 1.6; }
  if (g.i === 0) { // lap complete
    R.laps.push(lapT); R.lap++; R.lapT0 = R.raceT;
    const bestLap = Math.min(...R.laps), prevBest = R.best ? R.best.lap : Infinity;
    if (R.lap >= LAPS) { finish(); return; }
    AUD.play('lap'); pop(R.lap === LAPS - 1 ? 'FINAL LAP!' : 'LAP ' + (R.lap + 1), (lapT <= bestLap && lapT < prevBest ? 'BEST LAP ' : '') + fmt(lapT), R.lap === LAPS - 1 ? '#ff3d6e' : '#9dff6b', 1.5);
    R.lapSplits = R.lapSplits || []; R.lapSplits.push(R.splits.slice()); R.splits = [];
  } else if (clean) pop('CLEAN!', '', '#7fe8ff', 0.6);
  R.next = (g.i + 1) % NG; COURSE.setState(R.next); const ng = COURSE.gates[R.next]; if (ng.lm && ng.lm !== g.lm) lmk(ng.lm, 1.8);
}
function finish() {
  R.st = 'done'; R.fin = R.raceT; const place = 1 + RIV.filter((r) => r.mesh.visible && r.fin && r.fin < R.fin).length; R.place = place;
  const bestLap = Math.min(...R.laps); R.lapSplits = R.lapSplits || []; R.lapSplits.push(R.splits.slice());
  const li = R.laps.indexOf(bestLap); const prev = loadBest(); const newRec = !prev || R.fin < prev.total, newLap = !prev || bestLap < prev.lap;
  const rec = { total: newRec ? R.fin : prev.total, lap: newLap ? bestLap : prev.lap, splits: newLap ? R.lapSplits[li] : (prev && prev.splits) };
  try { localStorage.setItem(KEY() + '.best', JSON.stringify(rec)); if (newRec && R.rec.length) localStorage.setItem(KEY() + '.ghost', JSON.stringify({ dt: 0.1, f: R.rec })); } catch (e) { /* storage full / private mode */ }
  const medal = R.fin <= MEDALS.gold ? 'gold' : R.fin <= MEDALS.silver ? 'silver' : R.fin <= MEDALS.bronze ? 'bronze' : null;
  R.results = { place, total: R.fin, bestLap, laps: R.laps.slice(), crashes: R.crashes, pen: R.pen, medal, newRec, newLap, clean: R.cleanN, close: R.closeN, win: place === 1 && SET.rivals !== 'ghost' || (SET.rivals === 'ghost' && newRec) };
  AUD.play(R.results.win || medal ? 'finish' : 'lose'); pop(place === 1 ? 'WINNER!' : 'FINISH!', ord(place) + ' · ' + fmt(R.fin), place === 1 ? '#ffd23c' : '#e9e4ff', 2.2);
  setTimeout(() => showResults(R.results), 1600);
}
function dnf(why) {
  R.st = 'done'; R.fin = null; R.results = { place: 0, total: null, laps: R.laps.slice(), crashes: R.crashes, pen: R.pen, medal: null, dnf: why, win: false };
  AUD.play('lose'); pop(why, 'DID NOT FINISH', '#ff3d6e', 2); setTimeout(() => showResults(R.results), 1400);
}
function playerProgress() { // laps*N + samples since the start gate, capped at the next gate (no shortcut credit)
  const N = LINE.N; R.sNear = COURSE.nearestS(P.pos, R.sNear, 50); let d = (R.sNear - S0 + N) % N;
  const gn = COURSE.gates[R.next]; const cap = R.next === 0 ? N : (gn.s - S0 + N) % N; if (d > cap + 3 && cap > 0) d = Math.min(d, (COURSE.gates[R.last].s - S0 + N) % N); return R.lap * N + Math.min(d, cap + 2);
}
function botInput(dt) { // QA autopilot: fly the racing line with the real controls (arcade)
  const inp = { lx: 0, ly: 0, rx: 0, ry: 0, boost: false };
  if (BOTQ === 'idle') return inp;
  if (BOTQ === 'crash') { inp.ry = 1; inp.lx = R.raceT > 1.2 ? 0.0 : 0; inp.ly = -0.2; return inp; }
  const N = LINE.N; const k = COURSE.nearestS(P.pos, R.botS == null ? -1 : R.botS, 40); R.botS = k;
  const gnext = COURSE.gates[R.next]; const ahead = 4 + P.vel.length() * 0.3; let tgt = LINE.at(k + ahead).p;
  // if the next gate is closer than the look-ahead point, aim at the gate itself
  if (P.pos.distanceTo(gnext.c) < ahead + 2) tgt = gnext.c.clone().addScaledVector(gnext.n, 2);
  const want = Math.atan2(tgt.x - P.pos.x, tgt.z - P.pos.z), err = angTo(P.yaw, want);
  inp.lx = clamp(-err * 2.6, -1, 1); inp.ry = Math.abs(err) < 0.5 ? 1 : Math.abs(err) < 1.1 ? 0.55 : 0.2;
  inp.ly = clamp((tgt.y - P.pos.y) * 0.45, -1, 1);
  let vmin = 99; for (let o = 2; o < 34; o += 4) vmin = Math.min(vmin, LINE.at(k + o).v); const vk = vmin; if (P.vel.length() > vmin + 2.5) inp.ry = Math.min(inp.ry, 0.15);
  inp.boost = Math.abs(err) < 0.15 && vk > 23 && P.boost > 0.25; return inp;
}
let ghostI = 0;
function raceTick(dt) {
  R.t += dt;
  if (R.st === 'count') {
    R.count -= dt; const n = Math.ceil(R.count - 0.6);
    if (n !== R.lastCount) { R.lastCount = n; const e = $('count'); if (n > 0) { e.textContent = n; AUD.play('beep'); e.classList.remove('go'); } else { e.textContent = 'GO!'; e.classList.add('go'); AUD.play('go'); } e.style.transform = 'translate(-50%,-50%) scale(1.25)'; setTimeout(() => (e.style.transform = 'translate(-50%,-50%) scale(1)'), 90); }
    if (R.count <= 0.6) { R.st = 'race'; setTimeout(() => ($('count').style.display = 'none'), 600); }
    pollInput(SET.mode === 'acro'); // hover in place, props spinning
    P.thr = 0.35 + Math.abs(IN.ly) * 0.3; poseCraft(P, dt); for (const r of RIV) { r.thr = 0.4; poseCraft(r, dt); }
    return;
  }
  if (R.st === 'race' || R.st === 'crash') R.raceT += dt;
  // player
  if (R.st === 'race') {
    pollInput(SET.mode === 'acro'); let inp = IN; if (BOTQ) inp = botInput(dt);
    const g = COURSE.gates[R.next];
    if (SET.mode === 'acro') flyAcro(P, inp, dt); else flyArcade(P, inp, dt, g.c);
    if (P.boosting && !R.wasBoost) AUD.play('boost'); R.wasBoost = P.boosting;
    P.inv = Math.max(0, P.inv - dt);
    // gates (only the next one counts)
    const hit = COURSE.crossed(g, P.prev, P.pos); if (hit) passGate(g, hit.off);
    // collisions: real city geometry, ground, water, the course's ring tubes; bounds
    if (R.st === 'race') {
      let solid = P.inv <= 0 ? HF.solidAt(P.pos.x, P.pos.y, P.pos.z, 0.34) : null;
      if (!solid && P.inv <= 0) for (const q of COURSE.gates) { const d = _v1.copy(P.pos).sub(q.c); const ax = d.dot(q.n); if (Math.abs(ax) > 0.6) continue; const rad = Math.sqrt(Math.max(0, d.lengthSq() - ax * ax)); if (Math.abs(rad - q.r) < 0.42) { solid = 'ring'; break; } }
      if (P.pos.y > 70 || P.pos.x < HF.X0 + 2 || P.pos.x > HF.X1 - 2 || P.pos.z < HF.Z0 + 2 || P.pos.z > HF.Z1 - 2) solid = 'bounds';
      if (P.inv > 0) { const gY = isWater(P.pos.x, P.pos.z) ? WY : groundY(P.pos.x, P.pos.z); if (P.pos.y < gY + 0.4) { P.pos.y = gY + 0.4; P.vel.y = Math.max(0, P.vel.y); } }
      if (solid) crash(solid);
      else if (P.vel.length() > 13 && P.inv <= 0) { R.close -= dt; if (R.close <= 0 && HF.solidAt(P.pos.x, P.pos.y, P.pos.z, 1.35)) { R.close = 1.2; R.closeN++; P.boost = Math.min(1, P.boost + 0.08); AUD.play('close'); pop('CLOSE CALL!', '+BOOST', '#9dff6b', 0.7); CAM.shake = Math.max(CAM.shake, 0.25); } }
    }
    poseCraft(P, dt);
    P.mesh.visible = CAM.mode !== 'fpv' && !(P.inv > 0 && Math.floor(R.t * 12) % 2);
    // ghost recording
    R.recT += dt; if (R.recT >= 0.1) { R.recT -= 0.1; R.rec.push([+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2), +P.yaw.toFixed(3), +P.pitch.toFixed(2), +P.roll.toFixed(2)]); }
  } else if (R.st === 'crash') {
    R.crashT -= dt; P.vel.y -= 9.8 * dt; P.pos.addScaledVector(P.vel, dt); const gY = isWater(P.pos.x, P.pos.z) ? WY : groundY(P.pos.x, P.pos.z); if (P.pos.y < gY + 0.2) { P.pos.y = gY + 0.2; P.vel.set(0, 0, 0); }
    P.mesh.position.copy(P.pos); P.mesh.rotation.x += dt * 9; P.mesh.rotation.z += dt * 6; spinDrone(P.mesh, 0.05, dt);
    if (R.crashT <= 0) respawn();
  } else if (R.st === 'done') { P.vel.multiplyScalar(Math.exp(-2 * dt)); P.pos.addScaledVector(P.vel, dt); P.pos.y += dt * 0.6; P.thr = 0.4; poseCraft(P, dt); }
  // rivals: follow the line at their skill, light rubber band, tiny weave
  const pp = playerProgress(); R.prog = pp; let ahead = 0;
  for (const r of RIV) {
    if (!r.mesh.visible) continue;
    const prog = r.s - S0; const gap = prog - pp; const rub = R.st === 'done' ? 1 : clamp(1 - gap / 400, 0.9, 1.06);
    const a = LINE.at(r.s); const sp = a.v * r.skill * rub * (r.fin ? 0.5 : 1); if (R.st !== 'count') r.s += sp * dt;
    const b = LINE.at(r.s); const t = LINE.tan(b.i); _v1.set(-t.z, 0, t.x).normalize();
    r.prev.copy(r.pos); r.pos.copy(b.p).addScaledVector(_v1, r.lane * (0.6 + 0.4 * Math.sin(R.t * 0.7 + r.lane))).add(_v2.set(0, r.vlane * Math.sin(R.t * 0.9 + r.skill * 9), 0));
    const yaw = Math.atan2(t.x, t.z), dyaw = angTo(r.yaw, yaw); r.yaw = yaw; r.pitch = damp(r.pitch, clamp(sp / 30, 0, 1) * 0.4, 5, dt); r.roll = damp(r.roll, clamp(dyaw / Math.max(dt, 1e-3) * 0.12, -0.8, 0.8), 5, dt);
    r.q.setFromEuler(_e1.set(r.pitch, r.yaw, r.roll, 'YXZ')); r.thr = 0.8; poseCraft(r, dt);
    if (!r.fin && prog >= LAPS * LINE.N) r.fin = R.raceT;
    if (prog > pp) ahead++;
  }
  R.posN = R.st === 'done' && R.place ? R.place : 1 + ahead;
  // ghost playback
  if (R.ghost && GH.mesh.visible && R.ghost.f.length) { const f = R.ghost.f, u = R.raceT / R.ghost.dt, i = Math.min(f.length - 1, Math.floor(u)), j = Math.min(f.length - 1, i + 1), t = clamp(u - i, 0, 1);
    GH.pos.set(lerp(f[i][0], f[j][0], t), lerp(f[i][1], f[j][1], t), lerp(f[i][2], f[j][2], t)); GH.q.setFromEuler(_e1.set(f[i][4], f[j][3] + angTo(f[j][3], f[i][3]) * (1 - t), f[i][5], 'YXZ')); GH.thr = 0.8; poseCraft(GH, dt); }
  // fail states
  if (R.st === 'race' || R.st === 'crash') {
    if (R.raceT > LIMIT) dnf('TIME UP');
    else if (SET.rivals !== 'ghost' && RIV.every((r) => r.fin) && R.raceT - Math.max(...RIV.map((r) => r.fin)) > 25) dnf('RIVALS FINISHED');
  }
}
// ---------------- camera + juice ----------------
function camTick(dt) {
  const D = P, spd = D.vel.length();
  CAM.shake = Math.max(0, CAM.shake - dt * 2.2); CAM.kick = Math.max(0, CAM.kick - dt * 3);
  const fovT = (CAM.mode === 'fpv' ? 84 : 66) + clamp(spd, 0, 40) * 0.55 + (D.boosting ? 9 : 0) + CAM.kick * 4;
  CAM.fov = damp(CAM.fov, Math.min(fovT, 104), 5, dt); camera.fov = CAM.fov; camera.updateProjectionMatrix();
  if (CAM.mode === 'fpv' && R.st !== 'crash') {
    const up = SET.mode === 'acro' ? 0.42 : 0.3; // camera uptilt (FPV cams tilt up so a forward-leaning quad looks ahead)
    camera.position.copy(D.pos).add(_v1.set(0, 0.1, 0.3).applyQuaternion(D.q));
    _q1.setFromEuler(_e1.set(up, Math.PI, 0, 'YXZ')); camera.quaternion.copy(D.q).multiply(_q1);
  } else {
    const fw = _v1.set(Math.sin(D.yaw), 0, Math.cos(D.yaw)); const dist = 3.4 + clamp(spd, 0, 40) * 0.035 + (D.boosting ? 0.6 : 0), hgt = 1.15 + clamp(spd, 0, 40) * 0.01;
    const want = _v2.copy(D.pos).addScaledVector(fw, -dist).add(_v3.set(0, hgt, 0));
    // keep the camera out of buildings: walk from the drone towards the wanted spot, stop before the first solid sample
    const from = D.pos.clone().add(_v3.set(0, 0.4, 0)); let ok = want.clone();
    for (let i = 1; i <= 8; i++) { const p = from.clone().lerp(want, i / 8); if (HF.solidAt(p.x, p.y, p.z, 0.3)) { ok = from.clone().lerp(want, Math.max(0, (i - 1.5) / 8)); break; } }
    const k = R.st === 'crash' ? 2 : 9; CAM.pos.x = damp(CAM.pos.x, ok.x, k, dt); CAM.pos.y = damp(CAM.pos.y, ok.y, k, dt); CAM.pos.z = damp(CAM.pos.z, ok.z, k, dt);
    const lookT = _v2.copy(D.pos).addScaledVector(fw, 5 + spd * 0.12).add(_v3.set(0, 0.4, 0)); CAM.look.lerp(lookT, 1 - Math.exp(-10 * dt));
    camera.position.copy(CAM.pos); camera.up.set(0, 1, 0); camera.lookAt(CAM.look);
    CAM.roll = damp(CAM.roll, -D.roll * 0.4, 6, dt); camera.rotateZ(CAM.roll);
  }
  if (CAM.shake > 0) { const s = CAM.shake * CAM.shake * 0.35; camera.position.add(_v1.set(rnd(-s, s), rnd(-s, s), rnd(-s, s))); camera.rotateZ(rnd(-s, s) * 0.2); }
  // post: speed lines, boost tint, crash flash
  const U = POST.uniforms; U.uTime.value = R.t; U.uSpd.value = damp(U.uSpd.value, clamp((spd - 14) / 22, 0, 1) + (D.boosting ? 0.3 : 0), 6, dt);
  U.uBoost.value = damp(U.uBoost.value, D.boosting ? 0.35 : 0, 6, dt); U.uHit.value = Math.max(0, U.uHit.value - dt * 2.4);
  // sun / shadows follow the drone (snapped to texels)
  const tx = 68 / 2048, sx = Math.round(D.pos.x / tx) * tx, sz = Math.round(D.pos.z / tx) * tx;
  sun.target.position.set(sx, 0, sz); sun.position.set(sx + SUN_DIR.x * 90, SUN_DIR.y * 90, sz + SUN_DIR.z * 90);
  window.__sky.position.copy(camera.position);
}
// ---------------- HUD ----------------
const _pv = new THREE.Vector3(); let hudT = 0, nearT = 0;
function hudTick(dt) {
  if (popT > 0) { popT -= dt; if (popT <= 0) $('pop').classList.remove('on'); }
  if (lmkT > 0) { lmkT -= dt; if (lmkT <= 0) $('lmk').classList.remove('on'); }
  if (hintT > 0) { hintT -= dt; if (hintT <= 0) $('hint').classList.remove('on'); }
  if (deltaT > 0) { deltaT -= dt; if (deltaT <= 0) $('delta').classList.remove('on'); }
  nearT -= dt; if (nearT <= 0) { nearT = 0.3; NIGHTFX.near(P.pos.x, P.pos.z); }
  if (!document.body.classList.contains('racing')) return;
  $('time').textContent = fmt(R.raceT);
  hudT -= dt; if (hudT <= 0) { hudT = 0.1;
    $('lap').textContent = Math.min(R.lap + 1, LAPS) + '/' + LAPS; $('pos').textContent = SET.rivals === 'ghost' ? 'GHOST' : ord(R.posN);
    $('gateN').textContent = `GATE ${R.next === 0 ? NG : R.next}/${NG}`; $('spd').innerHTML = Math.round(P.vel.length() * 3.6) + '<small>KM/H</small>';
    $('boostFill').style.width = (P.boost * 100).toFixed(0) + '%'; $('boostBar').classList.toggle('hot', P.boosting); $('bBoost').classList.toggle('on', P.boosting);
    MM.draw(); }
  // next-gate pointer: on screen = distance tag under the gate; off screen = an edge arrow
  const g = COURSE.gates[R.next]; _pv.copy(g.c).project(camera); const W = innerWidth, H = innerHeight; const behind = _pv.z > 1;
  const dist = Math.round(P.pos.distanceTo(g.c)); const A = $('arrow'), Dd = $('arrowD');
  if (R.st === 'done' || R.st === 'count') { A.style.display = Dd.style.display = 'none'; return; }
  let x = (_pv.x * 0.5 + 0.5) * W, y = (-_pv.y * 0.5 + 0.5) * H; if (behind) { x = W - x; y = H - y; }
  const m = 46; const onS = !behind && x > m && x < W - m && y > m && y < H - m;
  if (onS) { A.style.display = 'none'; Dd.style.display = 'block'; Dd.style.left = x + 'px'; Dd.style.top = y + 'px'; Dd.textContent = dist + 'm'; }
  else { const cx = W / 2, cy = H / 2; let dx = x - cx, dy = y - cy; if (behind && Math.abs(dx) < 1 && Math.abs(dy) < 1) dy = 1; const s = Math.min((cx - m) / Math.abs(dx || 1e-3), (cy - m) / Math.abs(dy || 1e-3));
    const ax = cx + dx * s, ay = cy + dy * s; A.style.display = 'block'; A.style.left = ax + 'px'; A.style.top = ay + 'px'; A.style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
    Dd.style.display = 'block'; Dd.style.left = ax + 'px'; Dd.style.top = ay + 'px'; Dd.textContent = dist + 'm'; }
}
// ---------------- menus ----------------
function showScr(id) { for (const s of ['sMenu', 'sPause', 'sRes']) $(s).classList.toggle('on', s === id); }
function syncMenu() {
  document.querySelectorAll('.seg').forEach((sg) => sg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', SET[sg.dataset.k] === b.dataset.v)));
  const b = loadBest(); $('bestT').innerHTML = b ? `BEST (${SET.mode.toUpperCase()}): <b>${fmt(b.total)}</b> · BEST LAP ${fmt(b.lap)}` + (loadGhost() ? ' · ghost saved' : '') : `No ${SET.mode} times yet: set the first record.`;
  $('ctl').innerHTML = controlsText(); $('bMusic').textContent = 'MUSIC: ' + (AUD.musicOn ? 'ON' : 'OFF');
  $('stLl').textContent = SET.mode === 'arcade' ? 'FLY / TURN' : 'THROTTLE / YAW'; $('stRl').textContent = SET.mode === 'arcade' ? 'ALT / STRAFE' : 'PITCH / ROLL';
}
function toMenu() { R.st = 'menu'; document.body.classList.remove('racing', 'paused'); $('count').style.display = 'none'; syncMenu(); showScr('sMenu'); AUD.setMotor(0, 0, false); }
function pause(on) {
  if (on && !(R.st === 'race' || R.st === 'crash' || R.st === 'count')) return;
  R.paused = on; document.body.classList.toggle('paused', on); document.body.classList.toggle('racing', !on); showScr(on ? 'sPause' : null); if (on) { AUD.setMotor(0, 0, false); syncMenu(); } STICKS.reset();
}
function medalSVG(m) {
  const C = { gold: ['#ffd23c', '#b8860b'], silver: ['#e4e8f2', '#8a90a6'], bronze: ['#e09a5a', '#8a4a20'] }[m] || ['#b9b0d8', '#6a6478'];
  const label = m ? m.toUpperCase() : 'NO MEDAL';
  return `<path d="M30 0 L48 40 L38 44 L22 6 Z" fill="#ff3d6e" stroke="#14101f" stroke-width="3"/><path d="M80 0 L62 40 L72 44 L88 6 Z" fill="#1f7bff" stroke="#14101f" stroke-width="3"/>
    <circle cx="55" cy="66" r="38" fill="#14101f"/><circle cx="55" cy="66" r="33" fill="${C[0]}" stroke="${C[1]}" stroke-width="4"/>
    <path d="M55 42 l7 15 16 2 -12 11 3 16 -14 -8 -14 8 3 -16 -12 -11 16 -2 z" fill="${m ? '#fff' : '#e9e4ff'}" stroke="#14101f" stroke-width="3" stroke-linejoin="round"/>
    <text x="55" y="106" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="12" fill="#14101f">${label}</text>`;
}
function showResults(r) {
  document.body.classList.remove('racing'); $('arrow').style.display = $('arrowD').style.display = 'none';
  $('medal').innerHTML = medalSVG(r.medal);
  $('rTitle').textContent = r.dnf ? r.dnf : r.place === 1 ? 'YOU WIN!' : r.place <= 3 ? ord(r.place) + ' PLACE' : 'BEATEN — ' + ord(r.place);
  $('rTitle').style.color = r.dnf ? '#ff3d6e' : r.place === 1 ? '#ffd23c' : '#e9e4ff';
  const rows = [];
  if (r.total != null) rows.push(['TOTAL', fmt(r.total) + (r.newRec ? ' ★ NEW RECORD' : ''), r.newRec]);
  r.laps.forEach((t, i) => rows.push(['LAP ' + (i + 1), fmt(t) + (t === r.bestLap && r.newLap ? ' ★' : ''), t === r.bestLap && r.newLap]));
  rows.push(['CRASHES', r.crashes + (r.pen ? ` (+${r.pen.toFixed(1)}s)` : '')]);
  if (r.clean != null) rows.push(['CLEAN GATES / CLOSE CALLS', r.clean + ' / ' + r.close]);
  rows.push(['MEDALS', `${fmt(MEDALS.gold)} · ${fmt(MEDALS.silver)} · ${fmt(MEDALS.bronze)}`]);
  $('rRows').innerHTML = rows.map(([a, b, nb]) => `<div><span>${a}</span><span class="${nb ? 'nb' : ''}">${b}</span></div>`).join('');
  showScr('sRes'); AUD.setMotor(0, 0, false); window.__dr.resultsShown = (window.__dr.resultsShown || 0) + 1;
}
document.querySelectorAll('.seg').forEach((sg) => sg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; SET[sg.dataset.k] = b.dataset.v; saveSet(); AUD.init(); AUD.play('ui'); if (sg.dataset.k === 'cam') CAM.mode = SET.cam; syncMenu(); }));
const tapBtn = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); AUD.init(); AUD.play('ui'); fn(); });
tapBtn('bStart', resetRace); tapBtn('bRetry', resetRace); tapBtn('bRestart', resetRace); tapBtn('bMenu', toMenu); tapBtn('bQuit', toMenu); tapBtn('bResume', () => pause(false));
tapBtn('bMusic', () => { AUD.toggleMusic(); syncMenu(); });
$('pauseB').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pause(true); });
$('bCam').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleCam(); });
$('bBoost').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); IN.touchBoost = true; });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('bBoost').addEventListener(ev, () => { IN.touchBoost = false; });
function toggleCam() { CAM.mode = SET.cam = CAM.mode === 'fpv' ? 'chase' : 'fpv'; saveSet(); P.mesh.visible = CAM.mode !== 'fpv'; pop(CAM.mode === 'fpv' ? 'FPV CAM' : 'CHASE CAM', '', '#7fe8ff', 0.6); }
function keysTick() {
  const racing = R.st === 'race' || R.st === 'crash' || R.st === 'count';
  if (PRESS.has('escape') || PRESS.has('p')) { if (R.paused) pause(false); else if (racing) pause(true); }
  if (PRESS.has('r') && (racing || R.st === 'done')) resetRace();
  if (PRESS.has('v') && racing && !R.paused) toggleCam();
  if (PRESS.has('m')) { AUD.init(); AUD.toggleMusic(); syncMenu(); }
  if (PRESS.has('enter')) { if (R.st === 'menu') resetRace(); else if (R.st === 'done' && $('sRes').classList.contains('on')) resetRace(); else if (R.paused) pause(false); }
  PRESS.clear();
}
// ---------------- main loop ----------------
const FPS = { v: 0, n: 0, t: 0, min: 999, samples: [] };
let last = performance.now(), frames = 0, menuT = 0;
const CAPFPS = +(Q.get('cap') || 0); // capture mode (Shorts): no rAF; __dr.step(n) advances n frames of exactly 1/CAPFPS s
function frame(now) {
  if (!CAPFPS) requestAnimationFrame(frame);
  try {
    const real = Math.max(0, (now - last) / 1000), rdt = Math.min(0.05, real); last = now; frames++;
    FPS.n++; FPS.t += real; FPS.ms = real * 1000; if (FPS.t >= 1) { FPS.v = Math.round(FPS.n / FPS.t); FPS.samples.push(FPS.v); if (FPS.samples.length > 120) FPS.samples.shift(); FPS.n = 0; FPS.t = 0; }
    keysTick();
    if (R.st === 'menu') { // attract: orbit the harbour, rivals lapping
      menuT += rdt; const a = menuT * 0.06; camera.position.set(-6 + Math.sin(a) * 70, 34, 6 + Math.cos(a) * 52); camera.up.set(0, 1, 0); camera.lookAt(10, 4, 0); camera.fov = 60; camera.updateProjectionMatrix();
      for (const r of RIV) { r.s += LINE.at(r.s).v * r.skill * rdt * 0.8; const b = LINE.at(r.s); const t = LINE.tan(b.i); r.pos.copy(b.p).add(_v1.set(-t.z, 0, t.x).multiplyScalar(r.lane)); r.yaw = Math.atan2(t.x, t.z); r.q.setFromEuler(_e1.set(0.3, r.yaw, 0, 'YXZ')); r.thr = 0.8; poseCraft(r, rdt); r.mesh.visible = true; }
      P.mesh.visible = false; GH.mesh.visible = false; POST.uniforms.uSpd.value = 0; POST.uniforms.uTime.value = menuT;
      sun.target.position.set(0, 0, 0); sun.position.set(SUN_DIR.x * 90, SUN_DIR.y * 90, SUN_DIR.z * 90); window.__sky.position.copy(camera.position);
    } else if (!R.paused) { let T = rdt * SIM; while (T > 1e-6) { const h = Math.min(T, 1 / 50); raceTick(h); T -= h; } camTick(rdt * SIM); TRAIL.tick(rdt, P, (R.st === 'race') && P.vel.length() > 9 && CAM.mode !== 'fpv'); }
    if (!R.paused) { COURSE.tick(R.t); updateSprites(rdt); for (const g of COURSE.gates) if (!g.isNext) g.mat.emissive.multiplyScalar(Math.exp(-rdt * 6)); }
    const racing = (R.st === 'race' || R.st === 'count' || R.st === 'crash') && !R.paused; AUD.setMotor(P.thr, P.vel.length(), racing);
    updateCycle(rdt); hudTick(rdt);
    draw();
  } catch (err) { __celErr.n++; __celErr.last = String(err && err.stack || err); if (__celErr.n < 4) console.error(err); }
}
$('loading').style.display = 'none'; syncMenu();
if (BOTQ || Q.has('go')) setTimeout(resetRace, 200); else showScr('sMenu');
if (!CAPFPS) requestAnimationFrame(frame);
let capNow = performance.now();
window.__dr = { step: (n = 1) => { for (let i = 0; i < n; i++) { capNow += 1000 / CAPFPS; frame(capNow); } }, R, P, RIV, GH, CAM, FPS, LINE, MEDALS, REF, LIMIT, COURSE, HF, SET, IN, renderer, camera, scene, resetRace, pause, toMenu, get frames() { return frames; }, err: () => __celErr, THREE, check: (r) => COURSE.check(r) };
