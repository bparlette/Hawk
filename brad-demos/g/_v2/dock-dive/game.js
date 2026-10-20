import * as THREE from 'three';
import { getToadWorld } from './toad-world.js';

// DOCK DIVE: HARBOR RUN — toad-city chunky 32-bit dock-run demo.
// Baltimore-harbor flavor: pier, boats, skyline, dive at the end.
// ?clean=1 skips title. ?auto=1 bot runs the whole pier.
const Q = new URLSearchParams(location.search);
const AUTO = Q.has('auto') || Q.has('autostart');
const CLEAN = Q.has('clean');

const W = 270, H = 480;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(W, H, false);
renderer.setPixelRatio(1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec8e8);
scene.fog = new THREE.Fog(0x9fd4ea, 90, 380);
const camera = new THREE.PerspectiveCamera(62, W / H, 0.5, 900);

scene.add(new THREE.HemisphereLight(0xd8f0ff, 0x2a5a7a, 1.1));
const sun = new THREE.DirectionalLight(0xfff2cc, 1.5);
sun.position.set(-50, 100, 60); scene.add(sun);

let _s = 4242;
const rnd = () => (_s = (_s * 1664525 + 1013904223) >>> 0) / 4294967296;

function canvasTex(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}
const waterTex = canvasTex(64, 64, (x) => {
  x.fillStyle = '#1a6a9e'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#2b8cc2';
  for (let i = 0; i < 30; i++) x.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 6 + ((rnd() * 12) | 0), 2);
  x.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 8; i++) x.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 4, 1);
});
waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(12, 12);
const woodTex = canvasTex(64, 64, (x) => {
  x.fillStyle = '#8a6238'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#6e4c2a';
  for (let py = 0; py < 64; py += 16) x.fillRect(0, py, 64, 2);
  for (let i = 0; i < 24; i++) x.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 5, 1);
});
woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(2, 40);
const windowTex = canvasTex(64, 64, (x) => {
  x.fillStyle = '#7d8894'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#4d545e'; x.fillRect(0, 56, 64, 8);
  for (let wy = 4; wy < 52; wy += 9) for (let wx = 5; wx < 58; wx += 9) {
    x.fillStyle = rnd() < 0.4 ? '#ffe08a' : '#232830';
    x.fillRect(wx, wy, 5, 6);
  }
});

// ---------- harbor ----------
// water
const water = new THREE.Mesh(new THREE.PlaneGeometry(800, 800),
  new THREE.MeshLambertMaterial({ map: waterTex }));
water.rotation.x = -Math.PI / 2; water.position.y = -3; scene.add(water);

// the pier — wooden dock into the harbor (tuned so run+dive+score fits a 30s short)
const PIER_LEN = 200, PIER_W = 16;
const pier = new THREE.Mesh(new THREE.BoxGeometry(PIER_W, 2, PIER_LEN),
  new THREE.MeshLambertMaterial({ map: woodTex }));
pier.position.set(0, 0, -PIER_LEN / 2 + 10); scene.add(pier);
// pilings
const pilGeo = new THREE.CylinderGeometry(0.9, 0.9, 9, 6);
const pilMat = new THREE.MeshLambertMaterial({ color: 0x5e4226 });
for (let z = 0; z > -PIER_LEN; z -= 18) {
  for (const px of [-PIER_W / 2 - 1.5, PIER_W / 2 + 1.5]) {
    const p = new THREE.Mesh(pilGeo, pilMat);
    p.position.set(px, -3.5, z); scene.add(p);
  }
}
// rope rails
const railMat = new THREE.MeshLambertMaterial({ color: 0x8a6238 });
for (const px of [-PIER_W / 2 + 0.6, PIER_W / 2 - 0.6]) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, PIER_LEN), railMat);
  rail.position.set(px, 2.6, -PIER_LEN / 2 + 10); scene.add(rail);
  for (let z = 0; z > -PIER_LEN; z -= 24) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.6, 0.7), railMat);
    post.position.set(px, 1.3, z); scene.add(post);
  }
}

