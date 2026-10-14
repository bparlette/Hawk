import json
s=open('level11.js').read()
F=json.load(open('meta11.json')); DW=F.pop('_doorway')
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(s.count(a),a[:90]); s=s.replace(a,b)
fr=", ".join(f"{k}: {v}" for k,v in F.items())
rep('''  let G = null;
  const fresh''','''  // Painted stage props (levels/level11_props.png, keyed from chroma-green comic-ink renders): outlaw boxcar + sliding door,
  // water tower + spout, tunnel cliff / pillar / lintel, coupler, tumbleweed, crate, boulder, coal heap, cowboy hats.
  // Frames [x, y, w, h] in sheet px; CARDOOR = the doorway inside the car frame. Old code art stays as the load fallback.
  const PR_IMG = "levels/level11_props.png";
  const PF = { %s };
  const CARDOOR = %s;
  const ready = (im) => im && im.complete !== false && (im.naturalWidth || im.width);
  const pimg = () => { const im = A.img(PR_IMG); return ready(im) ? im : null; };
  function box(f, x, y, w, h, flip) { const im = pimg(); if (!im) return false; const c = A.ctx; if (flip) { c.save(); c.translate(x + w / 2, 0); c.scale(-1, 1); c.drawImage(im, f[0], f[1], f[2], f[3], -w / 2, y, w, h); c.restore(); } else c.drawImage(im, f[0], f[1], f[2], f[3], x, y, w, h); return true; }
  function spr(f, x, y, w, h, rot, flip) { const im = pimg(); if (!im) return false; const c = A.ctx; c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1); c.drawImage(im, f[0], f[1], f[2], f[3], -w / 2, -h / 2, w, h); c.restore(); return true; }
  function along(f, x0, y0, x1, y1, th) { // stretch a horizontal sprite along the segment (x0,y0)->(x1,y1)
    const im = pimg(); if (!im) return false; const c = A.ctx, L = Math.hypot(x1 - x0, y1 - y0);
    c.save(); c.translate(x0, y0); c.rotate(Math.atan2(y1 - y0, x1 - x0)); c.drawImage(im, f[0], f[1], f[2], f[3], 0, -th / 2, L, th); c.restore(); return true;
  }
  let G = null;
  const fresh''' % (fr, json.dumps(DW)))
# tumbleweeds section 1
rep('''      for (const w of G.weeds) { // tumbleweeds bouncing past
        const y = w.y - Math.abs(Math.sin(w.a * 0.4)) * 6;
''','''      for (const w of G.weeds) { // tumbleweeds bouncing past
        const y = w.y - Math.abs(Math.sin(w.a * 0.4)) * 6;
        if (spr(PF.weed, w.x, y, w.r * 2.3, w.r * 2.3, -w.a * 0.5)) continue;
''')
rep('''      for (const w of G.weeds) { const y = w.y - Math.abs(Math.sin(w.a * 0.4)) * 5; c.strokeStyle''','''      for (const w of G.weeds) { const y = w.y - Math.abs(Math.sin(w.a * 0.4)) * 5; if (spr(PF.weed, w.x, y, w.r * 2.3, w.r * 2.3, -w.a * 0.5)) continue; c.strokeStyle''')
# coupler
rep('''        api.rect(x - 5, top + 20, 11, 3, "#2a2a30"); api.rect(x - 1, top + 18, 3, 7, "#4a4a52"); // coupler knuckle''','''        if (!spr(PF.coup, x, top + 21, 15, 15 * PF.coup[3] / PF.coup[2])) { api.rect(x - 5, top + 20, 11, 3, "#2a2a30"); api.rect(x - 1, top + 18, 3, 7, "#4a4a52"); } // coupler knuckle''')
# outlaw car
rep('''      c.save(); c.beginPath(); c.rect(0, 0, api.W, ROOF_Y); c.clip();
      api.rect(x, y0, CAR_W, y1 - y0, "#7a2e1c");''','''      c.save(); c.beginPath(); c.rect(0, 0, api.W, ROOF_Y); c.clip();
      const pim = pimg();
      if (pim) { // painted boxcar: body, then the sliding door over the doorway
        const cw = CAR_W + 26, k = cw / PF.car[2], ch = PF.car[3] * k, cxl = x - 13, cy = y1 + 2 - ch;
        c.drawImage(pim, PF.car[0], PF.car[1], PF.car[2], PF.car[3], cxl, cy, cw, ch);
        const dx2 = cxl + CARDOOR[0] * k, dy2 = cy + CARDOOR[1] * k, dw2 = CARDOOR[2] * k, dh2 = CARDOOR[3] * k;
        if (open > 0.3) { c.globalAlpha = 0.6; glow(c, dx2 + dw2 * 0.7, dy2 + dh2 * 0.3, 22, "rgba(255,170,60,0.6)"); c.globalAlpha = 1; } // lantern inside
        c.drawImage(pim, PF.door[0], PF.door[1], PF.door[2], PF.door[3], dx2 + open * dw2, dy2, dw2, dh2);
        if (!spr(PF.coup, x + CAR_W + 9, y0 + 48, 16, 16 * PF.coup[3] / PF.coup[2])) api.rect(x + CAR_W, y0 + 46, 10, 4, "#2a2a30"); // coupler arm
        if (car.pop > 0) { api.rect(x + CAR_W + 10, y0 + 40 - (18 - car.pop), 3, 6, "#c8c8d0"); for (let i = 0; i < 3; i++) api.rect(x + CAR_W + 8 + api.rnd(-4, 8), y0 + 44 + api.rnd(-6, 6), 1, 1, "#ffe060"); }
      } else {
      api.rect(x, y0, CAR_W, y1 - y0, "#7a2e1c");''')
