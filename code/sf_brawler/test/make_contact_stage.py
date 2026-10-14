import sys, glob, os
from PIL import Image, ImageDraw
d = sys.argv[1]; names = sys.argv[2].split(","); out = sys.argv[3]; crop = sys.argv[4] if len(sys.argv) > 4 else None
tiles = []
for n in names:
    f = os.path.join(d, "b_%s.png" % n)
    if not os.path.exists(f): continue
    im = Image.open(f).convert("RGB")
    W, H = im.size
    if crop: im = im.crop((int(W * 0.22), int(H * 0.25), int(W * 0.62), int(H * 0.92)))
    im = im.resize((im.width * 300 // im.height, 300)); ImageDraw.Draw(im).text((6, 4), n, fill="yellow"); tiles.append(im)
cols = 7; rows = (len(tiles) + cols - 1) // cols; tw = max(t.width for t in tiles)
cv = Image.new("RGB", (tw * cols, 300 * rows))
for i, t in enumerate(tiles): cv.paste(t, ((i % cols) * tw, (i // cols) * 300))
cv.save(out); print(out, cv.size)
