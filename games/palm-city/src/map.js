// map.js — the CITY MAP (task 5B). A MAP button under the wanted stars opens a full-screen map of
// the whole city: since Nov 18 the base is the baked painted overview (see BAKED below — the game
// world rendered from directly above, golden and dusk), with painted-plaque labels for the places,
// the job vehicles, the active job's target, and a
// live marker for the player (position + facing). The map is LIVE: the game keeps running under it
// and the joystick still drives, so you can watch yourself move. Tap MAP / the X (or M) to close.
import { PLACES } from './jobs.js';
import { markers } from './activities.js';

// Nov 18 (Queue 4 Task 1 — the owner's pick over Fable's flat diagram): the base is the pre-baked
// painted overview in shots/map-redo/after (tools/build_map_redo.mjs — the live GroundPainter +
// Renderer at golden hour and blue dusk; 900x1100 px = the whole 1800x2200 world at 0.5 px/unit,
// so toMap() is unchanged). The sampled base in build() stays as the fallback until the sheets
// decode, so the map can never open blank.
const BAKED = { golden: 'shots/map-redo/after/palm-map-golden-clean.webp', dusk: 'shots/map-redo/after/palm-map-dusk-clean.webp' };
const smooth01 = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
// plaque deconfliction (MAPREDO.md): px nudges for the label pairs that collided on the old map
const LABEL_OFF = [[/^WRECK/, 0, -13], [/^SKATE PARK/, 0, 13], [/^VALET/, 0, 13], [/^PARK IT/, 0, 13], [/^POLICE/, 0, -11], [/^TOW/, -15, 0], [/^BUS/, 15, 0]];
const labelOff = (name) => { for (const [re, dx, dy] of LABEL_OFF) if (re.test(name)) return [dx, dy]; return [0, 0]; };

const SURF = {                       // painted palette, by surface type
  road: [112, 92, 104], sidewalk: [226, 196, 150], paving: [214, 178, 132], plaza: [222, 168, 120], parking: [150, 128, 132],
  grass: [122, 170, 78], sand: [240, 212, 150], water: [58, 140, 190], promenade: [200, 150, 104],
};
const ROOF = { hotel: '#e8825a', shops: '#f0b060', diner: '#e86a6a', apartments: '#d8a070', motel: '#e0a060', office: '#8a94b0', club: '#c05a8a',
               police: '#7088b8', garage: '#8a8a98', house: '#d86a4a', villa: '#e07a50' };
const INK = '#210f2e';

// where the map sits on the phone screen, and world <-> map
export function mapFrame(vw, vh, world) {
  const W = world.L.world, top = 96, bottom = 150, pad = 12;
  const k = Math.min((vw - pad * 2) / W.w, (vh - top - bottom) / W.h);
  const w = W.w * k, h = W.h * k;
  return { k, x: (vw - w) / 2, y: top + (vh - top - bottom - h) / 2, w, h };
}
export const toMap = (F, x, y) => [F.x + x * F.k, F.y + y * F.k];

// labelled places, from layout data (buildings' signs and ids, the pier, the motel door) + job sites
export function mapPOIs(world, sim) {
  const L = world.L, out = [];
  const b = (id) => L.buildings.find(q => q.id === id);
  const mid = (q) => [q.x + q.w / 2, q.y + q.d / 2];
  for (const q of L.buildings) if (q.sign && q.id !== 'motel') out.push({ name: q.sign, kind: 'place', p: mid(q) });
  out.push({ name: 'GARAGE', kind: 'place', p: mid(b('garage')) });
  out.push({ name: 'POLICE', kind: 'place', p: mid(b('police')) });
  out.push({ name: 'PIER', kind: 'place', p: [L.pier.x + L.pier.w * 0.5, L.pier.y + L.pier.h / 2] });
  out.push({ name: 'BEACH', kind: 'area', p: [L.shore.x - 40, 620] });
  out.push({ name: 'SKATE PARK', kind: 'area', p: sim && sim.benches && sim.benches[0] ? [sim.benches[0].x, sim.benches[0].y] : [1330, 1300] });
  if (!sim) out.push({ name: 'MOTEL', kind: 'door', p: [L.motelDoor[0], L.motelDoor[1]] });
  if (sim) {
    if (sim.job && sim.job.spot) out.push({ name: sim.job.spotName || 'JOB', kind: 'target', p: [sim.job.spot[0], sim.job.spot[1]] });
    if (sim.event && sim.event.spot) out.push({ name: sim.event.name, kind: 'target', p: sim.event.spot });
    // every activity in the registry (activities.js): the motel door, the four jobs, the events
    for (const m of markers(sim)) if (m.a.group !== 'hub') out.push({ name: m.a.group === 'siege' ? 'MOTEL' : m.a.group === 'event' ? m.a.site.name : m.a.tag, kind: m.a.door ? 'door' : 'job', p: [m.x, m.y], activity: m.a.id });
  }
  void PLACES;
  return out;
}

