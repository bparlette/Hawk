s=open('m3.html').read()
kit=open('qp/kit.js').read().replace('mk: function (rows, pal, ol) {','mk: function (rows, pal, ol, flat) {').replace('var col = pal[ch] || "#f0f", flat = "kWw".indexOf(ch) >= 0;\n              if (!flat) {','var col = pal[ch] || "#f0f", fl = flat || "kWw".indexOf(ch) >= 0;\n              if (!fl) {')
spr='''          buildSprites: function () {
            var mk = this.mk.bind(this), S = {};
            var HP = { B: "#1fb3b0", d: "#0d6f6d", S: "#ffcf99", W: "#ffffff", k: "#140a12", R: "#e0202a", w: "#f4f4f4" };
            var top = ["....BBBBB.....", "BBBBBBBBBB....", ".BBBBBBBWWW...", "..BBBBBBWkW...", "BBBBBBBBWkW...", ".BBBBBBSSSSS..", "..BBBBBSSSSSk.", "...BBBBBSSS...", "....BBBBBB...."];
            var hurtTop = ["....BBBBB.....", "BBBBBBBBBB....", ".BBBBBBBkWk...", "..BBBBBBWkW...", "BBBBBBBBkWk...", ".BBBBBBSSSSS..", "..BBBBBSSkSS..", "...BBBBBSSS...", "....BBBBBB...."];
            var body = ["...BBSSSBBB...", "..wBBSSSBBw...", "....BSSSB.....", "....BBBBB....."];
            var bodyA = ["...BBSSSBBBw..", "..wBBSSSBB....", "....BSSSB.....", "....BBBBB....."];
            var bodyH = ["w..BBSSSBB..w.", ".wBBBSSSBBBw..", "....BSSSB.....", "....BBBBB....."];
            var LG = { idle: ["....BB.BB.....", "....BB.BB.....", "..RRRR.RRRR...", ".RRRRR.RRRRR.."],
              r1: [".BB.....BB....", "BB.......BB...", "RRR.......RRR.", "RRRR......RRRR"], r2: ["....BBBB......", "....BBB.......", "...RRRR.......", "..RRRRR......."],
              r3: ["..BB....BB....", ".BB.....BB....", "RRR.....RRR...", "RR......RRRR.."], r4: [".....BBBB.....", ".....BBB......", ".....RRRR.....", ".....RRRRR...."],
              skid: ["......BB.BB...", ".......BB.BB..", "......RRRRRRR.", "......RRRR.RRR"], air: ["....BB.BB.....", "....B...B.....", "...RRR.RRR....", "..RRR...RRR..."] };
            S.idle = mk(top.concat(body, LG.idle), HP);
            S.run = [mk(top.concat(bodyA, LG.r1), HP), mk(top.concat(body, LG.r2), HP), mk(top.concat(bodyA, LG.r3), HP), mk(top.concat(body, LG.r4), HP)];
            S.skid = mk(top.concat(bodyA, LG.skid), HP);
            S.air = mk(top.concat(bodyH, LG.air), HP);
            S.hurt = mk(hurtTop.concat(bodyH, LG.air), { B: "#8a8a8a", d: "#555", S: "#bdbdbd", W: "#fff", k: "#140a12", R: "#777", w: "#ddd" });
            S.ball = mk(["....BBBBBB....", "..BBBBBBBBBB..", ".BBBdBBBBdBBB.", ".BBddBBBBddBB.", "BBBBBBBBBBBBBB", "BBBBBBSSBBBBBB", "BBBBBSSSSkBBBB", "BBBBBSSSSSBBBB",
              "BBdBBBSSSBBdBB", "BBddBBBBBBddBB", ".BBBBBBBBBBBB.", ".BBBBBBBBBBBB.", "..BBBBBBBBBB..", "....BBBBBB...."], HP);
            var EP = { R: "#d02a2a", k: "#140a12", W: "#ffffff", G: "#9aa4b8", g: "#5c667a", K: "#333a48" };
            var eb = ["....kkkk........", "..RRRRRRRR......", ".RRWRRRRkRRR....", "RRRRRRkRRRRRRR..", "RRkRRRRRRRkRRRRG", "RRRRRRRRRRRRRGGG", ".RRRRRkRRRRRGWkG", "..RRRRRRRRRGGGG.", "...gggggggggg..."];
            S.foe = [mk(eb.concat(["..kKk....kKk....", "..kKk....kKk...."]), EP), mk(eb.concat(["..KkK....KkK....", "..KkK....KkK...."]), EP)];
            var RP = { Y: "#ffe14d", L: "#fff7c0" };
            var r1 = ["..YY..", ".Y..L.", "Y....Y", "Y....Y", "Y....Y", "Y....Y", ".Y..Y.", "..YY.."];
            S.ring = [mk(["..YYYY..", ".Y....L.", "Y......Y", "Y......Y", "Y......Y", "Y......Y", ".Y....Y.", "..YYYY.."], RP), mk(r1, RP), mk(["Y", "Y", "L", "Y", "Y", "Y", "Y", "Y"], RP), mk(r1.map(function (r) { return r.split("").reverse().join(""); }), RP)];
            var BP = { B: "#8fd8ff", W: "#ffffff", O: "#ffa020", k: "#140a12" };
            S.bird = [mk(["WW...WW", ".WBBBW.", "..BBBkO", "..BBBB.", "...BB.."], BP), mk(["..BBB..", ".BBBBkO", "WWBBBWW", "W.BBB.W", "...B..."], BP)];
            return S;
          },
'''
a='          pop: function (s, x, y) { this.pops.push({ s: s, x: x, y: y, t: 40 }); },\n'
assert s.count(a)==1
s=s.replace(a,a+kit+spr)
s=s.replace("            var c = Math.round(this.cam), t = this.timer, i, sx, g;\n","            var c = Math.round(this.cam), t = this.timer, i, sx, g;\n            if (!this.SS) this.SS = this.buildSprites();\n            var SP = this.SS;\n",1)
assert 'var SP = this.SS' in s
def cut(a,b,new):
    global s
    i=s.index(a); j=s.index(b,i); s=s[:i]+new+s[j:]
