s=open('m2.html').read()
kit=open('qp/kit.js').read().replace('mk: function (rows, pal, ol) {','mk: function (rows, pal, ol, flat) {').replace('var col = pal[ch] || "#f0f", flat = "kWw".indexOf(ch) >= 0;\n              if (!flat) {','var col = pal[ch] || "#f0f", fl = flat || "kWw".indexOf(ch) >= 0;\n              if (!fl) {')
assert 'fl = flat ||' in kit
spr='''          buildSprites: function () {
            var mk = this.mk.bind(this), S = {};
            var HP = { R: "#e03a2f", S: "#ffcf99", Y: "#5a2e0c", B: "#2a64d8", O: "#ffe14d", k: "#140a12", W: "#ffffff" };
            var head = ["...RRRRR....", "..RRRRRRRRR.", "..YYYSSkS...", ".YSYSSSkSSS.", ".YSYYSSSSSSS", ".YYSSSSYYYY.", "...SSSSSSS.."];
            var torso = ["..RRBRRR....", ".RRRBRRBRR..", "RRRRBBBBRRRR", "SSRBOBBOBRSS", "SS.BBBBBB.SS"];
            var torsoF = ["..RRBRRR....", ".RRRBRRBRR..", ".RRRBBBBRRRS", "..SBOBBOBRSS", "..SBBBBBB..."];
            var torsoB = ["..RRBRRR....", ".RRRBRRBRR..", "SRRRBBBBRR..", "SSRBOBBOBS..", "...BBBBBB..."];
            var torsoJ = ["..RRBRRR.SS.", ".RRRBRRBRRS.", "SRRRBBBBRR..", "SSRBOBBOB...", "...BBBBBB..."];
            var torsoH = ["S.RRBRRR..S.", "SRRRBRRBRRS.", ".RRRBBBBRR..", "..RBOBBOB...", "...BBBBBB..."];
            var hurtHead = ["...RRRRR....", "..RRRRRRRRR.", "..YYYSkSk...", ".YSYSSSkSSS.", ".YSYYSkSkSSS", ".YYSSSWWYY..", "...SSSSSSS.."];
            var L = { idle: ["..BBB.BBB...", "..BBB.BBB...", ".YYY...YYY..", "YYYY...YYYY."], r1: [".BBB...BBB..", "BBB.....BBB.", "YY.......YYY", "YYY.......YY"],
              r2: ["...BBBBB....", "...BBBB.....", "...YYYY.....", "...YYYYY...."], r3: ["..BBB..BBB..", ".BBB....BBB.", "YYY......YY.", "YY.......YYY"],
              r4: ["...BBBBB....", "....BBBB....", "....YYYY....", "....YYYYY..."], jump: ["..BBB.BBBB..", ".BBB....BBY.", ".YY.....YYY.", "YY.........."] };
            S.idle = mk(head.concat(torso, L.idle), HP);
            S.run = [mk(head.concat(torsoF, L.r1), HP), mk(head.concat(torso, L.r2), HP), mk(head.concat(torsoB, L.r3), HP), mk(head.concat(torso, L.r4), HP)];
            S.jump = mk(head.concat(torsoJ, L.jump), HP);
            S.hurt = mk(hurtHead.concat(torsoH, L.idle), { R: "#8a8a8a", S: "#bdbdbd", Y: "#555", B: "#666", O: "#aaa", k: "#140a12", W: "#fff" });
            // pests: 3 moods (purple, red, dark red) x 2 walk frames, on-back x 2, white warning flash
            var walkA = ["....k...k.....", ".....k.k......", "...PPPPPPPP...", ".PPPPPPPPPFFF.", "PPPLLPPPPPFkF.", "PPPPPPPPPPFFF.", ".PPPPPPPPPPP..", "..F..F..F..F..", ".F..F..F..F..."];
            var walkB = walkA.slice(0, 7).concat(["..F..F..F..F..", "...F..F..F..F."]);
            var backA = [".F..F..F..F...", "..F..F..F..F..", "..PPPPPPPPPP..", ".PPPPPPPPPPPP.", ".PPPLLPPPPkPP.", "..PPPPPPPPPP.."];
            var backB = ["..F..F..F..F..", ".F..F..F..F...", "..PPPPPPPPPP..", ".PPPPPPPPPPPP.", ".PPPLLPPPPkPP.", "..PPPPPPPPPP.."];
            S.pest = []; S.back = [];
            ["#9a4dff", "#ff3b30", "#c8102e"].forEach(function (c, m) {
              var pp = { P: c, L: m ? "#ffb0a8" : "#d9b3ff", F: "#ffd9a0", k: "#140a12" };
              S.pest.push([mk(walkA, pp), mk(walkB, pp)]); S.back.push([mk(backA, pp), mk(backB, pp)]);
            });
            var WH = { P: "#fff", L: "#fff", F: "#fff", k: "#fff" };
            S.backW = mk(backA, WH, "#ffe14d", true);
            var CP = { Y: "#ffe14d", L: "#fff7c0", d: "#c9a227" };
            var c1 = [".YY.", "YLYY", "YLdY", "YLdY", "YLdY", "YYdY", ".YY."];
            S.coin = [mk([".YYYY.", "YYLYYY", "YLYYdY", "YLYYdY", "YLYYdY", "YYYYdY", ".YYYY."], CP), mk(c1, CP), mk(["d", "Y", "Y", "L", "Y", "Y", "d"], CP), mk(c1.map(function (r) { return r.split("").reverse().join(""); }), CP)];
            return S;
          },
'''
a='          pop: function (s, x, y) { this.pops.push({ s: s, x: x, y: y, t: 45 }); },\n'
assert s.count(a)==1
s=s.replace(a,a+kit+spr)
s=s.replace("            var i, e, s, b, tx, off, t = this.timer;\n","            var i, e, s, b, tx, off, t = this.timer;\n            if (!this.S2) this.S2 = this.buildSprites();\n            var SP = this.S2;\n",1)
assert 'var SP = this.S2' in s
def cut(a,b,new):
    global s
    i=s.index(a); j=s.index(b,i); s=s[:i]+new+s[j:]
