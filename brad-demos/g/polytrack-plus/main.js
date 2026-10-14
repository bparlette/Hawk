// main.js — PolyTrack Remake · Hark Edition (fan remake). three.js r160 (local copy), 60 Hz fixed-step sim.
import * as THREE from './three.module.min.js';
import { buildTrack, MAIN_PIECES, PIECES, BUILDER_PIECES, pieceCells, S, H } from './track.js';
import { RaycastCar } from './carphys.js';
import { Race, Autopilot } from './race.js';
import * as G from './gfx.js';
import { Sfx } from './audio.js';

const Q = new URLSearchParams(location.search);
const STEP = 1 / 60, TAU = Math.PI * 2;
const MEDALS = [ // index 0 = author
  { name: 'AUTHOR', t: 27.65, col: '#36e0c8' }, { name: 'GOLD', t: 29.0, col: '#ffd23c' }, { name: 'SILVER', t: 32.0, col: '#d9dcea' }, { name: 'BRONZE', t: 37.0, col: '#e08a4f' },
];
const AP_ATTRACT = {}; // safe autopilot (attract mode)
const LS = 'ptp.v1.';
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const fmt = (t) => { if (t == null || !isFinite(t)) return '-:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(LS + k)); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (_) {} };
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------------- renderer / scene ----------------
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR = Q.has('dpr') ? +Q.get('dpr') : Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 1.25);
renderer.setPixelRatio(DPR); G.DOT.value = 4.6 * DPR;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(G.FOG.c, G.FOG.n.value, G.FOG.f.value);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 2000);
scene.add(new THREE.HemisphereLight('#eaf6ff', '#8f86b8', 1.25));
const sun = new THREE.DirectionalLight('#fff4dc', 2.3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 140 }); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.05;
const SUNDIR = new THREE.Vector3(0.45, 0.55, -0.7).normalize(); scene.add(sun, sun.target);
const sky = G.makeSky(); scene.add(sky);
const OL_TRACK = G.outlineMat(0.0026), OL_CAR = G.outlineMat(0.0038), OL_SCN = G.outlineMat(0.0022);
const OL_GHOST = G.outlineMat(0.003, '#1b6f8f', { transparent: true }); OL_GHOST.uniforms.uA.value = 0.35;

// ---------------- track (meshes rebuilt when the track changes) ----------------
const TRACK_MAT = G.toonMat(); const SEA_Y = -9;
let TR = null, race = null, ap = null, trackKey = 'main', trackGroup = null, gateViz = [];
const MAIN = MAIN_PIECES();
function disposeGroup(g) { if (!g) return; g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.userData.owned) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); scene.remove(g); }
function loadTrack(pieces, key) {
  disposeGroup(trackGroup); gateViz = [];
  TR = buildTrack(pieces, { seaY: SEA_Y }); trackKey = key;
  trackGroup = new THREE.Group();
  const g = G.soupGeometry(TR.soup); G.addOdir(g);
  const m = new THREE.Mesh(g, TRACK_MAT); m.receiveShadow = true; m.castShadow = true; trackGroup.add(m);
  trackGroup.add(new THREE.Mesh(g, OL_TRACK));
  for (const gt of TR.gates) {
    const left = new THREE.Vector3(-gt.s[0], -gt.s[1], -gt.s[2]), up = new THREE.Vector3(...gt.u), f = new THREE.Vector3(...gt.f);
    const basis = new THREE.Matrix4().makeBasis(left, up, f).setPosition(gt.p[0] + gt.u[0] * gt.ph, gt.p[1] + gt.u[1] * gt.ph, gt.p[2] + gt.u[2] * gt.ph);
    const col = gt.kind === 'cp' ? '#ffd23c' : gt.kind === 'start' ? '#36e0c8' : '#fff6ea';
    const bm = G.toonMat({ vertexColors: false, color: col }); bm.userData.owned = true;
    const bg = G.addOdir(G.prep(new THREE.BoxGeometry(gt.hw * 2 + 0.9, 0.9, 0.9)));
    const beam = new THREE.Mesh(bg, bm); beam.applyMatrix4(basis); beam.castShadow = true; trackGroup.add(beam);
    const ol = new THREE.Mesh(bg, OL_TRACK); ol.applyMatrix4(basis); trackGroup.add(ol);
    const txt = gt.kind === 'cp' ? 'CHECKPOINT' : gt.kind === 'finish' ? 'FINISH' : (TR.gates.some((q) => q.kind === 'finish') ? 'START' : 'START · FINISH');
    const tex = G.labelTex(txt, gt.kind === 'cp' ? '#ffd23c' : gt.kind === 'start' ? '#36e0c8' : '#fff6ea', '#fff6ea');
    const lm = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }); lm.userData.owned = true;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(gt.hw * 1.7, gt.hw * 1.7 * 96 / 512), lm);
    lab.applyMatrix4(new THREE.Matrix4().makeBasis(left.clone().negate(), up, f.clone().negate()).setPosition(gt.p[0] + gt.u[0] * (gt.ph + 1.1), gt.p[1] + gt.u[1] * (gt.ph + 1.1), gt.p[2] + gt.u[2] * (gt.ph + 1.1)));
    trackGroup.add(lab);
    gateViz.push({ gt, mat: bm, lab, labMat: lm });
  }
  scene.add(trackGroup);
  race = new Race(THREE, TR); ap = new Autopilot(THREE, TR, AP_ATTRACT);
  computeMinimap();
  loadGhost();
}

// ---------------- scenery (built once around the main track) ----------------
const SEA_MAT = G.toonMat({ vertexColors: false, color: '#2ec7c9' });
const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000, 1, 1).rotateX(-Math.PI / 2), SEA_MAT); sea.position.y = SEA_Y; sea.receiveShadow = true; scene.add(sea);
(function scenery() {
  const tmp = buildTrack(MAIN, { seaY: SEA_Y }); const b = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 };
  for (const L of tmp.line) { b.x0 = Math.min(b.x0, L.p[0]); b.x1 = Math.max(b.x1, L.p[0]); b.z0 = Math.min(b.z0, L.p[2]); b.z1 = Math.max(b.z1, L.p[2]); }
  const { g, og } = G.makeScenery(b, SEA_Y, rnd);
  const m = new THREE.Mesh(g, G.toonMat()); m.receiveShadow = false; scene.add(m); scene.add(new THREE.Mesh(og, OL_SCN));
  const cg = G.makeClouds(b, rnd); scene.add(new THREE.Mesh(cg, G.toonMat({ fog: false }))); const co = new THREE.Mesh(cg, G.outlineMat(0.0016)); scene.add(co);
  // foam rings under every support pillar
  const ring = new THREE.RingGeometry(1.1, 1.9, 10).rotateX(-Math.PI / 2), pos = [];
  for (let i = 0; i < tmp.soup.colTris.length; i += 9) { /* noop: pillars are in the soup; foam placed from line instead */ break; }
  for (let i = 0; i < tmp.line.length; i += 6) { const L = tmp.line[i]; if (L.p[1] > 2 && L.u[1] > 0.8) pos.push(L.p[0], L.p[2]); }
  const im = new THREE.InstancedMesh(ring, new THREE.MeshBasicMaterial({ color: '#e9fbff', transparent: true, opacity: 0.85 }), pos.length / 2); const mm = new THREE.Matrix4();
  for (let i = 0; i < pos.length / 2; i++) { mm.makeTranslation(pos[i * 2], SEA_Y + 0.05, pos[i * 2 + 1]); im.setMatrixAt(i, mm); } scene.add(im);
})();

