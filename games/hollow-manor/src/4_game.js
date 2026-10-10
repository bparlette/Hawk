// ---------- game state ----------
const cv = document.getElementById('c'); const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
const scene = document.createElement('canvas'); scene.width = VW; scene.height = VH; const sc = scene.getContext('2d', { willReadFrequently: true });
const LW = 128, LH = 112; const LM = new Float32Array(LW * LH);
const G = {
  state: 'title', t: 0, playT: 0, room: null, inv: { key: 0, handle: 0, fuse: 0 }, installed: { handle: 0, fuse: 0 }, battery: 1, lightUser: true,
  blk: 0, stut: 0, flickOff: false, flickInt: 1, tension: 0, quiet: 0, nextAmbient: R(22, 34), nextLightning: R(10, 22), flash: 0, flashQ: [],
  msg: null, map: false, check: null, threat: null, threatNext: 95, threatFirst: false, scares: 0, hidden: null, shake: 0, ents: [],
  roomT: 0, deadMsg: false, lightOffT: 0, noFlicker: QS.has('noflicker'), noThreat: QS.has('nothreat'), et: 0, catches: 0, motifT: 4, motifI: 0, beatT: 0,
  titleT: 0, lit: false, montage: null, overT: 0, endTime: 0, botInfo: '', boxT: 0, boxI: 0, boxOn: false, boxLit: 0, rockLit: 0, rockT: 0, stepT: 0, stepAlt: false,
};
const P = { x: 128, y: 186, ang: -Math.PI / 2, dir: 'up', walk: 0, moving: false, vx: 0, vy: 0 };
window.__frameErrors = 0;

function lightEff() { return G.lightUser && G.battery > 0 && !G.flickOff && !G.hidden && G.state === 'play'; }
function showMsg(s, dur) { const lines = wrap(s, 40); G.msg = { lines, t: dur || clamp(2.5 + s.length * 0.045, 3, 8) }; }
function scare(amt = 0.5) { G.tension = clamp(G.tension + amt, 0, 1.5); G.quiet = 0; G.scares++; }