cut("              if (e.flip > 0) {\n                // on its back","            // kicked pests",'''              if (e.flip > 0) {
                // on its back, legs flailing; flashes white in its last second
                var warn = e.flip < 60 && t % (e.flip < 25 ? 4 : 8) < (e.flip < 25 ? 2 : 4);
                this.blit(x, warn ? SP.backW : SP.back[Math.min(2, e.mad)][(t >> 2) % 2], px, py + 1, e.dir < 0);
              } else {
                // walk: 2 frames, body bobs a pixel
                var lg = (e.walk >> 3) % 2, bob = e.on ? lg : 0;
                this.blit(x, SP.pest[Math.min(2, e.mad)][lg], px, py + 1 + bob, e.dir < 0);
              }
            }
''')
cut("            for (i = 0; i < this.fly.length; i++) { var fy = this.fly[i];","            // coins:",'''            for (i = 0; i < this.fly.length; i++) { var fy = this.fly[i];
              x.save(); x.translate(Math.round(fy.x), Math.round(fy.y) - 4); x.rotate(Math.floor(fy.t / 4) * Math.PI / 2);
              this.blit(x, SP.back[Math.min(2, fy.mad)][(fy.t >> 2) % 2], 0, 4);
              x.restore(); }
''')
cut("              var cx = Math.round(cn.x), cyy = Math.round(cn.y), cw = [6, 4, 2, 4][(t >> 3) % 4];","              var tw = (t + i * 17) % 40;",'''              var cx = Math.round(cn.x), cyy = Math.round(cn.y);
              this.blit(x, SP.coin[(t >> 3) % 4], cx, cyy);
''')
a=s.index("            if (!(P.inv > 0 && t % 6 < 3)) {\n              var hx")
b=s.index("            for (var pq2 = this.parts.length")
s=s[:a]+'''            if (!(P.inv > 0 && t % 6 < 3)) {
              var hx = Math.round(P.x), hy = Math.round(P.y), dead = P.dead > 0;
              x.fillStyle = "rgba(0,0,0,0.35)"; x.fillRect(hx - 6, hy, 12, 2);
              var hs = dead ? SP.hurt : !P.on ? SP.jump : (inp0.left || inp0.right) ? SP.run[(P.walk >> 2) % 4] : SP.idle;
              this.blit(x, hs, hx, hy + 1, P.face < 0);
            }
'''+s[b:]
s=s.replace("            var P = this.p;\n            if (!(P.inv","            var P = this.p, inp0 = keys;\n            if (!(P.inv",1)
assert "inp0 = keys" in s
open('qp/q2a.html','w').write(s)
print("ok")
