/* COUCH COMPANION — a real animated GLB robot (RobotExpressive, CC-BY) who
   stands where you tap, idles, looks around, and reacts: DUCK / CHEER /
   SCARED / SLEEP, plus a mic-reactive auto-duck for loud TV gunfire. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ==== THEME PACK — "leonida" ====
   Every theme-specific value (character model, clip-role mapping, palette,
   copy) lives here so a new skin pack can be swapped in without touching
   engine logic below. Clip values are ROLES mapped to this model's clip
   names — a different character pack remaps them to its own clips. */
const THEME = {
  name: 'leonida',
  model: 'assets/RobotExpressive.glb',
  clips: { idle: 'Idle', cheer: 'Dance', scared: 'No', sleep: 'Sitting', wake: 'Wave' },
  shadowInner: 'rgba(0,0,0,0.5)',
  shadowOuter: 'rgba(0,0,0,0)',
  texts: {
    ready: 'Companion ready — tap PLACE, then tap where it stands',
    loadFail: '⚠️ Companion model failed to load — check connection and reload.',
    modelFailed: 'Model failed to load',
    placeHint: 'Tap where your companion should stand',
    placed: 'Placed',
    micOn: 'Mic on — loud bangs make it duck',
    micOff: 'Mic reactions off',
    micFail: 'Mic unavailable'
  }
};

const $ = id => document.getElementById(id);
const video = $('cam');
AR.startCamera(video);

const toastEl = $('toast'); let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

/* ---------- renderer / world mapping (same rig as screen-breakout) ---------- */
const FOV = 55, DIST = 10;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('gl').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, DIST);
scene.add(new THREE.HemisphereLight(0xffffff, 0x445, 1.15));
const dl = new THREE.DirectionalLight(0xfff2dd, 2.2); dl.position.set(3, 6, 7); scene.add(dl);
const dl2 = new THREE.DirectionalLight(0x88aaff, 0.7); dl2.position.set(-5, 2, 4); scene.add(dl2);

function pxToWorld(px, py) {
  const h = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const w = h * camera.aspect;
  return new THREE.Vector3((px / window.innerWidth - 0.5) * w, (0.5 - py / window.innerHeight) * h, 0);
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  placeAt(anchorPx.x, anchorPx.y);
});

/* ---------- shadow blob ---------- */
function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, THEME.shadowInner); grad.addColorStop(1, THEME.shadowOuter);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })
);
scene.add(blob);

/* ---------- companion ---------- */
const rig = new THREE.Group();       // positioned at the anchor (feet)
const inner = new THREE.Group();     // procedural motion (duck / shake / breathe)
rig.add(inner); scene.add(rig);
let mixer = null, clips = {}, current = null, headBone = null, modelH = 1;
let anchorPx = { x: window.innerWidth * 0.72, y: window.innerHeight * 0.90 };
let heightWorld = 2.0;

function findClip(name) {
  const key = Object.keys(clips).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? clips[key] : null;
}
function playClip(name, { loop = false, fade = 0.35 } = {}) {
  const clip = findClip(name); if (!clip || !mixer) return null;
  const action = mixer.clipAction(clip);
  action.reset();
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  action.clampWhenFinished = !loop;
  action.enabled = true;
  if (current && current !== action) { action.fadeIn(fade); current.fadeOut(fade); }
  action.play();
  current = action;
  return action;
}
function toIdle() { playClip(THEME.clips.idle, { loop: true, fade: 0.4 }); }

/* True on-screen height of a skinned model: Box3.setFromObject ignores
   skinning and reads raw geometry bounds (wildly wrong for this rig), so
   measure via SkinnedMesh.computeBoundingBox after a mixer step. */
function measureModel(root) {
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (o.isSkinnedMesh) { o.computeBoundingBox(); tmp.copy(o.boundingBox).applyMatrix4(o.matrixWorld); box.union(tmp); }
    else if (o.isMesh && o.geometry) { o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(tmp); }
  });
  return box;
}

new GLTFLoader().load(THEME.model, gltf => {
  const model = gltf.scene;
  inner.add(model);
  model.traverse(o => { if (o.isBone && /head/i.test(o.name) && !headBone) headBone = o; });
  mixer = new THREE.AnimationMixer(model);
  gltf.animations.forEach(a => { clips[a.name] = a; });
  toIdle();
  mixer.update(0.05); // settle into the Idle pose before measuring
  const bb = measureModel(model);
  modelH = bb.getSize(new THREE.Vector3()).y || 1;
  model.position.y = -bb.min.y; // feet on the rig origin
  placeAt(anchorPx.x, anchorPx.y);
  $('loadmsg').style.display = 'none';
  toast(THEME.texts.ready);
}, undefined, err => {
  console.error(err);
  $('loadmsg').textContent = THEME.texts.loadFail;
  toast(THEME.texts.modelFailed);
});

function placeAt(px, py) {
  anchorPx = { x: px, y: py };
  const w = pxToWorld(px, py);
  rig.position.set(w.x, w.y, 0);
  heightWorld = 1.15 + (py / window.innerHeight) * 1.75; // lower on screen = closer = bigger
  const k = heightWorld / modelH;
  rig.scale.setScalar(k);
  blob.position.set(w.x, w.y + 0.02, -0.05);
  blob.scale.set(heightWorld * 0.62, heightWorld * 0.20, 1);
}

