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
    g.fillText(opts.demo ? 'DEMO — watching a 30 second run' : 'drag left side to move  ·  tap ● to jack a car', vw / 2, vh * 0.3 + 44);
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

  // controls
  const b = input.button();
  const P = sim.player;
  let label = '';
  if (P.mode === 'car') label = Math.abs(P.car.v) < 60 ? 'EXIT' : '';
  else if (P.mode === 'board') label = Math.hypot(sim.board.vx, sim.board.vy) < 22 ? 'DROP' : sim.board.grind ? 'POP' : 'OLLIE';
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
  if (input.stick) {
    const s = input.stick;
    g.beginPath(); g.arc(s.bx, s.by, input.R, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,240,220,0.12)'; g.fill();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,240,220,0.4)'; g.stroke();
    g.beginPath(); g.arc(s.kx, s.ky, 24, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,236,200,0.55)'; g.fill();
  } else if (opts.hintStick) {
    g.globalAlpha = 0.35 + Math.sin(time * 3) * 0.1;
    g.beginPath(); g.arc(90, vh - 130, input.R, 0, Math.PI * 2);
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,240,220,0.7)'; g.stroke();
    g.globalAlpha = 1;
  }
}
