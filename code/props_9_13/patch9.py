import json,re
s=open('level9.js').read()
F=json.load(open('meta9.json'))
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(s.count(a),a[:80]); s=s.replace(a,b)
fr=", ".join(f"{k}: {v}" for k,v in F.items()).replace("'","")
rep('''  let G = null; // all per-run state''','''  // Painted stage props (levels/level9_props.png, keyed from chroma-green comic-ink renders) + the outro's night sea
  // (levels/level9_sea.jpg). Frames [x, y, w, h] in sheet px. Old code art stays as the load fallback.
  const PR_IMG = "levels/level9_props.png", SEA_IMG = "levels/level9_sea.jpg";
  const PF = { %s };
  const ready = (im) => im && im.complete !== false && (im.naturalWidth || im.width);
  function prop(api, f, x, y, w, h) { const im = api.img(PR_IMG); if (!ready(im)) return false; api.ctx.drawImage(im, f[0], f[1], f[2], f[3], x, y, w, h); return true; }
  function propRot(api, f, x, y, w, h, rot, ax, ay) { // rotated about (x, y); (ax, ay) = pivot inside the sprite in 0..1
    const im = api.img(PR_IMG); if (!ready(im)) return false; const c = api.ctx;
    c.save(); c.translate(x, y); c.rotate(rot); c.drawImage(im, f[0], f[1], f[2], f[3], -w * ax, -h * ay, w, h); c.restore(); return true;
  }
  let G = null; // all per-run state''' % fr)
# bomb
rep('''        c.fillStyle = "#14121a"; c.beginPath(); c.arc(x, y - 3, 3.5, 0, 6.29); c.fill(); api.rect(x - 1, y - 8, 2, 2, "#5a4a3a");
        if (api.t % 4 < 2) { api.rect(x - 1 + api.rnd(-2, 2), y - 10 + api.rnd(-2, 1), 2, 2, "#ffd040"); api.rect(x + api.rnd(-3, 3), y - 11, 1, 1, "#ffffff"); }''',
'''        const bw = 10, bh = bw * PF.bomb[3] / PF.bomb[2], painted = propRot(api, PF.bomb, x, y - 3, bw, bh, k * 5, 0.42, 0.58); // painted bomb, tumbling
        if (!painted) { c.fillStyle = "#14121a"; c.beginPath(); c.arc(x, y - 3, 3.5, 0, 6.29); c.fill(); api.rect(x - 1, y - 8, 2, 2, "#5a4a3a"); }
        const fx = painted ? x + Math.cos(k * 5 - 0.9) * 5.6 : x, fy = painted ? y - 3 + Math.sin(k * 5 - 0.9) * 5.6 : y - 9; // fuse tip
        if (api.t % 4 < 2) { api.rect(fx - 1 + api.rnd(-2, 2), fy - 1 + api.rnd(-2, 1), 2, 2, "#ffd040"); api.rect(fx + api.rnd(-3, 3), fy - 2, 1, 1, "#ffffff"); }''')
# clouds
rep('''        const r = q.r + q.t * 0.12, g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        g.addColorStop(0, "rgba(236,232,244,0.85)"); g.addColorStop(0.6, "rgba(176,170,192,0.55)"); g.addColorStop(1, "rgba(120,114,136,0)");
        c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);''',
'''        const r = q.r + q.t * 0.12, im = api.img(PR_IMG);
        if (ready(im)) { // painted smoke puff, mirrored by drift direction
          const w = r * 2.2, h = w * PF.smoke[3] / PF.smoke[2]; c.globalAlpha = a * 0.8;
          c.save(); c.translate(x, y); if (q.vx < 0) c.scale(-1, 1); c.drawImage(im, PF.smoke[0], PF.smoke[1], PF.smoke[2], PF.smoke[3], -w / 2, -h / 2, w, h); c.restore();
          continue;
        }
        const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        g.addColorStop(0, "rgba(236,232,244,0.85)"); g.addColorStop(0.6, "rgba(176,170,192,0.55)"); g.addColorStop(1, "rgba(120,114,136,0)");
        c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);''')
