# Contact sheets of every special mid-move from shots/roster (run after shots_roster.js)
import json, glob
from PIL import Image, ImageDraw, ImageFont
D = "/workspace/work/sf_brawler/test/shots/roster/"
names = ["RYU - HADOUKEN", "KEN - SHORYUKEN", "CHUN-LI - SPINNING BIRD KICK", "GUILE - SONIC BOOM", "BLANKA - ELECTRIC THUNDER", "E. HONDA - HUNDRED HAND SLAP",
         "ZANGIEF - SPINNING LARIAT", "DHALSIM - YOGA FIRE", "CAMMY - CANNON SPIKE", "FEI LONG - REKKAKEN", "DEE JAY - MACHINE GUN UPPER", "T. HAWK - CONDOR DIVE"]
meta = {}
for f in glob.glob(D + "meta_*.json"): meta.update(json.load(open(f)))
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
CW, CH = 190, 120  # game units
def crop(n, k):
    im = Image.open(D + f"sp_{n}_{k}.png").convert("RGB"); S = im.width / 384
    m = meta.get(f"{n}_{k}", {"x": 90, "y": 195})
    x0 = max(0, min(384 - CW, m["x"] - 60)); y0 = max(0, min(224 - CH, m["y"] - 102))
    return im.crop((int(x0 * S), int(y0 * S), int((x0 + CW) * S), int((y0 + CH) * S))), m.get("pr")
c0, _ = crop(0, 0); cw, ch = c0.size
full = Image.new("RGB", (10 + (cw + 10) * 3, (ch + 40) * 12 + 10), (16, 16, 20)); d = ImageDraw.Draw(full)
for n in range(12):
    y = 10 + n * (ch + 40); d.text((10, y + 4), names[n], fill=(255, 210, 60), font=font)
    for k in range(3):
        c, pr = crop(n, k); x = 10 + k * (cw + 10); full.paste(c, (x, y + 32))
        if pr is not None: d.text((x + cw - 90, y + 10), "t=%d%%" % round(pr * 100), fill=(180, 180, 180), font=small)
full.save(D + "contact_full.png")
g = Image.new("RGB", (10 + (cw + 10) * 4, 10 + (ch + 40) * 3), (16, 16, 20)); d = ImageDraw.Draw(g)
for n in range(12):
    x = 10 + (n % 4) * (cw + 10); y = 10 + (n // 4) * (ch + 40)
    d.text((x, y + 4), names[n], fill=(255, 210, 60), font=font); g.paste(crop(n, 1)[0], (x, y + 32))
g.save(D + "contact_mid.png")
print(full.size, g.size)
