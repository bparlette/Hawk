/* Retro Throwback Arcade - Level 3: RING RUSH
   Loaded by ../index.html and evaluated inside the player's scope.
   Must define `var ringRush = {...}` (title, goal, init(api), update(input), draw(ctx)). */

        var ringRush = {
          title: "RING RUSH",
          goal: "RUN, GRAB RINGS, JUMP TO SPIN-ATTACK. REACH THE SIGN.",
          api: null,
          LEN: 2000,
          init: function (api) {
            this.api = api;
            this.lives = 3; this.score = 0; this.rings = 0; this.parts = []; this.won = 0; this.timer = 0; this.check = 60; this.cam = 0;
            this.pops = []; this.lost = []; this.fx = []; this.birds = []; this.spring = { x: 880, t: 0 }; this.post = { x: 1060, hit: false };
            var R = [], i, self = this;
            function line(x0, n, dy) { for (var k = 0; k < n; k++) { var rx = x0 + k * 16; R.push({ x: rx, y: self.gy(rx) - dy }); } }
            function arc(cx, n) { for (var k = 0; k < n; k++) { var a = Math.PI * k / (n - 1), rx = cx - 40 + k * 80 / (n - 1); R.push({ x: rx, y: self.gy(cx - 40) - 30 - Math.sin(a) * 40 }); } }
            line(140, 5, 14); arc(400, 6); arc(730, 6); line(940, 5, 14); line(1110, 5, 30);
            arc(1660, 6); line(1350, 4, 14); line(1760, 4, 14);
            for (i = 0; i < R.length; i++) R[i].got = false;
            this.R = R;
            this.E = [240, 450, 960, 1260, 1380, 1820].map(function (x) { return { x: x, x0: x - 50, x1: x + 50, dir: 1, alive: true, r: 0 }; });
            this.reset();
          },
          reset: function () { this.p = { x: this.check, y: this.gy(this.check), vx: 0, vy: 0, on: true, spin: false, face: 1, inv: 60, dead: 0, run: 0 }; },
          // heightmap: ground y at x, or 999 in a pit
          gy: function (x) {
            if ((x > 700 && x < 760) || (x > 1624 && x < 1696)) return 999;
            var y = 200;
            if (x > 300 && x < 500) y -= Math.sin((x - 300) / 200 * Math.PI) * 26;
            if (x > 1280 && x < 1520) y -= Math.sin((x - 1280) / 240 * Math.PI) * 30;
            if (x >= 1100 && x < 1200) y -= (x - 1100) * 0.35;
            if (x >= 1200 && x < 1230) y -= 35;
            return y;
          },
          pop: function (s, x, y) { this.pops.push({ s: s, x: x, y: y, t: 40 }); },
          // ring chime: two bright notes, the classic "ching"
          chime: function () { beep(1568, 0.05, "square", 0.04); setTimeout(function () { beep(2093, 0.14, "triangle", 0.05); }, 45); },
          spark: function (x, y) { for (var k = 0; k < 4; k++) { var a = Math.PI / 4 + k * Math.PI / 2; this.fx.push({ k: "spark", x: x, y: y, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, t: 14 }); } },
          die: function () { var P = this.p; if (P.dead) return; P.dead = 70; P.vy = -5; P.vx = 0; SFX.hit(); },
          update: function (inp) {
            var P = this.p, i, e, g;
            this.timer++;
            for (i = this.pops.length - 1; i >= 0; i--) { this.pops[i].y -= 0.4; if (--this.pops[i].t <= 0) this.pops.splice(i, 1); }
            // scattered rings: bounce on the ground, losing height each hop; blink out at the end
            for (i = this.lost.length - 1; i >= 0; i--) { var l = this.lost[i]; l.x += l.vx; l.vy += 0.18; l.y += l.vy;
              var lg = this.gy(l.x); if (lg < 999 && l.vy > 0 && l.y > lg - 4) { l.y = lg - 4; l.vy *= -0.7; l.vx *= 0.92; }
              if (l.d > 0) l.d--;
              if (--l.t <= 0) this.lost.splice(i, 1); }
            for (i = this.fx.length - 1; i >= 0; i--) { var q = this.fx[i]; q.x += q.vx; q.y += q.vy; if (--q.t <= 0) this.fx.splice(i, 1); }
            for (i = this.birds.length - 1; i >= 0; i--) { var bd = this.birds[i]; bd.t++; bd.x += bd.vx; bd.y += bd.t < 12 ? -0.4 : -1.1 + Math.sin(bd.t / 5) * 0.6; if (bd.y < -20 || bd.t > 200) this.birds.splice(i, 1); }
            if (this.spring.t > 0) this.spring.t--;
            if (this.won > 0) { if (++this.won > 120) this.api.win(this.score); return; }
            if (P.dead > 0) {
              P.vy += 0.25; P.y += P.vy;
              if (--P.dead === 0) {  this.rings = 0;  this.reset(); }
              return;
            }
            if (P.inv > 0) P.inv--;
            var dx = (inp.k.right ? 1 : 0) - (inp.k.left ? 1 : 0);
            // skid: pushing against fast ground speed kicks up dust
            P.skid = P.on && dx !== 0 && dx * P.vx < -1.2;
            if (P.skid) {
              if (this.timer % 3 === 0) this.fx.push({ k: "dust", x: P.x + (Math.random() * 4 - 2), y: P.y - 2, vx: P.vx * 0.3, vy: -0.3 - Math.random() * 0.4, t: 18 });
              if (this.timer % 6 === 0) beep(130 + Math.random() * 40, 0.04, "sawtooth", 0.03);
            }
            if (dx) { P.face = dx; P.vx += dx * (P.on ? (dx * P.vx < 0 ? 0.3 : 0.12) : (dx * P.vx < 0 ? 0.16 : 0.08)); }
            else if (P.on) { P.vx *= 0.94; if (Math.abs(P.vx) < 0.05) P.vx = 0; }
            P.vx = Math.max(-4, Math.min(4, P.vx));
            // walls: a pit side or cliff face higher than a 12px step blocks; a near-miss ledge is grabbed
            var nx = Math.max(8, Math.min(this.LEN - 8, P.x + P.vx)), ng = this.gy(nx);
            if (ng < 999 && ng < P.y - 12) { if (!P.on && P.vy >= 0 && ng >= P.y - 16) { P.y = ng; } else { nx = P.x; P.vx = 0; } }
            P.x = nx; P.run += Math.abs(P.vx); P.rot = (P.rot || 0) + 0.3 + Math.abs(P.vx) * 0.1;
            g = this.gy(P.x);
            if (inp.p.a) P.jb = 7; else if (P.jb > 0) P.jb--;   // jump buffer
            if (P.on) P.co = 0; else P.co = (P.co || 0) + 1;    // coyote time
            if (P.jb > 0 && (P.on || (P.co < 7 && !P.spin && P.vy >= 0))) { P.jb = 0; P.vy = -5.8; P.on = false; P.spin = true; P.co = 99; SFX.jump(); }
            else if (P.on) {
              if (g > P.y + 8) { P.on = false; P.vy = 0; }
              else P.y = g;
            }
            if (!P.on) {
              P.vy = Math.min(P.vy + 0.22, 6); P.y += P.vy;
              if (P.vy >= 0 && g < 999 && P.y >= g && P.y - P.vy <= g + 12) { P.y = g; P.on = true; P.spin = false; }
              if (P.y > H + 20) { this.die(); return; }
            }
            var s = this.spring;
            if (P.on && Math.abs(P.x - s.x) < 10) { P.vy = -8; P.on = false; P.spin = true; s.t = 12; beep(880, 0.12, "square", 0.06); }
            if (!this.post.hit && P.x >= this.post.x) { this.post.hit = true; this.check = this.post.x; beep(990, 0.15); this.pop("CHECK", this.post.x - 14, P.y - 40); }
            for (i = 0; i < this.R.length; i++) { var r = this.R[i];
              if (!r.got && Math.abs(r.x - P.x) < 10 && Math.abs(r.y - (P.y - 10)) < 14) { r.got = true; this.rings++; this.score += 10; this.chime(); this.spark(r.x, r.y); } }
            for (i = this.lost.length - 1; i >= 0; i--) { var lr = this.lost[i];   // scattered rings can be won back
              if (lr.d === 0 && Math.abs(lr.x - P.x) < 10 && Math.abs(lr.y - (P.y - 10)) < 14) { this.lost.splice(i, 1); this.rings++; this.chime(); this.spark(lr.x, lr.y); } }
            for (i = 0; i < this.E.length; i++) { e = this.E[i]; if (!e.alive) continue;
              e.x += e.dir * 0.6; e.r += 0.6; if (e.x > e.x1 || e.x < e.x0) e.dir = -e.dir;
              var ey = this.gy(e.x);
              if (Math.abs(e.x - P.x) < 12 && Math.abs(ey - 6 - (P.y - 8)) < 14) {
                if (P.spin || (!P.on && P.vy > 0)) { e.alive = false; P.vy = -3.5; for (var fk = 0; fk < 12; fk++) { var fa = fk / 12 * 6.283, fv = 1 + fk % 3 * 0.6; this.parts.push({ x: e.x, y: ey - 8, vx: Math.cos(fa) * fv, vy: Math.sin(fa) * fv - 1, t: 24, c: fk % 3 ? "#ffe14d" : "#ffffff" }); } this.score += 100; this.pop("+100", e.x - 12, ey - 24); SFX.smash();
                  // pop: a puff of smoke, and the critter inside flies free
                  for (var pf = 0; pf < 6; pf++) { var pa = pf * Math.PI / 3; this.fx.push({ k: "puff", x: e.x, y: ey - 7, vx: Math.cos(pa) * 0.9, vy: Math.sin(pa) * 0.9 - 0.3, t: 20 }); }
                  this.birds.push({ x: e.x, y: ey - 8, vx: P.x < e.x ? 0.9 : -0.9, t: 0 });
                  setTimeout(function () { beep(1400, 0.05, "triangle", 0.04); setTimeout(function () { beep(1700, 0.05, "triangle", 0.04); }, 70); }, 160); }
                else if (P.inv === 0) {
                  if (this.rings > 0) {
                    for (var k = 0; k < Math.min(this.rings, 8); k++) { var a = Math.PI * (0.15 + 0.7 * k / 7); this.lost.push({ x: P.x, y: P.y - 10, vx: Math.cos(a) * 2.5, vy: -Math.sin(a) * 3.5, t: 180, d: 40 }); }
                    [988, 784, 622].forEach(function (fq, n) { setTimeout(function () { beep(fq, 0.06, "square", 0.04); }, n * 50); });
                    this.rings = 0; P.inv = 100; P.vx = -P.face * 2.5; P.vy = -3; P.on = false; P.spin = false; SFX.hit();
                  } else { this.die(); return; }
                } } }
            if (P.x >= this.LEN - 60) {
              this.won = 1; var bonus = this.rings * 50; this.score += bonus; this.pop("BONUS " + bonus, P.x - 30, P.y - 50);
              [523, 659, 784, 1047].forEach(function (fq, n) { setTimeout(function () { beep(fq, n === 3 ? 0.35 : 0.1); }, n * 120); });
            }
            this.cam = Math.max(0, Math.min(this.LEN - W, P.x - 130));
          },
          draw: function (x) {
            var c = Math.round(this.cam), t = this.timer, i, sx, g;
            var skg = x.createLinearGradient(0, 0, 0, 130); skg.addColorStop(0, "#1d4fe0"); skg.addColorStop(0.65, "#5d9bff"); skg.addColorStop(1, "#bfe0ff"); x.fillStyle = skg; x.fillRect(0, 0, W, 130);
            x.fillStyle = "#fff";
            for (i = 0; i < 6; i++) { sx = ((i * 90 - c * 0.15) % 540 + 540) % 540 - 60; x.fillRect(sx, 30 + (i % 3) * 18, 40, 8); x.fillRect(sx + 8, 24 + (i % 3) * 18, 22, 6); }
            for (sx = 0; sx < W; sx += 2) { var mw = sx + c * 0.22, mh = 26 + Math.round(12 * Math.sin(mw / 34) + 7 * Math.sin(mw / 13)); x.fillStyle = "#2a6fb0"; x.fillRect(sx, 130 - mh, 2, mh); if (mh > 38) { x.fillStyle = "#e8f4ff"; x.fillRect(sx, 130 - mh, 2, 3); } }
            for (sx = 0; sx < W; sx += 2) { var hw = sx + c * 0.45, hh = 10 + Math.round(6 * Math.sin(hw / 22) + 3 * Math.sin(hw / 9)); x.fillStyle = (Math.floor(hw / 12) % 2) ? "#2f9a52" : "#257f43"; x.fillRect(sx, 130 - hh, 2, hh); x.fillStyle = "#6fe08a"; x.fillRect(sx, 130 - hh, 2, 1); }
            var wg = x.createLinearGradient(0, 130, 0, H); wg.addColorStop(0, "#2a66d8"); wg.addColorStop(1, "#122f86"); x.fillStyle = wg; x.fillRect(0, 130, W, 110);
            x.fillStyle = "#6fa0ff"; for (i = 0; i < 12; i++) { sx = ((i * 40 - c * 0.35 + t * 0.3) % 480 + 480) % 480 - 40; x.fillRect(sx, 140 + (i % 4) * 14, 18, 1); }
            for (sx = 0; sx < W; sx += 4) { var wx = sx + c; g = this.gy(wx); if (g >= 999) continue;
              var chk = ((Math.floor(wx / 16) + Math.floor((g) / 16)) % 2) === 0;
              x.fillStyle = "#3fcf4a"; x.fillRect(sx, g, 4, 5);
              for (var yy = g + 5; yy < H; yy += 8) { x.fillStyle = ((Math.floor(wx / 16) + Math.floor(yy / 8)) % 2) ? "#b5651d" : "#7a3e10"; x.fillRect(sx, yy, 4, 8); }
              if (chk) { x.fillStyle = "#2a9a35"; x.fillRect(sx, g + 3, 4, 2); } }
            var s = this.spring, ssx = s.x - c, sg = this.gy(s.x), sh = s.t > 0 ? 12 : 5;
            x.fillStyle = "#ccc"; x.fillRect(ssx - 3, sg - sh, 6, sh); x.fillStyle = "#ff3b30"; x.fillRect(ssx - 9, sg - sh - 4, 18, 4);
            var px0 = this.post.x - c, pg = this.gy(this.post.x);
            x.fillStyle = "#888"; x.fillRect(px0 - 1, pg - 30, 2, 30); x.fillStyle = this.post.hit ? "#ff3b30" : "#3a7bff"; x.fillRect(px0 - 4, pg - 36, 8, 8);
            var fx = this.LEN - 60 - c, fg = this.gy(this.LEN - 60);
            // goal sign: spins on win (eases out over 4 turns), lands showing the hero
            var sa = this.won ? (1 - Math.pow(1 - Math.min(this.won, 80) / 80, 2)) * Math.PI * 8 : 0, scs = Math.cos(sa), swd = Math.max(1, Math.round(12 * Math.abs(scs)));
            x.fillStyle = "#888"; x.fillRect(fx - 1, fg - 24, 2, 24); x.fillStyle = scs < 0 ? "#c9a227" : "#ffe14d"; x.fillRect(fx - swd, fg - 44, swd * 2, 20);
            if (swd > 3) {
              var siw = Math.round(swd * 2 / 3);
              x.fillStyle = this.won ? "#1fb3b0" : "#d02a2a"; x.fillRect(fx - siw, fg - 40, siw * 2, 12);
              if (this.won >= 80) { x.fillStyle = "#fff"; x.fillRect(fx, fg - 38, 4, 4); x.fillStyle = "#000"; x.fillRect(fx + 2, fg - 37, 2, 2); x.fillStyle = "#ffcf99"; x.fillRect(fx - 1, fg - 33, 6, 4); }
            }
            if (this.won > 0 && this.won < 90 && t % 4 < 2) { x.fillStyle = "#fff"; x.fillRect(fx - 16 + (t * 7) % 32, fg - 50 + (t * 5) % 30, 2, 2); }
            var rw = [6, 4, 2, 4][(t >> 3) % 4];
            for (i = 0; i < this.R.length; i++) { var r = this.R[i]; if (r.got) continue; sx = r.x - c; if (sx < -10 || sx > W + 10) continue;
              x.strokeStyle = "#ffe14d"; x.lineWidth = 2; x.strokeRect(Math.round(sx - rw / 2), Math.round(r.y - 4), rw, 8);
              if (((i * 7 + (t >> 2)) % 19) === 0) { x.fillStyle = "#fff"; x.fillRect(Math.round(sx - rw / 2) - 1, Math.round(r.y - 5), 2, 2); } } // glint
            // scattered rings: spin fast, blink faster as they run out
            for (i = 0; i < this.lost.length; i++) { var l = this.lost[i];
              if (l.t < 60 && t % (l.t < 25 ? 4 : 8) < (l.t < 25 ? 2 : 3)) continue;
              var lw = [6, 4, 2, 4][((t >> 1) + i) % 4];
              x.strokeStyle = "#ffe14d"; x.lineWidth = 2; x.strokeRect(Math.round(l.x - c - lw / 2), Math.round(l.y - 4), lw, 8); }
            // particles: sparkles, skid dust, enemy puffs
            for (i = 0; i < this.fx.length; i++) { var q = this.fx[i], qx = Math.round(q.x - c), qy = Math.round(q.y);
              if (q.k === "spark") { x.fillStyle = q.t > 7 ? "#fff" : "#ffe14d"; var ss = q.t > 7 ? 2 : 1; x.fillRect(qx - ss, qy, ss * 2 + 1, 1); x.fillRect(qx, qy - ss, 1, ss * 2 + 1); }
              else if (q.k === "dust") { var ds = q.t > 10 ? 3 : 2; x.fillStyle = q.t > 10 ? "#e8d8b8" : "#b8a888"; x.fillRect(qx - 1, qy - 1, ds, ds); }
              else { var ps = Math.round(5 - q.t / 5); x.fillStyle = q.t > 8 ? "#fff" : "#cfd8e8"; x.fillRect(qx - ps, qy - ps, ps * 2, ps * 2); } }
            // freed birds, two-frame flap
            for (i = 0; i < this.birds.length; i++) { var bd = this.birds[i], bx = Math.round(bd.x - c), by = Math.round(bd.y), up = (bd.t >> 2) % 2;
              x.fillStyle = "#8fd8ff"; x.fillRect(bx - 2, by - 2, 5, 4);
              x.fillStyle = "#fff"; x.fillRect(bx - 4, by - (up ? 4 : 0), 3, 2); x.fillRect(bx + 2, by - (up ? 4 : 0), 3, 2);
              x.fillStyle = "#ffa020"; x.fillRect(bx + (bd.vx > 0 ? 3 : -3), by - 1, 2, 1); x.fillStyle = "#000"; x.fillRect(bx + (bd.vx > 0 ? 1 : -1), by - 2, 1, 1); }
            for (i = 0; i < this.E.length; i++) { var e = this.E[i]; if (!e.alive) continue; sx = Math.round(e.x - c); g = this.gy(e.x);
              x.fillStyle = "#d02a2a"; x.fillRect(sx - 7, g - 11, 14, 8); x.fillStyle = "#ddd"; x.fillRect(sx + e.dir * 6 - 1, g - 9, 3, 2);
              x.fillStyle = "#333"; var wf = (Math.floor(e.r / 4) % 2); x.fillRect(sx - 6, g - 3, 4, 3 - wf); x.fillRect(sx + 2, g - 3, 4, 2 + wf); }
            var P = this.p;
            if (!(P.inv > 0 && t % 6 < 3)) {
              var hx = Math.round(P.x - c), hy = Math.round(P.y);
              var f = P.face, sp = Math.abs(P.vx);
              if (P.spin && !P.dead) {
                // spin ball: round body, three spike tufts and a peek of muzzle, turning with speed
                x.fillStyle = "rgba(31,179,176,0.3)"; x.beginPath(); x.arc(hx - Math.sign(P.vx || f) * 5, hy - 8, 6, 0, Math.PI * 2); x.fill();
                x.save(); x.translate(hx, hy - 8); x.rotate(P.rot * (P.vx < 0 ? -1 : 1));
                x.fillStyle = "#1fb3b0"; x.beginPath(); x.arc(0, 0, 7, 0, Math.PI * 2); x.fill();
                x.fillStyle = "#0d6f6d"; for (var sk = 0; sk < 3; sk++) { x.rotate(Math.PI * 2 / 3); x.fillRect(-1, -9, 3, 5); }
                x.fillStyle = "#ffcf99"; x.fillRect(-2, 2, 4, 3); x.fillStyle = "#e0202a"; x.fillRect(2, -1, 3, 3);
                x.restore();
              } else {
                // run cycle: 4 frames stepped by distance travelled, so it quickens with speed; legs blur at top speed
                var ph = Math.floor(P.run / 7) % 4, lean = P.skid ? -f : (sp > 2.2 ? f : 0), by = hy - (P.on && sp > 0.2 && ph % 2 ? 1 : 0);
                var body = P.dead ? "#777" : "#1fb3b0", sb = sp > 3 ? 3 : 0;
                x.fillStyle = body; x.fillRect(hx - 5 + lean, by - 18, 10, 12);
                x.fillRect(hx - f * (9 + sb) + lean, by - 18, 4 + sb, 2); x.fillRect(hx - f * (10 + sb) + lean, by - 14, 5 + sb, 2); x.fillRect(hx - f * (9 + sb) + lean, by - 10, 4 + sb, 2); // spikes stream back
                x.fillStyle = "#ffcf99"; x.fillRect(hx + f * 2 - 2 + lean, by - 13, 5, 6);
                x.fillStyle = "#fff"; x.fillRect(hx + f * 2 - 1 + lean, by - 17, 4, 4); x.fillStyle = "#000"; x.fillRect(hx + f * 3 + lean, by - 16, 2, 2);
                x.fillStyle = body; x.fillRect(hx + (P.skid ? -f * 6 : (ph < 2 ? -f * 6 : f * 5)), by - 11, 2, 3); // arm
                if (P.dead || !P.on) {            // airborne / hurt: legs dangling
                  x.fillStyle = body; x.fillRect(hx - 3, hy - 6, 2, 4); x.fillRect(hx + 1, hy - 6, 2, 4);
                  x.fillStyle = "#e0202a"; x.fillRect(hx - 5, hy - 2, 4, 3); x.fillRect(hx + 1, hy - 2, 4, 3);
                } else if (P.skid) {               // skid: feet braced forward
                  x.fillStyle = body; x.fillRect(hx + f * 2 - 1, hy - 6, 2, 3); x.fillRect(hx + f * 5 - 1, hy - 6, 2, 3);
                  x.fillStyle = "#e0202a"; x.fillRect(hx + f * 3 - 2, hy - 3, 5, 3); x.fillRect(hx + f * 7 - 2, hy - 3, 5, 3);
                } else if (sp > 3.3) {             // top speed: figure-eight blur
                  x.fillStyle = "#e0202a"; x.fillRect(hx - 7, hy - 4, 14, 4);
                  x.fillStyle = "#ff8a8f"; x.fillRect(hx - 7 + ((t >> 1) % 3) * 4, hy - 3, 5, 2);
                } else if (sp > 0.2) {             // stride: back, pass, front, pass
                  var FO = [5, 1, -4, -1][ph], lift = ph % 2;
                  x.fillStyle = body; x.fillRect(hx + f * FO - 1, hy - 6, 2, 3); x.fillRect(hx - f * FO - 1, hy - 6, 2, 3);
                  x.fillStyle = "#e0202a"; x.fillRect(hx + f * FO - 2, hy - 3 - lift, 5, 3); x.fillRect(hx - f * FO - 2, hy - 3, 5, 3);
                } else {                            // idle
                  x.fillStyle = body; x.fillRect(hx - 3, hy - 6, 2, 3); x.fillRect(hx + 1, hy - 6, 2, 3);
                  x.fillStyle = "#e0202a"; x.fillRect(hx - 5, hy - 3, 5, 3); x.fillRect(hx + 1, hy - 3, 5, 3);
                }
              }
            }
            // speed lines: streaks rush past while at top speed on the ground
            if (!P.dead && Math.abs(P.vx) > 3.6) { var sd = P.vx > 0 ? 1 : -1;
              x.fillStyle = "rgba(255,255,255,0.55)";
              for (i = 0; i < 8; i++) { var ly = 34 + ((i * 53) % 170), lx = ((i * 97 - t * 15 * sd) % 400 + 400) % 400 - 40; x.fillRect(lx, ly, 18 + (i % 3) * 14, 1); } }
            for (i = 0; i < this.pops.length; i++) { var po = this.pops[i]; text(po.s, Math.round(po.x - c), Math.round(po.y), 1, po.t % 8 < 4 ? "#fff" : "#ffe14d"); }
            text("RINGS " + this.rings, 6, 6, 1, this.rings === 0 && t % 30 < 15 ? "#ff3b30" : "#ffe14d");
            for (var rq = this.parts.length - 1; rq >= 0; rq--) { var rp = this.parts[rq]; rp.x += rp.vx; rp.y += rp.vy; rp.vy += 0.12; x.fillStyle = rp.t > 16 ? "#fff" : rp.c; x.fillRect((rp.x - c) | 0, rp.y | 0, rp.t > 10 ? 2 : 1, rp.t > 10 ? 2 : 1); if (--rp.t <= 0) this.parts.splice(rq, 1); }
            text("LIVES INF", 120, 6, 1, "#fff");
            text("SCORE " + this.score, 220, 6, 1, "#fff");
          }
        };
