// build_shell_layout.mjs — generate shell_layout.json: the extension shell's facades, palms and the
// seam connector road, from shell.json (the extracted grid + road traces). Deterministic (seeded):
// re-running reproduces the same layout byte for byte. Placement rules:
//   * buildings front the three traced roads, set back from the road edge, footprints fully on
//     land cells, never overlapping another road's corridor or an already-placed footprint;
//   * zones by road: MacArthur west end = downtown towers, mid = offices; Port Boulevard =
//     low warehouses; Venetian = small island houses; plus a downtown infill scan on the
//     western landmass for blocks that don't front the causeway;
//   * palms line the roads on land just off the shoulder;
//   * the seam connector joins the MacArthur landfall (-245, 1275) to the core loop's west
//     side (x = 372, y = 1275) across the core's open grass strip — the one drive connection.
// Usage: node tools/build_shell_layout.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32 } from '../src/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shell = JSON.parse(fs.readFileSync(path.join(ROOT, 'shell.json')));
const [OX, OY] = shell.origin, CS = shell.cellSize;
const cls = (x, y) => {
  const c = Math.floor((x - OX) / CS), r = Math.floor((y - OY) / CS);
  if (c < 0 || r < 0 || c >= shell.cols || r >= shell.rows) return -1;
  return shell.grid[r].charCodeAt(c) - 48;
};
const segs = [];
for (const r of shell.roads) for (let i = 0; i + 1 < r.points.length; i++)
  segs.push({ x0: r.points[i][0], y0: r.points[i][1], x1: r.points[i + 1][0], y1: r.points[i + 1][1], hw: r.width / 2, name: r.name });
function roadDist(x, y) {
  let best = 1e9;
  for (const s of segs) {
    const vx = s.x1 - s.x0, vy = s.y1 - s.y0, len2 = vx * vx + vy * vy;
    let t = ((x - s.x0) * vx + (y - s.y0) * vy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    best = Math.min(best, Math.hypot(s.x0 + vx * t - x, s.y0 + vy * t - y) - s.hw);
  }
  return best;   // clearance beyond the nearest road's edge
}
const CONNECTOR = { name: 'seam_connector', width: 48, points: [[-245, 1275], [60, 1275], [372, 1275]] };

const rnd = mulberry32(20261116);
const buildings = [], palms = [];
const overlaps = (x, y, w, d, pad) => buildings.some(b => x < b.x + b.w + pad && x + w + pad > b.x && y < b.y + b.d + pad && y + d + pad > b.y);
const rectOnLand = (x, y, w, d) => {
  for (const [px, py] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + d - 4], [x + w - 4, y + d - 4],
                          [x + w / 2, y + 4], [x + w / 2, y + d - 4], [x + 4, y + d / 2], [x + w - 4, y + d / 2], [x + w / 2, y + d / 2]])
    if (cls(px, py) !== 1) return false;
  return true;
};
let seq = 0;
function place(cx, cy, kind, w, d, h) {
  const x = Math.round(cx - w / 2), y = Math.round(cy - d / 2);
  if (!rectOnLand(x, y, w, d) || overlaps(x, y, w, d, 16)) return false;
  if (roadDist(cx, cy) < Math.max(w, d) / 2 + 6) return false;   // centre clear of every road corridor
  buildings.push({ id: 'sh' + String(seq).padStart(3, '0'), kind, x, y, w, d, h, tone: (rnd() * 4) | 0, seed: 1000 + seq * 77 });
  seq++;
  return true;
}

// Frontage: walk each road, try both sides at a setback, sizes by zone.
const ZONES = {
  macarthur_causeway: (x) => x < -2850
    ? { kind: 'tower', w: [100, 170], d: [100, 170], h: [70, 150], setback: 30 }
    : { kind: 'office', w: [80, 130], d: [80, 130], h: [35, 80], setback: 26 },
  port_boulevard: () => ({ kind: 'warehouse', w: [130, 210], d: [60, 100], h: [16, 28], setback: 30 }),
  venetian_causeway: () => ({ kind: 'house', w: [42, 66], d: [42, 66], h: [10, 18], setback: 16 }),
};
for (const road of shell.roads) {
  const zone = ZONES[road.name], hw = road.width / 2;
  const pts = road.points;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    for (let s = 60; s < L - 30; s += 104) {
      const z = zone(x0 + ux * s);
      for (const side of (rnd() < 0.5 ? [-1, 1] : [1, -1])) {   // both sides, independently
        const w = z.w[0] + rnd() * (z.w[1] - z.w[0]), d = z.d[0] + rnd() * (z.d[1] - z.d[0]);
        const off = hw + z.setback + Math.max(w, d) / 2;
        place(x0 + ux * s - uy * side * off, y0 + uy * s + ux * side * off, z.kind, w, d, z.h[0] + rnd() * (z.h[1] - z.h[0]));
      }
    }
  }
}
// Downtown infill: blocks on the western landmass that don't front a road.
let infill = 0;
for (let gx = -4360; gx < -3250 && infill < 14; gx += 168) {
  for (let gy = 130; gy < 1560 && infill < 14; gy += 168) {
    if (roadDist(gx, gy) < 120) continue;
    const kind = rnd() < 0.45 ? 'tower' : 'office';
    const w = 100 + rnd() * 60, d = 100 + rnd() * 60;
    if (place(gx, gy, kind, w, d, kind === 'tower' ? 80 + rnd() * 70 : 40 + rnd() * 40)) infill++;
  }
}
// Palms: along each road, alternating sides, on land just off the shoulder.
for (const road of shell.roads) {
  const hw = road.width / 2, pts = road.points;
  let side = 1;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    for (let s = 40; s < L; s += 95) {
      side = -side;
      const x = Math.round(x0 + ux * s - uy * side * (hw + 13)), y = Math.round(y0 + uy * s + ux * side * (hw + 13));
      const c = cls(x, y);
      if (c !== 1 && c !== 2) continue;
      if (buildings.some(b => x > b.x - 8 && x < b.x + b.w + 8 && y > b.y - 8 && y < b.y + b.d + 8)) continue;
      palms.push([x, y]);
    }
  }
}
const out = { _doc: 'Generated by tools/build_shell_layout.mjs from shell.json — do not hand-edit; re-run the tool.', roads: [CONNECTOR], buildings, palms };
fs.writeFileSync(path.join(ROOT, 'shell_layout.json'), JSON.stringify(out, null, 1));
const byKind = {};
for (const b of buildings) byKind[b.kind] = (byKind[b.kind] || 0) + 1;
console.log(`shell_layout.json: ${buildings.length} buildings ${JSON.stringify(byKind)}, ${palms.length} palms, 1 connector road`);
