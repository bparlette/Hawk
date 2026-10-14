s=open('qp/q6a.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80]); s=s.replace(a,b)
a=s.index("    var g = ctx.createLinearGradient(0, 0, 0, hz);"); b=s.index("    ctx.fillStyle = '#2e8b3a'; ctx.fillRect(0, hz, W, H - hz);")
s=s[:a]+"    S.bg(ctx, W, H, hz);\n"+s[b:]
bg='''  /* background: sky + stars, striped sun, drifting clouds, sea with sun glints, 3 parallax ridges, gulls */
  bg: function (ctx, W, H, hz) {
    var S = this, t = S.t, bx = S.bgx || 0, i, j, mx, u;
    var g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#1c0b40'); g.addColorStop(0.3, '#2b1055'); g.addColorStop(0.62, '#d53369'); g.addColorStop(1, '#ffb347');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz);
    for (i = 0; i < 36; i++) { var sy = (i * 29) %% 46, tw = (Math.floor(t * 3) + i) %% 9; if (tw < 6) { ctx.fillStyle = tw < 1 ? '#fff' : 'rgba(255,255,255,0.55)'; ctx.fillRect((i * 53 + 7) %% W, sy, 1, 1); } }
    var sr = H * 0.09, span = W + 80, sx = (((W * 0.7 + bx * 0.08) %% span) + span) %% span - 40, sY = hz * 0.72;
    ctx.fillStyle = 'rgba(255,230,109,0.14)'; ctx.beginPath(); ctx.arc(sx, sY, sr * 1.7, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,109,0.22)'; ctx.beginPath(); ctx.arc(sx, sY, sr * 1.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe66d'; ctx.beginPath(); ctx.arc(sx, sY, sr, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(sx, sY + sr * 0.35, sr * 0.62, 0.15, Math.PI - 0.15); ctx.fill();
    for (j = 0; j < 4; j++) { ctx.fillStyle = j %% 2 ? '#f77a5a' : '#ff9a52'; ctx.fillRect(sx - sr, sY + 2 + j * 4, sr * 2, 1 + (j >> 1)); }
    for (i = 0; i < 5; i++) { var span2 = W + 120, cx = (((i * 97 + t * (4 + i * 1.5) + bx * 0.15) %% span2) + span2) %% span2 - 60, cy = 12 + i * 14;
      ctx.fillStyle = 'rgba(255,170,190,' + (0.42 - i * 0.04).toFixed(2) + ')'; ctx.fillRect(cx, cy, 40 + i * 6, 4); ctx.fillRect(cx + 8, cy - 3, 22, 3); ctx.fillRect(cx + 14, cy + 4, 26, 2);
      ctx.fillStyle = 'rgba(255,240,230,0.28)'; ctx.fillRect(cx + 8, cy - 3, 22, 1); }
    var sy0 = Math.round(hz * 0.84), shh = hz - sy0;
    ctx.fillStyle = '#1e5aa8'; ctx.fillRect(0, sy0, W, shh); ctx.fillStyle = '#2a7ad0'; ctx.fillRect(0, sy0, W, 2);
    for (j = 0; j < 5; j++) { var gw = 6 + Math.round(Math.sin(t * 3 + j * 1.7) * 4) + (4 - j); ctx.fillStyle = j %% 2 ? 'rgba(255,230,160,0.8)' : 'rgba(255,200,120,0.6)'; ctx.fillRect(Math.round(sx + Math.sin(t * 2 + j * 1.3) * 5 - gw / 2), sy0 + 1 + j * 3, gw, 1); }
    ctx.fillStyle = 'rgba(180,220,255,0.5)'; for (i = 0; i < 7; i++) { var wx = (i * 61 + Math.floor(t * 10 + i * 5)) %% W; if ((Math.floor(t * 2) + i) %% 3) ctx.fillRect(wx, sy0 + 2 + (i %% 3) * 4, 3, 1); }
    // far ridge (slow), snow caps lit pink
    for (mx = 0; mx < W; mx += 4) { u = mx + bx * 0.25; var mh = 16 + Math.round(9 * Math.sin(u / 23) + 5 * Math.sin(u / 9) + 6 * Math.sin(u / 57));
      if (mh < 1) continue; ctx.fillStyle = '#3a1a5e'; ctx.fillRect(mx, hz - mh, 4, mh); if (mh > 24) { ctx.fillStyle = '#ffb3c8'; ctx.fillRect(mx, hz - mh, 4, 2); } else if (mh > 20) { ctx.fillStyle = '#7a3a8e'; ctx.fillRect(mx, hz - mh, 4, 1); } }
    // mid hills (medium)
    for (mx = 0; mx < W; mx += 4) { u = mx + bx * 0.6; var hh = 7 + Math.round(4 * Math.sin(u / 17) + 2 * Math.sin(u / 7));
      ctx.fillStyle = '#1b5a4a'; ctx.fillRect(mx, hz - hh, 4, hh); ctx.fillStyle = '#2f8a5a'; ctx.fillRect(mx, hz - hh, 4, 1); }
    // near tree-line with tiny palms (fast)
    for (i = 0; i < 12; i++) { var span3 = W + 40, px0 = (((i * 36 - bx * 1.1) %% span3) + span3) %% span3 - 20, ph0 = 7 + (i * 5) %% 4;
      ctx.fillStyle = '#12382a'; ctx.fillRect(px0, hz - ph0, 1, ph0); ctx.fillRect(px0 - 3, hz - ph0 - 1, 7, 1); ctx.fillRect(px0 - 2, hz - ph0 - 2, 5, 1); ctx.fillRect(px0 - 4, hz - ph0, 2, 1); ctx.fillRect(px0 + 3, hz - ph0, 2, 1); }
    // gulls
    for (i = 0; i < 3; i++) { var gx = ((i * 140 + t * 22) %% (W + 60)) - 30, gy = 26 + i * 15 + Math.sin(t * 1.7 + i) * 4, wg = Math.floor(t * 6 + i) %% 2;
      ctx.fillStyle = '#ffe9f2'; ctx.fillRect(gx, gy, 1, 1); ctx.fillRect(gx - 1, gy - wg, 1, 1); ctx.fillRect(gx + 1, gy - wg, 1, 1); ctx.fillRect(gx - 2, gy - wg * 2, 1, 1); ctx.fillRect(gx + 2, gy - wg * 2, 1, 1); }
  },
''' % ()
rep("  update: function (inp) {", bg+"  update: function (inp) {")
rep("S.cp = false; S.banner = 0;","S.bgx = 0; S.cp = false; S.banner = 0;")
rep("    S.px -= dx * sp * seg.curve * 0.3;\n","    S.px -= dx * sp * seg.curve * 0.3;\n    S.bgx -= seg.curve * sp * 2.6;\n")
# near: roadside flowers
rep("      var sc = a.w / S.RW, spr = s2.spr;","""      if (alt && a.w > 3) { var fsg = s2.i %% 2 ? 1 : -1, fxx = a.x + fsg * a.w * (1.45 + ((s2.i * 13) %% 10) / 7), fsz = Math.max(1, a.w * 0.018);
        if (fxx > 0 && fxx < W) { ctx.fillStyle = ['#ffd0e8', '#ffe66d', '#ffffff'][s2.i %% 3]; ctx.fillRect(fxx, a.y - fsz, fsz, fsz); ctx.fillStyle = '#1f6a2c'; ctx.fillRect(fxx, a.y, fsz, fsz * 0.5); } }
      var sc = a.w / S.RW, spr = s2.spr;""" % ())
open('qp/q6b.html','w').write(s); print('ok')
