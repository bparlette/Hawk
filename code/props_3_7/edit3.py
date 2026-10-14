import json
M=json.load(open('meta.json'))['l3']
s=open('level3.orig.js').read()
def rep(a,b):
    global s
    assert s.count(a)==1, a[:60]; s=s.replace(a,b)
rep("""  const wet = (o) =>""","""  // ---- Painted stage props: levels/level3_props.png (photoreal cutouts on chroma, stored at 3x world size) ----
  // [x, y, w, h] source rects; gameplay/collision never reads these, they only replace the old code-drawn shapes.
  const PR_IMG = "levels/level3_props.png";
  const PR = %s;
  const prImg = (api) => { const im = api.img(PR_IMG); return im && im.complete !== false && im.naturalWidth ? im : null; };
  // draw sprite `n` into the world box (x, y, w, h); optional flip (-1), rotation about the box centre, alpha
  function prop(api, n, x, y, w, h, flip, rot, alpha) {
    const im = prImg(api), F = PR[n]; if (!im || !F) return false;
    const c = api.ctx; c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    if (alpha !== undefined) c.globalAlpha *= Math.max(0, Math.min(1, alpha));
    c.translate(x + w / 2, y + h / 2); if (rot) c.rotate(rot); if (flip < 0) c.scale(-1, 1);
    c.drawImage(im, F[0], F[1], F[2], F[3], -w / 2, -h / 2, w, h); c.restore(); return true;
  }
  const wet = (o) =>""" % json.dumps(M).replace(' ',''))
# rat tails
rep("""      const c = api.ctx;
      for (const e of api.enemies) {
        if (e.type !== "dasher" || e.state === "fly") continue;
        const x = e.x - cx - e.facing * 5, y = e.y - (e.z || 0) - 7, w = Math.sin(api.t * 0.25 + e.ring) * 2;
        c.strokeStyle = "#d88a8a"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y);
        c.quadraticCurveTo(x - e.facing * 8, y + 4 + w, x - e.facing * 15, y - 2 - w); c.stroke();
      }""","""      for (const e of api.enemies) { // painted rat tail, rooted at the rump and swishing
        if (e.type !== "dasher" || e.state === "fly") continue;
        const x = e.x - cx - e.facing * 5, y = e.y - (e.z || 0) - 7, w = Math.sin(api.t * 0.25 + e.ring) * 0.22;
        const c = api.ctx; c.save(); c.translate(x, y); c.rotate(e.facing * (0.6 + w)); // pivot on the tail root (sprite root = its top-right corner)
        prop(api, "tail", e.facing > 0 ? -16 : 0, -1, 16, 18, e.facing); c.restore();
      }""")
# pipe gush
rep("""      const c = api.ctx;
      for (const g of st.gush) {
        const x = g.x - cx, k = g.t / 26; c.globalAlpha = 1 - k;
        c.fillStyle = "#6af08a"; c.beginPath(); c.ellipse(x, g.y + 6, 9 - k * 4, 6, 0, 0, 6.29); c.fill();
        for (let i = 0; i < 6; i++) api.rect(x - 8 + i * 3, g.y + 4 + ((g.t * 3 + i * 7) % 30), 2, 3, i % 2 ? "#c8ffd2" : "#4ad86a");
        c.globalAlpha = 1;
      }""","""      const c = api.ctx;
      for (const g of st.gush) { // painted green gush pouring from the pipe mouth (2-frame loop), fading out
        const x = g.x - cx, k = g.t / 26, F = PR[(g.t >> 2) & 1 ? "gush1" : "gush0"], w = 20 - k * 4, h = w * F[3] / F[2];
        if (!prop(api, (g.t >> 2) & 1 ? "gush1" : "gush0", x - w / 2, g.y, w, h, (g.x & 1) ? -1 : 1, 0, 1 - k)) {
          c.globalAlpha = 1 - k; c.fillStyle = "#6af08a"; c.beginPath(); c.ellipse(x, g.y + 6, 9 - k * 4, 6, 0, 0, 6.29); c.fill(); c.globalAlpha = 1;
        }
      }""")
# geyser drawBack
rep("""        if (!g.temp) { // iron grate
          c.fillStyle = "#1c2420"; c.beginPath(); c.ellipse(x, y, 13, 4.5, 0, 0, 6.29); c.fill();
          c.fillStyle = hot ? (g.t % 6 < 3 ? "#7dff7a" : "#2fa84a") : "#0a100c"; c.beginPath(); c.ellipse(x, y, 10.5, 3.3, 0, 0, 6.29); c.fill();
          for (let i = -8; i <= 8; i += 4) api.rect(x + i, y - 3, 1, 6, "#3e4a44");
        } else { // bubbling sludge puddle the boss calls up
          c.fillStyle = `rgba(90,240,110,${warn && g.t % 6 < 3 ? 0.75 : 0.5})`; c.beginPath(); c.ellipse(x, y, 13, 4.5, 0, 0, 6.29); c.fill();
        }""","""        if (!g.temp) { // painted iron grate; glows sludge-green (flashing) while it is about to blow
          prop(api, "grate", x - 14, y - 5, 28, 10);
          if (hot) prop(api, "grateHot", x - 14, y - 5, 28, 10, 1, 0, g.t % 6 < 3 ? 1 : 0.55);
        } else { // bubbling sludge puddle the boss calls up
          prop(api, "puddle", x - 15, y - 5, 30, 10, 1, 0, warn && g.t % 6 < 3 ? 1 : 0.72);
        }""")
