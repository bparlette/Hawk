import json,re
S=json.load(open('qp/g7spr.json'))
s=open('/workspace/built/sites/97224b14-0322-4194-8bf0-898a8393139b/index.html').read()
kit=open('qp/q6e.html').read()
ka=kit.index("          /* ---- pixel-map sprite kit")
kt=kit[ka:]
i=kt.index("          blit: function"); j=kt.index("\n          },", i)+len("\n          },")
KIT=kt[:j]+"\n"
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:70]); s=s.replace(a,b)
def cut(a,b,new):
    global s
    assert s.count(a)==1 and s.count(b)==1; i=s.index(a); j=s.index(b); assert i<j; s=s[:i]+new+s[j:]
J=lambda r: json.dumps(r)
PALJ=json.dumps({'b':'#8a5226','l':'#d9b27a','g':'#1a8a44','w':'#ffffff','o':'#ff9a1e','O':'#c56a08','d':'#3a200c','f':'#6e421c','F':'#be8c50','k':'#0a0a0a','W':'#fafafa','r':'#c81414','t':'#e0a05c','e':'#6a3c14','p':'#e8506a','R':'#a01830','B':'#b8742c'})
build='''          buildSprites: function () {
            var mk = this.mk.bind(this), PAL = PALJ, WP = {}, key, Q = { duck: {}, duckW: {}, dog: {}, dogW: {} };
            for (key in PAL) WP[key] = "#ffffff";
            var D = DJ, G = GJ, H = HJ;
            for (key in D) { Q.duck[key] = mk(D[key], PAL); Q.duckW[key] = mk(D[key], WP, "#ffffff", true); }
            for (key in G) Q.dog[key] = mk(G[key], PAL);
            Q.hang = mk(H, PAL);
            return Q;
          },
'''.replace('PALJ',PALJ).replace('DJ',J(S['duck'])).replace('GJ',J(S['dog'])).replace('HJ',J(S['hang']))
newdraw='''          duck: function (x, d) {
            if (!this.SX) this.SX = this.buildSprites();
            var Q = this.SX, px = Math.round(d.x), py = Math.round(d.y), f = d.vx >= 0 ? 1 : -1, wf = d.dead ? 3 : [0, 1, 2, 1][Math.floor(d.life / 4) % 4];
            var key = d.dead ? "dead" : ["up", "mid", "down"][wf], set = d.hf > 0 ? Q.duckW : Q.duck;
            x.save(); x.translate(px, py); if (d.dead) x.rotate(Math.sin(d.spin) * 0.5); x.scale(f, 1);
            this.blit(x, set[key], 0, 14, false);
            x.restore();
          },
          dogDraw: function (x) {
            var D = this.dog; if (this.state !== "dog") return;
            if (!this.SX) this.SX = this.buildSprites();
            var Q = this.SX, rise = Math.min(1, (80 - D.t) / 14, D.t / 14), dy = 206 - Math.round(rise * 56), dx = Math.round(D.x), bob = Math.round(Math.sin(this.timer * 0.5));
            x.fillStyle = "#140a12"; x.fillRect(dx - 16, dy + 28, 32, 44); x.fillStyle = "#b8742c"; x.fillRect(dx - 15, dy + 28, 30, 44); x.fillStyle = "#e0a05c"; x.fillRect(dx - 15, dy + 28, 30, 3);
            if (D.k === "miss") { this.blit(x, Q.dog[Math.floor(this.timer / 5) % 2 ? "laugh1" : "laugh0"], dx + (this.timer % 6 < 3 ? -1 : 1), dy + 34 + bob, false); }
            else { this.blit(x, Q.dog.hit, dx, dy + 34, false); this.blit(x, Q.hang, dx, dy + 6 + bob, false); }
          },
'''
cut("          duck: function (x, d) {","          draw: function (x) {",build+KIT+newdraw)
rep("d.dead = 1; d.fall = 0; this.hits++;","d.dead = 1; d.fall = 0; d.hf = 6; this.hits++;")
rep("d.fall += 0.26; d.y += d.fall;","if (d.hf > 0) d.hf--; d.fall += 0.26; d.y += d.fall;")
open('qp/q7a.html','w').write(s); print('ok',len(s))
