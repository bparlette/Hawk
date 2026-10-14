/* ---------------- HUD (2D overlay canvas): Cel-City style chunky italic ink text ---------------- */
const FONT = 'Impact,"Avenir Next Condensed","Arial Black",sans-serif';
const _sp = { x: 0, y: 0 };
function txt(g, s, x, y, size, fill, align, rot, stroke) {
  g.save(); g.translate(x, y); if (rot) g.rotate(rot);
  g.font = 'italic ' + Math.round(size) + 'px ' + FONT; g.textAlign = align || 'left'; g.textBaseline = 'middle';
  const sw = Math.max(2, size * 0.13);
  g.fillStyle = INK; g.fillText(s, sw * 0.9, sw * 0.9);
  g.lineJoin = 'round'; g.lineWidth = sw * 1.6; g.strokeStyle = stroke || INK; g.strokeText(s, 0, 0);
  g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
}
function chip(g, s, x, y, h, bg, fg) {
  g.font = '900 ' + Math.round(h * 0.5) + 'px system-ui,-apple-system,sans-serif'; const w = g.measureText(s).width + h * 0.7;
  g.fillStyle = INK; rr(g, x + 3, y + 3, w, h, 8); g.fill(); g.fillStyle = bg; rr(g, x, y, w, h, 8); g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
  g.fillStyle = fg || INK; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(s, x + h * 0.35, y + h * 0.54); return w;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function badge(g, x, y, r, look) { // round avatar: shirt colour, hair, shades
  g.fillStyle = INK; g.beginPath(); g.arc(x + 3, y + 3, r, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
  g.fillStyle = look.shirt; g.fillRect(x - r, y - r, r * 2, r * 2);
  g.fillStyle = look.skin; g.beginPath(); g.arc(x, y + r * 0.25, r * 0.62, 0, TAU); g.fill();
  g.fillStyle = look.hair; g.beginPath(); g.arc(x, y - r * 0.05, r * 0.66, Math.PI, 0); g.fill();
  g.fillStyle = look.band; g.fillRect(x - r, y - r * 0.02, r * 2, r * 0.18);
  g.fillStyle = INK; g.fillRect(x - r * 0.5, y + r * 0.18, r, r * 0.22); g.fillStyle = '#ff5e57'; g.fillRect(x - r * 0.42, y + r * 0.22, r * 0.34, r * 0.14); g.fillRect(x + r * 0.08, y + r * 0.22, r * 0.34, r * 0.14);
  g.restore(); g.lineWidth = 3; g.strokeStyle = INK; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
}
function fmtTime(t) { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
function drawHUD() {
  const g = hg, W = V.W, H = V.H; g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); g.clearRect(0, 0, W, H);
  const st = Game.state, ev = EVENTS[EVI], inEvent = st === 'play' || st === 'ready' || st === 'turnEnd' || st === 'paused' || Game.isShowcase();
  const S = Math.min(W, H), u = clamp(S / 420, 0.8, 1.6);
  if (st === 'awards' || st === 'champ') { drawPodiumLabels(g, u); drawBanner(g, u); return; }
  if (!inEvent || !ev) return;
  const showcase = Game.isShowcase();
  const safeT = 8, padL = 10;
  // top-left: event chip
  chip(g, (EVI + 1) + ' · ' + ev.name.toUpperCase(), padL, safeT, 26 * u, '#ffd23c');
  g.font = '800 ' + Math.round(10.5 * u) + 'px system-ui,sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(ev.place.toUpperCase() + (showcase ? ' · DEMO' : R.practice ? ' · PRACTICE' : ''), padL + 2, safeT + 38 * u);
  // top-right: player badge, name, score (leave room for the 3 corner buttons)
  const rx = W - 10, ry = safeT + 50;
  badge(g, rx - 22 * u, ry + 22 * u, 21 * u, Game.look);
  const name = showcase ? 'DEMO' : (Comp.players[Comp.pi] ? Comp.players[Comp.pi].name : 'PLAYER');
  txt(g, name, rx - 50 * u, ry + 9 * u, 17 * u, '#ffd23c', 'right');
  txt(g, fmt(R.score), rx - 50 * u, ry + 32 * u, 25 * u, '#fff', 'right');
  // falls pips
  for (let i = 0; i < (R.maxFalls < 9 ? R.maxFalls : 0); i++) { const px = rx - 52 * u - i * 15 * u, py = ry + 52 * u, used = i < R.falls;
    g.fillStyle = INK; g.beginPath(); g.arc(px + 2, py + 2, 6 * u, 0, TAU); g.fill(); g.fillStyle = used ? '#3b3160' : '#9dff6b'; g.beginPath(); g.arc(px, py, 6 * u, 0, TAU); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
    if (used) { g.strokeStyle = '#ff3d6e'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(px - 4 * u, py - 4 * u); g.lineTo(px + 4 * u, py + 4 * u); g.stroke(); } }
  // centre: clock pill
  if (ev.time > 0) {
    const tl = R.time, low = tl < 10 && st === 'play', s = (V.portrait ? 30 : 34) * u * (low ? 1 + 0.08 * Math.sin(T.real * 12) : 1);
    txt(g, fmtTime(tl), W / 2, safeT + (V.portrait ? 74 : 26) * u, s, low ? '#ff3d6e' : '#fff', 'center');
  } else if (ev.counter) txt(g, ev.counter(E), W / 2, safeT + (V.portrait ? 74 : 26) * u, 26 * u, '#fff', 'center');
  // event-specific gauges just under the HUD band
  if (ev.hud) { const gw = Math.min(260, W * 0.5) * u * 0.8; ev.hud(g, E, (W - gw) / 2, V.top + 6, gw, u); }
  // world-space popups
  for (const p of pops) { if (!p.on) continue; worldToScreen(p.x, p.y, SPZ, _sp); const a = clamp(p.t * 2, 0, 1), sc = 1 + Math.max(0, p.t - 1.1) * 3;
    g.globalAlpha = a; txt(g, p.a, _sp.x, _sp.y, 22 * u * sc, p.col, 'center', -0.06); if (p.b) txt(g, p.b, _sp.x, _sp.y + 20 * u, 12 * u, '#fff', 'center', -0.06); g.globalAlpha = 1; }
  drawBanner(g, u);
  if (QA.cap) { txt(g, QA.cap, W / 2, H * 0.205, Math.min(46 * u, W / Math.max(8, QA.cap.length) * 1.7), '#ffd23c', 'center', -0.06); if (QA.cap2) txt(g, QA.cap2, W / 2, H * 0.205 + 40 * u, 22 * u, '#fff', 'center', -0.06); }
  // cards
  if (st === 'ready') drawReadyCard(g, u, ev);
  else if (st === 'turnEnd') drawTurnCard(g, u, ev);
  else if (st === 'attract') {
    const y = V.portrait ? H * 0.84 : H - 30 * u, blink = 0.6 + 0.4 * Math.sin(T.real * 5);
    txt(g, 'CALIFORNIA GAMES', W / 2, y - 30 * u, 26 * u, '#ffd23c', 'center', -0.05);
    g.globalAlpha = blink; txt(g, V.touch ? 'TAP TO PLAY' : 'PRESS ANY KEY', W / 2, y, 18 * u, '#fff', 'center', -0.05); g.globalAlpha = 1;
  }
}
function drawBanner(g, u) {
  if (banner.t <= 0) return; const W = V.W, H = V.H, k = banner.t, intro = clamp((1.6 - k) * 8, 0, 1);
  const size = (banner.big ? Math.max(H * 0.065, 34 * u) : Math.max(H * 0.05, 26 * u)) * (0.6 + 0.4 * intro) * (1 + Math.max(0, 0.15 - (1.6 - k)) * 2);
  g.globalAlpha = clamp(k * 3, 0, 1);
  const y = V.P.y + V.P.h * 0.22;
  txt(g, banner.a, W / 2, y, Math.min(size, W / Math.max(6, banner.a.length) * 1.6), banner.col, 'center', -0.08);
  if (banner.b) txt(g, banner.b, W / 2, y + size * 0.85, size * 0.5, '#fff', 'center', -0.08);
  g.globalAlpha = 1;
}
function card(g, u, h) { const W = V.W, w = Math.min(W - 24, 470 * u), x = (W - w) / 2, y = V.P.y + V.P.h * 0.5 - h / 2;
  g.fillStyle = INK; rr(g, x + 5, y + 5, w, h, 16); g.fill(); g.fillStyle = 'rgba(27,21,48,0.9)'; rr(g, x, y, w, h, 16); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  g.strokeStyle = 'rgba(255,210,60,0.5)'; g.lineWidth = 2; rr(g, x + 4, y + 4, w - 8, h - 8, 13); g.stroke(); return { x, y, w }; }
function wrapText(g, s, x, y, maxW, lh) { const words = s.split(' '); let line = '', yy = y; for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = wd; yy += lh; } else line = t; } g.fillText(line, x, yy); return yy; }
function drawReadyCard(g, u, ev) {
  const h = 230 * u, c = card(g, u, h), cx = V.W / 2, p = Comp.players[Comp.pi];
  txt(g, ev.name.toUpperCase(), cx, c.y + 34 * u, 34 * u, '#ffd23c', 'center', -0.05);
  g.font = '800 ' + Math.round(11 * u) + 'px system-ui,sans-serif'; g.fillStyle = '#2fd3ff'; g.textAlign = 'center'; g.fillText(ev.place.toUpperCase() + ' · ' + (ev.time ? fmtTime(ev.time) + ' · ' : '') + (ev.falls < 9 ? ev.falls + (ev.falls === 1 ? ' FALL' : ' FALLS') : ev.counterLabel || ''), cx, c.y + 62 * u);
  txt(g, ev.goal, cx, c.y + 90 * u, 20 * u, '#fff', 'center', -0.03);
  g.font = '700 ' + Math.round(12 * u) + 'px system-ui,sans-serif'; g.fillStyle = '#e9e4ff'; const yy = wrapText(g, V.touch && ev.helpT ? ev.helpT : ev.help, cx, c.y + 118 * u, c.w - 34 * u, 16 * u);
  if (p) { txt(g, p.name + ' · ' + SPONSORS[p.sp].n, cx, c.y + h - 54 * u, 15 * u, SPONSORS[p.sp].a, 'center'); }
  g.globalAlpha = 0.55 + 0.45 * Math.sin(T.real * 6); txt(g, V.touch ? 'TAP A TO GO' : 'PRESS A / SPACE TO GO', cx, c.y + h - 24 * u, 19 * u, '#ff5fa2', 'center', -0.04); g.globalAlpha = 1;
}
function drawTurnCard(g, u, ev) {
  const h = 210 * u, c = card(g, u, h), cx = V.W / 2, p = Comp.players[Comp.pi];
  txt(g, R.endReason === 'falls' ? 'WIPED OUT!' : R.endReason === 'finish' ? 'FINISHED!' : 'TIME!', cx, c.y + 32 * u, 30 * u, R.endReason === 'falls' ? '#ff3d6e' : '#9dff6b', 'center', -0.05);
  txt(g, fmt(R.score), cx, c.y + 78 * u, 46 * u, '#fff', 'center', -0.04);
  g.font = '800 ' + Math.round(12 * u) + 'px system-ui,sans-serif'; g.fillStyle = '#2fd3ff'; g.textAlign = 'center';
  g.fillText((R.best ? 'BEST: ' + R.best + ' +' + fmt(R.bestPts) : 'NO STUNTS LANDED') + '  ·  FALLS ' + R.falls + '/' + R.maxFalls, cx, c.y + 114 * u);
  const rec = records[ev.key]; g.fillStyle = '#e9e4ff'; g.fillText(R.practice ? 'PRACTICE — NOT SCORED' : (rec ? 'EVENT RECORD ' + fmt(rec.s) + ' · ' + rec.n : ''), cx, c.y + 136 * u);
  if (R.record) txt(g, '★ NEW EVENT RECORD ★', cx, c.y + 158 * u, 18 * u, '#ffd23c', 'center', -0.04);
  if (Game.cardT > 1.0) { g.globalAlpha = 0.55 + 0.45 * Math.sin(T.real * 6); txt(g, V.touch ? 'TAP TO CONTINUE' : 'PRESS A TO CONTINUE', cx, c.y + h - 22 * u, 17 * u, '#ff5fa2', 'center', -0.04); g.globalAlpha = 1; }
}
