// Starry Night Ride — sample. One street, one bicycle, ridden through a painted world.
// Look: every surface wears a canvas-painted brushstroke texture (strokes, not flat colour),
// the sky is a fully painted dome (swirl, stars with halo rings, crescent moon), and the
// village is simple geometry dressed in those painted materials.
import * as THREE from 'three';
import { TouchController } from './gptouch.js';

/* ---------------------------------- rng ---------------------------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(1889); // build-time rng (Van Gogh painted it in 1889)
const rr = (a, b) => a + rng() * (b - a);
const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];

/* --------------------------- painted canvas textures --------------------------- */
function canvasTex(w, h, painter, { srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  painter(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
// one brush dab: a short, slightly wandering thick stroke
function dab(ctx, x, y, len, ang, width, color, alpha) {
  ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.lineCap = 'round';
  const mx = x + Math.cos(ang) * len * 0.5, my = y + Math.sin(ang) * len * 0.5 + Math.sin(x * 0.05 + y * 0.11) * width * 0.22;
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.quadraticCurveTo(mx, my, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
  ctx.stroke(); ctx.globalAlpha = 1;
}
function fillStrokes(ctx, w, h, { base, palette, rows, len, angBase = 0, angJit = 0.16, wMin = 6, wMax = 13, alpha = 0.5, seed = 7 }) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  const r = mulberry32(seed);
  const rowH = h / rows;
  for (let row = 0; row < rows; row++) {
    const y = row * rowH + rowH * 0.5;
    for (let x = -20; x < w + 20; x += len * (0.55 + r() * 0.5)) {
      dab(ctx, x, y + (r() - 0.5) * rowH * 0.8, len * (0.8 + r() * 0.5),
        angBase + (r() - 0.5) * 2 * angJit, wMin + r() * (wMax - wMin),
        palette[Math.floor(r() * palette.length) % palette.length], alpha * (0.6 + r() * 0.7));
    }
  }
}

/* ---- the sky: the whole painting lives here ---- */
const skyTex = canvasTex(2048, 1024, (ctx, W, H) => {
  const r = mulberry32(4242);
  // NOTE (both measured with isolated probes): canvas fraction f maps to elevation
  // 90 - f * 180 degrees (canvas top = zenith, f = 0.5 = horizon); with the dome at
  // rotation.y = PI, texture u = 0.25 faces dead ahead (-z), and a feature at u sits
  // at screen azimuth -(u - 0.25) * 360 degrees (positive = screen right).
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.00, '#101f4d'); g.addColorStop(0.25, '#1d3a78');
  g.addColorStop(0.42, '#2c529c'); g.addColorStop(0.485, '#4a6fb4');
  g.addColorStop(0.52, '#3d63a8'); g.addColorStop(0.62, '#33508c');
  g.addColorStop(0.80, '#22345f'); g.addColorStop(1.00, '#1c2c55');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // flowing impasto: two passes of SHORT dabs, dense enough that no flat canvas shows
  const bandPal = ['#274f92', '#3563ab', '#4a7cc4', '#6b9ad8', '#93bde8', '#c2dcf2', '#3d8fae', '#2a5aa2'];
  const flowAngle = (x, y) => {
    // near the spiral centre the strokes swing tangent to it — the sky rotates there
    const dx = x - W * 0.25, dy = (y - H * 0.383) * 1.35, d2 = dx * dx + dy * dy;
    const tang = Math.atan2(dy, dx) + Math.PI / 2;
    const wgt = Math.max(0, 1 - d2 / (330 * 330));
    return tang * wgt + Math.sin(x * 0.0035 + y * 0.02) * 0.14 * (1 - wgt);
  };
  for (const pass of [{ rows: 150, len: 40, wdt: 11, a: 0.42 }, { rows: 190, len: 26, wdt: 7, a: 0.4 }]) {
    for (let row = 0; row < pass.rows; row++) {
      const yBase = 8 + row * (H / pass.rows);
      const pale = yBase > H * 0.44 && yBase < H * 0.495; // the famous light band, just above the horizon
      for (let x = -40; x < W + 40; x += pass.len * (0.6 + r() * 0.45)) {
        const y = yBase + Math.sin(x * 0.0035 + row * 0.55) * 7 + (r() - 0.5) * 5;
        const col = pale && r() < 0.55 ? ['#e6efd2', '#d7e6c2', '#c9dcb4', '#eef3da'][Math.floor(r() * 4)] : bandPal[Math.floor(r() * bandPal.length)];
        dab(ctx, x, y, pass.len * (0.8 + r() * 0.5), flowAngle(x, y) + (r() - 0.5) * 0.22,
          pass.wdt * (0.75 + r() * 0.6), col, pass.a * (0.6 + r() * 0.7));
      }
    }
  }

  const glowAt = (x, y, rad, col, a) => {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  };
  const rings = (x, y, rad, colA = '#f3e9c8', colB = '#cfe0f2') => {
    for (let i = 1; i <= 3; i++) {
      ctx.strokeStyle = i % 2 ? colA : colB; ctx.globalAlpha = 0.4 - i * 0.07;
      ctx.lineWidth = 3.4 - i * 0.6; ctx.lineCap = 'round';
      const start = r() * Math.PI * 2;
      ctx.beginPath(); ctx.arc(x, y, rad * (1 + i * 0.5), start, start + Math.PI * (0.8 + r() * 0.4)); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, rad * (1 + i * 0.5), start + Math.PI * 1.3, start + Math.PI * (1.6 + r() * 0.3)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  const star = (u, v, rad) => {
    const x = u * W, y = v * H;
    glowAt(x, y, rad * 2.2, 'rgba(250,230,150,0.5)', 0.55);
    rings(x, y, rad);
    ctx.fillStyle = '#f7e08a'; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(x, y, rad * 0.55, 0, Math.PI * 2); ctx.fill();
  };
  // the eleven stars of the painting, spread across the dome (v = canvas fraction;
  // elevation = 90 - v * 180, so these sit +8..+38 degrees up)
  [[0.403, 0.36, 12], [0.347, 0.31, 10], [0.289, 0.415, 11], [0.233, 0.34, 9], [0.183, 0.425, 11],
   [0.117, 0.405, 10], [0.422, 0.335, 9], [0.078, 0.43, 11], [0.322, 0.35, 9], [0.144, 0.29, 8], [0.372, 0.30, 8]
  ].forEach(([u, v, rad]) => star(u, v, rad));
  // Venus — the bright morning star, low, dead ahead
  { const x = 0.25 * W, y = 0.461 * H; glowAt(x, y, 50, 'rgba(255,246,200,0.8)', 0.85); rings(x, y, 10);
    ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
  // the great spiral, dead ahead and high
  { const cx = 0.25 * W, cy = 0.383 * H;
    glowAt(cx, cy, 200, 'rgba(160,205,245,0.5)', 0.75);
    const cols = ['#eaf4ff', '#bcd8f5', '#7fb0e8', '#5d94d8', '#d9ecfa', '#f5e9b8'];
    for (let i = 0; i < 340; i++) {
      const t = i / 340, ang = t * Math.PI * 4.4 + 0.7, rad = 24 + t * 132;
      const x = cx + Math.cos(ang) * rad * 1.35, y = cy + Math.sin(ang) * rad * 0.78;
      dab(ctx, x, y, 30 - t * 12, ang + Math.PI / 2 + (r() - 0.5) * 0.3, 13 - t * 6, cols[i % cols.length], 0.5 + r() * 0.35);
    }
    glowAt(cx, cy, 34, 'rgba(220,238,255,0.5)', 0.7); }
  // crescent moon, upper right of ahead
  { const x = 0.172 * W, y = 0.317 * H;
    glowAt(x, y, 95, 'rgba(250,225,150,0.55)', 0.85); rings(x, y, 20, '#f7e08a', '#e8d9a8');
    ctx.fillStyle = '#f7dc7e'; ctx.beginPath(); ctx.arc(x, y, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a4d8f'; ctx.beginPath(); ctx.arc(x + 9, y - 4, 16, 0, Math.PI * 2); ctx.fill();
    // repaint a few sky strokes over the bite so it blends into the painting
    for (let i = 0; i < 26; i++) dab(ctx, x + 2 + r() * 30, y - 26 + r() * 52, 26 + r() * 20, (r() - 0.5) * 0.2, 6 + r() * 5, pick(bandPal), 0.5);
    ctx.fillStyle = '#fdf3b0'; ctx.beginPath(); ctx.arc(x - 6, y + 2, 3.5, 0, Math.PI * 2); ctx.fill(); }
});
skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping;

/* ---- ground-level surfaces ---- */
const cobbleTex = canvasTex(512, 512, (ctx, w, h) => {
  const r = mulberry32(31);
  fillStrokes(ctx, w, h, {
    base: '#5d4763', seed: 31, rows: 30, len: 40, wMin: 9, wMax: 15, alpha: 0.55,
    palette: ['#6f5578', '#7d6488', '#86709a', '#4c3a5e', '#9880ab', '#a87f5f', '#8a6f92'],
  });
  ctx.fillStyle = '#3c2c46';
  for (let i = 0; i < 260; i++) { ctx.globalAlpha = 0.25 + r() * 0.3; ctx.beginPath(); ctx.arc(r() * w, r() * h, 2 + r() * 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
});
const shoulderTex = canvasTex(256, 256, (ctx, w, h) => fillStrokes(ctx, w, h, {
  base: '#46334e', seed: 77, rows: 18, len: 34, wMin: 7, wMax: 12, alpha: 0.5,
  palette: ['#52405e', '#5d4763', '#3a2a44', '#6b5570'],
}));
const groundTex = canvasTex(512, 512, (ctx, w, h) => {
  const r = mulberry32(55);
  fillStrokes(ctx, w, h, {
    base: '#2c5230', seed: 55, rows: 30, len: 38, wMin: 8, wMax: 14, alpha: 0.55,
    palette: ['#3a6b35', '#47803c', '#579148', '#24471f', '#6aa653', '#2f5d33'],
  });
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = r() * w, y = r() * h, rad = 12 + r() * 26, a0 = r() * Math.PI * 2;
    ctx.strokeStyle = ['#6aa653', '#47803c', '#83b96a'][Math.floor(r() * 3)];
    ctx.globalAlpha = 0.4; ctx.lineWidth = 5 + r() * 4;
    ctx.beginPath(); ctx.arc(x, y, rad, a0, a0 + Math.PI * (0.8 + r() * 0.8)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
});
const hillTex = canvasTex(512, 256, (ctx, w, h) => fillStrokes(ctx, w, h, {
  base: '#2a4a86', seed: 91, rows: 22, len: 52, wMin: 8, wMax: 14, alpha: 0.5,
  palette: ['#3560a6', '#40679f', '#557fc0', '#7fa3d8', '#24406f', '#4a76b8'],
}));
const cypressTex = canvasTex(128, 256, (ctx, w, h) => fillStrokes(ctx, w, h, {
  base: '#132a18', seed: 63, rows: 30, len: 16, angBase: -Math.PI / 2, angJit: 0.3, wMin: 5, wMax: 9, alpha: 0.6,
  palette: ['#1d4023', '#2c5a2e', '#0e2010', '#376b34', '#487a3a'],
}));
function wallTexture(base, palette, seed) {
  return canvasTex(256, 256, (ctx, w, h) => fillStrokes(ctx, w, h, {
    base, seed, rows: 20, len: 44, wMin: 7, wMax: 12, alpha: 0.45, palette,
  }));
}
function roofTexture(base, palette, seed) {
  return canvasTex(256, 256, (ctx, w, h) => fillStrokes(ctx, w, h, {
    base, seed, rows: 20, len: 40, angBase: 0.5, angJit: 0.2, wMin: 7, wMax: 12, alpha: 0.5, palette,
  }));
}
const glowTex = canvasTex(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}, { srgb: false });
glowTex.wrapS = glowTex.wrapT = THREE.ClampToEdgeWrapping;
const poolTex = canvasTex(256, 256, (ctx, w, h) => {
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,205,130,0.95)'); g.addColorStop(0.55, 'rgba(255,180,100,0.4)');
  g.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}, { srgb: false });
poolTex.wrapS = poolTex.wrapT = THREE.ClampToEdgeWrapping;
const spokeTex = canvasTex(128, 128, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#cfd6dd'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); ctx.stroke();
  }
  ctx.fillStyle = '#8a929c'; ctx.beginPath(); ctx.arc(64, 64, 7, 0, Math.PI * 2); ctx.fill();
});
spokeTex.wrapS = spokeTex.wrapT = THREE.ClampToEdgeWrapping;


/* ------------------------------- scene setup ------------------------------- */
const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1a2c58, 55, 285);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);

scene.add(new THREE.HemisphereLight(0x93b4e8, 0x24351f, 1.05));
const moon = new THREE.DirectionalLight(0xaac4ff, 0.8);
moon.position.set(40, 80, -60);
scene.add(moon);

/* sky dome — the painting itself */
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(400, 40, 24),
  new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
);
sky.rotation.y = Math.PI; // first guess: spiral dead ahead; tuned against screenshots
scene.add(sky);

/* ------------------------------- materials ------------------------------- */
const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, ...extra });
const rep = (tex, x, y) => { const t = tex.clone(); t.repeat.set(x, y); t.needsUpdate = true; return t; };
const matGround = std(rep(groundTex, 20, 3));
const matRoad = std(cobbleTex);
const matShoulder = std(shoulderTex);
const matHill = std(rep(hillTex, 3, 1));
const matCypress = std(cypressTex);
const wallMats = [
  std(wallTexture('#e6dbc2', ['#d9c9a4', '#f2e8ce', '#cbb894', '#e0d0ac'], 11)),
  std(wallTexture('#b9c8de', ['#a4b8d2', '#ccd9ea', '#93a9c6', '#d7e2f0'], 12)),
  std(wallTexture('#efe9dc', ['#ddd3bc', '#f7f2e4', '#cfc2a4', '#e8dfc8'], 13)),
  std(wallTexture('#c08552', ['#a96f3e', '#d29a66', '#8f5c33', '#dda878'], 14)),
];
const roofMats = [
  std(roofTexture('#3d63b4', ['#33549e', '#4c74c2', '#2a468a', '#6488cc'], 21)),
  std(roofTexture('#4c939b', ['#3f7f86', '#5fa5ab', '#357078', '#74b8be'], 22)),
  std(roofTexture('#b04f40', ['#9c4034', '#c05f4e', '#87352b', '#d2755f'], 23)),
  std(roofTexture('#54687f', ['#46586e', '#617691', '#3a4a5e', '#74889f'], 24)),
];
const winMats = ['#ffc46b', '#ffd98f', '#ffb85c'].map((c) => new THREE.MeshBasicMaterial({ color: c }));
const winDimMat = new THREE.MeshBasicMaterial({ color: '#3d4c6e' });
const doorMat = std(null, { color: 0x2c2018 });
const trunkMat = std(null, { color: 0x3a2a1c });
const churchWallMat = std(wallTexture('#e9e0c8', ['#dcd0ae', '#f4ecd6', '#cfc09c'], 15));
const churchRoofMat = std(roofTexture('#2c4478', ['#243a68', '#38548e', '#1d3054'], 25));

