s=open('m1.html').read()
kit=open('qp/kit.js').read(); spr=open('qp/g1spr.js').read()
anchor='          pop: function (s, x, y) { this.pops.push({ s: s, x: x, y: y, t: 45 }); },\n'
assert s.count(anchor)==1
s=s.replace(anchor, anchor+kit+spr)
def cut(a,b,new):
    global s
    i=s.index(a); j=s.index(b,i); s=s[:i]+new+s[j:]
s=s.replace("            var G = this.G, i, c;\n","            var G = this.G, i, c;\n            if (!this.S) this.S = this.buildSprites();\n            var S = this.S;\n",1)
cut("            // ape (top-left)","            // rescuee (top platform)",'''            // ape (top-left): pixel-map body with calm/roar faces, posed arms, fists and legs
            var apeY = this.gy(G[4], 34) - 30, aw = this.timer % 60 < 30 ? 0 : 1;
            var roarF = this.tossT > 0 || (this.throwT < 48 && !this.won);
            this.blit(x, S.leg, 22, apeY + 30); this.blit(x, S.leg, 36, apeY + 30, true);
            if (this.tossT > 0) {            // throw: left arm down, right arm swung out
              this.blit(x, S.armD, 11.5, apeY + 18); this.blit(x, S.armH, 50, apeY + 8);
            } else if (this.throwT <= 12 && !this.won) { // barrel held overhead
              this.blit(x, S.armU, 15, apeY + 6); this.blit(x, S.armU, 43, apeY + 6, true);
            } else if (!(this.throwT < 48 && !this.won)) {
              this.blit(x, S.armD, 11.5 + aw * 2, apeY + 18); this.blit(x, S.armD, 47.5 - aw * 2, apeY + 18, true);
            }
            this.blit(x, S.ape[roarF ? 1 : 0], 29, apeY + 23);
            if (this.throwT <= 12 && !this.won && this.tossT <= 0) this.blit(x, S.barrelEnd[0], 29, apeY - 2);
            else if (this.throwT < 48 && !this.won && this.tossT <= 0) { // chest-pound
              var pd = Math.floor(this.throwT / 5) % 2;
              this.blit(x, S.fist, pd ? 24 : 14, apeY + 18); this.blit(x, S.fist, pd ? 44 : 34, apeY + 18, true);
              x.fillStyle = "#fff"; if (pd) { x.fillRect(8, apeY + 4, 2, 2); x.fillRect(48, apeY + 4, 2, 2); }
            }
''')
cut("            // rescuee (top platform)","            if (this.won) {",'''            // rescuee (top platform)
            var ry = this.gy(G[5], 160) - 18;
            this.blit(x, S.lady[(this.won ? this.won % 16 < 8 : this.timer % 50 < 25) ? 1 : 0], 160, ry + 19);
''')
cut("            // hammer\n","            // barrels\n",'''            // hammer
            if (!this.hammer.taken) {
              var hb = Math.sin(this.timer / 8) * 1.5;
              this.blit(x, S.hammer, this.hammer.x, this.hammer.y + 10 + hb);
            }
''')
cut("            // barrels\n","            // hero\n",'''            // barrels
            for (i = 0; i < this.barrels.length; i++) {
              var B = this.barrels[i];
              var bx = Math.round(B.x), by = Math.round(B.y);
              if (B.onLadder !== null) this.blit(x, S.barrelEnd[Math.floor(B.spin) % 2], bx, by + 1);
              else this.blit(x, S.barrel[((Math.floor(B.spin) % 4) + 4) % 4], bx, by + 1);
            }
''')
cut("            // hero\n","            if (this.flash > 0)",'''            // hero: idle / 4-frame run / jump / 2-frame climb / hurt spin, all pixel maps
            var P = this.p;
            var px = Math.round(P.x), py = Math.round(P.y), f = P.face;
            if (!P.dead && P.climb === null) { x.fillStyle = "rgba(0,0,0,0.45)"; x.fillRect(px - 5, py, 10, 2); }
            if (P.dead > 0) {
              var spinT = 90 - P.dead, ang = spinT < 48 ? Math.floor(spinT / (3 + spinT / 12)) * Math.PI / 2 : Math.PI / 2;
              x.save(); x.translate(px, py - 8); x.rotate(ang);
              if (!(spinT >= 48 && this.timer % 6 < 2)) this.blit(x, S.hurt, 0, 9, f < 0);
              x.restore();
              if (spinT >= 48 && this.timer % 20 < 10) text("+", px - 9, py - 22, 1, "#ffe14d");
            } else if (P.climb !== null) {
              this.blit(x, S.climb, px, py + 1, Math.floor(P.cl / 7) % 2 === 1);
            } else {
              var moving = !P.jumping && (keys.left || keys.right);
              var hs = P.jumping ? S.jump : moving ? S.run[Math.floor(P.walk / 5) % 4] : S.idle;
              this.blit(x, hs, px, py + 1, f < 0);
              if (this.hamT > 0 && !(this.hamT < 120 && this.timer % 10 < 5)) {
                // hammer swing: raised overhead, then slammed forward; turns red in its last 2 s
                var HS = this.hamT < 120 ? S.hammerHot : S.hammer;
                if (Math.floor(this.timer / 8) % 2) this.blit(x, HS, px + f * 3, py - 17);
                else { x.save(); x.translate(px + f * 10, py - 10); x.rotate(f * Math.PI / 2); this.blit(x, HS, 0, 7); x.restore(); }
              }
            }
''')
open('qp/q1a.html','w').write(s)
print("ok")
