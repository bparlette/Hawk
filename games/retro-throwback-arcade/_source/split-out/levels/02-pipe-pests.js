/* Retro Throwback Arcade - Level 2: PIPE PESTS
   Loaded by ../index.html and evaluated inside the player's scope.
   Must define `var pipePests = {...}` (title, goal, init(api), update(input), draw(ctx)). */

        /* ================= LEVEL 2 — PIPE PESTS ================= */
        /* Bump pests from below, kick them while flipped. Horizontal wrap. */
        var pipePests = {
          title: "PIPE PESTS",
          goal: "BUMP PESTS FROM BELOW, THEN KICK THEM.",
          api: null,
          init: function (api) {
            this.api = api;
            this.S = [
              { y: 224, x0: 0, x1: 320, floor: true },
              { y: 176, x0: 0, x1: 112 }, { y: 176, x0: 208, x1: 320 },
              { y: 128, x0: 72, x1: 248 }, // one wide middle shelf: pests walk it, then drop to the side ledges
              { y: 80, x0: 0, x1: 128 }, { y: 80, x0: 192, x1: 320 }
            ];
            this.pow = { x0: 150, x1: 170, y: 186, uses: 3 };
            this.lives = 3; this.score = 0; this.kicked = 0; this.spawned = 0; this.won = 0; this.jingled = false;
            this.timer = 0; this.spawnT = 90; this.pests = []; this.pops = []; this.bumps = []; this.fly = []; this.shake = 0; this.parts = [];
            this.puffs = []; this.coins = []; this.sparks = []; this.powT = 0;
            this.reset();
          },
          reset: function () { this.p = { x: 60, y: 224, vy: 0, on: true, face: 1, dead: 0, inv: 90, walk: 0 }; },
          wd: function (a, b) { var d = a - b; if (d > 160) d -= 320; if (d < -160) d += 320; return d; },
          sup: function (x, y, hero) {
            for (var i = 0; i < this.S.length; i++) { var s = this.S[i]; if (s.y === y && x >= s.x0 - 3 && x <= s.x1 + 3) return true; }
            var w = this.pow; return !!hero && w.uses > 0 && y === w.y && x >= w.x0 - 3 && x <= w.x1 + 3;
          },
          land: function (o, py, hero) {
            var c = this.S.slice(); if (hero && this.pow.uses > 0) c.push(this.pow);
            for (var i = 0; i < c.length; i++) { var s = c[i];
              if (py <= s.y && o.y >= s.y && o.x >= s.x0 - 3 && o.x <= s.x1 + 3) { o.y = s.y; o.vy = 0; return true; } }
            return false;
          },
          pop: function (s, x, y) { this.pops.push({ s: s, x: x, y: y, t: 45 }); },
          flip: function (e) { e.flip = e.mad ? 300 : 360; e.hop = 10; beep(660, 0.06); },
          puff: function (x, y) { this.puffs.push({ x: x, y: y, t: 18 }); },
          spark: function (x, y, n) { for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; this.sparks.push({ x: x, y: y, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4 - 0.5, t: 20 }); } },
          bump: function (s, x) {
            this.bumps.push({ s: s, x: x, t: 12 }); beep(200, 0.06, "square", 0.06);
            for (var i = 0; i < this.pests.length; i++) { var e = this.pests[i];
              if (e.on && e.y === s.y && e.flip === 0 && Math.abs(this.wd(e.x, x)) < 18) this.flip(e); }
            for (i = 0; i < this.coins.length; i++) { var c = this.coins[i]; // a coin bumped from below is collected
              if (c.on && c.y === s.y && Math.abs(this.wd(c.x, x)) < 18) this.getCoin(i--); }
          },
          getCoin: function (i) {
            var c = this.coins.splice(i, 1)[0]; this.score += 200; this.spark(c.x, c.y - 6, 8);
            this.pop("+200", c.x - 12, c.y - 22); SFX.pick();
          },
          powHit: function () {
            this.pow.uses--; this.shake = 20; this.powT = 14; beep(90, 0.25, "square", 0.1);
            for (var i = 0; i < this.pests.length; i++) { var e = this.pests[i]; if (e.on && e.y === 224 && e.flip === 0) this.flip(e); }
          },
          update: function (inp) {
            var P = this.p, i, e, s;
            this.timer++; if (this.shake > 0) this.shake--;
            for (i = this.pops.length - 1; i >= 0; i--) { this.pops[i].y -= 0.4; if (--this.pops[i].t <= 0) this.pops.splice(i, 1); }
            for (i = this.bumps.length - 1; i >= 0; i--) if (--this.bumps[i].t <= 0) this.bumps.splice(i, 1);
            for (i = this.fly.length - 1; i >= 0; i--) { var f = this.fly[i]; f.x += f.vx; f.vy += 0.2; f.y += f.vy; f.t++; if (f.y > H + 20) this.fly.splice(i, 1); }
            for (i = this.puffs.length - 1; i >= 0; i--) if (--this.puffs[i].t <= 0) this.puffs.splice(i, 1);
            for (i = this.sparks.length - 1; i >= 0; i--) { var sp = this.sparks[i]; sp.x += sp.vx; sp.y += sp.vy; sp.vy += 0.05; if (--sp.t <= 0) this.sparks.splice(i, 1); }
            if (this.powT > 0) this.powT--;
            if (this.won > 0) { if (++this.won > 120) this.api.win(this.score); return; }
            if (P.dead > 0) {
              if (--P.dead === 0) {   this.reset(); }
              return;
            }
            // spawning: 1 every ~3.5 s, max 3 on screen, 8 total
            if (this.spawned < 8 && --this.spawnT <= 0 && this.pests.length < 3) {
              var side = this.spawned % 2;
              this.pests.push({ x: side ? 300 : 20, y: 80, vy: 0, dir: side ? -1 : 1, spd: 0.6 + this.spawned * 0.03, on: true, flip: 0, hop: 0, walk: 0, mad: 0 });
              this.puff(side ? 292 : 28, 74);
              this.spawned++; this.spawnT = 180; beep(330, 0.06, "square", 0.05);
            }
            // coins: pop out of a kicked pest, settle, twinkle; walk into one (or bump it) for +200
            for (i = this.coins.length - 1; i >= 0; i--) {
              var c = this.coins[i]; c.t--;
              if (!c.on) { var cy = c.y; c.vy = Math.min(c.vy + 0.2, 4); c.y += c.vy; if (this.land(c, cy)) c.on = true; }
              if (c.t <= 0 || c.y > H + 10) { this.coins.splice(i, 1); continue; }
              if (P.dead === 0 && Math.abs(this.wd(c.x, P.x)) < 10 && Math.abs(c.y - P.y) < 16) this.getCoin(i);
            }
            // hero
            if (P.inv > 0) P.inv--;
            var dx = (inp.k.right ? 1 : 0) - (inp.k.left ? 1 : 0);
            if (dx) { P.face = dx; P.walk++; }
            P.x = (P.x + dx * 1.6 + 320) % 320;
            if (inp.p.a && P.on) { P.vy = -5.2; P.on = false; SFX.jump(); }
            if (P.on && !this.sup(P.x, P.y, true)) { P.on = false; P.vy = 0; }
            if (!P.on) {
              var py = P.y; P.vy = Math.min(P.vy + 0.24, 5); P.y += P.vy;
              if (P.vy < 0) {
                var head = P.y - 16, ph = py - 16, w = this.pow;
                if (w.uses > 0 && ph >= w.y + 14 && head < w.y + 14 && P.x >= w.x0 - 3 && P.x <= w.x1 + 3) { P.y = w.y + 30; P.vy = 0.6; this.powHit(); }
                else for (i = 1; i < this.S.length; i++) { s = this.S[i];
                  if (ph >= s.y + 6 && head < s.y + 6 && P.x >= s.x0 - 3 && P.x <= s.x1 + 3) { P.y = s.y + 22; P.vy = 0.6; this.bump(s, P.x); break; } }
              } else if (this.land(P, py, true)) P.on = true;
            }
            // pests
            for (i = this.pests.length - 1; i >= 0; i--) {
              e = this.pests[i];
              if (e.hop > 0) e.hop--;
              if (e.flip > 0) {
                if (--e.flip === 0) { e.spd = Math.min(e.spd * 1.5, 1.5); e.mad++; e.hop = 8; beep(440, 0.05, "sawtooth", 0.05); }
              } else if (e.on) {
                e.x = (e.x + e.dir * e.spd + 320) % 320; e.walk++;
                if (e.y === 224 && ((e.dir > 0 && e.x >= 312) || (e.dir < 0 && e.x <= 8))) {
                  this.puff(e.dir > 0 ? 306 : 14, 214);
                  e.x = e.dir > 0 ? 20 : 300; e.y = 80; // into the bottom pipe, out the top
                  this.puff(e.dir > 0 ? 28 : 292, 74);
                } else if (!this.sup(e.x, e.y)) { e.on = false; e.vy = 0; }
              } else {
                var ey = e.y; e.vy = Math.min(e.vy + 0.2, 4); e.y += e.vy;
                if (this.land(e, ey)) e.on = true;
                else if (e.y > H + 10) { e.y = 80; e.x = e.dir > 0 ? 20 : 300; e.vy = 0; e.on = true; } // safety net
              }
              var ddx = Math.abs(this.wd(e.x, P.x)), ddy = Math.abs(e.y - P.y);
              if (e.flip > 0 && ddx < 12 && ddy < 14) { // kick: generous box, never harmful
                this.pests.splice(i, 1); this.kicked++; this.score += 800; SFX.smash();
                var kd = this.wd(e.x, P.x) >= 0 ? 1 : -1;
                this.fly.push({ x: e.x, y: e.y, vx: kd * 2.2, vy: -3.6, t: 0, mad: e.mad }); this.shake = Math.max(this.shake, 8);
                for (var sk = 0; sk < 12; sk++) { var sa2 = sk / 12 * 6.283, sv = 1.2 + sk % 3 * 0.7; this.parts.push({ x: e.x, y: e.y - 6, vx: Math.cos(sa2) * sv, vy: Math.sin(sa2) * sv - 1, t: 24, c: sk % 2 ? "#ffe14d" : "#ff7a3a" }); }
                this.pop("+800", e.x - 12, e.y - 24);
                this.coins.push({ x: e.x, y: e.y - 2, vy: -3, on: false, t: 420 });
                if (this.kicked >= 8) {
                  this.won = 1; this.jingled = true; this.score += this.lives * 500;
                  [659, 784, 988, 1319, 988, 1319].forEach(function (fq, n) {
                    setTimeout(function () { beep(fq, n === 5 ? 0.35 : 0.1); }, n * 110);
                  });
                }
              } else if (!this.won && e.flip === 0 && ddx < 8 && ddy < 10 && P.inv === 0) { P.dead = 90; SFX.hit(); break; } // touch: tight box
            }
          },
          draw: function (x) {
            var i, e, s, b, tx, off, t = this.timer;
            // sewer backdrop: dark gradient, faint brick wall, background pipes with highlights, slow animated drips
            var bg2 = x.createLinearGradient(0, 0, 0, H); bg2.addColorStop(0, "#070b18"); bg2.addColorStop(1, "#1a1030");
            x.fillStyle = bg2; x.fillRect(0, 0, W, H);
            x.fillStyle = "#121730"; for (var by2 = 0; by2 < 224; by2 += 10) for (var bx2 = (by2 / 10 % 2) * 10 - 10; bx2 < W; bx2 += 20) x.fillRect(bx2 + 1, by2 + 1, 18, 8);
            for (var pi2 = 0; pi2 < 5; pi2++) { var pxb = 28 + pi2 * 66; x.fillStyle = "#0f3a34"; x.fillRect(pxb, 0, 10, 224); x.fillStyle = "#1d6b5c"; x.fillRect(pxb + 2, 0, 2, 224); x.fillStyle = "#082420"; x.fillRect(pxb + 8, 0, 2, 224);
              x.fillStyle = "#16524a"; for (var jy = 30 + pi2 * 13; jy < 224; jy += 70) x.fillRect(pxb - 2, jy, 14, 4);
              var dy2 = (t * 0.6 + pi2 * 47) % 230; x.fillStyle = "#5fb8c8"; x.fillRect(pxb + 5, dy2, 1, 3); }
            x.save(); if (this.shake) { var sa = Math.ceil(this.shake / 6); x.translate(t % 4 < 2 ? sa : -sa, t % 2 ? sa + 1 : -sa - 1); }
            for (i = 1; i < this.S.length; i++) { s = this.S[i];
              for (tx = s.x0; tx < s.x1; tx += 8) {
                off = 0;
                for (var k = 0; k < this.bumps.length; k++) { b = this.bumps[k];
                  if (b.s === s && Math.abs(tx + 4 - b.x) < 14) off = -Math.round(Math.sin(b.t / 12 * Math.PI) * 4); }
                x.fillStyle = off < -1 ? "#f09a6a" : "#c8643c"; x.fillRect(tx, s.y + off, 8, 6);
                x.fillStyle = "#7a3218"; x.fillRect(tx + 7, s.y + off, 1, 6); x.fillRect(tx, s.y + off + 5, 8, 1);
              } }
            x.fillStyle = "#c8643c"; x.fillRect(0, 224, W, 16);
            x.fillStyle = "#7a3218"; for (tx = 0; tx < W; tx += 16) { x.fillRect(tx, 224, 1, 8); x.fillRect(tx + 8, 232, 1, 8); } x.fillRect(0, 231, W, 1);
            var w = this.pow;
            if (w.uses > 0 || this.powT > 0) { // squashes and jitters when hit
              var pq = this.powT > 0 ? Math.round(Math.sin(this.powT / 14 * Math.PI) * 4) : 0, pj = this.powT > 0 ? (t % 2 ? 1 : -1) : 0;
              var ph = 14 - pq - (3 - w.uses) * 2, pw0 = w.x0 + pj;
              x.fillStyle = this.powT > 8 ? "#9cc0ff" : "#2a64d8"; x.fillRect(pw0, w.y + 14 - ph, 20, ph);
              x.strokeStyle = "#9cc0ff"; x.lineWidth = 1; x.strokeRect(pw0 + 0.5, w.y + 14.5 - ph, 19, ph - 1);
              if (ph >= 9) text("POW", pw0 + 1, w.y + 14 - ph + Math.floor((ph - 7) / 2), 1, "#fff"); }
            for (i = 0; i < this.pests.length; i++) {
              e = this.pests[i]; var px = Math.round(e.x), py = Math.round(e.y - (e.hop ? Math.sin(e.hop / 10 * Math.PI) * 6 : 0));
              var body = e.mad > 1 ? "#c8102e" : e.mad ? "#ff3b30" : "#9a4dff"; // red once it has recovered
              if (e.flip > 0) {
                // on its back, four legs flailing; flashes white in its last second
                var warn = e.flip < 60 && t % (e.flip < 25 ? 4 : 8) < (e.flip < 25 ? 2 : 4);
                x.fillStyle = "#14061f"; x.fillRect(px - 7, py - 7, 14, 8); x.fillRect(px - 5, py - 3, 10, 4); x.fillStyle = warn ? "#fff" : body; x.fillRect(px - 6, py - 6, 12, 6); x.fillRect(px - 4, py - 2, 8, 2);
                x.fillStyle = "#ffd9a0"; var fl = (t >> 2) % 2;
                x.fillRect(px - 6, py - 9 - fl * 2, 2, 3 + fl); x.fillRect(px - 2, py - 10 + fl * 2, 2, 4 - fl);
                x.fillRect(px + 1, py - 9 - fl * 2, 2, 3 + fl); x.fillRect(px + 5, py - 10 + fl * 2, 2, 4 - fl);
                x.fillStyle = "#000"; x.fillRect(px + e.dir * 4 - 1, py - 4, 2, 2);
              } else {
                // walk: 2 frames, body bobs a pixel, antennae sway, legs stride
                var lg = (e.walk >> 3) % 2, bob = e.on ? lg : 0, d = e.dir;
                x.fillStyle = "#14061f"; x.fillRect(px - 7, py - 10 + bob, 14, 8); x.fillRect(px - 5, py - 12 + bob, 10, 3); x.fillStyle = body; x.fillRect(px - 6, py - 9 + bob, 12, 6); x.fillRect(px - 4, py - 11 + bob, 8, 2); x.fillStyle = "rgba(255,255,255,0.35)"; x.fillRect(px - 4, py - 10 + bob, 5, 1); x.fillStyle = "rgba(0,0,0,0.3)"; x.fillRect(px - 6, py - 5 + bob, 12, 2); x.fillStyle = body;
                x.fillRect(px + d * 2 - 1 + (lg ? d : 0), py - 14 + bob, 1, 3); x.fillRect(px + d * 5 - 1 + (lg ? 0 : d), py - 14 + bob, 1, 3);
                x.fillStyle = "#ffd9a0"; x.fillRect(px + d * 6 - 2, py - 8 + bob, 4, 4);
                x.fillStyle = "#000"; x.fillRect(px + d * 6 - (d > 0 ? 0 : 1), py - 7 + bob, 1, 2);
                x.fillStyle = "#ffd9a0";
                if (lg) { x.fillRect(px - 6, py - 3, 2, 3); x.fillRect(px - 1, py - 3, 2, 2); x.fillRect(px + 4, py - 3, 2, 3); }
                else { x.fillRect(px - 4, py - 3, 2, 2); x.fillRect(px + 1, py - 3, 2, 3); x.fillRect(px + 2, py - 3, 2, 2); }
              }
            }
            // kicked pests: tumble away in an arc, legs up
            for (i = 0; i < this.fly.length; i++) { var fy = this.fly[i];
              x.save(); x.translate(Math.round(fy.x), Math.round(fy.y) - 4); x.rotate(Math.floor(fy.t / 4) * Math.PI / 2);
              x.fillStyle = fy.mad ? "#ff3b30" : "#9a4dff"; x.fillRect(-6, -3, 12, 6);
              x.fillStyle = "#ffd9a0"; x.fillRect(-5, -6, 2, 3); x.fillRect(-1, -7, 2, 4); x.fillRect(3, -6, 2, 3);
              x.restore(); }
            // coins: spin (width cycles) with a twinkle
            for (i = 0; i < this.coins.length; i++) { var cn = this.coins[i];
              if (cn.t < 90 && t % 6 < 3) continue;
              var cx = Math.round(cn.x), cyy = Math.round(cn.y), cw = [6, 4, 2, 4][(t >> 3) % 4];
              x.fillStyle = "#ffe14d"; x.fillRect(cx - cw / 2, cyy - 11, cw, 10);
              x.fillStyle = "#c9a227"; if (cw > 2) x.fillRect(cx - cw / 2 + 1, cyy - 9, 1, 6);
              var tw = (t + i * 17) % 40;
              if (tw < 8) { x.fillStyle = "#fff"; var gx = cx + 3, gy = cyy - 12, gr = tw < 4 ? 1 : 2;
                x.fillRect(gx - gr, gy, gr * 2 + 1, 1); x.fillRect(gx, gy - gr, 1, gr * 2 + 1); } }
            x.fillStyle = "#2fb84a"; x.fillRect(0, 52, 26, 20); x.fillRect(294, 52, 26, 20); x.fillRect(0, 206, 22, 18); x.fillRect(298, 206, 22, 18);
            x.fillStyle = "#5ee07a"; x.fillRect(22, 48, 8, 28); x.fillRect(290, 48, 8, 28); x.fillRect(18, 202, 8, 22); x.fillRect(294, 202, 8, 22);
            // pipe puffs: a ring of smoke that swells and thins
            for (i = 0; i < this.puffs.length; i++) { var pf = this.puffs[i], pr = (18 - pf.t) / 2 + 2;
              x.fillStyle = pf.t > 9 ? "#ddd" : "#888";
              for (var pa = 0; pa < 6; pa++) { var an = pa / 6 * Math.PI * 2 + pf.t * 0.1;
                x.fillRect(Math.round(pf.x + Math.cos(an) * pr) - 1, Math.round(pf.y + Math.sin(an) * pr * 0.7) - 1, pf.t > 6 ? 3 : 2, pf.t > 6 ? 3 : 2); } }
            for (i = 0; i < this.sparks.length; i++) { var sk = this.sparks[i];
              x.fillStyle = sk.t % 4 < 2 ? "#fff" : "#ffe14d"; x.fillRect(Math.round(sk.x), Math.round(sk.y), sk.t > 10 ? 2 : 1, sk.t > 10 ? 2 : 1); }
            var P = this.p;
            if (!(P.inv > 0 && t % 6 < 3)) {
              var hx = Math.round(P.x), hy = Math.round(P.y), dead = P.dead > 0, wl = P.on ? (P.walk >> 2) % 2 : 0;
              x.fillStyle = dead ? "#777" : "#e03a2f"; x.fillRect(hx - 5, hy - 16, 10, 3); x.fillRect(hx - 5, hy - 9, 10, 3);
              x.fillStyle = dead ? "#999" : "#ffcf99"; x.fillRect(hx - 4, hy - 13, 8, 4);
              x.fillStyle = "#000"; x.fillRect(hx + (P.face > 0 ? 1 : -3), hy - 12, 2, 2);
              x.fillStyle = dead ? "#555" : "#2a64d8"; x.fillRect(hx - 5, hy - 6, 10, 3);
              x.fillRect(hx - 5, hy - 3 - wl, 4, 3); x.fillRect(hx + 1, hy - 3 - (1 - wl), 4, 3);
            }
            for (var pq2 = this.parts.length - 1; pq2 >= 0; pq2--) { var sp2 = this.parts[pq2]; sp2.x += sp2.vx; sp2.y += sp2.vy; sp2.vy += 0.14; x.fillStyle = sp2.t > 18 ? "#fff" : sp2.c; x.fillRect(sp2.x | 0, sp2.y | 0, sp2.t > 10 ? 2 : 1, sp2.t > 10 ? 2 : 1); if (--sp2.t <= 0) this.parts.splice(pq2, 1); }
            x.restore();
            for (i = 0; i < this.pops.length; i++) { var po = this.pops[i]; text(po.s, Math.round(po.x), Math.round(po.y), 1, po.t % 8 < 4 ? "#fff" : "#ffe14d"); }
            text("LIVES INF", 6, 6, 1, "#fff");
            text("PESTS " + this.kicked + "/8", 120, 6, 1, "#5ee07a");
            text("SCORE " + this.score, 220, 6, 1, "#ffe14d");
            text("POW " + w.uses, 6, 18, 1, "#9cc0ff");
          }
        };
