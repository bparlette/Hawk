// main.js — Linkle Arcade (ATTEMPT D: C's fountain paint + B's light):
// one page, three journeys. The world is ATTEMPT C's — built from the
// oil-paint plaza's own brush-sheet strokes (dabs.js + brush.js) — lit by
// ATTEMPT B's Hoshi stack: shader sky with sculpted cumulus, banded toon
// light (tex.js ramp), blue-teal distance haze, and ONE warm anime grade
// pass (gradepost.js). No Kuwahara: the grade cannot flatten geometry
// strokes, which is the point of D.
import * as THREE from 'three';
import { TouchController } from './gptouch.js';
import { GradePost } from './gradepost.js';
import { LeafLevel, MotoLevel, GlideLevel, makeSky, leafHeight, clamp } from './levels.js';
import * as SFX from './audio.js';

const params = new URLSearchParams(location.search);
const captureMode = params.has('capture');

/* ------------------------------ renderer ------------------------------ */
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.NoToneMapping; // GradePost does the grade (ACES + gamma)
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('view').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x93bcd2, 130, 1900); // B's blue-teal distance haze (Ghibli air)
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3200);
camera.position.set(0, 4, 14);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x86a860, 0.82); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1cf, 1.75); sun.position.set(80, 140, 60); scene.add(sun);
const sky = makeSky(); scene.add(sky);

const post = new GradePost(THREE, renderer);
function fitPost() {
  const s = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(s.x, s.y);
}
fitPost();

/* ------------------------------ levels ------------------------------ */
const levels = { leaf: new LeafLevel(), moto: new MotoLevel(), glide: new GlideLevel() };
for (const l of Object.values(levels)) { l.group.visible = false; scene.add(l.group); }
const ORDER = ['leaf', 'moto', 'glide'];
let current = levels.leaf;
let screen = 'menu'; // menu | ready | play | done | photo

function activate(id) {
  current = levels[id];
  for (const l of Object.values(levels)) l.group.visible = (l === current);
  current.reset();
}

/* ------------------------------ EV (level -> shell) ------------------------------ */
const $ = (id) => document.getElementById(id);
const best = JSON.parse(localStorage.getItem('linkle-arcade-best') || '{}');
function showBest() { for (const id of ORDER) $('best-' + id).textContent = best[id] ? `BEST ${best[id]}` : ''; }
showBest();

function popup(text) {
  if (screen !== 'play') return;
  const el = document.createElement('div');
  el.className = 'pop'; el.textContent = text;
  el.style.left = (44 + Math.random() * 14) + '%';
  el.style.top = '40%';
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

const EV = {
  rupee() { SFX.rupeeSfx(); },
  ring() { SFX.ringSfx(); popup('⭕ +150'); },
  thud() { SFX.thudSfx(); },
  nearMiss() { SFX.nearMissSfx(); },
  popup,
  done(result) {
    if (screen !== 'play') return;
    screen = 'done';
    SFX.fanfareSfx();
    const id = current.id;
    if (!best[id] || result.score > best[id]) { best[id] = result.score; localStorage.setItem('linkle-arcade-best', JSON.stringify(best)); showBest(); }
    $('bannerTitle').textContent = '🏁 FINISH!';
    $('bannerScore').textContent = `SCORE ${result.score}`;
    $('bannerDetail').textContent = result.detail || '';
    $('btnNext').style.display = ORDER.indexOf(id) < 2 ? '' : 'none';
    $('banner').style.display = 'flex';
  },
};

/* ------------------------------ input ------------------------------ */
const tc = new TouchController({ zIndex: 1100, force: params.has('forcetouch') });
if (tc._buttons) { for (const id in tc._buttons) { const b = tc._buttons[id]; if (b.el) b.el.remove(); } tc._buttons = {}; }
const keys = {};
addEventListener('keydown', (e) => { keys[e.key] = true; });
addEventListener('keyup', (e) => { keys[e.key] = false; });
let captureStick = null;
function readInput() {
  if (captureStick) return captureStick;
  let x = 0, y = 0;
  try { const ti = tc.getInput(); if (ti) { x += ti.x; y += ti.y; } } catch { /* headless */ }
  if (keys.ArrowLeft || keys.a) x -= 1;
  if (keys.ArrowRight || keys.d) x += 1;
  if (keys.ArrowUp || keys.w) y -= 1;
  if (keys.ArrowDown || keys.s) y += 1;
  return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
}
const ZERO = { x: 0, y: 0 };

/* ------------------------------ screens / DOM ------------------------------ */
function toMenu() {
  screen = 'menu';
  SFX.engine(false);
  activate('leaf');
  $('menu').style.display = 'flex';
  $('hud').style.display = 'none';
  $('banner').style.display = 'none';
  $('toast').style.display = 'none';
}
function selectLevel(id) {
  SFX.initAudio();
  activate(id);
  screen = 'ready';
  $('menu').style.display = 'none';
  $('banner').style.display = 'none';
  $('hud').style.display = 'flex';
  $('toast').style.display = 'block';
  refreshHud();
}
function begin() {
  if (screen !== 'ready') return;
  screen = 'play';
  $('toast').style.display = 'none';
  if (current.id === 'glide') current.launch();
}
for (const id of ORDER) $('card-' + id).addEventListener('click', () => selectLevel(id));
$('toastBtn').addEventListener('click', begin);
$('hudLevelsBtn').addEventListener('click', toMenu);
$('btnLevels').addEventListener('click', toMenu);
$('btnRetry').addEventListener('click', () => { const id = current.id; selectLevel(id); begin(); });
$('btnNext').addEventListener('click', () => { const n = ORDER[ORDER.indexOf(current.id) + 1]; if (n) { selectLevel(n); begin(); } });
addEventListener('pointerdown', () => SFX.initAudio());
addEventListener('touchend', () => SFX.initAudio());

let hudClock = 0;
function refreshHud() {
  const st = current.state();
  $('hudMain').textContent = `${st.mainIcon || '💎'} ${st.rupees}`;
  $('hudSide').textContent = `${st.sideIcon} ${st.sideVal}`;
}

/* ------------------------------ sim + render ------------------------------ */
let elapsed = 0, menuT = 0;
function step(dt) {
  elapsed += dt;
  if (screen === 'play') {
    current.update(dt, readInput(), EV, camera);
  } else if (screen === 'menu') {
    menuT += dt;
    if (current.id !== 'leaf') activate('leaf');
    if (current.z < -980) current.reset();
    current.update(dt, { x: Math.sin(menuT * 0.24) * 0.45, y: 0 }, EV, camera);
  } else if (screen === 'ready') {
    if (current.id === 'glide') current.update(dt, ZERO, EV, camera);
    else current.idle(dt, camera);
  } else if (screen === 'done') {
    current.idle(dt, camera);
  }
  sky.position.set(camera.position.x, 0, camera.position.z);
  sky.material.uniforms.uTime.value = elapsed;
  hudClock += dt;
  if (hudClock > 0.12 && screen !== 'menu') { hudClock = 0; refreshHud(); }
}
function render() { post.render(scene, camera, elapsed, 0); }

activate('leaf');
step(1 / 30); render();
$('loading').style.display = 'none';

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  step(dt); render();
  if (!captureMode) requestAnimationFrame(frame);
}
if (!captureMode) requestAnimationFrame(frame);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  fitPost();
});

