// rowkit_tiles.js — Task A: the ONE 1024² atlas for the Baltimore rowhouse kit (K.makeAtlas(KIT_TILES)).
// Everything is drawn on canvas at load: Formstone / permastone / brick / painted-brick facade tiles (tileable, drawn to be
// repeated in ~1.2 m cells), window sashes, panel doors, door numbers, painted window screens (original folk-art scenes),
// corner-bar and corner-shop signs, window product signs, awnings, glass block, roll-up shutter and a basement grille.
// Real Baltimore sign wording / styles (Natty Boh-style beer sign, Utz, Old Bay) are RE-DRAWN here from text and flat shapes;
// no logo file, photo or traced artwork is used or embedded. No imports; no Math.random (seeded LCG only).
export const META_ROWKIT_TILES = { id: 'rowkit_tiles', kind: 'kit', atlas: 1024, note: 'KIT_TILES for K.makeAtlas()' };

export const KIT_TILES = (() => { // all helpers live inside this closure, so concatenated modules cannot collide
// ---------- tiny local helpers (a module may not import: duplicated per file on purpose) ----------
const rnd = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; return () => (s = s * 16807 % 2147483647) / 2147483647; };
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (r, g, b, a = 1) => (a >= 1 ? `rgb(${cl(r)},${cl(g)},${cl(b)})` : `rgba(${cl(r)},${cl(g)},${cl(b)},${a})`);
const shade = (h, f, a = 1) => { const [r, g, b] = hexRgb(h); return rgb(r * f, g * f, b * f, a); };
const mixRgb = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; };
const wrap = (c, w, h, fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { c.save(); c.translate(dx, dy); fn(); c.restore(); } };
const INK = '#14101f', CREAM = '#c9b48a', MARBLE = '#eae6dc', GOLD = '#c8a040';
const SANS = 'Impact, "Arial Black", sans-serif', SERIF = 'Georgia, serif';
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const fitText = (c, txt, x, y, maxW, px, font = SANS, weight = '') => { let s = px; c.font = `${weight} ${s}px ${font}`; while (c.measureText(txt).width > maxW && s > 6) { s -= 1; c.font = `${weight} ${s}px ${font}`; } c.fillText(txt, x, y); return s; };