// ---------- rooms ----------
function buildRoom(rm) {
  if (rm.built) return; rm.built = true;
  for (const d of rm.o) {
    const [t, x, y, ex0] = d; const ot = OT[t]; let ex = {}; let yy = y;
    if (ot.wall) { ex = typeof y === 'object' ? y : {}; yy = ot.wall === 2 ? 13 : 0; }
    else ex = ex0 || {};
    const w = ex.w || (ex.w1 ? 1 : ot.w), h = ex.h || ot.h;
    const o = { t, x, y: yy, x0: x, y0: yy, w, h, ex, s: !!ot.s, wall: !!ot.wall, room: rm.id };
    if (ot.creep) { o.creep = 1; o.v = 'away'; o.unseen = 0; o.th = R(2.5, 5); o.moves = 0; }
    if (t === 'stairs') { o.to = ex.to; o.dir = ex.dir; o.locked = ex.locked; o.open = !ex.locked; o.s = !!ex.locked; o.ex = { ...ex, stone: rm.fl === 'stone' }; }
    if (t === 'item') { o.it = ex.it; }
    if (t === 'desk' && ex.item) { o.it = ex.item; }
    if (t === 'fireplace') { o.s = true; }
    rm.objs.push(o);
  }
  rm.amb = new Float32Array(LW * LH);
  rm.windows = rm.objs.filter((o) => o.t === 'window');
  for (const wo of rm.windows) {
    const wx = wo.x * 16;
    for (let cy = 0; cy < LH; cy++) for (let cx = 0; cx < LW; cx++) {
      const x = cx * 2 + 1, y = cy * 2 + 1; let L = 0;
      if (y < 30 && x >= wx + 3 && x < wx + 29 && y > 4) L = 0.62;
      else if (y >= 30) { const s = (y - 30) * 0.45; const x0 = wx + 4 + s, x1 = wx + 28 + s; if (x >= x0 && x < x1 && y < 30 + 96) L = 0.5 * (1 - (y - 30) / 110); }
      if (L > rm.amb[cy * LW + cx]) rm.amb[cy * LW + cx] = L;
    }
  }
  rm.static = null;
}
function doorGaps(rm) { return { N: !!rm.doors.N, S: !!rm.doors.S, W: !!rm.doors.W, E: !!rm.doors.E }; }
function computeGrid(rm) {
  const g = new Uint8Array(COLS * ROWS); const d = doorGaps(rm);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    let s = 0; if (y <= 1 || y === 13 || x === 0 || x === 15) s = 1;
    if (d.N && y <= 1 && (x === 7 || x === 8)) s = 0; if (d.S && y === 13 && (x === 7 || x === 8)) s = 0;
    if (d.W && x === 0 && (y === 6 || y === 7)) s = 0; if (d.E && x === 15 && (y === 6 || y === 7)) s = 0;
    g[y * COLS + x] = s;
  }
  for (const o of rm.objs) {
    if (!o.s || o.taken || o.dragging) continue;
    if (o.t === 'fireplace') { for (let x = o.x; x < o.x + 3; x++) g[2 * COLS + x] = 1; continue; }
    if (o.wall) continue;
    for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) if (x >= 0 && x < COLS && y >= 0 && y < ROWS) g[y * COLS + x] = 1;
  }
  rm.grid = g;
}
function tileSolid(tx, ty) { if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false; return G.room.grid[ty * COLS + tx] === 1; }
function boxFree(x, y) {
  const pts = [[x - 5, y - 3], [x + 4, y - 3], [x - 5, y + 2], [x + 4, y + 2]];
  for (const [px, py] of pts) if (tileSolid(Math.floor(px / 16), Math.floor(py / 16))) return false;
  return true;
}
function renderStatic(rm) {
  const c = mk(VW, VH); const g = c.getContext('2d'); const q = rr(rm.gx * 31 + rm.gy * 7 + rm.f * 101);
  const ff = FLOORS[rm.fl];
  for (let ty = 2; ty < 13; ty++) for (let tx = 1; tx < 15; tx++) { const t = mk(16, 16, (r) => ff(r, q, tx, ty)); g.drawImage(t, tx * 16, ty * 16); }
  const d = doorGaps(rm); const wt = WALLTOP[rm.wl];
  // top wall face
  for (let tx = 0; tx < 16; tx++) { const t = mk(16, 32, (r) => WALLS[rm.wl](r, q, tx)); g.drawImage(t, tx * 16, 0); }
  // rugs
  for (const o of rm.objs) if (o.t === 'rug') {
    const cc = { red: [C.r0, C.rd, C.n2], green: [C.v0, C.vd, C.n2], purple: [C.p0, C.pd, C.n2], pink: [C.p1, C.p0, C.g5], blue: [C.b1, C.b0, C.g5] }[o.ex.c || 'red'];
    const x = o.x * 16 + 2, y = o.y * 16 + 2, w = o.w * 16 - 4, h = o.h * 16 - 4;
    g.fillStyle = cc[1]; g.fillRect(x, y, w, h); g.fillStyle = cc[0]; g.fillRect(x + 2, y + 2, w - 4, h - 4); g.fillStyle = cc[2]; g.fillRect(x + 4, y + 4, w - 8, 1); g.fillRect(x + 4, y + h - 5, w - 8, 1); g.fillRect(x + 4, y + 4, 1, h - 8); g.fillRect(x + w - 5, y + 4, 1, h - 8);
    g.fillStyle = cc[1]; for (let i = x + 8; i < x + w - 8; i += 8) g.fillRect(i, y + h / 2 - 1, 3, 3);
    g.fillStyle = cc[2]; for (let i = x; i < x + w; i += 3) { g.fillRect(i, y - 2, 1, 2); g.fillRect(i, y + h, 1, 2); }
  }
  // side + bottom walls
  const side = (x, y, w, h) => { g.fillStyle = wt; g.fillRect(x, y, w, h); };
  side(0, 32, 16, 192); side(240, 32, 16, 192); side(0, 208, 256, 16);
  g.fillStyle = C.K; g.fillRect(15, 32, 1, 176); g.fillRect(240, 32, 1, 176); g.fillRect(16, 208, 224, 1);
  g.fillStyle = C.g2; for (let y = 36; y < 208; y += 8) { g.fillRect(4, y, 6, 1); g.fillRect(246, y + 4, 6, 1); } for (let x = 4; x < 252; x += 10) g.fillRect(x, 214, 5, 1);
  // door gaps
  const fl = (tx, ty) => g.drawImage(mk(16, 16, (r) => ff(r, q, tx, ty)), tx * 16, ty * 16);
  if (d.N) { g.fillStyle = C.K; g.fillRect(112, 0, 32, 32); g.fillStyle = C.n2; g.fillRect(108, 2, 4, 30); g.fillRect(144, 2, 4, 30); g.fillRect(108, 0, 40, 3); g.fillStyle = C.n0; g.fillRect(110, 4, 2, 28); g.fillRect(144, 4, 2, 28); fl(7, 1); fl(8, 1); g.fillStyle = C.K; g.fillRect(112, 16, 32, 6); g.fillStyle = C.g1; g.fillRect(112, 22, 32, 4); }
  if (d.S) { fl(7, 13); fl(8, 13); g.fillStyle = C.K; g.fillRect(112, 216, 32, 8); g.fillStyle = C.n2; g.fillRect(110, 208, 2, 16); g.fillRect(144, 208, 2, 16); }
  if (d.W) { fl(0, 6); fl(0, 7); g.fillStyle = C.K; g.fillRect(0, 96, 6, 32); g.fillStyle = C.n2; g.fillRect(0, 94, 16, 2); g.fillRect(0, 128, 16, 2); }
  if (d.E) { fl(15, 6); fl(15, 7); g.fillStyle = C.K; g.fillRect(250, 96, 6, 32); g.fillStyle = C.n2; g.fillRect(240, 94, 16, 2); g.fillRect(240, 128, 16, 2); }
  // cobwebs in corners for basement/attic
  if (rm.f === 0 || rm.id === 'attic') { g.fillStyle = C.g3; for (let i = 0; i < 10; i++) { g.fillRect(16 + i, 32 + 9 - i, 1, 1); g.fillRect(16, 32 + i, 1, 1); g.fillRect(16 + i, 32, 1, 1); g.fillRect(239 - i, 32 + 9 - i, 1, 1); } g.fillRect(20, 36, 3, 1); g.fillRect(232, 37, 4, 1); }
  // moonlight tint on floor (separate layer, hidden once the power is back)
  rm.moon = mk(VW, VH, (r, mg) => { for (const wo of rm.windows) { const wx = wo.x * 16; mg.fillStyle = C.b5; for (let y = 32; y < 126; y += 2) { const s = (y - 30) * 0.45; for (let x = Math.ceil(wx + 4 + s); x < wx + 28 + s; x++) if (((x + y) & 3) === 0 && rm.grid[Math.floor(y / 16) * 16 + Math.floor(x / 16)] === 0) mg.fillRect(x, y, 1, 1); } } });
  rm.static = c;
}