/* ---------------------------- shared geometry ---------------------------- */
const unitBox = new THREE.BoxGeometry(1, 1, 1);
// triangular prism: width x ∈ [-.5,.5], base y=0, ridge y=1, depth z ∈ [-.5,.5]
function prismGeometry() {
  const A = [-.5, 0, -.5], B = [.5, 0, -.5], C = [.5, 0, .5], D = [-.5, 0, .5], E = [-.5, 1, 0], F = [.5, 1, 0];
  const tris = [D, C, F, D, F, E, B, A, E, B, E, F, A, D, E, C, B, F];
  const pos = new Float32Array(tris.flat());
  const uv = new Float32Array(pos.length / 3 * 2);
  for (let i = 0; i < uv.length; i += 2) { uv[i] = (i / 2) % 2; uv[i + 1] = Math.floor(i / 4) % 2; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
const roofGeo = prismGeometry();
const windowGeo = new THREE.PlaneGeometry(0.68, 0.98);
const tallWindowGeo = new THREE.PlaneGeometry(0.9, 2.6);
const doorGeo = new THREE.PlaneGeometry(0.85, 1.55);
const cypressGeo = new THREE.LatheGeometry([
  new THREE.Vector2(0.0, 0), new THREE.Vector2(0.45, 0.08), new THREE.Vector2(0.58, 0.5),
  new THREE.Vector2(0.42, 1.4), new THREE.Vector2(0.24, 2.5), new THREE.Vector2(0.09, 3.4),
  new THREE.Vector2(0.0, 3.9),
], 8);
const groundGeo = (() => {
  const g = new THREE.PlaneGeometry(520, 60); g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
  return g;
})();
const poleGeo = new THREE.CylinderGeometry(0.045, 0.065, 3.4, 6);
const lampHeadGeo = new THREE.SphereGeometry(0.1, 10, 8);
const poolGeo = new THREE.CircleGeometry(1, 20); poolGeo.rotateX(-Math.PI / 2);
const glowSpriteMat = (color, opacity) => new THREE.SpriteMaterial({
  map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
});

/* ------------------------------ world layout ------------------------------ */
const ROAD_W = 7, ROAD_HALF = ROAD_W / 2, CHUNK = 60, NCHUNK = 9;
const centerX = (d) => 9 * Math.sin(d * 0.0085) + 3.5 * Math.sin(d * 0.021 + 1.7);
const centerDX = (d) => 9 * 0.0085 * Math.cos(d * 0.0085) + 3.5 * 0.021 * Math.cos(d * 0.021 + 1.7);

function ribbonGeo(start, width, vScale) {
  const SEG = 24, pos = [], uv = [], idx = [];
  for (let i = 0; i <= SEG; i++) {
    const d = start + (CHUNK * i) / SEG, cx = centerX(d), z = -(CHUNK * i) / SEG;
    pos.push(cx - width / 2, 0, z, cx + width / 2, 0, z);
    uv.push(0, d * vScale, 1, d * vScale);
    if (i < SEG) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function bermGeo(start, side) {
  const SEG = 24, COLS = 6, pos = [], uv = [], idx = [];
  for (let i = 0; i <= SEG; i++) {
    const d = start + (CHUNK * i) / SEG, cx = centerX(d), z = -(CHUNK * i) / SEG;
    for (let j = 0; j < COLS; j++) {
      const off = 14 + j * 6, f = j / (COLS - 1);
      const h = Math.pow(f, 1.5) * (4.5 + 2.2 * Math.sin(d * 0.045 + side * 2.1) + 1.3 * Math.sin(d * 0.013 + side));
      pos.push(cx + side * off, Math.max(h, 0), z);
      uv.push(f * 2, d / 12);
    }
    if (i < SEG) for (let j = 0; j < COLS - 1; j++) {
      const a = i * COLS + j, b = a + COLS;
      if (side > 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* distant painted hills — static ring, the rider never reaches them */
{
  const r = mulberry32(99);
  for (let i = 0; i < 10; i++) {
    const az = (i / 10) * Math.PI * 2 + 0.35; // gap left around the road corridor
    if (Math.abs(Math.sin(az)) < 0.24 && Math.cos(az) < 0) continue;
    const rad = 235 + r() * 65, h = 13 + r() * 11;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(70 + r() * 50, h, 20), matHill);
    cone.position.set(Math.sin(az) * rad, h / 2 - 1.5, Math.cos(az) * rad - 40);
    cone.scale.z = 0.55; cone.rotation.y = r() * Math.PI;
    scene.add(cone);
  }
}

/* ------------------------------- builders ------------------------------- */
function buildHouse(r, group, d, side, setback) {
  const w = 4 + r() * 2.4, h = 3 + r() * 1.7, dep = 4 + r() * 1.6;
  const house = new THREE.Group();
  const body = new THREE.Mesh(unitBox, wallMats[Math.floor(r() * wallMats.length)]);
  body.scale.set(w, h, dep); body.position.y = h / 2;
  house.add(body);
  const roofH = 1.3 + r() * 0.9;
  const roof = new THREE.Mesh(roofGeo, roofMats[Math.floor(r() * roofMats.length)]);
  roof.scale.set(w * 1.1, roofH, dep * 1.14); roof.position.y = h;
  house.add(roof);
  if (r() < 0.4) {
    const chim = new THREE.Mesh(unitBox, trunkMat);
    chim.scale.set(0.42, 0.95, 0.42);
    chim.position.set((r() - 0.5) * w * 0.5, h + roofH * 0.75, (r() - 0.5) * dep * 0.3);
    house.add(chim);
  }
  // windows on the road-facing front (+z local)
  const cols = w > 5.2 ? 3 : 2, rows = h > 3.9 ? 2 : 1;
  for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
    if (cols === 3 && cx === 1 && cy === 0) continue; // door slot
    const win = new THREE.Mesh(windowGeo, r() < 0.85 ? winMats[Math.floor(r() * winMats.length)] : winDimMat);
    win.position.set((cx - (cols - 1) / 2) * (w / (cols + 0.4)), 1.25 + cy * 1.55, dep / 2 + 0.02);
    win.scale.setScalar(1.15 + r() * 0.4);
    house.add(win);
  }
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(cols === 3 ? 0 : (r() - 0.5) * w * 0.4, 0.78, dep / 2 + 0.02);
  house.add(door);
  house.position.set(centerX(d) + side * (ROAD_HALF + setback + dep / 2), 0, 0);
  house.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  house.rotation.y += (r() - 0.5) * 0.07;
  house.userData.d = d;
  group.add(house);
  return house;
}
function buildChurch(r, group, d) {
  const side = 1, g = new THREE.Group();
  const body = new THREE.Mesh(unitBox, churchWallMat);
  body.scale.set(8, 6.5, 11); body.position.y = 3.25; g.add(body);
  const roof = new THREE.Mesh(roofGeo, churchRoofMat);
  roof.scale.set(8.8, 3.4, 12); roof.position.y = 6.5; g.add(roof);
  const tower = new THREE.Mesh(unitBox, churchWallMat);
  tower.scale.set(2.6, 10.5, 2.6); tower.position.set(0, 5.25, 4.2); g.add(tower);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.1, 6, 4), churchRoofMat);
  spire.position.set(0, 13.5, 4.2); spire.rotation.y = Math.PI / 4; g.add(spire);
  const tw = new THREE.Mesh(tallWindowGeo, winMats[1]);
  tw.position.set(0, 6.4, 5.53); g.add(tw);
  for (const sx of [-2.2, 2.2]) {
    const win = new THREE.Mesh(windowGeo, winMats[0]);
    win.position.set(sx, 3.4, 5.53); win.scale.setScalar(1.5); g.add(win);
  }
  const star = new THREE.Sprite(glowSpriteMat(0xfff2b0, 0.95));
  star.scale.setScalar(8); star.position.set(0, 19.5, 4.2); g.add(star);
  const core = new THREE.Sprite(glowSpriteMat(0xffffff, 1));
  core.scale.setScalar(3); core.position.copy(star.position); g.add(core);
  g.position.set(centerX(d) + (ROAD_HALF + 9.5), 0, 0);
  g.rotation.y = -Math.PI / 2;
  g.userData.d = d;
  group.add(g);
  return g;
}
function buildCypress(r, group, d, side, setback) {
  const c = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 5), trunkMat);
  trunk.position.y = 0.25; c.add(trunk);
  const flame = new THREE.Mesh(cypressGeo, matCypress);
  flame.scale.set(0.85 + r() * 0.4, (3.4 + r() * 2.4) / 3.9, 0.85 + r() * 0.4);
  flame.position.y = 0.35; c.add(flame);
  c.position.set(centerX(d) + side * (ROAD_HALF + setback), 0, 0);
  c.rotation.z = (r() - 0.5) * 0.05;
  c.userData.d = d;
  group.add(c);
  return c;
}
function buildLamp(r, group, d, side) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(poleGeo, trunkMat); pole.position.y = 1.7; g.add(pole);
  const arm = new THREE.Mesh(unitBox, trunkMat);
  arm.scale.set(0.85, 0.08, 0.08); arm.position.set(-side * 0.4, 3.32, 0); g.add(arm);
  const head = new THREE.Mesh(lampHeadGeo, winMats[1]);
  head.position.set(-side * 0.78, 3.26, 0); g.add(head);
  const glow = new THREE.Sprite(glowSpriteMat(0xffca7a, 0.75));
  glow.scale.setScalar(2.3); glow.position.copy(head.position); g.add(glow);
  const pool = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  pool.scale.setScalar(1.6); pool.position.set(-side * 1.15, 0.03, 0); g.add(pool);
  g.position.set(centerX(d) + side * (ROAD_HALF + 0.55), 0, 0);
  g.userData.d = d;
  group.add(g);
  return g;
}

/* ------------------------------- chunks ------------------------------- */
const chunks = [];
function buildChunk(chunk) {
  const { group, index } = chunk;
  while (group.children.length) group.remove(group.children[0]);
  for (const g of chunk.own) g.dispose();
  chunk.own = [];
  const start = index * CHUNK;
  const r = mulberry32(index * 7919 + 101);
  const ground = new THREE.Mesh(groundGeo, matGround);
  ground.position.set(0, -0.02, -CHUNK / 2); group.add(ground);
  const shoulder = new THREE.Mesh(ribbonGeo(start, ROAD_W + 3.6, 1 / 6), matShoulder);
  shoulder.position.y = 0.012; group.add(shoulder); chunk.own.push(shoulder.geometry);
  const road = new THREE.Mesh(ribbonGeo(start, ROAD_W, 1 / 7.5), matRoad);
  road.position.y = 0.025; group.add(road); chunk.own.push(road.geometry);
  for (const side of [-1, 1]) {
    const berm = new THREE.Mesh(bermGeo(start, side), matHill);
    group.add(berm); chunk.own.push(berm.geometry);
  }
  const isChurch = index % 5 === 2;
  const churchD = start + CHUNK * 0.55;
  const placed = []; // local-z positioned later from userData.d
  for (const side of [-1, 1]) {
    const n = 3 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const d = start + ((i + 0.5) / n) * CHUNK + (r() - 0.5) * 8;
      if (isChurch && side > 0 && Math.abs(d - churchD) < 11) continue;
      placed.push(buildHouse(r, group, d, side, 3.4 + r() * 3.2));
    }
  }
  if (isChurch) placed.push(buildChurch(r, group, churchD));
  const nCyp = 2 + Math.floor(r() * 3);
  for (let i = 0; i < nCyp; i++) {
    placed.push(buildCypress(r, group, start + r() * CHUNK, r() < 0.5 ? -1 : 1, 2.6 + r() * 8));
  }
  if (isChurch) {
    placed.push(buildCypress(r, group, churchD - 7, 1, 4.5));
    placed.push(buildCypress(r, group, churchD + 8, 1, 5.5));
  }
  placed.push(buildLamp(r, group, start + 14, index % 2 ? 1 : -1));
  placed.push(buildLamp(r, group, start + 44, index % 2 ? -1 : 1));
  // local z from absolute travel distance
  for (const o of placed) o.position.z = -(o.userData.d - start);
  group.position.z = -start; // will be corrected per-frame as (dist - start)
}
for (let i = -1; i < NCHUNK - 1; i++) {
  const group = new THREE.Group();
  scene.add(group);
  const chunk = { group, index: i, own: [] };
  buildChunk(chunk);
  chunks.push(chunk);
}
function updateChunks(dist) {
  for (const chunk of chunks) {
    if (dist - chunk.index * CHUNK > CHUNK) {
      chunk.index += NCHUNK;
      buildChunk(chunk);
    }
    chunk.group.position.z = dist - chunk.index * CHUNK;
  }
}

