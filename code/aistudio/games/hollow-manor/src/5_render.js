// ---------- rendering ----------
function drawSpr(g, o, frame) { const s = sprOf(o, frame); if (!s) return; const x = (o.px !== undefined ? o.px : o.x * 16) + s.ox; const y = (o.py !== undefined ? o.py : o.y * 16) + s.oy; g.drawImage(s.c, Math.round(x), Math.round(y)); }
function drawRoom(rm, opt = {}) {
  const g = sc; g.drawImage(rm.static, 0, 0); if (!opt.lit && rm.moon) g.drawImage(rm.moon, 0, 0);
  // wall objects + floor-level
  for (const o of rm.objs) {
    if (o.t === 'rug' || o.taken && o.t !== 'desk') continue;
    if (o.t === 'window') { drawSpr(g, o, G.flash > 0.5 ? 1 : 0); continue; }
    if (o.wall && o.t !== 'frontdoor') {
      drawSpr(g, o, 0);
      if (o.t === 'portrait') { const ex = clamp(Math.round((P.x - (o.x * 16 + 8)) / 60), -1, 1), ey = P.y > 60 ? 1 : 0; const bx = o.x * 16 + 2; g.fillStyle = o.ex.master && !opt.lit ? C.n5 : C.K; if (!(o.ex.master && !opt.lit && rnd() < 0.0)) { g.fillRect(bx + 6 + (ex > 0 ? 1 : 0), 9 + ey, 1, 1); g.fillRect(bx + 9 + (ex >= 0 ? 1 : 0), 9 + ey, 1, 1); } }
      continue;
    }
    if (o.t === 'stairs') { drawSpr(g, o, 0); continue; }
    if (o.t === 'note') { g.drawImage(ART.note, o.x * 16, o.y * 16 + 2); continue; }
    if (o.t === 'item') { g.drawImage(ART.item[o.it], o.x * 16, o.y * 16 + 2 + (Math.sin(G.t * 3) > 0.6 ? -1 : 0)); continue; }
  }
  // sorted objects and actors
  const L = [];
  for (const o of rm.objs) {
    if (o.t === 'rug' || o.t === 'stairs' || o.t === 'note' || o.t === 'item' || o.wall) continue;
    const by = (o.py !== undefined ? o.py + 16 : (o.y + o.h) * 16);
    L.push([by, () => {
      if (o.creep) { const a = ART[o.t][o.v]; g.drawImage(a, o.x * 16, o.y * 16 - 16 + 1); return; }
      if (o.t === 'rocker' && rm.id === 'nursery') { const ph = Math.sin(G.rockPh || 0) * (G.rockAmp === undefined ? 1 : G.rockAmp); const s = sprOf(o, 0); g.drawImage(s.c, o.x * 16 + Math.round(ph * 1.5), o.y * 16 + s.oy + (Math.abs(ph) > 0.6 ? 1 : 0)); return; }
      if (o.t === 'hang') { drawSpr(g, o, (G.t * 0.8 | 0) & 1); return; }
      if (o.t === 'desk' && o.it && !opt.lit) { drawSpr(g, o, 0); g.drawImage(ART.item[o.it], o.x * 16 + 14, o.y * 16 - 10); return; }
      drawSpr(g, o, 0);
    }]);
  }
  if (!opt.noPlayer && !G.hidden) L.push([P.y + 2, () => { const f = P.moving ? Math.floor(P.walk) % 4 : 0; g.drawImage(ART.player[P.dir + f], Math.round(P.x - 8), Math.round(P.y - 14)); }]);
  const T = G.threat; if (T && !opt.noPlayer && T.room === rm.id && !(T.fade && (G.t * 30 | 0) % 2)) L.push([T.y, () => { const tf = ART.tall[(T.f * 2 | 0) % 2]; g.drawImage(tf, Math.round(T.x - 8 + (T.burn > 0 ? (rnd() * 3 | 0) - 1 : 0)), Math.round(T.y - 38)); }]);
  for (const e of G.ents) {
    if (e.type === 'cat') L.push([e.y, () => { if (e.st === 'sit') g.drawImage(ART.catSit, Math.round(e.x - 6), Math.round(e.y - 9)); else { const c = ART.cat[(e.t * 12 | 0) % 2]; if (e.vx < 0) g.drawImage(c, Math.round(e.x - 8), Math.round(e.y - 7)); else g.drawImage(mirror(c), Math.round(e.x - 8), Math.round(e.y - 7)); } }]);
    if (e.type === 'drag') L.push([e.y + 1, () => { g.drawImage(ART.shadow[(e.t * 4 | 0) % 2], Math.round(e.x - 8), Math.round(e.y - 27)); }]);
  }
  L.sort((a, b) => a[0] - b[0]); for (const [, f] of L) f();
  for (const e of G.ents) if (e.type === 'dart') g.drawImage(ART.dart, Math.round(e.x - 12), Math.round(e.y - 8));
  for (const o of rm.objs) if (o.t === 'frontdoor') drawSpr(g, o, 0);
}
function applyDarkness() {
  const id = sc.getImageData(0, 0, VW, VH); const u = new Uint32Array(id.data.buffer);
  for (let y = 0; y < VH; y++) {
    const ly = (y >> 1) * LW, by = (y & 3) << 2;
    for (let x = 0; x < VW; x++) {
      const L = LM[ly + (x >> 1)]; if (L >= 0.98) continue; const i = y * VW + x; const t = BAY[by + (x & 3)];
      if (L > 0.62 + 0.36 * t) continue;
      const p = u[i];
      if (L > 0.24 + 0.34 * t) { let d = DK1.get(p); if (d === undefined) { darkPair(p); d = DK1.get(p); } u[i] = d; }
      else if (L > 0.05 + 0.17 * t) { let d = DK2.get(p); if (d === undefined) { darkPair(p); d = DK2.get(p); } u[i] = d; }
      else u[i] = 0xff000000;
    }
  }
  sc.putImageData(id, 0, 0);
}
function postGlow() {
  const g = sc;
  // item glints so pickups are findable in the dark
  for (const o of G.room.objs) {
    const isIt = (o.t === 'item' && !o.taken) || (o.t === 'desk' && o.it) || o.t === 'note';
    if (!isIt) continue; const ph = (G.t * 0.9 + o.x * 0.37 + o.y * 0.11) % 1.6;
    if (ph < 0.22) { const cx = o.x * 16 + 8 + (o.t === 'desk' ? 14 : 0), cy = o.y * 16 + 8 + (o.t === 'desk' ? -6 : 0); const s = ph < 0.11 ? 1 : 2; g.fillStyle = o.t === 'note' ? C.g3 : C.g5; g.fillRect(cx, cy - s, 1, s * 2 + 1); g.fillRect(cx - s, cy, s * 2 + 1, 1); }
  }
  // eyes in the dark
  for (const e of G.ents) {
    if (e.type === 'eyes') { if ((e.t % 3.1) > 2.95) continue; g.fillStyle = e.col; g.fillRect(e.x, e.y, 2, 1); g.fillRect(e.x2, e.y, 2, 1); }
    if (e.type === 'cat' && e.st === 'sit' && lightAt(e.x, e.y - 5) < 0.5) { g.fillStyle = C.y0; g.fillRect(Math.round(e.x - 4), Math.round(e.y - 7), 1, 1); g.fillRect(Math.round(e.x - 2), Math.round(e.y - 7), 1, 1); }
  }
  const T = G.threat; if (T && !T.fade && T.room === G.room.id && (G.t % 4) < 3.8) { g.fillStyle = C.g5; g.fillRect(Math.round(T.x - 2), Math.round(T.y - 33), 1, 1); g.fillRect(Math.round(T.x + 1), Math.round(T.y - 33), 1, 1); }
  // the master's portrait eyes glint now and then
  for (const o of G.room.objs) if (o.t === 'portrait' && ((G.t + o.x) % 7) < 0.15) { g.fillStyle = C.r0; g.fillRect(o.x * 16 + 8, 11, 1, 1); g.fillRect(o.x * 16 + 11, 11, 1, 1); }
}
const preDark = mk(VW, VH);
function drawHidden() {
  const g = sc; const w = G.hidden; const cx = (w.x + 1) * 16; const wb = Math.min(VH - 40, (w.y + w.h) * 16);
  const crack = mk(4, VH - wb); crack.getContext('2d').drawImage(preDark, cx - 2, wb, 4, VH - wb, 0, 0, 4, VH - wb);
  g.fillStyle = C.K; g.fillRect(0, 0, VW, VH);
  // door panels, faintly lit from the crack
  for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) { const d = Math.abs(x - 128); const L = 0.55 - d / 190 + (Math.sin(y * 0.05) * 0.03); if (L > BAY[(y & 3) * 4 + (x & 3)]) { g.fillStyle = (x % 40 === 0 || (y % 60) === 0) ? C.K : (d < 40 ? C.n0 : C.nd); g.fillRect(x, y, 1, 1); } }
  // coats on hangers
  [[34, 1], [80, 0], [168, 0], [206, 1]].forEach(([x, k]) => { g.fillStyle = C.g2; g.fillRect(x + 18, 8, 2, 6); g.fillRect(x + 10, 13, 18, 1); g.fillStyle = C.K; g.fillRect(x + 6, 14, 26, 6); g.fillRect(x + 2, 20, 34, 110 + k * 20); g.fillRect(x + 6, 130 + k * 20, 26, 14); g.fillStyle = C.g1; const side = x < 128 ? x + 35 : x + 2; g.fillRect(side, 22, 1, 100 + k * 20); });
  g.fillStyle = C.g1; g.fillRect(0, 12, VW, 1);
  // the crack: a thin sliver of the room
  g.fillStyle = C.K; g.fillRect(120, 0, 16, VH); g.drawImage(crack, 0, 0, 4, VH - wb, 125, 0, 6, VH);
  g.fillStyle = C.K; for (let y = 0; y < VH; y += 2) g.fillRect(125 + ((y >> 1) & 1) * 5, y, 1, 1);
  g.fillStyle = C.n1; g.fillRect(123, 0, 2, VH); g.fillRect(131, 0, 2, VH);
  const T = G.threat; if (T && !T.fade) { const near = Math.abs(T.x - cx) < 16; if (near) { g.fillStyle = C.K; g.fillRect(125, 0, 6, VH); g.fillStyle = C.g5; g.fillRect(126, 92, 1, 1); g.fillRect(129, 92, 1, 1); } }
  txtC(g, 'HIDING. E TO LEAVE', 128, 206, C.g3);
}
function drawHUD(g) {
  g.fillStyle = C.K; g.fillRect(0, 0, 256, 16); g.fillStyle = C.g2; g.fillRect(0, 15, 256, 1);
  // battery
  g.fillStyle = C.g4; g.fillRect(3, 4, 22, 8); g.fillStyle = C.K; g.fillRect(4, 5, 20, 6); g.fillStyle = C.g4; g.fillRect(25, 6, 2, 4);
  const b = G.battery; g.fillStyle = b > 0.5 ? C.v2 : b > 0.25 ? C.y0 : C.r0; if (!(b < 0.15 && (G.t * 4 | 0) % 2)) g.fillRect(5, 6, Math.ceil(18 * b), 4);
  // flashlight state
  const on = G.lightUser && b > 0; g.fillStyle = on ? C.y1 : C.g2; g.fillRect(30, 6, 6, 4); g.fillRect(36, 5, 2, 6); if (on && !G.flickOff) { g.fillStyle = C.y0; g.fillRect(39, 4, 1, 1); g.fillRect(39, 11, 1, 1); g.fillRect(40, 7, 2, 2); }
  // items
  ['key', 'handle', 'fuse'].forEach((k, i) => { const x = 44 + i * 15; g.fillStyle = C.g1; g.fillRect(x, 1, 14, 14); if (G.inv[k]) g.drawImage(ART.icon[k], x - 1, 0); else { g.fillStyle = C.g2; g.fillRect(x + 6, 6, 2, 4); } });
  txt(g, G.room ? G.room.n : '', 92, 5, C.g4);
  if (G.room) { txt(g, FLOORNAME[G.room.f], 206, 5, C.y1); drawMini(g, 224, 2, G.room.f, 5, 3); }
  if (AU.muted) { g.fillStyle = C.r0; g.fillRect(250, 2, 4, 4); }
}
function drawMini(g, x0, y0, f, cw, ch) {
  for (const id in ROOMS) { const r = ROOMS[id]; if (r.f !== f) continue; const x = x0 + r.gx * (cw + 1), y = y0 + r.gy * (ch + 1);
    if (r === G.room) { g.fillStyle = (G.t * 3 | 0) % 2 ? C.y0 : C.g5; g.fillRect(x, y, cw, ch); } else if (r.visited) { g.fillStyle = C.g3; g.fillRect(x, y, cw, ch); } else { g.fillStyle = C.g1; g.fillRect(x, y, cw, ch); } }
}
function drawMap(g, f, litN) {
  g.fillStyle = C.K; g.fillRect(16, 26, 224, 196); g.fillStyle = C.g3; g.fillRect(16, 26, 224, 1); g.fillRect(16, 221, 224, 1); g.fillRect(16, 26, 1, 196); g.fillRect(239, 26, 1, 196);
  const titles = ['BASEMENT', 'GROUND FLOOR', 'SECOND FLOOR'];
  txtC(g, (litN === undefined ? 'MAP - ' : '') + FLOORNAME[f] + ' ' + titles[f], 128, 32, C.y1);
  const cw = 46, ch = 46, gap = 6, x0 = 128 - (4 * cw + 3 * gap) / 2, y0 = 48;
  let k = 0;
  for (const id in ROOMS) { const r = ROOMS[id]; if (r.f !== f) continue;
    const x = x0 + r.gx * (cw + gap), y = y0 + r.gy * (ch + gap); const lit = litN !== undefined && k++ < litN;
    const known = r.visited || lit || Object.values(r.doors).some((d) => ROOMS[d].visited);
    if (!known) continue;
    for (const d in r.doors) { if (!r.visited && !ROOMS[r.doors[d]].visited && !lit) continue; g.fillStyle = C.g3; if (d === 'E') g.fillRect(x + cw, y + ch / 2 - 3, gap, 6); if (d === 'S') g.fillRect(x + cw / 2 - 3, y + ch, 6, gap); }
    if (lit) { g.fillStyle = C.y1; g.fillRect(x, y, cw, ch); g.fillStyle = C.y0; g.fillRect(x + 2, y + 2, cw - 4, ch - 4); txtC(g, r.sn, x + cw / 2, y + 20, C.n1); continue; }
    if (r.visited) { g.fillStyle = C.g2; g.fillRect(x, y, cw, ch); g.fillStyle = C.g1; g.fillRect(x + 2, y + 2, cw - 4, ch - 4); txtC(g, r.sn, x + cw / 2, y + 20, C.g4); }
    else { g.fillStyle = C.g2; for (let i = 0; i < cw; i += 4) { g.fillRect(x + i, y, 2, 1); g.fillRect(x + i, y + ch - 1, 2, 1); } for (let i = 0; i < ch; i += 4) { g.fillRect(x, y + i, 1, 2); g.fillRect(x + cw - 1, y + i, 1, 2); } txtC(g, '?', x + cw / 2, y + 20, C.g2); }
    const st = r.objs.length ? r.objs.find((o) => o.t === 'stairs') : (r.o.find((o) => o[0] === 'stairs') && { dir: r.o.find((o) => o[0] === 'stairs')[3].dir });
    if (r.visited && st) txt(g, st.dir === 'up' ? '^' : '_', x + 3, y + 3, C.b2);
    if (r.visited && id === 'breaker') txt(g, '*', x + cw - 8, y + 3, C.r1);
    if (r === G.room && litN === undefined && (G.t * 3 | 0) % 2) { g.fillStyle = C.y0; g.fillRect(x, y, cw, 2); g.fillRect(x, y + ch - 2, cw, 2); g.fillRect(x, y, 2, ch); g.fillRect(x + cw - 2, y, 2, ch); }
  }
  if (litN === undefined) txtC(g, 'M - CLOSE', 128, 208, C.g3);
}
function drawMsg(g) {
  if (!G.msg) return; const n = G.msg.lines.length; const h = n * 9 + 8; const y = 240 - h - 4;
  g.fillStyle = C.K; g.fillRect(4, y, 248, h); g.fillStyle = C.g4; g.fillRect(4, y, 248, 1); g.fillRect(4, y + h - 1, 248, 1); g.fillRect(4, y, 1, h); g.fillRect(251, y, 1, h);
  G.msg.lines.forEach((l, i) => txt(g, l, 9, y + 5 + i * 9, C.g5));
}
function drawTitle(g) {
  const t = G.titleT; const fl = (t % 9) > 8.6 && ((t * 20 | 0) % 3 !== 0);
  g.fillStyle = fl ? C.b5 : C.K; g.fillRect(0, 0, 256, 240);
  if (!fl) { g.fillStyle = C.bd; for (let y = 0; y < 150; y++) for (let x = (y & 1); x < 256; x += 2) if (BAY[(y & 3) * 4 + (x & 3)] < 0.6 - y / 260) g.fillRect(x, y, 1, 1); }
  g.fillStyle = fl ? C.g5 : C.g4; g.fillRect(206, 62, 18, 18); g.fillRect(204, 65, 22, 12); g.fillRect(209, 60, 12, 22); g.fillStyle = fl ? C.b5 : C.g3; g.fillRect(210, 66, 5, 5); g.fillRect(218, 72, 3, 3); g.fillRect(212, 75, 2, 2);
  // manor silhouette
  g.fillStyle = C.K; const base = 196;
  g.fillRect(40, 120, 176, base - 120); g.fillRect(28, 140, 200, base - 140); g.fillRect(96, 92, 64, 40); g.fillRect(118, 66, 20, 30);
  for (let i = 0; i < 32; i++) g.fillRect(96 + i, 92 - Math.floor(i * 0.5), 64 - i * 2, 1);
  for (let i = 0; i < 22; i++) { g.fillRect(40 + i, 120 - i, 50 - i * 2 > 0 ? 50 - i * 2 : 1, 1); g.fillRect(166 + i, 120 - i, 50 - i * 2 > 0 ? 50 - i * 2 : 1, 1); }
  g.fillRect(60, 96, 6, 14); g.fillRect(186, 96, 6, 14); g.fillRect(126, 58, 4, 10);
  // windows (all dark... nearly)
  for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) { const x = 48 + i * 22, y = 146 + r * 22; if (x > 116 && x < 136) continue; g.fillStyle = fl ? C.b3 : C.g1; g.fillRect(x, y, 8, 12); g.fillStyle = C.K; g.fillRect(x + 3, y, 2, 12); g.fillRect(x, y + 5, 8, 1); }
  g.fillStyle = fl ? C.b3 : C.g1; g.fillRect(122, 76, 12, 14); if (fl) { g.fillStyle = C.K; g.fillRect(126, 78, 4, 12); g.fillRect(127, 77, 2, 2); }
  g.fillStyle = C.n0; g.fillRect(118, 170, 20, 26); g.fillStyle = C.K; g.fillRect(127, 170, 2, 26);
  // ground + rain
  g.fillStyle = C.K; g.fillRect(0, base, 256, 44); g.fillStyle = C.vd; for (let x = 0; x < 256; x += 3) g.fillRect(x, base + (x * 7 % 3), 2, 2);
  g.fillStyle = fl ? C.g5 : C.b4; for (let i = 0; i < 70; i++) { const x = (i * 53 + t * 140) % 270 - 10, y = (i * 37 + t * 300) % 240; g.fillRect(x | 0, y | 0, 1, 4); }
  txtC(g, 'LIGHTS OUT', 128, 14, C.g5, 3, C.r0);
  txtC(g, 'AT HOLLOW MANOR', 128, 42, C.y1, 1, C.rd);
  if ((t * 2 | 0) % 2) txtC(g, (TOUCH ? 'TAP TO BEGIN' : 'PRESS ENTER TO BEGIN'), 128, 206, C.g5);
  txtC(g, TOUCH ? 'PAD MOVE  LIGHT  USE  MAP' : 'ARROWS/WASD  F/SPACE LIGHT  E USE  M MAP', 128, 220, C.g3);
  txtC(g, 'N SOUND ON/OFF   (C) HOLLOW MANOR 2026', 128, 230, C.g2);
}
function drawIntro(g) {
  g.fillStyle = C.K; g.fillRect(0, 0, 256, 240);
  const L = ['3:07 AM. THE STORM TOOK THE POWER.', '', 'THE BREAKER IS DOWN IN THE BASEMENT.', 'YOU HAVE A FLASHLIGHT AND NOT', 'MUCH BATTERY.', '', 'THE HOUSE IS EMPTY.', '', 'IT IS SUPPOSED TO BE EMPTY.'];
  const n = Math.floor(G.et * 2.2);
  L.forEach((l, i) => { if (i < n) txtC(g, l, 128, 60 + i * 11, i === 8 ? C.r1 : C.g4); });
  if (G.et > 3 && (G.t * 2 | 0) % 2) txtC(g, TOUCH ? 'TAP USE' : 'PRESS E', 128, 200, C.g5);
}
function drawCaught(g) {
  const t = G.et; g.fillStyle = C.K; g.fillRect(0, 0, 256, 240);
  if (G.state === 'caught') {
    const s = 5 + Math.floor(t * 3); const f = ART.tallFace; g.drawImage(f, 0, 0, 32, 36, 128 - 16 * s, 120 - 18 * s, 32 * s, 36 * s);
    for (let i = 0; i < 900; i++) { g.fillStyle = rnd() < 0.5 ? C.g1 : C.g2; g.fillRect(rnd() * 256 | 0, rnd() * 240 | 0, 2, 1); }
    if (t > 0.9) { g.fillStyle = C.K; g.fillRect(0, 0, 256, 240); }
  } else {
    txtC(g, 'IT FOUND YOU.', 128, 90, C.r0, 2);
    txtC(g, 'THE DARK GOES QUIET...', 128, 124, C.g3);
    if (G.et > 1) txtC(g, TOUCH ? 'TAP USE TO WAKE AT THE LAST STAIRS' : 'PRESS E TO WAKE AT THE LAST STAIRS', 128, 170, (G.t * 2 | 0) % 2 ? C.g5 : C.g3);
  }
}
function drawEnd(g) {
  g.fillStyle = C.K; g.fillRect(0, 0, 256, 240);
  for (let i = 0; i < 9; i++) { const x = 21 + i * 25; g.fillStyle = C.n1; g.fillRect(x - 2, 14, 16, 22); g.fillStyle = (i === 6 && (G.t % 5) > 4.6) ? C.K : C.y0; g.fillRect(x, 16, 12, 18); g.fillStyle = C.y1; g.fillRect(x, 16, 5, 8); g.fillStyle = C.n1; g.fillRect(x + 5, 16, 2, 18); g.fillRect(x, 24, 12, 2); }
  txtC(g, 'THE LIGHTS ARE ON.', 128, 52, C.y1, 2, C.n1);
  txtC(g, 'HOLLOW MANOR IS QUIET AGAIN.', 128, 84, C.g4);
  txtC(g, 'THE STATUES WERE NEVER MOVED.', 128, 96, C.g4);
  txtC(g, 'NOBODY HAS LIVED HERE SINCE 1907.', 128, 108, C.g4);
  const s = Math.floor(G.endTime); txtC(g, 'TIME ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + '   SCARES ' + G.scares + '   CAUGHT ' + G.catches, 128, 140, C.g5);
  txtC(g, 'THANK YOU FOR PLAYING', 128, 176, C.r1);
  if ((G.t * 2 | 0) % 2) txtC(g, TOUCH ? 'TAP USE TO PLAY AGAIN' : 'PRESS E TO PLAY AGAIN', 128, 200, C.g5);
}

// ---------- ending sequence ----------
function startEnding(o) {
  G.state = 'ending'; G.et = 0; G.endTime = G.playT; G.breakerObj = o; G.threat = null; G.ents = []; G.hidden = null; G.msg = null; G.map = false;
  P.ang = -Math.PI / 2; P.dir = 'up'; P.moving = false; AU.clunk(); G.endStage = 0;
}
function updateEnding(dt) {
  G.et += dt; const t = G.et; const o = G.breakerObj;
  if (G.endStage === 0 && t > 0.5) { G.endStage = 1; o.on = 1; o.vkey = '11on'; AU.clunk(); }
  if (t > 0.6 && t < 1.7) { G.lit = rnd() < 0.45; if (rnd() < 0.3) AU.tone(R(110, 130), 0.05, 'sawtooth', 0.05); }
  if (G.endStage === 1 && t >= 1.7) { G.endStage = 2; G.lit = true; AU.humOn(); AU.chime(); AU.droneVol(0.02); }
  if (G.endStage === 2 && t >= 2.6) { G.endStage = 3; G.montage = 'map'; }
  if (G.endStage === 3 && t >= 6.2) { G.endStage = 4; G.montage = 'rooms'; for (const id of ['foyer', 'nursery', 'grand']) { const r = ROOMS[id]; buildRoom(r); for (const ob of r.objs) if (ob.creep) { ob.x = ob.x0; ob.y = ob.y0; ob.v = 'away'; } computeGrid(r); if (!r.static) renderStatic(r); } }
  if (G.endStage === 4 && t >= 9.8) { G.endStage = 5; G.montage = null; showMsg('THE LIGHTS ARE ON. FINALLY.', 2.4); }
  if (G.endStage === 5 && t >= 12.0) { G.endStage = 6; G.lit = false; G.msg = null; AU.pop(); AU.humOff(); }
  if (G.endStage === 6 && t >= 12.5) {
    G.endStage = 7; G.lit = true; AU.humOn(); AU.sting(true); G.shake = 0.5;
    const tx = Math.floor(P.x / 16), ty = Math.floor(P.y / 16); const rm = G.room;
    [[tx - 1, ty], [tx + 1, ty], [tx, ty + 2]].forEach(([x, y], i) => rm.objs.push({ t: 'statue', x, y, x0: x, y0: y, w: 1, h: 1, ex: {}, creep: 1, v: i === 2 ? 'reach' : 'face', moves: 99, unseen: 0, th: 999, s: 0 }));
    P.dir = 'down'; P.ang = Math.PI / 2;
  }
  if (G.endStage === 7 && t >= 15.2) { G.endStage = 8; G.lit = false; AU.humOff(); }
  if (G.endStage === 8 && t >= 16.2) { G.state = 'end'; G.et = 0; AU.chime(); }
  if (G.msg) { G.msg.t -= dt; if (G.msg.t <= 0) G.msg = null; }
}
function renderEnding(g) {
  const t = G.et;
  if (G.montage === 'map') { g.fillStyle = C.K; g.fillRect(0, 0, 256, 240); const p = (t - 2.6) / 3.6; const f = p < 0.33 ? 0 : p < 0.66 ? 1 : 2; const n = Math.floor(((p * 3) % 1) * 14); drawMap(g, f, n); txtC(g, 'POWER RESTORED', 128, 228, C.y1); return; }
  if (G.montage === 'rooms') { const k = Math.min(2, Math.floor((t - 6.2) / 1.2)); const rm = ROOMS[['foyer', 'nursery', 'grand'][k]]; const saveRoom = G.room; G.room = rm; G.rockAmp = 0; drawRoom(rm, { noPlayer: true, lit: true }); G.room = saveRoom; g.drawImage(scene, 0, HUD); g.fillStyle = C.K; g.fillRect(0, 0, 256, 16); txtC(g, FLOORNAME[rm.f] + ' - ' + rm.n, 128, 5, C.y1); return; }
  drawRoom(G.room, { lit: G.lit });
  if (!G.lit) { sc.fillStyle = C.K; sc.fillRect(0, 0, VW, VH); if (G.endStage < 2) { computeLight(); drawRoom(G.room, {}); applyDarkness(); } }
  const sh = G.shake > 0 ? (rnd() * 4 | 0) - 2 : 0; g.fillStyle = C.K; g.fillRect(0, 16, 256, 224); g.drawImage(scene, sh, HUD); drawHUD(g); drawMsg(g);
  if (G.endStage >= 8) { g.fillStyle = C.K; g.fillRect(0, 0, 256, 240); }
}

function render() {
  const g = ctx; g.imageSmoothingEnabled = false;
  if (G.state === 'title') return drawTitle(g);
  if (G.state === 'intro') return drawIntro(g);
  if (G.state === 'caught' || G.state === 'gameover') return drawCaught(g);
  if (G.state === 'end') return drawEnd(g);
  if (G.state === 'ending') return renderEnding(g);
  drawRoom(G.room, {});
  if (G.hidden) { const pg = preDark.getContext('2d'); pg.drawImage(scene, 0, 0); drawHidden(); } else { applyDarkness(); postGlow(); }
  const sh = G.shake > 0 ? (rnd() * 4 | 0) - 2 : 0;
  g.fillStyle = C.K; g.fillRect(0, 16, 256, 224); g.drawImage(scene, sh, HUD + (G.shake > 0 ? (rnd() * 2 | 0) : 0));
  drawHUD(g);
  if (G.map) drawMap(g, G.room.f);
  drawMsg(g);
}

// ---------- flow ----------
function startGame(skipIntro) {
  G.state = skipIntro ? 'play' : 'intro'; G.et = 0;
  if (skipIntro) beginPlay();
}
function beginPlay() {
  G.state = 'play'; G.playT = 0; enterRoom('foyer', 'pos', { x: 128, y: 186 }); P.ang = -Math.PI / 2; P.dir = 'up'; G.check = { room: 'foyer', x: 128, y: 186 };
  showMsg('THE FLASHLIGHT IS YOUR ONLY LIGHT. ' + (TOUCH ? 'LIGHT' : 'F') + ' TOGGLES IT. A NOTE LIES ON THE FLOOR.', 5);
}
function update(dt) {
  G.t += dt;
  if (G.state === 'title') { G.titleT += dt; if (pressed.has('start') || pressed.has('use') || pressed.has('any')) startGame(BOT); return; }
  if (G.state === 'intro') { G.et += dt; if ((pressed.has('use') || pressed.has('start')) && G.et > 0.6) beginPlay(); return; }
  if (G.state === 'caught') { G.et += dt; if (G.et > 1.3) { G.state = 'gameover'; G.et = 0; } return; }
  if (G.state === 'gameover') { G.et += dt; if (G.et > 1 && (pressed.has('use') || pressed.has('start'))) respawn(); return; }
  if (G.state === 'ending') return updateEnding(dt);
  if (G.state === 'end') { G.et += dt; if (G.et > 2 && (pressed.has('use') || pressed.has('start'))) location.reload(); return; }
  if (BOT) botThink(dt);
  updatePlay(dt);
}

// ---------- input ----------
const TOUCH = QS.has('touch') || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const KEYACT = { f: 'light', F: 'light', ' ': 'light', e: 'use', E: 'use', Enter: 'start', m: 'map', M: 'map', n: 'mute', N: 'mute' };
addEventListener('keydown', (e) => {
  AU.init(); if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
  if (e.repeat) { keys.add(e.key); return; }
  keys.add(e.key); const a = KEYACT[e.key]; if (a === 'mute') AU.toggle(); else if (a) pressed.add(a); if (G.state === 'title') pressed.add('any');
});
addEventListener('keyup', (e) => { keys.delete(e.key); });
addEventListener('blur', () => keys.clear());
cv.addEventListener('pointerdown', () => { AU.init(); if (G.state === 'title' || G.state === 'intro' || G.state === 'gameover' || G.state === 'end') pressed.add('start'); });
function setupTouch() {
  const el = document.getElementById('touch'); if (!TOUCH) { el.style.display = 'none'; return; } el.style.display = 'flex';
  const pad = document.getElementById('pad'); const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const setDir = (e) => { const r = pad.getBoundingClientRect(); const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2; dirs.forEach((d) => keys.delete(d)); if (Math.hypot(x, y) < 10) return; const a = Math.atan2(y, x); const s = Math.PI / 8;
    if (a > -3 * s && a < 3 * s) keys.add('ArrowRight'); if (a > 5 * s || a < -5 * s) keys.add('ArrowLeft'); if (a > s && a < 7 * s) keys.add('ArrowDown'); if (a < -s && a > -7 * s) keys.add('ArrowUp');
    pad.dataset.d = [...keys].join(' '); };
  pad.addEventListener('pointerdown', (e) => { AU.init(); pad.setPointerCapture(e.pointerId); setDir(e); e.preventDefault(); });
  pad.addEventListener('pointermove', (e) => { if (e.buttons || e.pressure) setDir(e); });
  const up = () => { dirs.forEach((d) => keys.delete(d)); pad.dataset.d = ''; }; pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('pointerdown', (e) => { AU.init(); e.preventDefault(); const a = b.dataset.act; if (a === 'mute') { AU.toggle(); b.textContent = AU.muted ? 'SOUND OFF' : 'SOUND'; } else { pressed.add(a); if (G.state !== 'play') pressed.add('start'); } b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120); }));
}
function resize() {
  const tEl = document.getElementById('touch'); const th = TOUCH ? tEl.offsetHeight + 8 : 0;
  const aw = innerWidth, ah = innerHeight - th; let s = Math.min(aw / 256, ah / 240); s = s >= 2 ? Math.floor(s) : Math.max(1, Math.floor(s * 4) / 4); if (aw < 256) s = aw / 256;
  cv.style.width = Math.floor(256 * s) + 'px'; cv.style.height = Math.floor(240 * s) + 'px';
}

