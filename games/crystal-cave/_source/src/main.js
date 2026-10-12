// Crystal Cave 2.5D: flat 2D tile game logic, rendered inside a lit 3D world.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LEVEL } from './level.js';
import { buildWorld, buildGate } from './world.js';
import { heroSheet, beetleSheet } from './sprites.js';
import { dotTexture, shadowTexture } from './textures.js';

const Q = new URLSearchParams(location.search);
const BOT = Q.has('bot');
const H = LEVEL.length, W = LEVEL[0].length;
const grid = LEVEL.map((r) => r.split(''));
const tileAt = (tx, ty) => { const r = H - 1 - ty; if (tx < 0 || tx >= W) return '#'; if (r >= H) return ' '; if (r < 0) return '#'; return grid[r][tx]; };
const SOLID = new Set(['#', 'C', 'P', 'B', '?', 'U']);
const solid = (tx, ty) => SOLID.has(tileAt(tx, ty));

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.info.autoReset = false;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#030816');
scene.fog = new THREE.Fog('#0a2148', 30, 80);
const spriteScene = new THREE.Scene(); // sprites render after bloom (crisp), still depth-tested against the world
const FOV = 25;
const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 200);

// lights: key, coloured rim/back, ambient fill, pooled crystal point lights, hero light
scene.add(new THREE.HemisphereLight('#5d7dff', '#1a0d33', 1.1));
const key = new THREE.DirectionalLight('#d8ebff', 2.2); key.position.set(-6, 10, 12); scene.add(key);
const rim = new THREE.DirectionalLight('#ff4fd8', 3.0); rim.position.set(5, 7, -10); scene.add(rim);
const fill = new THREE.DirectionalLight('#3fb8ff', 0.8); fill.position.set(8, -3, 6); scene.add(fill);
const crystalLights = [0, 1, 2, 3].map((i) => { const l = new THREE.PointLight(i % 2 ? '#38e8ff' : '#ff3ccf', 9, 7.5, 1.3); scene.add(l); return l; });
const heroLight = new THREE.PointLight('#7fe9ff', 5, 5.5, 1.4); scene.add(heroLight);

const world = buildWorld(scene, LEVEL);
const portal = buildGate(scene, world.goal[0] + 0.5, world.goal[1]);

