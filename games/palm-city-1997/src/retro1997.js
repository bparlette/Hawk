// retro1997.js — "1997 mode" bake-off post-pass. RENDER LAYER ONLY: the game
// renders exactly as before, but into an offscreen stage canvas; each frame the
// stage is squeezed through a tiny buffer (chunky pixels), a limited-palette
// posterize with a saturation lift, and a 4x4 Bayer ordered dither, then drawn
// back upscaled with smoothing OFF. The HUD is drawn by main.js onto the real
// canvas AFTER this flush, so text and touch controls stay crisp.
// No silent fallback: if the pass throws, flush() logs loudly, marks itself
// failed, and main.js falls back to drawing the stage unprocessed — the state
// is always visible on window.__retro1997 for verification.

const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

export class Retro1997 {
  // pixelW: internal buffer width in CSS px (view is 420 wide, so 420/pixelW
  // is the chunky pixel size on screen). levels: posterize steps per channel.
  constructor(pixelW = 168, levels = 6, sat = 1.18, dit = 0.4) {
    this.pixelW = pixelW;
    this.levels = levels;
    this.sat = sat;
    this.dit = dit;   // Bayer dither strength, fraction of one palette step
                      // (1.0 = full dither — read as halftone dots, too much;
                      //  0.4 keeps the sparkle without the dot-grid taking over)
    this.stage = document.createElement('canvas');
    this.stageCtx = this.stage.getContext('2d');
    this.low = document.createElement('canvas');
    this.lowCtx = this.low.getContext('2d', { willReadFrequently: true });
    this.failed = false;
    this.frames = 0;
    this.msAvg = 0;
    window.__retro1997 = this.state();
  }

  state() {
    return {
      active: !this.failed,
      pixelW: this.pixelW,
      pixelSize: +(420 / this.pixelW).toFixed(2),
      levels: this.levels,
      sat: this.sat,
      dit: this.dit,
      frames: this.frames,
      msAvg: +this.msAvg.toFixed(2),
      failed: this.failed,
    };
  }

  resize(w, h) {
    if (this.stage.width !== w || this.stage.height !== h) {
      this.stage.width = w; this.stage.height = h;
    }
    const lw = this.pixelW;
    const lh = Math.max(1, Math.round(this.pixelW * h / w));
    if (this.low.width !== lw || this.low.height !== lh) {
      this.low.width = lw; this.low.height = lh;
    }
  }

  // Draw the finished stage frame onto the visible canvas context, processed.
  flush(targetCtx) {
    const t0 = performance.now();
    try {
      const lw = this.low.width, lh = this.low.height;
      const lc = this.lowCtx;
      // 1) downscale the full-res stage into the tiny buffer
      lc.globalCompositeOperation = 'source-over';
      lc.globalAlpha = 1;
      lc.drawImage(this.stage, 0, 0, lw, lh);
      // 2) palette squeeze in place: saturation lift, Bayer dither, posterize
      const img = lc.getImageData(0, 0, lw, lh);
      const d = img.data;
      const steps = this.levels - 1;
      const sat = this.sat;
      for (let y = 0; y < lh; y++) {
        const brow = (y & 3) * 4;
        for (let x = 0; x < lw; x++) {
          const i = (y * lw + x) * 4;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          // dither offset in units of one quantization step, scaled by this.dit
          const dit = ((BAYER4[brow + (x & 3)] + 0.5) / 16 - 0.5) * this.dit;
          d[i]     = Math.round(Math.min(255, Math.max(0, (lum + (r - lum) * sat) / 255 * steps + dit))) * 255 / steps;
          d[i + 1] = Math.round(Math.min(255, Math.max(0, (lum + (g - lum) * sat) / 255 * steps + dit))) * 255 / steps;
          d[i + 2] = Math.round(Math.min(255, Math.max(0, (lum + (b - lum) * sat) / 255 * steps + dit))) * 255 / steps;
        }
      }
      lc.putImageData(img, 0, 0);
      // 3) upscale to the visible canvas with smoothing OFF = chunky pixels
      const tc = targetCtx;
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.globalCompositeOperation = 'source-over';
      tc.globalAlpha = 1;
      tc.imageSmoothingEnabled = false;
      tc.drawImage(this.low, 0, 0, tc.canvas.width, tc.canvas.height);
      tc.imageSmoothingEnabled = true;
      this.frames++;
      this.msAvg = this.msAvg * 0.95 + (performance.now() - t0) * 0.05;
      if ((this.frames & 63) === 0) window.__retro1997 = this.state();
    } catch (e) {
      this.failed = true;
      window.__retro1997 = this.state();
      console.error('[retro1997] post-pass FAILED — drawing stage unprocessed:', e);
      const tc = targetCtx;
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.globalCompositeOperation = 'source-over';
      tc.globalAlpha = 1;
      tc.drawImage(this.stage, 0, 0);
    }
  }
}