// ---------- bot (automated playthrough for tests: ?bot) ----------
function roomPath(from, to) {
  const prev = { [from]: null }; const q = [from];
  while (q.length) { const c = q.shift(); if (c === to) break; const r = ROOMS[c]; buildRoom(r);
    const nb = Object.entries(r.doors).map(([d, id]) => [id, { door: d }]);
    for (const o of r.objs) if (o.t === 'stairs' && (!o.locked || o.open || G.inv.key)) nb.push([o.to, { stairs: o }]);
    for (const [id, how] of nb) if (!(id in prev)) { prev[id] = [c, how]; q.push(id); } }
  if (!(to in prev)) return null; const path = []; let k = to; while (prev[k]) { path.unshift([k, prev[k][1]]); k = prev[k][0]; } return path;
}
function botThink(dt) {
  const B = G.botS || (G.botS = { stuck: 0, lx: 0, ly: 0, jig: 0, useT: 0 }); G.bot = { x: 0, y: 0 };
  if (G.hidden) { pressed.add('use'); return; }
  if (!G.lightUser && G.battery > 0) pressed.add('light');
  const T = G.threat; if (T && !T.fade) { P.ang = Math.atan2(T.y - 18 - (P.y - 7), T.x - P.x); G.botInfo = 'repel'; return; }
  let goal; if (!G.inv.key) goal = { room: 'study', m: (o) => o.t === 'desk' && o.it, use: 1 };
  else if (!G.inv.handle) goal = { room: 'conserv', m: (o) => o.it === 'handle' && !o.taken };
  else if (!G.inv.fuse) goal = { room: 'crawl', m: (o) => o.it === 'fuse' && !o.taken };
  else goal = { room: 'breaker', m: (o) => o.t === 'breaker', use: 1 };
  const rm = G.room; let tgt = null, push = null, useObj = null;
  if (rm.id === goal.room) { const o = rm.objs.find(goal.m); if (o) { if (goal.use) useObj = o; else tgt = (x, y) => x === o.x && y === o.y; } }
  else { const p = roomPath(rm.id, goal.room); if (!p) { G.botInfo = 'nopath'; return; } const how = p[0][1];
    if (how.door) { const d = how.door; push = d; tgt = (x, y) => (d === 'W' && x === 0 && (y === 6 || y === 7)) || (d === 'E' && x === 15 && (y === 6 || y === 7)) || (d === 'N' && y <= 1 && (x === 7 || x === 8)) || (d === 'S' && y === 13 && (x === 7 || x === 8)); }
    else { const o = how.stairs; if (o.locked && !o.open) useObj = o; else tgt = (x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h; } }
  if (useObj) { const o = useObj; const [rx, ry, rw, rh] = objRect(o); tgt = (x, y) => { const cx = x * 16 + 8, cy = y * 16 + 10; if (rm.grid[y * COLS + x]) return false; return (cx > rx && cx < rx + rw && cy > ry - 14 && cy < ry + rh + 14) || (cy > ry && cy < ry + rh && cx > rx - 14 && cx < rx + rw + 14); }; }
  const tx = Math.floor(P.x / 16), ty = Math.floor(P.y / 16);
  if (push && tgt(tx, ty)) { const vx = push === 'W' ? -1 : push === 'E' ? 1 : 0, vy = push === 'N' ? -1 : push === 'S' ? 1 : 0; G.bot = { x: vx || (Math.abs(128 - P.x) > 2 ? Math.sign(128 - P.x) : 0), y: vy || (Math.abs(116 - P.y) > 2 ? Math.sign(116 - P.y) : 0) }; G.botInfo = 'exit ' + push; return; }
  if (tgt(tx, ty) && Math.abs(P.x - (tx * 16 + 8)) < 4 && Math.abs(P.y - (ty * 16 + 10)) < 4) {
    if (useObj) { const [rx, ry, rw, rh] = objRect(useObj); P.ang = Math.atan2(clamp(P.y, ry + 4, ry + rh - 4) - P.y, clamp(P.x, rx + 4, rx + rw - 4) - P.x); const a = P.ang; P.dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'right' : 'left') : (Math.sin(a) > 0 ? 'down' : 'up'); B.useT -= dt; if (B.useT <= 0) { B.useT = 0.6; pressed.add('use'); } G.botInfo = 'use ' + useObj.t; return; }
    if (push) { G.bot = { x: push === 'W' ? -1 : push === 'E' ? 1 : 0, y: push === 'N' ? -1 : push === 'S' ? 1 : 0 }; G.botInfo = 'exit ' + push; return; }
  }
  const path = tgt(tx, ty) ? [ty * COLS + tx] : bfs(tx, ty, tgt);
  if (!path || !path.length) { G.botInfo = 'stuck-nopath ' + rm.id; B.jig = 0.3; }
  let nx = tx, ny = ty; if (path && path.length) { nx = path[0] % COLS; ny = (path[0] / COLS) | 0; }
  const cx = nx * 16 + 8, cy = ny * 16 + 10; const dx = cx - P.x, dy = cy - P.y;
  G.bot = { x: Math.abs(dx) > 1.2 ? Math.sign(dx) : 0, y: Math.abs(dy) > 1.2 ? Math.sign(dy) : 0 };
  if (Math.hypot(P.x - B.lx, P.y - B.ly) < 0.2 && (G.bot.x || G.bot.y)) B.stuck += dt; else B.stuck = 0; B.lx = P.x; B.ly = P.y;
  if (B.stuck > 1.5) { B.jig = 0.35; B.stuck = 0; B.jx = pick([-1, 1, 0]); B.jy = pick([-1, 1, 0]); }
  if (B.jig > 0) { B.jig -= dt; G.bot = { x: B.jx || 0, y: B.jy || 0 }; }
  G.botInfo = rm.id + '>' + goal.room;
}

