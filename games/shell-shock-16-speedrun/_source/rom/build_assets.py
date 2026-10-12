# Shell Shock 16 - Speed Run: converts every level's painted art into Genesis-legal SGDK resources ("Auto 16-bit" look).
# Same recipe as the Level 1 sample: Lanczos to on-screen size, alpha 110 threshold, joint 15-colour palette per
# palette slot, every colour snapped to the 9-bit Genesis master palette, k-means tile reduction for backgrounds.
# Per level: zone-1 strip (640x224, PAL0+PAL1), boss arena (320x224), 3 foot-soldier sheets + boss sheet (PAL3, joint palette).
import numpy as np, json, sys, os
from PIL import Image
from sklearn.cluster import MiniBatchKMeans
from multiprocessing import Pool
SRC = '/workspace/work/deploy/shell-shock-live-action/'
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = HERE + '/res/'
LJ = json.load(open(HERE + '/../tools/levels.json'))
LV = np.array([0, 36, 73, 109, 146, 182, 219, 255])
def snap(c): c = np.asarray(c, float); return LV[np.abs(c[..., None] - LV).argmin(-1)].astype(np.uint8)
def nearest(px, pal): return ((px[:, None, :].astype(int) - pal[None].astype(int)) ** 2).sum(-1).argmin(1)
def lanczos(fr, k): w, h = fr.size; return fr.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
def save_indexed(idx, pal, path):
    im = Image.fromarray(idx.astype(np.uint8), 'P'); flat = [int(v) for c in pal for v in c]; flat += [0] * (768 - len(flat)); im.putpalette(flat)
    im.save(path, transparency=0)
_IMC = {}
def openimg(p):
    if p not in _IMC:
        q = SRC + p
        if not os.path.exists(q) and q.endswith('.png'): q = q[:-4] + '.webp'
        _IMC[p] = Image.open(q).convert('RGBA')
    return _IMC[p]
def frames_from(src, frames, k):
    im = openimg(src); out = {}
    for fn, f in frames.items():
        x, y, w, h = f[:4]; ax = f[4] if len(f) > 4 and f[4] >= 0 else w / 2
        t = lanczos(im.crop((x, y, x + w, y + h)), k); a = np.array(t); a[:, :, 3] = np.where(a[:, :, 3] > 110, 255, 0); t = Image.fromarray(a)
        bb = t.getbbox() or (0, 0, 1, 1); t = t.crop(bb); out[fn] = (t, round(ax * k) - bb[0])
    return out
def joint_palette(framesets, n=15):
    px = np.concatenate([np.array(t)[np.array(t)[:, :, 3] > 0][:, :3] for fs in framesets for t, _ in fs.values()])
    side = int(np.ceil(np.sqrt(len(px)))); buf = np.zeros((side * side, 3), np.uint8); buf[:len(px)] = px; buf[len(px):] = px[0]
    img = Image.fromarray(buf.reshape(side, side, 3)); u = {}
    for m in range(n, 48):
        q = img.quantize(m, method=Image.FASTOCTREE, kmeans=4, dither=Image.NONE)
        cnt = np.bincount(np.array(q).ravel(), minlength=m); P = snap(np.array(q.getpalette()[:m * 3]).reshape(m, 3)); u = {}
        for i in np.argsort(-cnt):
            kk = tuple(P[i]); u.setdefault(kk, 0); u[kk] += cnt[i]
        if len(u) >= n: break
    return np.array(sorted(u, key=lambda kk: -u[kk])[:n], np.uint8)
def sheet(name, fs, rows, cw, ch, pal):
    W = cw * 8; H = ch * 8; ncol = max(len(r) for r in rows); idx = np.zeros((H * len(rows), W * ncol), np.uint8)
    for ri, r in enumerate(rows):
        for ci, fn in enumerate(r):
            t, ax = fs[fn]; a = np.array(t); m = a[:, :, 3] > 0; ii = np.zeros(m.shape, np.uint8); ii[m] = nearest(a[m][:, :3], pal) + 1
            ox = W // 2 - ax; oy = H - ii.shape[0]
            for yy in range(ii.shape[0]):
                Y = oy + yy
                if Y < 0: continue
                fx = np.arange(ii.shape[1]) + ox; ok = (fx >= 0) & (fx < W)
                row = ii[yy, ok]; dst = idx[ri * H + Y, ci * W + fx[ok]]; idx[ri * H + Y, ci * W + fx[ok]] = np.where(row > 0, row, dst)
    p = [(255, 0, 255)] + [tuple(c) for c in pal]; p += [(0, 0, 0)] * (16 - len(p)); save_indexed(idx, p, OUT + name + '.png')
