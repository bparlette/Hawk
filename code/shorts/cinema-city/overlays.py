from PIL import Image, ImageDraw, ImageFont, ImageFilter
W, H = 1080, 1920
F = '/usr/share/fonts/opentype/urw-base35/NimbusSansNarrow-BoldOblique.otf'
FB = '/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf'
def txt(d, xy, s, size, fill, stroke=8, sc=(20, 16, 31), font=F, anchor='mm', shadow=(255, 61, 110), sh=8):
    f = ImageFont.truetype(font, size)
    if shadow: d.text((xy[0] + sh, xy[1] + sh), s, font=f, fill=shadow, anchor=anchor, stroke_width=stroke, stroke_fill=shadow)
    d.text(xy, s, font=f, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=sc)
    return d.textbbox(xy, s, font=f, anchor=anchor, stroke_width=stroke)
def new(): return Image.new('RGBA', (W, H), (0, 0, 0, 0))
# KO! burst (center-left safe: x 460 keeps clear of the right 15%)
im = new(); d = ImageDraw.Draw(im); b = txt(d, (470, 640), 'KO!', 260, (255, 210, 60), stroke=14, sh=14); im.save('ov/ko.png'); print('ko', b)
# REPLAY badge (top-left, below the top 10%)
im = new(); d = ImageDraw.Draw(im)
d.rounded_rectangle((60, 230, 470, 330), 18, fill=(20, 16, 31, 215), outline=(255, 255, 255, 255), width=4)
d.ellipse((88, 258, 132, 302), fill=(255, 40, 60, 255))
b = txt(d, (152, 281), 'REPLAY', 78, (255, 255, 255), stroke=0, anchor='lm', shadow=None, font=FB); print('replay', b)
im.save('ov/replay.png')
im2 = im.copy(); d2 = ImageDraw.Draw(im2); b = txt(d2, (500, 281), 'SLOW-MO', 44, (255, 210, 60), stroke=5, anchor='lm', shadow=None); print('slow', b); im2.save('ov/replay_slow.png')
# feature captions (upper third)
for name, s in [('tag', 'TAG-TEAM FINISHER'), ('combo', 'BRUISER DOWN')]:
    im = new(); d = ImageDraw.Draw(im); b = txt(d, (470, 300), s, 92, (255, 255, 255), stroke=8, sh=6); print(name, b); im.save(f'ov/{name}.png')
# end card text layer
im = new(); d = ImageDraw.Draw(im)
d.rectangle((0, 0, W, H), fill=(14, 10, 24, 120))
txt(d, (470, 560), 'SHELL SHOCK', 50, (255, 210, 60), stroke=5, shadow=None)
txt(d, (470, 680), 'CINEMA CITY', 150, (255, 255, 255), stroke=10, sh=10)
d.rounded_rectangle((120, 880, 820, 1020), 26, fill=(255, 61, 110, 255), outline=(20, 16, 31, 255), width=6)
txt(d, (470, 950), 'PLAY FREE', 104, (255, 255, 255), stroke=6, shadow=None)
b = txt(d, (470, 1110), 'shellshock-cinema-city.surge.sh', 50, (255, 255, 255), stroke=5, shadow=None, font=FB); print('url', b)
txt(d, (470, 1190), 'in your browser · phone or desktop', 36, (220, 214, 255), stroke=4, shadow=None, font=FB)
txt(d, (470, 1420), 'Unofficial fan project · original characters', 30, (200, 196, 230), stroke=3, shadow=None, font=FB)
im.save('ov/end.png')
# title card (over the intro sweep, after the 1.2 s hook)
im = new(); d = ImageDraw.Draw(im)
txt(d, (470, 700), 'SHELL SHOCK', 56, (255, 210, 60), stroke=6, shadow=None)
txt(d, (470, 830), 'CINEMA CITY', 160, (255, 255, 255), stroke=12, sh=12)
b = txt(d, (470, 960), 'a turtle-hero street brawler', 48, (255, 255, 255), stroke=6, shadow=None, font=FB); print('title sub', b)
im.save('ov/title.png')
