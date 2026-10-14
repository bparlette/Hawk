def sub(f, a, b):
    s = open(f).read(); assert s.count(a) == 1, (f, a[:70], s.count(a)); s = s.replace(a, b); open(f, 'w').write(s)
N = '/workspace/work/live11/src/07_news.js'
M = '/workspace/work/live11/src/09_main.js'
# officer gets winded after 4 s of sprinting, gives up after 12 s
sub(N, "      const sp = 5.2; f.vel.set(", "      const sp = COP.chaseT < 4 ? 5.2 : 3.9; if (COP.chaseT >= 4 && !COP.winded) { COP.winded = true; spawnSprite(WTX.huff, _w.set(f.pos.x, 2.5, f.pos.z), 0.7, 1.2, { kind: 'word', aspect: 512 / 160 }); }\n      f.vel.set(")
sub(N, "} else if (COP.farT > 1.5 || COP.chaseT > 14 || RT.v > 48) {", "} else if (COP.farT > 1.5 || COP.chaseT > 12 || RT.v > 48) {")
sub(N, "f.root.visible = true; f.set('run'); COP.chaseT = 0; COP.farT = 0;", "f.root.visible = true; f.set('run'); COP.chaseT = 0; COP.farT = 0; COP.winded = false;")
sub(N, "yum: wordTex('+HP', '#7dff6b'),", "yum: wordTex('+HP', '#7dff6b'), huff: wordTex('HUFF.. PUFF..', '#c9a6ff'),")
# ratings: halve the gains (peaks were pinning at 100)
sub(N, "const g = gain((heavy ? 2.0 : 1.0) * (1 + Math.min(S.combo, 12) * 0.06) * (air ? 1.3 : 1),", "const g = gain((heavy ? 1.2 : 0.6) * (1 + Math.min(S.combo, 12) * 0.05) * (air ? 1.3 : 1),")
sub(N, "const g = gain(7 + (e.big ? 4 : 0), 'TAKEDOWN', false, e);", "const g = gain(5 + (e.big ? 3 : 0), 'TAKEDOWN', false, e);")
# bot: wider kite loop; never swing while a thug is going for the crew (so the knockdown test happens)
sub(M, "const a = Math.atan2(hero.pos.x, hero.pos.z - 34) + 0.75 * BOTR.dir; BOTR.wp = [Math.sin(a) * 5.5, 34 + Math.cos(a) * 5.5];", "const a = Math.atan2(hero.pos.x, hero.pos.z - 34) + 0.7 * BOTR.dir; BOTR.wp = [Math.sin(a) * 7, 34 + Math.cos(a) * 7];")
sub(M, "      if (d < 2.4) { BOTR.atkT -= dt;", "      const hold = enemies.some((q) => q.tgtCrew) && !crewDown; // let the camera-shy thug reach the crew (tests the knockdown)\n      if (d < 2.4 && !hold) { BOTR.atkT -= dt;")
print('ok')
