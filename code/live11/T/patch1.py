def sub(f, a, b):
    s = open(f).read(); assert s.count(a) == 1, (f, a[:60], s.count(a)); s = s.replace(a, b); open(f, 'w').write(s)
F = '/workspace/work/live11/src/09_main.js'
sub(F, "      updateReplay(rdt); newsHud(0, rdt); updateChyron(rdt);", "      const vt = SIM ? Math.max(rdt, SIM / 120) : rdt; // ?sim=N: replay + chyron run on (scaled) game time so slow headless frames don't stretch them\n      updateReplay(vt); newsHud(0, vt); updateChyron(vt);")
sub(F, "updateSprites(rdt); updateSlashes(rdt); hud(rdt); newsHud(dt, rdt); updateChyron(rdt);", "updateSprites(rdt); updateSlashes(rdt); hud(rdt); newsHud(dt, SIM ? steps / 60 : rdt); updateChyron(SIM ? steps / 60 : rdt);")
print('ok')
