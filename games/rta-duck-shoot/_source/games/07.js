        var duckShoot = {
          title: "DUCK SHOOT",
          goal: "AIM WITH THE STICK. A FIRES. HIT 7 OF 10.",
          api: null,
          init: function (api) {
            this.api = api; this.score = 0; this.hits = 0; this.spawned = 0; this.hist = []; this.ducks = [];
            this.cx = 160; this.cy = 110; this.parts = []; this.pops = []; this.ammo = 3; this.timer = 0;
            this.state = "wait"; this.wt = 70; this.shk = 0; this.flash = 0; this.won = 0; this.failT = 0; this.jingled = false;
            this.dog = { t: 0, k: "", x: 160 }; this.cool = 0;
          },
          spawn: function () {
            var sp = 1.6 + this.spawned * 0.24, dir = Math.random() < 0.5 ? -1 : 1;
            this.ducks = [{ x: 50 + Math.random() * 220, y: 196, vx: dir * sp, vy: -(1.5 + Math.random() * 0.7), life: 0, dead: 0, fall: 0, spin: 0, away: 0 }];
            this.ammo = 3; this.spawned++; this.state = "fly"; beep(700, 0.05, "square", 0.04);
          },
          feathers: function (x, y, n) {
            for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = 0.6 + Math.random() * 1.6; this.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, t: 30 + (i % 5) * 4, c: i % 3 ? "#f4e8d0" : "#7a4a1e" }); }
          },
          endDuck: function (hit, x) {
            this.hist.push(hit); this.state = "dog"; this.dog = { t: 80, k: hit ? "hit" : "miss", x: Math.max(30, Math.min(290, x)) }; this.ducks = [];
          },
          update: function (inp) {
            var k = inp.k, i, d;
            this.timer++; if (this.shk > 0) this.shk--; if (this.flash > 0) this.flash--; if (this.cool > 0) this.cool--;
            for (i = this.pops.length - 1; i >= 0; i--) { this.pops[i].y -= 0.5; if (--this.pops[i].t <= 0) this.pops.splice(i, 1); }
            for (i = this.parts.length - 1; i >= 0; i--) { var q = this.parts[i]; q.x += q.vx; q.y += q.vy; q.vy += 0.07; q.vx *= 0.98; if (--q.t <= 0) this.parts.splice(i, 1); }
            if (this.won > 0) { if (++this.won > 150) this.api.win(this.score); return; }
            if (this.failT > 0) { if (--this.failT === 0) this.api.lose(); return; }
            // crosshair: stick / keys, with a little acceleration-free speed
            var sp = 2.9, mx = (k.right ? 1 : 0) - (k.left ? 1 : 0), my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
            if (mx && my) { mx *= 0.72; my *= 0.72; }
            this.cx = Math.max(6, Math.min(314, this.cx + mx * sp)); this.cy = Math.max(6, Math.min(196, this.cy + my * sp));
            var fire = inp.p.a || inp.p.b;
            if (this.state === "wait") { if (--this.wt <= 0) { if (this.spawned >= 10) { this.finish(); } else this.spawn(); } return; }
            if (this.state === "dog") {
              if (--this.dog.t <= 0) { this.state = "wait"; this.wt = 40; } return;
            }
            d = this.ducks[0]; if (!d) { this.state = "wait"; this.wt = 20; return; }
            if (!d.dead) {
              d.life++;
              if (!d.away) {
                d.vy += (Math.random() - 0.5) * 0.12; if (d.vy > 1.3) d.vy = 1.3; if (d.vy < -2.1) d.vy = -2.1;
                d.x += d.vx; d.y += d.vy;
                if (d.x < 14) { d.x = 14; d.vx = Math.abs(d.vx); } if (d.x > 306) { d.x = 306; d.vx = -Math.abs(d.vx); }
                if (d.y < 24) { d.y = 24; d.vy = Math.abs(d.vy) * 0.7; }
                if (d.y > 170 && d.vy > 0) d.vy = -Math.abs(d.vy) * 0.9;
                if (d.life > 330 || (this.ammo === 0 && d.life > 20 && !d.away && this.cool === 0)) { d.away = 1; d.vy = -3.2; d.vx *= 0.5; beep(300, 0.2, "sawtooth", 0.04); }
              } else { d.y += d.vy; d.x += d.vx; if (d.y < -20) { this.endDuck(false, d.x); return; } }
              if (fire && this.ammo > 0 && !d.away) {
                this.ammo--; this.flash = 4; this.shk = 3; this.cool = 20; beep(180, 0.1, "sawtooth", 0.08); beep(90, 0.08, "square", 0.07);
                if (Math.abs(this.cx - d.x) < 14 && Math.abs(this.cy - d.y) < 12) {
                  d.dead = 1; d.fall = 0; this.hits++; var pts = 500 + Math.max(0, 300 - d.life) + this.ammo * 100;
                  this.score += pts; this.pop("+" + pts, d.x, d.y - 14); this.feathers(d.x, d.y, 22); this.shk = 7; SFX.smash();
                }
              }
            } else {
              d.fall += 0.26; d.y += d.fall; d.spin += 0.3; d.x += d.vx * 0.15;
              if (d.y >= 196) { this.endDuck(true, d.x); SFX.pick(); }
            }
          },
          pop: function (s, x, y) { this.pops.push({ s: s, x: x, y: y, t: 50 }); },
          finish: function () {
            if (this.hits >= 7) { this.won = 1; this.jingled = true; this.score += 1000; this.pop("+1000 PERFECT AIM", 160, 100); SFX.win(); }
            else { this.failT = 100; this.pop("ONLY " + this.hits + "/10 - TRY AGAIN", 160, 100); beep(200, 0.4, "sawtooth", 0.08); }
          },
          duck: function (x, d) {
            var px = Math.round(d.x), py = Math.round(d.y), f = d.vx >= 0 ? 1 : -1, wf = d.dead ? 3 : [0, 1, 2, 1][Math.floor(d.life / 4) % 4];
            x.save(); x.translate(px, py); if (d.dead) x.rotate(Math.sin(d.spin) * 0.5); x.scale(f, 1);
            x.fillStyle = "rgba(0,0,0,0.2)"; x.fillRect(-9, 12 + (d.dead ? 0 : 6), 18, 2);
            x.fillStyle = "#15100a"; x.fillRect(-12, -7, 24, 15); x.fillRect(5, -11, 11, 10);
            x.fillStyle = "#7a4a1e"; x.fillRect(-11, -6, 17, 13); x.fillStyle = "#a8692c"; x.fillRect(-11, -6, 17, 3);
            x.fillStyle = "#d9b27a"; x.fillRect(-8, 2, 13, 4);
            x.fillStyle = "#3a200c"; x.fillRect(-13, -3, 4, 4);
            x.fillStyle = "#1a8a44"; x.fillRect(6, -10, 9, 9); x.fillStyle = "#3fcf6a"; x.fillRect(6, -10, 9, 2);
            x.fillStyle = "#fff"; x.fillRect(6, -1, 7, 1);
            x.fillStyle = "#ff9a1e"; x.fillRect(15, -6, 5, 3); x.fillStyle = "#c56a08"; x.fillRect(15, -4, 5, 1);
            x.fillStyle = d.dead ? "#c00" : "#fff"; x.fillRect(10, -8, 2, 2); x.fillStyle = "#000"; x.fillRect(11, -7, 1, 1);
            x.fillStyle = "#15100a";
            if (wf === 0) x.fillRect(-7, -17, 10, 11); else if (wf === 1) x.fillRect(-8, -12, 12, 7); else if (wf === 2) x.fillRect(-7, 4, 11, 9); else x.fillRect(-7, -4, 11, 8);
            x.fillStyle = "#5a3414";
            if (wf === 0) x.fillRect(-6, -16, 8, 9); else if (wf === 1) x.fillRect(-7, -11, 10, 5); else if (wf === 2) x.fillRect(-6, 5, 9, 7); else x.fillRect(-6, -3, 9, 6);
            x.fillStyle = "#e8d8b0"; if (wf === 0) x.fillRect(-6, -16, 8, 2); else if (wf === 1) x.fillRect(-7, -11, 10, 1);
            x.restore();
          },
          dogDraw: function (x) {
            var D = this.dog; if (this.state !== "dog") return;
            var rise = Math.min(1, (80 - D.t) / 14, D.t / 14), dy = 206 - Math.round(rise * 26), dx = Math.round(D.x), lf = D.k === "miss" && this.timer % 10 < 5 ? 1 : 0;
            x.fillStyle = "#15100a"; x.fillRect(dx - 15, dy - 1, 30, 40); x.fillRect(dx - 19, dy + 2, 8, 16); x.fillRect(dx + 11, dy + 2, 8, 16);
            x.fillStyle = "#b8742c"; x.fillRect(dx - 14, dy, 28, 40);
            x.fillStyle = "#e0a05c"; x.fillRect(dx - 14, dy, 28, 4);
            x.fillStyle = "#6a3c14"; x.fillRect(dx - 18, dy + 3, 6, 14); x.fillRect(dx + 12, dy + 3, 6, 14);
            x.fillStyle = "#f4e2c0"; x.fillRect(dx - 8, dy + 12, 16, 10);
            x.fillStyle = "#000"; x.fillRect(dx - 3, dy + 12, 6, 4);
            x.fillRect(dx - 9, dy + 6, 3, 3); x.fillRect(dx + 6, dy + 6, 3, 3);
            if (D.k === "miss") { x.fillStyle = "#c01818"; x.fillRect(dx - 5, dy + 18 + lf, 10, 3 + lf * 2); x.fillStyle = "#fff"; x.fillRect(dx - 5, dy + 17, 10, 1); }
            if (D.k === "hit") { x.fillStyle = "#15100a"; x.fillRect(dx - 11, dy - 17, 22, 17); x.fillStyle = "#7a4a1e"; x.fillRect(dx - 10, dy - 15, 20, 13); x.fillStyle = "#1a8a44"; x.fillRect(dx - 3, dy - 20, 9, 7); x.fillStyle = "#ff9a1e"; x.fillRect(dx + 6, dy - 17, 4, 2); }
          },
          draw: function (x) {
            var i, t = this.timer, sh = this.shk;
            x.save(); if (sh) x.translate(Math.round((Math.random() - 0.5) * sh), Math.round((Math.random() - 0.5) * sh));
            var sk = x.createLinearGradient(0, 0, 0, 180); sk.addColorStop(0, "#3d9be8"); sk.addColorStop(1, "#bfeaff"); x.fillStyle = sk; x.fillRect(-4, -4, 328, 190);
            x.fillStyle = "#fff8c0"; x.fillRect(262, 24, 20, 20); x.fillStyle = "#fffbe0"; x.fillRect(265, 27, 14, 14);
            for (i = 0; i < 5; i++) { var cx0 = ((i * 83 + t * (0.1 + i * 0.03)) % 400) - 40, cy0 = 20 + (i * 29) % 70;
              x.fillStyle = "#ffffff"; x.fillRect(cx0, cy0, 40, 8); x.fillRect(cx0 + 8, cy0 - 6, 22, 7); x.fillStyle = "#dcefff"; x.fillRect(cx0, cy0 + 6, 40, 2); }
            x.fillStyle = "#4f9a5c"; for (i = 0; i < 320; i += 4) { var hh = 20 + Math.round(10 * Math.sin(i / 37) + 6 * Math.sin(i / 13)); x.fillRect(i, 170 - hh, 4, hh + 10); }
            x.fillStyle = "#2f7a3e"; for (i = 0; i < 320; i += 4) { var h2 = 12 + Math.round(8 * Math.sin(i / 23 + 2)); x.fillRect(i, 178 - h2, 4, h2 + 10); }
            // trees
            [[36, 1], [250, 1.15], [150, 0.8]].forEach(function (tr) {
              var tx = tr[0], s = tr[1];
              x.fillStyle = "#4a2a10"; x.fillRect(tx - 3 * s, 120, 7 * s, 70); x.fillStyle = "#6a3c18"; x.fillRect(tx - 3 * s, 120, 2 * s, 70);
              x.fillStyle = "#15502a"; x.fillRect(tx - 24 * s, 78, 48 * s, 30); x.fillRect(tx - 18 * s, 62, 36 * s, 20); x.fillRect(tx - 28 * s, 96, 56 * s, 20);
              x.fillStyle = "#2a8a44"; x.fillRect(tx - 22 * s, 80, 40 * s, 22); x.fillRect(tx - 16 * s, 64, 30 * s, 16);
              x.fillStyle = "#58c46a"; x.fillRect(tx - 14 * s, 66, 12 * s, 4); x.fillRect(tx - 18 * s, 84, 10 * s, 4);
            });
            var gg = x.createLinearGradient(0, 170, 0, 240); gg.addColorStop(0, "#6ac04a"); gg.addColorStop(1, "#2a7a2a"); x.fillStyle = gg; x.fillRect(0, 170, 320, 70);
            x.fillStyle = "#8ae060"; x.fillRect(0, 170, 320, 2);
            for (i = 0; i < this.ducks.length; i++) this.duck(x, this.ducks[i]);
            this.dogDraw(x);
            // foreground grass blades sway and hide the launch spot
            for (i = 0; i < 330; i += 5) { var bh = 16 + (i * 7) % 11, sw = Math.round(Math.sin(t * 0.05 + i * 0.3) * 2);
              x.fillStyle = "#15502a"; x.fillRect(i - 1, 205 - bh + 2, 5, bh + 40); x.fillStyle = (i / 5) % 2 ? "#2a9a3a" : "#3ab54a"; x.fillRect(i + sw, 204 - bh, 3, bh + 40); x.fillStyle = "#8ae060"; x.fillRect(i + sw, 204 - bh, 1, 3); }
            x.fillStyle = "#1c6a2a"; x.fillRect(0, 214, 320, 26); x.fillStyle = "#2a8a3a"; x.fillRect(0, 214, 320, 2);
            // feathers
            for (i = 0; i < this.parts.length; i++) { var q = this.parts[i]; x.fillStyle = q.c; x.fillRect(q.x | 0, q.y | 0, q.t > 10 ? 3 : 2, 2); }
            // muzzle flash
            if (this.flash > 0) { x.fillStyle = "rgba(255,255,220," + (this.flash * 0.07).toFixed(2) + ")"; x.fillRect(0, 0, 320, 240); }
            // HUD
            x.fillStyle = "rgba(0,0,0,0.55)"; x.fillRect(0, 0, 320, 16);
            text("SCORE " + this.score, 6, 5, 1, "#ffe14d");
            for (i = 0; i < 10; i++) { var hv = this.hist[i]; x.fillStyle = hv === undefined ? "#445" : hv ? "#ff5a4a" : "#eee"; x.fillRect(150 + i * 9, 4, 6, 8); x.fillStyle = "rgba(0,0,0,0.4)"; x.fillRect(150 + i * 9, 10, 6, 2); }
            for (i = 0; i < 3; i++) { x.fillStyle = i < this.ammo ? "#ffe14d" : "#445"; x.fillRect(254 + i * 10, 4, 5, 8); x.fillStyle = i < this.ammo ? "#c08a1a" : "#223"; x.fillRect(254 + i * 10, 9, 5, 3); }
            text("INFINITE LIVES", 6, 228, 1, "#bfe8bf");
            text("HITS " + this.hits + "/7", 262, 228, 1, "#fff");
            // crosshair
            var cx = Math.round(this.cx), cy = Math.round(this.cy);
            x.strokeStyle = "#101010"; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, 11, 0, 7); x.stroke();
            x.strokeStyle = this.flash ? "#ffffff" : "#ff3030"; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, 11, 0, 7); x.stroke();
            x.fillStyle = x.strokeStyle; x.fillRect(cx - 16, cy - 1, 10, 2); x.fillRect(cx + 6, cy - 1, 10, 2); x.fillRect(cx - 1, cy - 16, 2, 10); x.fillRect(cx - 1, cy + 6, 2, 10);
            for (i = 0; i < this.pops.length; i++) { var po = this.pops[i]; text(po.s, Math.round(po.x) + 1, Math.round(po.y) + 1, 1, "#000", true); text(po.s, Math.round(po.x), Math.round(po.y), 1, po.t % 8 < 4 ? "#fff" : "#ffe14d", true); }
            x.restore();
          }
        };
