// ---------------- GENERATED from vendor/taskAB/*.js by vendor/taskAB/gen.sh: do not edit here ----------------
// ---- vendor/taskAB/rowkit_tiles.js ----
// rowkit_tiles.js — Task A: the ONE 1024² atlas for the Baltimore rowhouse kit (K.makeAtlas(KIT_TILES)).
// Everything is drawn on canvas at load: Formstone / permastone / brick / painted-brick facade tiles (tileable, drawn to be
// repeated in ~1.2 m cells), window sashes, panel doors, door numbers, painted window screens (original folk-art scenes),
// corner-bar and corner-shop signs, window product signs, awnings, glass block, roll-up shutter and a basement grille.
// Real Baltimore sign wording / styles (Natty Boh-style beer sign, Utz, Old Bay) are RE-DRAWN here from text and flat shapes;
// no logo file, photo or traced artwork is used or embedded. No imports; no Math.random (seeded LCG only).
const META_ROWKIT_TILES = { id: 'rowkit_tiles', kind: 'kit', atlas: 1024, note: 'KIT_TILES for K.makeAtlas()' };

const KIT_TILES = (() => { // all helpers live inside this closure, so concatenated modules cannot collide
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

// ---- vendor/taskAB/rowkit_rowhouse.js ----
// rowkit_rowhouse.js — Task A, piece 1: the Baltimore rowhouse (3 or 4 storeys; Formstone / brick / painted brick / permastone).
// Everything is written through `out` (solid / glow / decal / coll / bld / lamp / hook), so a whole block merges into one chunk:
// 1 toon mesh + 1 ink hull + 1 glow mesh + 1 decal mesh (the kit atlas) = 4 draw calls. Facades are decals in 1.2 m cells of the
// atlas tiles (tileable, randomly mirrored), windows are one decal each + seeded night glow, relief is real geometry:
// marble stoop with rails, bracketed cornice with dentils, lintels, sills, string course, hood, downspout, roof hatch / deck.
// No imports; no Math.random (seeded LCG from opts.seed); materials only through K / out.
const META_ROWHOUSE = { id: 'rowhouse', kind: 'kit', footprint: [4.8, 13], floors: [3, 4] };

const rhRng = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; };
const rhHex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rhTone = (h, f) => '#' + rhHex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');

// ---------- wall-oriented emit toolkit (identical copy lives in rowkit_corner.js: modules cannot import) ----------
function rhKit(K, out, atlas, X, Z, ANG) {
  const THREE = K.THREE, CURB = K.CURB ?? 0.16, SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 };
  const bx = (w, h, d, skip = '') => { // BoxGeometry minus the faces nobody can see (px nx py ny pz nz)
    const g = new THREE.BoxGeometry(w, h, d);
    if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); }
    return g;
  };
  const wedge = (w, h, d) => { // bracket: triangular prism; wall at z = 0, foot (y 0, z 0), top at y = h, nose (y h, z d). 4 triangles
    const P = [], N = [], x0 = -w / 2, x1 = w / 2, A = [0, 0], B = [h, 0], C = [h, d], v = (x, q) => [x, q[0], q[1]];
    const tri = (a, b, c, n) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]; if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { const t = b; b = c; c = t; } P.push(...a, ...b, ...c); N.push(...n, ...n, ...n); };
    tri(v(x1, A), v(x1, B), v(x1, C), [1, 0, 0]); tri(v(x0, A), v(x0, B), v(x0, C), [-1, 0, 0]);
    const l = Math.hypot(h, d), n = [0, -d / l, h / l]; tri(v(x0, A), v(x1, A), v(x1, C), n); tri(v(x0, A), v(x1, C), v(x0, C), n);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); return g;
  };
  const wall = (cx, cz, ry, len) => { const s = Math.sin(ry), c = Math.cos(ry); return { cx, cz, ry, len, pt: (u, off) => [cx + u * c + off * s, cz - u * s + off * c] }; };
  const fin = (g, Wl, u, y, off) => { g.rotateY(Wl.ry); const [px, pz] = Wl.pt(u, off); g.translate(px, y, pz); return K.place(g, X, CURB, Z, ANG); };
  const S = {
    bx, wedge, wall, CURB,
    box(Wl, w, h, d, u, y, off, col, o = {}) { out.solid(fin(o.geom || bx(w, h, d, o.skip), Wl, u, y, off), col, !!o.ol); },     // solid box, centre at (u along wall, y, off out of wall)
    quad(Wl, w, h, u, y, off, col) { out.solid(fin(new THREE.PlaneGeometry(w, h), Wl, u, y, off), col, false); },                    // flat solid quad (glass backs, panels)
    glow(Wl, w, h, u, y, off, col) { out.glow(fin(new THREE.PlaneGeometry(w, h), Wl, u, y, off), col); },                            // flat glowing quad
    decal(Wl, w, h, u, y, off, tile, flip = false) { const g = new THREE.PlaneGeometry(w, h); if (flip) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); } out.decal(fin(g, Wl, u, y, off), atlas, tile); },
    // a tiled facade: cells of ~1.2 m, one atlas tile each, mirrored at random (the tiles wrap, so mirroring never shows a seam)
    cells(Wl, tiles, u0, u1, y0, y1, off, R) {
      const nx = Math.max(1, Math.ceil((u1 - u0) / 1.2)), ny = Math.max(1, Math.ceil((y1 - y0) / 1.2)), cw = (u1 - u0) / nx, ch = (y1 - y0) / ny;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) S.decal(Wl, cw, ch, u0 + cw * (i + 0.5), y0 + ch * (j + 0.5), off, tiles[Math.floor(R() * tiles.length)], R() < 0.5);
    },
    toWorld(lx, lz) { return [X + lx * Math.cos(ANG) + lz * Math.sin(ANG), Z - lx * Math.sin(ANG) + lz * Math.cos(ANG)]; },
    aabb(lx0, lx1, lz0, lz1) { const p = [S.toWorld(lx0, lz0), S.toWorld(lx1, lz0), S.toWorld(lx1, lz1), S.toWorld(lx0, lz1)]; return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) }; },
    coll(lx0, lx1, lz0, lz1) { out.coll(S.aabb(lx0, lx1, lz0, lz1)); },
    bld(lx0, lx1, lz0, lz1, h) { out.bld(Object.assign(S.aabb(lx0, lx1, lz0, lz1), { h })); },
  };
  return S;
}

// window tile layout (rowkit_tiles.js drawWindow): 80x144 px, frame 8 px, upper glass y 8..68, rail 68..76, lower glass y 76..136
const RH_WW = 1.12, RH_WH = 2.04, RH_PX = RH_WW / 80, RH_PY = RH_WH / 144;
const RH_CORNICE = ['#c9b48a', '#4f5a52', '#5a4f5c', '#8a4a3a', '#a4907a', '#9ab0b8', '#c49a9a'];
const RH_STONE = '#6f6a62', RH_MARBLE = '#eae6dc', RH_IRON = '#2c322e', RH_ROOF = '#4a4a50', RH_SAND = '#a4907a';

// one 1/1 sash window (decal) with night glow and stone lintel + sill. y0 = bottom of the frame.
function rowhouseWindow(S, Wl, u, y0, o) {
  const cy = y0 + RH_WH / 2; if (o.stats) { o.stats.windows++; if (o.lit) o.stats.lit++; }
  S.decal(Wl, RH_WW, RH_WH, u, cy, 0.02, 'win_' + o.style);
  if (o.lit) { // two glow panes (upper and lower sash); a painted screen hides the lower one
    S.glow(Wl, 64 * RH_PX, 60 * RH_PY, u, y0 + RH_WH - (8 + 30) * RH_PY, 0.032, o.lit);
    if (!o.screen) S.glow(Wl, 64 * RH_PX, 60 * RH_PY, u, y0 + RH_WH - (76 + 30) * RH_PY, 0.032, o.lit);
  }
  if (o.screen) S.decal(Wl, 0.9, 0.98, u, y0 + RH_WH - 106 * RH_PY, 0.045, o.screen);
  if (o.trim !== false) {
    S.box(Wl, RH_WW + 0.34, 0.2, 0.1, u, y0 + RH_WH + 0.1, 0.05, o.lintel || RH_SAND, { skip: 'nz' });
    S.box(Wl, RH_WW + 0.22, 0.1, 0.13, u, y0 - 0.05, 0.065, RH_MARBLE, { skip: 'nz' });
  }
}

function buildRowhouse(K, out, atlas, x, z, ang = 0, opts = {}) {
  const R = rhRng(opts.seed ?? 1), RC = rhRng((opts.seed ?? 1) * 7 + 3), RL = rhRng((opts.seed ?? 1) * 13 + 5);
  const GF = K.GF ?? 4.4, FH = K.FH ?? 3.4;
  // ---- every decision is drawn once, in a fixed order, so a seed always gives the same house (opts override) ----
  const r = Array.from({ length: 24 }, () => R());
  const W = opts.width ?? 4.2 + r[0] * 1.8, D = opts.depth ?? 12 + r[1] * 2;
  const front = opts.front ?? (r[2] < 0.45 ? 'formstone' : r[2] < 0.85 ? 'brick' : 'permastone');
  const floors = opts.floors ?? (r[3] < 0.55 ? 3 : 4), vari = opts.variant ?? Math.floor(r[4] * 4);
  const paint = opts.paint ?? (front === 'brick' && r[5] < 0.35);
  const bays = opts.bays ?? (W < 4.9 ? 2 : 3), doorBay = (opts.doorSide ?? (r[6] < 0.5 ? -1 : 1)) < 0 ? 0 : bays - 1;
  const nSteps = opts.steps ?? 3 + Math.floor(r[7] * 3), stoopW = opts.stoopWidth ?? 1.3 + r[8] * 0.2, stoopP = opts.stoopProj ?? 1.4 + r[9] * 0.4;
  const corP = opts.corniceProj ?? 0.5 + r[10] * 0.3, nBr = opts.brackets ?? 4 + Math.floor(r[11] * 5), corCol = opts.corniceColor ?? RH_CORNICE[Math.floor(r[12] * RH_CORNICE.length)];
  const screens = opts.screens ?? r[13] < 0.7, deck = opts.deck ?? r[14] < 0.25, doorTile = 'door_' + (opts.doorColor ?? Math.floor(r[15] * 4)), winStyle0 = Math.floor(r[16] * 3);
  const num = opts.number ?? 100 + Math.floor(r[17] * 899), chimney = r[18] < 0.4, hood = r[19] < 0.55, sideTile = r[20] < 0.5 ? 'br_red' : 'br_tan', roofCol = r[21] < 0.5 ? RH_ROOF : '#5a5058';
  const left = !!opts.left, right = !!opts.right; // neighbours on the local -x / +x side
  const Htot = GF + (floors - 1) * FH, roofY = Htot + 0.45, parTop = Htot + 0.95;
  const S = rhKit(K, out, atlas, x, z, ang), F = S.wall(0, 0, 0, W);

  // ---- facade tiles ----
  let tiles;
  if (front === 'formstone') tiles = ['fs_' + vari];
  else if (front === 'permastone') tiles = ['ps_' + (vari % 3)];
  else if (paint) tiles = ['pt_' + (vari % 4)];
  else tiles = [['br_red', 'br_tan', 'br_plum', 'br_grey', 'br_green', 'br_sand'][opts.brick ?? [0, 1, 0, 2, 3, 4, 5][vari % 7]]];
  const wallCol = { formstone: '#8f867a', permastone: '#a8a49a', brick: '#8a4a3a' }[front];

  // ---- body, facade, sides ----
  S.box(F, W, roofY, D, 0, roofY / 2, -D / 2, wallCol, { skip: 'ny', ol: true });
  S.box(F, W, 0.5, 0.2, 0, Htot + 0.7, -0.1, wallCol, { skip: 'nz ny' });                                  // parapet block behind the front decals
  S.cells(F, tiles, -W / 2, W / 2, 0, parTop, 0.012, RC);
  const sideWalls = [];
  if (!right) sideWalls.push([1, Math.PI / 2]); if (!left) sideWalls.push([-1, -Math.PI / 2]);
  for (const [sgn, ry] of sideWalls) { // exposed end of the row: brick wall, a few small windows, parapet
    const Sw = S.wall(sgn * W / 2, -D / 2, ry, D);
    S.cells(Sw, [sideTile], -D / 2, D / 2, 0, parTop, 0.012, RC);
    S.box(Sw, D, 0.5, 0.2, 0, Htot + 0.7, -0.1, wallCol, { skip: 'nz ny' });
    for (let f = 0; f < floors; f++) for (const uu of [-D * 0.18, D * 0.2]) { const y0 = f === 0 ? 1.7 : GF + (f - 1) * FH + 0.8; S.decal(Sw, 0.8, 1.45, uu, y0 + 0.72, 0.02, 'win_' + ((f + Math.round(uu)) % 3 + 3) % 3); if (RL() < 0.45) S.glow(Sw, 0.56, 0.5, uu, y0 + 1.1, 0.032, RL() < 0.5 ? '#ffe08a' : '#ffbf3c'); }
  }
  // shared party walls: only the part standing above a lower neighbour shows, so it gets brick cells too
  for (const [has, sgn, ry, top] of [[left, -1, -Math.PI / 2, opts.leftTop ?? parTop], [right, 1, Math.PI / 2, opts.rightTop ?? parTop]]) if (has && top < parTop - 0.2) S.cells(S.wall(sgn * W / 2, -D / 2, ry, D), [sideTile], -D / 2, D / 2, top, parTop, 0.012, RC);
  S.box(F, W, 0.5, 0.2, 0, Htot + 0.7, -D + 0.1, wallCol, { skip: 'pz ny' });                             // back parapet
  S.box(F, 0.2, 0.5, D, -W / 2 + 0.1, Htot + 0.7, -D / 2, wallCol, { skip: 'nx ny', ol: false });
  S.box(F, 0.2, 0.5, D, W / 2 - 0.1, Htot + 0.7, -D / 2, wallCol, { skip: 'px ny', ol: false });
  S.box(F, W - 0.4, 0.06, D - 0.4, 0, roofY + 0.03, -D / 2, roofCol, { skip: 'ny nx px pz nz' });         // roof membrane (darker than the parapet cap)
  // ---- bays: door, windows, basement windows ----
  const bw = W / bays, bc = (k) => -W / 2 + bw * (k + 0.5), doorU = bc(doorBay);
  // stone water table + its cap: gapped at the door bay (fix M1: it used to run across the bottom of the door), so the stoop meets the door
  const gap0 = doorU - 0.65, gap1 = doorU + 0.65;
  for (const [a, b] of [[-W / 2, gap0], [gap1, W / 2]]) if (b - a > 0.05) {
    S.box(F, b - a, 1.25, 0.1, (a + b) / 2, 0.625, 0.05, RH_STONE, { skip: 'nz ny', ol: true });
    S.box(F, b - a, 0.1, 0.16, (a + b) / 2, 1.28, 0.08, rhTone(RH_STONE, 1.25), { skip: 'nz ny' });
  }
  S.box(F, W, 0.12, 0.08, 0, GF, 0.04, '#c9b48a', { skip: 'nz ny' });
  S.box(F, W, 0.1, 0.07, 0, Htot - 0.42, 0.035, rhTone('#c9b48a', 0.85), { skip: 'nz ny' });
  const litCol = () => (RL() < 0.5 ? '#ffe08a' : '#ffbf3c');
  for (let k = 0; k < bays; k++) {
    const u = bc(k);
    if (k !== doorBay) {
      rowhouseWindow(S, F, u, 1.55, { stats: opts.stats, style: (winStyle0 + k) % 3, lit: RL() < 0.45 ? litCol() : null, screen: screens ? ['scr_cottage', 'scr_swan', 'scr_lighthouse', 'scr_sail', 'scr_crab', 'scr_heron'][Math.floor(RL() * 6)] : null });
      S.quad(F, 0.8, 0.42, u, 0.7, 0.108, RH_IRON); S.decal(F, 0.84, 0.46, u, 0.7, 0.118, 'grille'); S.box(F, 1.0, 0.07, 0.16, u, 0.4, 0.08, RH_MARBLE, { skip: 'nz' });
    }
    for (let f = 1; f < floors; f++) rowhouseWindow(S, F, u, GF + (f - 1) * FH + 0.7, { stats: opts.stats, style: (winStyle0 + k + f) % 3, lit: RL() < 0.45 ? litCol() : null });
  }
  // ---- door + marble stoop ----
  const rise = 0.2, sill = nSteps * rise, dH = 2.05;
  S.box(F, 0.14, dH + 0.7, 0.16, doorU - 0.57, sill + (dH + 0.7) / 2, 0.08, '#c9b48a', { skip: 'nz ny' });
  S.box(F, 0.14, dH + 0.7, 0.16, doorU + 0.57, sill + (dH + 0.7) / 2, 0.08, '#c9b48a', { skip: 'nz ny' });
  S.box(F, 1.5, 0.24, 0.18, doorU, sill + dH + 0.7 + 0.12, 0.09, RH_SAND, { skip: 'nz ny' });
  S.decal(F, 1.0, dH, doorU, sill + dH / 2, 0.04, doorTile);
  S.box(F, 1.24, 0.07, 0.2, doorU, sill + 0.035, 0.1, RH_MARBLE, { skip: 'nz ny', ol: true });                                   // marble threshold (fix M1)
  S.quad(F, 1.0, 0.5, doorU, sill + dH + 0.3, 0.05, '#4f6676');
  if (RL() < 0.5) S.glow(F, 0.9, 0.4, doorU, sill + dH + 0.3, 0.06, litCol());
  S.box(F, 1.0, 0.06, 0.1, doorU, sill + dH + 0.03, 0.06, '#c9b48a', { skip: 'nz' });
  const dg = String(num).slice(0, 3).split(''); dg.forEach((d, i) => S.decal(F, 0.15, 0.22, doorU + (i - 1) * 0.16, sill + dH + 0.32, 0.07, 'd' + d));
  if (hood) { S.box(F, 1.7, 0.1, 0.38, doorU, sill + dH + 1.05, 0.19, corCol, { skip: 'nz ny', ol: true }); for (const s of [-0.62, 0.62]) S.box(F, 0, 0, 0, doorU + s, sill + dH + 0.75, 0.1, rhTone(corCol, 0.8), { geom: S.wedge(0.1, 0.3, 0.28), ol: false }); }
  for (let i = 0; i < nSteps; i++) { // each step a solid block (front, top, both sides), marble with a cool shadow band at the foot of every riser
    const sd = stoopP - i * (stoopP / nSteps), top = (i + 1) * rise;
    S.box(F, stoopW, top, sd, doorU, top / 2, sd / 2, RH_MARBLE, { skip: 'nz ny', ol: true });
    S.quad(F, stoopW, rise * 0.3, doorU, i * rise + rise * 0.15, sd + 0.006, '#aeb4c6');
    S.box(F, stoopW + 0.06, 0.04, 0.05, doorU, top + 0.02, sd + 0.01, '#f2f2f2', { skip: 'nz ny' });
  }
  for (const s of [-1, 1]) { // iron handrails: two posts and a sloping rail each side
    const rx = doorU + s * (stoopW / 2 - 0.03), ph = 0.8;
    for (const [pz, py] of [[stoopP - 0.12, rise + ph / 2], [0.12, sill + ph / 2]]) S.box(F, 0.05, ph, 0.05, rx, py, pz, RH_IRON, { skip: 'ny' });
    const len = Math.hypot(stoopP - 0.24, sill - rise), g = S.bx(0.04, 0.04, len, 'nz pz'); g.rotateX(Math.atan2(sill - rise, stoopP - 0.24)); // slope rises toward the door
    S.box(F, 0, 0, 0, rx, (rise + sill) / 2 + ph, (stoopP) / 2, RH_IRON, { geom: g });
  }
  S.coll(doorU - stoopW / 2, doorU + stoopW / 2, 0, stoopP);

  // ---- bracketed cornice with dentils ----
  S.box(F, W, 0.42, 0.1, 0, Htot - 0.21, 0.05, rhTone(corCol, 0.82), { skip: 'nz ny' });                                   // frieze
  S.box(F, W, 0.34, corP, 0, Htot + 0.15, corP / 2, corCol, { skip: 'nz', ol: true });
  S.box(F, W, 0.12, corP + 0.1, 0, Htot + 0.38, (corP + 0.1) / 2, rhTone(corCol, 1.12), { skip: 'nz', ol: true });
  const brU = []; for (let i = 0; i < nBr; i++) { const u = -W / 2 + (i + 0.5) * W / nBr; brU.push(u); S.box(F, 0, 0, 0, u, Htot - 0.42, 0.1, rhTone(corCol, 0.95), { geom: S.wedge(0.16, 0.4, corP - 0.14), ol: false }); }
  for (let u = -W / 2 + 0.1; u < W / 2 - 0.05; u += 0.15) { if (brU.some((b) => Math.abs(b - u) < 0.16)) continue; S.box(F, 0.07, 0.1, 0.06, u, Htot - 0.07, corP - 0.07, '#e0d4b0', { skip: 'nz py' }); }

  // ---- downspout, roof details ----
  const dsU = doorBay === 0 ? W / 2 - 0.12 : -W / 2 + 0.12;
  S.box(F, 0, 0, 0, dsU, (Htot + 0.3) / 2, 0.07, '#4f5a52', { geom: new K.THREE.CylinderGeometry(0.05, 0.05, Htot + 0.3, 6, 1, true) });
  S.box(F, 0.14, 0.16, 0.14, dsU, 0.1, 0.1, '#4f5a52', { skip: 'ny' });
  S.box(F, 0.9, 0.5, 0.9, -W / 4, roofY + 0.31, -D + 2.2, '#6f6a62', { skip: 'ny', ol: true });                           // roof hatch + lid
  S.box(F, 1.0, 0.08, 1.0, -W / 4, roofY + 0.6, -D + 2.2, '#4f5a52', { skip: 'ny' });
  if (chimney) S.box(F, 0.6, 1.6, 0.9, W / 4, roofY + 0.8, -D + 1.4, '#8a4a3a', { skip: 'ny', ol: true });
  if (deck) { // rooftop deck: planks, posts and two rails
    const dz = -D + 6, dw = W - 1.0, dd = 3.2; S.box(F, dw, 0.14, dd, 0, roofY + 0.07, dz, '#9a6a44', { skip: 'ny' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.box(F, 0.06, 0.9, 0.06, sx * (dw / 2 - 0.05), roofY + 0.55, dz + sz * (dd / 2 - 0.05), RH_IRON, { skip: 'ny' });
    for (const ry of [0.55, 0.95]) { S.box(F, dw, 0.04, 0.04, 0, roofY + ry, dz - dd / 2 + 0.05, RH_IRON, { skip: 'ny' }); S.box(F, dw, 0.04, 0.04, 0, roofY + ry, dz + dd / 2 - 0.05, RH_IRON, { skip: 'ny' }); S.box(F, 0.04, 0.04, dd, -dw / 2 + 0.05, roofY + ry, dz, RH_IRON, { skip: 'ny' }); S.box(F, 0.04, 0.04, dd, dw / 2 - 0.05, roofY + ry, dz, RH_IRON, { skip: 'ny' }); }
  }

  // ---- gameplay data: footprint collider, camera box, climb hook ----
  S.coll(-W / 2, W / 2, 0, -D); S.bld(-W / 2, W / 2, 0, -D, S.CURB + parTop);                   // heights in world y (fix m1)
  if (opts.climb) { const [hx, hz] = S.toWorld(dsU, 0.12); out.hook('climb', { x: hx, z: hz, ang: ang, top: S.CURB + parTop }); }
  return { width: W, depth: D, height: parTop };
}

// ---- vendor/taskAB/rowkit_corner.js ----
// rowkit_corner.js — Task A, pieces 2 and 3: the end-of-row corner BAR and corner SHOP (chamfered corner door, 3 or 4 storeys).
// Same rules as the rowhouse: everything goes through `out` (4 draw calls per block, 1 atlas), facades are atlas decal cells,
// windows glow at night from a seeded RNG (~45 % lit), shop glass / glass block / neon always glow at night.
//  * Bar: glass-block windows, striped awning, chamfered corner door with neon over it (TAVERN / CRABS / GRILL, built from
//    stroke geometry: glows at night, dull tube colour by day), a Natty Boh-style blade sign, painted wall board (TAVERN, CRAB HOUSE, BAR & GRILL).
//  * Shop: big shop window with real local product signs (Utz, Old Bay, Natty Boh-style, OPEN), roll-up shutter (closed / half / none),
//    awning, wall sign (CORNER MARKET, CARRYOUT, BARBER, HARDWARE, LAUNDROMAT, DELI).
// All lettering is drawn on canvas in rowkit_tiles.js or built from stroke geometry here; no logo files. No imports; no Math.random.
const META_CORNER = { id: 'corner', kind: 'kit', footprint: [7.2, 7.5], floors: [3, 4], pieces: ['corner_bar', 'corner_shop'] };

const cnRng = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; };
const cnHex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const cnTone = (h, f) => '#' + cnHex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');

// ---------- wall-oriented emit toolkit (identical copy lives in rowkit_corner.js: modules cannot import) ----------
function cnKit(K, out, atlas, X, Z, ANG) {
  const THREE = K.THREE, CURB = K.CURB ?? 0.16, SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 };
  const bx = (w, h, d, skip = '') => { // BoxGeometry minus the faces nobody can see (px nx py ny pz nz)
    const g = new THREE.BoxGeometry(w, h, d);
    if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); }
    return g;
  };
  const wedge = (w, h, d) => { // bracket: triangular prism; wall at z = 0, foot (y 0, z 0), top at y = h, nose (y h, z d). 4 triangles
    const P = [], N = [], x0 = -w / 2, x1 = w / 2, A = [0, 0], B = [h, 0], C = [h, d], v = (x, q) => [x, q[0], q[1]];
    const tri = (a, b, c, n) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]; if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { const t = b; b = c; c = t; } P.push(...a, ...b, ...c); N.push(...n, ...n, ...n); };
    tri(v(x1, A), v(x1, B), v(x1, C), [1, 0, 0]); tri(v(x0, A), v(x0, B), v(x0, C), [-1, 0, 0]);
    const l = Math.hypot(h, d), n = [0, -d / l, h / l]; tri(v(x0, A), v(x1, A), v(x1, C), n); tri(v(x0, A), v(x1, C), v(x0, C), n);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); return g;
  };
  const wall = (cx, cz, ry, len) => { const s = Math.sin(ry), c = Math.cos(ry); return { cx, cz, ry, len, pt: (u, off) => [cx + u * c + off * s, cz - u * s + off * c] }; };
  const fin = (g, Wl, u, y, off) => { g.rotateY(Wl.ry); const [px, pz] = Wl.pt(u, off); g.translate(px, y, pz); return K.place(g, X, CURB, Z, ANG); };
  const S = {
    bx, wedge, wall, CURB,
    box(Wl, w, h, d, u, y, off, col, o = {}) { out.solid(fin(o.geom || bx(w, h, d, o.skip), Wl, u, y, off), col, !!o.ol); },     // solid box, centre at (u along wall, y, off out of wall)
    quad(Wl, w, h, u, y, off, col) { out.solid(fin(new THREE.PlaneGeometry(w, h), Wl, u, y, off), col, false); },                    // flat solid quad (glass backs, panels)
    glow(Wl, w, h, u, y, off, col) { out.glow(fin(new THREE.PlaneGeometry(w, h), Wl, u, y, off), col); },                            // flat glowing quad
    decal(Wl, w, h, u, y, off, tile, flip = false) { const g = new THREE.PlaneGeometry(w, h); if (flip) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); } out.decal(fin(g, Wl, u, y, off), atlas, tile); },
    // a tiled facade: cells of ~1.2 m, one atlas tile each, mirrored at random (the tiles wrap, so mirroring never shows a seam)
    cells(Wl, tiles, u0, u1, y0, y1, off, R) {
      const nx = Math.max(1, Math.ceil((u1 - u0) / 1.2)), ny = Math.max(1, Math.ceil((y1 - y0) / 1.2)), cw = (u1 - u0) / nx, ch = (y1 - y0) / ny;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) S.decal(Wl, cw, ch, u0 + cw * (i + 0.5), y0 + ch * (j + 0.5), off, tiles[Math.floor(R() * tiles.length)], R() < 0.5);
    },
    toWorld(lx, lz) { return [X + lx * Math.cos(ANG) + lz * Math.sin(ANG), Z - lx * Math.sin(ANG) + lz * Math.cos(ANG)]; },
    aabb(lx0, lx1, lz0, lz1) { const p = [S.toWorld(lx0, lz0), S.toWorld(lx1, lz0), S.toWorld(lx1, lz1), S.toWorld(lx0, lz1)]; return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) }; },
    coll(lx0, lx1, lz0, lz1) { out.coll(S.aabb(lx0, lx1, lz0, lz1)); },
    bld(lx0, lx1, lz0, lz1, h) { out.bld(Object.assign(S.aabb(lx0, lx1, lz0, lz1), { h })); },
  };
  return S;
}
// extra emitters used only by the corner pieces
function cnExtend(K, S, out, atlas, X, Z, ANG) {
  const THREE = K.THREE, CURB = K.CURB ?? 0.16;
  // a thin quad between two points of a wall plane (neon tube strokes): solid dull tube + glowing tube
  S.seg = (Wl, u0, y0, u1, y1, th, off, dim, bright) => {
    const len = Math.hypot(u1 - u0, y1 - y0), a = Math.atan2(y1 - y0, u1 - u0), mk = () => { const g = new THREE.PlaneGeometry(len + th * 0.7, th); g.rotateZ(a); return g; };
    const mx = (u0 + u1) / 2, my = (y0 + y1) / 2;
    for (const [g, d] of [[mk(), dim], [mk(), null]]) { g.rotateY(Wl.ry); const [px, pz] = Wl.pt(mx, off + (d ? 0 : 0.012)); g.translate(px, my, pz); K.place(g, X, CURB, Z, ANG); if (d) out.solid(g, d, false); else out.glow(g, bright); }
  };
  // a flat quad sloping out of the wall like an awning: top edge at (y, off0), outer edge lower and `proj` further out
  S.awning = (Wl, w, u, yTop, off0, proj, drop, tile) => {
    const l = Math.hypot(proj, drop), g = new THREE.PlaneGeometry(w, l); g.rotateX(-(Math.PI / 2 - Math.atan2(drop, proj)));
    S.decalGeom(Wl, g, u, yTop - drop / 2, off0 + proj / 2, tile);
  };
  S.decalGeom = (Wl, g, u, y, off, tile) => { g.rotateY(Wl.ry); const [px, pz] = Wl.pt(u, off); g.translate(px, y, pz); K.place(g, X, CURB, Z, ANG); out.decal(g, atlas, tile); };
  // a vertical blade sign: plane whose normal is `ny` (a local direction angle), double sided
  S.blade = (Wl, w, h, u, y, off, ryExtra, tile) => { const g = new THREE.PlaneGeometry(w, h); g.rotateY(ryExtra); S.decalGeom(Wl, g, u, y, off, tile); };
}

// ---------- neon stroke font (A-Z & -): polylines on a 2 x 4 grid ----------
const CN_FONT = {
  A: [[[0, 0], [1, 4], [2, 0]], [[0.5, 1.6], [1.5, 1.6]]], B: [[[0, 0], [0, 4], [1.4, 4], [1.9, 3.5], [1.9, 2.5], [1.4, 2], [0, 2]], [[1.4, 2], [2, 1.5], [2, 0.5], [1.5, 0], [0, 0]]],
  C: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 0.6], [0.5, 0], [1.5, 0], [2, 0.6]]], D: [[[0, 0], [0, 4], [1.3, 4], [2, 3.2], [2, 0.8], [1.3, 0], [0, 0]]],
  E: [[[2, 4], [0, 4], [0, 0], [2, 0]], [[0, 2], [1.5, 2]]], F: [[[2, 4], [0, 4], [0, 0]], [[0, 2], [1.5, 2]]],
  G: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 0.6], [0.5, 0], [1.5, 0], [2, 0.6], [2, 1.8], [1, 1.8]]], H: [[[0, 0], [0, 4]], [[2, 0], [2, 4]], [[0, 2], [2, 2]]],
  I: [[[0.5, 4], [1.5, 4]], [[1, 4], [1, 0]], [[0.5, 0], [1.5, 0]]], J: [[[2, 4], [2, 0.6], [1.5, 0], [0.5, 0], [0, 0.6]]], K: [[[0, 0], [0, 4]], [[2, 4], [0, 1.8]], [[0.6, 2.4], [2, 0]]],
  L: [[[0, 4], [0, 0], [2, 0]]], M: [[[0, 0], [0, 4], [1, 2], [2, 4], [2, 0]]], N: [[[0, 0], [0, 4], [2, 0], [2, 4]]],
  O: [[[0.5, 0], [0, 0.6], [0, 3.4], [0.5, 4], [1.5, 4], [2, 3.4], [2, 0.6], [1.5, 0], [0.5, 0]]], P: [[[0, 0], [0, 4], [1.5, 4], [2, 3.5], [2, 2.5], [1.5, 2], [0, 2]]],
  Q: [[[0.5, 0], [0, 0.6], [0, 3.4], [0.5, 4], [1.5, 4], [2, 3.4], [2, 0.6], [1.5, 0], [0.5, 0]], [[1.2, 1], [2, 0]]], R: [[[0, 0], [0, 4], [1.5, 4], [2, 3.5], [2, 2.5], [1.5, 2], [0, 2]], [[1, 2], [2, 0]]],
  S: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 2.6], [0.5, 2], [1.5, 2], [2, 1.4], [2, 0.6], [1.5, 0], [0.5, 0], [0, 0.6]]], T: [[[0, 4], [2, 4]], [[1, 4], [1, 0]]],
  U: [[[0, 4], [0, 0.6], [0.5, 0], [1.5, 0], [2, 0.6], [2, 4]]], V: [[[0, 4], [1, 0], [2, 4]]], W: [[[0, 4], [0.5, 0], [1, 2], [1.5, 0], [2, 4]]], X: [[[0, 4], [2, 0]], [[0, 0], [2, 4]]],
  Y: [[[0, 4], [1, 2], [2, 4]], [[1, 2], [1, 0]]], Z: [[[0, 4], [2, 4], [0, 0], [2, 0]]], '&': [[[2, 0], [0.4, 2.4], [0.5, 3.6], [1.1, 4], [1.7, 3.6], [1.6, 2.8], [0, 0.9], [0.5, 0], [1.4, 0], [2, 1.2]]], '-': [[[0.3, 2], [1.7, 2]]],
};
// neon word centred at u; letter height h. returns the width used. `dim` is the unlit tube colour, `bright` the glow colour.
function cnNeon(S, Wl, text, u, y, off, h, dim, bright) {
  const sc = h / 4, adv = 2 * sc + 0.28 * h, total = text.length * adv - 0.28 * h; let x = u - total / 2;
  for (const ch of text) { for (const pl of CN_FONT[ch] || []) for (let i = 0; i + 1 < pl.length; i++) S.seg(Wl, x + pl[i][0] * sc, y - h / 2 + pl[i][1] * sc, x + pl[i + 1][0] * sc, y - h / 2 + pl[i + 1][1] * sc, h * 0.13, off, dim, bright); x += adv; }
  return total;
}

const CN_WW = 1.12, CN_WH = 2.04, CN_PX = CN_WW / 80, CN_PY = CN_WH / 144;
const CN_STONE = '#6f6a62', CN_MARBLE = '#eae6dc', CN_IRON = '#2c322e', CN_SAND = '#a4907a', CN_ROOF = '#4a4a50', CN_TRIM = '#c9b48a', CN_PLUM = '#5a4f5c';
const CN_WARM = ['#ffe08a', '#ffbf3c'];

function cnWindow(S, Wl, u, y0, o) { // 1/1 sash decal + seeded night glow + lintel/sill
  if (o.stats) { o.stats.windows++; if (o.lit) o.stats.lit++; }
  S.decal(Wl, CN_WW, CN_WH, u, y0 + CN_WH / 2, 0.02, 'win_' + o.style);
  if (o.lit) { S.glow(Wl, 64 * CN_PX, 60 * CN_PY, u, y0 + CN_WH - 38 * CN_PY, 0.032, o.lit); S.glow(Wl, 64 * CN_PX, 60 * CN_PY, u, y0 + CN_WH - 106 * CN_PY, 0.032, o.lit); }
  S.box(Wl, CN_WW + 0.34, 0.2, 0.1, u, y0 + CN_WH + 0.1, 0.05, CN_SAND, { skip: 'nz' }); S.box(Wl, CN_WW + 0.22, 0.1, 0.13, u, y0 - 0.05, 0.065, CN_MARBLE, { skip: 'nz' });
}

function cnBuild(K, out, atlas, x, z, ang, opts, kind) {
  const seed = opts.seed ?? 1, R = cnRng(seed), RL = cnRng(seed * 11 + 1), RC = cnRng(seed * 5 + 9), THREE = K.THREE;
  const GF = K.GF ?? 4.4, FH = K.FH ?? 3.4, r = Array.from({ length: 16 }, () => R());
  const cs = opts.corner ?? (r[0] < 0.5 ? 1 : -1), W = opts.width ?? 6.5 + r[1] * 1.5, D = opts.depth ?? 7.5, c = opts.chamfer ?? 1.8;
  const floors = opts.floors ?? (r[2] < 0.5 ? 3 : 4), Htot = GF + (floors - 1) * FH, roofY = Htot + 0.45, parTop = Htot + 0.95;
  const brick = opts.brick ?? Math.floor(r[3] * 6), tile = ['br_red', 'br_tan', 'br_plum', 'br_grey', 'br_green', 'br_sand'][brick], paintTile = r[4] < 0.3 ? 'pt_' + Math.floor(r[5] * 4) : null;
  const wallTiles = [paintTile || tile], wallCol = '#8a4a3a', corCol = opts.corniceColor ?? ['#c9b48a', '#4f5a52', '#5a4f5c', '#a4907a'][Math.floor(r[6] * 4)];
  const left = !!opts.left;
  const S = cnKit(K, out, atlas, x, z, ang); cnExtend(K, S, out, atlas, x, z, ang);
  const O = S.wall(0, 0, 0, 1), F = S.wall(-cs * c / 2, 0, 0, W - c), Ch = S.wall(cs * (W / 2 - c / 2), -c / 2, cs * Math.PI / 4, c * Math.SQRT2), Sd = S.wall(cs * W / 2, -(c + D) / 2, cs * Math.PI / 2, D - c);
  const litCol = () => CN_WARM[RL() < 0.5 ? 0 : 1];

  // ---- body: chamfered footprint, extruded ----
  const pts = [[-W / 2, 0], [W / 2 - c, 0], [W / 2, -c], [W / 2, -D], [-W / 2, -D]].map(([px, pz]) => [cs * px, pz]);
  const shp = new THREE.Shape(); pts.forEach(([px, pz], i) => (i ? shp.lineTo(px, -pz) : shp.moveTo(px, -pz)));
  const body = new THREE.ExtrudeGeometry(shp, { depth: roofY, bevelEnabled: false }); body.rotateX(-Math.PI / 2);
  S.box(O, 0, 0, 0, 0, 0, 0, wallCol, { geom: body, ol: true });
  S.box(O, W - 0.4, 0.06, D - 0.4, 0, roofY + 0.03, -D / 2, CN_ROOF, { skip: 'ny nx px pz nz' });
  for (const Wl of [F, Ch, Sd]) { S.cells(Wl, wallTiles, -Wl.len / 2, Wl.len / 2, 0, parTop, 0.012, RC); S.box(Wl, Wl.len, 0.5, 0.2, 0, Htot + 0.7, -0.1, wallCol, { skip: 'nz ny' }); }
  S.box(O, W, 0.5, 0.2, 0, Htot + 0.7, -D + 0.1, wallCol, { skip: 'pz ny' }); S.box(O, 0.2, 0.5, D, -cs * (W / 2 - 0.1), Htot + 0.7, -D / 2, wallCol, { skip: 'ny' });
  // left-hand exposed end (side opposite the corner) when there is no neighbour: brick cells on the end wall
  const lTop = left ? (opts.leftTop ?? parTop) : 0;
  if (lTop < parTop - 0.2) {
    const Lw = S.wall(-cs * W / 2, -D / 2, -cs * Math.PI / 2, D); S.cells(Lw, wallTiles, -D / 2, D / 2, lTop, parTop, 0.012, RC);
    if (!left) for (let f = 0; f < floors; f++) for (const uu of [-D * 0.2, D * 0.2]) { const y0 = f === 0 ? 1.7 : GF + (f - 1) * FH + 0.8; S.decal(Lw, 0.8, 1.45, uu, y0 + 0.72, 0.02, 'win_' + ((f + (uu > 0 ? 1 : 0)) % 3)); if (RL() < 0.45) S.glow(Lw, 0.56, 0.5, uu, y0 + 1.1, 0.032, RL() < 0.5 ? '#ffe08a' : '#ffbf3c'); }
  }

  // ---- cornice around the three street walls ----
  const corP = 0.62, nBrAll = [];
  for (const Wl of [F, Ch, Sd]) {
    const L = Wl.len; S.box(Wl, L, 0.42, 0.1, 0, Htot - 0.21, 0.05, cnTone(corCol, 0.82), { skip: 'nz ny' });
    S.box(Wl, L, 0.34, corP, 0, Htot + 0.15, corP / 2, corCol, { skip: 'nz', ol: true }); S.box(Wl, L, 0.12, corP + 0.1, 0, Htot + 0.38, (corP + 0.1) / 2, cnTone(corCol, 1.12), { skip: 'nz', ol: true });
    const n = Math.max(2, Math.round(L / 1.1)); for (let i = 0; i < n; i++) S.box(Wl, 0, 0, 0, -L / 2 + (i + 0.5) * L / n, Htot - 0.42, 0.1, cnTone(corCol, 0.95), { geom: S.wedge(0.16, 0.4, corP - 0.14) });
    for (let u = -L / 2 + 0.1; u < L / 2 - 0.05; u += 0.17) S.box(Wl, 0.07, 0.1, 0.06, u, Htot - 0.07, corP - 0.07, '#e0d4b0', { skip: 'nz py' });
  }
  S.box(F, W - c, 0.1, 0.07, 0, Htot - 0.42, 0.035, cnTone(CN_TRIM, 0.85), { skip: 'nz ny' });

  // ---- upper floors: windows on all three walls ----
  const style0 = Math.floor(r[7] * 3);
  for (const Wl of [F, Sd, Ch]) {
    const L = Wl.len, n = Wl === Ch ? 1 : Math.max(1, Math.round((L - 1.0) / 2.1));
    for (let f = 1; f < floors; f++) for (let k = 0; k < n; k++) cnWindow(S, Wl, -L / 2 + L * (k + 0.5) / n, GF + (f - 1) * FH + 0.7, { stats: opts.stats, style: (style0 + k + f) % 3, lit: RL() < 0.45 ? litCol() : null });
  }

  // ---- ground floor ----
  const pilasters = (Wl) => { for (const s of [-1, 1]) S.box(Wl, 0.5, 3.9, 0.2, s * (Wl.len / 2 - 0.25), 1.95, 0.1, cnTone(CN_TRIM, 0.9), { skip: 'nz ny', ol: true }); };
  const band = (Wl, w, col, tileName) => { // painted sign board: panel + decal
    const sw = Math.min(Wl.len - 1.0, w), hh = sw / 4; S.box(Wl, sw + 0.2, hh + 0.2, 0.1, 0, 3.58, 0.05, col, { skip: 'nz ny', ol: true }); S.decal(Wl, sw, hh, 0, 3.58, 0.108, tileName); };
  const mullions = (Wl, gw, y0, gh, n) => { for (let i = 0; i <= n; i++) S.box(Wl, 0.08, gh, 0.08, -gw / 2 + gw * i / n, y0 + gh / 2, 0.09, CN_IRON, { skip: 'nz' }); S.box(Wl, gw + 0.1, 0.1, 0.1, 0, y0 + gh, 0.09, CN_IRON, { skip: 'nz' }); S.box(Wl, gw + 0.1, 0.1, 0.1, 0, y0, 0.09, CN_IRON, { skip: 'nz' }); };
  const shopWindow = (Wl, prods, shutter) => {
    const gw = Wl.len - 1.2, gy = 0.78, gh = 2.2; pilasters(Wl);
    S.box(Wl, Wl.len - 1.0, 0.7, 0.14, 0, 0.35, 0.07, CN_PLUM, { skip: 'nz ny', ol: true });
    S.quad(Wl, gw, gh, 0, gy + gh / 2, 0.06, '#4f6676'); S.glow(Wl, gw - 0.1, gh - 0.1, 0, gy + gh / 2, 0.075, '#ffd890');
    mullions(Wl, gw, gy, gh, Math.max(2, Math.round(gw / 1.5)));
    for (const p of prods) S.decal(Wl, p.w, p.h, p.u * gw / 2, gy + p.y, 0.1, p.tile);
    if (shutter) { const sh = shutter === 'closed' ? gh : gh * 0.5; S.box(Wl, gw + 0.1, 0.22, 0.2, 0, gy + gh + 0.1, 0.1, '#6f6a62', { skip: 'nz ny' }); S.decal(Wl, gw, sh, 0, gy + gh - sh / 2, 0.13, 'shutter'); }
  };
  const glassBlocks = (Wl, n) => { pilasters(Wl); S.box(Wl, Wl.len - 1.0, 0.9, 0.14, 0, 0.45, 0.07, CN_PLUM, { skip: 'nz ny', ol: true }); for (let i = 0; i < n; i++) { const u = -Wl.len / 2 + Wl.len * (i + 0.5) / n; S.decal(Wl, 1.35, 1.35, u, 2.0, 0.08, 'glassblock'); S.glow(Wl, 1.2, 1.2, u, 2.0, 0.095, RL() < 0.5 ? '#ffbf3c' : '#ffe08a'); S.box(Wl, 1.55, 0.12, 0.16, u, 1.26, 0.08, CN_MARBLE, { skip: 'nz' }); S.box(Wl, 1.5, 0.14, 0.12, u, 2.76, 0.06, CN_SAND, { skip: 'nz' }); } };

  const awnTile = kind === 'bar' ? 'awn_red' : ['awn_green', 'awn_blue', 'awn_red'][Math.floor(r[8] * 3)];
  let sign, signCol, prods = [];
  if (kind === 'bar') {
    const bs = opts.sign ?? ['tavern', 'crab', 'bar_grill'][Math.floor(r[9] * 3)];
    sign = { tavern: 'sign_tavern', crab: 'sign_crab', bar_grill: 'sign_bar_grill' }[bs]; signCol = bs === 'crab' ? '#2f5a3a' : bs === 'tavern' ? '#2c322e' : '#5a2438';
    glassBlocks(F, 2); band(F, 4.4, signCol, sign); S.awning(F, F.len - 1.2, 0, 3.0, 0.1, 1.0, 0.45, awnTile);
    glassBlocks(Sd, Math.max(1, Math.round(Sd.len / 2.6)));
    // neon over the corner door, plus a small OPEN tube beside the glass block
    const word = { tavern: 'TAVERN', crab: 'CRABS', bar_grill: 'GRILL' }[bs];
    S.box(Ch, Ch.len - 0.2, 0.7, 0.08, 0, 3.55, 0.06, '#1a1626', { skip: 'nz ny' });
    cnNeon(S, Ch, word, 0, 3.55, 0.12, 0.46, '#8a3a30', '#ff3a1c'); cnNeon(S, F, 'OPEN', F.len / 4, 1.62, 0.12, 0.26, '#6a2a38', '#ff3d6e');                              // in the glass-block window, below the awning (fix m9)
    // blade sign at the corner edge: the Natty Boh-style beer sign, with a lit rim
    const bu = 0, bo = 1.05; S.box(Ch, 0.08, 0.08, bo, bu, 4.62, bo / 2, CN_IRON, { skip: 'nz' });
    S.blade(Ch, 0.86, 0.573, bu, 4.62, bo, -cs * Math.PI / 4 + (cs > 0 ? Math.PI / 2 : -Math.PI / 2), 'sign_natty');
  } else {
    const ks = opts.sign ?? ['market', 'carryout', 'barber', 'hardware', 'laundromat', 'deli'][Math.floor(r[9] * 6)];
    sign = 'shop_' + ks; signCol = { market: '#2f5a3a', carryout: '#b8302a', barber: '#3a5a8a', hardware: '#3a5a8a', laundromat: '#4a8a9a', deli: '#8a4a3a' }[ks];
    prods = [{ tile: 'prod_utz', w: 0.5, h: 0.67, u: -0.55, y: 0.65 }, { tile: 'prod_oldbay', w: 0.5, h: 0.67, u: 0.05, y: 0.65 }, { tile: 'prod_natty', w: 0.55, h: 0.55, u: 0.62, y: 0.6 }, { tile: 'prod_open', w: 0.6, h: 0.3, u: -0.1, y: 1.7 }];
    const sh = opts.shutter ?? ['none', 'half', 'closed'][Math.floor(r[10] * 3)];
    shopWindow(F, prods, sh === 'none' ? null : sh); band(F, 4.4, signCol, sign); S.awning(F, F.len - 1.4, 0, 3.05, 0.12, 1.0, 0.4, awnTile);
    shopWindow(Sd, [{ tile: 'prod_oldbay', w: 0.5, h: 0.67, u: -0.3, y: 0.65 }, { tile: 'prod_utz', w: 0.5, h: 0.67, u: 0.3, y: 0.65 }], null); band(Sd, 3.6, signCol, sign);
    S.box(Ch, 0.08, 0.08, 0.9, 0, 4.62, 0.45, CN_IRON, { skip: 'nz' }); S.blade(Ch, 0.6, 0.8, 0, 4.62, 0.95, -cs * Math.PI / 4 + (cs > 0 ? Math.PI / 2 : -Math.PI / 2), 'prod_utz');
  }
  // corner door in the chamfer: panel door, transom with glow, jambs, one marble step
  const doorTile = 'door_' + (kind === 'bar' ? 2 : Math.floor(r[11] * 4)), sill = 0.2, dH = 2.05;
  S.box(Ch, 0.12, dH + 0.6, 0.14, -0.58, sill + (dH + 0.6) / 2, 0.07, CN_TRIM, { skip: 'nz ny' }); S.box(Ch, 0.12, dH + 0.6, 0.14, 0.58, sill + (dH + 0.6) / 2, 0.07, CN_TRIM, { skip: 'nz ny' });
  S.decal(Ch, 1.04, dH, 0, sill + dH / 2, 0.04, doorTile); S.quad(Ch, 1.04, 0.44, 0, sill + dH + 0.28, 0.05, '#4f6676'); S.glow(Ch, 0.94, 0.34, 0, sill + dH + 0.28, 0.06, litCol());
  S.box(Ch, 1.9, 0.18, 0.7, 0, 0.09, 0.35, CN_MARBLE, { skip: 'nz ny', ol: true }); S.box(Ch, 1.4, 0.14, 0.4, 0, 0.27 - 0.04, 0.2, cnTone(CN_MARBLE, 0.95), { skip: 'nz ny' });
  S.box(F, W - c, 0.12, 0.06, 0, GF, 0.03, CN_TRIM, { skip: 'nz ny' });
  // downspout on the open end, OUTSIDE the front wall (fix M5: it sat at off -0.07, buried in the wall). The ground-floor pilaster stands 0.2 m
  // proud there, so the pipe runs 0.27 m out (clear of the pilaster, under the 0.62 m cornice) on four wall straps, with a shoe at the foot
  const pu = -cs * (W / 2 - 0.12), po = 0.27;
  S.box(O, 0, 0, 0, pu, (Htot + 0.3) / 2, po, '#4f5a52', { geom: new THREE.CylinderGeometry(0.05, 0.05, Htot + 0.3, 6, 1, true) });
  S.box(O, 0.14, 0.16, 0.14, pu, 0.1, po + 0.03, '#4f5a52', { skip: 'ny' });
  for (const y of [1.2, GF + 0.4, GF + FH * 0.6, Htot - 0.6]) S.box(O, 0.04, 0.04, po, pu, y, po / 2, '#3a4440', { skip: 'nz' });
  S.box(F, 0.9, 0.5, 0.9, -cs * W / 4, roofY + 0.31, -D + 2.0, '#6f6a62', { skip: 'ny', ol: true });

  // ---- gameplay data ----
  S.coll(-W / 2 * cs, (W / 2 - c) * cs, 0, -D); S.coll(cs * (W / 2 - c), cs * W / 2, -c, -D); S.coll(cs * (W / 2 - c * 0.7), cs * W / 2, 0, -c * 0.7);
  S.bld(-W / 2 * cs, (W / 2 - c) * cs, 0, -D, S.CURB + parTop); S.bld(cs * (W / 2 - c), cs * W / 2, -c, -D, S.CURB + parTop);
  const [hx, hz] = S.toWorld(-cs * (W / 2 - 0.12), 0.39); if (opts.climb) out.hook('climb', { x: hx, z: hz, ang, top: S.CURB + parTop }); // in front of the wall, beside the pipe (fix M5), world y (m1)
  return { width: W, depth: D, height: parTop, corner: cs };
}