// ---------- facade tiles (128×128, drawn so they wrap: random mirroring per 1.2 m cell never shows a seam) ----------
function normalised(R, n, total, lo = 0.65, hi = 1.35) { const a = []; let s = 0; for (let i = 0; i < n; i++) { const v = lo + R() * (hi - lo); a.push(v); s += v; } return a.map((v) => (v / s) * total); }
function drawFormstone(base, seed, pinkish = 0) {
  // Formstone (fix m11): irregular faux stone, not coursed blocks. Rows of uneven height that wander, stones of very different widths,
  // some spanning two rows, 6-8 sided outlines with rounded, lumpy edges, deep tooled mortar and a sparkly aggregate speckle.
  return (c, w, h) => {
    const R = rnd(seed); c.fillStyle = shade(base, 0.5); c.fillRect(0, 0, w, h);
    const stones = [];
    const rows = normalised(R, 4 + (R() < 0.5 ? 1 : 0), h, 0.55, 1.5); let y = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      const rh = rows[ri], ws = normalised(R, 3 + Math.floor(R() * 3), w, 0.35, 1.9); let x = R() * w;
      for (const bw of ws) {
        const tall = ri < rows.length - 1 && R() < 0.18; // now and then a big stone that runs through two rows
        const sh = tall ? rh + rows[ri + 1] : rh, dy = (R() - 0.5) * rh * 0.25;
        stones.push({ x, y: y + dy, w: bw, h: sh, tall }); x += bw;
      }
      y += rh;
    }
    for (const st of stones) {
      const n = 6 + Math.floor(R() * 3), cx = st.x + st.w / 2, cy = st.y + st.h / 2, poly = [];
      for (let k = 0; k < n; k++) { // a lumpy rounded-rectangle outline
        const a = (k / n) * Math.PI * 2 + R() * 0.4, ex = Math.cos(a), ey = Math.sin(a), sq = Math.pow(Math.abs(ex) ** 3 + Math.abs(ey) ** 3, -1 / 3);
        const jr = 0.82 + R() * 0.2; poly.push([cx + ex * sq * (st.w / 2 - 2.6) * jr, cy + ey * sq * (st.h / 2 - 2.6) * jr]);
      }
      const f = 0.84 + R() * 0.3, tint = mixRgb(base, pinkish ? '#b8a09c' : '#b4ac98', R() * 0.6);
      wrap(c, w, h, () => {
        c.beginPath(); poly.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath();
        c.fillStyle = rgb(tint[0] * f, tint[1] * f, tint[2] * f); c.fill();
        c.strokeStyle = shade(base, 0.4); c.lineWidth = 3.2; c.lineJoin = 'round'; c.stroke();
        // lit top-left lip and a shadowed lower-right lip: the stone face stands proud of the mortar
        c.strokeStyle = shade(base, 1.3, 0.65); c.lineWidth = 1.6; c.beginPath(); const q = Math.floor(n * 0.5);
        for (let k = q; k <= n; k++) { const [px, py] = poly[k % n]; k === q ? c.moveTo(px + 1.2, py + 1.2) : c.lineTo(px + 1.2, py + 1.2); } c.stroke();
        c.strokeStyle = shade(base, 0.62, 0.55); c.beginPath(); for (let k = 0; k <= q; k++) { const [px, py] = poly[k]; k ? c.lineTo(px - 1.2, py - 1.2) : c.moveTo(px - 1.2, py - 1.2); } c.stroke();
      });
    }
    for (let i = 0; i < 120; i++) { const px = R() * w, py = R() * h, lt = R() < 0.5; wrap(c, w, h, () => { c.fillStyle = lt ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)'; c.fillRect(px, py, 1.6, 1.6); }); }
  };
}
function drawPermastone(base, seed) {
  return (c, w, h) => {
    const R = rnd(seed); c.fillStyle = shade(base, 0.8); c.fillRect(0, 0, w, h);
    const nr = 6, rh = h / nr;
    for (let r = 0; r < nr; r++) {
      const ws = normalised(R, 3, w, 0.7, 1.3); let x = R() * w;
      for (const bw of ws) { wrap(c, w, h, () => { c.fillStyle = shade(base, 0.96 + R() * 0.08); c.fillRect(x + 1.2, r * rh + 1.2, bw - 2.4, rh - 2.4); c.fillStyle = shade(base, 1.14, 0.55); c.fillRect(x + 1.2, r * rh + 1.2, bw - 2.4, 2); c.fillStyle = shade(base, 0.7, 0.4); c.fillRect(x + 1.2, r * rh + rh - 3.4, bw - 2.4, 2); }); x += bw; }
    }
  };
}
function drawBrick(base, seed, painted = false) {
  return (c, w, h) => {
    const R = rnd(seed), rows = 16, bh = h / rows, per = 6, bw = w / per;
    c.fillStyle = painted ? shade(base, 0.8) : '#a89c8e'; c.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) for (let i = -1; i < per; i++) {
      const x = i * bw + (r % 2 ? bw / 2 : 0), y = r * bh, f = painted ? 0.97 + R() * 0.06 : 0.84 + R() * 0.3;
      wrap(c, w, h, () => {
        c.fillStyle = shade(base, f); const dx = painted ? 0.7 : 1; c.fillRect(x + dx, y + 1, bw - dx * 2, bh - 1.6);
        c.fillStyle = shade(base, painted ? 1.08 : 1.22, 0.5); c.fillRect(x + dx, y + 1, bw - dx * 2, 1.1);
        if (!painted && R() < 0.12) { c.fillStyle = 'rgba(20,16,31,0.18)'; c.fillRect(x + dx, y + 1, bw * 0.4, bh - 1.6); }
      });
    }
  };
}