// ---------------- car + ghost ----------------
const carGeo = G.buildCarGeo();
const car = new RaycastCar(THREE);
const carMat = G.toonMat(); const carView = new G.CarView(carGeo, { mat: carMat, outline: OL_CAR }); scene.add(carView.root);
const ghostMat = G.toonMat({ vertexColors: false, color: '#7fe3ff', transparent: true, opacity: 0.42, depthWrite: false });
const ghostView = new G.CarView(carGeo, { mat: ghostMat, ghost: true, outline: OL_GHOST }); ghostView.root.visible = false; scene.add(ghostView.root);
const prevPos = new THREE.Vector3(), prevQuat = new THREE.Quaternion(), rPos = new THREE.Vector3(), rQuat = new THREE.Quaternion();

// ---------------- particles ----------------
const sparks = new G.Particles(260, { add: true, drag: 2, grav: -18 }); scene.add(sparks.mesh);
const smoke = new G.Particles(220, { drag: 2.6, grav: 2.5, grow: 1.1, ink: false }); scene.add(smoke.mesh);
const confetti = new G.Particles(240, { drag: 1.2, grav: -6, ink: true }); scene.add(confetti.mesh);

// ---------------- game state ----------------
const sfx = new Sfx();
const st = {
  mode: 'attract', // attract | ready | race | finish | build
  paused: false, testing: false, auto: Q.has('auto'), t: 0, raceT: 0, finalT: null, timeScale: 1, slowT: 0,
  shake: 0, fovKick: 0, banner: null, sub: null, splitTxt: null, stuck: 0, upside: 0, respawnHint: 0, falling: 0, startedAt: 0, demoT: 0,
};
const queue = []; const later = (dt, fn) => queue.push({ t: st.t + dt, fn });
const events = [];
let ghostRec = [], ghostBest = null; // ghostBest: {t, splits, f: Float32Array}
function ghostKeyName() { return 'ghost.' + trackKey; }
function loadGhost() {
  ghostBest = null; const g = lsGet(ghostKeyName());
  if (g && g.d) { try { const bin = atob(g.d), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); ghostBest = { t: g.t, splits: g.splits || [], f: new Float32Array(u.buffer) }; } catch (_) { ghostBest = null; } }
}
function saveGhost(t, splits, frames) {
  const f = new Float32Array(frames), u = new Uint8Array(f.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  lsSet(ghostKeyName(), { t, splits, d: btoa(s) }); ghostBest = { t, splits, f };
}
function bestTime() { return ghostBest ? ghostBest.t : null; }

function placeAtStart() {
  const s = race.spawn(); car.reset(s.p, s.q); prevPos.copy(car.pos); prevQuat.copy(car.quat);
  race.reset(); st.raceT = 0; st.finalT = null; ghostRec = []; st.stuck = st.upside = st.falling = 0; ap.reset();
  for (const v of gateViz) setGateDone(v, false);
}
function setGateDone(v, done) {
  if (v.gt.kind !== 'cp') return; v.mat.color.set(done ? '#5ee87a' : '#ffd23c');
}
function restart() { // instant restart: everything that belongs to a run is reset here
  queue.length = 0; st.timeScale = 1; st.slowT = 0; st.banner = st.sub = st.splitTxt = null; st.shake = 0;
  sparks.clear(); smoke.clear(); confetti.clear(); hideCards(); placeAtStart();
  st.mode = 'ready'; st.paused = false; ghostView.root.visible = false; sfx.layer = 0;
  camSnap = true; showTouch(true); setBanner('GAS TO START', 99, true);
}
function respawn(manual) {
  if (st.mode !== 'race' && st.mode !== 'attract') { if (st.mode === 'ready' && manual) restart(); return; }
  if (!race.lastCp) { if (st.mode === 'attract') { placeAtStart(); return; } restart(); return; }
  const r = race.respawnPose(); car.reset(r.p, r.q, r.f.clone().multiplyScalar(Math.max(8, race.lastCpVel)));
  prevPos.copy(car.pos); prevQuat.copy(car.quat); st.stuck = st.upside = st.falling = 0; camSnap = true; ap.i = 0;
  burst(car.pos, 26, 0.6, 1, 0.9); if (st.mode !== 'attract') sfx.whoosh(); st.shake = Math.max(st.shake, 0.25);
}
function startRace() {
  st.mode = 'race'; st.raceT = 0; st.startedAt = st.t; setBanner('GO!', 0.9); sfx.go(); sfx.startMusic();
  ghostView.root.visible = !!ghostBest;
}
function finishRace(t) {
  st.mode = 'finish'; st.finalT = t; st.timeScale = 0.3; st.slowT = 1.1; sfx.stopMusic();
  const prev = bestTime(), isBest = prev == null || t < prev;
  let medal = -1; if (!st.testing) for (let i = 0; i < MEDALS.length; i++) if (t <= MEDALS[i].t) { medal = i; break; }
  const prevMedal = lsGet('medal.' + trackKey); if (!st.testing && medal >= 0 && (prevMedal == null || medal < prevMedal)) lsSet('medal.' + trackKey, medal);
  if (isBest) saveGhost(t, race.splits.slice(), ghostRec);
  sfx.finish(medal); setBanner('FINISH!', 1.4); st.shake = 0.5;
  for (let i = 0; i < 120; i++) { const a = rnd() * TAU, sp = 6 + rnd() * 10; const c = [[1, 0.82, 0.24], [1, 0.23, 0.19], [0.21, 0.88, 0.78], [1, 1, 1]][i & 3];
    confetti.emit(car.pos.x, car.pos.y + 3, car.pos.z, Math.cos(a) * sp, 6 + rnd() * 10, Math.sin(a) * sp, 2.2 + rnd(), 0.35, c[0], c[1], c[2]); }
  later(0.6, () => showResult(t, prev, isBest, medal));
}

// ---------------- UI cards ----------------
function medalsHTML(best) {
  return MEDALS.map((m, i) => `<div class="medal${best != null && best <= m.t ? ' got' : ''}"><i style="background:${m.col}"></i>${m.name}<b>${fmt(m.t)}</b></div>`).join('');
}
function hideCards() { for (const id of ['title', 'result', 'pause']) $(id).classList.remove('show'); }
function showTitle() {
  hideCards(); const b = lsGet('ghost.main'); const bt = b && b.t;
  $('tMedals').innerHTML = medalsHTML(bt); $('tBest').textContent = bt ? 'YOUR BEST  ' + fmt(bt) + '  · ghost saved' : 'No time yet — the autopilot is showing you the line.';
  $('tHint').innerHTML = isTouch ? 'Drag left side to steer · GAS / BRAKE on the right · in the air, gas/brake pitch the car<br>⚑ last checkpoint · ⟲ restart' : 'Gas W / ↑ · brake/reverse S / ↓ · steer A D / ← → · air-pitch with gas/brake<br>R restart · Enter last checkpoint · Esc pause · M mute';
  $('title').classList.add('show');
}
function showResult(t, prev, isBest, medal) {
  if (st.mode !== 'finish') return;
  hideCards(); $('rTime').textContent = fmt(t);
  $('rTag').textContent = st.testing ? 'TEST DRIVE FINISHED' : medal >= 0 ? MEDALS[medal].name + ' MEDAL!' : 'FINISH!';
  $('rTag').style.background = medal >= 0 && !st.testing ? MEDALS[medal].col : '#14101f'; $('rTag').style.color = medal >= 0 && !st.testing ? '#14101f' : '#ffd23c';
  const d = $('rDelta');
  if (prev == null) { d.textContent = 'First finish — ghost saved'; d.className = 'delta good'; }
  else { const dd = t - prev; d.textContent = (dd <= 0 ? 'NEW BEST  ' : 'BEST ' + fmt(prev) + '  ') + (dd <= 0 ? '−' : '+') + Math.abs(dd).toFixed(2); d.className = 'delta ' + (dd <= 0 ? 'good' : 'bad'); }
  $('rMedals').innerHTML = st.testing ? '' : medalsHTML(Math.min(t, prev ?? 1e9));
  let next = ''; if (!st.testing) { const bb = Math.min(t, prev ?? 1e9); for (let i = 0; i < MEDALS.length; i++) if (bb > MEDALS[i].t) { next = 'Next: ' + MEDALS[i].name + ' ' + fmt(MEDALS[i].t) + ' (' + (bb - MEDALS[i].t).toFixed(2) + 's to find)'; } if (bb <= MEDALS[0].t) next = 'Author time beaten. Respect.'; }
  $('rBest').textContent = next; $('bBack').innerHTML = st.testing ? 'BUILDER <kbd>ESC</kbd>' : 'MENU <kbd>ESC</kbd>';
  $('result').classList.add('show'); showTouch(false);
}
function pause(on) {
  if (st.mode === 'build' || st.mode === 'attract') return;
  st.paused = on; if (on) { $('pause').classList.add('show'); sfx.suspend(); keys.clear(); resetTouch(); } else { $('pause').classList.remove('show'); sfx.resume(); }
}
function toMenu() {
  hideCards(); st.paused = false; sfx.resume(); sfx.stopMusic(); st.testing = false; bui(false);
  if (trackKey !== 'main') loadTrack(MAIN, 'main');
  queue.length = 0; st.timeScale = 1; placeAtStart(); st.mode = 'attract'; st.demoT = 0; ghostView.root.visible = false; showTouch(false); st.banner = null; showTitle(); camSnap = true;
}
function handover() { // first input of the attract mode: the player takes over from the start line
  if (st.mode !== 'attract') return; sfx.init(); hideCards(); restart();
}

// ---------------- input ----------------
const keys = new Set(); const touch = { steer: 0, gas: false, brake: false, sid: null, ox: 0, oy: 0 };
let pad = null;
const inp = { throttle: 0, brake: 0, steer: 0 };
function readInput() {
  const k = (c) => keys.has(c);
  let th = k('KeyW') || k('ArrowUp') || touch.gas ? 1 : 0, br = k('KeyS') || k('ArrowDown') || touch.brake ? 1 : 0;
  let sx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + touch.steer;
  pad = null; const gps = navigator.getGamepads ? navigator.getGamepads() : []; for (const gp of gps) if (gp && gp.connected) { pad = gp; break; }
  if (pad) { const ax = pad.axes[0] || 0; if (Math.abs(ax) > 0.12) sx += ax; th = Math.max(th, pad.buttons[7] ? pad.buttons[7].value : 0, pad.buttons[0] && pad.buttons[0].pressed ? 1 : 0); br = Math.max(br, pad.buttons[6] ? pad.buttons[6].value : 0, pad.buttons[1] && pad.buttons[1].pressed ? 1 : 0); }
  inp.throttle = th; inp.brake = br; inp.steer = clamp(sx, -1, 1); return inp;
}
let padPrev = [];
function pollPadButtons() {
  if (!pad) return; const b = pad.buttons.map((x) => x.pressed);
  const edge = (i) => b[i] && !padPrev[i];
  if (st.mode === 'attract' && (edge(0) || edge(9) || edge(7))) handover();
  else if (edge(3)) restart(); else if (edge(2)) respawn(true); else if (edge(9)) pause(!st.paused);
  padPrev = b;
}
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace']);
addEventListener('keydown', (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  sfx.init();
  if (st.mode === 'build') { buildKey(e); return; }
  if (e.repeat) { keys.add(e.code); return; }
  if (st.mode === 'attract') {
    if (e.code === 'KeyB') { openBuilder(); return; } if (e.code === 'KeyM') { toggleMute(); return; }
    handover(); keys.add(e.code); return;
  }
  keys.add(e.code);
  if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'Escape' || e.code === 'KeyP') { if (st.mode === 'finish') { if (st.testing) backToBuilder(); else toMenu(); } else pause(!st.paused); }
  else if (st.paused) { if (e.code === 'KeyR') { pause(false); restart(); } }
  else if (e.code === 'KeyR') restart();
  else if (e.code === 'Enter' || e.code === 'Backspace') { if (st.mode === 'finish') restart(); else respawn(true); }
  else if (e.code === 'KeyB' && (st.mode === 'finish' || st.testing)) { if (st.testing) backToBuilder(); else openBuilder(); }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); resetTouch(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (st.mode === 'race' || st.mode === 'ready') pause(true); else sfx.suspend(); keys.clear(); resetTouch(); } else if (!st.paused) sfx.resume(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// first tap anywhere on the scene during attract = race
canvas.addEventListener('pointerdown', (e) => { sfx.init(); if (e.pointerType === 'touch') enableTouch(); if (st.mode === 'attract') handover(); });
function enableTouch() { if (!document.body.classList.contains('touch')) document.body.classList.add('touch'); }
if (isTouch) enableTouch();
function showTouch(on) { $('touch').classList.toggle('on', on && !window.__DEMO_EMBED_HIDE_TOUCH); }
function resetTouch() { touch.steer = 0; touch.gas = touch.brake = false; touch.sid = null; $('stickBase').style.display = 'none'; $('gas').classList.remove('on'); $('brake').classList.remove('on'); }
(function touchControls() {
  const zone = $('stickZone'), base = $('stickBase'), knob = $('stickKnob'), R = 56;
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault(); sfx.init(); if (touch.sid != null) return; touch.sid = e.pointerId; zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect(); touch.ox = clamp(e.clientX - r.left, 70, r.width - 70); touch.oy = clamp(e.clientY - r.top, 70, r.height - 70);
    base.style.left = touch.ox + 'px'; base.style.top = touch.oy + 'px'; base.style.display = 'block'; move(e); $('stickHint').style.display = 'none';
  });
  const move = (e) => {
    if (e.pointerId !== touch.sid) return; const r = zone.getBoundingClientRect();
    let dx = e.clientX - r.left - touch.ox, dy = e.clientY - r.top - touch.oy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; const v = dx / R; touch.steer = Math.abs(v) < 0.08 ? 0 : clamp((Math.abs(v) - 0.08) / 0.92, 0, 1) * Math.sign(v);
  };
  const up = (e) => { if (e.pointerId !== touch.sid) return; touch.sid = null; touch.steer = 0; base.style.display = 'none'; knob.style.transform = ''; };
  zone.addEventListener('pointermove', move); zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up); zone.addEventListener('lostpointercapture', up);
  for (const [id, key] of [['gas', 'gas'], ['brake', 'brake']]) {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); sfx.init(); el.setPointerCapture(e.pointerId); touch[key] = true; el.classList.add('on'); });
    const off = () => { touch[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  }
})();
function toggleMute() { sfx.setMuted(!sfx.muted); $('bMute').classList.toggle('off', sfx.muted); $('mwave').style.display = sfx.muted ? 'none' : ''; lsSet('muted', sfx.muted); }
if (lsGet('muted')) { sfx.muted = true; $('bMute').classList.add('off'); $('mwave').style.display = 'none'; }
const tapBtn = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); sfx.init(); sfx.click(); fn(); });
tapBtn('bMute', toggleMute);
tapBtn('bPause', () => { if (st.mode === 'attract') return handover(); if (st.mode === 'build') return; if (st.mode === 'finish') return; pause(!st.paused); });
tapBtn('bRestart', () => { if (st.mode === 'build') return; if (st.paused) pause(false); restart(); });
tapBtn('bRespawn', () => { if (st.mode === 'attract') return handover(); if (st.mode === 'build') return; if (st.paused) pause(false); respawn(true); });
tapBtn('bRace', handover); tapBtn('bBuild', openBuilder);
tapBtn('bRetry', restart); tapBtn('bBack', () => (st.testing ? backToBuilder() : toMenu()));
tapBtn('bResume', () => pause(false)); tapBtn('bPRestart', () => { pause(false); restart(); }); tapBtn('bPMenu', () => { pause(false); if (st.testing) backToBuilder(); else toMenu(); });
for (const id of ['title', 'result', 'pause']) $(id).addEventListener('pointerdown', (e) => e.stopPropagation());

