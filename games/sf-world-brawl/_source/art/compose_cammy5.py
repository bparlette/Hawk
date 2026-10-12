"""RUN 4: build specials/spec_cammy5.png (magenta) = launch crouch (spec_cammy2 frame 1) + two airborne spear frames.
Airborne source = specials/cammy_air_straight.png (straighten_cammy.py: spec_cammy4 frame 1 with the hip bend reduced),
spec_cammy4 frame 1 as painted (hip bend kept), rotated -8 / +2 deg, with soft painted motion streaks trailing down-left."""
import math, numpy as np
from PIL import Image, ImageDraw, ImageFilter
D = "/workspace/work/sf_brawler/art/specials/"
MAG = (255, 0, 255)
c2 = Image.open(D + "spec_cammy2.png").convert("RGB")
crouch = c2.crop((90, 300, 380, 740))
air = Image.open(D + "spec_cammy4.png").convert("RGB").crop((0, 80, 730, 570))  # straightened warp (straighten_cammy.py) read as a backbend in-game -> unused
a_ = np.array(air).astype(int); a_[(np.minimum(a_[..., 0], a_[..., 2]) - a_[..., 1]) >= 45] = MAG; air = Image.fromarray(a_.astype(np.uint8))  # drop its own faint streaks
S = 1 / 1.3
air = air.resize((round(air.width * S), round(air.height * S)), Image.LANCZOS)

def streaked(img, ang):
    r = img.rotate(ang, resample=Image.BICUBIC, expand=True, fillcolor=MAG)
    a = np.array(r).astype(int); fg = (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) < 60
    lay = Image.new("L", r.size, 0); d = ImageDraw.Draw(lay)
    th = math.radians(5 + ang)  # body axis (head->boot) direction, up-right
    dx, dy = -math.cos(th), math.sin(th)  # trail direction: down-left (image y down)
    ys, xs = np.where(fg); cx, cy = xs.mean(), ys.mean()
    px, py = -dy, dx  # perpendicular
    for k, off in enumerate((-70, -35, 0, 35, 70)):
        sx, sy = cx + px * off, cy + py * off
        L = 150 - abs(off)
        d.line([(sx, sy), (sx + dx * L, sy + dy * L)], fill=250 - abs(off), width=9)
    lay = lay.filter(ImageFilter.GaussianBlur(4))
    base = Image.composite(Image.new("RGB", r.size, (250, 245, 250)), Image.new("RGB", r.size, MAG), lay)
    base.paste(r, (0, 0), Image.fromarray((fg * 255).astype(np.uint8)))
    return base

fr = [crouch, streaked(air, -8), streaked(air, 2)]
W = sum(f.width for f in fr) + 120 * (len(fr) + 1); H = max(f.height for f in fr) + 160
cv = Image.new("RGB", (W, H), MAG); x = 120
for f in fr:
    cv.paste(f, (x, H - 80 - f.height)); x += f.width + 120
cv.save(D + "spec_cammy5.png"); print(cv.size, [f.size for f in fr])
