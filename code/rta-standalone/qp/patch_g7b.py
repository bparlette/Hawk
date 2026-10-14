s=open('qp/q7a.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:70]); s=s.replace(a,b)
bg='''          /* far layer: glowing sun with rays, snowy blue ridges, mist, two cloud layers, distant birds */
          bgFar: function (x, t) {
            var i, k, a, r, sx = 272, sy = 34, pulse = 1 + Math.sin(t * 0.03) * 0.08;
            x.fillStyle = "rgba(255,248,192,0.10)"; x.beginPath(); x.arc(sx, sy, 38 * pulse, 0, 7); x.fill();
            x.fillStyle = "rgba(255,248,192,0.18)"; x.beginPath(); x.arc(sx, sy, 28 * pulse, 0, 7); x.fill();
            for (k = 0; k < 12; k++) { a = t * 0.004 + k * Math.PI / 6; for (r = 18; r < 34; r += 4) { x.fillStyle = "rgba(255,252,210," + (0.5 - (r - 18) * 0.025).toFixed(2) + ")"; x.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r), 2, 2); } }
            x.fillStyle = "#fff8c0"; x.fillRect(sx - 10, sy - 10, 20, 20); x.fillStyle = "#fffbe0"; x.fillRect(sx - 7, sy - 7, 14, 14); x.fillStyle = "#fff"; x.fillRect(sx - 4, sy - 5, 5, 3);
            for (i = 0; i < 3; i++) { var fx = ((i * 140 + t * 0.04) % 420) - 50, fy = 22 + i * 17; x.fillStyle = "rgba(255,255,255,0.45)"; x.fillRect(fx, fy, 34, 4); x.fillRect(fx + 8, fy - 3, 18, 3); }
            for (i = 0; i < 322; i += 2) {
              var mh = 40 + Math.round(26 * Math.abs(Math.sin(i / 53 + 1)) + 10 * Math.sin(i / 17));
              x.fillStyle = "#86aed4"; x.fillRect(i, 160 - mh, 2, mh + 12);
              if (mh > 56) { x.fillStyle = "#e8f4ff"; x.fillRect(i, 160 - mh, 2, 3 + Math.round((mh - 56) / 3)); }
              else if (mh > 30) { x.fillStyle = "#a7c8e6"; x.fillRect(i, 160 - mh, 2, 2); }
            }
            for (i = 0; i < 4; i++) { var mx = ((i * 110 - t * 0.12) % 440 + 440) % 440 - 60; x.fillStyle = "rgba(235,248,255,0.4)"; x.fillRect(mx, 130 + i * 6, 90, 3); x.fillRect(mx + 20, 128 + i * 6, 50, 2); }
            for (i = 0; i < 5; i++) { var cx0 = ((i * 83 + t * (0.1 + i * 0.03)) % 400) - 40, cy0 = 20 + (i * 29) % 70;
              x.fillStyle = "#ffffff"; x.fillRect(cx0, cy0, 40, 8); x.fillRect(cx0 + 8, cy0 - 6, 22, 7); x.fillStyle = "#dcefff"; x.fillRect(cx0, cy0 + 6, 40, 2); x.fillStyle = "rgba(255,255,255,0.8)"; x.fillRect(cx0 + 10, cy0 - 5, 8, 1); }
            for (k = 0; k < 6; k++) { var bx = Math.round(((t * 0.4 + k * 61) % 420) - 50), by = 52 + (k * 19) % 46 + Math.round(Math.sin(t * 0.04 + k) * 3), fw = Math.floor(t / 9 + k) % 2;
              x.fillStyle = "#33415f"; if (fw) { x.fillRect(bx, by, 2, 1); x.fillRect(bx + 2, by + 1, 2, 1); x.fillRect(bx + 4, by, 2, 1); } else { x.fillRect(bx, by + 1, 2, 1); x.fillRect(bx + 2, by, 2, 1); x.fillRect(bx + 4, by + 1, 2, 1); } }
          },
          /* mid layer: pond with shimmer, falling leaves, butterflies */
          bgMid: function (x, t) {
            var i, r, k;
            for (r = 0; r < 8; r++) { var ww = 108 - Math.abs(r - 3) * 6 - (r > 4 ? (r - 4) * 8 : 0); x.fillStyle = r < 2 ? "#6fb7e8" : r < 5 ? "#4a9ad6" : "#3a82c0"; x.fillRect(250 - ww / 2, 160 + r, ww, 1); }
            x.fillStyle = "#8ed0f5"; for (i = 0; i < 9; i++) { var sh = (i * 37 + t * 0.5) % 100; if ((Math.floor(t / 10) + i) % 3) x.fillRect(200 + sh, 161 + (i * 3) % 6, 4 + (i % 3) * 2, 1); }
            x.fillStyle = "#2a7a3a"; for (i = 0; i < 7; i++) { x.fillRect(198 + i * 17 + (i % 2) * 5, 168 - (i % 3), 3, 3 + (i % 3)); x.fillStyle = i % 2 ? "#2a7a3a" : "#3a9a4a"; }
            for (k = 0; k < 7; k++) { var lt = (t * 0.6 + k * 53) % 230, lx = [40, 252, 150][k % 3] + Math.sin(lt * 0.09 + k) * 16 + lt * 0.12 * (k % 2 ? 1 : -1), ly = 80 + lt * 0.5;
              if (ly < 188) { x.fillStyle = k % 2 ? "#e0a020" : "#c85a1a"; x.fillRect(Math.round(lx), Math.round(ly), 3, 2); x.fillStyle = "#6a3a10"; x.fillRect(Math.round(lx) + 1, Math.round(ly) + 1, 1, 1); } }
            for (k = 0; k < 2; k++) { var bt = t * 0.02 + k * 3, bx = 160 + Math.sin(bt) * 110 + k * 20, by = 150 + Math.sin(bt * 2.3) * 14 - k * 18, wf = Math.floor(t / 5 + k) % 2, bc = k ? "#ff8ad0" : "#ffd23a";
              x.fillStyle = "#140a12"; x.fillRect(Math.round(bx), Math.round(by), 1, 3); x.fillStyle = bc; if (wf) { x.fillRect(Math.round(bx) - 3, Math.round(by) - 1, 3, 3); x.fillRect(Math.round(bx) + 1, Math.round(by) - 1, 3, 3); } else { x.fillRect(Math.round(bx) - 2, Math.round(by), 2, 2); x.fillRect(Math.round(bx) + 1, Math.round(by), 2, 2); } }
          },
          /* near layer: flowers poking through the grass, drifting pollen, wind gust shading */
          bgNear: function (x, t) {
            var i, k, FL = [14, 47, 83, 121, 158, 197, 233, 268, 301];
            for (i = 0; i < FL.length; i++) {
              var fx = FL[i], sw = Math.round(Math.sin(t * 0.05 + fx * 0.3) * 2 + Math.sin(t * 0.017 - fx * 0.025) * 2), fy = 190 + (i * 7) % 9, col = ["#ff5a8a", "#ffe14d", "#fff", "#b07aff", "#ff8a3a"][i % 5];
              x.fillStyle = "#15502a"; x.fillRect(fx + sw / 2, fy + 2, 2, 22); x.fillStyle = "#140a12"; x.fillRect(fx + sw - 3, fy - 3, 8, 8); x.fillStyle = col; x.fillRect(fx + sw - 2, fy - 2, 6, 6); x.fillStyle = "#ffd23a"; x.fillRect(fx + sw, fy, 2, 2); x.fillStyle = "rgba(255,255,255,0.5)"; x.fillRect(fx + sw - 2, fy - 2, 2, 1);
            }
            for (k = 0; k < 14; k++) { var px = ((k * 47 + t * (0.3 + (k % 3) * 0.1)) % 340) - 10, py = 120 + (k * 29) % 80 + Math.sin(t * 0.05 + k) * 6;
              x.fillStyle = "rgba(255,255,230," + (0.35 + (k % 3) * 0.15).toFixed(2) + ")"; x.fillRect(Math.round(px), Math.round(py), 2, 2); }
            var gp = (t * 0.7) % 520 - 100; x.fillStyle = "rgba(255,255,255,0.07)"; x.fillRect(gp, 186, 90, 28);
          },
          draw: function (x) {'''
rep("          draw: function (x) {",bg)
rep('''sk.addColorStop(1, "#bfeaff");''','''sk.addColorStop(0.7, "#9ad6fb"); sk.addColorStop(1, "#d8f4ff");''')
# replace sun+clouds with bgFar
a=s.index('            x.fillStyle = "#fff8c0"; x.fillRect(262, 24, 20, 20);'); 
b=s.index('            x.fillStyle = "#4f9a5c"; for (i = 0; i < 320; i += 4)')
s=s[:a]+'            this.bgFar(x, t);\n'+s[b:]
# tree sway
rep('''              x.fillStyle = "#15502a"; x.fillRect(tx - 24 * s, 78,''','''              x.save(); x.translate(Math.round(Math.sin(t * 0.03 + tx) * 1.3), 0);
              x.fillStyle = "#15502a"; x.fillRect(tx - 24 * s, 78,''')
rep('''x.fillRect(tx - 18 * s, 84, 10 * s, 4);
            });''','''x.fillRect(tx - 18 * s, 84, 10 * s, 4);
              x.restore();
            });
            this.bgMid(x, t);''')
rep("sw = Math.round(Math.sin(t * 0.05 + i * 0.3) * 2);","sw = Math.round(Math.sin(t * 0.05 + i * 0.3) * 2 + Math.sin(t * 0.017 - i * 0.025) * 2);")
rep('''x.fillStyle = "#1c6a2a"; x.fillRect(0, 214, 320, 26); x.fillStyle = "#2a8a3a"; x.fillRect(0, 214, 320, 2);''','''x.fillStyle = "#1c6a2a"; x.fillRect(0, 214, 320, 26); x.fillStyle = "#2a8a3a"; x.fillRect(0, 214, 320, 2);
            this.bgNear(x, t);''')
open('qp/q7b.html','w').write(s); print('ok')
