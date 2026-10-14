/*PFILLBG*/(function (C) {
  var RAF = window.requestAnimationFrame.bind(window); // captured early: some games stub window.requestAnimationFrame later
  // Portrait fill: paints the empty bands around a fixed-aspect game canvas with an extension of the game itself
  // (its top rows carried up, its bottom rows carried down, blurred and faded into the dark), or a custom painter.
  // Only in a portrait viewport; landscape/desktop never shows it. Cheap: a small canvas redrawn every few frames.
  function boot() {
    var src = document.querySelector(C.src), box = document.querySelector(C.box);
    if (!src || !box) return;
    var bg = document.createElement("canvas"); bg.id = "pfbg"; bg.setAttribute("aria-hidden", "true");
    bg.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;display:none;" +
      (C.blur ? "filter:blur(" + C.blur + "px) saturate(1.15);image-rendering:auto;" : "image-rendering:pixelated;");
    if (getComputedStyle(box).position === "static") box.style.position = "relative";
    box.insertBefore(bg, box.firstChild);
    if (getComputedStyle(src).position === "static") src.style.position = "relative";
    var g = bg.getContext("2d"), n = 0, on = false;
    function strip(rows, x, y, w, h, mode, up) {
      var a = rows[0], b = rows[1], sh = b - a, sc = src.width / C.lw;
      if (h <= 0) return;
      if (mode === "mirror") { // a soft reflection of the frame's own edge, flipped away from the game
        var LH = src.height / sc, take = Math.min(h, LH * 0.5);
        g.save();
        if (up) { g.translate(0, y + h); g.scale(1, -1); g.drawImage(src, 0, 0, src.width, take * sc, x, 0, w, h); }
        else { g.translate(0, y); g.scale(1, -1); g.drawImage(src, 0, (LH - take) * sc, src.width, take * sc, x, -h, w, h); }
        g.restore(); return;
      }
      if (mode === "tile") {
        if (up) for (var yy = y + h - sh; yy > y - sh; yy -= sh) g.drawImage(src, 0, a * sc, src.width, sh * sc, x, yy, w, sh);
        else for (var y2 = y; y2 < y + h; y2 += sh) g.drawImage(src, 0, a * sc, src.width, sh * sc, x, y2, w, sh);
      } else g.drawImage(src, 0, a * sc, src.width, sh * sc, x, y, w, h);
    }
    function fade(y0, y1, outerAtTop) {
      if (y1 - y0 < 1) return;
      var gr = g.createLinearGradient(0, y0, 0, y1), c0 = "rgba(" + (C.rgb || "0,0,0") + "," + (C.fade == null ? 0.85 : C.fade) + ")", c1 = "rgba(" + (C.rgb || "0,0,0") + "," + (C.near || 0.25) + ")";
      gr.addColorStop(0, outerAtTop ? c0 : c1); gr.addColorStop(1, outerAtTop ? c1 : c0);
      g.fillStyle = gr; g.fillRect(0, y0, bg.width, y1 - y0);
    }
    function tick() {
      RAF(tick);
      if ((n++ % (C.every || 3)) !== 0) return;
      var portrait = innerHeight > innerWidth * 1.05;
      var br = box.getBoundingClientRect(), sr = src.getBoundingClientRect();
      var gapT = sr.top - br.top, gapB = br.bottom - sr.bottom;
      if (!portrait || sr.width < 8 || (gapT < 6 && gapB < 6)) { if (on) { bg.style.display = "none"; on = false; } return; }
      if (!on) { bg.style.display = ""; on = true; }
      var k = C.lw / sr.width, w = Math.max(8, Math.round(br.width * k)), h = Math.max(8, Math.round(br.height * k));
      if (bg.width !== w || bg.height !== h) { bg.width = w; bg.height = h; }
      var gx = (sr.left - br.left) * k, gy = (sr.top - br.top) * k, gw = sr.width * k, gh = sr.height * k;
      g.imageSmoothingEnabled = !!C.blur;
      g.fillStyle = C.bg || "#000"; g.fillRect(0, 0, w, h);
      try {
        if (C.topFn && window[C.topFn]) window[C.topFn](g, gx, 0, gw, gy, w);
        else if (C.top) strip(C.top.rows, gx, 0, gw, gy, C.top.mode, true);
        if (C.bot) strip(C.bot.rows, gx, gy + gh, gw, h - gy - gh, C.bot.mode, false);
      } catch (e) { /* source not ready yet */ }
      fade(0, gy, true); fade(gy + gh, h, false);
      if (C.line) { g.fillStyle = C.line; g.fillRect(gx, gy - 1, gw, 1); g.fillRect(gx, gy + gh, gw, 1); }
    }
    RAF(tick);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(/*CFG*/);
