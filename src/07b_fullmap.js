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
  const card = ov.querySelector('#fmapc'), cv = ov.querySelector('#fmapcv'), g = cv.getContext('2d');
  const F = { open: false, opens: 0, closes: 0, why: '', t: 0, rot: false, k: 1, frames: 0 };

  // landmark footprints [x0, z0, x1, z1] (world metres) + an icon kind; hd = drawn bigger
  const FOOT = {
    harborplace: { r: [[-58, -29, -46, -22], [-59, -18, -52, 2]], ic: 'pav', hd: 1 }, constellation: { r: [[-33.6, -27, -28.4, -9.5]], ic: 'ship', hd: 1 },
    wtc: { r: [[-20, -30, -4, -14]], ic: 'pent' }, aquarium: { r: [[6, -30, 32, -4]], ic: 'pyr', hd: 1 }, powerplant: { r: [[44, -30, 68, -4]], ic: 'stacks', hd: 1 },
    fourseasons: { r: [[70, -70, 94, -46]], ic: 'tower' }, pendry: { r: [[110, -30, 142, -18]], ic: 'clock' }, fells: { r: [[138, -70, 162, -46]], ic: 'hall' },
    monument: { r: [[-32, -104, -8, -80]], ic: 'col' }, orioles: { r: [[-136, -36, -76, 36]], ic: 'ball' }, ravens: { r: [[-136, 46, -76, 106]], ic: 'bowl' },
    science: { r: [[-66, 46, -42, 70]], ic: 'dome', hd: 1 }, fedhill: { r: [], ic: 'hill' }, domino: { r: [[70, 46, 94, 70]], ic: 'sugar', hd: 1 },
    underarmour: { r: [[104, 46, 128, 70]], ic: 'hall' }, fort: { r: [[138, 46, 213, 106]], ic: 'star' } };
  const NICE = { harborplace: 'Harborplace', constellation: 'USS Constellation', wtc: 'World Trade Ctr', aquarium: 'National Aquarium', powerplant: 'Power Plant',
    fourseasons: 'Four Seasons', pendry: 'Pendry', fells: 'Fells Point', monument: 'Washington Mon.', orioles: 'Oriole Park', ravens: 'M&T Bank Stadium',
    science: 'Science Center', fedhill: 'Federal Hill', domino: 'Domino Sugars', underarmour: 'Under Armour', fort: 'Fort McHenry' };
  const STREETS = [['PRATT ST', -112, -41, 0], ['KEY HWY', 40, 41, 0], ['LIGHT ST', -71, -90, 1], ['LOMBARD ST', 40, -75, 0]];
  const M = 6, X0 = WB.x0 - M, X1 = WB.x1 + M, Z0 = WB.z0 - M, Z1 = WB.z1 + M; // map extent (world)
  let W = 0, H = 0, dpr = 1, ox = 0, oy = 0, bg = null;
  // world -> canvas px. Landscape: north up. Portrait (taller than wide): turned 90 deg so the harbour's long east-west axis runs up the screen (east at the top).
  function P(x, z) { return F.rot ? [ox + (z - Z0) * F.k, oy + (X1 - x) * F.k] : [ox + (x - X0) * F.k, oy + (z - Z0) * F.k]; }
  function rect(c, x0, z0, x1, z1) { const a = P(x0, z0), b = P(x1, z1); c.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); }
  function rectS(c, x0, z0, x1, z1) { const a = P(x0, z0), b = P(x1, z1); c.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); }
  function layout() {
    const r = card.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    cv.width = W; cv.height = H; F.rot = H > W * 1.05;
    const top = 50 * dpr, bot = 24 * dpr, side = 8 * dpr, ww = X1 - X0, wh = Z1 - Z0, mw = F.rot ? wh : ww, mh = F.rot ? ww : wh;
    F.k = Math.min((W - side * 2) / mw, (H - top - bot) / mh); ox = (W - mw * F.k) / 2; oy = top + (H - top - bot - mh * F.k) / 2;
    bg = document.createElement('canvas'); bg.width = W; bg.height = H; drawStatic(bg.getContext('2d'));
    ov.querySelector('#fmaph').textContent = (TOUCH ? 'tap outside or ✕ to close' : 'Tab / Esc / click outside to close') + (F.rot ? '  ·  east ↑' : '');
  }
  function icon(c, L, f, s) { // a small drawn glyph at the landmark centre, s = size px
    const [x, y] = P(L.x, L.z); c.save(); c.translate(x, y); c.lineWidth = Math.max(1.5, s * 0.12); c.strokeStyle = '#000';
    c.fillStyle = f.hd ? '#ffd23c' : '#ffe08a'; c.beginPath(); c.arc(0, 0, s * 0.62, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#14101f'; c.strokeStyle = '#14101f';
    const q = s * 0.36, ic = f.ic; c.beginPath();
    if (ic === 'pyr') { c.moveTo(-q, q * 0.7); c.lineTo(0, -q); c.lineTo(q, q * 0.7); c.closePath(); c.fill(); }
    else if (ic === 'stacks') { for (let i = 0; i < 4; i++) c.fillRect(-q + i * q * 0.55, -q, q * 0.32, q * 1.8); }
    else if (ic === 'ship') { c.moveTo(-q, q * 0.2); c.lineTo(q, q * 0.2); c.lineTo(q * 0.6, q * 0.8); c.lineTo(-q * 0.6, q * 0.8); c.closePath(); c.fill(); c.fillRect(-q * 0.5, -q, q * 0.14, q * 1.2); c.fillRect(q * 0.1, -q * 0.9, q * 0.14, q * 1.1); }
    else if (ic === 'dome') { c.arc(0, q * 0.3, q * 0.85, Math.PI, 0); c.closePath(); c.fill(); }
    else if (ic === 'pav') { c.moveTo(-q, 0); c.lineTo(0, -q); c.lineTo(q, 0); c.closePath(); c.fill(); c.fillRect(-q * 0.75, 0, q * 1.5, q * 0.8); }
    else if (ic === 'sugar') { c.font = `900 ${Math.round(s * 0.62)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#c0182c'; c.fillText('D', 0, q * 0.1); }
    else if (ic === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? q * 0.45 : q; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); }
    else if (ic === 'pent') { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); c.fill(); }
    else if (ic === 'col') { c.fillRect(-q * 0.2, -q, q * 0.4, q * 2); }
    else if (ic === 'tower') { c.fillRect(-q * 0.4, -q, q * 0.8, q * 2); }
    else if (ic === 'clock') { c.arc(0, 0, q * 0.8, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -q * 0.6); c.moveTo(0, 0); c.lineTo(q * 0.45, 0); c.stroke(); }
    else if (ic === 'ball') { c.arc(0, 0, q * 0.8, 0, TAU); c.stroke(); }
    else if (ic === 'bowl') { c.ellipse(0, 0, q, q * 0.6, 0, 0, TAU); c.stroke(); }
    else if (ic === 'hill') { c.moveTo(-q, q * 0.6); c.quadraticCurveTo(0, -q * 1.4, q, q * 0.6); c.closePath(); c.fill(); }
    else { c.fillRect(-q * 0.8, -q * 0.5, q * 1.6, q); }
    c.restore();
  }
  function drawStatic(c) {
    c.fillStyle = '#1b1a22'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#4a4850'; rect(c, X0, Z0, X1, Z1);                                  // streets (all land is road until a block covers it)
    c.fillStyle = '#7d776c'; for (const p of PLOTS) rect(c, p.x0, p.z0, p.x1, p.z1);   // blocks
    c.fillStyle = '#a4664e'; rect(c, BASIN.x0 - PROM, BASIN.z0 - PROM, X1, BASIN.z1 + PROM); // brick promenade ring
    c.fillStyle = '#2f6f96'; rect(c, BASIN.x0, BASIN.z0, X1, BASIN.z1);                // the water, out the east edge
    c.strokeStyle = 'rgba(160,215,240,.35)'; c.lineWidth = 1 * dpr; for (let z = BASIN.z0 + 8; z < BASIN.z1; z += 10) { const a = P(BASIN.x0 + 4, z), b = P(X1, z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    c.fillStyle = '#b98a62'; for (const p of PIERS) rect(c, p.x0, p.z0, p.x1, p.z1);   // piers
    // Federal Hill mound
    { const [hx, hy] = P(HILL.x, HILL.z); c.fillStyle = '#5f9a4a'; c.beginPath(); c.ellipse(hx, hy, (F.rot ? HILL.rz : HILL.rx) * F.k, (F.rot ? HILL.rx : HILL.rz) * F.k, 0, 0, TAU); c.fill(); c.strokeStyle = '#2d4f22'; c.lineWidth = 1.5 * dpr; c.stroke(); }
    // street names
    c.font = `800 ${Math.round(8.5 * dpr)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(235,230,215,.75)';
    for (const [t, x, z, vert] of STREETS) { const [sx, sy] = P(x, z); c.save(); c.translate(sx, sy); if ((vert ? 1 : 0) ^ (F.rot ? 1 : 0)) c.rotate(-Math.PI / 2); c.fillText(t, 0, 0); c.restore(); }
    // landmark footprints
    for (const L of LANDMARKS) { const f = FOOT[L.id]; if (!f) continue;
      c.fillStyle = f.hd ? 'rgba(255,210,60,.55)' : 'rgba(255,224,138,.28)'; c.strokeStyle = f.hd ? '#ffd23c' : 'rgba(255,224,138,.7)'; c.lineWidth = (f.hd ? 2 : 1.2) * dpr;
      for (const r of f.r) { rect(c, r[0], r[1], r[2], r[3]); rectS(c, r[0], r[1], r[2], r[3]); } }
    // icons + labels (greedy placement: below, above, right, left of the icon; first spot that collides with nothing placed yet)
    const placed = [], order = LANDMARKS.slice().sort((a, b) => (FOOT[b.id] && FOOT[b.id].hd ? 1 : 0) - (FOOT[a.id] && FOOT[a.id].hd ? 1 : 0));
    const boxes = order.map((L) => { const f = FOOT[L.id] || { ic: '', r: [] }, s = (f.hd ? 21 : 15) * dpr, [x, y] = P(L.x, L.z); placed.push([x - s * 0.62, y - s * 0.62, x + s * 0.62, y + s * 0.62]); return { L, f, s, x, y }; });
    for (const o of boxes) icon(c, o.L, o.f, o.s);
    const hit = (b) => placed.some((p) => b[0] < p[2] && b[2] > p[0] && b[1] < p[3] && b[3] > p[1]);
    for (const { L, f, s, x, y } of boxes) {
      const fs = Math.round((f.hd ? 11.5 : 9.5) * dpr); c.font = `${f.hd ? 900 : 800} ${fs}px system-ui, -apple-system, sans-serif`;
      const t = (f.hd ? (NICE[L.id] || L.name).toUpperCase() : (NICE[L.id] || L.name)), tw = c.measureText(t).width + 8 * dpr, th = fs + 5 * dpr, gap = s * 0.62 + 2 * dpr;
      const cand = [[x - tw / 2, y + gap], [x - tw / 2, y - gap - th], [x + gap, y - th / 2], [x - gap - tw, y - th / 2], [x - tw / 2, y + gap + th], [x - tw / 2, y - gap - th * 2]];
      let b = null; for (const [bx, by] of cand) { const bb = [Math.max(2, Math.min(W - tw - 2, bx)), by, 0, 0]; bb[2] = bb[0] + tw; bb[3] = by + th; if (!hit(bb)) { b = bb; break; } }
      if (!b) { const bx = Math.max(2, Math.min(W - tw - 2, x - tw / 2)); b = [bx, y + gap, bx + tw, y + gap + th]; }
      placed.push(b);
      c.fillStyle = f.hd ? 'rgba(42,22,80,.92)' : 'rgba(20,16,31,.8)'; c.fillRect(b[0], b[1], tw, th); c.strokeStyle = f.hd ? '#ffd23c' : '#000'; c.lineWidth = (f.hd ? 1.5 : 1) * dpr; c.strokeRect(b[0], b[1], tw, th);
      c.fillStyle = f.hd ? '#ffe08a' : '#f2eee4'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, b[0] + tw / 2, b[1] + th / 2 + 0.5 * dpr);
    }
    // compass
    { const cx = W - 26 * dpr, cy = H - 26 * dpr, r = 13 * dpr; c.fillStyle = 'rgba(20,16,31,.85)'; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill(); c.strokeStyle = '#ff9ad0'; c.lineWidth = 1.5 * dpr; c.stroke();
      const [nx, ny] = P(0, -1), [zx, zy] = P(0, 0), d = Math.hypot(nx - zx, ny - zy) || 1, ux = (nx - zx) / d, uy = (ny - zy) / d;
      c.fillStyle = '#ff3d6e'; c.beginPath(); c.moveTo(cx + ux * r * 0.8, cy + uy * r * 0.8); c.lineTo(cx - uy * r * 0.35, cy + ux * r * 0.35); c.lineTo(cx + uy * r * 0.35, cy - ux * r * 0.35); c.closePath(); c.fill();
      c.font = `900 ${Math.round(8 * dpr)}px system-ui, sans-serif`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', cx - ux * r * 0.45, cy - uy * r * 0.45); }
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
    if (F.open || (CINE.intro && !BOT) || DERBY.on) return false; // no map during a boss mini-game
    F.open = true; F.opens++; F.why = why || ''; F.t = 0; ov.classList.add('on'); KEYS.clear(); PRESS.clear(); layout(); drawLive(); return true;
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
  const api = { F, open, close, toggle, frame, get isOpen() { return F.open; }, ov };
  window.__fmap = api;
  return api;
})();