// ---------------- juice helpers ----------------
function burst(p, n, sp, r, g, b = 0.2) { for (let i = 0; i < n; i++) { const a = rnd() * TAU, e = rnd() * 2 - 1; sparks.emit(p.x, p.y, p.z, Math.cos(a) * sp * 10 * (1 - e * e), Math.abs(e) * sp * 10 + 2, Math.sin(a) * sp * 10 * (1 - e * e), 0.35 + rnd() * 0.4, 0.22, r, g, b); } }
function setBanner(text, dur, pulse) { st.banner = { text, t: 0, dur, pulse: !!pulse }; }
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

// ---------------- simulation tick (60 Hz) ----------------
function tick() {
  st.t += STEP;
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].t <= st.t) { const q = queue[i]; queue.splice(i, 1); q.fn(); }
  if (st.mode === 'build') return;
  prevPos.copy(car.pos); prevQuat.copy(car.quat);
  let input;
  if (st.mode === 'attract' || (st.auto && (st.mode === 'race' || st.mode === 'ready'))) input = ap.drive(car);
  else if (st.mode === 'finish') { input = inp; inp.throttle = 0; inp.brake = 1; inp.steer = 0; }
  else input = readInput();
  if (st.mode === 'ready') { if (input.throttle > 0 || input.brake > 0 || Math.abs(input.steer) > 0.2) { startRace(); } else { input = inp; } }
  if (st.falling > 0) { input = { throttle: 0, brake: 0, steer: 0 }; }
  car.step(STEP, input, TR.grid);
  const running = st.mode === 'race' || st.mode === 'attract';
  if (running) {
    st.raceT += STEP;
    race.update(car.pos, car.speed, st.raceT, events);
    for (const e of events) {
      if (e.type === 'cp') {
        const v = gateViz.find((q) => q.gt === e.gate); if (v) setGateDone(v, true);
        if (st.mode === 'race') {
          sfx.chime(e.n - 1); sfx.layer = e.n >= 2 ? 2 : 1; setBanner('CHECKPOINT ' + e.n + '/' + e.of, 1.1);
          const bs = ghostBest && ghostBest.splits[e.n - 1];
          st.splitTxt = bs != null ? { d: e.time - bs, t: 0 } : null;
          burst(car.pos, 30, 0.8, 0.4, 1, 0.5); st.fovKick = 6;
        }
      } else if (e.type === 'finish') { if (st.mode === 'race') finishRace(e.time); else { st.demoT = 0; later(1.5, () => { if (st.mode === 'attract') placeAtStart(); }); } }
      else if (e.type === 'missing' && st.mode === 'race') { setBanner(e.n + ' CHECKPOINT' + (e.n > 1 ? 'S' : '') + ' MISSED', 1.4); sfx.wrong(); }
    }
    if (st.mode === 'race' && ((st.t * 60) | 0) % 2 === 0) ghostRec.push(st.raceT, car.pos.x, car.pos.y, car.pos.z, car.quat.x, car.quat.y, car.quat.z, car.quat.w);
  }
  // juice from the physics
  if (car.landing > 6) { st.shake = Math.max(st.shake, Math.min(0.7, car.landing * 0.035)); if (st.mode !== 'attract') sfx.land(car.landing); for (const w of car.wheels) if (w.contact) burst(w.hit, 5, 0.35, 1, 0.75, 0.3); }
  if (car.impact > 4) { st.shake = Math.max(st.shake, Math.min(0.8, car.impact * 0.06)); if (st.mode !== 'attract') sfx.scrape(car.impact); burst(car.pos, Math.min(30, 6 + car.impact * 2), 0.6, 1, 0.8, 0.25); }
  if (car.scrape > 5) { car.axes(); for (let k = 0; k < 2; k++) sparks.emit(car.pos.x - car._ay.x * 0.3, car.pos.y - car._ay.y * 0.3, car.pos.z - car._ay.z * 0.3, (rnd() - 0.5) * 6 - car.vel.x * 0.3, rnd() * 4, (rnd() - 0.5) * 6 - car.vel.z * 0.3, 0.3, 0.18, 1, 0.85, 0.3); }
  for (const w of car.wheels) if (w.contact && w.slip > 4.5 && rnd() < 0.3) smoke.emit(w.hit.x, w.hit.y + 0.2, w.hit.z, (rnd() - 0.5) * 1.5, 0.6 + rnd(), (rnd() - 0.5) * 1.5, 0.6 + rnd() * 0.4, 0.32, 0.94, 0.93, 0.98);
  // falling into the sea / stuck / upside down
  if (car.pos.y < SEA_Y + 0.6 && st.falling === 0 && st.mode !== 'finish') {
    st.falling = 1; if (st.mode !== 'attract') { sfx.splash(); setBanner('SPLASH!', 0.8); }
    for (let i = 0; i < 60; i++) { const a = rnd() * TAU, s = 2 + rnd() * 6; smoke.emit(car.pos.x, SEA_Y + 0.3, car.pos.z, Math.cos(a) * s, 6 + rnd() * 9, Math.sin(a) * s, 1 + rnd() * 0.6, 0.9, 0.85, 0.97, 1); }
    st.shake = Math.max(st.shake, 0.35); later(0.75, () => { st.falling = 0; respawn(false); });
  }
  if (running && st.raceT > 2) {
    st.stuck = car.speed < 1.2 ? st.stuck + STEP : 0; car.axes(); st.upside = car._ay.y < 0.1 && car.grounded === 0 && car.speed < 4 ? st.upside + STEP : 0;
    if (st.mode === 'attract' && (st.stuck > 2.5 || st.upside > 2)) respawn(false);
  }
  if (st.mode === 'attract') { st.demoT += STEP; if (st.demoT > 75) { st.demoT = 0; placeAtStart(); } }
  sparks.update(STEP); smoke.update(STEP); confetti.update(STEP);
}