export function playerMarker(F, sim) {
  const f = sim.focus(), P = sim.player;
  const h = P.mode === 'car' ? P.car.h : P.mode === 'board' ? sim.board.h : P.ped.h;
  const [x, y] = toMap(F, f.x, f.y);
  return { x, y, h };
}

export class CityMap {
  constructor(world) {
    this.world = world; this.cv = null;
    this.sheets = null;
    if (typeof Image !== 'undefined') {
      const golden = new Image(), dusk = new Image();
      golden.src = BAKED.golden; dusk.src = BAKED.dusk;
      this.sheets = { golden, dusk };
    }
  }

  // the painted base, built once on first open (2 px per map unit)
  build(F) {
    const W = this.world, L = W.L, S = 2, w = Math.round(F.w * S), h = Math.round(F.h * S);
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data, ks = 1 / (F.k * S);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const wx = (i + 0.5) * ks, wy = (j + 0.5) * ks;
      const c = SURF[W.surfaceAt(wx, wy)] || SURF.paving;
      const n = Math.sin(wx * 0.37 + wy * 0.21) * Math.sin(wx * 0.11 - wy * 0.29);       // a little brush variation
      const o = (j * w + i) * 4, m = 1 + n * 0.07;
      d[o] = c[0] * m; d[o + 1] = c[1] * m; d[o + 2] = c[2] * m; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const k = F.k * S;
    g.lineJoin = 'round';
    // pier, buildings (roof colour + ink), palms
    g.fillStyle = '#a8703c'; g.strokeStyle = INK; g.lineWidth = 1.2;
    g.fillRect(L.pier.x * k, L.pier.y * k, L.pier.w * k, L.pier.h * k); g.strokeRect(L.pier.x * k, L.pier.y * k, L.pier.w * k, L.pier.h * k);
    for (const b of L.buildings) {
      g.fillStyle = ROOF[b.id.replace(/\d+$/, '')] || '#d0a070';
      g.fillRect(b.x * k, b.y * k, b.w * k, b.d * k);
      g.fillStyle = 'rgba(255,240,210,0.22)'; g.fillRect(b.x * k, b.y * k, b.w * k * 0.5, b.d * k);      // sunlit half
      g.lineWidth = 1.6; g.strokeRect(b.x * k, b.y * k, b.w * k, b.d * k);
    }
    for (const [x, y] of L.palms) { g.fillStyle = '#3f7a2c'; g.beginPath(); g.arc(x * k, y * k, 3.2, 0, 7); g.fill(); g.lineWidth = 0.8; g.stroke(); }
    this.cv = cv; this.key = w + 'x' + h;
  }