function buildCornerBar(K, out, atlas, x, z, ang = 0, opts = {}) { return cnBuild(K, out, atlas, x, z, ang, opts, 'bar'); }
function buildCornerShop(K, out, atlas, x, z, ang = 0, opts = {}) { return cnBuild(K, out, atlas, x, z, ang, opts, 'shop'); }

// ---- vendor/taskAB/rowkit_block.js ----
// rowkit_block.js — Task A, piece 4: buildRowBlock fills ONE 24 x 24 m city block with Baltimore rowhouses.
// Layout (block drawn from the north-west, x east, z south; every front faces its street, shoulder to shoulder):
//   north row  z0 .. z0+7.5     full block width      \  houses of 4.2-6.0 m, a corner BAR or SHOP on 1-2 corners
//   south row  z1-7.5 .. z1     full block width      /  (the other corners are ordinary end-of-row houses)
//   west row   x0 .. x0+10.5    the 9 m between them   - 2 houses facing the west street
//   east row   x1-10.5 .. x1    the 9 m between them   - 2 houses facing the east street
//   a 3 x 9 m yard / rear-alley strip is left in the middle (bins and crates, closed by out.coll).
// A house in the 24 m block is therefore 7.5-10.5 m deep (the stand-alone default of 12-14 m would overlap the row behind it).
// All geometry goes through the single `out` the caller owns, so the block is one chunk write: 4 draw calls in total.
// The builders are taken from opts.builders = { buildRowhouse, buildCornerBar, buildCornerShop }; in the game build, where these
// files are concatenated, the globals of the same names are used. No imports; no Math.random (seeded LCG from opts.seed).
const META_ROWBLOCK = { id: 'rowblock', kind: 'kit', footprint: [24, 24], houses: '12-14 per block', corners: '1-2 bar / shop' };

const bkRng = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; };
const BK_CORNICE = ['#c9b48a', '#4f5a52', '#5a4f5c', '#8a4a3a', '#a4907a', '#9ab0b8', '#c49a9a'];

function bkPickStyle(R, last) { // formstone 35 % · brick 35 % · painted brick 15 % · permastone 15 %; never the same as the neighbour
  for (let t = 0; t < 12; t++) {
    const q = R(), v = R(); let s;
    if (q < 0.35) s = { key: 'f' + Math.floor(v * 4), front: 'formstone', variant: Math.floor(v * 4) };
    else if (q < 0.7) { const b = Math.floor(v * 6); s = { key: 'b' + b, front: 'brick', paint: false, brick: b, variant: b }; }
    else if (q < 0.85) { const p = Math.floor(v * 4); s = { key: 'p' + p, front: 'brick', paint: true, variant: p }; }
    else { const p = Math.floor(v * 3); s = { key: 's' + p, front: 'permastone', variant: p }; }
    if (s.key !== last) return s;
  }
  return { key: 'f0', front: 'formstone', variant: 0 };
}
function bkWidths(R, rem) { // n houses of 4.2..6.0 m filling `rem` exactly
  let n = Math.max(1, Math.round(rem / 5.1)); while (rem / n > 6.0) n++; while (n > 1 && rem / n < 4.2) n--;
  const wt = Array.from({ length: n }, () => 0.85 + R() * 0.3), sum = wt.reduce((a, b) => a + b, 0); let w = wt.map((q) => (rem * q) / sum);
  if (w.some((q) => q < 4.2 || q > 6.0)) w = Array.from({ length: n }, () => rem / n);
  return w;
}

function buildRowBlock(K, out, atlas, x0, z0, x1, z1, opts = {}) {
  const B = opts.builders || {};
  const house = B.buildRowhouse || (typeof buildRowhouse === 'function' ? buildRowhouse : null);
  const bar = B.buildCornerBar || (typeof buildCornerBar === 'function' ? buildCornerBar : null);
  const shop = B.buildCornerShop || (typeof buildCornerShop === 'function' ? buildCornerShop : null);
  if (!house || !bar || !shop) throw new Error('buildRowBlock: pass opts.builders = { buildRowhouse, buildCornerBar, buildCornerShop }');
  // opts.inset (fix M6): the fronts are built on the edges of the box, and stoops (<= 1.8 m) and cornices (<= 0.9 m) stand OUT of it.
  // Pass the street plot and inset = 2 so the houses keep a 2 m pavement in front and nothing overhangs the road (default 0 = the old behaviour).
  const ins = opts.inset ?? 0; x0 += ins; z0 += ins; x1 -= ins; z1 -= ins;
  const seed = opts.seed ?? 1, R = bkRng(seed), THREE = K.THREE, CURB = K.CURB ?? 0.16;
  const XL = x1 - x0, ZL = z1 - z0, DR = opts.rowDepth ?? 7.5, ALLEY = opts.alley ?? 3, SD = (XL - ALLEY) / 2, BAND = ZL - 2 * DR;

  // ---- which corners get a bar / shop (1 or 2) ----
  const corners = { NE: null, NW: null, SW: null, SE: null }, names = ['NE', 'NW', 'SW', 'SE'];
  const c1 = names[Math.floor(R() * 4)], two = R() < 0.55, c2 = two ? names[(names.indexOf(c1) + (R() < 0.5 ? 2 : 1 + 2 * Math.floor(R() * 2))) % 4] : null;
  corners[c1] = R() < 0.5 ? 'bar' : 'shop'; if (c2 && c2 !== c1) corners[c2] = corners[c1] === 'bar' ? 'shop' : 'bar';

  // ---- plan every piece first (so exactly one gets the CLIMB hook and the styles never repeat) ----
  const rows = [
    { id: 'N', ang: Math.PI, len: XL, depth: DR, origin: (a) => [x1 - a, z0], c0: 'NE', c1: 'NW' },
    { id: 'S', ang: 0, len: XL, depth: DR, origin: (a) => [x0 + a, z1], c0: 'SW', c1: 'SE' },
    { id: 'W', ang: -Math.PI / 2, len: BAND, depth: SD, origin: (a) => [x0, z0 + DR + a], c0: null, c1: null },
    { id: 'E', ang: Math.PI / 2, len: BAND, depth: SD, origin: (a) => [x1, z1 - DR - a], c0: null, c1: null },
  ];
  const plan = []; let lastStyle = '', lastCor = -1;
  for (const row of rows) {
    const cw = [row.c0 && corners[row.c0] ? 6.5 + R() * 1.5 : 0, row.c1 && corners[row.c1] ? 6.5 + R() * 1.5 : 0], pieces = [];
    const widths = bkWidths(R, row.len - cw[0] - cw[1]);
    if (cw[0]) pieces.push({ w: cw[0], corner: corners[row.c0], cs: -1 }); widths.forEach((w) => pieces.push({ w, corner: null })); if (cw[1]) pieces.push({ w: cw[1], corner: corners[row.c1], cs: 1 });
    let a = 0; pieces.forEach((p, i) => { p.row = row; p.a = a + p.w / 2; p.i = i; p.n = pieces.length; a += p.w; plan.push(p); });
  }
  const GF = K.GF ?? 4.4, FH = K.FH ?? 3.4, topOf = (fl) => GF + (fl - 1) * FH + 0.95;
  const p3 = opts.p3 ?? 0.55; plan.forEach((p) => { p.floors = R() < p3 ? 3 : 4; p.top = topOf(p.floors); }); // opts.p3: share of 3-storey houses
  const climbAt = Math.floor(R() * plan.length);
  plan.forEach((p, idx) => {
    p.seed = seed * 131 + idx * 17 + 5; p.climb = idx === climbAt;
    if (!p.corner) { const st = bkPickStyle(R, lastStyle); lastStyle = st.key; p.style = st; let ci; do { ci = Math.floor(R() * BK_CORNICE.length); } while (ci === lastCor); lastCor = ci; p.cornice = BK_CORNICE[ci]; }
    else lastStyle = 'c';
  });

  // neighbour parapet heights: a house only needs wall cells where it stands taller than what is next to it
  const rowOf = (id) => plan.filter((q) => q.row.id === id), spanMin = (id, lo, hi) => { const r = rowOf(id); let a = 0, m = 1e9; for (const q of r) { const wlo = id === 'N' ? x1 - (a + q.w) : x0 + a, whi = wlo + q.w; if (whi > lo && wlo < hi) m = Math.min(m, q.top); a += q.w; } return m; };
  for (const row of rows) {
    const ps = rowOf(row.id); ps.forEach((p, i) => {
      p.leftTop = i > 0 ? ps[i - 1].top : undefined; p.rightTop = i < ps.length - 1 ? ps[i + 1].top : undefined;
      if (row.id === 'W') { if (i === 0) p.leftTop = spanMin('N', x0, x0 + SD); if (i === ps.length - 1) p.rightTop = spanMin('S', x0, x0 + SD); }
      if (row.id === 'E') { if (i === 0) p.leftTop = spanMin('S', x1 - SD, x1); if (i === ps.length - 1) p.rightTop = spanMin('N', x1 - SD, x1); }
    });
  }

  // ---- build ----
  const info = { houses: 0, corners: [], height: 0, pieces: [] };
  for (const p of plan) {
    const [px, pz] = p.row.origin(p.a), side = p.row.id === 'W' || p.row.id === 'E';
    let res;
    if (p.corner) {
      const f = p.corner === 'bar' ? bar : shop;
      res = f(K, out, atlas, px, pz, p.row.ang, { seed: p.seed, width: p.w, depth: p.row.depth, corner: p.cs, floors: p.floors, left: p.n > 1, leftTop: p.cs < 0 ? p.rightTop : p.leftTop, climb: p.climb, stats: opts.stats });
      info.corners.push(p.corner);
    } else {
      res = house(K, out, atlas, px, pz, p.row.ang, Object.assign({ seed: p.seed, width: p.w, depth: p.row.depth, floors: p.floors, corniceColor: p.cornice, left: side ? true : p.i > 0, right: side ? true : p.i < p.n - 1, leftTop: p.leftTop, rightTop: p.rightTop, climb: p.climb, stats: opts.stats }, p.style));
      info.houses++;
    }
    info.height = Math.max(info.height, res.height); info.pieces.push({ row: p.row.id, w: +p.w.toFixed(2), corner: p.corner || null });
  }

  // ---- the yard strip: bins and crates, closed to the characters ----
  const yx0 = x0 + SD, yx1 = x1 - SD, yz0 = z0 + DR, yz1 = z1 - DR;
  const place = (g, gx, gy, gz) => K.place(g, gx, gy, gz, 0);
  const yr = bkRng(seed * 7 + 2), cxy = (yx0 + yx1) / 2;
  for (let i = 0; i < 3; i++) { const bz = yz0 + 1.2 + yr() * (yz1 - yz0 - 2.4), bx = cxy + (yr() - 0.5) * 1.2; out.solid(place(new THREE.CylinderGeometry(0.28, 0.24, 0.7, 8), bx, CURB + 0.35, bz), i % 2 ? '#4f5a52' : '#5a5248'); out.solid(place(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8), bx, CURB + 0.73, bz), '#2c322e', false); } // lid on its own bin (fix m2)
  out.solid(place(new THREE.BoxGeometry(0.9, 0.6, 0.7), cxy + 0.2, CURB + 0.3, (yz0 + yz1) / 2 + 1.2), '#9a6a44');
  out.coll({ x0: yx0, x1: yx1, z0: yz0, z1: yz1 });
  info.box = [x0, z0, x1, z1]; return info;
}

// ---- vendor/taskAB/props_tiles.js ----
// props_tiles.js — Task B: the ONE 1024² atlas for the street props and vehicles (K.makeAtlas(PROP_TILES)).
// Bench plates and ads, the crab-shack sign + chalkboard menu, the manhole cover ring, the recycling sticker, number plates and the
// vehicle liveries (harbour water-taxi lettering, a Utz-style snack truck, a MOVING & STORAGE truck, the arabber cart's painted side).
// Real Baltimore wording and colour schemes (Old Bay, Utz, water-taxi branding, arabber red / yellow / green) are RE-DRAWN here from
// text and flat shapes. No logo image, photo or traced artwork is used or embedded. No imports; no Math.random.
const META_PROPS_TILES = { id: 'props_tiles', kind: 'kit', atlas: 1024, note: 'PROP_TILES for K.makeAtlas()' };

const PROP_TILES = (() => { // helpers live inside this closure, so concatenated modules cannot collide
const INK = '#14101f', SANS = 'Impact, "Arial Black", sans-serif', SERIF = 'Georgia, serif';
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
const shade = (h, f, a = 1) => { const [r, g, b] = hexRgb(h); return `rgba(${cl(r * f)},${cl(g * f)},${cl(b * f)},${a})`; };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const fit = (c, txt, x, y, maxW, px, font = SANS, weight = '') => { let s = px; c.font = `${weight} ${s}px ${font}`; while (c.measureText(txt).width > maxW && s > 6) { s -= 1; c.font = `${weight} ${s}px ${font}`; } c.fillText(txt, x, y); return s; };
const centre = (c) => { c.textAlign = 'center'; c.textBaseline = 'middle'; };

function busPlate(c, w, h) {
  c.fillStyle = '#2a3f6a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#eae6dc'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8); centre(c); c.fillStyle = '#eae6dc';
  fit(c, 'BUS STOP', w * 0.5, h * 0.4, w * 0.5, 30); fit(c, 'INNER HARBOR · ALL ROUTES', w * 0.5, h * 0.78, w * 0.7, 11, SERIF, 'bold');
  c.fillStyle = '#ffd23c'; rr(c, 14, 14, 44, 30, 6); c.fill(); c.fillStyle = INK; c.fillRect(20, 20, 32, 12); c.beginPath(); c.arc(26, 42, 4, 0, 7); c.arc(46, 42, 4, 0, 7); c.fill();
  c.fillStyle = '#eae6dc'; c.beginPath(); c.moveTo(w - 56, h * 0.4 - 8); c.lineTo(w - 30, h * 0.4 - 8); c.lineTo(w - 30, h * 0.4 - 16); c.lineTo(w - 14, h * 0.4); c.lineTo(w - 30, h * 0.4 + 16); c.lineTo(w - 30, h * 0.4 + 8); c.lineTo(w - 56, h * 0.4 + 8); c.fill();
}
function adOldBay(c, w, h) {
  c.fillStyle = '#e8b830'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f5bd3'; c.fillRect(0, h * 0.62, w, h * 0.38); c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4); centre(c);
  c.fillStyle = '#c8302a'; fit(c, 'OLD BAY', w * 0.5, h * 0.32, w - 30, 34); c.fillStyle = '#eae6dc'; fit(c, 'SEAFOOD SEASONING', w * 0.5, h * 0.8, w - 24, 15, SERIF, 'bold');
}
function crabSign(c, w, h) {
  c.fillStyle = '#2f5a3a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#eae6dc'; c.lineWidth = 5; c.strokeRect(5, 5, w - 10, h - 10); centre(c);
  c.fillStyle = '#f08a50'; fit(c, 'STEAMED', w * 0.5, h * 0.3, w - 60, 40); fit(c, 'CRABS', w * 0.5, h * 0.64, w - 90, 44);
  c.fillStyle = '#eae6dc'; fit(c, 'BY THE DOZEN · OLD BAY', w * 0.5, h * 0.88, w - 50, 12, SERIF, 'bold');
  c.fillStyle = '#c8302a'; for (const sx of [22, w - 22]) { c.beginPath(); c.ellipse(sx, h * 0.5, 10, 7, 0, 0, 7); c.fill(); c.fillRect(sx - 12, h * 0.5 - 12, 4, 6); c.fillRect(sx + 8, h * 0.5 - 12, 4, 6); }
}
function crabMenu(c, w, h) {
  c.fillStyle = '#22302a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#9a6a44'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 6; i++) c.fillRect(10 + i * 18, 12, 8, h - 24);
  centre(c); c.fillStyle = '#f2e6c8'; fit(c, 'CRAB MENU', w / 2, 24, w - 28, 22, SANS);
  c.strokeStyle = '#f2e6c8'; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 40); c.lineTo(w - 14, 40); c.stroke();
  const rows = [['MEDIUM DOZEN', 'MKT'], ['LARGE DOZEN', 'MKT'], ['CRAB CAKE', '$14'], ['CORN ON COB', '$3'], ['COLD BEER', '$5']];
  rows.forEach(([a, b], i) => { c.textAlign = 'left'; c.fillStyle = '#f2e6c8'; fit(c, a, 14, 56 + i * 17, 70, 12, SERIF, 'bold'); c.textAlign = 'right'; c.fillStyle = '#ffd23c'; c.fillText(b, w - 14, 56 + i * 17); });
  centre(c); c.fillStyle = '#f08a50'; fit(c, 'ASK FOR OLD BAY!', w / 2, h - 12, w - 20, 11, SERIF, 'bold');
}
function manhole(c, w, h) {
  c.clearRect(0, 0, w, h); c.fillStyle = '#4a4a50'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill(); c.strokeStyle = '#2c322e'; c.lineWidth = 5; c.stroke();
  c.strokeStyle = '#2c322e'; c.lineWidth = 2.5; c.beginPath(); c.arc(w / 2, h / 2, w * 0.36, 0, 7); c.stroke(); c.save(); c.beginPath(); c.arc(w / 2, h / 2, w * 0.34, 0, 7); c.clip();
  c.strokeStyle = '#6f6a62'; c.lineWidth = 3; for (let i = -w; i < w * 2; i += 14) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i, h); c.lineTo(i + h, 0); c.stroke(); } c.restore();
  c.fillStyle = '#4a4a50'; c.fillRect(w * 0.18, h * 0.43, w * 0.64, h * 0.14); c.fillStyle = '#c9b48a'; centre(c); fit(c, 'BALTIMORE CITY', w / 2, h / 2 + 1, w * 0.58, 11, SANS);
}
function recycle(c, w, h) {
  c.fillStyle = '#2f5bd3'; rr(c, 2, 2, w - 4, h - 4, 8); c.fill(); c.strokeStyle = '#eae6dc'; c.lineWidth = 3; c.stroke(); c.strokeStyle = '#eae6dc'; c.lineWidth = 5; c.lineJoin = 'round';
  for (let i = 0; i < 3; i++) { const a = i * 2.094 - 1.57, b = a + 1.6; c.beginPath(); c.arc(w / 2, h * 0.42, 15, a, b); c.stroke(); const ex = w / 2 + Math.cos(b) * 15, ey = h * 0.42 + Math.sin(b) * 15; c.fillStyle = '#eae6dc'; c.beginPath(); c.moveTo(ex + Math.cos(b + 1.57) * 7, ey + Math.sin(b + 1.57) * 7); c.lineTo(ex - Math.cos(b + 1.57) * 7, ey - Math.sin(b + 1.57) * 7); c.lineTo(ex + Math.cos(b) * 9, ey + Math.sin(b) * 9); c.fill(); }
  c.fillStyle = '#eae6dc'; centre(c); fit(c, 'RECYCLE', w / 2, h * 0.85, w - 12, 11, SANS);
}
function platePlate(c, w, h) { c.fillStyle = '#eae6dc'; rr(c, 1, 1, w - 2, h - 2, 4); c.fill(); c.strokeStyle = '#2f5bd3'; c.lineWidth = 2; c.stroke(); centre(c); c.fillStyle = '#2f5bd3'; fit(c, 'MARYLAND', w / 2, h * 0.24, w - 12, 8, SERIF, 'bold'); c.fillStyle = INK; fit(c, '5CX 4821', w / 2, h * 0.64, w - 8, 15, SANS); }
function taxiSide(c, w, h) { // harbour water-taxi lettering: white hull panel, navy stripe, blue block letters, a yellow band and a little crab
  c.fillStyle = '#eae6dc'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8b830'; c.fillRect(0, 0, w, 10); c.fillStyle = '#2a3f6a'; c.fillRect(0, h - 18, w, 18); centre(c);
  c.fillStyle = '#2a3f6a'; fit(c, 'BALTIMORE WATER TAXI', w * 0.54, h * 0.46, w * 0.78, 36); c.fillStyle = '#c8302a'; c.beginPath(); c.ellipse(32, h * 0.46, 18, 12, 0, 0, 7); c.fill();
  c.fillRect(14, h * 0.46 - 18, 5, 9); c.fillRect(45, h * 0.46 - 18, 5, 9); c.fillStyle = '#eae6dc'; c.fillRect(24, h * 0.46 - 6, 4, 4); c.fillRect(36, h * 0.46 - 6, 4, 4);
  c.fillStyle = '#eae6dc'; fit(c, 'INNER HARBOR · FELLS POINT · CANTON', w * 0.5, h - 9, w * 0.7, 11, SERIF, 'bold');
}
function taxiBow(c, w, h) { c.fillStyle = '#2a3f6a'; c.fillRect(0, 0, w, h); centre(c); c.fillStyle = '#e8b830'; fit(c, 'WATER', w / 2, h * 0.32, w - 20, 22); c.fillStyle = '#eae6dc'; fit(c, 'TAXI', w / 2, h * 0.72, w - 40, 24); }
function truckUtz(c, w, h) { // Utz-style delivery truck livery drawn from text
  c.fillStyle = '#d8a828'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f5bd3'; c.fillRect(0, h - 22, w, 22); c.fillStyle = '#c8302a'; c.fillRect(0, h - 28, w, 6); centre(c);
  c.lineWidth = 8; c.strokeStyle = '#eae6dc'; c.lineJoin = 'round'; c.font = `italic bold 70px ${SERIF}`; c.strokeText('Utz', w * 0.3, h * 0.42); c.fillStyle = '#c8302a'; c.fillText('Utz', w * 0.3, h * 0.42);
  c.fillStyle = '#2f5bd3'; fit(c, 'POTATO CHIPS', w * 0.72, h * 0.3, w * 0.4, 20); c.fillStyle = INK; fit(c, 'PRETZELS · POPCORN · CHEESE CURLS', w * 0.72, h * 0.55, w * 0.46, 11, SERIF, 'bold');
  c.fillStyle = '#eae6dc'; fit(c, 'HANOVER, PA · FRESH SINCE 1921', w / 2, h - 11, w - 20, 11, SERIF, 'bold');
}
function truckMove(c, w, h) { c.fillStyle = '#2a3f6a'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd23c'; c.fillRect(0, h * 0.76, w, 6); centre(c); c.fillStyle = '#ffd23c'; fit(c, 'MOVING & STORAGE', w / 2, h * 0.38, w - 30, 38); c.fillStyle = '#eae6dc'; fit(c, 'CHARM CITY MOVERS · BALTIMORE · SINCE 1952', w / 2, h * 0.64, w - 30, 13, SERIF, 'bold'); c.fillStyle = '#eae6dc'; fit(c, 'LOCAL · LONG DISTANCE · PIANOS', w / 2, h * 0.9, w - 40, 11, SERIF); }
function arabberSide(c, w, h) { // painted wooden cart side: red field, yellow scrollwork, green border, a lettered banner
  c.fillStyle = '#b8302a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2f5a3a'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); c.strokeStyle = '#e8b830'; c.lineWidth = 3; c.strokeRect(12, 12, w - 24, h - 24);
  c.lineCap = 'round'; for (let i = 0; i < 4; i++) { const x = 30 + i * 62; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x, h / 2); c.bezierCurveTo(x + 14, h / 2 + s * 30, x + 40, h / 2 + s * 8, x + 28, h / 2 + s * 20); c.stroke(); c.beginPath(); c.arc(x + 28, h / 2 + s * 20, 4, 0, 7); c.stroke(); } }
  c.fillStyle = '#2f5a3a'; rr(c, 34, h * 0.36, w - 68, h * 0.28, 8); c.fill(); c.strokeStyle = '#e8b830'; c.lineWidth = 2.5; c.stroke(); centre(c); c.fillStyle = '#ffd23c'; fit(c, 'FRESH FRUIT & VEGGIES', w / 2, h * 0.5, w - 90, 20, SANS);
}
function dragonScales(c, w, h) { c.fillStyle = '#b8302a'; c.fillRect(0, 0, w, h); for (let y = 0; y < h + 8; y += 8) for (let x = (y / 8) % 2 ? 8 : 0; x < w + 8; x += 16) { c.fillStyle = '#d84a30'; c.beginPath(); c.arc(x, y, 8, 0, Math.PI); c.fill(); c.strokeStyle = '#7a1f1a'; c.lineWidth = 1.5; c.stroke(); } c.fillStyle = '#e8b830'; c.fillRect(0, 0, w, 6); }

