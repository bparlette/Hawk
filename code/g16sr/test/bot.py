# Speed Run autoplay bot for the headless GPGX harness: plays all 15 scenes, screenshots each level/boss/end.
# usage: python3 bot.py ROM [--god]   (--god: refill HP each frame = test hook, only used if a fair run dies)
import sys, struct, random, ctypes as C, json, time
sys.path.insert(0, '/workspace/work/g16sr/test'); import lr
from lr import Emu
ROM = sys.argv[1]; GOD = '--god' in sys.argv; OUT = '/workspace/work/g16sr/shots/'
SYMF = '/workspace/work/g16sr/rom/out/symbol.txt'
SYM = {l.split()[2]: int(l.split()[0], 16) & 0xFFFF for l in open(SYMF) if len(l.split()) == 3}
e = Emu(ROM)
lr.L.retro_get_memory_data.restype = C.c_void_p; lr.L.retro_get_memory_size.restype = C.c_size_t
RAMP = lr.L.retro_get_memory_data(2)
def rd(a, n): return C.string_at(RAMP + a, n)
def r16(a): b = rd(a ^ 0, 2); return struct.unpack('<h', b)[0]   # GPGX stores 68k RAM byte-swapped per word
def rb(a): return rd(a ^ 1, 1)[0]
def r32(a): return (r16(a) & 0xFFFF) << 16 | (r16(a + 2) & 0xFFFF)
def w16(a, v): C.memmove(RAMP + a, struct.pack('<h', v), 2)
def st():
    P = SYM['P']; E = SYM['E']
    p = dict(x=r16(P + 8), y=r16(P + 10), z=r16(P + 12), hp=r16(P + 20))
    es = []
    for i in range(4):
        b = E + i * 36
        if rb(b + 4): es.append(dict(type=rb(b + 5), state=rb(b + 6), x=r16(b + 8), y=r16(b + 10), hp=r16(b + 20)))
    return p, es, rb(SYM['phase']), rb(SYM['curLv']), rb(SYM['bossIdx']), r16(SYM['camX']), r16(SYM['lives'])
e.run(150); e.shot(OUT + 'title.png')
e.tap('start', 6); e.run(60)
log = []; last = None; f = 0; random.seed(1); shotq = []; t0 = time.time(); bossSeen = set(); lvSeen = set()
MAXF = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 150000
while f < MAXF:
    p, es, ph, lv, bi, cam, lives = st()
    key = (ph, lv, bi)
    if key != last:
        log.append(dict(f=f, phase=ph, lv=lv + 1, boss=bi, lives=lives, hp=p['hp'], runT=r32(SYM['runT']))); last = key
        if ph == 0: shotq.append((f + 200, f'L{lv+1:02d}_wave.png')); lvSeen.add(lv + 1)
        if ph == 2: shotq.append((f + 150, f'L{lv+1:02d}_boss{bi+1}.png')); bossSeen.add((lv + 1, bi))
        if ph == 3: shotq.append((f + 60, f'L{lv+1:02d}_clear.png'))
        if ph == 4: shotq.append((f + 30, 'gameover.png'))
        if ph == 5: break
    if ph == 4 and f > log[-1]['f'] + 200: break
    for q in list(shotq):
        if f >= q[0]: e.shot(OUT + q[1]); shotq.remove(q)
    if GOD and p['hp'] < 12: w16(SYM['P'] + 20, 24)
    hold = []
    tg = [q for q in es if q['state'] not in (6,)]
    if tg and ph in (0, 2):
        t = min(tg, key=lambda q: abs(q['x'] - p['x']) + abs(q['y'] - p['y']) * 2)
        dx = t['x'] - p['x']; dy = t['y'] - p['y']
        if abs(dy) > 3: hold.append('down' if dy > 0 else 'up')
        if abs(dx) > 34: hold.append('right' if dx > 0 else 'left')
        elif abs(dx) < 18: hold.append('left' if dx > 0 else 'right')
        if abs(dx) < 44 and abs(dy) < 8:
            hold += ['right' if dx > 0 else 'left']
            if f % 8 < 3: hold.append('b')
            if f % 300 == 150 and p['hp'] > 8: hold = ['a']
            if f % 200 == 100: hold = ['c', 'b']
    elif ph == 1: hold = ['right']
    e.run(1, hold); f += 1
# end screen
p, es, ph, lv, bi, cam, lives = st()
if ph == 5:
    e.run(140); e.shot(OUT + 'end_screen.png')
sram = None
try:
    sp = lr.L.retro_get_memory_data(0); sn = lr.L.retro_get_memory_size(0); sram = C.string_at(sp, min(sn, 256))
except Exception as ex: pass
res = dict(frames=f, final_phase=ph, levels_seen=sorted(lvSeen), bosses_seen=sorted(bossSeen), lives=lives, runT=r32(SYM['runT']),
           splits=[r32(SYM['splits'] + 4 * i) for i in range(15)], bestTotal=r32(SYM['bestTotal']), god=GOD, secs=round(time.time() - t0),
           sram_head=sram[:16].hex() if sram else None, log=log)
json.dump(res, open('/workspace/work/g16sr/test/bot_result.json', 'w'), indent=1)
print(json.dumps({k: v for k, v in res.items() if k != 'log'}))
