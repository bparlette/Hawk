import math
s=open('m6.html').read()
k=open('qp/q4e.html').read()
kit=k[k.index("          /* ---- pixel-map sprite kit"):k.index("          buildSprites: function")]
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80]); s=s.replace(a,b)
def full(half): return [h+h[::-1] for h in half]
# ---- player car (rear view, 28 wide)
P=["..........BBBB","........BBBBBB",".......BGGGYYY",".......BGGYYYY","......BBGGGkkk","....BBBBBBBBBB","...BBBBBBBBBBB","..BBBBBBBBBWWW","TTBRRRRBBBBBWW","TTBRRRRBBBBBWW","TTBBBBBBBBBBBB","TTTbbbbbbbbbpp","TTT.kkkkkkEEkk","TT..........kk"]
PF=full(P)
def shift(rows,d,rng):
    out=[]
    for i,r in enumerate(rows):
        if i in rng:
            r = (r[1:]+'.') if d<0 else ('.'+r[:-1])
        out.append(r)
    return out
PL=shift(PF,-1,range(0,5)); PR=shift(PF,1,range(0,5))
# ---- traffic car (22 wide), 2 frames
E=[".......BBBB","......BBBBB","......BGGGG",".....BBGGGG","....BBBBBBB","...BBBBBBBB","..BBRRBBBBB","..BBRRBBBpp","TTBBBBBBBBB","TTBbbbbbbbb","TTT.kkkkkkk"]
EF=full(E)
EF2=[r.replace('T','t') if i in (8,9,10) else r for i,r in enumerate(EF)]
EF2=[r.replace('R','L') if i in (6,7) else r for i,r in enumerate(EF2)]
# ---- palm (2 frames)
def palm(droop,sway):
    W,H=30,46
    g=[['.']*W for _ in range(H)]
    def put(x,y,c):
        x=int(round(x)); y=int(round(y))
        if 0<=x<W and 0<=y<H: g[y][x]=c
    top=14
    for y in range(H-1,top-1,-1):
        x=14+3*math.sin((H-1-y)/32*1.2)+sway*(H-1-y)/32
        c='K' if (y//3)%2 else 'T'
        put(x,y,c); put(x+1,y,c); 
        if y>H-8: put(x-1,y,c); put(x+2,y,c)
    tx=14+3*math.sin((H-1-top)/32*1.2)+sway+0.5; ty=top
    for i in range(8):
        a=math.radians(-170+i*(160/7)); L=13
        for st in range(0,41):
            f=st/40
            px=tx+math.cos(a)*L*f; py=ty+math.sin(a)*L*f*0.55+droop*f*f*L*0.9
            c='G' if i%2==0 else 'H'
            put(px,py,c)
            if st%2==0: put(px,py+1,'g')
    put(tx-1,ty+2,'C'); put(tx+1,ty+2,'C'); put(tx,ty+3,'C')
    return [''.join(r) for r in g]
PM1=palm(0.7,0); PM2=palm(1.0,1.2)
SG=["WWWWWWWWWWWWWW","WUUUUUUUUUUUUW","WUUUUUUYUUUUUW","WUUUUUUYYUUUUW","WUUYYYYYYYUUUW","WUUYYYYYYYYUUW","WUUYYYYYYYUUUW","WUUUUUUYYUUUUW","WUUUUUUYUUUUUW","WUUUUUUUUUUUUW","WWWWWWWWWWWWWW"]+["......PP......"]*9
import json
J=lambda r: json.dumps(r)
spr='''          buildSprites: function () {
            var mk = this.mk.bind(this), Q = { car: {}, en: {}, enW: {}, palm: [], sign: null }, key;
            var PC = { B: "#d61f1f", b: "#7a0d0d", G: "#9fd4ff", Y: "#ffe66d", k: "#1a1a22", T: "#15151c", R: "#8a1010", W: "#f4f4f4", p: "#f4f4f4", E: "#8a8a98" };
            var PCB = {}; for (key in PC) PCB[key] = PC[key]; PCB.R = "#ff4030";
            Q.car.s = mk(%s, PC); Q.car.l = mk(%s, PC); Q.car.r = mk(%s, PC);
            Q.car.sb = mk(%s, PCB); Q.car.lb = mk(%s, PCB); Q.car.rb = mk(%s, PCB);
            var cols = { "#2f6fe0": "#2f6fe0", "#f4c20d": "#f4c20d", "#f2f2f2": "#e8e8f0" };
            var EW = { B: "#fff", b: "#fff", G: "#fff", T: "#fff", t: "#fff", R: "#fff", L: "#fff", k: "#fff", p: "#fff" };
            for (key in cols) {
              var EP = { B: cols[key], b: "#2a2a3a", G: "#223344", T: "#15151c", t: "#4a4a58", R: "#c11", L: "#ff6a5a", k: "#1a1a22", p: "#f4f4f4" };
              Q.en[key] = [mk(%s, EP), mk(%s, EP)];
            }
            Q.enW = [mk(%s, EW, "#fff", true), mk(%s, EW, "#fff", true)];
            var PP = { K: "#6b4a2a", T: "#9a6a38", G: "#2fbf4a", H: "#1f9d3a", g: "#136b26", C: "#e0b040" };
            Q.palm = [mk(%s, PP), mk(%s, PP)];
            Q.sign = mk(%s, { W: "#f4f4f4", U: "#1e5aa8", Y: "#ffe66d", P: "#7a7a88" });
            return Q;
          },
          /* scaled sprite draw: bottom-centre at (x,y), size w x h (cv missing only in headless sims) */
          spr: function (ctx, sp, x, y, w, h, flip) {
            if (w < 1 || h < 1) return;
            if (sp.cv) { var x0 = Math.round(x - w / 2), y0 = Math.round(y - h);
              if (flip) { ctx.save(); ctx.translate(x0 + w, y0); ctx.scale(-1, 1); ctx.drawImage(sp.cv, 0, 0, w, h); ctx.restore(); } else ctx.drawImage(sp.cv, x0, y0, w, h);
            } else { ctx.fillStyle = "#888"; ctx.fillRect(x - w / 2, y - h, w, h); }
          },
''' % tuple(J(r) for r in (PF,PL,PR,PF,PL,PR,EF,EF2,EF,EF2,PM1,PM2,SG))
rep("  api: null,\n","  api: null,\n"+kit+spr)
# NOTE: kit/spr include their own trailing commas
# ---- traffic cars
a=s.index("    function drawCar(c, x, y, k) {"); b=s.index("    function drawSpr(o, a, k) {")
s=s[:a]+'''    function drawCar(c, x, y, k) {
      var w = 380 * k, h = 200 * k; if (w < 1) return;
      if (!S.SQ) S.SQ = S.buildSprites();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - w * 0.55, y - h * 0.05, w * 1.1, h * 0.1);
      var fr = Math.floor(S.t * 8 + c.z / S.SEG) %% 2, sp = S.SQ.en[c.col][fr];
      S.spr(ctx, sp, x, y, w, w * sp.h / sp.w);
    }
''' % () if False else s[:a]+'''    function drawCar(c, x, y, k) {
      var w = 380 * k, h = 200 * k; if (w < 1) return;
      if (!S.SQ) S.SQ = S.buildSprites();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - w * 0.55, y - h * 0.05, w * 1.1, h * 0.1);
      var fr = Math.floor(S.t * 8 + c.z / S.SEG) % 2, sp = S.SQ.en[c.col][fr];
      S.spr(ctx, sp, x, y, w, w * sp.h / sp.w);
    }
'''+s[b:]
# ---- palm and sign
a=s.index("      if (o.k === 'palm') {"); b=s.index("      } else {\n        var gw = a.w * 1.2")
s=s[:a]+'''      if (!S.SQ) S.SQ = S.buildSprites();
      if (o.k === 'palm') {
        var ph = 1900 * k, psp = S.SQ.palm[(Math.floor(S.t * 2) + (o.off > 0 ? 1 : 0)) % 2];
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - ph * 0.12, y - ph * 0.01, ph * 0.28, ph * 0.02);
        S.spr(ctx, psp, x, y, ph * psp.w / psp.h, ph, false);
      } else if (o.k === 'sign') {
        var sh = 1150 * k, ssp = S.SQ.sign;
        S.spr(ctx, ssp, x, y, sh * ssp.w / ssp.h, sh, o.off > 0);
'''+s[b:]
# ---- player car
a=s.index("    var hw = cw / 2, hh = ch / 2;"); b=s.index("    ctx.restore();\n    for (var fc = 0;")
s=s[:a]+'''    if (!S.SQ) S.SQ = S.buildSprites();
    var psp = S.SQ.car[(S.tilt < -0.35 ? 'l' : S.tilt > 0.35 ? 'r' : 's') + (S.brake ? 'b' : '')], pw = 60, ph2 = pw * psp.h / psp.w;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-pw * 0.5, ph2 * 0.2, pw, 4);
    S.spr(ctx, psp, 0, ph2 * 0.3, pw, ph2, false);
'''+s[b:]
open('qp/q6a.html','w').write(s); print('ok')
