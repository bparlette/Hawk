// lf_fx.js — what makes each car unmistakable at a glance (roster car.fx), plus the rally's on-world bits.
//   bass            : the car VIBRATES and throws expanding bass rings (Brad, Jimmy, Rigg)
//   underglow_blue  : a blue neon pool under the van, day or night (Jimmy)
//   tailpipe_sputter: irregular puffs + broken arcs spitting from the bare pipe at the REAR (Jason)
//   on_fire         : Palm City's wreck fire on the parked Mustang — engine ember glow + dark smoke, NO flame tongues (Lamar, Atholton HS)
// and the arrival beat's walkers + dap, the pulsing pickup rings. All drawn in world space by lf_render.js.
const TAU = Math.PI * 2;
let this_ember = null;   // the ember gradient, built once (Palm City render.js wreck ember)
// ---- people: PALM CITY'S EXACT PED SPRITES (owner directive, Nov 17: reuse
// gta remake's assets for people, never redraw them). The sheets live in
// games/palm-city/assets/ and are REFERENCED, not copied, so the two games
// can never drift apart. Palm City's own manifest dialect (its render.js):
// 16 angles x 3 poses, cols 12, colour cell 39x39 at ox/oy -19.5, shadow
// 110x110 at -20.23/-64.32; walk cycle poses [0,1,2,1] at 7 fps, idle pose 1.
const PED_OUTFIT = { brad: 'player', clayton: 'ped_straw', zack: 'fare_chaos', rigg: 'ped_blue', kosack: 'ped_rose', jason: 'ped_white', jimmy: 'fare_tourist', billy: 'ped_sun', grant: 'fare_vip', lamar: 'fare_fed' };
const PED_FILE = { player: 'ped_player.webp', ped_straw: 'ped_ped_straw.webp', ped_blue: 'ped_ped_blue.webp', ped_rose: 'ped_ped_rose.webp', ped_white: 'ped_ped_white.webp', ped_sun: 'ped_ped_sun.webp', fare_tourist: 'jobs/ped_fare_tourist.webp', fare_chaos: 'jobs/ped_fare_chaos.webp', fare_vip: 'jobs/ped_fare_vip.webp', fare_fed: 'jobs/ped_fare_fed.webp' };
const PED_IMG = {};
if (typeof Image !== 'undefined') for (const k in PED_FILE) {
  const im = new Image(); im.src = new URL('../../palm-city/assets/' + PED_FILE[k], import.meta.url).href; PED_IMG[k] = im;
}
// NOTE: Palm City's *_sh sheets are NOT drawn here — they are pure-black RGB
// with the shadow shape in alpha, baked for Palm City's angled camera; drawn
// raw in this top-down game they smear into black streaks (seen Nov 17).
// drawPed lays its own soft ellipse instead, matching the car shadows.
function pedCell(g, img, idx, x, y, w, h, ox, oy) {
  const cw = img.naturalWidth / 12, ch = img.naturalHeight / 4;
  g.drawImage(img, (idx % 12) * cw, Math.floor(idx / 12) * ch, cw, ch, x + ox, y + oy, w, h);
}
// draws the fig as its Palm City ped; returns false until the sheet decodes
function drawPed(g, f, time) {
  const outfit = f.outfit || PED_OUTFIT[f.who.id] || 'ped_sun', img = PED_IMG[outfit];
  if (!img || !img.complete || !img.naturalWidth) return false;
  const dx = f.x - (f.px ?? f.x), dy = f.y - (f.py ?? f.y), moving = Math.hypot(dx, dy) > 0.02;
  if (moving) f.h = Math.atan2(dy, dx);
  f.px = f.x; f.py = f.y;
  let a = Math.round((f.h || 0) / TAU * 16) % 16; if (a < 0) a += 16;
  const pose = moving ? [0, 1, 2, 1][Math.floor(time * 7) % 4] : 1, idx = a * 3 + pose;
  if (!f.noShadow) {
  g.save(); g.translate(f.x, f.y + 5); g.scale(1, 0.45);
  const gr = g.createRadialGradient(0, 0, 1, 0, 0, 11);
  gr.addColorStop(0, 'rgba(24,30,18,0.34)'); gr.addColorStop(1, 'rgba(24,30,18,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill(); g.restore();
  }
  pedCell(g, img, idx, f.x, f.y - (f.dap ? Math.abs(f.dap) * 3 : 0), 39, 39, -19.5, -19.5);
  return true;
}
// the crowd's entry points (lf_party.js): the same Palm City ped, any outfit
export const drawPedAt = drawPed;
export const PED_OUTFITS = Object.keys(PED_FILE).filter(k => k !== 'player');
// the on-foot player (lf_foot.js state, set by main.js): the same Palm City ped,
// with Palm City's punch jab (its render.js: a sin-arc shove of 5 units).
let FOOTF = null, FOOTPROJ = null;
export function setFoot(f) { FOOTF = f; }
// M-D: friends on foot in the one world — main.js hands over a provider of remote-walker figures
// ({who, x, y, px, py, h, dap} from lf_net's walkerMap); they draw with the same ped as everyone else.
let WALKFN = null;
export function setWalkers(fn) { WALKFN = fn; }
// L5 heights (lf_climb.js): the renderer hands over its projection, so a walker up on the Atholton roof draws ON the
// roof (the same top-down perspective the building is drawn in), looms a little, and keeps a shadow on whatever is below
export function setFootProject(fn) { FOOTPROJ = fn; }
function drawFootNow(g, time) {
  if (!FOOTF || !FOOTF.active) return;
  const F = FOOTF, jab = F.punchT > 0 ? Math.sin(Math.PI * (0.26 - F.punchT) / 0.26) * 5 : 0, z = F.z || 0;
  const P = FOOTPROJ && z > 0 ? FOOTPROJ(F.x, F.y, z) : { x: F.x, y: F.y, k: 1 };
  if (z > 0) {                                            // the shadow stays on the surface below you
    const sp = FOOTPROJ ? FOOTPROJ(F.x, F.y, F.sup || 0) : { x: F.x, y: F.y };
    g.save(); g.translate(sp.x, sp.y + 5); g.scale(1, 0.45); g.globalAlpha = Math.max(0.35, 1 - (z - (F.sup || 0)) / 90);
    g.fillStyle = 'rgba(24,30,18,0.4)'; g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill(); g.restore();
  }
  const f = { who: F.who, x: P.x + Math.cos(F.h) * jab, y: P.y + Math.sin(F.h) * jab, h: F.h, px: F.px, py: F.py, dap: 0, noShadow: z > 0 };
  g.save();
  if (P.k !== 1 || F.land > 0) {                          // loom with height; a landing roll tumbles you once
    g.translate(f.x, f.y); g.scale(P.k, P.k); if (F.land > 0) g.rotate((1 - F.land / 0.35) * Math.PI * 2); g.translate(-f.x, -f.y);
  }
  f.px = f.x - (F.x - (F.px ?? F.x)); f.py = f.y - (F.y - (F.py ?? F.y));   // drawPed reads motion from px/py: the walker's true step
  if (drawPed(g, f, time)) { F.px = F.x; F.py = F.y; }
  g.restore();
  g.font = '700 9px system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff3dc'; g.fillText(F.who.name.split(' ')[0], P.x, P.y - 26 * P.k);
}
const fxOf = (S, c) => (S.fxBy && S.fxBy[c.model]) || [];
export function setFx(S, roster) {
  S.fxBy = {};
  for (const p of roster.people) if (p.car && p.car.sprite) S.fxBy[p.car.sprite] = p.car.fx || [];
}
import { TrackLayer } from './lf_skid.js';
let tracks = null, tracksT = 0;
// before the car's colour pass: Palm City's tyre-mark tiles (under everything), then the
// underglow pool sits under the body
export function under(g, S, time, view) {
  if (!tracks) tracks = new TrackLayer((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
  const dt = Math.min(0.1, Math.max(0, time - tracksT)); tracksT = time;
  if (view) tracks.draw(g, S, dt, view[0], view[1], view[2], view[3]);
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
    // CAR DAMAGE (Palm City stages, drawn over the sprite): panels scuff where they were hit,
    // glass frosts where it cracked; stage 2 smokes, a wreck burns — ember glow + dark smoke
    // (Palm City's fire ruling: embers, never flame tongues). All of it vanishes when the
    // car's 10 s self-heal lands, because the sim zeroes the state it reads.
    if (c.dent && (c.dmg > 0 || c.wreck)) {
      const L = c.len / 2, Wd = c.wid / 2;
      const panelXY = [[L * 0.55, 0], [-L * 0.55, 0], [0, -Wd * 0.8], [0, Wd * 0.8]];
      for (let p = 0; p < 4; p++) if (c.dent[p] > 0.03) {
        const [pu, pv] = panelXY[p];
        g.globalAlpha = 0.16 + 0.4 * c.dent[p]; g.fillStyle = '#241d18';
        g.beginPath(); g.ellipse(c.x + ca * pu - sa * pv, c.y + sa * pu + ca * pv, L * 0.42, Wd * 0.52, c.h, 0, TAU); g.fill();
      }
      for (let p = 0; p < 2; p++) if (c.glass[p] > 0.03) {
        const pu = p === 0 ? L * 0.22 : -L * 0.28;
        g.globalAlpha = 0.35 * c.glass[p]; g.fillStyle = '#dfeaf2';
        g.beginPath(); g.ellipse(c.x + ca * pu, c.y + sa * pu, L * 0.2, Wd * 0.62, c.h, 0, TAU); g.fill();
      }
      if (c.dmg >= 0.6) for (let k = 0; k < 6; k++) {                  // stage 2+: smoke off the engine
        const ph = (time * 0.5 + k / 6 + (c.x % 7) * 0.01) % 1;
        g.globalAlpha = (1 - ph) * (c.wreck ? 0.55 : 0.34); g.fillStyle = '#38323c';
        g.beginPath(); g.arc(c.x + ca * L * 0.5 + ph * 46, c.y + sa * L * 0.5 - ph * 40, 5 + ph * 20, 0, TAU); g.fill();
      }
      if (c.wreck) {                                                   // stage 3: burning — embers + glow
        const fl = 0.75 + 0.25 * Math.sin(time * 23 + c.x);
        const r = g.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.len * 0.62);
        r.addColorStop(0, `rgba(255,120,30,${0.5 * fl})`); r.addColorStop(0.6, `rgba(220,60,15,${0.28 * fl})`); r.addColorStop(1, 'rgba(200,50,10,0)');
        g.globalAlpha = 1; g.fillStyle = r; g.beginPath(); g.arc(c.x, c.y, c.len * 0.62, 0, TAU); g.fill();
        for (let k = 0; k < 7; k++) {
          const ph = (time * (1.1 + (k % 3) * 0.3) + k * 0.29) % 1, ox = Math.sin(k * 5.7) * c.len * 0.3, oy = Math.cos(k * 2.9) * c.wid * 0.3;
          g.globalAlpha = (1 - ph) * 0.95; g.fillStyle = ph < 0.4 ? '#ffd76a' : '#ff7a26';
          g.beginPath(); g.arc(c.x + ca * ox - sa * oy + ph * 10, c.y + sa * ox + ca * oy - ph * 16, 1.6 + (1 - ph) * 2.2, 0, TAU); g.fill();
        }
      }
      g.globalAlpha = 1;
    }
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
    if (fx.includes('on_fire')) {                                       // Lamar's Mustang — PALM CITY'S fire (standing rule, Nov 17): the engine
      const ex = c.x + ca * c.len * 0.3, ey = c.y + sa * c.len * 0.3;        // ember under the hood (render.js wreck ember, same gradient) + its dark
      if (!this_ember) { this_ember = g.createRadialGradient(0, 0, 0, 0, 0, 22); this_ember.addColorStop(0, 'rgba(255,207,92,1)'); this_ember.addColorStop(0.35, 'rgba(255,118,28,0.6)'); this_ember.addColorStop(1, 'rgba(0,0,0,0)'); }
      g.save(); g.translate(ex, ey); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 + 0.5 * (0.75 + 0.25 * Math.sin(time * 9 + c.x));
      g.fillStyle = this_ember; g.fillRect(-22, -22, 44, 44); g.restore(); g.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 12; k++) {                                        // smoke (destruct.js / drawSmoke dark puffs: base + lit lobe, no flame tongues)
        const u = (time * 0.32 + k / 12) % 1, sx = ex + u * 70 + Math.sin(k * 1.7 + time) * 6, sy = ey - u * 60, r = (4 + u * 15) * 1.6;
        g.globalAlpha = (1 - u) * 0.42; g.fillStyle = 'rgb(44,36,48)'; g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
        g.globalAlpha *= 0.7; g.fillStyle = 'rgb(74,62,72)'; g.beginPath(); g.arc(sx - r * 0.3, sy - r * 0.3, r * 0.55, 0, TAU); g.fill();
      }
    }
  }
  g.globalAlpha = 1;
  drawFootNow(g, time);
  if (WALKFN) for (const f of WALKFN()) {                    // M-D: the shared walkers — a friend out of their car, on foot
    if (drawPed(g, f, time) && f.who && f.who.name) { g.font = '700 9px system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff3dc'; g.fillText(f.who.name.split(' ')[0], f.x, f.y - 26); }
  }
  if (!M) return;
  for (const st of M.stops) if (!st.done) {                            // pickup rings: pull in here
    const p = 0.5 + 0.5 * Math.sin(time * 3);
    g.globalAlpha = 0.35 + 0.35 * p; g.strokeStyle = '#ffd25c'; g.lineWidth = 6; g.setLineDash([18, 12]);
    g.beginPath(); g.arc(st.x, st.y, 150 + p * 10, 0, TAU); g.stroke(); g.setLineDash([]);
  }
  if (M.stops.every(s => s.done) && !M.complete) { const [mx, my] = M.meet.pos, p = 0.5 + 0.5 * Math.sin(time * 3); g.globalAlpha = 0.4 + 0.3 * p; g.strokeStyle = '#7fd4ff'; g.lineWidth = 8; g.setLineDash([22, 14]); g.beginPath(); g.arc(mx, my, 400, 0, TAU); g.stroke(); g.setLineDash([]); }
  g.globalAlpha = 1;
  if (M.beat) for (const f of M.beat.figs) {                           // the walkers + the dap — Palm City ped sprites
    if (!f.vis) continue;
    if (f.h === undefined) f.h = Math.atan2(M.beat.cy - f.y, M.beat.cx - f.x);   // face the huddle until they move
    const bob = f.dap ? Math.abs(f.dap) * 3 : 0;
    if (!drawPed(g, f, time)) {                                       // sheets not decoded yet: the old painted figure
      const col = ['#d9583a', '#2f6fb0', '#e0a040', '#3f7a52', '#7a4a8c', '#c8c8cc', '#b81d24', '#1f6f7c', '#5a1424'][f.k % 9];
      g.fillStyle = 'rgba(30,20,50,0.35)'; g.beginPath(); g.ellipse(f.x + 3, f.y + 3, 7, 4, 0, 0, TAU); g.fill();
      g.fillStyle = col; g.beginPath(); g.ellipse(f.x, f.y - bob, 7, 5.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#e8c39e'; g.beginPath(); g.arc(f.x, f.y - bob, 3.6, 0, TAU); g.fill();
      g.strokeStyle = '#2a1430'; g.lineWidth = 1.2; g.stroke();
    }
    g.font = '700 9px system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff3dc'; g.fillText(f.who.name.split(' ')[0], f.x, f.y - 26 - bob);
  }
  if (M.barks && M.barks.drawWorld) M.barks.drawWorld(g);          // L17: the thrown ones / pens / pennies (lf_barks.js); the bubbles are a screen pass (main.js)
  if (M.beat && M.beat.stage && M.beat.stage.door) {             // L14 DOOR STAGING (data/beats.json): the mom at the front door, the boots, the lines
    const B = M.beat, G = B.stage, d = G.door, T = B.T || 0;
    const mom = G._fig || (G._fig = { who: { id: 'door', name: G.doorName || 'Mom' }, outfit: G.outfit || 'ped_rose', x: d.x, y: d.y, h: Math.atan2(B.cy - d.y, B.cx - d.x) });
    if (B.phase !== 'zoom') { drawPed(g, mom, time); g.font = '700 9px system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff3dc'; g.fillText((G.doorName || 'MOM').toUpperCase(), mom.x, mom.y - 26); }
    if (G.boots && T > 0.5 && T < 1.6) for (const k of [0, 1]) {   // the boots, thrown out the door into the yard, landing by the huddle
      const u = Math.min(1, (T - 0.5 - k * 0.12) / 0.85); if (u <= 0) continue;
      const bx = d.x + (B.cx - d.x) * 0.7 * u + k * 9, by = d.y + (B.cy - d.y) * 0.7 * u - Math.sin(u * Math.PI) * 40;
      g.save(); g.translate(bx, by); g.rotate(u * 9 + k); g.fillStyle = '#7a4a22'; g.fillRect(-6, -3, 12, 6); g.fillRect(-6, -9, 5, 7); g.restore();
    }
    if (G.boots && T >= 1.6) for (const k of [0, 1]) { const bx = d.x + (B.cx - d.x) * 0.7 + k * 9, by = d.y + (B.cy - d.y) * 0.7; g.fillStyle = '#7a4a22'; g.fillRect(bx - 6, by - 3, 12, 6); g.fillRect(bx - 6, by - 9, 5, 7); }
    if (B.say) {                                                 // the line, over whoever says it — kept inside the frame (the framing lesson)
      const sp = B.say.who === 'door' ? mom : (B.figs.find(f => f.who && f.who.id === B.say.who) || mom);
      g.font = '800 13px system-ui'; const w = g.measureText(B.say.text).width + 20;
      g.fillStyle = 'rgba(255,248,232,0.97)'; g.beginPath(); g.roundRect(sp.x - w / 2, sp.y - 62, w, 24, 9); g.fill(); g.strokeStyle = '#2a1430'; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#2a1430'; g.textAlign = 'center'; g.fillText(B.say.text, sp.x, sp.y - 45);
    }
  }
  if (M.beat && M.beat.phase === 'dap') {                              // the dap: a spark in the middle of the huddle
    const { cx, cy } = M.beat, s = 1 + 0.4 * Math.sin(time * 18);
    g.globalAlpha = 0.9; g.fillStyle = '#ffe9a8'; g.font = '900 16px system-ui'; g.textAlign = 'center'; g.fillText('DAP!', cx, cy - 34 * s);
    g.globalAlpha = 1;
  }
}
