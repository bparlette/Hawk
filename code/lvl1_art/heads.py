# measure head size: orange mohawk blob height/width + face per frame, for cross-sheet scale
from PIL import Image; import numpy as np
from scipy import ndimage as ndi
from seg import load, comps
for s in 'ABC':
    a=load(f'scorch_{s}.png'); lab,cs=comps(a)
    for j,c in enumerate(cs):
        m=lab==c[0]; r,g,b=[a[...,i] for i in range(3)]
        org=m&(r>170)&(g>60)&(g<150)&(b<60)&(r-g>60)
        # mohawk = largest orange blob that is not flame (flames are yellower; mohawk g<130)
        l2,n=ndi.label(ndi.binary_closing(org,iterations=2))
        if n==0: print(s,j,'none'); continue
        sz=ndi.sum(org,l2,range(1,n+1)); sl=ndi.find_objects(l2)
        info=sorted([(int(sz[i]),sl[i][0].stop-sl[i][0].start,sl[i][1].stop-sl[i][1].start,sl[i][0].start,sl[i][1].start) for i in range(n)],reverse=True)[:3]
        print(s,j,c[2:],info)
