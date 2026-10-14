s=open('q5a.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:70])
    s=s.replace(a,b)
meth='''          // far + mid layers: horizon isles, lighthouse beam, drifting cloud banks, a bird flock
          bgFar: function (x, fl) {
            var t = this.timer, i, u;
            // far: jagged isles on the horizon, a lighthouse sweeping its beam
            x.fillStyle = fl ? "#1a2450" : "#0b1334";
            for (i = 0; i < 320; i += 2) { u = i * 0.045; var hh = Math.max(0, Math.sin(u) * 9 + Math.sin(u * 2.3 + 1) * 5 - 4); if (i > 232 && i < 262) hh = 0; x.fillRect(i, 213 - (hh | 0), 2, (hh | 0) + 1); }
            var lhx = 247, bm = Math.sin(t * 0.03);
            x.fillStyle = "#141c40"; x.fillRect(lhx, 196, 3, 17); x.fillRect(lhx - 1, 194, 5, 3);
            x.fillStyle = "#ffe9a0"; x.fillRect(lhx + 1, 195, 1, 1);
            x.fillStyle = "rgba(255,236,160," + (0.05 + 0.05 * Math.abs(bm)).toFixed(3) + ")";
            for (i = 0; i < 28; i++) x.fillRect(bm > 0 ? lhx + 2 + i * 2 : lhx - 1 - i * 2, 194 - (i >> 3), 2, 3 + (i >> 2));
            // mid: cloud banks sliding at different speeds, moonlit tops
            for (i = 0; i < 4; i++) {
              var cx = ((t * (0.08 + i * 0.05) + i * 97) % 400) - 40, cy = 70 + i * 26 + (i % 2) * 8;
              x.fillStyle = fl ? "rgba(120,130,190,0.35)" : "rgba(40,52,100," + (0.35 - i * 0.04).toFixed(2) + ")";
              x.fillRect(cx, cy, 46 + i * 6, 5); x.fillRect(cx + 8, cy - 3, 26, 4); x.fillRect(cx + 14, cy + 5, 28, 2);
              x.fillStyle = "rgba(190,200,240,0.18)"; x.fillRect(cx + 8, cy - 3, 26, 1);
            }
            // birds crossing every ~7 s
            var bt = t % 420;
            if (bt < 300) for (i = 0; i < 4; i++) { var bx = bt * 1.2 - 40 + i * 12, by = 100 + Math.sin(bt * 0.05 + i) * 6 + i * 5, fw = (t >> 3) % 2;
              x.fillStyle = "#2a3466"; x.fillRect(bx | 0, by | 0, 1, 1); x.fillRect((bx | 0) - 1, (by | 0) - fw, 1, 1); x.fillRect((bx | 0) + 1, (by | 0) - fw, 1, 1); x.fillRect((bx | 0) - 2, (by | 0) - fw * 2, 1, 1); x.fillRect((bx | 0) + 2, (by | 0) - fw * 2, 1, 1); }
          },
          // near layer: vines swaying under the platforms, fireflies, moon glints on the water
          bgNear: function (x) {
            var t = this.timer, i, j, pl;
            for (i = 0; i < this.PL.length; i++) { pl = this.PL[i];
              for (j = pl.x0 + 8; j < pl.x1 - 4; j += 13) { var len = 5 + ((j * 7) % 9), sw = Math.sin(t * 0.05 + j) * 1.5;
                x.fillStyle = "#1f6a2c"; for (var k = 0; k < len; k++) x.fillRect(j + Math.round(sw * k / len), pl.y + 9 + k, 1, 1);
                x.fillStyle = "#5fd060"; x.fillRect(j + Math.round(sw), pl.y + 9 + len, 2, 1); x.fillRect(j + Math.round(sw) - 1, pl.y + 9 + len - 2, 1, 1); }
              // drip falling from one vine
              var dd = (t * 1.5 + i * 41) % 90; if (dd < 40) { x.fillStyle = "rgba(160,210,255,0.7)"; x.fillRect(pl.x0 + 8 + ((i * 17) % 20), pl.y + 17 + dd, 1, 2); }
              // grass tufts sway on top
              for (j = pl.x0 + 5; j < pl.x1 - 3; j += 11) { var gs = Math.round(Math.sin(t * 0.07 + j));
                x.fillStyle = "#6fe070"; x.fillRect(j + gs, pl.y - 3, 1, 3); x.fillRect(j + 2 - gs, pl.y - 2, 1, 2); }
            }
            // fireflies
            for (i = 0; i < 9; i++) { var fx = (i * 83 + Math.sin(t * 0.02 + i) * 14 + 30) % 320, fy = 70 + (i * 41) % 130 + Math.sin(t * 0.03 + i * 2) * 8, fb = (t + i * 19) % 60;
              if (fb < 36) { x.fillStyle = fb < 6 || fb > 30 ? "rgba(255,240,120,0.4)" : "#fff3a0"; x.fillRect(fx | 0, fy | 0, 1, 1); if (fb >= 6 && fb <= 30) { x.fillStyle = "rgba(255,240,120,0.18)"; x.fillRect((fx | 0) - 1, fy | 0, 3, 1); x.fillRect(fx | 0, (fy | 0) - 1, 1, 3); } } }
            // moon glints on the water under the crescent
            for (i = 0; i < 6; i++) { var mg = (t + i * 17) % 50; if (mg < 25) { x.fillStyle = mg < 8 || mg > 17 ? "rgba(244,236,192,0.35)" : "rgba(244,236,192,0.8)"; x.fillRect(266 + Math.round(Math.sin(i * 2 + t * 0.04) * 8), 217 + i * 3, 2 + (mg > 8 && mg < 17 ? 2 : 0), 1); } }
          },
'''
rep("          wrap: function",meth+"          wrap: function")
rep("            // storm cloud with a lightning flicker","            this.bgFar(x, fl);\n            // storm cloud with a lightning flicker")
rep("            if (this.lowT > 15 && !P.dead) {","            this.bgNear(x);\n            if (this.lowT > 15 && !P.dead) {")
open('q5b.html','w').write(s)
