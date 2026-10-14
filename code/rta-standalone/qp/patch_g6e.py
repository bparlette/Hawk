s=open('qp/q6e0.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80]); s=s.replace(a,b)
# stats
rep("S.bgx = 0; S.parts = [];","S.st = { bumps: 0, spins: 0, top: 0 }; S.tally = null; S.bgx = 0; S.parts = [];")
rep("SFX.bump(); this.shk = 10;","this.st.bumps++; SFX.bump(); this.shk = 10;")
rep("SFX.spin(); this.shk = 12;","this.st.spins++; SFX.spin(); this.shk = 12;")
rep("S.done = true; api.win(); }","S.done = true; S.tally = [['RUN TIME', S.t.toFixed(1) + ' S'], ['TOP SPEED', S.st.top + ' KMH'], ['BUMPS', S.st.bumps], ['SPIN OUTS', S.st.spins]]; api.win(Math.round(S.time * 100)); }")
rep("S.fr++; S.tick(); S.audio();","S.fr++; S.tick(); S.audio(); S.st.top = Math.max(S.st.top, Math.round(S.speed / S.MAX * 240));")
# HUD
a=s.index("    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(4, 4, W - 8, 18);"); b=s.index("    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';\n  }")
s=s[:a]+'''    ctx.fillStyle = 'rgba(6,10,30,0.65)'; ctx.fillRect(0, 0, W, 20); ctx.fillStyle = '#2a3a7a'; ctx.fillRect(0, 20, W, 1);
    // clock chip + big time
    ctx.fillStyle = '#140a12'; ctx.fillRect(4, 5, 11, 11); ctx.fillStyle = '#e8e8f0'; ctx.fillRect(5, 6, 9, 9); ctx.fillStyle = '#2a3466'; ctx.fillRect(6, 7, 7, 7); ctx.fillStyle = '#fff'; ctx.fillRect(6, 7, 7, 1);
    ctx.fillStyle = '#ffe66d'; ctx.fillRect(9, 8, 1, 4); ctx.fillRect(9, 11, 3, 1);
    var low = S.time <= 10, tcol = low && Math.floor(S.fr / 8) %% 2 ? '#ff6a5a' : (low ? '#ffb0a0' : '#fff'), ts = String(Math.max(0, Math.ceil(S.time)));
    text(ts, 19, 4, 2, '#140a12'); text(ts, 18, 3, 2, tcol);
    // progress bar with checkpoint + finish markers and a car marker
    var bx = 100, bw = 120;
    ctx.fillStyle = '#140a12'; ctx.fillRect(bx - 1, 5, bw + 2, 10); ctx.fillStyle = '#2a3466'; ctx.fillRect(bx, 6, bw, 8);
    ctx.fillStyle = '#ffe66d'; ctx.fillRect(bx, 6, Math.round(bw * Math.min(1, prog)), 8); ctx.fillStyle = '#fff3a0'; ctx.fillRect(bx, 6, Math.round(bw * Math.min(1, prog)), 2);
    ctx.fillStyle = S.cp ? '#7aff7a' : '#6ac8ff'; ctx.fillRect(bx + bw / 2, 3, 2, 12); ctx.fillRect(bx + bw / 2 + 2, 3, 4, 3);
    for (var fq = 0; fq < 4; fq++) { ctx.fillStyle = fq %% 2 ? '#111' : '#fff'; ctx.fillRect(bx + bw - 1 + (fq %% 2) * 3, 3 + fq * 3, 3, 3); }
    var mxp = bx + Math.round(bw * Math.min(1, prog)); ctx.fillStyle = '#140a12'; ctx.fillRect(mxp - 3, 4, 7, 4); ctx.fillStyle = '#ff3030'; ctx.fillRect(mxp - 2, 5, 5, 2);
    // speed
    var kmh = String(Math.round(S.speed / S.MAX * 240));
    text(kmh, 291 - kmh.length * 12, 4, 2, '#140a12'); text(kmh, 290 - kmh.length * 12, 3, 2, '#ffe66d'); text('KMH', 293, 11, 1, '#9fb4ff');
    ctx.fillStyle = '#140a12'; ctx.fillRect(228, 8, 36, 5); ctx.fillStyle = '#2a3466'; ctx.fillRect(229, 9, 34, 3); var sf = Math.round(34 * S.speed / S.MAX); ctx.fillStyle = S.speed > S.MAX * 0.85 ? '#ff6a5a' : '#6ac8ff'; ctx.fillRect(229, 9, sf, 3);
'''+s[b:]
# titleArt
rep("  music: { step: 6","""  titleArt: function (x, t) {
    if (!this.SQ) this.SQ = this.buildSprites();
    var Q = this.SQ, i, j, hz = 122, W = 320;
    function big(sp, cx, by, w, flip) { if (!sp || !sp.cv) return; var h = w * sp.h / sp.w, x0 = Math.round(cx - w / 2), y0 = Math.round(by - h); if (flip) { x.save(); x.translate(x0 + w, y0); x.scale(-1, 1); x.drawImage(sp.cv, 0, 0, w, h); x.restore(); } else x.drawImage(sp.cv, x0, y0, w, h); }
    var g = x.createLinearGradient(0, 44, 0, hz); g.addColorStop(0, '#2b1055'); g.addColorStop(0.6, '#d53369'); g.addColorStop(1, '#ffb347'); x.fillStyle = g; x.fillRect(0, 44, W, hz - 44);
    x.fillStyle = 'rgba(255,230,109,0.16)'; x.beginPath(); x.arc(160, hz - 16, 52, 0, 7); x.fill();
    x.fillStyle = '#ffe66d'; x.beginPath(); x.arc(160, hz - 16, 38, 0, 7); x.fill();
    for (j = 0; j < 5; j++) { x.fillStyle = j %% 2 ? '#f77a5a' : '#ff9a52'; x.fillRect(122, hz - 26 + j * 5, 76, 1 + (j >> 1)); }
    for (i = 0; i < 30; i++) { if ((Math.floor(t / 20) + i) %% 7 < 5) { x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect((i * 47 + 9) %% W, 46 + (i * 13) %% 22, 1, 1); } }
    for (i = 0; i < 3; i++) { var cx = (((i * 120 + t * (0.15 + i * 0.07)) %% (W + 100)) + W + 100) %% (W + 100) - 50; x.fillStyle = 'rgba(255,170,190,' + (0.4 - i * 0.06).toFixed(2) + ')'; x.fillRect(cx, 56 + i * 14, 50, 4); x.fillRect(cx + 8, 53 + i * 14, 24, 3); }
    x.fillStyle = '#1e5aa8'; x.fillRect(0, hz - 6, W, 6);
    for (i = 0; i < W; i += 4) { var mh = 16 + Math.round(10 * Math.sin(i / 23) + 5 * Math.sin(i / 9) + 6 * Math.sin(i / 57)); if (mh > 0) { x.fillStyle = '#3a1a5e'; x.fillRect(i, hz - mh, 4, mh); if (mh > 24) { x.fillStyle = '#ffb3c8'; x.fillRect(i, hz - mh, 4, 2); } } }
    x.fillStyle = '#2e8b3a'; x.fillRect(0, hz, W, 48);
    // road in perspective: stripes slide toward the viewer
    for (i = 0; i < 12; i++) { var z0 = ((i + (t * 0.04) %% 1) / 12), z1 = ((i + 1 + (t * 0.04) %% 1) / 12), y0 = hz + z0 * z0 * 46, y1 = hz + z1 * z1 * 46, w0 = 6 + z0 * z0 * 118, w1 = 6 + z1 * z1 * 118;
      x.fillStyle = i %% 2 ? '#3fa34d' : '#2e8b3a'; x.fillRect(0, y0, W, y1 - y0 + 1);
      x.fillStyle = i %% 2 ? '#e02424' : '#fff'; x.beginPath(); x.moveTo(160 - w0 * 1.15, y0); x.lineTo(160 + w0 * 1.15, y0); x.lineTo(160 + w1 * 1.15, y1); x.lineTo(160 - w1 * 1.15, y1); x.fill();
      x.fillStyle = i %% 2 ? '#555' : '#5e5e5e'; x.beginPath(); x.moveTo(160 - w0, y0); x.lineTo(160 + w0, y0); x.lineTo(160 + w1, y1); x.lineTo(160 - w1, y1); x.fill();
      if (i %% 2) { x.fillStyle = '#fff'; x.fillRect(160 - w0 * 0.03, y0, Math.max(1, w0 * 0.06), y1 - y0); } }
    // palms either side
    var pf = (Math.floor(t / 30)) %% 2;
    big(Q.palm[pf], 52, 168, 66, false); big(Q.palm[1 - pf], 270, 168, 66, true); big(Q.palm[pf], 18, 140, 28, false); big(Q.palm[1 - pf], 304, 140, 28, true);
    // the hero car: bobbing, with exhaust flicker
    var bob = Math.round(Math.sin(t * 0.18) * 1), fl = Math.floor(t / 4) %% 2;
    x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(122, 163, 76, 4);
    big(Q.car[fl ? 'sb' : 's'], 160, 164 + bob, 76, false);
    x.fillStyle = fl ? '#ffe66d' : '#ff8a3a'; x.fillRect(144 + fl, 164 + bob, 3, 2 + fl); x.fillRect(172 - fl, 164 + bob, 3, 2 + fl);
    // oncoming traffic
    var tz = (t %% 220) / 220, ty = hz + tz * tz * 38, tw = 8 + tz * tz * 60; if (tz < 0.95) big(Q.en['#2f6fe0'][Math.floor(t / 6) %% 2], 160 - 14 * (1 - tz) - tz * 6, ty, tw, false);
  },
  music: { step: 6""")
s=s.replace('%%','%')
open('qp/q6e.html','w').write(s); print('ok')