// ---------------------------------------------------------------- post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.72, 0.5, 0.9);
composer.addPass(bloom);
const spritePass = new RenderPass(spriteScene, camera); spritePass.clear = false; spritePass.clearDepth = false;
composer.addPass(spritePass);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.9 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; varying vec2 vUv;
    void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb;
      float l=dot(c,vec3(0.299,0.587,0.114));
      c=mix(vec3(l),c,1.12);                         // a touch more saturation
      c=c*vec3(0.98,1.0,1.04)+vec3(0.0,0.006,0.02)*(1.0-l); // cool lift in the shadows
      c=pow(max(c,0.0),vec3(0.95));                  // gentle midtone lift
      vec2 d=vUv-0.5; float v=1.0-dot(d,d)*uVig;     // subtle vignette
      gl_FragColor=vec4(c*v,1.0); }`,
});
composer.addPass(grade);

// ---------------------------------------------------------------- sprites
function sheetTex(cv, frames) { const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / frames, 1); return t; }
function spriteMesh(tex, size) {
  const g = new THREE.PlaneGeometry(size, size); g.translate(0, size / 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(0.97, 0.97, 0.97), fog: false }));
  spriteScene.add(m); return m;
}
const shadowTex = shadowTexture();
function blobShadow(w) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }));
  m.rotation.x = -Math.PI / 2; scene.add(m); return m;
}
const heroCanvas = heroSheet(), beetleCanvas = beetleSheet();
const heroTex = sheetTex(heroCanvas, 8);
const heroMesh = spriteMesh(heroTex, 1.6);
const heroShadow = blobShadow(1.1);

// ---------------------------------------------------------------- particles (one draw call)
const MAXP = 420;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pSize = new Float32Array(MAXP);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTex: { value: dotTexture() }, uScale: { value: 400 } },
  vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uScale/-mv.z; gl_Position=projectionMatrix*mv; }',
  fragmentShader: 'uniform sampler2D uTex; varying vec3 vC; void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(vC*t.a,1.0); }',
});
const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
const parts = [];
function emit(o) { if (parts.length >= MAXP) parts.shift(); parts.push(Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, max: 1, size: 0.2, r: 1, g: 1, b: 1, grav: 0, drag: 0, motes: false }, o, { max: o.life || 1 })); }
function sparkle(x, y, n = 14, col = [1.8, 1.5, 0.6]) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 3.5; emit({ x, y, z: 0.2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (Math.random() - 0.5) * 2, life: 0.35 + Math.random() * 0.35, size: 0.16 + Math.random() * 0.14, r: col[0], g: col[1], b: col[2], drag: 3 }); }
}
function dust(x, y, n = 8, strength = 1) {
  for (let i = 0; i < n; i++) { const d = i % 2 ? 1 : -1; emit({ x: x + d * 0.2, y: y + 0.05, z: 0.1 + (Math.random() - 0.5) * 0.6, vx: d * (1 + Math.random() * 2) * strength, vy: 0.4 + Math.random() * 1.2, vz: (Math.random() - 0.5), life: 0.4 + Math.random() * 0.3, size: 0.28 + Math.random() * 0.22, r: 0.35, g: 0.5, b: 0.75, drag: 4, grav: -1 }); }
}
// ambient floating glints
for (let i = 0; i < 70; i++) emit({ motes: true, x: Math.random() * W, y: 4 + Math.random() * 12, z: -6 + Math.random() * 8, vx: (Math.random() - 0.5) * 0.3, vy: 0.1 + Math.random() * 0.25, life: 1e9, size: 0.06 + Math.random() * 0.1, r: 0.3, g: 0.9 + Math.random() * 0.6, b: 1.6, ph: Math.random() * 6.28 });

// ---------------------------------------------------------------- audio (tiny synth blips, created on first input)
let actx = null;
function beep(f0, f1, dur, type = 'square', vol = 0.06) {
  if (!actx || BOT) return; const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
}
function unlockAudio() { if (!actx && !BOT) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } } }

// ---------------------------------------------------------------- input
const input = { left: false, right: false, jump: false, run: false, jumpQ: false };
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', KeyZ: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyX: 'run', ShiftLeft: 'run', ShiftRight: 'run' };
addEventListener('keydown', (e) => { const k = KEYMAP[e.code]; if (!k) { if (e.code === 'Enter' && state.won) restart(); return; } e.preventDefault(); unlockAudio(); if (k === 'jump' && !input.jump) input.jumpQ = true; input[k] = true; });
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) input[k] = false; });
for (const b of document.querySelectorAll('[data-k]')) {
  const k = b.dataset.k;
  const on = (e) => { e.preventDefault(); unlockAudio(); if (k === 'jump' && !input.jump) input.jumpQ = true; input[k] = true; b.classList.add('on'); };
  const off = (e) => { e.preventDefault(); input[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
}
addEventListener('blur', () => { input.left = input.right = input.jump = input.run = false; });

// ---------------------------------------------------------------- game state
const P = { // hero (x = centre, y = feet)
  x: 0, y: 0, w: 0.7, h: 1.3, vx: 0, vy: 0, onGround: false, face: 1, coyote: 0, buffer: 0, jumping: false,
  px: 0, py: 0, anim: 0, sq: 1, inv: 0, safeX: 0, safeY: 0, airT: 0,
};
const state = { coins: 0, total: world.coins.length + world.popSlots.length, hearts: 3, time: 0, won: false, winT: 0, stomps: 0, deaths: 0 };
const enemies = world.enemies.map(([x, y]) => {
  const tex = sheetTex(beetleCanvas, 3);
  return { x, y, w: 0.9, h: 0.7, vx: -1.6, vy: 0, px: x, py: y, dead: 0, alive: true, tex, mesh: spriteMesh(tex, 1.4), shadow: blobShadow(1.1), anim: Math.random() };
});
const pops = []; // coins popping out of rune blocks

function resetHero(x, y) { Object.assign(P, { x, y, px: x, py: y, vx: 0, vy: 0, onGround: false, jumping: false, coyote: 0, buffer: 0 }); }
function restart() {
  state.coins = 0; state.hearts = 3; state.time = 0; state.won = false; state.winT = 0;
  for (const c of world.coins) c.taken = false;
  resetHero(world.start[0], world.start[1]); P.safeX = P.x; P.safeY = P.y; P.face = 1;
  document.getElementById('win').classList.remove('show');
  portal.material.uniforms.uOpen.value = 1;
  hud();
}

// ---------------------------------------------------------------- 2D tile physics (AABB vs grid, X then Y)
const EPS = 1e-4;
function moveX(e, dt) {
  e.x += e.vx * dt; let hit = false;
  const b = Math.floor(e.y + EPS), t = Math.floor(e.y + e.h - EPS);
  if (e.vx > 0) { const tx = Math.floor(e.x + e.w / 2 - EPS); for (let ty = b; ty <= t; ty++) if (solid(tx, ty)) { e.x = tx - e.w / 2; hit = true; break; } }
  else if (e.vx < 0) { const tx = Math.floor(e.x - e.w / 2 + EPS); for (let ty = b; ty <= t; ty++) if (solid(tx, ty)) { e.x = tx + 1 + e.w / 2; hit = true; break; } }
  if (hit) e.vx = 0; return hit;
}
function moveY(e, dt) {
  e.y += e.vy * dt; e.onGround = false; let head = null;
  const l = Math.floor(e.x - e.w / 2 + EPS), r = Math.floor(e.x + e.w / 2 - EPS);
  if (e.vy <= 0) { const ty = Math.floor(e.y + EPS); for (let tx = l; tx <= r; tx++) if (solid(tx, ty) && e.y < ty + 1) { e.y = ty + 1; e.vy = 0; e.onGround = true; break; } }
  else { const ty = Math.floor(e.y + e.h - EPS); const hits = []; for (let tx = l; tx <= r; tx++) if (solid(tx, ty)) hits.push(tx); if (hits.length) { e.y = ty - e.h; e.vy = 0; head = { ty, tx: hits.sort((a, b2) => Math.abs(a + 0.5 - e.x) - Math.abs(b2 + 0.5 - e.x))[0] }; } }
  return head;
}

const C = { ACC: 55, ACC_AIR: 36, FRIC: 42, SKID: 95, WALK: 6.2, RUN: 9.4, G: 50, G_FALL: 62, G_CUT: 135, JUMP: 19.8, MAXFALL: 21, COYOTE: 0.1, BUFFER: 0.13 };

function bumpBlock(tx, ty) {
  const r = H - 1 - ty, b = world.blocks.find((k) => k.c === tx && k.r === r);
  if (!b) { dust(P.x, P.y + P.h, 3, 0.5); beep(160, 90, 0.06, 'triangle'); return; }
  b.bump = 1;
  if (b.type === '?' && !b.used) {
    b.used = true; grid[r][tx] = 'U';
    b.mesh.material.map = b.usedMap; b.mesh.material.emissiveIntensity = 0; b.mesh.material.needsUpdate = true;
    pops.push({ x: tx + 0.5, y: ty + 1, vy: 11, t: 0, slot: world.popSlots.shift() });
    beep(988, 1319, 0.12, 'square', 0.05);
  } else { dust(tx + 0.5, ty, 6, 0.8); beep(220, 120, 0.08, 'triangle'); }
  // bumping a block knocks out an enemy standing on it
  for (const e of enemies) if (e.alive && !e.dead && Math.abs(e.x - (tx + 0.5)) < 0.8 && Math.abs(e.y - (ty + 1)) < 0.2) killEnemy(e);
}
function killEnemy(e) { e.dead = 0.5; e.vx = 0; state.stomps++; sparkle(e.x, e.y + 0.4, 18, [1.8, 0.5, 1.7]); beep(660, 220, 0.15, 'square', 0.06); }
function hurt() {
  if (P.inv > 0) return; state.hearts--; P.inv = 1.4; P.vy = 11; P.vx = -P.face * 6; beep(300, 80, 0.3, 'sawtooth', 0.05); shake = 0.25;
  if (state.hearts <= 0) { state.deaths++; state.hearts = 3; resetHero(world.start[0], world.start[1]); }
  hud();
}

// ---------------------------------------------------------------- bot (for automated testing: ?bot)
const botS = { hold: 0, lastX: 0, stuck: 0, log: [] };
function botThink(dt) {
  input.right = true; input.left = false; input.run = true; input.jumpQ = false;
  const fx = Math.floor(P.x + 0.95), feet = Math.floor(P.y + EPS);
  const wall = solid(fx, feet) || solid(fx, feet + 1);
  const gapAhead = P.onGround && !solid(Math.floor(P.x + 0.75), feet - 1) && !solid(Math.floor(P.x + 1.6), feet - 1);
  const enemyAhead = enemies.some((e) => e.alive && !e.dead && e.x > P.x && e.x - P.x < 3.2 && Math.abs(e.y - P.y) < 1.2);
  if (Math.abs(P.x - botS.lastX) < 0.01 && P.onGround) botS.stuck += dt; else botS.stuck = 0; botS.lastX = P.x;
  if (P.onGround && botS.hold <= 0 && (wall || gapAhead || enemyAhead || botS.stuck > 0.25)) { input.jumpQ = true; botS.hold = 0.42; botS.log.push(`j@${P.x.toFixed(1)}${wall ? 'w' : ''}${gapAhead ? 'g' : ''}${enemyAhead ? 'e' : ''}`); }
  if (botS.hold > 0) { botS.hold -= dt; input.jump = true; } else input.jump = false;
}

// ---------------------------------------------------------------- fixed 60 Hz step
const DT = 1 / 60;
let shake = 0;
function step() {
  if (BOT && !state.won) botThink(DT);
  P.px = P.x; P.py = P.y;
  for (const e of enemies) { e.px = e.x; e.py = e.y; }
  if (!state.won) state.time += DT;

  // --- hero horizontal: run acceleration with skid + friction
  const dir = state.won ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const max = input.run ? C.RUN : C.WALK;
  if (dir) {
    const acc = (P.onGround ? C.ACC : C.ACC_AIR) * (Math.sign(P.vx) === -dir ? C.SKID / C.ACC : 1);
    P.vx += dir * acc * DT; if (Math.abs(P.vx) > max) P.vx = Math.sign(P.vx) * Math.max(max, Math.abs(P.vx) - C.FRIC * DT);
    P.face = dir;
    if (P.onGround && Math.sign(P.vx) === -dir && Math.abs(P.vx) > 3 && Math.random() < 0.5) dust(P.x, P.y, 1, 0.6);
  } else {
    const f = (P.onGround ? C.FRIC : 8) * DT; P.vx = Math.abs(P.vx) <= f ? 0 : P.vx - Math.sign(P.vx) * f;
  }
  if (state.won) { P.vx = (world.goal[0] + 0.5 - P.x) * 4; }

  // --- jump: buffer + coyote + variable height
  if (input.jumpQ) { P.buffer = C.BUFFER; input.jumpQ = false; }
  P.coyote = P.onGround ? C.COYOTE : Math.max(0, P.coyote - DT);
  P.buffer = Math.max(0, P.buffer - DT);
  if (P.buffer > 0 && P.coyote > 0 && !state.won) {
    P.vy = C.JUMP + Math.abs(P.vx) * 0.12; P.buffer = 0; P.coyote = 0; P.jumping = true; P.sq = 1.25;
    dust(P.x, P.y, 4, 0.6); beep(420, 840, 0.1, 'square', 0.04);
  }
  let g = P.vy > 0 ? (input.jump && P.jumping ? C.G : C.G_CUT) : C.G_FALL;
  P.vy = Math.max(-C.MAXFALL, P.vy - g * DT);
  if (P.vy <= 0) P.jumping = false;

  const wasGround = P.onGround, fallV = P.vy;
  moveX(P, DT);
  const head = moveY(P, DT);
  if (head) { bumpBlock(head.tx, head.ty); P.jumping = false; }
  if (P.onGround && !wasGround) { // landing: dust puff + squash
    const s = Math.min(1, -fallV / 18); P.sq = 1 - 0.28 * s; if (s > 0.3) { dust(P.x, P.y, 6 + (s * 8 | 0), 0.6 + s); beep(120, 60, 0.05, 'triangle', 0.04); }
  }
  if (P.onGround) {
    P.airT = 0;
    if (solid(Math.floor(P.x - 0.3), Math.floor(P.y) - 1) && solid(Math.floor(P.x + 0.3), Math.floor(P.y) - 1)) { P.safeX = P.x; P.safeY = P.y; }
  } else P.airT += DT;
  P.sq += (1 - P.sq) * 0.18;
  P.inv = Math.max(0, P.inv - DT);
  if (P.y < -2) { state.hearts--; shake = 0.2; beep(400, 60, 0.4, 'sawtooth', 0.05); if (state.hearts <= 0) { state.deaths++; state.hearts = 3; resetHero(world.start[0], world.start[1]); } else resetHero(P.safeX - P.face * 0.6, P.safeY); P.inv = 1.2; hud(); }

  // --- coins
  for (const c of world.coins) if (!c.taken && Math.abs(c.x - P.x) < 0.35 + 0.3 && c.y > P.y - 0.3 && c.y < P.y + P.h + 0.3) {
    c.taken = true; state.coins++; sparkle(c.x, c.y); beep(1319, 1976, 0.09, 'square', 0.04); hud();
  }
  for (const p of pops) { p.t += DT; p.y += p.vy * DT; p.vy -= 32 * DT; if (p.t > 0.5 && !p.done) { p.done = true; state.coins++; sparkle(p.x, p.y); hud(); } }

  // --- enemies: walk, turn at walls and ledges, stompable
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.dead) { e.dead -= DT; if (e.dead <= 0) { e.alive = false; e.mesh.visible = false; e.shadow.visible = false; sparkle(e.x, e.y + 0.3, 10, [0.6, 1.6, 1.9]); } continue; }
    e.vy = Math.max(-C.MAXFALL, e.vy - C.G_FALL * DT);
    const sp = e.vx;
    if (moveX(e, DT)) e.vx = -sp;
    moveY(e, DT);
    const ahead = Math.floor(e.x + Math.sign(e.vx) * (e.w / 2 + 0.05));
    if (e.onGround && !solid(ahead, Math.floor(e.y + EPS) - 1)) e.vx = -e.vx;
    e.anim += DT;
    // hero contact
    if (Math.abs(e.x - P.x) < (e.w + P.w) / 2 && P.y < e.y + e.h && P.y + P.h > e.y) {
      if (P.vy < 0 && P.py >= e.y + e.h * 0.45) { killEnemy(e); P.vy = input.jump ? 17 : 12; P.jumping = input.jump; P.sq = 1.3; shake = 0.08; }
      else hurt();
    }
  }

  // --- goal
  const gx = world.goal[0] + 0.5;
  if (!state.won && P.x > gx - 1.0 && P.y < world.goal[1] + 4.5 && P.y >= world.goal[1] - 0.1) {
    state.won = true; state.winT = 0; sparkle(gx, P.y + 1, 40, [0.6, 1.6, 2.0]); beep(523, 1046, 0.5, 'triangle', 0.06);
    setTimeout(() => { const w = document.getElementById('win'); w.querySelector('.stats').textContent = `${state.coins}/${state.total} coins  ·  ${state.time.toFixed(1)} s  ·  ${state.stomps} beetles stomped`; w.classList.add('show'); }, 700);
    window.__done = true;
  }
  if (state.won) state.winT += DT;

  // --- particles
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    if (q.motes) { q.ph += DT; q.x += q.vx * DT + Math.sin(q.ph) * 0.004; q.y += q.vy * DT; if (q.y > 17) { q.y = 3.5; q.x = camX + (Math.random() - 0.5) * 30; } continue; }
    q.life -= DT; if (q.life <= 0) { parts.splice(i, 1); continue; }
    const d = Math.max(0, 1 - q.drag * DT); q.vx *= d; q.vy *= d; q.vz *= d; q.vy -= q.grav * DT; // grav<0 floats up
    q.x += q.vx * DT; q.y += q.vy * DT; q.z += q.vz * DT;
  }
  shake = Math.max(0, shake - DT);
  stepCamera();
}

// ---------------------------------------------------------------- camera: deadzone + look-ahead
let camX = 0, camY = 8, look = 0, camYT = 8, dist = 26, halfW = 10, halfH = 6, portrait = false;
function stepCamera() {
  if (Math.abs(P.vx) > 1) look += (Math.sign(P.vx) * Math.min(2.4, halfW * 0.28) - look) * 0.035;
  const DZ = 0.8, tx = P.x + look;
  if (tx > camX + DZ) camX += (tx - DZ - camX) * 0.14; else if (tx < camX - DZ) camX += (tx + DZ - camX) * 0.14;
  const off = portrait ? -2.2 : 1.4;
  if (P.onGround || P.y + off < camYT - 2.5 || P.y + off > camYT + 2.2) camYT = P.y + off;
  camY += (camYT - camY) * 0.06;
  camX = Math.min(Math.max(camX, halfW + 0.6), W - halfW - 0.6);
  if (W - 1.2 < halfW * 2) camX = W / 2;
  camY = Math.min(Math.max(camY, halfH - (portrait ? 5 : 2.2)), H - halfH + 1.5);
}
function resize() {
  const w = innerWidth, h = innerHeight; const asp = w / h; portrait = asp < 0.9;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = asp;
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  dist = Math.max(11.5 / (2 * t), (portrait ? 11 : 15) / (2 * t * asp));
  camera.near = 2; camera.far = dist + 120; camera.updateProjectionMatrix();
  halfH = dist * t; halfW = halfH * asp;
  scene.fog.near = dist + 2; scene.fog.far = dist + 55;
  pMat.uniforms.uScale.value = renderer.domElement.height / (2 * t);
}
addEventListener('resize', resize);

// ---------------------------------------------------------------- render (interpolated)
const coinM = new THREE.Matrix4(), coinQ = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), S0 = new THREE.Vector3(0, 0, 0);
function groundBelow(x, y) { for (let ty = Math.floor(y + EPS) - (Math.abs(y - Math.round(y)) < 0.01 ? 1 : 0); ty > y - 8 && ty >= 0; ty--) if (solid(Math.floor(x), ty)) return ty + 1; return null; }
function placeShadow(m, x, y, z, w) {
  const gy = groundBelow(x, y + 0.01); if (gy === null) { m.visible = false; return; }
  const h = y - gy; m.visible = h < 6; m.position.set(x, gy + 0.02, z); const s = Math.max(0.3, 1 - h * 0.15); m.scale.set(s * w, s * w, 1); m.material.opacity = 0.75 * s;
}
let tAcc = 0, last = performance.now(), frames = 0, fps = 0, fpsT = 0, elapsed = 0;
function render(alpha, dtReal) {
  elapsed += dtReal;
  const hx = P.px + (P.x - P.px) * alpha, hy = P.py + (P.y - P.py) * alpha;
  // hero frame selection
  let frame;
  if (!P.onGround) frame = P.vy > 0 ? 6 : 7;
  else if (Math.abs(P.vx) > 0.4) { P.anim += dtReal * (6 + Math.abs(P.vx) * 1.4); frame = 2 + (Math.floor(P.anim) % 4); }
  else { P.anim += dtReal * 2.2; frame = Math.floor(P.anim) % 2; }
  heroTex.offset.x = frame / 8;
  heroMesh.position.set(hx, hy - 0.04, 0);
  const stretch = P.sq; heroMesh.scale.set(P.face * (2 - stretch) * 1, stretch, 1);
  heroMesh.visible = !(P.inv > 0 && Math.floor(elapsed * 20) % 2) || state.won;
  if (state.won) { const k = Math.max(0, 1 - state.winT * 0.9); heroMesh.scale.multiplyScalar(Math.max(0.01, k)); heroMesh.position.z = -0.4; portal.material.uniforms.uOpen.value = 1 + state.winT; }
  placeShadow(heroShadow, hx, hy, 0, 1.1);
  heroLight.position.set(hx, hy + 1.2, 1.6);

  for (const e of enemies) {
    if (!e.alive) continue;
    const ex = e.px + (e.x - e.px) * alpha, ey = e.py + (e.y - e.py) * alpha;
    e.tex.offset.x = (e.dead ? 2 : Math.floor(e.anim * 7) % 2) / 3;
    e.mesh.position.set(ex, ey - 0.1, 0.05); e.mesh.scale.set(e.vx > 0 ? 1 : -1, 1, 1);
    placeShadow(e.shadow, ex, ey, 0.05, 1.2);
  }
  // blocks bump animation
  for (const b of world.blocks) {
    if (b.bump > 0) b.bump = Math.max(0, b.bump - dtReal * 6);
    b.mesh.position.y = (H - 1 - b.r) + 0.5 + Math.sin(b.bump * Math.PI) * 0.3;
    if (!b.used && b.type === '?') b.mesh.material.emissiveIntensity = 3 + Math.sin(elapsed * 4 + b.c) * 1.0;
  }
  // coins (instanced)
  const spin = elapsed * 3.2;
  for (const c of world.coins) {
    coinQ.setFromAxisAngle(V.set(0, 1, 0), spin + c.x * 0.4);
    coinM.compose(V.set(c.x, c.y + Math.sin(elapsed * 2.5 + c.x) * 0.06, 0), coinQ, c.taken ? S0 : S1);
    world.coinMesh.setMatrixAt(c.i, coinM);
  }
  const allSlots = world.coins.length + (state.total - world.coins.length);
  for (let k = world.coins.length; k < allSlots; k++) { coinM.compose(V.set(0, -50, 0), coinQ, S0); world.coinMesh.setMatrixAt(k, coinM); }
  for (const p of pops) if (!p.done) { coinQ.setFromAxisAngle(V.set(0, 1, 0), elapsed * 14); coinM.compose(V.set(p.x, p.y, 0), coinQ, S1); world.coinMesh.setMatrixAt(p.slot, coinM); }
  world.coinMesh.instanceMatrix.needsUpdate = true;
  // particles -> buffers
  let n = 0;
  for (const q of parts) {
    if (q.motes && Math.abs(q.x - camX) > halfW + 6) continue;
    const f = q.motes ? (0.6 + 0.4 * Math.sin(q.ph * 2)) : Math.min(1, q.life / q.max * 1.6);
    pPos[n * 3] = q.x; pPos[n * 3 + 1] = q.y; pPos[n * 3 + 2] = q.z;
    pCol[n * 3] = q.r * f; pCol[n * 3 + 1] = q.g * f; pCol[n * 3 + 2] = q.b * f; pSize[n] = q.size; n++;
  }
  pGeo.setDrawRange(0, n); pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = pGeo.attributes.size.needsUpdate = true;
  // pooled crystal lights: the 4 crystal spots nearest the camera centre
  const spots = world.crystalSpots.slice().sort((a, b) => Math.abs(a[0] - camX) - Math.abs(b[0] - camX));
  crystalLights.forEach((l, i) => { const s = spots[i * 2] || spots[i]; if (s) l.position.set(s[0], s[1] + 0.9, 1.7); l.intensity = 5 + Math.sin(elapsed * 2 + i) * 1.2; });
  portal.material.uniforms.uT.value = elapsed;
  // camera
  const sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.8 : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.8 : 0;
  camera.position.set(camX + sx + Math.sin(elapsed * 0.4) * 0.08, camY + 2.4 + sy, dist);
  camera.lookAt(camX + sx, camY + sy - 0.2, 0);
  renderer.info.reset(); composer.render();
}

function hud() {
  document.getElementById('coins').textContent = `${state.coins}/${state.total}`;
  document.getElementById('hearts').innerHTML = '<i class="h"></i>'.repeat(state.hearts) + '<i class="h e"></i>'.repeat(3 - state.hearts);
}

function frame(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000); last = now;
  tAcc += dtReal; let steps = 0;
  const maxSteps = BOT ? 10 : 6;
  while (tAcc >= DT && steps < maxSteps) { step(); tAcc -= DT; steps++; }
  if (steps === maxSteps) tAcc = 0;
  document.getElementById('time').textContent = state.time.toFixed(1);
  render(tAcc / DT, dtReal);
  frames++; fpsT += dtReal; if (fpsT > 1) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  requestAnimationFrame(frame);
}

document.getElementById('again').addEventListener('click', restart);
resize(); restart();
camX = P.x + 3; camY = camYT = P.y + (portrait ? -2.2 : 1.4); stepCamera();
requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
document.getElementById('load').classList.add('gone');

// test hooks
window.__game = { state, P, enemies, bot: botS, get fps() { return fps; }, get calls() { return renderer.info.render.calls; }, renderer, camera, setPos: (x, y) => { resetHero(x, y); camX = x; camY = camYT = y + 1.4; }, get cam() { return { camX, camY, camYT, dist, halfW, halfH }; } };
