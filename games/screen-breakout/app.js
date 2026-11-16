/* SCREEN BREAKOUT — cash, a tire, glass cracks and confetti escape the TV.
   Three.js layer over the camera; every effect spawns from the aligned TV quad
   and moves toward the viewer with light physics (gravity / flutter / bounce). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ==== THEME PACK — "leonida" ====
   Every theme-specific value (palette, textures, copy) lives here so a new
   skin pack can be swapped in without touching engine logic below. */
const THEME = {
  name: 'leonida',
  billFront: 'assets/bill-front.jpg',
  billBack: 'assets/bill-back.jpg',
  confettiColors: [0xff4757, 0xffa502, 0x2ed573, 0x1e90ff, 0xeccc68, 0xff6b81, 0x7bed9f, 0x70a1ff],
  smokeInner: 'rgba(200,200,205,0.55)',
  smokeOuter: 'rgba(200,200,205,0)',
  crackStroke: '255,255,255', // r,g,b triplet for the glass-crack strokes
  texts: {
    tireLoading: 'Tire still loading…',
    tireFailed: 'Tire model failed to load'
  }
};

const $ = id => document.getElementById(id);
const video = $('cam');
AR.startCamera(video);

const toastEl = $('toast'); let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ---------- renderer / scene ---------- */
const FOV = 55, DIST = 10;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
$('gl').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, DIST);
scene.add(new THREE.HemisphereLight(0xffffff, 0x334, 1.1));
const dl = new THREE.DirectionalLight(0xfff2dd, 1.6); dl.position.set(3, 6, 6); scene.add(dl);

function viewSize(z = 0) {
  const h = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * ((DIST - z) / DIST);
  return { w: h * camera.aspect, h };
}
function pxToWorld(px, py, z = 0) {
  const s = viewSize(z);
  return new THREE.Vector3((px / window.innerWidth - 0.5) * s.w, (0.5 - py / window.innerHeight) * s.h, z);
}
function quadWorld() { return AR.quadPx().map(p => pxToWorld(p.x, p.y, 0)); }
function floorY() {
  const b = AR.bbox();
  return pxToWorld(0, Math.min(window.innerHeight, b.b + window.innerHeight * 0.10), 0).y;
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- shared textures ---------- */
const texLoader = new THREE.TextureLoader();
function srgb(tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex; }
const billFront = srgb(texLoader.load(THEME.billFront));
const billBack = srgb(texLoader.load(THEME.billBack));

function radialSprite(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, inner); grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const smokeTex = radialSprite(THEME.smokeInner, THEME.smokeOuter);

/* ---------- effects registry ---------- */
const effects = [];
function addEffect(update, obj) { if (obj) scene.add(obj); effects.push({ update, obj, dead: false }); }

/* ---------- CASH ---------- */
const billGeo = new THREE.PlaneGeometry(0.62, 0.287);
function spawnCash() {
  const q = quadWorld();
  const cx = (q[0].x + q[2].x) / 2, cy = (q[0].y + q[2].y) / 2;
  const N = 22;
  for (let i = 0; i < N; i++) {
    const grp = new THREE.Group();
    const mF = new THREE.Mesh(billGeo, new THREE.MeshBasicMaterial({ map: billFront, side: THREE.FrontSide }));
    const mB = new THREE.Mesh(billGeo, new THREE.MeshBasicMaterial({ map: billBack, side: THREE.FrontSide }));
    mB.rotation.y = Math.PI; mB.position.z = -0.0012;
    grp.add(mF, mB);
    grp.position.set(cx + (Math.random() - 0.5) * 1.6, cy + (Math.random() - 0.5) * 0.9, 0.1);
    grp.rotation.set(Math.random() * 0.8 - 0.4, Math.random() * 0.8 - 0.4, Math.random() * 0.6 - 0.3);
    scene.add(grp);
    const st = {
      grp,
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.7, 0.7 + Math.random() * 1.1, 1.6 + Math.random() * 1.6),
      ph: Math.random() * Math.PI * 2, fl: 5 + Math.random() * 5,
      spin: (Math.random() - 0.5) * 2.4, age: 0, landed: false, life: 5.5 + Math.random() * 2
    };
    effects.push({ obj: grp, dead: false, update(dt, t) {
      st.age += dt;
      if (!st.landed) {
        st.vel.y -= 1.55 * dt; // floaty gravity — paper falls slowly
        st.vel.multiplyScalar(1 - 0.25 * dt);
        grp.position.addScaledVector(st.vel, dt);
        grp.rotation.x = Math.sin(t * st.fl + st.ph) * 0.95;
        grp.rotation.y += st.spin * dt;
        grp.rotation.z = Math.cos(t * st.fl * 0.8 + st.ph) * 0.5;
        const fy = floorY();
        if (grp.position.y <= fy + 0.02 && st.vel.y < 0) {
          st.landed = true; grp.position.y = fy + 0.02;
          grp.userData.flat = { x: -Math.PI / 2 + (Math.random() - 0.5) * 0.22, z: Math.random() * Math.PI };
        }
      } else {
        grp.rotation.x += (grp.userData.flat.x - grp.rotation.x) * Math.min(1, dt * 7);
        grp.rotation.z += (grp.userData.flat.z - grp.rotation.z) * Math.min(1, dt * 7);
        grp.rotation.y *= 1 - Math.min(1, dt * 7);
      }
      if (st.age > st.life) {
        const k = 1 - Math.min(1, (st.age - st.life) / 0.7);
        grp.scale.setScalar(Math.max(0.001, k));
        if (k <= 0.001) this.dead = true;
      }
    }});
  }
}

