import re
s=open('qp/q5b.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80])
    s=s.replace(a,b)

# --- burst with gravity / kinds, confetti, pops with colours
rep('''          pop: function (s, x, y) { this.pops.push({ s: s, x: x, y: y, t: 45 }); },
          burst: function (x, y, col) { for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2; this.fx.push({ k: "b", x: x, y: y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6, t: 16, c: col }); } },''',
'''          pop: function (s, x, y, col) { this.pops.push({ s: s, x: x, y: y, t: 50, c: col || "#fff" }); },
          // n particles in a ring; col string or array; grav>0 = lobbed upward then falls; k "d" = soft dust puff
          burst: function (x, y, col, n, spd, life, grav, k) {
            var cols = typeof col === "string" ? [col] : col; n = n || 10; spd = spd || 1.6; life = life || 16; grav = grav || 0;
            for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2 + Math.random() * 0.5, sp = spd * (0.5 + Math.random() * 0.7);
              this.fx.push({ k: k || "b", x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (grav ? 1.2 : 0), t: life, L: life, c: cols[i % cols.length], g: grav }); }
          },
          star: function (x, y) { this.fx.push({ k: "p", x: x, y: y, t: 7, L: 7 }); },
          confetti: function (n) { var cols = ["#ff4040", "#ffd23a", "#ff7ad9", "#7ad04a", "#8ac0ff"];
            for (var i = 0; i < n; i++) this.fx.push({ k: "c", x: Math.random() * 320, y: -4 - Math.random() * 20, vx: (Math.random() - 0.5) * 1.2, vy: 0.4 + Math.random() * 0.9, t: 80, L: 80, c: cols[i % 5], g: 0.008 }); },''')

# --- fx update
rep('''if (q.k === "b") { q.x += q.vx; q.y += q.vy; q.vx *= 0.9; q.vy *= 0.9; } if (--q.t <= 0) this.fx.splice(i, 1); }''',
'''if (q.k === "b" || q.k === "d") { q.x += q.vx; q.y += q.vy; var dr = q.g ? 0.97 : 0.9; q.vx *= dr; if (q.g) q.vy += 0.09; else q.vy *= dr; }
              else if (q.k === "c") { q.x += q.vx + Math.sin((q.t + i) * 0.2) * 0.3; q.y += q.vy; q.vy = Math.min(1.2, q.vy + q.g); }
              if (--q.t <= 0) this.fx.splice(i, 1); }
            if (this.hf > 0) this.hf--; if (this.flash > 0) this.flash--;
            for (i = 0; i < this.foes.length; i++) if (this.foes[i].hf > 0) this.foes[i].hf--;
            if (this.p.hf > 0) this.p.hf--;''')

# init extras
rep('this.fx = []; this.bolt = 0;','this.fx = []; this.bolt = 0; this.hs = 0; this.flash = 0;')

# splash bigger
rep('for (var i = 0; i < 8; i++) this.splash.push({ x: x, y: 214, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 1.5, t: 30 });',
    'for (var i = 0; i < 12; i++) this.splash.push({ x: x, y: 214, vx: (Math.random() - 0.5) * 2.4, vy: -1 - Math.random() * 1.9, t: 32 }); this.burst(x, 212, ["#bfe0ff", "#8ac0ff", "#fff"], 8, 1.4, 22, 1);')

# die
rep('die: function (water) { var P = this.p; P.dead = 90; this.shk = water ? 6 : 12;',
    'die: function (water) { var P = this.p; P.dead = 90; this.shk = water ? 8 : 14; this.flash = 4; P.hf = 40; if (!water) { this.burst(P.x, P.y - 14, ["#ff4040", "#ffd23a", "#fff", "#e03a2f"], 18, 2.2, 28, 1); this.star(P.x, P.y - 16); }')

# respawn
rep('if (--P.dead === 0) {   this.reset(); } return; }',
    'if (--P.dead === 0) { this.reset(); this.burst(this.p.x, this.p.y - 12, ["#fff", "#8ac0ff", "#ffd23a"], 14, 1.8, 22, 0); } return; }')

# hit stop + dust before hero input
rep('            if (P.dead > 0) { P.dvy','            if (this.hs > 0) { this.hs--; return; }\n            if (P.dead > 0) { P.dvy')

# flap puff
rep('P.fa = 8; beep(420, 0.04, "square", 0.03); }',
    'P.fa = 8; beep(420, 0.04, "square", 0.03); this.burst(P.x - P.face * 2, P.y - 2, "#cfd8f0", 3, 0.7, 12, 0, "d"); }')

# land + run dust around phys of hero
rep('            this.phys(P, P.bal === 2 ? 0.05 : 0.065, 2.2, 22);\n',
    '''            var wasG = P.ground, vyB = P.vy;
            this.phys(P, P.bal === 2 ? 0.05 : 0.065, 2.2, 22);
            if (P.ground && !wasG && vyB > 0.7) this.burst(P.x, P.y - 1, "#cfd8f0", 7, 0.9, 14, 0, "d");
            else if (P.ground && Math.abs(P.vx) > 0.5 && this.timer % 8 === 0) this.burst(P.x - P.face * 4, P.y - 1, "#cfd8f0", 2, 0.45, 11, 0, "d");
            if (P.bump) { this.burst(P.x, P.y - 24, "#c8955a", 5, 1, 12, 1); this.shk = Math.max(this.shk || 0, 2); }
''')

# chute lands
rep('if (e.ground) { e.st = "pump"; e.pump = 240; }',
    'if (e.ground) { e.st = "pump"; e.pump = 240; this.burst(e.x, e.y - 1, "#cfd8f0", 7, 0.9, 14, 0, "d"); }')
rep('this.score += 750; this.pop("+750", e.x, 200);','this.score += 750; this.pop("+750", e.x, 200, "#8ac0ff");')

# stomp / hurt / collect
rep('this.score += 500; this.pop("+500", e.x, e.y - 34); this.burst(e.x, e.y - 20, "#ff7ad9"); P.vy = -1.2; SFX.smash(); }',
    'this.score += 500; this.pop("+500", e.x, e.y - 34, "#ffe14d"); this.burst(e.x, e.y - 20, ["#ff7ad9", "#fff", "#ff9ae6"], 14, 2.0, 20, 0); this.star(e.x, e.y - 20); this.burst(e.x, e.y - 6, ["#7ad04a", "#fff"], 6, 1.4, 16, 1); e.hf = 16; this.hs = 3; this.shk = Math.max(this.shk || 0, 4); P.vy = -1.2; SFX.smash(); }')
rep('if (P.inv === 0) { this.burst(P.x + (P.bal === 2 ? 4 : -4), P.y - 20, P.bal === 2 ? "#ffd23a" : "#ff4040"); P.bal--;',
    'if (P.inv === 0) { this.burst(P.x + (P.bal === 2 ? 4 : -4), P.y - 20, P.bal === 2 ? ["#ffd23a", "#fff"] : ["#ff4040", "#fff"], 14, 2.0, 20, 0); this.star(P.x + (P.bal === 2 ? 4 : -4), P.y - 20); P.hf = 24; this.hs = 5; this.shk = 7; this.flash = 3; P.bal--;')
rep('this.score += 1000; this.pop("+1000", e.x, e.y - 22); this.burst(e.x, e.y - 8, "#7ad04a"); SFX.pick(); gone = true;',
    'this.score += 1000; this.pop("+1000", e.x, e.y - 22, "#7aff7a"); this.burst(e.x, e.y - 8, ["#7ad04a", "#ffe14d", "#fff"], 18, 2.2, 24, 1); this.star(e.x, e.y - 10); this.shk = Math.max(this.shk || 0, 3); this.hs = 2; SFX.pick(); gone = true;')

# win confetti
rep('this.won = 1; this.jingled = true; SFX.win(); }','this.won = 1; this.jingled = true; SFX.win(); this.confetti(60); this.flash = 3; }')
rep('if (this.won > 0) { if (++this.won > 120) this.api.win(this.score); return; }',
    'if (this.won > 0) { if (this.won % 10 === 1) this.confetti(10); if (++this.won > 120) this.api.win(this.score); return; }')

# hero flash
rep('''            var f = P.dead > 0 || P.inv > 45 ? H.hurt : P.ground ? (Math.abs(P.vx) > 0.1 ? H["run" + ((t >> 3) & 3)] : H.idle) : P.fa > 4 ? H.up : P.fa > 0 ? H.mid : H.glide;''',
'''            var nm = P.dead > 0 || P.inv > 45 ? "hurt" : P.ground ? (Math.abs(P.vx) > 0.1 ? "run" + ((t >> 3) & 3) : "idle") : P.fa > 4 ? "up" : P.fa > 0 ? "mid" : "glide";
            var f = H[nm + (P.hf > 0 && (t & 2) ? "W" : "")];''')
# foe flash
i0=s.index('          foe: function (x, ex, y, e) {'); i1=s.index('          // far + mid layers')
seg=s[i0:i1]
seg=seg.replace('FS = this.SB.foe, fr = null;','FS0 = this.SB.foe, fr = null, FS = { up: FS0[e.hf > 0 && (t & 2) ? "upW" : "up"], mid: FS0[e.hf > 0 && (t & 2) ? "midW" : "mid"], dn: FS0[e.hf > 0 && (t & 2) ? "dnW" : "dn"] };')
s=s[:i0]+seg+s[i1:]

# draw particles
rep('''              else { x.fillStyle = q.t > 10 ? "#fff" : q.c; var sz = q.t > 8 ? 2 : 1; x.fillRect(q.x | 0, q.y | 0, sz, sz); } }''',
'''              else if (q.k === "d") { x.globalAlpha = Math.max(0, q.t / q.L * 0.7); x.fillStyle = q.c; var ds = 1 + Math.round((1 - q.t / q.L) * 2); x.fillRect((q.x - ds / 2) | 0, (q.y - ds / 2) | 0, ds, ds); x.globalAlpha = 1; }
              else if (q.k === "p") { var arm = (q.L - q.t) * 2 + 3; x.fillStyle = q.t > 3 ? "#fff" : "#ffe14d"; var qx = q.x | 0, qy = q.y | 0; x.fillRect(qx - arm, qy, arm * 2 + 1, 1); x.fillRect(qx, qy - arm, 1, arm * 2 + 1); x.fillRect(qx - (arm >> 1), qy - (arm >> 1), 1, 1); x.fillRect(qx + (arm >> 1), qy - (arm >> 1), 1, 1); x.fillRect(qx - (arm >> 1), qy + (arm >> 1), 1, 1); x.fillRect(qx + (arm >> 1), qy + (arm >> 1), 1, 1); }
              else if (q.k === "c") { if (q.t < 14 && q.t % 4 < 2) continue; x.fillStyle = q.c; x.fillRect(q.x | 0, q.y | 0, 2, (q.t >> 3) % 2 ? 2 : 1); }
              else { var L = q.L || 16; x.fillStyle = q.t > L * 0.6 ? "#fff" : q.c; var sz = q.t > L * 0.5 ? 2 : 1; x.fillRect(q.x | 0, q.y | 0, sz, sz); } }''')

# popups: shadow, bounce, scale, colour
rep('''for (i = 0; i < this.pops.length; i++) text(this.pops[i].s, this.pops[i].x, this.pops[i].y | 0, 1, "#fff", true);''',
'''for (i = 0; i < this.pops.length; i++) { var pp = this.pops[i], big = pp.t > 40 ? 2 : 1, py = pp.y | 0, pc = pp.t < 12 && pp.t % 4 < 2 ? "#fff" : pp.c; text(pp.s, pp.x + 1, py + 1, big, "#140a12", true); text(pp.s, pp.x, py, big, pc, true); }
            if (this.flash > 0) { x.globalAlpha = this.flash * 0.1; x.fillStyle = "#fff"; x.fillRect(0, 0, 320, 240); x.globalAlpha = 1; }''')

open('qp/q5c.html','w').write(s)
print("ok")