/* ---------- reactions ---------- */
let duckAmt = 0, duckTarget = 0, duckHoldUntil = 0;
function duck(holdMs = 650) {
  duckTarget = 1; duckHoldUntil = performance.now() + holdMs;
}
let shakeUntil = 0;
let sleeping = false;
$('duckBtn').addEventListener('click', () => duck());
$('cheerBtn').addEventListener('click', () => {
  if (sleeping) return;
  const a = playClip(THEME.clips.cheer, { loop: true, fade: 0.25 });
  if (a) setTimeout(toIdle, 3800);
  else duck(300);
});
$('scaredBtn').addEventListener('click', () => {
  if (sleeping) return;
  shakeUntil = performance.now() + 950;
  const a = playClip(THEME.clips.scared, { loop: false, fade: 0.15 });
  if (a) setTimeout(toIdle, 1100);
});
$('sleepBtn').addEventListener('click', function () {
  sleeping = !sleeping;
  this.innerHTML = sleeping ? '⏰<br>WAKE' : '😴<br>SLEEP';
  this.classList.toggle('on', sleeping);
  $('dim').style.opacity = sleeping ? 0.16 : 0;
  if (sleeping) { playClip(THEME.clips.sleep, { loop: false, fade: 0.5 }); }
  else { const a = playClip(THEME.clips.wake, { loop: false, fade: 0.3 }); if (a) setTimeout(toIdle, 1300); else toIdle(); }
});

/* ---------- placement ---------- */
let placing = false;
$('placeBtn').addEventListener('click', function () {
  placing = !placing;
  this.classList.toggle('on', placing);
  if (placing) toast(THEME.texts.placeHint);
});
document.addEventListener('pointerup', e => {
  if (!placing || AR.isAligning()) return;
  if (e.target.closest('.bar') || e.target.closest('#ar-align-ui')) return;
  placing = false; $('placeBtn').classList.remove('on');
  placeAt(e.clientX, e.clientY);
  toast(THEME.texts.placed);
});
$('alignBtn').addEventListener('click', () => AR.setAlign(!AR.isAligning()));

/* ---------- mic-reactive auto-duck ---------- */
let micOn = false, micCtx = null, micAnalyser = null, micData = null, lastMicDuck = 0;
$('micBtn').addEventListener('click', async function () {
  if (micOn) { micOn = false; this.classList.remove('on'); toast(THEME.texts.micOff); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micCtx = AR.audio() || new (window.AudioContext || window.webkitAudioContext)();
    const src = micCtx.createMediaStreamSource(stream);
    micAnalyser = micCtx.createAnalyser(); micAnalyser.fftSize = 512;
    micData = new Uint8Array(micAnalyser.fftSize);
    src.connect(micAnalyser);
    micOn = true; this.classList.add('on');
    toast(THEME.texts.micOn);
  } catch (e) { toast(THEME.texts.micFail); }
});
function micCheck(now) {
  if (!micOn || !micAnalyser || sleeping) return;
  micAnalyser.getByteTimeDomainData(micData);
  let sum = 0;
  for (let i = 0; i < micData.length; i++) { const v = (micData[i] - 128) / 128; sum += v * v; }
  const rms = Math.sqrt(sum / micData.length);
  if (rms > 0.42 && now - lastMicDuck > 1400) { lastMicDuck = now; duck(700); }
}

/* ---------- idle life + main loop ---------- */
const clock = new THREE.Clock();
let lookTarget = 0, nextLook = 2;
const zzz = [$('z1'), $('z2')];
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  if (mixer) mixer.update(dt);

  // breathing
  inner.position.y = Math.sin(t * 1.7) * 0.008;
  inner.scale.y = 1 + Math.sin(t * 1.7) * 0.006;
  // look around
  if (headBone && !sleeping) {
    if (t > nextLook) { lookTarget = (Math.random() - 0.5) * 0.85; nextLook = t + 2.2 + Math.random() * 3; }
    headBone.rotation.y += (lookTarget - headBone.rotation.y) * Math.min(1, dt * 3);
  }
  // duck (procedural crouch + cover) — dip is in model-local units
  if (duckTarget === 1 && performance.now() > duckHoldUntil) duckTarget = 0;
  duckAmt += (duckTarget - duckAmt) * Math.min(1, dt * 14);
  inner.position.y += -duckAmt * 0.30 * modelH;
  inner.rotation.x = duckAmt * 0.28;
  if (headBone) headBone.rotation.x = duckAmt * 0.55;
  // scared shake
  if (performance.now() < shakeUntil) {
    inner.position.x = (Math.random() - 0.5) * 0.045;
  } else inner.position.x = 0;
  // sleeping Zzz floaters drift up from the head
  const viewH = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const headPxY = anchorPx.y - (heightWorld / viewH) * window.innerHeight;
  zzz.forEach((z, i) => {
    if (!sleeping) { z.style.opacity = 0; return; }
    const ph = ((t * 0.35 + i * 0.5) % 1);
    z.style.left = (anchorPx.x + 26 + ph * 26) + 'px';
    z.style.top = (headPxY - 8 - ph * 64) + 'px';
    z.style.opacity = (0.9 * (1 - ph)).toFixed(2);
    z.style.fontSize = (20 + ph * 22) + 'px';
  });
  micCheck(performance.now());
  renderer.render(scene, camera);
}
loop();
