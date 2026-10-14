          /* ---- pixel-map sprite kit: string rows -> offscreen canvas, auto 1px dark outline + 2-tone rim shading ---- */
          mk: function (rows, pal, ol) {
            var h = rows.length, w = 0, r, c, px = [];
            for (r = 0; r < h; r++) w = Math.max(w, rows[r].length);
            function at(cc, rr) { return rr < 0 || rr >= h || cc < 0 || cc >= rows[rr].length ? "." : rows[rr][cc]; }
            function tone(hex, f) {
              var n = parseInt(hex.slice(1), 16), R = (n >> 16) * f, G = ((n >> 8) & 255) * f, B = (n & 255) * f;
              if (f > 1) { R += 18; G += 18; B += 18; }
              return "rgb(" + Math.min(255, R | 0) + "," + Math.min(255, G | 0) + "," + Math.min(255, B | 0) + ")";
            }
            for (r = -1; r <= h; r++) for (c = -1; c <= w; c++) {
              var ch = at(c, r);
              if (ch === ".") {
                if (at(c - 1, r) !== "." || at(c + 1, r) !== "." || at(c, r - 1) !== "." || at(c, r + 1) !== ".") px.push([c + 1, r + 1, ol || "#140a12"]);
                continue;
              }
              var col = pal[ch] || "#f0f", flat = "kWw".indexOf(ch) >= 0;
              if (!flat) {
                if (at(c + 1, r + 1) !== ch && (at(c, r + 1) !== ch || at(c + 1, r) !== ch)) col = tone(col, 0.66);
                else if (at(c - 1, r - 1) === "." || (at(c, r - 1) === "." && at(c - 1, r) === ".")) col = tone(col, 1.22);
              }
              px.push([c + 1, r + 1, col]);
            }
            var cv = null;
            if (typeof document !== "undefined" && document.createElement) {
              try { cv = document.createElement("canvas"); cv.width = w + 2; cv.height = h + 2; var g = cv.getContext("2d"); for (var i = 0; i < px.length; i++) { g.fillStyle = px[i][2]; g.fillRect(px[i][0], px[i][1], 1, 1); } } catch (e) { cv = null; }
            }
            return { w: w + 2, h: h + 2, cv: cv, px: px };
          },
          /* draw sprite s centred on cx with its bottom edge at by; flip mirrors it */
          blit: function (x, s, cx, by, flip) {
            var x0 = Math.round(cx - s.w / 2), y0 = Math.round(by - s.h);
            if (s.cv) {
              if (flip) { x.save(); x.translate(x0 + s.w, y0); x.scale(-1, 1); x.drawImage(s.cv, 0, 0); x.restore(); }
              else x.drawImage(s.cv, x0, y0);
              return;
            }
            for (var i = 0; i < s.px.length; i++) { var p = s.px[i]; x.fillStyle = p[2]; x.fillRect(flip ? x0 + s.w - 1 - p[0] : x0 + p[0], y0 + p[1], 1, 1); }
          },
