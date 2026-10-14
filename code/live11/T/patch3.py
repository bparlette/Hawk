def sub(f, a, b):
    s = open(f).read(); assert s.count(a) == 1, (f, a[:70], s.count(a)); s = s.replace(a, b); open(f, 'w').write(s)
G = '/workspace/work/live11/src/06_game.js'
H = '/workspace/work/live11/site/index.html'
sub(G, "hp: big ? 16 : 8, scale: big ? 1.2 : 1", "hp: big ? 24 : 12, scale: big ? 1.2 : 1")
sub(H, "#endRp img { width: 100%; display: block;", "#endRp img { width: 100%; max-width: 340px; margin: 0 auto; display: block;")
sub(H, "#endRp p { margin: 6px 0 0;", "#endRp p { text-align: center; margin: 6px 0 0;")
sub(H, "#endC { width: min(560px, calc(100vw - 24px)); margin: 4vh auto 40px;", "#endC { width: min(560px, calc(100vw - 24px)); margin: 3vh auto 24px;")
print('ok')
