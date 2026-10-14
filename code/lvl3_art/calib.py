from seg import load,comps
import numpy as np
from scipy import ndimage as ndi
S={s:load(f'gator_sheet{s}.png') for s in 'ABCDE'}
C={s:comps(S[s]) for s in S}
def boots(s,i):
    a=S[s]; lab,cs=C[s]; c=cs[i]; m=lab==c[0]
    rgb=a[...,:3]; lum=rgb.mean(-1); sat=rgb.max(-1)-rgb.min(-1)
    d=m&(lum<70)&(sat<40)
    y1=c[5]; d[:max(0,y1-170)]=False
    lab2,n=ndi.label(d)
    res=[]
    for j,sl in enumerate(ndi.find_objects(lab2),1):
        cnt=(lab2[sl]==j).sum()
        if cnt>1500: res.append((sl[0].stop-sl[0].start, sl[1].stop-sl[1].start, cnt, sl[0].stop))
    return c[5]-c[3], res
for s,i in [('A',0),('A',1),('B',2),('B',3),('C',3),('D',0),('D',1),('D',2),('E',1),('E',2),('E',0)]:
    print(s,i,boots(s,i))