// ---------- windows 80×144: cream frame, 1/1 sash with a meeting rail; glass is dark blue-grey by day ----------
// (pixel layout is shared with rowkit_rowhouse.js: frame 8px, upper glass y 8..68, rail 68..76, lower glass y 76..136)
function drawWindow(style) {
  return (c, w, h) => {
    c.fillStyle = CREAM; c.fillRect(0, 0, w, h);
    c.fillStyle = shade(CREAM, 0.72); c.fillRect(0, 0, w, 2); c.fillRect(0, 0, 2, h); c.fillRect(w - 2, 0, 2, h); c.fillRect(0, h - 2, w, 2);
    const glass = (x, y, gw, gh, up) => {
      const g = c.createLinearGradient(x, y, x + gw, y + gh); g.addColorStop(0, '#6a8a9a'); g.addColorStop(1, '#4f6676'); c.fillStyle = g; c.fillRect(x, y, gw, gh);
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.moveTo(x + gw * 0.15, y + gh); c.lineTo(x + gw * 0.5, y + gh); c.lineTo(x + gw * 0.85, y); c.lineTo(x + gw * 0.5, y); c.closePath(); c.fill();
      if (style === 0) { c.fillStyle = 'rgba(234,230,220,0.85)'; if (up) { c.fillRect(x, y, gw, 7); for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(x + 5 + i * 10.4, y + 7, 5.2, 0, Math.PI); c.fill(); } } }
      if (style === 1) { c.fillStyle = 'rgba(201,180,138,0.9)'; const n = up ? 10 : 3; for (let i = 0; i < n; i++) c.fillRect(x, y + i * 5.8, gw, 3.6); }
      if (style === 2 && !up) { c.fillStyle = '#3a5a3a'; c.beginPath(); c.ellipse(x + 14, y + gh - 8, 11, 8, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#8a4a3a'; c.fillRect(x + 8, y + gh - 6, 12, 6); }
    };
    glass(8, 8, w - 16, 60, true); glass(8, 76, w - 16, 60, false);
    c.fillStyle = shade(CREAM, 0.88); c.fillRect(8, 68, w - 16, 8); c.fillStyle = shade(CREAM, 0.6); c.fillRect(8, 74, w - 16, 2);
    c.strokeStyle = shade(CREAM, 0.6); c.lineWidth = 1.5; c.strokeRect(8, 8, w - 16, 60); c.strokeRect(8, 76, w - 16, 60);
  };
}

// ---------- panelled doors 96×192 ----------
function drawDoor(col, seed) {
  return (c, w, h) => {
    c.fillStyle = shade(col, 0.7); c.fillRect(0, 0, w, h); c.fillStyle = col; c.fillRect(5, 4, w - 10, h - 4);
    const panel = (x, y, pw, ph) => { c.fillStyle = shade(col, 0.82); c.fillRect(x, y, pw, ph); c.fillStyle = shade(col, 1.25, 0.8); c.fillRect(x, y, pw, 2.5); c.fillRect(x, y, 2.5, ph); c.fillStyle = shade(col, 0.55, 0.9); c.fillRect(x, y + ph - 2.5, pw, 2.5); c.fillRect(x + pw - 2.5, y, 2.5, ph); c.fillStyle = shade(col, 1.05); c.fillRect(x + 4, y + 4, pw - 8, ph - 8); };
    panel(12, 10, 32, 60); panel(52, 10, 32, 60); panel(12, 80, 32, 58); panel(52, 80, 32, 58); panel(12, 146, 72, 28);
    c.fillStyle = GOLD; c.beginPath(); c.arc(w - 14, 106, 4.4, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e8d888'; c.beginPath(); c.arc(w - 15, 105, 1.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = GOLD; c.fillRect(w / 2 - 12, 76, 24, 3);
    c.fillStyle = shade(GOLD, 0.8); c.fillRect(8, h - 14, w - 16, 8);
  };
}
function drawDigit(d) { return (c, w, h) => { c.clearRect(0, 0, w, h); c.font = `bold 42px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.strokeStyle = INK; c.lineJoin = 'round'; c.strokeText(String(d), w / 2, h / 2 + 2); c.fillStyle = '#e8c860'; c.fillText(String(d), w / 2, h / 2 + 2); }; }

// ---------- painted window screens 112×128: original folk-art scenes (no copies of real artworks) ----------
function screenFrame(c, w, h, paint) {
  c.fillStyle = INK; rr(c, 0, 0, w, h, 14); c.fill();
  c.save(); rr(c, 5, 5, w - 10, h - 10, 11); c.clip(); paint(c, 5, 5, w - 10, h - 10); c.restore();
  c.strokeStyle = '#ffa050'; c.lineWidth = 2; rr(c, 7.5, 7.5, w - 15, h - 15, 10); c.stroke();
  c.strokeStyle = '#eae6dc'; c.lineWidth = 3.4; rr(c, 4, 4, w - 8, h - 8, 12); c.stroke();
  c.fillStyle = 'rgba(20,16,31,0.17)'; for (let y = 8; y < h - 8; y += 3) c.fillRect(6, y, w - 12, 1); // wire-mesh feel
}
const tri = (c, a, b, d, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fill(); };
const SCREENS = {
  scr_cottage: (c, x, y, w, h) => { // red-roof cottage by a lake
    const g = c.createLinearGradient(0, y, 0, y + h * 0.6); g.addColorStop(0, '#6aa8dc'); g.addColorStop(1, '#d8ecf0'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(x + w * 0.8, y + 18, 9, 0, 7); c.fill();
    c.fillStyle = '#4f7a3a'; c.beginPath(); c.moveTo(x, y + h * 0.58); c.quadraticCurveTo(x + w * 0.4, y + h * 0.36, x + w, y + h * 0.56); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.fill();
    c.fillStyle = '#3a8ab8'; c.beginPath(); c.ellipse(x + w * 0.45, y + h * 0.82, w * 0.55, h * 0.13, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + w * 0.25, y + h * 0.8, 22, 2); c.fillRect(x + w * 0.5, y + h * 0.86, 18, 2);
    c.fillStyle = '#eae6dc'; c.fillRect(x + w * 0.3, y + h * 0.5, 38, 26); tri(c, [x + w * 0.3 - 5, y + h * 0.5], [x + w * 0.3 + 43, y + h * 0.5], [x + w * 0.3 + 19, y + h * 0.5 - 20], '#b8302a');
    c.fillStyle = '#8a4a3a'; c.fillRect(x + w * 0.3 + 28, y + h * 0.5 - 18, 6, 12); c.fillStyle = '#5a3a2a'; c.fillRect(x + w * 0.3 + 15, y + h * 0.5 + 8, 8, 18); c.fillStyle = '#ffe08a'; c.fillRect(x + w * 0.3 + 4, y + h * 0.5 + 6, 7, 7); c.fillRect(x + w * 0.3 + 27, y + h * 0.5 + 6, 7, 7);
    for (const tx of [x + 10, x + 22]) { tri(c, [tx - 7, y + h * 0.6], [tx + 7, y + h * 0.6], [tx, y + h * 0.4], '#2a5a32'); }
  },
  scr_swan: (c, x, y, w, h) => { // a swan on an evening pond
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#f08a50'); g.addColorStop(0.5, '#f0c070'); g.addColorStop(0.55, '#2f5a8a'); g.addColorStop(1, '#1f3a5a'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(x + w * 0.25, y + h * 0.5, 11, Math.PI, 0); c.fill();
    c.fillStyle = '#eae6dc'; c.beginPath(); c.ellipse(x + w * 0.5, y + h * 0.72, 30, 14, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(x + w * 0.72, y + h * 0.7); c.quadraticCurveTo(x + w * 0.78, y + h * 0.4, x + w * 0.66, y + h * 0.38); c.quadraticCurveTo(x + w * 0.58, y + h * 0.4, x + w * 0.6, y + h * 0.5); c.lineWidth = 7; c.strokeStyle = '#eae6dc'; c.stroke();
    c.fillStyle = '#ffa050'; tri(c, [x + w * 0.62, y + h * 0.375], [x + w * 0.56, y + h * 0.4], [x + w * 0.62, y + h * 0.415], '#ffa050'); c.fillStyle = INK; c.fillRect(x + w * 0.635, y + h * 0.375, 2, 2);
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(x + w * 0.2, y + h * 0.85, 40, 2); c.fillStyle = '#2a5a32'; for (const rx of [x + 6, x + 12, x + w - 12]) c.fillRect(rx, y + h * 0.6, 2.4, h * 0.3);
  },
  scr_lighthouse: (c, x, y, w, h) => { // red-banded lighthouse at dusk
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#3a3a7a'); g.addColorStop(0.55, '#e08a6a'); g.addColorStop(0.62, '#2a6a9a'); g.addColorStop(1, '#1f4a6a'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#6f6a62'; c.beginPath(); c.moveTo(x + 8, y + h * 0.66); c.lineTo(x + w * 0.4, y + h * 0.56); c.lineTo(x + w * 0.76, y + h * 0.56); c.lineTo(x + w - 6, y + h * 0.7); c.lineTo(x + w - 6, y + h); c.lineTo(x + 8, y + h); c.fill();
    const lx = x + w * 0.5; for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#eae6dc' : '#b8302a'; const t = y + h * 0.2 + i * 17, hw0 = 9 + i * 1.4, hw1 = 9 + (i + 1) * 1.4; c.beginPath(); c.moveTo(lx - hw0, t); c.lineTo(lx + hw0, t); c.lineTo(lx + hw1, t + 17); c.lineTo(lx - hw1, t + 17); c.fill(); }
    c.fillStyle = INK; c.fillRect(lx - 11, y + h * 0.2 - 8, 22, 8); c.fillStyle = '#ffe08a'; c.fillRect(lx - 7, y + h * 0.2 - 16, 14, 9); tri(c, [lx - 11, y + h * 0.2 - 16], [lx + 11, y + h * 0.2 - 16], [lx, y + h * 0.2 - 26], '#b8302a');
    c.fillStyle = 'rgba(255,224,138,0.35)'; tri(c, [lx + 7, y + h * 0.2 - 12], [x + w, y + h * 0.1], [x + w, y + h * 0.3], 'rgba(255,224,138,0.35)'); c.strokeStyle = '#eae6dc'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 14, y + 26); c.lineTo(x + 20, y + 22); c.lineTo(x + 26, y + 26); c.stroke();
  },
  scr_sail: (c, x, y, w, h) => { // sailboat under a high sun
    const g = c.createLinearGradient(0, y, 0, y + h * 0.6); g.addColorStop(0, '#4a98d8'); g.addColorStop(1, '#bfe2f0'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(x + 18, y + 20, 10, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.ellipse(x + w * 0.7, y + 22, 18, 7, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(x + w * 0.62, y + 26, 12, 6, 0, 0, 7); c.fill();
    c.fillStyle = '#2f6aa8'; c.fillRect(x, y + h * 0.6, w, h * 0.4); c.fillStyle = '#4a8ac8'; for (let i = 0; i < 5; i++) c.fillRect(x + 6 + i * 20, y + h * 0.7 + (i % 2) * 8, 14, 2);
    tri(c, [x + w * 0.5, y + h * 0.16], [x + w * 0.5, y + h * 0.54], [x + w * 0.2, y + h * 0.54], '#eae6dc'); tri(c, [x + w * 0.54, y + h * 0.24], [x + w * 0.54, y + h * 0.54], [x + w * 0.8, y + h * 0.54], '#f08a50'); c.fillStyle = '#5a3a2a'; c.fillRect(x + w * 0.5 - 1.5, y + h * 0.14, 3, h * 0.42);
    c.fillStyle = '#8a4a3a'; c.beginPath(); c.moveTo(x + w * 0.16, y + h * 0.56); c.lineTo(x + w * 0.84, y + h * 0.56); c.lineTo(x + w * 0.72, y + h * 0.66); c.lineTo(x + w * 0.28, y + h * 0.66); c.fill();
  },
  scr_crab: (c, x, y, w, h) => { // a blue crab on the marsh
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#f0d890'); g.addColorStop(0.45, '#9ac8a0'); g.addColorStop(1, '#5a8a4a'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#3a8ab8'; c.fillRect(x, y + h * 0.62, w, h * 0.38); c.fillStyle = '#2f6a98'; for (let i = 0; i < 4; i++) c.fillRect(x + 6 + i * 26, y + h * 0.7 + (i % 2) * 7, 18, 2);
    c.fillStyle = '#2a5a32'; for (const rx of [x + 8, x + 16, x + 24, x + w - 10, x + w - 18]) c.fillRect(rx, y + h * 0.3, 2.4, h * 0.34);
    const cx = x + w / 2, cy = y + h * 0.58; c.fillStyle = '#2f6aa8'; c.beginPath(); c.ellipse(cx, cy, 24, 14, 0, 0, 7); c.fill(); c.strokeStyle = '#2f6aa8'; c.lineWidth = 3.4;
    for (const s of [-1, 1]) { for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(cx + s * 16, cy + 2 + i * 3); c.lineTo(cx + s * 34, cy + 6 + i * 6); c.stroke(); } c.beginPath(); c.moveTo(cx + s * 20, cy - 8); c.lineTo(cx + s * 32, cy - 22); c.stroke(); c.fillStyle = '#b8302a'; c.beginPath(); c.arc(cx + s * 33, cy - 24, 6, 0, 7); c.fill(); }
    c.fillStyle = '#eae6dc'; c.fillRect(cx - 9, cy - 20, 4, 8); c.fillRect(cx + 5, cy - 20, 4, 8);
  },
  scr_heron: (c, x, y, w, h) => { // a heron in the reeds
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#c8a0d0'); g.addColorStop(0.5, '#f0c0a0'); g.addColorStop(0.58, '#4a7a9a'); g.addColorStop(1, '#2a5a6a'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.strokeStyle = '#6f6a62'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x + w * 0.52, y + h * 0.5); c.lineTo(x + w * 0.5, y + h * 0.82); c.moveTo(x + w * 0.56, y + h * 0.5); c.lineTo(x + w * 0.58, y + h * 0.82); c.stroke();
    c.fillStyle = '#9aa8b8'; c.beginPath(); c.ellipse(x + w * 0.55, y + h * 0.46, 15, 9, -0.5, 0, 7); c.fill(); c.strokeStyle = '#9aa8b8'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(x + w * 0.46, y + h * 0.4); c.quadraticCurveTo(x + w * 0.3, y + h * 0.36, x + w * 0.36, y + h * 0.24); c.stroke();
    c.fillStyle = '#ffd23c'; tri(c, [x + w * 0.35, y + h * 0.22], [x + w * 0.22, y + h * 0.25], [x + w * 0.35, y + h * 0.27], '#ffd23c'); c.fillStyle = '#2a5a32'; for (const rx of [x + 8, x + 14, x + 20, x + w - 12, x + w - 20]) c.fillRect(rx, y + h * 0.5, 2.4, h * 0.45);
  },
};

// ---------- signs ----------
const board = (fill, edge, text, tc, px, font = SANS, extra) => (c, w, h) => {
  c.fillStyle = fill; c.fillRect(0, 0, w, h); c.strokeStyle = edge; c.lineWidth = 4; c.strokeRect(3, 3, w - 6, h - 6); c.fillStyle = tc; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (extra) extra(c, w, h); fitText(c, text, w / 2 + (extra && extra.dx || 0), h / 2 + 2, w - 28 - (extra && extra.pad || 0), px, font);
};
function drawNatty(c, w, h) { // a Natty Boh-style beer sign: bold wordmark on red / cream / blue, drawn from text + flat shapes only
  c.fillStyle = '#c8302a'; rr(c, 0, 0, w, h, 14); c.fill(); c.strokeStyle = '#eae6dc'; c.lineWidth = 5; rr(c, 6, 6, w - 12, h - 12, 10); c.stroke();
  c.fillStyle = '#2f5bd3'; c.fillRect(14, h * 0.62, w - 28, h * 0.2); c.fillStyle = '#eae6dc'; c.textAlign = 'center'; c.textBaseline = 'middle';
  fitText(c, 'NATTY', w / 2, h * 0.23, w - 40, 30, SANS); fitText(c, 'BOH', w / 2, h * 0.43, w - 90, 30, SANS);
  c.fillStyle = '#eae6dc'; fitText(c, 'ICE COLD · BALTIMORE', w / 2, h * 0.72, w - 36, 14, SERIF, 'bold');
  c.strokeStyle = '#ffd23c'; c.lineWidth = 2; c.beginPath(); c.moveTo(24, h * 0.9); c.lineTo(w - 24, h * 0.9); c.stroke();
}
function drawUtz(c, w, h) { // Utz-style: red script on gold, drawn from text
  c.fillStyle = '#d8a828'; rr(c, 0, 0, w, h, 10); c.fill(); c.strokeStyle = '#2f5bd3'; c.lineWidth = 5; rr(c, 4, 4, w - 8, h - 8, 8); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.strokeStyle = '#eae6dc'; c.lineJoin = 'round'; c.font = `italic bold 58px ${SERIF}`; c.strokeText('Utz', w / 2, h * 0.4); c.fillStyle = '#c8302a'; c.fillText('Utz', w / 2, h * 0.4);
  c.fillStyle = '#2f5bd3'; fitText(c, 'POTATO CHIPS', w / 2, h * 0.7, w - 22, 13, SANS); c.fillStyle = INK; fitText(c, 'HANOVER, PA', w / 2, h * 0.86, w - 30, 10, SERIF, 'bold');
}
function drawOldBay(c, w, h) { // Old Bay-style seasoning tin: yellow tin, blue band, red lettering
  c.fillStyle = '#e8b830'; rr(c, 6, 4, w - 12, h - 8, 6); c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#2f5bd3'; c.fillRect(6, h * 0.12, w - 12, h * 0.2); c.fillStyle = '#eae6dc'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'OLD BAY', w / 2, h * 0.22, w - 24, 20, SANS);
  c.fillStyle = '#c8302a'; fitText(c, 'SEASONING', w / 2, h * 0.5, w - 20, 15, SANS); c.fillStyle = INK; fitText(c, 'FOR SEAFOOD', w / 2, h * 0.64, w - 26, 10, SERIF, 'bold'); c.fillStyle = '#c8302a'; c.beginPath(); c.arc(w / 2, h * 0.82, 9, 0, 7); c.fill(); c.fillStyle = '#eae6dc'; c.fillRect(w / 2 - 6, h * 0.82 - 1.5, 12, 3);
}
function crabSign(text, sub) { return (c, w, h) => { c.fillStyle = '#2f5a3a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#eae6dc'; c.lineWidth = 3; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = '#f08a50'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, text, w / 2, h * 0.42, w - 40, 36, SANS); c.fillStyle = '#eae6dc'; fitText(c, sub, w / 2, h * 0.8, w - 60, 12, SERIF, 'bold'); c.fillStyle = '#c8302a'; for (const sx of [18, w - 18]) { c.beginPath(); c.ellipse(sx, h / 2, 9, 6, 0, 0, 7); c.fill(); } }; }
function barberSign(c, w, h) { c.fillStyle = '#eae6dc'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2f5bd3'; c.lineWidth = 4; c.strokeRect(3, 3, w - 6, h - 6); for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#c8302a' : '#2f5bd3'; c.save(); c.beginPath(); c.rect(10, 8, 26, h - 16); c.clip(); c.fillRect(0, 8 + i * 12 - 10, 60, 6); c.restore(); } c.fillStyle = '#c8302a'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'BARBER', w / 2 + 14, h / 2 + 2, w - 90, 36, SANS); }

// ---------- awning / glass block / shutter / grille ----------
const awning = (a, b) => (c, w, h) => { for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? b : a; c.fillRect(i * (w / 4), 0, w / 4, h); } c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, h - 6, w, 6); };
function drawGlassBlock(c, w, h) { c.fillStyle = '#5f7a82'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const g = c.createLinearGradient(i * 16, j * 16, i * 16 + 16, j * 16 + 16); g.addColorStop(0, '#b8d4d8'); g.addColorStop(1, '#7a9aa2'); c.fillStyle = g; c.fillRect(i * 16 + 1.5, j * 16 + 1.5, 13, 13); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(i * 16 + 3, j * 16 + 3, 4, 2); } }
function drawShutter(c, w, h) { for (let y = 0; y < h; y += 8) { c.fillStyle = '#6f6a62'; c.fillRect(0, y, w, 8); c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(0, y, w, 2); c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(0, y + 6, w, 2); } c.fillStyle = 'rgba(20,16,31,0.25)'; for (let x = 18; x < w; x += 46) c.fillRect(x, 0, 2, h); }
function drawGrille(c, w, h) { c.clearRect(0, 0, w, h); c.fillStyle = INK; c.fillRect(0, 0, w, 6); c.fillRect(0, h - 6, w, 6); for (let x = 8; x < w; x += 12) c.fillRect(x, 0, 4, h); c.fillRect(0, h / 2 - 2, w, 4); }
function drawOpenSign(c, w, h) { c.fillStyle = INK; c.fillRect(0, 0, w, h); c.strokeStyle = '#ff3a1c'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = '#ff3a1c'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'OPEN', w / 2, h / 2 + 2, w - 24, 30, SANS); }

const T = (w, h, draw) => ({ w, h, draw });
const KIT = {};
const add = (o) => Object.assign(KIT, o);
// order matters for shelf packing: tall tiles first
add({ door_0: T(96, 192, drawDoor('#2f5a3a', 1)), door_1: T(96, 192, drawDoor('#6a1f3a', 2)), door_2: T(96, 192, drawDoor('#2c322e', 3)), door_3: T(96, 192, drawDoor('#3a5a8a', 4)) });
add({ win_0: T(80, 144, drawWindow(0)), win_1: T(80, 144, drawWindow(1)), win_2: T(80, 144, drawWindow(2)) });
for (let i = 0; i < 3; i++) KIT['fs_' + i] = T(128, 128, drawFormstone(['#a39a8a', '#a8978f', '#9a9a94'][i], 11 + i * 7, i === 1 ? 1 : 0));
KIT.fs_3 = T(128, 128, drawFormstone('#b0a48c', 40, 0));
for (let i = 0; i < 3; i++) KIT['ps_' + i] = T(128, 128, drawPermastone(['#b9b0a0', '#a8a49a', '#b4a69c'][i], 21 + i * 5));
for (const [n, col] of [['br_red', '#8a4a3a'], ['br_tan', '#9a6a44'], ['br_plum', '#5a4f5c'], ['br_grey', '#6f6a62'], ['br_green', '#4f5a52'], ['br_sand', '#a4907a']]) KIT[n] = T(128, 128, drawBrick(col, n.length * 31 + col.charCodeAt(2)));
['#c9b48a', '#b8a27a', '#9ab0b8', '#c49a9a'].forEach((col, i) => (KIT['pt_' + i] = T(128, 128, drawBrick(col, 70 + i, true))));
for (const [n, f] of Object.entries(SCREENS)) KIT[n] = T(112, 128, (c, w, h) => screenFrame(c, w, h, f));
add({
  sign_natty: T(192, 128, drawNatty), sign_tavern: T(256, 64, board('#2c322e', '#ffa050', 'TAVERN', '#ffa050', 44)), sign_crab: T(256, 64, crabSign('CRAB HOUSE', 'STEAMED · BY THE DOZEN')),
  sign_bar_grill: T(256, 64, board('#5a2438', '#eae6dc', 'BAR & GRILL', '#eae6dc', 40)),
  shop_market: T(256, 64, board('#2f5a3a', '#eae6dc', 'CORNER MARKET', '#ffe08a', 38)), shop_carryout: T(256, 64, board('#b8302a', '#ffe08a', 'CARRYOUT', '#ffe08a', 44)),
  shop_barber: T(256, 64, barberSign), shop_hardware: T(256, 64, board('#3a5a8a', '#eae6dc', 'HARDWARE', '#eae6dc', 42)), shop_laundromat: T(256, 64, board('#4a8a9a', '#eae6dc', 'LAUNDROMAT', '#eae6dc', 38)),
  shop_deli: T(256, 64, board('#8a4a3a', '#ffe08a', 'DELI', '#ffe08a', 46)),
  prod_utz: T(96, 128, drawUtz), prod_oldbay: T(96, 128, drawOldBay), prod_open: T(96, 48, drawOpenSign),
});
KIT.prod_natty = T(96, 96, (c, w, h) => { c.save(); c.scale(w / 192, h / 128); drawNatty(c, 192, 128); c.restore(); });
add({ awn_red: T(64, 64, awning('#b8302a', '#eae6dc')), awn_green: T(64, 64, awning('#2f5a3a', '#eae6dc')), awn_blue: T(64, 64, awning('#2f5bd3', '#eae6dc')), glassblock: T(64, 64, drawGlassBlock), shutter: T(128, 128, drawShutter), grille: T(64, 48, drawGrille) });
for (let d = 0; d < 10; d++) KIT['d' + d] = T(32, 48, drawDigit(d));
return KIT;
})();
