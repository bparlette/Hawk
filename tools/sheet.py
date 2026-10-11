#!/usr/bin/env python3
"""python3 tools/sheet.py out.png cols cellW cellH img1 img2 ...  — contact sheet of screenshots (dev aid)."""
import sys
from PIL import Image
out, cols, cw, ch, *imgs = sys.argv[1:]
cols, cw, ch = int(cols), int(cw), int(ch)
rows = (len(imgs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cw, rows * ch), (20, 16, 31))
for i, p in enumerate(imgs):
    im = Image.open(p).convert('RGB'); im.thumbnail((cw, ch)); sheet.paste(im, ((i % cols) * cw, (i // cols) * ch))
sheet.save(out)
