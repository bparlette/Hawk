from kit import *
im = key('gen/l13_a.png'); C = comps(im, 1500)
get = lambda x, y: cut(im, next(c for c in C if abs(c[0]-x) < 12 and abs(c[1]-y) < 25))
pool, crater, shell, crys, post, portal = get(64, 56), get(94, 517), get(117, 344), get(818, 41), get(825, 332), get(1041, 133)
shell = trim(shell.crop((int(shell.width * 0.28), 0, shell.width, shell.height)))  # drop the baked flame tail (code glow does it)
parts = [('pool', fit(pool, 160)), ('crater', fit(crater, 96)), ('portal', fit(portal, 120)), ('crys', fit(crys, 40)), ('post', fit(post, 30)), ('shell', fit(shell, 36))]
place, sh = pack(parts, 512, 'level13_props.png')
preview(sh, 'view/pack13.jpg', k=1)
json.dump(place, open('meta13.json', 'w')); print(place, sh.size)
