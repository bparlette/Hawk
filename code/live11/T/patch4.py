def sub(f, a, b):
    s = open(f).read(); assert s.count(a) == 1, (f, a[:70], s.count(a)); s = s.replace(a, b); open(f, 'w').write(s)
G = '/workspace/work/live11/src/06_game.js'
N = '/workspace/work/live11/src/07_news.js'
M = '/workspace/work/live11/src/09_main.js'
H = '/workspace/work/live11/site/index.html'
sub(G, "const o = CREW.op; if (CREW.state !== 'film' || fromPost > 17 || !heroOk) { e.tgtCrew = false; e.set('chase'); break; }",
       "const o = CREW.op; if (CREW.state !== 'film' || fromPost > 17 || !heroOk || e.st > 7) { e.tgtCrew = false; e.set('chase'); break; }")
sub(M, "      const nxt = enemies.find((e) => e.alive && e.state !== 'dead' && e.state !== 'dying');\n      if (nxt) { tx = nxt.pos.x; tz = nxt.pos.z; stopAt = 1.5; }",
       "      const nxt = enemies.find((e) => e.alive && e.state !== 'dead' && e.state !== 'dying');\n      if (nxt && !nxt.tgtCrew) { tx = nxt.pos.x; tz = nxt.pos.z; stopAt = 1.5; } // (a thug going for the crew is left alone on purpose)")
# thumbnail keeps the canvas aspect (portrait phones get a portrait thumb)
sub(N, "const c = document.createElement('canvas'); c.width = 320; c.height = 180; const g = c.getContext('2d'); const W = canvas.width, H = canvas.height, s = Math.min(W / 16, H / 9);\n    g.drawImage(canvas, (W - s * 16) / 2, (H - s * 9) / 2, s * 16, s * 9, 0, 0, 320, 180);",
       "const W = canvas.width, H = canvas.height, k = Math.min(320 / W, 320 / H), c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); const g = c.getContext('2d');\n    g.drawImage(canvas, 0, 0, W, H, 0, 0, c.width, c.height);")
sub(H, "#endRp img { width: 100%; max-width: 340px; margin: 0 auto; display: block; border: 2px solid #000; border-radius: 3px; aspect-ratio: 16/9; object-fit: cover; }",
       "#endRp img { max-width: min(100%, 340px); max-height: 34vh; width: auto; height: auto; margin: 0 auto; display: block; border: 2px solid #000; border-radius: 3px; }")
# bot log: positions for debugging
B = '/workspace/work/live11/bot.js'
sub(B, "sw: document.documentElement.scrollWidth, iw: innerWidth, head: C.CHY.cur }; });", "sw: document.documentElement.scrollWidth, iw: innerWidth, head: C.CHY.cur, hp: [+H.pos.x.toFixed(1), +H.pos.z.toFixed(1)], cp: [+C.CREW.op.pos.x.toFixed(1), +C.CREW.op.pos.z.toFixed(1)], es: C.enemies.map((e) => e.state[0] + (e.tgtCrew ? '*' : '')).join('') }; });")
print('ok')
