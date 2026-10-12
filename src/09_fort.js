
// ---------------- Fort McHenry set piece: "The Bombardment" (DESIGN.md, Brad 2026-10-11) ----------------
// Walk up the north-bastion ramp at Fort McHenry and take the cannon (ACT / E / pad Y or A, or tap the prompt): the game cuts to a first-person
// Duck Hunt-style shooting gallery over the water. Tap / click aims + fires (pad: stick aims, A fires; keys: WASD aims, Space fires), with a cannon
// reload. 4 waves of original sailing warships (plain red pennants, no real flags or insignia): sloops (cannonballs), bomb ketches (high-arc
// mortar shells that burst in the air), a rocket ship (rockets with red streak trails), then the flagship with Admiral Redclaw on deck.
// Shoot ships (hit points, sinking, splash) and their shots out of the air. The storm flag over the fort is the health bar and tatters as it is
// hit; if it falls you lose (retry the wave). Night -> dawn wave by wave. Win: the big garrison flag rises to the anthem's last phrase with
// fireworks, then back to the city with the landmark cleared (BOSS_CLEAR.clear('fort'): boss cleared + that district's crime -> 0).
// Music: procedural Web Audio fife-and-drum arrangement of The Star-Spangled Banner melody (public-domain tune; notes written here, no recording),
// tempo + intensity rise per wave; the radio is held (paused) while it plays and resumed after.
// Own scene + camera (the city is not drawn while it runs): ~20 draw calls; ships + projectiles instanced, all fx in two Points systems.
// Admiral Redclaw's real rig (Opus) plugs in through window.boss_admiral_redclaw.buildAdmiralRedclaw (or a global buildAdmiralRedclaw); a stand-in crab otherwise.

// ---- boss-clear / crime hooks: BOSS_CLEAR (src/06g0_boss_clear.js, the same file the other boss branches carry) does the bookkeeping;
// here the minimap just gets a green dot on every cleared landmark ----
(function () {
  const mark = (id) => { const L = LANDMARKS.find((l) => l.id === id); if (!L || typeof MAP === 'undefined' || !MAP) return; const b = MAP.bg.getContext('2d');
    b.fillStyle = '#7dff6b'; b.strokeStyle = '#000'; b.lineWidth = 2; b.beginPath(); b.arc(MAP.X(L.x), MAP.Z(L.z), 4.6, 0, TAU); b.fill(); b.stroke(); };
  BOSS_CLEAR.on((d) => mark(d.lm)); setTimeout(() => { for (const id of BOSS_CLEAR.cleared) mark(id); }, 0);
})();