// ---------- debug / test API ----------
window.__hm = {
  G, P, ROOMS, AU,
  state: () => ({ state: G.state, room: G.room && G.room.id, inv: { ...G.inv }, battery: +G.battery.toFixed(3), playT: +G.playT.toFixed(1), threat: !!G.threat, bot: G.botInfo, x: Math.round(P.x), y: Math.round(P.y), scares: G.scares, catches: G.catches, et: +G.et.toFixed(2) }),
  start: () => { if (G.state === 'title') { startGame(true); } },
  goto: (id, x, y) => { if (G.state !== 'play') { G.state = 'play'; } enterRoom(id, 'pos', { x: x === undefined ? 128 : x, y: y === undefined ? 120 : y }); },
  give: (it) => { G.inv[it] = 1; }, aim: (a) => { P.ang = a; }, face: (d) => { P.dir = d; P.ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[d]; },
  spawnThreat: (x, y) => { spawnThreat(); if (x !== undefined) { G.threat.x = x; G.threat.y = y; } G.blk = 0; },
  dart: () => spawnDart(), drag: () => { G.dragDone = false; startDrag(); }, cat: (x, y) => spawnCat(x, y), lightning: () => lightning(true),
  validate: () => { const bad = []; for (const id in ROOMS) { const r = ROOMS[id]; buildRoom(r); computeGrid(r); const save = G.room; G.room = r; const pts = []; for (const d in r.doors) pts.push({ N: [7, 1], S: [7, 13], W: [0, 6], E: [15, 6] }[d]); for (const o of r.objs) { if (o.t === 'stairs') pts.push([o.x, o.y + o.h]); if (o.t === 'item' || o.t === 'note') pts.push([o.x, o.y]); if (o.t === 'breaker' || o.t === 'desk' && o.it) pts.push(o.t === 'breaker' ? [o.x, 2] : [o.x, o.y + 1]); }
      const [sx, sy] = pts[0]; for (const [x, y] of pts.slice(1)) { if (r.grid[y * COLS + x]) { bad.push(id + ' blocked ' + x + ',' + y); continue; } const p = bfs(sx, sy, (a, b) => a === x && b === y); if (!p && !(sx === x && sy === y)) bad.push(id + ' unreachable ' + x + ',' + y); } G.room = save; } return bad; },
  noFlicker: (v) => { G.noFlicker = v; }, use: () => interact(), map: (v) => { G.map = v; }, msg: (m) => showMsg(m), hide: () => hide(G.room.objs.find((o) => o.t === 'wardrobe')), noThreat: (v) => { G.noThreat = v; },
};

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  try {
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    for (let i = 0; i < TSCALE; i++) { update(dt); pressed.clear(); }
    render();
  } catch (e) { window.__frameErrors++; console.error(e); }
  requestAnimationFrame(frame);
}
setupTouch(); resize(); addEventListener('resize', resize);
if (QS.get('debug') === 'breaker') { startGame(true); G.inv = { key: 1, handle: 1, fuse: 1 }; enterRoom('breaker', 'pos', { x: 128, y: 46 }); P.ang = -Math.PI / 2; P.dir = 'up'; }
else if (QS.get('room')) { startGame(true); enterRoom(QS.get('room'), 'pos', { x: +(QS.get('x') || 128), y: +(QS.get('y') || 120) }); }
else if (BOT) { startGame(true); }
requestAnimationFrame(frame);
