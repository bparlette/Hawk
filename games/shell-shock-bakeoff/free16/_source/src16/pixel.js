  // =====================================================================================================
  // ---------- F: 16-BIT PIXEL PIPELINE (new): low-res framebuffer, pixel textures, grid-true sprite sampling ----------
  // =====================================================================================================
  // The whole 3D scene renders into a small drawing buffer (~400 px tall) that the browser upscales by a whole number with
  // nearest-neighbour (CSS image-rendering: pixelated). One framebuffer pixel = one 16-bit game pixel at the hero's depth.
  const PIX = { n: 1, w: 384, h: 224, up: 1 };
  // city textures -> their 16-bit pixel versions (tools/pxtex.py: area-downscaled to ~0.05 m per texel, palette-quantized PNGs)
  const PXTEX = { "tex/asphalt.jpg": "px/asphalt.png", "tex/sidewalk.jpg": "px/sidewalk.png", "tex/roof.jpg": "px/roof.png", "tex/facade_a.jpg": "px/facade_a.png",
    "tex/facade_b.jpg": "px/facade_b.png", "tex/mural_pizza.jpg": "px/mural_pizza.png", "tex/mural_gator.jpg": "px/mural_gator.png", "tex/props2.webp": "px/props2.png",
    "tex/skyline.jpg": "px/skyline.png", "tex/taxi_side.webp": "px/taxi_side.png", "tex/van_side.webp": "px/van_side.png" };
  function pxFilter(t) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; t.generateMipmaps = true; t.anisotropy = 1; return t; }
  // canvas-drawn art (neon signs, tags, awnings, covers, blob shadows) -> 1/4 size, posterized colour + stepped alpha
  const PIXCANVAS = { on: true };
  function pixelize(src) {
    const w = Math.max(8, Math.round(src.width / 4)), h = Math.max(8, Math.round(src.height / 4));
    let c = src;
    while (c.width / 2 >= w * 1.01 && c.height / 2 >= h * 1.01) { // halve step by step: a clean area average, no aliasing
      const d = document.createElement("canvas"); d.width = Math.round(c.width / 2); d.height = Math.round(c.height / 2);
      const g = d.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(c, 0, 0, d.width, d.height); c = d;
    }
    const o = document.createElement("canvas"); o.width = w; o.height = h;
    const g = o.getContext("2d", { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(c, 0, 0, w, h);
    const im = g.getImageData(0, 0, w, h), d = im.data, L = 7; // 8 levels per channel
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a < 40) { d[i + 3] = 0; continue; }
      const k = a / 255; // un-premultiply-ish so dim edges keep their hue
      for (let j = 0; j < 3; j++) d[i + j] = Math.round(Math.round((d[i + j] / 255) * L) / L * 255);
      d[i + 3] = a > 200 ? 255 : a > 120 ? 170 : 85; void k;
    }
    g.putImageData(im, 0, 0); return o;
  }
  // sprite sheets: the 16-bit art is blocky at ~2.44 sheet px per art pixel; each blob (frame cluster) has its own grid phase.
  // gridFor() snaps a frame rect to whole art pixels so every framebuffer pixel samples exactly one art pixel centre.
  const PXGRID = null;
  function gridFor(src, fr) {
    const G = PXGRID && PXGRID[src];
    const [fx, fy, fw, fh] = fr;
    if (!G) return { B: 1, px: 0, py: 0, i0: fx, j0: fy, nw: fw, nh: fh, iw: 0, ih: 0 };
    const cx = fx + fw / 2, cy = fy + fh / 2; let bl = null, bd = 1e9;
    for (const b of G.blobs) {
      const dx = Math.max(b[0] - cx, 0, cx - b[2]), dy = Math.max(b[1] - cy, 0, cy - b[3]), d = dx + dy;
      if (d < bd) { bd = d; bl = b; if (d === 0) break; }
    }
    const B = G.B, px = bl ? bl[4] : 0, py = bl ? bl[5] : 0;
    const i0 = Math.round((fx - px) / B), j0 = Math.round((fy - py) / B);
    const nw = Math.max(1, Math.round((fx + fw - px) / B) - i0), nh = Math.max(1, Math.round((fy + fh - py) / B) - j0);
    return { B, px, py, i0, j0, nw, nh, iw: G.w, ih: G.h };
  }
