import json
s=open('level13.js').read()
F=json.load(open('meta13.json'))
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(s.count(a),a[:90]); s=s.replace(a,b)
fr=", ".join(f"{k}: {v}" for k,v in F.items())
rep('''  let G = null;   // module state''','''  // Painted stage props (levels/level13_props.png, keyed from chroma-green photoreal renders): acid pool, blast crater,
  // portal, crystal meteor, hazard post, artillery shell; levels/level13_chasm.jpg = rock-walled toxic chasm texture
  // (clipped into the crack shape). Frames [x, y, w, h] in sheet px. The old code art stays as the load fallback.
  const PR_IMG = "levels/level13_props.png", CHASM_IMG = "levels/level13_chasm.jpg";
  const PF = { %s };
  const ready = (im) => im && im.complete !== false && (im.naturalWidth || im.width);
  function pspr(f, x, y, w, h, rot, flip) { // draw a props-sheet frame centred on (x, y)
    const im = A.img(PR_IMG); if (!ready(im)) return false; const c = A.ctx;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1); c.drawImage(im, f[0], f[1], f[2], f[3], -w / 2, -h / 2, w, h); c.restore(); return true;
  }
  let G = null;   // module state''' % fr)
# acid pools
rep('''        c.fillStyle = "#3a2c4a"; c.beginPath(); c.ellipse(x, y + 1, q.rx + 3, q.ry + 2, 0, 0, 6.29); c.fill();       // rock rim
        c.fillStyle = "#1a5a10"; c.beginPath(); c.ellipse(x, y, q.rx, q.ry, 0, 0, 6.29); c.fill();
        c.fillStyle = warn && t % 6 < 3 ? "#d8ff5a" : "#7aff2a"; c.beginPath(); c.ellipse(x, y - 0.5, q.rx - 3, q.ry - 1.6, 0, 0, 6.29); c.fill();''','''        if (pspr(PF.pool, x, y + 0.5, (q.rx + 4) * 2, (q.ry + 3) * 2)) { // painted acid pool; churn = flashing hot surface
          c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = warn ? (t % 6 < 3 ? 0.6 : 0.3) : 0.22; c.fillStyle = "#6aff3a"; c.beginPath(); c.ellipse(x, y - 0.5, q.rx - 3, q.ry - 1.6, 0, 0, 6.29); c.fill(); c.restore();
        } else {
        c.fillStyle = "#3a2c4a"; c.beginPath(); c.ellipse(x, y + 1, q.rx + 3, q.ry + 2, 0, 0, 6.29); c.fill();       // rock rim
        c.fillStyle = "#1a5a10"; c.beginPath(); c.ellipse(x, y, q.rx, q.ry, 0, 0, 6.29); c.fill();
        c.fillStyle = warn && t % 6 < 3 ? "#d8ff5a" : "#7aff2a"; c.beginPath(); c.ellipse(x, y - 0.5, q.rx - 3, q.ry - 1.6, 0, 0, 6.29); c.fill();
        }''')
# chasm: texture fill inside the crack
rep('''        c.fillStyle = g; c.fill();
        c.save(); c.clip();''','''        c.fillStyle = g; c.fill();
        const cim = A.img(CHASM_IMG);
        if (ready(cim)) { c.save(); c.clip(); c.drawImage(cim, x0 - 4, top - 2, x1 - x0 + 8, yb - top + 6); c.restore(); } // painted rock walls + toxic glow
        c.save(); c.clip();''')
# hazard posts
rep('''        for (const px of [x0 - 6, x1 + 4]) {
          api.rect(px - 1, top - 20, 2, 22, "#2a2234");''','''        for (const px of [x0 - 6, x1 + 4]) {
          if (pspr(PF.post, px, top - 12, 6.5, 30)) { if (near && blink(api.t)) { c.save(); c.globalCompositeOperation = "lighter"; glow(c, px, top - 26, 8, "rgba(255,190,60,1)"); c.restore(); } continue; }
          api.rect(px - 1, top - 20, 2, 22, "#2a2234");''')