def cell_for(fs, capw=128, caph=96):
    w = max(2 * max(ax, t.size[0] - ax) for t, ax in fs.values()); h = max(t.size[1] for t, _ in fs.values())
    return min(capw, (w + 7) // 8 * 8) // 8, min(caph, (h + 7) // 8 * 8) // 8

# ---------------- per-level data (from the JS levels; bosses all run the JS "ramrod" base behaviour) ----------------
# boss slots -> anims: 0 idle, 1 walk (walk1, walk2), 2 charge, 3 kick, 4 fire, 5 hurt, 6 down
BOSSES = {
 1: ('atlas_ramrod.png', 78, dict(idle=[0,0,117,190], walk1=[119,4,127,186], walk2=[0,0,117,190], charge=[248,24,161,166], kick=[411,4,153,186], fire=[566,7,157,183], hurt=[725,13,132,177], down=[859,126,196,64])),
}
def J(n, var):  # pull a boss frame dict out of the JS source
    import re
    s = open(SRC + f'levels/level{n}.js').read(); m = re.search(r'const ' + var + r'\s*=\s*\{(.*?)\};', s, re.S)
    d = {}
    for k, v in re.findall(r'(\w+)\s*:\s*\[([^\]]*)\]', m.group(1)): d[k] = [float(x) for x in v.split(',')]
    return d
def bmap(d, idle, w1, w2, ch, ki, fi, hu, dn):
    return dict(idle=d[idle], walk1=d[w1], walk2=d[w2], charge=d[ch], kick=d[ki], fire=d[fi], hurt=d[hu], down=d[dn])
def boss_table():
    B = dict(BOSSES)
    d = J(2, 'BJF'); B[2] = ('levels/level2_brickjaw.png', 80, bmap(d, 'idle', 'walk1', 'walk2', 'charge', 'punch', 'throwRel', 'hurt', 'down'))
    d = J(3, 'GTF'); B[3] = ('levels/level3_gator.png', 84, bmap(d, 'idle', 'walk1', 'walk2', 'charge', 'punch', 'throw', 'hurt', 'down'))
    d = J(4, 'JWF'); B[4] = ('levels/level4_jetwash.png', 78, bmap(d, 'idle', 'hover', 'glide', 'dive', 'kick', 'fire', 'hurt', 'down'))
    d = J(5, 'GWF'); B[5] = ('levels/level5_grimwale.png', 84, bmap(d, 'idle', 'walk1', 'walk2', 'charge', 'kick', 'aim', 'hurt', 'down'))
    d = J(6, 'CFF'); B[6] = ('levels/level6_coldfront.png', 76, bmap(d, 'idle', 'walk1', 'walk2', 'spin', 'kick', 'throw', 'hurt', 'down'))
    d = J(7, 'RMF'); B[7] = ('levels/level7_rustmaul.png', 86, bmap(d, 'idle', 'walk1', 'walk2', 'rush', 'swing', 'throw', 'hurt', 'down'))
    d = J(8, 'RZF'); B[8] = ('levels/level8_razorback.png', 82, bmap(d, 'idle', 'walk1', 'walk2', 'charge', 'punch', 'fire', 'hurt', 'down'))
    d = J(9, 'KF');  B[9] = ('levels/level9_karai.png', 74, bmap(d, 'idle', 'walk', 'idle', 'slash', 'slash', 'throw', 'hurt', 'down'))
    d = J(10, 'F');  B[10] = ('levels/level10_armaggon.png', 90, bmap(d, 'idle', 'walk', 'idle2', 'bite', 'bite', 'fire', 'hurt', 'lie'))
    d = J(11, 'GF'); B[11] = ('levels/level11_gator.png', 90, bmap(d, 'idle', 'walk', 'idle', 'tail', 'chomp', 'crate', 'hurt', 'lie'))
    d = J(12, 'VF'); B[12] = ('levels/level12_viral.png', 68, bmap(d, 'idle', 'walk', 'idle', 'attack', 'attack', 'attack', 'hurt', 'down'))
    d = dict(idle=[0,0,177,228,84], walk=[179,1,174,227,82], fire=[355,1,266,227,92], hurt=[623,59,212,169,90], down=[837,128,330,100,165])
    B[13] = ('levels/level13_traag.png', 90, bmap(d, 'idle', 'walk', 'idle', 'walk', 'fire', 'fire', 'hurt', 'down'))
    d = J(14, 'KRF'); B[14] = ('levels/level14_krang.png', 84, bmap(d, 'idle', 'walk1', 'walk2', 'rage', 'punch', 'rocket', 'hurt', 'down'))
    d = J(15, 'SHF'); B[15] = ('levels/level15_shredder.png', 80, bmap(d, 'idle', 'walk', 'idle', 'jump', 'attack', 'taunt', 'hurt', 'down'))
    d = J(15, 'SUF'); B[16] = ('levels/level15_super.png', 94, bmap(d, 'idle', 'walk', 'idle', 'raise', 'blast', 'blast', 'hurt', 'down'))
    return B
ROLE = {'purple': 'light', 'blue': 'light', 'dasher': 'light', 'sword': 'weapon', 'star': 'weapon', 'heavy': 'big', 'gunner': 'big'}
ST_ENEMY = {"light": {"idle":[4,0,102,165,49],"walk":[110,0,90,165,44],"walk2":[204,2,83,163,38],"attack":[291,23,122,142,53],"hurt":[558,23,79,142,39],"down":[641,124,183,41,91]},
            "weapon": {"idle":[4,173,60,165,32],"walk":[68,169,80,169,38],"walk2":[152,171,87,167,43],"attack":[243,182,145,156,50],"hurt":[470,195,101,143,66],"down":[575,297,178,41,89]},
            "big": {"idle":[4,348,91,163,40],"walk":[99,342,82,169,38],"walk2":[185,344,93,167,48],"attack":[282,348,146,163,54],"hurt":[539,360,104,151,62],"down":[647,461,183,50,91]}}
def enemy_skins(n):
    if n == 1: return {r: ('levels/enemies_street.png', f) for r, f in ST_ENEMY.items()}
    s = LJ[str(n)]['enemySkins']; pick = {'light': 'purple', 'weapon': 'sword', 'big': 'heavy'}; o = {}
    for r, t in pick.items():
        sk = s[t]; fr = {k: sk['frames'][k] for k in ['idle', 'walk', 'walk2', 'attack', 'hurt', 'down']}
        o[r] = (sk['img'].replace('.webp', '.png'), fr)
    return o
def level_bgs(n):  # (zone bg, zone floor, zone x0), [(arena bg, floor, x0)]
    if n == 1: return ('l1_lobby.jpg', (150, 214), 110), []
    c = LJ[str(n)]; secs = c['sections']
    z = secs[0]; zf = tuple(z['floor'])
    if n == 15: return (z['bg'], zf, 0), [(secs[3]['bg'], tuple(secs[3]['floor']), None), (secs[4]['bg'], tuple(secs[4]['floor']), 0)]
    if c.get('restructure') and c['restructure'].get('arena'):
        a = c['restructure']['arena']; return (z['bg'], zf, 0), [(a['bg'], tuple(a['floor']), None)]
    a = secs[-1]; return (z['bg'], zf, 0), [(a['bg'], tuple(a['floor']), None)]

# ---------------- backgrounds ----------------
def band_pal(arr, n):
    q = Image.fromarray(arr).quantize(n, method=Image.FASTOCTREE, kmeans=4, dither=Image.NONE)
    return np.unique(snap(np.array(q.getpalette()[:n * 3]).reshape(n, 3)), axis=0)
def reduce_tiles(arr, pal, K):
    H, W, _ = arr.shape; T = arr.reshape(H // 8, 8, W // 8, 8, 3).transpose(0, 2, 1, 3, 4).reshape(-1, 192).astype(float)
    K = min(K, len(T))
    km = MiniBatchKMeans(K, random_state=1, n_init=3, batch_size=2048).fit(T); C = km.cluster_centers_[km.labels_]
    out = C.reshape(H // 8, W // 8, 8, 8, 3).transpose(0, 2, 1, 3, 4).reshape(H, W, 3)
    return nearest(out.reshape(-1, 3), pal).reshape(H, W)
YEL = (255, 219, 0); WHT = (255, 255, 255)
def make_bg(src, width, x0, floor_top, name, budget):
    bg = Image.open(SRC + src).convert('RGB'); w, h = bg.size; g = bg.resize((round(w * 224 / h), 224), Image.LANCZOS)
    if x0 is None: x0 = max(0, (g.size[0] - width) // 2)
    g = np.array(g)[:, x0:x0 + width]
    if g.shape[1] < width: g = np.concatenate([g, g[:, ::-1]], 1)[:, :width]
    split = max(8, min(26, floor_top // 8))
    top = g[:split * 8]; flo = g[split * 8:]
    pA = band_pal(top, 12); pB = band_pal(flo, 15)
    kt = round(budget * split / 28 * 1.05); kb = budget - kt
    iA = reduce_tiles(top, pA, kt) + 1; iB = reduce_tiles(flo, pB, kb) + 1
    idx = np.vstack([iA, iB + 16]).astype(np.uint8)
    P0 = [(0, 0, 0)] + [tuple(c) for c in pA]; P0 += [(0, 0, 0)] * (13 - len(P0)); P0 += [(0, 0, 0), YEL, WHT]
    P1 = [(0, 0, 0)] + [tuple(c) for c in pB]; P1 += [(0, 0, 0)] * (16 - len(P1))
    save_indexed(idx, P0 + P1, OUT + name + '.png')
    T = set()
    for y in range(0, 224, 8):
        for x in range(0, width, 8):
            t = idx[y:y + 8, x:x + 8]; T.add(min(t.tobytes(), t[:, ::-1].tobytes(), t[::-1].tobytes(), t[::-1, ::-1].tobytes()))
    Image.fromarray(np.array(P0 + P1, np.uint8)[idx]).save(HERE + '/../preview/' + name + '.png')
    return len(T)

def do_level(n):
    B = boss_table(); rep = {}
    (zb, zf, zx), arenas = level_bgs(n)
    rep['zone'] = make_bg(zb, 640, zx, zf[0], f'l{n}_bg', 760)
    for i, (ab, af, ax) in enumerate(arenas): rep[f'arena{i}'] = make_bg(ab, 320, ax, af[0], f'l{n}_ar{i}', 720)
    sk = enemy_skins(n); K = {'light': 0.38, 'weapon': 0.38, 'big': 0.40}
    en = {r: frames_from(src, fr, K[r]) for r, (src, fr) in sk.items()}
    bl = [B[n]] + ([B[16]] if n == 15 else []); bfs = []
    for (src, H, fr) in bl:
        k = H / fr['idle'][3]; bfs.append(frames_from(src, fr, k))
    pal = joint_palette(list(en.values()) + bfs)
    for r in en: sheet(f'l{n}_{r}', en[r], [['idle'], ['walk', 'idle', 'walk2', 'idle'], ['attack'], ['hurt'], ['down']], 9, 9, pal)
    for i, fs in enumerate(bfs):
        cw, ch = cell_for(fs); rep[f'boss{i}cell'] = (cw, ch)
        sheet(f'l{n}_boss{i}', fs, [['idle'], ['walk1', 'walk2'], ['charge'], ['kick'], ['fire'], ['hurt'], ['down']], cw, ch, pal)
    return n, rep, zf, [a[1] for a in arenas]

if __name__ == '__main__':
    os.makedirs(HERE + '/../preview', exist_ok=True)
    lv = [int(a) for a in sys.argv[1:]] or list(range(1, 16))
    with Pool(min(8, len(lv))) as p: res = p.map(do_level, lv)
    meta = {}
    if os.path.exists(HERE + '/levelmeta.json'): meta = json.load(open(HERE + '/levelmeta.json'))
    for n, rep, zf, afs in res:
        print(n, rep, zf, afs); meta[str(n)] = dict(rep=rep, zf=zf, afs=afs)
    json.dump(meta, open(HERE + '/levelmeta.json', 'w'), indent=1)