const T = (w, h, draw) => ({ w, h, draw });
const PT = {
  taxi_side: T(384, 96, taxiSide), truck_utz: T(320, 112, truckUtz), truck_move: T(320, 112, truckMove), arabber_side: T(256, 112, arabberSide), crab_sign: T(256, 96, crabSign),
  crab_menu: T(128, 160, crabMenu), bus_plate: T(256, 64, busPlate), ad_oldbay: T(192, 64, adOldBay), taxi_bow: T(128, 64, taxiBow), dragon_scales: T(128, 64, dragonScales),
  manhole: T(128, 128, manhole), recycle: T(64, 64, recycle), plate: T(64, 32, platePlate),
};
return PT;
})();

// The prop atlas belongs to the game, not to a cache keyed on the kit object K (Grok QA: five WeakMaps keyed on K made a new atlas for every
// K a caller built). Order: opts.atlas, then the game's own packed atlas K.propAtlas, then K.makeAtlas(PROP_TILES), which the game caches
// on the tile set itself (02c AB_ATLASES). soft = return null instead of throwing (cars just skip their liveries).
function tbPropAtlas(K, opts, who, soft = false) {
  if (opts && opts.atlas) return opts.atlas;
  if (K.propAtlas) return K.propAtlas;
  if (typeof PROP_TILES === 'object' && K.makeAtlas) return K.makeAtlas(PROP_TILES);
  if (soft) return null;
  throw new Error(who + ': pass opts.atlas or K.propAtlas (= K.makeAtlas(PROP_TILES))');
}

// ---- vendor/taskAB/props_street.js ----
// props_street.js — Task B: merged static street props (everything writes through `out`, so props add NO draw calls).
//   lamp_acorn · lamp_cobra · bench_park · bench_bus · trash_can (+ recycling variant) · manhole · ladder_wall · ladder_drop
// Signature of every piece: buildXxx(K, out, x, z, ang = 0, opts = {}) -> its entry of META_PROPS_STREET.pieces. The base sits on the pavement top
// (K.CURB) except the manhole, which is flush with the road (y 0.005). Facing is +Z rotated by ang. opts.atlas = the shared
// K.makeAtlas(PROP_TILES) (if omitted, the PROP_TILES global of the concatenated game build is used).
// Ink hulls only on major masses (<~4 cm parts have outline:false). Triangles below count the ink hulls too.
// No imports; no Math.random; materials only through out / K.
const META_PROPS_STREET = {
  id: 'props_street', kind: 'prop',
  pieces: {
    lamp_acorn: { id: 'lamp_acorn', kind: 'prop', footprint: [0.5, 0.5], height: 4.9 }, lamp_cobra: { id: 'lamp_cobra', kind: 'prop', footprint: [0.4, 0.4], height: 7.4 },
    bench_park: { id: 'bench_park', kind: 'prop', footprint: [1.8, 0.6], height: 0.9 }, bench_bus: { id: 'bench_bus', kind: 'prop', footprint: [1.9, 0.6], height: 2.2 },
    trash_can: { id: 'trash_can', kind: 'prop', footprint: [0.7, 0.7], height: 0.95 }, manhole: { id: 'manhole', kind: 'prop', footprint: [0.9, 0.9], height: 0.01 },
    ladder_wall: { id: 'ladder_wall', kind: 'prop', footprint: [0.6, 0.3], height: 6 }, ladder_drop: { id: 'ladder_drop', kind: 'prop', footprint: [0.6, 0.3], height: 3.9 },
  },
};

// ---- local helpers (one namespace object so concatenated modules cannot collide) ----
// the prop atlas comes from tbPropAtlas (props_tiles.js): opts.atlas, then the game-owned K.propAtlas; no cache keyed on K (Grok QA), PROP_TILES guarded (fix m5)
const PS = {
  tone: (h, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''),
  CURB: 0.16, GREEN: '#2f4a3a', IRON: '#2c322e', WOOD: '#9a6a44',
  atlas(K, opts) { return tbPropAtlas(K, opts, 'props_street'); },
  box(THREE, w, h, d, skip = '') { // BoxGeometry minus hidden faces (px nx py ny pz nz)
    const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 };
    if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); }
    return g;
  },
  kit(K, out, x, z, ang, y0) {
    const THREE = K.THREE, fin = (g, lx, ly, lz, rot) => { if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); } g.translate(lx, ly, lz); return K.place(g, x, y0, z, ang); };
    const S = {
      THREE, fin,
      box: (w, h, d, lx, ly, lz, col, o = {}) => out.solid(fin(PS.box(THREE, w, h, d, o.skip), lx, ly, lz, o.rot), col, !!o.ol),
      cyl: (rt, rb, h, seg, lx, ly, lz, col, o = {}) => out.solid(fin(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), lx, ly, lz, o.rot), col, !!o.ol),
      sph: (r, ws, hs, sx, sy, sz, lx, ly, lz, col, o = {}) => out.solid(fin(new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz), lx, ly, lz, o.rot), col, !!o.ol),
      glowSph: (r, ws, hs, sx, sy, sz, lx, ly, lz, col) => out.glow(fin(new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz), lx, ly, lz), col),
      glowQuad: (w, h, lx, ly, lz, col, rot) => out.glow(fin(new THREE.PlaneGeometry(w, h), lx, ly, lz, rot), col),
      decal: (atlas, tile, w, h, lx, ly, lz, rot) => out.decal(fin(new THREE.PlaneGeometry(w, h), lx, ly, lz, rot), atlas, tile),
      world(lx, lz) { return [x + lx * Math.cos(ang) + lz * Math.sin(ang), z - lx * Math.sin(ang) + lz * Math.cos(ang)]; },
      aabb(lx0, lx1, lz0, lz1) { const p = [[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]].map(([a, b]) => S.world(a, b)); return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) }; },
    };
    return S;
  },
};

// ---------------------------------------------------------------- historic acorn street lamp
function buildLampAcorn(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), G = opts.paint || PS.GREEN, GL = '#e8e0c8';
  S.box(0.46, 0.22, 0.46, 0, 0.11, 0, G, { skip: 'ny', ol: true });                          // plinth
  S.cyl(0.1, 0.2, 0.6, 8, 0, 0.52, 0, G, { open: true, ol: true });                         // fluted flare
  S.cyl(0.15, 0.15, 0.07, 8, 0, 0.86, 0, PS.tone(G, 1.3), { open: true });                      // collar
  S.cyl(0.07, 0.095, 3.1, 8, 0, 2.45, 0, G, { open: true, ol: true });                       // shaft
  S.cyl(0.13, 0.13, 0.08, 8, 0, 4.0, 0, PS.tone(G, 1.3), { open: true });                       // upper collar
  S.cyl(0.2, 0.09, 0.14, 8, 0, 4.11, 0, G);                                                  // lantern cup
  S.sph(0.25, 7, 5, 1, 1.15, 1, 0, 4.5, 0, GL);                                              // acorn globe, milky by day...
  S.glowSph(0.255, 7, 5, 1, 1.15, 1, 0, 4.5, 0, '#ffa050');                                   // ...warm lamp-light at night
  S.cyl(0.04, 0.27, 0.22, 8, 0, 4.9, 0, G);                                                  // acorn cap
  S.cyl(0, 0.045, 0.14, 6, 0, 5.07, 0, PS.tone(G, 1.3));                                        // finial
  const [wx, wz] = S.world(0, 0); out.lamp(wx, C + 4.5, wz); out.coll({ x: wx, z: wz, r: 0.25 });
  return META_PROPS_STREET.pieces.lamp_acorn;
}

// ---------------------------------------------------------------- modern cobra-head avenue lamp (the arm reaches toward +Z)
function buildLampCobra(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), G = opts.paint || '#5a5f62', THREE = K.THREE;
  S.cyl(0.2, 0.24, 0.5, 8, 0, 0.25, 0, '#6f6a62', { ol: true });                            // base cover
  S.cyl(0.08, 0.13, 6.3, 8, 0, 3.65, 0, G, { open: true, ol: true });                        // tapered pole
  S.box(0.09, 0.09, 1.0, 0, 7.0, 0.36, G, { rot: [-0.28, 0, 0] });                            // arm rising out of the pole...
  S.box(0.09, 0.09, 0.7, 0, 7.18, 1.1, G, { rot: [0.0, 0, 0] });                              // ...and levelling off
  S.sph(0.5, 8, 5, 1, 0.3, 0.55, 0, 7.14, 1.55, '#8a9094');                                   // the cobra head (oversized for a phone screen)
  const lens = new THREE.CircleGeometry(0.3, 8).rotateX(Math.PI / 2).scale(1, 1, 1.4); lens.translate(0, 7.04, 1.55); K.place(lens, x, C, z, ang);
  const lens2 = lens.clone(); out.solid(lens, '#d8d0b0', false); out.glow(lens2.translate(0, -0.012, 0), '#ffa050');
  const [wx, wz] = S.world(0, 1.55); const [px, pz] = S.world(0, 0); out.lamp(wx, C + 7.0, wz); out.coll({ x: px, z: pz, r: 0.28 });
  return META_PROPS_STREET.pieces.lamp_cobra;
}

// ---------------------------------------------------------------- park bench: wood slats on cast-iron ends
function buildBenchPark(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), wood = opts.wood || PS.WOOD, iron = opts.iron || PS.IRON;
  for (const lz of [0.14, 0, -0.14]) S.box(1.8, 0.05, 0.11, 0, 0.45, lz, wood, { skip: 'ny' });
  for (const ly of [0.62, 0.8]) S.box(1.8, 0.11, 0.05, 0, ly, -0.22, wood, { skip: 'ny', rot: [-0.14, 0, 0] });
  for (const s of [-1, 1]) {
    S.box(0.06, 0.42, 0.06, s * 0.82, 0.21, 0.17, iron, { skip: 'ny', ol: true });                              // front leg
    S.box(0.06, 0.9, 0.06, s * 0.82, 0.45, -0.22, iron, { skip: 'ny', ol: true, rot: [-0.14, 0, 0] });         // raked back leg
    S.box(0.05, 0.05, 0.5, s * 0.82, 0.68, -0.02, iron, { skip: 'ny' });                                      // armrest
  }
  const [wx, wz] = S.world(0, 0); out.hook('seat', { x: wx, y: C + 0.45, z: wz, ang }); out.coll(S.aabb(-0.9, 0.9, -0.3, 0.3));
  return META_PROPS_STREET.pieces.bench_park;
}

// ---------------------------------------------------------------- bus-stop bench with an Old Bay ad back and a bus-stop sign
function buildBenchBus(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), A = PS.atlas(K, opts), wood = opts.wood || PS.WOOD, conc = '#8a8478';
  for (const lz of [0.1, -0.1]) S.box(1.7, 0.07, 0.19, 0, 0.45, lz, wood, { skip: 'ny' });
  for (const s of [-1, 1]) S.box(0.12, 0.43, 0.5, s * 0.8, 0.215, 0, conc, { skip: 'ny', ol: true });
  S.box(1.7, 0.46, 0.05, 0, 0.9, -0.22, '#2a3f6a', { skip: 'ny nz', ol: true });                               // ad board
  S.decal(A, 'ad_oldbay', 1.54, 0.37, 0, 0.9, -0.19);                                                          // the Old Bay-style ad, drawn on canvas
  S.cyl(0.035, 0.035, 2.2, 6, 1.05, 1.1, -0.1, PS.IRON, { open: true, ol: true });                              // pole
  S.box(0.62, 0.22, 0.03, 1.05, 2.0, -0.1, '#2a3f6a', { skip: 'ny', ol: true });
  S.decal(A, 'bus_plate', 0.58, 0.145, 1.05, 2.0, -0.082); S.decal(A, 'bus_plate', 0.58, 0.145, 1.05, 2.0, -0.118, [0, Math.PI, 0]);
  const [wx, wz] = S.world(0, 0); out.hook('seat', { x: wx, y: C + 0.46, z: wz, ang }); out.coll(S.aabb(-0.95, 1.2, -0.3, 0.3));
  return META_PROPS_STREET.pieces.bench_bus;
}

// ---------------------------------------------------------------- public trash can; opts.recycling attaches a blue recycling bin
function buildTrashCan(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), A = opts.recycling ? PS.atlas(K, opts) : null;
  const can = (lx, col, rec) => {
    S.cyl(0.3, 0.25, 0.85, 8, lx, 0.425, 0, col, { open: true, ol: true });
    S.cyl(0.325, 0.325, 0.08, 8, lx, 0.89, 0, PS.tone(col, 1.25));
    S.cyl(0.305, 0.275, 0.05, 8, lx, 0.5, 0, PS.tone(col, 0.7), { open: true });
    out.solid(S.fin(new S.THREE.CircleGeometry(0.19, 8).rotateX(-Math.PI / 2), lx, 0.933, 0), PS.IRON, false);                                   // the dark opening
    if (rec) S.decal(A, 'recycle', 0.3, 0.3, lx, 0.5, 0.272);
  };
  can(0, opts.paint || '#2f4a3a', false);
  if (opts.recycling) { can(0.68, '#2f5bd3', true); S.box(0.5, 0.06, 0.1, 0.34, 0.62, 0, PS.IRON, { skip: 'ny' }); }
  const [wx, wz] = S.world(opts.recycling ? 0.34 : 0, 0); out.coll({ x: wx, z: wz, r: opts.recycling ? 0.6 : 0.34 });
  return META_PROPS_STREET.pieces.trash_can;
}

// ---------------------------------------------------------------- manhole cover, flush with the road (top at y = 0.005, nit fixed: it was 0.017)
function buildManhole(K, out, x, z, ang = 0, opts = {}) {
  const S = PS.kit(K, out, x, z, ang, 0), A = PS.atlas(K, opts);
  S.cyl(0.46, 0.46, 0.005, 12, 0, 0.0025, 0, '#4a4a50');
  S.decal(A, 'manhole', 0.92, 0.92, 0, 0.009, 0, [-Math.PI / 2, 0, 0]);
  const [wx, wz] = S.world(0, 0); out.hook('manhole', { x: wx, z: wz });
  return META_PROPS_STREET.pieces.manhole;
}

// ---------------------------------------------------------------- fixed steel wall ladder up to a roof (opts.top = roof height in m)
function ladderRungs(S, from, to, iron) {
  for (let y = from + 0.12; y < to - 0.1; y += 0.32) S.box(0.44, 0.035, 0.04, 0, y, 0.15, iron, { skip: 'nx px nz' });
  for (const s of [-1, 1]) { S.box(0.05, to - from, 0.05, s * 0.23, (from + to) / 2, 0.15, iron, { skip: 'ny nz', ol: true }); }
}
function buildLadderWall(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), top = opts.top ?? 6.0, iron = opts.iron || '#4f5a52';
  ladderRungs(S, 0, top, iron);
  for (const y of [0.4, top / 2, top - 0.3]) for (const s of [-1, 1]) S.box(0.04, 0.04, 0.13, s * 0.23, y, 0.075, iron, { skip: 'ny' });
  const [wx, wz] = S.world(0, 0.15); out.hook('climb', { x: wx, z: wz, ang, top: C + top });
  return META_PROPS_STREET.pieces.ladder_wall;
}

// ---------------------------------------------------------------- fire-escape drop ladder: only the bottom section, hanging at 1.6 m
function buildLadderDrop(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), iron = opts.iron || PS.IRON, top = opts.top ?? 4.4;
  ladderRungs(S, 1.6, 3.8, iron);
  S.box(0.62, 0.05, 0.5, 0, 3.86, 0.1, iron, { skip: 'ny', ol: true });                         // the fire-escape landing the ladder hangs from
  for (const s of [-1, 1]) { S.box(0.04, 0.4, 0.04, s * 0.3, 3.62, 0.34, iron, { skip: 'ny' }); }
  S.box(0.07, 0.07, 0.3, 0, 1.52, 0.15, '#6f6a62', { skip: 'ny' });                             // counterweight bar
  const [wx, wz] = S.world(0, 0.15); out.hook('climb', { x: wx, z: wz, ang, top: C + top });
  return META_PROPS_STREET.pieces.ladder_drop;
}

// ---- vendor/taskAB/props_crab_shack.js ----
// props_crab_shack.js — Task B: the harbour crab shack / steamed-crab stand (merged static prop, ~4 x 3 m, front faces +Z).
// Weathered wood stand with a counter, chalkboard menu on an easel, a tin roof, a painted STEAMED CRABS board (canvas decal) and a neon CRABS
// sign built from stroke geometry that glows at night (dull tube colour by day), crab pots, barrels, buoys, harbour bunting and string
// lights. Real Baltimore flavour: steamed blue crabs, Old Bay, cold beer. Lettering is drawn from text on canvas or built from geometry.
// All geometry goes through `out` (no draw calls of its own); one lamp point is registered for the sign light. No imports; no Math.random.
const META_CRAB_SHACK = { id: 'crab_shack', kind: 'prop', footprint: [4, 3], height: 4.1 };

const CS = {
  CURB: 0.16, WOOD: '#9a6a44', GREY: '#6f6a62', IRON: '#2c322e', CREAM: '#eae6dc',
  atlas(K, opts) { return tbPropAtlas(K, opts, 'crab_shack'); },
  box(THREE, w, h, d, skip = '') { const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }; if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); } return g; },
  FONT: {
    A: [[[0, 0], [1, 4], [2, 0]], [[0.5, 1.6], [1.5, 1.6]]], B: [[[0, 0], [0, 4], [1.4, 4], [1.9, 3.5], [1.9, 2.5], [1.4, 2], [0, 2]], [[1.4, 2], [2, 1.5], [2, 0.5], [1.5, 0], [0, 0]]],
    C: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 0.6], [0.5, 0], [1.5, 0], [2, 0.6]]], R: [[[0, 0], [0, 4], [1.5, 4], [2, 3.5], [2, 2.5], [1.5, 2], [0, 2]], [[1, 2], [2, 0]]],
    S: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 2.6], [0.5, 2], [1.5, 2], [2, 1.4], [2, 0.6], [1.5, 0], [0.5, 0], [0, 0.6]]],
  },
};

