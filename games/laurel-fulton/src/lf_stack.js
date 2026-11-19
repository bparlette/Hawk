// lf_stack.js — SPRITE-STACKED cars: the fleet, rebuilt with height.
//
// The baked fleet sheets (assets/cars/*.webp) are Blender renders shot
// straight down: at any heading the car is a flat cutout with no side and
// no height — it reads as spinning on a lazy susan. A stack fixes that:
// the car is cut into horizontal cross-section layers (one per 0.05 m,
// rasterised by tools/build_stacks.py from the SAME parametric body data
// bake_fleet.py lofts — plan / top / cabin / paint splits), and at draw
// time the layers are piled bottom-to-top, each rotated by the heading
// and shifted a little up-screen. The car turns to ANY angle (no 32-frame
// quantising) and the greenhouse visibly rises over the hood.
//
// Integration is one hook: Renderer.drawCar (src/lf_render.js) routes a
// car here when a stack exists for its model; otherwise the baked sheet
// draws exactly as before. Shadow pass + colour pass mirror the sheet
// path's contract (incl. the L3 airborne behaviour: body lifts and
// looms, shadow stays on the road and fades).
//
// AUDIT FOLD-IN (Nov 19, Neon's SpriteStacker 3D, ~/workspace/sprite-stacker-audit/):
// TAKEN — computeStackProjection() + resolveYawDegrees() (below, ported from
//   its stackRenderer.ts): the per-layer lift is now DERIVED from a camera
//   pitch instead of a hand-tuned constant. TAKEN — extractShadowFootprint()'s
//   two-level shadow: chassis UMBRA (bottom layers) under a wider PENUMBRA
//   (full footprint incl. roof/spoiler overhang), precomputed per car in
//   CarStack. TAKEN as format — its VoxelModel layers[z] top-down grids are
//   the same authoring target as our layer sheets (ours carry RGBA instead
//   of palette indices; no conversion needed).
// AVOIDED — its renderStackToBuffer() per-pixel rasteriser (~13 ms/frame for
//   ONE car): this runtime blits layers with drawImage, native cost, so a
//   convoy + traffic scene holds frame budget. AVOIDED — its yaw labels
//   (its yaw 0 renders the REAR): headings here are Scaggsville's own,
//   c.h with 0 = nose +x (east), exactly as the fleet bake defines.
// DIVERGENCE, deliberate — Neon squashes footprints by sin(pitch); our
//   ground plane is drawn at pitch 90 (true top-down roads), so squashing
//   the cars alone would slide them off the road grid. squashY stays 1
//   here; only zStep (the height axis) is taken from the projection.

// Ported from SpriteStacker 3D src/engine/stackRenderer.ts (audit §6 lift list).
export function computeStackProjection(pitchDeg, layerSpread) {
  const clampedPitch = Math.max(0, Math.min(90, pitchDeg));
  const pitchRad = clampedPitch * Math.PI / 180;
  const squashY = Math.max(0.05, Math.sin(pitchRad));
  const zStep = Math.cos(pitchRad) * 1.15 * layerSpread;   // screen px of rise per raster px of height
  return { squashY, zStep, cosPitch: Math.cos(pitchRad), clampedPitch };
}
export function resolveYawDegrees(yawDeg, mode) {          // ported; Scaggsville drives 'smooth' (canvas rotate is continuous)
  const norm = ((yawDeg % 360) + 360) % 360;
  if (mode === 'snap8') return (Math.round(norm / 45) * 45) % 360;
  if (mode === 'snap16') return (Math.round(norm / 22.5) * 22.5) % 360;
  return norm;
}
// The stack's effective camera: pitch 55° at spread 1.0 → zStep ≈ 0.66 raster px
// per layer-px. Per car, CarStack converts that to world units (wu per raster
// px = meta.length / meta.lw ≈ 0.5), giving ≈ 0.33 wu of rise per 0.05 m layer
// — the height the v1 hand-tuned lift produced, now derived, and tunable in
// one place. The west lean (liftX) is this game's sun side, ratio kept from v1.
export const STACK_PITCH = 55, STACK_SPREAD = 1.0;
export const STACK_PROJECTION = computeStackProjection(STACK_PITCH, STACK_SPREAD);
const LEAN = 0.294;   // liftX / liftY: a touch west, like the sun side