# spikes back
rep('''        c.fillStyle = "rgba(60,40,20,0.45)"; c.beginPath(); c.ellipse(x, y, SW + 2, SH, 0, 0, 6.29); c.fill(); // disturbed earth
        for (let i = -SW + 3; i < SW; i += 6) { api.rect(x + i, y - 1 + (i % 4 ? 1 : -1), 3, 1, "#3a2a18"); }
        if (warn) {''','''        const jit = warn && s.t % 4 < 2 ? 1 : 0, dw = (SW + 4) * 2, dh = dw * PF.dirt[3] / PF.dirt[2];
        const paint = prop(api, PF.dirt, x - dw / 2 + jit, y - dh / 2, dw, dh); // painted disturbed earth (shivers during the warning)
        if (paint && warn) { stakeRise(api, PF.stakes, x, y, 46, 21, 3 + (s.t % 8 < 4 ? 1 : 0)); if (s.t % 5 < 2) api.rect(x + api.rnd(-SW, SW), y - api.rnd(0, 4), 2, 1, "#8a6a40"); if (blink(s.t)) api.ptext("!", x, y - 24, 2, "#ffe060"); } // stake tips peek out
        if (!paint) { c.fillStyle = "rgba(60,40,20,0.45)"; c.beginPath(); c.ellipse(x, y, SW + 2, SH, 0, 0, 6.29); c.fill(); for (let i = -SW + 3; i < SW; i += 6) { api.rect(x + i, y - 1 + (i % 4 ? 1 : -1), 3, 1, "#3a2a18"); } }
        if (!paint && warn) {''')
rep('''        if (up) { // stakes: back row (behind actors)
          const k = s.t - S_IDLE - S_WARN, h = Math.min(1, k / 5) * (k > S_UP - 8 ? (S_UP - k) / 8 : 1) * 22;
          for''','''        if (up) { // stakes: back row (behind actors)
          const k = s.t - S_IDLE - S_WARN, h = Math.min(1, k / 5) * (k > S_UP - 8 ? (S_UP - k) / 8 : 1) * 22;
          if (paint) { stakeRise(api, PF.stakes, x, y, 46, 21, h * 21 / 22); continue; }
          for''')
rep('''    drawFront(st, api, cx) { // front row of stakes (over actors) so it reads as a patch, not a wall
      const c = api.ctx;
      for (const s of st.list) {
        if (s.t < S_IDLE + S_WARN) continue;
        const x = Math.round(s.x - cx), y = s.y + 4; if (x < -30 || x > api.W + 30) continue;
        const k = s.t - S_IDLE - S_WARN, h = Math.min(1, k / 5) * (k > S_UP - 8 ? (S_UP - k) / 8 : 1) * 16;
''','''    drawFront(st, api, cx) { // front row of stakes (over actors) so it reads as a patch, not a wall
      const c = api.ctx;
      for (const s of st.list) {
        if (s.t < S_IDLE + S_WARN) continue;
        const x = Math.round(s.x - cx), y = s.y + 4; if (x < -30 || x > api.W + 30) continue;
        const k = s.t - S_IDLE - S_WARN, h = Math.min(1, k / 5) * (k > S_UP - 8 ? (S_UP - k) / 8 : 1) * 16;
        if (ready(api.img(PR_IMG))) { stakeRise(api, PF.small, x + 3, y, 19, 17, h * 17 / 16); continue; } // painted front cluster
''')
rep('''  // Archer volley:''','''  // a painted stake row rising out of the ground: bottom-centre (x, y), full size w x hMax (w < 0 = mirrored), h = how far it is up
  function stakeRise(api, f, x, y, w, hMax, h) {
    const im = api.img(PR_IMG); if (!ready(im) || h <= 0.3) return; const c = api.ctx, aw = Math.abs(w);
    c.save(); c.beginPath(); c.rect(x - aw, y - hMax - 4, aw * 2, hMax + 5); c.clip(); // ground line at y + 1
    c.translate(x, y + 1 + (hMax - h)); if (w < 0) c.scale(-1, 1); c.drawImage(im, f[0], f[1], f[2], f[3], -aw / 2, -hMax, aw, hMax); c.restore();
  }

  // Archer volley:''')