// ---------------- camera ----------------
let camSnap = true;
const cam = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0), look: new THREE.Vector3(), fov: 70, orbit: 0, cut: 0, cutI: 0 };
function updateCamera(dt, carP, carQ) {
  const portrait = innerHeight > innerWidth * 1.05, sp = car.speed;
  const cf = _v.set(0, 0, 1).applyQuaternion(carQ), cu = _v2.set(0, 1, 0).applyQuaternion(carQ);
  if (st.mode === 'build') return;
  const grounded = car.grounded >= 2;
  if (camSnap) { cam.fwd.copy(cf); cam.up.set(0, 1, 0); if (cu.y > 0.5) cam.up.copy(cu); }
  // up follows the car on the road (loops), drifts back to world up in the air
  _v3.copy(grounded ? cu : _v3.set(0, 1, 0)); cam.up.lerp(_v3, damp(grounded ? 5 : 1.6, dt)).normalize();
  // forward: car heading, flattened against camera up; while airborne lean towards the velocity
  const tf = _v3.copy(cf); if (!grounded && sp > 6) tf.lerp(_v.copy(car.vel).normalize(), 0.5);
  if (car.fwdSpeed < -3 && grounded) tf.negate().negate(); // keep looking ahead of the car body when reversing
  tf.addScaledVector(cam.up, -tf.dot(cam.up)).normalize();
  if (tf.lengthSq() > 0.5) cam.fwd.lerp(tf, damp(grounded ? 7 : 3, dt)).normalize();
  let dist = (portrait ? 8.2 : 7.0) + Math.min(sp, 50) * 0.035, hgt = portrait ? 3.1 : 2.6;
  if (st.mode === 'finish') { cam.orbit += dt * 0.6; dist = 8.5; hgt = 3; }
  const tgt = _v.copy(carP).addScaledVector(cam.fwd, -dist).addScaledVector(cam.up, hgt);
  if (st.mode === 'finish') { tgt.copy(carP).add(_v2.set(Math.sin(cam.orbit) * dist, hgt, Math.cos(cam.orbit) * dist)); }
  // attract: every ~6 s cut to a low trackside cam for variety
  if (st.mode === 'attract') {
    cam.cut += dt; if (cam.cut > 6.5) { cam.cut = 0; cam.cutI++; }
    if (cam.cutI % 3 === 2) { const side = _v2.set(1, 0, 0).applyQuaternion(carQ); tgt.copy(carP).addScaledVector(side, 6.5).addScaledVector(cam.fwd, 5).addScaledVector(cam.up, 1.4); }
  }
  if (camSnap) cam.pos.copy(tgt); else cam.pos.lerp(tgt, damp(st.mode === 'finish' ? 3 : 12, dt));
  cam.look.copy(carP).addScaledVector(cam.fwd, 4.2).addScaledVector(cam.up, portrait ? 1.9 : 1.5);
  camera.position.copy(cam.pos); camera.up.copy(cam.up); camera.lookAt(cam.look);
  // shake (decays with dt)
  if (st.shake > 0.001) { const a = st.shake * st.shake; camera.position.x += (rnd() - 0.5) * a * 0.9; camera.position.y += (rnd() - 0.5) * a * 0.9; camera.position.z += (rnd() - 0.5) * a * 0.9; camera.rotateZ((rnd() - 0.5) * a * 0.05); }
  st.shake *= Math.exp(-7 * dt); st.fovKick *= Math.exp(-3 * dt);
  const base = portrait ? 80 : 66, fov = base + Math.min(1, sp / 52) * (portrait ? 12 : 16) + st.fovKick;
  cam.fov += (fov - cam.fov) * damp(6, dt); if (camSnap) cam.fov = fov;
  if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  camSnap = false;
}

