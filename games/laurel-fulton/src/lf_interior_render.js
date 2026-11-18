// lf_interior_render.js — task L7, draws an Interior (lf_interior.js) as a SIDE CUTAWAY: the dollhouse cross-section of
// Palm City's motel siege (siege_render.js: the same golden-hour sky, cut walls in plum ink, the street-side grade line,
// and THE SAME side-view person sheet — Palm City's player, baked by its tools/bake_side.py). The house shell, rooms and
// furniture are painted from the kit's data (a fixed furniture library below), so any crew house the factory states gets
// drawn with no new code. Brad's house: split foyer, half-sunk lower level shown against the earth.
// Fire in the fireplace follows the standing rule: an EMBER GLOW + a little dark smoke up the flue, no flame tongues.
// POLISH PASS (Moth, Nov 17): the cutaway standard now lives in tools/INTERIOR-SPEC.md — fit-height camera (the whole
// house in frame, people ~1/5 of the screen), room floors in their floorc, labels on pills clear of the slabs, contact
// shadows, a real light pass (fire / lamps / TV), curtains, decor props (rug / picture / lamp / plant) and a rocking
// Teter. Houses built by tools/interior_build.py get all of it in one step; change the SPEC first, then this file.
const TAU = Math.PI * 2, INK = '#2a1430';
const SIDE = { img: null, M: null };
if (typeof Image !== 'undefined') {
  fetch(new URL('../../palm-city/assets/siege.json', import.meta.url)).then(r => r.json()).then(M => {
    SIDE.M = M; const im = new Image(); im.src = new URL('../../palm-city/assets/' + M.peds.player.color.file, import.meta.url).href; SIDE.img = im;
  }).catch(() => {});
}