  draw(g, vw, vh, dpr, sim, time, tod = 0.18) {
    const F = mapFrame(vw, vh, this.world);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(24,12,40,0.9)'; g.fillRect(0, 0, vw, vh);
    // a paper edge round the painted city
    g.fillStyle = '#f6e6c4'; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.roundRect(F.x - 6, F.y - 6, F.w + 12, F.h + 12, 8); g.fill(); g.stroke();
    g.imageSmoothingEnabled = true;
    // the baked painted overview, crossfaded golden -> dusk with the day (MAPREDO.md wiring)
    const sh = this.sheets, ready = sh && sh.golden.complete && sh.golden.naturalWidth > 0 && sh.dusk.complete && sh.dusk.naturalWidth > 0;
    if (ready) {
      g.drawImage(sh.golden, F.x, F.y, F.w, F.h);
      const du = smooth01(0.45, 0.90, tod);
      if (du > 0) { g.globalAlpha = du; g.drawImage(sh.dusk, F.x, F.y, F.w, F.h); g.globalAlpha = 1; }
    } else {
      if (!this.cv || this.key !== Math.round(F.w * 2) + 'x' + Math.round(F.h * 2)) this.build(F);
      g.drawImage(this.cv, F.x, F.y, F.w, F.h);
    }
    g.lineJoin = 'round';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 20px "Avenir Next", Futura, system-ui, sans-serif';
    g.lineWidth = 5; g.strokeStyle = 'rgba(40,20,60,0.7)'; g.strokeText('PALM CITY', vw / 2, F.y - 26);
    g.fillStyle = '#ffd45c'; g.fillText('PALM CITY', vw / 2, F.y - 26);
    // places: painted plaques (paper + plum ink) instead of stroked text, deconflicted per MAPREDO.md
    const labels = [];
    for (const q of mapPOIs(this.world, sim)) {
      const [x, y] = toMap(F, q.p[0], q.p[1]);
      const col = q.kind === 'door' ? '#ff5c9a' : q.kind === 'job' ? '#6ee2ff' : q.kind === 'target' ? '#6ee2ff' : '#fff1d8';
      if (q.kind === 'door' || q.kind === 'job' || q.kind === 'target') {
        const r = q.kind === 'target' ? 6 + Math.sin(time * 5) * 1.5 : 4;
        g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
      }
      g.font = `800 ${q.kind === 'job' ? 9 : 11}px "Avenir Next", Futura, system-ui, sans-serif`;
      const [odx, ody] = labelOff(q.name);
      labels.push({ name: q.name, kind: q.kind, col, tx: x + odx, ty: (q.kind === 'door' || q.kind === 'job' || q.kind === 'target' ? y - 13 : y) + ody, pw: g.measureText(q.name).width / 2 + 5, ph: q.kind === 'job' ? 8 : 9 });
    }
    // resolve plaque collisions vertically (the dots stay put; the plaques slide), then keep every
    // plaque inside the frame — event targets land on top of place labels otherwise
    for (let pass = 0; pass < 4; pass++) for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i], b = labels[j];
      const ox = a.pw + b.pw + 2 - Math.abs(a.tx - b.tx), oy = a.ph + b.ph + 2 - Math.abs(a.ty - b.ty);
      if (ox > 0 && oy > 0) { const push = oy / 2 + 0.5, s = a.ty <= b.ty ? 1 : -1; a.ty -= push * s; b.ty += push * s; }
    }
    for (const lb of labels) {
      lb.tx = Math.max(F.x + lb.pw + 1, Math.min(F.x + F.w - lb.pw - 1, lb.tx));
      lb.ty = Math.max(F.y + lb.ph + 1, Math.min(F.y + F.h - lb.ph - 1, lb.ty));
      g.font = `800 ${lb.kind === 'job' ? 9 : 11}px "Avenir Next", Futura, system-ui, sans-serif`;
      g.beginPath(); g.roundRect(lb.tx - lb.pw, lb.ty - lb.ph, lb.pw * 2, lb.ph * 2, 4);
      g.fillStyle = 'rgba(246,230,196,0.94)'; g.fill();
      g.lineWidth = 1.4; g.strokeStyle = lb.kind === 'place' || lb.kind === 'area' ? INK : lb.col; g.stroke();
      g.fillStyle = INK; g.fillText(lb.name, lb.tx, lb.ty + 0.5);
    }
    // cops, when you're wanted
    if (sim.stars > 0) for (const c of sim.cars) if (c.driver === 'police') { const [x, y] = toMap(F, c.x, c.y); g.fillStyle = Math.floor(time * 5) % 2 ? '#ff2438' : '#369eff'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    // you
    const m = playerMarker(F, sim), pulse = 1 + 0.15 * Math.sin(time * 6);
    g.save(); g.translate(m.x, m.y);
    g.fillStyle = 'rgba(255,212,92,0.3)'; g.beginPath(); g.arc(0, 0, 13 * pulse, 0, 7); g.fill();
    g.rotate(m.h);
    g.fillStyle = '#ffd45c'; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(10, 0); g.lineTo(-7, -7); g.lineTo(-3, 0); g.lineTo(-7, 7); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.font = '800 10px "Avenir Next", Futura, system-ui, sans-serif'; g.fillStyle = '#ffd45c';
    g.lineWidth = 3; g.strokeStyle = 'rgba(33,15,46,0.85)'; g.strokeText('YOU', m.x, m.y + 17); g.fillText('YOU', m.x, m.y + 17);
  }
}