// boats moored alongside ("running by the boat")
function makeBoat(bx, bz, hullColor) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 16),
    new THREE.MeshLambertMaterial({ color: hullColor }));
  hull.position.y = -1; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(3.5, 6, 4),
    new THREE.MeshLambertMaterial({ color: hullColor }));
  bow.rotation.x = -Math.PI / 2; bow.rotation.y = Math.PI / 4;
  bow.position.set(0, -1, -10.5); bow.scale.set(1, 1, 0.6); g.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.6, 7),
    new THREE.MeshLambertMaterial({ color: 0xe8e4da }));
  cabin.position.set(0, 1.6, 2); g.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 12, 5),
    new THREE.MeshLambertMaterial({ color: 0x6e4c2a }));
  mast.position.set(0, 6, 2); g.add(mast);
  g.position.set(bx, 0, bz); g.rotation.y = (rnd() - 0.5) * 0.3;
  scene.add(g); return g;
}
const boats = [
  makeBoat(-22, -55, 0xc23a2a), makeBoat(24, -100, 0x2a6ac2),
  makeBoat(-24, -150, 0xe8e4da),
];
// distant skyline backdrop
const bGeo = new THREE.BoxGeometry(1, 1, 1);
for (let i = 0; i < 40; i++) {
  const bw = 12 + rnd() * 18, bh = 18 + rnd() * rnd() * 80, bd = 12 + rnd() * 18;
  const m = new THREE.Mesh(bGeo, new THREE.MeshLambertMaterial({ map: windowTex }));
  m.position.set((rnd() - 0.5) * 420, bh / 2 - 3, -280 - rnd() * 100);
  m.scale.set(bw, bh, bd); scene.add(m);
}
// TOAD STREET — the REAL world from Toad Street 32 (extracted verbatim).
// Waterfront district alongside the pier (runner passes it on the left).
{
  const world = getToadWorld();
  world.scale.setScalar(1.5);
  world.position.set(-30, 0, -20);
  scene.add(world);
}

// a lighthouse-ish tower on the right
const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 40, 8),
  new THREE.MeshLambertMaterial({ color: 0xd84a3a }));
tower.position.set(60, 17, -200); scene.add(tower);
const lampM = new THREE.MeshBasicMaterial({ color: 0xffe08a });
const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8), lampM);
lamp.position.set(60, 39, -200); scene.add(lamp);

// seagulls
const gulls = [];
const gullMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
for (let i = 0; i < 8; i++) {
  const g = new THREE.Group();
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.7), gullMat);
  const w2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.7), gullMat);
  w1.position.x = -1.4; w2.position.x = 1.4; g.add(w1); g.add(w2);
  g.position.set((rnd() - 0.5) * 160, 25 + rnd() * 30, -rnd() * 280);
  g.userData = { w1, w2, ph: rnd() * 9 };
  scene.add(g); gulls.push(g);
}

// obstacles (crates) + boosts on the pier
const obstacles = [], boosts = [];
const crateGeo = new THREE.BoxGeometry(3, 3, 3);
const crateMat = new THREE.MeshLambertMaterial({ color: 0xa8763a });
const boostGeo = new THREE.PlaneGeometry(5, 5);
const boostTex = canvasTex(32, 32, (x) => {
  x.fillStyle = '#9dd84a'; x.fillRect(0, 0, 32, 32);
  x.fillStyle = '#000'; x.beginPath();
  x.moveTo(16, 4); x.lineTo(26, 18); x.lineTo(18, 18); x.lineTo(18, 28);
  x.lineTo(14, 28); x.lineTo(14, 18); x.lineTo(6, 18); x.closePath(); x.fill();
});
for (let i = 0; i < 8; i++) {
  const oz = -25 - i * 18 - rnd() * 6;
  const ox = (rnd() - 0.5) * 10;
  const c = new THREE.Mesh(crateGeo, crateMat);
  c.position.set(ox, 2.5, oz); c.rotation.y = rnd();
  scene.add(c); obstacles.push({ m: c, hit: false });
}
for (let i = 0; i < 6; i++) {
  const bz = -35 - i * 26;
  const bx = (rnd() - 0.5) * 10;
  const b = new THREE.Mesh(boostGeo, new THREE.MeshBasicMaterial({ map: boostTex, transparent: true, side: THREE.DoubleSide }));
  b.rotation.x = -Math.PI / 2; b.position.set(bx, 1.15, bz);
  scene.add(b); boosts.push({ m: b, hit: false });
}

// splash particles
const splashN = 60;
const splashGeo = new THREE.BufferGeometry();
const splashPos = new Float32Array(splashN * 3);
const splashVel = [];
splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPos, 3));
const splash = new THREE.Points(splashGeo, new THREE.PointsMaterial({ color: 0xdff4ff, size: 2.4 }));
splash.visible = false; scene.add(splash);
const ripple = new THREE.Mesh(new THREE.RingGeometry(2, 3.4, 20),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
ripple.rotation.x = -Math.PI / 2; ripple.visible = false; scene.add(ripple);

// ---------- character ----------
const texLoader = new THREE.TextureLoader();
function loadTex(p) { const t = texLoader.load(p); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t; }
const runnerTex = loadTex('assets/dock-runner.png');
const charMat = new THREE.SpriteMaterial({ map: runnerTex, transparent: true });
const character = new THREE.Sprite(charMat);
character.scale.set(13, 20, 1);
scene.add(character);

// ---------- audio ----------
let AC = null;
function audio() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }
function beep(f, d, type = 'square', v = 0.1) {
  try {
    const ac = audio(), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v;
    o.connect(g); g.connect(ac.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d);
    o.stop(ac.currentTime + d);
  } catch (e) {}
}
function splashSnd() { beep(300, 0.4, 'sawtooth', 0.1); setTimeout(() => beep(180, 0.5, 'sawtooth', 0.08), 120); }

