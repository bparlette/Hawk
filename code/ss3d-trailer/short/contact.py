# contact.py [video] : ~8 frames from the finished short -> shellshock3d-short-contact.png (with timestamps + safe-zone guides)
import subprocess, sys, os
from PIL import Image, ImageDraw, ImageFont
R = '/workspace/work/ss3d-trailer/short'
V = sys.argv[1] if len(sys.argv) > 1 else f'{R}/shellshock3d-short-9x16.mp4'
TS = [0.3, 1.9, 3.6, 7.0, 9.0, 12.0, 16.0, 18.0, 21.1, 24.0]
W, H = 324, 576
os.makedirs('/tmp/cs9', exist_ok=True)
sheet = Image.new('RGB', (W * 5 + 60, (H + 34) * 2 + 20), (18, 18, 22))
f = ImageFont.truetype('/workspace/work/ss3d-trailer/hfproj/assets/fonts/Anton.ttf', 24)
for k, t in enumerate(TS):
    p = f'/tmp/cs9/{k}.png'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(t), '-i', V, '-frames:v', '1', p], check=True)
    im = Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS); d = ImageDraw.Draw(im)
    for y in (H * 0.10, H * 0.80): d.line([(0, y), (W, y)], fill=(255, 0, 255), width=1)  # safe-zone guides (top 10% / bottom 20%)
    x0 = 10 + (k % 5) * (W + 10); y0 = 10 + (k // 5) * (H + 34)
    sheet.paste(im, (x0, y0 + 30)); ImageDraw.Draw(sheet).text((x0, y0), f'{t:.1f}s', font=f, fill=(255, 255, 255))
out = f'{R}/shellshock3d-short-contact.png'; sheet.save(out); print(out, sheet.size)
