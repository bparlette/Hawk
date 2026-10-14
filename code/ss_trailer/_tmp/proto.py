import sys,os,json,time
from build import *
L=MOMENT_BEATS*BEAT
lv=[int(x) for x in sys.argv[1:]] or range(1,16)
sheet=Image.new("RGB",(4*320,len(lv)*180))
for r,n in enumerate(lv):
    t0=time.time()
    c=Cap('level%d'%n);m=find_moments(c);st,k=best_moment(c,m)
    f=c.framer(st,L,m['boss_intro'],m['boss_ko'])
    print(n,'plate',c._plate_n,'cx%% %.2f..%.2f'%(f.cx.min()/1152,f.cx.max()/1152),'cy %.0f'%f.cy, '%.1fs'%(time.time()-t0))
    for j,off in enumerate([0,L//3,2*L//3,L-1]):
        sheet.paste(f(st+off,off).resize((320,180)),(j*320,r*180))
sheet.save('_tmp/proto_%s.jpg'%('_'.join(map(str,lv))),quality=80)