/* ------------------------------ the rider ------------------------------ */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function tube(a, b, rad, mat, parent) {
  const dir = V3(b.x - a.x, b.y - a.y, b.z - a.z);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 1, 8), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.scale.set(1, len, 1);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize());
  parent.add(m);
  return m;
}
function setTube(m, a, b) {
  const dir = V3(b.x - a.x, b.y - a.y, b.z - a.z);
  const len = Math.max(dir.length(), 0.001);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.scale.set(1, len, 1);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize());
}
const frameMat = std(null, { color: 0x24473a, roughness: 0.5, metalness: 0.35 });
const tireMat = std(null, { color: 0x1d2126, roughness: 0.9 });
const chromeMat = std(null, { color: 0x9aa4ae, roughness: 0.35, metalness: 0.7 });
const saddleMat = std(null, { color: 0x5a4030, roughness: 0.8 });
const jacketMat = std(wallTexture('#2b4f9e', ['#24478c', '#3560b4', '#1d3a75', '#406fc0'], 41));
const pantsMat = std(null, { color: 0x4a3b2c, roughness: 0.95 });
const skinMat = std(null, { color: 0xe8b08a, roughness: 0.7 });
const beardMat = std(null, { color: 0x9c4a24, roughness: 0.95 });
const strawMat = std(wallTexture('#d9b45c', ['#c9a44a', '#e8c876', '#b8933e'], 43));
const shoeMat = std(null, { color: 0x26221e, roughness: 0.9 });

