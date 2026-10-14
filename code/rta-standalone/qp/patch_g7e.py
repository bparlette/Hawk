s=open('qp/q7e0.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:70]); s=s.replace(a,b)
def cut(a,b,new):
    global s
    assert s.count(a)==1 and s.count(b)==1; i=s.index(a); j=s.index(b); assert i<j; s=s[:i]+new+s[j:]
# UI sprites appended to buildSprites
rep("            Q.hang = mk(H, PAL);\n            return Q;",'''            Q.hang = mk(H, PAL);
            var GP = {}, UP = { y: "#ffe14d", Y: "#c08a1a" };
            for (key in PAL) GP[key] = "#59596a";
            var DH = [".gggg..", "gggggg.", "ggkgggo", "ggggggo", ".wwww..", ".bbbb..", "bbbbbb."];
            var BU = [".rr.", "rrrr", "oooo", "oooo", "oooo", "OOOO"];
            Q.ui = { dh: mk(DH, PAL), dhg: mk(DH, GP), dhe: mk(DH, GP, "#59596a", true), bu: mk(BU, PAL), bue: mk(BU, GP),
              star: mk(["...y...", "..yyy..", "yyyyyyy", ".yyyyy.", ".yy.yy."], UP) };
            return Q;''')
# stats
rep("this.rec = 0; this.hs = 0; this.streak = 0;","this.rec = 0; this.hs = 0; this.streak = 0; this.st = { shots: 0, best: 0 }; this.tally = null;")
rep("this.rec = 7; SFX.shot();","this.rec = 7; this.st.shots++; SFX.shot();")
rep("this.streak++; if (this.streak >= 2) SFX.streak();","this.streak++; if (this.streak > this.st.best) this.st.best = this.streak; if (this.streak >= 2) SFX.streak();")
rep("if (this.hits >= 7) { this.won = 1;","if (this.hits >= 7) { this.tally = [[\"DUCKS HIT\", this.hits], [\"SHOTS FIRED\", this.st.shots], [\"ACCURACY\", Math.round(this.hits / Math.max(1, this.st.shots) * 100) + \" PCT\"], [\"BEST STREAK\", this.st.best]]; this.won = 1;")
# HUD
cut("            // HUD","            // crosshair\n            var cx = Math.round",'''            // HUD
            if (!this.SX) this.SX = this.buildSprites();
            var U = this.SX.ui, bl = Math.floor(t / 10) % 2;
            x.fillStyle = "rgba(6,14,34,0.72)"; x.fillRect(0, 0, 320, 20); x.fillStyle = "#2a3a7a"; x.fillRect(0, 20, 320, 1);
            this.blit(x, U.star, 10, 16, false);
            var sc = String(this.score); text(sc, 21, 7, 1, "#000"); text(sc, 20, 6, 1, "#ffe14d");
            x.fillStyle = "#140a12"; x.fillRect(98, 3, 108, 15);
            for (i = 0; i < 10; i++) { var hv = this.hist[i], sp = hv === undefined ? (i === this.spawned - 1 && this.state === "fly" && bl ? U.dhe : U.dhg) : hv ? U.dh : U.dhg; if (hv === false) x.globalAlpha = 0.6; this.blit(x, sp, 106 + i * 10, 17, false); x.globalAlpha = 1; if (hv === false) { x.fillStyle = "#e33"; x.fillRect(102 + i * 10, 14, 8, 1); } }
            x.fillStyle = "#140a12"; x.fillRect(222, 3, 40, 15);
            for (i = 0; i < 3; i++) this.blit(x, i < this.ammo ? U.bu : U.bue, 232 + i * 11, 17, false);
            text("AMMO", 266, 7, 1, "#9fb4ff");
            x.fillStyle = "rgba(6,14,34,0.72)"; x.fillRect(0, 222, 320, 18); x.fillStyle = "#2a3a7a"; x.fillRect(0, 222, 320, 1);
            text("INFINITE LIVES", 6, 228, 1, "#bfe8bf");
            this.blit(x, U.dh, 244, 236, false);
            var hq = this.hits >= 7; text(this.hits + "/7", 254, 228, 1, hq ? "#7aff7a" : "#fff");
            if (this.streak >= 2) text("X" + this.streak, 288, 228, 1, t % 10 < 5 ? "#ff8ad0" : "#fff");
            // crosshair
            var cx = Math.round''')
# titleArt
rep("          goal: \"AIM WITH THE STICK.",'''          titleArt: function (x, t) {
            if (!this.SX) this.SX = this.buildSprites();
            var Q = this.SX, i, hz = 150, W = 320; x.save(); x.translate(0, -24); x.beginPath(); x.rect(0, 68, W, 126); x.clip();
            function big(sp, cx, by, w, flip) { if (!sp || !sp.cv) return; var h = Math.round(w * sp.h / sp.w), x0 = Math.round(cx - w / 2), y0 = Math.round(by - h); if (flip) { x.save(); x.translate(x0 + w, y0); x.scale(-1, 1); x.drawImage(sp.cv, 0, 0, w, h); x.restore(); } else x.drawImage(sp.cv, x0, y0, w, h); }
            var g = x.createLinearGradient(0, 44, 0, hz); g.addColorStop(0, "#3d9be8"); g.addColorStop(1, "#d8f4ff"); x.fillStyle = g; x.fillRect(0, 44, W, hz - 44);
            x.fillStyle = "rgba(255,248,192,0.2)"; x.beginPath(); x.arc(266, 78, 24 + Math.sin(t * 0.05) * 2, 0, 7); x.fill(); x.fillStyle = "#fff8c0"; x.fillRect(258, 70, 16, 16);
            for (i = 0; i < 3; i++) { var cx0 = ((i * 130 + t * (0.12 + i * 0.04)) % 400) - 40; x.fillStyle = "#fff"; x.fillRect(cx0, 56 + i * 16, 40, 7); x.fillRect(cx0 + 8, 51 + i * 16, 22, 6); }
            for (i = 0; i < 322; i += 2) { var mh = 22 + Math.round(16 * Math.abs(Math.sin(i / 47 + 1)) + 6 * Math.sin(i / 15)); x.fillStyle = "#86aed4"; x.fillRect(i, hz - 14 - mh, 2, mh + 14); if (mh > 38) { x.fillStyle = "#e8f4ff"; x.fillRect(i, hz - 14 - mh, 2, 3); } }
            for (i = 0; i < 322; i += 4) { var hh = 12 + Math.round(8 * Math.sin(i / 30) + 4 * Math.sin(i / 11)); x.fillStyle = "#4f9a5c"; x.fillRect(i, hz - hh, 4, hh + 4); }
            x.fillStyle = "#4a2a10"; x.fillRect(46, 96, 6, 54); x.fillStyle = "#15502a"; x.fillRect(26, 70, 46, 30); x.fillStyle = "#2a8a44"; x.fillRect(28, 72, 38, 22); x.fillStyle = "#58c46a"; x.fillRect(32, 74, 12, 4);
            var gg = x.createLinearGradient(0, hz, 0, hz + 50); gg.addColorStop(0, "#6ac04a"); gg.addColorStop(1, "#2a7a2a"); x.fillStyle = gg; x.fillRect(0, hz, W, 60); x.fillStyle = "#8ae060"; x.fillRect(0, hz, W, 2);
            // dog peeks out of the grass, laughing
            big(Q.dog[Math.floor(t / 8) % 2 ? "laugh1" : "laugh0"], 258, hz + 22 + Math.round(Math.sin(t * 0.2)), 50, false);
            // a big mallard crosses the sky with the crosshair tracking it
            var dx = ((t * 1.2) % 420) - 50, dyy = 104 + Math.round(Math.sin(t * 0.06) * 12), wi = ["up", "mid", "down", "mid"][Math.floor(t / 6) % 4];
            big(Q.duck[wi], dx, dyy + 16, 66, false);
            var kx = Math.round(dx + 4 + Math.sin(t * 0.1) * 5), ky = dyy + Math.round(Math.cos(t * 0.1) * 4);
            x.strokeStyle = "#101010"; x.lineWidth = 4; x.beginPath(); x.arc(kx, ky, 14, 0, 7); x.stroke(); x.strokeStyle = "#ff3030"; x.lineWidth = 2; x.beginPath(); x.arc(kx, ky, 14, 0, 7); x.stroke();
            x.fillStyle = "#ff3030"; x.fillRect(kx - 20, ky - 1, 10, 2); x.fillRect(kx + 10, ky - 1, 10, 2); x.fillRect(kx - 1, ky - 20, 2, 10); x.fillRect(kx - 1, ky + 10, 2, 10);
            // foreground blades
            for (i = 0; i < 330; i += 5) { var bh = 10 + (i * 7) % 9, sw = Math.round(Math.sin(t * 0.05 + i * 0.3) * 2); x.fillStyle = "#15502a"; x.fillRect(i - 1, hz + 30 - bh, 5, bh + 40); x.fillStyle = (i / 5) % 2 ? "#2a9a3a" : "#3ab54a"; x.fillRect(i + sw, hz + 29 - bh, 3, bh + 40); }
            x.restore();
          },
          goal: "AIM WITH THE STICK.''')
open('qp/q7e.html','w').write(s); print('ok')