const FORT = (function () {
  const F = { on: false, phase: 'off', wave: 0, t: 0, wt: 0, flag: 100, score: 0, auto: Q.has('fortauto'), stats: null, log: [], runs: 0, wins: 0, losses: 0, perf: { calls: 0, tris: 0, maxCalls: 0, frames: 0 }, mt: 0 };
  const CAN = { x: 176, z: 64.5, stand: { x: 176, z: 66.6 } }; // the rampart cannon (world), and where Harold stands behind it
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const _a = V3(), _b = V3(), _c = V3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V3(1, 1, 1), _col = new THREE.Color();
  const pick = (a) => a[(Math.random() * a.length) | 0];

  // ================= world hook: the CANNON action on the rampart =================
  ICONS.cannon = '<path d="M2 14l13-6 2.4 4.4-13 6zM5 19.5a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0M17 10.5l4.5-2.2M18.5 13.6l3.5.4"/>';
  const ACT = { kind: 'cannon', label: 'CANNON', x: CAN.stand.x, z: CAN.stand.z, r: 1.9, y: CURB + 3.3 + 1.9, ok: () => !hero.roof && !F.on && hero.pos.y > CURB + 2.4, go: () => enter('act') };
  ACTIONS.push(ACT);
  const css = document.createElement('style');
  css.textContent = `
  #prompt.cannon { pointer-events: auto; cursor: pointer; }
  body.fort #hpbox, body.fort #p2, body.fort #ko, body.fort #face, body.fort #clock, body.fort #qbtn, body.fort #combo, body.fort #banner, body.fort #lmk, body.fort #mmap, body.fort #hint,
  body.fort #prompt, body.fort #proto, body.fort #rid, body.fort #rcard, body.fort #bark, body.fort #lmkb, body.fort #lbT, body.fort #lbB, body.fort #title { display: none !important; }
  #fort { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; z-index: 40; display: none; pointer-events: none; overflow: hidden; font-family: 'PX', monospace; color: #fff; -webkit-user-select: none; user-select: none; }
  body.fort #fort { display: block; }
  #fort .fh { position: absolute; left: 0; right: 0; top: calc(env(safe-area-inset-top, 0px) + 8px); display: flex; justify-content: space-between; align-items: flex-start; padding: 0 10px; gap: 8px; }
  #fwave { font-size: 10px; line-height: 15px; text-shadow: 2px 2px 0 #000; color: #ffd23c; }
  #fwave small { display: block; font-size: 8px; color: #cfe0ff; }
  #fscore { font-size: 12px; text-shadow: 2px 2px 0 #000; text-align: right; }
  #fscore small { display: block; font-size: 8px; color: #ff9ad0; margin-top: 3px; }
  #fflag { position: absolute; left: 10px; top: calc(env(safe-area-inset-top, 0px) + 42px); width: 92px; height: 9px; border: 2px solid #000; background: #2a1650; box-shadow: 2px 2px 0 #000; }
  #fflag i { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #ff3d3d, #fff 50%, #3d6dff); transition: width .25s; }
  #fflag b { position: absolute; left: 0; top: 12px; font-size: 7px; font-weight: normal; text-shadow: 1px 1px 0 #000; white-space: nowrap; }
  #fcap { position: absolute; left: 6%; right: 6%; bottom: 13%; text-align: center; font: italic 700 15px/1.3 Georgia, 'Times New Roman', serif; color: #fff4d6; text-shadow: 0 2px 6px #000, 0 0 2px #000; opacity: 0; transition: opacity 1.2s; }
  #fcap.on { opacity: 1; }
  #fban { position: absolute; left: 0; right: 0; top: 30%; text-align: center; font-size: 18px; line-height: 1.5; color: #ffd23c; text-shadow: 3px 3px 0 #000, -1px -1px 0 #000; opacity: 0; transform: scale(.8); transition: opacity .35s, transform .35s; }
  #fban small { display: block; font-size: 9px; color: #fff; margin-top: 6px; }
  #fban.on { opacity: 1; transform: scale(1); }
  #fx { position: absolute; left: 0; top: 0; width: 64px; height: 64px; margin: -32px 0 0 -32px; will-change: transform; }
  #fx circle.rl { fill: none; stroke: #ffd23c; stroke-width: 4; stroke-dasharray: 151; transform: rotate(-90deg); transform-origin: 32px 32px; }
  #fx .ln { stroke: #fff; stroke-width: 3; } #fx .ol { stroke: #000; stroke-width: 6; } #fx circle.ri { fill: none; stroke: #fff; stroke-width: 2.5; }
  #fx.cool .ln, #fx.cool circle.ri { stroke: #ff9a9a; }
  #fexit { all: unset; position: absolute; right: 8px; top: calc(env(safe-area-inset-top, 0px) + 46px); pointer-events: auto; cursor: pointer; width: 30px; height: 30px; border-radius: 6px; border: 2px solid #000; background: #2a1650; color: #ffd23c; text-align: center; font: 900 16px/28px system-ui, sans-serif; box-shadow: 2px 2px 0 #000; }
  #fend { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%); width: min(86vw, 360px); padding: 16px 14px; background: #1b1030ee; border: 3px solid #000; box-shadow: 4px 4px 0 #000, inset 0 0 0 2px #ff3d6e; text-align: center; display: none; pointer-events: auto; }
  #fend.on { display: block; } #fend h2 { margin: 0 0 10px; font-size: 14px; line-height: 1.5; color: #ffd23c; font-weight: normal; } #fend p { font-size: 8px; line-height: 1.8; margin: 0 0 12px; color: #e8e0ff; }
  #fend button { all: unset; cursor: pointer; display: inline-block; margin: 4px; padding: 9px 12px; border: 2px solid #000; background: #ffd23c; color: #14101f; font: 9px 'PX', monospace; box-shadow: 2px 2px 0 #000; }
  #fend button.alt { background: #8a7ab0; }
  #fhurt { position: absolute; inset: 0; box-shadow: inset 0 0 90px 30px rgba(255,40,30,.75); opacity: 0; }
  #fpops b { position: absolute; font-size: 9px; font-weight: normal; color: #ffd23c; text-shadow: 2px 2px 0 #000; transform: translate(-50%, -50%); white-space: nowrap; transition: opacity .2s; }
  #fsay { position: absolute; left: 50%; top: 21%; transform: translateX(-50%); max-width: 80%; padding: 7px 10px; background: #2a1650; border: 2px solid #000; box-shadow: 3px 3px 0 #000, inset 0 0 0 2px #ff3d6e; font-size: 9px; line-height: 1.6; text-align: center; opacity: 0; transition: opacity .25s; }
  #fsay b { color: #ffd23c; font-weight: normal; display: block; font-size: 7px; } #fsay.on { opacity: 1; }
  #fhint { position: absolute; left: 0; right: 0; bottom: 4%; text-align: center; font-size: 8px; line-height: 1.6; color: #fff; text-shadow: 1px 1px 0 #000; opacity: 0; transition: opacity .6s; }
  #fhint.on { opacity: .9; }
  #fblk { position: fixed; inset: 0; z-index: 70; background: #000; opacity: 0; pointer-events: none; }
  @media (max-width: 480px) { #fban { font-size: 15px; } #fcap { font-size: 14px; bottom: 15%; } }`;
  document.head.appendChild(css);
  const root = document.createElement('div'); root.id = 'fort';
  root.innerHTML = `<div class="fh"><div id="fwave"></div><div id="fscore"></div></div><div id="fflag"><i></i><b>STORM FLAG</b></div>
    <button id="fexit" aria-label="Leave the cannon">✕</button><div id="fhurt"></div><div id="fpops"></div><div id="fcap"></div><div id="fsay"></div><div id="fban"></div><div id="fhint"></div>
    <svg id="fx" viewBox="0 0 64 64"><circle class="ri" cx="32" cy="32" r="13"/><circle class="rl" cx="32" cy="32" r="24"/>
      <path class="ol" d="M32 6v14M32 44v14M6 32h14M44 32h14"/><path class="ln" d="M32 6v14M32 44v14M6 32h14M44 32h14"/></svg>
    <div id="fend"><h2></h2><p></p><button id="fretry">RETRY WAVE</button><button id="fleave" class="alt">LEAVE</button></div>`;
  document.body.appendChild(root);
  const blk = document.createElement('div'); blk.id = 'fblk'; document.body.appendChild(blk);
  const D = { wave: $('fwave'), score: $('fscore'), flag: root.querySelector('#fflag i'), cap: $('fcap'), ban: $('fban'), x: $('fx'), xr: root.querySelector('#fx circle.rl'), end: $('fend'), hurt: $('fhurt'), pops: $('fpops'), hint: $('fhint') };
  for (const n of [root, D.end]) for (const ev of ['pointerdown', 'touchstart']) n.addEventListener(ev, (e) => { if (e.target.tagName === 'BUTTON') e.stopPropagation(); }, { passive: true });
  $('fexit').addEventListener('click', (e) => { e.stopPropagation(); leave(false); });
  $('fretry').addEventListener('click', (e) => { e.stopPropagation(); retry(); });
  $('fleave').addEventListener('click', (e) => { e.stopPropagation(); leave(F.phase === 'done'); });
  $('prompt').addEventListener('pointerdown', (e) => { if (!F.on && CINE.prompt && CINE.prompt.startsWith('cannon')) { e.preventDefault(); e.stopPropagation(); audioInit(); enter('tap'); } });

  // ================= the gallery scene =================
  const FS = new THREE.Scene();
  FS.fog = new THREE.Fog('#141c34', 160, 760);
  const FC = new THREE.PerspectiveCamera(60, 1, 0.3, 1200); FC.position.set(0, 7.6, 0);
  const CAMP = { yaw: 0, pitch: -0.07, shake: 0, hfov: 72 };
  const hemiF = new THREE.HemisphereLight('#7080c0', '#202030', 0.5); const dirF = new THREE.DirectionalLight('#9ab0ff', 0.6); dirF.position.set(-40, 60, 30); FS.add(hemiF, dirF);
  // ---- geometry helpers: merged, vertex-coloured, non-indexed ----
  const tf = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => g.applyMatrix4(_m.compose(_a.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
  function paint(g, col) { if (g.index) g = g.toNonIndexed(); if (!g.attributes.normal) g.computeVertexNormals(); const n = g.attributes.position.count, a = new Float32Array(n * 3), P = g.attributes.position;
    for (let i = 0; i < n; i++) { const c = typeof col === 'function' ? _col.set(col(P.getX(i), P.getY(i), P.getZ(i))) : _col.set(col); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
  function merge(list) { // list of painted geometries
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
    for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.computeBoundingSphere(); return g;
  }
  const box = (w, h, d, col, x, y, z, rx, ry, rz) => paint(tf(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), col);
  const cyl = (r0, r1, h, col, x, y, z, rx, ry, rz, seg = 8) => paint(tf(new THREE.CylinderGeometry(r0, r1, h, seg), x, y, z, rx, ry, rz), col);
  function sail(p0, p1, p2, p3, bulge, col) { // bilinear patch p0 (bottom fwd) p1 (bottom aft) p2 (top aft) p3 (top fwd), bellied along z
    const S = 4, pos = [], A = (u, v) => { const x = (1 - v) * ((1 - u) * p0[0] + u * p1[0]) + v * ((1 - u) * p3[0] + u * p2[0]), y = (1 - v) * ((1 - u) * p0[1] + u * p1[1]) + v * ((1 - u) * p3[1] + u * p2[1]);
      const z = (1 - v) * ((1 - u) * p0[2] + u * p1[2]) + v * ((1 - u) * p3[2] + u * p2[2]) + Math.sin(u * Math.PI) * Math.sin(Math.min(1, v * 1.15) * Math.PI) * bulge; return [x, y, z]; };
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) { const a = A(i / S, j / S), b = A((i + 1) / S, j / S), c = A((i + 1) / S, (j + 1) / S), d = A(i / S, (j + 1) / S); pos.push(...a, ...b, ...c, ...a, ...c, ...d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return paint(g, col);
  }
  function hull(L, H, W, cols, stern = 0.25) { // bow at +x; waterline y 0, deck at ~H*0.6
    const g = new THREE.BoxGeometry(L, H, W, 10, 4, 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), u = x / L + 0.5, yb = (y + H / 2) / H;
      let wz = u > 0.6 ? Math.max(0.05, 1 - Math.pow((u - 0.6) / 0.4, 1.7)) : u < 0.1 ? 0.8 + u * 2 : 1; wz *= 0.42 + 0.58 * Math.min(1, yb * 1.5);
      let ny = y + H * 0.12; if (yb > 0.9) ny += (u > 0.8 ? H * 0.22 * (u - 0.8) / 0.2 : 0) + (u < 0.18 ? H * stern * (0.18 - u) / 0.18 : 0);
      p.setXYZ(i, x * (yb < 0.1 ? 0.9 : 1), ny, z * wz); }
    g.computeVertexNormals();
    return paint(g, (x, y) => (y > H * 0.38 ? cols[0] : y > H * 0.26 ? cols[1] : y > -H * 0.05 ? cols[2] : cols[3]));
  }
  const SAILC = '#e8dfc6', SAIL2 = '#d6ccb0', WOOD = '#5a3a22', MAST = '#3a2616', IRON = '#1e1e22', PEN = '#c8302a';
  function gunports(L, y, W, n, x0, col = '#111') { const out = []; for (let k = 0; k < n; k++) { const x = x0 + k * (L / n); for (const s of [-1, 1]) out.push(box(0.55, 0.45, 0.1, col, x, y, s * (W / 2 + 0.03))); } return out; }
  function pennant(x, y, len = 2.2) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([x, y, 0, x - len, y - 0.3, 0, x, y - 0.6, 0], 3)); g.computeVertexNormals(); return paint(g, PEN); }
  // ---- the four ship types (originals; red-coat colours, plain red pennants) ----
  const SHIP = {
    sloop: { L: 14, H: 13, hp: 3, speed: 7, pts: 100, fire: [3.0, 4.4], weapon: 'ball', max: 4 },
    ketch: { L: 16, H: 14, hp: 4, speed: 4.6, pts: 150, fire: [4.0, 5.2], weapon: 'shell', max: 3, anchor: true },
    rocket: { L: 20, H: 16, hp: 9, speed: 3.6, pts: 400, fire: [3.8, 4.8], weapon: 'rocket', max: 1, anchor: true },
    flag: { L: 30, H: 24, hp: 22, speed: 2.8, pts: 1000, fire: [4.6, 5.6], weapon: 'broadside', max: 1, anchor: true },
  };
  function geoSloop() { const L = 14, W = 3.6, d = 1.9, P = [hull(L, 3, W, ['#a8322c', '#e0b850', '#2a1c14', '#1a120c'])];
    P.push(box(L * 0.8, 0.12, W * 0.8, '#8a6a48', -0.4, d - 0.1, 0), cyl(0.13, 0.18, 12, MAST, 1, d + 6, 0), cyl(0.07, 0.07, 6, MAST, -1.7, d + 1.3, 0, 0, 0, Math.PI / 2), cyl(0.06, 0.08, 5, MAST, L / 2 + 1.4, d + 0.8, 0, 0, 0, -1.2));
    P.push(sail([0.8, d + 1.4, 0], [-4.6, d + 1.4, 0], [-3.6, d + 9.6, 0], [0.8, d + 10.6, 0], 0.7, SAILC), sail([L / 2 + 3.4, d + 1.8, 0], [1.4, d + 1.6, 0], [1.2, d + 11.4, 0], [1.2, d + 11.4, 0], 0.5, SAIL2));
    P.push(...gunports(L * 0.55, d - 0.55, W, 3, -3), pennant(1, d + 12.2)); return merge(P); }
  function geoKetch() { const L = 16, W = 4.4, d = 2.0, P = [hull(L, 3.3, W, ['#7a2620', '#d8b048', '#22180f', '#160f0a'])];
    P.push(box(L * 0.8, 0.12, W * 0.8, '#8a6a48', -0.3, d - 0.1, 0), cyl(0.15, 0.2, 13, MAST, -1.5, d + 6.5, 0), cyl(0.1, 0.13, 8, MAST, -6, d + 4, 0));
    P.push(sail([-1.7, d + 1.6, 0], [-5.6, d + 1.6, 0], [-5.2, d + 10.8, 0], [-1.7, d + 11.8, 0], 0.7, SAILC), sail([-6.2, d + 1.5, 0], [-8.6, d + 1.5, 0], [-8.2, d + 6.8, 0], [-6.2, d + 7.5, 0], 0.4, SAIL2));
    // the two big mortars forward (what makes it a bomb vessel)
    P.push(cyl(0.75, 0.9, 1.3, IRON, 3.4, d + 0.7, 0, 0, 0, -0.5, 10), cyl(0.7, 0.85, 1.2, IRON, 5.4, d + 0.65, 0, 0, 0, -0.45, 10), box(4.4, 0.5, 2.4, WOOD, 4.4, d + 0.1, 0));
    P.push(...gunports(L * 0.4, d - 0.6, W, 2, -5), pennant(-1.5, d + 13)); return merge(P); }
  function geoRocket() { const L = 20, W = 5, d = 2.3, P = [hull(L, 3.8, W, ['#a8322c', '#e0c060', '#241810', '#160f0a'], 0.35)];
    P.push(box(L * 0.82, 0.12, W * 0.8, '#8a6a48', -0.4, d - 0.1, 0), cyl(0.16, 0.22, 14, MAST, 3, d + 7, 0), cyl(0.15, 0.2, 13, MAST, -3.5, d + 6.5, 0), cyl(0.07, 0.09, 6, MAST, L / 2 + 1.8, d + 1, 0, 0, 0, -1.2));
    for (const [mx, h] of [[3, 13], [-3.5, 12]]) for (const [y0, y1, w] of [[3, 7.5, 3.4], [8, 11.6, 2.6]]) P.push(sail([mx + w * 0.85, d + y0, -w * 0.4], [mx - w * 0.85, d + y0, w * 0.4], [mx - w * 0.7, d + y1, w * 0.35], [mx + w * 0.7, d + y1, -w * 0.35], 0.6, SAILC), cyl(0.06, 0.06, w * 2, MAST, mx, d + y1, 0, 0, 0.45, Math.PI / 2));
    P.push(sail([L / 2 + 4, d + 2, 0], [3.6, d + 2.4, 0], [3.2, d + 13.4, 0], [3.2, d + 13.4, 0], 0.5, SAIL2));
    // the rocket rack: a tilted frame of rails on the quarterdeck
    for (let k = 0; k < 4; k++) P.push(box(0.12, 0.12, 3.4, '#6a4a2a', -5.4 + k * 0.5, d + 1.6, 0, 0.9, 0, 0)); P.push(box(2.6, 1.4, 0.2, '#6a4a2a', -4.6, d + 0.8, 1.1), box(2.6, 2.6, 0.2, '#6a4a2a', -4.6, d + 1.4, -1.1));
    for (let k = 0; k < 6; k++) P.push(cyl(0.11, 0.11, 1.1, '#e8e0d0', -5.6 + k * 0.42, d + 1.9, 0.2, 0.9, 0, 0, 5));
    P.push(...gunports(L * 0.55, d - 0.7, W, 4, -6), pennant(3, d + 14.4), pennant(-3.5, d + 13.3, 1.6)); return merge(P); }
  function geoFlag() { const L = 30, W = 7, d = 3.2, P = [hull(L, 5.4, W, ['#8a2420', '#e8c45a', '#1e140c', '#140d08'], 0.5)];
    P.push(box(L * 0.82, 0.14, W * 0.8, '#8a6a48', -0.5, d - 0.1, 0), box(7, 2.2, W * 0.86, '#7a2620', -L / 2 + 4.6, d + 1, 0), box(7.2, 0.3, W * 0.9, '#e8c45a', -L / 2 + 4.6, d + 2.2, 0), box(3, 1.2, W * 0.7, '#7a2620', L / 2 - 4, d + 0.5, 0));
    for (let k = 0; k < 6; k++) P.push(box(0.5, 0.6, 0.12, '#ffd890', -L / 2 + 2.2 + k * 0.9, d + 1.1, W * 0.44)); // stern windows (lit)
    for (const [mx, h] of [[7.5, 21], [-0.5, 23], [-8, 17]]) { P.push(cyl(0.22, 0.32, h, MAST, mx, d + h / 2, 0));
      for (const [y0, y1, w] of [[3.5, 9, 4.6], [9.6, 14.6, 3.8], [15.2, Math.min(h - 0.6, 19), 3]]) if (y1 < h) P.push(sail([mx + w * 0.85, d + y0, -w * 0.38], [mx - w * 0.85, d + y0, w * 0.38], [mx - w * 0.72, d + y1, w * 0.33], [mx + w * 0.72, d + y1, -w * 0.33], 0.8, SAILC), cyl(0.08, 0.08, w * 2, MAST, mx, d + y1, 0, 0, 0.42, Math.PI / 2));
      P.push(pennant(mx, d + h + 0.2, 3)); }
    P.push(cyl(0.1, 0.14, 9, MAST, L / 2 + 3, d + 1.6, 0, 0, 0, -1.2), sail([L / 2 + 7, d + 3, 0], [8, d + 3.4, 0], [7.8, d + 19.5, 0], [7.8, d + 19.5, 0], 0.6, SAIL2), sail([-9, d + 2.6, 0], [-15.4, d + 2.6, 0], [-14.6, d + 11, 0], [-9, d + 13, 0], 0.6, SAIL2));
    P.push(...gunports(L * 0.72, d - 0.75, W, 9, -10.5), ...gunports(L * 0.6, d - 2.0, W, 7, -8.5)); return merge(P); }
  const MATS = { ship: toonMat({ side: THREE.DoubleSide }), fg: toonMat(), proj: toonMat() };
  const INST = {};
  for (const [type, geo] of [['sloop', geoSloop()], ['ketch', geoKetch()], ['rocket', geoRocket()], ['flag', geoFlag()]]) {
    const im = new THREE.InstancedMesh(geo, type === 'flag' || type === 'rocket' ? toonMat({ side: THREE.DoubleSide }) : MATS.ship, SHIP[type].max);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; im.visible = false;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SHIP[type].max * 3).fill(1), 3); FS.add(im); INST[type] = im;
  }
  // ---- Admiral Redclaw: the real rig if the boss module is loaded, else a stand-in crab in a bicorne ----
  function standInCrab() {
    const g = new THREE.Group(), red = '#d0402c', P = [], am = toonMat();
    P.push(paint(tf(new THREE.SphereGeometry(1, 12, 8), 0, 1.15, 0, 0, 0, 0, 1.25, 0.62, 0.95), red), paint(tf(new THREE.SphereGeometry(1, 10, 6), 0, 0.95, 0, 0, 0, 0, 1.1, 0.35, 0.85), '#e86a4a'));
    for (const s of [-1, 1]) { P.push(cyl(0.07, 0.07, 0.6, red, s * 0.35, 1.85, 0.55, -0.3), paint(tf(new THREE.SphereGeometry(0.17, 8, 6), s * 0.35, 2.15, 0.62), '#ffffff'), paint(tf(new THREE.SphereGeometry(0.08, 6, 4), s * 0.35, 2.17, 0.77), '#111'));
      for (let k = 0; k < 3; k++) P.push(cyl(0.07, 0.05, 1.1, red, s * (1.1 + k * 0.05), 0.55, -0.4 + k * 0.4, 0, 0, s * 0.9)); }
    P.push(paint(tf(new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2), 0, 1.62, -0.1, 0, 0, 0, 0.95, 0.75, 0.32), '#14141a'), box(1.7, 0.1, 0.1, '#e8c45a', 0, 1.66, 0.22), paint(tf(new THREE.SphereGeometry(0.12, 6, 4), 0.55, 2.1, 0.12), '#e8c45a')); // bicorne + gold trim + cockade
    const body = new THREE.Mesh(merge(P), am); g.add(body);
    const claws = [];
    for (const s of [-1, 1]) { const c = new THREE.Group(); c.position.set(s * 1.25, 1.35, 0.3);
      const m = new THREE.Mesh(merge([cyl(0.12, 0.12, 1.0, red, 0, 0.45, 0), paint(tf(new THREE.SphereGeometry(0.45, 10, 6), 0, 1.1, 0, 0, 0, 0, 0.8, 1.2, 0.6), red), box(0.18, 0.8, 0.25, '#b83020', s * 0.18, 1.6, 0, 0, 0, -s * 0.3)]), am); c.add(m); g.add(c); claws.push({ g: c, s }); }
    g.userData.claws = claws; g.userData.standIn = true; return g;
  }
  function buildAdmiral() {
    const mod = window.boss_admiral_redclaw || (window.BOSS_MODULES && window.BOSS_MODULES.boss_admiral_redclaw) || null;
    const fn = (mod && mod.buildAdmiralRedclaw) || window.buildAdmiralRedclaw || (typeof buildAdmiralRedclaw === 'function' ? buildAdmiralRedclaw : null); // eslint-disable-line no-undef
    if (fn) { try { const r = fn({ THREE, toonMat, outlineMat, scale: 1 }); const o = r && (r.isObject3D ? r : r.root); if (o) { const bb = new THREE.Box3().setFromObject(o), h = Math.max(0.01, bb.max.y - bb.min.y), k = 2.6 / h; const g = new THREE.Group(); o.scale.multiplyScalar(k); o.position.y -= bb.min.y * k; g.add(o); g.userData.rig = r; g.userData.standIn = false; return g; } } catch (e) { console.warn('buildAdmiralRedclaw failed, using the stand-in', e); } }
    return standInCrab();
  }
  const ADM = { g: null, hp: 3, on: false, t: 0, hitT: 0 };
  // ---- projectiles (instanced): iron balls / mortar shells, rockets ----
  const BALLS = new THREE.InstancedMesh(paint(new THREE.IcosahedronGeometry(1, 1), '#2a2a30'), MATS.proj, 48); BALLS.count = 0; BALLS.frustumCulled = false; BALLS.instanceMatrix.setUsage(THREE.DynamicDrawUsage); FS.add(BALLS);
  const RK = new THREE.InstancedMesh(merge([cyl(0.16, 0.16, 1.5, '#e8e0d0', 0, 0, 0, 0, 0, 0, 6), cyl(0.01, 0.17, 0.5, '#c8302a', 0, 1.0, 0, 0, 0, 0, 6), cyl(0.03, 0.03, 3.2, '#6a4a2a', 0, -2.2, 0, 0, 0, 0, 4)]), MATS.proj, 16);
  RK.count = 0; RK.frustumCulled = false; RK.instanceMatrix.setUsage(THREE.DynamicDrawUsage); FS.add(RK);
  // ---- particles: one additive (fire, sparks, rocket glare, fireworks) + one normal-blend (smoke, spray) Points system ----
  function PSys(cap, additive) {
    const P = new Float32Array(cap * 3), C = new Float32Array(cap * 4), Z = new Float32Array(cap), st = new Float32Array(cap * 14); let n = 0;
    const g = new THREE.BufferGeometry();
    const aP = new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage), aC = new THREE.BufferAttribute(C, 4).setUsage(THREE.DynamicDrawUsage), aZ = new THREE.BufferAttribute(Z, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', aP); g.setAttribute('pcol', aC); g.setAttribute('psize', aZ); g.setDrawRange(0, 0);
    const U = { uScale: { value: 400 }, uMul: { value: 1 } };
    const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute vec4 pcol; attribute float psize; uniform float uScale; varying vec4 vC; void main(){ vC = pcol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(psize * uScale / max(0.5, -mv.z), 1.0, 200.0); }',
      fragmentShader: `uniform float uMul; varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0) discard; float a = vC.a * uMul * ${additive ? '(1.0 - r) * (1.0 - r)' : 'smoothstep(1.0, 0.35, r)'}; gl_FragColor = vec4(vC.rgb, a); }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = additive ? 6 : 5;
    // st: 0-2 vel, 3 life, 4 max, 5 s0, 6 s1, 7-9 rgb, 10 a0, 11 drag, 12 grav, 13 flicker
    function emit(x, y, z, vx, vy, vz, life, s0, s1, col, a0 = 1, drag = 0, grav = 0, flick = 0) {
      if (n >= cap) return; const i = n++; P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; const o = i * 14;
      st[o] = vx; st[o + 1] = vy; st[o + 2] = vz; st[o + 3] = 0; st[o + 4] = life; st[o + 5] = s0; st[o + 6] = s1; st[o + 7] = col.r; st[o + 8] = col.g; st[o + 9] = col.b; st[o + 10] = a0; st[o + 11] = drag; st[o + 12] = grav; st[o + 13] = flick; }
    function step(dt) {
      for (let i = 0; i < n; i++) { const o = i * 14; st[o + 3] += dt;
        if (st[o + 3] >= st[o + 4]) { n--; if (i !== n) { P.copyWithin(i * 3, n * 3, n * 3 + 3); st.copyWithin(o, n * 14, n * 14 + 14); } i--; continue; }
        const k = Math.exp(-st[o + 11] * dt); st[o] *= k; st[o + 1] = st[o + 1] * k + st[o + 12] * dt; st[o + 2] *= k;
        P[i * 3] += st[o] * dt; P[i * 3 + 1] += st[o + 1] * dt; P[i * 3 + 2] += st[o + 2] * dt; } }
    function upload(t) {
      for (let i = 0; i < n; i++) { const o = i * 14, u = st[o + 3] / st[o + 4]; Z[i] = st[o + 5] + (st[o + 6] - st[o + 5]) * u;
        let a = st[o + 10] * (u < 0.1 ? u / 0.1 * (st[o + 4] < 0.06 ? 0 : 1) + (st[o + 4] < 0.06 ? 1 : 0) : 1 - (u - 0.1) / 0.9); if (st[o + 13]) a *= 0.55 + 0.45 * Math.sin(t * 40 + i * 7.1);
        C[i * 4] = st[o + 7]; C[i * 4 + 1] = st[o + 8]; C[i * 4 + 2] = st[o + 9]; C[i * 4 + 3] = Math.max(0, a); }
      g.setDrawRange(0, n); pts.visible = n > 0; aP.needsUpdate = aC.needsUpdate = aZ.needsUpdate = true;
    }
    function clear() { n = 0; g.setDrawRange(0, 0); }
    return { pts, emit, step, upload, clear, U, get n() { return n; } };
  }
  const FX = PSys(2600, true), SM = PSys(1400, false); FS.add(FX.pts, SM.pts);
  const CL = (h) => new THREE.Color(h);
  const COL = { fire: CL('#ffb040'), hot: CL('#fff0b0'), red: CL('#ff3020'), redg: CL('#ff5a30'), smoke: CL('#5a5660'), smokeL: CL('#a8a4a8'), spray: CL('#e8f4ff'), spark: CL('#ffd27a'), white: CL('#ffffff'), blue: CL('#4a7aff'), gold: CL('#ffd040'), ember: CL('#ff7a20'), lamp: CL('#ffc070') };
  // ---- sky dome, water, far shore, shore lights ----
  const SKYU = { uTop: { value: CL('#050a1c') }, uHor: { value: CL('#141c34') }, uGlow: { value: CL('#ff9a50') }, uStars: { value: 1 }, uDawn: { value: 0 }, uFlash: { value: 0 }, uT: { value: 0 },
    uSunDir: { value: V3(0.55, 0.02, -0.83).normalize() }, uMoonDir: { value: V3(-0.45, 0.55, -0.7).normalize() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({ uniforms: SKYU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uTop, uHor, uGlow, uSunDir, uMoonDir; uniform float uStars, uDawn, uFlash, uT; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 c = mix(uHor, uTop, smoothstep(-0.02, 0.5, h));
        float sd = max(dot(d, uSunDir), 0.0);
        c += uGlow * (pow(sd, 5.0) * 0.6 * (1.0 - smoothstep(0.0, 0.45, h)) + pow(sd, 48.0) * 0.5) * uDawn;
        c += vec3(1.0, 0.82, 0.55) * smoothstep(0.9986, 0.9992, sd) * smoothstep(0.8, 1.0, uDawn) * 2.5;
        float md = dot(d, uMoonDir); float mo = 1.0 - smoothstep(0.35, 0.8, uDawn);
        c += vec3(0.92, 0.94, 1.0) * smoothstep(0.99935, 0.99965, md) * mo * 1.4 + vec3(0.25, 0.3, 0.45) * pow(max(md, 0.0), 120.0) * mo;
        vec3 q = floor(d * 260.0); float s = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        c += vec3(step(0.9962, s) * (0.6 + 0.4 * sin(uT * 3.0 + s * 60.0)) * uStars * smoothstep(0.02, 0.2, h));
        c += vec3(1.0, 0.7, 0.45) * uFlash * 0.22 * (1.0 - smoothstep(0.0, 0.6, h));
        gl_FragColor = vec4(c, 1.0); }` }));
  sky.renderOrder = -2; sky.frustumCulled = false; FS.add(sky);
  const WATU = { uDeep: { value: CL('#06101e') }, uHor: { value: CL('#141c34') }, uGlint: { value: CL('#8090c0') }, uT: { value: 0 }, uFlash: { value: 0 }, uSunDir: SKYU.uMoonDir };
  const WSUN = V3();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1100, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -520), new THREE.ShaderMaterial({ uniforms: WATU, fog: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uDeep, uHor, uGlint, uSunDir; uniform float uT, uFlash; varying vec3 vW;
      void main(){ float dist = length(vW.xz - cameraPosition.xz); float f = smoothstep(10.0, 520.0, dist);
        vec3 c = mix(uDeep, uHor, pow(f, 0.6));
        float w = sin(vW.x * 0.16 + uT * 0.9 + sin(vW.z * 0.1 + uT * 0.6) * 2.0) + sin(vW.z * 0.38 - uT * 1.3 + vW.x * 0.07) * 0.8 + sin((vW.x + vW.z) * 0.8 + uT * 2.1) * 0.35;
        c += uGlint * smoothstep(1.35, 1.95, w) * (1.0 - f * 0.8) * 0.3;
        vec3 v = normalize(vW - cameraPosition); vec3 r = reflect(v, normalize(vec3(sin(vW.x * 0.7 + uT * 2.0) * 0.04, 1.0, sin(vW.z * 0.9 - uT * 1.6) * 0.06)));
        c += uGlint * pow(max(dot(r, normalize(uSunDir)), 0.0), 40.0) * 1.4;
        c += vec3(1.0, 0.65, 0.35) * uFlash * 0.18 * (1.0 - f);
        gl_FragColor = vec4(c, 1.0); }` }));
  water.renderOrder = -1; FS.add(water);
  { const P = []; let x = -900; while (x < 900) { const w = rnd(24, 80), h = rnd(3, 14) + (Math.abs(x) < 200 ? rnd(0, 6) : 0); P.push(box(w, h, 20, '#0c1018', x + w / 2, h / 2 - 1, rnd(-470, -440))); if (Math.random() < 0.35) P.push(box(rnd(3, 6), h + rnd(4, 12), 4, '#0a0d14', x + rnd(0, w), (h + 8) / 2, -436)); x += w * rnd(0.6, 1); }
    const shore = new THREE.Mesh(merge(P), new THREE.MeshBasicMaterial({ vertexColors: true, color: '#ffffff', fog: true })); shore.userData.mat = shore.material; FS.add(shore); F.shore = shore; }
  const LAMPS = PSys(140, true); FS.add(LAMPS.pts);
  for (let k = 0; k < 120; k++) LAMPS.emit(rnd(-700, 700), rnd(1, 9), rnd(-432, -420), 0, 0, 0, 1e9, rnd(1.8, 3.2), rnd(1.8, 3.2), COL.lamp, rnd(0.35, 0.8), 0, 0, Math.random() < 0.3 ? 1 : 0);
  // ---- foreground: the fort's parapet + embrasure, the cannon (barrel pivots to the aim), the flag pole ----
  const PARA = new THREE.Mesh(merge([box(60, 6.4, 1.8, '#9a5a44', -31.4, 3.2, -3.0), box(60, 6.4, 1.8, '#9a5a44', 31.4, 3.2, -3.0), box(2.8, 5.6, 1.8, '#8a5040', 0, 2.8, -3.0),
    box(60, 0.35, 2.2, '#b8a888', -31.4, 6.55, -3.0), box(60, 0.35, 2.2, '#b8a888', 31.4, 6.55, -3.0), box(2.8, 0.3, 2.2, '#a89878', 0, 5.75, -3.0),
    box(130, 6, 6, '#7a6a52', 0, 2.5, 1.5), box(160, 3.2, 30, '#2e3a24', 0, 0.6, -19), box(160, 1.6, 1.2, '#8a8070', 0, 0.4, -34.4), ...[-7, -4.4, 4.4, 7].map((x) => box(0.9, 0.5, 0.9, '#2a2a2e', x, 6.95, -2.6)), box(0.5, 0.8, 0.5, '#5a3a22', -5.6, 7.1, -2.4)]), MATS.fg);
  FS.add(PARA);
  const CARR = new THREE.Mesh(merge([box(1.1, 0.6, 1.9, WOOD, 0, 5.75, -2.7), cyl(0.36, 0.36, 0.16, '#3a2a1a', -0.62, 5.6, -2.0, 0, 0, Math.PI / 2, 10), cyl(0.36, 0.36, 0.16, '#3a2a1a', 0.62, 5.6, -2.0, 0, 0, Math.PI / 2, 10),
    cyl(0.36, 0.36, 0.16, '#3a2a1a', -0.62, 5.6, -3.4, 0, 0, Math.PI / 2, 10), cyl(0.36, 0.36, 0.16, '#3a2a1a', 0.62, 5.6, -3.4, 0, 0, Math.PI / 2, 10)]), MATS.fg); FS.add(CARR);
  const PIV = new THREE.Group(); PIV.position.set(0, 6.15, -2.9); FS.add(PIV);
  const BARREL = new THREE.Mesh(merge([cyl(0.2, 0.3, 2.6, '#3a3a44', 0, 0, -1.0, -Math.PI / 2, 0, 0, 12), cyl(0.27, 0.27, 0.16, '#4a4a56', 0, 0, -2.25, -Math.PI / 2, 0, 0, 12), cyl(0.32, 0.32, 0.2, '#4a4a56', 0, 0, 0.2, -Math.PI / 2, 0, 0, 12),
    paint(tf(new THREE.SphereGeometry(0.16, 8, 6), 0, 0, 0.42), '#3a3a44'), cyl(0.07, 0.07, 0.9, '#3a3a44', 0, 0, -0.2, 0, 0, Math.PI / 2, 6)]), MATS.fg); PIV.add(BARREL);
  const OUTF = []; for (const m of [BARREL, CARR]) { const o = new THREE.Mesh(addOdir(m.geometry.clone()), OUT_PROP); o.visible = QUAL.hd; m.add(o); OUTF.push(o); QUAL.outlines.push(o); }
  const POLE = new THREE.Mesh(merge([cyl(0.16, 0.24, 40, '#d8d4c8', 0, 20, 0, 0, 0, 0, 8), paint(tf(new THREE.SphereGeometry(0.36, 8, 6), 0, 40.2, 0), '#e8c45a')]), MATS.fg); FS.add(POLE);
  // ---- the flags: canvas-drawn 15-star, 15-stripe Star-Spangled Banner (the 1795 pattern the fort flew); waves + tatters in the shader ----
  function flagTex(big) { return canvasTex(big ? 720 : 480, big ? 460 : 306, (c, w, h) => {
    for (let k = 0; k < 15; k++) { c.fillStyle = k % 2 ? '#f4f0e6' : '#b8262c'; c.fillRect(0, Math.floor(k * h / 15), w, Math.ceil(h / 15) + 1); }
    const cw = w * 0.4, ch = h * 8 / 15; c.fillStyle = '#23305e'; c.fillRect(0, 0, cw, ch);
    c.fillStyle = '#f4f0e6'; const star = (x, y, r) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.4 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); };
    for (let row = 0; row < 5; row++) for (let k = 0; k < 3; k++) star(cw * (0.17 + k * 0.33 + (row % 2) * 0.0), ch * (0.12 + row * 0.19), ch * 0.075);
  }, big ? 512 : 256); }
  const FLAGV = `uniform float uT, uWind, uFall; varying vec2 vUv; varying float vSh;
    void main(){ vUv = uv; vec3 p = position; float k = uv.x; float ph = uv.x * 6.0 - uT * 5.2 + uv.y * 1.4;
      p.z += sin(ph) * 0.42 * k * uWind; p.y += sin(uv.x * 3.5 - uT * 3.6) * 0.14 * k * uWind - k * k * uFall * 1.6; p.x -= abs(sin(ph)) * 0.08 * k;
      vSh = 0.78 + 0.22 * cos(ph); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
  const FLAGF = `uniform sampler2D map; uniform float uDmg, uLight, uFlash; varying vec2 vUv; varying float vSh;
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
    void main(){ float n = vn(vUv * vec2(7.0, 5.0)) * 0.6 + vn(vUv * vec2(19.0, 13.0)) * 0.4;
      float fray = vUv.x * 0.85 + (n - 0.5) * 0.7;            // the fly end goes first, then holes
      float thr = uDmg * 1.25; float hole = n - (1.0 - uDmg * 0.9);
      if (fray > 1.18 - thr || (uDmg > 0.25 && hole > 0.32)) discard;
      vec3 c = texture2D(map, vUv).rgb; float edge = smoothstep(1.18 - thr - 0.09, 1.18 - thr, fray) + smoothstep(0.24, 0.32, hole) * step(0.25, uDmg);
      c = mix(c, vec3(0.12, 0.08, 0.05), clamp(edge, 0.0, 1.0) * 0.85);
      c *= vSh * uLight; c += vec3(1.0, 0.7, 0.4) * uFlash * 0.25;
      gl_FragColor = vec4(c, 1.0);
    }`;
  function flagMesh(w, h, big) { const U = { map: { value: flagTex(big) }, uT: { value: 0 }, uWind: { value: 1 }, uFall: { value: 0 }, uDmg: { value: 0 }, uLight: { value: 0.5 }, uFlash: { value: 0 } };
    const g = new THREE.PlaneGeometry(w, h, 24, 10); g.translate(w / 2, -h / 2, 0); const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: FLAGV, fragmentShader: FLAGF, side: THREE.DoubleSide }));
    m.userData.U = U; m.frustumCulled = false; return m; }
  const STORM = flagMesh(7.2, 4.6, false), GARR = flagMesh(12, 7.6, true); FS.add(STORM, GARR); GARR.visible = false;
  // (the flag canvases are sRGB textures: WebGL2 decodes them to linear on sampling; the render target is linear and the post pass encodes)

  // ================= layout (portrait / landscape) =================
  const LAY = { w: 0, h: 0, poleX: -10, poleZ: -26, flagTop: 20 };
  function layout() {
    const w = VW(), h = VH(); if (w === LAY.w && h === LAY.h) return; LAY.w = w; LAY.h = h; const a = w / h;
    const vfov = clamp(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(36)) / a) * 180 / Math.PI, 46, 92); FC.fov = vfov; FC.aspect = a; FC.updateProjectionMatrix();
    CAMP.hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(vfov / 2)) * a) * 180 / Math.PI; CAMP.pitch = a < 1 ? 0.05 : -0.05;
    const tanH = Math.tan(THREE.MathUtils.degToRad(CAMP.hfov / 2)), tanV = Math.tan(THREE.MathUtils.degToRad(vfov / 2));
    LAY.poleZ = -26; LAY.poleX = -26 * tanH * (a < 1 ? 0.78 : 0.66); LAY.flagTop = 7.6 + 26 * Math.tan(Math.atan(tanV) * 0.78 + CAMP.pitch);
    POLE.position.set(LAY.poleX, LAY.flagTop - 40.2 + 1.2, LAY.poleZ); STORM.position.set(LAY.poleX + 0.2, LAY.flagTop, LAY.poleZ); GARR.position.set(LAY.poleX + 0.2, LAY.flagTop, LAY.poleZ);
    const sc = a < 1 ? 0.92 : 1; STORM.scale.setScalar(sc); GARR.scale.setScalar(sc);
    D.x.style.left = '0px'; D.x.style.top = '0px'; root.style.width = w + 'px'; root.style.height = h + 'px';
  }
  const halfW = (z) => Math.abs(z) * Math.tan(THREE.MathUtils.degToRad(CAMP.hfov / 2)) + 4; // visible half-width at depth z
  const fortPt = (out, y0 = 6.8, y1 = 9.2) => { const z = rnd(-8.5, -6.5), hw = Math.abs(z) * Math.tan(THREE.MathUtils.degToRad(CAMP.hfov / 2)) * 0.62; return out.set(rnd(-hw, hw), rnd(y0, y1), z); }; // where enemy shots land: on screen, just over the parapet

  // ================= music: The Star-Spangled Banner (J. S. Smith tune, public domain), fife + drums, written out here =================
  // melody in C (beats; quarter = 1), sounded in B-flat an octave up on the fife. A = "O say can you see ... last gleaming" (+ "whose broad" pickup),
  // B = "And the rockets' red glare ... flag was still there", C = "O say does that star-spangled banner yet wave", D = "O'er the land of the free and the home of the brave".
  const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const parse = (s) => s.trim().split(/\s+/).filter((t) => t !== '|').map((t) => { const [n, d] = t.split(':'), m = /^([A-G])(#|b)?(\d)$/.exec(n); return [12 * (+m[3] + 1) + NOTES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), +d]; });
  const SEC = {
    A: parse('G4:.75 E4:.25 | C4:1 E4:1 G4:1 | C5:2 E5:.75 D5:.25 | C5:1 E4:1 F#4:1 | G4:2 G4:.5 G4:.5 | E5:1.5 D5:.5 C5:1 | B4:2 A4:.75 B4:.25 | C5:1 C5:1 G4:1 | E4:1 C4:1'),
    B: parse('E5:.5 E5:.5 | E5:1 F5:1 G5:1 | G5:2 F5:.75 E5:.25 | D5:1 E5:1 F5:1 | F5:2 F5:1 | E5:1.5 D5:.5 C5:1 | B4:2 A4:.75 B4:.25 | C5:1 E4:1 F#4:1 | G4:3'),
    C: parse('G4:1 | C5:1.5 C5:.5 C5:.5 B4:.5 | A4:1 A4:1 A4:1 | D5:1 F5:.5 E5:.5 D5:.5 C5:.5 | C5:2 B4:1'),
    D: parse('G4:.5 G4:.5 | C5:1.5 D5:.5 E5:.5 F5:.5 | G5:3 | C5:.5 D5:.5 E5:1.5 F5:.5 | D5:1 C5:4'),
  };
  const beatsOf = (L) => L.reduce((a, n) => a + n[1], 0);
  const LOOP = [...SEC.A, ...SEC.A, ...SEC.B], LOOPB = beatsOf(LOOP);
  const THIRD = { 0: -3, 2: -3, 4: -4, 5: -3, 6: -4, 7: -3, 9: -4, 11: -4 }; // diatonic third below in C (F# -> D)
  const MUS = { bus: null, comp: null, seq: null, i: 0, nextT: 0, beatT: 0, beat: 0, bpm: 88, lvl: 1, on: false, notes: 0, hits: 0 };
  function musInit() {
    if (!AC || MUS.bus) return; try { MUS.comp = AC.createDynamicsCompressor(); MUS.comp.threshold.value = -14; MUS.comp.ratio.value = 4; MUS.comp.connect(AC.destination);
      MUS.bus = AC.createGain(); MUS.bus.gain.value = 0.0001; MUS.bus.connect(MUS.comp); MUS.sfx = AC.createGain(); MUS.sfx.gain.value = 0.9; MUS.sfx.connect(MUS.comp); } catch (e) { MUS.bus = null; }
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const acT = (gt) => AC.currentTime + Math.max(0, (gt - F.mt) / (SIM || 1)); // game time -> audio clock
  function fife(m, t, dur, vol, wave = 'triangle') { if (!MUS.bus) return; try {
    const o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter(), lfo = AC.createOscillator(), lg = AC.createGain();
    const f = mtof(m); o.type = wave; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f * 1.002; lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 3.2);
    lfo.frequency.value = 5.6; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const g2 = AC.createGain(); g2.gain.value = 0.16; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(MUS.bus);
    const d = Math.max(0.08, dur * 0.92); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.025); g.gain.setTargetAtTime(vol * 0.7, t + 0.06, 0.12); g.gain.setTargetAtTime(0.0001, t + d - 0.03, 0.03);
    o.start(t); o2.start(t); lfo.start(t); o.stop(t + d + 0.2); o2.stop(t + d + 0.2); lfo.stop(t + d + 0.2); MUS.notes++; } catch (e) {} }
  function drum(kind, t, vol = 1) { if (!MUS.bus || !NOISE) return; try {
    const g = AC.createGain(); g.connect(MUS.bus);
    if (kind === 'bass') { const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22); o.connect(g); g.gain.setValueAtTime(0.55 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32); o.start(t); o.stop(t + 0.34); }
    else if (kind === 'snare') { const s = AC.createBufferSource(); s.buffer = NOISE; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.7; s.connect(bp); bp.connect(g);
      const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.05); const og = AC.createGain(); og.gain.setValueAtTime(0.18 * vol, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); o.connect(og); og.connect(MUS.bus);
      g.gain.setValueAtTime(0.32 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11); s.start(t, Math.random() * 0.2); s.stop(t + 0.13); o.start(t); o.stop(t + 0.08); }
    else if (kind === 'crash') { const s = AC.createBufferSource(); s.buffer = NOISE; s.loop = true; const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200; s.connect(hp); hp.connect(g); g.gain.setValueAtTime(0.2 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); s.start(t); s.stop(t + 1.7); }
    MUS.hits++; } catch (e) {} }
  function musStart(seq, bpm, lvl, loop, t0 = F.mt) { musInit(); MUS.seq = seq; MUS.i = 0; MUS.nextT = t0 + 0.05; MUS.beatT = MUS.nextT; MUS.beat = 0; MUS.bpm = bpm; MUS.lvl = lvl; MUS.loop = loop; MUS.on = true; MUS.roll = 0;
    if (MUS.bus) try { MUS.bus.gain.cancelScheduledValues(AC.currentTime); MUS.bus.gain.setTargetAtTime(0.75, AC.currentTime, 0.2); } catch (e) {} }
  function musStop(fade = 0.6) { MUS.on = false; MUS.rollUntil = 0; if (MUS.bus) try { MUS.bus.gain.cancelScheduledValues(AC.currentTime); MUS.bus.gain.setTargetAtTime(0.0001, AC.currentTime, fade / 3); } catch (e) {} }
  function musRoll(sec) { musInit(); MUS.rollUntil = F.mt + sec; MUS.rollT = F.mt; if (MUS.bus) try { MUS.bus.gain.cancelScheduledValues(AC.currentTime); MUS.bus.gain.setTargetAtTime(0.75, AC.currentTime, 0.1); } catch (e) {} }
  function musTick() {
    if (!AC || AC.state !== 'running' || !MUS.bus) return; const ahead = F.mt + 0.3;
    if (MUS.rollUntil && MUS.rollUntil > F.mt) { while (MUS.rollT < Math.min(ahead, MUS.rollUntil)) { const u = 1 - (MUS.rollUntil - MUS.rollT) / 2.4; drum('snare', acT(MUS.rollT), 0.35 + 0.5 * clamp(u, 0, 1)); MUS.rollT += 0.055; }
      if (MUS.rollUntil - MUS.rollT < 0.06 && !MUS.rollCrash) { MUS.rollCrash = true; drum('crash', acT(MUS.rollUntil), 0.9); drum('bass', acT(MUS.rollUntil), 1); } }
    else MUS.rollCrash = false;
    if (!MUS.on || !MUS.seq) return; const spb = 60 / MUS.bpm;
    while (MUS.nextT < ahead) { // melody
      if (MUS.i >= MUS.seq.length) { if (!MUS.loop) { MUS.seq = null; break; } MUS.i = 0; }
      const [m, b] = MUS.seq[MUS.i++], dur = b * spb * (MUS.fermata && MUS.i >= MUS.seq.length - 0 ? 1.6 : 1), t = acT(MUS.nextT), L = MUS.lvl;
      fife(m + 10, t, dur, 0.16); if (L >= 2) fife(m + 10 + (THIRD[m % 12] ?? -3), t, dur, 0.08); if (L >= 3) fife(m - 2, t, dur, 0.07, 'sawtooth');
      MUS.nextT += b * spb; }
    while (MUS.beatT < Math.min(ahead, MUS.nextT + 0.01)) { // drums on the beat grid
      const bb = MUS.beat % 3, t = acT(MUS.beatT), L = MUS.lvl;
      if (bb === 0) { drum('bass', t, 0.9); if (MUS.beat % 24 === 0 && L >= 3) drum('crash', t, 0.5); } else if (L >= 3 && bb === 2) drum('bass', t, 0.4);
      drum('snare', t, bb === 0 ? 0.9 : 0.55);
      if (L >= 2) drum('snare', acT(MUS.beatT + spb / 2), 0.35);
      if (L >= 3 && bb === 2) for (let k = 1; k <= 3; k++) drum('snare', acT(MUS.beatT + spb / 2 + k * spb / 8), 0.25 + k * 0.08);
      if (L >= 4) { drum('snare', acT(MUS.beatT + spb / 4), 0.25); drum('snare', acT(MUS.beatT + spb * 3 / 4), 0.25); }
      MUS.beat++; MUS.beatT += spb; }
  }
  // set-piece sfx (own bus: the radio's duck of the game sfx bus doesn't touch these)
  function boom(kind, vol = 1) { if (!AC || AC.state !== 'running' || !NOISE) return; musInit(); if (!MUS.sfx) return; const t = AC.currentTime; try {
    const g = AC.createGain(); g.connect(MUS.sfx);
    if (kind === 'cannon' || kind === 'explode' || kind === 'far') { const s = AC.createBufferSource(); s.buffer = NOISE; s.loop = true; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; const big = kind !== 'far';
      lp.frequency.setValueAtTime(kind === 'cannon' ? 1800 : big ? 1200 : 500, t); lp.frequency.exponentialRampToValueAtTime(120, t + (big ? 0.7 : 0.5)); s.connect(lp); lp.connect(g);
      const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(kind === 'cannon' ? 90 : 70, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.4); const og = AC.createGain(); og.gain.setValueAtTime(0.6 * vol, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(og); og.connect(MUS.sfx);
      g.gain.setValueAtTime((kind === 'far' ? 0.18 : 0.42) * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.9 : 0.6)); s.start(t); s.stop(t + 1); o.start(t); o.stop(t + 0.55); }
    else if (kind === 'splash') { const s = AC.createBufferSource(); s.buffer = NOISE; s.loop = true; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(1400, t); bp.frequency.exponentialRampToValueAtTime(500, t + 0.5); s.connect(bp); bp.connect(g); g.gain.setValueAtTime(0.16 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); s.start(t); s.stop(t + 0.62); }
    else if (kind === 'whistle') { const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(2200, t); o.frequency.exponentialRampToValueAtTime(700, t + 1.3); o.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * vol, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35); o.start(t); o.stop(t + 1.4); }
    else if (kind === 'hiss') { const s = AC.createBufferSource(); s.buffer = NOISE; s.loop = true; const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000; s.connect(hp); hp.connect(g); g.gain.setValueAtTime(0.09 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); s.start(t); s.stop(t + 0.72); }
    else if (kind === 'pop') { const o = AC.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(rnd(500, 900), t); o.frequency.exponentialRampToValueAtTime(120, t + 0.15); o.connect(g); g.gain.setValueAtTime(0.07 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.start(t); o.stop(t + 0.2); }
    else if (kind === 'click') { const o = AC.createOscillator(); o.type = 'square'; o.frequency.value = 1400; o.connect(g); g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); o.start(t); o.stop(t + 0.04); }
  } catch (e) {} }

  // ================= waves =================
  const WAVES = [
    { name: 'THE SLOOPS', sub: 'Shoot the cannonballs out of the air!', lyric: '“O say can you see, by the dawn’s early light…”', bpm: 88, lvl: 1, dawn: 0.0, max: 3,
      spawn: [[0.5, 'sloop', -55], [3, 'sloop', -74], [10, 'sloop', -62], [16, 'sloop', -81], [22, 'sloop', -59], [28, 'sloop', -71]] },
    { name: 'BOMB KETCHES', sub: 'Pop the mortar shells before they burst!', lyric: '“…the bombs bursting in air…”', bpm: 96, lvl: 2, dawn: 0.24, max: 3,
      spawn: [[0.5, 'ketch', -99], [4, 'ketch', -111], [9, 'sloop', -59], [15, 'ketch', -94], [21, 'sloop', -69], [27, 'ketch', -106]] },
    { name: 'ROCKETS’ RED GLARE', sub: 'Knock the rockets down!', lyric: '“And the rockets’ red glare…”', bpm: 104, lvl: 3, dawn: 0.48, max: 3,
      spawn: [[0.5, 'rocket', -87], [7, 'sloop', -60], [14, 'sloop', -72], [22, 'ketch', -108]] },
    { name: 'THE FLAGSHIP', sub: 'Admiral Redclaw himself!', lyric: '“O say does that star-spangled banner yet wave…”', bpm: 112, lvl: 4, dawn: 0.72, max: 3,
      spawn: [[0.5, 'flag', -81], [9, 'sloop', -59], [19, 'ketch', -109]] },
  ];
  const ships = [], projs = [];
  let shipId = 0;
  function spawnShip(type, z) {
    const T = SHIP[type], used = new Set(ships.filter((s) => s.type === type).map((s) => s.slot)); let slot = 0; while (used.has(slot)) slot++; if (slot >= T.max) return null;
    const dir = Math.random() < 0.5 ? 1 : -1, s = { id: ++shipId, type, T, slot, z, dir, x: -dir * (halfW(z) + T.L * 0.7), hp: T.hp, fireT: rnd(1.6, 2.6), state: 'sail', t: 0, ph: rnd(0, TAU), flash: 0, sinkT: 0, burn: 0, anchorX: T.anchor ? rnd(-0.45, 0.45) * halfW(z) * (type === 'flag' ? 0.3 : 1) : 0, vis: 0, turned: 0 };
    ships.push(s); F.stats.spawned++; return s;
  }
  function onScreen(s) { return Math.abs(s.x) < halfW(s.z) - 6; }
  function shipFire(s) {
    const T = s.T, side = _a.set(s.x + rnd(-T.L * 0.25, T.L * 0.25), 2.2, s.z + 2.2);
    const tgt = () => fortPt(_b);
    if (T.weapon === 'ball') { launch('ball', side, tgt(), rnd(2.9, 3.4)); muzzle(side, 1); boom('far', 0.8); }
    else if (T.weapon === 'shell') { const p = _a.set(s.x + s.dir * 4, 3.4, s.z); launch('shell', p, _b.set(rnd(-4, 4), 15, -9), rnd(4.6, 5.4)); muzzle(p, 1.6, true); boom('far', 1.1); }
    else if (T.weapon === 'rocket') { const n = WAVES[F.wave].lvl >= 4 ? 2 : 3; for (let k = 0; k < n; k++) F.queue.push({ t: F.wt + k * 0.45, f: () => { if (s.state !== 'sail' && s.state !== 'anchor') return; const p = V3(s.x - s.dir * 5, 4.2, s.z); launch('rocket', p, fortPt(V3(), 7, 9.6), rnd(2.5, 2.9)); boom('hiss'); for (let i = 0; i < 10; i++) FX.emit(p.x, p.y, p.z, rnd(-2, 2), rnd(1, 4), rnd(-2, 2), 0.4, 1.4, 0.4, COL.redg, 1); } }); }
    else if (T.weapon === 'broadside') {
      for (let k = 0; k < 3; k++) F.queue.push({ t: F.wt + k * 0.32, f: () => { if (s.state !== 'anchor' && s.state !== 'sail') return; const p = V3(s.x + (k - 1) * 7, 2.6, s.z + 3.5); launch('ball', p, fortPt(V3()), rnd(3.1, 3.6)); muzzle(p, 1.3); boom('far', 0.9); } });
      s.rk = (s.rk || 0) + 1; if (s.rk % 2 === 0) for (let k = 0; k < 2; k++) F.queue.push({ t: F.wt + 1.4 + k * 0.5, f: () => { if (s.state !== 'anchor' && s.state !== 'sail') return; const p = V3(s.x - s.dir * 11, 6, s.z); launch('rocket', p, fortPt(V3(), 7, 9.6), rnd(2.6, 3.0)); boom('hiss'); } });
    }
  }
  function launch(kind, p0, p1, T) {
    const g = kind === 'rocket' ? 0 : kind === 'shell' ? -9.5 : -6.5, v0 = V3((p1.x - p0.x) / T, (p1.y - p0.y - 0.5 * g * T * T) / T, (p1.z - p0.z) / T);
    projs.push({ kind, p0: p0.clone(), p1: p1.clone(), v0, g, T, t: 0, pos: p0.clone(), alive: true, whistled: false, wob: rnd(0, TAU), arc: rnd(5, 9) }); F.stats.incoming++;
  }
  function projPos(p, t, out) {
    if (p.kind === 'rocket') { const u = t / p.T; out.lerpVectors(p.p0, p.p1, u); out.y += 4 * p.arc * u * (1 - u); out.x += Math.sin(t * 7 + p.wob) * 0.9 * u; return out; }
    return out.set(p.p0.x + p.v0.x * t, p.p0.y + p.v0.y * t + 0.5 * p.g * t * t, p.p0.z + p.v0.z * t);
  }
  function muzzle(p, k = 1, up = false, dz = 1) { // dz: +1 = toward the fort (enemy guns), -1 = out over the water (our cannon)
    for (let i = 0; i < 14 * Math.max(k, 0.6); i++) FX.emit(p.x, p.y, p.z, rnd(-3, 3) * k, rnd(0, 4) * k + (up ? 6 : 0), rnd(0, 6) * k * dz, rnd(0.15, 0.35), rnd(1.5, 3) * k, 0.5, i % 3 ? COL.fire : COL.hot, 1, 3);
    for (let i = 0; i < 6 * Math.max(k, 0.6); i++) SM.emit(p.x, p.y, p.z, rnd(-1, 1) * k, rnd(0.5, 2) * k + (up ? 2 : 0), rnd(0, 2) * k * dz + (dz < 0 ? -3 : 0), rnd(1.0, 1.8), rnd(2, 3) * k, rnd(5, 8) * k, COL.smokeL, dz < 0 ? 0.35 : 0.5, 0.6, 0.3);
    F.flash = Math.max(F.flash, 0.25 * k);
  }
  function explode(p, k = 1, water = false) {
    for (let i = 0; i < 26 * k; i++) { const a = rnd(0, TAU), e = rnd(-0.5, 1), sp = rnd(4, 12) * k; FX.emit(p.x, p.y, p.z, Math.cos(a) * sp, e * sp, Math.sin(a) * sp, rnd(0.25, 0.6), rnd(1.6, 3.4) * k, 0.4, i % 4 ? COL.fire : COL.hot, 1, 2.5, -6); }
    for (let i = 0; i < 12 * k; i++) { const a = rnd(0, TAU), sp = rnd(1, 4) * k; SM.emit(p.x, p.y, p.z, Math.cos(a) * sp, rnd(0.5, 3), Math.sin(a) * sp, rnd(1.6, 3), rnd(2.5, 4) * k, rnd(7, 12) * k, COL.smoke, 0.75, 0.8, 0.4); }
    if (water) splash(p, k);
    F.flash = Math.max(F.flash, 0.6 * k);
  }
  function splash(p, k = 1) { for (let i = 0; i < 30 * k; i++) { const a = rnd(0, TAU), r = rnd(0, 1.5) * k; SM.emit(p.x + Math.cos(a) * r, 0.3, p.z + Math.sin(a) * r, Math.cos(a) * rnd(0.5, 3), rnd(5, 13) * Math.sqrt(k), Math.sin(a) * rnd(0.5, 3), rnd(0.8, 1.5), rnd(0.8, 1.6) * k, 0.4, COL.spray, 0.9, 0.3, -14); } boom('splash', Math.min(1.4, k)); }
  function burst(p, cols, n = 90, sp = 14) { for (let i = 0; i < n; i++) { const u = rnd(-1, 1), a = rnd(0, TAU), r = Math.sqrt(1 - u * u), s = sp * rnd(0.85, 1), big = sp > 12 ? 1.6 : 1; FX.emit(p.x, p.y, p.z, r * Math.cos(a) * s, u * s, r * Math.sin(a) * s, rnd(1.2, 2.0), rnd(1.4, 2.2) * big, 0.5 * big, cols[i % cols.length], 1, 1.6, -3.2, 1); } boom('pop', 1.2); }

  // ================= player fire =================
  const AIM = { x: 0, y: 0.05, cool: 0, reload: 0.5 };
  const ray = new THREE.Raycaster();
  function toScreen(p, out) { _c.copy(p).project(FC); out.x = (_c.x * 0.5 + 0.5) * LAY.w; out.y = (-_c.y * 0.5 + 0.5) * LAY.h; out.z = _c.z; return out; }
  const _s1 = { x: 0, y: 0, z: 0 }, _s2 = { x: 0, y: 0, z: 0 }, _s3 = { x: 0, y: 0, z: 0 };
  function findTarget(ndx, ndy) { // screen-space hit test (touch friendly): projectiles first, then the admiral, then ships
    const sx = (ndx * 0.5 + 0.5) * LAY.w, sy = (-ndy * 0.5 + 0.5) * LAY.h; let best = null, bd = 1e9;
    for (const p of projs) { if (!p.alive) continue; toScreen(p.pos, _s1); if (_s1.z > 1) continue; const dist = p.pos.distanceTo(FC.position), rpx = (p.kind === 'shell' ? 1.1 : 0.9) / dist * LAY.h / (2 * Math.tan(THREE.MathUtils.degToRad(FC.fov / 2)));
      const d = Math.hypot(_s1.x - sx, _s1.y - sy), lim = Math.max(38, rpx * 2.2); if (d < lim && d < bd) { bd = d; best = { kind: 'proj', p }; } }
    if (best) return best;
    if (ADM.on && ADM.g && ADM.hp > 0) { ADM.g.getWorldPosition(_a); _a.y += 1.4; toScreen(_a, _s1); _a.y += 2; toScreen(_a, _s2); const r = Math.max(34, Math.abs(_s2.y - _s1.y) * 1.1);
      if (Math.hypot(_s1.x - sx, _s1.y - sy) < r) return { kind: 'adm' }; }
    let sb = null, sd = 1e9;
    for (const s of ships) { if (s.state === 'sink' || s.state === 'gone') continue; const L = s.T.L / 2;
      toScreen(_a.set(s.x - L, 0, s.z), _s1); toScreen(_a.set(s.x + L, 0, s.z), _s2); toScreen(_a.set(s.x, s.T.H, s.z), _s3);
      const x0 = Math.min(_s1.x, _s2.x) - 8, x1 = Math.max(_s1.x, _s2.x) + 8, y0 = _s3.y - 8, y1 = Math.max(_s1.y, _s2.y) + 10;
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) { const d = Math.abs(s.z); if (d < sd) { sd = d; sb = { kind: 'ship', s }; } } }
    return sb;
  }
  function fire(ndx, ndy, why) {
    if (F.phase !== 'wave' && F.phase !== 'boss') return false; if (AIM.cool > 0) { boom('click'); return false; }
    AIM.x = clamp(ndx, -1, 1); AIM.y = clamp(ndy, -1, 1); AIM.cool = AIM.reload; F.stats.shots++; if (why === 'tap') F.stats.taps++;
    const tg = findTarget(AIM.x, AIM.y);
    ray.setFromCamera({ x: AIM.x, y: AIM.y }, FC); let hit;
    if (tg && tg.kind === 'proj') hit = tg.p.pos.clone();
    else if (tg && tg.kind === 'ship') { const t = (tg.s.z - ray.ray.origin.z) / ray.ray.direction.z; hit = ray.ray.at(t, V3()); hit.y = clamp(hit.y, 0.5, tg.s.T.H); }
    else if (tg && tg.kind === 'adm') { ADM.g.getWorldPosition(_a); hit = _a.clone(); hit.y += 1.5; }
    else { const t = ray.ray.direction.y < -0.002 ? -ray.ray.origin.y / ray.ray.direction.y : 340; hit = ray.ray.at(Math.min(t, 340), V3()); }
    BARREL.updateWorldMatrix(true, false); const mz = BARREL.localToWorld(V3(0, 0, -2.45)); muzzle(mz, 0.3, false, -1); F.flash = Math.max(F.flash, 0.3); boom('cannon'); CAMP.shake = Math.max(CAMP.shake, 0.35); F.recoil = 1;
    const dist = mz.distanceTo(hit), T = clamp(dist / 260, 0.06, 0.38);
    F.shots.push({ a: mz, b: hit, t: 0, T, tg, water: !tg && hit.y < 0.5 && hit.z > -330 }); return true;
  }
  function resolveShot(sh) {
    const tg = sh.tg;
    if (!tg) { if (sh.water) splash(sh.b, 0.7); return; }
    if (tg.kind === 'proj') { const p = tg.p; if (!p.alive) { if (sh.b.y < 0.5) splash(sh.b, 0.6); return; } p.alive = false; F.stats.downed++; F.score += 25 + (p.kind === 'shell' ? 15 : p.kind === 'rocket' ? 20 : 0);
      if (p.kind === 'shell') burst(p.pos, [COL.fire, COL.spark, COL.white], 60, 9); else explode(p.pos, p.kind === 'rocket' ? 0.8 : 0.6); pop(p.pos, '+' + (25 + (p.kind === 'shell' ? 15 : p.kind === 'rocket' ? 20 : 0))); return; }
    if (tg.kind === 'adm') { if (ADM.hp <= 0) return; ADM.hp--; ADM.hitT = 0.35; F.stats.hits++; explode(sh.b, 0.6); pop(sh.b, ADM.hp > 0 ? 'OUCH!' : 'RETREAT!');
      if (ADM.hp <= 0) admiralDown(); else if (Math.random() < 0.6) say(pick(['Ow! My shell!', 'Not the hat!', 'Fire, you lubbers! FIRE!'])); return; }
    const s = tg.s; if (s.state === 'sink' || s.state === 'gone') { splash(sh.b, 0.6); return; }
    if (s.type === 'flag' && s.hp <= 0) { explode(sh.b, 0.7); return; } // crippled flagship: only the admiral counts now
    s.hp--; s.flash = 1; F.stats.hits++; explode(sh.b, s.hp <= 0 ? 1.3 : 0.8, sh.b.y < 1.2); s.burn = Math.min(1, s.burn + 1 / s.T.hp);
    if (s.hp <= 0) { if (s.type === 'flag') flagshipCrippled(s); else sinkShip(s); }
  }
  function sinkShip(s) { s.state = 'sink'; s.sinkT = 0; F.stats.sunk++; F.score += s.T.pts; pop(_a.set(s.x, s.T.H * 0.6, s.z), '+' + s.T.pts + ' SUNK!'); explode(_a.set(s.x, 3, s.z), 1.6, true); boom('explode', 1.2); }
  function flagshipCrippled(s) { s.state = 'crippled'; s.burn = 1; F.score += 500; pop(_a.set(s.x, s.T.H * 0.6, s.z), '+500 CRIPPLED!'); explode(_a.set(s.x, 4, s.z), 2, true); boom('explode', 1.4);
    F.phase = 'boss'; ADM.on = true; fbanner('ADMIRAL REDCLAW', 'Shoot the admiral on the quarterdeck!', 2.6); say(adLine('intro')); }
  function admiralDown() { const s = ships.find((q) => q.type === 'flag'); F.score += 1500; F.stats.admiral = true; say(adLine('defeat')); if (s) { s.state = 'sink'; s.sinkT = 0; s.fromAdm = true; F.stats.sunk++; explode(_a.set(s.x, 5, s.z), 2.4, true); } boom('explode', 1.6); F.endT = F.wt + 3.6;
    for (const q of ships) if (q !== s && (q.state === 'sail' || q.state === 'anchor')) { q.state = 'flee'; q.dir = q.x >= 0 ? 1 : -1; }
    for (const p of projs) if (p.alive) { p.alive = false; explode(p.pos, 0.4); } }
  const adLine = (k) => { const L = (typeof GR1 !== 'undefined' && GR1.bosses && GR1.bosses.admiral_redclaw && GR1.bosses.admiral_redclaw[k]) || ['Hrrmph!']; return pick(L); };
  // ---- little DOM pops (score), admiral speech ----
  const POPS = []; for (let i = 0; i < 6; i++) { const b = document.createElement('b'); b.style.opacity = '0'; D.pops.appendChild(b); POPS.push({ el: b, t: 0, p: V3() }); }
  let popI = 0; function pop(p, txt) { const P = POPS[popI++ % POPS.length]; P.el.textContent = txt; P.t = 1.1; P.p.copy(p); P.el.style.opacity = '1'; }
  function say(line) { if (!line) return; const el = $('fsay'); el.innerHTML = '<b>ADMIRAL REDCLAW</b>“' + line + '”'; el.classList.add('on'); F.sayT = 2.8; F.log.push('say:' + line); }
  function fbanner(t, sub, life = 2.4) { D.ban.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); D.ban.classList.add('on'); F.banT = life; }
  function caption(t, life = 6) { D.cap.textContent = t; D.cap.classList.add('on'); F.capT = life; }

  // ================= flow =================
  function newStats() { return { spawned: 0, sunk: 0, shots: 0, taps: 0, hits: 0, downed: 0, incoming: 0, flagHits: 0, admiral: false, waveSec: [], t0: performance.now() }; }
  function enter(why) {
    if (F.on) return; audioInit(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
    F.on = true; F.runs++; F.why = why; F.world = { x: hero.pos.x, z: hero.pos.z, yaw: hero.yaw, camYaw: CAM.yaw };
    document.body.classList.add('fort'); layout(); try { window.__radio && __radio.hold && __radio.hold(true); } catch (e) {}
    F.stats = newStats(); F.score = 0; F.flag = 100; F.wave = Q.has('fortwave') ? clamp(+Q.get('fortwave') - 1, 0, 3) : 0; F.dawn = WAVES[F.wave].dawn; F.mt = 0; F.t = 0; F.log = [];
    F.shots = []; F.queue = []; ships.length = 0; projs.length = 0; FX.clear(); SM.clear(); ADM.on = false; if (ADM.g) { ADM.g.parent && ADM.g.parent.remove(ADM.g); ADM.g = null; }
    STORM.visible = true; GARR.visible = false; STORM.userData.U.uFall.value = 0; F.fallT = 0; AIM.x = 0; AIM.y = 0.05; AIM.cool = 0.4; F.flagShown = -1;
    if (APANEL) APANEL.setAct({ kind: 'cannon', label: 'FIRE' }, 1);
    blk.style.transition = 'none'; blk.style.opacity = '1'; F.fadeIn = 0.7;
    fbanner('THE BOMBARDMENT', 'Fort McHenry · 1814', 3.2); D.hint.textContent = TOUCH ? 'TAP TO AIM + FIRE · ✕ TO LEAVE' : 'CLICK / SPACE TO FIRE · WASD OR STICK AIMS · PAD A FIRES · ESC LEAVES'; D.hint.classList.add('on'); F.hintT = 6;
    F.phase = 'intro'; F.pt = 0; musRoll(2.6); F.log.push('enter:' + why);
  }
  function startWave(i) {
    const W = WAVES[i]; F.wave = i; F.phase = 'wave'; F.wt = 0; F.spawnI = 0; F.spawn = W.spawn.map((a) => a.slice()); MUS.fermata = false; F.endT = 0; F.queue = []; F.waveStart = F.t; AIM.reload = i >= 3 ? 0.42 : 0.5;
    fbanner('WAVE ' + (i + 1) + ' · ' + W.name, W.sub, 2.6); caption(W.lyric, 7); musStart(LOOP, W.bpm, W.lvl, true); F.log.push('wave:' + (i + 1));
  }
  function waveDone() {
    F.stats.waveSec.push(+(F.t - F.waveStart).toFixed(1)); F.log.push('clear:' + (F.wave + 1));
    for (const p of projs) if (p.alive) { p.alive = false; explode(p.pos, 0.4); }
    if (F.wave >= WAVES.length - 1) { win(); return; }
    F.phase = 'inter'; F.pt = 0; F.flag = Math.min(100, F.flag + 10); musStop(0.8); musRoll(2.4); fbanner('WAVE ' + (F.wave + 1) + ' CLEARED', 'The garrison patches the flag', 2.4); F.next = F.wave + 1;
  }
  function win() {
    F.phase = 'win'; F.pt = 0; musStop(0.4); F.wins++; caption('“O’er the land of the free and the home of the brave”', 16);
    // the anthem's last two lines at a broad tempo: C (storm flag comes down, crowd hush) then D, the final phrase, timed to the garrison flag going up
    const bpm = 76, spb = 60 / bpm; F.raise = { t0: beatsOf(SEC.C) * spb + 0.6, dur: (beatsOf(SEC.D) - 4) * spb + 4 * spb * 1.6 }; F.raise.end = F.raise.t0 + F.raise.dur;
    MUS.fermata = true; musStart([...SEC.C, ...SEC.D], bpm, 4, false, F.mt + 0.6); fbanner('THE FLAG WAS STILL THERE!', 'The fleet withdraws at dawn', 3);
  }
  function lose() { F.phase = 'lose'; F.pt = 0; F.losses++; D.ban.classList.remove('on'); D.cap.classList.remove('on'); F.banT = F.capT = 0; musStop(0.3); drum('bass', AC ? AC.currentTime : 0, 1); D.end.querySelector('h2').textContent = 'THE FLAG HAS FALLEN'; D.end.querySelector('p').textContent = 'Wave ' + (F.wave + 1) + ' of 4 · Score ' + F.score + '. Raise it again?';
    $('fretry').style.display = ''; $('fleave').textContent = 'LEAVE'; F.log.push('lose:' + (F.wave + 1)); }
  function retry() { if (F.phase !== 'lose') return; D.end.classList.remove('on'); ships.length = 0; projs.length = 0; F.shots = []; F.queue = []; FX.clear(); SM.clear(); ADM.on = false; if (ADM.g) { ADM.g.parent && ADM.g.parent.remove(ADM.g); ADM.g = null; }
    F.flag = 100; STORM.userData.U.uFall.value = 0; F.fallT = 0; F.phase = 'inter'; F.pt = 0.6; F.next = F.wave; musRoll(2.4); fbanner('RETRY · WAVE ' + (F.wave + 1), WAVES[F.wave].name, 2.2); F.log.push('retry:' + (F.wave + 1)); }
  function finish() { F.phase = 'done'; const st = F.stats, acc = st.shots ? Math.round(st.hits / Math.max(1, st.shots) * 100) : 0;
    D.end.querySelector('h2').textContent = 'FORT MCHENRY HOLDS!'; D.end.querySelector('p').innerHTML = `Ships sunk ${st.sunk} · Shots downed ${st.downed}<br>Flag ${Math.round(F.flag)}% · Score ${F.score}`;
    $('fretry').style.display = 'none'; $('fleave').textContent = 'CONTINUE'; D.end.classList.add('on'); F.doneT = 0; F.log.push('done'); }
  function leave(won) {
    if (!F.on || F.leaving) return; F.leaving = true; blk.style.transition = 'opacity .35s'; blk.style.opacity = '1';
    setTimeout(() => { // restore the city
      F.on = false; F.leaving = false; F.phase = 'off'; document.body.classList.remove('fort'); D.end.classList.remove('on'); D.ban.classList.remove('on'); D.cap.classList.remove('on'); D.hint.classList.remove('on'); $('fsay').classList.remove('on');
      musStop(0.2); try { window.__radio && __radio.hold && __radio.hold(false); } catch (e) {}
      const st = CAN.stand; hero.pos.set(st.x, groundY(st.x, st.z + 0.6), st.z + 0.6); hero.vel.set(0, 0); hero.yaw = Math.PI; CAM.yaw = 0; snapCam(); IN.dragX = IN.dragY = 0; PRESS.clear(); KEYS.clear();
      if (Math.hypot(partner.pos.x - st.x, partner.pos.z - st.z) > 12) partner.pos.set(st.x + 1.2, groundY(st.x + 1.2, st.z + 2), st.z + 2);
      if (won) { const first = !BOSS_CLEAR.cleared.has('fort'); BOSS_CLEAR.clear('fort', { how: 'bombardment', score: F.score, flag: Math.round(F.flag), sunk: F.stats.sunk }); banner(first ? 'FORT MCHENRY CLEARED!' : 'FORT MCHENRY HELD AGAIN!', 3.2); setTimeout(() => { try { BARK.bossDefeat('fort'); } catch (e) {} }, 900); F.log.push('cleared:' + first); }
      F.log.push('leave:' + (won ? 'won' : 'quit')); last = performance.now();
      requestAnimationFrame(() => { blk.style.transition = 'opacity .6s'; blk.style.opacity = '0'; });
    }, 380);
  }

  // ================= input =================
  const PADP = [];
  canvas.addEventListener('pointerdown', (e) => { if (!F.on || F.leaving) return; const r = canvas.getBoundingClientRect(); const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    if (F.phase === 'done') return; if (F.phase === 'wave' || F.phase === 'boss') fire(nx, ny, 'tap'); else { AIM.x = nx; AIM.y = ny; } F.lastPtr = performance.now(); });
  canvas.addEventListener('pointermove', (e) => { if (!F.on || e.pointerType !== 'mouse') return; const r = canvas.getBoundingClientRect(); AIM.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1); AIM.y = clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1); });
  addEventListener('keydown', (e) => { if (!F.on) return; const k = e.key.toLowerCase(); if (k === 'escape') { e.preventDefault(); e.stopPropagation(); leave(F.phase === 'done'); } if (k === 'tab') { e.preventDefault(); e.stopImmediatePropagation(); } }, { capture: true });
  function input(rdt) {
    let mx = 0, my = 0, fireP = false, exitP = false;
    if (KEYS.has('a') || KEYS.has('arrowleft')) mx -= 1; if (KEYS.has('d') || KEYS.has('arrowright')) mx += 1; if (KEYS.has('w') || KEYS.has('arrowup')) my += 1; if (KEYS.has('s') || KEYS.has('arrowdown')) my -= 1;
    if (TOUCHS.stick !== null) { mx += TOUCHS.x; my -= TOUCHS.y; }
    for (const k of [' ', 'j', 'k', 'e', 'enter', 'f']) if (PRESS.has(k)) fireP = true;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) { if (!gp) continue; const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v); mx += dz(gp.axes[0] || 0) + dz(gp.axes[2] || 0); my -= dz(gp.axes[1] || 0) + dz(gp.axes[3] || 0);
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed), prev = PADP[gp.index] || [];
      if ((b(0) && !prev[0]) || (b(7) && !prev[7]) || (b(2) && !prev[2]) || (b(5) && !prev[5])) fireP = true; if (b(8) && !prev[8]) exitP = true; if (b(9) && !prev[9] && (F.phase === 'lose' || F.phase === 'done')) { if (F.phase === 'lose') retry(); else leave(true); }
      PADP[gp.index] = gp.buttons.map((x) => x.pressed); DEV = 'pad'; }
    PRESS.clear();
    if (mx || my) { const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; } AIM.x = clamp(AIM.x + mx * rdt * 1.25, -0.98, 0.98); AIM.y = clamp(AIM.y + my * rdt * 1.25 * (LAY.w / LAY.h), -0.95, 0.95); }
    if (exitP) leave(F.phase === 'done');
    if (fireP) { if (F.phase === 'wave' || F.phase === 'boss') fire(AIM.x, AIM.y, 'btn'); else if (F.phase === 'lose') retry(); else if (F.phase === 'done') leave(true); }
  }
  // the test autopilot (?fortauto=1 or __fort.F.auto = true): aims at the most urgent incoming shot, else the admiral, else the nearest ship on screen
  function autoAim(rdt) {
    if (F.phase !== 'wave' && F.phase !== 'boss') { if (F.phase === 'lose' && F.pt > 1.2) retry(); return; }
    let tgt = null, best = 1e9;
    for (const p of projs) { if (!p.alive || p.t < 0.25) continue; toScreen(p.pos, _s1); if (_s1.z > 1 || _s1.x < 0 || _s1.x > LAY.w || _s1.y < 0 || _s1.y > LAY.h) continue; const left = p.T - p.t; if (left < best) { best = left; tgt = _a.copy(p.pos); } }
    if (!tgt && ADM.on && ADM.g && ADM.hp > 0) { ADM.g.getWorldPosition(_a); _a.y += 2.2; tgt = _a; }
    if (!tgt) { let bs = null; for (const s of ships) if ((s.state === 'sail' || s.state === 'anchor') && onScreen(s) && s.hp > 0 && (!bs || Math.abs(s.x) < Math.abs(bs.x))) bs = s; if (bs) tgt = _a.set(bs.x, bs.T.H * 0.3, bs.z); }
    if (!tgt) return; _c.copy(tgt).project(FC); const tx = clamp(_c.x, -0.98, 0.98), ty = clamp(_c.y, -0.95, 0.95);
    AIM.x = damp(AIM.x, tx, 14, rdt); AIM.y = damp(AIM.y, ty, 14, rdt);
    if (AIM.cool <= 0 && Math.hypot(AIM.x - tx, AIM.y - ty) < 0.04) { fire(tx, ty, 'auto'); F.stats.auto = (F.stats.auto || 0) + 1; }
  }

  // ================= simulation step =================
  function step(dt) {
    F.t += dt; F.mt += dt; F.pt += dt; AIM.cool = Math.max(0, AIM.cool - dt); F.flash = Math.max(0, (F.flash || 0) - dt * 2.2); CAMP.shake = Math.max(0, CAMP.shake - dt * 1.6); F.recoil = Math.max(0, (F.recoil || 0) - dt * 3.5);
    const W = WAVES[F.wave];
    // dawn creeps up through each wave toward the next wave's sky; the win is sunrise
    const dTarget = F.phase === 'win' || F.phase === 'done' ? 0.9 : F.phase === 'inter' ? WAVES[Math.min(3, F.next ?? F.wave)].dawn : lerp(W.dawn, F.wave < 3 ? WAVES[F.wave + 1].dawn : 0.86, clamp(F.wt / 60, 0, 0.85));
    F.dawn = damp(F.dawn, dTarget, F.phase === 'win' ? 0.25 : 0.6, dt);
    if (F.phase === 'intro' && F.pt > 2.8) startWave(F.wave);
    if (F.phase === 'inter' && F.pt > 3.2) startWave(F.next);
    if (F.phase === 'wave' || F.phase === 'boss') {
      F.wt += dt;
      const SP = F.spawn, live = () => ships.filter((s) => s.state !== 'gone' && s.state !== 'flee').length;
      while (F.spawnI < SP.length && F.wt >= SP[F.spawnI][0] && live() < W.max && F.phase !== 'win') { const [, type, z] = SP[F.spawnI]; if (spawnShip(type, z)) F.spawnI++; else break; }
      if (F.spawnI < SP.length && live() >= W.max) SP[F.spawnI][0] = Math.max(SP[F.spawnI][0], F.wt); // held back until a slot frees
      for (let i = F.queue.length - 1; i >= 0; i--) if (F.wt >= F.queue[i].t) { const q = F.queue[i]; F.queue.splice(i, 1); q.f(); }
      if (F.endT && F.wt >= F.endT) { F.endT = 0; waveDone(); }
      else if (F.phase === 'wave' && F.spawnI >= F.spawn.length && !ships.some((s) => s.state !== 'gone')) waveDone();
    }
    // ships
    for (const s of ships) {
      s.t += dt; s.flash = Math.max(0, s.flash - dt * 4);
      if (s.state === 'sail' || s.state === 'anchor') {
        const hw = halfW(s.z);
        if (s.T.anchor) { const dx = s.anchorX - s.x; if (Math.abs(dx) > 0.6 && s.state === 'sail') s.x += Math.sign(dx) * s.T.speed * dt * clamp(Math.abs(dx) / 8, 0.25, 1); else { s.state = 'anchor'; s.x += Math.sin(s.t * 0.25) * 0.4 * dt; } }
        else { s.x += s.dir * s.T.speed * dt; if (s.x * s.dir > hw + s.T.L * 0.8) { s.dir = -s.dir; s.turned++; s.z = clamp(s.z + rnd(-7, 7), -84, -54); } }
        if (onScreen(s) && F.phase !== 'inter') { s.fireT -= dt; if (s.fireT <= 0 && !(s.type === 'flag' && F.phase === 'boss')) { shipFire(s); s.fireT = rnd(s.T.fire[0], s.T.fire[1]); } }
        if (s.burn > 0 && Math.random() < s.burn * dt * 14) { FX.emit(s.x + rnd(-s.T.L * 0.3, s.T.L * 0.3), 2.6 + rnd(0, 1.5), s.z, rnd(-0.5, 0.5), rnd(1, 3), 0, rnd(0.3, 0.6), rnd(1.4, 2.4), 0.5, COL.ember, 0.9); SM.emit(s.x + rnd(-3, 3), 4, s.z, rnd(-0.3, 0.3), rnd(2, 4), 0, rnd(2, 3.5), 2.5, 7, COL.smoke, 0.5, 0.4, 0.2); }
      } else if (s.state === 'crippled') { s.x += Math.sin(s.t * 0.3) * 0.2 * dt; if (Math.random() < dt * 20) { FX.emit(s.x + rnd(-12, 12), 3 + rnd(0, 4), s.z, rnd(-0.5, 0.5), rnd(1, 4), 0, rnd(0.3, 0.7), rnd(1.6, 3), 0.6, COL.ember, 1); SM.emit(s.x + rnd(-8, 8), 6, s.z, 0, rnd(2, 4), 0, rnd(3, 4), 3, 10, COL.smoke, 0.5, 0.3, 0.2); } }
      else if (s.state === 'sink') { s.sinkT += dt; if (Math.random() < dt * 22) SM.emit(s.x + rnd(-s.T.L * 0.4, s.T.L * 0.4), 0.3, s.z + rnd(-1.5, 1.5), rnd(-1, 1), rnd(1, 5), rnd(-1, 1), rnd(0.6, 1.2), 0.8, 0.2, COL.spray, 0.8, 0.3, -10);
        if (s.sinkT > 3.4) s.state = 'gone'; }
    }
    for (let i = ships.length - 1; i >= 0; i--) if (ships[i].state === 'gone') ships.splice(i, 1);
    // enemy shots
    for (const p of projs) {
      if (!p.alive) continue; p.t += dt; projPos(p, p.t, p.pos);
      if (p.kind === 'rocket') { for (let k = 0; k < 3; k++) FX.emit(p.pos.x, p.pos.y, p.pos.z, rnd(-0.5, 0.5), rnd(-0.5, 0.5), rnd(-0.5, 0.5), rnd(0.9, 1.4), rnd(1.4, 2.2), 0.3, k ? COL.red : COL.redg, 1, 1.2); if (Math.random() < 0.5) SM.emit(p.pos.x, p.pos.y, p.pos.z, 0, 0.4, 0, rnd(1, 1.6), 0.6, 2.2, COL.smoke, 0.35, 0.5, 0.2); }
      else if (p.kind === 'shell') { if (Math.random() < 0.8) FX.emit(p.pos.x, p.pos.y, p.pos.z, rnd(-1.5, 1.5), rnd(-1.5, 1.5), rnd(-1.5, 1.5), 0.3, 0.7, 0.2, COL.spark, 1, 2, 0, 1); if (!p.whistled && p.t > p.T - 1.4) { p.whistled = true; boom('whistle'); } }
      else if (Math.random() < 0.35) SM.emit(p.pos.x, p.pos.y, p.pos.z, 0, 0.2, 0, 0.7, 0.4, 1.2, COL.smokeL, 0.25);
      const arrive = p.kind === 'shell' ? p.T - 0.35 : p.T;
      if (p.t >= arrive) { p.alive = false; hitFort(p); }
    }
    for (let i = projs.length - 1; i >= 0; i--) if (!projs[i].alive) projs.splice(i, 1);
    // player shots in flight
    for (let i = F.shots.length - 1; i >= 0; i--) { const sh = F.shots[i]; sh.t += dt; const u = Math.min(1, sh.t / sh.T); _a.lerpVectors(sh.a, sh.b, u); FX.emit(_a.x, _a.y, _a.z, 0, 0, 0, 0.12, 0.5, 0.2, COL.hot, 0.9); SM.emit(_a.x, _a.y, _a.z, 0, 0.3, 0, 0.6, 0.3, 1.4, COL.smokeL, 0.3);
      if (u >= 1) { F.shots.splice(i, 1); resolveShot(sh); } }
    // admiral
    if (ADM.on && ADM.g) { ADM.t += dt; ADM.hitT = Math.max(0, ADM.hitT - dt); }
    // flag: falls at 0
    if (F.flag <= 0 && F.phase !== 'lose' && F.phase !== 'fall' && F.phase !== 'win' && F.phase !== 'done') { F.phase = 'fall'; F.pt = 0; musStop(0.3); fbanner('THE FLAG IS FALLING!', '', 1.8); }
    if (F.phase === 'fall') { F.fallT += dt; STORM.userData.U.uFall.value = Math.min(1, F.fallT / 1.6); if (F.fallT > 2.2) { lose(); D.end.classList.add('on'); } }
    // win sequence: storm flag down, garrison flag up over the final phrase, fireworks
    if (F.phase === 'win') {
      const R = F.raise, wt = F.pt;
      if (wt < R.t0) { STORM.position.y = LAY.flagTop - ease(clamp(wt / Math.max(1, R.t0 - 0.4), 0, 1)) * 14; }
      else { STORM.visible = false; GARR.visible = true; const u = clamp((wt - R.t0) / R.dur, 0, 1); GARR.position.y = lerp(LAY.flagTop - 16, LAY.flagTop + 1.2, ease(u)); F.raiseU = u;
        if (u > 0.3 && Math.random() < dt * (u > 0.97 ? 9 : 4)) firework(u > 0.97 ? 1.4 : 1.15); if (u >= 1 && !F.finale) { F.finale = true; for (let k = 0; k < 5; k++) F.queue.push({ t: F.wt + k * 0.18, f: () => firework(1.5) }); } }
      if (wt > R.end + 3.2 && F.phase === 'win') finish();
    }
    if (F.phase === 'win' || F.phase === 'done') { for (let i = F.queue.length - 1; i >= 0; i--) if (F.wt >= F.queue[i].t) { const q = F.queue[i]; F.queue.splice(i, 1); q.f(); } F.wt += dt; }
    if (F.phase === 'done') { F.doneT += dt; if (F.auto && F.doneT > 2.5) leave(true); }
    FX.step(dt); SM.step(dt);
  }
  function hitFort(p) {
    const dmg = p.kind === 'shell' ? 10 : p.kind === 'rocket' ? 8 : 7;
    if (p.kind === 'shell') { burst(p.pos, [COL.fire, COL.hot, COL.spark], 80, 11); explode(p.pos, 1); } else explode(p.pos, 1.1);
    F.flag = Math.max(0, F.flag - dmg); F.stats.flagHits++; CAMP.shake = Math.max(CAMP.shake, 1); F.hurt = 1; boom('explode', 1.1);
    // a hit near the pole rips the flag: embers from the cloth
    for (let i = 0; i < 12; i++) FX.emit(STORM.position.x + rnd(0.5, 6), STORM.position.y - rnd(0, 4), STORM.position.z, rnd(-2, 2), rnd(-1, 2), rnd(-1, 1), rnd(0.4, 0.9), 0.6, 0.2, COL.ember, 1, 1, -2);
  }
  function firework(k = 1) { const side = Math.random() < 0.5 ? -1 : 1, z = rnd(-110, -70), tv = Math.tan(THREE.MathUtils.degToRad(FC.fov / 2)), p = V3(rnd(-0.75, 0.75) * halfW(z), 7.6 + Math.abs(z) * Math.tan(Math.atan(tv) * rnd(0.3, 0.72) + CAMP.pitch), z); const cols = pick([[COL.red, COL.redg], [COL.blue, COL.white], [COL.red, COL.white, COL.blue], [COL.gold, COL.ember]]);
    for (let i = 0; i < 10; i++) FX.emit(p.x + side * 0.2, p.y - i * 1.6, p.z, 0, 0, 0, 0.25 + i * 0.03, 0.8, 0.3, COL.spark, 0.7); burst(p, cols, Math.round(110 * k), 13 * k); F.flash = Math.max(F.flash, 0.35); }

  // ================= visuals per rendered frame =================
  const NIGHTC = { top: CL('#050a1c'), hor: CL('#141c34'), deep: CL('#06101e'), glint: CL('#8090c0'), hemi: CL('#6070b0'), hemiG: CL('#181824'), dir: CL('#9ab0ff') };
  const PREC = { top: CL('#1a2452'), hor: CL('#6a4a72'), deep: CL('#141c34'), glint: CL('#c090a0'), hemi: CL('#a088b8'), hemiG: CL('#2a2030'), dir: CL('#d0a0c0') };
  const DAWNC = { top: CL('#4a7ac0'), hor: CL('#ffb070'), deep: CL('#2a4a6a'), glint: CL('#ffd090'), hemi: CL('#ffd8b0'), hemiG: CL('#5a4a40'), dir: CL('#ffc080') };
  const mix3 = (k, d, out) => (d < 0.5 ? out.copy(NIGHTC[k]).lerp(PREC[k], d * 2) : out.copy(PREC[k]).lerp(DAWNC[k], d * 2 - 1));
  const _d = V3();
  function visuals(rdt) {
    const d = F.dawn, fl = F.flash;
    mix3('top', d, SKYU.uTop.value); mix3('hor', d, SKYU.uHor.value); SKYU.uStars.value = 1 - sstep(0.25, 0.7, d); SKYU.uDawn.value = d; SKYU.uFlash.value = fl; SKYU.uT.value = F.t;
    mix3('deep', d, WATU.uDeep.value); WATU.uHor.value.copy(SKYU.uHor.value); mix3('glint', d, WATU.uGlint.value); WATU.uT.value = F.t; WATU.uFlash.value = fl;
    _d.copy(SKYU.uMoonDir.value).lerp(SKYU.uSunDir.value, sstep(0.35, 0.8, d)).normalize(); WSUN.copy(_d); WATU.uSunDir.value = WSUN;
    FS.fog.color.copy(SKYU.uHor.value); renderer.setClearColor(FS.fog.color);
    mix3('hemi', d, hemiF.color); mix3('hemiG', d, hemiF.groundColor); hemiF.intensity = lerp(0.55, 1.35, d) + fl * 1.2; mix3('dir', d, dirF.color); dirF.intensity = lerp(0.55, 1.6, d) + fl * 0.8;
    dirF.position.copy(_d).multiplyScalar(80).setY(Math.max(20, _d.y * 80));
    F.shore.material.color.setScalar(lerp(1, 3.2, d)); LAMPS.U.uMul.value = 1 - sstep(0.5, 0.95, d); LAMPS.upload(F.t);
    // camera: tiny sway toward the aim + shake
    const sh = CAMP.shake * CAMP.shake; CAMP.yaw = damp(CAMP.yaw, -AIM.x * 0.05, 3, rdt);
    FC.rotation.set(CAMP.pitch + AIM.y * 0.03 + (Math.random() - 0.5) * sh * 0.03, CAMP.yaw + (Math.random() - 0.5) * sh * 0.03, 0, 'YXZ');
    FC.position.set((Math.random() - 0.5) * sh * 0.25, 7.6 + (Math.random() - 0.5) * sh * 0.2, 0); FC.updateMatrixWorld();
    // the cannon points at the aim
    ray.setFromCamera({ x: AIM.x, y: AIM.y }, FC); const aimP = ray.ray.at(160, _a); PIV.lookAt(aimP); PIV.rotateY(Math.PI); BARREL.position.z = F.recoil * 0.45;
    // ships -> instance matrices
    const cnt = { sloop: 0, ketch: 0, rocket: 0, flag: 0 };
    for (const s of ships) {
      const im = INST[s.type], i = cnt[s.type]++; let y = Math.sin(s.t * 1.2 + s.ph) * 0.18, rx = Math.sin(s.t * 0.9 + s.ph) * 0.03, rz = Math.sin(s.t * 0.7 + s.ph * 2) * 0.025;
      if (s.state === 'sink') { const u = s.sinkT / 3.4; y -= u * u * (s.T.H + 4); rz += s.dir * u * 0.5; rx += u * 0.35 * (s.id % 2 ? 1 : -1); }
      if (s.state === 'crippled') { rx += 0.08; y -= 0.6; }
      _q.setFromEuler(_e.set(rx, s.dir > 0 ? 0 : Math.PI, rz, 'YXZ')); _m.compose(_b.set(s.x, y, s.z), _q, _s.set(1, 1, 1)); im.setMatrixAt(i, _m);
      const f = 1 + s.flash * 2.2, dk = s.state === 'sink' ? 0.6 : 1 - s.burn * 0.25; im.setColorAt(i, _col.setRGB(f * dk, f * dk, f * dk));
      if (s.type === 'flag') { if (!ADM.g) { ADM.g = buildAdmiral(); FS.add(ADM.g); ADM.hp = 3; F.log.push('admiral:' + (ADM.g.userData.standIn ? 'stand-in' : 'rig')); }
        ADM.g.position.set(-10.6, 3.2 + 2.35, 0).applyMatrix4(_m); ADM.g.rotation.set(0, -s.dir * 0.35, rz); ADM.g.scale.setScalar(2.8);
        ADM.g.visible = s.state !== 'gone' && !(s.state === 'sink' && s.sinkT > 2.6);
        const cl = ADM.g.userData.claws; if (cl) for (const c of cl) c.g.rotation.z = c.s * (0.3 + (ADM.on ? 0.9 + Math.sin(ADM.t * 6 + c.s) * 0.5 : Math.sin(F.t * 2 + c.s) * 0.25));
        const rig = ADM.g.userData.rig; if (rig && rig.update) try { rig.update(rdt, ADM.on ? 'taunt' : 'idle'); } catch (e) {}
        ADM.g.traverse((o) => { if (o.material && o.material.userData && o.material.userData.flash) o.material.userData.flash.value = ADM.hitT > 0 ? 0.8 : 0; }); }
    }
    for (const k in INST) { const im = INST[k]; im.count = cnt[k]; im.visible = cnt[k] > 0; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    if (ADM.g && !ships.some((s) => s.type === 'flag')) { FS.remove(ADM.g); ADM.g = null; ADM.on = false; }
    // projectiles -> instances; glowing heads
    let nb = 0, nr = 0;
    for (const p of projs) { if (p.kind === 'rocket') { projPos(p, p.t + 0.03, _b); _c.subVectors(_b, p.pos).normalize(); _q.setFromUnitVectors(_a.set(0, 1, 0), _c); _m.compose(p.pos, _q, _s.set(1.4, 1.4, 1.4)); RK.setMatrixAt(nr++, _m); FX.emit(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, 0.001, 3.6, 3.6, COL.redg, 1); FX.emit(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, 0.001, 1.4, 1.4, COL.hot, 1); }
      else { const r = p.kind === 'shell' ? 0.75 : 0.55; _m.compose(p.pos, _q.identity(), _s.set(r, r, r)); BALLS.setMatrixAt(nb++, _m); FX.emit(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, 0.001, p.kind === 'shell' ? 2.4 : 1.8, 0, p.kind === 'shell' ? COL.spark : COL.ember, 0.75); } }
    for (const sh of F.shots) { const u = Math.min(1, sh.t / sh.T); _a.lerpVectors(sh.a, sh.b, u); _m.compose(_a, _q.identity(), _s.set(0.4, 0.4, 0.4)); BALLS.setMatrixAt(nb++, _m); }
    BALLS.count = nb; RK.count = nr; BALLS.visible = nb > 0; RK.visible = nr > 0; BALLS.instanceMatrix.needsUpdate = RK.instanceMatrix.needsUpdate = true;
    // particles
    const sc = LOW.h / (2 * Math.tan(THREE.MathUtils.degToRad(FC.fov / 2))); FX.U.uScale.value = SM.U.uScale.value = LAMPS.U.uScale.value = sc;
    FX.upload(F.t); SM.upload(F.t); // (heads with ~0 life drop on the next step)
    // flags
    const light = lerp(0.55, 1.15, d) + fl * 0.5;
    for (const f of [STORM, GARR]) { const U = f.userData.U; U.uT.value = F.t; U.uLight.value = light; U.uFlash.value = fl; }
    STORM.userData.U.uDmg.value = damp(STORM.userData.U.uDmg.value, (1 - F.flag / 100) * 0.92, 4, rdt); GARR.userData.U.uDmg.value = 0;
    // HUD
    const fp = Math.round(F.flag); if (fp !== F.flagShown) { F.flagShown = fp; D.flag.style.width = fp + '%'; }
    const W = WAVES[F.wave]; const wtxt = F.phase === 'win' || F.phase === 'done' ? 'DAWN<small>THE FLEET WITHDRAWS</small>' : `WAVE ${F.wave + 1}/4<small>${W.name}</small>`; if (wtxt !== F.wtxt) { F.wtxt = wtxt; D.wave.innerHTML = wtxt; }
    const stxt = `${F.score}<small>${'●'.repeat(F.stats.sunk % 10)}</small>`; if (stxt !== F.stxt) { F.stxt = stxt; D.score.innerHTML = F.score + '<small>SUNK ' + F.stats.sunk + '</small>'; }
    const ax = (AIM.x * 0.5 + 0.5) * LAY.w, ay = (-AIM.y * 0.5 + 0.5) * LAY.h; D.x.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
    const play = F.phase === 'wave' || F.phase === 'boss'; D.x.style.display = play || F.phase === 'intro' || F.phase === 'inter' ? '' : 'none';
    D.xr.style.strokeDashoffset = (151 * (AIM.cool / AIM.reload)).toFixed(1); D.x.classList.toggle('cool', AIM.cool > 0);
    if (F.banT > 0) { F.banT -= rdt; if (F.banT <= 0) D.ban.classList.remove('on'); }
    if (F.capT > 0) { F.capT -= rdt; if (F.capT <= 0) D.cap.classList.remove('on'); }
    if (F.hintT > 0) { F.hintT -= rdt; if (F.hintT <= 0) D.hint.classList.remove('on'); }
    if (F.sayT > 0) { F.sayT -= rdt; if (F.sayT <= 0) $('fsay').classList.remove('on'); }
    F.hurt = Math.max(0, (F.hurt || 0) - rdt * 2.2); D.hurt.style.opacity = F.hurt.toFixed(2);
    for (const P of POPS) { if (P.t <= 0) continue; P.t -= rdt; P.p.y += rdt * 3; toScreen(P.p, _s1); P.el.style.left = clamp(_s1.x, 60, LAY.w - 60) + 'px'; P.el.style.top = clamp(_s1.y, 70, LAY.h - 40) + 'px'; if (P.t <= 0) P.el.style.opacity = '0'; }
    if (F.fadeIn > 0) { F.fadeIn -= rdt; blk.style.opacity = Math.max(0, F.fadeIn / 0.7).toFixed(2); }
    if (APANEL) APANEL.setAct({ kind: 'cannon', label: F.phase === 'lose' ? 'RETRY' : F.phase === 'done' ? 'OK' : 'FIRE', ready: AIM.cool <= 0 }, 1 - AIM.cool / AIM.reload);
  }

  // ================= per-frame entry points (called from 07_main frame()) =================
  function frame(rdt) {
    layout();
    if (F.auto && !F.pause) autoAim(rdt);
    input(rdt);
    const steps = F.pause ? 0 : SIM ? SIM : 1; for (let k = 0; k < steps; k++) step(SIM ? 1 / 60 : rdt); // (F.pause: tests freeze a frame for screenshots)
    musTick(); visuals(F.pause ? 0 : rdt);
    const R = renderer, ar = R.info.autoReset; R.info.autoReset = false; R.info.reset(); R.shadowMap.autoUpdate = false;
    draw(FS, FC); R.shadowMap.autoUpdate = true;
    F.perf.calls = R.info.render.calls; F.perf.tris = R.info.render.triangles; F.perf.maxCalls = Math.max(F.perf.maxCalls, F.perf.calls); F.perf.frames++; R.info.autoReset = ar;
  }
  // in the city: pad A also takes the cannon when its prompt is up; ?fort=1 starts the set piece straight away (tests / screenshots)
  const WPAD = [];
  function world() {
    if (Q.has('fort') && !F.autoStarted && frames > 4) { F.autoStarted = true; const st = CAN.stand; hero.pos.set(st.x, groundY(st.x, st.z), st.z); enter('url'); return; }
    const near = CINE.prompt && CINE.prompt.startsWith('cannon'); const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) { if (!gp) continue; const a = !!(gp.buttons[0] && gp.buttons[0].pressed); if (a && !WPAD[gp.index] && near) enter('padA'); WPAD[gp.index] = a; }
  }
  const api = { F, enter, leave, retry, world, frame, ships, projs, WAVES, SHIP, MUS, SEC, LOOPB, ACT, CAN, AIM, fire, findTarget, get on() { return F.on; }, ADM, FX, SM, FS, FC, layout, BOSS_CLEAR };
  window.__fort = api;
  return api;
})();
