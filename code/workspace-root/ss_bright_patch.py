P="/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/index.html"
s=open(P).read()
def rep(old,new,count=1):
    global s
    n=s.count(old); assert n==count,(n,old[:70]); s=s.replace(old,new)
# CSS: halve vignette, scanlines and inner-shadow darkening
rep("radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.5) 100%),","radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.25) 100%),")
rep("rgba(0,0,0,.18) var(--row) calc(var(--row) * 2)),","rgba(0,0,0,.09) var(--row) calc(var(--row) * 2)),")
rep("box-shadow: inset 0 0 28px 8px rgba(0,0,0,.7), inset 0 0 10px 2px rgba(0,0,0,.6), inset 0 0 4px 1px rgba(0,0,0,.9);",
    "box-shadow: inset 0 0 28px 8px rgba(0,0,0,.35), inset 0 0 10px 2px rgba(0,0,0,.3), inset 0 0 4px 1px rgba(0,0,0,.6);")
# exposure helper: pre-brightened copy of each photo/atlas, built once (pixel fallback where ctx.filter is unsupported)
rep("  const hueCache = {};\n  function ninjaSheet(type) {",
'''  // Exposure lift: a brightened copy of a photo or atlas sheet, built once and cached.
  const BG_EXPOSE = "brightness(1.3) contrast(1.05)", SPRITE_EXPOSE = "brightness(1.28) contrast(1.08)";
  const exposeCache = new WeakMap();
  function exposed(src, f) {
    const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    if (!w || !h) return src;
    let m = exposeCache.get(src); if (!m) exposeCache.set(src, (m = {}));
    if (m[f]) return m[f];
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d");
    try {
      g.filter = f;
      if (g.filter === f) g.drawImage(src, 0, 0);
      else { // no canvas filters (Safari): lift the pixels by hand
        g.drawImage(src, 0, 0);
        const b = parseFloat(f.match(/brightness\\(([\\d.]+)/)[1]), k = parseFloat(f.match(/contrast\\(([\\d.]+)/)[1]);
        const d = g.getImageData(0, 0, w, h), a = d.data;
        for (let i = 0; i < a.length; i += 4) for (let j = 0; j < 3; j++) a[i + j] = Math.max(0, Math.min(255, (a[i + j] * b - 128) * k + 128));
        g.putImageData(d, 0, 0);
      }
    } catch (_) { return (m[f] = src); }
    return (m[f] = c);
  }
  const hueCache = {};
  function ninjaSheet(type) {''')
rep("    ctx.drawImage(sheet, fx, fy, fw, fh, -w / 2, -h, w, h);",
    "    ctx.drawImage(exposed(sheet, SPRITE_EXPOSE), fx, fy, fw, fh, -w / 2, -h, w, h);")
rep("ctx.drawImage(hall, 0, 0, tw, H); ctx.restore(); }\n        else ctx.drawImage(hall, x, 0, tw, H);",
    "ctx.drawImage(exposed(hall, BG_EXPOSE), 0, 0, tw, H); ctx.restore(); }\n        else ctx.drawImage(exposed(hall, BG_EXPOSE), x, 0, tw, H);")
rep('ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.08; ctx.fillStyle = "#ff8a2a";',
    'ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.05; ctx.fillStyle = "#ff8a2a";')
rep('''      ctx.drawImage(B.far, Math.round(c0 * 0.5), 0, W, FLOOR_TOP, 0, 0, W, FLOOR_TOP);
      ctx.drawImage(B.main, c0, 0, W, H, 0, 0, W, H);''',
'''      ctx.drawImage(exposed(B.far, BG_EXPOSE), Math.round(c0 * 0.5), 0, W, FLOOR_TOP, 0, 0, W, FLOOR_TOP);
      ctx.drawImage(exposed(B.main, BG_EXPOSE), c0, 0, W, H, 0, 0, W, H);''')
rep("ctx.drawImage(stImg, x0, y0, x1 - x0, y1 - y0);","ctx.drawImage(exposed(stImg, BG_EXPOSE), x0, y0, x1 - x0, y1 - y0);")
rep("ctx.drawImage(room, 0, (H - rh) / 2, rw, rh);","ctx.drawImage(exposed(room, BG_EXPOSE), 0, (H - rh) / 2, rw, rh);")
rep('tg.addColorStop(0, "rgba(12,5,10,0.75)");','tg.addColorStop(0, "rgba(12,5,10,0.4)");')
rep("ctx.globalAlpha = 0.26; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.29);","ctx.globalAlpha = 0.15; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.29);")
open(P,"w").write(s); print("ok")
