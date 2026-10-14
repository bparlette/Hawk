s=open('qp/q5e0.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80])
    s=s.replace(a,b)
rep('this.hs = 0; this.flash = 0;','this.hs = 0; this.flash = 0; this.st = { stomps: 0, collected: 0, hit: 0 }; this.tally = null;')
rep('this.score += 500; this.pop("+500"','this.st.stomps++; this.score += 500; this.pop("+500"')
rep('this.score += 1000; this.pop("+1000"','this.st.collected++; this.score += 1000; this.pop("+1000"')
rep('P.hf = 24; this.hs = 5;','P.hf = 24; this.st.hit++; this.hs = 5;')
rep('die: function (water) { var P = this.p; P.dead = 90;','die: function (water) { var P = this.p; if (water) this.st.hit++; P.dead = 90;')
rep('this.won = 1; this.jingled = true; SFX.win();','this.won = 1; this.jingled = true; this.tally = [["FOES BEATEN", 6], ["STOMPS", this.st.stomps], ["TIMES HIT", this.st.hit], ["SECONDS", Math.round(this.timer / 60)]]; SFX.win();')
# HUD
rep('''            text("SCORE " + this.score, 8, 4, 1, "#ffe14d");
            text("FOES " + (6 - this.spawned + this.foes.length), 136, 4, 1, "#ff7ad9");''',
'''            if (!this.SB) this.SB = this.buildSprites();
            x.fillStyle = "rgba(6,10,30,0.6)"; x.fillRect(0, 0, 320, 15); x.fillStyle = "#2a3a7a"; x.fillRect(0, 15, 320, 1);
            this.hudIcon(x, 0, 4, 3); text("SCORE " + this.score, 18, 4, 1, "#ffe14d");
            this.hudIcon(x, 1, 126, 3); text("FOES " + (6 - this.spawned + this.foes.length), 140, 4, 1, "#ff7ad9");
            text("AIR", 252, 4, 1, "#8ac0ff");
            for (i = 0; i < 2; i++) { var bsp = this.SB.bal[i ? "#ffd23a" : "#ff4040"].s; x.globalAlpha = P.bal > i ? 1 : 0.22; if (bsp.cv) x.drawImage(bsp.cv, 276 + i * 16, 1); else { x.fillStyle = i ? "#ffd23a" : "#ff4040"; x.fillRect(278 + i * 16, 3, 8, 9); } x.globalAlpha = 1; }''')
rep('          wrap: function (fn, xx)','''          // 9px HUD icon chips: 0 coin, 1 foe head
          hudIcon: function (x, k, px, py) {
            x.fillStyle = "#140a12"; x.fillRect(px, py, 11, 9); x.fillStyle = "#2a3466"; x.fillRect(px + 1, py + 1, 9, 7);
            if (k === 0) { x.fillStyle = "#c89a28"; x.fillRect(px + 3, py + 2, 5, 5); x.fillRect(px + 2, py + 3, 7, 3); x.fillStyle = "#ffe14d"; x.fillRect(px + 3, py + 3, 3, 3); x.fillStyle = "#fff"; x.fillRect(px + 4, py + 3, 1, 1); }
            else { x.fillStyle = "#7ad04a"; x.fillRect(px + 2, py + 2, 6, 5); x.fillStyle = "#3f8a2a"; x.fillRect(px + 2, py + 6, 6, 1); x.fillStyle = "#fff"; x.fillRect(px + 3, py + 3, 2, 2); x.fillStyle = "#140a12"; x.fillRect(px + 4, py + 4, 1, 1); x.fillStyle = "#ffd23a"; x.fillRect(px + 8, py + 4, 2, 2); }
          },
          wrap: function (fn, xx)''')
# title art
rep('          goal: "FLAP WITH A.','''          titleArt: function (x, t) {
            if (!this.SB) this.SB = this.buildSprites();
            var S = this.SB, i;
            x.save(); x.translate(0, 10);
            function big(sp, cx, by, k, flip) { if (!sp || !sp.cv) return; var w = sp.w * k, h = sp.h * k, x0 = Math.round(cx - w / 2), y0 = Math.round(by - h);
              if (flip) { x.save(); x.translate(x0 + w, y0); x.scale(-1, 1); x.drawImage(sp.cv, 0, 0, w, h); x.restore(); } else x.drawImage(sp.cv, x0, y0, w, h); }
            // moon + drifting clouds
            x.fillStyle = "rgba(244,236,192,0.10)"; x.beginPath(); x.arc(262, 78, 26, 0, 6.3); x.fill();
            x.fillStyle = "#f4ecc0"; x.beginPath(); x.arc(262, 78, 16, 0, 6.3); x.fill();
            x.fillStyle = "#0e0b2a"; x.beginPath(); x.arc(270, 74, 14, 0, 6.3); x.fill();
            for (i = 0; i < 3; i++) { var cx = ((t * (0.15 + i * 0.08) + i * 120) % 420) - 50, cy = 62 + i * 24;
              x.fillStyle = "rgba(60,72,140," + (0.5 - i * 0.1).toFixed(2) + ")"; x.fillRect(cx, cy, 60, 6); x.fillRect(cx + 10, cy - 4, 32, 5); x.fillRect(cx + 18, cy + 6, 34, 3);
              x.fillStyle = "rgba(190,200,240,0.2)"; x.fillRect(cx + 10, cy - 4, 32, 1); }
            // lighthouse with sweeping beam
            var bm = Math.sin(t * 0.03);
            x.fillStyle = "rgba(255,236,160," + (0.06 + 0.06 * Math.abs(bm)).toFixed(2) + ")"; for (i = 0; i < 40; i++) x.fillRect(bm > 0 ? 258 + i * 2 : 254 - i * 2, 100 - (i >> 3), 2, 4 + (i >> 2));
            x.fillStyle = "#1c2450"; x.fillRect(254, 104, 8, 46); x.fillRect(252, 100, 12, 5); x.fillStyle = "#c03030"; x.fillRect(254, 114, 8, 5); x.fillRect(254, 130, 8, 5);
            x.fillStyle = "#ffe9a0"; x.fillRect(256, 101, 4, 3);
            // sea + shimmer
            x.fillStyle = "#0a1838"; x.fillRect(0, 150, 320, 20); x.fillStyle = "#2a5a9a"; for (i = 0; i < 320; i += 4) x.fillRect(i, 150 + (Math.sin(i * 0.15 + t * 0.06) > 0.6 ? 1 : 0), 3, 1);
            x.fillStyle = "#1e3a6a"; for (i = 0; i < 320; i += 16) x.fillRect((i + (t >> 2)) % 320, 156 + ((i >> 4) % 2) * 5, 7, 1);
            // the platform
            x.fillStyle = "#6b4426"; x.fillRect(30, 124, 112, 10); x.fillRect(38, 134, 96, 6); x.fillStyle = "#3fbf4a"; x.fillRect(30, 124, 112, 4); x.fillStyle = "#8ef07a"; for (i = 34; i < 140; i += 9) x.fillRect(i, 122, 1, 2);
            x.fillStyle = "#1f6a2c"; for (i = 40; i < 134; i += 15) { var vl = 5 + (i * 7) % 8; x.fillRect(i + Math.round(Math.sin(t * 0.05 + i)), 140, 1, vl); }
            // hero floats on two balloons, bobbing
            var bob = Math.round(Math.sin(t * 0.06) * 2), hx = 86, hy = 124 + bob;
            big(S.hero.idle, hx, hy, 3, false);
            var hands = [[hx - 8, hy - 30], [hx + 8, hy - 30]], bl = [[hx - 14 + Math.round(Math.sin(t * 0.09) * 2), hy - 56], [hx + 14 + Math.round(Math.sin(t * 0.09 + 2) * 2), hy - 56]];
            for (i = 0; i < 2; i++) { x.fillStyle = "#c8c8d8"; for (var j = 0; j < 26; j++) { var f = j / 25; x.fillRect(Math.round(hands[i][0] + (bl[i][0] - hands[i][0]) * f + Math.sin(t * 0.2 + j * 0.9) * 0.8), Math.round(hands[i][1] - j), 1, 1); }
              big(S.bal[i ? "#ffd23a" : "#ff4040"].l, bl[i][0], bl[i][1], 2, false); }
            // foe approaches on a pink balloon; every 260 frames it gets popped and parachutes away
            var ph = t % 260, fx = 205 - Math.min(ph, 120) * 0.3 + Math.sin(t * 0.04) * 6, fy = 112 + Math.round(Math.sin(t * 0.07) * 4);
            if (ph < 150) { var fb = fx + 4; x.fillStyle = "#c8c8d8"; for (i = 0; i < 22; i++) x.fillRect(Math.round(fb + (fx - fb) * i / 22 + Math.sin(t * 0.2 + i) * 0.6), fy - 34 + i, 1, 1);
              big(S.bal["#ff7ad9"].l, fb, fy - 34, 2, false); big(S.foe[(t >> 4) % 2 ? "up" : "dn"], fx, fy, 3, true); }
            else if (ph < 168) { for (i = 0; i < 12; i++) { var an = i * 0.52, rr = (ph - 150) * 2.6; x.fillStyle = i % 2 ? "#fff" : "#ff7ad9"; x.fillRect((fx + 4 + Math.cos(an) * rr) | 0, (fy - 48 + Math.sin(an) * rr) | 0, 2, 2); }
              big(S.foe.dnW, fx, fy, 3, true); }
            else { var fy2 = fy + (ph - 168) * 0.55; if (fy2 < 132) { big(S.canopy, fx, fy2 - 30, 3, false); big(S.foe.up, fx, fy2, 3, true); } }
            x.restore();
          },
          goal: "FLAP WITH A.''')
a='x.fillStyle = "#f4ecc0"; x.fillRect(262, 22, 12, 14); x.fillRect(260, 24, 16, 10); x.fillStyle = fl ? "#0e1636" : "#060a1e"; x.fillRect(267, 21, 10, 12);'
assert s.count(a)==1
s=s.replace(a,'x.fillStyle = "rgba(244,236,192,0.08)"; x.beginPath(); x.arc(268, 30, 17, 0, 6.3); x.fill(); x.fillStyle = "#f4ecc0"; x.beginPath(); x.arc(268, 30, 11, 0, 6.3); x.fill(); x.fillStyle = fl ? "#0e1636" : "#060a1e"; x.beginPath(); x.arc(273, 27, 10, 0, 6.3); x.fill();')
open('qp/q5e.html','w').write(s); print('ok')
