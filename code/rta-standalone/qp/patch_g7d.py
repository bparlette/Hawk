s=open('qp/q7d0.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:70]); s=s.replace(a,b)
rep('''          smash: function () { beep(320, 0.08, "square", 0.07); beep(180, 0.12, "sawtooth", 0.06); }
        };''','''          smash: function () { noise(0.25, 0.09, 700); kick(); beep(320, 0.08, "square", 0.07); beep(180, 0.12, "sawtooth", 0.06); setTimeout(function () { beep(660, 0.08, "square", 0.05); }, 70); },
          shot: function () { noise(0.14, 0.12, 500); kick(); beep(180, 0.1, "sawtooth", 0.08); beep(90, 0.08, "square", 0.07); },
          click: function () { beep(1800, 0.02, "square", 0.04); noise(0.02, 0.03, 4000); },
          quack: function () { beep(420, 0.07, "sawtooth", 0.035); setTimeout(function () { beep(360, 0.09, "sawtooth", 0.035); }, 80); },
          flap: function () { noise(0.05, 0.02, 1800); },
          whistle: function (f) { beep(f, 0.06, "sine", 0.03); },
          thud: function () { kick(); noise(0.12, 0.08, 300); },
          laugh: function () { var i; for (i = 0; i < 8; i++) (function (f, d) { setTimeout(function () { beep(f, 0.07, "square", 0.045); }, d); })(i % 2 ? 330 : 392, i * 90); },
          yap: function () { beep(660, 0.06, "square", 0.05); setTimeout(function () { beep(880, 0.08, "square", 0.05); }, 90); setTimeout(function () { beep(988, 0.1, "square", 0.05); }, 190); },
          away: function () { var i; for (i = 0; i < 5; i++) (function (f, d) { setTimeout(function () { beep(f, 0.08, "triangle", 0.05); }, d); })(900 - i * 120, i * 70); },
          streak: function () { beep(1047, 0.06, "square", 0.04); setTimeout(function () { beep(1319, 0.1, "square", 0.04); }, 70); },
          fail: function () { var n = [392, 330, 262, 196], i; for (i = 0; i < n.length; i++) (function (f, d) { setTimeout(function () { beep(f, 0.18, "sawtooth", 0.06); }, d); })(n[i], i * 150); }
        };''')
rep('win: function () { beep(523, 0.12); setTimeout(function(){beep(659,0.12);},110); setTimeout(function(){beep(880,0.2);},220); },',
    'win: function () { var n = [523, 659, 784, 1047, 784, 1047, 1319], i; for (i = 0; i < n.length; i++) (function (f, d) { setTimeout(function () { beep(f, 0.14, "square", 0.05); beep(f / 2, 0.14, "triangle", 0.05); }, d); })(n[i], i * 110); },')
# hook points
rep('this.state = "fly"; beep(700, 0.05, "square", 0.04);','this.state = "fly"; SFX.quack();')
rep('beep(300, 0.2, "sawtooth", 0.04); this.pop("FLY AWAY"','SFX.away(); this.pop("FLY AWAY"')
rep('this.rec = 7; this.burst','this.rec = 7; SFX.shot(); this.burst')
rep('this.pop(this.ammo > 0 ? "MISS" : "LAST SHOT"','if (this.ammo === 0) SFX.click(); this.pop(this.ammo > 0 ? "MISS" : "LAST SHOT"')
rep('this.streak++; if (this.streak >= 2) this.pop(','this.streak++; if (this.streak >= 2) SFX.streak(); if (this.streak >= 2) this.pop(')
rep('this.shk = 4; this.burst(d.x, 196, 12','SFX.thud(); this.shk = 4; this.burst(d.x, 196, 12')
rep('if (this.timer % 3 === 0) this.feathers(d.x, d.y, 1); d.fall += 0.26;','if (this.timer % 3 === 0) this.feathers(d.x, d.y, 1); if (this.timer % 4 === 0) SFX.whistle(900 - Math.min(600, d.fall * 90)); d.fall += 0.26;')
rep('else { this.failT = 100; this.pop("ONLY " + this.hits + "/10 - TRY AGAIN", 160, 100); beep(200, 0.4, "sawtooth", 0.08); }','else { this.failT = 100; this.pop("ONLY " + this.hits + "/10 - TRY AGAIN", 160, 100); SFX.fail(); }')
rep('this.burst(this.dog.x, 198, 14','if (hit) SFX.yap(); else SFX.laugh(); this.burst(this.dog.x, 198, 14')
# wingbeats: after d.life++ when flying
rep('              d.life++;\n','              d.life++; if (!d.away && d.life % 8 === 0) SFX.flap(); else if (d.away && d.life % 5 === 0) SFX.flap();\n')
rep('  goal: "AIM WITH','  XX')if False else None
# music property
rep('          goal: "AIM WITH THE STICK.','''          music: { step: 7, lead: "square",
            mel: [523,0,659,0,784,0,659,523, 587,0,698,0,880,0,698,587, 523,0,659,0,784,0,1047,784, 698,0,659,0,587,0,523,0],
            bass: [131,0,131,131,196,0,196,131, 147,0,147,147,220,0,220,147, 131,0,131,131,196,0,196,131, 175,0,175,175,196,0,196,0],
            drum: "k.hks.h.k.hks.hh" },
          goal: "AIM WITH THE STICK.''')
open('qp/q7d.html','w').write(s); print('ok')