/* ------------------------------ capture / art hook ------------------------------ */
let camOverride = null;
function applyCamOverride() {
  if (!camOverride) return;
  camera.position.copy(camOverride.pos);
  camera.lookAt(camOverride.look);
}
const realStep = step;
step = function (dt) { realStep(dt); if (screen === 'photo') applyCamOverride(); };

window.__arcade = {
  ready: true,
  startLevel(id) { selectLevel(id); },
  begin() { begin(); },
  step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) step(dt); render(); },
  render() { render(); },
  setStick(x, y) { captureStick = { x, y }; },
  clearStick() { captureStick = null; },
  place(dist) { if (current.place) current.place(dist); },
  photo(name) {
    camOverride = null;
    if (name === 'char') {
      activate('leaf');
      screen = 'photo';
      const L = levels.leaf;
      L.x = 1.5; L.z = -150; L.y = leafHeight(1.5, -150);
      L.rig.position.set(L.x, L.y, L.z);
      L.rig.rotation.set(-0.05, 0.52, 0.02);
      L.shadow.position.set(L.x, L.y + 0.06, L.z);
      camOverride = {
        pos: new THREE.Vector3(L.x + 2.95, L.y + 1.5, L.z + 2.45),
        look: new THREE.Vector3(L.x - 0.1, L.y + 0.92, L.z - 0.2),
      };
      $('menu').style.display = 'none'; $('hud').style.display = 'none'; $('toast').style.display = 'none';
      applyCamOverride();
      render();
    } else if (name === 'leaf') {
      selectLevel('leaf'); begin();
      const L = levels.leaf;
      for (let i = 0; i < 9; i++) { // autopilot tracking the rupee snake
        this.setStick(clamp((11 * Math.sin(L.z * 0.01) - L.x) * 0.07, -0.8, 0.8), 0);
        this.step(30);
      }
      for (let t = 0; t < 4; t++) { // final frame must not have a tree dead ahead
        const blocked = L.obstacles.some((o) => o.z < L.z + 1 && o.z > L.z - 15 && Math.abs(o.x - L.x) < 3.2);
        if (!blocked) break;
        this.step(40);
      }
      this.clearStick();
    } else if (name === 'moto') {
      selectLevel('moto'); begin(); this.place(690); this.step(55);
    } else if (name === 'glide') {
      selectLevel('glide'); begin(); this.setStick(0.06, 0); this.step(260); this.clearStick();
    }
    return this.state();
  },
  state() {
    const st = current.state ? current.state() : {};
    return { screen, level: current.id, ...st, done: !!current.done };
  },
  probe() {
    const L = current;
    if (L.id === 'leaf') return { x: L.x, z: L.z, speed: L.speed, grounded: L.grounded, dabs: L.dabCount };
    if (L.id === 'moto') return { d: L.d, lat: L.lat, speed: L.speed, nearMiss: L.nearMiss, dabs: L.dabCount };
    return { x: L.pos.x, y: L.pos.y, z: L.pos.z, heading: L.heading, v: L.v, flying: L.flying, dabs: L.dabCount };
  },
};