// ---------- entering rooms ----------
const SAFE = new Set(['foyer', 'grand', 'landing', 'kitchen', 'cstairs', 'shall', 'squart']);
function enterRoom(id, how, info = {}) {
  const prev = G.room; const rm = ROOMS[id]; buildRoom(rm); computeGrid(rm); if (!rm.static) renderStatic(rm);
  G.room = rm; G.roomT = 0; rm.enters++; const first = !rm.visited; rm.visited = true;
  G.ents = G.ents.filter((e) => e.persist);
  if (G.threat && G.threat.room !== id) { G.threat = null; G.threatNext = Math.max(G.threatNext, G.playT + R(20, 35)); }
  if (how === 'door') {
    const d = info.dir; // direction moved
    if (d === 'N') { P.x = 128; P.y = VH - 22; } if (d === 'S') { P.x = 128; P.y = 38; }
    if (d === 'W') { P.x = VW - 20; P.y = 116; } if (d === 'E') { P.x = 20; P.y = 116; }
  } else if (how === 'stairs') {
    const st = rm.objs.find((o) => o.t === 'stairs' && o.to === info.from);
    P.x = (st.x + st.w / 2) * 16; P.y = (st.y + st.h) * 16 + 10; P.ang = Math.PI / 2; P.dir = 'down';
  } else if (how === 'pos') { P.x = info.x; P.y = info.y; }
  if (SAFE.has(id) && how !== 'pos') G.check = { room: id, x: P.x, y: P.y };
  AU.droneFloor(rm.f);
  if (!first && rm.enters > 1) shuffleRoom(rm, info.dir);
  roomEvents(rm, first);
}
function freeTiles(rm, avoidPlayer = 3) {
  const out = []; const ptx = Math.floor(P.x / 16), pty = Math.floor(P.y / 16);
  for (let y = 3; y <= 11; y++) for (let x = 2; x <= 13; x++) {
    if (rm.grid[y * COLS + x]) continue;
    if ((x === 7 || x === 8) && (y <= 3 || y >= 11)) continue; if ((y === 6 || y === 7) && (x <= 2 || x >= 13)) continue;
    if (Math.abs(x - ptx) + Math.abs(y - pty) < avoidPlayer) continue;
    if (rm.objs.some((o) => !o.s && !o.wall && o.t !== 'rug' && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h)) continue;
    out.push([x, y]);
  }
  return out;
}
function shuffleRoom(rm) {
  // furniture that has moved between visits
  const chairs = rm.objs.filter((o) => o.t === 'chair' && !o.ex.bench);
  if (chairs.length && rnd() < 0.4) { const ch = pick(chairs); const ft = freeTiles(rm, 4); if (ft.length) { const [x, y] = pick(ft); ch.x = x; ch.y = y; ch.ex = { ...ch.ex, up: rnd() < 0.5 ? 1 : 0 }; computeGrid(rm); } }
  for (const o of rm.objs) if (o.creep && o.moves < 6 && rnd() < 0.45) { creepStep(o, true); }
}
function roomEvents(rm, first) {
  const id = rm.id;
  if (id === 'nursery') { G.boxOn = first || rnd() < 0.5; G.boxI = 0; G.boxT = 0.5; G.boxLit = 0; }
  else G.boxOn = false;
  if (first) {
    if (id === 'foyer') {}
    if (id === 'pantry') spawnCat(7, 8);
    if (id === 'attic') { setTimeout(() => { if (G.room === rm && G.state === 'play') { AU.footsAbove(); scare(0.5); } }, 1200); }
    if (id === 'master') addTimer(2.2, () => { AU.slam(0.6); G.shake = 0.3; scare(0.6); });
    if (id === 'wine') addTimer(3, () => { AU.footsAbove(); scare(0.4); });
    if (id === 'kennel') G.ents.push({ type: 'eyes', x: 188, y: 70, x2: 196, life: 9, t: 0, dog: 1, col: C.v3, growl: 1 });
    if (id === 'coal') G.ents.push({ type: 'eyes', x: 222, y: 186, x2: 229, life: 7, t: 0, dog: 1, col: C.v3, growl: 1 });
    if (id === 'breaker') showMsg('THE MAIN BREAKER IS ON THE FAR WALL.', 3);
    if (id === 'cstairs') showMsg('THE BASEMENT. THE AIR IS WET AND COLD.', 3);
  }
  if (id === 'dining' && !G.dragDone && (rm.enters >= 2 || G.playT > 50)) addTimer(1.6, () => startDrag() );
  if (id === 'gallery' && first) addTimer(4, () => { AU.whisper(-0.5); scare(0.3); });
  if (id === 'sewing' && first) addTimer(3, () => { AU.creak(0.3); });
}