export class CarStack {
  constructor(img, meta) {
    this.meta = meta;
    const cols = meta.cols, rows = Math.ceil(meta.layers / cols);
    const fw = img.width / cols, fh = img.height / rows;
    this.layers = [];
    for (let i = 0; i < meta.layers; i++) {
      const cv = document.createElement('canvas'); cv.width = fw; cv.height = fh;
      cv.getContext('2d').drawImage(img, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh, 0, 0, fw, fh);
      this.layers.push(cv);
    }
    const wuPerPx = meta.length / meta.lw;
    this.liftY = -(STACK_PROJECTION.zStep * wuPerPx);
    this.liftX = this.liftY * LEAN;
    // Two-level ground shadow (Neon extractShadowFootprint, audit §2): level 2
    // UMBRA = any voxel in the bottom layers (the chassis, z ≤ 3 layers up);
    // level 1 PENUMBRA = any voxel at all (roof / spoiler overhang). Both are
    // precomputed ONCE here as filled silhouettes — per frame they cost one
    // rotated drawImage each, same as the old single-level shadow.
    const footprint = (upto) => {
      const cv = document.createElement('canvas'); cv.width = fw; cv.height = fh;
      const cg = cv.getContext('2d');
      for (let i = 0; i < Math.min(upto, this.layers.length); i++) cg.drawImage(this.layers[i], 0, 0);
      cg.globalCompositeOperation = 'source-in'; cg.fillStyle = '#16122b'; cg.fillRect(0, 0, fw, fh);
      return cv;
    };
    this.silUmbra = footprint(4);            // layers 0..3: the chassis contact patch
    this.silPen = footprint(meta.layers);    // every layer: the full overhang footprint
    this.sil = this.silUmbra;                // back-compat alias
  }
}

export function drawStackCar(R, g, c, st, which, jx, jy) {
  const L = st.meta.length, Wd = st.meta.width;
  if (which === 'shadow') {
    g.save();
    let ox = c.x + 2.2, oy = c.y - 1.2;                       // the bake's sun (SUN = 0.8,-0.3): shadow sits east-north of the body
    if (c.z > 0) { g.globalAlpha *= Math.max(0.3, 1 - c.z / 50); ox += c.z * 0.8; oy += c.z * 0.25; }   // airborne: shadow stays down, sliding down-sun (sheet parity)
    g.translate(ox, oy); g.rotate(c.h);
    const a = g.globalAlpha;
    g.globalAlpha = a * 0.45; g.drawImage(st.silPen, -L / 2, -Wd / 2, L, Wd);   // penumbra: the wide, soft overhang level
    g.globalAlpha = a; g.drawImage(st.silUmbra, -L / 2, -Wd / 2, L, Wd);        // umbra: the dense chassis contact level
    g.restore(); return;
  }
  // colour: the pile itself. Bass shake / bump jolt arrive as jx, jy (computed by drawCar).
  let bx = c.x + jx, by = c.y + jy, k = 1;
  if (c.z > 0) { bx -= c.z * 0.25; by -= c.z * 1.5; k = 1 + c.z * 0.012; }   // L3 airborne presentation, sheet parity
  g.save(); g.translate(bx, by); if (k !== 1) g.scale(k, k);
  for (let i = 0; i < st.layers.length; i++) {
    g.save(); g.translate(st.liftX * i, st.liftY * i); g.rotate(c.h);
    g.drawImage(st.layers[i], -L / 2, -Wd / 2, L, Wd);
    g.restore();
  }
  g.restore();
}