// ---------------- ghost playback ----------------
function updateGhost() {
  const g = ghostBest; if (!g || st.mode !== 'race' || st.testing && !g) { ghostView.root.visible = false; return; }
  const f = g.f, n = f.length / 8; if (n < 2) return; const t = st.raceT;
  let lo = 0, hi = n - 1; if (t >= f[(n - 1) * 8]) { ghostView.root.visible = false; return; }
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (f[m * 8] <= t) lo = m; else hi = m; }
  const a = lo * 8, b = hi * 8, u = clamp((t - f[a]) / Math.max(1e-4, f[b] - f[a]), 0, 1);
  ghostView.root.visible = true;
  ghostView.root.position.set(f[a + 1] + (f[b + 1] - f[a + 1]) * u, f[a + 2] + (f[b + 2] - f[a + 2]) * u, f[a + 3] + (f[b + 3] - f[a + 3]) * u);
  _q1.set(f[a + 4], f[a + 5], f[a + 6], f[a + 7]); _q2.set(f[b + 4], f[b + 5], f[b + 6], f[b + 7]); ghostView.root.quaternion.slerpQuaternions(_q1, _q2, u);
  for (let i = 0; i < 4; i++) { const w = car.wheels[i]; ghostView.wheels[i].position.set(w.mount.x, w.mount.y - 0.45, w.mount.z); }
  // fade the ghost when it overlaps the player
  ghostMat.opacity = clamp(ghostView.root.position.distanceTo(car.pos) / 8, 0.12, 0.42);
}
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

// ---------------- car visuals ----------------
function updateCarView(alpha) {
  rPos.lerpVectors(prevPos, car.pos, alpha); rQuat.slerpQuaternions(prevQuat, car.quat, alpha);
  carView.root.position.copy(rPos); carView.root.quaternion.copy(rQuat); carView.root.visible = st.mode !== 'build';
  for (let i = 0; i < 4; i++) {
    const w = car.wheels[i], piv = carView.wheels[i];
    const y = w.mount.y - (w.len - car.cfg.radius); piv.position.set(w.mount.x, y, w.mount.z);
    piv.rotation.set(0, w.steer, 0); const sp = w.spin; for (const c of piv.children) c.rotation.x = sp;
  }
  // body pitch/roll squash from suspension (visual only)
  const c = car.wheels; const pitch = ((c[0].comp + c[1].comp) - (c[2].comp + c[3].comp)) * 0.1, roll = ((c[0].comp + c[2].comp) - (c[1].comp + c[3].comp)) * 0.12;
  carView.shell.rotation.set(pitch, 0, -roll);
}