// ---------- lighting ----------
const RANGE = 124, COS_IN = Math.cos(0.33), COS_OUT = Math.cos(0.5);
function computeLight() {
  const rm = G.room; const amb = rm.amb; const ox = P.x, oy = P.y - 7; const on = lightEff(); const inten = on ? G.flickInt : 0;
  const ca = Math.cos(P.ang), sa = Math.sin(P.ang); const fl = G.flash; const faint = G.hidden ? 0 : 1;
  for (let cy = 0; cy < LH; cy++) {
    const y = cy * 2 + 1, dy = y - oy;
    for (let cx = 0; cx < LW; cx++) {
      const i = cy * LW + cx; const x = cx * 2 + 1, dx = x - ox; const d2 = dx * dx + dy * dy;
      let L = amb[i];
      if (faint && d2 < 900) L += 0.62 * (1 - Math.sqrt(d2) / 30);
      if (inten > 0 && d2 < RANGE * RANGE) {
        const d = Math.sqrt(d2) + 0.001; const dot = (dx * ca + dy * sa) / d;
        if (dot > COS_OUT) { let e = (dot - COS_OUT) / (COS_IN - COS_OUT); if (e > 1) e = 1; L += inten * e * (0.35 + 1.1 * (1 - d / RANGE)); }
        if (d < 16) L += inten * 0.35;
      }
      if (fl > L) L = fl;
      LM[i] = L;
    }
  }
}
function lightAt(x, y) { const cx = clamp(x >> 1, 0, LW - 1), cy = clamp(y >> 1, 0, LH - 1); return LM[cy * LW + cx]; }
function beamAt(x, y) {
  if (!lightEff()) return 0; const dx = x - P.x, dy = y - (P.y - 7); const d = Math.hypot(dx, dy) + 0.001; if (d > RANGE) return 0;
  const dot = (dx * Math.cos(P.ang) + dy * Math.sin(P.ang)) / d; if (dot < COS_OUT + 0.02) return d < 18 ? 0.6 : 0; return 1 - d / RANGE * 0.5;
}

// ---------- pathing ----------
function bfs(sx, sy, goalFn, block) {
  const prev = new Int16Array(COLS * ROWS).fill(-1); const q = [sy * COLS + sx]; prev[q[0]] = q[0];
  while (q.length) {
    const c = q.shift(); const x = c % COLS, y = (c / COLS) | 0;
    if (goalFn(x, y)) { const path = []; let k = c; while (k !== sy * COLS + sx) { path.unshift(k); k = prev[k]; } return path; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue; const n = ny * COLS + nx;
      if (prev[n] !== -1 || G.room.grid[n] || (block && block(nx, ny))) continue; prev[n] = c; q.push(n);
    }
  }
  return null;
}

// ---------- creepers (statues, dress forms, dust sheets) ----------
function creepStep(o, offscreen) {
  const rm = G.room; const ptx = Math.floor(P.x / 16), pty = Math.floor(P.y / 16);
  if (Math.abs(o.x - ptx) + Math.abs(o.y - pty) <= 2) return false;
  rm.grid[o.y * COLS + o.x] = 0;
  const path = bfs(o.x, o.y, (x, y) => Math.abs(x - ptx) + Math.abs(y - pty) <= 1, (x, y) => (x === 7 || x === 8) && (y <= 2 || y >= 12) || (y === 6 || y === 7) && (x <= 1 || x >= 14) || (!offscreen && lightAt(x * 16 + 8, y * 16 - 4) > 0.4) || y < 2 || x < 1 || x > 14 || y > 12);
  let moved = false;
  if (path && path.length > 1) {
    const n = path[0]; const nx = n % COLS, ny = (n / COLS) | 0;
    if (!(nx === ptx && ny === pty) && Math.abs(nx - ptx) + Math.abs(ny - pty) >= 2 && !rm.objs.some((b) => b !== o && !b.wall && b.t !== 'rug' && nx >= b.x && nx < b.x + b.w && ny >= b.y && ny < b.y + b.h)) { o.x = nx; o.y = ny; moved = true; }
  }
  if (moved || offscreen) { o.moves++; o.v = o.moves >= 3 ? 'reach' : 'face'; }
  computeGrid(rm);
  return moved;
}
function updateCreepers(dt) {
  if (G.roomT < 2.5) return;
  for (const o of G.room.objs) {
    if (!o.creep) continue;
    const seen = lightAt(o.x * 16 + 8, o.y * 16 - 2) > 0.42 || lightAt(o.x * 16 + 8, o.y * 16 + 8) > 0.42;
    const d = Math.hypot(o.x * 16 + 8 - P.x, o.y * 16 + 8 - P.y);
    if (seen) { o.unseen = Math.max(0, o.unseen - dt * 2); continue; }
    if (d < 40 || o.moves >= 7) continue;
    o.unseen += dt * (G.flickOff ? 2.5 : 1);
    if (o.unseen > o.th) { o.unseen = 0; o.th = R(2.5, 6); if (creepStep(o, false)) { AU.scrape((o.x * 16 - P.x) / 128); G.tension = clamp(G.tension + 0.15, 0, 1.5); } }
  }
}

