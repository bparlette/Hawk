  // ================= KRANG (android body): painted sprite sheet levels/level14_krang.png =================
  // Frames face right, feet on the frame bottom, [x, y, w, h, anchorX] with anchorX = hip centre (so poses don't slide).
  // Drawn at KR_K: the 192 px idle frame (antenna included) is ~96 world px, a head and a half over the turtles.
  // Gold belly window with the pink brain glows when he is open to damage (overlay glow at the window, per frame).
  const SKIN = "#dcaa78", STEEL = "#80838e", STEEL_D = "#4a4c56"; // fist projectile colours
  const KR_IMG = "levels/level14_krang.png", KR_K = 0.5;
  const KRF = {idle: [0, 1, 122, 192, 64], walk1: [126, 1, 109, 192, 60], walk2: [239, 2, 115, 191, 62], walk3: [358, 1, 105, 192, 60], wind: [467, 9, 104, 184, 58], punch: [575, 1, 165, 192, 72], rocket: [744, 1, 176, 192, 76], stompUp: [924, 1, 149, 192, 88], stompDn: [1077, 3, 120, 190, 54], summon: [1201, 0, 117, 193, 64], rage: [1322, 1, 157, 192, 92], hurt: [1483, 7, 140, 186, 71], fall: [1627, 10, 218, 183, 125], down: [1849, 134, 216, 59, 118], empty: [2069, 134, 216, 59, 118]};
  // brain-window centre in frame px (x from the frame's left edge, y from its top)
  const KRW = {idle: [68, 77], walk1: [64, 77], walk2: [64, 79], walk3: [62, 79], wind: [60, 92], punch: [74, 78], rocket: [80, 96], stompUp: [84, 79], stompDn: [58, 80], summon: [66, 88], rage: [92, 74], hurt: [72, 74], fall: [118, 65], down: [96, 23], empty: [96, 23]};
  const KR_PUNCH_EMPTY = [575, 1, 142, 192, 72]; // punch frame cropped at the wristband: the fist is out flying (anchor unchanged)
  const KR_WRIST = [142, 44]; // wrist stump of the cropped punch frame (frame px)
  const KR_EYE = [66, 21];    // Krang's eye in the idle frame (frame px): laser origin + eye glow
  const krPt = (F, px, py, sx, sy, f) => [sx + (px - F[4]) * KR_K * f, sy - (F[3] - py) * KR_K]; // frame px -> screen
  const KR_EYE_DX = (KR_EYE[0] - KRF.idle[4]) * KR_K, KR_EYE_DY = (KRF.idle[3] - KR_EYE[1]) * KR_K; // laser origin offset from the feet
  function krSpr(api, F, sx, sy, f) { // level15 spr() pattern: anchor (hip centre) on sx, not the bbox centre
    const im = api.img(KR_IMG);
    if (!im || !im.complete || !im.naturalWidth) { api.rect(sx - 12, sy - F[3] * KR_K, 24, F[3] * KR_K, "#b07f55"); return; }
    api.drawFrame(im, F, sx + (F[2] / 2 - F[4]) * KR_K * f, sy, KR_K, f);
  }
  function drawBrain(c, x, y, w, h, t, hot) {
    c.fillStyle = hot ? "#ff9ab4" : "#e8829a"; c.beginPath(); c.ellipse(x, y, w, h, 0, 0, 6.29); c.fill();
    c.strokeStyle = hot ? "#b0305a" : "#a2405a"; c.lineWidth = 0.7; c.beginPath();
    for (let i = -2; i <= 2; i++) { const ox = x + i * w * 0.35; c.moveTo(ox, y - h * 0.8); c.quadraticCurveTo(ox + 2 + Math.sin(t * 0.2 + i), y, ox - 1, y + h * 0.8); }
    c.moveTo(x - w * 0.8, y - 0.5); c.quadraticCurveTo(x, y - 2 + Math.sin(t * 0.15), x + w * 0.8, y + 0.5); c.stroke();
    c.fillStyle = "#fff"; c.fillRect(x + w * 0.35, y - 1.6, 1.6, 1.4); c.fillStyle = "#111"; c.fillRect(x + w * 0.5, y - 1.3, 0.8, 0.9); // Krang's tiny face
  }
  // P: { fr: frame name, vuln, redWin, eye (0..1), stump (fist out), empty }
  function drawKrang(api, sx, sy, f, P) {
    const c = api.ctx, t = api.t, name = P.fr || "idle", F = P.stump ? KR_PUNCH_EMPTY : KRF[name] || KRF.idle;
    krSpr(api, F, sx, sy, f);
    const W = KRW[P.stump ? "punch" : name] || KRW.idle, [wx, wy] = krPt(F, W[0], W[1], sx, sy, f);
    if (P.stump) { // the rocket fist is away: dark socket + jet glow at the wrist
      const [qx, qy] = krPt(F, KR_WRIST[0], KR_WRIST[1], sx, sy, f);
      c.fillStyle = "#26242c"; c.fillRect(qx - 1.5, qy - 3, 3, 6);
      c.save(); c.globalCompositeOperation = "lighter"; glow(c, qx + f * 2, qy, 5 + (t % 3), "rgba(255,170,60,0.9)"); c.restore();
    }
    if (P.empty && t % 20 < 10) { c.save(); c.globalCompositeOperation = "lighter"; glow(c, wx, wy, 4, "rgba(255,60,90,1)"); c.restore(); }
    const v = P.vuln || 0;
    if (v > 0) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.45 + 0.35 * Math.sin(t * 0.4); glow(c, wx, wy, 16, "rgba(255,230,120,0.95)"); c.restore(); }
    if (P.redWin) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.6; glow(c, wx, wy, 13, "rgba(255,60,90,0.95)"); c.restore(); }
    if (P.eye > 0 && name === "idle") { const [ex, ey] = krPt(F, KR_EYE[0], KR_EYE[1], sx, sy, f); c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = Math.min(1, P.eye); glow(c, ex, ey, 5 + P.eye * 4, "rgba(255,60,80,1)"); c.restore(); }
  }
  const WALK = ["walk1", "idle", "walk3", "idle"];
  function krangPose(api, e) {
    const s = e.state, t = e.t, P = { vuln: vulnerable(e) ? 1 : 0, fr: "idle" };
    if (s === "walk" || s === "enter") { if (e.walkT > 0) P.fr = WALK[Math.floor(e.walkT / 9) % 4]; }
    else if (s === "kwind") P.fr = "wind";
    else if (s === "kick") P.fr = t < 2 ? "wind" : "punch";
    else if (s === "slam") { if (t < 40) { P.fr = "stompUp"; P.redWin = blink(t, 3) && t < 14; } else P.fr = "stompDn"; }
    else if (s === "throw") { P.fr = e.fistOut ? (t < 42 ? "rocket" : "punch") : "punch"; P.stump = !!e.fistOut && t >= 42; P.redWin = t < 30 && blink(t, 3); }
    else if (s === "fire") P.eye = t < 36 ? t / 36 : 1;
    else if (s === "summon") P.fr = "summon";
    else if (s === "rage") { P.fr = "rage"; P.redWin = blink(t, 4); }
    else if (s === "hurt" || s === "stagger") P.fr = "hurt";
    else if (s === "down") P.fr = t < 10 ? "fall" : "down";
    else if (s === "getup") P.fr = t < 8 ? "down" : "hurt";
    else if (s === "dying") P.fr = t < 18 ? "fall" : "down";
    return P;
  }
  function drawWreck(api, w, cx) { // the empty android lying in the plaza after the KO
    api.contactShadow(w.x - cx, w.y, 0, 26);
    drawKrang(api, w.x - cx, w.y, w.f, { fr: "empty", empty: true, vuln: 0 });
    if (api.t % 30 < 3) api.fx("spark", w.x - w.f * 30 + api.rnd(-8, 8), w.y - 6, 8);
    if (api.t % 24 === 0) api.fx("smoke", w.x - w.f * 20 + api.rnd(-14, 14), w.y - 10, 22);
  }

