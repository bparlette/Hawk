from kit import *
im = key('gen/l12_a.png'); C = comps(im, 1500)
get = lambda x, y: cut(im, next(c for c in C if abs(c[0]-x) < 12 and abs(c[1]-y) < 25))
carP, carC, carY, drone, pad, cube = get(43, 53), get(737, 53), get(43, 300), get(788, 324), get(75, 560), get(987, 570)
parts = [('carP', fit(carP, 180)), ('carC', fit(carC, 180)), ('carY', fit(carY, 180)), ('drone', fit(drone, 120)), ('pad', fit(pad, 144)), ('cube', fit(cube, 24))]
place, sh = pack(parts, 560, 'level12_props.png')
preview(sh, 'view/pack12.jpg', k=1)
sky = Image.open('gen/l12_sky.png').convert('RGB').crop((514, 65, 1214, 365)).resize((288, 123), Image.LANCZOS)
sky.save('level12_xsky.jpg', quality=86, optimize=True)
json.dump(place, open('meta12.json', 'w')); print(place, sh.size)
