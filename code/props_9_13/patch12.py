import json
s=open('level12.js').read()
F=json.load(open('meta12.json'))
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(s.count(a),a[:90]); s=s.replace(a,b)
fr=", ".join(f"{k}: {v}" for k,v in F.items())
rep('''  let G = null; // per-run module state''','''  // Painted stage props (levels/level12_props.png, keyed from chroma-green photoreal renders): hovercars (3 paints),
  // security drone, anti-grav pad, swarm micro-drone; levels/level12_xsky.jpg = the Dimension X sky seen through the rift.
  // Frames [x, y, w, h] in sheet px. The old code art stays as the load fallback.
  const PR_IMG = "levels/level12_props.png", XSKY = "levels/level12_xsky.jpg";
  const PF = { %s };
  const CARPF = { "#ff3a8a": "carP", "#3ae0ff": "carC", "#ffd23a": "carY", "#9a6aff": "carP" };
  const ready = (im) => im && im.complete !== false && (im.naturalWidth || im.width);
  function spr(f, x, y, w, h, rot, flip) { // draw a sheet frame centred on (x, y)
    const im = A.img(PR_IMG); if (!ready(im)) return false; const c = A.ctx;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1); c.drawImage(im, f[0], f[1], f[2], f[3], -w / 2, -h / 2, w, h); c.restore(); return true;
  }
  let G = null; // per-run module state''' % fr)
# hovercar
rep('''        const by = y - z;
        c.fillStyle = car.col[1];''','''        const by = y - z;
        const cf = PF[CARPF[car.col[0]] || "carP"];
        if (spr(cf, x + d, by - 5, 62, 62 * cf[3] / cf[2], 0, d < 0)) continue; // painted hovercar (faces its travel direction)
        c.fillStyle = car.col[1];''')
# pads
rep('''        c.fillStyle = "#14121e"; c.beginPath(); c.ellipse(x, y, PRX + 2, PRY + 1, 0, 0, 6.29); c.fill();
        c.fillStyle = warn ?''','''        if (spr(PF.pad, x, y + 1, (PRX + 3) * 2, (PRY + 2.5) * 2)) { // painted pad; warn = white-hot core flash
          if (warn) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = Math.floor(t / 4) % 2 ? 0.55 : 0.25; c.fillStyle = "#bff4ff"; c.beginPath(); c.ellipse(x, y, PRX - 3, PRY - 2, 0, 0, 6.29); c.fill(); c.restore(); }
        } else {
        c.fillStyle = "#14121e"; c.beginPath(); c.ellipse(x, y, PRX + 2, PRY + 1, 0, 0, 6.29); c.fill();
        c.fillStyle = warn ?''')
rep('''        c.fillStyle = "#0c1622"; c.beginPath(); c.ellipse(x, y, PRX - 4, PRY - 2, 0, 0, 6.29); c.fill();
''','''        c.fillStyle = "#0c1622"; c.beginPath(); c.ellipse(x, y, PRX - 4, PRY - 2, 0, 0, 6.29); c.fill();
        }
''')
# drone body
rep('''      // drone body
      api.rect(x - 11, y - 3, 22, 7, "#2a2e3a");''','''      // drone body
      if (spr(PF.drone, x, y - 1, 42, 42 * PF.drone[3] / PF.drone[2])) {
        c.save(); c.globalCompositeOperation = "lighter"; glow(c, x, y + 5, lock ? 7 : 5, lock ? (d.t % 4 < 2 ? "rgba(255,60,60,1)" : "rgba(255,170,170,0.9)") : "rgba(140,250,255,0.9)"); c.restore();
        if (lock && d.t < 52 && (d.t >> 2) % 3) api.ptext("!", x + 24, y - 8, 2, "#ffe060");
        return;
      }
      api.rect(x - 11, y - 3, 22, 7, "#2a2e3a");''')
# swarm cubes
rep('''        api.rect(x - s / 2 - 1, y - s / 2 - 1, s + 2, s + 2, "#0a1a0a");
        api.rect(x - s / 2, y - s / 2, s, s, api.t % 6 < 3 ? "#7aff5a" : "#c8ffb8"); api.rect(x - s / 2, y - s / 2, s, 1, "#ffffff");''','''        if (spr(PF.cube, x, y, s + 3, s + 3, (q.t + q.a * 10) * 0.08)) { // painted micro-drone + bright core so it reads at speed
          api.ctx.save(); api.ctx.globalCompositeOperation = "lighter"; api.ctx.globalAlpha = api.t % 6 < 3 ? 0.9 : 0.6; glow(api.ctx, x, y, 5, "rgba(170,255,140,1)"); api.ctx.restore();
        } else {
        api.rect(x - s / 2 - 1, y - s / 2 - 1, s + 2, s + 2, "#0a1a0a");
        api.rect(x - s / 2, y - s / 2, s, s, api.t % 6 < 3 ? "#7aff5a" : "#c8ffb8"); api.rect(x - s / 2, y - s / 2, s, 1, "#ffffff"); }''')
# outro sky through the rift
rep('''        c.clip();
        const g = c.createRadialGradient(x, y + 4, 0, x, y, rx);''','''        c.clip();
        const sky = A.img(XSKY);
        if (ready(sky)) { // painted alien sky: sun + floating rock islands, slow parallax drift
          const sw = rx * 2 + 14, sh = sw * 123 / 288; c.drawImage(sky, x - sw / 2 + Math.sin(t * 0.02) * 6, y - sh / 2 + 4, sw, sh);
        } else {
        const g = c.createRadialGradient(x, y + 4, 0, x, y, rx);''')
rep('''          api.rect(px - w, py - 1, w * 2, 1, "#ff6af0");
        }
        c.restore();''','''          api.rect(px - w, py - 1, w * 2, 1, "#ff6af0");
        }
        }
        c.restore();''')
rep('''    images: [VSHEET],''','''    images: [VSHEET, PR_IMG, XSKY],''')
open('level12.js','w').write(s); print('ok')
