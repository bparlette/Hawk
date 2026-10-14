s=open('q4b.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:60])
    s=s.replace(a,b)
# init
rep("this.parts = []; this.lockFx = null; this.shownGems = 0;","this.parts = []; this.lockFx = null; this.shownGems = 0; this.fl = 0; this.flCol = \"#fff\"; this.barFx = 0; this.shk = 0;")
# burst method + homing particles loop
rep("          rand: function () {","""          burst: function (x, y, n, cols, spd, life, grav) {
            for (var k = 0; k < n; k++) { var an = Math.random() * 6.283, sp = spd * (0.35 + Math.random() * 0.65);
              this.parts.push({ x: x, y: y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - spd * 0.3, t: (life * (0.6 + Math.random() * 0.4)) | 0, col: cols[k % cols.length], g: grav }); }
          },
          rand: function () {""")
rep("q.x += q.vx; q.y += q.vy; q.vy += 0.08; q.vx *= 0.97; if (--q.t <= 0) this.parts.splice(i, 1); }",
"""if (q.tx !== undefined) { if (q.d > 0) { q.d--; q.y -= 0.6; continue; } q.x += (q.tx - q.x) * 0.16; q.y += (q.ty - q.y) * 0.16; if (Math.abs(q.tx - q.x) + Math.abs(q.ty - q.y) < 5) { this.barFx = 10; q.t = 0; } }
              else { q.x += q.vx; q.y += q.vy; q.vy += q.g === undefined ? 0.08 : q.g; q.vx *= 0.97; }
              if (--q.t <= 0) this.parts.splice(i, 1); }
            if (this.fl > 0) this.fl--; if (this.barFx > 0) this.barFx--;""")
# lock dust
rep("this.lockFx = { c: P.c, r: P.r, t: 10 };","""this.lockFx = { c: P.c, r: P.r, t: 10 };
            var lbx = this.OX + P.c * this.CS + 8, lby = this.OY + (P.r + 3) * this.CS - 1, lpc = this.PAL[P.g[2]];
            this.burst(lbx, lby, 8, ["#a89c88", "#6c6458", "#cfc6b0"], 1.0, 18, 0.03);
            this.burst(lbx, lby - 2, 4, [lpc[1], "#fff"], 1.3, 16, 0.07);
            this.shk = Math.max(this.shk, 2);""")
# game over
rep("if (P.r + k < 0) { this.over = 1; SFX.hit(); return; }","""if (P.r + k < 0) { this.over = 1; SFX.hit(); this.burst(this.OX + this.COLS * this.CS / 2, this.OY + 8, 36, ["#ff6060", "#fff", "#ffb040", "#ff8a8a"], 2.8, 44, 0.07); this.shk = 16; this.fl = 12; this.flCol = "#ff3030"; return; }""")
# resolve extras
rep("""            // chime climbs four semitones per chain step""","""            for (k = 0; k < Math.min(this.pendingN, 12); k++) this.parts.push({ x: sx + (Math.random() - 0.5) * 24, y: sy + (Math.random() - 0.5) * 16, tx: 54, ty: this.OY + 25, d: k * 2, t: 60, col: k % 2 ? "#9cf0a8" : "#fff", vx: 0, vy: 0 });
            if (mult > 1) this.burst(this.OX + this.COLS * CS / 2, sy, 8 * mult, ["#fff", "#ffe14d", "#ff8a8a"], 2.0 + mult * 0.4, 36, 0.05);
            if (mult > 2) { this.fl = 6 + mult; this.flCol = "#ffffff"; }
            if (this.pendingN >= 6) this.pops.push({ s: "GREAT!", x: sx, y: sy + 10, t: 50, col: "#9cf0a8" });
            // chime climbs four semitones per chain step""")
rep("if (this.cleared >= 45) { this.won = 1; SFX.win(); return; }","if (this.cleared >= 45) { this.won = 1; SFX.win(); this.fl = 14; this.flCol = \"#ffe14d\"; this.burst(this.OX + this.COLS * CS / 2, this.OY + 100, 50, [\"#ffe14d\", \"#fff\", \"#ff8a8a\", \"#9cf0a8\", \"#9cc0ff\"], 3.2, 50, 0.05); return; }")
# win confetti / over smoke in update
rep("            if (this.won > 0) { if (++this.won > 120) this.api.win(this.score); return; }","""            if (this.won > 0) {
              if (this.won % 2 === 0) { var cq = this.PAL[Math.random() * 6 | 0]; this.burst(this.OX + Math.random() * this.COLS * this.CS, this.OY - 6, 3, [cq[1], "#fff", cq[0]], 1.3, 70, 0.06); }
              if (++this.won > 120) this.api.win(this.score); return; }""")
rep("            if (this.over > 0) { if (++this.over > 90) this.api.lose(); return; }","""            if (this.over > 0) {
              if (this.over % 3 === 0 && this.over < 66) { var oc = Math.random() * this.COLS | 0, orr = Math.random() * this.ROWS | 0; if (this.grid[orr][oc] >= 0) this.burst(this.OX + oc * this.CS + 8, this.OY + orr * this.CS + 8, 5, [this.PAL[this.grid[orr][oc]][1], "#fff", "#555"], 1.4, 24, 0.08); }
              if (++this.over > 90) this.api.lose(); return; }""")
# draw: bar pulse, overlay
rep("            if (bw > 2 && this.timer % 50 < 25) {","            if (this.barFx > 0) { x.fillStyle = \"rgba(255,255,255,\" + (this.barFx / 10 * 0.55).toFixed(2) + \")\"; x.fillRect(13, OY + 22, 82, 7); }\n            if (bw > 2 && this.timer % 50 < 25) {")
rep("            if (this.over) text(\"OVERFLOW\", OX + WW / 2, OY + WH / 2, 1, \"#ff8a8a\", true);","""            if (this.over) text("OVERFLOW", OX + WW / 2, OY + WH / 2, 1, "#ff8a8a", true);
            if (this.fl > 0) { x.globalAlpha = Math.min(0.5, this.fl / 14 * 0.5); x.fillStyle = this.flCol; x.fillRect(-4, -4, W + 8, H + 8); x.globalAlpha = 1; }""")
open('q4c.html','w').write(s)
