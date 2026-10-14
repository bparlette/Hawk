s=open('q4d0.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:70])
    s=s.replace(a,b)
rep('          goal: "DROP GEM STICKS.','''          music: { step: 8, lead: "square",
            mel: [659,0,523,0,587,659,0,0, 523,0,440,0,494,523,0,0, 587,0,698,0,659,587,0,0, 523,494,440,0,392,0,0,0],
            bass: [110,0,110,0,110,0,131,0, 87,0,87,0,87,0,110,0, 98,0,98,0,98,0,123,0, 82,0,82,0,110,0,82,0],
            drum: "k.h.s.h.k.h.s.hk" },
          goal: "DROP GEM STICKS.''')
# lock thunk with noise
rep('beep(110, 0.09, "triangle", 0.1); beep(70, 0.12, "square", 0.04);','beep(110, 0.09, "triangle", 0.1); beep(70, 0.12, "square", 0.04); noise(0.07, 0.05, 500); kick();')
# move tick
rep('P.c += dx; beep(300, 0.03, "square", 0.03); }','P.c += dx; beep(300 + P.c * 14, 0.03, "square", 0.03); noise(0.015, 0.012, 5000); }')
# rotate swoosh
rep('P.g.unshift(P.g.pop()); beep(520, 0.04, "triangle", 0.04); }','P.g.unshift(P.g.pop()); beep(520, 0.04, "triangle", 0.04); setTimeout(function () { beep(780, 0.05, "triangle", 0.035); }, 35); noise(0.05, 0.02, 3500); }')
# clear sparkle: noise + arpeggio
rep('            beep(f0, 0.08, "square", 0.05);','            noise(0.14, 0.04, 4500); beep(f0, 0.08, "square", 0.05);')
rep('if (mult > 1) setTimeout(function () { beep(f0 * 2, 0.16, "triangle", 0.045); }, 130);','if (mult > 1) setTimeout(function () { beep(f0 * 2, 0.16, "triangle", 0.045); noise(0.2, 0.04, 6500); }, 130);\n            if (mult > 2) setTimeout(function () { beep(f0 * 2.5, 0.2, "square", 0.04); kick(); }, 200);')
# danger heartbeat with kick
rep('if (this.danger && this.timer % 40 === 0) beep(240, 0.06, "square", 0.03);','if (this.danger && this.timer % 40 === 0) { beep(240, 0.06, "square", 0.03); kick(); }')
# overflow: crash
rep('SFX.hit(); this.burst(this.OX','SFX.hit(); noise(0.5, 0.09, 300); kick(); setTimeout(function () { beep(110, 0.4, "sawtooth", 0.06); }, 120); this.burst(this.OX')
# win fanfare
rep('this.won = 1; SFX.win(); this.fl','this.won = 1; SFX.win(); [784, 988, 1175, 1568].forEach(function (f, i) { setTimeout(function () { beep(f, 0.16, "square", 0.04); noise(0.04, 0.02, 7000); }, 260 + i * 110); }); this.fl')
open('q4d.html','w').write(s)
