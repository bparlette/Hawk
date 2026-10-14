import re
s=open('../m5.html').read()
k=open('q4e.html').read()
kit=k[k.index("          /* ---- pixel-map sprite kit"):k.index("          buildSprites: function")]
def cut(a,b,new):
    global s
    assert s.count(a)==1,(s.count(a),a); i=s.index(a); j=s.index(b,i)
    s=s[:i]+new+s[j:]
spr='''          buildSprites: function () {
            var mk = this.mk.bind(this), S = { bal: {}, hero: {}, foe: {} }, i, key;
            var BS = ["..BBBBB..", ".BBWWBBB.", "BBWBBBBBB", "BBWBBBBBB", "BBBBBBBBB", "BBBBBBBBB", ".BBBBBBB.", "..BBBBB..", "...BBB...", "....d...."];
            var BL = ["...BBBBB...", "..BBWWBBBB.", ".BBWWBBBBBB", ".BBWBBBBBBB", "BBBWBBBBBBB", "BBBBBBBBBBB", "BBBBBBBBBBB", ".BBBBBBBBB.", ".BBBBBBBBB.", "..BBBBBBB..", "...BBBBB...", "....BBB....", ".....d....."];
            var cols = { "#ff4040": "#e8302f", "#ffd23a": "#f5c425", "#ff7ad9": "#ff6ad0" };
            for (key in cols) { S.bal[key] = { s: mk(BS, { B: cols[key], d: "#a0a0b8", W: "#fff" }), l: mk(BL, { B: cols[key], d: "#a0a0b8", W: "#fff" }) }; }
            var HP = { r: "#e03a2f", S: "#ffcc99", k: "#140a12", B: "#3a6cff", K: "#6b3a1e", X: "#140a12", m: "#c0392b" };
            var head = ["..rrrrr...", ".rrrrrrrr.", "..SSSSSS..", "..SSSkSS..", "..SSSSSS..", "...SSSS..."];
            var headH = ["..rrrrr...", ".rrrrrrrr.", "..SSSSSS..", "..SXSSXS..", "..SSmmSS..", "...SSSS..."];
            var armsDn = ["..BBBBBB..", ".SBBBBBBS.", ".SBBBBBBS.", "..BBBBBB.."];
            var armsMid = ["..BBBBBB..", "SSBBBBBBSS", "..BBBBBB..", "..BBBBBB.."];
            var armsUp = ["S.BBBBBB.S", "SSBBBBBBSS", "..BBBBBB..", "..BBBBBB.."];
            var legs = { st: ["..KK..KK..", "..KK..KK.."], a: ["..KK...KK.", ".KK....KK."], b: ["...KKKK...", "...KKKK..."], c: ["..KK...KK.", "..KK...KK."], air: ["...KKKK...", "...K..K..."] };
            var H = { idle: head.concat(armsDn, legs.st), run0: head.concat(armsDn, legs.a), run1: head.concat(armsDn, legs.b), run2: head.concat(armsDn, legs.c), run3: head.concat(armsDn, legs.b),
              up: head.concat(armsUp, legs.air), mid: head.concat(armsMid, legs.air), glide: head.concat(armsDn, legs.air), hurt: headH.concat(armsUp, legs.air) };
            var WH = { r: "#fff", S: "#fff", k: "#fff", B: "#fff", K: "#fff", X: "#fff", m: "#fff" };
            for (key in H) { S.hero[key] = mk(H[key], HP); S.hero[key + "W"] = mk(H[key], WH, "#fff", true); }
            var FP = { G: "#7ad04a", g: "#3f8a2a", W: "#ffffff", k: "#140a12", y: "#ffd23a", o: "#ffa030" };
            var fhead = ["...GGGG...", "..GGGGGG..", "..GWkGGGyy", "..GGGGGGy.", "...GGGGG.."];
            var fUp = ["G.GGGGGG.G", "GGGGGGGGGG", "..GGGGGG..", "..gggggg.."], fMid = ["..GGGGGG..", "GGGGGGGGGG", "..GGGGGG..", "..gggggg.."], fDn = ["..GGGGGG..", ".GGGGGGGG.", "G.GGGGGG.G", "..gggggg.."];
            var ffeet = ["..oo..oo..", "..oo..oo.."];
            var F = { up: fhead.concat(fUp, ffeet), mid: fhead.concat(fMid, ffeet), dn: fhead.concat(fDn, ffeet) };
            var WF = { G: "#fff", g: "#fff", W: "#fff", k: "#fff", y: "#fff", o: "#fff" };
            for (key in F) { S.foe[key] = mk(F[key], FP); S.foe[key + "W"] = mk(F[key], WF, "#fff", true); }
            S.canopy = mk(["...WWWWWWWW...", "..WWPPWWPPWW..", ".WWWPPWWPPWWW.", "WWWWPPWWPPWWWW", "WW.WP.WW.PW.WW"], { W: "#f0f0f0", P: "#ff7ad9" });
            return S;
          },
'''
# insert kit+buildSprites before ball
cut("          ball: function (x, cx, cy, col, r) {","          // a balloon on a wavy string", kit+spr+'''          ball: function (x, cx, cy, col, r) {
            if (!this.SB) this.SB = this.buildSprites();
            var bs = this.SB.bal[col];
            if (bs && r >= 4) { var sp = r >= 5 ? bs.l : bs.s; this.blit(x, sp, cx, cy - r - 1 + sp.h, false); return; }
            x.fillStyle = col; x.fillRect(cx - r + 1, cy - r, 2 * r - 2, 2 * r); x.fillRect(cx - r, cy - r + 1, 2 * r, 2 * r - 2);
            x.fillRect(cx - 1, cy + r, 2, 1); if (r > 2) { x.fillStyle = "#fff"; x.fillRect(cx - r + 2, cy - r + 2, 2, 2); }
          },
''')
# hero
cut("          hero: function (x, px, y, P) {","          foe: function (x, ex, y, e) {",'''          hero: function (x, px, y, P) {
            if (!this.SB) this.SB = this.buildSprites();
            var b = Math.round(y), t = this.timer, lag = Math.round(-P.vx * 1.5), H = this.SB.hero;
            if (P.bal >= 1) this.balloon(x, px - 3, b - 12, px - 4 + lag + Math.round(Math.sin(t * 0.09) * 1.2), b - 20 + Math.round(Math.sin(t * 0.13) * 0.8 + P.vy * 0.4), "#ff4040", 4);
            if (P.bal >= 2) this.balloon(x, px + 3, b - 12, px + 4 + lag + Math.round(Math.sin(t * 0.09 + 2) * 1.2), b - 20 + Math.round(Math.sin(t * 0.13 + 1) * 0.8 + P.vy * 0.4), "#ffd23a", 4);
            var f = P.dead > 0 || P.inv > 45 ? H.hurt : P.ground ? (Math.abs(P.vx) > 0.1 ? H["run" + ((t >> 3) & 3)] : H.idle) : P.fa > 4 ? H.up : P.fa > 0 ? H.mid : H.glide;
            this.blit(x, f, px, b + 1, P.face < 0);
          },
''')
# foe
cut("          foe: function (x, ex, y, e) {","          wrap: function",'''          foe: function (x, ex, y, e) {
            if (!this.SB) this.SB = this.buildSprites();
            var b = Math.round(y), t = this.timer, FS = this.SB.foe, fr = null;
            if (e.st === "fly") { this.balloon(x, ex, b - 12, ex + Math.round(Math.sin(t * 0.08 + e.seed) * 1.5 - e.vx), b - 21 + Math.round(Math.sin(t * 0.11 + e.seed) * 0.8 + e.vy * 0.5), "#ff7ad9", 5);
              fr = e.fa > 3 ? FS.up : e.fa > 0 ? FS.mid : FS.dn; }
            else if (e.st === "chute") {
              // canopy swings opposite the body's drift, two shroud lines
              var sw = Math.round(Math.sin(t * 0.05 + e.seed) * 3), cxp = ex - sw;
              this.blit(x, this.SB.canopy, cxp, b - 19, false);
              x.fillStyle = "#999"; for (var j = 0; j < 9; j++) { var f = j / 8; x.fillRect(Math.round(cxp - 6 + (ex - 3 - cxp + 6) * f), b - 21 + j, 1, 1); x.fillRect(Math.round(cxp + 5 + (ex + 2 - cxp - 5) * f), b - 21 + j, 1, 1); }
              fr = FS.up;
            } else {
              // pumping: handle strokes, balloon inflates and rises on its stem
              var pr = (240 - e.pump) / 240, r = Math.max(1, Math.round(pr * 5)), stroke = t % 16 < 8, ry = b - 4 - Math.round(pr * 14) - r;
              x.fillStyle = "#c8c8d8"; x.fillRect(ex + 7, ry + r + 1, 1, b - 3 - (ry + r + 1));
              this.ball(x, ex + 7 + Math.round(Math.sin(t * 0.3) * pr), ry, "#ff7ad9", r);
              x.fillStyle = "#888"; x.fillRect(ex + 4, b - 6, 3, 6); x.fillStyle = "#bbb"; x.fillRect(ex + 3, b - (stroke ? 10 : 7), 5, 1); x.fillRect(ex + 5, b - (stroke ? 10 : 7), 1, stroke ? 4 : 1);
              fr = stroke ? FS.mid : FS.dn;
            }
            this.blit(x, fr, ex, b + 1, e.vx < 0);
          },
''')
open('q5a.html','w').write(s)
