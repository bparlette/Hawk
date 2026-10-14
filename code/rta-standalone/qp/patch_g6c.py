s=open('qp/q6b.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80]); s=s.replace(a,b)
# white player sprite
i=s.index("Q.car.s = mk(")+len("Q.car.s = mk("); j=s.index(", PC);",i); rows=s[i:j]
rep("            var cols = { \"#2f6fe0\"","            Q.carW = mk(%s, { B: \"#fff\", b: \"#fff\", G: \"#fff\", Y: \"#fff\", k: \"#fff\", T: \"#fff\", R: \"#fff\", W: \"#fff\", p: \"#fff\", E: \"#fff\" }, \"#fff\", true);\n            var cols = { \"#2f6fe0\"" % rows)
methods='''  /* ---- juice: particles (screen space), popups, shake, flashes ---- */
  emit: function (x, y, n, cols, spd, life, g, sz, up) {
    for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, sp = spd * (0.4 + Math.random() * 0.8);
      this.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (up || 0), t: life, L: life, g: g || 0, c: cols[i %% cols.length], z: sz || 2 }); }
  },
  pop: function (str, col) { this.pops.push({ s: str, c: col || '#fff', y: 98, t: 60 }); },
  confetti: function (n) {
    var cols = ['#ff4040', '#ffe66d', '#ff7ad9', '#7ad04a', '#6ac8ff'];
    for (var i = 0; i < n; i++) this.parts.push({ x: Math.random() * 320, y: -4 - Math.random() * 30, vx: (Math.random() - 0.5) * 1.4, vy: 0.6 + Math.random() * 1.2, t: 90, L: 90, g: 0.004, c: cols[i %% 5], z: 2, cf: 1 });
  },
  onBump: function (car) {
    this.shk = 10; this.hf = 14; car.hf = 14; this.flash = 3; this.pop('BUMP!', '#ffe66d');
    this.emit(160 + this.tilt * 6, 212, 16, ['#fff', '#ffe66d', '#ff9a3a'], 2.6, 18, 0.12, 2, 1.2);
  },
  onSpin: function () {
    this.shk = 12; this.hf = 18; this.flash = 4; this.pop('SPIN OUT!', '#ff6a5a'); this.blinkAfter = 1;
    this.emit(160 + this.tilt * 6, 214, 22, ['#8b5a2b', '#1f9d3a', '#3fa34d', '#c9b27a'], 2.8, 26, 0.12, 2, 1.5);
  },
  tick: function () {
    var i, p;
    this.shk *= 0.86; if (this.shk < 0.3) this.shk = 0;
    if (this.hf > 0) this.hf--; if (this.flash > 0) this.flash--; if (this.blink > 0) this.blink--;
    if (this.spin <= 0 && this.blinkAfter) { this.blinkAfter = 0; this.blink = 60; }
    for (i = 0; i < this.cars.length; i++) if (this.cars[i].hf > 0) this.cars[i].hf--;
    for (i = this.parts.length - 1; i >= 0; i--) { p = this.parts[i]; p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= p.cf ? 1 : 0.97; if (p.cf) p.vx += Math.sin((p.t + i) * 0.2) * 0.05; if (--p.t <= 0 || p.y > 250) this.parts.splice(i, 1); }
    for (i = this.pops.length - 1; i >= 0; i--) { p = this.pops[i]; p.y -= 0.35; if (--p.t <= 0) this.pops.splice(i, 1); }
    var sp = this.speed / this.MAX, px0 = 160 + this.tilt * 6, fr = this.fr;
    if (Math.abs(this.px) > 1 && this.speed > this.MAX * 0.12 && fr %% 2 === 0 && this.spin <= 0) {
      this.emit(px0 - 24, 230, 1, ['#3fa34d', '#8b6b3a', '#c9b27a'], 1.4, 22, 0.08, 2, 1.0 + sp); this.emit(px0 + 24, 230, 1, ['#3fa34d', '#8b6b3a', '#c9b27a'], 1.4, 22, 0.08, 2, 1.0 + sp);
    }
    if (this.brake && this.speed > this.MAX * 0.3 && fr %% 2 === 0) { this.emit(px0 - 24, 232, 1, ['#e8e8f0', '#b0b0c0'], 0.7, 18, -0.01, 3, 0); this.emit(px0 + 24, 232, 1, ['#e8e8f0', '#b0b0c0'], 0.7, 18, -0.01, 3, 0); }
    if (sp > 0.85 && fr %% 2 === 0 && this.spin <= 0) this.emit(px0 + (fr %% 4 ? 8 : -8), 234, 1, ['#ffe66d', '#ff8a3a'], 0.4, 8, 0.1, 2, -0.6);
  },
'''
rep("  update: function (inp) {",methods+"  update: function (inp) {")
rep("S.bgx = 0; S.cp = false;","S.bgx = 0; S.parts = []; S.pops = []; S.shk = 0; S.hf = 0; S.flash = 0; S.blink = 0; S.fr = 0; S.cp = false;")
rep("S.time -= dt; S.t += dt; if (S.banner > 0) S.banner -= dt;","S.time -= dt; S.t += dt; if (S.banner > 0) S.banner -= dt; S.fr++; S.tick();")
rep("S.speed = 0; S.px = 0; S.spin = 0; S.tilt = 0; return; }","S.speed = 0; S.px = 0; S.spin = 0; S.tilt = 0; S.blink = 90; S.flash = 8; S.pop('TIME UP', '#ff6a5a'); return; }")
rep("S.speed *= 0.5; break; }","S.speed *= 0.5; S.onBump(car); break; }")
rep("{ S.spin = 1; S.speed = 0; }","{ S.spin = 1; S.speed = 0; S.onSpin(); }")
rep("S.cp = true; S.time += 20; S.banner = 2; }","S.cp = true; S.time += 20; S.banner = 2; S.confetti(50); S.flash = 5; S.pop('TIME +20', '#7aff7a'); }")
# draw: shake
rep("ctx.save(); if (S.spin > 0) ctx.translate(Math.round((Math.random() - 0.5) * 8 * S.spin), Math.round((Math.random() - 0.5) * 8 * S.spin));",
    "ctx.save(); var shk = Math.max(S.spin > 0 ? 8 * S.spin : 0, S.shk, Math.abs(S.px) > 1 ? S.speed / S.MAX * 1.4 : 0); if (shk > 0.2) ctx.translate(Math.round((Math.random() - 0.5) * shk), Math.round((Math.random() - 0.5) * shk));")
# traffic flash
rep("var fr = Math.floor(S.t * 8 + c.z / S.SEG) % 2, sp = S.SQ.en[c.col][fr];","var fr = Math.floor(S.t * 8 + c.z / S.SEG) % 2, sp = c.hf > 0 && (S.fr >> 1) % 2 ? S.SQ.enW[fr] : S.SQ.en[c.col][fr];")
# player flash + blink
rep("    S.spr(ctx, psp, 0, ph2 * 0.3, pw, ph2, false);\n","    if (S.hf > 0 && (S.fr >> 1) % 2) psp = S.SQ.carW;\n    if (!(S.blink > 0 && (S.fr >> 2) % 2)) S.spr(ctx, psp, 0, ph2 * 0.3, pw, ph2, false);\n")
# particles + popups + flash
rep("    if (S.speed > S.MAX * 0.8) { ctx.fillStyle = 'rgba(255,255,255,0.35)';","""    for (var pi2 = 0; pi2 < S.parts.length; pi2++) { var pp = S.parts[pi2], pa = pp.t / pp.L; ctx.globalAlpha = pp.cf ? (pp.t < 14 && pp.t %% 4 < 2 ? 0 : 1) : Math.min(1, pa * 1.6); ctx.fillStyle = pp.c; var pz = pp.z * (pp.g < 0 ? 1 + (1 - pa) : 1); ctx.fillRect(Math.round(pp.x), Math.round(pp.y), pz, pz); }
    ctx.globalAlpha = 1;
    if (S.speed > S.MAX * 0.8) { ctx.fillStyle = 'rgba(255,255,255,0.35)';""" % ())
rep("    var prog = S.pos / (S.len - S.SEG * (S.DRAW + 2));","""    for (var po = 0; po < S.pops.length; po++) { var pq = S.pops[po], big = pq.t > 50 ? 3 : 2; text(pq.s, W / 2 + 1, Math.round(pq.y) + 1, big, '#140a12', true); text(pq.s, W / 2, Math.round(pq.y), big, pq.t < 14 && pq.t %% 4 < 2 ? '#fff' : pq.c, true); }
    if (S.flash > 0) { ctx.globalAlpha = S.flash * 0.08; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    var prog = S.pos / (S.len - S.SEG * (S.DRAW + 2));""" % ())
s=s.replace('%%','%')
open('qp/q6c.html','w').write(s); print('ok')