function buildCrabShack(K, out, x, z, ang = 0, opts = {}) {
  const THREE = K.THREE, C = K.CURB ?? CS.CURB, A = CS.atlas(K, opts), wood = opts.wood || CS.WOOD, teal = opts.paint || '#4f7a6a';
  const fin = (g, lx, ly, lz, rot) => { if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); } g.translate(lx, ly, lz); return K.place(g, x, C, z, ang); };
  const box = (w, h, d, lx, ly, lz, col, o = {}) => out.solid(fin(CS.box(THREE, w, h, d, o.skip), lx, ly, lz, o.rot), col, !!o.ol);
  const cyl = (rt, rb, h, seg, lx, ly, lz, col, o = {}) => out.solid(fin(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), lx, ly, lz), col, !!o.ol);
  const sph = (r, ws, hs, lx, ly, lz, col, o = {}) => out.solid(fin(new THREE.SphereGeometry(r, ws, hs), lx, ly, lz), col, !!o.ol);
  const toWorld = (lx, lz) => [x + lx * Math.cos(ang) + lz * Math.sin(ang), z - lx * Math.sin(ang) + lz * Math.cos(ang)];

  // deck, posts, walls
  box(4.0, 0.12, 3.0, 0, 0.06, 0, '#7a5a3a', { skip: 'ny', ol: true });
  // the tin roof is a 3.8 m slab tilted 0.1 rad down to the front; roofUnder(z) = its underside, so posts and the back wall meet it (fix m3)
  const roofUnder = (lz) => 2.82 - (lz - 0.2) * Math.tan(0.1) - 0.035 / Math.cos(0.1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const top = roofUnder(sz * 1.4), hh = top - 0.12; box(0.14, hh, 0.14, sx * 1.9, 0.12 + hh / 2, sz * 1.4, wood, { skip: 'ny', ol: true }); }
  { const top = roofUnder(-1.42) + 0.02, hh = top - 0.12; box(3.8, hh, 0.08, 0, 0.12 + hh / 2, -1.42, teal, { skip: 'ny nz' }); }
  for (const y of [0.5, 1.2, 1.9, 2.5]) box(3.8, 0.07, 0.04, 0, y, -1.36, csTone(teal, 0.7), { skip: 'ny nz' });
  for (const sx of [-1, 1]) box(0.08, 1.1, 2.8, sx * 1.9, 0.67, 0, teal, { skip: 'ny' });
  // counter with painted front, top slab and a steamer pot on it
  box(3.6, 0.95, 0.6, 0, 0.6, 1.1, CS.CREAM, { skip: 'ny', ol: true }); box(3.6, 0.2, 0.01, 0, 0.35, 1.405, '#2a3f6a', { skip: 'ny nz' });
  box(3.9, 0.07, 0.95, 0, 1.12, 1.15, wood, { skip: 'ny', ol: true });
  cyl(0.3, 0.28, 0.42, 8, -1.1, 1.36, 1.15, '#8a9094', { ol: true }); cyl(0.32, 0.32, 0.05, 8, -1.1, 1.6, 1.15, '#6f6a62'); cyl(0.2, 0.2, 0.3, 8, -0.4, 1.31, 1.15, '#8a9094');
  box(0.6, 0.3, 0.4, 0.9, 1.31, 1.15, '#c8302a', { skip: 'ny' });                                        // a crate of Old Bay tins
  // roof (tin, sloping toward the front) with a red fascia and a vent
  box(4.7, 0.07, 3.8, 0, 2.82, 0.2, CS.GREY, { skip: 'ny', rot: [0.1, 0, 0], ol: true }); box(4.7, 0.14, 0.07, 0, 2.62, 2.1, '#b8302a', { skip: 'ny' });
  cyl(0.07, 0.07, 0.5, 6, 1.4, 3.1, -0.6, CS.IRON, { open: true });
  // painted board + neon CRABS above it
  box(2.9, 1.08, 0.08, 0, 3.55, 1.45, '#2f5a3a', { skip: 'ny nz', ol: true });
  out.decal(fin(new THREE.PlaneGeometry(2.7, 2.7 * 96 / 256), 0, 3.55, 1.5), A, 'crab_sign');
  box(0.06, 0.8, 0.06, -1.2, 3.1, 1.4, wood, { skip: 'ny' }); box(0.06, 0.8, 0.06, 1.2, 3.1, 1.4, wood, { skip: 'ny' });
  const sc = 0.6 / 4, adv = 2 * sc + 0.14, word = 'CRABS', total = word.length * adv - 0.14; let px = -total / 2;
  const seg = (u0, y0, u1, y1, th, dim, bright) => {
    const len = Math.hypot(u1 - u0, y1 - y0), a = Math.atan2(y1 - y0, u1 - u0), mx = (u0 + u1) / 2, my = (y0 + y1) / 2;
    out.solid(fin(new THREE.PlaneGeometry(len + th * 0.7, th).rotateZ(a), mx, my, 1.52), dim, false); out.glow(fin(new THREE.PlaneGeometry(len + th * 0.7, th).rotateZ(a), mx, my, 1.54), bright);
  };
  // the neon's raceway: a dark backing rail standing on the board's top edge, so the tubes no longer float (fix m3)
  box(total + 0.3, 0.64, 0.05, 0, 4.42, 1.47, '#1a1626', { ol: true });
  for (const ch of word) { for (const pl of CS.FONT[ch]) for (let i = 0; i + 1 < pl.length; i++) seg(px + pl[i][0] * sc, 4.35 + pl[i][1] * sc - 0.3 + 0.0, px + pl[i + 1][0] * sc, 4.35 + pl[i + 1][1] * sc - 0.3, 0.08, '#8a3a30', '#ff3a1c'); px += adv; }
  // easel + chalkboard menu
  box(0.9, 1.08, 0.05, 2.25, 0.7, 1.3, '#22302a', { skip: 'ny nz', ol: true, rot: [-0.12, 0, 0] }); out.decal(fin(new THREE.PlaneGeometry(0.8, 1.0), 2.25, 0.72, 1.335, [-0.12, 0, 0]), A, 'crab_menu');
  for (const s of [-1, 1]) box(0.05, 1.2, 0.05, 2.25 + s * 0.38, 0.62, 1.0, wood, { skip: 'ny', rot: [0.25, 0, 0] });
  // crab pots (wire cages), barrels, buoys
  for (let i = 0; i < 3; i++) { cyl(0.34, 0.34, 0.5, 8, -2.65 + (i % 2) * 0.2, 0.37 + (i === 2 ? 0.5 : 0), i === 2 ? 0.0 : 0.4 - i * 0.2, '#3a3a40', { ol: true, open: false }); }
  for (const [bx, bz, bc] of [[2.3, -0.7, '#2a3f6a'], [2.45, -0.15, '#8a4a3a']]) { cyl(0.28, 0.28, 0.7, 8, bx, 0.47, bz, bc, { ol: true }); cyl(0.29, 0.29, 0.05, 8, bx, 0.62, bz, csTone(bc, 0.6)); }
  sph(0.14, 6, 4, -2.2, 0.28, 1.2, '#b8302a'); sph(0.14, 6, 4, -2.05, 0.28, 1.35, '#ffd23c'); sph(0.14, 6, 4, 2.15, 1.25, -0.4, '#2f5bd3');
  // harbour bunting along the eave and string lights under the roof
  const flag = ['#b8302a', '#ffd23c', '#2f5bd3', '#eae6dc', '#2f5a3a'];
  for (let i = 0; i < 12; i++) { const fx = -2.1 + i * 0.382; out.solid(fin(new THREE.CircleGeometry(0.11, 3).rotateZ(-Math.PI / 2), fx, 2.46 - Math.abs(Math.sin(i * 0.52)) * 0.05, 2.08), flag[i % 5], false); }
  for (let i = 0; i < 8; i++) out.glow(fin(new THREE.OctahedronGeometry(0.06, 0), -1.75 + i * 0.5, 2.5, 0.6 + (i % 2) * 0.1), '#ffd890');
  const [lx, lz] = toWorld(0, 1.7); out.lamp(lx, C + 3.2, lz);
  out.coll(csAabb(toWorld, -3.05, 2.8, -1.6, 1.75)); out.bld(Object.assign(csAabb(toWorld, -2.1, 2.1, -1.6, 1.75), { h: C + 4.1 })); // collider now covers the pots, barrels and easel (fix m3)
  return META_CRAB_SHACK;
}
function csAabb(toWorld, lx0, lx1, lz0, lz1) { const p = [toWorld(lx0, lz0), toWorld(lx1, lz0), toWorld(lx1, lz1), toWorld(lx0, lz1)]; return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) }; }
function csTone(h, f) { return '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''); }

// ---- vendor/taskAB/veh_cars.js ----
// veh_cars.js — Task B (rebuilt 2026-10-11): street cars with real 3D volume, in the game's chunky cel-shaded style.
// Kinds (seeded silhouettes from 70s-2000s Baltimore streets): 'sedan' (boxy full-size), 'hatch' (compact hatchback), 'wagon' (estate with roof
// rails), 'minivan' (one-box people carrier), 'pickup' (cab + open bed), 'cab' (yellow city taxi with a roof sign and checker band), plus the box truck.
// Each car: a lofted, bevelled lower body (chamfered shoulders, a side crease, tapered nose and tail, a dark grimy rocker), a separate tapered greenhouse
// (raked windshield, tumblehome to a bevelled roof, pillars, black belt / drip trims), REAL transparent glass (out.glass, tinted, with a glossy
// highlight streak) over a visible interior (dash, steering wheel, seat backs, headrests), dark wheel wells with fender lips, tyres with hubcaps
// (white walls on the old sedans), bumpers, grille, head / tail lights with night glow (out.glow), mirrors, door seams + handles, rub strip and licence plates.
// out.glass(geom, rgba) is optional: a kit without it gets an opaque tinted pane through out.solid (the original starter kit still works).
// Vehicle contract: buildXxx(K, opts) -> { root, kind:'car', seats, collider, waterline, animate(v, dt, speed, steer, t) }. Facing +Z, wheels on y = 0.
//   steer > 0 turns left (toward +X); speed in m/s. Seat anchors 'sit' = the rider's hips. The driver sits on +X (left, US).
//   Meshes: toon body + ink hull + glass + glow (+ livery decal on the box truck) + 3 wheel meshes (front left, front right, rear pair) <= 8.
// Static contract: buildParkedCarXxx(K, out, x, z, ang, opts) writes into `out` at y = 0 (on the road) and returns its META entry; opts.kind picks any kind.
// No imports; no Math.random (seeded LCG from opts.seed); no per-frame allocation in animate().
const META_VEH_CARS = {
  id: 'veh_cars', kind: 'vehicle',
  pieces: {
    car_sedan: { id: 'car_sedan', kind: 'car', length: 4.9, width: 1.84, height: 1.48 }, car_hatch: { id: 'car_hatch', kind: 'car', length: 3.96, width: 1.7, height: 1.47 },
    car_wagon: { id: 'car_wagon', kind: 'car', length: 4.8, width: 1.8, height: 1.56 }, car_minivan: { id: 'car_minivan', kind: 'car', length: 4.6, width: 1.86, height: 1.8 },
    car_pickup: { id: 'car_pickup', kind: 'car', length: 5.3, width: 1.94, height: 1.87 }, car_cab: { id: 'car_cab', kind: 'car', length: 4.9, width: 1.84, height: 1.7 },
    box_truck: { id: 'box_truck', kind: 'car', length: 6.6, width: 2.3, height: 3.25 },
    parked_car_sedan: { id: 'parked_car_sedan', kind: 'prop', footprint: [1.84, 4.9], height: 1.48 }, parked_car_hatchback: { id: 'parked_car_hatchback', kind: 'prop', footprint: [1.7, 3.96], height: 1.47 },
    parked_car_pickup: { id: 'parked_car_pickup', kind: 'prop', footprint: [1.94, 5.3], height: 1.87 }, parked_car_wagon: { id: 'parked_car_wagon', kind: 'prop', footprint: [1.8, 4.8], height: 1.56 },
    parked_car_minivan: { id: 'parked_car_minivan', kind: 'prop', footprint: [1.86, 4.6], height: 1.8 }, parked_car_cab: { id: 'parked_car_cab', kind: 'prop', footprint: [1.84, 4.9], height: 1.7 },
  },
};
const VC = {
  // period paints: maroon, navy, champagne, forest, gunmetal, white, black, red, powder blue, brown, gold, plum, teal, silver
  PAINT: ['#8a2a2e', '#2e4a72', '#cbbf9e', '#3d5c3a', '#62686e', '#e6e2d8', '#25252b', '#b0342a', '#6f8fb0', '#7a5434', '#b89a5e', '#56406a', '#2f6a6a', '#a9adb2'],
  TRIM: ['#b89a72', '#6a6a70', '#6a2a2a', '#3a4a6a', '#4a4038'], // interior: tan, grey, oxblood, blue, brown
  TYRE: '#1d1d22', CHROME: '#b9c0c7', BLACK: '#1e1c22', DARK: '#141218', UNDER: '#2a2826', CARPET: '#2c2826',
  rng(seed) { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; },
  hex: (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
  tone: (h, f) => '#' + VC.hex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join(''),
  mix: (a, b, t) => { const A = VC.hex(a), B = VC.hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); },
  atlas(K, opts) { return tbPropAtlas(K, opts, 'veh_cars', true); }, // null: liveries skipped
  // ---- the silhouettes. st = lower-body loft stations [z, half-width factor, top y]; g = greenhouse (A0 windshield foot, A1 windshield top,
  //      C1 rear-glass top, C0 rear-glass foot, yr roof, rw roof half-width, B pillar z list, we = z where the last side window ends (null: follows the rear line))
  SPEC: {
    sedan: { L: 4.9, hw: 0.92, r: 0.34, zf: 1.45, zr: -1.42, yb: 0.3, bump: 'chrome', lamps: 'quad', ww: true,
      st: [[-2.45, 0.9, 0.84], [-2.39, 0.98, 0.9], [-2.15, 1, 0.93], [-1.55, 1, 0.95], [1.05, 1, 0.94], [1.35, 1, 0.92], [2.25, 1, 0.86], [2.4, 0.98, 0.81], [2.45, 0.9, 0.74]],
      g: { A0: 1.05, A1: 0.25, C1: -1.0, C0: -1.55, yr: 1.43, rw: 0.74, B: [-0.36], we: -1.1 }, rows: [-0.12, -0.98] },
    wagon: { L: 4.8, hw: 0.9, r: 0.33, zf: 1.42, zr: -1.4, yb: 0.3, bump: 'chrome', lamps: 'wide', rails: true,
      st: [[-2.4, 0.92, 0.9], [-2.35, 0.99, 0.95], [-2.2, 1, 0.96], [1.0, 1, 0.94], [1.3, 1, 0.92], [2.2, 1, 0.86], [2.35, 0.98, 0.8], [2.4, 0.9, 0.74]],
      g: { A0: 1.0, A1: 0.22, C1: -2.16, C0: -2.3, yr: 1.47, rw: 0.75, B: [-0.42, -1.32], we: null }, rows: [-0.16, -1.0] },
    hatch: { L: 3.96, hw: 0.85, r: 0.31, zf: 1.22, zr: -1.2, yb: 0.28, bump: 'black', lamps: 'wide',
      st: [[-1.98, 0.92, 0.92], [-1.93, 0.99, 0.95], [-1.85, 1, 0.96], [0.9, 1, 0.93], [1.15, 1, 0.9], [1.85, 1, 0.83], [1.95, 0.97, 0.77], [1.98, 0.9, 0.7]],
      g: { A0: 0.9, A1: 0.1, C1: -1.5, C0: -1.86, yr: 1.42, rw: 0.7, B: [-0.48], we: -1.18 }, rows: [-0.22, -1.08] },
    minivan: { L: 4.6, hw: 0.93, r: 0.33, zf: 1.45, zr: -1.36, yb: 0.3, bump: 'body', lamps: 'aero',
      st: [[-2.3, 0.93, 0.98], [-2.25, 0.99, 1.0], [-2.2, 1, 1.0], [1.4, 1, 1.0], [1.7, 1, 0.92], [2.2, 1, 0.82], [2.28, 0.97, 0.76], [2.3, 0.9, 0.68]],
      g: { A0: 1.4, A1: 0.5, C1: -2.12, C0: -2.22, yr: 1.76, rw: 0.8, B: [-0.12, -1.26], we: null }, rows: [0.15, -0.75, -1.65] },
    pickup: { L: 5.3, hw: 0.97, r: 0.38, zf: 1.65, zr: -1.65, yb: 0.4, bump: 'chrome', lamps: 'quad', bed: [-0.56, -2.65],
      st: [[-0.5, 1, 1.05], [1.25, 1, 1.05], [1.45, 1, 1.02], [2.5, 1, 0.98], [2.62, 0.98, 0.92], [2.65, 0.9, 0.84]],
      g: { A0: 1.25, A1: 0.66, C1: -0.38, C0: -0.45, yr: 1.83, rw: 0.82, B: [], we: -0.12 }, rows: [-0.12] },
    truck: { L: 6.6, hw: 1.1, r: 0.46, zf: 2.25, zr: -2.2, yb: 0.52, bump: 'black', lamps: 'quad', box: [-3.3, 1.02],
      st: [[1.08, 1, 1.32], [2.3, 1, 1.32], [2.5, 1, 1.27], [3.15, 1, 1.18], [3.27, 0.97, 1.08], [3.3, 0.9, 0.98]],
      g: { A0: 2.3, A1: 1.82, C1: 1.2, C0: 1.14, yr: 2.58, rw: 0.98, B: [], we: 1.5 }, rows: [1.6] },
  },
};
VC.SPEC.cab = Object.assign({}, VC.SPEC.sedan, { taxi: true, ww: false, bump: 'body' });

// ---------------------------------------------------------------- the model builder: triangles sorted into layers, all in car-local space
class VCB {
  constructor(THREE) { this.T = THREE; this.S = new Map(); this.G = { P: [], N: [], C: [] }; this.L = new Map(); this.D = []; }
  // a triangle, wound so its face normal points along `hint` (flat shading: one normal per face)
  tri(B, a, b, c, hint) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-10) return;
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
    B.P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) B.N.push(nx / l, ny / l, nz / l); return B;
  }
  bucket(col, ol) { const k = col + (ol ? '|1' : '|0'); let B = this.S.get(k); if (!B) this.S.set(k, (B = { P: [], N: [], col, ol: !!ol })); return B; }
  quad(col, a, b, c, d, hint, ol = false) { const B = this.bucket(col, ol); this.tri(B, a, b, c, hint); this.tri(B, a, c, d, hint); }
  poly(col, pts, hint, ol = false) { const B = this.bucket(col, ol); for (let i = 1; i + 1 < pts.length; i++) this.tri(B, pts[0], pts[i], pts[i + 1], hint); }
  glow(col, a, b, c, d, hint) { let B = this.L.get(col); if (!B) this.L.set(col, (B = { P: [], N: [] })); this.tri(B, a, b, c, hint); this.tri(B, a, c, d, hint); }
  glass(rgba, a, b, c, d, hint) { const G = this.G, n0 = G.P.length; this.tri(G, a, b, c, hint); this.tri(G, a, c, d, hint); for (let i = n0 / 3; i < G.P.length / 3; i++) G.C.push(...rgba); }
  geo(g, col, ol = false) { // any THREE geometry already in car space
    if (g.index) g = g.toNonIndexed(); if (!g.attributes.normal) g.computeVertexNormals();
    const B = this.bucket(col, ol), p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i++) { B.P.push(p[i]); B.N.push(n[i]); }
  }
  box(col, w, h, d, x, y, z, o = {}) { const g = new this.T.BoxGeometry(w, h, d); if (o.rx) g.rotateX(o.rx); if (o.ry) g.rotateY(o.ry); if (o.rz) g.rotateZ(o.rz); g.translate(x, y, z); this.geo(g, col, o.ol); }
  beam(col, p0, p1, t, ol = false, t2 = t) { // a box of section t x t2 from p0 to p1
    const T = this.T, d = new T.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), L = d.length(), g = new T.BoxGeometry(t, t2, L);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), d.normalize())); g.translate((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2); this.geo(g, col, ol);
  }
  disc(col, r, seg, x, y, z, sx, a0 = 0, a1 = Math.PI * 2) { // a disc in the side plane (normal +-X)
    const pts = []; for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; pts.push([x, y + Math.sin(a) * r, z + Math.cos(a) * r]); }
    const B = this.bucket(col, false), c = [x, y, z]; for (let i = 0; i < seg; i++) this.tri(B, c, pts[i], pts[i + 1], [sx, 0, 0]);
  }
  ring(col, r0, r1, seg, x, y, z, sx, a0 = 0, a1 = Math.PI * 2) {
    for (let i = 0; i < seg; i++) { const a = a0 + (a1 - a0) * i / seg, b = a0 + (a1 - a0) * (i + 1) / seg, P = (r, t) => [x, y + Math.sin(t) * r, z + Math.cos(t) * r]; this.quad(col, P(r0, a), P(r1, a), P(r1, b), P(r0, b), [sx, 0, 0]); }
  }
  geom(P, N, C) { const T = this.T, g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3)); if (C) g.setAttribute('color', new T.BufferAttribute(new Float32Array(C), 4)); return g; }
}

// lower body: loft through the stations; section = chamfered bottom, a side crease that bulges 1.5 cm, a chamfered shoulder, a flat top
function vcLoft(M, s, paint, R, cabin) {
  const prof = (hw, yb, yt) => { const ym = yb + (yt - yb) * 0.52; return [[-hw + 0.09, yb], [-hw, yb + 0.11], [-hw - 0.015, ym], [-hw + 0.004, yt - 0.12], [-hw + 0.07, yt], [hw - 0.07, yt], [hw - 0.004, yt - 0.12], [hw + 0.015, ym], [hw, yb + 0.11], [hw - 0.09, yb]]; };
  const st = s.st.map(([z, f, yt], i) => ({ z, hw: s.hw * f, yt, yb: s.yb + (i === 0 || i === s.st.length - 1 ? 0.06 : 0) }));
  const grime = VC.tone(paint, 0.62), shoulder = VC.tone(paint, 1.04);
  const colOf = (e, zc) => { // e = edge index around the section
    if (e === 9) return VC.UNDER; if (e === 0 || e === 8) return grime; if (e === 4) return zc > cabin[0] && zc < cabin[1] ? VC.CARPET : paint; if (e === 3 || e === 5) return shoulder; return paint;
  };
  for (let i = 0; i + 1 < st.length; i++) {
    const a = st[i], b = st[i + 1], pa = prof(a.hw, a.yb, a.yt), pb = prof(b.hw, b.yb, b.yt), zc = (a.z + b.z) / 2, cy = (a.yb + a.yt) / 2;
    for (let e = 0; e < pa.length; e++) {
      const f = (e + 1) % pa.length, A = [pa[e][0], pa[e][1], a.z], Bv = [pa[f][0], pa[f][1], a.z], C = [pb[f][0], pb[f][1], b.z], D = [pb[e][0], pb[e][1], b.z];
      const mx = (A[0] + Bv[0] + C[0] + D[0]) / 4, my = (A[1] + Bv[1] + C[1] + D[1]) / 4;
      M.quad(colOf(e, zc), A, Bv, C, D, [mx, my - cy, 0], e !== 9);
    }
  }
  for (const [k, dir] of [[0, -1], [st.length - 1, 1]]) { const q = st[k], p = prof(q.hw, q.yb, q.yt).map(([x, y]) => [x, y, q.z]); M.poly(paint, p, [0, 0, dir], true); }
  return { st, top: (z) => { for (let i = 0; i + 1 < st.length; i++) if (z >= st[i].z && z <= st[i + 1].z) { const t = (z - st[i].z) / (st[i + 1].z - st[i].z); return st[i].yt + (st[i + 1].yt - st[i].yt) * t; } return st[z < 0 ? 0 : st.length - 1].yt; } };
}

// greenhouse: windshield, roof (bevelled), rear glass, side windows between pillars, C-pillar panels, belt + drip trims, highlight streaks
function vcGreenhouse(M, s, paint, body, roofCol, glassC, hiC) {
  const g = s.g, hb = s.hw - 0.07, hr = g.rw, yA = body.top(g.A0), yC = body.top(g.C0), yr = g.yr;
  const belt = (z) => yA + (yC - yA) * (z - g.A0) / (g.C0 - g.A0);
  const zF = (t) => g.A0 + (g.A1 - g.A0) * t, zR = (t) => g.C0 + (g.C1 - g.C0) * t;
  const P = (sx, z, t) => [sx * (hb + (hr - hb) * t), belt(z) + (yr - belt(z)) * t, z]; // a point on a side plane, t = 0 belt .. 1 roof line
  const W = (sx) => [sx * (yr - (yA + yC) / 2), hb - hr, 0]; // outward normal hint of a side plane
  const pc = VC.tone(paint, 0.96);
  // windshield + rear glass
  M.glass(glassC, [-hb, yA, g.A0], [hb, yA, g.A0], [hr, yr, g.A1], [-hr, yr, g.A1], [0, 0.6, 1]);
  M.glass(glassC, [-hb, yC, g.C0], [hb, yC, g.C0], [hr, yr, g.C1], [-hr, yr, g.C1], [0, 0.6, -1]);
  // glossy streaks: one diagonal band on the windshield, one on each side window (glass layer, nearly opaque)
  const streak = (p0, p1, p2, p3, n, k0, k1) => { const L = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), o = (p) => p.map((v, i) => v + n[i] * 0.006);
    M.glass(hiC, o(L(p0, p1, k0)), o(L(p0, p1, k1)), o(L(p3, p2, k1 - 0.18)), o(L(p3, p2, k0 - 0.18)), n); };
  streak([-hb, yA, g.A0], [hb, yA, g.A0], [hr, yr, g.A1], [-hr, yr, g.A1], [0, 0.7, 0.7], 0.42, 0.56);
  // bevelled roof: edge ring at yr, top inset 7 cm and raised 4.5 cm
  const e = [[-hr, yr, g.A1], [hr, yr, g.A1], [hr, yr, g.C1], [-hr, yr, g.C1]], t = [[-hr + 0.07, yr + 0.045, g.A1 - 0.06], [hr - 0.07, yr + 0.045, g.A1 - 0.06], [hr - 0.07, yr + 0.045, g.C1 + 0.06], [-hr + 0.07, yr + 0.045, g.C1 + 0.06]];
  M.quad(roofCol, t[0], t[1], t[2], t[3], [0, 1, 0], true);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, m = [(e[i][0] + e[j][0]) / 2, 0.5, (e[i][2] + e[j][2]) / 2 - (g.A1 + g.C1) / 2]; M.quad(roofCol, e[i], e[j], t[j], t[i], m, true); }
  // side windows between the pillars (+ the C-pillar panel when the last window ends early)
  const cuts = [g.A0 - 1].concat(g.B).concat([g.we === null ? g.C0 + 1 : g.we]);
  for (const sx of [-1, 1]) {
    const n = W(sx), nl = Math.hypot(n[0], n[1]); const nn = [n[0] / nl, n[1] / nl, 0];
    for (let k = 0; k + 1 < cuts.length; k++) {
      const za = cuts[k] + (k ? 0.045 : 0), zb = cuts[k + 1] - (k + 1 < cuts.length - 1 ? 0.045 : 0), t0 = 0.03, t1 = 0.95;
      const q = [P(sx, Math.max(za, zF(t0)), t0), P(sx, Math.min(zb, zR(t0)), t0), P(sx, Math.min(zb, zR(t1)), t1), P(sx, Math.max(za, zF(t1)), t1)];
      M.glass(glassC, q[0], q[1], q[2], q[3], nn);
      if (k === 0) streak(q[0], q[1], q[2], q[3], nn, 0.3, 0.5);
    }
    if (g.we !== null) M.quad(pc, P(sx, zR(0), 0), P(sx, g.we, 0), P(sx, g.we, 1), P(sx, zR(1), 1), nn, true);
    // pillars: A along the windshield edge, B uprights, the rear (C / D) along the rear-glass edge; black belt + drip trims
    M.beam(pc, P(sx, g.A0, 0), P(sx, g.A1, 1), 0.075, true);
    M.beam(pc, P(sx, g.C0, 0), P(sx, g.C1, 1), 0.075, true);
    for (const zb of g.B) M.beam(VC.BLACK, P(sx, zb, 0), P(sx, zb, 1), 0.085, false, 0.05);
    M.beam(VC.BLACK, P(sx, g.A0, 0.01), P(sx, g.C0, 0.01), 0.035);
    M.beam(VC.BLACK, P(sx, g.A1, 0.99), P(sx, g.C1, 0.99), 0.035);
  }
  return { hb, hr, yA, yC, belt };
}

