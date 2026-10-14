'use strict';
/* ==========================================================================
   CALIFORNIA GAMES REMASTERED — Hark Edition (unofficial fan remake)
   Single file, Canvas 2D, procedural art + Web Audio. No external assets.
   Art direction: painted 2D on a restrained 32-colour 16-bit base; H toggles a
   real low-res render with palette snap (WebGL pass), default off.
   ========================================================================== */
const TAU = Math.PI * 2, STEP = 1 / 60;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));
const sgn = v => v < 0 ? -1 : 1;
function wrapA(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
let rngS = 1;
function rng() { rngS = (rngS * 1664525 + 1013904223) >>> 0; return rngS / 4294967296; }
function srand(s) { rngS = s >>> 0 || 1; }
// Restrained 32-colour palette (also the 16-bit snap palette)
const PAL = ['#1a0f24','#2c1642','#4a1f4f','#8c225d','#ff3f8e','#ff5e57','#ff8a3d','#ffbe55',
             '#ffdd59','#fff2c4','#ffffff','#f7d794','#eab56f','#c98849','#9c5533','#5c3828',
             '#7af5e0','#00d2d3','#00a8a8','#0a6e7a','#073b4c','#6ec6ff','#3a7bd5','#269e79',
             '#16695b','#7a8b3a','#d1d8e0','#8a8fa3','#57606f','#2f3640','#e59866','#b5653f'];
const C = { ink:PAL[0], night:PAL[1], plum:PAL[2], mag:PAL[3], pink:PAL[4], coral:PAL[5], orange:PAL[6], gold:PAL[7],
  yel:PAL[8], cream:PAL[9], white:PAL[10], sandL:PAL[11], sand:PAL[12], sandD:PAL[13], brown:PAL[14], brownD:PAL[15],
  tealL:PAL[16], teal:PAL[17], sea:PAL[18], seaD:PAL[19], navy:PAL[20], sky:PAL[21], blue:PAL[22], palm:PAL[23],
  palmD:PAL[24], olive:PAL[25], greyL:PAL[26], grey:PAL[27], slate:PAL[28], slateD:PAL[29], skin:PAL[30], skinD:PAL[31] };

/* ---------------- canvas / view ---------------- */
const cv = document.getElementById('cv');           // WebGL (three.js) scene
const hudCv = document.getElementById('hud');       // 2D HUD overlay
const hg = hudCv.getContext('2d');
const V = { W: 800, H: 450, dpr: 1, portrait: false, touch: false, P: { x: 0, y: 0, w: 800, h: 450, cx: 400, cy: 225 }, top: 60, bot: 0 };
const isTouchDev = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(hover: hover)').matches);
V.embed = document.documentElement.classList.contains('demo-embed');
V.touch = isTouchDev && !V.embed; // inside the demo shell its own controls replace ours
function resize() {
  V.W = Math.max(200, window.innerWidth); V.H = Math.max(200, window.innerHeight);
  V.dpr = Math.min(window.devicePixelRatio || 1, V.touch ? 1.5 : 1.25);
  hudCv.width = Math.round(V.W * V.dpr); hudCv.height = Math.round(V.H * V.dpr);
  V.portrait = V.H > V.W * 1.05;
  // HUD band on top; control band at the bottom when touch controls show; the action frames the middle
  V.top = V.portrait ? Math.round(V.H * 0.12) : Math.round(Math.max(56, V.H * 0.1));
  V.bot = V.touch ? (V.portrait ? Math.round(V.H * 0.25) : Math.round(V.H * 0.08)) : 0;
  const P = V.P; P.x = 0; P.y = V.top; P.w = V.W; P.h = V.H - V.top - V.bot; P.cx = P.w / 2; P.cy = P.y + P.h / 2;
  if (typeof onResize === 'function') onResize();
}

/* ---------------- input ----------------
   Human sources (keyboard, touch, gamepad) and the attract-mode bot write to separate
   buffers. The sim reads one of them per fixed step; edges are latched so a tap shorter
   than a step is never lost. Handing over from the bot clears both buffers. */
const KEYS = ['up','down','left','right','a','b','c'];
function mkBuf() { const o = {}; for (const k of KEYS) { o[k] = false; } return o; }
const human = { key: mkBuf(), touch: mkBuf(), pad: mkBuf(), latch: mkBuf(), rel: mkBuf() };
const bot = { held: mkBuf(), latch: mkBuf(), rel: mkBuf() };
const In = { held: mkBuf(), p: mkBuf(), r: mkBuf(), ax: 0, ay: 0 }; // what the sim sees this step
const prevHeld = mkBuf();
let stickAX = 0, stickAY = 0;
function humanHeld(k) { return human.key[k] || human.touch[k] || human.pad[k]; }
function clearHuman() { for (const k of KEYS) { human.key[k] = human.touch[k] = human.pad[k] = human.latch[k] = human.rel[k] = false; } stickAX = stickAY = 0; }
function clearBot() { for (const k of KEYS) { bot.held[k] = bot.latch[k] = bot.rel[k] = false; } }
function clearIn() { for (const k of KEYS) { In.held[k] = In.p[k] = In.r[k] = prevHeld[k] = false; } In.ax = In.ay = 0; }
function sampleInput(useBot) {
  for (const k of KEYS) {
    let h, l, r;
    if (useBot) { h = bot.held[k]; l = bot.latch[k]; r = bot.rel[k]; bot.latch[k] = false; bot.rel[k] = false; }
    else { h = humanHeld(k); l = human.latch[k]; r = human.rel[k]; human.latch[k] = false; human.rel[k] = false; }
    In.p[k] = (h && !prevHeld[k]) || l;
    In.r[k] = (!h && prevHeld[k]) || r;
    In.held[k] = h || l;
    prevHeld[k] = h;
  }
  if (useBot) { In.ax = (bot.held.right ? 1 : 0) - (bot.held.left ? 1 : 0); In.ay = (bot.held.down ? 1 : 0) - (bot.held.up ? 1 : 0); }
  else {
    In.ax = stickAX || ((In.held.right ? 1 : 0) - (In.held.left ? 1 : 0));
    In.ay = stickAY || ((In.held.down ? 1 : 0) - (In.held.up ? 1 : 0));
  }
}
function humanPress(k) { if (!humanHeld(k)) human.latch[k] = true; }
function humanRelease(k) { human.rel[k] = true; }
const KEYMAP = { ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down', ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right',
  KeyZ:'a', Space:'a', Enter:'a', KeyJ:'a', KeyX:'b', KeyK:'b', KeyC:'c', KeyL:'c' };
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const k = KEYMAP[e.code];
  const menuOpen = !!document.querySelector('.ui.on');
  if (!menuOpen && (k || e.code === 'Space')) e.preventDefault();
  if (e.repeat) return;
  anyUserInput('key');
  if (menuOpen) { if (e.code === 'KeyM') Audio.toggleMute(); else if (e.code === 'KeyH') toggle16(); else if (e.code === 'KeyP' || e.code === 'Escape') Game.togglePause(); return; }
  if (e.code === 'KeyH') { toggle16(); return; }
  if (e.code === 'KeyM') { Audio.toggleMute(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { Game.togglePause(); return; }
  if (k) { humanPress(k); human.key[k] = true; }
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) { human.key[k] = false; humanRelease(k); } });
window.addEventListener('blur', () => { clearHuman(); });
document.addEventListener('visibilitychange', () => {
  clearHuman();
  if (document.hidden) { Game.autoPause(); Audio.suspend(); } else Audio.resume();
});
// --- touch: floating stick + buttons (pointer events, captured) ---
const elTouch = document.getElementById('touch'), stickZone = document.getElementById('stickzone');
const stickBase = document.getElementById('stickbase'), stickKnob = document.getElementById('stickknob');
let stickId = -1, stickOX = 0, stickOY = 0;
function setStickDirs(ax, ay) {
  const dz = 0.38;
  const nu = ay < -dz, nd = ay > dz, nl = ax < -dz, nr = ax > dz;
  if (nu && !human.touch.up) humanPress('up'); if (!nu && human.touch.up) humanRelease('up');
  if (nd && !human.touch.down) humanPress('down'); if (!nd && human.touch.down) humanRelease('down');
  if (nl && !human.touch.left) humanPress('left'); if (!nl && human.touch.left) humanRelease('left');
  if (nr && !human.touch.right) humanPress('right'); if (!nr && human.touch.right) humanRelease('right');
  human.touch.up = nu; human.touch.down = nd; human.touch.left = nl; human.touch.right = nr;
  stickAX = Math.abs(ax) > dz ? ax : 0; stickAY = Math.abs(ay) > dz ? ay : 0;
}
stickZone.addEventListener('pointerdown', e => {
  e.preventDefault(); anyUserInput('touch');
  if (stickId !== -1) return;
  stickId = e.pointerId; stickZone.setPointerCapture(e.pointerId);
  stickOX = e.clientX; stickOY = e.clientY;
  stickBase.classList.add('act'); stickBase.style.left = e.clientX + 'px'; stickBase.style.top = e.clientY + 'px';
  stickKnob.style.transform = 'translate(0px,0px)';
});
stickZone.addEventListener('pointermove', e => {
  if (e.pointerId !== stickId) return;
  let dx = e.clientX - stickOX, dy = e.clientY - stickOY; const m = Math.hypot(dx, dy), R = 56;
  if (m > R) { dx *= R / m; dy *= R / m; }
  stickKnob.style.transform = 'translate(' + dx.toFixed(0) + 'px,' + dy.toFixed(0) + 'px)';
  setStickDirs(dx / R, dy / R);
});
function stickEnd(e) { if (e.pointerId !== stickId) return; stickId = -1; stickBase.classList.remove('act'); stickBase.style.left = ''; stickBase.style.top = ''; stickKnob.style.transform = ''; setStickDirs(0, 0); }
stickZone.addEventListener('pointerup', stickEnd); stickZone.addEventListener('pointercancel', stickEnd); stickZone.addEventListener('lostpointercapture', stickEnd);
const TB = { a: document.getElementById('tbA'), b: document.getElementById('tbB'), c: document.getElementById('tbC') };
for (const k of ['a','b','c']) {
  const el = TB[k];
  el.addEventListener('pointerdown', e => { e.preventDefault(); anyUserInput('touch'); el.setPointerCapture(e.pointerId); humanPress(k); human.touch[k] = true; el.classList.add('down'); });
  const up = e => { if (!human.touch[k]) return; human.touch[k] = false; humanRelease(k); el.classList.remove('down'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
document.addEventListener('contextmenu', e => e.preventDefault());
// tapping the canvas itself counts as "A" in non-play screens (title/ready cards)
cv.addEventListener('pointerdown', e => { anyUserInput(e.pointerType === 'mouse' ? 'mouse' : 'touch'); Game.canvasTap(); });
function showTouch(on) { elTouch.classList.toggle('on', !!on && V.touch); }
function setTouchLabels(a, b, c) {
  TB.a.textContent = a || 'A'; TB.a.classList.toggle('off', !a);
  TB.b.textContent = b || 'B'; TB.b.classList.toggle('off', !b);
  TB.c.textContent = c || 'C'; TB.c.classList.toggle('off', !c);
}
// --- gamepad ---
function pollPad() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads(); const gp = pads && pads[0];
  if (!gp || !gp.connected) return;
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, B = gp.buttons;
  const want = { up: ay < -0.4 || (B[12] && B[12].pressed), down: ay > 0.4 || (B[13] && B[13].pressed), left: ax < -0.4 || (B[14] && B[14].pressed),
    right: ax > 0.4 || (B[15] && B[15].pressed), a: !!(B[0] && B[0].pressed), b: !!((B[2] && B[2].pressed) || (B[1] && B[1].pressed)), c: !!(B[3] && B[3].pressed) };
  for (const k of KEYS) {
    const w = !!want[k];
    if (w && !human.pad[k]) { humanPress(k); anyUserInput('pad'); }
    if (!w && human.pad[k]) humanRelease(k);
    human.pad[k] = w;
  }
}

/* ---------------- time, queue, juice ---------------- */
const T = { game: 0, real: 0, hitstop: 0, slow: 0, slowScale: 1, shake: 0, flash: 0 };
const queue = []; // game-time event queue (never setTimeout for gameplay)
function later(delay, fn) { queue.push({ t: T.game + delay, fn }); }
function runQueue() {
  for (let i = 0; i < queue.length; i++) { const q = queue[i]; if (q.t <= T.game) { queue.splice(i, 1); i--; q.fn(); } }
}
function clearQueue() { queue.length = 0; }
function hitstop(s) { T.hitstop = Math.max(T.hitstop, s); }
function shake(a) { T.shake = Math.max(T.shake, a); }
function slowmo(dur, scale) { T.slow = Math.max(T.slow, dur); T.slowScale = scale; }
function flash(a) { T.flash = Math.max(T.flash, a); }
// particles (pooled)
const PMAX = 500, parts = [];
for (let i = 0; i < PMAX; i++) parts.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, g: 0, life: 0, max: 1, r: 2, col: '#fff', kind: 0, c: null });
let pCursor = 0, SPZ = 0; // SPZ: depth (units) the current event spawns particles at
function spawn(x, y, n, col, spd, grav, r, kind) {
  for (let i = 0; i < n; i++) {
    const p = parts[pCursor]; pCursor = (pCursor + 1) % PMAX;
    const a = Math.random() * TAU, s = (0.3 + Math.random() * 0.7) * spd;
    p.on = true; p.x = x; p.y = y; p.z = SPZ + (Math.random() - 0.5) * 30; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - spd * 0.3; p.g = grav;
    p.life = p.max = 0.4 + Math.random() * 0.5; p.r = (r || 3) * (0.6 + Math.random() * 0.8); p.col = col; p.kind = kind || 0;
  }
}
function spray(x, y, n, col, vx, vy, spread, grav, r) {
  for (let i = 0; i < n; i++) {
    const p = parts[pCursor]; pCursor = (pCursor + 1) % PMAX;
    p.on = true; p.x = x; p.y = y; p.z = SPZ + (Math.random() - 0.5) * 20; p.vx = vx + (Math.random() - 0.5) * spread; p.vy = vy + (Math.random() - 0.5) * spread; p.g = grav;
    p.life = p.max = 0.35 + Math.random() * 0.45; p.r = (r || 3) * (0.6 + Math.random() * 0.8); p.col = col; p.kind = 0;
  }
}
function updParts(dt) {
  for (let i = 0; i < PMAX; i++) { const p = parts[i]; if (!p.on) continue;
    p.life -= dt; if (p.life <= 0) { p.on = false; continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
}
function clearParts() { for (let i = 0; i < PMAX; i++) parts[i].on = false; }
// world-space score popups (pooled) + one big screen banner
const pops = []; for (let i = 0; i < 16; i++) pops.push({ on: false, x: 0, y: 0, t: 0, a: '', b: '', col: '#fff' });
let popC = 0;
function pop(x, y, a, b, col) { const p = pops[popC]; popC = (popC + 1) % pops.length; p.on = true; p.x = x; p.y = y; p.t = 1.3; p.a = a; p.b = b || ''; p.col = col || C.yel; }
function updPops(dt) { for (const p of pops) if (p.on) { p.t -= dt; p.y -= 40 * dt; if (p.t <= 0) p.on = false; } }
function clearPops() { for (const p of pops) p.on = false; }
const banner = { t: 0, a: '', b: '', col: C.yel, big: false };
function say(a, b, col, dur, big) { banner.t = dur || 1.4; banner.a = a; banner.b = b || ''; banner.col = col || C.yel; banner.big = !!big; }

