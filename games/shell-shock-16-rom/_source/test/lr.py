# Minimal headless libretro frontend for Genesis Plus GX: run a ROM, feed scripted pad input, grab frames.
import ctypes as C, numpy as np, os, sys
from PIL import Image
CORE='/workspace/work/g16/gpgx/genesis_plus_gx_libretro.so'
L=C.CDLL(CORE)
ENV=C.CFUNCTYPE(C.c_bool,C.c_uint,C.c_void_p); VID=C.CFUNCTYPE(None,C.c_void_p,C.c_uint,C.c_uint,C.c_size_t)
AUD=C.CFUNCTYPE(None,C.c_int16,C.c_int16); AUDB=C.CFUNCTYPE(C.c_size_t,C.c_void_p,C.c_size_t)
POLL=C.CFUNCTYPE(None); STATE=C.CFUNCTYPE(C.c_int16,C.c_uint,C.c_uint,C.c_uint,C.c_uint)
class GI(C.Structure): _fields_=[('path',C.c_char_p),('data',C.c_void_p),('size',C.c_size_t),('meta',C.c_char_p)]
SYS=C.c_char_p(b'/tmp'); FMT=[0]
# libretro joypad ids: B=0 Y=1 SELECT=2 START=3 UP=4 DOWN=5 LEFT=6 RIGHT=7 A=8 X=9 L=10 R=11
# GPGX 3-button mapping: Genesis A=Y(1), B=B(0), C=A(8), START=3
BTN={'up':4,'down':5,'left':6,'right':7,'start':3,'a':1,'b':0,'c':8}
class Emu:
    def __init__(s,rom):
        s.held=set(); s.frame=None; s.n=0; s.audio=0
        def env(cmd,data):
            if cmd==9: C.cast(data,C.POINTER(C.c_char_p))[0]=SYS.value; return True   # system dir
            if cmd==31: C.cast(data,C.POINTER(C.c_char_p))[0]=SYS.value; return True  # save dir
            if cmd==10: FMT[0]=C.cast(data,C.POINTER(C.c_int))[0]; return True        # pixel format
            if cmd==15: return False
            return False
        def vid(d,w,h,p):
            if d: 
                buf=(C.c_uint16*(p//2*h)).from_address(d); a=np.frombuffer(buf,np.uint16).reshape(h,p//2)[:, :w].copy(); s.frame=a
        def aud(l,r): pass
        def audb(d,n): s.audio+=n; return n
        def poll(): pass
        def st(port,dev,idx,id): return 1 if port==0 and dev==1 and id in s.held else 0
        s.cbs=[ENV(env),VID(vid),AUD(aud),AUDB(audb),POLL(poll),STATE(st)]
        L.retro_set_environment(s.cbs[0]); L.retro_init()
        L.retro_set_video_refresh(s.cbs[1]); L.retro_set_audio_sample(s.cbs[2]); L.retro_set_audio_sample_batch(s.cbs[3])
        L.retro_set_input_poll(s.cbs[4]); L.retro_set_input_state(s.cbs[5])
        data=open(rom,'rb').read(); s.buf=C.create_string_buffer(data,len(data))
        gi=GI(rom.encode(),C.cast(s.buf,C.c_void_p),len(data),None); assert L.retro_load_game(C.byref(gi)), 'load failed'
    def run(s,n=1,hold=()):
        s.held={BTN[b] for b in hold}
        for _ in range(n): L.retro_run(); s.n+=1
    def tap(s,b,n=4): s.run(n,(b,)); s.run(n)
    def shot(s,path=None):
        a=s.frame.astype(np.uint32); r=((a>>11)&31)*255//31; g=((a>>5)&63)*255//63; b=(a&31)*255//31
        im=Image.fromarray(np.dstack([r,g,b]).astype(np.uint8)); 
        if path: im.save(path)
        return im
    def ram(s):  # 64KB 68k work RAM
        L.retro_get_memory_data.restype=C.c_void_p; L.retro_get_memory_size.restype=C.c_size_t
        p=L.retro_get_memory_data(2); n=L.retro_get_memory_size(2); return bytes((C.c_ubyte*n).from_address(p))
if __name__=='__main__':
    e=Emu(sys.argv[1]); e.run(int(sys.argv[2]) if len(sys.argv)>2 else 300); e.shot('shot.png'); print('frames',e.n,'fmt',FMT[0],e.frame.shape)
