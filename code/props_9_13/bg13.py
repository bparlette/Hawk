# compose level13_dimx.jpg (1809x512) from the two repainted halves + level13_dimx_boss.jpg (878x512)
import numpy as np
from PIL import Image
L = np.array(Image.open('gen/l13_dimxL2.png').convert('RGB').resize((840, 512), Image.LANCZOS)).astype(np.float32)
R = np.array(Image.open('gen/l13_dimxR2.png').convert('RGB').resize((989, 512), Image.LANCZOS)).astype(np.float32)
# colour-match R to L: per-row mean offset (smoothed over rows, no hard bands), measured next to the seam
from scipy.ndimage import gaussian_filter1d
ma = L[:, 640:840].mean(1); mb = R[:, 0:200].mean(1)
d = gaussian_filter1d(ma - mb, 25, axis=0)
xs = np.linspace(1, 0.55, R.shape[1])[None, :, None]  # full correction at the seam, easing off to the right
R = R + d[:, None, :] * xs
# residual at the seam itself (narrow), decayed over 160 px so the sky tone joins without a line
d2 = gaussian_filter1d(L[:, 820:840].mean(1) - R[:, 0:20].mean(1), 6, axis=0)
xd = np.clip(1 - np.arange(R.shape[1]) / 160, 0, 1)[None, :, None] ** 1.3
R = R + d2[:, None, :] * xd
# feather the band edge between the two transfers
R = R.clip(0, 255)
out = np.zeros((512, 1809, 3), np.float32); out[:, :840] = L; 
ov = 20; w = np.linspace(0, 1, ov)[None, :, None]
out[:, 820:840] = L[:, 820:840] * (1 - w) + R[:, :ov] * w
out[:, 840:] = R[:, ov:]
# wrap seam: fade the last 48 px into a mirror of the first 48 px so tile repeats join
b = 48; w = np.linspace(0, 1, b)[None, :, None] ** 1.5
out[:, -b:] = out[:, -b:] * (1 - w) + out[:, :b][:, ::-1] * w
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save('level13_dimx.jpg', quality=84, optimize=True)
B = Image.open('gen/l13_bossbg.png').convert('RGB').resize((878, 512), Image.LANCZOS)
B.save('level13_dimx_boss.jpg', quality=84, optimize=True)
