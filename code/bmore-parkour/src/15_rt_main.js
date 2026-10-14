
// =====================================================================================================================================
// 15_rt_main: courses, camera, cel post (halftone + speed lines), HUD, input (keyboard / mouse / gamepad / Toad City arcade panel),
// game flow (menu -> countdown -> run -> fail / finish -> results), medals, test bot (?bot=1).
// =====================================================================================================================================
const COURSES = [
  { id: 'pratt', name: 'PRATT STREET', goal: 'HARBORPLACE', tod: 0.03, todName: 'DAY', blurb: 'Harbor East towers down to the Harborplace pavilions.',
    nodes: [[82, -92], [48, -92], [14, -92], [14, -58], [-20, -58], [-54, -58]], finish: [-42, -34], cps: [2, 4], bridges: ['gap', 'wall', 'pipe'], obst: ['vent', 'pipe', 'hurdle'] },
  { id: 'fedhill', name: 'FEDERAL HILL', goal: 'FEDERAL HILL PARK', tod: 0.24, todName: 'DUSK', blurb: 'South Baltimore rowhouse roofs, then the long zip to the hilltop.',
    nodes: [[-54, 92], [-20, 92], [14, 92], [48, 92], [48, 58]], finish: [5, 59], cps: [2, 3], bridges: ['wall', 'gap', 'pipe'], obst: ['hurdle', 'vent', 'pipe'] },
  { id: 'fells', name: 'FELLS POINT', goal: 'BROADWAY MARKET', tod: 0.5, todName: 'NIGHT', blurb: 'Off the Harbor East high-rises onto the old Fells Point rooftops.',
    nodes: [[116, -58], [116, -92], [150, -92], [184, -92], [184, -58]], finish: [167, -61], cps: [2, 4], bridges: ['pipe', 'gap', 'wall'], obst: ['vent', 'hurdle', 'pipe'] },
];
// medal times (s): calibrated from the test bot's clean runs (T/qa.js) - gold is a clean, fast line; bronze leaves room for a mistake
const MEDALS = { pratt: [23, 29, 36], fedhill: [24, 30, 37], fells: [23, 29, 36] }; // bot clean runs 2026-10-14: 19.8 / 20.4 / 20.0 s
for (const c of COURSES) c.medals = MEDALS[c.id];
const BUILT = COURSES.map((c) => RK.build(c));
for (const B of BUILT) { // checkpoint progress values + drone pace (a bronze-pace runner just stays ahead of it)
  for (const cp of B.cps) { let bi = 0, bd = 1e9; B.path.forEach((p, i) => { const d = Math.hypot(p.x - cp.x, p.z - cp.z); if (d < bd) { bd = d; bi = i; } }); cp.s = B.path[bi].s; }
  B.droneV = B.len / (B.C.medals[2] * 1.12);
}

// ---------------- the runner ----------------
const RUNNER = buildRunner(); scene.add(RUNNER.root);
RUNNER.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
const GAME = { st: 'menu', ci: 0, B: null, time: 0, cp: null, cpi: 0, ps: 0, pidx: 0, retries: 0, penalty: 0, cnt: 0, failT: 0, why: '', finT: 0, splits: [], shake: 0, fovKick: 0, paused: false, menuT: 0, stats: { vaults: 0, wallruns: 0, rolls: 0, zips: 0 } };

// ---------------- cel post: Toad City's post pass, extended with a halftone shadow screen, speed lines and a danger vignette ----------------
POST.uniforms.uSpeed = { value: 0 }; POST.uniforms.uTime = { value: 0 }; POST.uniforms.uVig = { value: 0 }; POST.uniforms.uTint = { value: new THREE.Color('#ff1f3a') }; POST.uniforms.uDpr = { value: 1 };
POST.fragmentShader = `uniform sampler2D tSrc; uniform vec2 uRes; uniform float uSpeed; uniform float uTime; uniform float uVig; uniform vec3 uTint; uniform float uDpr; varying vec2 vUv;
  vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  float h1(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  void main() {
    vec3 c = toSRGB(texture2D(tSrc, vUv).rgb);
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    // halftone: a 45-degree dot screen that only bites in the shadow band (comic-print shading)
    vec2 p = gl_FragCoord.xy / (4.2 * uDpr); vec2 q = vec2(p.x + p.y, p.x - p.y) * 0.7071; vec2 f = fract(q) - 0.5;
    float r = clamp((0.36 - l) * 1.25, 0.0, 0.42); float dotm = 1.0 - smoothstep(r - 0.07, r + 0.07, length(f));
    c *= 1.0 - dotm * 0.28;
    // speed lines: thin radial streaks that flicker in from the screen edge at speed
    vec2 cc = vUv - 0.5; cc.x *= uRes.x / uRes.y; float ang = atan(cc.y, cc.x); float rad = length(cc);
    float id = floor(ang * 38.0); float n = h1(id + floor(uTime * 18.0) * 7.0);
    float lane = smoothstep(0.42, 0.5, abs(fract(ang * 38.0) - 0.5)) ;
    float streak = step(0.72, n) * (1.0 - lane) * smoothstep(0.28 + 0.2 * h1(id), 0.75, rad) * uSpeed;
    c = mix(c, vec3(1.0), streak * 0.55);
    // vignette: always a soft ink edge; red when the drone is locking on
    float v = smoothstep(0.45, 0.95, rad);
    c = mix(c, c * 0.55, v * 0.55); c = mix(c, uTint, v * uVig * 0.8);
    gl_FragColor = vec4(c, 1.0); }`;
POST.needsUpdate = true;

// ---------------- renderer size + HD (Toad City's 07_main resize / setHD, HD only) ----------------
let DPR_OVR = 0;
function resize() {
  const w = VW(), h = VH(), a = w / h, dpr = DPR_OVR ? DPR_OVR : Q.has('dpr') ? +Q.get('dpr') : Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 1.25), lw = Math.round(w * dpr), lh = Math.round(h * dpr);
  LOW.w = lw; LOW.h = lh; renderer.setSize(lw, lh, false); RT.setSize(lw, lh); POST.uniforms.uRes.value.set(lw, lh); POST.uniforms.uDpr.value = dpr; SNAP.value.set(lw / 2, lh / 2);
  camera.aspect = a; CAM.baseFov = a < 1 ? clamp(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(36)) / a) * 180 / Math.PI, 66, 98) : 64; camera.updateProjectionMatrix();
}
const CAM = { yaw: 0, manual: 0, pitch: 0.2, dist: 3.6, fov: 64, baseFov: 64, roll: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), menuA: 0 };
applyQuality(true);
sun.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048); renderer.shadowMap.type = THREE.PCFSoftShadowMap; if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
scene.traverse((o) => { if (o.material && o.material.isMeshLambertMaterial) o.material.needsUpdate = true; });
addEventListener('resize', resize);

