          buildSprites: function () {
            var mk = this.mk.bind(this), S = {};
            var HP = { R: "#e8343a", S: "#f6c9a0", Y: "#5a2a0a", B: "#3a6fe0", O: "#ffd23a", k: "#140a12", W: "#ffffff" };
            var head = ["...RRRRR....", "..RRRRRRRRR.", "..YYYSSkS...", ".YSYSSSkSSS.", ".YSYYSSSSSSS", ".YYSSSSYYYY.", "...SSSSSSS.."];
            var hurtHead = ["...RRRRR....", "..RRRRRRRRR.", "..YYYSkSk...", ".YSYSSSkSSS.", ".YSYYSkSkSSS", ".YYSSSWWYY..", "...SSSSSSS.."];
            var torso = ["..RRBRRR....", ".RRRBRRBRR..", "RRRRBBBBRRRR", "SSRBOBBOBRSS", "SS.BBBBBB.SS"];
            var torsoF = ["..RRBRRR....", ".RRRBRRBRR..", ".RRRBBBBRRRS", "..SBOBBOBRSS", "..SBBBBBB..."];
            var torsoB = ["..RRBRRR....", ".RRRBRRBRR..", "SRRRBBBBRR..", "SSRBOBBOBS..", "...BBBBBB..."];
            var torsoJ = ["..RRBRRR.SS.", ".RRRBRRBRRS.", "SRRRBBBBRR..", "SSRBOBBOB...", "...BBBBBB..."];
            var torsoH = ["S.RRBRRR..S.", "SRRRBRRBRRS.", ".RRRBBBBRR..", "..RBOBBOB...", "...BBBBBB..."];
            var legs = {
              idle: ["..BBB.BBB...", "..BBB.BBB...", ".YYY...YYY..", "YYYY...YYYY."],
              r1: [".BBB...BBB..", "BBB.....BBB.", "YY.......YYY", "YYY.......YY"],
              r2: ["...BBBBB....", "...BBBB.....", "...YYYY.....", "...YYYYY...."],
              r3: ["..BBB..BBB..", ".BBB....BBB.", "YYY......YY.", "YY.......YYY"],
              r4: ["...BBBBB....", "....BBBB....", "....YYYY....", "....YYYYY..."],
              jump: ["..BBB.BBBB..", ".BBB....BBY.", ".YY.....YYY.", "YY.........."]
            };
            S.idle = mk(head.concat(torso, legs.idle), HP);
            S.run = [mk(head.concat(torsoF, legs.r1), HP), mk(head.concat(torso, legs.r2), HP), mk(head.concat(torsoB, legs.r3), HP), mk(head.concat(torso, legs.r4), HP)];
            S.jump = mk(head.concat(torsoJ, legs.jump), HP);
            S.hurt = mk(hurtHead.concat(torsoH, legs.idle), HP);
            S.climb = mk(["...RRRRR....", "..RRRRRRRR..", "..YYYYYYYY..", "..YYYYYYYY..", "..YYYYYYYY..", "...YYYYYY...", "SS.SSSSSS...",
              "SRRRBRRBRR..", ".RRRBRRBRRR.", "..RRBRRBRRSS", "..RBBBBBBRSS", "...BBBBBB...", "..BBB..BBB..", "..BBB..BB...", ".YYY...YY...", ".YYY........"], HP);
            // barrels: 4-frame rolling side view + 2-frame end-on (ladder drop)
            var BP = { O: "#d98b2b", d: "#8a4f14", h: "#5a3010", L: "#f2b45a" };
            S.barrel = [];
            for (var ph = 0; ph < 4; ph++) {
              var rows = ["...OOOOOO...", ".OOOOOOOOOO.", "OOOOOOOOOOOO", "OOOOOOOOOOOO", "OOOOOOOOOOOO", "OOOOOOOOOOOO", "OOOOOOOOOOOO", "OOOOOOOOOOOO", ".OOOOOOOOOO.", "...OOOOOO..."];
              rows = rows.map(function (rw, ri) {
                var a = rw.split("");
                for (var ci = 0; ci < 12; ci++) {
                  if (a[ci] !== "O") continue;
                  if (ci === 2 + ph * 2 || ci === 2 + ((ph + 2) % 4) * 2) a[ci] = "d";
                  if (ri === 2 && ci === 3 + ph) a[ci] = "L";
                }
                return a.join("");
              });
              S.barrel.push(mk(rows, BP));
            }
            S.barrelEnd = [mk(["...hhhhhhhh...", ".hhOOOOOOOOhh.", "hOOOOOOOOOOOOh", "hOOOOdddOOOOOh", "hOOOdOOOdOOOOh", "hOOOdOOOdOOOOh", "hOOOOdddOOOOOh", "hOOOOOOOOOOOOh", ".hhOOOOOOOOhh.", "...hhhhhhhh..."], BP),
                           mk(["...hhhhhhhh...", ".hhOOOOOOOOhh.", "hOOOOOOOOOOOOh", "hOOOOOdddOOOOh", "hOOOOdOOOdOOOh", "hOOOOdOOOdOOOh", "hOOOOOdddOOOOh", "hOOOOOOOOOOOOh", ".hhOOOOOOOOhh.", "...hhhhhhhh..."], BP)];
            // ape: body (2 faces), arms, fists, legs
            var AP = { F: "#b35c1e", M: "#f0c080", k: "#1a0804", W: "#ffffff" };
            var top = ["........FFFFFFFFFFFFFF........", ".....FFFFFFFFFFFFFFFFFFFF.....", "...FFFFFFFFFFFFFFFFFFFFFFFF...", "..FFFFFFkkkkkFFFFkkkkkFFFFFF..", "..FFFFFFWWkWFFFFFFWkWWFFFFFF..",
              "..FFFFFMMMMMMMMMMMMMMMMFFFFF..", ".FFFFFMMMMMkMMMMkMMMMMMFFFFFF."];
            var calm = [".FFFFFMMMMMMMMMMMMMMMMMMFFFFF.", ".FFFFFMMMMMMMMMMMMMMMMMMFFFFF.", ".FFFFFMMMMkkkkkkkkkkMMMMFFFFF.", ".FFFFFFMMMMMMMMMMMMMMMMFFFFFF.", ".FFFFFFFMMMMMMMMMMMMMMFFFFFFF."];
            var roar = [".FFFFFMMMMMMMMMMMMMMMMMMFFFFF.", ".FFFFFMkkkkkkkkkkkkkkkkMFFFFF.", ".FFFFFMkWWWWWWWWWWWWWWkMFFFFF.", ".FFFFFFMkkkkkkkkkkkkkkMFFFFFF.", ".FFFFFFFMMMMMMMMMMMMMMFFFFFFF."];
            var chest = ["FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", "FFFFFFFFMMMMMMMMMMMMMMFFFFFFFF", "FFFFFFFMMMMMMMMMMMMMMMMFFFFFFF", "FFFFFFFMMMMMMMMMMMMMMMMFFFFFFF", "FFFFFFFMMMMMMMMMMMMMMMMFFFFFFF",
              "FFFFFFFFMMMMMMMMMMMMMMFFFFFFFF", "FFFFFFFFFMMMMMMMMMMMMFFFFFFFFF", ".FFFFFFFFFFFFFFFFFFFFFFFFFFFF.", "..FFFFFFFFFFFFFFFFFFFFFFFFFF..", "...FFFFFFFFFFFFFFFFFFFFFFFF..."];
            S.ape = [mk(top.concat(calm, chest), AP), mk(top.concat(roar, chest), AP)];
            var armD = ["..FFF..", ".FFFFF.", "FFFFFFF", "FFFFFFF", "FFFFFFF", "FFFFFFF", "FFFFFFF", "FFFFFFF", "FFFFFFF", ".FFFFF.", "MMMMMMM", ".MMMMM."];
            S.armD = mk(armD, AP);
            S.armU = mk(armD.slice().reverse().map(function (r) { return r.slice(0, 6); }), AP);
            S.armH = mk(["..FFFFFFFF..", ".FFFFFFFFFMM", "FFFFFFFFFFMM", "FFFFFFFFFFMM", ".FFFFFFFFFMM", "..FFFFFFFF.."], AP);
            S.fist = mk([".FFFFFF.", "FFFFFFFF", "FFFFFFFF", "FFFFFFFF", "FFFFFFFF", "FFFFFFFF", "MMMMMMMM", "MMMMMMMM", ".MMMMMM."], AP);
            S.leg = mk(["FFFFFFFF", "FFFFFFFF", "FFFFFFFF", "FFFFFFFF", "FFFFFFFF", ".FFFFFF.", "MMMMMMMM", "MMMMMMMM"], AP);
            // rescuee: 2 frames (still / waving)
            var RP = { O: "#ffe14d", S: "#f6c9a0", P: "#ff6fd0", p: "#c23f9a", k: "#140a12" };
            var rh = ["...OOOOO....", "..OOOOOOO...", "..OOSSSSOO..", "..OSSkSkSO..", "..OSSSSSSO..", "..OOSSSSOO..", "...O.SS.O...", "...PPPPPP...", "S.PPPPPPPP.S", "SPPPPPPPPPPS"];
            var rb = ["..PPPPPPPP..", "..PPpPPpPP..", ".PPPPPPPPPP.", ".PPPPPPPPPP.", "PPPPPPPPPPPP", "PpPPpPPpPPpP", "..SS....SS..", "..SS....SS..", ".kkk...kkk.."];
            var rw = ["...OOOOO....", "..OOOOOOO...", "..OOSSSSOO..", "..OSSkSkSO.S", "..OSSSSSSO.S", "..OOSSSSOOS.", "...O.SS.OS..", "...PPPPPPP..", "S.PPPPPPPP..", "SPPPPPPPPP.."];
            S.lady = [mk(rh.concat(rb), RP), mk(rw.concat(rb), RP)];
            var HM = ["GGGGGGGGGG", "GgGGGGGGGG", "GGGGGGGGGG", "GGGGGGGGGG", "....HH....", "....HH....", "....HH....", "....HH....", "....HH....", "....HH....", "....HH....", "....HH...."];
            S.hammer = mk(HM, { G: "#e8e8e8", g: "#ffffff", H: "#c9a227" });
            S.hammerHot = mk(HM, { G: "#ff6f6f", g: "#ffd0d0", H: "#c9a227" });
            return S;
          },
