# tools/tile.py — tile equal-size PNGs into one sheet (used for the HD-vs-LOD comparison previews). Needs Pillow.
# tile.py out.png cols scale img1 img2 ...
import sys
from PIL import Image
out, cols, scale = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]); ims = [Image.open(p).convert('RGB') for p in sys.argv[4:]]
w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
W = Image.new('RGB', (w * cols, h * rows), (40, 36, 50))
for i, im in enumerate(ims): W.paste(im, ((i % cols) * w, (i // cols) * h))
W.resize((int(w * cols * scale), int(h * rows * scale)), Image.LANCZOS).save(out)