const bike = new THREE.Group();          // position + heading
const lean = new THREE.Group();          // roll
bike.add(lean); scene.add(bike);

const WHEEL_R = 0.34, BB = V3(0, 0.40, 0.05), CRANK_R = 0.17;
function buildWheel() {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R, 0.028, 8, 28), tireMat);
  tire.rotation.y = Math.PI / 2; g.add(tire);
  const spokes = new THREE.Mesh(new THREE.CircleGeometry(WHEEL_R - 0.02, 24),
    new THREE.MeshBasicMaterial({ map: spokeTex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.1 }));
  spokes.rotation.y = Math.PI / 2; g.add(spokes);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 8), chromeMat);
  hub.rotation.z = Math.PI / 2; g.add(hub);
  return g;
}
const wheelF = buildWheel(); wheelF.position.set(0, WHEEL_R, -0.58); lean.add(wheelF);
const wheelR = buildWheel(); wheelR.position.set(0, WHEEL_R, 0.40); lean.add(wheelR);
// frame
tube(V3(0, 1.0, 0.27), BB, 0.026, frameMat, lean);                       // seat tube
tube(BB, V3(0, 0.80, -0.50), 0.026, frameMat, lean);                    // down tube
tube(V3(0, 0.80, -0.50), V3(0, 1.04, -0.545), 0.03, frameMat, lean);    // head tube
tube(V3(0, 0.985, 0.25), V3(0, 1.03, -0.53), 0.024, frameMat, lean);    // top tube
for (const s of [-1, 1]) {
  tube(V3(s * 0.03, 0.97, 0.27), V3(s * 0.035, WHEEL_R, 0.40), 0.013, frameMat, lean); // seat stays
  tube(BB.clone().setX(s * 0.03), V3(s * 0.035, WHEEL_R, 0.40), 0.013, frameMat, lean); // chain stays
  tube(V3(s * 0.03, 0.82, -0.505), V3(s * 0.035, WHEEL_R, -0.58), 0.013, frameMat, lean); // fork
}
const saddle = new THREE.Mesh(unitBox, saddleMat);
saddle.scale.set(0.09, 0.05, 0.27); saddle.position.set(0, 1.05, 0.29); lean.add(saddle);
const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 8), chromeMat);
bars.rotation.z = Math.PI / 2; bars.position.set(0, 1.07, -0.53); lean.add(bars);
// crank + pedals
const crank = new THREE.Group(); crank.position.copy(BB); lean.add(crank);
for (const s of [-1, 1]) {
  const arm = new THREE.Mesh(unitBox, chromeMat);
  arm.scale.set(0.03, CRANK_R, 0.025); arm.position.set(s * 0.10, s * CRANK_R / 2, 0); crank.add(arm);
  const pedal = new THREE.Mesh(unitBox, shoeMat);
  pedal.scale.set(0.16, 0.03, 0.09); pedal.position.set(s * 0.145, s * CRANK_R, 0); crank.add(pedal);
}
// headlamp
const lampBody = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.1, 10), chromeMat);
lampBody.rotation.x = Math.PI / 2; lampBody.position.set(0, 1.01, -0.60); lean.add(lampBody);
const lens = new THREE.Mesh(new THREE.CircleGeometry(0.042, 12), new THREE.MeshBasicMaterial({ color: 0xfff3c8 }));
lens.position.set(0, 1.01, -0.655); lens.rotation.y = Math.PI; lean.add(lens);
const lampGlow = new THREE.Sprite(glowSpriteMat(0xffd9a0, 0.9));
lampGlow.scale.setScalar(1.15); lampGlow.position.set(0, 1.01, -0.7); lean.add(lampGlow);
const spot = new THREE.SpotLight(0xffd9a0, 36, 30, 0.52, 0.65, 1.4);
spot.position.set(0, 1.01, -0.62); spot.target.position.set(0, 0, -7);
lean.add(spot); lean.add(spot.target);
const spill = new THREE.PointLight(0xffc98a, 5, 8, 1.8);
spill.position.set(0, 1.05, -0.7); lean.add(spill);
const beamPool = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({
  map: poolTex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
}));
beamPool.material.opacity = 0.36;
beamPool.scale.set(1.5, 1, 2.7); beamPool.position.set(0, 0.04, -2.4); lean.add(beamPool);

