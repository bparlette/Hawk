import * as THREE from 'three';

// SKYDIVE: HOOTERS RUN — toad-city chunky 32-bit skydive demo.
// ?clean=1 skips title. ?auto=1 bot flies the whole run.
const Q = new URLSearchParams(location.search);
const AUTO = Q.has('auto') || Q.has('autostart');
const CLEAN = Q.has('clean');

const W = 270, H = 480;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(W, H, false);
renderer.setPixelRatio(1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5e0);
scene.fog = new THREE.Fog(0x9fc3e8, 120, 420);
const camera = new THREE.PerspectiveCamera(62, W / H, 0.5, 900);

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3a5a3a, 1.05));
const sun = new THREE.DirectionalLight(0xfff2cc, 1.6);
sun.position.set(-60, 120, 40);
scene.add(sun);

// seeded rng — same city every run
let _s = 1337;
const rnd = () => (_s = (_s * 1664525 + 1013904223) >>> 0) / 4294967296;

// ---------- textures ----------
function canvasTex(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}
const windowTex = canvasTex(64, 64, (x) => {
  x.fillStyle = '#8a8f98'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#5a5e66'; x.fillRect(0, 56, 64, 8);
  for (let wy = 4; wy < 52; wy += 9) for (let wx = 5; wx < 58; wx += 9) {
    x.fillStyle = rnd() < 0.45 ? '#ffe08a' : '#232830';
    x.fillRect(wx, wy, 5, 6);
  }
});
const waterTex = canvasTex(64, 64, (x) => {
  x.fillStyle = '#1e6fa8'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#2f8fc4';
  for (let i = 0; i < 26; i++) x.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 8 + ((rnd() * 10) | 0), 2);
});
waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(10, 10);
const sandTex = canvasTex(64, 64, (x) => {
  x.fillStyle = '#d9c184'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#c9b075';
  for (let i = 0; i < 40; i++) x.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 3, 3);
});
sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping; sandTex.repeat.set(8, 8);
const signTex = canvasTex(128, 32, (x) => {
  x.fillStyle = '#e8641b'; x.fillRect(0, 0, 128, 32);
  x.fillStyle = '#000'; x.font = 'bold 20px monospace'; x.textAlign = 'center';
  x.fillText('HOOTERS', 64, 24);
});

// ---------- world ----------
// water everywhere, city island in the middle
const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900),
  new THREE.MeshLambertMaterial({ map: waterTex }));
water.rotation.x = -Math.PI / 2; water.position.y = -2; scene.add(water);

const island = new THREE.Mesh(new THREE.PlaneGeometry(420, 460),
  new THREE.MeshLambertMaterial({ map: sandTex }));
island.rotation.x = -Math.PI / 2; island.position.set(0, -0.5, -180); scene.add(island);

// downtown cluster of buildings
const buildings = [];
const bGeo = new THREE.BoxGeometry(1, 1, 1);
for (let i = 0; i < 70; i++) {
  const bx = (rnd() - 0.5) * 300, bz = -60 - rnd() * 320;
  const bw = 10 + rnd() * 16, bd = 10 + rnd() * 16;
  const bh = 14 + rnd() * rnd() * 70; // a few towers
  const m = new THREE.Mesh(bGeo, new THREE.MeshLambertMaterial({ map: windowTex }));
  m.position.set(bx, bh / 2 - 1, bz); m.scale.set(bw, bh, bd);
  scene.add(m); buildings.push(m);
}
// bridge
const bridge = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 300),
  new THREE.MeshLambertMaterial({ color: 0x9aa0a8 }));
bridge.position.set(-120, 4, -180); scene.add(bridge);
for (let i = 0; i < 6; i++) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6),
    new THREE.MeshLambertMaterial({ color: 0x7a8088 }));
  p.position.set(-120, -2, -300 + i * 48); scene.add(p);
}
// clouds
const cloudTex = canvasTex(64, 32, (x) => {
  x.clearRect(0, 0, 64, 32); x.fillStyle = 'rgba(255,255,255,.92)';
  for (let i = 0; i < 9; i++) { const r = 6 + rnd() * 9; x.beginPath(); x.arc(10 + rnd() * 44, 12 + rnd() * 12, r, 0, 7); x.fill(); }
});
const clouds = [];
for (let i = 0; i < 14; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false }));
  s.position.set((rnd() - 0.5) * 500, 120 + rnd() * 160, -rnd() * 500);
  const sc = 40 + rnd() * 50; s.scale.set(sc, sc * 0.45, 1);
  scene.add(s); clouds.push(s);
}

// HOOTERS — orange roof, sign, beacon column
const HX = 26, HZ = -360;
const hoot = new THREE.Group();
const hb = new THREE.Mesh(new THREE.BoxGeometry(26, 12, 22),
  new THREE.MeshLambertMaterial({ map: windowTex }));
