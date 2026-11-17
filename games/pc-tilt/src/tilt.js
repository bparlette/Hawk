// tilt.js — TILT SAMPLE (bake-off page, Nov 17): a tilted / perspective camera for the
// overworld, built the cheap way on purpose so the owner can judge the angle before anyone
// pays for real 3D or facade art.
//   - The world renders ONCE, flat, into an offscreen frame at a wider + taller view
//     (840x1400 view units) and a pulled-back zoom (x0.65). No sim, input or asset changes.
//   - The frame is composited onto the screen in horizontal strips through a projective
//     ground-plane mapping: screen row -> ground offset g = rK/(1-r), r = (anchor-y)/C.
//     Roads converge toward the horizon, the foreground swells, the far field compresses
//     and is finished with a warm distance-fog gradient + a painted sky band above the
//     horizon. Sprites ride the same strips (billboards by construction — scale comes from
//     the strip magnification at their row), painter order is the flat render's own, and
//     buildings stay roofs: NO new art.
//   - HUD, help panels, the map and the news PiP are drawn after the composite, flat,
//     exactly as before. Siege interiors and the Open Road chase cam keep their own
//     cameras — the tilt bypasses both (main.js decides per frame).
//   ?tilt=0 starts flat. The TILT pill (top centre) or the T key flips it live.

const TW = 840, TH = 1400;        // offscreen view size (CSS units): 2x wide, ~1.6x tall
export const TILT_SRC_ZOOM = 0.65;
const K = 230;                    // projective constant (source px): smaller = stronger tilt
const STRIP = 3;                  // composite strip height (CSS px)

const lerp = (a, b, u) => a + (b - a) * u;
const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const css = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function layer(w, h) { const c = document.createElement('canvas'); c.width = Math.max(2, w); c.height = Math.max(2, h); return c; }

