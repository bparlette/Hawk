// example_bench.js — the SHAPE every delivered static prop / kit piece must follow.
// No imports. Write placed world-space geometry into `out`; the game merges it into its chunk meshes (3 draw calls per chunk total).
export const META = { id: 'bench_slat', kind: 'prop', footprint: [1.8, 0.6], height: 0.9 };

export function buildBench(K, out, x, z, ang = 0, opts = {}) {
  const { THREE, place } = K, wood = opts.wood || '#9a6a44', iron = opts.iron || '#2c322e';
  const P = (g, lx, ly, lz) => { g.translate(lx, ly, lz); return place(g, x, 0.16, z, ang); }; // 0.16 = kerb / pavement height
  for (const [ly, lz, rx] of [[0.45, 0.0, 0], [0.45, 0.12, 0], [0.45, -0.12, 0]]) out.solid(P(new THREE.BoxGeometry(1.8, 0.05, 0.1), 0, ly, lz), wood);
  for (const ly of [0.62, 0.78]) out.solid(P(new THREE.BoxGeometry(1.8, 0.1, 0.05), 0, ly, -0.22), wood);
  for (const s of [-1, 1]) { out.solid(P(new THREE.BoxGeometry(0.06, 0.45, 0.42), s * 0.8, 0.22, 0), iron); out.solid(P(new THREE.BoxGeometry(0.06, 0.45, 0.05), s * 0.8, 0.7, -0.22), iron); }
  // a painted back-plate via the kit atlas (draw it once per module, reuse it for every instance)
  const atlas = buildBench.atlas || (buildBench.atlas = K.makeAtlas({ plate: { w: 256, h: 64, draw(c, w, h) { c.fillStyle = '#2f5a3a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f2e6c8'; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#f2e6c8'; c.font = 'bold 30px Georgia, serif'; c.textAlign = 'center'; c.fillText('HARBOR PARK', w / 2, 43); } } }));
  out.decal(P(new THREE.PlaneGeometry(0.9, 0.2), 0, 0.7, -0.19), atlas, 'plate');
  out.coll({ x, z, r: 0.7 });
  return META;
}
