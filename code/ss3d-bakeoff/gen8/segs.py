import sys, numpy as np
from PIL import Image
def rows(path):
    a=np.array(Image.open(path).convert('RGBA'))[:,:,3]>40
    r=a.sum(1)>0; bands=[]; y=0;H=len(r)
    while y<H:
        if r[y]:
            y0=y
            while y<H and r[y]: y+=1
            if y-y0>150: bands.append((y0,y))
        y+=1
    out=[]
    for y0,y1 in bands:
        c=a[y0:y1].sum(0)>0; segs=[]; x=0; W=len(c)
        while x<W:
            if c[x]:
                x0=x
                while x<W and c[x]: x+=1
                segs.append((x0,x))
            x+=1
        out.append(((y0,y1),[s for s in segs if s[1]-s[0]>8]))
    return out
for p in sys.argv[1:]:
    for b,s in rows(p): print(p,b,s)