export class TiltView {
  constructor(Q) {
    this.on = !(Q && Q.get('tilt') === '0');       // the sample page opens TILTED; ?tilt=0 opens flat
    this.dpr = 0;
    this.msComp = 0;                               // EMA of the composite cost (ms) — proof/debug
    this.frames = 0;
    const b = this.btn = document.createElement('button');
    b.type = 'button';
    b.title = 'toggle the tilted camera (T)';
    b.style.cssText = 'position:fixed;top:calc(8px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:1200;padding:7px 16px;border-radius:999px;border:1px solid rgba(255,241,216,.55);background:rgba(20,12,38,.72);color:#fff1d8;font:700 13px/1 -apple-system,system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent';
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.setOn(!this.on); });
    document.body.appendChild(b);
    addEventListener('keydown', (e) => { if (e.code === 'KeyT') this.setOn(!this.on); });
    this.syncLabel();
  }

  setOn(v) { this.on = !!v; this.syncLabel(); }
  syncLabel() { this.btn.textContent = this.on ? 'TILT ON' : 'TILT OFF'; }

  // The offscreen buffer set, mirroring Renderer.resize()'s pyramid at the tilt view size.
  ensure(dpr) {
    if (this.cv && this.dpr === dpr) return;
    this.dpr = dpr;
    const w = Math.round(TW * dpr), h = Math.round(TH * dpr);
    this.cv = layer(w, h);
    this.octx = this.cv.getContext('2d');
    this.shadowCv = layer(w, h);
    this.lightCv = layer(Math.ceil(w / 2), Math.ceil(h / 2));
    this.bloomA = layer(Math.ceil(w / 4), Math.ceil(h / 4));
    this.bloomB = layer(Math.ceil(w / 8), Math.ceil(h / 8));
  }

  // Point the renderer at the offscreen frame (the chase-cam swap pattern); returns the
  // saved fields for end() to restore.
  begin(renderer) {
    this.ensure(renderer.dpr);
    const r = renderer;
    const saved = { ctx: r.ctx, vw: r.vw, vh: r.vh, fw: r.fw, fh: r.fh, dpr: r.dpr, shadowCv: r.shadowCv, lightCv: r.lightCv, bloomA: r.bloomA, bloomB: r.bloomB };
    r.ctx = this.octx; r.vw = TW; r.vh = TH; r.fw = this.cv.width; r.fh = this.cv.height;
    r.shadowCv = this.shadowCv; r.lightCv = this.lightCv; r.bloomA = this.bloomA; r.bloomB = this.bloomB;
    return saved;
  }

  end(renderer, saved, t) {
    const r = renderer;
    r.ctx = saved.ctx; r.vw = saved.vw; r.vh = saved.vh; r.fw = saved.fw; r.fh = saved.fh;
    r.shadowCv = saved.shadowCv; r.lightCv = saved.lightCv; r.bloomA = saved.bloomA; r.bloomB = saved.bloomB;
    const t0 = performance.now();
    this.composite(saved.ctx, saved.vw, saved.vh, saved.dpr, t);
    this.msComp = this.msComp * 0.92 + (performance.now() - t0) * 0.08;
    this.frames++;
  }

  // Strips: each screen row band samples the source band the projective map assigns it,
  // stretched horizontally by the same magnification (clamped at the frame's full width —
  // the far field then stretches gently sideways under the fog instead of gapping).
  composite(ctx, vw, vh, dpr, t) {
    const horizonY = Math.round(vh * 0.15), anchorY = vh * 0.60, C = anchorY - horizonY, SF = TH / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    const skyTop = mix3([116, 164, 216], [40, 36, 88], t), haze = mix3([255, 214, 164], [172, 160, 208], t);
    let gr = ctx.createLinearGradient(0, 0, 0, horizonY + 2);
    gr.addColorStop(0, css(skyTop, 1)); gr.addColorStop(1, css(haze, 1));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, vw, horizonY + 2);
    const syAt = (y) => {
      const r = (anchorY - y) / C;
      if (r > 0.995) return 0;
      const sy = SF - r * K / (1 - r);
      return sy < 0 ? 0 : sy > TH - 1 ? TH - 1 : sy;
    };
    const mAt = (g) => C * K / ((g + K) * (g + K));       // screen px per source px at ground offset g
    for (let y = horizonY; y < vh; y += STRIP) {
      const y1 = Math.min(vh, y + STRIP);
      let sy0 = syAt(y), sy1 = syAt(y1);
      if (sy1 - sy0 < 0.75) sy1 = sy0 + 0.75;              // far-field sliver floor: the last
      if (sy0 >= TH - 0.75) break;                        // ground smears into the fog, as a
      if (sy1 > TH) sy1 = TH;                             // horizon should
      const m = mAt(SF - (sy0 + sy1) / 2);
      let sw = vw / m; if (sw > TW) sw = TW;
      const sx = (TW - sw) / 2;
      ctx.drawImage(this.cv, sx * dpr, sy0 * dpr, sw * dpr, (sy1 - sy0) * dpr, 0, y, vw, (y1 - y) + 0.7);
    }
    // distance fog, SHAPED TO THE SEAM: the projective map runs out of source rows at
    // seamY (where sy first clamps to the frame's top edge); above it the far field is
    // smeared slivers, so the fog sits near-opaque from the horizon past the seam, then
    // thins through the true-perspective band and is gone by mid-frame (player at 0.60).
    const seamR = (TH / 2) / (TH / 2 + K), seamY = Math.max(horizonY + 8, anchorY - seamR * C);
    const fogBot = vh * 0.58, seamU = Math.min(0.9, (seamY - horizonY) / (fogBot - horizonY));
    gr = ctx.createLinearGradient(0, horizonY, 0, fogBot);
    gr.addColorStop(0, css(haze, 0.98)); gr.addColorStop(seamU, css(haze, 0.88)); gr.addColorStop(1, css(haze, 0));
    ctx.fillStyle = gr; ctx.fillRect(0, horizonY, vw, fogBot - horizonY + 2);
  }
}
