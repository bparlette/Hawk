// lf_places_render.js — task L12/L13: the drawing for lf_places.js.
//   PlaceRenderer      the SIDE CUTAWAY of a public building (types 'store' = the Weis, 'restaurant' = Gringada). It extends the house
//                      cutaway renderer (same ink, shadows, pills, bubbles, Palm City's side-view person sheet) and adds the store
//                      /restaurant prop vocabulary + residents + the MEMORY treatment. One long floor, camera pans x.
//   heroStyle(...)     the top-down EXTERIOR over the hero tier's placeholder roof: Weis = big-box grocery (red WEIS sign, glass
//                      vestibule, rooftop HVAC, cart corral); Gringada = MEMORY treatment (sepia, dashed outline, 1998 tag).
//   worldFx(...)       world-space extras: the 108 Astro's parking lights (lit / robbed), Scott's house tag, the on-foot bark.
import { InteriorRenderer } from './lf_interior_render.js';
const TAU = Math.PI * 2, INK = '#2a1430';

// ---- the person sheets (Palm City's side-view peds): the player sheet for everyone, the cop sheet for the guard
const SH = { M: null, img: {}, tint: {} };
if (typeof Image !== 'undefined') {
  fetch(new URL('../../palm-city/assets/siege.json', import.meta.url)).then(r => r.json()).then(M => {
    SH.M = M; for (const n of ['player', 'cop']) { const im = new Image(); im.src = new URL('../../palm-city/assets/' + M.peds[n].color.file, import.meta.url).href; SH.img[n] = im; }
  }).catch(() => {});
}
const LOOKS = {   // who wears what: sheet, shirt tint (over the torso half), accessory
  guard: { sheet: 'cop', tag: '#e8c23a' }, apron: { sheet: 'player', tint: '#b8322a', acc: 'apron' }, rigg: { sheet: 'player', tint: '#2f6fd9', acc: 'vest' },
  manager: { sheet: 'player', tint: '#e8e6dc', acc: 'tie' }, jimmy: { sheet: 'player', tint: '#2f4fd0' }, clayton: { sheet: 'player', tint: '#e8c8a0' },
  zack: { sheet: 'player', tint: '#7a9a4a' }, hero: { sheet: 'player' },
};
function sheetFor(look) {
  const L = LOOKS[look] || LOOKS.hero, im = SH.img[L.sheet]; if (!im || !im.complete || !im.naturalWidth) return null;
  if (!L.tint) return im;
  const key = L.sheet + L.tint; if (SH.tint[key]) return SH.tint[key];
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = L.tint; g.globalAlpha = 0.62;
  const ch = im.height / 2; for (let r = 0; r < 2; r++) g.fillRect(0, r * ch, im.width, ch * 0.5);        // torso half of every cell
  return SH.tint[key] = c;
}