hb.position.y = 5; hoot.add(hb);
const roof = new THREE.Mesh(new THREE.BoxGeometry(28, 3, 24),
  new THREE.MeshLambertMaterial({ color: 0xe8641b }));
roof.position.y = 12.5; hoot.add(roof);
const sign = new THREE.Mesh(new THREE.PlaneGeometry(24, 6),
  new THREE.MeshBasicMaterial({ map: signTex }));
sign.position.set(0, 10, 11.2); hoot.add(sign);
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 5, 220, 8, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
beacon.position.y = 110; hoot.add(beacon);
hoot.position.set(HX, 0, HZ); scene.add(hoot);
// landing pad marker on the roof
const pad = new THREE.Mesh(new THREE.RingGeometry(4, 6, 16),
  new THREE.MeshBasicMaterial({ color: 0xffe08a, side: THREE.DoubleSide }));
pad.rotation.x = -Math.PI / 2; pad.position.set(HX, 14.2, HZ); scene.add(pad);

// ---------- rings ----------
const rings = [];
const ringGeo = new THREE.TorusGeometry(7, 1.1, 6, 18);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
for (let i = 0; i < 7; i++) {
  const m = new THREE.Mesh(ringGeo, ringMat);
  m.position.set((i % 2 ? 1 : -1) * (8 + (i * 5) % 18), 0, -50 - i * 38);
  m.position.y = 265 - i * 24;
  m.rotation.y = Math.PI / 2; m.rotation.x = 0.25;
  scene.add(m); rings.push({ m, hit: false, y: m.position.y });
}

// ---------- character ----------
const texLoader = new THREE.TextureLoader();
function loadTex(p) { const t = texLoader.load(p); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t; }
const freefallTex = loadTex('assets/skydiver-freefall.png');
const chuteTex = loadTex('assets/skydiver-chute.png');
const charMat = new THREE.SpriteMaterial({ map: freefallTex, transparent: true });
const character = new THREE.Sprite(charMat);
character.scale.set(26, 40, 1);
scene.add(character);

// speed lines
const lineGeo = new THREE.BufferGeometry();
const linePos = new Float32Array(40 * 6);
lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
scene.add(lines);

// ---------- audio (tiny) ----------
let AC = null;
function audio() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }
function beep(f, d, type = 'square', v = 0.12) {
  try {
    const ac = audio(), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v;
    o.connect(g); g.connect(ac.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d);
    o.stop(ac.currentTime + d);
  } catch (e) {}
}
function fanfare() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.22, 'square', 0.14), i * 110)); }

// ---------- game state ----------
const hudAlt = document.getElementById('hudAlt');
const hudScore = document.getElementById('hudScore');
const hudPhase = document.getElementById('hudPhase');
const banner = document.getElementById('banner');
const overlay = document.getElementById('overlay');
let bannerT = null;
function showBanner(txt, ms = 1400) {
  banner.textContent = txt; banner.style.opacity = 1;
  clearTimeout(bannerT); bannerT = setTimeout(() => banner.style.opacity = 0, ms);
}

const P = {
  state: 'title', t: 0,
  x: 0, y: 300, z: 20,          // world pos
  vx: 0, phase: 'freefall',
  score: 0, combo: 0, best: 0,
  deployY: 108,                  // auto-deploy altitude
  landX: 0, result: ''
};
const FALL1 = 14.5, FALL2 = 7.2, ZSPD = 26;

function reset() {
  P.state = 'play'; P.t = 0; P.x = 0; P.y = 300; P.z = 20; P.vx = 0;
  P.phase = 'freefall'; P.score = 0; P.combo = 0; P.result = '';
  charMat.map = freefallTex; charMat.needsUpdate = true;
  character.scale.set(26, 40, 1);
  rings.forEach(r => { r.hit = false; r.m.visible = true; });
  hudPhase.textContent = 'FREEFALL'; hudPhase.classList.remove('hidden');
  showBanner('JUMP!', 900); beep(880, 0.3, 'sawtooth', 0.1);
}

// input — drag to steer
let dragging = false, dragX = 0, keyL = false, keyR = false;
addEventListener('pointerdown', e => { dragging = true; dragX = e.clientX; });
addEventListener('pointermove', e => { if (dragging) { P.vx = ((e.clientX - dragX) / 40); dragX = e.clientX; } });
addEventListener('pointerup', () => { dragging = false; P.vx *= 0.3; });
addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') keyL = true;
  if (e.key === 'ArrowRight') keyR = true;
  if (e.key === ' ' && P.phase === 'freefall' && P.state === 'play') deploy();
});
addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft') keyL = false;
  if (e.key === 'ArrowRight') keyR = false;
});
function deploy() {
  if (P.phase !== 'freefall') return;
  P.phase = 'chute';
  charMat.map = chuteTex; charMat.needsUpdate = true;
  character.scale.set(30, 46, 1);
  hudPhase.textContent = 'CANOPY';
  showBanner('CANOPY OUT!', 1100); beep(220, 0.5, 'sawtooth', 0.12);
}

