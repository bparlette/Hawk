// events_render.js — drawing for the city events (events.js): beacons, the WRECK IT! district ring and
// domino anchors, VALET bays with the alignment reticle (ground layer, under the cars), and the
// event HUD card (clock, score, chain pill / bay progress, result banner). Procedural vector art in the
// game's ink (#210f2e) and sunset palette; no assets.
import { EVENTS, bayAlign } from './events.js';

const INK = '#210f2e';
// painted sprites from shots/events-sprites/ (copied to assets/events/); vector fallback until they load
const IMG = {};
function sprite(name) {
  if (typeof Image === 'undefined') return null;
  let i = IMG[name];
  if (!i) { i = IMG[name] = new Image(); i.src = 'assets/events/' + name + '.webp'; }
  return i.complete && i.naturalWidth ? i : null;
}

export function drawEventsGround(g, S, time) {
  const ev = S.event, pulse = 0.5 + 0.5 * Math.sin(time * 4);
  if (!ev) {
    for (const s of S.eventSites || []) beacon(g, s.p[0], s.p[1], s.kind === 'wreck' ? '#ff7a4a' : '#6ee2ff', pulse, time);
    return;
  }
  if (ev.kind === 'wreck') {
    const E = EVENTS.wreck;
    g.save(); g.setLineDash([14, 10]); g.lineDashOffset = -time * 14; g.lineWidth = 3;
    g.strokeStyle = `rgba(255,170,70,${0.5 + 0.25 * pulse})`; g.beginPath(); g.arc(E.site[0], E.site[1], E.radius, 0, 7); g.stroke(); g.restore();
    for (const t of S.things) if (t.evAnchor) drawAnchor(g, S, t, time);
  } else {
    ev.bays.forEach((b, i) => drawBay(g, b, i === ev.idx, ev, S, time, pulse));
  }
}

function beacon(g, x, y, col, pulse, time) {
  g.save(); g.translate(x, y);
  g.lineWidth = 3.5; g.strokeStyle = col; g.globalAlpha = 0.55 + 0.35 * pulse;
  g.beginPath(); g.arc(0, 0, 34 + pulse * 6, 0, 7); g.stroke();
  g.globalAlpha = 0.14 + 0.1 * pulse; g.fillStyle = col; g.fill();
  g.globalAlpha = 1; g.rotate(Math.sin(time * 1.5) * 0.12);
  g.beginPath();                                         // a golden star in the middle
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 7 : 17, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fillStyle = '#ffd45c'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
  g.restore();
}

