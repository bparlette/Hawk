// The spreading paint. The plaza begins as a bare sheet: everything on it is a pencil
// sketch until she walks there. This module keeps the memory of where she has been as
// two canvases laid over the plaza in world space — a settled layer, where every pass
// of her feet lays a soft round wash that never dries back, and a wet layer holding
// only the last few seconds of stamps, each one bloomed wider than it will settle, the
// way a fresh watercolour edge feathers out into damp paper and then stops. The finish
// pass (finish.js) reads both through the shared uniforms and mixes sketch against
// painted by them, pixel by pixel, from the pixel's own world position — so the ground,
// the fountain, the stalls and the trees all colour in together as the frontier passes.
//
// The settled layer is kept in sessionStorage (the Paint toggle reloads the page, and
// her painting must survive that; a new tab is a new sheet). ?fresh starts clean.
import * as THREE from 'three';

export const WALK_HALF = 21; // the mask covers -21..21 m in x and z: the plaza and its houses
const SETTLED_RES = 512;
const WET_RES = 256;
const STAMP_R = 3.2; // settled radius of one stamp, metres
export const STAMP_EVERY = 0.45; // main.js lays a stamp per this much travel
const WET_LIFE = 3.6; // seconds a stamp stays wet
const WET_GROW = 1.38; // a fresh stamp blooms to this × its settled radius, then settles back
const STORE_KEY = 'wcwalk-mask-v1';

export function createWalkMask(shared, q) {
  const settled = document.createElement('canvas');
  settled.width = settled.height = SETTLED_RES;
  const sctx = settled.getContext('2d');
  sctx.fillStyle = '#000';
  sctx.fillRect(0, 0, SETTLED_RES, SETTLED_RES);

  const wet = document.createElement('canvas');
  wet.width = wet.height = WET_RES;
  const wctx = wet.getContext('2d');
  wctx.fillStyle = '#000';
  wctx.fillRect(0, 0, WET_RES, WET_RES);

  const settledTex = new THREE.CanvasTexture(settled);
  settledTex.flipY = false; // uv (0,0) is canvas (0,0): the shader's mask uv maps straight on
  settledTex.minFilter = settledTex.magFilter = THREE.LinearFilter;
  settledTex.wrapS = settledTex.wrapT = THREE.ClampToEdgeWrapping;
  settledTex.generateMipmaps = false;
  const wetTex = new THREE.CanvasTexture(wet);
  wetTex.flipY = false;
  wetTex.minFilter = wetTex.magFilter = THREE.LinearFilter;
  wetTex.wrapS = wetTex.wrapT = THREE.ClampToEdgeWrapping;
  wetTex.generateMipmaps = false;

  shared.tWalkSettled = { value: settledTex };
  shared.tWalkWet = { value: wetTex };
  shared.uWalkHalf = { value: WALK_HALF };

  const toPx = (v, res) => ((v + WALK_HALF) / (2 * WALK_HALF)) * res;
  const rPx = (r, res) => (r / (2 * WALK_HALF)) * res;

  function disc(ctx, res, x, z, r, peak) {
    const cx = toPx(x, res), cy = toPx(z, res), rr = rPx(r, res);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, `rgba(255,255,255,${peak})`);
    g.addColorStop(0.55, `rgba(255,255,255,${peak * 0.88})`);
    g.addColorStop(0.8, `rgba(255,255,255,${peak * 0.45})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  const wetStamps = []; // {x, z, t} — performance.now() stamps, youngest last
  let stampCount = 0;
  let dirty = false; // settled layer changed since the last session save
  let lastSave = 0;
  let wetDirty = true; // wet layer needs a redraw (it starts blank but flagged once)

  function save(now) {
    try {
      sessionStorage.setItem(STORE_KEY, settled.toDataURL('image/png'));
      dirty = false;
      lastSave = now;
    } catch { /* private mode / quota: the painting just won't survive the toggle */ }
  }

  // restore the settled layer from the session (the toggle's reload lands here)
  if (!q.has('fresh')) {
    try {
      const url = sessionStorage.getItem(STORE_KEY);
      if (url) {
        const img = new Image();
        img.onload = () => {
          sctx.globalCompositeOperation = 'source-over';
          sctx.drawImage(img, 0, 0, SETTLED_RES, SETTLED_RES);
          settledTex.needsUpdate = true;
        };
        img.src = url;
      }
    } catch { /* no session store: a fresh sheet every load */ }
  }
  addEventListener('pagehide', () => { if (dirty) save(performance.now()); });

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  return {
    stamp(x, z, now = performance.now()) {
      sctx.globalCompositeOperation = 'lighter'; // overlapping washes add, and clamp at full
      disc(sctx, SETTLED_RES, x, z, STAMP_R, 1.0);
      settledTex.needsUpdate = true;
      wetStamps.push({ x, z, t: now });
      stampCount++;
      dirty = true;
    },
    // redraw the wet layer for this instant: fresh stamps stand bloomed past their
    // settled edge and shrink back onto it as they dry, fading as they go.
    update(now = performance.now()) {
      while (wetStamps.length && now - wetStamps[0].t > WET_LIFE * 1000) wetStamps.shift();
      if (wetStamps.length || wetDirty) {
        wctx.globalCompositeOperation = 'source-over';
        wctx.fillStyle = '#000';
        wctx.fillRect(0, 0, WET_RES, WET_RES);
        wctx.globalCompositeOperation = 'lighter';
        for (const s of wetStamps) {
          const a = Math.min(1, (now - s.t) / (WET_LIFE * 1000));
          const grow = 1 + (WET_GROW - 1) * (1 - easeOut(a));
          disc(wctx, WET_RES, s.x, s.z, STAMP_R * grow, 0.8 * Math.pow(1 - a, 1.25));
        }
        wetTex.needsUpdate = true;
        wetDirty = wetStamps.length > 0;
      }
      if (dirty && now - lastSave > 2500) save(now);
    },
    get stampCount() { return stampCount; },
    // how much of the sheet is painted, 0..1 of the mask's whole extent (read off a
    // thumbnail of the settled layer; approximate, for the test hooks)
    coverage() {
      const th = document.createElement('canvas');
      th.width = th.height = 32;
      const tctx = th.getContext('2d', { willReadFrequently: true });
      tctx.drawImage(settled, 0, 0, 32, 32);
      const d = tctx.getImageData(0, 0, 32, 32).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i];
      return sum / (32 * 32 * 255);
    },
  };
}