// ---------------- day / night (Toad City's 07_main updateCycle; each course pins its own time of day) ----------------
const CYC = { len: 600, pin: 0, t: 0, tod: 0, n: 0, lamps: 0 };
const FILL = new THREE.PointLight('#c8d0ff', 0, 12, 1.2); scene.add(FILL);
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
  CYC.t += dt; CYC.tod = CYC.pin !== null ? CYC.pin : (CYC.t / CYC.len) % 1;
  const n = CYC.n = 0.5 - 0.5 * Math.cos(CYC.tod * TAU);
  col3(PALK.top, n, SKY.U.top.value); col3(PALK.mid, n, SKY.U.mid.value); col3(PALK.hor, n, SKY.U.hor.value); SKY.U.uStars.value = sstep(0.62, 0.92, n);
  col3(PALK.fog, n, scene.fog.color); FOGC.copy(scene.fog.color); OUT_U.fogC.value.copy(scene.fog.color); OUT_U.fogN.value = scene.fog.near; OUT_U.fogF.value = scene.fog.far; renderer.setClearColor(scene.fog.color);
  scene.fog.near = num3(70, 55, 30, n); scene.fog.far = num3(240, 200, 150, n); // roofs see further than the street-level game
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
  FILL.intensity = on * 3.2; FILL.position.copy(camera.position); FILL.position.y += 1.2;
  const fl = on > 0.5 && Math.sin(CYC.t * 23) > 0.93 ? 0.55 : 1;
  NIGHTFX.neon.tint(on, on > 0.01 ? fl : 1); NIGHTFX.neon.light.intensity = on * 14 * fl;
}
camera.far = 420; camera.updateProjectionMatrix();

// ---------------- checkpoint gates + the finish arch (unlit glow, read from far away) ----------------
const GATES = [];
function gateMesh(fin) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.11, 8, 36), new THREE.MeshBasicMaterial({ color: fin ? '#ffd23c' : '#ff4a2e', fog: false })); ring.position.y = 1.6; g.add(ring);
  const ink = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.17, 8, 36), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, fog: false })); ink.position.y = 1.6; g.add(ink);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: fin ? '#ffe680' : '#ff6a3a', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.y = 31; g.add(beam);
  if (fin) { // a checkered banner strip under the ring
    const c = document.createElement('canvas'); c.width = 256; c.height = 32; const x = c.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#14101f' : '#ffffff'; x.fillRect(i * 16, j * 16, 16, 16); }
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.42), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide, fog: false })); flag.position.y = 3.35; g.add(flag);
  }
  g.userData = { ring, ink, beam }; g.visible = false; scene.add(g); return g;
}
for (let i = 0; i < 5; i++) GATES.push(gateMesh(false));
const FINGATE = gateMesh(true);

// ---------------- DOM helpers + HUD ----------------
const el = (id) => document.getElementById(id);
const fmt = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return (m ? m + ':' : '') + (m ? String(Math.floor(s)).padStart(2, '0') : Math.floor(s)) + '.' + String(Math.floor((s % 1) * 100)).padStart(2, '0'); };
const BEST = { get(id) { try { return JSON.parse(localStorage.getItem('tcr_best_' + id) || 'null'); } catch (e) { return null; } }, set(id, v) { try { localStorage.setItem('tcr_best_' + id, JSON.stringify(v)); } catch (e) {} } };
function medalOf(C, t) { return t <= C.medals[0] ? 'gold' : t <= C.medals[1] ? 'silver' : t <= C.medals[2] ? 'bronze' : null; }
let bannerT = 0;
function banner(txt, cls = '') { const b = el('banner'); b.textContent = txt; b.className = 'ui on ' + cls; bannerT = 1.1; }
function showScreen(id) { for (const s of ['menu', 'fail', 'res', 'pause']) el(s).classList.toggle('on', s === id); document.body.classList.toggle('inmenu', !!id); }
function buildMenu() {
  const list = el('clist'); list.innerHTML = '';
  COURSES.forEach((C, i) => {
    const b = BEST.get(C.id), m = b ? medalOf(C, b.t) : null;
    const card = document.createElement('button'); card.type = 'button'; card.className = 'card tod-' + C.todName.toLowerCase(); card.id = 'card' + i;
    card.innerHTML = `<span class="cn">${i + 1}</span><span class="ct"><b>${C.name}</b><i>→ ${C.goal} · ${C.todName}</i><em>${C.blurb}</em>
      <span class="ctm"><span class="md gold">${fmt(C.medals[0])}</span><span class="md silver">${fmt(C.medals[1])}</span><span class="md bronze">${fmt(C.medals[2])}</span></span></span>
      <span class="cb">${b ? `<span class="medal ${m || 'none'}"></span>BEST ${fmt(b.t)}` : 'NEW'}</span>`;
    card.addEventListener('click', () => { AUD.init(); AUD.play('ui'); startCourse(i); });
    card.addEventListener('pointerenter', () => { if (GAME.st === 'menu') previewCourse(i); });
    if (i === GAME.ci) card.classList.add('sel');
    list.appendChild(card);
  });
}
el('bmus').addEventListener('click', () => { AUD.init(); AUD.setMusic(!AUD.A.music); el('bmus').textContent = 'MUSIC: ' + (AUD.A.music ? 'ON' : 'OFF'); el('pmus').textContent = el('bmus').textContent; });
el('pmus').addEventListener('click', () => el('bmus').click());
el('bmus').textContent = el('pmus').textContent = 'MUSIC: ' + (AUD.A.music ? 'ON' : 'OFF');
el('fretry').addEventListener('click', () => retry(false)); el('frestart').addEventListener('click', () => retry(true)); el('fmenu').addEventListener('click', toMenu);
el('rretry').addEventListener('click', () => retry(true)); el('rnext').addEventListener('click', () => startCourse((GAME.ci + 1) % COURSES.length)); el('rmenu').addEventListener('click', toMenu);
el('presume').addEventListener('click', () => pause(false)); el('prestart').addEventListener('click', () => { pause(false); retry(true); }); el('pmenu').addEventListener('click', () => { pause(false); toMenu(); });
el('bpause').addEventListener('click', () => pause(!GAME.paused));
function pause(on) { if (on && !(GAME.st === 'run' || GAME.st === 'count')) return; GAME.paused = on; showScreen(on ? 'pause' : null); }
document.addEventListener('visibilitychange', () => { if (document.hidden && GAME.st === 'run') pause(true); });