function bot(dt) {
  // steer toward next ring, then toward Hooters
  let tx = 0;
  if (P.phase === 'freefall') {
    const r = rings.find(r => !r.hit && r.y < P.y + 6);
    if (r) tx = r.m.position.x;
    if (P.y < P.deployY + 12) { deploy(); }
  } else {
    tx = HX;
  }
  P.vx += ((tx - P.x) * 2.2 - P.vx * 3) * dt * 3;
}

function land() {
  P.state = 'scored';
  const d = Math.abs(P.x - HX);
  let label, pts;
  if (d < 7) { label = 'PERFECT LANDING!'; pts = 1000; }
  else if (d < 16) { label = 'GOOD LANDING!'; pts = 500; }
  else { label = 'SLOPPY...'; pts = 100; }
  P.result = label; P.score += pts; P.best = Math.max(P.best, P.score);
  showBanner(label + ' +' + pts, 2600); fanfare();
  hudPhase.classList.add('hidden');
  setTimeout(() => {
    overlay.classList.remove('hidden');
    overlay.querySelector('h1').innerHTML = label + '<br>SCORE ' + P.score;
    overlay.querySelector('p').innerHTML = 'BEST ' + P.best + '<br><br>DRAG TO STEER<br>THREAD THE RINGS';
    overlay.querySelector('.tap').textContent = 'TAP TO FLY AGAIN';
  }, 2800);
}

function update(dt) {
  P.t += dt;
  if (AUTO) bot(dt);
  if (keyL) P.vx -= 90 * dt;
  if (keyR) P.vx += 90 * dt;
  P.vx *= (1 - 1.6 * dt);
  P.x += P.vx * 22 * dt;
  P.x = Math.max(-70, Math.min(70, P.x));

  const fall = P.phase === 'freefall' ? FALL1 : FALL2;
  P.y -= fall * dt;
  P.z -= ZSPD * dt * (P.phase === 'freefall' ? 1 : 0.55);

  // auto-deploy
  if (P.phase === 'freefall' && P.y <= P.deployY) deploy();

  // rings
  for (const r of rings) {
    if (!r.hit && Math.abs(P.y - r.y) < 4 && Math.hypot(P.x - r.m.position.x, (P.z - r.m.position.z) * 0.4) < 9) {
      r.hit = true; r.m.visible = false;
      P.combo++; P.score += 100 * P.combo;
      showBanner(P.combo > 1 ? 'COMBO x' + P.combo + '!' : 'RING! +100', 700);
      beep(660 + P.combo * 90, 0.18);
    }
  }

  // water + clouds scroll
  waterTex.offset.y += dt * 0.008;
  for (const c of clouds) { c.position.x += dt * 2; if (c.position.x > 280) c.position.x = -280; }
  pad.rotation.z += dt * 1.5;
  beacon.material.opacity = 0.22 + Math.sin(P.t * 5) * 0.1;

  // character pose
  character.position.set(P.x, P.y, P.z);
  character.material.rotation = -P.vx * 0.09;
  const sway = Math.sin(P.t * (P.phase === 'freefall' ? 9 : 2.2));
  character.position.x += Math.sin(P.t * 1.7) * 0.6;
  if (P.phase === 'chute') character.position.y += sway * 1.2;

  // speed lines in freefall
  const lp = lineGeo.attributes.position.array;
  if (P.phase === 'freefall') {
    lines.visible = true;
    for (let i = 0; i < 40; i++) {
      const lx = P.x + (rnd() - 0.5) * 120, ly = P.y + rnd() * 90 - 20, lz = P.z - rnd() * 90;
      lp[i * 6] = lx; lp[i * 6 + 1] = ly; lp[i * 6 + 2] = lz;
      lp[i * 6 + 3] = lx; lp[i * 6 + 4] = ly - 14; lp[i * 6 + 5] = lz;
    }
    lineGeo.attributes.position.needsUpdate = true;
  } else lines.visible = false;

  // camera chase
  camera.position.set(P.x * 0.55, P.y + 26, P.z + 58);
  camera.lookAt(P.x * 0.8, P.y - 34, P.z - 70);

  // HUD
  const alt = Math.max(0, Math.round(P.y * 40));
  hudAlt.textContent = 'ALT ' + alt;
  hudScore.innerHTML = 'SCORE ' + P.score + (P.combo > 1 ? '<br>COMBO x' + P.combo : '');

  if (P.y <= 14.5 && P.state === 'play') land();
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (P.state === 'play') update(dt);
  renderer.render(scene, camera);
}

overlay.addEventListener('pointerdown', () => {
  audio(); overlay.classList.add('hidden'); reset();
});
if (CLEAN || AUTO) { overlay.classList.add('hidden'); reset(); }
requestAnimationFrame(loop);
