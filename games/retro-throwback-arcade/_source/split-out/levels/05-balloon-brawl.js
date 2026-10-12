/* Retro Throwback Arcade - Level 5: BALLOON BRAWL
   Loaded by ../index.html and evaluated inside the player's scope.
   Must define `var balloonBrawl = {...}` (title, goal, init(api), update(input), draw(ctx)). */

        /* ================= LEVEL 5 — BALLOON BRAWL ================= */
        /* One wrapping screen, floating isles, a fish in the water, balloon foes. */
        var balloonBrawl = {
          title: "BALLOON BRAWL",
          goal: "FLAP WITH A. POP FOES FROM ABOVE.",
          api: null,
          init: function (api) {
            this.api = api;
            this.PL = [{ x0: -4, x1: 44, y: 206 }, { x0: 276, x1: 324, y: 206 },
              { x0: 46, x1: 122, y: 160 }, { x0: 200, x1: 276, y: 140 }, { x0: 118, x1: 202, y: 86 }];
            this.stars = []; for (var i = 0; i < 50; i++) this.stars.push({ x: (i * 73 + 11) % 320, y: (i * 47 + 7) % 180, b: i % 4 });
            this.lives = 3; this.score = 0; this.won = 0; this.jingled = false; this.timer = 0;
            this.foes = []; this.spawned = 0; this.spawnT = 60; this.pops = []; this.fish = null; this.splash = []; this.fx = []; this.bolt = 0;
            this.reset();
          },
          reset: function () { this.p = { x: 20, y: 206, vx: 0, vy: 0, bal: 2, dead: 0, dvy: 0, sink: false, inv: 90, face: 1, ground: true, fa: 0 }; this.lowT = 0; },
          wdx: function (a, b) { var d = a - b; if (d > 160) d -= 320; if (d < -160) d += 320; return d; },
          pop: function (s, x, y) { this.pops.push({ s: s, x: x, y: y, t: 45 }); },
          burst: function (x, y, col) { for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2; this.fx.push({ k: "b", x: x, y: y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6, t: 16, c: col }); } },
          ripple: function (x) { this.fx.push({ k: "r", x: x, y: 214, t: 36 }); },
          splashAt: function (x) { this.ripple(x); for (var i = 0; i < 8; i++) this.splash.push({ x: x, y: 214, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 1.5, t: 30 }); beep(140, 0.15, "triangle", 0.07); },
          phys: function (o, grav, maxVy, top) {
            var py = o.y; o.vy = Math.min(o.vy + grav, maxVy); o.x += o.vx; o.y += o.vy;
            o.x = (o.x + 320) % 320; o.ground = false; o.bump = null;
            if (o.y - top < 14 && o.vy < 0) { o.y = 14 + top; o.vy = 0.4; }
            for (var i = 0; i < this.PL.length; i++) { var pl = this.PL[i], inn = o.x >= pl.x0 - 3 && o.x <= pl.x1 + 3;
              if (o.vy >= 0 && py <= pl.y && o.y >= pl.y && inn) { o.y = pl.y; o.vy = 0; o.ground = true; }
              else if (o.vy < 0 && py - top >= pl.y + 8 && o.y - top < pl.y + 8 && inn) { o.y = pl.y + 8 + top; o.vy = 0.5; o.bump = pl; } }
          },
          die: function (water) { var P = this.p; P.dead = 90; P.dvy = water ? 0.3 : -2; P.sink = water; P.bal = 0; SFX.hit(); if (water) this.splashAt(P.x); },
          update: function (inp) {
            var P = this.p, k = inp.k, i, self = this;
            this.timer++;
            for (i = this.pops.length - 1; i >= 0; i--) { this.pops[i].y -= 0.4; if (--this.pops[i].t <= 0) this.pops.splice(i, 1); }
            for (i = this.splash.length - 1; i >= 0; i--) { var s = this.splash[i]; s.x += s.vx; s.y += s.vy; s.vy += 0.12; if (--s.t <= 0) this.splash.splice(i, 1); }
            for (i = this.fx.length - 1; i >= 0; i--) { var q = this.fx[i]; if (q.k === "b") { q.x += q.vx; q.y += q.vy; q.vx *= 0.9; q.vy *= 0.9; } if (--q.t <= 0) this.fx.splice(i, 1); }
            if (this.bolt > 0) this.bolt--; else if (Math.random() < 0.004) { this.bolt = 14; setTimeout(function () { beep(60, 0.35, "sawtooth", 0.025); }, 120); }
            if (this.fish) { if (this.fish.t === 38) this.ripple(this.fish.x); if (++this.fish.t > 40) this.fish = null; }
            if (this.won > 0) { if (++this.won > 120) this.api.win(this.score); return; }
            if (P.dead > 0) { P.dvy += P.sink ? 0 : 0.1; P.y += P.dvy;
              if (--P.dead === 0) {   this.reset(); } return; }
            // hero: A flaps (hold to keep flapping), left/right drift
            if (inp.p.a || (k.a && this.timer % 14 === 0)) { P.vy = Math.max(P.vy - (P.bal === 2 ? 1.5 : 1.15), -2.2); P.fa = 8; beep(420, 0.04, "square", 0.03); }
            var ax = (k.right ? 1 : 0) - (k.left ? 1 : 0); if (ax) P.face = ax;
            if (P.ground) P.vx = ax * 1.0; else { P.vx += ax * 0.05; P.vx *= 0.995; }
            P.vx = Math.max(-1.6, Math.min(1.6, P.vx));
            this.phys(P, P.bal === 2 ? 0.05 : 0.065, 2.2, 22);
            if (P.inv > 0) P.inv--; if (P.fa > 0) P.fa--;
            if (P.y >= 216) { this.die(true); return; }
            var overWater = P.x > 46 && P.x < 274;
            if (overWater && P.y > 197) this.lowT++; else this.lowT = Math.max(0, this.lowT - 3);
            if (this.lowT > 50) { this.fish = { x: P.x, t: 0 }; this.die(true); return; }
            // spawn foes floating in from the top
            if (this.spawned < 6 && --this.spawnT <= 0) {
              this.foes.push({ x: 40 + Math.random() * 240, y: 10, vx: Math.random() - 0.5, vy: 0.5, st: "fly", flapT: 20, pump: 0, fa: 0, seed: Math.random() * 6, ground: false });
              this.spawned++; this.spawnT = 70;
            }
            for (i = this.foes.length - 1; i >= 0; i--) { var e = this.foes[i], gone = false;
              if (e.fa > 0) e.fa--;
              if (e.st === "fly") {
                var target = P.y - 24;
                if (--e.flapT <= 0) { e.vy = Math.max(e.vy - 1.1, -1.7); e.fa = 6;
                  e.flapT = e.y > 184 ? 6 + Math.random() * 6 : e.y > target ? 12 + Math.random() * 14 : 28 + Math.random() * 30; }
                var dx = this.wdx(P.x, e.x);
                if (e.esc > 0) { e.esc--; e.vx += e.escDir * 0.08; }
                else e.vx += (dx > 0 ? 0.022 : -0.022) + (Math.random() - 0.5) * 0.06;
                e.vx = Math.max(-1, Math.min(1, e.vx));
                this.phys(e, 0.045, 1.6, 22);
                // bumped a platform's underside: slide out past the nearer edge instead of grinding under it
                if (e.bump && !(e.esc > 0)) { var bp = e.bump; e.escDir = (e.x - bp.x0 < bp.x1 - e.x) ? -1 : 1; e.esc = 50; }
                if (e.y >= 214) { this.splashAt(e.x); gone = true; }
              } else if (e.st === "chute") {
                e.vy = 0.45; e.vx = Math.sin(this.timer * 0.05 + e.seed) * 0.4;
                this.phys(e, 0, 0.45, 12);
                if (e.ground) { e.st = "pump"; e.pump = 240; }
                else if (e.y >= 214) { this.score += 750; this.pop("+750", e.x, 200); this.splashAt(e.x); gone = true; }
              } else if (e.st === "pump") {
                if (this.timer % 20 === 0) beep(300 + (240 - e.pump) * 2, 0.04, "triangle", 0.03);
                if (--e.pump <= 0) { e.st = "fly"; e.vy = -1.5; e.flapT = 10; }
              }
              var cx = this.wdx(e.x, P.x);
              if (!gone && Math.abs(cx) < 11) {
                if (e.st === "fly" && Math.abs(e.y - P.y) < 20) {
                  if (P.y < e.y - 4) { e.st = "chute"; e.vy = 0; this.score += 500; this.pop("+500", e.x, e.y - 34); this.burst(e.x, e.y - 20, "#ff7ad9"); P.vy = -1.2; SFX.smash(); }
                  else if (e.y < P.y - 4) { if (P.inv === 0) { this.burst(P.x + (P.bal === 2 ? 4 : -4), P.y - 20, P.bal === 2 ? "#ffd23a" : "#ff4040"); P.bal--; P.inv = 60; P.vy = 1; P.vx = cx > 0 ? -1.2 : 1.2; SFX.smash();
                    if (P.bal <= 0) { this.die(false); return; } } }
                  else { P.vx = cx > 0 ? -1.2 : 1.2; e.vx = -P.vx; beep(200, 0.05); }
                } else if (e.st !== "fly" && Math.abs(e.y - P.y) < 14) { this.score += 1000; this.pop("+1000", e.x, e.y - 22); this.burst(e.x, e.y - 8, "#7ad04a"); SFX.pick(); gone = true; }
              }
              if (gone) this.foes.splice(i, 1);
            }
            if (this.spawned === 6 && this.foes.length === 0) { this.won = 1; this.jingled = true; SFX.win(); }
          },
          ball: function (x, cx, cy, col, r) {
            x.fillStyle = col; x.fillRect(cx - r + 1, cy - r, 2 * r - 2, 2 * r); x.fillRect(cx - r, cy - r + 1, 2 * r, 2 * r - 2);
            x.fillRect(cx - 1, cy + r, 2, 1); if (r > 2) { x.fillStyle = "#fff"; x.fillRect(cx - r + 2, cy - r + 2, 2, 2); }
          },
          // a balloon on a wavy string from the hand (hx,hy) up to the knot under the balloon (bx,by)
          balloon: function (x, hx, hy, bx, by, col, r) {
            var top = by + r + 1, n = hy - top, t = this.timer; x.fillStyle = "#c8c8d8";
            for (var j = 0; j <= n; j++) { var f = j / Math.max(1, n); x.fillRect(Math.round(hx + (bx - hx) * f + Math.sin(t * 0.2 + j * 0.9) * 0.8 * Math.sin(f * Math.PI)), hy - j, 1, 1); }
            this.ball(x, bx, by, col, r);
          },
          hero: function (x, px, y, P) {
            var b = Math.round(y), t = this.timer, lag = Math.round(-P.vx * 1.5);
            if (P.bal >= 1) this.balloon(x, px - 3, b - 12, px - 4 + lag + Math.round(Math.sin(t * 0.09) * 1.2), b - 20 + Math.round(Math.sin(t * 0.13) * 0.8 + P.vy * 0.4), "#ff4040", 4);
            if (P.bal >= 2) this.balloon(x, px + 3, b - 12, px + 4 + lag + Math.round(Math.sin(t * 0.09 + 2) * 1.2), b - 20 + Math.round(Math.sin(t * 0.13 + 1) * 0.8 + P.vy * 0.4), "#ffd23a", 4);
            x.fillStyle = "#ffcc99"; x.fillRect(px - 3, b - 12, 6, 4);
            x.fillStyle = "#e03a2f"; x.fillRect(px - 3, b - 13, 6, 2);
            x.fillStyle = "#000"; x.fillRect(px + (P.face > 0 ? 1 : -2), b - 11, 1, 1);
            x.fillStyle = "#3a6cff"; x.fillRect(px - 3, b - 8, 6, 5);
            // flap frames: arms up, level, down
            var ay = P.fa > 4 ? 11 : P.fa > 0 ? 8 : P.ground ? 6 : 7, aw = P.fa > 0 && P.fa <= 4 ? 3 : 2;
            x.fillRect(px - 3 - aw, b - ay, aw, P.fa > 4 ? 4 : 2); x.fillRect(px + 3, b - ay, aw, P.fa > 4 ? 4 : 2);
            x.fillStyle = "#6b3a1e"; x.fillRect(px - 3, b - 3, 2, 3); x.fillRect(px + 1, b - 3, 2, 3);
          },
          foe: function (x, ex, y, e) {
            var b = Math.round(y), t = this.timer, armY = null;
            if (e.st === "fly") this.balloon(x, ex, b - 12, ex + Math.round(Math.sin(t * 0.08 + e.seed) * 1.5 - e.vx), b - 21 + Math.round(Math.sin(t * 0.11 + e.seed) * 0.8 + e.vy * 0.5), "#ff7ad9", 5);
            else if (e.st === "chute") {
              // canopy swings opposite the body's drift, scalloped edge, two shroud lines
              var sw = Math.round(Math.sin(t * 0.05 + e.seed) * 3), cxp = ex - sw;
              x.fillStyle = "#f0f0f0"; x.fillRect(cxp - 5, b - 26, 10, 2); x.fillRect(cxp - 7, b - 24, 14, 3);
              x.fillStyle = "#ff7ad9"; x.fillRect(cxp - 1, b - 26, 2, 5); x.fillRect(cxp - 7, b - 22, 2, 1); x.fillRect(cxp + 5, b - 22, 2, 1);
              x.fillStyle = "#999"; for (var j = 0; j < 9; j++) { var f = j / 8; x.fillRect(Math.round(cxp - 6 + (ex - 3 - cxp + 6) * f), b - 21 + j, 1, 1); x.fillRect(Math.round(cxp + 5 + (ex + 2 - cxp - 5) * f), b - 21 + j, 1, 1); }
              armY = 12;
            } else {
              // pumping: handle strokes, balloon inflates and rises on its stem
              var pr = (240 - e.pump) / 240, r = Math.max(1, Math.round(pr * 5)), stroke = t % 16 < 8, ry = b - 4 - Math.round(pr * 14) - r;
              x.fillStyle = "#c8c8d8"; x.fillRect(ex + 7, ry + r + 1, 1, b - 3 - (ry + r + 1));
              this.ball(x, ex + 7 + Math.round(Math.sin(t * 0.3) * pr), ry, "#ff7ad9", r);
              x.fillStyle = "#888"; x.fillRect(ex + 4, b - 6, 3, 6); x.fillStyle = "#bbb"; x.fillRect(ex + 3, b - (stroke ? 10 : 7), 5, 1); x.fillRect(ex + 5, b - (stroke ? 10 : 7), 1, stroke ? 4 : 1);
              armY = stroke ? 10 : 7;
            }
            x.fillStyle = "#7ad04a"; x.fillRect(ex - 3, b - 12, 6, 9);
            x.fillStyle = "#ffd23a"; x.fillRect(ex + (e.vx >= 0 ? 3 : -5), b - 10, 2, 2);
            x.fillStyle = "#fff"; x.fillRect(ex - 1, b - 11, 2, 2); x.fillStyle = "#000"; x.fillRect(ex, b - 11, 1, 1);
            x.fillStyle = "#4a9a2a";
            if (armY !== null) { x.fillRect(ex - 6, b - 11, 3, 2); x.fillRect(ex + 3, b - armY, 3, 2); }
            else { var ey2 = e.fa > 3 ? 12 : e.fa > 0 ? 9 : 7, eh = e.fa > 3 ? 3 : 2; x.fillRect(ex - 6, b - ey2, 3, eh); x.fillRect(ex + 3, b - ey2, 3, eh); }
            x.fillStyle = "#ffa030"; x.fillRect(ex - 3, b - 3, 2, 3); x.fillRect(ex + 1, b - 3, 2, 3);
          },
          wrap: function (fn, xx) { fn(xx); if (xx < 16) fn(xx + 320); if (xx > 304) fn(xx - 320); },
          draw: function (x) {
            var i, self = this, t = this.timer, P = this.p;
            var fl = this.bolt > 0 && (this.bolt > 10 || (this.bolt > 4 && this.bolt < 7));
            x.fillStyle = fl ? "#0e1636" : "#060a1e"; x.fillRect(0, 0, 320, 240);
            for (i = 0; i < this.stars.length; i++) { var s = this.stars[i], ph = (t + i * 13) % 90;
              if (ph < 8) { x.fillStyle = "#fff"; x.fillRect(s.x, s.y, 1, 1); if (ph > 2 && ph < 6) { x.fillStyle = "#8a9ad0"; x.fillRect(s.x - 1, s.y, 3, 1); x.fillRect(s.x, s.y - 1, 1, 3); x.fillStyle = "#fff"; x.fillRect(s.x, s.y, 1, 1); } }
              else { x.fillStyle = s.b ? "#3a4a7a" : "#8a9ad0"; x.fillRect(s.x, s.y, 1, 1); } }
            x.fillStyle = "#f4ecc0"; x.fillRect(262, 22, 12, 14); x.fillRect(260, 24, 16, 10); x.fillStyle = fl ? "#0e1636" : "#060a1e"; x.fillRect(267, 21, 10, 12);
            // storm cloud with a lightning flicker
            var cc = fl ? "#8890c0" : "#1c2448", cy0 = 44, cx0 = 40 + Math.round(Math.sin(t * 0.004) * 6);
            x.fillStyle = cc; x.fillRect(cx0, cy0, 40, 8); x.fillRect(cx0 + 6, cy0 - 5, 16, 6); x.fillRect(cx0 + 20, cy0 - 8, 12, 9); x.fillRect(cx0 + 4, cy0 + 8, 30, 3);
            x.fillStyle = fl ? "#c0c8f0" : "#2a3460"; x.fillRect(cx0 + 8, cy0 - 4, 10, 1); x.fillRect(cx0 + 22, cy0 - 7, 8, 1);
            if (fl) { x.fillStyle = "#fff6a0"; var lx = cx0 + 18; x.fillRect(lx, cy0 + 11, 2, 5); x.fillRect(lx - 3, cy0 + 15, 4, 2); x.fillRect(lx - 3, cy0 + 16, 2, 6); x.fillRect(lx - 6, cy0 + 21, 4, 2); x.fillRect(lx - 6, cy0 + 22, 2, 5); }
            for (i = 0; i < this.PL.length; i++) { var pl = this.PL[i], w = pl.x1 - pl.x0;
              x.fillStyle = "#6b4426"; x.fillRect(pl.x0, pl.y, w, 6); x.fillRect(pl.x0 + 4, pl.y + 6, w - 8, 3);
              x.fillStyle = "#3fbf4a"; x.fillRect(pl.x0, pl.y, w, 3);
              x.fillStyle = "#8ef07a"; for (var g = pl.x0 + 3; g < pl.x1; g += 7) x.fillRect(g, pl.y - 1, 1, 1); }
            if (this.lowT > 15 && !P.dead) { x.fillStyle = "#2a4a5a"; var fx = P.x + Math.sin(t * 0.2) * 8; x.fillRect(fx - 1, 210, 3, 4); x.fillRect(fx - 3, 212, 7, 2); }
            if (this.fish) { var ft = this.fish.t, fy = Math.round(214 - Math.sin(ft / 40 * Math.PI) * 30), F = this.fish.x | 0, o = ft < 18 ? 5 : ft < 24 ? 2 : 0, tl = ft % 8 < 4 ? 1 : -1;
              // body arcs up and back down, jaws snap shut at the top, tail flicks
              x.fillStyle = "#4a7a8a"; x.fillRect(F - 6, fy + 2, 12, 14); x.fillRect(F - 5, fy - 3 - o, 10, 3); x.fillRect(F - 4, fy + 16, 8, 3);
              x.fillRect(F - 6 + tl * 2, fy + 19, 4, 3); x.fillRect(F + 2 + tl * 2, fy + 19, 4, 3);
              x.fillStyle = "#6aa0b0"; x.fillRect(F - 3, fy + 4, 6, 10);
              x.fillStyle = "#c03030"; x.fillRect(F - 5, fy - o, 10, o + 2);
              x.fillStyle = "#fff"; x.fillRect(F - 4, fy - o, 1, 1); x.fillRect(F - 1, fy - o, 1, 1); x.fillRect(F + 2, fy - o, 1, 1); x.fillRect(F - 4, fy + 1, 2, 2); x.fillRect(F + 2, fy + 1, 2, 2);
              x.fillStyle = "#000"; x.fillRect(F - 4, fy + 2, 1, 1); x.fillRect(F + 3, fy + 2, 1, 1); }
            for (i = 0; i < this.foes.length; i++) (function (e) { self.wrap(function (xx) { self.foe(x, xx | 0, e.y, e); }, e.x); })(this.foes[i]);
            if (!(P.inv > 0 && t % 6 < 3) && !(P.dead && P.sink && P.y > 214)) this.wrap(function (xx) { self.hero(x, xx | 0, P.y, P); }, P.x);
            x.fillStyle = "#0a1838"; x.fillRect(0, 214, 320, 26);
            x.fillStyle = "#1e3a6a"; for (i = 0; i < 320; i += 16) x.fillRect((i + (t >> 2)) % 320, 216 + ((i >> 4) % 2) * 6, 7, 1);
            // shimmer: a bright surface line with glints that drift and blink
            x.fillStyle = "#2a5a9a"; for (i = 0; i < 320; i += 4) x.fillRect(i, 214 + (Math.sin(i * 0.15 + t * 0.06) > 0.6 ? 1 : 0), 3, 1);
            for (i = 0; i < 9; i++) { var gx = (i * 37 + Math.floor(t * (0.15 + i * 0.03))) % 320, gp = (t + i * 23) % 60;
              if (gp < 30) { x.fillStyle = gp < 10 || gp > 20 ? "#4a7ac0" : "#bfe0ff"; x.fillRect(gx, 219 + (i % 4) * 5, gp < 10 || gp > 20 ? 2 : 4, 1); } }
            for (i = 0; i < this.fx.length; i++) { var q = this.fx[i];
              if (q.k === "r") { var rw = Math.round((36 - q.t) * 0.7) + 3; x.fillStyle = q.t > 18 ? "#bfe0ff" : "#4a7ac0"; x.fillRect((q.x - rw) | 0, 214, 3, 1); x.fillRect((q.x + rw - 3) | 0, 214, 3, 1); x.fillRect((q.x - rw * 0.6) | 0, 217, 2, 1); x.fillRect((q.x + rw * 0.6 - 2) | 0, 217, 2, 1); }
              else { x.fillStyle = q.t > 10 ? "#fff" : q.c; var sz = q.t > 8 ? 2 : 1; x.fillRect(q.x | 0, q.y | 0, sz, sz); } }
            x.fillStyle = "#8ac0ff"; for (i = 0; i < this.splash.length; i++) x.fillRect(this.splash[i].x | 0, this.splash[i].y | 0, 2, 2);
            text("SCORE " + this.score, 8, 4, 1, "#ffe14d");
            text("FOES " + (6 - this.spawned + this.foes.length), 136, 4, 1, "#ff7ad9");
            for (i = 0; i < this.pops.length; i++) text(this.pops[i].s, this.pops[i].x, this.pops[i].y | 0, 1, "#fff", true);
          }
        };
