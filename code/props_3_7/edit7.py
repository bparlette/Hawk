import json
M=json.load(open('meta.json'))['l7']
s=open('level7.orig.js').read()
def rep(a,b):
    global s
    assert s.count(a)==1, a[:70]; s=s.replace(a,b)
rep("""  // ---- Music:""","""  // ---- Painted stage props: levels/level7_props.png (photoreal cutouts on chroma, stored at 3x world size) ----
  // [x, y, w, h] source rects; collision / timing never read these, they only replace the old code-drawn shapes.
  const PR_IMG = "levels/level7_props.png";
  const PR = %s;
  const prImg = (api) => { const im = api.img(PR_IMG); return im && im.complete !== false && im.naturalWidth ? im : null; };
  // draw sprite `n` (or a sub-rect [sx, sy, sw, sh] of it, fractions of the frame) into the world box (x, y, w, h)
  function prop(api, n, x, y, w, h, flip, rot, alpha, sub, comp) {
    const im = prImg(api), F = PR[n]; if (!im || !F) return false;
    const c = api.ctx; c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    if (alpha !== undefined) c.globalAlpha *= Math.max(0, Math.min(1, alpha));
    if (comp) c.globalCompositeOperation = comp;
    c.translate(x + w / 2, y + h / 2); if (rot) c.rotate(rot); if (flip < 0) c.scale(-1, 1);
    const q = sub || [0, 0, 1, 1];
    c.drawImage(im, F[0] + q[0] * F[2], F[1] + q[1] * F[3], q[2] * F[2], q[3] * F[3], -w / 2, -h / 2, w, h); c.restore(); return true;
  }

  // ---- Music:""" % json.dumps(M).replace(' ',''))
# conveyor belt
rep("""      // belt surface: dark rubber with moving cleats, a lit top edge and a steel front lip with rollers
      api.rect(0, BELT0 - 2, W, BELT1 - BELT0 + 2, "rgba(22,18,16,0.82)");
      api.rect(0, BELT0 - 2, W, 1, "rgba(255,170,90,0.35)");
      const off = ((st.pos - cx) % 14 + 14) % 14;
      for (let x = off - 14; x < W; x += 14) { api.rect(Math.round(x), BELT0, 2, BELT1 - BELT0 - 1, "rgba(70,60,52,0.9)"); api.rect(Math.round(x) + 2, BELT0, 1, BELT1 - BELT0 - 1, "rgba(0,0,0,0.5)"); }
      const aoff""","""      // painted belt: rubber surface with cleats scrolls with the belt, the riveted steel frame + rollers stay put
      const BW = 96, SPLIT = 0.6, top = BELT0 - 4, bh = 22;
      if (prImg(api)) {
        const off = ((st.pos - cx) % BW + BW) % BW, foff = ((-cx) % BW + BW) % BW;
        for (let x = off - BW; x < W; x += BW) prop(api, "belt", Math.floor(x), top, BW + 1, bh * SPLIT, 1, 0, 1, [0, 0, 1, SPLIT]);
        for (let x = foff - BW; x < W; x += BW) prop(api, "belt", Math.floor(x), top + bh * SPLIT, BW + 1, bh * (1 - SPLIT), 1, 0, 1, [0, SPLIT, 1, 1 - SPLIT]);
      } else api.rect(0, BELT0 - 2, W, BELT1 - BELT0 + 2, "rgba(22,18,16,0.82)");
      const aoff""")
rep("""      api.rect(0, BELT1 - 1, W, 3, "#3a3430"); api.rect(0, BELT1 - 1, W, 1, "#7a6a5a");
      const roff = ((st.pos - cx) % 24 + 24) % 24;
      for (let x = roff - 24; x < W; x += 24) { api.rect(Math.round(x), BELT1 + 1, 4, 2, "#1a1614"); api.rect(Math.round(x) + 1, BELT1 + 1, 1, 1, "#9a8a7a"); }
      if (st.warn) { // klaxon lamps along the lip
        for (let x = ((-cx) % 128 + 128) % 128; x < W; x += 128) {
          const on = Math.floor(api.t / 6) % 2; api.rect(Math.round(x) - 2, BELT0 - 8, 5, 5, on ? "#ff3a1a" : "#5a1a10");
          if (on) { c.fillStyle = "rgba(255,60,20,0.25)"; c.beginPath(); c.arc(Math.round(x), BELT0 - 6, 8, 0, 6.29); c.fill(); }
        }
      }""","""      if (st.warn) { // painted klaxon beacons along the lip
        for (let x = ((-cx) % 128 + 128) % 128; x < W; x += 128) {
          const on = Math.floor(api.t / 6) % 2; prop(api, on ? "lampOn" : "lampOff", Math.round(x) - 4, BELT0 - 13, 8, 10);
          if (on) { c.fillStyle = "rgba(255,60,20,0.25)"; c.beginPath(); c.arc(Math.round(x), BELT0 - 9, 9, 0, 6.29); c.fill(); }
        }
      }""")
# grinder sparks
rep("""        if (!warn && g.t >= G_IDLE) { // hot cone of sparks pouring onto the lane
          c.globalAlpha = 0.35 + 0.15 * Math.sin(api.t * 0.9);
          const gr = c.createLinearGradient(sx, sy, sx + 30, api.floorTop + 14); gr.addColorStop(0, "rgba(255,230,140,0.9)"); gr.addColorStop(1, "rgba(255,110,20,0.15)");
          c.fillStyle = gr; c.beginPath(); c.moveTo(sx - 2, sy - 2); c.lineTo(sx + 4, sy - 4); c.lineTo(sx + 56, api.floorTop + 22); c.lineTo(sx - 8, api.floorTop + 22); c.closePath(); c.fill();
          c.globalAlpha = 1;
        }
        for (let i = 0; i < n; i++) {""","""        if (!warn && g.t >= G_IDLE) { // painted spark shower pouring from the grinder onto the lane (2-frame flicker)
          const hh = api.floorTop + 24 - (sy - 4);
          if (prop(api, (api.t >> 1) & 1 ? "spark1" : "spark0", sx - 7, sy - 4, 66, hh, 1, 0, 0.85 + 0.15 * Math.sin(api.t * 0.9))) { c.restore(); continue; }
        }
        for (let i = 0; i < n; i++) {""")
