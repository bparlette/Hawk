s=open('qp/q7b.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:70]); s=s.replace(a,b)
# init
rep("this.dog = { t: 0, k: \"\", x: 160 }; this.cool = 0;","this.dog = { t: 0, k: \"\", x: 160 }; this.cool = 0; this.rec = 0; this.hs = 0; this.streak = 0;")
# burst + pop
rep("          endDuck: function (hit, x) {",'''          burst: function (x, y, n, cols, spd, life, grav) {
            for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = (0.4 + Math.random()) * spd; this.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.4, t: life * (0.6 + Math.random() * 0.4) | 0, c: cols[i % cols.length], g: grav, s: i % 4 ? 2 : 3 }); }
          },
          endDuck: function (hit, x) {''')
rep("x: Math.max(30, Math.min(290, x)) }; this.ducks = [];","x: Math.max(30, Math.min(290, x)) }; this.ducks = []; this.burst(this.dog.x, 198, 14, [\"#8ae060\", \"#2a9a3a\", \"#c8f0a0\"], 1.8, 22, 0.08); if (!hit) this.streak = 0;")
rep("pop: function (s, x, y) { this.pops.push({ s: s, x: x, y: y, t: 50 }); },","pop: function (s, x, y, c) { this.pops.push({ s: s, x: x, y: y, t: 50, c: c }); },")
# particles honor gravity, recoil, hitstop, confetti
rep("q.vy += 0.07;","q.vy += q.g === undefined ? 0.07 : q.g;")
rep("if (this.won > 0) { if (++this.won > 150)","if (this.rec > 0) this.rec--;\n            if (this.won > 0) { if (this.timer % 3 === 0) this.burst(Math.random() * 320, -4, 4, [\"#ff5a4a\", \"#ffe14d\", \"#4ad6ff\", \"#7aff7a\", \"#ff8ad0\", \"#fff\"], 1.2, 90, 0.06); if (++this.won > 150)")
rep("if (this.failT > 0) { if (--this.failT === 0) this.api.lose(); return; }","if (this.failT > 0) { if (--this.failT === 0) this.api.lose(); return; }\n            if (this.hs > 0) { this.hs--; return; }")
# fly away pop
rep("d.away = 1; d.vy = -3.2; d.vx *= 0.5; beep(300, 0.2, \"sawtooth\", 0.04);","d.away = 1; d.vy = -3.2; d.vx *= 0.5; beep(300, 0.2, \"sawtooth\", 0.04); this.pop(\"FLY AWAY\", Math.max(50, Math.min(270, d.x)), 90, \"#ff6a5a\"); this.shk = 2;")
# fire: recoil, miss puff
rep("this.ammo--; this.flash = 4; this.shk = 3;","this.ammo--; this.flash = 4; this.shk = 3; this.rec = 7; this.burst(this.cx, this.cy, 6, [\"#fff3b0\", \"#ffb04a\", \"#fff\"], 1.6, 10, 0.02);")
rep("this.score += pts; this.pop(\"+\" + pts, d.x, d.y - 14); this.feathers(d.x, d.y, 22); this.shk = 7; SFX.smash();",
    "this.score += pts; this.pop(\"+\" + pts, d.x, d.y - 14, \"#ffe14d\"); this.feathers(d.x, d.y, 22); this.burst(d.x, d.y, 16, [\"#ffe14d\", \"#fff\", \"#ff9a1e\"], 2.4, 24, 0.05); this.shk = 7 + (this.ammo === 2 ? 2 : 0); this.hs = 4; this.flash = 6; SFX.smash(); this.streak++; if (this.streak >= 2) this.pop(\"STREAK X\" + this.streak, d.x, d.y + 6, \"#ff8ad0\");")
# miss: find the end of hit if-block -> add else. anchor on hit block close
rep("this.streak++; if (this.streak >= 2) this.pop(\"STREAK X\" + this.streak, d.x, d.y + 6, \"#ff8ad0\");\n                }",
    "this.streak++; if (this.streak >= 2) this.pop(\"STREAK X\" + this.streak, d.x, d.y + 6, \"#ff8ad0\");\n                } else { this.pop(this.ammo > 0 ? \"MISS\" : \"LAST SHOT\", this.cx, this.cy - 16, \"#cfd8e8\"); }")
# falling trail + ground thud
rep("if (d.hf > 0) d.hf--; d.fall += 0.26;","if (d.hf > 0) d.hf--; if (this.timer % 3 === 0) this.feathers(d.x, d.y, 1); d.fall += 0.26;")
rep("if (d.y >= 196) { this.endDuck(true, d.x); SFX.pick(); }","if (d.y >= 196) { this.shk = 4; this.burst(d.x, 196, 12, [\"#8ae060\", \"#2a9a3a\", \"#c8f0a0\", \"#d9c08a\"], 1.7, 20, 0.08); this.endDuck(true, d.x); SFX.pick(); }")
# draw particles size, popups, crosshair
rep("x.fillStyle = q.c; x.fillRect(q.x | 0, q.y | 0, q.t > 10 ? 3 : 2, 2); }","x.fillStyle = q.c; var qs = q.s || (q.t > 10 ? 3 : 2); x.fillRect(q.x | 0, q.y | 0, qs, q.s ? qs : 2); }")
rep("text(po.s, Math.round(po.x), Math.round(po.y), 1, po.t % 8 < 4 ? \"#fff\" : \"#ffe14d\", true); }","text(po.s, Math.round(po.x), Math.round(po.y), 1, po.t % 8 < 4 ? \"#fff\" : (po.c || \"#ffe14d\"), true); }")
rep("x.beginPath(); x.arc(cx, cy, 11, 0, 7); x.stroke();\n            x.strokeStyle = this.flash ? \"#ffffff\" : \"#ff3030\"; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, 11, 0, 7); x.stroke();\n            x.fillStyle = x.strokeStyle; x.fillRect(cx - 16, cy - 1, 10, 2); x.fillRect(cx + 6, cy - 1, 10, 2); x.fillRect(cx - 1, cy - 16, 2, 10); x.fillRect(cx - 1, cy + 6, 2, 10);",
    "var cr = 11 + (this.rec > 0 ? this.rec : 0), cg = this.ammo === 0 && this.state === \"fly\", cc = this.flash ? \"#ffffff\" : cg ? (t % 12 < 6 ? \"#ff3030\" : \"#8a8a96\") : \"#ff3030\";\n            x.beginPath(); x.arc(cx, cy, cr, 0, 7); x.stroke();\n            x.strokeStyle = cc; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, cr, 0, 7); x.stroke();\n            x.fillStyle = cc; x.fillRect(cx - 5 - cr, cy - 1, 10, 2); x.fillRect(cx + cr - 5, cy - 1, 10, 2); x.fillRect(cx - 1, cy - 5 - cr, 2, 10); x.fillRect(cx - 1, cy + cr - 5, 2, 10); x.fillStyle = \"#101010\"; x.fillRect(cx - 1, cy - 1, 2, 2);")
open('qp/q7c.html','w').write(s); print('ok')
