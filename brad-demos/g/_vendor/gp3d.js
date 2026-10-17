// gp3d: the ~100 lines every three.js demo in this folder shares. Portrait-first stage, fixed-step loop
// (deterministic under gamepress's virtual clock), input, HUD, synth sfx, event log for capture scripts.
import * as THREE from './three.module.min.js';
export { THREE };

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const events = (window.__events = []);
let ac;
/** Tiny synth. Logs every call to window.__events so gamepress can rebuild the audio offline. */
export function sfx(type, vol = 1) {
  events.push({ t: +(performance.now() / 1000).toFixed(2), type });
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination);
    const P = { boom: ['sawtooth', 100, 28, .45, .5], pop: ['sine', 500, 900, .06, .12], ding: ['sine', 1320, 1320, .35, .15], crash: ['square', 240, 60, .25, .2], whoosh: ['triangle', 320, 90, .2, .15],
      splat: ['sine', 200, 60, .16, .25], snap: ['sawtooth', 900, 120, .12, .3], tick: ['square', 700, 700, .03, .05], win: ['triangle', 520, 1040, .4, .25], meow: ['sawtooth', 900, 420, .3, .12], groan: ['sawtooth', 120, 60, .5, .2], goo: ['sine', 160, 50, .2, .3], zoom: ['sawtooth', 80, 240, .4, .15] }[type] || ['sine', 440, 440, .1, .1];
    o.type = P[0]; o.frequency.setValueAtTime(P[1], t); o.frequency.exponentialRampToValueAtTime(P[2], t + P[3]);
    g.gain.setValueAtTime(P[4] * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + P[3] + .02); o.start(t); o.stop(t + P[3] + .05);
  } catch {}
}

export function createStage({ bg = 0x101820, fov = 50, fitWidth = 10, fog } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const dpr = Math.min(devicePixelRatio || 1, +(new URLSearchParams(location.search).get('dpr') || 2));
  renderer.setPixelRatio(dpr); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  document.body.style.cssText = 'margin:0;overflow:hidden;background:#000;touch-action:none;font-family:Impact,"Arial Black",system-ui,sans-serif';
  document.body.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'display:block;width:100vw;height:100vh;filter:saturate(1.25) contrast(1.07)';
  const vig = document.createElement('div'); vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,transparent 55%,rgba(0,0,0,.42) 100%)'; document.body.appendChild(vig);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg); if (fog) scene.fog = new THREE.Fog(bg, fog[0], fog[1]);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 500);
  const st = { THREE, renderer, scene, camera, fitWidth, shakeAmt: 0, keys: {}, ptr: { x: 0, y: 0, down: false }, t: 0 };
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    st.dist = (st.fitWidth / 2) / (Math.tan(THREE.MathUtils.degToRad(fov / 2)) * camera.aspect); };
  addEventListener('resize', resize); resize(); st.resize = resize;
  addEventListener('keydown', e => { st.keys[e.key.toLowerCase()] = true; if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault(); });
  addEventListener('keyup', e => { st.keys[e.key.toLowerCase()] = false; });
  const setPtr = e => { st.ptr.x = e.clientX / innerWidth * 2 - 1; st.ptr.y = e.clientY / innerHeight * 2 - 1; };
  addEventListener('pointerdown', e => { st.ptr.down = true; setPtr(e); st.onPointerDown?.(e); }); addEventListener('pointermove', setPtr);
  addEventListener('pointerup', () => { st.ptr.down = false; st.onPointerUp?.(); });
  // HUD
  const hud = document.createElement('div'); hud.style.cssText = 'position:fixed;inset:0;pointer-events:none;color:#fff;font-size:5vmin;text-shadow:0 .5vmin 0 #000,0 0 1.2vmin #000';
  hud.innerHTML = '<div id="h-l" style="position:absolute;left:4vw;top:2.5vh"></div><div id="h-r" style="position:absolute;right:4vw;top:2.5vh;text-align:right"></div>' +
    '<div id="h-c" style="position:absolute;left:0;right:0;top:40%;text-align:center;font-size:10vmin;color:#ffd34d"></div><div id="h-b" style="position:absolute;left:0;right:0;bottom:5vh;text-align:center;font-size:3.8vmin;font-family:system-ui,sans-serif;font-weight:800;opacity:.9"></div>';
  document.body.appendChild(hud);
  const q = id => hud.querySelector(id); let bannerT = 0;
  st.hud = { left: s => (q('#h-l').innerHTML = s), right: s => (q('#h-r').innerHTML = s), hint: s => (q('#h-b').textContent = new URLSearchParams(location.search).has('clean') ? '' : s),
    banner(s, secs = 1.2) { q('#h-c').textContent = s; bannerT = secs; }, _tick(dt) { if (bannerT > 0 && (bannerT -= dt) <= 0) q('#h-c').textContent = ''; } };
  st.shake = a => { st.shakeAmt = Math.max(st.shakeAmt, a); };
  /** update(dt) runs at a fixed 1/60 s; render happens once per animation frame. */
  st.run = (update, pre) => {
    let last = 0, acc = 0;
    const frame = ts => {
      acc += Math.min(0.1, (ts - last) / 1000 || 0.016); last = ts;
      while (acc >= 1 / 60) { st.t += 1 / 60; update(1 / 60); st.hud._tick(1 / 60); acc -= 1 / 60; st.shakeAmt = Math.max(0, st.shakeAmt - 1.2 / 60 * 10); }
      pre?.();
      if (st.shakeAmt > 0) { camera.position.x += rand(-1, 1) * st.shakeAmt * .02; camera.position.y += rand(-1, 1) * st.shakeAmt * .02; }
      renderer.render(scene, camera); requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  st.light = () => { scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.1)); const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(4, 10, 6); scene.add(d); };
  return st;
}

/** One InstancedMesh with per-instance colour; returns helpers to set matrix/colour cheaply. */
export function instances(geo, mat, count, { dynamic = true } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  if (dynamic) m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false; m.count = count;
  const o = new THREE.Object3D(), c = new THREE.Color();
  return { mesh: m, set(i, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) { o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); o.updateMatrix(); m.setMatrixAt(i, o.matrix); },
    color(i, hex) { c.setHex(hex); m.setColorAt(i, c); }, hsl(i, h, s, l) { c.setHSL(h, s, l); m.setColorAt(i, c); }, done() { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } };
}