export class PlaceRenderer extends InteriorRenderer {
  draw(I, vw, vh, dpr, time) {
    const g = this.ctx, K = I.K, F = I.F.main, CE = K.ceiling, W = K.width, mem = !!K.memory;
    const k = Math.min(60, vh * 0.8 / (CE + 2.4)), gy = vh * 0.7;    // k 60: ~7 m across — a whole scene (guard, cook, the firing) fits; people ~1/8 of the screen (a long room, not a dollhouse: SPEC §1 relaxed for one-floor places)
    const half = vw / 2 / k, want = Math.max(-3.4 + half, Math.min(W + 0.6 - half, I.focus != null ? I.focus : I.hero.x));
    this.camX = this.camX == null ? want : this.camX + (want - this.camX) * 0.12;
    const SX = (x) => vw / 2 + (x - this.camX) * k, SY = (z) => gy - z * k;
    this.SX = SX; this.SY = SY; this.k = k; this.vw = vw;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, gy); sky.addColorStop(0, '#e9a46e'); sky.addColorStop(1, '#ffd79a'); g.fillStyle = sky; g.fillRect(0, 0, vw, gy);
    g.fillStyle = '#6f9a48'; g.fillRect(0, gy - 6, vw, 8);
    // the parking lot under the front of the building + the earth under the slab
    const earth = g.createLinearGradient(0, gy, 0, vh); earth.addColorStop(0, '#5b5658'); earth.addColorStop(1, '#2e2a33'); g.fillStyle = earth; g.fillRect(0, gy + 2, vw, vh - gy);
    g.fillStyle = 'rgba(255,255,255,0.18)'; for (let x = -3.4; x < 0; x += 1.2) g.fillRect(SX(x), gy + 0.9 * k, 0.5 * k, 3);          // lot stripes
    // ---- the roof, cut: a flat membrane roof with rooftop units, parapet
    const top = CE;
    g.fillStyle = '#6c6a70'; g.fillRect(SX(-0.4), SY(top + 0.55), (W + 0.8) * k, 0.55 * k);
    g.fillStyle = '#5a5860'; g.fillRect(SX(-0.4), SY(top + 0.55), (W + 0.8) * k, 0.1 * k);
    for (let x = 4; x < W - 3; x += 9.5) { this.box(g, x, top + 0.55, 2.2, 0.55, '#a9a9ad'); g.fillStyle = '#6a6a70'; g.beginPath(); g.arc(SX(x + 1.1), SY(top + 1.1), 0.34 * k, Math.PI, 0); g.fill(); }
    // ---- the shell: back wall per room, floor bands, the cut slabs
    for (const r of K.rooms) {
      g.fillStyle = r.wall; g.fillRect(SX(r.x0), SY(top), SX(r.x1) - SX(r.x0), SY(0) - SY(top));
      g.fillStyle = 'rgba(40,30,20,0.07)'; for (let x = r.x0 + 1; x < r.x1; x += 2) g.fillRect(SX(x), SY(top), 1, SY(0) - SY(top));        // wall panel seams
      g.fillStyle = r.floorc; g.fillRect(SX(r.x0), SY(0) - 0.08 * k, SX(r.x1) - SX(r.x0), 0.08 * k);
      g.fillStyle = 'rgba(60,40,20,0.22)'; for (let x = r.x0 + 0.6; x < r.x1; x += 0.6) g.fillRect(SX(x), SY(0) - 0.08 * k, 1, 0.08 * k);   // floor tile seams
    }
    if (K.type === 'store') this.storeBackdrop(g, I, time); else this.restaurantBackdrop(g, I, time);
    // ceiling slab + fluorescent strips
    g.fillStyle = '#4a4850'; g.fillRect(SX(-0.4), SY(top), (W + 0.8) * k, 0.2 * k);
    for (let x = 2; x < W - 1; x += 3.2) { g.fillStyle = '#f4f2e6'; g.fillRect(SX(x), SY(top) + 0.2 * k, 1.5 * k, 3); }
    g.fillStyle = '#4a3036'; g.fillRect(SX(-0.4), SY(0), (W + 0.8) * k, 0.22 * k);                                                           // the slab
    this.facade(g, I, time);
    // ---- props, then people (guard + cook BEHIND their counters)
    for (const p of K.props) this.place(g, p, I, time);
    for (const a of I.npcs) if (!a.hidden) this.person(g, a, time, a.look, a.role);
    this.person(g, I.hero, time, 'hero', '', true);
    for (const p of K.props) if (p.kind === 'pizza' || p.kind === 'sec_desk' || p.kind === 'counter') this.front(g, p, I, time);
    this.lights(g, I, time);
    for (const f of I.fx) this.fizz(g, f);
    // ---- labels last, on pills (SPEC §3)
    for (const r of K.rooms) { const vx0 = Math.max(SX(r.x0), 0), vx1 = Math.min(SX(r.x1), vw), cx = (vx0 + vx1) / 2; if (vx1 - vx0 < 70) continue; g.font = '800 10px system-ui'; const tw = g.measureText(r.name.toUpperCase()).width + 14; g.fillStyle = 'rgba(27,20,48,0.66)'; g.beginPath(); g.roundRect(Math.max(4, Math.min(vw - tw - 4, cx - tw / 2)), SY(top) + 0.3 * k, tw, 16, 8); g.fill(); g.fillStyle = '#ffe4b0'; g.textAlign = 'center'; g.fillText(r.name.toUpperCase(), Math.max(4 + tw / 2, Math.min(vw - tw / 2 - 4, cx)), SY(top) + 0.3 * k + 12); }
    for (const a of [...I.npcs, I.hero]) if (a.speech && !a.hidden) this.bubble(g, SX(a.x), SY(a.z + 2.3), a.speech.text, Math.min(1, a.speech.t * 2));
    if (mem) this.memoryPass(g, I, vw, vh, time);
    // ---- HUD
    g.textAlign = 'left'; g.font = '900 13px system-ui'; const hud = `${K.sign.text} · ${K.sign.sub}`; const hw = g.measureText(hud).width + 30; g.fillStyle = 'rgba(27,20,48,0.72)'; g.beginPath(); g.roundRect(12, 74, hw, 26, 12); g.fill(); g.fillStyle = '#ffd25c'; g.fillText(hud, 24, 92);
    g.textAlign = 'center'; g.font = '800 13px system-ui'; g.fillStyle = '#fff1d8'; g.fillText(I.roomOf(I.hero), vw / 2, 40);
    if (mem) { g.font = '800 11px system-ui'; const t = K.memory.label, w = g.measureText(t).width + 22; g.fillStyle = 'rgba(120,70,30,0.82)'; g.beginPath(); g.roundRect(vw / 2 - w / 2, 48, w, 20, 10); g.fill(); g.fillStyle = '#ffe7c0'; g.fillText(t, vw / 2, 62); }
    if (I.hero.hold) { g.font = '800 12px system-ui'; g.fillStyle = '#fff1d8'; g.fillText('holding: ' + I.hero.hold, vw / 2, 112); }
    if (I.banner) { const a = Math.min(1, I.banner.t); g.globalAlpha = a; g.font = '900 15px system-ui'; const w = g.measureText(I.banner.text).width + 34; g.fillStyle = 'rgba(160,32,58,0.92)'; g.beginPath(); g.roundRect(vw / 2 - w / 2, vh * 0.2, w, 36, 14); g.fill(); g.fillStyle = '#fff'; g.fillText(I.banner.text, vw / 2, vh * 0.2 + 23); g.globalAlpha = 1; }
  }
  // ---------------------------------------------------------------------------------------------------- the front of the building (x < 0)
  facade(g, I, time) {
    const { SX, SY, k } = this, K = I.K, CE = K.ceiling, mem = !!K.memory;
    g.fillStyle = mem ? '#e8c9a0' : '#c9c5bb'; g.fillRect(SX(-0.4), SY(CE), 0.4 * k, SY(0) - SY(CE));                               // the cut front wall
    g.fillStyle = '#4a3036'; g.fillRect(SX(-0.4), SY(CE), 0.4 * k, 0.2 * k);
    // the glass entry + door: an opening in the wall with a sliding door (store) / wooden door (restaurant)
    g.fillStyle = K.type === 'store' ? 'rgba(170,215,235,0.8)' : '#6a3a28'; g.fillRect(SX(-0.38), SY(2.2), 0.36 * k, 2.2 * k); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(SX(-0.38), SY(2.2), 0.36 * k, 2.2 * k);
    // the sign: pylon in the lot (store) / a stucco sign band with tile accents (restaurant)
    const sx = SX(-2.1), sy = SY(CE + 0.6);
    if (K.type === 'store') {
      g.fillStyle = '#7a7a82'; g.fillRect(sx - 0.1 * k, sy, 0.2 * k, SY(0) - sy); this.box(g, -3.3, CE + 0.2, 2.5, 1.3, '#c8202f');
      g.fillStyle = '#fff'; g.font = `900 ${0.9 * k}px system-ui`; g.textAlign = 'center'; g.fillText(K.sign.text, sx, SY(CE + 0.2 + 0.32)); g.font = `800 ${0.2 * k}px system-ui`; g.fillText('MARKETS', sx, SY(CE + 0.2 + 0.09));
      this.box(g, -3.2, 0, 2.3, 0.1, '#8a8a90');
    } else {
      this.box(g, -3.2, CE - 1.0, 2.8, 0.9, '#2f7a52'); g.fillStyle = '#ffe9b8'; g.font = `900 ${0.45 * k}px system-ui`; g.textAlign = 'center'; g.fillText(K.sign.text, sx - 0.05 * k, SY(CE - 0.65));
      for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#d9583a' : '#e8c23a'; g.fillRect(SX(-3.2 + i * 0.4), SY(CE - 1.0) + 0.9 * k, 0.4 * k, 4); }
      g.fillStyle = '#b8321e'; g.beginPath(); g.moveTo(SX(-3.2), SY(CE - 1.0) + 0.9 * k + 4); for (let i = 0; i <= 7; i++) g.lineTo(SX(-3.2 + i * 0.4), SY(CE - 1.0) + 0.9 * k + (i % 2 ? 12 : 6)); g.lineTo(SX(-0.4), SY(CE - 1.0) + 0.9 * k + 4); g.fill();   // awning scallops
    }
  }
  storeBackdrop(g, I) {                                    // far aisles: rows of tall gondolas receding behind the real ones
    const { SX, SY, k } = this, K = I.K; g.save(); g.globalAlpha = 0.5;
    for (let x = 14.5; x < 36; x += 1.7) { const hh = 1.7 + ((x * 7) % 3) * 0.1; g.fillStyle = '#b9b4a6'; g.fillRect(SX(x), SY(hh), 0.9 * k, hh * k); const cols = ['#d94a3a', '#e8c23a', '#3a7ad9', '#2f8f5a', '#e87a2a']; for (let s = 0; s < 4; s++) { g.fillStyle = cols[Math.floor(x * 3 + s) % 5]; g.fillRect(SX(x) + 2, SY(hh) + s * hh * k / 4 + 3, 0.9 * k - 4, hh * k / 4 - 7); } }
    g.restore();
    g.fillStyle = '#c8202f'; g.fillRect(SX(0), SY(K.ceiling - 0.05) + 0.3 * k, SX(13.4) - SX(0), 0.28 * k);                                // red front-end band
    g.fillStyle = '#2f6fb0'; g.fillRect(SX(19.4), SY(K.ceiling - 0.05) + 0.3 * k, SX(35.4) - SX(19.4), 0.2 * k);
  }
  restaurantBackdrop(g, I) {
    const { SX, SY, k } = this, K = I.K;
    g.fillStyle = '#b8321e'; g.fillRect(SX(0), SY(1.05), SX(10.6) - SX(0), 1.05 * k - 0.08 * k);                                          // red wainscot
    g.fillStyle = '#e8c23a'; g.fillRect(SX(0), SY(1.08), SX(10.6) - SX(0), 3);
    g.fillStyle = '#e8d9b0'; for (let x = 0.3; x < 10.6; x += 0.9) { g.beginPath(); g.moveTo(SX(x), SY(1.0)); g.lineTo(SX(x + 0.3), SY(0.55)); g.lineTo(SX(x), SY(0.1)); g.lineTo(SX(x - 0.3), SY(0.55)); g.closePath(); g.fill(); }   // tile diamonds
    this.win(g, 6.6, 1.2, 2.6, 1.3);
    g.fillStyle = '#7a3a28'; for (let x = 0.2; x < 10.6; x += 1.4) g.fillRect(SX(x), SY(K.ceiling), 0.1 * k, 0.25 * k);                    // vigas
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(SX(16.4), SY(K.ceiling), SX(K.width) - SX(16.4), 0.16 * k);
  }
  // ---------------------------------------------------------------------------------------------------- the props
  place(g, p, I, time) {
    const { SX, SY, k } = this, x = p.x, z = 0, CE = I.K.ceiling;
    const SHW = { cart: 1.2, sec_desk: 2.2, register: 1.9, produce: 2.2, shelf: 1.5, soda: 1.5, dairy: 4, deli: 2.6, pizza: 4, grill: 2.4, prep: 2.2, counter: 3.2, hot_case: 1.8, booth: 2.4, salsa: 1.4, table: 1.5 };
    if (SHW[p.kind]) this.shadow(g, x, z, SHW[p.kind]);
    const sign = (txt, zz, col = 'rgba(27,20,48,0.78)') => { g.font = '800 10px system-ui'; const w = g.measureText(txt).width + 16; g.fillStyle = col; g.beginPath(); g.roundRect(SX(x) - w / 2, SY(zz), w, 17, 7); g.fill(); g.fillStyle = '#fff1d8'; g.textAlign = 'center'; g.fillText(txt, SX(x), SY(zz) + 12); g.strokeStyle = 'rgba(40,30,30,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(SX(x) - w / 3, SY(zz)); g.lineTo(SX(x) - w / 3, SY(CE)); g.moveTo(SX(x) + w / 3, SY(zz)); g.lineTo(SX(x) + w / 3, SY(CE)); g.stroke(); };
    switch (p.kind) {
      case 'cart': for (const d of [0, 0.32]) { this.box(g, x - 0.45 + d, 0.28, 0.9, 0.55, '#b9bdc4'); g.strokeStyle = '#7a7e86'; g.lineWidth = 1; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(SX(x - 0.45 + d + i * 0.18), SY(0.28)); g.lineTo(SX(x - 0.45 + d + i * 0.18), SY(0.83)); g.stroke(); } g.fillStyle = INK; for (const w of [0.12, 0.78]) { g.beginPath(); g.arc(SX(x - 0.45 + d + w), SY(0.1), 0.07 * k, 0, TAU); g.fill(); } } break;
      case 'sec_desk': this.box(g, x - 0.95, 0, 1.9, 1.05, '#2f4a78'); this.box(g, x - 1.0, 1.05, 2.0, 0.07, '#8aa0c8');
        for (const dx of [-0.55, 0.15]) { this.box(g, x + dx, 1.12, 0.5, 0.36, '#1a1c24'); g.fillStyle = `rgba(90,230,150,${0.55 + 0.2 * Math.sin(time * 5 + dx * 9)})`; g.fillRect(SX(x + dx + 0.04), SY(1.12 + 0.32), 0.42 * k, 0.26 * k); }
        g.fillStyle = '#e8c23a'; g.font = '800 9px system-ui'; g.textAlign = 'center'; g.fillText('SECURITY', SX(x), SY(0.45)); break;
      case 'register': {
        this.box(g, x - 0.85, 0.5, 1.5, 0.12, '#3a3a40'); this.box(g, x - 0.85, 0.62, 1.5, 0.05, '#222');           // the belt
        this.box(g, x + 0.7, 0, 0.55, 0.95, '#6a6e78'); this.box(g, x + 0.75, 0.95, 0.4, 0.3, '#1a1c24'); g.fillStyle = `rgba(110,230,160,${0.6 + 0.2 * Math.sin(time * 3 + p.x)})`; g.fillRect(SX(x + 0.79), SY(1.21), 0.32 * k, 0.2 * k);
        g.fillStyle = '#4a4a50'; g.fillRect(SX(x - 0.85), SY(0.5), 1.5 * k, 0.5 * k);
        g.fillStyle = '#7a7e86'; g.fillRect(SX(x + 0.3), SY(CE - 0.3), 2, (CE - 0.3 - 1.3) * k); this.box(g, x + 0.05, CE - 0.7, 0.5, 0.42, '#1f6a3a'); g.fillStyle = '#d6ffe0'; g.font = `900 ${0.3 * k}px system-ui`; g.textAlign = 'center'; g.fillText(String(p.lane), SX(x + 0.3), SY(CE - 0.4)); break; }
      case 'produce': this.box(g, x - 1.0, 0, 2.0, 0.62, '#8a5a30'); this.box(g, x - 1.0, 0.62, 2.0, 0.16, '#5a3a20'); for (let i = 0; i < 9; i++) { g.fillStyle = ['#d9302a', '#e8a21a', '#5aa83a', '#d94a8a'][(i + (p.x | 0)) % 4]; g.beginPath(); g.arc(SX(x - 0.85 + i * 0.21), SY(0.86 + (i % 2) * 0.08), 0.1 * k, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke(); } if (p.x < 16) sign('PRODUCE', CE - 1.0, '#2f7a3a'); break;
      case 'shelf': case 'soda': this.gondola(g, p, I, time); sign(p.sign, CE - 0.95, p.kind === 'soda' ? '#2f6fb0' : undefined); break;
      case 'dairy': this.box(g, x - 2.0, 0, 4.0, 2.1, '#d8e6ee'); for (let i = 0; i < 4; i++) { this.box(g, x - 1.95 + i * 0.99, 0.1, 0.93, 1.9, 'rgba(180,225,245,0.55)'); for (let s = 0; s < 4; s++) { g.fillStyle = s % 2 ? '#fafafa' : '#9fd0ee'; g.fillRect(SX(x - 1.85 + i * 0.99), SY(0.3 + s * 0.45) , 0.72 * k, 0.28 * k); } } sign('DAIRY · FROZEN', CE - 0.95, '#3a7ad9'); break;
      case 'deli': this.box(g, x - 1.2, 0, 2.4, 0.95, '#d8d4c8'); this.box(g, x - 1.2, 0.95, 2.4, 0.5, 'rgba(190,230,245,0.6)'); for (let i = 0; i < 4; i++) { g.fillStyle = ['#c05a4a', '#e8d098', '#a85a3a', '#d98a6a'][i]; g.fillRect(SX(x - 1.05 + i * 0.58), SY(1.27), 0.46 * k, 0.2 * k); } sign('DELI', CE - 0.95, '#a85a3a'); break;
      case 'pizza': {   // the pizza counter + a stone oven behind/right of it. Brad works the right side.
        this.box(g, x - 1.1, 0, 1.9, 0.95, '#a8321e'); this.box(g, x - 1.15, 0.95, 2.0, 0.07, '#d8d0c0');
        g.fillStyle = '#fff'; g.font = '800 9px system-ui'; g.textAlign = 'center'; g.fillText('PIZZA', SX(x - 0.15), SY(0.45));
        for (let i = 0; i < 3; i++) this.box(g, x - 0.9, 1.02 + i * 0.07, 0.62, 0.07, '#e8d9b0');                                 // the boxes
        this.box(g, x + 1.55, 0, 1.5, 1.25, '#8a5a3a'); g.fillStyle = '#6a3a24'; g.beginPath(); g.arc(SX(x + 2.3), SY(1.25), 0.75 * k, Math.PI, 0); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
        const em = g.createRadialGradient(SX(x + 2.3), SY(0.7), 2, SX(x + 2.3), SY(0.7), 0.45 * k); em.addColorStop(0, 'rgba(255,200,80,1)'); em.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = em; g.globalAlpha = 0.75 + 0.25 * Math.sin(time * 8); g.fillRect(SX(x + 1.9), SY(1.05), 0.8 * k, 0.7 * k); g.globalAlpha = 1;
        this.box(g, x - 0.6, CE - 1.9, 3.0, 1.1, '#1f1a22'); g.fillStyle = '#ffd25c'; g.font = '900 15px system-ui'; g.fillText('PIZZA · SUBS', SX(x + 0.9), SY(CE - 1.15)); g.fillStyle = '#d9302a'; g.beginPath(); g.arc(SX(x - 0.1), SY(CE - 1.3), 0.17 * k, 0, TAU); g.fill();
        break; }
      case 'door_back': this.box(g, x - 0.5, 0, 1.0, 2.1, '#8a8e96'); g.fillStyle = '#fff'; g.font = '700 7px system-ui'; g.textAlign = 'center'; g.fillText('EMPLOYEES', SX(x), SY(1.4)); g.fillText('ONLY', SX(x), SY(1.2)); break;
      // ---- Gringada
      case 'sombrero': g.fillStyle = '#e8c23a'; g.beginPath(); g.ellipse(SX(x), SY(2.3), 0.85 * k, 0.17 * k, -0.15, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke(); g.fillStyle = '#d9583a'; g.beginPath(); g.ellipse(SX(x + 0.02), SY(2.5), 0.32 * k, 0.28 * k, 0, Math.PI, 0); g.fill(); g.stroke(); break;
      case 'booth': this.box(g, x - 1.1, 0, 0.35, 1.2, '#a82a1e'); this.box(g, x + 0.75, 0, 0.35, 1.2, '#a82a1e'); this.box(g, x - 0.75, 0.62, 1.5, 0.08, '#7a5a34'); this.box(g, x - 0.1, 0, 0.12, 0.62, '#5a3a24'); this.salsaBowl(g, x, 0.7); break;
      case 'table': super.prop(g, p, 0, I, time); for (const dx of [-0.95, 0.9]) { this.box(g, x + dx - 0.2, 0, 0.4, 0.08, '#7a5a34'); this.box(g, x + dx - 0.18, 0.45, 0.36, 0.08, '#a82a1e'); this.box(g, x + dx - 0.18 + (dx < 0 ? 0 : 0.28), 0.5, 0.08, 0.45, '#a82a1e'); } this.salsaBowl(g, x, 0.79); break;
      case 'menu': this.box(g, x - 1.4, CE - 1.55, 2.8, 1.0, '#1f3a2a'); g.fillStyle = '#f4ead8'; g.font = '700 9px system-ui'; g.textAlign = 'left'; ['BURRITO  3.99', 'TACOS (2)  1.99', 'NACHOS  2.49', 'QUESADILLA  3.29'].forEach((t, i) => g.fillText(t, SX(x - 1.25), SY(CE - 0.72 - i * 0.2))); break;
      case 'counter': this.box(g, x - 1.5, 0, 3.0, 1.0, '#c9b08a'); g.fillStyle = '#4f8f6a'; for (let i = 0; i < 12; i++) g.fillRect(SX(x - 1.5 + i * 0.25), SY(0.6), 0.2 * k, 0.2 * k); this.box(g, x - 1.55, 1.0, 3.1, 0.08, '#7a5a34'); this.box(g, x + 0.9, 1.08, 0.45, 0.32, '#222'); break;
      case 'hot_case': this.box(g, x - 0.8, 0, 1.6, 0.95, '#d8d4c8'); this.box(g, x - 0.85, 0.95, 1.7, 0.62, 'rgba(190,230,245,0.55)');
        for (let i = 0; i < I.caseLeft; i++) { g.fillStyle = '#e8c98a'; g.beginPath(); g.ellipse(SX(x - 0.62 + (i % 3) * 0.55), SY(1.12 + (i > 2 ? 0.26 : 0)), 0.2 * k, 0.08 * k, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke(); }
        g.fillStyle = '#fff'; g.font = '800 8px system-ui'; g.textAlign = 'center'; g.fillText('HOT · FRESH', SX(x), SY(0.45)); break;
      case 'salsa': this.box(g, x - 0.6, 0, 1.2, 0.8, '#7a5a34'); for (let i = 0; i < 3; i++) { g.fillStyle = ['#c42b2b', '#5aa83a', '#e8a21a'][i]; g.beginPath(); g.ellipse(SX(x - 0.35 + i * 0.35), SY(0.82), 0.14 * k, 0.05 * k, 0, 0, TAU); g.fill(); } break;
      case 'grill': this.box(g, x - 1.2, 0, 2.4, 0.95, '#6a6e78'); this.box(g, x - 1.0, 0.95, 2.0, 0.1, '#2a2a30'); this.box(g, x - 1.1, 2.0, 2.2, 0.75, '#8a8e96'); g.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(SX(x - 0.5 + i * 0.35), SY(1.5 + ((time * 0.4 + i * 0.3) % 0.5)), 0.12 * k, 0.07 * k, 0, 0, TAU); g.fill(); } break;
      case 'prep': this.box(g, x - 1.0, 0, 2.0, 0.92, '#b8bcc4'); for (let i = 0; i < 4; i++) { g.fillStyle = ['#c42b2b', '#5aa83a', '#e8d9b0', '#e8a21a'][i]; g.fillRect(SX(x - 0.9 + i * 0.47), SY(1.0), 0.4 * k, 0.1 * k); } this.box(g, x - 1.0, 1.7, 2.0, 0.07, '#8a8e96'); break;
      default: super.prop(g, p, 0, I, time);
    }
  }
  salsaBowl(g, x, z) { const { SX, SY, k } = this; g.fillStyle = '#c42b2b'; g.beginPath(); g.ellipse(SX(x - 0.15), SY(z + 0.04), 0.1 * k, 0.04 * k, 0, 0, TAU); g.fill(); g.fillStyle = '#e8c23a'; g.beginPath(); g.moveTo(SX(x + 0.05), SY(z)); g.lineTo(SX(x + 0.25), SY(z)); g.lineTo(SX(x + 0.15), SY(z + 0.12)); g.fill(); }
  gondola(g, p, I, time) {                                   // a shelf unit seen from the end of the aisle: 4 shelves of product blocks, a header, a base
    const { SX, SY, k } = this, x = p.x, cols = p.cols || ['#999'];
    this.box(g, x - 0.65, 0, 1.3, 1.95, '#cfcfd4'); this.box(g, x - 0.65, 0, 1.3, 0.18, '#7a7a82');
    for (let s = 0; s < 4; s++) { const z = 0.28 + s * 0.42; g.fillStyle = '#8a8a92'; g.fillRect(SX(x - 0.63), SY(z), 1.26 * k, 3); for (let i = 0; i < 5; i++) { const hh = 0.24 + ((i * 5 + s * 3 + (p.x | 0)) % 3) * 0.05; g.fillStyle = cols[(i + s) % cols.length]; g.fillRect(SX(x - 0.58 + i * 0.24), SY(z + hh), 0.2 * k, hh * k); g.strokeStyle = 'rgba(30,20,30,0.5)'; g.lineWidth = 0.8; g.strokeRect(SX(x - 0.58 + i * 0.24), SY(z + hh), 0.2 * k, hh * k); } }
    this.box(g, x - 0.65, 1.95, 1.3, 0.2, p.kind === 'soda' ? '#2f6fb0' : '#c8202f');
    if (p.kind === 'soda') {                                  // the bottle on the end of the shelf — the one Brian opened
      const bx = x + 0.82; g.fillStyle = this.I_open ? '#7a3a1a' : '#5a2a14'; g.fillRect(SX(bx) - 4, SY(0.55), 8, 0.35 * k); g.fillStyle = '#c42b2b'; g.fillRect(SX(bx) - 2.5, SY(0.6), 5, 5);
      if (I.sodaOpen) { g.fillStyle = 'rgba(90,40,16,0.65)'; g.beginPath(); g.ellipse(SX(x + 1.0), SY(0.02), 0.75 * k, 0.05 * k, 0, 0, TAU); g.fill(); }   // fizz on the floor
    }
  }
  front(g, p, I, time) {                                       // counter fronts drawn OVER the person standing behind them
    const { SX, SY, k } = this, x = p.x;
    if (p.kind === 'pizza') { this.box(g, x - 1.1, 0, 1.9, 0.95, '#a8321e'); g.fillStyle = '#fff'; g.font = '800 9px system-ui'; g.textAlign = 'center'; g.fillText('PIZZA', SX(x - 0.15), SY(0.45)); this.box(g, x - 1.15, 0.95, 2.0, 0.07, '#d8d0c0'); }
  }
  fizz(g, f) { const { SX, SY, k } = this; g.fillStyle = 'rgba(120,60,20,0.8)'; for (let i = 0; i < 16; i++) { const a = -0.5 - i * 0.14, v = 2.2 + (i % 4) * 0.5, t = f.t, x = f.x + 0.8 + Math.cos(a) * -v * t * 0.5 * (i % 2 ? 1 : -1), z = 0.7 + Math.sin(-a) * v * t - 4.2 * t * t; if (z < 0) continue; g.beginPath(); g.arc(SX(x), SY(z), 0.04 * k, 0, TAU); g.fill(); } }
  // ---------------------------------------------------------------------------------------------------- the people
  person(g, a, time, look, role, isHero) {
    const { SX, SY, k } = this, M = SH.M; this.shadow(g, a.x, a.z, 0.55, 0.3);
    const im = sheetFor(isHero ? 'hero' : look);
    if (M && im) {
      const L = LOOKS[look] || LOOKS.hero, sh = M.peds[L.sheet], e = sh.color, cols = sh.cols, rows = Math.ceil(sh.poses.length / cols), cw = im.width / cols, ch = im.height / rows, sc = k / M.su * 0.78;
      const Wk = ['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5'], name = a.eatT > 0 ? 'idle' : a.moving ? Wk[Math.floor(a.walk / 0.13) % 6] : 'idle', i = sh.poses.indexOf(name);
      g.save(); g.translate(SX(a.x), SY(a.z)); if (a.face < 0) g.scale(-1, 1);
      g.drawImage(im, (i % cols) * cw, ((i / cols) | 0) * ch, cw, ch, e.ox * sc, e.oy * sc, e.w * sc, e.h * sc);
      if (L.acc === 'apron') { g.fillStyle = '#f4f2ea'; g.fillRect(-0.07 * k, -0.98 * k, 0.17 * k, 0.5 * k); g.fillStyle = '#f4f2ea'; g.fillRect(-0.09 * k, -1.64 * k, 0.2 * k, 0.07 * k); }          // apron + a paper hat
      if (L.acc === 'tie') { g.fillStyle = '#c8202f'; g.fillRect(0.03 * k, -1.3 * k, 0.04 * k, 0.32 * k); }
      if (L.acc === 'vest') { g.fillStyle = '#c8202f'; g.fillRect(-0.07 * k, -1.3 * k, 0.15 * k, 0.4 * k); g.fillStyle = '#fff'; g.fillRect(0.0, -1.2 * k, 0.05 * k, 0.05 * k); }
      if (L.tag) { g.fillStyle = L.tag; g.fillRect(0.04 * k, -1.25 * k, 0.07 * k, 0.05 * k); }
      g.restore();
    } else { g.fillStyle = '#d9583a'; g.fillRect(SX(a.x) - 6, SY(a.z + 1.8), 12, 1.8 * k); }
    // what's in hand: a slice / chips / a burrito (and the fast chew)
    const food = a.hold; if (food) {
      const eating = a.eatT > 0, fast = a.fast, bob = eating ? Math.sin(time * (fast ? 34 : 12)) * 0.03 : 0, up = eating ? 0.45 : 0;
      const cx = SX(a.x + a.face * 0.28), cy = SY(a.z + 1.0 + up + bob);
      if (!eating || (a.eatT > (fast ? 0.18 : 0.5))) { g.save(); g.translate(cx, cy); g.rotate(-a.face * 0.5);
        if (food === 'slice') { g.fillStyle = '#e8b23a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(a.face * 0.3 * k, -0.05 * k); g.lineTo(a.face * 0.04 * k, -0.2 * k); g.closePath(); g.fill(); g.fillStyle = '#c42b2b'; g.beginPath(); g.arc(a.face * 0.12 * k, -0.08 * k, 0.03 * k, 0, TAU); g.fill(); }
        else if (food === 'chips') { g.fillStyle = '#e8c23a'; g.beginPath(); g.moveTo(-0.08 * k, 0); g.lineTo(0.08 * k, 0); g.lineTo(0, -0.15 * k); g.fill(); g.fillStyle = '#c42b2b'; g.fillRect(-0.05 * k, 0, 0.1 * k, 0.06 * k); }
        else { g.fillStyle = '#e8c98a'; g.fillRect(-0.04 * k, -0.07 * k, 0.28 * k * a.face, 0.14 * k); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(-0.04 * k, -0.07 * k, 0.28 * k * a.face, 0.14 * k); }
        g.restore(); }
      if (fast && eating) { g.fillStyle = 'rgba(255,240,200,0.7)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(SX(a.x + a.face * (0.2 + i * 0.1)), SY(a.z + 1.45 + Math.sin(time * 40 + i) * 0.06), 0.03 * k, 0, TAU); g.fill(); } }
    }
    if (!isHero && (a.name)) { g.font = '700 10px system-ui'; const t = a.role ? `${a.name} · ${a.role}` : a.name, w = g.measureText(t).width + 12; g.fillStyle = 'rgba(27,20,48,0.62)'; g.beginPath(); g.roundRect(SX(a.x) - w / 2, SY(a.z + 1.85) - 11, w, 15, 7); g.fill(); g.fillStyle = '#fff3dc'; g.textAlign = 'center'; g.fillText(t, SX(a.x), SY(a.z + 1.85)); }
    else if (isHero) { g.font = '700 10px system-ui'; const t = a.who.name.split(' ')[0], w = g.measureText(t).width + 12; g.fillStyle = 'rgba(200,90,40,0.8)'; g.beginPath(); g.roundRect(SX(a.x) - w / 2, SY(a.z + 1.85) - 11, w, 15, 7); g.fill(); g.fillStyle = '#fff3dc'; g.textAlign = 'center'; g.fillText(t, SX(a.x), SY(a.z + 1.85)); }
  }
  lights(g, I, time) {
    const { SX, SY, k } = this, K = I.K; g.save(); g.globalCompositeOperation = 'lighter';
    for (let x = 2; x < K.width - 1; x += 3.2) { const gr = g.createRadialGradient(SX(x + 0.75), SY(K.ceiling - 0.1), 2, SX(x + 0.75), SY(K.ceiling - 0.1), 2.0 * k); gr.addColorStop(0, K.memory ? 'rgba(255,210,150,0.16)' : 'rgba(235,245,255,0.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(SX(x + 0.75) - 2 * k, SY(K.ceiling - 0.1) - 2 * k, 4 * k, 4 * k); }
    g.restore();
  }
  memoryPass(g, I, vw, vh, time) {                          // THE MEMORY TREATMENT (Gringada, 1998): sepia wash, film grain, soft vignette, dust
    g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(255,226,176,0.55)'; g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(200,120,50,0.35)'; g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'source-over';
    const v = g.createRadialGradient(vw / 2, vh * 0.55, vh * 0.25, vw / 2, vh * 0.55, vh * 0.75); v.addColorStop(0, 'rgba(60,30,10,0)'); v.addColorStop(1, 'rgba(60,30,10,0.55)'); g.fillStyle = v; g.fillRect(0, 0, vw, vh);
    g.fillStyle = 'rgba(255,240,210,0.07)'; for (let i = 0; i < 70; i++) { const x = (i * 131 + Math.floor(time * 24) * 53) % vw, y = (i * 71 + Math.floor(time * 24) * 29) % vh; g.fillRect(x, y, 1.5, 1.5); }
    g.restore();
  }
}

// ======================================================================================================================
// the EXTERIOR hero art (top-down). Called by lf_render's hero tier over the placeholder roof: heroStyle(g, h, gr, time, PLACE_S)
// ======================================================================================================================
const inPoly = (x, y, f) => { let c = false; const n = f.length / 2; for (let i = 0; i < n; i++) { const x1 = f[2 * i], y1 = f[2 * i + 1], x2 = f[2 * ((i + 1) % n)], y2 = f[2 * ((i + 1) % n) + 1]; if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) c = !c; } return c; };
const scaled = (f, S, cx, cy) => f.map((v, i) => i % 2 ? cy + (v - cy) * S : cx + (v - cx) * S);
function path(g, f) { g.beginPath(); for (let k = 0; k < f.length; k += 2) k ? g.lineTo(f[k], f[k + 1]) : g.moveTo(f[k], f[k + 1]); g.closePath(); }
function textAlong(g, txt, x, y, nx, ny, px, font, col) {   // text parallel to a wall, kept upright
  let a = Math.atan2(ny, nx) + Math.PI / 2; if (Math.cos(a) < 0) a += Math.PI; g.save(); g.translate(x, y); g.rotate(a); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(txt, 0, 0); g.restore(); g.textBaseline = 'alphabetic';
}
export function heroStyle(g, h, gr, time, S = 1.12) {
  const f = scaled(h.f, S, h.cx, h.cy), d = h.door; if (!d) return; const wx = h.cx + (d.wall[0] - h.cx) * S, wy = h.cy + (d.wall[1] - h.cy) * S, nx = d.nx, ny = d.ny, tx = -ny, ty = nx;
  g.save(); path(g, f); g.clip();
  if (h.style === 'store') {
    g.fillStyle = '#dcd9d1'; g.fillRect(h.cx - 700, h.cy - 700, 1400, 1400);
    g.strokeStyle = 'rgba(90,86,78,0.28)'; g.lineWidth = 1.2; for (let t = -700; t < 700; t += 46) { g.beginPath(); g.moveTo(h.cx + t, h.cy - 700); g.lineTo(h.cx + t, h.cy + 700); g.stroke(); }   // membrane seams
    g.fillStyle = 'rgba(70,64,58,0.18)'; for (let i = 0; i < 18; i++) { const px = h.cx + ((i * 97) % 340 - 170), py = h.cy + ((i * 61) % 240 - 120); if (inPoly(px, py, f)) { g.fillRect(px, py, 40, 18); } }
    for (let i = 0; i < 11; i++) { const px = h.cx + ((i * 151) % 360 - 180), py = h.cy + ((i * 83) % 260 - 130); if (!inPoly(px, py, f) || !inPoly(px + 30, py + 24, f)) continue; g.fillStyle = '#9a9ca2'; g.fillRect(px, py, 30, 24); g.strokeStyle = '#4a4850'; g.lineWidth = 1.5; g.strokeRect(px, py, 30, 24); g.beginPath(); g.arc(px + 15, py + 12, 8, 0, 7); g.stroke(); }   // rooftop HVAC
  } else {                                                   // MEMORY: the end-pad, as remembered — warm stucco roof, terracotta tile ridge
    g.fillStyle = '#d8b88a'; g.fillRect(h.cx - 400, h.cy - 400, 800, 800); g.fillStyle = 'rgba(184,50,30,0.55)'; for (let t = -300; t < 300; t += 16) { g.save(); g.translate(h.cx, h.cy); g.rotate(Math.atan2(ty, tx)); g.fillRect(-200, t, 400, 8); g.restore(); }
  }
  g.restore();
  // the parapet / outline
  path(g, f); g.lineWidth = 6; g.strokeStyle = h.style === 'store' ? '#8a857c' : '#8a5a3a'; g.stroke();
  if (h.style === 'memory') { path(g, f); g.setLineDash([14, 10]); g.lineWidth = 3; g.strokeStyle = 'rgba(255,240,200,0.9)'; g.stroke(); g.setLineDash([]); }
  // the front: sign band along the wall, glass vestibule + door glow at the entrance
  const bandL = Math.min(d.len * S * 0.62, 260), bw = 40, bx = wx - nx * bw / 2, by = wy - ny * bw / 2;
  g.save(); g.translate(bx, by); g.rotate(Math.atan2(ty, tx)); g.fillStyle = h.style === 'store' ? '#c8202f' : '#2f7a52'; g.fillRect(-bandL / 2, -bw / 2, bandL, bw); g.lineWidth = 3; g.strokeStyle = INK; g.strokeRect(-bandL / 2, -bw / 2, bandL, bw); g.restore();
  textAlong(g, h.style === 'store' ? 'WEIS' : 'GRINGADA', bx, by, nx, ny, 0, `900 ${h.style === 'store' ? 34 : 19}px system-ui`, '#fff');
  g.save(); g.translate(wx + nx * 12, wy + ny * 12); g.rotate(Math.atan2(ty, tx)); g.fillStyle = h.style === 'store' ? 'rgba(170,215,235,0.9)' : '#7a4a30'; g.fillRect(-34, -13, 68, 26); g.lineWidth = 2.5; g.strokeStyle = INK; g.strokeRect(-34, -13, 68, 26); g.restore();
  const pulse = 0.5 + 0.5 * Math.sin(time * 3); g.beginPath(); g.arc(wx + nx * 38, wy + ny * 38, 20 + 4 * pulse, 0, 7); g.fillStyle = `rgba(255,214,120,${0.25 + 0.2 * pulse})`; g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,230,160,0.9)'; g.stroke();
  if (h.style === 'store') {                                 // the cart corral beside the door
    for (let i = 0; i < 3; i++) { g.fillStyle = '#b9bdc4'; g.fillRect(wx + nx * 56 + tx * (62 + i * 9) - 6, wy + ny * 56 + ty * (62 + i * 9) - 4, 14, 8); g.strokeStyle = '#5a5e66'; g.lineWidth = 1; g.strokeRect(wx + nx * 56 + tx * (62 + i * 9) - 6, wy + ny * 56 + ty * (62 + i * 9) - 4, 14, 8); }
  } else {                                                   // MEMORY wash: sepia veil + film dust + the 1998 tag
    path(g, f); g.fillStyle = 'rgba(190,130,60,0.28)'; g.fill();
    g.fillStyle = 'rgba(255,245,220,0.55)'; for (let i = 0; i < 26; i++) { const a = i * 2.4 + time * 0.4; g.beginPath(); g.arc(h.cx + Math.cos(a) * (40 + (i * 13) % 140), h.cy + Math.sin(a * 1.3) * (30 + (i * 7) % 90), 1.8, 0, 7); g.fill(); }
    g.font = '800 17px system-ui'; const t = 'MEMORY · 1998', w = g.measureText(t).width + 22; g.fillStyle = 'rgba(120,70,30,0.9)'; g.beginPath(); g.roundRect(h.cx - w / 2, h.cy - 12, w, 26, 10); g.fill(); g.fillStyle = '#ffe7c0'; g.textAlign = 'center'; g.fillText(t, h.cx, h.cy + 6);
  }
}

// ======================================================================================================================
// world-space extras (drawn over the cars): the 108 Astro's parking lights, Scott's house tag, the on-foot bark
// ======================================================================================================================
export function worldFx(g, S, PL, gr, time, vis) {
  if (!PL) return;
  const A = PL.astro(S); if (A && vis(A.x, A.y, 80)) {
    const fx = Math.cos(A.h), fy = Math.sin(A.h), px = -fy, py = fx, L = A.len || 48, Wd = A.wid || 20;
    for (const end of [1, -1]) for (const sd of [-1, 1]) {
      const x = A.x + fx * end * (L / 2 - 1.5) + px * sd * (Wd / 2 - 2.5), y = A.y + fy * end * (L / 2 - 1.5) + py * sd * (Wd / 2 - 2.5);
      if (A.lightsGone) { g.fillStyle = '#15111a'; g.fillRect(x - 2.2, y - 2.2, 4.4, 4.4); g.strokeStyle = 'rgba(200,160,80,0.8)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x - fx * end * 3 + px * sd * 2, y - fy * end * 3 + py * sd * 2); g.stroke(); continue; }
      const col = end > 0 ? '255,184,60' : '255,60,40', amp = 0.7 + 0.3 * (gr ? gr.heads : 0);
      g.save(); g.globalCompositeOperation = 'lighter'; const r = 10, gg = g.createRadialGradient(x, y, 0.5, x, y, r); gg.addColorStop(0, `rgba(${col},${amp})`); gg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore();
      g.fillStyle = `rgb(${col})`; g.fillRect(x - 1.8, y - 1.8, 3.6, 3.6);
    }
  }
  for (const n of PL.PJ.npcs) if (vis(n.house[0], n.house[1], 80)) {                         // Scott's house: a little tag (no number — owner rule)
    const [x, y] = n.house; g.font = '800 15px system-ui'; const w = g.measureText(n.name).width + 16; g.fillStyle = 'rgba(255,241,216,0.92)'; g.beginPath(); g.roundRect(x - w / 2, y - 62, w, 22, 8); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke(); g.fillStyle = INK; g.textAlign = 'center'; g.fillText(n.name, x, y - 46);
  }
  if (PL.bark) { const b = PL.bark; g.font = '800 15px system-ui'; const w = g.measureText(b.text).width + 22; g.globalAlpha = Math.min(1, b.t); g.fillStyle = 'rgba(255,248,232,0.97)'; g.beginPath(); g.roundRect(b.x - w / 2, b.y - 26, w, 28, 10); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke(); g.fillStyle = INK; g.textAlign = 'center'; g.fillText(b.text, b.x, b.y - 6); g.globalAlpha = 1; }
}
