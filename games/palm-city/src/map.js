// map.js — the CITY MAP (task 5B). A MAP button under the wanted stars opens a full-screen map of
// the whole city, painted from layout.json in the game's own palette: every surface sampled from
// the world (the same surfaceAt the ground painter uses), buildings in their roof colours with the
// plum ink line, palms, the pier. Labelled places, the job vehicles, the active job's target, and a
// live marker for the player (position + facing). The map is LIVE: the game keeps running under it
// and the joystick still drives, so you can watch yourself move. Tap MAP / the X (or M) to close.
import { PLACES } from './jobs.js';
import { markers } from './activities.js';

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
  constructor(world) { this.world = world; this.cv = null; }

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

  draw(g, vw, vh, dpr, sim, time) {
    const F = mapFrame(vw, vh, this.world);
    if (!this.cv || this.key !== Math.round(F.w * 2) + 'x' + Math.round(F.h * 2)) this.build(F);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(24,12,40,0.9)'; g.fillRect(0, 0, vw, vh);
    // a paper edge round the painted city
    g.fillStyle = '#f6e6c4'; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.roundRect(F.x - 6, F.y - 6, F.w + 12, F.h + 12, 8); g.fill(); g.stroke();
    g.imageSmoothingEnabled = true;
    g.drawImage(this.cv, F.x, F.y, F.w, F.h);
    g.lineJoin = 'round';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 20px "Avenir Next", Futura, system-ui, sans-serif';
    g.lineWidth = 5; g.strokeStyle = 'rgba(40,20,60,0.7)'; g.strokeText('PALM CITY', vw / 2, F.y - 26);
    g.fillStyle = '#ffd45c'; g.fillText('PALM CITY', vw / 2, F.y - 26);
    // places
    for (const q of mapPOIs(this.world, sim)) {
      const [x, y] = toMap(F, q.p[0], q.p[1]);
      const col = q.kind === 'door' ? '#ff5c9a' : q.kind === 'job' ? '#6ee2ff' : q.kind === 'target' ? '#6ee2ff' : '#fff1d8';
      if (q.kind === 'door' || q.kind === 'job' || q.kind === 'target') {
        const r = q.kind === 'target' ? 6 + Math.sin(time * 5) * 1.5 : 4;
        g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
      }
      g.font = `800 ${q.kind === 'job' ? 9 : 11}px "Avenir Next", Futura, system-ui, sans-serif`;
      const ty = q.kind === 'door' || q.kind === 'job' || q.kind === 'target' ? y - 11 : y;
      g.lineWidth = 3.5; g.strokeStyle = 'rgba(33,15,46,0.85)'; g.strokeText(q.name, x, ty);
      g.fillStyle = col; g.fillText(q.name, x, ty);
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
