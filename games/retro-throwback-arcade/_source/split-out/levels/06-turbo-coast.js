/* Retro Throwback Arcade - Level 6: TURBO COAST
   Loaded by ../index.html and evaluated inside the player's scope.
   Must define `var turboCoast = {...}` (title, goal, init(api), update(input), draw(ctx)). */

        var turboCoast = {
  title: "TURBO COAST",
  goal: "A GAS, B BRAKE. 46 S, CHECKPOINT +20 S.",
  api: null,
  init: function (api) {
    var N = 3000, S = this; S.api = api;
    S.SEG = 200; S.N = N; S.RW = 2000; S.DEPTH = 0.84; S.CAMH = 1000; S.DRAW = 180;
    S.MAX = S.SEG * 60; S.segs = [];
    for (var i = 0; i < N; i++) {
      var fade = Math.min(1, i / 60, (N - i) / 80);
      var c = Math.sin(i / 70) * (Math.sin(i / 190) > 0 ? 5 : 2);
      var hy = function (k) { return (1400 * Math.sin(k / 110) + 500 * Math.sin(k / 41)) * Math.min(1, k / 60, Math.max(0, (N - k) / 80)); };
      S.segs.push({ curve: c * fade, y1: hy(i), y2: hy(i + 1), i: i });
    }
    S.len = N * S.SEG; S.pos = 0; S.px = 0; S.speed = 0; S.time = 46; S.done = false;
    S.PZ = 1000; S.CP = Math.floor(N / 2); S.FIN = N - S.DRAW + 3;
    S.cp = false; S.banner = 0; S.spin = 0; S.tilt = 0; S.brake = false; S.t = 0;
    for (var j = 0; j < N; j++) {
      var sp = [];
      if (j > 10 && j < S.FIN - 2 && Math.abs(j - S.CP) > 2) {
        if (j % 6 === 0) { sp.push({ k: 'palm', off: -1.45 }); sp.push({ k: 'palm', off: 1.45 }); }
        else if (j % 6 === 3) { sp.push({ k: 'sign', off: (j % 12 === 3 ? -1.35 : 1.35) }); }
        else if (j % 24 === 9) { sp.push({ k: 'sign', off: -1.35 }); sp.push({ k: 'sign', off: 1.35 }); }
      }
      if (j === S.CP) sp.push({ k: 'cp', off: 0 });
      if (j === S.FIN) sp.push({ k: 'fin', off: 0 });
      S.segs[j].spr = sp;
    }
    var cols = ['#2f6fe0', '#f4c20d', '#f2f2f2'];
    S.cars = [];
    for (var q = 0; q < 34; q++) {
      S.cars.push({ z: S.SEG * (30 + q * 78 + (q * 37) % 40), off: [-0.55, 0, 0.55][q % 3] + ((q * 13) % 5 - 2) * 0.05, spd: S.MAX * (0.3 + ((q * 7) % 5) * 0.05), col: cols[q % 3] });
    }
  },
  update: function (inp) {
    var S = this, dt = 1 / 60, input = inp.k, api = S.api; if (S.done) return;
    S.time -= dt; S.t += dt; if (S.banner > 0) S.banner -= dt;
    if (S.time <= 0) { if (S.cp) { S.pos = Math.max(0, S.CP * S.SEG - S.PZ - S.SEG * 2); S.time = 20; } else { S.pos = 0; S.time = 46; } S.speed = 0; S.px = 0; S.spin = 0; S.tilt = 0; return; }
    for (var ci = 0; ci < S.cars.length; ci++) { var cc = S.cars[ci]; cc.z += cc.spd * dt; if (cc.z >= S.SEG * (S.FIN - 4)) cc.z -= S.SEG * (S.FIN - 40); }
    S.tilt += (((input.left ? -1 : 0) + (input.right ? 1 : 0)) * (S.speed > 0 ? 1 : 0) - S.tilt) * 0.15;
    S.brake = !!input.b;
    if (S.spin > 0) {
      S.spin -= dt; S.speed = 0;
      if (S.spin <= 0) S.px = S.px > 0 ? 0.9 : -0.9;
      return;
    }
    var accel = S.MAX / 5, sp = S.speed / S.MAX;
    if (input.a) S.speed += accel * dt;
    else if (input.b) S.speed -= S.MAX * dt;
    else S.speed -= accel * 0.5 * dt;
    var dx = dt * 2 * sp;
    if (input.left) S.px -= dx;
    if (input.right) S.px += dx;
    var seg = S.segs[Math.floor(S.pos / S.SEG) % S.N];
    S.px -= dx * sp * seg.curve * 0.3;
    if (Math.abs(S.px) > 1 && S.speed > S.MAX / 4) S.speed -= S.MAX * 1.5 * dt;
    S.px = Math.max(-2.5, Math.min(2.5, S.px));
    S.speed = Math.max(0, Math.min(S.MAX, S.speed));
    S.pos += S.speed * dt;
    var pz = S.pos + S.PZ, pi = Math.floor(pz / S.SEG);
    for (var cj = 0; cj < S.cars.length; cj++) {
      var car = S.cars[cj], dz = car.z - pz;
      if (dz > -S.SEG * 0.3 && dz < S.SEG * 0.6 && Math.abs(car.off - S.px) < 0.24) {
        if (S.speed > car.spd * 0.9) { S.pos = Math.max(0, car.z - S.PZ - S.SEG * 1.5); S.speed *= 0.5; break; }
        if (dz < 0) car.z = pz - S.SEG * 0.35; /* faster car behind: tailgate, never pass through */
      }
    }
    if (Math.abs(S.px) > 1.1) {
      for (var si = pi; si <= pi + 1 && si < S.N; si++) {
        var ss = S.segs[si].spr;
        for (var sj = 0; sj < ss.length; sj++) {
          if ((ss[sj].k === 'palm' || ss[sj].k === 'sign') && Math.abs(ss[sj].off - S.px) < 0.35) { S.spin = 1; S.speed = 0; }
        }
      }
    }
    if (!S.cp && pi >= S.CP) { S.cp = true; S.time += 20; S.banner = 2; }
    if (S.pos >= S.len - S.SEG * (S.DRAW + 2)) { S.pos = S.len - S.SEG * (S.DRAW + 2); S.done = true; api.win(); }
  },
  draw: function (ctx) {
    var S = this, W = 320, H = 240, hz = H * 0.5;
    var g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#2b1055'); g.addColorStop(0.55, '#d53369'); g.addColorStop(1, '#ffb347');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz);
    ctx.fillStyle = '#ffe66d'; ctx.beginPath(); ctx.arc(W * 0.7, hz * 0.72, H * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e5aa8'; ctx.fillRect(0, hz * 0.84, W / 2, hz * 0.16);
    ctx.fillStyle = '#2e8b3a'; ctx.fillRect(0, hz, W, H - hz);
    var base = Math.floor(S.pos / S.SEG), bp = (S.pos % S.SEG) / S.SEG;
    var bs = S.segs[base], camY = S.CAMH + bs.y1 + (bs.y2 - bs.y1) * bp, camX = S.px * S.RW;
    var x = 0, dx = -bs.curve * bp, maxy = H, list = [];
    function proj(wx, wy, wz) {
      var cz = wz - S.pos, sc = S.DEPTH / cz;
      return { x: W / 2 + sc * (wx - camX) * W / 2, y: H / 2 - sc * (wy - camY) * H / 2, w: sc * S.RW * W / 2, cz: cz };
    }
    for (var n = 0; n < S.DRAW && base + n < S.N; n++) {
      var s = S.segs[base + n];
      var p1 = proj(x, s.y1, (base + n) * S.SEG), p2 = proj(x + dx, s.y2, (base + n + 1) * S.SEG);
      x += dx; dx += s.curve;
      if (p1.cz <= S.DEPTH || p2.y >= p1.y || p2.y >= maxy) continue;
      list.push([s, p1, p2]); maxy = p2.y;
    }
    function quad(c, x1, y1, w1, x2, y2, w2) {
      ctx.fillStyle = c; ctx.beginPath();
      ctx.moveTo(x1 - w1, y1); ctx.lineTo(x2 - w2, y2); ctx.lineTo(x2 + w2, y2); ctx.lineTo(x1 + w1, y1); ctx.fill();
    }
    var front = []; /* cars nearer than the player, drawn over it */
    for (var k = list.length - 1; k >= 0; k--) {
      var s2 = list[k][0], a = list[k][1], b = list[k][2], alt = Math.floor(s2.i / 3) % 2;
      ctx.fillStyle = alt ? '#2e8b3a' : '#3fa34d'; ctx.fillRect(0, b.y, W, a.y - b.y + 1);
      quad(alt ? '#e02424' : '#ffffff', a.x, a.y, a.w * 1.15, b.x, b.y, b.w * 1.15);
      quad(alt ? '#555' : '#5e5e5e', a.x, a.y, a.w, b.x, b.y, b.w);
      if (alt) quad('#ffffff', a.x, a.y, a.w * 0.03, b.x, b.y, b.w * 0.03);
      var sc = a.w / S.RW, spr = s2.spr;
      for (var m = 0; m < spr.length; m++) drawSpr(spr[m], a, sc);
      for (var cn = 0; cn < S.cars.length; cn++) {
        var tc = S.cars[cn];
        if (Math.floor(tc.z / S.SEG) !== s2.i) continue;
        var f = (tc.z % S.SEG) / S.SEG, ww = a.w + (b.w - a.w) * f;
        var ca = [tc, a.x + (b.x - a.x) * f + ww * tc.off, a.y + (b.y - a.y) * f, ww / S.RW];
        if (tc.z < S.pos + S.PZ) front.push(ca); else drawCar.apply(null, ca);
      }
    }
    function drawCar(c, x, y, k) {
      var w = 380 * k, h = 200 * k; if (w < 1) return;
      ctx.fillStyle = '#111'; ctx.fillRect(x - w * 0.48, y - h * 0.3, w * 0.18, h * 0.3); ctx.fillRect(x + w * 0.3, y - h * 0.3, w * 0.18, h * 0.3);
      ctx.fillStyle = c.col; ctx.fillRect(x - w / 2, y - h * 0.75, w, h * 0.5);
      ctx.fillRect(x - w * 0.35, y - h, w * 0.7, h * 0.3);
      ctx.fillStyle = '#223'; ctx.fillRect(x - w * 0.28, y - h * 0.94, w * 0.56, h * 0.2);
      ctx.fillStyle = '#c11'; ctx.fillRect(x - w * 0.45, y - h * 0.62, w * 0.15, h * 0.12); ctx.fillRect(x + w * 0.3, y - h * 0.62, w * 0.15, h * 0.12);
    }
    function drawSpr(o, a, k) {
      var x = a.x + a.w * o.off, y = a.y;
      if (o.k === 'palm') {
        var ph = 1600 * k, tw = Math.max(1, 90 * k);
        ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.moveTo(x - tw, y); ctx.lineTo(x + tw, y); ctx.lineTo(x + tw * 0.6 + ph * 0.08, y - ph); ctx.lineTo(x - tw * 0.6 + ph * 0.08, y - ph); ctx.fill();
        var tx = x + ph * 0.08, ty = y - ph, fl = 600 * k;
        ctx.strokeStyle = '#1f9d3a'; ctx.lineWidth = Math.max(1, 70 * k); ctx.lineCap = 'round';
        for (var fi = 0; fi < 6; fi++) { var an = Math.PI + fi * Math.PI / 5; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(an) * fl * 0.6, ty - fl * 0.35, tx + Math.cos(an) * fl, ty + Math.abs(Math.sin(an)) * fl * 0.1 + fl * 0.25); ctx.stroke(); }
        ctx.lineCap = 'butt';
      } else if (o.k === 'sign') {
        var sw = 800 * k, sh = 450 * k, pl = 400 * k;
        ctx.fillStyle = '#666'; ctx.fillRect(x - sw * 0.35, y - pl, Math.max(1, sw * 0.06), pl); ctx.fillRect(x + sw * 0.29, y - pl, Math.max(1, sw * 0.06), pl);
        ctx.fillStyle = '#fff'; ctx.fillRect(x - sw / 2, y - pl - sh, sw, sh);
        ctx.fillStyle = '#1e5aa8'; ctx.fillRect(x - sw * 0.44, y - pl - sh * 0.88, sw * 0.88, sh * 0.76);
        ctx.fillStyle = '#ffe66d'; var dir = o.off < 0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(x + dir * sw * 0.3, y - pl - sh * 0.5); ctx.lineTo(x - dir * sw * 0.1, y - pl - sh * 0.8); ctx.lineTo(x - dir * sw * 0.1, y - pl - sh * 0.2); ctx.fill();
      } else {
        var gw = a.w * 1.2, gh = 1500 * k, bh = 380 * k, pw = Math.max(2, 70 * k);
        ctx.fillStyle = '#ddd'; ctx.fillRect(x - gw - pw / 2, y - gh, pw, gh); ctx.fillRect(x + gw - pw / 2, y - gh, pw, gh);
        if (o.k === 'cp') {
          ctx.fillStyle = '#1e5aa8'; ctx.fillRect(x - gw, y - gh, gw * 2, bh);
          if (bh > 6) { ctx.fillStyle = '#ffe66d'; ctx.font = 'bold ' + Math.floor(bh * 0.6) + 'px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CHECKPOINT', x, y - gh + bh / 2); }
        } else {
          var cs = bh / 2, nc = Math.max(2, Math.floor(gw * 2 / Math.max(1, cs)));
          for (var r = 0; r < 2; r++) for (var cq = 0; cq < nc; cq++) { ctx.fillStyle = (r + cq) % 2 ? '#111' : '#fff'; ctx.fillRect(x - gw + cq * gw * 2 / nc, y - gh + r * cs, gw * 2 / nc + 0.5, cs + 0.5); }
          if (bh > 8) { ctx.fillStyle = '#e02424'; ctx.fillRect(x - gw * 0.3, y - gh + bh * 0.15, gw * 0.6, bh * 0.7); ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.floor(bh * 0.5) + 'px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FINISH', x, y - gh + bh / 2); }
        }
      }
    }
    var cw = W * 0.14, ch = H * 0.08, cx = W / 2 - cw / 2, cy = H - ch - H * 0.04;
    ctx.save();
    var wob = S.spin > 0 ? Math.sin(S.t * 30) * 0.35 * S.spin : 0;
    ctx.translate(W / 2 + S.tilt * 6, cy + ch / 2); ctx.rotate(S.tilt * 0.08 + wob); ctx.transform(1, 0, -S.tilt * 0.15, 1, 0, 0);
    var hw = cw / 2, hh = ch / 2;
    ctx.fillStyle = '#111'; ctx.fillRect(-hw - cw * 0.06, hh * 0.2, cw * 0.14, hh * 0.8); ctx.fillRect(hw - cw * 0.08, hh * 0.2, cw * 0.14, hh * 0.8);
    ctx.fillStyle = '#d61f1f'; ctx.beginPath(); ctx.moveTo(-hw, hh * 0.7); ctx.lineTo(-hw, -hh * 0.1); ctx.lineTo(-hw * 0.8, -hh * 0.4); ctx.lineTo(hw * 0.8, -hh * 0.4); ctx.lineTo(hw, -hh * 0.1); ctx.lineTo(hw, hh * 0.7); ctx.fill();
    ctx.fillStyle = '#5a0a0a'; ctx.fillRect(-hw * 0.7, -hh * 0.4, hw * 1.4, hh * 0.25);
    ctx.fillStyle = '#bfe3ff'; ctx.fillRect(-hw * 0.6, -hh * 1.15, hw * 1.2, hh * 0.18);
    ctx.fillStyle = '#333'; ctx.fillRect(-hw * 0.62, -hh * 1.15, hw * 0.06, hh * 0.75); ctx.fillRect(hw * 0.56, -hh * 1.15, hw * 0.06, hh * 0.75);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(-hw * 0.5, -hh * 0.85, hw * 0.35, hh * 0.5); ctx.fillRect(hw * 0.15, -hh * 0.85, hw * 0.35, hh * 0.5);
    ctx.fillStyle = '#f2c28b'; ctx.beginPath(); ctx.arc(-hw * 0.32, -hh * 1.0, hh * 0.28, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe66d'; ctx.fillRect(-hw * 0.32 - hh * 0.3, -hh * 1.12, hh * 0.6, hh * 0.12);
    ctx.fillStyle = '#eee'; ctx.fillRect(-hw * 0.3, hh * 0.05, hw * 0.6, hh * 0.22);
    if (S.brake) { ctx.fillStyle = 'rgba(255,60,60,0.45)'; ctx.fillRect(-hw * 1.05, -hh * 0.2, hw * 0.5, hh * 0.6); ctx.fillRect(hw * 0.55, -hh * 0.2, hw * 0.5, hh * 0.6); }
    ctx.fillStyle = S.brake ? '#ff3030' : '#7a0d0d'; ctx.fillRect(-hw * 0.92, -hh * 0.05, hw * 0.3, hh * 0.3); ctx.fillRect(hw * 0.62, -hh * 0.05, hw * 0.3, hh * 0.3);
    ctx.restore();
    for (var fc = 0; fc < front.length; fc++) drawCar.apply(null, front[fc]);
    if (S.banner > 0 && Math.floor(S.banner * 6) % 2 === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 80, 40, 160, 24);
      ctx.fillStyle = '#ffe66d'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CHECKPOINT +20', W / 2, 52);
    }
    var prog = S.pos / (S.len - S.SEG * (S.DRAW + 2));
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(4, 4, W - 8, 18);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillText('TIME ' + Math.ceil(S.time), 10, 13);
    ctx.textAlign = 'right'; ctx.fillText(Math.round(S.speed / S.MAX * 240) + ' KM/H', W - 10, 13);
    var bx = W * 0.3, bw = W * 0.4;
    ctx.strokeStyle = '#fff'; ctx.strokeRect(bx + 0.5, 8.5, bw, 9);
    ctx.fillStyle = '#ffe66d'; ctx.fillRect(bx + 2, 10, (bw - 3) * Math.min(1, prog), 6);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
};
