// hud.js — painted-feel HUD: wanted stars, clock, messages, joystick + action button.

function star(g, x, y, r, fill) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = fill ? '#ffd45c' : 'rgba(30,20,50,0.35)';
  g.fill();
  g.lineWidth = 1.6;
  g.strokeStyle = fill ? '#7a3a1a' : 'rgba(255,240,220,0.35)';
  g.stroke();
}

export function clockText(t) {
  const mins = 18 * 60 + 38 + Math.round(t * 70);   // 6:38 pm golden hour -> 7:48 pm blue dusk
  const h = Math.floor(mins / 60) - 12, m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')} PM`;
}

import { siegeAction } from './siege.js';
import { nearHeli, heliLabel } from './heli.js';
import { jobButton, JOBS } from './jobs.js';
import { buttonA } from './controls.js';
import { canDismount } from './watercraft.js';
import { drawEventHud } from './events_render.js';

export function drawHud(g, vw, vh, dpr, sim, input, t, time, opts) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  const font = (px, w = 800) => `${w} ${px}px "Avenir Next", "Futura", "Trebuchet MS", system-ui, sans-serif`;
  const top = (opts.safeTop || 0) + 14;

  // wanted stars, top right
  for (let i = 0; i < 5; i++) {
    const on = i < sim.stars;
    const flash = on && sim.cars.some(c => c.siren) && Math.floor(time * 3) % 2 === 0;
    star(g, vw - 22 - (4 - i) * 26, top + 12, flash ? 12.5 : 11, on);
  }
  // clock, top left
  g.font = font(15, 700);
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(20,12,40,0.45)';
  g.fillText(clockText(t), 17, top + 13);
  g.fillStyle = '#fff1d8';
  g.fillText(clockText(t), 16, top + 12);

  // title card at start
  if (opts.title > 0) {
    const a = Math.min(1, opts.title / 0.8);
    g.globalAlpha = a;
    g.textAlign = 'center';
    g.font = font(54, 900);
    g.lineWidth = 8; g.strokeStyle = 'rgba(60,20,70,0.6)';
    g.strokeText('PALM CITY', vw / 2, vh * 0.3);
    const gr = g.createLinearGradient(0, vh * 0.3 - 26, 0, vh * 0.3 + 26);
    gr.addColorStop(0, '#ffe08a'); gr.addColorStop(0.5, '#ff9a5c'); gr.addColorStop(1, '#ff5c9a');
    g.fillStyle = gr;
    g.fillText('PALM CITY', vw / 2, vh * 0.3);
    g.font = font(14, 600);
    g.fillStyle = '#fff1d8';
    g.fillText(opts.demo ? 'DEMO — watching a 30 second run' : 'drag left to move  ·  ● jack / board  ·  fist to punch', vw / 2, vh * 0.3 + 44);
    g.globalAlpha = 1;
  }

  // WANTED LINE combo
  if (sim.combo) {
    const c = sim.combo, y = top + 52;
    g.textAlign = 'center';
    g.font = font(13, 800);
    g.fillStyle = sim.stars > 0 ? '#ff7a8a' : '#ffe9b0';
    g.fillText(sim.stars > 0 ? 'WANTED LINE' : 'LINE', vw / 2, y);
    g.font = font(26, 900);
    g.lineWidth = 5; g.strokeStyle = 'rgba(40,20,60,0.6)';
    const txt = `${c.pts.toLocaleString()} × ${c.mult}`;
    g.strokeText(txt, vw / 2, y + 24); g.fillStyle = '#fff1d8'; g.fillText(txt, vw / 2, y + 24);
    g.fillStyle = 'rgba(255,241,216,0.3)'; g.fillRect(vw / 2 - 60, y + 42, 120, 4);
    g.fillStyle = '#ffd45c'; g.fillRect(vw / 2 - 60, y + 42, 120 * Math.max(0, c.t / 2.6), 4);
  }
  if (sim.lastTrick) {
    const L = sim.lastTrick;
    g.globalAlpha = Math.min(1, L.t / 0.3);
    g.textAlign = 'center'; g.font = font(18, 900);
    g.lineWidth = 4; g.strokeStyle = 'rgba(40,20,60,0.6)';
    g.strokeText(`${L.name} +${L.pts}`, vw / 2, vh * 0.62 - (1.2 - L.t) * 30);
    g.fillStyle = '#ffd45c'; g.fillText(`${L.name} +${L.pts}`, vw / 2, vh * 0.62 - (1.2 - L.t) * 30);
    g.globalAlpha = 1;
  }
  if (sim.score) {
    g.textAlign = 'right'; g.font = font(14, 800); g.fillStyle = '#fff1d8';
    g.fillText(sim.score.toLocaleString() + ' pts', vw - 16, top + 38);
  }
  // ON RIMS (polish bundle): the rim-run clock, burning down under the stars
  if (sim.player.mode === 'car' && (sim.player.car.rims || 0) > 0) {
    const c = sim.player.car, w = 104, x = vw - 16 - w, y = top + 48;
    g.fillStyle = 'rgba(20,12,40,0.55)'; g.beginPath(); g.roundRect(x, y, w, 20, 7); g.fill();
    g.fillStyle = '#ffb84a'; g.fillRect(x + 3, y + 14, (w - 6) * Math.max(0, c.rims / 8), 3);
    g.textAlign = 'center'; g.font = font(12, 900); g.fillStyle = '#ffd9a0';
    g.fillText('ON RIMS!', x + w / 2, y + 10.5);
  }

  // event message
  if (sim.msg) {
    const m = sim.msg, big = m.text === 'BUSTED';
    const a = Math.min(1, m.t / 0.4, (m.dur - m.t) / 0.15 + 0.2);
    g.globalAlpha = Math.max(0, a);
    g.textAlign = 'center';
    g.font = font(big ? 64 : 30, 900);
    g.lineWidth = big ? 10 : 6;
    g.strokeStyle = big ? 'rgba(40,0,20,0.75)' : 'rgba(40,20,60,0.6)';
    const y = big ? vh * 0.42 : vh * 0.2;
    g.strokeText(m.text, vw / 2, y);
    g.fillStyle = big ? '#ff4a5c' : '#ffe9b0';
    g.fillText(m.text, vw / 2, y);
    g.globalAlpha = 1;
  }
  // busted fade
  if (sim.busted) {
    const bt = sim.busted.t;
    const a = bt < 2.6 ? 0 : bt < 3.4 ? (bt - 2.6) / 0.8 : Math.max(0, 1 - (bt - 3.4) / 1.0);
    if (a > 0) { g.fillStyle = `rgba(14,8,28,${a})`; g.fillRect(0, 0, vw, vh); }
  }

  // HELP, top-left under the clock: pauses and lists everything there is to do
  if (!sim.siege) {
    const q = input.helpBtn();
    g.fillStyle = 'rgba(20,12,40,0.5)'; g.beginPath(); g.roundRect(q.x, q.y, q.w, q.h, 8); g.fill();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,214,120,0.95)'; g.stroke();
    g.font = font(16, 900); g.textAlign = 'center'; g.fillStyle = '#ffe9b0'; g.fillText('?', q.x + q.w / 2, q.y + q.h / 2 + 1);
  }
  // MAP toggle, under the stars
  if (!sim.siege) {
    const m = input.mapBtn();
    g.fillStyle = input.mapOpen ? 'rgba(255,212,92,0.9)' : 'rgba(20,12,40,0.5)'; g.beginPath(); g.roundRect(m.x, m.y, m.w, m.h, 8); g.fill();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,214,120,0.95)'; g.stroke();
    g.font = font(12, 900); g.textAlign = 'center'; g.fillStyle = input.mapOpen ? '#210f2e' : '#ffe9b0';
    g.fillText(input.mapOpen ? '✕ MAP' : 'MAP', m.x + m.w / 2, m.y + m.h / 2 + 1);
  }

  // controls
  const b = input.button();
  const P = sim.player;
  let label = '';
  if (P.mode === 'siege') { const a = siegeAction(sim); label = a ? a.label : ''; }
  else if (sim.nearMotelDoor()) label = 'ENTER';
  else if (P.mode === 'air') label = 'LAND';
  else if (nearHeli(sim)) label = heliLabel(sim);
  else if (P.mode === 'car') label = Math.abs(P.car.v) < 60 ? 'EXIT' : '';
  else if (P.mode === 'board') label = Math.hypot(sim.board.vx, sim.board.vy) < 22 ? 'DROP' : sim.board.grind ? 'POP' : 'OLLIE';
  else if (P.mode === 'water') label = canDismount(sim) ? 'HOP OFF' : '';
  else if (P.mode === 'foot' && sim.water && sim.water.craft.some(c => Math.hypot(c.x - P.ped.x, c.y - P.ped.y) < 46)) label = 'HOP ON';
  else if (!sim.board.ridden && Math.hypot(sim.board.x - P.ped.x, sim.board.y - P.ped.y) < 26) label = 'BOARD';
  else if (sim.cars.some(c => Math.hypot(c.x - P.ped.x, c.y - P.ped.y) < 40)) label = 'JACK';
  g.globalAlpha = 1;
  g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  g.fillStyle = input.btnDown ? 'rgba(255,140,90,0.55)' : 'rgba(255,240,220,0.18)';
  g.fill();
  g.lineWidth = 3; g.strokeStyle = label ? 'rgba(255,214,120,0.95)' : 'rgba(255,240,220,0.55)'; g.stroke();
  g.beginPath(); g.arc(b.x, b.y, b.r * 0.42, 0, Math.PI * 2);
  g.fillStyle = label ? 'rgba(255,214,120,0.9)' : 'rgba(255,240,220,0.5)'; g.fill();
  if (label) {
    g.font = font(13, 800); g.textAlign = 'center'; g.fillStyle = '#fff4dc';
    g.fillText(label, b.x, b.y - b.r - 12);
  }
  const jb = P.mode === 'car' ? jobButton(sim) : null;
  if (jb) {                                              // in a car the fight button is the job button
    const f = input.fight();
    g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    g.fillStyle = input.fightDown ? 'rgba(90,220,255,0.55)' : 'rgba(255,240,220,0.16)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(110,226,255,0.95)'; g.stroke();
    g.fillStyle = 'rgba(190,240,255,0.95)'; g.font = font(20, 900); g.textAlign = 'center'; g.fillText('$', f.x, f.y + 1);
    g.font = font(12, 800); g.fillStyle = '#d8f6ff'; g.fillText(jb.label, f.x, f.y - f.r - 11);
  }
  const ba = buttonA(sim);
  if (ba && ba.kind === 'event') {                         // on the board at the pier marker: START BOARD CHASE
    const f = input.fight();
    g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    g.fillStyle = input.fightDown ? 'rgba(125,255,168,0.55)' : 'rgba(255,240,220,0.16)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(125,255,168,0.95)'; g.stroke();
    g.fillStyle = 'rgba(200,255,220,0.95)'; g.font = font(20, 900); g.textAlign = 'center'; g.fillText('★', f.x, f.y + 1);
    g.font = font(12, 800); g.fillStyle = '#d8ffe6'; g.fillText(ba.label, f.x, f.y - f.r - 11);
  }
  if (ba && ba.kind === 'turbo') {                         // in a car (or on a craft) with no job action armed: TURBO (hold)
    const f = input.fight(), c = P.mode === 'water' ? sim.water.ride : P.car, hot = ((c && c.turbo) || 0) > 0.05;
    g.globalAlpha = ba.cooling ? 0.5 : 1;
    g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    g.fillStyle = hot ? 'rgba(255,170,60,0.6)' : 'rgba(255,240,220,0.16)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,196,90,0.95)'; g.stroke();
    // twin chevrons: go faster
    g.strokeStyle = 'rgba(255,226,150,0.98)'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const dx of [-7, 5]) { g.beginPath(); g.moveTo(f.x + dx - 5, f.y - 10); g.lineTo(f.x + dx + 5, f.y); g.lineTo(f.x + dx - 5, f.y + 10); g.stroke(); }
    // the ring burns down while you hold it and refills while it cools — the button is its own gauge
    const left = ba.cooling ? 1 - c.turboLock / 2 : 1 - ba.heat;
    g.strokeStyle = ba.cooling ? 'rgba(255,240,220,0.8)' : 'rgba(255,120,60,0.95)'; g.lineWidth = 3.5;
    g.beginPath(); g.arc(f.x, f.y, f.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, left))); g.stroke();
    g.globalAlpha = 1;
    g.font = font(12, 800); g.textAlign = 'center'; g.fillStyle = '#ffe9b8'; g.fillText(ba.label, f.x, f.y - f.r - 13);
  }
  drawEventHud(g, vw, vh, top, sim, font);                  // city events: card, chain pill, bay progress, result
  // the job card: title, clock, what it wants, and an arrow to it
  if (sim.job) {
    const j = sim.job, y = top + 62, w = 190, x = vw / 2 - w / 2;
    g.fillStyle = 'rgba(20,12,40,0.55)'; g.beginPath(); g.roundRect(x, y, w, j.kind === 'taxi' && j.fare ? 52 : 40, 10); g.fill();
    g.textAlign = 'left'; g.font = font(13, 900); g.fillStyle = '#6ee2ff';
    g.fillText(JOBS.TITLES[j.kind], x + 12, y + 14);
    g.textAlign = 'right'; g.fillStyle = j.timer < 8 ? '#ff7a8a' : '#fff1d8';
    g.fillText(`0:${String(Math.max(0, Math.ceil(j.timer))).padStart(2, '0')}`, x + w - 12, y + 14);
    g.textAlign = 'left'; g.font = font(11, 700); g.fillStyle = '#fff1d8';
    const want = j.kind === 'taxi' ? (j.phase === 'pickup' ? 'FARE AT ' : 'DROP AT ') + j.spotName
      : j.kind === 'tow' ? (j.hooked ? 'HAUL TO GARAGE' : 'HOOK THE TARGET')
      : j.kind === 'bus' ? `STOP ${j.stop + 1}/6 · ${j.spotName}${j.dwell > 0 ? ' · BOARDING' : ''}`
      : j.phase === 'goto' ? 'CREW AT THE OFFICE' : j.tandem ? 'SKATE TO THE SAFE HOUSE' : 'SAFE HOUSE';
    g.fillText(want, x + 12, y + 30);
    if (j.kind === 'taxi' && j.fare) {                    // mood bar: green happy / amber nervous / red panic
      const m = j.fare.mood / 100, fed = j.fare.fed && j.fare.revealed;
      g.fillStyle = 'rgba(255,241,216,0.25)'; g.fillRect(x + 12, y + 41, w - 24, 5);
      g.fillStyle = fed ? (Math.floor(time * 6) % 2 ? '#ff2438' : '#369eff') : m > 0.6 ? '#62d66a' : m > 0.25 ? '#ffb84a' : '#ff5a5a';
      g.fillRect(x + 12, y + 41, (w - 24) * (fed ? 1 : m), 5);
    }
    if (j.kind === 'bus' && j.dwell > 0) { g.fillStyle = '#62d66a'; g.fillRect(x + 12, y + 36, (w - 24) * Math.min(1, j.dwell / 1.8), 3); }
    if (j.kind === 'tow' && j.hooked) { g.fillStyle = j.tension > 0.8 ? '#ff4a38' : '#ffd45c'; g.fillRect(x + 12, y + 36, (w - 24) * Math.min(1, j.tension || 0), 3); }
    if (j.spot) {                                        // arrow at the edge of a ring round the player
      const f = sim.focus(), dx = j.spot[0] - f.x, dy = j.spot[1] - f.y, d = Math.hypot(dx, dy);
      if (d > 170) {
        const a = Math.atan2(dy, dx), ax = vw / 2 + Math.cos(a) * 130, ay = vh / 2 + Math.sin(a) * 130;
        g.save(); g.translate(ax, ay); g.rotate(a);
        g.fillStyle = '#6ee2ff'; g.strokeStyle = 'rgba(20,12,40,0.7)'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(14, 0); g.lineTo(-8, -10); g.lineTo(-3, 0); g.lineTo(-8, 10); g.closePath(); g.stroke(); g.fill();
        g.restore();
        g.font = font(11, 800); g.textAlign = 'center'; g.fillStyle = '#d8f6ff';
        g.fillText(`${Math.round(d / 10)} m`, ax - Math.cos(a) * 26, ay - Math.sin(a) * 26);
      }
    }
  }
  if (input.fightOn && (P.mode === 'foot' || P.mode === 'siege')) {                // fight button: on foot only
    const f = input.fight(), hot = input.fightDown || P.punchT > 0;
    g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    g.fillStyle = hot ? 'rgba(255,110,90,0.6)' : 'rgba(255,240,220,0.16)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,150,120,0.95)'; g.stroke();
    // a little fist: four knuckles over a palm
    g.fillStyle = 'rgba(255,196,170,0.95)';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(f.x - 9 + i * 6, f.y - 5, 3.6, 0, Math.PI * 2); g.fill(); }
    g.fillRect(f.x - 12, f.y - 4, 24, 12); g.beginPath(); g.arc(f.x - 12, f.y + 3, 4, 0, Math.PI * 2); g.fill();
    g.font = font(12, 800); g.textAlign = 'center'; g.fillStyle = '#ffe2d4';
    g.fillText('PUNCH', f.x, f.y - f.r - 11);
  }
  // CONTROL GRAPHICS RETIRE (owner rule, Nov 17): the stick circle and the idle movement
  // hint show only for the first seconds of a run — main.js passes ctrlFade 1 -> 0 across
  // the fade window — and are not drawn at all after that. The stick keeps working,
  // invisibly: input.js is untouched, only this drawing is gated.
  const ca = opts.ctrlFade === undefined ? 1 : opts.ctrlFade;
  if (ca > 0 && input.stick) {
    const s = input.stick;
    g.globalAlpha = ca;
    g.beginPath(); g.arc(s.bx, s.by, input.R, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,240,220,0.12)'; g.fill();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,240,220,0.4)'; g.stroke();
    g.beginPath(); g.arc(s.kx, s.ky, 24, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,236,200,0.55)'; g.fill();
    g.globalAlpha = 1;
  } else if (ca > 0 && opts.hintStick) {
    g.globalAlpha = ca * (0.35 + Math.sin(time * 3) * 0.1);
    g.beginPath(); g.arc(90, vh - 130, input.R, 0, Math.PI * 2);
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,240,220,0.7)'; g.stroke();
    g.globalAlpha = 1;
  }
}
