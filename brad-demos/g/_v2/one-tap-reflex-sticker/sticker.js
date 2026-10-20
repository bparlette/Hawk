/* sticker.js — SAMPLE: "play as your sticker" for Flap Cat.
   Upload any image → auto background removal → crop → shrink → white sticker
   border → becomes the player sprite. Saved to localStorage so it persists. */
let stickerCanvas = null;
const LS_KEY = 'flapcat-sticker-v1';
const STICKER_PX = 256; // processed resolution (crisp at 88px display)

/* ---------- load saved sticker ---------- */
try {
  const saved = localStorage.getItem(LS_KEY);
  if (saved) {
    const img = new Image();
    img.onload = () => { stickerCanvas = img; refreshPreview(); };
    img.src = saved;
  }
} catch (e) { /* storage unavailable — fine */ }

export function getSticker() { return stickerCanvas; }
export function clearSticker() {
  stickerCanvas = null;
  try { localStorage.removeItem(LS_KEY); } catch (e) {}
  refreshPreview();
}

/* ---------- image processing ---------- */
function loadImageFile(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = rej;
    img.src = url;
  });
}

function drawToCanvas(img, maxSize) {
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c;
}

/* corner flood-fill background removal: if the 4 corners agree on a color,
   treat it as background and flood-fill it away (with tolerance) */
function removeBackground(srcCanvas, tolerance = 48) {
  const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = srcCanvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const at = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const cornerAvg = (cx, cy) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      const [pr, pg, pb] = at(Math.min(w - 1, Math.max(0, cx + x - 3)), Math.min(h - 1, Math.max(0, cy + y - 3)));
      r += pr; g += pg; b += pb; n++;
    }
    return [r / n, g / n, b / n];
  };
  const corners = [cornerAvg(0, 0), cornerAvg(w - 1, 0), cornerAvg(0, h - 1), cornerAvg(w - 1, h - 1)];
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const agree = corners.every(c => dist(c, corners[0]) < 60);
  if (!agree) return srcCanvas; // no uniform background — keep as-is
  const bg = corners[0];
  const tol = tolerance * 3;
  // BFS flood fill from all 4 corners
  const seen = new Uint8Array(w * h);
  const stack = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
  const close = (x, y) => {
    const i = (y * w + x) * 4;
    return Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) < tol;
  };
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x]) continue;
    seen[y * w + x] = 1;
    if (!close(x, y)) continue;
    d[(y * w + x) * 4 + 3] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(img, 0, 0);
  return srcCanvas;
}

function cropToContent(srcCanvas, pad = 0.10) {
  const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = srcCanvas;
  const d = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 12) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return srcCanvas; // fully transparent — keep as-is
  const pw = Math.round((maxX - minX + 1) * pad), ph = Math.round((maxY - minY + 1) * pad);
  minX = Math.max(0, minX - pw); minY = Math.max(0, minY - ph);
  maxX = Math.min(w - 1, maxX + pw); maxY = Math.min(h - 1, maxY + ph);
  const c = document.createElement('canvas');
  c.width = maxX - minX + 1; c.height = maxY - minY + 1;
  c.getContext('2d').drawImage(srcCanvas, minX, minY, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

/* white sticker halo: dilate the alpha silhouette, paint it white, lay the
   original on top */
function addStickerBorder(srcCanvas, borderPx = 10) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const scale = STICKER_PX / Math.max(w, h);
  const dw = Math.round(w * scale), dh = Math.round(h * scale);
  const fit = document.createElement('canvas');
  fit.width = dw + borderPx * 2; fit.height = dh + borderPx * 2;
  const fx = fit.getContext('2d');
  fx.drawImage(srcCanvas, borderPx, borderPx, dw, dh);
  // white silhouette
  const sil = document.createElement('canvas');
  sil.width = fit.width; sil.height = fit.height;
  const sx = sil.getContext('2d');
  sx.drawImage(fit, 0, 0);
  sx.globalCompositeOperation = 'source-in';
  sx.fillStyle = '#fff'; sx.fillRect(0, 0, sil.width, sil.height);
  // dilate by stamping the silhouette in a ring
  const halo = document.createElement('canvas');
  halo.width = fit.width; halo.height = fit.height;
  const hx = halo.getContext('2d');
  const r = Math.max(4, Math.round(borderPx * 0.55));
  for (let a = 0; a < 12; a++) {
    const th = (a / 12) * Math.PI * 2;
    hx.drawImage(sil, Math.cos(th) * r, Math.sin(th) * r);
  }
  hx.drawImage(sil, 0, 0);
  // composite: halo + original
  const out = document.createElement('canvas');
  out.width = fit.width; out.height = fit.height;
  const ox = out.getContext('2d');
  ox.drawImage(halo, 0, 0);
  ox.drawImage(fit, 0, 0);
  return out;
}