/* ---------- TIRE ---------- */
let wheelProto = null, wheelRadius = 0.55;
new GLTFLoader().load('assets/wheel.glb', gltf => {
  const m = gltf.scene;
  const bb = new THREE.Box3().setFromObject(m);
  const size = bb.getSize(new THREE.Vector3());
  const dims = [['x', size.x], ['y', size.y], ['z', size.z]].sort((a, b) => a[1] - b[1]);
  const thin = dims[0][0]; // axle axis = thinnest dimension
  if (thin === 'x') m.rotation.y = Math.PI / 2;
  else if (thin === 'y') m.rotation.x = Math.PI / 2;
  // re-measure after orienting, then centre + scale to target diameter
  const wrap = new THREE.Group(); wrap.add(m);
  const bb2 = new THREE.Box3().setFromObject(wrap);
  const s2 = bb2.getSize(new THREE.Vector3()), c2 = bb2.getCenter(new THREE.Vector3());
  m.position.sub(c2);
  const dia = Math.max(s2.x, s2.y);
  const k = (wheelRadius * 2) / dia;
  wrap.scale.setScalar(k);
  wheelProto = wrap;
}, undefined, () => toast(THEME.texts.tireFailed));

function spawnTire() {
  if (!wheelProto) { toast(THEME.texts.tireLoading); return; }
  const grp = wheelProto.clone(true);
  const start = AR.quadPoint(0.30, 0.55);
  const w0 = pxToWorld(start.x, start.y, 0);
  grp.position.copy(w0);
  grp.rotation.y = 0.42; // slight angle so rim + tread read instead of a flat disc
  scene.add(grp);
  const st = { grp, vel: new THREE.Vector3(1.7, 1.35, 2.3), age: 0, r: wheelRadius };
  effects.push({ obj: grp, dead: false, update(dt) {
    st.age += dt;
    st.vel.y -= 5.6 * dt;
    grp.position.addScaledVector(st.vel, dt);
    const fy = floorY() + st.r;
    if (grp.position.y < fy) {
      grp.position.y = fy;
      if (Math.abs(st.vel.y) > 0.7) { st.vel.y = -st.vel.y * 0.52; st.vel.x *= 0.94; st.vel.z *= 0.85; }
      else { st.vel.y = 0; st.vel.x *= (1 - 0.35 * dt); st.vel.z *= (1 - 1.4 * dt); }
    }
    grp.rotation.z -= (st.vel.x / st.r) * dt; // rolling
    grp.rotation.x += (st.vel.z / st.r) * dt * 0.4;
    if (st.age > 9 || grp.position.x > viewSize().w / 2 + 1.5) this.dead = true;
  }});
}