// one wheel's geometry list, centred on its axle; sx = which side faces out. Only what can be seen: an open tread band, the outer sidewall ring,
// a white-wall ring (old sedans), a dished hubcap + centre cap; drivable wheels add five dimples so the spin reads. Cheap (parked) wheels use fewer segments.
function vcWheelParts(THREE, s, sx, cheap) {
  const r = s.r, w = s.kind === 'truck' ? 0.3 : 0.23, L = [], seg = cheap ? 10 : 14, ox = sx * w / 2;
  const side = (g) => g.rotateY(sx * Math.PI / 2); // a flat XY shape turned to face +-X
  L.push([new THREE.CylinderGeometry(r, r, w, seg, 1, true).rotateZ(Math.PI / 2), VC.TYRE]);
  L.push([side(new THREE.RingGeometry(r * 0.6, r, seg)).translate(ox, 0, 0), VC.tone(VC.TYRE, 1.3)]);
  if (s.ww) L.push([side(new THREE.RingGeometry(r * 0.6, r * 0.76, seg)).translate(ox + sx * 0.004, 0, 0), '#e8e6de']);
  L.push([new THREE.CylinderGeometry(r * (s.ww ? 0.5 : 0.58), r * (s.ww ? 0.56 : 0.62), 0.03, cheap ? 8 : 10, 1, true).rotateZ(Math.PI / 2).translate(ox + sx * 0.015, 0, 0), VC.tone(s.hub, 0.8)]);
  L.push([side(new THREE.CircleGeometry(r * (s.ww ? 0.5 : 0.58), cheap ? 8 : 10)).translate(ox + sx * 0.03, 0, 0), s.hub]);
  L.push([side(new THREE.CircleGeometry(r * 0.2, 6)).translate(ox + sx * 0.036, 0, 0), VC.tone(s.hub, 0.7)]);
  if (!cheap) for (let i = 0; i < 5; i++) { const a = (i * Math.PI * 2) / 5; L.push([side(new THREE.CircleGeometry(r * 0.07, 5)).translate(ox + sx * 0.034, Math.sin(a) * r * 0.38, Math.cos(a) * r * 0.38), VC.tone(s.hub, 0.5)]); }
  return L;
}

// ---------------------------------------------------------------- the whole car (everything except the moving wheels)
function vcModel(K, kind, opts) {
  const THREE = K.THREE, s0 = VC.SPEC[kind] || VC.SPEC.sedan, R = VC.rng((opts.seed ?? 1) * 7 + kind.length), M = new VCB(THREE);
  const s = Object.assign({ kind }, s0), hw = s.hw;
  let paint = opts.paint || (s.taxi ? '#e8b830' : kind === 'truck' ? (R() < 0.5 ? '#e6e2d8' : '#2e4a72') : VC.PAINT[Math.floor(R() * VC.PAINT.length)]);
  paint = VC.mix(paint, '#6a6458', R() * 0.12); // a little street grime on every car
  const trimC = VC.TRIM[Math.floor(R() * VC.TRIM.length)], vinyl = kind === 'sedan' && R() < 0.35, roofCol = vinyl ? VC.tone(paint, 0.55) : paint;
  s.hub = s.bump === 'chrome' || R() < 0.4 ? VC.CHROME : VC.tone(paint, 0.85);
  const bumpC = s.bump === 'chrome' ? VC.CHROME : s.bump === 'black' ? '#2a2a2e' : VC.tone(paint, 0.9);
  const glassC = [0.42, 0.56, 0.62, 0.42], hiC = [0.92, 0.97, 1.0, 0.55];
  const g = s.g, cabin = [g.C0 - 0.05, g.A0 + 0.05];
  // ---- lower body ----
  const body = vcLoft(M, s, paint, R, cabin), open = !!(s.bed || s.box); // pickup / truck: the loft is the cab + hood, the tail is the bed / box end
  const zN = s.st[s.st.length - 1][0], zT = s.bed ? s.bed[1] : s.box ? s.box[0] : s.st[0][0], hwN = hw * s.st[s.st.length - 1][1], hwT = open ? hw : hw * s.st[0][1];
  const yN = body.top(zN), yT = open ? 1.05 : body.top(zT);
  // ---- greenhouse ----
  const GH = vcGreenhouse(M, s, paint, body, roofCol, glassC, hiC);
  // ---- interior seen through the glass: dash, steering wheel, seat backs + headrests ----
  const yb = GH.yA, dz = g.A0 - 0.22;
  M.box(VC.tone(trimC, 0.45), 2 * GH.hb - 0.12, 0.16, 0.36, 0, yb + 0.02, dz);
  const sw = new THREE.TorusGeometry(0.17, 0.025, 4, 10); sw.rotateX(-0.9); sw.translate(0.37 * hw / 0.9, yb + 0.12, g.A0 - 0.48); M.geo(sw, VC.BLACK);
  M.beam(VC.BLACK, [0.37 * hw / 0.9, yb + 0.02, g.A0 - 0.32], [0.37 * hw / 0.9, yb + 0.1, g.A0 - 0.45], 0.04);
  s.rows.forEach((z, ri) => {
    const bench = ri > 0 || kind === 'pickup' || kind === 'truck', wid = 2 * GH.hb - 0.2;
    const backs = bench ? [[0, wid]] : [[0.36 * hw / 0.9, 0.52], [-0.36 * hw / 0.9, 0.52]];
    for (const [x, w] of backs) { M.box(trimC, w, 0.62, 0.13, x, yb + 0.06, z, { rx: -0.18 }); for (const hx of bench && w > 1 ? [-0.4, 0.4] : [0]) M.box(VC.tone(trimC, 0.85), 0.24, 0.16, 0.1, x + hx, yb + 0.44, z - 0.06); }
  });
  // ---- wheel wells (dark) + fender lips; tyres sit 3.5 cm proud of the body ----
  const wheels = [[1, s.zf, true], [-1, s.zf, true], [1, s.zr, false], [-1, s.zr, false]].map(([sx, z, front]) => ({ sx, x: sx * (hw + 0.035 - (s.kind === 'truck' ? 0.15 : 0.115)), y: s.r, z, r: s.r, front }));
  for (const w of wheels) { if (s.box && !w.front) continue; const x = w.sx * (hw + 0.022); M.disc(VC.DARK, s.r + 0.075, 10, x, s.r, w.z, w.sx, -0.15, Math.PI + 0.15); M.ring(VC.tone(paint, 0.72), s.r + 0.075, s.r + 0.11, 8, w.sx * (hw + 0.028), s.r, w.z, w.sx, -0.1, Math.PI + 0.1); }
  // ---- side details: door seams, handles, rub strip, mirrors ----
  const prof = (y) => { const ybb = s.yb, yt = body.top(0), ym = ybb + (yt - ybb) * 0.52; return y < ym ? hw + 0.015 * (y - ybb - 0.11) / (ym - ybb - 0.11) : hw + 0.015 - 0.019 * (y - ym) / (yt - 0.12 - ym); };
  const seamZ = [g.A0 - 0.06].concat(g.B).concat(g.we !== null && !s.bed && !s.box ? [g.we + 0.02] : []);
  for (const sx of [-1, 1]) {
    for (const z of seamZ) { if (Math.abs(z - s.zf) < s.r + 0.14 || Math.abs(z - s.zr) < s.r + 0.14) continue; const y0 = s.yb + 0.12, y2 = body.top(z) - 0.06, y1 = (y0 + y2) / 2;
      for (const [ya, yc] of [[y0, y1], [y1, y2]]) M.quad(VC.tone(paint, 0.45), [sx * (prof(ya) + 0.004), ya, z - 0.009], [sx * (prof(ya) + 0.004), ya, z + 0.009], [sx * (prof(yc) + 0.004), yc, z + 0.009], [sx * (prof(yc) + 0.004), yc, z - 0.009], [sx, 0, 0]); }
    const doors = [[g.A0 - 0.06, g.B.length ? g.B[0] : (g.we ?? g.C0)]].concat(g.B.length ? [[g.B[0], g.B[1] ?? g.we ?? g.C0]] : []);
    for (const [za, zb] of doors) { const yh = body.top(za) - 0.17; M.box(s.bump === 'chrome' ? VC.CHROME : VC.tone(paint, 0.6), 0.03, 0.035, 0.15, sx * (prof(yh) + 0.012), yh, Math.min(za, zb) + 0.18); }
    const yrub = body.top(0) - 0.2; M.beam(s.bump === 'chrome' ? VC.CHROME : '#2a2a2e', [sx * (prof(yrub) + 0.012), yrub, zT + 0.25], [sx * (prof(yrub) + 0.012), yrub, zN - 0.3], 0.03, false, 0.04);
    // mirror on a stalk at the A-pillar foot
    const my = GH.yA + 0.1, mz = g.A0 - 0.12; M.beam(VC.BLACK, [sx * (GH.hb + 0.02), my - 0.04, mz], [sx * (hw + 0.1), my, mz - 0.02], 0.035);
    M.box(s.bump === 'chrome' ? VC.CHROME : VC.tone(paint, 0.85), 0.07, 0.11, 0.15, sx * (hw + 0.13), my + 0.02, mz - 0.04, { ol: true });
  }
  // ---- nose: grille, lamps, bumper, plate ----
  const quadL = s.lamps === 'quad', lampW = { quad: 0.17, wide: 0.34, aero: 0.38 }[s.lamps] || 0.3, lx = hwN - 0.1 - lampW * (quadL ? 1.05 : 0.5), ly = yN - 0.17, gw = (quadL ? lx - lampW * 1.05 : lx - lampW / 2) - 0.03;
  M.box('#2a2a30', 2 * gw, 0.2, 0.04, 0, ly, zN + 0.01);
  for (let i = 0; i < 3; i++) M.box(s.bump === 'chrome' ? VC.CHROME : '#4a4a52', 2 * gw - 0.02, 0.02, 0.05, 0, ly - 0.07 + i * 0.07, zN + 0.015);
  if (s.bump === 'chrome') M.box(VC.CHROME, 2 * gw + 0.04, 0.24, 0.03, 0, ly, zN + 0.004);
  for (const sx of [-1, 1]) {
    const units = s.lamps === 'quad' ? [sx * (lx - lampW * 0.55), sx * (lx + lampW * 0.55)] : [sx * lx];
    for (const ux of units) { M.box(VC.CHROME, (s.lamps === 'quad' ? lampW : lampW) + 0.03, 0.15, 0.03, ux, ly, zN + 0.008); M.box('#f2eedc', (s.lamps === 'quad' ? lampW : lampW) - 0.02, 0.11, 0.04, ux, ly, zN + 0.014);
      const hx = ((s.lamps === 'quad' ? lampW : lampW) - 0.02) / 2; M.glow('#ffe6a0', [ux - hx, ly - 0.055, zN + 0.036], [ux + hx, ly - 0.055, zN + 0.036], [ux + hx, ly + 0.055, zN + 0.036], [ux - hx, ly + 0.055, zN + 0.036], [0, 0, 1]); }
    M.box('#e89a3a', 0.12, 0.06, 0.04, sx * (hwN - 0.1), ly - 0.13, zN + 0.01); // amber parking light
  }
  const bY = s.yb + 0.16, bumpD = s.bump === 'chrome' ? 0.14 : 0.16;
  M.box(bumpC, 2 * hwN + 0.04, 0.15, bumpD, 0, bY, zN + 0.03, { ol: true }); for (const sx of [-1, 1]) M.box(bumpC, 0.14, 0.15, 0.42, sx * (hwN + 0.02), bY, zN - 0.12, { ry: sx * 0.25, ol: true });
  const plate = (z, dir) => { const y = bY + (dir > 0 ? 0.01 : 0.2), zz = z + dir * 0.004; M.quad('#e8e6dc', [-0.17, y - 0.085, zz], [0.17, y - 0.085, zz], [0.17, y + 0.085, zz], [-0.17, y + 0.085, zz], [0, 0, dir]);
    M.quad('#2f5bd3', [-0.16, y + 0.045, zz + dir * 0.002], [0.16, y + 0.045, zz + dir * 0.002], [0.16, y + 0.075, zz + dir * 0.002], [-0.16, y + 0.075, zz + dir * 0.002], [0, 0, dir]);
    for (let i = 0; i < 6; i++) { const cx = -0.125 + i * 0.05 + (i > 2 ? 0.01 : 0); M.quad(VC.BLACK, [cx - 0.016, y - 0.055, zz + dir * 0.003], [cx + 0.016, y - 0.055, zz + dir * 0.003], [cx + 0.016, y + 0.02, zz + dir * 0.003], [cx - 0.016, y + 0.02, zz + dir * 0.003], [0, 0, dir]); } };
  plate(zN + 0.03 + bumpD / 2, 1);
  // ---- tail: lamps, bumper, plate, trunk / hatch seam ----
  const tY = yT - 0.15, tW = kind === 'hatch' || kind === 'minivan' ? 0.22 : 0.4;
  if (!open) for (const sx of [-1, 1]) { const tx = sx * (hwT - 0.06 - tW / 2); M.box('#7a1a1a', tW + 0.02, 0.17, 0.04, tx, tY, zT - 0.012); M.box('#d8303a', tW - 0.02, 0.13, 0.04, tx, tY, zT - 0.02);
    M.glow('#ff2a1a', [tx - tW / 2 + 0.01, tY - 0.06, zT - 0.042], [tx + tW / 2 - 0.01, tY - 0.06, zT - 0.042], [tx + tW / 2 - 0.01, tY + 0.06, zT - 0.042], [tx - tW / 2 + 0.01, tY + 0.06, zT - 0.042], [0, 0, -1]);
    M.box('#eeeeee', 0.07, 0.07, 0.04, sx * (hwT - 0.1 - tW), tY, zT - 0.012); }
  M.box(bumpC, 2 * hwT + 0.04, 0.15, bumpD, 0, bY, zT - 0.03, { ol: true }); for (const sx of [-1, 1]) M.box(bumpC, 0.14, 0.15, 0.4, sx * (hwT + 0.02), bY, zT + 0.12, { ry: -sx * 0.25, ol: true });
  plate(zT - 0.004, -1);
  if (!s.bed && !s.box && g.C0 - zT > 0.3) M.quad(VC.tone(paint, 0.45), [-hwT + 0.12, yT - 0.035, zT - 0.003], [hwT - 0.12, yT - 0.035, zT - 0.003], [hwT - 0.12, yT - 0.02, zT - 0.003], [-hwT + 0.12, yT - 0.02, zT - 0.003], [0, 0, -1]);
  // ---- kind extras ----
  if (s.rails) for (const sx of [-1, 1]) { M.beam(VC.BLACK, [sx * (g.rw - 0.1), g.yr + 0.1, g.A1 - 0.25], [sx * (g.rw - 0.1), g.yr + 0.1, g.C1 + 0.2], 0.04); for (const z of [g.A1 - 0.3, g.C1 + 0.25]) M.box(VC.BLACK, 0.05, 0.08, 0.06, sx * (g.rw - 0.1), g.yr + 0.06, z); }
  if (s.taxi) { // roof sign (lit at night) + checker band
    const zs = (g.A1 + g.C1) / 2 + 0.1, ys = g.yr + 0.045; M.box('#f2efe6', 0.62, 0.22, 0.24, 0, ys + 0.13, zs, { ol: true }); M.box(VC.BLACK, 0.66, 0.04, 0.28, 0, ys + 0.02, zs);
    for (const dir of [1, -1]) { const z = zs + dir * 0.122; M.glow('#fff2c0', [-0.28, ys + 0.04, z], [0.28, ys + 0.04, z], [0.28, ys + 0.22, z], [-0.28, ys + 0.22, z], [0, 0, dir]);
      const L = [[-0.22, 0.04, 0.06], [-0.19, 0.04, 0.012], [-0.09, 0.04, 0.06], [-0.04, 0.012, 0.06], [-0.065, 0.04, 0.012], [0.02, 0.012, 0.06], [0.06, 0.012, 0.06], [0.17, 0.012, 0.06]];
      for (const [x, w, h] of L) M.quad('#2a2420', [dir * x - w / 2, ys + 0.13 - h / 2, z + dir * 0.002], [dir * x + w / 2, ys + 0.13 - h / 2, z + dir * 0.002], [dir * x + w / 2, ys + 0.13 + h / 2, z + dir * 0.002], [dir * x - w / 2, ys + 0.13 + h / 2, z + dir * 0.002], [0, 0, dir]); }
    const yc = body.top(0) - 0.32; for (const sx of [-1, 1]) for (let i = 0; i < 16; i++) { const z0 = g.A0 - 0.1 - i * 0.12; if (z0 - 0.12 < g.C0 + 0.05) break; for (const row of [0, 1]) if ((i + row) % 2 === 0) { const y0 = yc + row * 0.06, x = sx * (prof(y0 + 0.03) + 0.005);
      M.quad(VC.BLACK, [x, y0, z0 - 0.12], [x, y0, z0], [x, y0 + 0.06, z0], [x, y0 + 0.06, z0 - 0.12], [sx, 0, 0]); } }
  }
  if (s.bed) { // pickup bed: open box behind the cab
    const [z1, z0] = [s.bed[0], s.bed[1]], yt = 1.05, fl = 0.78;
    M.box(VC.tone(paint, 0.9), 2 * hw - 0.16, 0.04, z1 - z0, 0, fl, (z0 + z1) / 2);
    for (const sx of [-1, 1]) { M.box(paint, 0.09, yt - s.yb, z1 - z0, sx * (hw - 0.045), (yt + s.yb) / 2, (z0 + z1) / 2, { ol: true }); M.box(VC.tone(paint, 1.08), 0.13, 0.04, z1 - z0, sx * (hw - 0.05), yt + 0.02, (z0 + z1) / 2); }
    M.box(paint, 2 * hw, yt - s.yb, 0.09, 0, (yt + s.yb) / 2, z0 + 0.045, { ol: true }); M.box(VC.tone(paint, 0.85), 2 * hw - 0.2, 0.15, 0.1, 0, fl + 0.08, z1 + 0.04);
    M.box(VC.UNDER, 2 * hw - 0.2, 0.06, z1 - z0, 0, s.yb + 0.03, (z0 + z1) / 2);
    const tz = z0, ty = yt - 0.14; for (const sx of [-1, 1]) { const tx = sx * (hw - 0.12); M.box('#d8303a', 0.14, 0.28, 0.04, tx, ty - 0.08, tz - 0.012); M.glow('#ff2a1a', [tx - 0.06, ty - 0.21, tz - 0.035], [tx + 0.06, ty - 0.21, tz - 0.035], [tx + 0.06, ty + 0.05, tz - 0.035], [tx - 0.06, ty + 0.05, tz - 0.035], [0, 0, -1]); }
  }
  if (s.box) { // box truck: cargo box with liveries, roll-up door, marker lights
    const [z0, z1] = s.box, y0 = 1.02, y1 = 3.25, bw = 1.15, boxC = opts.boxColor || (paint === '#2e4a72' ? '#3a5a8a' : '#eae6dc');
    M.box(boxC, 2 * bw, y1 - y0, z1 - z0, 0, (y0 + y1) / 2, (z0 + z1) / 2, { ol: true }); M.box(VC.tone(boxC, 0.8), 2 * bw + 0.04, 0.08, z1 - z0 + 0.04, 0, y1 - 0.02, (z0 + z1) / 2);
    M.box('#2a2a2e', 2 * hw - 0.5, 0.3, z1 - z0, 0, 0.86, (z0 + z1) / 2); for (const sx of [-1, 1]) M.box('#1e1e22', 0.4, 0.5, 0.04, sx * (bw - 0.25), 0.55, s.zr - s.r - 0.12); // chassis rail + mud flaps for (const x of [-0.6, 0, 0.6]) M.box(VC.tone('#8a8a90', 0.8), 0.04, 2.1, 0.03, x, 1.95, z0 - 0.012);
    for (let i = 0; i < 9; i++) M.box(VC.tone(boxC, 0.85), 2 * bw - 0.16, 0.025, 0.02, 0, 1.15 + i * 0.22, z0 - 0.02);
    for (const sx of [-1, 1]) { for (const z of [z0 + 0.3, z1 - 0.3]) { M.box('#e89a3a', 0.04, 0.06, 0.08, sx * (bw + 0.01), y1 - 0.2, z); M.glow('#ffa040', [sx * (bw + 0.032), y1 - 0.23, z - 0.04], [sx * (bw + 0.032), y1 - 0.23, z + 0.04], [sx * (bw + 0.032), y1 - 0.17, z + 0.04], [sx * (bw + 0.032), y1 - 0.17, z - 0.04], [sx, 0, 0]); } const tx = sx * (bw - 0.14); M.box('#d8303a', 0.18, 0.3, 0.04, tx, 1.18, z0 - 0.02);
      M.glow('#ff2a1a', [tx - 0.08, 1.04, z0 - 0.045], [tx + 0.08, 1.04, z0 - 0.045], [tx + 0.08, 1.32, z0 - 0.045], [tx - 0.08, 1.32, z0 - 0.045], [0, 0, -1]); }
    s.livery = opts.livery || (R() < 0.5 ? 'utz' : 'move'); if (s.livery === 'utz' && !opts.boxColor) { /* white box carries the Utz-style livery */ }
    for (const sx of [-1, 1]) M.D.push({ g: new THREE.PlaneGeometry(4.0, 4.0 * 112 / 320).rotateY(sx * Math.PI / 2).translate(sx * (bw + 0.012), 2.15, (z0 + z1) / 2), tile: s.livery === 'utz' ? 'truck_utz' : 'truck_move' });
  }
  const seats = s.rows.slice(0, kind === 'pickup' || kind === 'truck' ? 1 : 2).flatMap((z, ri) => (ri === 0 ? [[0.36 * hw / 0.9, z + 0.3, 'left'], [-0.36 * hw / 0.9, z + 0.3, 'right']] : [[0.4 * hw / 0.9, z + 0.3, 'rear-left'], [-0.4 * hw / 0.9, z + 0.3, 'rear-right']]).map(([x, sz, side]) => ({ x, y: GH.yA - 0.38, z: sz, ang: 0, pose: 'sit', side })));
  const height = s.box ? 3.25 : (s.taxi ? g.yr + 0.3 : g.yr + 0.05), len = Math.max(zN + 0.1, -zT + 0.1) * 2;
  return { M, s, wheels, seats, collider: { w: +(2 * hw + 0.1).toFixed(2), l: +len.toFixed(2), h: +height.toFixed(2) } };
}

// write a model's layers into an `out` collector; fin(g) places a car-space geometry (identity for a drivable car, the street pose for a parked one)
function vcEmit(K, out, Mo, fin, A) {
  const M = Mo.M;
  for (const B of M.S.values()) out.solid(fin(M.geom(B.P, B.N)), B.col, B.ol);
  for (const [col, B] of M.L) out.glow(fin(M.geom(B.P, B.N)), col);
  if (M.G.P.length) { const g = fin(M.geom(M.G.P, M.G.N, M.G.C)); if (out.glass) out.glass(g); else { g.deleteAttribute('color'); out.solid(g, '#5f7e8c', false); } }
  if (A) for (const d of M.D) { const g = fin(d.g); out.decal(g, A, d.tile); }
}

// ---------------------------------------------------------------- drivable vehicles: one static body + three wheel meshes
function vcVehicle(K, opts, kind) {
  const THREE = K.THREE, A = VC.atlas(K, opts), out = K.makeOut(), Mo = vcModel(K, kind, opts), s = Mo.s;
  let glassMesh = null; if (K.glassMat) out.glass = (g) => { glassMesh = new THREE.Mesh(g, K.glassMat); glassMesh.renderOrder = 3; };
  vcEmit(K, out, Mo, (g) => g, A);
  const root = new THREE.Group(), bob = new THREE.Group(); root.add(bob); bob.add(out.build()); if (glassMesh) bob.add(glassMesh);
  const mat = K.toonMat(), merge = (list) => { const P = [], N = [], C = []; for (const [g0, col] of list) { const g = g0.index ? g0.toNonIndexed() : g0, c = new THREE.Color(col), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(c.r, c.g, c.b); } }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); m.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); m.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 3)); return m; };
  const wheels = [];
  for (const w of Mo.wheels.filter((q) => q.front)) { const steer = new THREE.Group(); steer.position.set(w.x, w.y, w.z); const mesh = new THREE.Mesh(merge(vcWheelParts(THREE, s, w.sx, false)), mat); mesh.castShadow = true; steer.add(mesh); bob.add(steer); wheels.push({ steer, mesh, r: w.r, front: true }); }
  { const rr = Mo.wheels.filter((q) => !q.front), list = []; for (const w of rr) for (const [g, c] of vcWheelParts(THREE, s, w.sx, false)) list.push([g.translate(w.x, 0, 0), c]);
    const steer = new THREE.Group(); steer.position.set(0, rr[0].y, rr[0].z); const mesh = new THREE.Mesh(merge(list), mat); mesh.castShadow = true; steer.add(mesh); bob.add(steer); wheels.push({ steer, mesh, r: rr[0].r, front: false }); }
  const roll = kind === 'truck' ? 0.003 : 0.004, bounce = kind === 'truck' ? 0.008 : 0.006, bf = kind === 'truck' ? 7 : 9;
  return {
    root, kind: 'car', seats: Mo.seats, collider: Mo.collider, waterline: 0, parts: { bob, wheels }, model: kind,
    animate(v, dt, speed = 0, steerIn = 0, t = 0) {
      for (let i = 0; i < wheels.length; i++) { const w = wheels[i]; w.mesh.rotation.x += (speed * dt) / w.r; if (w.front) w.steer.rotation.y = Math.max(-1, Math.min(1, steerIn)) * 0.5; }
      bob.rotation.z = steerIn * Math.min(Math.abs(speed), 8) * roll; // the body rolls OUT of the turn (nit fixed: it used to lean in)
      bob.position.y = Math.abs(speed) > 0.1 ? Math.sin(t * bf) * bounce : 0;
    },
  };
}
function buildCarSedan(K, opts = {}) { return vcVehicle(K, opts, 'sedan'); }
function buildCarHatch(K, opts = {}) { return vcVehicle(K, opts, 'hatch'); }
function buildCarWagon(K, opts = {}) { return vcVehicle(K, opts, 'wagon'); }
function buildCarMinivan(K, opts = {}) { return vcVehicle(K, opts, 'minivan'); }
function buildCarPickup(K, opts = {}) { return vcVehicle(K, opts, 'pickup'); }
function buildCarCab(K, opts = {}) { return vcVehicle(K, opts, 'cab'); }
function buildBoxTruck(K, opts = {}) { return vcVehicle(K, opts, 'truck'); }

