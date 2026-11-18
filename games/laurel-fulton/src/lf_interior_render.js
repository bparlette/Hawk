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
const MOVE_DRINK = 2.4;
const TAU = Math.PI * 2, INK = '#2a1430', BAKE_PAD = 0.8;
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
    // THE BAKED LAYER (Nov 18, "baked art pass"): bpy/Blender is NOT available in this environment, so this is a PAINTED pass, not a Blender
    // bake — the whole static shell (roof, walls with gradient + baseboard + crown, floors, windows, slabs, stairs, front door) is painted ONCE
    // into an offscreen texture (per kit / zoom / dpr) and blitted each frame; only furniture, residents and light stay live on top.
    const bk = this.bake(I, k, dpr, vh, gy);
    g.drawImage(bk.cv, SX(-BAKE_PAD), 0, bk.w, vh);
    const F = I.F, W = K.width;
    // furniture
    for (const p of K.props) this.prop(g, p, F[p.floor].z, I, time);
    // the residents: Teter in her recliner, the dogs, you
    if (I.teter) this.teter(g, I.teter, time);
    if (I.dad) this.dad(g, I.dad, time);                 // Rigg's house: the old guy in his recliner
    for (const d of I.dogs) this.dog(g, d, time);
    for (const gu of I.guests) this.guest(g, gu, time, I.partyImgs && I.partyImgs.cut);  // CPU crew idling at home (CrewWorld B.inside): a beer by the fire; party guests: the G18 cutaway sheet
    if (I.son) this.son(g, I.son, time);                 // Brian, coming down the stairs
    for (const c of I.callers || []) this.person(g, c, time, (c.id.length * 61) % 300 + 30);   // L14: the bark-beat speakers (Kosack up top, Rigg below)
    this.hero(g, I.hero, time);
    this.lights(g, I, time);                             // the light pass (SPEC §4): fire wash, lamp pools, TV spill
    // room labels LAST and on pills (SPEC §3): drawn over everything, so nothing clips them
    for (const r of K.rooms) { const z1 = F[r.floor].z + (r.h || K.ceiling), cx = (SX(r.x0) + SX(r.x1)) / 2; g.font = '800 10px system-ui'; const tw = g.measureText(r.name.toUpperCase()).width + 14; g.fillStyle = 'rgba(27,20,48,0.66)'; g.beginPath(); g.roundRect(cx - tw / 2, SY(z1) + 4, tw, 16, 8); g.fill(); g.fillStyle = '#ffe4b0'; g.textAlign = 'center'; g.fillText(r.name.toUpperCase(), cx, SY(z1) + 16); }
    // Teter's line
    if (I.teter && I.teter.sayT > 0) this.bubble(g, SX(I.teter.x), SY(I.teter.z + 1.75), I.teter.said, Math.min(1, I.teter.sayT));
    if (I.dad && I.dad.sayT > 0) this.bubble(g, SX(I.dad.x), SY(I.dad.z + 1.75), I.dad.said, Math.min(1, I.dad.sayT), true);   // the YELL: big
    if (I.son && I.son.sayT > 0 && !I.son.link) this.bubble(g, SX(I.son.x), SY(I.son.z + 2.05), I.son.said, Math.min(1, I.son.sayT));
    for (const c of I.callers || []) if (c.sayT > 0) this.bubble(g, SX(c.x), SY(c.z + 2.05), c.said, Math.min(1, c.sayT), true);   // L14 yells: big bubbles
    if (I.hero.said) this.bubble(g, SX(I.hero.x), SY(I.hero.z + 2.3), I.hero.said, Math.min(1, (I.hero.sayT || 0) + 0.3));   // Rigg-isms
    // HUD: room + beers
    g.textAlign = 'left'; g.font = '900 13px system-ui'; g.fillStyle = 'rgba(27,20,48,0.72)'; g.beginPath(); g.roundRect(12, 74, 168, 26, 12); g.fill();
    g.fillStyle = '#ffd25c'; g.fillText(`${String(I.houseName).toUpperCase()}'S HOUSE · 🍺 ${I.hero.drank}`, 24, 92);
    const hint = I.hint && I.hint(); if (hint) { g.textAlign = 'center'; g.font = '800 12px system-ui'; const hw2 = g.measureText(hint).width + 22; g.fillStyle = 'rgba(27,20,48,0.78)'; g.beginPath(); g.roundRect(vw / 2 - hw2 / 2, vh - 200, hw2, 24, 12); g.fill(); g.fillStyle = '#ffe4b0'; g.fillText(hint, vw / 2, vh - 184); }
    g.textAlign = 'center'; g.font = '800 13px system-ui'; g.fillStyle = '#fff1d8'; g.fillText(I.roomOf(I.hero) === 'stairs' ? (I.K.type === 'two-story-entry' ? 'the stairs' : 'the foyer') : I.roomOf(I.hero), vw / 2, 40);
  }
  // ---- the baked shell (see draw()) ---------------------------------------------------------------------------------------------------
  bake(I, k, dpr, vh, gy) {
    const key = I.K.id + '|' + k.toFixed(2) + '|' + dpr + '|' + vh;
    if (this._bk && this._bk.key === key) return this._bk;
    const W = I.K.width, w = (W + BAKE_PAD * 2) * k, cv = document.createElement('canvas'); cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(vh * dpr);
    const g2 = cv.getContext('2d'); g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    const keep = { SX: this.SX, SY: this.SY };
    this.SX = (x) => (x + BAKE_PAD) * k; this.SY = (z) => gy - z * k;
    if (I.K.type === 'two-story-entry' || I.K.type === 'three-level') this.shellEntry(g2, I); else this.shellSplit(g2, I);   // L14 Kosack's three levels share the main/upper/lower shell
    this.SX = keep.SX; this.SY = keep.SY;
    return (this._bk = { key, cv, w });
  }
  shellSplit(g, I) {
    const { SX, SY, k } = this, K = I.K, F = I.F, top = F.main.z + K.ceiling, W = K.width;
    // the roof: a low gable, cut
    g.fillStyle = '#5a3a40'; g.beginPath(); g.moveTo(SX(-0.4), SY(top)); g.lineTo(SX(W / 2), SY(top + 1.6)); g.lineTo(SX(W + 0.4), SY(top)); g.closePath(); g.fill();
    g.fillStyle = '#e8d6b4'; g.beginPath(); g.moveTo(SX(0.2), SY(top + 0.05)); g.lineTo(SX(W / 2), SY(top + 1.35)); g.lineTo(SX(W - 0.2), SY(top + 0.05)); g.closePath(); g.fill();   // the attic, cut
    // rooms: wall fill from each floor to its ceiling; the foyer stair hall in the middle
    g.fillStyle = '#efe2c2'; g.fillRect(SX(0), SY(top), SX(F.main.x0) - SX(0), SY(F.lower.z) - SY(top));
    for (const r of K.rooms) this.roomPaint(g, I, r);
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
    this.flights(g, I);
  }

  // Rigg's house: a big TWO-STORY ENTRYWAY on the left (open to the roof), the stair rising along it to the upstairs hall + Brian's door,
  // a living room + kitchen on the first floor, a half-sunk basement below (Brian's territory).
  shellEntry(g, I) {
    const { SX, SY, k } = this, K = I.K, F = I.F, W = K.width, top = F.upper.z + K.ceiling, X1 = F.upper.x0;
    g.fillStyle = '#4e3a44'; g.beginPath(); g.moveTo(SX(-0.4), SY(top)); g.lineTo(SX(W / 2), SY(top + 1.9)); g.lineTo(SX(W + 0.4), SY(top)); g.closePath(); g.fill();
    g.fillStyle = '#e8d6b4'; g.beginPath(); g.moveTo(SX(0.2), SY(top + 0.05)); g.lineTo(SX(W / 2), SY(top + 1.62)); g.lineTo(SX(W - 0.2), SY(top + 0.05)); g.closePath(); g.fill();
    g.fillStyle = 'rgba(70,46,52,0.25)'; for (let x = 0.1; x < W; x += 0.7) { g.beginPath(); g.moveTo(SX(x), SY(top + 0.05)); g.lineTo(SX(x + 0.35), SY(top + 0.05 + 1.5 * (1 - Math.abs(x + 0.17 - W / 2) / (W / 2)))); g.lineTo(SX(x + 0.45), SY(top + 0.05)); g.fill(); }   // rafters
    for (const r of K.rooms) this.roomPaint(g, I, r);
    // windows: the palladian over the stair (it floods the entry), the upstairs hall + bedroom, the living room, the basement's half window
    this.win(g, 3.3, F.main.z + 3.35, 1.7, 1.5, true); this.win(g, 7.2, F.main.z + 1.0, 1.7, 1.2); this.curtains(g, 7.2, F.main.z + 1.0, 1.7, 1.2);
    this.win(g, 11.7, F.upper.z + 0.9, 1.5, 1.2); this.win(g, 7.4, F.upper.z + 1.0, 1.0, 1.1); this.win(g, 5.0, F.lower.z + 1.95, 1.1, 0.4);
    g.fillStyle = '#4a3036';                                                          // slabs
    for (const f of K.floors) g.fillRect(SX(f.x0), SY(f.z), SX(f.x1) - SX(f.x0), 0.22 * k);
    g.fillRect(SX(X1), SY(top), SX(W) - SX(X1), 0.2 * k); g.fillRect(SX(0), SY(top), SX(X1) - SX(0), 0.2 * k);
    g.fillStyle = '#b4582f'; g.fillRect(SX(-0.3), SY(top), 0.3 * k, SY(F.main.z) - SY(top)); g.fillRect(SX(W), SY(top), 0.3 * k, SY(F.lower.z - 0.2) - SY(top));   // brick, cut
    g.fillStyle = 'rgba(60,24,16,0.35)'; for (let z = F.main.z + 0.1; z < top; z += 0.22) { g.fillRect(SX(-0.3), SY(z), 0.3 * k, 1); g.fillRect(SX(W), SY(z), 0.3 * k, 1); }
    g.fillStyle = '#8f8a84'; g.fillRect(SX(-0.3), SY(F.main.z), 0.3 * k, SY(F.lower.z - 0.2) - SY(F.main.z));   // the block foundation under the entry
    g.fillRect(SX(F.lower.x0 - 0.3), SY(F.main.z), 0.3 * k, SY(F.lower.z - 0.2) - SY(F.main.z));              // the basement's own wall
    g.fillStyle = '#4c3a30'; g.fillRect(SX(-0.3), SY(F.lower.z - 0.2), SX(F.lower.x0) - SX(-0.3), 0.2 * k);   // the earth under the entry (crawlspace)
    g.fillStyle = '#5a4636'; g.fillRect(SX(0), SY(F.main.z) + 0.22 * k, SX(F.lower.x0 - 0.3) - SX(0), SY(F.lower.z - 0.2) - SY(F.main.z) - 0.22 * k);
    g.fillStyle = 'rgba(20,12,8,0.3)'; for (let i = 0; i < 30; i++) { const x = (i * 37) % 100 / 100 * (F.lower.x0 - 0.5), z = F.lower.z + ((i * 53) % 100) / 100 * 2.2; g.beginPath(); g.ellipse(SX(0.2 + x), SY(z), 0.1 * k, 0.05 * k, 0, 0, TAU); g.fill(); }
    // the front door (big, with sidelight panes and a transom), onto the first floor
    const dz = F.main.z; g.fillStyle = '#4a2a2a'; g.fillRect(SX(-0.28), SY(dz + 2.15), 0.26 * k, 2.15 * k); g.fillStyle = '#6a3636'; g.fillRect(SX(-0.26), SY(dz + 2.05), 0.2 * k, 0.95 * k); g.fillRect(SX(-0.26), SY(dz + 0.95), 0.2 * k, 0.95 * k);
    g.fillStyle = '#e8c23a'; g.beginPath(); g.arc(SX(-0.08), SY(dz + 1.0), 2.2, 0, TAU); g.fill();
    g.fillStyle = '#bfe0ee'; g.fillRect(SX(-0.28), SY(dz + 3.0), 0.26 * k, 0.7 * k); g.strokeStyle = '#f4ead8'; g.lineWidth = 2; g.strokeRect(SX(-0.28), SY(dz + 3.0), 0.26 * k, 0.7 * k);   // the transom
    this.flights(g, I);
    // the balcony rail along the open edge of the upstairs hall, over the entry
    g.strokeStyle = '#4a3036'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(SX(X1 - 0.02), SY(F.upper.z + 0.95)); g.lineTo(SX(X1 + 0.7), SY(F.upper.z + 0.95)); g.stroke();
    g.lineWidth = 1.2; for (let i = 0; i <= 5; i++) { const x = X1 - 0.02 + i * 0.14; g.beginPath(); g.moveTo(SX(x), SY(F.upper.z + 0.95)); g.lineTo(SX(x), SY(F.upper.z + 0.1)); g.stroke(); }
  }
  // the flights: treads + risers + a handrail; the step count follows the rise so a storey of stairs is a storey of stairs
  flights(g, I) {
    const { SX, SY, k } = this, K = I.K, F = I.F;
    for (const l of K.links) {
      const A = F[l.a], B = F[l.b], n = Math.max(7, Math.round(Math.abs(B.z - A.z) / 0.18)); g.fillStyle = '#7c5a46'; g.strokeStyle = INK; g.lineWidth = 1.2;
      if (l.press) {                                      // an overlapping flight is a solid stringer with treads on it, and a darker underside
        const up = B.z > A.z, lo = up ? A : B, hi = up ? B : A, xl = up ? l.ax : l.bx, xh = up ? l.bx : l.ax;
        g.fillStyle = 'rgba(40,24,20,0.5)'; g.beginPath(); g.moveTo(SX(xl), SY(lo.z)); g.lineTo(SX(xh), SY(hi.z)); g.lineTo(SX(xh), SY(lo.z)); g.closePath(); if (K.type === 'two-story-entry' && !up) g.fillStyle = 'rgba(30,18,14,0.55)'; g.fill();
      }
      g.fillStyle = '#7c5a46';
      for (let i = 0; i < n; i++) { const x = l.ax + (l.bx - l.ax) * i / n, z = A.z + (B.z - A.z) * (i + (B.z > A.z ? 1 : 0)) / n; g.fillRect(SX(x), SY(z), (l.bx - l.ax) / n * k + 1, 0.12 * k); g.fillStyle = i % 2 ? '#7c5a46' : '#8a664e'; }
      g.beginPath(); g.moveTo(SX(l.ax), SY(A.z + 0.9)); g.lineTo(SX(l.bx), SY(B.z + 0.9)); g.strokeStyle = '#4a3036'; g.lineWidth = 2.5; g.stroke();   // handrail
    }
  }
  // one room, painted: a wall gradient (the ceiling lighter, the floor line in ambient shadow), its pattern, baseboard + crown moulding, the floor band
  roomPaint(g, I, r) {
    const { SX, SY, k } = this, K = I.K, F = I.F, z0 = F[r.floor].z, z1 = z0 + (r.h || K.ceiling), x0 = SX(r.x0), x1 = SX(r.x1), y1 = SY(z1), y0 = SY(z0), w = x1 - x0, entry = K.type === 'two-story-entry';
    g.fillStyle = r.wall; g.fillRect(x0, y1, w, y0 - y1);
    const gr = g.createLinearGradient(0, y1, 0, y0); gr.addColorStop(0, 'rgba(255,255,255,0.14)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(30,14,8,0.22)'); g.fillStyle = gr; g.fillRect(x0, y1, w, y0 - y1);
    if (r.floor === 'lower' && !entry) { g.strokeStyle = 'rgba(40,24,16,0.35)'; g.lineWidth = 1; for (let x = r.x0 + 0.3; x < r.x1; x += 0.3) { g.beginPath(); g.moveTo(SX(x), y1); g.lineTo(SX(x), y0); g.stroke(); } }   // wood panelling
    else if (r.floor === 'lower') {                                             // painted cinder block: courses + staggered joints, a damp stain
      g.strokeStyle = 'rgba(30,24,18,0.22)'; g.lineWidth = 1; let row = 0; for (let z = z0 + 0.2; z < z1; z += 0.2, row++) { g.beginPath(); g.moveTo(x0, SY(z)); g.lineTo(x1, SY(z)); g.stroke(); for (let x = r.x0 + (row % 2) * 0.2; x < r.x1; x += 0.4) { g.beginPath(); g.moveTo(SX(x), SY(z)); g.lineTo(SX(x), SY(z - 0.2)); g.stroke(); } }
    }
    else if (r.name.includes('bedroom')) { g.fillStyle = 'rgba(20,30,60,0.16)'; for (let x = r.x0 + 0.2; x < r.x1; x += 0.5) g.fillRect(SX(x), y1, 3, y0 - y1); }   // dark stripe
    else if (r.name.includes('entry')) {                                        // a chair rail with wainscot below it, wallpaper above
      g.fillStyle = 'rgba(255,255,255,0.16)'; for (let x = r.x0 + 0.2; x < r.x1; x += 0.5) g.fillRect(SX(x), y1, 2, SY(z0 + 1.05) - y1);
      g.fillStyle = 'rgba(120,90,60,0.35)'; g.fillRect(x0, SY(z0 + 1.0), w, 1.0 * k); g.fillStyle = '#f1e8d2'; g.fillRect(x0, SY(z0 + 1.05), w, 0.07 * k);
      g.strokeStyle = 'rgba(70,46,30,0.3)'; for (let x = r.x0 + 0.35; x < r.x1; x += 0.9) g.strokeRect(SX(x), SY(z0 + 0.92), 0.6 * k, 0.65 * k);
    }
    else { g.fillStyle = 'rgba(255,255,255,0.18)'; for (let x = r.x0 + 0.2; x < r.x1; x += 0.5) g.fillRect(SX(x), y1, 2, y0 - y1); }   // wallpaper stripe
    // baseboard + crown moulding + a little ambient occlusion where this room meets its neighbour
    g.fillStyle = 'rgba(40,24,16,0.45)'; g.fillRect(x0, y0 - 0.16 * k, w, 0.16 * k); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x0, y0 - 0.17 * k, w, 1.2);
    g.fillStyle = 'rgba(255,248,230,0.55)'; g.fillRect(x0, y1, w, 0.09 * k); g.fillStyle = 'rgba(30,14,8,0.25)'; g.fillRect(x0, y1 + 0.09 * k, w, 1.5);
    for (const [xe, sd] of [[x0, 1], [x1, -1]]) { const ao = g.createLinearGradient(xe, 0, xe + sd * 0.3 * k, 0); ao.addColorStop(0, 'rgba(30,14,8,0.2)'); ao.addColorStop(1, 'rgba(30,14,8,0)'); g.fillStyle = ao; g.fillRect(Math.min(xe, xe + sd * 0.3 * k), y1, 0.3 * k, y0 - y1); }
    // the floor surface (SPEC §2): the room's floorc as a band on the slab, with grain
    g.fillStyle = r.floorc; g.fillRect(x0, y0 - 0.07 * k, w, 0.07 * k);
    g.fillStyle = 'rgba(60,32,16,0.28)';
    if (r.name.includes('kitchen') || r.name.includes('entry')) { for (let x = r.x0 + 0.45; x < r.x1; x += 0.45) g.fillRect(SX(x), y0 - 0.07 * k, 1, 0.07 * k); }        // tile seams
    else if (r.floor === 'lower') { for (let x = r.x0 + 0.5; x < r.x1; x += 0.5) g.fillRect(SX(x), y0 - 0.07 * k, 1, 0.07 * k); }        // plank seams
    else for (let i = 0; i < 16; i++) { const gx2 = r.x0 + ((i * 37) % 89) / 89 * (r.x1 - r.x0); g.fillRect(SX(gx2), y0 - (0.02 + (i % 3) * 0.018) * k, 0.3 * k, 1); }   // wood grain
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
      else if (p.kind === 'computer') { cx = SX(p.x - 0.05); cy = SY(z + 1.0); r = 1.3 * k; col = `rgba(120,170,255,${0.13 + 0.03 * Math.sin(time * 5)})`; }
      else if (p.kind === 'chandelier') { cx = SX(p.x); cy = SY(F.upper.z + I.K.ceiling - 1.35); r = 2.6 * k; col = 'rgba(255,226,160,0.20)'; }
      else if (p.kind === 'tv') { cx = SX(p.x); cy = SY(z + 0.85); r = 1.5 * k; col = `rgba(140,190,255,${0.09 + 0.03 * Math.sin(time * 7)})`; }
      else continue;
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    g.restore();
  }
  win(g, x, z, w, h, arch) { const { SX, SY, k } = this; if (arch) { this.palladian(g, x, z, w, h); return; } const sky = g.createLinearGradient(0, SY(z + h), 0, SY(z)); sky.addColorStop(0, '#bcdcee'); sky.addColorStop(1, '#f6e4b8'); g.fillStyle = sky; g.fillRect(SX(x - w / 2), SY(z + h), w * k, h * k); g.strokeStyle = '#f4ead8'; g.lineWidth = 3; g.strokeRect(SX(x - w / 2), SY(z + h), w * k, h * k); g.beginPath(); g.moveTo(SX(x), SY(z + h)); g.lineTo(SX(x), SY(z)); g.stroke(); }
  palladian(g, x, z, w, h) {                               // the big arched window over the stair (a two-story entry's signature)
    const { SX, SY, k } = this, cx = SX(x), r = w / 2 * k, yb = SY(z), yt = SY(z + h - w / 2);
    const sky = g.createLinearGradient(0, SY(z + h), 0, yb); sky.addColorStop(0, '#bcdcee'); sky.addColorStop(1, '#f6e4b8'); g.fillStyle = sky;
    g.beginPath(); g.moveTo(cx - r, yb); g.lineTo(cx - r, yt); g.arc(cx, yt, r, Math.PI, 0); g.lineTo(cx + r, yb); g.closePath(); g.fill();
    g.strokeStyle = '#f4ead8'; g.lineWidth = 3; g.stroke(); g.lineWidth = 2; g.beginPath(); g.moveTo(cx, yt - r); g.lineTo(cx, yb); g.moveTo(cx - r, yt); g.lineTo(cx + r, yt); g.stroke();
    for (const a of [0.35, 0.65]) { g.beginPath(); g.moveTo(cx, yt); g.lineTo(cx + Math.cos(Math.PI * (1 + a)) * r, yt + Math.sin(Math.PI * (1 + a)) * r); g.stroke(); }
  }
  // a box with a painted look: a soft vertical gradient (light on top), a highlight edge, an inner shade on the shadow side, an ink outline
  box(g, x0, z0, w, h, col) {
    const { SX, SY, k } = this, X = SX(x0), Y = SY(z0 + h), Wp = w * k, Hp = h * k;
    g.fillStyle = col; g.fillRect(X, Y, Wp, Hp);
    if (Wp > 4 && Hp > 4) {
      const gr = g.createLinearGradient(0, Y, 0, Y + Hp); gr.addColorStop(0, 'rgba(255,255,255,0.24)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(20,8,4,0.22)'); g.fillStyle = gr; g.fillRect(X, Y, Wp, Hp);
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(X, Y, Wp, 1.2); g.fillStyle = 'rgba(20,8,4,0.18)'; g.fillRect(X + Wp - Math.min(3, Wp / 4), Y, Math.min(3, Wp / 4), Hp);
    }
    g.strokeStyle = INK; g.lineWidth = 1.4; g.strokeRect(X, Y, Wp, Hp);
  }
  can(g, x, z, s = 1) { const { SX, SY, k } = this; g.fillStyle = '#c9ccd2'; g.fillRect(SX(x) - 0.035 * k * s, SY(z + 0.13 * s), 0.07 * k * s, 0.13 * k * s); g.fillStyle = '#c42b2b'; g.fillRect(SX(x) - 0.035 * k * s, SY(z + 0.09 * s), 0.07 * k * s, 0.04 * k * s); }
  prop(g, p, z, I, time) {
    const { SX, SY, k } = this, x = p.x;
    const SHW = { couch: 2.1, tv: 1.1, cooler: 0.85, fridge: 0.95, recliner: 1.15, weights: 2.3, fireplace: 1.9, table: 1.5, plant: 0.55, lamp: 0.35, computer: 1.7, cdwriter: 1.1, bed: 2.3, speaker: 0.7 };
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
    else if (p.kind === 'computer') this.computer(g, p, z, time);
    else if (p.kind === 'cdwriter') this.cdwriter(g, p, z, time);
    else if (p.kind === 'bed') {                           // Brian's bed: a headboard at the wall end, a rumpled plaid blanket
      this.box(g, x - 1.0, z + 0.14, 2.0, 0.26, '#6c4a30'); this.box(g, x - 1.0, z, 0.09, 0.62, '#4c3220'); this.box(g, x + 0.9, z, 0.09, 0.4, '#4c3220');
      this.box(g, x - 0.9, z + 0.4, 1.8, 0.16, '#3f5f8f'); g.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 9; i++) g.fillRect(SX(x - 0.85 + i * 0.2), SY(z + 0.56), 2, 0.16 * k);
      this.box(g, x - 0.9, z + 0.55, 0.45, 0.14, '#efe8d6');
    }
    else if (p.kind === 'speaker') {                       // a big black speaker with a bass cone that pumps (the loud-system energy)
      this.box(g, x - 0.28, z, 0.56, 1.15, '#1d1d22'); const pump = 0.012 * Math.sin(time * 11) * k;
      for (const [cz, cr] of [[0.34, 0.2], [0.82, 0.12]]) { g.fillStyle = '#2d2d36'; g.beginPath(); g.arc(SX(x), SY(z + cz), cr * k, 0, TAU); g.fill(); g.fillStyle = '#0c0c10'; g.beginPath(); g.arc(SX(x), SY(z + cz), cr * k * 0.55 + pump, 0, TAU); g.fill(); g.strokeStyle = '#55555c'; g.lineWidth = 1; g.stroke(); }
    }
    else if (p.kind === 'chandelier') {                    // hangs in the open two-story entry
      const topz = I.F.upper ? I.F.upper.z + I.K.ceiling : z + 4.5, cz = topz - 1.35; g.strokeStyle = '#3a2a24'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(SX(x), SY(topz)); g.lineTo(SX(x), SY(cz + 0.2)); g.stroke();
      g.fillStyle = '#c89a3c'; g.beginPath(); g.ellipse(SX(x), SY(cz), 0.36 * k, 0.07 * k, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(255,246,200,0.9)'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(SX(x + i * 0.14), SY(cz)); g.lineTo(SX(x + i * 0.14 + 0.03), SY(cz - 0.22 - (2 - Math.abs(i)) * 0.05)); g.lineTo(SX(x + i * 0.14 - 0.03), SY(cz - 0.22 - (2 - Math.abs(i)) * 0.05)); g.closePath(); g.fill(); }
      for (let i = -2; i <= 2; i++) { g.fillStyle = 'rgba(255,255,230,1)'; g.beginPath(); g.arc(SX(x + i * 0.16), SY(cz + 0.1), 0.025 * k, 0, TAU); g.fill(); }
    }
    else if (p.kind === 'door') {                          // Brian's bedroom door at the end of the hall, standing open, with its sign
      g.fillStyle = 'rgba(30,18,14,0.85)'; g.fillRect(SX(x) - 3, SY(z + 2.1), 6, 2.1 * k);
      this.box(g, x - 0.42, z, 0.1, 2.05, '#7a5636'); this.box(g, x + 0.32, z, 0.1, 2.05, '#7a5636'); this.box(g, x - 0.42, z + 2.0, 0.84, 0.1, '#7a5636');
      g.fillStyle = '#e8ddc4'; g.fillRect(SX(x - 0.3), SY(z + 1.62), 0.6 * k, 0.2 * k); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(SX(x - 0.3), SY(z + 1.62), 0.6 * k, 0.2 * k);
      g.fillStyle = '#2a1430'; g.font = '900 8px system-ui'; g.textAlign = 'center'; g.fillText(p.label || 'DOOR', SX(x), SY(z + 1.62) + 0.145 * k);
    }
    else if (p.kind === 'cellardoor') {                    // the door at the back of the kitchen: dark steps going down
      this.box(g, x - 0.42, z, 0.84, 2.0, '#2a1a14'); g.fillStyle = '#0d0907'; g.fillRect(SX(x - 0.34), SY(z + 1.94), 0.68 * k, 1.94 * k);
      g.fillStyle = '#5a4030'; for (let i = 0; i < 5; i++) g.fillRect(SX(x - 0.34), SY(z + 0.05 + i * 0.2) - 0.0, 0.68 * k * (1 - i * 0.14), 0.07 * k);
      g.fillStyle = '#e8ddc4'; g.fillRect(SX(x - 0.22), SY(z + 2.25), 0.44 * k, 0.16 * k); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(SX(x - 0.22), SY(z + 2.25), 0.44 * k, 0.16 * k); g.fillStyle = '#2a1430'; g.font = '900 8px system-ui'; g.textAlign = 'center'; g.fillText('DOWN', SX(x), SY(z + 2.25) + 0.125 * k);
    }
    else if (p.kind === 'arcade') this.arcade(g, p, z, I, time);   // L14 Kosack's basement
    else if (p.kind === 'bar') this.bar(g, p, z, time);
    else if (p.kind === 'hole') this.hole(g, p, z);
    else if (p.kind === 'table') { this.box(g, x - 0.7, z + 0.72, 1.4, 0.07, '#7c5a34'); this.box(g, x - 0.62, z, 0.1, 0.72, '#6a4a2a'); this.box(g, x + 0.52, z, 0.1, 0.72, '#6a4a2a'); }
  }
  computer(g, p, z, time) {                                // BRAD'S (and Brian's) basement computer, late 90s: a desk, a beige tower, a CRT whose screen says eDonkey
    const { SX, SY, k } = this, x = p.x, scr = p.screen || 'eDonkey';
    this.box(g, x - 0.75, z + 0.72, 1.5, 0.06, '#8a6a44'); this.box(g, x - 0.7, z, 0.07, 0.72, '#6a4a2a'); this.box(g, x + 0.63, z, 0.07, 0.72, '#6a4a2a');   // the desk
    this.box(g, x + 0.28, z + 0.04, 0.3, 0.62, '#cfc7b0'); g.fillStyle = '#6a6458'; g.fillRect(SX(x + 0.32), SY(z + 0.55), 0.22 * k, 0.03 * k); g.fillRect(SX(x + 0.32), SY(z + 0.5), 0.22 * k, 0.03 * k);   // the tower under the desk
    g.fillStyle = Math.sin(time * 7) > 0.2 ? '#5aff6a' : '#2a6a30'; g.fillRect(SX(x + 0.5), SY(z + 0.2), 3, 3);                                              // the hard-drive LED
    this.box(g, x - 0.38, z + 0.78, 0.7, 0.56, '#d8d0b8'); this.box(g, x - 0.16, z + 0.78 + 0.56, 0.26, 0.1, '#cfc7b0'); this.box(g, x - 0.52, z + 0.78, 0.5, 0.05, '#c8c0a8');   // CRT + its hump, keyboard
    const sx = SX(x - 0.33), sy = SY(z + 0.78 + 0.5), sw = 0.6 * k, sh = 0.42 * k;                                                                          // the screen
    g.fillStyle = '#0d1a3a'; g.fillRect(sx, sy, sw, sh); g.fillStyle = '#2a5ac8'; g.fillRect(sx, sy, sw, 0.07 * k); g.fillStyle = '#fff'; g.font = '800 7px system-ui'; g.textAlign = 'left'; g.fillText(scr + '2000', sx + 3, sy + 0.055 * k);
    g.fillStyle = '#ffd25c'; let fs = Math.round(Math.max(9, 0.15 * k)); g.font = '900 ' + fs + 'px system-ui'; while (fs > 7 && g.measureText(scr).width > sw - 8) { fs--; g.font = '900 ' + fs + 'px system-ui'; } g.textAlign = 'center'; g.fillText(scr, sx + sw / 2, sy + 0.2 * k);                // the word on the screen
    for (let i = 0; i < 3; i++) { const bw = (0.24 + 0.1 * i) * k, prog = ((time * (0.05 + 0.03 * i) + i * 0.3) % 1); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(sx + 4, sy + (0.27 + i * 0.045) * k, sw - 8, 0.028 * k); g.fillStyle = ['#5ae06a', '#5ac8e0', '#e0a85a'][i]; g.fillRect(sx + 4, sy + (0.27 + i * 0.045) * k, (sw - 8) * prog, 0.028 * k); }
    g.fillStyle = `rgba(140,190,255,${0.10 + 0.04 * Math.sin(time * 5)})`; g.fillRect(sx, sy, sw, sh);                                                       // CRT flicker
    g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(sx, sy, sw, sh);
    g.fillStyle = '#6a5a8a'; g.fillRect(SX(x - 0.32), SY(z + 0.4), 0.5 * k, 0.07 * k); g.fillRect(SX(x - 0.1), SY(z + 0.45), 0.09 * k, 0.45 * k);               // the chair, pushed in
  }
  cdwriter(g, p, z, time) {                                // the CD writer: a beige burner on its own stand, a spindle of blank CD-Rs, a note
    const { SX, SY, k } = this, x = p.x;
    this.box(g, x - 0.5, z + 0.62, 1.0, 0.06, '#8a6a44'); this.box(g, x - 0.45, z, 0.07, 0.62, '#6a4a2a'); this.box(g, x + 0.38, z, 0.07, 0.62, '#6a4a2a');
    this.box(g, x - 0.38, z + 0.68, 0.62, 0.2, '#d8d0b8'); g.fillStyle = '#4a463e'; g.fillRect(SX(x - 0.3), SY(z + 0.8), 0.34 * k, 0.04 * k);                  // the drive + its tray slot
    g.fillStyle = Math.sin(time * 5) > 0 ? '#ff4a3a' : '#6a2018'; g.fillRect(SX(x + 0.1), SY(z + 0.79), 3, 3);                                            // BURNING: the red LED blinks
    g.fillStyle = '#c8cdd8'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(SX(x + 0.34), SY(z + 0.72 + i * 0.022), 0.1 * k, 0.03 * k, 0, 0, TAU); g.fill(); } g.fillStyle = '#3a3a40'; g.fillRect(SX(x + 0.335), SY(z + 0.93), 2, 0.2 * k);   // the spindle
    g.fillStyle = '#f4ecc8'; g.fillRect(SX(x - 0.34), SY(z + 0.56), 0.4 * k, 0.12 * k); g.fillStyle = '#2a1430'; g.font = '800 7px system-ui'; g.textAlign = 'center'; g.fillText('CD-R 4x', SX(x - 0.14), SY(z + 0.56) + 0.092 * k);
  }
  dad(g, D, time) {                                        // the old guy (Brian's dad): flannel, grey hair, in his recliner; he turns toward the stairs to yell
    const { SX, SY, k } = this, x = D.x, z = D.z, bob = Math.sin(time * 1.1) * 0.008, yell = D.sayT > 0;
    this.shadow(g, x, z, 1.2, 0.3);
    g.fillStyle = '#4a6a48'; g.beginPath(); g.ellipse(SX(x + 0.05), SY(z + 0.8 + bob), 0.21 * k, 0.31 * k, -0.15, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 4; i++) g.fillRect(SX(x - 0.1 + i * 0.07), SY(z + 1.02), 2, 0.4 * k);
    g.fillStyle = '#54545c'; g.fillRect(SX(x - 0.45), SY(z + 0.6), 0.5 * k, 0.12 * k);
    g.fillStyle = '#e8b8a0'; g.beginPath(); g.arc(SX(x - 0.02), SY(z + 1.2 + bob), 0.135 * k, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#b8b4ac'; g.beginPath(); g.arc(SX(x + 0.03), SY(z + 1.27 + bob), 0.12 * k, Math.PI * 1.05, Math.PI * 2.05); g.fill();       // grey hair
    g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(SX(x - 0.16), SY(z + 1.22), 0.1 * k, 0.07 * k);                                              // glasses
    if (yell) { g.fillStyle = '#7a2a2a'; g.beginPath(); g.ellipse(SX(x - 0.12), SY(z + 1.12), 0.04 * k, 0.05 * k * (0.7 + 0.5 * Math.abs(Math.sin(time * 14))), 0, 0, TAU); g.fill();
      g.strokeStyle = '#2a1430'; g.lineWidth = 1.6; for (const dy of [-0.1, 0, 0.1]) { g.beginPath(); g.moveTo(SX(x - 0.28), SY(z + 1.2 + dy)); g.lineTo(SX(x - 0.42 - Math.abs(dy)), SY(z + 1.2 + dy * 1.6)); g.stroke(); } }
    g.fillStyle = '#f0e0ff'; g.font = '800 9px system-ui'; g.textAlign = 'center'; g.fillText(String(D.name).toUpperCase(), SX(x), SY(z + 1.55));
  }
  // a side-view person from Palm City's player sheet (the same one the hero uses), optionally hue-shifted so Brian / the guests are not clones of you
  person(g, o, time, hue) {
    const { SX, SY, k } = this, M = SIDE.M;
    this.shadow(g, o.x, o.z, 0.55, 0.3);
    if (M && SIDE.img && SIDE.img.complete && SIDE.img.naturalWidth) {
      const sh = M.peds.player, e = sh.color, W = ['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5'];
      const name = o.drinkT > 0 ? 'idle' : o.moving ? W[Math.floor(o.walk / 0.13) % 6] : 'idle';
      const i = sh.poses.indexOf(name), cols = sh.cols, rows = Math.ceil(sh.poses.length / cols), cw = SIDE.img.width / cols, ch = SIDE.img.height / rows, sc = k / M.su * 0.78;
      g.save(); if (hue) g.filter = `hue-rotate(${hue}deg) saturate(1.1)`; g.translate(SX(o.x), SY(o.z)); if (o.face < 0) g.scale(-1, 1);
      g.drawImage(SIDE.img, (i % cols) * cw, ((i / cols) | 0) * ch, cw, ch, e.ox * sc, e.oy * sc, e.w * sc, e.h * sc); g.restore();
    } else { g.fillStyle = '#58a0d9'; g.fillRect(SX(o.x) - 6, SY(o.z + 1.8), 12, 1.8 * k); }
    g.fillStyle = '#fff3dc'; g.font = '700 10px system-ui'; g.textAlign = 'center'; g.fillText(o.name.split(' ')[0], SX(o.x), SY(o.z + 2.0));
  }
  // L14: a row of upright cabinets — marquees, lit screens (wilder while you PLAY), control panels
  arcade(g, p, z, I, time) {
    const { SX, SY, k } = this, names = p.cabinets || ['ARCADE'];
    names.forEach((nm, i) => {
      const x = p.x - 0.5 + i * 0.95, cols = [['#c42b2b', '#ffd25c'], ['#2a6ad0', '#7fe0ff'], ['#2f9a4a', '#ffef8a']][i % 3];
      this.box(g, x - 0.35, z, 0.7, 1.8, '#1c1a26');
      g.fillStyle = cols[0]; g.fillRect(SX(x - 0.33), SY(z + 1.8), 0.66 * k, 0.22 * k);                          // marquee
      g.fillStyle = '#fff8e0'; g.font = `800 ${Math.max(6, 0.1 * k)}px system-ui`; g.textAlign = 'center'; g.fillText(nm, SX(x), SY(z + 1.63));
      const wild = I.arcadeT > 0 && i === 0, fl = 0.55 + 0.45 * Math.abs(Math.sin(time * (wild ? 23 : 3.1) + i));
      g.fillStyle = cols[1]; g.globalAlpha = fl; g.fillRect(SX(x - 0.26), SY(z + 1.5), 0.52 * k, 0.4 * k); g.globalAlpha = 1;   // the screen
      for (let s = 0; s < 4; s++) { g.fillStyle = '#1c1a26'; g.fillRect(SX(x - 0.2 + ((time * (wild ? 3 : 0.6) + s * 0.13 + i * 0.3) % 0.4)), SY(z + 1.4 - s * 0.07), 0.05 * k, 0.04 * k); }
      this.box(g, x - 0.36, z + 0.9, 0.72, 0.12, '#3a3646');                                                        // control panel
      g.fillStyle = '#e8e0d0'; g.beginPath(); g.arc(SX(x - 0.15), SY(z + 1.06), 0.04 * k, 0, TAU); g.fill();
      g.fillStyle = cols[0]; for (const b of [0.05, 0.16]) { g.beginPath(); g.arc(SX(x + b), SY(z + 1.04), 0.03 * k, 0, TAU); g.fill(); }
    });
    if (I.arcadeT > 0) { g.font = '900 13px system-ui'; g.textAlign = 'center'; g.fillStyle = '#ffd25c'; g.fillText('HIGH SCORE!', SX(p.x - 0.5), SY(z + 2.3) - Math.sin(time * 8) * 3); }
  }
  // L14: a full bar — the counter with a brass rail, stools, taps, and a lit back shelf of bottles
  bar(g, p, z, time) {
    const { SX, SY, k } = this, x = p.x;
    this.box(g, x - 0.2, z + 1.25, 2.6, 0.9, '#3a2418');                                                            // back shelf
    for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) { g.fillStyle = ['#7a3a20', '#2f6a3a', '#c9a24a', '#6a2a3a', '#d8d0c0'][(i + r) % 5]; g.fillRect(SX(x - 0.05 + i * 0.28), SY(z + 1.62 + r * 0.38), 0.11 * k, 0.3 * k); }
    g.fillStyle = 'rgba(255,214,140,0.25)'; g.fillRect(SX(x - 0.2), SY(z + 2.15), 2.6 * k, 0.9 * k);                    // shelf glow
    this.box(g, x - 0.6, z, 3.0, 1.05, '#6a3a24'); this.box(g, x - 0.7, z + 1.05, 3.2, 0.08, '#3a1e12');             // counter + top
    g.fillStyle = '#c9a24a'; g.fillRect(SX(x - 0.6), SY(z + 0.22), 3.0 * k, 0.04 * k);                                 // brass foot rail
    for (const t of [0.4, 0.62, 0.84]) { g.fillStyle = '#c9ccd2'; g.fillRect(SX(x + t), SY(z + 1.42), 0.04 * k, 0.3 * k); g.fillStyle = '#2a1430'; g.fillRect(SX(x + t - 0.02), SY(z + 1.46), 0.08 * k, 0.06 * k); }   // taps
    for (const sx of [-0.9, -0.2, 0.5, 1.2]) { this.box(g, x + sx - 0.03, z, 0.06, 0.72, '#2a2a30'); g.fillStyle = '#b84a3a'; g.beginPath(); g.ellipse(SX(x + sx), SY(z + 0.76), 0.2 * k, 0.06 * k, 0, 0, TAU); g.fill(); }   // stools
  }
  // L14: the GIANT HOLE IN THE WALL — a ragged dark breach in the back wall, broken drywall round it, debris on the floor
  hole(g, p, z) {
    const { SX, SY, k } = this, x = p.x, pts = [[-0.8, 0.1], [-0.95, 0.7], [-0.6, 1.5], [-0.1, 1.9], [0.5, 1.7], [0.9, 1.2], [0.85, 0.4], [0.4, 0.05]];
    g.fillStyle = '#efe6d2'; g.beginPath(); pts.forEach(([u, v], i) => { const px = SX(x + u * 1.12), py = SY(z + v * 1.08 + 0.02); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.fill();   // torn drywall rim
    g.fillStyle = '#120c14'; g.beginPath(); pts.forEach(([u, v], i) => { const px = SX(x + u), py = SY(z + v); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.fill();
    g.strokeStyle = '#5a4a3a'; g.lineWidth = 1.2; for (const s of [-0.5, -0.1, 0.3, 0.6]) { g.beginPath(); g.moveTo(SX(x + s), SY(z + 0.2)); g.lineTo(SX(x + s + 0.05), SY(z + 1.6)); g.stroke(); }   // studs showing through
    g.fillStyle = '#d8ccb4'; for (const [u, w] of [[-1.1, 0.22], [-0.7, 0.14], [0.9, 0.2], [1.2, 0.12]]) g.fillRect(SX(x + u), SY(z + 0.06), w * k, 0.06 * k);   // chunks on the floor
  }
  son(g, S, time) { this.person(g, S, time, 150); }
  guest(g, gu, time, cut) {                              // CPU crew idling at home: by the fire with a beer; they sip now and then
    if (gu.party && cut && cut.complete && cut.naturalWidth) { this.partyGuest(g, gu, time, cut); return; }   // a party guest wears the cutaway sheet, not a hue-shifted clone of you
    this.person(g, { ...gu, moving: false, walk: 0 }, time, (gu.id.length * 47) % 300 + 20);
    const { SX, SY, k } = this, u = gu.drinkT > 0 ? Math.min(1, (MOVE_DRINK - gu.drinkT) / 0.4) : 0, tilt = gu.drinkT > 0 ? Math.min(1, (MOVE_DRINK - gu.drinkT) / 0.6) * 1.9 : 0;
    g.save(); g.translate(SX(gu.x + gu.face * 0.22), SY(gu.z + 0.95 + u * 0.62)); g.rotate(-gu.face * tilt * 0.6); g.fillStyle = '#c9ccd2'; g.fillRect(-0.035 * k, -0.13 * k, 0.07 * k, 0.13 * k); g.fillStyle = '#c42b2b'; g.fillRect(-0.035 * k, -0.09 * k, 0.07 * k, 0.04 * k); g.restore();
  }
  // a night-party guest from the G18 cutaway sheet (party_crowd_cutaway.webp: an 8x2 grid of
  // 80x120 side-view partygoers, DESIGN-G18 §2) — the sheet lf_party.js always loaded but
  // nobody drew. Drawn at the house person height (~1.8 m, the hero's scale), feet on the
  // floor slab, dancers/cheerers bobbing on their placement phase.
  partyGuest(g, gu, time, cut) {
    const { SX, SY, k } = this;
    this.shadow(g, gu.x, gu.z, 0.55, 0.3);
    const cols = 8, rows = 2, cw = cut.width / cols, ch = cut.height / rows, cell = ((gu.cell || 0) % (cols * rows) + cols * rows) % (cols * rows);
    const h = 1.8 * k * (gu.scale || 1), w = h * (cw / ch);
    const bob = (gu.pose === 'dance' || gu.pose === 'cheer') ? Math.abs(Math.sin(time * 2.6 + (gu.bobPhase || 0))) * 0.07 * k : 0;
    g.save(); g.translate(SX(gu.x), SY(gu.z) - bob); if ((gu.face || 1) < 0) g.scale(-1, 1);
    g.drawImage(cut, (cell % cols) * cw, Math.floor(cell / cols) * ch, cw, ch, -w / 2, -h, w, h);
    g.restore();
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
  bubble(g, x, y, text, a, big) {                          // a speech bubble, word-wrapped to ~230 px; `big` = a YELL (bigger, bolder, a jagged edge feel)
    g.save(); g.globalAlpha = a; g.font = (big ? '900 15px' : '700 12px') + ' system-ui'; const maxW = 232, words = String(text).split(' '), lines = []; let cur = '';
    for (const w of words) { if (g.measureText(cur ? cur + ' ' + w : w).width > maxW && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } lines.push(cur);
    const lh = big ? 18 : 15, w = Math.max(...lines.map(l => g.measureText(l).width)) + 20, h = lines.length * lh + 10; x = Math.max(w / 2 + 8, Math.min(this.vw - w / 2 - 8, x));
    g.fillStyle = big ? 'rgba(255,240,200,0.98)' : 'rgba(255,248,232,0.97)'; g.beginPath(); g.roundRect(x - w / 2, y - h, w, h, 10); g.fill(); g.strokeStyle = INK; g.lineWidth = big ? 2.2 : 1.5; g.stroke();
    g.fillStyle = INK; g.textAlign = 'center'; lines.forEach((l, i) => g.fillText(l, x, y - h + 6 + (i + 1) * lh - 3)); g.restore();
  }
}
const K_CH = (I) => I.K.ceiling;