# crystal meteor
rep('''        c.fillStyle = "#e05ad8"; c.beginPath(); c.moveTo(x, y - 9);''','''        if (pspr(PF.crys, x, y - 2, 11, 15.4, -0.2)) continue; // painted crystal
        c.fillStyle = "#e05ad8"; c.beginPath(); c.moveTo(x, y - 9);''')
# craters
rep('''      for (const k of G.craters) { c.globalAlpha = Math.min(1, (150 - k.t) / 60) * 0.55; c.fillStyle = "#120a16"; c.beginPath(); c.ellipse(k.x, k.y, 14, 5, 0, 0, 6.29); c.fill(); c.globalAlpha = 1; }''','''      for (const k of G.craters) { c.globalAlpha = Math.min(1, (150 - k.t) / 60) * (ready(A.img(PR_IMG)) ? 0.9 : 0.55); if (!pspr(PF.crater, k.x, k.y, 32, 11)) { c.fillStyle = "#120a16"; c.beginPath(); c.ellipse(k.x, k.y, 14, 5, 0, 0, 6.29); c.fill(); } c.globalAlpha = 1; }''')
# barrage shells dropping
rep('''        api.rect(m.x - 2, y - 7, 4, 8, "#4a4a52"); api.rect(m.x - 2, y - 7, 1, 8, "#8a8a96"); api.rect(m.x - 1, y + 1, 2, 2, "#ff8a2a");''','''        if (!pspr(PF.shell, m.x, y - 3, 13, 3.6, Math.PI / 2)) { api.rect(m.x - 2, y - 7, 4, 8, "#4a4a52"); api.rect(m.x - 2, y - 7, 1, 8, "#8a8a96"); api.rect(m.x - 1, y + 1, 2, 2, "#ff8a2a"); }''')
# Traag arm-cannon shell
rep('''    api.rect(x - 3, y - 2, 6, 4, "#5a5a64"); api.rect(x + (s.vx > 0 ? 2 : -4), y - 1, 2, 2, "#ffd27a");''','''    if (pspr(PF.shell, x, y, 11, 3.2, 0, s.vx < 0)) return;
    api.rect(x - 3, y - 2, 6, 4, "#5a5a64"); api.rect(x + (s.vx > 0 ? 2 : -4), y - 1, 2, 2, "#ffd27a");''')
# portal
rep('''    glow(c, 0, 0, 38, "rgba(80,255,140,0.7)");
    for (let i = 0; i < 4; i++)''','''    glow(c, 0, 0, 38, "rgba(80,255,140,0.7)");
    const pim = A.img(PR_IMG);
    if (ready(pim)) { // painted vortex: two counter-rotating copies + bright core
      const f = PF.portal, w = 46, h = 72;
      c.globalCompositeOperation = "source-over";
      c.save(); c.scale(1, 1 + 0.03 * Math.sin(t * 0.2)); c.drawImage(pim, f[0], f[1], f[2], f[3], -w / 2, -h / 2, w, h); c.restore();
      c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.45; c.save(); c.scale(1, h / w); c.rotate(t * 0.06); c.scale(1, w / h); c.drawImage(pim, f[0], f[1], f[2], f[3], -w / 2.4, -h / 2.4, w / 1.2, h / 1.2); c.restore(); c.globalAlpha = 1;
      c.fillStyle = "rgba(230,255,240,0.7)"; c.beginPath(); c.ellipse(0, 0, 4, 7, 0, 0, 6.29); c.fill();
      c.restore(); return;
    }
    for (let i = 0; i < 4; i++)''')
rep('''    images: [TRS, GRS, EARTH],''','''    images: [TRS, GRS, EARTH, PR_IMG, CHASM_IMG],''')
open('level13.js','w').write(s); print('ok')
