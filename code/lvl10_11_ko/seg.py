import numpy as np, json, sys
from PIL import Image
from scipy import ndimage
def load(f, keyband=False):
    a=np.array(Image.open(f).convert('RGBA')).astype(int)
    r,g,b,al=a[...,0],a[...,1],a[...,2],a[...,3]
    green = (g-np.maximum(r,b)>18)&(g>120)
    al[green]=0
    # de-fringe: clamp green spill
    m=np.maximum(r,b); spill=g>m+4; a[...,1]=np.where(spill,m+4,g)
    al[al<40]=0
    a[...,3]=al
    return a.astype(np.uint8)
def comps(a, minpix=3000):
    mask=a[...,3]>0
    lab,n=ndimage.label(ndimage.binary_dilation(mask,iterations=6))
    out=[]
    for i,s in enumerate(ndimage.find_objects(lab)):
        if (lab[s]==i+1).sum()<minpix: continue
        out.append(s)
    out.sort(key=lambda s:s[1].start)
    res=[]
    for s in out:
        sub=a[s].copy(); 
        lab2=lab[s]; # keep only this comp
        idx=lab2==(lab[s][lab2>0].max() if False else lab2[lab2>0][0])
        res.append((s,sub))
    return res
if __name__=='__main__':
    for f in sys.argv[1:]:
        a=load(f); Image.fromarray(a).save(f.replace('gen','key'))
        for s,sub in comps(a): print(f, s[1].start,s[1].stop,s[0].start,s[0].stop)