// ---------------- input ----------------
const KEYS = new Set(); const IN = { mx: 0, my: 0, jumpP: false, jumpH: false, slideP: false, slideH: false, look: 0, dragX: 0 };
const PAD = { x: 0, y: 0, btn: {} }; let DEV = TOUCH ? 'touch' : 'kb';
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault(); if (e.repeat) return; KEYS.add(k); DEV = 'kb'; AUD.init();
  if (k === ' ' || k === 'k' || k === 'j') IN.jumpP = true; if (k === 'shift' || k === 'c' || k === 'control' || k === 'l') IN.slideP = true;
  if (k === 'escape' || k === 'p') { if (GAME.st === 'run' || GAME.st === 'count') pause(!GAME.paused); else if (GAME.st !== 'menu') toMenu(); }
  if (k === 'm') el('bmus').click();
  if (k === 'enter' || k === 'r') { if (GAME.st === 'failed') retry(k === 'r' ? false : false); else if (GAME.st === 'done') retry(true); else if (GAME.st === 'menu' && k === 'enter') startCourse(GAME.ci); else if (GAME.paused) pause(false); }
  if (GAME.st === 'menu' && ['1', '2', '3'].includes(k)) startCourse(+k - 1);
  if (GAME.st === 'menu' && ['w', 's', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'a', 'd'].includes(k)) { const d = ['w', 'arrowup', 'a', 'arrowleft'].includes(k) ? -1 : 1; menuSel((GAME.ci + d + COURSES.length) % COURSES.length); }
});
addEventListener('keyup', (e) => KEYS.delete(e.key.toLowerCase()));
addEventListener('blur', () => KEYS.clear());
// mouse / one-finger drag on the game view orbits the camera
{ let drag = null; const cv = el('gl');
  cv.addEventListener('pointerdown', (e) => { AUD.init(); drag = { id: e.pointerId, x: e.clientX }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x; drag.x = e.clientX; CAM.manual -= dx * 0.006; CAM.manualT = 1.4; });
  const up = (e) => { if (drag && e.pointerId === drag.id) drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); }
// the Toad City arcade panel (06d_panel.js layout + art): ball-top stick, SLIDE (red), JUMP (yellow), the two white camera buttons, and the
// big glowing context button (JUMP / LEAP / CLIMB / LET GO) on the ACT spot
const TOUCHS = { x: 0, y: 0, btn: {} };
const EMBED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const APANEL = (function () {
  const panel = el('apanel'), deck = el('adeck'); if (!panel || !deck) return null;
  const PW = 470, PH = 135, K = 1.18, TOP = 22; let S = 1;
  const BTN = { a: { x: 266, y: 73, el: el('acap-a') }, b: { x: 343, y: 69, el: el('acap-b') }, c: { x: 419, y: 70, el: el('aact'), big: true }, l: { x: 163, y: 33, el: el('acap-l') }, r: { x: 243, y: 33, el: el('acap-r') } };
  function layout() {
    if (!document.body.classList.contains('touch')) { document.documentElement.style.setProperty('--panel', '0px'); return; }
    S = Math.min(innerWidth / PW, (innerHeight * 0.3) / (PH + TOP), 2.0); deck.style.setProperty('--S', S + 'px');
    document.documentElement.style.setProperty('--panel', Math.round((PH + TOP) * S) + 'px');
  }
  if (TOUCH && !EMBED) document.body.classList.add('touch'); // inside Brad's Demos shell its own arcade panel sends keys: ours stays hidden
  layout(); addEventListener('resize', layout); addEventListener('orientationchange', () => setTimeout(() => { layout(); dispatchEvent(new Event('resize')); }, 250));
  const toDeck = (e) => { const r = deck.getBoundingClientRect(); return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S }; };
  function btnAt(p, sliding) {
    let best = null, bd = 1e9;
    for (const n of ['l', 'r']) { const b = BTN[n], d = Math.hypot(p.x - b.x, (p.y - b.y) * 1.3); if (d < 30 * K && d < bd) { bd = d; best = n; } }
    if (best) return best; if (p.x < 205 && !sliding) return null;
    for (const n of ['a', 'b', 'c']) { const b = BTN[n], d = Math.hypot(p.x - b.x, (p.y - b.y) * 1.2) - (b.big ? 8 : 0); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  const JR = 44 * K, JOY = { id: null, cx: 0, cy: 0 };
  function joyMove(x, y) {
    let dx = x - JOY.cx, dy = y - JOY.cy, d = Math.hypot(dx, dy);
    if (d > JR) { const over = (d - JR) / d; JOY.cx += dx * over; JOY.cy += dy * over; dx *= 1 - over; dy *= 1 - over; d = JR; }
    const k = d > JR * 0.18 ? 1 : 0; TOUCHS.x = (dx / JR) * k; TOUCHS.y = (dy / JR) * k;
    el('astick').style.transform = `rotate(${(TOUCHS.x * 22).toFixed(1)}deg) translateY(${(TOUCHS.y * 2).toFixed(1)}%) scaleY(${(1 - 0.12 * TOUCHS.y).toFixed(3)})`;
    const ring = el('aring'), r = deck.getBoundingClientRect(); ring.style.left = (JOY.cx - r.left) + 'px'; ring.style.top = (JOY.cy - r.top) + 'px'; ring.style.width = ring.style.height = JR * 2 + 'px';
  }
  const PTR = new Map(); const anyOn = (n) => { for (const v of PTR.values()) if (v === n) return true; return false; };
  function down(n) { BTN[n].el.classList.add('on'); TOUCHS.btn[n] = true; DEV = 'touch'; if (n === 'b' || n === 'c') IN.jumpP = true; if (n === 'a') IN.slideP = true; try { navigator.vibrate && navigator.vibrate(n === 'c' ? 14 : 8); } catch (_) {} }
  function up(n) { BTN[n].el.classList.remove('on'); TOUCHS.btn[n] = false; }
  function setBtn(id, n) { const prev = PTR.get(id); if (prev === n) return; PTR.set(id, n); if (prev && !anyOn(prev)) up(prev); if (n) down(n); }
  panel.addEventListener('pointerdown', (e) => {
    e.preventDefault(); AUD.init(); try { panel.setPointerCapture(e.pointerId); } catch (_) {}
    const b = btnAt(toDeck(e), false); if (b) { setBtn(e.pointerId, b); return; }
    if (JOY.id === null) { JOY.id = e.pointerId; JOY.cx = e.clientX; JOY.cy = e.clientY; el('aring').classList.add('on'); joyMove(e.clientX, e.clientY); DEV = 'touch'; }
  });
  panel.addEventListener('pointermove', (e) => { if (e.pointerId === JOY.id) { e.preventDefault(); joyMove(e.clientX, e.clientY); return; } if (PTR.has(e.pointerId)) { const b = btnAt(toDeck(e), true); if (b) setBtn(e.pointerId, b); } });
  const release = (e) => {
    if (e.pointerId === JOY.id) { JOY.id = null; TOUCHS.x = TOUCHS.y = 0; el('astick').style.transform = ''; el('aring').classList.remove('on'); }
    if (PTR.has(e.pointerId)) { const prev = PTR.get(e.pointerId); PTR.delete(e.pointerId); if (prev && !anyOn(prev)) up(prev); }
  };
  panel.addEventListener('pointerup', release); panel.addEventListener('pointercancel', release);
  let cur = '';
  function setAct(lab, slab) { const key = lab + slab; if (key === cur) return; cur = key; el('albl-c').textContent = lab; el('albl-a').textContent = slab; el('aact').classList.toggle('hot', lab !== 'JUMP'); }
  return { layout, setAct };
})();
function readPad() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g && g.connected) : null; if (!gp) return;
  const ax = (i) => (Math.abs(gp.axes[i] || 0) > 0.18 ? gp.axes[i] : 0), bt = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
  PAD.x = ax(0); PAD.y = ax(1); const now = { a: bt(0), b: bt(1), x: bt(2), lb: bt(4), rb: bt(5), st: bt(9) };
  if (now.a && !PAD.btn.a) { IN.jumpP = true; AUD.init(); if (GAME.st === 'failed') retry(false); else if (GAME.st === 'done') retry(true); else if (GAME.st === 'menu') startCourse(GAME.ci); }
  if ((now.b || now.x) && !(PAD.btn.b || PAD.btn.x)) IN.slideP = true; if (now.st && !PAD.btn.st) pause(!GAME.paused);
  IN.padJ = now.a; IN.padS = now.b || now.x; IN.padL = (now.lb ? 1 : 0) - (now.rb ? 1 : 0); if (gp.axes[2] !== undefined) IN.padL -= ax(2) * 1.4; PAD.btn = now; if (PAD.x || PAD.y || now.a) DEV = 'pad';
}
function readInput() {
  readPad();
  let mx = 0, my = 0;
  if (KEYS.has('a') || KEYS.has('arrowleft')) mx -= 1; if (KEYS.has('d') || KEYS.has('arrowright')) mx += 1;
  if (KEYS.has('w') || KEYS.has('arrowup')) my += 1; if (KEYS.has('s') || KEYS.has('arrowdown')) my -= 1;
  mx += TOUCHS.x + PAD.x; my += -TOUCHS.y - PAD.y;
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  IN.mx = mx; IN.my = my;
  IN.jumpH = KEYS.has(' ') || KEYS.has('k') || KEYS.has('j') || !!TOUCHS.btn.b || !!TOUCHS.btn.c || !!IN.padJ;
  IN.slideH = KEYS.has('shift') || KEYS.has('c') || KEYS.has('control') || !!TOUCHS.btn.a || !!IN.padS;
  IN.look = (KEYS.has('q') ? 1 : 0) - (KEYS.has('e') ? 1 : 0) + (TOUCHS.btn.l ? 1 : 0) - (TOUCHS.btn.r ? 1 : 0) + (IN.padL || 0);
}