// ---------------------------------------------------------------- static parked cars (merged into the chunk through `out`, base on the road y = 0)
const VC_PARKED = { sedan: 'parked_car_sedan', hatch: 'parked_car_hatchback', pickup: 'parked_car_pickup', wagon: 'parked_car_wagon', minivan: 'parked_car_minivan', cab: 'parked_car_cab' };
function buildParkedCar(K, out, x, z, ang = 0, opts = {}) {
  const THREE = K.THREE, kind = VC_PARKED[opts.kind] ? opts.kind : 'sedan', Mo = vcModel(K, kind, opts), s = Mo.s, fin = (g) => K.place(g, x, 0, z, ang);
  vcEmit(K, out, Mo, fin, null);
  // static wheels (cheap: no spin dimples), merged per colour
  const byCol = new Map(); for (const w of Mo.wheels) for (const [g, c] of vcWheelParts(THREE, s, w.sx, true)) { g.translate(w.x, w.y, w.z); (byCol.get(c) || byCol.set(c, []).get(c)).push(g); }
  for (const [c, list] of byCol) for (const g of list) out.solid(fin(g), c, false);
  const hw = Mo.collider.w / 2, hl = Mo.collider.l / 2, p = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([a, b]) => [x + a * Math.cos(ang) + b * Math.sin(ang), z - a * Math.sin(ang) + b * Math.cos(ang)]);
  const bb = { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) };
  out.coll(bb); if (out.bld) out.bld(Object.assign({ h: Mo.collider.h }, bb));
  return Object.assign({ collider: Mo.collider }, META_VEH_CARS.pieces[VC_PARKED[kind]]);
}
function buildParkedCarSedan(K, out, x, z, ang = 0, opts = {}) { return buildParkedCar(K, out, x, z, ang, Object.assign({}, opts, { kind: 'sedan' })); }
function buildParkedCarHatchback(K, out, x, z, ang = 0, opts = {}) { return buildParkedCar(K, out, x, z, ang, Object.assign({}, opts, { kind: 'hatch' })); }
function buildParkedCarPickup(K, out, x, z, ang = 0, opts = {}) { return buildParkedCar(K, out, x, z, ang, Object.assign({}, opts, { kind: 'pickup' })); }
const VC_KINDS = ['sedan', 'hatch', 'wagon', 'minivan', 'pickup', 'cab'];

// ---- vendor/taskAB/veh_boats.js ----
// veh_boats.js — Task B: rideable boats: water_taxi (~9 m covered harbour launch), paddle_boat (two-seat swan pedal boat), dragon_boat (~12 m racing boat).
// Hulls are lofted from a few stations into flat-shaded shells (outer skin, inner skin and gunwale rim, so open boats look right from above).
// Each vehicle is root > bob > [ merged static body (out.build(): toon + ink hull + glow + decal), moving parts ]. The game owns `root`
// (position / yaw); animate() only moves `bob` (bobbing on the water) and the moving parts. The dragon boat's 20 paddles are ONE mesh whose
// vertices are rotated about each paddle's own shoulder every frame (a few hundred vertices: cheap), so the whole boat is 4 meshes.
// Contract: buildXxx(K, opts) -> { root, kind:'boat', seats, collider, waterline, animate(v, dt, speed, steer, t) }. Facing +Z; `waterline` is the local
// y that sits on the water surface (K.WY), so root.position.y = WY - waterline. steer > 0 turns left (+X). Seat anchors: 'sit' = hips, 'stand' = feet.
// Real flavour: harbour water-taxi lettering and colours (white hull, navy stripe, gold band, blue block letters) redrawn on canvas, no logo files.
// No imports; no Math.random; materials only through K.makeOut / K.toonMat. opts.atlas = K.makeAtlas(PROP_TILES) (else the PROP_TILES global).
const META_VEH_BOATS = {
  id: 'veh_boats', kind: 'vehicle',
  pieces: { water_taxi: { id: 'water_taxi', kind: 'boat', length: 9.2, beam: 2.9 }, paddle_boat: { id: 'paddle_boat', kind: 'boat', length: 3.4, beam: 1.7 }, dragon_boat: { id: 'dragon_boat', kind: 'boat', length: 13.6, beam: 1.2 } },
};

const VB = {
  IRON: '#2c322e', GLASS: '#6a8a9a', DARK: '#1a1626', CREAM: '#eae6dc', NAVY: '#2a3f6a', GOLD: '#e8b830', RED: '#b8302a', WOOD: '#9a6a44',
  tone: (h, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''),
  atlas(K, opts) { return tbPropAtlas(K, opts, 'veh_boats'); },
  box(THREE, w, h, d, skip = '') { const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }; if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); } return g; },
  // lofted hull shell. st = [{ z, hw, y0, y1, c, w }] stern -> bow. Returns flat-shaded pieces: { low, high, inner, rim, stern } (BufferGeometry each)
  shell(THREE, st, th = 0.07) {
    const mk = () => ({ P: [] }), low = mk(), high = mk(), inner = mk(), rim = mk(), stern = mk();
    const sec = (s, k, side) => { const hw = Math.max(0.0, s.hw - k), y0 = s.y0 + (k ? k * 0.8 : 0), y1 = s.y1; return [[0, y0, s.z], [side * hw * (s.w ?? 0.7), y0 + (y1 - y0) * (s.c ?? 0.32), s.z], [side * hw, y1, s.z]]; };
    const tri = (G, a, b, c, hint) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) G.P.push(...a, ...c, ...b); else G.P.push(...a, ...b, ...c); };
    const quad = (G, a, b, c, d, hint) => { tri(G, a, b, c, hint); tri(G, a, c, d, hint); };
    for (let i = 0; i + 1 < st.length; i++) for (const side of [-1, 1]) for (let j = 0; j < 2; j++) {
      const A = sec(st[i], 0, side), B = sec(st[i + 1], 0, side), hint = j === 0 ? [side * 0.6, -0.8, 0] : [side, 0.15, 0];
      quad(j === 0 ? low : high, A[j], A[j + 1], B[j + 1], B[j], hint);
      const Ai = sec(st[i], th, side), Bi = sec(st[i + 1], th, side); quad(inner, Ai[j], Ai[j + 1], Bi[j + 1], Bi[j], [-side * 0.6, 0.8, 0]);
    }
    for (let i = 0; i + 1 < st.length; i++) for (const side of [-1, 1]) { const A = sec(st[i], 0, side)[2], B = sec(st[i + 1], 0, side)[2], Ai = sec(st[i], th, side)[2], Bi = sec(st[i + 1], th, side)[2]; quad(rim, A, B, Bi, Ai, [0, 1, 0]); }
    const s0 = st[0]; const o = [sec(s0, 0, -1)[2], sec(s0, 0, -1)[1], sec(s0, 0, 1)[1], sec(s0, 0, 1)[2]], ii = [sec(s0, th, -1)[2], sec(s0, th, -1)[1], sec(s0, th, 1)[1], sec(s0, th, 1)[2]];
    quad(stern, o[0], o[3], o[2], o[1], [0, 0, -1]); quad(stern, ii[0], ii[3], ii[2], ii[1], [0, 0, 1]); quad(stern, o[3], o[0], ii[0], ii[3], [0, 1, 0]);
    const out = {}; for (const [k, G] of Object.entries({ low, high, inner, rim, stern })) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(G.P), 3)); g.computeVertexNormals(); out[k] = g; }
    return out;
  },
  // a flat top-view polygon [[x, z], ...] raised to height h, bottom at y0
  skin(st, z) { let i = 0; while (i + 2 < st.length && z > st[i + 1].z) i++; const a = st[i], b = st[i + 1], t = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z))), L = (p, q) => p + (q - p) * t; return { hw: L(a.hw, b.hw), y0: L(a.y0, b.y0), y1: L(a.y1, b.y1), c: L(a.c ?? 0.32, b.c ?? 0.32), w: L(a.w ?? 0.7, b.w ?? 0.7) }; },
  slab(THREE, pts, y0, h) { const shp = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? shp.lineTo(x, -z) : shp.moveTo(x, -z))); const g = new THREE.ExtrudeGeometry(shp, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g; },
  quad(THREE, a, b, c, d, hint) { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const P = n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0 ? [a, c, b, a, d, c] : [a, b, c, a, c, d]; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.flat()), 3)); g.computeVertexNormals(); return g; },
  merge(THREE, list) { const P = [], N = [], Cc = []; for (const [g0, col] of list) { const g = g0.index ? g0.toNonIndexed() : g0, c = new THREE.Color(col), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); Cc.push(c.r, c.g, c.b); } } const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); m.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); m.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Cc), 3)); return m; },
  shape(K, out) { const THREE = K.THREE, s = (g, col, ol = false) => out.solid(g, col, ol), B = (w, h, d, x, y, z, col, o = {}) => { const g = VB.box(THREE, w, h, d, o.skip); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); };
    const C = (rt, rb, h, seg, x, y, z, col, o = {}) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); };
    const Sp = (r, ws, hs, sx, sy, sz, x, y, z, col, o = {}) => { const g = new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); };
    const T = (p0, p1, r0, r1, seg, col, o = {}) => { const d = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), len = d.length(), g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); out.solid(g.translate((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2), col, !!o.ol); };
    const GL = (g, col) => out.glow(g, col); return { THREE, s, B, C, Sp, T, GL }; },
  assemble(K, out) { const THREE = K.THREE, root = new THREE.Group(), bob = new THREE.Group(); root.add(bob); bob.add(out.build()); return { root, bob }; },
};

// centre the whole vehicle on its bounding box along Z (so `collider` is a centred box that matches the visible hull) and report that box
function vbFit(THREE, bob, seats, ov = {}) {
  const b = new THREE.Box3().setFromObject(bob), cz = (b.min.z + b.max.z) / 2, body = new THREE.Group();
  [...bob.children].forEach((c) => body.add(c)); body.position.z = -cz; bob.add(body); seats.forEach((s) => { s.z -= cz; });
  const r = (v) => Math.round(v * 100) / 100; return { w: ov.w ?? r(b.max.x - b.min.x), l: r(b.max.z - b.min.z), h: ov.h ?? r(b.max.y) };
}

const vbBob = (bob, t, speed, steer, k = 1) => { bob.position.y = Math.sin(t * 1.7) * 0.035 * k; bob.rotation.z = Math.sin(t * 1.15) * 0.018 * k - steer * Math.min(Math.abs(speed), 8) * 0.004; bob.rotation.x = Math.sin(t * 1.35 + 1) * 0.012 * k - Math.min(Math.abs(speed), 8) * 0.004; };

// ---------------------------------------------------------------- water taxi
function buildWaterTaxi(K, opts = {}) {
  const A = VB.atlas(K, opts), out = K.makeOut(), { THREE, s, B, C, GL } = VB.shape(K, out), WHITE = VB.CREAM, YEL = VB.GOLD;
  const st = [{ z: -4.5, hw: 1.05, y0: 0.14, y1: 1.0 }, { z: -3.8, hw: 1.3, y0: 0.06, y1: 1.0 }, { z: -2.0, hw: 1.4, y0: 0.0, y1: 1.0 }, { z: 0, hw: 1.42, y0: 0.0, y1: 1.0 }, { z: 2.0, hw: 1.35, y0: 0.02, y1: 1.02 }, { z: 3.3, hw: 1.05, y0: 0.08, y1: 1.08 }, { z: 4.1, hw: 0.6, y0: 0.2, y1: 1.16 }, { z: 4.6, hw: 0.05, y0: 0.5, y1: 1.24 }];
  const sh = VB.shell(THREE, st, 0.08); s(sh.low, VB.NAVY, true); s(sh.high, WHITE, true); s(sh.inner, VB.tone(WHITE, 0.8)); s(sh.rim, YEL); s(sh.stern, WHITE);
  s(VB.slab(THREE, [[-1.2, -4.2], [1.2, -4.2], [1.28, 2.6], [1.0, 3.2], [0.55, 4.0], [0, 4.45], [-0.55, 4.0], [-1.0, 3.2], [-1.28, 2.6]], 0.86, 0.06), '#9a8a74');            // deck
  for (const sx of [-1, 1]) {
    B(0.1, 0.95, 5.7, sx * 1.22, 1.45, -0.9, WHITE, { skip: 'ny', ol: true });                                                                                                   // lower cabin wall
    out.decal(new THREE.PlaneGeometry(3.8, 0.95).rotateY(sx * Math.PI / 2).translate(sx * 1.28, 1.45, -0.9), A, 'taxi_side');
    for (let i = 0; i < 6; i++) { const z = -3.45 + i * 1.0; B(0.12, 0.68, 0.12, sx * 1.22, 2.26, z, WHITE, { skip: 'ny' }); }
    for (let i = 0; i < 5; i++) { const z = -2.95 + i * 1.0, g = VB.quad(THREE, [sx * 1.255, 1.95, z - 0.4], [sx * 1.255, 1.95, z + 0.4], [sx * 1.255, 2.58, z + 0.4], [sx * 1.255, 2.58, z - 0.4], [sx, 0, 0]); s(g, VB.GLASS); GL(g.clone().translate(sx * 0.012, 0, 0), '#ffe08a'); }
    B(0.45, 0.45, 4.4, sx * 0.95, 1.1, -1.2, VB.tone(VB.NAVY, 1.2), { skip: 'ny' }); B(0.07, 0.55, 4.4, sx * 1.12, 1.62, -1.2, VB.tone(VB.NAVY, 1.4), { skip: 'ny' });  // benches
    C(0.1, 0.1, 7.4, 6, sx * 1.46, 0.9, 0.1, '#22222a', { open: true, rot: [Math.PI / 2, 0, 0] });                                                                            // rubber fender
  }
  B(2.7, 0.1, 6.1, 0, 2.66, -0.95, YEL, { skip: 'ny', ol: true }); B(2.5, 0.06, 0.1, 0, 2.55, 2.0, WHITE, { skip: 'ny' });
  B(2.45, 0.95, 0.1, 0, 1.45, 2.0, WHITE, { skip: 'ny', ol: true }); out.decal(new THREE.PlaneGeometry(2.0, 1.0).translate(0, 1.45, 2.056), A, 'taxi_bow');
  B(2.45, 0.95, 0.1, 0, 1.45, -3.85, WHITE, { skip: 'ny' });
  const wsh = VB.quad(THREE, [-1.2, 1.95, 2.0], [1.2, 1.95, 2.0], [1.2, 2.6, 1.9], [-1.2, 2.6, 1.9], [0, 0.3, 1]); s(wsh, VB.GLASS); GL(wsh.clone().translate(0, 0, 0.012), '#ffe08a');
  B(1.2, 0.75, 0.55, -0.45, 1.3, 1.5, VB.tone(VB.NAVY, 0.9), { skip: 'ny', ol: true }); B(0.7, 0.04, 0.3, -0.45, 1.71, 1.45, '#3a5a8a');                                   // console
  for (const [px, pz] of [[-1.0, 1.75], [0.0, 1.75]]) GL(new THREE.PlaneGeometry(0.12, 0.08).rotateX(-Math.PI / 2).translate(px, 1.74, pz), '#ffbf3c');
  s(new THREE.TorusGeometry(0.17, 0.022, 5, 10).rotateX(Math.PI * 0.3).translate(-0.5, 1.9, 1.25), VB.IRON);                                                              // steering wheel is a moving part (below); this ring is the binnacle
  C(0.04, 0.05, 1.3, 6, 0.0, 3.3, -2.0, VB.IRON, { open: true }); GL(new THREE.OctahedronGeometry(0.09, 0).translate(0, 3.98, -2.0), '#ffe08a');                          // mast + masthead light
  s(new THREE.TorusGeometry(0.2, 0.06, 5, 10).translate(0, 1.8, -3.93), VB.RED);                                                                                           // life ring
  for (const sx of [-1, 1]) { const rp = [[0.98, 2.8], [0.88, 3.25], [0.64, 3.7]]; rp.forEach(([x, z]) => B(0.05, 0.62, 0.05, sx * x, 1.2, z, VB.IRON, { skip: 'ny' })); B(0.04, 0.04, 1.0, sx * 0.93, 1.52, 3.05, VB.IRON, { rot: [0, sx * 0.4, 0] }); B(0.04, 0.04, 0.7, sx * 0.76, 1.52, 3.5, VB.IRON, { rot: [0, sx * 0.62, 0] }); }
  GL(new THREE.OctahedronGeometry(0.09, 0).translate(1.05, 1.25, 3.2), '#ff3a1c'); GL(new THREE.OctahedronGeometry(0.09, 0).translate(-1.05, 1.25, 3.2), '#23c26b');  // port red / starboard green
  GL(new THREE.PlaneGeometry(0.5, 0.18).translate(0, 2.35, 2.03), '#ffe08a');                                                                                               // headlamp
  const { root, bob } = VB.assemble(K, out), mat = K.toonMat(), wheel = new THREE.Mesh(VB.merge(THREE, [[new THREE.TorusGeometry(0.2, 0.025, 5, 12), VB.WOOD], ...[0, 1, 2, 3].map((i) => [VB.box(THREE, 0.03, 0.4, 0.03).rotateZ((i * Math.PI) / 4), VB.WOOD])]), mat);
  wheel.position.set(-0.5, 1.88, 1.2); wheel.rotation.x = -0.9; wheel.castShadow = true; bob.add(wheel);
  const seats = [{ x: -0.5, y: 0.9, z: 0.8, ang: 0, pose: 'stand' }, { x: 0.95, y: 1.38, z: -0.4, ang: -Math.PI / 2, pose: 'sit' }, { x: 0.95, y: 1.38, z: -1.7, ang: -Math.PI / 2, pose: 'sit' }, { x: -0.95, y: 1.38, z: -1.0, ang: Math.PI / 2, pose: 'sit' }], collider = vbFit(THREE, bob, seats, { w: 3.0, h: 2.75 });
  return {
    root, kind: 'boat', waterline: 0.35, collider, parts: { bob, wheel }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) { vbBob(bob, t, speed, steer); wheel.rotation.z = -steer * 1.4; },
  };
}

// ---------------------------------------------------------------- swan pedal boat (two seats)
function buildPaddleBoat(K, opts = {}) {
  const out = K.makeOut(), { THREE, s, B, C, Sp, T, GL } = VB.shape(K, out), WHITE = VB.CREAM, paint = opts.paint || '#eae6dc';
  const st = [{ z: -1.7, hw: 0.7, y0: 0.18, y1: 0.78, c: 0.4, w: 0.8 }, { z: -1.0, hw: 0.88, y0: 0.05, y1: 0.78, c: 0.4, w: 0.8 }, { z: 0, hw: 0.9, y0: 0.0, y1: 0.78, c: 0.4, w: 0.8 }, { z: 0.9, hw: 0.8, y0: 0.04, y1: 0.8, c: 0.4, w: 0.8 }, { z: 1.5, hw: 0.45, y0: 0.18, y1: 0.86, c: 0.4, w: 0.8 }, { z: 1.78, hw: 0.08, y0: 0.4, y1: 0.92 }];
  const sh = VB.shell(THREE, st, 0.07); s(sh.low, '#9ab0b8', true); s(sh.high, paint, true); s(sh.inner, VB.tone(paint, 0.8)); s(sh.rim, VB.GOLD); s(sh.stern, paint);
  for (const sx of [-1, 1]) Sp(0.5, 8, 5, 0.22, 0.55, 1.15, sx * 0.84, 1.0, -0.3, paint, { rot: [0.0, 0, sx * 0.45], ol: true });                                                        // wings
  const nk = [[0, 0.8, 1.2, 0.22], [0, 1.25, 1.62, 0.18], [0, 1.68, 1.72, 0.15], [0, 2.0, 1.55, 0.13]];
  for (let i = 0; i + 1 < nk.length; i++) { T(nk[i].slice(0, 3), nk[i + 1].slice(0, 3), nk[i][3], nk[i + 1][3], 7, paint, { ol: true }); Sp(nk[i + 1][3] * 1.02, 7, 5, 1, 1, 1, nk[i + 1][0], nk[i + 1][1], nk[i + 1][2], paint); }
  Sp(0.19, 8, 6, 1, 0.9, 1.15, 0, 2.15, 1.58, paint, { ol: true }); C(0.01, 0.08, 0.3, 6, 0, 2.1, 1.84, '#ff9f1c', { rot: [Math.PI / 2, 0, 0] });
  for (const sx of [-1, 1]) Sp(0.04, 5, 4, 1, 1, 1, sx * 0.13, 2.22, 1.68, VB.DARK);
  C(0.02, 0.13, 0.7, 6, 0, 1.15, -1.9, paint, { rot: [-1.0, 0, 0] });                                                                                                       // upturned tail
  B(1.5, 0.08, 0.4, 0, 0.6, -0.3, VB.tone(paint, 0.85), { skip: 'ny' }); B(1.5, 0.45, 0.07, 0, 0.88, -0.55, VB.tone(paint, 0.85), { skip: 'ny' });                              // bench + backrest
  B(0.6, 0.18, 0.5, 0, 0.5, 0.7, VB.tone(paint, 0.7), { skip: 'ny' });
  GL(new THREE.OctahedronGeometry(0.08, 0).translate(0, 2.4, 1.6), '#ffe08a');
  const { root, bob } = VB.assemble(K, out), mat = K.toonMat();
  const wheelG = VB.merge(THREE, [[new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6).rotateZ(Math.PI / 2), VB.IRON], ...[0, 1, 2, 3, 4, 5].map((i) => [VB.box(THREE, 0.7, 0.34, 0.05).rotateX((i * Math.PI) / 3 + 0.2).translate(0, 0, 0), VB.RED])]);
  const wheel = new THREE.Mesh(wheelG, mat); wheel.position.set(0, 0.5, -1.65); wheel.castShadow = true; bob.add(wheel);
  const crank = new THREE.Mesh(VB.merge(THREE, [[new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6).rotateZ(Math.PI / 2), VB.IRON], [VB.box(THREE, 0.08, 0.3, 0.04).translate(-0.3, 0.15, 0), VB.IRON], [VB.box(THREE, 0.08, 0.3, 0.04).translate(0.3, -0.15, 0), VB.IRON], [VB.box(THREE, 0.2, 0.05, 0.12).translate(-0.3, 0.3, 0), '#3a3a40'], [VB.box(THREE, 0.2, 0.05, 0.12).translate(0.3, -0.3, 0), '#3a3a40']]), mat);
  crank.position.set(0, 0.55, 0.4); crank.castShadow = true; bob.add(crank);
  const seats = [{ x: 0.35, y: 0.66, z: -0.2, ang: 0, pose: 'sit' }, { x: -0.35, y: 0.66, z: -0.2, ang: 0, pose: 'sit' }], collider = vbFit(THREE, bob, seats);
  return {
    root, kind: 'boat', waterline: 0.28, collider, parts: { bob, wheel, crank }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) { vbBob(bob, t, speed, steer, 1.2); const w = Math.min(Math.abs(speed), 6) * 1.4 + 0.3; wheel.rotation.x -= w * dt; crank.rotation.x += w * dt * 1.2; },
  };
}

