# contact sheet per level: row 1 = zone 1 | twist art | zone 2 | arena ; row 2 = twist art staged on its bg at game scale
import json
from PIL import Image, ImageDraw
Ld = '/workspace/work/deploy/shell-shock-live-action/levels/'
M = json.load(open('out/meta.json'))
S = 512 / 224 / 2   # sheets are stored at ~2 px per world px; bgs at 2.286 px per world px
LV = {
 8:  dict(z1='level8_fortress', z2='level8_reactor', ar='level8_final_boss', sh='level8_sentry.png', fl=172,
          stage=('z1', [('lamp', 300, 60), ('lampRed', 520, 60), ('klaxon', 700, 200), ('cover', 220, 175), ('alcove', 860, 160)])),
 9:  dict(z1='level9_edo', z2='level9_bamboo', ar='level9_castle', sh='level9_ronin.png', fl=172,
          stage=('z1', [('idle', 200, 196), ('guard', 360, 196), ('wind', 520, 196), ('slash', 700, 196), ('lunge', 880, 196), ('down', 1050, 196)])),
 10: dict(z1='level10_galleon', z2='level10_gundeck', ar='level10_galleon_boss', sh='level10_collapse.png', fl=166,
          stage=('z1', [('mast', 380, 200), ('hole', 820, 200), ('plank1', 960, 120), ('plank2', 1010, 90), ('keg', 1150, 200), ('ladder', 1300, 210)])),
 11: dict(z1='level11_train', z2='level11_saloon', ar='level11_boss', sh='level11_handcar.png', fl=147,
          stage=('desert', [('track', 330, 196), ('handcarA', 330, 186), ('track', 1000, 196), ('outlawCar', 1000, 186)])),
 12: dict(z1='level12_skyway', z2='level12_station', ar='level12_datahub', sh='level12_ally.png', fl=170,
          stage=('z1', [('gateLock', 1200, 200), ('botHack', 1080, 150), ('bot', 600, 140), ('botHurt', 760, 150), ('botCheer', 900, 140)])),
 13: dict(z1='level13_dimx', z2='level13_canyon', ar='level13_dimx_boss', sh='level13_turret.png', fl=150,
          stage=('z1', [('cannon', 420, 185), ('cannonFire', 760, 185), ('pod', 1020, 90), ('shell', 900, 70), ('rubble', 1220, 190)])),
 14: dict(z1='level14_portal', z2='level14_elstreet', ar='level14_technodrome', sh='level14_tendril.png', fl=170,
          stage=('z2', [('mound', 300, 200), ('drillHalf', 560, 200), ('drillFull', 860, 205), ('crater', 1150, 205), ('chunk1', 1000, 120), ('chunk3', 1300, 150)])),
 15: dict(z1='level15_lab', z2='level15_dojo', ar='level15_penthouse', tw='level15_elevator', sh='level15_freefall.png', fl=178,
          stage=('tw', [('cable', 200, 140), ('brake', 120, 120), ('brake', 760, 120), ('weight', 560, 60), ('hatch', 420, 40), ('elight', 440, 70)])),
}
def bg(name):
    try: return Image.open(Ld + name + '.jpg').convert('RGB')
    except FileNotFoundError: return Image.open('out/' + name + '.jpg').convert('RGB')
def h(im, H): return im.resize((max(1, round(im.width * H / im.height)), H), Image.LANCZOS)
def label(img, txt):
    d = ImageDraw.Draw(img); d.rectangle([0, 0, 8 * len(txt) + 10, 18], fill=(0, 0, 0)); d.text((5, 3), txt, fill=(255, 255, 120)); return img
for n, L in LV.items():
    sheet = Image.open('out/' + L['sh']).convert('RGBA')
    tw = Image.new('RGBA', sheet.size, (60, 60, 72, 255)); tw.alpha_composite(sheet)
    H = 300
    cells = [label(h(bg(L['z1']), H), 'ZONE 1  ' + L['z1']), label(h(tw.convert('RGB'), H), 'TWIST ART  ' + L['sh']),
             label(h(bg(L['z2']), H), 'ZONE 2  ' + L['z2'] + ' (new)'), label(h(bg(L['ar']), H), 'ARENA  ' + L['ar'])]
    if 'tw' in L: cells.insert(1, label(h(bg(L['tw']), H), 'TWIST BG  ' + L['tw']))
    # staged row
    key, items = L['stage']
    base = bg({'z1': L['z1'], 'z2': L['z2'], 'tw': L.get('tw', L['z1']), 'desert': 'level11_desert'}[key])
    if base.height != 512: base = h(base, 512)
    base = base.crop((0, 0, min(base.width, 1500), 512)).convert('RGBA')
    fr = M[L['sh']]
    for name, x, wy in items:   # x = image px, wy = world y of the sprite's feet (bottom)
        r = fr[name]; spr = sheet.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])); spr = spr.resize((max(1, round(spr.width * S * 1.0)), max(1, round(spr.height * S))), Image.LANCZOS)
        y = round(wy * 512 / 224) - spr.height
        base.alpha_composite(spr, (max(0, x - spr.width // 2), max(0, y)))
    d = ImageDraw.Draw(base); fy = round(L['fl'] * 512 / 224); d.line([(0, fy), (base.width, fy)], fill=(255, 40, 40, 255), width=1)
    stg = label(h(base.convert('RGB'), H), 'STAGED at game scale (red = floor top)')
    W = sum(c.width + 8 for c in cells); row2w = stg.width
    out = Image.new('RGB', (max(W, row2w), H * 2 + 30), (255, 255, 255)); x = 0
    for c in cells: out.paste(c, (x, 0)); x += c.width + 8
    out.paste(stg, (0, H + 20))
    ImageDraw.Draw(out).text((row2w + 20, H + 40), 'LEVEL %d' % n, fill=(0, 0, 0))
    out.save('contact/L%d_contact.jpg' % n, quality=84); print(n, out.size)