// ---------------- course progress (projection onto the course line) ----------------
function progress(B, p) {
  const P = B.path; let bi = GAME.pidx, bd = 1e9; const i0 = Math.max(0, GAME.pidx - 25), i1 = Math.min(P.length - 1, GAME.pidx + 40);
  for (let i = i0; i <= i1; i++) { const q = P[i], d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2 + 0.25 * (q.y - p.y) ** 2; if (d < bd) { bd = d; bi = i; } }
  GAME.pidx = bi; return P[bi].s;
}
function nearestIdx(B, p) { let bi = 0, bd = 1e9; B.path.forEach((q, i) => { const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2 + 0.25 * (q.y - p.y) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; }
function pathAt(B, s) { const P = B.path; let lo = 0, hi = P.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s < s) lo = m; else hi = m; } const a = P[lo], b = P[hi], t = clamp((s - a.s) / Math.max(1e-3, b.s - a.s), 0, 1); return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }; }

// ---------------- game flow ----------------
function setCourse(i) {
  GAME.ci = i; GAME.B = BUILT[i]; const B = GAME.B; for (const b of BUILT) b.mesh.visible = b === B;
  RK.rebuild(B.sol); PL.P.course = B; CYC.pin = B.C.tod; updateCycle(0);
  GATES.forEach((g, k) => { const cp = B.cps[k + 1]; g.visible = !!cp; if (cp) { g.position.set(cp.x, cp.y, cp.z); g.rotation.y = cp.yaw; g.userData.done = false; } });
  FINGATE.visible = true; FINGATE.position.set(B.finGate.x, B.finGate.y, B.finGate.z); const z = B.zips[B.zips.length - 1]; FINGATE.rotation.y = Math.atan2(z.dir.x, z.dir.z);
  drawMapBg();
}
function menuSel(i) { previewCourse(i); AUD.play('ui'); document.querySelectorAll('.card').forEach((c, k) => c.classList.toggle('sel', k === i)); }
function previewCourse(i) { if (GAME.ci === i && GAME.B) return; setCourse(i); const s = GAME.B.cps[0]; PL.reset(s.x, s.y, s.z, s.yaw, 0); PL.set('idle'); CAM.menuA = s.yaw + 2.2; }
function startCourse(i) {
  setCourse(i); showScreen(null); const s = GAME.B.cps[0];
  PL.reset(s.x, s.y, s.z, s.yaw, 0); PL.P.safe = false; PL.P.fin = GAME.B.finGate; PL.set('idle'); GAME.pidx = 0; GAME.ps = 0;
  GAME.time = 0; GAME.cp = s; GAME.cpi = 0; GAME.cpTime = 0; GAME.retries = 0; GAME.penalty = 0; GAME.splits = []; GAME.stats = { vaults: 0, wallruns: 0, rolls: 0, zips: 0 };
  GATES.forEach((g) => (g.userData.done = false));
  DRN.reset(GAME.B, -12, GAME.B.droneV, 2.6);
  CAM.yaw = s.yaw + 1.6; CAM.manual = 0; GAME.st = 'count'; GAME.cnt = 0; GAME.cntN = -1; GAME.paused = false;
  el('hud').classList.add('on'); el('cname').textContent = GAME.B.C.name + ' → ' + GAME.B.C.goal; BOTS.reset();
}
function retry(full) {
  if (full || !GAME.cp) return startCourse(GAME.ci);
  const cp = GAME.cp; showScreen(null); PL.reset(cp.x, cp.y, cp.z, cp.yaw, 0); PL.P.safe = false; PL.P.fin = GAME.B.finGate; PL.set('idle');
  GAME.time = GAME.cpTime + 3; GAME.penalty += 3; GAME.retries++; GAME.pidx = nearestIdx(GAME.B, PL.P.pos); GAME.ps = progress(GAME.B, PL.P.pos);
  DRN.reset(GAME.B, cp.s - 16, GAME.B.droneV, 1.2);
  CAM.yaw = cp.yaw + 0.8; CAM.manual = 0; GAME.st = 'count'; GAME.cnt = 1.2; GAME.cntN = -1; BOTS.reset();
}
function toMenu() { GAME.st = 'menu'; GAME.paused = false; buildMenu(); showScreen('menu'); el('hud').classList.remove('on'); DRN.hide(); PL.set('idle'); const s = GAME.B.cps[0]; PL.reset(s.x, s.y, s.z, s.yaw, 0); PL.set('idle'); }
function fail(why) {
  if (GAME.st !== 'run') return; GAME.st = 'failing'; GAME.failT = 0; GAME.why = why;
  AUD.play(why === 'busted' ? 'busted' : 'fail');
}
function showFail() {
  GAME.st = 'failed'; const w = GAME.why;
  el('failT').textContent = w === 'busted' ? 'BUSTED!' : w === 'splat' ? 'SPLAT!' : 'YOU FELL!';
  el('failS').textContent = w === 'busted' ? 'FOXTROT caught you in the light. Keep your flow up: it flies the course behind you.' : w === 'splat' ? 'Too far to drop. Look for the zip line or crates.' : 'Off the roof and into the street.';
  el('fretry').textContent = GAME.cpi > 0 ? 'RETRY CHECKPOINT (+3s)' : 'RETRY';
  showScreen('fail');
}
function finish() {
  if (GAME.st !== 'run') return; GAME.st = 'finishing'; GAME.finT = 0; PL.P.safe = true; AUD.play('finish'); banner('FINISH!', 'big');
  GAME.splits.push(GAME.time);
}
function showResults() {
  GAME.st = 'done'; const C = GAME.B.C, t = GAME.time, m = medalOf(C, t), prev = BEST.get(C.id), isBest = !prev || t < prev.t;
  if (isBest) BEST.set(C.id, { t, splits: GAME.splits, retries: GAME.retries });
  el('rtime').textContent = fmt(t); el('rmedal').className = 'medal big ' + (m || 'none'); el('rmname').textContent = m ? m.toUpperCase() + ' MEDAL' : 'NO MEDAL';
  el('rbest').textContent = isBest ? (prev ? 'NEW BEST! (was ' + fmt(prev.t) + ')' : 'NEW BEST!') : 'BEST ' + fmt(prev.t);
  el('rtargets').innerHTML = `<span class="md gold">${fmt(C.medals[0])}</span><span class="md silver">${fmt(C.medals[1])}</span><span class="md bronze">${fmt(C.medals[2])}</span>`;
  el('rstats').textContent = `${GAME.stats.vaults} vaults · ${GAME.stats.wallruns} wall runs · ${GAME.stats.zips} zips · ${GAME.stats.rolls} rolls` + (GAME.retries ? ` · ${GAME.retries} retr${GAME.retries > 1 ? 'ies' : 'y'} (+${GAME.penalty}s)` : '');
  el('rcourse').textContent = C.name + ' → ' + C.goal; el('rnext').textContent = 'NEXT: ' + COURSES[(GAME.ci + 1) % COURSES.length].name;
  showScreen('res'); if (m) setTimeout(() => AUD.play('medal'), 350);
}