export class InteriorRenderer {
  constructor(ctx) { this.ctx = ctx; this.camX = null; }
  draw(I, vw, vh, dpr, time) {
    const g = this.ctx, K = I.K;
    // CAMERA (INTERIOR-SPEC.md §1): fit the WHOLE house height — lowest floor to roof peak — into ~82% of the
    // phone's height, then pan x to follow the hero. No vertical follow: both floors stay in frame (the dollhouse
    // rule), and people land ~1/5 of the screen tall instead of the speck the fixed k=50 gave on a tall house.
    // (First cut filled 74% from a 7% margin and left ~40% of the frame as empty earth under a split-foyer.)
    const topZ = Math.max(...K.floors.map(f => f.z)) + K.ceiling + 1.6, botZ = Math.min(...K.floors.map(f => f.z)) - 0.3;
    const k = Math.max(54, Math.min(96, vh * 0.82 / (topZ - botZ))), gy = vh * 0.05 + topZ * k;
    const half = vw / 2 / k, want = Math.max(-0.6 + half, Math.min(K.width + 0.6 - half, I.hero.x));
    this.camX = this.camX == null ? want : this.camX + (want - this.camX) * 0.12;
    const SX = (x) => vw / 2 + (x - this.camX) * k, SY = (z) => gy - z * k;
    this.SX = SX; this.SY = SY; this.k = k; this.vw = vw;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sky (Palm City golden hour) + the yard + the earth the lower level sits in
    const sky = g.createLinearGradient(0, 0, 0, gy); sky.addColorStop(0, '#e9a46e'); sky.addColorStop(1, '#ffd79a'); g.fillStyle = sky; g.fillRect(0, 0, vw, gy);
    g.fillStyle = '#6f9a48'; g.fillRect(0, gy - 6, vw, 8);
    const earth = g.createLinearGradient(0, gy, 0, vh); earth.addColorStop(0, '#6a4a32'); earth.addColorStop(1, '#3c2a22'); g.fillStyle = earth; g.fillRect(0, gy + 2, vw, vh - gy);
    g.fillStyle = 'rgba(30,18,14,0.25)'; for (let i = 0; i < 40; i++) { const x = (i * 97) % vw, y = gy + 30 + ((i * 53) % (vh - gy - 40)); g.beginPath(); g.ellipse(x, y, 6 + (i % 4) * 3, 3, 0, 0, TAU); g.fill(); }
    const F = I.F, top = F.main.z + K.ceiling, W = K.width;
    // the roof: a low gable, cut
    g.fillStyle = '#5a3a40'; g.beginPath(); g.moveTo(SX(-0.4), SY(top)); g.lineTo(SX(W / 2), SY(top + 1.6)); g.lineTo(SX(W + 0.4), SY(top)); g.closePath(); g.fill();
    g.fillStyle = '#e8d6b4'; g.beginPath(); g.moveTo(SX(0.2), SY(top + 0.05)); g.lineTo(SX(W / 2), SY(top + 1.35)); g.lineTo(SX(W - 0.2), SY(top + 0.05)); g.closePath(); g.fill();   // the attic, cut
    // rooms: wall fill from each floor to its ceiling; the foyer stair hall in the middle
    g.fillStyle = '#efe2c2'; g.fillRect(SX(0), SY(top), SX(F.main.x0) - SX(0), SY(F.lower.z) - SY(top));
    for (const r of K.rooms) {
      const z0 = F[r.floor].z, z1 = z0 + K.ceiling;
      g.fillStyle = r.wall; g.fillRect(SX(r.x0), SY(z1), SX(r.x1) - SX(r.x0), SY(z0) - SY(z1));
      if (r.floor === 'lower') { g.strokeStyle = 'rgba(40,24,16,0.35)'; g.lineWidth = 1; for (let x = r.x0 + 0.3; x < r.x1; x += 0.3) { g.beginPath(); g.moveTo(SX(x), SY(z1)); g.lineTo(SX(x), SY(z0)); g.stroke(); } }   // wood panelling
      else { g.fillStyle = 'rgba(255,255,255,0.18)'; for (let x = r.x0 + 0.2; x < r.x1; x += 0.5) g.fillRect(SX(x), SY(z1), 2, SY(z0) - SY(z1)); }     // wallpaper stripe
      // the floor surface (SPEC §2): the room's floorc as a band on the slab, with grain
      g.fillStyle = r.floorc; g.fillRect(SX(r.x0), SY(z0) - 0.07 * k, SX(r.x1) - SX(r.x0), 0.07 * k);
      g.fillStyle = 'rgba(60,32,16,0.28)';
      if (r.name.includes('kitchen')) { for (let x = r.x0 + 0.45; x < r.x1; x += 0.45) g.fillRect(SX(x), SY(z0) - 0.07 * k, 1, 0.07 * k); }        // tile seams
      else if (r.floor === 'lower') { for (let x = r.x0 + 0.5; x < r.x1; x += 0.5) g.fillRect(SX(x), SY(z0) - 0.07 * k, 1, 0.07 * k); }        // plank seams
      else for (let i = 0; i < 16; i++) { const gx2 = r.x0 + ((i * 37) % 89) / 89 * (r.x1 - r.x0); g.fillRect(SX(gx2), SY(z0) - (0.02 + (i % 3) * 0.018) * k, 0.3 * k, 1); }   // wood grain
    }
    // windows: the upstairs picture window, the lower level's half window at the grade
    this.win(g, 6.0, F.main.z + 0.9, 2.0, 1.1); this.curtains(g, 6.0, F.main.z + 0.9, 2.0, 1.1); this.win(g, 10.6, -0.1, 1.2, 0.5);
    // slabs: floors + the landing; walls cut in ink
    g.fillStyle = '#4a3036';
    for (const f of K.floors) g.fillRect(SX(f.x0), SY(f.z), SX(f.x1) - SX(f.x0), 0.22 * k);
    g.fillRect(SX(F.main.x0), SY(top), SX(W) - SX(F.main.x0), 0.2 * k); g.fillRect(SX(0), SY(top), SX(F.main.x0) - SX(0), 0.2 * k);
    g.fillStyle = '#c86a4a'; g.fillRect(SX(-0.3), SY(top), 0.3 * k, SY(F.landing.z) - SY(top)); g.fillRect(SX(W), SY(top), 0.3 * k, SY(F.lower.z - 0.2) - SY(top));   // brick, cut
    g.fillStyle = '#8f8a84'; g.fillRect(SX(-0.3), SY(F.landing.z), 0.3 * k, SY(F.lower.z - 0.2) - SY(F.landing.z));   // the block foundation
    // the front door (left) onto the landing
    g.fillStyle = '#7a2e2a'; g.fillRect(SX(-0.28), SY(F.landing.z + 2.05), 0.26 * k, 2.05 * k); g.fillStyle = '#e8c23a'; g.beginPath(); g.arc(SX(-0.08), SY(F.landing.z + 1.0), 2.2, 0, TAU); g.fill();
    // the two half-flights
    for (const l of K.links) {
      const A = F[l.a], B = F[l.b], n = 7; g.fillStyle = '#7c5a46'; g.strokeStyle = INK; g.lineWidth = 1.2;
      for (let i = 0; i < n; i++) { const x = l.ax + (l.bx - l.ax) * i / n, z = A.z + (B.z - A.z) * (i + (B.z > A.z ? 1 : 0)) / n; g.fillRect(SX(x), SY(z), (l.bx - l.ax) / n * k + 1, 0.12 * k); }
      g.beginPath(); g.moveTo(SX(l.ax), SY(A.z + 0.9)); g.lineTo(SX(l.bx), SY(B.z + 0.9)); g.strokeStyle = '#4a3036'; g.lineWidth = 2.5; g.stroke();   // handrail
    }
    // furniture
    for (const p of K.props) this.prop(g, p, F[p.floor].z, I, time);
    // the residents: Teter in her recliner, the dogs, you
    if (I.teter) this.teter(g, I.teter, time);
    for (const d of I.dogs) this.dog(g, d, time);
    this.hero(g, I.hero, time);
    this.lights(g, I, time);                             // the light pass (SPEC §4): fire wash, lamp pools, TV spill
    // room labels LAST and on pills (SPEC §3): drawn over everything, so nothing clips them
    for (const r of K.rooms) { const z1 = F[r.floor].z + K.ceiling, cx = (SX(r.x0) + SX(r.x1)) / 2; g.font = '800 10px system-ui'; const tw = g.measureText(r.name.toUpperCase()).width + 14; g.fillStyle = 'rgba(27,20,48,0.66)'; g.beginPath(); g.roundRect(cx - tw / 2, SY(z1) + 4, tw, 16, 8); g.fill(); g.fillStyle = '#ffe4b0'; g.textAlign = 'center'; g.fillText(r.name.toUpperCase(), cx, SY(z1) + 16); }
    // Teter's line
    if (I.teter && I.teter.sayT > 0) this.bubble(g, SX(I.teter.x), SY(I.teter.z + 1.75), I.teter.said, Math.min(1, I.teter.sayT));
    // HUD: room + beers
    g.textAlign = 'left'; g.font = '900 13px system-ui'; g.fillStyle = 'rgba(27,20,48,0.72)'; g.beginPath(); g.roundRect(12, 74, 168, 26, 12); g.fill();
    g.fillStyle = '#ffd25c'; g.fillText(`${I.hero.who.name.toUpperCase()}'S HOUSE · 🍺 ${I.hero.drank}`, 24, 92);
    g.textAlign = 'center'; g.font = '800 13px system-ui'; g.fillStyle = '#fff1d8'; g.fillText(I.roomOf(I.hero) === 'stairs' ? 'the foyer' : I.roomOf(I.hero), vw / 2, 40);
  }
  shadow(g, x, z, w, a = 0.26) { const { SX, SY, k } = this; g.fillStyle = `rgba(26,14,8,${a})`; g.beginPath(); g.ellipse(SX(x), SY(z) + 2, w / 2 * k, 0.055 * k, 0, 0, TAU); g.fill(); }
  curtains(g, x, z, w, h) { const { SX, SY, k } = this; g.fillStyle = '#7a3040'; for (const sd of [-1, 1]) { g.beginPath(); const x0 = SX(x + sd * w / 2), x1 = SX(x + sd * (w / 2 - 0.3)); g.moveTo(x0, SY(z + h)); g.quadraticCurveTo((x0 + x1) / 2 + sd * 3, SY(z + h / 2), x1, SY(z + 0.05)); g.lineTo(x0, SY(z + 0.05)); g.closePath(); g.fill(); } g.fillRect(SX(x - w / 2), SY(z + h + 0.13), w * k, 0.13 * k); g.fillStyle = '#e8c23a'; g.fillRect(SX(x - w / 2), SY(z + h + 0.02), w * k, 2); }
  lights(g, I, time) {
    const { SX, SY, k } = this, F = I.F;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const p of I.K.props) {
      const z = F[p.floor].z; let cx, cy, r, col;
      if (p.kind === 'fireplace') { const fl = 0.20 + 0.04 * Math.sin(time * 9.3) + 0.025 * Math.sin(time * 23.7); cx = SX(p.x); cy = SY(z + 0.3); r = 2.4 * k; col = `rgba(255,150,50,${fl})`; }
      else if (p.kind === 'lamp') { cx = SX(p.x); cy = SY(z + 1.45); r = 1.15 * k; col = 'rgba(255,214,140,0.20)'; }
      else if (p.kind === 'tv') { cx = SX(p.x); cy = SY(z + 0.85); r = 1.5 * k; col = `rgba(140,190,255,${0.09 + 0.03 * Math.sin(time * 7)})`; }
      else continue;
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    g.restore();
  }
  win(g, x, z, w, h) { const { SX, SY, k } = this; g.fillStyle = '#9fc6e0'; g.fillRect(SX(x - w / 2), SY(z + h), w * k, h * k); g.strokeStyle = '#f4ead8'; g.lineWidth = 3; g.strokeRect(SX(x - w / 2), SY(z + h), w * k, h * k); g.beginPath(); g.moveTo(SX(x), SY(z + h)); g.lineTo(SX(x), SY(z)); g.stroke(); }
  box(g, x0, z0, w, h, col) { const { SX, SY, k } = this; g.fillStyle = col; g.fillRect(SX(x0), SY(z0 + h), w * k, h * k); g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(SX(x0), SY(z0 + h), w * k, h * k); }
  can(g, x, z, s = 1) { const { SX, SY, k } = this; g.fillStyle = '#c9ccd2'; g.fillRect(SX(x) - 0.035 * k * s, SY(z + 0.13 * s), 0.07 * k * s, 0.13 * k * s); g.fillStyle = '#c42b2b'; g.fillRect(SX(x) - 0.035 * k * s, SY(z + 0.09 * s), 0.07 * k * s, 0.04 * k * s); }
  prop(g, p, z, I, time) {
    const { SX, SY, k } = this, x = p.x;
    const SHW = { couch: 2.1, tv: 1.1, cooler: 0.85, fridge: 0.95, recliner: 1.15, weights: 2.3, fireplace: 1.9, table: 1.5, plant: 0.55, lamp: 0.35 };
    if (SHW[p.kind]) this.shadow(g, x, z, SHW[p.kind]);
    if (p.kind === 'couch') { this.box(g, x - 1.0, z, 2.0, 0.42, '#5c6f8c'); this.box(g, x - 1.0, z + 0.42, 0.25, 0.4, '#4e607c'); this.box(g, x + 0.75, z + 0.42, 0.25, 0.4, '#4e607c'); this.box(g, x - 0.75, z + 0.42, 1.5, 0.45, '#647a98'); }
    else if (p.kind === 'tv') { this.box(g, x - 0.45, z, 0.9, 0.55, '#6a4a34'); this.box(g, x - 0.4, z + 0.55, 0.8, 0.6, '#2a2a30'); g.fillStyle = `rgba(140,190,255,${0.5 + 0.2 * Math.sin(time * 7)})`; g.fillRect(SX(x - 0.33), SY(z + 1.08), 0.66 * k, 0.46 * k); }
    else if (p.kind === 'cooler') { this.box(g, x - 0.35, z, 0.7, 0.42, '#2f6fb0'); this.box(g, x - 0.37, z + 0.42, 0.74, 0.08, '#f2f1ec'); }
    else if (p.kind === 'fridge') { this.box(g, x - 0.4, z, 0.8, 1.75, '#ece8dc'); g.strokeStyle = INK; g.beginPath(); g.moveTo(SX(x - 0.4), SY(z + 1.15)); g.lineTo(SX(x + 0.4), SY(z + 1.15)); g.stroke(); }
    else if (p.kind === 'recliner') { this.box(g, x - 0.5, z, 1.0, 0.45, '#8c5a3a'); this.box(g, x + 0.25, z + 0.45, 0.28, 0.75, '#7c4a2e'); this.box(g, x - 0.5, z + 0.45, 0.18, 0.25, '#7c4a2e'); }
    else if (p.kind === 'weights') {                       // a flat bench, an upright rack, the bar loaded with plates
      this.box(g, x - 0.8, z + 0.38, 1.3, 0.12, '#2a2a30'); this.box(g, x - 0.6, z, 0.08, 0.38, '#55555c'); this.box(g, x + 0.3, z, 0.08, 0.38, '#55555c');
      this.box(g, x + 0.55, z, 0.08, 1.25, '#55555c'); this.box(g, x + 0.95, z, 0.08, 1.25, '#55555c');
      g.fillStyle = '#9a9aa2'; g.fillRect(SX(x + 0.3), SY(z + 1.08), 0.95 * k, 0.04 * k);
      for (const dx of [0.42, 1.12]) this.box(g, x + dx - 0.05, z + 0.82, 0.1, 0.55, '#1c1c22');
      for (let i = 0; i < 3; i++) this.box(g, x - 1.3 + i * 0.12, z, 0.09, 0.45 - i * 0.08, '#1c1c22');   // plates stacked against the wall
    } else if (p.kind === 'fireplace') {                   // brick surround, the firebox with an ember glow, the mantle WITH ITS BEERS
      this.box(g, x - 0.8, z, 1.6, 1.15, '#a8573e');
      g.fillStyle = 'rgba(70,30,26,0.35)'; for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) g.fillRect(SX(x - 0.8 + c * 0.27 + (r % 2) * 0.13), SY(z + 0.18 + r * 0.17), 1, 1.5);
      this.box(g, x - 0.42, z, 0.84, 0.62, '#1a1210');
      const em = g.createRadialGradient(SX(x), SY(z + 0.12), 1, SX(x), SY(z + 0.12), 0.5 * k); em.addColorStop(0, 'rgba(255,207,92,1)'); em.addColorStop(0.4, 'rgba(255,118,28,0.65)'); em.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.75 + 0.25 * Math.sin(time * 9); g.fillStyle = em; g.fillRect(SX(x - 0.42), SY(z + 0.62), 0.84 * k, 0.62 * k); g.restore();
      g.fillStyle = '#3a2422'; for (let i = 0; i < 3; i++) g.fillRect(SX(x - 0.3 + i * 0.2), SY(z + 0.1), 0.18 * k, 0.06 * k);   // the logs
      this.box(g, x - 1.0, z + 1.15, 2.0, 0.1, '#5a3a28');                              // the mantle
      this.box(g, x - 0.25, z + 1.25 + 0.35, 0.5, K_CH(I) - 1.6, '#a8573e');           // the chimney breast, above the cans
      for (let i = 0; i < I.mantle; i++) this.can(g, x - 0.85 + i * 0.34, z + 1.25, 1.7);    // the beers on the mantle (they really go when you take one)
    }
    else if (p.kind === 'rug') { g.fillStyle = '#a03c30'; g.fillRect(SX(x - 1.15), SY(z + 0.05), 2.3 * k, 0.05 * k); g.fillStyle = '#e0aa4e'; g.fillRect(SX(x - 0.95), SY(z + 0.035), 1.9 * k, 0.018 * k); }
    else if (p.kind === 'picture') { this.box(g, x - 0.42, z + 1.3, 0.84, 0.62, '#7c5a28'); g.fillStyle = '#b8c8a8'; g.fillRect(SX(x - 0.34), SY(z + 1.84), 0.68 * k, 0.46 * k); g.fillStyle = '#5c7a48'; g.beginPath(); g.moveTo(SX(x - 0.34), SY(z + 1.42)); g.lineTo(SX(x - 0.05), SY(z + 1.68)); g.lineTo(SX(x + 0.12), SY(z + 1.42)); g.closePath(); g.fill(); }
    else if (p.kind === 'lamp') { this.box(g, x - 0.16, z, 0.32, 0.05, '#4a3036'); g.fillStyle = '#4a3036'; g.fillRect(SX(x) - 1, SY(z + 1.42), 2, 1.42 * k); g.fillStyle = '#f4d98c'; g.beginPath(); g.moveTo(SX(x - 0.2), SY(z + 1.28)); g.lineTo(SX(x + 0.2), SY(z + 1.28)); g.lineTo(SX(x + 0.13), SY(z + 1.58)); g.lineTo(SX(x - 0.13), SY(z + 1.58)); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke(); }
    else if (p.kind === 'plant') { g.fillStyle = '#b85c38'; g.beginPath(); g.moveTo(SX(x - 0.17), SY(z + 0.34)); g.lineTo(SX(x + 0.17), SY(z + 0.34)); g.lineTo(SX(x + 0.12), SY(z)); g.lineTo(SX(x - 0.12), SY(z)); g.closePath(); g.fill(); g.fillStyle = '#4a7a34'; for (const [dx, dz, r] of [[-0.14, 0.62, 0.17], [0.13, 0.7, 0.15], [0, 0.85, 0.19], [-0.05, 0.5, 0.12]]) { g.beginPath(); g.ellipse(SX(x + dx), SY(z + dz), r * k, r * 0.8 * k, 0, 0, TAU); g.fill(); } }
    else if (p.kind === 'table') { this.box(g, x - 0.7, z + 0.72, 1.4, 0.07, '#7c5a34'); this.box(g, x - 0.62, z, 0.1, 0.72, '#6a4a2a'); this.box(g, x + 0.52, z, 0.1, 0.72, '#6a4a2a'); }
  }
  teter(g, T, time) {                                      // Brad's mom in her recliner: grey-blonde set hair, a lilac cardigan, slippers up
    const { SX, SY, k } = this, x = T.x, z = T.z, bob = Math.sin(time * 1.3) * 0.01;
    this.shadow(g, x, z, 1.2, 0.3);
    g.save(); g.translate(SX(x), SY(z + 0.4)); g.rotate(Math.sin(time * 0.9) * 0.035); g.translate(-SX(x), -SY(z + 0.4));   // the rock (SPEC §5)
    g.fillStyle = '#b48ab8'; g.beginPath(); g.ellipse(SX(x + 0.05), SY(z + 0.78 + bob), 0.2 * k, 0.3 * k, -0.15, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#6a5a7a'; g.fillRect(SX(x - 0.45), SY(z + 0.6), 0.5 * k, 0.12 * k);                // lap + legs on the footrest
    g.fillStyle = '#e8b8a0'; g.beginPath(); g.arc(SX(x + 0.02), SY(z + 1.18 + bob), 0.13 * k, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#d8c69a'; g.beginPath(); g.arc(SX(x + 0.06), SY(z + 1.25 + bob), 0.13 * k, Math.PI * 0.9, Math.PI * 2.15); g.fill();
    g.fillStyle = '#f0e0ff'; g.font = '800 9px system-ui'; g.textAlign = 'center'; g.fillText(T.name.toUpperCase(), SX(x), SY(z + 1.55));
    g.restore();
  }
  dog(g, d, time) {                                        // a golden retriever, side on: body, deep chest, feathered tail that wags
    const { SX, SY, k } = this, s = d.face || 1, x = SX(d.x), y = SY(d.z), moving = d.mode === 'go', ph = d.walk * 9;
    this.shadow(g, d.x, d.z, 0.95, 0.24);
    g.save(); g.translate(x, y); g.scale(s, 1);
    const gold = d.i ? '#d9a04e' : '#e6b766', dark = d.i ? '#b47e36' : '#c99a4c';
    g.strokeStyle = dark; g.lineWidth = 0.09 * k; g.lineCap = 'round';
    for (const [lx, o] of [[-0.25, 0], [-0.15, Math.PI], [0.2, Math.PI], [0.3, 0]]) { const sw = moving ? Math.sin(ph + o) * 0.08 : 0; g.beginPath(); g.moveTo(lx * k, -0.32 * k); g.lineTo((lx + sw) * k, -0.02 * k); g.stroke(); }
    const lie = !moving && d.patT <= 0 && d.wait > 1.5;
    g.fillStyle = gold; g.beginPath(); g.ellipse(0, (lie ? -0.18 : -0.4) * k, 0.42 * k, 0.16 * k, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0.42 * k, (lie ? -0.3 : -0.58) * k, 0.13 * k, 0.11 * k, 0, 0, TAU); g.fill();       // head
    g.beginPath(); g.ellipse(0.55 * k, (lie ? -0.27 : -0.55) * k, 0.08 * k, 0.05 * k, 0, 0, TAU); g.fill();      // muzzle
    g.fillStyle = dark; g.beginPath(); g.ellipse(0.38 * k, (lie ? -0.26 : -0.53) * k, 0.05 * k, 0.09 * k, 0.3, 0, TAU); g.fill();   // ear
    g.fillStyle = '#2a1a14'; g.beginPath(); g.arc(0.62 * k, (lie ? -0.28 : -0.56) * k, 0.022 * k, 0, TAU); g.fill();
    const wag = Math.sin(time * (d.patT > 0 ? 22 : 9)) * 0.35;
    g.strokeStyle = gold; g.lineWidth = 0.07 * k; g.beginPath(); g.moveTo(-0.4 * k, (lie ? -0.22 : -0.45) * k); g.quadraticCurveTo(-0.62 * k, (-0.6 + wag * 0.3) * k, (-0.7 + wag * 0.1) * k, (-0.5 + wag) * k); g.stroke();
    g.restore();
    if (d.patT > 0) { g.fillStyle = '#ff7a9a'; g.font = '900 14px system-ui'; g.textAlign = 'center'; g.fillText('♥', x, y - 0.95 * k - (1.2 - d.patT) * 14); }
  }
  hero(g, h, time) {
    const { SX, SY, k } = this, M = SIDE.M;
    this.shadow(g, h.x, h.z, 0.55, 0.3);
    if (M && SIDE.img && SIDE.img.complete && SIDE.img.naturalWidth) {
      const sh = M.peds.player, e = sh.color, W = ['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5'];
      const name = h.drinkT > 0 ? 'idle' : h.moving ? W[Math.floor(h.walk / 0.13) % 6] : 'idle';
      const i = sh.poses.indexOf(name), cols = sh.cols, rows = Math.ceil(sh.poses.length / cols), cw = SIDE.img.width / cols, ch = SIDE.img.height / rows, sc = k / M.su * 0.78;   // the siege draws people ~2.2 m; a house wants ~1.8 m
      g.save(); g.translate(SX(h.x), SY(h.z)); if (h.face < 0) g.scale(-1, 1);
      g.drawImage(SIDE.img, (i % cols) * cw, ((i / cols) | 0) * ch, cw, ch, e.ox * sc, e.oy * sc, e.w * sc, e.h * sc); g.restore();
    } else { g.fillStyle = '#d9583a'; g.fillRect(SX(h.x) - 6, SY(h.z + 1.8), 12, 1.8 * k); }
    if (h.beer || h.drinkT > 0) {                          // the can: in hand, then up and tilted for the drink
      const u = h.drinkT > 0 ? Math.min(1, (2.4 - h.drinkT) / 0.4) : 0, tilt = h.drinkT > 0 ? Math.min(1, (2.4 - h.drinkT) / 0.6) * 1.9 : 0;
      const cx = SX(h.x + h.face * 0.22), cy = SY(h.z + 0.95 + u * 0.62);
      g.save(); g.translate(cx, cy); g.rotate(-h.face * tilt * 0.6); g.fillStyle = '#c9ccd2'; g.fillRect(-0.035 * k, -0.13 * k, 0.07 * k, 0.13 * k); g.fillStyle = '#c42b2b'; g.fillRect(-0.035 * k, -0.09 * k, 0.07 * k, 0.04 * k); g.restore();
      if (h.drinkT > 0 && h.drinkT < 0.5) { g.fillStyle = '#fff1d8'; g.font = '800 12px system-ui'; g.textAlign = 'center'; g.fillText('ahh.', SX(h.x), SY(h.z + 2.15)); }
    }
    g.fillStyle = '#fff3dc'; g.font = '700 10px system-ui'; g.textAlign = 'center'; g.fillText(h.who.name.split(' ')[0], SX(h.x), SY(h.z + 2.0));
  }
  bubble(g, x, y, text, a) {
    g.globalAlpha = a; g.font = '700 12px system-ui'; const w = g.measureText(text).width + 18; x = Math.max(w / 2 + 8, Math.min(this.vw - w / 2 - 8, x)); g.fillStyle = 'rgba(255,248,232,0.97)';
    g.beginPath(); g.roundRect(x - w / 2, y - 26, w, 26, 10); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = INK; g.textAlign = 'center'; g.fillText(text, x, y - 9); g.globalAlpha = 1;
  }
}
const K_CH = (I) => I.K.ceiling;
