import sys, glob
from PIL import Image
b, step = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 10
fs = sorted(glob.glob(f'frames/{b}/*.jpg'))[::step]; W, H = 180, 320
im = Image.new('RGB', (W * len(fs), H))
for i, f in enumerate(fs):
    t = Image.open(f); t.draft('RGB', (270, 480)); im.paste(t.resize((W, H)), (i * W, 0))
im.save(f'/tmp/s_{b}.jpg', quality=85); print(b, [f[-9:-4] for f in fs])