// ---------------- HUD (one 2D canvas) ----------------
const hud = $('hud'), hx = hud.getContext('2d'); let HW = 0, HH = 0, HD = 1;
const MM = { pts: null, b: null };
function computeMinimap() {
  const L = TR.line; const b = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 };
  for (const p of L) { b.x0 = Math.min(b.x0, p.p[0]); b.x1 = Math.max(b.x1, p.p[0]); b.z0 = Math.min(b.z0, p.p[2]); b.z1 = Math.max(b.z1, p.p[2]); }
  MM.b = b; MM.pts = L;
}
function txt(s, x, y, size, col = '#fff', align = 'center', stroke = 0.16) {
  hx.font = `${Math.round(size)}px Impact, "Arial Black", "Helvetica Neue", sans-serif`; hx.textAlign = align; hx.textBaseline = 'middle';
  hx.lineJoin = 'round'; hx.lineWidth = Math.max(3, size * stroke); hx.strokeStyle = G.INK; hx.strokeText(s, x, y); hx.fillStyle = col; hx.fillText(s, x, y);
}
function pill(x, y, w, h, col) { hx.beginPath(); hx.roundRect(x, y, w, h, h / 2); hx.fillStyle = col; hx.fill(); hx.lineWidth = 3; hx.strokeStyle = G.INK; hx.stroke(); }
function drawHUD(dt) {
  const w = HW, h = HH; hx.setTransform(HD, 0, 0, HD, 0, 0); hx.clearRect(0, 0, w, h);
  if (st.mode === 'build') return;
  const portrait = h > w * 1.05, U = portrait ? w / 390 : Math.min(w / 1280, h / 720) * 1.25, safeT = 8;
  // speed lines
  const sp = car.speed;
  if (sp > 28 && st.mode !== 'finish') {
    const a = Math.min(0.55, (sp - 28) / 30); hx.strokeStyle = `rgba(255,255,255,${a})`; hx.lineWidth = 2.5 * U;
    const cx = w / 2, cy = h * 0.45, R = Math.hypot(w, h) * 0.5;
    for (let i = 0; i < 26; i++) { const ang = (i / 26) * TAU + st.t * 0.7 + ((i * 97) % 13) * 0.05, r0 = R * (0.62 + ((i * 53 + Math.floor(st.t * 14)) % 7) * 0.04);
      hx.beginPath(); hx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); hx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); hx.stroke(); }
  }
  const demo = st.mode === 'attract';
  // timer (top centre)
  const tShown = st.mode === 'finish' ? st.finalT : st.raceT;
  const ty = safeT + (portrait ? 28 : 38) * U, tsz = (portrait ? 44 : 54) * U;
  if (!demo || !$('title').classList.contains('show') || !portrait) {
    txt(fmt(st.mode === 'ready' ? 0 : tShown), w / 2, ty + (demo && !portrait ? 0 : 0), tsz, st.mode === 'finish' ? '#ffd23c' : '#fff');
    // target medal line
    if (!st.testing) {
      const best = bestTime(); let tgt = MEDALS[MEDALS.length - 1]; for (let i = MEDALS.length - 1; i >= 0; i--) if (best != null && best <= MEDALS[i].t) tgt = MEDALS[Math.max(0, i - 1)];
      if (best != null && best <= MEDALS[0].t) tgt = MEDALS[0];
      const s = (demo ? 'AUTOPILOT DEMO' : tgt.name + '  ' + fmt(tgt.t)), fs = 17 * U; hx.font = `${Math.round(fs)}px Impact, "Arial Black", sans-serif`;
      const tw = hx.measureText(s).width + 34 * U; pill(w / 2 - tw / 2, ty + tsz * 0.55, tw, fs * 1.5, '#fff6ea');
      hx.beginPath(); hx.arc(w / 2 - tw / 2 + 14 * U, ty + tsz * 0.55 + fs * 0.75, 6 * U, 0, TAU); hx.fillStyle = demo ? '#ff3b30' : tgt.col; hx.fill(); hx.lineWidth = 2; hx.stroke();
      hx.fillStyle = G.INK; hx.textAlign = 'center'; hx.textBaseline = 'middle'; hx.fillText(s, w / 2 + 8 * U, ty + tsz * 0.55 + fs * 0.8);
      if (best != null && !demo) txt('BEST ' + fmt(best), w / 2, ty + tsz * 0.55 + fs * 2.35, 14 * U, '#cfe9ff');
    }
  }
  // checkpoints
  const n = race.cps.length;
  if (n) {
    const cs = 13 * U, x0 = portrait ? 14 * U : 22 * U, y0 = portrait ? safeT + 222 * U : safeT + 30 * U;
    txt('CP', x0, y0, 18 * U, '#ffd23c', 'left');
    for (let i = 0; i < n; i++) { const x = x0 + 46 * U + i * cs * 2.3; hx.save(); hx.translate(x, y0); hx.rotate(Math.PI / 4); hx.fillStyle = i < race.taken.size ? '#5ee87a' : 'rgba(255,246,234,.35)'; hx.fillRect(-cs * 0.6, -cs * 0.6, cs * 1.2, cs * 1.2); hx.lineWidth = 3; hx.strokeStyle = G.INK; hx.strokeRect(-cs * 0.6, -cs * 0.6, cs * 1.2, cs * 1.2); hx.restore(); }
  }
  // minimap
  if (MM.pts) {
    const ms = (portrait ? 92 : 150) * U, mx = portrait ? 12 * U : w - ms - 18 * U, my = portrait ? safeT + 108 * U : safeT + 62 * U;
    const b = MM.b, sc = ms / Math.max(b.x1 - b.x0, b.z1 - b.z0, 1);
    const P = (x, z) => [mx + ms / 2 - (x - (b.x0 + b.x1) / 2) * sc, my + ms / 2 - (z - (b.z0 + b.z1) / 2) * sc]; // north up, east(+x) left like the driver's map
    hx.beginPath(); hx.roundRect(mx - 6, my - 6, ms + 12, ms + 12, 12); hx.fillStyle = 'rgba(20,16,31,.45)'; hx.fill();
    hx.lineCap = 'round'; hx.lineJoin = 'round';
    for (const [lw, col] of [[7 * U, G.INK], [3.5 * U, '#fff6ea']]) { hx.beginPath(); let first = true, lp = null; for (const L of MM.pts) { const [x, y] = P(L.p[0], L.p[2]); if (first || (lp && Math.hypot(x - lp[0], y - lp[1]) > 30)) hx.moveTo(x, y); else hx.lineTo(x, y); first = false; lp = [x, y]; } hx.lineWidth = lw; hx.strokeStyle = col; hx.stroke(); }
    for (const v of gateViz) { const [x, y] = P(v.gt.p[0], v.gt.p[2]); hx.beginPath(); hx.arc(x, y, 4 * U, 0, TAU); hx.fillStyle = v.gt.kind === 'cp' ? (race.taken.has(v.gt) ? '#5ee87a' : '#ffd23c') : '#36e0c8'; hx.fill(); hx.lineWidth = 2; hx.strokeStyle = G.INK; hx.stroke(); }
    if (ghostView.root.visible) { const [x, y] = P(ghostView.root.position.x, ghostView.root.position.z); hx.beginPath(); hx.arc(x, y, 4 * U, 0, TAU); hx.fillStyle = '#7fe3ff'; hx.fill(); }
    const [cx, cy] = P(car.pos.x, car.pos.z); hx.beginPath(); hx.arc(cx, cy, 5.5 * U, 0, TAU); hx.fillStyle = '#ff3b30'; hx.fill(); hx.lineWidth = 2.5; hx.strokeStyle = G.INK; hx.stroke();
  }
  // speedometer
  const kmh = Math.round(sp * 3.6), touchUI = document.body.classList.contains('touch') && $('touch').classList.contains('on');
  const sx = w / 2, sy = portrait ? (touchUI ? h - 196 * U : h - 70 * U) : h - 58 * U, sr = 40 * U;
  hx.beginPath(); hx.arc(sx, sy, sr, Math.PI * 0.8, Math.PI * 2.2); hx.lineWidth = 11 * U; hx.strokeStyle = G.INK; hx.stroke();
  hx.beginPath(); hx.arc(sx, sy, sr, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * Math.min(1, sp / 56))); hx.lineWidth = 6 * U; hx.strokeStyle = sp > 42 ? '#ff3b30' : '#ffd23c'; hx.stroke();
  txt(String(kmh), sx, sy - 2 * U, 30 * U, '#fff'); txt('KM/H', sx, sy + 22 * U, 11 * U, '#ffd23c');
  // banners
  if (st.banner) {
    const b = st.banner; b.t += dt; if (b.t > b.dur) st.banner = null; else {
      const k = Math.min(1, b.t / 0.12), pop = 1 + (1 - k) * 0.6 + (b.pulse ? Math.sin(st.t * 6) * 0.04 : 0), al = b.dur - b.t < 0.25 ? (b.dur - b.t) / 0.25 : 1;
      hx.save(); hx.globalAlpha = al; hx.translate(w / 2, h * (portrait ? 0.34 : 0.3)); hx.scale(pop, pop); hx.rotate(-0.04);
      const big = b.text.length > 12 ? 34 : 64; txt(b.text, 0, 0, big * U, b.text === 'FINISH!' ? '#ffd23c' : b.text === 'SPLASH!' ? '#7fe3ff' : '#fff', 'center', 0.18); hx.restore();
    }
  }
  if (st.splitTxt) {
    const s = st.splitTxt; s.t += dt; if (s.t > 1.8) st.splitTxt = null; else {
      const good = s.d <= 0; const t = (good ? '−' : '+') + Math.abs(s.d).toFixed(2); hx.font = `${Math.round(26 * U)}px Impact, sans-serif`;
      const tw = hx.measureText(t).width + 26 * U; pill(w / 2 - tw / 2, h * (portrait ? 0.34 : 0.3) + 34 * U, tw, 34 * U, good ? '#36e0c8' : '#ff5f6d');
      hx.fillStyle = G.INK; hx.textAlign = 'center'; hx.fillText(t, w / 2, h * (portrait ? 0.34 : 0.3) + 52 * U);
    }
  }
  if ((st.mode === 'race') && (st.stuck > 1.5 || st.upside > 1.2)) txt(isTouch ? 'TAP ⚑ FOR LAST CHECKPOINT' : 'ENTER = LAST CHECKPOINT · R = RESTART', w / 2, h * 0.6, 20 * U, '#ffd23c');
}