/* ---------- Apple-style subject cutout (ML) ---------- */
let bgModule = null;
function setCutoutStatus(msg) {
  const el = document.getElementById('stk-cutout');
  if (el) { el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }
}
async function mlCutout(img) {
  // lazy-load: ~82KB wrapper, model (~40MB) downloads once then caches
  if (!bgModule) {
    bgModule = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
  }
  const blob = await bgModule.removeBackground(img, {
    progress: (key, current, total) => {
      const pct = total ? Math.round((current / total) * 100) : 0;
      setCutoutStatus('✨ Cutting out subject… ' + pct + '%');
    },
  });
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const out = new Image();
    out.onload = () => { URL.revokeObjectURL(url); res(out); };
    out.onerror = rej;
    out.src = url;
  });
}

export async function processUpload(file, { removeBg = true } = {}) {
  const img = await loadImageFile(file);
  let c;
  if (removeBg) {
    try {
      setCutoutStatus('✨ Cutting out subject…');
      const cut = await mlCutout(img);          // Apple-style ML subject lift
      c = drawToCanvas(cut, 512);
    } catch (e) {
      c = drawToCanvas(img, 512);               // fallback: flood-fill
      c = removeBackground(c);
    } finally {
      setCutoutStatus('');
    }
  } else {
    c = drawToCanvas(img, 512);
  }
  c = cropToContent(c);
  c = addStickerBorder(c);
  stickerCanvas = c;
  try { localStorage.setItem(LS_KEY, c.toDataURL('image/png')); } catch (e) {}
  refreshPreview();
  return c;
}

/* ---------- calm mode (kill the crazy bounce/ripple/shake) ---------- */
const CALM_KEY = 'flapcat-calm';
export function isCalm() {
  try {
    return new URLSearchParams(location.search).has('calm') || localStorage.getItem(CALM_KEY) === '1';
  } catch (e) { return false; }
}
export function setCalm(on) {
  try {
    if (on) localStorage.setItem(CALM_KEY, '1');
    else localStorage.removeItem(CALM_KEY);
  } catch (e) {}
  location.reload(); // cleanest: re-init the engine without juice
}

/* ---------- UI ---------- */
let panelEl = null, btnEl = null, previewImg = null, gameRef = null;

function refreshPreview() {
  if (previewImg) previewImg.src = stickerCanvas ? stickerCanvas.toDataURL() : '';
  if (previewImg) previewImg.style.display = stickerCanvas ? 'block' : 'none';
}

