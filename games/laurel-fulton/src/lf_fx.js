// lf_fx.js — what makes each car unmistakable at a glance (roster car.fx), plus the rally's on-world bits.
//   bass            : the car VIBRATES and throws expanding bass rings (Brad, Jimmy, Rigg)
//   underglow_blue  : a blue neon pool under the van, day or night (Jimmy)
//   tailpipe_sputter: irregular puffs + broken arcs spitting from the bare pipe at the REAR (Jason)
//   on_fire         : flames + smoke pouring off the parked Mustang (Lamar, Atholton HS)
// and the arrival beat's walkers + dap, the pulsing pickup rings. All drawn in world space by lf_render.js.
const TAU = Math.PI * 2;
const fxOf = (S, c) => (S.fxBy && S.fxBy[c.model]) || [];
export function setFx(S, roster) {
  S.fxBy = {};
  for (const p of roster.people) if (p.car && p.car.sprite) S.fxBy[p.car.sprite] = p.car.fx || [];
}
// before the car's colour pass: the underglow pool sits under the body
export function under(g, S, time) {
  for (const c of S.cars) if (fxOf(S, c).includes('underglow_blue')) {
    const r = g.createRadialGradient(c.x, c.y, 4, c.x, c.y, c.len * 0.75);
    r.addColorStop(0, 'rgba(70,150,255,0.85)'); r.addColorStop(0.55, 'rgba(50,110,255,0.4)'); r.addColorStop(1, 'rgba(40,90,255,0)');
    g.save(); g.translate(c.x, c.y); g.rotate(c.h); g.scale(1, 0.62); g.translate(-c.x, -c.y);
    g.globalAlpha = 0.75 + 0.25 * Math.sin(time * 3); g.fillStyle = r; g.beginPath(); g.arc(c.x, c.y, c.len * 0.75, 0, TAU); g.fill(); g.restore(); g.globalAlpha = 1;
  }
}
// the shake a bass car's body takes this frame (renderer offsets the sprite by it)
export function shake(S, c, time) {
  if (!fxOf(S, c).includes('bass')) return [0, 0];
  const beat = Math.max(0, Math.sin(time * 2 * Math.PI * 2.1)) ** 6;      // ~126 bpm kick
  return [Math.sin(time * 71 + c.x) * 1.4 * beat, Math.cos(time * 63 + c.y) * 1.4 * beat];
}
export function over(g, S, M, time) {
  for (const c of S.cars) {
    const fx = fxOf(S, c), ca = Math.cos(c.h), sa = Math.sin(c.h);
    if (fx.includes('bass')) for (let k = 0; k < 3; k++) {               // rings off the kick
      const u = ((time * 2.1 + k / 3) % 1), r = c.len * 0.45 + u * 70;
      g.globalAlpha = (1 - u) * 0.55; g.strokeStyle = k % 2 ? '#ffe9a8' : '#ffffff'; g.lineWidth = 2.6 * (1 - u) + 0.6;
      g.beginPath(); g.ellipse(c.x, c.y, r, r * 0.9, c.h, 0, TAU); g.stroke();
    }
    if (fx.includes('tailpipe_sputter')) {                              // broken, irregular — it sputters
      const rx = c.x - ca * (c.len / 2 + 2) + -sa * c.wid * 0.3, ry = c.y - sa * (c.len / 2 + 2) + ca * c.wid * 0.3;
      for (let k = 0; k < 5; k++) {
        const ph = (time * (1.7 + k * 0.37) + k * 0.61) % 1, on = Math.sin(time * 23 + k * 5.1) > -0.2;
        if (!on) continue;
        const d = 6 + ph * 46, sp = 0.5 + 0.35 * Math.sin(k * 2.3);
        g.globalAlpha = (1 - ph) * 0.65; g.strokeStyle = k % 2 ? '#d8d0c4' : '#fff6e2'; g.lineWidth = 2.2 * (1 - ph) + 0.5;
        g.beginPath(); g.arc(rx, ry, d, c.h + Math.PI - sp, c.h + Math.PI + sp); g.stroke();
        g.globalAlpha = (1 - ph) * 0.4; g.fillStyle = '#9a948c'; g.beginPath(); g.arc(rx - ca * d * 0.8, ry - sa * d * 0.8, 2 + ph * 6, 0, TAU); g.fill();
      }
    }
    if (fx.includes('on_fire')) {                                       // the burning Mustang: tongues of flame + rolling smoke
      for (let k = 0; k < 14; k++) {
        const ph = (time * (0.9 + (k % 4) * 0.23) + k * 0.137) % 1, ox = Math.sin(k * 7.3) * c.len * 0.32, oy = Math.cos(k * 3.1) * c.wid * 0.35;
        const x = c.x + ca * ox - sa * oy + ph * 18, y = c.y + sa * ox + ca * oy - ph * 22;
        g.globalAlpha = (1 - ph) * 0.9; g.fillStyle = ph < 0.35 ? '#fff3a0' : ph < 0.65 ? '#ffa531' : '#e3441f';
        g.beginPath(); g.ellipse(x, y, 5 + (1 - ph) * 5, 8 + (1 - ph) * 9, -0.4, 0, TAU); g.fill();
      }
      for (let k = 0; k < 8; k++) {
        const ph = (time * 0.35 + k / 8) % 1;
        g.globalAlpha = (1 - ph) * 0.42; g.fillStyle = '#3b3340'; g.beginPath(); g.arc(c.x + ph * 90 + Math.sin(k) * 8, c.y - ph * 70, 8 + ph * 30, 0, TAU); g.fill();
      }
    }
  }
  g.globalAlpha = 1;
  if (!M) return;
  for (const st of M.stops) if (!st.done) {                            // pickup rings: pull in here
    const p = 0.5 + 0.5 * Math.sin(time * 3);
    g.globalAlpha = 0.35 + 0.35 * p; g.strokeStyle = '#ffd25c'; g.lineWidth = 6; g.setLineDash([18, 12]);
    g.beginPath(); g.arc(st.x, st.y, 150 + p * 10, 0, TAU); g.stroke(); g.setLineDash([]);
  }
  if (M.stops.every(s => s.done) && !M.complete) { const [mx, my] = M.meet.pos, p = 0.5 + 0.5 * Math.sin(time * 3); g.globalAlpha = 0.4 + 0.3 * p; g.strokeStyle = '#7fd4ff'; g.lineWidth = 8; g.setLineDash([22, 14]); g.beginPath(); g.arc(mx, my, 400, 0, TAU); g.stroke(); g.setLineDash([]); }
  g.globalAlpha = 1;
  if (M.beat) for (const f of M.beat.figs) {                           // the walkers + the dap
    if (!f.vis) continue;
    const bob = f.dap ? Math.abs(f.dap) * 3 : 0, col = ['#d9583a', '#2f6fb0', '#e0a040', '#3f7a52', '#7a4a8c', '#c8c8cc', '#b81d24', '#1f6f7c', '#5a1424'][f.k % 9];
    g.fillStyle = 'rgba(30,20,50,0.35)'; g.beginPath(); g.ellipse(f.x + 3, f.y + 3, 7, 4, 0, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.ellipse(f.x, f.y - bob, 7, 5.5, 0, 0, TAU); g.fill();                         // shoulders, top-down
    g.fillStyle = '#e8c39e'; g.beginPath(); g.arc(f.x, f.y - bob, 3.6, 0, TAU); g.fill();                             // head
    g.strokeStyle = '#2a1430'; g.lineWidth = 1.2; g.stroke();
    g.font = '700 9px system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff3dc'; g.fillText(f.who.name.split(' ')[0], f.x, f.y - 12 - bob);
  }
  if (M.beat && M.beat.phase === 'dap') {                              // the dap: a spark in the middle of the huddle
    const { cx, cy } = M.beat, s = 1 + 0.4 * Math.sin(time * 18);
    g.globalAlpha = 0.9; g.fillStyle = '#ffe9a8'; g.font = '900 16px system-ui'; g.textAlign = 'center'; g.fillText('DAP!', cx, cy - 34 * s);
    g.globalAlpha = 1;
  }
}