/* Van Gogh himself */
const hips = new THREE.Group(); hips.position.set(0, 1.06, 0.28); lean.add(hips);
const torso = new THREE.Group(); torso.position.copy(hips.position); torso.rotation.x = -0.48; lean.add(torso);
const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.4, 4, 10), jacketMat);
chest.position.set(0, 0.26, 0); torso.add(chest);
const headG = new THREE.Group(); headG.position.set(0, 0.60, -0.03); torso.add(headG);
const skull = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 12), skinMat); headG.add(skull);
const beard = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.23, 10), beardMat);
beard.position.set(0, -0.115, -0.07); beard.rotation.x = Math.PI + 0.3; headG.add(beard);
for (const s of [-1, 1]) {
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 8), beardMat);
  hair.position.set(s * 0.105, 0.015, 0.01); headG.add(hair);
}
const hat = new THREE.Group(); hat.position.set(0, 0.088, 0); hat.rotation.x = 0.1; headG.add(hat);
const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.215, 0.018, 16), strawMat); hat.add(brim);
const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.1, 12), strawMat);
crown.position.y = 0.055; hat.add(crown);
// arms: shoulder -> grip (grip in torso-local coords, solved once)
for (const s of [-1, 1]) {
  const shoulder = V3(s * 0.20, 0.44, -0.02), grip = V3(s * 0.20, 0.37, -0.71);
  const elbow = shoulder.clone().lerp(grip, 0.55); elbow.y -= 0.09;
  tube(shoulder, elbow, 0.05, jacketMat, torso);
  tube(elbow, grip, 0.042, jacketMat, torso);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), skinMat);
  hand.position.copy(grip); torso.add(hand);
}
const tail = new THREE.Mesh(unitBox, jacketMat);
tail.scale.set(0.21, 0.17, 0.03); tail.position.set(0, 1.0, 0.435); tail.rotation.x = 0.45; lean.add(tail);
// legs: dynamic tubes, re-aimed every frame by the pedal IK
const legParts = {};
for (const s of [-1, 1]) {
  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.055, 1, 8), pantsMat); lean.add(thigh);
  const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, 1, 8), pantsMat); lean.add(shin);
  const foot = new THREE.Mesh(unitBox, shoeMat); foot.scale.set(0.09, 0.05, 0.23); lean.add(foot);
  legParts[s] = { thigh, shin, foot };
}
const LEG_L = 0.46;
function updateLegs(pedalPhase) {
  for (const s of [-1, 1]) {
    const th = pedalPhase + (s < 0 ? Math.PI : 0);
    const H = V3(s * 0.105, 1.05, 0.27);
    const F = V3(s * 0.145, BB.y + CRANK_R * Math.cos(th), BB.z + CRANK_R * Math.sin(th));
    const dy = F.y - H.y, dz = F.z - H.z;
    const D = Math.min(Math.hypot(dy, dz), LEG_L * 2 - 0.02);
    const dirY = dy / (Math.hypot(dy, dz) || 1), dirZ = dz / (Math.hypot(dy, dz) || 1);
    const a = D / 2, h = Math.sqrt(Math.max(LEG_L * LEG_L - a * a, 0.0004));
    // two knee candidates; keep the one that points forward (-z)
    const k1 = V3((H.x + F.x) / 2, H.y + dirY * a + dirZ * h, H.z + dirZ * a - dirY * h);
    const k2 = V3((H.x + F.x) / 2, H.y + dirY * a - dirZ * h, H.z + dirZ * a + dirY * h);
    const K = k1.z < k2.z ? k1 : k2;
    const P = legParts[s];
    setTube(P.thigh, H, K);
    setTube(P.shin, K, F);
    P.foot.position.set(F.x, F.y - 0.015, F.z - 0.03);
  }
}