// ---------------- builder ----------------
const B = { pieces: [], sel: 'straight', dir: 0, L: 0, del: false, hover: null, preview: null, previewKey: '', camX: -60, camZ: 90, zoom: 150, drag: null, pinch: null, grid: null, moved: 0 };
const PREVIEW_OK = new THREE.MeshBasicMaterial({ color: '#5ee87a', transparent: true, opacity: 0.55, depthWrite: false });
const PREVIEW_BAD = new THREE.MeshBasicMaterial({ color: '#ff5f6d', transparent: true, opacity: 0.55, depthWrite: false });
function builderSave() { lsSet('build', B.pieces); }
function builderLoad() { const p = lsGet('build'); B.pieces = Array.isArray(p) ? p.filter((q) => PIECES[q.type]) : MAIN.map((q) => ({ ...q })); }
function occupied(pieces) { const m = new Map(); pieces.forEach((p, i) => pieceCells(p).forEach((c) => m.set(c.join(','), i))); return m; }
function builderRebuild() { if (B.pieces.length) loadTrack(B.pieces, 'b' + hashPieces(B.pieces)); else { disposeGroup(trackGroup); trackGroup = null; TR = buildTrack([], { seaY: SEA_Y }); race = new Race(THREE, TR); ap = new Autopilot(THREE, TR, {}); MM.pts = null; } builderSave(); }
function hashPieces(ps) { let h = 2166136261; const s = JSON.stringify(ps.map((p) => [p.type, p.gx, p.gz, p.dir, p.L, p.m || 0])); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function makeGrid() {
  const n = 40, pts = []; for (let i = -n; i <= n; i++) { pts.push(i * S - S / 2, 0, -n * S - S / 2, i * S - S / 2, 0, n * S - S / 2, -n * S - S / 2, 0, i * S - S / 2, n * S - S / 2, 0, i * S - S / 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 })); l.visible = false; scene.add(l); return l;
}
function openBuilder() {
  sfx.init(); hideCards(); st.mode = 'build'; st.testing = false; st.paused = false; queue.length = 0; sfx.stopMusic(); showTouch(false); ghostView.root.visible = false;
  if (!B.grid) B.grid = makeGrid(); B.grid.visible = true; if (!B.loaded) { builderLoad(); B.loaded = true; }
  builderRebuild(); bui(true); buildPalette(); bmsg('Pick a piece, then tap / click the grid. Need one START (and a FINISH or a closed loop).');
}
function bui(on) { $('bui').classList.toggle('show', on); $('corner').style.display = on ? 'none' : ''; if (B.grid) B.grid.visible = on; if (!on && B.preview) { scene.remove(B.preview); B.preview.geometry.dispose(); B.preview = null; B.previewKey = ''; } }
function bmsg(s) { $('bmsg').textContent = s; }
function pieceIcon(type) {
  const c = document.createElement('canvas'); c.width = c.height = 68; const x = c.getContext('2d'); x.fillStyle = '#e8e2f0'; x.fillRect(0, 0, 68, 68);
  const p = { type, gx: 0, gz: 0, dir: 0, L: 0, m: 0 }; const tr = buildTrack([p]); const pts = tr.line.map((l) => l.p);
  if (type === 'gap') return c; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); }
  const sc = 50 / Math.max(x1 - x0, z1 - z0, 12), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  x.lineCap = 'round'; x.lineJoin = 'round';
  for (const [lw, col] of [[16, '#14101f'], [10, type === 'checkpoint' ? '#ffd23c' : type === 'start' ? '#36e0c8' : type === 'finish' ? '#fff' : '#4a4f72']]) {
    x.beginPath(); pts.forEach((q, i) => { const X = 34 - (q[0] - cx) * sc, Y = 34 - (q[2] - cz) * sc + (q[1] > 0.5 && type === 'loop' ? -q[1] * sc * 0.25 : 0); i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.lineWidth = lw; x.strokeStyle = col; x.stroke();
  }
  if (type === 'ramp' || type === 'kicker') { x.fillStyle = '#ff3b30'; x.beginPath(); x.moveTo(34, 12); x.lineTo(26, 24); x.lineTo(42, 24); x.fill(); }
  return c;
}
function buildPalette() {
  const pal = $('pal'); if (pal.childElementCount) { refreshPalette(); return; }
  BUILDER_PIECES.forEach((t, i) => {
    const b = document.createElement('button'); b.className = 'pb'; b.dataset.t = t; b.title = PIECES[t].name + ' (' + (i + 1) + ')';
    b.appendChild(pieceIcon(t)); const s = document.createElement('span'); s.textContent = PIECES[t].name; b.appendChild(s);
    b.addEventListener('click', (e) => { e.stopPropagation(); sfx.click(); B.sel = t; B.del = false; refreshPalette(); }); pal.appendChild(b);
  });
  refreshPalette();
}
function refreshPalette() { for (const b of $('pal').children) b.classList.toggle('sel', b.dataset.t === B.sel && !B.del); $('tDel').classList.toggle('on', B.del); $('tLv').textContent = 'LV ' + B.L; B.previewKey = ''; }
tapBtn('tRot', () => { B.dir = (B.dir + 1) % 4; refreshPalette(); });
tapBtn('tLvUp', () => { B.L = Math.min(4, B.L + 1); refreshPalette(); });
tapBtn('tLvDn', () => { B.L = Math.max(0, B.L - 1); refreshPalette(); });
tapBtn('tLv', () => { B.L = (B.L + 1) % 5; refreshPalette(); });
tapBtn('tDel', () => { B.del = !B.del; refreshPalette(); bmsg(B.del ? 'Delete mode: tap a piece to remove it.' : 'Placing: ' + PIECES[B.sel].name); });
tapBtn('tTest', testDrive);
tapBtn('tClear', () => { B.pieces = []; builderRebuild(); bmsg('Cleared. Start with a START piece.'); });
tapBtn('tCopy', () => { B.pieces = MAIN.map((q) => ({ ...q })); builderRebuild(); bmsg('Loaded a copy of the main track — edit away (the real one is untouched).'); });
tapBtn('tExit', () => toMenu());
function buildKey(e) {
  if (e.repeat) return; const c = e.code;
  if (c === 'KeyQ') { B.dir = (B.dir + 3) % 4; refreshPalette(); } else if (c === 'KeyE') { B.dir = (B.dir + 1) % 4; refreshPalette(); }
  else if (c === 'KeyZ') { B.L = Math.max(0, B.L - 1); refreshPalette(); } else if (c === 'KeyC') { B.L = Math.min(4, B.L + 1); refreshPalette(); }
  else if (c === 'KeyX' || c === 'Delete') { B.del = !B.del; refreshPalette(); }
  else if (c === 'KeyT' || c === 'Enter') testDrive(); else if (c === 'Escape') toMenu(); else if (c === 'KeyM') toggleMute();
  else if (/^Digit[1-9]$/.test(c)) { const i = +c.slice(5) - 1; if (BUILDER_PIECES[i]) { B.sel = BUILDER_PIECES[i]; B.del = false; refreshPalette(); } }
  else if (c.startsWith('Arrow') || c === 'KeyW' || c === 'KeyA' || c === 'KeyS' || c === 'KeyD') { const d = 12; if (c === 'ArrowUp' || c === 'KeyW') B.camZ += d; if (c === 'ArrowDown' || c === 'KeyS') B.camZ -= d; if (c === 'ArrowLeft' || c === 'KeyA') B.camX += d; if (c === 'ArrowRight' || c === 'KeyD') B.camX -= d; }
}
function testDrive() {
  if (!B.pieces.some((p) => p.type === 'start')) { sfx.wrong(); bmsg('Add a START piece first (it is where the car spawns).'); return; }
  if (!B.pieces.some((p) => p.type === 'finish') && !B.pieces.some((p) => p.type === 'checkpoint')) bmsg('No FINISH: the START line works as a lap finish.');
  bui(false); st.testing = true; loadTrack(B.pieces, 'b' + hashPieces(B.pieces)); restart();
}
function backToBuilder() { st.testing = false; hideCards(); sfx.stopMusic(); openBuilder(); }
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
function cellAt(cx, cy) { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); plane.constant = -B.L * H; if (!ray.ray.intersectPlane(plane, hitP)) return null; return { gx: Math.round(hitP.x / S), gz: Math.round((hitP.z) / S + 0.5 - 0.5) }; }
function cellFromPoint(cx, cy) { const c = cellAt(cx, cy); if (!c) return null; c.gz = Math.round(hitP.z / S); return c; }
function builderCamera(dt) {
  const z = B.zoom; camera.up.set(0, 1, 0); camera.position.set(B.camX, z * 0.82 + B.L * H, B.camZ - z * 0.55); camera.lookAt(B.camX, B.L * H, B.camZ);
  const f = innerHeight > innerWidth ? 70 : 55; if (camera.fov !== f) { camera.fov = f; camera.updateProjectionMatrix(); }
  if (B.grid) B.grid.position.y = B.L * H + 0.03;
  // preview
  const hv = B.hover; let key = hv ? [B.sel, hv.gx, hv.gz, B.dir, B.L, B.del].join() : '';
  if (key !== B.previewKey) {
    B.previewKey = key; if (B.preview) { scene.remove(B.preview); B.preview.geometry.dispose(); B.preview = null; }
    if (hv && !B.del) {
      const p = { type: B.sel, gx: hv.gx, gz: hv.gz, dir: B.dir, L: B.L, m: 0 }; const occ = occupied(B.pieces); const bad = pieceCells(p).some((c) => occ.has(c.join(',')));
      const tr = buildTrack([p], { seaY: SEA_Y }); const g = G.soupGeometry(tr.soup);
      // add a direction arrow on the entry cell
      B.preview = new THREE.Mesh(g, bad ? PREVIEW_BAD : PREVIEW_OK); B.preview.position.y = 0.05; B.preview.renderOrder = 5; scene.add(B.preview); B.hoverBad = bad;
    }
  }
}
function builderTap(cx, cy) {
  const c = cellFromPoint(cx, cy); if (!c) return; const occ = occupied(B.pieces);
  if (B.del) {
    let idx = -1; for (let L = B.L; L >= 0 && idx < 0; L--) { const k = [c.gx, c.gz, L].join(','); if (occ.has(k)) idx = occ.get(k); }
    if (idx < 0) for (const [k, i] of occ) { const [x, z] = k.split(',').map(Number); if (x === c.gx && z === c.gz) { idx = i; break; } }
    if (idx >= 0) { B.pieces.splice(idx, 1); sfx.scrape(2); builderRebuild(); bmsg('Removed. ' + B.pieces.length + ' pieces.'); } return;
  }
  const p = { type: B.sel, gx: c.gx, gz: c.gz, dir: B.dir, L: B.L, m: 0 };
  if (pieceCells(p).some((q) => occ.has(q.join(',')))) { sfx.wrong(); bmsg('That spot is taken — rotate, change level, or delete first.'); return; }
  if (B.pieces.length >= 160) { sfx.wrong(); bmsg('Piece limit reached (160).'); return; }
  if (p.type === 'start') B.pieces = B.pieces.filter((q) => q.type !== 'start');
  B.pieces.push(p); sfx.place(); builderRebuild(); B.previewKey = ''; bmsg(PIECES[p.type].name + ' placed. ' + B.pieces.length + ' pieces. Q/E or ⟳ rotates.');
}
canvas.addEventListener('pointerdown', (e) => { if (st.mode !== 'build') return; canvas.setPointerCapture(e.pointerId); (B.ptrs ||= new Map()).set(e.pointerId, [e.clientX, e.clientY]); B.moved = 0; B.down = [e.clientX, e.clientY]; if (B.ptrs.size === 2) { const [a, b] = [...B.ptrs.values()]; B.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: B.zoom }; } });
canvas.addEventListener('pointermove', (e) => {
  if (st.mode !== 'build') return; const pp = B.ptrs && B.ptrs.get(e.pointerId);
  if (pp) { const dx = e.clientX - pp[0], dy = e.clientY - pp[1]; pp[0] = e.clientX; pp[1] = e.clientY; B.moved += Math.abs(dx) + Math.abs(dy);
    if (B.ptrs.size === 2 && B.pinch) { const [a, b] = [...B.ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); B.zoom = clamp(B.pinch.z * B.pinch.d / Math.max(20, d), 50, 420); }
    else if (B.moved > 10) { const k = B.zoom / innerHeight * 1.2; B.camX += dx * k; B.camZ += dy * k; } }
  if (e.pointerType === 'mouse' || pp) B.hover = cellFromPoint(e.clientX, e.clientY);
});
const ptrEnd = (e) => { if (st.mode !== 'build' || !B.ptrs || !B.ptrs.has(e.pointerId)) return; const single = B.ptrs.size === 1; B.ptrs.delete(e.pointerId); if (B.ptrs.size < 2) B.pinch = null; if (single && B.moved < 10 && e.type === 'pointerup') { B.hover = cellFromPoint(e.clientX, e.clientY); builderTap(e.clientX, e.clientY); } };
canvas.addEventListener('pointerup', ptrEnd); canvas.addEventListener('pointercancel', ptrEnd);
canvas.addEventListener('wheel', (e) => { if (st.mode !== 'build') return; e.preventDefault(); B.zoom = clamp(B.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 50, 420); }, { passive: false });

