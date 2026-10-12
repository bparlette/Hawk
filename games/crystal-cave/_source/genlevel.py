W,H=100,20
g=[[' ']*W for _ in range(H)]
def s(x,y,c): g[y][x]=c
for x in range(W):
    for y in range(0,3): s(x,y,'#')
    for y in range(16,20): s(x,y,'#')
for x in [0,1,98,99]:
    for y in range(H): s(x,y,'#')
# irregular ceiling row 3 / stalactites row 4
import random; random.seed(3)
for x in range(W):
    if random.random()<0.6: s(x,3,'#')
for x in [9,10,27,45,46,57,66,92]: s(x,3,'#'); s(x,4,'#')
# pits
for x in list(range(18,21))+list(range(36,41))+list(range(60,66))+list(range(83,87)):
    for y in range(16,20): s(x,y,' ')
s(3,15,'S')
for x,c in zip([7,8,9],'B?B'): s(x,12,c)
for x in [5,6]: s(x,13,'o')
for y in (14,15):
    for x in (12,13): s(x,y,'P')
s(15,15,'e')
for x in (23,24,25): s(x,13,'C'); s(x,11,'o')
s(22,14,'o'); s(26,14,'o')
for x in range(28,36):
    for y in (14,15): s(x,y,'#')
s(32,13,'e'); s(31,10,'?'); s(30,10,'B'); s(32,10,'B')
s(38,13,'C'); s(37,11,'o'); s(38,11,'o'); s(39,11,'o')
for y in (13,14,15):
    for x in (44,45): s(x,y,'P')
s(47,11,'?'); s(46,11,'B'); s(48,11,'B')
s(50,15,'#')
for y in (14,15): s(51,y,'#')
for y in (13,14,15):
    for x in (52,53): s(x,y,'#')
s(52,12,'o'); s(53,12,'o'); s(55,14,'o')
for x in (57,58): s(x,13,'o')
s(62,13,'C'); s(63,13,'C'); s(62,11,'o'); s(63,11,'o')
for x in range(70,76):
    for y in range(3,12): s(x,y,'#')
s(73,15,'e'); s(71,14,'o'); s(74,14,'o')
s(68,11,'?')
for y in (13,14,15):
    for x in (78,79): s(x,y,'P')
for x in (84,85): s(x,11,'o')
s(87,15,'#')
for y in (14,15): s(88,y,'#')
for y in (13,14,15):
    for x in (89,90): s(x,y,'#')
s(89,12,'o'); s(90,12,'o')
s(95,15,'G')
rows=[''.join(r) for r in g]
open('src/level.js','w').write('// Level as a 2D tile grid (row 0 = top). Legend:\n// # rock  C crystal platform  P stone column  B brick block  ? rune block\n// o coin  e crystal beetle  S start  G goal gate\nexport const LEVEL = [\n'+',\n'.join("  '"+r+"'" for r in rows)+'\n];\n')
print('\n'.join(rows))
