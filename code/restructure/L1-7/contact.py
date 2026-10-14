# per-level contact sheets: zone 1 | twist art | zone 2 (+ floor band + wrap seam check) | boss arena
from PIL import Image, ImageDraw, ImageFont
import os
D = '/workspace/work/deploy/shell-shock-live-action/'
os.makedirs('contact', exist_ok=True)
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception: F = ImageFont.load_default()
LV = {
 1: ('hallway.jpg', (150, 215), 'level1_lobby.jpg', 'room.jpg', 'collapsing floor -> drop to the lobby'),
 2: ('levels/level2_street.jpg', (168, 218), 'level2_rooftops.jpg', 'NEW:level2_rooftop_boss.jpg', 'searchlight climb up the fire escape'),
 3: ('levels/level3_sewer.jpg', (154, 218), 'level3_pumpstation.jpg', 'levels/level3_sewer_boss.jpg', 'sluice burst: flood-wave escape'),
 4: ('levels/level4_highway.jpg', (160, 216), 'level4_tunnel.jpg', 'NEW:level4_tunnel_boss.jpg', 'turret truck: water-cannon gunner'),
 5: ('levels/level5_docks.jpg', (166, 218), 'level5_shipdeck.jpg', 'levels/level5_docks_boss.jpg', 'harbour boat chase'),
 6: ('levels/level6_snow.jpg', (160, 216), 'level6_park.jpg', 'levels/level6_snow_boss.jpg', 'thin-ice pond run'),
 7: ('levels/level7_junkyard.jpg', (160, 218), 'level7_foundry.jpg', 'levels/level7_junkyard_boss.jpg', 'falling freight-elevator fight'),
}
WID = 1600
def band(im, fl):
    im = im.copy(); d = ImageDraw.Draw(im); k = im.height / 224
    for y in fl: d.line([(0, y * k), (im.width, y * k)], fill=(255, 0, 255), width=3)
    return im
def row(im, w=WID):
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if im.width > w else im
def label(im, txt):
    d = ImageDraw.Draw(im); d.rectangle([0, 0, d.textlength(txt, font=F) + 16, 32], fill=(0, 0, 0)); d.text((8, 4), txt, font=F, fill=(255, 230, 90)); return im
for n, (z1, fl, z2, ar, tw) in LV.items():
    rows = []
    rows.append(label(row(band(Image.open(D + z1).convert('RGB'), fl)), f'L{n} ZONE 1 (existing) {z1.split("/")[-1]}  floor {fl}'))
    sh = Image.open(f'props/level{n}_twist_rgba.png').convert('RGBA')
    bgc = Image.new('RGBA', sh.size, (64, 64, 76, 255)); bgc.alpha_composite(sh); t = bgc.convert('RGB')
    if n == 5:
        s = Image.open('bg/level5_harbour.jpg').convert('RGB'); s = s.resize((round(s.width * t.height / s.height), t.height))
        tt = Image.new('RGB', (t.width + 20 + s.width, t.height), (64, 64, 76)); tt.paste(t, (0, 0)); tt.paste(s, (t.width + 20, 0)); t = tt
    if n == 7:
        s = Image.open('bg/level7_shaft.jpg').convert('RGB'); s = s.resize((round(s.width * t.height / s.height), t.height))
        s2 = Image.new('RGB', (s.width, s.height * 2)); s2.paste(s, (0, 0)); s2.paste(s, (0, s.height)); s2 = s2.resize((s2.width // 2, s2.height // 2))
        tt = Image.new('RGB', (t.width + 20 + s2.width, max(t.height, s2.height)), (64, 64, 76)); tt.paste(t, (0, 0)); tt.paste(s2, (t.width + 20, 0)); t = tt
    rows.append(label(row(t), f'TWIST: {tw}  (level{n}_twist.png' + (', + level7_shaft.jpg x2 tiled' if n == 7 else ', + level5_harbour.jpg water strip' if n == 5 else '') + ')'))
    z = Image.open('bg/' + z2).convert('RGB')
    rows.append(label(row(band(z, fl)), f'ZONE 2 (new) {z2}  {z.width}x{z.height}  same floor {fl}'))
    # wrap seam: last 500 px + first 500 px
    seam = Image.new('RGB', (1000, 512)); seam.paste(z.crop((z.width - 500, 0, z.width, 512)), (0, 0)); seam.paste(z.crop((0, 0, 500, 512)), (500, 0))
    d = ImageDraw.Draw(seam); d.line([(500, 0), (500, 18)], fill=(255, 0, 0), width=3)
    seam = seam.resize((600, 307))
    if ar:
        p = 'bg/' + ar[4:] if ar.startswith('NEW:') else D + ar; A0 = Image.open(p).convert('RGB')
        a = band(A0, fl).resize((round(307 * A0.width / 512), 307))
        a = label(a, ('BOSS ARENA (NEW, proposed) ' if ar.startswith('NEW:') else 'BOSS ARENA (existing) ') + ar.split('/')[-1].replace('NEW:', ''))
    else:
        a = Image.new('RGB', (600, 307), (40, 20, 20)); label(a, 'NO SEPARATE ARENA BG EXISTS'); ImageDraw.Draw(a).text((10, 140), 'boss currently fights at end of the level strip', font=F, fill=(255, 255, 255))
    lab = label(seam, 'zone 2 tile wrap seam (red tick)')
    r4 = Image.new('RGB', (WID, 307), (20, 20, 20)); r4.paste(lab, (0, 0)); r4.paste(a, (620, 0)); rows.append(r4)
    H = sum(r.height + 8 for r in rows); o = Image.new('RGB', (WID, H), (12, 12, 12)); y = 0
    for r in rows: o.paste(r, (0, y)); y += r.height + 8
    o.save(f'contact/L{n}_contact.jpg', quality=84); print(n, o.size)