// ---------------------------------------------------------------- dragon boat (12 m, dragon head and tail, 10 paddler benches, drum, 20 paddles in one animated mesh)
function buildDragonBoat(K, opts = {}) {
  const A = VB.atlas(K, opts), out = K.makeOut(), { THREE, s, B, C, Sp, T, GL } = VB.shape(K, out), RED = VB.RED, GOLD = VB.GOLD;
  const st = [{ z: -6.0, hw: 0.2, y0: 0.38, y1: 0.78, c: 0.5, w: 0.8 }, { z: -5.2, hw: 0.4, y0: 0.14, y1: 0.62, c: 0.45, w: 0.8 }, { z: -3.0, hw: 0.55, y0: 0.0, y1: 0.55, c: 0.45, w: 0.8 }, { z: 0, hw: 0.6, y0: 0.0, y1: 0.55, c: 0.45, w: 0.8 }, { z: 3.0, hw: 0.55, y0: 0.0, y1: 0.55, c: 0.45, w: 0.8 }, { z: 5.2, hw: 0.4, y0: 0.14, y1: 0.66, c: 0.45, w: 0.8 }, { z: 6.1, hw: 0.14, y0: 0.4, y1: 0.86, c: 0.5, w: 0.8 }];
  const sh = VB.shell(THREE, st, 0.06); s(sh.low, VB.tone(RED, 0.8), true); s(sh.high, RED, true); s(sh.inner, '#e8d4a8'); s(sh.rim, GOLD); s(sh.stern, RED);
  for (const sx of [-1, 1]) for (let i = 0; i < 11; i++) { const z = -4.75 + i * 0.95, k = VB.skin(st, z), a = Math.atan2(k.hw * (1 - k.w), (k.y1 - k.y0) * (1 - k.c)), xm = k.hw * (k.w + (1 - k.w) / 2), ym = k.y0 + (k.y1 - k.y0) * (k.c + (1 - k.c) / 2), n = [sx * Math.cos(a), Math.sin(a)];
    out.decal(new THREE.PlaneGeometry(0.9, 0.45).rotateY(sx * Math.PI / 2).rotateZ(sx * a).translate(sx * xm + n[0] * 0.012, ym + n[1] * 0.012, z), A, 'dragon_scales'); }
  for (let i = 0; i < 10; i++) B(1.0, 0.07, 0.24, 0, 0.5, -4.1 + i * 0.86, VB.WOOD, { skip: 'ny' });                                                             // paddler benches
  // dragon head on the bow: skull, snout, jaws, horns, eyes, teeth, tongue, mane
  const hx = 0, hy = 1.28, hz = 6.45;
  T([0, 0.62, 5.7], [0, 1.0, 6.2], 0.2, 0.17, 7, RED, { ol: true }); T([0, 1.0, 6.2], [0, 1.28, 6.5], 0.17, 0.15, 7, RED);
  Sp(0.3, 9, 6, 0.9, 0.85, 1.15, hx, hy + 0.15, hz + 0.1, RED, { ol: true });                                                                                    // skull
  B(0.42, 0.2, 0.55, hx, hy + 0.05, hz + 0.62, RED, { skip: 'nz', ol: true }); B(0.38, 0.1, 0.45, hx, hy - 0.2, hz + 0.55, VB.tone(RED, 0.8), { skip: 'nz', rot: [0.2, 0, 0] });  // snout + lower jaw
  for (const sx of [-1, 1]) { C(0.0, 0.07, 0.5, 6, sx * 0.17, hy + 0.58, hz - 0.1, GOLD, { rot: [-0.7, 0, sx * 0.25] }); Sp(0.075, 6, 4, 1, 1, 1, sx * 0.23, hy + 0.24, hz + 0.38, VB.CREAM); Sp(0.035, 5, 4, 1, 1, 1, sx * 0.26, hy + 0.24, hz + 0.43, VB.DARK);
    for (const z of [0.0, 0.14, 0.28]) B(0.03, 0.09, 0.05, sx * 0.14, hy - 0.14, hz + 0.62 + z, VB.CREAM, { skip: 'py' }); C(0.0, 0.05, 0.3, 5, sx * 0.1, hy + 0.35, hz + 0.88, GOLD, { rot: [-1.3, 0, 0] }); }
  B(0.1, 0.01, 0.4, hx, hy - 0.16, hz + 0.95, '#ff3d6e', { rot: [0.2, 0, 0] }); for (let i = 0; i < 5; i++) C(0, 0.07, 0.3, 5, 0, 1.15 + i * 0.09, 5.95, GOLD, { rot: [-0.3, 0, 0] });
  GL(new THREE.OctahedronGeometry(0.05, 0).translate(0.26, hy + 0.24, hz + 0.44), '#ffe08a'); GL(new THREE.OctahedronGeometry(0.05, 0).translate(-0.26, hy + 0.24, hz + 0.44), '#ffe08a');
  // tail on the stern: a tapering upswept curl with fins
  const tl = [[0, 0.5, -5.6, 0.2], [0, 0.85, -6.15, 0.17], [0, 1.4, -6.45, 0.13], [0, 1.95, -6.3, 0.09], [0, 2.3, -5.9, 0.04]];
  for (let i = 0; i + 1 < tl.length; i++) { T(tl[i].slice(0, 3), tl[i + 1].slice(0, 3), tl[i][3], tl[i + 1][3], 6, i % 2 ? GOLD : RED, { ol: i < 2 }); Sp(tl[i + 1][3] * 1.02, 6, 4, 1, 1, 1, tl[i + 1][0], tl[i + 1][1], tl[i + 1][2], i % 2 ? RED : GOLD); }
  B(0.05, 0.4, 0.3, 0, 1.75, -6.55, GOLD, { rot: [0.5, 0, 0] });
  // drum + drummer's seat at the bow, steering oar + stand at the stern
  C(0.38, 0.38, 0.5, 12, 0, 0.96, 4.6, RED, { rot: [0, 0, Math.PI / 2], ol: true }); C(0.4, 0.4, 0.04, 12, 0.26, 0.96, 4.6, '#eae6dc', { rot: [0, 0, Math.PI / 2] }); B(0.1, 0.5, 0.1, 0.3, 0.55, 4.6, VB.WOOD, { skip: 'ny' }); B(0.1, 0.5, 0.1, -0.3, 0.55, 4.6, VB.WOOD, { skip: 'ny' });
  B(0.7, 0.06, 0.3, 0, 0.55, 5.05, VB.WOOD, { skip: 'ny' });
  B(0.9, 0.08, 0.6, 0, 0.58, -5.2, VB.WOOD, { skip: 'ny' }); B(0.06, 0.06, 2.2, 0.3, 0.9, -5.6, VB.WOOD, { rot: [0.15, 0, 0] }); B(0.1, 0.4, 0.6, 0.3, 0.55, -6.55, GOLD, { skip: 'ny' });
  // lanterns for the night regatta
  for (const z of [-5.4, 5.5]) { GL(new THREE.OctahedronGeometry(0.09, 0).translate(0.0, 0.95, z), '#ffbf3c'); }
  const { root, bob } = VB.assemble(K, out), mat = K.toonMat();
  // 20 paddles in ONE mesh: per-paddle vertex ranges + shoulder pivots; animate() rotates each paddle about its own shoulder (synchronised stroke)
  const list = [], pivots = []; for (let i = 0; i < 10; i++) for (const sx of [-1, 1]) { const px = sx * 0.62, py = 0.85, pz = -4.1 + i * 0.86; const g1 = VB.box(THREE, 0.045, 1.5, 0.045).translate(0, -0.35, 0), g2 = VB.box(THREE, 0.04, 0.5, 0.2).translate(0, -1.3, 0.0); list.push([g1.translate(px, py, pz), VB.WOOD], [g2.translate(px, py, pz), VB.RED]); pivots.push([px, py, pz]); }
  const pg = VB.merge(THREE, list), base = Float32Array.from(pg.attributes.position.array), baseN = Float32Array.from(pg.attributes.normal.array), perP = base.length / 3 / pivots.length;
  const paddles = new THREE.Mesh(pg, mat); paddles.castShadow = true; bob.add(paddles); // culled normally against a fixed sphere that holds every stroke angle (fix m8)
  const stroke = (a) => { const P = pg.attributes.position.array, N = pg.attributes.normal.array, c = Math.cos(a), sn = Math.sin(a); for (let p = 0; p < pivots.length; p++) { const [px, py, pz] = pivots[p]; for (let k = 0; k < perP; k++) { const i = (p * perP + k) * 3, y = base[i + 1] - py, z = base[i + 2] - pz; P[i] = base[i]; P[i + 1] = py + y * c - z * sn; P[i + 2] = pz + y * sn + z * c; N[i] = baseN[i]; N[i + 1] = baseN[i + 1] * c - baseN[i + 2] * sn; N[i + 2] = baseN[i + 1] * sn + baseN[i + 2] * c; } } pg.attributes.position.needsUpdate = true; pg.attributes.normal.needsUpdate = true; };
  stroke(0); pg.computeBoundingSphere(); pg.boundingSphere.radius += 1.6; const _bs = pg.boundingSphere; pg.computeBoundingSphere = () => { pg.boundingSphere = _bs; };
  const seats = [{ x: 0, y: 1.0, z: 4.3, ang: Math.PI, pose: 'sit' }, { x: 0.28, y: 0.58, z: -0.15, ang: 0, pose: 'sit' }, { x: -0.28, y: 0.58, z: -0.15, ang: 0, pose: 'sit' }, { x: 0.1, y: 0.62, z: -5.2, ang: 0, pose: 'stand' }], collider = vbFit(THREE, bob, seats);
  return {
    root, kind: 'boat', waterline: 0.22, collider, parts: { bob, paddles }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) { vbBob(bob, t, speed, steer, 0.9); const rate = 0.9 + Math.min(Math.abs(speed), 6) * 0.35; const ph = t * rate * 3.2; stroke(Math.sin(ph) * 0.5); },
  };
}

// ---- vendor/taskAB/veh_carts.js ----
// veh_carts.js — Task B: arabber_cart (painted produce cart pulled by a walking pony) and skateboard.
// Arabber cart: red / yellow / green painted wooden cart (scrollwork side panels drawn on canvas), striped canopy, bells, lantern, fruit crates,
//   two big spoked rear wheels + two small front wheels (one mesh per pair), a pony with four walking legs and a swishing tail
//   (each leg = one mesh pivoting at its shoulder / hip). Meshes: body, glow, decal, 2 wheel pairs, 4 legs, tail = 10 (+ ink hulls on the body).
// Skateboard: rounded deck with kick-tails, trucks, two wheel-pair meshes (3 meshes); the rider stands on seats[0], side-on.
// Contract: buildXxx(K, opts) -> { root, kind:'cart' | 'board', seats, collider, waterline, animate(v, dt, speed, steer, t) }. Facing +Z, wheels on y = 0.
// steer > 0 turns left (+X). Seat anchors: 'sit' = hips, 'stand' = feet. No imports; no Math.random; materials only through K.makeOut / K.toonMat.
const META_VEH_CARTS = {
  id: 'veh_carts', kind: 'vehicle',
  pieces: { arabber_cart: { id: 'arabber_cart', kind: 'cart', length: 5.9, width: 1.9 }, skateboard: { id: 'skateboard', kind: 'board', length: 0.9, width: 0.24 } },
};

const VT = {
  RED: '#b8302a', YEL: '#e8b830', GREEN: '#2f5a3a', WOOD: '#9a6a44', IRON: '#2c322e', CREAM: '#eae6dc',
  tone: (h, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''),
  atlas(K, opts) { return tbPropAtlas(K, opts, 'veh_carts'); },
  box(THREE, w, h, d, skip = '') { const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }; if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); } return g; },
  tube(THREE, p0, p1, r0, r1, seg = 6) { const d = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), len = d.length(), g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); return g.translate((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2); },
  merge(THREE, list) { const P = [], N = [], Cc = []; for (const [g0, col] of list) { const g = g0.index ? g0.toNonIndexed() : g0, c = new THREE.Color(col), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); Cc.push(c.r, c.g, c.b); } } const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); m.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); m.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Cc), 3)); return m; },
  spokedWheel(THREE, r, x, spokes = 10) { const L = [[new THREE.TorusGeometry(r, 0.045, 5, 14).rotateY(Math.PI / 2), VT.YEL], [new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8).rotateZ(Math.PI / 2), VT.RED]]; for (let i = 0; i < spokes; i++) L.push([VT.box(THREE, 0.04, r * 1.9, 0.045).rotateX((i * Math.PI) / spokes), VT.WOOD]); return L.map(([g, c]) => [g.translate(x, 0, 0), c]); },
  shape(K, out) { const THREE = K.THREE; return { THREE,
    s: (g, col, ol = false) => out.solid(g, col, ol),
    B: (w, h, d, x, y, z, col, o = {}) => { const g = VT.box(THREE, w, h, d, o.skip); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); },
    Sp: (r, ws, hs, sx, sy, sz, x, y, z, col, o = {}) => { const g = new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); },
    T: (p0, p1, r0, r1, seg, col, o = {}) => out.solid(VT.tube(THREE, p0, p1, r0, r1, seg), col, !!o.ol) }; },
};


// the inside of a one-sided shell (canopy underside): same triangles, reversed winding + normals
function vtFlip(g0) { const g = g0.clone(), ix = g.index.array.slice(); for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.setIndex(Array.from(ix)); const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); return g; }

// centre the whole vehicle on its bounding box along Z (so `collider` is a centred box that matches the visible hull) and report that box
function vtFit(THREE, bob, seats, ov = {}) {
  const b = new THREE.Box3().setFromObject(bob), cz = (b.min.z + b.max.z) / 2, body = new THREE.Group();
  [...bob.children].forEach((c) => body.add(c)); body.position.z = -cz; bob.add(body); seats.forEach((s) => { s.z -= cz; });
  const r = (v) => Math.round(v * 100) / 100; return { w: ov.w ?? r(b.max.x - b.min.x), l: r(b.max.z - b.min.z), h: ov.h ?? r(b.max.y) };
}

// ---------------------------------------------------------------- arabber cart + pony
function buildArabberCart(K, opts = {}) {
  const A = VT.atlas(K, opts), out = K.makeOut(), { THREE, s, B, Sp, T } = VT.shape(K, out), mat = K.toonMat(), RED = VT.RED, YEL = VT.YEL, GRN = VT.GREEN;
  // chassis, floor, painted side panels, end boards, driver bench, shafts
  B(1.5, 0.1, 2.7, 0, 0.78, -0.9, VT.WOOD, { skip: 'ny', ol: true }); B(1.62, 0.1, 2.8, 0, 0.87, -0.9, RED, { skip: 'ny' });
  for (const sx of [-1, 1]) {
    B(0.07, 0.85, 2.7, sx * 0.78, 1.3, -0.9, RED, { skip: 'ny', ol: true });
    out.decal(new THREE.PlaneGeometry(2.6, 2.6 * 112 / 256).rotateY(sx * Math.PI / 2).translate(sx * 0.82, 1.3, -0.9), A, 'arabber_side');
    T([sx * 0.45, 0.82, 0.4], [sx * 0.5, 0.92, 2.15], 0.04, 0.035, 6, VT.WOOD);                                                                 // shafts to the pony
  }
  B(1.5, 0.85, 0.07, 0, 1.3, 0.45, GRN, { skip: 'ny', ol: true }); B(1.5, 0.85, 0.07, 0, 1.3, -2.25, GRN, { skip: 'ny', ol: true });
  B(1.4, 0.07, 0.5, 0, 1.2, 0.1, VT.WOOD, { skip: 'ny' });                                                                                         // driver's bench
  // canopy over the rear: striped half-barrel on four posts, scalloped valance, bells
  for (const [px, pz] of [[0.76, -0.1], [-0.76, -0.1], [0.76, -2.15], [-0.76, -2.15]]) B(0.05, 1.0, 0.05, px, 2.1, pz, GRN, { skip: 'ny' });
  for (let i = 0; i < 6; i++) { const g = new THREE.CylinderGeometry(0.9, 0.9, 2.4, 3, 1, true, Math.PI / 2 + (i * Math.PI) / 6, Math.PI / 6); g.rotateX(Math.PI / 2); g.translate(0, 2.62, -1.15); s(g, i % 2 ? YEL : RED); s(vtFlip(g), VT.tone(i % 2 ? YEL : RED, 0.8), false); } // theta pi/2..3pi/2 = the arc OVER the cart after rotateX (fix M2)
  for (let i = 0; i < 9; i++) { const x = -0.8 + i * 0.2; s(new THREE.CircleGeometry(0.1, 3).rotateZ(Math.PI / 2).translate(x, 2.58 - Math.abs(x) * 0.0, 0.07), i % 2 ? YEL : RED); }
  for (const x of [-0.5, 0, 0.5]) { Sp(0.05, 6, 4, 1, 1, 1, x, 2.32, 0.08, '#c8a040'); }
  B(0.1, 0.14, 0.1, 0.7, 2.45, 0.1, VT.IRON, { skip: 'ny' }); out.glow(new THREE.OctahedronGeometry(0.1, 0).translate(0.7, 2.28, 0.1), '#ffbf3c');   // hanging lantern (night glow)
  // produce: crates with fruit
  for (const [cx, cz, c] of [[-0.35, -1.2, VT.WOOD], [0.35, -1.2, VT.WOOD], [0, -1.85, VT.tone(VT.WOOD, 0.85)]]) { B(0.62, 0.3, 0.55, cx, 1.02, cz, c, { skip: 'ny', ol: true }); }
  [['#ff9f1c', -0.35, -1.2], ['#c8302a', 0.35, -1.2], ['#7fb04a', 0, -1.85]].forEach(([c, fx, fz]) => { for (let i = 0; i < 3; i++) Sp(0.11, 6, 4, 1, 1, 1, fx + (i - 1) * 0.17, 1.24, fz + (i % 2) * 0.12 - 0.05, c); });
  // the pony: ellipsoid body, tube neck, head, ears, mane, harness (legs and tail are moving meshes below)
  const body = '#8a4a3a', dark = '#3a2a22', zc = 2.1;
  Sp(0.4, 9, 6, 1, 1, 2.05, 0, 1.28, zc, body, { ol: true }); Sp(0.33, 7, 5, 1, 1, 1, 0, 1.33, zc + 0.75, body); Sp(0.36, 7, 5, 1, 1, 1, 0, 1.3, zc - 0.7, body);
  T([0, 1.48, zc + 0.85], [0, 1.95, zc + 1.2], 0.19, 0.13, 7, body, { ol: true }); Sp(0.17, 7, 5, 1, 0.95, 1.7, 0, 1.97, zc + 1.45, body, { ol: true, rot: [0.5, 0, 0] }); Sp(0.12, 6, 4, 1, 1, 1.2, 0, 1.82, zc + 1.7, VT.tone(body, 0.8));
  for (const sx of [-1, 1]) { s(new THREE.ConeGeometry(0.05, 0.16, 5).translate(sx * 0.09, 2.2, zc + 1.28), body); Sp(0.025, 5, 4, 1, 1, 1, sx * 0.13, 2.02, zc + 1.5, dark); }
  for (let i = 0; i < 5; i++) B(0.05, 0.14, 0.08, 0, 1.78 + i * 0.07 + (i > 2 ? 0.04 : 0), zc + 0.78 + i * 0.1, dark, { rot: [0.6, 0, 0], skip: 'ny' });
  B(0.84, 0.05, 0.06, 0, 1.63, zc + 0.3, RED, { skip: 'ny' }); B(0.84, 0.05, 0.06, 0, 1.6, zc - 0.35, RED, { skip: 'ny' });
  for (const sx of [-1, 1]) B(0.04, 0.5, 0.05, sx * 0.4, 1.38, zc + 0.3, RED, { skip: 'ny' });
  // the arabber's rear running board: the 'stand' seat's feet rest on it (fix m4)
  B(1.1, 0.06, 0.32, 0, 0.47, -2.43, VT.WOOD, { skip: 'ny', ol: true }); for (const sx of [-0.45, 0.45]) B(0.05, 0.36, 0.05, sx, 0.66, -2.31, VT.IRON, { skip: 'ny' });
  const { root, bob } = (() => { const r = new THREE.Group(), b = new THREE.Group(); r.add(b); b.add(out.build()); return { root: r, bob: b }; })();
  // wheels: two big rear wheels (one mesh, they turn together) and two small front ones
  const rear = new THREE.Mesh(VT.merge(THREE, [...VT.spokedWheel(THREE, 0.62, 0.84), ...VT.spokedWheel(THREE, 0.62, -0.84)]), mat), front = new THREE.Mesh(VT.merge(THREE, [...VT.spokedWheel(THREE, 0.42, 0.78, 8), ...VT.spokedWheel(THREE, 0.42, -0.78, 8)]), mat);
  rear.position.set(0, 0.62, -1.2); front.position.set(0, 0.42, -0.15); rear.castShadow = front.castShadow = true; bob.add(rear, front);
  // legs: pivot at the shoulder / hip, two segments + hoof each; tail: tube pivoting at the croup
  const legs = []; for (const [lx, lz, ph] of [[0.2, zc + 0.78, 0], [-0.2, zc + 0.78, Math.PI], [0.2, zc - 0.72, Math.PI], [-0.2, zc - 0.72, 0]]) {
    const g = VT.merge(THREE, [[VT.tube(THREE, [0, 0, 0], [0, -0.5, 0.02], 0.11, 0.075, 6), body], [VT.tube(THREE, [0, -0.5, 0.02], [0, -0.9, 0], 0.06, 0.05, 6), VT.tone(body, 0.85)], [VT.box(THREE, 0.11, 0.1, 0.16).translate(0, -0.95, 0.02), dark]]);
    const m = new THREE.Mesh(g, mat); m.position.set(lx, 1.0, lz); m.castShadow = true; bob.add(m); legs.push({ m, ph }); // shoulder / hip pivot at 1.0 so the 1.0 m legs put the hooves on y = 0 (fix M3)
  }
  const tail = new THREE.Mesh(VT.merge(THREE, [[VT.tube(THREE, [0, 0, 0], [0, -0.35, -0.2], 0.05, 0.08, 6), dark], [VT.tube(THREE, [0, -0.35, -0.2], [0, -0.75, -0.25], 0.08, 0.02, 6), dark]]), mat); tail.position.set(0, 1.45, zc - 1.0); tail.castShadow = true; bob.add(tail);
  const seats = [{ x: 0, y: 1.24, z: 0.12, ang: 0, pose: 'sit' }, { x: 0, y: 0.5, z: -2.43, ang: 0, pose: 'stand' }], collider = vtFit(THREE, bob, seats); // 'stand' = on the new rear step (fix m4)
  return {
    root, kind: 'cart', waterline: 0, collider, parts: { bob, rear, front, legs, tail }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) {
      rear.rotation.x += (speed * dt) / 0.62; front.rotation.x += (speed * dt) / 0.42;
      const k = Math.min(1, Math.abs(speed) / 2), ph = t * (2.2 + Math.abs(speed) * 1.1);
      for (const l of legs) l.m.rotation.x = Math.sin(ph + l.ph) * 0.55 * k;
      tail.rotation.z = Math.sin(t * 2.4) * 0.35; tail.rotation.x = 0.25 + Math.sin(t * 1.7) * 0.12;
      bob.position.y = Math.abs(Math.sin(ph)) * 0.03 * k; bob.rotation.z = -steer * 0.03 * k;
    },
  };
}

// ---------------------------------------------------------------- skateboard
function buildSkateboard(K, opts = {}) {
  const out = K.makeOut(), { THREE, s, B, T } = VT.shape(K, out), mat = K.toonMat(), paint = opts.paint || '#ff3d6e';
  const plan = [[-0.1, -0.34], [0.1, -0.34], [0.12, -0.3], [0.12, 0.3], [0.1, 0.34], [-0.1, 0.34], [-0.12, 0.3], [-0.12, -0.3]];
  const shp = new THREE.Shape(); plan.forEach(([x, z], i) => (i ? shp.lineTo(x, -z) : shp.moveTo(x, -z)));
  const deck = new THREE.ExtrudeGeometry(shp, { depth: 0.03, bevelEnabled: false }); deck.rotateX(-Math.PI / 2); s(deck.translate(0, 0.095, 0), paint, true);
  const grip = new THREE.ExtrudeGeometry(shp, { depth: 0.006, bevelEnabled: false }); grip.rotateX(-Math.PI / 2); grip.scale(0.9, 1, 0.94); s(grip.translate(0, 0.125, 0), '#2c322e', false);
  for (const sz of [-1, 1]) { B(0.22, 0.03, 0.12, 0, 0.115, sz * 0.4, paint, { rot: [sz * -0.35, 0, 0], skip: 'ny', ol: true }); B(0.2, 0.012, 0.1, 0, 0.14, sz * 0.4, '#2c322e', { rot: [sz * -0.35, 0, 0] }); }
  for (const sz of [-1, 1]) { B(0.14, 0.03, 0.1, 0, 0.075, sz * 0.22, '#a8a49a', { skip: 'ny' }); T([-0.13, 0.05, sz * 0.22], [0.13, 0.05, sz * 0.22], 0.015, 0.015, 6, '#6f6a62'); }
  const root = new THREE.Group(), bob = new THREE.Group(); root.add(bob); bob.add(out.build());
  const wheels = [0.22, -0.22].map((z) => { const m = new THREE.Mesh(VT.merge(THREE, [-0.15, 0.15].map((x) => [new THREE.CylinderGeometry(0.04, 0.04, 0.035, 10).rotateZ(Math.PI / 2).translate(x, 0, 0), '#eae6dc'])), mat); m.position.set(0, 0.05, z); m.castShadow = true; bob.add(m); return m; });
  const seats = [{ x: 0, y: 0.13, z: 0, ang: Math.PI / 2, pose: 'stand' }], collider = vtFit(THREE, bob, seats);
  return {
    root, kind: 'board', waterline: 0, collider, parts: { bob, wheels }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) { for (const w of wheels) w.rotation.x += (speed * dt) / 0.04; bob.rotation.z = -steer * 0.22; bob.rotation.x = Math.min(Math.abs(speed), 6) * 0.004; },
  };
}