// ---------- ambient scares ----------
function spawnCat(tx, ty) { G.ents.push({ type: 'cat', x: tx * 16 + 8, y: ty * 16 + 12, st: 'sit', t: 0, lit: 0 }); }
function startDrag() {
  if (G.room.id !== 'dining' || G.dragDone || G.state !== 'play') return; G.dragDone = true;
  const ch = G.room.objs.find((o) => o.t === 'chair'); const row = Math.abs(P.y - 170) < 40 ? 4 : 10;
  ch.dragging = true; computeGrid(G.room);
  G.ents.push({ type: 'drag', x: 18, y: row * 16 + 12, ch, t: 0, row });
  if (G.room.windows.length) lightning(true); AU.scrape(-0.6); scare(0.8); AU.sting(false);
}
function spawnDart() {
  const side = rnd() < 0.5 ? -1 : 1; const d = R(55, 90); const ca = Math.cos(P.ang), sa = Math.sin(P.ang);
  const cx = P.x + ca * d, cy = P.y - 7 + sa * d; const px = -sa * side, py = ca * side;
  G.ents.push({ type: 'dart', x: cx + px * 70, y: cy + py * 70, vx: -px * 330, vy: -py * 330, life: 0.45 }); AU.whoosh(side * 0.6); scare(0.5);
}
function lightning(force) {
  if (G.room.windows.length || force) { G.flashQ = [[0, 0.07], [0.16, 0.05], [0.34, 0.09]]; G.flashT = 0; AU.thunder(R(0.3, 0.9)); }
  else { AU.thunder(R(0.6, 1.4)); G.shake = 0.15; }
}
function ambientScare() {
  const rm = G.room; const pool = [['dart', 3], ['slam', 1.2], ['whisper', 1.2], ['creak', 1.4], ['bark', rm.f <= 1 ? 1 : 0.3], ['foot', rm.f < 2 || rm.id === 'attic' ? 1.4 : 0.6], ['cat', 0.6], ['eyes', 0.7]];
  let tot = pool.reduce((a, b) => a + b[1], 0), r = rnd() * tot, kind = 'dart'; for (const [k, w] of pool) { r -= w; if (r <= 0) { kind = k; break; } }
  if (kind === 'dart' && lightEff()) spawnDart();
  else if (kind === 'slam') { AU.slam(R(-1, 1)); G.shake = 0.3; scare(0.6); if (rnd() < 0.5) triggerFlicker(true); }
  else if (kind === 'whisper') { AU.whisper(R(-0.8, 0.8)); scare(0.4); }
  else if (kind === 'creak') { AU.creak(R(-1, 1)); scare(0.2); }
  else if (kind === 'bark') { AU.bark(R(-1, 1), true); scare(0.3); }
  else if (kind === 'foot') { AU.footsAbove(); scare(0.4); }
  else if (kind === 'cat') { const ft = freeTiles(rm, 5); if (ft.length) { const [x, y] = pick(ft); spawnCat(x, y); } }
  else if (kind === 'eyes') { const ft = freeTiles(rm, 6).filter(([x, y]) => lightAt(x * 16 + 8, y * 16 + 8) < 0.2); if (ft.length) { const [x, y] = pick(ft); G.ents.push({ type: 'eyes', x: x * 16 + 5, y: y * 16 + 4, x2: x * 16 + 11, life: R(3, 6), t: 0, col: C.y1 }); AU.whisper(0); scare(0.3); } }
  else if (lightEff()) spawnDart();
}
function triggerFlicker(black) {
  if (G.noFlicker) return;
  if (black) { G.blk = R(0.5, 2); onBlackout(); } else G.stut = R(0.2, 0.6);
}
function onBlackout() {
  if (G.noThreat || G.threat || G.hidden || SAFE.has(G.room.id) || G.state !== 'play') return;
  if (G.playT < G.threatNext) return;
  if (G.threatFirst && rnd() > 0.65) { G.threatNext = G.playT + R(10, 25); return; }
  spawnThreat();
}
function spawnThreat() {
  const rm = G.room; const ft = freeTiles(rm, 6); if (!ft.length) return;
  ft.sort((a, b) => Math.hypot(b[0] * 16 - P.x, b[1] * 16 - P.y) - Math.hypot(a[0] * 16 - P.x, a[1] * 16 - P.y));
  const [x, y] = ft[Math.floor(rnd() * Math.min(5, ft.length))];
  G.threat = { room: rm.id, x: x * 16 + 8, y: y * 16 + 12, burn: 0, life: 0, f: 0, fade: 0, hid: 0 };
  G.blk = Math.max(G.blk, 1.3); AU.appear(); scare(1);
  if (!G.threatFirst) { G.threatFirst = true; addTimer(1.4, () => showMsg('SOMETHING TALL IS IN THE ROOM. KEEP YOUR LIGHT ON IT - OR HIDE IN A WARDROBE.', 5) ); }
}
function updateThreat(dt) {
  const T = G.threat; if (!T) return;
  T.life += dt; T.f += dt;
  if (T.fade > 0) { T.fade += dt; if (T.fade > 0.6) { G.threat = null; } return; }
  const dx = P.x - T.x, dy = P.y - T.y; const d = Math.hypot(dx, dy);
  if (G.hidden) { T.hid += dt; T.x += Math.sin(T.life * 0.9) * 10 * dt; if (T.hid > 4.5) { T.fade = 0.01; G.threatNext = G.playT + R(50, 80); setTimeout(() => G.state === 'play' && showMsg('IT IS GONE. FOR NOW.', 2.5), 600); } return; }
  const lit = beamAt(T.x, T.y - 18) > 0.3 || beamAt(T.x, T.y - 6) > 0.3 || G.flash > 0.5;
  if (lit) { T.burn += dt; if (T.burn > 1.1) { T.fade = 0.01; AU.hiss(); scare(0.3); G.threatNext = G.playT + R(45, 80); if (!G.repelMsg) { G.repelMsg = 1; showMsg('IT SHRANK FROM THE LIGHT.', 2.5); } } return; }
  T.burn = Math.max(0, T.burn - dt * 0.5);
  const sp = lightEff() ? 10 : 30;
  if (d > 1) { T.x = clamp(T.x + dx / d * sp * dt, 20, VW - 20); T.y = clamp(T.y + dy / d * sp * dt, 40, VH - 20); } // it glides through furniture
  if (d < 10) caught();
  if (T.life > 45) { T.fade = 0.01; G.threatNext = G.playT + R(40, 70); }
}
function caught() { G.state = 'caught'; G.et = 0; G.threat = null; G.catches++; AU.sting(true); AU.noise(1.2, 0.3, 2000, 'bandpass', 0, 0.5); G.blk = 0; }
function respawn() {
  const c = G.check; G.state = 'play'; G.hidden = null; G.threat = null; G.ents = []; G.blk = 0; G.stut = 0; G.lightUser = true; G.battery = Math.max(G.battery, 0.5); G.threatNext = G.playT + R(35, 55); G.msg = null;
  enterRoom(c.room, 'pos', { x: c.x, y: c.y }); showMsg('YOU WAKE ON THE STAIRS, HEART POUNDING.', 3);
}

