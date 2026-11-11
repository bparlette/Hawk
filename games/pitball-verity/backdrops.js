/* PITBALL VERITY — backdrop painters.
 * drawBackdrop(ctx, scene, w, h, t) with scene in {'frost-cavern','foundry','spire'}.
 * Static-cheap by design: everything except the bits that read `t` is positionally
 * deterministic (seeded hash), so a caller can pre-render the scene at t=0 to an
 * offscreen canvas once per size and per frame only re-draw the animated layer —
 * or simply call it whole; it is a few hundred rects at most.
 */
'use strict';

function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function vgrad(ctx, w, h, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

/* ---------- FROST CAVERN: icicles, frozen pipes, glow below ---------- */
function drawFrostCavern(ctx, w, h, t) {
  vgrad(ctx, w, h, [[0, '#040818'], [0.55, '#081630'], [1, '#0a2440']]);
  // distant ice columns
  ctx.fillStyle = 'rgba(28,90,140,0.35)';
  for (let i = 0; i < 7; i++) {
    const cx = (hash(i * 3 + 1) * 0.9 + 0.05) * w, cwd = w * (0.05 + hash(i * 7) * 0.06);
    ctx.fillRect(cx, 0, cwd, h * (0.5 + hash(i * 11) * 0.5));
  }
  // frozen pipes across the wall (2 heights) with frost caps + valve wheels
  for (const [py, pr] of [[0.30, 10], [0.62, 14]]) {
    const y = h * py;
    ctx.fillStyle = '#2c4252'; ctx.fillRect(0, y - pr, w, pr * 2);
    ctx.fillStyle = '#5b7a8c'; ctx.fillRect(0, y - pr, w, 3);
    ctx.fillStyle = 'rgba(226,252,255,0.75)'; ctx.fillRect(0, y - pr - 3, w, 3);   // frost line
    ctx.fillStyle = '#54d5f2';
    for (let x = w * 0.12; x < w; x += w * 0.24) {                                // pipe joints
      ctx.fillRect(x, y - pr - 2, 4, pr * 2 + 4);
    }
    ctx.strokeStyle = '#9eeeff'; ctx.lineWidth = 3;                               // valve wheel
    const vx = w * (0.3 + py * 0.7);
    ctx.beginPath(); ctx.arc(vx, y - pr - 12, 9, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vx - 9, y - pr - 12); ctx.lineTo(vx + 9, y - pr - 12);
    ctx.moveTo(vx, y - pr - 21); ctx.lineTo(vx, y - pr - 3); ctx.stroke();
  }
  // icicles hanging from the top (varied, deterministic)
  for (let i = 0; i < 26; i++) {
    const x = (i + hash(i * 13) * 0.7) / 26 * w, len = h * (0.05 + hash(i * 29) * 0.20), wd = 5 + hash(i * 31) * 9;
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(158,238,255,0.85)'); g.addColorStop(1, 'rgba(158,238,255,0.10)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - wd / 2, 0); ctx.lineTo(x + wd / 2, 0); ctx.lineTo(x, len); ctx.closePath(); ctx.fill();
  }
  // floor ice band + shine
  ctx.fillStyle = '#0d3a5c'; ctx.fillRect(0, h * 0.94, w, h * 0.06);
  ctx.fillStyle = 'rgba(158,238,255,0.5)'; ctx.fillRect(0, h * 0.94, w, 2);
  // glow below (the pit breathes cold light up)
  const rg = ctx.createRadialGradient(w / 2, h * 1.05, 10, w / 2, h * 1.05, h * 0.75);
  rg.addColorStop(0, 'rgba(84,213,242,0.30)'); rg.addColorStop(1, 'rgba(84,213,242,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  // drifting frost sparkles (animated)
  ctx.fillStyle = 'rgba(226,252,255,0.7)';
  for (let i = 0; i < 22; i++) {
    const x = (hash(i * 41) * w + Math.sin(t * 0.3 + i) * 12 + w) % w;
    const y = (hash(i * 43) * h + t * (6 + hash(i * 47) * 10)) % h;
    ctx.fillRect(x, y, 2, 2);
  }
}

/* ---------- FOUNDRY: riveted steel, lava seams, chains, embers ---------- */
function drawFoundry(ctx, w, h, t) {
  vgrad(ctx, w, h, [[0, '#120806'], [0.6, '#1d0d07'], [1, '#2a1006']]);
  // steel plates: vertical seams + rivets
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(w * i / 5, 0); ctx.lineTo(w * i / 5, h); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(140,90,60,0.5)';
  for (let i = 0; i < 5; i++) for (let j = 0; j < 12; j++) {
    ctx.beginPath(); ctx.arc(w * i / 5 + 10, j * h / 12 + h / 24, 2.2, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(w * (i + 1) / 5 - 10, j * h / 12 + h / 24, 2.2, 0, 6.2832); ctx.fill();
  }
  // plate tint bands
  ctx.fillStyle = 'rgba(70,38,22,0.35)';
  for (let i = 0; i < 5; i += 2) ctx.fillRect(w * i / 5, 0, w / 5, h);
  // lava glow seams (cracks) — a few jagged polylines with glow
  for (let sIdx = 0; sIdx < 3; sIdx++) {
    let x = w * (0.15 + 0.3 * sIdx), y = h * (0.12 + 0.25 * sIdx);
    ctx.strokeStyle = 'rgba(255,106,31,0.25)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, y);
    const pts = [[x, y]];
    for (let k = 0; k < 5; k++) { x += (hash(sIdx * 51 + k) - 0.3) * w * 0.16; y += h * 0.09; pts.push([x, y]); ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts.slice(1)) ctx.lineTo(px, py);
    ctx.stroke();
  }
  // hanging chains from the top
  for (let i = 0; i < 4; i++) {
    const cx = w * (0.14 + 0.24 * i), len = h * (0.16 + hash(i * 61) * 0.2);
    ctx.strokeStyle = 'rgba(20,12,10,0.9)'; ctx.lineWidth = 4;
    ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, len); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#3a2418'; ctx.fillRect(cx - 7, len, 14, 10);   // hook block
  }
  // lava band at the bottom + glow
  const lg = ctx.createLinearGradient(0, h * 0.93, 0, h);
  lg.addColorStop(0, '#ff6a1f'); lg.addColorStop(1, '#c22e04');
  ctx.fillStyle = lg; ctx.fillRect(0, h * 0.95, w, h * 0.05);
  const rg = ctx.createRadialGradient(w / 2, h * 1.02, 10, w / 2, h * 1.02, h * 0.7);
  rg.addColorStop(0, 'rgba(255,122,26,0.32)'); rg.addColorStop(1, 'rgba(255,122,26,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  // rising embers (animated)
  ctx.fillStyle = 'rgba(255,170,60,0.85)';
  for (let i = 0; i < 20; i++) {
    const x = (hash(i * 71) * w + Math.sin(t * 0.8 + i * 2) * 8 + w) % w;
    const y = h - ((hash(i * 73) * h + t * (22 + hash(i * 79) * 30)) % h);
    ctx.fillRect(x, y, 2.4, 2.4);
  }
}

/* ---------- SPIRE: dark tech, flickering lightning arcs, rain ---------- */
function drawSpire(ctx, w, h, t) {
  vgrad(ctx, w, h, [[0, '#030410'], [0.55, '#070b24'], [1, '#0b1030']]);
  // tech panels + traces
  ctx.strokeStyle = 'rgba(70,90,180,0.28)'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.strokeRect(w * 0.06, h * (0.08 + i * 0.15), w * 0.30, h * 0.10);
    ctx.strokeRect(w * 0.64, h * (0.08 + i * 0.15), w * 0.30, h * 0.10);
  }
  ctx.fillStyle = 'rgba(84,213,242,0.5)';
  for (let i = 0; i < 14; i++) {   // distant window lights
    if (hash(i * 83) > 0.45) ctx.fillRect(w * (0.09 + hash(i * 89) * 0.8), h * (0.1 + hash(i * 97) * 0.75), 4, 3);
  }
  // central conduit
  ctx.fillStyle = 'rgba(20,28,70,0.8)'; ctx.fillRect(w * 0.47, 0, w * 0.06, h);
  ctx.fillStyle = 'rgba(120,90,255,0.35)'; ctx.fillRect(w * 0.492, 0, w * 0.016, h);
  // lightning arcs: 2 bolts, jagged, flicker by time-slice seed
  const slice = Math.floor(t * 9);
  for (let bIdx = 0; bIdx < 2; bIdx++) {
    const seed = slice * 7 + bIdx * 131;
    if (hash(seed) < 0.42) continue;                       // bolt off this slice
    let x = w * (0.3 + 0.4 * bIdx) + (hash(seed + 1) - 0.5) * w * 0.2, y = -4;
    ctx.strokeStyle = 'rgba(185,140,255,0.30)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x, y);
    const pts = [[x, y]];
    while (y < h * (0.45 + hash(seed + 2) * 0.3)) {
      x += (hash(seed + pts.length * 3) - 0.5) * w * 0.14; y += h * 0.07; pts.push([x, y]); ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#efe6ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts.slice(1)) ctx.lineTo(px, py);
    ctx.stroke();
  }
  // rain streaks (animated, diagonal)
  ctx.strokeStyle = 'rgba(150,190,255,0.35)'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 46; i++) {
    const x = (hash(i * 103) * (w + 80) + t * 130) % (w + 80) - 40;
    const y = (hash(i * 107) * h + t * (420 + hash(i * 109) * 240)) % (h + 30) - 15;
    ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 15);
  }
  ctx.stroke();
  // cold floor glow
  const rg = ctx.createRadialGradient(w / 2, h * 1.05, 10, w / 2, h * 1.05, h * 0.6);
  rg.addColorStop(0, 'rgba(110,80,255,0.22)'); rg.addColorStop(1, 'rgba(110,80,255,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
}

const PV_SCENES = { 'frost-cavern': drawFrostCavern, 'foundry': drawFoundry, 'spire': drawSpire };
function drawBackdrop(ctx, scene, w, h, t) { PV_SCENES[scene](ctx, w, h, t || 0); }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawBackdrop, drawFrostCavern, drawFoundry, drawSpire };
}
