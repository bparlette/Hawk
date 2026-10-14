import re,sys
src,dst=sys.argv[1],sys.argv[2]
s=open(src).read()
# updateTitle
a=s.index("        function updateTitle() {")
b=s.index("        function frame() {")
s=s[:a]+'''        function updateTitle() {
          if (tap || pressed.a || pressed.b || pressed.start || pressed.any) startAt(0);
        }

'''+s[b:]
# drawTitle
a=s.index("        function drawTitle() {")
b=s.index("        function icon(i, x, y, r)")
s=s[:a]+'''        function drawTitle() {
          var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0a0a24"); g.addColorStop(1, "#1b0f33");
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          for (var i = 0; i < 50; i++) {
            var sx = (i * 61 + 13) % W, sy = (i * 37 + (t >> 2)) % H;
            ctx.fillStyle = i % 3 ? "#1d2a4a" : "#4a5f9b"; ctx.fillRect(sx, sy, 2, 2);
          }
          var ti = GAMES[0].title, sc = ti.length * 18 > 300 ? 2 : 3;
          text(ti, W / 2 + 2, 72 + 2, sc, "#7a2a00", true);
          text(ti, W / 2, 72, sc, "#ffe14d", true);
          var gl = (GAMES[0].goal || "").replace(/\. /g, ".|").split("|");
          for (var gq = 0; gq < gl.length && gq < 3; gq++) text(gl[gq], W / 2, 120 + gq * 11, 1, "#4ad6ff", true);
          ctx.fillStyle = "#ffe14d"; ctx.fillRect(60, 108, 200, 2);
          if (t % 60 < 40) text("TAP OR PRESS A TO PLAY", W / 2, 170, 1, "#fff", true);
          text("INFINITE LIVES", W / 2, 196, 1, "#5f5", true);
          text("STICK MOVE - A/B ACTION - M MUTE", W / 2, H - 9, 1, "#4a5578", true);
        }
'''+s[b:]
s=s.replace('"3 LIVES - GOOD LUCK"','"INFINITE LIVES - GOOD LUCK"')
s=s.replace('text("LEVEL " + (gi + 1) + " - " + GAMES[gi].title, W / 2, 84, 1, "#ffe14d", true);','text(GAMES[gi].title, W / 2, 84, 1, "#ffe14d", true);')
old='''            text("LEVEL CLEAR", W / 2, 70, 2, "#ffe14d", true);
            text("SCORE " + lastScore, W / 2, 104, 1, "#fff", true);
            text("TOTAL " + total, W / 2, 118, 1, "#fff", true);
            if (t > 40 && (pressed.start || pressed.a)) {
              gi++;
              if (gi >= GAMES.length) { state = "end"; t = 0; } else startLevel();
            }'''
new='''            text("YOU WIN!", W / 2, 70, 3, "#ffe14d", true);
            text("SCORE " + lastScore, W / 2, 112, 1, "#fff", true);
            if (t % 60 < 40) text("PLAY AGAIN", W / 2, 150, 2, "#4ad6ff", true);
            if (t > 40 && (pressed.start || pressed.a)) { total = 0; startLevel(); }'''
assert old in s
s=s.replace(old,new)
s=s.replace("<title>","<title>",1)
open(dst,'w').write(s)