# stuck arrows
rep('''        a.t++; const x = a.x - cx; c.globalAlpha = a.t > 80 ? (110 - a.t) / 30 : 1;
        api.rect(x, a.y - 9, 1, 9, "#6a4a2a"); api.rect(x - 1, a.y - 11, 3, 2, "#e8e0d0"); c.globalAlpha = 1; return a.t < 110;''',
'''        a.t++; const x = a.x - cx; c.globalAlpha = a.t > 80 ? (110 - a.t) / 30 : 1;
        const im = api.img(PR_IMG), lean = ((a.x * 7 | 0) % 5 - 2) * 0.06;
        if (ready(im)) { c.save(); c.beginPath(); c.rect(x - 8, a.y - 20, 16, 20.5); c.clip(); propRot(api, PF.arrow, x, a.y + 3, 17, 1.9, Math.PI / 2 + lean, 1, 0.5); c.restore(); } // painted arrow, head buried
        else { api.rect(x, a.y - 9, 1, 9, "#6a4a2a"); api.rect(x - 1, a.y - 11, 3, 2, "#e8e0d0"); }
        c.globalAlpha = 1; return a.t < 110;''')
rep('''        for (let i = -1; i <= 1; i++) { const c = api.ctx; c.strokeStyle = "#e8dcc8"; c.lineWidth = 1; c.beginPath(); c.moveTo(x + i * 6, y - 4 + i * 3); c.lineTo(x + i * 6 + 6, y - 22 + i * 3); c.stroke(); api.rect(x + i * 6 - 1, y - 4 + i * 3, 2, 2, "#c8c8d0"); }''',
'''        for (let i = -1; i <= 1; i++) {
          if (propRot(api, PF.arrow, x + i * 6, y - 3 + i * 3, 20, 2.1, Math.atan2(18, -6), 1, 0.5)) continue; // painted arrow, head first
          const c = api.ctx; c.strokeStyle = "#e8dcc8"; c.lineWidth = 1; c.beginPath(); c.moveTo(x + i * 6, y - 4 + i * 3); c.lineTo(x + i * 6 + 6, y - 22 + i * 3); c.stroke(); api.rect(x + i * 6 - 1, y - 4 + i * 3, 2, 2, "#c8c8d0");
        }''')
# outro
rep('''        const g = c.createLinearGradient(0, 0, 0, api.H);''','''        const sea = api.img(SEA_IMG), pim = api.img(PR_IMG);
        if (ready(sea) && ready(pim)) { // painted night sea + galleon on the horizon
          c.drawImage(sea, 0, 0, api.W, api.H);
          const sx = 120 + (t - 265) * 0.15, sw = 104, sh = sw * PF.ship[3] / PF.ship[2];
          c.drawImage(pim, PF.ship[0], PF.ship[1], PF.ship[2], PF.ship[3], Math.round(sx - sw / 2), 115 - sh, sw, sh);
          c.globalAlpha = a * 0.22; for (let r = 0; r < 5; r++) for (let i = 0; i < 10; i++) { const x = ((i * 46 + api.t * (0.4 + r * 0.15) + r * 17) % (api.W + 40)) - 20, y = 120 + r * 20 + Math.sin(api.t * 0.05 + i) * 2; api.rect(x, y, 12 + r * 3, 1, "#d8ecff"); } // moving glints
          c.globalAlpha = a * 0.45; api.rect(0, 42, api.W, 15, "#05030a"); // caption band (the painted moon sits behind the caption)
          c.globalAlpha = a;
        } else {
        const g = c.createLinearGradient(0, 0, 0, api.H);''')
rep('''y = 132 + r * 16 + Math.sin(api.t * 0.05 + i) * 2; api.rect(x, y, 14 + r * 2, 1, r % 2 ? "#3a6aa8" : "#5a8ac8"); }''','''y = 132 + r * 16 + Math.sin(api.t * 0.05 + i) * 2; api.rect(x, y, 14 + r * 2, 1, r % 2 ? "#3a6aa8" : "#5a8ac8"); }
        }''')
rep('''    images: [SHEET],''','''    images: [SHEET, PR_IMG, SEA_IMG],''')
open('level9.js','w').write(s)