/* ---------- CRASH ---------- */
function crackTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 640;
  const g = c.getContext('2d');
  const ix = 530, iy = 300;
  g.lineCap = 'round';
  function jagged(x0, y0, ang, len, w0, depth) {
    let x = x0, y = y0, a = ang;
    const steps = 7 + (Math.random() * 5 | 0);
    for (let i = 0; i < steps; i++) {
      const seg = (len / steps) * (0.7 + Math.random() * 0.6);
      a += (Math.random() - 0.5) * 0.35;
      const nx = x + Math.cos(a) * seg, ny = y + Math.sin(a) * seg;
      g.strokeStyle = 'rgba(' + THEME.crackStroke + ',' + (0.85 - i * 0.09) + ')';
      g.lineWidth = Math.max(0.6, w0 * (1 - i / steps));
      g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      if (depth < 2 && len > 40 && Math.random() < 0.35 && i > 1) {
        jagged(x, y, a + (Math.random() < 0.5 ? 0.6 : -0.6), len * 0.3, w0 * 0.5, depth + 1);
      }
      x = nx; y = ny;
    }
  }
  for (let i = 0; i < 15; i++) jagged(ix, iy, (i / 15) * Math.PI * 2 + Math.random() * 0.3, 300 + Math.random() * 230, 3.4, 0);
  for (let r = 46; r < 210; r += 26 + Math.random() * 22) { // concentric fracture rings
    g.strokeStyle = 'rgba(' + THEME.crackStroke + ',0.5)'; g.lineWidth = 1.6;
    let a0 = Math.random() * Math.PI * 2;
    for (let s = 0; s < 3; s++) {
      g.beginPath(); g.arc(ix, iy, r, a0, a0 + 0.9 + Math.random() * 1.4); g.stroke();
      a0 += 2.1 + Math.random();
    }
  }
  const rg = g.createRadialGradient(ix, iy, 2, ix, iy, 60);
  rg.addColorStop(0, 'rgba(' + THEME.crackStroke + ',0.95)'); rg.addColorStop(1, 'rgba(' + THEME.crackStroke + ',0)');
  g.fillStyle = rg; g.beginPath(); g.arc(ix, iy, 60, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
let crackTex = null;
function spawnCrash() {
  if (!crackTex) crackTex = crackTexture();
  const q = quadWorld();
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array([
    q[0].x, q[0].y, 0.05,  q[1].x, q[1].y, 0.05,  q[2].x, q[2].y, 0.05,  q[3].x, q[3].y, 0.05
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
  geo.setIndex([0, 3, 2, 0, 2, 1]);
  const mat = new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  // stage shake
  const stage = $('stage'); const t0 = performance.now();
  (function shake() {
    const k = (performance.now() - t0) / 380;
    if (k >= 1) { stage.style.transform = ''; return; }
    const a = (1 - k) * 11;
    stage.style.transform = 'translate(' + (Math.random() - 0.5) * a + 'px,' + (Math.random() - 0.5) * a + 'px)';
    requestAnimationFrame(shake);
  })();
  // smoke puffs from the quad edges
  const puffs = [];
  for (let i = 0; i < 12; i++) {
    const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false }));
    const u = Math.random(), side = Math.random() < 0.5 ? 0 : 1;
    const p = AR.quadPoint(u, side);
    const w = pxToWorld(p.x, p.y, 0.3);
    sm.position.copy(w); sm.scale.setScalar(0.4);
    scene.add(sm); puffs.push({ sm, dir: side === 0 ? 1 : -1, ph: Math.random() * 6 });
  }
  const st = { age: 0 };
  effects.push({ obj: mesh, dead: false, update(dt) {
    st.age += dt;
    mat.opacity = st.age < 0.08 ? st.age / 0.08 : Math.max(0, 1 - Math.max(0, st.age - 2.1) / 0.8);
    puffs.forEach(p => {
      p.sm.position.y += dt * 0.35 * p.dir * -1; // drift away from glass vertically
      p.sm.position.x += Math.sin(st.age * 2 + p.ph) * dt * 0.12;
      p.sm.scale.setScalar(0.4 + st.age * 0.55);
      p.sm.material.opacity = 0.5 * Math.max(0, 1 - st.age / 2.2);
    });
    if (st.age > 3) { puffs.forEach(p => scene.remove(p.sm)); this.dead = true; }
  }});
}

/* ---------- CONFETTI ---------- */
function spawnConfetti() {
  const N = 130;
  const geo = new THREE.PlaneGeometry(0.11, 0.06);
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const inst = new THREE.InstancedMesh(geo, mat, N);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const q = quadWorld();
  const cx = (q[0].x + q[2].x) / 2, cy = (q[0].y + q[2].y) / 2;
  const parts = [];
  const color = new THREE.Color();
  for (let i = 0; i < N; i++) {
    inst.setColorAt(i, color.setHex(THEME.confettiColors[i % THEME.confettiColors.length]));
    parts.push({
      p: new THREE.Vector3(cx + (Math.random() - 0.5) * 0.8, cy + (Math.random() - 0.5) * 0.5, 0.15),
      v: new THREE.Vector3((Math.random() - 0.5) * 3.4, 1.2 + Math.random() * 2.4, 1.4 + Math.random() * 2.2),
      r: new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3),
      rv: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9),
      landed: false
    });
  }
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  scene.add(inst);
  const dummy = new THREE.Object3D();
  const st = { age: 0 };
  effects.push({ obj: inst, dead: false, update(dt) {
    st.age += dt;
    const fy = floorY();
    parts.forEach((pt, i) => {
      if (!pt.landed) {
        pt.v.y -= 2.6 * dt; pt.v.multiplyScalar(1 - 0.5 * dt);
        pt.p.addScaledVector(pt.v, dt);
        pt.r.x += pt.rv.x * dt; pt.r.y += pt.rv.y * dt; pt.r.z += pt.rv.z * dt;
        if (pt.p.y <= fy + 0.02 && pt.v.y < 0) { pt.landed = true; pt.p.y = fy + 0.02; pt.r.set(-Math.PI / 2, 0, Math.random() * 3); }
      }
      dummy.position.copy(pt.p); dummy.rotation.copy(pt.r);
      const fade = st.age > 3.4 ? Math.max(0.001, 1 - (st.age - 3.4) / 0.8) : 1;
      dummy.scale.setScalar(fade);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (st.age > 4.3) this.dead = true;
  }});
}

/* ---------- loop ---------- */
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.update(dt, t);
    if (e.dead) { if (e.obj) scene.remove(e.obj); effects.splice(i, 1); }
  }
  renderer.render(scene, camera);
}
loop();

$('cashBtn').addEventListener('click', spawnCash);
$('tireBtn').addEventListener('click', spawnTire);
$('crashBtn').addEventListener('click', spawnCrash);
$('confettiBtn').addEventListener('click', spawnConfetti);
$('alignBtn').addEventListener('click', () => AR.setAlign(!AR.isAligning()));
