s=open('qp/q3b.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,a
    s=s.replace(a,b)
rep("          spark: function (x, y) {","          burst: function (x, y, n, cols, spd, life, g) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = spd * (0.4 + Math.random() * 0.6); this.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.3, t: life | 0, c: cols[i % cols.length], g: g }); } },\n          spark: function (x, y) {")
rep("{ P.y = g; P.on = true; P.spin = false; }","{ if (!P.on && P.vy > 2) { this.burst(P.x, g, 6, [\"#e8d8a8\", \"#fff\"], 1.2, 14, 0.02); } P.y = g; P.on = true; P.spin = false; }")
rep("this.rings++; this.score += 10; this.chime(); this.spark(r.x, r.y);","this.rings++; this.score += 10; this.chime(); this.spark(r.x, r.y); this.burst(r.x, r.y, 8, [\"#ffe14d\", \"#fff\"], 1.6, 16, 0.05);")
rep("this.rings = 0; P.inv = 100; this.shk = 14;","this.burst(P.x, P.y - 10, 16, [\"#ffe14d\", \"#fff\", \"#ff8a2a\"], 3, 30, 0.12); this.rings = 0; P.inv = 100; this.shk = 14;")
rep("P.vy = -3.5; for (var fk","P.vy = -3.5; this.shk = 5; for (var fk")
rep("rp.vy += 0.12;","rp.vy += rp.g === undefined ? 0.12 : rp.g;")
open('qp/q3c.html','w').write(s)