// ---------------- runner events -> juice + audio ----------------
PL.P.onEvent = (k) => {
  AUD.play(k); const p = PL.P.pos;
  if (k === 'jump' || k === 'walljump') GAME.fovKick = Math.max(GAME.fovKick, 4);
  if (k === 'land' || k === 'roll' || k === 'hardland') spawnSprite(FXT.puff, new THREE.Vector3(p.x, p.y + 0.3, p.z), k === 'hardland' ? 1.6 : 1.1, 0.45, { kind: 'grow', depth: true });
  if (k === 'hardland') { GAME.shake = 0.5; banner('OOF!', 'bad'); }
  if (k === 'roll') { GAME.stats.rolls++; banner('NICE ROLL!'); }
  if (k === 'vault') { GAME.stats.vaults++; }
  if (k === 'wallrun') { GAME.stats.wallruns++; banner('WALL RUN!'); }
  if (k === 'zip') { GAME.stats.zips++; GAME.fovKick = 7; }
  if (k === 'bump') GAME.shake = Math.max(GAME.shake, 0.18);
  if (k.startsWith('die:')) fail(k.slice(4));
};

// ---------------- camera: third person, low and close behind the runner; widens + streaks with speed; tilts on wall runs ----------------
const _cv = new THREE.Vector3(), _tv = new THREE.Vector3();
function camInside(x, y, z) { let hit = false; RK.boxesNear(x, z, (s) => { if (!hit && x > s.x0 - 0.15 && x < s.x1 + 0.15 && z > s.z0 - 0.15 && z < s.z1 + 0.15 && y > s.y0 - 0.15 && y < s.y1 + 0.2) hit = true; }); return hit; }
function updateCamera(dt) {
  const P = PL.P, sp = PL.hs(), sn = clamp((sp - 4) / 7, 0, 1);
  let face = P.yaw; if (P.st === 'wallrun' && P.wrDir) face = Math.atan2(P.wrDir.x, P.wrDir.z); if (P.st === 'zip' && P.zip) face = Math.atan2(P.zip.dir.x, P.zip.dir.z);
  if (P.st === 'climb' || P.st === 'ladder' || P.st === 'mantle') face = P.yaw;
  const follow = (sp > 1.2 || P.st === 'zip' || P.st === 'wallrun') ? 2.2 + sp * 0.32 : 0.6;
  if (GAME.st === 'run' || GAME.st === 'count') CAM.yaw += angTo(CAM.yaw, face) * Math.min(1, dt * follow);
  CAM.yaw += IN.look * dt * 2.4;
  CAM.manualT = (CAM.manualT || 0) - dt; if (CAM.manualT <= 0 && sp > 2) CAM.manual = damp(CAM.manual, 0, 1.6, dt);
  const yaw = CAM.yaw + CAM.manual;
  const fall = P.st === 'air' && P.vel.y < -4 ? clamp(-P.vel.y / 20, 0, 0.35) : 0;
  const dist = (P.st === 'zip' ? 4.6 : 3.5 + sn * 0.9) * (camera.aspect < 1 ? 1.12 : 1), hgt = 1.55 + sn * 0.15 + fall * 2.2 + (P.st === 'climb' || P.st === 'ladder' ? 0.6 : 0);
  _tv.set(P.pos.x, P.pos.y + (P.st === 'slide' || P.st === 'roll' ? 0.9 : 1.35), P.pos.z);
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  let cx = _tv.x - fx * dist, cy = _tv.y + hgt - 1.1, cz = _tv.z - fz * dist;
  // pull in if a wall is in the way
  let k = 1; for (let i = 1; i <= 8; i++) { const t = i / 8, x = lerp(_tv.x, cx, t), y = lerp(_tv.y + 0.2, cy, t), z = lerp(_tv.z, cz, t); if (camInside(x, y, z)) { k = Math.max(0.25, (i - 1) / 8); break; } }
  cx = lerp(_tv.x, cx, k); cy = lerp(_tv.y + 0.2, cy, k); cz = lerp(_tv.z, cz, k);
  const r = P.st === 'zip' ? 9 : 14;
  CAM.pos.x = damp(CAM.pos.x, cx, r, dt); CAM.pos.y = damp(CAM.pos.y, cy, P.st === 'run' ? 9 : 6, dt); CAM.pos.z = damp(CAM.pos.z, cz, r, dt);
  if (Math.abs(P.stepY) > 0.001) { CAM.pos.y += 0; P.stepY = 0; }
  const ahead = 1.4 + sn * 2.4; CAM.look.set(_tv.x + fx * ahead, _tv.y + 0.15 - fall * 1.8, _tv.z + fz * ahead);
  camera.position.copy(CAM.pos);
  if (GAME.shake > 0) { GAME.shake -= dt; const a = GAME.shake * 0.35; camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a; }
  camera.lookAt(CAM.look);
  CAM.roll = damp(CAM.roll, P.st === 'wallrun' ? -P.wrSide * 0.14 : 0, 6, dt); camera.rotateZ(CAM.roll);
  GAME.fovKick = damp(GAME.fovKick, 0, 3, dt);
  const fov = CAM.baseFov + sn * 12 + (P.st === 'zip' ? 8 : 0) + GAME.fovKick; camera.fov = damp(camera.fov, fov, 5, dt); camera.updateProjectionMatrix();
}
function menuCamera(dt) { // a slow orbit round the runner on the start roof, the course's city behind
  const P = PL.P; CAM.menuA += dt * 0.07; const r = camera.aspect < 1 ? 7.5 : 6.2;
  camera.position.set(P.pos.x - Math.sin(CAM.menuA) * r, P.pos.y + 2.6, P.pos.z - Math.cos(CAM.menuA) * r); camera.lookAt(P.pos.x, P.pos.y + 1.3, P.pos.z);
  camera.fov = CAM.baseFov + 4; camera.updateProjectionMatrix();
}

