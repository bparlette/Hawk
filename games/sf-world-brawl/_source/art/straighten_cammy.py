"""RUN 4: straighten the airborne Cammy (spec_cammy4 frame 1 has a ~97deg hip bend the generator would not remove).
Cut the upper body (left of a line past the hip), rotate it CCW about the hip so torso + kicking leg read as one spear,
and fan-fill the opened waist wedge with intermediate rotations of a band near the pivot. Output: specials/cammy_air_straight.png (magenta bg)."""
import sys, numpy as np
from PIL import Image
D = "/workspace/work/sf_brawler/art/specials/"
TH = float(sys.argv[1]) if len(sys.argv) > 1 else 35
src = Image.open(D + "spec_cammy4.png").convert("RGB").crop((0, 80, 730, 570))
pad = 200
im = Image.new("RGB", (src.width + 2 * pad, src.height + 2 * pad), (255, 0, 255)); im.paste(src, (pad, pad))
a = np.array(im).astype(int)
mag0 = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
a[mag0 >= 45] = (255, 0, 255)  # drop painted streaks / soft halo before warping (they smear in the fan)
fg = (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) < 100  # non-magenta (incl. streaks partly)
H, W = fg.shape; yy, xx = np.mgrid[0:H, 0:W]
P1 = np.array([300 + pad, 420 + pad]); P2 = np.array([410 + pad, 215 + pad]); PIV = (400 + pad, 255 + pad)
side = (P2[0] - P1[0]) * (yy - P1[1]) - (P2[1] - P1[1]) * (xx - P1[0])  # >0 -> left of line (upper body)
upper = (side < 0) & fg
dist = np.hypot(xx - PIV[0], yy - PIV[1])
rgba = np.dstack([a, np.where(upper, 255, 0)]).astype(np.uint8)
up = Image.fromarray(rgba, "RGBA")
band = Image.fromarray(np.dstack([a, np.where(upper & (dist < 95), 255, 0)]).astype(np.uint8), "RGBA")
base = a.copy(); base[upper] = (255, 0, 255)
out = Image.fromarray(base.astype(np.uint8), "RGB").convert("RGBA")
for t in np.arange(0, TH, 2.0):
    out.alpha_composite(band.rotate(t, resample=Image.BICUBIC, center=PIV))
out.alpha_composite(up.rotate(TH, resample=Image.BICUBIC, center=PIV))
o = np.array(out.convert("RGB")); m = (np.minimum(o[..., 0], o[..., 2]) - o[..., 1]) < 100
ys, xs = np.where(m); o = o[ys.min() - 20:ys.max() + 20, xs.min() - 20:xs.max() + 20]
Image.fromarray(o).save(D + "cammy_air_straight.png"); print(o.shape)
