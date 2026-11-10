// Landscape: what makes each arena a place. Ground outside the boards, floor markings, the furniture you bump
// into (telephone poles, parked cars, rocks, hay bales, containers, a carousel) and what hangs overhead (wires,
// bunting). Pure drawing; it asks the View for the active style's materials so every style pack skins it.
const TAU = Math.PI * 2;
export const GROUND = { rink: '#20243a', lot: '#3d4048', pond: '#dfeaf2', derby: '#7a5a3a', pinch: '#4a4f58', midway: '#3b2a4a' };

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** pass 'ground' = outside the boards (before the floor); pass 'floor' = markings, clipped to the playing surface. */
export function drawTheme(g, V, game, pass) {
  const A = game.arena, P = V.style.pal, B = A.bounds, th = A.theme, line = (V.style.floor[game.surface] || V.style.floor.asphalt)[2], R = rng(A.w * 7 + A.h);
  if (pass === 'ground') {
    g.save();
    if (th === 'lot') { // the rest of the car park: bays and a few cars left overnight
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 5;
      for (let x = -400; x < A.w + 400; x += 120) { g.beginPath(); g.moveTo(x, -70); g.lineTo(x, -300); g.moveTo(x, A.h + 70); g.lineTo(x, A.h + 300); g.stroke(); }
      for (let i = 0; i < 9; i++) { const x = -340 + i * 360 + R() * 80, top = i % 2 === 0; parked(g, V, x, top ? -190 : A.h + 190, ['#7d8aa0', '#a04848', '#4f7d6a', '#c2a24a'][i % 4]); }
    } else if (th === 'pond') { // snowbanks and pines
      for (let i = 0; i < 46; i++) { const a = (i / 46) * TAU, rr = 1.12 + R() * 0.35, x = A.cx + Math.cos(a) * (A.w / 2) * rr, y = A.cy + Math.sin(a) * (A.h / 2) * rr; if (i % 3 === 0) pine(g, V, x, y, 34 + R() * 26); else { g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(x, y, 60 + R() * 60, 34 + R() * 30, R() * 3, 0, TAU); g.fill(); } }
    } else if (th === 'derby') { // grandstand fencing and tyre walls
      g.strokeStyle = 'rgba(40,25,10,.5)'; g.lineWidth = 10; g.setLineDash([30, 22]); g.strokeRect(-90, -90, A.w + 180, A.h + 180); g.setLineDash([]);
      for (let i = 0; i < 40; i++) { const t = i / 40, x = -150 + t * (A.w + 300); for (const y of [-150, A.h + 150]) { g.fillStyle = ['#c9483b', '#e0c24a', '#4a78c9', '#e8e8e8'][(i * 7) % 4]; g.fillRect(x, y - 12, 18, 24); } }
    } else if (th === 'pinch') { // stacked containers beyond the fence, rail tracks
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 6; for (const y of [-120, -160, A.h + 120, A.h + 160]) { g.beginPath(); g.moveTo(-400, y); g.lineTo(A.w + 400, y); g.stroke(); }
      for (let i = 0; i < 10; i++) { const x = -300 + i * 290; for (const y of [-260, A.h + 230]) { g.fillStyle = ['#b5523b', '#3f7fa6', '#c9a13a', '#5d8a55', '#8a5aa6'][(i * 3 + (y > 0 ? 2 : 0)) % 5]; g.fillRect(x, y, 250, 70); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 3; for (let q = 20; q < 250; q += 20) { g.beginPath(); g.moveTo(x + q, y); g.lineTo(x + q, y + 70); g.stroke(); } } }
    } else if (th === 'midway') { // tents and a wheel at the edge of the fair
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.26, x = A.cx + Math.cos(a) * (A.w / 2 + 210), y = A.cy + Math.sin(a) * (A.h / 2 + 190), c = [P.team[0], P.accent, P.team[1], '#ffffff'][i % 4]; tent(g, V, x, y, 80 + (i % 3) * 16, c); }
    }
    g.restore(); return;
  }
  // floor markings
  if (th === 'lot') {
    g.strokeStyle = line; g.lineWidth = 5; g.globalAlpha = 0.75;
    for (let x = B.left + 130; x < B.right - 100; x += 118) { g.beginPath(); g.moveTo(x, B.top); g.lineTo(x, B.top + 170); g.moveTo(x, B.bottom); g.lineTo(x, B.bottom - 170); g.stroke(); }
    g.globalAlpha = 0.16; g.fillStyle = '#ffffff'; g.font = `900 420px ${V.style.ui.font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(A.cx, A.cy); g.rotate(-V.rot); g.fillText('7', 0, 30); g.restore();
    g.globalAlpha = 0.55; g.fillStyle = 'rgba(20,20,26,.5)'; for (let i = 0; i < 16; i++) { g.beginPath(); g.ellipse(B.left + R() * (B.right - B.left), B.top + R() * (B.bottom - B.top), 26 + R() * 50, 14 + R() * 26, R() * 3, 0, TAU); g.fill(); } // oil stains
    g.globalAlpha = 1;
  } else if (th === 'pond') {
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; g.globalAlpha = 0.7;
    for (let i = 0; i < 14; i++) { let x = B.left + R() * (B.right - B.left), y = B.top + R() * (B.bottom - B.top), a = R() * TAU; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { a += (R() - 0.5) * 1.6; x += Math.cos(a) * (30 + R() * 50); y += Math.sin(a) * (30 + R() * 50); g.lineTo(x, y); } g.stroke(); }
    g.globalAlpha = 1;
  } else if (th === 'derby') {
    g.strokeStyle = 'rgba(40,22,8,.32)'; g.lineWidth = 16;
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(B.left + R() * (B.right - B.left), B.top + R() * (B.bottom - B.top), 90 + R() * 200, R() * TAU, R() * TAU + 1.2 + R() * 2); g.stroke(); }
    g.setLineDash([24, 18]); g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(A.cx, A.cy, (B.right - B.left) * 0.36, (B.bottom - B.top) * 0.36, 0, 0, TAU); g.stroke(); g.setLineDash([]);
  } else if (th === 'pinch') {
    g.fillStyle = '#f2c230'; g.globalAlpha = 0.85;
    for (const y of [B.top + 270, B.bottom - 300]) for (let x = A.cx - 180; x < A.cx + 180; x += 60) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y); g.lineTo(x + 10, y + 30); g.lineTo(x - 20, y + 30); g.fill(); }
    g.globalAlpha = 0.5; g.strokeStyle = '#f2c230'; g.lineWidth = 6; g.setLineDash([40, 30]); g.beginPath(); g.moveTo(B.left, A.cy - 200); g.lineTo(B.right, A.cy - 200); g.moveTo(B.left, A.cy + 200); g.lineTo(B.right, A.cy + 200); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
  } else if (th === 'midway') {
    g.globalAlpha = 0.22; for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? P.accent : P.team[i % 4 === 0 ? 0 : 1]; g.beginPath(); g.moveTo(A.cx, A.cy); g.arc(A.cx, A.cy, 420, (i / 16) * TAU, ((i + 1) / 16) * TAU); g.fill(); } g.globalAlpha = 1;
  }
}

function shadow(g, V, fn) { const [dx, dy, da] = V.style.light.shadow; g.save(); g.rotate(-V.rot); g.translate(dx, dy); g.rotate(V.rot); g.globalAlpha = da; g.fillStyle = '#000'; fn(); g.fill(); g.restore(); }
function parked(g, V, x, y, color, angle = Math.PI / 2, w = 150, h = 76) {
  g.save(); g.translate(x, y); g.rotate(angle); shadow(g, V, () => { g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 16); });
  g.fillStyle = '#17181d'; for (const [wx, wy] of [[-0.3, -1], [-0.3, 1], [0.3, -1], [0.3, 1]]) g.fillRect(w * wx - 14, wy * (h / 2) - 5, 28, 10);
  g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 16); g.fillStyle = V._mat(g, color, '#2c2f38', '#ffffff', w * 0.6, angle); g.fill(); V._ink(g);
  g.beginPath(); g.roundRect(-w * 0.2, -h / 2 + 9, w * 0.42, h - 18, 8); g.fillStyle = '#1d2733'; g.fill(); g.beginPath(); g.roundRect(-w * 0.1, -h / 2 + 13, w * 0.22, h - 26, 6); g.fillStyle = V._mat(g, color, '#2c2f38', '#ffffff', w * 0.3, angle); g.fill();
  g.restore();
}
function pine(g, V, x, y, r) { g.save(); g.translate(x, y); for (let k = 0; k < 3; k++) { g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, q = (i % 2 ? r * 0.72 : r) * (1 - k * 0.27); g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); g.fillStyle = ['#1f5a3a', '#2a7449', '#3a8f5a'][k]; g.fill(); } g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(-r * 0.2, -r * 0.2, r * 0.22, 0, TAU); g.fill(); g.restore(); }
function tent(g, V, x, y, r, c) { g.save(); g.translate(x, y); for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, (i / 12) * TAU, ((i + 1) / 12) * TAU); g.fillStyle = i % 2 ? '#fff6dd' : c; g.fill(); } g.beginPath(); g.arc(0, 0, r, 0, TAU); V._ink(g); g.beginPath(); g.arc(0, 0, r * 0.14, 0, TAU); g.fillStyle = V.style.pal.accent; g.fill(); g.restore(); }

/** The furniture, by kind. Everything here has a matching static body in the sim. */
export function drawObstacle(g, V, o) {
  const S = V.style, P = S.pal, k = o.kind, a = o.angle || 0;
  g.save(); g.translate(o.x, o.y);
  if (o.r) {
    const r = o.r; shadow(g, V, () => { g.beginPath(); g.arc(0, 0, r, 0, TAU); });
    if (k === 'pole') { // telephone pole: timber post, crossarm, insulators (the wires are drawn overhead)
      g.rotate(-V.rot); g.globalAlpha = 0.22; g.fillStyle = '#000'; g.fillRect(0, -6, 150, 12); g.globalAlpha = 1; g.rotate(V.rot);
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = V._mat(g, '#8a5a34', '#4a2d17', '#c99562', r); g.fill(); V._ink(g);
      g.rotate(0.5); g.beginPath(); g.roundRect(-r * 2.6, -5, r * 5.2, 10, 3); g.fillStyle = '#5a3a20'; g.fill(); V._ink(g, Math.min(3, S.outline)); for (const q of [-2.2, -1.2, 1.2, 2.2]) { g.beginPath(); g.arc(r * q, 0, 5, 0, TAU); g.fillStyle = '#d7e3ea'; g.fill(); }
    } else if (k === 'bollard' || k === 'drum') {
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = V._mat(g, k === 'drum' ? '#e8702a' : '#f2c230', '#8a5a10', '#ffffff', r); g.fill(); V._ink(g); g.beginPath(); g.arc(0, 0, r * 0.55, 0, TAU); g.fillStyle = k === 'drum' ? '#f4f4f4' : '#1d1d24'; g.fill();
    } else if (k === 'rock') {
      const R = rng(Math.round(o.x * 3 + o.y)); g.beginPath(); for (let i = 0; i < 9; i++) { const q = (i / 9) * TAU, rr = r * (0.86 + R() * 0.22); g.lineTo(Math.cos(q) * rr, Math.sin(q) * rr); } g.closePath(); g.fillStyle = V._mat(g, '#8f97a6', '#4b5261', '#dfe6ee', r); g.fill(); V._ink(g);
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(-r * 0.2, -r * 0.3, r * 0.5, r * 0.26, -0.4, 0, TAU); g.fill(); // snow cap
    } else if (k === 'tires') {
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = V._mat(g, '#2a2c33', '#0c0d10', '#6b7080', r); g.fill(); V._ink(g); for (const q of [0.68, 0.36]) { g.beginPath(); g.arc(0, 0, r * q, 0, TAU); g.strokeStyle = q > 0.5 ? '#f4f4f4' : '#6b7080'; g.lineWidth = 4; g.stroke(); }
    } else if (k === 'carousel') { // the carousel turns; its canopy is striped, with horses round the rim
      g.rotate(V.t * 0.5); for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, (i / 12) * TAU, ((i + 1) / 12) * TAU); g.fillStyle = i % 2 ? '#fff6dd' : i % 4 === 0 ? P.team[0] : P.team[1]; g.fill(); }
      g.beginPath(); g.arc(0, 0, r, 0, TAU); V._ink(g, S.outline || 3); g.lineWidth = 6; g.strokeStyle = P.accent; g.stroke();
      for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU; g.beginPath(); g.arc(Math.cos(q) * r * 0.78, Math.sin(q) * r * 0.78, 9, 0, TAU); g.fillStyle = P.accent; g.fill(); }
      g.beginPath(); g.arc(0, 0, r * 0.22, 0, TAU); g.fillStyle = V._mat(g, P.accent, P.ballDark, '#ffffff', r * 0.22); g.fill(); V._ink(g);
    }
  } else {
    const w = o.w, h = o.h; g.rotate(a); shadow(g, V, () => { g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 8); });
    const box = (c, d, rad = 8) => { g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, rad); g.fillStyle = V._mat(g, c, d, '#ffffff', Math.max(w, h) * 0.6, a); g.fill(); V._ink(g); };
    if (k === 'car') { g.restore(); parked(g, V, o.x, o.y, '#5f8fb5', a, w, h); return; }
    if (k === 'cart') { box('#b9c0cc', '#6c7480', 6); g.strokeStyle = '#4b525e'; g.lineWidth = 3; for (let q = -w / 2 + 14; q < w / 2; q += 14) { g.beginPath(); g.moveTo(q, -h / 2); g.lineTo(q, h / 2); g.stroke(); } g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.stroke(); }
    else if (k === 'island') { box('#cfd3da', '#8a909c', 22); g.beginPath(); g.roundRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 16); g.fillStyle = '#4f9a55'; g.fill(); for (const q of [-0.28, 0.28]) { g.beginPath(); g.arc(0, h * q, w * 0.36, 0, TAU); g.fillStyle = V._mat(g, '#3f8f4a', '#1f5a2c', '#9be08a', w * 0.36); g.fill(); V._ink(g, Math.min(3, S.outline)); } }
    else if (k === 'hut') { box('#b5523b', '#6e2a1c', 6); g.strokeStyle = '#5a2015'; g.lineWidth = 5; g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.stroke(); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.28); g.fillStyle = '#3a3a44'; g.fillRect(w * 0.2, -h * 0.1, 16, 16); }
    else if (k === 'bale') { box('#e3bd4f', '#a67c1f', 10); g.strokeStyle = 'rgba(120,80,10,.6)'; g.lineWidth = 3; for (let q = -w / 2 + 12; q < w / 2; q += 12) { g.beginPath(); g.moveTo(q, -h / 2 + 4); g.lineTo(q, h / 2 - 4); g.stroke(); } g.strokeStyle = '#b5523b'; g.lineWidth = 5; for (const q of [-0.25, 0.25]) { g.beginPath(); g.moveTo(-w / 2, h * q); g.lineTo(w / 2, h * q); g.stroke(); } }
    else if (k === 'container') { box(['#b5523b', '#3f7fa6'][Math.round(o.x) % 2], '#2a2f3a', 4); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 3; for (let q = -w / 2 + 16; q < w / 2; q += 16) { g.beginPath(); g.moveTo(q, -h / 2); g.lineTo(q, h / 2); g.stroke(); } }
    else if (k === 'booth') { box('#fff6dd', '#b9a878', 8); g.save(); g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 8); g.clip(); g.fillStyle = P.team[0]; for (let q = -w / 2; q < w / 2; q += 28) g.fillRect(q, -h / 2, 14, h); g.restore(); g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 8); V._ink(g); }
    else box('#9aa0ad', '#555b68');
  }
  g.restore();
}

/** Above the cars: telephone wires across the lot, bunting over the midway. */
export function drawOverhead(g, V, game) {
  const A = game.arena, P = V.style.pal, poles = A.obstacles.filter((o) => o.kind === 'pole');
  if (poles.length >= 2) {
    const pts = [...poles].sort((p, q) => Math.atan2(p.y - A.cy, p.x - A.cx) - Math.atan2(q.y - A.cy, q.x - A.cx));
    g.strokeStyle = 'rgba(10,10,16,.55)'; g.lineWidth = 3;
    pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; for (const off of [-9, 9]) { g.beginPath(); g.moveTo(p.x + off, p.y); g.quadraticCurveTo((p.x + q.x) / 2 + off, (p.y + q.y) / 2 + 46, q.x + off, q.y); g.stroke(); } });
  }
  if (A.theme === 'midway') {
    const hub = A.obstacles.find((o) => o.kind === 'carousel'); if (!hub) return;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3, ex = hub.x + Math.cos(a) * 620, ey = hub.y + Math.sin(a) * 500; g.strokeStyle = 'rgba(20,10,30,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(hub.x, hub.y); g.lineTo(ex, ey); g.stroke();
      for (let k = 2; k < 14; k++) { const t = k / 14, x = hub.x + (ex - hub.x) * t, y = hub.y + (ey - hub.y) * t; g.fillStyle = [P.team[0], P.accent, P.team[1], '#ffffff'][k % 4]; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.lineTo(x, y + 18); g.fill(); } g.globalAlpha = 1; }
  }
}