/* ------------------------------- input ------------------------------- */
const tc = new TouchController({ zIndex: 1100, force: new URLSearchParams(location.search).has('forcetouch') });
// stick only, no action buttons: remove the default A/B the controller builds for an empty list
if (tc._buttons) { for (const id in tc._buttons) { const b = tc._buttons[id]; if (b.el) b.el.remove(); } tc._buttons = {}; }
const keys = {};
addEventListener('keydown', (e) => { keys[e.key] = true; });
addEventListener('keyup', (e) => { keys[e.key] = false; });
let captureSteer = null;
function readInput() {
  let x = 0;
  try { const ti = tc.getInput(); if (ti) x += ti.x; } catch { /* no touch dom */ }
  if (keys.ArrowLeft || keys.a) x -= 1;
  if (keys.ArrowRight || keys.d) x += 1;
  return Math.max(-1, Math.min(1, x));
}

/* ------------------------------- audio ------------------------------- */
let ac = null;
function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch { /* noop */ } }
    ac = new AC();
    const len = 2 * ac.sampleRate, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420;
    const gain = ac.createGain(); gain.gain.value = 0.045;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
    const lfoGain = ac.createGain(); lfoGain.gain.value = 130;
    lfo.connect(lfoGain); lfoGain.connect(filt.frequency);
    src.connect(filt); filt.connect(gain); gain.connect(ac.destination);
    src.start(); lfo.start();
    // one silent-buffer unlock tick, per the iOS pattern
    const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, ac.sampleRate); s.connect(ac.destination); s.start();
  } catch { ac = null; }
}
addEventListener('pointerdown', initAudio);
addEventListener('touchend', initAudio);
addEventListener('keydown', initAudio);

