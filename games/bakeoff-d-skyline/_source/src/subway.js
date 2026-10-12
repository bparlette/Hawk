  // =====================================================================================================
  // ---------- SUBWAY (new): two street kiosks, the X line under the city: TORTUGA ST and CANAL WORKS stations, ----------
  // ---------- the tunnel between them, and an express that tears through every so often ----------
  // Layout (y down to -13): far wall z 41, live track z 41.1..45 (floor TY), platforms / tunnel service way z 45..52 (back wall 52.2).
  // Platform 1 x 8..70, ramp down 70..73, tunnel 73..147 (service way at track level), ramp up 147..150, platform 2 x 150..210.
  // The camera sits over the platform side looking across the track at the tiled far wall (and the trains).
  // =====================================================================================================
  const SUB = { PY: -12, TY: -12.95, CY: -7.4, zW: 41.0, zT: 41.1, zE: 45.0, zB: 52.2, zBw: 52.0, P1: [8, 70], P2: [150, 210], R1: [70, 73], R2: [147, 150], x0: -10, x1: 230,
    trainZ: 43.05, trainW: 3.2, carL: 12, carGap: 0.45, cars: 4, carH: 3.95 };
  WORLD.SUB = SUB;
  function subFloor(gx, gz) {
    if (gx < SUB.P1[0] + 0.4 || gx > SUB.P2[1] - 0.4) return null;
    if (gz >= SUB.zT && gz < SUB.zE) return SUB.TY;
    if (gz < SUB.zE || gz > SUB.zBw) return null;
    const [a, b] = SUB.P1, [c, d] = SUB.P2;
    if (gx >= a && gx <= b) return SUB.PY;
    if (gx > SUB.R1[0] && gx < SUB.R1[1]) return SUB.PY + (SUB.TY - SUB.PY) * (gx - SUB.R1[0]) / (SUB.R1[1] - SUB.R1[0]);
    if (gx >= SUB.R1[1] && gx <= SUB.R2[0]) return SUB.TY;
    if (gx > SUB.R2[0] && gx < SUB.R2[1]) return SUB.TY + (SUB.PY - SUB.TY) * (gx - SUB.R2[0]) / (SUB.R2[1] - SUB.R2[0]);
    if (gx >= c && gx <= d) return SUB.PY;
    return null;
  }
  const onTrack = (gx, gz, gy) => gz >= SUB.zT - 0.05 && gz < SUB.zE - 0.02 && gy < SUB.TY + 1.3;
  // ---- canvas art: station-name mosaics, hanging signs, posters (original made-up ads), kiosk signs ----
  function mosaicTex(name) {
    return canvasTex(1024, 256, (g, w, h) => {
      const T = 8; // tile px
      const off = document.createElement("canvas"); off.width = w / T; off.height = h / T; const o = off.getContext("2d");
      o.fillStyle = "#e9dfc4"; o.fillRect(0, 0, off.width, off.height);
      o.fillStyle = "#7a1e22"; o.fillRect(0, 0, off.width, 3); o.fillRect(0, off.height - 3, off.width, 3); o.fillRect(0, 0, 3, off.height); o.fillRect(off.width - 3, 0, 3, off.height);
      o.fillStyle = "#1e6a6a"; for (let i = 0; i < off.width; i += 4) { o.fillRect(i, 1, 2, 1); o.fillRect(i + 2, off.height - 2, 2, 1); }
      o.fillStyle = "#c8902a"; for (let i = 6; i < off.height - 6; i += 3) { o.fillRect(1, i, 1, 1); o.fillRect(off.width - 2, i, 1, 1); }
      o.fillStyle = "#14243a"; o.font = "bold 17px Arial, Helvetica"; o.textAlign = "center"; o.textBaseline = "middle"; o.fillText(name, off.width / 2, off.height / 2 + 1);
      const d = o.getImageData(0, 0, off.width, off.height).data;
      g.fillStyle = "#6a6458"; g.fillRect(0, 0, w, h); // grout
      for (let y = 0; y < off.height; y++) for (let x = 0; x < off.width; x++) {
        const i = (y * off.width + x) * 4; let r = d[i], gg = d[i + 1], b = d[i + 2];
        if (r + gg + b > 300 && r + gg + b < 600 && Math.abs(r - 233) + Math.abs(gg - 223) + Math.abs(b - 196) > 60) { const k = (r + gg + b) / 3 > 120 ? [233, 223, 196] : [20, 36, 58]; [r, gg, b] = k; } // no anti-alias greys: tiles are one colour
        const v = (Math.random() - 0.5) * 22; g.fillStyle = `rgb(${r + v | 0},${gg + v | 0},${b + v | 0})`; g.fillRect(x * T + 1, y * T + 1, T - 1.6, T - 1.6);
        g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(x * T + 1.5, y * T + 1.5, T - 4, 1.4);
      }
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(40,30,10,0.18)"); gr.addColorStop(1, "rgba(30,20,5,0.32)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) { g.fillStyle = "rgba(90,60,20,0.18)"; g.fillRect(Math.random() * w, 0, 3 + Math.random() * 4, h * (0.3 + Math.random() * 0.7)); }
    });
  }
  function bullet(g, x, y, r, txt) {
    g.fillStyle = "#f07a1a"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = "#fff"; g.font = `bold ${Math.round(r * 1.35)}px Arial, Helvetica`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, x, y + r * 0.06);
  }
  function hangSignTex(name, sub) {
    return canvasTex(1024, 192, (g, w, h) => {
      g.fillStyle = "#0c0c0e"; g.fillRect(0, 0, w, h); g.fillStyle = "#f2f2f2"; g.fillRect(0, 10, w, 5);
      g.fillStyle = "#fff"; g.font = "bold 92px Arial, Helvetica"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(name, 40, 98);
      const tw = g.measureText(name).width;
      bullet(g, tw + 120, 98, 46, "X");
      g.font = "bold 34px Arial, Helvetica"; g.fillStyle = "#cfcfcf"; g.fillText(sub, tw + 190, 98);
    });
  }
  // posters: an atlas of six made-up 80s subway ads (3 x 2 cells, 512 x 300 each)
  const POSTERS = [
    (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#ffcf3a"); gr.addColorStop(1, "#ff7a1a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = "#c8281e"; g.beginPath(); g.moveTo(330, 60); g.lineTo(480, 120); g.lineTo(330, 250); g.closePath(); g.fill(); g.fillStyle = "#ffe8a0"; g.beginPath(); g.moveTo(345, 80); g.lineTo(460, 122); g.lineTo(345, 228); g.closePath(); g.fill();
      g.fillStyle = "#b8201a"; for (const [x, y] of [[380, 120], [410, 150], [372, 180]]) { g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); }
      g.fillStyle = "#3a1208"; g.font = "bold 58px Impact, Arial Black, Arial"; g.textAlign = "left"; g.fillText("SLICE KING", 26, 92); g.font = "bold 30px Arial Black, Arial"; g.fillText("2 SLICES + SODA", 28, 150); g.fillStyle = "#fff"; g.font = "bold 64px Impact, Arial"; g.fillText("$1.99", 30, 228); g.fillStyle = "#3a1208"; g.font = "bold 18px Arial"; g.fillText("OPEN TIL 4 A.M. - CANAL & 3RD", 30, 272); },
    (g, w, h) => { g.fillStyle = "#12305a"; g.fillRect(0, 0, w, h); g.fillStyle = "#1a4a8a"; g.beginPath(); g.arc(400, 150, 110, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "bold 150px Arial Black, Arial"; g.textAlign = "center"; g.fillText("7", 400, 205);
      g.textAlign = "left"; g.fillStyle = "#ff3a30"; g.font = "bold 50px Arial Black, Arial"; g.fillText("CHANNEL 7", 24, 80); g.fillStyle = "#fff"; g.font = "bold 36px Arial Black, Arial"; g.fillText("NEWS AT 11", 26, 130); g.font = "italic bold 22px Arial"; g.fillStyle = "#ffd84a"; g.fillText("WHEN THE CITY BURNS,", 26, 200); g.fillText("WE'RE ALREADY THERE.", 26, 230); },
    (g, w, h) => { g.fillStyle = "#f4f0e4"; g.fillRect(0, 0, w, h); g.fillStyle = "#1a1a1a"; g.font = "bold 44px Arial Black, Arial"; g.textAlign = "left"; g.fillText("DROPPED OUT?", 24, 70); g.fillStyle = "#c8201a"; g.font = "bold 70px Impact, Arial"; g.fillText("GET YOUR", 24, 150); g.fillText("DIPLOMA", 24, 222);
      g.fillStyle = "#1a1a1a"; g.font = "bold 24px Arial"; g.fillText("CALL 1-800-LEARN-UP", 26, 272); g.fillStyle = "#e8b020"; g.beginPath(); g.moveTo(390, 120); g.lineTo(490, 160); g.lineTo(390, 200); g.lineTo(290, 160); g.closePath(); g.fill(); g.fillStyle = "#1a1a1a"; g.fillRect(386, 160, 8, 70); },
    (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#ff3fa0"); gr.addColorStop(1, "#5a2ad8"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = "#fff"; g.save(); g.translate(360, 160); g.rotate(-0.35); g.fillRect(-90, -30, 180, 60); g.fillStyle = "#111"; g.fillRect(-90, 22, 180, 12); g.fillStyle = "#ff3fa0"; g.fillRect(-40, -22, 60, 10); g.restore();
      g.fillStyle = "#fff"; g.font = "italic bold 62px Impact, Arial"; g.textAlign = "left"; g.fillText("KICK-ITS", 24, 84); g.font = "bold 26px Arial Black, Arial"; g.fillText("JUMP HIGHER.", 26, 210); g.fillText("RUN THE BLOCK.", 26, 246); },
    (g, w, h) => { g.fillStyle = "#e8f4ff"; g.fillRect(0, 0, w, h); g.fillStyle = "#2a8a3a"; g.beginPath(); g.ellipse(400, 160, 80, 100, 0, 0, 7); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.ellipse(380, 130, 18, 26, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(420, 130, 18, 26, 0, 0, 7); g.fill();
      g.fillStyle = "#123"; g.font = "bold 40px Arial Black, Arial"; g.textAlign = "left"; g.fillText("DR. ZEE'S", 24, 70); g.fillStyle = "#2a8a3a"; g.font = "bold 58px Impact, Arial"; g.fillText("ZIT-ZAP", 24, 140); g.fillStyle = "#123"; g.font = "bold 22px Arial"; g.fillText("CLEAR SKIN IN 7 DAYS", 26, 200); g.fillText("OR YOUR MONEY BACK!", 26, 230); },
    (g, w, h) => { g.fillStyle = "#101018"; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,${180 + Math.random() * 75 | 0},${Math.random()})`; g.fillRect(Math.random() * w, Math.random() * 140, 2, 2); }
      g.fillStyle = "#2a2a40"; for (let i = 0; i < 9; i++) g.fillRect(250 + i * 28, 300 - (40 + (i * 37) % 120), 24, 200); g.fillStyle = "#ffd84a"; for (let i = 0; i < 40; i++) g.fillRect(254 + (i % 9) * 28 + (i % 3) * 6, 190 + ((i * 13) % 90), 4, 5);
      g.fillStyle = "#7fe8ff"; g.font = "bold 50px Arial Black, Arial"; g.textAlign = "left"; g.fillText("RIDE THE X", 24, 70); g.fillStyle = "#fff"; g.font = "bold 24px Arial"; g.fillText("ALL NIGHT. ALL TOWN.", 26, 112); g.fillStyle = "#ffb04a"; g.font = "bold 20px Arial"; g.fillText("FARE: ONE TOKEN", 26, 270); },
  ];
  function posterAtlas() {
    return canvasTex(1536, 600, (g) => {
      POSTERS.forEach((fn, i) => {
        const cx = (i % 3) * 512, cy = Math.floor(i / 3) * 300;
        g.save(); g.translate(cx, cy); g.beginPath(); g.rect(0, 0, 512, 300); g.clip(); fn(g, 512, 300);
        // grime, a torn corner, a marker tag
        const gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, "rgba(30,20,10,0.05)"); gr.addColorStop(1, "rgba(30,20,10,0.35)"); g.fillStyle = gr; g.fillRect(0, 0, 512, 300);
        if (i % 2 === 0) { g.fillStyle = "#d8d0b8"; g.beginPath(); g.moveTo(512, 300); g.lineTo(440, 300); g.lineTo(512, 236); g.closePath(); g.fill(); }
        g.strokeStyle = ["#111", "#e02a8a", "#1a1a1a"][i % 3]; g.lineWidth = 5; g.beginPath(); const tx = 60 + (i * 97) % 300, ty = 180 + (i * 53) % 80; g.moveTo(tx, ty);
        for (let k = 0; k < 7; k++) g.lineTo(tx + k * 14 + Math.sin(k * 2 + i) * 8, ty + Math.cos(k * 1.7 + i) * 18); g.stroke();
        g.lineWidth = 10; g.strokeStyle = "#c8c0a8"; g.strokeRect(0, 0, 512, 300); g.restore();
      });
    });
  }
  function kioskSignTex(name) {
    return canvasTex(768, 128, (g, w, h) => {
      g.fillStyle = "#0e0f12"; g.fillRect(0, 0, w, h); g.strokeStyle = "#3a3d44"; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = "#fff"; g.font = "bold 66px Arial, Helvetica"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText("SUBWAY", 26, 66);
      bullet(g, 330, 64, 36, "X"); g.font = "bold 40px Arial, Helvetica"; g.fillStyle = "#e8e8e8"; g.fillText(name, 384, 66);
    });
  }
  function frontTex() { // the lead car's cab end: headlights, route bullet, destination sign
    return canvasTex(256, 320, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#6a6e76"); gr.addColorStop(0.5, "#a8acb4"); gr.addColorStop(1, "#5a5e66"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = "#2a2c30"; for (let y = 6; y < h; y += 14) g.fillRect(0, y, w, 2);
      g.fillStyle = "#14161a"; g.fillRect(88, 40, 80, 150); g.fillStyle = "#e8b048"; g.fillRect(96, 52, 64, 74); // door window, warm cab light
      g.fillStyle = "#111"; g.fillRect(14, 50, 64, 34); g.fillStyle = "#ffb43a"; g.font = "bold 20px Arial"; g.textAlign = "center"; g.fillText("CANAL", 46, 74);
      bullet(g, 210, 66, 26, "X");
      g.fillStyle = "#1a1a1a"; g.fillRect(20, 214, 52, 40); g.fillRect(184, 214, 52, 40);
      g.fillStyle = "#fffbe8"; g.beginPath(); g.arc(46, 234, 15, 0, 7); g.fill(); g.beginPath(); g.arc(210, 234, 15, 0, 7); g.fill();
      g.fillStyle = "#ff3a30"; g.fillRect(28, 270, 22, 10); g.fillRect(206, 270, 22, 10);
      g.fillStyle = "#e05a1a"; g.font = "bold 16px Arial"; g.fillText("3407", 128, 300);
      g.fillStyle = "rgba(255,90,200,0.85)"; g.font = "italic bold 30px Impact, Arial"; g.save(); g.translate(128, 170); g.rotate(-0.2); g.fillText("ZOOM!", 0, 0); g.restore();
    });
  }
  // ---- build ----
  function buildSubway() {
    const G = WORLD.groups, S = SUB, B = new Builder();
    const subwall = lam(tex("tex/subway_wall.jpg", true)), tunwall = lam(tex("tex/tunnel_wall.jpg", true), { color: 0x9a9a9a });
    const pfloor = lam(tex("tex/platform_floor.jpg", true), { color: 0x8a8a88 }), tbed = lam(tex("tex/track_bed.jpg", true), { color: 0x9a948c });
    const ceilM = lam(canvasTex(128, 128, (g) => { g.fillStyle = "#26282c"; g.fillRect(0, 0, 128, 128); g.fillStyle = "#1a1b1e"; g.fillRect(0, 56, 128, 16); g.fillRect(56, 0, 16, 128); g.fillStyle = "rgba(255,255,255,0.05)"; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3); }, true));
    const concrete = lam(tex("tex/sidewalk.jpg", true), { color: 0x7a7874 });
    const H = S.CY - S.TY, wallRep = H * (1024 / 572); // metres per wall texture repeat (true aspect)
    const stations = [[S.P1[0] - 2, S.R1[1] + 1], [S.R2[0] - 1, S.P2[1] + 2]];
    const inStation = (x) => stations.some(([a, b]) => x >= a && x <= b);
    // far wall (z 41, faces the camera): tile in the stations, tunnel concrete between, in 3 m strips so the change is clean
    for (let x = -100; x < 330; x += 3) {
      const st = inStation(x + 1.5);
      if (st) B.wall(subwall, x, S.zW, x + 3, S.zW, S.TY, S.CY, x / wallRep, 0, (x + 3) / wallRep, 1);
      else B.wall(tunwall, x, S.zW, x + 3, S.zW, S.TY, S.CY, x / 5.5, 0, (x + 3) / 5.5, 1);
    }
    // niches in the tunnel stretch: dark recesses every 15 m (drawn as dark panels with a lip)
    const nicheM = lam(null, { color: 0x0c0c0e });
    for (let x = 80; x < 145; x += 15) B.wall(nicheM, x, S.zW + 0.01, x + 1.4, S.zW + 0.01, S.TY + 0.05, S.TY + 2.2);
    // back wall (behind the camera) + end walls
    for (let x = -100; x < 330; x += 3) {
      const st = inStation(x + 1.5), y0 = st && x >= S.P1[0] && x < S.R1[0] || st && x >= S.P2[0] - 0.01 && x < S.P2[1] ? S.PY : S.TY;
      if (st) B.wall(subwall, x + 3, S.zB, x, S.zB, y0, S.CY, x / wallRep, 0, (x + 3) / wallRep, 1, [0.8, 0.8, 0.8]);
      else B.wall(tunwall, x + 3, S.zB, x, S.zB, S.TY, S.CY, x / 5.5, 0, (x + 3) / 5.5, 1, [0.7, 0.7, 0.7]);
    }
    // ceiling
    B.floor(ceilM, -100, S.zW, 330, S.zB, S.CY, 3, [0.8, 0.8, 0.85], true);
    // live track bed (ties run across): explicit uv so the ties are perpendicular to the track
    const tieRep = 4.8; // metres per texture repeat along the track
    B.quad(tbed, [-100, S.TY, S.zE], [330, S.TY, S.zE], [330, S.TY, S.zW], [-100, S.TY, S.zW], [[-100 / tieRep, 0], [330 / tieRep, 0], [330 / tieRep, 1], [-100 / tieRep, 1]]);
    // the out-of-service track 2 under the tunnel service way (and beyond both stations), same bed, darker
    for (const [a, b] of [[S.R1[0], S.R2[1]]]) B.quad(tbed, [a, S.TY, S.zB], [b, S.TY, S.zB], [b, S.TY, S.zE], [a, S.TY, S.zE], [[a / tieRep, 0], [b / tieRep, 0], [b / tieRep, 1], [a / tieRep, 1]], [0.62, 0.58, 0.55]);
    // platforms: top (concrete slabs), yellow edge strip, edge face, end walls
    const strip = lam(canvasTex(128, 64, (g, w, h) => { g.fillStyle = "#e8c22a"; g.fillRect(0, 0, w, h); g.fillStyle = "#c89e14"; for (let x = 4; x < w; x += 12) for (let y = 6; y < h - 10; y += 12) { g.beginPath(); g.arc(x + (y % 24 ? 6 : 0), y, 3.2, 0, 7); g.fill(); } g.fillStyle = "#f4f0e0"; g.fillRect(0, h - 8, w, 8); g.fillStyle = "rgba(40,30,10,0.25)"; for (let i = 0; i < 16; i++) g.fillRect(Math.random() * w, Math.random() * h, 6, 3); }, true));
    for (const [a, b] of [S.P1, S.P2]) {
      B.floor(pfloor, a, S.zE + 0.55, b, S.zB, S.PY, 3.2);
      B.quad(strip, [a, S.PY + 0.004, S.zE + 0.55], [b, S.PY + 0.004, S.zE + 0.55], [b, S.PY + 0.004, S.zE], [a, S.PY + 0.004, S.zE], [[a / 1.2, 0], [b / 1.2, 0], [b / 1.2, 1], [a / 1.2, 1]]);
      B.wall(concrete, b, S.zE, a, S.zE, S.TY, S.PY, b / 3, 0, a / 3, 0.3, [0.45, 0.45, 0.45]); // edge face (toward the track)
    }
    // platform end walls facing out to the stairs side (x 8 faces +x, x 210 faces -x) with stairwell openings z 46..49.4
    const SO = [46.0, 49.4];
    B.wall(subwall, S.P1[0], SO[0], S.P1[0], S.zE, S.TY, S.CY, 0, 0, (SO[0] - S.zE) / wallRep, 1); B.wall(subwall, S.P1[0], S.zB, S.P1[0], SO[1], S.TY, S.CY, 0, 0, (S.zB - SO[1]) / wallRep, 1);
    B.wall(subwall, S.P1[0], SO[1], S.P1[0], SO[0], S.PY + 2.9, S.CY, 0, 0.5, (SO[1] - SO[0]) / wallRep, 1);
    B.wall(subwall, S.P2[1], SO[1], S.P2[1], S.zB, S.TY, S.CY, 0, 0, (S.zB - SO[1]) / wallRep, 1); B.wall(subwall, S.P2[1], S.zE, S.P2[1], SO[0], S.TY, S.CY, 0, 0, (SO[0] - S.zE) / wallRep, 1);
    B.wall(subwall, S.P2[1], SO[0], S.P2[1], SO[1], S.PY + 2.9, S.CY, 0, 0.5, (SO[1] - SO[0]) / wallRep, 1);
    // below-platform faces at the station ends (the platform is solid down to the bed)
    B.wall(concrete, S.P1[0], S.zB, S.P1[0], S.zE, S.TY, S.PY, 0, 0, 2, 0.3, [0.4, 0.4, 0.4]);
    B.wall(concrete, S.P2[1], S.zE, S.P2[1], S.zB, S.TY, S.PY, 0, 0, 2, 0.3, [0.4, 0.4, 0.4]);
    // stairwells up to the street (steps rising away from the platform, lit from above)
    const stairs = (x0, dir) => {
      const n = 14, run = 0.42, rise = 0.21;
      for (let i = 0; i < n; i++) {
        const xa = x0 - dir * i * run, xb = xa - dir * run, y = S.PY + (i + 1) * rise;
        const [l, r] = dir > 0 ? [xb, xa] : [xa, xb];
        B.floor(concrete, l, SO[0], r, SO[1], y, 1.5, [0.75, 0.75, 0.78]);
        B.quad(concrete, dir > 0 ? [xa, y - rise, SO[1]] : [xa, y - rise, SO[0]], dir > 0 ? [xa, y - rise, SO[0]] : [xa, y - rise, SO[1]], dir > 0 ? [xa, y, SO[0]] : [xa, y, SO[1]], dir > 0 ? [xa, y, SO[1]] : [xa, y, SO[0]], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]], [0.5, 0.5, 0.52]);
      }
      const xe = x0 - dir * n * run;
      const [l, r] = dir > 0 ? [xe, x0] : [x0, xe];
      B.wall(subwall, l, SO[0], r, SO[0], S.PY, S.PY + n * rise + 2.6, 0, 0, (r - l) / wallRep, 1, [0.85, 0.85, 0.85]); // side walls
      B.wall(subwall, r, SO[1], l, SO[1], S.PY, S.PY + n * rise + 2.6, 0, 0, (r - l) / wallRep, 1, [0.85, 0.85, 0.85]);
      B.quad(ceilM, dir > 0 ? [x0, S.PY + 2.9, SO[0]] : [x0, S.PY + 2.9, SO[1]], dir > 0 ? [x0, S.PY + 2.9, SO[1]] : [x0, S.PY + 2.9, SO[0]], dir > 0 ? [xe, S.PY + n * rise + 2.6, SO[1]] : [xe, S.PY + n * rise + 2.6, SO[0]], dir > 0 ? [xe, S.PY + n * rise + 2.6, SO[0]] : [xe, S.PY + n * rise + 2.6, SO[1]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      const glowM = new THREE.MeshBasicMaterial({ map: canvasTex(64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#ffd8a0"); gr.addColorStop(0.6, "#7a6040"); gr.addColorStop(1, "#1a1612"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }), fog: false });
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(SO[1] - SO[0], 3.2), glowM); gl.position.set(xe + dir * 0.02, S.PY + n * rise + 1.4, (SO[0] + SO[1]) / 2); gl.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; G.subway.add(gl);
      WORLD.lights.push({ reg: "subway", x: x0 - dir * 2.5, y: S.PY + 3.2, z: (SO[0] + SO[1]) / 2, c: 0xffd29a, i: 14, d: 8 });
    };
    stairs(S.P1[0], 1); stairs(S.P2[1], -1);
    // ramps down to the tracks at the platform ends (6 steps), with a warning sign
    const ramp = (xa, xb) => {
      const n = 6, up = xb < xa;
      for (let i = 0; i < n; i++) {
        const k0 = i / n, k1 = (i + 1) / n, x0 = xa + (xb - xa) * k0, x1 = xa + (xb - xa) * k1, y = S.PY + (S.TY - S.PY) * k1;
        const [l, r] = x0 < x1 ? [x0, x1] : [x1, x0]; B.floor(concrete, l, S.zE, r, S.zB, y, 1.6, [0.7, 0.7, 0.72]);
        const yTop = S.PY + (S.TY - S.PY) * k0; if (i > 0) B.quad(concrete, up ? [x0, y, S.zE] : [x0, y, S.zB], up ? [x0, y, S.zB] : [x0, y, S.zE], up ? [x0, yTop, S.zB] : [x0, yTop, S.zE], up ? [x0, yTop, S.zE] : [x0, yTop, S.zB], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]], [0.45, 0.45, 0.48]);
      }
    };
    ramp(S.R1[0], S.R1[1]); ramp(S.R2[1], S.R2[0]);
    // rails: two running rails + the third rail with its wooden cover board (live track), rusty rails on track 2 (tunnel stretch)
    {
      const steel = [], rust = [], board = [];
      const rail = (arr, x0, x1, z, y, w, h) => { const g = new THREE.BoxGeometry(x1 - x0, h, w); g.translate((x0 + x1) / 2, y + h / 2, z); arr.push(g); };
      rail(steel, -100, 330, S.trainZ - 0.72, S.TY, 0.08, 0.16); rail(steel, -100, 330, S.trainZ + 0.72, S.TY, 0.08, 0.16);
      rail(steel, -100, 330, 41.55, S.TY + 0.12, 0.1, 0.12); rail(board, -100, 330, 41.5, S.TY + 0.36, 0.42, 0.04);
      for (let x = -100; x < 330; x += 2.4) { const g = new THREE.BoxGeometry(0.1, 0.24, 0.1); g.translate(x, S.TY + 0.12, 41.78); board.push(g); }
      rail(rust, S.R1[0], S.R2[1], 48.0, S.TY, 0.08, 0.15); rail(rust, S.R1[0], S.R2[1], 49.45, S.TY, 0.08, 0.15);
      G.subway.add(new THREE.Mesh(mergeGeos(steel), new THREE.MeshLambertMaterial({ color: 0x9aa0aa, emissive: 0x15161a })));
      G.subway.add(new THREE.Mesh(mergeGeos(rust), new THREE.MeshLambertMaterial({ color: 0x6a4030 })));
      G.subway.add(new THREE.Mesh(mergeGeos(board), new THREE.MeshLambertMaterial({ color: 0x5a3a22 })));
    }
    // posters on the far wall (cross-track ads) + station-name mosaics, both stations
    const pos = posterAtlas(), posM = lam(pos);
    const mos1 = lam(mosaicTex("TORTUGA ST")), mos2 = lam(mosaicTex("CANAL WORKS"));
    const putPoster = (x, i) => { const cu = (i % 3) / 3, cv = Math.floor(i / 3) / 2; B.wall(posM, x, S.zW + 0.03, x + 3.2, S.zW + 0.03, S.TY + 1.55, S.TY + 1.55 + 1.875, cu, 1 - cv - 0.5, cu + 1 / 3, 1 - cv); };
    let pi = 0;
    for (const [a, b, mm] of [[S.P1[0], S.P1[1], mos1], [S.P2[0], S.P2[1], mos2]]) {
      for (let x = a + 3; x < b - 6; x += 12) {
        B.wall(mm, x, S.zW + 0.03, x + 4.4, S.zW + 0.03, S.TY + 3.75, S.TY + 4.85, 0, 0, 1, 1);
        putPoster(x + 6, pi++ % 6);
      }
    }
    B.build(G.subway);
    // hanging station signs (both faces) over the platform edge, every 15 m
    const hang1 = new THREE.MeshBasicMaterial({ map: hangSignTex("Tortuga St", "UPTOWN & CANAL"), color: 0xdddddd }), hang2 = new THREE.MeshBasicMaterial({ map: hangSignTex("Canal Works", "LAST STOP - THE LOT"), color: 0xdddddd });
    const signGeo = new THREE.PlaneGeometry(3.2, 0.6), rodM = new THREE.MeshLambertMaterial({ color: 0x1a1a1e });
    for (const [a, b, m] of [[S.P1[0], S.P1[1], hang1], [S.P2[0], S.P2[1], hang2]]) for (let x = a + 8; x < b - 3; x += 15) {
      for (const ry of [0, Math.PI]) { const s = new THREE.Mesh(signGeo, m); s.position.set(x, S.CY - 0.75, 46.3 + (ry ? -0.01 : 0.01)); s.rotation.y = ry; G.subway.add(s); }
      for (const dx of [-1.3, 1.3]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), rodM); r.position.set(x + dx, S.CY - 0.22, 46.3); G.subway.add(r); }
    }
    // steel I-beam columns: along the platform edge in the stations, between the tracks in the tunnel (hidden when the camera is close)
    WORLD.subCols = [];
    const colM = new THREE.MeshLambertMaterial({ map: canvasTex(32, 128, (g, w, h) => { g.fillStyle = "#2a5a7a"; g.fillRect(0, 0, w, h); g.fillStyle = "#1a3a50"; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h); g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(12, 0, 3, h); g.fillStyle = "#e8e0c8"; g.fillRect(4, 70, w - 8, 10); g.fillStyle = "rgba(60,30,10,0.4)"; for (let i = 0; i < 12; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 8); }) });
    const colGeo = new THREE.BoxGeometry(0.34, 1, 0.3);
    const addCol = (x, z, y0) => { const m = new THREE.Mesh(colGeo, colM); m.scale.y = S.CY - y0; m.position.set(x, (S.CY + y0) / 2, z); G.subway.add(m); WORLD.subCols.push(m); WORLD.cols.push({ layer: "subway", x, z, r: 0.28 }); };
    for (const [a, b] of [S.P1, S.P2]) for (let x = a + 12; x < b - 12; x += 7.5) addCol(x, 46.15, S.PY);
    for (let x = S.R1[1] + 4; x < S.R2[0] - 2; x += 6) addCol(x, 45.35, S.TY);
    // benches (wood slats on steel legs) + the off-hours waiting area sign
    const benchT = canvasTex(128, 64, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = ["#8a5a32", "#7a4e2a", "#946238", "#80522e"][i]; g.fillRect(0, i * 16, w, 14); } g.fillStyle = "rgba(0,0,0,0.3)"; for (let i = 0; i < 18; i++) g.fillRect(Math.random() * w, Math.random() * h, 8, 2); });
    const benchM = new THREE.MeshLambertMaterial({ map: benchT }), legM = new THREE.MeshLambertMaterial({ color: 0x1e2024 });
    const bench = (x, z) => {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.5), benchM); seat.position.set(x, S.PY + 0.48, z); G.subway.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.06), benchM); back.position.set(x, S.PY + 0.8, z + 0.25); G.subway.add(back);
      for (const dx of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.46), legM); l.position.set(x + dx, S.PY + 0.23, z); G.subway.add(l); }
      WORLD.cols.push({ layer: "subway", box: [x - 1.2, z - 0.28, x + 1.2, z + 0.3] });
    };
    for (const x of [24, 31.5, 54]) bench(x, 49.6);
    for (const x of [166, 181.5, 196]) bench(x, 49.6);
    const waitM = new THREE.MeshBasicMaterial({ map: canvasTex(512, 160, (g, w, h) => { g.fillStyle = "#f2c81e"; g.fillRect(0, 0, w, h); g.fillStyle = "#111"; g.fillRect(8, 8, w - 16, 6); g.fillRect(8, h - 14, w - 16, 6); g.font = "bold 40px Arial, Helvetica"; g.textAlign = "center"; g.fillText("OFF-HOURS", w / 2, 66); g.font = "bold 46px Arial, Helvetica"; g.fillText("WAITING AREA", w / 2, 120); }), color: 0xdddddd });
    for (const x of [27.75, 174]) for (const ry of [0, Math.PI]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.62), waitM); s.position.set(x, S.CY - 0.42, 48.4 + (ry ? -0.01 : 0.01)); s.rotation.y = ry; G.subway.add(s); }
    // fare control: three turnstiles + an open exit gate by the platform edge; a token booth by the stairs
    const steelM = new THREE.MeshLambertMaterial({ color: 0x9a9ea6, emissive: 0x101014 }), armM = new THREE.MeshLambertMaterial({ color: 0xd0d4dc });
    const turn = (x) => {
      for (let i = 0; i <= 3; i++) { const z = 47.25 + i * 1.6; const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.95, 0.42), steelM); h.position.set(x, S.PY + 0.475, Math.min(z, 51.95)); G.subway.add(h); }
      for (let i = 0; i < 3; i++) { const z = 47.25 + i * 1.6 + 0.8; for (let k = 0; k < 3; k++) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), armM); a.rotation.x = Math.PI / 2; a.rotation.y = k * 2.1; a.position.set(x, S.PY + 0.85 - k * 0.07, z); G.subway.add(a); } }
      const gate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 1.1), new THREE.MeshLambertMaterial({ color: 0x8a8e96, transparent: true, opacity: 0.85 })); gate.position.set(x + 0.5, S.PY + 0.65, 46.7); gate.rotation.y = 1.2; G.subway.add(gate);
      WORLD.cols.push({ layer: "subway", box: [x - 0.25, 47.05, x + 0.25, 52.2] });
    };
    turn(15); turn(203);
    const boothT = canvasTex(256, 160, (g, w, h) => { g.fillStyle = "#3a2a1e"; g.fillRect(0, 0, w, h); g.fillStyle = "#ffd890"; g.fillRect(20, 40, w - 40, 70); g.fillStyle = "rgba(60,40,20,0.5)"; g.fillRect(20, 40, w - 40, 6); g.fillStyle = "#111"; g.fillRect(0, 0, w, 32); g.fillStyle = "#fff"; g.font = "bold 24px Arial"; g.textAlign = "center"; g.fillText("TOKENS", w / 2, 24); g.fillStyle = "#5a4a3a"; g.fillRect(0, 120, w, 40); });
    for (const [x0, x1] of [[8.3, 12.6], [205.4, 209.7]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 2.6, 2.0), [new THREE.MeshLambertMaterial({ map: boothT }), new THREE.MeshLambertMaterial({ map: boothT }), new THREE.MeshLambertMaterial({ color: 0x2a221a }), new THREE.MeshLambertMaterial({ color: 0x2a221a }), new THREE.MeshLambertMaterial({ map: boothT, emissive: 0x2a2010 }), new THREE.MeshLambertMaterial({ map: boothT })]); m.position.set((x0 + x1) / 2, S.PY + 1.3, 51.2); G.subway.add(m); WORLD.cols.push({ layer: "subway", box: [x0, 50.2, x1, 52.2] }); WORLD.lights.push({ reg: "subway", x: (x0 + x1) / 2, y: S.PY + 1.6, z: 49.6, c: 0xffcf80, i: 8, d: 5 }); }
    const exitM = new THREE.MeshBasicMaterial({ map: canvasTex(512, 128, (g, w, h) => { g.fillStyle = "#0e0f12"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.font = "bold 52px Arial, Helvetica"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("EXIT  \u2191  STREET", w / 2, 66); }), color: 0xdddddd });
    for (const [x, ry] of [[S.P1[0] + 0.03, Math.PI / 2], [S.P2[1] - 0.03, -Math.PI / 2]]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), exitM); s.position.set(x, S.PY + 3.35, (SO[0] + SO[1]) / 2); s.rotation.y = ry; G.subway.add(s); }
    // fluorescent fixtures (stations) + work lights / blue phone lamps / signals (tunnel)
    const tubeM = new THREE.MeshBasicMaterial({ color: 0xe8fff4 });
    for (const [a, b] of [S.P1, S.P2]) for (let x = a + 2; x < b; x += 4.5) for (const z of [46.9, 50.6]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.16), tubeM); m.position.set(x, S.CY - 0.06, z); G.subway.add(m); }
    for (let x = -8; x < 228; x += 4.5) if (!inStation(x)) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.12), new THREE.MeshBasicMaterial({ color: 0xffb050 })); m.position.set(x, S.TY + 3.2, S.zW + 0.08); G.subway.add(m); }
    for (const [a, b] of [S.P1, S.P2]) for (let x = a + 4; x < b; x += 9) WORLD.lights.push({ reg: "subway", x, y: S.CY - 0.4, z: 47.6, c: 0xe2fff0, i: 20, d: 13, flick: x % 4 === 0 ? 1 : 0 });
    for (let x = -8; x < 228; x += 13.5) if (!inStation(x)) WORLD.lights.push({ reg: "subway", x, y: S.TY + 3.0, z: S.zW + 0.9, c: 0xffa648, i: 15, d: 11 });
    const blueM = new THREE.MeshBasicMaterial({ color: 0x3a7aff }), redM = new THREE.MeshBasicMaterial({ color: 0xff2a20 }), grnM = new THREE.MeshBasicMaterial({ color: 0x30ff70 });
    for (const x of [92, 128]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), blueM); m.position.set(x, S.TY + 2.6, S.zW + 0.18); G.subway.add(m); WORLD.lights.push({ reg: "subway", x, y: S.TY + 2.4, z: S.zW + 0.8, c: 0x3a7aff, i: 9, d: 6 }); }
    WORLD.signals = [];
    for (const x of [S.R1[1] + 1, S.R2[0] - 1, S.P1[0] - 6, S.P2[1] + 6]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.25), legM); box.position.set(x, S.TY + 2.0, S.zW + 0.2); G.subway.add(box);
      const r = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), redM); r.position.set(x, S.TY + 2.18, S.zW + 0.34); G.subway.add(r);
      const gg = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), grnM); gg.position.set(x, S.TY + 1.88, S.zW + 0.34); G.subway.add(gg);
      WORLD.signals.push({ r, g: gg });
    }
    // dust + third-rail sparks + fight fx for this region
    PART.sub = new Particles(160, false, G.subway); PART.subg = new Particles(220, true, G.subway);
    PART.subfx = new Particles(300, false, G.subway); PART.subfxg = new Particles(300, true, G.subway);
    buildTrain(G.subway);
    buildKiosks();
    // interacts: street kiosks <-> station stairs
    WORLD.inter.push(
      { layer: "street", x: 45.3, z: -9.4, r: 1.4, kind: "stairs", down: true, ex: 44.4, ez: -9.4, dx: -1, dz: 0, label: "DOWN TO THE SUBWAY", to: { layer: "subway", x: 9.9, z: 47.7, face: 1 } },
      { layer: "subway", x: 9.4, z: 47.7, r: 1.3, kind: "stairs", down: false, ex: 8.4, ez: 47.7, dx: -1, dz: 0, label: "UP TO THE STREET", to: { layer: "street", x: 46.0, z: -9.0, face: 1 } },
      { layer: "street", x: 151.6, z: -116.9, r: 1.4, kind: "stairs", down: true, ex: 151.6, ez: -117.8, dx: 0, dz: -1, label: "DOWN TO THE SUBWAY", to: { layer: "subway", x: 208.1, z: 47.7, face: -1 } },
      { layer: "subway", x: 208.6, z: 47.7, r: 1.3, kind: "stairs", down: false, ex: 209.6, ez: 47.7, dx: 1, dz: 0, label: "UP TO THE STREET", to: { layer: "street", x: 153.3, z: -116.4, face: -1 } },
    );
  }
  // ---- the train: four graffiti cars (painted side art, steel body, cab ends), headlights + a moving light ----
  function buildTrain(group) {
    const S = SUB, T = new THREE.Group(); group.add(T); T.visible = false;
    const sideT = tex("tex/subway_car.webp");
    const sideM = new THREE.MeshLambertMaterial({ map: sideT, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: sideT, emissiveIntensity: 0.18 });
    const bodyM = new THREE.MeshLambertMaterial({ color: 0x5a5e66 }), roofM = new THREE.MeshLambertMaterial({ color: 0x7a7e86 });
    const fT = frontTex(), frontM = new THREE.MeshLambertMaterial({ map: fT, emissive: 0xffffff, emissiveMap: fT, emissiveIntensity: 0.25 });
    const L = S.carL, Hh = S.carH, Wd = S.trainW, n = S.cars, total = n * L + (n - 1) * S.carGap;
    for (let i = 0; i < n; i++) {
      const cx = -total / 2 + L / 2 + i * (L + S.carGap);
      for (const sd of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(L, Hh), sideM); p.position.set(cx, Hh / 2, sd * Wd / 2); if (sd < 0) p.rotation.y = Math.PI; T.add(p); }
      const body = new THREE.Mesh(new THREE.BoxGeometry(L - 0.3, Hh * 0.62, Wd - 0.12), bodyM); body.position.set(cx, Hh * 0.55, 0); T.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(L - 0.1, 0.12, Wd - 0.3), roofM); roof.position.set(cx, Hh * 0.97, 0); T.add(roof);
      for (const e of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(Wd - 0.1, Hh * 0.78), frontM); f.position.set(cx + e * (L / 2 - 0.02), Hh * 0.52, 0); f.rotation.y = e * Math.PI / 2; T.add(f); }
    }
    // headlight glows (additive) on both ends: the leading end shows white, the trailing end red
    const glowT = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.2, "rgba(255,250,220,0.7)"); r.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = r; g.fillRect(0, 0, w, w); });
    const glows = [];
    for (const e of [-1, 1]) for (const dz of [-0.9, 0.9]) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.position.set(e * (total / 2 + 0.15), Hh * 0.26, dz); s.scale.set(1.6, 1.6, 1); s.userData.e = e; T.add(s); glows.push(s); }
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(18, 3.4), new THREE.MeshBasicMaterial({ map: canvasTex(256, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "rgba(255,245,210,0.55)"); gr.addColorStop(1, "rgba(255,245,210,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, "rgba(0,0,0,1)"); v.addColorStop(0.5, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,1)"); g.globalCompositeOperation = "destination-out"; g.fillStyle = v; g.fillRect(0, 0, w, h); }), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    beam.rotation.x = -Math.PI / 2; beam.position.y = 0.06; T.add(beam);
    const light = { reg: "subway", x: -9999, y: S.TY + 1.6, z: S.trainZ + 0.6, c: 0xfff0d0, i: 0, d: 28, train: true };
    WORLD.lights.push(light);
    const tail = { reg: "subway", x: -9999, y: S.TY + 1.2, z: S.trainZ + 0.6, c: 0xff4030, i: 0, d: 10, train: true };
    WORLD.lights.push(tail);
    WORLD.train3 = { T, glows, beam, light, tail, total };
  }
  // ---- street kiosks: a stairwell cut into the sidewalk, green iron railings, green globe lamps, a SUBWAY sign ----
  function buildKiosks() {
    const G = WORLD.groups, K = new Builder();
    const ironT = canvasTex(128, 64, (g, w, h) => { g.fillStyle = "#1e4a2a"; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); for (let x = 2; x < w; x += 16) g.fillRect(x, 0, 4, h); g.fillStyle = "#2e6a3c"; g.fillRect(0, 1, w, 2); }, true);
    const iron = new THREE.MeshLambertMaterial({ map: ironT, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, vertexColors: true });
    const tile = lam(tex("tex/subway_wall.jpg", true), { color: 0xc8c8c0 }), stepM = lam(tex("tex/sidewalk.jpg", true), { color: 0x9a9a9e });
    const postM = new THREE.MeshLambertMaterial({ color: 0x1a3a22 }), globeM = new THREE.MeshBasicMaterial({ color: 0x6aff9a });
    const glowT = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(140,255,170,0.9)"); r.addColorStop(1, "rgba(60,255,120,0)"); g.fillStyle = r; g.fillRect(0, 0, w, w); });
    const RH = 1.05, SW = 0.14;
    // k: opening x0..x1 / z0..z1, the stairs descend along (dx, dz) from the entry edge
    const kiosk = (o, name) => {
      const { x0, x1, z0, z1, dx, dz } = o, n = 16, rise = 0.2;
      const along = dx !== 0 ? x1 - x0 : z1 - z0, run = along / n;
      for (let i = 0; i < n; i++) {
        const y = SW - (i + 1) * rise;
        if (dx < 0) { const xa = x1 - i * run, xb = xa - run; K.floor(stepM, xb, z0, xa, z1, y, 1.2); K.quad(stepM, [xa, y, z1], [xa, y, z0], [xa, y + rise, z0], [xa, y + rise, z1], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]], [0.6, 0.6, 0.62]); }
        else { const za = z1 - i * run, zb = za - run; K.floor(stepM, x0, zb, x1, za, y, 1.2); K.quad(stepM, [x0, y, za], [x1, y, za], [x1, y + rise, za], [x0, y + rise, za], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]], [0.6, 0.6, 0.62]); }
      }
      const yb = SW - n * rise - 2.4, wr = 3.2;
      // inner stairwell walls (face inward), the far end wall, a glowing doorway at the bottom
      if (dx < 0) {
        K.wall(tile, x0, z0, x1, z0, yb, SW, 0, 0, (x1 - x0) / wr, 1); K.wall(tile, x1, z1, x0, z1, yb, SW, 0, 0, (x1 - x0) / wr, 1);
        K.wall(tile, x0, z1, x0, z0, yb, SW, 0, 0, (z1 - z0) / wr, 1);
      } else {
        K.wall(tile, x0, z1, x0, z0, yb, SW, 0, 0, (z1 - z0) / wr, 1); K.wall(tile, x1, z0, x1, z1, yb, SW, 0, 0, (z1 - z0) / wr, 1);
        K.wall(tile, x0, z0, x1, z0, yb, SW, 0, 0, (x1 - x0) / wr, 1);
      }
      // railings: three sides (open at the entry), as see-through iron panels
      const rails = dx < 0 ? [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1]] : [[x0, z0, x0, z1], [x1, z0, x1, z1], [x0, z0, x1, z0]];
      for (const [a, b, c, d] of rails) { const len = Math.hypot(c - a, d - b); K.wall(iron, a, b, c, d, SW, SW + RH, 0, 0, len / 0.9, 1); }
      // posts + globes at the entry corners
      const ent = dx < 0 ? [[x1, z0], [x1, z1]] : [[x0, z1], [x1, z1]];
      for (const [px, pz] of ent) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.5, 8), postM); post.position.set(px, SW + 1.25, pz); G.street.add(post);
        const gl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), globeM); gl.position.set(px, SW + 2.72, pz); G.street.add(gl);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.position.copy(gl.position); sp.scale.set(1.5, 1.5, 1); G.street.add(sp);
        WORLD.lights.push({ reg: "street", x: px, y: SW + 2.6, z: pz, c: 0x50ff80, i: 12, d: 7 });
        WORLD.cols.push({ x: px, z: pz, r: 0.15 });
      }
      WORLD.lights.push({ reg: "street", x: (x0 + x1) / 2, y: SW - 1.6, z: (z0 + z1) / 2, c: 0xffe0b0, i: 8, d: 5 });
      // the SUBWAY sign on the street-facing rail
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.48), new THREE.MeshBasicMaterial({ map: kioskSignTex(name), color: 0xe0e0e0 }));
      if (dx < 0) { sm.position.set((x0 + x1) / 2 - 0.2, SW + RH + 0.3, z1 + 0.02); }
      else { sm.position.set(x1 + 0.02, SW + RH + 0.3, (z0 + z1) / 2 + 0.2); sm.rotation.y = Math.PI / 2; }
      G.street.add(sm);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(dx < 0 ? 3.0 : 0.06, 0.06, dx < 0 ? 0.06 : 3.0), postM); bar.position.copy(sm.position); bar.position.y -= 0.27; G.street.add(bar);
      WORLD.cols.push({ box: [x0 - 0.1, z0 - 0.1, dx < 0 ? x1 - 0.35 : x1 + 0.1, dx < 0 ? z1 + 0.1 : z1 - 0.35] });
    };
    for (const h of WORLD.kiosks) kiosk(h, h.name);
    K.build(G.street);
  }
  // ---- sim: the express runs every ~25 s while you're down here; anything on the live track when it passes gets bowled over ----
  function updateTrain(p) {
    let T = STATE.train;
    if (!T) T = STATE.train = { state: "idle", t: 330, x: 0, dir: -1, warned: false, n: 0 };
    if (T.state === "idle") { if (--T.t <= 0) { T.state = "run"; T.dir = T.n % 2 ? 1 : -1; T.n++; T.x = p.gx - T.dir * 125; T.t = 0; T.hornd = false; } return; }
    const W3 = WORLD.train3, half = W3.total / 2, sp = 0.42;
    T.x += T.dir * sp; T.t++;
    const front = T.x + T.dir * half, dFront = (p.gx - front) * T.dir; // > 0: the front is still coming
    if (T.t % Math.max(6, Math.round(Math.min(30, Math.abs(dFront) / 3))) === 0) SFX.rumble();
    if (dFront > 0 && dFront < 75 && !T.hornd) { T.hornd = true; trainHorn(); if (!STATE.trainWarned) { STATE.trainWarned = true; banner("TRAIN COMING!", "STAND CLEAR OF THE TRACKS", "#ffb43a"); } }
    if (Math.abs(p.gx - T.x) < half + 8) STATE.shake = Math.max(STATE.shake, Math.abs(p.gx - T.x) < half ? 4 : 2);
    // hits: the player and enemies standing on the live track inside the train's length
    const inside = (gx) => Math.abs(gx - T.x) < half + 0.4;
    if (p.layer === "subway" && !p.climb && p.deadT === 0 && inside(p.gx) && onTrack(p.gx, p.gz, p.gy) && p.inv === 0) {
      hurtPlayer(3, false, T.dir * 1.2); if (p.hp > 0) { p.vz = 5.2; p.z = Math.max(p.z, 0.5); p.fling = 26; } STATE.shake = 14; SFX.boom(); playerBark(true, "WHOA! EXPRESS!"); if (BOT) BOTR.log.push("trainhit:p");
    }
    const z = STATE.zone;
    if (z && z.layer === "subway") for (const e of STATE.enemies) {
      if (e.trainHit || e.state === "dying" || e.state === "fly" || e.type === "ramrod") continue;
      const g = toGlobal(z, e.x, e.y);
      if (inside(g.gx) && onTrack(g.gx, g.gz, SUB.TY + (e.z || 0) * ZH)) { e.trainHit = 60; hitEnemy(e, 8, true, T.dir, 10, true); if (BOT) BOTR.log.push("trainhit:" + e.type); STATE.score += 300; fx("spark", e.x, e.y - 20, 10); }
    }
    for (const e of STATE.enemies) if (e.trainHit) e.trainHit--;
    if (dFront < -(half * 2 + 120)) { T.state = "idle"; T.t = 1500; }
  }
  function trainHorn() { try { voice("horn", 0.9, (t, o) => { osc("sawtooth", 196, 194, t, 0.75, 0.11, o); osc("sawtooth", 247, 245, t, 0.75, 0.09, o); osc("square", 98, 97, t, 0.75, 0.05, o); }); } catch (e) { } }
  // ---- render-side: train meshes + lights, signals, column hiding, dust and rail sparks ----
  function stepSubway(dt, t) {
    const W3 = WORLD.train3, T = STATE.train;
    if (W3) {
      const run = T && T.state === "run";
      W3.T.visible = !!run;
      if (run) {
        W3.T.position.set(T.x, SUB.TY, SUB.trainZ); W3.T.rotation.y = 0;
        for (const s of W3.glows) { const lead = s.userData.e === T.dir; s.material.color.setHex(lead ? 0xffffff : 0xff3020); s.scale.setScalar(lead ? 1.8 : 0.7); }
        W3.beam.position.x = T.dir * (W3.total / 2 + 9); W3.beam.rotation.z = T.dir > 0 ? 0 : Math.PI;
        W3.light.x = T.x + T.dir * (W3.total / 2 + 4); W3.light.i = 46; W3.tail.x = T.x - T.dir * (W3.total / 2 + 1); W3.tail.i = 12;
        if (Math.random() < 0.6) { const sx = T.x + (Math.random() - 0.5) * W3.total; PART.subg.emit(sx, SUB.TY + 0.35, 41.75, rnd(-2, 2), rnd(0.5, 2.5), rnd(-0.2, 0.6), rnd(0.2, 0.45), rnd(0.05, 0.1), -0.05, 0.6, 0.85, 1, 1); }
      } else { W3.light.x = -9999; W3.light.i = 0; W3.tail.x = -9999; W3.tail.i = 0; }
    }
    for (const s of WORLD.signals || []) { const busy = T && T.state === "run"; s.r.visible = busy || Math.floor(t * 1.5) % 2 === 0; s.g.visible = !busy; }
    const cp = camera.position;
    const pl = STATE.player; // hide a column that sits on the camera, or between the camera and the player
    for (const c of WORLD.subCols || []) {
      let hide = Math.abs(c.position.x - cp.x) < 0.9 && Math.abs(c.position.z - cp.z) < 0.9;
      if (!hide && pl && pl.layer === "subway" && (c.position.z - pl.gz) * (c.position.z - cp.z) < 0) { const k = (c.position.z - cp.z) / (pl.gz - cp.z), lx = cp.x + (pl.gx - cp.x) * k; hide = Math.abs(c.position.x - lx) < 0.75; }
      c.visible = !hide;
    }
    if (Math.random() < 0.35) PART.sub.emit(cp.x + rnd(-8, 8), SUB.PY + rnd(0.5, 3.5), rnd(42, 51), rnd(-0.1, 0.1), rnd(-0.05, 0.05), rnd(-0.05, 0.05), rnd(3, 6), rnd(0.03, 0.06), 0, 0.9, 0.9, 0.8, 0.35);
    PART.sub.step(dt); PART.subg.step(dt); PART.subfx.step(dt); PART.subfxg.step(dt);
  }