// ---------- HUD ----------
const hudDist = document.getElementById('hudDist');
const hudScore = document.getElementById('hudScore');
const banner = document.getElementById('banner');
const overlay = document.getElementById('overlay');
let bannerT = null;
function showBanner(txt, ms = 1400) {
  banner.textContent = txt; banner.style.opacity = 1;
  clearTimeout(bannerT); bannerT = setTimeout(() => banner.style.opacity = 0, ms);
}

// ---------- state ----------
const P = {
  state: 'title', t: 0, x: 0, z: 8, vx: 0, speed: 11,
  score: 0, boosts: 0, hits: 0, diveT: 0, result: '', best: 0,
};
const END_Z = -PIER_LEN + 14;

function reset() {
  P.state = 'play'; P.t = 0; P.x = 0; P.z = 8; P.vx = 0; P.speed = 11;
  P.score = 0; P.boosts = 0; P.hits = 0; P.diveT = 0; P.result = '';
  obstacles.forEach(o => { o.hit = false; o.m.visible = true; });
  boosts.forEach(b => { b.hit = false; b.m.visible = true; });
  splash.visible = false; ripple.visible = false;
  character.material.rotation = 0; character.scale.set(13, 20, 1);
  showBanner('RUN!', 800); beep(520, 0.2);
}

// input
let dragging = false, dragX = 0, keyL = false, keyR = false;
addEventListener('pointerdown', e => { dragging = true; dragX = e.clientX; });
addEventListener('pointermove', e => { if (dragging) { P.vx = ((e.clientX - dragX) / 30); dragX = e.clientX; } });
addEventListener('pointerup', () => { dragging = false; P.vx *= 0.3; });
addEventListener('keydown', e => { if (e.key === 'ArrowLeft') keyL = true; if (e.key === 'ArrowRight') keyR = true; });
addEventListener('keyup', e => { if (e.key === 'ArrowLeft') keyL = false; if (e.key === 'ArrowRight') keyR = false; });

function bot(dt) {
  // dodge crates, aim for boosts, stay centered
  let tx = 0, danger = null;
  for (const o of obstacles) {
    if (!o.hit && o.m.position.z < P.z && o.m.position.z > P.z - 26 && Math.abs(o.m.position.x - P.x) < 4) { danger = o; break; }
  }
  if (danger) tx = danger.m.position.x > 0 ? danger.m.position.x - 6 : danger.m.position.x + 6;
  else {
    let bb = null, bd = 1e9;
    for (const b of boosts) {
      if (!b.hit && b.m.position.z < P.z && (P.z - b.m.position.z) < bd) { bd = P.z - b.m.position.z; bb = b; }
    }
    if (bb && bd < 60) tx = bb.m.position.x;
  }
  P.vx += ((tx - P.x) * 2.4 - P.vx * 3.2) * dt * 3;
}

function startDive() {
  P.state = 'dive'; P.diveT = 0;
  splashSnd();
  // splash burst
  splash.visible = true;
  for (let i = 0; i < splashN; i++) {
    splashPos[i * 3] = P.x; splashPos[i * 3 + 1] = -2; splashPos[i * 3 + 2] = END_Z - 4;
    const a = rnd() * Math.PI * 2, sp = 4 + rnd() * 10;
    splashVel[i] = [Math.cos(a) * sp * 0.5, 6 + rnd() * 12, Math.sin(a) * sp * 0.5 - 4];
  }
  splashGeo.attributes.position.needsUpdate = true;
  ripple.position.set(P.x, -2.6, END_Z - 4); ripple.visible = true;
}

function finishDive() {
  P.state = 'scored';
  const centerBonus = Math.max(0, 1 - Math.abs(P.x) / 8);
  const pts = Math.round(300 + P.boosts * 150 - P.hits * 100 + centerBonus * 400);
  P.score = Math.max(50, pts);
  let label;
  if (P.boosts >= 5 && P.hits === 0 && centerBonus > 0.7) label = 'PERFECT DIVE!';
  else if (P.score >= 600) label = 'GREAT DIVE!';
  else label = 'SPLASHDOWN!';
  P.result = label; P.best = Math.max(P.best, P.score);
  showBanner(label + ' +' + P.score, 2600);
  [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.2), i * 100));
  setTimeout(() => {
    overlay.classList.remove('hidden');
    overlay.querySelector('h1').innerHTML = label + '<br>SCORE ' + P.score;
    overlay.querySelector('p').innerHTML = 'BEST ' + P.best + '<br><br>DRAG TO DODGE<br>GRAB BOOSTS';
    overlay.querySelector('.tap').textContent = 'TAP TO RUN AGAIN';
  }, 2800);
}