/* ------------------------------- the ride ------------------------------- */
const S = { dist: 0, steer: 0, steerPos: 0, steerVel: 0, lean: 0, t: 0, camMode: 'chase' };
const SPEED = 5.2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function step(dt) {
  S.t += dt;
  const inp = captureSteer !== null ? captureSteer : readInput();
  S.steer += (inp - S.steer) * Math.min(1, dt * 7);
  const prev = S.steerPos;
  S.steerPos = clamp(S.steerPos + S.steer * 3.4 * dt, -2.7, 2.7);
  S.steerVel = dt > 0 ? (S.steerPos - prev) / dt : 0;
  S.dist += SPEED * dt;
  const pedal = S.dist * 1.35;
  updateChunks(S.dist);
  const cx = centerX(S.dist), dcx = centerDX(S.dist);
  bike.position.set(cx + S.steerPos, 0, 0);
  bike.rotation.y = Math.atan2(-dcx, 1) - S.steerPos * 0.02;
  const leanTgt = clamp(-S.steerVel * 0.055 - dcx * 0.3, -0.16, 0.16);
  S.lean += (leanTgt - S.lean) * Math.min(1, dt * 6);
  lean.rotation.z = S.lean;
  const spin = -(S.dist / WHEEL_R) % (Math.PI * 2);
  wheelF.rotation.x = spin; wheelR.rotation.x = spin;
  crank.rotation.x = pedal % (Math.PI * 2);
  hips.position.y = 1.06 + Math.sin(pedal * 2) * 0.012;
  torso.position.y = hips.position.y;
  torso.rotation.z = Math.sin(pedal) * 0.02;
  tail.rotation.x = 0.45 + Math.sin(S.t * 7) * 0.06;
  spot.intensity = 36 + Math.sin(S.t * 31) * 1.2;
  updateLegs(pedal);
  // camera
  const bob = Math.sin(pedal * 2) * 0.035;
  if (S.camMode === 'front') {
    camera.position.set(centerX(S.dist + 8.6) + S.steerPos * 0.5, 2.1 + bob, -8.6);
    camera.lookAt(bike.position.x, 1.15, 0);
  } else if (S.camMode === 'sky') {
    camera.position.set(centerX(S.dist - 7.4) + S.steerPos * 0.55, 2.6 + bob, 7.4);
    camera.lookAt(bike.position.x, 9.5, -26);
  } else {
    camera.position.set(centerX(S.dist - 7.4) + S.steerPos * 0.55, 2.95 + bob, 7.4);
    camera.lookAt(bike.position.x + dcx * 3.2, 1.5, -3.9);
  }
  sky.position.set(camera.position.x, 0, camera.position.z);
}
const captureMode = new URLSearchParams(location.search).has('capture');
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  step(dt);
  renderer.render(scene, camera);
  if (!captureMode) requestAnimationFrame(frame);
}
step(1 / 30);
renderer.render(scene, camera);
document.getElementById('loading').style.display = 'none';
if (!captureMode) requestAnimationFrame(frame);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
window.__ride = {
  ready: true,
  step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) step(dt); renderer.render(scene, camera); },
  setSteer(v) { captureSteer = v; },
  clearSteer() { captureSteer = null; },
  teleport(d) { S.dist = d; updateChunks(d); step(0); renderer.render(scene, camera); },
  setCam(m) { S.camMode = m; },
  setSkyRot(y) { sky.rotation.y = y; },
  state() { return { dist: Math.round(S.dist * 10) / 10, steerPos: Math.round(S.steerPos * 100) / 100, camMode: S.camMode }; },
};