// ---------------- runner rig pose ----------------
function poseRunner(dt) {
  const P = PL.P, J = RUNNER, sp = PL.hs(); let p, rate = 16, snap = false;
  switch (P.st) {
    case 'idle': p = GAME.st === 'count' ? RPOSE.ready(GAME.cnt) : RPOSE.idle(P.t); rate = 8; break;
    case 'run': p = RPOSE.run(P.ph, sp); rate = 18; break;
    case 'air': p = P.airT > 0.8 && P.vel.y < -9 ? RPOSE.fall(P.t) : RPOSE.jump(P.vel.y); rate = 12; break;
    case 'wallrun': p = RPOSE.wallrun(P.ph, P.wrSide); rate = 16; break;
    case 'climb': p = RPOSE.climb(P.t); break;
    case 'ladder': p = RPOSE.ladder(P.t); break;
    case 'mantle': p = P.man && !P.man.quick && P.t < P.man.dur * 0.35 ? RPOSE.hang(P.t) : RPOSE.mantle(P.man ? P.t / P.man.dur : 1); rate = 20; break;
    case 'vault': p = RPOSE.vault(P.man ? P.t / P.man.dur : 1); rate = 24; break;
    case 'slide': p = RPOSE.slide(P.t); rate = 22; break;
    case 'roll': p = RPOSE.roll(P.t / 0.48); snap = true; rate = 24; break;
    case 'stun': p = RPOSE.land(P.t / 0.5); rate = 18; break;
    case 'zip': p = RPOSE.zip(P.t); rate = 14; break;
    case 'busted': p = RPOSE.busted(P.t); rate = 8; break;
    case 'fin': p = RPOSE.cheer(P.t); rate = 10; break;
    default: p = RPOSE.idle(P.t);
  }
  applyPose(J, p, rate, dt, snap);
  J.root.position.copy(P.pos); J.root.rotation.y = P.yaw;
}

// ---------------- HUD ----------------
const HUDS = { lmk: null, lmkT: 0, nearT: 0, mapT: 0, ctx: '' };
const MAP = (function () { // Toad City's minimap (07_main), plus the course line
  const c = el('mmap'); if (!c) return null; const W = 150, H = 92, k = W / (WB.x1 - WB.x0 + 20);
  c.width = W * 2; c.height = H * 2; const g = c.getContext('2d'); const bg = document.createElement('canvas'); bg.width = c.width; bg.height = c.height;
  const X = (x) => (x - WB.x0 + 10) * k * 2, Z = (z) => (z - WB.z0 + 6) * k * 2;
  return { c, g, bg, X, Z, k };
})();
function drawMapBg() {
  if (!MAP) return; const { bg, X, Z, k } = MAP, b = bg.getContext('2d');
  b.fillStyle = '#3a3a40'; b.fillRect(0, 0, bg.width, bg.height);
  b.fillStyle = '#6a665e'; for (const p of PLOTS) b.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * k * 2, (p.z1 - p.z0) * k * 2);
  b.fillStyle = '#2f6f96'; b.fillRect(X(BASIN.x0), Z(BASIN.z0), (BASIN.x1 - BASIN.x0) * k * 2, (BASIN.z1 - BASIN.z0) * k * 2);
  b.fillStyle = '#a8705a'; for (const p of PIERS) b.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * k * 2, (p.z1 - p.z0) * k * 2);
  b.fillStyle = '#ffe08a'; for (const L of LANDMARKS) { b.beginPath(); b.arc(X(L.x), Z(L.z), 3.2, 0, TAU); b.fill(); }
  const B = GAME.B; if (!B) return; b.strokeStyle = '#ff4a2e'; b.lineWidth = 3; b.beginPath(); B.path.forEach((p, i) => (i ? b.lineTo(X(p.x), Z(p.z)) : b.moveTo(X(p.x), Z(p.z)))); b.stroke();
  b.fillStyle = '#ffd23c'; b.beginPath(); b.arc(X(B.F.x), Z(B.F.z), 5, 0, TAU); b.fill(); b.strokeStyle = '#14101f'; b.lineWidth = 2; b.stroke();
}
function hud(dt) {
  const P = PL.P, B = GAME.B;
  el('tm').textContent = fmt(GAME.time);
  el('flowf').style.width = (P.mom * 100).toFixed(0) + '%'; el('flow').classList.toggle('max', P.mom > 0.98);
  const gap = DRN.D.gap, dk = clamp(1 - (gap - 4) / 30, 0, 1);
  el('dronef').style.width = (dk * 100).toFixed(0) + '%'; el('dronem').textContent = DRN.D.wait > 0 && GAME.st === 'run' ? 'LAUNCHING' : gap > 60 ? 'FAR' : Math.max(0, gap).toFixed(0) + ' M';
  el('drone').classList.toggle('hot', DRN.D.lock > 0.02); el('dronel').classList.toggle('hot', DRN.D.lock > 0.02); el('lockf').style.width = (DRN.D.lock * 100).toFixed(0) + '%';
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) el('banner').classList.remove('on'); }
  HUDS.nearT -= dt; if (HUDS.nearT <= 0) { HUDS.nearT = 0.3; NIGHTFX.near(P.pos.x, P.pos.z);
    let best = null, bd = 1e9; for (const L of LANDMARKS) { const d = Math.hypot(L.x - P.pos.x, L.z - P.pos.z); if (d < L.r + 22 && d < bd) { bd = d; best = L; } }
    if (best !== HUDS.lmk) { HUDS.lmk = best; if (best) { el('lmk').textContent = best.name; el('lmk').classList.add('on'); HUDS.lmkT = 3; } } }
  if (HUDS.lmkT > 0) { HUDS.lmkT -= dt; if (HUDS.lmkT <= 0) el('lmk').classList.remove('on'); }
  if (APANEL) APANEL.setAct(PL.context(), P.st === 'air' ? 'ROLL' : 'SLIDE');
  if (MAP) { HUDS.mapT -= dt; if (HUDS.mapT <= 0) { HUDS.mapT = 0.1; const { g, bg, X, Z } = MAP; g.drawImage(bg, 0, 0);
    if (DRN.D.on) { g.fillStyle = (DRN.D.t * 4) % 2 < 1 ? '#ff3d6e' : '#2a6aff'; g.fillRect(X(DRN.D.pos.x) - 3, Z(DRN.D.pos.z) - 3, 6, 6); }
    for (const cp of B.cps) { g.fillStyle = '#fff'; g.fillRect(X(cp.x) - 2, Z(cp.z) - 2, 4, 4); }
    const hx = X(P.pos.x), hz = Z(P.pos.z), a = P.yaw; g.fillStyle = '#9dff6b'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath();
    g.moveTo(hx + Math.sin(a) * 9, hz + Math.cos(a) * 9); g.lineTo(hx + Math.sin(a + 2.5) * 6, hz + Math.cos(a + 2.5) * 6); g.lineTo(hx + Math.sin(a - 2.5) * 6, hz + Math.cos(a - 2.5) * 6); g.closePath(); g.fill(); g.stroke(); } }
}