// ---------- entities ----------
function updateEnts(dt) {
  for (const e of G.ents) e.t = (e.t || 0) + dt;
  G.ents = G.ents.filter((e) => {
    if (e.type === 'timer') return entTimer(e);
    if (e.type === 'dart') { e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt; return e.life > 0; }
    if (e.type === 'cat') return entCat(e, dt);
    if (e.type === 'eyes') { const lit = lightAt(e.x + 3, e.y) > 0.38; if (e.growl && e.t > 0.3 && !e.g) { e.g = 1; AU.growl((e.x - P.x) / 128); scare(0.5); } if (lit && e.t > 0.15) { if (e.dog) { AU.bark(R(-1, 1), true); } return false; } return e.t < e.life; }
    if (e.type === 'drag') return entDrag(e, dt);
    return true;
  });
}
function entTimer(e) { if (e.t >= e.tFire) { e.fn(); return false; } return true; }
function entCat(e, dt) {
  const d = Math.hypot(P.x - e.x, P.y - e.y);
  if (e.st === 'sit') { if (lightAt(e.x, e.y - 4) > 0.5) e.lit += dt; if (d < 52 || e.lit > 0.35 || e.t > 12) { e.st = 'run'; AU.screech(); scare(0.8); G.tension += 0.2; const ex = e.x < P.x ? -1 : 1; e.vx = ex * 190; e.vy = R(-40, 40); e.t = 0; } return true; }
  e.x += e.vx * dt; e.y += e.vy * dt; if (e.y < 40 || e.y > 200) e.vy *= -1; return e.t < 1.3 && e.x > -16 && e.x < VW + 16;
}
function entDrag(e, dt) {
  e.x += 46 * dt; e.ch.px = e.x - 18; e.ch.py = e.y - 12;
  if ((e.st = (e.st || 0) + dt) > 0.45) { e.st = 0; AU.scrape(clamp((e.x - P.x) / 128, -1, 1)); }
  if (e.x > 13 * 16 + 8 || e.t > 6) {
    const tx = clamp(Math.round((e.x - 26) / 16), 2, 12); e.ch.x = tx; e.ch.y = e.row; e.ch.dragging = false; e.ch.px = undefined; e.ch.py = undefined; e.ch.ex = { ...e.ch.ex, up: 0 };
    if (Math.abs(tx - Math.floor(P.x / 16)) + Math.abs(e.row - Math.floor(P.y / 16)) < 1) e.ch.x = clamp(tx - 1, 2, 12);
    computeGrid(G.room); G.blk = Math.max(G.blk, 0.6); return false;
  }
  return true;
}
function addTimer(t, fn) { G.ents.push({ type: 'timer', t: 0, tFire: t, fn }); }

