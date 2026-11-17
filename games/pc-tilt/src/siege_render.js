// siege_render.js — draws the Motel Siege cutaway (src/siege.js) on the phone canvas.
// Layers, back to front: sky + distant skyline, the baked cutaway (tools/bake_side.py: the same
// Cycles light, Kuwahara paint and plum ink as the street sprites), Gemini's barricades and traps,
// side-view people, the street in front (the real painted ground south of the motel, with the
// cruisers on it), debris; then the day grade, the baked night light layer (windows, lamps, neon),
// siren washes and the chopper's spotlight, added as light; vignette.
import { grade } from './render.js';
import { CHUNK } from './ground.js';

const lerp = (a, b, u) => a + (b - a) * u;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const K = 34;                   // view units per metre: ~12 m of building across the phone, people ~75 units tall

export class SiegeRenderer {
  constructor(ctx, world, ground, M) {
    this.ctx = ctx; this.world = world; this.ground = ground; this.M = M;
    this.L = world.L.siege;
    this.skyline = [];
    let s = 77;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let x = -26; x < 26;) {               // distant blocks behind the motel (parallax 0.35)
      const w = 2.2 + r() * 4, h = 14 + r() * 26;
      const wins = [];
      for (let wx = 0.6; wx < w - 0.6; wx += 1.1) for (let wz = 1.2; wz < h - 1; wz += 1.5) if (r() < 0.42) wins.push(wx, wz, r());
      this.skyline.push({ x, w, h, wins, tone: r() });
      x += w + 0.4 + r() * 1.2;
    }
    this.light = null;
  }

  ensureLight(w, h) {
    if (!this.light || this.light.width !== w || this.light.height !== h) {
      this.light = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    }
    return this.light;
  }

  draw(sim, t, time, vw, vh, dpr) {
    const sg = sim.siege, g = this.ctx, M = this.M.siege, L = this.L, G = grade(t);
    const h = sg.hero;
    // camera: follow the hero across the building; the street line sits at 76% of the screen
    const half = vw / 2 / K;
    const tx = Math.max(-12 + half, Math.min(12.4 - half, h.x + h.face * 0.8));
    sg.cam.x += (tx - sg.cam.x) * (sg.enterT < 0.05 ? 1 : 0.12);
    const shake = sg.shake > 0 ? sg.shake * 0.35 : 0;
    const camX = sg.cam.x + (shake ? (Math.sin(time * 71) * shake) : 0);
    const gy = vh * 0.76 + (shake ? Math.cos(time * 63) * shake * K * 0.6 : 0);
    const SX = (x) => vw / 2 + (x - camX) * K, SY = (z) => gy - z * K;
    this.SX = SX; this.SY = SY;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

    // ---- sky: apricot golden hour -> rose -> deep indigo, and the skyline
    const top = t < 0.55 ? mixc([242, 170, 112], [214, 112, 120], t / 0.55) : mixc([214, 112, 120], [22, 30, 78], (t - 0.55) / 0.45);
    const bot = t < 0.55 ? mixc([255, 214, 150], [250, 160, 120], t / 0.55) : mixc([250, 160, 120], [64, 52, 120], (t - 0.55) / 0.45);
    const sky = g.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, rgb(top)); sky.addColorStop(1, rgb(bot));
    g.fillStyle = sky; g.fillRect(0, 0, vw, gy + 2);
    // the low sun (golden hour) sinking behind the skyline, then gone
    if (t < 0.6) {
      const su = t / 0.6, sx = vw * 0.22 - camX * 4, sy = gy - 300 + su * 260;
      this.glow(g, sx, sy, 160, [255, 232, 170], 0.55 * (1 - su));
      g.fillStyle = `rgba(255,236,190,${0.9 * (1 - su * 0.6)})`; g.beginPath(); g.arc(sx, sy, 26, 0, 7); g.fill();
    }
    const sil = mixc(mixc(top, [70, 40, 80], 0.55), [20, 18, 50], clamp01((t - 0.5) * 2));
    for (const b of this.skyline) {
      const x0 = vw / 2 + (b.x - camX * 0.35) * K * 0.55, w = b.w * K * 0.55, hh = b.h * K * 0.55;
      if (x0 > vw || x0 + w < 0) continue;
      g.fillStyle = rgb(mixc(sil, bot, 0.25 + 0.25 * b.tone));
      g.fillRect(x0, gy - hh - 10, w, hh + 12);
    }

    // ---- the baked cutaway
    const sc = K / M.su;
    const img = (e, x, z, rot = 0, flip = 1, s = 1) => {
      if (!e || !e.img) return;
      g.save(); g.translate(SX(x), SY(z)); if (rot) g.rotate(rot); if (flip < 0) g.scale(-1, 1);
      g.drawImage(this.tinted(e), e.ox * sc * s, e.oy * sc * s, e.w * sc * s, e.h * sc * s);
      g.restore();
    };
    this.tint = null;                       // the building and the street take the grade as one multiply pass
    img(M.motel.color, 0, 0);
    // ---- the street in front: the real painted road south of the motel, squashed into depth
    this.drawStreet(g, sg, vw, vh, gy, SX, time, dpr);
    // ---- grade: the same day multiply as the street scenes, then the baked night light on top
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = rgb(G.roofMul); g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.max(0.3, G.windows) * 0.55 * (sg.lightsOut > 0 ? 0.35 : 1);
    img(M.motel.night, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (sg.lightsOut > 0 && Math.sin(time * 40) > -0.3) {           // F3 blacked out (fuse box)
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = 'rgb(90,80,130)';
      g.fillRect(SX(L.x0), SY(L.roof - 0.4), (L.x1 - L.x0) * K, (L.roof - L.floors[2] - 0.4) * K);
      g.globalCompositeOperation = 'source-over';
    }
    // ---- props and people: drawn after the light, from copies pre-multiplied by the same grade
    this.tint = G.roofMul;
    const P = M.props, F = L.floors;
    // roof furniture: the neon pylon and the hatch
    img(P.neon, 4.25, L.roof + 2.5);
    img(sg.hatch.open ? P.hatch_open : P.hatch, L.ladder.x + 0.1, L.roof + (sg.hatch.open ? 0.75 : 0.05));
    if (sg.breaches.ladder) img(P.ext_ladder, L.fireEscape.x1 + 0.35, 0, -0.12);
    // barricades
    for (const b of sg.barricades) {
      if (b.broken) continue;
      const e = b.kind === 'desk' && b.hp < b.hp0 ? P.desk_damaged : P[b.kind];
      img(e, b.cur, F[b.floor], b.slide > 0 ? Math.sin(time * 50) * 0.03 : 0);
    }
    // traps
    for (const tr of sg.traps) this.drawTrap(sg, tr, img, P, F, time);
    // people
    this.drawPeople(sg, time, sc);

    // debris / sparks
    for (const f of sg.fx) {
      const a = 1 - f.t / f.life, x = SX(f.x), y = SY(f.z);
      g.globalAlpha = a;
      if (f.kind === 'dust') { g.fillStyle = 'rgba(214,190,160,0.6)'; g.beginPath(); g.arc(x, y, 3 + f.t * 14, 0, 7); g.fill(); }
      else if (f.kind === 'spark') { g.strokeStyle = '#ffe680'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - f.vx * 3, y + f.vz * 3); g.stroke(); }
      else {
        g.fillStyle = f.kind === 'glass' ? '#cfeefa' : f.kind === 'can' ? (f.r > 3 ? '#e04848' : '#48c8e0') : f.kind === 'towel' ? '#f4f0e6' : '#8a5634';
        g.save(); g.translate(x, y); g.rotate(f.r + f.t * 9); g.fillRect(-2.2, -1.2, 4.4, 2.4); g.restore();
      }
    }
    g.globalAlpha = 1;

    // ---- light: neon pylon glow + siren washes + the chopper's spotlight
    g.globalAlpha = 1;
    this.glow(g, SX(4.25), SY(L.roof + 3.6), 120, [255, 63, 106], 0.25 + 0.55 * G.neon);
    for (const c of sg.cruisers) {
      const on = Math.floor(time * 6 + c.x) % 2;
      this.glow(g, SX(c.x), gy + 40, 150, on ? [255, 40, 60] : [40, 90, 255], 0.35 + 0.25 * G.heads);
    }
    if (sg.chopper) {
      const sx = SX(Math.sin(sg.chopper * 0.6) * 5 + 1), sy = SY(L.roof + 0.2);
      const cone = g.createLinearGradient(sx, 0, sx, sy);
      cone.addColorStop(0, 'rgba(255,250,230,0.05)'); cone.addColorStop(1, 'rgba(255,250,230,0.32)');
      g.fillStyle = cone; g.beginPath(); g.moveTo(sx - 26, 0); g.lineTo(sx + 26, 0); g.lineTo(sx + 95, sy); g.lineTo(sx - 95, sy); g.closePath(); g.fill();
      this.glow(g, sx, sy, 110, [255, 248, 220], 0.5);
    }
    g.globalCompositeOperation = 'source-over';

    // score pops
    g.textAlign = 'center'; g.font = '900 15px "Avenir Next", Futura, system-ui, sans-serif';
    for (const p of sg.pops) {
      const a = Math.min(1, (1.4 - p.t) / 0.4), y = SY(p.z) - p.t * 26;
      g.globalAlpha = a; g.lineWidth = 4; g.strokeStyle = 'rgba(40,20,60,0.7)';
      const txt = `${p.label} +${p.pts}`;
      g.strokeText(txt, SX(p.x), y); g.fillStyle = '#ffd45c'; g.fillText(txt, SX(p.x), y);
    }
    g.globalAlpha = 1;
    // the arrest meter: a ring that fills while they've got hold of you
    if (h.arrest > 0.02 && !sim.busted) {
      const x = SX(h.x), y = SY((h.z || 0) + 2.6);
      g.lineWidth = 5; g.strokeStyle = 'rgba(30,10,30,0.5)'; g.beginPath(); g.arc(x, y, 11, 0, 7); g.stroke();
      g.strokeStyle = '#ff4a5c'; g.beginPath(); g.arc(x, y, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, h.arrest / 1.5)); g.stroke();
    }
    // vignette
    const vg = g.createRadialGradient(vw / 2, vh / 2, vh * 0.32, vw / 2, vh / 2, vh * 0.72);
    vg.addColorStop(0, `rgba(${G.vigCol[0]},${G.vigCol[1]},${G.vigCol[2]},0)`);
    vg.addColorStop(1, `rgba(${G.vigCol[0]},${G.vigCol[1]},${G.vigCol[2]},${G.vigAlpha})`);
    g.fillStyle = vg; g.fillRect(0, 0, vw, vh);
    // the cut in and out
    const fade = sg.outT >= 0 ? clamp01(sg.outT / 0.5) : clamp01(1 - sg.enterT / 0.35);
    if (fade > 0) { g.fillStyle = `rgba(14,8,28,${fade})`; g.fillRect(0, 0, vw, vh); }
  }

  glow(g, x, y, r, c, a) {
    if (a <= 0.01) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  drawTrap(sg, tr, img, P, F, time) {
    const z = F[tr.floor];
    if (tr.kind === 'vend') {
      if (tr.state === 'ready') img(P.vend, tr.x, z);
      else if (tr.state === 'falling') {             // pivots on its front foot
        const a = Math.min(1, tr.ft / 0.35) ** 2 * Math.PI / 2 * tr.dir;
        const g = this.ctx, e = P.vend, sc = K / this.M.siege.su;
        g.save(); g.translate(this.SX(tr.x + tr.dir * 0.73), this.SY(z)); g.rotate(a);
        g.drawImage(this.tinted(e), (e.ox - tr.dir * 16) * sc, e.oy * sc, e.w * sc, e.h * sc); g.restore();
      } else img(P.vend_down, tr.x + tr.dir * 1.1, z, 0, tr.dir);
    } else if (tr.kind === 'tv') {
      if (tr.state === 'ready') img(P.tv, tr.x, z + 0.9);
      else if (tr.state === 'flying') img(P.tv, tr.x, tr.z, (tr.x - tr.cx) * 1.3);
      else img(P.tv_broken, tr.x, z);
    } else if (tr.kind === 'cart') {
      if (tr.state === 'tipped') img(P.cart_tipped, tr.x, z, 0, tr.dir);
      else img(P.cart, tr.x, z + (tr.state === 'rolling' ? Math.abs(Math.sin(time * 30)) * 0.04 : 0), tr.state === 'rolling' ? -0.05 * Math.sign(tr.vx) : 0);
    } else if (tr.kind === 'fusebox') img(tr.state === 'ready' ? P.fusebox : P.fusebox_shorted, tr.x, z + 1.7);
    else if (tr.kind === 'ac') {
      if (tr.state === 'dropped') img(P.ac_dropped, tr.x, 0);
      else img(P.ac, tr.x, tr.z, tr.state === 'falling' ? (tr.cx - tr.x) * 0.8 : 0);
    }
  }

  frameOf(p) {
    const W = ['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5'];
    if (p.kind === 'hero') {
      if (p.air) return 'jump';
      if (p.link && p.link.kind === 'ladder') return Math.floor(p.walk / 0.35) % 2 ? 'climbA' : 'climbB';
      if (p.punchT > 0) return p.punchT > 0.17 ? 'wind' : 'punch';
      if (p.moving || p.link) return W[Math.floor(p.walk / 0.32) % 6];
      return 'idle';
    }
    if (p.st === 'down') return 'down';
    if (p.st === 'hurt' || p.st === 'stun') return 'hurt';
    if (p.st === 'grab') return 'punch';
    if (p.st === 'climbin' || (p.link && p.link.kind === 'ladder')) return Math.floor(p.z / 0.35) % 2 ? 'climbA' : 'climbB';
    if (p.blockedBy) return Math.floor(p.bashT * 3) % 2 ? 'wind' : 'punch';
    return W[Math.floor(p.walk / 0.32) % 6];
  }

  drawPerson(p, sheet, sc) {
    const g = this.ctx, e = sheet.color, name = this.frameOf(p);
    const i = sheet.poses.indexOf(name), cols = sheet.cols, rows = Math.ceil(sheet.poses.length / cols);
    const cw = e.img.width / cols, ch = e.img.height / rows;
    g.save(); g.translate(this.SX(p.x), this.SY(p.z)); if (p.face < 0) g.scale(-1, 1);
    g.drawImage(this.tinted(e), (i % cols) * cw, ((i / cols) | 0) * ch, cw, ch, e.ox * sc, e.oy * sc, e.w * sc, e.h * sc);
    g.restore();
  }

  // A sprite multiplied by the current grade colour, alpha kept (multiply, then cut back to the
  // sprite's own alpha). Rebuilt only when the grade colour moves; null tint = the original.
  tinted(e) {
    const c = this.tint;
    if (!c) return e.img;
    const key = (c[0] << 16) | (c[1] << 8) | c[2];
    if (e.tintKey === key) return e.tintCv;
    const w = e.img.width, h = e.img.height;
    const cv = e.tintCv || (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
    const x = cv.getContext('2d');
    x.globalCompositeOperation = 'copy'; x.drawImage(e.img, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(e.img, 0, 0);
    e.tintCv = cv; e.tintKey = key;
    return cv;
  }

  drawPeople(sg, time, sc) {
    const S = this.M.siege.peds, g = this.ctx;
    for (const c of sg.cops) {
      if (c.st === 'gone') continue;
      if (c.st === 'climbin' && c.surf === 'R') {               // the rappel line
        g.strokeStyle = 'rgba(30,24,40,0.8)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(this.SX(c.x), 0); g.lineTo(this.SX(c.x), this.SY(c.z + 1.8)); g.stroke();
      }
      this.drawPerson(c, S[c.kind === 'swat' ? 'swat' : 'cop'], sc);
      if (c.st === 'stun' || (c.st === 'down' && c.downT > 0)) {   // little stars
        for (let k = 0; k < 3; k++) {
          const a = time * 5 + k * 2.1, x = this.SX(c.x + Math.cos(a) * 0.35 - (c.st === 'down' ? c.face * 0.9 : 0)), y = this.SY(c.z + (c.st === 'down' ? 0.7 : 2.3)) + Math.sin(a) * 4;
          g.fillStyle = '#ffd45c'; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill();
        }
      }
    }
    const h = sg.hero;
    h.moving = h.lastX !== undefined && Math.abs(h.x - h.lastX) > 1e-4;
    h.lastX = h.x;
    if (!(sg.outT > 0.25)) this.drawPerson(h, S.player, sc);
  }

  drawStreet(g, sg, vw, vh, gy, SX, time, dpr) {
    // world strip: x 384..760, y 1340..1500 (the road south of the motel) -> screen x(-12)..x(12.4)
    const G0 = this.ground, wx0 = 384, wx1 = 760, wy0 = 1342, wy1 = 1500;
    const dx0 = SX(-12), dx1 = SX(12.4), ky = (vh - gy) / (wy1 - wy0), kx = (dx1 - dx0) / (wx1 - wx0);
    g.save();
    g.beginPath(); g.rect(0, gy + 2, vw, vh - gy); g.clip();
    g.setTransform(dpr * kx, 0, 0, dpr * ky, dpr * (dx0 - wx0 * kx), dpr * (gy + 2 - wy0 * ky));
    for (let cy = Math.floor(wy0 / CHUNK); cy <= Math.floor(wy1 / CHUNK); cy++) for (let cx = Math.floor(wx0 / CHUNK); cx <= Math.floor(wx1 / CHUNK); cx++) {
      if (cx < 0 || cy < 0 || cx >= G0.cols || cy >= G0.rows) continue;
      g.drawImage(G0.get(cx, cy), cx * CHUNK, cy * CHUNK, CHUNK + 0.6, CHUNK + 0.6);
    }
    // the cruisers parked along the kerb, nose to the motel
    const m = this.M.cars.police;
    for (const c of sg.cruisers) {
      const wx = wx0 + (c.x + 12) / 24.4 * (wx1 - wx0), wy = wy0 + 26;
      const hd = c.side < 0 ? 0 : Math.PI;
      const n = m.angles; let k = Math.round(hd / (Math.PI * 2) * n) % n; if (k < 0) k += n;
      const f = m.color, rows = Math.ceil(n / m.cols), cw = f.img.width / m.cols, ch = f.img.height / rows;
      g.save(); g.translate(wx, wy); g.scale(1, kx / ky * 0.55);
      g.drawImage(f.img, (k % m.cols) * cw, ((k / m.cols) | 0) * ch, cw, ch, f.ox, f.oy, f.w, f.h);
      if (c.dmg >= 2) { g.fillStyle = 'rgba(40,30,40,0.45)'; g.beginPath(); g.ellipse(0, 0, 16, 8, 0, 0, 7); g.fill(); }
      g.restore();
      if (c.dmg >= 2) {                    // smoke off the crushed roof
        for (let k2 = 0; k2 < 4; k2++) {
          const u = (time * 0.6 + k2 / 4) % 1;
          g.fillStyle = `rgba(60,52,64,${0.35 * (1 - u)})`;
          g.beginPath(); g.arc(wx + Math.sin(u * 6 + k2) * 4, wy - u * 40, 5 + u * 12, 0, 7); g.fill();
        }
      }
    }
    g.restore();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // a soft kerb shadow under the building line
    const sh = g.createLinearGradient(0, gy, 0, gy + 30);
    sh.addColorStop(0, 'rgba(30,16,40,0.45)'); sh.addColorStop(1, 'rgba(30,16,40,0)');
    g.fillStyle = sh; g.fillRect(0, gy, vw, 30);
    void time;
  }
}

function mixc(a, b, u) { u = clamp01(u); return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
function rgb(c) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }
