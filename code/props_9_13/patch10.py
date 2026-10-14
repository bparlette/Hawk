import json
s=open('level10.js').read()
F=json.load(open('meta10.json'))
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(s.count(a),a[:90]); s=s.replace(a,b)
fr=", ".join(f"{k}: {v}" for k,v in F.items())
rep('''  let G = null;          // per-section run state''','''  // Painted stage props (levels/level10_props.png, keyed from chroma-green comic-ink renders): barrel, cannonball, shell
  // scar, Armaggon's dorsal fin + harpoon, the outro locomotive; levels/level10_rift.jpg = the desert seen through the rift.
  // Frames [x, y, w, h] in sheet px. The old code art stays as the load fallback.
  const PR_IMG = "levels/level10_props.png", RIFT_IMG = "levels/level10_rift.jpg";
  const PF = { %s };
  const ready = (im) => im && im.complete !== false && (im.naturalWidth || im.width);
  function spr(f, x, y, w, h, rot, flip) { // draw a sheet frame centred on (x, y)
    const im = A.img(PR_IMG); if (!ready(im)) return false; const c = A.ctx;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1); c.drawImage(im, f[0], f[1], f[2], f[3], -w / 2, -h / 2, w, h); c.restore(); return true;
  }
  let G = null;          // per-section run state''' % fr)
# scars
rep('''        const x = s.x - cx, a = s.t < 200 ? 1 : (260 - s.t) / 60;
        c.globalAlpha''','''        const x = s.x - cx, a = s.t < 200 ? 1 : (260 - s.t) / 60;
        if (ready(api.img(PR_IMG))) { c.globalAlpha = a; spr(PF.scar, x, s.y, 36, 13, 0, (s.x | 0) % 2); c.globalAlpha = 1; continue; } // painted splintered hole
        c.globalAlpha''')
# barrel
rep('''        c.save(); c.translate(x, y); c.rotate(b.rot);
        c.fillStyle = "#4a4a54";''','''        if (spr(PF.barrel, x, y, 18.5, 18.5 * PF.barrel[3] / PF.barrel[2], b.rot)) continue; // painted barrel, rolling end-on
        c.save(); c.translate(x, y); c.rotate(b.rot);
        c.fillStyle = "#4a4a54";''')
# cannonball
rep('''const k = (z.t - (Z_WARN - 18)) / 18, h = (1 - k) * 150; api.rect(''','''const k = (z.t - (Z_WARN - 18)) / 18, h = (1 - k) * 150; if (!spr(PF.ball, z.x - cx, z.y - h - 3, 7.5, 7.5)) api.rect(''')
rep('''api.rect(z.x - cx - 3, z.y - h - 6, 6, 6, "#14141a"); api.rect(z.x - cx - 2, z.y - h - 5, 2, 2, "#5a5a6a"); }''','''{ api.rect(z.x - cx - 3, z.y - h - 6, 6, 6, "#14141a"); api.rect(z.x - cx - 2, z.y - h - 5, 2, 2, "#5a5a6a"); } }''')
# fin
rep('''    const c = api.ctx, h = big ? 20 : 15, w = big ? 14 : 11, wob = Math.sin(t * 0.4);
''','''    const c = api.ctx, h = big ? 20 : 15, w = big ? 14 : 11, wob = Math.sin(t * 0.4);
    const fw = big ? 34 : 27, fh = fw * PF.fin[3] / PF.fin[2]; // painted riveted fin in a ring of broken planks (bottom on the deck)
    if (spr(PF.fin, x + wob * 0.6, y + 3 - fh / 2, fw, fh)) return;
''')
# dive lock telegraph
rep('''          c.globalAlpha = 0.35 + 0.3 * k; c.fillStyle = "#1a0e06"; c.beginPath(); c.ellipse(sx, e.y, 22, 7, 0, 0, 6.29); c.fill(); c.globalAlpha = 1;
          for (let i = 0; i < 6; i++) { const an = i * 1.05 + 0.3; api.rect(sx + Math.cos(an) * 10 * (0.5 + k), e.y + Math.sin(an) * 4 * (0.5 + k), 3, 1, "#e0a060"); }''','''          c.globalAlpha = 0.45 + 0.4 * k;
          const cracked = spr(PF.scar, sx + (t % 4 < 2 ? 0.5 : -0.5), e.y, 26 + 18 * k, 9.5 + 6.5 * k); c.globalAlpha = 1; // planks splitting open (painted)
          if (!cracked) { c.globalAlpha = 0.35 + 0.3 * k; c.fillStyle = "#1a0e06"; c.beginPath(); c.ellipse(sx, e.y, 22, 7, 0, 0, 6.29); c.fill(); c.globalAlpha = 1;
          for (let i = 0; i < 6; i++) { const an = i * 1.05 + 0.3; api.rect(sx + Math.cos(an) * 10 * (0.5 + k), e.y + Math.sin(an) * 4 * (0.5 + k), 3, 1, "#e0a060"); } }''')
# harpoon
rep('''    c.strokeStyle = "#c8a46a"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(sx - d * 4, y);''','''    if (ready(api.img(PR_IMG))) { // painted harpoon (ring + rope stub at the back), tether trailing back to the gun
      c.strokeStyle = "#c8a46a"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(sx - d * 16, y); c.quadraticCurveTo(sx - d * 38, y + 6, sx - d * 64, y + 2); c.stroke();
      spr(PF.harp, sx - d * 7, y, 20, 20 * PF.harp[3] / PF.harp[2], 0, d < 0); return;
    }
    c.strokeStyle = "#c8a46a"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(sx - d * 4, y);''')
# outro rift
rep('''      const g = c.createLinearGradient(0, y - rh, 0, y + rh); g.addColorStop(0, "#ff9a3a");''','''      const rim = api.img(RIFT_IMG), tx = x - 90 + ((t * 0.6) % 220);
      if (ready(rim) && ready(api.img(PR_IMG))) { // painted desert + locomotive through the rift
        const dw = 158, dh = dw * 158 / 320, rail = y + 14;
        c.drawImage(rim, x - dw / 2, rail - 0.93 * dh, dw, dh);
        const tw = 92, th = tw * PF.train[3] / PF.train[2]; spr(PF.train, tx - 8, rail + 1 - th / 2, tw, th, 0, true); // mirrored: steams to the right
        c.fillStyle = "rgba(240,230,220,0.8)"; for (const m of st.smoke) { c.globalAlpha = 1 - m.k; c.beginPath(); c.arc(tx + 30 - m.k * 30, rail - 22 - m.k * 26, 2 + m.k * 7, 0, 6.29); c.fill(); }
        c.globalAlpha = 1;
      } else {
      const g = c.createLinearGradient(0, y - rh, 0, y + rh); g.addColorStop(0, "#ff9a3a");''')
rep('''      const tx = x - 90 + ((t * 0.6) % 220); // steam locomotive silhouette chugging across''','''      // steam locomotive silhouette chugging across''')
rep('''for (const m of st.smoke) { c.globalAlpha = 1 - m.k; c.beginPath(); c.arc(tx + 5 - m.k * 30, y - 6 - m.k * 26, 2 + m.k * 7, 0, 6.29); c.fill(); }
      c.restore();''','''for (const m of st.smoke) { c.globalAlpha = 1 - m.k; c.beginPath(); c.arc(tx + 5 - m.k * 30, y - 6 - m.k * 26, 2 + m.k * 7, 0, 6.29); c.fill(); }
      }
      c.restore();''')
rep('''    images: [SHARK],''','''    images: [SHARK, PR_IMG, RIFT_IMG],''')
open('level10.js','w').write(s)
