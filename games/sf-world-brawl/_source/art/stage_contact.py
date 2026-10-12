from stage_cut import *
from PIL import ImageDraw
import sys
f, k, rows = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = load(f, k); fr = components(im, rows=rows, dil=int(sys.argv[5]) if len(sys.argv)>5 else 10)
th = 220; tiles = []
for i, (c, o) in enumerate(fr):
    p = Image.fromarray(c); s = th / max(p.height, p.width * 0.8); p = p.resize((max(1,int(p.width*s)), max(1,int(p.height*s))))
    t = Image.new("RGBA", (max(p.width, 60) + 10, th + 24), (60, 70, 90, 255)); t.alpha_composite(p, (5, 20)); ImageDraw.Draw(t).text((4, 2), "%d %dx%d" % (i, c.shape[1], c.shape[0]), fill="yellow"); tiles.append(t)
W = sum(t.width for t in tiles); cv = Image.new("RGBA", (W, th + 24)); x = 0
for t in tiles: cv.paste(t, (x, 0)); x += t.width
cv.convert("RGB").save(sys.argv[4])
