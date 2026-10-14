import json
s=open('m4.html').read() if False else open('../m4.html').read()
kit=open('kit.js').read().replace('mk: function (rows, pal, ol) {','mk: function (rows, pal, ol, flat) {').replace('var col = pal[ch] || "#f0f", flat = "kWw".indexOf(ch) >= 0;\n              if (!flat) {','var col = pal[ch] || "#f0f", fl = flat || "kWw".indexOf(ch) >= 0;\n              if (!fl) {')
assert 'fl = flat' in kit
G=json.load(open('gems4.json'))
gems=",\n              ".join(json.dumps(r) for r in G)
spr='''          buildSprites: function () {
            var mk = this.mk.bind(this), S = { gem: [], white: [] }, i;
            var SH = [
              %s
            ];
            for (i = 0; i < 6; i++) {
              var p = this.PAL[i];
              S.gem.push(mk(SH[i], { B: p[0], L: p[1], d: p[2], W: "#ffffff" }, p[2] === "x" ? "" : "#140a12", true));
              S.white.push(mk(SH[i], { B: "#fff", L: "#fff", d: "#fff", W: "#fff" }, "#fff", true));
            }
            var MP = { O: "#f0a020", Y: "#fff7a0", S: "#ffcf99", k: "#140a12", r: "#d03040", B: "#3070f0", K: "#5a3a1a", c: "#8ad8ff" };
            var head = ["...OOOOO....", "..OOOOOOO...", ".OOOOYYOOO..", ".OOOOYYOOO.."];
            var eyes = ["..SkSSSkS...", "..SSSSSSS..."], mouth = ["..SSSrSSS...", "..SSrrrSS...", "..SSkkkSS..."];
            var legs = ["..BBB.BBB...", "..KKK.KKK..."];
            var armsD = ["...BBBBB....", "..BBBBBBB...", ".SBBBBBBBS..", ".SBBBBBBBS.."];
            var armsU = ["S..BBBBB..S.", "SS.BBBBB.SS.", "..BBBBBBB...", "..BBBBBBB..."];
            var face = function (e, m) { return ["..SSSSSSS...", e, "..SSSSSSS...", m]; };
            S.m_idle = mk(head.concat(face(eyes[0], mouth[0]), armsD, legs), MP);
            S.m_blink = mk(head.concat(face(eyes[1], mouth[0]), armsD, legs), MP);
            S.m_cheer = mk(head.concat(face(eyes[0], mouth[1]), armsU, legs), MP);
            S.m_worry = mk(head.concat(face(eyes[0], mouth[2]), armsD, legs), MP);
            return S;
          },
''' % gems
# insert kit + buildSprites before gem method
a='          gem: function (x, px, py, v, s) {'
assert s.count(a)==1
i=s.index(a); j=s.index('          // highest occupied row index')
newgem='''          gem: function (x, px, py, v, s, white) {
            if (!this.SX) this.SX = this.buildSprites();
            this.blit(x, white ? this.SX.white[v] : this.SX.gem[v], px + 8, py + 16);
            if (white) return;
            // sparkle: a small star blinks on the facet now and then, staggered by position
            var gl = (this.timer + px * 3 + py * 5) %% 150;
            if (gl < 9) { var k = gl < 5 ? 1 : 0; x.fillStyle = "#fff"; x.fillRect(px + 4, py + 3, 1, 1);
              if (k) { x.fillRect(px + 3, py + 3, 1, 1); x.fillRect(px + 5, py + 3, 1, 1); x.fillRect(px + 4, py + 2, 1, 1); x.fillRect(px + 4, py + 4, 1, 1); } }
          },
''' % ()
newgem=newgem.replace('%%','%')
s=s[:i]+kit+spr+newgem+s[j:]
# white blink / shrink / lock flash use sprites
old='''                if (this.flash > 8) { if ((this.flash >> 2) % 2) { x.fillStyle = "#fff"; x.fillRect(OX + c * CS + 1, OY + r * CS + 1, CS - 2, CS - 2); } else this.gem(x, OX + c * CS, OY + r * CS, v, CS); }
                else { var sh = 8 - this.flash; x.fillStyle = "#fff"; x.fillRect(OX + c * CS + 1 + sh, OY + r * CS + 1 + sh, CS - 2 - sh * 2, CS - 2 - sh * 2); }'''
assert s.count(old)==1
new='''                if (this.flash > 8) { if ((this.flash >> 2) % 2) this.gem(x, OX + c * CS, OY + r * CS, v, CS, 1); else this.gem(x, OX + c * CS, OY + r * CS, v, CS); }
                else { var sh = 8 - this.flash, ws = this.SX.white[v]; if (ws.cv) { var sc = 1 - sh / 9; x.drawImage(ws.cv, OX + c * CS + 8 - ws.w * sc / 2, OY + r * CS + 8 - ws.h * sc / 2, ws.w * sc, ws.h * sc); } else { x.fillStyle = "#fff"; x.fillRect(OX + c * CS + 1 + sh, OY + r * CS + 1 + sh, CS - 2 - sh * 2, CS - 2 - sh * 2); } }'''
s=s.replace(old,new)
old='''              for (i = 0; i < 3; i++) if (L.r + i >= 0) x.fillRect(OX + L.c * CS + 1, OY + (L.r + i) * CS + 1, CS - 2, CS - 2); }'''
assert s.count(old)==1
s=s.replace(old,'''              x.globalAlpha = L.t / 10 * 0.85; for (i = 0; i < 3; i++) if (L.r + i >= 0) this.gem(x, OX + L.c * CS, OY + (L.r + i) * CS, this.grid[L.r + i][L.c], CS, 1); x.globalAlpha = 1; }''')
# mascot in left panel
old='''            if (this.chain > 1 && this.flash > 0) text("CHAIN X" + this.chain, 14, OY + 104, 1, "#ff8a8a");'''
assert s.count(old)==1
s=s.replace(old,old+'''
            // mascot: a little miner cheers on clears, sweats in danger, blinks
            var SM = this.SX, mo = this.flash > 0 && this.marks ? SM.m_cheer : this.danger && !this.over ? SM.m_worry : (this.timer %% 170 < 7 ? SM.m_blink : SM.m_idle);
            var mby = 222 - ((this.timer >> 4) %% 2) * (mo === SM.m_idle || mo === SM.m_blink ? 1 : 0) - (mo === SM.m_cheer ? Math.abs(Math.sin(this.timer * 0.3)) * 4 | 0 : 0);
            x.fillStyle = "#3a342c"; x.fillRect(30, 222, 50, 6); x.fillStyle = "#8a8070"; x.fillRect(30, 222, 50, 1); x.fillStyle = "#1a1612"; x.fillRect(30, 227, 50, 1);
            this.blit(x, mo, 55, mby);
            x.fillStyle = "rgba(255,247,160," + (0.10 + 0.05 * Math.sin(this.timer * 0.1)).toFixed(2) + ")"; x.beginPath(); x.arc(55, mby - 13, 10, 0, 6.3); x.fill();
            if (mo === SM.m_worry && this.timer %% 20 < 14) { x.fillStyle = "#8ad8ff"; x.fillRect(62, mby - 15 + (this.timer %% 20 >> 2), 1, 2); }'''.replace('%%','%'))
open('q4a.html','w').write(s)
print('ok',len(s))
