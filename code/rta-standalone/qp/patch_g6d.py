s=open('qp/q6d0.html').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:80]); s=s.replace(a,b)
rep('''          smash: function () { beep(320, 0.08, "square", 0.07); beep(180, 0.12, "sawtooth", 0.06); }
        };''','''          smash: function () { beep(320, 0.08, "square", 0.07); beep(180, 0.12, "sawtooth", 0.06); },
          bump: function () { kick(); noise(0.2, 0.09, 600); beep(160, 0.1, "square", 0.07); beep(90, 0.18, "sawtooth", 0.06); },
          spin: function () { noise(0.5, 0.07, 2500); var i; for (i = 0; i < 6; i++) (function (f, d) { setTimeout(function () { beep(f, 0.09, "sawtooth", 0.05); }, d); })(700 - i * 90, i * 70); setTimeout(function () { noise(0.25, 0.08, 400); }, 380); },
          cp: function () { var n = [523, 659, 784, 1047, 1319], i; for (i = 0; i < n.length; i++) (function (f, d) { setTimeout(function () { beep(f, 0.12, "square", 0.05); beep(f / 2, 0.12, "triangle", 0.05); }, d); })(n[i], i * 80); },
          timeup: function () { var n = [523, 440, 349, 262], i; for (i = 0; i < n.length; i++) (function (f, d) { setTimeout(function () { beep(f, 0.16, "sawtooth", 0.06); }, d); })(n[i], i * 140); },
          tick: function () { beep(880, 0.06, "square", 0.05); },
          whoosh: function () { noise(0.16, 0.035, 1200); },
          skid: function () { noise(0.09, 0.03, 4200); },
          rumble: function () { noise(0.05, 0.05, 250); }
        };''')
rep('''win: function () { beep(523, 0.12); setTimeout(function(){beep(659,0.12);},110); setTimeout(function(){beep(880,0.2);},220); },''',
 '''win: function () { var n = [523, 659, 784, 1047, 784, 1047, 1319], i; for (i = 0; i < n.length; i++) (function (f, d) { setTimeout(function () { beep(f, 0.14, "square", 0.05); beep(f / 2, 0.14, "triangle", 0.05); }, d); })(n[i], i * 110); },''')
rep("S.fr++; S.tick();","S.fr++; S.tick(); S.audio();")
meth='''  /* engine note rises with speed; tyre skid, brake squeal, gravel rumble, near-miss whoosh, countdown ticks */
  audio: function () {
    var sp = this.speed / this.MAX, fr = this.fr, i, c, pz = this.pos + this.PZ;
    if (sp > 0 && this.spin <= 0 && fr %% 3 === 0) beep(55 + sp * 150 + (fr %% 6 ? 0 : 6), 0.07, "sawtooth", 0.014);
    if (Math.abs(this.px) > 1 && sp > 0.12 && this.spin <= 0 && fr %% 4 === 0) SFX.rumble();
    if (this.brake && sp > 0.3 && fr %% 7 === 0) SFX.skid();
    else if (Math.abs(this.tilt) > 0.9 && sp > 0.6 && fr %% 14 === 0) SFX.skid();
    for (i = 0; i < this.cars.length; i++) { c = this.cars[i]; var dz = c.z - pz;
      if (dz < 0 && dz > -this.SEG * 0.5 && Math.abs(c.off - this.px) < 0.55 && fr - (c.ps || -99) > 90) { c.ps = fr; if (sp > 0.3) SFX.whoosh(); } }
    var ct = Math.ceil(this.time); if (ct !== this.lastCt) { this.lastCt = ct; if (ct <= 5 && ct > 0) SFX.tick(); }
  },
''' % ()
rep("  update: function (inp) {", meth+"  update: function (inp) {")
rep("this.shk = 10; this.hf = 14; car.hf = 14;","SFX.bump(); this.shk = 10; this.hf = 14; car.hf = 14;")
rep("this.shk = 12; this.hf = 18; this.flash = 4; this.pop('SPIN OUT!'","SFX.spin(); this.shk = 12; this.hf = 18; this.flash = 4; this.pop('SPIN OUT!'")
rep("S.confetti(50); S.flash = 5;","S.confetti(50); S.flash = 5; SFX.cp();")
rep("S.pop('TIME UP', '#ff6a5a'); return; }","S.pop('TIME UP', '#ff6a5a'); SFX.timeup(); return; }")
rep("  goal: \"A GAS","""  music: { step: 6, lead: "square",
    mel: [659,0,784,0,880,0,784,659, 698,0,880,0,698,0,587,0, 659,0,784,0,988,0,784,659, 587,0,698,0,784,0,659,0],
    bass: [55,0,55,55,55,0,55,55, 44,0,44,44,44,0,44,44, 49,0,49,49,49,0,49,49, 41,0,41,41,41,0,41,41],
    drum: "k.hks.h.k.hks.hh" },
  goal: "A GAS""")
s=s.replace('%%','%')
open('qp/q6d.html','w').write(s); print('ok')
