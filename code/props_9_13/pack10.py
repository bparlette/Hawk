from kit import *
pr = key('gen/l10_props.png'); C = comps(pr, 1500)
get = lambda x, y: cut(pr, next(c for c in C if abs(c[0]-x) < 12 and abs(c[1]-y) < 20))
barrel, scar, ball, harp, fin = get(34, 25), get(98, 391), get(428, 57), get(707, 488), get(1113, 26)
tr = key('gen/l10_train.png'); Y1 = int(__import__('sys').argv[1]) if len(__import__('sys').argv) > 1 else 483
train = trim(tr.crop((0, 40, 1618, Y1)))
parts = [('train', fit(train, 260)), ('scar', fit(scar, 120)), ('fin', fit(fin, 110)), ('harp', fit(harp, 84)), ('barrel', fit(barrel, 64)), ('ball', fit(ball, 24))]
place, sheet = pack(parts, 512, 'level10_props.png')
preview(sheet, 'view/pack10.jpg')
Image.open('gen/l10_desert.png').convert('RGB').resize((320, 158), Image.LANCZOS).save('level10_rift.jpg', quality=86, optimize=True)
json.dump(place, open('meta10.json', 'w')); print(place, sheet.size)