# geyser column
rep("""        const k = (g.t - IDLE - WARN) / BLAST, h = 74 * Math.min(1, k * 5) * (k > 0.75 ? (1 - k) / 0.25 : 1), w = 10 + Math.sin(api.t * 0.7) * 1.5;
        const gr = c.createLinearGradient(0, g.y - h, 0, g.y);
        gr.addColorStop(0, "rgba(200,255,200,0.9)"); gr.addColorStop(0.3, "rgba(110,240,120,0.85)"); gr.addColorStop(1, "rgba(40,170,70,0.8)");
        c.fillStyle = gr; c.beginPath(); c.moveTo(x - w, g.y); c.lineTo(x - w * 0.6, g.y - h); c.lineTo(x + w * 0.6, g.y - h); c.lineTo(x + w, g.y); c.closePath(); c.fill();
        c.fillStyle = "rgba(220,255,220,0.85)"; c.beginPath(); c.ellipse(x, g.y - h, w * 1.1, 4, 0, 0, 6.29); c.fill();
        c.fillStyle = "rgba(90,230,110,0.5)"; c.beginPath(); c.ellipse(x, g.y, w * 1.6, 4, 0, 0, 6.29); c.fill();
""","""        const k = (g.t - IDLE - WARN) / BLAST, h = 74 * Math.min(1, k * 5) * (k > 0.75 ? (1 - k) / 0.25 : 1), w = 10 + Math.sin(api.t * 0.7) * 1.5;
        // painted sludge column (3-frame loop): the sprite's spray cap sits at the eruption height h, its splash ring on the grate
        const sh = Math.max(8, h * 1.16), sw = 36 * (w / 10) * Math.min(1, 0.55 + h / 60);
        prop(api, "gey" + (((api.t >> 2) + (g.x | 0)) % 3), x - sw / 2, g.y + 4 - sh, sw, sh, (g.x & 1) ? -1 : 1);
""")
# waves crest
rep("""        c.fillStyle = "rgba(80,220,110,0.35)"; c.fillRect(Math.min(x, x - d * 46), w.y0 - 2, 46, w.y1 - w.y0 + 4);
        for (let y = w.y0; y <= w.y1; y += 3) {
          const h = 23 + Math.sin(api.t * 0.45 + y * 0.5) * 3, tail = 36;
          const gr = c.createLinearGradient(0, y - h, 0, y);
          gr.addColorStop(0, "rgba(225,255,230,0.95)"); gr.addColorStop(0.35, "rgba(100,235,120,0.9)"); gr.addColorStop(1, "rgba(30,150,70,0.8)");
          c.fillStyle = gr; c.beginPath(); c.moveTo(x - d * tail, y); c.quadraticCurveTo(x - d * 10, y - h * 0.5, x, y - h);
          c.quadraticCurveTo(x + d * 8, y - h - 1, x + d * 9, y - h + 5); c.quadraticCurveTo(x + d * 4, y - h + 6, x + d * 6, y - 4); c.lineTo(x + d * 9, y); c.closePath(); c.fill();
          api.rect(x - d * 2 - 1, y - h - 1, 4, 2, "#ffffff");
        }""","""        c.fillStyle = "rgba(80,220,110,0.28)"; c.fillRect(Math.min(x, x - d * 46), w.y0 - 2, 46, w.y1 - w.y0 + 4);
        // painted curling crest, one per depth row back to front, so the wave fills its whole lane band
        for (let i = 0; i < 3; i++) {
          const y = w.y0 + (w.y1 - w.y0) * (i + 0.5) / 3 + 3, fr = (((api.t >> 3) + i) & 1) ? "wave1" : "wave0", F = PR[fr];
          const hh = (fr === "wave1" ? 38 : 32) + Math.sin(api.t * 0.45 + i * 1.7) * 2, ww = hh * F[2] / F[3], xo = x + d * (i === 1 ? 3 : 0);
          prop(api, fr, d > 0 ? xo + 10 - ww : xo - 10, y + 3 - hh, ww, hh, d);
        }""")
# outro ladder
rep("""        for (let y = 0; y < 150; y += 10) { api.rect(x - 8, y, 2, 10, "#5a5048"); api.rect(x + 6, y, 2, 10, "#5a5048"); api.rect(x - 8, y + 4, 16, 2, "#7a6e60"); }""",
"""        if (!prop(api, "ladder", x - 9, 0, 18, 150)) for (let y = 0; y < 150; y += 10) { api.rect(x - 8, y, 2, 10, "#5a5048"); api.rect(x + 6, y, 2, 10, "#5a5048"); api.rect(x - 8, y + 4, 16, 2, "#7a6e60"); }""")
rep("    images: [GT_IMG],","    images: [GT_IMG, PR_IMG],")
open('level3.js','w').write(s)