rep('''      if (car.pop > 0) { api.rect(x + CAR_W + 10, y0 + 40 - (18 - car.pop), 3, 6, "#c8c8d0"); for (let i = 0; i < 3; i++) api.rect(x + CAR_W + 8 + api.rnd(-4, 8), y0 + 44 + api.rnd(-6, 6), 1, 1, "#ffe060"); }
      c.restore();''','''      if (car.pop > 0) { api.rect(x + CAR_W + 10, y0 + 40 - (18 - car.pop), 3, 6, "#c8c8d0"); for (let i = 0; i < 3; i++) api.rect(x + CAR_W + 8 + api.rnd(-4, 8), y0 + 44 + api.rnd(-6, 6), 1, 1, "#ffe060"); }
      }
      c.restore();''')
# tunnel cliff (back)
rep('''      if (ev.kind === "tunnel") {
        // rugged mesa cliff''','''      if (ev.kind === "tunnel" && pimg()) { // painted mesa cliff, dark bore, painted exit cliff
        box(PF.cliff, x - 236, -18, 238, ROOF_Y + 19);
        api.rect(x, 0, TUN_LEN, ROOF_Y, "#1c120e");
        for (let i = 0; i < TUN_LEN; i += 40) api.rect(x + i + ((i / 40) % 2) * 20, 30 + ((i * 7) % 50), 18, 2, "#2c1e16");
        for (let i = 0; i < TUN_LEN; i += 180) { const lx = x + 90 + i; if (lx > -20 && lx < api.W + 20) { api.rect(lx - 2, 70, 4, 6, "#ffb040"); c.globalAlpha = 0.5; glow(c, lx, 73, 22, "rgba(255,170,60,0.8)"); c.globalAlpha = 1; } }
        box(PF.cliff, x + TUN_LEN - 2, -18, 190, ROOF_Y + 19, true);
      } else if (ev.kind === "tunnel") {
        // rugged mesa cliff''')
# water tower (back)
rep('''        const tx = x + 30; if (tx < -90 || tx > api.W + 90) return;
        for (const o''','''        const tx = x + 30; if (tx < -90 || tx > api.W + 90) return;
        if (box(PF.tower, tx - 33, ROOF_Y + 1 - 66 * PF.tower[3] / PF.tower[2], 66, 66 * PF.tower[3] / PF.tower[2])) return; // painted water tower
        for (const o''')
# portal front
rep('''        if (x > -40 && x < api.W + 40) {
          c.fillStyle = "#8a7a6a"; c.fillRect(x - 12, 0, 18, top - 50);''','''        if (x > -40 && x < api.W + 40 && pimg()) { // painted stone pillar + bolted timber lintel along the slant
          box(PF.pillar, x - 13, -4, 20, top - 46);
          along(PF.beam, x - 2, top - 53, x - 2 + (bot - top) * SLANT, bot - 52, 13);
          api.rect(x - 14 + (bot - top) * SLANT, bot - 70, 24, 12, "#e8c040"); api.rect(x - 14 + (bot - top) * SLANT, bot - 70, 24, 1, "#fff0a0"); api.ptext("LOW", x - 2 + (bot - top) * SLANT, bot - 68, 1, "#1a1008");
        } else if (x > -40 && x < api.W + 40) {
          c.fillStyle = "#8a7a6a"; c.fillRect(x - 12, 0, 18, top - 50);''')