// ---------------- test bot (?bot=1): runs the course from the generator's action marks ----------------
const BOTQ = Q.has('bot');
const BOTS = { ei: 0, hold: 0, side: 0, sideT: 0, log: [], reset() { this.ei = 0; this.sps = 0; this.stall = 0; this.hold = 0; this.side = 0; this.sideT = 0; const ev = GAME.B ? GAME.B.events : []; while (this.ei < ev.length && ev[this.ei].s < GAME.ps - 0.5) this.ei++; } };
function botInput(dt) {
  const B = GAME.B, P = PL.P; const ev = B.events; IN.jumpP = false; IN.slideP = false;
  const ahead = pathAt(B, GAME.ps + (P.st === 'zip' ? 6 : 3.0)); let dx = ahead.x - P.pos.x, dz = ahead.z - P.pos.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
  if (BOTS.sideT > 0) { BOTS.sideT -= dt; const wx = -dz, wz = dx; dx += wx * BOTS.side * 0.55; dz += wz * BOTS.side * 0.55; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
  while (BOTS.ei < ev.length && GAME.ps >= ev[BOTS.ei].s) {
    const e = ev[BOTS.ei++]; BOTS.log.push(e.kind + '@' + e.s.toFixed(0));
    if (e.kind === 'jump') { IN.jumpP = true; BOTS.hold = 0.3; }
    else if (e.kind === 'slide') IN.slideP = true;
    else if (e.kind === 'wall') { IN.jumpP = true; BOTS.hold = 0.3; BOTS.side = e.side; BOTS.sideT = 0.45; }
  }
  if (P.st === 'air' && P.vel.y < -7 && P.peak - P.pos.y > 3.2) IN.slideP = true; // roll every big drop
  // unstick: no progress along the course for a beat while on the ground -> jump (what a player would do)
  if (GAME.st === 'run' && (P.st === 'run' || P.st === 'idle')) { BOTS.stall = (BOTS.stall || 0) + dt; if (GAME.ps > (BOTS.sps || 0) + 0.6) { BOTS.sps = GAME.ps; BOTS.stall = 0; } } else { BOTS.stall = 0; BOTS.sps = GAME.ps; }
  if (BOTS.stall > 0.7) { IN.jumpP = true; BOTS.hold = 0.35; BOTS.stall = 0; BOTS.sps = GAME.ps; BOTS.log.push('unstick@' + GAME.ps.toFixed(0)); }
  BOTS.hold -= dt; IN.jumpH = BOTS.hold > 0;
  // stick input relative to the camera
  const f = [Math.sin(CAM.yaw + CAM.manual), Math.cos(CAM.yaw + CAM.manual)], r = [-f[1], f[0]];
  IN.mx = dx * r[0] + dz * r[1]; IN.my = dx * f[0] + dz * f[1]; IN.slideH = false; IN.look = 0;
}

// ---------------- main loop ----------------
const FPS = { v: 60, n: 0, t: 0, min: 999, samples: [] };
let last = performance.now(), frames = 0;
const SIM = +(Q.get('sim') || 0), RSKIP = Math.max(1, +(Q.get('rskip') || 1)); // tests: ?sim=N fixed 1/60 steps per frame, ?rskip=N draw every Nth frame
function frame(now) {
  requestAnimationFrame(frame);
  try {
    let rdt = Math.min(0.05, (now - last) / 1000); last = now; frames++;
    FPS.n++; FPS.t += rdt; if (FPS.t > 1) { FPS.v = Math.round(FPS.n / FPS.t); if (GAME.st === 'run') { FPS.samples.push(FPS.v); FPS.min = Math.min(FPS.min, FPS.v); } FPS.n = 0; FPS.t = 0; }
    if (GAME.paused) { draw(); return; }
    const steps = SIM || 1;
    for (let k = 0; k < steps; k++) {
      const dt = SIM ? 1 / 60 : rdt; step(dt, k === steps - 1);
    }
    POST.uniforms.uTime.value = now / 1000;
    if (frames % RSKIP === 0 || GAME.st !== 'run') draw();
  } catch (err) { __celErr.n++; __celErr.last = String(err && err.stack || err); if (__celErr.n < 4) console.error(err); }
}
function step(dt, render) {
  const P = PL.P, B = GAME.B;
  if (GAME.st === 'menu') { GAME.menuT += dt; P.t += dt; poseRunner(dt); menuCamera(dt); updateCycle(dt); followSun(); if (render) hudMenu(); IN.jumpP = IN.slideP = false; return; }
  if (BOTQ && !BOTS.off && (GAME.st === 'run' || GAME.st === 'count')) botInput(dt); else readInput();
  // stick -> world wish direction (camera relative), with a gentle line assist toward the course on touch
  const f = [Math.sin(CAM.yaw + CAM.manual), Math.cos(CAM.yaw + CAM.manual)], r = [-f[1], f[0]];
  let wx = r[0] * IN.mx + f[0] * IN.my, wz = r[1] * IN.mx + f[1] * IN.my;
  if (GAME.st === 'run' && !BOTQ && (DEV === 'touch' || DEV === 'pad')) { const a = pathAt(B, GAME.ps + 4), dx = a.x - P.pos.x, dz = a.z - P.pos.z, dl = Math.hypot(dx, dz), wl = Math.hypot(wx, wz);
    if (dl > 0.5 && wl > 0.3 && (wx * dx + wz * dz) / (dl * wl) > 0.7) { const k = 0.45; wx = lerp(wx, dx / dl * wl, k); wz = lerp(wz, dz / dl * wl, k); } }
  let sdt = dt;
  if (GAME.st === 'count') {
    GAME.cnt += dt; const n = Math.floor(GAME.cnt / 0.6); if (n !== GAME.cntN) { GAME.cntN = n; const lab = ['3', '2', '1', 'GO!'][Math.min(3, n)]; if (n <= 3) { el('cnt').textContent = lab; el('cnt').className = 'on' + (n === 3 ? ' go' : ''); AUD.play(n === 3 ? 'go' : 'count'); } }
    if (GAME.cnt >= 1.8) { GAME.st = 'run'; setTimeout(() => el('cnt').classList.remove('on'), 500); }
    PL.P.t += dt; IN.jumpP = IN.slideP = false;
  } else if (GAME.st === 'run' || GAME.st === 'finishing') {
    PL.update(dt, { wx, wz, jumpP: IN.jumpP, jumpH: IN.jumpH, slideP: IN.slideP, slideH: IN.slideH });
    if (GAME.st === 'run') GAME.time += dt;
    GAME.ps = progress(B, P.pos);
    // checkpoints
    B.cps.forEach((cp, k) => { if (k === 0 || k <= GAME.cpi) return; if (Math.hypot(cp.x - P.pos.x, cp.z - P.pos.z) < 3.2 && Math.abs(P.pos.y - cp.y) < 3 && GAME.st === 'run') {
      GAME.cpi = k; GAME.cp = cp; GAME.cpTime = GAME.time; const g = GATES[k - 1]; g.userData.done = true; AUD.play('cp');
      const best = BEST.get(B.C.id), bs = best && best.splits ? best.splits[GAME.splits.length] : null; GAME.splits.push(GAME.time);
      banner('CHECKPOINT ' + fmt(GAME.time) + (bs ? (GAME.time <= bs ? '  -' : '  +') + Math.abs(GAME.time - bs).toFixed(2) : ''), bs && GAME.time > bs ? 'bad' : 'good'); } });
    // the finish gate on the last zip line
    if (GAME.st === 'run' && ((P.st === 'zip' && P.zip && P.zip.fin && P.zipT >= B.finGate.zipT) || Math.hypot(B.finGate.x - P.pos.x, B.finGate.z - P.pos.z) < 2.2 && Math.abs(B.finGate.y - P.pos.y) < 3)) finish();
    // FOXTROT
    DRN.update(dt, GAME.ps, P.pos, GAME.st === 'run');
    if (GAME.st === 'run') { const D = DRN.D, close = D.gap < 5 && D.wait <= 0; const prev = D.lock; D.lock = clamp(D.lock + (close ? dt / 1.5 : -dt / 2), 0, 1);
      if (prev === 0 && D.lock > 0) { AUD.play('siren'); banner('SPOTTED!', 'bad'); }
      if (D.lock >= 1) { PL.set('busted'); P.vel.set(0, 0, 0); fail('busted'); } }
    if (GAME.st === 'finishing') { GAME.finT += dt; if (P.st === 'run' || P.st === 'idle') { PL.set('fin'); P.vel.set(0, 0, 0); } if (GAME.finT > 3.2) showResults(); }
  } else if (GAME.st === 'failing') {
    GAME.failT += dt; sdt = dt * (GAME.why === 'busted' ? 1 : 0.4);
    if (GAME.why !== 'busted') { P.vel.y -= 21 * sdt; P.pos.addScaledVector(P.vel, sdt); P.t += sdt; PL.set('air'); P.airT = 2; }
    else P.t += dt;
    DRN.update(dt, GAME.ps, P.pos, false);
    if (GAME.failT > (GAME.why === 'busted' ? 1.4 : 1.0)) showFail();
  } else if (GAME.st === 'done' || GAME.st === 'failed') { P.t += dt; DRN.update(dt, GAME.ps, P.pos, false); }
  IN.jumpP = IN.slideP = false;
  // gates spin + glow
  for (const g of GATES.concat([FINGATE])) { if (!g.visible) continue; g.userData.ring.rotation.y += dt * 1.6; g.userData.ink.rotation.y = g.userData.ring.rotation.y; g.userData.beam.material.opacity = g.userData.done ? 0.04 : 0.16 + 0.05 * Math.sin(CYC.t * 4); if (g.userData.done) g.userData.ring.material.color.set('#9dff6b'); else if (g !== FINGATE) g.userData.ring.material.color.set('#ff4a2e'); }
  poseRunner(sdt);
  if (GAME.st === 'failing' && GAME.why !== 'busted') { camera.lookAt(P.pos.x, P.pos.y + 1, P.pos.z); } else if (GAME.st === 'done') { CAM.menuA += dt * 0.25; const r = 6; camera.position.set(P.pos.x - Math.sin(CAM.menuA) * r, P.pos.y + 2.2, P.pos.z - Math.cos(CAM.menuA) * r); camera.lookAt(P.pos.x, P.pos.y + 1.2, P.pos.z); }
  else updateCamera(dt);
  updateCycle(dt); followSun(); updateSprites(dt);
  const sp = PL.hs();
  POST.uniforms.uSpeed.value = damp(POST.uniforms.uSpeed.value, P.st === 'zip' ? 0.9 : clamp((sp - 8.2) / 3, 0, 1), 6, dt);
  POST.uniforms.uVig.value = damp(POST.uniforms.uVig.value, DRN.D.on ? DRN.D.lock * 0.9 + (DRN.D.gap < 10 ? 0.12 : 0) : 0, 5, dt);
  AUD.tick(sp, P.st === 'zip' ? P.zipSp : 0, DRN.D.on ? Math.hypot(DRN.D.pos.x - P.pos.x, DRN.D.pos.y - P.pos.y, DRN.D.pos.z - P.pos.z) : 99, DRN.D.lock);
  if (render) hud(dt);
}
function followSun() { const P = PL.P, tx = SHR * 2 / (TOUCH ? 1024 : 2048), sx = Math.round(P.pos.x / tx) * tx, sz = Math.round(P.pos.z / tx) * tx;
  sun.target.position.set(sx, P.pos.y, sz); sun.position.set(sx + SUN_DIR.x * 70, P.pos.y + SUN_DIR.y * 70, sz + SUN_DIR.z * 70); window.__sky.position.copy(camera.position); }
function hudMenu() { if (bannerT > 0) { bannerT -= 1 / 60; if (bannerT <= 0) el('banner').classList.remove('on'); } }

// ---------------- boot ----------------
resize(); buildMenu(); previewCourse(0); showScreen('menu');
if (Q.has('course')) { const i = clamp(+Q.get('course') || 0, 0, COURSES.length - 1); if (Q.has('go') || BOTQ) setTimeout(() => startCourse(i), 200); else previewCourse(i); }
el('boot').classList.add('gone'); setTimeout(() => el('boot').remove(), 700);
requestAnimationFrame(frame);
window.__rt = { setDpr(v) { DPR_OVR = v; resize(); }, GAME, PL, DRN, RK, BUILT, COURSES, FPS, CAM, BOTS, IN, renderer, camera, scene, startCourse, retry, toMenu, finish, get frames() { return frames; }, setCourse, pathAt, fmt };
window.__cel = { get frames() { return frames; }, FPS, renderer };