export function initStickerUI(g) {
  gameRef = g;
  const isAuto = new URLSearchParams(location.search).has('auto');
  if (isAuto) return; // bot plays the normal cat

  const css = document.createElement('style');
  css.textContent = `
    #stk-btn{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom));
      z-index:50;background:linear-gradient(150deg,#ff3b8d,#7a2bff);color:#fff;border:0;border-radius:99px;
      padding:13px 26px;font:800 15px/1 system-ui;letter-spacing:.04em;box-shadow:0 10px 30px rgba(255,59,141,.45);cursor:pointer}
    #stk-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;width:min(88vw,340px);
      background:#141126;border:1px solid rgba(150,195,255,.25);border-radius:20px;padding:20px;color:#eef4ff;
      font-family:system-ui;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.7)}
    #stk-panel h3{margin:0 0 4px;font-size:17px}
    #stk-panel p{margin:0 0 12px;font-size:12.5px;color:#8ea3c9}
    #stk-preview{width:120px;height:120px;margin:0 auto 12px;display:none;border-radius:16px;background:
      repeating-conic-gradient(#1c1a33 0 25%,#16142b 0 50%) 0 0/24px 24px;border:1px solid rgba(150,195,255,.2)}
    #stk-panel input[type=file]{display:none}
    .stk-row{display:flex;gap:8px;justify-content:center;margin-top:10px}
    .stk-act{border:0;border-radius:12px;padding:11px 18px;font:800 13px system-ui;cursor:pointer}
    .stk-pick{background:#2a2654;color:#cfe0ff}
    .stk-play{background:linear-gradient(150deg,#7df9ff,#2f9bff);color:#04121c}
    .stk-clear{background:transparent;color:#8ea3c9;border:1px solid rgba(150,195,255,.25)}
    .stk-note{font-size:11px;color:#64769a;margin-top:10px}
  `;
  document.head.appendChild(css);

  btnEl = document.createElement('button');
  btnEl.id = 'stk-btn';
  btnEl.textContent = stickerCanvas ? '😻 Playing as YOUR sticker — tap to change' : '📷 Play as YOUR sticker';
  btnEl.onclick = () => { panelEl.style.display = 'block'; };
  document.body.appendChild(btnEl);

  panelEl = document.createElement('div');
  panelEl.id = 'stk-panel';
  panelEl.style.display = 'none';
  panelEl.innerHTML = `
    <h3>📷 Your sticker, your cat</h3>
    <p>Upload any photo or sticker — background gets cut out,<br>shrunk to size, sticker border added.</p>
    <img id="stk-preview" alt="sticker preview">
    <div id="stk-cutout" style="display:none;font-size:12px;color:#7df9ff;margin:6px 0"></div>
    <div class="stk-row">
      <label class="stk-act stk-pick" for="stk-file">Choose image</label>
      <button class="stk-act stk-play" id="stk-done">Play!</button>
    </div>
    <div class="stk-row">
      <button class="stk-act stk-clear" id="stk-clear">Use normal cat</button>
    </div>
    <div class="stk-row">
      <button class="stk-act stk-clear" id="stk-calm">🧘 Calm mode: OFF</button>
    </div>
    <input type="file" id="stk-file" accept="image/*">
    <div class="stk-note">Saved on this device. Works with drag &amp; drop too.</div>`;
  document.body.appendChild(panelEl);
  previewImg = panelEl.querySelector('#stk-preview');
  refreshPreview();

  panelEl.querySelector('#stk-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      await processUpload(f);
      btnEl.textContent = '😻 Playing as YOUR sticker — tap to change';
    } catch (err) { alert('Could not read that image.'); }
    e.target.value = '';
  });
  panelEl.querySelector('#stk-done').onclick = () => { panelEl.style.display = 'none'; };
  panelEl.querySelector('#stk-clear').onclick = () => {
    clearSticker();
    btnEl.textContent = '📷 Play as YOUR sticker';
    panelEl.style.display = 'none';
  };
  const calmBtn = panelEl.querySelector('#stk-calm');
  const paintCalm = () => { calmBtn.textContent = isCalm() ? '🧘 Calm mode: ON' : '🧘 Calm mode: OFF'; };
  paintCalm();
  calmBtn.onclick = () => setCalm(!isCalm());
  // drag & drop anywhere
  ['dragover', 'drop'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
  document.addEventListener('drop', async (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) {
      try { await processUpload(f); btnEl.textContent = '😻 Playing as YOUR sticker — tap to change'; panelEl.style.display = 'block'; }
      catch (err) {}
    }
  });
  // paste from clipboard (e.g. copied sticker)
  document.addEventListener('paste', async (e) => {
    const item = [...(e.clipboardData.items || [])].find(i => i.type.startsWith('image/'));
    if (item) {
      try { await processUpload(item.getAsFile()); btnEl.textContent = '😻 Playing as YOUR sticker — tap to change'; }
      catch (err) {}
    }
  });
  // hide the button while playing
  const tick = () => {
    try {
      if (btnEl) btnEl.style.display = (gameRef && gameRef.mode === 'play' && panelEl.style.display !== 'block') ? 'none' : 'block';
    } catch (e) {}
    setTimeout(tick, 400);
  };
  tick();
}