function drawAnchor(g, S, t, time) {
  g.save(); g.translate(t.x, t.y);
  g.fillStyle = 'rgba(33,15,46,0.28)'; g.beginPath(); g.ellipse(2, 3, t.r + 2, t.r * 0.7, 0, 0, 7); g.fill();
  if (t.state === 'boom') {
    const u = (S.time - t.boomT) / 0.45;
    if (u < 1) { g.lineWidth = 6 * (1 - u); g.strokeStyle = `rgba(255,190,90,${1 - u})`; g.beginPath(); g.arc(0, 0, 95 * u, 0, 7); g.stroke(); g.fillStyle = `rgba(255,236,170,${0.7 * (1 - u)})`; g.beginPath(); g.arc(0, 0, 40 * (1 - u) + 10, 0, 7); g.fill(); }
    const bl = sprite('anchor_fuel_drum_blast');                                                  // the crater left behind
    if (bl) { g.globalAlpha = 0.85; g.drawImage(bl, -40, -40, 80, 80); g.globalAlpha = 1; }
    else { g.fillStyle = '#3a2a30'; g.beginPath(); g.ellipse(0, 0, t.r, t.r * 0.8, 0, 0, 7); g.fill(); }
    g.restore(); return;
  }
  const sd = t.kind === 'drum' ? sprite('anchor_fuel_drum_intact') : sprite('anchor_hydrant_intact');
  if (sd) {
    if (t.kind === 'hydrant' && t.state === 'jet') { const gz = sprite('anchor_hydrant_geyser'); if (gz) { g.save(); g.rotate(Math.atan2(t.ay, t.ax)); g.drawImage(gz, -9, -16, 64, 32); g.restore(); } }
    const s = t.kind === 'drum' ? 24 : 18; g.drawImage(sd, -s / 2, -s / 2, s, s);
    if (t.state === 'fuse' && Math.floor(time * 14) % 2) { g.fillStyle = 'rgba(255,241,176,0.75)'; g.beginPath(); g.arc(0, 0, s / 2, 0, 7); g.fill(); }
  } else if (t.kind === 'drum') {
    const flash = t.state === 'fuse' && Math.floor(time * 14) % 2;
    g.fillStyle = flash ? '#fff1b0' : '#e0452e'; g.beginPath(); g.arc(0, 0, t.r, 0, 7); g.fill();
    g.fillStyle = '#ffd45c'; g.fillRect(-t.r, -2.4, t.r * 2, 4.8);            // the hazard band
    g.lineWidth = 2.4; g.strokeStyle = INK; g.beginPath(); g.arc(0, 0, t.r, 0, 7); g.stroke();
    g.fillStyle = '#9b2a1c'; g.beginPath(); g.arc(-2, -2, t.r * 0.35, 0, 7); g.fill();
  } else {
    if (t.state === 'jet') {                                                  // water jet along the shove direction
      g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = Math.atan2(t.ay, t.ax) + (i - 3) * 0.1, len = 30 + ((time * 90 + i * 17) % 34);
        g.strokeStyle = i % 2 ? 'rgba(210,244,255,0.9)' : 'rgba(110,200,235,0.85)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(Math.cos(a) * 4, Math.sin(a) * 4); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.stroke();
      }
    }
    g.fillStyle = t.state === 'intact' ? '#e0452e' : '#b83a2a'; g.beginPath(); g.arc(0, 0, t.r, 0, 7); g.fill();
    g.fillStyle = '#ffd45c'; g.beginPath(); g.arc(0, -1, 2.6, 0, 7); g.fill();
    g.lineWidth = 2.2; g.strokeStyle = INK; g.beginPath(); g.arc(0, 0, t.r, 0, 7); g.stroke();
  }
  if (t.state === 'intact') {                                               // chain-line marker: a pulsing amber ring
    g.strokeStyle = `rgba(255,212,92,${0.4 + 0.4 * Math.sin(time * 5 + t.pulse)})`; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, t.r + 6, 0, 7); g.stroke();
  }
  g.restore();
}

function drawBay(g, b, active, ev, S, time, pulse) {
  g.save(); g.translate(b.x, b.y); g.rotate(b.ax - Math.PI / 2);          // stall drawn with its long side along local y
  const w = b.w, l = b.l;
  const sp = sprite(b.done ? 'valet_stall_locked' : 'valet_stall_active');
  if (sp && (b.done || active)) { g.globalAlpha = b.done ? 0.9 : 0.8 + 0.2 * pulse; g.drawImage(sp, -w / 2 - 5, -l / 2 - 2, w + 10, l + 4); g.globalAlpha = 1; }
  else if (b.done) { g.fillStyle = 'rgba(120,220,150,0.28)'; g.fillRect(-w / 2, -l / 2, w, l); }
  else if (active) { g.fillStyle = `rgba(110,226,255,${0.16 + 0.12 * pulse})`; g.fillRect(-w / 2, -l / 2, w, l); }
  if (!sp || !(b.done || active)) { g.lineWidth = active ? 3.2 : 2.2; g.strokeStyle = b.done ? 'rgba(120,230,160,0.9)' : active ? `rgba(255,226,120,${0.8 + 0.2 * pulse})` : 'rgba(255,244,214,0.55)';
  g.strokeRect(-w / 2, -l / 2, w, l); }
  if (active) {                                                           // the alignment reticle: arrow along the car's axis, green clean / amber sloppy / red off
    const c = ev.car, err = bayAlign(c, b), col = err <= 0.245 ? '#7dffa8' : err <= 0.436 ? '#ffd45c' : '#ff7a6a';
    g.rotate(-(b.ax - Math.PI / 2)); g.translate(c.x - b.x, c.y - b.y); g.rotate(c.h);
    g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = col; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(34, 0); g.lineTo(24, -7); g.lineTo(24, 7); g.closePath(); g.stroke(); g.fill();
  }
  g.restore();
}

