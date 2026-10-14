# Checks the SRAM load path: pre-fill cart SRAM with a saved best (same layout the ROM writes), boot, read bestTotal.
import sys, struct, ctypes as C
sys.path.insert(0, '/workspace/work/g16sr/test'); import lr
ROM = sys.argv[1]; SYM = {l.split()[2]: int(l.split()[0], 16) & 0xFFFF for l in open(ROM.replace('rom.bin', 'symbol.txt')) if len(l.split()) == 3}
e = lr.Emu(ROM); L = lr.L; L.retro_get_memory_data.restype = C.c_void_p; L.retro_get_memory_size.restype = C.c_size_t
sp = L.retro_get_memory_data(0); sn = L.retro_get_memory_size(0); print('sram size', sn)
lv = [3000 + i for i in range(15)]; tot = 54179; s = tot + sum(lv)
longs = [0x53533136, tot] + lv + [(s ^ 0xA5A5A5A5) & 0xFFFFFFFF]
data = b''.join(struct.pack('>I', v) for v in longs)
buf = bytearray(C.string_at(sp, sn))
for i, b in enumerate(data): buf[2 * i] = 0xFF; buf[2 * i + 1] = b
C.memmove(sp, bytes(buf), sn)
L.retro_reset(); e.run(200); e.shot('/workspace/work/g16sr/shots/title_with_best.png')
r = C.string_at(L.retro_get_memory_data(2), 65536)
def r16(a): return struct.unpack('<H', r[a:a + 2])[0]
print('bestTotal read by ROM:', (r16(SYM['bestTotal']) << 16) | r16(SYM['bestTotal'] + 2), 'expected', tot)