function update(dt) {
  P.t += dt;
  if (AUTO) bot(dt);
  if (keyL) P.vx -= 60 * dt;
  if (keyR) P.vx += 60 * dt;
  P.vx *= (1 - 2 * dt);
  P.x += P.vx * 14 * dt;
  P.x = Math.max(-6.5, Math.min(6.5, P.x));
  P.speed = Math.min(20, P.speed + dt * 0.55);
  P.z -= P.speed * dt;

  // run bob
  const bob = Math.abs(Math.sin(P.t * 11)) * 0.9;
  character.position.set(P.x, 3.2 + bob, P.z);
  character.material.rotation = -P.vx * 0.06;

  // obstacles + boosts
  for (const o of obstacles) {
    if (!o.hit && Math.abs(P.z - o.m.position.z) < 2.2 && Math.abs(P.x - o.m.position.x) < 2.6) {
      o.hit = true; o.m.visible = false; P.hits++;
      P.speed = Math.max(8, P.speed - 3);
      showBanner('BONK! -100', 700); beep(140, 0.25, 'sawtooth', 0.14);
    }
  }
  for (const b of boosts) {
    if (!b.hit && Math.abs(P.z - b.m.position.z) < 2.4 && Math.abs(P.x - b.m.position.x) < 3) {
      b.hit = true; b.m.visible = false; P.boosts++;
      P.speed = Math.min(24, P.speed + 2.5); P.score += 150;
      showBanner('BOOST! +150', 700); beep(880, 0.15);
    }
    if (!b.hit) b.m.rotation.z += dt * 2;
  }

  // ambient
  waterTex.offset.y += dt * 0.01; waterTex.offset.x += dt * 0.004;
  for (const bt of boats) { bt.position.y = Math.sin(P.t * 1.3 + bt.position.z) * 0.5; bt.rotation.z = Math.sin(P.t + bt.position.z) * 0.02; }
  for (const g of gulls) {
    const u = g.userData; g.position.x += Math.sin(P.t * 0.7 + u.ph) * dt * 6;
    g.position.z += dt * 3; if (g.position.z > 20) g.position.z = -280;
    const f = Math.sin(P.t * 10 + u.ph) * 0.5;
    u.w1.rotation.z = f; u.w2.rotation.z = -f;
  }
  lampM.color.setHSL(0.12, 0.9, 0.5 + Math.sin(P.t * 3) * 0.2);

  camera.position.set(P.x * 0.5, 12, P.z + 26);
  camera.lookAt(P.x * 0.7, 2, P.z - 30);

  const dist = Math.max(0, Math.round((8 - P.z)));
  hudDist.textContent = 'DIST ' + dist + 'm';
  hudScore.textContent = 'SCORE ' + (P.score + dist);

  if (P.z <= END_Z) startDive();
}

function updateDive(dt) {
  P.diveT += dt;
  const k = Math.min(1, P.diveT / 1.1);
  // arc into the water
  character.position.z = END_Z - 4 - k * 8;
  character.position.y = 3.2 - k * k * 7;
  character.material.rotation = -k * 1.2;
  character.scale.set(13 * (1 - k * 0.25), 20 * (1 - k * 0.25), 1);
  // splash particles fall
  const pa = splashGeo.attributes.position.array;
  for (let i = 0; i < splashN; i++) {
    splashVel[i][1] -= 30 * dt;
    pa[i * 3] += splashVel[i][0] * dt;
    pa[i * 3 + 1] += splashVel[i][1] * dt;
    pa[i * 3 + 2] += splashVel[i][2] * dt;
    if (pa[i * 3 + 1] < -3) pa[i * 3 + 1] = -3;
  }
  splashGeo.attributes.position.needsUpdate = true;
  const rk = Math.min(1, P.diveT / 2);
  ripple.scale.setScalar(1 + rk * 5);
  ripple.material.opacity = 0.8 * (1 - rk);
  camera.position.set(P.x * 0.5, 12 - P.diveT * 2, END_Z + 26);
  camera.lookAt(P.x * 0.7, -2, END_Z - 6);
  if (P.diveT > 2.6 && P.state === 'dive') finishDive();
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (P.state === 'play') update(dt);
  else if (P.state === 'dive') updateDive(dt);
  renderer.render(scene, camera);
}

overlay.addEventListener('pointerdown', () => {
  audio(); overlay.classList.add('hidden'); reset();
});
if (CLEAN || AUTO) { overlay.classList.add('hidden'); reset(); }
requestAnimationFrame(loop);