// ---------- interaction ----------
function objRect(o) {
  if (o.t === 'frontdoor') return [o.x * 16, 196, 32, 28];
  if (o.wall) return [o.x * 16, 0, o.w * 16, 44];
  return [o.x * 16 - 3, o.y * 16 - 3, o.w * 16 + 6, o.h * 16 + 6];
}
function findTarget() {
  const fx = P.x + Math.cos(P.ang) * 11, fy = P.y - 2 + Math.sin(P.ang) * 11; let best = null, bd = 1e9;
  for (const o of G.room.objs) {
    if (o.taken || o.t === 'rug') continue; if (!o.wall && !OT[o.t].t && !o.it && o.t !== 'note' && o.t !== 'stairs') continue;
    if (o.t === 'stairs' && !o.locked) continue;
    const [x, y, w, h] = objRect(o);
    const inF = fx >= x && fx < x + w && fy >= y && fy < y + h; const inP = P.x >= x && P.x < x + w && P.y >= y && P.y < y + h;
    if (!inF && !inP) continue;
    const d = Math.hypot(x + w / 2 - fx, y + h / 2 - fy) - (inF ? 100 : 0); if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function give(it) {
  if (it === 'battery') { G.battery = Math.min(1, G.battery + 0.5); AU.battery(); G.deadMsg = false; showMsg(ITEMS.battery.msg, 2.2); return; }
  G.inv[it] = 1; AU.pickup(); showMsg(ITEMS[it].msg, 4);
  if (it === 'key') { G.threatNext = Math.min(G.threatNext, G.playT + 12); }
}
function interact() {
  if (G.hidden) { unhide(); return; }
  const o = findTarget();
  if (!o) { if (G.msg) G.msg = null; return; }
  if (o.t === 'item') { o.taken = 1; give(o.it); return; }
  if (o.t === 'note') { showMsg(o.ex.text, 7); AU.click(); return; }
  if (o.t === 'desk' && o.it && !o.taken) { o.taken = 1; o.it2 = o.it; give(o.it); o.it = null; return; }
  if (o.t === 'wardrobe') { hide(o); return; }
  if (o.t === 'stairs' && o.locked && !o.open) { tryUnlock(o); return; }
  if (o.t === 'breaker') { useBreaker(o); return; }
  if (o.t === 'portrait') { showMsg(o.ex.master ? 'THE MASTER OF THE HOUSE. HIS EYES ARE PAINTED SHUT. THEY WERE OPEN A MOMENT AGO.' : OT.portrait.t, 4); return; }
  const t = OT[o.t].t; if (t) { showMsg(t, 3.5); if (o.creep && o.v !== 'away') { AU.tone(70, 0.5, 'triangle', 0.08); } }
}
function tryUnlock(o) {
  if (G.inv.key) { o.open = true; o.locked = false; o.s = false; o.vkey = 'open'; computeGrid(G.room); AU.creak(0); AU.clunk(); showMsg('THE KEY TURNS. THE CELLAR DOOR GROANS OPEN. STAIRS LEAD DOWN.', 3.5); }
  else { AU.locked(); if (!G.msg || G.lockMsgT < G.t) { showMsg('A TRAPDOOR TO THE CELLAR, PADLOCKED. THE KEY MUST BE SOMEWHERE.', 3.5); G.lockMsgT = G.t + 4; } }
}
function useBreaker(o) {
  const inst = []; if (G.inv.handle && !G.installed.handle) { G.installed.handle = 1; inst.push('HANDLE'); } if (G.inv.fuse && !G.installed.fuse) { G.installed.fuse = 1; inst.push('FUSE'); }
  o.handle = G.installed.handle; o.fuse = G.installed.fuse; o.vkey = '' + o.handle + o.fuse;
  if (inst.length) AU.clunk();
  if (G.installed.handle && G.installed.fuse) { startEnding(o); return; }
  const miss = []; if (!G.installed.handle) miss.push('ITS HANDLE IS MISSING'); if (!G.installed.fuse) miss.push('THE MAIN FUSE SOCKET IS EMPTY');
  showMsg((inst.length ? 'YOU FIT THE ' + inst.join(' AND ') + '. ' : 'THE MAIN BREAKER. ') + miss.join(' AND ') + '.', 4.5);
  G.breakerSeen = 1;
}
function hide(o) { G.hidden = o; G.hideSave = { x: P.x, y: P.y }; AU.creak(0); AU.tone(110, 0.15, 'triangle', 0.1); showMsg('YOU SQUEEZE INTO THE WARDROBE. (E TO LEAVE)', 3); }
function unhide() { G.hidden = null; AU.creak(0); }

// ---------- player update ----------
const keys = new Set(); const pressed = new Set();
function inputVec() {
  let x = 0, y = 0;
  if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) x -= 1; if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) x += 1;
  if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) y -= 1; if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) y += 1;
  if (BOT && G.bot) { x = G.bot.x; y = G.bot.y; }
  return [x, y];
}
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function updatePlayer(dt) {
  if (G.hidden) return;
  const [ix, iy] = inputVec(); P.moving = !!(ix || iy);
  if (P.moving) {
    const ta = Math.atan2(iy, ix); P.ang += angDiff(P.ang, ta) * Math.min(1, dt * 16);
    P.dir = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? 'right' : 'left') : (iy > 0 ? 'down' : 'up');
    if (Math.abs(ix) && Math.abs(iy)) P.dir = iy > 0 ? 'down' : 'up';
    const n = Math.hypot(ix, iy); const sp = 54; const mx = ix / n * sp * dt, my = iy / n * sp * dt;
    if (boxFree(P.x + mx, P.y)) P.x += mx; else if (!iy) { for (const o of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]) if (boxFree(P.x + mx, P.y + o)) { P.y += Math.sign(o) * Math.min(1, sp * dt); break; } }
    if (boxFree(P.x, P.y + my)) P.y += my; else if (!ix) { for (const o of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]) if (boxFree(P.x + o, P.y + my)) { P.x += Math.sign(o) * Math.min(1, sp * dt); break; } }
    P.walk += dt * 7; G.stepT -= dt; if (G.stepT <= 0) { G.stepT = 0.29; G.stepAlt = !G.stepAlt; AU.step(G.room.fl.startsWith('carpet') ? 'carpet' : G.room.fl, G.stepAlt); }
  } else P.walk = 0;
  // locked stairs bump
  for (const o of G.room.objs) if (o.t === 'stairs' && o.locked && !o.open) { const [x, y, w, h] = objRect(o); if (P.x > x && P.x < x + w && P.y > y && P.y < y + h + 4) { if (G.inv.key) tryUnlock(o); } }
  // exits
  const rm = G.room;
  if (P.x < 3 && rm.doors.W) return enterRoom(rm.doors.W, 'door', { dir: 'W' });
  if (P.x > VW - 3 && rm.doors.E) return enterRoom(rm.doors.E, 'door', { dir: 'E' });
  if (P.y < 8 && rm.doors.N) return enterRoom(rm.doors.N, 'door', { dir: 'N' });
  if (P.y > VH - 3 && rm.doors.S) return enterRoom(rm.doors.S, 'door', { dir: 'S' });
  // stairs
  for (const o of rm.objs) if (o.t === 'stairs' && o.open) { const x = o.x * 16 + 3, y = o.y * 16 + 2, w = o.w * 16 - 6, h = o.h * 16 - 6; if (P.x > x && P.x < x + w && P.y > y && P.y < y + h) { AU.stairs(); const from = rm.id; enterRoom(o.to, 'stairs', { from }); showMsg(FLOORNAME[G.room.f] + ' - ' + G.room.n, 2); return; } }
  // floor items
  for (const o of rm.objs) if (o.t === 'item' && !o.taken && Math.hypot(o.x * 16 + 8 - P.x, o.y * 16 + 10 - P.y) < 11) { o.taken = 1; give(o.it); }
}
function updateFlicker(dt) {
  G.flickInt = 0.93 + Math.sin(G.t * 31) * 0.03 + rnd() * 0.04;
  if (G.noFlicker) { G.flickOff = false; return; }
  if (G.blk > 0) { G.blk -= dt; G.flickOff = true; if (G.blk <= 0) { G.flickOff = false; AU.click(); } return; }
  if (G.stut > 0) { G.stut -= dt; if ((G.sflip = (G.sflip || 0) - dt) <= 0) { G.sflip = R(0.03, 0.09); G.flickOff = !G.flickOff; } if (G.stut <= 0) G.flickOff = false; return; }
  G.flickOff = false;
  if (!G.lightUser || G.battery <= 0) return;
  const p = 0.035 + G.tension * 0.12 + (G.battery < 0.25 ? 0.12 : 0) + (G.battery < 0.1 ? 0.25 : 0) + (G.threat ? 0.15 : 0);
  if (rnd() < p * dt) { if (rnd() < 0.3 + (G.playT > G.threatNext ? 0.25 : 0)) { G.blk = R(0.5, 2); AU.click(); onBlackout(); } else G.stut = R(0.2, 0.55); }
}
function updatePlay(dt) {
  G.playT += dt; G.roomT += dt; G.tension = Math.max(0, G.tension - dt * 0.04);
  if (G.msg) { G.msg.t -= dt; if (G.msg.t <= 0) G.msg = null; }
  if (pressed.has('light')) { if (G.battery <= 0) { AU.click(); showMsg('THE BATTERY IS DEAD.', 2); } else { G.lightUser = !G.lightUser; AU.click(); } }
  if (pressed.has('use')) interact();
  if (pressed.has('map')) G.map = !G.map;
  updatePlayer(dt); if (G.state !== 'play') return;
  if (lightEff()) { G.battery = Math.max(0, G.battery - dt / 190); if (G.battery <= 0 && !G.deadMsg) { G.deadMsg = true; showMsg('THE FLASHLIGHT DIES. FIND BATTERIES.', 3); AU.tone(300, 0.3, 'square', 0.05, 0, 80); } }
  if (!lightEff() && !G.hidden) { G.lightOffT += dt; if (G.lightOffT > 2 && G.playT > G.threatNext && !G.threat) { G.lightOffT = 0; if (rnd() < 0.5) onBlackout(); } } else G.lightOffT = 0;
  updateFlicker(dt);
  // flashes
  if (G.flashQ.length) { G.flashT += dt; G.flash = 0; for (const [s, d] of G.flashQ) if (G.flashT >= s && G.flashT < s + d) G.flash = 1.3; if (G.flashT > 0.6) { G.flashQ = []; G.flash = 0; } } else G.flash = 0;
  G.nextLightning -= dt; if (G.nextLightning <= 0) { G.nextLightning = R(18, 45); lightning(false); }
  computeLight();
  updateCreepers(dt); updateThreat(dt); updateEnts(dt);
  if (G.state !== 'play') return;
  G.quiet += dt; if (G.quiet > G.nextAmbient && G.roomT > 3 && !G.threat) { G.quiet = 0; G.nextAmbient = R(16, 36); ambientScare(); }
  // threat overdue -> force a blackout
  if (!G.threat && !G.noThreat && G.playT > G.threatNext + 40 && !SAFE.has(G.room.id) && G.roomT > 4 && lightEff()) { G.blk = R(1, 1.8); onBlackout(); }
  // nursery music box + rocker
  if (G.room.id === 'nursery') {
    const mb = G.room.objs.find((o) => o.t === 'musicbox'); const rk = G.room.objs.find((o) => o.t === 'rocker');
    if (G.boxOn) { G.boxT -= dt; if (G.boxT <= 0) { G.boxT = 0.38; AU.boxNote(G.boxI++); } if (lightAt(mb.x * 16 + 8, mb.y * 16 - 2) > 0.5) { G.boxLit += dt; if (G.boxLit > 1.2) { G.boxOn = false; AU.whisper(-0.4); scare(0.5); } } }
    const rlit = lightAt(rk.x * 16 + 8, rk.y * 16) > 0.5; G.rockLit = rlit ? G.rockLit + dt : Math.max(0, G.rockLit - dt * 0.5);
    const amp = clamp(1 - G.rockLit, 0, 1); G.rockPh = (G.rockPh || 0) + dt * 4.2 * (0.3 + amp * 0.7); G.rockAmp = amp;
    if (amp > 0.3 && Math.floor(G.rockPh / Math.PI) !== G.rockLast) { G.rockLast = Math.floor(G.rockPh / Math.PI); if (G.rockLast % 2 === 0) AU.creak((rk.x * 16 - P.x) / 128); }
  }
  // heartbeat + motif
  if (G.threat && !G.threat.fade) { const d = Math.hypot(P.x - G.threat.x, P.y - G.threat.y); G.beatT -= dt; if (G.beatT <= 0) { G.beatT = clamp(d / 160, 0.33, 1.05); AU.thump(clamp(0.7 - d / 400, 0.2, 0.7)); } }
  else if (G.tension > 0.8) { G.beatT -= dt; if (G.beatT <= 0) { G.beatT = 0.8; AU.thump(0.2); } }
  G.motifT -= dt; if (G.motifT <= 0) { G.motifT = R(1.2, 2.4); AU.motif(G.motifI++); }
  if (G.room.id === 'cistern' && rnd() < dt * 0.7) AU.drip(R(-0.6, 0.6));
  if (G.room.id === 'foyer' || G.room.id === 'dining' || G.room.id === 'parlor') { if ((G.tickT = (G.tickT || 0) - dt) <= 0) { G.tickT = 1; AU.tick(G.tickA = !G.tickA); } }
  if (G.shake > 0) G.shake -= dt;
}
