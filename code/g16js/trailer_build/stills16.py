# 16-bit stills: img/*.jpg (1068x624 game frames, canvas 1068 wide) converted; img/t thumbs re-made from the converted still
# (Lanczos to the thumb size, then 31 colours + 9-bit snap at thumb size, since a 360px thumb is already below game resolution).
import glob, os, numpy as np
from PIL import Image
from conv16 import conv, g9
D = "/workspace/work/g16js/trailer"
for f in sorted(glob.glob("orig/img/*.jpg")):
    b = os.path.basename(f); o = conv(Image.open(f)); o.save(f"{D}/img/{b}", quality=92, subsampling=0)
    t = Image.open(f"orig/img/t/{b}")
    s = o.resize(t.size, Image.LANCZOS).quantize(31, method=Image.FASTOCTREE, kmeans=4, dither=Image.NONE).convert("RGB")
    Image.fromarray(g9(np.array(s))).save(f"{D}/img/t/{b}", quality=90, subsampling=0)
print("stills", len(glob.glob("orig/img/*.jpg")))
