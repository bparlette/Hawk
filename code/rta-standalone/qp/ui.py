# python3 ui.py in.html out.html -- generic shell UI: outlined 2-tone logo, GAMES[0].titleArt(ctx,t) preview, win tally from GAMES[gi].tally [[label,value],...]
import sys
s=open(sys.argv[1]).read()
a=s.index("        function drawTitle() {"); b=s.index("        function icon(i, x, y, r)")
s=s[:a]+'''        function logo(s, y, sc, c1, c2) {
          for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 2; oy++) if (ox || oy) text(s, W / 2 + ox * sc, y + oy * sc, sc, oy > 1 ? "#000" : "#2a0d00", true);
          text(s, W / 2, y, sc, c1, true);
          ctx.save(); ctx.beginPath(); ctx.rect(0, y + 4 * sc, W, 3 * sc); ctx.clip(); text(s, W / 2, y, sc, c2, true); ctx.restore();
          ctx.fillStyle = "rgba(255,255,255,0.8)"; var lw = s.length * 6 * sc, lx = Math.round(W / 2 - lw / 2), sh = (t * 3) % (lw + 60) - 30;
          ctx.fillRect(lx + sh, y, 2, sc * 2);
        }
        function drawTitle() {
          var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0a0a24"); g.addColorStop(1, "#1b0f33");
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          for (var i = 0; i < 50; i++) {
            var sx = (i * 61 + 13) % W, sy = (i * 37 + (t >> 2)) % H;
            ctx.fillStyle = i % 3 ? "#1d2a4a" : "#4a5f9b"; ctx.fillRect(sx, sy, 2, 2);
          }
          var G0 = GAMES[0];
          if (G0.titleArt) { try { G0.titleArt(ctx, t); } catch (e) {} }
          var ti = G0.title, sc = ti.length * 18 > 300 ? 2 : 3;
          logo(ti, 18, sc, "#ffe14d", "#ff8a1e");
          var gl = (G0.goal || "").replace(/\\. /g, ".|").split("|");
          ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 170, W, 6 + Math.min(3, gl.length) * 11);
          for (var gq = 0; gq < gl.length && gq < 3; gq++) text(gl[gq], W / 2, 173 + gq * 11, 1, "#4ad6ff", true);
          if (t % 60 < 40) text("TAP OR PRESS A TO PLAY", W / 2, 205, 1, "#fff", true);
          text("INFINITE LIVES", W / 2, 218, 1, "#5f5", true);
          text("STICK MOVE - A/B ACTION - M MUTE", W / 2, H - 9, 1, "#4a5578", true);
        }
'''+s[b:]
old='''            text("YOU WIN!", W / 2, 70, 3, "#ffe14d", true);
            text("SCORE " + lastScore, W / 2, 112, 1, "#fff", true);
            if (t % 60 < 40) text("PLAY AGAIN", W / 2, 150, 2, "#4ad6ff", true);'''
assert old in s
new='''            logo("YOU WIN!", 34, 3, "#ffe14d", "#ff8a1e");
            var TL = GAMES[gi].tally || [], ty = 80;
            for (var tq = 0; tq < TL.length; tq++) {
              var ts0 = 20 + tq * 18; if (t < ts0) break;
              if (t === ts0) beep(660 + tq * 110, 0.06);
              var tv = TL[tq][1], shown = typeof tv === "number" ? Math.min(tv, Math.round(tv * Math.min(1, (t - ts0) / 14))) : tv;
              text(TL[tq][0], 70, ty + tq * 13, 1, "#9fb4ff"); text(String(shown), 250 - String(shown).length * 6, ty + tq * 13, 1, "#fff");
              ctx.fillStyle = "#2a2f5a"; ctx.fillRect(70, ty + tq * 13 + 9, 180, 1);
            }
            var tsY = ty + TL.length * 13 + 8;
            if (t >= 20 + TL.length * 18) { text("SCORE", 70, tsY, 1, "#ffe14d"); text(String(lastScore), 250 - String(lastScore).length * 6, tsY, 1, "#ffe14d"); }
            if (t > 40 + TL.length * 18 && t % 60 < 40) text("PLAY AGAIN", W / 2, 196, 2, "#4ad6ff", true);'''
s=s.replace(old,new)
s=s.replace('if (t > 40 && (pressed.start || pressed.a)) { total = 0; startLevel(); }','if (t > 40 && (pressed.start || pressed.a || tap)) { total = 0; startLevel(); }')
open(sys.argv[2],'w').write(s)
print("ui ok")
