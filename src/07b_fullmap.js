// ---------------- full-screen map (Brad): tap / click the minimap, or Tab (gamepad: Back/Select) ----------------
// A 2D-canvas overlay of the whole Inner Harbor: water, piers, promenade ring, street grid + blocks, Federal Hill, all 16 landmarks as labelled
// footprints (the 5 HD-modelled ones + Domino Sugars drawn bigger), a live Harold marker with a heading arrow, Mavis. The game is paused while it is
// open (frame() in 07_main.js skips the sim + the 3D draw). Closed it costs nothing: the overlay is display:none and its canvas is shrunk to 0x0.
// Close: X button, tap outside the map card (the arcade panel counts as outside), Tab / Esc, gamepad Back or B. M stays the radio key.
const FMAP = (function () {
  const css = document.createElement('style');
  css.textContent = `
  #mmap { pointer-events: auto; cursor: pointer; touch-action: manipulation; }
  #fmap { display: none; position: fixed; z-index: 70; left: 0; right: 0; top: 0; bottom: var(--panel, 0px); background: rgba(7,5,13,.72); touch-action: none; }
  #fmap.on { display: block; }
  #fmapc { position: absolute; left: calc(env(safe-area-inset-left, 0px) + 8px); right: calc(env(safe-area-inset-right, 0px) + 8px); top: calc(env(safe-area-inset-top, 0px) + 8px); bottom: 8px;
    border: 3px solid #000; box-shadow: 4px 4px 0 #000, inset 0 0 0 2px #ff9ad0; background: #1b1a22; overflow: hidden; }
  #fmapcv { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; }
  #fmapt { position: absolute; left: 10px; top: 9px; font: 11px/1 'PX', monospace; color: #ffe08a; text-shadow: 2px 2px 0 #000; letter-spacing: 1px; pointer-events: none; }
  #fmapx { position: absolute; right: 6px; top: 6px; width: 40px; height: 40px; border: 2px solid #000; background: #ff3d6e; color: #fff; font: 900 22px/34px system-ui, sans-serif;
    box-shadow: 2px 2px 0 #000; cursor: pointer; padding: 0; touch-action: manipulation; }
  #fmaph { position: absolute; left: 10px; bottom: 8px; font: 700 11px/1.2 system-ui, -apple-system, sans-serif; color: #c9c3d8; text-shadow: 1px 1px 0 #000; pointer-events: none; }`;
  document.head.appendChild(css);
  const ov = document.createElement('div'); ov.id = 'fmap'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Map of the Inner Harbor');
  ov.innerHTML = '<div id="fmapc"><canvas id="fmapcv"></canvas><div id="fmapt">INNER HARBOR</div><button id="fmapx" type="button" aria-label="close map" title="close map (Tab / Esc)">✕</button><div id="fmaph"></div></div>';
  document.body.appendChild(ov);
  const card = ov.querySelector('#fmapc'), cv = ov.querySelector('#fmapcv'), g = cv.getContext('2d'); cv.width = cv.height = 0;
  const F = { open: false, opens: 0, closes: 0, why: '', t: 0, rot: false, k: 1, frames: 0 };

  // landmark diorama boxes [x0, z0, x1, z1] (world metres; the same boxes mkthumbs.js bakes) + whether the landmark is one of the 7 HD models (bigger, gold rim)
  const LMB = { harborplace: [-61, -31, -43, 4, 1], constellation: [-37, -37, -25, -8, 1], wtc: [-21, -31, -3, -13, 1], aquarium: [5, -31, 33, -3, 1], powerplant: [43, -31, 69, -3, 1],
    fourseasons: [69, -71, 95, -45], pendry: [109, -31, 143, -17], fells: [137, -71, 163, -45], monument: [-33, -105, -7, -79], orioles: [-137, -37, -75, 37],
    ravens: [-137, 45, -75, 107], science: [-67, 45, -41, 71, 1], fedhill: [-33, 45, 27, 73], domino: [69, 45, 95, 71, 1], underarmour: [103, 45, 129, 71], fort: [137, 45, 214, 107] };
  Object.assign(LMB, { lexington: [-101, -71, -75, -45], rashfield: [-43, 18, -20, 31] }); // lexington: new landmarks (no baked mini-model yet: drawn as a footprint + label)
  const NICE = { harborplace: 'HARBORPLACE', constellation: 'CONSTELLATION', wtc: 'WORLD TRADE', aquarium: 'AQUARIUM', powerplant: 'POWER PLANT', fourseasons: 'HARBOR EAST GRAND',
    pendry: 'PENDRY', fells: 'FELLS POINT', monument: 'MONUMENT', orioles: 'ORIOLE PARK', ravens: 'M&T STADIUM', science: 'SCIENCE CENTER', fedhill: 'FED HILL',
    domino: 'HARBOR SUGAR CO.', underarmour: 'SWEATFORGE PIER', fort: 'FORT McHENRY' };
  Object.assign(NICE, { lexington: 'LEXINGTON MKT', rashfield: 'RASH FIELD' }); // lexington:
  const STREETS = [['PRATT ST', -112, -41, 0], ['KEY HWY', 40, 41, 0], ['LIGHT ST', -71, -90, 1], ['LOMBARD ST', 40, -75, 0]];
  const BOATS = [[-46, 17, 0], [-10, -7, 1], [-6, 14, 0], [38, 9, 1], [76, -12, 0], [98, 20, 1], [150, 6, 0], [186, -16, 1], [203, 21, 0], [128, -6, 1]];
  const M = 6, X0 = WB.x0 - M, X1 = WB.x1 + M, Z0 = WB.z0 - M, Z1 = WB.z1 + M; // map extent (world)
  let W = 0, H = 0, dpr = 1, ox = 0, oy = 0, bg = null;
  // the 16 landmark mini-models: baked at build time (mkthumbs.js / .py) into one small atlas, fetched lazily the first time the map opens, then cut into
  // per-landmark canvases with their rim (gold for the HD 7, a thin ink line for the rest). Nothing is loaded or drawn while the map has never opened.
  const TH = { img: null, ready: false, spr: {}, ms: 0 };
  function loadThumbs() {
    if (TH.img) return; TH.img = new Image(); TH.img.decoding = 'async';
    TH.img.onload = () => {
      const t0 = performance.now();
      for (const id in FM_THUMBS) {
        const [sx, sy, sw, sh] = FM_THUMBS[id], hd = LMB[id] && LMB[id][4], pad = hd ? 4 : 2, c = document.createElement('canvas'); c.width = sw + pad * 2; c.height = sh + pad * 2;
        const x = c.getContext('2d'), m = document.createElement('canvas'); m.width = c.width; m.height = c.height; const mx = m.getContext('2d');
        const ring = (r, col) => { mx.clearRect(0, 0, m.width, m.height); mx.globalCompositeOperation = 'source-over';
          for (let a = 0; a < 12; a++) mx.drawImage(TH.img, sx, sy, sw, sh, pad + Math.round(Math.cos(a * TAU / 12) * r), pad + Math.round(Math.sin(a * TAU / 12) * r), sw, sh);
          mx.globalCompositeOperation = 'source-in'; mx.fillStyle = col; mx.fillRect(0, 0, m.width, m.height); x.drawImage(m, 0, 0); };
        if (hd) { ring(4, '#14101f'); ring(2.5, '#ffd23c'); } else ring(1.5, 'rgba(20,16,31,.85)');
        x.drawImage(TH.img, sx, sy, sw, sh, pad, pad, sw, sh); TH.spr[id] = { c, pad };
      }
      TH.ready = true; TH.ms = performance.now() - t0; if (F.open && bg) { drawStatic(bg.getContext('2d')); drawLive(); }
    };
    TH.img.onerror = () => { TH.err = 1; };
    TH.img.src = 'fmthumbs.webp';
  }
  // world -> canvas px. Landscape: north up. Portrait (taller than wide): turned 90 deg so the harbour's long east-west axis runs up the screen (east at the top).
  function P(x, z) { return F.rot ? [ox + (z - Z0) * F.k, oy + (X1 - x) * F.k] : [ox + (x - X0) * F.k, oy + (z - Z0) * F.k]; }
  function sr(x0, z0, x1, z1) { const a = P(x0, z0), b = P(x1, z1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])]; } // screen rect
  function rect(c, x0, z0, x1, z1) { const r = sr(x0, z0, x1, z1); c.fillRect(r[0], r[1], r[2], r[3]); }
  function layout() {
    const r = card.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    cv.width = W; cv.height = H; F.rot = H > W * 1.05;
    const top = 50 * dpr, bot = 24 * dpr, side = 8 * dpr, ww = X1 - X0, wh = Z1 - Z0, mw = F.rot ? wh : ww, mh = F.rot ? ww : wh;
    F.k = Math.min((W - side * 2) / mw, (H - top - bot) / mh); ox = (W - mw * F.k) / 2; oy = top + (H - top - bot - mh * F.k) / 2;
    bg = document.createElement('canvas'); bg.width = W; bg.height = H; drawStatic(bg.getContext('2d'));
    ov.querySelector('#fmaph').textContent = (TOUCH ? 'tap outside or ✕ to close' : 'Tab / Esc / click outside to close') + (F.rot ? '  ·  east ↑' : '');
  }
  const inLM = (x0, z0, x1, z1) => { for (const id in LMB) { const b = LMB[id]; if (x0 < b[2] && x1 > b[0] && z0 < b[3] && z1 > b[1]) return true; } return false; };
  const hsh = (a, b) => { let h = (a * 73856093) ^ (b * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function bubble(c, b, t, fs, hd, tail) { // white speech-bubble label with a dark ink outline and a pointer to tail (when the tail is above or below it)
    const [x, y, w, h] = b, r = 3 * D_(), lw = (hd ? 2.2 : 1.8) * D_(), tw = 4 * D_(), dn = tail[1] > y + h, up = tail[1] < y, lt = !dn && !up && tail[0] < x, rt = !dn && !up && tail[0] > x + w;
    const tx = Math.max(x + r + tw, Math.min(x + w - r - tw, tail[0])), ey = dn ? y + h : y, ty = Math.max(y + r + tw * 0.6, Math.min(y + h - r - tw * 0.6, tail[1])), ex = lt ? x : x + w;
    const rr = () => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
    const tri = () => { c.beginPath(); if (lt || rt) { c.moveTo(ex, ty - tw * 0.6); c.lineTo(tail[0], tail[1]); c.lineTo(ex, ty + tw * 0.6); } else { c.moveTo(tx - tw, ey); c.lineTo(tail[0], tail[1]); c.lineTo(tx + tw, ey); } c.closePath(); };
    c.save(); c.translate(1.5 * D_(), 1.5 * D_()); c.fillStyle = 'rgba(0,0,0,.35)'; rr(); c.fill(); if (dn || up || lt || rt) { tri(); c.fill(); } c.restore();
    c.lineJoin = 'round'; c.strokeStyle = '#1a1730'; c.lineWidth = lw; c.fillStyle = '#fbfaf5';
    if (dn || up || lt || rt) { tri(); c.fill(); c.stroke(); }
    rr(); c.fill(); c.stroke();
    c.fillStyle = '#fbfaf5'; if (dn || up) c.fillRect(tx - tw + lw * 0.6, ey - lw * 0.7, tw * 2 - lw * 1.2, lw * 1.4); else if (lt || rt) c.fillRect(ex - lw * 0.7, ty - tw * 0.6 + lw * 0.6, lw * 1.4, tw * 1.2 - lw * 1.2);
    if (hd) { c.strokeStyle = '#e8b31c'; c.lineWidth = 1 * D_(); c.strokeRect(x + 2.5 * D_(), y + 2.5 * D_(), w - 5 * D_(), h - 5 * D_()); }
    c.fillStyle = '#1a1730'; c.font = `${fs}px PX, 'Courier New', monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x + w / 2, y + h / 2 + 0.5 * D_());
  }
  const D_ = () => dpr;
  function drawStatic(c) {
    const k = F.k, D = dpr;
    c.fillStyle = '#1b1a22'; c.fillRect(0, 0, W, H);
    c.save(); { const r = sr(X0, Z0, X1, Z1); c.beginPath(); c.rect(r[0], r[1], r[2], r[3]); c.clip(); }
    c.fillStyle = '#a7abb1'; rect(c, X0, Z0, X1, Z1);                                    // streets: light grey asphalt
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = Math.max(1, 0.25 * k); c.setLineDash([3 * D, 4 * D]);   // centre lines on the grid streets
    for (let x = -105; x < X1; x += 34) { const a = P(x, Z0), b2 = P(x, BASIN.z0 - PROM - 2); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b2[0], b2[1]); c.stroke(); const a2 = P(x, BASIN.z1 + PROM + 2), b3 = P(x, Z1); c.beginPath(); c.moveTo(a2[0], a2[1]); c.lineTo(b3[0], b3[1]); c.stroke(); }
    for (const z of [-41, -75, 41, 75]) { const a = P(X0, z), b2 = P(X1, z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b2[0], b2[1]); c.stroke(); }
    c.setLineDash([]);
    for (const p of PLOTS) { const park = (p.x0 === -32 || (p.x0 === 138 && p.z0 > 0)), r = sr(p.x0, p.z0, p.x1, p.z1);   // blocks: pale sidewalk with a kerb line; parks green
      c.fillStyle = park ? '#7fbf5a' : '#dcd8cf'; c.fillRect(r[0], r[1], r[2], r[3]); c.strokeStyle = park ? '#4f8a3a' : '#8e8a82'; c.lineWidth = Math.max(1, 0.3 * k); c.strokeRect(r[0], r[1], r[2], r[3]); }
    // brick promenade ring, then the water: the game's basin (round inner corners), piers cut out of it, a dark seawall line and a pale foam edge
    c.fillStyle = '#c99a78'; rect(c, BASIN.x0 - PROM, BASIN.z0 - PROM, X1 + 20, BASIN.z1 + PROM);
    { const r = sr(BASIN.x0, BASIN.z0, X1 + 20, BASIN.z1), rr = 5 * k; c.beginPath(); if (c.roundRect) c.roundRect(r[0], r[1], r[2], r[3], rr); else c.rect(r[0], r[1], r[2], r[3]);
      const gr = c.createLinearGradient(r[0], r[1], r[0] + (F.rot ? r[2] : 0), r[1] + (F.rot ? 0 : r[3])); gr.addColorStop(0, '#2f78d6'); gr.addColorStop(0.5, '#2a6cc8'); gr.addColorStop(1, '#2f78d6');
      c.fillStyle = gr; c.fill(); c.strokeStyle = 'rgba(200,235,255,.75)'; c.lineWidth = 1.5 * D; c.stroke(); c.strokeStyle = '#173e7a'; c.lineWidth = 0.8 * D; c.stroke(); }
    c.strokeStyle = 'rgba(190,225,255,.5)'; c.lineWidth = 1 * D; c.lineCap = 'round';                      // wave ticks
    for (let i = 0; i < 70; i++) { const x = BASIN.x0 + 4 + hsh(i, 3) * (X1 - BASIN.x0 - 4), z = BASIN.z0 + 3 + hsh(i, 7) * (BASIN.z1 - BASIN.z0 - 6); if (onPier(x, z) || onPier(x, z + 2)) continue;
      const [wx, wy] = P(x, z), s = 2.2 * D; c.beginPath(); c.moveTo(wx - s, wy); c.quadraticCurveTo(wx - s / 2, wy - s * 0.6, wx, wy); c.quadraticCurveTo(wx + s / 2, wy - s * 0.6, wx + s, wy); c.stroke(); }
    c.lineCap = 'butt';
    for (const p of PIERS) { const r = sr(p.x0, p.z0, p.x1, p.z1); c.fillStyle = p.t === 'plank' ? '#b88a5c' : '#cfa584'; c.fillRect(r[0], r[1], r[2], r[3]); c.strokeStyle = '#3b2a1e'; c.lineWidth = 1.2 * D; c.strokeRect(r[0], r[1], r[2], r[3]); }
    // boats (white hulls, a wake), trees along the promenade
    for (const [x, z, v] of BOATS) { if (onPier(x, z)) continue; const [bx, by] = P(x, z), L = Math.max(5 * D, 4.5 * k), Wd = L * 0.38, alongX = F.rot ? 0 : 1;
      c.save(); c.translate(bx, by); if (!alongX) c.rotate(-Math.PI / 2); if (v) c.scale(-1, 1);
      c.strokeStyle = 'rgba(235,248,255,.7)'; c.lineWidth = 1 * D; c.beginPath(); c.moveTo(-L * 0.55, -Wd * 0.3); c.lineTo(-L * 1.4, -Wd * 0.9); c.moveTo(-L * 0.55, Wd * 0.3); c.lineTo(-L * 1.4, Wd * 0.9); c.stroke();
      c.fillStyle = '#fff'; c.strokeStyle = '#14101f'; c.lineWidth = 1 * D; c.beginPath(); c.moveTo(-L / 2, -Wd / 2); c.lineTo(L * 0.25, -Wd / 2); c.lineTo(L / 2, 0); c.lineTo(L * 0.25, Wd / 2); c.lineTo(-L / 2, Wd / 2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = v ? '#ff3d6e' : '#ffd23c'; c.fillRect(-L * 0.25, -Wd * 0.25, L * 0.3, Wd * 0.5); c.restore(); }
    const treeAt = (x, z) => { const [tx, ty] = P(x, z), r = Math.max(2 * D, 1.5 * k); c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(tx + r * 0.3, ty + r * 0.45, r, r * 0.6, 0, 0, TAU); c.fill();
      c.fillStyle = '#3f7f34'; c.beginPath(); c.arc(tx, ty - r * 0.4, r, 0, TAU); c.fill(); c.fillStyle = '#6fb04c'; c.beginPath(); c.arc(tx - r * 0.3, ty - r * 0.7, r * 0.5, 0, TAU); c.fill(); };
    for (let x = -34; x < 212; x += 18) { if (!inLM(x - 1, -36, x + 1, -34)) treeAt(x, BASIN.z0 - 4.8); if (!inLM(x - 1, 34, x + 1, 36)) treeAt(x, BASIN.z1 + 4.8); }
    for (let z = -22; z < 28; z += 16) if (!inLM(-65, z - 1, -64, z + 1)) treeAt(BASIN.x0 - 4.6, z);
    // the generic city: every building the game has, as a little 2.5D block (roof lifted up the screen by its height, front face below it), back to front
    const eh = k * 0.32, PALR = ['#e9e4da', '#d7d2c8', '#cfc5b6', '#e2d3bf', '#c9ccd0', '#d9c2ae'];
    const bl = []; for (const b of BLD) { if (b.x1 < X0 || b.x0 > X1 || b.z1 < Z0 || b.z0 > Z1 || inLM(b.x0, b.z0, b.x1, b.z1)) continue; const r = sr(b.x0, b.z0, b.x1, b.z1); bl.push([r, Math.min(b.h, 34) * eh, hsh(b.x0 | 0, b.z0 | 0)]); }
    bl.sort((a, b) => a[0][1] + a[0][3] - (b[0][1] + b[0][3]));
    c.lineWidth = Math.max(0.8, 0.22 * k);
    for (const [r, hh, q] of bl) { const roof = PALR[(q * PALR.length) | 0];
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(r[0] + hh * 0.35, r[1] + r[3] - hh * 0.2, r[2], hh * 0.35);              // contact shadow
      c.fillStyle = q < 0.5 ? '#8e7f72' : '#9a948c'; c.fillRect(r[0], r[1] + r[3] - hh, r[2], hh);                         // front face
      c.fillStyle = 'rgba(255,236,170,.55)'; for (let wy = r[1] + r[3] - hh + 2.5 * D; wy < r[1] + r[3] - 2.5 * D; wy += 3.5 * D) for (let wx = r[0] + 2 * D; wx < r[0] + r[2] - 2 * D; wx += 3.5 * D) c.fillRect(wx, wy, 1.4 * D, 1.4 * D);
      c.fillStyle = roof; c.fillRect(r[0], r[1] - hh, r[2], r[3]); c.strokeStyle = 'rgba(40,34,46,.75)'; c.strokeRect(r[0], r[1] - hh, r[2], r[3] + hh); }
    // street names
    c.font = `800 ${Math.round(8.5 * D)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const [t, x, z, vert] of STREETS) { const [sx, sy] = P(x, z); c.save(); c.translate(sx, sy); if ((vert ? 1 : 0) ^ (F.rot ? 1 : 0)) c.rotate(-Math.PI / 2); c.lineWidth = 3 * D; c.strokeStyle = 'rgba(167,171,177,.95)'; c.strokeText(t, 0, 0); c.fillStyle = '#4a4d55'; c.fillText(t, 0, 0); c.restore(); }
    c.restore();
    // landmark mini-models: sized from their footprint (HD 7 bigger), capped by the screen, shrunk in pairs until they stop overlapping much, drawn back to front
    const S = Math.min(W, H), items = [];
    for (const L of LANDMARKS) { const b = LMB[L.id], t = FM_THUMBS[L.id] || (b && [0, 0, (b[2] - b[0]) * 4, (b[3] - b[1]) * 4, (b[2] - b[0]) * 2, (b[3] - b[1]) * 2, 4]); if (!b || !t) continue; const hd = !!b[4]; // lexington: footprint fallback for landmarks without a baked mini-model
      let sc = (k * (hd ? 1.6 : 1.3)) / t[6]; sc = Math.min(sc, (S * (hd ? 0.30 : 0.22)) / t[3], (S * (hd ? 0.36 : 0.30)) / t[2]); sc = Math.max(sc, (hd ? 34 : 26) * D / Math.max(t[2], t[3]));
      const [gx, gy] = P((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); items.push({ L, b, t, hd, sc, gx, gy, min: sc * 0.55 }); }
    const box = (o) => [o.gx - o.t[4] * o.sc, o.gy - o.t[5] * o.sc, o.gx + (o.t[2] - o.t[4]) * o.sc, o.gy + (o.t[3] - o.t[5]) * o.sc];
    for (let it = 0; it < 24; it++) { let moved = false;
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const A = items[i], B = items[j], a = box(A), b2 = box(B);
        const ix = Math.min(a[2], b2[2]) - Math.max(a[0], b2[0]), iy = Math.min(a[3], b2[3]) - Math.max(a[1], b2[1]); if (ix <= 0 || iy <= 0) continue;
        const sm = Math.min((a[2] - a[0]) * (a[3] - a[1]), (b2[2] - b2[0]) * (b2[3] - b2[1])); if (ix * iy < sm * 0.12) continue;
        const aA = (a[2] - a[0]) * (a[3] - a[1]), aB = (b2[2] - b2[0]) * (b2[3] - b2[1]), big = aA >= aB ? A : B, sml = big === A ? B : A; // shrink the bigger model first
        for (const o of (big.sc > big.min ? [big] : [sml])) if (o.sc > o.min) { o.sc = Math.max(o.min, o.sc * 0.93); moved = true; } }
      if (!moved) break; }
    for (const o of items) { const top = 22 * D, b2 = box(o); if (b2[1] < top) o.sc *= (o.gy - top) / (o.gy - b2[1]); const b3 = box(o); if (b3[0] < 2 * D) o.sc *= (o.gx - 2 * D) / (o.gx - b3[0]); const b4 = box(o); if (b4[2] > W - 2 * D) o.sc *= (W - 2 * D - o.gx) / (b4[2] - o.gx); } // keep every model inside the card
    items.sort((a, b) => a.gy - b.gy);
    const placed = [];
    for (const o of items) { const bb = box(o); o.bb = bb; placed.push(bb);
      if (TH.ready && TH.spr[o.L.id]) { const s = TH.spr[o.L.id]; c.drawImage(s.c, bb[0] - s.pad * o.sc, bb[1] - s.pad * o.sc, s.c.width * o.sc, s.c.height * o.sc); }
      else { c.fillStyle = o.hd ? 'rgba(255,210,60,.5)' : 'rgba(255,224,138,.3)'; c.strokeStyle = o.hd ? '#ffd23c' : 'rgba(20,16,31,.8)'; c.lineWidth = 1.5 * D; rect(c, o.b[0], o.b[1], o.b[2], o.b[3]); const r = sr(o.b[0], o.b[1], o.b[2], o.b[3]); c.strokeRect(r[0], r[1], r[2], r[3]); } }
    F.sprites = items.map((o) => [o.L.id, Math.round(o.bb[2] - o.bb[0]), Math.round(o.bb[3] - o.bb[1])]);
    // speech-bubble labels: first spot (above the model, nudged sideways, then beside / below) that hits no other label and covers no other model much
    const labs = [], hitL = (q) => labs.some((p) => q[0] < p[2] && q[2] > p[0] && q[1] < p[3] && q[3] > p[1]);
    const cover = (q, self) => { let a = 0; for (const p of placed) { if (p === self) continue; const ix = Math.min(q[2], p[2]) - Math.max(q[0], p[0]), iy = Math.min(q[3], p[3]) - Math.max(q[1], p[1]); if (ix > 0 && iy > 0) a += ix * iy; } return a / ((q[2] - q[0]) * (q[3] - q[1])); };
    const order = items.slice().sort((a, b) => b.hd - a.hd || a.gy - b.gy), ins = (p) => { const ix = (p[2] - p[0]) * 0.18, iy = (p[3] - p[1]) * 0.12; return [p[0] + ix, p[1] + iy, p[2] - ix, p[3] - iy]; };
    const coverAll = (q, self) => { let a = 0, own = 0; for (const p0 of placed) { const p = ins(p0), ix = Math.min(q[2], p[2]) - Math.max(q[0], p[0]), iy = Math.min(q[3], p[3]) - Math.max(q[1], p[1]); if (ix > 0 && iy > 0) { if (p0 === self) own += ix * iy; else a += ix * iy; } } const ar = (q[2] - q[0]) * (q[3] - q[1]); return [a / ar, own / ar]; };
    for (const o of order) { const fs = Math.round((o.hd ? (F.rot ? 8 : 9) : (F.rot ? 7 : 8)) * D); c.font = `${fs}px PX, 'Courier New', monospace`; const t = NICE[o.L.id] || o.L.name;
      const w = c.measureText(t).width + 10 * D, h = fs + 9 * D, bb = o.bb, cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, tl = 7 * D, top = bb[1] + (bb[3] - bb[1]) * 0.08;
      const cand = []; // [x, y, tail x, tail y, rank]
      for (const dy of [0, -h * 0.8, -h * 1.7, -h * 2.6]) for (const dx of [0, -w * 0.35, w * 0.35, -w * 0.7, w * 0.7, -w * 1.1, w * 1.1]) cand.push([cx - w / 2 + dx, top - tl - h + dy, cx, top, Math.abs(dx) / w * 0.5 + -dy / h * 0.4]);
      for (const fy of [0.3, 0.5, 0.7]) { const ty = bb[1] + (bb[3] - bb[1]) * fy; cand.push([bb[2] + tl, ty - h / 2, bb[2] - (bb[2] - bb[0]) * 0.2, ty, 1.2], [bb[0] - tl - w, ty - h / 2, bb[0] + (bb[2] - bb[0]) * 0.2, ty, 1.2]); }
      for (const dy of [0, h * 0.9]) for (const dx of [0, -w * 0.4, w * 0.4]) cand.push([cx - w / 2 + dx, bb[3] + tl + dy, cx, bb[3] - (bb[3] - bb[1]) * 0.15, 1.6 + Math.abs(dx) / w * 0.5 + dy / h * 0.4]);
      for (const fy of [0.3, 0.5, 0.7]) { const ty = bb[1] + (bb[3] - bb[1]) * fy; cand.push([bb[2] + tl + w * 0.5, ty - h / 2, bb[2] - (bb[2] - bb[0]) * 0.2, ty, 1.8], [bb[0] - tl - w * 1.5, ty - h / 2, bb[0] + (bb[2] - bb[0]) * 0.2, ty, 1.8]); }
      let best = null, bs = 1e9;
      for (const [x, y, px, py, rk] of cand) { const q = [Math.max(3 * D, Math.min(W - w - 3 * D, x)), Math.max(48 * D, Math.min(H - h - 26 * D, y)), 0, 0]; q[2] = q[0] + w; q[3] = q[1] + h;
        const ex = Math.max(q[0], Math.min(q[2], px)), ey = Math.max(q[1], Math.min(q[3], py)), tlen = Math.hypot(px - ex, py - ey) / (30 * D);
        let cross = 0; for (const L2 of labs) for (let u = 0.15; u < 1; u += 0.2) { const sx = ex + (px - ex) * u, sy = ey + (py - ey) * u; if (sx > L2[0] && sx < L2[2] && sy > L2[1] && sy < L2[3]) cross = 1; }
        const [co, ow] = coverAll(q, bb), sc = (hitL(q) ? 1e6 : 0) + co * 60 + ow * 6 + rk + tlen * 0.8 + cross * 8; if (sc < bs) { bs = sc; best = [q, px, py]; } }
      const [q, px, py] = best; labs.push(q); o.lab = { q, t, fs, tail: [px, py] }; }
    for (const o of order) { const { q, t, fs, tail } = o.lab; bubble(c, [q[0], q[1], q[2] - q[0], q[3] - q[1]], t, fs, o.hd, tail); }
    F.labels = order.map((o) => [o.L.id, o.lab.q.map(Math.round)]);
    // compass
    { const cx = W - 26 * D, cy = H - 26 * D, r = 13 * D; c.fillStyle = 'rgba(20,16,31,.85)'; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill(); c.strokeStyle = '#ff9ad0'; c.lineWidth = 1.5 * D; c.stroke();
      const [nx, ny] = P(0, -1), [zx, zy] = P(0, 0), d = Math.hypot(nx - zx, ny - zy) || 1, ux = (nx - zx) / d, uy = (ny - zy) / d;
      c.fillStyle = '#ff3d6e'; c.beginPath(); c.moveTo(cx + ux * r * 0.8, cy + uy * r * 0.8); c.lineTo(cx - uy * r * 0.35, cy + ux * r * 0.35); c.lineTo(cx + uy * r * 0.35, cy - ux * r * 0.35); c.closePath(); c.fill();
      c.font = `900 ${Math.round(8 * D)}px system-ui, sans-serif`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', cx - ux * r * 0.45, cy - uy * r * 0.45); }
  }
  function drawLive() {
    g.drawImage(bg, 0, 0);
    const [mx, my] = P(partner.pos.x, partner.pos.z); g.fillStyle = '#ff9ad0'; g.strokeStyle = '#000'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(mx, my, 5.5 * dpr, 0, TAU); g.fill(); g.stroke();
    g.font = `900 ${Math.round(9 * dpr)}px system-ui, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineWidth = 3 * dpr; g.strokeText('MAVIS', mx + 8 * dpr, my); g.fillText('MAVIS', mx + 8 * dpr, my);
    const [hx, hy] = P(hero.pos.x, hero.pos.z), [ax, ay] = P(hero.pos.x + Math.sin(hero.yaw), hero.pos.z + Math.cos(hero.yaw)), d = Math.hypot(ax - hx, ay - hy) || 1, ux = (ax - hx) / d, uy = (ay - hy) / d;
    const pul = 1 + 0.25 * Math.sin(F.t * 6), R = 13 * dpr * pul; g.strokeStyle = 'rgba(157,255,107,.6)'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(hx, hy, R, 0, TAU); g.stroke();
    const s = 11 * dpr; g.fillStyle = '#9dff6b'; g.strokeStyle = '#000'; g.lineWidth = 2.5 * dpr; g.beginPath();
    g.moveTo(hx + ux * s * 1.25, hy + uy * s * 1.25); g.lineTo(hx - ux * s * 0.7 - uy * s * 0.75, hy - uy * s * 0.7 + ux * s * 0.75); g.lineTo(hx - ux * s * 0.3, hy - uy * s * 0.3); g.lineTo(hx - ux * s * 0.7 + uy * s * 0.75, hy - uy * s * 0.7 - ux * s * 0.75); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = `900 ${Math.round(9 * dpr)}px system-ui, sans-serif`; g.textAlign = 'center'; g.lineWidth = 3 * dpr; g.strokeStyle = '#000'; g.strokeText('HAROLD', hx, hy - 20 * dpr); g.fillText('HAROLD', hx, hy - 20 * dpr);
  }
  function open(why) {
    if (window.__fort && __fort.on) return; // the Fort McHenry cannon view owns the screen
    if (F.open || (CINE.intro && !BOT) || DERBY.on || VIC.on || MODE.duel || RB.fightOn) return false; // no map during a boss mini-game (derby, Vic, duels, racer fights; boat rides still allow it)
    const t0 = performance.now(); F.open = true; F.opens++; F.why = why || ''; F.t = 0; ov.classList.add('on'); KEYS.clear(); PRESS.clear(); loadThumbs(); layout(); drawLive(); F.openMs = performance.now() - t0; return true;
  }
  function close(why) {
    if (!F.open) return false;
    F.open = false; F.closes++; F.why = why || ''; ov.classList.remove('on'); cv.width = cv.height = 0; bg = null; KEYS.clear(); PRESS.clear(); last = performance.now(); return true;
  }
  const toggle = (why) => (F.open ? close(why) : open(why));
  // called by frame() instead of the game step while open: animate the marker pulse, poll gamepad Back / B to close, keep game input drained
  let padPrev = false;
  function frame(rdt) {
    F.t += rdt; F.frames++; PRESS.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : []; let p = false; for (const gp of pads) if (gp && ((gp.buttons[8] && gp.buttons[8].pressed) || (gp.buttons[1] && gp.buttons[1].pressed))) p = true;
    if (p && !padPrev && F.t > 0.25) { padPrev = p; close('pad'); return; } padPrev = p;
    if (bg && (Math.round(card.clientWidth * dpr) !== W || Math.round(card.clientHeight * dpr) !== H)) layout(); // rotated / resized
    if (bg) drawLive();
  }
  // inputs
  const mm = $('mmap'); if (mm) { mm.title = 'open map (Tab)'; mm.addEventListener('pointerdown', (e) => { e.stopPropagation(); }); mm.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open('minimap'); }); }
  ov.querySelector('#fmapx').addEventListener('click', (e) => { e.stopPropagation(); close('x'); });
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) { e.preventDefault(); close('outside'); } }); // the dim backdrop around the card
  const ap = $('apanel'); if (ap) ap.addEventListener('pointerdown', (e) => { if (F.open) { e.preventDefault(); e.stopPropagation(); close('panel'); } }, { capture: true }); // the arcade panel is "outside" too
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'tab') { e.preventDefault(); if (!e.repeat) toggle('tab'); return; }
    if (F.open && k === 'escape') { close('esc'); return; }
  }, { capture: true });
  // the minimap gets a small MAP tab so it reads as tappable
  if (MAP) { const b = MAP.bg.getContext('2d'), w = MAP.bg.width, h = MAP.bg.height; b.fillStyle = 'rgba(20,16,31,.85)'; b.fillRect(w - 58, h - 24, 58, 24); b.font = '900 15px system-ui, -apple-system, sans-serif'; b.fillStyle = '#ffe08a'; b.textAlign = 'center'; b.textBaseline = 'middle'; b.fillText('MAP', w - 29, h - 11); CITY.mapT = 0; }
  const api = { F, TH, open, close, toggle, frame, get isOpen() { return F.open; }, ov };
  window.__fmap = api;
  return api;
})();