cut("            var rw = [6, 4, 2, 4][(t >> 3) % 4];","            // particles: sparkles",'''            var rf = (t >> 3) % 4;
            for (i = 0; i < this.R.length; i++) { var r = this.R[i]; if (r.got) continue; sx = r.x - c; if (sx < -10 || sx > W + 10) continue;
              this.blit(x, SP.ring[rf], Math.round(sx), Math.round(r.y + 5));
              if (((i * 7 + (t >> 2)) % 19) === 0) { x.fillStyle = "#fff"; x.fillRect(Math.round(sx) - 3, Math.round(r.y - 5), 2, 2); } } // glint
            // scattered rings: spin fast, blink faster as they run out
            for (i = 0; i < this.lost.length; i++) { var l = this.lost[i];
              if (l.t < 60 && t % (l.t < 25 ? 4 : 8) < (l.t < 25 ? 2 : 3)) continue;
              this.blit(x, SP.ring[((t >> 1) + i) % 4], Math.round(l.x - c), Math.round(l.y + 5)); }
''')
cut("            for (i = 0; i < this.birds.length; i++) { var bd = this.birds[i], bx","            var P = this.p;\n",'''            for (i = 0; i < this.birds.length; i++) { var bd = this.birds[i];
              this.blit(x, SP.bird[(bd.t >> 2) % 2], Math.round(bd.x - c), Math.round(bd.y) + 3, bd.vx < 0); }
            for (i = 0; i < this.E.length; i++) { var e = this.E[i]; if (!e.alive) continue; sx = Math.round(e.x - c); g = this.gy(e.x);
              x.fillStyle = "rgba(0,0,0,0.3)"; x.fillRect(sx - 8, g - 1, 16, 2);
              this.blit(x, SP.foe[Math.floor(e.r / 4) % 2], sx, g + 1, e.dir < 0); }
''')
cut("              if (P.spin && !P.dead) {","            // speed lines",'''              if (P.spin && !P.dead) {
                x.fillStyle = "rgba(31,179,176,0.3)"; x.beginPath(); x.arc(hx - Math.sign(P.vx || f) * 5, hy - 8, 6, 0, Math.PI * 2); x.fill();
                x.save(); x.translate(hx, hy - 8); x.rotate(Math.floor(P.rot * (P.vx < 0 ? -1 : 1) / (Math.PI / 4)) * Math.PI / 4);
                this.blit(x, SP.ball, 0, 8); x.restore();
              } else {
                // run cycle: 4 frames stepped by distance travelled; skid, airborne and hurt poses
                var ph = Math.floor(P.run / 7) % 4, by = hy + 1 - (P.on && sp > 0.2 && ph % 2 ? 1 : 0);
                var hs = P.dead ? SP.hurt : P.skid ? SP.skid : !P.on ? SP.air : sp > 0.2 ? SP.run[ph] : SP.idle;
                this.blit(x, hs, hx, by, f < 0);
                if (!P.dead && P.on && sp > 3.3) { x.fillStyle = "rgba(255,138,143,0.6)"; x.fillRect(hx - 7 + ((t >> 1) % 3) * 4, hy - 3, 5, 2); }
              }
            }
''')
open('qp/q3a.html','w').write(s); print('ok')