# magnet
rep("""      api.rect(x - 1, 0, 2, by - 14, "#2a2420"); api.rect(x, 0, 1, by - 14, "#6a5a4a");          // cable
      api.rect(x - 6, by - 16, 12, 4, "#3a3230");                                                // block
      c.strokeStyle = "#2a2420"; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 4, by - 12); c.lineTo(x - 13, by - 7); c.moveTo(x + 4, by - 12); c.lineTo(x + 13, by - 7); c.stroke();
      c.fillStyle = "#3a3538"; c.beginPath(); c.ellipse(x, by - 4, 16, 5, 0, 0, 6.29); c.fill();
      api.rect(x - 16, by - 4, 32, 4, "#4a4448"); api.rect(x - 16, by - 4, 32, 1, "#8a8288");
      c.fillStyle = "#1e1b1e"; c.beginPath(); c.ellipse(x, by, 16, 4, 0, 0, 6.29); c.fill();""","""      if (prImg(api)) { // painted steel cable (tiled) + chained electromagnet, disc bottom on by + 4 as before
        const mh = 34 * PR.magnet[3] / PR.magnet[2], top = by + 4 - mh;
        for (let y = top + 2; y > -40; y -= 40) prop(api, "cable", x - 1.5, y - 40, 3, 40);
        prop(api, "magnet", x - 17, top, 34, mh);
      } else { api.rect(x - 1, 0, 2, by - 14, "#2a2420"); c.fillStyle = "#3a3538"; c.beginPath(); c.ellipse(x, by - 4, 16, 5, 0, 0, 6.29); c.fill(); }""")
# rollers
rep("""        if (r.barrel) { // oil drum on its side, ribs scrolling as it rolls
          const y = r.y - 13;""","""        if (prImg(api)) { // painted oil drum (end-on, rolling) or tyre, spinning with r.rot
          if (r.barrel) prop(api, "drum", x - 7.5, r.y - 14, 15, 15, 1, r.rot * 0.55);
          else { const y = r.y - 7 - Math.abs(Math.sin(r.rot * 0.5)) * 2; prop(api, "tire", x - 7.8, y - 7.8, 15.6, 15.6, 1, r.rot); }
          if (r.barrel && api.t % 3 === 0) api.rect(x - Math.sign(r.vx) * 8, r.y - 1, 2, 1, "#111");
        } else if (r.barrel) { // oil drum on its side, ribs scrolling as it rolls
          const y = r.y - 13;""")
# crusher
rep("""      if (py > 99) { // the ram's steel shaft, shown as it comes down
        const g = c.createLinearGradient(x - 30, 0, x + 30, 0); g.addColorStop(0, "#3a3436"); g.addColorStop(0.45, "#8a8086"); g.addColorStop(1, "#2a2426");
        c.fillStyle = g; c.fillRect(x - 30 + jx, 96, 60, py - 96);
        for (let i = -24; i <= 24; i += 12) api.rect(x + i + jx, 96, 1, py - 96, "rgba(0,0,0,0.35)");
      }
      api.rect(x - 35 + jx, py, 70, 7, "#4a4448"); api.rect(x - 35 + jx, py, 70, 1, "#9a9298"); api.rect(x - 35 + jx, py + 6, 70, 1, "#1a1618");""","""      if (prImg(api)) { // painted ram: ribbed steel body slides down as the shaft, hazard-striped plate on its bottom
        if (py > 99) prop(api, "ram", x - 31 + jx, 96, 62, py - 96 + 1, 1, 0, 1, [0.04, 0.0, 0.92, 0.5]);
        prop(api, "ram", x - 35 + jx, py - 2, 70, 9, 1, 0, 1, [0, 0.8, 1, 0.2]);
      } else {
        if (py > 99) { c.fillStyle = "#6a6266"; c.fillRect(x - 30 + jx, 96, 60, py - 96); }
        api.rect(x - 35 + jx, py, 70, 7, "#4a4448");
      }""")
# scrap drops
rep("""        if (s.z < 150) { const y = Math.round(s.y - s.z - 10), col = SCRAP[s.k];
          c.save(); c.translate(x, y); c.rotate(s.z * 0.05);
          api.rect(-8, -6, 16, 12, col[0]); api.rect(-8, -6, 16, 2, col[1]); api.rect(-4, -2, 6, 4, "#1a1618"); api.rect(4, 2, 4, 3, col[1]);
          c.restore(); }""","""        if (s.z < 150) { const y = Math.round(s.y - s.z - 10), col = SCRAP[s.k], F = PR["scrap" + s.k], h = 17 * F[3] / F[2];
          if (!prop(api, "scrap" + s.k, x - 8.5, y - h / 2, 17, h, s.k & 1 ? -1 : 1, s.z * 0.05)) { // painted scrap chunk tumbling down
            c.save(); c.translate(x, y); c.rotate(s.z * 0.05); api.rect(-8, -6, 16, 12, col[0]); api.rect(-8, -6, 16, 2, col[1]); c.restore(); } }""")
rep("    images: [RM_IMG],","    images: [RM_IMG, PR_IMG],")
open('level7.js','w').write(s)
