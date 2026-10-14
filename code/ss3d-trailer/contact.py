# contact.py video.mp4 -> contact.png : one frame per beat (mid-beat, caption on screen), labelled with beat + time
import json, subprocess, sys, os
from PIL import Image, ImageDraw, ImageFont
V = sys.argv[1]; OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/work/ss3d-trailer/contact.png'
T = json.load(open('/workspace/work/ss3d-trailer/timeline.json'))
os.makedirs('/workspace/work/ss3d-trailer/cs', exist_ok=True)
t = 0; tiles = []
for b, d, cap in T['beats']:
    at = t + (1.3 if b == 'title' else min(1.25, d * 0.55))
    if b == 'end': at = t + d - 0.6
    f = f'/workspace/work/ss3d-trailer/cs/{b}.png'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{at:.3f}', '-i', V, '-frames:v', '1', '-update', '1', f], check=True)
    tiles.append((b, t, at, f)); t += d
tw, th = 640, 360; cols = 3; rows = (len(tiles) + cols - 1) // cols
S = Image.new('RGB', (cols * tw, rows * (th + 26)), (12, 12, 12)); D = ImageDraw.Draw(S)
try: F = ImageFont.truetype('/workspace/work/ss3d-trailer/hfproj/assets/fonts/PressStart2P.ttf', 14)
except Exception: F = None
for k, (b, t0, at, f) in enumerate(tiles):
    x, y = (k % cols) * tw, (k // cols) * (th + 26)
    S.paste(Image.open(f).convert('RGB').resize((tw, th)), (x, y + 26))
    D.text((x + 6, y + 6), f'{k:02d} {b.upper()}  {t0:05.2f}s (frame @{at:.2f}s)', fill=(255, 220, 60), font=F)
S.save(OUT); print('contact', OUT, S.size)
