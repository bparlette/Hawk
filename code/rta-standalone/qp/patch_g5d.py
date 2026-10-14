s=open('qp/q5d0.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80])
    s=s.replace(a,b)
rep('''          smash: function () { beep(320, 0.08, "square", 0.07); beep(180, 0.12, "sawtooth", 0.06); }
        };''','''          smash: function () { beep(320, 0.08, "square", 0.07); beep(180, 0.12, "sawtooth", 0.06); },
          flap: function () { noise(0.06, 0.028, 2600); beep(300 + Math.random() * 60, 0.05, "triangle", 0.03); },
          stomp: function () { beep(880, 0.05, "square", 0.06); beep(520, 0.08, "square", 0.06); noise(0.1, 0.07, 1800); setTimeout(function () { beep(300, 0.1, "triangle", 0.06); }, 60); },
          pop: function () { noise(0.14, 0.09, 900); beep(700, 0.05, "square", 0.05); beep(240, 0.14, "sawtooth", 0.06); },
          dead: function () { kick(); noise(0.35, 0.07, 500); beep(330, 0.1, "square", 0.06); setTimeout(function () { beep(247, 0.12, "square", 0.06); }, 100); setTimeout(function () { beep(165, 0.3, "sawtooth", 0.06); }, 220); },
          splash: function () { noise(0.32, 0.075, 350); beep(150, 0.16, "triangle", 0.06); setTimeout(function () { noise(0.2, 0.04, 800); }, 90); },
          land: function () { noise(0.05, 0.04, 700); beep(110, 0.07, "triangle", 0.05); },
          step: function () { noise(0.025, 0.022, 3000); },
          bonk: function () { beep(180, 0.06, "square", 0.06); noise(0.05, 0.05, 600); },
          clink: function () { beep(200, 0.05, "square", 0.05); beep(310, 0.05, "square", 0.04); },
          spawn: function () { beep(523, 0.06, "square", 0.04); setTimeout(function () { beep(659, 0.06, "square", 0.04); }, 60); setTimeout(function () { beep(784, 0.06, "square", 0.04); }, 120); setTimeout(function () { beep(1047, 0.1, "square", 0.04); }, 180); },
          chomp: function () { noise(0.08, 0.09, 700); beep(90, 0.14, "sawtooth", 0.08); },
          thunder: function () { noise(0.7, 0.08, 180); beep(55, 0.45, "sawtooth", 0.03); }
        };''')
rep('''win: function () { beep(523, 0.12); setTimeout(function(){beep(659,0.12);},110); setTimeout(function(){beep(880,0.2);},220); },''',
 '''win: function () { var n = [523, 659, 784, 1047, 784, 1047, 1319], i; for (i = 0; i < n.length; i++) (function (f, d) { setTimeout(function () { beep(f, 0.14, "square", 0.05); beep(f / 2, 0.14, "triangle", 0.05); }, d); })(n[i], i * 110); },''')
rep('pick: function () { beep(880, 0.07); beep(1180, 0.07); },','pick: function () { beep(880, 0.07); beep(1180, 0.07); setTimeout(function () { beep(1568, 0.1, "square", 0.05); }, 70); },')
# calls
rep('beep(420, 0.04, "square", 0.03); this.burst(P.x - P.face * 2','SFX.flap(); this.burst(P.x - P.face * 2')
rep('P.vy = -1.2; SFX.smash(); }','P.vy = -1.2; SFX.stomp(); }')
rep('P.vx = cx > 0 ? -1.2 : 1.2; SFX.smash();','P.vx = cx > 0 ? -1.2 : 1.2; SFX.pop();')
rep('e.vx = -P.vx; beep(200, 0.05); }','e.vx = -P.vx; SFX.clink(); }')
rep('beep(140, 0.15, "triangle", 0.07); },\n          phys','SFX.splash(); },\n          phys')
rep('P.sink = water; P.bal = 0; SFX.hit();','P.sink = water; P.bal = 0; if (!water) SFX.dead();')
rep('if (P.ground && !wasG && vyB > 0.7) this.burst(','if (P.ground && !wasG && vyB > 0.7) { SFX.land(); } if (P.ground && !wasG && vyB > 0.7) this.burst(')
rep('this.timer % 8 === 0) this.burst(P.x - P.face * 4','this.timer % 8 === 0) { SFX.step(); this.burst(P.x - P.face * 4')
rep('"#cfd8f0", 2, 0.45, 11, 0, "d");','"#cfd8f0", 2, 0.45, 11, 0, "d"); }')
rep('if (P.bump) { this.burst(','if (P.bump) { SFX.bonk(); this.burst(')
rep('e.pump = 240; this.burst(','e.pump = 240; SFX.land(); this.burst(')
rep('this.bolt = 14; setTimeout(function () { beep(60, 0.35, "sawtooth", 0.025); }, 120);','this.bolt = 14; setTimeout(function () { SFX.thunder(); }, 120);')
rep('if (this.fish.t === 38) this.ripple(this.fish.x);','if (this.fish.t === 38) this.ripple(this.fish.x); if (this.fish.t === 22) SFX.chomp();')
rep('this.burst(this.p.x, this.p.y - 12, ["#fff", "#8ac0ff", "#ffd23a"], 14, 1.8, 22, 0); }','this.burst(this.p.x, this.p.y - 12, ["#fff", "#8ac0ff", "#ffd23a"], 14, 1.8, 22, 0); SFX.spawn(); }')
rep('          goal: "FLAP WITH A.','''          music: { step: 7, lead: "square",
            mel: [587,0,698,0,880,0,698,587, 784,0,698,0,587,0,0,0, 523,0,659,0,784,0,659,523, 698,0,587,0,523,0,466,440],
            bass: [73,0,73,0,73,0,110,0, 58,0,58,0,58,0,87,0, 65,0,65,0,65,0,98,0, 55,0,55,0,55,0,82,0],
            drum: "k.h.s.h.k.hks.h." },
          goal: "FLAP WITH A.''')
open('qp/q5d.html','w').write(s); print('ok')
