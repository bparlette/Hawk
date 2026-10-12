/* Retro Throwback Arcade - Level 1: BARREL CLIMB
   Loaded by ../index.html and evaluated inside the player's scope.
   Must define `var barrelClimb = {...}` (title, goal, init(api), update(input), draw(ctx)). */

        /* ================= LEVEL 1 — BARREL CLIMB ================= */
        /* Sloped girders, ladders, barrel-tossing ape, hammer, rescuee. */
        var barrelClimb = {
          title: "BARREL CLIMB",
          goal: "CLIMB TO THE TOP. JUMP BARRELS +100.",
          api: null,
          init: function (api) {
            this.api = api;
            // girders: y at left/right end, zig-zag slopes
            this.G = [
              { x0: 8, x1: 312, y0: 222, y1: 222, dir: 0 },   // 0 ground (flat)
              { x0: 20, x1: 312, y0: 194, y1: 182, dir: -1 }, // 1 low on left -> rolls left, drops off left end onto 0
              { x0: 8, x1: 300, y0: 144, y1: 156, dir: 1 },   // 2 low on right -> rolls right, drops onto 1
              { x0: 20, x1: 312, y0: 118, y1: 106, dir: -1 }, // 3 rolls left, drops onto 2
              { x0: 8, x1: 300, y0: 68, y1: 80, dir: 1 },     // 4 ape girder, rolls right, drops onto 3
              { x0: 100, x1: 220, y0: 30, y1: 30, dir: 0 }    // 5 top platform with rescuee
            ];
            this.L = [
              // zig-zag: every girder is crossed against the barrel flow
              { g: 0, up: 1, x: 44, broken: false },
              { g: 1, up: 2, x: 150, broken: true },
              { g: 1, up: 2, x: 286, broken: false },
              { g: 2, up: 3, x: 40, broken: false },
              { g: 3, up: 4, x: 170, broken: true },
              { g: 3, up: 4, x: 276, broken: false },
              { g: 4, up: 5, x: 200, broken: false },
              { g: 4, up: 5, x: 120, broken: false }
            ];
            this.hammer = { x: 180, y: 0, g: 2, taken: false };
            this.hammer.y = this.gy(this.G[2], 180) - 10;
            this.lives = 3; this.score = 0; this.won = 0; this.jingled = false;
            this.reset(true);
          },
          gy: function (g, x) {
            var t = Math.max(0, Math.min(1, (x - g.x0) / (g.x1 - g.x0)));
            return g.y0 + (g.y1 - g.y0) * t;
          },
          onG: function (g, x) { return x >= g.x0 - 2 && x <= g.x1 + 2; },
          reset: function (full) {
            this.p = { x: 296, y: 0, vy: 0, g: 0, onGround: true, climb: null, face: -1, jumping: false, dead: 0, walk: 0, cl: 0 };
            this.p.y = this.gy(this.G[0], 296);
            this.barrels = []; this.timer = 0; this.throwT = 100; this.tossT = 0;
            this.hamT = 0; this.flash = 0; this.pops = []; this.parts = []; this.shake = 0; this.bonus = 5000;
            if (full) this.hammer.taken = false;
          },
          spawnBarrel: function () {
            var g = this.G[4];
            this.barrels.push({ x: 40, y: this.gy(g, 40), gi: 4, vx: g.dir * 0.85, vy: 0,
              falling: false, onLadder: null, scored: false, spin: 0, ladderOK: Math.random() < 0.22 });
            this.tossT = 14;
            beep(220, 0.08, "sawtooth", 0.05);
          },
          pop: function (s, x, y) { this.pops.push({ s: s, x: x, y: y, t: 45 }); },
          update: function (inp) {
            var self = this, P = this.p, G = this.G;
            this.timer++;
            if (this.flash > 0) this.flash--;
            for (var q = this.pops.length - 1; q >= 0; q--) { this.pops[q].y -= 0.4; if (--this.pops[q].t <= 0) this.pops.splice(q, 1); }
            if (this.won > 0) { if (++this.won > 150) this.api.win(this.score); return; }
            if (P.dead > 0) {
              P.dead--;
              if (P.dead === 0) {
                
                
                this.reset(false);
              }
              return;
            }
            if (this.hamT > 0) this.hamT--;
            if (this.tossT > 0) this.tossT--;
            if (P.safe > 0) P.safe--; // brief grace after stepping off a ladder top
            if (this.timer % 120 === 0 && this.bonus > 0) this.bonus -= 100;

            // throw barrels: every 2.2-3 s, chest-pound telegraphs the last 0.8 s
            this.throwT--;
            if (this.throwT === 47) beep(110, 0.06, "square", 0.04);
            if (this.throwT <= 0) { this.spawnBarrel(); this.throwT = 132 + Math.floor(Math.random() * 49); }

            // ---- hero ----
            var k = inp.k;
            if (P.climb !== null) {
              var L = this.L[P.climb];
              var top = this.gy(G[L.up], L.x), bot = this.gy(G[L.g], L.x);
              if (k.up) P.y -= 1.1;
              if (k.down) P.y += 1.1;
              if (k.up || k.down) P.cl++;
              if (L.broken) {
                var gap = bot - (bot - top) * 0.62;
                if (P.y < gap) P.y = gap;
              }
              if (P.y <= top) { P.y = top; P.g = L.up; P.climb = null; P.onGround = true; P.safe = 12; }
              else if (P.y >= bot) { P.y = bot; P.g = L.g; P.climb = null; P.onGround = true; }
            } else {
              var sp = 1.15;
              if (k.left) { P.x -= sp; P.face = -1; }
              if (k.right) { P.x += sp; P.face = 1; }
              if (k.left || k.right) P.walk++;
              var g = G[P.g];
              if (P.x < g.x0 + 4) P.x = g.x0 + 4;
              if (P.x > g.x1 - 4) P.x = g.x1 - 4;
              if (!P.jumping) P.y = this.gy(g, P.x);
              // ladder grab
              if (k.up || k.down) {
                for (var i = 0; i < this.L.length; i++) {
                  var L2 = this.L[i];
                  if (Math.abs(P.x - L2.x) < 6) {
                    if (k.up && L2.g === P.g && !P.jumping) { P.climb = i; P.x = L2.x; break; }
                    if (k.down && L2.up === P.g && !P.jumping) {
                      if (L2.broken) continue;
                      P.climb = i; P.x = L2.x; P.y = this.gy(G[P.g], L2.x) + 1; break;
                    }
                  }
                }
              }
              // jump
              if (inp.p.a && !P.jumping) { P.jumping = true; P.vy = -3.2; SFX.jump(); }
              if (P.jumping) {
                P.vy += 0.22; P.y += P.vy;
                var fy = this.gy(G[P.g], P.x);
                if (P.y >= fy && P.vy > 0) { P.y = fy; P.jumping = false; P.vy = 0; }
              }
            }
            // hammer pickup
            var hm = this.hammer;
            if (!hm.taken && Math.abs(P.x - hm.x) < 8 && Math.abs(P.y - 8 - hm.y) < 14) {
              hm.taken = true; this.hamT = 360; SFX.pick();
            }

            // ---- barrels ----
            for (var b = this.barrels.length - 1; b >= 0; b--) {
              var B = this.barrels[b];
              B.spin += B.onLadder !== null ? 0.25 : B.vx * 0.3;
              if (B.onLadder !== null) {
                var LD = this.L[B.onLadder];
                B.y += 1.0;
                var bt = this.gy(G[LD.g], LD.x);
                if (B.y >= bt) { B.y = bt; B.gi = LD.g; B.onLadder = null; B.vx = G[LD.g].dir * 0.85 || 0.85; }
              } else if (B.falling) {
                B.vy += 0.25; B.y += B.vy; B.x += B.vx * 0.3;
                var nextG = null;
                for (var gi = B.gi - 1; gi >= 0; gi--) {
                  if (this.onG(G[gi], B.x) && B.y >= this.gy(G[gi], B.x)) { nextG = gi; break; }
                }
                if (nextG !== null) {
                  B.gi = nextG; B.y = this.gy(G[nextG], B.x); B.falling = false; B.vy = 0;
                  B.vx = (G[nextG].dir || (B.vx > 0 ? 1 : -1)) * 0.85;
                } else if (B.y > H + 20) { this.barrels.splice(b, 1); continue; }
              } else {
                var gg = G[B.gi];
                B.x += B.vx;
                B.y = this.gy(gg, B.x);
                if (B.x < gg.x0 || B.x > gg.x1) { B.falling = true; B.vy = 0; }
                else if (B.gi > 0) {
                  for (var j = 0; j < this.L.length; j++) {
                    var LL = this.L[j];
                    if (LL.up === B.gi && !LL.broken && B.ladderOK && Math.abs(B.x - LL.x) < 0.8 && Math.random() < 0.5) {
                      B.onLadder = j; B.x = LL.x; B.ladderOK = false; break;
                    }
                  }
                }
              }
              if (B.gi === 0 && !B.falling && B.onLadder === null && (B.x < 10 || B.x > 310)) {
                this.barrels.splice(b, 1); continue;
              }
              // collision / jump scoring
              var dx = Math.abs(B.x - P.x), dy = B.y - P.y;
              if (this.hamT > 0 && dx < 14 && Math.abs(dy) < 14) {
                this.pop("+300", B.x - 12, B.y - 18);
                for (var pk = 0; pk < 14; pk++) { var pa = pk / 14 * 6.283, pv = 1 + pk % 3; this.parts.push({ x: B.x, y: B.y - 5, vx: Math.cos(pa) * pv, vy: Math.sin(pa) * pv - 1.2, t: 26, c: pk % 2 ? "#d98b2b" : "#8a4f14" }); } this.shake = 6; this.barrels.splice(b, 1); this.score += 300; this.flash = 8; SFX.smash(); continue;
              }
              // hitbox a little smaller than both sprites
              var sameLevel = B.gi === P.g || B.falling || B.onLadder !== null; // never through a girder
              if (sameLevel && dx < 6 && dy < 3 && dy > -12 && P.climb === null && !B.pass) {
                if (P.safe > 0) B.pass = true; // overlapping as hero tops out: let it roll through
                else if (P.dead === 0) { P.dead = 90; this.shake = 14; P.jumping = false; P.y = this.gy(G[P.g], P.x); SFX.hit(); }
              } else if (!B.scored && P.jumping && B.gi === P.g && dx < 10 && dy > 2 && dy < 24) {
                B.scored = true; this.score += 100; beep(990, 0.07); this.pop("+100", P.x - 12, P.y - 30);
              }
            }

            // win: reach top platform; heart + jingle, then the bonus is banked
            if (P.g === 5 && P.dead === 0) {
              this.won = 1; this.jingled = true; this.barrels = [];
              this.score += this.bonus + this.lives * 200;
              this.pop("+" + this.bonus, P.x - 18, P.y - 30);
              [523, 659, 784, 1047, 784, 1047].forEach(function (f, n) {
                setTimeout(function () { beep(f, n === 5 ? 0.35 : 0.12); }, n * 120);
              });
            }
          },
          draw: function (x) {
            var G = this.G, i, c;
            // night construction site: sky gradient, moon, twinkling stars, two skyline layers with lit windows
            var sg = x.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, "#060920"); sg.addColorStop(0.6, "#1b1446"); sg.addColorStop(1, "#3a1838");
            x.fillStyle = sg; x.fillRect(0, 0, W, H);
            x.fillStyle = "#3b2f6e"; x.beginPath(); x.arc(270, 34, 17, 0, 7); x.fill();
            x.fillStyle = "#fff3c4"; x.beginPath(); x.arc(270, 34, 12, 0, 7); x.fill();
            x.fillStyle = "#e3d29a"; x.fillRect(264, 29, 3, 3); x.fillRect(273, 37, 4, 2); x.fillRect(268, 40, 2, 2);
            for (i = 0; i < 46; i++) { if ((i + (this.timer >> 4)) % 9 === 0) continue; x.fillStyle = i % 4 ? "#8fa6ff" : "#ffffff"; x.fillRect((i * 73 + 11) % W, (i * 37) % 150, 1, 1); }
            for (i = 0; i < 17; i++) { var fbw = 14 + (i * 7) % 12, fbh = 50 + (i * 29) % 70, fbx = i * 20 - 6; x.fillStyle = "#211c4a"; x.fillRect(fbx, H - fbh, fbw, fbh); x.fillStyle = "#2c2660"; x.fillRect(fbx, H - fbh, 1, fbh); }
            for (i = 0; i < 11; i++) { var nbw = 20 + (i * 11) % 14, nbh = 24 + (i * 17) % 44, nbx = i * 31 - 10; x.fillStyle = "#110e28"; x.fillRect(nbx, H - nbh, nbw, nbh); x.fillStyle = "#e8c45a"; for (c = 0; c < 8; c++) if ((i * 5 + c * 3) % 4 === 0) x.fillRect(nbx + 3 + (c % 3) * 6, H - nbh + 5 + (c >> 1) * 7, 3, 3); }
            x.save(); if (this.shake > 0) { this.shake--; x.translate((this.shake % 2 ? 1 : -1) * Math.ceil(this.shake / 4), (this.shake % 3) - 1); }
            // girders
            for (i = 0; i < G.length; i++) {
              var g = G[i];
              x.strokeStyle = "#e03a2f"; x.lineWidth = 3;
              x.beginPath(); x.moveTo(g.x0, g.y0 + 2); x.lineTo(g.x1, g.y1 + 2); x.stroke();
              x.lineWidth = 1; x.strokeStyle = "#ff9a78"; x.beginPath(); x.moveTo(g.x0, g.y0 + 0.5); x.lineTo(g.x1, g.y1 + 0.5); x.stroke();
              x.strokeStyle = "#4e0c08"; x.beginPath(); x.moveTo(g.x0, g.y0 + 4.5); x.lineTo(g.x1, g.y1 + 4.5); x.stroke();
              x.strokeStyle = "#8c1c14"; x.lineWidth = 1;
              for (c = g.x0; c < g.x1; c += 8) {
                var t = (c - g.x0) / (g.x1 - g.x0), yy = g.y0 + (g.y1 - g.y0) * t;
                x.beginPath(); x.moveTo(c, yy + 4); x.lineTo(c + 4, yy + 7); x.stroke();
              }
            }
            // ladders
            for (i = 0; i < this.L.length; i++) {
              var L = this.L[i], top = this.gy(G[L.up], L.x), bot = this.gy(G[L.g], L.x);
              x.fillStyle = L.broken ? "#7fd3ff" : "#4ad6ff";
              var gT = L.broken ? top + 6 : bot, gB = L.broken ? top + 6 + (bot - top) * 0.3 : bot; x.fillRect(L.x - 5, top, 2, gT - top); x.fillRect(L.x + 3, top, 2, gT - top); x.fillRect(L.x - 5, gB, 2, bot - gB); x.fillRect(L.x + 3, gB, 2, bot - gB);
              for (var yy2 = top + 3; yy2 < bot - 1; yy2 += 6) {
                if (L.broken && yy2 < bot - (bot - top) * 0.62 + 2 && yy2 > top + 4) continue;
                x.fillRect(L.x - 5, yy2, 10, 2);
              }
            }
            // ape (top-left)
            var apeY = this.gy(G[4], 34) - 30, aw = this.timer % 60 < 30 ? 0 : 1;
            x.fillStyle = "#2a1006"; x.fillRect(13, apeY - 1, 32, 24); x.fillStyle = "#b35c1e"; x.fillRect(14, apeY, 30, 22); x.fillStyle = "#7a3a10"; x.fillRect(14, apeY + 18, 30, 4); x.fillStyle = "#d9813a"; x.fillRect(16, apeY + 1, 26, 2);
            x.fillStyle = "#f0c080"; x.fillRect(22, apeY + 8, 14, 10);
            x.fillStyle = "#000"; x.fillRect(25, apeY + 4, 3, 3); x.fillRect(32, apeY + 4, 3, 3);
            x.fillRect(25, apeY + 13, 10, 2);
            x.fillStyle = "#b35c1e";
            if (this.tossT > 0) {            // throw: both arms swung out to the right
              x.fillRect(8, apeY + 6, 7, 12); x.fillRect(44, apeY + 2, 12, 6);
            } else if (this.throwT <= 12 && !this.won) { // barrel held overhead
              x.fillRect(12, apeY - 8, 6, 14); x.fillRect(40, apeY - 8, 6, 14);
              x.fillStyle = "#d98b2b"; x.fillRect(18, apeY - 12, 22, 9);
              x.fillStyle = "#8a4f14"; x.fillRect(18, apeY - 9, 22, 1); x.fillRect(18, apeY - 6, 22, 1);
            } else if (this.throwT < 48 && !this.won) { // chest-pound
              var pd = Math.floor(this.throwT / 5) % 2;
              x.fillRect(pd ? 20 : 10, apeY + 8, 8, 9); x.fillRect(pd ? 40 : 30, apeY + 8, 8, 9);
              x.fillStyle = "#fff"; if (pd) { x.fillRect(8, apeY + 4, 2, 2); x.fillRect(48, apeY + 4, 2, 2); }
            } else {
              x.fillRect(8 + aw * 2, apeY + 6, 7, 12); x.fillRect(44 - aw * 2, apeY + 6, 7, 12);
            }
            x.fillStyle = "#b35c1e"; x.fillRect(18, apeY + 22, 8, 8); x.fillRect(32, apeY + 22, 8, 8);
            // rescuee (top platform)
            var ry = this.gy(G[5], 160) - 18;
            x.fillStyle = "#ff6fd0"; x.fillRect(154, ry + 7, 12, 11);
            x.fillStyle = "#f6c9a0"; x.fillRect(156, ry, 8, 8);
            x.fillStyle = "#ffe14d"; x.fillRect(155, ry - 2, 10, 3);
            if (this.won) {
              var hs = this.won % 20 < 10 ? 2 : 1, hx = 160 - 3.5 * hs, hy0 = ry - 4 - 7 * hs;
              var HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
              x.fillStyle = "#ff3d6e";
              for (var hr = 0; hr < 6; hr++) for (var hc = 0; hc < 7; hc++)
                if (HEART[hr][hc] === "1") x.fillRect(hx + hc * hs, hy0 + hr * hs, hs, hs);
            } else if (this.timer % 50 < 25) text("HELP!", 120, ry + 2, 1, "#fff");
            // hammer
            if (!this.hammer.taken) {
              var hb = Math.sin(this.timer / 8) * 1.5;
              x.fillStyle = "#c9a227"; x.fillRect(this.hammer.x - 1, this.hammer.y + hb, 2, 8);
              x.fillStyle = "#e8e8e8"; x.fillRect(this.hammer.x - 5, this.hammer.y - 4 + hb, 10, 5);
            }
            // barrels
            for (i = 0; i < this.barrels.length; i++) {
              var B = this.barrels[i];
              var bx = Math.round(B.x), by = Math.round(B.y);
              if (B.onLadder !== null) {   // end-on while dropping down a ladder
                x.fillStyle = "#2a1404"; x.fillRect(bx - 7, by - 9, 14, 10); x.fillStyle = "#d98b2b"; x.fillRect(bx - 6, by - 8, 12, 8);
                x.fillStyle = "#8a4f14"; x.fillRect(bx - 6, by - 7, 12, 1); x.fillRect(bx - 6, by - 2, 12, 1);
                x.fillRect(bx - 1 + (Math.floor(B.spin) % 2) * 2, by - 6, 1, 4);
              } else {                     // rolling: 4-frame stave rotation
                x.fillStyle = "#2a1404"; x.fillRect(bx - 5, by - 10, 10, 11); x.fillRect(bx - 6, by - 9, 12, 9); x.fillStyle = "#d98b2b"; x.fillRect(bx - 4, by - 9, 8, 9); x.fillRect(bx - 5, by - 8, 10, 7); x.fillStyle = "#a8621c"; x.fillRect(bx - 4, by - 3, 8, 2);
                x.fillStyle = "#8a4f14";
                var ph = ((Math.floor(B.spin) % 4) + 4) % 4;
                x.fillRect(bx - 4 + ph * 2, by - 9, 1, 9);
                x.fillRect(bx - 4 + ((ph + 2) % 4) * 2, by - 8, 1, 7);
                x.fillStyle = "#f2b45a"; x.fillRect(bx - 3, by - 8, 2, 1);
              }
            }
            // hero
            var P = this.p;
            var px = Math.round(P.x), py = Math.round(P.y);
            if (!P.dead && P.climb === null) { x.fillStyle = "rgba(0,0,0,0.45)"; x.fillRect(px - 5, py, 10, 2); }
            if (P.dead > 0) {
              // death spin: quarter turns that slow down, then lie flat
              var spinT = 90 - P.dead, ang = spinT < 48 ? Math.floor(spinT / (3 + spinT / 12)) * Math.PI / 2 : Math.PI / 2;
              x.save(); x.translate(px, py - 8); x.rotate(ang);
              x.fillStyle = "#e33"; x.fillRect(-5, -4, 10, 7);
              x.fillStyle = "#3a6fe0"; x.fillRect(-5, 3, 10, 5);
              x.fillStyle = "#f6c9a0"; x.fillRect(-4, -11, 8, 7);
              x.fillStyle = "#e33"; x.fillRect(-5, -13, 10, 3);
              x.restore();
              if (spinT >= 48 && this.timer % 20 < 10) text("+", px - 9, py - 22, 1, "#ffe14d");
            } else if (P.climb !== null) {
              // climb: back view, arms and legs alternate
              var cf = Math.floor(P.cl / 7) % 2;
              x.fillStyle = "#e33"; x.fillRect(px - 5, py - 21, 10, 9);
              x.fillStyle = "#e33"; x.fillRect(px - 5, py - 12, 10, 7);
              x.fillStyle = "#f6c9a0"; x.fillRect(px - 7, py - (cf ? 20 : 15), 2, 3); x.fillRect(px + 5, py - (cf ? 15 : 20), 2, 3);
              x.fillStyle = "#3a6fe0"; x.fillRect(px - 5, py - 6, 10, 3);
              x.fillRect(px - 5, py - (cf ? 4 : 2), 4, 2); x.fillRect(px + 1, py - (cf ? 2 : 4), 4, 2);
            } else {
              // walk: 2 frames (stride / together), arms swing opposite
              var wf = !P.jumping && (keys.left || keys.right) ? Math.floor(P.walk / 6) % 2 : 0, f = P.face;
              x.fillStyle = "#e33"; x.fillRect(px - 5, py - 12, 10, 7);
              x.fillStyle = "#f6c9a0"; x.fillRect(px + (wf ? -f * 6 - 1 : f * 4 - 1), py - 11, 2, 3);
              x.fillStyle = "#3a6fe0"; x.fillRect(px - 5, py - 6, 10, 4);
              if (P.jumping) { x.fillRect(px - 5, py - 3, 3, 2); x.fillRect(px + 2, py - 3, 3, 2); }
              else if (wf) { x.fillRect(px - 6, py - 2, 4, 2); x.fillRect(px + 2, py - 2, 4, 2); }
              else { x.fillRect(px - 3, py - 2, 6, 2); }
              x.fillStyle = "#f6c9a0"; x.fillRect(px - 4, py - 19, 8, 7);
              x.fillStyle = "#e33"; x.fillRect(px - 5, py - 21, 10, 3); x.fillRect(px + (f > 0 ? 2 : -7), py - 19, 5, 1);
              x.fillStyle = "#000"; x.fillRect(px + (f > 0 ? 1 : -3), py - 17, 2, 2);
              if (this.hamT > 0 && !(this.hamT < 120 && this.timer % 10 < 5)) {
                // hammer swing: raised overhead, then slammed forward; blinks in its last 2 s
                if (Math.floor(this.timer / 8) % 2) {
                  x.fillStyle = "#c9a227"; x.fillRect(px + f * 3 - 1, py - 29, 2, 9);
                  x.fillStyle = this.hamT < 120 ? "#ff6f6f" : "#e8e8e8"; x.fillRect(px + f * 3 - 4, py - 34, 8, 5);
                } else {
                  x.fillStyle = "#c9a227"; x.fillRect(px + (f > 0 ? 5 : -14), py - 11, 9, 2);
                  x.fillStyle = this.hamT < 120 ? "#ff6f6f" : "#e8e8e8"; x.fillRect(px + (f > 0 ? 12 : -17), py - 14, 5, 8);
                }
              }
            }
            if (this.flash > 0) { x.fillStyle = "rgba(255,255,255,0.25)"; x.fillRect(0, 0, W, H); }
            // score popups
            for (i = 0; i < this.pops.length; i++) {
              var po = this.pops[i];
              text(po.s, Math.round(po.x), Math.round(po.y), 1, po.t % 8 < 4 ? "#fff" : "#ffe14d");
            }
            for (var pq = this.parts.length - 1; pq >= 0; pq--) { var pp = this.parts[pq]; pp.x += pp.vx; pp.y += pp.vy; pp.vy += 0.15; x.fillStyle = pp.t > 20 ? "#fff3c4" : pp.c; x.fillRect(pp.x | 0, pp.y | 0, pp.t > 12 ? 2 : 1, pp.t > 12 ? 2 : 1); if (--pp.t <= 0) this.parts.splice(pq, 1); }
            x.restore();
            // hud
            text("LIVES INF", 6, 6, 1, "#fff");
            text("SCORE " + this.score, 180, 6, 1, "#ffe14d");
            x.strokeStyle = "#4ad6ff"; x.lineWidth = 1; x.strokeRect(237.5, 15.5, 76, 11);
            text("BONUS " + this.bonus, 240, 18, 1, this.bonus <= 1000 && this.timer % 30 < 15 ? "#e33" : "#4ad6ff");
            if (this.hamT > 0 && !(this.hamT < 120 && this.timer % 10 < 5))
              text("HAMMER " + Math.ceil(this.hamT / 60), 6, 230, 1, "#ffe14d");
          }
        };
