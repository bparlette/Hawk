s=open('q4a.html').read()
bg='''          // layered backdrop: far (moon, crystal ridges), mid (fog, rising shards), near (torches, drips, frame glint)
          bgLayers: function (x) {
            var t = this.timer, i, xx;
            // shooting star every ~7 s
            var ss = t %% 420; if (ss < 22) { var hx = 310 - ss * 10, hy = 8 + ss * 2.6; x.fillStyle = "rgba(255,255,255,0.35)"; x.fillRect(hx + 3, hy - 1, 10, 1); x.fillRect(hx + 7, hy - 2, 8, 1); x.fillStyle = "#fff"; x.fillRect(hx, hy, 3, 2); }
            // far: moon with halo, soft rings pulse
            var mx = 282, my = 128, pulse = 0.05 + 0.03 * Math.sin(t * 0.03);
            x.fillStyle = "rgba(190,200,255," + pulse.toFixed(3) + ")"; x.beginPath(); x.arc(mx, my, 24, 0, 6.3); x.fill();
            x.fillStyle = "rgba(190,200,255," + (pulse * 1.6).toFixed(3) + ")"; x.beginPath(); x.arc(mx, my, 17, 0, 6.3); x.fill();
            x.fillStyle = "#dfe6ff"; x.beginPath(); x.arc(mx, my, 11, 0, 6.3); x.fill();
            x.fillStyle = "#b4bfe8"; x.fillRect(mx - 5, my - 4, 3, 3); x.fillRect(mx + 2, my + 2, 4, 3); x.fillRect(mx - 3, my + 5, 2, 2);
            x.fillStyle = "#fff"; x.fillRect(mx - 8, my - 6, 2, 2);
            // far ridges: two jagged crystal ranges, drifting at different speeds
            for (var ly = 0; ly < 2; ly++) {
              var off = t * (ly ? 0.09 : 0.04), base = ly ? 196 : 170, amp = ly ? 15 : 22;
              x.fillStyle = ly ? "#1a1246" : "#130d38";
              for (xx = 0; xx < W; xx += 3) {
                var u = (xx + off) * (ly ? 0.055 : 0.04), hgt = base - Math.abs(Math.sin(u)) * amp - Math.abs(Math.sin(u * 2.3 + ly)) * amp * 0.4;
                x.fillRect(xx, hgt | 0, 3, H - (hgt | 0));
              }
              // glowing crystal tips on the ridge
              for (i = 0; i < 6; i++) {
                var px = ((i * 71 + ly * 37 - off * 1) %% (W + 40) + W + 40) %% (W + 40) - 20, u2 = (px + off) * (ly ? 0.055 : 0.04);
                var py = base - Math.abs(Math.sin(u2)) * amp - Math.abs(Math.sin(u2 * 2.3 + ly)) * amp * 0.4 - 1;
                var gl = (t + i * 23) %% 90 < 45 ? 1 : 0.5;
                x.fillStyle = "rgba(" + (ly ? "120,200,255" : "200,140,255") + "," + (0.6 * gl).toFixed(2) + ")"; x.fillRect(px | 0, py | 0, 2, 2);
                x.fillStyle = "rgba(255,255,255," + (0.5 * gl).toFixed(2) + ")"; x.fillRect(px | 0, (py | 0) - 1, 1, 1);
              }
            }
            // mid: fog banks sliding sideways
            for (i = 0; i < 3; i++) {
              var fx = ((t * (0.12 + i * 0.05) + i * 130) %% (W + 160)) - 80, fy = 150 + i * 28;
              x.fillStyle = "rgba(150,130,230,0.07)"; x.save(); x.translate(fx, fy); x.scale(4, 1); x.beginPath(); x.arc(0, 0, 22, 0, 6.3); x.fill(); x.restore();
            }
            // mid: shards drifting upward with a sway
            for (i = 0; i < 9; i++) {
              var sy = H + 8 - ((t * (0.22 + (i %% 3) * 0.08) + i * 41) %% (H + 16)), sx = ((i * 97) %% W) + Math.sin(t * 0.02 + i) * 7, pc = this.PAL[i %% 6];
              if ((sx > this.OX - 10 && sx < this.OX + this.COLS * this.CS + 10)) continue;
              x.fillStyle = pc[1]; x.globalAlpha = 0.5; x.fillRect(sx | 0, sy | 0, 1, 3); x.fillRect((sx | 0) - 1, (sy | 0) + 1, 3, 1); x.globalAlpha = 1;
            }
            // near: torches on brackets beside the well
            var tor = [[this.OX - 14, 150], [this.OX + this.COLS * this.CS + 13, 150]];
            for (i = 0; i < 2; i++) {
              var tx = tor[i][0], ty = tor[i][1], fl = Math.sin(t * 0.35 + i * 2) * 0.5 + Math.sin(t * 0.9 + i) * 0.5;
              x.fillStyle = "rgba(255,170,60," + (0.11 + 0.04 * fl).toFixed(3) + ")"; x.beginPath(); x.arc(tx, ty - 6, 20 + fl * 2, 0, 6.3); x.fill();
              x.fillStyle = "#3a342c"; x.fillRect(tx - 1, ty, 3, 10); x.fillStyle = "#6c6458"; x.fillRect(tx - 3, ty - 1, 7, 3); x.fillStyle = "#1a1612"; x.fillRect(tx - 3, ty + 1, 7, 1);
              var fh = 6 + (fl * 2 | 0);
              x.fillStyle = "#e0401a"; x.fillRect(tx - 2, ty - 1 - fh, 5, fh); x.fillStyle = "#ff9a20"; x.fillRect(tx - 1, ty - 1 - fh + 2, 3, fh - 2); x.fillStyle = "#fff1a0"; x.fillRect(tx, ty - 5, 1, 3);
              if ((t + i * 9) %% 24 < 12) { x.fillStyle = "#ffb040"; x.fillRect(tx + ((t >> 2) %% 5) - 2, ty - fh - 3 - ((t + i * 9) %% 24), 1, 1); }
            }
            // near: water drips from the ceiling
            for (i = 0; i < 4; i++) {
              var dx = [96, 108, 226, 300][i], dc = (t * 2 + i * 57) %% 150, dy = dc * 1.5 - 6;
              if (dy < H - 40) { x.fillStyle = "rgba(160,210,255,0.6)"; x.fillRect(dx, dy | 0, 1, 3); }
              else if (dy < H - 34) { x.fillStyle = "rgba(160,210,255,0.5)"; x.fillRect(dx - 2, H - 40, 5, 1); }
            }
          },
'''.replace('%%','%')
a='          draw: function (x) {'
assert s.count(a)==1
s=s.replace(a,bg+a)
old='''            for (i = 0; i < this.stars.length; i++) { var s = this.stars[i]; x.fillStyle = (this.timer + s.t) % 60 < 8 ? "#fff" : "#6a6aa0"; x.fillRect(s.x | 0, s.y | 0, 1, 1); }'''
assert s.count(old)==1
s=s.replace(old,old+'\n            this.bgLayers(x);')
# frame glint
old='''            x.fillStyle = "#0e0c24"; x.fillRect(OX, OY, WW, WH); var wgr'''
assert s.count(old)==1
s=s.replace(old,'''            var gx2 = ((this.timer * 2) % (WW + 80)) - 40; x.fillStyle = "rgba(255,240,200,0.85)"; if (gx2 >= 0 && gx2 < WW) { x.fillRect(OX + gx2, OY - 8, 3, 1); x.fillRect(OX + WW - gx2, OY + WH + 7, 3, 1); }
'''+old)
open('q4b.html','w').write(s)