// ---------------- resize / loop ----------------
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  HD = Math.min(2, window.devicePixelRatio || 1); hud.width = Math.round(w * HD); hud.height = Math.round(h * HD); HW = w; HH = h;
  for (const p of [sparks, smoke, confetti]) p.mat.uniforms.uScale.value = h * DPR * 0.9;
  document.getElementById('corner').style.flexDirection = h > w * 1.05 ? 'column' : 'row';
}
addEventListener('resize', resize); resize();
let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0, fps = 60;
const CAP = Q.has('cap'); // deterministic capture: the page only advances when the test calls __ptp.advance(dt)
function frame(now, forced) {
  if (!forced) requestAnimationFrame(frame);
  if (CAP && !forced) return;
  let dt = forced ? forced : Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now; fpsT += dt; fpsN++; if (fpsT > 1) { fps = fpsN / fpsT; fpsT = 0; fpsN = 0; }
  if (pad || st.mode !== 'build') { readInputPads(); }
  if (!st.paused) {
    if (st.slowT > 0) { st.slowT -= dt; if (st.slowT <= 0) st.timeScale = 1; }
    acc += dt * st.timeScale; let n = 0; while (acc >= STEP && n < 8) { tick(); acc -= STEP; n++; } if (n === 8) acc = 0;
  }
  const alpha = st.paused ? 1 : acc / STEP, rdt = st.paused ? 0 : dt;
  updateCarView(alpha);
  if (st.mode === 'build') builderCamera(rdt); else updateCamera(Math.max(rdt, 1e-4), rPos, rQuat);
  updateGhost();
  sun.position.copy(rPos).addScaledVector(SUNDIR, 70); sun.target.position.copy(rPos);
  sky.position.copy(camera.position);
  const on = st.mode === 'race' || st.mode === 'ready' || st.mode === 'finish';
  sfx.drive(car.speed, on ? (st.mode === 'finish' ? 0 : inp.throttle) : 0, car.slip, car.grounded, on && !st.paused);
  renderer.render(scene, camera);
  drawHUD(rdt);
}
function readInputPads() { if (navigator.getGamepads) { const gps = navigator.getGamepads(); pad = null; for (const gp of gps) if (gp && gp.connected) { pad = gp; break; } pollPadButtons(); } }

// ---------------- boot ----------------
loadTrack(MAIN, 'main'); placeAtStart();
if (Q.has('build')) openBuilder();
else if (Q.has('nointro') || st.auto) { restart(); } else { st.mode = 'attract'; showTitle(); }
requestAnimationFrame(frame);
// debug / QA handle (read-only use by the headless tests)
window.__ptp = { st, car, get race() { return race; }, get TR() { return TR; }, renderer, get fps() { return fps; }, B, restart, respawn, openBuilder, advance: (dt) => frame(performance.now(), dt), testDrive, toMenu, MEDALS, get ghost() { return ghostBest; } };