# spout front
rep('''          c.strokeStyle = "#3a2a1c"; c.lineWidth = 3; c.beginPath(); c.moveTo(tx - 30, 44); c.lineTo(laneX(x, top) - 2, top - 14); c.stroke();
          c.lineWidth = 8;''','''          if (pimg()) { // painted spout pipe swung down across the roof (chain from the tank), flared mouth at the near end
            c.strokeStyle = "#2a2018"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(tx - 22, 60); c.lineTo(laneX(x, top) - 2, top - 14); c.stroke();
            along(PF.pipe, laneX(x, top - 4) - 1, top - 13, laneX(x, bot) + 1, bot - 9, 8);
          } else {
          c.strokeStyle = "#3a2a1c"; c.lineWidth = 3; c.beginPath(); c.moveTo(tx - 30, 44); c.lineTo(laneX(x, top) - 2, top - 14); c.stroke();
          c.lineWidth = 8;''')
rep('''          for (let i = 0; i < 4; i++) { const yy = api.lerp(top, bot, (i + 0.5) / 4); api.rect(laneX(x, yy) - 4, yy - 13, 8, 2, "#2a2a30"); }''','''          for (let i = 0; i < 4; i++) { const yy = api.lerp(top, bot, (i + 0.5) / 4); api.rect(laneX(x, yy) - 4, yy - 13, 8, 2, "#2a2a30"); }
          }''')
# hats
rep('''        const x = Math.round(e.x - cx + hx * k * f), y = Math.round(e.y - e.z - h * k + 3), col = HATC[e.type];
''','''        const x = Math.round(e.x - cx + hx * k * f), y = Math.round(e.y - e.z - h * k + 3), col = HATC[e.type];
        if (box(PF[HATS[e.type] || "hat"], x - 9, y - 6.5, 18, 18 * PF.hat[3] / PF.hat[2], f < 0)) continue; // painted cowboy hat
''')
rep('''  const hats = {''','''  const HATS = { purple: "hat", blue: "hatK", sword: "hatK", star: "hatT", dasher: "hatT", gunner: "hat", heavy: "hatK" }; // painted hat tone per type
  const hats = {''')
# thrown
rep('''    c.save(); c.translate(x, y); c.rotate(api.t * 0.18 * (s.vx < 0 ? -1 : 1));
    if (s.box)''','''    const rot = api.t * 0.18 * (s.vx < 0 ? -1 : 1);
    if (s.box ? spr(PF.crate, x, y, 21, 21 * PF.crate[3] / PF.crate[2], rot) : spr(PF.rock, x, y, 23, 23 * PF.rock[3] / PF.rock[2], rot)) return; // painted crate / boulder
    c.save(); c.translate(x, y); c.rotate(rot);
    if (s.box)''')
# lifted boulder
rep('''if (s === "attack" && e.mv === "lift" && e.boulder && fr === "crate") { const c = api.ctx;''','''if (s === "attack" && e.mv === "lift" && e.boulder && fr === "crate" && spr(PF.rock, sx + f * 2, sy - 86, 38, 38 * PF.rock[3] / PF.rock[2])) { /* painted boulder held overhead */ }
      else if (s === "attack" && e.mv === "lift" && e.boulder && fr === "crate") { const c = api.ctx;''')
# coal
rep('''        drawG(api, "hurt", sx, sy + 18, 1); // emerging from the heap
        const c = api.ctx;''','''        drawG(api, "hurt", sx, sy + 18, 1); // emerging from the heap
        if (box(PF.coal, sx - 50, sy + 27 - 100 * PF.coal[3] / PF.coal[2], 100, 100 * PF.coal[3] / PF.coal[2])) return; // painted coal heap
        const c = api.ctx;''')
rep('''    images: [DES, GAT],''','''    images: [DES, GAT, PR_IMG],''')
open('level11.js','w').write(s)