// ---- the HUD card + banners (hud.js calls this)
export function drawEventHud(g, vw, vh, top, S, font) {
  const ev = S.event, R = S.eventResult;
  if (ev) {
    const w = 200, x = vw / 2 - w / 2, y = top + 62, h = ev.kind === 'wreck' ? 64 : 58;
    g.fillStyle = 'rgba(20,12,40,0.62)'; g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill();
    g.lineWidth = 2; g.strokeStyle = ev.kind === 'wreck' ? 'rgba(255,170,70,0.9)' : 'rgba(110,226,255,0.9)'; g.stroke();
    g.textAlign = 'left'; g.font = font(13, 900); g.fillStyle = ev.kind === 'wreck' ? '#ffb04a' : '#6ee2ff';
    g.fillText(ev.name, x + 12, y + 16);
    g.textAlign = 'right'; g.fillStyle = ev.timer < 10 ? '#ff7a8a' : '#fff1d8';
    g.fillText(`0:${String(Math.max(0, Math.ceil(ev.timer))).padStart(2, '0')}`, x + w - 12, y + 16);
    g.textAlign = 'left'; g.font = font(12, 800); g.fillStyle = '#fff1d8';
    if (ev.kind === 'wreck') {
      g.fillText(`${ev.pts.toLocaleString()} PTS`, x + 12, y + 34);
      const hot = ev.chain > 1;
      g.textAlign = 'right'; g.font = font(15, 900); g.fillStyle = hot ? '#ffd45c' : 'rgba(255,241,216,0.5)';
      g.fillText(`CHAIN ×${ev.chain}`, x + w - 12, y + 36);
      const u = hot ? Math.max(0, 1 - (S.time - ev.lastBreak) / EVENTS.wreck.window) : 0;      // the decay bar: empty = the combo is dead
      g.fillStyle = 'rgba(255,241,216,0.25)'; g.fillRect(x + 12, y + 48, w - 24, 5);
      g.fillStyle = u > 0.35 ? '#ffd45c' : '#ff7a6a'; g.fillRect(x + 12, y + 48, (w - 24) * u, 5);
    } else {
      g.fillText(`BAY ${Math.min(ev.idx + 1, ev.bays.length)}/${ev.bays.length}  ·  $${ev.pts.toLocaleString()}`, x + 12, y + 34);
      const a = ev.align == null ? null : Math.round(ev.align * 180 / Math.PI);
      g.font = font(11, 800); g.fillStyle = a == null ? '#fff1d8' : a <= 14 ? '#7dffa8' : a <= 25 ? '#ffd45c' : '#ff7a6a';
      g.fillText(a == null ? 'PULL INTO THE GLOWING STALL' : `ALIGN ${a}° ${a <= 14 ? 'CLEAN' : a <= 25 ? 'SLOPPY' : 'OFF'}${ev.scraped ? ' · SCRAPED' : ''}`, x + 12, y + 51);
    }
    if (ev.count > 0) {
      g.textAlign = 'center'; g.font = font(64, 900); g.lineWidth = 7; g.strokeStyle = 'rgba(33,15,46,0.7)';
      const n = String(Math.ceil(ev.count)); g.strokeText(n, vw / 2, vh * 0.42); g.fillStyle = '#ffd45c'; g.fillText(n, vw / 2, vh * 0.42);
    }
  } else if (R) {
    const w = 230, x = vw / 2 - w / 2, y = vh * 0.3, h = R.kind === 'wreck' ? 92 : 82;
    g.globalAlpha = Math.min(1, R.t / 0.5);
    g.fillStyle = 'rgba(20,12,40,0.78)'; g.beginPath(); g.roundRect(x, y, w, h, 14); g.fill();
    g.lineWidth = 3; g.strokeStyle = R.ok ? 'rgba(255,212,92,0.95)' : 'rgba(255,122,106,0.95)'; g.stroke();
    g.textAlign = 'center'; g.font = font(14, 900); g.fillStyle = '#fff1d8'; g.fillText(R.name, vw / 2, y + 22);
    g.font = font(26, 900); g.fillStyle = '#ffd45c'; g.fillText(R.kind === 'valet' ? `$${R.pts.toLocaleString()}` : R.pts.toLocaleString() + ' PTS', vw / 2, y + 54);
    g.font = font(13, 800); g.fillStyle = R.ok ? '#7dffa8' : '#ff9a8a';
    g.fillText(R.kind === 'wreck' ? `${R.medal === 'NONE' ? 'NO MEDAL' : R.medal + ' MEDAL'} · BEST CHAIN ×${R.chain || 1}` : `${R.text}${R.bays != null ? ' · ' + R.bays + ' BAYS' : ''}`, vw / 2, y + 76);
    g.globalAlpha = 1;
  }
}
