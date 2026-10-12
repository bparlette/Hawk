/* Retro Throwback Arcade - Level 4: GEM COLUMNS
   Loaded by ../index.html and evaluated inside the player's scope.
   Must define `var gemColumns = {...}` (title, goal, init(api), update(input), draw(ctx)). */

        var gemColumns = {
          title: "GEM COLUMNS",
          goal: "DROP GEM STICKS. LINE UP 3+ OF A COLOUR. CLEAR 45 GEMS.",
          api: null,
          COLS: 6, ROWS: 13, CS: 16, OX: 112, OY: 20,
          // base, light facet, dark facet
          PAL: [["#e0303a", "#ff8a8a", "#8a1020"], ["#f08020", "#ffc070", "#984008"], ["#f0d020", "#fff49a", "#987c00"],
                ["#30c050", "#9cf0a8", "#106a28"], ["#3070f0", "#9cc0ff", "#14318a"], ["#a040e0", "#dca0ff", "#5a1488"]],
          init: function (api) {
            this.api = api;
            this.score = 0; this.cleared = 0; this.won = 0; this.over = 0; this.timer = 0; this.chain = 0;
            this.flash = 0; this.marks = null; this.pops = []; this.das = 0; this.fall = 0;
            this.parts = []; this.lockFx = null; this.shownGems = 0;
            this.grid = [];
            for (var r = 0; r < this.ROWS; r++) { this.grid.push([]); for (var c = 0; c < this.COLS; c++) this.grid[r].push(-1); }
            this.stars = [];
            for (var i = 0; i < 60; i++) this.stars.push({ x: Math.random() * W, y: Math.random() * H, t: Math.random() * 60 | 0 });
            this.next = this.rand();
            this.spawn();
          },
          rand: function () { return [0, 0, 0].map(function () { return Math.random() * 6 | 0; }); },
          spawn: function () { this.p = { c: 2, r: -2, g: this.next }; this.next = this.rand(); this.fall = 0; },
          // 36 frames/cell (~0.6 s) at start, a gentle step every 10 gems, never faster than 18
          speed: function () { return Math.max(18, 36 - Math.floor(this.cleared / 10) * 4); },
          free: function (c, r) { return c >= 0 && c < this.COLS && r < this.ROWS && (r < 0 || this.grid[r][c] === -1); },
          fits: function (c, r) { return this.free(c, r) && this.free(c, r + 1) && this.free(c, r + 2); },
          lock: function () {
            var P = this.p, k;
            for (k = 0; k < 3; k++) { if (P.r + k < 0) { this.over = 1; SFX.hit(); return; } this.grid[P.r + k][P.c] = P.g[k]; }
            // landing thunk + a brief white flash on the three locked cells
            this.lockFx = { c: P.c, r: P.r, t: 10 };
            beep(110, 0.09, "triangle", 0.1); beep(70, 0.12, "square", 0.04);
            this.p = null; this.chain = 0;
            this.check();
          },
          // mark every run of 3+ in all four directions
          check: function () {
            var G = this.grid, M = [], r, c, d, n = 0, dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
            for (r = 0; r < this.ROWS; r++) { M.push([]); for (c = 0; c < this.COLS; c++) M[r].push(false); }
            for (r = 0; r < this.ROWS; r++) for (c = 0; c < this.COLS; c++) {
              var v = G[r][c]; if (v < 0) continue;
              for (d = 0; d < 4; d++) {
                var dr = dirs[d][0], dc = dirs[d][1], len = 1;
                while (r + dr * len < this.ROWS && c + dc * len >= 0 && c + dc * len < this.COLS && G[r + dr * len][c + dc * len] === v) len++;
                if (len >= 3) for (var k = 0; k < len; k++) M[r + dr * k][c + dc * k] = true;
              }
            }
            for (r = 0; r < this.ROWS; r++) for (c = 0; c < this.COLS; c++) if (M[r][c]) n++;
            if (n) { this.marks = M; this.flash = 24; this.chain++; this.pendingN = n; }
            else this.spawn();
          },
          resolve: function () {
            var G = this.grid, M = this.marks, r, c, mult = this.chain, pts = this.pendingN * 10 * mult;
            var CS = this.CS, sx = 0, sy = 0, k;
            for (r = 0; r < this.ROWS; r++) for (c = 0; c < this.COLS; c++) if (M[r][c]) {
              // burst: each cleared gem throws sparkles in its colour and white
              var px = this.OX + c * CS + CS / 2, py = this.OY + r * CS + CS / 2, col = this.PAL[G[r][c]];
              for (k = 0; k < 7; k++) { var an = Math.random() * 6.283, sp = 0.6 + Math.random() * 1.8;
                this.parts.push({ x: px, y: py, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 0.8, t: 22 + (Math.random() * 14 | 0), col: k % 3 ? col[1] : "#fff" }); }
              sx += px; sy += py; G[r][c] = -1;
            }
            this.score += pts; this.cleared += this.pendingN;
            sx /= this.pendingN; sy /= this.pendingN;
            this.pops.push({ s: "+" + pts, x: sx, y: sy - 4, t: 50, col: "#ffe14d" });
            if (mult > 1) this.pops.push({ s: "X" + mult + " CHAIN!", x: this.OX + this.COLS * CS / 2, y: sy - 18, t: 60, col: "#ff8a8a", big: 1 });
            // chime climbs four semitones per chain step
            var f0 = 660 * Math.pow(2, (mult - 1) * 4 / 12);
            beep(f0, 0.08, "square", 0.05);
            setTimeout(function () { beep(f0 * 1.5, 0.12, "triangle", 0.05); }, 60);
            if (mult > 1) setTimeout(function () { beep(f0 * 2, 0.16, "triangle", 0.045); }, 130);
            // gravity: compact each column downward
            for (c = 0; c < this.COLS; c++) {
              var w = this.ROWS - 1;
              for (r = this.ROWS - 1; r >= 0; r--) if (G[r][c] >= 0) { var v = G[r][c]; G[r][c] = -1; G[w--][c] = v; }
            }
            this.marks = null;
            if (this.cleared >= 45) { this.won = 1; SFX.win(); return; }
            this.check();
          },
          update: function (inp) {
            this.timer++;
            for (var i = this.pops.length - 1; i >= 0; i--) { this.pops[i].y -= 0.4; if (--this.pops[i].t <= 0) this.pops.splice(i, 1); }
            for (i = this.parts.length - 1; i >= 0; i--) { var q = this.parts[i]; q.x += q.vx; q.y += q.vy; q.vy += 0.08; q.vx *= 0.97; if (--q.t <= 0) this.parts.splice(i, 1); }
            if (this.lockFx && --this.lockFx.t <= 0) this.lockFx = null;
            this.shownGems += (Math.min(this.cleared, 45) - this.shownGems) * 0.12;
            if (this.won > 0) { if (++this.won > 120) this.api.win(this.score); return; }
            if (this.over > 0) { if (++this.over > 90) this.api.lose(); return; }
            if (this.flash > 0) { if (--this.flash === 0) this.resolve(); return; }
            var P = this.p; if (!P) return;
            this.danger = this.top() <= 3;
            if (this.danger && this.timer % 40 === 0) beep(240, 0.06, "square", 0.03);
            var dx = (inp.p.right ? 1 : 0) - (inp.p.left ? 1 : 0);
            var hold = (inp.k.right ? 1 : 0) - (inp.k.left ? 1 : 0);
            if (dx) this.das = 0;
            else if (hold) { if (++this.das > 10 && this.das % 4 === 0) dx = hold; }
            else this.das = 0;
            if (dx && this.fits(P.c + dx, P.r)) { P.c += dx; beep(300, 0.03, "square", 0.03); }
            if (inp.p.up || inp.p.a) { P.g.unshift(P.g.pop()); beep(520, 0.04, "triangle", 0.04); }
            var iv = inp.k.down ? 2 : this.speed();
            if (++this.fall >= iv) {
              this.fall = 0;
              if (this.fits(P.c, P.r + 1)) { P.r++; if (inp.k.down) this.score++; }
              else this.lock();
            }
          },
          gem: function (x, px, py, v, s) {
            var p = this.PAL[v], n = s - 2;
            x.fillStyle = p[2]; x.fillRect(px + 1, py + 1, n, n);
            x.fillStyle = p[0]; x.fillRect(px + 3, py + 3, n - 4, n - 4);
            x.fillStyle = p[1]; x.fillRect(px + 1, py + 1, n, 2); x.fillRect(px + 1, py + 1, 2, n);
            x.fillRect(px + 4, py + 4, 3, 2); x.fillRect(px + 4, py + 6, 2, 1);
            x.fillStyle = p[2]; x.fillRect(px + n - 4, py + n - 4, 3, 3);
            x.fillStyle = "#fff"; x.fillRect(px + 4, py + 4, 1, 1);
            // shimmer: a glint sweeps across each gem now and then, staggered by position
            var gl = (this.timer + px * 3 + py * 5) % 150;
            if (gl < 10) { x.fillStyle = "rgba(255,255,255,0.75)"; var gx = px + 2 + gl;
              if (gx < px + n - 1) x.fillRect(gx, py + 2, 1, n - 2);
              if (gx + 2 < px + n - 1) x.fillRect(gx + 2, py + 2, 1, n - 2); }
          },
          // highest occupied row index (ROWS when empty)
          top: function () { for (var r = 0; r < this.ROWS; r++) for (var c = 0; c < this.COLS; c++) if (this.grid[r][c] >= 0) return r; return this.ROWS; },
          draw: function (x) {
            var i, r, c, CS = this.CS, OX = this.OX, OY = this.OY, WW = this.COLS * CS, WH = this.ROWS * CS;
            x.fillStyle = "#07061a"; x.fillRect(0, 0, W, H);
            for (i = 0; i < this.stars.length; i++) { var s = this.stars[i]; x.fillStyle = (this.timer + s.t) % 60 < 8 ? "#fff" : "#6a6aa0"; x.fillRect(s.x | 0, s.y | 0, 1, 1); }
            // ornate stone frame: blocks in two shades, gold studs at the corners
            for (var fy = OY - 8; fy < OY + WH + 8; fy += 8) for (var fx = OX - 8; fx < OX + WW + 8; fx += 8) {
              if (fx >= OX && fx < OX + WW && fy >= OY && fy < OY + WH) continue;
              x.fillStyle = ((fx + fy) / 8) % 2 ? "#6c6458" : "#8a8070"; x.fillRect(fx, fy, 8, 8);
              x.fillStyle = "#a89c88"; x.fillRect(fx, fy, 8, 1); x.fillStyle = "#3a342c"; x.fillRect(fx, fy + 7, 8, 1);
            }
            [[OX - 8, OY - 8], [OX + WW, OY - 8], [OX - 8, OY + WH], [OX + WW, OY + WH]].forEach(function (q) {
              x.fillStyle = "#c89a28"; x.fillRect(q[0] + 1, q[1] + 1, 6, 6); x.fillStyle = "#ffe07a"; x.fillRect(q[0] + 2, q[1] + 2, 2, 2);
            });
            x.fillStyle = "#0e0c24"; x.fillRect(OX, OY, WW, WH);
            x.fillStyle = "#16143a"; for (c = 1; c < this.COLS; c++) x.fillRect(OX + c * CS, OY, 1, WH);
            for (r = 0; r < this.ROWS; r++) for (c = 0; c < this.COLS; c++) {
              var v = this.grid[r][c]; if (v < 0) continue;
              if (this.marks && this.marks[r][c]) {
                // blink white, then a solid white gem that shrinks into the burst
                if (this.flash > 8) { if ((this.flash >> 2) % 2) { x.fillStyle = "#fff"; x.fillRect(OX + c * CS + 1, OY + r * CS + 1, CS - 2, CS - 2); } else this.gem(x, OX + c * CS, OY + r * CS, v, CS); }
                else { var sh = 8 - this.flash; x.fillStyle = "#fff"; x.fillRect(OX + c * CS + 1 + sh, OY + r * CS + 1 + sh, CS - 2 - sh * 2, CS - 2 - sh * 2); }
              }
              else this.gem(x, OX + c * CS, OY + r * CS, v, CS);
            }
            var L = this.lockFx;
            if (L) { x.fillStyle = "rgba(255,255,255," + (L.t / 10 * 0.7).toFixed(2) + ")";
              for (i = 0; i < 3; i++) if (L.r + i >= 0) x.fillRect(OX + L.c * CS + 1, OY + (L.r + i) * CS + 1, CS - 2, CS - 2); }
            var P = this.p;
            if (P) for (i = 0; i < 3; i++) if (P.r + i >= 0) this.gem(x, OX + P.c * CS, OY + (P.r + i) * CS, P.g[i], CS);
            // danger: the well pulses red while the stack is within 4 rows of the top
            if (this.danger && !this.over) {
              var pa = 0.1 + 0.1 * Math.sin(this.timer * 0.2);
              x.fillStyle = "rgba(255,40,40," + pa.toFixed(2) + ")"; x.fillRect(OX, OY, WW, WH);
              x.fillStyle = "rgba(255,60,60," + (pa * 3).toFixed(2) + ")";
              x.fillRect(OX - 8, OY - 8, WW + 16, 2); x.fillRect(OX - 8, OY + WH + 6, WW + 16, 2);
              x.fillRect(OX - 8, OY - 8, 2, WH + 16); x.fillRect(OX + WW + 6, OY - 8, 2, WH + 16);
              if (this.timer % 40 < 26) text("DANGER", OX + WW / 2, OY + 4, 1, "#ff6060", true);
            }
            for (i = 0; i < this.parts.length; i++) { var q = this.parts[i];
              x.fillStyle = q.col; var sz = q.t > 14 ? 2 : 1; x.fillRect(q.x | 0, q.y | 0, sz, sz);
              if (q.t > 18 && q.t % 6 < 3) { x.fillRect((q.x | 0) - 1, (q.y | 0) + 0, 1, 1); x.fillRect((q.x | 0) + sz, q.y | 0, 1, 1); } }
            // side panels: next piece, stats
            var NX = OX + WW + 24;
            text("NEXT", NX, OY, 1, "#fff");
            x.fillStyle = "#3a342c"; x.fillRect(NX - 3, OY + 10, CS + 6, CS * 3 + 6);
            x.fillStyle = "#0e0c24"; x.fillRect(NX - 1, OY + 12, CS + 2, CS * 3 + 2);
            for (i = 0; i < 3; i++) this.gem(x, NX, OY + 13 + i * CS, this.next[i], CS);
            text("GEMS", 14, OY, 1, "#5ee07a"); text(Math.min(this.cleared, 45) + "/45", 14, OY + 12, 1, "#fff");
            // progress bar to 45
            x.fillStyle = "#3a342c"; x.fillRect(13, OY + 22, 82, 7);
            x.fillStyle = "#0e0c24"; x.fillRect(14, OY + 23, 80, 5);
            var bw = Math.round(this.shownGems / 45 * 80);
            x.fillStyle = "#30c050"; x.fillRect(14, OY + 23, bw, 5);
            x.fillStyle = "#9cf0a8"; x.fillRect(14, OY + 23, bw, 1);
            if (bw > 2 && this.timer % 50 < 25) { x.fillStyle = "#fff"; x.fillRect(14 + bw - 1, OY + 23, 1, 5); }
            text("SCORE", 14, OY + 34, 1, "#ffe14d"); text("" + this.score, 14, OY + 46, 1, "#fff");
            text("LEVEL", 14, OY + 68, 1, "#9cc0ff"); text("" + (Math.floor(this.cleared / 10) + 1), 14, OY + 80, 1, "#fff");
            if (this.chain > 1 && this.flash > 0) text("CHAIN X" + this.chain, 14, OY + 104, 1, "#ff8a8a");
            for (i = 0; i < this.pops.length; i++) { var po = this.pops[i];
              if (po.big) { text(po.s, po.x + 1, (po.y | 0) + 1, 1, "#000", true); text(po.s, po.x, po.y | 0, 1, po.t % 8 < 4 ? "#fff" : po.col, true); }
              else text(po.s, po.x, po.y | 0, 1, po.col || "#ffe14d", true); }
            if (this.over) text("OVERFLOW", OX + WW / 2, OY + WH / 2, 1, "#ff8a8a", true);
          }
        };
