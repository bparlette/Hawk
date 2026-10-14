s=open('q4e0.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:70])
    s=s.replace(a,b)
rep("this.fl = 0; this.flCol = \"#fff\";","this.st = { pieces: 0, maxChain: 0 }; this.tally = null; this.fl = 0; this.flCol = \"#fff\";")
rep("spawn: function () { this.p =","spawn: function () { this.st.pieces++; this.p =")
rep("this.marks = M; this.flash = 24; this.chain++;","this.marks = M; this.flash = 24; this.chain++; this.st.maxChain = Math.max(this.st.maxChain, this.chain);")
rep("this.won = 1; SFX.win();","this.won = 1; this.tally = [[\"GEMS CLEARED\", 45], [\"BEST CHAIN\", \"X\" + this.st.maxChain], [\"PIECES DROPPED\", this.st.pieces], [\"SECONDS\", Math.round(this.timer / 60)]]; SFX.win();")
# titleArt
rep("          music: { step: 8,","""          titleArt: function (x, t) {
            if (!this.SX) this.SX = this.buildSprites();
            var S = this.SX, i, c, r, CW = 14, WX = 118, WY = 50, NR = 8, PAL = this.PAL;
            function gm(v, px, py, sz) { var sp = S.gem[v]; if (sp.cv) x.drawImage(sp.cv, px, py, sz, sz); else { x.fillStyle = PAL[v][0]; x.fillRect(px + 1, py + 1, sz - 2, sz - 2); } }
            // torches glow
            for (i = 0; i < 2; i++) { var tx = i ? WX + 6 * CW + 24 : WX - 24, fl = Math.sin(t * 0.35 + i * 2);
              x.fillStyle = "rgba(255,170,60," + (0.14 + 0.04 * fl).toFixed(2) + ")"; x.beginPath(); x.arc(tx, 96, 24, 0, 6.3); x.fill();
              x.fillStyle = "#3a342c"; x.fillRect(tx - 1, 100, 3, 12); x.fillStyle = "#e0401a"; x.fillRect(tx - 2, 91, 5, 9); x.fillStyle = "#ff9a20"; x.fillRect(tx - 1, 93 - (fl > 0 ? 1 : 0), 3, 7); x.fillStyle = "#fff1a0"; x.fillRect(tx, 96, 1, 3); }
            // stone frame + dark well
            x.fillStyle = "#6c6458"; x.fillRect(WX - 6, WY - 5, 6 * CW + 12, NR * CW + 11); x.fillStyle = "#a89c88"; x.fillRect(WX - 6, WY - 5, 6 * CW + 12, 1);
            x.fillStyle = "#c89a28"; x.fillRect(WX - 6, WY - 5, 3, 3); x.fillRect(WX + 6 * CW + 3, WY - 5, 3, 3);
            x.fillStyle = "#0e0c24"; x.fillRect(WX, WY, 6 * CW, NR * CW + 1);
            var stack = [[0, 3, 4, 1, 5, 2], [2, 0, 5, 4, 3, 1], [4, 2, 1, 5, 0, 3]];
            for (r = 0; r < 3; r++) for (c = 0; c < 6; c++) gm(stack[r][c], WX + c * CW, WY + (NR - 3 + r) * CW + 1, CW);
            // falling stick, new column each 100 frames, lands, blinks white, then bursts
            var cyc = (t / 100 | 0), ph = t % 100, col = (cyc * 5 + 1) % 6, cg = [(cyc + 1) % 6, (cyc + 3) % 6, (cyc + 4) % 6];
            var ty = WY + Math.min(ph, 60) / 60 * ((NR - 3 - 3) * CW) + 1;
            for (i = 0; i < 3; i++) { if (ph > 70 && (ph >> 2) % 2) { var wsp = S.white[cg[i]]; if (wsp.cv) x.drawImage(wsp.cv, WX + col * CW, ty + i * CW, CW, CW); } else gm(cg[i], WX + col * CW, ty + i * CW, CW); }
            if (ph > 92) for (i = 0; i < 10; i++) { var an = i * 0.63 + cyc, rr = (ph - 92) * 3; x.fillStyle = i % 2 ? "#fff" : PAL[cg[i % 3]][1]; x.fillRect((WX + col * CW + 7 + Math.cos(an) * rr) | 0, (ty + 21 + Math.sin(an) * rr) | 0, 2, 2); }
            // big floating gems either side + the miner
            var big = [[52, 98, 0], [84, 132, 4], [268, 98, 5], [236, 132, 3]];
            for (i = 0; i < big.length; i++) { var sp = S.gem[big[i][2]], by = big[i][1] + Math.round(Math.sin(t / 22 + i * 1.7) * 4);
              if (sp.cv) x.drawImage(sp.cv, big[i][0] - sp.w, by - sp.h * 2, sp.w * 2, sp.h * 2);
              if ((t + i * 37) % 80 < 6) { x.fillStyle = "#fff"; x.fillRect(big[i][0] - 5, by - sp.h * 2 + 5, 2, 2); x.fillRect(big[i][0] - 6, by - sp.h * 2 + 6, 4, 1); } }
            this.blit(x, ph > 60 && ph < 100 ? S.m_cheer : (t % 170 < 7 ? S.m_blink : S.m_idle), 62, 164 - (ph > 60 && ph < 100 ? Math.abs(Math.sin(t * 0.3)) * 4 | 0 : 0));
            x.fillStyle = "#3a342c"; x.fillRect(40, 164, 44, 3); x.fillStyle = "#8a8070"; x.fillRect(40, 164, 44, 1);
          },
          music: { step: 8,""")
# HUD icon chips
old='text("GEMS", 14, OY, 1, "#5ee07a");'
rep(old,'''this.hudIcon(x, 0, 13, OY - 1); text("GEMS", 26, OY, 1, "#5ee07a");''')
rep('text("SCORE", 14, OY + 34, 1, "#ffe14d");','this.hudIcon(x, 1, 13, OY + 33); text("SCORE", 26, OY + 34, 1, "#ffe14d");')
rep('text("LEVEL", 14, OY + 68, 1, "#9cc0ff");','this.hudIcon(x, 2, 13, OY + 67); text("LEVEL", 26, OY + 68, 1, "#9cc0ff");')
rep("          // highest occupied row index","""          // 9px HUD icon chips: 0 gem, 1 coin, 2 level chevrons
          hudIcon: function (x, k, px, py) {
            x.fillStyle = "#1a1612"; x.fillRect(px, py, 11, 9);
            x.fillStyle = "#3a342c"; x.fillRect(px + 1, py + 1, 9, 7);
            if (k === 0) { var sp = this.SX.gem[3]; if (sp.cv) x.drawImage(sp.cv, px + 1, py, 9, 9); else { x.fillStyle = "#30c050"; x.fillRect(px + 3, py + 2, 5, 5); } }
            else if (k === 1) { x.fillStyle = "#c89a28"; x.fillRect(px + 3, py + 2, 5, 5); x.fillRect(px + 2, py + 3, 7, 3); x.fillStyle = "#ffe14d"; x.fillRect(px + 3, py + 3, 3, 3); x.fillStyle = "#fff"; x.fillRect(px + 4, py + 3, 1, 1); }
            else { x.fillStyle = "#9cc0ff"; x.fillRect(px + 5, py + 2, 1, 1); x.fillRect(px + 4, py + 3, 3, 1); x.fillRect(px + 3, py + 4, 5, 1); x.fillStyle = "#3070f0"; x.fillRect(px + 5, py + 5, 1, 1); x.fillRect(px + 4, py + 6, 3, 1); }
          },
          // highest occupied row index""")
open('q4e.html','w').write(s)
